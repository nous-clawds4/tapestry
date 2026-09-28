'use strict';
/**
 * Tests for Story 2 (epic tagging-edges) — the gap-filling pass: live checks against the LOCAL stack only.
 *
 * Story: engineering-team/stories/tagging-edges/2-gap-filling-pass-and-backfill.md
 * ADR:   engineering-team/decisions/tagging-edges/0002-gap-filling-pass.md ("Seams for Test Design → Live, local stack
 *        only"; binding context: ADR tagging-edges/0001 as amended, and src/lib/tagging-edges/contract.js)
 * Plan:  engineering-team/stories/tagging-edges/2-gap-filling-pass-and-backfill.test-plan.md
 *
 * Intentionally red until story 2's implementation lands: src/pipeline/tagging-edges/graph.js and
 * src/lib/tagging-edges/sweep.js do not exist yet. Both are require()d LAZILY inside each test through load
 * helpers, so this suite always loads. A test that needs one of them fails with "<module> not implemented yet"
 * BEFORE it looks for a stack, so the red phase shows on a host with no Neo4j as well; once the modules exist, a
 * read-only test with no stack SKIPs with its reason.
 *
 * What a run needs (nothing else is read):
 *   NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD — the local stack's Bolt address and credentials, from the environment
 *     only. The suite never reads /etc/brainstorm.conf and never prints the password. Missing → every test SKIPs.
 *   The URI must name a local host (localhost, 127.0.0.1, [::1] or *.localhost) and carry no credentials of its own;
 *     anything else SKIPs, so no run ever reaches a public host. An unreachable Bolt port (not published to the
 *     host, or the stack down) SKIPs too.
 *   TAPESTRY_REQUIRE_LIVE=1 turns "every read-only check skipped" into a failure (OPEN.md #104/#106).
 *
 * Classes:
 *   SL1–SL7   read-only, the default. Only RETURN, EXPLAIN and SHOW statements run; nothing is written.
 *   SL8–SL16  the opt-in write sandbox, SKIPPED unless TAGGING_EDGES_LIVE_WRITE_TESTS=1. Once opted in, a sandbox
 *             test that cannot run (no stack, a module missing, tags_address not in place) FAILS rather than skips.
 *             The sandbox (CLAUDE.md principle 4; ADR 0002 "No live test runs a full pass against the shared graph,
 *             and none publishes a tagging"):
 *               - works only on per-run random fake pubkeys, and checks first that the graph holds none of them and
 *                 none of its tagging addresses (every address names one of those pubkeys);
 *               - writes only its own fixtures — its people, one FOLLOWS between two of them, and TAGS relationships
 *                 at its own addresses — through the pass's own port (openGraph) and plans made by planPass from
 *                 events built in memory; it runs no pass, reads no relay and publishes nothing;
 *               - deletes only those fixtures, by address and by per-run pubkey, and never with DETACH: a fixture
 *                 node that gained any other relationship is left in place and reported;
 *               - needs the one-per-tagging rule tags_address ONLINE (the boot hook creates it: restart the backend
 *                 after implementing). Do not run it while a reconcileTaggingEdges pass runs on the same stack —
 *                 that pass would see the sandbox's relationships as not on the relay.
 *
 * Every pubkey here is fake: the fixture helper's stand-ins or crypto.randomBytes values. No deployment's TA and
 * never the ADR 0015 literal; the canonical identity is a parameter of the contract (ADR 0001).
 * Hand-rolled in the project's existing test style — no new framework. Works on Node 16 and 22.
 */

const crypto = require('crypto');
const F = require('./helpers/taggingEdgesFixtures');

const GRAPH_REQUIRE = '../src/pipeline/tagging-edges/graph';
const GRAPH_FILE = 'src/pipeline/tagging-edges/graph.js';
const SWEEP_REQUIRE = '../src/lib/tagging-edges/sweep';
const SWEEP_FILE = 'src/lib/tagging-edges/sweep.js';

const WRITE_OPT_IN = 'TAGGING_EDGES_LIVE_WRITE_TESTS';
const BIG = '9007199254740993'; // 2^53 + 1: the first integer a JS number cannot hold
const BIG_MINUS_ONE = '9007199254740992'; // 2^53: what a lossy read turns BIG into
const WAIT_TO_SEE_BLOCKING_MS = 1500;
const APPLY_TIMEOUT_MS = 30000;
const SNAPSHOT_TIMEOUT_MS = 120000;

