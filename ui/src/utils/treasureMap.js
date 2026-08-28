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
 *   `pubkey`: lowercased 64-hex second element, or null when absent/non-hex.
 *   Never throws on malformed input — unparseable rows come back as 'other'.
 */
export function classifyEntry(tag) {
  const t = Array.isArray(tag) ? tag : [];
  const first = typeof t[0] === 'string' ? t[0] : '';
  const m = first.match(ENTRY);
  const kind = m ? Number(m[1]) : null;
  const name = m && m[2] !== undefined ? m[2] : null;
  const cls = kind !== null && kind >= 30380 && kind <= 30389 ? 'ta'
    : kind !== null && kind >= 30390 && kind <= 30399 ? 'tl'
    : 'other';
  const pubkey = typeof t[1] === 'string' && HEX64.test(t[1]) ? t[1].toLowerCase() : null;
  const relay = typeof t[2] === 'string' && t[2] !== '' ? t[2] : null;
  return { raw: first, kind, name, cls, pubkey, relay };
}
