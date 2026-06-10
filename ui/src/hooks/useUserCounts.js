import { useState, useEffect } from 'react';

/**
 * Hook: fetch a NostrUser's counts from `/api/get-user-counts` (Owner PoV).
 * `data` is passed through wholesale, so it carries whatever the endpoint returns:
 * `followingCount` (strfry, kind-3) plus `verifiedFollowerCount` / `verifiedReporterCount`
 * (Neo4j node property, count-only live fallback — ADR 0031). Returns { data, loading, error }.
 */
export default function useUserCounts(pubkey) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!pubkey) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(`/api/get-user-counts?pubkey=${pubkey}`, { signal: controller.signal })
      .then(r => r.json())
      .then(json => {
        if (json?.success && json.data) {
          setData(json.data);
        } else {
          setData(null);
          setError(json?.error || 'No data');
        }
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        setError(err.message || 'Fetch failed');
        setData(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [pubkey]);

  return { data, loading, error };
}
