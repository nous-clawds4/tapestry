'use strict';
/**
 * The Duty Menu action's answer (assistant-duty-menu #1, ADR assistant-duty-menu/0001): what this instance offers for
 * the signed-in viewer's own Assistant, the Duty Menu found for that Assistant now, and whether the two match.
 *
 * Called by GET /api/assistant/attention (src/api/assistant/attention.js) for the session's viewer, with the assistant
 * that answer already resolved from the session (the one main→delegate mapping; for the Owner the instance TA). No
 * request parameter reaches it.
 *
 * The offer (ADR assistant-duties-settings/0001 sub-decision 3) is the instance's Assistant Duties list, re-read from
 * the settings at every check (readAssistantDuties; hand-edited entries the rule refuses are dropped and logged), the
 * same for every Assistant. Each duty is at its typed relay, else This instance's relay: this instance's relay at its
 * public address; with none, a Concept key takes the first public DList relay in Relay Settings (none when publishing
 * is local-only) and any other key gets no row (R1). It never depends on the lookup, so an unfinished check still
 * carries it.
 *
 * The lookup (sub-decision 3; duty-menus.md § 8.1) reads this instance's relay first, in one strict local scan (ADR
 * 0002 sub-decision 7): when it holds any version of the menu, the newest there counts and nothing else is read. Only
 * otherwise do two rounds run. First, side by side, the hints: the viewer's newest Treasure Map (its relays for entries
 * naming this Assistant), the Assistant's newest kind 10002 and Nous' (their write relays; a found Nous list is
 * remembered for an hour). A failed hint lookup only shrinks the second round. Then every hinted relay plus the offer's
 * relays, outside this instance's own. Relays named inside events are capped at the first 50, and each is read only
 * when the SSRF guard accepts its host (ADR 0001 Amendment 2); a configured relay is read as every other check reads
 * one. The newest version found counts, and if it is not a menu by § 6.1 the Assistant has none. "Finished" means the
 * local scan succeeded or at least one relay answered. The two write-relay lookups are exported for the Duty Menu
 * publish route, which shares the Nous cache.
 *
 * Read-only: strfry is only scanned, outside relays are only read, and nothing is stored but the in-process Nous list.
 */

const { normalizeRelayUrl, parseRelayList, MAX_RELAYS } = require('../../lib/relay-list');
const {
  DUTY_MENU_KIND, DUTY_MENU_D, isDutyMenu, readMenuRows, sameRows, buildOffer, readDutyList, isPublicRelayUrl,
} = require('../../lib/duty-menu');
const { NOUS_PUBKEY } = require('../../lib/nous');

const RELAY_LIST_KIND = 10002;
const TREASURE_MAP_KIND = 10040;

/** The Relay Settings list Concepts are published to (dlist-curation): the offer's fallback relay. */
const DLIST_RELAY_CATEGORIES = ['aDListRelays'];

/** How long a found Nous relay list is remembered (§ 8.1: "can be cached"). */
const NOUS_CACHE_MS = 60 * 60 * 1000;

/** What the answer says for this action when its check threw (sub-decision 4). */
const DUTY_MENU_CHECK_FAILED = Object.freeze({
  finished: false, done: false, pending: false, reason: 'check-failed', offer: [], published: null, current: null,
});

/** The found Nous relay list's write relays, and when they were found: { at, relays }, or null. */
let nousCache = null;

/** Forget the remembered Nous relay list (for tests). */
function resetNousCache() {
  nousCache = null;
}

