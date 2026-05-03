import { useState, useEffect } from 'react';

/**
 * Hook: fetch a NostrUser's precomputed counts from `/api/get-user-counts`.
 * Owner POV (NostrUser node properties). Lightweight — no graph traversals.
 * Returns { data, loading, error }.
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
