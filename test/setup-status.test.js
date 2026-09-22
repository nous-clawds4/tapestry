'use strict';
/**
 * setup-status-and-alert #1: /setup shows where you stand.
 *
 * Story: engineering-team/stories/done/setup-status-and-alert/1-setup-shows-where-you-stand.md
 * ADR:   engineering-team/decisions/done/setup-status-and-alert/0001-one-setup-status-answer.md
 * Plan:  engineering-team/stories/done/setup-status-and-alert/1-setup-shows-where-you-stand.test-plan.md
 * Browser half: tests/brainstorm/setup-status.spec.js (B-class — what a viewer SEES on /setup).
 *
 * Classes:
 *   U — src/api/setup/status.js driven through the dependencies ADR 0001 names (getAssistantPubkeyFor,
 *       scanLocal, readRelay, readConfiguredRelays, mapDefaultRelays, getConfigFromFile). Stack-free:
 *       no strfry, no relays, no network.
 *   X — scanLocalStrict against a FAKE `strfry`: a throwaway shell script put first on PATH. The real
 *       spawn, exit-code and timeout handling run; no strfry needs to be installed.
 *   C — the pure UI util (ui/src/utils/setupStatus.js) and the /setup copy (ui/src/pages/setup/steps.js),
 *       loaded in Node as ESM.
 *   S — source sentinels on the server: the route is registered, the module never writes, no pubkey
 *       literal, the route is documented.
 *   D — source sentinels on the UI files this runner cannot execute (JSX): the provider, where App.jsx
 *       mounts it, the page reading it.
 *   R — regressions that pass before and after: the approved copy and the step routes.
 *   H — the live contract on whatever instance is reachable (BRAINSTORM_BASE_URL, else localhost:7778).
 *       H1 is one GET. H2 signs in a THROWAWAY guest key (it creates a session and publishes nothing)
 *       and runs only with SETUP_STATUS_LIVE_SIGN_IN=1. The local Docker stack has no bind mount, so
 *       H1 stays red there until /cycle-local deploys the server change.
 *
 * Everything except R FAILS against the current code: src/api/setup/status.js,
 * ui/src/utils/setupStatus.js and ui/src/context/SetupStatusContext.jsx do not exist, the copy has no
 * done sentences, and /api/setup/status answers 404.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const REPO = path.resolve(__dirname, '..');
const STATUS_MODULE = path.join(REPO, 'src/api/setup/status.js');
const API_INDEX = path.join(REPO, 'src/api/index.js');
const OPENAPI = path.join(REPO, 'src/api/openapi.yaml');
const UI_UTIL = path.join(REPO, 'ui/src/utils/setupStatus.js');
const STEPS = path.join(REPO, 'ui/src/pages/setup/steps.js');
const PAGE = path.join(REPO, 'ui/src/pages/setup/Index.jsx');
const PROVIDER = path.join(REPO, 'ui/src/context/SetupStatusContext.jsx');
const APP = path.join(REPO, 'ui/src/App.jsx');
const HOST_BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';
const NL = String.fromCharCode(10);

// Fixture keys, never live ones. TA stands in for an instance TA: the suite never reads a real one.
const VIEWER = 'a1'.repeat(32);
const ASSISTANT = 'a2'.repeat(32);
const OTHER = 'b2'.repeat(32);
const OTHER2 = 'c3'.repeat(32);
const TA = 'ee'.repeat(32);
const CUSTOMER_ASSISTANT = 'd4'.repeat(32);

// Fixture relays.
const GP = 'wss://general.example';
const WOT = 'wss://wot.example';
const PROFILE = 'wss://profiles.example';
const NIP85 = 'wss://nip85.example';

// ADR 0001 § Implementation notes 1.
const FOLLOW_LIST_RELAY_CATEGORIES = ['aPopularGeneralPurposeRelays', 'aWotRelays', 'aProfileRelays'];
const RELAY_BUDGET_MS = 8000;
const LOCAL_SCAN_TIMEOUT_MS = 5000;

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
const show = (v) => JSON.stringify(v);

/** Key-order-blind JSON equality. */
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    return Object.keys(v).sort().reduce((o, k) => { o[k] = sortKeys(v[k]); return o; }, {});
  }
  return v;
}
const sameJson = (a, b) => show(sortKeys(a)) === show(sortKeys(b));

let hExecuted = 0;
let hSkipped = 0;

/* ───────────────────────── fixtures ───────────────────────── */

let idSeq = 0;
const hexId = (n) => n.toString(16).padStart(64, '0');

function ev(kind, pubkey, createdAt, tags, id) {
  idSeq += 1;
  return { id: id || hexId(idSeq), pubkey, kind, created_at: createdAt, tags, content: '', sig: '0'.repeat(128) };
}
const followList = (pubkey, followed, createdAt = 1000, id) => ev(3, pubkey, createdAt, followed.map((p) => ['p', p]), id);
const treasureMap = (pubkey, tags, createdAt = 1000, id) => ev(10040, pubkey, createdAt, tags, id);
const rank = (pk) => ['30382:rank', pk, NIP85];
const followers = (pk) => ['30382:followers', pk, NIP85];

/** The module under test — or a failure that says exactly what is missing. */
function statusModule() {
  if (!fs.existsSync(STATUS_MODULE)) {
    throw new Error('src/api/setup/status.js does not exist. ADR setup-status-and-alert/0001 creates it: the one module ' +
      'that answers /setup\'s three steps for the session\'s viewer (handleSetupStatus, lookupNewest, evaluateSteps, ' +
      'followListRelays, treasureMapRelays, outsideOnly, scanLocalStrict).');
  }
  delete require.cache[require.resolve(STATUS_MODULE)];
  return require(STATUS_MODULE);
}
function need(mod, name) {
  assert(typeof mod[name] === 'function', `src/api/setup/status.js must export ${name}() (ADR 0001 § Implementation notes 1).`);
  return mod[name];
}

/**
 * The injected dependencies, under the names ADR 0001 gives them. Every one RECORDS its calls.
 *   assistant   — what getAssistantPubkeyFor answers: default ASSISTANT; null = no assistant; 'throw'.
 *   local       — { 3: events | 'reject', 10040: events | 'reject' }: what this instance's relay holds.
 *   relays      — { [url]: events | 'unreachable' | 'hang' | 'throw' }: each outside relay. An unlisted
 *                 relay is unreachable. An array answers `ok` with the events of the kinds asked for.
 *   configured  — what readConfiguredRelays answers (the follow-list relays); default [GP, WOT, PROFILE].
 *   mapDefaults — what mapDefaultRelays answers (the Map relays); default [NIP85, GP].
 *   config      — getConfigFromFile's values (BRAINSTORM_RELAY_URL, STRFRY_DOMAIN).
 */
function fakes(opts = {}) {
  const calls = { getAssistantPubkeyFor: [], scanLocal: [], readRelay: [], readConfiguredRelays: [], mapDefaultRelays: 0 };
  const deps = {
    getAssistantPubkeyFor: async (pk) => {
      calls.getAssistantPubkeyFor.push(pk);
      if (opts.assistant === 'throw') throw new Error('fixture: the key store exploded');
      return opts.assistant === undefined ? ASSISTANT : opts.assistant;
    },
    scanLocal: async (filter) => {
      calls.scanLocal.push(filter);
      const kind = filter && Array.isArray(filter.kinds) ? filter.kinds[0] : undefined;
      const held = opts.local ? opts.local[kind] : undefined;
      if (held === 'reject') throw new Error('fixture: strfry scan failed');
      return Array.isArray(held) ? held.slice() : [];
    },
    readRelay: async (url, filter) => {
      calls.readRelay.push({ url, kinds: filter && filter.kinds, authors: filter && filter.authors });
      const answer = opts.relays ? opts.relays[url] : undefined;
      if (answer === 'hang') return new Promise(() => {});
      if (answer === 'throw') throw new Error('fixture: the relay read threw');
      if (!Array.isArray(answer)) return { status: 'unreachable', events: [], error: 'fixture: unreachable' };
      const kinds = (filter && filter.kinds) || [];
      return { status: 'ok', events: answer.filter((e) => kinds.includes(e.kind)), error: null };
    },
    readConfiguredRelays: (categories) => {
      calls.readConfiguredRelays.push(categories);
      return (opts.configured || [GP, WOT, PROFILE]).slice();
    },
    mapDefaultRelays: () => {
      calls.mapDefaultRelays += 1;
      return (opts.mapDefaults || [NIP85, GP]).slice();
    },
    getConfigFromFile: (key, dflt) => (opts.config && Object.prototype.hasOwnProperty.call(opts.config, key) ? opts.config[key] : dflt),
  };
  return { deps, calls };
}

