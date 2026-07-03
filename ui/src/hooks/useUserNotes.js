import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook: a single user's recent kind-1 notes from the by-author read path
 * (`/api/user/:pubkey/notes?limit=`, ADR note-surfaces/0001), now PAGINATED
 * (feed-usability #2 / ADR feed-usability/0002). Consumed by the /notes page (limit 50) and
 * the profile "Content" section (limit 1 — it never calls loadMore).
 *
 * Page 1 loads the most-recent batch (no cursor). `loadMore()` fetches the next batch of
 * strictly-older notes via `&until=<oldest created_at held>`, DEDUPS by note id, APPENDS, and
 * advances the cursor; an empty page sets `exhausted`. A `liveSeqRef` + in-flight guard drop
 * stale/concurrent completions (no double-append). Re-runs page 1 when pubkey/limit changes.
 * Mirrors useFeed's accumulation machine.
 *
 * Returns { data, loading, error, loadingMore, exhausted, loadMore } where
 * `data = { status, items, relaySource }` — `status` from page 1, `items` accumulates.
 */

function oldestCreatedAt(items) {
  let min = null;
  for (const it of items) {
    if (typeof it.createdAt === 'number' && (min === null || it.createdAt < min)) min = it.createdAt;
  }
  return min;
}

export default function useUserNotes(pubkey, limit) {
  const [status, setStatus] = useState(null);
  const [items, setItems] = useState([]);
  const [relaySource, setRelaySource] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [exhausted, setExhausted] = useState(false);

  const cursorRef = useRef(null);
  const idsRef = useRef(new Set());
  const liveSeqRef = useRef(0);
  const inFlightRef = useRef(false);

  // Page 1 — the most-recent batch (no `until`). Re-runs on pubkey/limit change.
  useEffect(() => {
    if (!pubkey) { setLoading(false); return undefined; }
    const mySeq = ++liveSeqRef.current;
    const controller = new AbortController();
    setLoading(true); setError(null); setExhausted(false);
    setStatus(null); setItems([]);
    idsRef.current = new Set();
    cursorRef.current = null;
    inFlightRef.current = false;

    fetch(`/api/user/${pubkey}/notes?limit=${limit}`, { signal: controller.signal })
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
          setError(json?.error || json?.message || 'Failed to load notes');
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
  }, [pubkey, limit]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || exhausted || inFlightRef.current) return;
    if (cursorRef.current == null || !pubkey) return;
    inFlightRef.current = true;
    setLoadingMore(true);
    const mySeq = liveSeqRef.current;

    fetch(`/api/user/${pubkey}/notes?limit=${limit}&until=${cursorRef.current}`)
      .then(r => r.json())
      .then(json => {
        if (mySeq !== liveSeqRef.current) return;
        if (json?.success) {
          const incoming = json.items || [];
          const fresh = incoming.filter(it => !idsRef.current.has(it.id)); // dedup by id
          if (fresh.length === 0) {
            setExhausted(true);
          } else {
            for (const it of fresh) idsRef.current.add(it.id);
            const oldest = oldestCreatedAt(fresh);
            if (oldest != null) cursorRef.current = oldest;
            setItems(prev => [...prev, ...fresh]);  // append, newest-first preserved
          }
        } else {
          setExhausted(true);
        }
      })
      .catch(() => { /* transient — keep the button */ })
      .finally(() => {
        inFlightRef.current = false;
        if (mySeq === liveSeqRef.current) setLoadingMore(false);
      });
  }, [loading, loadingMore, exhausted, pubkey, limit]);

  const data = { status, items, relaySource };
  return { data, loading, error, loadingMore, exhausted, loadMore };
}
