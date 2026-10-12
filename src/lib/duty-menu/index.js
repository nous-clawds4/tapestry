'use strict';
/**
 * Duty Menus — the wire facts of one Assistant key's menu (protocols/drafts/duty-menus.md §§ 4–6.1), as this instance
 * reads a published menu and builds what it offers (assistant-duty-menu #1, ADR assistant-duty-menu/0001
 * sub-decision 1).
 *
 * A menu is one replaceable kind-39999 event per Assistant key, `d` = `duty-menu`, signed by that key, with exactly
 * one `p` (the key itself) and Nous' `z`. Its rows are `duty` (a Treasure Map key and the relay where its insights are
 * published) and `not-offered` (an exception). It says *offered*, never *active*.
 *
 * Pure CommonJS with no I/O: the server's check (src/api/assistant/dutyMenu.js) and story 2's publish both require it.
 * Keys are normalized as the Treasure Map rule's entryOf does (src/lib/treasureMapCategories.mjs), re-implemented here
 * because that rule is an ES module; test/assistant-duty-menu-check.test.js L7 pins the two to agree. Relays are
 * compared in their one spelling (normalizeRelayUrl).
 *
 * What an instance offers is no longer fixed here (ADR assistant-duties-settings/0001). It is the instance's Assistant
 * Duties list, `assistantDuties` in the settings (src/config/defaults.json ships the six): entries `{ key, relay? }`,
 * each key a whole kind (Amendment 1), no `relay` meaning This instance's relay. This module holds the one rule for that list: validateDutyList for writes,
 * readDutyList for reads, both on keptKey, the key rule readMenuRows uses, so a saved key and a read key cannot drift.
 */

const { NOUS_PUBKEY } = require('../nous');
const { normalizeRelayUrl } = require('../relay-list');
const { isPublicAddress, hasPrivateHostSuffix } = require('../../utils/ssrfGuard');

const DUTY_MENU_KIND = 39999;
const DUTY_MENU_D = 'duty-menu';
/** Nous' Duty Menu header: every conforming menu's `z` (§ 4). */
const DUTY_MENU_HEADER = `39998:${NOUS_PUBKEY}:duty-menu`;

/** A key's kind slot in the Treasure Maps grammar (§ 4.7), as /treasure-map tests it (editTreasureMap.js). */
const KIND_SLOT = /^(\d{5}|3038x|3039x|\*)$/;

/** A `z` naming any author's concept header: such an event is not a menu (ADR 0001 Amendment 2 item 1). */
const CONCEPT_HEADER_Z = /^39998:[0-9a-f]{64}:concept-header$/i;

/** The keys § 5.3 tells readers to ignore, until Treasure Maps settles what they mean. */
const IGNORED_KEYS = ['39998:', '39999:'];

/** At most this many duties in an Assistant Duties list (ADR assistant-duties-settings/0001 sub-decision 2). */
const MAX_DUTIES = 200;

/** A duty on the Assistant Duties list is a whole kind (ADR assistant-duties-settings/0001 Amendment 1). */
const WHOLE_KIND = /^\d{5}$/;

/** A key whose kind slot is a Concept slot: This instance's relay falls back to the DList relay for it. */
const CONCEPT_SLOT = /^3999[89](:|$)/;

function tagsOf(event) {
  return event && typeof event === 'object' && Array.isArray(event.tags) ? event.tags.filter(Array.isArray) : [];
}

/**
 * Is this event a Duty Menu by § 6.1? Kind 39999; its `d` is `duty-menu`; exactly one `p`, equal to the author; a
 * `z` naming Nous' header exactly; and no `["z", "list"]` and no `z` naming any author's
 * `39998:<64 hex>:concept-header` (ADR 0001 Amendment 2 item 1, following ADR duty-menus-and-self-maps/0003
 * sub-decision 11). Other `z` tags are allowed. It never compares `author` with `event.pubkey`: callers must have
 * checked the event's `pubkey` themselves (ADR 0002 sub-decision 3).
 * @param {*} event
 * @param {string} author - the key whose menu it should be (compared lower-cased)
 * @returns {boolean}
 */
function isDutyMenu(event, author) {
  if (!event || typeof event !== 'object' || event.kind !== DUTY_MENU_KIND) return false;
  const tags = tagsOf(event);
  const d = tags.find((t) => t[0] === 'd');
  if (!d || d[1] !== DUTY_MENU_D) return false;
  const who = typeof author === 'string' ? author.toLowerCase() : '';
  const ps = tags.filter((t) => t[0] === 'p');
  if (!who || ps.length !== 1 || typeof ps[0][1] !== 'string' || ps[0][1].toLowerCase() !== who) return false;
  const zs = tags.filter((t) => t[0] === 'z').map((t) => t[1]);
  if (zs.some((z) => z === 'list' || (typeof z === 'string' && CONCEPT_HEADER_Z.test(z)))) return false;
  return zs.includes(DUTY_MENU_HEADER);
}

/**
 * A Treasure Map key in its normalized form (§ 5.3), as entryOf's `norm`: trailing empty segments dropped, except in
 * a Concept key, whose `d` is taken verbatim; `39998:dlist-header` read as `39998`.
 * @param {string} key
 * @returns {string}
 */
