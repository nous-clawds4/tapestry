'use strict';
/**
 * Tests for Story 2 (epic tagging-edges) — the gap-filling pass's pure planner, src/lib/tagging-edges/sweep.js.
 *
 * Story: engineering-team/stories/tagging-edges/2-gap-filling-pass-and-backfill.md
 * ADR:   engineering-team/decisions/tagging-edges/0002-gap-filling-pass.md — "Implementation notes → New files →
 *        sweep.js", "The rule for one address", "The removal rule and the limit (R2-NB3, AC-5)", and "Seams for Test
 *        Design → Planner, stack-free" and "→ Identities". Binding context: ADR tagging-edges/0001 (amended by 0002,
 *        A1–A11) and src/lib/tagging-edges/contract.js.
 * Plan:  engineering-team/stories/tagging-edges/2-gap-filling-pass-and-backfill.test-plan.md
 *
 * Intentionally failing until src/lib/tagging-edges/sweep.js lands (red phase). The module is require()d LAZILY inside
 * each test through load() / fn(), so loading this suite never crashes the runner, and each test fails with
 * "… not implemented yet" rather than a load error.
 *
 * Pure and stack-free: no Neo4j, no strfry, no network, no filesystem writes, no clock. Graph rows are READ_ALL's
 * projection, built by test/helpers/taggingEdgesFixtures.js; relay events are plain objects. Every pubkey is a fake
 * 64-hex value from that helper — never a deployment's TA and never the ADR 0015 literal. The canonical identity is a
 * parameter of the contract, so a fake stands in for it, and the canonical and local identities are kept different
 * (story 2, "For Test Design").
 *
 * What is pinned: the names the ADR gives — the exports, the `action` values of the rule table ('leave', 'create',
 * 'none', 'remove', 'update', 'move'), `reason` for leave and remove, `label` for update and move, planPass's
 * `creates` / `updates` / `moves` / `removals` / `held` arrays (`removals` = the removals to apply, `held` = the held
 * list), judgeRemovals's `apply` / `held` / `limit`, and the report's field names where the planner computes them.
 * Shapes the ADR leaves open are read tolerantly by the helpers below: a planned `desired` may be edge-shaped
 * ({ from, to, address, … }) or { from, to, props: { … } }; `byAddress` may be a Map or a plain object; a planned
 * item names its address as `.address` (or on its `desired`); `conflicts` may be a count, Set, Map or array.
 * One exception, SW54: planPass's items are handed to the graph port as they are (test/tagging-edges-live.test.js
 * does so), so SW54 pins the port's row shape on them — `{ address, desired }` for a create, `{ address, snapshot,
 * desired }` for an update or move, `{ address, snapshot }` for a removal (clarification C6 in the test plan).
 *
 * Hand-rolled in the project's existing test style — no new framework. Runs on Node 16 and 22.
 */

const fs = require('fs');
const path = require('path');
const {
  CANONICAL, LOCAL, OTHER_DEPLOY, IDENTITIES, JACK, ALICE, BOB, CAROL, idOf,
  STAMP, TAG_STAMP, fourStamps, Z, TAG_V1, D, ADDRESS, TAG_ADDR, NON_TAGGING,
  makeTagging, makeElement, makeNonTagging, makeDeletion, manyTaggings,
  contractEdge, PROPERTY_KEYS, EDGE_KEYS, storedRow, storedRowFor,
} = require('./helpers/taggingEdgesFixtures');

const REPO_ROOT = path.join(__dirname, '..');
const SWEEP_REQUIRE = '../src/lib/tagging-edges/sweep';
const CONTRACT_REQUIRE = '../src/lib/tagging-edges/contract';
const INDEX_REQUIRE = '../src/lib/tagging-edges';
const SWEEP_FILE = path.join(REPO_ROOT, 'src/lib/tagging-edges/sweep.js');

// ─── loading, lazily ───────────────────────────────────────────────────────────────────────────────────────────
/** The module under test, with a descriptive red-phase message. */
function load() {
  try { return require(SWEEP_REQUIRE); }
  catch (e) { throw new Error(`tagging-edges sweep planner not implemented yet (require('${SWEEP_REQUIRE}') failed: ${e.message})`); }
}
/** An exported function of sweep.js, or a descriptive failure. */
function fn(name) {
  const f = load()[name];
  if (typeof f !== 'function') throw new Error(`src/lib/tagging-edges/sweep.js does not export ${name}() yet (got ${typeof f})`);
  return f;
}
/** An exported constant of sweep.js, or a descriptive failure. */
function constant(name) {
  const m = load();
  if (!(name in m)) throw new Error(`src/lib/tagging-edges/sweep.js does not export ${name} yet`);
  return m[name];
}
/** Story 1's contract (already shipped). */
function contract() {
  try { return require(CONTRACT_REQUIRE); }
  catch (e) { throw new Error(`tagging-edges contract not loadable (require('${CONTRACT_REQUIRE}') failed: ${e.message})`); }
}