// ─── assertion helpers ───────────────────────────────────────────────────────────────────────────────────────────
const tests = [];
/** kind: 'ro' (read-only) or 'sandbox' (opt-in writes). */
function test(name, fn, kind = 'ro') { tests.push([name, fn, kind]); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function firstLine(s) { return String(s == null ? '' : s).split('\n')[0]; }

/** A driver Integer (duck-typed, so no driver is needed to print one). */
function isNeoInt(v) {
  return !!v && typeof v === 'object' && typeof v.low === 'number' && typeof v.high === 'number' && typeof v.toNumber === 'function';
}

/**
 * A canonical, key-order-blind text for any value the driver or a module returns: BigInt as `<n>n`, a driver
 * Integer as `int(<n>)`, a temporal or point value as `<Type>(<text>)`. Two values are "the same" when their texts
 * are equal; it never throws on a BigInt (JSON.stringify does).
 */
function canonical(v) {
  if (v === undefined) return 'undefined';
  if (v === null) return 'null';
  if (typeof v === 'bigint') return `${v}n`;
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v === 'function') return `function ${v.name || ''}`;
  if (isNeoInt(v)) return `int(${v.toString()})`;
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (typeof v === 'object') {
    const proto = Object.getPrototypeOf(v);
    if (proto !== Object.prototype && proto !== null) return `${(v.constructor && v.constructor.name) || 'Object'}(${String(v)})`;
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  }
  return String(v);
}
const show = (v) => { const s = canonical(v); return s.length > 600 ? `${s.slice(0, 600)}…` : s; };
function eq(actual, expected, label) {
  const a = canonical(actual);
  const e = canonical(expected);
  if (a !== e) throw new Error(`${label}\n        expected: ${e}\n        actual:   ${a}`);
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function withTimeout(promise, ms, what) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${what}: no answer within ${ms} ms`)), ms); }),
  ]).finally(() => clearTimeout(timer));
}
/** Watch a promise without awaiting it: `.settled` flips when it resolves or rejects. */
function track(promise) {
  const t = { settled: false, value: undefined, error: undefined };
  t.promise = promise.then((v) => { t.settled = true; t.value = v; return v; }, (e) => { t.settled = true; t.error = e; throw e; });
  t.promise.catch(() => {});
  return t;
}

// ─── the modules under test, lazily ──────────────────────────────────────────────────────────────────────────────
function loadModule(req, file, names) {
  let m;
  try { m = require(req); }
  catch (e) { throw new Error(`${file} not implemented yet (require('${req}') failed: ${firstLine(e.message)})`); }
  const absent = names.filter((n) => m[n] === undefined);
  if (absent.length) throw new Error(`${file} not implemented yet: it does not export ${absent.join(', ')} (ADR tagging-edges/0002, Implementation notes)`);
  return m;
}
/** src/pipeline/tagging-edges/graph.js — the Neo4j port (ADR 0002 Implementation notes). */
const loadGraph = (...names) => loadModule(GRAPH_REQUIRE, GRAPH_FILE, names);
/** src/lib/tagging-edges/sweep.js — the pure planner (ADR 0002 Implementation notes). */
const loadSweep = (...names) => loadModule(SWEEP_REQUIRE, SWEEP_FILE, names);

// ─── the local stack ─────────────────────────────────────────────────────────────────────────────────────────────
const SKIP = 'SKIP';
function skip(reason) { console.log(`        (skipped: ${reason})`); return SKIP; }

function isLocalHost(h) {
  const x = String(h || '').toLowerCase();
  return x === 'localhost' || x === '127.0.0.1' || x === '[::1]' || x === '::1' || x.endsWith('.localhost');
}

let liveMemo = null;
/** The suite's own read connection: `{ ok: true, neo4j, driver, where, creds }` or `{ ok: false, reason }`. Memoized. */
function live() {
  if (!liveMemo) liveMemo = connect();
  return liveMemo;
}
async function connect() {
  const uri = process.env.NEO4J_URI;
  const user = process.env.NEO4J_USER;
  const password = process.env.NEO4J_PASSWORD;
  if (!uri || !user || !password) {
    return { ok: false, reason: 'set NEO4J_URI, NEO4J_USER and NEO4J_PASSWORD (the local stack\'s Bolt address and credentials) to run the live checks' };
  }
  const redact = (s) => String(s).split(password).join('<redacted>');
  let url;
  try { url = new URL(uri); } catch (_) { return { ok: false, reason: 'NEO4J_URI is not a URI' }; }
  if (url.username || url.password) return { ok: false, reason: 'NEO4J_URI carries credentials of its own; give them in NEO4J_USER / NEO4J_PASSWORD instead' };
  if (!isLocalHost(url.hostname)) return { ok: false, reason: `NEO4J_URI names ${url.hostname}, not a local host — this suite runs against the local stack only` };
  const where = `${url.hostname}:${url.port || '7687'}`;
  let neo4j;
  try { neo4j = require('neo4j-driver'); }
  catch (e) { return { ok: false, reason: `neo4j-driver is not installed on this host (${firstLine(e.message)}); run npm ci` }; }
  let driver;
  try {
    driver = neo4j.driver(uri, neo4j.auth.basic(user, password), { connectionTimeout: 5000, connectionAcquisitionTimeout: 10000, maxConnectionPoolSize: 8 });
    await withTimeout(driver.getServerInfo(), 10000, `Neo4j at ${where}`);
    return { ok: true, neo4j, driver, where, redact, creds: { uri, user, password } };
  } catch (e) {
    if (driver) await driver.close().catch(() => {});
    return { ok: false, reason: redact(`Neo4j at ${where} is not reachable with those credentials (${e.code || e.name || 'error'}: ${firstLine(e.message)})`) };
  }
}

/** Run one statement in auto-commit mode; records as plain objects (driver values kept as they come). */
async function query(driver, neo4j, mode, cypher, params = {}) {
  const session = driver.session({ defaultAccessMode: mode === 'write' ? neo4j.session.WRITE : neo4j.session.READ });
  try {
    const res = await session.run(cypher, params, { timeout: 60000 });
    return { records: res.records.map((r) => r.toObject()), summary: res.summary };
  } finally {
    await session.close().catch(() => {});
  }
}
const readRows = (L, cypher, params) => query(L.driver, L.neo4j, 'read', cypher, params);
const writeRows = (L, cypher, params) => query(L.driver, L.neo4j, 'write', cypher, params);

/** READ_ALL's property projection (ADR 0002 graph.js statements) over any relationship or map variable. */
const PROPS_OF = (v) => `[k IN keys(${v}) | [k, valueType(${v}[k]), `
  + `CASE WHEN valueType(${v}[k]) IN $scalarTypes THEN toString(${v}[k]) END, `
  + `CASE WHEN NOT valueType(${v}[k]) IN $scalarTypes THEN ${v}[k] END]]`;
const sortByKey = (entries) => [...entries].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

let ogMemo = null;
/**
 * The driver `openGraph` builds for itself. openGraph exposes no raw query, so the suite wraps
 * require('neo4j-driver').driver while openGraph runs (and, if it builds lazily, while one read-only readSchema()
 * runs) to get hold of the driver object it made — with the pass's own settings — and restores it straight after.
 */
function openGraphDriver(L) {
  if (!ogMemo) ogMemo = (async () => {
    const graph = loadGraph('openGraph');
    const neo4j = L.neo4j;
    const built = [];
    const real = neo4j.driver;
    const realDefault = neo4j.default ? neo4j.default.driver : undefined;
    const spy = function spyDriver(...args) { const d = real.apply(this, args); built.push(d); return d; };
    neo4j.driver = spy;
    if (neo4j.default) neo4j.default.driver = spy;
    let g;
    try {
      g = await graph.openGraph({ uri: L.creds.uri, user: L.creds.user, password: L.creds.password });
      if (!built.length && g && typeof g.readSchema === 'function') await g.readSchema();
    } finally {
      neo4j.driver = real;
      if (neo4j.default) neo4j.default.driver = realDefault;
    }
    return { g, driver: built[0] };
  })();
  return ogMemo;
}

/** SHOW CONSTRAINTS and SHOW INDEXES, as the driver returns them. */
async function showRows(L) {
  const c = await readRows(L, 'SHOW CONSTRAINTS');
  const i = await readRows(L, 'SHOW INDEXES');
  return { constraints: c.records, indexes: i.records };
}
const sameList = (a, b) => Array.isArray(a) && a.length === b.length && a.every((x, i) => x === b[i]);
/** The uniqueness rules matching a definition — ADR 0002: entity type, labels/types, properties, a type ending in UNIQUENESS. */
function rulesByDefinition(rows, entityType, labelOrType, property) {
  return rows.constraints.filter((r) => r.entityType === entityType && sameList(r.labelsOrTypes, [labelOrType])
    && sameList(r.properties, [property]) && typeof r.type === 'string' && /UNIQUENESS$/.test(r.type));
}
function withoutRules(rows, rules) {
  const names = new Set(rules.map((r) => r.name));
  const owned = new Set(rules.map((r) => r.ownedIndex));
  return { constraints: rows.constraints.filter((r) => !names.has(r.name)), indexes: rows.indexes.filter((i) => !owned.has(i.name)) };
}

// ═══ Read-only (default) ═════════════════════════════════════════════════════════════════════════════════════════

// ADR 0002 Context ("A plain JS number parameter is stored as FLOAT; neo4j.int() or a BigInt pins INTEGER") and D5:
// why toWriteProps sends createdAt as a BigInt. A premise about the driver and the database, not new code.
test('SL1: a BigInt or neo4j.int parameter reaches Neo4j as an INTEGER, and a JS number with the same value as a FLOAT [ADR 0002 Context, D5]', async () => {
  const L = await live();
  if (!L.ok) return skip(L.reason);
  const { records } = await readRows(L, 'RETURN valueType($big) AS big, valueType($viaInt) AS viaInt, valueType($num) AS num',
    { big: BigInt(1000), viaInt: L.neo4j.int(1000), num: 1000 });
  eq(records[0].big, 'INTEGER NOT NULL', 'valueType of the BigInt parameter 1000n');
  eq(records[0].viaInt, 'INTEGER NOT NULL', 'valueType of the parameter neo4j.int(1000)');
  eq(records[0].num, 'FLOAT NOT NULL', 'valueType of the JS number parameter 1000 (this is why a stored createdAt must not be sent as a number)');
  return undefined;
});

// ADR 0002 graph.js `toWriteProps(edge)` (the nine keys, nulls omitted, createdAt as BigInt); AC-1 (the values the
// definition gives), AC-8 (nothing else), D5 (createdAt an INTEGER).
test('SL2: every value toWriteProps gives reaches Neo4j with a correctly stored edge\'s type — createdAt an INTEGER, the text values STRINGs, the stamp flags BOOLEANs — and a null property is not sent at all [AC-1, AC-8; ADR 0002 graph.js toWriteProps, D5]', async () => {
  const { toWriteProps } = loadGraph('toWriteProps');
  const L = await live();
  if (!L.ok) return skip(L.reason);
  const cases = [
    ['a resolved tagging carrying the canonical stamp', F.makeTagging({ createdAt: 1700000000 })],
    ['an id-only, unresolved tagging with no stance, carrying both stamps',
      F.makeTagging({ a: null, polarity: null, stamps: [F.Z.canonicalTagging, F.Z.localTagging], createdAt: 1700000001, id: F.idOf(0x101) })],
  ];
  for (const [label, ev] of cases) {
    const edge = F.contractEdge(ev);
    const { records } = await readRows(L, 'RETURN [k IN keys($p) | [k, valueType($p[k])]] AS types', { p: toWriteProps(edge) });
    const want = sortByKey(F.storedRow(edge).props.map(([k, type]) => [k, type]));
    eq(sortByKey(records[0].types), want, `${label}: each key of toWriteProps(edge) with the type Neo4j receives it as`);
  }
  return undefined;
});

// ADR 0002 runner step 5 ("Integers stay lossless; every count graph.js compares goes through toCount"), graph.js
// `toCount`; Seams → Live: "a count() read through openGraph and toCount is a JS number".
test('SL3: a count() read through the driver openGraph builds, passed through toCount, is a JS number equal to the count [ADR 0002 runner step 5, graph.js toCount]', async () => {
  const { toCount } = loadGraph('openGraph', 'toCount');
  const L = await live();
  if (!L.ok) return skip(L.reason);
  const { driver } = await openGraphDriver(L);
  assert(driver, 'openGraph({ uri, user, password }) built no driver through require(\'neo4j-driver\').driver(…) — the pass builds its own driver (ADR 0002 runner step 5)');
  const { records } = await query(driver, L.neo4j, 'read', 'UNWIND range(1, 3) AS x RETURN count(x) AS n');
  const raw = records[0].n;
  const n = toCount(raw);
  assert(typeof n === 'number' && n === 3,
    `expected toCount(count()) to be the JS number 3, so a count compares with ===; got ${typeof n} ${show(n)} (openGraph's driver returned ${show(raw)})`);
  return undefined;
});