/** The real dependencies, required lazily so the module loads in a bare checkout. */
function defaultDeps() {
  return {
    scanLocal: (filter) => require('../setup/status').scanLocalStrict(filter),
    readRelay: (url, filter) => require('../_shared/relaySource').readRelayEvents(url, filter),
    getConfigFromFile: (key, fallback) => require('../../utils/config').getConfigFromFile(key, fallback),
    readConfiguredRelays: (categories) => require('./profilePublish').readConfiguredRelays(categories),
    getConfiguredPublishRelays: () => require('./profilePublish').getConfiguredPublishRelays(),
    mapDefaultRelays: () => require('../export/nip85/currentMap').defaultRelays(),
    // This instance's relay at its public address, derived from the domain on Docker (duty-menu-public-relay #1).
    instanceRelayUrl: (d) => require('./profileDefaults').instanceRelayUrl({ getConfigFromFile: d.getConfigFromFile }),
    isPublicRelayHostWithin: (host) => require('../../utils/relayHostGuard').isPublicRelayHostWithin(host),
    isLocalOnly: () => require('../publish-policy').isPublishLocalOnly(),
    outsideOnly: (urls, d) => require('../setup/status').outsideOnly(urls, d),
    lookupNewest: (input, d) => require('../setup/status').lookupNewest(input, d),
    treasureMapRelays: (d) => require('../setup/status').treasureMapRelays(d),
    lookupNewestReplaceable: (input, d) => require('./attention').lookupNewestReplaceable(input, d),
    // The Assistant Duties list, re-read from the settings files at every check (ADR assistant-duties-settings/0001).
    readAssistantDuties: () => require('../../config/settings').getSettings().assistantDuties,
    now: () => Date.now(),
  };
}

/** The attention handler's relay read within the relay budget, and NIP-01's newest; required lazily (no cycle). */
const shared = () => require('./attention');

/**
 * The offer's inputs, read from the settings at each check (sub-decision 2; ADR assistant-duties-settings/0001
 * sub-decision 3). The same for every viewer: `viewer` stays in the signature for the three callers.
 * @param {string} viewer - the session's viewer, lower-case hex (unused)
 * @returns {Promise<{ ownRelay: ?string, dlistRelay: ?string, duties: Array<{ key: string, relay?: string }> }>}
 */
async function resolveOfferInputs(viewer, deps = {}) {
  const d = { ...defaultDeps(), ...deps };
  const ownRelay = d.instanceRelayUrl(d);

  let dlistRelay = null;
  if (!d.isLocalOnly()) {
    let listed = [];
    try { listed = d.readConfiguredRelays(DLIST_RELAY_CATEGORIES); } catch { listed = []; }
    dlistRelay = (Array.isArray(listed) ? listed : []).map(normalizeRelayUrl).find((url) => url && isPublicRelayUrl(url)) || null;
  }

  const { duties, dropped } = readDutyList(d.readAssistantDuties());
  if (dropped > 0) console.warn(`[assistant/duty-menu] ignored ${dropped} assistantDuties entries`);
  return { ownRelay, dlistRelay, duties };
}

/** A NIP-65 list's write relays: its `r` entries with no marker or `write`, each in its one spelling. */
function writeRelays(event) {
  return event ? parseRelayList(event).outbox : [];
}

/**
 * The Assistant's relay-list lookup, saying whether it finished (ADR assistant-self-map/0002 Amendment 1 item 1): its
 * newest kind 10002, from this instance's relay first, then the relays this instance publishes Assistant profiles to.
 * It finished when the list was read (or found to be nowhere), or when there was no outside relay to look on
 * (`no-outside-relays`, a real answer). It did not when this instance's scan failed, no outside relay answered, or the
 * configured relays could not be read. `relays` are the list's write relays when it finished, else none.
 * With `everyRelay` (Amendment 2 item 1), a list found nowhere counts only when every configured relay answered.
 * @param {{ assistantPubkey: string, everyRelay?: boolean }} input
 * @returns {Promise<{ finished: boolean, relays: string[] }>}
 */
async function assistantWriteRelayLookup({ assistantPubkey, everyRelay = false }, deps = {}) {
  const d = { ...defaultDeps(), ...deps };
  let relays = [];
  let configuredRead = true;
  try { relays = d.outsideOnly(d.getConfiguredPublishRelays(), d); } catch { relays = []; configuredRead = false; }
  const lookup = await d.lookupNewestReplaceable({ kind: RELAY_LIST_KIND, author: assistantPubkey, relays, everyRelay }, d);
  if (lookup && lookup.finished === true) return { finished: true, relays: writeRelays(lookup.event) };
  return { finished: configuredRead && !!lookup && lookup.reason === 'no-outside-relays', relays: [] };
}