// ─── assertions ────────────────────────────────────────────────────────────────────────────────────────────────
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v instanceof Map) return { '<Map>': [...v.entries()].map(([k, x]) => [k, sortKeys(x)]) };
  if (v instanceof Set) return { '<Set>': [...v].map(sortKeys) };
  if (v && typeof v === 'object') return Object.keys(v).sort().reduce((o, k) => { o[k] = sortKeys(v[k]); return o; }, {});
  return v;
}
/** JSON with sorted keys, BigInts as `123n`, and NaN / Infinity spelled out. Long strings are shortened. */
function show(v) {
  return JSON.stringify(sortKeys(v), (k, x) => {
    if (typeof x === 'bigint') return `${x}n`;
    if (typeof x === 'number' && !Number.isFinite(x)) return String(x);
    if (typeof x === 'string' && x.length > 120) return `${x.slice(0, 24)}…(${Buffer.byteLength(x, 'utf8')} bytes)`;
    return x;
  });
}
function exact(v) {
  return JSON.stringify(sortKeys(v), (k, x) => (typeof x === 'bigint' ? `${x}n` : (typeof x === 'number' && !Number.isFinite(x) ? String(x) : x)));
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function eq(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}\n        expected: ${show(expected)}\n        actual:   ${show(actual)}`);
}
function same(actual, expected, label) {
  if (exact(actual) !== exact(expected)) throw new Error(`${label}\n        expected: ${show(expected)}\n        actual:   ${show(actual)}`);
}
/** Two collections of strings hold the same members; the message names the counts and a few differences. */
function sameSet(actual, expected, label) {
  const a = new Set(actual);
  const e = new Set(expected);
  const missing = [...e].filter((x) => !a.has(x));
  const extra = [...a].filter((x) => !e.has(x));
  const dup = actual.length !== a.size ? ` (${actual.length - a.size} repeated)` : '';
  if (missing.length || extra.length || dup) {
    throw new Error(`${label}\n        expected ${e.size} members, got ${actual.length}${dup}` +
      `${missing.length ? `\n        missing (${missing.length}): ${show(missing.slice(0, 5))}` : ''}` +
      `${extra.length ? `\n        unexpected (${extra.length}): ${show(extra.slice(0, 5))}` : ''}`);
  }
}
/** Run every row of a table and report every wrong row at once. */
function table(label, rows, check) {
  const problems = [];
  for (const row of rows) {
    try { check(row); } catch (e) { problems.push(e.message.replace(/\n/g, '\n          ')); }
  }
  if (problems.length) {
    throw new Error(`${label}: ${problems.length} of ${rows.length} cases wrong\n        - ${problems.slice(0, 14).join('\n        - ')}` +
      `${problems.length > 14 ? `\n        … and ${problems.length - 14} more` : ''}`);
  }
}

// ─── reading the planner's outputs (tolerant of shapes the ADR leaves open) ────────────────────────────────────
function isPlainObject(x) { return !!x && typeof x === 'object' && !Array.isArray(x) && !(x instanceof Map) && !(x instanceof Set); }
function isInt(v) { return typeof v === 'bigint' || Number.isInteger(v); }
function isRefusal(x) { return !!x && typeof x === 'object' && x.ok === false; }

/**
 * A state — standing, desired or stored — as { from, to, <the nine> }, an absent property read as null (Neo4j stores
 * no null). Accepts an edge-shaped object ({ type?, from, to, address, … }) or { from, to, props: { … } }.
 */
function stateOf(x) {
  if (x === null || x === undefined) return null;
  const flat = isPlainObject(x.props) ? { ...x.props, from: x.from, to: x.to } : x;
  const s = {};
  for (const k of ['from', 'to', ...PROPERTY_KEYS]) s[k] = flat[k] === undefined ? null : flat[k];
  return s;
}
/** stateOf with createdAt compared as an integer value (a JS number or a BigInt), and anything else marked. */
function comparable(x) {
  const s = stateOf(x);
  if (s === null) return null;
  const c = s.createdAt;
  return { ...s, createdAt: isInt(c) ? `integer ${String(c)}` : `NOT AN INTEGER: ${typeof c} ${show(c)}` };
}
function sameState(actual, expected, label) { same(comparable(actual), comparable(expected), label); }
/** A state back as a contract-shaped edge, so storedRow can build the row a correct write of it reads back as. */
function asEdge(x) { return { type: 'TAGS', ...stateOf(x) }; }
/** Keys a desired state would write beyond the nine (AC-8: none). */
function keysOutsideNine(d) {
  const nine = new Set(PROPERTY_KEYS);
  if (isPlainObject(d.props)) return Object.keys(d.props).filter((k) => !nine.has(k));
  return Object.keys(d).filter((k) => !nine.has(k) && k !== 'type' && k !== 'from' && k !== 'to');
}
/** A planned item's desired state (the item itself when it carries none). */
function desiredOf(item) { return isPlainObject(item) && isPlainObject(item.desired) ? item.desired : item; }
/** A planned item's address. */
function addrOf(item) {
  if (!isPlainObject(item)) return undefined;
  if (typeof item.address === 'string') return item.address;
  const d = item.desired;
  if (isPlainObject(d) && typeof d.address === 'string') return d.address;
  if (isPlainObject(d) && isPlainObject(d.props) && typeof d.props.address === 'string') return d.props.address;
  if (isPlainObject(item.props) && typeof item.props.address === 'string') return item.props.address;
  return undefined;
}
/** A Map or plain-object lookup. */
function entryAt(m, k) {
  if (m instanceof Map) return m.get(k);
  if (m && typeof m === 'object' && Object.prototype.hasOwnProperty.call(m, k)) return m[k];
  return undefined;
}
/** How many members a count, Set, Map, array or plain object holds. */
function sizeOf(c) {
  if (typeof c === 'number') return c;
  if (c instanceof Set || c instanceof Map) return c.size;
  if (Array.isArray(c)) return c.length;
  if (c && typeof c === 'object') return Object.keys(c).length;
  throw new Error(`expected a count or a collection, got ${show(c)}`);
}
/** A reason → count map with the zero entries dropped (a Map or a plain object). */
function nonZeroCounts(m) {
  const o = m instanceof Map ? Object.fromEntries(m) : { ...(m || {}) };
  for (const k of Object.keys(o)) if (!o[k]) delete o[k];
  return o;
}

const PLAN_LISTS = ['creates', 'updates', 'moves', 'removals', 'held'];
/** planPass's five lists, each required to be an array. */
function lists(plan) {
  assert(isPlainObject(plan), `planPass must return an object, got ${show(plan)}`);
  const out = {};
  for (const k of PLAN_LISTS) {
    assert(Array.isArray(plan[k]), `planPass(…).${k} must be an array (ADR: { creates, updates, moves, removals, held, counts, … }), got ${show(plan[k])}`);
    out[k] = plan[k];
  }
  return out;
}
/** The addresses of one planned list. */
function addressesIn(items, label) {
  return items.map((it, i) => {
    const a = addrOf(it);
    assert(typeof a === 'string', `${label}[${i}] names no address: ${show(it)}`);
    return a;
  });
}
/** Every address planPass touches, across all five lists. */
function touched(plan) {
  const l = lists(plan);
  return new Set(PLAN_LISTS.flatMap((k) => addressesIn(l[k], k)));
}
/** planPass's limit record (at `limit`, or under `counts.limit`). */
function planLimit(plan) {
  const l = (plan && plan.limit) || (plan && plan.counts && plan.counts.limit);
  assert(isPlainObject(l), `planPass(…) carries no limit record (looked at .limit and .counts.limit): ${show(Object.keys(plan || {}))}`);
  return l;
}
/** judgeRemovals's result, with apply / held required to be arrays. */
function judged(r) {
  assert(isPlainObject(r) && Array.isArray(r.apply) && Array.isArray(r.held),
    `judgeRemovals must return { apply: [], held: [], limit }, got ${show(r && Object.keys(r))}`);
  return r;
}

// ─── fixtures ──────────────────────────────────────────────────────────────────────────────────────────────────
/** A contract edge for a tagging built with makeTagging options (the fixture identities by default). */
const edge = (o = {}, opts = IDENTITIES) => contractEdge(makeTagging(o), opts);
/** The contract's refusal of an event, which must carry an address (a non-tagging version at a tagging address). */
function refusalOf(ev, opts = IDENTITIES) {
  const r = contract().taggingToEdge(ev, opts);
  if (!isRefusal(r) || typeof r.address !== 'string') throw new Error(`fixture: expected a refusal carrying an address, got ${show(r)}`);
  return r;
}
/** Contract options with these events supplied as tag elements. */
const withElements = (...els) => ({ ...IDENTITIES, tagElementsById: new Map(els.map((e) => [e.id, e])) });
/** A tagging address by Alice (or another author). */
const addr = (d, author = ALICE) => `39999:${author}:${d}`;
const upperHex = (s) => s.toUpperCase();

/** n taggings at their own addresses (d `${prefix}-${i}`) and the rows a correct write of each reads back as. */
function bulk(n, prefix) {
  const events = manyTaggings(n, { prefix });
  return { events, rows: events.map((ev) => storedRowFor(ev)) };
}
const memo = {};
function bulkOnce(n, prefix) { return memo[prefix] || (memo[prefix] = bulk(n, prefix)); }

/** n removals `{ address, seenEventId, reason }` at their own addresses. */
function removalsFor(n, prefix, reason = 'not-on-relay') {
  return Array.from({ length: n }, (_, i) => ({ address: addr(`${prefix}-${i}`), seenEventId: idOf(`${prefix}:${i}`), reason }));
}

/** The state an address holds after the pass acts on a decision, given the stored edge the row was written from. */
function afterDecision(d, storedEdge) {
  switch (d && d.action) {
    case 'create': case 'update': case 'move': return stateOf(d.desired);
    case 'remove': return null;
    case 'none': case 'leave': return storedEdge ? stateOf(storedEdge) : null;
    default: throw new Error(`decideAddress returned an unknown action: ${show(d)}`);
  }
}

const tests = [];
function test(name, fn) { tests.push([name, fn]); }

// ═══ Surface and constants ═════════════════════════════════════════════════════════════════════════════════════
test('SW1: sweep.js sits beside contract.js (so the folder\'s purity and no-64-hex guards cover it), requires the contract, and builds no 39998 stamp itself', () => {
  if (!fs.existsSync(SWEEP_FILE)) throw new Error('src/lib/tagging-edges/sweep.js does not exist yet');
  // Behaviour, not vocabulary: comments are stripped before scanning, so a comment may name a stamp.
  const src = fs.readFileSync(SWEEP_FILE, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  assert(/require\(\s*['"]\.\/contract(\.js)?['"]\s*\)/.test(src), 'sweep.js must require(\'./contract\'): edges come from taggingToEdge and stamps from the contract\'s stamp() (ADR 0002, sweep.js)');
  assert(!src.includes('39998:'), 'sweep.js composes a "39998:" stamp itself; the four stamps come only from the contract\'s stamp() (ADR 0002: "four stamps via the contract\'s stamp")');
});

const SWEEP_FUNCTIONS = ['checkIdentity', 'isTaggingAddress', 'sweepFilter', 'isExpectedScanEvent', 'readRelay', 'storedFromRow',
  'fingerprint', 'desiredFor', 'decideAddress', 'judgeRemovals', 'planPass', 'groupSnapshot', 'heldLines'];
const SWEEP_CONSTANTS = ['TAGS_PROPERTY_KEYS', 'LIMIT', 'REMOVAL_REASON', 'LEFT_REASON', 'CHANGE_KIND', 'RUN_ID_RE'];

test('SW2: sweep.js exports the functions and constants the ADR names, and src/lib/tagging-edges re-exports every one of them', () => {
  const m = load();
  const missing = [...SWEEP_FUNCTIONS.filter((f) => typeof m[f] !== 'function'), ...SWEEP_CONSTANTS.filter((c) => !(c in m))];
  same(missing, [], 'sweep.js exports missing');
  let index;
  try { index = require(INDEX_REQUIRE); } catch (e) { throw new Error(`src/lib/tagging-edges/index.js failed to load: ${e.message}`); }
  const notReexported = [...SWEEP_FUNCTIONS, ...SWEEP_CONSTANTS].filter((k) => index[k] !== m[k]);
  same(notReexported, [], 'names src/lib/tagging-edges/index.js does not re-export from ./sweep (ADR 0002, Changed files)');
});

test('SW3: TAGS_PROPERTY_KEYS is the nine TAGS properties — story 1\'s edge keys minus type, from and to', () => {
  const keys = constant('TAGS_PROPERTY_KEYS');
  assert(Array.isArray(keys), `TAGS_PROPERTY_KEYS must be an array, got ${show(keys)}`);
  eq(keys.length, 9, 'TAGS_PROPERTY_KEYS length (nine, no repeats)');
  const nine = EDGE_KEYS.filter((k) => k !== 'type' && k !== 'from' && k !== 'to');
  same([...keys].sort(), nine, 'TAGS_PROPERTY_KEYS vs story 1\'s EDGE_KEYS minus type / from / to');
  same([...keys].sort(), Object.keys(edge()).filter((k) => k !== 'type' && k !== 'from' && k !== 'to').sort(), 'TAGS_PROPERTY_KEYS vs a live contract edge\'s keys');
});

test('SW4: LIMIT is the frozen pair { floor: 50, fraction: 10 } (AC-5: more than 50 and more than 10%; nothing configures it)', () => {
  const LIMIT = constant('LIMIT');
  same(LIMIT, { floor: 50, fraction: 10 }, 'LIMIT');
  assert(Object.isFrozen(LIMIT), 'LIMIT must be frozen (Object.freeze) — the limit never loosens');
});

test('SW5: the reason vocabularies are the rule table\'s — removals not-on-relay / non-tagging, left in place missing-address / not-a-tagging-address, changes newer / older / moved / refreshed / repaired', () => {
  const values = (name) => {
    const v = constant(name);
    assert(v && typeof v === 'object', `${name} must be an object of reason strings, got ${show(v)}`);
    return Object.values(v).sort();
  };
  same(values('REMOVAL_REASON'), ['non-tagging', 'not-on-relay'], 'REMOVAL_REASON values (report removedBy)');
  same(values('LEFT_REASON'), ['missing-address', 'not-a-tagging-address'], 'LEFT_REASON values (report leftInPlaceBy)');
  same(values('CHANGE_KIND'), ['moved', 'newer', 'older', 'refreshed', 'repaired'], 'CHANGE_KIND values (report changedBy)');
});

test('SW6: RUN_ID_RE accepts exactly the runner\'s grammar YYYYMMDDTHHMMSSZ-<8 lower-case hex> — no traversal, encoded slash, absolute path, NUL, trailing newline, upper-case hex or wrong length — and answers the same every time', () => {
  const RE = constant('RUN_ID_RE');
  assert(RE instanceof RegExp, `RUN_ID_RE must be a RegExp, got ${show(RE)}`);
  const valid = ['20260927T120000Z-0123abcd', '00000000T000000Z-00000000', '99991231T235959Z-ffffffff'];
  const invalid = [
    ['empty', ''],
    ['upper-case hex', '20260927T120000Z-0123ABCD'],
    ['7 hex characters', '20260927T120000Z-0123abc'],
    ['9 hex characters', '20260927T120000Z-0123abcde'],
    ['non-hex suffix', '20260927T120000Z-0123abcg'],
    ['no T', '20260927120000Z-0123abcd'],
    ['no Z', '20260927T120000-0123abcd'],
    ['no dash', '20260927T120000Z0123abcd'],
    ['ISO punctuation', '2026-09-27T12:00:00Z-0123abcd'],
    ['a ../ traversal', '../20260927T120000Z-0123abcd'],
    ['a trailing /..', '20260927T120000Z-0123abcd/..'],
    ['%2F-encoded slash', '..%2F20260927T120000Z-0123abcd'],
    ['an absolute path', '/etc/passwd'],
    ['an embedded NUL', '20260927T120000Z-0123abcd\u0000'],
    ['a trailing newline', '20260927T120000Z-0123abcd\n'],
    ['a leading space', ' 20260927T120000Z-0123abcd'],
    ['non-ASCII digits', '٢٠٢٦٠٩٢٧T120000Z-0123abcd'],
  ];
  // Array-valued query parameters are refused by the routes before RUN_ID_RE is consulted (a route concern).
  table('RUN_ID_RE', [...valid.map((v) => [`valid ${v}`, v, true]), ...invalid.map(([l, v]) => [l, v, false])], ([label, v, want]) => {
    eq(RE.test(v), want, `${label}: first test`);
    eq(RE.test(v), want, `${label}: second test (a g or y flag would make the answer depend on the last call)`);
  });
});

// ═══ Identities (AC-4) ═════════════════════════════════════════════════════════════════════════════════════════
test('SW7 (AC-4): checkIdentity names what is wrong with a stamp identity — missing (undefined, null, non-string), empty, not-64-hex, upper-case (any A–F) — and passes lower-case 64-hex', () => {
  const checkIdentity = fn('checkIdentity');
  const rows = [
    ['undefined', undefined, 'missing'],
    ['null', null, 'missing'],
    ['a number', 42, 'missing'],
    ['a boolean', true, 'missing'],
    ['an object', {}, 'missing'],
    ['an array holding a valid key', [LOCAL], 'missing'],
    ['a String object', new String(LOCAL), 'missing'], // eslint-disable-line no-new-wrappers
    ['the empty string', '', 'empty'],
    ['63 characters', LOCAL.slice(1), 'not-64-hex'],
    ['65 characters', `${LOCAL}5`, 'not-64-hex'],
    ['64 non-hex characters', 'g'.repeat(64), 'not-64-hex'],
    ['64 spaces', ' '.repeat(64), 'not-64-hex'],
    ['a leading space', ` ${LOCAL.slice(1)}`, 'not-64-hex'],
    ['a trailing newline', `${LOCAL}\n`, 'not-64-hex'],
    ['a 0x prefix', `0x${LOCAL.slice(2)}`, 'not-64-hex'],
    ['full-width letters', 'ａ'.repeat(64), 'not-64-hex'],
    ['63 upper-case hex characters', upperHex('ab'.repeat(32)).slice(1), 'not-64-hex'],
    ['64 characters mixing upper-case hex and a g', `${'AB'.repeat(31)}ag`, 'not-64-hex'],
    ['64 upper-case hex characters', upperHex(CANONICAL), 'upper-case'],
    ['mixed case', `${'ab'.repeat(31)}AB`, 'upper-case'],
    ['one upper-case letter', `F${'f'.repeat(63)}`, 'upper-case'],
    ['a lower-case key (local fixture)', LOCAL, null],
    ['a lower-case key (canonical fixture)', CANONICAL, null],
    ['every hex digit', '0123456789abcdef'.repeat(4), null],
  ];
  table('checkIdentity', rows, ([label, value, want]) => eq(checkIdentity(value), want, label));
});

// ═══ Addresses, the scan filter, the scan check ════════════════════════════════════════════════════════════════
test('SW8: isTaggingAddress is exactly the addresses the contract can produce — 39999:<64 lower-case hex>:<d of 1–255 UTF-8 bytes>, any character in d', () => {
  const isTaggingAddress = fn('isTaggingAddress');
  const rows = [
    ['the default tagging address', ADDRESS, true],
    ['a d of 255 ASCII bytes', addr('d'.repeat(255)), true],
    ['a d of 256 ASCII bytes', addr('d'.repeat(256)), false],
    ['a d of 255 bytes in 85 three-byte characters', addr('€'.repeat(85)), true],
    ['a d of 258 bytes in 86 three-byte characters', addr('€'.repeat(86)), false],
    ['a d of 255 bytes mixing ASCII and three-byte characters', addr(`profile-tag-${'€'.repeat(81)}`), true],
    ['an empty d', addr(''), false],
    ['no d part', `39999:${ALICE}`, false],
    ['a colon inside d', addr('a:b'), true],
    ['a newline inside d', addr('x\ny'), true],
    ['a d that is only a newline', addr('\n'), true],
    ['a d that is one space', addr(' '), true],
    ['an upper-case pubkey', `39999:${upperHex('ab'.repeat(32))}:x`, false],
    ['a mixed-case pubkey', `39999:${'ab'.repeat(31)}AB:x`, false],
    ['a 63-hex pubkey', `39999:${ALICE.slice(1)}:x`, false],
    ['a 65-hex pubkey', `39999:${ALICE}2:x`, false],
    ['kind 39998', `39998:${ALICE}:x`, false],
    ['kind with a leading 0', `039999:${ALICE}:x`, false],
    ['a leading space', ` ${ADDRESS}`, false],
    ['null', null, false],
    ['undefined', undefined, false],
    ['a number', 39999, false],
    ['an array holding a tagging address', [ADDRESS], false],
    ['an object whose toString is a tagging address', { toString: () => ADDRESS }, false],
  ];
  table('isTaggingAddress', rows, ([label, a, want]) => eq(isTaggingAddress(a), want, label));
});

test('SW9 (AC-1, ADR D2): sweepFilter is one full scan — kinds [39999] and the four #z stamps from the two identities, with no since, until, limit, authors or ids', () => {
  const sweepFilter = fn('sweepFilter');
  const f = sweepFilter({ canonicalPubkey: CANONICAL, localPubkey: LOCAL });
  same(Object.keys(f).sort(), ['#z', 'kinds'], 'filter keys (a full read: late arrivals of any created_at are picked up; kind 5 is not read)');
  same(f.kinds, [39999], 'kinds');
  eq(f['#z'].length, 4, '#z length');
  same([...f['#z']].sort(), [...fourStamps(IDENTITIES)].sort(), '#z: canonical and local nostr-user-tag, canonical and local tag');
  const g = sweepFilter({ canonicalPubkey: OTHER_DEPLOY, localPubkey: JACK });
  same([...g['#z']].sort(), [...fourStamps({ canonicalPubkey: OTHER_DEPLOY, localPubkey: JACK })].sort(), 'the stamps follow the identities passed in (no pubkey is built in)');
});

test('SW10: sweepFilter de-duplicates the stamps when the two identities are the same pubkey', () => {
  const f = fn('sweepFilter')({ canonicalPubkey: CANONICAL, localPubkey: CANONICAL });
  same([...f['#z']].sort(), [STAMP(CANONICAL), TAG_STAMP(CANONICAL)].sort(), '#z with equal identities');
  same(f.kinds, [39999], 'kinds');
});

test('SW11: isExpectedScanEvent accepts a kind-39999 event carrying a z among the filter\'s stamps, and nothing else', () => {
  const isExpected = fn('isExpectedScanEvent');
  const filter = { kinds: [39999], '#z': fourStamps(IDENTITIES) };
  const onlyCanonical = { kinds: [39999], '#z': [Z.canonicalTagging] };
  const rows = [
    ['a tagging with the canonical stamp', makeTagging(), filter, true],
    ['a tagging with only the local stamp', makeTagging({ stamps: [Z.localTagging] }), filter, true],
    ['a tagging with both stamps', makeTagging({ stamps: [Z.canonicalTagging, Z.localTagging] }), filter, true],
    ['a tag element with the canonical tag stamp', makeElement(), filter, true],
    ['a tag element with the local tag stamp', makeElement({ stamps: [Z.localTag] }), filter, true],
    ['a tagging stamped only by another deployment', makeTagging({ stamps: [STAMP(OTHER_DEPLOY)] }), filter, false],
    ['a tagging with no z at all', makeTagging({ stamps: [] }), filter, false],
    ['a kind-1 event with the canonical stamp', makeTagging({ kind: 1 }), filter, false],
    ['a kind-5 deletion', makeDeletion({ e: [idOf(0x100)] }), filter, false],
    ['a non-string z value', makeTagging({ stamps: [], extraTags: [['z', 5]] }), filter, false],
    ['a kind-39999 event with no tags array', { id: idOf(1), pubkey: ALICE, created_at: 1, kind: 39999 }, filter, false],
    ['the local stamp against a filter that asked only for the canonical one', makeTagging({ stamps: [Z.localTagging] }), onlyCanonical, false],
  ];
  table('isExpectedScanEvent', rows, ([label, ev, f, want]) => eq(isExpected(ev, f), want, label));
});

// ═══ Reading the relay's scan ══════════════════════════════════════════════════════════════════════════════════
/** decideAddress(null, what readRelay holds at `a`) must be a create; its desired state. */
function relayCreates(rr, a) {
  const d = fn('decideAddress')(null, entryAt(rr.byAddress, a));
  eq(d && d.action, 'create', `decideAddress(null, readRelay(…).byAddress at ${a}).action`);
  return d.desired;
}

test('SW12 (AC-1): readRelay runs every event carrying either nostr-user-tag stamp through the contract, by address, and counts them as taggingsRead; a tag element is not a tagging', () => {
  const readRelay = fn('readRelay');
  assert(IDENTITIES.canonicalPubkey !== IDENTITIES.localPubkey, 'fixture: the canonical and local identities must differ');
  const el = makeElement();
  const el2 = makeElement({ id: idOf('el2'), d: 'musician', stamps: [Z.localTag] });
  const tc = makeTagging({ d: 'r-canon', id: idOf('r-canon') });
  const tl = makeTagging({ d: 'r-local', id: idOf('r-local'), stamps: [Z.localTagging] });
  const tb = makeTagging({ d: 'r-both', id: idOf('r-both'), stamps: [Z.canonicalTagging, Z.localTagging] });
  const rr = readRelay([tc, el, tl, el2, tb], IDENTITIES);
  eq(rr.taggingsRead, 3, 'taggingsRead (scanned events carrying either nostr-user-tag stamp)');
  eq(rr.refused && rr.refused.total, 0, 'refused.total (a tag element is not a refused tagging)');
  const opts = withElements(el, el2);
  for (const [ev, flags] of [[tc, [true, false]], [tl, [false, true]], [tb, [true, true]]]) {
    const desired = relayCreates(rr, contractEdge(ev, opts).address);
    sameState(desired, contractEdge(ev, opts), `the relay's state at ${contractEdge(ev, opts).address} is the contract's edge`);
    same([stateOf(desired).zCanonical, stateOf(desired).zLocal], flags, `zCanonical / zLocal for ${ev.tags[0][1]}`);
  }
  eq(entryAt(rr.byAddress, `39999:${JACK}:podcaster`), undefined, 'a tag element\'s own address holds nothing (it is not a tagging)');
  eq(entryAt(rr.byAddress, `39999:${JACK}:musician`), undefined, 'the local-stamped element\'s address holds nothing');
  const only = readRelay([el, el2], IDENTITIES);
  eq(only.taggingsRead, 0, 'elements only: taggingsRead');
  eq(only.tagElementsRead, 2, 'elements only: tagElementsRead');
  eq(only.refused && only.refused.total, 0, 'elements only: refused.total');
  eq(sizeOf(only.byAddress), 0, 'elements only: byAddress is empty');
});

test('SW13 (AC-1): readRelay feeds every scanned event to the contract as tagElementsById — an id-only tagging resolves against an element listed after it, stays unresolved when the element is absent, and never resolves against a tagging', () => {
  const readRelay = fn('readRelay');
  const t1 = makeTagging({ d: 'r-idonly', a: null, id: idOf('r1') });                              // names TAG_V1
  const t2 = makeTagging({ d: 'r-absent', a: null, e: idOf('absent-element'), id: idOf('r2') });  // element not scanned
  const t3 = makeTagging({ d: 'r-names-tagging', a: null, e: idOf('r1'), id: idOf('r3') });       // e names t1, a tagging
  const rr = readRelay([t1, t2, t3, makeElement()], IDENTITIES);                                   // element last
  sameState(relayCreates(rr, addr('r-idonly')), contractEdge(t1, withElements(makeElement())), 'id-only tagging resolved from the scanned element');
  eq(stateOf(relayCreates(rr, addr('r-idonly'))).tagAddress, TAG_ADDR, 'resolved tagAddress');
  same(pick(stateOf(relayCreates(rr, addr('r-absent'))), ['tagAddress', 'tagSlug', 'tagEventId']),
    { tagAddress: null, tagSlug: null, tagEventId: idOf('absent-element') }, 'element absent: unresolved, id kept');
  same(pick(stateOf(relayCreates(rr, addr('r-names-tagging'))), ['tagAddress', 'tagSlug']),
    { tagAddress: null, tagSlug: null }, 'e names a tagging (no tag stamp): the contract\'s own checks leave it unresolved');
});
function pick(o, keys) { return keys.reduce((x, k) => { x[k] = o ? o[k] : undefined; return x; }, {}); }

test('SW14 (AC-7): readRelay counts refused taggings by reason — with or without an address — and a refusal that carries an address stands there as a non-tagging version', () => {
  const readRelay = fn('readRelay');
  const decideAddress = fn('decideAddress');
  const events = [
    makeNonTagging({ address: addr('nt-1'), refusal: 'no-target', id: idOf('nt1') }),
    makeNonTagging({ address: addr('nt-2'), refusal: 'bad-target', id: idOf('nt2') }),
    makeNonTagging({ address: addr('nt-3'), refusal: 'several-tag-references', id: idOf('nt3') }),
    makeTagging({ d: null, id: idOf('nd') }),                           // no-d: refused before it has an address
    makeTagging({ d: 'ne', id: upperHex('ab'.repeat(32)) }),            // not-an-event: an upper-case id
    makeTagging({ d: 'ok', id: idOf('ok') }),
  ];
  const rr = readRelay(events, IDENTITIES);
  eq(rr.taggingsRead, 6, 'taggingsRead');
  eq(rr.refused && rr.refused.total, 5, 'refused.total');
  same(nonZeroCounts(rr.refused.byReason), { 'no-target': 1, 'bad-target': 1, 'several-tag-references': 1, 'no-d': 1, 'not-an-event': 1 }, 'refused.byReason');
  for (const d of ['nt-1', 'nt-2', 'nt-3']) {
    const at = entryAt(rr.byAddress, addr(d));
    assert(at !== undefined, `the refusal at ${addr(d)} must stand at its address (never absent: that would read as "nothing on the relay")`);
    const stored = storedRowFor(makeTagging({ d, id: idOf(`${d}:earlier`), createdAt: 500 }));
    const dec = decideAddress(stored, at);
    same({ action: dec.action, reason: dec.reason }, { action: 'remove', reason: 'non-tagging' }, `a relationship at ${addr(d)} against the relay's non-tagging version`);
  }
  eq(entryAt(rr.byAddress, addr('ne')), undefined, 'a not-an-event refusal stands at no address');
  eq(sizeOf(rr.byAddress), 4, 'byAddress holds the three refusals with an address and the accepted tagging');
});