function fakeRes() {
  const res = { statusCode: 200, body: undefined };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}
const signedInReq = (pubkey = VIEWER, extra = {}) => ({ session: { authenticated: true, pubkey }, query: {}, ...extra });

async function answer(opts, req = signedInReq()) {
  const handle = need(statusModule(), 'handleSetupStatus');
  const { deps, calls } = fakes(opts);
  const res = fakeRes();
  await handle(req, res, deps);
  return { res, body: res.body, steps: res.body && res.body.steps, calls };
}

/** Resolve within `ms`, or report 'HUNG' — clearing the timer either way. */
async function within(promise, ms) {
  let timer;
  const hung = new Promise((resolve) => { timer = setTimeout(() => resolve('HUNG'), ms); });
  try { return await Promise.race([promise, hung]); } finally { clearTimeout(timer); }
}

async function loadEsm(absPath) {
  try { return await import(pathToFileURL(absPath).href); } catch (err) { return { __loadError: err }; }
}

/* ───────────────────────── U — the handler ───────────────────────── */

test('U1: without an authenticated session the endpoint answers { success: true, signedIn: false } and asks nothing', async () => {
  const handle = need(statusModule(), 'handleSetupStatus');
  const cases = [
    ['no session at all', {}],
    ['an empty session', { session: {} }],
    ['a sign-in still pending (authenticated unset)', { session: { pubkey: VIEWER } }],
    ['authenticated is not exactly true', { session: { authenticated: 'true', pubkey: VIEWER } }],
    ['a session pubkey that is not 64-hex', { session: { authenticated: true, pubkey: 'npub1notahexkey' } }],
    ['a trusted loopback call with no session', { localTrusted: true }],
  ];
  for (const [label, req] of cases) {
    const { deps, calls } = fakes();
    const res = fakeRes();
    await handle({ query: {}, ...req }, res, deps);
    assert(res.statusCode === 200, `${label}: expected HTTP 200, got ${res.statusCode}`);
    assert(sameJson(res.body, { success: true, signedIn: false }),
      `${label}: expected exactly { success: true, signedIn: false }, got ${show(res.body)}`);
    const asked = calls.getAssistantPubkeyFor.length + calls.scanLocal.length + calls.readRelay.length;
    assert(asked === 0, `${label}: a visitor with no session must cost nothing, but the handler asked ${asked} question(s): ${show(calls)}`);
  }
});

test('U2: the viewer is the session\'s pubkey — no query parameter can ask about someone else or name a relay', async () => {
  const handle = need(statusModule(), 'handleSetupStatus');
  const opts = { local: { 3: [followList(VIEWER, [OTHER])], 10040: [] }, relays: { [NIP85]: [], [GP]: [], 'wss://evil.example': [] } };
  const plain = fakes(opts);
  const plainRes = fakeRes();
  await handle(signedInReq(), plainRes, plain.deps);
  const probed = fakes(opts);
  const probedRes = fakeRes();
  await handle(signedInReq(VIEWER, { query: { pubkey: OTHER, customerPubkey: OTHER, relays: 'wss://evil.example', kinds: '0' } }), probedRes, probed.deps);
  assert(plainRes.body && plainRes.body.success === true, `the plain signed-in request must succeed, got ${show(plainRes.body)}`);
  assert(sameJson(plainRes.body, probedRes.body), `query parameters changed the answer: without ${show(plainRes.body)}, with ${show(probedRes.body)}`);
  assert(show(probed.calls.getAssistantPubkeyFor) === show([VIEWER]),
    `getAssistantPubkeyFor must be asked about the session's viewer only; it was asked about ${show(probed.calls.getAssistantPubkeyFor)}`);
  for (const f of probed.calls.scanLocal) {
    assert(f && show(f.authors) === show([VIEWER]), `every local scan must ask for the viewer's events only; one asked for ${show(f && f.authors)}`);
  }
  assert(!probed.calls.readRelay.some((c) => String(c.url).includes('evil.example')),
    'a relay named in the query string was read: relays come from Relay Settings only');
});

test('U3: step 1 is done exactly when this instance holds an assistant for the viewer, and steps 2 and 3 are still checked without one (AC-2)', async () => {
  const cases = [
    [ASSISTANT, { done: true, pending: false, finished: true }],
    [null, { done: false, pending: true, finished: true }],
  ];
  for (const [assistant, expected] of cases) {
    const { steps, body } = await answer({ assistant, local: { 3: [followList(VIEWER, [OTHER])], 10040: [] }, relays: { [NIP85]: [], [GP]: [] } });
    const got = steps && steps.account;
    assert(got && got.done === expected.done && got.pending === expected.pending && got.finished === expected.finished,
      `assistant ${assistant ? 'held' : 'not held'}: steps.account must be ${show(expected)}, got ${show(got)} (answer ${show(body)})`);
    assert(steps.follow && steps.follow.done === true,
      `assistant ${assistant ? 'held' : 'not held'}: the follow list is checked whoever the viewer is — expected steps.follow.done, got ${show(steps.follow)}`);
  }
});

test('U4: a follow list and a Map on this instance\'s relay decide steps 2 and 3, and no outside relay is asked (AC-3)', async () => {
  const { steps, calls } = await answer({
    local: { 3: [followList(VIEWER, [OTHER])], 10040: [treasureMap(VIEWER, [rank(ASSISTANT), followers(ASSISTANT)])] },
    // Newer copies outside, which must never be read: this instance's relay answers first.
    relays: { [GP]: [followList(VIEWER, [], 9999), treasureMap(VIEWER, [], 9999)], [NIP85]: [treasureMap(VIEWER, [], 9999)] },
  });
  assert(calls.readRelay.length === 0, `AC-3: with both events on this instance's relay, no outside relay may be read; it read ${show(calls.readRelay.map((c) => c.url))}`);
  assert(steps && steps.follow && steps.follow.done === true && steps.follow.source === 'local',
    `steps.follow must be done, from the local copy (source 'local'), got ${show(steps && steps.follow)}`);
  assert(steps.activate && steps.activate.done === true && steps.activate.source === 'local',
    `steps.activate must be done, from the local copy (source 'local'), got ${show(steps.activate)}`);
});

