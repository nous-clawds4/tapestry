'use strict';
/**
 * assistant-outbox-relays #1: the outbox check — which outbox relays your Assistant's relay list names — and the hub's
 * Outbox Relays card.
 *
 * Story: engineering-team/stories/assistant-outbox-relays/1-the-outbox-check-and-the-hubs-outbox-relays-card.md
 * ADR:   engineering-team/decisions/assistant-outbox-relays/0001-the-outbox-check-joins-the-one-attention-answer.md
 * Plan:  engineering-team/stories/assistant-outbox-relays/1-the-outbox-check-and-the-hubs-outbox-relays-card.test-plan.md
 * Browser half: tests/brainstorm/assistant-outbox-relays.spec.js (B1–B2: the hub card a viewer sees).
 * Words and shapes: test/helpers/outboxRelaysFixtures.js.
 *
 * Classes:
 *   L — the shared library src/lib/relay-list (pure CommonJS): normalizeRelayUrl and parseRelayList.     [AC-3]
 *   U — src/api/assistant/attention.js + outboxRelays.js driven through the injected dependencies ADR 0001 names
 *       (getAssistantPubkeyFor, scanLocal, readRelay, getConfiguredPublishRelays, getConfigFromFile,
 *       readConfiguredRelays, checkOutboxRelays). Stack-free.                                              [AC-2 … AC-5]
 *   C — the pure ESM module ui/src/pages/assistant/actions.js, loaded in Node: the eleventh action, CHECKED_ACTIONS,
 *       the two readings and the hub's Done list, the Done copy.                                           [AC-1, AC-4]
 *   S — source sentinels on the server: read-only, session-only, documented.                              [AC-2, AC-5]
 *   D — source sentinels on the UI this runner cannot execute (JSX, CSS, Vite config).                     [AC-1, AC-4]
 *
 * Everything FAILS against the current code: src/lib/relay-list and src/api/assistant/outboxRelays.js do not exist,
 * the attention answer has no outbox-relays key, and the hub has ten actions and no Done badge.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const O = require('./helpers/outboxRelaysFixtures');

const REPO = path.resolve(__dirname, '..');
const LIB = path.join(REPO, 'src/lib/relay-list/index.js');
const ATTENTION_MODULE = path.join(REPO, 'src/api/assistant/attention.js');
const OUTBOX_MODULE = path.join(REPO, 'src/api/assistant/outboxRelays.js');
const OPENAPI = path.join(REPO, 'src/api/openapi.yaml');
const BIBLE = path.join(REPO, 'BIBLE.md');
const ACTIONS_MOD = path.join(REPO, 'ui/src/pages/assistant/actions.js');
const UI_UTIL = path.join(REPO, 'ui/src/utils/assistantAttention.js');
const HUB_PAGE = path.join(REPO, 'ui/src/pages/assistant/Index.jsx');
const STYLES = path.join(REPO, 'ui/src/styles.css');
const VITE = path.join(REPO, 'ui/vite.config.js');
const NL = String.fromCharCode(10);

// Fixture keys, never live ones.
const VIEWER = 'a1'.repeat(32);
const ASSISTANT = 'a2'.repeat(32);
const OTHER = 'b2'.repeat(32);

// Fixture relays: two outside publish relays and this instance's own.
const PUB1 = 'wss://pub-one.example';
const PUB2 = 'wss://pub-two.example';
const OWN = 'ws://localhost:7777';

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
function relayList(pubkey, createdAt, rTags, id) {
  idSeq += 1;
  return { id: id || hexId(idSeq), pubkey, kind: O.RELAY_LIST_KIND, created_at: createdAt, tags: rTags, content: '', sig: '0'.repeat(128) };
}
function matching(events, filter) {
  const kinds = Array.isArray(filter && filter.kinds) ? filter.kinds : null;
  const authors = Array.isArray(filter && filter.authors) ? filter.authors.map((a) => String(a).toLowerCase()) : null;
  const ds = Array.isArray(filter && filter['#d']) ? filter['#d'] : null;
  return events.filter((e) => (!kinds || kinds.includes(e.kind))
    && (!authors || authors.includes(String(e.pubkey).toLowerCase()))
    && (!ds || ds.includes(((e.tags || []).find((t) => t[0] === 'd') || [])[1])));
}
const isRelayListFilter = (f) => Array.isArray(f && f.kinds) && f.kinds.includes(O.RELAY_LIST_KIND);

/* ───────────────────────── the modules under test ───────────────────────── */

