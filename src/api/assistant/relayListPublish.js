/**
 * POST /api/assistant/outbox-relays/publish — your Assistant signs its relay list (assistant-outbox-relays #3, ADR
 * assistant-outbox-relays/0003).
 *
 * A narrow, session-bound route in the shape of the identification-tags publish (ADR assistant-identification-tags/0003):
 * the signed-in person's own Assistant signs a NIP-65 relay list (kind 10002) built from the Outbox Relays page's draft.
 * The request names relays only — `{ relays: string[] }`; whose Assistant signs comes from the SESSION (the one
 * main→delegate mapping: for the Owner the instance TA, for anyone else their own relay key). Refusals come first,
 * before any key is read: not signed in (401), not a list of up to 50 relay addresses with none twice (400), no
 * Assistant on this instance (403). The route signs a kind 10002 and nothing else; the generic signer
 * (src/api/strfry/commands/publishEvent.js) stays owner-or-admin and TA-only (OPEN.md row 269).
 *
 * The event (src/lib/relay-list buildRelayListTags): the draft's relays in order, each keeping its marker from the
 * Assistant's newest relay list (none stays none, write stays write, read becomes both), any other marked write; then
 * the newest list's inbox-only entries the draft does not name; a relay the page removed is gone, inbox role included
 * (book Decision 6). "The newest list" is the one found at publish time, this instance's relay first, then the outside
 * profile publish relays (lookupNewestReplaceable); none found, nothing is kept. The new list is created at least one
 * second after the newest, so it replaces it on every relay.
 *
 * It is written to this instance's relay first — a failed write sends it nowhere and says so — then to every relay the
 * new list names, every relay the previous list named (so none keeps an older list), and the relays this instance
 * publishes Assistant profiles to, each once, this instance's own left out; in local-only mode it stays here. Each relay
 * is reported in the profile publish's words (accepted | refused | unreachable | timeout, or skipped).
 *
 * Nothing calls this at Assistant creation.
 */

const { validateRelayListRequest, buildRelayListTags, parseRelayList } = require('../../lib/relay-list');

const HEX64 = /^[0-9a-f]{64}$/i;
const RELAY_LIST_KIND = 10002;

/** The subject of every sentence the report says (story 3 § Copy). */
const RELAY_LIST_SUBJECT = "Your Assistant's relay list";

const CODES = {
  NOT_SIGNED_IN: 'not-signed-in',
  NOT_A_RELAY_LIST: 'not-a-relay-list',
  NO_ASSISTANT: 'no-assistant',
};

/** The refusal words (story 3 § Copy). */
const WORDS = {
  [CODES.NOT_SIGNED_IN]: 'Sign in to have your Assistant publish its relay list.',
  [CODES.NOT_A_RELAY_LIST]: 'That is not a list of relay addresses.',
  [CODES.NO_ASSISTANT]: "You don't have a Tapestry Assistant on this instance yet.",
  failed: "Could not publish your Assistant's relay list",
};

// nostr-tools, lazily and resiliently, as src/api/assistant/identificationTaggings.js loads it.
let _nt = null;
function getNostrTools() {
  if (!_nt) {
    try { _nt = require('/usr/local/lib/node_modules/brainstorm/node_modules/nostr-tools'); }
    catch { _nt = require('nostr-tools'); }
  }
  return _nt;
}

/** The real dependencies, required lazily so the module loads in a bare checkout. */
function defaultDeps() {
  return {
    getAssistantKeys: (pubkey) => require('../../utils/assistantKeys').getAssistantKeys(pubkey),
    scanLocal: (filter) => require('../setup/status').scanLocalStrict(filter),
    readRelay: (url, filter) => require('../_shared/relaySource').readRelayEvents(url, filter),
    getConfiguredPublishRelays: () => require('./profilePublish').getConfiguredPublishRelays(),
    getConfigFromFile: (key, fallback) => require('../../utils/config').getConfigFromFile(key, fallback),
    lookupNewestReplaceable: (input, d) => require('./attention').lookupNewestReplaceable(input, d),
    outsideOnly: (urls, d) => require('../setup/status').outsideOnly(urls, d),
    privkeyBytesOf: (privkey) => require('./identificationTaggings').privkeyBytesOf(privkey),
    importEvent: (event) => require('./profileState').importToLocalRelay(event),
    isLocalOnly: () => require('../publish-policy').isPublishLocalOnly(),
    publishToRelays: (event, relays, options) => require('./profilePublish').publishToRelays(event, relays, options),
    finalizeEvent: (template, privkeyBytes) => getNostrTools().finalizeEvent(template, privkeyBytes),
    getPublicKey: (privkeyBytes) => getNostrTools().getPublicKey(privkeyBytes),
    now: () => Date.now(),
  };
}

