'use strict';
/**
 * assistant-trusted-content-status #1: Scores, Lists and Concepts on the hub — renamed to the Treasure Map's categories,
 * each Done when the viewer's Treasure Map gives it to their Tapestry Assistant on this instance.
 *
 * Story: engineering-team/stories/assistant-trusted-content-status/1-scores-lists-and-concepts-on-the-hub.md
 * ADR:   engineering-team/decisions/assistant-trusted-content-status/0001-scores-lists-and-concepts-join-the-one-attention-answer.md
 * Plan:  engineering-team/stories/assistant-trusted-content-status/1-scores-lists-and-concepts-on-the-hub.test-plan.md
 * Browser half: tests/brainstorm/assistant-trusted-content.spec.js, and SV17 in tests/brainstorm/treasure-map-save.spec.js.
 * Expected words and answer shapes: test/helpers/trustedContentFixtures.js.
 *
 * Classes:
 *   R — the category rule's one home, src/lib/treasureMapCategories.mjs: import-free, loadable by both sides, and the very
 *       functions the Treasure Map page exports (ADR 0001 sub-decision 1).                                  [AC-3]
 *   U — checkTrustedContent / evaluateTrustedContent in src/api/assistant/trustedContent.js, driven through injected
 *       dependencies (scanLocal, readRelay, getConfigFromFile, mapDefaultRelays, loadCategoryRule). Stack-free.  [AC-2…AC-4]
 *   A — the attention handler: the three keys in the one answer, isolated, session-shaped (sub-decision 6).  [AC-2]
 *   C — the hub's pure readings in ui/src/pages/assistant/actions.js, loaded in Node: CHECKED_ACTIONS, the two
 *       readings and `done`, and the three entries' words.                                             [AC-1, AC-5]
 *   D — source sentinels on the files this runner cannot execute (JSX, CSS): the provider's re-check after a Map save
 *       and the hub's Done look.                                                                        [AC-5, AC-6]
 *   S — source sentinels on the server and the documents: read-only, session-only, /setup's Map read reused, no TA
 *       literal; openapi and BIBLE say what is true.                                                         [AC-2]
 *
 * Everything here FAILS against the code before this story: src/lib/treasureMapCategories.mjs and
 * src/api/assistant/trustedContent.js do not exist, the attention answer has no Scores/Lists/Concepts, the three cards
 * are placeholders titled Trusted Assertions, Trusted Lists and Decentralized Lists, and the provider re-checks only
 * after a tagging.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const TC = require('./helpers/trustedContentFixtures');
const AM = require('./helpers/assistantManagementFixtures');

const REPO = path.resolve(__dirname, '..');
const RULE = path.join(REPO, 'src/lib/treasureMapCategories.mjs');
const CHECK_MODULE = path.join(REPO, 'src/api/assistant/trustedContent.js');
const ATTENTION_MODULE = path.join(REPO, 'src/api/assistant/attention.js');
const MTM = path.join(REPO, 'ui/src/pages/treasure-map/manageTreasureMap.js');
const ACTIONS_MOD = path.join(REPO, 'ui/src/pages/assistant/actions.js');
const UI_UTIL = path.join(REPO, 'ui/src/utils/assistantAttention.js');
const PROVIDER = path.join(REPO, 'ui/src/context/AssistantAttentionContext.jsx');
const HUB_PAGE = path.join(REPO, 'ui/src/pages/assistant/Index.jsx');
const STYLES = path.join(REPO, 'ui/src/styles.css');
const OPENAPI = path.join(REPO, 'src/api/openapi.yaml');
const BIBLE = path.join(REPO, 'BIBLE.md');
const NL = String.fromCharCode(10);

// Fixture keys, never live ones.
const VIEWER = 'a1'.repeat(32);
const ASSISTANT = 'a2'.repeat(32);
const OTHER = 'b2'.repeat(32);
const THIRD = 'b3'.repeat(32);
const STRANGER = 'dd'.repeat(32);
const LEGACY_TA = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';

// Fixture relays: two outside, and this instance's own (never an outside relay).
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
    .split(NL)
    .map((line) => line.replace(/(^|[^:'"`\\])\/\/.*$/, '$1'))
    .join(NL);
}

/* ───────────────────────── fixtures: events ───────────────────────── */

let idSeq = 0;
const hexId = (n) => n.toString(16).padStart(64, '0');

/** A Treasure Map (kind 10040) by `pubkey` (the viewer by default) with these tags. */
function mapEv(tags, { createdAt = 1000, pubkey = VIEWER, id } = {}) {
  idSeq += 1;
  return { id: id || hexId(idSeq), pubkey, kind: 10040, created_at: createdAt, tags, content: '', sig: '0'.repeat(128) };
}

/** What a relay answers a filter with: the events matching its kinds and authors. */
function matching(events, filter) {
  const kinds = Array.isArray(filter && filter.kinds) ? filter.kinds : null;
  const authors = Array.isArray(filter && filter.authors) ? filter.authors.map((a) => String(a).toLowerCase()) : null;
  return events.filter((e) => (!kinds || kinds.includes(e.kind)) && (!authors || authors.includes(String(e.pubkey).toLowerCase())));
}

/* ───────────────────────── the modules under test ───────────────────────── */

function fresh(abs, what) {
  if (!fs.existsSync(abs)) throw new Error(`${rel(abs)} does not exist. ${what}`);
  delete require.cache[require.resolve(abs)];
  return require(abs);
}
const checkModule = () => fresh(CHECK_MODULE, 'ADR 0001 sub-decision 5 creates it: checkTrustedContent({ viewer, assistantPubkey }, deps), ' +
  'evaluateTrustedContent({ lookup, assistantPubkey, assignments }), loadCategoryRule(), TRUSTED_CONTENT_ACTIONS.');
