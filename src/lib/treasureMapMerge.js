/**
 * Treasure Map (kind 10040) regeneration that preserves every entry the generator does not own —
 * dlist-curation #7 (the story's Design note is the design; no ADR).
 *
 * Zero-require and pure: both generators (the API handler behind the legacy customer page and the
 * CLI behind the legacy NIP-85 control panel) call these, and the suite requires this file directly.
 *
 * The rule: the generator owns exactly the `30382:*` Trust-Assertion rows. Regenerating replaces
 * those rows — as one block, where the old block began (first when there was none) — and keeps
 * every other tag byte-for-byte in its original relative order: the `30392` Trusted-Lists
 * delegation, per-DList curation entries, the assistant designation, anything another tool wrote.
 */

/** Today's eleven Trust-Assertion metrics, in today's order (both generators emitted exactly these). */
const TRUST_ASSERTION_METRICS = [
  'rank',
  'followers',
  'personalizedGrapeRank_influence',
  'personalizedGrapeRank_average',
  'personalizedGrapeRank_confidence',
  'personalizedGrapeRank_input',
  'personalizedPageRank',
  'verifiedFollowerCount',
  'verifiedMuterCount',
  'verifiedReporterCount',
  'hops',
];

const OWNED_PREFIX = '30382:';

/** The fresh rows: `["30382:<metric>", <provider pubkey>, <relay>]` × 11. */
function trustAssertionRows(providerPubkey, relay) {
  return TRUST_ASSERTION_METRICS.map((metric) => [`${OWNED_PREFIX}${metric}`, providerPubkey, relay]);
}

function isOwnedRow(tag) {
  return Array.isArray(tag) && typeof tag[0] === 'string' && tag[0].startsWith(OWNED_PREFIX);
}

/**
 * Merge: every non-owned tag of the current Map preserved (copied, in order, kept as found —
 * no validation); the old owned rows dropped; the fresh rows placed as one block where the first
 * old owned row stood, or first when the current Map had none.
 *
 * @returns {{ tags: Array, preserved: number, regenerated: number }}
 */
function mergeTreasureMapTags(existingEvent, freshRows) {
  const fresh = (Array.isArray(freshRows) ? freshRows : []).map((t) => (Array.isArray(t) ? [...t] : t));
  const existing = existingEvent && Array.isArray(existingEvent.tags) ? existingEvent.tags : [];
  const tags = [];
  let placed = false;
  let preserved = 0;
  for (const t of existing) {
    if (isOwnedRow(t)) {
      if (!placed) { tags.push(...fresh); placed = true; }
      continue;
    }
    tags.push(Array.isArray(t) ? [...t] : t);
    preserved += 1;
  }
  if (!placed) tags.unshift(...fresh);
  return { tags, preserved, regenerated: fresh.length };
}

/** Replaceable-event rule: strictly after the current Map even under clock skew. */
function restampTreasureMap(existingEvent, now) {
  const base = typeof now === 'number' ? now : Math.floor(Date.now() / 1000);
  return Math.max(base, ((existingEvent && existingEvent.created_at) || 0) + 1);
}

/**
 * The unsigned template both generators hand to the user's signer, plus what the merge did.
 * @returns {{ template: Object, preserved: number, regenerated: number }}
 */
function buildTreasureMapTemplate({ pubkey, existingEvent, freshRows, now } = {}) {
  const { tags, preserved, regenerated } = mergeTreasureMapTags(existingEvent, freshRows);
  const template = {
    kind: 10040,
    pubkey,
    created_at: restampTreasureMap(existingEvent, now),
    content: existingEvent && typeof existingEvent.content === 'string' ? existingEvent.content : '',
    tags,
  };
  return { template, preserved, regenerated };
}

module.exports = {
  TRUST_ASSERTION_METRICS,
  trustAssertionRows,
  mergeTreasureMapTags,
  restampTreasureMap,
  buildTreasureMapTemplate,
};
