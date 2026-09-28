'use strict';
/**
 * Tests for Story 3 (epic tagging-edges) — the real-time path's pure planner, src/lib/tagging-edges/realtime.js.
 *
 * Story: engineering-team/stories/tagging-edges/3-real-time-path.md (AC-1 … AC-7; "For Test Design")
 * ADR:   engineering-team/decisions/tagging-edges/0003-real-time-path.md — § Decision ("What it hears", "Knowing what
 *        changed while it was away", "What it decides and writes", "Coexisting with the pass", "Status and switch"),
 *        "Implementation notes → New files → realtime.js", the planner list under "Tests the Tester owns → New suites
 *        → The pure planner", and "Clarifications (Test Design, 2026-09-28)" T1–T19, which fix every interface this
 *        suite calls, T25, which settles the planner details they left open, and T33 (the blind reference
 *        implementation's readings: a replayed v line discards superseded revokes; discardSupersededRevokes with a
 *        null version or a null entry; pending holds entries only). Binding context: ADR
 *        tagging-edges/0002 (the pass's planner, src/lib/tagging-edges/sweep.js —
 *        decideAddress, readRelay, storedFromRow, checkIdentity) and ADR tagging-edges/0001 as amended (the contract,
 *        src/lib/tagging-edges/contract.js — taggingToEdge, revokeTargets, revokeApplies).
 *
 * Intentionally failing until realtime.js lands (red phase). The module is require()d LAZILY inside each test through
 * load() / fn(), so this suite always loads and each test fails with "src/lib/tagging-edges/realtime.js not
 * implemented yet (require failed: …)" or "… does not export X() yet", never with a load error of its own.
 *
 * Pure and stack-free: no Neo4j, no strfry, no network, no filesystem writes, no clock (times are fixed numbers). The
 * one filesystem read is RP1's read of realtime.js's own source. Relay events and graph rows come from
 * test/helpers/taggingEdgesFixtures.js; decisions come from the real sweep.js decideAddress, as the engine gets them.
 * Every pubkey is a fake 64-hex value from that helper — never a deployment's TA and never the ADR 0015 literal. The
 * canonical and local identities are kept different, as in story 2.
 *
 * What is pinned: T1–T19's names, argument orders, result shapes and rules, as T25 refines them. The container types
 * are T25's, passed and read strictly — no value that would work under another reading:
 *   Sets     `scannedIds` and `candidateIds` (T8, T10);
 *   arrays   `targets` (T11, given and returned), `addresses` and `ids` (T12);
 *   a plain object from runId to milliseconds — `deadSeenAt` (T17, and replayJournal's result, T19).
 * A pending entry is compared on T15's three fields { version, revokes, look }; RP78 pins that replayJournal's pending
 * values are entries only, those three keys and no more (T33); RP79 that replayJournal keeps the first k time for a
 * run (ADR § Coexisting with the pass; added from the mutation pass). Filter budgets are checked against the
 * suite's own reference escape (JSON.stringify with every "/" written "\/", measured in UTF-8 bytes) and the literal
 * 100,000, never against the module's own filterArgvBytes or LIMITS, so a wrong helper cannot pass itself. Maps are
 * built through newMaps() and recordId() (T3), as the engine builds them.
 *
 * Hand-rolled in the project's existing test style — no new framework. Runs on Node 16 and 22.
 */

const fs = require('fs');
const path = require('path');
const F = require('./helpers/taggingEdgesFixtures');

const {
  CANONICAL, LOCAL, OTHER_DEPLOY, IDENTITIES, ALICE, BOB, CAROL, idOf, pubkeyOf,
  STAMP, TAG_STAMP, TAG_V1, TAG_ADDR, makeTagging, makeElement, makeNonTagging, makeDeletion, storedRowFor, contractEdge,
} = F;

const REPO = path.resolve(__dirname, '..');
const REALTIME_REL = 'src/lib/tagging-edges/realtime.js';
const REALTIME = path.join(REPO, REALTIME_REL);
const LIB_INDEX = path.join(REPO, 'src/lib/tagging-edges/index.js');
const SWEEP = path.join(REPO, 'src/lib/tagging-edges/sweep.js');
const CONTRACT = path.join(REPO, 'src/lib/tagging-edges/contract.js');
const SCAN_STRICT_REL = 'src/lib/strfryScanStrict.js';
const SCAN_STRICT = path.join(REPO, SCAN_STRICT_REL);

/** LIMITS.argvFilterBytes, written out: the most a filter's escaped argv text may hold (ADR 0003 § A round, step 2). */
const ARGV_BUDGET = 100000;
/** The pass's pgrep pattern (ADR 0003 "The launcher's pgrep guard"): no argv of the path may contain it. */
const PGREP_PATTERN = 'pipeline/tagging-edges/reconcileTaggingEdges';
/** A run id in the pass's RUN_ID_RE grammar. */
const RUN = '20260928T120000Z-0a1b2c3d';
const RUN2 = '20260928T130000Z-0e1f2a3b';
const RUN3 = '20260928T140000Z-4c5d6e7f';
/** A fixed "now" for pass-overlap times (2026-09-28T12:00:00Z). */
const T0 = Date.UTC(2026, 8, 28, 12, 0, 0);

/** T2's export list, less LIMITS. */
const T2_FUNCTIONS = [
  'escapeFilterArgv', 'filterArgvBytes', 'subscriptionFilters', 'promptFromVersion', 'newMaps', 'recordId',
  'resolveDeletion', 'shrinkOnRead', 'compact', 'arrivalsAndLookOnly', 'deletionCandidates', 'deletionScanFilters',
  'isExpectedDeletion', 'addressScanFilters', 'isExpectedAddressEvent', 'elementScanFilters', 'isExpectedElementEvent',
  'dedupeById', 'relayAtAddress', 'mergePrompt', 'discardSupersededRevokes', 'gateAction', 'passOverlaps', 'roundOrder',
  'journalLine', 'replayJournal', 'allowErrorCode',
];

// ─── test harness ──────────────────────────────────────────────────────────────────────────────────────────────
const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v instanceof Map) return { '<Map>': [...v.entries()].map(([k, x]) => [k, sortKeys(x)]) };
  if (v instanceof Set) return { '<Set>': [...v].map(sortKeys) };
  if (v && typeof v === 'object') return Object.keys(v).sort().reduce((o, k) => { o[k] = sortKeys(v[k]); return o; }, {});
  return v;
}
/** JSON with sorted keys and Maps / Sets spelled out; long strings shortened for messages. */
function show(v) {
  try {
    const s = JSON.stringify(sortKeys(v), (k, x) => {
      if (typeof x === 'bigint') return `${x}n`;
      if (typeof x === 'string' && x.length > 140) return `${x.slice(0, 40)}…(${Buffer.byteLength(x, 'utf8')} bytes)`;
      return x;
    });
    return s === undefined ? String(v) : s;
  } catch (_) { return String(v); }
}
function exact(v) { return JSON.stringify(sortKeys(v), (k, x) => (typeof x === 'bigint' ? `${x}n` : x)); }
function eq(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}\n        expected: ${show(expected)}\n        actual:   ${show(actual)}`);
}
function same(actual, expected, label) {
  if (exact(actual) !== exact(expected)) throw new Error(`${label}\n        expected: ${show(expected)}\n        actual:   ${show(actual)}`);
}
const preview = (xs) => (xs.length > 6 ? `${show(xs.slice(0, 6))} … (+${xs.length - 6} more)` : show(xs));
/** Two collections hold the same members, nothing repeated in `actual`. */
function sameSet(actual, expected, label) {
  const a = [...(actual || [])];
  const as = new Set(a);
  const es = new Set(expected);
  const missing = [...es].filter((x) => !as.has(x));
  const extra = [...as].filter((x) => !es.has(x));
  const repeated = a.length - as.size;
  if (missing.length || extra.length || repeated) {
    throw new Error(`${label}\n        expected ${es.size} members, got ${a.length}${repeated ? ` (${repeated} repeated)` : ''}` +
      `${missing.length ? `\n        missing (${missing.length}): ${preview(missing)}` : ''}` +
      `${extra.length ? `\n        unexpected (${extra.length}): ${preview(extra)}` : ''}`);
  }
}
/** Run several cases; report every failing one, not only the first. */
function cases(list, fn) {
  const failed = [];
  for (const c of list) {
    try { fn(c); } catch (e) { failed.push(`[${c.name}] ${String(e.message).replace(/\n/g, '\n          ')}`); }
  }
  assert(failed.length === 0, `${failed.length} of ${list.length} case(s) failed:\n        ${failed.join('\n        ')}`);
}
const firstLine = (e) => String((e && e.message) || e).split('\n')[0];
const uniq = (xs) => [...new Set(xs)];
const pad = (n, w) => String(n).padStart(w, '0');
const iso = (ms) => new Date(ms).toISOString();

// ─── loading, lazily ───────────────────────────────────────────────────────────────────────────────────────────
/** The module under test, with a descriptive red-phase message. */
function load() {
  try { return require(REALTIME); }
  catch (e) { throw new Error(`${REALTIME_REL} not implemented yet (require failed: ${firstLine(e)})`); }
}
/** An exported function of realtime.js, or a descriptive failure. */
function fn(name) {
  const f = load()[name];
  if (typeof f !== 'function') throw new Error(`${REALTIME_REL} does not export ${name}() yet (T2; got ${typeof f})`);
  return f;
}
/** Several exports at once, so a test fails on its first missing export before doing anything else. */
function need(...names) {
  const out = {};
  for (const n of names) out[n] = fn(n);
  return out;
}
/** Story 2's planner (shipped): decideAddress, readRelay, storedFromRow. */
function sweep() {
  try { return require(SWEEP); }
  catch (e) { throw new Error(`src/lib/tagging-edges/sweep.js not loadable (require failed: ${firstLine(e)})`); }
}
/** Story 1's contract (shipped). */
function contract() {
  try { return require(CONTRACT); }
  catch (e) { throw new Error(`src/lib/tagging-edges/contract.js not loadable (require failed: ${firstLine(e)})`); }
}

// ─── T25's container types, read strictly ──────────────────────────────────────────────────────────────────────
/** An array result (T25: `targets`, `addresses` and `ids` are arrays), or a descriptive failure. */
function arrayOf(x, label) {
  if (Array.isArray(x)) return x;
  throw new Error(`${label}: expected an array (T25), got ${x instanceof Set ? `a Set ${show(x)}` : show(x)}`);
}
/** A plain object — not a Map, a Set or an array (T25: `deadSeenAt` is a plain object from runId to milliseconds). */
function isPlainObject(x) {
  if (!x || typeof x !== 'object' || Array.isArray(x) || x instanceof Map || x instanceof Set) return false;
  const proto = Object.getPrototypeOf(x);
  return proto === Object.prototype || proto === null;
}

// ─── references the suite computes itself ──────────────────────────────────────────────────────────────────────
/** T1's escape, written out: JSON.stringify with every "/" written "\/". */
const refEscape = (f) => JSON.stringify(f).replace(/\//g, '\\/');
/** T1's size: the escaped text's UTF-8 byte length. */
const refBytes = (f) => Buffer.byteLength(refEscape(f), 'utf8');
/** A tagging address's pubkey segment and d (everything after the second colon), or null. */
function partsOf(address) {
  const m = /^39999:([0-9a-f]{64}):([\s\S]+)$/.exec(address);
  return m ? { pk: m[1], d: m[2] } : null;
}

// ─── fixtures ──────────────────────────────────────────────────────────────────────────────────────────────────
/** A tagging address (Alice's by default). */
const addr = (d, author = ALICE) => `39999:${author}:${d}`;
/** A fourth author whose pubkey has hex letters, so upper-casing it changes it (ALICE … CAROL are all digits). */
const DAVE = pubkeyOf('rp:dave');
const UPPER_HEX = 'ABCDEF01'.repeat(8);
function hasLetters(hex, label) { assert(/[a-f]/.test(hex), `fixture: ${label} (${hex}) should hold a hex letter, so its upper-case form differs`); }

/** A T6 revoke prompt. */
const revoke = (by, target, created_at = 2000, kind5Id = idOf(`rp:k5:${by}:${target}:${created_at}`)) => ({ type: 'revoke', kind5Id, created_at, by, target });
/** A T15 entry. */
const entryOf = ({ version = null, revokes = [], look = false } = {}) => ({ version: version ? { id: version } : null, revokes, look });
const revokeKey = (p) => `${p.by}|${p.target}`;
const pairKey = (x) => `${x.address}|${x.id}`;

/** A fresh maps object (T3) with entries recorded through recordId: { S: [[id, a, seq]], H, R, B: [ids] }. */
function mapsWith(spec = {}) {
  const { newMaps, recordId } = need('newMaps', 'recordId');
  const m = newMaps();
  for (const which of ['S', 'H', 'R']) {
    for (const [id, a, seq = 0] of spec[which] || []) recordId(m, which, id, a, seq);
  }
  for (const id of spec.B || []) m.B.add(id);
  return m;
}

/** resolveDeletion's result, checked for T6's shape. */
function resolved(r, label) {
  assert(r && typeof r === 'object' && Array.isArray(r.prompts) && typeof r.matchedNothing === 'boolean' && Number.isInteger(r.foreign),
    `${label}: resolveDeletion must return { prompts: [{ address, prompt }], matchedNothing, foreign } (T6), got ${show(r)}`);
  return r;
}
const promptKey = (x) => `${x.address}|${x.prompt && x.prompt.by}|${x.prompt && x.prompt.target}`;

/** gateAction's result against { act } or { act: false, held }. */
function gateIs(r, want, label) {
  assert(r && typeof r === 'object', `${label}: gateAction must return { act } or { act: false, held } (T16), got ${show(r)}`);
  eq(r.act, want.act, `${label}: act`);
  if (want.act === false) eq(r.held, want.held, `${label}: held`);
}

/** A report entry (ADR 0002 § The report): runId, ISO times, process. */
const runEntry = (runId, startedAt, endedAt) => ({ runId, startedAt: iso(startedAt), endedAt: endedAt == null ? null : iso(endedAt), process: { pid: 4242, startTime: '987654' } });

/** The T19 line objects. */
const J = {
  v: (id, a) => ({ t: 'v', id, a }),
  d: (a, p) => ({ t: 'd', a, p }),
  c: (id, a) => ({ t: 'c', id, a }),
  x: (a, dropped) => ({ t: 'x', a, dropped }),
  b: (id) => ({ t: 'b', id }),
  f: (id, a) => ({ t: 'f', id, a }),
  r: (a, runId, p) => ({ t: 'r', a, runId, p }),
  rc: (a, runId) => ({ t: 'rc', a, runId }),
  p: (a, code) => ({ t: 'p', a, code }),
  k: (runId, at) => ({ t: 'k', runId, at }),
};
const texts = (objs) => objs.map((o) => JSON.stringify(o));
/** replayJournal's result, checked for T19's shape. */
function replayed(out, label) {
  assert(out && typeof out === 'object' && out.maps && out.maps.S instanceof Map && out.maps.H instanceof Map
    && out.maps.B instanceof Set && out.maps.R instanceof Map,
  `${label}: replayJournal must return { maps: { S: Map, H: Map, B: Set, R: Map }, pending, rechecks, deadSeenAt, parked, skippedLines } (T19), got ${show(out && Object.keys(out))}`);
  assert(out.pending instanceof Map, `${label}: pending must be a Map<address, entry> (T19), got ${show(out.pending)}`);
  assert(Array.isArray(out.rechecks), `${label}: rechecks must be an array of { a, runId, entry } (T19), got ${show(out.rechecks)}`);
  assert(out.parked instanceof Map, `${label}: parked must be a Map<address, code> (T19), got ${show(out.parked)}`);
  assert(isPlainObject(out.deadSeenAt), `${label}: deadSeenAt must be a plain object from runId to milliseconds (T19, T25), got ${out.deadSeenAt instanceof Map ? `a Map ${show(out.deadSeenAt)}` : show(out.deadSeenAt)}`);
  assert(Number.isInteger(out.skippedLines), `${label}: skippedLines must be an integer (T19), got ${show(out.skippedLines)}`);
  return out;
}
/** A pending entry's T15 fields — { version, revokes, look } — for comparing with an entry (T19: pending is Map<address, entry>). */
const entryFields = (e) => (e && typeof e === 'object' ? { version: e.version, revokes: e.revokes, look: e.look } : e);

// ═══ Surface (T1, T2) ══════════════════════════════════════════════════════════════════════════════════════════
test('RP1: realtime.js sits in src/lib/tagging-edges/ and is pure CommonJS — it requires only its siblings, uses no clock, timer, randomness, hashing, process, network or logging, and holds no 64-hex literal (T1, T2; ADR 0003 Implementation notes: "pure; the folder\'s purity and no-64-hex guards cover it"; ADR 0015)', () => {
  if (!fs.existsSync(REALTIME)) throw new Error(`${REALTIME_REL} not implemented yet (the file does not exist)`);
  const raw = fs.readFileSync(REALTIME, 'utf8');
  // Behaviour, not vocabulary: comments are stripped before scanning, so a comment may name what the code avoids.
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  const problems = [];
  for (const bad of ['Date.now', 'new Date', 'Math.random', 'fetch(', 'crypto.', 'console.', 'process.', 'XMLHttpRequest', 'WebSocket', 'setTimeout', 'setInterval']) {
    if (src.includes(bad)) problems.push(`uses "${bad}"`);
  }
  if (/^\s*import\s/m.test(src) || /\bimport\(/.test(src)) problems.push('uses an ESM import');
  for (const m of src.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    if (!m[1].startsWith('./')) problems.push(`require('${m[1]}') is not a sibling './' path`);
  }
  if (/\brequire\(\s*[^'"\s]/.test(src)) problems.push('a require() of a computed name');
  const hex = raw.match(/[0-9a-f]{64}/i);
  if (hex) problems.push(`a 64-hex literal (${hex[0].slice(0, 12)}…): both stamp pubkeys are parameters`);
  assert(problems.length === 0, `${REALTIME_REL}:\n        ${problems.join('\n        ')}`);
});

test('RP2: realtime.js exports every name T2 lists — LIMITS and the 27 functions (T2)', () => {
  const m = load();
  const missing = T2_FUNCTIONS.filter((f) => typeof m[f] !== 'function');
  if (!(m.LIMITS && typeof m.LIMITS === 'object')) missing.unshift('LIMITS (an object)');
  same(missing, [], `${REALTIME_REL}: exports missing (T2)`);
});

test('RP3: src/lib/tagging-edges/index.js re-exports every realtime.js name, as the same value (ADR 0003 Implementation notes: "re-exported from src/lib/tagging-edges/index.js")', () => {
  const m = load();
  let index;
  try { index = require(LIB_INDEX); } catch (e) { throw new Error(`src/lib/tagging-edges/index.js failed to load: ${firstLine(e)}`); }
  const notReexported = ['LIMITS', ...T2_FUNCTIONS].filter((k) => index[k] === undefined || index[k] !== m[k]);
  same(notReexported, [], 'names src/lib/tagging-edges/index.js does not re-export from ./realtime');
});

test('RP4: LIMITS holds exactly the Implementation notes\' keys and values — the byte values as numbers — and is frozen (T2; ADR 0003 Implementation notes "LIMITS (frozen)")', () => {
  const { LIMITS } = load();
  same(LIMITS, {
    roundAddresses: 500, roundCatchUpShare: 100, filtersPerScan: 200, writeRows: 25, elementIds: 1000,
    backlogAddresses: 20000, catchUpChunk: 5000, roundKeptBytes: 16777216, roundScanMaxBytes: 8388608,
    candidateScanMaxBytes: 8388608, argvFilterBytes: 100000, aTargetMaxBytes: 255, journalCompactBytes: 1048576,
    journalFlushMs: 250,
  }, 'LIMITS');
  assert(Object.isFrozen(LIMITS), 'LIMITS must be frozen (Object.freeze): nothing configures the path\'s bounds');
});

test('RP5: src/lib/strfryScanStrict.js re-exports realtime.js\'s escapeFilterArgv — the same function — so scanStrict and the planner size filters with the one escape (T1)', () => {
  const m = load();
  let s;
  try { s = require(SCAN_STRICT); } catch (e) { throw new Error(`${SCAN_STRICT_REL} failed to load: ${firstLine(e)}`); }
  assert(typeof s.escapeFilterArgv === 'function', `${SCAN_STRICT_REL} does not re-export escapeFilterArgv yet (T1: it requires it from ./tagging-edges/realtime and re-exports it); exports are ${show(Object.keys(s))}`);
  assert(s.escapeFilterArgv === m.escapeFilterArgv, `${SCAN_STRICT_REL}'s escapeFilterArgv is not realtime.js's function (T1: one escape for both)`);
});

// ═══ T1: the argv escape and its size ══════════════════════════════════════════════════════════════════════════
test('RP6: escapeFilterArgv is JSON.stringify(filter) with every "/" written "\\/" — JSON-equivalent, for a filter or an array of filters — so no argv carries the pass\'s pgrep pattern, even when a publisher\'s d does (T1; ADR 0003 § Where it runs "No command line of the path matches the pass\'s pgrep pattern"; AC-5)', () => {
  const escapeFilterArgv = fn('escapeFilterArgv');
  const rows = [
    { name: 'the stamped subscription filter', f: { kinds: [39999], '#z': [STAMP(CANONICAL), STAMP(LOCAL)], limit: 0 } },
    { name: 'a d with slashes', f: { kinds: [39999], authors: [ALICE], '#d': ['a/b//c/'] } },
    { name: 'a d carrying the pass\'s pgrep pattern', f: { kinds: [39999], authors: [ALICE], '#d': [`x /usr/local/lib/node_modules/brainstorm/src/${PGREP_PATTERN}.js y`] } },
    { name: 'backslashes next to slashes', f: { kinds: [39999], '#d': ['\\/', '/\\', '\\\\//', '\\'] } },
    { name: 'quotes, a newline, a tab and non-ASCII', f: { kinds: [39999], '#d': ['"q"\n\t/é中😀/'] } },
    { name: 'an id and address filter', f: { kinds: [5], authors: [ALICE], '#a': [addr('p/q')], '#e': [idOf('rp:esc')] } },
    { name: 'an array of two filters (the filter may be an array)', f: [{ kinds: [39999], authors: [ALICE], '#d': ['p/q'] }, { kinds: [39999], authors: [BOB], '#d': [`${PGREP_PATTERN}`] }] },
  ];
  cases(rows, ({ f }) => {
    const out = escapeFilterArgv(f);
    eq(typeof out, 'string', 'escapeFilterArgv returns a string');
    eq(out, refEscape(f), 'JSON.stringify(filter) with every "/" written "\\/"');
    same(JSON.parse(out), f, 'the text parses back to the same filter (JSON-equivalent: strfry reads the same filter)');
    assert(!out.includes(PGREP_PATTERN), `the argv text carries the pass's pgrep pattern: ${show(out)}`);
  });
});

