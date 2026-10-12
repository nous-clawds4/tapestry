'use strict';
/**
 * assistant-duty-menu #2: your Assistant publishes its Duty Menu — the narrow route, and the DNS guard's shared home.
 *
 * Story: engineering-team/stories/assistant-duty-menu/2-your-assistant-publishes-its-duty-menu.md
 * ADR:   engineering-team/decisions/assistant-duty-menu/0002-the-assistant-signs-its-duty-menu-through-one-narrow-route.md
 * Plan:  engineering-team/stories/assistant-duty-menu/2-your-assistant-publishes-its-duty-menu.test-plan.md
 * Other halves: test/assistant-duty-menu-check.test.js (buildMenuTags, the local-first read, `latest`),
 * test/assistant-duty-menu-page.test.js (the button, the report, the client helper), and
 * tests/brainstorm/assistant-duty-menu.spec.js (B12–B16). Words: test/helpers/dutyMenuFixtures.js (PUBLISH).
 *
 * Classes (all stack-free; events are really signed and verified with nostr-tools):
 *   P — the handler's refusals and whose key: src/api/assistant/dutyMenuPublish.js through the seams ADR 0002's
 *       Implementation notes name (getAssistantKeys, finalizeEvent, importEvent, isLocalOnly, publishToRelays,
 *       isPublicHostname, now, resolveOfferInputs, lookupPublishedMenu, assistantWriteRelays, nousWriteRelays,
 *       getConfiguredPublishRelays, outsideOnly).                                                       [AC-2]
 *   E — the event: its tags, § 6.1, an empty menu, created_at, the author check, and the menu read back by story 1's
 *       check (real story-1 functions over low-level fakes).                                             [AC-3]
 *   W — where it goes: local first, the set, the guard and its budget, the cap, local-only, the answer.  [AC-4]
 *   G — the DNS guard's shared home, src/utils/relayHostGuard.js (sub-decision 6).                       [AC-4]
 *   S — sentinels: the route registered, no other caller, nothing automatic, the guard's source, the docs.
 *                                                                                                [AC-2, AC-4]
 *
 * ADR 0002 Amendment 2: the route table opens the route to a signed-in person (S6; S2 allows routeAccess.js to name it),
 * and an empty send set has its own sentence (W11).
 *
 * duty-menu-public-relay #1 (Light Bug lane): on Docker the offer's relay is derived from STRFRY_DOMAIN, and that
 * address is still this instance: never sent to as an outside relay (W12, AC-4), while the signed rows name it (W13).
 *
 * Everything FAILS against the current code: src/api/assistant/dutyMenuPublish.js and src/utils/relayHostGuard.js do
 * not exist, the route is not registered, and dutyMenu.js exports no write-relay helpers.
 */

const fs = require('fs');
const path = require('path');
const DM = require('./helpers/dutyMenuFixtures');

const REPO = path.resolve(__dirname, '..');
const MODULE = path.join(REPO, 'src/api/assistant/dutyMenuPublish.js');
const CHECK = path.join(REPO, 'src/api/assistant/dutyMenu.js');
const GUARD = path.join(REPO, 'src/utils/relayHostGuard.js');
const RELAY_LIST_PUBLISH = path.join(REPO, 'src/api/assistant/relayListPublish.js');
const LIB = path.join(REPO, 'src/lib/duty-menu/index.js');
const ATTENTION = path.join(REPO, 'src/api/assistant/attention.js');
const API_INDEX = path.join(REPO, 'src/api/index.js');
const OPENAPI = path.join(REPO, 'src/api/openapi.yaml');
const BIBLE = path.join(REPO, 'BIBLE.md');
const GENERIC_SIGNER = path.join(REPO, 'src/api/strfry/commands/publishEvent.js');
const CLIENT_UTIL = path.join(REPO, 'ui/src/utils/publishAssistantDutyMenu.js');
const ROUTE_ACCESS = path.join(REPO, 'src/middleware/routeAccess.js');
const NL = String.fromCharCode(10);

const VIEWER = 'f1'.repeat(32);
const OWNER_VIEWER = 'f0'.repeat(32);
const OTHER = 'f3'.repeat(32);
const NOW_MS = 1_760_000_000_000;
/** No handler call in this suite may take longer than this: the 8 s relay budget plus the 3 s DNS budget, and slack. */
const HANDLER_LIMIT_MS = 15000;
/** The console as it was at load: what every quieted call restores, even after an overlapping one. */
const CONSOLE = { log: console.log, warn: console.warn, error: console.error };
const restoreConsole = () => { console.log = CONSOLE.log; console.warn = CONSOLE.warn; console.error = CONSOLE.error; };
const NOW_S = Math.floor(NOW_MS / 1000);

