'use strict';
/**
 * assistant-self-map #1: the self-Map check — the duties the viewer's Map gives their Assistant and which are live,
 * what the Assistant's self-Map should say, the self-Map found, whether they match — and the hub's real mark for the
 * Your Assistant's Treasure Map card.
 *
 * Story: engineering-team/stories/assistant-self-map/1-the-self-map-page-and-its-check.md
 * ADR:   engineering-team/decisions/assistant-self-map/0001-a-self-map-check-from-what-has-landed.md
 * Plan:  engineering-team/stories/assistant-self-map/1-the-self-map-page-and-its-check.test-plan.md
 * Spec:  protocols/drafts/treasure-maps.md §§ 5.1–5.2, 6, 8, 9, 9.2; duty-menus.md § 6.2 step 1 (read-only).
 * Page half: test/assistant-self-map-page.test.js. Browser half: tests/brainstorm/assistant-self-map.spec.js.
 * Words, constants and canned answers: test/helpers/selfMapFixtures.js.
 *
 * Classes (all stack-free):
 *   L — the pure library src/lib/self-map (CommonJS, no I/O): its exports, the published metrics, § 6 precedence,
 *       reading a found self-Map, comparing two sets of self-entries.                         [AC-3, AC-4, AC-5]
 *   U — src/api/assistant/attention.js + selfMap.js driven through the dependencies ADR 0001's Implementation notes
 *       name (scanLocal, readRelay, getConfigFromFile, readConfiguredRelays, getConfiguredPublishRelays,
 *       mapDefaultRelays, isPublicRelayHostWithin, getCustomer, isLocalOnly, now, readScheduleEntries,
 *       schedulerEnabled, timerExists). The real outsideOnly, lookupNewest, resolveOfferInputs, buildOffer,
 *       instanceRelayUrl and assistantWriteRelays run over those fakes. Config is the deployments' real values:
 *       Docker's ws://localhost:7777 with STRFRY_DOMAIN (ledger 2026-10-12-test-configs-not-from-deployments).
 *                                                                                              [AC-1 … AC-5, AC-7]
 *   C — the pure ESM module ui/src/pages/assistant/actions.js: the entry, CHECKED_ACTIONS, the two readings, the
 *       count line at zero.                                                                     [AC-5]
 *   S — source sentinels: read-only, session-only, the wiring, the scheduler switch, the dependency, the docs, no new
 *       route.                                                                                  [AC-1, AC-7]
 *
 * Everything FAILS against the current code: src/lib/self-map and src/api/assistant/selfMap.js do not exist, the
 * attention answer has no treasure-map key, the card is an always-marked placeholder, and the count line has no zero
 * state.
 *
 * assistant-duties-settings #1 (ADR assistant-duties-settings/0001 sub-decisions 3 and 6): the offer is the Assistant
 * Duties list (injected as readAssistantDuties; DM.DEFAULT_DUTIES unless a world names `duties`), the same for every
 * Assistant, so U21's inactive customer is offered Scores now. AD1–AD3 pin the self-Map's side: a 30382 row at a typed
 * relay is never live from this instance's strfry, an added duty that is not built is offered and never active, and an
 * Admin's Assistant is offered Scores without their being claimed.
 *
 * assistant-self-map #2 (ADR assistant-self-map/0002 sub-decisions 2 and 3): the answer carries selfMapOn from the
 * choice store (injected as readSelfMapChoice; false unless a world names `choice`), checkSelfMap is gatherSelfMap plus
 * the choice, lookupSelfMap reads every place when forWrite is set, and the relay hints come only from entries whose key
 * parses (story 1 review R3-N2). V1–V6 pin them; U3's field list and S6's route table are re-aimed.
 *
 * Fixed here where the ADR leaves a detail open (test plan § Points the ADR leaves open; for the Architect to confirm):
 * lastLandedAt is the newest event's created_at in seconds; readSelfEntries returns { selfEntries, otherEntries };
 * sorting keys with compareKeys puts the more specific first; a duties item has a line only for the offered kinds its
 * key still wins something in; offered and active lines carry the offer's relay, not-offered and elsewhere lines null.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const SM = require('./helpers/selfMapFixtures');
const DM = require('./helpers/dutyMenuFixtures');

const REPO = path.resolve(__dirname, '..');
const LIB = path.join(REPO, 'src/lib/self-map/index.js');
const ATTENTION_MODULE = path.join(REPO, 'src/api/assistant/attention.js');
const SELF_MAP_MODULE = path.join(REPO, 'src/api/assistant/selfMap.js');
const DUTY_MODULE = path.join(REPO, 'src/api/assistant/dutyMenu.js');
const ACTIONS_MOD = path.join(REPO, 'ui/src/pages/assistant/actions.js');
const SWITCH_MODULE = path.join(REPO, 'src/manage/taskQueue/queue/schedulerSwitch.js');
const SCHEDULER_MODULE = path.join(REPO, 'src/manage/taskQueue/queue/scheduler.js');
const NL = String.fromCharCode(10);

// Fixture keys, never live ones (CLAUDE.md: the TA pubkey is per deployment).
const TA = SM.TA;
const OWNER = SM.OWNER;
const OTHER = SM.OTHER_ASSISTANT;
const CUSTOMER = 'c0'.repeat(32);
const CUSTOMER_ASSISTANT = 'c1'.repeat(32);
const ANOTHER_CUSTOMER = 'c2'.repeat(32);
const STRANGER = 'e4'.repeat(32);

const OWN = SM.OWN;
// Outside relays, by where the check learns of them.
const PUB1 = 'wss://pub-one.example';             // the profile publish set (configured): where the 10002s are read
const MAPR = 'wss://maps.example';                // the server's Map relays (configured): where the Map is read
const HINT_A = 'wss://hint-a.example';            // the viewer's Map names it for the Assistant
const HINT_B = 'wss://hint-b.example';            // ditto
const OTHER_HINT = 'wss://other-hint.example';    // the viewer's Map names it for another Assistant
const A_WRITE = 'wss://a-write.example';          // the Assistant's 10002, write
const A_READ = 'wss://a-read.example';            // the Assistant's 10002, read only
const REFUSED_HINT = 'wss://refused-hint.example';
const REFUSED_HOSTS = ['refused-hint.example'];
const DLIST = 'wss://dlist.example';

const T0 = 1_760_000_000_000;
const NOW_S = Math.floor(T0 / 1000);
const H = 3600;

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
const show = (v) => JSON.stringify(v);
const rel = (p) => path.relative(REPO, p);
const lc = (s) => String(s || '').toLowerCase();
const normUrl = (u) => String(u || '').trim().toLowerCase().replace(/\/+$/, '');

/** Source with comments removed (block comments become blank lines, so line numbers stay true). */
function codeOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
    .split(NL)
    .map((l) => l.replace(/(^|[^:'"`\\])\/\/.*$/, '$1'))
    .join(NL);
}

/** A set of { key, relay } as sorted strings: the oracle's own order-blind comparison (AC-5). */
const entrySet = (xs) => (Array.isArray(xs) ? xs : []).map((x) => `${x && x.key}|${x && x.relay}`).sort();
const sameEntries = (a, b) => show(entrySet(a)) === show(entrySet(b));

/* ───────────────────────── fixtures: events ───────────────────────── */

let idSeq = 0;
const hexId = (n) => n.toString(16).padStart(64, '0');
function ev(kind, pubkey, createdAt, tags, id) {
  idSeq += 1;
  return { id: id || hexId(8192 + idSeq), pubkey, kind, created_at: createdAt, tags, content: '', sig: '0'.repeat(128) };
}
const mapEv = (tags, author, createdAt = NOW_S - 50 * H) => ev(SM.TREASURE_MAP_KIND, author, createdAt, tags);
const selfMapEv = (tags, author = TA, createdAt = NOW_S - 2 * H, id) => ev(SM.SELF_MAP_KIND, author, createdAt, tags, id);
const relayListEv = (author, rTags) => ev(SM.RELAY_LIST_KIND, author, NOW_S - 100 * H, rTags);
/** A full set of Scores, signed by `author`, landed `hoursAgo` (both publishers re-sign every event every run). */
const scoresAt = (author, hoursAgo) => [1, 2, 3].map((n) => ev(SM.SCORE_KIND, author, NOW_S - hoursAgo * H, [['d', `${n}`.repeat(64).slice(0, 64)], ['rank', '7']]));
const header = (author, d, createdAt = NOW_S - 200 * H) => ev(39998, author, createdAt, [['d', d], ['names', d, d]]);
const listEv = (author, kind, d) => ev(kind, author, NOW_S - H, [['d', d], ['p', STRANGER]]);
const dTagOf = (e) => ((e.tags || []).find((t) => t[0] === 'd') || [])[1];

/** strfry's and a relay's answer: the filter applied, newest first (lowest id on a tie), `limit` honoured. */
function matching(events, filter) {
  const kinds = Array.isArray(filter && filter.kinds) ? filter.kinds : null;
  const authors = Array.isArray(filter && filter.authors) ? filter.authors.map(lc) : null;
  const ds = Array.isArray(filter && filter['#d']) ? filter['#d'] : null;
  const out = events
    .filter((e) => (!kinds || kinds.includes(e.kind)) && (!authors || authors.includes(lc(e.pubkey))) && (!ds || ds.includes(dTagOf(e))))
    .sort((a, b) => (b.created_at - a.created_at) || (a.id < b.id ? -1 : 1));
  return Number.isInteger(filter && filter.limit) ? out.slice(0, filter.limit) : out;
}
const isSelfMapFilter = (f, who = TA) => Array.isArray(f && f.kinds) && f.kinds.includes(SM.SELF_MAP_KIND) && Array.isArray(f.authors) && f.authors.map(lc).includes(who);
const isViewerMapFilter = (f, viewer) => Array.isArray(f && f.kinds) && f.kinds.includes(SM.TREASURE_MAP_KIND) && Array.isArray(f.authors) && f.authors.map(lc).includes(viewer);

/* ───────────────────────── the world ───────────────────────── */

const SCORES_EVERY_12H = [SM.scheduleEntry('processAllTasks', { hours: 12 })];

/**
 * One world, for the Owner by default: the staging Owner's Map, the TA's relay list, and what the TA has published.
 *   viewer, assistant — the session's viewer and getAssistantPubkeyFor's answer (null = no assistant here).
 *   mapTags           — the viewer's Map tags (null = no Map anywhere).
 *   scoresHoursAgo    — when the Assistant's last full set of Scores landed here (null = never).
 *   headers           — the d tags of the Concept headers the Assistant has signed here.
 *   extraLocal        — more events on this instance's relay (a self-Map, Lists, …).
 *   schedule          — readScheduleEntries' answer. scheduler — schedulerEnabled's. timer — timerExists'.
 *   customerTimers    — { <customer main pubkey>: ms }: the per-customer timers running now (ADR 0001 A2 item 3).
 *   dropConfig        — config keys absent from brainstorm.conf (e.g. an older one with no TASK_QUEUE_ENABLED line).
 *   config, settings, customer, relays, refused, rejectScan, clock — as in the Duty Menu suite.
 *   duties            — readAssistantDuties' answer, the Assistant Duties list (default DM.DEFAULT_DUTIES;
 *                       assistant-duties-settings #1).
 */
function world(opts = {}) {
  const viewer = opts.viewer || OWNER;
  const assistant = opts.assistant === undefined ? TA : opts.assistant;
  const local = [];
  if (opts.mapTags !== null) local.push(mapEv(opts.mapTags || SM.stagingOwnerMapTags(TA, OTHER), viewer));
  if (assistant) local.push(relayListEv(assistant, [['r', A_WRITE, 'write'], ['r', A_READ, 'read']]));
  if (assistant && opts.scoresHoursAgo !== undefined && opts.scoresHoursAgo !== null) local.push(...scoresAt(assistant, opts.scoresHoursAgo));
  for (const d of (opts.headers || [])) local.push(header(assistant, d));
  local.push(...(opts.extraLocal || []));
  return {
    viewer, assistant, local,
    schedule: opts.schedule === undefined ? SCORES_EVERY_12H : opts.schedule,
    scheduler: opts.scheduler === undefined ? true : opts.scheduler,
    timer: Boolean(opts.timer),
    config: Object.fromEntries(Object.entries({ ...SM.DOCKER_CONFIG, ...(opts.config || {}) }).filter(([k]) => !(opts.dropConfig || []).includes(k))),
    customerTimers: Object.fromEntries(Object.entries(opts.customerTimers || {}).map(([k, v]) => [lc(k), v])),
    settings: opts.settings || { aDListRelays: [DLIST] },
    customer: opts.customer === undefined ? null : opts.customer,
    relays: opts.relays || Object.fromEntries([PUB1, MAPR, HINT_A, HINT_B, OTHER_HINT, A_WRITE, A_READ, DLIST].map((u) => [u, []])),
    refused: new Set(opts.refused || REFUSED_HOSTS),
    rejectScan: opts.rejectScan,
    clock: opts.clock || { t: T0 },
    checkSelfMap: opts.checkSelfMap,
    realDutyMenu: Boolean(opts.realDutyMenu),
    duties: opts.duties === undefined ? DM.DEFAULT_DUTIES : opts.duties,
    // assistant-self-map #2: readSelfMapChoice's answer (true, false or null), or 'throw'.
    choice: opts.choice === undefined ? false : opts.choice,
  };
}

function hostOf(x) {
  const s = String(x || '');
  try { return new URL(s.includes('://') ? s : `wss://${s}`).hostname.toLowerCase(); } catch { return lc(s); }
}

/** The injected dependencies, under the names ADR 0001 gives them. Every one RECORDS its calls. */
function fakes(w) {
  const calls = { scanLocal: [], readRelay: [], guard: [], getCustomer: [], checkSelfMap: [], readScheduleEntries: 0, timerExists: [], customerTimer: [], readSelfMapChoice: [] };
  const relays = Object.fromEntries(Object.entries(w.relays).map(([u, v]) => [normUrl(u), v]));
  const deps = {
    getAssistantPubkeyFor: async () => w.assistant,
    scanLocal: async (filter) => {
      calls.scanLocal.push(filter);
      if (w.local === 'reject' || (typeof w.rejectScan === 'function' && w.rejectScan(filter))) throw new Error('fixture: strfry scan failed');
      return matching(w.local, filter);
    },
    readRelay: async (url, filter) => {
      calls.readRelay.push({ url: normUrl(url), filter });
      const held = relays[normUrl(url)];
      if (held === 'hang') return new Promise(() => {});
      if (!Array.isArray(held)) return { status: 'unreachable', events: [], error: 'fixture: unreachable' };
      return { status: 'ok', events: matching(held, filter), error: null };
    },
    getConfigFromFile: (key, dflt) => (Object.prototype.hasOwnProperty.call(w.config, key) ? w.config[key] : dflt),
    readConfiguredRelays: (categories) => (Array.isArray(categories) ? categories : []).flatMap((c) => w.settings[c] || []),
    getConfiguredPublishRelays: () => [PUB1, SM.DOCKER_RELAY_URL],
    mapDefaultRelays: () => [MAPR, SM.DOCKER_RELAY_URL],
    isPublicRelayHostWithin: async (hostOrUrl) => { const host = hostOf(hostOrUrl); calls.guard.push(host); return !w.refused.has(host); },
    getCustomer: async (pubkey) => { calls.getCustomer.push(pubkey); return w.customer; },
    isLocalOnly: () => false,
    now: () => w.clock.t,
    readAssistantDuties: () => JSON.parse(JSON.stringify(w.duties)),
    readScheduleEntries: () => { calls.readScheduleEntries += 1; return JSON.parse(JSON.stringify(w.schedule)); },
    schedulerEnabled: () => w.scheduler,
    timerExists: (p) => { calls.timerExists.push(p); return w.timer; },
    // ADR 0001 Amendment 2 item 3: the per-customer scheduler's running timer, by the customer's main pubkey.
    customerTimerIntervalMs: (pubkey) => {
      calls.customerTimer.push(lc(pubkey));
      return Object.prototype.hasOwnProperty.call(w.customerTimers, lc(pubkey)) ? w.customerTimers[lc(pubkey)] : null;
    },
    // assistant-self-map #2 (ADR 0002 sub-decision 2): the remembered choice, by Assistant pubkey.
    readSelfMapChoice: (pubkey) => {
      calls.readSelfMapChoice.push(lc(pubkey));
      if (w.choice === 'throw') throw new Error('fixture: the choice file is unreadable');
      return w.choice;
    },
    // The other checks, stubbed: this suite is about the self-Map (their own suites drive the real ones).
    checkOutboxRelays: async () => ({ finished: true, done: true, pending: false, reason: null, source: 'local', createdAt: 1, outbox: ['wss://fixture.example'], inboxOnlyCount: 0, suggestions: [] }),
    checkProfile: async () => ({ finished: true, done: true, pending: false, items: [] }),
    checkTrustedContent: async () => ({}),
  };
  if (!w.realDutyMenu) deps.checkDutyMenu = async () => ({ finished: true, done: true, pending: false, reason: null, offer: [], published: null, current: true });
  if (w.checkSelfMap) {
    deps.checkSelfMap = async (input, d) => { calls.checkSelfMap.push(input); return w.checkSelfMap(input, d); };
  }
  return { deps, calls };
}
function fakeRes() {
  const res = { statusCode: 200, body: undefined };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}
const signedInReq = (pubkey, extra = {}) => ({ session: { authenticated: true, pubkey }, query: {}, ...extra });

/* ───────────────────────── the modules under test ───────────────────────── */

function load(abs, what) {
  if (!fs.existsSync(abs)) throw new Error(`${rel(abs)} does not exist. ${what}`);
  delete require.cache[require.resolve(abs)];
  return require(abs);
}
const libModule = () => load(LIB, 'ADR 0001 sub-decision 1 creates it: the pure self-Map library.');
function need(mod, name, file) {
  assert(typeof mod[name] === 'function', `${file} must export ${name}() (ADR 0001 sub-decision 1 / § Implementation notes).`);
  return mod[name];
}
function freshModules() {
  if (!fs.existsSync(SELF_MAP_MODULE)) {
    throw new Error(`${rel(SELF_MAP_MODULE)} does not exist. ADR 0001 § Implementation notes 2 creates it: checkSelfMap, lookupSelfMap, readUpkeep, scheduleIntervals, SELF_MAP_CHECK_FAILED.`);
  }
  for (const p of [ATTENTION_MODULE, SELF_MAP_MODULE, DUTY_MODULE]) delete require.cache[require.resolve(p)];
  const attention = require(ATTENTION_MODULE);
  const selfMap = require(SELF_MAP_MODULE);
  need(selfMap, 'checkSelfMap', rel(SELF_MAP_MODULE));
  return { handle: need(attention, 'handleAssistantAttention', rel(ATTENTION_MODULE)), selfMap };
}

/** One GET /api/assistant/attention in world `opts`. */
async function answer(opts = {}, reqOver = null) {
  const w = world(opts);
  const { handle, selfMap } = freshModules();
  const { deps, calls } = fakes(w);
  const res = fakeRes();
  const req = reqOver || signedInReq(w.viewer);
  const log = console.error;
  if (opts.quiet) console.error = () => {};
  try { await handle(req, res, deps); } finally { console.error = log; }
  const action = res.body && res.body.actions ? res.body.actions[SM.KEY] : undefined;
  return { w, res, body: res.body, action, calls, selfMap };
}
const itemOf = (action, key) => ((action && action.duties) || []).find((i) => i && i.key === key);
const lineOf = (action, itemKey, lineKey) => { const it = itemOf(action, itemKey); return it ? (it.lines || []).find((l) => l && l.key === lineKey) : undefined; };
const linesOf = (action, itemKey, status) => ((itemOf(action, itemKey) || {}).lines || []).filter((l) => l && l.status === status);
function mustAnswer(got) {
  assert(got.res.statusCode === 200, `the handler answered ${got.res.statusCode}: ${show(got.body)}`);
  assert(got.action && typeof got.action === 'object', `actions['${SM.KEY}'] is missing from the attention answer: ${show(got.body && got.body.actions && Object.keys(got.body.actions))}`);
  return got.action;
}
const metricEntries = (relay = OWN) => SM.PUBLISHED_SCORE_METRICS.map((m) => ({ key: `30382:${m}`, relay }));

async function esm(absPath, what) {
  assert(fs.existsSync(absPath), `${rel(absPath)} does not exist. ${what}`);
  try { return await import(pathToFileURL(absPath).href); } catch (err) { throw new Error(`${rel(absPath)} must load in Node as ESM: ${err.message}`); }
}
const actionsModule = () => esm(ACTIONS_MOD, 'It holds ASSISTANT_ACTIONS, CHECKED_ACTIONS, assistantAttention and attentionCountText.');

/* ───────────────────────── L — the library ───────────────────────── */

test('L1: the library exists, is CommonJS with no I/O and no process.env, and exports what ADR 0001 § Implementation notes 1 names; SELF_MAP_KIND is 10040', () => {
  const lib = libModule();
  const src = codeOnly(safeRead(LIB));
  const wrong = [];
  for (const fn of ['parseKey', 'compareKeys', 'matches', 'conceptReading', 'buildProbes', 'dutiesOf', 'evaluateLive', 'buildShouldSay', 'readSelfEntries', 'sameSelfEntries', 'evaluateSelfMap']) {
    if (typeof lib[fn] !== 'function') wrong.push(`exports ${fn}()`);
  }
  if (lib.SELF_MAP_KIND !== 10040) wrong.push(`SELF_MAP_KIND is 10040 (got ${show(lib.SELF_MAP_KIND)})`);
  if (!Array.isArray(lib.PUBLISHED_SCORE_METRICS)) wrong.push('exports PUBLISHED_SCORE_METRICS');
  for (const mod of ['fs', 'child_process', 'net', 'http', 'https', 'ws']) {
    if (new RegExp(`require\\(\\s*['"]${mod}['"]\\s*\\)`).test(src)) wrong.push(`requires no I/O module (${mod})`);
  }
  if (/process\.env/.test(src)) wrong.push('reads no process.env');
  if (/^\s*(import|export)\s/m.test(src)) wrong.push('is CommonJS, not ESM');
  assert(wrong.length === 0, wrong.join('; '));
});

test('L2: PUBLISHED_SCORE_METRICS are exactly the eleven metric tags both Score publishers write (ADR 0001 sub-decision 1; owner\'s answer to open question 1)', () => {
  const lib = libModule();
  const got = (lib.PUBLISHED_SCORE_METRICS || []).slice().sort();
  const want = SM.PUBLISHED_SCORE_METRICS.slice().sort();
  const wrong = [];
  if (show(got) !== show(want)) wrong.push(`library: want ${show(want)}, got ${show(got)}`);
  for (const p of ['src/algos/nip85/publish_kind30382.js', 'src/algos/customers/nip85/publish_kind30382.js']) {
    const src = safeRead(path.join(REPO, p));
    const tags = [...src.matchAll(/\[\s*['"]([A-Za-z_]+)['"]\s*,/g)].map((m) => m[1]).filter((t) => t !== 'd');
    const written = [...new Set(tags)].sort();
    if (show(written) !== show(want)) wrong.push(`${p} writes ${show(written)}; the fixture's oracle is ${show(want)}`);
  }
  assert(!got.includes(SM.UNPUBLISHED_METRIC), `${SM.UNPUBLISHED_METRIC} is not a published metric`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('L3: compareKeys follows Treasure Maps § 6 — sorting with it puts the more specific key first: exact kind before family before *, then a value before an empty or omitted segment', () => {
  const lib = libModule();
  const cmp = need(lib, 'compareKeys', rel(LIB));
  const pairs = [
    ['30382', '3038x'], ['3038x', '*'], ['30382', '*'],
    ['30382:rank', '30382'], ['3038x:rank', '3038x'],
    ['30382:rank', '3038x:rank'],
    ['39998:dog-tricks', '39998'], ['39999:dog-tricks', '39999'],
  ];
  const wrong = [];
  for (const [specific, broad] of pairs) {
    const a = [broad, specific].sort(cmp);
    const b = [specific, broad].sort(cmp);
    if (a[0] !== specific || b[0] !== specific) wrong.push(`${specific} before ${broad}: got ${show(a)} / ${show(b)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('L4: readSelfEntries keeps only the entries naming the author, normalizes their keys and relays, drops 39998: and 39999:, and counts the other entries (ADR 0001 sub-decision 1; § 9 self-entries)', () => {
  const lib = libModule();
  const read = need(lib, 'readSelfEntries', rel(LIB));
  const event = selfMapEv([
    ['39998:dlist-header', TA.toUpperCase(), 'WSS://Staging.Brainstorm.World/relay/'],
    ['30382:rank:', TA, OWN],
    ['39999:', TA, OWN],
    ['30392', OTHER, 'wss://scores.brainstorm.world'],
    ['3038x', STRANGER, ''],
    ['client', 'Brainstorm'],
    ['30382', 'not-a-key', OWN],
  ]);
  const got = read(event, TA);
  const wrong = [];
  if (!got || !Array.isArray(got.selfEntries)) wrong.push(`returns { selfEntries, otherEntries }, got ${show(got)}`);
  else {
    const want = [{ key: '39998', relay: OWN }, { key: '30382:rank', relay: OWN }];
    if (!sameEntries(got.selfEntries, want)) wrong.push(`selfEntries: want ${show(want)}, got ${show(got.selfEntries)}`);
    if (got.otherEntries !== 2) wrong.push(`otherEntries counts the two entries naming other valid keys (got ${show(got.otherEntries)})`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('L5: sameSelfEntries compares sets of key and relay: order never counts; a different relay, a missing or an extra entry does; two empty sets are the same', () => {
  const lib = libModule();
  const same = need(lib, 'sameSelfEntries', rel(LIB));
  const a = [{ key: '30382', relay: OWN }, { key: '39998', relay: OWN }];
  const wrong = [];
  if (same(a, a.slice().reverse()) !== true) wrong.push('another order is the same');
  if (same(a, [{ key: '30382', relay: OWN }, { key: '39998', relay: DLIST }]) !== false) wrong.push('a different relay differs');
  if (same(a, a.slice(0, 1)) !== false) wrong.push('a missing entry differs');
  if (same(a, [...a, { key: '39999', relay: OWN }]) !== false) wrong.push('an extra entry differs');
  if (same([], []) !== true) wrong.push('two empty sets are the same');
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── U — the answer: AC-1 ───────────────────────── */

test('U1 (AC-1): a visitor gets { signedIn: false } and nothing is looked up', async () => {
  const calls = [];
  const got = await answer({ checkSelfMap: async () => { calls.push(1); return {}; } }, { session: null, query: {} });
  assert(got.res.statusCode === 200 && got.body && got.body.signedIn === false, `want { signedIn: false }, got ${show(got.body)}`);
  assert(calls.length === 0 && got.calls.scanLocal.length === 0, 'nothing is checked for a visitor');
});

test('U2 (AC-1): a signed-in viewer with no Assistant here gets actions {} and nothing is looked up', async () => {
  const got = await answer({ assistant: null });
  assert(got.body && got.body.hasAssistant === false && show(got.body.actions) === '{}', `want hasAssistant false and no actions, got ${show(got.body)}`);
  assert(got.calls.scanLocal.length === 0, `no scan for a viewer without an Assistant (got ${got.calls.scanLocal.length})`);
});

test('U3 (AC-1): the action has exactly the ADR\'s fields, every duties line has exactly its fields, and statuses and reasons come from the ADR\'s lists', async () => {
  const action = mustAnswer(await answer({ scoresHoursAgo: 1, headers: ['dog-tricks'] }));
  const wrong = [];
  const fields = Object.keys(action).sort();
  if (show(fields) !== show(SM.ANSWER_FIELDS)) wrong.push(`fields: want ${show(SM.ANSWER_FIELDS)}, got ${show(fields)}`);
  for (const item of action.duties || []) {
    if (typeof item.key !== 'string' || !Array.isArray(item.lines)) { wrong.push(`a duties item is { key, lines }: ${show(item)}`); continue; }
    for (const l of item.lines) {
      const lf = Object.keys(l).sort();
      if (show(lf) !== show(SM.LINE_FIELDS)) wrong.push(`line fields: want ${show(SM.LINE_FIELDS)}, got ${show(lf)}`);
      if (!SM.STATUSES.includes(l.status)) wrong.push(`status ${show(l.status)} is one of ${show(SM.STATUSES)}`);
      if (l.reason !== null && !SM.REASONS.includes(l.reason)) wrong.push(`reason ${show(l.reason)} is null or one of ${show(SM.REASONS)}`);
      if (!['scores', 'lists', 'concepts'].includes(l.category)) wrong.push(`category ${show(l.category)}`);
      if (typeof l.falseClaim !== 'boolean') wrong.push(`falseClaim is a boolean (${show(l)})`);
    }
  }
  for (const e of action.shouldSay || []) if (show(Object.keys(e).sort()) !== show(['key', 'relay'])) wrong.push(`a shouldSay entry is { key, relay }: ${show(e)}`);
  if (typeof action.instanceMap !== 'boolean' || typeof action.mapFound !== 'boolean') wrong.push('instanceMap and mapFound are booleans');
  assert(wrong.length === 0, wrong.join('; '));
});

test('U4 (AC-1): the check runs once with the session\'s { viewer, assistantPubkey }, whatever the request says; it reads that viewer\'s Map and that Assistant\'s self-Map only', async () => {
  const seen = [];
  const got = await answer({
    scoresHoursAgo: 1,
    checkSelfMap: async (input, d) => { seen.push(input); return require(SELF_MAP_MODULE).checkSelfMap(input, d); },
  }, signedInReq(OWNER, { query: { viewer: STRANGER, assistant: STRANGER }, params: { pubkey: STRANGER }, body: { assistantPubkey: STRANGER } }));
  mustAnswer(got);
  const wrong = [];
  if (seen.length !== 1 || lc(seen[0].viewer) !== OWNER || lc(seen[0].assistantPubkey) !== TA) wrong.push(`checkSelfMap({ viewer, assistantPubkey }) from the session, once; got ${show(seen)}`);
  const authors = got.calls.scanLocal.concat(got.calls.readRelay.map((c) => c.filter)).flatMap((f) => (Array.isArray(f.authors) ? f.authors.map(lc) : []));
  if (authors.includes(STRANGER)) wrong.push('nothing is read for the stranger the request names');
  if (!got.calls.scanLocal.some((f) => isViewerMapFilter(f, OWNER))) wrong.push('the viewer\'s Map is read');
  if (!got.calls.scanLocal.some((f) => isSelfMapFilter(f, TA))) wrong.push('the Assistant\'s 10040 is read');
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── U — the duties and what is live: AC-2, AC-3 ───────────────────────── */

test('U5 (AC-2, AC-3; ADR sub-decision 2\'s worked example): staging\'s Owner Map with Scores live — the self-Map should say 30382 and 39998 at this instance\'s public relay; 3038x narrows; rank and followers are given elsewhere; 39999 is not published here; Lists are not the TA\'s', async () => {
  const action = mustAnswer(await answer({ scoresHoursAgo: 1, headers: ['dog-tricks'] }));
  const wrong = [];
  if (!sameEntries(action.shouldSay, SM.SHOULD_LIVE)) wrong.push(`shouldSay: want ${show(SM.SHOULD_LIVE)}, got ${show(action.shouldSay)}`);
  const keys = (action.duties || []).map((i) => i.key);
  if (show(keys) !== show(['39998', '3038x', '39999'])) wrong.push(`one item per key naming the TA, in Map order: want ["39998","3038x","39999"], got ${show(keys)}`);
  const s = lineOf(action, '3038x', '30382');
  if (!s || s.status !== 'offered' || s.reason !== 'live-unclaimed' || s.relay !== OWN || s.category !== 'scores') wrong.push(`3038x's 30382 line: offered, live-unclaimed, at ${OWN}; got ${show(s)}`);
  if (linesOf(action, '3038x', 'not-offered').length !== 1) wrong.push(`3038x has one not-offered line for its other Score kinds; got ${show(itemOf(action, '3038x'))}`);
  for (const k of ['30382:rank', '30382:followers']) {
    const l = lineOf(action, '3038x', k);
    if (!l || l.status !== 'elsewhere' || l.relay !== null) wrong.push(`${k} is an elsewhere line with no relay; got ${show(l)}`);
  }
  const c = lineOf(action, '39998', '39998');
  if (!c || c.status !== 'offered' || c.reason !== 'live-unclaimed' || c.relay !== OWN || c.category !== 'concepts') wrong.push(`39998 line: offered, live-unclaimed; got ${show(c)}`);
  if ((itemOf(action, '39998') || { lines: [] }).lines.length !== 1) wrong.push(`39998's item has one line: the 39999 kind is won by the Map's own 39999 entry; got ${show(itemOf(action, '39998'))}`);
  const n = lineOf(action, '39999', '39999');
  if (!n || n.status !== 'offered' || n.reason !== 'not-published-here') wrong.push(`39999 line: offered, not-published-here; got ${show(n)}`);
  if (action.mapFound !== true || action.instanceMap !== true) wrong.push(`mapFound and instanceMap true for the Owner; got ${show({ mapFound: action.mapFound, instanceMap: action.instanceMap })}`);
  if (action.finished !== true || action.published !== null || action.current !== false || action.done !== false || action.pending !== true) {
    wrong.push(`nothing published yet: finished, published null, not current, pending; got ${show({ finished: action.finished, published: action.published, current: action.current, done: action.done, pending: action.pending })}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('U6 (AC-2, AC-3): staging today — no Score upkeep scheduled: Scores are not-scheduled and only 39998 should be claimed', async () => {
  const action = mustAnswer(await answer({ scoresHoursAgo: 3000, headers: ['dog-tricks'], schedule: [] }));
  const s = lineOf(action, '3038x', '30382');
  const wrong = [];
  if (!s || s.status !== 'offered' || s.reason !== 'not-scheduled') wrong.push(`30382: offered, not-scheduled; got ${show(s)}`);
  if (!sameEntries(action.shouldSay, [{ key: '39998', relay: OWN }])) wrong.push(`shouldSay: only 39998; got ${show(action.shouldSay)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('U7 (AC-2; open question 1 of the story): one missed run is a brief gap, two is a stop — with a 12-hour schedule, Scores that landed 23 hours ago are live, 25 hours ago are upkeep-stopped with lastLandedAt', async () => {
  const live = mustAnswer(await answer({ scoresHoursAgo: 23 }));
  const stale = mustAnswer(await answer({ scoresHoursAgo: 25 }));
  const wrong = [];
  const l = lineOf(live, '3038x', '30382');
  if (!l || l.reason !== 'live-unclaimed') wrong.push(`23h: live; got ${show(l)}`);
  if (!live.shouldSay.some((e) => e.key === '30382')) wrong.push(`23h: 30382 should be claimed; got ${show(live.shouldSay)}`);
  const s = lineOf(stale, '3038x', '30382');
  if (!s || s.reason !== 'upkeep-stopped' || s.lastLandedAt !== NOW_S - 25 * H) wrong.push(`25h: upkeep-stopped, lastLandedAt = the newest event's created_at (${NOW_S - 25 * H}); got ${show(s)}`);
  if (stale.shouldSay.some((e) => String(e.key).startsWith('3038'))) wrong.push(`25h: no Score self-entry; got ${show(stale.shouldSay)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('U8 (AC-2): scheduled but never landed: Scores are not-landed', async () => {
  const action = mustAnswer(await answer({ scoresHoursAgo: null }));
  const s = lineOf(action, '3038x', '30382');
  assert(s && s.status === 'offered' && s.reason === 'not-landed', `30382: offered, not-landed; got ${show(s)}`);
});

test('U9 (AC-2; ADR sub-decision 6): the shortest enabled interval sets the allowance — a 24-hour and a 6-hour entry give 12 hours: 11 hours ago is live, 13 is stopped', async () => {
  const schedule = [SM.scheduleEntry('processAllTasks', { days: 1 }), SM.scheduleEntry('exportOwnerKind30382', { hours: 6 })];
  const live = mustAnswer(await answer({ scoresHoursAgo: 11, schedule }));
  const stale = mustAnswer(await answer({ scoresHoursAgo: 13, schedule }));
  const wrong = [];
  if ((lineOf(live, '3038x', '30382') || {}).reason !== 'live-unclaimed') wrong.push(`11h: live; got ${show(lineOf(live, '3038x', '30382'))}`);
  if ((lineOf(stale, '3038x', '30382') || {}).reason !== 'upkeep-stopped') wrong.push(`13h: upkeep-stopped; got ${show(lineOf(stale, '3038x', '30382'))}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('U10 (AC-2; ADR sub-decision 6): a disabled entry, TASK_QUEUE_ENABLED=false, or the scheduler kill switch each leave Scores not-scheduled; each Owner Score task counts on its own; other tasks never count', async () => {
  const reason = async (o) => (lineOf(mustAnswer(await answer({ scoresHoursAgo: 1, ...o })), '3038x', '30382') || {}).reason;
  const wrong = [];
  for (const task of SM.OWNER_SCORE_TASKS) {
    const r = await reason({ schedule: [SM.scheduleEntry(task, { hours: 12 })] });
    if (r !== 'live-unclaimed') wrong.push(`${task} every 12h: live (got ${r})`);
  }
  const cases = {
    'a disabled entry': { schedule: [SM.scheduleEntry('processAllTasks', { hours: 12, enabled: false })] },
    'TASK_QUEUE_ENABLED=false': { config: { TASK_QUEUE_ENABLED: 'false' } },
    'the kill switch': { scheduler: false },
    'only List and sync tasks': { schedule: [SM.scheduleEntry('refreshPinnedTagTLs', { hours: 1 }), SM.scheduleEntry('syncNegentropyPresets', { hours: 6 })] },
    'a customer task for the Owner': { schedule: [SM.scheduleEntry('processCustomer', { hours: 12, args: { customer: OWNER } })] },
  };
  for (const [label, o] of Object.entries(cases)) {
    const r = await reason(o);
    if (r !== 'not-scheduled') wrong.push(`${label}: not-scheduled (got ${r})`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('U11 (AC-2; ADR sub-decision 6): with no BullMQ entry, the systemd timer counts when it exists, at BRAINSTORM_PROCESS_ALL_TASKS_INTERVAL (unparseable reads as 12 h); without it, Scores are not-scheduled', async () => {
  const reason = async (hoursAgo, interval, timer = true) => (lineOf(mustAnswer(await answer({ scoresHoursAgo: hoursAgo, schedule: [], timer, config: { BRAINSTORM_PROCESS_ALL_TASKS_INTERVAL: interval } })), '3038x', '30382') || {}).reason;
  const wrong = [];
  const cases = [
    [23, '12hours', 'live-unclaimed'], [25, '12hours', 'upkeep-stopped'],
    [11, '6h', 'live-unclaimed'], [13, '6h', 'upkeep-stopped'],
    [47, '1d', 'live-unclaimed'], [49, '1days', 'upkeep-stopped'],
    [23, 'whenever', 'live-unclaimed'], [25, 'whenever', 'upkeep-stopped'],
  ];
  for (const [h, interval, want] of cases) {
    const r = await reason(h, interval);
    if (r !== want) wrong.push(`timer at ${interval}, landed ${h}h ago: ${want} (got ${r})`);
  }
  if ((await reason(1, '12hours', false)) !== 'not-scheduled') wrong.push('no timer and no entry: not-scheduled');
  const killed = (lineOf(mustAnswer(await answer({ scoresHoursAgo: 1, schedule: [], timer: true, config: { TASK_QUEUE_ENABLED: 'false' } })), '3038x', '30382') || {}).reason;
  if (killed !== 'live-unclaimed') wrong.push(`TASK_QUEUE_ENABLED=false does not stop the systemd timer (got ${killed})`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('U12 (AC-2; ADR sub-decision 6 as amended by A2 item 2, open question 3): a cron entry\'s interval is the shortest gap among its next fires — "0 */6 * * *" is 6 h: 11 hours ago is live, 13 is stopped', async () => {
  const schedule = [SM.scheduleEntry('processAllTasks', { cron: '0 */6 * * *' })];
  const live = (lineOf(mustAnswer(await answer({ scoresHoursAgo: 11, schedule })), '3038x', '30382') || {}).reason;
  const stale = (lineOf(mustAnswer(await answer({ scoresHoursAgo: 13, schedule })), '3038x', '30382') || {}).reason;
  assert(live === 'live-unclaimed' && stale === 'upkeep-stopped', `11h live, 13h stopped; got ${live}, ${stale}`);
});

test('U13 (AC-3; ADR 0001 § Context, the metric trap): a Map naming 30382 and the unpublished 30382:verifiedFollowersCount for the TA gets no 30382 self-entry but one per published metric; the unpublished one is not-published-here', async () => {
  const mapTags = [['30382', TA, OWN], [`30382:${SM.UNPUBLISHED_METRIC}`, TA, OWN]];
  const action = mustAnswer(await answer({ mapTags, scoresHoursAgo: 1 }));
  const wrong = [];
  if (!sameEntries(action.shouldSay, metricEntries())) wrong.push(`shouldSay: one 30382:<metric> per published metric, no bare 30382; got ${show(action.shouldSay)}`);
  const l = lineOf(action, `30382:${SM.UNPUBLISHED_METRIC}`, `30382:${SM.UNPUBLISHED_METRIC}`);
  if (!l || l.status !== 'offered' || l.reason !== 'not-published-here') wrong.push(`the unpublished metric: offered, not-published-here; got ${show(l)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('U14 (AC-3; "Its key"): the template Map — one 30382:<metric> entry per published metric for the TA — is claimed verbatim, entry for entry', async () => {
  const mapTags = SM.PUBLISHED_SCORE_METRICS.map((m) => [`30382:${m}`, TA, 'wss://nip85.brainstorm.world']);
  const action = mustAnswer(await answer({ mapTags, scoresHoursAgo: 1 }));
  assert(sameEntries(action.shouldSay, metricEntries()), `shouldSay: the eleven keys verbatim at ${OWN}; got ${show(action.shouldSay)}`);
});

test('U15 (AC-2; § 9): an Assistant listed as an Alternate has the duty too', async () => {
  const mapTags = [['3038x', OTHER, 'wss://scores.brainstorm.world'], ['3038x', TA, 'wss://nip85.brainstorm.world']];
  const action = mustAnswer(await answer({ mapTags, scoresHoursAgo: 1 }));
  assert(sameEntries(action.shouldSay, [{ key: '30382', relay: OWN }]), `shouldSay: 30382; got ${show(action.shouldSay)}`);
});

test('U16 (AC-3): a bare * for the TA is never claimed verbatim; its meets give 30382 and 39998; its List lines are older-form and its 39999 line not-published-here', async () => {
  const action = mustAnswer(await answer({ mapTags: [['*', TA, OWN]], scoresHoursAgo: 1, headers: ['dog-tricks'] }));
  const wrong = [];
  if (!sameEntries(action.shouldSay, SM.SHOULD_LIVE)) wrong.push(`shouldSay: 30382 and 39998; got ${show(action.shouldSay)}`);
  for (const k of ['30392', '30393', '30394']) if ((lineOf(action, '*', k) || {}).reason !== 'older-form') wrong.push(`${k}: older-form; got ${show(lineOf(action, '*', k))}`);
  if ((lineOf(action, '*', '39999') || {}).reason !== 'not-published-here') wrong.push(`39999: not-published-here; got ${show(lineOf(action, '*', '39999'))}`);
  if (linesOf(action, '*', 'not-offered').length !== 1) wrong.push('one not-offered line for the kinds the offer lacks');
  assert(wrong.length === 0, wrong.join('; '));
});

test('U17 (AC-2; ADR open question 2): Lists are never claimed here — the TA\'s are older-form even when published and refreshed; a customer\'s are not-published-here', async () => {
  const lists = [listEv(TA, 30392, 'tl-pin-fixture-a'), listEv(TA, 30393, 'tl-pin-notes-fixture-a'), listEv(TA, 30394, 'tag-applicability-nostr-pubkey')];
  const owner = mustAnswer(await answer({ mapTags: [['3039x', TA, OWN]], extraLocal: lists, schedule: [SM.scheduleEntry('refreshPinnedTagTLs', { days: 1 })] }));
  const wrong = [];
  for (const k of ['30392', '30393', '30394']) if ((lineOf(owner, '3039x', k) || {}).reason !== 'older-form') wrong.push(`Owner ${k}: older-form; got ${show(lineOf(owner, '3039x', k))}`);
  if (owner.shouldSay.length !== 0) wrong.push(`Owner: no List self-entry; got ${show(owner.shouldSay)}`);
  if (owner.done !== true) wrong.push('Owner: nothing to claim and nothing claimed is done');
  const customer = mustAnswer(await answer({
    viewer: CUSTOMER, assistant: CUSTOMER_ASSISTANT, customer: { status: 'active' },
    mapTags: [['30392', CUSTOMER_ASSISTANT, OWN]],
  }));
  if ((lineOf(customer, '30392', '30392') || {}).reason !== 'not-published-here') wrong.push(`customer 30392: not-published-here; got ${show(lineOf(customer, '30392', '30392'))}`);
  if (customer.instanceMap !== false) wrong.push('a customer\'s Assistant is not the instance Map');
  assert(wrong.length === 0, wrong.join('; '));
});

test('U18 (AC-2, AC-3): Concepts — 39998 with no header is nothing-to-publish; 39998:<d> is claimed verbatim when that header is here, and not-landed when it is not', async () => {
  const none = mustAnswer(await answer({ mapTags: [['39998', TA, OWN]] }));
  const exact = mustAnswer(await answer({ mapTags: [['39998:dog-tricks', TA, OWN]], headers: ['dog-tricks'] }));
  const missing = mustAnswer(await answer({ mapTags: [['39998:dog-tricks', TA, OWN]], headers: ['cat-tricks'] }));
  const wrong = [];
  if ((lineOf(none, '39998', '39998') || {}).reason !== 'nothing-to-publish' || none.shouldSay.length !== 0) wrong.push(`no header: nothing-to-publish, nothing claimed; got ${show(none.duties)} / ${show(none.shouldSay)}`);
  if (!sameEntries(exact.shouldSay, [{ key: '39998:dog-tricks', relay: OWN }])) wrong.push(`the header is here: 39998:dog-tricks claimed; got ${show(exact.shouldSay)}`);
  if ((lineOf(missing, '39998:dog-tricks', '39998:dog-tricks') || {}).reason !== 'not-landed' || missing.shouldSay.length !== 0) wrong.push(`no such header: not-landed; got ${show(missing.duties)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('U19 (ADR sub-decision 4 — THE CONCEPT READING, pinned once; story 4 of duty-menus-and-self-maps may change it): a bare 39998 covers 39999:<d>, a 39999 key beats a bare 39998, and a bare 39999 self-entry is never chosen here', async () => {
  const lib = libModule();
  const cmp = need(lib, 'compareKeys', rel(LIB));
  const wrong = [];
  if (['39998', '39999'].sort(cmp)[0] !== '39999' || ['39999', '39998'].sort(cmp)[0] !== '39999') wrong.push('39999 sorts before a bare 39998');
  if (['39998', '39999:foo'].sort(cmp)[0] !== '39999:foo') wrong.push('39999:foo sorts before a bare 39998');
  // An exact 39999:<d> duty is never live here, and a bare 39998 would win it: so 39998 can't be claimed.
  const blocked = mustAnswer(await answer({ mapTags: [['39998', TA, OWN], ['39999:foo', TA, OWN]], headers: ['dog-tricks'] }));
  if (blocked.shouldSay.length !== 0) wrong.push(`a bare 39998 that would win 39999:foo is not claimed; got ${show(blocked.shouldSay)}`);
  if ((lineOf(blocked, '39999:foo', '39999:foo') || {}).reason !== 'not-published-here') wrong.push(`39999:foo: not-published-here; got ${show(lineOf(blocked, '39999:foo', '39999:foo'))}`);
  // A bare 39999 beside a bare 39998: only 39998 is claimed.
  const both = mustAnswer(await answer({ mapTags: [['39998', TA, OWN], ['39999', TA, OWN]], headers: ['dog-tricks'] }));
  if (!sameEntries(both.shouldSay, [{ key: '39998', relay: OWN }])) wrong.push(`39998 and 39999: only 39998 claimed; got ${show(both.shouldSay)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('U20 (AC-2, AC-3; ADR K1): a key shape the check does not reason over is unchecked, never claimed, and keeps a broader key from claiming it', async () => {
  const mapTags = [['30382', TA, OWN], ['30382:tag::naddr1qqfixture', TA, OWN]];
  const action = mustAnswer(await answer({ mapTags, scoresHoursAgo: 1 }));
  const wrong = [];
  if ((lineOf(action, '30382:tag::naddr1qqfixture', '30382:tag::naddr1qqfixture') || {}).reason !== 'unchecked') wrong.push(`the tag key: unchecked; got ${show(action.duties)}`);
  if (!sameEntries(action.shouldSay, metricEntries())) wrong.push(`no bare 30382; one entry per published metric; got ${show(action.shouldSay)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('U21 (AC-2; ADR sub-decision 6): a customer\'s Scores — live with a processCustomer entry for that customer, processAllActiveCustomers or processAllTasks; not-scheduled with another customer\'s entry or the Owner\'s export; re-aimed by assistant-duties-settings #1: offered whatever the customer\'s status (one list for every Assistant)', async () => {
  const base = { viewer: CUSTOMER, assistant: CUSTOMER_ASSISTANT, customer: { status: 'active' }, mapTags: [['30382:rank', CUSTOMER_ASSISTANT, OWN]], scoresHoursAgo: 1 };
  const reason = async (o) => (lineOf(mustAnswer(await answer({ ...base, ...o })), '30382:rank', '30382:rank') || {});
  const wrong = [];
  const live = [
    [SM.scheduleEntry('processCustomer', { hours: 12, args: { customer: CUSTOMER } })],
    [SM.scheduleEntry('updateAllScoresForSingleCustomer', { hours: 12, args: { customer: CUSTOMER } })],
    [SM.scheduleEntry('exportCustomerKind30382', { hours: 12, args: { customer: CUSTOMER } })],
    [SM.scheduleEntry('processAllActiveCustomers', { hours: 12 })],
    [SM.scheduleEntry('processAllTasks', { hours: 12 })],
  ];
  for (const schedule of live) {
    const l = await reason({ schedule });
    if (l.reason !== 'live-unclaimed') wrong.push(`${schedule[0].taskId}: live (got ${show(l)})`);
  }
  const claimed = mustAnswer(await answer({ ...base, schedule: live[0] }));
  if (!sameEntries(claimed.shouldSay, [{ key: '30382:rank', relay: OWN }])) wrong.push(`the customer's shouldSay: 30382:rank; got ${show(claimed.shouldSay)}`);
  for (const schedule of [[SM.scheduleEntry('processCustomer', { hours: 12, args: { customer: ANOTHER_CUSTOMER } })], [SM.scheduleEntry('exportOwnerKind30382', { hours: 12 })]]) {
    const l = await reason({ schedule });
    if (l.reason !== 'not-scheduled') wrong.push(`${schedule[0].taskId} ${show(schedule[0].args)}: not-scheduled (got ${show(l)})`);
  }
  const inactive = await reason({ customer: { status: 'inactive' }, schedule: live[0] });
  if (!inactive.status || inactive.status === 'not-offered') wrong.push(`assistant-duties-settings #1: an inactive customer's Scores are offered like everyone's (got ${show(inactive)})`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('U22 (AC-2, AC-3; ADR sub-decision 6): with no public address, Concepts publish to the first public DList relay — presence is read there; claimed when the header is there; an unanswering relay leaves the check unfinished, not "not live"', async () => {
  const noPublic = { BRAINSTORM_RELAY_URL: SM.DOCKER_RELAY_URL, STRFRY_DOMAIN: '' };
  const relays = (held) => ({ [MAPR]: [], [PUB1]: [], [A_WRITE]: [], [DLIST]: held });
  const there = mustAnswer(await answer({ mapTags: [['39998', TA, DLIST]], config: noPublic, relays: relays([header(TA, 'dog-tricks')]) }));
  const wrong = [];
  if (!sameEntries(there.shouldSay, [{ key: '39998', relay: DLIST }])) wrong.push(`39998 at ${DLIST}; got ${show(there.shouldSay)}`);
  const down = mustAnswer(await answer({ mapTags: [['39998', TA, DLIST]], config: noPublic, relays: relays('unreachable') }));
  if (down.finished !== false || down.reason !== 'no-relay-answered' || down.done !== false || down.pending !== false || down.current !== null) {
    wrong.push(`DList relay down: unfinished, no-relay-answered, not done, not pending, current null; got ${show({ finished: down.finished, reason: down.reason, done: down.done, pending: down.pending, current: down.current })}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('U23 (AC-3, AC-5): no Map, or a Map naming only other keys — no duties, nothing to claim: done when nothing is claimed, pending when the self-Map still claims something', async () => {
  const wrong = [];
  for (const [label, mapTags] of [['no Map', null], ['others only', [['3038x', OTHER, OWN], ['39998', STRANGER, OWN]]]]) {
    const empty = mustAnswer(await answer({ mapTags, scoresHoursAgo: 1, headers: ['dog-tricks'] }));
    if (empty.mapFound !== (mapTags !== null)) wrong.push(`${label}: mapFound ${mapTags !== null}`);
    if ((empty.duties || []).length !== 0 || (empty.shouldSay || []).length !== 0) wrong.push(`${label}: no duties, nothing to claim; got ${show(empty.duties)} / ${show(empty.shouldSay)}`);
    if (empty.finished !== true || empty.current !== true || empty.done !== true || empty.pending !== false) wrong.push(`${label}: finished, current, done; got ${show(empty)}`);
    const claiming = mustAnswer(await answer({ mapTags, scoresHoursAgo: 1, headers: ['dog-tricks'], extraLocal: [selfMapEv([['39998', TA, OWN]])] }));
    if (claiming.current !== false || claiming.done !== false || claiming.pending !== true) wrong.push(`${label}, still claiming 39998: out of date, pending; got ${show({ current: claiming.current, done: claiming.done, pending: claiming.pending })}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── U — the self-Map found: AC-4 ───────────────────────── */

test('U24 (AC-4; ADR sub-decision 5): local first — when this instance\'s relay holds the Assistant\'s 10040, the newest there counts and no outside relay is asked for it', async () => {
  const got = await answer({ scoresHoursAgo: 1, headers: ['x'], extraLocal: [selfMapEv([['39998', TA, OWN]], TA, NOW_S - 9 * H), selfMapEv([['30382', TA, OWN], ['39998', TA, OWN]], TA, NOW_S - 2 * H)] });
  const action = mustAnswer(got);
  const wrong = [];
  if (!action.published || action.published.source !== 'local' || action.published.createdAt !== NOW_S - 2 * H) wrong.push(`the newest local version, source local; got ${show(action.published)}`);
  if (got.calls.readRelay.some((c) => isSelfMapFilter(c.filter))) wrong.push(`no outside read of the self-Map; got ${show(got.calls.readRelay.filter((c) => isSelfMapFilter(c.filter)).map((c) => c.url))}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('U25 (AC-4; § 9.2 Finding a self-Map): otherwise one outside round — the viewer\'s Map\'s relays for entries naming the Assistant and its 10002 write relays, each guarded; never another Assistant\'s hint, a read-only relay, a refused host or this instance\'s own relay; the newest answer counts, a tie to the lowest id', async () => {
  const older = selfMapEv([['39998', TA, OWN]], TA, NOW_S - 9 * H);
  const newer = selfMapEv([['30382', TA, OWN]], TA, NOW_S - 3 * H, 'b'.repeat(64));
  const tieLow = selfMapEv([['39998', TA, OWN]], TA, NOW_S - 3 * H, 'a'.repeat(64));
  const mapTags = [['39998', TA, HINT_A], ['3038x', TA, HINT_B], ['30392', OTHER, OTHER_HINT], ['39999', TA, REFUSED_HINT], ['30382:rank', TA, SM.DOCKER_RELAY_URL]];
  const got = await answer({
    mapTags, scoresHoursAgo: 1,
    relays: { [MAPR]: [], [PUB1]: [], [HINT_A]: [older], [HINT_B]: [newer], [A_WRITE]: [tieLow], [A_READ]: [], [OTHER_HINT]: [], [DLIST]: [] },
  });
  const action = mustAnswer(got);
  const read = got.calls.readRelay.filter((c) => isSelfMapFilter(c.filter)).map((c) => c.url);
  const wrong = [];
  for (const u of [HINT_A, HINT_B, A_WRITE]) if (!read.includes(normUrl(u))) wrong.push(`reads ${u}`);
  for (const u of [OTHER_HINT, A_READ, REFUSED_HINT]) if (read.includes(normUrl(u))) wrong.push(`never reads ${u}`);
  if (read.some((u) => /localhost|staging\.brainstorm\.world/.test(u))) wrong.push(`never reads this instance's own relay as outside: ${show(read)}`);
  if (!got.calls.guard.includes('hint-a.example') || !got.calls.guard.includes('refused-hint.example')) wrong.push(`event-named relays pass the guard: ${show(got.calls.guard)}`);
  if (!action.published || action.published.eventId !== 'a'.repeat(64) || action.published.source !== 'relay') wrong.push(`the newest, a tie to the lowest id, source relay; got ${show(action.published)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('U26 (AC-4): the found self-Map\'s self-entries are its entries naming the Assistant, normalized; the other entries are counted, not compared', async () => {
  const found = selfMapEv([
    ['39998:dlist-header', TA.toUpperCase(), 'WSS://Staging.Brainstorm.World/relay/'],
    ['39999:', TA, OWN],
    ['30392', OTHER, 'wss://scores.brainstorm.world'],
    ['3038x', STRANGER, ''],
    ['client', 'Brainstorm'],
  ]);
  const action = mustAnswer(await answer({ mapTags: [['39998', TA, OWN]], headers: ['dog-tricks'], extraLocal: [found] }));
  const wrong = [];
  if (!action.published || !sameEntries(action.published.selfEntries, [{ key: '39998', relay: OWN }])) wrong.push(`selfEntries [39998 @ ${OWN}]; got ${show(action.published)}`);
  if (!action.published || action.published.otherEntries !== 2) wrong.push(`otherEntries 2; got ${show(action.published && action.published.otherEntries)}`);
  if (action.current !== true || action.done !== true) wrong.push(`the other entries are not compared: current and done; got ${show({ current: action.current, done: action.done })}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('U27 (AC-4): "finished" — a failing self-Map scan with no outside answer is unfinished (no-relay-answered); with one outside answer it finishes; every local scan failing is instance-unanswered', async () => {
  const quietOutside = { [MAPR]: [], [PUB1]: [], [A_WRITE]: 'unreachable', [HINT_A]: 'unreachable', [DLIST]: [] };
  const wrong = [];
  const noAnswer = mustAnswer(await answer({ quiet: true, mapTags: [['39998', TA, HINT_A]], headers: ['x'], rejectScan: (f) => isSelfMapFilter(f), relays: quietOutside }));
  if (noAnswer.finished !== false || noAnswer.reason !== 'no-relay-answered' || noAnswer.done || noAnswer.pending || noAnswer.current !== null) wrong.push(`no answer: unfinished, no-relay-answered; got ${show(noAnswer)}`);
  const oneAnswer = mustAnswer(await answer({ quiet: true, mapTags: [['39998', TA, HINT_A]], headers: ['x'], rejectScan: (f) => isSelfMapFilter(f), relays: { ...quietOutside, [HINT_A]: [] } }));
  if (oneAnswer.finished !== true) wrong.push(`one outside answer: finished; got ${show(oneAnswer)}`);
  const local = mustAnswer(await answer({ quiet: true, rejectScan: () => true }));
  if (local.finished !== false || local.reason !== 'instance-unanswered' || local.done || local.pending || local.current !== null) wrong.push(`every local scan failing: unfinished, instance-unanswered; got ${show(local)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('U28 (AC-4; the 50-relay cap): at most 50 relays named inside events are guarded and read for the self-Map', async () => {
  const mapTags = Array.from({ length: 75 }, (_, i) => [`30382:m${i}`, TA, `wss://hint-${i}.example`]);
  const relays = Object.fromEntries([[MAPR, []], [PUB1, []], [A_WRITE, []], ...mapTags.map((t) => [t[2], []])]);
  const got = await answer({ mapTags, relays });
  mustAnswer(got);
  const named = got.calls.readRelay.filter((c) => isSelfMapFilter(c.filter) && /hint-\d+\.example/.test(c.url));
  assert(named.length <= 50 && named.length >= 49, `at most 50 event-named relays read (the Assistant's write relay may take a place); got ${named.length}`);
});

/* ───────────────────────── U — true, and the mark: AC-5 ───────────────────────── */

test('U29 (AC-5): the found self-Map with the same entries in another order and spelling is current: done, not pending; its lines are active at the offer\'s relay', async () => {
  const found = selfMapEv([['39998:dlist-header', TA, 'wss://STAGING.brainstorm.world/relay/'], ['30382', TA, OWN]]);
  const action = mustAnswer(await answer({ scoresHoursAgo: 1, headers: ['dog-tricks'], extraLocal: [found] }));
  const wrong = [];
  if (action.current !== true || action.done !== true || action.pending !== false) wrong.push(`current, done, not pending; got ${show({ current: action.current, done: action.done, pending: action.pending })}`);
  for (const [item, key] of [['3038x', '30382'], ['39998', '39998']]) {
    const l = lineOf(action, item, key);
    if (!l || l.status !== 'active' || l.relay !== OWN || l.reason !== null || l.falseClaim !== false) wrong.push(`${key}: active at ${OWN}, no reason; got ${show(l)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('U30 (AC-5, AC-6): a self-Map that claims Scores while no upkeep is scheduled is out of date and pending, and the 30382 line is a false claim; a different relay, a missing or an extra entry is out of date too', async () => {
  const wrong = [];
  const stale = mustAnswer(await answer({ scoresHoursAgo: 3000, schedule: [], headers: ['dog-tricks'], extraLocal: [selfMapEv([['30382', TA, OWN], ['39998', TA, OWN]])] }));
  if (stale.current !== false || stale.pending !== true || stale.done !== false) wrong.push(`claims Scores not live: out of date, pending; got ${show(stale)}`);
  const l = lineOf(stale, '3038x', '30382');
  if (!l || l.falseClaim !== true || l.status === 'active') wrong.push(`30382: a false claim, not active; got ${show(l)}`);
  const c = lineOf(stale, '39998', '39998');
  if (!c || c.status !== 'active' || c.falseClaim !== false) wrong.push(`39998 is still active; got ${show(c)}`);
  const variants = {
    'another relay': [['30382', TA, OWN], ['39998', TA, DLIST]],
    'one missing': [['30382', TA, OWN]],
    'one extra': [['30382', TA, OWN], ['39998', TA, OWN], ['39999', TA, OWN]],
  };
  for (const [label, tags] of Object.entries(variants)) {
    const a = mustAnswer(await answer({ scoresHoursAgo: 1, headers: ['dog-tricks'], extraLocal: [selfMapEv(tags)] }));
    if (a.current !== false || a.pending !== true) wrong.push(`${label}: out of date, pending; got ${show({ current: a.current, pending: a.pending })}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('U31 (AC-5): a check that throws gives the exact check-failed answer; the other actions still answer; 200', async () => {
  const got = await answer({ quiet: true, checkSelfMap: async () => { throw new Error('fixture: boom'); } });
  const wrong = [];
  if (got.res.statusCode !== 200) wrong.push(`200, got ${got.res.statusCode}`);
  if (!got.action || show(Object.fromEntries(Object.entries(got.action).sort())) !== show(Object.fromEntries(Object.entries(SM.ANSWERS.CHECK_FAILED).sort()))) wrong.push(`want ${show(SM.ANSWERS.CHECK_FAILED)}, got ${show(got.action)}`);
  if (!got.body || !got.body.actions || !got.body.actions['duty-menu'] || !got.body.actions['outbox-relays']) wrong.push('the other actions still answer');
  assert(wrong.length === 0, wrong.join('; '));
});

test('U32 (AC-2; "the two pages never disagree"): with the real Duty Menu check beside it, every offered or active line and every should-say entry has the Duty Menu offer\'s row for its kind, at that row\'s relay — for the Owner and for a customer', async () => {
  const wrong = [];
  for (const [label, o] of [
    ['Owner', { scoresHoursAgo: 1, headers: ['dog-tricks'], mapTags: [['*', TA, OWN]] }],
    ['customer', { viewer: CUSTOMER, assistant: CUSTOMER_ASSISTANT, customer: { status: 'active' }, mapTags: [['*', CUSTOMER_ASSISTANT, OWN]], scoresHoursAgo: 1, headers: ['dog-tricks'], schedule: [SM.scheduleEntry('processAllActiveCustomers', { hours: 12 })] }],
  ]) {
    const got = await answer({ ...o, realDutyMenu: true });
    const action = mustAnswer(got);
    const offer = (got.body.actions['duty-menu'] || {}).offer || [];
    const relayOf = (key) => { const kind = String(key).split(':')[0]; const row = offer.find((r) => r.key === kind); return row ? row.relay : undefined; };
    for (const item of action.duties || []) {
      for (const l of item.lines || []) {
        if ((l.status === 'offered' || l.status === 'active') && relayOf(l.key) !== l.relay) wrong.push(`${label} ${l.key}: the offer's relay ${relayOf(l.key)}, got ${l.relay}`);
        if (l.status === 'not-offered' && relayOf(l.key) !== undefined && l.key === String(l.key).split(':')[0] && /^\d{5}$/.test(l.key)) wrong.push(`${label} ${l.key}: not offered though the offer has it`);
      }
    }
    for (const e of action.shouldSay || []) if (relayOf(e.key) !== e.relay) wrong.push(`${label} should-say ${e.key}: the offer's relay ${relayOf(e.key)}, got ${e.relay}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('U33 (AC-3; deployment config): on bare metal, a public BRAINSTORM_RELAY_URL is the relay the self-entries name', async () => {
  const action = mustAnswer(await answer({ scoresHoursAgo: 1, headers: ['dog-tricks'], config: { BRAINSTORM_RELAY_URL: 'wss://relay.bare.example', STRFRY_DOMAIN: 'relay.bare.example' } }));
  assert(sameEntries(action.shouldSay, [{ key: '30382', relay: 'wss://relay.bare.example' }, { key: '39998', relay: 'wss://relay.bare.example' }]), `self-entries at wss://relay.bare.example; got ${show(action.shouldSay)}`);
});

/* ───────────────────────── C — the hub's reading: AC-5 ───────────────────────── */

test('C1 (AC-5; ADR sub-decision 9): the card keeps its key, address, section, title and words; its criteria line is the story\'s; it has no planning notes', async () => {
  const mod = await actionsModule();
  const entry = (mod.ASSISTANT_ACTIONS || []).find((a) => a.key === SM.KEY);
  const wrong = [];
  if (!entry) wrong.push(`no ${SM.KEY} entry`);
  else {
    if (entry.path !== SM.PATH || entry.section !== 'persona' || entry.title !== SM.TITLE) wrong.push(`path/section/title: ${show({ path: entry.path, section: entry.section, title: entry.title })}`);
    if (entry.alertCriteria !== SM.ALERT_CRITERIA) wrong.push(`alertCriteria: want ${show(SM.ALERT_CRITERIA)}, got ${show(entry.alertCriteria)}`);
    if (entry.planningNotes !== SM.PLANNING_NOTES) wrong.push(`planningNotes null, got ${show(entry.planningNotes)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('C2 (AC-5): treasure-map joins CHECKED_ACTIONS right after duty-menu, and is not Coming soon', async () => {
  const mod = await actionsModule();
  const checked = mod.CHECKED_ACTIONS || [];
  const i = checked.indexOf(SM.KEY);
  assert(i >= 0 && checked[i - 1] === SM.CHECKED_AFTER, `want ${SM.KEY} right after ${SM.CHECKED_AFTER}, got ${show(checked)}`);
  assert(!(mod.COMING_SOON_ACTIONS || []).includes(SM.KEY), 'not Coming soon');
});

test('C3 (AC-5): the two readings — done: unmarked, Done, not counted; pending: marked and counted; unfinished, check-failed, missing or not answered: marked, not counted', async () => {
  const mod = await actionsModule();
  const user = { assistantPubkey: TA };
  const doneOthers = Object.fromEntries((mod.CHECKED_ACTIONS || []).filter((k) => k !== SM.KEY).map((k) => [k, { done: true, pending: false }]));
  const read = (claim) => mod.assistantAttention(user, { answered: true, actions: claim === undefined ? doneOthers : { ...doneOthers, [SM.KEY]: claim } });
  const base = mod.assistantAttention(user, { answered: true, actions: { ...doneOthers, [SM.KEY]: SM.ANSWERS.DONE } });
  const wrong = [];
  const cases = {
    done: [SM.ANSWERS.DONE, false, true, 0],
    pending: [SM.ANSWERS.NOT_PUBLISHED, true, false, 1],
    unfinished: [SM.ANSWERS.UNFINISHED, true, false, 0],
    'check-failed': [SM.ANSWERS.CHECK_FAILED, true, false, 0],
    missing: [undefined, true, false, 0],
  };
  for (const [label, [claim, marked, isDone, counted]] of Object.entries(cases)) {
    const got = read(claim);
    if (got.needsAttention.includes(SM.KEY) !== marked) wrong.push(`${label}: marked ${marked}`);
    if (got.done.includes(SM.KEY) !== isDone) wrong.push(`${label}: Done ${isDone}`);
    if (got.alertCount - base.alertCount !== counted) wrong.push(`${label}: counted ${counted} (alertCount ${got.alertCount} vs ${base.alertCount})`);
  }
  const unanswered = mod.assistantAttention(user, null);
  if (!unanswered.needsAttention.includes(SM.KEY)) wrong.push('not answered: marked');
  assert(wrong.length === 0, wrong.join('; '));
});

test('C4 (AC-5; open question 2): the count line reads "Nothing needs attention" at zero, and is unchanged for one and more; with every action done the hub reaches zero', async () => {
  const mod = await actionsModule();
  const wrong = [];
  if (mod.attentionCountText(0) !== SM.COUNT_ZERO) wrong.push(`0: want ${show(SM.COUNT_ZERO)}, got ${show(mod.attentionCountText(0))}`);
  if (mod.attentionCountText(1) !== '1 action needs attention') wrong.push(`1: ${show(mod.attentionCountText(1))}`);
  if (mod.attentionCountText(3) !== '3 actions need attention') wrong.push(`3: ${show(mod.attentionCountText(3))}`);
  const allDone = Object.fromEntries((mod.CHECKED_ACTIONS || []).map((k) => [k, { done: true, pending: false }]));
  const got = mod.assistantAttention({ assistantPubkey: TA }, { answered: true, actions: allDone });
  if (got.count !== 0 || got.alertCount !== 0) wrong.push(`every checked action done: count 0 and alertCount 0, got ${show({ count: got.count, alertCount: got.alertCount, needsAttention: got.needsAttention })}`);
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── S — sentinels: AC-1, AC-7 ───────────────────────── */

test('S1 (AC-7): the check and the library are read-only and session-only — no signing, publishing, strfry import, file writes; selfMap.js never reads the request', () => {
  const wrong = [];
  for (const file of [SELF_MAP_MODULE, LIB]) {
    const src = codeOnly(safeRead(file));
    if (!src) { wrong.push(`${rel(file)} does not exist`); continue; }
    for (const [re, what] of [
      [/finalizeEvent|signEvent|getPrivateKey|privkey|secretKey/, 'signs'],
      [/strfry['"`\s,]+import|\bimport\b['"]?\s*,\s*['"]--/, 'imports into strfry'],
      [/writeFile|appendFile|mkdirSync|renameSync|unlinkSync/, 'writes files'],
      [/\.publish\s*\(|publishEverywhere|SimplePool/, 'publishes'],
      [/\breq\s*\.|\brequest\s*\./, 'reads the request'],
    ]) if (re.test(src)) wrong.push(`${rel(file)} ${what}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('S2 (AC-7; ADR sub-decision 8): attention.js runs checkSelfMap beside the others, keys it treasure-map, replaces a failure with SELF_MAP_CHECK_FAILED, and documents it', () => {
  const raw = safeRead(ATTENTION_MODULE);
  const src = codeOnly(raw);
  const wrong = [];
  if (!/TREASURE_MAP\s*=\s*['"]treasure-map['"]/.test(src)) wrong.push("TREASURE_MAP = 'treasure-map'");
  if (!/Promise\.allSettled\(\s*\[[\s\S]*checkSelfMap[\s\S]*\]\s*\)/.test(src)) wrong.push('checkSelfMap inside the Promise.allSettled');
  if (!/SELF_MAP_CHECK_FAILED/.test(src)) wrong.push('SELF_MAP_CHECK_FAILED on a rejection');
  if (!/module\.exports\s*=\s*\{[\s\S]*TREASURE_MAP[\s\S]*\}/.test(src)) wrong.push('exports TREASURE_MAP');
  const header = raw.split('*/')[0] || '';
  if (!/treasure-map/.test(header)) wrong.push('the header comment documents the treasure-map check');
  assert(wrong.length === 0, wrong.join('; '));
});

test('S3 (ADR sub-decision 6, § Implementation notes 3): schedulerEnabled moves into schedulerSwitch.js (pure fs), and scheduler.js still exports it', () => {
  const wrong = [];
  const sw = codeOnly(safeRead(SWITCH_MODULE));
  if (!sw) wrong.push(`${rel(SWITCH_MODULE)} does not exist`);
  else {
    if (!/schedulerEnabled/.test(sw)) wrong.push('it defines schedulerEnabled');
    if (/require\(\s*['"]\.\/index['"]\s*\)|bullmq/i.test(sw)) wrong.push('it loads no queue or BullMQ');
    if (!/\/etc\/brainstorm-task-queue\.json/.test(sw)) wrong.push('it reads /etc/brainstorm-task-queue.json');
  }
  const sch = codeOnly(safeRead(SCHEDULER_MODULE));
  if (!/require\(\s*['"]\.\/schedulerSwitch['"]\s*\)/.test(sch)) wrong.push('scheduler.js requires ./schedulerSwitch');
  if (!/module\.exports\s*=\s*\{[\s\S]*schedulerEnabled[\s\S]*\}/.test(sch)) wrong.push('scheduler.js still exports schedulerEnabled (deploy-safety reads it)');
  assert(wrong.length === 0, wrong.join('; '));
});

test('S4 (ADR open question 3): cron-parser is a direct dependency at exactly 4.9.0, in package.json and the lockfile\'s root', () => {
  const pkg = JSON.parse(safeRead(path.join(REPO, 'package.json')) || '{}');
  const lock = JSON.parse(safeRead(path.join(REPO, 'package-lock.json')) || '{}');
  const wrong = [];
  if ((pkg.dependencies || {})['cron-parser'] !== '4.9.0') wrong.push(`package.json dependencies["cron-parser"] is "4.9.0" (got ${show((pkg.dependencies || {})['cron-parser'])})`);
  const root = (lock.packages || {})[''] || {};
  if ((root.dependencies || {})['cron-parser'] !== '4.9.0') wrong.push(`package-lock.json packages[""].dependencies["cron-parser"] is "4.9.0" (got ${show((root.dependencies || {})['cron-parser'])})`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('S5 (ADR § Implementation notes 7): src/api/openapi.yaml\'s /api/assistant/attention block describes the treasure-map action, and BIBLE §11\'s row names the check', () => {
  const yaml = safeRead(path.join(REPO, 'src/api/openapi.yaml'));
  const at = yaml.indexOf('/api/assistant/attention:');
  const block = at >= 0 ? yaml.slice(at, yaml.indexOf(NL + '  /api/', at + 10)) : '';
  const wrong = [];
  if (!block) wrong.push('openapi.yaml has no /api/assistant/attention block');
  if (!/treasure-map/.test(block)) wrong.push('the block names the treasure-map action');
  for (const field of ['shouldSay', 'selfEntries', 'instanceMap', 'mapFound']) if (!new RegExp(`\\b${field}\\b`).test(block)) wrong.push(`the block has the ${field} field`);
  const bibleRow = safeRead(path.join(REPO, 'BIBLE.md')).split(NL).find((l) => l.includes('`/api/assistant/attention`')) || '';
  if (!/treasure-map|self-Map/.test(bibleRow)) wrong.push('BIBLE §11: the /api/assistant/attention row names the self-Map check');
  assert(wrong.length === 0, wrong.join('; '));
});

test('S6 (ADR sub-decision 10; re-aimed by assistant-self-map #2, ADR 0002 sub-decision 5): the answer rides GET /api/assistant/attention, still PUBLIC_READ; the only self-Map route in routeAccess.js is story 2\'s POST /api/assistant/self-map, open to a signed-in person', () => {
  const src = codeOnly(safeRead(path.join(REPO, 'src/middleware/routeAccess.js')));
  const wrong = [];
  if (!/['"]GET \/api\/assistant\/attention['"]\s*:\s*PUBLIC_READ/.test(src)) wrong.push('GET /api/assistant/attention stays PUBLIC_READ');
  const named = (src.match(/['"](?:GET|POST|PUT|PATCH|DELETE) \/[^'"]*(?:self-?map|treasure-map\/publish)[^'"]*['"]/gi) || []).map((m) => m.slice(1, -1));
  if (show(named) !== show([SM.PRESS.routeKey])) wrong.push(`the one self-Map route is ${SM.PRESS.routeKey}, got ${show(named)}`);
  if (!new RegExp(`['"]${SM.PRESS.routeKey.replace(/\//g, '\\/')}['"]\\s*:\\s*allow\\(\\s*['"]signed-in['"]`).test(src)) wrong.push(`${SM.PRESS.routeKey} is allow('signed-in', …)`);
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── Round 2: ADR 0001 Amendment 2 (review round 1) ───────────────────────── */

/** A local Thursday, 04:00 — a weekday cron's next two fires are then Friday and Monday (the review's N1). */
const THURSDAY_4AM = new Date(2026, 9, 15, 4, 0, 0).getTime();
/** The Assistant's Scores, landed `hoursAgo` before the clock `atMs` (the world's scoresHoursAgo counts from T0). */
const scoresBefore = (author, atMs, hoursAgo) => [1, 2, 3].map((n) => ev(SM.SCORE_KIND, author, Math.floor(atMs / 1000) - hoursAgo * H, [['d', `${n}`.repeat(64)], ['rank', '7']]));
const scoreReason = async (o, item = '3038x', key = '30382') => (lineOf(mustAnswer(await answer(o)), item, key) || {}).reason;

test('U34 (AC-2; ADR 0001 A2 item 1, review B2): the queue flag is read as the instance reads it — BullMQ entries count only when TASK_QUEUE_ENABLED is exactly "true"; absent, "True" or "1" counts none, and nothing is claimed; the systemd timer still counts with the flag absent', async () => {
  const wrong = [];
  const on = await scoreReason({ scoresHoursAgo: 1 });
  if (on !== 'live-unclaimed') wrong.push(`TASK_QUEUE_ENABLED="true" with an enabled 12-hour processAllTasks entry: live (got ${on})`);
  const cases = {
    'the setting absent (an older brainstorm.conf; the instance then never starts its queue, bin/control-panel.js)': { dropConfig: ['TASK_QUEUE_ENABLED'] },
    '"True"': { config: { TASK_QUEUE_ENABLED: 'True' } },
    '"1"': { config: { TASK_QUEUE_ENABLED: '1' } },
  };
  for (const [label, o] of Object.entries(cases)) {
    const a = mustAnswer(await answer({ scoresHoursAgo: 1, ...o }));
    const r = (lineOf(a, '3038x', '30382') || {}).reason;
    if (r !== 'not-scheduled') wrong.push(`${label}: the entry never runs, so Scores are not-scheduled (got ${r})`);
    if ((a.shouldSay || []).some((e) => /^30382/.test(e.key))) wrong.push(`${label}: no Score is claimed (shouldSay ${show(a.shouldSay)})`);
  }
  const timer = await scoreReason({ scoresHoursAgo: 1, schedule: [], timer: true, dropConfig: ['TASK_QUEUE_ENABLED'], config: { BRAINSTORM_PROCESS_ALL_TASKS_INTERVAL: '12hours' } });
  if (timer !== 'live-unclaimed') wrong.push(`the flag absent does not stop the systemd timer (got ${timer})`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('U35 (AC-2; ADR 0001 A2 item 2, review N1): a cron entry\'s interval is the shortest gap among its next 8 fires — "0 3 * * 1-5" read on a Thursday at 04:00 is 24 h, so Scores 49 hours old are upkeep-stopped (the old two-fire rule gave 72 h and called them live); an expression cron-parser rejects counts for nothing', async () => {
  const weekday = [SM.scheduleEntry('processAllTasks', { cron: '0 3 * * 1-5' })];
  const at = (hoursAgo, schedule = weekday) => scoreReason({ clock: { t: THURSDAY_4AM }, schedule, extraLocal: scoresBefore(TA, THURSDAY_4AM, hoursAgo) });
  const wrong = [];
  const fresh = await at(47);
  if (fresh !== 'live-unclaimed') wrong.push(`47 hours old, within twice 24 h: live (got ${fresh})`);
  const stale = await at(49);
  if (stale !== 'upkeep-stopped') wrong.push(`49 hours old, past twice 24 h: upkeep-stopped (got ${stale}) — the interval must not stretch to the Friday-to-Monday gap`);
  const bad = await at(1, [SM.scheduleEntry('processAllTasks', { cron: 'whenever it likes' })]);
  if (bad !== 'not-scheduled') wrong.push(`an unparseable cron gives no interval: not-scheduled (got ${bad})`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('U36 (AC-2; ADR 0001 A2 item 3, review N5): the per-customer scheduler\'s running timer counts for its own customer — whatever the queue flag says, beside BullMQ entries (the shortest wins), before the systemd fallback; never for the Owner or another customer; asked by the customer\'s main pubkey', async () => {
  const base = { viewer: CUSTOMER, assistant: CUSTOMER_ASSISTANT, customer: { status: 'active' }, mapTags: [['30382:rank', CUSTOMER_ASSISTANT, OWN]], schedule: [] };
  const reason = async (o) => scoreReason({ ...base, ...o }, '30382:rank', '30382:rank');
  const H_MS = 3600 * 1000;
  const wrong = [];
  for (const [hoursAgo, want] of [[23, 'live-unclaimed'], [25, 'upkeep-stopped']]) {
    const r = await reason({ customerTimers: { [CUSTOMER]: 12 * H_MS }, scoresHoursAgo: hoursAgo });
    if (r !== want) wrong.push(`the customer's 12-hour timer, Scores ${hoursAgo}h old: ${want} (got ${r})`);
  }
  const claimed = mustAnswer(await answer({ ...base, customerTimers: { [CUSTOMER]: 12 * H_MS }, scoresHoursAgo: 1 }));
  if (!sameEntries(claimed.shouldSay, [{ key: '30382:rank', relay: OWN }])) wrong.push(`the customer's shouldSay: 30382:rank (got ${show(claimed.shouldSay)})`);
  const flagOff = await reason({ customerTimers: { [CUSTOMER]: 12 * H_MS }, scoresHoursAgo: 1, config: { TASK_QUEUE_ENABLED: 'false' } });
  if (flagOff !== 'live-unclaimed') wrong.push(`the timer runs in-process whatever TASK_QUEUE_ENABLED says: live (got ${flagOff})`);
  const another = await reason({ customerTimers: { [ANOTHER_CUSTOMER]: 12 * H_MS }, scoresHoursAgo: 1 });
  if (another !== 'not-scheduled') wrong.push(`another customer's timer: not-scheduled (got ${another})`);
  const none = await reason({ scoresHoursAgo: 1 });
  if (none !== 'not-scheduled') wrong.push(`no timer running and no entry: not-scheduled (got ${none})`);
  const joined = { customerTimers: { [CUSTOMER]: 6 * H_MS }, schedule: [SM.scheduleEntry('processCustomer', { hours: 24, args: { customer: CUSTOMER } })] };
  for (const [hoursAgo, want] of [[11, 'live-unclaimed'], [13, 'upkeep-stopped']]) {
    const r = await reason({ ...joined, scoresHoursAgo: hoursAgo });
    if (r !== want) wrong.push(`a 6-hour timer beside a 24-hour entry, Scores ${hoursAgo}h old: the shortest wins, ${want} (got ${r})`);
  }
  const fallback = await reason({ customerTimers: { [CUSTOMER]: 24 * H_MS }, timer: true, config: { BRAINSTORM_PROCESS_ALL_TASKS_INTERVAL: '6h' }, scoresHoursAgo: 13 });
  if (fallback !== 'live-unclaimed') wrong.push(`with the customer's 24-hour timer running, the systemd timer stays the fallback: Scores 13h old are live (got ${fallback})`);
  const asked = await answer({ ...base, customerTimers: { [CUSTOMER]: 12 * H_MS }, scoresHoursAgo: 1 });
  if (!asked.calls.customerTimer.includes(CUSTOMER)) wrong.push(`the timer is asked for by the customer's main pubkey (asked ${show(asked.calls.customerTimer)})`);
  if (asked.calls.customerTimer.includes(CUSTOMER_ASSISTANT)) wrong.push('never by the customer\'s Assistant key');
  const owner = await scoreReason({ scoresHoursAgo: 1, schedule: [], customerTimers: { [OWNER]: 12 * H_MS } });
  if (owner !== 'not-scheduled') wrong.push(`the Owner's Scores never count a per-customer timer: not-scheduled (got ${owner})`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('U37 (AC-6; ADR 0001 A2 item 4, review B1): a found self-entry that wins a part this instance does not offer is a false claim — staging\'s shape with ["3038x", TA, R] found: the 3038x not-offered line has falseClaim true; with no such claim it has false', async () => {
  const wrong = [];
  const claimed = mustAnswer(await answer({ scoresHoursAgo: 1, headers: ['dog-tricks'], extraLocal: [selfMapEv([['3038x', TA, OWN]])] }));
  const notOffered = linesOf(claimed, '3038x', 'not-offered');
  if (notOffered.length !== 1) wrong.push(`one not-offered line under 3038x (got ${show(notOffered)})`);
  else if (notOffered[0].falseClaim !== true) wrong.push(`3038x claims 30383–30389, which are not offered: falseClaim true (got ${show(notOffered[0])})`);
  if (claimed.current !== false) wrong.push(`the self-Map is out of date (current ${show(claimed.current)})`);
  const clean = mustAnswer(await answer({ scoresHoursAgo: 1, headers: ['dog-tricks'] }));
  const l = linesOf(clean, '3038x', 'not-offered')[0];
  if (!l || l.falseClaim !== false) wrong.push(`with no self-Map, the not-offered line has falseClaim false (got ${show(l)})`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('L6 (AC-6; ADR 0001 A2 item 5, review N2): readSelfEntries counts as other entries only tags whose key parses and whose element 2 is another 64-hex key — never a p tag or an unparseable key', () => {
  const read = need(libModule(), 'readSelfEntries', rel(LIB));
  const got = read(selfMapEv([
    ['39998', TA, OWN],
    ['p', STRANGER],
    ['bogus', OTHER, OWN],
    ['30392', OTHER, 'wss://scores.brainstorm.world'],
  ]), TA);
  assert(got && got.otherEntries === 1, `one other entry (30392 naming another key); a p tag and the unparseable "bogus" are not entries (got ${show(got && got.otherEntries)})`);
});

test('U38 (AC-6; ADR 0001 A2 item 6, review N3): a kind outside Scores, Lists and Concepts has no category — a Map entry 30023 naming the TA gives a line whose category is null', async () => {
  const a = mustAnswer(await answer({ scoresHoursAgo: 1, mapTags: [['30023', TA, OWN], ['39998', TA, OWN]], headers: ['dog-tricks'] }));
  const it = itemOf(a, '30023');
  const lines = (it && it.lines) || [];
  assert(lines.length > 0 && lines.every((l) => l.category === null), `the 30023 item's lines have category null, never "concepts" (got ${show(it)})`);
});

test('S7 (ADR 0001 A2 item 3): src/api/customer-schedule exports getTimerIntervalMs, which keeps the interval on the running timer and answers null for a customer with none; selfMap.js wires customerTimerIntervalMs to it', () => {
  const MOD = path.join(REPO, 'src/api/customer-schedule/index.js');
  const src = codeOnly(safeRead(MOD));
  const wrong = [];
  if (!/module\.exports\s*=\s*\{[\s\S]*\bgetTimerIntervalMs\b[\s\S]*\}/.test(src)) wrong.push(`${rel(MOD)} exports getTimerIntervalMs`);
  if (!/function\s+startCustomerTimer[\s\S]*?\bintervalMs\s*[,:}]/.test(src)) wrong.push('startCustomerTimer keeps intervalMs in the timer\'s state');
  else {
    try {
      delete require.cache[require.resolve(MOD)];
      const mod = require(MOD);
      const got = typeof mod.getTimerIntervalMs === 'function' ? mod.getTimerIntervalMs('ab'.repeat(32)) : undefined;
      if (got !== null) wrong.push(`getTimerIntervalMs answers null with no timer running (got ${show(got)})`);
    } catch (err) { wrong.push(`${rel(MOD)} loads in Node: ${err.message}`); }
  }
  const sm = codeOnly(safeRead(SELF_MAP_MODULE));
  if (!/customerTimerIntervalMs\s*:[\s\S]{0,200}require\(\s*['"]\.\.\/customer-schedule['"]\s*\)\.getTimerIntervalMs/.test(sm)) wrong.push('selfMap.js defaultDeps: customerTimerIntervalMs lazily requires ../customer-schedule\'s getTimerIntervalMs');
  if (!/getConfigFromFile\(\s*['"]TASK_QUEUE_ENABLED['"]\s*,\s*['"]false['"]\s*\)/.test(sm)) wrong.push('selfMap.js reads TASK_QUEUE_ENABLED with the default "false", as bin/control-panel.js does');
  assert(wrong.length === 0, wrong.join('; '));
});

test('S8 (ADR 0001 A2 item 6): openapi.yaml\'s duties line category is nullable', () => {
  const yaml = safeRead(path.join(REPO, 'src/api/openapi.yaml'));
  const at = yaml.indexOf('/api/assistant/attention:');
  const block = at >= 0 ? yaml.slice(at, yaml.indexOf(NL + '  /api/', at + 10)) : '';
  const lines = block.split(NL);
  const duties = lines.findIndex((l) => /^\s+duties:\s*$/.test(l));
  const cat = duties >= 0 ? lines.slice(duties).find((l) => /^\s+category:/.test(l)) : '';
  assert(cat && /nullable:\s*true/.test(cat), `the duties lines' category has nullable: true (got ${show(cat)})`);
});

/* ───────────────────────── Round 3: ADR 0001 Amendment 3 (review round 2) ───────────────────────── */

/** Treasure Maps §§ 4.5–4.6 as ADR duty-menus-and-self-maps/0004 accepted them: four spellings this check never reads. */
const NON_KEYS = ['39998:', '39999:', '39999:dlist-header', '39999:duty-menu'];
/** A correct self-Map for staging's Owner shape with Scores live (U29's world): 30382 and 39998 at this instance's relay. */
const RIGHT_SELF_MAP = () => selfMapEv([['30382', TA, OWN], ['39998', TA, OWN]]);
const keysShown = (action) => ((action && action.duties) || []).flatMap((i) => [i.key, ...((i.lines || []).map((l) => l.key))]);

test('U39 (AC-2, AC-3, AC-5; ADR 0001 A3 item 1, review R2-B1): one entry keyed 39998:, 39999:, 39999:dlist-header or 39999:duty-menu in the viewer\'s Map changes nothing — a correct self-Map stays current, shouldSay keeps 30382 and 39998, no line is a false claim, and nothing on the page carries the spelling', async () => {
  const wrong = [];
  const base = SM.stagingOwnerMapTags(TA, OTHER);
  const before = mustAnswer(await answer({ scoresHoursAgo: 1, headers: ['dog-tricks'], extraLocal: [RIGHT_SELF_MAP()] }));
  if (before.current !== true) wrong.push(`the baseline (staging's Map, Scores live, the right self-Map) is current; got ${show(before.current)}`);
  for (const k of NON_KEYS) {
    const a = mustAnswer(await answer({ mapTags: [...base, [k, TA, OWN]], scoresHoursAgo: 1, headers: ['dog-tricks'], extraLocal: [RIGHT_SELF_MAP()] }));
    if (!sameEntries(a.shouldSay, [{ key: '30382', relay: OWN }, { key: '39998', relay: OWN }])) wrong.push(`${k}: shouldSay stays 30382 and 39998 at ${OWN} (got ${show(a.shouldSay)})`);
    if (a.current !== true || a.done !== true) wrong.push(`${k}: the self-Map stays current and done (got ${show({ current: a.current, done: a.done })})`);
    const claims = (a.duties || []).flatMap((i) => (i.lines || []).filter((l) => l.falseClaim).map((l) => `${i.key}>${l.key}`));
    if (claims.length) wrong.push(`${k}: no line is a false claim (got ${show(claims)})`);
    if (keysShown(a).includes(k)) wrong.push(`${k}: no item or line carries it (got ${show(keysShown(a))})`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('U40 (AC-2; ADR 0001 A3 item 1): such an entry alone gives no duty, and naming another key gives no elsewhere line', async () => {
  const wrong = [];
  for (const k of NON_KEYS) {
    const alone = mustAnswer(await answer({ mapTags: [[k, TA, OWN]], scoresHoursAgo: 1, headers: ['dog-tricks'] }));
    if (!Array.isArray(alone.duties) || alone.duties.length !== 0) wrong.push(`a Map naming the TA only under ${k}: duties [] (got ${show(alone.duties)})`);
  }
  for (const k of ['39998:', '39999:dlist-header']) {
    const a = mustAnswer(await answer({ mapTags: [['39998', TA, OWN], [k, OTHER, OWN]], scoresHoursAgo: 1, headers: ['dog-tricks'] }));
    const elsewhere = linesOf(a, '39998', 'elsewhere');
    if (elsewhere.length) wrong.push(`["39998", TA] with ["${k}", OTHER]: no elsewhere line (got ${show(elsewhere)})`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('L7 (ADR 0001 A3 item 1): parseKey gives null for 39998:, 39999:, 39999:dlist-header and 39999:duty-menu; 39998:dlist-header is the bare 39998, and 39998:duty-menu and 39998:: (d ":") still parse', () => {
  const parseKey = need(libModule(), 'parseKey', rel(LIB));
  const wrong = [];
  for (const k of NON_KEYS) { const got = parseKey(k); if (got !== null) wrong.push(`${k}: null (got ${show(got && got.norm)})`); }
  const legacy = parseKey('39998:dlist-header');
  if (!legacy || legacy.norm !== '39998') wrong.push(`39998:dlist-header is the bare 39998 (got ${show(legacy && legacy.norm)})`);
  for (const k of ['39998:duty-menu', '39998::']) { const got = parseKey(k); if (!got || got.norm !== k) wrong.push(`${k} still parses, as itself (got ${show(got && got.norm)})`); }
  assert(wrong.length === 0, wrong.join('; '));
});

test('L8 (ADR 0001 A3 items 1 and 2): readSelfEntries — the four spellings are in neither list; element 3 empty or missing is "", a URL is normalized, and an unparseable relay stays as itself', () => {
  const read = need(libModule(), 'readSelfEntries', rel(LIB));
  const wrong = [];
  const keyed = read(selfMapEv([...NON_KEYS.map((k) => [k, TA, OWN]), ...NON_KEYS.map((k) => [k, OTHER, OWN]), ['39998', TA, OWN], ['30392', OTHER, OWN]]), TA);
  if (!sameEntries(keyed.selfEntries, [{ key: '39998', relay: OWN }])) wrong.push(`selfEntries: only 39998 (got ${show(keyed.selfEntries)})`);
  if (keyed.otherEntries !== 1) wrong.push(`otherEntries: only the 30392 entry (got ${show(keyed.otherEntries)})`);
  const relays = read(selfMapEv([['30382', TA, ''], ['39998', TA], ['3038x', TA, 'WSS://Staging.Brainstorm.World/relay/'], ['30392', TA, 'not a url']]), TA);
  const byKey = Object.fromEntries((relays.selfEntries || []).map((e) => [e.key, e.relay]));
  const want = { 30382: '', 39998: '', '3038x': OWN, 30392: 'not a url' };
  for (const [k, r] of Object.entries(want)) if (byKey[k] !== r) wrong.push(`${k}'s relay: ${show(r)} (got ${show(byKey[k])})`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('U41 (AC-6; ADR 0001 A3 item 2, review R2-N1): a found self-entry with an empty element 3 claims nothing — no false claim, the live 30382 line is live-unclaimed, the self-Map is out of date; an unparseable relay is still a false claim', async () => {
  const wrong = [];
  for (const tags of [[['30382', TA, ''], ['39998', TA, OWN]], [['3038x', TA, ''], ['39998', TA, OWN]]]) {
    const a = mustAnswer(await answer({ scoresHoursAgo: 1, headers: ['dog-tricks'], extraLocal: [selfMapEv(tags)] }));
    const label = `found ["${tags[0][0]}", TA, ""]`;
    const claims = (a.duties || []).flatMap((i) => (i.lines || []).filter((l) => l.falseClaim).map((l) => `${i.key}>${l.key}`));
    if (claims.length) wrong.push(`${label}: claims nothing, so no false claim (got ${show(claims)})`);
    const l = lineOf(a, '3038x', '30382');
    if (!l || l.status !== 'offered' || l.reason !== 'live-unclaimed') wrong.push(`${label}: the live 30382 line is offered, live-unclaimed (got ${show(l)})`);
    if (a.current !== false) wrong.push(`${label}: out of date (current ${show(a.current)})`);
  }
  const bad = mustAnswer(await answer({ scoresHoursAgo: 1, headers: ['dog-tricks'], extraLocal: [selfMapEv([['30382', TA, 'not a url'], ['39998', TA, OWN]])] }));
  const b = lineOf(bad, '3038x', '30382');
  if (!b || b.falseClaim !== true) wrong.push(`found ["30382", TA, "not a url"]: a claim at an unusable relay is a false claim (got ${show(b)})`);
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────── AD — assistant-duties-settings #1: the self-Map over the Assistant Duties list ───────────── */

const scoreScans = (got) => got.calls.scanLocal.filter((f) => Array.isArray(f && f.kinds) && f.kinds.includes(SM.SCORE_KIND));

test('AD1 (assistant-duties-settings #1 AC-6; ADR assistant-duties-settings/0001 sub-decision 6): when the Assistant Duties list gives 30382 a typed relay, Scores that landed here are never claimed there — the 30382:rank line is offered, at the typed relay, with reason not-published-here; no Scores scan runs; nothing for Scores in shouldSay. Control: at This instance\'s relay the same world is live', async () => {
  const TYPED = 'wss://typed-scores.example';
  const typedList = DM.DEFAULT_DUTIES.map((d) => (d.key === '30382' ? { key: '30382', relay: TYPED } : { ...d }));
  const base = { scoresHoursAgo: 1, mapTags: [['30382:rank', TA, OWN]] };
  const typed = await answer({ ...base, duties: typedList });
  const control = await answer({ ...base });
  const wrong = [];
  const t = lineOf(mustAnswer(typed), '30382:rank', '30382:rank') || {};
  const c = lineOf(mustAnswer(control), '30382:rank', '30382:rank') || {};
  if (c.reason !== 'live-unclaimed') wrong.push(`control: at This instance's relay the Scores are live (got ${show(c)})`);
  if (t.status !== 'offered' || t.reason !== 'not-published-here') wrong.push(`typed relay: offered, reason not-published-here (got ${show(t)})`);
  if (t.relay !== TYPED) wrong.push(`typed relay: the line carries the offer's relay ${TYPED} (got ${show(t.relay)})`);
  if (scoreScans(typed).length !== 0) wrong.push(`typed relay: no Scores scan of this instance's strfry (got ${show(scoreScans(typed))})`);
  if (scoreScans(control).length === 0) wrong.push('control: the Scores scan ran (so the typed case is not an early return)');
  if ((typed.action.shouldSay || []).some((e) => /^30382/.test(e.key))) wrong.push(`typed relay: shouldSay claims no Scores (got ${show(typed.action.shouldSay)})`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('AD2 (assistant-duties-settings #1 AC-6, story § Background "offered but not live"): a duty added to the list that this instance does not publish — 30383 — given to the Assistant by the Map is offered and never active, with reason not-published-here; without it on the list the same Map entry is not offered', async () => {
  const withAdded = [...DM.DEFAULT_DUTIES.map((d) => ({ ...d })), { key: '30383' }];
  const base = { scoresHoursAgo: 1, mapTags: [['30383', TA, OWN]] };
  const added = mustAnswer(await answer({ ...base, duties: withAdded }));
  const plain = mustAnswer(await answer({ ...base }));
  const wrong = [];
  const a = lineOf(added, '30383', '30383') || {};
  const p = lineOf(plain, '30383', '30383') || {};
  if (a.status !== 'offered' || a.reason !== 'not-published-here') wrong.push(`listed 30383: offered, not-published-here (got ${show(a)})`);
  if (linesOf(added, '30383', 'active').length !== 0) wrong.push('listed 30383 is never active');
  if ((added.shouldSay || []).some((e) => /^30383/.test(e.key))) wrong.push(`shouldSay never claims 30383 (got ${show(added.shouldSay)})`);
  if (p.status !== 'not-offered') wrong.push(`control: off the list, 30383 is not offered (got ${show(p)})`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('AD3 (assistant-duties-settings #1 AC-6; book Decision 6): an Admin who is not a customer has Scores offered on the self-Map too — the 30382:rank line is offered, not "not offered" — and, with no Scores of theirs landed here, never active', async () => {
  const ADMIN = 'ad'.repeat(32);
  const ADMIN_ASSISTANT = 'a1'.repeat(32);
  const got = await answer({ viewer: ADMIN, assistant: ADMIN_ASSISTANT, customer: null, mapTags: [['30382:rank', ADMIN_ASSISTANT, OWN]] });
  const l = lineOf(mustAnswer(got), '30382:rank', '30382:rank') || {};
  const wrong = [];
  if (l.status !== 'offered') wrong.push(`the Admin's Scores are offered (got ${show(l)})`);
  if (linesOf(got.action, '30382:rank', 'active').length !== 0) wrong.push('never active without Scores landed');
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── Story 2: ADR assistant-self-map/0002 sub-decisions 2 and 3 ───────────────────────── */

const NEW_HINT = 'wss://hint-new.example';
const BAD_HINT = 'wss://bad-hint.example';

test('V1 (story 2 AC-1; ADR 0002 sub-decision 2): the answer carries the remembered choice — selfMapOn is readSelfMapChoice\'s answer for the session\'s own Assistant: true, false, or null when it is unknown or the read throws; an unfinished answer carries it too', async () => {
  const wrong = [];
  for (const [choice, want] of [[true, true], [false, false], [null, null], ['throw', null]]) {
    const got = await answer({ scoresHoursAgo: 1, headers: ['dog-tricks'], choice, quiet: true });
    const a = mustAnswer(got);
    if (a.selfMapOn !== want) wrong.push(`choice ${show(choice)}: selfMapOn ${show(want)}, got ${show(a.selfMapOn)}`);
    if (!got.calls.readSelfMapChoice.includes(TA)) wrong.push(`choice ${show(choice)}: read for the session's Assistant ${TA.slice(0, 8)}…, got ${show(got.calls.readSelfMapChoice)}`);
  }
  const u = await answer({ rejectScan: (f) => isViewerMapFilter(f, OWNER), relays: {}, choice: true });
  const ua = mustAnswer(u);
  if (ua.finished !== false || ua.selfMapOn !== true) wrong.push(`an unfinished answer carries selfMapOn: want { finished: false, selfMapOn: true }, got ${show({ finished: ua.finished, selfMapOn: ua.selfMapOn })}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('V2 (story 2 AC-1; ADR 0002 sub-decision 2): a check that throws answers SELF_MAP_CHECK_FAILED, which carries selfMapOn null — the choice is unknown, not off', async () => {
  const { selfMap } = freshModules();
  assert(selfMap.SELF_MAP_CHECK_FAILED && selfMap.SELF_MAP_CHECK_FAILED.selfMapOn === null, `SELF_MAP_CHECK_FAILED.selfMapOn is null, got ${show(selfMap.SELF_MAP_CHECK_FAILED)}`);
  const got = await answer({ checkSelfMap: async () => { throw new Error('fixture: the check threw'); }, quiet: true });
  const a = mustAnswer(got);
  assert(a.reason === 'check-failed' && a.selfMapOn === null, `a thrown check: reason check-failed and selfMapOn null, got ${show({ reason: a.reason, selfMapOn: a.selfMapOn })}`);
});

test('V3 (story 2 AC-5; ADR 0002 sub-decisions 2 and 3): checkSelfMap is gatherSelfMap plus the choice — gatherSelfMap answers { answer, lookup } with lookup.latest the newest version found; the marks do not move with the choice (story 1\'s marking rules stand)', async () => {
  const stale = selfMapEv([['30382', TA, OWN], ['39998', TA, OWN], ['30392', OTHER, 'wss://scores.brainstorm.world']]);
  const w = world({ scoresHoursAgo: null, headers: ['dog-tricks'], extraLocal: [stale] });
  const { selfMap } = freshModules();
  const gather = need(selfMap, 'gatherSelfMap', rel(SELF_MAP_MODULE));
  const { deps } = fakes(w);
  const g = await gather({ viewer: OWNER, assistantPubkey: TA, forWrite: false }, deps);
  const wrong = [];
  if (!g || typeof g !== 'object' || !g.answer || !g.lookup) wrong.push(`{ answer, lookup }, got ${show(g && Object.keys(g))}`);
  else {
    if (!g.lookup.latest || g.lookup.latest.id !== stale.id) wrong.push(`lookup.latest is the version found (${stale.id.slice(0, 8)}…), got ${show(g.lookup.latest && g.lookup.latest.id)}`);
    if (Object.prototype.hasOwnProperty.call(g.answer, 'selfMapOn')) wrong.push('the gathered answer has no selfMapOn: checkSelfMap adds it');
    const viaCheck = await selfMap.checkSelfMap({ viewer: OWNER, assistantPubkey: TA }, deps);
    const { selfMapOn, ...rest } = viaCheck || {};
    if (show(rest) !== show(g.answer)) wrong.push(`checkSelfMap's answer without selfMapOn equals the gathered answer: ${show(rest)} vs ${show(g.answer)}`);
    if (selfMapOn !== false) wrong.push(`checkSelfMap adds selfMapOn (false here), got ${show(selfMapOn)}`);
  }
  for (const choice of [true, false]) {
    const a = mustAnswer(await answer({ scoresHoursAgo: null, headers: ['dog-tricks'], extraLocal: [stale], choice }));
    if (a.done !== false || a.pending !== true || a.current !== false) wrong.push(`choice ${choice}: the stale self-Map is pending either way, got ${show({ done: a.done, pending: a.pending, current: a.current })}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('V4 (story 2 AC-4; ADR 0002 sub-decision 3, R1): lookupSelfMap with forWrite reads this instance\'s relay and the outside round together, and the newest version across both wins; without forWrite it stays local-first and asks no outside relay', async () => {
  const older = selfMapEv([['39998', TA, OWN]], TA, NOW_S - 10 * H);
  const newer = selfMapEv([['39998', TA, OWN], ['30393', OTHER, 'wss://scores.brainstorm.world']], TA, NOW_S - H);
  const mapTags = [['39998', TA, HINT_A]];
  const w = world({ mapTags, extraLocal: [older], relays: { [HINT_A]: [newer], [A_WRITE]: [] } });
  const { selfMap } = freshModules();
  const mapEvent = w.local.find((e) => e.kind === SM.TREASURE_MAP_KIND && e.pubkey === OWNER);
  const wrong = [];
  const strict = fakes(w);
  const got = await selfMap.lookupSelfMap({ assistantPubkey: TA, mapEvent, offer: [], forWrite: true }, strict.deps);
  if (!got || got.finished !== true || !got.latest || got.latest.id !== newer.id) wrong.push(`forWrite: the newer outside version wins, got ${show(got && { finished: got.finished, latest: got.latest && got.latest.id })}`);
  if (!strict.calls.readRelay.some((r) => r.url === normUrl(HINT_A) && isSelfMapFilter(r.filter))) wrong.push('forWrite: the outside round ran although this instance holds a version');
  const plain = fakes(w);
  const local = await selfMap.lookupSelfMap({ assistantPubkey: TA, mapEvent, offer: [] }, plain.deps);
  if (!local || !local.latest || local.latest.id !== older.id) wrong.push(`without forWrite: local-first, the version here counts, got ${show(local && local.latest && local.latest.id)}`);
  if (plain.calls.readRelay.some((r) => isSelfMapFilter(r.filter))) wrong.push(`without forWrite: no outside relay asked for the self-Map, got ${show(plain.calls.readRelay.map((r) => r.url))}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('V5 (story 2 AC-4 "Never blind"; ADR 0002 sub-decision 3, R1): forWrite\'s strict finish — this instance\'s scan failing is instance-unanswered even when outside relays answer; none here and no outside relay answering is no-relay-answered; none here and nothing outside to ask is finished with no version', async () => {
  const { selfMap } = freshModules();
  const wrong = [];
  const mapTags = [['39998', TA, HINT_A]];
  const failing = world({ mapTags, relays: { [HINT_A]: [], [A_WRITE]: [] }, rejectScan: (f) => isSelfMapFilter(f) });
  const mapOf = (w) => w.local.find((e) => e.kind === SM.TREASURE_MAP_KIND && e.pubkey === OWNER);
  const a = await selfMap.lookupSelfMap({ assistantPubkey: TA, mapEvent: mapOf(failing), offer: [], forWrite: true }, fakes(failing).deps);
  if (!a || a.finished !== false || a.reason !== 'instance-unanswered') wrong.push(`local scan failed: { finished: false, reason: 'instance-unanswered' }, got ${show(a && { finished: a.finished, reason: a.reason })}`);
  const silent = world({ mapTags, relays: {} });
  const b = await selfMap.lookupSelfMap({ assistantPubkey: TA, mapEvent: mapOf(silent), offer: [], forWrite: true }, fakes(silent).deps);
  if (!b || b.finished !== false || b.reason !== 'no-relay-answered') wrong.push(`none here, no outside answer: { finished: false, reason: 'no-relay-answered' }, got ${show(b && { finished: b.finished, reason: b.reason })}`);
  const alone = world({ mapTags: [], relays: {} });
  alone.local = alone.local.filter((e) => e.kind !== SM.RELAY_LIST_KIND);
  const c = await selfMap.lookupSelfMap({ assistantPubkey: TA, mapEvent: mapOf(alone), offer: [], forWrite: true }, fakes(alone).deps);
  if (!c || c.finished !== true || c.latest !== null) wrong.push(`none here, nothing outside to ask: finished with latest null, got ${show(c && { finished: c.finished, latest: c.latest, reason: c.reason })}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('V6 (story 2; story 1 review R3-N2, ADR 0002 sub-decision 3): the relay hints come only from the viewer\'s entries whose key parses — an entry keyed 39998: naming the Assistant is no hint, while a valid one\'s relay is asked', async () => {
  const mapTags = [['39998', TA, NEW_HINT], ['39998:', TA, BAD_HINT], ['3038x', TA, NEW_HINT]];
  const got = await answer({ mapTags, relays: { [NEW_HINT]: [], [BAD_HINT]: [], [A_WRITE]: [] } });
  mustAnswer(got);
  const asked = got.calls.readRelay.filter((r) => isSelfMapFilter(r.filter)).map((r) => r.url);
  const wrong = [];
  if (!asked.includes(normUrl(NEW_HINT))) wrong.push(`the valid entry's relay is asked, got ${show(asked)}`);
  if (asked.includes(normUrl(BAD_HINT)) || got.calls.guard.includes(hostOf(BAD_HINT))) wrong.push(`the 39998: entry's relay is neither guarded nor asked, got ${show(asked)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

async function run() {
  console.log(`${NL}=== assistant-self-map-check (assistant-self-map #1) ===`);
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
  console.log(`${NL}assistant-self-map-check: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

module.exports = { run };
