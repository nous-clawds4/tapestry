import { useState, useEffect, useCallback } from 'react';

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

export function useEventTags(eventId, viewerPubkey) {
  const [tags, setTags] = useState([]);
  const [mine, setMine] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nonce, setNonce] = useState(0);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!eventId) { setTags([]); setMine([]); return undefined; }
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const params = new URLSearchParams({ eventId });
        if (HEX64.test(viewerPubkey || '')) params.set('viewerPubkey', viewerPubkey);
        const [forEvent, avail] = await Promise.all([
          fetch(`/api/event-tags/for-event?${params}`).then((r) => r.json()).catch(() => ({})),
          fetch('/api/profile-tags/available-tags').then((r) => r.json()).catch(() => ({})),
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
      } catch (e) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [eventId, viewerPubkey, nonce]);

  return { tags, mine, availableTags, loading, error, refetch };
}

export default useEventTags;