test('RP7: filterArgvBytes is the escaped text\'s UTF-8 byte length — not its character count, and counting each "\\/" as two bytes (T1)', () => {
  const filterArgvBytes = fn('filterArgvBytes');
  const rows = [
    { name: 'ASCII', f: { kinds: [39999], authors: [ALICE], '#d': ['abc'] } },
    { name: 'two-byte characters', f: { kinds: [39999], '#d': ['é'.repeat(10)] } },
    { name: 'three-byte characters and a slash', f: { kinds: [39999], '#d': ['中/中'] } },
    { name: 'a four-byte character and a slash', f: { kinds: [39999], '#d': ['😀/'] } },
    { name: '255 slashes', f: { kinds: [39999], '#d': ['/'.repeat(255)] } },
    { name: 'an array of filters', f: [{ kinds: [39999], '#d': ['中/'] }, { kinds: [5], '#e': [idOf('rp:bytes')] }] },
  ];
  // Fixture check: the multi-byte rows really differ in bytes and characters, so a character count fails them.
  assert(refBytes(rows[2].f) !== refEscape(rows[2].f).length, 'fixture: the three-byte row should differ in bytes and characters');
  cases(rows, ({ f }) => eq(filterArgvBytes(f), refBytes(f), 'filterArgvBytes(filter)'));
});

// ═══ T3: the maps ══════════════════════════════════════════════════════════════════════════════════════════════
test('RP8: newMaps() gives fresh, empty { S: Map, H: Map, B: Set, R: Map }; recordId(maps, which, id, address, seq) sets one { a, seq } entry in the named map only, and re-recording replaces it; moving H to S is recordId(\'S\') plus H.delete (T3)', () => {
  const { newMaps, recordId } = need('newMaps', 'recordId');
  const m = newMaps();
  assert(m && m.S instanceof Map && m.H instanceof Map && m.R instanceof Map && m.B instanceof Set,
    `newMaps() must return { S: Map, H: Map, B: Set, R: Map } (T3), got ${show(m)}`);
  same([m.S.size, m.H.size, m.B.size, m.R.size], [0, 0, 0, 0], 'a new maps object is empty');
  const m2 = newMaps();
  assert(m2.S !== m.S && m2.H !== m.H && m2.B !== m.B && m2.R !== m.R, 'each newMaps() call returns its own Maps and Set');
  const A = addr('rp-maps');
  const B2 = addr('rp-maps-2');
  const [i1, i2, i3] = [idOf('rp:maps:1'), idOf('rp:maps:2'), idOf('rp:maps:3')];
  recordId(m, 'S', i1, A, 3);
  same(m.S.get(i1), { a: A, seq: 3 }, "recordId(maps, 'S', …) sets S's entry");
  same([m.H.size, m.R.size, m.B.size], [0, 0, 0], "recordId(maps, 'S', …) touches no other map");
  recordId(m, 'H', i2, A, 4);
  same(m.H.get(i2), { a: A, seq: 4 }, "recordId(maps, 'H', …) sets H's entry");
  eq(m.S.has(i2), false, "recordId(maps, 'H', …) does not add to S");
  recordId(m, 'R', i3, B2, 5);
  same(m.R.get(i3), { a: B2, seq: 5 }, "recordId(maps, 'R', …) sets R's entry (refusedSeen)");
  recordId(m, 'S', i1, A, 9);
  same(m.S.get(i1), { a: A, seq: 9 }, 're-recording an id replaces its entry');
  eq(m.S.size, 1, 're-recording an id keeps one entry');
  recordId(m, 'S', i2, A, 10);
  m.H.delete(i2);
  same([m.S.get(i2), m.H.has(i2)], [{ a: A, seq: 10 }, false], 'H → S: recordId(maps, \'S\', …) plus maps.H.delete(id)');
});

// ═══ T4: the subscription ══════════════════════════════════════════════════════════════════════════════════════
test('RP9: subscriptionFilters gives exactly two live-only filters — stamped kind 39999 with both nostr-user-tag stamps, and kind 5 — each with limit 0 and no since, until, authors or ids (T4; ADR 0003 § What it hears "The subscription"; AC-1: back-dated events are delivered only when no filter has since)', () => {
  const subscriptionFilters = fn('subscriptionFilters');
  const out = subscriptionFilters({ canonicalPubkey: CANONICAL, localPubkey: LOCAL });
  assert(Array.isArray(out) && out.length === 2, `subscriptionFilters must return two filters (T4), got ${show(out)}`);
  const [tagging, deletions] = out;
  same(Object.keys(tagging).sort(), ['#z', 'kinds', 'limit'], 'the tagging filter\'s keys (no since, until, authors or ids)');
  same(tagging.kinds, [39999], 'the tagging filter\'s kinds');
  eq(tagging.limit, 0, 'the tagging filter\'s limit (live only: EOSE at once)');
  sameSet(tagging['#z'], [STAMP(CANONICAL), STAMP(LOCAL)], 'the tagging filter\'s #z: both nostr-user-tag stamps, each once');
  same(deletions, { kinds: [5], limit: 0 }, 'the deletion filter');
});

test('RP10: when the two identities are equal, the #z list names the stamp once (T4 "(distinct)")', () => {
  const subscriptionFilters = fn('subscriptionFilters');
  const out = subscriptionFilters({ canonicalPubkey: CANONICAL, localPubkey: CANONICAL });
  assert(Array.isArray(out) && out[0] && Array.isArray(out[0]['#z']), `subscriptionFilters must return two filters (T4), got ${show(out)}`);
  same(out[0]['#z'], [STAMP(CANONICAL)], 'the tagging filter\'s #z');
});

test('RP11: subscriptionFilters throws, building nothing, when either identity is one checkIdentity refuses — missing, null, empty, upper-case, 63 hex or not hex (T4; AC-3 bad setup; ADR 0001 A3)', () => {
  const subscriptionFilters = fn('subscriptionFilters');
  const bad = [
    ['missing', undefined], ['null', null], ['empty', ''], ['upper-case', UPPER_HEX],
    ['63 hex', 'ab'.repeat(31) + 'a'], ['not hex', 'g'.repeat(64)], ['padded', ` ${LOCAL.slice(1)}`],
  ];
  const rows = [];
  for (const [what, v] of bad) {
    rows.push({ name: `canonical ${what}`, ids: { canonicalPubkey: v, localPubkey: LOCAL } });
    rows.push({ name: `local ${what}`, ids: { canonicalPubkey: CANONICAL, localPubkey: v } });
  }
  cases(rows, ({ ids }) => {
    let out;
    try { out = subscriptionFilters(ids); } catch (_) { return; }
    throw new Error(`expected a throw, got ${show(out)}`);
  });
});

// ═══ T5: a version prompt ══════════════════════════════════════════════════════════════════════════════════════
test('RP12: promptFromVersion gives { address, id } for a kind 39999 carrying either nostr-user-tag stamp — the contract edge\'s address, or a refusal\'s address for a non-tagging version — and null for anything else, a stamped version the contract gives no address for included (T5; T25 "returns null whenever there is no address"; ADR 0003 § What it hears "A stamped kind 39999"; AC-1, any author and either stamp)', () => {
  const promptFromVersion = fn('promptFromVersion');
  const P = (d, tag, o = {}) => makeTagging({ d, id: idOf(`rp:pfv:${tag}`), ...o });
  const rows = [
    { name: 'the canonical stamp', ev: P('rp-pfv-c', 'c'), want: addr('rp-pfv-c') },
    { name: 'this deployment\'s own stamp only', ev: P('rp-pfv-l', 'l', { stamps: [STAMP(LOCAL)] }), want: addr('rp-pfv-l') },
    { name: 'both stamps', ev: P('rp-pfv-b', 'b', { stamps: [STAMP(CANONICAL), STAMP(LOCAL)] }), want: addr('rp-pfv-b') },
    { name: 'another author', ev: P('rp-pfv-dave', 'dave', { author: DAVE }), want: addr('rp-pfv-dave', DAVE) },
    { name: 'a d holding colons', ev: P('rp:pfv:colon', 'colon'), want: addr('rp:pfv:colon') },
    { name: 'an over-long first d, then a usable one (strfry files it under the second)', ev: P('L'.repeat(300), 'long', { extraDTags: ['rp-pfv-second'] }), want: addr('rp-pfv-second') },
    { name: 'a non-tagging (no target): the refusal\'s address', ev: makeNonTagging({ address: addr('rp-pfv-nt'), refusal: 'no-target', id: idOf('rp:pfv:nt') }), want: addr('rp-pfv-nt') },
    { name: 'a non-tagging (several targets)', ev: makeNonTagging({ address: addr('rp-pfv-nt2'), refusal: 'several-targets', id: idOf('rp:pfv:nt2') }), want: addr('rp-pfv-nt2') },
    { name: 'a non-tagging (bad tag address)', ev: makeNonTagging({ address: addr('rp-pfv-nt3'), refusal: 'bad-tag-address', id: idOf('rp:pfv:nt3') }), want: addr('rp-pfv-nt3') },
    { name: 'only another deployment\'s stamp', ev: P('rp-pfv-o', 'o', { stamps: [STAMP(OTHER_DEPLOY)] }), want: null },
    { name: 'no stamp at all', ev: P('rp-pfv-n', 'n', { stamps: [] }), want: null },
    { name: 'a tag element (a :tag stamp only)', ev: makeElement(), want: null },
    { name: 'a kind-5 deletion', ev: makeDeletion({ e: [idOf('rp:pfv:c')], id: idOf('rp:pfv:k5') }), want: null },
    { name: 'kind 30000 carrying the stamp', ev: P('rp-pfv-k', 'k', { kind: 30000 }), want: null },
    { name: 'null', ev: null, want: null },
    { name: 'a string', ev: 'not an event', want: null },
    // A stamped kind 39999 the contract can give no address for: no prompt — null, not { address: null } (T25).
    { name: 'stamped, but no d', ev: P(null, 'nod'), want: null },
    { name: 'stamped, but only an over-long d', ev: P('L'.repeat(256), 'onlylong'), want: null },
    { name: 'stamped, but a negative created_at', ev: P('rp-pfv-neg', 'neg', { createdAt: -1 }), want: null },
  ];
  cases(rows, ({ ev, want }) => {
    const r = promptFromVersion(ev, IDENTITIES);
    if (want === null) { eq(r, null, 'promptFromVersion'); return; }
    same(r, { address: want, id: ev.id }, 'promptFromVersion');
  });
});

test('RP13: a version printed with upper-case hex — its id, its pubkey or both — yields no prompt: the contract refuses it at step 1 with no address, so promptFromVersion gives null (T25: T5\'s "id is lower-cased" is moot; ADR 0003 facts: strfry prints events as published)', () => {
  const promptFromVersion = fn('promptFromVersion');
  const { taggingToEdge } = contract();
  const base = makeTagging({ author: DAVE, d: 'rp-pfv-up', id: idOf('rp:pfv:up') });
  hasLetters(base.id, 'the event id');
  hasLetters(DAVE, 'DAVE');
  same(promptFromVersion(base, IDENTITIES), { address: addr('rp-pfv-up', DAVE), id: base.id }, 'control: the same version in lower-case hex');
  const rows = [
    { name: 'upper-case id', ev: { ...base, id: base.id.toUpperCase() } },
    { name: 'upper-case pubkey', ev: { ...base, pubkey: DAVE.toUpperCase() } },
    { name: 'both upper-case', ev: { ...base, id: base.id.toUpperCase(), pubkey: DAVE.toUpperCase() } },
  ];
  cases(rows, ({ ev }) => {
    const c = taggingToEdge(ev, IDENTITIES);
    assert(c && c.ok === false && c.address === undefined, `fixture: the contract refuses the event with no address, got ${show(c)}`);
    eq(promptFromVersion(ev, IDENTITIES), null, 'promptFromVersion');
  });
});

// ═══ T6: a deletion resolved on receipt ════════════════════════════════════════════════════════════════════════
test('RP14: a deletion\'s e target resolves through the seen map, then the heard map, to one revoke prompt { type: \'revoke\', kind5Id, created_at, by: \'e\', target } at that id\'s address — an upper-case e included, its target lower-cased (T6; ADR 0003 § What it hears "resolved on receipt, in memory"; AC-2)', () => {
  const resolveDeletion = fn('resolveDeletion');
  const AS = addr('rp-rd-s');
  const AH = addr('rp-rd-h');
  const idS = idOf('rp:rd:s');
  const idH = idOf('rp:rd:h');
  hasLetters(idS, 'idS');
  const maps = mapsWith({ S: [[idS, AS, 1]], H: [[idH, AH, 2]] });
  const k5 = (e, tag, createdAt) => makeDeletion({ author: ALICE, e, id: idOf(`rp:rd:k5:${tag}`), createdAt });
  const rows = [
    { name: 'an id the seen map records', ev: k5([idS], 's', 3000), address: AS, target: idS },
    { name: 'an id only the heard map records', ev: k5([idH], 'h', 3100), address: AH, target: idH },
    { name: 'an upper-case e', ev: k5([idS.toUpperCase()], 'up', 3200), address: AS, target: idS },
  ];
  cases(rows, ({ ev, address, target }) => {
    const r = resolved(resolveDeletion(ev, maps, new Set()), 'resolveDeletion');
    eq(r.prompts.length, 1, 'prompts');
    eq(r.prompts[0].address, address, 'the prompt\'s address');
    same(r.prompts[0].prompt, { type: 'revoke', kind5Id: ev.id, created_at: ev.created_at, by: 'e', target }, 'the revoke prompt');
    same([r.matchedNothing, r.foreign], [false, 0], '[matchedNothing, foreign]');
  });
});

test('RP15: a deletion\'s a target resolves only at an address the path knows — a seen or heard id there, or the graph\'s keys — to a by-a revoke prompt; a kind-5 whose a targets hold nothing queues nothing and matches nothing (T6; ADR 0003 § What it hears; planner list "A kind-5 whose a targets hold nothing queues nothing")', () => {
  const resolveDeletion = fn('resolveDeletion');
  const AS = addr('rp-rd-as');
  const AH = addr('rp-rd-ah');
  const AG = addr('rp-rd-ag');
  const AU = addr('rp-rd-au');
  const maps = mapsWith({ S: [[idOf('rp:rd:as'), AS, 1]], H: [[idOf('rp:rd:ah'), AH, 2]] });
  const graph = new Set([AG]);
  const k = makeDeletion({ author: ALICE, a: [AS, AH, AG, AU], id: idOf('rp:rd:k5:a'), createdAt: 4000 });
  const r = resolved(resolveDeletion(k, maps, graph), 'resolveDeletion (known and unknown addresses)');
  sameSet(r.prompts.map((x) => x.address), [AS, AH, AG], 'addresses prompted (the unknown one queues nothing)');
  for (const x of r.prompts) {
    same(x.prompt, { type: 'revoke', kind5Id: k.id, created_at: 4000, by: 'a', target: x.address }, `the revoke prompt at ${x.address}`);
  }
  same([r.matchedNothing, r.foreign], [false, 0], '[matchedNothing, foreign]');
  const junk = makeDeletion({ author: ALICE, a: [AU, addr('rp-rd-junk')], id: idOf('rp:rd:k5:junk'), createdAt: 4100 });
  const r2 = resolved(resolveDeletion(junk, maps, graph), 'resolveDeletion (only unknown addresses)');
  same([r2.prompts, r2.matchedNothing, r2.foreign], [[], true, 0], '[prompts, matchedNothing, foreign] for a kind-5 naming only unknown addresses');
});

test('RP16: an a target counts only up to 255 UTF-8 bytes — an address of exactly 255 bytes resolves, one of 256 (still a tagging address) is ignored even when the path and the graph know it — while that version\'s e target still resolves (T6; ADR 0003 facts: strfry acts on no longer tag value; planner list "An a target over 255 bytes")', () => {
  const resolveDeletion = fn('resolveDeletion');
  const A255 = addr('b'.repeat(184));
  const A256 = addr('b'.repeat(185));
  eq(Buffer.byteLength(A255, 'utf8'), 255, 'fixture: the 255-byte address');
  eq(Buffer.byteLength(A256, 'utf8'), 256, 'fixture: the 256-byte address');
  const [i255, i256] = [idOf('rp:rd:255'), idOf('rp:rd:256')];
  const maps = mapsWith({ S: [[i255, A255, 1], [i256, A256, 1]] });
  const graph = new Set([A255, A256]);
  const both = makeDeletion({ author: ALICE, a: [A255, A256], id: idOf('rp:rd:k5:len'), createdAt: 5000 });
  const r = resolved(resolveDeletion(both, maps, graph), 'resolveDeletion (255 and 256 bytes)');
  same(r.prompts.map((x) => x.address), [A255], 'addresses prompted');
  const long = makeDeletion({ author: ALICE, a: [A256], id: idOf('rp:rd:k5:long'), createdAt: 5100 });
  const r2 = resolved(resolveDeletion(long, maps, graph), 'resolveDeletion (256 bytes only)');
  same([r2.prompts, r2.matchedNothing, r2.foreign], [[], true, 0], '[prompts, matchedNothing, foreign] for a 256-byte a');
  const byId = makeDeletion({ author: ALICE, e: [i256], id: idOf('rp:rd:k5:longid'), createdAt: 5200 });
  const r3 = resolved(resolveDeletion(byId, maps, graph), 'resolveDeletion (that version by e)');
  same(r3.prompts.map(promptKey), [`${A256}|e|${i256}`], 'the long address\'s version, named by e, resolves');
});

