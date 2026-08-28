/**
 * Treasure-Map (kind 10040) entry classification — ADR tl-treasure-map/0001.
 *
 * First-element grammar: "<kind>" (a generic entry — the whole kind delegated to
 * one publisher) or "<kind>:<name>" (NIP-85 kind:metric for 3038x; reserved
 * named-list override for 3039x, recognized but inert today).
 */

const HEX64 = /^[0-9a-fA-F]{64}$/;
const ENTRY = /^(\d{5})(?::(.+))?$/;

/**
 * Classify one 10040 tag into a display row.
 *
 * @param {Array} tag  raw nostr tag, e.g. ["30382:rank", <pubkey>, <relay>]
 * @returns {{raw: string, kind: number|null, name: string|null,
 *            cls: 'ta'|'tl'|'other', pubkey: string|null, relay: string|null}}
 *   `cls`: 30380–30389 → 'ta', 30390–30399 → 'tl', anything else → 'other'.
 *   A delegation entry without a valid delegate is no delegation: rows whose
 *   second element is not 64-hex classify 'other' regardless of kind (AC-6).
 *   `pubkey`: lowercased 64-hex second element, or null when absent/non-hex.
 *   Never throws on malformed input — unparseable rows come back as 'other'.
 */
export function classifyEntry(tag) {
  const t = Array.isArray(tag) ? tag : [];
  const first = typeof t[0] === 'string' ? t[0] : '';
  const m = first.match(ENTRY);
  const kind = m ? Number(m[1]) : null;
  const name = m && m[2] !== undefined ? m[2] : null;
  const pubkey = typeof t[1] === 'string' && HEX64.test(t[1]) ? t[1].toLowerCase() : null;
  const cls = pubkey === null ? 'other'
    : kind !== null && kind >= 30380 && kind <= 30389 ? 'ta'
    : kind !== null && kind >= 30390 && kind <= 30399 ? 'tl'
    : 'other';
  const relay = typeof t[2] === 'string' && t[2] !== '' ? t[2] : null;
  return { raw: first, kind, name, cls, pubkey, relay };
}

/**
 * The first generic (bare-kind) delegation entry with a valid delegate, else
 * null — ADR §4's first-occurrence rule. Named entries (`"<kind>:<name>"`) and
 * delegate-less rows are inert here (the reservation and the demotion rule).
 */
export function findGenericTlDelegation(tags, kind = 30392) {
  for (const t of (tags || [])) {
    const row = classifyEntry(t);
    if (row.kind === kind && row.name === null && row.pubkey !== null) return row;
  }
  return null;
}

/**
 * The updated unsigned Map: the first generic `kind` entry replaced in place
 * (later generic duplicates dropped — the writer normalizes to at most one,
 * ADR §3), or the new entry appended when none exists; every other tag copied
 * verbatim, in order. `created_at` is strictly greater than the old event's so
 * a skewed-clock original can never outrank the replacement (relays keep the
 * newest replaceable event).
 */
export function upsertGenericTlTag(event, kind, pubkey, relay) {
  const kindStr = String(kind);
  const entry = [kindStr, pubkey, typeof relay === 'string' ? relay : ''];
  const tags = [];
  let placed = false;
  for (const t of (event?.tags || [])) {
    if (Array.isArray(t) && t[0] === kindStr) {
      if (!placed) { tags.push(entry); placed = true; }
      continue;
    }
    tags.push(Array.isArray(t) ? [...t] : t);
  }
  if (!placed) tags.push(entry);
  return {
    kind: 10040,
    created_at: Math.max(Math.floor(Date.now() / 1000), (event?.created_at || 0) + 1),
    content: event?.content || '',
    tags,
  };
}