function normalizeMenuKey(key) {
  const s = String(key);
  const colon = s.indexOf(':');
  const slot = colon < 0 ? s : s.slice(0, colon);
  const rest = colon < 0 ? '' : s.slice(colon + 1);
  if (slot === '39998' || slot === '39999') return slot === '39998' && rest === 'dlist-header' ? '39998' : s;
  const segments = rest === '' ? [] : rest.split(':');
  while (segments.length > 0 && segments[segments.length - 1] === '') segments.pop();
  return [slot, ...segments].join(':');
}

/**
 * The key a reader keeps for a row (§ 5.3), normalized, or null when it drops the row: not a string, `39998:` or
 * `39999:`, or a kind slot that does not parse. readMenuRows and the Assistant Duties list share it.
 * @param {*} key
 * @returns {?string}
 */
function keptKey(key) {
  if (typeof key !== 'string' || IGNORED_KEYS.includes(key)) return null;
  const colon = key.indexOf(':');
  if (!KIND_SLOT.test(colon < 0 ? key : key.slice(0, colon))) return null;
  return normalizeMenuKey(key);
}

/**
 * The rows a reader keeps, in order (§§ 5.1–5.3): `{ tag: 'duty'|'not-offered', key, relay }`, the key normalized and
 * a duty row's relay in its one spelling; a not-offered row's relay is null. Dropped: a duty row whose relay is
 * missing, empty or not a ws:// or wss:// address; a key whose kind slot does not parse; the keys `39998:` and
 * `39999:`. After the drops, the first row per normalized key wins, whatever its tag.
 * @param {*} event
 * @returns {Array<{ tag: string, key: string, relay: ?string }>}
 */
function readMenuRows(event) {
  const rows = [];
  const seen = new Set();
  for (const t of tagsOf(event)) {
    if (t[0] !== 'duty' && t[0] !== 'not-offered') continue;
    const norm = keptKey(t[1]);
    if (norm === null) continue;
    let relay = null;
    if (t[0] === 'duty') {
      relay = normalizeRelayUrl(t[2]);
      if (!relay) continue;
    }
    if (seen.has(norm)) continue;
    seen.add(norm);
    rows.push({ tag: t[0], key: norm, relay });
  }
  return rows;
}

const rowId = (r) => `${r && r.tag}|${r && r.key}|${r && r.tag === 'duty' ? r.relay : ''}`;

/**
 * Do two lists hold the same rows, in the same order? Tag, key and relay at every position (ADR
 * assistant-duties-settings/0001 sub-decision 5: the order the Owner sets is the menu's, so a reorder needs a publish).
 * @returns {boolean}
 */
function sameRows(a, b) {
  const x = Array.isArray(a) ? a : [];
  const y = Array.isArray(b) ? b : [];
  return x.length === y.length && x.every((row, i) => rowId(row) === rowId(y[i]));
}

/**
 * A key typed for the Assistant Duties list: a whole kind, five digits, trimmed; else null (ADR
 * assistant-duties-settings/0001 Amendment 1). Narrower keys (`30382:rank`), family keys (`3038x`), `*` and Concept
 * keys with a `d` are refused: Your Assistant's Treasure Map reads offers by kind. Every kind accepted is a key
 * readers keep as itself (keptKey), so the list stays inside the readers' rule.
 * @param {*} input
 * @returns {?string}
 */
function dutyKeyOf(input) {
  if (typeof input !== 'string') return null;
  const key = input.trim();
  return WHOLE_KIND.test(key) ? keptKey(key) : null;
}

/**
 * Could others reach this relay? The public-host rule (src/api/assistant/profileDefaults.js isPublicHost, composed from
 * the SSRF guard's classifiers) on its hostname: an IP literal must be a public address; a name must not be private by
 * construction. No DNS. The URL parser gives IPv4 literals dotted and IPv6 literals bracketed.
 * @param {string} url
 * @returns {boolean}
 */
function isPublicRelayUrl(url) {
  let host;
  try { host = new URL(String(url)).hostname.toLowerCase().replace(/\.$/, ''); } catch { return false; }
  if (!host) return false;
  const literal = /^\[.*\]$/.test(host) || /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  return literal ? isPublicAddress(host) : !hasPrivateHostSuffix(host);
}

/** One entry of a list: { duty } when it is good, else { code } — the first of bad-list, bad-key, bad-relay, private-relay. */
function checkEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return { code: 'bad-list' };
  const key = dutyKeyOf(entry.key);
  if (key === null) return { code: 'bad-key' };
  if (entry.relay === undefined || entry.relay === null) return { duty: { key } };
  const relay = typeof entry.relay === 'string' ? normalizeRelayUrl(entry.relay) : null;
  if (!relay) return { key, code: 'bad-relay' };
  if (!isPublicRelayUrl(relay)) return { key, code: 'private-relay' };
  return { duty: { key, relay } };
}