test('RP17: an a target whose kind is spelled any other way — leading zeros, a plus sign, a space — or that names another kind is no tagging address and resolves nothing, even when the canonical address is known (T6; ADR 0003 owner decision 2: such a deletion waits for the pass)', () => {
  const resolveDeletion = fn('resolveDeletion');
  const A = addr('rp-rd-kind');
  const maps = mapsWith({ S: [[idOf('rp:rd:kind'), A, 1]] });
  const graph = new Set([A]);
  const spellings = [
    ['leading zero', `039999:${ALICE}:rp-rd-kind`],
    ['two leading zeros', `0039999:${ALICE}:rp-rd-kind`],
    ['plus sign', `+39999:${ALICE}:rp-rd-kind`],
    ['leading space', ` 39999:${ALICE}:rp-rd-kind`],
    ['kind 39998', `39998:${ALICE}:rp-rd-kind`],
    ['kind 30000', `30000:${ALICE}:rp-rd-kind`],
  ];
  cases(spellings.map(([name, a], i) => ({ name, a, i })), ({ a, i }) => {
    const ev = makeDeletion({ author: ALICE, a: [a], id: idOf(`rp:rd:k5:kind:${i}`), createdAt: 6000 });
    const r = resolved(resolveDeletion(ev, maps, graph), 'resolveDeletion');
    same([r.prompts, r.matchedNothing, r.foreign], [[], true, 0], '[prompts, matchedNothing, foreign]');
  });
});

test('RP18: a live a target spelling its pubkey in upper-case hex resolves at the lower-case address the path knows, and the by-a prompt\'s target is that normalised address, not the spelling the kind-5 carried (revokeTargets normalises it; T6; T25 "A by: \'a\' prompt\'s target is revokeTargets\' normalised address"; ADR 0003 owner decision 2: only "during downtime" does that spelling wait for the pass)', () => {
  const resolveDeletion = fn('resolveDeletion');
  hasLetters(DAVE, 'DAVE');
  const A = addr('rp-rd-upk', DAVE);
  const raw = `39999:${DAVE.toUpperCase()}:rp-rd-upk`;
  const maps = mapsWith({ S: [[idOf('rp:rd:upk'), A, 1]] });
  const k = makeDeletion({ author: DAVE, a: [raw], id: idOf('rp:rd:k5:upk'), createdAt: 6100 });
  same(contract().revokeTargets(k).addresses, [A], 'fixture: revokeTargets normalises the address (pubkey lower-cased)');
  const r = resolved(resolveDeletion(k, maps, new Set()), 'resolveDeletion');
  same(r.prompts.map(promptKey), [`${A}|a|${A}`], 'one by-a prompt at the lower-case address');
  same(r.prompts[0].prompt, { type: 'revoke', kind5Id: k.id, created_at: 6100, by: 'a', target: A }, 'the revoke prompt (target: the normalised address)');
});

test('RP19: another author\'s kind-5 prompts nothing — each of its targets that resolves to a known tagging of someone else adds 1 to foreign — and a target the path does not know costs nothing, not even a foreign count (T6; ADR 0003 D5-A, owner decision 3; AC-2 "a kind-5 from another author" removes nothing)', () => {
  const resolveDeletion = fn('resolveDeletion');
  const A = addr('rp-rd-f');
  const AG = addr('rp-rd-fg');
  const idA = idOf('rp:rd:f');
  const maps = mapsWith({ S: [[idA, A, 1]] });
  const graph = new Set([AG]);
  const k = makeDeletion({ author: BOB, e: [idA], a: [A, AG], id: idOf('rp:rd:k5:f'), createdAt: 7000 });
  const r = resolved(resolveDeletion(k, maps, graph), 'resolveDeletion (Bob naming Alice\'s recorded id and her known addresses)');
  same([r.prompts, r.foreign, r.matchedNothing], [[], 3, false], '[prompts, foreign, matchedNothing]');
  const unknown = makeDeletion({ author: BOB, e: [idOf('rp:rd:f:unknown')], a: [addr('rp-rd-f-unknown')], id: idOf('rp:rd:k5:f2'), createdAt: 7100 });
  const r2 = resolved(resolveDeletion(unknown, maps, graph), 'resolveDeletion (Bob naming what the path does not know)');
  same([r2.prompts, r2.foreign, r2.matchedNothing], [[], 0, true], '[prompts, foreign, matchedNothing]');
});

test('RP20: prompts are de-duplicated by (address, by, target) — an id named in both cases, an address named in both pubkey spellings — while two ids at one address, or an e and an a at one address, stay separate prompts (T6)', () => {
  const resolveDeletion = fn('resolveDeletion');
  hasLetters(DAVE, 'DAVE');
  const A = addr('rp-rd-dd', DAVE);
  const [i1, i2] = [idOf('rp:rd:dd:1'), idOf('rp:rd:dd:2')];
  hasLetters(i1, 'i1');
  const maps = mapsWith({ S: [[i1, A, 1]], H: [[i2, A, 2]] });
  const k = makeDeletion({
    author: DAVE,
    e: [i1, i1.toUpperCase(), i2],
    a: [A, `39999:${DAVE.toUpperCase()}:rp-rd-dd`],
    id: idOf('rp:rd:k5:dd'),
    createdAt: 8000,
  });
  const r = resolved(resolveDeletion(k, maps, new Set([A])), 'resolveDeletion');
  sameSet(r.prompts.map(promptKey), [`${A}|e|${i1}`, `${A}|e|${i2}`, `${A}|a|${A}`], 'prompts (address|by|target)');
  same([r.matchedNothing, r.foreign], [false, 0], '[matchedNothing, foreign]');
});

test('RP21: anything that is not a well-formed kind 5 gives { prompts: [], matchedNothing: true, foreign: 0 }, even when it names a recorded id (T6)', () => {
  const resolveDeletion = fn('resolveDeletion');
  const A = addr('rp-rd-nd');
  const id = idOf('rp:rd:nd');
  const maps = mapsWith({ S: [[id, A, 1]] });
  const graph = new Set([A]);
  const good = makeDeletion({ author: ALICE, e: [id], a: [A], id: idOf('rp:rd:k5:nd'), createdAt: 9000 });
  const rows = [
    { name: 'a tagging', ev: makeTagging({ d: 'rp-rd-nd', id: idOf('rp:rd:nd:t'), extraTags: [['e', id]] }) },
    { name: 'kind 1 with the same tags', ev: { ...good, kind: 1 } },
    { name: 'an id that is not 64 hex', ev: { ...good, id: 'not-an-id' } },
    { name: 'a negative created_at', ev: { ...good, created_at: -1 } },
    { name: 'no tags array', ev: { ...good, tags: null } },
    { name: 'null', ev: null },
    { name: 'a string', ev: 'kind 5' },
  ];
  cases(rows, ({ ev }) => same(resolveDeletion(ev, maps, graph), { prompts: [], matchedNothing: true, foreign: 0 }, 'resolveDeletion'));
});

test('RP22: one kind-5 naming its author\'s recorded id, an id nobody recorded and another author\'s recorded id gives one prompt, foreign 1 and matchedNothing false (T6: matchedNothing is prompts.length === 0 && foreign === 0)', () => {
  const resolveDeletion = fn('resolveDeletion');
  const AA = addr('rp-rd-mix');
  const AC = addr('rp-rd-mix', CAROL);
  const [ia, ic] = [idOf('rp:rd:mix:a'), idOf('rp:rd:mix:c')];
  const maps = mapsWith({ S: [[ia, AA, 1], [ic, AC, 1]] });
  const k = makeDeletion({ author: ALICE, e: [ia, idOf('rp:rd:mix:none'), ic], id: idOf('rp:rd:k5:mix'), createdAt: 9100 });
  const r = resolved(resolveDeletion(k, maps, new Set()), 'resolveDeletion');
  same(r.prompts.map(promptKey), [`${AA}|e|${ia}`], 'prompts');
  same([r.foreign, r.matchedNothing], [1, false], '[foreign, matchedNothing]');
});

// ═══ T7: a read's shrink ═══════════════════════════════════════════════════════════════════════════════════════
test('RP23: shrinkOnRead drops, from S, H and R (refusedSeen), the ids recorded at the address at or before the capture, other than the id the read returned, and drops them from B; ids heard after the capture, the returned id and other addresses stay (T7; ADR 0003 § "S, H, B and refusedSeen shrink"; planner list "refusedSeen shrinking")', () => {
  const shrinkOnRead = fn('shrinkOnRead');
  const A = addr('rp-sh');
  const OTHER = addr('rp-sh-other');
  const id = (n) => idOf(`rp:sh:${n}`);
  const maps = mapsWith({
    S: [[id('s-old'), A, 1], [id('s-ret'), A, 5], [id('s-other'), OTHER, 1]],
    H: [[id('h-before'), A, 2], [id('h-after'), A, 10]],
    R: [[id('r-at'), A, 3], [id('r-other'), OTHER, 3]],
    B: [id('s-old'), id('s-other')],
  });
  const r = shrinkOnRead(maps, A, id('s-ret'), 5);
  assert(r && Array.isArray(r.dropped), `shrinkOnRead must return { dropped: [ids] } (T7), got ${show(r)}`);
  sameSet(uniq(r.dropped), [id('s-old'), id('h-before'), id('r-at')], 'dropped');
  sameSet([...maps.S.keys()], [id('s-ret'), id('s-other')], 'S after the read (the returned id and the other address stay)');
  sameSet([...maps.H.keys()], [id('h-after')], 'H after the read (an id heard after the capture may be stored after the scan\'s snapshot: kept)');
  sameSet([...maps.R.keys()], [id('r-other')], 'R after the read');
  sameSet([...maps.B], [id('s-other')], 'B after the read (B only ever shrinks)');
});

test('RP24: an empty read (returnedId null) drops every id recorded at the address up to the capture — an entry recorded at the capture itself included, one recorded after it kept (T7: seq <= captureSeq)', () => {
  const shrinkOnRead = fn('shrinkOnRead');
  const A = addr('rp-sh-empty');
  const id = (n) => idOf(`rp:sh:e:${n}`);
  const maps = mapsWith({ S: [[id('at'), A, 5], [id('after'), A, 6]], H: [[id('h'), A, 4]], R: [[id('r'), A, 3]], B: [id('at'), id('after')] });
  const r = shrinkOnRead(maps, A, null, 5);
  assert(r && Array.isArray(r.dropped), `shrinkOnRead must return { dropped: [ids] } (T7), got ${show(r)}`);
  sameSet(uniq(r.dropped), [id('at'), id('h'), id('r')], 'dropped');
  sameSet([...maps.S.keys()], [id('after')], 'S');
  same([maps.H.size, maps.R.size], [0, 0], '[H size, R size]');
  sameSet([...maps.B], [id('after')], 'B');
});

// ═══ T8: compaction ════════════════════════════════════════════════════════════════════════════════════════════
test('RP25: compact keeps every entry recorded after the scan began; otherwise S and R keep only scanned ids, H keeps scanned or candidate ids not in S, and B becomes B ∩ scanned — scannedIds and candidateIds given as plain Sets (T8; T25 container types; ADR 0003 § The catch-up step 6)', () => {
  const compact = fn('compact');
  const A = addr('rp-cp');
  const id = (n) => idOf(`rp:cp:${n}`);
  const maps = mapsWith({
    S: [[id('s-scanned'), A, 1], [id('s-gone'), A, 1], [id('s-late'), A, 9], [id('b-scanned'), A, 0], [id('b-gone'), A, 0]],
    H: [[id('h-scanned'), A, 2], [id('h-cand'), A, 2], [id('h-neither'), A, 2], [id('h-late'), A, 7], [id('s-scanned'), A, 2]],
    R: [[id('r-scanned'), A, 3], [id('r-gone'), A, 3], [id('r-late'), A, 8]],
    B: [id('b-scanned'), id('b-gone')],
  });
  const scanned = new Set([id('s-scanned'), id('b-scanned'), id('h-scanned'), id('r-scanned')]);
  const candidates = new Set([id('h-cand')]);
  compact(maps, scanned, candidates, 5);
  sameSet([...maps.S.keys()], [id('s-scanned'), id('s-late'), id('b-scanned')], 'S: scanned ids, plus what was recorded after the scan began');
  sameSet([...maps.H.keys()], [id('h-scanned'), id('h-cand'), id('h-late')], 'H: scanned or candidate ids not in S, plus what was heard after the scan began');
  sameSet([...maps.R.keys()], [id('r-scanned'), id('r-late')], 'R: scanned ids, plus what was recorded after the scan began');
  sameSet([...maps.B], [id('b-scanned')], 'B: B ∩ scanned');
});

// ═══ T9: arrivals and look-only prompts ════════════════════════════════════════════════════════════════════════
test('RP26: an arrival is a scanned id not in S — one never heard (back-dated history arrives the same way) and one heard but still pending in H alike — while an id S records is no arrival (T9; ADR 0003 § The catch-up step 2; AC-4)', () => {
  const arrivalsAndLookOnly = fn('arrivalsAndLookOnly');
  const [A1, A2, A3] = [addr('rp-ar-1'), addr('rp-ar-2'), addr('rp-ar-3')];
  const [n1, h1, s1] = [idOf('rp:ar:n1'), idOf('rp:ar:h1'), idOf('rp:ar:s1')];
  const maps = mapsWith({ H: [[h1, A2, 3]], S: [[s1, A3, 1]] });
  const r = arrivalsAndLookOnly([[n1, A1], [h1, A2], [s1, A3]], maps, new Map([[A3, s1]]));
  assert(r && Array.isArray(r.arrivals) && Array.isArray(r.lookOnly), `arrivalsAndLookOnly must return { arrivals: [{ address, id }], lookOnly: [address] } (T9), got ${show(r)}`);
  sameSet(r.arrivals.map(pairKey), [`${A1}|${n1}`, `${A2}|${h1}`], 'arrivals');
  same(r.lookOnly, [], 'lookOnly');
});

test('RP27: a look-only prompt goes to (i) an address where the graph records another event id, or (ii) an address the graph does not hold whose scanned id is in S but not in B — never to one whose id is in S and B (the backfill\'s), nor where the graph holds the same id (T9; ADR 0003 § The catch-up step 2)', () => {
  const arrivalsAndLookOnly = fn('arrivalsAndLookOnly');
  const a = (n) => addr(`rp-lo-${n}`);
  const id = (n) => idOf(`rp:lo:${n}`);
  const maps = mapsWith({
    S: [[id('x1'), a('x1'), 1], [id('x2'), a('x2'), 1], [id('x3'), a('x3'), 1], [id('x4'), a('x4'), 1], [id('x5'), a('x5'), 1]],
    B: [id('x3'), id('x5')],
  });
  const graph = new Map([[a('x1'), id('other1')], [a('x4'), id('x4')], [a('x5'), id('other5')]]);
  const pairs = ['x1', 'x2', 'x3', 'x4', 'x5'].map((n) => [id(n), a(n)]);
  const r = arrivalsAndLookOnly(pairs, maps, graph);
  assert(r && Array.isArray(r.arrivals) && Array.isArray(r.lookOnly), `arrivalsAndLookOnly must return { arrivals, lookOnly } (T9), got ${show(r)}`);
  same(r.arrivals, [], 'arrivals (every id is in S)');
  sameSet(r.lookOnly, [a('x1'), a('x2'), a('x5')], 'lookOnly: (i) x1 and x5 (another id in the graph; B does not matter), (ii) x2 (S \\ B, graph empty); not x3 (S ∩ B) or x4 (same id)');
});

test('RP28: an (id, address) in refusedSeen gets no look-only prompt, under (i) or (ii); without that entry the same scan gives both (T9 "An (id, address) in R is excluded")', () => {
  const arrivalsAndLookOnly = fn('arrivalsAndLookOnly');
  const [A1, A2] = [addr('rp-lo-r1'), addr('rp-lo-r2')];
  const [y1, y2] = [idOf('rp:lo:y1'), idOf('rp:lo:y2')];
  const graph = new Map([[A1, idOf('rp:lo:y1:other')]]);
  const pairs = [[y1, A1], [y2, A2]];
  const withR = mapsWith({ S: [[y1, A1, 1], [y2, A2, 1]], R: [[y1, A1, 1], [y2, A2, 1]] });
  const r = arrivalsAndLookOnly(pairs, withR, graph);
  assert(r && Array.isArray(r.lookOnly), `arrivalsAndLookOnly must return { arrivals, lookOnly } (T9), got ${show(r)}`);
  same([r.arrivals, r.lookOnly], [[], []], '[arrivals, lookOnly] with both pairs in refusedSeen');
  const withoutR = mapsWith({ S: [[y1, A1, 1], [y2, A2, 1]] });
  const r2 = arrivalsAndLookOnly(pairs, withoutR, graph);
  sameSet(r2.lookOnly, [A1, A2], 'lookOnly for the same scan without refusedSeen (control)');
});

test('RP29: an arrival\'s address is never also a look-only prompt — not when the graph records another id there, nor in either order of a conflict at one address — and a look-only address is listed once (T9 "lookOnly lists addresses, not already arrivals")', () => {
  const arrivalsAndLookOnly = fn('arrivalsAndLookOnly');
  const [AN, AC, AD] = [addr('rp-lo-n'), addr('rp-lo-c'), addr('rp-lo-d')];
  const id = (n) => idOf(`rp:lo2:${n}`);
  const maps = mapsWith({ S: [[id('c-old'), AC, 1], [id('d1'), AD, 1], [id('d2'), AD, 1]] });
  const graph = new Map([[AN, id('n-graph')], [AC, id('c-graph')], [AD, id('d-graph')]]);
  const orders = [
    { name: 'the new id first', pairs: [[id('n'), AN], [id('c-new'), AC], [id('c-old'), AC], [id('d1'), AD], [id('d2'), AD]] },
    { name: 'the recorded id first', pairs: [[id('n'), AN], [id('c-old'), AC], [id('c-new'), AC], [id('d2'), AD], [id('d1'), AD]] },
  ];
  cases(orders, ({ pairs }) => {
    const r = arrivalsAndLookOnly(pairs, maps, graph);
    assert(r && Array.isArray(r.arrivals) && Array.isArray(r.lookOnly), `arrivalsAndLookOnly must return { arrivals, lookOnly } (T9), got ${show(r)}`);
    sameSet(r.arrivals.map(pairKey), [`${AN}|${id('n')}`, `${AC}|${id('c-new')}`], 'arrivals');
    sameSet(r.lookOnly, [AD], 'lookOnly (AN and AC are arrivals; AD once)');
  });
});

// ═══ T10, T11: deletion candidates and their scans ═════════════════════════════════════════════════════════════
test('RP30: deletion candidates are the graph\'s event ids the scan no longer finds, plus S or H ids it no longer finds at an address the graph holds with another id — de-duplicated, tagging addresses only; scanned ids and ids at addresses the graph does not hold are none — scannedIds given as a plain Set (T10; T25 container types; ADR 0003 § The catch-up step 3)', () => {
  const deletionCandidates = fn('deletionCandidates');
  const a = (n) => addr(`rp-dc-${n}`);
  const id = (n) => idOf(`rp:dc:${n}`);
  const graph = new Map([
    [a('g1'), id('g1')], // scanned: nothing
    [a('g2'), id('g2')], // not scanned: candidate
    [a('g3'), id('g3')], // scanned; S records s3 there, not scanned: s3 is a candidate
    [a('g4'), id('g4')], // scanned; H records h4 there, not scanned: h4 is a candidate
    [a('g5'), id('s5')], // not scanned, and S records the same id there: one candidate
    [a('g7'), id('g7')], // scanned; S records s7 there, scanned: nothing
    [a('g8'), id('g8')], // scanned; S and H both record sh there, not scanned: one candidate
    [`39998:${ALICE}:rp-dc-nt`, id('nt')], // not a tagging address: excluded
    ['not-an-address', id('junk')], // excluded
    [null, id('null')], // a relationship with no address: excluded
  ]);
  const maps = mapsWith({
    S: [[id('s3'), a('g3'), 1], [id('s5'), a('g5'), 1], [id('s6'), a('g6'), 1], [id('s7'), a('g7'), 1], [id('sh'), a('g8'), 1]],
    H: [[id('h4'), a('g4'), 2], [id('sh'), a('g8'), 3]],
  });
  const scanned = new Set([id('g1'), id('g3'), id('g4'), id('g7'), id('s7'), id('g8')]);
  const out = deletionCandidates(graph, scanned, maps);
  assert(Array.isArray(out), `deletionCandidates must return [{ address, id }] (T10), got ${show(out)}`);
  sameSet(out.map(pairKey), [`${a('g2')}|${id('g2')}`, `${a('g3')}|${id('s3')}`, `${a('g4')}|${id('h4')}`, `${a('g5')}|${id('s5')}`, `${a('g8')}|${id('sh')}`],
    'candidates, each once (s6: the graph does not hold g6; nt, junk and null: not tagging addresses)');
});