test('U5: the newest event wins — among local copies, and on a local miss across the relays that answered; a created_at tie goes to the lowest id', async () => {
  const lookupNewest = need(statusModule(), 'lookupNewest');

  const localOld = followList(VIEWER, [OTHER], 100);
  const localNew = followList(VIEWER, [], 200);
  const local = fakes({ local: { 3: [localOld, localNew] } });
  const fromLocal = await lookupNewest({ kind: 3, pubkey: VIEWER, relays: [GP] }, local.deps);
  assert(fromLocal && fromLocal.finished === true && fromLocal.source === 'local' && fromLocal.event && fromLocal.event.id === localNew.id,
    `two local copies: the newer (…${localNew.id.slice(-4)}) must win, got ${show(fromLocal && { ...fromLocal, event: fromLocal.event && fromLocal.event.id })}`);

  const older = followList(VIEWER, [OTHER], 300);
  const newer = followList(VIEWER, [], 400);
  const relays = fakes({ local: { 3: [] }, relays: { [GP]: [older], [WOT]: [newer], [PROFILE]: 'unreachable' } });
  const fromRelays = await lookupNewest({ kind: 3, pubkey: VIEWER, relays: [GP, WOT, PROFILE] }, relays.deps);
  assert(fromRelays && fromRelays.finished === true && fromRelays.source === 'relay' && fromRelays.event && fromRelays.event.id === newer.id,
    `on a local miss the newest across relays (…${newer.id.slice(-4)}) must win, got ${show(fromRelays && { ...fromRelays, event: fromRelays.event && fromRelays.event.id })}`);

  const low = followList(VIEWER, [OTHER], 500, '0a'.repeat(32));
  const high = followList(VIEWER, [], 500, '0b'.repeat(32));
  const tie = fakes({ local: { 3: [] }, relays: { [GP]: [high], [WOT]: [low] } });
  const tied = await lookupNewest({ kind: 3, pubkey: VIEWER, relays: [GP, WOT] }, tie.deps);
  assert(tied && tied.event && tied.event.id === low.id,
    `NIP-01: on equal created_at the lexically lowest id wins — expected …${low.id.slice(-4)}, got …${tied && tied.event && String(tied.event.id).slice(-4)}`);
});

test('U6: on a local miss with every outside relay unreachable (or throwing), the check has not finished — reason outside-unreachable', async () => {
  const lookupNewest = need(statusModule(), 'lookupNewest');
  const { deps } = fakes({ local: { 3: [] }, relays: { [GP]: 'unreachable', [WOT]: 'throw' } });
  const got = await lookupNewest({ kind: 3, pubkey: VIEWER, relays: [GP, WOT] }, deps);
  assert(got && got.finished === false && got.reason === 'outside-unreachable',
    `nothing outside answered, so nothing is known: expected { finished: false, reason: 'outside-unreachable' }, got ${show(got)}`);
});

test('U7: one outside relay answering with nothing is enough to finish — the event is absent (story 2 § When a check has finished)', async () => {
  const lookupNewest = need(statusModule(), 'lookupNewest');
  const { deps } = fakes({ local: { 3: [] }, relays: { [GP]: [], [WOT]: 'unreachable' } });
  const got = await lookupNewest({ kind: 3, pubkey: VIEWER, relays: [GP, WOT] }, deps);
  assert(got && got.finished === true && got.event == null && got.source == null,
    `one relay answered and had nothing: expected { finished: true, event: null, source: null }, got ${show(got)}`);
});

test('U8: a relay that never answers is given up at RELAY_BUDGET_MS (8 s) and counted unreachable; the other relays\' answer stands', async () => {
  const mod = statusModule();
  const lookupNewest = need(mod, 'lookupNewest');
  assert(mod.RELAY_BUDGET_MS === RELAY_BUDGET_MS,
    `ADR 0001: RELAY_BUDGET_MS is ${RELAY_BUDGET_MS} (the /api/relay/external strict budget); got ${show(mod.RELAY_BUDGET_MS)}`);
  const found = followList(VIEWER, [OTHER], 600);
  const { deps } = fakes({ local: { 3: [] }, relays: { [GP]: 'hang', [WOT]: [found] } });
  const limit = RELAY_BUDGET_MS + 2500;
  const got = await within(lookupNewest({ kind: 3, pubkey: VIEWER, relays: [GP, WOT] }, deps), limit);
  assert(got !== 'HUNG', `the lookup was still waiting ${limit} ms after it started: a relay that never answers must be given up at the budget`);
  assert(got.finished === true && got.event && got.event.id === found.id,
    `the relay that answered must decide, got ${show(got && { ...got, event: got.event && got.event.id })}`);
});

test('U9: a local scan that fails is not a miss — the check has not finished (local-unreadable) and no outside relay is read', async () => {
  const lookupNewest = need(statusModule(), 'lookupNewest');
  const { deps, calls } = fakes({ local: { 3: 'reject' }, relays: { [GP]: [followList(VIEWER, [OTHER])] } });
  const got = await lookupNewest({ kind: 3, pubkey: VIEWER, relays: [GP] }, deps);
  assert(got && got.finished === false && got.reason === 'local-unreadable',
    `a failed scan says nothing about what is there: expected { finished: false, reason: 'local-unreadable' }, got ${show(got)}`);
  assert(calls.readRelay.length === 0, `ADR 0001: a local-unreadable check stops there; it read ${show(calls.readRelay.map((c) => c.url))}`);
});

test('U10: with no outside relay configured, a local miss has not finished (no-outside-relays) — silence is not evidence', async () => {
  const lookupNewest = need(statusModule(), 'lookupNewest');
  const { deps } = fakes({ local: { 3: [] } });
  const got = await lookupNewest({ kind: 3, pubkey: VIEWER, relays: [] }, deps);
  assert(got && got.finished === false && got.reason === 'no-outside-relays',
    `expected { finished: false, reason: 'no-outside-relays' }, got ${show(got)}`);
  const { steps } = await answer({ configured: [], mapDefaults: [], local: { 3: [], 10040: [] } });
  assert(steps && steps.follow && steps.follow.finished === false && steps.follow.reason === 'no-outside-relays' && steps.follow.done === false && steps.follow.pending === false,
    `through the handler, steps.follow must be unfinished with reason no-outside-relays and neither done nor pending; got ${show(steps && steps.follow)}`);
  assert(steps.activate && steps.activate.finished === false && steps.activate.reason === 'no-outside-relays' && steps.activate.done === false && steps.activate.pending === false,
    `through the handler, steps.activate must be unfinished with reason no-outside-relays and neither done nor pending; got ${show(steps.activate)}`);
  assert(steps.account && steps.account.finished === true, `step 1 is answered regardless, got ${show(steps.account)}`);
});

test('U11: only the viewer\'s own events of the asked kind count — anything else the local relay returns is ignored', async () => {
  const lookupNewest = need(statusModule(), 'lookupNewest');
  const mine = followList(VIEWER, [OTHER], 100);
  const { deps } = fakes({
    local: { 3: [ev(3, OTHER, 900, [['p', OTHER2]]), ev(0, VIEWER, 950, [])] },
    relays: { [GP]: [mine] },
  });
  const got = await lookupNewest({ kind: 3, pubkey: VIEWER, relays: [GP] }, deps);
  assert(got && got.finished === true && got.source === 'relay' && got.event && got.event.id === mine.id,
    `another author's kind 3 and the viewer's kind 0 are not the viewer's follow list, so this is a local miss; expected the relay's event, got ${show(got && { ...got, event: got.event && got.event.id })}`);
});

test('U12: each check asks this instance\'s relay for the viewer\'s own kind 3 and kind 10040', async () => {
  const { calls } = await answer({ local: { 3: [followList(VIEWER, [OTHER])], 10040: [treasureMap(VIEWER, [rank(ASSISTANT), followers(ASSISTANT)])] } });
  const kinds = calls.scanLocal.map((f) => show(f && f.kinds)).sort();
  assert(show(kinds) === show([show([10040]), show([3])].sort()), `expected one local scan with kinds [3] and one with kinds [10040]; got ${show(calls.scanLocal)}`);
  for (const f of calls.scanLocal) assert(show(f.authors) === show([VIEWER]), `a local scan asked for authors ${show(f.authors)}; it must ask for the viewer only`);
});

