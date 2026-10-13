'use strict';
/**
 * assistant-self-map #2: turning your Assistant's self-Map on and off — the merge that keeps every entry the self-Map
 * doesn't own, the remembered choice, and the one narrow route that signs.
 *
 * Story: engineering-team/stories/assistant-self-map/2-turning-the-self-map-on-and-off.md
 * ADR:   engineering-team/decisions/assistant-self-map/0002-one-narrow-route-turns-the-self-map-on-and-off.md
 * Plan:  engineering-team/stories/assistant-self-map/2-turning-the-self-map-on-and-off.test-plan.md
 * Spec:  protocols/drafts/treasure-maps.md § 9 (self-entries), § 9.2 (No expiration, When it changes, Finding a
 *        self-Map) (read-only).
 * Other halves: test/assistant-self-map-check.test.js (selfMapOn in the answer, gatherSelfMap, the forWrite read, the
 * relay hints), test/assistant-self-map-page.test.js (the buttons' words and helpers, the client helper, the page's
 * wiring) and tests/brainstorm/assistant-self-map.spec.js (B14–B21). Words: test/helpers/selfMapFixtures.js (PRESS).
 *
 * Classes (all stack-free; every version of the Assistant's kind 10040 is really signed with a generated key, and the
 * press's own signature is checked with nostr-tools):
 *   M — the merge, pure, in src/lib/self-map (ADR sub-decision 4): ownsTag, keptTags, buildSelfMapEvent.     [AC-4, AC-5]
 *   K — the choice store, src/api/assistant/selfMapChoice.js (sub-decision 1), on a temp path.             [AC-1]
 *   P — the route's refusals and whose key (sub-decision 5).                                                 [AC-3]
 *   R — never blind: the reads a press needs, and the base's signature (sub-decision 6 step 1, R1).          [AC-4]
 *   E — what is signed: the self-entries, the kept tags and content, created_at, nothing-to-change, off, and the
 *       version read back by story 1's check (sub-decision 6 steps 3–6).                            [AC-2 … AC-5]
 *   C — the remembered choice and the press (sub-decision 6 step 2).                                          [AC-1]
 *   W — where it goes: local first, the configured and named relays, the guard, local-only, the summary
 *       (sub-decision 6 steps 7–9).                                                                             [AC-6]
 *   L — one press at a time per Assistant (sub-decision 6, withAssistantLock).                       [AC-4, § 9.2]
 *   S — sentinels: the route registered and in the access table, nothing else signs a kind 10040 as an Assistant,
 *       nothing automatic, the choice file's one writer, the docs (sub-decisions 5 and 8).                [AC-3, AC-1]
 *
 * The world is the staging Owner's, in the deployments' real config (Docker's ws://localhost:7777 with STRFRY_DOMAIN;
 * ledger 2026-10-12-test-configs-not-from-deployments) and the shipped Assistant Duties list (the six bare kinds). The
 * Owner's Map gives the Assistant 39998, 3038x and 39999; one Concept header has landed here; no Score schedule. So
 * what the self-Map should say is one self-entry, 39998 at this instance's relay (ADR 0001 sub-decision 2's worked
 * example). The tests never pin how compound offer keys are read: book assistant-duties-settings is changing that.
 *
 * The press's story-1 functions are injected bound to the low-level fakes (as the Duty Menu suite's integratedDeps):
 * gatherSelfMap(input), lookupSelfMap(input), lookupViewerMap(viewer), resolveOfferInputs(viewer) and
 * assistantWriteRelays(input). lookupViewerMap's one-argument shape is fixed here (test plan § Points the ADR leaves
 * open).
 *
 * Everything FAILS against the current code: src/api/assistant/selfMapPublish.js and selfMapChoice.js do not exist, the
 * library has no merge, selfMap.js exports no gatherSelfMap, and the route is not registered.
 *
 * Round 2 (ADR 0002 Amendment 1, review round 1): R9–R13 pin the strict read's discovery (a relay-list lookup that does
 * not finish, a write relay the DNS guard refuses, silent write relays beside an answering offer relay, and the two
 * finished cases); E11–E14 that "nothing to change" leaves nothing stale; C5–C6 that isLocalOnly is read before the
 * choice and what a 500 after it means. The world gains `publishRelays` (where the relay list is looked up) and
 * `noRelayList` (no copy of the Assistant's 10002 here).
 *
 * Round 3 (ADR 0002 Amendment 2, review round 2): R14 pins that a relay list found nowhere, while a publish relay is
 * unheard, is not "no write relays" (R2-B1); R15 that every publish relay answering "nowhere" still finishes; R10 now
 * also pins that the press never connects to a relay the DNS guard refused (R2-N1).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const SM = require('./helpers/selfMapFixtures');
const DM = require('./helpers/dutyMenuFixtures');

const REPO = path.resolve(__dirname, '..');
const LIB = path.join(REPO, 'src/lib/self-map/index.js');
const MODULE = path.join(REPO, 'src/api/assistant/selfMapPublish.js');
const CHOICE = path.join(REPO, 'src/api/assistant/selfMapChoice.js');
const SELF_MAP_MODULE = path.join(REPO, 'src/api/assistant/selfMap.js');
const DUTY_MODULE = path.join(REPO, 'src/api/assistant/dutyMenu.js');
const API_INDEX = path.join(REPO, 'src/api/index.js');
const ROUTE_ACCESS = path.join(REPO, 'src/middleware/routeAccess.js');
const OPENAPI = path.join(REPO, 'src/api/openapi.yaml');
const BIBLE = path.join(REPO, 'BIBLE.md');
const ADR_0001 = path.join(REPO, 'engineering-team/decisions/assistant-self-map/0001-a-self-map-check-from-what-has-landed.md');
const GENERIC_SIGNER = path.join(REPO, 'src/api/strfry/commands/publishEvent.js');
const CLIENT_UTIL = path.join(REPO, 'ui/src/utils/setAssistantSelfMap.js');
const NL = String.fromCharCode(10);

const OWNER = SM.OWNER;
const OTHER = SM.OTHER_ASSISTANT;
const OWN = SM.OWN; // wss://staging.brainstorm.world/relay: this instance's relay, as Docker derives it
// Outside relays, by where the press learns of them.
const PUB1 = 'wss://pub-one.example';                 // the profile publish set: where relay lists are read
const MAPR = 'wss://maps.example';                    // the server's Map relays: where the viewer's Map is read
const DCOSL = 'wss://dcosl.brainstorm.world';         // the viewer's Map names it for the Assistant (a hint)
const NIP85 = 'wss://nip85.brainstorm.world';         // ditto
const SCORES_R = 'wss://scores.brainstorm.world';     // the other Assistant's relay in the Owner's Map
const A_WRITE = 'wss://a-write.example';              // the Assistant's 10002, write
const A_READ = 'wss://a-read.example';                // the Assistant's 10002, read only: never a send target
const OLD1 = 'wss://old-one.example';                 // a self-entry of the version found named it
const DLIST = 'wss://dlist.example';                  // a typed relay on the Assistant Duties list
const N1 = 'wss://nous-one.example';                  // Nous' write relays: § 9.2 names none for a self-Map
const NOT_PUBLIC = 'wss://not-public.example';

const NOW_MS = 1_760_000_000_000;
const NOW_S = Math.floor(NOW_MS / 1000);
const H = 3600;
/** No press in this suite may take longer than this: the 8 s relay budget plus the 3 s DNS budget, and slack. */
const PRESS_LIMIT_MS = 15000;

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
const show = (v) => JSON.stringify(v);
const rel = (p) => path.relative(REPO, p);
const lc = (s) => String(s || '').toLowerCase();
const clone = (v) => JSON.parse(JSON.stringify(v));
const normUrl = (u) => String(u || '').trim().toLowerCase().replace(/\/+$/, '');
const hostOf = (x) => { const s = String(x || ''); try { return new URL(s.includes('://') ? s : `wss://${s}`).hostname.toLowerCase(); } catch { return lc(s); } };
const within = (p, ms) => Promise.race([p, new Promise((resolve) => setTimeout(() => resolve('HUNG'), ms))]);
const CONSOLE = { log: console.log, warn: console.warn, error: console.error };
const quiet = () => { console.log = () => {}; console.warn = () => {}; console.error = () => {}; };
const restoreConsole = () => { console.log = CONSOLE.log; console.warn = CONSOLE.warn; console.error = CONSOLE.error; };

function codeOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
    .split(NL)
    .map((l) => l.replace(/(^|[^:'"`\\])\/\/.*$/, '$1'))
    .join(NL);
}

/* ───────────────────────── the oracle: § 9's self-entries, written from the ADR, not from the code ───────────────── */

const KIND_SLOT_RE = /^(\d{5}|3038x|3039x|\*)$/;
/** ADR 0002 sub-decision 4: a tag the self-Map owns — element 1's kind slot parses and element 2 is the author. */
function owned(t, author) {
  return Array.isArray(t) && typeof t[0] === 'string' && KIND_SLOT_RE.test(t[0].split(':')[0]) && typeof t[1] === 'string' && t[1].toLowerCase() === author;
}
const kept = (tags, author, dropExpiration) => (tags || []).filter((t) => !owned(t, author) && !(dropExpiration && Array.isArray(t) && t[0] === 'expiration'));
const selfTags = (event, author) => ((event && event.tags) || []).filter((t) => owned(t, author));
const entrySet = (xs) => xs.map((x) => (Array.isArray(x) ? `${x[0]}|${x[2]}` : `${x.key}|${x.relay}`)).sort();
const sameEntries = (a, b) => show(entrySet(a)) === show(entrySet(b));

/* ───────────────────────── fixtures: keys and events ───────────────────────── */

const nt = () => require('nostr-tools');
function newAssistant() {
  const sk = nt().generateSecretKey();
  return { sk, A: nt().getPublicKey(sk), privkey: Buffer.from(sk).toString('hex') };
}
let idSeq = 0;
const hexId = (n) => n.toString(16).padStart(64, '0');
/** An event as a relay holds it, with a stand-in signature (only the Assistant's kind 10040s must verify). */
function ev(kind, pubkey, createdAt, tags) {
  idSeq += 1;
  return { id: hexId(40960 + idSeq), pubkey, kind, created_at: createdAt, tags, content: '', sig: '0'.repeat(128) };
}
/** A version of the Assistant's kind 10040, really signed. */
function version(key, tags, { createdAt = NOW_S - H, content = '' } = {}) {
  return nt().finalizeEvent({ kind: SM.SELF_MAP_KIND, created_at: createdAt, tags: clone(tags), content }, key.sk);
}
/** The staging Owner's Map, naming the Assistant `A` (book § Facts found at intake). */
const ownerMapTags = (A) => SM.stagingOwnerMapTags(A, OTHER);
const header = (A, d) => ev(39998, A, NOW_S - 200 * H, [['d', d], ['names', d, d]]);
const relayList = (A) => ev(SM.RELAY_LIST_KIND, A, NOW_S - 100 * H, [['r', A_WRITE, 'write'], ['r', A_READ, 'read']]);

/**
 * The TA's kind 10040 as it may stand: this instance's own Map entries, one stale self-entry at an old relay, one
 * self-entry readers ignore, a tag naming the Assistant that is not an entry, an expiration, and private content.
 */
function instanceMapTags(A) {
  return [
    ['30382:rank', OTHER, SCORES_R],
    ['client', 'Brainstorm'],
    ['30382', A, OLD1],
    ['30392', OTHER, SCORES_R, 'a fourth element, kept as written'],
    ['39998:', A, OWN],
    ['p', A],
    ['expiration', String(NOW_S + 86400)],
  ];
}
const PRIVATE_CONTENT = 'fixture-nip44-ciphertext==';
/** What the self-Map should say in the default world (ADR 0001 sub-decision 2's worked example, Scores not live). */
const SHOULD = [{ key: '39998', relay: OWN }];

/* ───────────────────────── the world, and the low-level fakes ───────────────────────── */

/**
 * One world, for the Owner by default.
 *   key       — the Assistant's generated key (newAssistant()); noAssistant — getAssistantKeys answers null.
 *   mapTags   — the viewer's Map (null = none anywhere). headers — the Concept headers landed here.
 *   base      — the Assistant's kind 10040 on this instance's relay (null = none). extraLocal — more events here.
 *   relays    — outside relays: url → events | 'hang' (absent = unreachable). Default: every hint and the Assistant's
 *               write relay answer, holding nothing.
 *   duties    — the Assistant Duties list (default the six). schedule — readScheduleEntries (default none).
 *   rejectScan(filter) — this scan throws. importFails — the local write throws. localOnly — local-only mode.
 *   notPublic — hosts the DNS guard refuses. choiceThrows — writeSelfMapChoice throws.
 */
function world(opts = {}) {
  const key = opts.key || newAssistant();
  const A = key.A;
  const local = [];
  if (opts.mapTags !== null) local.push(ev(SM.TREASURE_MAP_KIND, opts.viewer || OWNER, NOW_S - 50 * H, opts.mapTags || ownerMapTags(A)));
  if (!opts.noRelayList) local.push(relayList(A));
  for (const d of (opts.headers === undefined ? ['dog-tricks'] : opts.headers)) local.push(header(A, d));
  if (opts.base !== null) local.push(opts.base || version(key, instanceMapTags(A), { content: PRIVATE_CONTENT }));
  local.push(...(opts.extraLocal || []));
  const relays = opts.relays || Object.fromEntries([A_WRITE, DCOSL, NIP85, OLD1, MAPR, PUB1].map((u) => [u, []]));
  return {
    key, A, viewer: opts.viewer || OWNER, local,
    relays: Object.fromEntries(Object.entries(relays).map(([u, v]) => [normUrl(u), v])),
    duties: opts.duties || DM.DEFAULT_DUTIES,
    schedule: opts.schedule || [],
    config: { ...SM.DOCKER_CONFIG, ...(opts.config || {}) },
    rejectScan: opts.rejectScan, importFails: Boolean(opts.importFails), localOnly: Boolean(opts.localOnly),
    notPublic: (opts.notPublic || []).map(hostOf), noAssistant: Boolean(opts.noAssistant), choiceThrows: Boolean(opts.choiceThrows),
    refuse: (opts.refuse || []).map(normUrl),
    // Round 2: the profile publish relays, where the Assistant's relay list is looked up when it is not held here.
    publishRelays: opts.publishRelays || [PUB1, SM.DOCKER_RELAY_URL],
  };
}
function matching(events, filter) {
  const kinds = Array.isArray(filter && filter.kinds) ? filter.kinds : null;
  const authors = Array.isArray(filter && filter.authors) ? filter.authors.map(lc) : null;
  const ds = Array.isArray(filter && filter['#d']) ? filter['#d'] : null;
  const dOf = (e) => ((e.tags || []).find((t) => t[0] === 'd') || [])[1];
  const out = events
    .filter((e) => (!kinds || kinds.includes(e.kind)) && (!authors || authors.includes(lc(e.pubkey))) && (!ds || ds.includes(dOf(e))))
    .sort((a, b) => (b.created_at - a.created_at) || (a.id < b.id ? -1 : 1));
  return Number.isInteger(filter && filter.limit) ? out.slice(0, filter.limit) : out;
}
function lowLevel(w, calls) {
  const attention = require('../src/api/assistant/attention');
  const L = {
    scanLocal: async (filter) => {
      calls.scanLocal.push(filter);
      if (typeof w.rejectScan === 'function' && w.rejectScan(filter)) throw new Error('fixture: strfry scan failed');
      return matching(w.local, filter);
    },
    readRelay: async (url, filter) => {
      calls.readRelay.push({ url: normUrl(url), filter });
      const held = w.relays[normUrl(url)];
      if (held === 'hang') return new Promise(() => {});
      if (!Array.isArray(held)) return { status: 'unreachable', events: [], error: 'fixture: unreachable' };
      return { status: 'ok', events: matching(held, filter), error: null };
    },
    getConfigFromFile: (k, dflt) => (Object.prototype.hasOwnProperty.call(w.config, k) ? w.config[k] : dflt),
    readConfiguredRelays: () => [],
    getConfiguredPublishRelays: () => w.publishRelays.slice(),
    mapDefaultRelays: () => [MAPR, SM.DOCKER_RELAY_URL],
    isPublicRelayHostWithin: async (host) => !w.notPublic.includes(hostOf(host)),
    isLocalOnly: () => w.localOnly,
    now: () => NOW_MS,
    readAssistantDuties: () => clone(w.duties),
    readScheduleEntries: () => clone(w.schedule),
    schedulerEnabled: () => true,
    timerExists: () => false,
    customerTimerIntervalMs: () => null,
    readSelfMapChoice: () => false,
    getCustomer: async () => null,
  };
  L.lookupNewestReplaceable = (input, d) => attention.lookupNewestReplaceable(input, d || L);
  return L;
}

/* ───────────────────────── the modules under test ───────────────────────── */

function load(abs, what) {
  if (!fs.existsSync(abs)) throw new Error(`${rel(abs)} does not exist. ${what}`);
  delete require.cache[require.resolve(abs)];
  return require(abs);
}
function need(mod, name, file) {
  assert(typeof mod[name] === 'function', `${file} must export ${name}() (ADR 0002 § Implementation notes).`);
  return mod[name];
}
const libModule = () => load(LIB, 'It is story 1\'s pure library; ADR 0002 sub-decision 4 adds the merge to it.');
const publishModule = () => load(MODULE, 'ADR 0002 sub-decisions 5 and 6 create it: createSelfMapHandler, handleSelfMap, setSelfMapFor, applySelfMap, withAssistantLock, SELF_MAP_SUBJECT, CODES, WORDS.');
const choiceModule = () => load(CHOICE, 'ADR 0002 sub-decision 1 creates it: readSelfMapChoice, writeSelfMapChoice, SELF_MAP_CHOICE_PATH.');

/** The press's seams (ADR 0002 § Implementation notes 4), every one recording; the story-1 functions bound to L. */
function pressDeps(w) {
  const calls = { scanLocal: [], readRelay: [], importEvent: [], publishToRelays: [], writeChoice: [], guard: [], order: [], nous: 0, getAssistantKeys: [] };
  const L = lowLevel(w, calls);
  const selfMap = load(SELF_MAP_MODULE, 'It is story 1\'s check.');
  const duty = load(DUTY_MODULE, 'It is the Duty Menu check.');
  const status = require('../src/api/setup/status');
  const deps = {
    getAssistantKeys: async (viewer) => { calls.getAssistantKeys.push(viewer); return w.noAssistant ? null : { pubkey: w.A, privkey: w.key.privkey }; },
    importEvent: async (event) => {
      calls.order.push('import');
      calls.importEvent.push(event);
      if (w.importFails) throw new Error('fixture: strfry import refused');
      w.local.push(event);
    },
    isLocalOnly: () => w.localOnly,
    publishToRelays: async (event, relays) => {
      calls.order.push('publish');
      calls.publishToRelays.push({ event, relays: relays.slice() });
      return relays.map((relay) => ({ relay, status: w.refuse.includes(normUrl(relay)) ? 'refused' : 'accepted', reason: w.refuse.includes(normUrl(relay)) ? 'fixture: blocked' : '' }));
    },
    isPublicHostname: async (host) => { calls.guard.push(lc(host)); return !w.notPublic.includes(lc(host)); },
    now: () => NOW_MS,
    writeSelfMapChoice: async (pk, on, nowSeconds) => {
      calls.order.push('choice');
      calls.writeChoice.push([pk, on, nowSeconds]);
      if (w.choiceThrows) throw new Error('fixture: the choice file is unreadable');
    },
    gatherSelfMap: (input) => need(selfMap, 'gatherSelfMap', rel(SELF_MAP_MODULE))(input, L),
    lookupSelfMap: (input) => selfMap.lookupSelfMap(input, L),
    lookupViewerMap: (viewer) => status.lookupNewest({ kind: SM.TREASURE_MAP_KIND, pubkey: viewer, relays: status.treasureMapRelays(L) }, L),
    resolveOfferInputs: (viewer) => duty.resolveOfferInputs(viewer, L),
    assistantWriteRelays: (input) => duty.assistantWriteRelays(input, L),
    nousWriteRelays: async () => { calls.nous += 1; return [N1]; },
    getConfiguredPublishRelays: L.getConfiguredPublishRelays,
    getConfigFromFile: L.getConfigFromFile,
    outsideOnly: (urls) => status.outsideOnly(urls, L),
  };
  return { deps, calls, L, selfMap };
}
function fakeRes() {
  const res = { statusCode: 200, body: undefined };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}
const pressReq = (viewer, body) => ({ session: { authenticated: true, pubkey: viewer }, body, query: {} });

/** One press in world `w` (or options for one). Answers what the press said, recorded, and the world after. */
async function press(wOrOpts, body, { req = null } = {}) {
  const w = wOrOpts && wOrOpts.local ? wOrOpts : world(wOrOpts || {});
  const { deps, calls, L, selfMap } = pressDeps(w);
  const handle = need(publishModule(), 'createSelfMapHandler', rel(MODULE))(deps);
  const res = fakeRes();
  quiet();
  let got;
  try { got = await within(handle(req || pressReq(w.viewer, body), res), PRESS_LIMIT_MS); } finally { restoreConsole(); }
  assert(got !== 'HUNG', `the press must answer within ${PRESS_LIMIT_MS} ms`);
  const signed = calls.importEvent.length ? calls.importEvent[calls.importEvent.length - 1] : null;
  return { w, res, body: res.body, result: res.body && res.body.result, calls, signed, L, selfMap };
}
function mustAccept(got, what) {
  assert(got.res.statusCode === 200 && got.body && got.body.success === true && got.result, `${what}: want 200 { success: true, result }, got ${got.res.statusCode} ${show(got.body)}`);
  return got.result;
}
function mustPublish(got, what) {
  const r = mustAccept(got, what);
  assert(r.published === true && got.signed, `${what}: want a version published, got ${show({ published: r.published, ok: r.ok, message: r.message, imports: got.calls.importEvent.length })}`);
  return r;
}
function nothingDone(got, what) {
  const wrong = [];
  if (got.calls.writeChoice.length) wrong.push(`no choice written (got ${show(got.calls.writeChoice)})`);
  if (got.calls.importEvent.length) wrong.push(`nothing written here (got ${got.calls.importEvent.length})`);
  if (got.calls.publishToRelays.length) wrong.push('nothing sent out');
  if (wrong.length) throw new Error(`${what}: ${wrong.join('; ')}`);
}

/* ───────────────────────── M — the merge (ADR 0002 sub-decision 4) ───────────────────────── */

test('M1: the library exports ownsTag, keptTags and buildSelfMapEvent, and still has no I/O and no signing (ADR 0002 sub-decision 4; story 1 S1)', () => {
  const lib = libModule();
  const src = codeOnly(safeRead(LIB));
  const wrong = [];
  for (const fn of ['ownsTag', 'keptTags', 'buildSelfMapEvent']) if (typeof lib[fn] !== 'function') wrong.push(`exports ${fn}()`);
  for (const mod of ['fs', 'child_process', 'net', 'http', 'https', 'ws']) if (new RegExp(`require\\(\\s*['"]${mod}['"]\\s*\\)`).test(src)) wrong.push(`requires no I/O module (${mod})`);
  if (/finalizeEvent|signEvent|privkey|secretKey/.test(src)) wrong.push('signs nothing');
  assert(wrong.length === 0, wrong.join('; '));
});

test('M2: ownsTag is § 9\'s self-entries — a tag whose element 1 has a kind slot and whose element 2 is the author, in any case, the spellings readers ignore and unchecked keys included; never a tag whose element 1 is not a key, nor an entry naming another key (AC-4)', () => {
  const ownsTag = need(libModule(), 'ownsTag', rel(LIB));
  const A = 'a5'.repeat(32);
  const wrong = [];
  const yes = [['39998', A, OWN], ['30382:rank', A, OWN], ['3038x', A], ['*', A, OWN], ['39998:', A, OWN], ['39999:dlist-header', A, OWN],
    ['30392:tag::Restaurants', A, OWN], ['39998', A.toUpperCase(), OWN], ['30382', A, '']];
  const no = [['p', A], ['d', A], ['expiration', A], ['client', A], ['foo', A, OWN], ['39998', OTHER, OWN], ['3038x', 'not-a-key', OWN],
    ['39998'], [], 'not-a-tag', null, [39998, A, OWN]];
  for (const t of yes) if (ownsTag(t, A) !== true) wrong.push(`owns ${show(t)}`);
  for (const t of no) if (ownsTag(t, A) === true) wrong.push(`does not own ${show(t)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('M3: keptTags is every tag ownsTag rejects, in order and as written (extra elements kept); with dropExpiration, the expiration tags go and nothing else (AC-4; § 9.2 No expiration)', () => {
  const keptTags = need(libModule(), 'keptTags', rel(LIB));
  const A = 'a5'.repeat(32);
  const event = { kind: 10040, tags: instanceMapTags(A), content: PRIVATE_CONTENT };
  const wrong = [];
  const plain = keptTags(event, A, {});
  if (show(plain) !== show(kept(event.tags, A, false))) wrong.push(`kept: want ${show(kept(event.tags, A, false))}, got ${show(plain)}`);
  const dropped = keptTags(event, A, { dropExpiration: true });
  if (show(dropped) !== show(kept(event.tags, A, true))) wrong.push(`with dropExpiration: want ${show(kept(event.tags, A, true))}, got ${show(dropped)}`);
  const none = keptTags(null, A, {});
  if (!Array.isArray(none) || none.length !== 0) wrong.push(`no event: want [], got ${show(none)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('M4: buildSelfMapEvent — kind 10040; created_at later than the version it replaces; content kept; every kept tag as written and in order; the new self-entries [key, author, relay] as one block where the first owned tag stood, counted among the kept tags; expiration dropped beside a self-entry (AC-4)', () => {
  const build = need(libModule(), 'buildSelfMapEvent', rel(LIB));
  const A = 'a5'.repeat(32);
  const latest = { kind: 10040, pubkey: A, created_at: NOW_S - H, tags: instanceMapTags(A), content: PRIVATE_CONTENT };
  const entries = [{ key: '39999:pets', relay: DLIST }, { key: '39998', relay: OWN }];
  const got = build({ latest, author: A, selfEntries: entries, nowSeconds: NOW_S });
  const wrong = [];
  if (got.kind !== 10040) wrong.push(`kind 10040, got ${show(got.kind)}`);
  if (got.created_at !== NOW_S) wrong.push(`created_at: now when the found version is older (want ${NOW_S}, got ${show(got.created_at)})`);
  if (got.content !== PRIVATE_CONTENT) wrong.push(`content kept, got ${show(got.content)}`);
  const want = [
    ['30382:rank', OTHER, SCORES_R],
    ['client', 'Brainstorm'],
    ['39999:pets', A, DLIST],
    ['39998', A, OWN],
    ['30392', OTHER, SCORES_R, 'a fourth element, kept as written'],
    ['p', A],
  ];
  if (show(got.tags) !== show(want)) wrong.push(`tags: want ${show(want)}, got ${show(got.tags)}`);
  const later = build({ latest: { ...latest, created_at: NOW_S + 500 }, author: A, selfEntries: entries, nowSeconds: NOW_S });
  if (later.created_at !== NOW_S + 501) wrong.push(`created_at: one after a found version dated later than now (want ${NOW_S + 501}, got ${show(later.created_at)})`);
  const fresh = build({ latest: { kind: 10040, pubkey: A, created_at: NOW_S - H, tags: [['client', 'Brainstorm']], content: '' }, author: A, selfEntries: entries, nowSeconds: NOW_S });
  if (show(fresh.tags) !== show([['client', 'Brainstorm'], ['39999:pets', A, DLIST], ['39998', A, OWN]])) wrong.push(`no owned tag before: the block goes after the last kept tag, got ${show(fresh.tags)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('M5: buildSelfMapEvent with no self-entries (off) — every owned tag goes, everything else stays as written, the expiration included; a version of only self-entries leaves no tags and its content; no version found builds from nothing (AC-4, AC-5)', () => {
  const build = need(libModule(), 'buildSelfMapEvent', rel(LIB));
  const A = 'a5'.repeat(32);
  const wrong = [];
  const latest = { kind: 10040, pubkey: A, created_at: NOW_S - H, tags: instanceMapTags(A), content: PRIVATE_CONTENT };
  const off = build({ latest, author: A, selfEntries: [], nowSeconds: NOW_S });
  if (show(off.tags) !== show(kept(latest.tags, A, false))) wrong.push(`off: want ${show(kept(latest.tags, A, false))}, got ${show(off.tags)}`);
  if (off.content !== PRIVATE_CONTENT) wrong.push('off: content kept');
  const only = build({ latest: { ...latest, tags: [['39998', A, OWN], ['3038x', A, OWN]], content: 'kept' }, author: A, selfEntries: [], nowSeconds: NOW_S });
  if (show(only.tags) !== '[]' || only.content !== 'kept') wrong.push(`only self-entries: want no tags and the content, got ${show({ tags: only.tags, content: only.content })}`);
  const none = build({ latest: null, author: A, selfEntries: [{ key: '39998', relay: OWN }], nowSeconds: NOW_S });
  if (show(none.tags) !== show([['39998', A, OWN]]) || none.content !== '' || none.created_at !== NOW_S) wrong.push(`no version found: want one self-entry, empty content, created_at now, got ${show(none)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── K — the choice store (ADR 0002 sub-decision 1) ───────────────────────── */

/** Load the store with its path at a fresh temp file (or as given), and restore the environment after. */
async function withStore(fn, { file, env = {} } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'self-map-choice-'));
  const target = file === undefined ? path.join(dir, SM.PRESS.choiceFile) : file;
  const saved = { [SM.PRESS.choiceEnv]: process.env[SM.PRESS.choiceEnv], BRAINSTORM_BASE_DIR: process.env.BRAINSTORM_BASE_DIR };
  if (target === null) delete process.env[SM.PRESS.choiceEnv]; else process.env[SM.PRESS.choiceEnv] = target;
  for (const [k, v] of Object.entries(env)) { if (v === null) delete process.env[k]; else process.env[k] = v; }
  try {
    const mod = choiceModule();
    return await fn(mod, { dir, file: target });
  } finally {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    try { delete require.cache[require.resolve(CHOICE)]; } catch { /* never loaded */ }
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
const A1 = 'a1'.repeat(32);
const A2 = 'a2'.repeat(32);

test('K1: the store exports readSelfMapChoice, writeSelfMapChoice and SELF_MAP_CHOICE_PATH — TAPESTRY_SELF_MAP_CHOICE_PATH when set, else assistant-self-map.json under BRAINSTORM_BASE_DIR (else /var/lib/brainstorm, the data volume) (AC-1)', async () => {
  const wrong = [];
  await withStore(async (mod, { file }) => {
    for (const fn of ['readSelfMapChoice', 'writeSelfMapChoice']) if (typeof mod[fn] !== 'function') wrong.push(`exports ${fn}()`);
    if (mod.SELF_MAP_CHOICE_PATH !== file) wrong.push(`with ${SM.PRESS.choiceEnv} set: want ${show(file)}, got ${show(mod.SELF_MAP_CHOICE_PATH)}`);
  });
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'self-map-base-'));
  await withStore(async (mod) => {
    const want = path.join(base, SM.PRESS.choiceFile);
    if (mod.SELF_MAP_CHOICE_PATH !== want) wrong.push(`BRAINSTORM_BASE_DIR=${base}: want ${show(want)}, got ${show(mod.SELF_MAP_CHOICE_PATH)}`);
  }, { file: null, env: { BRAINSTORM_BASE_DIR: base } });
  await withStore(async (mod) => {
    const want = path.join('/var/lib/brainstorm', SM.PRESS.choiceFile);
    if (mod.SELF_MAP_CHOICE_PATH !== want) wrong.push(`nothing set: want ${show(want)}, got ${show(mod.SELF_MAP_CHOICE_PATH)}`);
  }, { file: null, env: { BRAINSTORM_BASE_DIR: null } });
  fs.rmSync(base, { recursive: true, force: true });
  assert(wrong.length === 0, wrong.join('; '));
});

test('K2: off until turned on — a missing file reads false for every Assistant; a write records { on, changedAt } under the Assistant in { version: 1, assistants }, leaves the others, and reads back; an upper-case key is the same Assistant (AC-1)', async () => {
  await withStore(async (mod, { file }) => {
    const read = need(mod, 'readSelfMapChoice', rel(CHOICE));
    const write = need(mod, 'writeSelfMapChoice', rel(CHOICE));
    const wrong = [];
    if (await read(A1) !== false) wrong.push(`missing file: false, got ${show(await read(A1))}`);
    await write(A1, true, NOW_S);
    if (await read(A1) !== true) wrong.push('A1 reads on after Turn on');
    if (await read(A2) !== false) wrong.push('A2 still off');
    await write(A2.toUpperCase(), true, NOW_S + 1);
    await write(A1, false, NOW_S + 2);
    let json = null;
    try { json = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { wrong.push(`the file is JSON: ${e.message}`); }
    const want = { version: 1, assistants: { [A1]: { on: false, changedAt: NOW_S + 2 }, [A2]: { on: true, changedAt: NOW_S + 1 } } };
    if (json && show(sortKeys(json)) !== show(sortKeys(want))) wrong.push(`the file: want ${show(want)}, got ${show(json)}`);
    if (await read(A1) !== false || await read(A2) !== true || await read(A2.toUpperCase()) !== true) wrong.push('reads back A1 off, A2 on (any case)');
    assert(wrong.length === 0, wrong.join('; '));
  });
});
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]));
  return v;
}

test('K3: a file that is not the shape reads null (unknown), and a write then throws and never overwrites it, byte for byte (AC-1; ADR 0002 sub-decision 1)', async () => {
  const wrong = [];
  for (const text of ['{ not json', '[]', '{"version":1}', '{"version":1,"assistants":[]}']) {
    await withStore(async (mod, { file }) => {
      fs.writeFileSync(file, text);
      quiet();
      let readGot;
      let threw = false;
      try {
        readGot = await mod.readSelfMapChoice(A1);
        try { await mod.writeSelfMapChoice(A1, true, NOW_S); } catch { threw = true; }
      } finally { restoreConsole(); }
      if (readGot !== null) wrong.push(`${show(text)}: reads null, got ${show(readGot)}`);
      if (!threw) wrong.push(`${show(text)}: the write throws`);
      if (fs.readFileSync(file, 'utf8') !== text) wrong.push(`${show(text)}: the file is untouched`);
    });
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('K4: only an Assistant key is stored — a key that is not 64-hex throws and writes nothing (ADR 0002 sub-decision 1)', async () => {
  await withStore(async (mod, { file }) => {
    const wrong = [];
    for (const bad of ['', 'nope', 'a1'.repeat(31), `${'a1'.repeat(32)}0`, null, 42, '__proto__']) {
      let threw = false;
      try { await mod.writeSelfMapChoice(bad, true, NOW_S); } catch { threw = true; }
      if (!threw) wrong.push(`${show(bad)} throws`);
    }
    if (fs.existsSync(file)) wrong.push(`nothing written (found ${show(fs.readFileSync(file, 'utf8'))})`);
    assert(wrong.length === 0, wrong.join('; '));
  });
});

test('K5: writes land one at a time — twenty Assistants written at once are all there, and no temp file is left beside the store (ADR 0002 sub-decision 1: the lock and the atomic write)', async () => {
  await withStore(async (mod, { dir, file }) => {
    const keys = Array.from({ length: 20 }, (_, i) => i.toString(16).padStart(2, '0').repeat(32));
    await Promise.all(keys.map((k, i) => mod.writeSelfMapChoice(k, i % 2 === 0, NOW_S + i)));
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    const wrong = [];
    for (const [i, k] of keys.entries()) {
      const got = json.assistants && json.assistants[k];
      if (!got || got.on !== (i % 2 === 0)) wrong.push(`${k.slice(0, 8)}…: want on ${i % 2 === 0}, got ${show(got)}`);
    }
    const left = fs.readdirSync(dir).filter((n) => n !== path.basename(file));
    if (left.length) wrong.push(`no temp files left: ${show(left)}`);
    assert(wrong.length === 0, wrong.join('; '));
  });
});

/* ───────────────────────── P — the refusals, and whose key (ADR 0002 sub-decision 5) ───────────────────────── */

test('P1: the module exports what ADR 0002 § Implementation notes 4 names — the handler factory and handler, setSelfMapFor, applySelfMap, withAssistantLock, SELF_MAP_SUBJECT "Your Assistant\'s self-Map", CODES and WORDS in story § Copy\'s words (AC-3; § Copy)', () => {
  const mod = publishModule();
  const wrong = [];
  for (const name of ['createSelfMapHandler', 'handleSelfMap', 'setSelfMapFor', 'applySelfMap', 'withAssistantLock']) if (typeof mod[name] !== 'function') wrong.push(`no ${name}()`);
  if (mod.SELF_MAP_SUBJECT !== SM.PRESS.subject) wrong.push(`SELF_MAP_SUBJECT: want ${show(SM.PRESS.subject)}, got ${show(mod.SELF_MAP_SUBJECT)}`);
  const codes = Object.values(mod.CODES || {});
  for (const c of Object.values(SM.PRESS.codes)) if (!codes.includes(c)) wrong.push(`CODES names ${c}`);
  const words = mod.WORDS || {};
  for (const [code, sentence] of Object.entries(SM.PRESS.refusals)) if (words[code] !== sentence) wrong.push(`WORDS['${code}']: want ${show(sentence)}, got ${show(words[code])}`);
  if (words.failed !== SM.PRESS.failed) wrong.push(`WORDS.failed: want ${show(SM.PRESS.failed)}, got ${show(words.failed)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('P2: without an authenticated session the route answers 401 not-signed-in in the approved words, before any key is read, and nothing is remembered, written or sent (AC-3)', async () => {
  const wrong = [];
  const w = world();
  for (const req of [{ session: {}, body: { on: true } }, { session: { authenticated: true, pubkey: 'nope' }, body: { on: true } }, { session: { authenticated: false, pubkey: OWNER }, body: { on: true } }, { body: { on: true } }]) {
    const got = await press(w, null, { req });
    if (got.res.statusCode !== 401 || !got.body || got.body.success !== false || got.body.code !== SM.PRESS.codes.notSignedIn || got.body.error !== SM.PRESS.refusals['not-signed-in']) {
      wrong.push(`${show(req.session)}: want 401 not-signed-in, got ${got.res.statusCode} ${show(got.body)}`);
    }
    if (got.calls.getAssistantKeys.length) wrong.push(`${show(req.session)}: no key read`);
    try { nothingDone(got, show(req.session)); } catch (e) { wrong.push(e.message); }
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('P3: a body whose on is not a boolean is a 400 bad-request, and nothing is remembered, written or sent — the path under test ran: the same session with { on: true } is accepted (AC-3; ADR 0002 P1)', async () => {
  const wrong = [];
  for (const body of [undefined, null, {}, { on: 'true' }, { on: 1 }, { on: null }, 'on=true', ['on']]) {
    const got = await press(world(), body);
    if (got.res.statusCode !== SM.PRESS.status.badRequest || !got.body || got.body.success !== false || got.body.code !== SM.PRESS.codes.badRequest) wrong.push(`${show(body)}: want 400 bad-request, got ${got.res.statusCode} ${show(got.body)}`);
    try { nothingDone(got, show(body)); } catch (e) { wrong.push(e.message); }
  }
  const ok = await press(world(), { on: true });
  if (ok.res.statusCode !== 200) wrong.push(`{ on: true } is accepted, got ${ok.res.statusCode} ${show(ok.body)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('P4: a signed-in viewer with no Assistant here gets 403 no-assistant in the approved words, and nothing is read past the key lookup, remembered, written or sent (AC-3)', async () => {
  const got = await press({ noAssistant: true }, { on: true });
  assert(got.res.statusCode === SM.PRESS.status.noAssistant && got.body && got.body.code === SM.PRESS.codes.noAssistant && got.body.error === SM.PRESS.refusals['no-assistant'], `want 403 no-assistant, got ${got.res.statusCode} ${show(got.body)}`);
  assert(got.calls.getAssistantKeys.length === 1 && got.calls.getAssistantKeys[0] === OWNER, `the session's viewer's keys were looked up once (got ${show(got.calls.getAssistantKeys)})`);
  assert(got.calls.scanLocal.length === 0 && got.calls.readRelay.length === 0, `nothing read past the key lookup (scans ${got.calls.scanLocal.length}, relay reads ${got.calls.readRelay.length})`);
  nothingDone(got, 'no Assistant');
});

test('P5: the request cannot choose — whatever else the body or query names, the session\'s own Assistant signs, its self-entries are the ones this instance computes, and no relay the request names is used (AC-3)', async () => {
  const w = world();
  const req = {
    session: { authenticated: true, pubkey: OWNER },
    body: { on: true, assistantPubkey: OTHER, pubkey: OTHER, selfEntries: [{ key: '*', relay: NOT_PUBLIC }], relays: [NOT_PUBLIC], tags: [['*', OTHER, NOT_PUBLIC]] },
    query: { pubkey: OTHER, relay: NOT_PUBLIC },
  };
  const got = await press(w, null, { req });
  const wrong = [];
  if (got.res.statusCode === SM.PRESS.status.badRequest) {
    try { nothingDone(got, 'refused'); } catch (e) { wrong.push(e.message); }
  } else {
    mustPublish(got, 'a press with extra fields');
    if (got.calls.getAssistantKeys[0] !== OWNER) wrong.push(`the session's viewer's keys: ${show(got.calls.getAssistantKeys)}`);
    if (got.signed.pubkey !== w.A) wrong.push(`signed by the session's Assistant ${w.A.slice(0, 8)}…, got ${String(got.signed.pubkey).slice(0, 8)}…`);
    if (!sameEntries(selfTags(got.signed, w.A), SHOULD)) wrong.push(`self-entries are what this instance computes ${show(SHOULD)}, got ${show(selfTags(got.signed, w.A))}`);
    const sent = got.calls.publishToRelays.flatMap((c) => c.relays).map(normUrl);
    if (sent.includes(normUrl(NOT_PUBLIC)) || JSON.stringify(got.signed.tags).includes(NOT_PUBLIC)) wrong.push('no relay the request names');
  }
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── R — never blind (ADR 0002 sub-decision 6 step 1, R1) ───────────────────────── */

function mustRefuseRead(got, what) {
  assert(got.res.statusCode === SM.PRESS.status.notRead && got.body && got.body.success === false && got.body.code === SM.PRESS.codes.notRead && got.body.error === SM.PRESS.refusals['not-read'],
    `${what}: want 503 not-read in the approved words, got ${got.res.statusCode} ${show(got.body)}`);
  nothingDone(got, what);
}
const isSelfMapScan = (A) => (f) => Array.isArray(f && f.kinds) && f.kinds.includes(SM.SELF_MAP_KIND) && Array.isArray(f.authors) && f.authors.map(lc).includes(A);

test('R1: Turn on when the viewer\'s Map cannot be read (this instance\'s scan fails and no Map relay answers) — 503 not-read; the choice unchanged, nothing written (AC-4 "Never blind")', async () => {
  const key = newAssistant();
  const got = await press({ key, rejectScan: (f) => Array.isArray(f.authors) && f.authors.map(lc).includes(OWNER), relays: { [A_WRITE]: [] } }, { on: true });
  mustRefuseRead(got, 'the Map unread');
});

test('R2: either press when this instance\'s scan for the Assistant\'s kind 10040 fails — 503 not-read; the choice unchanged, nothing written, even though an outside relay answers (AC-4; R1\'s strict finish)', async () => {
  for (const on of [true, false]) {
    const key = newAssistant();
    const got = await press({ key, rejectScan: isSelfMapScan(key.A) }, { on });
    mustRefuseRead(got, `on: ${on}`);
  }
});

test('R3: either press when this instance holds no version and outside relays exist but none answers — 503 not-read, so a wiped relay never makes the press build over nothing (AC-4; R1)', async () => {
  for (const on of [true, false]) {
    const got = await press({ base: null, relays: {} }, { on });
    mustRefuseRead(got, `on: ${on}, no outside answer`);
  }
});

test('R4: this instance holds no version and one outside relay answers holding none — finished: Turn on publishes the self-entries alone, with empty content (AC-4: "None found" is a finished read)', async () => {
  const got = await press({ base: null, relays: { [A_WRITE]: [] } }, { on: true });
  mustPublish(got, 'none found');
  const wrong = [];
  if (show(got.signed.tags) !== show([['39998', got.w.A, OWN]])) wrong.push(`tags: want [["39998", A, OWN]], got ${show(got.signed.tags)}`);
  if (got.signed.content !== '') wrong.push(`content '', got ${show(got.signed.content)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('R5: an outside relay holds a newer version than this instance — the press builds on the newer one: its entries are kept and its created_at is passed (AC-4; R1 reads every place)', async () => {
  const key = newAssistant();
  const older = version(key, instanceMapTags(key.A), { createdAt: NOW_S - 10 * H, content: 'older' });
  const newerTags = [...instanceMapTags(key.A), ['30393', OTHER, SCORES_R]];
  const newer = version(key, newerTags, { createdAt: NOW_S + 100, content: 'newer' });
  const got = await press({ key, base: older, relays: { [A_WRITE]: [newer], [DCOSL]: [], [NIP85]: [] } }, { on: true });
  mustPublish(got, 'a newer version outside');
  const wrong = [];
  if (show(kept(got.signed.tags, key.A, true)) !== show(kept(newerTags, key.A, true))) wrong.push(`kept tags are the newer version's: want ${show(kept(newerTags, key.A, true))}, got ${show(kept(got.signed.tags, key.A, true))}`);
  if (got.signed.content !== 'newer') wrong.push(`content is the newer version's, got ${show(got.signed.content)}`);
  if (!(got.signed.created_at > newer.created_at)) wrong.push(`created_at later than the newer version's ${newer.created_at}, got ${got.signed.created_at}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('R6: the base must be the Assistant\'s own, validly signed — a version on this instance\'s relay whose signature does not verify gives 503 not-read, and nothing is signed over it (AC-4; ADR 0002 sub-decision 6 step 1)', async () => {
  const key = newAssistant();
  const good = version(key, instanceMapTags(key.A), { content: PRIVATE_CONTENT });
  // Through JSON: a spread copy would carry nostr-tools' cached verification (its verifiedSymbol) and verify anyway.
  const forged = clone({ ...good, tags: [...good.tags, ['*', OTHER, NOT_PUBLIC]] });
  const got = await press({ key, base: forged }, { on: true });
  mustRefuseRead(got, 'a forged base');
});

test('R7: Turn on when upkeep cannot be read (this instance\'s Concept scan fails) — 503 not-read: what the self-Map should say is unknown (AC-4)', async () => {
  const got = await press({ rejectScan: (f) => Array.isArray(f.kinds) && f.kinds.includes(39998) }, { on: true });
  mustRefuseRead(got, 'upkeep unread');
});

test('R8: Turn off needs only the Assistant\'s kind 10040 — with the viewer\'s Map unreadable it still removes the self-entries (AC-4: what the self-Map should say is needed only to turn on)', async () => {
  const got = await press({ rejectScan: (f) => Array.isArray(f.authors) && f.authors.map(lc).includes(OWNER), relays: { [A_WRITE]: [] } }, { on: false });
  mustPublish(got, 'off with the Map unread');
  assert(selfTags(got.signed, got.w.A).length === 0, `no self-entries left, got ${show(selfTags(got.signed, got.w.A))}`);
});

/* ───────────────────────── E — what is signed (ADR 0002 sub-decision 6 steps 3–6) ───────────────────────── */

test('E1: Turn on over this instance\'s own Map — one kind 10040 signed by the Assistant whose self-entries are exactly what the self-Map should say, every other tag kept as written and in order (the expiration dropped), the private content kept, dated after the version it replaces (AC-3, AC-4)', async () => {
  const got = await press({}, { on: true });
  mustPublish(got, 'Turn on');
  const { A } = got.w;
  const base = got.w.local.find((e) => e.kind === SM.SELF_MAP_KIND && e.pubkey === A && e !== got.signed);
  const wrong = [];
  if (got.signed.kind !== SM.SELF_MAP_KIND) wrong.push(`kind 10040, got ${got.signed.kind}`);
  if (got.signed.pubkey !== A) wrong.push('signed by the Assistant');
  if (!nt().verifyEvent(clone(got.signed))) wrong.push('the signature verifies');
  if (got.calls.importEvent.length !== 1) wrong.push(`one version written here, got ${got.calls.importEvent.length}`);
  if (!sameEntries(selfTags(got.signed, A), SHOULD)) wrong.push(`self-entries: want ${show(SHOULD)}, got ${show(selfTags(got.signed, A))}`);
  if (selfTags(got.signed, A).some((t) => t.length !== 3)) wrong.push(`each self-entry is [key, author, relay], got ${show(selfTags(got.signed, A))}`);
  if (show(kept(got.signed.tags, A, false)) !== show(kept(base.tags, A, true))) wrong.push(`kept tags: want ${show(kept(base.tags, A, true))}, got ${show(kept(got.signed.tags, A, false))}`);
  if (got.signed.tags.some((t) => t[0] === 'expiration')) wrong.push('no expiration beside a self-entry (§ 9.2 No expiration)');
  if (got.signed.content !== PRIVATE_CONTENT) wrong.push(`content kept, got ${show(got.signed.content)}`);
  if (got.signed.created_at !== Math.max(NOW_S, base.created_at + 1)) wrong.push(`created_at max(now, found + 1) = ${Math.max(NOW_S, base.created_at + 1)}, got ${got.signed.created_at}`);
  if (got.result.on !== true || got.result.selfEntries !== 1 || got.result.ok !== true) wrong.push(`result { ok: true, on: true, published: true, selfEntries: 1 }, got ${show(got.result)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('E2: the self-Map owns every entry naming the Assistant — a stale self-entry and one readers ignore (39998:) are replaced; a tag naming the Assistant that is not an entry (p) and entries naming other keys are kept (AC-4)', async () => {
  const got = await press({}, { on: true });
  mustPublish(got, 'Turn on');
  const { A } = got.w;
  const tags = got.signed.tags;
  const wrong = [];
  if (tags.some((t) => t[0] === '39998:' || (t[0] === '30382' && t[1] === A))) wrong.push(`the stale and ignored self-entries are gone, got ${show(tags)}`);
  if (!tags.some((t) => t[0] === 'p' && t[1] === A)) wrong.push('the p tag naming the Assistant stays');
  if (!tags.some((t) => t[0] === '30382:rank' && t[1] === OTHER) || !tags.some((t) => t[0] === '30392' && t[1] === OTHER && t[3] === 'a fourth element, kept as written')) wrong.push('the entries naming another key stay, as written');
  assert(wrong.length === 0, wrong.join('; '));
});

test('E3: Turn on when the self-Map already says what should be said publishes nothing — 200 with published false, unchanged already-current and its words; the choice is still remembered (AC-2, AC-1)', async () => {
  const key = newAssistant();
  const base = version(key, [['30382:rank', OTHER, SCORES_R], ['39998', key.A, OWN]], { content: '' });
  const got = await press({ key, base }, { on: true });
  const r = mustAccept(got, 'already current');
  const wrong = [];
  if (r.published !== false || r.unchanged !== 'already-current' || r.message !== SM.PRESS.unchanged['already-current'] || r.on !== true) wrong.push(`want { published: false, unchanged: 'already-current', on: true, message }, got ${show(r)}`);
  if (got.calls.importEvent.length || got.calls.publishToRelays.length) wrong.push('nothing written or sent');
  if (show(got.calls.writeChoice) !== show([[key.A, true, NOW_S]])) wrong.push(`the choice remembered on, got ${show(got.calls.writeChoice)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('E4: Turn on with nothing live to claim and no self-entry found publishes nothing — unchanged nothing-to-claim and its words, the choice remembered on (AC-2)', async () => {
  const key = newAssistant();
  const got = await press({ key, headers: [], base: version(key, [['client', 'Brainstorm']]) }, { on: true });
  const r = mustAccept(got, 'nothing to claim');
  const wrong = [];
  if (r.published !== false || r.unchanged !== 'nothing-to-claim' || r.message !== SM.PRESS.unchanged['nothing-to-claim']) wrong.push(`want { published: false, unchanged: 'nothing-to-claim', message }, got ${show(r)}`);
  if (got.calls.importEvent.length) wrong.push('nothing written');
  if (show(got.calls.writeChoice) !== show([[key.A, true, NOW_S]])) wrong.push(`the choice remembered on, got ${show(got.calls.writeChoice)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('E5: Turn on with nothing live to claim while stale self-entries are found publishes their removal — the self-Map is made true (AC-2: Turn on publishes what it should say when that differs)', async () => {
  const got = await press({ headers: [] }, { on: true });
  mustPublish(got, 'nothing to claim, stale claims');
  assert(selfTags(got.signed, got.w.A).length === 0, `no self-entries, got ${show(selfTags(got.signed, got.w.A))}`);
  assert(got.result.on === true, 'the choice is on');
});

test('E6: Turn off removes every self-entry and keeps every other tag as written, the expiration included, and the content — retracting nothing: one event written, a kind 10040, and nothing else (AC-5)', async () => {
  const got = await press({}, { on: false });
  mustPublish(got, 'Turn off');
  const { A } = got.w;
  const base = got.w.local.find((e) => e.kind === SM.SELF_MAP_KIND && e.pubkey === A && e !== got.signed);
  const wrong = [];
  if (selfTags(got.signed, A).length !== 0) wrong.push(`no self-entries, got ${show(selfTags(got.signed, A))}`);
  if (show(got.signed.tags) !== show(kept(base.tags, A, false))) wrong.push(`every other tag, the expiration included: want ${show(kept(base.tags, A, false))}, got ${show(got.signed.tags)}`);
  if (got.signed.content !== PRIVATE_CONTENT) wrong.push('content kept');
  if (got.calls.importEvent.length !== 1 || got.calls.importEvent.some((e) => e.kind !== SM.SELF_MAP_KIND)) wrong.push(`one kind 10040 and nothing else (no retraction, no deletion), got ${show(got.calls.importEvent.map((e) => e.kind))}`);
  if (got.calls.publishToRelays.some((c) => c.event.kind !== SM.SELF_MAP_KIND)) wrong.push('nothing else sent');
  if (got.result.on !== false || got.result.selfEntries !== 0) wrong.push(`result { on: false, selfEntries: 0 }, got ${show(got.result)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('E7: Turn off when nothing is claimed publishes nothing — unchanged nothing-claimed and its words, the choice remembered off (AC-5)', async () => {
  const key = newAssistant();
  const got = await press({ key, base: version(key, [['30382:rank', OTHER, SCORES_R]]) }, { on: false });
  const r = mustAccept(got, 'nothing claimed');
  const wrong = [];
  if (r.published !== false || r.unchanged !== 'nothing-claimed' || r.message !== SM.PRESS.unchanged['nothing-claimed'] || r.on !== false) wrong.push(`want { published: false, unchanged: 'nothing-claimed', on: false, message }, got ${show(r)}`);
  if (got.calls.importEvent.length) wrong.push('nothing written');
  if (show(got.calls.writeChoice) !== show([[key.A, false, NOW_S]])) wrong.push(`the choice remembered off, got ${show(got.calls.writeChoice)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('E8: Turn off of a version holding only self-entries leaves an empty Map — no tags, the content kept, not a deletion (AC-5)', async () => {
  const key = newAssistant();
  const got = await press({ key, base: version(key, [['39998', key.A, OWN], ['3038x', key.A, OWN]], { content: 'kept as is' }) }, { on: false });
  mustPublish(got, 'only self-entries');
  const wrong = [];
  if (show(got.signed.tags) !== '[]') wrong.push(`no tags, got ${show(got.signed.tags)}`);
  if (got.signed.content !== 'kept as is') wrong.push('content kept');
  if (got.calls.importEvent.some((e) => e.kind === 5)) wrong.push('no deletion request');
  assert(wrong.length === 0, wrong.join('; '));
});

test('E9: read back — after Turn on, story 1\'s check over the same relay finds the self-Map up to date (done); after Turn off, it finds no self-entries (AC-3 "Read back")', async () => {
  const w = world();
  const on = await press(w, { on: true });
  mustPublish(on, 'Turn on');
  const { L, selfMap } = pressDeps(w);
  const gather = need(selfMap, 'gatherSelfMap', rel(SELF_MAP_MODULE));
  const afterOn = await gather({ viewer: OWNER, assistantPubkey: w.A, forWrite: false }, L);
  const wrong = [];
  if (!afterOn || !afterOn.answer || afterOn.answer.current !== true || afterOn.answer.done !== true) wrong.push(`after Turn on: current and done, got ${show(afterOn && afterOn.answer && { current: afterOn.answer.current, done: afterOn.answer.done, shouldSay: afterOn.answer.shouldSay, published: afterOn.answer.published })}`);
  const off = await press(w, { on: false });
  mustPublish(off, 'Turn off');
  const afterOff = await gather({ viewer: OWNER, assistantPubkey: w.A, forWrite: false }, L);
  const found = afterOff && afterOff.answer && afterOff.answer.published ? afterOff.answer.published.selfEntries : null;
  if (!Array.isArray(found) || found.length !== 0) wrong.push(`after Turn off: no self-entries found, got ${show(found)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('E10: the preservation check guards the write — if the signer returns an event whose kept tags or content differ from the version found, nothing is written or sent and the press answers 500 in the approved words (ADR 0002 sub-decision 6 step 6)', async () => {
  const w = world();
  const { deps, calls } = pressDeps(w);
  deps.finalizeEvent = (template, sk) => nt().finalizeEvent({ ...template, tags: [...template.tags, ['*', OTHER, NOT_PUBLIC]] }, sk);
  const handle = need(publishModule(), 'createSelfMapHandler', rel(MODULE))(deps);
  const res = fakeRes();
  quiet();
  try { await within(handle(pressReq(OWNER, { on: true }), res), PRESS_LIMIT_MS); } finally { restoreConsole(); }
  assert(res.statusCode === SM.PRESS.status.failed && res.body && res.body.success === false && res.body.error === SM.PRESS.failed, `want 500 with "${SM.PRESS.failed}", got ${res.statusCode} ${show(res.body)}`);
  assert(calls.importEvent.length === 0 && calls.publishToRelays.length === 0, `nothing written or sent (imports ${calls.importEvent.length}, sends ${calls.publishToRelays.length})`);
});

/* ───────────────────────── C — the remembered choice (ADR 0002 sub-decision 6 step 2) ───────────────────────── */

test('C1: an accepted press remembers the choice — writeSelfMapChoice(Assistant, on, now in seconds) once, before anything is written or sent (AC-1)', async () => {
  for (const on of [true, false]) {
    const got = await press({}, { on });
    mustPublish(got, `on: ${on}`);
    assert(show(got.calls.writeChoice) === show([[got.w.A, on, NOW_S]]), `on: ${on}: want [[A, ${on}, ${NOW_S}]], got ${show(got.calls.writeChoice)}`);
    assert(got.calls.order[0] === 'choice' && got.calls.order.indexOf('import') > 0, `on: ${on}: the choice before the write, got ${show(got.calls.order)}`);
  }
});

test('C2: the choice holds even when this instance\'s relay refuses the version — the press answers ok false, stage local, with the local-failure sentence, and nothing goes outward (AC-1, AC-6)', async () => {
  const { localFailureMessage } = require('../src/api/assistant/profilePublish');
  const got = await press({ importFails: true }, { on: true });
  const r = mustAccept(got, 'local write refused');
  const wrong = [];
  if (r.ok !== false || r.stage !== 'local' || r.published !== false) wrong.push(`want { ok: false, stage: 'local', published: false }, got ${show(r)}`);
  const want = localFailureMessage(SM.PRESS.subject, 'fixture: strfry import refused');
  if (r.message !== want) wrong.push(`message: want ${show(want)}, got ${show(r.message)}`);
  if (got.calls.publishToRelays.length) wrong.push('nothing sent outward');
  if (show(got.calls.writeChoice) !== show([[got.w.A, true, NOW_S]])) wrong.push(`the choice remembered on, got ${show(got.calls.writeChoice)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('C3: when the choice cannot be remembered, the press answers 500 "This instance did not answer; nothing was published." and nothing is written or sent (AC-1; ADR 0002 sub-decision 6 step 2)', async () => {
  const got = await press({ choiceThrows: true }, { on: true });
  assert(got.res.statusCode === SM.PRESS.status.failed && got.body && got.body.success === false && got.body.error === SM.PRESS.failed, `want 500 with the approved words, got ${got.res.statusCode} ${show(got.body)}`);
  assert(got.calls.writeChoice.length === 1, 'the write was attempted');
  assert(got.calls.importEvent.length === 0 && got.calls.publishToRelays.length === 0, 'nothing written or sent');
});

test('C4: with the real store at a temp path, Turn on records the Assistant on and Turn off records it off (AC-1; ADR 0002 sub-decision 1 with sub-decision 6)', async () => {
  await withStore(async (mod) => {
    const w = world();
    const { deps } = pressDeps(w);
    deps.writeSelfMapChoice = (pk, on, nowSeconds) => mod.writeSelfMapChoice(pk, on, nowSeconds);
    const handle = need(publishModule(), 'createSelfMapHandler', rel(MODULE))(deps);
    const wrong = [];
    for (const on of [true, false]) {
      const res = fakeRes();
      quiet();
      try { await within(handle(pressReq(OWNER, { on }), res), PRESS_LIMIT_MS); } finally { restoreConsole(); }
      if (res.statusCode !== 200) wrong.push(`on: ${on}: 200, got ${res.statusCode} ${show(res.body)}`);
      if (await mod.readSelfMapChoice(w.A) !== on) wrong.push(`on: ${on}: the store reads ${on}, got ${show(await mod.readSelfMapChoice(w.A))}`);
    }
    assert(wrong.length === 0, wrong.join('; '));
  });
});

/* ───────────────────────── W — where it goes (ADR 0002 sub-decision 6 steps 7–9) ───────────────────────── */

test('W1: this instance\'s relay first, then outward — the write precedes the send (AC-6)', async () => {
  const got = await press({}, { on: true });
  mustPublish(got, 'Turn on');
  const i = got.calls.order.indexOf('import');
  const j = got.calls.order.indexOf('publish');
  assert(i >= 0 && j > i, `import before publish, got ${show(got.calls.order)}`);
  assert(got.calls.publishToRelays.every((c) => c.event.id === got.signed.id), 'the same signed event goes out');
});

test('W2: the set — the Assistant\'s write relays and every relay a self-entry of the version found named, each guarded and once; never this instance\'s relay, a read-only relay, Nous\' relays, or the viewer\'s Map hints (AC-6; § 9.2 Finding a self-Map)', async () => {
  const got = await press({}, { on: true });
  mustPublish(got, 'Turn on');
  const sent = got.calls.publishToRelays.flatMap((c) => c.relays).map(normUrl);
  const wrong = [];
  for (const want of [A_WRITE, OLD1]) if (!sent.includes(normUrl(want))) wrong.push(`sent to ${want}`);
  for (const never of [OWN, SM.DOCKER_RELAY_URL, A_READ, N1, PUB1, MAPR, DCOSL, NIP85]) if (sent.includes(normUrl(never))) wrong.push(`never sent to ${never}`);
  if (new Set(sent).size !== sent.length) wrong.push(`each relay once, got ${show(sent)}`);
  for (const host of [hostOf(A_WRITE), hostOf(OLD1)]) if (!got.calls.guard.includes(host)) wrong.push(`${host} is DNS-guarded before it is connected to`);
  const rows = (got.result.relays && got.result.relays.results) || [];
  if (rows.length !== sent.length || !rows.every((row) => row.status === 'accepted')) wrong.push(`one accepted row per relay sent, got ${show(rows)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('W3: Turn off reaches every relay that held the claim — the removal goes to the found self-entries\' relays and the Assistant\'s write relays (AC-6: "so that a removal reaches every relay that held the claim")', async () => {
  const key = newAssistant();
  const OLD2 = 'wss://old-two.example';
  const base = version(key, [['client', 'Brainstorm'], ['39998', key.A, OLD1], ['3038x', key.A, OLD2]]);
  const got = await press({ key, base, relays: { [A_WRITE]: [], [OLD1]: [], [OLD2]: [] } }, { on: false });
  mustPublish(got, 'Turn off');
  const sent = got.calls.publishToRelays.flatMap((c) => c.relays).map(normUrl);
  for (const want of [OLD1, OLD2, A_WRITE]) assert(sent.includes(normUrl(want)), `sent to ${want}, got ${show(sent)}`);
});

test('W4: a typed relay on the Assistant Duties list is sent as configured, without the DNS guard, and an event-named relay whose host is not public is not sent — its row says so (AC-6)', async () => {
  const key = newAssistant();
  // Both Concept kinds at the typed relay: a bare 39998 covers 39999 too, so story 1's engine claims it only where the
  // two share a relay (ADR 0001 sub-decision 2, "Its relay").
  const duties = DM.DEFAULT_DUTIES.map((d) => (d.key === '39998' || d.key === '39999' ? { key: d.key, relay: DLIST } : d));
  const got = await press({ key, duties, notPublic: [hostOf(OLD1)], relays: { [A_WRITE]: [], [DLIST]: [header(key.A, 'dog-tricks')], [DCOSL]: [], [NIP85]: [] } }, { on: true });
  mustPublish(got, 'a typed Concept relay');
  const sent = got.calls.publishToRelays.flatMap((c) => c.relays).map(normUrl);
  const wrong = [];
  if (!sameEntries(selfTags(got.signed, key.A), [{ key: '39998', relay: DLIST }])) wrong.push(`the self-entry names the typed relay, got ${show(selfTags(got.signed, key.A))}`);
  if (!sent.includes(normUrl(DLIST))) wrong.push(`sent to the typed relay ${DLIST}`);
  if (got.calls.guard.includes(hostOf(DLIST))) wrong.push('the typed relay is not DNS-guarded (owner-set, sent as such)');
  if (sent.includes(normUrl(OLD1))) wrong.push('the not-public relay is not sent to');
  const row = ((got.result.relays && got.result.relays.results) || []).find((r) => normUrl(r.relay) === normUrl(OLD1));
  if (!row || row.status !== 'not-sent' || row.reason !== 'not a public address') wrong.push(`its row reads not-sent: not a public address, got ${show(row)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('W5: at most 50 relays from events are tried (AC-6: the Duty Menu\'s cap)', async () => {
  const key = newAssistant();
  const many = Array.from({ length: 60 }, (_, i) => `wss://old-${i}.example`);
  const base = version(key, [['client', 'Brainstorm'], ...many.map((u, i) => [`30382:m${i}`, key.A, u])]);
  const got = await press({ key, base }, { on: true });
  mustPublish(got, 'sixty old relays');
  const sent = got.calls.publishToRelays.flatMap((c) => c.relays);
  const fromEvents = sent.filter((u) => /old-\d+\.example|a-write/.test(u));
  assert(fromEvents.length <= 50, `at most 50 event-named relays, got ${fromEvents.length}`);
});

test('W6: local-only mode keeps it on this instance\'s relay — nothing is sent, every row is skipped, and the summary is the shared local-only sentence (AC-6)', async () => {
  const { summarizePublish } = require('../src/api/assistant/profilePublish');
  const got = await press({ localOnly: true }, { on: true });
  const r = mustPublish(got, 'local-only');
  const rows = (r.relays && r.relays.results) || [];
  const wrong = [];
  if (got.calls.publishToRelays.length) wrong.push('nothing sent');
  if (rows.length === 0 || !rows.every((row) => row.status === 'skipped')) wrong.push(`every row skipped, got ${show(rows)}`);
  const want = summarizePublish({ subject: SM.PRESS.subject, rows, localOnly: true }).message;
  if (r.message !== want || r.localOnly !== true) wrong.push(`message ${show(want)} and localOnly, got ${show({ message: r.message, localOnly: r.localOnly })}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('W7: the summary is the shared sentence with the subject "Your Assistant\'s self-Map" — and with no relay at all to send to, "…There was no other relay to send it to." (AC-2 report; § Copy)', async () => {
  const { summarizePublish } = require('../src/api/assistant/profilePublish');
  const wrong = [];
  const refused = await press({ refuse: [OLD1] }, { on: true });
  const r = mustPublish(refused, 'one relay refuses');
  const want = summarizePublish({ subject: SM.PRESS.subject, rows: r.relays.results, localOnly: false }).message;
  if (r.message !== want) wrong.push(`one refusal: want ${show(want)}, got ${show(r.message)}`);
  const key = newAssistant();
  const lonely = world({ key, base: version(key, [['client', 'Brainstorm']]), relays: { [DCOSL]: [], [NIP85]: [] } });
  lonely.local = lonely.local.filter((e) => e.kind !== SM.RELAY_LIST_KIND);
  const none = await press(lonely, { on: true });
  const rn = mustPublish(none, 'no relay at all');
  if (rn.message !== SM.PRESS.nothingElse) wrong.push(`no relay: want ${show(SM.PRESS.nothingElse)}, got ${show(rn.message)}`);
  if (!(rn.relays && rn.relays.total === 0)) wrong.push(`no relay rows, got ${show(rn.relays)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── L — one press at a time (ADR 0002 sub-decision 6, withAssistantLock) ───────────────────────── */

test('L1: two presses for one Assistant at once publish one after the other — the second builds on the first\'s version and is dated later, so no two versions share a created_at (AC-4; § 9.2 When it changes)', async () => {
  const w = world();
  const { deps, calls } = pressDeps(w);
  const handle = need(publishModule(), 'createSelfMapHandler', rel(MODULE))(deps);
  const r1 = fakeRes();
  const r2 = fakeRes();
  quiet();
  try { await within(Promise.all([handle(pressReq(OWNER, { on: true }), r1), handle(pressReq(OWNER, { on: false }), r2)]), PRESS_LIMIT_MS * 2); } finally { restoreConsole(); }
  assert(r1.statusCode === 200 && r2.statusCode === 200, `both accepted, got ${r1.statusCode} ${show(r1.body)} / ${r2.statusCode} ${show(r2.body)}`);
  assert(calls.importEvent.length === 2, `two versions written, got ${calls.importEvent.length}`);
  const [first, second] = calls.importEvent;
  const wrong = [];
  if (!(second.created_at > first.created_at)) wrong.push(`the second is dated after the first (${first.created_at} then ${second.created_at})`);
  if (selfTags(first, w.A).length !== 1) wrong.push(`the first (Turn on) claims 39998, got ${show(selfTags(first, w.A))}`);
  if (selfTags(second, w.A).length !== 0) wrong.push(`the second (Turn off) claims nothing, got ${show(selfTags(second, w.A))}`);
  if (show(kept(second.tags, w.A, false)) !== show(kept(first.tags, w.A, false))) wrong.push('the second keeps the first\'s other tags (it built on the first)');
  assert(wrong.length === 0, wrong.join('; '));
});

test('L2: withAssistantLock runs one task at a time per Assistant, in arrival order, and never holds another Assistant back (ADR 0002 sub-decision 6)', async () => {
  const lock = need(publishModule(), 'withAssistantLock', rel(MODULE));
  const log = [];
  const task = (name, ms) => async () => { log.push(`${name}:start`); await new Promise((r) => setTimeout(r, ms)); log.push(`${name}:end`); return name; };
  const got = await Promise.all([lock(A1, task('a', 40)), lock(A1, task('b', 5)), lock(A2, task('c', 5))]);
  const wrong = [];
  if (show(got) !== show(['a', 'b', 'c'])) wrong.push(`each task's answer passes through, got ${show(got)}`);
  if (log.indexOf('b:start') < log.indexOf('a:end')) wrong.push(`b waits for a: ${show(log)}`);
  if (log.indexOf('c:end') > log.indexOf('a:end')) wrong.push(`c (another Assistant) does not wait for a: ${show(log)}`);
  let failed = false;
  await lock(A1, async () => { throw new Error('fixture'); }).catch(() => { failed = true; });
  const after = await lock(A1, async () => 'next');
  if (!failed || after !== 'next') wrong.push('a task that throws rejects, and the next one still runs');
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── S — sentinels ───────────────────────── */

test('S1: the route is registered — app.post(\'/api/assistant/self-map\', …) in src/api/index.js, handled by selfMapPublish\'s handleSelfMap (ADR 0002 sub-decision 5)', () => {
  // The raw source, a line that starts with the call (so a commented-out one does not count): codeOnly mistakes a '/*'
  // inside a route string for a comment (review assistant-duties-settings #1, non-blocking 5).
  const src = safeRead(API_INDEX);
  assert(/^[ \t]*app\.post\(\s*['"]\/api\/assistant\/self-map['"]\s*,\s*require\(\s*['"]\.\/assistant\/selfMapPublish(?:\.js)?['"]\s*\)\.handleSelfMap\s*\)/m.test(src), "src/api/index.js has no app.post('/api/assistant/self-map', require('./assistant/selfMapPublish').handleSelfMap)");
});

test('S2: the route table opens it to a signed-in person, with its why — \'POST /api/assistant/self-map\': signed-in, an action (ADR 0002 sub-decision 5)', () => {
  delete require.cache[require.resolve(ROUTE_ACCESS)];
  const { ROUTE_ACCESS: table } = require(ROUTE_ACCESS);
  const entry = table && table[SM.PRESS.routeKey];
  assert(entry && entry.access === 'signed-in' && entry.kind === 'action' && typeof entry.why === 'string' && entry.why.trim().length > 0, `want a signed-in action with a why, got ${show(entry)}`);
});

test('S3: nothing else signs a self-Map or a kind 10040 as an Assistant — no module but src/api/index.js and the route table names the route or the press (no caller in src/, bin/, setup/ or scripts/), the client helper is the UI\'s one caller, the press schedules nothing and holds no 64-hex literal, and the generic signer gains nothing (AC-3)', () => {
  assert(fs.existsSync(MODULE), `${rel(MODULE)} does not exist (the refusals below need the module to mean anything)`);
  const offenders = [];
  const walk = (dir, allowed, re) => {
    if (!fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) { if (!['node_modules', 'dist', '.git'].includes(ent.name)) walk(p, allowed, re); continue; }
      if (!/\.(js|mjs|cjs|jsx|sh)$/.test(ent.name) || allowed.includes(p)) continue;
      if (re.test(safeRead(p))) offenders.push(rel(p));
    }
  };
  const named = /selfMapPublish|applySelfMap|setSelfMapFor|handleSelfMap|createSelfMapHandler|api\/assistant\/self-map['"`/]/;
  for (const dir of ['src', 'bin', 'setup', 'scripts']) walk(path.join(REPO, dir), [MODULE, API_INDEX, ROUTE_ACCESS], named);
  walk(path.join(REPO, 'ui/src'), [CLIENT_UTIL], /api\/assistant\/self-map/);
  assert(offenders.length === 0, `only src/api/index.js, the route table and (in the UI) the client helper may name the press: ${offenders.join(', ')}`);
  const mod = codeOnly(safeRead(MODULE));
  const wrong = [];
  if (/setInterval|cron|schedule\s*\(/i.test(mod)) wrong.push('the module schedules nothing');
  if (/['"][0-9a-f]{64}['"]/i.test(mod)) wrong.push('no 64-hex literal in the module');
  if (!/privkeyBytesOf/.test(mod) || !/buildSelfMapEvent\s*\(/.test(mod)) wrong.push('the module signs through privkeyBytesOf and builds through buildSelfMapEvent');
  if (/10040|self-?map/i.test(codeOnly(safeRead(GENERIC_SIGNER)))) wrong.push('the generic signer does not gain the self-Map');
  for (const file of ['src/api/assistant/index.js', 'src/utils/customerManager.js', 'setup/create_nostr_identity.sh']) {
    if (/selfMapPublish|applySelfMap|self-map/.test(safeRead(path.join(REPO, file)))) wrong.push(`${file} publishes no self-Map at creation`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('S4: the choice file has one writer — only selfMapChoice.js names assistant-self-map.json or writes it, only the press calls writeSelfMapChoice, and the store writes through a temp file and a rename (AC-1; ADR 0002 sub-decision 1)', () => {
  assert(fs.existsSync(CHOICE), `${rel(CHOICE)} does not exist`);
  const offenders = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) { if (!['node_modules', 'dist', '.git'].includes(ent.name)) walk(p); continue; }
      if (!/\.(js|mjs|cjs|jsx|sh)$/.test(ent.name) || p === CHOICE) continue;
      const src = codeOnly(safeRead(p));
      if (/assistant-self-map\.json/.test(src)) offenders.push(`${rel(p)} names the file`);
      if (p !== MODULE && /writeSelfMapChoice/.test(src)) offenders.push(`${rel(p)} calls writeSelfMapChoice`);
    }
  };
  for (const dir of ['src', 'bin', 'setup', 'scripts']) walk(path.join(REPO, dir));
  const store = codeOnly(safeRead(CHOICE));
  if (!/renameSync/.test(store)) offenders.push('selfMapChoice.js writes through a temp file and renameSync');
  if (/\breq\s*\.|\brequest\s*\./.test(store)) offenders.push('selfMapChoice.js never reads a request');
  assert(offenders.length === 0, offenders.join('; '));
});

test('S5: the records — openapi.yaml documents POST /api/assistant/self-map and its attention entry names selfMapOn; BIBLE §11 has its POST row and the attention row names selfMapOn; BIBLE §15 names assistant-self-map.json; ADR 0001 notes it is extended by ADR 0002 (ADR 0002 sub-decision 8)', () => {
  const wrong = [];
  const openapi = safeRead(OPENAPI);
  if (!/^\s*\/api\/assistant\/self-map:\s*$/m.test(openapi)) wrong.push('openapi.yaml has no /api/assistant/self-map path');
  const at = openapi.indexOf('/api/assistant/attention:');
  const block = at >= 0 ? openapi.slice(at, openapi.indexOf(NL + '  /api/', at + 10)) : '';
  if (!/selfMapOn/.test(block)) wrong.push('the attention entry does not name selfMapOn');
  const bible = safeRead(BIBLE);
  const lines = bible.split(NL);
  if (!lines.some((l) => l.startsWith('| POST |') && l.includes('`/api/assistant/self-map`'))) wrong.push('no BIBLE §11 POST row for /api/assistant/self-map');
  const row = lines.find((l) => l.includes('`/api/assistant/attention`')) || '';
  if (!/selfMapOn/.test(row)) wrong.push('the attention row does not name selfMapOn');
  const s15 = bible.slice(bible.indexOf('## 15.'), bible.indexOf('## 16.'));
  if (!/assistant-self-map\.json/.test(s15)) wrong.push('BIBLE §15 does not name assistant-self-map.json');
  if (!/Extended by ADR 0002/.test(safeRead(ADR_0001))) wrong.push('ADR 0001 carries no "Extended by ADR 0002" note');
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── Round 2: ADR 0002 Amendment 1 (review round 1) ───────────────────────── */

/** A press with one seam replaced (C5, C6). */
async function pressWith(w, body, patch) {
  const { deps, calls } = pressDeps(w);
  Object.assign(deps, patch);
  const handle = need(publishModule(), 'createSelfMapHandler', rel(MODULE))(deps);
  const res = fakeRes();
  quiet();
  try { await within(handle(pressReq(w.viewer, body), res), PRESS_LIMIT_MS); } finally { restoreConsole(); }
  return { res, body: res.body, calls };
}
const OWN_HINTS = (A) => [['39998', A, OWN], ['3038x', A, OWN], ['39999', A, OWN]];

test('R9 (A1 item 1.1): nothing on this instance\'s relay and the Assistant\'s relay-list lookup does not finish (its relays don\'t answer) — 503 not-read for either press, even though the viewer\'s Map hints answer; nothing changes', async () => {
  for (const on of [true, false]) {
    const got = await press({ base: null, noRelayList: true, relays: { [DCOSL]: [], [NIP85]: [] } }, { on });
    mustRefuseRead(got, `on: ${on}, relay-list lookup unfinished`);
  }
});

test('R10 (A1 item 1.2; A2 item 5, review round 2 R2-N1): nothing on this instance\'s relay and the only write relay is refused by the DNS guard — a guarded-out write relay has not answered: 503 not-read, though the hints answer; and the press never connects to it (the guard comes before the read)', async () => {
  const got = await press({ base: null, notPublic: [hostOf(A_WRITE)], relays: { [A_WRITE]: [], [DCOSL]: [], [NIP85]: [] } }, { on: true });
  mustRefuseRead(got, 'the write relay guarded out');
  const touched = got.calls.readRelay.filter((r) => hostOf(r.url) === hostOf(A_WRITE)).map((r) => r.url);
  assert(touched.length === 0, `no read of the write relay the DNS guard refused, got ${show(touched)}`);
});

test('R11 (A1 item 1.2): nothing on this instance\'s relay, the write relays silent, and an owner-set typed offer relay answering empty — the offer relay does not stand in for the write relays: 503 not-read', async () => {
  const key = newAssistant();
  const duties = DM.DEFAULT_DUTIES.map((d) => (d.key === '39998' || d.key === '39999' ? { key: d.key, relay: DLIST } : d));
  const got = await press({ key, base: null, duties, relays: { [DLIST]: [header(key.A, 'dog-tricks')] } }, { on: true });
  mustRefuseRead(got, 'write relays silent, offer relay answering');
});

test('R12 (A1 item 1, the finished case): nothing on this instance\'s relay, no outside relay to look the relay list up on (no-outside-relays), the hints and the offer this instance\'s own — finished: Turn on publishes the self-entries alone', async () => {
  const key = newAssistant();
  const got = await press({ key, base: null, noRelayList: true, publishRelays: [SM.DOCKER_RELAY_URL], mapTags: OWN_HINTS(key.A), relays: {} }, { on: true });
  mustPublish(got, 'nothing anywhere to ask');
  assert(show(got.signed.tags) === show([['39998', key.A, OWN]]), `the self-entry alone, got ${show(got.signed.tags)}`);
});

test('R13 (A1 item 1.2, the finished case): nothing on this instance\'s relay, two write relays, one silent and one answering with nothing — finished: Turn on publishes', async () => {
  const key = newAssistant();
  const A2W = 'wss://a-write-two.example';
  const twoWrites = ev(SM.RELAY_LIST_KIND, key.A, NOW_S - 50 * H, [['r', A_WRITE, 'write'], ['r', A2W, 'write']]);
  const got = await press({ key, base: null, noRelayList: true, extraLocal: [twoWrites], relays: { [A2W]: [] } }, { on: true });
  mustPublish(got, 'one write relay answered');
  assert(sameEntries(selfTags(got.signed, key.A), SHOULD), `self-entries ${show(SHOULD)}, got ${show(selfTags(got.signed, key.A))}`);
});

test('E11 (A1 item 2): Turn on when the self-entries already match but the version carries an expiration — it publishes, and the new version carries no expiration (§ 9.2, No expiration)', async () => {
  const key = newAssistant();
  const base = version(key, [['30382:rank', OTHER, SCORES_R], ['39998', key.A, OWN], ['expiration', String(NOW_S + 86400)]]);
  const got = await press({ key, base }, { on: true });
  mustPublish(got, 'already matching, with an expiration');
  const wrong = [];
  if (got.signed.tags.some((t) => t[0] === 'expiration')) wrong.push('the expiration is gone');
  if (!sameEntries(selfTags(got.signed, key.A), SHOULD)) wrong.push(`self-entries ${show(SHOULD)}, got ${show(selfTags(got.signed, key.A))}`);
  if (show(kept(got.signed.tags, key.A, false)) !== show([['30382:rank', OTHER, SCORES_R]])) wrong.push(`the other entry kept, got ${show(kept(got.signed.tags, key.A, false))}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('E12 (A1 item 2): Turn on when the self-entries already match but a stray owned tag readers ignore (39998:) sits beside them — it publishes, and the stray tag is gone', async () => {
  const key = newAssistant();
  const got = await press({ key, base: version(key, [['39998', key.A, OWN], ['39998:', key.A, OWN]]) }, { on: true });
  mustPublish(got, 'already matching, with a stray owned tag');
  assert(show(selfTags(got.signed, key.A)) === show([['39998', key.A, OWN]]), `one owned tag left, the self-entry, got ${show(selfTags(got.signed, key.A))}`);
});

test('E13 (A1 item 2): Turn on when the self-entry is there twice — it publishes, and one is left', async () => {
  const key = newAssistant();
  const got = await press({ key, base: version(key, [['39998', key.A, OWN], ['client', 'Brainstorm'], ['39998', key.A, OWN]]) }, { on: true });
  mustPublish(got, 'a duplicate self-entry');
  assert(show(selfTags(got.signed, key.A)) === show([['39998', key.A, OWN]]), `one self-entry left, got ${show(selfTags(got.signed, key.A))}`);
});

test('E14 (A1 item 2, unchanged for an empty target): Turn off when only a stray owned tag readers ignore is there — nothing is claimed, so nothing is published', async () => {
  const key = newAssistant();
  const got = await press({ key, base: version(key, [['client', 'Brainstorm'], ['39998:', key.A, OWN]]) }, { on: false });
  const r = mustAccept(got, 'off with a stray owned tag');
  assert(r.published === false && r.unchanged === 'nothing-claimed' && got.calls.importEvent.length === 0, `nothing-claimed and nothing written, got ${show(r)}`);
});

test('C5 (A1 item 3): isLocalOnly is read before the choice is remembered — when it throws, the press answers 500 in the approved words and no choice is written', async () => {
  const got = await pressWith(world(), { on: true }, { isLocalOnly: () => { throw new Error('fixture: the publish policy cannot be read'); } });
  assert(got.res.statusCode === SM.PRESS.status.failed && got.body && got.body.error === SM.PRESS.failed, `want 500 with the approved words, got ${got.res.statusCode} ${show(got.body)}`);
  assert(got.calls.writeChoice.length === 0, `no choice written, got ${show(got.calls.writeChoice)}`);
  assert(got.calls.importEvent.length === 0, 'nothing written here');
});

test('C6 (A1 item 3): a throw after the choice is remembered (the signer) answers 500 in the approved words; the choice was written once and nothing else was', async () => {
  const w = world();
  const got = await pressWith(w, { on: true }, { finalizeEvent: () => { throw new Error('fixture: the signer failed'); } });
  assert(got.res.statusCode === SM.PRESS.status.failed && got.body && got.body.error === SM.PRESS.failed, `want 500 with the approved words, got ${got.res.statusCode} ${show(got.body)}`);
  assert(show(got.calls.writeChoice) === show([[w.A, true, NOW_S]]), `the choice written once, got ${show(got.calls.writeChoice)}`);
  assert(got.calls.importEvent.length === 0 && got.calls.publishToRelays.length === 0, 'nothing written here or sent');
});

/* ───────────────────────── Round 3: ADR 0002 Amendment 2 (review round 2) ───────────────────────── */

const PUB2 = 'wss://pub-two.example';                 // a second profile publish relay (Round 3)

test('R14 (A2 item 1, review round 2 R2-B1): nothing on this instance\'s relay and no relay list here; of the two profile publish relays one answers without the list and the other is silent, while the write relay holds the full version — a list found nowhere with a relay unheard is not "no write relays": 503 not-read for either press, nothing changed', async () => {
  for (const on of [true, false]) {
    const key = newAssistant();
    const full = version(key, instanceMapTags(key.A), { content: PRIVATE_CONTENT });
    const got = await press({ key, base: null, noRelayList: true, mapTags: OWN_HINTS(key.A), publishRelays: [PUB1, PUB2, SM.DOCKER_RELAY_URL], relays: { [PUB1]: [], [A_WRITE]: [full] } }, { on });
    mustRefuseRead(got, `on: ${on}, the list found nowhere while ${PUB2} is silent`);
  }
});

test('R15 (A2 item 1, the finished case): nothing on this instance\'s relay and no relay list here; every profile publish relay answers and none holds the list, the hints and the offer this instance\'s own — finished: Turn on publishes the self-entries alone', async () => {
  const key = newAssistant();
  const got = await press({ key, base: null, noRelayList: true, mapTags: OWN_HINTS(key.A), publishRelays: [PUB1, PUB2, SM.DOCKER_RELAY_URL], relays: { [PUB1]: [], [PUB2]: [] } }, { on: true });
  mustPublish(got, 'every publish relay answered "nowhere"');
  assert(show(got.signed.tags) === show([['39998', key.A, OWN]]), `the self-entry alone, got ${show(got.signed.tags)}`);
});

async function run() {
  console.log(`${NL}=== assistant-self-map-publish (assistant-self-map #2) ===`);
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      const r = await fn();
      if (r === 'SKIP') { console.log(`  SKIP  ${name}`); skipped++; }
      else { console.log(`  PASS  ${name}`); pass++; }
    } catch (err) {
      restoreConsole();
      console.log(`  FAIL  ${name}${NL}        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`${NL}assistant-self-map-publish: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

module.exports = { run };

if (require.main === module) run().then((r) => process.exit(r.fail ? 1 : 0));