// ADR 0002 "The guard" step 4 (raw values serialised canonically in JS, a driver Integer as String(v); "the pass's
// driver keeps integers lossless, so a driver Integer prints exactly"); Seams → Live: "a stored list holding 2^53+1
// reaches the fingerprint exactly". A literal in a RETURN, never a stored edge.
test('SL4: a list holding 2^53+1, read through openGraph\'s driver with READ_ALL\'s projection, reaches the fingerprint exactly — it differs from the same list holding 2^53, and a second read gives the same fingerprint [ADR 0002 The guard step 4]', async () => {
  const { SCALAR_TYPES } = loadGraph('openGraph', 'SCALAR_TYPES');
  const { fingerprint } = loadSweep('fingerprint');
  const L = await live();
  if (!L.ok) return skip(L.reason);
  const { driver } = await openGraphDriver(L);
  assert(driver, 'openGraph({ uri, user, password }) built no driver through require(\'neo4j-driver\').driver(…) — the pass builds its own driver (ADR 0002 runner step 5)');
  const propsOf = async (literal) => {
    const { records } = await query(driver, L.neo4j, 'read', `WITH ${literal} AS r RETURN ${PROPS_OF('r')} AS props`, { scalarTypes: SCALAR_TYPES });
    return records[0].props;
  };
  const row = (props) => ({
    rid: '5:sl4:0', fromPubkey: F.ALICE, fromPubkeyType: 'STRING NOT NULL', fromIsUser: true,
    toPubkey: F.BOB, toPubkeyType: 'STRING NOT NULL', toIsUser: true, props,
  });

  const listBig = await propsOf(`{address: 'sl4', bigs: [${BIG}, 1]}`);
  const listBigAgain = await propsOf(`{address: 'sl4', bigs: [${BIG}, 1]}`);
  const listLess = await propsOf(`{address: 'sl4', bigs: [${BIG_MINUS_ONE}, 1]}`);
  const entry = listBig.find((p) => p[0] === 'bigs');
  assert(entry && Array.isArray(entry[3]) && String(entry[3][0]) === BIG,
    `openGraph's driver must keep integers lossless (ADR 0002 runner step 5): the list's first element should print as ${BIG}; the projection gave ${show(entry)}`);

  const fp = fingerprint(row(listBig));
  assert(typeof fp === 'string', `fingerprint(row) should be the guard's canonical serialisation, a string compared with ===; got ${typeof fp} ${show(fp)}`);
  assert(fp.includes(BIG), `the fingerprint should carry the list element exactly as ${BIG} (a driver Integer serialised as String(v)); got ${show(fp)}`);
  eq(fingerprint(row(listBigAgain)), fp, 'the fingerprint of a second read of the same list (snapshot and re-read must match)');
  assert(fingerprint(row(listLess)) !== fp,
    `a list holding 2^53 must not fingerprint like one holding 2^53+1 — otherwise the guard cannot see a change there; both gave ${show(fp)}`);

  const scalarBig = await propsOf(`{address: 'sl4', big: ${BIG}}`);
  const scalarLess = await propsOf(`{address: 'sl4', big: ${BIG_MINUS_ONE}}`);
  const s = scalarBig.find((p) => p[0] === 'big');
  eq(s, ['big', 'INTEGER NOT NULL', BIG, null], 'an INTEGER 2^53+1 travels as Cypher\'s toString text');
  assert(fingerprint(row(scalarBig)) !== fingerprint(row(scalarLess)), 'an INTEGER 2^53+1 must not fingerprint like 2^53');
  return undefined;
});

// ADR 0002 graph.js statements (READ_ALL, executeRead, 120 s); Seams → Live: "no Eager in READ_ALL's plan".
test('SL5: READ_ALL\'s EXPLAIN plan on the local Neo4j streams — it has no Eager operator [ADR 0002 graph.js READ_ALL]', async () => {
  const { CYPHER, SCALAR_TYPES } = loadGraph('CYPHER', 'SCALAR_TYPES');
  assert(CYPHER && typeof CYPHER.READ_ALL === 'string' && CYPHER.READ_ALL.trim() !== '',
    `graph.js CYPHER.READ_ALL should hold the snapshot statement's text; got ${show(CYPHER && CYPHER.READ_ALL)}`);
  const L = await live();
  if (!L.ok) return skip(L.reason);
  const { summary } = await readRows(L, `EXPLAIN ${CYPHER.READ_ALL}`, { scalarTypes: SCALAR_TYPES });
  const plan = summary && summary.plan;
  assert(plan && plan.operatorType, `EXPLAIN READ_ALL returned no plan: ${show(plan)}`);
  const ops = [];
  (function walk(op) { ops.push(op.operatorType); (op.children || []).forEach(walk); })(plan);
  const eager = ops.filter((o) => /^eager/i.test(String(o)));
  assert(eager.length === 0, `READ_ALL's plan should have no Eager operator; its operators are ${ops.join(' ← ')}`);
  return undefined;
});