test('RP31: deletionScanFilters groups candidates by their address\'s author — each entry one pubkey, by e or a, its filter exactly { kinds: [5], authors: [pubkey], \'#e\' | \'#a\': targets } — covering each author\'s ids and distinct addresses exactly once, and nobody else\'s — each targets an array (T11; T25 container types; ADR 0003 § The catch-up step 3)', () => {
  const deletionScanFilters = fn('deletionScanFilters');
  const id = (n) => idOf(`rp:dsf:${n}`);
  const cands = [
    { address: addr('rp-dsf-1'), id: id('a1') },
    { address: addr('rp-dsf-2'), id: id('a2') },
    { address: addr('rp-dsf-2'), id: id('a2b') },
    { address: addr('rp-dsf-1', CAROL), id: id('c1') },
    { address: addr('rp-dsf-1', DAVE), id: id('d1') },
  ];
  const out = deletionScanFilters(cands);
  assert(Array.isArray(out) && out.length > 0, `deletionScanFilters must return [{ pubkey, by, targets, filter }] (T11), got ${show(out)}`);
  const want = {
    [ALICE]: { e: [id('a1'), id('a2'), id('a2b')], a: [addr('rp-dsf-1'), addr('rp-dsf-2')] },
    [CAROL]: { e: [id('c1')], a: [addr('rp-dsf-1', CAROL)] },
    [DAVE]: { e: [id('d1')], a: [addr('rp-dsf-1', DAVE)] },
  };
  const got = {};
  const problems = [];
  out.forEach((x, i) => {
    const label = `entry ${i}`;
    if (!x || !want[x.pubkey] || (x.by !== 'e' && x.by !== 'a')) { problems.push(`${label}: expected { pubkey (a candidate's author), by: 'e' | 'a', … }, got ${show(x)}`); return; }
    const targets = arrayOf(x.targets, `${label}.targets`);
    const key = x.by === 'e' ? '#e' : '#a';
    try {
      same(Object.keys(x.filter || {}).sort(), [key, 'authors', 'kinds'].sort(), `${label}: the filter's keys`);
      same(x.filter.kinds, [5], `${label}: filter.kinds`);
      same(x.filter.authors, [x.pubkey], `${label}: filter.authors`);
      sameSet(x.filter[key], targets, `${label}: filter['${key}'] vs targets`);
    } catch (e) { problems.push(e.message); }
    got[x.pubkey] = got[x.pubkey] || { e: [], a: [] };
    got[x.pubkey][x.by].push(...targets);
  });
  assert(problems.length === 0, problems.join('\n        '));
  for (const pk of Object.keys(want)) {
    const g = got[pk] || { e: [], a: [] };
    sameSet(g.e, want[pk].e, `the e targets for ${pk.slice(0, 8)}…`);
    sameSet(g.a, want[pk].a, `the a targets for ${pk.slice(0, 8)}…`);
  }
});

test('RP32: one author with 1,600 candidate ids and 1,600 addresses of about 132 bytes (with slashes) gets several filters, each within the 100,000-byte argv budget after the escape, covering every id and address exactly once, in both the filters and the targets arrays (T11; T25; ADR 0003 planner list; § The catch-up step 3 "sized to the argv budget after escapeFilterArgv")', () => {
  const deletionScanFilters = fn('deletionScanFilters');
  const cands = [];
  for (let i = 0; i < 1600; i++) {
    const d = `profile-tag/podcaster/${pad(i, 4)}/${idOf(`rp:bulk-del:d:${i}`)}`.slice(0, 61);
    cands.push({ address: addr(d), id: idOf(`rp:bulk-del:${i}`) });
  }
  // Fixture checks: realistic sizes, and neither list fits one filter.
  eq(Buffer.byteLength(cands[0].address, 'utf8'), 132, 'fixture: an address is 132 bytes');
  assert(refBytes({ kinds: [5], authors: [ALICE], '#e': cands.map((c) => c.id) }) > ARGV_BUDGET, 'fixture: 1,600 ids should not fit one filter');
  assert(refBytes({ kinds: [5], authors: [ALICE], '#a': cands.map((c) => c.address) }) > 2 * ARGV_BUDGET, 'fixture: 1,600 addresses should need three filters or more');
  const out = deletionScanFilters(cands);
  assert(Array.isArray(out), `deletionScanFilters must return an array (T11), got ${show(out)}`);
  const over = out.filter((x) => !x || !x.filter || refBytes(x.filter) > ARGV_BUDGET);
  assert(over.length === 0, `${over.length} filter(s) over the argv budget: ${over.slice(0, 3).map((x) => `${x && x.by} ${x && x.filter ? refBytes(x.filter) : show(x)} bytes`).join(', ')}`);
  const e = out.filter((x) => x.by === 'e');
  const a = out.filter((x) => x.by === 'a');
  assert(out.every((x) => x.pubkey === ALICE), `every entry is Alice's: ${show(uniq(out.map((x) => x && x.pubkey)))}`);
  sameSet(e.flatMap((x) => arrayOf(x.filter['#e'], 'filter #e')), cands.map((c) => c.id), 'every id in exactly one #e filter');
  sameSet(a.flatMap((x) => arrayOf(x.filter['#a'], 'filter #a')), cands.map((c) => c.address), 'every address in exactly one #a filter');
  sameSet(out.flatMap((x) => arrayOf(x.targets, `${x.by} targets`)), [...cands.map((c) => c.id), ...cands.map((c) => c.address)], 'every id and address in exactly one entry\'s targets (arrays, T25)');
});

test('RP33: an address over 255 bytes is left out of the #a targets (strfry acts on no longer value), while its id is still in an #e filter (T11 "a targets only when ≤ 255 bytes"; T25: targets are arrays)', () => {
  const deletionScanFilters = fn('deletionScanFilters');
  const ALong = addr('L'.repeat(200));
  const AOk = addr('rp-dsf-ok');
  assert(Buffer.byteLength(ALong, 'utf8') > 255, 'fixture: the long address is over 255 bytes');
  const [iL, iO] = [idOf('rp:dsf:long'), idOf('rp:dsf:ok')];
  const out = deletionScanFilters([{ address: ALong, id: iL }, { address: AOk, id: iO }]);
  assert(Array.isArray(out), `deletionScanFilters must return an array (T11), got ${show(out)}`);
  sameSet(out.filter((x) => x.by === 'a').flatMap((x) => arrayOf(x.targets, 'targets')), [AOk], 'the #a targets');
  sameSet(out.filter((x) => x.by === 'e').flatMap((x) => arrayOf(x.targets, 'targets')), [iL, iO], 'the #e targets');
});

test('RP34: isExpectedDeletion accepts a kind 5 whose lower-cased pubkey is the requested one and that names a requested target by the requested tag — an e compared lower-cased, an a compared raw — and refuses another author, another kind or an unrequested target — targets given as a plain array (T11; T25 container types; ADR 0003 planner list "Upper-case e and pubkey")', () => {
  const isExpectedDeletion = fn('isExpectedDeletion');
  hasLetters(DAVE, 'DAVE');
  const i1 = idOf('rp:ied:1');
  hasLetters(i1, 'i1');
  const A = addr('rp-ied', DAVE);
  const eReq = { pubkey: DAVE, by: 'e', targets: [i1] };
  const aReq = { pubkey: DAVE, by: 'a', targets: [A] };
  const k = (o, tag) => makeDeletion({ author: DAVE, id: idOf(`rp:ied:k5:${tag}`), createdAt: 1500, ...o });
  const rows = [
    { name: 'e: the author naming a requested id', ev: k({ e: [i1] }, 1), req: eReq, want: true },
    { name: 'e: an upper-case e', ev: k({ e: [i1.toUpperCase()] }, 2), req: eReq, want: true },
    { name: 'e: the pubkey printed in upper case', ev: { ...k({ e: [i1] }, 3), pubkey: DAVE.toUpperCase() }, req: eReq, want: true },
    { name: 'e: among other targets', ev: k({ e: [idOf('rp:ied:x'), i1], a: [addr('x', DAVE)] }, 4), req: eReq, want: true },
    { name: 'e: another author', ev: makeDeletion({ author: ALICE, e: [i1], id: idOf('rp:ied:k5:5') }), req: eReq, want: false },
    { name: 'e: an unrequested id', ev: k({ e: [idOf('rp:ied:y')] }, 6), req: eReq, want: false },
    { name: 'e: kind 1', ev: { ...k({ e: [i1] }, 7), kind: 1 }, req: eReq, want: false },
    { name: 'e: names the target only by a', ev: k({ a: [i1] }, 8), req: eReq, want: false },
    { name: 'a: the author naming a requested address', ev: k({ a: [A] }, 9), req: aReq, want: true },
    { name: 'a: the pubkey printed in upper case', ev: { ...k({ a: [A] }, 10), pubkey: DAVE.toUpperCase() }, req: aReq, want: true },
    { name: 'a: the address\'s pubkey in upper case (raw compare)', ev: k({ a: [`39999:${DAVE.toUpperCase()}:rp-ied`] }, 11), req: aReq, want: false },
    { name: 'a: the kind spelled 039999', ev: k({ a: [`039999:${DAVE}:rp-ied`] }, 12), req: aReq, want: false },
    { name: 'a: names the target only by e', ev: k({ e: [i1] }, 13), req: aReq, want: false },
    { name: 'a: another author', ev: makeDeletion({ author: ALICE, a: [A], id: idOf('rp:ied:k5:14') }), req: aReq, want: false },
  ];
  cases(rows, ({ ev, req, want }) => eq(isExpectedDeletion(ev, req), want, 'isExpectedDeletion'));
});

// ═══ T12: address and element scans ════════════════════════════════════════════════════════════════════════════
test('RP35: addressScanFilters splits addresses into chunks of at most 200 one-address filters { kinds: [39999], authors: [pk], \'#d\': [d] } — d everything after the second colon — covering each address once, each chunk within the argv budget (T12; ADR 0002 binding 3 as amended, batched shape)', () => {
  const addressScanFilters = fn('addressScanFilters');
  const authors = [ALICE, CAROL, DAVE];
  const addrs = [];
  for (let i = 0; i < 450; i++) addrs.push(addr(i % 7 === 0 ? `rp:as:${i}` : `rp-as-${i}`, authors[i % 3]));
  const out = addressScanFilters(addrs);
  assert(Array.isArray(out) && out.every(Array.isArray), `addressScanFilters must return [[filter]] (T12), got ${show(out && out.slice ? out.slice(0, 1) : out)}`);
  const problems = [];
  const seen = [];
  out.forEach((chunk, ci) => {
    if (chunk.length < 1 || chunk.length > 200) problems.push(`chunk ${ci} holds ${chunk.length} filters (1–200)`);
    if (refBytes(chunk) > ARGV_BUDGET) problems.push(`chunk ${ci} is ${refBytes(chunk)} bytes after the escape (budget ${ARGV_BUDGET})`);
    chunk.forEach((f, fi) => {
      const ok = f && exact(Object.keys(f).sort()) === exact(['#d', 'authors', 'kinds'])
        && exact(f.kinds) === exact([39999]) && Array.isArray(f.authors) && f.authors.length === 1 && /^[0-9a-f]{64}$/.test(f.authors[0])
        && Array.isArray(f['#d']) && f['#d'].length === 1;
      if (!ok) { problems.push(`chunk ${ci} filter ${fi}: expected { kinds: [39999], authors: [pk], '#d': [d] }, got ${show(f)}`); return; }
      seen.push(`39999:${f.authors[0]}:${f['#d'][0]}`);
    });
  });
  assert(problems.length === 0, problems.slice(0, 8).join('\n        '));
  sameSet(seen, addrs, 'the addresses the filters name (each once)');
});

test('RP36: long d values of slashes and three-byte characters split a chunk below 200 filters, so each chunk\'s escaped argv stays within 100,000 UTF-8 bytes — where a character count, or a size taken before the escape, would pack 200 (T12; T1; ADR 0003 § A round step 2)', () => {
  const addressScanFilters = fn('addressScanFilters');
  const addrs = [];
  for (let i = 0; i < 400; i++) addrs.push(addr(`${'/'.repeat(146)}${'中'.repeat(35)}${pad(i, 4)}`, i % 2 ? CAROL : ALICE));
  const d0 = partsOf(addrs[0]).d;
  eq(Buffer.byteLength(d0, 'utf8'), 255, 'fixture: each d is 255 bytes');
  const natural = addrs.slice(0, 200).map((a) => { const p = partsOf(a); return { kinds: [39999], authors: [p.pk], '#d': [p.d] }; });
  assert(refBytes(natural) > ARGV_BUDGET, `fixture: 200 of these filters should be over budget in escaped bytes (${refBytes(natural)})`);
  assert(refEscape(natural).length <= ARGV_BUDGET, `fixture: … but within it in characters (${refEscape(natural).length})`);
  assert(Buffer.byteLength(JSON.stringify(natural), 'utf8') <= ARGV_BUDGET, 'fixture: … and within it before the escape');
  const out = addressScanFilters(addrs);
  assert(Array.isArray(out) && out.every(Array.isArray), `addressScanFilters must return [[filter]] (T12), got ${show(out)}`);
  const bad = out.map((c, i) => ({ i, n: c.length, bytes: refBytes(c) })).filter((c) => c.n > 200 || c.bytes > ARGV_BUDGET);
  assert(bad.length === 0, `chunks over the limits: ${show(bad.slice(0, 4))}`);
  sameSet(out.flat().map((f) => `39999:${f.authors[0]}:${f['#d'][0]}`), addrs, 'the addresses the filters name (each once)');
});

test('RP37: isExpectedAddressEvent accepts a kind 39999 whose lower-cased pubkey is a requested address\'s and that carries that address\'s d as any d tag of at most 255 bytes — a second d included — and refuses another author, another kind, an unrequested d or a d over 255 bytes — addresses given as a plain array (T12; T25 container types; ADR 0003 § A round step 2 "#d matches any d")', () => {
  const isExpectedAddressEvent = fn('isExpectedAddressEvent');
  hasLetters(DAVE, 'DAVE');
  const A = addr('rp-iae');
  const AD = addr('rp-iae-2', DAVE);
  const req = [A, AD];
  const T = (o, tag) => makeTagging({ id: idOf(`rp:iae:${tag}`), ...o });
  const LONG = 'L'.repeat(256);
  const rows = [
    { name: 'the version at a requested address', ev: T({ d: 'rp-iae' }, 1), req, want: true },
    { name: 'a second d names the address', ev: T({ d: 'rp-iae-first', extraDTags: ['rp-iae'] }, 2), req, want: true },
    { name: 'an over-long first d, then the address\'s', ev: T({ d: 'L'.repeat(300), extraDTags: ['rp-iae'] }, 3), req, want: true },
    { name: 'the pubkey printed in upper case', ev: { ...T({ author: DAVE, d: 'rp-iae-2' }, 4), pubkey: DAVE.toUpperCase() }, req, want: true },
    { name: 'a non-tagging version at the address (the predicate reads no stamp)', ev: T({ d: 'rp-iae', stamps: [] }, 5), req, want: true },
    { name: 'another author with that d', ev: T({ author: BOB, d: 'rp-iae' }, 6), req, want: false },
    { name: 'Dave with Alice\'s d', ev: T({ author: DAVE, d: 'rp-iae' }, 7), req, want: false },
    { name: 'an unrequested d', ev: T({ d: 'rp-iae-other' }, 8), req, want: false },
    { name: 'kind 5 carrying the d', ev: { ...T({ d: 'rp-iae' }, 9), kind: 5 }, req, want: false },
    { name: 'kind 30000 carrying the d', ev: T({ d: 'rp-iae', kind: 30000 }, 10), req, want: false },
    { name: 'a d over 255 bytes, even when requested', ev: T({ d: LONG }, 11), req: [addr(LONG)], want: false },
  ];
  cases(rows, ({ ev, req: r, want }) => eq(isExpectedAddressEvent(ev, r), want, 'isExpectedAddressEvent'));
});

test('RP38: elementScanFilters gives filters { kinds: [39999], ids } of 1 to 1,000 ids, each within the argv budget, covering every id once — and no empty filter for no ids (T12; ADR 0002 binding 3 as amended)', () => {
  const elementScanFilters = fn('elementScanFilters');
  const ids = Array.from({ length: 2500 }, (_, i) => idOf(`rp:esf:${i}`));
  const out = elementScanFilters(ids);
  assert(Array.isArray(out), `elementScanFilters must return [{ kinds: [39999], ids }] (T12), got ${show(out)}`);
  const problems = [];
  out.forEach((f, i) => {
    const ok = f && exact(Object.keys(f).sort()) === exact(['ids', 'kinds']) && exact(f.kinds) === exact([39999])
      && Array.isArray(f.ids) && f.ids.length >= 1 && f.ids.length <= 1000;
    if (!ok) problems.push(`filter ${i}: expected { kinds: [39999], ids: [1–1,000] }, got ${show(f)}`);
    else if (refBytes(f) > ARGV_BUDGET) problems.push(`filter ${i}: ${refBytes(f)} bytes after the escape`);
  });
  assert(problems.length === 0, problems.slice(0, 6).join('\n        '));
  sameSet(out.flatMap((f) => f.ids), ids, 'the ids the filters name (each once)');
  const none = elementScanFilters([]);
  assert(Array.isArray(none) && none.every((f) => f && Array.isArray(f.ids) && f.ids.length > 0), `no ids gives no filter with an empty ids list, got ${show(none)}`);
});

test('RP39: isExpectedElementEvent accepts a kind 39999 whose lower-cased id was requested, and refuses another kind or an unrequested id — ids given as a plain array (T12; T25 container types)', () => {
  const isExpectedElementEvent = fn('isExpectedElementEvent');
  const el = makeElement({ id: idOf('rp:iee:el') });
  hasLetters(el.id, 'the element id');
  const ids = [el.id];
  const rows = [
    { name: 'the requested element', ev: el, want: true },
    { name: 'its id printed in upper case', ev: { ...el, id: el.id.toUpperCase() }, want: true },
    { name: 'a kind 39999 with no :tag stamp (the predicate reads no stamp)', ev: { ...el, tags: [['d', 'podcaster']] }, want: true },
    { name: 'kind 5 with the requested id', ev: { ...el, kind: 5 }, want: false },
    { name: 'an unrequested id', ev: makeElement({ id: idOf('rp:iee:other') }), want: false },
  ];
  cases(rows, ({ ev, want }) => eq(isExpectedElementEvent(ev, ids), want, 'isExpectedElementEvent'));
});

