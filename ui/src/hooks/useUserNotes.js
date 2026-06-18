import { useState, useEffect } from 'react';

/**
 * Hook: fetch a single user's recent kind-1 notes from the by-author read path
 * (`/api/user/:pubkey/notes?limit=`, ADR note-surfaces/0001), consumed by the profile
 * "Content" section (limit 1) and the per-user /notes page (limit 50). Returns
 * { data, loading, error }.
 *
 * The read path returns `{ success: true, ...result }` where `result` is the discriminated
 * three-outcome object `{ status, relaySource?, items? }` (status ∈ {OK, EMPTY, INVALID}).
 * On a `success` body we pass the WHOLE result object through as `data` — the surfaces read
 * `status` + `items`; we do NOT reshape it (no re-derivation; #1 owns the read path).
 *
 * A non-success body / non-2xx / thrown / malformed response sets `error`, which drives the
 * surfaces' empty/defensive branch. Re-runs when `pubkey` or `limit` changes; aborts the fetch
 * on unmount, mirroring useFeed.js / useGrapevineFollows.js.
 */
export default function useUserNotes(pubkey, limit) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!pubkey) { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(`/api/user/${pubkey}/notes?limit=${limit}`, { signal: controller.signal })
      .then(r => r.json())
      .then(json => {
        if (json?.success) {
          setData(json);
          setError(null);
        } else {
          setData(null);
          setError(json?.error || json?.message || 'Failed to load notes');
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
  }, [pubkey, limit]);

  return { data, loading, error };
}