// ADR 0002 graph.js `schemaStatusFromRows(constraints, indexes)` and runner step 6 ("nostrUser_pubkey present by
// definition, else refused"); Seams → Live: "schemaStatusFromRows against real SHOW output". The function's return
// shape is the Implementer's, so the checks compare its answers rather than read them.
test('SL6: schemaStatusFromRows reads the real SHOW CONSTRAINTS / SHOW INDEXES output without throwing, and recognises the real nostrUser_pubkey rule — removing it changes the answer [ADR 0002 graph.js schemaStatusFromRows, runner step 6]', async () => {
  const { schemaStatusFromRows } = loadGraph('schemaStatusFromRows');
  const L = await live();
  if (!L.ok) return skip(L.reason);
  const real = await showRows(L);
  assert(real.constraints.length > 0 && real.indexes.length > 0, `SHOW CONSTRAINTS / SHOW INDEXES returned no rows on ${L.where}`);
  const needC = ['name', 'type', 'entityType', 'labelsOrTypes', 'properties', 'ownedIndex'];
  const needI = ['name', 'state', 'entityType', 'labelsOrTypes', 'properties', 'owningConstraint'];
  const cGap = needC.filter((k) => !(k in real.constraints[0]));
  const iGap = needI.filter((k) => !(k in real.indexes[0]));
  assert(!cGap.length && !iGap.length,
    `the real SHOW rows should carry the columns ADR 0002's definition reads; constraints lack ${cGap.join(', ') || 'nothing'}, indexes lack ${iGap.join(', ') || 'nothing'}`);
  const status = (rows, label) => {
    try { return canonical(schemaStatusFromRows(rows.constraints, rows.indexes)); }
    catch (e) { throw new Error(`schemaStatusFromRows threw on ${label}: ${e.message}`); }
  };
  const sReal = status(real, 'the real SHOW rows');
  const users = rulesByDefinition(real, 'NODE', 'NostrUser', 'pubkey');
  if (!users.length) return skip(`the stack at ${L.where} has no NostrUser.pubkey uniqueness rule to recognise`);
  const sNoUsers = status(withoutRules(real, users), 'the real rows without nostrUser_pubkey');
  assert(sNoUsers !== sReal,
    `schemaStatusFromRows gave the same answer with and without the real ${users[0].name} rule, so it does not recognise it in real SHOW output (the pass must refuse without it); answer: ${sReal.slice(0, 400)}`);
  return undefined;
});

// ADR 0002 graph.js `schemaStatusFromRows` (tags_address present by definition — RELATIONSHIP, ['TAGS'],
// ['address'], a type ending in UNIQUENESS, owned index ONLINE — and by name, reporting "present under another
// name"), runner step 6, D12; AC-6.
test('SL7: in real SHOW-shaped rows, schemaStatusFromRows finds tags_address by its definition — the answer changes without it, with its index not ONLINE, and under another name, which still reads apart from absent [AC-6; ADR 0002 graph.js schemaStatusFromRows, runner step 6]', async () => {
  const { schemaStatusFromRows } = loadGraph('schemaStatusFromRows');
  const L = await live();
  if (!L.ok) return skip(L.reason);
  const real = await showRows(L);
  let rows = real;
  let rule = rulesByDefinition(real, 'RELATIONSHIP', 'TAGS', 'address')[0];
  if (rule) {
    console.log(`        (tags_address: the stack's own rule, named ${rule.name})`);
  } else {
    // This stack has no rule yet: model its rows on a real uniqueness rule's rows, so every column and value type
    // is what this Neo4j returns.
    const tmpl = rulesByDefinition(real, 'NODE', 'NostrUser', 'pubkey')[0]
      || real.constraints.find((r) => typeof r.type === 'string' && /UNIQUENESS$/.test(r.type));
    const tmplIndex = tmpl && real.indexes.find((i) => i.name === tmpl.ownedIndex);
    if (!tmpl || !tmplIndex) return skip(`the stack at ${L.where} has no uniqueness rule with an owned index to model a tags_address row on`);
    console.log(`        (tags_address: not on this stack yet — modelled on the real ${tmpl.name} rows)`);
    rule = { ...tmpl, name: 'tags_address', type: 'RELATIONSHIP_UNIQUENESS', entityType: 'RELATIONSHIP', labelsOrTypes: ['TAGS'], properties: ['address'], ownedIndex: 'tags_address' };
    const index = { ...tmplIndex, name: 'tags_address', state: 'ONLINE', entityType: 'RELATIONSHIP', labelsOrTypes: ['TAGS'], properties: ['address'], owningConstraint: 'tags_address' };
    rows = { constraints: [...real.constraints, rule], indexes: [...real.indexes, index] };
  }
  const index = rows.indexes.find((i) => i.name === rule.ownedIndex);
  assert(index, `the tags_address rule's owned index ${rule.ownedIndex} is not in SHOW INDEXES`);
  const status = (r, label) => {
    try { return canonical(schemaStatusFromRows(r.constraints, r.indexes)); }
    catch (e) { throw new Error(`schemaStatusFromRows threw on ${label}: ${e.message}`); }
  };
  const swapIndex = (r, over) => ({ constraints: r.constraints, indexes: r.indexes.map((i) => (i === index ? { ...i, ...over } : i)) });
  const other = rule.name === 'tags_address' ? 'tags_address_under_another_name' : 'tags_address';
  const renamed = {
    constraints: rows.constraints.map((c) => (c === rule ? { ...c, name: other, ownedIndex: other } : c)),
    indexes: rows.indexes.map((i) => (i === index ? { ...i, name: other, owningConstraint: other } : i)),
  };
  const sWith = status(rows, 'rows with the rule');
  const sWithout = status(withoutRules(rows, [rule]), 'rows without the rule');
  const sNotOnline = status(swapIndex(rows, { state: 'POPULATING' }), 'rows whose owned index is POPULATING');
  const sRenamed = status(renamed, `rows with the rule named ${other}`);
  assert(sWith !== sWithout, `schemaStatusFromRows should tell rows with the one-per-tagging rule from rows without it; both gave ${sWith.slice(0, 400)}`);
  assert(sNotOnline !== sWith, `schemaStatusFromRows should not read the rule as in place while its owned index is POPULATING rather than ONLINE; both gave ${sWith.slice(0, 400)}`);
  assert(sRenamed !== sWith, `schemaStatusFromRows should report the rule named ${other} apart from the rule named ${rule.name} ("present under another name"); both gave ${sWith.slice(0, 400)}`);
  assert(sRenamed !== sWithout, `schemaStatusFromRows should still find the rule by its definition when it is named ${other}, not read it as absent; both gave ${sWithout.slice(0, 400)}`);
  return undefined;
});

// ═══ The opt-in write sandbox (TAGGING_EDGES_LIVE_WRITE_TESTS=1) ═══════════════════════════════════════════════════

const SB = { ready: false, mayHoldFixtures: false, cleaned: false, g: null, L: null, run: null, pk: null, addr: null, before: null };

function sandboxOff() {
  return process.env[WRITE_OPT_IN] === '1'
    ? null
    : `opt-in: set ${WRITE_OPT_IN}=1 to run the write sandbox (it writes, then deletes, its own fixtures on the local graph)`;
}
function requireSandbox() {
  if (!SB.ready) throw new Error('the write sandbox is not set up — SL8 did not complete (see its failure above)');
  return SB;
}
const allPubkeys = () => Object.values(SB.pk);
const allAddresses = () => Object.values(SB.addr);
const short = (pk) => `${String(pk).slice(0, 8)}…`;

