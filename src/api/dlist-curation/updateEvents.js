'use strict';

/**
 * curated-dlist-update #6 — the events Update list signs, and the request it takes (ADR
 * engineering-team/decisions/curated-dlist-update/0006-update-publishes.md §1 and §3; the copy convention, ADR 0001
 * §1–§6).
 *
 * Pure: each event is a function of events the server read, never of the request's body, and nothing here reads a
 * relay, runs strfry or loads the nostr library. The handler (./update.js) signs what these compose.
 */

const crypto = require('crypto');
const { SENTINEL, classifyBValue } = require('../../lib/bValueForms');

const ITEM_KIND = 39999;
const HEADER_KIND = 39998;
const DELETION_KIND = 5;
const CONTRACT_TYPE = 'pointer';
/** At most this many intents in one call (ADR 0006 §1, §6); the upgrade counts as one. */
const MAX_INTENTS = 50;
/** What a copy carries from its original, verbatim and in the original's order (ADR 0001 §3). */
const CARRIED_TAGS = new Set(['name', 'title', 'slug', 'description', 'comments', 'p', 'e', 't', 'a']);
const HEX64 = /^[0-9a-f]{64}$/;
// Unicode's control characters (Cc), code points 0x00–0x1F and 0x7F–0x9F: a d-tag carries none (ADR 0006 §1).
const isControl = (ch) => {
  const c = ch.codePointAt(0);
  return c <= 0x1f || (c >= 0x7f && c <= 0x9f);
};

function tagValue(event, name) {
  const t = (event && Array.isArray(event.tags) ? event.tags : []).find((x) => Array.isArray(x) && x[0] === name);
  return t ? t[1] : undefined;
}

/** A clock read as a number, whether it is given as one or as a function. */
function readClock(now) {
  return Number(typeof now === 'function' ? now() : now);
}

/**
 * An item's reference (ADR 0001 §4), as Simple Lists and the planner route it: `39999:<author>:<d>` for an addressable
 * kind-39999 item, its event id otherwise.
 */
function itemRef(event) {
  const d = tagValue(event, 'd');
  if (event && event.kind === ITEM_KIND && typeof d === 'string' && d !== '') return `${ITEM_KIND}:${event.pubkey}:${d}`;
  return event ? event.id : undefined;
}

/** A copy's d-tag (ADR 0001 §4): "copy-" and the SHA-256 of "<my header's address>\n<the original's reference>". */
function copyD(headerAddress, originalRef) {
  return `copy-${crypto.createHash('sha256').update(`${headerAddress}\n${originalRef}`, 'utf8').digest('hex')}`;
}

/**
 * A copy of `original`, or its refresh when `existing` is the copy it replaces (ADR 0001 §2–§5; ADR 0006 §3). Kind
 * 39999, with exactly: its d; one z, my header's address; the address q for a kind-39999 original; the version q, which
 * names the author; then the carried tags. The content is the original's. created_at is `now`, and for a refresh
 * max(now, the copy's + 1).
 */
function composeCopy({ original, headerAddress, relay = '', now, existing } = {}) {
  const ref = itemRef(original);
  const tags = [['d', copyD(headerAddress, ref)], ['z', headerAddress]];
  if (ref !== original.id) tags.push(['q', ref, relay]);
  tags.push(['q', original.id, relay, original.pubkey]);
  for (const t of Array.isArray(original.tags) ? original.tags : []) {
    if (Array.isArray(t) && CARRIED_TAGS.has(t[0])) tags.push([...t]);
  }
  const at = readClock(now);
  return {
    kind: ITEM_KIND,
    created_at: existing ? Math.max(at, (Number(existing.created_at) || 0) + 1) : at,
    tags,
    content: typeof original.content === 'string' ? original.content : '',
  };
}

/**
 * My assistant's deletion request for one of its copies (ADR 0001 §6; ADR 0006 §3). Kind 5 with one `a`, my
 * assistant's address for the copy and never anyone else's; an `e` for every version of the copy given (its `id`, its
 * `ids`, its `versions`); and `k` 39999. No reason; created_at is `now`. An item another key authored is refused.
 */
function composeDeletion({ copy, assistant, now } = {}) {
  if (!copy || typeof copy !== 'object') throw new Error('composeDeletion: no copy given');
  if (typeof copy.pubkey === 'string' && copy.pubkey !== assistant) throw new Error("composeDeletion: that item isn't the assistant's");
  const d = typeof copy.d === 'string' ? copy.d : tagValue(copy, 'd');
  if (typeof d !== 'string' || d === '') throw new Error('composeDeletion: the copy has no d-tag');
  const ids = [];
  const add = (id) => { if (typeof id === 'string' && HEX64.test(id) && !ids.includes(id)) ids.push(id); };
  add(copy.id);
  (Array.isArray(copy.ids) ? copy.ids : []).forEach(add);
  for (const v of Array.isArray(copy.versions) ? copy.versions : []) {
    if (v && (typeof v.pubkey !== 'string' || v.pubkey === assistant)) add(v.id);
  }
  return {
    kind: DELETION_KIND,
    created_at: readClock(now),
    tags: [['a', `${ITEM_KIND}:${assistant}:${d}`], ...ids.map((id) => ['e', id]), ['k', String(ITEM_KIND)]],
    content: '',
  };
}

