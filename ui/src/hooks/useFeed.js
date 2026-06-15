import { useState, useEffect } from 'react';

/**
 * Hook: fetch the Live Feed read-path output from `/api/feed` (ADR live-feed/0001,
 * consumed by ADR live-feed/0002). Returns { data, loading, error }.
 *
 * The read path returns `{ success: true, ...result }` where `result` is the
 * discriminated four-outcome object `{ status, source?, relaySource?, items? }`
 * (status ∈ {NO_SOURCE, FOLLOW_LIST_UNAVAILABLE, EMPTY, OK}). On a `success` body
 * we pass the WHOLE result object through as `data` — the page reads `status` and
 * `items`; we do NOT reshape it (no re-derivation; #1 owns the read path).
 *
 * A non-success body / non-2xx / thrown / malformed response sets `error`, which
 * drives the page's defensive "couldn't load" branch. No arguments — the source
 * identity is resolved server-side (there is deliberately no PoV picker). Aborts
 * the fetch on unmount, mirroring useGrapevineFollows.js.
 */
export default function useFeed() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch('/api/feed', { signal: controller.signal })
      .then(r => r.json())
      .then(json => {
        if (json?.success) {
          setData(json);
          setError(null);
        } else {
          setData(null);
          setError(json?.error || json?.message || 'Failed to load feed');
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
  }, []);

  return { data, loading, error };
}
