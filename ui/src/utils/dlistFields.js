/**
 * Pure helpers for reading a Decentralized List (DCoSL) header and its items —
 * dlist-item-tagging #1 (Design note in the story file).
 *
 * React-free ESM on purpose: the test suite imports it directly, and the row
 * component, the two pages, and later stories all derive cells from here rather
 * than re-reading tags in JSX.
 *
 * Header field declarations are `required` / `recommended` / `optional`
 * (`allowed` counts as optional) tags; a `["field-type", <name>, <type>]` tag
 * adds a type to an already-declared name and never invents a column.
 */
import { nip19 } from 'nostr-tools';

const HEX64 = /^[0-9a-f]{64}$/i;
const HEADER_KINDS = new Set([9998, 39998]);
const GITHUB_TYPES = new Set(['github-username', 'github-user', 'github']);
const GITHUB_HANDLE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
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
  const pubkey = parts[1];
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
      byName.set(name, { name, requirement: level, index });
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
    .map(({ name, requirement }) => ({ name, requirement, type: types.get(name) || 'text' }));
}

/** `https://github.com/<handle>` for a valid handle (leading `@` stripped), else null. */
export function githubProfileUrl(value) {
  if (typeof value !== 'string') return null;
  const handle = value.startsWith('@') ? value.slice(1) : value;
  return GITHUB_HANDLE.test(handle) ? `https://github.com/${handle}` : null;
}

function linksToGithub(decl) {
  return decl?.name === 'github-username' || GITHUB_TYPES.has(decl?.type);
}

/** One cell: first top-level `[<name>, v]` tag, count of further same-name tags, missing flag, link. */
export function fieldCellModel(item, decl) {
  const hits = tagsOf(item).filter((t) => t[0] === decl?.name && t.length > 1 && t[1] != null);
  const value = hits.length ? String(hits[0][1]) : null;
  return {
    value,
    extra: Math.max(0, hits.length - 1),
    missing: decl?.requirement === 'required' && value == null,
    href: value != null && linksToGithub(decl) ? githubProfileUrl(value) : null,
  };
}

/** Kind-7 content → +1 / -1 / 0. Same rules as the operator browser (DListItems.jsx). */
export function reactionPolarity(content) {
  const c = (content || '').trim();
  if (c === '+' || c === '👍' || c === '🤙') return 1;
  if (c === '-' || c === '👎') return -1;
  return 0;
}
