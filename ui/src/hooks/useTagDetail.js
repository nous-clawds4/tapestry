import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePov } from '../context/PovContext';

/**
 * Hook for the Tag-detail page (Story 2 / ADR-0002, extended by Story 3 /
 * ADR-0004).
 *
 * Fetches the tag header (`/api/profile-tags/by-id`) immediately on mount —
 * no auth dependency. Fetches the WoT-filtered rows
 * (`/api/profile-tags/profiles-tagged`) only after the auth bootstrap has
 * settled, so a fresh page-load doesn't race the POV decision.
 *
 * When the viewer is logged in, the hook threads `viewerPubkey` to the
 * server so the response includes a `viewerAssertions` map and per-row
 * `onlyViewerVisible` flag (ADR-0004 viewer-union). `refetchRows` lets the
 * tag page re-pull rows after a publish without touching sort/POV.
 */
export default function useTagDetail(tagId) {
  const { user, loading: authLoading } = useAuth();
  const { povParams } = usePov();

  const [tag, setTag] = useState(null);
  const [author, setAuthor] = useState(null);
  const [viewerPin, setViewerPin] = useState(null);
  const [headerLoading, setHeaderLoading] = useState(true);
  const [headerError, setHeaderError] = useState(null);
  const [headerReloadKey, setHeaderReloadKey] = useState(0);

  const [rows, setRows] = useState([]);
  const [viewerAssertions, setViewerAssertions] = useState({});
  const [povSuffix, setPovSuffix] = useState(null);
  const [povResolution, setPovResolution] = useState(null);
  const [sort, setSort] = useState('applied');
  const [rowsLoading, setRowsLoading] = useState(false);
  const [rowsError, setRowsError] = useState(null);
  const [rowsReloadKey, setRowsReloadKey] = useState(0);

  const refetchRows = useCallback(() => setRowsReloadKey((k) => k + 1), []);
  const refetchHeader = useCallback(() => setHeaderReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!tagId) return undefined;
    if (authLoading) return undefined;
    let cancelled = false;
    setHeaderLoading(true);
    setHeaderError(null);
    const params = new URLSearchParams({ tagEventId: tagId });
    if (user?.pubkey) params.set('viewerPubkey', user.pubkey);
    fetch(`/api/profile-tags/by-id?${params}`)
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (cancelled) return;
        if (r.status === 404) {
          setHeaderError('not-found');
          setTag(null);
          setAuthor(null);
          setViewerPin(null);
        } else if (r.ok && data?.success) {
          setTag(data.tag);
          setAuthor(data.author);
          setViewerPin(data.viewerPin || null);
        } else {
          setHeaderError(data?.error || `status ${r.status}`);
        }
      })
      .catch((err) => { if (!cancelled) setHeaderError(err.message); })
      .finally(() => { if (!cancelled) setHeaderLoading(false); });
    return () => { cancelled = true; };
  }, [tagId, authLoading, user?.pubkey, headerReloadKey]);

  useEffect(() => {
    if (!tagId) return undefined;
    if (authLoading) return undefined;
    let cancelled = false;
    setRowsLoading(true);
    setRowsError(null);

    const params = new URLSearchParams({ tagEventId: tagId, sort });
    // Selected-POV read params (ADR pov-selectable-tag-surfaces/0001).
    Object.entries(povParams).forEach(([k, v]) => params.set(k, v));
    // viewerPubkey drives the viewer-union rows + per-row viewer flags (ADR-0004).
    if (user?.pubkey) params.set('viewerPubkey', user.pubkey);

    fetch(`/api/profile-tags/profiles-tagged?${params}`)
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (cancelled) return;
        if (r.ok && data?.success) {
          setRows(data.rows || []);
          setViewerAssertions(data.viewerAssertions || {});
          setPovSuffix(data.povSuffix || null);
          setPovResolution(data.povResolution || null);
        } else {
          setRowsError(data?.error || `status ${r.status}`);
        }
      })
      .catch((err) => { if (!cancelled) setRowsError(err.message); })
      .finally(() => { if (!cancelled) setRowsLoading(false); });

    return () => { cancelled = true; };
  }, [tagId, sort, authLoading, user?.pubkey, rowsReloadKey, povParams.wotPov, povParams.userPubkey]);

  return {
    tag, author, viewerPin, rows, viewerAssertions, povSuffix, povResolution,
    sort, setSort,
    headerLoading, rowsLoading,
    headerError, rowsError,
    refetchRows, refetchHeader,
  };
}