test('U13: each kind reads its own relay list — follow lists from general-purpose, WoT and profile relays; Maps from the server\'s current-Map list', async () => {
  const mod = statusModule();
  assert(Array.isArray(mod.FOLLOW_LIST_RELAY_CATEGORIES) && show(mod.FOLLOW_LIST_RELAY_CATEGORIES) === show(FOLLOW_LIST_RELAY_CATEGORIES),
    `ADR 0001: FOLLOW_LIST_RELAY_CATEGORIES is ${show(FOLLOW_LIST_RELAY_CATEGORIES)}; got ${show(mod.FOLLOW_LIST_RELAY_CATEGORIES)}`);
  const { calls } = await answer({
    configured: [GP, WOT],
    mapDefaults: [NIP85, GP],
    local: { 3: [], 10040: [] },
    relays: { [GP]: [], [WOT]: [], [NIP85]: [] },
  });
  assert(calls.readConfiguredRelays.length > 0 && calls.readConfiguredRelays.every((c) => show(c) === show(FOLLOW_LIST_RELAY_CATEGORIES)),
    `readConfiguredRelays must be asked for exactly ${show(FOLLOW_LIST_RELAY_CATEGORIES)}; it was asked ${show(calls.readConfiguredRelays)}`);
  assert(calls.mapDefaultRelays > 0, 'the Map relays must come from mapDefaultRelays (currentMap.defaultRelays), which was never called');
  const urlsFor = (kind) => calls.readRelay.filter((c) => Array.isArray(c.kinds) && c.kinds.length === 1 && c.kinds[0] === kind).map((c) => c.url).sort();
  assert(show(urlsFor(3)) === show([GP, WOT].sort()), `kind 3 must be read from the follow-list relays ${show([GP, WOT])}; it was read from ${show(urlsFor(3))}`);
  assert(show(urlsFor(10040)) === show([GP, NIP85].sort()), `kind 10040 must be read from the Map relays ${show([NIP85, GP])}; it was read from ${show(urlsFor(10040))}`);
  const mixed = calls.readRelay.filter((c) => !Array.isArray(c.kinds) || c.kinds.length !== 1);
  assert(mixed.length === 0, `ADR 0001: each read asks for one kind ({ kinds: [kind], authors: [viewer] }); these did not: ${show(mixed)}`);
});

test('U14: outsideOnly drops this instance\'s own relay — loopback hosts, BRAINSTORM_RELAY_URL\'s host, STRFRY_DOMAIN — keeps ws/wss only, and de-duplicates', async () => {
  const outsideOnly = need(statusModule(), 'outsideOnly');
  const { deps } = fakes({ config: { BRAINSTORM_RELAY_URL: 'wss://mine.example/relay', STRFRY_DOMAIN: 'staging.example' } });
  const kept = outsideOnly([
    'ws://localhost:7777',
    'wss://127.0.0.1:4848',
    'ws://[::1]:7777',
    'wss://mine.example/relay',
    'wss://mine.example',
    'wss://staging.example/relay',
    'https://not-a-relay.example',
    'wss://relay.one.example/',
    'wss://RELAY.ONE.example',
    'wss://relay.two.example',
  ], deps);
  assert(Array.isArray(kept), `outsideOnly must return an array, got ${show(kept)}`);
  const hosts = kept.map((u) => new URL(u).hostname.toLowerCase()).sort();
  assert(show(hosts) === show(['relay.one.example', 'relay.two.example']),
    `expected only relay.one.example (once) and relay.two.example to survive; got ${show(kept)}`);
});

test('U15: a Map list that falls back to this instance\'s own relay (NIP-85 home unset) is never read as an outside answer', async () => {
  const { steps, calls } = await answer({
    config: { BRAINSTORM_RELAY_URL: 'ws://localhost:7777' },
    mapDefaults: ['ws://localhost:7777'],
    local: { 3: [followList(VIEWER, [OTHER])], 10040: [] },
    relays: { 'ws://localhost:7777': [] },
  });
  assert(!calls.readRelay.some((c) => String(c.url).includes('localhost')),
    `this instance's own relay was read as an outside relay: ${show(calls.readRelay.map((c) => c.url))}`);
  assert(steps && steps.activate && steps.activate.finished === false && steps.activate.reason === 'no-outside-relays' && steps.activate.pending === false,
    `with only this instance's own relay configured, step 3 has no outside answer: expected unfinished (no-outside-relays), got ${show(steps && steps.activate)}`);
});

/* ───────────────────────── U — the rules (evaluateSteps) ───────────────────────── */

function finishedWith(event) { return { finished: true, event, source: event ? 'local' : null }; }
const UNFINISHED = { finished: false, reason: 'outside-unreachable' };

test('U16: step 2 counts distinct 64-hex follows other than the viewer; done at one or more (AC-2)', async () => {
  const evaluateSteps = need(statusModule(), 'evaluateSteps');
  const map = finishedWith(null);
  const cases = [
    ['one follow', followList(VIEWER, [OTHER]), 1, true],
    ['only the viewer', followList(VIEWER, [VIEWER]), 0, false],
    ['nobody', followList(VIEWER, []), 0, false],
    ['duplicates, self, junk and upper case', followList(VIEWER, [OTHER, OTHER, VIEWER, 'nothex', OTHER2.toUpperCase(), VIEWER.toUpperCase()]), 2, true],
    ['a p tag with no value', ev(3, VIEWER, 1000, [['p'], ['e', OTHER], ['p', OTHER]]), 1, true],
  ];
  for (const [label, event, count, done] of cases) {
    const out = evaluateSteps({ viewer: VIEWER, assistantPubkey: ASSISTANT, follow: finishedWith(event), map });
    const f = out && out.follow;
    assert(f && f.followCount === count && f.done === done && f.pending === !done && f.finished === true,
      `${label}: expected { followCount: ${count}, done: ${done}, pending: ${!done}, finished: true }, got ${show(f)}`);
  }
  const none = evaluateSteps({ viewer: VIEWER, assistantPubkey: ASSISTANT, follow: finishedWith(null), map });
  assert(none.follow && none.follow.done === false && none.follow.pending === true && none.follow.followCount === 0,
    `no follow list anywhere (the check finished): expected not done, pending, followCount 0; got ${show(none.follow)}`);
  const open = evaluateSteps({ viewer: VIEWER, assistantPubkey: ASSISTANT, follow: UNFINISHED, map });
  assert(open.follow && open.follow.done === false && open.follow.pending === false && open.follow.finished === false,
    `an unfinished check is neither done nor pending: got ${show(open.follow)}`);
});