const attentionModule = () => fresh(ATTENTION_MODULE, 'It answers GET /api/assistant/attention (ADR assistant-identification-tags/0001).');
function need(mod, name, file) {
  assert(typeof mod[name] === 'function', `${file} must export ${name}() (ADR 0001 § Implementation notes).`);
  return mod[name];
}

async function loadEsm(absPath) {
  try { return await import(pathToFileURL(absPath).href); } catch (err) { return { __loadError: err }; }
}
async function esm(absPath, what) {
  assert(fs.existsSync(absPath), `${rel(absPath)} does not exist. ${what}`);
  const mod = await loadEsm(absPath);
  assert(!mod.__loadError, `${rel(absPath)} must load in Node as an ES module: ${mod.__loadError && mod.__loadError.message}`);
  return mod;
}
const ruleModule = () => esm(RULE, 'ADR 0001 sub-decision 1 creates it: the Treasure Map page\'s category rule, moved, with no imports.');
const actionsModule = () => esm(ACTIONS_MOD, 'It holds ASSISTANT_ACTIONS, CHECKED_ACTIONS and assistantAttention.');
const uiUtil = () => esm(UI_UTIL, 'It holds summarizeAttention (ADR assistant-identification-tags/0001).');

/**
 * The injected dependencies of checkTrustedContent, under the names ADR 0001 gives them. Every one RECORDS its calls.
 *   local     — the events this instance's relay holds (an array), 'reject' (the scan fails), or a function of the filter.
 *   relays    — { [url]: events | 'unreachable' | 'throw' }; an unlisted relay is unreachable.
 *   mapRelays — what mapDefaultRelays answers (the server's Map list); default [ONE, TWO, OWN].
 *   config    — getConfigFromFile's values; BRAINSTORM_RELAY_URL defaults to OWN.
 *   rule      — a loadCategoryRule to use instead of the module's own (e.g. one that rejects).
 */
function checkFakes(opts = {}) {
  const calls = { scanLocal: [], readRelay: [], loadCategoryRule: 0 };
  const config = { BRAINSTORM_RELAY_URL: OWN, ...(opts.config || {}) };
  const deps = {
    scanLocal: async (filter) => {
      calls.scanLocal.push(filter);
      if (opts.local === 'reject') throw new Error('fixture: strfry scan failed');
      if (typeof opts.local === 'function') return opts.local(filter);
      return matching(Array.isArray(opts.local) ? opts.local : [], filter);
    },
    readRelay: async (url, filter) => {
      calls.readRelay.push({ url, filter });
      const answer = opts.relays ? opts.relays[url] : undefined;
      if (answer === 'throw') throw new Error('fixture: the relay read threw');
      if (!Array.isArray(answer)) return { status: 'unreachable', events: [], error: 'fixture: unreachable' };
      return { status: 'ok', events: matching(answer, filter), error: null };
    },
    getConfigFromFile: (key, dflt) => (Object.prototype.hasOwnProperty.call(config, key) ? config[key] : dflt),
    mapDefaultRelays: () => (opts.mapRelays || [ONE, TWO, OWN]).slice(),
    loadCategoryRule: async () => {
      calls.loadCategoryRule += 1;
      if (opts.rule) return opts.rule();
      return need(checkModule(), 'loadCategoryRule', 'src/api/assistant/trustedContent.js')();
    },
  };
  return { deps, calls };
}

/** Run the check for the fixture viewer and their Assistant. */
async function check(opts = {}, who = { viewer: VIEWER, assistantPubkey: ASSISTANT }) {
  const run = need(checkModule(), 'checkTrustedContent', 'src/api/assistant/trustedContent.js');
  const { deps, calls } = checkFakes(opts);
  const out = await run(who, deps);
  return { out, calls };
}

/** Compare the three answers with `want` ({ key: value }), collecting each difference. */
function trioDiff(label, out, want) {
  const wrong = [];
  for (const key of TC.KEYS) {
    const got = out && out[key];
    if (!sameJson(got, want[key])) wrong.push(`${label} — ${key}: want ${show(want[key])}, got ${show(got)}`);
  }
  return wrong;
}
const byCategory = (make) => TC.trio(make);

/* ───────────────────────── R — the rule's one home ───────────────────────── */

