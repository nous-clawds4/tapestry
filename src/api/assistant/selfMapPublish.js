'use strict';
/**
 * POST /api/assistant/self-map — your Assistant turns its self-Map on or off (assistant-self-map #2, ADR
 * assistant-self-map/0002 sub-decisions 5 and 6).
 *
 * A narrow, session-bound route in the Duty Menu publish's shape (ADR assistant-duty-menu/0002). The body is one bit,
 * `{ "on": true | false }`; Turn on and Update now are both `on`. Whose Assistant comes from the SESSION (for the Owner
 * the instance TA, for anyone else their own relay key), and nothing in the request can name another, choose an entry
 * or pick a relay. Refusals come first: not signed in (401), a body whose `on` is not a boolean (400), no Assistant here
 * (403, before any key is read past the lookup).
 *
 * A press, one at a time per Assistant (withAssistantLock, so no two versions share a created_at; story 3's automation
 * goes through the same lock):
 *  1. Reads what it needs, strictly (selfMap.js gatherSelfMap / lookupSelfMap with forWrite): for `on` the whole check,
 *     for `off` only the Assistant's kind 10040. The copy of the newest version a press has seen or signed
 *     (selfMapChoice.js readSelfMapCopy, ADR 0002 Amendment 3), once it checks as the Assistant's own validly signed
 *     kind 10040, counts as a version here. If a read does not finish, or the version found is not the Assistant's own
 *     validly signed kind 10040, it answers 503 not-read and changes nothing. The version found then becomes the copy
 *     when it is newer.
 *  2. Remembers the choice (selfMapChoice.js), before anything is published, so an accepted press holds even if a relay
 *     refuses. The publish policy is read just before, so nothing that fails on configuration follows the write.
 *  3. Publishes nothing when the self-entries found already are the target (what the self-Map should say, or none) and,
 *     for a target that is not empty, no expiration or other owned tag sits beside them (ADR 0002 Amendment 1 item 2).
 *  4. Otherwise builds the next version with the library's merge (buildSelfMapEvent): only the self-entries change;
 *     every other tag and the content stay as found, an expiration going only beside a self-entry. It signs it and
 *     checks the result, kept tags and content included, before anything is written, and keeps it as the copy. A
 *     removal retracts nothing (ADR duty-menus-and-self-maps/0005 sub-decision 2: no stop).
 *  5. Writes it to this instance's relay first (a failure sends it nowhere), then, each once, to Finding a self-Map's
 *     places (§ 9.2): the relays the new self-entries name (owner-set, sent as such), and, at most 50 and each
 *     DNS-guarded, the Assistant's write relays and the relays the found version's self-entries named, so a removal
 *     reaches every relay that held the claim. Local-only mode keeps it here.
 *
 * Nothing calls this at Assistant creation or on a timer.
 */

const { normalizeRelayUrl, MAX_RELAYS } = require('../../lib/relay-list');
const { buildOffer } = require('../../lib/duty-menu');
const { SELF_MAP_KIND, readSelfEntries, sameSelfEntries, ownsTag, keptTags, buildSelfMapEvent } = require('../../lib/self-map');
const { isPublicRelayHostWithin, within, LOOKUP_BUDGET_MS } = require('../../utils/relayHostGuard');

const HEX64 = /^[0-9a-f]{64}$/i;
const TREASURE_MAP_KIND = 10040;

/** The subject of every sentence the report says (story 2 § Copy). */
const SELF_MAP_SUBJECT = "Your Assistant's self-Map";

/** The summary when it was saved here and there was no other relay at all (as the Duty Menu publish's). */
const NOTHING_ELSE = `${SELF_MAP_SUBJECT} was saved on this instance's relay. There was no other relay to send it to.`;

const CODES = {
  NOT_SIGNED_IN: 'not-signed-in',
  BAD_REQUEST: 'bad-request',
  NO_ASSISTANT: 'no-assistant',
  NOT_READ: 'not-read',
};

/** The refusal words (story 2 § Copy). A bad request and a throw read as a request that failed. */
const WORDS = {
  [CODES.NOT_SIGNED_IN]: "Sign in to change your Assistant's self-Map.",
  [CODES.NO_ASSISTANT]: "You don't have a Tapestry Assistant on this instance yet.",
  [CODES.NOT_READ]: "Nothing was published: your Assistant's current Treasure Map could not be read, and publishing without it could lose its other entries.",
  [CODES.BAD_REQUEST]: 'This instance did not answer; nothing was published.',
  failed: 'This instance did not answer; nothing was published.',
};

