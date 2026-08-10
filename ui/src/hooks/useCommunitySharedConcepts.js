import { useState, useEffect } from 'react';
import { fetchFromRelays } from '../utils/nostrPublish';

// The public relay searched for self-declarations. Hardcoded for now — the
// future source is the appropriate subset of the nostr-relays concept.
// (Extracted behavior-preserving from SelfDeclaredSharedConcepts.jsx — ADR
// shared-concepts-adoption/0001 — so the disposition panel's wire-external
// picker and the Community Offerings directory share one fetch.)
export const COMMUNITY_RELAYS = ['wss://dcosl.brainstorm.world'];

// Relay filters cannot express "has a b tag", so the search is bounded by
// kind and filtered client-side. Concept headers (39998) are where the
// self-declaration pattern lives; widen if it appears on other kinds.
const SELF_DECLARED_KINDS = [39998];

/** The singular name: `names` tag = ["names", singular, plural, …]. */
function singularName(ev) {
  const t = ev?.tags?.find((x) => x[0] === 'names');
  return t && typeof t[1] === 'string' && t[1].trim() !== '' ? t[1] : null;
}

/** The event's description tag value, if any. */
function descriptionOf(ev) {
  const t = ev?.tags?.find((x) => x[0] === 'description');
  return t && typeof t[1] === 'string' && t[1].trim() !== '' ? t[1] : null;
}

/**
 * Community self-declared shared concepts — events on the community relay
 * whose author offers them as shared concepts, evidenced by a b-tag pointing
 * at the event's OWN a-tag coordinate. Self-declaration by event id is
 * impossible (an event cannot know its id before signing), so only a-tag-form
 * b-tags are considered — the self-coordinate equality enforces that by
 * construction. Replaceable events dedupe newest-first per coordinate.
 *
 * Returns { rows, loadedAt } — rows null while loading.
 */
export default function useCommunitySharedConcepts() {
  const [rows, setRows] = useState(null); // null = loading
  const [loadedAt, setLoadedAt] = useState(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const events = await fetchFromRelays({ kinds: SELF_DECLARED_KINDS }, COMMUNITY_RELAYS);
      if (cancelled) return;

      // Newest per coordinate (addressable events replace by coordinate).
      const byCoord = new Map();
      for (const ev of events || []) {
        const d = ev.tags?.find((t) => t[0] === 'd')?.[1];
        if (d == null) continue;
        const coord = `${ev.kind}:${ev.pubkey}:${d}`;
        const prev = byCoord.get(coord);
        if (!prev || ev.created_at > prev.created_at) byCoord.set(coord, ev);
      }

      const out = [];
      for (const [coord, ev] of byCoord) {
        const selfDeclared = (ev.tags || []).some(
          (t) => t[0] === 'b' && typeof t[1] === 'string' && t[1].trim() === coord,
        );
        if (!selfDeclared) continue;
        out.push({
          uuid: coord,
          eventId: ev.id,
          name: singularName(ev),
          description: descriptionOf(ev),
          author: ev.pubkey,
          createdAt: ev.created_at,
        });
      }
      out.sort((a, b) => b.createdAt - a.createdAt);
      setRows(out);
      setLoadedAt(Math.floor(Date.now() / 1000));
    })();

    return () => { cancelled = true; };
  }, []);

  return { rows, loadedAt };
}