test('SW15 (ADR: "never left absent"): readRelay marks an address holding more than one scanned version — accepted or refused — as a conflict, keeps it present, and counts each such address once in anomalies.sameAddressConflicts', () => {
  const readRelay = fn('readRelay');
  const events = [
    makeTagging({ d: 'c-1', id: idOf('c1a'), createdAt: 2000 }),
    makeNonTagging({ address: addr('c-1'), id: idOf('c1b'), createdAt: 3000 }),
    makeNonTagging({ address: addr('c-2'), refusal: 'no-target', id: idOf('c2a') }),
    makeNonTagging({ address: addr('c-2'), refusal: 'bad-target', id: idOf('c2b') }),
    makeTagging({ d: 'c-3', id: idOf('c3a'), createdAt: 2000 }),
    makeTagging({ d: 'c-3', id: idOf('c3b'), createdAt: 3000, polarity: '-1' }),
    makeTagging({ d: 'c-5', id: idOf('c5a') }),
    makeTagging({ d: 'c-5', id: idOf('c5b'), createdAt: 1100 }),
    makeTagging({ d: 'c-5', id: idOf('c5c'), createdAt: 1200 }),
    makeTagging({ d: 'c-4', id: idOf('c4') }),
  ];
  const rr = readRelay(events, IDENTITIES);
  eq(rr.taggingsRead, 10, 'taggingsRead counts every scanned tagging version');
  eq(rr.anomalies && rr.anomalies.sameAddressConflicts, 4, 'anomalies.sameAddressConflicts (c-1, c-2, c-3 and c-5; three versions at c-5 count once)');
  for (const d of ['c-1', 'c-2', 'c-3', 'c-5']) assert(entryAt(rr.byAddress, addr(d)) !== undefined, `${addr(d)} is a conflict and must not be left absent`);
  sameState(relayCreates(rr, addr('c-4')), contractEdge(events[9]), 'the single version at c-4 is read as usual');
});

// ═══ Stored rows and the guard's fingerprint ═══════════════════════════════════════════════════════════════════
test('SW16: storedFromRow reads a correctly written row as a well-formed edge with the contract\'s values and its ends, stripping nothing', () => {
  const storedFromRow = fn('storedFromRow');
  const cases = [
    ['address and id', makeTagging(), IDENTITIES],
    ['address only', makeTagging({ e: null }), IDENTITIES],
    ['id only, unresolved', makeTagging({ a: null }), IDENTITIES],
    ['id only, resolved', makeTagging({ a: null }), withElements(makeElement())],
    ['absent stance', makeTagging({ polarity: null }), IDENTITIES],
    ['local stamp only', makeTagging({ stamps: [Z.localTagging] }), IDENTITIES],
    ['created_at 0', makeTagging({ createdAt: 0 }), IDENTITIES],
  ];
  table('storedFromRow of a correct row', cases, ([label, ev, opts]) => {
    const E = contractEdge(ev, opts);
    const r = storedFromRow(storedRow(E));
    eq(r && r.wellFormed, true, `${label}: wellFormed`);
    assert(Array.isArray(r.problems) && r.problems.length === 0, `${label}: problems must be an empty array, got ${show(r.problems)}`);
    same(r.strippedKeys, [], `${label}: strippedKeys`);
    sameState(r.edge, E, `${label}: edge`);
  });
});

/** Ways a stored createdAt can be malformed (R2-NB1; ADR D5: anything but INTEGER NOT NULL and ≥ 0). */
const MALFORMED_CREATED_AT = [
  ['missing', { missing: ['createdAt'] }],
  ['null (reads back missing)', { set: { createdAt: null } }],
  ['the string "abc"', { set: { createdAt: 'abc' } }],
  ['the numeric string "1000"', { set: { createdAt: '1000' } }],
  ['NaN', { raw: { createdAt: ['FLOAT NOT NULL', 'NaN', null] } }],
  ['FLOAT 1000.0', { floatCreatedAt: true }],
  ['the boolean true', { set: { createdAt: true } }],
  ['the list [1000]', { set: { createdAt: [1000] } }],
  ['the negative integer -1', { set: { createdAt: -1 } }],
];

test('SW17 (R2-NB1): storedFromRow reads a stored createdAt that is not a non-negative INTEGER — missing, null, "abc", "1000", NaN, FLOAT, true, a list, negative — as not well-formed, naming a problem', () => {
  const storedFromRow = fn('storedFromRow');
  const E = edge();
  table('storedFromRow with a malformed createdAt', MALFORMED_CREATED_AT, ([label, spoil]) => {
    let r;
    try { r = storedFromRow(storedRow(E, spoil)); } catch (e) { throw new Error(`${label}: threw ${e.message}`); }
    eq(r && r.wellFormed, false, `${label}: wellFormed`);
    assert(Array.isArray(r.problems) && r.problems.length > 0, `${label}: problems must name what is wrong, got ${show(r.problems)}`);
    same(r.strippedKeys, [], `${label}: strippedKeys (createdAt is one of the nine, repaired rather than stripped)`);
  });
});

test('SW18 (AC-8): storedFromRow lists every key outside the nine as strippedKeys — names only, never values', () => {
  const storedFromRow = fn('storedFromRow');
  const r = storedFromRow(storedRow(edge(), { extra: { timestamp: 1234567, trust: 0.25, notes: ['secret-note'] } }));
  assert(Array.isArray(r.strippedKeys), `strippedKeys must be an array, got ${show(r.strippedKeys)}`);
  same([...r.strippedKeys].sort(), ['notes', 'timestamp', 'trust'], 'strippedKeys');
  assert(r.strippedKeys.every((k) => typeof k === 'string'), `strippedKeys must hold key names only, got ${show(r.strippedKeys)}`);
  const text = exact(r.strippedKeys);
  assert(!text.includes('secret-note') && !text.includes('1234567') && !text.includes('0.25'), `strippedKeys must not carry values: ${text}`);
});

