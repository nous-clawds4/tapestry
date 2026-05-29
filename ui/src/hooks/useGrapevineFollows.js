import { useState, useEffect } from 'react';

/**
 * Hook: fetch the accounts <observee> follows, with owner-POV GrapeRank metrics,
 * from `/api/get-grapevine-follows`. Returns { data, loading, error }.
 *
 * v1 is owner POV only (ADR 0026), so `observer` is not sent — the endpoint
 * defaults to the instance owner. Mirrors the useUserCounts.js fetch convention.
 */
export default function useGrapevineFollows(observee) {
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

    fetch(`/api/get-grapevine-follows?observee=${observee}`, { signal: controller.signal })
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
