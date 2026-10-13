'use strict';
/**
 * POST /api/assistant/duty-menu/publish — your Assistant signs its Duty Menu (assistant-duty-menu #2, ADR
 * assistant-duty-menu/0002).
 *
 * A narrow, session-bound route in the shape of the Outbox Relays publish (ADR assistant-outbox-relays/0003): the
 * signed-in person's own Assistant signs a Duty Menu (kind 39999, `d` = `duty-menu`, protocols/drafts/duty-menus.md
 * §§ 4–5). The request names nothing and its body is never read; whose Assistant signs comes from the SESSION (the one
 * main→delegate mapping: for the Owner the instance TA, for anyone else their own relay key). Refusals come first,
 * before any key is read: not signed in (401), no Assistant on this instance (403). The route signs a Duty Menu and
 * nothing else; the generic signer stays owner-or-admin and TA-only.
 *
 * The event (src/lib/duty-menu buildMenuTags): `d`, Nous' `z`, the one `p` (the Assistant), then one `duty` row per row
 * of the offer this instance computes for the viewer now (story 1's resolveOfferInputs + buildOffer), in its order.
 * Rows only; an empty offer publishes an empty menu (§ 11). It is dated at least one second after the newest version
 * found at publish time (story 1's local-first read), so it replaces that version everywhere. Before anything is
 * written, the signed event must be the Assistant's own and a Duty Menu by § 6.1.
 *
 * It is written to this instance's relay first — a failed write sends it nowhere and says so — then, each once and this
 * instance's own left out, to § 8.1's places: the relays its rows name (owner-set: Relay Settings or Assistant Duties, sent as such), and,
 * at most 50 in this order, the Assistant's write relays, the relays the found version's rows named, and Nous' write
 * relays. Each relay from an event is connected to only when the DNS guard (src/utils/relayHostGuard.js) finds its host
 * public within one 3 s budget; otherwise it reads `not-sent: not a public address`. In local-only mode it stays here.
 * Each relay is reported in the profile publish's words.
 *
 * Nothing calls this at Assistant creation or on a timer.
 */

const { normalizeRelayUrl, MAX_RELAYS } = require('../../lib/relay-list');
const { DUTY_MENU_KIND, buildMenuTags, buildOffer, isDutyMenu, readMenuRows } = require('../../lib/duty-menu');
const { isPublicRelayHostWithin, within, LOOKUP_BUDGET_MS } = require('../../utils/relayHostGuard');

const HEX64 = /^[0-9a-f]{64}$/i;

/** The subject of every sentence the report says (story 2 § Copy). */
const DUTY_MENU_SUBJECT = "Your Assistant's Duty Menu";

/** The summary when the menu was saved here and there was no other relay at all (ADR 0002 Amendment 2 item 3). */
const NOTHING_ELSE = `${DUTY_MENU_SUBJECT} was saved on this instance's relay. There was no other relay to send it to.`;

const CODES = {
  NOT_SIGNED_IN: 'not-signed-in',
  NO_ASSISTANT: 'no-assistant',
};

/** A relay the server would not connect to: its row (ADR assistant-outbox-relays/0003 Amendment 1). */
const NOT_SENT = { status: 'not-sent', reason: 'not a public address' };

/** The refusal words (story 2 § Copy). */
const WORDS = {
  [CODES.NOT_SIGNED_IN]: 'Sign in to have your Assistant publish its Duty Menu.',
  [CODES.NO_ASSISTANT]: "You don't have a Tapestry Assistant on this instance yet.",
  failed: "Could not publish your Assistant's Duty Menu",
};