/** The per-run tagging for one sandbox address. */
function sandboxTagging(key, { target, createdAt, version = 'v1', polarity = '1', stamps } = {}) {
  const address = SB.addr[key];
  const [, author, d] = /^39999:([0-9a-f]{64}):(.+)$/s.exec(address);
  return F.makeTagging({
    author, d, target, createdAt, polarity, id: F.idOf(`${SB.run}:${key}:${version}`),
    ...(stamps ? { stamps } : {}),
  });
}

/** The nine properties with createdAt as a BigInt: what a correct writer sends (the fixture's own, not toWriteProps). */
function fixtureWriteProps(edge) {
  const out = {};
  for (const k of F.PROPERTY_KEYS) if (edge[k] !== null && edge[k] !== undefined) out[k] = k === 'createdAt' ? BigInt(edge[k]) : edge[k];
  return out;
}

/** openGraph().readAll's rows, narrowed to the given sandbox addresses (planPass must never see another relationship). */
async function snapshotAt(keys) {
  const res = await SB.g.readAll({ timeoutMs: SNAPSHOT_TIMEOUT_MS });
  const rows = Array.isArray(res) ? res : (res && Array.isArray(res.rows) ? res.rows : null);
  assert(rows, `openGraph().readAll({ timeoutMs }) should give the snapshot rows (READ_ALL's projection); got ${show(res)}`);
  const want = new Set(keys.map((k) => SB.addr[k]));
  const addressOf = (r) => { const e = r && Array.isArray(r.props) && r.props.find((p) => p[0] === 'address'); return e ? e[2] : undefined; };
  return rows.filter((r) => want.has(addressOf(r)));
}

function planFor(snapshotRows, relayEvents) {
  const { planPass } = loadSweep('planPass');
  const plan = planPass({ snapshotRows, relayEvents, identities: F.IDENTITIES, confirmedHeld: null });
  assert(plan && typeof plan === 'object', `planPass should return a plan; got ${show(plan)}`);
  return plan;
}
const listLen = (x) => (Array.isArray(x) ? x.length : `not a list (${show(x)})`);
function expectPlan(plan, want, label) {
  const got = { creates: listLen(plan.creates), updates: listLen(plan.updates), moves: listLen(plan.moves), removals: listLen(plan.removals) };
  eq(got, want, `${label}: planPass's creates / updates / moves / removals`);
}
function expectCounters(result, want, label) {
  const bad = Object.keys(want).filter((k) => !(result && typeof result[k] === 'number' && result[k] === want[k]));
  assert(bad.length === 0,
    `${label}: expected ${Object.keys(want).map((k) => `${k} = ${want[k]}`).join(', ')} as JS numbers (counters from committed attempts); got ${show(result)}`);
}

/** The TAGS relationships at one sandbox address, read with READ_ALL's projection. */
async function edgesAt(key) {
  const { records } = await readRows(SB.L,
    `MATCH (s)-[r:TAGS {address: $a}]->(t) RETURN elementId(r) AS rid, s.pubkey AS from, t.pubkey AS to, labels(s) AS fromLabels, labels(t) AS toLabels, ${PROPS_OF('r')} AS props`,
    { a: SB.addr[key], scalarTypes: F.SCALAR_TYPES });
  return records;
}
/** Exactly one relationship at the address, between NostrUser nodes, holding exactly what the definition gives. */
async function expectEdge(key, event, label, rowOptions = {}) {
  const rows = await edgesAt(key);
  eq(rows.length, 1, `${label}: the number of TAGS relationships at ${key}'s address`);
  const edge = F.contractEdge(event);
  const r = rows[0];
  eq([r.from, r.to], [edge.from, edge.to], `${label}: the relationship's ends (from → to pubkeys)`);
  assert(r.fromLabels.includes('NostrUser') && r.toLabels.includes('NostrUser'), `${label}: both ends should be NostrUser nodes; got ${show([r.fromLabels, r.toLabels])}`);
  eq(sortByKey(r.props), sortByKey(F.storedRow(edge, rowOptions).props), `${label}: the relationship's properties with their stored types`);
  return r;
}

/** A person's labels, properties and every non-TAGS relationship (element id, type, direction, other end, properties). */
async function personState(pk) {
  const { records } = await readRows(SB.L,
    `MATCH (n:NostrUser {pubkey: $pk})
     OPTIONAL MATCH (n)-[x]-(m) WHERE type(x) <> 'TAGS'
     RETURN elementId(n) AS id, labels(n) AS labels, properties(n) AS props,
            collect(CASE WHEN x IS NULL THEN null ELSE [type(x), elementId(x), startNode(x) = n, m.pubkey, properties(x)] END) AS rels`,
    { pk });
  return records.map((r) => ({ ...r, rels: [...r.rels].sort((a, b) => (a[1] < b[1] ? -1 : 1)) }));
}

/** Another session's transaction, left open so the pass's port meets it uncommitted. */
function otherTransaction() {
  const session = SB.L.driver.session({ defaultAccessMode: SB.L.neo4j.session.WRITE });
  const tx = session.beginTransaction({ timeout: 60000 });
  let open = true;
  return {
    tx,
    async commit() { open = false; await tx.commit(); },
    async close() { if (open) { open = false; await tx.rollback().catch(() => {}); } await session.close().catch(() => {}); },
  };
}

/** Delete exactly the sandbox's fixtures: TAGS at its addresses, the one FOLLOWS, then its people — never DETACH. */
async function cleanSandbox() {
  const L = SB.L;
  const tags = await writeRows(L, 'UNWIND $addrs AS a MATCH ()-[r:TAGS {address: a}]->() DELETE r RETURN count(*) AS n', { addrs: allAddresses() });
  const follows = await writeRows(L, 'MATCH (:NostrUser {pubkey: $p})-[f:FOLLOWS]->(:NostrUser {pubkey: $q}) DELETE f RETURN count(*) AS n', { p: SB.pk.P, q: SB.pk.Q });
  let people;
  try {
    people = await writeRows(L, 'UNWIND $pks AS pk MATCH (n:NostrUser {pubkey: pk}) DELETE n RETURN count(*) AS n', { pks: allPubkeys() });
  } catch (e) {
    const { records } = await readRows(L, 'MATCH (n:NostrUser)-[x]-() WHERE n.pubkey IN $pks RETURN n.pubkey AS pk, type(x) AS type, count(*) AS n', { pks: allPubkeys() });
    throw new Error(`the sandbox left its people in place: one still has a relationship it did not create (${records.map((r) => `${short(r.pk)} ${r.type} ×${r.n}`).join('; ')}) — ${firstLine(e.message)}`);
  }
  SB.cleaned = true;
  const n = (res) => Number(String(res.records[0].n));
  return { tags: n(tags), follows: n(follows), people: n(people) };
}

