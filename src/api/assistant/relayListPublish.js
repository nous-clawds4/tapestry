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
 * Only public relays (ADR 0003 Amendment 1, review round 1): a request naming a relay that is plainly not on the public
 * internet — by src/utils/ssrfGuard.js's synchronous rule (isPublicAddress for an IP literal, hasPrivateHostSuffix for a
 * name) — is refused 400 before any key is read. At send time every relay that comes from a relay list (the new one and
 * the previous one) is resolved with isPublicRelayHostWithin — off the threadpool, within one 3 s lookup budget (ADR 0003
 * Amendment 2) — which needs every answer public and fails closed; one that fails
 * is never connected to and reads `not-sent: not a public address`. Relay Settings' own relays are owner-set and sent
 * to as every profile publish sends to them.
 *
 * Nothing calls this at Assistant creation.
 */

const net = require('net');
const { validateRelayListRequest, buildRelayListTags, parseRelayList, normalizeRelayUrl } = require('../../lib/relay-list');
const { isPublicAddress, hasPrivateHostSuffix } = require('../../utils/ssrfGuard');

const HEX64 = /^[0-9a-f]{64}$/i;
const RELAY_LIST_KIND = 10002;

/** The subject of every sentence the report says (story 3 § Copy). */
const RELAY_LIST_SUBJECT = "Your Assistant's relay list";

const CODES = {
  NOT_SIGNED_IN: 'not-signed-in',
  NOT_A_RELAY_LIST: 'not-a-relay-list',
  NO_ASSISTANT: 'no-assistant',
  NOT_A_PUBLIC_RELAY: 'not-a-public-relay',
};

/** A relay the server would not connect to: its row (ADR 0003 Amendment 1). */
const NOT_SENT = { status: 'not-sent', reason: 'not a public address' };

/** The refusal words (story 3 § Copy). */
const WORDS = {
  [CODES.NOT_SIGNED_IN]: 'Sign in to have your Assistant publish its relay list.',
  [CODES.NOT_A_RELAY_LIST]: 'That is not a list of relay addresses.',
  [CODES.NO_ASSISTANT]: "You don't have a Tapestry Assistant on this instance yet.",
  [CODES.NOT_A_PUBLIC_RELAY]: 'That relay is not on the public internet.',
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
    isPublicHostname: (host) => isPublicRelayHostWithin(host, { timeoutMs: LOOKUP_BUDGET_MS }),
  };
}

const hostOf = (url) => new URL(url).hostname;

/** The whole time the send-time lookups may take, from their start (ADR 0003 Amendment 2). */
const LOOKUP_BUDGET_MS = 3000;

/** Resolve within `ms` or give `fallback` — clearing the timer either way. */
async function within(promise, ms, fallback) {
  let timer;
  const late = new Promise((resolve) => { timer = setTimeout(() => resolve(fallback), Math.max(0, ms)); });
  try { return await Promise.race([promise, late]); } finally { clearTimeout(timer); }
}

/**
 * Does this relay host resolve to public addresses only? ssrfGuard's rule, off libuv's threadpool and within a time
 * limit (ADR 0003 Amendment 2): an IP literal is classified by isPublicAddress; a private-by-construction name is not
 * public; any other name is asked for its A and AAAA records through a c-ares Resolver ({ timeout, tries: 1 }, on the
 * event loop, not dns.lookup). Public only when both queries finished, at least one address came back, and every
 * address is public. A timeout, an error or an empty answer is not public; the resolver is cancelled at the limit.
 * @param {string} host - as URL gives it
 * @param {{ timeoutMs?: number, Resolver?: Function }} [options] - Resolver for tests; default dns.promises.Resolver
 * @returns {Promise<boolean>} never rejects
 */
async function isPublicRelayHostWithin(host, { timeoutMs = LOOKUP_BUDGET_MS, Resolver } = {}) {
  const name = String(host || '').trim().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!name) return false;
  if (net.isIP(name)) return isPublicAddress(name);
  if (hasPrivateHostSuffix(name)) return false;
  const ResolverClass = Resolver || require('dns').promises.Resolver;
  let resolver;
  try { resolver = new ResolverClass({ timeout: timeoutMs, tries: 1 }); } catch { return false; }
  // An answer with no records of that type (ENODATA, ENOTFOUND) is an empty list; anything else is a failure (null).
  const settle = (query) => Promise.resolve().then(query).then(
    (addresses) => (Array.isArray(addresses) ? addresses : null),
    (err) => (err && (err.code === 'ENODATA' || err.code === 'ENOTFOUND') ? [] : null),
  );
  const answers = await within(
    Promise.all([settle(() => resolver.resolve4(name)), settle(() => resolver.resolve6(name))]),
    timeoutMs,
    null,
  );
  if (!answers) {
    try { resolver.cancel(); } catch { /* going away either way */ }
    return false;
  }
  const [v4, v6] = answers;
  if (v4 === null || v6 === null) return false;
  const all = [...v4, ...v6];
  return all.length > 0 && all.every((address) => isPublicAddress(String(address)));
}

/** ssrfGuard's synchronous rule for one hostname: a non-public IP literal, or a private-by-construction name. */
function isPlainlyPrivate(hostname) {
  const bare = String(hostname || '').replace(/^\[|\]$/g, '');
  return net.isIP(bare) ? !isPublicAddress(bare) : hasPrivateHostSuffix(bare);
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
  let rows;
  if (localOnly) {
    rows = set.map((relay) => ({ relay, status: 'skipped', reason: 'local-only publish mode' }));
  } else {
    // Every relay that came from a relay list is resolved before it is connected to; the configured ones are owner-set.
    // All lookups share one budget; one that has not answered by then is not public (ADR 0003 Amendment 2).
    const owned = new Set(configured.map((url) => normalizeRelayUrl(url)).filter(Boolean));
    const deadline = Date.now() + LOOKUP_BUDGET_MS;
    const checks = await Promise.all(set.map(async (relay) => {
      if (owned.has(normalizeRelayUrl(relay))) return true;
      const lookup = Promise.resolve().then(() => d.isPublicHostname(hostOf(relay))).then((ok) => ok === true, () => false);
      return within(lookup, deadline - Date.now(), false);
    }));
    const toSend = set.filter((_, i) => checks[i]);
    const sent = toSend.length > 0 ? await d.publishToRelays(signed, toSend) : [];
    const byRelay = new Map((Array.isArray(sent) ? sent : []).map((row) => [row.relay, row]));
    rows = set.map((relay, i) => (checks[i] ? byRelay.get(relay) || { relay, status: 'unreachable', reason: 'no answer' } : { relay, ...NOT_SENT }));
  }
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
    if (checked.relays.some((relay) => isPlainlyPrivate(hostOf(relay)))) {
      return res.status(400).json({ success: false, code: CODES.NOT_A_PUBLIC_RELAY, error: WORDS[CODES.NOT_A_PUBLIC_RELAY] });
    }

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
  NOT_SENT,
  LOOKUP_BUDGET_MS,
  isPublicRelayHostWithin,
};