test('U17: step 3 is done only when the Map names the viewer\'s assistant for both rank and followers; another provider is not done and never pending (AC-2)', async () => {
  const evaluateSteps = need(statusModule(), 'evaluateSteps');
  const follow = finishedWith(followList(VIEWER, [OTHER]));
  const A = ASSISTANT;
  const cases = [
    ['rank and followers name the assistant', A, [rank(A), followers(A)], { done: true, pending: false, otherProvider: false }],
    ['rank only', A, [rank(A)], { done: false, pending: true, otherProvider: false }],
    ['followers only', A, [followers(A)], { done: false, pending: true, otherProvider: false }],
    ['both name another provider', A, [rank(OTHER), followers(OTHER)], { done: false, pending: false, otherProvider: true }],
    ['rank mine, followers another provider', A, [rank(A), followers(OTHER)], { done: false, pending: false, otherProvider: true }],
    ['rank another provider, followers mine', A, [rank(OTHER), followers(A)], { done: false, pending: false, otherProvider: true }],
    ['the first VALID rank entry counts (an invalid one is skipped)', A, [['30382:rank', 'zz'], rank(A), followers(A)], { done: true, pending: false, otherProvider: false }],
    ['the first valid rank entry wins over a later one', A, [rank(OTHER), rank(A), followers(A)], { done: false, pending: false, otherProvider: true }],
    ['upper-case pubkeys in the Map', A, [rank(A.toUpperCase()), followers(A.toUpperCase())], { done: true, pending: false, otherProvider: false }],
    ['only list entries naming the assistant', A, [['39998:dog-breed', A, NIP85], ['30392', A, NIP85]], { done: false, pending: true, otherProvider: false }],
    ['no assistant; the Map names a provider', null, [rank(OTHER), followers(OTHER)], { done: false, pending: false, otherProvider: true }],
    ['no assistant; the Map names nobody', null, [['39998:dog-breed', OTHER, NIP85]], { done: false, pending: true, otherProvider: false }],
    ['the Owner: the assistant IS the TA, and the Map names the TA', TA, [rank(TA), followers(TA)], { done: true, pending: false, otherProvider: false }],
    ['a Customer whose Map names the instance TA, not their own assistant', CUSTOMER_ASSISTANT, [rank(TA), followers(TA)], { done: false, pending: false, otherProvider: true }],
  ];
  for (const [label, assistantPubkey, tags, expected] of cases) {
    const out = evaluateSteps({ viewer: VIEWER, assistantPubkey, follow, map: finishedWith(treasureMap(VIEWER, tags)) });
    const a = out && out.activate;
    assert(a && a.done === expected.done && a.pending === expected.pending && a.otherProvider === expected.otherProvider && a.finished === true,
      `${label}: expected ${show({ ...expected, finished: true })}, got ${show(a)}`);
    assert(!(a.pending && a.done), `${label}: pending must imply not done, got ${show(a)}`);
    assert(!(a.otherProvider && a.pending), `${label}: another provider is never pending, got ${show(a)}`);
  }
  const noMap = evaluateSteps({ viewer: VIEWER, assistantPubkey: A, follow, map: finishedWith(null) }).activate;
  assert(noMap && noMap.done === false && noMap.pending === true && noMap.otherProvider === false,
    `no Map anywhere (the check finished): expected not done, pending, not another provider; got ${show(noMap)}`);
  const open = evaluateSteps({ viewer: VIEWER, assistantPubkey: A, follow, map: UNFINISHED }).activate;
  assert(open && open.done === false && open.pending === false && open.finished === false,
    `an unfinished Map check is neither done nor pending: got ${show(open)}`);
});

test('U18: the signed-in answer has the ADR\'s shape, copies source and reason onto the steps, and carries no pubkeys', async () => {
  const { res, body, steps } = await answer({
    local: { 3: [followList(VIEWER, [OTHER, OTHER2])], 10040: [] },
    mapDefaults: [NIP85],
    relays: { [NIP85]: 'unreachable' },
  });
  assert(res.statusCode === 200 && body && body.success === true && body.signedIn === true, `expected a 200 { success: true, signedIn: true, … }, got ${res.statusCode} ${show(body)}`);
  assert(sameJson(Object.keys(body).sort(), ['signedIn', 'steps', 'success']), `the answer holds success, signedIn and steps only; got keys ${show(Object.keys(body))}`);
  assert(steps && sameJson(Object.keys(steps).sort(), ['account', 'activate', 'follow']), `steps holds account, follow and activate; got ${show(steps && Object.keys(steps))}`);
  const f = steps.follow;
  assert(f.done === true && f.pending === false && f.finished === true && f.followCount === 2 && f.source === 'local',
    `steps.follow: expected { done: true, pending: false, finished: true, followCount: 2, source: 'local' }, got ${show(f)}`);
  const a = steps.activate;
  assert(a.done === false && a.pending === false && a.finished === false && a.reason === 'outside-unreachable' && a.source == null,
    `steps.activate (local miss, the only Map relay unreachable): expected unfinished with reason 'outside-unreachable' and no source; got ${show(a)}`);
  const text = show(body);
  assert(!text.includes(VIEWER) && !text.includes(ASSISTANT), 'the answer must carry no pubkeys, not even the viewer\'s or the assistant\'s');
});

test('U19: an unexpected throw answers 500 { success: false, error: "Could not check setup status" }', async () => {
  const { res } = await answer({ assistant: 'throw' });
  assert(res.statusCode === 500, `expected HTTP 500, got ${res.statusCode} ${show(res.body)}`);
  assert(sameJson(res.body, { success: false, error: 'Could not check setup status' }),
    `expected { success: false, error: 'Could not check setup status' }, got ${show(res.body)}`);
});

test('U20: the two lookups are independent — a local follow list does not stop the Map from being looked for outside', async () => {
  const { calls, steps } = await answer({
    local: { 3: [followList(VIEWER, [OTHER])], 10040: [] },
    relays: { [NIP85]: [treasureMap(VIEWER, [rank(ASSISTANT), followers(ASSISTANT)], 700)], [GP]: [] },
  });
  const kindsRead = calls.readRelay.map((c) => show(c.kinds));
  assert(kindsRead.length > 0 && kindsRead.every((k) => k === show([10040])),
    `only the Map should be read outside (the follow list was found locally); reads asked for ${show(kindsRead)}`);
  assert(steps && steps.activate && steps.activate.done === true && steps.activate.source === 'relay',
    `the Map found outside must make step 3 done, from source 'relay'; got ${show(steps && steps.activate)}`);
});

/* ───────────────────────── X — scanLocalStrict with a fake strfry ───────────────────────── */

const SCAN_A = ev(3, VIEWER, 100, [['p', OTHER]], '1a'.repeat(32));
const SCAN_B = ev(3, VIEWER, 200, [], '1b'.repeat(32));

function fakeStrfryDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'setup-status-strfry-'));
  const script = [
    '#!/bin/sh',
    'if [ -n "$FAKE_STRFRY_ARGS" ]; then printf %s "$1" > "$FAKE_STRFRY_ARGS.0"; printf %s "$2" > "$FAKE_STRFRY_ARGS.1"; fi',
    'case "$FAKE_STRFRY_MODE" in',
    `  ok) echo 'strfry: a log line, not an event'; echo '${show(SCAN_A)}'; echo '${show(SCAN_B)}'; exit 0 ;;`,
    `  fail) echo '${show(SCAN_A)}'; exit 1 ;;`,
    '  hang) sleep 5; exit 0 ;;',
    'esac',
    'exit 3',
  ].join(NL) + NL;
  fs.writeFileSync(path.join(dir, 'strfry'), script, { mode: 0o755 });
  return dir;
}