// ═══ T13, T14: de-duplication and the relay at one address ═════════════════════════════════════════════════════
test('RP40: dedupeById keeps the first event per lower-cased id, in order (T13; ADR 0003 § A round step 4)', () => {
  const dedupeById = fn('dedupeById');
  const e1 = makeTagging({ d: 'rp-dd-1', id: idOf('rp:dd:1') });
  const e2 = makeTagging({ d: 'rp-dd-2', id: idOf('rp:dd:2') });
  hasLetters(e1.id, 'e1.id');
  const copy = { ...e1, content: 'copy' };
  const upper = { ...e1, id: e1.id.toUpperCase(), content: 'upper' };
  const out = dedupeById([e1, e2, copy, upper]);
  assert(Array.isArray(out), `dedupeById must return an array (T13), got ${show(out)}`);
  eq(out.length, 2, 'events kept');
  assert(out[0] === e1 && out[1] === e2, `expected [e1, e2] (the first of each id, in order), got contents ${show(out.map((e) => e && e.content))}`);
  const out2 = dedupeById([upper, e1]);
  assert(Array.isArray(out2) && out2.length === 1 && out2[0] === upper, `the first per lower-cased id is kept, whatever its case; got ${show(out2 && out2.map((e) => e && e.content))}`);
});

test('RP41: the same event returned by the element read and an address scan — or by two address scans — is one result at its address, not a conflict (T14; ADR 0003 planner list "Element and address scans returning the same event")', () => {
  const relayAtAddress = fn('relayAtAddress');
  const T = makeTagging({ d: 'rp-ra-same', id: idOf('rp:ra:same') });
  const A = addr('rp-ra-same');
  const conflict = sweep().readRelay([T, { ...T }], IDENTITIES).byAddress.get(A);
  assert(conflict && conflict.conflict === true, 'fixture: readRelay alone reads the same event twice as a conflict');
  same(relayAtAddress([T], [{ ...T }], A, IDENTITIES), contractEdge(T), 'relayAtAddress (address scan and element read)');
  same(relayAtAddress([T, { ...T }], [], A, IDENTITIES), contractEdge(T), 'relayAtAddress (two address scans)');
});

test('RP42: an event returned for an address only through a second d — its identity d gives another address — is not at this address: the version whose identity d is this one is, with no conflict (T14; ADR 0003 § A round step 4)', () => {
  const relayAtAddress = fn('relayAtAddress');
  const M = makeTagging({ d: 'rp-ra-x', extraDTags: ['rp-ra-y'], id: idOf('rp:ra:multi') });
  const Y = makeTagging({ d: 'rp-ra-y', id: idOf('rp:ra:y'), polarity: '-1' });
  const [AX, AY] = [addr('rp-ra-x'), addr('rp-ra-y')];
  same(relayAtAddress([M, Y], [], AY, IDENTITIES), contractEdge(Y), 'at rp-ra-y: its own version');
  eq(relayAtAddress([M], [], AY, IDENTITIES), null, 'at rp-ra-y with only the multi-d event: nothing');
  same(relayAtAddress([M], [], AX, IDENTITIES), contractEdge(M), 'at rp-ra-x: the multi-d event');
});

test('RP43: an element read\'s tag element resolves an id-only tagging though the element sits at another address; with no element the tagging reads unresolved (T14 "adds elementEvents"; AC-1 "A tag named only by id")', () => {
  const relayAtAddress = fn('relayAtAddress');
  const T = makeTagging({ d: 'rp-ra-idonly', a: null, e: TAG_V1, id: idOf('rp:ra:idonly') });
  const A = addr('rp-ra-idonly');
  const el = makeElement();
  const want = contractEdge(T, { ...IDENTITIES, tagElementsById: new Map([[el.id, el]]) });
  eq(want.tagAddress, TAG_ADDR, 'fixture: the element resolves the tag');
  same(relayAtAddress([T], [el], A, IDENTITIES), want, 'relayAtAddress with the element');
  const bare = relayAtAddress([T], [], A, IDENTITIES);
  same(bare, contractEdge(T), 'relayAtAddress with no element (unresolved)');
  eq(bare && bare.tagAddress, null, 'tagAddress with no element');
});

test('RP44: relayAtAddress reads a version with no nostr-user-tag stamp, or nothing at all, as null; a stamped non-tagging as the contract\'s refusal; two versions as { conflict: true, count: 2 } (T14; story Out of scope: a stamp-less republish is the pass\'s)', () => {
  const relayAtAddress = fn('relayAtAddress');
  const { taggingToEdge } = contract();
  const A = addr('rp-ra-x2');
  const rows = [
    { name: 'no stamp', events: [makeTagging({ d: 'rp-ra-x2', stamps: [], id: idOf('rp:ra:ns') })], want: null },
    { name: 'only a :tag stamp', events: [makeTagging({ d: 'rp-ra-x2', stamps: [TAG_STAMP(CANONICAL)], id: idOf('rp:ra:ts') })], want: null },
    { name: 'only another deployment\'s stamp', events: [makeTagging({ d: 'rp-ra-x2', stamps: [STAMP(OTHER_DEPLOY)], id: idOf('rp:ra:od') })], want: null },
    { name: 'nothing', events: [], want: null },
    { name: 'a version at another address only', events: [makeTagging({ d: 'rp-ra-elsewhere', id: idOf('rp:ra:else') })], want: null },
  ];
  const nt = makeNonTagging({ address: A, refusal: 'no-target', id: idOf('rp:ra:nt') });
  rows.push({ name: 'a stamped non-tagging', events: [nt], want: taggingToEdge(nt, IDENTITIES) });
  rows.push({
    name: 'two stamped versions',
    events: [makeTagging({ d: 'rp-ra-x2', id: idOf('rp:ra:c1') }), makeTagging({ d: 'rp-ra-x2', id: idOf('rp:ra:c2'), createdAt: 2000 })],
    want: { conflict: true, count: 2 },
  });
  cases(rows, ({ events, want }) => same(relayAtAddress(events, [], A, IDENTITIES), want, 'relayAtAddress'));
});

// ═══ T15: prompts and entries ══════════════════════════════════════════════════════════════════════════════════
test('RP45: mergePrompt(null, prompt) starts an entry { version, revokes, look } from a version, revoke or look prompt, and never changes the entry it is given (T15 "→ a new entry")', () => {
  const mergePrompt = fn('mergePrompt');
  const v1 = idOf('rp:mp:v1');
  const rv = revoke('e', v1, 2000);
  same(mergePrompt(null, { type: 'version', id: v1 }), entryOf({ version: v1 }), 'from a version prompt');
  same(mergePrompt(null, rv), entryOf({ revokes: [rv] }), 'from a revoke prompt');
  same(mergePrompt(null, { type: 'look' }), entryOf({ look: true }), 'from a look prompt');
  const e1 = mergePrompt(null, { type: 'version', id: v1 });
  const before = exact(e1);
  const e2 = mergePrompt(e1, rv);
  eq(exact(e1), before, 'the entry passed in is unchanged');
  assert(e2 !== e1, 'mergePrompt returns a new entry object');
});

test('RP46: mergePrompt keeps the latest version prompt, de-duplicates revokes by (by, target) keeping the one with the greatest created_at together with that revoke\'s own kind5Id, keeps different targets or tags apart, and ORs look (T15; T25 "keeps … the revoke with the greatest created_at and that revoke\'s kind5Id"; ADR 0003 § "Prompts are O(1) per address")', () => {
  const mergePrompt = fn('mergePrompt');
  const [v1, v2, t1, t2] = [idOf('rp:mp2:v1'), idOf('rp:mp2:v2'), idOf('rp:mp2:t1'), idOf('rp:mp2:t2')];
  const A = addr('rp-mp2');
  // Each revoke of one (by, target) comes from its own kind-5, so each carries its own kind5Id.
  const [r100, r50, r200, a150, a90] = [revoke('e', t1, 100), revoke('e', t1, 50), revoke('e', t1, 200), revoke('a', A, 150), revoke('a', A, 90)];
  assert(uniq([r100, r50, r200].map((p) => p.kind5Id)).length === 3, 'fixture: the three revokes of t1 carry three kind5Ids');
  let e = mergePrompt(null, { type: 'version', id: v1 });
  e = mergePrompt(e, { type: 'look' });
  e = mergePrompt(e, { type: 'version', id: v2 });
  e = mergePrompt(e, r100);
  e = mergePrompt(e, r50);
  same(e.revokes.filter((p) => revokeKey(p) === `e|${t1}`), [r100], 'an older revoke of the same (by, target) does not replace a newer one — its created_at nor its kind5Id');
  e = mergePrompt(e, r200);
  same(e.revokes.filter((p) => revokeKey(p) === `e|${t1}`), [r200], 'a newer revoke replaces it whole — its created_at with its own kind5Id');
  e = mergePrompt(e, a150);
  e = mergePrompt(e, a90);
  e = mergePrompt(e, revoke('e', t2, 10));
  same(e.version, { id: v2 }, 'version (the latest version prompt)');
  eq(e.look, true, 'look (ORed, kept through later merges)');
  const byKey = {};
  for (const p of e.revokes) byKey[revokeKey(p)] = (byKey[revokeKey(p)] || []).concat(p.created_at);
  same(byKey, { [`e|${t1}`]: [200], [`a|${A}`]: [150], [`e|${t2}`]: [10] }, 'revokes by (by, target) → created_at');
  same(e.revokes.find((p) => revokeKey(p) === `a|${A}`), a150, 'the by-a revoke kept is the newest, with its kind5Id');
});

test('RP47: discardSupersededRevokes drops the by-e revokes whose target is not the known version, and keeps the matching by-e revoke, every by-a revoke, the version and look (T15; ADR 0003 § gateAction "A by-e prompt is discarded … as soon as another version is heard")', () => {
  const discardSupersededRevokes = fn('discardSupersededRevokes');
  const [v1, v2, v3] = [idOf('rp:dsr:v1'), idOf('rp:dsr:v2'), idOf('rp:dsr:v3')];
  const A = addr('rp-dsr');
  const entry = entryOf({ version: v3, revokes: [revoke('e', v1), revoke('e', v2), revoke('a', A)], look: true });
  const out = discardSupersededRevokes(entry, v2);
  assert(out && Array.isArray(out.revokes), `discardSupersededRevokes must return an entry (T15), got ${show(out)}`);
  sameSet(out.revokes.map(revokeKey), [`e|${v2}`, `a|${A}`], 'revokes kept');
  same([out.version, out.look], [{ id: v3 }, true], '[version, look]');
});

// ═══ T16: the gate ═════════════════════════════════════════════════════════════════════════════════════════════
const GA = addr('rp-gate');
const GV1 = makeTagging({ d: 'rp-gate', id: idOf('rp:gate:v1'), createdAt: 1000 });
const GV2 = makeTagging({ d: 'rp-gate', id: idOf('rp:gate:v2'), createdAt: 2000, polarity: '-1' });

test('RP48: a create is held as pre-existing while the relay\'s version is in the baseline, whatever prompted the look; a version not in it — one stored during the first-start scan, say — is created (T16; AC-4 "no start ever backfills"; ADR 0003 § First start, planner list "A tagging stored during the first-start scan is created")', () => {
  const gateAction = fn('gateAction');
  const { decideAddress } = sweep();
  const d = decideAddress(null, contractEdge(GV1));
  eq(d.action, 'create', 'fixture: decideAddress plans a create');
  const entries = [
    { name: 'a version prompt', entry: entryOf({ version: GV1.id }) },
    { name: 'a look-only prompt (a catch-up)', entry: entryOf({ look: true }) },
    { name: 'a revoke prompt (a deletion prompted the look)', entry: entryOf({ revokes: [revoke('e', idOf('rp:gate:gone'))] }) },
    { name: 'an empty entry', entry: entryOf() },
  ];
  cases(entries, ({ entry }) => {
    gateIs(gateAction(d, { address: GA, storedRow: null, relayVersionId: GV1.id, entry, baseline: new Set([GV1.id]) }), { act: false, held: 'pre-existing' }, 'in the baseline');
    gateIs(gateAction(d, { address: GA, storedRow: null, relayVersionId: GV1.id, entry, baseline: new Set([idOf('rp:gate:other')]) }), { act: true }, 'not in the baseline');
  });
  // B = the scan minus every id delivered live since the REQ (§ First start step 3).
  const scanned = [idOf('rp:gate:held'), GV1.id];
  const buffered = new Set([GV1.id]);
  const baseline = new Set(scanned.filter((x) => !buffered.has(x)));
  gateIs(gateAction(d, { address: GA, storedRow: null, relayVersionId: GV1.id, entry: entryOf({ version: GV1.id }), baseline }), { act: true }, 'a version delivered live during the first-start scan');
});

test('RP49: a not-on-relay removal acts only with a revoke prompt — a queued version prompt, a look, both, or nothing is held as removal-not-prompted, so a wipe removes nothing in real time — and a by-e revoke lets it act (T16; AC-3 "What a removal needs"; ADR 0003 D4-A; planner list "A queued version prompt plus a wipe removes nothing")', () => {
  const gateAction = fn('gateAction');
  const { decideAddress } = sweep();
  const row = storedRowFor(GV1);
  const d = decideAddress(row, null);
  same([d.action, d.reason], ['remove', 'not-on-relay'], 'fixture: decideAddress plans a not-on-relay removal');
  const rows = [
    { name: 'a version prompt (the version then wiped)', entry: entryOf({ version: GV2.id }), want: { act: false, held: 'removal-not-prompted' } },
    { name: 'a look-only prompt', entry: entryOf({ look: true }), want: { act: false, held: 'removal-not-prompted' } },
    { name: 'a version and a look', entry: entryOf({ version: GV2.id, look: true }), want: { act: false, held: 'removal-not-prompted' } },
    { name: 'an empty entry', entry: entryOf(), want: { act: false, held: 'removal-not-prompted' } },
    { name: 'a by-e revoke', entry: entryOf({ revokes: [revoke('e', GV1.id)] }), want: { act: true } },
    { name: 'a by-e revoke with a look', entry: entryOf({ revokes: [revoke('e', GV1.id)], look: true }), want: { act: true } },
  ];
  cases(rows, ({ entry, want }) => gateIs(gateAction(d, { address: GA, storedRow: row, relayVersionId: null, entry, baseline: new Set() }), want, 'gateAction'));
});

test('RP50: a by-a revoke lets a not-on-relay removal act only through revokeApplies on a well-formed stored edge — a deletion as new as the stored createdAt or newer acts, an older one does not, a malformed stored createdAt does not (a by-e revoke still does) — with the author taken from the address, not the stored start node (T16; ADR 0003 § "Why revokeApplies for address deletions", owner decision 2)', () => {
  const gateAction = fn('gateAction');
  const { decideAddress } = sweep();
  const k5 = (by, target, at) => entryOf({ revokes: [revoke(by, target, at)] });
  const rows = [
    { name: 'by a, newer than the stored version', row: storedRowFor(GV1), entry: k5('a', GA, 2000), want: { act: true } },
    { name: 'by a, as new as the stored version', row: storedRowFor(GV1), entry: k5('a', GA, 1000), want: { act: true } },
    { name: 'by a, older than the stored version', row: storedRowFor(GV1), entry: k5('a', GA, 999), want: { act: false, held: 'removal-not-prompted' } },
    { name: 'by a, stored createdAt a string', row: storedRowFor(GV1, { set: { createdAt: '1000' } }), entry: k5('a', GA, 5000), want: { act: false, held: 'removal-not-prompted' } },
    { name: 'by a, stored createdAt a float', row: storedRowFor(GV1, { floatCreatedAt: true }), entry: k5('a', GA, 5000), want: { act: false, held: 'removal-not-prompted' } },
    { name: 'by a, stored createdAt missing', row: storedRowFor(GV1, { missing: ['createdAt'] }), entry: k5('a', GA, 5000), want: { act: false, held: 'removal-not-prompted' } },
    { name: 'by e, stored createdAt a string', row: storedRowFor(GV1, { set: { createdAt: '1000' } }), entry: k5('e', GV1.id, 5000), want: { act: true } },
    { name: 'by a, the stored start node another person', row: storedRowFor(GV1, { fromPubkey: CAROL }), entry: k5('a', GA, 2000), want: { act: true } },
  ];
  cases(rows, ({ row, entry, want }) => {
    const d = decideAddress(row, null);
    same([d.action, d.reason], ['remove', 'not-on-relay'], 'fixture: decideAddress plans a not-on-relay removal');
    gateIs(gateAction(d, { address: GA, storedRow: row, relayVersionId: null, entry, baseline: new Set() }), want, 'gateAction');
  });
});

test('RP51: a non-tagging removal (the relay now holds a refused version there) acts with a version prompt at the address or a valid revoke, and is held otherwise — a look never enables it (T16; ADR 0003 § gateAction "A non-tagging removal is held unless …"; story item 9)', () => {
  const gateAction = fn('gateAction');
  const { decideAddress } = sweep();
  const { taggingToEdge } = contract();
  const row = storedRowFor(GV1);
  const nt = makeNonTagging({ address: GA, refusal: 'no-target', id: idOf('rp:gate:nt'), createdAt: 3000 });
  const d = decideAddress(row, taggingToEdge(nt, IDENTITIES));
  same([d.action, d.reason], ['remove', 'non-tagging'], 'fixture: decideAddress plans a non-tagging removal');
  const rows = [
    { name: 'a version prompt', entry: entryOf({ version: nt.id }), want: { act: true } },
    { name: 'a by-e revoke', entry: entryOf({ revokes: [revoke('e', GV1.id)] }), want: { act: true } },
    { name: 'a by-a revoke newer than the stored version', entry: entryOf({ revokes: [revoke('a', GA, 2000)] }), want: { act: true } },
    { name: 'a by-a revoke older than the stored version', entry: entryOf({ revokes: [revoke('a', GA, 999)] }), want: { act: false, held: 'removal-not-prompted' } },
    { name: 'a look-only prompt', entry: entryOf({ look: true }), want: { act: false, held: 'removal-not-prompted' } },
    { name: 'an empty entry', entry: entryOf(), want: { act: false, held: 'removal-not-prompted' } },
  ];
  cases(rows, ({ entry, want }) => gateIs(gateAction(d, { address: GA, storedRow: row, relayVersionId: nt.id, entry, baseline: new Set() }), want, 'gateAction'));
});

test('RP52: an update, a move, a none and a leave always act — never held, not even with the relay\'s version in the baseline and nothing but a look prompting (T16 "Every other action acts"; AC-4: a relationship the graph already holds follows the relay)', () => {
  const gateAction = fn('gateAction');
  const { decideAddress } = sweep();
  const row = storedRowFor(GV1);
  const moved = makeTagging({ d: 'rp-gate', id: idOf('rp:gate:moved'), createdAt: 3000, target: CAROL });
  const rows = [
    { name: 'update', d: decideAddress(row, contractEdge(GV2)), vid: GV2.id, row, action: 'update' },
    { name: 'move', d: decideAddress(row, contractEdge(moved)), vid: moved.id, row, action: 'move' },
    { name: 'none', d: decideAddress(row, contractEdge(GV1)), vid: GV1.id, row, action: 'none' },
    { name: 'leave', d: decideAddress(storedRowFor(GV1, { address: null }), null), vid: null, row: storedRowFor(GV1, { address: null }), action: 'leave' },
  ];
  cases(rows, ({ d, vid, row: r, action }) => {
    eq(d.action, action, 'fixture: decideAddress\'s action');
    gateIs(gateAction(d, { address: GA, storedRow: r, relayVersionId: vid, entry: entryOf({ look: true }), baseline: new Set([vid, GV1.id]) }), { act: true }, 'gateAction');
  });
});