// ADR 0002 Seams → Live ("An opt-in write sandbox … on per-run fake pubkeys checked absent first, touching only its
// own fixtures and deleting only them"); AC-6 (the rule is in place before any pass writes); CLAUDE.md principle 4.
test('SL8: the write sandbox starts only on per-run fake pubkeys and tagging addresses the graph does not hold, only with the one-per-tagging rule tags_address ONLINE, and sets up its own fixture people [AC-6; ADR 0002 Seams → Live]', async () => {
  const off = sandboxOff();
  if (off) return skip(off);
  const graph = loadGraph('openGraph', 'toCount');
  loadSweep('planPass', 'fingerprint');
  const L = await live();
  if (!L.ok) throw new Error(`${WRITE_OPT_IN}=1, but the local stack is not available: ${L.reason}`);
  SB.L = L;
  SB.run = crypto.randomBytes(4).toString('hex');
  const fresh = () => crypto.randomBytes(32).toString('hex');
  // A and C are new people the pass adds; P (with properties and a FOLLOWS to Q), Q, B and T exist beforehand.
  SB.pk = { A: fresh(), C: fresh(), P: fresh(), Q: fresh(), B: fresh(), T: fresh() };
  const d = (what) => `sl-${SB.run}-${what}`;
  SB.addr = {
    T1: `39999:${SB.pk.A}:${d('create-1')}`, T8: `39999:${SB.pk.A}:${d('create-2')}`,
    T7: `39999:${SB.pk.T}:${d('duplicate')}`, T2: `39999:${SB.pk.T}:${d('race')}`,
    T3: `39999:${SB.pk.T}:${d('lock')}`, T4: `39999:${SB.pk.T}:${d('float')}`,
    T5: `39999:${SB.pk.T}:${d('move-to')}`, T6: `39999:${SB.pk.P}:${d('move-from')}`,
  };

  const people = await readRows(L, 'MATCH (n:NostrUser) WHERE n.pubkey IN $pks RETURN count(n) AS n', { pks: allPubkeys() });
  const tagsHeld = await readRows(L, 'UNWIND $addrs AS a MATCH ()-[r:TAGS {address: a}]->() RETURN count(r) AS n', { addrs: allAddresses() });
  const nPeople = Number(String(people.records[0].n));
  const nTags = Number(String(tagsHeld.records[0].n));
  assert(nPeople === 0 && nTags === 0,
    `refusing to write: the graph already holds ${nPeople} of the sandbox's per-run people and ${nTags} of its TAGS addresses — it touches only fixtures it creates`);

  const schema = await showRows(L);
  const rule = rulesByDefinition(schema, 'RELATIONSHIP', 'TAGS', 'address')[0];
  const index = rule && schema.indexes.find((i) => i.name === rule.ownedIndex);
  assert(rule && index && index.state === 'ONLINE',
    `the sandbox needs the one-per-tagging rule in place and ONLINE (AC-6: from the time the instance runs this change — the boot hook creates tags_address; restart the backend after implementing); SHOW CONSTRAINTS ${rule ? `has ${rule.name}, its index ${index ? index.state : 'missing'}` : 'has no RELATIONSHIP uniqueness rule on TAGS.address'}`);

  SB.g = await graph.openGraph({ uri: L.creds.uri, user: L.creds.user, password: L.creds.password });
  const portGap = ['readAll', 'applyCreates', 'applyLocked', 'close'].filter((m) => !SB.g || typeof SB.g[m] !== 'function');
  assert(portGap.length === 0, `openGraph({ uri, user, password }) should return the port { readSchema, ensureTagsConstraint, readAll, applyLocked, applyCreates, close }; it lacks ${portGap.join(', ')}`);
  SB.mayHoldFixtures = true;
  await writeRows(L,
    `CREATE (p:NostrUser {pubkey: $P, influence: 0.25, hops: $hops, verifiedFollowerCount: $followers, personalizedPageRank: 0.000125, npub: 'sandbox-fixture', tags: ['sandbox', 'fixture']})
     CREATE (q:NostrUser {pubkey: $Q, influence: 0.5})
     CREATE (:NostrUser {pubkey: $B})
     CREATE (:NostrUser {pubkey: $T})
     CREATE (p)-[:FOLLOWS {timestamp: $ts}]->(q)`,
    { P: SB.pk.P, Q: SB.pk.Q, B: SB.pk.B, T: SB.pk.T, hops: BigInt(3), followers: BigInt(12), ts: BigInt(1700000000) });
  SB.before = {};
  for (const who of ['P', 'Q', 'B', 'T']) SB.before[who] = await personState(SB.pk[who]);
  eq(SB.before.P.length === 1 && SB.before.P[0].rels.length, 1, 'the fixture person P has exactly its one FOLLOWS before any write');
  SB.ready = true;
  return undefined;
}, 'sandbox');

// AC-1 (one relationship per tagging address with the definition's values; a missing person added once, keyed by
// pubkey and carrying nothing else); ADR 0002 D6 (bare keyed MERGE), graph.js applyCreates → { applied, lostRace,
// nodesCreated, transientRetries }, counters as numbers through toCount.
test('SL9: applyCreates writes one relationship per tagging with exactly the definition\'s values, adds a missing tagger once — keyed by pubkey and carrying nothing else — and reports its counts as JS numbers [AC-1, AC-8; ADR 0002 D6, graph.js applyCreates]', async () => {
  const off = sandboxOff();
  if (off) return skip(off);
  requireSandbox();
  const t1 = sandboxTagging('T1', { target: SB.pk.P, createdAt: 1000 });
  const t8 = sandboxTagging('T8', { target: SB.pk.B, createdAt: 1001, stamps: [F.Z.localTagging] });
  const plan = planFor(await snapshotAt(['T1', 'T8']), [t1, t8]);
  expectPlan(plan, { creates: 2, updates: 0, moves: 0, removals: 0 }, 'two new taggings');
  const result = await SB.g.applyCreates(plan.creates, { timeoutMs: APPLY_TIMEOUT_MS });
  expectCounters(result, { applied: 2, lostRace: 0, nodesCreated: 1 }, 'applyCreates for two taggings by one new tagger (A) naming two existing people');
  await expectEdge('T1', t1, 'T1 (canonical stamp)');
  await expectEdge('T8', t8, 'T8 (local stamp only)');
  const { records } = await readRows(SB.L, 'MATCH (n:NostrUser {pubkey: $pk}) RETURN labels(n) AS labels, properties(n) AS props', { pk: SB.pk.A });
  eq(records.length, 1, 'NostrUser nodes for the new tagger A (added once)');
  eq(records[0].labels, ['NostrUser'], 'the added person\'s labels');
  eq(records[0].props, { pubkey: SB.pk.A }, 'the added person\'s properties (keyed by pubkey, carrying nothing else)');
  return undefined;
}, 'sandbox');

// AC-6 ("when anything tries to store a second relationship for the same tagging address, then the database refuses
// it"); ADR 0002 D4 / "The guard" (Neo.ClientError.Schema.ConstraintValidationFailed); Seams → Live.
test('SL10: once the pass has written a tagging\'s relationship, the database refuses a second TAGS relationship at that address with Neo.ClientError.Schema.ConstraintValidationFailed, and one relationship remains [AC-6; ADR 0002 D4, Seams → Live]', async () => {
  const off = sandboxOff();
  if (off) return skip(off);
  requireSandbox();
  const t7 = sandboxTagging('T7', { target: SB.pk.P, createdAt: 1000 });
  const plan = planFor(await snapshotAt(['T7']), [t7]);
  expectPlan(plan, { creates: 1, updates: 0, moves: 0, removals: 0 }, 'one new tagging');
  expectCounters(await SB.g.applyCreates(plan.creates, { timeoutMs: APPLY_TIMEOUT_MS }), { applied: 1, lostRace: 0 }, 'applyCreates for T7');
  let err = null;
  try {
    await writeRows(SB.L, 'MATCH (a:NostrUser {pubkey: $from}), (b:NostrUser {pubkey: $to}) CREATE (a)-[r:TAGS {address: $address}]->(b) RETURN count(r) AS n',
      { from: SB.pk.T, to: SB.pk.B, address: SB.addr.T7 });
  } catch (e) { err = e; }
  assert(err, 'the database accepted a second TAGS relationship at T7\'s address — the one-per-tagging rule is not holding');
  eq(err.code, 'Neo.ClientError.Schema.ConstraintValidationFailed', 'the error code of the second create');
  await expectEdge('T7', t7, 'T7 after the refused second create');
  return undefined;
}, 'sandbox');

