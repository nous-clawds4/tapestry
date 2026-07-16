import { useState, useEffect } from 'react';

/**
 * Hook: the profile "Content" card selection from the pinned-note-aware read path
 * (`/api/user/:pubkey/content`, ADR feed-usability/0003). Returns { data, loading, error }.
 *
 * One-shot (the card shows ONE note — there is nothing to paginate), deliberately NOT the
 * paginating by-author notes hook. The read path returns `{ success: true, ...result }` where
 * `result` is `{ status, pinned?, item?, relaySource? }` (status ∈ {OK, NO_TOPLEVEL, EMPTY,
 * INVALID}). On a `success` body we pass the WHOLE result through as `data`; the section reads
 * `status`/`pinned`/`item`. A non-success / non-2xx / thrown / malformed response sets `error`.
 * Re-runs on `pubkey` change; aborts the fetch on unmount (the one-shot fetch-hook pattern).
 */
export default function useProfileContent(pubkey) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!pubkey) { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setData(null); // clear the prior user's result on pubkey change so the loading line shows

    fetch(`/api/user/${pubkey}/content`, { signal: controller.signal })
      .then(r => r.json())
      .then(json => {
        if (json?.success) {
          setData(json);
          setError(null);
        } else {
          setData(null);
          setError(json?.error || json?.message || 'Failed to load content');
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
