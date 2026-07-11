import { useState, useCallback } from 'react';

/**
 * Story 11 / ADR 0010 — hook over the two user-facing refresh endpoints.
 *
 * `refreshing` is either null, `one:<pinEventId>`, or `all` so the UI can
 * disable the right buttons during in-flight calls.
 */
export default function useRefreshPin(viewerPubkey) {
  const [refreshing, setRefreshing] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [error, setError] = useState(null);

  const refreshOne = useCallback(async (pinEventId) => {
    setRefreshing(`one:${pinEventId}`); setError(null);
    try {
      const r = await fetch('/api/trusted-list/refresh-pinned-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinEventId }),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.success) {
        throw new Error(data?.error || `status ${r.status}`);
      }
      setLastResult(data);
      return data;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setRefreshing(null);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    if (!viewerPubkey) return null;
    setRefreshing('all'); setError(null);
    try {
      const r = await fetch(
        `/api/trusted-list/refresh-pinned-tags-for-viewer?viewerPubkey=${encodeURIComponent(viewerPubkey)}`,
        { method: 'POST' }
      );
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.success) {
        throw new Error(data?.error || `status ${r.status}`);
      }
      setLastResult(data);
      return data;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setRefreshing(null);
    }
  }, [viewerPubkey]);

  return { refreshing, refreshOne, refreshAll, lastResult, error };
}