test('SW19 (ADR D4, guard step 4): fingerprint is a string, the same for equal rows, and independent of the order READ_ALL returns the properties in', () => {
  const fingerprint = fn('fingerprint');
  const row = storedRowFor(makeTagging());
  const a = fingerprint(row);
  eq(typeof a, 'string', 'typeof fingerprint (compared with ===)');
  eq(fingerprint(JSON.parse(JSON.stringify(row))), a, 'a deep copy of the same row');
  eq(fingerprint({ ...row, props: [...row.props].reverse() }), a, 'the same properties in reverse order');
  const listRow = storedRow(edge(), { extra: { notes: ['a', 'b'] } });
  eq(fingerprint(storedRow(edge(), { extra: { notes: ['a', 'b'] } })), fingerprint(listRow), 'equal list values in different array objects');
});

test('SW20 (ADR D4, guard step 4): fingerprint changes with the element id, either end\'s pubkey, pubkey type or NostrUser label, and any property\'s value, type or presence', () => {
  const fingerprint = fn('fingerprint');
  const E = edge();
  const row = storedRow(E);
  const base = fingerprint(row);
  const variants = [
    ['another element id', storedRow(E, { rid: '5:fixture:another' })],
    ['another from pubkey', storedRow(E, { fromPubkey: CAROL })],
    ['from pubkey typed as a list', { ...row, fromPubkeyType: 'LIST<STRING NOT NULL> NOT NULL' }],
    ['from end not a NostrUser', storedRow(E, { wrongEndLabel: 'from' })],
    ['another to pubkey', storedRow(E, { toPubkey: CAROL })],
    ['to pubkey missing (type NULL)', storedRow(E, { toPubkey: null })],
    ['to end not a NostrUser', storedRow(E, { wrongEndLabel: 'to' })],
    ['another stance', storedRow(E, { set: { polarity: '-1' } })],
    ['createdAt typed STRING with the same text', storedRow(E, { set: { createdAt: '1000' } })],
    ['createdAt typed FLOAT', storedRow(E, { floatCreatedAt: true })],
    ['an added key', storedRow(E, { extra: { note: 'x' } })],
    ['a removed key', storedRow(E, { missing: ['polarity'] })],
    ['two values swapped between keys', storedRow(E, { set: { polarity: 'podcaster', tagSlug: '1' } })],
    ['a boolean typed STRING with the same text', storedRow(E, { set: { zCanonical: 'true' } })],
  ];
  table('fingerprint must differ from the written row\'s', variants, ([label, v]) => {
    assert(fingerprint(v) !== base, `${label}: fingerprint unchanged`);
  });
});

test('SW21 (ADR D4, guard step 4): fingerprint serialises non-scalar values canonically — a changed list is detected, strings are JSON-quoted element by element, and big integers stay exact', () => {
  const fingerprint = fn('fingerprint');
  const E = edge();
  const withList = (xs, type = 'LIST<STRING NOT NULL> NOT NULL') => storedRow(E, { raw: { notes: [type, null, xs] } });
  const intLike = (s) => ({ low: 0, high: 0, toString: () => s, toNumber: () => Number(s) });
  const pairs = [
    ['a list that gained an element (changed between snapshot and re-read)', withList(['a', 'b']), withList(['a', 'b', 'c'])],
    ['["a,b"] against ["a","b"]', withList(['a,b']), withList(['a', 'b'])],
    ['[\'a", "b\'] against ["a","b"] (only JSON quoting tells them apart)', withList(['a", "b']), withList(['a', 'b'])],
    ['2^53+1 against 2^53 as BigInts', withList([9007199254740993n], 'LIST<INTEGER NOT NULL> NOT NULL'), withList([9007199254740992n], 'LIST<INTEGER NOT NULL> NOT NULL')],
    ['2^53+1 against 2^53 as driver Integers', withList([intLike('9007199254740993')], 'LIST<INTEGER NOT NULL> NOT NULL'), withList([intLike('9007199254740992')], 'LIST<INTEGER NOT NULL> NOT NULL')],
    ['a raw temporal-like value that changed', storedRow(E, { raw: { seen: ['DATE NOT NULL', null, { toString: () => '2026-09-27' }] } }), storedRow(E, { raw: { seen: ['DATE NOT NULL', null, { toString: () => '2026-09-28' }] } })],
  ];
  table('fingerprints must differ', pairs, ([label, x, y]) => assert(fingerprint(x) !== fingerprint(y), `${label}: fingerprints equal`));
  eq(fingerprint(withList([intLike('9007199254740993')], 'LIST<INTEGER NOT NULL> NOT NULL')),
    fingerprint(withList([intLike('9007199254740993')], 'LIST<INTEGER NOT NULL> NOT NULL')), 'equal driver Integers in different objects fingerprint the same');
});

// ═══ The desired state ═════════════════════════════════════════════════════════════════════════════════════════
test('SW22: desiredFor is the relay edge\'s nine properties with ends from → to and nothing else — except that the same version keeps a stored, well-formed resolution its relay copy lacks', () => {
  const desiredFor = fn('desiredFor');
  const E = edge();
  const d0 = desiredFor(null, E);
  sameState(d0, E, 'desiredFor(null, E)');
  same(keysOutsideNine(d0), [], 'desiredFor(null, E) writes no key outside the nine');
  const v1 = edge({ id: idOf(0x10), createdAt: 100 });
  const v2 = edge({ id: idOf(0x20), createdAt: 200, polarity: '-1', stamps: [Z.canonicalTagging, Z.localTagging] });
  sameState(desiredFor(storedRow(v1), v2), v2, 'desiredFor(stored v1, relay v2) is v2');
  const resolved = edge({ a: null }, withElements(makeElement()));
  const unresolved = edge({ a: null });
  const kept = desiredFor(storedRow(resolved), unresolved);
  sameState(kept, resolved, 'same version, the element gone from the relay: the stored resolution is kept');
  const notKept = desiredFor(storedRow(resolved, { set: { tagEventId: idOf(0x7002) } }), unresolved);
  sameState(notKept, unresolved, 'stored tagEventId differs from the relay\'s: the resolution is not kept');
  same(keysOutsideNine(desiredFor(storedRow(E, { extra: { timestamp: 5 } }), E)), [], 'an extra stored key never reaches desired');
});

// ═══ The rule for one address (decideAddress) ═════════════════════════════════════════════════════════════════
test('SW23 (AC-3): a TAGS row whose address is missing, not a string, or not a tagging address is left in place, by reason — the relay is not consulted', () => {
  const decideAddress = fn('decideAddress');
  const E = edge();
  const rows = [
    ['address missing', storedRow(E, { address: null }), 'missing-address'],
    ['a 39998 address', storedRow(E, { nonTaggingAddress: true }), 'not-a-tagging-address'],
    ['an upper-case pubkey', storedRow(E, { address: `39999:${upperHex('ab'.repeat(32))}:${D}` }), 'not-a-tagging-address'],
    ['an empty d', storedRow(E, { address: `39999:${ALICE}:` }), 'not-a-tagging-address'],
    ['a 256-byte d', storedRow(E, { address: addr('L'.repeat(256)) }), 'not-a-tagging-address'],
    ['the string "garbage"', storedRow(E, { address: 'garbage' }), 'not-a-tagging-address'],
  ];
  const nonString = [
    ['a list holding a tagging address', storedRow(E, { raw: { address: ['LIST<STRING NOT NULL> NOT NULL', null, [ADDRESS]] } })],
    ['an INTEGER', storedRow(E, { raw: { address: ['INTEGER NOT NULL', '39999', null] } })],
  ];
  const relays = [['nothing on the relay', null], ['an edge on the relay', E], ['a non-tagging on the relay', refusalOf(makeNonTagging({ id: idOf(0x200), createdAt: 2000 }))]];
  const cases = [];
  for (const [l, row, reason] of rows) for (const [rl, at] of relays) cases.push([`${l}, ${rl}`, row, at, reason]);
  for (const [l, row] of nonString) for (const [rl, at] of relays) cases.push([`${l}, ${rl}`, row, at, null]);
  table('leave', cases, ([label, row, at, reason]) => {
    const d = decideAddress(row, at);
    eq(d && d.action, 'leave', `${label}: action`);
    if (reason) eq(d.reason, reason, `${label}: reason`);
    else assert(['missing-address', 'not-a-tagging-address'].includes(d.reason), `${label}: reason must be missing-address or not-a-tagging-address, got ${show(d.reason)}`);
  });
});

test('SW24 (AC-1): with no relationship at the address, an accepted edge is created with the contract\'s values, and a refusal or nothing changes nothing', () => {
  const decideAddress = fn('decideAddress');
  const E = edge();
  for (const none of [null, undefined]) {
    const d = decideAddress(none, E);
    eq(d && d.action, 'create', `decideAddress(${none}, E).action`);
    sameState(d.desired, E, `decideAddress(${none}, E).desired`);
    same(keysOutsideNine(d.desired), [], 'a created relationship carries only the nine properties (AC-8)');
  }
  table('no relationship, no accepted edge', [
    ...Object.keys(NON_TAGGING).map((r) => [`a ${r} refusal`, refusalOf(makeNonTagging({ refusal: r }))]),
    ['nothing (null)', null],
    ['nothing (undefined)', undefined],
  ], ([label, at]) => eq(decideAddress(null, at).action, 'none', `${label}: action`));
});

test('SW25 (AC-3, R2-NB3): a relationship at a tagging address is removed when the relay holds nothing there (not-on-relay) or holds a version the definition refuses, whatever its age (non-tagging)', () => {
  const decideAddress = fn('decideAddress');
  const E = edge();
  const row = storedRow(E);
  const gone = [
    ['a correct row', row],
    ['a row with a FLOAT createdAt', storedRow(E, { floatCreatedAt: true })],
    ['a row whose to end is not a NostrUser', storedRow(E, { wrongEndLabel: 'to' })],
    ['a row with an extra key', storedRow(E, { extra: { timestamp: 5 } })],
  ];
  const cases = [];
  for (const [l, r] of gone) for (const nothing of [null, undefined]) cases.push([`${l}, relay ${nothing}`, r, nothing, 'not-on-relay']);
  for (const refusal of Object.keys(NON_TAGGING)) {
    cases.push([`a newer ${refusal} version`, row, refusalOf(makeNonTagging({ refusal, id: idOf(0x200), createdAt: 2000 })), 'non-tagging']);
  }
  cases.push(['an OLDER non-tagging version (the relay\'s current one)', row, refusalOf(makeNonTagging({ id: idOf(0x050), createdAt: 500 })), 'non-tagging']);
  cases.push(['a non-tagging filed under the address after a 256-byte first d', row, refusalOf(makeTagging({ d: 'L'.repeat(256), extraDTags: [D], target: null, id: idOf(0x201), createdAt: 2000 })), 'non-tagging']);
  cases.push(['a non-tagging filed under the address after a 258-byte first d', row, refusalOf(makeTagging({ d: '€'.repeat(86), extraDTags: [D], target: null, id: idOf(0x202), createdAt: 2000 })), 'non-tagging']);
  table('remove', cases, ([label, r, at, reason]) => {
    const d = decideAddress(r, at);
    same({ action: d && d.action, reason: d && d.reason }, { action: 'remove', reason }, label);
  });
});

test('SW26 (AC-2): a relationship exactly equal to the relay\'s version — key set, values, types, NostrUser ends — is unchanged (action none)', () => {
  const decideAddress = fn('decideAddress');
  const cases = [
    ['address and id', makeTagging(), IDENTITIES],
    ['address only', makeTagging({ e: null }), IDENTITIES],
    ['id only, unresolved', makeTagging({ a: null }), IDENTITIES],
    ['id only, resolved from its element', makeTagging({ a: null }), withElements(makeElement())],
    ['absent stance', makeTagging({ polarity: null }), IDENTITIES],
    ['a neutral stance', makeTagging({ polarity: '0' }), IDENTITIES],
    ['local stamp only', makeTagging({ stamps: [Z.localTagging] }), IDENTITIES],
    ['both stamps', makeTagging({ stamps: [Z.canonicalTagging, Z.localTagging] }), IDENTITIES],
    ['a self-tagging', makeTagging({ target: ALICE }), IDENTITIES],
    ['created_at 0', makeTagging({ createdAt: 0 }), IDENTITIES],
  ];
  table('unchanged', cases, ([label, ev, opts]) => {
    const E = contractEdge(ev, opts);
    eq(decideAddress(storedRow(E), E).action, 'none', `${label}: action`);
    eq(decideAddress(storedRow(E, { rid: '5:fixture:any' }), E).action, 'none', `${label}, any element id: action`);
    const row = storedRow(E);
    eq(decideAddress({ ...row, props: [...row.props].reverse() }, E).action, 'none', `${label}, properties in another order: action`);
  });
});

