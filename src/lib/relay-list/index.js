'use strict';
/**
 * Relay lists — NIP-65 kind 10002, as the Outbox Relays action reads, edits and builds them (assistant-outbox-relays
 * ADRs 0001–0003).
 *
 * A relay list is a replaceable event of `r` tags, each a relay address with an optional marker: `write`, `read`, or
 * none, which means both. An OUTBOX relay is one with no marker or `write`; an INBOX-ONLY relay is one marked `read`.
 *
 * Pure, dependency-free CommonJS, on purpose: the server checks and publishes from it (the outbox check and the
 * relay-list publish route, both under src/api/assistant/), the UI imports it through the Vite alias @tapestry/relay-list (the page's
 * draft rules), and the Node runner loads it as it is. It uses only the global URL.
 *
 * Every rule compares relays by their one spelling, normalizeRelayUrl(): two addresses that differ only in the host's
 * letter case, a default port or one trailing slash are the same relay. The draft and the published list always hold
 * that spelling, so what the page shows is what the Assistant publishes.
 */

/** The most relays one list here may hold: the page's draft, the publish request (story 3 AC-2). */
const MAX_RELAYS = 50;

/** The most `r` tags read from one event; the rest are ignored (ADR 0001 sub-decision 1). */
const MAX_PARSED_R_TAGS = 100;

/** The longest relay address accepted. */
const MAX_URL_LENGTH = 512;

/**
 * A relay address in its one spelling, or null when it is not a relay address: ws:// or wss:// with a host, no
 * credentials, no hash, at most 512 characters. Spaces around it are trimmed; URL lower-cases the scheme and the host
 * and drops a default port; one trailing slash is removed.
 * @param {*} input
 * @returns {?string}
 */
function normalizeRelayUrl(input) {
  if (typeof input !== 'string') return null;
  const s = input.trim();
  if (!s || s.length > MAX_URL_LENGTH) return null;
  let url;
  try { url = new URL(s); } catch { return null; }
  if (url.protocol !== 'ws:' && url.protocol !== 'wss:') return null;
  if (!url.hostname || url.username || url.password || url.hash || s.includes('#')) return null;
  const href = url.href.endsWith('/') ? url.href.slice(0, -1) : url.href;
  return href.length > MAX_URL_LENGTH ? null : href;
}

/**
 * A relay list's entries, outbox relays and inbox-only relays. Reads at most the first 100 `r` tags; ignores a value
 * that does not normalize; a marker other than `read` or `write` is none. A relay named twice is one entry, in its first
 * position; when its markers disagree it is both (none).
 * @param {?{tags?: Array}} event
 * @returns {{ entries: Array<{url: string, marker: ?('read'|'write')}>, outbox: string[], inboxOnly: string[] }}
 */
function parseRelayList(event) {
  const tags = event && Array.isArray(event.tags) ? event.tags : [];
  const rTags = tags.filter((t) => Array.isArray(t) && t[0] === 'r').slice(0, MAX_PARSED_R_TAGS);
  const entries = [];
  const byUrl = new Map();
  for (const t of rTags) {
    const url = normalizeRelayUrl(t[1]);
    if (!url) continue;
    const marker = t[2] === 'read' || t[2] === 'write' ? t[2] : null;
    const seen = byUrl.get(url);
    if (seen) {
      if (seen.marker !== marker) seen.marker = null;
      continue;
    }
    const entry = { url, marker };
    byUrl.set(url, entry);
    entries.push(entry);
  }
  return {
    entries,
    outbox: entries.filter((e) => e.marker !== 'read').map((e) => e.url),
    inboxOnly: entries.filter((e) => e.marker === 'read').map((e) => e.url),
  };
}

// ─── The page's draft (ADR 0002 sub-decision 2) ────────────────────────────────────────────────────────────────────

const keysOf = (list) => new Set((Array.isArray(list) ? list : []).map(normalizeRelayUrl).filter(Boolean));

/**
 * Add one relay to the end of a draft. The draft given is not changed.
 * @returns {{ draft: string[], error: null | 'not-a-relay' | 'already-listed' | 'too-many' }}
 */
