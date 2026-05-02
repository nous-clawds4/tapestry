import { useState, useEffect } from 'react';

/**
 * Hook: fetch a NostrUser's aggregate counts from `/api/get-user-data`.
 * Defaults to Owner POV (API default when observerPubkey is omitted).
 * Returns { data, loading, error }.
 */
export default function useUserData(pubkey) {
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

    fetch(`/api/get-user-data?pubkey=${pubkey}`, { signal: controller.signal })
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
