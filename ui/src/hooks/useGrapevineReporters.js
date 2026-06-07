import { useState, useEffect } from 'react';

/**
 * Hook: fetch the VERIFIED users who NIP-56-reported <observee>, with owner/House-POV
 * GrapeRank metrics, from `/api/get-grapevine-reporters`. Returns { data, loading, error }.
 *
 * v1 is owner/House POV only (ADR 0002), so `observer` is not sent — the endpoint
 * defaults to the instance owner. Mirrors useGrapevineFollows.js.
 */
export default function useGrapevineReporters(observee) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!observee) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(`/api/get-grapevine-reporters?observee=${observee}`, { signal: controller.signal })
      .then(r => r.json())
      .then(json => {
        if (json?.success && Array.isArray(json.data)) {
          setData(json.data);
        } else {
          setData(null);
          setError(json?.message || json?.error || 'No data');
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
  }, [observee]);

  return { data, loading, error };
}
