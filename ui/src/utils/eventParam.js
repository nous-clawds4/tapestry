import { nip19 } from 'nostr-tools';

/**
 * Pure decode/precedence/classify core for the /event page (ADR event-page/0002).
 * No React, no DOM, no network — so it is unit-testable and the page stays a thin shell.
 *
 * The page supports six identifier formats. Precedence (operator-confirmed):
 *   nevent > id > naddr > pubkey > npub > nprofile
 *
 * A `target` is one of:
 *   { mode: 'id', id, author?, relays? }          // fetch the event by id (nevent/id)
 *   { mode: 'author', author, relays? }           // fetch the author's latest kind-1 (pubkey/npub/nprofile)
 *   { mode: 'naddrUnsupported', kind }            // naddr → addressable, never kind-1 → no fetch
 */

const HEX64 = /^[0-9a-f]{64}$/i;
const ORDER = ['nevent', 'id', 'naddr', 'pubkey', 'npub', 'nprofile'];

// Decode a single (paramName, value) into a target, or null if malformed / wrong type.
function decodeOne(name, value) {
  if (typeof value !== 'string' || value.length === 0) return null;
  try {
    switch (name) {
      case 'id':
        return HEX64.test(value) ? { mode: 'id', id: value.toLowerCase() } : null;
      case 'pubkey':
        return HEX64.test(value) ? { mode: 'author', author: value.toLowerCase() } : null;
      case 'nevent': {
        const d = nip19.decode(value);
        if (d.type !== 'nevent' || !d.data || !d.data.id) return null;
        return { mode: 'id', id: d.data.id, author: d.data.author || null, relays: d.data.relays || [] };
      }
      case 'npub': {
        const d = nip19.decode(value);
        if (d.type !== 'npub' || !d.data) return null;
        return { mode: 'author', author: d.data };
      }
      case 'nprofile': {
        const d = nip19.decode(value);
        if (d.type !== 'nprofile' || !d.data || !d.data.pubkey) return null;
        return { mode: 'author', author: d.data.pubkey, relays: d.data.relays || [] };
      }
      case 'naddr': {
        const d = nip19.decode(value);
        if (d.type !== 'naddr' || !d.data || typeof d.data.kind !== 'number') return null;
        return { mode: 'naddrUnsupported', kind: d.data.kind };
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

/**
 * Resolve a URLSearchParams into { target, invalidParams }.
 *  - target: the first VALID supported param by precedence (or null).
 *  - invalidParams: every PRESENT supported param whose value failed to decode (malformed).
 *    Param names outside the six are ignored entirely (not reported).
 */
export function resolveEventParams(searchParams) {
  let target = null;
  const invalidParams = [];
  for (const name of ORDER) {
    if (!searchParams || !searchParams.has(name)) continue;
    const t = decodeOne(name, searchParams.get(name));
    if (t) { if (!target) target = t; }
    else invalidParams.push(name);
  }
  return { target, invalidParams };
}

/**
 * Classify a pasted search string into the canonical URL parameter to navigate to, or null
 * when it matches none of the six formats. Bech32 entities dispatch by prefix; a bare 64-hex
 * is treated as an event `id` (precedence id > pubkey — the param name is what disambiguates
 * the two otherwise). Returns { paramName, value } | null.
 */
export function classifyEventInput(raw) {
  const str = (raw || '').trim();
  if (!str) return null;
  const prefixes = [['nevent1', 'nevent'], ['naddr1', 'naddr'], ['nprofile1', 'nprofile'], ['npub1', 'npub']];
  for (const [prefix, name] of prefixes) {
    if (str.startsWith(prefix)) {
      return decodeOne(name, str) ? { paramName: name, value: str } : null;
    }
  }
  if (HEX64.test(str)) return { paramName: 'id', value: str.toLowerCase() };
  return null;
}