test('SW27 (AC-2, AC-8): with the right ends, any other difference — a value, a type, a missing or an extra key — is an update to exactly the relay\'s version', () => {
  const decideAddress = fn('decideAddress');
  const E = edge();
  const spoils = [
    ['createdAt stored as FLOAT 1000.0', { floatCreatedAt: true }],
    ['createdAt stored as the string "1000"', { set: { createdAt: '1000' } }],
    ['createdAt missing', { missing: ['createdAt'] }],
    ['polarity stored as the INTEGER 1', { set: { polarity: 1 } }],
    ['polarity missing while the relay says "1"', { missing: ['polarity'] }],
    ['zCanonical stored as the string "true"', { set: { zCanonical: 'true' } }],
    ['zLocal missing', { missing: ['zLocal'] }],
    ['tagSlug in another case', { set: { tagSlug: 'Podcaster' } }],
    ['eventId missing', { missing: ['eventId'] }],
    ['an extra key "timestamp"', { extra: { timestamp: 1000 } }],
    ['an extra key "trust"', { extra: { trust: 0.5 } }],
    ['a list-valued extra key', { extra: { notes: ['x'] } }],
  ];
  const cases = spoils.map(([l, s]) => [l, storedRow(E, s), E]);
  cases.push(['the relay\'s version has no stance while the stored one says "1"', storedRow(E), edge({ polarity: null })]);
  table('update', cases, ([label, row, relay]) => {
    const d = decideAddress(row, relay);
    eq(d && d.action, 'update', `${label}: action`);
    sameState(d.desired, relay, `${label}: desired`);
    same(keysOutsideNine(d.desired), [], `${label}: desired writes no key outside the nine`);
  });
});

test('SW28 (AC-2): when the ends are not NostrUser from → NostrUser to — a new target, an end without the label, a wrong or mis-typed pubkey — the relationship moves to the relay\'s ends (label moved)', () => {
  const decideAddress = fn('decideAddress');
  const E = edge();
  const row = storedRow(E);
  const LOWER = 'ab'.repeat(32);
  const toLower = edge({ target: LOWER });
  const cases = [
    ['the relay\'s newer version names Carol', row, edge({ id: idOf(0x200), createdAt: 2000, target: CAROL })],
    ['the relay\'s OLDER version names Carol', row, edge({ id: idOf(0x050), createdAt: 500, target: CAROL })],
    ['the from end is not a NostrUser', storedRow(E, { wrongEndLabel: 'from' }), E],
    ['the to end is not a NostrUser', storedRow(E, { wrongEndLabel: 'to' }), E],
    ['neither end is a NostrUser', storedRow(E, { wrongEndLabel: 'both' }), E],
    ['the to end\'s pubkey is stored upper-case', storedRow(toLower, { toPubkey: upperHex(LOWER) }), toLower],
    ['the from end has no pubkey (type NULL)', storedRow(E, { fromPubkey: null }), E],
    ['the to end\'s pubkey is a list holding the right pubkey', { ...row, toPubkey: [BOB], toPubkeyType: 'LIST<STRING NOT NULL> NOT NULL' }, E],
    ['the ends are swapped', storedRow(E, { fromPubkey: BOB, toPubkey: ALICE }), E],
    ['the same version, pointing at Carol', storedRow(E, { toPubkey: CAROL }), E],
    ['a malformed stored edge whose target changed', storedRow(E, { floatCreatedAt: true }), edge({ id: idOf(0x200), createdAt: 2000, target: CAROL })],
  ];
  table('move', cases, ([label, r, relay]) => {
    const d = decideAddress(r, relay);
    same({ action: d && d.action, label: d && d.label }, { action: 'move', label: 'moved' }, `${label}: action and label`);
    sameState(d.desired, relay, `${label}: desired (ends ${relay.from.slice(0, 4)}… → ${relay.to.slice(0, 4)}…)`);
  });
});

test('SW29 (ADR "Reported as"): an update is labelled newer or older by NIP-01 order on a well-formed stored edge, refreshed for the same version, repaired for a malformed stored edge — and follows the relay either way', () => {
  const decideAddress = fn('decideAddress');
  const v1 = edge({ id: idOf(0x10), createdAt: 100, polarity: '1' });
  const v2 = edge({ id: idOf(0x20), createdAt: 200, polarity: '-1' });
  const lo = edge({ id: idOf(0x0a), createdAt: 300 });
  const hi = edge({ id: idOf(0x0b), createdAt: 300, polarity: '0' });
  const unresolved = edge({ a: null });
  const resolved = edge({ a: null }, withElements(makeElement()));
  const both = makeTagging({ stamps: [Z.canonicalTagging, Z.localTagging] });
  const seenHere = contractEdge(both);
  const seenWithOtherLocal = contractEdge(both, { canonicalPubkey: CANONICAL, localPubkey: OTHER_DEPLOY });
  const cases = [
    ['a newer version', storedRow(v1), v2, ['newer']],
    ['an older version (revoked by id, older one re-sent)', storedRow(v2), v1, ['older']],
    ['equal created_at, the relay\'s id lower', storedRow(hi), lo, ['newer']],
    ['equal created_at, the relay\'s id higher', storedRow(lo), hi, ['older']],
    ['the same version, now resolvable', storedRow(unresolved), resolved, ['refreshed']],
    ['the same version, a stamp flag flipped', storedRow(seenHere), seenWithOtherLocal, ['refreshed']],
    ['the same version, FLOAT createdAt', storedRow(v1, { floatCreatedAt: true }), v1, ['repaired']],
    ['a newer version over a stored edge with no createdAt', storedRow(v1, { missing: ['createdAt'] }), v2, ['repaired']],
    ['an older version over a stored edge with createdAt "abc"', storedRow(v2, { set: { createdAt: 'abc' } }), v1, ['repaired']],
    ['the same version with an extra key', storedRow(v1, { extra: { timestamp: 5 } }), v1, ['refreshed', 'repaired']],
  ];
  table('update labels', cases, ([label, row, relay, labels]) => {
    const d = decideAddress(row, relay);
    eq(d && d.action, 'update', `${label}: action`);
    assert(labels.includes(d.label), `${label}: label\n          expected: ${labels.join(' or ')}\n          actual:   ${show(d.label)}`);
    sameState(d.desired, relay, `${label}: desired is the relay's version`);
  });
});

test('SW30 (owner decision 10): the same version keeps a stored resolution the relay can no longer give — same eventId and tagEventId, the relay copy unresolved, the stored tag address well-formed — even on an otherwise malformed stored edge', () => {
  const decideAddress = fn('decideAddress');
  const resolved = edge({ a: null }, withElements(makeElement()));
  const unresolved = edge({ a: null });
  eq(decideAddress(storedRow(resolved), unresolved).action, 'none', 'the element vanished from the relay: the resolved relationship is unchanged');
  const repaired = decideAddress(storedRow(resolved, { floatCreatedAt: true }), unresolved);
  eq(repaired.action, 'update', 'FLOAT createdAt, element gone: action');
  same(pick(comparable(repaired.desired), ['tagAddress', 'tagSlug', 'tagEventId', 'createdAt']),
    { tagAddress: TAG_ADDR, tagSlug: 'podcaster', tagEventId: TAG_V1, createdAt: 'integer 1000' }, 'FLOAT createdAt, element gone: resolution kept, createdAt repaired');
  const both = makeTagging({ a: null, stamps: [Z.canonicalTagging, Z.localTagging] });
  const storedElsewhere = contractEdge(both, { canonicalPubkey: CANONICAL, localPubkey: OTHER_DEPLOY, tagElementsById: new Map([[TAG_V1, makeElement()]]) });
  const relayNow = contractEdge(both);
  const flipped = decideAddress(storedRow(storedElsewhere), relayNow);
  eq(flipped.action, 'update', 'stamp flag changed, element gone: action');
  same(pick(stateOf(flipped.desired), ['tagAddress', 'tagSlug', 'zCanonical', 'zLocal']),
    { tagAddress: TAG_ADDR, tagSlug: 'podcaster', zCanonical: true, zLocal: true }, 'stamp flags follow the relay; the resolution is kept');
});

test('SW31 (owner decision 10): the stored resolution is not kept when the stored tagEventId or eventId differs, when the relay\'s version is itself resolved, or when the stored tag address is not well-formed', () => {
  const decideAddress = fn('decideAddress');
  const resolved = edge({ a: null }, withElements(makeElement()));
  const unresolved = edge({ a: null });
  const UNRESOLVED = { tagAddress: null, tagSlug: null, tagEventId: TAG_V1 };
  const cases = [
    ['the stored tagEventId differs', storedRow(resolved, { set: { tagEventId: idOf(0x7002) } }), unresolved, UNRESOLVED],
    ['the stored tagEventId is missing', storedRow(resolved, { missing: ['tagEventId'] }), unresolved, UNRESOLVED],
    ['the stored eventId differs (a newer id-only version)', storedRow(resolved), edge({ a: null, id: idOf(0x200), createdAt: 2000 }), UNRESOLVED],
    ['the stored eventId is missing', storedRow(resolved, { missing: ['eventId'] }), unresolved, UNRESOLVED],
    ['the relay\'s version names another tag by address', storedRow(resolved), edge({ a: `39999:${CAROL}:musician` }),
      { tagAddress: `39999:${CAROL}:musician`, tagSlug: 'musician', tagEventId: TAG_V1 }],
    ['the stored tag address is a 39998 address', storedRow(resolved, { set: { tagAddress: `39998:${JACK}:podcaster` } }), unresolved, UNRESOLVED],
    ['the stored tagSlug is not the tag address\'s suffix', storedRow(resolved, { set: { tagSlug: 'musician' } }), unresolved, UNRESOLVED],
    ['the stored tagSlug is missing', storedRow(resolved, { missing: ['tagSlug'] }), unresolved, UNRESOLVED],
    ['the stored tag address has a 63-hex pubkey', storedRow(resolved, { set: { tagAddress: `39999:${JACK.slice(1)}:podcaster` } }), unresolved, UNRESOLVED],
    ['the stored tag address has an empty slug', storedRow(resolved, { set: { tagAddress: `39999:${JACK}:`, tagSlug: '' } }), unresolved, UNRESOLVED],
    ['the stored tag address is a list', storedRow(resolved, { raw: { tagAddress: ['LIST<STRING NOT NULL> NOT NULL', null, [TAG_ADDR]] } }), unresolved, UNRESOLVED],
  ];
  table('resolution not kept', cases, ([label, row, relay, want]) => {
    const d = decideAddress(row, relay);
    eq(d && d.action, 'update', `${label}: action`);
    same(pick(stateOf(d.desired), ['tagAddress', 'tagSlug', 'tagEventId']), want, `${label}: desired resolution is the relay's`);
  });
});

test('SW32 (AC-2): a fixed point — once the pass writes what it decided, deciding again against the same relay changes nothing', () => {
  const decideAddress = fn('decideAddress');
  const E = edge();
  const resolved = edge({ a: null }, withElements(makeElement()));
  const unresolved = edge({ a: null });
  const cases = [
    ['a create', null, E],
    ['an update to a newer version', storedRow(edge({ id: idOf(0x10), createdAt: 100 })), E],
    ['an update to an older version', storedRow(edge({ id: idOf(0x9000), createdAt: 9000 })), E],
    ['a repair of a FLOAT createdAt', storedRow(E, { floatCreatedAt: true }), E],
    ['a repair that keeps a resolution', storedRow(resolved, { floatCreatedAt: true }), unresolved],
    ['a stripped extra key', storedRow(E, { extra: { timestamp: 5 } }), E],
    ['a move to Carol', storedRow(E), edge({ id: idOf(0x200), createdAt: 2000, target: CAROL })],
    ['a move off a non-NostrUser end', storedRow(E, { wrongEndLabel: 'to' }), E],
  ];
  table('fixed point', cases, ([label, row, relay]) => {
    const d = decideAddress(row, relay);
    assert(['create', 'update', 'move'].includes(d && d.action), `${label}: expected a write, got ${show(d && d.action)}`);
    const written = storedRow(asEdge(d.desired));
    eq(decideAddress(written, relay).action, 'none', `${label}: deciding again after the write`);
  });
});

// ═══ Parity with standingEdge over story 1's standing-rule truth table ═════════════════════════════════════════
/**
 * Story 1's standing-rule truth table: every (current, incoming) pair its standingEdge tests exercise
 * (test/tagging-edge-contract.test.js, AC-3 and clarifications 9 and 10, plus S2C5), built with the same fixtures.
 * `current` becomes the stored row; `incoming` is the relay's state at the same address. The address-mismatch pair is
 * not here: the pass never pairs a row with another address's version (SW34).
 */
