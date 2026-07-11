import { useState, useEffect } from 'react';

/**
 * Hook: resolve a single event from the read path (`/api/event`, ADR event-page/0001).
 * Given a decoded target `{ id?, author?, relays? }`, fetch the event (by id) or the author's
 * latest kind-1 (by author). Returns { data, loading, error }.
 *
 * On a `success` body, `data` is the whole result `{ status, relaySource?, item?, kind? }` —
 * passed through unreshaped (the page reads `status`/`item`/`kind`). A non-success / transport
 * failure sets `error`. No fetch when neither id nor author is given (naddr / no-target). Aborts
 * on unmount; mirrors useUserNotes.js / useFeed.js.
 */
export default function useEventResolve({ id, author, relays } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const relayKey = (relays || []).join(',');

  useEffect(() => {
    if (!id && !author) { setLoading(false); setData(null); setError(null); return; }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setData(null);

    const qs = new URLSearchParams();
    if (id) qs.set('id', id);
    if (author) qs.set('author', author);
    if (relayKey) qs.set('relays', relayKey);

    fetch(`/api/event?${qs.toString()}`, { signal: controller.signal })
      .then(r => r.json())
      .then(json => {
        if (json?.success) { setData(json); setError(null); }
        else { setData(null); setError(json?.error || json?.message || 'Failed to load event'); }
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
  }, [id, author, relayKey]);

  return { data, loading, error };
}
