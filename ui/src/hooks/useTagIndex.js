import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Hook for the Tag-index page (Story 4 / ADR-0003).
 *
 * Manages sort/q/offset state, accumulates `rows` across "Load more" clicks,
 * and resets the row accumulator when sort or q changes.
 *
 * Fetches the unified `/api/tags/index` (notes + profiles; Story 13 / ADR 0012).
 * Gates on auth bootstrap so a fresh load of /tags resolves the active POV
 * correctly (same pattern as useTagDetail).
 */
const PAGE_SIZE = 50;

export default function useTagIndex() {
  const { user, loading: authLoading } = useAuth();

  const [sort, setSortState] = useState('used');
  const [q, setQState] = useState('');
  const [mineOnly, setMineOnlyState] = useState(false);
  // Story 13 / ADR 0012 — "Only tags I've pinned" filter.
  const [pinnedByMe, setPinnedByMeState] = useState(false);
  const [offset, setOffset] = useState(0);

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [povSuffix, setPovSuffix] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // When sort / q / mineOnly changes, reset to the first page. Wrapping the
  // setters means the page doesn't have to remember to also reset offset.
  const setSort = useCallback((next) => {
    setSortState(next);
    setOffset(0);
  }, []);
  const setQ = useCallback((next) => {
    setQState(next);
    setOffset(0);
  }, []);
  const setMineOnly = useCallback((next) => {
    setMineOnlyState(next);
    setOffset(0);
  }, []);
  const setPinnedByMe = useCallback((next) => {
    setPinnedByMeState(next);
    setOffset(0);
  }, []);

  // Track which fetch is "live" so a stale completion doesn't stomp.
  const liveSeqRef = useRef(0);

  useEffect(() => {
    if (authLoading) return undefined;
    const mySeq = ++liveSeqRef.current;
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      sort,
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });
    if (q) params.set('q', q);
    if (user?.pubkey) {
      params.set('wotPov', 'user');
      params.set('userPubkey', user.pubkey);
      // Story 13 / ADR 0012 — viewerPubkey drives per-row viewerPinned.
      params.set('viewerPubkey', user.pubkey);
    } else {
      params.set('wotPov', 'house');
    }
    // "Only show mine" filters to tags authored by the logged-in user.
    // Silently inactive when not logged in (toggle is hidden in the UI).
    if (mineOnly && user?.pubkey) {
      params.set('authoredBy', user.pubkey);
    }
    // Story 13 / ADR 0012 — "Only tags I've pinned" filter.
    if (pinnedByMe && user?.pubkey) {
      params.set('pinnedByMe', 'true');
    }

    // Unified tag directory across notes + profiles (Story 13 / ADR 0012).
    fetch(`/api/tags/index?${params}`)
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (cancelled || mySeq !== liveSeqRef.current) return;
        if (r.ok && data?.success) {
          setTotal(data.total || 0);
          setPovSuffix(data.povSuffix || null);
          // offset === 0 → replace; else → append.
          setRows((prev) => (offset === 0 ? (data.rows || []) : [...prev, ...(data.rows || [])]));
        } else {
          setError(data?.error || `status ${r.status}`);
        }
      })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [authLoading, user?.pubkey, sort, q, mineOnly, pinnedByMe, offset]);

  const loadMore = useCallback(() => {
    if (loading) return;
    if (rows.length >= total) return;
    setOffset((cur) => cur + PAGE_SIZE);
  }, [loading, rows.length, total]);

  return {
    rows, total, povSuffix,
    sort, setSort,
    q, setQ,
    mineOnly, setMineOnly,
    pinnedByMe, setPinnedByMe,
    loading, error,
    loadMore,
    pageSize: PAGE_SIZE,
    user,
  };
}
