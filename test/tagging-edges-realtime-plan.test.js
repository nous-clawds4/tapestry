'use strict';
/**
 * Tests for Story 3 (epic tagging-edges) — the real-time path's pure planner, src/lib/tagging-edges/realtime.js.
 *
 * Story: engineering-team/stories/tagging-edges/3-real-time-path.md (AC-1 … AC-7; "For Test Design")
 * ADR:   engineering-team/decisions/tagging-edges/0003-real-time-path.md — § Decision ("What it hears", "Knowing what
 *        changed while it was away", "What it decides and writes", "Coexisting with the pass", "Status and switch"),
 *        "Implementation notes → New files → realtime.js", the planner list under "Tests the Tester owns → New suites
 *        → The pure planner", and "Clarifications (Test Design, 2026-09-28)" T1–T19, which fix every interface this
 *        suite calls, T25, which settles the planner details they left open, and T33 (pending holds entries only),
 *        all as "Amendment A1 — revokes by event id, and what an empty read keeps" amends them: A1-1 (the lineage
 *        L(A) = {top, older} replaces H), A1-2 (learning, and a read placed at its capture), A1-3 (an e target
 *        resolves only as its address's top), A1-4 (the gate's clauses (i) and (ii); owner decision 11 accepted),
 *        A1-5 (no discards; at most 8 by-e revokes per entry), A1-6 (absolute v and o lines, the e epoch line),
 *        A1-7 (the cap of 8 older ids, and pruneLineage), A1-8 (the census), A1-12 (parked prompts persist), and
 *        A1-17, which fixes the interfaces this suite calls. A1-20 lists this suite's re-aims: RP2, RP3, RP8, RP14–
 *        RP16, RP19, RP20, RP22–RP26, RP30, RP59–RP64, RP67–RP72, RP75, RP78 and RP79 are re-aimed; RP47, RP76 and
 *        RP77 are deleted (A1-5: discardSupersededRevokes and replay's discard are gone); RP80–RP96 are new. Binding
 *        context: ADR tagging-edges/0002 (the pass's planner, src/lib/tagging-edges/sweep.js —
 *        decideAddress, readRelay, storedFromRow, checkIdentity) and ADR tagging-edges/0001 as amended (the contract,
 *        src/lib/tagging-edges/contract.js — taggingToEdge, revokeTargets, revokeApplies).
 *
 * Intentionally failing until realtime.js lands (red phase), and now until it lands Amendment A1: the re-aimed and new
 * tests fail with "… does not export learnVersion() yet" (an A1 export missing) or on the pre-A1 behaviour A1 forbids
 * (an H in the maps, a by-e revoke that acts whatever it names, a replayed v line that discards). The module is
 * require()d LAZILY inside each test through load() / fn(), so this suite always loads and each test fails with
 * "src/lib/tagging-edges/realtime.js not implemented yet (require failed: …)" or "… does not export X() yet", never
 * with a load error of its own.
 *
 * Pure and stack-free: no Neo4j, no strfry, no network, no filesystem writes, no clock (times are fixed numbers). The
 * one filesystem read is RP1's read of realtime.js's own source. Relay events and graph rows come from
 * test/helpers/taggingEdgesFixtures.js; decisions come from the real sweep.js decideAddress, as the engine gets them.
 * Every pubkey is a fake 64-hex value from that helper — never a deployment's TA and never the ADR 0015 literal. The
 * canonical and local identities are kept different, as in story 2.
 *
 * What is pinned: T1–T19's names, argument orders, result shapes and rules, as T25 refines them and A1-17 amends
 * them. The container types are T25's, passed and read strictly — no value that would work under another reading:
 *   Sets     `scannedIds` (T8, T10, pruneLineage);
 *   arrays   `targets` (T11, given and returned), `addresses` and `ids` (T12);
 *   a plain object from runId to milliseconds — `deadSeenAt` (T17, and replayJournal's result, T19).
 * A1-17 leaves pruneLineage's other containers open; this suite fixes them as graphKeys a Map from address to eventId
 * (as T9 and T10 pass it), keep a Set of addresses, and learnedAfter a Map from address to a Set of ids. A lineage is
 * read through lineageValue (A1-17: { top, older: [ids] }) and compared with older as a set; ctx.lineage is passed to
 * gateAction in that shape, the copy A1-4 says the gate reads. learnVersion's options are passed as { under: false }
 * for a delivery or a placed read, and { under: true } for a read placed under a later learning (A1-2).
 * A pending entry is compared on T15's three fields { version, revokes, look }; RP78 pins that replayJournal's pending
 * values are entries only, those three keys and no more (T33); RP79 that replayJournal keeps the first k time for a
 * run (ADR § Coexisting with the pass; added from the mutation pass). Filter budgets are checked against the
 * suite's own reference escape (JSON.stringify with every "/" written "\/", measured in UTF-8 bytes) and the literal
 * 100,000, never against the module's own filterArgvBytes or LIMITS, so a wrong helper cannot pass itself. Maps are
 * built through newMaps(), recordId() and learnVersion() / learnOlder() (T3 as amended), as the engine builds them.
 * Journal lines are written in A1-6's absolute form (v {id, a, top, older}, o {a, top, older}); a record carries an
 * epoch and its lines start with the matching e {epoch} line, as a compaction writes them.
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

/** T2's export list as A1-17 amends it, less LIMITS: discardSupersededRevokes dropped, the six lineage functions added. */
const T2_FUNCTIONS = [
  'escapeFilterArgv', 'filterArgvBytes', 'subscriptionFilters', 'promptFromVersion', 'newMaps', 'recordId',
  'learnVersion', 'learnOlder', 'lineageAt', 'lineageValue', 'setLineage', 'pruneLineage',
  'resolveDeletion', 'shrinkOnRead', 'compact', 'arrivalsAndLookOnly', 'deletionCandidates', 'deletionScanFilters',
  'isExpectedDeletion', 'addressScanFilters', 'isExpectedAddressEvent', 'elementScanFilters', 'isExpectedElementEvent',
  'dedupeById', 'relayAtAddress', 'mergePrompt', 'gateAction', 'passOverlaps', 'roundOrder',
  'journalLine', 'replayJournal', 'allowErrorCode',
];
/** The names A1-17 drops from T2's list (A1-5: nothing discards a revoke prompt). */
const T2_DROPPED = ['discardSupersededRevokes'];

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

/** learnVersion's options (A1-2, A1-17): a delivery, or a read or scan placed at its capture — and one placed under a later learning. */
const PLACED = Object.freeze({ under: false });
const UNDER = Object.freeze({ under: true });

/**
 * Teach lineages in order (A1-2): each row [address, top, older = []] learns its older ids oldest-first and then its
 * top, as deliveries (learnVersion), so the top is the latest learned and older the ones it replaced. A null top is a
 * census row (A1-8): its older ids join through learnOlder, with no top.
 */
function learnRows(m, rows) {
  const { learnVersion, learnOlder } = need('learnVersion', 'learnOlder');
  for (const [a, top, older = []] of rows) {
    if (top === null) { for (const o of older) learnOlder(m, a, o); continue; }
    for (const o of older) learnVersion(m, a, o, PLACED);
    learnVersion(m, a, top, PLACED);
  }
  return m;
}

/**
 * A fresh maps object (T3 as amended by A1-17) with entries recorded through recordId — { S: [[id, a, seq]], R, B:
 * [ids] } — and lineages learned through learnRows — { L: [[address, top, [older…]]] }.
 */
function mapsWith(spec = {}) {
  const { newMaps, recordId } = need('newMaps', 'recordId');
  const m = newMaps();
  for (const which of ['S', 'R']) {
    for (const [id, a, seq = 0] of spec[which] || []) recordId(m, which, id, a, seq);
  }
  for (const id of spec.B || []) m.B.add(id);
  if (spec.L) learnRows(m, spec.L);
  return m;
}

/** The members of an `older` as lineageAt may hold it (A1-17 T3: a Set or null; A1-17: `older: []`): an array. */
function membersOf(older, label) {
  if (older === null || older === undefined) return [];
  if (older instanceof Set) return [...older];
  if (Array.isArray(older)) return older;
  throw new Error(`${label}: older must be a Set, an array or null (T3 as amended, A1-17), got ${show(older)}`);
}
/**
 * The lineage at an address, read through lineageValue (A1-17: → { top, older: [ids] }), as { top, older: sorted ids };
 * null when the path keeps none there (lineageValue gives null, or an empty { top: null, older: [] } — A1-17 leaves
 * which one open).
 */
function lin(maps, a) {
  const v = fn('lineageValue')(maps, a);
  if (v === null || v === undefined) return null;
  assert(v && typeof v === 'object' && (v.top === null || typeof v.top === 'string') && Array.isArray(v.older),
    `lineageValue must return { top: id | null, older: [ids] } (A1-17), got ${show(v)}`);
  if (v.top === null && v.older.length === 0) return null;
  return { top: v.top, older: [...v.older].sort() };
}
/** An expected lineage, in lin()'s form. */
const L = (top, older = []) => ({ top, older: [...older].sort() });

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