function parityCases() {
  const e = (o, opts) => edge(o, opts);
  const r = (o, opts) => refusalOf(makeTagging(o), opts);
  const unresolved = e({ a: null });
  const resolved = e({ a: null }, withElements(makeElement()));
  const both = { stamps: [Z.canonicalTagging, Z.localTagging] };
  return [
    ['older then newer', e({ id: idOf(0x10), createdAt: 100, polarity: '1' }), e({ id: idOf(0x20), createdAt: 200, polarity: '-1' })],
    ['newer then older', e({ id: idOf(0x20), createdAt: 200, polarity: '-1' }), e({ id: idOf(0x10), createdAt: 100, polarity: '1' })],
    ['equal created_at, lower id incoming', e({ id: idOf(0x0b), createdAt: 300 }), e({ id: idOf(0x0a), createdAt: 300 })],
    ['equal created_at, higher id incoming', e({ id: idOf(0x0a), createdAt: 300 }), e({ id: idOf(0x0b), createdAt: 300 })],
    ['a newer version moves the tagging to Carol', e({ id: idOf(0x10), createdAt: 100 }), e({ id: idOf(0x20), createdAt: 200, target: CAROL })],
    ['an older version to Bob after Carol', e({ id: idOf(0x20), createdAt: 200, target: CAROL }), e({ id: idOf(0x10), createdAt: 100 })],
    ['a newer version, same target', e({ id: idOf(0x10), createdAt: 100 }), e({ id: idOf(0x30), createdAt: 300 })],
    ['the same version twice', resolved, resolved],
    ['the same version, unresolved then resolved', unresolved, resolved],
    ['the same version, resolved then unresolved', resolved, unresolved],
    ['the same version, a stamp flag follows the incoming record', e(both), e(both, { canonicalPubkey: CANONICAL, localPubkey: OTHER_DEPLOY })],
    ['the same version, both stamp flags follow the incoming record', e({}), e({}, { canonicalPubkey: OTHER_DEPLOY, localPubkey: CANONICAL })],
    ['a first version', null, e({})],
    ['nothing incoming', e({}), null],
    ['nothing either side', null, null],
    ['a newer non-tagging retires the edge', e({ id: idOf(0x10), createdAt: 100 }), r({ target: null, id: idOf(0x20), createdAt: 200 })],
    ['an older non-tagging', e({ id: idOf(0x20), createdAt: 200 }), r({ target: null, id: idOf(0x10), createdAt: 100 })],
    ['a non-tagging with nothing standing', null, r({ target: null, id: idOf(0x10), createdAt: 100 })],
    ['the same event later seen as a non-tagging', e({ stamps: [Z.localTagging] }), r({ stamps: [Z.localTagging] }, { canonicalPubkey: CANONICAL, localPubkey: OTHER_DEPLOY })],
    ['a non-tagging at equal created_at with a lower id', e({ id: idOf(0x50), createdAt: 500 }), r({ target: null, id: idOf(0x40), createdAt: 500 })],
    ['a non-tagging at equal created_at with a higher id', e({ id: idOf(0x50), createdAt: 500 }), r({ target: null, id: idOf(0x60), createdAt: 500 })],
    ['clarification 9: a newer version filed under a later d names Carol', e({ d: 'x', id: idOf(0x10), createdAt: 100 }),
      e({ d: 'L'.repeat(300), extraDTags: ['x'], target: CAROL, id: idOf(0x20), createdAt: 200 })],
    ['clarification 10: a BigInt createdAt stored, a lower id incoming at the same time', { ...e({ id: idOf(0x09), createdAt: 1000 }), createdAt: 1000n },
      e({ id: idOf(0x01), createdAt: 1000, target: CAROL })],
    ['clarification 10: a higher id incoming at the same time', e({ id: idOf(0x01), createdAt: 1000, target: CAROL }), e({ id: idOf(0x09), createdAt: 1000 })],
    ['S2C5: a newer non-tagging after a 256-byte first d', e({}), r({ d: 'L'.repeat(256), extraDTags: [D], target: null, id: idOf(0x20), createdAt: 2000 })],
    ['S2C5: a newer non-tagging after a 258-byte first d', e({}), r({ d: '€'.repeat(86), extraDTags: [D], target: null, id: idOf(0x21), createdAt: 2000 })],
  ];
}

test('SW33 (ADR 0001 A1, parity): over story 1\'s standing-rule truth table the pass reaches standingEdge\'s state for new, newer, same-version and retired-by-non-tagging — and diverges in exactly two documented ways, asserted as a closed set: older-ignored → the relay\'s state, no-incoming → removal', () => {
  const decideAddress = fn('decideAddress');
  const { standingEdge } = contract();
  const divergent = {};
  const problems = [];
  const reasons = new Set();
  for (const [label, current, incoming] of parityCases()) {
    const st = standingEdge(current, incoming);
    reasons.add(st.reason);
    const stored = current ? storedRow(current) : null;
    let d;
    try { d = decideAddress(stored, incoming); } catch (e) { problems.push(`${label}: decideAddress threw ${e.message}`); continue; }
    const after = afterDecision(d, current);
    if (exact(comparable(after)) !== exact(comparable(st.standing))) {
      (divergent[st.reason] = divergent[st.reason] || []).push(label);
      const documented = st.reason === 'older-ignored' ? (isRefusal(incoming) ? null : incoming)
        : st.reason === 'no-incoming' ? null : undefined;
      if (documented === undefined) {
        problems.push(`${label}: an undocumented divergence (${st.reason})\n            standingEdge: ${show(comparable(st.standing))}\n            pass:         ${show(comparable(after))}`);
      } else if (exact(comparable(after)) !== exact(comparable(documented))) {
        problems.push(`${label}: diverges (${st.reason}) but not to ${st.reason === 'no-incoming' ? 'a removal' : 'the relay\'s state'}\n            expected: ${show(comparable(documented))}\n            pass:     ${show(comparable(after))}`);
      }
    }
    const written = after ? storedRow(asEdge(after)) : null;
    const again = decideAddress(written, incoming);
    if (!again || again.action !== 'none') problems.push(`${label}: not a fixed point — after the pass's own write, deciding again gives ${show(again && again.action)}`);
  }
  assert(problems.length === 0, `parity problems:\n        - ${problems.join('\n        - ')}`);
  same(Object.keys(divergent).sort(), ['no-incoming', 'older-ignored'], `the reasons whose outcome differs from standingEdge (closed set; cases: ${show(divergent)})`);
  for (const r of ['new', 'newer', 'same-version', 'retired-by-non-tagging', 'older-ignored', 'no-incoming']) {
    assert(reasons.has(r), `fixture: the truth table must exercise standingEdge reason ${r}`);
  }
});

test('SW34 (ADR 0001 A1): address-mismatch is unreachable — planPass judges each address only against the relay\'s state at that same address', () => {
  const planPass = fn('planPass');
  const E = edge();
  const other = makeTagging({ d: 'another-d', id: idOf(0x77), createdAt: 9999 });
  const plan = lists(planPass({ snapshotRows: [storedRow(E)], relayEvents: [other], identities: IDENTITIES, confirmedHeld: null }));
  sameSet(addressesIn(plan.removals, 'removals'), [ADDRESS], 'removals: the row at the default address, which the relay no longer holds');
  sameSet(addressesIn(plan.creates, 'creates'), [addr('another-d')], 'creates: the other address\'s version');
  eq(plan.updates.length + plan.moves.length + plan.held.length, 0, 'no update, move or hold pairs the row with another address\'s version');
});

// ═══ R2-NB1: a stored createdAt that cannot be ordered ══════════════════════════════════════════════════════════
test('SW35 (R2-NB1, ADR D5): a stored createdAt that is missing, null, "abc", "1000", NaN, FLOAT, true, a list or negative is never kept — against the same, a newer, an older or a moving version, the pass updates or moves to the relay\'s integer', () => {
  const decideAddress = fn('decideAddress');
  const v1 = edge({ id: idOf(0x100), createdAt: 1000 });
  const relays = [
    ['the same version', v1, 'update', 'repaired'],
    ['a newer version', edge({ id: idOf(0x200), createdAt: 2000, polarity: '-1' }), 'update', 'repaired'],
    ['an older version', edge({ id: idOf(0x050), createdAt: 500, polarity: '0' }), 'update', 'repaired'],
    ['a newer version naming Carol', edge({ id: idOf(0x300), createdAt: 3000, target: CAROL }), 'move', 'moved'],
  ];
  const cases = [];
  for (const [ml, spoil] of MALFORMED_CREATED_AT) for (const [rl, relay, action, label] of relays) cases.push([`stored createdAt ${ml}, relay ${rl}`, storedRow(v1, spoil), relay, action, label]);
  table('R2-NB1', cases, ([label, row, relay, action, lab]) => {
    let d;
    try { d = decideAddress(row, relay); } catch (e) { throw new Error(`${label}: threw ${e.message}`); }
    same({ action: d && d.action, label: d && d.label }, { action, label: lab }, `${label}: action and label`);
    sameState(d.desired, relay, `${label}: desired (createdAt the relay's integer ${relay.createdAt})`);
    eq(decideAddress(storedRow(asEdge(d.desired)), relay).action, 'none', `${label}: fixed point after the write`);
  });
});

// ═══ The limit (AC-5) ══════════════════════════════════════════════════════════════════════════════════════════
test('SW36 (AC-5): judgeRemovals holds every removal iff there are more than 50 AND more than a tenth of the base — boundaries 500/50, 500/51, 510/51, 600/60, 600/61, 40/40, 50/50, 51/51, 1000/100, 1000/101, 0/0', () => {
  const judgeRemovals = fn('judgeRemovals');
  const rows = [[500, 50, false], [500, 51, true], [510, 51, false], [600, 60, false], [600, 61, true], [40, 40, false],
    [50, 50, false], [51, 51, true], [1000, 100, false], [1000, 101, true], [0, 0, false]];
  table('judgeRemovals boundaries', rows, ([base, n, held]) => {
    const removals = removalsFor(n, `b${base}`);
    const r = judged(judgeRemovals({ removals, base, confirmedHeld: null }));
    const label = `base ${base}, ${n} removals`;
    sameSet(addressesIn(r.apply, 'apply'), held ? [] : removals.map((x) => x.address), `${label}: apply`);
    sameSet(addressesIn(r.held, 'held'), held ? removals.map((x) => x.address) : [], `${label}: held`);
    eq(r.limit && r.limit.exceeded, held, `${label}: limit.exceeded`);
  });
});

test('SW37 (AC-5: "the limit never loosens"): the limit cannot be configured through the planner\'s arguments', () => {
  const judgeRemovals = fn('judgeRemovals');
  const planPass = fn('planPass');
  const removals = removalsFor(51, 'cfg');
  const r = judged(judgeRemovals({ removals, base: 500, confirmedHeld: null, floor: 1000, fraction: 1, limit: { floor: 1000, fraction: 1 }, LIMIT: { floor: 1000, fraction: 1 } }));
  eq(r.held.length, 51, 'judgeRemovals with floor / fraction / limit arguments still holds 51 of 500');
  const { rows } = bulkOnce(610, 'bd');
  const plan = lists(planPass({ snapshotRows: rows.slice(0, 500), relayEvents: bulkOnce(610, 'bd').events.slice(0, 449), identities: IDENTITIES,
    confirmedHeld: null, floor: 1000, fraction: 1, limit: { floor: 1000, fraction: 1 } }));
  eq(plan.held.length, 51, 'planPass with floor / fraction / limit arguments still holds 51 of 500');
  eq(plan.removals.length, 0, 'planPass with limit arguments removes nothing over the limit');
});

test('SW38 (AC-5, owner decision 5): a confirmed run applies the confirmed removals still due (C) and judges the rest (O) against base − |C| — 7,030/6,435/empty relay → 6,435 removed, 595 held; 1,000/100/60 → all applied; 1,000/100/91 → 91 held', () => {
  const judgeRemovals = fn('judgeRemovals');
  const scenario = (label, base, nC, nO, expectHeldO) => {
    const confirmedList = removalsFor(nC, `${label}-c`);
    const others = removalsFor(nO, `${label}-o`);
    const r = judged(judgeRemovals({ removals: [...confirmedList, ...others], base, confirmedHeld: confirmedList }));
    const wantApply = expectHeldO ? confirmedList : [...confirmedList, ...others];
    sameSet(addressesIn(r.apply, 'apply'), wantApply.map((x) => x.address), `${label}: apply`);
    sameSet(addressesIn(r.held, 'held'), expectHeldO ? others.map((x) => x.address) : [], `${label}: held`);
    eq(r.limit && r.limit.baseAfterConfirmed, base - nC, `${label}: limit.baseAfterConfirmed (base − |C|)`);
    eq(r.limit && r.limit.exceeded, expectHeldO, `${label}: limit.exceeded`);
  };
  scenario('census', 7030, 6435, 595, true);      // an empty relay during a confirmed cleanup: 595 > 50 and 5,950 > 595
  scenario('thousand-60', 1000, 100, 60, false);  // 600 ≤ 900
  scenario('thousand-91', 1000, 100, 91, true);   // 910 > 900
  scenario('census-50', 7030, 6435, 50, false);   // 50 others are never held
  const unconfirmed = judged(judgeRemovals({ removals: removalsFor(7030, 'census-u'), base: 7030, confirmedHeld: null }));
  eq(unconfirmed.apply.length, 0, 'the same empty relay unconfirmed: nothing applies');
  eq(unconfirmed.held.length, 7030, 'the same empty relay unconfirmed: all 7,030 held');
});

test('SW39 (AC-5): a removal is confirmed only by a held entry with the same (address, seenEventId) — null equals null, the reason is not part of the key — and a confirmed entry no longer due removes nothing and does not shrink the base', () => {
  const judgeRemovals = fn('judgeRemovals');
  const A = addr('probe-a');
  const B = addr('probe-b');
  const X = idOf('x');
  const Y = idOf('y');
  const probes = [
    ['same address and seenEventId', { address: A, seenEventId: X, reason: 'not-on-relay' }, [{ address: A, seenEventId: X, reason: 'not-on-relay' }], true],
    ['both seenEventIds null', { address: A, seenEventId: null, reason: 'not-on-relay' }, [{ address: A, seenEventId: null, reason: 'not-on-relay' }], true],
    ['same key, the reason changed since the owner looked', { address: A, seenEventId: X, reason: 'non-tagging' }, [{ address: A, seenEventId: X, reason: 'not-on-relay' }], true],
    ['removal null, confirmed an id', { address: A, seenEventId: null, reason: 'not-on-relay' }, [{ address: A, seenEventId: X, reason: 'not-on-relay' }], false],
    ['removal an id, confirmed null', { address: A, seenEventId: X, reason: 'not-on-relay' }, [{ address: A, seenEventId: null, reason: 'not-on-relay' }], false],
    ['another version since the owner looked', { address: A, seenEventId: Y, reason: 'not-on-relay' }, [{ address: A, seenEventId: X, reason: 'not-on-relay' }], false],
    ['another address', { address: A, seenEventId: X, reason: 'not-on-relay' }, [{ address: B, seenEventId: X, reason: 'not-on-relay' }], false],
  ];
  // 60 unconfirmed others over a base of 200 are held (600 > 199 or 200), so the probe is applied iff it is confirmed.
  const others = removalsFor(60, 'probe-o');
  table('confirmation matching', probes, ([label, probe, confirmedHeld, matches]) => {
    const r = judged(judgeRemovals({ removals: [...others, probe], base: 200, confirmedHeld }));
    eq(addressesIn(r.apply, 'apply').includes(A), matches, `${label}: the probe is applied`);
    eq(addressesIn(r.held, 'held').includes(A), !matches, `${label}: the probe is held`);
  });
  const stale = removalsFor(10, 'stale');
  const due = removalsFor(3, 'due');
  const r = judged(judgeRemovals({ removals: [...due, ...removalsFor(5, 'plain')], base: 100, confirmedHeld: [...stale, ...due] }));
  sameSet(addressesIn(r.apply, 'apply'), [...due, ...removalsFor(5, 'plain')].map((x) => x.address), 'only planned removals are applied; the 10 stale confirmations remove nothing');
  eq(r.limit && r.limit.baseAfterConfirmed, 97, 'limit.baseAfterConfirmed subtracts only the confirmed removals still due (100 − 3), not the confirmed list\'s length');
});