/**
 * An Assistant Duties list, checked for a write (ADR assistant-duties-settings/0001 sub-decision 2). `{ ok: true,
 * duties }` normalized: keys as readers keep them, typed relays in their one spelling, This instance's relay (a missing
 * or null `relay`) as no `relay` field, other fields dropped, order kept. Otherwise `{ ok: false, code, index }`, in this
 * order: bad-list (not an array, index null; an entry not an object), too-many (index null), bad-key, duplicate-key
 * (the later entry), bad-relay, private-relay.
 * @param {*} input
 * @returns {{ ok: true, duties: Array<{ key: string, relay?: string }> } | { ok: false, code: string, index: ?number }}
 */
function validateDutyList(input) {
  if (!Array.isArray(input)) return { ok: false, code: 'bad-list', index: null };
  if (input.length > MAX_DUTIES) return { ok: false, code: 'too-many', index: null };
  const duties = [];
  const seen = new Set();
  for (let i = 0; i < input.length; i += 1) {
    const r = checkEntry(input[i]);
    if (r.code === 'bad-list' || r.code === 'bad-key') return { ok: false, code: r.code, index: i };
    const key = r.duty ? r.duty.key : r.key;
    if (seen.has(key)) return { ok: false, code: 'duplicate-key', index: i };
    if (r.code) return { ok: false, code: r.code, index: i };
    seen.add(key);
    duties.push(r.duty);
  }
  return { ok: true, duties };
}

/**
 * An Assistant Duties list as read from the settings, which may have been edited by hand: what validateDutyList would
 * refuse is dropped instead, the first entry per key wins, and at most MAX_DUTIES are kept. Not an array is no duties.
 * @param {*} input
 * @returns {{ duties: Array<{ key: string, relay?: string }>, dropped: number }}
 */
function readDutyList(input) {
  if (!Array.isArray(input)) return { duties: [], dropped: 0 };
  const duties = [];
  const seen = new Set();
  let dropped = 0;
  for (const entry of input) {
    const r = checkEntry(entry);
    if (r.code || seen.has(r.duty.key) || duties.length >= MAX_DUTIES) { dropped += 1; continue; }
    seen.add(r.duty.key);
    duties.push(r.duty);
  }
  return { duties, dropped };
}

/**
 * This instance's relay for a key (ADR assistant-duties-settings/0001 sub-decision 3, extending assistant-duty-menu
 * R1): a Concept slot (39998 or 39999) gives ownRelay, else dlistRelay; any other key gives ownRelay. Each in its one
 * spelling; null when there is none.
 * @param {string} key
 * @param {{ ownRelay: ?string, dlistRelay: ?string }} input
 * @returns {?string}
 */
function instanceRelayFor(key, { ownRelay = null, dlistRelay = null } = {}) {
  const own = normalizeRelayUrl(ownRelay);
  return CONCEPT_SLOT.test(String(key)) ? own || normalizeRelayUrl(dlistRelay) : own;
}

/**
 * What this instance offers for an Assistant (ADR assistant-duties-settings/0001 sub-decision 3): one duty row per entry
 * of the Assistant Duties list, in its order, at the entry's typed relay or else This instance's relay for its key. A
 * row whose relay comes out null is left out. No list is no offer. The same for every Assistant.
 * @param {{ ownRelay: ?string, dlistRelay: ?string, duties: Array<{ key: string, relay?: string }> }} input
 * @returns {Array<{ tag: 'duty', key: string, relay: string }>}
 */
function buildOffer({ ownRelay = null, dlistRelay = null, duties = [] } = {}) {
  const rows = [];
  for (const d of Array.isArray(duties) ? duties : []) {
    if (!d || typeof d.key !== 'string') continue;
    const relay = d.relay ? normalizeRelayUrl(d.relay) : instanceRelayFor(d.key, { ownRelay, dlistRelay });
    if (relay) rows.push({ tag: 'duty', key: d.key, relay });
  }
  return rows;
}

/**
 * A menu's tags, as this instance publishes it (ADR assistant-duty-menu/0002 sub-decision 2): `d`, Nous' `z` and the
 * one `p` (the Assistant itself), then one `["duty", key, relay]` per duty row of the offer, in its order. Rows only:
 * no name, description or per-duty details. An empty offer gives the three.
 * @param {{ assistantPubkey: string, offer: Array<{ tag: string, key: string, relay: ?string }> }} input
 * @returns {string[][]}
 */
function buildMenuTags({ assistantPubkey, offer } = {}) {
  const tags = [['d', DUTY_MENU_D], ['z', DUTY_MENU_HEADER], ['p', assistantPubkey]];
  for (const row of Array.isArray(offer) ? offer : []) {
    if (row && row.tag === 'duty') tags.push(['duty', row.key, row.relay]);
  }
  return tags;
}

module.exports = {
  DUTY_MENU_KIND,
  DUTY_MENU_D,
  DUTY_MENU_HEADER,
  MAX_DUTIES,
  isDutyMenu,
  keptKey,
  readMenuRows,
  normalizeMenuKey,
  sameRows,
  dutyKeyOf,
  isPublicRelayUrl,
  validateDutyList,
  readDutyList,
  instanceRelayFor,
  buildOffer,
  buildMenuTags,
};
