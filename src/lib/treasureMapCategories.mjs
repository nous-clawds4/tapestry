/**
 * The Treasure Map's category rule: which of a kind 10040's entries give Scores, Lists and Concepts to which Assistant
 * (manage-treasure-map #2 ADR 0002, treasure-map-edit ADRs 0001–0002, treasure-map-card-details #2). Its one home since
 * assistant-trusted-content-status #1 (ADR assistant-trusted-content-status/0001 sub-decision 1), moved here unchanged
 * from ui/src/pages/treasure-map/manageTreasureMap.js, which re-exports it.
 *
 * Two consumers load it as it is: the Treasure Map page (through a relative import, bundled by Vite) and the server's
 * Scores/Lists/Concepts check (src/api/assistant/trustedContent.js, through a dynamic import()). So it must stay an ES
 * module with no imports at all and no browser or Node APIs: pure functions over a plain event object.
 * test/assistant-trusted-content.test.js R1 pins that.
 */

// ── The Assistants by category cards (manage-treasure-map #2, ADR manage-treasure-map/0002) ─────────────────────────
// The rule reads keys by the draft Treasure Maps grammar's segments since treasure-map-edit #1 (ADR treasure-map-edit/
// 0001, which supersedes ADR 0002 sub-decisions 1–2 in part): it folds each key's spellings into one. Since
// treasure-map-edit #2 (book decision 11, ADR treasure-map-edit/0002) only a bare `*` counts: a `*:…` entry that names
// anything after the `*` is ignored, and a bare `*` is hidden only by a bare family entry, or `39998`.

export const TREASURE_MAP_CATEGORIES = ['scores', 'lists', 'concepts'];
const HEX64 = /^[0-9a-f]{64}$/i;
const KIND = /^\d{5}$/;

/**
 * One Map tag as the cards read it (ADR treasure-map-edit/0001 sub-decision 1): its key, its delegate (lowercased),
 * its kind slot and the rest of the key, split at the first colon. A Concept key (`39998`, `39999`) keeps its `d` tag
 * whole; every other key also gets its `segments`, with empty ones at the end dropped. `norm` is the key it's grouped
 * and compared by: `39998:dlist-header` is `39998`, `*:` is `*`, `3038x:tag:` is `3038x:tag`. null when the tag can't
 * count: no string key, or no valid 64-hex delegate.
 */
export function entryOf(tag) {
  if (!Array.isArray(tag) || typeof tag[0] !== 'string' || typeof tag[1] !== 'string' || !HEX64.test(tag[1])) return null;
  const key = tag[0];
  const colon = key.indexOf(':');
  const slot = colon < 0 ? key : key.slice(0, colon);
  const rest = colon < 0 ? '' : key.slice(colon + 1);
  const concept = slot === '39998' || slot === '39999';
  let segments = [];
  let norm;
  if (concept) {
    norm = slot === '39998' && rest === 'dlist-header' ? '39998' : key;
  } else {
    segments = rest === '' ? [] : rest.split(':');
    while (segments.length > 0 && segments[segments.length - 1] === '') segments.pop();
    norm = [slot, ...segments].join(':');
  }
  return { key, slot, rest, concept, segments, norm, pubkey: tag[1].toLowerCase() };
}

/**
 * Does this entry apply to the category? Own kinds, the family wildcard, or everything (ADR treasure-map-edit/0002
 * sub-decision 1). A bare `*` (`*:` and `*::` too) reaches all three; a `*:…` that names anything after the `*` reaches
 * none, since the page doesn't support it for now (book decision 11).
 */
export function appliesTo(category, { slot, segments }) {
  if (KIND.test(slot)) {
    const kind = Number(slot);
    if (category === 'scores') return kind >= 30380 && kind <= 30389;
    if (category === 'lists') return kind >= 30390 && kind <= 30399;
    return kind === 39998 || kind === 39999;
  }
  if (slot === '3038x') return category === 'scores';
  if (slot === '3039x') return category === 'lists';
  return slot === '*' && segments.length === 0;
}

/**
 * Does a more specific entry cover this bare `*` completely for the category, so no insight there would reach it (ADR
 * treasure-map-edit/0002 sub-decision 2)? Only a bare `*` counts, so only it is hidden: for Scores by a bare `3038x`,
 * for Lists by a bare `3039x`, for Concepts by `39998`, each in any spelling. `norms` holds the `norm` of every entry
 * with a valid delegate.
 */
function shadowed(category, entry, norms) {
  if (entry.norm !== '*') return false;
  return norms.has(category === 'scores' ? '3038x' : category === 'lists' ? '3039x' : '39998');
}

/**
 * The entries behind each card (treasure-map-card-details #2): the card rule's one walk, keeping everything the cards
 * sum up, so a card and its details panel can't disagree. Per category, each key that counts, in the order the Map
 * first names it with a valid delegate: `key` (that tag's spelling), `norm`, and `tags`, every tag for the key with a
 * valid delegate, in Map order, as { pubkey (lowercased), relay (as written, else '') }. A key's first tag is its
 * Preferred Assistant and the rest are its backups. What counts is categoryAssistants' rule below. Never throws.
 * @returns {{ scores: Array, lists: Array, concepts: Array }}
 */
export function categoryEntries(event) {
  const tags = event && typeof event === 'object' && Array.isArray(event.tags) ? event.tags : [];
  const found = [];
  for (const tag of tags) {
    const entry = entryOf(tag);
    if (entry) found.push({ entry, relay: typeof tag[2] === 'string' ? tag[2] : '' });
  }
  const norms = new Set(found.map(({ entry }) => entry.norm));
  const out = { scores: [], lists: [], concepts: [] };
  for (const category of TREASURE_MAP_CATEGORIES) {
    const byNorm = new Map();
    for (const { entry, relay } of found) {
      if (!appliesTo(category, entry) || shadowed(category, entry, norms)) continue;
      let group = byNorm.get(entry.norm);
      if (!group) {
        group = { key: entry.key, norm: entry.norm, tags: [] };
        byNorm.set(entry.norm, group);
        out[category].push(group);
      }
      group.tags.push({ pubkey: entry.pubkey, relay });
    }
  }
  return out;
}

/**
 * Which Assistants the Map gives each category (AC-2): every Assistant it would ask for some insight there. Per key,
 * however it's spelled, the first valid delegate counts (later ones are alternates); a `*` entry that a more specific
 * entry covers completely doesn't count, and a `*:…` entry that names anything after the `*` never counts (ADR
 * treasure-map-edit/0001, 0002). Each list is in the order the Map first names its Assistants, without repeats. Never throws: no event, no tags, or garbage
 * give three empty lists.
 * @returns {{ scores: string[], lists: string[], concepts: string[] }}
 */
export function categoryAssistants(event) {
  // Each key's first delegate, from the one walk (treasure-map-card-details #2).
  const entries = categoryEntries(event);
  const out = { scores: [], lists: [], concepts: [] };
  for (const category of TREASURE_MAP_CATEGORIES) {
    for (const { tags } of entries[category]) {
      if (!out[category].includes(tags[0].pubkey)) out[category].push(tags[0].pubkey);
    }
  }
  return out;
}