/** Run `fn` with PATH (and the fake's env) set, restoring every variable afterwards. */
async function withEnv(vars, fn) {
  const saved = {};
  for (const k of Object.keys(vars)) saved[k] = process.env[k];
  Object.assign(process.env, vars);
  try { return await fn(); } finally {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
}

async function settle(promise, ms) {
  return within(promise.then((value) => ({ value }), (error) => ({ error })), ms);
}

test('X1: scanLocalStrict passes the filter to `strfry scan` and resolves every event line, skipping log lines', async () => {
  const scanLocalStrict = need(statusModule(), 'scanLocalStrict');
  const dir = fakeStrfryDir();
  const argsFile = path.join(dir, 'args');
  const filter = { kinds: [3], authors: [VIEWER] };
  const out = await withEnv({ PATH: `${dir}${path.delimiter}${process.env.PATH}`, FAKE_STRFRY_MODE: 'ok', FAKE_STRFRY_ARGS: argsFile },
    () => settle(scanLocalStrict(filter), 4000));
  assert(out !== 'HUNG', 'scanLocalStrict did not settle within 4 s against a strfry that exits at once');
  assert(!out.error, `a strfry that exits 0 must resolve; it rejected: ${out.error && out.error.message}`);
  const ids = (out.value || []).map((e) => e && e.id);
  assert(show(ids) === show([SCAN_A.id, SCAN_B.id]), `expected the two event lines, in order, and no log line; got ${show(out.value)}`);
  assert(safeRead(`${argsFile}.0`) === 'scan', `strfry must be run as \`strfry scan <filter>\`; its first argument was ${show(safeRead(`${argsFile}.0`))}`);
  let passed = null;
  try { passed = JSON.parse(safeRead(`${argsFile}.1`)); } catch { passed = null; }
  assert(passed && sameJson(passed, filter), `the filter must be passed as JSON; strfry received ${show(safeRead(`${argsFile}.1`))}`);
});

test('X2: scanLocalStrict rejects when strfry exits non-zero, even though it printed an event', async () => {
  const scanLocalStrict = need(statusModule(), 'scanLocalStrict');
  const dir = fakeStrfryDir();
  const out = await withEnv({ PATH: `${dir}${path.delimiter}${process.env.PATH}`, FAKE_STRFRY_MODE: 'fail' },
    () => settle(scanLocalStrict({ kinds: [3], authors: [VIEWER] }), 4000));
  assert(out !== 'HUNG', 'scanLocalStrict did not settle within 4 s against a strfry that exits at once');
  assert(out.error, `a failed scan (exit 1) must reject — reading it as the events it printed, or as "none here", is the defect ADR 0001 names; it resolved ${show(out.value)}`);
});

test('X3: scanLocalStrict rejects when strfry cannot be started at all', async () => {
  const scanLocalStrict = need(statusModule(), 'scanLocalStrict');
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'setup-status-nostrfry-'));
  const out = await withEnv({ PATH: empty }, () => settle(scanLocalStrict({ kinds: [3], authors: [VIEWER] }), 4000));
  assert(out !== 'HUNG', 'scanLocalStrict did not settle within 4 s when strfry is not on PATH');
  assert(out.error, `with no strfry on PATH the scan must reject; it resolved ${show(out.value)}`);
});

test('X4: scanLocalStrict rejects when strfry outlives the timeout (default LOCAL_SCAN_TIMEOUT_MS = 5000)', async () => {
  const mod = statusModule();
  const scanLocalStrict = need(mod, 'scanLocalStrict');
  assert(mod.LOCAL_SCAN_TIMEOUT_MS === LOCAL_SCAN_TIMEOUT_MS, `ADR 0001: LOCAL_SCAN_TIMEOUT_MS is ${LOCAL_SCAN_TIMEOUT_MS}; got ${show(mod.LOCAL_SCAN_TIMEOUT_MS)}`);
  const dir = fakeStrfryDir();
  const started = Date.now();
  const out = await withEnv({ PATH: `${dir}${path.delimiter}${process.env.PATH}`, FAKE_STRFRY_MODE: 'hang' },
    () => settle(scanLocalStrict({ kinds: [3], authors: [VIEWER] }, { timeoutMs: 300 }), 3000));
  assert(out !== 'HUNG', `scanLocalStrict ignored { timeoutMs: 300 }: still waiting after ${Date.now() - started} ms on a strfry that sleeps 5 s`);
  assert(out.error, `a scan that times out must reject; it resolved ${show(out.value)}`);
});

/* ───────────────────────── C — the UI util and the copy (ESM) ───────────────────────── */

async function uiUtil() {
  assert(fs.existsSync(UI_UTIL), 'ui/src/utils/setupStatus.js does not exist. ADR 0001 § Implementation notes 2 creates it: the pure ' +
    'summarizeSetup() both /setup and the pill read.');
  const mod = await loadEsm(UI_UTIL);
  assert(!mod.__loadError, `ui/src/utils/setupStatus.js must load in Node as ESM (relative imports with .js): ${mod.__loadError && mod.__loadError.message}`);
  assert(typeof mod.summarizeSetup === 'function', 'ui/src/utils/setupStatus.js must export summarizeSetup(answer)');
  return mod;
}

const NOT_ANSWERED_STEP = { done: false, pending: false, finished: false };

test('C1: summarizeSetup of anything but a signed-in answer is "not answered": every step neither done nor pending, both counts 0', async () => {
  const { summarizeSetup } = await uiUtil();
  const inputs = [
    ['null (still checking)', null],
    ['undefined', undefined],
    ['a failure', { success: false, error: 'x' }],
    ['signed out (an expired session)', { success: true, signedIn: false }],
    ['garbage', 'nope'],
  ];
  for (const [label, input] of inputs) {
    const out = summarizeSetup(input);
    assert(out && out.answered === false, `${label}: expected answered: false, got ${show(out)}`);
    for (const key of ['account', 'follow', 'activate']) {
      const s = out.steps && out.steps[key];
      assert(s && s.done === false && s.pending === false && s.finished === false,
        `${label}: steps.${key} must be ${show(NOT_ANSWERED_STEP)}, got ${show(s)}`);
    }
    assert(out.doneCount === 0 && out.pendingCount === 0, `${label}: expected doneCount 0 and pendingCount 0, got ${show(out)}`);
  }
});

test('C2: summarizeSetup of a signed-in answer passes the steps through and counts done and pending', async () => {
  const { summarizeSetup } = await uiUtil();
  const steps = {
    account: { done: true, pending: false, finished: true },
    follow: { done: false, pending: true, finished: true, followCount: 0, source: null },
    activate: { done: false, pending: false, finished: true, otherProvider: true, source: 'relay' },
  };
  const out = summarizeSetup({ success: true, signedIn: true, steps });
  assert(out && out.answered === true, `expected answered: true, got ${show(out)}`);
  assert(out.doneCount === 1 && out.pendingCount === 1, `expected doneCount 1 and pendingCount 1, got ${show({ doneCount: out.doneCount, pendingCount: out.pendingCount })}`);
  assert(out.steps && out.steps.activate && out.steps.activate.otherProvider === true && out.steps.follow.followCount === 0,
    `the step details (otherProvider, followCount) must pass through, got ${show(out.steps)}`);
  const all = summarizeSetup({ success: true, signedIn: true, steps: {
    account: { done: true, pending: false, finished: true },
    follow: { done: true, pending: false, finished: true, followCount: 27, source: 'local' },
    activate: { done: true, pending: false, finished: true, otherProvider: false, source: 'local' },
  } });
  assert(all.doneCount === 3 && all.pendingCount === 0, `all three done: expected 3 and 0, got ${show({ doneCount: all.doneCount, pendingCount: all.pendingCount })}`);
});

test('C3: a step marked both done and pending is counted done, never pending (pending implies not done)', async () => {
  const { summarizeSetup } = await uiUtil();
  const out = summarizeSetup({ success: true, signedIn: true, steps: {
    account: { done: true, pending: true, finished: true },
    follow: { done: false, pending: true, finished: true, followCount: 0 },
    activate: { done: false, pending: false, finished: false, reason: 'outside-unreachable' },
  } });
  assert(out.doneCount === 1 && out.pendingCount === 1, `expected doneCount 1 and pendingCount 1 (the done step is not pending), got ${show({ doneCount: out.doneCount, pendingCount: out.pendingCount })}`);
});

async function stepsCopy() {
  const mod = await loadEsm(STEPS);
  assert(!mod.__loadError, `ui/src/pages/setup/steps.js must load in Node as ESM: ${mod.__loadError && mod.__loadError.message}`);
  return mod;
}

test('C4: followDoneText says "1 account followed." and "{N} accounts followed."', async () => {
  const mod = await stepsCopy();
  assert(typeof mod.followDoneText === 'function', 'steps.js must export followDoneText(n) (ADR 0001 § Implementation notes 5)');
  assert(mod.followDoneText(1) === '1 account followed.', `followDoneText(1): expected "1 account followed.", got ${show(mod.followDoneText(1))}`);
  assert(mod.followDoneText(27) === '27 accounts followed.', `followDoneText(27): expected "27 accounts followed.", got ${show(mod.followDoneText(27))}`);
  assert(mod.followDoneText(2) === '2 accounts followed.', `followDoneText(2): expected "2 accounts followed.", got ${show(mod.followDoneText(2))}`);
});

