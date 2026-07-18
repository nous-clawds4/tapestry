import { useState, useEffect, useCallback } from 'react';
import { usePov } from '../context/PovContext';

/**
 * Story 6 — read a kind-1 note's event-tags for display.
 *
 * Composes the Story-4 read (`/api/event-tags/for-event`, POV-filtered) with the
 * shared tag catalogue (`/api/profile-tags/available-tags`) — `for-event` returns
 * counted tags only as `{authorPubkey, slug}`, so display names + the tag-element
 * eventId are joined from available-tags on the `(authorPubkey, slug)` coordinate.
 *
 * Two channels (see ADR event-tagging/0006 + 0007):
 *   - `tags` — the POV-counted community set (applications/disputes per tag).
 *   - `mine` — the VIEWER's own stance, durable + trust-unfiltered (Story 7), so a
 *     just-applied tag survives reload even when the POV doesn't count the viewer.
 *
 * Read-only: no publish path here (writes go through useEventTagging, Story 5).
 */
const HEX64 = /^[0-9a-f]{64}$/;

// Shared, TTL-cached available-tags fetch. Every NoteCard's NoteTags needs the same
// tag catalogue (for names + search); without sharing, a list of N notes fires N
// identical requests. Cached as a single promise within a short window (so a note
// list = 1 request) that refreshes after the TTL (so a newly-created tag appears
// within ~a minute, not only on reload).
const AVAIL_TAGS_TTL_MS = 60000;
let _availTags = { promise: null, at: 0 };
function fetchAvailableTags() {
  const now = Date.now();
  if (!_availTags.promise || now - _availTags.at > AVAIL_TAGS_TTL_MS) {
    _availTags = {
      at: now,
      promise: fetch('/api/profile-tags/available-tags').then((r) => r.json()).catch(() => ({})),
    };
  }
  return _availTags.promise;
}

export function useEventTags(eventId, viewerPubkey) {
  const { povParams } = usePov();
  const [tags, setTags] = useState([]);
  const [mine, setMine] = useState([]);
  // The as-signed bytes behind the channels — { [eventId]: 7-field projection }
  // (tag-event-inspector ADR 0003 D2). Consumers join entry.eventId → bytes.
  const [rawEvents, setRawEvents] = useState({});
  const [availableTags, setAvailableTags] = useState([]);
  const [povResolution, setPovResolution] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nonce, setNonce] = useState(0);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!eventId) { setTags([]); setMine([]); setRawEvents({}); return undefined; }
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const params = new URLSearchParams({ eventId });
        // Selected-POV read params (ADR pov-selectable-tag-surfaces/0001).
        Object.entries(povParams).forEach(([k, v]) => params.set(k, v));
        // viewerPubkey drives the durable, trust-unfiltered `mine` channel.
        if (HEX64.test(viewerPubkey || '')) params.set('viewerPubkey', viewerPubkey);
        const [forEvent, avail] = await Promise.all([
          fetch(`/api/event-tags/for-event?${params}`).then((r) => r.json()).catch(() => ({})),
          fetchAvailableTags(), // shared/cached across all note cards (not re-fetched per note)
        ]);
        if (cancelled) return;

        const list = Array.isArray(avail.tags) ? avail.tags : [];
        const byCoord = new Map();
        for (const a of list) byCoord.set(`${a.authorPubkey}:${a.slug}`, a);
        const enrich = (authorPubkey, slug) => {
          const meta = byCoord.get(`${authorPubkey}:${slug}`) || {};
          return {
            eventId: meta.eventId || `${authorPubkey}:${slug}`,
            authorPubkey,
            slug,
            name: meta.name || slug,
            description: meta.description || '',
          };
        };

        const counted = (forEvent.tags || []).map((t) => ({
          ...enrich(t.tag.authorPubkey, t.tag.slug),
          applications: t.applications || [],
          disputes: t.disputes || [],
        }));
        const mineEnriched = (forEvent.mine || []).map((m) => ({
          ...enrich(m.tag.authorPubkey, m.tag.slug),
          stance: m.stance,
          mineEventId: m.eventId,
          createdAt: m.createdAt,
        }));

        setAvailableTags(list);
        setTags(counted);
        setMine(mineEnriched);
        setRawEvents(forEvent.rawEvents || {});
        setPovResolution(forEvent.povResolution || null);
      } catch (e) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [eventId, viewerPubkey, nonce, povParams.wotPov, povParams.userPubkey]);

  return { tags, mine, rawEvents, availableTags, povResolution, loading, error, refetch };
}

export default useEventTags;