// ═══ planPass ══════════════════════════════════════════════════════════════════════════════════════════════════
test('SW40 (AC-1): the backfill — an empty graph and a relay of taggings carrying the canonical stamp, the local one, or both (identities distinct) — plans one create per accepted tagging with the contract\'s values, id-only ones resolved when their element is scanned; refused ones are not created; added = taggingsRead − refused', () => {
  const planPass = fn('planPass');
  const readRelay = fn('readRelay');
  assert(IDENTITIES.canonicalPubkey !== IDENTITIES.localPubkey, 'fixture: the canonical and local identities must differ');
  const el = makeElement();
  const el2 = makeElement({ id: idOf('el2'), d: 'musician', stamps: [Z.localTag] });
  const taggings = [
    ['canonical stamp only', makeTagging({ d: 'b-canon', id: idOf('b-canon') }), [true, false]],
    ['local stamp only', makeTagging({ d: 'b-local', id: idOf('b-local'), stamps: [Z.localTagging] }), [false, true]],
    ['both stamps', makeTagging({ d: 'b-both', id: idOf('b-both'), stamps: [Z.canonicalTagging, Z.localTagging] }), [true, true]],
    ['id only, canonical-stamped element scanned', makeTagging({ d: 'b-id', a: null, id: idOf('b-id') }), [true, false]],
    ['id only, local-stamped element scanned', makeTagging({ d: 'b-idloc', a: null, e: idOf('el2'), id: idOf('b-idloc'), stamps: [Z.localTagging] }), [false, true]],
    ['id only, element not on the relay', makeTagging({ d: 'b-idabsent', a: null, e: idOf('nowhere'), id: idOf('b-idabsent') }), [true, false]],
  ];
  const refused = makeNonTagging({ address: addr('b-refused'), id: idOf('b-refused') });
  const events = [...taggings.map((t) => t[1]), refused, el, el2];
  const plan = lists(planPass({ snapshotRows: [], relayEvents: events, identities: IDENTITIES, confirmedHeld: null }));
  const opts = withElements(el, el2);
  const byAddr = new Map(plan.creates.map((c) => [addrOf(c), desiredOf(c)]));
  sameSet(addressesIn(plan.creates, 'creates'), taggings.map((t) => contractEdge(t[1], opts).address), 'creates: one per accepted tagging');
  for (const [label, ev, flags] of taggings) {
    const E = contractEdge(ev, opts);
    sameState(byAddr.get(E.address), E, `${label}: desired`);
    same([stateOf(byAddr.get(E.address)).zCanonical, stateOf(byAddr.get(E.address)).zLocal], flags, `${label}: zCanonical / zLocal`);
  }
  eq(stateOf(byAddr.get(addr('b-idloc'))).tagAddress, `39999:${JACK}:musician`, 'id only: resolved from the local-stamped element');
  eq(stateOf(byAddr.get(addr('b-idabsent'))).tagAddress, null, 'id only, element absent: written unresolved');
  eq(plan.updates.length + plan.moves.length + plan.removals.length + plan.held.length, 0, 'a first run only creates');
  const rr = readRelay(events, IDENTITIES);
  eq(plan.creates.length, rr.taggingsRead - rr.refused.total, 'added = taggingsRead − refused.total on a first run');
});

test('SW41 (AC-2): a graph that already agrees with the relay — a second pass straight after the first — plans nothing', () => {
  const planPass = fn('planPass');
  const el = makeElement();
  const events = [
    makeTagging({ d: 'a-1', id: idOf('a-1') }),
    makeTagging({ d: 'a-2', id: idOf('a-2'), stamps: [Z.localTagging], polarity: null }),
    makeTagging({ d: 'a-3', id: idOf('a-3'), a: null }),
    makeTagging({ d: 'a-4', id: idOf('a-4'), a: null, e: idOf('nowhere') }),
    makeTagging({ d: 'a-5', id: idOf('a-5'), target: ALICE, polarity: '-1' }),
    makeNonTagging({ address: addr('a-refused'), id: idOf('a-refused') }),
    el,
  ];
  const first = lists(planPass({ snapshotRows: [], relayEvents: events, identities: IDENTITIES, confirmedHeld: null }));
  const written = first.creates.map((c) => storedRow(asEdge(desiredOf(c))));
  eq(written.length, 5, 'the first pass creates the five accepted taggings');
  const leftAlone = storedRow(edge({ d: 'a-left', id: idOf('a-left') }), { address: null });
  const second = lists(planPass({ snapshotRows: [...written, leftAlone], relayEvents: events, identities: IDENTITIES, confirmedHeld: null }));
  for (const k of PLAN_LISTS) eq(second[k].length, 0, `second pass: ${k}`);
});

test('SW42 (AC-1–AC-3): each address lands in exactly the list the rule table gives — create, update (newer and older), move, remove (not-on-relay and non-tagging) — and unchanged, refused-only and left-in-place addresses in none', () => {
  const planPass = fn('planPass');
  const v = (d, o = {}) => makeTagging({ d, id: idOf(`${d}:${o.createdAt || 1000}`), ...o });
  const rows = [
    storedRowFor(v('m-same')),
    storedRowFor(v('m-newer', { createdAt: 1000 })),
    storedRowFor(v('m-older', { createdAt: 3000 })),
    storedRowFor(v('m-move', { createdAt: 1000 })),
    storedRowFor(v('m-gone')),
    storedRowFor(v('m-nontag')),
    storedRowFor(v('m-noaddr'), { address: null }),
    storedRowFor(v('m-39998'), { nonTaggingAddress: true }),
  ];
  const relay = [
    v('m-create'),
    makeNonTagging({ address: addr('m-refused'), id: idOf('m-refused') }),
    v('m-same'),
    v('m-newer', { createdAt: 2000, polarity: '-1' }),
    v('m-older', { createdAt: 2000 }),
    v('m-move', { createdAt: 2000, target: CAROL }),
    makeNonTagging({ address: addr('m-nontag'), id: idOf('m-nontag:2'), createdAt: 2000 }),
    v('m-noaddr'),                                                            // the relay holds it; the address-less row stays
  ];
  const plan = lists(planPass({ snapshotRows: rows, relayEvents: relay, identities: IDENTITIES, confirmedHeld: null }));
  sameSet(addressesIn(plan.creates, 'creates'), [addr('m-create'), addr('m-noaddr')], 'creates');
  sameSet(addressesIn(plan.updates, 'updates'), [addr('m-newer'), addr('m-older')], 'updates');
  sameSet(addressesIn(plan.moves, 'moves'), [addr('m-move')], 'moves');
  sameSet(addressesIn(plan.removals, 'removals'), [addr('m-gone'), addr('m-nontag')], 'removals (2 of a base of 6: within the limit)');
  eq(plan.held.length, 0, 'held');
  const all = touched(plan);
  for (const a of [addr('m-same'), addr('m-refused'), `39998:${ALICE}:m-39998`]) assert(!all.has(a), `${a} must be left alone`);
  const desired = (list, a) => desiredOf(list.find((x) => addrOf(x) === a));
  sameState(desired(plan.updates, addr('m-older')), contractEdge(v('m-older', { createdAt: 2000 })), 'the older relay version is what the update writes');
  sameState(desired(plan.moves, addr('m-move')), contractEdge(v('m-move', { createdAt: 2000, target: CAROL })), 'the move writes the relay\'s ends');
});

test('SW43 (AC-5): a tagging moved to a different person is never a removal — 100 moves over a base of 100 hold nothing, and 400 moves beside 60 removals over a base of 600 let the 60 apply', () => {
  const planPass = fn('planPass');
  const { events, rows } = bulkOnce(610, 'bd');
  const movedTo = (ev) => ({ ...makeTagging({ d: ev.tags[0][1], id: idOf(`${ev.id}:moved`), createdAt: 2000, target: CAROL }) });
  const p1 = lists(planPass({ snapshotRows: rows.slice(0, 100), relayEvents: events.slice(0, 100).map(movedTo), identities: IDENTITIES, confirmedHeld: null }));
  eq(p1.moves.length, 100, '100 targets changed: moves');
  eq(p1.removals.length + p1.held.length + p1.creates.length, 0, '100 targets changed: no removal, hold or create');
  const relay = [...events.slice(0, 400).map(movedTo), ...events.slice(400, 540)];
  const p2 = lists(planPass({ snapshotRows: rows.slice(0, 600), relayEvents: relay, identities: IDENTITIES, confirmedHeld: null }));
  eq(p2.moves.length, 400, 'moves');
  eq(p2.removals.length, 60, 'removals applied (60 > 50 but 600 ≤ 600; moves are not counted)');
  eq(p2.held.length, 0, 'held');
});

test('SW44 (AC-5): over the limit every create, update and move is still planned, no removal applies, and the held list names each removal as { address, seenEventId, reason } — the stored eventId, null when it has none', () => {
  const planPass = fn('planPass');
  const rows = [];
  const relay = [];
  for (let i = 0; i < 500; i++) {
    const d = `lim-${i}`;
    const v1 = makeTagging({ d, id: idOf(`lim:${i}`) });
    rows.push(i === 449 ? storedRowFor(v1, { missing: ['eventId'] }) : storedRowFor(v1));
    if (i < 10) relay.push(makeTagging({ d, id: idOf(`lim:${i}:v2`), createdAt: 2000, polarity: '-1' }));
    else if (i < 20) relay.push(makeTagging({ d, id: idOf(`lim:${i}:v2`), createdAt: 2000, target: CAROL }));
    else if (i < 449) relay.push(v1);
    else if (i >= 490) relay.push(makeNonTagging({ address: addr(d), id: idOf(`lim:${i}:nt`), createdAt: 2000 }));
  }
  for (let i = 0; i < 5; i++) relay.push(makeTagging({ d: `lim-new-${i}`, id: idOf(`lim-new:${i}`) }));
  const plan = lists(planPass({ snapshotRows: rows, relayEvents: relay, identities: IDENTITIES, confirmedHeld: null }));
  const range = (a, b, f) => Array.from({ length: b - a }, (_, k) => f(a + k));
  sameSet(addressesIn(plan.creates, 'creates'), range(0, 5, (i) => addr(`lim-new-${i}`)), 'creates still apply');
  sameSet(addressesIn(plan.updates, 'updates'), range(0, 10, (i) => addr(`lim-${i}`)), 'updates still apply');
  sameSet(addressesIn(plan.moves, 'moves'), range(10, 20, (i) => addr(`lim-${i}`)), 'moves still apply');
  eq(plan.removals.length, 0, 'no removal applies over the limit (51 > 50 and 510 > 500)');
  const want = range(449, 500, (i) => ({ address: addr(`lim-${i}`), seenEventId: i === 449 ? null : idOf(`lim:${i}`), reason: i >= 490 ? 'non-tagging' : 'not-on-relay' }));
  const got = plan.held.map((h) => ({ address: h.address, seenEventId: h.seenEventId, reason: h.reason }));
  same([...got].sort((x, y) => (x.address < y.address ? -1 : 1)), [...want].sort((x, y) => (x.address < y.address ? -1 : 1)), 'held list');
});

test('SW45 (AC-5, owner decision 4): the base counts only relationships at tagging addresses — 60 of them plus 600 left in place (300 missing-address, 300 not-a-tagging-address) over an empty relay hold all 60, and the 600 are touched by nothing', () => {
  const planPass = fn('planPass');
  const base = bulkOnce(60, 'base60');
  const noAddr = bulk(300, 'noaddr').events.map((ev) => storedRowFor(ev, { address: null }));
  const k39998 = bulk(300, 'k39998').events.map((ev) => storedRowFor(ev, { nonTaggingAddress: true }));
  const plan = lists(planPass({ snapshotRows: [...base.rows, ...noAddr, ...k39998], relayEvents: [], identities: IDENTITIES, confirmedHeld: null }));
  eq(plan.removals.length, 0, 'removals applied (60 > 50 and 600 > 60: held; counting the 600 left in place would have let them apply)');
  sameSet(addressesIn(plan.held, 'held'), base.events.map((ev) => contractEdge(ev).address), 'held: the 60 at tagging addresses');
  eq(plan.creates.length + plan.updates.length + plan.moves.length, 0, 'nothing else planned');
});

test('SW46 (AC-5): planPass applies the limit at the boundaries — base 500 with 50 and 51 removals, 510 with 51, 600 with 60 and 61, 40 with 40', () => {
  const planPass = fn('planPass');
  const { events, rows } = bulkOnce(610, 'bd');
  table('planPass boundaries', [[500, 50, false], [500, 51, true], [510, 51, false], [600, 60, false], [600, 61, true], [40, 40, false]], ([base, n, held]) => {
    const plan = lists(planPass({ snapshotRows: rows.slice(0, base), relayEvents: events.slice(0, base - n), identities: IDENTITIES, confirmedHeld: null }));
    const label = `base ${base}, ${n} not on the relay`;
    eq(plan.removals.length, held ? 0 : n, `${label}: removals`);
    eq(plan.held.length, held ? n : 0, `${label}: held`);
  });
});

