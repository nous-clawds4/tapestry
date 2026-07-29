import { useState, useEffect } from 'react';

/**
 * Hook: up to 25 equally-short directed SERVES paths from the `child` goal to
 * the `parent` goal via GET /api/brain/serves-path — the Rationale page's
 * path read. Mirrors useFollowsHopsPaths (story profile #39, ADR 0035): its
 * own AbortController-scoped fetch, never blocks render.
 *
 * Returns { hops, paths, truncated, noPath, loading, error }:
 *   - hops:      number (0..20) when a path exists; null otherwise
 *   - paths:     array of paths, each an ordered [{uuid, name}] child→parent; [] when none
 *   - truncated: true when 25 paths were returned (there may be more)
 *   - noPath:    true ONLY for a confirmed no-path-within-cap (success && hops===null && paths empty)
 *   - error:     set on a failed lookup (!success / fetch error)
 */
export default function useServesPath(child, parent) {
  const [hops, setHops] = useState(null);
  const [paths, setPaths] = useState([]);
  const [truncated, setTruncated] = useState(false);
  const [noPath, setNoPath] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!child || !parent) {
      setHops(null); setPaths([]); setTruncated(false); setNoPath(false); setLoading(false); setError(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true); setNoPath(false); setError(null);

    const qs = `child=${encodeURIComponent(child)}&parent=${encodeURIComponent(parent)}`;
    fetch(`/api/brain/serves-path?${qs}`, { signal: controller.signal })
      .then(r => r.json())
      .then(json => {
        if (json?.success) {
          const ps = json.paths || [];
          setHops(json.hops);
          setPaths(ps);
          setTruncated(!!json.truncated);
          // Confirmed no path within cap — a state, not an error.
          setNoPath(json.hops === null && ps.length === 0);
        } else {
          setHops(null); setPaths([]); setTruncated(false); setNoPath(false);
          setError(json?.error || 'Serves path unavailable');
        }
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        setHops(null); setPaths([]); setTruncated(false); setNoPath(false);
        setError(err.message || 'Serves path unavailable');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [child, parent]);

  return { hops, paths, truncated, noPath, loading, error };
}