/** The T19 line objects, as A1-6 amends them: v and o are absolute (the whole lineage at `a`); e opens a generation. */
const J = {
  v: (id, a, top, older) => ({ t: 'v', id, a, top, older }),
  o: (a, top, older) => ({ t: 'o', a, top, older }),
  e: (epoch) => ({ t: 'e', epoch }),
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
  assert(out && typeof out === 'object' && out.maps && out.maps.S instanceof Map && out.maps.L instanceof Map
    && out.maps.B instanceof Set && out.maps.R instanceof Map && !('H' in out.maps),
  `${label}: replayJournal must return { maps: { S: Map, B: Set, R: Map, L: Map } — no H — , pending, rechecks, deadSeenAt, parked, skippedLines } (T19; T3 as amended by A1-1 and A1-17), got maps with ${show(out && out.maps && Object.keys(out.maps))}`);
  assert(out.pending instanceof Map, `${label}: pending must be a Map<address, entry> (T19), got ${show(out.pending)}`);
  assert(Array.isArray(out.rechecks), `${label}: rechecks must be an array of { a, runId, entry } (T19), got ${show(out.rechecks)}`);
  assert(out.parked instanceof Map && [...out.parked.values()].every((c) => typeof c === 'string'),
    `${label}: parked must be a Map<address, code> (T19; A1-12 "parked stays Map<address, code>"), got ${show(out.parked)}`);
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

test('RP2: realtime.js exports every name T2 lists as A1-17 amends it — LIMITS and the 32 functions, learnVersion, learnOlder, lineageAt, lineageValue, setLineage and pruneLineage among them — and no longer exports discardSupersededRevokes (T2 as amended by A1-17: "The exports drop discardSupersededRevokes, and add learnVersion, learnOlder, lineageAt, lineageValue, setLineage and pruneLineage"; A1-5 "Nothing discards a revoke prompt for being stale")', () => {
  eq(T2_FUNCTIONS.length, 32, 'fixture: T2 as amended lists 32 functions besides LIMITS');
  const m = load();
  const missing = T2_FUNCTIONS.filter((f) => typeof m[f] !== 'function');
  if (!(m.LIMITS && typeof m.LIMITS === 'object')) missing.unshift('LIMITS (an object)');
  const stillExported = T2_DROPPED.filter((f) => m[f] !== undefined);
  same({ missing, stillExported }, { missing: [], stillExported: [] }, `${REALTIME_REL}: exports missing, and names A1-17 drops still exported (T2 as amended)`);
});

test('RP3: src/lib/tagging-edges/index.js re-exports every realtime.js name, as the same value — the six lineage functions included — and no dropped name (ADR 0003 Implementation notes: "re-exported from src/lib/tagging-edges/index.js"; T2 as amended by A1-17)', () => {
  const m = load();
  let index;
  try { index = require(LIB_INDEX); } catch (e) { throw new Error(`src/lib/tagging-edges/index.js failed to load: ${firstLine(e)}`); }
  const names = ['LIMITS', ...T2_FUNCTIONS];
  const notInRealtime = names.filter((k) => m[k] === undefined);
  const notReexported = names.filter((k) => m[k] !== undefined && index[k] !== m[k]);
  const stillReexported = T2_DROPPED.filter((k) => index[k] !== undefined);
  same({ notInRealtime, notReexported, stillReexported }, { notInRealtime: [], notReexported: [], stillReexported: [] },
    'names realtime.js does not export yet, names src/lib/tagging-edges/index.js does not re-export from ./realtime, and dropped names it still re-exports');
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
test('RP8: newMaps() gives fresh, empty { S: Map, B: Set, R: Map, L: Map } — no H; recordId(maps, which, id, address, seq) sets one { a, seq } entry in S or R (which is \'S\' | \'R\'), re-recording replaces it, and it never touches the lineage; L\'s values are { top: string | null, older: Set | null } (T3 as amended by A1-17: "newMaps() → {S, B, R, L}, with L: Map<address, {top: string | null, older: Set | null}>. recordId\'s which is \'S\' | \'R\'"; A1-1 "H is removed"; A1-2 "Nothing else changes a lineage")', () => {
  const { newMaps, recordId, learnVersion } = need('newMaps', 'recordId', 'learnVersion');
  const m = newMaps();
  assert(m && m.S instanceof Map && m.L instanceof Map && m.R instanceof Map && m.B instanceof Set,
    `newMaps() must return { S: Map, B: Set, R: Map, L: Map } (T3 as amended by A1-17), got ${show(m)}`);
  eq('H' in m, false, 'newMaps() holds no H (A1-1: "H is removed")');
  same([m.S.size, m.B.size, m.R.size, m.L.size], [0, 0, 0, 0], 'a new maps object is empty');
  const m2 = newMaps();
  assert(m2.S !== m.S && m2.L !== m.L && m2.B !== m.B && m2.R !== m.R, 'each newMaps() call returns its own Maps and Set');
  const A = addr('rp-maps');
  const B2 = addr('rp-maps-2');
  const [i1, i2, i3] = [idOf('rp:maps:1'), idOf('rp:maps:2'), idOf('rp:maps:3')];
  recordId(m, 'S', i1, A, 3);
  same(m.S.get(i1), { a: A, seq: 3 }, "recordId(maps, 'S', …) sets S's entry");
  same([m.R.size, m.B.size, m.L.size], [0, 0, 0], "recordId(maps, 'S', …) touches no other map — completing a version teaches the lineage nothing (A1-2)");
  recordId(m, 'R', i3, B2, 5);
  same(m.R.get(i3), { a: B2, seq: 5 }, "recordId(maps, 'R', …) sets R's entry (refusedSeen)");
  same([m.S.has(i3), m.L.size], [false, 0], "recordId(maps, 'R', …) adds nothing to S or the lineage");
  recordId(m, 'S', i1, A, 9);
  same(m.S.get(i1), { a: A, seq: 9 }, 're-recording an id replaces its entry');
  eq(m.S.size, 1, 're-recording an id keeps one entry');
  learnVersion(m, A, i2, PLACED);
  const one = m.L.get(A);
  assert(one && one.top === i2 && (one.older === null || one.older instanceof Set) && membersOf(one.older, 'L at A').length === 0,
    `L's value at A after one version learned: { top: that id, older: null or an empty Set } (T3 as amended), got ${show(one)}`);
  learnVersion(m, A, i1, PLACED);
  const two = m.L.get(A);
  assert(two && two.top === i1 && two.older instanceof Set, `L's value at A after a second version learned: { top: it, older: a Set } (T3 as amended), got ${show(two)}`);
  sameSet([...two.older], [i2], 'L at A: older holds the replaced top');
  same([m.S.get(i1), m.S.has(i2), m.R.size, m.B.size], [{ a: A, seq: 9 }, false, 1, 0], 'learning records nothing in S, R or B');
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
test('RP14: a deletion\'s e target resolves only while it is the top of its address\'s lineage — the latest version the path learned there, completed (in S) or not — to one revoke prompt { type: \'revoke\', kind5Id, created_at, by: \'e\', target } at that address, an upper-case e included, its target lower-cased; an id S alone records, an id in older, and a census id resolve nothing, and are not counted (T6 as amended by A1-3 and A1-17: "An e target resolves through the lineage\'s top"; "Any other e target resolves nothing"; A1-8; AC-2)', () => {
  const resolveDeletion = fn('resolveDeletion');
  const AS = addr('rp-rd-s');
  const AH = addr('rp-rd-h');
  const AO = addr('rp-rd-o');
  const AC = addr('rp-rd-c');
  const AX = addr('rp-rd-x');
  const idS = idOf('rp:rd:s');
  const idH = idOf('rp:rd:h');
  const [o1, o2, g, onlyS] = [idOf('rp:rd:o1'), idOf('rp:rd:o2'), idOf('rp:rd:g'), idOf('rp:rd:onlys')];
  hasLetters(idS, 'idS');
  const maps = mapsWith({
    S: [[idS, AS, 1], [onlyS, AX, 1], [o1, AO, 1]],
    L: [[AS, idS], [AH, idH], [AO, o2, [o1]], [AC, null, [g]]],
  });
  const k5 = (e, tag, createdAt) => makeDeletion({ author: ALICE, e, id: idOf(`rp:rd:k5:${tag}`), createdAt });
  const rows = [
    { name: 'the top at its address, also completed (in S)', ev: k5([idS], 's', 3000), address: AS, target: idS },
    { name: 'the top at its address, learned but not yet completed', ev: k5([idH], 'h', 3100), address: AH, target: idH },
    { name: 'an upper-case e naming a top', ev: k5([idS.toUpperCase()], 'up', 3200), address: AS, target: idS },
    { name: 'the top that replaced an older version', ev: k5([o2], 'o2', 3250), address: AO, target: o2 },
  ];
  cases(rows, ({ ev, address, target }) => {
    const r = resolved(resolveDeletion(ev, maps, new Set()), 'resolveDeletion');
    eq(r.prompts.length, 1, 'prompts');
    eq(r.prompts[0].address, address, 'the prompt\'s address');
    same(r.prompts[0].prompt, { type: 'revoke', kind5Id: ev.id, created_at: ev.created_at, by: 'e', target }, 'the revoke prompt');
    same([r.matchedNothing, r.foreign], [false, 0], '[matchedNothing, foreign]');
  });
  cases([
    { name: 'an id S alone records (the path learned no lineage there)', ev: k5([onlyS], 'onlys', 3300) },
    { name: 'an id in older (a later version replaced it: strfry acted on nothing), though S records it', ev: k5([o1], 'o1', 3400) },
    { name: 'a census id (older under no top)', ev: k5([g], 'g', 3500) },
  ], ({ ev }) => same(resolveDeletion(ev, maps, new Set()), { prompts: [], matchedNothing: true, foreign: 0 }, 'resolveDeletion'));
});

test('RP15: a deletion\'s a target resolves only at an address the path knows — one a lineage holds (a census lineage with no top included), one S records an id at, or one the graph\'s keys hold — to a by-a revoke prompt; a kind-5 whose a targets hold nothing queues nothing and matches nothing (T6 as amended by A1-3 and A1-17: "An a target resolves through a lineage, S or graphAddresses"; A1-8; planner list "A kind-5 whose a targets hold nothing queues nothing")', () => {
  const resolveDeletion = fn('resolveDeletion');
  const AS = addr('rp-rd-as');
  const AH = addr('rp-rd-ah');
  const AC = addr('rp-rd-ac');
  const AG = addr('rp-rd-ag');
  const AU = addr('rp-rd-au');
  const maps = mapsWith({ S: [[idOf('rp:rd:as'), AS, 1]], L: [[AH, idOf('rp:rd:ah')], [AC, null, [idOf('rp:rd:ac:g')]]] });
  const graph = new Set([AG]);
  const k = makeDeletion({ author: ALICE, a: [AS, AH, AC, AG, AU], id: idOf('rp:rd:k5:a'), createdAt: 4000 });
  const r = resolved(resolveDeletion(k, maps, graph), 'resolveDeletion (known and unknown addresses)');
  sameSet(r.prompts.map((x) => x.address), [AS, AH, AC, AG], 'addresses prompted (the unknown one queues nothing)');
  for (const x of r.prompts) {
    same(x.prompt, { type: 'revoke', kind5Id: k.id, created_at: 4000, by: 'a', target: x.address }, `the revoke prompt at ${x.address}`);
  }
  same([r.matchedNothing, r.foreign], [false, 0], '[matchedNothing, foreign]');
  const junk = makeDeletion({ author: ALICE, a: [AU, addr('rp-rd-junk')], id: idOf('rp:rd:k5:junk'), createdAt: 4100 });
  const r2 = resolved(resolveDeletion(junk, maps, graph), 'resolveDeletion (only unknown addresses)');
  same([r2.prompts, r2.matchedNothing, r2.foreign], [[], true, 0], '[prompts, matchedNothing, foreign] for a kind-5 naming only unknown addresses');
});

test('RP16: an a target counts only up to 255 UTF-8 bytes — an address of exactly 255 bytes resolves, one of 256 (still a tagging address) is ignored even when the path and the graph know it — while that version\'s e target, the top at its address, still resolves (T6 as amended by A1-3: "An a target resolves at a tagging address of at most 255 UTF-8 bytes"; ADR 0003 facts: strfry acts on no longer tag value; planner list "An a target over 255 bytes")', () => {
  const resolveDeletion = fn('resolveDeletion');
  const A255 = addr('b'.repeat(184));
  const A256 = addr('b'.repeat(185));
  eq(Buffer.byteLength(A255, 'utf8'), 255, 'fixture: the 255-byte address');
  eq(Buffer.byteLength(A256, 'utf8'), 256, 'fixture: the 256-byte address');
  const [i255, i256] = [idOf('rp:rd:255'), idOf('rp:rd:256')];
  const maps = mapsWith({ S: [[i255, A255, 1], [i256, A256, 1]], L: [[A255, i255], [A256, i256]] });
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

test('RP19: another author\'s kind-5 prompts nothing — each of its targets that resolves to a known tagging of someone else adds 1 to foreign, an e target only as its address\'s top — and a target that does not resolve costs nothing, not even a foreign count: one the path does not know, an older id, or an id S alone records (T6 as amended by A1-3: "The author check, the foreign count and de-duplication are unchanged", counted over targets that resolve; ADR 0003 D5-A, owner decision 3; AC-2 "a kind-5 from another author" removes nothing)', () => {
  const resolveDeletion = fn('resolveDeletion');
  const A = addr('rp-rd-f');
  const AG = addr('rp-rd-fg');
  const AX = addr('rp-rd-fx');
  const [idA, idOld, onlyS] = [idOf('rp:rd:f'), idOf('rp:rd:f:old'), idOf('rp:rd:f:onlys')];
  const maps = mapsWith({ S: [[idA, A, 1], [idOld, A, 1], [onlyS, AX, 1]], L: [[A, idA, [idOld]]] });
  const graph = new Set([AG]);
  const k = makeDeletion({ author: BOB, e: [idA], a: [A, AG], id: idOf('rp:rd:k5:f'), createdAt: 7000 });
  const r = resolved(resolveDeletion(k, maps, graph), 'resolveDeletion (Bob naming Alice\'s top id and her known addresses)');
  same([r.prompts, r.foreign, r.matchedNothing], [[], 3, false], '[prompts, foreign, matchedNothing]');
  const unknown = makeDeletion({ author: BOB, e: [idOf('rp:rd:f:unknown')], a: [addr('rp-rd-f-unknown')], id: idOf('rp:rd:k5:f2'), createdAt: 7100 });
  const r2 = resolved(resolveDeletion(unknown, maps, graph), 'resolveDeletion (Bob naming what the path does not know)');
  same([r2.prompts, r2.foreign, r2.matchedNothing], [[], 0, true], '[prompts, foreign, matchedNothing]');
  const stale = makeDeletion({ author: BOB, e: [idOld, onlyS], id: idOf('rp:rd:k5:f3'), createdAt: 7200 });
  const r3 = resolved(resolveDeletion(stale, maps, graph), 'resolveDeletion (Bob naming Alice\'s older id and an id S alone records)');
  same([r3.prompts, r3.foreign, r3.matchedNothing], [[], 0, true], '[prompts, foreign, matchedNothing]: e targets that are no top resolve nothing, so they are not counted foreign either');
});

test('RP20: prompts are de-duplicated by (address, by, target) — the top named in both cases, an address named in both pubkey spellings — while an e and an a at one address stay separate prompts; an older id named beside them resolves nothing (T6 as amended by A1-3: the de-duplication unchanged, an e target only as its address\'s top)', () => {
  const resolveDeletion = fn('resolveDeletion');
  hasLetters(DAVE, 'DAVE');
  const A = addr('rp-rd-dd', DAVE);
  const [i1, i2] = [idOf('rp:rd:dd:1'), idOf('rp:rd:dd:2')];
  hasLetters(i2, 'i2');
  const maps = mapsWith({ S: [[i1, A, 1]], L: [[A, i2, [i1]]] });
  const k = makeDeletion({
    author: DAVE,
    e: [i2, i2.toUpperCase(), i1],
    a: [A, `39999:${DAVE.toUpperCase()}:rp-rd-dd`],
    id: idOf('rp:rd:k5:dd'),
    createdAt: 8000,
  });
  const r = resolved(resolveDeletion(k, maps, new Set([A])), 'resolveDeletion');
  sameSet(r.prompts.map(promptKey), [`${A}|e|${i2}`, `${A}|a|${A}`], 'prompts (address|by|target): i1 is older than the top i2 there, so it resolves nothing');
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

test('RP22: one kind-5 naming its author\'s top id, an id nobody recorded and another author\'s top id gives one prompt, foreign 1 and matchedNothing false (T6 as amended by A1-3: matchedNothing is prompts.length === 0 && foreign === 0)', () => {
  const resolveDeletion = fn('resolveDeletion');
  const AA = addr('rp-rd-mix');
  const AC = addr('rp-rd-mix', CAROL);
  const [ia, ic] = [idOf('rp:rd:mix:a'), idOf('rp:rd:mix:c')];
  const maps = mapsWith({ S: [[ia, AA, 1], [ic, AC, 1]], L: [[AA, ia], [AC, ic]] });
  const k = makeDeletion({ author: ALICE, e: [ia, idOf('rp:rd:mix:none'), ic], id: idOf('rp:rd:k5:mix'), createdAt: 9100 });
  const r = resolved(resolveDeletion(k, maps, new Set()), 'resolveDeletion');
  same(r.prompts.map(promptKey), [`${AA}|e|${ia}`], 'prompts');
  same([r.foreign, r.matchedNothing], [1, false], '[foreign, matchedNothing]');
});

// ═══ T7: a read's shrink ═══════════════════════════════════════════════════════════════════════════════════════
test('RP23: shrinkOnRead drops, from S and R (refusedSeen), the ids recorded at the address at or before the capture, other than the id the read returned, and drops them from B; ids recorded after the capture, the returned id and other addresses stay; and it never shrinks the lineage — its top and older stay, ids the read dropped from S included (T7 as amended by A1-17: "S, R and B only"; A1-1: S, B and R "keep their read shrink (T7)"; A1-2: "Nothing else changes a lineage"; planner list "refusedSeen shrinking")', () => {
  const shrinkOnRead = fn('shrinkOnRead');
  const A = addr('rp-sh');
  const OTHER = addr('rp-sh-other');
  const id = (n) => idOf(`rp:sh:${n}`);
  const maps = mapsWith({
    S: [[id('s-old'), A, 1], [id('s-ret'), A, 5], [id('s-other'), OTHER, 1], [id('s-after'), A, 10]],
    R: [[id('r-at'), A, 3], [id('r-other'), OTHER, 3]],
    B: [id('s-old'), id('s-other')],
    L: [[A, id('l-top'), [id('s-old'), id('s-ret')]]],
  });
  same(lin(maps, A), L(id('l-top'), [id('s-old'), id('s-ret')]), 'fixture: the lineage at A');
  const r = shrinkOnRead(maps, A, id('s-ret'), 5);
  assert(r && Array.isArray(r.dropped), `shrinkOnRead must return { dropped: [ids] } (T7), got ${show(r)}`);
  sameSet(uniq(r.dropped), [id('s-old'), id('r-at')], 'dropped');
  sameSet([...maps.S.keys()], [id('s-ret'), id('s-other'), id('s-after')], 'S after the read (the returned id, an id recorded after the capture and the other address stay)');
  sameSet([...maps.R.keys()], [id('r-other')], 'R after the read');
  sameSet([...maps.B], [id('s-other')], 'B after the read (B only ever shrinks)');
  same(lin(maps, A), L(id('l-top'), [id('s-old'), id('s-ret')]), 'the lineage at A after the read: unchanged (a read never shrinks a lineage)');
});

test('RP24: an empty read (returnedId null) drops the S, R and B ids recorded at the address up to the capture — an entry recorded at the capture itself included, one recorded after it kept — and changes nothing in the lineage, so a late deletion of the top still resolves after it (T7 as amended by A1-17: seq <= captureSeq, "S, R and B only"; A1-2: "An empty read changes nothing"; the A1 kick-back\'s "Lost revokes": an empty read\'s shrink dropped the ids a late revoke needs)', () => {
  const { shrinkOnRead, resolveDeletion } = need('shrinkOnRead', 'resolveDeletion');
  const A = addr('rp-sh-empty');
  const id = (n) => idOf(`rp:sh:e:${n}`);
  const maps = mapsWith({ S: [[id('at'), A, 5], [id('after'), A, 6]], R: [[id('r'), A, 3]], B: [id('at'), id('after')], L: [[A, id('top'), [id('at')]]] });
  const r = shrinkOnRead(maps, A, null, 5);
  assert(r && Array.isArray(r.dropped), `shrinkOnRead must return { dropped: [ids] } (T7), got ${show(r)}`);
  sameSet(uniq(r.dropped), [id('at'), id('r')], 'dropped');
  sameSet([...maps.S.keys()], [id('after')], 'S');
  eq(maps.R.size, 0, 'R size');
  sameSet([...maps.B], [id('after')], 'B');
  same(lin(maps, A), L(id('top'), [id('at')]), 'the lineage at A: unchanged by the empty read');
  const late = makeDeletion({ author: ALICE, e: [id('top')], id: idOf('rp:sh:e:k5'), createdAt: 3000 });
  same(resolved(resolveDeletion(late, maps, new Set()), 'resolveDeletion').prompts.map(promptKey), [`${A}|e|${id('top')}`],
    'a deletion of the top drained after the empty read still resolves at A');
});

// ═══ T8: compaction ════════════════════════════════════════════════════════════════════════════════════════════
test('RP25: compact(maps, scannedIds, captureSeq) keeps every S and R entry recorded after the scan began; otherwise S and R keep only scanned ids, and B becomes B ∩ scanned — scannedIds given as a plain Set — and it leaves the lineage to pruneLineage (T8 as amended by A1-17: "compact(maps, scannedIds, captureSeq)"; A1-7: "S, R and B shrink as in T8, without H"; T25 container types; ADR 0003 § The catch-up step 6)', () => {
  const compact = fn('compact');
  const A = addr('rp-cp');
  const id = (n) => idOf(`rp:cp:${n}`);
  const maps = mapsWith({
    S: [[id('s-scanned'), A, 1], [id('s-gone'), A, 1], [id('s-late'), A, 9], [id('b-scanned'), A, 0], [id('b-gone'), A, 0]],
    R: [[id('r-scanned'), A, 3], [id('r-gone'), A, 3], [id('r-late'), A, 8]],
    B: [id('b-scanned'), id('b-gone')],
    L: [[A, id('l-gone'), [id('s-gone')]]],
  });
  const scanned = new Set([id('s-scanned'), id('b-scanned'), id('r-scanned')]);
  compact(maps, scanned, 5);
  sameSet([...maps.S.keys()], [id('s-scanned'), id('s-late'), id('b-scanned')], 'S: scanned ids, plus what was recorded after the scan began');
  sameSet([...maps.R.keys()], [id('r-scanned'), id('r-late')], 'R: scanned ids, plus what was recorded after the scan began');
  sameSet([...maps.B], [id('b-scanned')], 'B: B ∩ scanned');
  same(lin(maps, A), L(id('l-gone'), [id('s-gone')]), 'the lineage: compact leaves it (pruneLineage prunes it, A1-7)');
});

// ═══ T9: arrivals and look-only prompts ════════════════════════════════════════════════════════════════════════
test('RP26: an arrival is a scanned id not in S — one never learned (back-dated history arrives the same way) and one learned (its address\'s top) but not yet completed alike — while an id S records is no arrival (T9; A1-1: S keeps its role for arrivals; ADR 0003 § The catch-up step 2; AC-4)', () => {
  const arrivalsAndLookOnly = fn('arrivalsAndLookOnly');
  const [A1, A2, A3] = [addr('rp-ar-1'), addr('rp-ar-2'), addr('rp-ar-3')];
  const [n1, h1, s1] = [idOf('rp:ar:n1'), idOf('rp:ar:h1'), idOf('rp:ar:s1')];
  const maps = mapsWith({ S: [[s1, A3, 1]], L: [[A2, h1], [A3, s1]] });
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
test('RP30: deletion candidates are the graph\'s event ids the scan no longer finds, plus each lineage top the scan no longer finds at an address the graph holds with another id — never an older id, nor an id S alone records — de-duplicated, tagging addresses only; scanned ids and tops at addresses the graph does not hold are none — scannedIds given as a plain Set (T10 as amended by A1-17: "Rule 2 uses lineage tops"; A1-9: "each lineage top the scan no longer finds, at an address the graph holds with another event id. No other id could pass the gate"; T25 container types)', () => {
  const deletionCandidates = fn('deletionCandidates');
  const a = (n) => addr(`rp-dc-${n}`);
  const id = (n) => idOf(`rp:dc:${n}`);
  const graph = new Map([
    [a('g1'), id('g1')], // scanned: nothing
    [a('g2'), id('g2')], // not scanned: candidate
    [a('g3'), id('g3')], // scanned; S records s3 there, not scanned, but no lineage top: nothing
    [a('g4'), id('g4')], // scanned; the lineage top h4 there, not scanned: h4 is a candidate
    [a('g5'), id('s5')], // not scanned, and the top is the same id: one candidate
    [a('g7'), id('g7')], // scanned; the top s7 there, scanned: nothing
    [a('g8'), id('g8')], // scanned; the top sh and older o8 there, neither scanned: sh only
    [`39998:${ALICE}:rp-dc-nt`, id('nt')], // not a tagging address: excluded
    ['not-an-address', id('junk')], // excluded
    [null, id('null')], // a relationship with no address: excluded
  ]);
  const maps = mapsWith({
    S: [[id('s3'), a('g3'), 1], [id('s5'), a('g5'), 1], [id('s6'), a('g6'), 1], [id('s7'), a('g7'), 1], [id('o8'), a('g8'), 1]],
    L: [[a('g4'), id('h4')], [a('g5'), id('s5')], [a('g6'), id('s6')], [a('g7'), id('s7')], [a('g8'), id('sh'), [id('o8')]]],
  });
  const scanned = new Set([id('g1'), id('g3'), id('g4'), id('g7'), id('s7'), id('g8')]);
  const out = deletionCandidates(graph, scanned, maps);
  assert(Array.isArray(out), `deletionCandidates must return [{ address, id }] (T10), got ${show(out)}`);
  sameSet(out.map(pairKey), [`${a('g2')}|${id('g2')}`, `${a('g4')}|${id('h4')}`, `${a('g5')}|${id('s5')}`, `${a('g8')}|${id('sh')}`],
    'candidates, each once (s3: S alone records it; o8: older, in S too; s6: the graph does not hold g6; nt, junk and null: not tagging addresses)');
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

// RP47 deleted (A1-5: "Nothing discards a revoke prompt for being stale"): discardSupersededRevokes is gone (RP2); a
// stale by-e revoke is inert at the gate instead (RP71, RP91).

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
test('RP53: a pass overlaps a round when it started before the round committed and it ended at or after the graph read, is still alive, or is dead with endedAt null and first seen dead at or after the graph read; a dead run with no deadSeenAt does not; the commit boundary is strict and the graph-read ties overlap — a pass that ended exactly at the graph read, or was first seen dead exactly then, overlaps, while one that started exactly at the commit does not — and deadSeenAt is a plain object (T17; A1 clarification 13: endedAt >= graphReadAt and graphReadAt <= deadSeenAt, startedAt < commitAt stays strict, amending T25 "passOverlaps boundaries are strict"; T25 container types; ADR 0003 § Coexisting with the pass; AC-5)', () => {
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
    // A1 clarification 13: startedAt < commitAt stays strict; the graph-read ties overlap — endedAt >= graphReadAt and
    // graphReadAt <= deadSeenAt (a pass that wrote and ended inside the millisecond of the round's graph read may have
    // written after it; a spurious re-look costs one read).
    { name: 'ended exactly at the graph read (a tie overlaps)', run: runEntry(RUN, T0 - 60000, T0), alive: false, seen: {}, want: [RUN] },
    { name: 'ended 1 ms before the graph read', run: runEntry(RUN, T0 - 60000, T0 - 1), alive: false, seen: {}, want: [] },
    { name: 'ended 1 ms after the graph read', run: runEntry(RUN, T0 - 60000, T0 + 1), alive: false, seen: {}, want: [RUN] },
    { name: 'started exactly at the commit, alive', run: runEntry(RUN, T0 + 500, null), alive: true, seen: {}, want: [] },
    { name: 'started exactly at the commit, ended later', run: runEntry(RUN, T0 + 500, T0 + 900), alive: false, seen: {}, want: [] },
    { name: 'started 1 ms before the commit, alive', run: runEntry(RUN, T0 + 499, null), alive: true, seen: {}, want: [RUN] },
    { name: 'dead with endedAt null, first seen dead exactly at the graph read (a tie overlaps)', run: runEntry(RUN, T0 - 60000, null), alive: false, seen: { [RUN]: T0 }, want: [RUN] },
    { name: 'dead with endedAt null, first seen dead 1 ms before the graph read', run: runEntry(RUN, T0 - 60000, null), alive: false, seen: { [RUN]: T0 - 1 }, want: [] },
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
test('RP58: journalLine writes each of the twelve line types as one compact JSON line ending in its only newline, which parses back to the object — a newline or carriage return inside an address included (T19 as amended by A1-6: v absolute, o and e added; ADR 0003 § Journal rules)', () => {
  const journalLine = fn('journalLine');
  const id = idOf('rp:jl');
  const A = addr('rp-jl');
  const rows = [
    { name: 'v', o: J.v(id, A, id, [idOf('rp:jl:older')]) },
    { name: 'v, a d with a newline and a carriage return', o: J.v(id, addr('rp\njl\rx'), id, []) },
    { name: 'o', o: J.o(A, id, [idOf('rp:jl:older')]) },
    { name: 'o, a census row (null top)', o: J.o(A, null, [id]) },
    { name: 'e', o: J.e(3) },
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

test('RP59: replayJournal from no record applies an absolute v (its address\'s lineage set to the line\'s top and older, and a version prompt), an o (the lineage as written, no prompt), d (a revoke prompt), f (into refusedSeen), p (parked), k (a dead pass seen) and r (a re-look) (T19 as amended by A1-6 and A1-17: "v {id, a, top, older} and o {a, top, older} are absolute"; ADR 0003 § Knowing what changed while it was away)', () => {
  const replayJournal = fn('replayJournal');
  const [i1, i2, i3, i4, i5] = [idOf('rp:rj:1'), idOf('rp:rj:2'), idOf('rp:rj:3'), idOf('rp:rj:4'), idOf('rp:rj:5')];
  const [A, B2, C, D, E] = [addr('rp-rj-a'), addr('rp-rj-b'), addr('rp-rj-c'), addr('rp-rj-d'), addr('rp-rj-e')];
  const rv = revoke('e', i1, 2500);
  const relookEntry = entryOf({ version: i3, revokes: [revoke('a', D, 2600)] });
  const out = replayed(replayJournal(texts([
    J.v(i1, A, i1, []), J.d(A, rv), J.f(i2, B2), J.p(C, 'ENOSPC'), J.k(RUN, 5555), J.r(D, RUN, relookEntry), J.o(E, i5, [i4]),
  ]), null), 'replayJournal');
  same(lin(out.maps, A), L(i1), 'v: the lineage at its address as the line gives it (the heard id its top)');
  eq(out.maps.S.has(i1), false, 'v: a heard id is not in S (only a c line completes it)');
  same(lin(out.maps, E), L(i5, [i4]), 'o: the lineage as the line gives it');
  eq(out.pending.has(E), false, 'o: no prompt (it records a read\'s or a scan\'s learning only)');
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

test('RP60: an x line drops exactly the ids it lists from S, refusedSeen and B, and leaves the lineage — ids it lists stay in older, and an unlisted S id and a later v survive (T19 as amended by A1-6 and A1-17: "x drops the ids it lists from S, R and B only"; ADR 0003 "journaled explicitly … so a replay never drops a later v")', () => {
  const replayJournal = fn('replayJournal');
  const A = addr('rp-rj-x');
  const id = (n) => idOf(`rp:rjx:${n}`);
  const record = { version: 1, epoch: 4, seen: [[id('s1'), A], [id('s2'), A]], lineage: [[A, id('h1'), [id('s1')]]], baseline: [id('s1')], refusedSeen: [[id('r1'), A]], pending: [], rechecks: [], deadSeenAt: {}, parked: [] };
  const lines = [J.e(4), J.v(id('h2'), A, id('h2'), [id('s1'), id('h1')]), J.x(A, [id('s1'), id('r1'), id('h1')])];
  const out = replayed(replayJournal(texts(lines), record), 'replayJournal (… x last)');
  same([out.maps.S.has(id('s1')), out.maps.B.has(id('s1')), out.maps.R.has(id('r1'))], [false, false, false], 'the listed ids are gone from S, B and refusedSeen');
  eq(out.maps.S.has(id('s2')), true, 'an unlisted S id stays');
  same(lin(out.maps, A), L(id('h2'), [id('s1'), id('h1')]), 'the lineage after the x line: as the v line before it set it — the ids x listed still in older (x never shrinks a lineage)');
  const later = replayed(replayJournal(texts([...lines, J.v(id('h3'), A, id('h3'), [id('s1'), id('h1'), id('h2')])]), record), 'replayJournal (… x, then v)');
  same(lin(later.maps, A), L(id('h3'), [id('s1'), id('h1'), id('h2')]), 'a v line after the x line applies');
});

test('RP61: a c line records the id in S and clears the entry\'s version only when it is that id — keeping every revoke, a by-e revoke naming a version since replaced included, and the lineage as it was — deleting the pending entry when that leaves no version, no revokes and no look; a b line drops the id from B only (T19 as amended by A1-17: "c keeps revokes"; A1-5: "Replaying c answers only the version prompt it names; an entry left with no version, no revokes and no look is deleted"; T25)', () => {
  const replayJournal = fn('replayJournal');
  const A = addr('rp-rj-c');
  const id = (n) => idOf(`rp:rjc:${n}`);
  const one = replayed(replayJournal(texts([J.v(id('1'), A, id('1'), []), J.c(id('1'), A)]), null), 'replay v, c');
  eq(one.maps.S.get(id('1')) && one.maps.S.get(id('1')).a, A, 'c: S records the id at its address');
  same(lin(one.maps, A), L(id('1')), 'c: the lineage keeps its top (completing teaches the lineage nothing)');
  assert(!one.pending.has(A), `c: the emptied entry is deleted from pending, got ${show(one.pending.get(A))}`);
  eq(one.pending.size, 0, 'c: pending holds nothing');
  const rv = revoke('a', A, 2800);
  const kept = replayed(replayJournal(texts([J.v(id('1'), A, id('1'), []), J.d(A, rv), J.c(id('1'), A)]), null), 'replay v, d, c');
  same(entryFields(kept.pending.get(A)), entryOf({ revokes: [rv] }), 'c: an entry left with a revoke stays pending, its version null');
  const rvOld = revoke('e', id('0'), 2700);
  const stale = replayed(replayJournal(texts([
    J.v(id('0'), A, id('0'), []), J.d(A, rvOld), J.v(id('1'), A, id('1'), [id('0')]), J.c(id('1'), A),
  ]), null), 'replay v, d (by e), v, c');
  same(entryFields(stale.pending.get(A)), entryOf({ revokes: [rvOld] }), 'c: a by-e revoke naming a version since replaced is kept too (A1-5: the gate judges it, RP91)');
  const two = replayed(replayJournal(texts([J.v(id('1'), A, id('1'), []), J.v(id('2'), A, id('2'), [id('1')]), J.c(id('1'), A)]), null), 'replay v, v, c');
  const e2 = two.pending.get(A);
  same(e2 && e2.version, { id: id('2') }, 'c of an older id keeps the newer version prompt');
  same(lin(two.maps, A), L(id('2'), [id('1')]), 'the lineage: the newer heard id is the top');
  const record = { version: 1, epoch: 2, seen: [[id('b1'), A], [id('b2'), A]], lineage: [[A, id('h')]], baseline: [id('b1'), id('b2')], refusedSeen: [], pending: [], rechecks: [], deadSeenAt: {}, parked: [] };
  const three = replayed(replayJournal(texts([J.e(2), J.b(id('b1')), J.c(id('h'), A)]), record), 'replay b, c over a record');
  sameSet([...three.maps.B], [id('b2')], 'b: B drops the id');
  eq(three.maps.S.has(id('b1')), true, 'b: S keeps the id');
  same([three.maps.S.has(id('h')), lin(three.maps, A)], [true, L(id('h'))], 'c of a restored top: into S, the lineage unchanged');
});

test('RP62: a torn, garbled, non-object or unknown-type line is skipped and counted, and the lines after it still apply; an empty line is ignored, not counted; lines may come from any iterable (T19; T25 "Empty lines are ignored, not counted"; ADR 0003 § Journal rules "A line that fails to parse is skipped and counted"; A1-6: the v lines absolute)', () => {
  const replayJournal = fn('replayJournal');
  const [A, B2] = [addr('rp-rj-g1'), addr('rp-rj-g2')];
  const [i1, i2] = [idOf('rp:rjg:1'), idOf('rp:rjg:2')];
  const bad = [JSON.stringify(J.v(i2, B2, i2, [])).slice(0, 20), 'garbage', 'null', '[1,2]', '{"t":"zz","a":"x"}', `{"id":"${i2}"}`];
  function* lines() {
    yield '';
    yield JSON.stringify(J.v(i1, A, i1, []));
    yield '';
    yield* bad;
    yield '';
    yield '';
    yield JSON.stringify(J.v(i2, B2, i2, []));
    yield '';
  }
  const out = replayed(replayJournal(lines(), null), 'replayJournal');
  eq(out.skippedLines, bad.length, `skippedLines (the ${bad.length} bad lines; the 5 empty lines are not counted)`);
  same([lin(out.maps, A), lin(out.maps, B2)], [L(i1), L(i2)], 'the lineages (the lines before and after the bad ones applied)');
  const empties = replayed(replayJournal(['', '', ''], null), 'replayJournal (only empty lines)');
  same([empties.skippedLines, empties.maps.L.size, empties.pending.size], [0, 0, 0], '[skippedLines, L size, pending size] for only empty lines');
});

test('RP63: replayJournal restores the record\'s seen and refusedSeen with seq 0, its lineage rows — [a, top] with older omitted when empty, [a, top, [older…]], and a census row with a null top — its baseline and deadSeenAt, and the top index with them, and applies its generation\'s lines on top (T19 as amended by A1-6 and A1-17: "the record has one lineage row per lineage", lineage: [[address, top | null, [older…]]] "The third element is omitted when empty"; A1-1 "an index maps each top id to its address"; T3 "Entries restored from record.json get seq 0")', () => {
  const { replayJournal, resolveDeletion } = need('replayJournal', 'resolveDeletion');
  const [A, B2, C] = [addr('rp-rj-r1'), addr('rp-rj-r2'), addr('rp-rj-r3')];
  const id = (n) => idOf(`rp:rjr:${n}`);
  const record = {
    version: 1, epoch: 7, firstStartedAt: iso(T0 - 86400000), identities: { canonical: CANONICAL, local: LOCAL }, compactedAt: iso(T0 - 3600000),
    seen: [[id('s1'), A], [id('s2'), B2]], lineage: [[A, id('h1'), [id('s1')]], [B2, id('s2')], [C, null, [id('g')]]], baseline: [id('s1')], refusedSeen: [[id('r1'), B2]],
    pending: [], rechecks: [], deadSeenAt: { [RUN]: 7777 }, parked: [],
  };
  const out = replayed(replayJournal([], record), 'replayJournal (record only)');
  same(out.maps.S.get(id('s1')), { a: A, seq: 0 }, 'S from seen');
  same(out.maps.S.get(id('s2')), { a: B2, seq: 0 }, 'S from seen');
  same(out.maps.R.get(id('r1')), { a: B2, seq: 0 }, 'refusedSeen');
  same(lin(out.maps, A), L(id('h1'), [id('s1')]), 'the lineage from its row with older');
  same(lin(out.maps, B2), L(id('s2')), 'the lineage from its row without older');
  same(lin(out.maps, C), L(null, [id('g')]), 'a census row: older under no top');
  sameSet([...out.maps.B], [id('s1')], 'B from baseline');
  same(out.deadSeenAt, { [RUN]: 7777 }, 'deadSeenAt, a plain object (T25)');
  eq(out.skippedLines, 0, 'skippedLines');
  const eAt = (target, tag) => resolved(resolveDeletion(makeDeletion({ author: ALICE, e: [target], id: idOf(`rp:rjr:k5:${tag}`), createdAt: 9000 }), out.maps, new Set()), `resolveDeletion (${tag})`).prompts.map(promptKey);
  same([eAt(id('h1'), 'h1'), eAt(id('s2'), 's2'), eAt(id('s1'), 's1'), eAt(id('g'), 'g')], [[`${A}|e|${id('h1')}`], [`${B2}|e|${id('s2')}`], [], []],
    'the restored tops resolve at their addresses, and nothing else does (the top index comes back with the rows)');
  const on = replayed(replayJournal(texts([J.e(7), J.c(id('h1'), A), J.v(id('h2'), B2, id('h2'), [id('s2')])]), record), 'replayJournal (record and lines)');
  same([on.maps.S.has(id('h1')), lin(on.maps, A), lin(on.maps, B2)], [true, L(id('h1'), [id('s1')]), L(id('h2'), [id('s2')])], 'lines applied on top of the record');
});

test('RP64: re-looks are one per (address, runId), their entries merged by mergePrompt\'s rules — the latest version, per (by, target) the revoke with the greatest created_at and its own kind5Id, look ORed — and an rc line ends one (T19; T25 "Two r lines for one (a, runId) merge by mergePrompt rules"; T15; ADR 0003 "Re-looks are de-duplicated by (address, runId), merging their prompts"; the replayed maps as A1-17 amends T3)', () => {
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
test('RP67: a version and its id-only revoke heard in one round — the revoke resolves as A\'s top, and the round\'s empty read removes the relationship recording the version the path learned there before it (clause ii); had the path never learned that version there, the removal waits for the pass (ADR 0003 planner list; AC-2; A1-2, A1-3, A1-4 clause (ii), owner decision 11 accepted; A1-16 decision 2; T5, T6, T15, T16)', () => {
  const { promptFromVersion, learnVersion, lineageValue, mergePrompt, resolveDeletion, relayAtAddress, gateAction } = need('promptFromVersion', 'learnVersion', 'lineageValue', 'mergePrompt', 'resolveDeletion', 'relayAtAddress', 'gateAction');
  const { decideAddress } = sweep();
  const A = addr('rp-sc-one');
  const v0 = makeTagging({ d: 'rp-sc-one', id: idOf('rp:sc:one:v0'), createdAt: 1000 });
  const v1 = makeTagging({ d: 'rp-sc-one', id: idOf('rp:sc:one:v1'), createdAt: 2000, polarity: '-1' });
  const maps = mapsWith({ S: [[v0.id, A, 1]], L: [[A, v0.id]] }); // the graph holds v0, a version the path learned at A
  const p = promptFromVersion(v1, IDENTITIES);
  same(p, { address: A, id: v1.id }, 'v1 heard: its version prompt');
  learnVersion(maps, p.address, p.id, PLACED);
  same(lin(maps, A), L(v1.id, [v0.id]), 'v1 delivered: the top, v0 older');
  let entry = mergePrompt(null, { type: 'version', id: p.id });
  const k5 = makeDeletion({ author: ALICE, e: [v1.id], id: idOf('rp:sc:one:k5'), createdAt: 2001 });
  const r = resolved(resolveDeletion(k5, maps, new Set([A])), 'resolveDeletion');
  same(r.prompts.map(promptKey), [`${A}|e|${v1.id}`], 'the revoke resolves at A (v1 is the top)');
  entry = mergePrompt(entry, r.prompts[0].prompt);
  const row = storedRowFor(v0);
  const d = decideAddress(row, relayAtAddress([], [], A, IDENTITIES));
  same([d.action, d.reason], ['remove', 'not-on-relay'], 'the round reads nothing at A');
  gateIs(gateAction(d, { address: A, storedRow: row, relayVersionId: null, entry, baseline: maps.B, lineage: lineageValue(maps, A) }), { act: true }, 'the removal (clause ii: v1 the top, v0 in its older)');
  const unseen = mapsWith({ L: [[A, v1.id]] }); // the path never learned v0 at A (another writer recorded it)
  gateIs(gateAction(d, { address: A, storedRow: row, relayVersionId: null, entry, baseline: unseen.B, lineage: lineageValue(unseen, A) }), { act: false, held: 'removal-not-prompted' },
    'control: a relationship recording a version the path never learned at A waits for the pass (decision 2)');
});

test('RP68: a version heard after a round\'s scan spawned, then revoked by id — the read, placed under that later learning, teaches nothing, and its shrink leaves the lineage, so v1 stays the top; the revoke resolves and removes (clause ii); had the read been placed, v0 would be the top again and the revoke would resolve nothing (ADR 0003 planner list; A1-2: "If the path learned anything at A after that capture, the read teaches nothing at A"; A1-3; A1-4; T7, T6, T16)', () => {
  const { learnVersion, lineageValue, shrinkOnRead, resolveDeletion, mergePrompt, gateAction } = need('learnVersion', 'lineageValue', 'shrinkOnRead', 'resolveDeletion', 'mergePrompt', 'gateAction');
  const { decideAddress } = sweep();
  const A = addr('rp-sc-late');
  const v0 = makeTagging({ d: 'rp-sc-late', id: idOf('rp:sc:late:v0'), createdAt: 1000 });
  const v1 = makeTagging({ d: 'rp-sc-late', id: idOf('rp:sc:late:v1'), createdAt: 2000 });
  const maps = mapsWith({ S: [[v0.id, A, 1]], L: [[A, v0.id]] });
  const captureSeq = 5; // captured just before the scan at A spawned
  learnVersion(maps, A, v1.id, PLACED); // v1 delivered after that
  // The scan's snapshot still held v0; v1 was learned after its capture, so the read is placed under it.
  eq(learnVersion(maps, A, v0.id, UNDER), false, 'the read of v0, placed under v1\'s learning, teaches nothing');
  const s = shrinkOnRead(maps, A, v0.id, captureSeq);
  same(s && s.dropped, [], 'the read at A drops nothing');
  same(lin(maps, A), L(v1.id, [v0.id]), 'v1 stays the top, v0 in its older');
  const k5 = makeDeletion({ author: ALICE, e: [v1.id], id: idOf('rp:sc:late:k5'), createdAt: 2100 });
  const r = resolved(resolveDeletion(k5, maps, new Set([A])), 'resolveDeletion');
  same(r.prompts.map(promptKey), [`${A}|e|${v1.id}`], 'the revoke of v1 resolves at A');
  const entry = mergePrompt(mergePrompt(null, { type: 'version', id: v1.id }), r.prompts[0].prompt);
  const row = storedRowFor(v0);
  const d = decideAddress(row, null);
  gateIs(gateAction(d, { address: A, storedRow: row, relayVersionId: null, entry, baseline: maps.B, lineage: lineageValue(maps, A) }), { act: true }, 'the next round\'s removal (clause ii)');
  const placed = mapsWith({ S: [[v0.id, A, 1]], L: [[A, v0.id]] });
  learnVersion(placed, A, v1.id, PLACED);
  learnVersion(placed, A, v0.id, PLACED);
  same(resolveDeletion(k5, placed, new Set([A])), { prompts: [], matchedNothing: true, foreign: 0 }, 'control: had the read been placed, v0 would be the top again and v1\'s revoke would resolve nothing');
});

test('RP69: a re-sent older version after an id-only revoke is created after downtime — the read that returned the newer version dropped the older one from S and B, so it is an arrival and its create is not held (ADR 0003 planner list; AC-2, AC-4; T7, T9, T16; A1-1: S and B keep their read shrink)', () => {
  const { recordId, learnVersion, shrinkOnRead, arrivalsAndLookOnly, gateAction } = need('recordId', 'learnVersion', 'shrinkOnRead', 'arrivalsAndLookOnly', 'gateAction');
  const { decideAddress } = sweep();
  const A = addr('rp-sc-resent');
  const v1 = makeTagging({ d: 'rp-sc-resent', id: idOf('rp:sc:resent:v1'), createdAt: 1000 });
  const v2 = makeTagging({ d: 'rp-sc-resent', id: idOf('rp:sc:resent:v2'), createdAt: 2000, polarity: '-1' });
  const maps = mapsWith({ S: [[v1.id, A, 0]], B: [v1.id], L: [[A, v1.id]] }); // v1 held at the first start (the baseline scan placed it)
  learnVersion(maps, A, v2.id, PLACED); // v2 stored after it, and delivered
  const s = shrinkOnRead(maps, A, v2.id, 1);
  sameSet(uniq((s && s.dropped) || []), [v1.id], 'the read that returned v2 dropped v1');
  eq(maps.B.has(v1.id), false, 'B no longer holds v1');
  recordId(maps, 'S', v2.id, A, 2);
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

test('RP70: a version dropped over the backlog cap and then revoked by id is found by the catch-up — still learned as A\'s top, it is a deletion candidate (rule 2 names tops) in its author\'s #e scan, whose kind-5 the predicate keeps and resolveDeletion turns into a revoke that removes the relationship recording the version it replaced (clause ii) (ADR 0003 planner list; § The in-memory backlog; T10 as amended by A1-17 "Rule 2 uses lineage tops"; A1-9; A1-4; T11, T6, T16)', () => {
  const { deletionCandidates, deletionScanFilters, isExpectedDeletion, resolveDeletion, mergePrompt, gateAction, lineageValue } = need('deletionCandidates', 'deletionScanFilters', 'isExpectedDeletion', 'resolveDeletion', 'mergePrompt', 'gateAction', 'lineageValue');
  const { decideAddress } = sweep();
  const A = addr('rp-sc-cap');
  const v0 = makeTagging({ d: 'rp-sc-cap', id: idOf('rp:sc:cap:v0'), createdAt: 1000 });
  const v1 = makeTagging({ d: 'rp-sc-cap', id: idOf('rp:sc:cap:v1'), createdAt: 2000 });
  const maps = mapsWith({ S: [[v0.id, A, 1]], L: [[A, v1.id, [v0.id]]] }); // v1's prompt was dropped; the delivery was still learned
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
  gateIs(gateAction(decideAddress(row, null), { address: A, storedRow: row, relayVersionId: null, entry: mergePrompt(null, r.prompts[0].prompt), baseline: maps.B, lineage: lineageValue(maps, A) }), { act: true }, 'the removal (clause ii: v1 the top, v0 in its older)');
});

test('RP71: a by-id revoke, then a re-apply at the same address during an overlapping pass, then a wipe — the entry keeps the revoke (nothing is discarded), yet the re-look removes nothing: e:v1 names neither the version the pass recorded (v2) nor A\'s top (v2 again), so it satisfies neither clause; the author\'s revoke of v2 itself would remove (ADR 0003 planner list; § gateAction; A1-4 clauses (i) and (ii); A1-5 "A stale by-e prompt is inert under A1-3 and A1-4"; A1-20 "RP71: the control flips"; T15, T16, T17)', () => {
  const { resolveDeletion, mergePrompt, learnVersion, lineageValue, passOverlaps, relayAtAddress, gateAction } = need('resolveDeletion', 'mergePrompt', 'learnVersion', 'lineageValue', 'passOverlaps', 'relayAtAddress', 'gateAction');
  const { decideAddress } = sweep();
  const A = addr('rp-sc-reapply');
  const v1 = makeTagging({ d: 'rp-sc-reapply', id: idOf('rp:sc:reapply:v1'), createdAt: 1000 });
  const v2 = makeTagging({ d: 'rp-sc-reapply', id: idOf('rp:sc:reapply:v2'), createdAt: 3000 });
  const maps = mapsWith({ S: [[v1.id, A, 1]], L: [[A, v1.id]] });
  const k5 = makeDeletion({ author: ALICE, e: [v1.id], id: idOf('rp:sc:reapply:k5'), createdAt: 2000 });
  const r = resolved(resolveDeletion(k5, maps, new Set([A])), 'resolveDeletion');
  eq(r.prompts.length, 1, 'the revoke resolves (v1 is the top)');
  learnVersion(maps, A, v2.id, PLACED); // the re-apply v2 is delivered
  const entry = mergePrompt(mergePrompt(null, r.prompts[0].prompt), { type: 'version', id: v2.id });
  same(entry.revokes.map(revokeKey), [`e|${v1.id}`], 'v2 heard at A: the by-id revoke of v1 is kept in the entry (A1-5)');
  same(passOverlaps({ graphReadAt: T0, commitAt: T0 + 300 }, [runEntry(RUN, T0 - 5000, T0 + 200)], () => false, {}), [RUN], 'the round overlapped a pass: a re-look is scheduled');
  const row = storedRowFor(v2); // the pass wrote v2; then the relay was wiped
  const d = decideAddress(row, relayAtAddress([], [], A, IDENTITIES));
  same([d.action, d.reason], ['remove', 'not-on-relay'], 'the re-look reads nothing at A');
  gateIs(gateAction(d, { address: A, storedRow: row, relayVersionId: null, entry, baseline: maps.B, lineage: lineageValue(maps, A) }), { act: false, held: 'removal-not-prompted' }, 'the re-look: the kept e:v1 cannot remove the pass-written v2');
  const k5v2 = makeDeletion({ author: ALICE, e: [v2.id], id: idOf('rp:sc:reapply:k5:v2'), createdAt: 4000 });
  const r2 = resolved(resolveDeletion(k5v2, maps, new Set([A])), 'resolveDeletion (v2)');
  gateIs(gateAction(d, { address: A, storedRow: row, relayVersionId: null, entry: mergePrompt(entry, r2.prompts[0].prompt), baseline: maps.B, lineage: lineageValue(maps, A) }), { act: true }, 'control: the author\'s revoke of v2, the recorded version, removes it (clause i)');
});

// ═══ T25: the planner details the suite writers asked about ════════════════════════════════════════════════════
test('RP72: a kind-5 whose own pubkey is written in upper-case hex is not isEvent-shaped, so it resolves nothing live — no prompt, no foreign count, matchedNothing — though the same kind-5 in lower-case hex resolves by e (the address\'s top) and by a; the catch-up\'s author-scoped predicate still keeps it (T25 "A kind-5 whose own pubkey is written in upper-case hex"; T6 as amended by A1-3; T11; owner decision 5\'s corners)', () => {
  const { resolveDeletion, isExpectedDeletion } = need('resolveDeletion', 'isExpectedDeletion');
  hasLetters(DAVE, 'DAVE');
  const A = addr('rp-t25-upk5', DAVE);
  const idD = idOf('rp:t25:upk5');
  const maps = mapsWith({ S: [[idD, A, 1]], L: [[A, idD]] });
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

test('RP75: replayJournal restores the record\'s pending [{ a, entry, lane, attempts, notBefore }], rechecks [{ a, runId, entry }] and parked [{ a, code, attempts, nextAt, entry }] into pending Map<address, entry> — a parked row\'s entry merged in at its address — the rechecks list and parked Map<address, code>, and the journal\'s d, v, c, r, rc, p and k lines apply on top of them, c keeping revokes (T25 record shapes and "Replay", as A1-12 amends them: "record.json\'s parked rows are {a, code, attempts, nextAt, entry}. Replay merges each row\'s entry into pending at its address. parked stays Map<address, code>"; A1-17 T19, T25; A1-5)', () => {
  const replayJournal = fn('replayJournal');
  const [A, B2, C, D, E, F2] = ['a', 'b', 'c', 'd', 'e', 'f'].map((n) => addr(`rp-t25-rec-${n}`));
  const id = (n) => idOf(`rp:t25:rec:${n}`);
  const [rvA, rvA2, rvC, rvE] = [revoke('a', A, 1000), revoke('a', A, 3000), revoke('e', id('c0'), 1500), revoke('e', id('e0'), 1600)];
  const record = {
    version: 1, epoch: 5, firstStartedAt: iso(T0 - 86400000), identities: { canonical: CANONICAL, local: LOCAL }, compactedAt: iso(T0 - 60000),
    seen: [[id('c0'), C]], lineage: [[A, id('a')], [C, id('c'), [id('c0')]], [E, id('e0')]], baseline: [], refusedSeen: [],
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
    parked: [{ a: E, code: 'ENOSPC', attempts: 2, nextAt: T0 + 60000, entry: entryOf({ revokes: [rvE] }) }],
  };
  const pendingOf = (out) => [...out.pending.entries()].reduce((o, [k, v]) => { o[k] = entryFields(v); return o; }, {});
  const recheckKey = (x) => `${x.a}|${x.runId}`;

  // The record alone.
  const restored = replayed(replayJournal([], record), 'replayJournal (record only)');
  same(pendingOf(restored), {
    [A]: entryOf({ version: id('a'), revokes: [rvA] }), [B2]: entryOf({ look: true }), [C]: entryOf({ version: id('c') }),
    [E]: entryOf({ revokes: [rvE] }),
  }, 'pending: each record entry\'s entry, keyed by its a, and the parked row\'s entry at its address (A1-12)');
  same([...restored.rechecks].sort((x, y) => (recheckKey(x) < recheckKey(y) ? -1 : 1)), [...record.rechecks].sort((x, y) => (recheckKey(x) < recheckKey(y) ? -1 : 1)), 'rechecks: [{ a, runId, entry }] as the record holds them');
  same([...restored.parked.entries()], [[E, 'ENOSPC']], 'parked: Map<address, code>');
  same(restored.deadSeenAt, { [RUN2]: T0 - 100 }, 'deadSeenAt');

  // The record with lines on top.
  const out = replayed(replayJournal(texts([
    J.e(5), // the record's generation
    J.d(A, rvA2), // a newer revoke of (a, A): replaces rvA, with its own kind5Id
    J.c(id('a'), A), // A's version completes; its revoke remains
    J.v(id('b'), B2, id('b'), []), // B gains a version; its look stays
    J.c(id('c'), C), // C's version completes and nothing remains: the entry is deleted
    J.r(A, RUN, entryOf({ revokes: [rvA2] })), // merges into the restored re-look (A, RUN)
    J.rc(D, RUN2), // ends the restored re-look (D, RUN2)
    J.p(F2, 'Neo.ClientError.Schema.ConstraintValidationFailed'),
    J.k(RUN3, T0),
  ]), record), 'replayJournal (record and lines)');
  same(pendingOf(out), { [A]: entryOf({ revokes: [rvA2] }), [B2]: entryOf({ version: id('b'), look: true }), [E]: entryOf({ revokes: [rvE] }) }, 'pending after the lines (C deleted by c; the parked address keeps its prompts)');
  same(out.rechecks, [{ a: A, runId: RUN, entry: entryOf({ revokes: [rvA2], look: true }) }], 'rechecks after the lines');
  same([...out.parked.entries()].sort(), [[E, 'ENOSPC'], [F2, 'Neo.ClientError.Schema.ConstraintValidationFailed']].sort(), 'parked after the lines');
  same(out.deadSeenAt, { [RUN2]: T0 - 100, [RUN3]: T0 }, 'deadSeenAt after the lines');
  same([out.maps.S.has(id('a')), out.maps.S.has(id('c')), lin(out.maps, B2), lin(out.maps, C)], [true, true, L(id('b')), L(id('c'), [id('c0')])], '[S has a, S has c, the lineage at B, the lineage at C]');
  eq(out.skippedLines, 0, 'skippedLines');
});

// RP76 deleted (A1-5: "Put-backs, re-looks, parked entries, restored work, a catch-up's work and backlog, and journal
// replay all carry prompts unchanged"; A1-17 T33: "The v-line discard sentences are removed"): its inversion is RP96.

// RP77 deleted (A1-5: discardSupersededRevokes is gone, A1-17 T2, T15): RP2 pins that it is no longer exported.

test('RP78: replayJournal\'s pending holds entries only — each value is a T15 entry with exactly the keys version, revokes and look — whether restored from record.json\'s rows (which carry a, lane, attempts and notBefore beside the entry: those are for diagnostics only), merged from a parked row\'s entry, built by the journal\'s v and d lines, or restored and then changed by lines (T33 "replayJournal\'s pending holds entries only (T15) … record.json keeps lane, attempts and notBefore for diagnostics only"; A1-12; T15; T19: pending is Map<address, entry>; T25 record shapes)', () => {
  const replayJournal = fn('replayJournal');
  const [A, B2, C, P] = ['a', 'b', 'c', 'p'].map((n) => addr(`rp-t33-only-${n}`));
  const id = (n) => idOf(`rp:t33:only:${n}`);
  const rvA = revoke('a', A, 1000);
  const rvP = revoke('a', P, 1200);
  const record = {
    version: 1, epoch: 2, firstStartedAt: iso(T0 - 86400000), identities: { canonical: CANONICAL, local: LOCAL }, compactedAt: iso(T0 - 60000),
    seen: [], lineage: [[A, id('a')]], baseline: [], refusedSeen: [],
    pending: [
      { a: A, entry: entryOf({ version: id('a'), revokes: [rvA] }), lane: 'live', attempts: 3, notBefore: T0 + 5000 },
      { a: B2, entry: entryOf({ look: true }), lane: 'relook', attempts: 1, notBefore: T0 + 60000 },
    ],
    rechecks: [], deadSeenAt: {},
    parked: [{ a: P, code: 'ENOSPC', attempts: 1, nextAt: T0 + 300000, entry: entryOf({ revokes: [rvP] }) }],
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
  problems.push(...shapeProblems(restored, { [A]: entryOf({ version: id('a'), revokes: [rvA] }), [B2]: entryOf({ look: true }), [P]: entryOf({ revokes: [rvP] }) }).map((x) => `[restored] ${x}`));
  const built = replayed(replayJournal(texts([J.v(id('c'), C, id('c'), []), J.d(C, revoke('a', C, 1100))]), null), 'replayJournal (lines only)');
  problems.push(...shapeProblems(built, { [C]: entryOf({ version: id('c'), revokes: [revoke('a', C, 1100)] }) }).map((x) => `[built by lines] ${x}`));
  const changed = replayed(replayJournal(texts([J.e(2), J.v(id('b'), B2, id('b'), []), J.c(id('a'), A)]), record), 'replayJournal (the record, then lines)');
  problems.push(...shapeProblems(changed, { [A]: entryOf({ revokes: [rvA] }), [B2]: entryOf({ version: id('b'), look: true }), [P]: entryOf({ revokes: [rvP] }) }).map((x) => `[restored, then changed] ${x}`));
  assert(problems.length === 0, problems.join('\n        '));
});

// ═══ Found by the mutation pass over the blind reference implementation ═════════════════════════════════════════
test('RP79: replayJournal keeps the FIRST k time for a run — deadSeenAt[runId] is when the path first saw the run not alive, so a later k line for the same run never moves it: of two k lines the first one\'s at stands, a record.json that already holds the run keeps its time against a later k line, and each run keeps its own first time; so a round that read the graph after the first sighting does not overlap the dead run, whatever later k lines say (ADR 0003 § Coexisting with the pass: "deadSeenAt[runId] is the first time this path saw the run not alive (journal k)", "a round that reads the graph after deadSeenAt cannot be overwritten by it"; T17; T19; T25: deadSeenAt a plain object from runId to milliseconds; the record as A1-6 shapes it)', () => {
  const { replayJournal, passOverlaps } = need('replayJournal', 'passOverlaps');
  const twice = replayed(replayJournal(texts([J.k(RUN, T0 + 1000), J.k(RUN, T0 + 2000)]), null), 'replayJournal (two k lines for one run)');
  same(twice.deadSeenAt, { [RUN]: T0 + 1000 }, 'two k lines for one run: deadSeenAt keeps the first line\'s at, never the later one\'s');
  const record = { version: 1, epoch: 9, seen: [], lineage: [], baseline: [], refusedSeen: [], pending: [], rechecks: [], deadSeenAt: { [RUN]: T0 + 1500 }, parked: [] };
  const onRecord = replayed(replayJournal(texts([J.e(9), J.k(RUN, T0 + 3000), J.k(RUN2, T0 + 4000), J.k(RUN2, T0 + 5000)]), record), 'replayJournal (k lines over a record)');
  same(onRecord.deadSeenAt, { [RUN]: T0 + 1500, [RUN2]: T0 + 4000 },
    'the record\'s time stands against a later k line for its run, and a run first seen dead in the journal keeps its first line\'s at');
  // Why the first time (T17): a round whose graph read came after the path first saw the run dead cannot be overwritten
  // by that run, so it must not overlap it. A later k time would make it overlap, and re-look for nothing.
  const runs = [runEntry(RUN, T0 - 60000, null)];
  same(passOverlaps({ graphReadAt: T0 + 1200, commitAt: T0 + 1300 }, runs, () => false, twice.deadSeenAt), [],
    'passOverlaps over the replayed deadSeenAt: a round that read the graph after the first k (T0 + 1000) but before the second (T0 + 2000)');
});

// ═══ Amendment A1: the lineage (A1-1, A1-2, A1-7, A1-8; A1-17 T3) ═══════════════════════════════════════════════
test('RP80: learnVersion(maps, address, id, { under: false }) makes the id its address\'s top, the previous top joining older — the first version learned has no older; a version learned again leaves older as it becomes the top again, so the top never sits in its own older; learning the top again changes nothing — and it returns whether the lineage changed, leaves other addresses alone, and records nothing in S, R or B (A1-17 T3: "learnVersion(maps, address, id, {under}) returns whether the lineage changed"; A1-2: "A delivery makes X the top, and the previous top joins older", "X becomes the top, the previous top joins older, and X leaves older"; A1-1)', () => {
  const { newMaps, learnVersion } = need('newMaps', 'learnVersion');
  const m = newMaps();
  const [A, A2] = [addr('rp-lv'), addr('rp-lv-2')];
  const [v1, v2, v3, w] = ['v1', 'v2', 'v3', 'w'].map((n) => idOf(`rp:lv:${n}`));
  eq(learnVersion(m, A, v1, PLACED), true, 'learning a first version changes the lineage');
  same(lin(m, A), L(v1), 'the first version learned is the top, with no older');
  eq(learnVersion(m, A, v2, PLACED), true, 'learning a second version changes the lineage');
  same(lin(m, A), L(v2, [v1]), 'a later version becomes the top; the previous top joins older');
  learnVersion(m, A, v3, PLACED);
  same(lin(m, A), L(v3, [v1, v2]), 'a third: the top, both earlier ones older');
  eq(learnVersion(m, A, v3, PLACED), false, 'learning the top again changes nothing');
  same(lin(m, A), L(v3, [v1, v2]), 'the lineage after the top is learned again');
  eq(learnVersion(m, A, v1, PLACED), true, 're-learning an older id (the version stored again) changes the lineage');
  same(lin(m, A), L(v1, [v2, v3]), 'v1 is the top again: it leaves older, and v3 joins it');
  learnVersion(m, A2, w, PLACED);
  same([lin(m, A2), lin(m, A)], [L(w), L(v1, [v2, v3])], 'learning at another address leaves A alone');
  same([m.S.size, m.R.size, m.B.size], [0, 0, 0], 'learning records nothing in S, R or B (completing is recordId\'s)');
});

test('RP81: a read placed under a later learning teaches nothing — learnVersion(…, { under: true }) returns false and leaves the lineage exactly as it was, at a known address and at one never learned (it makes no lineage there, so an a target there still resolves nothing), and no graph version joins under it; so a by-e revoke of the later top does not remove a relationship recording a version the path never learned there (it waits for the pass), while the same read placed — nothing learned after its capture — makes its version the top with the graph\'s version in older, and that version\'s revoke removes (A1-2: "If the path learned anything at A after that capture, the read teaches nothing at A: neither X nor the graph\'s version. Their order is unknown"; A1-17 T3 "With under … it teaches nothing"; A1-4; A1-16 decision 2)', () => {
  const { newMaps, learnVersion, learnOlder, lineageValue, resolveDeletion, mergePrompt, gateAction } = need('newMaps', 'learnVersion', 'learnOlder', 'lineageValue', 'resolveDeletion', 'mergePrompt', 'gateAction');
  const { decideAddress } = sweep();
  const A = addr('rp-under');
  const AF = addr('rp-under-fresh');
  const G = makeTagging({ d: 'rp-under', id: idOf('rp:under:g'), createdAt: 1000 }); // the graph records G at A
  const X = idOf('rp:under:x'); // the version the read returned
  const Y = idOf('rp:under:y'); // delivered after the read's capture
  const m = newMaps();
  learnVersion(m, A, Y, PLACED);
  eq(learnVersion(m, A, X, UNDER), false, 'under: learnVersion returns false');
  same(lin(m, A), L(Y), 'under: the lineage at A is exactly as before — X is neither the top nor in older (and the caller joins no G under it)');
  eq(learnVersion(m, AF, X, UNDER), false, 'under, at an address never learned: false');
  eq(lin(m, AF), null, 'under makes no lineage at an address never learned');
  const kA = makeDeletion({ author: ALICE, a: [AF], id: idOf('rp:under:k5:a'), createdAt: 3000 });
  same(resolveDeletion(kA, m, new Set()), { prompts: [], matchedNothing: true, foreign: 0 }, 'so an a target at that address still resolves nothing');
  const kY = makeDeletion({ author: ALICE, e: [Y], id: idOf('rp:under:k5:y'), createdAt: 3100 });
  const rY = resolved(resolveDeletion(kY, m, new Set([A])), 'resolveDeletion (Y)');
  same(rY.prompts.map(promptKey), [`${A}|e|${Y}`], 'the revoke of Y resolves (Y is the top)');
  const row = storedRowFor(G);
  const d = decideAddress(row, null);
  same([d.action, d.reason], ['remove', 'not-on-relay'], 'fixture: an empty read at A plans a not-on-relay removal');
  gateIs(gateAction(d, { address: A, storedRow: row, relayVersionId: null, entry: mergePrompt(null, rY.prompts[0].prompt), baseline: new Set(), lineage: lineageValue(m, A) }),
    { act: false, held: 'removal-not-prompted' }, 'under: G was never learned below Y, so the removal waits for the pass (decision 2)');
  const p = newMaps();
  eq(learnVersion(p, A, X, PLACED), true, 'placed: X is learned');
  eq(learnOlder(p, A, G.id), true, 'placed: the graph\'s G joins older');
  same(lin(p, A), L(X, [G.id]), 'placed: X the top, G in its older');
  const kX = makeDeletion({ author: ALICE, e: [X], id: idOf('rp:under:k5:x'), createdAt: 3200 });
  const rX = resolved(resolveDeletion(kX, p, new Set([A])), 'resolveDeletion (X)');
  same(rX.prompts.map(promptKey), [`${A}|e|${X}`], 'placed: the revoke of X resolves');
  gateIs(gateAction(d, { address: A, storedRow: row, relayVersionId: null, entry: mergePrompt(null, rX.prompts[0].prompt), baseline: new Set(), lineage: lineageValue(p, A) }),
    { act: true }, 'control, placed: X\'s revoke removes the relationship recording G (clause ii)');
});

test('RP82: learnOlder(maps, address, id) joins the graph\'s version to older below the top, returning true, and changes nothing, returning false, when the lineage already holds that id as its top or in older; at an address with no lineage it starts one with no top (a census entry), and a version placed there later becomes the top over it; it never changes the top, and an id it adds resolves no by-e deletion, while the address resolves an a target (A1-17 T3: "learnOlder(maps, address, id) returns whether the lineage changed"; A1-2: "G also joins older"; A1-8: "each (address, eventId) … joins older there, with no top", "Wherever the scan places a version X other than the census\'s id G, G joins older under X"; A1-3)', () => {
  const { newMaps, learnVersion, learnOlder, resolveDeletion } = need('newMaps', 'learnVersion', 'learnOlder', 'resolveDeletion');
  const m = newMaps();
  const [A, AC] = [addr('rp-lo-g'), addr('rp-lo-census')];
  const [X, G, Y, C, X2] = ['x', 'g', 'y', 'c', 'x2'].map((n) => idOf(`rp:lold:${n}`));
  learnVersion(m, A, X, PLACED);
  eq(learnOlder(m, A, G), true, 'the graph\'s G joins older: changed');
  same(lin(m, A), L(X, [G]), 'X the top, G older');
  eq(learnOlder(m, A, G), false, 'G again: already in older, unchanged');
  eq(learnOlder(m, A, X), false, 'the top itself: unchanged (the top never sits in its own older)');
  same(lin(m, A), L(X, [G]), 'the lineage after the no-op calls');
  learnVersion(m, A, Y, PLACED);
  same(lin(m, A), L(Y, [G, X]), 'a later delivery: Y the top; G and X older');
  eq(learnOlder(m, AC, C), true, 'a census entry at an address with no lineage: changed');
  same(lin(m, AC), L(null, [C]), 'a census lineage: C older, no top');
  learnVersion(m, AC, X2, PLACED);
  same(lin(m, AC), L(X2, [C]), 'the scan places X2 there: X2 the top over C (no null joins older)');
  const eAt = (target, tag) => resolved(resolveDeletion(makeDeletion({ author: ALICE, e: [target], id: idOf(`rp:lold:k5:${tag}`), createdAt: 5000 }), m, new Set()), `resolveDeletion (${tag})`).prompts.map(promptKey);
  same([eAt(G, 'g'), eAt(C, 'c'), eAt(X2, 'x2'), eAt(Y, 'y')], [[], [], [`${AC}|e|${X2}`], [`${A}|e|${Y}`]], 'by-e: only the tops resolve, never an id learnOlder added');
  const census = newMaps();
  learnOlder(census, AC, C);
  const kA = makeDeletion({ author: ALICE, a: [AC], id: idOf('rp:lold:k5:a'), createdAt: 5100 });
  same(resolved(resolveDeletion(kA, census, new Set()), 'resolveDeletion (a)').prompts.map(promptKey), [`${AC}|a|${AC}`], 'a census lineage alone lets an a target resolve there');
});

test('RP83: older never holds more than 8 ids — learning a ninth drops the oldest-learned, whether it joins as a replaced top or as the graph\'s version; a version learned again leaves older as it becomes the top, and the next versions learned keep dropping the oldest-learned; a dropped id no longer satisfies clause (ii), which only withholds a removal (A1-7: "older never holds more than 8 ids. Learning a ninth drops the oldest-learned. Dropping an id only withholds clause (ii)"; A1-17 T3: "Both respect the cap"; A1-2: "X leaves older"; A1-1)', () => {
  const { newMaps, learnVersion, learnOlder, lineageValue, gateAction } = need('newMaps', 'learnVersion', 'learnOlder', 'lineageValue', 'gateAction');
  const { decideAddress } = sweep();
  const A = addr('rp-cap8');
  const ev = (n) => makeTagging({ d: 'rp-cap8', id: idOf(`rp:cap8:v${n}`), createdAt: 1000 + n });
  const v = (n) => ev(n).id;
  const G = idOf('rp:cap8:g');
  const m = newMaps();
  for (let n = 1; n <= 9; n++) learnVersion(m, A, v(n), PLACED);
  same(lin(m, A), L(v(9), [1, 2, 3, 4, 5, 6, 7, 8].map(v)), 'nine learned: the top and 8 older ids, none dropped yet');
  learnVersion(m, A, v(10), PLACED);
  same(lin(m, A), L(v(10), [2, 3, 4, 5, 6, 7, 8, 9].map(v)), 'a tenth: v9 joins older as the ninth id, and the oldest-learned (v1) is dropped');
  learnVersion(m, A, v(5), PLACED);
  // Whether v2 survives this step depends on whether v5 leaves older before v10 joins; A1-2 and A1-7 leave that order
  // open, so only what holds either way is pinned here, and the next step is the same under both.
  const relearned = lin(m, A);
  assert(relearned && relearned.top === v(5), `v5 stored again: v5 is the top again, got ${show(relearned)}`);
  const mustHave = [3, 4, 6, 7, 8, 9, 10].map(v);
  const mayHave = new Set([...mustHave, v(2)]);
  assert(relearned.older.length <= 8 && mustHave.every((x) => relearned.older.includes(x)) && relearned.older.every((x) => mayHave.has(x)),
    `v5 stored again: older holds v3, v4, v6…v10 (v10 joined, v5 left it), perhaps v2, and at most 8 ids; got ${show(relearned.older)}`);
  learnVersion(m, A, v(11), PLACED);
  same(lin(m, A), L(v(11), [3, 4, 5, 6, 7, 8, 9, 10].map(v)), 'v11: v5 joins older, and v2, the oldest-learned, is gone (dropped now or at the step before)');
  eq(learnOlder(m, A, G), true, 'the graph\'s G joins a full older: changed');
  same(lin(m, A), L(v(11), [4, 5, 6, 7, 8, 9, 10].map(v).concat(G)), 'G joins as the ninth id: the oldest-learned (v3) is dropped');
  const k11 = entryOf({ revokes: [revoke('e', v(11), 9000)] });
  const gate = (n) => {
    const row = storedRowFor(ev(n));
    return gateAction(decideAddress(row, null), { address: A, storedRow: row, relayVersionId: null, entry: k11, baseline: new Set(), lineage: lineageValue(m, A) });
  };
  gateIs(gate(4), { act: true }, 'a relationship recording v4, still in older: v11\'s revoke removes it (clause ii)');
  gateIs(gate(2), { act: false, held: 'removal-not-prompted' }, 'a relationship recording v2, dropped by the cap: held (the drop only withholds)');
});

test('RP84: lineageValue(maps, address) gives { top, older: [ids] } — a copy, as record.json and the journal carry it — and lineageAt the same top and older ids; setLineage(maps, address, { top, older }) sets a lineage exactly, replacing rather than merging, a census lineage\'s null top included, and setLineage(maps, address, null) removes it; the top index follows each change, so a by-e deletion resolves at the top setLineage names and nowhere else, and learning continues from the lineage set (A1-17 T3: "lineageAt(maps, address) and lineageValue(maps, address) → {top, older: []}", "setLineage(maps, address, value | null)"; A1-1: "an index maps each top id to its address"; A1-6: v and o lines set L(a) exactly)', () => {
  const { newMaps, learnVersion, lineageAt, lineageValue, setLineage, resolveDeletion } = need('newMaps', 'learnVersion', 'lineageAt', 'lineageValue', 'setLineage', 'resolveDeletion');
  const [A, AC, AU] = [addr('rp-lval'), addr('rp-lval-census'), addr('rp-lval-unknown')];
  const [v1, v2, v3, w, g, x] = ['v1', 'v2', 'v3', 'w', 'g', 'x'].map((n) => idOf(`rp:lval:${n}`));
  const m = newMaps();
  for (const id of [v1, v2, v3]) learnVersion(m, A, id, PLACED);
  const v = lineageValue(m, A);
  assert(v && v.top === v3 && Array.isArray(v.older), `lineageValue must return { top, older: [ids] } (A1-17), got ${show(v)}`);
  sameSet(v.older, [v1, v2], 'lineageValue\'s older');
  v.older.push(idOf('rp:lval:junk'));
  v.top = idOf('rp:lval:junk');
  same(lin(m, A), L(v3, [v1, v2]), 'lineageValue returns a copy: changing it changes nothing in the maps');
  const at = lineageAt(m, A);
  assert(at && at.top === v3, `lineageAt must give the lineage's top (A1-17), got ${show(at)}`);
  sameSet(membersOf(at.older, 'lineageAt'), [v1, v2], 'lineageAt\'s older ids');
  const none = lineageAt(m, AU);
  assert(none === null || none === undefined || (none.top === null && membersOf(none.older, 'lineageAt').length === 0), `lineageAt at an address with no lineage: none, got ${show(none)}`);
  eq(lin(m, AU), null, 'lineageValue at an address with no lineage: none');
  const eAt = (target, tag) => resolved(resolveDeletion(makeDeletion({ author: ALICE, e: [target], id: idOf(`rp:lval:k5:${tag}`), createdAt: 6000 }), m, new Set()), `resolveDeletion (${tag})`).prompts.map(promptKey);
  const aAt = (target, tag) => resolved(resolveDeletion(makeDeletion({ author: ALICE, a: [target], id: idOf(`rp:lval:k5a:${tag}`), createdAt: 6000 }), m, new Set()), `resolveDeletion (${tag})`).prompts.map(promptKey);
  setLineage(m, A, { top: w, older: [v1] });
  same(lin(m, A), L(w, [v1]), 'setLineage sets the lineage exactly (v2 and v3 gone: replaced, not merged)');
  same([eAt(v3, 'v3'), eAt(w, 'w'), eAt(v1, 'v1')], [[], [`${A}|e|${w}`], []], 'the top index follows: the old top v3 resolves nothing, the new top w resolves, older v1 nothing');
  setLineage(m, AC, { top: null, older: [g] });
  same(lin(m, AC), L(null, [g]), 'setLineage with a null top: a census lineage');
  same([eAt(g, 'g'), aAt(AC, 'ac')], [[], [`${AC}|a|${AC}`]], 'a census lineage: its older id resolves nothing by e, the address resolves by a');
  learnVersion(m, AC, x, PLACED);
  same(lin(m, AC), L(x, [g]), 'learning continues from the lineage set');
  setLineage(m, A, null);
  eq(lin(m, A), null, 'setLineage(…, null) removes the lineage');
  same([eAt(w, 'w-gone'), aAt(A, 'a-gone')], [[], []], 'after the removal, the former top resolves nothing, nor does the address (S and the graph know nothing there)');
});

/** pruneLineage's { droppedAddresses }: a count or a list of addresses — A1-17 leaves which open — compared with the expected addresses. */
function droppedIs(r, want, label) {
  assert(r && typeof r === 'object' && 'droppedAddresses' in r, `${label}: pruneLineage must return { droppedAddresses } (A1-17), got ${show(r)}`);
  const d = r.droppedAddresses;
  if (Array.isArray(d)) sameSet(d, want, `${label}: droppedAddresses`);
  else eq(d, want.length, `${label}: droppedAddresses (a count)`);
}

test('RP85: pruneLineage drops a lineage when its top is not in the stamp scan (a census lineage has none), the graph\'s keys do not hold its address, and no work waits there — and keeps it when its top was scanned, when the graph holds the address, or when work waits there (keep); a dropped address\'s former top resolves no deletion and the address no a target; it returns { droppedAddresses } (A1-7: "A lineage is dropped when all of these hold: its top is not in the stamp scan; the graph\'s keys did not hold its address; no work waits there (pending, in flight, parked or a re-look)"; A1-17: "pruneLineage(maps, {scannedIds, graphKeys, keep, keepOlder, learnedAfter}) → {droppedAddresses}"; T25: scannedIds a Set; graphKeys a Map as T9 passes it; keep a Set of addresses)', () => {
  const { pruneLineage, resolveDeletion } = need('pruneLineage', 'resolveDeletion');
  const a = (n) => addr(`rp-prune-${n}`);
  const id = (n) => idOf(`rp:prune:${n}`);
  const maps = mapsWith({
    L: [
      [a('drop'), id('drop')], // not scanned, graph lacks it, no work: dropped
      [a('census'), null, [id('census-g')]], // no top, graph lacks it now, no work: dropped
      [a('scanned'), id('scanned')], // its top is on the relay: kept
      [a('graph'), id('graph-top')], // the graph holds the address (another id): kept
      [a('keep'), id('keep')], // work waits there: kept
    ],
  });
  const scannedIds = new Set([id('scanned')]);
  const graphKeys = new Map([[a('graph'), id('graph-g')]]);
  const keep = new Set([a('keep')]);
  const r = pruneLineage(maps, { scannedIds, graphKeys, keep, keepOlder: false, learnedAfter: new Map() });
  droppedIs(r, [a('drop'), a('census')], 'pruneLineage');
  same(['drop', 'census', 'scanned', 'graph', 'keep'].map((n) => lin(maps, a(n))), [null, null, L(id('scanned')), L(id('graph-top')), L(id('keep'))],
    'lineages after the prune: drop and census gone; scanned, graph and keep kept');
  same(resolveDeletion(makeDeletion({ author: ALICE, e: [id('drop')], a: [a('drop'), a('census')], id: idOf('rp:prune:k5'), createdAt: 7000 }), maps, new Set()), { prompts: [], matchedNothing: true, foreign: 0 },
    'a dropped top resolves no deletion, and a dropped address no a target');
});

test('RP86: pruneLineage keeps a lineage where something was learned after the scan\'s capture — an address in learnedAfter — though its top is not in the scan, the graph does not hold it and no work waits there (A1-7: a lineage is dropped only when, besides the other three, "nothing was learned there after the scan\'s capture"; A1-17: pruneLineage takes learnedAfter — this suite passes it as a Map from address to a Set of the ids learned there after the capture)', () => {
  const pruneLineage = fn('pruneLineage');
  const A = addr('rp-prune-after');
  const late = idOf('rp:prune:after:late'); // delivered after the stamp scan's capture: not in the scan
  const maps = mapsWith({ L: [[A, late]] });
  pruneLineage(maps, { scannedIds: new Set(), graphKeys: new Map(), keep: new Set(), keepOlder: false, learnedAfter: new Map([[A, new Set([late])]]) });
  same(lin(maps, A), L(late), 'the lineage of a version learned after the capture is kept');
});

test('RP87: at every lineage it keeps, pruneLineage cuts older to the id the graph\'s keys recorded there plus the ids learned there after the scan\'s capture — where work waits there too — and never cuts a top (A1-7: "Otherwise its older is cut to the id the graph\'s keys recorded there, plus the ids learned there after the scan\'s capture, whether or not work waits there"; A1-17)', () => {
  const pruneLineage = fn('pruneLineage');
  const a = (n) => addr(`rp-cut-${n}`);
  const id = (n) => idOf(`rp:cut:${n}`);
  const maps = mapsWith({
    L: [
      [a('keep'), id('keep-top'), [id('keep-o1'), id('keep-g'), id('keep-o2'), id('keep-late')]], // work waits; graph keep-g; keep-late learned after
      [a('scanned'), id('scanned-top'), [id('scanned-o1')]], // top scanned, graph lacks the address: older emptied
      [a('graph'), id('graph-top'), [id('graph-o1'), id('graph-g')]], // the graph records graph-g: older [graph-g]
      [a('graphtop'), id('graphtop-g'), [id('graphtop-o1')]], // the graph records the top itself: older emptied
      [a('late'), id('late-top'), [id('late-o1'), id('late-o2')]], // top scanned; late-o2 learned after the capture: older [late-o2]
    ],
  });
  const scannedIds = new Set([id('scanned-top'), id('late-top')]);
  const graphKeys = new Map([[a('keep'), id('keep-g')], [a('graph'), id('graph-g')], [a('graphtop'), id('graphtop-g')]]);
  const keep = new Set([a('keep')]);
  const learnedAfter = new Map([[a('keep'), new Set([id('keep-late')])], [a('late'), new Set([id('late-o2')])]]);
  const r = pruneLineage(maps, { scannedIds, graphKeys, keep, keepOlder: false, learnedAfter });
  droppedIs(r, [], 'pruneLineage (nothing to drop)');
  cases([
    { name: 'work waits there: cut to the graph id and the id learned after the capture', a: a('keep'), want: L(id('keep-top'), [id('keep-g'), id('keep-late')]) },
    { name: 'top scanned, the graph lacks the address: older emptied', a: a('scanned'), want: L(id('scanned-top')) },
    { name: 'the graph records an older id: only it stays', a: a('graph'), want: L(id('graph-top'), [id('graph-g')]) },
    { name: 'the graph records the top: older emptied', a: a('graphtop'), want: L(id('graphtop-g')) },
    { name: 'an older id learned after the capture stays', a: a('late'), want: L(id('late-top'), [id('late-o2')]) },
  ], ({ a: at, want }) => same(lin(maps, at), want, 'the lineage after the cut'));
});

test('RP88: while a pass may still write from an older read (keepOlder), pruneLineage drops no lineage and cuts no older — the same maps without it are dropped and cut (A1-7: "The pass exception. While a pass may still write from an older read, no lineage is dropped and older is not cut; only the cap applies"; A1-17: keepOlder)', () => {
  const pruneLineage = fn('pruneLineage');
  const a = (n) => addr(`rp-pass-${n}`);
  const id = (n) => idOf(`rp:pass:${n}`);
  const rows = [[a('drop'), id('drop'), [id('drop-o1')]], [a('cut'), id('cut-top'), [id('cut-o1'), id('cut-g')]]];
  const args = (keepOlder) => ({ scannedIds: new Set([id('cut-top')]), graphKeys: new Map([[a('cut'), id('cut-g')]]), keep: new Set(), keepOlder, learnedAfter: new Map() });
  const held = mapsWith({ L: rows });
  const r = pruneLineage(held, args(true));
  droppedIs(r, [], 'pruneLineage (keepOlder)');
  same([lin(held, a('drop')), lin(held, a('cut'))], [L(id('drop'), [id('drop-o1')]), L(id('cut-top'), [id('cut-o1'), id('cut-g')])], 'keepOlder: every lineage kept whole');
  const control = mapsWith({ L: rows });
  droppedIs(pruneLineage(control, args(false)), [a('drop')], 'control: pruneLineage without keepOlder');
  same([lin(control, a('drop')), lin(control, a('cut'))], [null, L(id('cut-top'), [id('cut-g')])], 'control: without keepOlder, dropped and cut');
});

test('RP89: an entry keeps at most 8 by-e revokes, the most recently merged — a ninth distinct by-e revoke drops the least recently merged, a by-e revoke merged again with a newer created_at counts as merged now, and by-a revokes, the version and look are kept whatever the count (A1-5: "An entry keeps at most 8 by-e revokes, the most recently merged. Dropping one only withholds a removal"; A1-17 T15; A1-7 Bounds)', () => {
  const mergePrompt = fn('mergePrompt');
  const A = addr('rp-cap-e');
  const t = (n) => idOf(`rp:cap-e:t${n}`);
  const v = idOf('rp:cap-e:v');
  const byA = revoke('a', A, 50);
  let e = mergePrompt(mergePrompt(mergePrompt(null, { type: 'version', id: v }), { type: 'look' }), byA);
  for (let n = 1; n <= 9; n++) e = mergePrompt(e, revoke('e', t(n), 100 + n));
  const eTargets = (x) => x.revokes.filter((p) => p.by === 'e').map((p) => p.target);
  sameSet(eTargets(e), [2, 3, 4, 5, 6, 7, 8, 9].map(t), 'nine by-e revokes merged: the 8 most recently merged are kept (t1 dropped)');
  same([e.version, e.look, e.revokes.filter((p) => p.by === 'a')], [{ id: v }, true, [byA]], 'the version, look and the by-a revoke are kept');
  const t2new = revoke('e', t(2), 500);
  e = mergePrompt(e, t2new);
  same(e.revokes.filter((p) => p.by === 'e' && p.target === t(2)), [t2new], 'a newer revoke of t2 replaces it whole');
  e = mergePrompt(e, revoke('e', t(10), 110));
  sameSet(eTargets(e), [2, 4, 5, 6, 7, 8, 9, 10].map(t), 't10 merged: t3, now the least recently merged, is dropped; t2, merged again just now, stays');
  same([e.version, e.look, e.revokes.filter((p) => p.by === 'a')], [{ id: v }, true, [byA]], 'the version, look and the by-a revoke still kept');
});

test('RP90: as versions are learned at an address, a by-e deletion resolves only for the one learned last — each earlier one stops resolving the moment a later one is learned, a version stored again resolves again, a read placed under a later learning changes nothing, and an id S alone records never resolves by e — while an a target resolves wherever a lineage (a census one included), S or the graph\'s keys know the address, and nowhere else; another author naming an older id is not even counted foreign (A1-3: "A kind-5\'s lower-cased e target X resolves only while X is the top of its address\'s lineage"; A1-17 T6: "An e target resolves through the lineage\'s top. An a target resolves through a lineage, S or graphAddresses"; A1-15)', () => {
  const { newMaps, learnVersion, learnOlder, recordId, resolveDeletion } = need('newMaps', 'learnVersion', 'learnOlder', 'recordId', 'resolveDeletion');
  const [A, AS, AG, AC, AU] = ['a', 's', 'g', 'c', 'u'].map((n) => addr(`rp-walk-${n}`));
  const [v1, v2, v3, s, g] = ['v1', 'v2', 'v3', 's', 'g'].map((n) => idOf(`rp:walk:${n}`));
  const graph = new Set([AG]);
  const m = newMaps();
  let k = 0;
  const run = (o) => resolved(resolveDeletion(makeDeletion({ author: ALICE, id: idOf(`rp:walk:k5:${k++}`), createdAt: 8000, ...o }), m, graph), 'resolveDeletion');
  const eAt = (target) => run({ e: [target] }).prompts.map(promptKey);
  learnVersion(m, A, v1, PLACED);
  same(eAt(v1), [`${A}|e|${v1}`], 'v1 learned: e:v1 resolves');
  learnVersion(m, A, v2, PLACED);
  same([eAt(v1), eAt(v2)], [[], [`${A}|e|${v2}`]], 'v2 learned: e:v1 resolves nothing (v2 replaced it), e:v2 resolves');
  learnVersion(m, A, v1, PLACED);
  same([eAt(v1), eAt(v2)], [[`${A}|e|${v1}`], []], 'v1 stored again: e:v1 resolves again, e:v2 nothing');
  learnVersion(m, A, v3, UNDER);
  same([eAt(v3), eAt(v1)], [[], [`${A}|e|${v1}`]], 'a read of v3 placed under a later learning: nothing changes');
  recordId(m, 'S', v2, A, 1);
  same(eAt(v2), [], 'an id S records, but not the top: e:v2 still resolves nothing');
  recordId(m, 'S', s, AS, 1);
  learnOlder(m, AC, g);
  const r = run({ a: [A, AS, AG, AC, AU] });
  sameSet(r.prompts.map((x) => x.address), [A, AS, AG, AC], 'a targets: a lineage, S, the graph and a census lineage; the unknown address nothing');
  const bob = (o) => resolved(resolveDeletion(makeDeletion({ author: BOB, id: idOf(`rp:walk:k5:${k++}`), createdAt: 8100, ...o }), m, graph), 'resolveDeletion (Bob)');
  same([bob({ e: [v2] }).foreign, bob({ e: [v2] }).matchedNothing], [0, true], 'Bob naming Alice\'s older v2: nothing resolves, so nothing is counted foreign');
  same([bob({ e: [v1] }).foreign, bob({ e: [v1] }).prompts], [1, []], 'Bob naming Alice\'s top v1: foreign 1, no prompt');
});

test('RP91: gateAction\'s by-e rule — a by-e revoke naming X lets a removal of the relationship recording G act only when (i) X = G, or (ii) X is the top of ctx.lineage and G is in its older; it is held when X is in older or unknown to the lineage, when G was not learned before X, and when ctx.lineage is null or absent (clause i still counts); a relationship whose eventId is missing, not a string or not an id satisfies neither clause, even when that value sits in older; by-a revokes are unchanged; one revoke that holds is enough; a non-tagging removal still acts on a version prompt (A1-4: "(i) X = G; or (ii) X is the top of A\'s lineage, and G is in its older", "A relationship whose eventId is missing or not a string satisfies neither clause", "By-a revokes are unchanged"; A1-16 decision 2: "a relationship whose stored eventId is missing or not an id … revoked by id" waits for the pass; decision 11 accepted; A1-17 T16: ctx.lineage)', () => {
  const gateAction = fn('gateAction');
  const { decideAddress } = sweep();
  const { taggingToEdge } = contract();
  const G = GV1.id;
  const X = idOf('rp:gate:ii:x');
  const Y = idOf('rp:gate:ii:y');
  hasLetters(G, 'G');
  const byE = (...targets) => entryOf({ revokes: targets.map((t) => revoke('e', t, 5000)) });
  const row = storedRowFor(GV1);
  const rows = [
    { name: 'clause (i): e:G, lineage null', entry: byE(G), lineage: null, want: { act: true } },
    { name: 'clause (i): e:G, the lineage\'s top X with G older', entry: byE(G), lineage: { top: X, older: [G] }, want: { act: true } },
    { name: 'clause (i): e:G, the lineage knowing nothing of G', entry: byE(G), lineage: { top: X, older: [] }, want: { act: true } },
    { name: 'clause (ii): e:X, X the top, G in older', entry: byE(X), lineage: { top: X, older: [Y, G] }, want: { act: true } },
    { name: 'e:X, X the top, G not learned before it', entry: byE(X), lineage: { top: X, older: [Y] }, want: { act: false, held: 'removal-not-prompted' } },
    { name: 'e:X, X in older under the top Y, G older too', entry: byE(X), lineage: { top: Y, older: [X, G] }, want: { act: false, held: 'removal-not-prompted' } },
    { name: 'e:X, X unknown to the lineage (top Y, G older)', entry: byE(X), lineage: { top: Y, older: [G] }, want: { act: false, held: 'removal-not-prompted' } },
    { name: 'e:X, lineage null', entry: byE(X), lineage: null, want: { act: false, held: 'removal-not-prompted' } },
    { name: 'e:X, a census lineage (no top, G older)', entry: byE(X), lineage: { top: null, older: [G] }, want: { act: false, held: 'removal-not-prompted' } },
    { name: 'e:X, no lineage in ctx', entry: byE(X), omitLineage: true, want: { act: false, held: 'removal-not-prompted' } },
    { name: 'a stale e:Y beside a clause (ii) e:X: one revoke that holds is enough', entry: byE(Y, X), lineage: { top: X, older: [Y, G] }, want: { act: true } },
    { name: 'eventId missing', row: storedRowFor(GV1, { missing: ['eventId'] }), entry: byE(X), lineage: { top: X, older: [G] }, want: { act: false, held: 'removal-not-prompted' } },
    { name: 'eventId not a string (an integer)', row: storedRowFor(GV1, { set: { eventId: 42 } }), entry: byE(X), lineage: { top: X, older: [G] }, want: { act: false, held: 'removal-not-prompted' } },
    { name: 'eventId not an id (not hex), and that string in older', row: storedRowFor(GV1, { set: { eventId: 'not-an-id' } }), entry: byE(X), lineage: { top: X, older: ['not-an-id', G] }, want: { act: false, held: 'removal-not-prompted' } },
    { name: 'eventId not an id (upper-case hex), and that string in older', row: storedRowFor(GV1, { set: { eventId: G.toUpperCase() } }), entry: byE(X), lineage: { top: X, older: [G.toUpperCase(), G] }, want: { act: false, held: 'removal-not-prompted' } },
    { name: 'by a, newer than the stored version, lineage null (unchanged)', entry: entryOf({ revokes: [revoke('a', GA, 2000)] }), lineage: null, want: { act: true } },
    { name: 'by a, older than the stored version, X the top with G older (unchanged)', entry: entryOf({ revokes: [revoke('a', GA, 999)] }), lineage: { top: X, older: [G] }, want: { act: false, held: 'removal-not-prompted' } },
  ];
  cases(rows, ({ row: r = row, entry, lineage, omitLineage, want }) => {
    const d = decideAddress(r, null);
    same([d.action, d.reason], ['remove', 'not-on-relay'], 'fixture: decideAddress plans a not-on-relay removal');
    const ctx = { address: GA, storedRow: r, relayVersionId: null, entry, baseline: new Set() };
    if (!omitLineage) ctx.lineage = lineage;
    gateIs(gateAction(d, ctx), want, 'gateAction');
  });
  const nt = makeNonTagging({ address: GA, refusal: 'no-target', id: idOf('rp:gate:ii:nt'), createdAt: 3000 });
  const dNt = decideAddress(row, taggingToEdge(nt, IDENTITIES));
  same([dNt.action, dNt.reason], ['remove', 'non-tagging'], 'fixture: decideAddress plans a non-tagging removal');
  cases([
    { name: 'non-tagging: e:X failing both clauses, with a version prompt', entry: entryOf({ version: nt.id, revokes: [revoke('e', X, 5000)] }), lineage: { top: Y, older: [X] }, want: { act: true } },
    { name: 'non-tagging: e:X failing both clauses, no version prompt', entry: byE(X), lineage: { top: Y, older: [X] }, want: { act: false, held: 'removal-not-prompted' } },
    { name: 'non-tagging: e:X by clause (ii)', entry: byE(X), lineage: { top: X, older: [G] }, want: { act: true } },
  ], ({ entry, lineage, want }) => gateIs(gateAction(dNt, { address: GA, storedRow: row, relayVersionId: nt.id, entry, baseline: new Set(), lineage }), want, 'gateAction'));
});

// ═══ Amendment A1: the journal and the record (A1-5, A1-6, A1-12; A1-17 T19, T25) ════════════════════════════════
test('RP92: every replayed line that changes a lineage is absolute — a v {id, a, top, older} line sets L(a) to exactly its top and older and adds a version prompt for its id, which need not be the top (a first start\'s buffered delivery the scan\'s version outranks); an o {a, top, older} line sets L(a) exactly and prompts nothing, a null top (a census row) included; a later line replaces the lineage, never merges into it; so every prefix of the journal replays to exactly the last line\'s lineage at each address — lines written by journalLine — and the replayed top index resolves the tops alone (A1-6: "Every line that changes a lineage is absolute and self-contained", "v {id, a, top, older} sets L(a) to exactly {top, older}, and adds a version prompt for id. A first start\'s buffered delivery that the scan\'s version outranks is one such line", "An absolute line never splits one change across two lines"; A1-17 T19; A1-1)', () => {
  const { journalLine, replayJournal, resolveDeletion } = need('journalLine', 'replayJournal', 'resolveDeletion');
  const [A, B2, C] = [addr('rp-abs-a'), addr('rp-abs-b'), addr('rp-abs-c')];
  const [X, Y, Z, G, W, Q, Z2] = ['x', 'y', 'z', 'g', 'w', 'q', 'z2'].map((n) => idOf(`rp:abs:${n}`));
  const lines = [
    J.v(Y, A, X, [Y]), // a first start: Y buffered, the scan's X outranks it
    J.o(C, null, [G]), // a census row
    J.o(B2, Z, []), // a scan's learning
    J.o(A, X, [Y, G]), // the graph's G joins older under X
    J.v(W, A, W, [Y, G, X]), // W delivered
    J.o(C, Q, [G]), // the scan places Q over the census's G
    J.o(A, W, [G]), // an exact o line: the lineage is set, not merged into (Y and X leave)
    J.v(Z2, B2, Z2, []), // an exact v line: the lineage is set, not merged into (Z leaves)
  ];
  const text = lines.map((o) => {
    const l = journalLine(o);
    assert(typeof l === 'string' && l.endsWith('\n'), `journalLine must return one line ending in its newline (T19), got ${show(l)}`);
    return l.slice(0, -1);
  });
  const want = (k, a) => {
    const last = lines.slice(0, k).filter((o) => o.a === a).pop();
    return last ? L(last.top, last.older) : null;
  };
  cases(Array.from({ length: lines.length + 1 }, (_, k) => ({ name: `the first ${k} line(s)`, k })), ({ k }) => {
    const out = replayed(replayJournal(text.slice(0, k), null), `replayJournal (prefix ${k})`);
    same([A, B2, C].map((a) => lin(out.maps, a)), [A, B2, C].map((a) => want(k, a)), 'the lineages at A, B and C: the last line\'s at each');
    eq(out.skippedLines, 0, 'skippedLines');
  });
  const first = replayed(replayJournal(text.slice(0, 1), null), 'replayJournal (the first line)');
  same([entryFields(first.pending.get(A)), lin(first.maps, A)], [entryOf({ version: Y }), L(X, [Y])], 'the buffered delivery\'s line: a version prompt for Y, and X the top over it');
  const out = replayed(replayJournal(text, null), 'replayJournal (all lines)');
  same([entryFields(out.pending.get(A)), entryFields(out.pending.get(B2)), out.pending.has(C)], [entryOf({ version: W }), entryOf({ version: Z2 }), false],
    'pending: prompts from the v lines only (the latest at A, W; Z2 at B; none at C)');
  const eAt = (target, tag) => resolved(resolveDeletion(makeDeletion({ author: ALICE, e: [target], id: idOf(`rp:abs:k5:${tag}`), createdAt: 9000 }), out.maps, new Set()), `resolveDeletion (${tag})`).prompts.map(promptKey);
  same([W, Q, Z2, X, Y, G, Z].map((t, i) => eAt(t, String(i))), [[`${A}|e|${W}`], [`${C}|e|${Q}`], [`${B2}|e|${Z2}`], [], [], [], []], 'after the replay only the tops W, Q and Z2 resolve by e');
});

test('RP93: replay applies only the record\'s journal generation — the lines after the e {epoch} line matching record.epoch; lines before it, and an older generation\'s lines a failed truncation left behind, are not applied, and with no matching e line none is — so a truncation that failed after a re-baseline cannot replay the older generation over the new record (A1-6: "Every compaction writes record.json with a new epoch, then truncates the journal and starts it with e {epoch}. Replay applies only lines after the e line matching the record\'s epoch"; A1-17 T19: "e {epoch} opens each journal generation, and replay applies only the record\'s generation")', () => {
  const replayJournal = fn('replayJournal');
  const [A, B2, C, D] = ['a', 'b', 'c', 'd'].map((n) => addr(`rp-epoch-${n}`));
  const id = (n) => idOf(`rp:epoch:${n}`);
  const record = {
    version: 1, epoch: 3, firstStartedAt: iso(T0 - 86400000), identities: { canonical: CANONICAL, local: LOCAL }, compactedAt: iso(T0 - 1000),
    seen: [[id('x'), A]], lineage: [[A, id('x')]], baseline: [id('x')], refusedSeen: [], pending: [], rechecks: [], deadSeenAt: {}, parked: [],
  };
  const older = [ // generation 2: already folded into the record, and left behind when truncation failed
    J.e(2), J.v(id('y'), A, id('y'), [id('x')]), J.d(A, revoke('e', id('y'), 2000)), J.o(B2, id('z'), []), J.f(id('r'), A), J.b(id('x')),
  ];
  const current = [J.e(3), J.v(id('w'), C, id('w'), []), J.d(C, revoke('a', C, 2100))];
  const pendingKeys = (out) => [...out.pending.keys()].sort();
  const both = replayed(replayJournal(texts([...older, ...current]), record), 'replayJournal (generation 2, then 3)');
  same([lin(both.maps, A), lin(both.maps, B2), both.maps.R.has(id('r')), both.maps.B.has(id('x'))], [L(id('x')), null, false, true], 'generation 2\'s lines are not applied over the record');
  same([lin(both.maps, C), pendingKeys(both)], [L(id('w')), [C]], 'generation 3\'s lines are');
  same(entryFields(both.pending.get(C)), entryOf({ version: id('w'), revokes: [revoke('a', C, 2100)] }), 'the pending entry the record\'s generation built');
  const stale = replayed(replayJournal(texts(older), record), 'replayJournal (only generation 2: the matching e line never written)');
  same([lin(stale.maps, A), lin(stale.maps, B2), pendingKeys(stale), stale.maps.B.has(id('x'))], [L(id('x')), null, [], true], 'with no e line matching the record, no line applies');
  const before = replayed(replayJournal(texts([J.v(id('v'), D, id('v'), []), J.e(3), J.o(B2, id('z'), [])]), record), 'replayJournal (a line before the matching e line)');
  same([lin(before.maps, D), pendingKeys(before), lin(before.maps, B2)], [null, [], L(id('z'))], 'a line before the matching e line is not applied; the lines after it are');
});

test('RP94: a v line lacking its top or older — T19\'s old relative form — is skipped and counted and prompts nothing; so is an o line lacking older, with an older that is not an array, or with a top that is neither an id string nor null; the lines around them still apply (A1-6: "Every line that changes a lineage is absolute and self-contained"; A1-17 T19: "v {id, a, top, older} and o {a, top, older} are absolute"; T19: a malformed line is skipped and counted)', () => {
  const replayJournal = fn('replayJournal');
  const [A, B2, C] = [addr('rp-rel-a'), addr('rp-rel-b'), addr('rp-rel-c')];
  const [i1, i2, i3] = [idOf('rp:rel:1'), idOf('rp:rel:2'), idOf('rp:rel:3')];
  const bad = [
    { t: 'v', id: i2, a: B2 },
    { t: 'v', id: i2, a: B2, top: i2 },
    { t: 'v', id: i2, a: B2, older: [] },
    { t: 'o', a: B2, top: i2 },
    { t: 'o', a: B2, top: i2, older: i1 },
    { t: 'o', a: B2, top: 5, older: [] },
  ];
  const out = replayed(replayJournal(texts([J.v(i1, A, i1, []), ...bad, J.v(i3, C, i3, [])]), null), 'replayJournal');
  eq(out.skippedLines, bad.length, `skippedLines (the ${bad.length} lines that are not absolute)`);
  same([lin(out.maps, A), lin(out.maps, B2), lin(out.maps, C)], [L(i1), null, L(i3)], 'the lineages: the good lines applied, the bad ones not');
  same([...out.pending.keys()].sort(), [A, C].sort(), 'pending: no version prompt from a skipped v line');
});

test('RP95: replay merges each parked row\'s entry into pending at its address — by mergePrompt\'s rules where the record also holds a pending row there — while parked stays Map<address, code>; a later p line changes only the code, and a c line answers only the version prompt, so a parked revoke-gated removal keeps its revokes across a restart (A1-12: "record.json\'s parked rows are {a, code, attempts, nextAt, entry}. Replay merges each row\'s entry into pending at its address. parked stays Map<address, code>, and the p line is unchanged"; A1-5; A1-17 T19, T25)', () => {
  const replayJournal = fn('replayJournal');
  const [P, Q] = [addr('rp-park-p'), addr('rp-park-q')];
  const id = (n) => idOf(`rp:park:${n}`);
  const [xOld, xNew, y, aQ] = [revoke('e', id('x'), 100), revoke('e', id('x'), 200), revoke('e', id('y'), 150), revoke('a', Q, 300)];
  const record = {
    version: 1, epoch: 1, firstStartedAt: iso(T0 - 86400000), identities: { canonical: CANONICAL, local: LOCAL }, compactedAt: iso(T0 - 1000),
    seen: [], lineage: [[P, id('v')], [Q, id('q')]], baseline: [], refusedSeen: [],
    pending: [{ a: P, entry: entryOf({ version: id('v'), revokes: [xOld] }), lane: 'live', attempts: 2, notBefore: T0 + 5000 }],
    rechecks: [], deadSeenAt: {},
    parked: [
      { a: P, code: 'Neo.ClientError.Schema.ConstraintValidationFailed', attempts: 2, nextAt: T0 + 300000, entry: entryOf({ revokes: [xNew, y], look: true }) },
      { a: Q, code: 'ENOSPC', attempts: 3, nextAt: T0 + 1800000, entry: entryOf({ revokes: [aQ] }) },
    ],
  };
  const pendingOf = (out) => [...out.pending.entries()].reduce((o, [k, v]) => { o[k] = entryFields(v); return o; }, {});
  const byKey = (e) => [...((e && e.revokes) || [])].sort((m, n) => (revokeKey(m) < revokeKey(n) ? -1 : 1));
  const restored = replayed(replayJournal([], record), 'replayJournal (the record only)');
  const p = restored.pending.get(P);
  assert(p, `a pending entry at P, got ${show(pendingOf(restored))}`);
  same([p.version, p.look, byKey(p)], [{ id: id('v') }, true, byKey({ revokes: [xNew, y] })], 'P: the pending row and the parked row\'s entry merged — the version, look ORed, per (by, target) the newer revoke');
  same(entryFields(restored.pending.get(Q)), entryOf({ revokes: [aQ] }), 'Q: the parked row\'s entry, with no pending row');
  same([...restored.parked.entries()].sort(), [[P, 'Neo.ClientError.Schema.ConstraintValidationFailed'], [Q, 'ENOSPC']].sort(), 'parked: Map<address, code>');
  const out = replayed(replayJournal(texts([J.e(1), J.p(Q, 'Neo.DatabaseError.General.UnknownError'), J.c(id('v'), P)]), record), 'replayJournal (the record, then p and c lines)');
  same(out.parked.get(Q), 'Neo.DatabaseError.General.UnknownError', 'a p line changes the code');
  same(entryFields(out.pending.get(Q)), entryOf({ revokes: [aQ] }), 'Q keeps its prompts after the p line');
  const p2 = out.pending.get(P);
  same([p2 && p2.version, p2 && p2.look, byKey(p2)], [null, true, byKey({ revokes: [xNew, y] })], 'P after c: the version answered, the revokes and look kept');
});

test('RP96: journal replay carries prompts unchanged — a v line at an address discards no revoke: the pending entry and the re-looks there keep every by-e revoke, one naming a version the line\'s top replaced included, whether the journal built them or record.json restored them; the gate, not replay, decides what a stale revoke may do, and it holds this one (A1-5: "Nothing discards a revoke prompt for being stale … Put-backs, re-looks, parked entries, restored work … and journal replay all carry prompts unchanged"; A1-17 T33: "The v-line discard sentences are removed"; RP76, which pinned the discard, is deleted; A1-4)', () => {
  const { replayJournal, lineageValue, gateAction } = need('replayJournal', 'lineageValue', 'gateAction');
  const { decideAddress } = sweep();
  const A = addr('rp-carry');
  const v2ev = makeTagging({ d: 'rp-carry', id: idOf('rp:carry:i2'), createdAt: 3000 });
  const [i1, i2] = [idOf('rp:carry:i1'), v2ev.id];
  const byKey = (e) => ((e && e.revokes) || []).map(revokeKey);
  const [rvE1, rvA, rlE1, rlA] = [revoke('e', i1, 2000), revoke('a', A, 2100), revoke('e', i1, 2060), revoke('a', A, 2160)];
  const journal = [
    J.v(i1, A, i1, []), J.d(A, rvE1), J.d(A, rvA),
    J.r(A, RUN, entryOf({ version: i1, revokes: [rlE1, rlA], look: true })),
    J.v(i2, A, i2, [i1]),
  ];
  const out = replayed(replayJournal(texts(journal), null), 'replayJournal (… then v i2 at A)');
  const e = out.pending.get(A);
  assert(e && typeof e === 'object', `a pending entry at ${A}, got ${show(e)}`);
  sameSet(byKey(e), [`e|${i1}`, `a|${A}`], 'the pending entry at A after the v line: every revoke kept, e:i1 included');
  same(e.version, { id: i2 }, 'the pending entry\'s version is the v line\'s');
  const relook = out.rechecks.find((x) => x.a === A && x.runId === RUN);
  assert(relook && relook.entry, `the re-look (A, RUN) is still there, got ${show(out.rechecks)}`);
  sameSet(byKey(relook.entry), [`e|${i1}`, `a|${A}`], 'the re-look at A after the v line: every revoke kept');
  const record = {
    version: 1, epoch: 6, firstStartedAt: iso(T0 - 86400000), identities: { canonical: CANONICAL, local: LOCAL }, compactedAt: iso(T0 - 60000),
    seen: [[i1, A]], lineage: [[A, i1]], baseline: [], refusedSeen: [],
    pending: [{ a: A, entry: entryOf({ version: i1, revokes: [rvE1, rvA] }), lane: 'live', attempts: 1, notBefore: T0 + 5000 }],
    rechecks: [{ a: A, runId: RUN2, entry: entryOf({ revokes: [rlE1, rlA], look: true }) }],
    deadSeenAt: {}, parked: [],
  };
  const fromRecord = replayed(replayJournal(texts([J.e(6), J.v(i2, A, i2, [i1])]), record), 'replayJournal (the record, then v i2 at A)');
  sameSet(byKey(fromRecord.pending.get(A)), [`e|${i1}`, `a|${A}`], 'the restored pending entry at A after the v line: every revoke kept');
  const restoredRelook = fromRecord.rechecks.find((x) => x.a === A && x.runId === RUN2);
  sameSet(byKey(restoredRelook && restoredRelook.entry), [`e|${i1}`, `a|${A}`], 'the restored re-look at A after the v line: every revoke kept');
  same(lin(fromRecord.maps, A), L(i2, [i1]), 'the lineage the v line set');
  const row = storedRowFor(v2ev); // the pass recorded i2; then the relay lost it with no event
  const d = decideAddress(row, null);
  gateIs(gateAction(d, { address: A, storedRow: row, relayVersionId: null, entry: fromRecord.pending.get(A), baseline: fromRecord.maps.B, lineage: lineageValue(fromRecord.maps, A) }),
    { act: false, held: 'removal-not-prompted' }, 'the gate holds the carried e:i1 (i1 is neither the recorded i2 nor the top) and the by-a revoke older than i2');
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