// nostr-tools, lazily and resiliently, as the Outbox Relays publish loads it.
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
    privkeyBytesOf: (privkey) => require('./identificationTaggings').privkeyBytesOf(privkey),
    getPublicKey: (privkeyBytes) => getNostrTools().getPublicKey(privkeyBytes),
    finalizeEvent: (template, privkeyBytes) => getNostrTools().finalizeEvent(template, privkeyBytes),
    importEvent: (event) => require('./profileState').importToLocalRelay(event),
    isLocalOnly: () => require('../publish-policy').isPublishLocalOnly(),
    publishToRelays: (event, relays, options) => require('./profilePublish').publishToRelays(event, relays, options),
    isPublicHostname: (host) => isPublicRelayHostWithin(host, { timeoutMs: LOOKUP_BUDGET_MS }),
    now: () => Date.now(),
    // Story 1's pieces: the offer, the newest version (local first), and the write relays (ADR 0002 sub-decision 5).
    resolveOfferInputs: (viewer) => require('./dutyMenu').resolveOfferInputs(viewer),
    lookupPublishedMenu: (input) => require('./dutyMenu').lookupPublishedMenu(input),
    assistantWriteRelays: (input) => require('./dutyMenu').assistantWriteRelays(input),
    nousWriteRelays: (relays) => require('./dutyMenu').nousWriteRelays(relays),
    getConfiguredPublishRelays: () => require('./profilePublish').getConfiguredPublishRelays(),
    getConfigFromFile: (key, fallback) => require('../../utils/config').getConfigFromFile(key, fallback),
    outsideOnly: (urls, d) => require('../setup/status').outsideOnly(urls, d),
  };
}

const hostOf = (url) => new URL(url).hostname;

/** A relay lookup's answer, or none when it failed: a missing relay list only shrinks the set. */
const orNone = (fn) => Promise.resolve().then(fn).then((list) => (Array.isArray(list) ? list : []), () => []);

/**
 * The whole flow after the session check: whose key, the offer, the newest version, the build, the sign, the author
 * check, the local write and the fan-out. Answers { refusal } when the viewer has no Assistant here, else { result }.
 * @param {{ viewer: string }} input - the session's viewer, lower-case hex
 */
async function publishDutyMenuFor({ viewer }, deps = {}) {
  const d = { ...defaultDeps(), ...deps };

  const keys = await d.getAssistantKeys(viewer);
  if (!keys || !keys.privkey) return { refusal: { status: 403, code: CODES.NO_ASSISTANT } };
  const privkeyBytes = d.privkeyBytesOf(keys.privkey);
  const assistantPubkey = String(d.getPublicKey(privkeyBytes)).toLowerCase();

  // The offer as the check computes it, at this moment's settings; nothing in the request reaches it.
  const offer = buildOffer(await d.resolveOfferInputs(viewer));
  const lookup = await d.lookupPublishedMenu({ assistantPubkey, viewer, offer });
  const latest = lookup && lookup.latest ? lookup.latest : null;

  const nowSeconds = Math.floor(d.now() / 1000);
  const createdAt = latest && Number.isFinite(latest.created_at) ? Math.max(nowSeconds, latest.created_at + 1) : nowSeconds;
  const template = { kind: DUTY_MENU_KIND, created_at: createdAt, tags: buildMenuTags({ assistantPubkey, offer }), content: '' };
  const signed = d.finalizeEvent(template, privkeyBytes);

  // The author check (sub-decision 3): the Assistant's own event, and a Duty Menu by § 6.1, or nothing is written.
  if (!signed || String(signed.pubkey || '').toLowerCase() !== assistantPubkey || !isDutyMenu(signed, signed.pubkey)) {
    throw new Error("the signed event is not this Assistant's Duty Menu");
  }
  const rowRelays = signed.tags.filter((t) => t[0] === 'duty').map((t) => t[2]);
  const duties = rowRelays.length;

  const { summarizePublish, localFailureMessage } = require('./profilePublish');
  const localOnly = Boolean(d.isLocalOnly());

  // This instance's relay first (BIBLE §30). If it refuses the menu, nothing goes outward.
  try {
    await d.importEvent(signed);
  } catch (err) {
    const reason = err && err.message ? err.message : String(err);
    return {
      result: {
        ok: false, stage: 'local', outcome: 'not-delivered', localOnly, duties,
        message: localFailureMessage(DUTY_MENU_SUBJECT, reason),
        relays: { total: 0, success: 0, results: [] },
      },
    };
  }

  // § 8.1's places. The new rows' relays are owner-set (Relay Settings or Assistant Duties); the rest come from events:
  // the Assistant's write relays, the found version's rows (read even when it is not a menu), then Nous', capped at
  // MAX_RELAYS once de-duplicated against each other and the configured ones.
  const configured = d.outsideOnly(rowRelays, d);
  const owned = new Set(configured.map((url) => normalizeRelayUrl(url)));
  const [assistantWrite, nousWrite] = await Promise.all([
    orNone(() => d.assistantWriteRelays({ assistantPubkey })),
    orNone(() => d.nousWriteRelays(d.outsideOnly(d.getConfiguredPublishRelays(), d))),
  ]);
  const earlier = readMenuRows(latest).filter((row) => row.tag === 'duty').map((row) => row.relay);
  const named = d.outsideOnly([...assistantWrite, ...earlier, ...nousWrite].map(normalizeRelayUrl).filter(Boolean), d)
    .filter((url) => !owned.has(url))
    .slice(0, MAX_RELAYS);
  const set = [...configured, ...named];

  let rows;
  if (localOnly) {
    rows = set.map((relay) => ({ relay, status: 'skipped', reason: 'local-only publish mode' }));
  } else {
    // Every relay from an event is resolved before it is connected to; all lookups share one budget, and one that has
    // not answered by then is not public (ADR assistant-outbox-relays/0003 Amendment 2).
    const deadline = Date.now() + LOOKUP_BUDGET_MS;
    const checks = await Promise.all(set.map(async (relay, i) => {
      if (i < configured.length) return true;
      const guard = Promise.resolve().then(() => d.isPublicHostname(hostOf(relay))).then((ok) => ok === true, () => false);
      return within(guard, deadline - Date.now(), false);
    }));
    const toSend = set.filter((_, i) => checks[i]);
    const sent = toSend.length > 0 ? await d.publishToRelays(signed, toSend) : [];
    const byRelay = new Map((Array.isArray(sent) ? sent : []).map((row) => [row.relay, row]));
    rows = set.map((relay, i) => (checks[i] ? byRelay.get(relay) || { relay, status: 'unreachable', reason: 'no answer' } : { relay, ...NOT_SENT }));
  }
  const summary = summarizePublish({ subject: DUTY_MENU_SUBJECT, rows, localOnly });
  // No relay at all, before the guard: the shared sentence would blame unconfigured profile relays (Amendment 2 item 3).
  const message = !localOnly && set.length === 0 ? NOTHING_ELSE : summary.message;
  return { result: { ok: true, outcome: summary.outcome, message, localOnly, duties, relays: { total: rows.length, success: summary.accepted, results: rows } } };
}