/** When a press published nothing (story 2 § Copy; ADR 0002 sub-decision 6 step 4). */
const UNCHANGED = {
  'nothing-to-claim': "Your Assistant's self-Map is on. Nothing is live to claim yet, so nothing was published.",
  'already-current': "Your Assistant's self-Map is on, and it already says what is live now, so nothing was published.",
  'nothing-claimed': "Your Assistant's self-Map is off. It claimed nothing, so nothing was published.",
};

/** A relay the server would not connect to: its row (ADR assistant-outbox-relays/0003 Amendment 1). */
const NOT_SENT = { status: 'not-sent', reason: 'not a public address' };

// nostr-tools, lazily and resiliently, as the Duty Menu publish loads it.
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
    verifyEvent: (event) => getNostrTools().verifyEvent(event),
    importEvent: (event) => require('./profileState').importToLocalRelay(event),
    isLocalOnly: () => require('../publish-policy').isPublishLocalOnly(),
    publishToRelays: (event, relays, options) => require('./profilePublish').publishToRelays(event, relays, options),
    isPublicHostname: (host) => isPublicRelayHostWithin(host, { timeoutMs: LOOKUP_BUDGET_MS }),
    now: () => Date.now(),
    writeSelfMapChoice: (pubkey, on, nowSeconds) => require('./selfMapChoice').writeSelfMapChoice(pubkey, on, nowSeconds),
    // The copy of the newest version a press has seen or signed (ADR 0002 Amendment 3 item 1).
    readSelfMapCopy: (pubkey) => require('./selfMapChoice').readSelfMapCopy(pubkey),
    writeSelfMapCopy: (pubkey, event) => require('./selfMapChoice').writeSelfMapCopy(pubkey, event),
    // Story 1's reads: the whole check, the self-Map lookup, the viewer's Map, the offer, the write relays.
    gatherSelfMap: (input) => require('./selfMap').gatherSelfMap(input),
    lookupSelfMap: (input) => require('./selfMap').lookupSelfMap(input),
    lookupViewerMap: (viewer) => {
      const status = require('../setup/status');
      const d = {
        scanLocal: status.scanLocalStrict,
        readRelay: (url, filter) => require('../_shared/relaySource').readRelayEvents(url, filter),
        getConfigFromFile: (key, fallback) => require('../../utils/config').getConfigFromFile(key, fallback),
        mapDefaultRelays: () => require('../export/nip85/currentMap').defaultRelays(),
      };
      return status.lookupNewest({ kind: TREASURE_MAP_KIND, pubkey: viewer, relays: status.treasureMapRelays(d) }, d);
    },
    resolveOfferInputs: (viewer) => require('./dutyMenu').resolveOfferInputs(viewer),
    assistantWriteRelays: (input) => require('./dutyMenu').assistantWriteRelays(input),
    getConfigFromFile: (key, fallback) => require('../../utils/config').getConfigFromFile(key, fallback),
    outsideOnly: (urls, d) => require('../setup/status').outsideOnly(urls, d),
  };
}

// One press at a time per Assistant, in arrival order: a promise chain per key, dropped once it drains.
const locks = new Map();

/**
 * Run `task` after every earlier task for this Assistant has settled (ADR 0002 sub-decision 6). Its answer, or its
 * rejection, passes through; a rejection never blocks the next task. Story 3's automation goes through this too.
 * @param {string} assistantPubkey
 * @param {() => Promise<*>} task
 */
function withAssistantLock(assistantPubkey, task) {
  const key = String(assistantPubkey || '').toLowerCase();
  const run = (locks.get(key) || Promise.resolve()).then(() => task());
  const settled = run.then(() => {}, () => {});
  locks.set(key, settled);
  settled.then(() => { if (locks.get(key) === settled) locks.delete(key); });
  return run;
}

const hostOf = (url) => new URL(url).hostname;

/** A relay lookup's answer, or none when it failed: a missing relay list only shrinks the set. */
const orNone = (fn) => Promise.resolve().then(fn).then((list) => (Array.isArray(list) ? list : []), () => []);

const notRead = () => ({ refusal: { status: 503, code: CODES.NOT_READ } });

/**
 * The press's copy (ADR 0002 Amendment 3 item 1), only when it is the Assistant's own validly signed kind 10040; else
 * null, with a line in the log when one was there but failed. A copy that cannot be read is no copy.
 */
async function checkedCopy(A, d) {
  let copy = null;
  try { copy = await d.readSelfMapCopy(A); } catch { copy = null; }
  if (!copy) return null;
  let ok = false;
  try { ok = copy.kind === SELF_MAP_KIND && String(copy.pubkey || '').toLowerCase() === A && d.verifyEvent(copy) === true; } catch { ok = false; }
  if (!ok) console.warn("[assistant/self-map] the kept copy is not this Assistant's validly signed kind 10040; it is left out");
  return ok ? copy : null;
}

