/**
 * The Outbox Relays action's answer (assistant-outbox-relays ADRs 0001 and 0002): which outbox relays the signed-in
 * viewer's own Assistant's newest NIP-65 relay list (kind 10002) names, and the relays the page suggests.
 *
 * Called by GET /api/assistant/attention (src/api/assistant/attention.js) for the session's viewer, with the assistant
 * that answer already resolved from the session (the one main→delegate mapping; for the Owner the instance TA). No
 * request parameter reaches it.
 *
 * The list is looked up on this instance's relay first; only when it holds none, on the relays this instance publishes
 * Assistant profiles to (the General Purpose, Profile and WoT lists, whatever the publish mode: reading is not
 * publishing), minus this instance's own — the same set a relay list is always sent to (ADR 0003), so a list this
 * instance publishes is always findable here. "Finished" is /setup's rule; the action is done when finished with at
 * least one outbox relay (an `r` tag with no marker or `write`), and pending when finished with none.
 *
 * The suggestions are where the Assistant already publishes (book Decision 2): this instance's own relay at its public
 * address, then Relay Settings' General Purpose, Trusted Assertion, Trusted List, DList and Outbox lists, each relay once
 * in its one spelling. They do not depend on the lookup, so an unfinished check still carries them; the page leaves out
 * the ones already in its draft. A relay that is plainly not on the public internet is left out too, since the page
 * would refuse it (ADR 0003 Amendment 1).
 *
 * Read-only: strfry is only scanned, outside relays are only read, and nothing is stored anywhere.
 */

const net = require('net');
const { normalizeRelayUrl, parseRelayList, MAX_RELAYS } = require('../../lib/relay-list');
const { isPublicAddress, hasPrivateHostSuffix } = require('../../utils/ssrfGuard');

/** NIP-65's relay list. */
const RELAY_LIST_KIND = 10002;

/** The Relay Settings lists the Assistant writes its content to, in the order they are suggested (ADR 0002 sub-decision 1). */
const SUGGESTION_RELAY_CATEGORIES = ['aPopularGeneralPurposeRelays', 'aTrustedAssertionRelays', 'aTrustedListRelays', 'aDListRelays', 'aOutboxRelays'];

/** The real dependencies, required lazily so the module loads in a bare checkout. */
function defaultDeps() {
  return {
    scanLocal: (filter) => require('../setup/status').scanLocalStrict(filter),
    readRelay: (url, filter) => require('../_shared/relaySource').readRelayEvents(url, filter),
    getConfiguredPublishRelays: () => require('./profilePublish').getConfiguredPublishRelays(),
    readConfiguredRelays: (categories) => require('./profilePublish').readConfiguredRelays(categories),
    getConfigFromFile: (key, fallback) => require('../../utils/config').getConfigFromFile(key, fallback),
    isPublicHost: (host) => require('./profileDefaults').isPublicHost(host),
    lookupNewestReplaceable: (input, d) => require('./attention').lookupNewestReplaceable(input, d),
    outsideOnly: (urls, d) => require('../setup/status').outsideOnly(urls, d),
  };
}

/**
 * The action from one lookup. Pure.
 * @param {{ lookup: Object }} input - what lookupNewestReplaceable answered
 * @returns {{ finished: boolean, done: boolean, pending: boolean, reason: ?string, source: ?string, createdAt: ?number,
 *             outbox: string[], inboxOnlyCount: number }}
 */
function evaluateOutboxRelays({ lookup } = {}) {
  if (!lookup || lookup.finished !== true) {
    return {
      finished: false, done: false, pending: false,
      reason: (lookup && lookup.reason) || 'outside-unreachable',
      source: null, createdAt: null, outbox: [], inboxOnlyCount: 0,
    };
  }
  const event = lookup.event || null;
  const { outbox, inboxOnly } = parseRelayList(event);
  const done = outbox.length > 0;
  return {
    finished: true,
    done,
    pending: !done,
    reason: null,
    source: event ? lookup.source || null : null,
    createdAt: event && Number.isFinite(event.created_at) ? event.created_at : null,
    outbox,
    inboxOnlyCount: inboxOnly.length,
  };
}

/** ssrfGuard's synchronous rule for a relay's host: a non-public IP literal, or a private-by-construction name. */
function isPlainlyPrivateRelay(url) {
  const bare = new URL(url).hostname.replace(/^\[|\]$/g, '');
  return net.isIP(bare) ? !isPublicAddress(bare) : hasPrivateHostSuffix(bare);
}

/** The suggestions, in order, each once in its one spelling, at most MAX_RELAYS (ADR 0002 sub-decision 1). */
function outboxSuggestions(deps = {}) {
  const d = { ...defaultDeps(), ...deps };
  const out = [];
  const seen = new Set();
  const add = (raw) => {
    const url = normalizeRelayUrl(raw);
    if (!url || seen.has(url) || out.length >= MAX_RELAYS || isPlainlyPrivateRelay(url)) return;
    seen.add(url);
    out.push(url);
  };

  const own = normalizeRelayUrl(String(d.getConfigFromFile('BRAINSTORM_RELAY_URL', '') || ''));
  if (own && d.isPublicHost(new URL(own).hostname)) add(own);

  let configured = [];
  try { configured = d.readConfiguredRelays(SUGGESTION_RELAY_CATEGORIES); } catch { configured = []; }
  for (const raw of Array.isArray(configured) ? configured : []) add(raw);
  return out;
}

/**
 * The outbox action for one assistant: its newest relay list, local first, then the outside profile publish relays.
 * @param {{ assistantPubkey: string }} input
 */
async function checkOutboxRelays({ assistantPubkey }, deps = {}) {
  const d = { ...defaultDeps(), ...deps };
  const suggestions = outboxSuggestions(d);
  const relays = d.outsideOnly(d.getConfiguredPublishRelays(), d);
  const lookup = await d.lookupNewestReplaceable({ kind: RELAY_LIST_KIND, author: assistantPubkey, relays }, d);
  return { ...evaluateOutboxRelays({ lookup }), suggestions };
}

module.exports = {
  checkOutboxRelays,
  evaluateOutboxRelays,
  outboxSuggestions,
  RELAY_LIST_KIND,
  SUGGESTION_RELAY_CATEGORIES,
};