/**
 * Every side effect behind one seam (the Outbox Relays publish's way), so what this handler signs and sends where can
 * be tested without a key store, strfry or a relay.
 */
function createPublishDutyMenuHandler(deps = {}) {
  const d = { ...defaultDeps(), ...deps };

  return async function handlePublishDutyMenu(req, res) {
    const session = req && req.session;
    const viewer = session && session.authenticated === true && typeof session.pubkey === 'string' && HEX64.test(session.pubkey)
      ? session.pubkey.toLowerCase()
      : null;
    if (!viewer) return res.status(401).json({ success: false, code: CODES.NOT_SIGNED_IN, error: WORDS[CODES.NOT_SIGNED_IN] });

    try {
      const out = await publishDutyMenuFor({ viewer }, d);
      if (out.refusal) return res.status(out.refusal.status).json({ success: false, code: out.refusal.code, error: WORDS[out.refusal.code] });
      const { result } = out;
      console.log(`[assistant/duty-menu] ${result.ok ? result.outcome : result.stage} — ${result.message}`);
      for (const r of result.relays.results) {
        if (r.status !== 'accepted') console.warn(`[assistant/duty-menu] ${r.relay} — ${r.status}${r.reason ? `: ${r.reason}` : ''}`);
      }
      return res.json({ success: true, result });
    } catch (err) {
      console.error("[assistant/duty-menu] could not publish the Assistant's Duty Menu:", err && err.message ? err.message : err);
      return res.status(500).json({ success: false, error: WORDS.failed });
    }
  };
}

const handlePublishDutyMenu = createPublishDutyMenuHandler();

module.exports = {
  createPublishDutyMenuHandler,
  handlePublishDutyMenu,
  publishDutyMenuFor,
  DUTY_MENU_SUBJECT,
  CODES,
  WORDS,
};