/**
 * One press for one Assistant, inside its lock (ADR 0002 sub-decision 6). Answers { refusal } or { result }.
 * @param {{ viewer: string, assistantPubkey: string, privkeyBytes: Uint8Array, on: boolean }} input
 */
async function applySelfMap({ viewer, assistantPubkey, privkeyBytes, on }, deps = {}) {
  const d = { ...defaultDeps(), ...deps };
  const A = String(assistantPubkey || '').toLowerCase();

  // 1. Read, strictly. Turning on needs what the self-Map should say; turning off needs only the current version. The
  // copy counts as a version here once it checks as the Assistant's own (Amendment 3 item 1); one that fails is left out.
  const stored = await checkedCopy(A, d);
  let target;
  let lookup;
  if (on) {
    const gathered = await d.gatherSelfMap({ viewer, assistantPubkey: A, forWrite: true, stored });
    if (!gathered || !gathered.answer || gathered.answer.finished !== true || !gathered.lookup || gathered.lookup.finished !== true) return notRead();
    target = Array.isArray(gathered.answer.shouldSay) ? gathered.answer.shouldSay : [];
    lookup = gathered.lookup;
  } else {
    const map = await Promise.resolve().then(() => d.lookupViewerMap(viewer)).catch(() => null);
    const mapEvent = map && map.finished === true ? map.event || null : null; // for relay hints only
    const offer = buildOffer(await d.resolveOfferInputs(viewer));
    lookup = await d.lookupSelfMap({ assistantPubkey: A, mapEvent, offer, forWrite: true, stored });
    if (!lookup || lookup.finished !== true) return notRead();
    target = [];
  }
  const latest = lookup.latest || null;
  if (latest) {
    // The base must be the Assistant's own, validly signed: the merge carries its other tags into what A signs.
    let verified = false;
    try { verified = latest.kind === SELF_MAP_KIND && String(latest.pubkey || '').toLowerCase() === A && d.verifyEvent(latest) === true; } catch { verified = false; }
    if (!verified) return notRead();
    // Keep what was found, before the choice: the copy keeps the newer of the two (Amendment 3 item 1).
    await d.writeSelfMapCopy(A, latest);
  }

  // 2. Remember the choice, before anything is published. The publish policy is read first, so nothing that can fail on
  // configuration runs after the write (Amendment 1 item 3).
  const localOnly = Boolean(d.isLocalOnly());
  const nowSeconds = Math.floor(d.now() / 1000);
  await d.writeSelfMapChoice(A, on, nowSeconds);

  // 3. Nothing to change: the self-entries found are the target, and, when the target is not empty, nothing stale sits
  // beside them, no expiration and no other owned tag (Amendment 1 item 2).
  const found = latest ? readSelfEntries(latest, A).selfEntries : [];
  const baseTags = latest && Array.isArray(latest.tags) ? latest.tags : [];
  const stale = target.length > 0
    && (baseTags.some((t) => Array.isArray(t) && t[0] === 'expiration') || baseTags.filter((t) => ownsTag(t, A)).length !== found.length);
  if (sameSelfEntries(target, found) && !stale) {
    const unchanged = on ? (target.length > 0 ? 'already-current' : 'nothing-to-claim') : 'nothing-claimed';
    return { result: { ok: true, on, published: false, unchanged, message: UNCHANGED[unchanged], localOnly, relays: { total: 0, success: 0, results: [] } } };
  }

  // 4. Build, sign, and check what was signed before anything is written.
  const template = buildSelfMapEvent({ latest, author: A, selfEntries: target, nowSeconds });
  const signed = d.finalizeEvent(template, privkeyBytes);
  const ownedCount = (signed && Array.isArray(signed.tags) ? signed.tags : []).filter((t) => ownsTag(t, A)).length;
  const keptSame = signed && JSON.stringify(keptTags(signed, A)) === JSON.stringify(keptTags(latest, A, { dropExpiration: target.length > 0 }));
  if (!signed || String(signed.pubkey || '').toLowerCase() !== A || signed.kind !== SELF_MAP_KIND
    || !sameSelfEntries(readSelfEntries(signed, A).selfEntries, target) || ownedCount !== target.length
    || !keptSame || signed.content !== template.content) {
    throw new Error("the signed event is not this Assistant's self-Map built from the version found");
  }

  // Keep what is signed, before this instance's relay stores it (Amendment 3 item 1): a later press after a wipe builds
  // on it. A failed import leaves a copy never stored anywhere, which carries its base's other tags and content.
  await d.writeSelfMapCopy(A, signed);

  const { summarizePublish, localFailureMessage } = require('./profilePublish');

  // 5. This instance's relay first (BIBLE §30). If it refuses the version, nothing goes outward.
  try {
    await d.importEvent(signed);
  } catch (err) {
    const reason = err && err.message ? err.message : String(err);
    return {
      result: {
        ok: false, stage: 'local', outcome: 'not-delivered', on, published: false, localOnly, selfEntries: target.length,
        message: localFailureMessage(SELF_MAP_SUBJECT, reason),
        relays: { total: 0, success: 0, results: [] },
      },
    };
  }

  // Finding a self-Map's places (§ 9.2). The new self-entries' relays come from the offer (owner-set); the rest come
  // from events: the Assistant's write relays, then the relays the found version's self-entries named.
  const configured = d.outsideOnly(target.map((e) => e.relay), d);
  const owned = new Set(configured.map((url) => normalizeRelayUrl(url)));
  const assistantWrite = await orNone(() => d.assistantWriteRelays({ assistantPubkey: A }));
  const earlier = found.map((e) => e.relay).filter(Boolean);
  const named = d.outsideOnly([...assistantWrite, ...earlier].map(normalizeRelayUrl).filter(Boolean), d)
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
  const summary = summarizePublish({ subject: SELF_MAP_SUBJECT, rows, localOnly });
  // No relay at all: the shared sentence would blame unconfigured profile relays (as the Duty Menu publish).
  const message = !localOnly && set.length === 0 ? NOTHING_ELSE : summary.message;
  return {
    result: {
      ok: true, on, published: true, outcome: summary.outcome, message, localOnly, selfEntries: target.length,
      relays: { total: rows.length, success: summary.accepted, results: rows },
    },
  };
}

