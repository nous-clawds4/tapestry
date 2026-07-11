import { useState, useEffect } from 'react';

/**
 * Hook: up to 25 equally-short directed FOLLOWS paths from `source` to `target`
 * via GET /api/get-follows-hops-paths (story profile #39, ADR 0035). Its own
 * AbortController-scoped fetch — never blocks render.
 *
 * Returns { hops, paths, truncated, noPath, loading, error }:
 *   - hops:      number (0..20) when a path exists; null otherwise
 *   - paths:     array of paths, each an ordered [{pubkey, influence}]; [] when none
 *   - truncated: true when 25 paths were returned (there may be more)
 *   - noPath:    true ONLY for a confirmed no-path-within-cap (success && hops===null && paths empty) → render ∞
 *   - error:     set on a failed lookup (!success / fetch error) → render "—" (NOT ∞)
 */
export default function useFollowsHopsPaths(source, target) {
  const [hops, setHops] = useState(null);
  const [paths, setPaths] = useState([]);
  const [truncated, setTruncated] = useState(false);
  const [noPath, setNoPath] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!source || !target) {
      setHops(null); setPaths([]); setTruncated(false); setNoPath(false); setLoading(false); setError(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true); setNoPath(false); setError(null);

    fetch(`/api/get-follows-hops-paths?source=${source}&target=${target}`, { signal: controller.signal })
      .then(r => r.json())
      .then(json => {
        if (json?.success) {
          const ps = json.paths || [];
          setHops(json.hops);
          setPaths(ps);
          setTruncated(!!json.truncated);
          // Confirmed no path within cap → ∞ (distinct from an error).
          setNoPath(json.hops === null && ps.length === 0);
        } else {
          setHops(null); setPaths([]); setTruncated(false); setNoPath(false);
          setError(json?.error || 'Hop path unavailable');
        }
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        setHops(null); setPaths([]); setTruncated(false); setNoPath(false);
        setError(err.message || 'Hop path unavailable');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [source, target]);

  return { hops, paths, truncated, noPath, loading, error };
}