/**
 * The Assistant's write relays, from its newest kind 10002 (assistantWriteRelayLookup), or none when the lookup did not
 * finish. § 8.1's second place for a reader, and the first for the publisher (ADR 0002 sub-decision 5).
 * @param {{ assistantPubkey: string }} input
 * @returns {Promise<string[]>}
 */
async function assistantWriteRelays(input, deps = {}) {
  return (await assistantWriteRelayLookup(input, deps)).relays;
}

/**
 * Nous' write relays: remembered for an hour once its list is found; a miss is never remembered. One cache, shared by
 * the check and the publisher.
 * @param {string[]} relays - the outside relays to look Nous' list up on when it is not held here
 * @returns {Promise<string[]>}
 */
async function nousWriteRelays(relays, deps = {}) {
  const d = { ...defaultDeps(), ...deps };
  const now = d.now();
  if (nousCache && now - nousCache.at < NOUS_CACHE_MS) return nousCache.relays;
  const lookup = await d.lookupNewestReplaceable({ kind: RELAY_LIST_KIND, author: NOUS_PUBKEY, relays }, d);
  if (!lookup || lookup.finished !== true || !lookup.event) return [];
  nousCache = { at: now, relays: writeRelays(lookup.event) };
  return nousCache.relays;
}

/** One hint lookup: its answer, or the fallback when it threw. */
const attempt = (fn, fallback) => Promise.resolve().then(fn).catch(() => fallback);

/** The relays § 8.1 names for this Assistant, from the three places: the Map's hints and both kind 10002s. */
async function hintRelays({ viewer, assistantPubkey }, d) {
  const who = String(assistantPubkey || '').toLowerCase();
  const publishRelays = await attempt(() => d.outsideOnly(d.getConfiguredPublishRelays(), d), []);
  const [map, assistantWrite, nous] = await Promise.all([
    attempt(() => d.lookupNewest({ kind: TREASURE_MAP_KIND, pubkey: viewer, relays: d.treasureMapRelays(d) }, d), null),
    attempt(() => assistantWriteRelays({ assistantPubkey }, d), []),
    attempt(() => nousWriteRelays(publishRelays, d), []),
  ]);
  const mapHints = map && map.finished === true && map.event && Array.isArray(map.event.tags)
    ? map.event.tags
      .filter((t) => Array.isArray(t) && typeof t[1] === 'string' && t[1].toLowerCase() === who && typeof t[2] === 'string')
      .map((t) => t[2])
    : [];
  return [...mapHints, ...(Array.isArray(assistantWrite) ? assistantWrite : []), ...(Array.isArray(nous) ? nous : [])];
}

function dTagOf(event) {
  const t = Array.isArray(event.tags) ? event.tags.find((x) => Array.isArray(x) && x[0] === 'd') : null;
  return t ? t[1] : null;
}

/**
 * The menu found for one Assistant now (AC-3, § 8.1; this instance's relay first since ADR 0002 sub-decision 7).
 * `latest` is the newest version found, whatever its validity: the publisher dates its new version after it and sends
 * the replacement to its rows' relays (ADR 0002 sub-decision 4). The check's answer ignores it.
 * @param {{ assistantPubkey: string, viewer: string, offer: Array }} input
 * @returns {Promise<{ finished: true, latest: ?Object, published: null | { rows, createdAt, source: 'local'|'relay', eventId } }
 *                  |{ finished: false, reason: 'no-relay-answered' }>}
 */