/**
 * The press after the session and body checks: whose key, then applySelfMap inside the Assistant's lock. Answers
 * { refusal } or { result }.
 * @param {{ viewer: string, on: boolean }} input - the session's viewer, lower-case hex
 */
async function setSelfMapFor({ viewer, on }, deps = {}) {
  const d = { ...defaultDeps(), ...deps };
  const keys = await d.getAssistantKeys(viewer);
  if (!keys || !keys.privkey) return { refusal: { status: 403, code: CODES.NO_ASSISTANT } };
  const privkeyBytes = d.privkeyBytesOf(keys.privkey);
  const assistantPubkey = String(d.getPublicKey(privkeyBytes)).toLowerCase();
  return withAssistantLock(assistantPubkey, () => applySelfMap({ viewer, assistantPubkey, privkeyBytes, on }, d));
}

/**
 * Every side effect behind one seam (the Duty Menu publish's way), so what this handler reads, signs and sends where
 * can be tested without a key store, strfry or a relay.
 */
function createSelfMapHandler(deps = {}) {
  const d = { ...defaultDeps(), ...deps };

  return async function handleSelfMap(req, res) {
    const session = req && req.session;
    const viewer = session && session.authenticated === true && typeof session.pubkey === 'string' && HEX64.test(session.pubkey)
      ? session.pubkey.toLowerCase()
      : null;
    if (!viewer) return res.status(401).json({ success: false, code: CODES.NOT_SIGNED_IN, error: WORDS[CODES.NOT_SIGNED_IN] });

    const body = req && req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.on !== 'boolean') {
      return res.status(400).json({ success: false, code: CODES.BAD_REQUEST, error: WORDS[CODES.BAD_REQUEST] });
    }

    try {
      const out = await setSelfMapFor({ viewer, on: body.on }, d);
      if (out.refusal) return res.status(out.refusal.status).json({ success: false, code: out.refusal.code, error: WORDS[out.refusal.code] });
      const { result } = out;
      console.log(`[assistant/self-map] ${result.on ? 'on' : 'off'}: ${result.ok ? (result.published ? result.outcome : result.unchanged) : result.stage} — ${result.message}`);
      for (const r of result.relays.results) {
        if (r.status !== 'accepted') console.warn(`[assistant/self-map] ${r.relay} — ${r.status}${r.reason ? `: ${r.reason}` : ''}`);
      }
      return res.json({ success: true, result });
    } catch (err) {
      console.error("[assistant/self-map] could not change the Assistant's self-Map:", err && err.message ? err.message : err);
      return res.status(500).json({ success: false, error: WORDS.failed });
    }
  };
}

const handleSelfMap = createSelfMapHandler();

module.exports = {
  createSelfMapHandler,
  handleSelfMap,
  setSelfMapFor,
  applySelfMap,
  withAssistantLock,
  SELF_MAP_SUBJECT,
  CODES,
  WORDS,
};
