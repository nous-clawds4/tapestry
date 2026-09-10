/**
 * Pure helpers for reading a Decentralized List (DCoSL) header and its items —
 * dlist-item-tagging #1 (Design note in the story file).
 *
 * React-free ESM on purpose: the test suite imports it directly, and the row
 * component, the two pages, and later stories all derive cells from here rather
 * than re-reading tags in JSX.
 *
 * Header field declarations are `required` / `recommended` / `optional`
 * (`allowed` counts as optional) tags, with an optional third element as the
 * field description (NIP line 35); a `["field-type", <name>, <type>]` tag adds
 * a type to an already-declared name and never invents a column. Rendering is
 * driven by the type alone: `url` links when the value is an http(s) URL,
 * everything else (`text`, unknown, absent) is text. Semantic types belong in
 * the concept graph (epic candidate 6), not here.
 */
import { nip19 } from 'nostr-tools';

const HEX64 = /^[0-9a-f]{64}$/i;
const HEADER_KINDS = new Set([9998, 39998]);
const LEVEL_RANK = { required: 0, recommended: 1, optional: 2 };
const LEVEL_OF_TAG = { required: 'required', recommended: 'recommended', optional: 'optional', allowed: 'optional' };

function tagsOf(ev) {
  return Array.isArray(ev?.tags) ? ev.tags.filter(Array.isArray) : [];
}

function tagValue(ev, name) {
  const t = tagsOf(ev).find((x) => x[0] === name);
  return t && t.length > 1 && t[1] != null ? String(t[1]) : null;
}

function coordRef(kind, pubkey, d) {
  return { kind, pubkey, d, coord: `${kind}:${pubkey}:${d}` };
}

/** `39998:<pk>:<d>` / `9998:<pk>:<d>` / `naddr1…` → {kind,pubkey,d,coord}; 64-hex → {id}; else null. */
export function parseListRef(param) {
  if (typeof param !== 'string') return null;
  const s = param.trim();
  if (!s) return null;
  if (HEX64.test(s)) return { id: s.toLowerCase() };
  if (s.startsWith('naddr1')) {
    try {
      const { type, data } = nip19.decode(s);
      if (type !== 'naddr' || !HEADER_KINDS.has(data.kind)) return null;
      return coordRef(data.kind, data.pubkey, data.identifier);
    } catch {
      return null;
    }
  }
  const parts = s.split(':');
  if (parts.length < 3) return null;
  const kind = Number(parts[0]);
  if (!HEADER_KINDS.has(kind)) return null;
  // Pubkeys are lowercase hex on the wire; HEX64 accepts either case so a pasted
  // uppercase coordinate still resolves, but normalize before it becomes an address
  // (the server's isACoord and strfry authors: are lowercase-only).
  const pubkey = (parts[1] || '').toLowerCase();
  if (!HEX64.test(pubkey)) return null;
  return coordRef(kind, pubkey, parts.slice(2).join(':')); // d may contain colons
}

/** The value items carry in their `z` tag (39998) or `e` tag (9998) to belong to this header. */
export function headerCoord(header) {
  if (header?.kind === 39998 && header.pubkey) {
    return `${header.kind}:${header.pubkey}:${tagValue(header, 'd') ?? ''}`;
  }
  return typeof header?.id === 'string' ? header.id : null;
}

/** `names` → singular/plural (plural falls back to singular); no `names` → `name` → `d`. */
export function headerNames(header) {
  const names = tagsOf(header).find((t) => t[0] === 'names');
  const singular = (names && names[1]) || tagValue(header, 'name') || tagValue(header, 'd') || '';
  const plural = (names && names[2]) || singular;
  return { singular, plural, description: tagValue(header, 'description') };
}

/** Ordered field declarations: required → recommended → optional, header order within a group. */
export function parseFieldDecls(header) {
  const byName = new Map();
  tagsOf(header).forEach((t, index) => {
    const level = LEVEL_OF_TAG[t[0]];
    const name = t[1];
    if (!level || typeof name !== 'string' || !name) return;
    const prev = byName.get(name);
    if (!prev || LEVEL_RANK[level] < LEVEL_RANK[prev.requirement]) {
      const description = typeof t[2] === 'string' && t[2] ? t[2] : null;
      byName.set(name, { name, requirement: level, description, index });
    }
  });
  const types = new Map();
  for (const t of tagsOf(header)) {
    if (t[0] === 'field-type' && typeof t[1] === 'string' && typeof t[2] === 'string' && !types.has(t[1])) {
      types.set(t[1], t[2]);
    }
  }
  return [...byName.values()]
    .sort((a, b) => LEVEL_RANK[a.requirement] - LEVEL_RANK[b.requirement] || a.index - b.index)
    .map(({ name, requirement, description }) => ({ name, requirement, description, type: types.get(name) || 'text' }));
}