function load(abs, what) {
  if (!fs.existsSync(abs)) throw new Error(`${rel(abs)} does not exist. ${what}`);
  delete require.cache[require.resolve(abs)];
  return require(abs);
}
const libModule = () => load(LIB, 'ADR 0001 sub-decision 1 creates it: the pure NIP-65 library (normalizeRelayUrl, parseRelayList, MAX_RELAYS, MAX_PARSED_R_TAGS).');
const attentionModule = () => load(ATTENTION_MODULE, 'It answers GET /api/assistant/attention.');
const outboxModule = () => load(OUTBOX_MODULE, 'ADR 0001 § Implementation notes 3 creates it: checkOutboxRelays, evaluateOutboxRelays, RELAY_LIST_KIND.');
function need(mod, name, file) {
  assert(typeof mod[name] === 'function', `${file} must export ${name}() (ADR 0001 § Implementation notes).`);
  return mod[name];
}

/**
 * The injected dependencies, under the names ADR 0001 gives them. Every one RECORDS its calls.
 *   assistant  — what getAssistantPubkeyFor answers: default ASSISTANT; null = no assistant.
 *   local      — the events this instance's relay holds, or 'reject'.
 *   relays     — { [url]: events | 'unreachable' | 'hang' | { raw: events } }: { raw } answers ok with the events as given,
 *                ignoring the filter (a sloppy relay).
 *   publish    — what getConfiguredPublishRelays answers; default [PUB1, PUB2, OWN] (this instance's own is dropped).
 *   config     — getConfigFromFile's values.
 *   settings   — readConfiguredRelays' lists by category (for the suggestions, ADR 0002).
 */
function fakes(opts = {}) {
  const calls = { getAssistantPubkeyFor: [], scanLocal: [], readRelay: [], getConfiguredPublishRelays: 0 };
  const deps = {
    getAssistantPubkeyFor: async (pk) => {
      calls.getAssistantPubkeyFor.push(pk);
      return opts.assistant === undefined ? ASSISTANT : opts.assistant;
    },
    scanLocal: async (filter) => {
      calls.scanLocal.push(filter);
      if (opts.local === 'reject') throw new Error('fixture: strfry scan failed');
      return matching(Array.isArray(opts.local) ? opts.local : [], filter);
    },
    readRelay: async (url, filter) => {
      calls.readRelay.push({ url, filter });
      const held = opts.relays ? opts.relays[url] : undefined;
      if (held === 'hang') return new Promise(() => {});
      if (held && Array.isArray(held.raw)) return { status: 'ok', events: held.raw.slice(), error: null };
      if (!Array.isArray(held)) return { status: 'unreachable', events: [], error: 'fixture: unreachable' };
      return { status: 'ok', events: matching(held, filter), error: null };
    },
    getConfiguredPublishRelays: () => { calls.getConfiguredPublishRelays += 1; return (opts.publish || [PUB1, PUB2, OWN]).slice(); },
    readConfiguredRelays: (categories) => {
      const s = opts.settings || {};
      return (Array.isArray(categories) ? categories : []).flatMap((c) => s[c] || []);
    },
    isLocalOnly: () => Boolean(opts.localOnly),
    getConfigFromFile: (key, dflt) => (opts.config && Object.prototype.hasOwnProperty.call(opts.config, key) ? opts.config[key] : dflt),
    // Scores, Lists and Concepts (assistant-trusted-content-status ADR 0001), stubbed: this suite is about Outbox Relays,
    // and the stub keeps the Treasure Map read out of its scans and relay reads.
    checkTrustedContent: async () => ({}),
  };
  if (opts.checkOutboxRelays) deps.checkOutboxRelays = opts.checkOutboxRelays;
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
  const handle = need(attentionModule(), 'handleAssistantAttention', 'src/api/assistant/attention.js');
  outboxModule(); // a clear message when the module is missing
  const { deps, calls } = fakes(opts);
  const res = fakeRes();
  await handle(req, res, deps);
  const action = res.body && res.body.actions ? res.body.actions[O.KEY] : undefined;
  return { res, body: res.body, action, calls, outboxScans: calls.scanLocal.filter(isRelayListFilter), outboxReads: calls.readRelay.filter((c) => isRelayListFilter(c.filter)) };
}

async function within(promise, ms) {
  let timer;
  const hung = new Promise((resolve) => { timer = setTimeout(() => resolve('HUNG'), ms); });
  try { return await Promise.race([promise, hung]); } finally { clearTimeout(timer); }
}

async function esm(absPath, what) {
  assert(fs.existsSync(absPath), `${rel(absPath)} does not exist. ${what}`);
  let mod;
  try { mod = await import(pathToFileURL(absPath).href); } catch (err) { throw new Error(`${rel(absPath)} must load in Node as ESM: ${err.message}`); }
  return mod;
}
const actionsModule = () => esm(ACTIONS_MOD, 'It holds ASSISTANT_ACTIONS, CHECKED_ACTIONS and assistantAttention.');
const uiUtil = () => esm(UI_UTIL, 'It holds summarizeAttention.');

/** The action's shape check (ADR 0001 sub-decision 4). */
function shapeOf(action) {
  if (!action || typeof action !== 'object') return action;
  const { finished, done, pending, reason, source, outbox, inboxOnlyCount } = action;
  return { finished, done, pending, reason, source, outbox, inboxOnlyCount };
}

