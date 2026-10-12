'use strict';
/**
 * assistant-shared-categories #1: Done, but shared — Scores, Lists and Concepts held by another Assistant.
 *
 * Story (with its Design note, Edge cases and AC→handle lines; Light profile, no ADR):
 *   engineering-team/stories/done/assistant-shared-categories/1-done-but-shared.md
 * Browser half: tests/brainstorm/assistant-shared-categories.spec.js, and SV18 in tests/brainstorm/treasure-map-save.spec.js.
 * Expected words and answer shapes: test/helpers/trustedContentFixtures.js (TC.shared, TC.SHARED_COPY).
 * The suite this story re-aims: test/assistant-trusted-content.test.js (U1–U4, U11, U12).
 *
 * Classes:
 *   U — the server check, src/api/assistant/trustedContent.js: checkTrustedContent with the real category rule, and
 *       evaluateTrustedContent alone. Stack-free, through injected dependencies.                       [AC-1]
 *   A — the attention handler, src/api/assistant/attention.js: the failure shape, and `shared` end to end.  [AC-1, AC-5]
 *   C — the hub's pure readings and words in ui/src/pages/assistant/actions.js, loaded in Node.       [AC-2, AC-3, AC-4]
 *   D — source sentinels on what this runner cannot execute: the card (Index.jsx) and its CSS.              [AC-2]
 *   S — the documents: openapi, BIBLE §11, ADR assistant-trusted-content-status/0001, and no retired reason. [AC-4]
 *
 * Every U, A, C, D and S test FAILS against the code before this story — the answer has no `shared`, "only other
 * Assistants" is pending, assistantAttention has no `shared`, ASSISTANT_COPY has none of the new words, the card has
 * no Shared pill or line, and the documents describe the old rule — except the sentinels marked (sentinel), which
 * pass before and after: C2 (a shared answer counts exactly as Done — true today because the client ignores the field,
 * and it must stay true; AC-3's change of count is shown failing-before by U1's "only another" row and the browser
 * spec's SC1) and S4 (read-only, session-shaped).
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const TC = require('./helpers/trustedContentFixtures');
const DUTY_MENU_ANSWER = require('./helpers/dutyMenuFixtures').ANSWERS.DONE;
// Re-aimed by assistant-self-map #1 (ADR 0001 sub-decision 8): the self-Map check joins the answer; stubbed here, as the
// Duty Menu's is, so this suite's reads stay its own. test/assistant-self-map-check.test.js drives the real one.
const SELF_MAP_ANSWER = require('./helpers/selfMapFixtures').ANSWERS.DONE;

const REPO = path.resolve(__dirname, '..');
const CHECK_MODULE = path.join(REPO, 'src/api/assistant/trustedContent.js');
const ATTENTION_MODULE = path.join(REPO, 'src/api/assistant/attention.js');
const ACTIONS_MOD = path.join(REPO, 'ui/src/pages/assistant/actions.js');
const UI_UTIL = path.join(REPO, 'ui/src/utils/assistantAttention.js');
const HUB_PAGE = path.join(REPO, 'ui/src/pages/assistant/Index.jsx');
const STYLES = path.join(REPO, 'ui/src/styles.css');
const OPENAPI = path.join(REPO, 'src/api/openapi.yaml');
const BIBLE = path.join(REPO, 'BIBLE.md');
const OLD_ADR = path.join(REPO, 'engineering-team/decisions/done/assistant-trusted-content-status/0001-scores-lists-and-concepts-join-the-one-attention-answer.md');
const NL = String.fromCharCode(10);

// Fixture keys, never live ones.
const VIEWER = 'a1'.repeat(32);
const ASSISTANT = 'a2'.repeat(32);
const OTHER = 'b2'.repeat(32);
const THIRD = 'b3'.repeat(32);
const STRANGER = 'dd'.repeat(32);

// Fixture relays: two outside, and this instance's own.
const ONE = 'wss://one.example';
const TWO = 'wss://two.example';
const OWN = 'ws://localhost:7777';
const R = 'wss://relay.example';

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
const show = (v) => JSON.stringify(v);
const rel = (p) => path.relative(REPO, p);

function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') return Object.keys(v).sort().reduce((o, k) => { o[k] = sortKeys(v[k]); return o; }, {});
  return v;
}
const sameJson = (a, b) => show(sortKeys(a)) === show(sortKeys(b));

/** Source with comments removed (block comments become blank lines, so line numbers stay true). */
function codeOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .split(NL)
    .map((line) => line.replace(/(^|[^:'"`\\])\/\/.*$/, '$1'))
    .join(NL);
}

/* ───────────────────────── fixtures: events ───────────────────────── */

let idSeq = 0;
const hexId = (n) => n.toString(16).padStart(64, '0');

/** A Treasure Map (kind 10040) by `pubkey` (the viewer by default) with these tags. */
function mapEv(tags, { createdAt = 1000, pubkey = VIEWER } = {}) {
  idSeq += 1;
  return { id: hexId(idSeq), pubkey, kind: 10040, created_at: createdAt, tags, content: '', sig: '0'.repeat(128) };
}

function matching(events, filter) {
  const kinds = Array.isArray(filter && filter.kinds) ? filter.kinds : null;
  const authors = Array.isArray(filter && filter.authors) ? filter.authors.map((a) => String(a).toLowerCase()) : null;
  return events.filter((e) => (!kinds || kinds.includes(e.kind)) && (!authors || authors.includes(String(e.pubkey).toLowerCase())));
}

/**
 * The owner's own Map on staging, which this story came from (book § Intent anchor), with fixture keys: Scores split
 * (3038x to their Assistant here, 30382:rank and 30382:followers to another), Lists only to another, Concepts only to
 * theirs. Its `client` tag has no delegate and counts for nobody.
 */
const OWNERS_MAP_TAGS = [
  ['30392', OTHER, R], ['30393', OTHER, R], ['30394', OTHER, R],
  ['39998', ASSISTANT, R], ['3038x', ASSISTANT, R], ['39999', ASSISTANT, R],
  ['30382:rank', OTHER, R], ['30382:followers', OTHER, R],
  ['client', 'Brainstorm'],
];

/* ───────────────────────── the modules under test ───────────────────────── */

function fresh(abs, what) {
  if (!fs.existsSync(abs)) throw new Error(`${rel(abs)} does not exist. ${what}`);
  delete require.cache[require.resolve(abs)];
  return require(abs);
}
const checkModule = () => fresh(CHECK_MODULE, 'It is the Scores/Lists/Concepts check (ADR assistant-trusted-content-status/0001).');
const attentionModule = () => fresh(ATTENTION_MODULE, 'It answers GET /api/assistant/attention.');
function need(mod, name, file) {
  assert(typeof mod[name] === 'function', `${file} must export ${name}().`);
  return mod[name];
}

async function esm(absPath, what) {
  assert(fs.existsSync(absPath), `${rel(absPath)} does not exist. ${what}`);
  let mod;
  try { mod = await import(pathToFileURL(absPath).href); } catch (err) { throw new Error(`${rel(absPath)} must load in Node as an ES module: ${err.message}`); }
  return mod;
}
const actionsModule = () => esm(ACTIONS_MOD, 'It holds ASSISTANT_ACTIONS, ASSISTANT_COPY and assistantAttention.');
const uiUtil = () => esm(UI_UTIL, 'It holds summarizeAttention.');

/** checkTrustedContent's injected dependencies, as test/assistant-trusted-content.test.js gives them. */
function checkFakes(opts = {}) {
  const deps = {
    scanLocal: async (filter) => {
      if (opts.local === 'reject') throw new Error('fixture: strfry scan failed');
      return matching(Array.isArray(opts.local) ? opts.local : [], filter);
    },
    readRelay: async (url, filter) => {
      const answer = opts.relays ? opts.relays[url] : undefined;
      if (!Array.isArray(answer)) return { status: 'unreachable', events: [], error: 'fixture: unreachable' };
      return { status: 'ok', events: matching(answer, filter), error: null };
    },
    getConfigFromFile: (key, dflt) => (key === 'BRAINSTORM_RELAY_URL' ? OWN : dflt),
    mapDefaultRelays: () => (opts.mapRelays || [ONE, TWO, OWN]).slice(),
    loadCategoryRule: async () => need(checkModule(), 'loadCategoryRule', rel(CHECK_MODULE))(),
  };
  return deps;
}

/** Run the real check (and its real category rule) for the fixture viewer and their Assistant. */
async function check(opts = {}, assistantPubkey = ASSISTANT) {
  const run = need(checkModule(), 'checkTrustedContent', rel(CHECK_MODULE));
  return run({ viewer: VIEWER, assistantPubkey }, checkFakes(opts));
}

/** Compare the three answers with `want` ({ key: value }), collecting each difference. */
function trioDiff(label, out, want) {
  const wrong = [];
  for (const key of TC.KEYS) {
    if (!Object.prototype.hasOwnProperty.call(want, key)) continue;
    const got = out && out[key];
    if (!sameJson(got, want[key])) wrong.push(`${label} — ${key}: want ${show(want[key])}, got ${show(got)}`);
  }
  return wrong;
}

/* ───────────────────────── U — the server check ───────────────────────── */

test('U1: the AC-1 table, for Lists, through the real check and rule — Done when only the viewer\'s Assistant here holds it (alone, by `*`, or with another only as its backup); shared partly beside another on another key; shared entirely when only others hold it (alone, first with the viewer\'s as backup, or by `*`); not-assigned with nobody; no-map with no Map (AC-1)', async () => {
  const rows = [
    ['the viewer\'s Assistant only', [['30392', ASSISTANT, R]], TC.done('lists', 'local')],
    ['`*` to the viewer\'s Assistant only', [['*', ASSISTANT, R]], TC.done('lists', 'local')],
    ['the viewer\'s first, another as its backup', [['30392', ASSISTANT, R], ['30392', OTHER, R]], TC.done('lists', 'local')],
    ['the viewer\'s and another, on different keys', [['30392', ASSISTANT, R], ['30393', OTHER, R]], TC.shared('lists', 'partly', 'local')],
    ['only another', [['30392', OTHER, R]], TC.shared('lists', 'entirely', 'local')],
    ['another first, the viewer\'s only as its backup', [['30392', OTHER, R], ['30392', ASSISTANT, R]], TC.shared('lists', 'entirely', 'local')],
    ['`*` to another only', [['*', OTHER, R]], TC.shared('lists', 'entirely', 'local')],
    ['nobody (Scores only)', [['30382:rank', ASSISTANT, R]], TC.pending('lists', 'not-assigned', 'local')],
  ];
  const wrong = [];
  for (const [label, tags, want] of rows) {
    const out = await check({ local: [mapEv(tags)] });
    wrong.push(...trioDiff(label, out, { 'trusted-lists': want }));
  }
  const none = await check({ local: [], relays: { [ONE]: [] } });
  wrong.push(...trioDiff('no Map found', none, { 'trusted-lists': TC.pending('lists', 'no-map') }));
  assert(wrong.length === 0, wrong.join('; '));
});

test('U2: the owner\'s own Map from staging (fixture keys) — Scores shared partly, Lists shared entirely, Concepts Done (AC-1)', async () => {
  const out = await check({ local: [mapEv(OWNERS_MAP_TAGS)] });
  const wrong = trioDiff('the owner\'s Map', out, {
    'trusted-assertions': TC.shared('scores', 'partly', 'local'),
    'trusted-lists': TC.shared('lists', 'entirely', 'local'),
    dlists: TC.done('concepts', 'local'),
  });
  assert(wrong.length === 0, wrong.join('; '));
});

test('U3: edge E1 — a `*` to the viewer\'s Assistant is hidden for Lists by a bare `3039x` to another, so Lists is shared entirely while Scores and Concepts, still reached by the `*`, are plain Done (Design note: one reading of the Map)', async () => {
  const out = await check({ local: [mapEv([['*', ASSISTANT, R], ['3039x', OTHER, R]])] });
  const wrong = trioDiff('`*` hidden for Lists', out, {
    'trusted-assertions': TC.done('scores', 'local'),
    'trusted-lists': TC.shared('lists', 'entirely', 'local'),
    dlists: TC.done('concepts', 'local'),
  });
  assert(wrong.length === 0, wrong.join('; '));
});

test('U4: edge E2 — case-blind: the Map naming the viewer\'s Assistant in upper case is the viewer\'s (Done, not shared), and an upper-case assistantPubkey handed to evaluateTrustedContent still matches; a `*:tag` to another Assistant never makes a category shared (AC-1)', async () => {
  const wrong = [];
  const upper = await check({ local: [mapEv([['30392', ASSISTANT.toUpperCase(), R]])] });
  wrong.push(...trioDiff('upper-case delegate', upper, { 'trusted-lists': TC.done('lists', 'local') }));
  const evaluate = need(checkModule(), 'evaluateTrustedContent', rel(CHECK_MODULE));
  const got = evaluate({ lookup: { finished: true, event: mapEv([]), source: 'local' }, assistantPubkey: ASSISTANT.toUpperCase(), assignments: { scores: [ASSISTANT], lists: [ASSISTANT, OTHER], concepts: [OTHER] } });
  wrong.push(...trioDiff('upper-case assistantPubkey', got, {
    'trusted-assertions': TC.done('scores', 'local'),
    'trusted-lists': TC.shared('lists', 'partly', 'local'),
    dlists: TC.shared('concepts', 'entirely', 'local'),
  }));
  const scoped = await check({ local: [mapEv([['30392', ASSISTANT, R], ['*:tag', OTHER, R]])] });
  wrong.push(...trioDiff('`*:tag` to another', scoped, { 'trusted-lists': TC.done('lists', 'local') }));
  assert(wrong.length === 0, wrong.join('; '));
});

test('U5: edge E3 — several other Assistants, or the same other on several keys: with the viewer\'s among them it is partly; without, entirely; the extent does not depend on order or count (AC-1)', async () => {
  const evaluate = need(checkModule(), 'evaluateTrustedContent', rel(CHECK_MODULE));
  const lookup = { finished: true, event: mapEv([]), source: 'relay' };
  const cases = [
    [[OTHER, THIRD, ASSISTANT], 'partly'],
    [[ASSISTANT, OTHER, THIRD], 'partly'],
    [[OTHER, THIRD], 'entirely'],
    [[THIRD], 'entirely'],
    [[ASSISTANT], null],
  ];
  const wrong = [];
  for (const [lists, extent] of cases) {
    const got = evaluate({ lookup, assistantPubkey: ASSISTANT, assignments: { scores: [], lists, concepts: [] } });
    const want = extent ? TC.shared('lists', extent, 'relay') : TC.done('lists', 'relay');
    wrong.push(...trioDiff(`lists ${show(lists.map((p) => p.slice(0, 2)))}`, got, { 'trusted-lists': want }));
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('U6: every answer is exactly { category, finished, done, pending, reason, source, shared }, and shared is non-null only when done — over unfinished, no Map, not-assigned, Done and both extents (Design note)', () => {
  const evaluate = need(checkModule(), 'evaluateTrustedContent', rel(CHECK_MODULE));
  const map = mapEv([]);
  const inputs = [
    { lookup: { finished: false, reason: 'local-unreadable' }, assignments: null },
    { lookup: { finished: false }, assignments: null },
    { lookup: { finished: true, event: null, source: null }, assignments: null },
    { lookup: { finished: true, event: map, source: 'local' }, assignments: { scores: [], lists: [], concepts: [] } },
    { lookup: { finished: true, event: map, source: 'local' }, assignments: { scores: [ASSISTANT], lists: [ASSISTANT, OTHER], concepts: [OTHER] } },
    { lookup: { finished: true, event: map, source: 'relay' }, assignments: null },
  ];
  const fields = ['category', 'done', 'finished', 'pending', 'reason', 'shared', 'source'].join();
  const wrong = [];
  for (const input of inputs) {
    const out = evaluate({ ...input, assistantPubkey: ASSISTANT }) || {};
    for (const key of TC.KEYS) {
      const v = out[key];
      if (!v || Object.keys(v).sort().join() !== fields) { wrong.push(`${show(input.lookup)} ${key}: fields ${show(v && Object.keys(v))}`); continue; }
      if (v.shared !== null && !(v.done === true && TC.EXTENTS.includes(v.shared))) wrong.push(`${show(input.lookup)} ${key}: shared ${show(v.shared)} with done ${v.done}`);
      if (v.shared !== null && v.pending !== false) wrong.push(`${key}: a shared category is never pending`);
    }
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('U7: the reason other-assistants-only is retired — no answer carries it, over every way of giving the three categories to the viewer\'s Assistant, another, both or nobody; and src/ no longer names it (Design note)', () => {
  const evaluate = need(checkModule(), 'evaluateTrustedContent', rel(CHECK_MODULE));
  const holders = [[], [ASSISTANT], [OTHER], [ASSISTANT, OTHER], [OTHER, ASSISTANT], [OTHER, THIRD]];
  const wrong = [];
  for (const h of holders) {
    const out = evaluate({ lookup: { finished: true, event: mapEv([]), source: 'local' }, assistantPubkey: ASSISTANT, assignments: { scores: h, lists: h, concepts: h } });
    for (const key of TC.KEYS) {
      const v = out && out[key];
      if (v && v.reason === 'other-assistants-only') wrong.push(`${key} for ${show(h.map((p) => p.slice(0, 2)))} still answers other-assistants-only`);
      if (h.length > 0 && !(v && v.done === true)) wrong.push(`${key} for ${show(h.map((p) => p.slice(0, 2)))}: any Assistant makes it done, got ${show(v)}`);
    }
  }
  for (const file of [CHECK_MODULE, ATTENTION_MODULE]) {
    if (/other-assistants-only/.test(safeRead(file))) wrong.push(`${rel(file)} still names other-assistants-only (code or comment)`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── A — the attention handler ───────────────────────── */

function attentionDeps({ trustedContent = 'default', local = [] } = {}) {
  const deps = {
    getAssistantPubkeyFor: async () => ASSISTANT,
    scanLocal: async (filter) => matching(local, filter),
    readRelay: async () => ({ status: 'unreachable', events: [], error: 'fixture' }),
    readConfiguredRelays: () => [],
    getConfigFromFile: (k, d) => (k === 'BRAINSTORM_RELAY_URL' ? OWN : d),
    mapDefaultRelays: () => [ONE],
    checkProfile: async () => ({ finished: true, done: true, pending: false, items: [] }),
    checkDutyMenu: async () => DUTY_MENU_ANSWER,
    checkSelfMap: async () => SELF_MAP_ANSWER,
  };
  if (trustedContent === 'reject') deps.checkTrustedContent = async () => { throw new Error('fixture: the trusted-content check exploded'); };
  return deps;
}
function fakeRes() {
  const res = { statusCode: 200, body: undefined };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}
const signedInReq = () => ({ session: { authenticated: true, pubkey: VIEWER }, query: { pubkey: STRANGER, assistantPubkey: STRANGER } });
async function handle(req, deps) {
  const res = fakeRes();
  const log = console.error; const warn = console.warn;
  console.error = () => {}; console.warn = () => {};
  try { await need(attentionModule(), 'handleAssistantAttention', rel(ATTENTION_MODULE))(req, res, deps); } finally { console.error = log; console.warn = warn; }
  return res;
}

test('A1: a trusted-content check that throws still answers each of the three with the full shape — check-failed, unfinished, and shared null (Design note)', async () => {
  const res = await handle(signedInReq(), attentionDeps({ trustedContent: 'reject' }));
  const actions = (res.body && res.body.actions) || {};
  assert(res.statusCode === 200, `want 200, got ${res.statusCode}`);
  const wrong = trioDiff('check-failed', actions, TC.trio((c) => TC.checkFailed(c)));
  assert(wrong.length === 0, wrong.join('; '));
});

test('A2: wired end to end — the real check and rule, the owner\'s Map on this instance\'s relay, and a request that names someone else: the answer carries Scores partly, Lists entirely, Concepts Done, for the session\'s viewer and their own Assistant, and names no pubkey (AC-1, AC-5)', async () => {
  const res = await handle(signedInReq(), attentionDeps({ local: [mapEv(OWNERS_MAP_TAGS)] }));
  const actions = (res.body && res.body.actions) || {};
  const wrong = trioDiff('end to end', actions, {
    'trusted-assertions': TC.shared('scores', 'partly', 'local'),
    'trusted-lists': TC.shared('lists', 'entirely', 'local'),
    dlists: TC.done('concepts', 'local'),
  });
  const text = show(TC.KEYS.map((k) => actions[k])).toLowerCase();
  for (const [who, pk] of [['viewer', VIEWER], ['assistant', ASSISTANT], ['other', OTHER], ['stranger', STRANGER]]) if (text.includes(pk)) wrong.push(`the answer names the ${who}'s pubkey`);
  assert(res.statusCode === 200 && wrong.length === 0, `status ${res.statusCode}; ${wrong.join('; ')}`);
});

/* ───────────────────────── C — the hub's readings and words ───────────────────────── */

const USER = { pubkey: 'cc'.repeat(32), classification: 'customer', assistantPubkey: 'c1'.repeat(32) };
const ID_DONE = { finished: true, done: true, pending: false, taggings: [] };
const answerWith = (actions) => ({ success: true, signedIn: true, hasAssistant: true, actions: { 'identification-tags': ID_DONE, ...actions } });
const OWNERS_TRIO = {
  'trusted-assertions': TC.shared('scores', 'partly'),
  'trusted-lists': TC.shared('lists', 'entirely'),
  dlists: TC.done('concepts'),
};

test('C1: assistantAttention answers `shared` — for the owner\'s answer, { trusted-assertions: partly, trusted-lists: entirely }; all three in `done`, none in `needsAttention` (AC-2, AC-3)', async () => {
  const mod = await actionsModule();
  const summarize = (await uiUtil()).summarizeAttention;
  const got = mod.assistantAttention(USER, summarize(answerWith(OWNERS_TRIO)));
  const wrong = [];
  if (!got || typeof got.shared !== 'object' || got.shared === null || Array.isArray(got.shared)) wrong.push(`assistantAttention must answer shared: { [key]: 'partly' | 'entirely' }; got ${show(got && got.shared)}`);
  else if (!sameJson(got.shared, { 'trusted-assertions': 'partly', 'trusted-lists': 'entirely' })) wrong.push(`shared: want {"trusted-assertions":"partly","trusted-lists":"entirely"}, got ${show(got.shared)}`);
  for (const k of TC.KEYS) {
    if (!got.done.includes(k)) wrong.push(`${k} is done`);
    if (got.needsAttention.includes(k)) wrong.push(`${k} is not marked`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('C2 (sentinel): shared is not counted — for each extent and each of the three, a shared answer gives exactly the same needsAttention, done, count and alertCount as plain Done; Needs attention still counts on both (AC-3)', async () => {
  const mod = await actionsModule();
  const summarize = (await uiUtil()).summarizeAttention;
  const pick = (r) => ({ needsAttention: r.needsAttention, done: r.done, count: r.count, alertCount: r.alertCount });
  const plain = pick(mod.assistantAttention(USER, summarize(answerWith(TC.trio((c) => TC.done(c))))));
  const wrong = [];
  for (const extent of TC.EXTENTS) {
    const all = pick(mod.assistantAttention(USER, summarize(answerWith(TC.trio((c) => TC.shared(c, extent))))));
    if (!sameJson(all, plain)) wrong.push(`all three shared ${extent}: want ${show(plain)}, got ${show(all)}`);
    for (const card of TC.CARDS) {
      const one = pick(mod.assistantAttention(USER, summarize(answerWith({ ...TC.trio((c) => TC.done(c)), [card.key]: TC.shared(card.category, extent) }))));
      if (!sameJson(one, plain)) wrong.push(`${card.key} shared ${extent}: counted differently from Done`);
    }
  }
  const pend = mod.assistantAttention(USER, summarize(answerWith(TC.trio((c) => TC.pending(c, 'not-assigned')))));
  if (pend.count !== plain.count + 3 || pend.alertCount !== plain.alertCount + 3) wrong.push(`Needs attention still counts on both: want count ${plain.count + 3} and alertCount ${plain.alertCount + 3}, got ${pend.count} and ${pend.alertCount}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('C3: shared only for a checked action that is done, with a known extent — not a placeholder, not a pending or unfinished answer, not an unknown value; empty with no answer, while checking, after a failure, and for a visitor or a viewer with no Assistant (AC-2, AC-5)', async () => {
  const mod = await actionsModule();
  const summarize = (await uiUtil()).summarizeAttention;
  const wrong = [];
  const odd = answerWith({
    bounties: { finished: true, done: true, pending: false, shared: 'entirely' },
    'trusted-assertions': { ...TC.pending('scores', 'not-assigned'), shared: 'partly' },
    'trusted-lists': { ...TC.unfinished('lists'), shared: 'entirely' },
    dlists: { ...TC.done('concepts'), shared: 'yes' },
  });
  const got = mod.assistantAttention(USER, summarize(odd));
  if (!sameJson(got.shared, {})) wrong.push(`odd answers: want {}, got ${show(got.shared)}`);
  const empties = [
    ['no answer', mod.assistantAttention(USER)],
    ['checking', mod.assistantAttention(USER, { phase: 'checking', answered: false, actions: {} })],
    ['failed', mod.assistantAttention(USER, summarize(null))],
    ['visitor', mod.assistantAttention(null, summarize(answerWith(OWNERS_TRIO)))],
    ['no assistant', mod.assistantAttention({ pubkey: 'ee'.repeat(32), classification: 'guest', assistantPubkey: null }, summarize(answerWith(OWNERS_TRIO)))],
  ];
  for (const [label, r] of empties) if (!sameJson(r && r.shared, {})) wrong.push(`${label}: want shared {}, got ${show(r && r.shared)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('C4: the words — ASSISTANT_COPY.shared "Shared", doneSharedSrPrefix "Done, shared: ", sharedLine { partly, entirely } and sharedMoveLink "Move it here →"; Done and Needs attention unchanged; each of the three alertCriteria is § Copy\'s; actions.js keeps its one import (AC-2, AC-4)', async () => {
  const mod = await actionsModule();
  const copy = mod.ASSISTANT_COPY || {};
  const wrong = [];
  if (copy.shared !== TC.SHARED_COPY.pill) wrong.push(`shared: want ${show(TC.SHARED_COPY.pill)}, got ${show(copy.shared)}`);
  if (copy.doneSharedSrPrefix !== TC.SHARED_COPY.srPrefix) wrong.push(`doneSharedSrPrefix: want ${show(TC.SHARED_COPY.srPrefix)}, got ${show(copy.doneSharedSrPrefix)}`);
  if (!sameJson(copy.sharedLine, TC.SHARED_COPY.line)) wrong.push(`sharedLine: want ${show(TC.SHARED_COPY.line)}, got ${show(copy.sharedLine)}`);
  if (copy.sharedMoveLink !== TC.SHARED_COPY.link) wrong.push(`sharedMoveLink: want ${show(TC.SHARED_COPY.link)}, got ${show(copy.sharedMoveLink)}`);
  if (copy.done !== TC.DONE_COPY.done || copy.doneSrPrefix !== TC.DONE_COPY.doneSrPrefix || copy.needsAttention !== 'Needs attention') wrong.push('Done, its prefix and Needs attention are unchanged');
  for (const card of TC.CARDS) {
    const a = (mod.ASSISTANT_ACTIONS || []).find((x) => x.key === card.key);
    if (!a || a.alertCriteria !== card.alertCriteria) wrong.push(`${card.key} alertCriteria: want ${show(card.alertCriteria)}, got ${show(a && a.alertCriteria)}`);
  }
  const imports = codeOnly(safeRead(ACTIONS_MOD)).match(/^\s*import\s[\s\S]*?from\s*['"][^'"]+['"]/gm) || [];
  if (imports.length !== 1) wrong.push(`actions.js has ${imports.length} imports; it keeps one`);
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── D — the card and its CSS ───────────────────────── */

/** The ActionCard function's source, comments removed. */
function actionCardSource() {
  const code = codeOnly(safeRead(HUB_PAGE));
  const at = code.indexOf('function ActionCard');
  assert(at >= 0, `${rel(HUB_PAGE)} has no ActionCard`);
  const end = code.indexOf('export default function', at);
  return { card: code.slice(at, end > at ? end : at + 4000), page: code };
}

test('D1: the card draws the shared state — ActionCard takes `shared`; the page reads `shared` from assistantAttention and hands it to each card; the neutral pill with ASSISTANT_COPY.shared (aria-hidden); the line (bs-assistant-hub-card-shared) with ASSISTANT_COPY.sharedLine; a router Link to MANAGE_TREASURE_MAP_PATH lifted by bs-assistant-hub-inline-link with ASSISTANT_COPY.sharedMoveLink; the · mark hidden from screen readers; no ◐ mark (dropped at Gate B); doneSharedSrPrefix (AC-2)', () => {
  const { card, page } = actionCardSource();
  const wrong = [];
  for (const [re, what] of [
    [/function\s+ActionCard\s*\(\s*\{[^}]*\bshared\b[^}]*\}/, 'ActionCard takes a `shared` prop'],
    [/\{[^}]*\bshared\b[^}]*\}\s*=\s*assistantAttention\s*\(/, 'the page destructures `shared` from assistantAttention(…)'],
    [/<ActionCard[^>]*\bshared=\{/, 'the page hands `shared` to each card'],
    [/className="bs-setup-step-badge is-neutral"\s+aria-hidden="true"/, 'the Shared pill is the neutral badge, aria-hidden'],
    [/ASSISTANT_COPY\.shared\b(?!Line|Move)/, 'the pill word is ASSISTANT_COPY.shared'],
    [/className="bs-assistant-hub-card-shared"/, 'the line is .bs-assistant-hub-card-shared'],
    [/ASSISTANT_COPY\.sharedLine\s*\[/, 'the line words come from ASSISTANT_COPY.sharedLine[extent]'],
    [/<Link\s+to=\{MANAGE_TREASURE_MAP_PATH\}\s+className="bs-assistant-hub-inline-link"/, 'the move link is a router Link to MANAGE_TREASURE_MAP_PATH, lifted by bs-assistant-hub-inline-link'],
    [/ASSISTANT_COPY\.sharedMoveLink\b/, 'the link words are ASSISTANT_COPY.sharedMoveLink'],
    [/aria-hidden="true">\s*\{?\s*['"`]?\s*·/, 'the · separator is aria-hidden'],
    [/ASSISTANT_COPY\.doneSharedSrPrefix\b/, 'the shared screen-reader prefix is ASSISTANT_COPY.doneSharedSrPrefix'],
    [/ASSISTANT_COPY\.doneSrPrefix\b/, 'an unshared done card keeps ASSISTANT_COPY.doneSrPrefix'],
  ]) if (!re.test(/assistantAttention|<ActionCard/.test(re.source) ? page : card)) wrong.push(what);
  if (!/import\s*\{[^}]*\bMANAGE_TREASURE_MAP_PATH\b[^}]*\}\s*from\s*['"]\.\.\/\.\.\/config\/avatarMenuLinks(\.js)?['"]/.test(page)) wrong.push('Index.jsx imports MANAGE_TREASURE_MAP_PATH from ../../config/avatarMenuLinks');
  // The owner's Gate B verdict (2026-10-11): the ◐ mark is dropped.
  if (/◐/.test(card)) wrong.push('the ◐ mark was dropped at Gate B; the card must not draw it');
  assert(wrong.length === 0, wrong.join('; '));
});

test('D2: order on the card — the Shared pill comes after the Done badge in the title row, and the line after the description; the marker stays ✓ and the card stays is-done (AC-2)', () => {
  const { card } = actionCardSource();
  const wrong = [];
  const doneBadge = card.indexOf('bs-setup-step-badge is-done');
  const sharedPill = card.indexOf('bs-setup-step-badge is-neutral');
  const description = card.indexOf('bs-assistant-hub-card-text');
  const line = card.indexOf('bs-assistant-hub-card-shared');
  if (doneBadge < 0 || sharedPill < 0 || sharedPill < doneBadge) wrong.push('the Shared pill follows the Done badge');
  if (description < 0 || line < 0 || line < description) wrong.push('the line follows the description');
  if (!/is-done/.test(card) || !/✓/.test(card)) wrong.push('the done look (is-done, ✓) stays');
  assert(wrong.length === 0, wrong.join('; '));
});

/** #rrggbb or rgb()/rgba() → [r, g, b, a]. */
function parseColor(text) {
  const t = String(text || '').trim();
  let m = t.match(/^#([0-9a-f]{6})$/i);
  if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16), 1];
  m = t.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])];
  return null;
}
const over = ([r, g, b, a], [br, bg, bb]) => [r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a)];
function luminance([r, g, b]) {
  const lin = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
const contrast = (fg, bg) => { const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x); return (a + 0.05) / (b + 0.05); };
function ruleBody(css, selector) {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = css.match(new RegExp(`(?:^|[\\s,}])${esc}\\s*\\{([^}]*)\\}`));
  return m ? m[1] : null;
}
const prop = (body, name) => { const m = String(body || '').match(new RegExp(`(?:^|;|\\s)${name}\\s*:\\s*([^;]+);?`)); return m ? m[1].trim() : null; };
// The hub's dark page (.bsp-page's --bg-primary fallback) and its card's tint over it.
const PAGE_BG = [15, 15, 26];
const CARD_BG = over([255, 255, 255, 0.03], PAGE_BG);

test('D3: the CSS — one rule .bs-assistant-hub-card-shared fades by colour, not opacity, and reads at 4.5:1 or more on the card; the neutral pill it reuses is not green, not the amber of Needs attention, and reads at 4.5:1 or more (AC-2)', () => {
  const css = safeRead(STYLES);
  const wrong = [];
  const line = ruleBody(css, '.bs-assistant-hub-card-shared');
  if (!line) wrong.push('no .bs-assistant-hub-card-shared rule');
  else {
    if (/opacity\s*:/.test(line)) wrong.push('the line fades by colour, never opacity (a faded element would paint over the card-wide link)');
    const c = parseColor(prop(line, 'color'));
    if (!c) wrong.push(`the line's color is not a parseable colour: ${show(prop(line, 'color'))}`);
    else if (contrast(over(c, CARD_BG), CARD_BG) < 4.5) wrong.push(`the line reads at ${contrast(over(c, CARD_BG), CARD_BG).toFixed(2)}:1 on the card; want at least 4.5:1`);
  }
  const neutral = ruleBody(css, '.bs-setup-step-badge.is-neutral');
  const pillColor = parseColor(prop(neutral, 'color'));
  if (!pillColor) wrong.push('no .bs-setup-step-badge.is-neutral colour');
  else {
    const [r, g, b] = pillColor;
    if (g > r + 40 && g > b + 40) wrong.push(`the neutral pill is green (${prop(neutral, 'color')})`);
    const amber = parseColor(prop(ruleBody(css, '.bs-setup-step-badge'), 'color'));
    if (amber && sameJson(amber, pillColor)) wrong.push('the neutral pill has the Needs attention amber');
    const pillBg = parseColor(prop(neutral, 'background'));
    const behind = pillBg ? over(pillBg, CARD_BG) : CARD_BG;
    if (contrast(pillColor, behind) < 4.5) wrong.push(`the neutral pill reads at ${contrast(pillColor, behind).toFixed(2)}:1; want at least 4.5:1`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('D4: the separator and "Move it here →" stay together — both inside one span, .bs-assistant-hub-card-shared-move, whose CSS rule sets white-space: nowrap, so at phone width the link never wraps away from its "·" (the owner\'s Gate B verdict, 2026-10-11; AC-2)', () => {
  const { card } = actionCardSource();
  const css = safeRead(STYLES);
  const wrong = [];
  const at = card.indexOf('className="bs-assistant-hub-card-shared-move"');
  if (at < 0) wrong.push('no span with className "bs-assistant-hub-card-shared-move" on the card');
  else {
    const close = card.indexOf('</span>', card.indexOf('</Link>', at));
    const inner = close > at ? card.slice(at, close) : '';
    if (!/aria-hidden="true">\s*\{?\s*['"`]?\s*·/.test(inner)) wrong.push('the aria-hidden · is inside the nowrap span');
    if (!/<Link\s+to=\{MANAGE_TREASURE_MAP_PATH\}/.test(inner)) wrong.push('the move link is inside the nowrap span');
  }
  const rule = ruleBody(css, '.bs-assistant-hub-card-shared-move');
  if (!rule) wrong.push('no .bs-assistant-hub-card-shared-move rule');
  else if (prop(rule, 'white-space') !== 'nowrap') wrong.push(`.bs-assistant-hub-card-shared-move: want white-space: nowrap, got ${show(prop(rule, 'white-space'))}`);
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── S — the documents ───────────────────────── */

test('S1: openapi — the /api/assistant/attention description says a category given to another Assistant is done and carries shared (partly / entirely); the per-action schema has shared, nullable, enum [partly, entirely]; other-assistants-only is gone (AC-4)', () => {
  const api = safeRead(OPENAPI);
  const at = api.indexOf('/api/assistant/attention:');
  const next = at >= 0 ? api.indexOf(NL + '  /api/', at + 10) : -1;
  const block = at >= 0 ? api.slice(at, next > at ? next : at + 12000) : '';
  const wrong = [];
  if (!block) wrong.push('no /api/assistant/attention block');
  if (/other-assistants-only/.test(block)) wrong.push('the block still names other-assistants-only');
  if (!/`?shared`?/.test(block) || !/partly/.test(block) || !/entirely/.test(block)) wrong.push('the block does not describe shared (partly / entirely)');
  const schema = block.match(/^\s*shared:\s*\{([^}]*)\}/m);
  if (!schema) wrong.push('the per-action schema has no `shared: { … }` property');
  else {
    if (!/nullable:\s*true/.test(schema[1])) wrong.push('shared is nullable');
    if (!/enum:\s*\[\s*partly\s*,\s*entirely\s*\]/.test(schema[1])) wrong.push('shared has enum [partly, entirely]');
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('S2: BIBLE §11 — the /api/assistant/attention row says Scores, Lists and Concepts are done when given to any Assistant and carry shared (partly / entirely), without other-assistants-only; the Last updated line names this story (AC-4)', () => {
  const bible = safeRead(BIBLE);
  const lines = bible.split(NL);
  const row = lines.find((l) => l.includes('`/api/assistant/attention`') && l.trim().startsWith('|')) || '';
  const wrong = [];
  if (!row) wrong.push('no §11 row for /api/assistant/attention');
  if (/other-assistants-only/.test(row)) wrong.push('the row still names other-assistants-only');
  if (!/shared/.test(row) || !/partly/.test(row) || !/entirely/.test(row)) wrong.push('the row does not say shared (partly / entirely)');
  const updated = lines.find((l) => l.startsWith('**Last updated:**')) || '';
  if (!/assistant-shared-categories/.test(updated)) wrong.push('the Last updated line does not name assistant-shared-categories');
  assert(wrong.length === 0, wrong.join('; '));
});

test('S3: ADR assistant-trusted-content-status/0001 carries a "Superseded in part (2026-10-11)" line under its header, naming assistant-shared-categories and the retired "only others" row (Design note)', () => {
  const adr = safeRead(OLD_ADR);
  assert(adr, `${rel(OLD_ADR)} is missing`);
  const head = adr.split(NL).slice(0, 15).join(NL);
  const m = head.match(/^>\s*\*\*Superseded in part \(2026-10-11\):\*\*(.*)$/m);
  const wrong = [];
  if (!m) wrong.push('no "> **Superseded in part (2026-10-11):**" line in the first 15 lines');
  else {
    if (!/assistant-shared-categories/.test(m[1])) wrong.push('it does not name assistant-shared-categories');
    if (!/only others|other-assistants-only/.test(m[1])) wrong.push('it does not name the retired row');
    if (!/shared/.test(m[1])) wrong.push('it does not say the answer gains shared');
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('S4 (sentinel): this story stays read-only and session-shaped — the check still writes nothing, reads no request field, and the handler still hands it the session\'s viewer and their own Assistant (AC-5)', () => {
  const code = codeOnly(safeRead(CHECK_MODULE));
  const wrong = [];
  if (/publishToRelays|signEvent|finalizeEvent|writeFile|child_process/.test(code)) wrong.push('the check writes, signs or spawns');
  if (/req\.(query|body|params)/.test(code)) wrong.push('the check reads the request');
  const att = codeOnly(safeRead(ATTENTION_MODULE));
  if (!/checkTrustedContent\(\s*\{\s*viewer\s*,\s*assistantPubkey\s*\}/.test(att)) wrong.push('the handler no longer passes { viewer, assistantPubkey } from the session');
  assert(wrong.length === 0, wrong.join('; '));
});

async function run() {
  console.log(`${NL}=== assistant-shared-categories (assistant-shared-categories #1) ===`);
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`  PASS  ${name}`);
      pass++;
    } catch (err) {
      console.log(`  FAIL  ${name}${NL}        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`${NL}assistant-shared-categories: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

module.exports = { run };

if (require.main === module) {
  run().then((r) => process.exit(r.fail ? 1 : 0));
}