test('C5: steps.js carries story 1\'s new copy verbatim (§ Copy)', async () => {
  const mod = await stepsCopy();
  const c = mod.CREATE_ACCOUNT_STEP || {};
  const a = mod.ACTIVATE_STEP || {};
  assert(c.doneText === 'This instance holds your Tapestry Assistant.', `CREATE_ACCOUNT_STEP.doneText: got ${show(c.doneText)}`);
  assert(a.doneText === 'Your Treasure Map names your Tapestry Assistant for your rank and followers scores.', `ACTIVATE_STEP.doneText: got ${show(a.doneText)}`);
  assert(a.otherProviderText === 'Your Treasure Map names another provider for your scores.', `ACTIVATE_STEP.otherProviderText: got ${show(a.otherProviderText)}`);
  assert(mod.SETUP_COPY && typeof mod.SETUP_COPY === 'object', 'steps.js must export SETUP_COPY, the page-level strings (ADR 0001 § Implementation notes 5)');
  const values = Object.values(mod.SETUP_COPY);
  for (const s of ['Sign in to see which steps you\'ve done.', 'Sign in with nostr', 'Done', 'Done: ', 'Not done: ', 'You\'re all set!']) {
    assert(values.includes(s), `SETUP_COPY must hold ${show(s)} exactly; it holds ${show(values)}`);
  }
});

/* ───────────────────────── S — server source sentinels ───────────────────────── */