// ═══ T17: rounds that overlap a pass ═══════════════════════════════════════════════════════════════════════════
test('RP53: a pass overlaps a round when it started before the round committed and it ended after the graph read, is still alive, or is dead with endedAt null and first seen dead after the graph read; a dead run with no deadSeenAt does not; every boundary is strict — a pass that ended at the graph read, started at the commit, or was first seen dead at the graph read does not overlap — and deadSeenAt is a plain object (T17; T25 "passOverlaps boundaries are strict", container types; ADR 0003 § Coexisting with the pass "graphReadAt is earlier than deadSeenAt"; AC-5)', () => {
  const passOverlaps = fn('passOverlaps');
  const round = { graphReadAt: T0, commitAt: T0 + 500 };
  const rows = [
    { name: 'ended after the graph read', run: runEntry(RUN, T0 - 60000, T0 + 100), alive: false, seen: {}, want: [RUN] },
    { name: 'ended before the graph read', run: runEntry(RUN, T0 - 60000, T0 - 100), alive: false, seen: {}, want: [] },
    { name: 'still alive', run: runEntry(RUN, T0 - 60000, null), alive: true, seen: {}, want: [RUN] },
    { name: 'started during the round, alive', run: runEntry(RUN, T0 + 100, null), alive: true, seen: {}, want: [RUN] },
    { name: 'started after the round committed, alive', run: runEntry(RUN, T0 + 1000, null), alive: true, seen: {}, want: [] },
    { name: 'started after the round committed, ended later', run: runEntry(RUN, T0 + 600, T0 + 700), alive: false, seen: {}, want: [] },
    { name: 'dead with endedAt null, first seen dead after the graph read', run: runEntry(RUN, T0 - 60000, null), alive: false, seen: { [RUN]: T0 + 10 }, want: [RUN] },
    { name: 'dead with endedAt null, first seen dead before the graph read', run: runEntry(RUN, T0 - 60000, null), alive: false, seen: { [RUN]: T0 - 10 }, want: [] },
    { name: 'dead with endedAt null, no deadSeenAt', run: runEntry(RUN, T0 - 60000, null), alive: false, seen: {}, want: [] },
    // T25: the boundaries are strict — startedAt < commitAt, endedAt > graphReadAt (and graphReadAt < deadSeenAt).
    { name: 'ended exactly at the graph read', run: runEntry(RUN, T0 - 60000, T0), alive: false, seen: {}, want: [] },
    { name: 'ended 1 ms after the graph read', run: runEntry(RUN, T0 - 60000, T0 + 1), alive: false, seen: {}, want: [RUN] },
    { name: 'started exactly at the commit, alive', run: runEntry(RUN, T0 + 500, null), alive: true, seen: {}, want: [] },
    { name: 'started exactly at the commit, ended later', run: runEntry(RUN, T0 + 500, T0 + 900), alive: false, seen: {}, want: [] },
    { name: 'started 1 ms before the commit, alive', run: runEntry(RUN, T0 + 499, null), alive: true, seen: {}, want: [RUN] },
    { name: 'dead with endedAt null, first seen dead exactly at the graph read', run: runEntry(RUN, T0 - 60000, null), alive: false, seen: { [RUN]: T0 }, want: [] },
  ];
  cases(rows, ({ run, alive, seen, want }) => {
    const out = passOverlaps(round, [run], (r) => (r && r.runId === RUN ? alive : false), { ...seen });
    assert(Array.isArray(out), `passOverlaps must return [runId] (T17), got ${show(out)}`);
    same(out, want, 'passOverlaps');
  });
  const many = passOverlaps(round, [
    runEntry(RUN, T0 - 60000, T0 + 100), runEntry(RUN2, T0 - 60000, T0 - 100), runEntry(RUN3, T0 - 60000, null),
  ], (r) => r.runId === RUN3, {});
  sameSet(many, [RUN, RUN3], 'passOverlaps over latest and previous at once');
});

test('RP54: a dead pass with endedAt null re-looks once — the round whose graph read came before the path first saw it dead overlaps it; the re-look round, reading the graph after that, does not (T17; ADR 0003 planner list "A dead pass with endedAt null re-looks once")', () => {
  const passOverlaps = fn('passOverlaps');
  const runs = [runEntry(RUN, T0 - 60000, null)];
  const dead = () => false;
  const seen = { [RUN]: T0 + 1000 }; // a plain object (T25)
  same(passOverlaps({ graphReadAt: T0, commitAt: T0 + 500 }, runs, dead, seen), [RUN], 'the round that overlapped the dead pass');
  same(passOverlaps({ graphReadAt: T0 + 2000, commitAt: T0 + 2500 }, runs, dead, seen), [], 'the re-look round (no second re-look)');
});

// ═══ T18: round order ══════════════════════════════════════════════════════════════════════════════════════════
/** n queue entries of one lane with seqs from seqs(i), addresses `${prefix}-${i}`. */
const laneEntries = (lane, n, prefix, seqs) => Array.from({ length: n }, (_, i) => ({ address: `${prefix}-${i}`, lane, seq: seqs(i) }));
/** Interleave several lists and reverse, so the input is in no lane or seq order. */
const shuffled = (...lists) => {
  const out = [];
  const max = Math.max(...lists.map((l) => l.length));
  for (let i = 0; i < max; i++) for (const l of lists) if (i < l.length) out.push(l[i]);
  return out.reverse();
};
const bySeq = (xs) => [...xs].sort((a, b) => a.seq - b.seq).map((x) => x.address);

test('RP55: roundOrder takes catch-up entries first (up to the share), then live, then re-looks, then the rest of the catch-up, each by seq (T18; ADR 0003 § Lanes and rounds)', () => {
  const roundOrder = fn('roundOrder');
  const q = [
    { address: 'c5', lane: 'catchup', seq: 5 }, { address: 'l4', lane: 'live', seq: 4 }, { address: 'c1', lane: 'catchup', seq: 1 },
    { address: 'r0', lane: 'relook', seq: 0 }, { address: 'l2', lane: 'live', seq: 2 }, { address: 'c3', lane: 'catchup', seq: 3 },
  ];
  same(roundOrder(q), ['c1', 'c3', 'c5', 'l2', 'l4', 'r0'], 'roundOrder');
});

test('RP56: with more catch-up work than its share, the round takes the 100 lowest-seq catch-up entries, then every live entry, then the re-looks, then the remaining catch-up entries (T18; owner decision 9: a catch-up proceeds at 100 or more addresses per round under live load)', () => {
  const roundOrder = fn('roundOrder');
  const c = laneEntries('catchup', 150, 'c', (i) => (i * 7) % 150);
  const l = laneEntries('live', 50, 'l', (i) => 1000 + ((i * 3) % 50));
  const r = laneEntries('relook', 20, 'r', (i) => 500 + i);
  const want = [...bySeq(c).slice(0, 100), ...bySeq(l), ...bySeq(r), ...bySeq(c).slice(100)];
  same(roundOrder(shuffled(c, l, r)), want, 'roundOrder');
});

test('RP57: a round holds at most 500 addresses — the catch-up share and the live lane first, then re-looks while room is left (T18 "at most LIMITS.roundAddresses")', () => {
  const roundOrder = fn('roundOrder');
  const c1 = laneEntries('catchup', 300, 'c', (i) => i);
  const l1 = laneEntries('live', 400, 'l', (i) => 300 + i);
  const r1 = laneEntries('relook', 100, 'r', (i) => 700 + i);
  same(roundOrder(shuffled(c1, l1, r1)), [...bySeq(c1).slice(0, 100), ...bySeq(l1)], 'catch-up 300, live 400, re-looks 100');
  const c2 = laneEntries('catchup', 50, 'c', (i) => 2000 + i);
  const l2 = laneEntries('live', 300, 'l', (i) => i);
  const r2 = laneEntries('relook', 300, 'r', (i) => 1000 + i);
  same(roundOrder(shuffled(c2, l2, r2)), [...bySeq(c2), ...bySeq(l2), ...bySeq(r2).slice(0, 150)], 'catch-up 50, live 300, re-looks 300');
});

// ═══ T19: the journal ══════════════════════════════════════════════════════════════════════════════════════════
test('RP58: journalLine writes each of the ten line types as one compact JSON line ending in its only newline, which parses back to the object — a newline or carriage return inside an address included (T19; ADR 0003 § Journal rules)', () => {
  const journalLine = fn('journalLine');
  const id = idOf('rp:jl');
  const A = addr('rp-jl');
  const rows = [
    { name: 'v', o: J.v(id, A) },
    { name: 'v, a d with a newline and a carriage return', o: J.v(id, addr('rp\njl\rx')) },
    { name: 'd', o: J.d(A, revoke('e', id, 2000)) },
    { name: 'c', o: J.c(id, A) },
    { name: 'x', o: J.x(A, [id, idOf('rp:jl:2')]) },
    { name: 'b', o: J.b(id) },
    { name: 'f', o: J.f(id, A) },
    { name: 'r', o: J.r(A, RUN, entryOf({ version: id, revokes: [revoke('a', A, 3000)], look: true })) },
    { name: 'rc', o: J.rc(A, RUN) },
    { name: 'p', o: J.p(A, 'Neo.ClientError.Schema.ConstraintValidationFailed') },
    { name: 'k', o: J.k(RUN, T0) },
  ];
  cases(rows, ({ o }) => {
    const line = journalLine(o);
    eq(typeof line, 'string', 'journalLine returns a string');
    assert(line.endsWith('\n') && line.indexOf('\n') === line.length - 1, `one line ending in its only newline, got ${show(line)}`);
    const body = line.slice(0, -1);
    same(JSON.parse(body), o, 'the line parses back to the object');
    eq(JSON.stringify(JSON.parse(body)), body, 'the line is compact JSON');
  });
});

test('RP59: replayJournal from no record applies v (into H, and a version prompt), d (a revoke prompt), f (into refusedSeen), p (parked), k (a dead pass seen) and r (a re-look) (T19; ADR 0003 § Knowing what changed while it was away)', () => {
  const replayJournal = fn('replayJournal');
  const [i1, i2, i3] = [idOf('rp:rj:1'), idOf('rp:rj:2'), idOf('rp:rj:3')];
  const [A, B2, C, D] = [addr('rp-rj-a'), addr('rp-rj-b'), addr('rp-rj-c'), addr('rp-rj-d')];
  const rv = revoke('e', i1, 2500);
  const relookEntry = entryOf({ version: i3, revokes: [revoke('a', D, 2600)] });
  const out = replayed(replayJournal(texts([J.v(i1, A), J.d(A, rv), J.f(i2, B2), J.p(C, 'ENOSPC'), J.k(RUN, 5555), J.r(D, RUN, relookEntry)]), null), 'replayJournal');
  const h = out.maps.H.get(i1);
  eq(h && h.a, A, 'v: H records the heard id at its address');
  const e = out.pending.get(A);
  assert(e && typeof e === 'object', `v and d: a pending entry at ${A}, got ${show(e)}`);
  same(e.version, { id: i1 }, 'v: the entry\'s version prompt');
  sameSet((e.revokes || []).map(exact), [exact(rv)], 'd: the entry\'s revoke prompts');
  eq(out.maps.R.get(i2) && out.maps.R.get(i2).a, B2, 'f: refusedSeen records the refused id at its address');
  eq(out.parked.get(C), 'ENOSPC', 'p: the parked address\'s code');
  same(out.deadSeenAt, { [RUN]: 5555 }, 'k: deadSeenAt, a plain object from runId to milliseconds (T25)');
  same(out.rechecks, [{ a: D, runId: RUN, entry: relookEntry }], 'r: the re-look with its entry');
  eq(out.skippedLines, 0, 'skippedLines');
});

test('RP60: an x line drops exactly the ids it lists from S, H, refusedSeen and B — a version heard at that address before it but not listed, or after it, survives (T19; ADR 0003 "journaled explicitly … so a replay never drops a later v")', () => {
  const replayJournal = fn('replayJournal');
  const A = addr('rp-rj-x');
  const id = (n) => idOf(`rp:rjx:${n}`);
  const record = { version: 1, seen: [[id('s1'), A]], heard: [[id('h1'), A]], baseline: [id('s1')], refusedSeen: [[id('r1'), A]], pending: [], rechecks: [], deadSeenAt: {}, parked: [] };
  const out = replayed(replayJournal(texts([J.v(id('h2'), A), J.x(A, [id('s1'), id('r1'), id('h1')]), J.v(id('h3'), A)]), record), 'replayJournal');
  same([out.maps.S.has(id('s1')), out.maps.B.has(id('s1')), out.maps.R.has(id('r1')), out.maps.H.has(id('h1'))], [false, false, false, false], 'the listed ids are gone from S, B, refusedSeen and H');
  sameSet([...out.maps.H.keys()], [id('h2'), id('h3')], 'H keeps the unlisted earlier id and the later one');
});

test('RP61: a c line moves the id to S and clears the entry\'s version only when it is that id — deleting the pending entry when that leaves no version, no revokes and no look, and keeping it, version null, when a revoke remains; a b line drops the id from B only (T19; T25 "replayJournal deletes a pending entry that c leaves with no version, no revokes and no look")', () => {
  const replayJournal = fn('replayJournal');
  const A = addr('rp-rj-c');
  const id = (n) => idOf(`rp:rjc:${n}`);
  const one = replayed(replayJournal(texts([J.v(id('1'), A), J.c(id('1'), A)]), null), 'replay v, c');
  eq(one.maps.S.get(id('1')) && one.maps.S.get(id('1')).a, A, 'c: S records the id at its address');
  eq(one.maps.H.has(id('1')), false, 'c: H no longer holds the id');
  assert(!one.pending.has(A), `c: the emptied entry is deleted from pending, got ${show(one.pending.get(A))}`);
  eq(one.pending.size, 0, 'c: pending holds nothing');
  const rv = revoke('a', A, 2800);
  const kept = replayed(replayJournal(texts([J.v(id('1'), A), J.d(A, rv), J.c(id('1'), A)]), null), 'replay v, d, c');
  same(entryFields(kept.pending.get(A)), entryOf({ revokes: [rv] }), 'c: an entry left with a revoke stays pending, its version null');
  const two = replayed(replayJournal(texts([J.v(id('1'), A), J.v(id('2'), A), J.c(id('1'), A)]), null), 'replay v, v, c');
  const e2 = two.pending.get(A);
  same(e2 && e2.version, { id: id('2') }, 'c of an older id keeps the newer version prompt');
  sameSet([...two.maps.H.keys()], [id('2')], 'H keeps the newer heard id');
  const record = { version: 1, seen: [[id('b1'), A], [id('b2'), A]], heard: [[id('h'), A]], baseline: [id('b1'), id('b2')], refusedSeen: [], pending: [], rechecks: [], deadSeenAt: {}, parked: [] };
  const three = replayed(replayJournal(texts([J.b(id('b1')), J.c(id('h'), A)]), record), 'replay b, c over a record');
  sameSet([...three.maps.B], [id('b2')], 'b: B drops the id');
  eq(three.maps.S.has(id('b1')), true, 'b: S keeps the id');
  same([three.maps.S.has(id('h')), three.maps.H.has(id('h'))], [true, false], 'c of a restored heard id: H → S');
});

test('RP62: a torn, garbled, non-object or unknown-type line is skipped and counted, and the lines after it still apply; an empty line is ignored, not counted; lines may come from any iterable (T19; T25 "Empty lines are ignored, not counted"; ADR 0003 § Journal rules "A line that fails to parse is skipped and counted")', () => {
  const replayJournal = fn('replayJournal');
  const [A, B2] = [addr('rp-rj-g1'), addr('rp-rj-g2')];
  const [i1, i2] = [idOf('rp:rjg:1'), idOf('rp:rjg:2')];
  const bad = [JSON.stringify(J.v(i2, B2)).slice(0, 20), 'garbage', 'null', '[1,2]', '{"t":"zz","a":"x"}', `{"id":"${i2}"}`];
  function* lines() {
    yield '';
    yield JSON.stringify(J.v(i1, A));
    yield '';
    yield* bad;
    yield '';
    yield '';
    yield JSON.stringify(J.v(i2, B2));
    yield '';
  }
  const out = replayed(replayJournal(lines(), null), 'replayJournal');
  eq(out.skippedLines, bad.length, `skippedLines (the ${bad.length} bad lines; the 5 empty lines are not counted)`);
  sameSet([...out.maps.H.keys()], [i1, i2], 'H (the lines before and after the bad ones applied)');
  const empties = replayed(replayJournal(['', '', ''], null), 'replayJournal (only empty lines)');
  same([empties.skippedLines, empties.maps.H.size, empties.pending.size], [0, 0, 0], '[skippedLines, H size, pending size] for only empty lines');
});

test('RP63: replayJournal restores the record\'s seen, heard and refusedSeen with seq 0, its baseline and deadSeenAt, and applies the lines on top (T19; T3 "Entries restored from record.json get seq 0")', () => {
  const replayJournal = fn('replayJournal');
  const [A, B2] = [addr('rp-rj-r1'), addr('rp-rj-r2')];
  const id = (n) => idOf(`rp:rjr:${n}`);
  const record = {
    version: 1, firstStartedAt: iso(T0 - 86400000), identities: { canonical: CANONICAL, local: LOCAL }, compactedAt: iso(T0 - 3600000),
    seen: [[id('s1'), A], [id('s2'), B2]], heard: [[id('h1'), A]], baseline: [id('s1')], refusedSeen: [[id('r1'), B2]],
    pending: [], rechecks: [], deadSeenAt: { [RUN]: 7777 }, parked: [],
  };
  const out = replayed(replayJournal([], record), 'replayJournal (record only)');
  same(out.maps.S.get(id('s1')), { a: A, seq: 0 }, 'S from seen');
  same(out.maps.S.get(id('s2')), { a: B2, seq: 0 }, 'S from seen');
  same(out.maps.H.get(id('h1')), { a: A, seq: 0 }, 'H from heard');
  same(out.maps.R.get(id('r1')), { a: B2, seq: 0 }, 'refusedSeen');
  sameSet([...out.maps.B], [id('s1')], 'B from baseline');
  same(out.deadSeenAt, { [RUN]: 7777 }, 'deadSeenAt, a plain object (T25)');
  eq(out.skippedLines, 0, 'skippedLines');
  const on = replayed(replayJournal(texts([J.c(id('h1'), A), J.v(id('h2'), B2)]), record), 'replayJournal (record and lines)');
  same([on.maps.S.has(id('h1')), on.maps.H.has(id('h1')), on.maps.H.has(id('h2'))], [true, false, true], 'lines applied on top of the record');
});

test('RP64: re-looks are one per (address, runId), their entries merged by mergePrompt\'s rules — the latest version, per (by, target) the revoke with the greatest created_at and its own kind5Id, look ORed — and an rc line ends one (T19; T25 "Two r lines for one (a, runId) merge by mergePrompt rules"; T15; ADR 0003 "Re-looks are de-duplicated by (address, runId), merging their prompts")', () => {
  const replayJournal = fn('replayJournal');
  const [A, B2] = [addr('rp-rj-rl'), addr('rp-rj-rl2')];
  const [i1, i2, i3] = [idOf('rp:rjrl:1'), idOf('rp:rjrl:2'), idOf('rp:rjrl:3')];
  const rv = revoke('e', i1, 2700);
  const out = replayed(replayJournal(texts([
    J.r(A, RUN, entryOf({ version: i1 })),
    J.r(A, RUN, entryOf({ revokes: [rv] })),
    J.r(A, RUN2, entryOf({ look: true })),
    J.r(B2, RUN, entryOf({ look: true })),
    J.rc(A, RUN2),
  ]), null), 'replayJournal');
  sameSet(out.rechecks.map((x) => `${x.a}|${x.runId}`), [`${A}|${RUN}`, `${B2}|${RUN}`], 're-looks left (one per address and run)');
  const merged = out.rechecks.find((x) => x.a === A && x.runId === RUN);
  same(merged.entry, entryOf({ version: i1, revokes: [rv] }), 'the merged entry: the first line\'s version (no later one), the second line\'s revoke');
  // Three r lines for one (a, runId): each field merges as mergePrompt merges it.
  const [old, newest, mid, byA] = [revoke('e', i2, 100), revoke('e', i2, 300), revoke('e', i2, 200), revoke('a', A, 250)];
  const three = replayed(replayJournal(texts([
    J.r(A, RUN3, entryOf({ version: i2, revokes: [old], look: true })),
    J.r(A, RUN3, entryOf({ version: i3, revokes: [newest, byA] })),
    J.r(A, RUN3, entryOf({ revokes: [mid] })),
  ]), null), 'replayJournal (three r lines for one address and run)');
  eq(three.rechecks.length, 1, 'one re-look for (A, RUN3)');
  const e = three.rechecks[0].entry;
  assert(e && typeof e === 'object', `the re-look's entry, got ${show(three.rechecks[0])}`);
  same(e.version, { id: i3 }, 'version: the latest version prompt (the second line\'s)');
  eq(e.look, true, 'look: ORed (the first line\'s look survives later lines without one)');
  const byKey = {};
  for (const p of e.revokes || []) byKey[revokeKey(p)] = (byKey[revokeKey(p)] || []).concat(p);
  same(byKey, { [`e|${i2}`]: [newest], [`a|${A}`]: [byA] }, 'revokes: one per (by, target), the greatest created_at with its own kind5Id (not the first line\'s, not the last line\'s)');
});