test('R1: src/lib/treasureMapCategories.mjs exists, has no import or require of any kind and touches no browser or Node global, and exports TREASURE_MAP_CATEGORIES = ["scores","lists","concepts"], entryOf, appliesTo, categoryEntries and categoryAssistants (ADR 0001 sub-decision 1)', async () => {
  const src = safeRead(RULE);
  assert(src, `${rel(RULE)} does not exist. ADR 0001 sub-decision 1 moves the Treasure Map page's category rule there.`);
  const code = codeOnly(src);
  const wrong = [];
  if (/^\s*import[\s{*'"]/m.test(code)) wrong.push('an import statement');
  if (/\bimport\s*\(/.test(code)) wrong.push('a dynamic import()');
  if (/\brequire\s*\(/.test(code)) wrong.push('a require()');
  if (/^\s*export\s+[^;]*\bfrom\s*['"]/m.test(code)) wrong.push('an export … from');
  for (const g of ['window', 'document', 'process', 'globalThis', 'localStorage', 'fetch', 'Buffer']) {
    if (new RegExp(`\\b${g}\\b`).test(code)) wrong.push(`a reference to ${g}`);
  }
  assert(wrong.length === 0, `the rule module must stay import-free and environment-free, so the server and the browser both load it as it is; found: ${wrong.join(', ')}`);
  const mod = await ruleModule();
  assert(sameJson(mod.TREASURE_MAP_CATEGORIES, ['scores', 'lists', 'concepts']), `TREASURE_MAP_CATEGORIES: want ["scores","lists","concepts"], got ${show(mod.TREASURE_MAP_CATEGORIES)}`);
  const missing = ['entryOf', 'appliesTo', 'categoryEntries', 'categoryAssistants'].filter((n) => typeof mod[n] !== 'function');
  assert(missing.length === 0, `the rule module must export ${missing.join(', ')}`);
});

test('R2: the Treasure Map page exports the very same functions — one rule, not a copy — and defines none of them itself (ADR 0001 sub-decision 1)', async () => {
  const rule = await ruleModule();
  const page = await esm(MTM, 'It is the Treasure Map page\'s words and rules.');
  const wrong = [];
  for (const n of ['entryOf', 'appliesTo', 'categoryEntries', 'categoryAssistants']) {
    if (page[n] !== rule[n]) wrong.push(`${n} is not the rule module's own function`);
  }
  const code = codeOnly(safeRead(MTM));
  for (const n of ['entryOf', 'appliesTo', 'shadowed', 'categoryEntries', 'categoryAssistants']) {
    if (new RegExp(`function\\s+${n}\\s*\\(`).test(code)) wrong.push(`manageTreasureMap.js still defines ${n}()`);
  }
  if (!/from\s*['"](\.\.\/)+src\/lib\/treasureMapCategories\.mjs['"]/.test(code)) wrong.push('manageTreasureMap.js does not import src/lib/treasureMapCategories.mjs by relative path');
  assert(wrong.length === 0, wrong.join('; '));
});

test('R3: the moved rule reads a Map as the cards always have — first delegate per key, any spelling, a hidden `*`, and a `*:…` ignored (regression: behaviour unchanged by the move)', async () => {
  const { categoryAssistants } = await ruleModule();
  const map = mapEv([
    ['30382:rank', OTHER, R], ['30382:rank', ASSISTANT, R], // backup ignored
    ['3038x:tag:', THIRD, R],
    ['*', ASSISTANT, R], ['3039x', OTHER, R], // * hidden for Lists only
    ['*:tag', THIRD, R], // never counts
    ['39999:restaurants', OTHER, R],
  ]);
  const got = categoryAssistants(map);
  const want = { scores: [OTHER, THIRD, ASSISTANT], lists: [OTHER], concepts: [ASSISTANT, OTHER] };
  assert(sameJson(got, want), `categoryAssistants: want ${show(want)}, got ${show(got)}`);
});

/* ───────────────────────── U — the server check ───────────────────────── */

test('U1: a Map on this instance\'s relay — Scores to the viewer\'s Assistant only is done; Lists given to nobody is not-assigned; Concepts given only to another Assistant is other-assistants-only; all finished, source local; no outside relay is read (AC-3, AC-4)', async () => {
  const { out, calls } = await check({ local: [mapEv([['30382:rank', ASSISTANT, R], ['30382:followers', ASSISTANT, R], ['39998:dlist-header', OTHER, R]])] });
  const want = {
    'trusted-assertions': TC.done('scores', 'local'),
    'trusted-lists': TC.pending('lists', 'not-assigned', 'local'),
    dlists: TC.pending('concepts', 'other-assistants-only', 'local'),
  };
  const wrong = trioDiff('local Map', out, want);
  if (calls.readRelay.length !== 0) wrong.push(`a local hit asks no outside relay; asked ${show(calls.readRelay.map((c) => c.url))}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('U2: Mixed is done — the viewer\'s Assistant beside another, in every category and spelling (30382/30392/3039x:tag/39998:dlist-header/39999:<d>) (AC-3)', async () => {
  const { out } = await check({ local: [mapEv([
    ['30382:rank', OTHER, R], ['30382:followers', ASSISTANT, R],
    ['30392', OTHER, R], ['3039x:tag:X1', ASSISTANT, R],
    ['39998:dlist-header', OTHER, R], ['39999:restaurants', ASSISTANT, R],
  ])] });
  const wrong = trioDiff('Mixed', out, byCategory((c) => TC.done(c, 'local')));
  assert(wrong.length === 0, wrong.join('; '));
});

test('U3: the all-duties `*` — `*` to the viewer\'s Assistant and nothing else makes all three done; a bare `3038x` to another Assistant hides it for Scores only; a `*:tag` never counts (AC-3)', async () => {
  const wrong = [];
  const all = await check({ local: [mapEv([['*', ASSISTANT, R]])] });
  wrong.push(...trioDiff('* only', all.out, byCategory((c) => TC.done(c, 'local'))));
  const hidden = await check({ local: [mapEv([['*', ASSISTANT, R], ['3038x', OTHER, R]])] });
  wrong.push(...trioDiff('* hidden for Scores', hidden.out, {
    'trusted-assertions': TC.pending('scores', 'other-assistants-only', 'local'),
    'trusted-lists': TC.done('lists', 'local'),
    dlists: TC.done('concepts', 'local'),
  }));
  const scoped = await check({ local: [mapEv([['*:tag', ASSISTANT, R]])] });
  wrong.push(...trioDiff('*:tag', scoped.out, byCategory((c) => TC.pending(c, 'not-assigned', 'local'))));
  assert(wrong.length === 0, wrong.join('; '));
});

test('U4: a backup does not count — the viewer\'s Assistant named only after another for every Scores key is other-assistants-only, as the card shows only the first (ADR 0001 sub-decision 2)', async () => {
  const { out } = await check({ local: [mapEv([['30382:rank', OTHER, R], ['30382:rank', ASSISTANT, R]])] });
  const s = out && out['trusted-assertions'];
  assert(sameJson(s, TC.pending('scores', 'other-assistants-only', 'local')), `want ${show(TC.pending('scores', 'other-assistants-only', 'local'))}, got ${show(s)}`);
});

test('U5: pubkeys compare case-blind, and an entry with no valid 64-hex delegate counts for nobody (AC-3)', async () => {
  const wrong = [];
  const upper = await check({ local: [mapEv([['30382:rank', ASSISTANT.toUpperCase(), R]])] });
  if (!sameJson(upper.out && upper.out['trusted-assertions'], TC.done('scores', 'local'))) wrong.push(`an upper-case delegate: got ${show(upper.out && upper.out['trusted-assertions'])}`);
  const junk = await check({ local: [mapEv([['30382:rank', 'not-a-pubkey', R], ['30392', ASSISTANT.slice(2), R], ['39998:dlist-header'], 'junk'])] });
  wrong.push(...trioDiff('junk entries', junk.out, byCategory((c) => TC.pending(c, 'not-assigned', 'local'))));
  assert(wrong.length === 0, wrong.join('; '));
});

test('U6: no Map anywhere — this instance\'s relay holds none and an outside relay answered with none: all three finished, pending, reason no-map, source null (AC-3, AC-4)', async () => {
  const { out, calls } = await check({ local: [], relays: { [ONE]: [], [TWO]: 'unreachable' } });
  const wrong = trioDiff('no Map', out, byCategory((c) => TC.pending(c, 'no-map')));
  if (calls.readRelay.length === 0) wrong.push('a local miss must ask the outside relays');
  assert(wrong.length === 0, wrong.join('; '));
});

test('U7: a Map only outside — the outside relays are asked for the viewer\'s 10040 only, this instance\'s own relay is not one of them, the newest Map found wins, and the source is relay (AC-2, AC-4)', async () => {
  const older = mapEv([['30382:rank', OTHER, R]], { createdAt: 1000 });
  const newer = mapEv([['30382:rank', ASSISTANT, R]], { createdAt: 2000 });
  const { out, calls } = await check({ local: [], relays: { [ONE]: [older], [TWO]: [newer], [OWN]: [older] } });
  const wrong = [];
  if (!sameJson(out && out['trusted-assertions'], TC.done('scores', 'relay'))) wrong.push(`Scores from the newer outside Map: got ${show(out && out['trusted-assertions'])}`);
  const asked = calls.readRelay.map((c) => c.url).sort();
  if (!sameJson(asked, [ONE, TWO].sort())) wrong.push(`asked ${show(asked)}; want the two outside relays only, never this instance's own (${OWN})`);
  for (const { filter } of calls.readRelay) {
    if (!sameJson(filter && filter.kinds, [10040]) || !sameJson(filter && filter.authors, [VIEWER])) wrong.push(`an outside read for anything but the viewer's 10040: ${show(filter)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('U8: whose Map — the local scan asks for the viewer\'s 10040 only, and a Map by anyone else (the Assistant, a stranger) never counts, even when a relay hands it back (AC-2)', async () => {
  const notTheViewers = [mapEv([['*', ASSISTANT, R]], { pubkey: ASSISTANT }), mapEv([['*', ASSISTANT, R]], { pubkey: STRANGER })];
  const { out, calls } = await check({ local: () => notTheViewers, relays: { [ONE]: [], [TWO]: [] } });
  const wrong = trioDiff('only others\' Maps', out, byCategory((c) => TC.pending(c, 'no-map')));
  const f = calls.scanLocal[0];
  if (!sameJson(f && f.kinds, [10040]) || !sameJson(f && f.authors, [VIEWER])) wrong.push(`the local scan: want { kinds: [10040], authors: [viewer] }, got ${show(f)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('U9: the newest of the viewer\'s Maps on this instance\'s relay decides (AC-2)', async () => {
  const { out } = await check({ local: [mapEv([['30392', ASSISTANT, R]], { createdAt: 3000 }), mapEv([['30392', OTHER, R]], { createdAt: 1000 })] });
  assert(sameJson(out && out['trusted-lists'], TC.done('lists', 'local')), `want the newer Map's answer, got ${show(out && out['trusted-lists'])}`);
});

test('U10: unfinished, with a reason, neither done nor pending — this instance\'s relay unreadable (and then no outside relay is asked); no outside relay configured; every outside relay unreachable (AC-4)', async () => {
  const wrong = [];
  const unreadable = await check({ local: 'reject', relays: { [ONE]: [mapEv([['*', ASSISTANT, R]])] } });
  wrong.push(...trioDiff('local unreadable', unreadable.out, byCategory((c) => TC.unfinished(c, 'local-unreadable'))));
  if (unreadable.calls.readRelay.length !== 0) wrong.push('an unreadable local relay must not fall through to the outside relays');
  const none = await check({ local: [], mapRelays: [OWN, 'ws://127.0.0.1:7777'] });
  wrong.push(...trioDiff('no outside relays', none.out, byCategory((c) => TC.unfinished(c, 'no-outside-relays'))));
  const down = await check({ local: [], relays: { [ONE]: 'unreachable', [TWO]: 'throw' } });
  wrong.push(...trioDiff('all unreachable', down.out, byCategory((c) => TC.unfinished(c, 'outside-unreachable'))));
  assert(wrong.length === 0, wrong.join('; '));
});

test('U11: evaluateTrustedContent is the table of ADR 0001 sub-decision 4 — pure, for any lookup and assignments', () => {
  const evaluate = need(checkModule(), 'evaluateTrustedContent', 'src/api/assistant/trustedContent.js');
  const map = mapEv([]);
  const wrong = [];
  const cases = [
    ['unfinished', { lookup: { finished: false, reason: 'no-outside-relays' }, assignments: null }, byCategory((c) => TC.unfinished(c, 'no-outside-relays'))],
    ['no Map', { lookup: { finished: true, event: null, source: null }, assignments: null }, byCategory((c) => TC.pending(c, 'no-map'))],
    ['assigned', {
      lookup: { finished: true, event: map, source: 'relay' },
      assignments: { scores: [ASSISTANT], lists: [OTHER, ASSISTANT], concepts: [] },
    }, {
      'trusted-assertions': TC.done('scores', 'relay'),
      'trusted-lists': TC.done('lists', 'relay'),
      dlists: TC.pending('concepts', 'not-assigned', 'relay'),
    }],
    ['others only', {
      lookup: { finished: true, event: map, source: 'local' },
      assignments: { scores: [OTHER], lists: [OTHER, THIRD], concepts: [THIRD] },
    }, byCategory((c) => TC.pending(c, 'other-assistants-only', 'local'))],
  ];
  for (const [label, input, want] of cases) {
    const got = evaluate({ ...input, assistantPubkey: ASSISTANT });
    wrong.push(...trioDiff(label, got, want));
    if (got && Object.keys(got).sort().join() !== [...TC.KEYS].sort().join()) wrong.push(`${label}: exactly the three keys, got ${show(Object.keys(got || {}))}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('U12: the answer carries exactly the three keys, each exactly { category, finished, done, pending, reason, source }, and no viewer or Assistant pubkey (AC-2)', async () => {
  const { out } = await check({ local: [mapEv([['*', ASSISTANT, R], ['30382:rank', OTHER, R]])] });
  const wrong = [];
  if (!out || Object.keys(out).sort().join() !== [...TC.KEYS].sort().join()) wrong.push(`keys: want ${show(TC.KEYS)}, got ${show(out && Object.keys(out))}`);
  for (const key of TC.KEYS) {
    const v = out && out[key];
    if (!v || Object.keys(v).sort().join() !== ['category', 'done', 'finished', 'pending', 'reason', 'source'].join()) wrong.push(`${key}: fields ${show(v && Object.keys(v))}`);
  }
  const text = show(out).toLowerCase();
  for (const [who, pk] of [['viewer', VIEWER], ['assistant', ASSISTANT], ['other', OTHER]]) if (text.includes(pk)) wrong.push(`the answer names the ${who}'s pubkey`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('U13: loadCategoryRule loads the one rule — the module\'s own categoryAssistants, by identity — and a rule that cannot load makes the check reject, so the handler can isolate it (ADR 0001 sub-decisions 5–6)', async () => {
  const load = need(checkModule(), 'loadCategoryRule', 'src/api/assistant/trustedContent.js');
  const loaded = await load();
  const rule = await ruleModule();
  assert(loaded && loaded.categoryAssistants === rule.categoryAssistants, 'loadCategoryRule() must resolve to src/lib/treasureMapCategories.mjs itself');
  let threw = null;
  try {
    await check({ local: [mapEv([['*', ASSISTANT, R]])], rule: async () => { throw new Error('fixture: the rule did not load'); } });
  } catch (err) { threw = err; }
  assert(threw, 'checkTrustedContent must reject when the rule cannot be loaded (sub-decision 6 turns that into check-failed)');
});

test('U14: TRUSTED_CONTENT_ACTIONS maps the actions\' existing keys to the Treasure Map\'s categories (ADR 0001 sub-decision 4)', () => {
  const mod = checkModule();
  const want = { 'trusted-assertions': 'scores', 'trusted-lists': 'lists', dlists: 'concepts' };
  assert(sameJson(mod.TRUSTED_CONTENT_ACTIONS, want), `want ${show(want)}, got ${show(mod.TRUSTED_CONTENT_ACTIONS)}`);
});

/* ───────────────────────── A — the attention handler ───────────────────────── */

function attentionFakes({ assistant = ASSISTANT, trustedContent, local = [], mapRelays = [ONE] } = {}) {
  const calls = { checkTrustedContent: [] };
  const deps = {
    getAssistantPubkeyFor: async () => assistant,
    scanLocal: async (filter) => matching(local, filter),
    readRelay: async () => ({ status: 'unreachable', events: [], error: 'fixture' }),
    readConfiguredRelays: () => [],
    getConfigFromFile: (k, d) => (k === 'BRAINSTORM_RELAY_URL' ? OWN : d),
    mapDefaultRelays: () => mapRelays.slice(),
    // Another book's check (assistant-profile-checklist ADR 0001), stubbed whether or not it has landed.
    checkProfile: async () => ({ finished: true, done: true, pending: false, items: [] }),
  };
  if (trustedContent !== 'default') {
    deps.checkTrustedContent = async (input) => {
      calls.checkTrustedContent.push(input);
      if (trustedContent === 'reject') throw new Error('fixture: the trusted-content check exploded');
      return trustedContent || TC.trio((c) => TC.done(c));
    };
  }
  return { deps, calls };
}
function fakeRes() {
  const res = { statusCode: 200, body: undefined };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}
const signedInReq = () => ({ session: { authenticated: true, pubkey: VIEWER }, query: { pubkey: STRANGER, viewer: STRANGER, assistantPubkey: STRANGER } });
async function handle(req, deps) {
  const res = fakeRes();
  const log = console.error; const warn = console.warn;
  console.error = () => {}; console.warn = () => {};
  try { await need(attentionModule(), 'handleAssistantAttention', 'src/api/assistant/attention.js')(req, res, deps); } finally { console.error = log; console.warn = warn; }
  return res;
}

test('A1: the one answer carries Scores, Lists and Concepts under their action keys, from checkTrustedContent run once for the session\'s viewer and their own Assistant — no request parameter changes whose (AC-2; ADR 0001 sub-decision 6)', async () => {
  const answer = { 'trusted-assertions': TC.done('scores'), 'trusted-lists': TC.pending('lists', 'not-assigned', 'local'), dlists: TC.unfinished('concepts') };
  const { deps, calls } = attentionFakes({ trustedContent: answer });
  const res = await handle(signedInReq(), deps);
  const actions = (res.body && res.body.actions) || {};
  const wrong = [];
  if (res.statusCode !== 200) wrong.push(`status ${res.statusCode}`);
  if (!actions['identification-tags']) wrong.push('identification-tags is still answered');
  wrong.push(...trioDiff('the handler', actions, answer));
  const c = calls.checkTrustedContent;
  if (c.length !== 1 || !c[0] || c[0].viewer !== VIEWER || c[0].assistantPubkey !== ASSISTANT) wrong.push(`checkTrustedContent called once with { viewer: <session>, assistantPubkey: <their Assistant> }; got ${show(c)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('A2: a trusted-content check that throws does not take the other answers with it — 200, identification-tags intact, and each of the three { category, finished: false, done: false, pending: false, reason: "check-failed", source: null } (ADR 0001 sub-decision 6)', async () => {
  const { deps } = attentionFakes({ trustedContent: 'reject' });
  const res = await handle(signedInReq(), deps);
  const actions = (res.body && res.body.actions) || {};
  assert(res.statusCode === 200 && actions['identification-tags'], `want 200 with identification-tags; got ${res.statusCode} ${show(res.body)}`);
  const wrong = trioDiff('check-failed', actions, TC.trio((c) => TC.checkFailed(c)));
  assert(wrong.length === 0, wrong.join('; '));
});

test('A3: a visitor, and a viewer with no Assistant here, get none of the three and no check runs; attention.js offers checkTrustedContent as a default dependency (AC-2)', async () => {
  const wrong = [];
  const visitor = attentionFakes();
  const res1 = await handle({ session: {}, query: {} }, visitor.deps);
  if (!sameJson(res1.body, { success: true, signedIn: false })) wrong.push(`visitor: got ${show(res1.body)}`);
  const none = attentionFakes({ assistant: null });
  const res2 = await handle(signedInReq(), none.deps);
  if (!sameJson(res2.body, { success: true, signedIn: true, hasAssistant: false, actions: {} })) wrong.push(`no assistant: got ${show(res2.body)}`);
  if (visitor.calls.checkTrustedContent.length + none.calls.checkTrustedContent.length > 0) wrong.push('checkTrustedContent must not run for them');
  if (!/checkTrustedContent/.test(codeOnly(safeRead(ATTENTION_MODULE)))) wrong.push('src/api/assistant/attention.js has no checkTrustedContent dependency');
  assert(wrong.length === 0, wrong.join('; '));
});

test('A4: wired end to end — with the real check and its real rule loader, a Map on this instance\'s relay giving everything (`*`) to the viewer\'s Assistant answers all three done (ADR 0001 § Implementation notes 4)', async () => {
  const { deps } = attentionFakes({ trustedContent: 'default', local: [mapEv([['*', ASSISTANT, R]])] });
  const res = await handle(signedInReq(), deps);
  const actions = (res.body && res.body.actions) || {};
  const wrong = trioDiff('end to end', actions, TC.trio((c) => TC.done(c, 'local')));
  assert(res.statusCode === 200 && wrong.length === 0, `status ${res.statusCode}; ${wrong.join('; ')}`);
});

/* ───────────────────────── C — the hub's readings and words ───────────────────────── */

const USER = { pubkey: 'cc'.repeat(32), classification: 'customer', assistantPubkey: 'c1'.repeat(32) };
const ID_DONE = { finished: true, done: true, pending: false, taggings: [] };
const answerWith = (actions) => ({ success: true, signedIn: true, hasAssistant: true, actions: { 'identification-tags': ID_DONE, ...actions } });

test('C1: CHECKED_ACTIONS includes trusted-assertions, trusted-lists and dlists, every checked key is a real action, and the list follows ASSISTANT_ACTIONS order (ADR 0001 sub-decision 7)', async () => {
  const mod = await actionsModule();
  const keys = mod.ASSISTANT_ACTIONS.map((a) => a.key);
  const checked = Array.isArray(mod.CHECKED_ACTIONS) ? mod.CHECKED_ACTIONS : [];
  const wrong = [];
  for (const k of TC.KEYS) if (!checked.includes(k)) wrong.push(`missing ${k}`);
  if (!checked.every((k) => keys.includes(k))) wrong.push('a checked key that is not an action');
  const inOrder = keys.filter((k) => checked.includes(k));
  if (!sameJson(checked, inOrder)) wrong.push(`order: want ${show(inOrder)}, got ${show(checked)}`);
  assert(wrong.length === 0, `CHECKED_ACTIONS ${show(checked)}: ${wrong.join('; ')}`);
});

test('C2: the two readings for each of the three — no answer, checking, failed, unfinished (each reason) and check-failed mark it but the pill does not count it; pending (each reason) marks and counts; done unmarks, uncounts and lists it in `done`; the count line is the marks (AC-5)', async () => {
  const mod = await actionsModule();
  const summarize = (await uiUtil()).summarizeAttention;
  const all = mod.ASSISTANT_ACTIONS.map((a) => a.key);
  const checked = mod.CHECKED_ACTIONS || [];
  const placeholders = all.filter((k) => !checked.includes(k)).length;
  const cases = [['no answer', undefined, 'marked'], ['checking', { phase: 'checking', answered: false, actions: {} }, 'marked'], ['failed', summarize(null), 'marked']];
  for (const r of TC.REASONS.unfinished) cases.push([`unfinished (${r})`, summarize(answerWith(TC.trio((c) => TC.unfinished(c, r)))), 'marked']);
  for (const r of TC.REASONS.finished) cases.push([`pending (${r})`, summarize(answerWith(TC.trio((c) => TC.pending(c, r)))), 'counted']);
  cases.push(['done', summarize(answerWith(TC.trio((c) => TC.done(c)))), 'done']);
  const wrong = [];
  for (const [label, att, state] of cases) {
    const got = att === undefined ? mod.assistantAttention(USER) : mod.assistantAttention(USER, att);
    const doneList = Array.isArray(got.done) ? got.done : null;
    if (!doneList) { wrong.push(`${label}: assistantAttention must answer done: string[]`); continue; }
    for (const key of TC.KEYS) {
      const isMarked = got.needsAttention.includes(key);
      const isDone = doneList.includes(key);
      if (isMarked !== (state !== 'done')) wrong.push(`${label}: ${key} marked want ${state !== 'done'}, got ${isMarked}`);
      if (isDone !== (state === 'done')) wrong.push(`${label}: ${key} in done want ${state === 'done'}, got ${isDone}`);
    }
    if (got.count !== got.needsAttention.length) wrong.push(`${label}: the count is the marks`);
    const answers = (att && att.answered && att.actions) || {};
    const checkedPending = checked.filter((k) => answers[k] && answers[k].pending === true).length;
    const wantAlert = placeholders + checkedPending;
    if (got.alertCount !== wantAlert) wrong.push(`${label}: alertCount want ${placeholders} placeholders + ${checkedPending} pending checked = ${wantAlert}, got ${got.alertCount}`);
    if (state === 'counted' && checkedPending < 3) wrong.push(`${label}: the three pending must be counted`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('C3: nothing for a visitor or a viewer with no Assistant — no marks, nothing done, no pill — whatever the answer says (AC-5)', async () => {
  const mod = await actionsModule();
  const summarize = (await uiUtil()).summarizeAttention;
  const wrong = [];
  for (const who of [null, { pubkey: 'ee'.repeat(32), classification: 'guest', assistantPubkey: null }]) {
    const r = mod.assistantAttention(who, summarize(answerWith(TC.trio((c) => TC.done(c)))));
    const shaped = { needsAttention: r.needsAttention, count: r.count, alertCount: r.alertCount, done: r.done };
    if (!sameJson(shaped, { needsAttention: [], count: 0, alertCount: 0, done: [] })) wrong.push(`${who ? 'no assistant' : 'visitor'}: got ${show(shaped)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('C4: the three entries — first in Publication of Trusted Content, titled Scores, Lists, Concepts, before Bounties, Pins and Tags; keys, addresses, descriptions and NIP links unchanged; the rule as alert criteria; and the one link to /treasure-map (AC-1)', async () => {
  const mod = await actionsModule();
  const section = mod.ASSISTANT_ACTIONS.filter((a) => a.section === 'trusted-content');
  const wrong = [];
  const wantOrder = ['trusted-assertions', 'trusted-lists', 'dlists', 'bounties', 'pins', 'tags'];
  if (!sameJson(section.map((a) => a.key), wantOrder)) wrong.push(`section order: want ${show(wantOrder)}, got ${show(section.map((a) => a.key))}`);
  for (const card of TC.CARDS) {
    const got = mod.ASSISTANT_ACTIONS.find((a) => a.key === card.key);
    const was = AM.ACTIONS.find((a) => a.path === card.path);
    if (!got) { wrong.push(`no ${card.key} action`); continue; }
    if (got.title !== card.title) wrong.push(`${card.key} title: want ${show(card.title)}, got ${show(got.title)}`);
    if (got.path !== card.path) wrong.push(`${card.key} path: want ${show(card.path)}, got ${show(got.path)}`);
    if (got.alertCriteria !== card.alertCriteria) wrong.push(`${card.key} alertCriteria: want ${show(card.alertCriteria)}, got ${show(got.alertCriteria)}`);
    const link = got.editLink ? { text: got.editLink.text, to: got.editLink.to } : null;
    if (!sameJson(link, TC.MAP_LINK)) wrong.push(`${card.key} editLink: want ${show(TC.MAP_LINK)}, got ${show(link)}`);
    if (typeof mod.plainText === 'function' && mod.plainText(got.description) !== was.text) wrong.push(`${card.key} description changed`);
    const nip = (got.description || []).find((p) => p && typeof p === 'object');
    if (!sameJson(nip, was.link)) wrong.push(`${card.key} NIP link: want ${show(was.link)}, got ${show(nip)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('C5: actions.js still has exactly one import, from config/avatarMenuLinks.js, so Node loads it as it is (ADR 0001 sub-decision 8)', () => {
  const code = codeOnly(safeRead(ACTIONS_MOD));
  const imports = code.match(/^\s*import\s[\s\S]*?from\s*['"][^'"]+['"]/gm) || [];
  assert(imports.length === 1 && /['"]\.\.\/\.\.\/config\/avatarMenuLinks\.js['"]/.test(imports[0]), `want one import from '../../config/avatarMenuLinks.js'; got ${show(imports)}`);
  assert(/MANAGE_TREASURE_MAP_PATH/.test(imports[0]), 'the link takes MANAGE_TREASURE_MAP_PATH from that same import');
});

/* ───────────────────────── D — the JSX and CSS this runner cannot execute ───────────────────────── */

test('D1: the provider re-asks after a Map save — its onEventPublished listener calls refresh() for a kind 10040 published by the viewer, beside the existing tagging rule (AC-6; ADR 0001 sub-decision 9)', () => {
  const code = codeOnly(safeRead(PROVIDER));
  assert(code, `${rel(PROVIDER)} is missing`);
  const at = code.indexOf('onEventPublished(');
  assert(at >= 0, 'the provider listens through onEventPublished');
  const listener = code.slice(at, at + 1600);
  const wrong = [];
  if (!/10040/.test(listener)) wrong.push('the listener never looks at kind 10040');
  if (!/39999/.test(listener)) wrong.push('the listener lost the tagging rule (kind 39999)');
  if (!/10040[\s\S]{0,200}ev\.pubkey\s*[!=]==\s*pubkey\b|ev\.pubkey\s*[!=]==\s*pubkey\b[\s\S]{0,200}10040/.test(listener)) wrong.push('a Map counts only when the viewer published it (ev.pubkey compared with pubkey, beside the 10040 test)');
  if ((listener.match(/refresh\(\)/g) || []).length < 1) wrong.push('the listener calls refresh()');
  if (/setInterval|setTimeout/.test(code)) wrong.push('no polling');
  assert(wrong.length === 0, wrong.join('; '));
});

test('D2: the hub\'s Done look — ASSISTANT_COPY.done "Done" and doneSrPrefix "Done: "; ActionCard draws is-done, a ✓ marker, the green badge bs-setup-step-badge is-done and the screen-reader prefix; one CSS rule colours the marker (AC-5; ADR assistant-profile-checklist/0001 sub-decision 7)', async () => {
  const mod = await actionsModule();
  const wrong = [];
  if (!mod.ASSISTANT_COPY || mod.ASSISTANT_COPY.done !== TC.DONE_COPY.done) wrong.push(`ASSISTANT_COPY.done: want ${show(TC.DONE_COPY.done)}, got ${show(mod.ASSISTANT_COPY && mod.ASSISTANT_COPY.done)}`);
  if (!mod.ASSISTANT_COPY || mod.ASSISTANT_COPY.doneSrPrefix !== TC.DONE_COPY.doneSrPrefix) wrong.push(`ASSISTANT_COPY.doneSrPrefix: want ${show(TC.DONE_COPY.doneSrPrefix)}, got ${show(mod.ASSISTANT_COPY && mod.ASSISTANT_COPY.doneSrPrefix)}`);
  const hub = codeOnly(safeRead(HUB_PAGE));
  if (!/is-done/.test(hub)) wrong.push('the card never gains is-done');
  if (!/✓/.test(hub)) wrong.push('no ✓ marker');
  if (!/bs-setup-step-badge is-done/.test(hub)) wrong.push('no bs-setup-step-badge is-done badge');
  if (!/ASSISTANT_COPY\.done\b/.test(hub) || !/ASSISTANT_COPY\.doneSrPrefix/.test(hub)) wrong.push('the badge and the screen-reader prefix come from ASSISTANT_COPY');
  if (!/\bdone\b[\s\S]{0,80}\.includes\(action\.key\)/.test(hub)) wrong.push('the hub reads `done` from assistantAttention for each card');
  const css = safeRead(STYLES);
  const rule = css.match(/\.bs-assistant-hub-card\.is-done\s+\.bs-assistant-hub-card-marker\s*\{([^}]*)\}/);
  if (!rule) wrong.push('no .bs-assistant-hub-card.is-done .bs-assistant-hub-card-marker rule');
  else if (!/green|#3fb950/i.test(rule[1])) wrong.push('the done marker is not green');
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── S — the server's and the documents' promises ───────────────────────── */

test('S1: the check never writes and never reads the request — no strfry write or spawn of its own, no signing, no publish, no file or settings write, no req.query — reuses /setup\'s lookupNewest and treasureMapRelays, and holds no TA literal (AC-2; ADR 0001 sub-decisions 3, 5)', () => {
  const src = safeRead(CHECK_MODULE);
  assert(src, `${rel(CHECK_MODULE)} does not exist.`);
  const code = codeOnly(src);
  const wrong = [];
  for (const [re, what] of [
    [/child_process|\bspawn\s*\(|\bexecFile\s*\(|\bexecSync\s*\(/, 'runs a process of its own'],
    [/strfry\s+(import|delete)|publishToRelays|publishEvent|signEvent|finalizeEvent|getEventHash/, 'publishes or signs'],
    [/writeFile|appendFile|mkdir|unlink|setSetting|saveSettings/, 'writes a file or a setting'],
    [/req\.(query|body|params)/, 'reads the request'],
    [new RegExp(LEGACY_TA), 'holds a TA pubkey literal'],
  ]) if (re.test(code)) wrong.push(what);
  if (!/require\(\s*['"]\.\.\/setup\/status['"]\s*\)/.test(code)) wrong.push('does not require ../setup/status');
  if (!/lookupNewest/.test(code) || !/treasureMapRelays/.test(code)) wrong.push('does not reuse lookupNewest and treasureMapRelays');
  if (!/treasureMapCategories\.mjs/.test(code)) wrong.push('does not load src/lib/treasureMapCategories.mjs');
  assert(wrong.length === 0, `src/api/assistant/trustedContent.js ${wrong.join('; ')}`);
});

test('S2: openapi.yaml and BIBLE §11 say the attention answer now carries Scores, Lists and Concepts (ADR 0001 § Implementation notes 6)', () => {
  const wrong = [];
  const api = safeRead(OPENAPI);
  const at = api.indexOf('/api/assistant/attention:');
  const block = at >= 0 ? api.slice(at, at + 6000) : '';
  for (const k of TC.KEYS) if (!block.includes(k)) wrong.push(`openapi's /api/assistant/attention does not name ${k}`);
  const bible = safeRead(BIBLE);
  const row = bible.split(NL).find((l) => l.includes('`/api/assistant/attention`')) || '';
  if (!/Scores/.test(row) || !/Concepts/.test(row) || !/trusted-assertions/.test(row)) wrong.push('BIBLE §11\'s /api/assistant/attention row does not name Scores, Lists and Concepts (trusted-assertions, trusted-lists, dlists)');
  assert(wrong.length === 0, wrong.join('; '));
});

async function run() {
  console.log(`${NL}=== assistant-trusted-content (assistant-trusted-content-status #1) ===`);
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
  console.log(`${NL}assistant-trusted-content: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

module.exports = { run };

if (require.main === module) {
  run().then((r) => { process.exitCode = r.fail > 0 ? 1 : 0; });
}