test('S1: src/api/index.js registers GET /api/setup/status to handleSetupStatus', async () => {
  const src = safeRead(API_INDEX);
  assert(/app\.get\(\s*['"]\/api\/setup\/status['"]\s*,[^)]*handleSetupStatus/.test(src),
    'src/api/index.js must register `app.get(\'/api/setup/status\', …handleSetupStatus)` (ADR 0001 § Registration)');
});

/** Source with comments removed, so a docstring that SAYS "no strfry import" cannot trip a sentinel. */
function codeOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(NL)
    .map((line) => line.replace(/(^|[^:'"`\\])\/\/.*$/, '$1'))
    .join(NL);
}

test('S2: src/api/setup/status.js only reads — no strfry import, no publish, no signing, no key material, no file writes', async () => {
  assert(fs.existsSync(STATUS_MODULE), 'src/api/setup/status.js does not exist (ADR 0001).');
  const src = codeOnly(safeRead(STATUS_MODULE));
  const forbidden = [
    [/['"]import['"]/, 'a strfry `import` argument'],
    [/strfry\s+import/, '`strfry import`'],
    [/publishToRelays|publishEverywhere|\.publish\(/, 'a publish call'],
    [/finalizeEvent|signEvent|getSignature/, 'a signing call'],
    [/getAssistantKeys\s*\(|getOwnerAssistantKeys|getCustomerRelayKeys|privkey|nsec/, 'key material (only getAssistantPubkeyFor, which returns a pubkey, is allowed)'],
    [/writeFile|appendFile|createWriteStream/, 'a file write'],
    [/method:\s*['"](POST|PUT|PATCH|DELETE)/i, 'an HTTP mutation'],
  ];
  for (const [re, what] of forbidden) {
    assert(!re.test(src), `AC-5 / ADR 0001 § Read-only: src/api/setup/status.js must not contain ${what} (matched ${re})`);
  }
});

test('S3: no 64-hex pubkey literal in the files this story adds or changes (house rule: never hardcode the TA)', async () => {
  const files = [STATUS_MODULE, UI_UTIL, PROVIDER, PAGE, STEPS];
  const missing = files.filter((p) => !fs.existsSync(p)).map((p) => path.relative(REPO, p));
  assert(missing.length === 0, `these files must exist first: ${missing.join(', ')}`);
  for (const p of files) {
    const hit = safeRead(p).match(/['"`][0-9a-f]{64}['"`]/i);
    assert(!hit, `${path.relative(REPO, p)} holds a 64-hex literal ${hit && hit[0]} — resolve pubkeys at runtime`);
  }
});

test('S4: src/api/openapi.yaml documents GET /api/setup/status', async () => {
  const src = safeRead(OPENAPI);
  const at = src.search(/^\s*\/api\/setup\/status:\s*$/m);
  assert(at >= 0, 'src/api/openapi.yaml must carry a `/api/setup/status:` path (ADR 0001 § Registration)');
  assert(/^\s*get:/m.test(src.slice(at, at + 400)), 'the /api/setup/status path in openapi.yaml must document `get:`');
});

/* ───────────────────────── D — UI source sentinels (JSX is not executed here) ───────────────────────── */

test('D1: ui/src/context/SetupStatusContext.jsx exports SetupStatusProvider and useSetupStatus, and fetches /api/setup/status per signed-in account', async () => {
  assert(fs.existsSync(PROVIDER), 'ui/src/context/SetupStatusContext.jsx does not exist (ADR 0001 § Implementation notes 3).');
  const src = safeRead(PROVIDER);
  assert(/export\s+function\s+SetupStatusProvider\b/.test(src), 'SetupStatusContext.jsx must export function SetupStatusProvider');
  assert(/export\s+function\s+useSetupStatus\b/.test(src), 'SetupStatusContext.jsx must export function useSetupStatus');
  assert(src.includes('/api/setup/status'), 'the provider must fetch /api/setup/status');
  assert(/useAuth\s*\(/.test(src), 'the provider must read AuthContext (useAuth) to know who is signed in');
  assert(/user\?\.pubkey|user\.pubkey/.test(src), 'the provider must fetch again when the signed-in account changes (user?.pubkey)');
  assert(/summarizeSetup/.test(src), 'useSetupStatus must return summarizeSetup(...) of the answer (ADR 0001 § Implementation notes 3)');
});

test('D2: App.jsx mounts SetupStatusProvider around the router, inside AssistantRosterProvider', async () => {
  const src = safeRead(APP);
  assert(/import\s*\{\s*SetupStatusProvider\s*\}\s*from\s*['"]\.\/context\/SetupStatusContext['"]/.test(src),
    'App.jsx must import { SetupStatusProvider } from \'./context/SetupStatusContext\'');
  const open = src.indexOf('<SetupStatusProvider>');
  const router = src.indexOf('<RouterProvider');
  const close = src.indexOf('</SetupStatusProvider>');
  const rosterOpen = src.indexOf('<AssistantRosterProvider>');
  const rosterClose = src.indexOf('</AssistantRosterProvider>');
  assert(open >= 0 && router > open && close > router, 'App.jsx must render <SetupStatusProvider> around <RouterProvider …/>');
  assert(rosterOpen >= 0 && rosterOpen < open && rosterClose > close, 'SetupStatusProvider must sit inside AssistantRosterProvider (ADR 0001 § Implementation notes 3)');
});

test('D3: the /setup page reads the shared status and the sign-in state; the constant "0 of 3" is gone', async () => {
  const src = safeRead(PAGE);
  assert(!/const\s+doneCount\s*=\s*0\b/.test(src), 'ui/src/pages/setup/Index.jsx still declares the constant `const doneCount = 0` (story 1: replace it with each step\'s real state)');
  assert(/useSetupStatus\s*\(/.test(src), 'Index.jsx must read the shared status with useSetupStatus()');
  assert(/from\s+['"]\.\.\/\.\.\/context\/SetupStatusContext['"]/.test(src), 'Index.jsx must import useSetupStatus from ../../context/SetupStatusContext');
  assert(/useAuth\s*\(/.test(src), 'Index.jsx must read useAuth() for the signed-out and still-loading modes (ADR 0001 § Implementation notes 4)');
  assert(!src.includes('/api/setup/status'), 'Index.jsx must not fetch the status itself: the provider is the one reader (story 2 AC-4)');
});

/* ───────────────────────── R — regressions (pass before and after) ───────────────────────── */

test('R1: the copy approved with setup-page-scaffold #1 is byte-identical', async () => {
  const mod = await stepsCopy();
  const expected = {
    CREATE_ACCOUNT_STEP: {
      path: '/setup/create-account', label: 'Create your account', badge: 'Start here',
      text: 'Your account comes with your own Tapestry Assistant: a nostr identity this instance holds for you, which signs and publishes on your behalf.',
      placeholder: 'This page will set up your account on this Tapestry instance — which means setting up your Tapestry Assistant, the nostr identity this instance holds for you, which signs and publishes on your behalf.',
    },
    FOLLOW_STEP: {
      path: '/setup/follow', label: 'Create your follow list', badge: 'Required for scoring',
      text: 'Your trust scores are built from who you follow — without at least one follow, there\'s nothing to calculate.',
      placeholder: 'This page will help you publish your follow list — a kind 3 nostr event — with at least one follow who is not you. Your trust scores are calculated from it.',
    },
    ACTIVATE_STEP: {
      path: '/setup/activate', label: 'Activate your Brainstorm account', badge: 'Required for other apps',
      text: 'One signature publishes your Treasure Map, which tells other apps that your Tapestry Assistant manages your rank and followers scores.',
      placeholder: 'This page will set up your Treasure Map — a kind 10040 nostr event — so that your rank and followers scores are managed by your Tapestry Assistant on this instance.',
    },
  };
  for (const [name, fields] of Object.entries(expected)) {
    for (const [field, value] of Object.entries(fields)) {
      const got = mod[name] && mod[name][field];
      assert(got === value, `${name}.${field} changed: expected ${show(value)}, got ${show(got)}`);
    }
  }
  assert(Array.isArray(mod.SETUP_STEPS) && show(mod.SETUP_STEPS.map((s) => s.path)) === show(['/setup/create-account', '/setup/follow', '/setup/activate']),
    `SETUP_STEPS must still list the three steps in order; got ${show(mod.SETUP_STEPS && mod.SETUP_STEPS.map((s) => s.path))}`);
});

test('R2: App.jsx still routes /setup and its three step pages to the same pages', async () => {
  const src = safeRead(APP);
  for (const [route, element] of [['/setup', 'SetupIndex'], ['/setup/create-account', 'SetupCreateAccount'], ['/setup/follow', 'SetupFollow'], ['/setup/activate', 'SetupActivate']]) {
    const re = new RegExp(`path:\\s*'${route.replace(/\//g, '\\/')}',\\s*element:\\s*<${element}\\s*\\/>`);
    assert(re.test(src), `App.jsx must still route ${route} to <${element} />`);
  }
});

/* ───────────────────────── H — the live contract ───────────────────────── */

async function getJson(url, init = {}, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { throw new Error(`${url} → HTTP ${res.status}, not JSON: ${text.replace(/\s+/g, ' ').slice(0, 120)}`); }
    return { status: res.status, body, headers: res.headers };
  } finally { clearTimeout(timer); }
}

async function stackAvailable() {
  try {
    const { status, body } = await getJson(`${HOST_BASE}/api/assistant/pubkey`, {}, 3000);
    return status === 200 && body && body.success === true;
  } catch { return false; }
}

test('H1: live — an anonymous GET /api/setup/status answers 200 { success: true, signedIn: false }', async () => {
  if (!(await stackAvailable())) { hSkipped++; return 'SKIP'; }
  hExecuted++;
  let got;
  try {
    got = await getJson(`${HOST_BASE}/api/setup/status`);
  } catch (err) {
    throw new Error(`${err.message} — the route is missing on ${HOST_BASE}. Not implemented, or not deployed there: the local ` +
      'container has no bind mount, so run /cycle-local after implementing (OPEN.md row 27).');
  }
  assert(got.status === 200 && sameJson(got.body, { success: true, signedIn: false }),
    `expected 200 { success: true, signedIn: false } for a request with no session; got ${got.status} ${show(got.body)}`);
  return undefined;
});

function cookieFrom(headers) {
  const all = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [headers.get('set-cookie')].filter(Boolean);
  return all.map((c) => String(c).split(';')[0]).join('; ');
}

test('H2: live, opt-in — a freshly signed-in throwaway guest gets an honest answer about its own (empty) state', async () => {
  if (process.env.SETUP_STATUS_LIVE_SIGN_IN !== '1') {
    console.log('        (H2 skipped: set SETUP_STATUS_LIVE_SIGN_IN=1 to sign in a throwaway guest key — it creates a session and publishes nothing)');
    hSkipped++;
    return 'SKIP';
  }
  if (!(await stackAvailable())) { hSkipped++; return 'SKIP'; }
  hExecuted++;
  const { generateSecretKey, getPublicKey, finalizeEvent } = require('nostr-tools');
  const sk = generateSecretKey();
  const pk = getPublicKey(sk);
  const verify = await getJson(`${HOST_BASE}/api/auth/verify-user`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pubkey: pk }),
  });
  assert(verify.body && verify.body.authorized === true && verify.body.challenge, `verify-user did not issue a challenge: ${show(verify.body)}`);
  const pendingCookie = cookieFrom(verify.headers);
  const signed = finalizeEvent({ kind: 22242, created_at: Math.floor(Date.now() / 1000), tags: [['challenge', verify.body.challenge]], content: 'Tapestry authentication' }, sk);
  const login = await getJson(`${HOST_BASE}/api/auth/login-user`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: pendingCookie }, body: JSON.stringify({ event: signed }),
  });
  assert(login.body && login.body.success === true, `login-user refused the throwaway key: ${show(login.body)}`);
  const sessionCookie = cookieFrom(login.headers) || pendingCookie;
  const status = await getJson(`${HOST_BASE}/api/setup/status`, { headers: { Cookie: sessionCookie } }, 30000);
  const s = status.body && status.body.steps;
  assert(status.status === 200 && status.body.success === true && status.body.signedIn === true && s,
    `expected 200 { success: true, signedIn: true, steps } for the signed-in guest; got ${status.status} ${show(status.body)}`);
  assert(s.account && s.account.done === false && s.account.pending === true && s.account.finished === true,
    `a guest has no assistant: expected steps.account { done: false, pending: true, finished: true }, got ${show(s.account)}`);
  for (const key of ['follow', 'activate']) {
    const step = s[key];
    const finishedEmpty = step && step.finished === true && step.done === false && step.pending === true && step.source == null;
    const unfinished = step && step.finished === false && step.done === false && step.pending === false && typeof step.reason === 'string';
    assert(finishedEmpty || unfinished,
      `a brand-new key has no ${key === 'follow' ? 'follow list' : 'Map'}: expected either finished-and-absent (pending) or unfinished with a reason; got ${show(step)}`);
  }
  assert(!show(status.body).includes(pk), 'the answer must carry no pubkeys');
  return undefined;
});

async function run() {
  console.log('\n=== setup-status (setup-status-and-alert #1) ===');
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
  // OPEN.md #104/#106: a fully-skipped H-class is otherwise indistinguishable from a real pass.
  console.log(`setup-status: H-class ${hExecuted} executed / ${hSkipped} skipped`);
  if (hSkipped > 0 && hExecuted === 0) {
    console.log('setup-status: !! LIVE COVERAGE DID NOT RUN — stack unreachable (or H2 not opted in).');
    if (process.env.TAPESTRY_REQUIRE_LIVE === '1') {
      failures.push({ name: 'live coverage', message: 'TAPESTRY_REQUIRE_LIVE=1 but the whole H-class skipped.' });
      fail++;
    }
  }
  console.log(`${NL}setup-status: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped, hExecuted, hSkipped };
}

module.exports = { run };