// ═══ allowErrorCode ════════════════════════════════════════════════════════════════════════════════════════════
test('RP65: allowErrorCode passes E-codes, Neo4j status codes, ServiceUnavailable, SessionExpired and the ScanError codes through unchanged (T2; ADR 0003 § Status and switch "All text is fixed"; AC-6)', () => {
  const allowErrorCode = fn('allowErrorCode');
  const allowed = [
    'ENOSPC', 'ECONNREFUSED', 'EACCES', 'E2BIG', 'ERR_STREAM_DESTROYED',
    'Neo.TransientError.Transaction.DeadlockDetected', 'Neo.ClientError.Transaction.TransactionTimedOut',
    'Neo.ClientError.Transaction.TransactionTimedOutClientConfiguration', 'Neo.TransientError.Transaction.LockClientStopped',
    'Neo.ClientError.Security.Unauthorized', 'Neo.ClientError.Schema.ConstraintValidationFailed', 'Neo.DatabaseError.General.UnknownError',
    'ServiceUnavailable', 'SessionExpired',
    'spawn', 'process-error', 'timeout', 'exit', 'signal', 'truncated', 'unparseable', 'not-an-event-line', 'duplicate',
    'off-filter', 'too-large', 'filter-too-large',
  ];
  cases(allowed.map((code) => ({ name: code, code })), ({ code }) => eq(allowErrorCode(code), code, 'allowErrorCode'));
});

test('RP66: allowErrorCode turns anything else into \'error\' — a host name, host:port, [::1]:port, an IP, a URI, a near-miss of an allowed pattern, a code with a newline or space, arbitrary words, or no string at all (T2; AC-6 "never … a host name, an IP address or a port"; story "For Test Design": neo4j.internal)', () => {
  const allowErrorCode = fn('allowErrorCode');
  const refused = [
    'neo4j.internal', 'localhost', 'neo4j', 'neo4j:7687', 'neo4j.internal:7687', '[::1]:7687', 'localhost:7687', '10.1.2.3',
    '10.1.2.3:7777', 'redis:6379', 'bolt://neo4j:7687', 'E', 'Enospc', 'ENOSPC ', ' ENOSPC', 'ENOSPC\n', 'ENOSPC\nlocalhost:7687',
    'ENO-SPC', 'Neo.ClientError.Security', 'Neo.FooError.General.Unknown', 'NeoXClientErrorXGeneralXUnknown',
    'Neo.ClientError.General.Unknown.Extra', 'Neo.ClientError.Gen-eral.Unknown', 'neo.ClientError.General.Unknown',
    'Neo.ClientError.General.Unknown\n', 'Neo.ClientError.General.neo4j:7687', 'serviceunavailable', 'ServiceUnavailable:7687',
    'Timeout', 'TIMEOUT', 'too-large ', 'Unauthorized', 'password', 'arbitrary words', '',
  ];
  const rows = refused.map((code) => ({ name: show(code), code }));
  for (const [name, code] of [['undefined', undefined], ['null', null], ['a number', 42], ['an object', { code: 'ENOSPC' }], ['an array', ['ENOSPC']]]) rows.push({ name, code });
  cases(rows, ({ code }) => eq(allowErrorCode(code), 'error', 'allowErrorCode'));
});

// ═══ Scenarios (ADR 0003 "Tests the Tester owns → New suites → The pure planner") ══════════════════════════════
test('RP67: a version and its id-only revoke heard in one round — the revoke resolves through H, and the round\'s empty read removes the older relationship (ADR 0003 planner list; AC-2; T5, T6, T15, T16)', () => {
  const { promptFromVersion, recordId, mergePrompt, resolveDeletion, relayAtAddress, gateAction } = need('promptFromVersion', 'recordId', 'mergePrompt', 'resolveDeletion', 'relayAtAddress', 'gateAction');
  const { decideAddress } = sweep();
  const A = addr('rp-sc-one');
  const v0 = makeTagging({ d: 'rp-sc-one', id: idOf('rp:sc:one:v0'), createdAt: 1000 });
  const v1 = makeTagging({ d: 'rp-sc-one', id: idOf('rp:sc:one:v1'), createdAt: 2000, polarity: '-1' });
  const maps = mapsWith({ S: [[v0.id, A, 1]] }); // the graph holds v0
  const p = promptFromVersion(v1, IDENTITIES);
  same(p, { address: A, id: v1.id }, 'v1 heard: its version prompt');
  recordId(maps, 'H', p.id, p.address, 2);
  let entry = mergePrompt(null, { type: 'version', id: p.id });
  const k5 = makeDeletion({ author: ALICE, e: [v1.id], id: idOf('rp:sc:one:k5'), createdAt: 2001 });
  const r = resolved(resolveDeletion(k5, maps, new Set([A])), 'resolveDeletion');
  same(r.prompts.map(promptKey), [`${A}|e|${v1.id}`], 'the revoke resolves through H to A');
  entry = mergePrompt(entry, r.prompts[0].prompt);
  const row = storedRowFor(v0);
  const d = decideAddress(row, relayAtAddress([], [], A, IDENTITIES));
  same([d.action, d.reason], ['remove', 'not-on-relay'], 'the round reads nothing at A');
  gateIs(gateAction(d, { address: A, storedRow: row, relayVersionId: null, entry, baseline: maps.B }), { act: true }, 'the removal');
});

test('RP68: a version heard after a round\'s scan spawned, then revoked by id — it stays in H through that read\'s shrink, and the revoke resolves and removes (ADR 0003 planner list; T7, T6, T16)', () => {
  const { recordId, shrinkOnRead, resolveDeletion, mergePrompt, gateAction } = need('recordId', 'shrinkOnRead', 'resolveDeletion', 'mergePrompt', 'gateAction');
  const { decideAddress } = sweep();
  const A = addr('rp-sc-late');
  const v0 = makeTagging({ d: 'rp-sc-late', id: idOf('rp:sc:late:v0'), createdAt: 1000 });
  const v1 = makeTagging({ d: 'rp-sc-late', id: idOf('rp:sc:late:v1'), createdAt: 2000 });
  const maps = mapsWith({ S: [[v0.id, A, 1]] });
  const captureSeq = 5; // captured just before the scan at A spawned
  recordId(maps, 'H', v1.id, A, 6); // heard after that
  const s = shrinkOnRead(maps, A, v0.id, captureSeq); // the scan's snapshot still held v0
  same(s && s.dropped, [], 'the read at A drops nothing');
  eq(maps.H.has(v1.id), true, 'v1 stays in H');
  const k5 = makeDeletion({ author: ALICE, e: [v1.id], id: idOf('rp:sc:late:k5'), createdAt: 2100 });
  const r = resolved(resolveDeletion(k5, maps, new Set([A])), 'resolveDeletion');
  same(r.prompts.map(promptKey), [`${A}|e|${v1.id}`], 'the revoke of v1 resolves at A');
  const entry = mergePrompt(mergePrompt(null, { type: 'version', id: v1.id }), r.prompts[0].prompt);
  const row = storedRowFor(v0);
  const d = decideAddress(row, null);
  gateIs(gateAction(d, { address: A, storedRow: row, relayVersionId: null, entry, baseline: maps.B }), { act: true }, 'the next round\'s removal');
});

test('RP69: a re-sent older version after an id-only revoke is created after downtime — the read that returned the newer version dropped the older one from S and B, so it is an arrival and its create is not held (ADR 0003 planner list; AC-2, AC-4; T7, T9, T16)', () => {
  const { recordId, shrinkOnRead, arrivalsAndLookOnly, gateAction } = need('recordId', 'shrinkOnRead', 'arrivalsAndLookOnly', 'gateAction');
  const { decideAddress } = sweep();
  const A = addr('rp-sc-resent');
  const v1 = makeTagging({ d: 'rp-sc-resent', id: idOf('rp:sc:resent:v1'), createdAt: 1000 });
  const v2 = makeTagging({ d: 'rp-sc-resent', id: idOf('rp:sc:resent:v2'), createdAt: 2000, polarity: '-1' });
  const maps = mapsWith({ S: [[v1.id, A, 0]], B: [v1.id] }); // v1 held at the first start
  recordId(maps, 'H', v2.id, A, 1); // v2 stored after it
  const s = shrinkOnRead(maps, A, v2.id, 1);
  sameSet(uniq((s && s.dropped) || []), [v1.id], 'the read that returned v2 dropped v1');
  eq(maps.B.has(v1.id), false, 'B no longer holds v1');
  recordId(maps, 'S', v2.id, A, 2);
  maps.H.delete(v2.id);
  // Downtime: v2 revoked by id, v1 re-sent. The catch-up's scan finds v1; the graph holds v2.
  const r = arrivalsAndLookOnly([[v1.id, A]], maps, new Map([[A, v2.id]]));
  sameSet(r.arrivals.map(pairKey), [`${A}|${v1.id}`], 'v1 is an arrival');
  const dUpd = decideAddress(storedRowFor(v2), contractEdge(v1));
  eq(dUpd.action, 'update', 'fixture: the graph follows the relay back to v1');
  gateIs(gateAction(dUpd, { address: A, storedRow: storedRowFor(v2), relayVersionId: v1.id, entry: entryOf({ version: v1.id }), baseline: maps.B }), { act: true }, 'the update');
  const dCr = decideAddress(null, contractEdge(v1));
  gateIs(gateAction(dCr, { address: A, storedRow: null, relayVersionId: v1.id, entry: entryOf({ version: v1.id }), baseline: maps.B }), { act: true }, 'had the graph not held A, the create');
  gateIs(gateAction(dCr, { address: A, storedRow: null, relayVersionId: v1.id, entry: entryOf({ version: v1.id }), baseline: new Set([v1.id]) }), { act: false, held: 'pre-existing' }, 'control: with v1 still in B the create would be held');
});

test('RP70: a version dropped over the backlog cap and then revoked by id is found by the catch-up — a deletion candidate in its author\'s #e scan, whose kind-5 the predicate keeps and resolveDeletion turns into a revoke that removes (ADR 0003 planner list; § The in-memory backlog; T10, T11, T6, T16)', () => {
  const { deletionCandidates, deletionScanFilters, isExpectedDeletion, resolveDeletion, mergePrompt, gateAction } = need('deletionCandidates', 'deletionScanFilters', 'isExpectedDeletion', 'resolveDeletion', 'mergePrompt', 'gateAction');
  const { decideAddress } = sweep();
  const A = addr('rp-sc-cap');
  const v0 = makeTagging({ d: 'rp-sc-cap', id: idOf('rp:sc:cap:v0'), createdAt: 1000 });
  const v1 = makeTagging({ d: 'rp-sc-cap', id: idOf('rp:sc:cap:v1'), createdAt: 2000 });
  const maps = mapsWith({ S: [[v0.id, A, 1]], H: [[v1.id, A, 2]] }); // v1's prompt was dropped; its id is in H
  const graph = new Map([[A, v0.id]]);
  const cands = deletionCandidates(graph, new Set(), maps); // the relay holds neither now
  assert(Array.isArray(cands), `deletionCandidates must return an array (T10), got ${show(cands)}`);
  sameSet(cands.map(pairKey), [`${A}|${v0.id}`, `${A}|${v1.id}`], 'candidates');
  const scans = deletionScanFilters(cands);
  const eScan = (scans || []).find((x) => x && x.by === 'e' && x.pubkey === ALICE && arrayOf(x.targets, 'targets').includes(v1.id));
  assert(eScan, `Alice's #e scan names v1: ${show(scans)}`);
  const k5 = makeDeletion({ author: ALICE, e: [v1.id], id: idOf('rp:sc:cap:k5'), createdAt: 2100 });
  eq(isExpectedDeletion(k5, eScan), true, 'the scan keeps Alice\'s kind-5');
  const r = resolved(resolveDeletion(k5, maps, new Set([A])), 'resolveDeletion');
  same(r.prompts.map(promptKey), [`${A}|e|${v1.id}`], 'it becomes a by-e revoke at A');
  const row = storedRowFor(v0);
  gateIs(gateAction(decideAddress(row, null), { address: A, storedRow: row, relayVersionId: null, entry: mergePrompt(null, r.prompts[0].prompt), baseline: maps.B }), { act: true }, 'the removal');
});

test('RP71: a by-id revoke, then a re-apply at the same address during an overlapping pass, then a wipe — the re-look removes nothing, because the re-apply discarded the revoke (ADR 0003 planner list; § gateAction; T15, T16, T17)', () => {
  const { resolveDeletion, mergePrompt, discardSupersededRevokes, passOverlaps, relayAtAddress, gateAction } = need('resolveDeletion', 'mergePrompt', 'discardSupersededRevokes', 'passOverlaps', 'relayAtAddress', 'gateAction');
  const { decideAddress } = sweep();
  const A = addr('rp-sc-reapply');
  const v1 = makeTagging({ d: 'rp-sc-reapply', id: idOf('rp:sc:reapply:v1'), createdAt: 1000 });
  const v2 = makeTagging({ d: 'rp-sc-reapply', id: idOf('rp:sc:reapply:v2'), createdAt: 3000 });
  const maps = mapsWith({ S: [[v1.id, A, 1]] });
  const k5 = makeDeletion({ author: ALICE, e: [v1.id], id: idOf('rp:sc:reapply:k5'), createdAt: 2000 });
  const r = resolved(resolveDeletion(k5, maps, new Set([A])), 'resolveDeletion');
  eq(r.prompts.length, 1, 'the revoke resolves');
  const withRevoke = mergePrompt(mergePrompt(null, r.prompts[0].prompt), { type: 'version', id: v2.id });
  const entry = discardSupersededRevokes(withRevoke, v2.id);
  same(entry.revokes, [], 'v2 heard at A: the by-id revoke of v1 is discarded');
  same(passOverlaps({ graphReadAt: T0, commitAt: T0 + 300 }, [runEntry(RUN, T0 - 5000, T0 + 200)], () => false, {}), [RUN], 'the round overlapped a pass: a re-look is scheduled');
  const row = storedRowFor(v2); // the pass wrote v2; then the relay was wiped
  const d = decideAddress(row, relayAtAddress([], [], A, IDENTITIES));
  same([d.action, d.reason], ['remove', 'not-on-relay'], 'the re-look reads nothing at A');
  gateIs(gateAction(d, { address: A, storedRow: row, relayVersionId: null, entry, baseline: maps.B }), { act: false, held: 'removal-not-prompted' }, 'the re-look');
  gateIs(gateAction(d, { address: A, storedRow: row, relayVersionId: null, entry: withRevoke, baseline: maps.B }), { act: true }, 'control: had the revoke been kept, it would have removed v2');
});

// ═══ T25: the planner details the suite writers asked about ════════════════════════════════════════════════════
test('RP72: a kind-5 whose own pubkey is written in upper-case hex is not isEvent-shaped, so it resolves nothing live — no prompt, no foreign count, matchedNothing — though the same kind-5 in lower-case hex resolves by e and by a; the catch-up\'s author-scoped predicate still keeps it (T25 "A kind-5 whose own pubkey is written in upper-case hex"; T6; T11; owner decision 5\'s corners)', () => {
  const { resolveDeletion, isExpectedDeletion } = need('resolveDeletion', 'isExpectedDeletion');
  hasLetters(DAVE, 'DAVE');
  const A = addr('rp-t25-upk5', DAVE);
  const idD = idOf('rp:t25:upk5');
  const maps = mapsWith({ S: [[idD, A, 1]] });
  const graph = new Set([A]);
  const lower = makeDeletion({ author: DAVE, e: [idD], a: [A], id: idOf('rp:t25:upk5:k5'), createdAt: 9500 });
  const upper = { ...lower, pubkey: DAVE.toUpperCase() };
  const control = resolved(resolveDeletion(lower, maps, graph), 'resolveDeletion (control: the pubkey in lower-case hex)');
  sameSet(control.prompts.map(promptKey), [`${A}|e|${idD}`, `${A}|a|${A}`], 'control: the lower-case kind-5 resolves by e and by a');
  same(resolveDeletion(upper, maps, graph), { prompts: [], matchedNothing: true, foreign: 0 }, 'resolveDeletion (the pubkey in upper-case hex)');
  // The next catch-up finds it: strfry's authors filter matches by hex, and the predicate compares the pubkey lower-cased.
  eq(isExpectedDeletion(upper, { pubkey: DAVE, by: 'e', targets: [idD] }), true, 'the catch-up\'s #e predicate keeps it');
  eq(isExpectedDeletion(upper, { pubkey: DAVE, by: 'a', targets: [A] }), true, 'the catch-up\'s #a predicate keeps it');
});

test('RP73: gateAction treats a null ctx.entry as an empty entry — a create is held only by the baseline, a not-on-relay or non-tagging removal is held as removal-not-prompted, and every other action acts — never throwing (T25 "gateAction treats a null ctx.entry as an empty entry"; T16)', () => {
  const gateAction = fn('gateAction');
  const { decideAddress } = sweep();
  const { taggingToEdge } = contract();
  const row = storedRowFor(GV1);
  const nt = makeNonTagging({ address: GA, refusal: 'no-target', id: idOf('rp:t25:gate:nt'), createdAt: 3000 });
  const rows = [
    { name: 'a create, its version in the baseline', d: decideAddress(null, contractEdge(GV1)), row: null, vid: GV1.id, baseline: new Set([GV1.id]), action: 'create', want: { act: false, held: 'pre-existing' } },
    { name: 'a create, its version not in the baseline', d: decideAddress(null, contractEdge(GV1)), row: null, vid: GV1.id, baseline: new Set(), action: 'create', want: { act: true } },
    { name: 'a not-on-relay removal', d: decideAddress(row, null), row, vid: null, baseline: new Set(), action: 'remove', want: { act: false, held: 'removal-not-prompted' } },
    { name: 'a non-tagging removal', d: decideAddress(row, taggingToEdge(nt, IDENTITIES)), row, vid: nt.id, baseline: new Set(), action: 'remove', want: { act: false, held: 'removal-not-prompted' } },
    { name: 'an update', d: decideAddress(row, contractEdge(GV2)), row, vid: GV2.id, baseline: new Set([GV2.id]), action: 'update', want: { act: true } },
    { name: 'a none', d: decideAddress(row, contractEdge(GV1)), row, vid: GV1.id, baseline: new Set(), action: 'none', want: { act: true } },
  ];
  cases(rows, ({ d, row: r, vid, baseline, action, want }) => {
    eq(d.action, action, 'fixture: decideAddress\'s action');
    const ctx = { address: GA, storedRow: r, relayVersionId: vid, baseline };
    gateIs(gateAction(d, { ...ctx, entry: entryOf() }), want, 'control: with an empty entry');
    let out;
    try { out = gateAction(d, { ...ctx, entry: null }); } catch (e) { throw new Error(`gateAction threw on a null entry: ${firstLine(e)}`); }
    gateIs(out, want, 'with entry null');
  });
});

