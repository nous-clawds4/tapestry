'use strict';
/**
 * The Duty Menu action's answer (assistant-duty-menu #1, ADR assistant-duty-menu/0001): what this instance offers for
 * the signed-in viewer's own Assistant, the Duty Menu found for that Assistant now, and whether the two match.
 *
 * Called by GET /api/assistant/attention (src/api/assistant/attention.js) for the session's viewer, with the assistant
 * that answer already resolved from the session (the one main→delegate mapping; for the Owner the instance TA). No
 * request parameter reaches it.
 *
 * The offer (sub-decision 2; R1 and K1) is built from what this instance does, re-read at every check: this
 * instance's relay at its public address holds every duty it performs, so every row names it; with no public address,
 * Concepts take the first public DList relay in Relay Settings (none when publishing is local-only) and Scores and
 * Lists get no row. Scores are offered to the Owner and to active customers, as the Scores pipeline computes them;
 * Lists and Concepts to every Assistant. It never depends on the lookup, so an unfinished check still carries it.
 *
 * The lookup (sub-decision 3; duty-menus.md § 8.1) runs in two rounds. First, side by side, the hints: the viewer's
 * newest Treasure Map (its relays for entries naming this Assistant), the Assistant's newest kind 10002 and Nous'
 * (their write relays; a found Nous list is remembered for an hour). A failed hint lookup only shrinks the second
 * round. Then one strict local scan, and in parallel every hinted relay plus the offer's relays, outside this
 * instance's own. Relays named inside events are capped at the first 50, and each is read only when the SSRF guard
 * accepts its host (Amendment 2); a configured relay is read as every other check reads one. The latest version among
 * all answers counts, and if it is not a menu by § 6.1 the Assistant has none. "Finished" means the local scan
 * succeeded or at least one relay answered.
 *
 * Read-only: strfry is only scanned, outside relays are only read, and nothing is stored but the in-process Nous list.
 */

const net = require('net');
const { normalizeRelayUrl, parseRelayList, MAX_RELAYS } = require('../../lib/relay-list');
const {
  DUTY_MENU_KIND, DUTY_MENU_D, isDutyMenu, readMenuRows, sameRows, buildOffer,
} = require('../../lib/duty-menu');
const { NOUS_PUBKEY } = require('../../lib/nous');
const { isPublicAddress, hasPrivateHostSuffix } = require('../../utils/ssrfGuard');

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
    isPublicHost: (host) => require('./profileDefaults').isPublicHost(host),
    isPublicRelayHostWithin: (host) => require('./relayListPublish').isPublicRelayHostWithin(host),
    isLocalOnly: () => require('../publish-policy').isPublishLocalOnly(),
    outsideOnly: (urls, d) => require('../setup/status').outsideOnly(urls, d),
    lookupNewest: (input, d) => require('../setup/status').lookupNewest(input, d),
    treasureMapRelays: (d) => require('../setup/status').treasureMapRelays(d),
    lookupNewestReplaceable: (input, d) => require('./attention').lookupNewestReplaceable(input, d),
    getCustomer: async (pubkey) => {
      const CustomerManager = require('../../utils/customerManager');
      const customers = new CustomerManager();
      await customers.initialize();
      return customers.getCustomer(pubkey);
    },
    now: () => Date.now(),
  };
}

/** The attention handler's relay read within the relay budget, and NIP-01's newest; required lazily (no cycle). */
const shared = () => require('./attention');

/** ssrfGuard's synchronous rule for a relay's host: a non-public IP literal, or a private-by-construction name. */
function isPlainlyPrivateRelay(url) {
  const bare = new URL(url).hostname.replace(/^\[|\]$/g, '');
  return net.isIP(bare) ? !isPublicAddress(bare) : hasPrivateHostSuffix(bare);
}

/**
 * The offer's inputs for one viewer, read from the settings at each check (sub-decision 2).
 * @param {string} viewer - the session's viewer, lower-case hex
 * @returns {Promise<{ ownRelay: ?string, dlistRelay: ?string, scores: boolean }>}
 */
async function resolveOfferInputs(viewer, deps = {}) {
  const d = { ...defaultDeps(), ...deps };
  const configured = normalizeRelayUrl(String(d.getConfigFromFile('BRAINSTORM_RELAY_URL', '') || ''));
  const ownRelay = configured && d.isPublicHost(new URL(configured).hostname) ? configured : null;

  let dlistRelay = null;
  if (!d.isLocalOnly()) {
    let listed = [];
    try { listed = d.readConfiguredRelays(DLIST_RELAY_CATEGORIES); } catch { listed = []; }
    dlistRelay = (Array.isArray(listed) ? listed : []).map(normalizeRelayUrl).find((url) => url && !isPlainlyPrivateRelay(url)) || null;
  }

  const who = String(viewer || '').toLowerCase();
  const owner = String(d.getConfigFromFile('BRAINSTORM_OWNER_PUBKEY', '') || '').trim().toLowerCase();
  let scores = !!owner && owner === who;
  if (!scores) {
    try {
      const customer = await d.getCustomer(who);
      scores = !!customer && customer.status === 'active';
    } catch (err) {
      console.error('[assistant/duty-menu] could not look the viewer up as a customer:', err && err.message ? err.message : err);
      scores = false;
    }
  }
  return { ownRelay, dlistRelay, scores };
}

