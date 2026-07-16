import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook: the Live Feed read-path output from `/api/feed` (ADR live-feed/0001), now
 * PAGINATED (feed-usability #2 / ADR feed-usability/0002).
 *
 * Page 1 loads the most-recent batch (no cursor). `loadMore()` fetches the next batch of
 * strictly-older notes via an `until=<oldest created_at held>` relay cursor, DEDUPS by note
 * id (the boundary note reappears at created_at===until), APPENDS them, and advances the
 * cursor. A page that yields no new notes sets `exhausted` (best-effort end of history). A
 * `liveSeqRef` + an in-flight guard drop stale/concurrent completions so repeated activation
 * never double-appends. Mirrors useTagIndex's accumulation machine, cursor-based (relays
 * paginate by `until`, not offset).
 *
 * Returns { data, loading, error, loadingMore, exhausted, loadMore } where
 * `data = { status, items, relaySource }` — `status` from page 1, `items` accumulates. The
 * source identity is resolved server-side (no PoV picker), so the hook takes no arguments.
 */

// The oldest created_at in a batch (the next page's `until` cursor). null for an empty batch.
function oldestCreatedAt(items) {
  let min = null;
  for (const it of items) {
    if (typeof it.createdAt === 'number' && (min === null || it.createdAt < min)) min = it.createdAt;
  }
  return min;
}

export default function useFeed() {
  const [status, setStatus] = useState(null);
  const [items, setItems] = useState([]);
  const [relaySource, setRelaySource] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [exhausted, setExhausted] = useState(false);

  // Cursor + dedup set live in refs so loadMore reads the latest without re-subscribing.
  const cursorRef = useRef(null);
  const idsRef = useRef(new Set());
  const liveSeqRef = useRef(0);      // page-1 reloads bump this; stale completions bail
  const inFlightRef = useRef(false); // a load-more is in progress

  // Page 1 — the most-recent batch (no `until`).
  useEffect(() => {
    const mySeq = ++liveSeqRef.current;
    const controller = new AbortController();
    setLoading(true); setError(null); setExhausted(false);
    setStatus(null); setItems([]);
    idsRef.current = new Set();
    cursorRef.current = null;
    inFlightRef.current = false;

    fetch('/api/feed', { signal: controller.signal })
      .then(r => r.json())
      .then(json => {
        if (mySeq !== liveSeqRef.current) return;
        if (json?.success) {
          const incoming = json.items || [];
          idsRef.current = new Set(incoming.map(it => it.id));
          cursorRef.current = oldestCreatedAt(incoming);
          setStatus(json.status);
          setRelaySource(json.relaySource || null);
          setItems(incoming);
          setError(null);
        } else {
          setStatus(null); setItems([]);
          setError(json?.error || json?.message || 'Failed to load feed');
        }
      })
      .catch(err => {
        if (err.name === 'AbortError' || mySeq !== liveSeqRef.current) return;
        setError(err.message || 'Fetch failed'); setStatus(null); setItems([]);
      })
      .finally(() => {
        if (mySeq === liveSeqRef.current && !controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  const loadMore = useCallback(() => {
    // Guard: initial load, an in-flight page, or exhaustion → no-op (no double-append).
    if (loading || loadingMore || exhausted || inFlightRef.current) return;
    if (cursorRef.current == null) return;
    inFlightRef.current = true;
    setLoadingMore(true);
    const mySeq = liveSeqRef.current;

    fetch(`/api/feed?until=${cursorRef.current}`)
      .then(r => r.json())
      .then(json => {
        if (mySeq !== liveSeqRef.current) return; // a page-1 reload superseded this cursor
        if (json?.success) {
          const incoming = json.items || [];
          const fresh = incoming.filter(it => !idsRef.current.has(it.id)); // dedup by id
          if (fresh.length === 0) {
            setExhausted(true);                    // no older notes ⇒ end of history
          } else {
            for (const it of fresh) idsRef.current.add(it.id);
            const oldest = oldestCreatedAt(fresh);
            if (oldest != null) cursorRef.current = oldest;
            setItems(prev => [...prev, ...fresh]); // append, newest-first order preserved
          }
        } else {
          setExhausted(true);                      // failed page ⇒ treat as end (best-effort)
        }
      })
      .catch(() => { /* transient — keep the button, let the reader retry */ })
      .finally(() => {
        inFlightRef.current = false;
        if (mySeq === liveSeqRef.current) setLoadingMore(false);
      });
  }, [loading, loadingMore, exhausted]);

  // `data` is null until page 1 resolves (status set), so the page's `loading && !data`
  // gate shows the loading line rather than falling through to the empty state.
  const data = status == null ? null : { status, items, relaySource };
  return { data, loading, error, loadingMore, exhausted, loadMore };
}
