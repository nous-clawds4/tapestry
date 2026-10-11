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
 */

const { NOUS_PUBKEY } = require('../nous');
const { normalizeRelayUrl } = require('../relay-list');

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

/** What this instance offers, by category, in the offer's order (ADR 0001 K1: the kinds actually built). */
const OFFER_KEYS = { scores: ['30382'], lists: ['30392', '30393', '30394'], concepts: ['39998', '39999'] };

function tagsOf(event) {
  return event && typeof event === 'object' && Array.isArray(event.tags) ? event.tags.filter(Array.isArray) : [];
}

/**
 * Is this event a Duty Menu by § 6.1? Kind 39999; its `d` is `duty-menu`; exactly one `p`, equal to the author; a
 * `z` naming Nous' header exactly; and no `["z", "list"]` and no `z` naming any author's
 * `39998:<64 hex>:concept-header` (ADR 0001 Amendment 2 item 1, following ADR duty-menus-and-self-maps/0003
 * sub-decision 11). Other `z` tags are allowed.
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
    const key = t[1];
    if (typeof key !== 'string' || IGNORED_KEYS.includes(key)) continue;
    const colon = key.indexOf(':');
    if (!KIND_SLOT.test(colon < 0 ? key : key.slice(0, colon))) continue;
    let relay = null;
    if (t[0] === 'duty') {
      relay = normalizeRelayUrl(t[2]);
      if (!relay) continue;
    }
    const norm = normalizeMenuKey(key);
    if (seen.has(norm)) continue;
    seen.add(norm);
    rows.push({ tag: t[0], key: norm, relay });
  }
  return rows;
}

const rowId = (r) => `${r && r.tag}|${r && r.key}|${r && r.tag === 'duty' ? r.relay : ''}`;

/**
 * Do two lists hold the same rows? Compared as sets of tag, key and relay, so order never counts (AC-4).
 * @returns {boolean}
 */
function sameRows(a, b) {
  const x = new Set((Array.isArray(a) ? a : []).map(rowId));
  const y = new Set((Array.isArray(b) ? b : []).map(rowId));
  if (x.size !== y.size) return false;
  for (const id of x) if (!y.has(id)) return false;
  return true;
}

/**
 * What this instance offers for one Assistant (ADR 0001 R1 and K1): `30382` when `scores`, at ownRelay; the three List
 * kinds at ownRelay; `39998` and `39999` at ownRelay, else dlistRelay. Both relays in their one spelling; a row whose
 * relay is null is left out. Scores, then Lists, then Concepts; duty rows only.
 * @param {{ ownRelay: ?string, dlistRelay: ?string, scores: boolean }} input
 * @returns {Array<{ tag: 'duty', key: string, relay: string }>}
 */
function buildOffer({ ownRelay = null, dlistRelay = null, scores = false } = {}) {
  const own = normalizeRelayUrl(ownRelay);
  const conceptRelay = own || normalizeRelayUrl(dlistRelay);
  const rows = [];
  const add = (keys, relay) => { if (relay) for (const key of keys) rows.push({ tag: 'duty', key, relay }); };
  if (scores) add(OFFER_KEYS.scores, own);
  add(OFFER_KEYS.lists, own);
  add(OFFER_KEYS.concepts, conceptRelay);
  return rows;
}

module.exports = {
  DUTY_MENU_KIND,
  DUTY_MENU_D,
  DUTY_MENU_HEADER,
  isDutyMenu,
  readMenuRows,
  normalizeMenuKey,
  sameRows,
  buildOffer,
};