test('RP74: roundOrder places an address queued in more than one lane once, at its earliest position — the catch-up share before live, live before re-looks, re-looks before the rest of the catch-up — and a repeat takes none of the round\'s 500 places (T25 "roundOrder places an address queued in more than one lane once, at its earliest position"; T18)', () => {
  const roundOrder = fn('roundOrder');
  const q1 = [
    { address: 'x', lane: 'live', seq: 0 }, { address: 'y', lane: 'relook', seq: 1 }, { address: 'x', lane: 'catchup', seq: 1 },
    { address: 'l6', lane: 'live', seq: 6 }, { address: 'c2', lane: 'catchup', seq: 2 }, { address: 'y', lane: 'live', seq: 5 },
    { address: 'r2', lane: 'relook', seq: 2 },
  ];
  same(roundOrder(q1), ['x', 'c2', 'y', 'l6', 'r2'], 'x at its catch-up-share place, not again in live; y at its live place, not again in the re-looks');
  // Past the share: an address in the remaining catch-up and in live sits at its live place; one in the remaining
  // catch-up and in the re-looks sits at its re-look place.
  const c = laneEntries('catchup', 101, 'c', (i) => i);
  const q2 = [
    ...c, { address: 'z', lane: 'catchup', seq: 200 }, { address: 'w', lane: 'catchup', seq: 201 },
    { address: 'z', lane: 'live', seq: 150 }, { address: 'l1', lane: 'live', seq: 151 },
    { address: 'w', lane: 'relook', seq: 160 }, { address: 'r1', lane: 'relook', seq: 159 },
  ];
  same(roundOrder(shuffled(q2)), [...bySeq(c).slice(0, 100), 'z', 'l1', 'r1', 'w', 'c-100'], 'z at its live place, w at its re-look place, each once');
  // 300 live, then 300 re-looks of which the 100 lowest-seq are live addresses again: 500 distinct addresses fill the round.
  const l = laneEntries('live', 300, 'l', (i) => i);
  const rDup = laneEntries('relook', 100, 'l', (i) => 1000 + i);
  const rOwn = laneEntries('relook', 200, 'r', (i) => 2000 + i);
  const out = roundOrder(shuffled(l, rDup, rOwn));
  assert(Array.isArray(out), `roundOrder must return [address] (T18), got ${show(out)}`);
  eq(uniq(out).length, out.length, 'no address repeated');
  same(out, [...bySeq(l), ...bySeq(rOwn)], 'the 300 live addresses, then the 200 re-looks of other addresses: 500, the repeats taking no place');
});

test('RP75: replayJournal restores the record\'s pending [{ a, entry, lane, attempts, notBefore }], rechecks [{ a, runId, entry }] and parked [{ a, code, attempts, nextAt }] into pending Map<address, entry>, the rechecks list and parked Map<address, code>, and the journal\'s d, v, c, r, rc, p and k lines apply on top of them (T25 record shapes and "Replay"; T19)', () => {
  const replayJournal = fn('replayJournal');
  const [A, B2, C, D, E, F2] = ['a', 'b', 'c', 'd', 'e', 'f'].map((n) => addr(`rp-t25-rec-${n}`));
  const id = (n) => idOf(`rp:t25:rec:${n}`);
  const [rvA, rvA2, rvC] = [revoke('a', A, 1000), revoke('a', A, 3000), revoke('e', id('c0'), 1500)];
  const record = {
    version: 1, firstStartedAt: iso(T0 - 86400000), identities: { canonical: CANONICAL, local: LOCAL }, compactedAt: iso(T0 - 60000),
    seen: [[id('c0'), C]], heard: [[id('a'), A], [id('c'), C]], baseline: [], refusedSeen: [],
    pending: [
      { a: A, entry: entryOf({ version: id('a'), revokes: [rvA] }), lane: 'live', attempts: 1, notBefore: T0 + 5000 },
      { a: B2, entry: entryOf({ look: true }), lane: 'catchup', attempts: 0, notBefore: 0 },
      { a: C, entry: entryOf({ version: id('c') }), lane: 'live', attempts: 0, notBefore: 0 },
    ],
    rechecks: [
      { a: A, runId: RUN, entry: entryOf({ look: true }) },
      { a: D, runId: RUN2, entry: entryOf({ version: id('d'), revokes: [rvC] }) },
    ],
    deadSeenAt: { [RUN2]: T0 - 100 },
    parked: [{ a: E, code: 'ENOSPC', attempts: 2, nextAt: T0 + 60000 }],
  };
  const pendingOf = (out) => [...out.pending.entries()].reduce((o, [k, v]) => { o[k] = entryFields(v); return o; }, {});
  const recheckKey = (x) => `${x.a}|${x.runId}`;

  // The record alone.
  const restored = replayed(replayJournal([], record), 'replayJournal (record only)');
  same(pendingOf(restored), {
    [A]: entryOf({ version: id('a'), revokes: [rvA] }), [B2]: entryOf({ look: true }), [C]: entryOf({ version: id('c') }),
  }, 'pending: each record entry\'s entry, keyed by its a');
  same([...restored.rechecks].sort((x, y) => (recheckKey(x) < recheckKey(y) ? -1 : 1)), [...record.rechecks].sort((x, y) => (recheckKey(x) < recheckKey(y) ? -1 : 1)), 'rechecks: [{ a, runId, entry }] as the record holds them');
  same([...restored.parked.entries()], [[E, 'ENOSPC']], 'parked: Map<address, code>');
  same(restored.deadSeenAt, { [RUN2]: T0 - 100 }, 'deadSeenAt');

  // The record with lines on top.
  const out = replayed(replayJournal(texts([
    J.d(A, rvA2), // a newer revoke of (a, A): replaces rvA, with its own kind5Id
    J.c(id('a'), A), // A's version completes; its revoke remains
    J.v(id('b'), B2), // B gains a version; its look stays
    J.c(id('c'), C), // C's version completes and nothing remains: the entry is deleted
    J.r(A, RUN, entryOf({ revokes: [rvA2] })), // merges into the restored re-look (A, RUN)
    J.rc(D, RUN2), // ends the restored re-look (D, RUN2)
    J.p(F2, 'Neo.ClientError.Schema.ConstraintValidationFailed'),
    J.k(RUN3, T0),
  ]), record), 'replayJournal (record and lines)');
  same(pendingOf(out), { [A]: entryOf({ revokes: [rvA2] }), [B2]: entryOf({ version: id('b'), look: true }) }, 'pending after the lines (C deleted by c)');
  same(out.rechecks, [{ a: A, runId: RUN, entry: entryOf({ revokes: [rvA2], look: true }) }], 'rechecks after the lines');
  same([...out.parked.entries()].sort(), [[E, 'ENOSPC'], [F2, 'Neo.ClientError.Schema.ConstraintValidationFailed']].sort(), 'parked after the lines');
  same(out.deadSeenAt, { [RUN2]: T0 - 100, [RUN3]: T0 }, 'deadSeenAt after the lines');
  same([out.maps.S.has(id('a')), out.maps.H.has(id('a')), out.maps.S.has(id('c')), out.maps.H.has(id('c')), out.maps.H.has(id('b'))], [true, false, true, false, true], '[S has a, H has a, S has c, H has c, H has b]');
  eq(out.skippedLines, 0, 'skippedLines');
});

// ═══ T33: what the blind reference implementation found ════════════════════════════════════════════════════════
test('RP76: replaying a v line applies discardSupersededRevokes at that address with the line\'s id, to the pending entry and to its re-looks, as the live path does — a by-e revoke naming another id is gone after the replay (so a revoke discarded before a crash does not come back), while the by-e revoke naming the v line\'s own id and every by-a revoke stay, for entries the journal built and entries restored from record.json alike; entries at other addresses keep all theirs, and without the v line nothing is discarded (T33 "Replaying a v line also applies discardSupersededRevokes at that address, to the pending entry and its re-looks"; T15; T19; ADR 0003 § gateAction "A by-e prompt is discarded … as soon as another version is heard")', () => {
  const replayJournal = fn('replayJournal');
  const [A, B2] = [addr('rp-t33-v-a'), addr('rp-t33-v-b')];
  const id = (n) => idOf(`rp:t33:v:${n}`);
  const [i1, i2, j1, j2] = [id('i1'), id('i2'), id('j1'), id('j2')];
  const byKey = (e) => ((e && e.revokes) || []).map(revokeKey);
  const rvE1 = revoke('e', i1, 2000); // names the older id at A: superseded once i2 is heard there
  const rvE2 = revoke('e', i2, 2050); // names the id the v line hears: kept (T15)
  const rvA = revoke('a', A, 2100); // by-a: kept (T15)
  const rlE1 = revoke('e', i1, 2060);
  const rlA = revoke('a', A, 2160);
  const rvB = revoke('e', j1, 2200); // at another address: untouched
  const rlB = revoke('e', j2, 2300);

  // The journal alone: the live path heard i1, then the revokes, then i2 — and crashed before a compaction.
  const before = [
    J.v(i1, A), J.d(A, rvE1), J.d(A, rvE2), J.d(A, rvA),
    J.r(A, RUN, entryOf({ version: i1, revokes: [rlE1, rlA], look: true })),
    J.d(B2, rvB), J.r(B2, RUN, entryOf({ revokes: [rlB], look: true })),
  ];
  const control = replayed(replayJournal(texts(before), null), 'replayJournal (control: no v line for i2)');
  sameSet(byKey(control.pending.get(A)), [`e|${i1}`, `e|${i2}`, `a|${A}`], 'control: without the v line, the pending entry at A keeps every revoke');
  const controlRelook = control.rechecks.find((x) => x.a === A && x.runId === RUN);
  sameSet(byKey(controlRelook && controlRelook.entry), [`e|${i1}`, `a|${A}`], 'control: without the v line, the re-look at A keeps every revoke');

  const out = replayed(replayJournal(texts([...before, J.v(i2, A)]), null), 'replayJournal (… then v i2 at A)');
  const e = out.pending.get(A);
  assert(e && typeof e === 'object', `a pending entry at ${A}, got ${show(e)}`);
  sameSet(byKey(e), [`e|${i2}`, `a|${A}`], 'the pending entry at A after the v line: the by-e revoke of i1 is gone, the one of i2 and the by-a revoke stay');
  same(e.revokes.find((p) => revokeKey(p) === `a|${A}`), rvA, 'the by-a revoke kept whole');
  same(e.version, { id: i2 }, 'the pending entry\'s version is the v line\'s');
  const relook = out.rechecks.find((x) => x.a === A && x.runId === RUN);
  assert(relook && relook.entry, `the re-look (A, RUN) is still there, got ${show(out.rechecks)}`);
  sameSet(byKey(relook.entry), [`a|${A}`], 'the re-look at A after the v line: the by-e revoke of i1 is gone, the by-a revoke stays');
  eq(relook.entry.look, true, 'the re-look\'s look stays');
  sameSet(byKey(out.pending.get(B2)), [`e|${j1}`], 'the pending entry at another address keeps its revoke');
  const relookB = out.rechecks.find((x) => x.a === B2 && x.runId === RUN);
  sameSet(byKey(relookB && relookB.entry), [`e|${j2}`], 'the re-look at another address keeps its revoke');

  // Entries restored from record.json: a v line after the record discards there too.
  const record = {
    version: 1, firstStartedAt: iso(T0 - 86400000), identities: { canonical: CANONICAL, local: LOCAL }, compactedAt: iso(T0 - 60000),
    seen: [[i1, A]], heard: [], baseline: [], refusedSeen: [],
    pending: [{ a: A, entry: entryOf({ version: i1, revokes: [rvE1, rvA] }), lane: 'live', attempts: 1, notBefore: T0 + 5000 }],
    rechecks: [{ a: A, runId: RUN2, entry: entryOf({ revokes: [rlE1, rlA], look: true }) }],
    deadSeenAt: {}, parked: [],
  };
  const restoredControl = replayed(replayJournal([], record), 'replayJournal (control: the record only)');
  sameSet(byKey(restoredControl.pending.get(A)), [`e|${i1}`, `a|${A}`], 'control: the restored pending entry keeps every revoke');
  const fromRecord = replayed(replayJournal(texts([J.v(i2, A)]), record), 'replayJournal (the record, then v i2 at A)');
  sameSet(byKey(fromRecord.pending.get(A)), [`a|${A}`], 'the restored pending entry at A after the v line: only the by-a revoke');
  const restoredRelook = fromRecord.rechecks.find((x) => x.a === A && x.runId === RUN2);
  assert(restoredRelook && restoredRelook.entry, `the restored re-look (A, RUN2) is still there, got ${show(fromRecord.rechecks)}`);
  sameSet(byKey(restoredRelook.entry), [`a|${A}`], 'the restored re-look at A after the v line: only the by-a revoke');
});

test('RP77: discardSupersededRevokes(entry, null) keeps every revoke — by-e revokes of several ids and by-a revokes alike — with the version and look, since an empty read keeps them (the gate rule); and a null entry is returned as is, whatever the version (T33 "discardSupersededRevokes(entry, null) keeps every revoke … A null entry is returned as is"; T15; T16)', () => {
  const discardSupersededRevokes = fn('discardSupersededRevokes');
  const [v1, v2, v3] = [idOf('rp:t33:dsr:v1'), idOf('rp:t33:dsr:v2'), idOf('rp:t33:dsr:v3')];
  const A = addr('rp-t33-dsr');
  const revokes = [revoke('e', v1, 100), revoke('e', v2, 200), revoke('a', A, 300)];
  cases([
    { name: 'with a version and look', entry: entryOf({ version: v3, revokes, look: true }) },
    { name: 'with no version', entry: entryOf({ revokes }) },
  ], ({ entry }) => {
    const out = discardSupersededRevokes(JSON.parse(JSON.stringify(entry)), null);
    assert(out && Array.isArray(out.revokes), `discardSupersededRevokes(entry, null) must return an entry (T15), got ${show(out)}`);
    sameSet(out.revokes.map(exact), revokes.map(exact), 'every revoke kept, whole');
    same([out.version, out.look], [entry.version, entry.look], '[version, look]');
  });
  cases([
    { name: 'a null entry, a null version', version: null },
    { name: 'a null entry, a version id', version: v1 },
  ], ({ version }) => {
    let out;
    try { out = discardSupersededRevokes(null, version); } catch (e) { throw new Error(`discardSupersededRevokes(null, ${show(version)}) threw: ${firstLine(e)}`); }
    eq(out, null, `discardSupersededRevokes(null, ${show(version)}) returns the null entry as is`);
  });
});

test('RP78: replayJournal\'s pending holds entries only — each value is a T15 entry with exactly the keys version, revokes and look — whether restored from record.json\'s rows (which carry a, lane, attempts and notBefore beside the entry: those are for diagnostics only), built by the journal\'s v and d lines, or restored and then changed by lines (T33 "replayJournal\'s pending holds entries only (T15) … record.json keeps lane, attempts and notBefore for diagnostics only"; T15; T19: pending is Map<address, entry>; T25 record shapes)', () => {
  const replayJournal = fn('replayJournal');
  const [A, B2, C] = ['a', 'b', 'c'].map((n) => addr(`rp-t33-only-${n}`));
  const id = (n) => idOf(`rp:t33:only:${n}`);
  const rvA = revoke('a', A, 1000);
  const record = {
    version: 1, firstStartedAt: iso(T0 - 86400000), identities: { canonical: CANONICAL, local: LOCAL }, compactedAt: iso(T0 - 60000),
    seen: [], heard: [[id('a'), A]], baseline: [], refusedSeen: [],
    pending: [
      { a: A, entry: entryOf({ version: id('a'), revokes: [rvA] }), lane: 'live', attempts: 3, notBefore: T0 + 5000 },
      { a: B2, entry: entryOf({ look: true }), lane: 'relook', attempts: 1, notBefore: T0 + 60000 },
    ],
    rechecks: [], deadSeenAt: {}, parked: [],
  };
  const shapeProblems = (out, want) => {
    const p = [];
    for (const [address, e] of out.pending.entries()) {
      if (!e || typeof e !== 'object' || Array.isArray(e)) { p.push(`${address}: not an entry object: ${show(e)}`); continue; }
      const keys = Object.keys(e).sort();
      if (exact(keys) !== exact(['look', 'revokes', 'version'])) p.push(`${address}: keys ${show(keys)}, expected exactly ["look","revokes","version"]`);
    }
    for (const [address, entry] of Object.entries(want)) {
      if (!out.pending.has(address)) p.push(`${address}: missing from pending`);
      else if (exact(out.pending.get(address)) !== exact(entry)) p.push(`${address}: ${show(out.pending.get(address))}, expected ${show(entry)}`);
    }
    if (out.pending.size !== Object.keys(want).length) p.push(`pending holds ${out.pending.size} entries, expected ${Object.keys(want).length}`);
    return p;
  };
  const problems = [];
  const restored = replayed(replayJournal([], record), 'replayJournal (the record only)');
  problems.push(...shapeProblems(restored, { [A]: entryOf({ version: id('a'), revokes: [rvA] }), [B2]: entryOf({ look: true }) }).map((x) => `[restored] ${x}`));
  const built = replayed(replayJournal(texts([J.v(id('c'), C), J.d(C, revoke('a', C, 1100))]), null), 'replayJournal (lines only)');
  problems.push(...shapeProblems(built, { [C]: entryOf({ version: id('c'), revokes: [revoke('a', C, 1100)] }) }).map((x) => `[built by lines] ${x}`));
  const changed = replayed(replayJournal(texts([J.v(id('b'), B2), J.c(id('a'), A)]), record), 'replayJournal (the record, then lines)');
  problems.push(...shapeProblems(changed, { [A]: entryOf({ revokes: [rvA] }), [B2]: entryOf({ version: id('b'), look: true }) }).map((x) => `[restored, then changed] ${x}`));
  assert(problems.length === 0, problems.join('\n        '));
});

// ═══ Found by the mutation pass over the blind reference implementation ═════════════════════════════════════════
test('RP79: replayJournal keeps the FIRST k time for a run — deadSeenAt[runId] is when the path first saw the run not alive, so a later k line for the same run never moves it: of two k lines the first one\'s at stands, a record.json that already holds the run keeps its time against a later k line, and each run keeps its own first time; so a round that read the graph after the first sighting does not overlap the dead run, whatever later k lines say (ADR 0003 § Coexisting with the pass: "deadSeenAt[runId] is the first time this path saw the run not alive (journal k)", "a round that reads the graph after deadSeenAt cannot be overwritten by it"; T17; T19; T25: deadSeenAt a plain object from runId to milliseconds)', () => {
  const { replayJournal, passOverlaps } = need('replayJournal', 'passOverlaps');
  const twice = replayed(replayJournal(texts([J.k(RUN, T0 + 1000), J.k(RUN, T0 + 2000)]), null), 'replayJournal (two k lines for one run)');
  same(twice.deadSeenAt, { [RUN]: T0 + 1000 }, 'two k lines for one run: deadSeenAt keeps the first line\'s at, never the later one\'s');
  const record = { version: 1, seen: [], heard: [], baseline: [], refusedSeen: [], pending: [], rechecks: [], deadSeenAt: { [RUN]: T0 + 1500 }, parked: [] };
  const onRecord = replayed(replayJournal(texts([J.k(RUN, T0 + 3000), J.k(RUN2, T0 + 4000), J.k(RUN2, T0 + 5000)]), record), 'replayJournal (k lines over a record)');
  same(onRecord.deadSeenAt, { [RUN]: T0 + 1500, [RUN2]: T0 + 4000 },
    'the record\'s time stands against a later k line for its run, and a run first seen dead in the journal keeps its first line\'s at');
  // Why the first time (T17): a round whose graph read came after the path first saw the run dead cannot be overwritten
  // by that run, so it must not overlap it. A later k time would make it overlap, and re-look for nothing.
  const runs = [runEntry(RUN, T0 - 60000, null)];
  same(passOverlaps({ graphReadAt: T0 + 1200, commitAt: T0 + 1300 }, runs, () => false, twice.deadSeenAt), [],
    'passOverlaps over the replayed deadSeenAt: a round that read the graph after the first k (T0 + 1000) but before the second (T0 + 2000)');
});

// ─── runner ────────────────────────────────────────────────────────────────────────────────────────────────────
async function run() {
  console.log('\n--- tagging-edges real-time planner tests (epic tagging-edges, Story 3 — src/lib/tagging-edges/realtime.js) ---');
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  PASS  ${name}`); pass++; }
    catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failures.push({ name, message: err.message }); fail++; }
  }
  console.log(`\ntagging-edges-realtime-plan: ${pass} passed, ${fail} failed, 0 skipped`);
  return { pass, fail, skipped: 0, failures };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