function addRelay(draft, input) {
  const list = Array.isArray(draft) ? draft.slice() : [];
  const url = normalizeRelayUrl(input);
  if (!url) return { draft: list, error: 'not-a-relay' };
  if (keysOf(list).has(url)) return { draft: list, error: 'already-listed' };
  if (list.length >= MAX_RELAYS) return { draft: list, error: 'too-many' };
  list.push(url);
  return { draft: list, error: null };
}

/** The draft without one relay, by its one spelling. */
function removeRelay(draft, url) {
  const key = normalizeRelayUrl(url);
  return (Array.isArray(draft) ? draft : []).filter((r) => normalizeRelayUrl(r) !== key);
}

/** The suggestions not already in the draft, in the suggestions' order. */
function visibleSuggestions(suggestions, draft) {
  const listed = keysOf(draft);
  return (Array.isArray(suggestions) ? suggestions : []).filter((s) => !listed.has(normalizeRelayUrl(s)));
}

/** The draft with every visible suggestion appended, in order, stopping at MAX_RELAYS. */
function addAll(draft, suggestions) {
  let list = Array.isArray(draft) ? draft.slice() : [];
  for (const s of visibleSuggestions(suggestions, list)) {
    const next = addRelay(list, s);
    if (next.error === 'too-many') break;
    list = next.draft;
  }
  return list;
}

/** Same length and the same relay at each position, by their one spelling. */
function sameRelayList(a, b) {
  const x = Array.isArray(a) ? a : [];
  const y = Array.isArray(b) ? b : [];
  return x.length === y.length && x.every((r, i) => normalizeRelayUrl(r) === normalizeRelayUrl(y[i]));
}

// ─── The publish (ADR 0003 sub-decisions 1–2) ──────────────────────────────────────────────────────────────────────

/**
 * A publish request's relays: a list of up to MAX_RELAYS relay addresses, none twice by its one spelling. An empty
 * list is valid (book Decision 7).
 * @returns {{ ok: true, relays: string[] } | { ok: false }}
 */
function validateRelayListRequest(relays) {
  if (!Array.isArray(relays) || relays.length > MAX_RELAYS) return { ok: false };
  const out = [];
  const seen = new Set();
  for (const r of relays) {
    const url = normalizeRelayUrl(r);
    if (!url || seen.has(url)) return { ok: false };
    seen.add(url);
    out.push(url);
  }
  return { ok: true, relays: out };
}

/**
 * The `r` tags of a new relay list, from the draft and the newest list's entries (ADR 0003 sub-decision 2):
 *   1. each draft relay, in order: a marker none or write in the newest list is kept; read becomes both (none); a relay
 *      the newest list did not name is write;
 *   2. then each inbox-only entry of the newest list that the draft does not name, unchanged;
 *   3. nothing else: an outbox entry the draft dropped is gone, its inbox role too (book Decision 6).
 * @param {{ draft: string[], previous: Array<{url: string, marker: ?string}> }} input
 * @returns {Array<string[]>}
 */
function buildRelayListTags({ draft, previous } = {}) {
  const prior = new Map((Array.isArray(previous) ? previous : []).map((e) => [normalizeRelayUrl(e && e.url), e && e.marker]));
  const tags = [];
  const inDraft = new Set();
  for (const raw of Array.isArray(draft) ? draft : []) {
    const url = normalizeRelayUrl(raw);
    if (!url || inDraft.has(url)) continue;
    inDraft.add(url);
    const marker = prior.has(url) ? prior.get(url) : 'write';
    tags.push(marker === 'write' ? ['r', url, 'write'] : ['r', url]);
  }
  for (const [url, marker] of prior) {
    if (url && marker === 'read' && !inDraft.has(url)) tags.push(['r', url, 'read']);
  }
  return tags;
}

module.exports = {
  MAX_RELAYS,
  MAX_PARSED_R_TAGS,
  normalizeRelayUrl,
  parseRelayList,
  addRelay,
  removeRelay,
  visibleSuggestions,
  addAll,
  sameRelayList,
  validateRelayListRequest,
  buildRelayListTags,
};