test('SW47 (AC-5): a confirmed planPass over the census — 7,030 relationships, 6,435 confirmed held, an empty relay — removes the 6,435 and holds the other 595', () => {
  const planPass = fn('planPass');
  const { events, rows } = bulkOnce(7030, 'census');
  const confirmedHeld = events.slice(0, 6435).map((ev) => ({ address: contractEdge(ev).address, seenEventId: ev.id, reason: 'not-on-relay' }));
  const plan = lists(planPass({ snapshotRows: rows, relayEvents: [], identities: IDENTITIES, confirmedHeld }));
  sameSet(addressesIn(plan.removals, 'removals'), confirmedHeld.map((h) => h.address), 'removals: the confirmed entries still due');
  sameSet(addressesIn(plan.held, 'held'), events.slice(6435).map((ev) => contractEdge(ev).address), 'held: the 595 others (595 > 50 and 5,950 > 7,030 − 6,435)');
  same(plan.held.map((h) => h.seenEventId).filter((x) => typeof x !== 'string'), [], 'held seenEventIds are the stored event ids');
});

test('SW48 (AC-7 report fields): planPass\'s limit record gives base, leftInPlaceExcluded and exceeded — and baseAfterConfirmed on a confirmed run', () => {
  const planPass = fn('planPass');
  const base = bulkOnce(60, 'base60');
  const noAddr = bulk(600, 'noaddr600').events.map((ev) => storedRowFor(ev, { address: null }));
  const l1 = planLimit(planPass({ snapshotRows: [...base.rows, ...noAddr], relayEvents: [], identities: IDENTITIES, confirmedHeld: null }));
  same(pick(l1, ['base', 'leftInPlaceExcluded', 'exceeded']), { base: 60, leftInPlaceExcluded: 600, exceeded: true }, 'unconfirmed, 60 + 600 left, empty relay');
  const { events, rows } = bulkOnce(7030, 'census');
  const confirmedHeld = events.slice(0, 6435).map((ev) => ({ address: contractEdge(ev).address, seenEventId: ev.id, reason: 'not-on-relay' }));
  const l2 = planLimit(planPass({ snapshotRows: rows, relayEvents: [], identities: IDENTITIES, confirmedHeld }));
  same(pick(l2, ['base', 'baseAfterConfirmed', 'exceeded']), { base: 7030, baseAfterConfirmed: 595, exceeded: true }, 'confirmed census run');
});

test('SW49 (AC-5): a pass remembers nothing — removals held by one pass apply on a later unconfirmed pass within its own limit, and the first pass\'s input holds again', () => {
  const planPass = fn('planPass');
  const { events, rows } = bulkOnce(610, 'bd');
  const run = (onRelay) => lists(planPass({ snapshotRows: rows.slice(0, 100), relayEvents: events.slice(0, onRelay), identities: IDENTITIES, confirmedHeld: null }));
  const first = run(49);
  same([first.removals.length, first.held.length], [0, 51], 'first pass: 51 of 100 not on the relay → held');
  const second = run(50);
  same([second.removals.length, second.held.length], [50, 0], 'a later pass: 50 of 100 → applied');
  const third = run(49);
  same([third.removals.length, third.held.length], [0, 51], 'the first input again → held again');
});

test('SW50 (ADR "never left absent"): an address where the scan holds more than one version — accepted and refused, two refusals, two accepted — gets no action, with or without a relationship there', () => {
  const planPass = fn('planPass');
  const rows = ['c-1', 'c-2', 'c-3'].map((d) => storedRowFor(makeTagging({ d, id: idOf(`${d}:v0`), createdAt: 500 })));
  const relay = [
    makeTagging({ d: 'c-1', id: idOf('c1a'), createdAt: 2000 }),
    makeNonTagging({ address: addr('c-1'), id: idOf('c1b'), createdAt: 3000 }),
    makeNonTagging({ address: addr('c-2'), refusal: 'no-target', id: idOf('c2a') }),
    makeNonTagging({ address: addr('c-2'), refusal: 'bad-target', id: idOf('c2b') }),
    makeTagging({ d: 'c-3', id: idOf('c3a'), createdAt: 2000, target: CAROL }),
    makeTagging({ d: 'c-3', id: idOf('c3b'), createdAt: 3000 }),
    makeTagging({ d: 'c-5', id: idOf('c5a') }),
    makeTagging({ d: 'c-5', id: idOf('c5b'), createdAt: 1100 }),
    makeTagging({ d: 'c-4', id: idOf('c4') }),
  ];
  const plan = lists(planPass({ snapshotRows: rows, relayEvents: relay, identities: IDENTITIES, confirmedHeld: null }));
  const all = touched(plan);
  for (const d of ['c-1', 'c-2', 'c-3', 'c-5']) assert(!all.has(addr(d)), `${addr(d)} holds conflicting versions and must get no action`);
  sameSet(addressesIn(plan.creates, 'creates'), [addr('c-4')], 'the single version at c-4 is still created');
});

test('SW51 (ADR runner step 8): groupSnapshot finds two rows at one address and a repeated element id as snapshot conflicts (rows left in place are not conflicts), and planPass takes no action at those addresses', () => {
  const groupSnapshot = fn('groupSnapshot');
  const planPass = fn('planPass');
  const r1a = storedRowFor(makeTagging({ d: 'g-1', id: idOf('g1') }));
  const r1b = storedRowFor(makeTagging({ d: 'g-1', id: idOf('g1b'), createdAt: 1500 }), { rid: '5:fixture:g1b' });
  const r3 = storedRowFor(makeTagging({ d: 'g-3', id: idOf('g3') }), { rid: '5:fixture:same' });
  const r4 = storedRowFor(makeTagging({ d: 'g-4', id: idOf('g4') }), { rid: '5:fixture:same' });
  const r6 = storedRowFor(makeTagging({ d: 'g-6', id: idOf('g6') }));
  const left = [
    ...bulk(3, 'g-noaddr').events.map((ev) => storedRowFor(ev, { address: null })),
    ...bulk(2, 'g-39998').events.map((ev) => storedRowFor(ev, { nonTaggingAddress: true })),
  ];
  const conflicts = (rows) => { const g = groupSnapshot(rows); assert(isPlainObject(g) && 'conflicts' in g, `groupSnapshot must return { byAddress, conflicts }, got ${show(g && Object.keys(g))}`); return sizeOf(g.conflicts); };
  eq(conflicts([r1a, r1b, r6]), 1, 'two rows at g-1');
  assert(conflicts([r3, r4, r6]) >= 1, 'one element id at g-3 and g-4 must be a conflict');
  eq(conflicts([r6, ...left]), 0, 'rows left in place (no address, or a 39998 address) are not conflicts');
  const newer = (d) => makeTagging({ d, id: idOf(`${d}:v9`), createdAt: 3000, polarity: '-1' });
  const plan = lists(planPass({ snapshotRows: [r1a, r1b, r3, r4, r6, ...left], relayEvents: ['g-1', 'g-3', 'g-4', 'g-6'].map(newer), identities: IDENTITIES, confirmedHeld: null }));
  sameSet(addressesIn(plan.updates, 'updates'), [addr('g-6')], 'only g-6 is updated');
  for (const d of ['g-1', 'g-3', 'g-4']) assert(!touched(plan).has(addr(d)), `${addr(d)} is a snapshot conflict and must get no action`);
  const empty = lists(planPass({ snapshotRows: [r1a, r1b, r3, r4, r6], relayEvents: [], identities: IDENTITIES, confirmedHeld: null }));
  sameSet(addressesIn(empty.removals, 'removals'), [addr('g-6')], 'an empty relay removes only g-6');
});

test('SW52 (AC-3, ADR D2): the relay wins over a deletion it did not act on — a kind-5 naming a tagging the relay still holds removes nothing', () => {
  const planPass = fn('planPass');
  const { revokeApplies } = contract();
  const t = makeTagging();
  const kind5 = makeDeletion({ e: [t.id], a: [ADDRESS], createdAt: 5000 });
  eq(revokeApplies(contractEdge(t), kind5).applies, true, 'fixture: by the contract\'s revoke rule the deletion names this version');
  const plan = lists(planPass({ snapshotRows: [storedRowFor(t)], relayEvents: [t, kind5], identities: IDENTITIES, confirmedHeld: null }));
  for (const k of PLAN_LISTS) eq(plan[k].length, 0, `${k}: the relay still holds the tagging`);
  const gone = lists(planPass({ snapshotRows: [storedRowFor(t)], relayEvents: [kind5], identities: IDENTITIES, confirmedHeld: null }));
  sameSet(addressesIn(gone.removals, 'removals'), [ADDRESS], 'once the relay no longer holds it, it is removed');
});

// ═══ The held list's canonical text ════════════════════════════════════════════════════════════════════════════
test('SW53 (AC-5, ADR D8): heldLines is the canonical text of a held list — one "address\\tseenEventId\\treason\\n" line per entry, sorted, "" for none — whatever the input order, without reordering the input', () => {
  const heldLines = fn('heldLines');
  const h = [
    { address: addr('beta'), seenEventId: idOf('b'), reason: 'not-on-relay' },
    { address: addr('alpha'), seenEventId: idOf('a'), reason: 'non-tagging', rid: '5:fixture:ignored' },
    { address: `39999:${BOB}:alpha`, seenEventId: idOf('c'), reason: 'not-on-relay' },
  ];
  const want = `${addr('alpha')}\t${idOf('a')}\tnon-tagging\n${addr('beta')}\t${idOf('b')}\tnot-on-relay\n39999:${BOB}:alpha\t${idOf('c')}\tnot-on-relay\n`;
  const before = h.map((x) => x.address);
  eq(heldLines(h), want, 'heldLines');
  same(h.map((x) => x.address), before, 'the input array is not reordered');
  eq(heldLines([...h].reverse()), want, 'the same entries in another order');
  eq(heldLines([]), '', 'an empty held list');
  const n = heldLines([{ address: addr('gamma'), seenEventId: null, reason: 'not-on-relay' }]);
  assert(n.startsWith(`${addr('gamma')}\t`) && n.endsWith('\tnot-on-relay\n') && n.split('\n').length === 2,
    `a null seenEventId still gives one address\\t…\\treason line, got ${show(n)}`);
});

test('SW54 (ADR graph.js; clarification C6): planPass\'s items are the graph port\'s rows as they are — a create { address, desired }, an update or move { address, snapshot, desired }, a removal { address, snapshot } — desired the contract edge to write, snapshot the READ_ALL row the decision was made from', () => {
  const planPass = fn('planPass');
  const v = (d, o = {}) => makeTagging({ d, id: idOf(`${d}:${o.createdAt || 1000}`), ...o });
  const rowUpd = storedRowFor(v('p-upd'));
  const rowMov = storedRowFor(v('p-mov'));
  const rowGone = storedRowFor(v('p-gone'));
  const relay = [v('p-new'), v('p-upd', { createdAt: 2000, polarity: '-1' }), v('p-mov', { createdAt: 2000, target: CAROL })];
  const plan = lists(planPass({ snapshotRows: [rowUpd, rowMov, rowGone], relayEvents: relay, identities: IDENTITIES, confirmedHeld: null }));
  /** The item's `desired`, required to carry every key of the contract edge with the contract's values. */
  const edgeOfItem = (item, want, label) => {
    assert(isPlainObject(item) && isPlainObject(item.desired), `${label}: the item should carry the contract edge as .desired (the port writes toWriteProps(desired)); got ${show(item)}`);
    const picked = EDGE_KEYS.reduce((o, k) => { o[k] = item.desired[k] === undefined ? '<missing>' : item.desired[k]; return o; }, {});
    same(picked, want, `${label}: .desired, key by key (the contract edge: type, from, to and the nine)`);
  };
  const one = (list, label) => { eq(list.length, 1, `${label}: planned items`); return list[0]; };
  const cr = one(plan.creates, 'creates');
  eq(cr.address, addr('p-new'), 'the create\'s .address');
  edgeOfItem(cr, contractEdge(v('p-new')), 'the create');
  const up = one(plan.updates, 'updates');
  eq(up.address, addr('p-upd'), 'the update\'s .address');
  same(up.snapshot, rowUpd, 'the update\'s .snapshot (the READ_ALL row it was decided from, as read)');
  edgeOfItem(up, contractEdge(v('p-upd', { createdAt: 2000, polarity: '-1' })), 'the update');
  const mv = one(plan.moves, 'moves');
  eq(mv.address, addr('p-mov'), 'the move\'s .address');
  same(mv.snapshot, rowMov, 'the move\'s .snapshot');
  edgeOfItem(mv, contractEdge(v('p-mov', { createdAt: 2000, target: CAROL })), 'the move');
  const rm = one(plan.removals, 'removals');
  eq(rm.address, addr('p-gone'), 'the removal\'s .address');
  same(rm.snapshot, rowGone, 'the removal\'s .snapshot');
});

// ─── runner ────────────────────────────────────────────────────────────────────────────────────────────────────
async function run() {
  console.log('\n--- tagging-edges sweep planner tests (epic tagging-edges, Story 2) ---');
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  PASS  ${name}`); pass++; }
    catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failures.push({ name, message: err.message }); fail++; }
  }
  console.log(`\ntagging-edges-sweep: ${pass} passed, ${fail} failed`);
  return { pass, fail, skipped: 0, failures };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