/** The trimmed value when it parses as an http(s) URL, else null. */
export function httpUrl(value) {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (!s) return null;
  try {
    const { protocol } = new URL(s);
    return protocol === 'http:' || protocol === 'https:' ? s : null;
  } catch {
    return null;
  }
}

/** One cell: first top-level `[<name>, v]` tag, count of further same-name tags, missing flag, link. */
export function fieldCellModel(item, decl) {
  const hits = tagsOf(item).filter((t) => t[0] === decl?.name && t.length > 1 && t[1] != null);
  const value = hits.length ? String(hits[0][1]) : null;
  return {
    value,
    extra: Math.max(0, hits.length - 1),
    missing: decl?.requirement === 'required' && value == null,
    href: value != null && decl?.type === 'url' ? httpUrl(value) : null,
  };
}

/** Item tags the header did not declare — `[{ name, value }]` in tag order; 1-char tags and empty values skipped. */
export function undeclaredFields(item, fieldDecls) {
  const declared = new Set((fieldDecls || []).map((d) => d?.name));
  return tagsOf(item)
    .filter((t) => typeof t[0] === 'string' && t[0].length > 1 && !declared.has(t[0])
      && t.length > 1 && t[1] != null && String(t[1]) !== '')
    .map((t) => ({ name: t[0], value: String(t[1]) }));
}

/** Case-insensitive substring match over singular, plural and description; a blank query matches everything. */
export function matchesListQuery(header, query) {
  const q = typeof query === 'string' ? query.trim().toLowerCase() : '';
  if (!q) return true;
  const { singular, plural, description } = headerNames(header);
  return [singular, plural, description].some((s) => typeof s === 'string' && s.toLowerCase().includes(q));
}

/** Kind-7 content → +1 / -1 / 0. Same rules as the operator browser (DListItems.jsx). */
export function reactionPolarity(content) {
  const c = (content || '').trim();
  if (c === '+' || c === '👍' || c === '🤙') return 1;
  if (c === '-' || c === '👎') return -1;
  return 0;
}

/** `39999:<pubkey>:<d>` for a kind-39999 item with a `d` tag; null otherwise (kind-9999 items are non-addressable). */
export function itemCoord(item) {
  if (item?.kind !== 39999 || typeof item.pubkey !== 'string') return null;
  const d = tagValue(item, 'd');
  return d ? `${item.kind}:${item.pubkey}:${d}` : null;
}

/** The event-tagging target for an item: `{ address }` when addressable, else `{ id }` (dlist-item-tagging #3). */
export function itemTarget(item) {
  const address = itemCoord(item);
  return address ? { address } : { id: item?.id };
}

/** `39999:<64hex>:<d>` / `naddr1…` of kind 39999 → {kind,pubkey,d,address}; anything else (headers, notes, npubs) → null. */
export function parseItemRef(input) {
  if (typeof input !== 'string') return null;
  const s = input.trim();
  if (!s) return null;
  if (s.startsWith('naddr1')) {
    try {
      const { type, data } = nip19.decode(s);
      if (type !== 'naddr' || data.kind !== 39999 || !HEX64.test(data.pubkey || '')) return null;
      return { kind: 39999, pubkey: data.pubkey, d: data.identifier, address: `39999:${data.pubkey}:${data.identifier}` };
    } catch {
      return null;
    }
  }
  const parts = s.split(':');
  if (parts.length < 3 || Number(parts[0]) !== 39999) return null;
  // Pubkeys are lowercase hex on the wire; HEX64 accepts either case so a pasted uppercase
  // coordinate still resolves, but normalize before it becomes an address (the server's
  // isACoord and strfry authors: are lowercase-only).
  const pubkey = (parts[1] || '').toLowerCase();
  if (!HEX64.test(pubkey)) return null;
  const d = parts.slice(2).join(':'); // d may contain colons
  return { kind: 39999, pubkey, d, address: `39999:${pubkey}:${d}` };
}