// This instance's relay, and outside relays by where they come from.
const OWN = DM.OWN; // 'wss://tapestry.example/relay'
const OWN_DOMAIN = 'tapestry.example';
const PUB1 = 'wss://pub-one.example';   // the profile publish set: where relay lists are read, never a send target here
const DLIST = 'wss://dlist.example';    // a Relay Settings DList relay: a configured row relay
const A1 = 'wss://a-one.example';       // the Assistant's write relays
const A2 = 'wss://a-two.example';
const OLD1 = 'wss://old-one.example';   // the rows of the menu found at publish time
const OLD2 = 'wss://old-two.example';
const N1 = 'wss://nous-one.example';    // Nous' write relays

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
const show = (v) => JSON.stringify(v);
const rel = (p) => path.relative(REPO, p);
const sameJson = (a, b) => show(a) === show(b);
const sameSet = (a, b) => sameJson([...a].sort(), [...b].sort());
const hostOf = (url) => new URL(url).hostname;
function codeOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
    .split(NL)
    .map((line) => line.replace(/(^|[^:'"`\\])\/\/.*$/, '$1'))
    .join(NL);
}

const nt = () => require('nostr-tools');
let idSeq = 0;
const hexId = (n) => n.toString(16).padStart(64, '0');
/** An event as the lookup found it: any validity (sub-decision 4 reads its rows even when it is not a menu). */
function foundMenu(author, { createdAt = NOW_S - 100, rows = [], z = [DM.DUTY_MENU_HEADER], p } = {}) {
  idSeq += 1;
  const tags = [['d', DM.DUTY_MENU_D], ...z.map((v) => ['z', v]), ...(p === undefined ? [author] : p).map((v) => ['p', v]), ...rows];
  return { id: hexId(7000 + idSeq), pubkey: author, kind: DM.DUTY_MENU_KIND, created_at: createdAt, tags, content: '', sig: '0'.repeat(128) };
}
function matching(events, filter) {
  const kinds = Array.isArray(filter && filter.kinds) ? filter.kinds : null;
  const authors = Array.isArray(filter && filter.authors) ? filter.authors.map((a) => String(a).toLowerCase()) : null;
  const ds = Array.isArray(filter && filter['#d']) ? filter['#d'] : null;
  const dOf = (e) => ((e.tags || []).find((t) => t[0] === 'd') || [])[1];
  return events.filter((e) => (!kinds || kinds.includes(e.kind)) && (!authors || authors.includes(String(e.pubkey).toLowerCase())) && (!ds || ds.includes(dOf(e))));
}

function load(abs, what) {
  if (!fs.existsSync(abs)) throw new Error(`${rel(abs)} does not exist. ${what}`);
  delete require.cache[require.resolve(abs)];
  return require(abs);
}
const publishModule = () => load(MODULE, 'ADR 0002 sub-decision 1 creates it: createPublishDutyMenuHandler, handlePublishDutyMenu, publishDutyMenuFor, DUTY_MENU_SUBJECT, CODES, WORDS.');
const guardModule = () => load(GUARD, 'ADR 0002 sub-decision 6 moves isPublicRelayHostWithin, within and LOOKUP_BUDGET_MS there.');
function need(mod, name, file) {
  assert(typeof mod[name] === 'function', `${file} must export ${name}() (ADR 0002 § Implementation notes).`);
  return mod[name];
}
const realOutsideOnly = (urls, d) => require('../src/api/setup/status').outsideOnly(urls, d);
const CONFIG = { BRAINSTORM_RELAY_URL: OWN, STRFRY_DOMAIN: OWN_DOMAIN };

/**
 * The route's seams, under the names ADR 0002 gives them; every one RECORDS its calls, and `order` the local write and
 * the fan-out in sequence. The story-1 functions are fakes here (the E8/W10 tests run the real ones).
 *   assistant  — null: no Assistant here; otherwise each viewer gets its own generated key.
 *   inputs     — what resolveOfferInputs answers; default { ownRelay: OWN, dlistRelay: null, scores: true }.
 *   latest     — the newest version lookupPublishedMenu found (any validity), or null.
 *   aWrite     — the Assistant's write relays; nous — Nous' write relays ([] = its list not found).
 *   localFails — the local write throws. localOnly — local-only mode. rows — publishToRelays' answer.
 *   notPublic / hangHosts — hosts isPublicHostname refuses / never answers for.
 *   finalizeEvent — replaces the signer (the author check's tests).
 */
function fakes(opts = {}) {
  const keys = new Map();
  const keyFor = (viewer) => {
    if (!keys.has(viewer)) { const sk = nt().generateSecretKey(); keys.set(viewer, { sk, pubkey: nt().getPublicKey(sk) }); }
    return keys.get(viewer);
  };
  const calls = {
    getAssistantKeys: [], resolveOfferInputs: [], lookupPublishedMenu: [], assistantWriteRelays: [], nousWriteRelays: [],
    finalizeEvent: [], importEvent: [], publishToRelays: [], isPublicHostname: [], order: [],
  };
  const deps = {
    getAssistantKeys: async (viewer) => {
      calls.getAssistantKeys.push(viewer);
      if (opts.throwOn === 'getAssistantKeys') throw new Error('fixture: the key store exploded');
      if (opts.assistant === null) return null;
      const k = keyFor(viewer);
      return { pubkey: k.pubkey, privkey: Buffer.from(k.sk).toString('hex'), npub: 'npub1fixture', nsec: 'nsec1fixture' };
    },
    finalizeEvent: (template, bytes) => {
      calls.finalizeEvent.push(template);
      return (opts.finalizeEvent || nt().finalizeEvent)(template, bytes);
    },
    importEvent: async (event) => {
      calls.order.push('local');
      calls.importEvent.push(event);
      if (opts.localFails) throw new Error('strfry import failed (fixture)');
    },
    isLocalOnly: () => Boolean(opts.localOnly),
    publishToRelays: async (event, relays) => {
      calls.order.push('relays');
      calls.publishToRelays.push({ event, relays });
      const rows = opts.rows || ((list) => list.map((relay) => ({ relay, status: 'accepted', reason: '' })));
      return rows(relays);
    },
    isPublicHostname: async (host) => {
      calls.isPublicHostname.push(host);
      if ((opts.hangHosts || []).includes(host)) return new Promise(() => {});
      return !(opts.notPublic || []).includes(host);
    },
    now: () => NOW_MS,
    resolveOfferInputs: async (viewer) => {
      calls.resolveOfferInputs.push(viewer);
      return opts.inputs || { ownRelay: OWN, dlistRelay: null, scores: true };
    },
    lookupPublishedMenu: async (input) => {
      calls.lookupPublishedMenu.push(input);
      const latest = typeof opts.latest === 'function' ? opts.latest(input.assistantPubkey) : (opts.latest || null);
      return { finished: true, published: null, latest };
    },
    assistantWriteRelays: async (input) => { calls.assistantWriteRelays.push(input); return (opts.aWrite || [A1, A2]).slice(); },
    nousWriteRelays: async (relays) => { calls.nousWriteRelays.push(relays); return (opts.nous === undefined ? [N1] : opts.nous).slice(); },
    getConfiguredPublishRelays: () => [PUB1, OWN],
    getConfigFromFile: (key, dflt) => (Object.prototype.hasOwnProperty.call(CONFIG, key) ? CONFIG[key] : dflt),
    outsideOnly: realOutsideOnly,
  };
  return { deps, calls, keyFor };
}
function fakeRes() {
  const res = { statusCode: 200, body: undefined };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}
const signedInReq = (pubkey = VIEWER, extra = {}) => ({ session: { authenticated: true, pubkey }, query: {}, ...extra });
async function answer(opts = {}, req = signedInReq(), quiet = false) {
  const factory = need(publishModule(), 'createPublishDutyMenuHandler', rel(MODULE));
  const { deps, calls, keyFor } = fakes(opts);
  const handle = factory(deps);
  const res = fakeRes();
  console.log = () => {}; console.warn = () => {};
  if (quiet) console.error = () => {};
  // Bounded, so a handler that never settles still gives the console back (and fails its test, not the suites after it).
  try { await within(handle(req, res), HANDLER_LIMIT_MS); } finally { restoreConsole(); }
  const viewer = req && req.session && typeof req.session.pubkey === 'string' ? req.session.pubkey : VIEWER;
  return { res, body: res.body, result: res.body && res.body.result, calls, signed: calls.importEvent[0] || null, assistantPubkey: keyFor(viewer).pubkey };
}
const sentTo = (got) => (got.calls.publishToRelays[0] ? got.calls.publishToRelays[0].relays : []);
const rowsOf = (got) => (got.result && got.result.relays && Array.isArray(got.result.relays.results) ? got.result.relays.results : []);

async function within(promise, ms) {
  let timer;
  const hung = new Promise((resolve) => { timer = setTimeout(() => resolve('HUNG'), ms); });
  try { return await Promise.race([promise, hung]); } finally { clearTimeout(timer); }
}

/**
 * Low-level fakes for the REAL story-1 functions (E8, W10): this instance's relay is `store`, outside relays `relays`
 * ({ url: events | 'hang' }; unlisted = unreachable). Complete, so it needs nothing from dutyMenu.js's defaults.
 */
function lowLevel({ store, relays = {}, viewer = VIEWER }) {
  const status = require('../src/api/setup/status');
  const attention = require('../src/api/assistant/attention');
  const L = {
    scanLocal: async (filter) => matching(store, filter),
    readRelay: async (url, filter) => {
      const held = relays[url];
      if (held === 'hang') return new Promise(() => {});
      if (!Array.isArray(held)) return { status: 'unreachable', events: [], error: 'fixture' };
      return { status: 'ok', events: matching(held, filter), error: null };
    },
    getConfigFromFile: (key, dflt) => (Object.prototype.hasOwnProperty.call(CONFIG, key) ? CONFIG[key] : dflt),
    readConfiguredRelays: () => [],
    getConfiguredPublishRelays: () => [PUB1, OWN],
    mapDefaultRelays: () => [],
    isPublicHost: (host) => require('../src/api/assistant/profileDefaults').isPublicHost(host),
    isPublicRelayHostWithin: async () => true,
    isLocalOnly: () => false,
    outsideOnly: (urls, d) => status.outsideOnly(urls, d || L),
    lookupNewest: (input, d) => status.lookupNewest(input, d || L),
    treasureMapRelays: (d) => status.treasureMapRelays(d || L),
    lookupNewestReplaceable: (input, d) => attention.lookupNewestReplaceable(input, d || L),
    getCustomer: async () => null,
    now: () => NOW_MS,
  };
  L.viewer = viewer;
  return L;
}
/** The route's deps with the real story-1 functions over `L`. */
function integratedDeps(L, { sk, store }) {
  const duty = load(CHECK, 'It is story 1\'s check.');
  for (const name of ['resolveOfferInputs', 'lookupPublishedMenu', 'assistantWriteRelays', 'nousWriteRelays']) need(duty, name, rel(CHECK));
  const calls = { publishToRelays: [] };
  const deps = {
    getAssistantKeys: async () => ({ pubkey: nt().getPublicKey(sk), privkey: Buffer.from(sk).toString('hex') }),
    importEvent: async (event) => { store.push(event); },
    isLocalOnly: () => false,
    publishToRelays: async (event, relays) => { calls.publishToRelays.push(relays); return relays.map((relay) => ({ relay, status: 'accepted', reason: '' })); },
    isPublicHostname: async () => true,
    now: () => NOW_MS,
    resolveOfferInputs: (viewer) => duty.resolveOfferInputs(viewer, L),
    lookupPublishedMenu: (input) => duty.lookupPublishedMenu(input, L),
    assistantWriteRelays: (input) => duty.assistantWriteRelays(input, L),
    nousWriteRelays: (relays) => duty.nousWriteRelays(relays, L),
    getConfiguredPublishRelays: L.getConfiguredPublishRelays,
    getConfigFromFile: L.getConfigFromFile,
    outsideOnly: realOutsideOnly,
  };
  return { deps, calls, duty };
}

/* ───────────────────────── P — whose key, and the refusals (AC-2) ───────────────────────── */

test('P1: the module exports what ADR 0002 sub-decision 1 names — the handler factory and handler, publishDutyMenuFor, DUTY_MENU_SUBJECT "Your Assistant\'s Duty Menu", CODES and WORDS in story § Copy\'s refusals (AC-2; § Copy)', () => {
  const mod = publishModule();
  const wrong = [];
  for (const name of ['createPublishDutyMenuHandler', 'handlePublishDutyMenu', 'publishDutyMenuFor']) if (typeof mod[name] !== 'function') wrong.push(`no ${name}()`);
  if (mod.DUTY_MENU_SUBJECT !== DM.PUBLISH.subject) wrong.push(`DUTY_MENU_SUBJECT: want ${show(DM.PUBLISH.subject)}, got ${show(mod.DUTY_MENU_SUBJECT)}`);
  const codes = mod.CODES || {};
  if (!Object.values(codes).includes('not-signed-in') || !Object.values(codes).includes('no-assistant')) wrong.push(`CODES name not-signed-in and no-assistant, got ${show(codes)}`);
  const words = mod.WORDS || {};
  for (const [code, sentence] of Object.entries(DM.PUBLISH.refusals)) if (words[code] !== sentence) wrong.push(`WORDS['${code}']: want ${show(sentence)}, got ${show(words[code])}`);
  if (words.failed !== DM.PUBLISH.failed) wrong.push(`WORDS.failed: want ${show(DM.PUBLISH.failed)}, got ${show(words.failed)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('P2: without an authenticated session the route answers 401 not-signed-in in the approved words, before any key is read and with nothing signed (AC-2)', async () => {
  const wrong = [];
  for (const req of [{ session: {} }, { session: { authenticated: true, pubkey: 'nope' } }, { session: { authenticated: false, pubkey: VIEWER } }, {}]) {
    const got = await answer({}, req);
    const want = { success: false, code: DM.PUBLISH.codes.notSignedIn, error: DM.PUBLISH.refusals['not-signed-in'] };
    if (got.res.statusCode !== 401 || !sameJson(got.body, want)) wrong.push(`${show(req)} → ${got.res.statusCode} ${show(got.body)}`);
    if (got.calls.getAssistantKeys.length || got.calls.finalizeEvent.length || got.calls.importEvent.length) wrong.push(`${show(req)}: a key was read or something signed`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('P3: a signed-in viewer with no Assistant here gets 403 no-assistant in the approved words; the key is looked up for the session\'s viewer and nothing else is read, signed, written or sent (AC-2; sub-decision 1)', async () => {
  const got = await answer({ assistant: null });
  const want = { success: false, code: DM.PUBLISH.codes.noAssistant, error: DM.PUBLISH.refusals['no-assistant'] };
  const wrong = [];
  if (got.res.statusCode !== 403 || !sameJson(got.body, want)) wrong.push(`got ${got.res.statusCode} ${show(got.body)}`);
  if (!sameJson(got.calls.getAssistantKeys, [VIEWER])) wrong.push(`the key is looked up for the session's viewer, got ${show(got.calls.getAssistantKeys)}`);
  const c = got.calls;
  if (c.resolveOfferInputs.length || c.lookupPublishedMenu.length || c.assistantWriteRelays.length || c.nousWriteRelays.length) wrong.push('nothing else is read before the refusal');
  if (c.finalizeEvent.length || c.importEvent.length || c.publishToRelays.length) wrong.push('nothing is signed, written or sent');
  assert(wrong.length === 0, wrong.join('; '));
});

test('P4: the request names nothing — the body is never read, and a kind, pubkey, tags, rows or content in it, or in the query, change nothing (AC-2; sub-decision 1)', async () => {
  let touched = false;
  const nosy = signedInReq(VIEWER, { query: { pubkey: OTHER, assistant: OTHER } });
  Object.defineProperty(nosy, 'body', { enumerable: true, get() { touched = true; return { kind: 1, pubkey: OTHER, tags: [['p', OTHER]], rows: [['duty', '30385', 'wss://evil.example']], content: 'hello' }; } });
  const got = await answer({}, nosy);
  const plain = await answer({});
  const wrong = [];
  if (touched) wrong.push('the handler read req.body');
  if (!got.signed || got.signed.kind !== DM.DUTY_MENU_KIND || got.signed.pubkey !== got.assistantPubkey) wrong.push(`kind and signer: ${show(got.signed && { kind: got.signed.kind, pubkey: got.signed.pubkey })}`);
  if (!got.signed || !plain.signed || !sameJson(got.signed.tags.slice(2).filter((t) => t[0] === 'duty'), plain.signed.tags.slice(2).filter((t) => t[0] === 'duty')) || got.signed.content !== '') wrong.push(`the rows and content come from the server's offer only: ${show(got.signed && got.signed.tags)}`);
  if (!sameJson(got.calls.getAssistantKeys, [VIEWER])) wrong.push(`whose key: the session's viewer, got ${show(got.calls.getAssistantKeys)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('P5: the signer is the session\'s own Assistant, the Owner\'s and a customer\'s alike — the offer is computed for that viewer and the menu looked up for that Assistant (AC-2)', async () => {
  const wrong = [];
  for (const viewer of [OWNER_VIEWER, VIEWER]) {
    const got = await answer({}, signedInReq(viewer));
    if (!got.signed || got.signed.pubkey !== got.assistantPubkey) wrong.push(`${viewer.slice(0, 4)}…: signed by ${show(got.signed && got.signed.pubkey)}, want its own Assistant ${got.assistantPubkey}`);
    if (!sameJson(got.calls.resolveOfferInputs, [viewer])) wrong.push(`${viewer.slice(0, 4)}…: the offer for the session's viewer, got ${show(got.calls.resolveOfferInputs)}`);
    const look = got.calls.lookupPublishedMenu[0] || {};
    if (String(look.assistantPubkey || '').toLowerCase() !== got.assistantPubkey) wrong.push(`${viewer.slice(0, 4)}…: the newest version is looked up for its Assistant, got ${show(look)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('P6: one press signs exactly one event, a kind-39999 Duty Menu, and writes and sends that same event (AC-2: "A kind-39999 Duty Menu and nothing else")', async () => {
  const got = await answer({});
  const wrong = [];
  if (got.calls.finalizeEvent.length !== 1 || got.calls.finalizeEvent[0].kind !== DM.DUTY_MENU_KIND) wrong.push(`signed: ${show(got.calls.finalizeEvent.map((t) => t.kind))}`);
  if (got.calls.importEvent.length !== 1) wrong.push(`written locally ${got.calls.importEvent.length} times`);
  if (got.calls.publishToRelays.length !== 1 || got.calls.publishToRelays[0].event.id !== (got.signed && got.signed.id)) wrong.push('the fan-out sends the event written locally, once');
  assert(wrong.length === 0, wrong.join('; '));
});

test('P7: an unexpected throw answers 500 with "Could not publish your Assistant\'s Duty Menu" (sub-decision 1)', async () => {
  const got = await answer({ throwOn: 'getAssistantKeys' }, signedInReq(), true);
  assert(got.res.statusCode === 500 && sameJson(got.body, { success: false, error: DM.PUBLISH.failed }), `got ${got.res.statusCode} ${show(got.body)}`);
});

/* ───────────────────────── E — the event (AC-3) ───────────────────────── */

test('E1: the event — kind 39999, empty content, signed by the Assistant (it verifies), with exactly the tags d, Nous\' z, p, then one duty row per offer row in the offer\'s order (AC-3; sub-decision 2; rows only)', async () => {
  const got = await answer({ inputs: { ownRelay: OWN, dlistRelay: null, scores: true } });
  const ev = got.signed;
  const wrong = [];
  if (!ev) wrong.push('nothing was written locally');
  else {
    if (ev.kind !== DM.DUTY_MENU_KIND || ev.content !== '') wrong.push(`kind ${ev.kind}, content ${show(ev.content)}`);
    if (ev.pubkey !== got.assistantPubkey || !nt().verifyEvent(ev)) wrong.push('signed by the Assistant, and the signature verifies');
    const want = [['d', DM.DUTY_MENU_D], ['z', DM.DUTY_MENU_HEADER], ['p', got.assistantPubkey], ...DM.expectedOffer({ ownRelay: OWN, scores: true }).map((r) => ['duty', r.key, r.relay])];
    if (!sameJson(ev.tags, want)) wrong.push(`tags: want ${show(want)}, got ${show(ev.tags)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('E2: the event is a Duty Menu by § 6.1 (all five conditions), and its rows read back are exactly the offer (AC-3)', async () => {
  const { isDutyMenu, readMenuRows, sameRows } = require(LIB);
  const got = await answer({ inputs: { ownRelay: null, dlistRelay: DLIST, scores: false } });
  assert(got.signed, `nothing was signed: ${show(got.body)}`);
  assert(isDutyMenu(got.signed, got.assistantPubkey) === true, 'isDutyMenu(signed, assistant) holds');
  const want = DM.expectedOffer({ dlistRelay: DLIST });
  assert(sameRows(readMenuRows(got.signed), want), `rows read back: want ${show(want)}, got ${show(readMenuRows(got.signed))}`);
});

test('E3: an empty offer still publishes an empty menu — d, z and p only — and the answer says duties 0 (AC-3; § 11)', async () => {
  const got = await answer({ inputs: { ownRelay: null, dlistRelay: null, scores: false } });
  const wrong = [];
  if (!got.signed || !sameJson(got.signed.tags, [['d', DM.DUTY_MENU_D], ['z', DM.DUTY_MENU_HEADER], ['p', got.assistantPubkey]])) wrong.push(`tags: ${show(got.signed && got.signed.tags)}`);
  if (!got.result || got.result.ok !== true || got.result.duties !== 0) wrong.push(`answer: ${show(got.result)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('E4: created_at — now with no earlier version; one second after the newest found when that is in the future; now when the newest is older (AC-3; sub-decision 4)', async () => {
  const wrong = [];
  const none = await answer({});
  if (!none.signed || none.signed.created_at !== NOW_S) wrong.push(`no earlier version: want ${NOW_S}, got ${show(none.signed && none.signed.created_at)}`);
  const future = await answer({ latest: (a) => foundMenu(a, { createdAt: NOW_S + 500 }) });
  if (!future.signed || future.signed.created_at !== NOW_S + 501) wrong.push(`newest from the future: want ${NOW_S + 501}, got ${show(future.signed && future.signed.created_at)}`);
  const past = await answer({ latest: (a) => foundMenu(a, { createdAt: NOW_S - 500 }) });
  if (!past.signed || past.signed.created_at !== NOW_S) wrong.push(`older newest: want ${NOW_S}, got ${show(past.signed && past.signed.created_at)}`);
  const invalid = await answer({ latest: (a) => foundMenu(a, { createdAt: NOW_S + 50, z: [] }) });
  if (!invalid.signed || invalid.signed.created_at !== NOW_S + 51) wrong.push(`an invalid newest still counts for created_at: want ${NOW_S + 51}, got ${show(invalid.signed && invalid.signed.created_at)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('E5: the author check — an event signed as anyone but the Assistant, or one that is not a Duty Menu by § 6.1, is a 500, with nothing written or sent (sub-decision 3)', async () => {
  const otherSk = nt().generateSecretKey();
  const wrong = [];
  for (const [label, finalizeEvent] of [
    ['signed by another key', (template) => nt().finalizeEvent(template, otherSk)],
    ['Nous\' z dropped', (template, bytes) => nt().finalizeEvent({ ...template, tags: template.tags.filter((t) => t[0] !== 'z') }, bytes)],
    ['a second p', (template, bytes) => nt().finalizeEvent({ ...template, tags: [...template.tags, ['p', OTHER]] }, bytes)],
  ]) {
    const got = await answer({ finalizeEvent }, signedInReq(), true);
    if (got.res.statusCode !== 500 || !sameJson(got.body, { success: false, error: DM.PUBLISH.failed })) wrong.push(`${label}: want 500, got ${got.res.statusCode} ${show(got.body)}`);
    if (got.calls.importEvent.length || got.calls.publishToRelays.length) wrong.push(`${label}: nothing is written or sent`);
    if (got.calls.finalizeEvent.length !== 1) wrong.push(`${label}: the path ran to the signature`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('E6: read back by story 1\'s check, the new menu is current and the action Done — with the real offer, the real local-first read and an older version here from the future (AC-3; sub-decisions 4, 7)', async () => {
  const sk = nt().generateSecretKey();
  const A = nt().getPublicKey(sk);
  const older = foundMenu(A, { createdAt: NOW_S + 300, rows: [['duty', '30382', 'wss://old-one.example']] });
  const store = [older];
  const L = lowLevel({ store });
  const { deps, duty } = integratedDeps(L, { sk, store });
  const handle = need(publishModule(), 'createPublishDutyMenuHandler', rel(MODULE))(deps);
  const res = fakeRes();
  console.log = () => {};
  try { await within(handle(signedInReq(), res), HANDLER_LIMIT_MS); } finally { restoreConsole(); }
  const signed = store.find((e) => e !== older);
  const wrong = [];
  if (!signed || signed.created_at !== NOW_S + 301) wrong.push(`the new version is written here, one second after the older: ${show(signed && signed.created_at)}`);
  const check = await duty.checkDutyMenu({ viewer: VIEWER, assistantPubkey: A }, L);
  if (!(check.finished && check.current === true && check.done === true && check.published && signed && check.published.eventId === signed.id)) wrong.push(`the check reads it back current and done: ${show(check)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── W — where it goes (AC-4) ───────────────────────── */

test('W1: this instance\'s relay first — the local write comes before any relay; a failed local write sends nothing and says so in the approved sentence (AC-4; sub-decision 5)', async () => {
  const ok = await answer({});
  const wrong = [];
  if (!sameJson(ok.calls.order, ['local', 'relays'])) wrong.push(`order: want local then relays, got ${show(ok.calls.order)}`);
  const failed = await answer({ localFails: true });
  const r = failed.result || {};
  if (failed.res.statusCode !== 200 || !failed.body || failed.body.success !== true) wrong.push(`the request itself answers: ${failed.res.statusCode} ${show(failed.body)}`);
  if (!(r.ok === false && r.stage === 'local' && r.outcome === 'not-delivered')) wrong.push(`want ok false, stage local, not-delivered: ${show(r)}`);
  if (r.message !== DM.PUBLISH.localFailed('strfry import failed (fixture)')) wrong.push(`message: want ${show(DM.PUBLISH.localFailed('strfry import failed (fixture)'))}, got ${show(r.message)}`);
  if (failed.calls.publishToRelays.length || failed.calls.isPublicHostname.length) wrong.push('nothing is looked up or sent after a failed local write');
  assert(wrong.length === 0, wrong.join('; '));
});

test('W2: the set, each relay once — the Assistant\'s write relays, the new rows\' relays, the rows of the menu found at publish time (read even from an invalid one), and Nous\' write relays; never this instance\'s own, never the profile publish set (AC-4; sub-decisions 4, 5)', async () => {
  const latest = (a) => foundMenu(a, { z: [], rows: [['duty', '30382', OLD1], ['duty', '30392', OLD2], ['duty', '30393', A1], ['not-offered', '30385']] });
  const got = await answer({
    inputs: { ownRelay: null, dlistRelay: DLIST, scores: false },
    latest, aWrite: [A1, A2, OWN, 'ws://localhost:7777', 'wss://A-Two.example/'], nous: [N1, DLIST],
  });
  const want = [DLIST, A1, A2, OLD1, OLD2, N1];
  const sent = sentTo(got);
  const wrong = [];
  if (!sameSet(sent, want) || new Set(sent).size !== sent.length) wrong.push(`sent: want each of ${show(want)} once, got ${show(sent)}`);
  const rowRelays = rowsOf(got).map((r) => r.relay);
  if (!sameSet(rowRelays, want)) wrong.push(`one row per relay of the set: ${show(rowRelays)}`);
  if (sent.some((u) => [OWN_DOMAIN, 'localhost'].includes(hostOf(u)))) wrong.push('this instance\'s own relay is never sent to');
  if (sent.includes(PUB1)) wrong.push('the profile publish set is where relay lists are read, not a place § 8.1 names');
  if (!got.calls.assistantWriteRelays.length || !got.calls.nousWriteRelays.length) wrong.push('both write-relay lookups ran');
  assert(wrong.length === 0, wrong.join('; '));
});

test('W3: Nous\' list not found — nothing is sent for Nous, and the rest still go (AC-4: "when Nous\' relay list is found")', async () => {
  const got = await answer({ nous: [] });
  const sent = sentTo(got);
  assert(got.calls.nousWriteRelays.length === 1, 'Nous\' write relays were asked for');
  assert(sameSet(sent, [A1, A2]) && !sent.includes(N1), `sent: want ${show([A1, A2])}, got ${show(sent)}`);
});

test('W4: a configured row relay is sent without a DNS lookup — also when an event names it too; every event-named relay is looked up (AC-4; sub-decision 5)', async () => {
  const got = await answer({ inputs: { ownRelay: null, dlistRelay: DLIST, scores: false }, aWrite: [A1, DLIST] });
  const looked = got.calls.isPublicHostname.slice().sort();
  const wrong = [];
  if (looked.includes(hostOf(DLIST))) wrong.push(`the configured ${DLIST} was looked up`);
  if (!sameSet(looked, [hostOf(A1), hostOf(N1)])) wrong.push(`looked up: want the event-named relays only, got ${show(looked)}`);
  if (!sentTo(got).includes(DLIST) || sentTo(got).filter((u) => u === DLIST).length !== 1) wrong.push(`${DLIST} is sent once: ${show(sentTo(got))}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('W5: an event-named relay that does not resolve public is never sent to and reads not-sent: not a public address; an accepted one IS sent, and the summary counts only the relays sent to (AC-4; sub-decision 5)', async () => {
  const got = await answer({ aWrite: [A1, 'wss://resolves-private.example'], notPublic: ['resolves-private.example'] });
  const sent = sentTo(got);
  const row = rowsOf(got).find((r) => r.relay === 'wss://resolves-private.example');
  const wrong = [];
  if (sent.includes('wss://resolves-private.example')) wrong.push(`the refused relay was sent to: ${show(sent)}`);
  if (!sent.includes(A1)) wrong.push(`the accepted ${A1} is sent: ${show(sent)}`);
  if (!row || row.status !== DM.PUBLISH.notSent.status || row.reason !== DM.PUBLISH.notSent.reason) wrong.push(`want a not-sent row, got ${show(row)}`);
  const n = sent.length;
  if (!got.result || got.result.message !== DM.PUBLISH.published(n, n)) wrong.push(`summary: want ${show(DM.PUBLISH.published(n, n))}, got ${show(got.result && got.result.message)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('W6: at most 50 event-named relays, the first 50 in the ADR\'s order (the Assistant\'s, the earlier rows\', Nous\') after de-duplication against each other and the configured set; beyond that no lookup, no send and no row; the configured relay goes on top (AC-4; sub-decision 5)', async () => {
  const A = Array.from({ length: 30 }, (_, i) => `wss://aw-${i}.example`);
  const O = Array.from({ length: 20 }, (_, i) => `wss://old-${i}.example`);
  const N = Array.from({ length: 15 }, (_, i) => `wss://nw-${i}.example`);
  const oldRows = O.map((u, i) => ['duty', String(30380 + i), u]);
  const latest = (a) => foundMenu(a, { rows: [...oldRows, ['duty', '39998', A[0]]] });
  const got = await answer({ inputs: { ownRelay: null, dlistRelay: DLIST, scores: false }, latest, aWrite: [DLIST, ...A], nous: N });
  const first50 = [...A, ...O];
  const beyond = N;
  const looked = got.calls.isPublicHostname;
  const sent = sentTo(got);
  const rowRelays = rowsOf(got).map((r) => r.relay);
  const wrong = [];
  if (looked.length > 50) wrong.push(`${looked.length} lookups, want at most 50`);
  if (!sameSet(looked, first50.map(hostOf))) wrong.push(`looked up: want the first 50 (the Assistant's, then the earlier rows'), got ${looked.length} incl. ${show(looked.filter((h) => !first50.map(hostOf).includes(h)).slice(0, 3))}`);
  const missing = first50.filter((u) => !sent.includes(u));
  if (missing.length) wrong.push(`the first 50 are really sent: missing ${show(missing.slice(0, 3))}${missing.length > 3 ? ` and ${missing.length - 3} more` : ''}`);
  if (beyond.some((u) => sent.includes(u) || rowRelays.includes(u))) wrong.push('Nous\' relays past the 50th get no send and no row');
  if (!sent.includes(DLIST)) wrong.push(`the configured ${DLIST} is sent on top of the 50`);
  if (rowRelays.length !== 51) wrong.push(`rows: want 51 (50 event-named + 1 configured), got ${rowRelays.length}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('W7: local-only mode — written here, every relay of the set reads skipped: local-only publish mode, nothing is sent, kept-local, the approved sentence (AC-4; sub-decision 5)', async () => {
  const got = await answer({ localOnly: true, inputs: { ownRelay: null, dlistRelay: DLIST, scores: false } });
  const r = got.result || {};
  const rows = rowsOf(got);
  const wrong = [];
  if (got.calls.importEvent.length !== 1 || got.calls.publishToRelays.length !== 0) wrong.push('written locally, sent nowhere');
  if (!(r.ok === true && r.outcome === 'kept-local' && r.localOnly === true && r.message === DM.PUBLISH.localOnly)) wrong.push(`got ${show(r)}`);
  if (!(rows.length > 0 && rows.every((x) => x.status === DM.PUBLISH.skipped.status && x.reason === DM.PUBLISH.skipped.reason))) wrong.push(`one skipped row per relay: ${show(rows)}`);
  if (!sameSet(rows.map((x) => x.relay), [DLIST, A1, A2, N1])) wrong.push(`the set: ${show(rows.map((x) => x.relay))}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('W8: a DNS lookup that never answers costs only the 3 s budget — the answer comes in time, that relay reads not-sent, the others are sent (AC-4: "within a bounded time")', async () => {
  const started = Date.now();
  const got = await within(answer({ aWrite: [A1, 'wss://never-answers.example'], hangHosts: ['never-answers.example'] }), 3000 + 2000);
  restoreConsole();
  assert(got !== 'HUNG', `the press must answer within the lookup budget (waited ${Date.now() - started} ms)`);
  const row = rowsOf(got).find((r) => r.relay === 'wss://never-answers.example');
  assert(row && row.status === DM.PUBLISH.notSent.status, `the unanswered relay is not-sent: ${show(row)}`);
  assert(sentTo(got).includes(A1) && !sentTo(got).includes('wss://never-answers.example'), `the others are sent: ${show(sentTo(got))}`);
});

test('W9: the answer — { success, result: { ok, outcome, message, localOnly, duties, relays: { total, success, results } } }, counting only accepting relays, in § Copy\'s sentences (AC-1, AC-4; sub-decision 5)', async () => {
  const someRefuse = (list) => list.map((relay, i) => (i === 0 ? { relay, status: 'refused', reason: 'blocked: fixture' } : { relay, status: 'accepted', reason: '' }));
  const got = await answer({ rows: someRefuse, inputs: { ownRelay: null, dlistRelay: DLIST, scores: false } });
  const r = got.result || {};
  const n = sentTo(got).length;
  const wrong = [];
  if (!got.body || got.body.success !== true) wrong.push(`success: ${show(got.body)}`);
  if (!sameJson(Object.keys(r).sort(), ['duties', 'localOnly', 'message', 'ok', 'outcome', 'relays'])) wrong.push(`result fields: ${show(Object.keys(r).sort())}`);
  if (!(r.ok === true && r.outcome === 'published' && r.localOnly === false && r.duties === 2)) wrong.push(`flags: ${show({ ok: r.ok, outcome: r.outcome, localOnly: r.localOnly, duties: r.duties })}`);
  if (r.message !== DM.PUBLISH.published(n - 1, n)) wrong.push(`message: want ${show(DM.PUBLISH.published(n - 1, n))}, got ${show(r.message)}`);
  if (!(r.relays && r.relays.total === n && r.relays.success === n - 1 && Array.isArray(r.relays.results) && r.relays.results.length === n)) wrong.push(`relays: ${show(r.relays)}`);
  const none = await answer({ rows: (list) => list.map((relay) => ({ relay, status: 'unreachable', reason: 'fixture' })) });
  const m = sentTo(none).length;
  if (!(none.result && none.result.outcome === 'not-delivered' && none.result.message === DM.PUBLISH.noneAccepted(m))) wrong.push(`none accepted: ${show(none.result)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('W10: a relay that hangs while the newest version is looked up costs at most the story-1 relay budget (8 s) plus the DNS budget — the press still answers and publishes (AC-4: "within a bounded time"; sub-decision 7)', async () => {
  const sk = nt().generateSecretKey();
  const A = nt().getPublicKey(sk);
  const store = [
    { id: hexId(9001), pubkey: VIEWER, kind: DM.TREASURE_MAP_KIND, created_at: 10, tags: [['30382:rank', A, 'wss://hangs.example']], content: '', sig: '0'.repeat(128) },
    { id: hexId(9002), pubkey: A, kind: DM.RELAY_LIST_KIND, created_at: 10, tags: [['r', A1]], content: '', sig: '0'.repeat(128) },
  ];
  const L = lowLevel({ store, relays: { 'wss://hangs.example': 'hang', [A1]: [] } });
  const { deps, calls } = integratedDeps(L, { sk, store });
  const handle = need(publishModule(), 'createPublishDutyMenuHandler', rel(MODULE))(deps);
  const res = fakeRes();
  const started = Date.now();
  console.log = () => {};
  let got;
  try { got = await within(handle(signedInReq(), res), DM.RELAY_BUDGET_MS + 3000 + 2000); } finally { restoreConsole(); }
  assert(got !== 'HUNG', `the press must answer within the budgets (waited ${Date.now() - started} ms)`);
  assert(res.body && res.body.success === true && res.body.result && res.body.result.ok === true, `published: ${show(res.body)}`);
  assert(calls.publishToRelays.length === 1 && calls.publishToRelays[0].includes(A1), `the Assistant's write relay is sent to: ${show(calls.publishToRelays)}`);
});

test('W11: saved here, not local-only, and no relay at all to send to — the answer says "Your Assistant\'s Duty Menu was saved on this instance\'s relay. There was no other relay to send it to." with no relay rows; with one relay in the set, or in local-only mode, summarizePublish\'s sentence stands (ADR 0002 Amendment 2 item 3)', async () => {
  const { summarizePublish } = require('../src/api/assistant/profilePublish');
  const subject = DM.PUBLISH.subject;
  const wrong = [];
  const empty = await answer({ inputs: { ownRelay: OWN, dlistRelay: null, scores: true }, aWrite: [], nous: [], latest: null });
  const r = empty.result || {};
  if (!(r.ok === true && r.message === DM.PUBLISH.nothingElse)) wrong.push(`empty set: want ${show(DM.PUBLISH.nothingElse)}, got ${show(r.message)} (${show({ ok: r.ok, outcome: r.outcome })})`);
  if (!(r.relays && r.relays.total === 0 && Array.isArray(r.relays.results) && r.relays.results.length === 0)) wrong.push(`empty set: no relay rows, got ${show(r.relays)}`);
  if (empty.calls.importEvent.length !== 1 || empty.calls.publishToRelays.some((c) => c.relays.length > 0)) wrong.push('empty set: saved here, nothing sent');
  const one = await answer({ inputs: { ownRelay: OWN, dlistRelay: null, scores: true }, aWrite: [A1], nous: [], latest: null });
  const want1 = summarizePublish({ subject, rows: rowsOf(one), localOnly: false }).message;
  if (!one.result || one.result.message !== want1 || one.result.message === DM.PUBLISH.nothingElse) wrong.push(`one relay: want summarizePublish's ${show(want1)}, got ${show(one.result && one.result.message)}`);
  const refused = await answer({ inputs: { ownRelay: OWN, dlistRelay: null, scores: true }, aWrite: [A1], nous: [], notPublic: [hostOf(A1)] });
  const wantR = summarizePublish({ subject, rows: rowsOf(refused), localOnly: false }).message;
  if (!refused.result || refused.result.message !== wantR || refused.result.message === DM.PUBLISH.nothingElse) wrong.push(`one relay, refused by the guard (the set is not empty before it): want ${show(wantR)}, got ${show(refused.result && refused.result.message)}`);
  const local = await answer({ localOnly: true, inputs: { ownRelay: OWN, dlistRelay: null, scores: true }, aWrite: [], nous: [] });
  if (!local.result || local.result.message !== DM.PUBLISH.localOnly) wrong.push(`local-only, empty set: want ${show(DM.PUBLISH.localOnly)}, got ${show(local.result && local.result.message)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────── duty-menu-public-relay #1: the instance's public relay address (Light Bug lane; the story's Design note) ───────── */

const DOCKER_CONFIG = { BRAINSTORM_RELAY_URL: 'ws://tapestry:80/relay', STRFRY_DOMAIN: 'staging.example.org' };
const DERIVED = 'wss://staging.example.org/relay';
const OWN_HOSTS = ['staging.example.org', 'tapestry'];

/**
 * One press, with the real story-1 functions over this instance's relay (`seed(A)` gives what it holds for the
 * Assistant A), configured as a Docker deployment: the internal relay URL and a public STRFRY_DOMAIN.
 */
async function publishOnDocker(seed) {
  const sk = nt().generateSecretKey();
  const store = seed(nt().getPublicKey(sk));
  const before = store.length;
  const L = lowLevel({ store });
  L.getConfigFromFile = (key, dflt) => (Object.prototype.hasOwnProperty.call(DOCKER_CONFIG, key) ? DOCKER_CONFIG[key] : dflt);
  const { deps, calls } = integratedDeps(L, { sk, store });
  const res = fakeRes();
  console.log = () => {}; console.warn = () => {};
  try { await within(need(publishModule(), 'createPublishDutyMenuHandler', rel(MODULE))(deps)(signedInReq(), res), HANDLER_LIMIT_MS); } finally { restoreConsole(); }
  return { res, signed: store[before] || null, sent: calls.publishToRelays.flat() };
}

test('W12: on Docker the derived address is never sent to as an outside relay — not when the Assistant\'s relay list or the found version\'s rows name it, in any spelling, nor as the new rows\' relay — while the other relays they name are sent (duty-menu-public-relay AC-4)', async () => {
  const got = await publishOnDocker((A) => [
    { id: hexId(9101), pubkey: A, kind: DM.RELAY_LIST_KIND, created_at: 10, tags: [['r', 'wss://Staging.Example.ORG/relay/'], ['r', A1]], content: '', sig: '0'.repeat(128) },
    foundMenu(A, { createdAt: 20, rows: [['duty', '30392', DERIVED], ['duty', '30382', OLD1]] }),
  ]);
  const wrong = [];
  if (!got.res.body || got.res.body.success !== true || !got.res.body.result || got.res.body.result.ok !== true) wrong.push(`published: ${show(got.res.body)}`);
  const own = got.sent.filter((u) => OWN_HOSTS.includes(hostOf(u)));
  if (own.length) wrong.push(`this instance's relay was sent to as outside: ${show(own)}`);
  for (const u of [A1, OLD1]) if (!got.sent.includes(u)) wrong.push(`the control ${u} is sent: ${show(got.sent)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('W13: on Docker the signed menu\'s rows name wss://<domain>/relay — Lists and Concepts for a viewer without Scores — and the fan-out never sends to it (duty-menu-public-relay AC-1, AC-4)', async () => {
  const got = await publishOnDocker(() => []);
  const wrong = [];
  const rows = got.signed ? got.signed.tags.filter((t) => t[0] === 'duty').map((t) => ({ tag: 'duty', key: t[1], relay: t[2] })) : null;
  const want = DM.expectedOffer({ ownRelay: DERIVED });
  if (!rows || show(rows) !== show(want)) wrong.push(`the signed rows: want ${show(want)}, got ${show(rows)}`);
  if (got.sent.some((u) => OWN_HOSTS.includes(hostOf(u)))) wrong.push(`the derived relay was sent to: ${show(got.sent)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── G — the DNS guard's shared home (sub-decision 6) ───────────────────────── */

test('G1: src/utils/relayHostGuard.js exports isPublicRelayHostWithin, within and LOOKUP_BUDGET_MS = 3000 — an IP literal or a private-by-construction name answered without DNS, and within() giving its fallback in time (sub-decision 6)', async () => {
  const g = guardModule();
  const wrong = [];
  if (typeof g.isPublicRelayHostWithin !== 'function' || typeof g.within !== 'function') wrong.push('exports isPublicRelayHostWithin() and within()');
  if (g.LOOKUP_BUDGET_MS !== 3000) wrong.push(`LOOKUP_BUDGET_MS: want 3000, got ${show(g.LOOKUP_BUDGET_MS)}`);
  if (wrong.length === 0) {
    for (const [host, want] of [['8.8.8.8', true], ['10.0.0.1', false], ['box.local', false], ['[::1]', false]]) {
      const got = await g.isPublicRelayHostWithin(host);
      if (got !== want) wrong.push(`${host}: want ${want}, got ${show(got)}`);
    }
    if ((await g.within(new Promise(() => {}), 50, 'late')) !== 'late') wrong.push('within(never, 50, "late") gives "late"');
    if ((await g.within(Promise.resolve(1), 1000, 'late')) !== 1) wrong.push('within(resolved 1) gives 1');
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('G2: relayListPublish.js keeps its exports — isPublicRelayHostWithin is the very same function from the guard\'s home, and LOOKUP_BUDGET_MS is still 3000 (sub-decision 6: "its own tests and callers are untouched")', () => {
  const g = guardModule();
  const r = load(RELAY_LIST_PUBLISH, 'It is the outbox publish route.');
  assert(r.isPublicRelayHostWithin === g.isPublicRelayHostWithin, 'relayListPublish.isPublicRelayHostWithin is relayHostGuard.isPublicRelayHostWithin');
  assert(r.LOOKUP_BUDGET_MS === 3000, `relayListPublish.LOOKUP_BUDGET_MS: want 3000, got ${show(r.LOOKUP_BUDGET_MS)}`);
});

test('G3: dutyMenu.js and dutyMenuPublish.js take the guard from src/utils/relayHostGuard, and never name relayListPublish (sub-decision 6)', () => {
  const wrong = [];
  for (const file of [CHECK, MODULE]) {
    const src = codeOnly(safeRead(file));
    if (!src) { wrong.push(`${rel(file)} does not exist`); continue; }
    if (!/require\(\s*['"](?:\.\.\/)+utils\/relayHostGuard(?:\.js)?['"]\s*\)/.test(src)) wrong.push(`${rel(file)} does not require ../../utils/relayHostGuard`);
    if (/relayListPublish/.test(src)) wrong.push(`${rel(file)} names relayListPublish`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── S — sentinels ───────────────────────── */

test('S1: the route is registered — app.post(\'/api/assistant/duty-menu/publish\', require(\'./assistant/dutyMenuPublish\').handlePublishDutyMenu) in src/api/index.js (sub-decision 1)', () => {
  // Raw source: codeOnly() mistakes the '/api/settings/*' route string in index.js for the start of a block comment.
  const index = safeRead(API_INDEX);
  assert(/app\.post\(\s*['"]\/api\/assistant\/duty-menu\/publish['"]\s*,\s*require\(\s*['"]\.\/assistant\/dutyMenuPublish(?:\.js)?['"]\s*\)\.handlePublishDutyMenu\s*\)/.test(index),
    "src/api/index.js does not register app.post('/api/assistant/duty-menu/publish', require('./assistant/dutyMenuPublish').handlePublishDutyMenu)");
});

test('S2: nothing else signs or publishes a menu — no module but src/api/index.js (and the route table) names dutyMenuPublish or the route, nothing at Assistant creation or on a schedule (no caller in src/, bin/, setup/ or scripts/), the client helper is the UI\'s one caller, and the generic signer gains nothing (AC-2)', () => {
  assert(fs.existsSync(MODULE), `${rel(MODULE)} does not exist (the refusals below need the module to mean anything)`);
  const offenders = [];
  const walk = (dir, allowed) => {
    if (!fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) { if (!['node_modules', 'dist', '.git'].includes(ent.name)) walk(p, allowed); continue; }
      if (!/\.(js|mjs|cjs|jsx|sh)$/.test(ent.name) || allowed.includes(p)) continue;
      const src = safeRead(p);
      if (/dutyMenuPublish|publishDutyMenuFor|handlePublishDutyMenu|duty-menu\/publish/.test(src)) offenders.push(rel(p));
    }
  };
  // Re-aimed by ADR 0002 Amendment 2 item 1: the fail-closed route table names the route to open it (S6 pins its entry).
  for (const dir of ['src', 'bin', 'setup', 'scripts']) walk(path.join(REPO, dir), [MODULE, API_INDEX, ROUTE_ACCESS]);
  walk(path.join(REPO, 'ui/src'), [CLIENT_UTIL]);
  assert(offenders.length === 0, `only src/api/index.js (and, in the UI, the client helper) may name the route: ${offenders.join(', ')}`);
  const mod = codeOnly(safeRead(MODULE));
  assert(!/setInterval|setTimeout\s*\([^)]*publish|cron|schedule/i.test(mod), 'the module schedules nothing');
  assert(!/['"][0-9a-f]{64}['"]/i.test(mod), 'no 64-hex literal in the module (Nous\' key comes from src/lib/nous)');
  assert(/buildMenuTags\s*\(/.test(mod) && /privkeyBytesOf/.test(mod), 'the module builds the tags through buildMenuTags and signs through privkeyBytesOf');
  assert(!/duty-menu|39999/.test(codeOnly(safeRead(GENERIC_SIGNER))), 'the generic signer does not gain the Duty Menu');
});

test('S3: openapi.yaml documents POST /api/assistant/duty-menu/publish, and its attention entry says the Duty Menu is read from this instance\'s relay first (sub-decision 9)', () => {
  const openapi = safeRead(OPENAPI);
  const wrong = [];
  if (!/^\s*\/api\/assistant\/duty-menu\/publish:\s*$/m.test(openapi)) wrong.push('openapi.yaml has no /api/assistant/duty-menu/publish path');
  const at = openapi.indexOf('/api/assistant/attention:');
  const block = at >= 0 ? openapi.slice(at, openapi.indexOf(NL + '  /api/', at + 10)) : '';
  const dutyPart = block.slice(Math.max(0, block.indexOf('`duty-menu`')));
  if (!/local[- ]first|local relay first|this instance's relay first/i.test(dutyPart)) wrong.push('the attention entry\'s duty-menu part does not say the read is local-first (AC-5)');
  assert(wrong.length === 0, wrong.join('; '));
});

test('S4: BIBLE §11 has a POST row for /api/assistant/duty-menu/publish, and the attention row\'s duty-menu part names the DList fallback and the 50-relay cap (sub-decision 9; NB12)', () => {
  const lines = safeRead(BIBLE).split(NL);
  const wrong = [];
  if (!lines.some((l) => l.startsWith('| POST |') && l.includes('`/api/assistant/duty-menu/publish`'))) wrong.push('no BIBLE §11 POST row for /api/assistant/duty-menu/publish');
  const row = lines.find((l) => l.includes('`/api/assistant/attention`')) || '';
  const dutyPart = row.slice(Math.max(0, row.indexOf('duty-menu')));
  if (!/DList/.test(dutyPart)) wrong.push('the attention row\'s duty-menu part does not name the DList fallback');
  if (!/\b50\b/.test(dutyPart)) wrong.push('the attention row\'s duty-menu part does not name the 50-relay cap');
  assert(wrong.length === 0, wrong.join('; '));
});

test('S5: attention.js\'s header names the duty-menu check in its list of the checks run side by side, and in the answer\'s shape (sub-decision 9; NB9)', () => {
  const header = (safeRead(ATTENTION).match(/^\/\*\*[\s\S]*?\*\//) || [''])[0];
  const lines = header.split(NL);
  const wrong = [];
  const i = lines.findIndex((l) => /checked, side by side/.test(l));
  if (i < 0) wrong.push('the header says which actions are checked side by side');
  else {
    let para = '';
    for (let j = i; j < lines.length && lines[j].trim() !== '*'; j += 1) para += lines[j];
    if (!/duty-menu|Duty Menu/.test(para) || /\bThree actions\b/.test(para)) wrong.push(`that paragraph does not name the duty-menu check among them: ${show(para.replace(/\s*\*\s*/g, ' ').trim())}`);
  }
  const shape = lines.find((l) => /an assistant\s+→/.test(l)) || '';
  if (!/duty-menu/.test(shape)) wrong.push('the answer\'s shape does not name duty-menu');
  assert(wrong.length === 0, wrong.join('; '));
});

test('S6: the fail-closed route table opens POST /api/assistant/duty-menu/publish to a signed-in person, with a why, in the same shape as the Outbox Relays publish entry — so a customer is not refused as owner-only (ADR 0002 Amendment 2 item 1; AC-2). test/admin-action-sweep-access.test.js AC4 derives its reachability walk from this table.', () => {
  const { ROUTE_ACCESS: table } = load(ROUTE_ACCESS, 'It is the fail-closed route table (ADR security-auth-exposure/0005).');
  const entry = table && table['POST /api/assistant/duty-menu/publish'];
  const outbox = table && table['POST /api/assistant/outbox-relays/publish'];
  const wrong = [];
  if (!entry) wrong.push('no entry for POST /api/assistant/duty-menu/publish');
  else {
    if (entry.access !== 'signed-in') wrong.push(`access: want 'signed-in', got ${show(entry.access)}`);
    if (typeof entry.why !== 'string' || entry.why.trim().length < 10) wrong.push(`a why: got ${show(entry.why)}`);
    if (outbox && !sameJson(Object.keys(entry).sort(), Object.keys(outbox).sort())) wrong.push(`the outbox entry's shape ${show(Object.keys(outbox).sort())}, got ${show(Object.keys(entry).sort())}`);
    if (outbox && entry.kind !== outbox.kind) wrong.push(`kind: want ${show(outbox.kind)} as the outbox entry, got ${show(entry.kind)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

async function run() {
  console.log(`${NL}=== assistant-duty-menu-publish (assistant-duty-menu #2) ===`);
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      const r = await fn();
      if (r === 'SKIP') { console.log(`  SKIP  ${name}`); skipped++; }
      else { console.log(`  PASS  ${name}`); pass++; }
    } catch (err) {
      console.log(`  FAIL  ${name}${NL}        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`${NL}assistant-duty-menu-publish: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

module.exports = { run };
