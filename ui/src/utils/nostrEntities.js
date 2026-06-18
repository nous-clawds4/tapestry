import { nip19 } from 'nostr-tools';

/**
 * Parse NIP-21 `nostr:` URIs out of free text (e.g. a kind-1 note's content) into an
 * ordered list of render segments, so a UI can turn entity references into links the
 * way nostr clients conventionally do. Pure — no React, no DOM, no network — so it is
 * unit-testable and the rendering layer (NoteContent.jsx) stays a thin map over it.
 *
 * Recognized entities (NIP-19 / NIP-21), each prefixed with `nostr:`:
 *   - npub / nprofile → a profile mention → /user/<pubkey>
 *   - note / nevent / naddr → an event reference → /event?…
 *
 * `nsec` is deliberately NOT recognized: a private key must never be turned into a link
 * (it stays as plain text, exactly as any other unmatched token). Undecodable entities
 * (bad checksum, truncated) also fall back to plain text — never a broken link.
 *
 * @param {string} content - raw note text
 * @returns {Array<{type:'text',text:string}
 *                 | {type:'profile',pubkey:string,href:string,label:string,bech32:string}
 *                 | {type:'event',href:string,label:string,bech32:string}>}
 *          ordered segments; [] for empty/non-string input.
 */

// `nostr:` + a public NIP-19 entity (bech32). The data part uses the bech32 charset
// (excludes 1/b/i/o) so decoding is correct; a token terminated by whitespace,
// punctuation, or end-of-string — the normal case — matches cleanly. An entity glued
// directly to following bech32-charset letters with no separator over-matches and then
// fails decode → it falls back to verbatim text (a dropped link, never a broken one).
const ENTITY_RE = /nostr:((?:npub|nprofile|note|nevent|naddr)1[02-9ac-hj-np-z]+)/g;

// First-12…last-6 of a long bech32 string, so a mention/link is recognizable but compact.
function shorten(s) {
  return s.length > 20 ? `${s.slice(0, 12)}…${s.slice(-6)}` : s;
}

function entityToSegment(bech32) {
  let decoded;
  try { decoded = nip19.decode(bech32); } catch { return null; }
  if (!decoded) return null;
  const { type, data } = decoded;
  switch (type) {
    case 'npub':
      return data ? { type: 'profile', pubkey: data, href: `/user/${data}`, label: `@${shorten(bech32)}`, bech32 } : null;
    case 'nprofile':
      return data?.pubkey ? { type: 'profile', pubkey: data.pubkey, href: `/user/${data.pubkey}`, label: `@${shorten(bech32)}`, bech32 } : null;
    case 'note':
      return data ? { type: 'event', href: `/event?id=${data}`, label: shorten(bech32), bech32 } : null;
    case 'nevent':
      return data?.id ? { type: 'event', href: `/event?nevent=${bech32}`, label: shorten(bech32), bech32 } : null;
    case 'naddr':
      return data ? { type: 'event', href: `/event?naddr=${bech32}`, label: shorten(bech32), bech32 } : null;
    default:
      return null; // nsec or anything else → not linkified
  }
}

export function parseNostrContent(content) {
  if (typeof content !== 'string' || content.length === 0) return [];

  const segments = [];
  let lastIndex = 0;
  let m;
  ENTITY_RE.lastIndex = 0;
  while ((m = ENTITY_RE.exec(content)) !== null) {
    const [full, bech32] = m;
    if (m.index > lastIndex) {
      segments.push({ type: 'text', text: content.slice(lastIndex, m.index) });
    }
    const seg = entityToSegment(bech32);
    // Undecodable → keep the original "nostr:…" text verbatim (no broken link).
    segments.push(seg || { type: 'text', text: full });
    lastIndex = m.index + full.length;
  }
  if (lastIndex < content.length) {
    segments.push({ type: 'text', text: content.slice(lastIndex) });
  }
  return segments;
}