// ADR 0002 "The guard" ("a concurrent uncommitted create at the same address makes the batch fail with
// ConstraintValidationFailed …, and the pass re-runs that batch one row per transaction, counting the failing row as
// a lost race"); AC-2 ("A pass never overwrites a relationship another writer … created between the pass's read and
// its write; the next pass settles that tagging").
test('SL11: applyCreates racing another session\'s uncommitted create at the same address counts one lost race and creates nothing, and the other session\'s relationship stands [AC-2; ADR 0002 The guard]', async () => {
  const off = sandboxOff();
  if (off) return skip(off);
  requireSandbox();
  const theirs = sandboxTagging('T2', { target: SB.pk.B, createdAt: 900, version: 'v0' });
  const ours = sandboxTagging('T2', { target: SB.pk.B, createdAt: 1000 });
  const plan = planFor(await snapshotAt(['T2']), [ours]);
  expectPlan(plan, { creates: 1, updates: 0, moves: 0, removals: 0 }, 'a tagging the snapshot does not hold');
  const other = otherTransaction();
  let result;
  try {
    await other.tx.run('MATCH (a:NostrUser {pubkey: $from}), (b:NostrUser {pubkey: $to}) CREATE (a)-[r:TAGS]->(b) SET r = $props RETURN count(r) AS n',
      { from: SB.pk.T, to: SB.pk.B, props: fixtureWriteProps(F.contractEdge(theirs)) });
    const apply = track(SB.g.applyCreates(plan.creates, { timeoutMs: APPLY_TIMEOUT_MS }));
    await sleep(WAIT_TO_SEE_BLOCKING_MS);
    try { await other.commit(); }
    catch (e) { throw new Error(`the other session could not commit its create (${e.code || e.name}): the pass created at the same address while that create was pending — ${firstLine(e.message)}`); }
    result = await withTimeout(apply.promise, APPLY_TIMEOUT_MS + 15000, 'applyCreates after the other session committed');
  } finally {
    await other.close();
  }
  expectCounters(result, { applied: 0, lostRace: 1 }, 'applyCreates that lost the race');
  await expectEdge('T2', theirs, 'T2 holds the other session\'s relationship');
  return undefined;
}, 'sandbox');

// ADR 0002 D4-C and "The guard" steps 2–5 (lock, re-read, verify, act), graph.js applyLocked (awaits the injected
// preimage before opening each transaction); Consequences Risk 2 ("the opt-in live test proves it by blocking on an
// uncommitted change"); AC-2 ("A pass never overwrites a relationship another writer changed").
test('SL12: lock first — an uncommitted change to the relationship in another session makes applyLocked wait; after that commit it reports a lost race and leaves the other writer\'s change in place [AC-2; ADR 0002 D4, Risk 2]', async () => {
  const off = sandboxOff();
  if (off) return skip(off);
  requireSandbox();
  const v1 = sandboxTagging('T3', { target: SB.pk.B, createdAt: 1000, polarity: '1' });
  const v2 = sandboxTagging('T3', { target: SB.pk.B, createdAt: 1100, polarity: '-1', version: 'v2' });
  const create = planFor(await snapshotAt(['T3']), [v1]);
  expectPlan(create, { creates: 1, updates: 0, moves: 0, removals: 0 }, 'T3\'s first version');
  expectCounters(await SB.g.applyCreates(create.creates, { timeoutMs: APPLY_TIMEOUT_MS }), { applied: 1, lostRace: 0 }, 'applyCreates for T3');
  const plan = planFor(await snapshotAt(['T3']), [v2]);
  expectPlan(plan, { creates: 0, updates: 1, moves: 0, removals: 0 }, 'a newer version flipping the stance');

  let preimageCalls = 0;
  const preimage = async () => { preimageCalls++; };
  const other = otherTransaction();
  let apply;
  let result;
  try {
    const touched = await other.tx.run("MATCH ()-[r:TAGS {address: $a}]->() SET r.polarity = '0' RETURN count(r) AS n", { a: SB.addr.T3 });
    eq(Number(String(touched.records[0].get('n'))), 1, 'relationships the other session changed (uncommitted)');
    apply = track(SB.g.applyLocked('update', plan.updates, { timeoutMs: APPLY_TIMEOUT_MS, preimage }));
    await sleep(WAIT_TO_SEE_BLOCKING_MS);
    const waited = !apply.settled;
    await other.commit();
    assert(waited, `applyLocked finished within ${WAIT_TO_SEE_BLOCKING_MS} ms while another session held an uncommitted change to the relationship — it must take the relationship's write lock before it reads (ADR 0002 D4); it gave ${apply.error ? `an error: ${apply.error.message}` : show(apply.value)}`);
    result = await withTimeout(apply.promise, APPLY_TIMEOUT_MS + 15000, 'applyLocked after the other session committed');
  } finally {
    await other.close();
  }
  expectCounters(result, { applied: 0, lostRace: 1 }, 'applyLocked that met another writer\'s change');
  assert(preimageCalls >= 1, 'applyLocked should await the injected preimage(rows) before opening its transaction; it never called it');
  await expectEdge('T3', v1, 'T3 keeps the other writer\'s change, not the pass\'s', { set: { polarity: '0' } });
  return undefined;
}, 'sandbox');

// ADR 0002 D5-B (R2-NB1: a stored createdAt that is not INTEGER NOT NULL is "a value that differs from the
// definition, so it is repaired to the relay's integer"), rule table "update … repaired"; AC-2 (R2-NB1).
test('SL13: a relationship whose stored createdAt is a FLOAT is repaired by applyLocked to the relay version\'s INTEGER, with every other value as the definition gives [AC-2 (R2-NB1); ADR 0002 D5]', async () => {
  const off = sandboxOff();
  if (off) return skip(off);
  requireSandbox();
  const v1 = sandboxTagging('T4', { target: SB.pk.B, createdAt: 1700000000 });
  const create = planFor(await snapshotAt(['T4']), [v1]);
  expectPlan(create, { creates: 1, updates: 0, moves: 0, removals: 0 }, 'T4');
  expectCounters(await SB.g.applyCreates(create.creates, { timeoutMs: APPLY_TIMEOUT_MS }), { applied: 1, lostRace: 0 }, 'applyCreates for T4');
  const spoiled = await writeRows(SB.L, 'MATCH ()-[r:TAGS {address: $a}]->() SET r.createdAt = toFloat(r.createdAt) RETURN valueType(r.createdAt) AS t', { a: SB.addr.T4 });
  eq(spoiled.records.map((r) => r.t), ['FLOAT NOT NULL'], 'the sandbox stored T4\'s createdAt as a FLOAT');
  const plan = planFor(await snapshotAt(['T4']), [v1]);
  expectPlan(plan, { creates: 0, updates: 1, moves: 0, removals: 0 }, 'the same version over a FLOAT createdAt');
  const result = await SB.g.applyLocked('update', plan.updates, { timeoutMs: APPLY_TIMEOUT_MS, preimage: async () => {} });
  expectCounters(result, { applied: 1, lostRace: 0 }, 'applyLocked repairing T4');
  await expectEdge('T4', v1, 'T4 after the repair (createdAt an INTEGER again)');
  return undefined;
}, 'sandbox');