/**
 * The whole flow after the session and body checks: whose key, the newest list, the build, the sign, the local write
 * and the fan-out. Answers { refusal } when the viewer has no Assistant here, else { result }.
 * @param {{ viewer: string, relays: string[] }} input - relays already validated and normalized
 */
async function publishAssistantRelayListFor({ viewer, relays }, deps = {}) {
  const d = { ...defaultDeps(), ...deps };

  const keys = await d.getAssistantKeys(viewer);
  if (!keys || !keys.privkey) return { refusal: { status: 403, code: CODES.NO_ASSISTANT } };
  const privkeyBytes = d.privkeyBytesOf(keys.privkey);
  const assistantPubkey = String(d.getPublicKey(privkeyBytes)).toLowerCase();

  const configured = d.getConfiguredPublishRelays();
  const lookup = await d.lookupNewestReplaceable({ kind: RELAY_LIST_KIND, author: assistantPubkey, relays: d.outsideOnly(configured, d) }, d);
  const newest = lookup && lookup.finished === true && lookup.event ? lookup.event : null;
  const previous = parseRelayList(newest).entries;

  const nowSeconds = Math.floor(d.now() / 1000);
  const createdAt = newest && Number.isFinite(newest.created_at) ? Math.max(nowSeconds, newest.created_at + 1) : nowSeconds;
  const template = { kind: RELAY_LIST_KIND, created_at: createdAt, tags: buildRelayListTags({ draft: relays, previous }), content: '' };
  const signed = d.finalizeEvent(template, privkeyBytes);
  const { outbox, entries } = parseRelayList(signed);

  const { summarizePublish, localFailureMessage } = require('./profilePublish');
  const localOnly = Boolean(d.isLocalOnly());

  // This instance's relay first (BIBLE §30). If it refuses the list, nothing goes outward.
  try {
    await d.importEvent(signed);
  } catch (err) {
    const reason = err && err.message ? err.message : String(err);
    return {
      result: {
        ok: false, stage: 'local', outcome: 'not-delivered', localOnly, outbox,
        message: localFailureMessage(RELAY_LIST_SUBJECT, reason),
        relays: { total: 0, success: 0, results: [] },
      },
    };
  }

  const set = d.outsideOnly([...entries.map((e) => e.url), ...previous.map((e) => e.url), ...configured], d);
  const rows = localOnly
    ? set.map((relay) => ({ relay, status: 'skipped', reason: 'local-only publish mode' }))
    : await d.publishToRelays(signed, set);
  const { outcome, message, accepted } = summarizePublish({ subject: RELAY_LIST_SUBJECT, rows, localOnly });
  return { result: { ok: true, outcome, message, localOnly, outbox, relays: { total: rows.length, success: accepted, results: rows } } };
}

/**
 * Every side effect behind one seam (the identification-tags route's way), so what this handler signs and sends where
 * can be tested without a key store, strfry or a relay.
 */
function createPublishRelayListHandler(deps = {}) {
  const d = { ...defaultDeps(), ...deps };

  return async function handlePublishRelayList(req, res) {
    const session = req && req.session;
    const viewer = session && session.authenticated === true && typeof session.pubkey === 'string' && HEX64.test(session.pubkey)
      ? session.pubkey.toLowerCase()
      : null;
    if (!viewer) return res.status(401).json({ success: false, code: CODES.NOT_SIGNED_IN, error: WORDS[CODES.NOT_SIGNED_IN] });

    const checked = validateRelayListRequest(req && req.body ? req.body.relays : undefined);
    if (!checked.ok) return res.status(400).json({ success: false, code: CODES.NOT_A_RELAY_LIST, error: WORDS[CODES.NOT_A_RELAY_LIST] });

    try {
      const out = await publishAssistantRelayListFor({ viewer, relays: checked.relays }, d);
      if (out.refusal) return res.status(out.refusal.status).json({ success: false, code: out.refusal.code, error: WORDS[out.refusal.code] });
      const { result } = out;
      console.log(`[assistant/outbox-relays] ${result.ok ? result.outcome : result.stage} — ${result.message}`);
      for (const r of result.relays.results) {
        if (r.status !== 'accepted') console.warn(`[assistant/outbox-relays] ${r.relay} — ${r.status}${r.reason ? `: ${r.reason}` : ''}`);
      }
      return res.json({ success: true, result });
    } catch (err) {
      console.error("[assistant/outbox-relays] could not publish the Assistant's relay list:", err && err.message ? err.message : err);
      return res.status(500).json({ success: false, error: WORDS.failed });
    }
  };
}

const handlePublishRelayList = createPublishRelayListHandler();

module.exports = {
  createPublishRelayListHandler,
  handlePublishRelayList,
  publishAssistantRelayListFor,
  RELAY_LIST_SUBJECT,
  CODES,
  WORDS,
};