/**
 * My header republished in place (ADR 0001 §1; ADR 0006 §3). Its real link, the `b` naming a list coordinate, becomes
 * ["b", <the same target>, "pointer"]. The "deliberately unaffiliated" marker beside it goes (Planning decision 2). Every
 * other tag and the content are kept. created_at is max(now, old + 1).
 */
function composeUpgrade({ header, now } = {}) {
  const tags = [];
  for (const t of header && Array.isArray(header.tags) ? header.tags : []) {
    if (!Array.isArray(t)) continue;
    if (t[0] === 'b' && t[1] === SENTINEL) continue;
    tags.push(t[0] === 'b' && classifyBValue(t[1]) === 'a-tag' ? ['b', t[1], CONTRACT_TYPE] : [...t]);
  }
  return {
    kind: HEADER_KIND,
    created_at: Math.max(readClock(now), (Number(header && header.created_at) || 0) + 1),
    tags,
    content: header && typeof header.content === 'string' ? header.content : '',
  };
}

/** A d-tag: 1–256 characters, none of them a control character (ADR 0006 §1). */
function validD(d) {
  const chars = Array.from(d);
  return chars.length >= 1 && chars.length <= 256 && !chars.some(isControl);
}

/** `<kind>:<64-hex pubkey>:<d-tag>` of exactly `kind`, split at the first two colons → `{ kind, pubkey, d }`, or null. */
function parseCoordinate(value, kind) {
  if (typeof value !== 'string') return null;
  const i = value.indexOf(':');
  const j = i < 0 ? -1 : value.indexOf(':', i + 1);
  if (j < 0 || value.slice(0, i) !== String(kind)) return null;
  const pubkey = value.slice(i + 1, j);
  const d = value.slice(j + 1);
  return HEX64.test(pubkey) && validD(d) ? { kind, pubkey, d } : null;
}

const isId = (v) => typeof v === 'string' && HEX64.test(v);
// An original is named by its kind-39999 address, or by its event id (ADR 0006 §1).
const isOriginalRef = (v) => isId(v) || parseCoordinate(v, ITEM_KIND) !== null;

/**
 * Update's request (ADR 0006 §1): `{ list, copy, refresh, delete, upgrade }`, references and version pins only. Answers
 * `{ ok: true, body }`, holding only the validated fields, or `{ ok: false, status, error }`. The status is 400 for a
 * malformed body, and 413 for more than 50 intents; a 413 answer also carries the validated `body`, so the caller can
 * check the list's owner first.
 */
function validateUpdateBody(input) {
  const refuse = (error) => ({ ok: false, status: 400, error });
  if (!input || typeof input !== 'object' || Array.isArray(input)) return refuse('the request body must be an object');
  const list = parseCoordinate(input.list, HEADER_KIND);
  if (!list) return refuse('list must be a kind-39998 coordinate: 39998:<64-hex pubkey>:<a d-tag of 1–256 characters, no control characters>');
  const groups = {};
  for (const name of ['copy', 'refresh', 'delete']) {
    const v = input[name] === undefined || input[name] === null ? [] : input[name];
    if (!Array.isArray(v)) return refuse(`${name} must be a list`);
    groups[name] = v;
  }
  const body = { list: { ...list, coord: input.list }, copy: [], refresh: [], delete: [], upgrade: null };
  for (const x of groups.copy) {
    if (!x || typeof x !== 'object' || !isOriginalRef(x.original) || !isId(x.version)) {
      return refuse("each copy is { original, version }: the original's kind-39999 address or id, and a version id");
    }
    body.copy.push({ original: x.original, version: x.version });
  }
  for (const x of groups.refresh) {
    if (!x || typeof x !== 'object' || !parseCoordinate(x.copy, ITEM_KIND) || !isOriginalRef(x.original) || !isId(x.version)) {
      return refuse("each refresh is { copy, original, version }: the copy's address, the original's address or id, and a version id");
    }
    body.refresh.push({ copy: x.copy, original: x.original, version: x.version });
  }
  for (const x of groups.delete) {
    if (!x || typeof x !== 'object' || !parseCoordinate(x.copy, ITEM_KIND) || !isId(x.id)) {
      return refuse("each delete is { copy, id }: the copy's address and its current id");
    }
    body.delete.push({ copy: x.copy, id: x.id });
  }
  if (input.upgrade !== undefined && input.upgrade !== null) {
    const u = input.upgrade;
    if (typeof u !== 'object' || Array.isArray(u) || typeof u.dropsMarker !== 'boolean') return refuse('upgrade is { dropsMarker } or null');
    body.upgrade = { dropsMarker: u.dropsMarker };
  }
  const count = body.copy.length + body.refresh.length + body.delete.length + (body.upgrade ? 1 : 0);
  if (count > MAX_INTENTS) return { ok: false, status: 413, error: `at most ${MAX_INTENTS} intents per call; this one has ${count}`, body };
  return { ok: true, body };
}

module.exports = {
  copyD,
  composeCopy,
  composeDeletion,
  composeUpgrade,
  validateUpdateBody,
  itemRef,
  parseCoordinate,
  tagValue,
  MAX_INTENTS,
};