async function lookupPublishedMenu({ assistantPubkey, viewer, offer }, deps = {}) {
  const d = { ...defaultDeps(), ...deps };
  const { readWithinBudget, newest } = shared();
  const who = String(assistantPubkey || '').toLowerCase();
  const mine = (e) => e && typeof e === 'object' && e.kind === DUTY_MENU_KIND && String(e.pubkey || '').toLowerCase() === who && dTagOf(e) === DUTY_MENU_D;
  const found = (latest, source) => ({
    finished: true,
    latest,
    published: latest && isDutyMenu(latest, who)
      ? { rows: readMenuRows(latest), createdAt: latest.created_at, source, eventId: latest.id }
      : null,
  });

  // This instance's relay first (ADR 0002 sub-decision 7): when it holds any version, the newest here counts and
  // nothing else is read. This is the check's one local scan for the menu (ADR 0002 Amendment 1 item 1).
  const filter = { kinds: [DUTY_MENU_KIND], authors: [assistantPubkey], '#d': [DUTY_MENU_D] };
  const local = await Promise.resolve().then(() => d.scanLocal(filter))
    .then((events) => ({ ok: true, events: Array.isArray(events) ? events : [] }), () => ({ ok: false, events: [] }));
  const here = newest(local.events.filter(mine));
  if (here) return found(here, 'local');

  // Round 1: the hints. Relays named inside events: at most MAX_RELAYS, the first in § 8.1's order once each is in its
  // one spelling, outside this instance and named once (ADR 0001 Amendment 2 item 2), and read only when the SSRF guard
  // accepts their host.
  const named = d.outsideOnly((await hintRelays({ viewer, assistantPubkey }, d)).map(normalizeRelayUrl).filter(Boolean), d)
    .slice(0, MAX_RELAYS);
  const accepted = await Promise.all(named.map((url) => attempt(async () => ((await d.isPublicRelayHostWithin(new URL(url).hostname)) === true ? url : null), null)));
  const configured = (Array.isArray(offer) ? offer : []).map((row) => row && row.relay).filter(Boolean);
  const relays = d.outsideOnly([...accepted.filter(Boolean), ...configured], d);

  // Round 2: the outside relays. The local scan above counts toward "finished".
  const answers = await Promise.all(relays.map((url) => readWithinBudget(url, filter, d)));
  const answered = answers.filter((a) => a && a.status === 'ok');
  if (!local.ok && answered.length === 0) return { finished: false, reason: 'no-relay-answered' };
  return found(newest(answered.flatMap((a) => (Array.isArray(a.events) ? a.events : [])).filter(mine)), 'relay');
}

/**
 * The action from the offer and the lookup (sub-decision 4). Pure. Done when finished, a menu was found, and it has
 * the offer's rows; pending when finished and not done.
 */
function evaluateDutyMenu({ offer, lookup } = {}) {
  const rows = Array.isArray(offer) ? offer : [];
  if (!lookup || lookup.finished !== true) {
    return {
      finished: false, done: false, pending: false, reason: (lookup && lookup.reason) || 'no-relay-answered',
      offer: rows, published: null, current: null,
    };
  }
  const published = lookup.published || null;
  const current = published !== null && sameRows(rows, published.rows);
  return { finished: true, done: current, pending: !current, reason: null, offer: rows, published, current };
}

/**
 * The Duty Menu action for the session's viewer and their own Assistant.
 * @param {{ viewer: string, assistantPubkey: string }} input
 */
async function checkDutyMenu({ viewer, assistantPubkey }, deps = {}) {
  const d = { ...defaultDeps(), ...deps };
  const offer = buildOffer(await resolveOfferInputs(viewer, d));
  const lookup = await lookupPublishedMenu({ assistantPubkey, viewer, offer }, d);
  return evaluateDutyMenu({ offer, lookup });
}

module.exports = {
  checkDutyMenu,
  resolveOfferInputs,
  lookupPublishedMenu,
  evaluateDutyMenu,
  assistantWriteRelays,
  assistantWriteRelayLookup,
  nousWriteRelays,
  resetNousCache,
  DUTY_MENU_CHECK_FAILED,
  NOUS_CACHE_MS,
};