// ADR 0002 D7-A (DELETE, then MERGE the ends and CREATE, in one locked, verified transaction: "delete-then-create
// passes" the uniqueness check), rule table "move"; AC-2 ("when the person changed no relationship for that tagging
// remains at the old person"); AC-6 (the rule stays in place).
test('SL14: a move under the one-per-tagging rule — a newer version naming another person leaves exactly one relationship at the address, from the tagger to the new person with the new version\'s values, and the rule still in place [AC-2, AC-6; ADR 0002 D7]', async () => {
  const off = sandboxOff();
  if (off) return skip(off);
  requireSandbox();
  // T5: tagger T, target moves from a new person C to the existing person P. T6: the existing person P tags B, then C.
  const t5v1 = sandboxTagging('T5', { target: SB.pk.C, createdAt: 1000 });
  const t6v1 = sandboxTagging('T6', { target: SB.pk.B, createdAt: 1000 });
  const t5v2 = sandboxTagging('T5', { target: SB.pk.P, createdAt: 1200, version: 'v2', stamps: [F.Z.canonicalTagging, F.Z.localTagging] });
  const t6v2 = sandboxTagging('T6', { target: SB.pk.C, createdAt: 1200, version: 'v2' });
  const create = planFor(await snapshotAt(['T5', 'T6']), [t5v1, t6v1]);
  expectPlan(create, { creates: 2, updates: 0, moves: 0, removals: 0 }, 'T5 and T6\'s first versions');
  expectCounters(await SB.g.applyCreates(create.creates, { timeoutMs: APPLY_TIMEOUT_MS }), { applied: 2, lostRace: 0 }, 'applyCreates for T5 and T6');
  const plan = planFor(await snapshotAt(['T5', 'T6']), [t5v2, t6v2]);
  expectPlan(plan, { creates: 0, updates: 0, moves: 2, removals: 0 }, 'two newer versions naming other people');
  const result = await SB.g.applyLocked('move', plan.moves, { timeoutMs: APPLY_TIMEOUT_MS, preimage: async () => {} });
  expectCounters(result, { applied: 2, lostRace: 0 }, 'applyLocked moving T5 and T6');
  await expectEdge('T5', t5v2, 'T5 after its move to P');
  await expectEdge('T6', t6v2, 'T6 after its move to C');
  const schema = await showRows(SB.L);
  const rule = rulesByDefinition(schema, 'RELATIONSHIP', 'TAGS', 'address')[0];
  const index = rule && schema.indexes.find((i) => i.name === rule.ownedIndex);
  assert(rule && index && index.state === 'ONLINE', `the one-per-tagging rule should still be in place and ONLINE after the moves; SHOW gives ${show(rule ? { rule: rule.name, index: index && index.state } : null)}`);
  return undefined;
}, 'sandbox');

// AC-8 ("every node and relationship other than tagging relationships and the people it adds is identical before and
// after — the FOLLOWS … relationships and every existing person's properties, scores included"); ADR 0002 D6 (the
// only clause that touches a node is a bare keyed MERGE: no ON CREATE, no ON MATCH, no node SET); Seams → Live.
test('SL15: after the creates and moves, each existing fixture person — the one with scores and a FOLLOWS included — has the same labels, properties and FOLLOWS as before, and no other relationship [AC-8; ADR 0002 D6, Seams → Live]', async () => {
  const off = sandboxOff();
  if (off) return skip(off);
  requireSandbox();
  const { records } = await readRows(SB.L, 'MATCH (p:NostrUser {pubkey: $p})-[r:TAGS]-() RETURN count(r) AS n', { p: SB.pk.P });
  assert(Number(String(records[0].n)) >= 1, 'the fixture person P should be an end of at least one of the sandbox\'s relationships by now (SL9, SL14) — otherwise this check proves nothing');
  for (const who of ['P', 'Q', 'B', 'T']) {
    eq(await personState(SB.pk[who]), SB.before[who], `existing person ${who} (${short(SB.pk[who])}): element id, labels, properties and non-TAGS relationships, after vs before`);
  }
  return undefined;
}, 'sandbox');

// ADR 0002 Seams → Live ("touching only its own fixtures and deleting only them"); CLAUDE.md principle 4.
test('SL16: the sandbox deletes exactly its own fixtures — its TAGS addresses, its one FOLLOWS and its people, never with DETACH — and the graph holds none of them afterwards [ADR 0002 Seams → Live; principle 4]', async () => {
  const off = sandboxOff();
  if (off) return skip(off);
  if (!SB.mayHoldFixtures) throw new Error('the write sandbox wrote nothing to clean — SL8 did not complete (see its failure above)');
  const removed = await cleanSandbox();
  eq(removed.follows, 1, 'FOLLOWS relationships the sandbox deleted (its one fixture FOLLOWS)');
  const people = await readRows(SB.L, 'MATCH (n:NostrUser) WHERE n.pubkey IN $pks RETURN count(n) AS n', { pks: allPubkeys() });
  const tags = await readRows(SB.L, 'UNWIND $addrs AS a MATCH ()-[r:TAGS {address: a}]->() RETURN count(r) AS n', { addrs: allAddresses() });
  eq([Number(String(people.records[0].n)), Number(String(tags.records[0].n))], [0, 0], 'the sandbox\'s people and TAGS relationships left in the graph after cleanup');
  console.log(`        (sandbox ${SB.run}: deleted ${removed.tags} TAGS, ${removed.follows} FOLLOWS, ${removed.people} people)`);
  return undefined;
}, 'sandbox');

// ─── runner ──────────────────────────────────────────────────────────────────────────────────────────────────────
async function run() {
  console.log('\n--- tagging-edges live checks, local stack only (epic tagging-edges, Story 2) ---');
  let pass = 0, fail = 0, skipped = 0, roRan = 0, roSkipped = 0;
  const failures = [];
  try {
    for (const [name, fn, kind] of tests) {
      try {
        const r = await fn();
        if (r === SKIP) { console.log(`  SKIP  ${name}`); skipped++; if (kind === 'ro') roSkipped++; }
        else { console.log(`  PASS  ${name}`); pass++; if (kind === 'ro') roRan++; }
      } catch (err) {
        console.log(`  FAIL  ${name}\n        ${err.message}`);
        failures.push({ name, message: err.message });
        fail++;
        if (kind === 'ro') roRan++;
      }
    }
  } finally {
    if (SB.mayHoldFixtures && !SB.cleaned) {
      try { const r = await cleanSandbox(); console.log(`  (sandbox ${SB.run} cleaned up after a failure: ${r.tags} TAGS, ${r.follows} FOLLOWS, ${r.people} people)`); }
      catch (e) { console.log(`  !! sandbox ${SB.run} cleanup failed — its fixtures carry per-run pubkeys ${allPubkeys().map(short).join(', ')}: ${e.message}`); }
    }
    for (const close of [
      () => SB.g && SB.g.close && SB.g.close(),
      async () => { if (ogMemo) { const og = await ogMemo.catch(() => null); if (og && og.g && og.g.close) await og.g.close(); } },
      async () => { if (liveMemo) { const L = await liveMemo; if (L.ok) await L.driver.close(); } },
    ]) { try { await close(); } catch (_) { /* closing is best-effort */ } }
  }
  if (roSkipped > 0 && roRan === 0) {
    console.log('tagging-edges-live: !! LIVE COVERAGE DID NOT RUN — no local Neo4j (see the skip reasons above).');
    if (process.env.TAPESTRY_REQUIRE_LIVE === '1') {
      failures.push({ name: 'live coverage', message: 'TAPESTRY_REQUIRE_LIVE=1 but every read-only live check skipped.' });
      fail++;
    }
  }
  console.log(`\ntagging-edges-live: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped, failures };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