/** A NIP-65 list's write relays: its `r` entries with no marker or `write`, each in its one spelling. */
function writeRelays(event) {
  return event ? parseRelayList(event).outbox : [];
}

/** Nous' write relays: remembered for an hour once its list is found; a miss is never remembered. */
async function nousWriteRelays(relays, d) {
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
  const [map, assistantList, nous] = await Promise.all([
    attempt(() => d.lookupNewest({ kind: TREASURE_MAP_KIND, pubkey: viewer, relays: d.treasureMapRelays(d) }, d), null),
    attempt(() => d.lookupNewestReplaceable({ kind: RELAY_LIST_KIND, author: assistantPubkey, relays: publishRelays }, d), null),
    attempt(() => nousWriteRelays(publishRelays, d), []),
  ]);
  const mapHints = map && map.finished === true && map.event && Array.isArray(map.event.tags)
    ? map.event.tags
      .filter((t) => Array.isArray(t) && typeof t[1] === 'string' && t[1].toLowerCase() === who && typeof t[2] === 'string')
      .map((t) => t[2])
    : [];
  const assistantWrite = assistantList && assistantList.finished === true ? writeRelays(assistantList.event) : [];
  return [...mapHints, ...assistantWrite, ...(Array.isArray(nous) ? nous : [])];
}

function dTagOf(event) {
  const t = Array.isArray(event.tags) ? event.tags.find((x) => Array.isArray(x) && x[0] === 'd') : null;
  return t ? t[1] : null;
}

/**
 * The menu found for one Assistant now (AC-3, § 8.1).
 * @param {{ assistantPubkey: string, viewer: string, offer: Array }} input
 * @returns {Promise<{ finished: true, published: null | { rows, createdAt, source: 'local'|'relay', eventId } }
 *                  |{ finished: false, reason: 'no-relay-answered' }>}
 */
async function lookupPublishedMenu({ assistantPubkey, viewer, offer }, deps = {}) {
  const d = { ...defaultDeps(), ...deps };
  const { readWithinBudget, newest } = shared();
  const who = String(assistantPubkey || '').toLowerCase();

  // Round 1: the hints. Relays named inside events: at most MAX_RELAYS, the first in § 8.1's order once each is in its
  // one spelling, outside this instance and named once (ADR 0001 Amendment 2 item 2), and read only when the SSRF guard
  // accepts their host.
  const named = d.outsideOnly((await hintRelays({ viewer, assistantPubkey }, d)).map(normalizeRelayUrl).filter(Boolean), d)
    .slice(0, MAX_RELAYS);
  const accepted = await Promise.all(named.map((url) => attempt(async () => ((await d.isPublicRelayHostWithin(new URL(url).hostname)) === true ? url : null), null)));
  const configured = (Array.isArray(offer) ? offer : []).map((row) => row && row.relay).filter(Boolean);
  const relays = d.outsideOnly([...accepted.filter(Boolean), ...configured], d);

  // Round 2: the menu, here and outside at once.
  const filter = { kinds: [DUTY_MENU_KIND], authors: [assistantPubkey], '#d': [DUTY_MENU_D] };
  const [local, answers] = await Promise.all([
    Promise.resolve().then(() => d.scanLocal(filter)).then((events) => ({ ok: true, events }), () => ({ ok: false, events: [] })),
    Promise.all(relays.map((url) => readWithinBudget(url, filter, d))),
  ]);
  const answered = answers.filter((a) => a && a.status === 'ok');
  if (!local.ok && answered.length === 0) return { finished: false, reason: 'no-relay-answered' };

  const mine = (e) => e && typeof e === 'object' && e.kind === DUTY_MENU_KIND && String(e.pubkey || '').toLowerCase() === who && dTagOf(e) === DUTY_MENU_D;
  const localBest = newest((Array.isArray(local.events) ? local.events : []).filter(mine));
  const relayBest = newest(answered.flatMap((a) => (Array.isArray(a.events) ? a.events : [])).filter(mine));
  const latest = newest([localBest, relayBest].filter(Boolean));
  if (!latest || !isDutyMenu(latest, who)) return { finished: true, published: null };
  return {
    finished: true,
    published: { rows: readMenuRows(latest), createdAt: latest.created_at, source: latest === localBest ? 'local' : 'relay', eventId: latest.id },
  };
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
  resetNousCache,
  DUTY_MENU_CHECK_FAILED,
  NOUS_CACHE_MS,
};
