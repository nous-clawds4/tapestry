import { useState, useEffect } from 'react';

/**
 * Hook: live directed FOLLOWS shortest-path distance from `source` to `target`
 * via GET /api/get-follows-hops (story profile #38, ADR 0034). Loads
 * independently of the rest of the profile page (its own AbortController-scoped
 * fetch), so it never blocks render.
 *
 * Returns { hops, noPath, loading, error }:
 *   - hops:   number (0..20) when a path is found; null otherwise
 *   - noPath: true ONLY for a confirmed no-path-within-cap (success && hops === null) → render ∞
 *   - error:  set on a failed lookup (!success / fetch error) → render "—" (NOT ∞)
 */
export default function useFollowsHops(source, target) {
  const [hops, setHops] = useState(null);
  const [noPath, setNoPath] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!source || !target) {
      setHops(null);
      setNoPath(false);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setNoPath(false);
    setError(null);

    fetch(`/api/get-follows-hops?source=${source}&target=${target}`, { signal: controller.signal })
      .then(r => r.json())
      .then(json => {
        if (json?.success) {
          if (json.hops === null || json.hops === undefined) {
            // Confirmed no path within cap → ∞.
            setHops(null);
            setNoPath(true);
          } else {
            setHops(json.hops);
            setNoPath(false);
          }
        } else {
          // Lookup failed — distinct from no-path; UI shows "—", never ∞.
          setHops(null);
          setNoPath(false);
          setError(json?.error || 'Hop distance unavailable');
        }
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        setHops(null);
        setNoPath(false);
        setError(err.message || 'Hop distance unavailable');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [source, target]);

  return { hops, noPath, loading, error };
}
