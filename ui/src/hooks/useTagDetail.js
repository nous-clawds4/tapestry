import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Hook for the Tag-detail page (Story 2 / ADR-0002).
 *
 * Fetches the tag header (`/api/profile-tags/by-id`) immediately on mount —
 * no auth dependency. Fetches the WoT-filtered rows
 * (`/api/profile-tags/profiles-tagged`) only after the auth bootstrap has
 * settled, so a fresh page-load doesn't race the POV decision.
 *
 * Sort changes trigger a re-fetch of the rows section only; the header
 * doesn't flicker.
 */
export default function useTagDetail(tagId) {
  const { user, loading: authLoading } = useAuth();

  const [tag, setTag] = useState(null);
  const [author, setAuthor] = useState(null);
  const [headerLoading, setHeaderLoading] = useState(true);
  const [headerError, setHeaderError] = useState(null);

  const [rows, setRows] = useState([]);
  const [povSuffix, setPovSuffix] = useState(null);
  const [sort, setSort] = useState('applied');
  const [rowsLoading, setRowsLoading] = useState(false);
  const [rowsError, setRowsError] = useState(null);

  useEffect(() => {
    if (!tagId) return undefined;
    let cancelled = false;
    setHeaderLoading(true);
    setHeaderError(null);
    fetch(`/api/profile-tags/by-id?tagEventId=${encodeURIComponent(tagId)}`)
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (cancelled) return;
        if (r.status === 404) {
          setHeaderError('not-found');
          setTag(null);
          setAuthor(null);
        } else if (r.ok && data?.success) {
          setTag(data.tag);
          setAuthor(data.author);
        } else {
          setHeaderError(data?.error || `status ${r.status}`);
        }
      })
      .catch((err) => { if (!cancelled) setHeaderError(err.message); })
      .finally(() => { if (!cancelled) setHeaderLoading(false); });
    return () => { cancelled = true; };
  }, [tagId]);

  useEffect(() => {
    if (!tagId) return undefined;
    if (authLoading) return undefined;
    let cancelled = false;
    setRowsLoading(true);
    setRowsError(null);

    const params = new URLSearchParams({ tagEventId: tagId, sort });
    if (user?.pubkey) {
      params.set('wotPov', 'user');
      params.set('userPubkey', user.pubkey);
    } else {
      params.set('wotPov', 'house');
    }

    fetch(`/api/profile-tags/profiles-tagged?${params}`)
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (cancelled) return;
        if (r.ok && data?.success) {
          setRows(data.rows || []);
          setPovSuffix(data.povSuffix || null);
        } else {
          setRowsError(data?.error || `status ${r.status}`);
        }
      })
      .catch((err) => { if (!cancelled) setRowsError(err.message); })
      .finally(() => { if (!cancelled) setRowsLoading(false); });

    return () => { cancelled = true; };
  }, [tagId, sort, authLoading, user?.pubkey]);

  return {
    tag, author, rows, povSuffix,
    sort, setSort,
    headerLoading, rowsLoading,
    headerError, rowsError,
  };
}