/* ───────────────────────── L — the shared library ───────────────────────── */

test('L1: the library exists, is CommonJS, and requires nothing — the server and the UI (through the Vite alias) both load it (ADR 0001 sub-decision 1)', () => {
  const src = safeRead(LIB);
  assert(src, `${rel(LIB)} does not exist (ADR 0001 sub-decision 1).`);
  assert(!/\brequire\s*\(/.test(codeOnly(src)) && !/^\s*import\b/m.test(src), 'the library must have no imports: the UI loads it through a Vite alias, Node by path');
  const lib = libModule();
  assert(typeof lib.normalizeRelayUrl === 'function' && typeof lib.parseRelayList === 'function', 'exports normalizeRelayUrl and parseRelayList');
  assert(lib.MAX_RELAYS === O.MAX_RELAYS && lib.MAX_PARSED_R_TAGS === O.MAX_PARSED_R_TAGS, `MAX_RELAYS ${O.MAX_RELAYS} and MAX_PARSED_R_TAGS ${O.MAX_PARSED_R_TAGS}, got ${show([lib.MAX_RELAYS, lib.MAX_PARSED_R_TAGS])}`);
});

test('L2: normalizeRelayUrl gives a relay its one spelling — trimmed, scheme and host lower-cased, a default port and one trailing slash dropped, the path kept as written (AC-3; story 2 AC-3)', () => {
  const { normalizeRelayUrl } = libModule();
  const cases = [
    ['wss://relay.damus.io', 'wss://relay.damus.io'],
    ['  wss://Relay.Damus.IO/  ', 'wss://relay.damus.io'],
    ['WSS://relay.example', 'wss://relay.example'],
    ['ws://localhost:7777', 'ws://localhost:7777'],
    ['wss://relay.example:443', 'wss://relay.example'],
    ['wss://staging.example/relay/', 'wss://staging.example/relay'],
    ['wss://x.example/Path', 'wss://x.example/Path'],
  ];
  const wrong = cases.filter(([input, want]) => normalizeRelayUrl(input) !== want).map(([input, want]) => `${show(input)}: want ${show(want)}, got ${show(normalizeRelayUrl(input))}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('L3: normalizeRelayUrl refuses what is not a relay address — another scheme, no scheme, no host, credentials, a hash, spaces inside, over 512 characters, a non-string (AC-3; story 2 AC-3)', () => {
  const { normalizeRelayUrl } = libModule();
  const bad = ['https://relay.example', 'relay.example', '', '   ', 'wss://', 'wss://user:pw@relay.example', 'wss://relay.example/#frag',
    'wss://bad host.example', `wss://relay.example/${'a'.repeat(520)}`, null, undefined, 42, {}, ['wss://relay.example']];
  const wrong = bad.filter((input) => normalizeRelayUrl(input) !== null).map((input) => `${show(input)} → ${show(normalizeRelayUrl(input))}`);
  assert(wrong.length === 0, `want null for each, got: ${wrong.join('; ')}`);
});

test('L4: parseRelayList reads r tags — markers write / read / none (any other value is none), duplicates once in first position, non-relay values ignored, other tags ignored; outbox = none or write, inbox-only = read (AC-2, AC-3)', () => {
  const { parseRelayList } = libModule();
  const ev = relayList(ASSISTANT, 100, [
    ['r', 'wss://a.example'], ['r', 'wss://b.example', 'write'], ['r', 'wss://c.example', 'read'], ['p', OTHER],
    ['r', 'https://not-a-relay.example'], ['r', 'wss://A.example/'], ['r', 'wss://d.example', 'sometimes'], ['r'],
  ]);
  const got = parseRelayList(ev);
  const want = {
    entries: [{ url: 'wss://a.example', marker: null }, { url: 'wss://b.example', marker: 'write' }, { url: 'wss://c.example', marker: 'read' }, { url: 'wss://d.example', marker: null }],
    outbox: ['wss://a.example', 'wss://b.example', 'wss://d.example'],
    inboxOnly: ['wss://c.example'],
  };
  assert(sameJson(got, want), `want ${show(want)}, got ${show(got)}`);
});

test('L5: parseRelayList — a relay named twice with disagreeing markers is both (none); with the same marker it keeps it; no event is an empty list; only the first 100 r tags are read (AC-3; ADR 0001 sub-decision 1)', () => {
  const { parseRelayList } = libModule();
  const x = 'wss://x.example';
  const wrong = [];
  const both = parseRelayList(relayList(ASSISTANT, 1, [['r', x, 'read'], ['r', x, 'write']]));
  if (!sameJson(both.entries, [{ url: x, marker: null }]) || !sameJson(both.outbox, [x])) wrong.push(`read + write: ${show(both)}`);
  const noneAndRead = parseRelayList(relayList(ASSISTANT, 1, [['r', x], ['r', x, 'read']]));
  if (!sameJson(noneAndRead.entries, [{ url: x, marker: null }])) wrong.push(`none + read: ${show(noneAndRead)}`);
  const twiceWrite = parseRelayList(relayList(ASSISTANT, 1, [['r', x, 'write'], ['r', x, 'write']]));
  if (!sameJson(twiceWrite.entries, [{ url: x, marker: 'write' }])) wrong.push(`write + write: ${show(twiceWrite)}`);
  for (const nothing of [null, undefined, {}]) {
    const got = parseRelayList(nothing);
    if (!sameJson(got, { entries: [], outbox: [], inboxOnly: [] })) wrong.push(`${show(nothing)}: ${show(got)}`);
  }
  const many = Array.from({ length: 120 }, (_, i) => ['r', `wss://r${i}.example`]);
  const capped = parseRelayList(relayList(ASSISTANT, 1, many));
  if (capped.entries.length !== 100 || capped.entries[99].url !== 'wss://r99.example') wrong.push(`120 r tags: ${capped.entries.length} entries, last ${show(capped.entries[capped.entries.length - 1])}`);
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── U — the answer ───────────────────────── */

test('U1: without an authenticated session the answer is { success: true, signedIn: false } and no relay list is looked up (AC-2)', async () => {
  const got = await answer({}, { session: {}, query: {} });
  assert(got.res.statusCode === 200 && sameJson(got.body, { success: true, signedIn: false }), `got ${got.res.statusCode} ${show(got.body)}`);
  assert(got.outboxScans.length === 0 && got.outboxReads.length === 0, 'nothing is scanned or read');
});

test('U2: a signed-in viewer with no assistant here gets actions {} — no outbox-relays key, nothing looked up (AC-2)', async () => {
  const got = await answer({ assistant: null });
  assert(got.body && got.body.hasAssistant === false && sameJson(got.body.actions, {}), `got ${show(got.body)}`);
  assert(got.outboxScans.length === 0 && got.outboxReads.length === 0, 'nothing is scanned or read');
});

test('U3: a relay list on this instance\'s relay — finished, done, source local, the outbox relays in the list\'s order, the inbox-only count; no outside relay is asked (AC-2, AC-3, AC-4)', async () => {
  const list = relayList(ASSISTANT, 1000, [['r', O.OUT_A, 'write'], ['r', O.IN_C, 'read'], ['r', O.OUT_B]]);
  const got = await answer({ local: [list], relays: { [PUB1]: [], [PUB2]: [] } });
  const want = { finished: true, done: true, pending: false, reason: null, source: 'local', outbox: [O.OUT_A, O.OUT_B], inboxOnlyCount: 1 };
  assert(sameJson(shapeOf(got.action), want), `want ${show(want)}, got ${show(got.action)}`);
  assert(got.action.createdAt === 1000, `createdAt is the list's created_at, got ${show(got.action.createdAt)}`);
  assert(got.outboxReads.length === 0, `no outside read when the local relay holds one, got ${show(got.outboxReads)}`);
  assert(got.outboxScans.length === 1 && sameJson(got.outboxScans[0], { kinds: [O.RELAY_LIST_KIND], authors: [ASSISTANT] }),
    `one local scan { kinds: [10002], authors: [the assistant] }, got ${show(got.outboxScans)}`);
});

test('U4: nothing local — the outside publish relays are asked (this instance\'s own dropped), and the newest list among those that answered counts, source relay (AC-3)', async () => {
  const older = relayList(ASSISTANT, 900, [['r', O.OUT_A]]);
  const newer = relayList(ASSISTANT, 1200, [['r', O.OUT_B, 'write']]);
  const got = await answer({ local: [], relays: { [PUB1]: [older], [PUB2]: [newer], [OWN]: [older] } });
  const want = { finished: true, done: true, pending: false, reason: null, source: 'relay', outbox: [O.OUT_B], inboxOnlyCount: 0 };
  assert(sameJson(shapeOf(got.action), want), `want ${show(want)}, got ${show(got.action)}`);
  const urls = got.outboxReads.map((c) => c.url).sort();
  assert(sameJson(urls, [PUB1, PUB2].sort()), `the two outside publish relays, never this instance's own; got ${show(urls)}`);
  assert(got.outboxReads.every((c) => sameJson(c.filter, { kinds: [O.RELAY_LIST_KIND], authors: [ASSISTANT] })), `filter { kinds: [10002], authors: [the assistant] }, got ${show(got.outboxReads.map((c) => c.filter))}`);
});

test('U5: the newest list wins — two on this instance\'s relay, the later counts; on a created_at tie the lexically lowest id (AC-3)', async () => {
  const a = relayList(ASSISTANT, 1000, [['r', O.OUT_A]]);
  const b = relayList(ASSISTANT, 2000, [['r', O.OUT_B]]);
  const got = await answer({ local: [b, a] });
  assert(got.action && sameJson(got.action.outbox, [O.OUT_B]), `the later list: want [${O.OUT_B}], got ${show(got.action && got.action.outbox)}`);
  const low = relayList(ASSISTANT, 3000, [['r', O.OUT_A]], '0'.repeat(63) + '1');
  const high = relayList(ASSISTANT, 3000, [['r', O.OUT_B]], 'f'.repeat(64));
  const tie = await answer({ local: [high, low] });
  assert(tie.action && sameJson(tie.action.outbox, [O.OUT_A]), `tie → lowest id: want [${O.OUT_A}], got ${show(tie.action && tie.action.outbox)}`);
});

test('U6: needs attention — a list of inbox-only relays, an empty list, and no list anywhere (an outside relay answered) are each finished and pending, never done (AC-4)', async () => {
  const wrong = [];
  const cases = [
    ['inbox-only', { local: [relayList(ASSISTANT, 1, [['r', O.IN_C, 'read']])] }, 1],
    ['empty list', { local: [relayList(ASSISTANT, 1, [])] }, 0],
    ['nowhere', { local: [], relays: { [PUB1]: [], [PUB2]: 'unreachable' } }, 0],
  ];
  for (const [label, opts, inbox] of cases) {
    const got = await answer(opts);
    const s = shapeOf(got.action);
    if (!s || s.finished !== true || s.done !== false || s.pending !== true || !sameJson(s.outbox, []) || s.inboxOnlyCount !== inbox) wrong.push(`${label}: ${show(got.action)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('U7: unfinished, with a reason and every flag false — this instance\'s relay unreadable; nothing local and no outside relay configured; nothing local and no outside relay answered (AC-3)', async () => {
  const wrong = [];
  const cases = [
    ['local-unreadable', { local: 'reject' }],
    ['no-outside-relays', { local: [], publish: [OWN] }],
    ['outside-unreachable', { local: [], relays: { [PUB1]: 'unreachable', [PUB2]: 'unreachable' } }],
  ];
  for (const [reason, opts] of cases) {
    const got = await answer(opts);
    const want = { finished: false, done: false, pending: false, reason, source: null, outbox: [], inboxOnlyCount: 0 };
    if (!sameJson(shapeOf(got.action), want)) wrong.push(`${reason}: want ${show(want)}, got ${show(got.action)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('U8: the outside relays are the configured profile publish set even in local-only publish mode — reading is not publishing (ADR 0001 sub-decision 3)', async () => {
  const list = relayList(ASSISTANT, 1000, [['r', O.OUT_A]]);
  const got = await answer({ local: [], localOnly: true, relays: { [PUB1]: [list], [PUB2]: [] } });
  assert(got.calls.getConfiguredPublishRelays > 0, 'getConfiguredPublishRelays is the source of the outside relays');
  assert(got.outboxReads.length === 2, `both outside publish relays are read in local-only mode, got ${show(got.outboxReads.map((c) => c.url))}`);
  assert(got.action && got.action.done === true && got.action.source === 'relay', `the relay's list counts: ${show(got.action)}`);
});

test('U9: a relay that never answers loses the budget (8 s) and the one that answered still counts (AC-3)', async () => {
  const list = relayList(ASSISTANT, 1000, [['r', O.OUT_A]]);
  const started = Date.now();
  const got = await within(answer({ local: [], relays: { [PUB1]: 'hang', [PUB2]: [list] } }), O.RELAY_BUDGET_MS + 3000);
  assert(got !== 'HUNG', `the answer must arrive within the relay budget, not hang (waited ${Date.now() - started} ms)`);
  assert(got.action && got.action.done === true && sameJson(got.action.outbox, [O.OUT_A]), `the answering relay counts: ${show(got.action)}`);
});

test('U10: only the assistant\'s own list counts — a relay that answers with another author\'s kind 10002, or another kind, is ignored (AC-2, AC-3)', async () => {
  const theirs = relayList(OTHER, 5000, [['r', 'wss://theirs.example']]);
  const otherKind = { ...relayList(ASSISTANT, 6000, [['r', 'wss://kind3.example']]), kind: 3 };
  const mine = relayList(ASSISTANT, 1000, [['r', O.OUT_A]]);
  const got = await answer({ local: [], relays: { [PUB1]: { raw: [theirs, otherKind, mine] }, [PUB2]: [] } });
  assert(got.action && sameJson(got.action.outbox, [O.OUT_A]), `want [${O.OUT_A}], got ${show(got.action && got.action.outbox)}`);
});

test('U11: a failing outbox check does not take the other answers with it — 200, Identification Tags answered, and the outbox action is check-failed (ADR 0001 sub-decision 5)', async () => {
  const got = await answer({ checkOutboxRelays: async () => { throw new Error('fixture: the outbox check exploded'); } });
  assert(got.res.statusCode === 200 && got.body && got.body.success === true, `want 200 success, got ${got.res.statusCode} ${show(got.body)}`);
  assert(got.body.actions && got.body.actions['identification-tags'], 'the Identification Tags answer is still there');
  const want = { finished: false, done: false, pending: false, reason: 'check-failed', source: null, outbox: [], inboxOnlyCount: 0 };
  assert(sameJson(shapeOf(got.action), want), `want ${show(want)}, got ${show(got.action)}`);
});

test('U12: whose assistant comes from the session — a query parameter naming another person or assistant changes nothing, and the scan is by the session\'s assistant only (AC-2)', async () => {
  const list = relayList(ASSISTANT, 1000, [['r', O.OUT_A]]);
  const plain = await answer({ local: [list, relayList(OTHER, 2000, [['r', 'wss://theirs.example']])] });
  const nosy = await answer({ local: [list, relayList(OTHER, 2000, [['r', 'wss://theirs.example']])] }, signedInReq(VIEWER, { query: { pubkey: OTHER, assistant: OTHER, author: OTHER } }));
  assert(sameJson(plain.action, nosy.action), `the query changed the answer: ${show(plain.action)} vs ${show(nosy.action)}`);
  assert(nosy.outboxScans.every((f) => sameJson(f.authors, [ASSISTANT])), `scans by the session's assistant only, got ${show(nosy.outboxScans)}`);
  assert(sameJson(plain.action.outbox, [O.OUT_A]), `the other author's list never counts, got ${show(plain.action.outbox)}`);
});

test('U13: the answer carries no viewer or assistant pubkey (AC-2)', async () => {
  const got = await answer({ local: [relayList(ASSISTANT, 1, [['r', O.OUT_A]])] });
  const text = show(got.action);
  assert(text && !text.includes(VIEWER) && !text.includes(ASSISTANT), `the outbox action must not carry a pubkey: ${text}`);
});

test('U14: lookupNewestReplaceable answers the three shapes ADR 0001 sub-decision 2 names — found locally, found or not outside, and unfinished with a reason (AC-3)', async () => {
  const lookup = need(attentionModule(), 'lookupNewestReplaceable', 'src/api/assistant/attention.js');
  const list = relayList(ASSISTANT, 10, [['r', O.OUT_A]]);
  const run = (opts, relays) => { const { deps } = fakes(opts); return lookup({ kind: O.RELAY_LIST_KIND, author: ASSISTANT, relays }, deps); };
  const wrong = [];
  const local = await run({ local: [list] }, [PUB1]);
  if (!(local && local.finished === true && local.source === 'local' && local.event && local.event.id === list.id)) wrong.push(`local: ${show(local)}`);
  const outside = await run({ local: [], relays: { [PUB1]: [list] } }, [PUB1]);
  if (!(outside && outside.finished === true && outside.source === 'relay' && outside.event && outside.event.id === list.id)) wrong.push(`outside: ${show(outside)}`);
  const none = await run({ local: [], relays: { [PUB1]: [] } }, [PUB1]);
  if (!sameJson(none, { finished: true, event: null, source: null })) wrong.push(`none: ${show(none)}`);
  const noRelays = await run({ local: [] }, []);
  if (!sameJson(noRelays, { finished: false, reason: 'no-outside-relays' })) wrong.push(`no relays: ${show(noRelays)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── C — the hub's data module ───────────────────────── */

test('C1: the hub has eleven actions — Outbox Relays is the third persona card, right after Identification Tags, with its approved title, address, description, NIP-65 link and alert criteria (AC-1)', async () => {
  const mod = await actionsModule();
  const actions = mod.ASSISTANT_ACTIONS || [];
  assert(actions.length === 11, `eleven actions, got ${actions.length}`);
  const i = actions.findIndex((a) => a && a.key === O.KEY);
  assert(i >= 0, `no action with key ${show(O.KEY)}`);
  assert(actions[i - 1] && actions[i - 1].key === 'identification-tags', `right after identification-tags, got after ${show(actions[i - 1] && actions[i - 1].key)}`);
  const persona = actions.filter((a) => a.section === 'persona').map((a) => a.key);
  assert(sameJson(persona, ['profile', 'identification-tags', O.KEY]), `the persona section: ${show(persona)}`);
  const a = actions[i];
  const text = (a.description || []).map((p) => (typeof p === 'string' ? p : p.text)).join('');
  const links = (a.description || []).filter((p) => p && typeof p === 'object').map((p) => ({ text: p.text, href: p.href }));
  const wrong = [];
  for (const k of ['section', 'path', 'title', 'alertCriteria', 'planningNotes']) if (a[k] !== O.ACTION[k]) wrong.push(`${k}: want ${show(O.ACTION[k])}, got ${show(a[k])}`);
  if (text !== O.ACTION.text) wrong.push(`description: want ${show(O.ACTION.text)}, got ${show(text)}`);
  if (!sameJson(links, [O.ACTION.link])) wrong.push(`links: want ${show([O.ACTION.link])}, got ${show(links)}`);
  assert(wrong.length === 0, `story 1 § Copy: ${wrong.join('; ')}`);
});

test('C2: CHECKED_ACTIONS includes identification-tags and outbox-relays, every checked key is a real action, in ASSISTANT_ACTIONS order (ADR 0001 sub-decision 6)', async () => {
  const mod = await actionsModule();
  const keys = (mod.ASSISTANT_ACTIONS || []).map((a) => a.key);
  const checked = mod.CHECKED_ACTIONS || [];
  assert(checked.includes('identification-tags') && checked.includes(O.KEY), `want both checked, got ${show(checked)}`);
  assert(checked.every((k) => keys.includes(k)), `every checked key is an action: ${show(checked)}`);
  const order = checked.map((k) => keys.indexOf(k));
  assert(order.every((n, j) => j === 0 || n > order[j - 1]), `in ASSISTANT_ACTIONS order: ${show(checked)}`);
});

test('C3: the two readings for Outbox Relays — done: unmarked, uncounted, in done; pending: marked and counted; unfinished, check-failed or missing: marked, not counted (AC-4)', async () => {
  const mod = await actionsModule();
  const summarize = (await uiUtil()).summarizeAttention;
  const user = { pubkey: 'cc'.repeat(32), classification: 'customer', assistantPubkey: 'c1'.repeat(32) };
  const base = mod.assistantAttention(user, summarize(O.attentionWith({ outbox: null })));
  const wrong = [];
  const cases = [
    ['done', O.OUTBOX.DONE, { marked: false, counted: false, done: true }],
    ['pending', O.OUTBOX.PENDING, { marked: true, counted: true, done: false }],
    ['unfinished', O.OUTBOX.UNFINISHED, { marked: true, counted: false, done: false }],
    ['check-failed', O.OUTBOX.CHECK_FAILED, { marked: true, counted: false, done: false }],
  ];
  if (!base.needsAttention.includes(O.KEY)) wrong.push('missing answer: the card must be marked');
  for (const [label, outbox, want] of cases) {
    const got = mod.assistantAttention(user, summarize(O.attentionWith({ outbox })));
    const marked = got.needsAttention.includes(O.KEY);
    const counted = got.alertCount - base.alertCount === 1;
    const isDone = Array.isArray(got.done) && got.done.includes(O.KEY);
    if (marked !== want.marked || counted !== want.counted || isDone !== want.done) wrong.push(`${label}: want ${show(want)}, got ${show({ marked, counted, done: isDone })}`);
    if (got.count !== got.needsAttention.length) wrong.push(`${label}: the count line counts the marks (${got.count} vs ${got.needsAttention.length})`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('C4: the hub\'s Done list — every checked action whose answer is done, never a placeholder, empty for a visitor or a viewer with no assistant; the Done badge\'s words (AC-4; story 1 § Copy)', async () => {
  const mod = await actionsModule();
  const summarize = (await uiUtil()).summarizeAttention;
  const user = { pubkey: 'cc'.repeat(32), classification: 'customer', assistantPubkey: 'c1'.repeat(32) };
  const got = mod.assistantAttention(user, summarize(O.attentionWith({ outbox: O.OUTBOX.DONE })));
  assert(Array.isArray(got.done), `assistantAttention returns done: string[] (ADR assistant-profile-checklist/0001 sub-decision 7), got ${show(got)}`);
  assert(got.done.includes(O.KEY) && got.done.includes('identification-tags'), `both done actions are listed, got ${show(got.done)}`);
  assert(got.done.every((k) => (mod.CHECKED_ACTIONS || []).includes(k)), `only checked actions: ${show(got.done)}`);
  assert(got.done.every((k) => !got.needsAttention.includes(k)), 'a done card is never also marked');
  for (const who of [null, { pubkey: 'ee'.repeat(32), classification: 'guest', assistantPubkey: null }]) {
    const none = mod.assistantAttention(who, summarize(O.attentionWith({ outbox: O.OUTBOX.DONE })));
    assert(sameJson(none.done, []), `nobody with an assistant → done [], got ${show(none.done)}`);
  }
  const copy = mod.ASSISTANT_COPY || {};
  assert(copy.done === O.DONE_BADGE.word && copy.doneSrPrefix === O.DONE_BADGE.srPrefix, `ASSISTANT_COPY.done / doneSrPrefix: want ${show(O.DONE_BADGE)}, got ${show({ done: copy.done, doneSrPrefix: copy.doneSrPrefix })}`);
});

/* ───────────────────────── S — server sentinels ───────────────────────── */

test('S1: the outbox check is read-only and session-only — no strfry import, no signing, no publish, no settings write, no request parameter (AC-2, AC-5)', () => {
  const src = codeOnly(safeRead(OUTBOX_MODULE));
  assert(src, `${rel(OUTBOX_MODULE)} does not exist`);
  const forbidden = [/importEvent|importToLocalRelay/, /finalizeEvent|signEvent|getAssistantKeys/, /publishToRelays/, /updateSetting|writeFile/, /req\.(query|params|body)/];
  const hits = forbidden.filter((re) => re.test(src)).map(String);
  assert(hits.length === 0, `the check must not write or read the request: ${hits.join(', ')}`);
  assert(/lookupNewestReplaceable/.test(src), 'the check reads through lookupNewestReplaceable (ADR 0001 sub-decision 2)');
  assert(/outsideOnly/.test(src), 'the outside relays go through outsideOnly, so this instance\'s own relay is never outside evidence');
});

test('S2: the attention module isolates its checks with Promise.allSettled and names the key OUTBOX_RELAYS = "outbox-relays" (ADR 0001 sub-decision 5, § Implementation notes 2)', () => {
  const src = codeOnly(safeRead(ATTENTION_MODULE));
  assert(/Promise\.allSettled\s*\(/.test(src), 'handleAssistantAttention awaits its checks with Promise.allSettled');
  const mod = attentionModule();
  assert(mod.OUTBOX_RELAYS === O.KEY, `attention.js exports OUTBOX_RELAYS = ${show(O.KEY)}, got ${show(mod.OUTBOX_RELAYS)}`);
});

test('S3: the OpenAPI document and BIBLE §11 describe the outbox-relays action of GET /api/assistant/attention (ADR 0001 § Implementation notes 5)', () => {
  const openapi = safeRead(OPENAPI);
  const at = openapi.indexOf('/api/assistant/attention:');
  const block = at >= 0 ? openapi.slice(at, openapi.indexOf(NL + '  /api/', at + 10)) : '';
  assert(/outbox-relays/.test(block), 'openapi.yaml: the /api/assistant/attention block names the outbox-relays action');
  const bibleRow = safeRead(BIBLE).split(NL).find((l) => l.includes('`/api/assistant/attention`')) || '';
  assert(/outbox-relays/.test(bibleRow), 'BIBLE §11: the /api/assistant/attention row names the outbox-relays check');
});

/* ───────────────────────── D — UI sentinels ───────────────────────── */

test('D1: the hub draws the Done badge — done from assistantAttention, the is-done class, the ✓ marker, ASSISTANT_COPY.done and its screen-reader prefix (AC-4)', () => {
  const src = codeOnly(safeRead(HUB_PAGE));
  const wrong = [];
  if (!/\bdone\b[^;]*=\s*assistantAttention\s*\(|\{[^}]*\bdone\b[^}]*\}\s*=\s*assistantAttention\s*\(/.test(src)) wrong.push('done is read from assistantAttention(user, attention)');
  if (!/is-done/.test(src)) wrong.push('the card gains class is-done');
  if (!/✓/.test(src)) wrong.push('the marker shows ✓ when done');
  if (!/ASSISTANT_COPY\.done\b/.test(src)) wrong.push('the badge word is ASSISTANT_COPY.done');
  if (!/ASSISTANT_COPY\.doneSrPrefix\b/.test(src)) wrong.push('the screen-reader prefix is ASSISTANT_COPY.doneSrPrefix');
  if (!/bs-setup-step-badge is-done/.test(src)) wrong.push('the badge is bs-setup-step-badge is-done, as on the Identification Tags page');
  assert(wrong.length === 0, wrong.join('; '));
});

test('D2: the stylesheet styles a done hub card\'s marker (ADR assistant-profile-checklist/0001 sub-decision 7)', () => {
  assert(/\.bs-assistant-hub-card\.is-done\s+\.bs-assistant-hub-card-marker\s*\{/.test(safeRead(STYLES)), 'ui/src/styles.css: .bs-assistant-hub-card.is-done .bs-assistant-hub-card-marker { … }');
});

test('D3: the Vite config aliases @tapestry/relay-list to the library and includes it in the CommonJS transform; actions.js keeps its one import (ADR 0001 § Implementation notes 1)', () => {
  const vite = safeRead(VITE);
  assert(/['"]@tapestry\/relay-list['"]\s*:/.test(vite) && /src\/lib\/relay-list/.test(vite), 'ui/vite.config.js: alias @tapestry/relay-list → src/lib/relay-list');
  assert(/src\\\/lib\\\/relay-list/.test(vite), 'ui/vite.config.js: /src\\/lib\\/relay-list/ in build.commonjsOptions.include');
  const imports = (safeRead(ACTIONS_MOD).match(/^\s*import\b/gm) || []).length;
  assert(imports === 1, `actions.js keeps its one import (Node suites load it as is), got ${imports}`);
});

async function run() {
  console.log(`${NL}=== assistant-outbox-check (assistant-outbox-relays #1) ===`);
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
  console.log(`${NL}assistant-outbox-check: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

module.exports = { run };
