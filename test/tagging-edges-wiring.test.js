'use strict';
/**
 * Tests for Story 2 (epic: tagging-edges) — the gap-filling pass: its wiring and its Neo4j port.
 *
 * Story: engineering-team/stories/tagging-edges/2-gap-filling-pass-and-backfill.md
 * ADR:   engineering-team/decisions/tagging-edges/0002-gap-filling-pass.md
 *        ("Implementation notes" → graph.js and Changed files; "Seams for Test Design" → Static sentinels and
 *        Graph port, stack-free). Binding context: ADR 0001 (amended) and src/lib/tagging-edges/contract.js.
 * Plan:  engineering-team/stories/tagging-edges/2-gap-filling-pass-and-backfill.test-plan.md
 *
 * Intentionally red until story 2's implementation lands (red phase): src/pipeline/tagging-edges/graph.js does not
 * exist, and the registry entry, the fresh-install seed, both expected-rule lists, the setup script's statement, the
 * boot-hook call and the three routes are not there yet. Every module under test is require()d LAZILY inside a test
 * through a load helper, so this suite always loads and each red test names what is missing.
 *
 * Classes:
 *   S — static sentinels over files the pass is wired through: taskRegistry.json, the fresh-install seed (read in a
 *       child process through readConfig with a temp SCHEDULED_TASKS_CONFIG_PATH), both expected-rule lists, the
 *       setup script, bin/control-panel.js and src/api/index.js. (AC-5, AC-6, AC-7)
 *   C — the statement audit of graph.js's CYPHER texts. (AC-3, AC-6, AC-8; ADR D4-C, D6-B, D7-A)
 *   U — graph.js's pure helpers: SCALAR_TYPES, toWriteProps, toCount, schemaStatusFromRows. (AC-2, AC-6, AC-8)
 *   B — ensureTagsConstraintOnBoot with an injected runner, sleep and log (no Neo4j). (AC-6; ADR D12-A)
 *   P — the graph port (openGraph → readSchema / ensureTagsConstraint / readAll / applyLocked / applyCreates)
 *       against a FAKE driver: neo4j-driver's `driver` factory is swapped, for the length of one test, for one
 *       returning an in-memory graph that answers the ADR's statements (and SHOW CONSTRAINTS / SHOW INDEXES) with real
 *       neo4j Records, real ResultSummary counters and neo4j.int counts. ensureTagsConstraint's wait runs on a fake
 *       clock (setTimeout and Date.now swapped for the test, restored after). (AC-2, AC-4, AC-6, AC-7, AC-8;
 *       ADR "The guard", runner steps 6 and 8)
 *   W — the bash wrapper reconcileTaggingEdges.sh, read as text (it sources /etc/brainstorm.conf and takes a kernel
 *       flock, so it is not run here). (AC-7; ADR D11-C, Implementation notes → the wrapper)
 *   Review round 2 (2026-09-28): SWR58 drives the runner's run(deps) over the real port on the fake driver, with
 *   in-memory state and scan ports; the runner (reconcileTaggingEdges.js) is required lazily through RUNNER_PATH.
 *
 * Stack-free and hermetic: no Neo4j, no strfry, no network, no write to the local graph or relay. Temp directories come
 * from fs.mkdtempSync(os.tmpdir()) and are removed; env changes live only in child processes; the swapped driver
 * factory, Date.now and console are restored in `finally`. Every pubkey is a fake 64-hex value from
 * test/helpers/taggingEdgesFixtures.js — never a deployment's TA, never the ADR 0015 literal.
 *
 * Shapes the ADR leaves open, chosen here (the test plan records them):
 *   - CYPHER is keyed by the ADR's statement labels: READ_ALL, READ_AT, LOCK, UPDATE, MOVE, REMOVE,
 *     CREATE_IF_ABSENT, CREATE_TAGS_CONSTRAINT (other entries, e.g. SHOW statements, are allowed and audited too).
 *   - applyLocked(kind, rows, …): kind is 'update' | 'move' | 'remove' (the report's lostRace keys); a row is
 *     { address, snapshot, desired } — `snapshot` the READ_ALL row the decision was made from, `desired` the contract
 *     edge to write (update, move; a remove row has none). applyCreates(rows, …): a row is { address, desired }.
 *     The port computes fingerprint(snapshot) and toWriteProps(desired) itself; planPass's items are these rows
 *     (test/tagging-edges-sweep.test.js SW54). Each apply resolves to { applied, lostRace, nodesCreated,
 *     transientRetries, appliedAddresses } — numbers, and the addresses of the rows that committed (applied ===
 *     appliedAddresses.length), which the runner's report attributes by; a failed verify re-read rejects with
 *     `read: 'graph-verify'` on the error (the same contract test/tagging-edges-runner.test.js fakes).
 *   - schemaStatusFromRows(constraints, indexes) → { tagsAddress, nostrUserPubkey }, each { present, online, name,
 *     underAnotherName }: `present` — a constraint with the rule's definition is listed; `online` — its owned index is
 *     listed ONLINE; `name` — that constraint's name; `underAnotherName` — the name is not the rule's own. The pass
 *     needs present and online for tags_address, present for nostrUser_pubkey (ADR runner step 6).
 *   - readSchema() → { constraints, indexes }, the SHOW rows as plain objects. ensureTagsConstraint({ timeoutMs })
 *     creates tags_address (CREATE_TAGS_CONSTRAINT, its own auto-commit statement) only when it is not present, then
 *     re-reads until the owned index is ONLINE or timeoutMs has passed, and resolves to schemaStatusFromRows' answer
 *     from its last read; a failed CREATE rejects with the Neo4j error. readAll({ timeoutMs }) runs READ_ALL in one
 *     read transaction with that time-out and resolves to a plain array of rows keyed by the eight columns, values as
 *     the driver gives them (Integers lossless).
 *   - ensureTagsConstraintOnBoot returns a promise (the ADR: "never rejects").
 *
 * Hand-rolled in the project's existing test style — no new framework. Node 16 and 22.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const F = require('./helpers/taggingEdgesFixtures');

const REPO_ROOT = path.join(__dirname, '..');
const GRAPH_PATH = path.join(REPO_ROOT, 'src/pipeline/tagging-edges/graph.js');
const RUNNER_PATH = path.join(REPO_ROOT, 'src/pipeline/tagging-edges/reconcileTaggingEdges.js');
const REGISTRY_PATH = path.join(REPO_ROOT, 'src/manage/taskQueue/taskRegistry.json');
const SCHED_TASKS = path.join(REPO_ROOT, 'src/api/scheduled-tasks/index.js');
const SCHED_VALIDATION = path.join(REPO_ROOT, 'src/api/scheduled-tasks/validation.js');
const TASK_TIMEOUT = path.join(REPO_ROOT, 'src/utils/taskTimeout.js');
const EXPECTED_SCHEMA = path.join(REPO_ROOT, 'src/api/status/queries/expectedNeo4jSchema.js');
const DASHBOARD = path.join(REPO_ROOT, 'ui/src/pages/Dashboard.jsx');
const SETUP_SCRIPT = path.join(REPO_ROOT, 'setup/neo4jConstraintsAndIndexes.sh');
const CONTROL_PANEL = path.join(REPO_ROOT, 'bin/control-panel.js');
const API_INDEX = path.join(REPO_ROOT, 'src/api/index.js');
const AUTH_MW = path.join(REPO_ROOT, 'src/middleware/auth.js');

const TASK = 'reconcileTaggingEdges';
const SRC_DIR_VAR = '$BRAINSTORM_MODULE_SRC_DIR/';
/** The node runner the wrapper `exec`s (ADR 0002, New files): after exec it is the process the pgrep guard sees. */
const RUNNER_ENTRY = '$BRAINSTORM_MODULE_SRC_DIR/pipeline/tagging-edges/reconcileTaggingEdges.js';
const CONSTRAINT_NAME = 'tags_address';
/** ADR 0002: CREATE CONSTRAINT tags_address IF NOT EXISTS FOR ()-[r:TAGS]-() REQUIRE r.address IS UNIQUE (whitespace-normalised). */
const CONSTRAINT_RE = /^CREATE CONSTRAINT tags_address IF NOT EXISTS FOR \( ?\) ?<?- ?\[ ?(\w+) ?: ?TAGS ?\] ?->? ?\( ?\) REQUIRE \1 ?\. ?address IS UNIQUE ?;?$/i;
const LOG_PREFIX = '[tagging-edges] uniqueness rule tags_address not created: ';
const MIN = 60 * 1000;

/** ADR 0002 "Implementation notes" → graph.js: the statement labels. */
const STATEMENT_NAMES = ['READ_ALL', 'READ_AT', 'LOCK', 'UPDATE', 'MOVE', 'REMOVE', 'CREATE_IF_ABSENT', 'CREATE_TAGS_CONSTRAINT'];
/** READ_ALL's projection (ADR 0002; the fixture helper's storedRow builds the same row). */
const ROW_KEYS = ['rid', 'fromPubkey', 'fromPubkeyType', 'fromIsUser', 'toPubkey', 'toPubkeyType', 'toIsUser', 'props'];
/** Retried by the boot hook (ADR 0002, Changed files → bin/control-panel.js). */
const RETRY_CODES = [
  'Neo.TransientError.General.DatabaseUnavailable',
  'Neo.TransientError.Transaction.DeadlockDetected',
  'ServiceUnavailable',
  'SessionExpired',
  'Neo.ClientError.Security.Unauthorized',
  'Neo.ClientError.Security.AuthenticationRateLimit',
  'Neo.ClientError.Security.CredentialsExpired',
];

// ─── assertion helpers ─────────────────────────────────────────────────────────────────────────────────────────
function isNeoInt(x) { return !!x && typeof x === 'object' && typeof x.low === 'number' && typeof x.high === 'number' && typeof x.toNumber === 'function'; }
function show(v) {
  try {
    return JSON.stringify(v, (k, x) => {
      if (typeof x === 'bigint') return `${x}n`;
      if (isNeoInt(x)) return `int(${x.toString()})`;
      return x;
    });
  } catch (_) { return String(v); }
}
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object' && !isNeoInt(v)) return Object.keys(v).sort().reduce((o, k) => { o[k] = sortKeys(v[k]); return o; }, {});
  return v;
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function eq(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}\n        expected: ${show(expected)}\n        actual:   ${show(actual)}`);
}
function same(actual, expected, label) {
  const a = show(sortKeys(actual));
  const e = show(sortKeys(expected));
  if (a !== e) throw new Error(`${label}\n        expected: ${e}\n        actual:   ${a}`);
}
function sameSet(actual, expected, label) { same([...new Set(actual)].sort(), [...new Set(expected)].sort(), label); }
function firstLine(s) { return String(s == null ? '' : s).split('\n')[0]; }
function tail(s, n = 400) { const t = String(s || '').trim(); return t.length > n ? `…${t.slice(-n)}` : t; }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch (_) { return ''; } }
function uniq(xs) { return [...new Set(xs)]; }
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
/** An error from this suite's own harness (a missing module, a missing export, the fake's refusal of a statement). */
function isHarnessError(e) {
  return /not implemented yet|not loadable|must export|must return the port|must have (applyLocked|applyCreates|close)|fake neo4j:/.test(String(e && e.message));
}
/** Resolves to the error fn() rejects with; rethrows harness errors, so only the behaviour under test can satisfy it. */
async function rejectionOf(fn, label) {
  try { await fn(); } catch (e) { if (isHarnessError(e)) throw e; return e; }
  throw new Error(`${label}: expected a rejection (or a throw), but it resolved`);
}

// ─── lazy loaders ──────────────────────────────────────────────────────────────────────────────────────────────
function loadGraph() {
  try { return require(GRAPH_PATH); }
  catch (e) { throw new Error(`src/pipeline/tagging-edges/graph.js not implemented yet (require failed: ${firstLine(e.message)})`); }
}
function graphExport(name, type = 'function') {
  const g = loadGraph();
  assert(typeof g[name] === type, `graph.js must export ${name} (a ${type}; ADR 0002 Implementation notes → graph.js); got ${typeof g[name]}`);
  return g[name];
}
function loadModule(abs, label) {
  try { return require(abs); }
  catch (e) { throw new Error(`${label} not loadable (require failed: ${firstLine(e.message)})`); }
}
function neo4jLib() {
  try { return require('neo4j-driver'); }
  catch (e) { throw new Error(`neo4j-driver not loadable (require failed: ${firstLine(e.message)}) — run npm ci`); }
}

// ─── registry ──────────────────────────────────────────────────────────────────────────────────────────────────
function registry() {
  const text = safeRead(REGISTRY_PATH);
  try { return JSON.parse(text); }
  catch (e) { throw new Error(`src/manage/taskQueue/taskRegistry.json does not parse as JSON: ${e.message}`); }
}
function taskEntry() {
  const r = registry();
  const t = r.tasks && r.tasks[TASK];
  assert(t && typeof t === 'object', `taskRegistry.json has no tasks.${TASK} entry (ADR 0002, Changed files → taskRegistry.json)`);
  return t;
}

// ─── source helpers ────────────────────────────────────────────────────────────────────────────────────────────
/** Source with whole-line comments dropped, so a comment quoting the call or the route is not taken for the thing. */
function codeOnly(src) { return src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n'); }
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'); }
function stringsOfArray(src, constName) {
  const m = new RegExp(`const\\s+${constName}\\s*=\\s*\\[([\\s\\S]*?)\\];`).exec(src);
  if (!m) return null;
  return [...m[1].replace(/\/\/[^\n]*/g, '').matchAll(/'([^']*)'|"([^"]*)"/g)].map((x) => (x[1] !== undefined ? x[1] : x[2]));
}

// ─── Cypher helpers ────────────────────────────────────────────────────────────────────────────────────────────
function norm(s) {
  return String(s).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ').replace(/\s+/g, ' ').trim();
}
function cypherMap() {
  const c = graphExport('CYPHER', 'object');
  assert(c !== null, 'graph.js CYPHER must be an object of statement texts');
  return c;
}
function statement(name) {
  const s = cypherMap()[name];
  assert(typeof s === 'string' && s.trim() !== '', `graph.js CYPHER.${name} must be a non-empty statement text (ADR 0002 names it); got ${show(s)}`);
  return norm(s);
}
/** Every statement text in CYPHER (string leaves, nested objects included), keyed by path. */
function allStatements() {
  const out = [];
  (function walk(v, at) {
    if (typeof v === 'string') out.push([at, norm(v)]);
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${at}[${i}]`));
    else if (v && typeof v === 'object') for (const k of Object.keys(v)) walk(v[k], at ? `${at}.${k}` : k);
  })(cypherMap(), '');
  assert(out.length > 0, 'graph.js CYPHER holds no statement texts');
  return out;
}
const CLAUSE_RE = /\b(OPTIONAL MATCH|MATCH|MERGE|CREATE|SET|DELETE|DETACH|REMOVE|WITH|RETURN|UNWIND|WHERE|CALL|FOREACH|ORDER BY|SKIP|LIMIT|UNION|ON CREATE|ON MATCH)\b/gi;
/** A statement split into its clauses: [{ kw, text, at }]. */
function clauses(stmt) {
  const hits = [...stmt.matchAll(CLAUSE_RE)];
  return hits.map((m, i) => ({
    kw: m[1].toUpperCase().replace(/\s+/g, ' '),
    at: m.index,
    text: stmt.slice(m.index, i + 1 < hits.length ? hits[i + 1].index : stmt.length).trim(),
  }));
}
/** Variables bound by a relationship pattern (`-[v:…]`) in the statement. */
function relVars(stmt) { return new Set([...stmt.matchAll(/-\s*\[\s*(\w+)\s*:/g)].map((m) => m[1])); }
function splitTopLevel(s) {
  const out = []; let depth = 0; let cur = '';
  for (const ch of s) {
    if ('([{'.includes(ch)) depth++;
    if (')]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map((x) => x.trim());
}
function setItems(clauseText) { return splitTopLevel(clauseText.replace(/^SET\s+/i, '')); }
const isSchemaStatement = (s) => /^(CREATE|DROP)\s+(CONSTRAINT|INDEX)\b/i.test(s) || /^SHOW\b/i.test(s);

// ─── schema rows (SHOW-shaped, as the local stack printed them on 2026-09-27) ─────────────────────────────────
const BASE_CONSTRAINTS = [
  { name: 'nostrUser_pubkey', type: 'UNIQUENESS', entityType: 'NODE', labelsOrTypes: ['NostrUser'], properties: ['pubkey'], ownedIndex: 'nostrUser_pubkey' },
  { name: 'nostrEvent_id', type: 'UNIQUENESS', entityType: 'NODE', labelsOrTypes: ['NostrEvent'], properties: ['id'], ownedIndex: 'nostrEvent_id' },
];
const BASE_INDEXES = [
  { name: 'index_343aff4e', state: 'ONLINE', type: 'LOOKUP', entityType: 'NODE', labelsOrTypes: null, properties: null, owningConstraint: null },
  { name: 'index_f7700477', state: 'ONLINE', type: 'LOOKUP', entityType: 'RELATIONSHIP', labelsOrTypes: null, properties: null, owningConstraint: null },
  { name: 'nostrUser_pubkey', state: 'ONLINE', type: 'RANGE', entityType: 'NODE', labelsOrTypes: ['NostrUser'], properties: ['pubkey'], owningConstraint: 'nostrUser_pubkey' },
  { name: 'nostrEvent_id', state: 'ONLINE', type: 'RANGE', entityType: 'NODE', labelsOrTypes: ['NostrEvent'], properties: ['id'], owningConstraint: 'nostrEvent_id' },
  { name: 'nostrEvent_kind', state: 'ONLINE', type: 'RANGE', entityType: 'NODE', labelsOrTypes: ['NostrEvent'], properties: ['kind'], owningConstraint: null },
];
function tagsConstraint(name, over = {}) {
  return { name, type: 'RELATIONSHIP_UNIQUENESS', entityType: 'RELATIONSHIP', labelsOrTypes: ['TAGS'], properties: ['address'], ownedIndex: name, ...over };
}
function tagsIndex(name, state = 'ONLINE', over = {}) {
  return { name, state, type: 'RANGE', entityType: 'RELATIONSHIP', labelsOrTypes: ['TAGS'], properties: ['address'], owningConstraint: name, ...over };
}
const clone = (v) => JSON.parse(JSON.stringify(v));
function tagsVerdict(result, label) {
  assert(result && typeof result === 'object' && result.tagsAddress && typeof result.tagsAddress === 'object',
    `${label}: schemaStatusFromRows must return { tagsAddress: { present, … } } (the shape this suite pins where the ADR is silent); got ${show(result)}`);
  assert(typeof result.tagsAddress.present === 'boolean', `${label}: tagsAddress.present must be a boolean; got ${show(result.tagsAddress)}`);
  assert(typeof result.tagsAddress.online === 'boolean', `${label}: tagsAddress.online must be a boolean (whether the owned index is listed ONLINE); got ${show(result.tagsAddress)}`);
  return result.tagsAddress;
}

// ─── the boot hook's harness (injected runner, sleep, log; a fake clock under Date.now) ────────────────────────
function schemaCallKind(text) {
  const c = norm(text);
  if (/^SHOW\b/i.test(c)) return /CONSTRAINT/i.test(c) ? 'show-constraints' : (/INDEX/i.test(c) ? 'show-indexes' : 'show-other');
  if (/\bDROP\b/i.test(c)) return 'drop';
  if (/^CREATE\s+CONSTRAINT\b/i.test(c)) return 'create';
  return 'other';
}

/**
 * Runs ensureTagsConstraintOnBoot against an in-memory schema.
 *   initial   'missing' | 'present' | 'other-name'
 *   fail      (call, st) → an Error to throw for this runner call, or null
 *   runRead / runWrite   replace the fake runners (e.g. a synchronous thrower)
 *   logThrows the injected log throws after recording
 * Every sleep advances a fake clock (Date.now follows it) and resolves at once. After `overrunMs` of backoff the
 * fake stops failing, so a hook that keeps retrying still ends and the test can say so.
 */
async function runBootHook({ initial = 'missing', fail = () => null, runRead, runWrite, logThrows = false, overrunMs = 40 * MIN } = {}) {
  const ensure = graphExport('ensureTagsConstraintOnBoot');
  const st = {
    constraints: clone(BASE_CONSTRAINTS), indexes: clone(BASE_INDEXES),
    calls: [], events: [], sleeps: [], lines: [], drops: [], createAttempts: 0, created: false,
    overran: false, done: false, outcome: null, firedCodes: [],
  };
  if (initial === 'present') { st.constraints.push(tagsConstraint(CONSTRAINT_NAME)); st.indexes.push(tagsIndex(CONSTRAINT_NAME)); }
  if (initial === 'other-name') { st.constraints.push(tagsConstraint('constraint_9f2c1a7b')); st.indexes.push(tagsIndex('constraint_9f2c1a7b')); }

  const respond = (via, cypher, params) => {
    const text = String(cypher);
    const kind = schemaCallKind(text);
    const call = { via, kind, text, params, n: st.calls.length };
    st.calls.push(call);
    st.events.push(`${via}:${kind}`);
    if (kind === 'create') st.createAttempts++;
    if (!st.done && !st.overran) {
      const err = fail(call, st);
      if (err) { st.events.push(`fail:${err.code || 'no-status'}`); st.firedCodes.push(err.code || null); throw err; }
    }
    if (kind === 'drop') { st.drops.push(text); return []; }
    if (kind === 'create') {
      if (CONSTRAINT_RE.test(norm(text)) && !st.constraints.some((c) => c.name === CONSTRAINT_NAME)) {
        st.constraints.push(tagsConstraint(CONSTRAINT_NAME));
        st.indexes.push(tagsIndex(CONSTRAINT_NAME));
      }
      st.created = st.created || CONSTRAINT_RE.test(norm(text));
      return [];
    }
    if (kind === 'show-constraints') return clone(st.constraints);
    if (kind === 'show-indexes') return clone(st.indexes);
    return [];
  };
  const fakeRead = async (cypher, params) => respond('read', cypher, params);
  const fakeWrite = async (cypher, params) => respond('write', cypher, params);
  let clock = 0;
  const sleep = (ms) => {
    st.sleeps.push(ms);
    st.events.push(`sleep:${ms}`);
    clock += Number(ms) || 0;
    if (clock > overrunMs) st.overran = true;
    return Promise.resolve();
  };
  const log = (...args) => {
    st.lines.push(args.map((a) => (typeof a === 'string' ? a : (a && a.message) || show(a))).join(' '));
    if (logThrows) throw new Error('fake log sink failed');
  };

  const realNow = Date.now;
  const base = realNow();
  Date.now = () => base + clock;
  let timer = null;
  try {
    let ret;
    try { ret = ensure({ runRead: runRead || fakeRead, runWrite: runWrite || fakeWrite, log, sleep }); }
    catch (e) { throw new Error(`ensureTagsConstraintOnBoot threw synchronously (ADR 0002: never throws): ${firstLine(e.message)}`); }
    assert(ret && typeof ret.then === 'function', `ensureTagsConstraintOnBoot must return a promise (ADR 0002 Seams: "never rejects"); got ${show(ret)}`);
    const deadline = new Promise((resolve) => { timer = setTimeout(() => resolve({ timedOut: true }), 5000); });
    st.outcome = await Promise.race([
      ret.then((value) => ({ resolved: true, value }), (error) => ({ rejected: true, error })),
      deadline,
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    Date.now = realNow;
    st.done = true;
  }
  if (st.outcome.timedOut) {
    throw new Error('ensureTagsConstraintOnBoot did not settle within 5 s of real time: it must wait through the injected sleep, not a real timer');
  }
  return st;
}
function assertSettledQuietly(st, label) {
  assert(!st.outcome.rejected, `${label}: ensureTagsConstraintOnBoot rejected (ADR 0002: never rejects): ${st.outcome.error && firstLine(st.outcome.error.message)}`);
  eq(st.drops.length, 0, `${label}: DROP statements sent (ADR 0002: the boot hook never drops anything)`);
}

// ─── the fake neo4j driver (P class) ───────────────────────────────────────────────────────────────────────────
function classify(cypher, params) {
  const c = norm(cypher);
  if (/^SHOW\b/i.test(c)) return 'show';
  if (/^CREATE\s+CONSTRAINT\b/i.test(c)) return 'create-constraint';
  if (/\bSET\s+(\w+)\s*\.\s*address\s*=\s*\1\s*\.\s*address\b/i.test(c)) return 'lock';
  if (/\belementId\s*\(/i.test(c) && /\bAS\s+rid\b/i.test(c)) return params && params.addresses ? 'reread' : 'read-all';
  if (/\bOPTIONAL\s+MATCH\b/i.test(c) && /\bCREATE\b/i.test(c)) return 'create';
  if (/\bDELETE\b/i.test(c) && /\bCREATE\b/i.test(c)) return 'move';
  if (/\bDELETE\b/i.test(c)) return 'remove';
  if (/\bSET\s+\w+\s*\+?=\s*row\s*\.\s*props\b/i.test(c)) return 'update';
  return 'unknown';
}
function addressOfRow(row) {
  const e = (row.props || []).find((p) => p[0] === 'address');
  return e ? e[2] : null;
}
function isRetriable(err) {
  return !!err && (err.retriable === true || /^Neo\.TransientError\./.test(String(err.code)) || err.code === 'ServiceUnavailable' || err.code === 'SessionExpired');
}
function isIntegerTyped(v) { return typeof v === 'bigint' || isNeoInt(v); }

/** A deep copy that keeps neo4j Integers and BigInts as they are (JSON would turn an Integer into { low, high }). */
function deepCopy(v) {
  if (Array.isArray(v)) return v.map(deepCopy);
  if (isNeoInt(v) || typeof v === 'bigint') return v;
  if (v && typeof v === 'object') return Object.keys(v).reduce((o, k) => { o[k] = deepCopy(v[k]); return o; }, {});
  return v;
}

/**
 * An in-memory graph behind a fake driver. `rows` seed the committed state (READ_ALL rows by address); `people` the
 * NostrUser pubkeys. Options: failCommitOnce (the first WRITE transaction's commit fails with a transient error after
 * its work ran, so the driver re-runs the work — as executeWrite does), conflicts (addresses whose create fails with
 * Neo.ClientError.Schema.ConstraintValidationFailed, as a concurrent uncommitted create would make it), actDelta
 * ({ update|move|remove: k } added to that statement's returned count), rereadError (a function returning the error
 * the verify re-read fails with). Schema: `schema` { constraints, indexes } (the SHOW rows; default the local stack's
 * base rules), `tagsOnlineAfterMs` (how long after CREATE_TAGS_CONSTRAINT the new rule's owned index reads ONLINE —
 * measured by Date.now, which a test may put on a fake clock; default 0, Infinity for never), `createError` (a
 * function returning the error CREATE_TAGS_CONSTRAINT fails with).
 */
function makeFakeNeo4j(opts = {}) {
  const neo4j = neo4jLib();
  const st = {
    store: new Map(), people: new Set(opts.people || []), txs: [], events: [], driverCalls: [],
    driverClosed: false, failCommitOnceDone: false, conflicts: new Set(opts.conflicts || []), actDelta: opts.actDelta || {},
    schema: opts.schema ? clone(opts.schema) : { constraints: clone(BASE_CONSTRAINTS), indexes: clone(BASE_INDEXES) },
    tagsCreatedAt: null, creates: 0,
  };
  for (const row of opts.rows || []) st.store.set(addressOfRow(row), deepCopy(row));
  let ridSeq = 0;
  const onlineAfter = opts.tagsOnlineAfterMs === undefined ? 0 : opts.tagsOnlineAfterMs;
  /** SHOW INDEXES as of now: the index CREATE_TAGS_CONSTRAINT made is POPULATING until tagsOnlineAfterMs has passed. */
  const indexesNow = () => st.schema.indexes.map((i) => {
    if (i.name !== CONSTRAINT_NAME || st.tagsCreatedAt === null) return clone(i);
    return { ...clone(i), state: Date.now() - st.tagsCreatedAt >= onlineAfter ? 'ONLINE' : 'POPULATING' };
  });
  const recordsOf = (rows) => {
    const keys = uniq(rows.flatMap((r) => Object.keys(r)));
    return { keys, rows: rows.map((r) => keys.map((k) => (k in r ? r[k] : null))) };
  };

  const entryOf = (k, v) => (isNeoInt(v) ? [k, 'INTEGER NOT NULL', v.toString(), null] : F.propEntry(k, v));
  const propsToEntries = (props, what) => {
    assert(props && typeof props === 'object' && !Array.isArray(props), `fake neo4j: ${what} row carries no props map (ADR 0002: SET … = row.props); got ${show(props)}`);
    return Object.keys(props).map((k) => entryOf(k, props[k]));
  };
  const newRow = (r) => ({
    rid: `5:fake:${++ridSeq}`, fromPubkey: r.from, fromPubkeyType: 'STRING NOT NULL', fromIsUser: true,
    toPubkey: r.to, toPubkeyType: 'STRING NOT NULL', toIsUser: true, props: propsToEntries(r.props, 'a created'),
  });
  const list = (x, what) => { assert(Array.isArray(x), `fake neo4j: ${what} must be a list parameter; got ${show(x)}`); return x; };

  function applyStatement(view, cypher, params, tx) {
    const kind = classify(cypher, params);
    tx.runs.push({ kind, cypher: String(cypher), params });
    st.events.push({ e: 'run', tx: tx.id, kind });
    const stats = {};
    const bump = (k, n = 1) => { stats[k] = (stats[k] || 0) + n; };
    const addPerson = (pk) => { if (!view.people.has(pk)) { view.people.add(pk); bump('nodes-created'); } };
    let keys = [];
    let rows = [];
    switch (kind) {
      case 'lock': {
        const as = uniq(list(params && params.addresses, 'LOCK $addresses'));
        keys = ['locked']; rows = [[neo4j.int(as.filter((a) => view.store.has(a)).length)]];
        break;
      }
      case 'reread': {
        if (opts.rereadError) throw opts.rereadError();
        keys = ROW_KEYS;
        rows = uniq(list(params.addresses, 'READ_AT $addresses')).filter((a) => view.store.has(a)).map((a) => {
          const r = deepCopy(view.store.get(a));
          return ROW_KEYS.map((k) => r[k]);
        });
        break;
      }
      case 'read-all': {
        keys = ROW_KEYS;
        rows = [...view.store.values()].map((r) => { const c = deepCopy(r); return ROW_KEYS.map((k) => c[k]); });
        break;
      }
      case 'show': {
        const c = norm(cypher);
        if (/\bCONSTRAINTS?\b/i.test(c)) ({ keys, rows } = recordsOf(clone(st.schema.constraints)));
        else if (/\bINDEX(ES)?\b/i.test(c)) ({ keys, rows } = recordsOf(indexesNow()));
        else throw new Error(`fake neo4j: a SHOW statement other than SHOW CONSTRAINTS / SHOW INDEXES: ${c.slice(0, 120)}`);
        break;
      }
      case 'create-constraint': {
        st.creates++;
        if (opts.createError) throw opts.createError();
        if (!CONSTRAINT_RE.test(norm(cypher))) throw new Error(`fake neo4j: an unexpected CREATE CONSTRAINT: ${norm(cypher).slice(0, 160)}`);
        if (!st.schema.constraints.some((x) => x.name === CONSTRAINT_NAME)) {
          st.schema.constraints.push(tagsConstraint(CONSTRAINT_NAME));
          st.schema.indexes.push(tagsIndex(CONSTRAINT_NAME, 'POPULATING'));
          st.tagsCreatedAt = Date.now();
        }
        break;
      }
      case 'update': {
        let n = 0;
        for (const r of list(params && params.rows, 'UPDATE $rows')) {
          const old = view.store.get(r.address);
          if (!old) continue;
          view.store.set(r.address, { ...old, props: propsToEntries(r.props, 'an UPDATE') });
          bump('properties-set', Object.keys(r.props).length);
          n++;
        }
        keys = ['n']; rows = [[neo4j.int(n + (st.actDelta.update || 0))]];
        break;
      }
      case 'move': {
        let n = 0;
        for (const r of list(params && params.rows, 'MOVE $rows')) {
          if (!view.store.has(r.address)) continue;
          view.store.delete(r.address); bump('relationships-deleted');
          addPerson(r.from); addPerson(r.to);
          view.store.set(r.address, newRow(r)); bump('relationships-created');
          n++;
        }
        keys = ['n']; rows = [[neo4j.int(n + (st.actDelta.move || 0))]];
        break;
      }
      case 'remove': {
        let n = 0;
        for (const a of uniq(list(params && params.addresses, 'REMOVE $addresses'))) {
          if (view.store.delete(a)) { n++; bump('relationships-deleted'); }
        }
        keys = ['n']; rows = [[neo4j.int(n + (st.actDelta.remove || 0))]];
        break;
      }
      case 'create': {
        keys = ['address'];
        for (const r of list(params && params.rows, 'CREATE_IF_ABSENT $rows')) {
          if (view.store.has(r.address)) continue; // OPTIONAL MATCH … WHERE x IS NULL
          if (st.conflicts.has(r.address)) {
            throw new neo4j.Neo4jError(`fake: Relationship(…) already exists with type \`TAGS\` and property \`address\` = '${r.address}'`,
              'Neo.ClientError.Schema.ConstraintValidationFailed');
          }
          addPerson(r.from); addPerson(r.to);
          view.store.set(r.address, newRow(r)); bump('relationships-created');
          rows.push([r.address]);
        }
        break;
      }
      default:
        throw new Error(`fake neo4j: unrecognised statement for the graph port (ADR 0002 names LOCK, READ_AT, UPDATE, MOVE, REMOVE, CREATE_IF_ABSENT): ${norm(cypher).slice(0, 160)}`);
    }
    const records = rows.map((f) => new neo4j.Record(keys, f));
    const summary = new neo4j.ResultSummary(String(cypher), params || {}, { stats, type: 'w' }, 5.0);
    return { records, summary, keys };
  }

  async function managed(mode, work, txConfig) {
    let attempt = 0;
    for (;;) {
      attempt++;
      const tx = { id: st.txs.length + 1, mode, config: txConfig, attempt, runs: [], committed: false, rolledBack: false };
      st.txs.push(tx);
      st.events.push({ e: 'tx-open', tx: tx.id, mode });
      const view = { store: new Map([...st.store].map(([k, v]) => [k, deepCopy(v)])), people: new Set(st.people) };
      const api = {
        run: (cypher, params) => {
          try { return Promise.resolve(applyStatement(view, cypher, params, tx)); } catch (e) { return Promise.reject(e); }
        },
      };
      let result;
      try { result = await work(api); } catch (err) {
        tx.rolledBack = true;
        st.events.push({ e: 'tx-rollback', tx: tx.id });
        if (isRetriable(err) && attempt < 4) continue;
        throw err;
      }
      if (mode === 'WRITE' && opts.failCommitOnce && !st.failCommitOnceDone) {
        st.failCommitOnceDone = true;
        tx.rolledBack = true;
        st.events.push({ e: 'tx-commit-failed', tx: tx.id });
        continue; // the driver re-runs the work of a managed transaction after a transient commit failure
      }
      st.store = view.store; st.people = view.people; tx.committed = true;
      st.events.push({ e: 'tx-commit', tx: tx.id });
      return result;
    }
  }
  const session = () => ({
    executeWrite: (work, cfg) => managed('WRITE', work, cfg),
    executeRead: (work, cfg) => managed('READ', work, cfg),
    writeTransaction: (work, cfg) => managed('WRITE', work, cfg),
    readTransaction: (work, cfg) => managed('READ', work, cfg),
    run: (cypher, params, cfg) => managed('AUTO', (tx) => tx.run(cypher, params), cfg),
    beginTransaction: () => { throw new Error('fake neo4j: beginTransaction is not modelled — ADR 0002 runs every write batch in session.executeWrite'); },
    close: async () => {},
    lastBookmarks: () => [],
    lastBookmark: () => [],
  });
  const driver = {
    session,
    close: async () => { st.driverClosed = true; },
    verifyConnectivity: async () => ({}),
    getServerInfo: async () => ({}),
    supportsMultiDb: async () => true,
    executeQuery: (cypher, params, cfg) => managed('AUTO', (tx) => tx.run(cypher, params), cfg),
  };
  return { st, driver };
}

/** Swap neo4j-driver's `driver` factory (the module graph.js requires lazily) for one returning the fake. */
async function withFakeDriver(fake, fn) {
  const neo4j = neo4jLib();
  const targets = [neo4j];
  if (neo4j.default && typeof neo4j.default === 'object' && neo4j.default !== neo4j) targets.push(neo4j.default);
  const saved = targets.map((t) => t.driver);
  const stub = (uri, auth, config) => { fake.st.driverCalls.push({ uri, auth, config }); return fake.driver; };
  targets.forEach((t) => { t.driver = stub; });
  try { return await fn(); } finally { targets.forEach((t, i) => { t.driver = saved[i]; }); }
}

const PASSWORD = 'fake-password-3c9d-never-printed';
const CREDS = Object.freeze({ uri: 'bolt://fake-neo4j.invalid:7687', user: 'neo4j', password: PASSWORD });

/** Opens the port on the fake, runs fn(graph), and always closes the port. */
async function onFakeGraph(fake, fn) {
  const openGraph = graphExport('openGraph');
  return withFakeDriver(fake, async () => {
    const g = await openGraph({ ...CREDS });
    assert(g && typeof g === 'object', `openGraph must return the port object; got ${show(g)}`);
    for (const m of ['applyLocked', 'applyCreates', 'close']) assert(typeof g[m] === 'function', `the port from openGraph must have ${m}() (ADR 0002 Implementation notes → graph.js)`);
    try { return await fn(g); } finally { await g.close(); }
  });
}

// Fixture rows for the port: every tagging is Alice's, at its own address.
function edgeFor(i, over = {}) { return F.contractEdge(F.makeTagging({ d: `wiring-${i}`, id: F.idOf(`wiring:${i}`), ...over })); }
/** An update: the graph holds the version with polarity '0' (the snapshot); the relay's version has '1'. */
function updateRow(i, { snapshotOpts = { set: { polarity: '0' } }, over = {} } = {}) {
  const desired = edgeFor(i, over);
  return { address: desired.address, snapshot: F.storedRow(edgeFor(i), snapshotOpts), desired };
}
function moveRow(i, to) {
  const desired = edgeFor(i, { target: to });
  return { address: desired.address, snapshot: F.storedRow(edgeFor(i)), desired };
}
function removeRow(i) { const e = edgeFor(i); return { address: e.address, snapshot: F.storedRow(e) }; }
function createRow(i, over = {}) { const desired = edgeFor(i, over); return { address: desired.address, desired }; }
const noPreimage = async () => {};

function num(res, key, label) {
  assert(res && typeof res === 'object', `${label}: the apply must resolve to { applied, lostRace, nodesCreated, transientRetries }; got ${show(res)}`);
  assert(typeof res[key] === 'number', `${label}: ${key} must be a number (ADR 0002: counters); got ${show(res[key])} in ${show(res)}`);
  return res[key];
}
/** The apply's appliedAddresses — the rows that committed — checked against its applied count. */
function appliedOf(res, label) {
  assert(res && Array.isArray(res.appliedAddresses), `${label}: the apply must resolve appliedAddresses, the addresses of the rows that committed (clarification C5); got ${show(res)}`);
  eq(res.appliedAddresses.length, res.applied, `${label}: appliedAddresses.length (must equal applied)`);
  return res.appliedAddresses;
}
const writeTxs = (fake) => fake.st.txs.filter((t) => t.mode === 'WRITE');
const runsOf = (fake, kind) => fake.st.txs.flatMap((t) => t.runs.filter((r) => r.kind === kind));
function propsOf(fake, address) {
  const row = fake.st.store.get(address);
  return row ? Object.fromEntries(row.props.map((p) => [p[0], p[2] !== null ? p[2] : p[3]])) : null;
}
/** Props sent to Neo4j carry only the nine keys, with an integer-typed createdAt equal to the edge's. */
function checkSentProps(props, edge, label) {
  assert(props && typeof props === 'object', `${label}: row.props missing; got ${show(props)}`);
  const extra = Object.keys(props).filter((k) => !F.PROPERTY_KEYS.includes(k));
  assert(extra.length === 0, `${label}: props carry keys outside the nine: ${show(extra)}`);
  assert(isIntegerTyped(props.createdAt), `${label}: createdAt must be sent integer-typed (BigInt or neo4j Integer), never a JS number (stored as FLOAT); got ${show(props.createdAt)} (${typeof props.createdAt})`);
  eq(String(props.createdAt), String(edge.createdAt), `${label}: createdAt value`);
}

// ─── tests ─────────────────────────────────────────────────────────────────────────────────────────────────────
const tests = [];
function test(name, fn) { tests.push([name, fn]); }

// ══ S — static sentinels ═════════════════════════════════════════════════════════════════════════════════════
test('SWR1: the task registry holds exactly one reconcileTaggingEdges entry, and the file still parses as JSON', () => {
  const text = safeRead(REGISTRY_PATH);
  eq((text.match(/"reconcileTaggingEdges"\s*:/g) || []).length, 1,
    'number of "reconcileTaggingEdges": keys in taskRegistry.json (a second one would silently shadow the first)');
  taskEntry();
});

test('SWR2: reconcileTaggingEdges takes no arguments — "arguments": false and "staticArgs": "" — so no confirmation can ride a task argument', () => {
  const t = taskEntry();
  eq(t.arguments, false, 'tasks.reconcileTaggingEdges.arguments');
  eq(t.staticArgs, '', 'tasks.reconcileTaggingEdges.staticArgs');
});

test('SWR3: reconcileTaggingEdges takes the shared neo4j-heavy lock class and has no parent', () => {
  const t = taskEntry();
  eq(t.resourceClass, 'neo4j-heavy', 'tasks.reconcileTaggingEdges.resourceClass (ADR 0002 D10-A)');
  assert(!Object.prototype.hasOwnProperty.call(t, 'parent'), `tasks.reconcileTaggingEdges must have no "parent" (ADR 0002: "with no parent"); got parent = ${show(t.parent)}`);
});

test('SWR4: its time-out is 30 minutes with an explicit forceKill: true in its own block, and the task system reads it that way', () => {
  const t = taskEntry();
  const to = t.options && t.options.completion && t.options.completion.failure && t.options.completion.failure.timeout;
  assert(to && typeof to === 'object', `tasks.reconcileTaggingEdges.options.completion.failure.timeout must exist; got options = ${show(t.options)}`);
  eq(to.duration, 1800000, 'timeout.duration (30 min, below the 4 h neo4j-heavy lease)');
  eq(to.forceKill, true, 'timeout.forceKill (an explicit declared-intent sentinel)');
  const { resolveTaskTimeout } = loadModule(TASK_TIMEOUT, 'src/utils/taskTimeout.js');
  const r = resolveTaskTimeout(t, registry());
  eq(r.timeoutMs, 1800000, 'resolveTaskTimeout(entry).timeoutMs');
  eq(r.forceKill, true, 'resolveTaskTimeout(entry).forceKill');
  eq(r.source, 'task-specific registry config', 'resolveTaskTimeout(entry).source (the time-out comes from the task\'s own block)');
});

test('SWR5: its script is a bash wrapper (.sh) that exists, and script_relative_path is a substring of both the wrapper\'s path and the node runner\'s it execs, so the double-run guard matches either process', () => {
  const t = taskEntry();
  assert(typeof t.script === 'string' && /\.sh$/.test(t.script), `tasks.reconcileTaggingEdges.script must be a .sh wrapper; got ${show(t.script)}`);
  assert(t.script.startsWith(SRC_DIR_VAR), `script must start with ${SRC_DIR_VAR}; got ${show(t.script)}`);
  assert(Array.isArray(t.scripts) && t.scripts.includes(t.script), `scripts must list the same wrapper; got scripts = ${show(t.scripts)}, script = ${show(t.script)}`);
  const onDisk = path.join(REPO_ROOT, 'src', t.script.slice(SRC_DIR_VAR.length));
  assert(fs.existsSync(onDisk), `the wrapper ${path.relative(REPO_ROOT, onDisk)} must exist`);
  const srp = t.script_relative_path;
  assert(typeof srp === 'string' && srp.length > 0, `script_relative_path must be a non-empty string; got ${show(srp)}`);
  const misses = uniq([t.script, ...t.scripts, RUNNER_ENTRY]).filter((p) => !p.includes(srp));
  assert(misses.length === 0, `script_relative_path ${show(srp)} must be a substring of every entry path (the bash wrapper and the node runner it execs, which is the process pgrep finds after exec); it is not in ${show(misses)}`);
});

function freshInstallSeeds() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tagging-edges-wiring-'));
  try {
    const code = [
      `const m = require(${JSON.stringify(SCHED_TASKS)});`,
      'const cfg = m.readConfig();',
      `const reg = JSON.parse(require('fs').readFileSync(${JSON.stringify(REGISTRY_PATH)}, 'utf8'));`,
      'const listed = m.filterSchedulableTasks(reg).map((t) => t.taskId);',
      "process.stdout.write('\\n@@SEEDS@@' + JSON.stringify({ entries: cfg.entries, listed }));",
    ].join('\n');
    const r = spawnSync(process.execPath, ['-e', code], {
      cwd: REPO_ROOT, encoding: 'utf8', timeout: 30000,
      env: { ...process.env, SCHEDULED_TASKS_CONFIG_PATH: path.join(dir, 'scheduled-tasks.json') },
    });
    const out = r.stdout || '';
    const at = out.lastIndexOf('@@SEEDS@@');
    if (r.status !== 0 || at < 0) throw new Error(`could not read the fresh-install schedule (exit ${r.status}): ${tail(r.stderr)}`);
    return JSON.parse(out.slice(at + '@@SEEDS@@'.length));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('SWR6: a fresh install\'s Scheduled Tasks list reconcileTaggingEdges as a disabled daily entry with no arguments, after the applicability seed, valid as shipped and runnable once turned on', () => {
  const { entries, listed } = freshInstallSeeds();
  const ids = entries.map((e) => e.id);
  const i = ids.indexOf('seed:reconcileTaggingEdges');
  assert(i >= 0, `the fresh-install seeds are ${show(ids)}; expected one with id "seed:reconcileTaggingEdges" (ADR 0002, Changed files → scheduled-tasks)`);
  const s = entries[i];
  same({ taskId: s.taskId, args: s.args, enabled: s.enabled, intervalDays: s.intervalDays, intervalHours: s.intervalHours, intervalMinutes: s.intervalMinutes, cron: s.cron },
    { taskId: TASK, args: {}, enabled: false, intervalDays: 1, intervalHours: 0, intervalMinutes: 0, cron: '' },
    'the seed:reconcileTaggingEdges entry');
  assert(ids.includes('seed:refreshPinnedTagTLs'), `the existing seed:refreshPinnedTagTLs must stay; seeds are ${show(ids)}`);
  eq(ids.indexOf('seed:refreshApplicabilityLists'), i - 1, 'the position of seed:refreshApplicabilityLists (the new seed goes straight after it)');
  assert(listed.includes(TASK), `Scheduled Tasks' registry list (filterSchedulableTasks) must offer ${TASK}; it offers ${listed.length} tasks without it`);
  const { validateEntry } = loadModule(SCHED_VALIDATION, 'src/api/scheduled-tasks/validation.js');
  const reg = registry();
  const shipped = validateEntry(s, reg);
  assert(shipped.ok, `validateEntry must accept the seed as shipped; got ${show(shipped.errors)}`);
  const on = validateEntry({ ...s, enabled: true }, reg);
  assert(on.ok, `validateEntry must accept the seed once the owner turns it on (a runnable daily schedule); got ${show(on.errors)}`);
});

test('SWR7: the server\'s expected-rule list names tags_address once as a constraint and not as an index', () => {
  const m = loadModule(EXPECTED_SCHEMA, 'src/api/status/queries/expectedNeo4jSchema.js');
  eq(m.EXPECTED_CONSTRAINTS.filter((n) => n === CONSTRAINT_NAME).length, 1, 'occurrences of tags_address in EXPECTED_CONSTRAINTS');
  assert(!m.EXPECTED_INDEXES.includes(CONSTRAINT_NAME), 'EXPECTED_INDEXES must not list tags_address (the constraint\'s owned index carries its name)');
});

test('SWR8: the Dashboard\'s expected-rule list names tags_address (label TAGS.address, property address, entity TAGS) as a constraint and not as an index, so both checks agree', () => {
  const src = safeRead(DASHBOARD);
  const block = (name) => { const m = new RegExp(`const\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\];`).exec(src); return m ? m[1] : null; };
  const cons = block('EXPECTED_CONSTRAINTS');
  assert(cons !== null, 'ui/src/pages/Dashboard.jsx must still define EXPECTED_CONSTRAINTS');
  const obj = /\{[^{}]*\bname:\s*['"]tags_address['"][^{}]*\}/.exec(cons);
  assert(obj, `Dashboard EXPECTED_CONSTRAINTS must list { name: 'tags_address', label: 'TAGS.address', property: 'address', entity: 'TAGS' }; the list is:\n${cons.trim()}`);
  const field = (k) => { const m = new RegExp(`\\b${k}:\\s*['"]([^'"]*)['"]`).exec(obj[0]); return m ? m[1] : null; };
  same({ label: field('label'), property: field('property'), entity: field('entity') },
    { label: 'TAGS.address', property: 'address', entity: 'TAGS' }, 'the Dashboard\'s tags_address entry');
  eq((cons.match(/['"]tags_address['"]/g) || []).length, 1, 'occurrences of tags_address in the Dashboard\'s EXPECTED_CONSTRAINTS');
  const idx = block('EXPECTED_INDEXES');
  assert(idx !== null, 'ui/src/pages/Dashboard.jsx must still define EXPECTED_INDEXES');
  assert(!/tags_address/.test(idx), 'the Dashboard\'s EXPECTED_INDEXES must not list tags_address');
});

function setupStatements() {
  const src = safeRead(SETUP_SCRIPT);
  const m = /CYPHER_COMMAND="([\s\S]*?)"/.exec(src);
  assert(m, 'setup/neo4jConstraintsAndIndexes.sh must still build its statement block in CYPHER_COMMAND="…"');
  return m[1].split(';').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

test('SWR9: the setup script\'s last statement is CREATE CONSTRAINT tags_address IF NOT EXISTS FOR ()-[r:TAGS]-() REQUIRE r.address IS UNIQUE, so under set -e its failure cannot skip an earlier rule', () => {
  const stmts = setupStatements();
  const last = stmts[stmts.length - 1];
  assert(CONSTRAINT_RE.test(last), `the last statement of CYPHER_COMMAND must be the tags_address constraint; it is: ${last}`);
  eq(stmts.filter((s) => /\btags_address\b/.test(s)).length, 1, 'statements naming tags_address in the setup script');
  const tagsIndexes = stmts.filter((s) => /^CREATE\s+(?:\w+\s+)?INDEX\b/i.test(s) && /\bTAGS\b/.test(s));
  assert(tagsIndexes.length === 0, `no separate index on TAGS (a plain index would block the constraint); found ${show(tagsIndexes)}`);
});

test('SWR10: bin/control-panel.js starts the boot hook — ensureTagsConstraintOnBoot from src/pipeline/tagging-edges/graph — after await api.register(app), without awaiting it', () => {
  const src = codeOnly(safeRead(CONTROL_PANEL));
  const reg = src.search(/await\s+api\.register\s*\(\s*app\s*\)/);
  assert(reg >= 0, 'bin/control-panel.js must still await api.register(app)');
  assert(/require\(\s*['"](?:\.\.\/)+src\/pipeline\/tagging-edges\/graph(?:\.js)?['"]\s*\)/.test(src),
    'bin/control-panel.js must require ../src/pipeline/tagging-edges/graph');
  const calls = [...src.matchAll(/\bensureTagsConstraintOnBoot\s*\(/g)];
  assert(calls.length > 0, 'bin/control-panel.js must call ensureTagsConstraintOnBoot(…) (ADR 0002 D12-A)');
  for (const c of calls) {
    assert(c.index > reg, 'the ensureTagsConstraintOnBoot call must come after await api.register(app)');
    const start = Math.max(src.lastIndexOf(';', c.index), src.lastIndexOf('{', c.index), src.lastIndexOf('}', c.index));
    const lead = src.slice(start + 1, c.index);
    assert(!/\bawait\b/.test(lead) && !/\breturn\b/.test(lead),
      `the boot hook must not be awaited (never delay boot on Neo4j); the call reads: ${lead.trim()} ensureTagsConstraintOnBoot(…)`);
  }
});

test('SWR11: src/api/index.js registers GET /api/tagging-edges/status and /held as public reads and POST /api/tagging-edges/confirm-held-removals behind adminApi.requireOwnerOnly, after adminApi is required', () => {
  const src = codeOnly(safeRead(API_INDEX));
  const mod = /(?:const|let|var)\s+(\w+)\s*=\s*require\(\s*['"]\.\/tagging-edges(?:\/index(?:\.js)?)?['"]\s*\)/.exec(src);
  assert(mod, 'src/api/index.js must require(\'./tagging-edges\') for the three handlers');
  const v = mod[1];
  const routes = [
    ['get', '/api/tagging-edges/status', [`${v}.handleStatus`]],
    ['get', '/api/tagging-edges/held', [`${v}.handleHeld`]],
    ['post', '/api/tagging-edges/confirm-held-removals', ['adminApi.requireOwnerOnly', `${v}.handleConfirmHeldRemovals`]],
  ];
  const adminAt = src.search(/const\s+adminApi\s*=\s*require\(\s*['"]\.\/admin['"]\s*\)/);
  assert(adminAt >= 0, 'src/api/index.js must still require adminApi from ./admin');
  const problems = [];
  for (const [method, p, args] of routes) {
    const any = [...src.matchAll(new RegExp(`['"]${escapeRe(p)}['"]`, 'g'))];
    if (any.length !== 1) { problems.push(`${p} must be registered exactly once; found ${any.length}`); continue; }
    const m = new RegExp(`app\\.${method}\\(\\s*['"]${escapeRe(p)}['"]\\s*,([^;]*?)\\)\\s*;`).exec(src);
    if (!m) { problems.push(`${p} must be registered with app.${method}(…)`); continue; }
    const got = splitTopLevel(m[1]);
    if (show(got) !== show(args)) problems.push(`${method.toUpperCase()} ${p} must be registered with ${args.join(', ')}; got ${got.join(', ')}`);
    if (m.index < adminAt) problems.push(`${p} must be registered after adminApi is required`);
  }
  const auth = safeRead(AUTH_MW);
  const gated = [...(stringsOfArray(auth, 'ownerOnlyEndpoints') || []), ...(stringsOfArray(auth, 'ownerOnlyGetEndpoints') || [])];
  assert(gated.length > 0, 'could not read ownerOnlyEndpoints from src/middleware/auth.js');
  for (const [, p] of routes) for (const g of gated) if (p.includes(g)) problems.push(`${p} contains the owner-only substring ${g} (auth.js would gate it by substring)`);
  assert(problems.length === 0, problems.join('\n        '));
});

// ══ C — the statement audit of graph.js ══════════════════════════════════════════════════════════════════════
test('SWR12: graph.js loads without loading neo4j-driver (a lazy require) and exports CYPHER, SCALAR_TYPES, toWriteProps, schemaStatusFromRows, toCount, openGraph and ensureTagsConstraintOnBoot', () => {
  const code = [
    `try { require(${JSON.stringify(GRAPH_PATH)}); } catch (e) { process.stdout.write('@@LOADFAIL@@' + String(e && e.message).split('\\n')[0]); process.exit(0); }`,
    "const hits = Object.keys(require.cache).filter((k) => /[\\\\/]node_modules[\\\\/]neo4j-driver/.test(k));",
    "process.stdout.write('@@LOADED@@' + JSON.stringify(hits.slice(0, 3)) + '|' + hits.length);",
  ].join('\n');
  const r = spawnSync(process.execPath, ['-e', code], { cwd: REPO_ROOT, encoding: 'utf8', timeout: 30000 });
  const out = r.stdout || '';
  if (out.includes('@@LOADFAIL@@')) throw new Error(`src/pipeline/tagging-edges/graph.js not implemented yet (require failed: ${out.split('@@LOADFAIL@@')[1]})`);
  assert(out.includes('@@LOADED@@'), `loading graph.js in a child process failed (exit ${r.status}): ${tail(r.stderr)}`);
  const [sample, n] = out.split('@@LOADED@@')[1].split('|');
  eq(Number(n), 0, `neo4j-driver modules loaded just by requiring graph.js (ADR 0002: lazy require('neo4j-driver'), so it loads stack-free); first: ${sample}`);
  const g = loadGraph();
  const want = { CYPHER: 'object', SCALAR_TYPES: 'object', toWriteProps: 'function', schemaStatusFromRows: 'function', toCount: 'function', openGraph: 'function', ensureTagsConstraintOnBoot: 'function' };
  const wrong = Object.keys(want).filter((k) => typeof g[k] !== want[k] || g[k] === null).map((k) => `${k} (${typeof g[k]})`);
  assert(wrong.length === 0, `graph.js exports missing or of the wrong type: ${wrong.join(', ')}`);
});

test('SWR13: graph.js CYPHER holds the ADR\'s statements — READ_ALL, READ_AT, LOCK, UPDATE, MOVE, REMOVE, CREATE_IF_ABSENT and CREATE_TAGS_CONSTRAINT', () => {
  const c = cypherMap();
  const missing = STATEMENT_NAMES.filter((k) => typeof c[k] !== 'string' || !c[k].trim());
  assert(missing.length === 0, `CYPHER is missing: ${missing.join(', ')} (it has: ${Object.keys(c).join(', ') || 'nothing'})`);
});

test('SWR14: no statement in graph.js contains DETACH, REMOVE, ON CREATE, ON MATCH or timestamp, and none creates an index', () => {
  const forbidden = [
    ['DETACH', /\bDETACH\b/i],
    ['REMOVE', /\bREMOVE\b/i],
    ['ON CREATE', /\bON\s+CREATE\b/i],
    ['ON MATCH', /\bON\s+MATCH\b/i],
    ['timestamp', /timestamp/i],
    ['CREATE … INDEX (no separate index on TAGS.address)', /\bCREATE\s+(?:\w+\s+)?INDEX\b/i],
  ];
  const hits = [];
  for (const [at, s] of allStatements()) for (const [what, re] of forbidden) if (re.test(s)) hits.push(`CYPHER.${at} contains ${what}: ${s.slice(0, 140)}`);
  assert(hits.length === 0, hits.join('\n        '));
});

test('SWR15: the only clause that touches a node is a bare keyed MERGE (x:NostrUser {pubkey: …}) — no SET on a node, every CREATE a TAGS relationship — and MOVE and CREATE_IF_ABSENT merge both ends', () => {
  const problems = [];
  for (const [at, s] of allStatements()) {
    if (isSchemaStatement(s)) continue;
    const rels = relVars(s);
    for (const cl of clauses(s)) {
      if (cl.kw === 'SET') {
        for (const item of setItems(cl.text)) {
          const v = (/^(\w+)/.exec(item) || [])[1];
          if (!rels.has(v)) problems.push(`CYPHER.${at}: SET on ${v || item}, which is not a relationship variable (${cl.text})`);
        }
      }
      if (cl.kw === 'MERGE' && !/^MERGE\s*\(\s*\w+\s*:\s*NostrUser\s*\{\s*pubkey\s*:\s*[\w.$]+\s*\}\s*\)$/i.test(cl.text)) {
        problems.push(`CYPHER.${at}: a MERGE that is not a bare keyed NostrUser merge: ${cl.text}`);
      }
      if (cl.kw === 'CREATE' && !/^CREATE\s*\(\s*\w+\s*\)\s*-\s*\[\s*\w+\s*:\s*TAGS\s*\]\s*->\s*\(\s*\w+\s*\)$/i.test(cl.text)) {
        problems.push(`CYPHER.${at}: a CREATE that is not a TAGS relationship between bound nodes: ${cl.text}`);
      }
    }
  }
  for (const name of ['MOVE', 'CREATE_IF_ABSENT']) {
    const s = statement(name);
    for (const end of ['from', 'to']) {
      if (!new RegExp(`MERGE\\s*\\(\\s*\\w+\\s*:\\s*NostrUser\\s*\\{\\s*pubkey\\s*:\\s*row\\.${end}\\s*\\}\\s*\\)`, 'i').test(s)) {
        problems.push(`CYPHER.${name} must MERGE (x:NostrUser {pubkey: row.${end}}) in the same statement (ADR D6-B)`);
      }
    }
  }
  assert(problems.length === 0, problems.join('\n        '));
});

test('SWR16: the only DELETE is of one TAGS relationship matched by its address, and REMOVE deletes over $addresses and does nothing else', () => {
  const problems = [];
  for (const [at, s] of allStatements()) {
    for (const cl of clauses(s).filter((x) => x.kw === 'DELETE')) {
      const m = /^DELETE\s+(\w+)$/i.exec(cl.text);
      if (!m) { problems.push(`CYPHER.${at}: DELETE must name exactly one variable: ${cl.text}`); continue; }
      if (!new RegExp(`-\\s*\\[\\s*${m[1]}\\s*:\\s*TAGS\\s*\\{\\s*address\\s*:`, 'i').test(s)) {
        problems.push(`CYPHER.${at}: DELETE ${m[1]} is not a TAGS relationship matched by {address: …}`);
      }
    }
  }
  const rm = statement('REMOVE');
  if (!/\bUNWIND\s+\$addresses\b/i.test(rm)) problems.push('CYPHER.REMOVE must UNWIND $addresses');
  if (!/\bDELETE\b/i.test(rm)) problems.push('CYPHER.REMOVE must DELETE the relationship');
  for (const kw of ['CREATE', 'MERGE', 'SET']) if (new RegExp(`\\b${kw}\\b`, 'i').test(rm)) problems.push(`CYPHER.REMOVE must not ${kw}`);
  if (!/\bRETURN\s+count\s*\(/i.test(rm)) problems.push('CYPHER.REMOVE must return its row count');
  assert(problems.length === 0, problems.join('\n        '));
});

test('SWR17: LOCK takes each relationship\'s write lock with SET r.address = r.address on TAGS matched by address, returning a count and changing nothing else', () => {
  const s = statement('LOCK');
  const m = /-\s*\[\s*(\w+)\s*:\s*TAGS\s*\{\s*address\s*:\s*(\w+)\s*\}\s*\]/i.exec(s);
  assert(m, `CYPHER.LOCK must MATCH ()-[r:TAGS {address: a}]->(); it reads: ${s}`);
  const [, r, a] = m;
  assert(new RegExp(`\\bUNWIND\\s+\\$addresses\\s+AS\\s+${a}\\b`, 'i').test(s), `CYPHER.LOCK must UNWIND $addresses AS ${a}; it reads: ${s}`);
  const sets = clauses(s).filter((c) => c.kw === 'SET').flatMap((c) => setItems(c.text));
  same(sets.map((x) => x.replace(/\s+/g, '')), [`${r}.address=${r}.address`], 'CYPHER.LOCK\'s SET items (the lock-first idiom, and nothing else)');
  for (const kw of ['DELETE', 'CREATE', 'MERGE']) assert(!new RegExp(`\\b${kw}\\b`, 'i').test(s), `CYPHER.LOCK must not ${kw}`);
  assert(/\bRETURN\s+count\s*\(/i.test(s), 'CYPHER.LOCK must return a count');
});

test('SWR18: MOVE deletes the old relationship before it creates the new one, in one statement', () => {
  const s = statement('MOVE');
  const cls = clauses(s);
  const del = cls.findIndex((c) => c.kw === 'DELETE');
  const cre = cls.findIndex((c) => c.kw === 'CREATE');
  assert(del >= 0 && cre >= 0, `CYPHER.MOVE must DELETE and CREATE; it reads: ${s}`);
  assert(del < cre, `CYPHER.MOVE must DELETE before it CREATEs (the uniqueness rule refuses create-then-delete); it reads: ${s}`);
  assert(/\bUNWIND\s+\$rows\s+AS\s+row\b/i.test(s), 'CYPHER.MOVE must UNWIND $rows AS row');
  assert(/-\s*\[\s*\w+\s*:\s*TAGS\s*\{\s*address\s*:\s*row\.address\s*\}\s*\]/i.test(s), 'CYPHER.MOVE must match the old relationship by row.address');
  const created = (/CREATE\s*\(\s*\w+\s*\)\s*-\s*\[\s*(\w+)\s*:\s*TAGS\s*\]/i.exec(s) || [])[1];
  assert(created && new RegExp(`\\bSET\\s+${created}\\s*=\\s*row\\.props\\b`, 'i').test(s), `CYPHER.MOVE must SET ${created || 'n'} = row.props on the new relationship`);
  assert(/\bRETURN\s+count\s*\(/i.test(s), 'CYPHER.MOVE must return its row count');
});

test('SWR19: CREATE_IF_ABSENT checks that no TAGS relationship holds the address (OPTIONAL MATCH … WHERE x IS NULL) before it creates, and returns the addresses it created', () => {
  const s = statement('CREATE_IF_ABSENT');
  const om = /OPTIONAL\s+MATCH\s*\(\s*\)\s*-\s*\[\s*(\w+)\s*:\s*TAGS\s*\{\s*address\s*:\s*row\.address\s*\}\s*\]\s*->\s*\(\s*\)/i.exec(s);
  assert(om, `CYPHER.CREATE_IF_ABSENT must OPTIONAL MATCH ()-[x:TAGS {address: row.address}]->(); it reads: ${s}`);
  const where = new RegExp(`\\bWHERE\\s+${om[1]}\\s+IS\\s+NULL\\b`, 'i').exec(s);
  assert(where, `CYPHER.CREATE_IF_ABSENT must filter WHERE ${om[1]} IS NULL`);
  const create = /\bCREATE\b/i.exec(s.slice(where.index));
  assert(om.index < where.index && create, 'CYPHER.CREATE_IF_ABSENT must check absence (OPTIONAL MATCH, then WHERE … IS NULL) before its CREATE');
  assert(/\bUNWIND\s+\$rows\s+AS\s+row\b/i.test(s), 'CYPHER.CREATE_IF_ABSENT must UNWIND $rows AS row');
  assert(/\bSET\s+\w+\s*=\s*row\.props\b/i.test(s), 'CYPHER.CREATE_IF_ABSENT must SET the new relationship = row.props');
  assert(/\bRETURN\s+row\.address\s+AS\s+address\b/i.test(s), 'CYPHER.CREATE_IF_ABSENT must RETURN row.address AS address');
  assert(!/\bDELETE\b/i.test(s), 'CYPHER.CREATE_IF_ABSENT must not DELETE');
});

test('SWR20: UPDATE replaces the whole property map (SET r = row.props, never +=) on the TAGS relationship matched by row.address, and does nothing else', () => {
  const s = statement('UPDATE');
  const m = /-\s*\[\s*(\w+)\s*:\s*TAGS\s*\{\s*address\s*:\s*row\.address\s*\}\s*\]/i.exec(s);
  assert(m, `CYPHER.UPDATE must MATCH ()-[r:TAGS {address: row.address}]->(); it reads: ${s}`);
  assert(/\bUNWIND\s+\$rows\s+AS\s+row\b/i.test(s), 'CYPHER.UPDATE must UNWIND $rows AS row');
  const sets = clauses(s).filter((c) => c.kw === 'SET').flatMap((c) => setItems(c.text)).map((x) => x.replace(/\s+/g, ''));
  same(sets, [`${m[1]}=row.props`], 'CYPHER.UPDATE\'s SET items (the whole map: an extra key does not survive)');
  for (const kw of ['DELETE', 'CREATE', 'MERGE']) assert(!new RegExp(`\\b${kw}\\b`, 'i').test(s), `CYPHER.UPDATE must not ${kw}`);
  assert(/\bRETURN\s+count\s*\(/i.test(s), 'CYPHER.UPDATE must return its row count');
});

test('SWR21: READ_ALL and READ_AT return the snapshot projection — rid, fromPubkey, fromPubkeyType, fromIsUser, toPubkey, toPubkeyType, toIsUser, props — with $scalarTypes; READ_AT over UNWIND $addresses', () => {
  const problems = [];
  for (const name of ['READ_ALL', 'READ_AT']) {
    const s = statement(name);
    if (!/MATCH\s*\(\s*\w+\s*\)\s*-\s*\[\s*\w+\s*:\s*TAGS\b[^\]]*\]\s*->\s*\(\s*\w+\s*\)/i.test(s)) problems.push(`${name} must MATCH (s)-[r:TAGS]->(t)`);
    for (const col of ROW_KEYS) if (!new RegExp(`\\b[Aa][Ss]\\s+${col}\\b`).test(s)) problems.push(`${name} must return a column AS ${col}`);
    if (!/\belementId\s*\(\s*\w+\s*\)\s+AS\s+rid\b/i.test(s)) problems.push(`${name} must return elementId(r) AS rid`);
    if (!/\bvalueType\s*\(/i.test(s)) problems.push(`${name} must type each value with valueType()`);
    if (!/\$scalarTypes\b/.test(s)) problems.push(`${name} must use $scalarTypes`);
    if (!/\btoString\s*\(/i.test(s)) problems.push(`${name} must carry scalars as toString text`);
    for (const kw of ['SET', 'CREATE', 'DELETE', 'MERGE']) if (new RegExp(`\\b${kw}\\b`, 'i').test(s)) problems.push(`${name} must not ${kw}`);
  }
  if (!/\bUNWIND\s+\$addresses\b/i.test(statement('READ_AT'))) problems.push('READ_AT must UNWIND $addresses');
  assert(problems.length === 0, problems.join('\n        '));
});

test('SWR22: CREATE_TAGS_CONSTRAINT is CREATE CONSTRAINT tags_address IF NOT EXISTS FOR ()-[r:TAGS]-() REQUIRE r.address IS UNIQUE — the same statement the setup script ends with', () => {
  const s = statement('CREATE_TAGS_CONSTRAINT');
  assert(CONSTRAINT_RE.test(s), `CYPHER.CREATE_TAGS_CONSTRAINT reads: ${s}`);
  const stmts = setupStatements();
  const last = stmts[stmts.length - 1];
  eq(last.replace(/;$/, '').trim(), s.replace(/;$/, '').trim(), 'the setup script\'s last statement vs graph.js CYPHER.CREATE_TAGS_CONSTRAINT (whitespace-normalised)');
});

// ══ U — graph.js's pure helpers ══════════════════════════════════════════════════════════════════════════════
test('SWR23: SCALAR_TYPES is exactly the four scalar types READ_ALL carries as text — INTEGER, FLOAT, STRING, BOOLEAN, each NOT NULL', () => {
  const t = graphExport('SCALAR_TYPES', 'object');
  assert(Array.isArray(t), `SCALAR_TYPES must be an array; got ${show(t)}`);
  sameSet(t, F.SCALAR_TYPES, 'SCALAR_TYPES');
  eq(t.length, 4, 'SCALAR_TYPES length');
});

test('SWR24: toWriteProps(edge) gives the nine TAGS properties with the edge\'s values and createdAt as a BigInt — never type, from or to', () => {
  const toWriteProps = graphExport('toWriteProps');
  const edge = F.contractEdge(F.makeTagging());
  const p = toWriteProps(edge);
  assert(p && typeof p === 'object', `toWriteProps must return an object; got ${show(p)}`);
  sameSet(Object.keys(p), F.PROPERTY_KEYS, 'toWriteProps(a fully resolved edge) keys');
  eq(typeof p.createdAt, 'bigint', 'typeof toWriteProps(edge).createdAt (a plain JS number is stored as FLOAT)');
  eq(p.createdAt, BigInt(edge.createdAt), 'toWriteProps(edge).createdAt');
  for (const k of F.PROPERTY_KEYS.filter((x) => x !== 'createdAt')) eq(p[k], edge[k], `toWriteProps(edge).${k}`);
});

test('SWR25: toWriteProps omits null values, keeps false ones, and never writes a key outside the nine even when the edge carries one', () => {
  const toWriteProps = graphExport('toWriteProps');
  const edge = F.contractEdge(F.makeTagging({ a: null, polarity: null })); // id-only, unresolved; no stance
  eq(edge.tagAddress, null, 'fixture: the id-only edge is unresolved');
  const p = toWriteProps(edge);
  sameSet(Object.keys(p), F.PROPERTY_KEYS.filter((k) => !['polarity', 'tagAddress', 'tagSlug'].includes(k)), 'toWriteProps(edge with null polarity, tagAddress, tagSlug) keys');
  eq(p.zLocal, false, 'toWriteProps(edge).zLocal (false is a value, not a null)');
  const q = toWriteProps({ ...F.contractEdge(F.makeTagging()), weight: 5, timestamp: 1, trusted: true });
  const outside = Object.keys(q).filter((k) => !F.PROPERTY_KEYS.includes(k));
  assert(outside.length === 0, `toWriteProps must write only the nine keys (AC-8); it also wrote ${show(outside)}`);
});

test('SWR26: toCount turns a neo4j Integer count into a JS number and passes a plain number through', () => {
  const toCount = graphExport('toCount');
  const neo4j = neo4jLib();
  for (const n of [0, 1, 250, 7030]) {
    const v = toCount(neo4j.int(n));
    eq(typeof v, 'number', `typeof toCount(neo4j.int(${n}))`);
    eq(v, n, `toCount(neo4j.int(${n}))`);
  }
  eq(toCount(7), 7, 'toCount(7)');
  eq(toCount(0), 0, 'toCount(0)');
});

test('SWR27: schemaStatusFromRows finds tags_address present by definition — RELATIONSHIP, TAGS, [address], a *UNIQUENESS type, owned index ONLINE — whichever UNIQUENESS spelling SHOW gives', () => {
  const f = graphExport('schemaStatusFromRows');
  for (const type of ['RELATIONSHIP_UNIQUENESS', 'UNIQUENESS']) {
    const r = f([...clone(BASE_CONSTRAINTS), tagsConstraint(CONSTRAINT_NAME, { type })], [...clone(BASE_INDEXES), tagsIndex(CONSTRAINT_NAME)]);
    const v = tagsVerdict(r, `type ${type}`);
    eq(v.present, true, `tagsAddress.present with the rule in place (type ${type})`);
    eq(v.online, true, `tagsAddress.online with the owned index ONLINE (type ${type})`);
    eq(v.name, CONSTRAINT_NAME, `tagsAddress.name (type ${type})`);
    assert(!v.underAnotherName, `under its own name tagsAddress.underAnotherName must be false; got ${show(v)}`);
  }
});

test('SWR28: schemaStatusFromRows counts the definition under another name as present — underAnotherName true, naming it', () => {
  const f = graphExport('schemaStatusFromRows');
  const other = 'constraint_9f2c1a7b';
  const v = tagsVerdict(f([...clone(BASE_CONSTRAINTS), tagsConstraint(other)], [...clone(BASE_INDEXES), tagsIndex(other)]), 'another name');
  eq(v.present, true, 'tagsAddress.present when the definition is in place under another name');
  eq(v.online, true, 'tagsAddress.online (its owned index is ONLINE)');
  eq(v.underAnotherName, true, 'tagsAddress.underAnotherName ("present under another name", ADR graph.js)');
  eq(v.name, other, 'tagsAddress.name (the name it is present under)');
});

test('SWR29: schemaStatusFromRows finds tags_address missing when no relationship rule is listed (node rules and LOOKUP indexes with null lists only)', () => {
  const f = graphExport('schemaStatusFromRows');
  const none = tagsVerdict(f(clone(BASE_CONSTRAINTS), clone(BASE_INDEXES)), 'missing');
  same({ present: none.present, online: none.online }, { present: false, online: false }, 'tagsAddress with no TAGS rule');
  eq(tagsVerdict(f([], []), 'empty').present, false, 'tagsAddress.present with no rows at all');
});

test('SWR30: schemaStatusFromRows reports the rule listed but not online while its owned index is not ONLINE (POPULATING, FAILED, or not listed) — present true, online false, so the pass does not proceed on it', () => {
  const f = graphExport('schemaStatusFromRows');
  const cons = [...clone(BASE_CONSTRAINTS), tagsConstraint(CONSTRAINT_NAME)];
  for (const state of ['POPULATING', 'FAILED']) {
    const v = tagsVerdict(f(cons, [...clone(BASE_INDEXES), tagsIndex(CONSTRAINT_NAME, state)]), state);
    same({ present: v.present, online: v.online }, { present: true, online: false }, `tagsAddress with the owned index ${state}`);
  }
  const unlisted = tagsVerdict(f(cons, clone(BASE_INDEXES)), 'no owned index');
  same({ present: unlisted.present, online: unlisted.online }, { present: true, online: false }, 'tagsAddress with the owned index not listed');
});

test('SWR54: schemaStatusFromRows also judges nostrUser_pubkey by its definition (NODE, NostrUser, [pubkey], UNIQUENESS) — present with the base rules, not present without it or with another definition', () => {
  const f = graphExport('schemaStatusFromRows');
  const verdict = (r, label) => {
    assert(r && r.nostrUserPubkey && typeof r.nostrUserPubkey.present === 'boolean',
      `${label}: schemaStatusFromRows must also return nostrUserPubkey: { present, … } (ADR runner step 6 checks nostrUser_pubkey by definition); got ${show(r)}`);
    return r.nostrUserPubkey;
  };
  const withIt = verdict(f(clone(BASE_CONSTRAINTS), clone(BASE_INDEXES)), 'base rules');
  same({ present: withIt.present, online: withIt.online, name: withIt.name }, { present: true, online: true, name: 'nostrUser_pubkey' }, 'nostrUserPubkey with the base rules');
  const without = verdict(f(clone(BASE_CONSTRAINTS).filter((c) => c.name !== 'nostrUser_pubkey'), clone(BASE_INDEXES).filter((i) => i.name !== 'nostrUser_pubkey')), 'without it');
  eq(without.present, false, 'nostrUserPubkey.present without the rule');
  const wrongProp = clone(BASE_CONSTRAINTS).map((c) => (c.name === 'nostrUser_pubkey' ? { ...c, properties: ['npub'] } : c));
  eq(verdict(f(wrongProp, clone(BASE_INDEXES)), 'another definition').present, false, 'nostrUserPubkey.present when the rule called nostrUser_pubkey is on another property');
});

test('SWR31: schemaStatusFromRows checks by definition, not by name: a rule called tags_address with any other definition is not present', () => {
  const f = graphExport('schemaStatusFromRows');
  const variants = [
    ['on eventId', { properties: ['eventId'] }, { properties: ['eventId'] }],
    ['composite (address, eventId)', { properties: ['address', 'eventId'] }, { properties: ['address', 'eventId'] }],
    ['on another type', { labelsOrTypes: ['FOLLOWS'] }, { labelsOrTypes: ['FOLLOWS'] }],
    ['on a node label TAGS', { entityType: 'NODE', type: 'UNIQUENESS' }, { entityType: 'NODE' }],
    ['an existence rule', { type: 'RELATIONSHIP_PROPERTY_EXISTENCE', ownedIndex: null }, null],
  ];
  const wrong = [];
  for (const [what, cOver, iOver] of variants) {
    const idx = iOver ? [...clone(BASE_INDEXES), tagsIndex(CONSTRAINT_NAME, 'ONLINE', iOver)] : clone(BASE_INDEXES);
    const v = tagsVerdict(f([...clone(BASE_CONSTRAINTS), tagsConstraint(CONSTRAINT_NAME, cOver)], idx), what);
    if (v.present !== false) wrong.push(`${what}: present = ${v.present}`);
  }
  assert(wrong.length === 0, `a rule named tags_address with the wrong definition must not count as present:\n        ${wrong.join('\n        ')}`);
});

// ══ B — the boot hook ════════════════════════════════════════════════════════════════════════════════════════
test('SWR32: the boot hook checks the schema and, finding tags_address missing, creates it with the ADR\'s statement as its own auto-commit call, never drops anything, and resolves', async () => {
  const st = await runBootHook({ initial: 'missing' });
  assertSettledQuietly(st, 'missing');
  const creates = st.calls.filter((c) => c.kind === 'create');
  eq(creates.length, 1, 'CREATE CONSTRAINT calls');
  eq(creates[0].via, 'write', 'the runner the CREATE went through (runWrite, the shared auto-commit writeCypher)');
  assert(CONSTRAINT_RE.test(norm(creates[0].text)), `the CREATE call must carry exactly the tags_address statement and nothing else; it carried: ${norm(creates[0].text)}`);
  const firstShow = st.calls.findIndex((c) => /^show-/.test(c.kind));
  assert(firstShow >= 0 && firstShow < creates[0].n, `the hook must check the schema before creating (ADR: "checks by definition; creates if missing"); calls were ${show(st.events)}`);
  assert(st.created, 'the fake schema should now hold tags_address');
  assert(!st.lines.some((l) => /not created/.test(l)), `a successful create must not log "not created"; logged ${show(st.lines)}`);
});

test('SWR33: the boot hook creates nothing when tags_address is present, and when the rule is present under another name it logs "present under another name" and drops nothing', async () => {
  const present = await runBootHook({ initial: 'present' });
  assertSettledQuietly(present, 'present');
  eq(present.createAttempts, 0, 'CREATE CONSTRAINT calls when tags_address is present by definition');
  const other = await runBootHook({ initial: 'other-name' });
  assertSettledQuietly(other, 'other name');
  assert(other.lines.some((l) => /present under another name/i.test(l)), `with the rule under another name the hook must log "present under another name"; logged ${show(other.lines)}`);
});

test('SWR34: the boot hook retries transient, connection and authentication errors — Neo.TransientError.*, ServiceUnavailable, SessionExpired, Security.Unauthorized / AuthenticationRateLimit / CredentialsExpired — first after 5 s, then creates the rule', async () => {
  const neo4j = neo4jLib();
  const problems = [];
  for (const code of RETRY_CODES) {
    for (const where of ['first call', 'the create']) {
      let fired = false;
      const st = await runBootHook({
        initial: 'missing',
        fail: (call) => {
          if (fired) return null;
          if (where === 'first call' || call.kind === 'create') { fired = true; return new neo4j.Neo4jError(`fake ${code}`, code); }
          return null;
        },
      });
      const label = `${code} at ${where}`;
      if (!fired) { problems.push(`${label}: the hook never made that call`); continue; }
      if (st.outcome.rejected) { problems.push(`${label}: rejected (${firstLine(st.outcome.error && st.outcome.error.message)})`); continue; }
      if (!st.created) problems.push(`${label}: did not retry and create tags_address (calls: ${show(st.events)})`);
      const failAt = st.events.indexOf(`fail:${code}`);
      const nextSleep = st.events.slice(failAt + 1).find((e) => e.startsWith('sleep:'));
      if (nextSleep !== 'sleep:5000') problems.push(`${label}: the first backoff must be 5 s; the next sleep was ${nextSleep || 'none'}`);
      if (st.drops.length) problems.push(`${label}: sent DROP`);
      if (st.lines.some((l) => l.startsWith(LOG_PREFIX))) problems.push(`${label}: logged "not created" although it went on to create`);
    }
  }
  assert(problems.length === 0, problems.join('\n        '));
});

test('SWR35: while Neo4j stays unreachable the boot hook backs off from 5 s to 60 s, gives up after about 30 minutes, logs a line naming tags_address and resolves', async () => {
  const neo4j = neo4jLib();
  const st = await runBootHook({ initial: 'missing', fail: () => new neo4j.Neo4jError('fake: connection refused', 'ServiceUnavailable') });
  assertSettledQuietly(st, 'unreachable');
  assert(!st.overran, `the hook kept retrying past 40 min of backoff (sleeps: ${st.sleeps.length}); ADR 0002: "for up to 30 min" — measure the window by the injected sleep (or Date.now)`);
  const total = st.sleeps.reduce((a, b) => a + Number(b), 0);
  assert(total >= 29 * MIN && total <= 31 * MIN, `total backoff before giving up must be about 30 min; it was ${(total / MIN).toFixed(2)} min over ${st.sleeps.length} sleeps`);
  eq(st.sleeps[0], 5000, 'the first backoff');
  const bad = st.sleeps.filter((ms) => ms < 5000 || ms > 60000);
  assert(bad.length === 0, `every backoff must be between 5 s and 60 s; got ${show(bad)}`);
  const drops = st.sleeps.filter((ms, i) => i > 0 && ms < st.sleeps[i - 1]);
  assert(drops.length === 0, `the backoff must not shrink; sleeps were ${show(st.sleeps)}`);
  eq(Math.max(...st.sleeps), 60000, 'the backoff reaches its 60 s ceiling');
  assert(!st.created, 'nothing was created (the fake never answered)');
  assert(st.lines.some((l) => /tags_address/.test(l)), `giving up must leave a log line naming tags_address; logged ${show(st.lines)}`);
});

test('SWR36: the boot hook stops at the first error outside the retry list — a schema client error included — after one attempt, logging one line "[tagging-edges] uniqueness rule tags_address not created: <code>"', async () => {
  const neo4j = neo4jLib();
  const problems = [];
  for (const code of ['Neo.ClientError.Schema.ConstraintCreationFailed', 'Neo.ClientError.Schema.IndexAlreadyExists', 'Neo.ClientError.Statement.SyntaxError']) {
    const st = await runBootHook({ initial: 'missing', fail: (call) => (call.kind === 'create' ? new neo4j.Neo4jError(`fake ${code}`, code) : null) });
    if (st.outcome.rejected) { problems.push(`${code}: rejected`); continue; }
    if (st.createAttempts !== 1) problems.push(`${code}: CREATE attempted ${st.createAttempts} times; expected exactly 1 (no retry)`);
    if (st.lines.length !== 1) problems.push(`${code}: expected exactly one log line; got ${show(st.lines)}`);
    else if (!st.lines[0].startsWith(LOG_PREFIX) || !st.lines[0].includes(code)) problems.push(`${code}: the line must read "${LOG_PREFIX}${code}"; got ${show(st.lines[0])}`);
    if (st.drops.length) problems.push(`${code}: sent DROP`);
  }
  assert(problems.length === 0, problems.join('\n        '));
});

test('SWR37: the boot hook stops likewise on an error with no Neo4j status (the kernel-version refusal), after one attempt, logging one "not created" line', async () => {
  const problems = [];
  const makers = [
    ['a status-less Error', () => new Error('Unsupported operation: this database needs dbms.upgrade() to create relationship uniqueness constraints')],
    ['a TypeError', () => new TypeError('fake: cannot read properties of undefined')],
  ];
  for (const [what, make] of makers) {
    const st = await runBootHook({ initial: 'missing', fail: (call) => (call.kind === 'create' ? make() : null) });
    if (st.outcome.rejected) { problems.push(`${what}: rejected`); continue; }
    if (st.createAttempts !== 1) problems.push(`${what}: CREATE attempted ${st.createAttempts} times; expected exactly 1 (no retry)`);
    if (st.lines.length !== 1) problems.push(`${what}: expected exactly one log line; got ${show(st.lines)}`);
    else if (!st.lines[0].startsWith(LOG_PREFIX) || st.lines[0].length <= LOG_PREFIX.length) problems.push(`${what}: the line must read "${LOG_PREFIX}<code>"; got ${show(st.lines[0])}`);
  }
  assert(problems.length === 0, problems.join('\n        '));
});

test('SWR38: the boot hook never throws or rejects — not with a runner that throws synchronously, a log that throws, or rows it cannot read — and leaves no unhandled rejection', async () => {
  const neo4j = neo4jLib();
  const unhandled = [];
  const onUnhandled = (reason) => { unhandled.push(firstLine(reason && reason.message ? reason.message : reason)); };
  process.on('unhandledRejection', onUnhandled);
  const problems = [];
  try {
    const cases = [
      ['synchronous throwers', { runRead: () => { throw new TypeError('sync read boom'); }, runWrite: () => { throw new TypeError('sync write boom'); } }],
      ['a throwing log', { logThrows: true, fail: (call) => (call.kind === 'create' ? new neo4j.Neo4jError('fake', 'Neo.ClientError.Schema.ConstraintCreationFailed') : null) }],
      ['unreadable rows', { runRead: async () => null, runWrite: async () => [{ weird: true }] }],
    ];
    for (const [what, opts] of cases) {
      let st;
      try { st = await runBootHook({ initial: 'missing', ...opts }); } catch (e) { problems.push(`${what}: ${firstLine(e.message)}`); continue; }
      if (st.outcome.rejected) problems.push(`${what}: rejected (${firstLine(st.outcome.error && st.outcome.error.message)})`);
    }
    await delay(20);
  } finally {
    process.removeListener('unhandledRejection', onUnhandled);
  }
  assert(problems.length === 0 && unhandled.length === 0, `${problems.join('\n        ')}${unhandled.length ? `\n        unhandled rejections: ${show(unhandled)}` : ''}`);
});

// ══ P — the graph port against a fake driver ═════════════════════════════════════════════════════════════════
test('SWR39: openGraph builds its own driver — the given uri and basic credentials, pool 4, 30 s acquisition, 30 s retry, integers lossless — closes it on close(), and never prints the password', async () => {
  const fake = makeFakeNeo4j({ people: [F.ALICE, F.BOB] });
  const printed = [];
  const saved = { log: console.log, info: console.info, warn: console.warn, error: console.error, debug: console.debug, out: process.stdout.write, err: process.stderr.write };
  const grab = (...a) => { printed.push(a.map((x) => (typeof x === 'string' ? x : show(x))).join(' ')); };
  console.log = grab; console.info = grab; console.warn = grab; console.error = grab; console.debug = grab;
  process.stdout.write = function (chunk, ...rest) { printed.push(String(chunk)); return true; };
  process.stderr.write = function (chunk, ...rest) { printed.push(String(chunk)); return true; };
  try {
    await onFakeGraph(fake, (g) => g.applyCreates([createRow(0)], { timeoutMs: 60000 }));
  } finally {
    console.log = saved.log; console.info = saved.info; console.warn = saved.warn; console.error = saved.error; console.debug = saved.debug;
    process.stdout.write = saved.out; process.stderr.write = saved.err;
  }
  eq(fake.st.driverCalls.length, 1, 'drivers built by openGraph');
  const { uri, auth, config } = fake.st.driverCalls[0];
  eq(uri, CREDS.uri, 'the driver\'s uri');
  same({ scheme: auth && auth.scheme, principal: auth && auth.principal, credentials: auth && auth.credentials },
    { scheme: 'basic', principal: CREDS.user, credentials: PASSWORD }, 'the driver\'s auth token');
  assert(config && typeof config === 'object', `the driver must get a config; got ${show(config)}`);
  same({ maxConnectionPoolSize: config.maxConnectionPoolSize, connectionAcquisitionTimeout: config.connectionAcquisitionTimeout, maxTransactionRetryTime: config.maxTransactionRetryTime },
    { maxConnectionPoolSize: 4, connectionAcquisitionTimeout: 30000, maxTransactionRetryTime: 30000 }, 'the driver config (ADR 0002 runner step 5)');
  assert(config.disableLosslessIntegers !== true, 'the driver must keep integers lossless (disableLosslessIntegers must not be true)');
  assert(fake.st.driverClosed, 'close() must close the driver');
  const leak = printed.filter((l) => l.includes(PASSWORD));
  assert(leak.length === 0, `the password was printed: ${show(leak.map((l) => l.slice(0, 80)))}`);
});

test('SWR40: applyLocked(\'update\') runs LOCK, then the re-read, then UPDATE in one executeWrite with the given time-out, sends the nine keys with an integer createdAt, and succeeds on neo4j.int counts', async () => {
  const rows = [0, 1, 2].map((i) => updateRow(i));
  const fake = makeFakeNeo4j({ rows: rows.map((r) => r.snapshot), people: [F.ALICE, F.BOB] });
  const res = await onFakeGraph(fake, (g) => g.applyLocked('update', rows, { timeoutMs: 60000, preimage: noPreimage }));
  eq(num(res, 'applied', 'update'), 3, 'applied');
  eq(num(res, 'lostRace', 'update'), 0, 'lostRace');
  num(res, 'nodesCreated', 'update'); num(res, 'transientRetries', 'update');
  sameSet(appliedOf(res, 'update'), rows.map((r) => r.address), 'appliedAddresses (all three committed)');
  const w = writeTxs(fake);
  eq(w.length, 1, 'write transactions for 3 rows');
  same(w[0].runs.map((r) => r.kind), ['lock', 'reread', 'update'], 'statements in the transaction, in order');
  eq(w[0].config && w[0].config.timeout, 60000, 'the transaction time-out passed to executeWrite');
  sameSet(w[0].runs[0].params.addresses, rows.map((r) => r.address), 'LOCK $addresses');
  sameSet(w[0].runs[1].params.scalarTypes || [], F.SCALAR_TYPES, 'the re-read\'s $scalarTypes (the snapshot\'s own projection)');
  const sent = w[0].runs[2].params.rows;
  eq(sent.length, 3, 'UPDATE rows');
  for (const r of sent) {
    const row = rows.find((x) => x.address === r.address);
    assert(row, `UPDATE sent a row for an address it was not given: ${r.address}`);
    checkSentProps(r.props, row.desired, `UPDATE ${r.address}`);
    eq(r.props.polarity, '1', `UPDATE ${r.address}: polarity (the relay's version)`);
  }
  for (const r of rows) eq(propsOf(fake, r.address).polarity, '1', `the graph at ${r.address} after the update`);
});

test('SWR41: applyLocked skips and counts lost races — a relationship another writer changed (a scalar, or a list-valued key) or removed since the snapshot — acts on the rest, and does not treat LOCK\'s short count as an error', async () => {
  const A = updateRow(0);
  const B = updateRow(1, { snapshotOpts: { set: { polarity: '0' }, extra: { notes: ['x'] } } });
  const C = updateRow(2);
  const D = updateRow(3);
  const graphNow = [
    F.storedRow(edgeFor(0), { set: { polarity: '-1' } }),                    // A: changed by another writer
    F.storedRow(edgeFor(1), { set: { polarity: '0' }, extra: { notes: ['y'] } }), // B: its list-valued key changed
    // C: removed by another writer
    D.snapshot,                                                                  // D: as the snapshot saw it
  ];
  const fake = makeFakeNeo4j({ rows: graphNow, people: [F.ALICE, F.BOB] });
  const res = await onFakeGraph(fake, (g) => g.applyLocked('update', [A, B, C, D], { timeoutMs: 60000, preimage: noPreimage }));
  eq(num(res, 'applied', 'lost races'), 1, 'applied (D only)');
  eq(num(res, 'lostRace', 'lost races'), 3, 'lostRace (A changed, B changed, C gone)');
  same(appliedOf(res, 'lost races'), [D.address], 'appliedAddresses (D only — never a lost race\'s address)');
  const updates = runsOf(fake, 'update').flatMap((r) => r.params.rows.map((x) => x.address));
  same(updates, [D.address], 'addresses UPDATE was sent (verified rows only)');
  eq(propsOf(fake, A.address).polarity, '-1', 'A keeps the other writer\'s value');
  same(propsOf(fake, B.address).notes, ['y'], 'B keeps the other writer\'s list');
  eq(fake.st.store.has(C.address), false, 'C stays removed');
  eq(propsOf(fake, D.address).polarity, '1', 'D is updated');
});

test('SWR42: applyLocked fails the batch when an act statement\'s count differs from the rows it sent — a broken invariant — and the transaction rolls back', async () => {
  const rows = [0, 1].map((i) => updateRow(i));
  const fake = makeFakeNeo4j({ rows: rows.map((r) => r.snapshot), people: [F.ALICE, F.BOB], actDelta: { update: -1 } });
  await rejectionOf(() => onFakeGraph(fake, (g) => g.applyLocked('update', rows, { timeoutMs: 60000, preimage: noPreimage })), 'UPDATE counted 1 for 2 rows');
  assert(runsOf(fake, 'update').length >= 1, 'the UPDATE statement should have run before the batch failed');
  eq(writeTxs(fake).filter((t) => t.committed).length, 0, 'committed write transactions (the check must run inside the transaction so it rolls back)');
  for (const r of rows) eq(propsOf(fake, r.address).polarity, '0', `the graph at ${r.address} is unchanged`);
});

test('SWR43: applyLocked refuses to run without a preimage callback, before it opens any transaction', async () => {
  const rows = [0, 1].map((i) => updateRow(i));
  const problems = [];
  for (const [what, opts] of [['no preimage', { timeoutMs: 60000 }], ['preimage: true', { timeoutMs: 60000, preimage: true }], ['preimage: null', { timeoutMs: 60000, preimage: null }]]) {
    const fake = makeFakeNeo4j({ rows: rows.map((r) => r.snapshot), people: [F.ALICE, F.BOB] });
    let refused = false;
    try { await onFakeGraph(fake, (g) => g.applyLocked('update', rows, opts)); } catch (e) {
      if (isHarnessError(e)) throw e;
      refused = true;
    }
    if (!refused) problems.push(`${what}: applyLocked ran`);
    if (fake.st.txs.length) problems.push(`${what}: ${fake.st.txs.length} transaction(s) opened`);
  }
  assert(problems.length === 0, problems.join('\n        '));
});

test('SWR44: applyLocked awaits the preimage callback for a batch\'s rows before opening that batch\'s transaction, keeps each transaction to 250 rows or fewer, and a failing callback stops before its batch', async () => {
  const rows = Array.from({ length: 260 }, (_, i) => updateRow(i));
  const fake = makeFakeNeo4j({ rows: rows.map((r) => r.snapshot), people: [F.ALICE, F.BOB] });
  const calls = [];
  const preimage = async (batch) => {
    const id = calls.push({ addrs: batch.map((r) => r && r.address) }) - 1;
    fake.st.events.push({ e: 'preimage-call', id });
    await delay(2);
    fake.st.events.push({ e: 'preimage-done', id });
  };
  const res = await onFakeGraph(fake, (g) => g.applyLocked('update', rows, { timeoutMs: 60000, preimage }));
  eq(num(res, 'applied', 'batched'), 260, 'applied');
  const w = writeTxs(fake);
  assert(w.length >= 2, `260 rows need at least two transactions; got ${w.length}`);
  const problems = [];
  const locked = [];
  for (const tx of w) {
    const lock = tx.runs.find((r) => r.kind === 'lock');
    if (!lock) { problems.push(`transaction ${tx.id} has no LOCK`); continue; }
    const addrs = uniq(lock.params.addresses);
    locked.push(...addrs);
    if (addrs.length > 250) problems.push(`transaction ${tx.id} locked ${addrs.length} rows (at most 250)`);
    const openAt = fake.st.events.findIndex((e) => e.e === 'tx-open' && e.tx === tx.id);
    const covered = calls.some((c, id) => addrs.every((a) => c.addrs.includes(a))
      && fake.st.events.findIndex((e) => e.e === 'preimage-done' && e.id === id) < openAt
      && fake.st.events.findIndex((e) => e.e === 'preimage-done' && e.id === id) >= 0);
    if (!covered) problems.push(`transaction ${tx.id} opened before a preimage call covering its rows had resolved`);
  }
  sameSet(locked, rows.map((r) => r.address), 'every row was locked in some transaction');
  assert(problems.length === 0, problems.join('\n        '));

  const fake2 = makeFakeNeo4j({ rows: rows.map((r) => r.snapshot), people: [F.ALICE, F.BOB] });
  const poisoned = rows[255].address;
  const failed = [];
  const failing = async (batch) => {
    const addrs = batch.map((r) => r && r.address);
    if (addrs.includes(poisoned)) { failed.push(addrs); throw new Error('fake: pre-image append failed (EIO)'); }
  };
  await rejectionOf(() => onFakeGraph(fake2, (g) => g.applyLocked('update', rows, { timeoutMs: 60000, preimage: failing })), 'a failing preimage');
  assert(failed.length === 1, `the preimage callback should have failed once; it failed ${failed.length} times`);
  const reached = writeTxs(fake2).flatMap((t) => t.runs.filter((r) => r.kind === 'lock').flatMap((r) => r.params.addresses)).filter((a) => failed[0].includes(a));
  eq(reached.length, 0, 'rows of the batch whose preimage failed that reached a transaction');
});

test('SWR45: applyLocked(\'move\') sends the new ends with the nine keys and counts the people it adds; applyLocked(\'remove\') deletes by address; both succeed on neo4j.int counts', async () => {
  const DAVE = F.pubkeyOf('dave');
  const moves = [moveRow(0, F.CAROL), moveRow(1, DAVE)];
  const removes = [removeRow(2), removeRow(3)];
  const fake = makeFakeNeo4j({ rows: [...moves, ...removes].map((r) => r.snapshot), people: [F.ALICE, F.BOB] });
  const [mv, rm] = await onFakeGraph(fake, async (g) => [
    await g.applyLocked('move', moves, { timeoutMs: 60000, preimage: noPreimage }),
    await g.applyLocked('remove', removes, { timeoutMs: 60000, preimage: noPreimage }),
  ]);
  eq(num(mv, 'applied', 'move'), 2, 'moves applied');
  eq(num(mv, 'lostRace', 'move'), 0, 'moves lost');
  eq(num(mv, 'nodesCreated', 'move'), 2, 'people added by the moves (Carol and Dave, from the committed summary)');
  eq(num(rm, 'applied', 'remove'), 2, 'removals applied');
  sameSet(appliedOf(mv, 'move'), moves.map((r) => r.address), 'the moves\' appliedAddresses');
  sameSet(appliedOf(rm, 'remove'), removes.map((r) => r.address), 'the removals\' appliedAddresses');
  const moveTx = writeTxs(fake).find((t) => t.runs.some((r) => r.kind === 'move'));
  same(moveTx.runs.map((r) => r.kind), ['lock', 'reread', 'move'], 'statements in the move transaction');
  for (const r of moveTx.runs[2].params.rows) {
    const m = moves.find((x) => x.address === r.address);
    assert(m, `MOVE sent an unknown address ${r.address}`);
    same({ from: r.from, to: r.to }, { from: m.desired.from, to: m.desired.to }, `MOVE ${r.address} ends`);
    checkSentProps(r.props, m.desired, `MOVE ${r.address}`);
  }
  const rmTx = writeTxs(fake).find((t) => t.runs.some((r) => r.kind === 'remove'));
  same(rmTx.runs.map((r) => r.kind), ['lock', 'reread', 'remove'], 'statements in the remove transaction');
  sameSet(rmTx.runs[2].params.addresses, removes.map((r) => r.address), 'REMOVE $addresses');
  eq(fake.st.store.get(moves[0].address).toPubkey, F.CAROL, 'the first moved relationship now ends at Carol');
  for (const r of removes) eq(fake.st.store.has(r.address), false, `${r.address} removed`);
  for (const p of [F.ALICE, F.BOB, F.CAROL, DAVE]) assert(fake.st.people.has(p), `person ${p.slice(0, 8)} is still there`);
});

test('SWR46: applyCreates creates only where no TAGS relationship holds the address — a held address is a lost race — in transactions of 250 rows or fewer, with integer createdAt, counting each added person once', async () => {
  const rows = Array.from({ length: 262 }, (_, i) => createRow(i));
  const fake = makeFakeNeo4j({ rows: [F.storedRow(edgeFor(5))], people: [F.ALICE] });
  const res = await onFakeGraph(fake, (g) => g.applyCreates(rows, { timeoutMs: 60000 }));
  eq(num(res, 'applied', 'creates'), 261, 'created');
  eq(num(res, 'lostRace', 'creates'), 1, 'lost races (the address another writer holds)');
  eq(num(res, 'nodesCreated', 'creates'), 1, 'people added (Bob, once)');
  sameSet(appliedOf(res, 'creates'), rows.map((r) => r.address).filter((a) => a !== edgeFor(5).address), 'appliedAddresses (every create but the held address)');
  const creates = runsOf(fake, 'create');
  const big = creates.filter((r) => r.params.rows.length > 250);
  eq(big.length, 0, 'create statements carrying more than 250 rows');
  sameSet(creates.flatMap((r) => r.params.rows.map((x) => x.address)), rows.map((r) => r.address), 'addresses sent to CREATE_IF_ABSENT');
  for (const tx of writeTxs(fake)) eq(tx.config && tx.config.timeout, 60000, `transaction ${tx.id} time-out`);
  for (const r of creates[0].params.rows.slice(0, 5)) {
    const row = rows.find((x) => x.address === r.address);
    same({ from: r.from, to: r.to }, { from: row.desired.from, to: row.desired.to }, `CREATE ${r.address} ends`);
    checkSentProps(r.props, row.desired, `CREATE ${r.address}`);
  }
  eq(fake.st.store.size, 262, 'relationships in the graph afterwards');
});

test('SWR47: when a create batch meets Neo.ClientError.Schema.ConstraintValidationFailed, applyCreates re-runs that batch one row per transaction and counts the failing row as a lost race', async () => {
  const rows = [0, 1, 2].map((i) => createRow(i));
  const fake = makeFakeNeo4j({ people: [F.ALICE, F.BOB], conflicts: [rows[1].address] });
  const res = await onFakeGraph(fake, (g) => g.applyCreates(rows, { timeoutMs: 60000 }));
  eq(num(res, 'applied', 'conflict'), 2, 'created');
  eq(num(res, 'lostRace', 'conflict'), 1, 'lost races');
  sameSet(appliedOf(res, 'conflict'), [rows[0].address, rows[2].address], 'appliedAddresses (the refused row is not among them)');
  const w = writeTxs(fake);
  const firstFail = w.findIndex((t) => t.rolledBack);
  assert(firstFail >= 0, 'the fake should have refused the first batch');
  eq(w.filter((t) => t.runs.some((r) => r.kind === 'create' && r.params.rows.length === 3)).length, 1, 'transactions that sent the whole batch (a client error is not retried as transient)');
  const after = w.slice(firstFail + 1);
  const wide = after.filter((t) => t.runs.some((r) => r.kind === 'create' && r.params.rows.length !== 1));
  eq(wide.length, 0, 'retry transactions carrying other than exactly one row');
  same([...fake.st.store.keys()].sort(), [rows[0].address, rows[2].address].sort(), 'relationships in the graph afterwards');
});

test('SWR48: apply counters come from committed attempts only — a transaction the driver re-runs after a transient commit failure is counted once, and the retry is reported', async () => {
  const rows = [0, 1].map((i) => updateRow(i));
  const fake = makeFakeNeo4j({ rows: rows.map((r) => r.snapshot), people: [F.ALICE, F.BOB], failCommitOnce: true });
  const up = await onFakeGraph(fake, (g) => g.applyLocked('update', rows, { timeoutMs: 60000, preimage: noPreimage }));
  eq(writeTxs(fake).length, 2, 'fixture: the driver ran the work twice');
  eq(num(up, 'applied', 'update retried'), 2, 'applied (not 4)');
  eq(num(up, 'lostRace', 'update retried'), 0, 'lostRace');
  eq(num(up, 'transientRetries', 'update retried'), 1, 'transientRetries');
  sameSet(appliedOf(up, 'update retried'), rows.map((r) => r.address), 'appliedAddresses (each row once, not once per attempt)');
  const crows = [0, 1].map((i) => createRow(i));
  const fake2 = makeFakeNeo4j({ people: [F.ALICE], failCommitOnce: true });
  const cr = await onFakeGraph(fake2, (g) => g.applyCreates(crows, { timeoutMs: 60000 }));
  eq(num(cr, 'applied', 'create retried'), 2, 'created (not 4)');
  eq(num(cr, 'nodesCreated', 'create retried'), 1, 'people added (Bob once, not once per attempt)');
  eq(num(cr, 'transientRetries', 'create retried'), 1, 'transientRetries');
  sameSet(appliedOf(cr, 'create retried'), crows.map((r) => r.address), 'appliedAddresses (each row once, not once per attempt)');
});

test('SWR49: when the verify re-read fails, applyLocked rejects with read: \'graph-verify\' on the error, before it acts, and nothing in that batch commits', async () => {
  const neo4j = neo4jLib();
  const rows = [0, 1].map((i) => updateRow(i));
  const fake = makeFakeNeo4j({
    rows: rows.map((r) => r.snapshot), people: [F.ALICE, F.BOB],
    rereadError: () => new neo4j.Neo4jError('simulated read failure during the verify re-read', 'Neo.DatabaseError.General.UnknownError'),
  });
  const err = await rejectionOf(() => onFakeGraph(fake, (g) => g.applyLocked('update', rows, { timeoutMs: 60000, preimage: noPreimage })), 'a failing verify re-read');
  eq(err && err.read, 'graph-verify', `the rejection's read (the runner reports failure.read from it; ADR 0002 runner step 11); the error was ${show(err && { message: err.message, code: err.code, read: err.read })}`);
  eq(runsOf(fake, 'update').length, 0, 'UPDATE statements run after the failed re-read');
  eq(writeTxs(fake).filter((t) => t.committed).length, 0, 'committed write transactions');
});

// ══ W — the wrapper ══════════════════════════════════════════════════════════════════════════════════════════
test('SWR50: the wrapper is the ADR\'s — bash under set -euo pipefail, sources /etc/brainstorm.conf, makes the state directory (TAGGING_EDGES_STATE_DIR, default /var/lib/brainstorm/tagging-edges) with mode 700, opens its pass.lock on fd 9, and only after flock -n 9 execs node on the runner — else execs it with --lock-busy — with no other argument and no secret', () => {
  const t = taskEntry();
  assert(typeof t.script === 'string' && t.script.startsWith(SRC_DIR_VAR), `tasks.reconcileTaggingEdges.script must start with ${SRC_DIR_VAR}; got ${show(t.script)}`);
  const file = path.join(REPO_ROOT, 'src', t.script.slice(SRC_DIR_VAR.length));
  const src = safeRead(file);
  assert(src, `the wrapper ${path.relative(REPO_ROOT, file)} must exist and be readable`);
  const first = src.split('\n')[0];
  assert(/^#!\s*(\/bin\/bash|\/usr\/bin\/env\s+bash)\s*$/.test(first), `the wrapper must be a bash script (#!/bin/bash); its first line is ${show(first)}`);
  // Commands only: comments and blank lines dropped (the ADR's own comment says "No secret on any argv").
  const lines = src.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  const at = (re, what) => { const i = lines.findIndex((l) => re.test(l)); assert(i >= 0, `the wrapper must ${what}; its commands are:\n        ${lines.join('\n        ')}`); return i; };
  const iSet = at(/^set\s+-euo\s+pipefail\s*$/, 'run under `set -euo pipefail`');
  const iSource = at(/^(source|\.)\s+\/etc\/brainstorm\.conf\s*$/, 'source /etc/brainstorm.conf (it exports NEO4J_* and BRAINSTORM_RELAY_PUBKEY to the runner)');
  const assigns = {};
  for (const l of lines) { const m = /^([A-Za-z_]\w*)=(?:"([^"]*)"|'([^']*)'|(\S*))\s*$/.exec(l); if (m) assigns[m[1]] = m[2] !== undefined ? m[2] : (m[3] !== undefined ? m[3] : m[4]); }
  const stateVar = Object.keys(assigns).find((k) => assigns[k] === '${TAGGING_EDGES_STATE_DIR:-/var/lib/brainstorm/tagging-edges}');
  assert(stateVar, `the wrapper must set its state directory to "\${TAGGING_EDGES_STATE_DIR:-/var/lib/brainstorm/tagging-edges}"; its assignments are ${show(assigns)}`);
  const ref = `"?\\$(?:\\{${stateVar}\\}|${stateVar}\\b)"?`;
  const iMkdir = at(new RegExp(`\\bmkdir\\s+-p\\s+${ref}`), `make the state directory (mkdir -p "$${stateVar}")`);
  const iChmod = at(new RegExp(`\\bchmod\\s+0?700\\s+${ref}`), `make it private (chmod 700 "$${stateVar}")`);
  const iFd = at(new RegExp(`^exec\\s+9>>\\s*"?\\$(?:\\{${stateVar}\\}|${stateVar})/pass\\.lock"?\\s*$`), `open "$${stateVar}/pass.lock" for append on fd 9 (exec 9>>…)`);
  const iFlock = at(/\bflock\s+-n\s+9\b/, 'take the kernel lock without waiting (flock -n 9)');
  assert(/^if\s+flock\s+-n\s+9\b|\bflock\s+-n\s+9\s*(&&|\|\|)/.test(lines[iFlock]), `flock -n 9 must decide which node runs (if … then, && or ||); the line reads ${show(lines[iFlock])}`);
  const expand = (s) => { let x = s.replace(/^"|"$/g, ''); for (let n = 0; n < 5; n++) x = x.replace(/\$\{(\w+)\}|\$(\w+)/g, (m, a, b) => (assigns[a || b] !== undefined ? assigns[a || b] : m)); return x; };
  const execs = [];
  lines.forEach((l, i) => { for (const m of l.matchAll(/\bexec\s+node\s+("[^"]+"|[^\s;]+)([^;]*)/g)) execs.push({ i, target: expand(m[1]), args: m[2].trim().replace(/\s*\bfi\b\s*$/, '') }); });
  eq(execs.length, 2, `\`exec node …\` commands in the wrapper (one under the lock, one --lock-busy); found ${show(execs)}`);
  const problems = [];
  for (const e of execs) {
    if (!/(^|\/)pipeline\/tagging-edges\/reconcileTaggingEdges\.js$/.test(e.target)) problems.push(`exec node must run src/pipeline/tagging-edges/reconcileTaggingEdges.js (the process the double-run guard matches); it runs ${show(e.target)}`);
    if (e.i < iFd || e.i < iFlock) problems.push(`exec node on command ${e.i + 1} comes before the lock is opened and tried (fd 9 at ${iFd + 1}, flock at ${iFlock + 1})`);
  }
  same(execs.map((e) => e.args).sort(), ['', '--lock-busy'].sort(), 'the node arguments: none under the lock, --lock-busy otherwise (no other argument, no secret on any argv)');
  if (!(iSet < iSource)) problems.push('set -euo pipefail must come before the source, so a failed source stops the wrapper');
  if (!(iSource < iMkdir && iMkdir <= iChmod && iChmod < iFd)) problems.push(`the order must be source (${iSource + 1}) → mkdir -p (${iMkdir + 1}) → chmod 700 (${iChmod + 1}) → exec 9>> (${iFd + 1})`);
  if (!(iFd < iFlock)) problems.push(`fd 9 must be opened (${iFd + 1}) before flock -n 9 (${iFlock + 1})`);
  const secrets = lines.filter((l) => /PASSWORD|NSEC|PRIVATE_?KEY|SECRET/i.test(l));
  if (secrets.length) problems.push(`the wrapper's commands must not touch a secret: ${show(secrets)}`);
  assert(problems.length === 0, problems.join('\n        '));
});

// ══ P — the port's reads: readSchema, ensureTagsConstraint, readAll ═════════════════════════════════════════
/**
 * Runs fn() on a fake clock: setTimeout / clearTimeout are swapped for timers that fire in due order, earliest first,
 * once nothing else is left to run (setImmediate), moving Date.now to each due time. A real 5 s guard stops a hang.
 * Restores both after. → { out: { value } | { error } | 'HUNG', clock: { ms, armed: [delays] } }
 */
async function onFakeClock(fn) {
  const real = { setTimeout: global.setTimeout, clearTimeout: global.clearTimeout, now: Date.now };
  const base = real.now();
  const clock = { ms: 0, armed: [] };
  const timers = [];
  let seq = 0;
  let pumping = false;
  const schedule = () => { if (!pumping && timers.some((x) => !x.cancelled)) { pumping = true; setImmediate(pump); } };
  function pump() {
    pumping = false;
    const live = timers.filter((x) => !x.cancelled).sort((a, b) => a.due - b.due || a.seq - b.seq);
    if (!live.length) return;
    const t = live[0];
    timers.splice(timers.indexOf(t), 1);
    clock.ms = Math.max(clock.ms, t.due);
    try { t.fn(...t.args); } finally { schedule(); }
  }
  global.setTimeout = (cb, ms, ...args) => {
    const d = Math.max(0, Number(ms) || 0);
    clock.armed.push(d);
    const t = { due: clock.ms + d, fn: cb, args, cancelled: false, seq: seq++ };
    t.unref = () => t; t.ref = () => t; t.hasRef = () => false; t.refresh = () => t;
    timers.push(t);
    schedule();
    return t;
  };
  global.clearTimeout = (t) => { if (t && typeof t === 'object' && 'cancelled' in t) t.cancelled = true; else real.clearTimeout(t); };
  Date.now = () => base + clock.ms;
  let guard;
  try {
    const hung = new Promise((r) => { guard = real.setTimeout(() => r('HUNG'), 5000); });
    const out = await Promise.race([Promise.resolve().then(fn).then((value) => ({ value }), (error) => ({ error })), hung]);
    return { out, clock };
  } finally {
    real.clearTimeout(guard);
    global.setTimeout = real.setTimeout; global.clearTimeout = real.clearTimeout; Date.now = real.now;
  }
}
/** The fake's schema rows with the tags_address rule already in place, its owned index ONLINE. */
function schemaWithTags(name = CONSTRAINT_NAME) {
  return { constraints: [...clone(BASE_CONSTRAINTS), tagsConstraint(name)], indexes: [...clone(BASE_INDEXES), tagsIndex(name)] };
}
const createRuns = (fake) => fake.st.txs.flatMap((t) => t.runs.filter((r) => r.kind === 'create-constraint').map((r) => ({ ...r, tx: t })));

test('SWR51: readSchema() resolves to { constraints, indexes } — the SHOW rows, which schemaStatusFromRows judges — and writes nothing', async () => {
  const f = graphExport('schemaStatusFromRows');
  const fake = makeFakeNeo4j({ schema: schemaWithTags() });
  const s = await onFakeGraph(fake, (g) => {
    assert(typeof g.readSchema === 'function', 'the port from openGraph must have readSchema() (ADR 0002 Implementation notes → graph.js)');
    return g.readSchema();
  });
  assert(s && Array.isArray(s.constraints) && Array.isArray(s.indexes), `readSchema() must resolve to { constraints: [SHOW CONSTRAINTS rows], indexes: [SHOW INDEXES rows] }; got ${show(s)}`);
  const v = tagsVerdict(f(s.constraints, s.indexes), 'schemaStatusFromRows over readSchema()');
  same({ present: v.present, online: v.online }, { present: true, online: true }, 'tagsAddress judged from what readSchema() read');
  eq(writeTxs(fake).length, 0, 'write transactions opened by readSchema()');
  eq(fake.st.creates, 0, 'CREATE CONSTRAINT statements sent by readSchema()');
});

test('SWR52: ensureTagsConstraint({ timeoutMs }) creates tags_address once, in its own auto-commit statement, only when it is missing, waits until its owned index is ONLINE, and resolves to schemaStatusFromRows\' answer — giving up (not online) once timeoutMs has passed, and rejecting with the Neo4j error when the CREATE fails', async () => {
  const problems = [];
  const port = (g) => { assert(typeof g.ensureTagsConstraint === 'function', 'the port from openGraph must have ensureTagsConstraint() (ADR 0002 Implementation notes → graph.js)'); return g; };

  // Missing; its owned index comes ONLINE 3 s (fake time) after the CREATE.
  const fake = makeFakeNeo4j({ tagsOnlineAfterMs: 3000 });
  const { out, clock } = await onFakeClock(() => onFakeGraph(fake, (g) => port(g).ensureTagsConstraint({ timeoutMs: 60000 })));
  if (out === 'HUNG') problems.push('missing → online after 3 s: ensureTagsConstraint did not settle (it must wait on timers, which run on a fake clock here)');
  else if (out.error) problems.push(`missing → online after 3 s: rejected (${firstLine(out.error.message)})`);
  else {
    const v = out.value && out.value.tagsAddress;
    if (!v || v.present !== true || v.online !== true) problems.push(`missing → online after 3 s: should resolve { tagsAddress: { present: true, online: true, … } }; got ${show(out.value)}`);
    if (clock.ms < 3000) problems.push(`missing → online after 3 s: resolved after ${clock.ms} ms of fake time, before the index was ONLINE`);
  }
  const creates = createRuns(fake);
  if (creates.length !== 1) problems.push(`missing: CREATE_TAGS_CONSTRAINT sent ${creates.length} times; expected once`);
  else {
    if (creates[0].tx.mode !== 'AUTO') problems.push(`missing: the CREATE ran in a ${creates[0].tx.mode} transaction; ADR 0002: "auto-commit, its own transaction"`);
    if (creates[0].tx.runs.length !== 1) problems.push(`missing: the CREATE shared its transaction with ${creates[0].tx.runs.length - 1} other statement(s)`);
    if (!CONSTRAINT_RE.test(norm(creates[0].cypher))) problems.push(`missing: the CREATE was not CREATE_TAGS_CONSTRAINT: ${norm(creates[0].cypher)}`);
  }

  // Present and ONLINE already: nothing to create.
  const fake2 = makeFakeNeo4j({ schema: schemaWithTags() });
  const r2 = await onFakeClock(() => onFakeGraph(fake2, (g) => port(g).ensureTagsConstraint({ timeoutMs: 60000 })));
  if (r2.out === 'HUNG' || r2.out.error) problems.push(`present: did not resolve (${r2.out === 'HUNG' ? 'hung' : firstLine(r2.out.error.message)})`);
  else if (!r2.out.value || !r2.out.value.tagsAddress || r2.out.value.tagsAddress.online !== true) problems.push(`present: should resolve tagsAddress present and online; got ${show(r2.out.value)}`);
  if (fake2.st.creates !== 0) problems.push(`present: CREATE_TAGS_CONSTRAINT sent ${fake2.st.creates} times; expected none`);

  // Missing, and the index never comes ONLINE: gives up at about timeoutMs, without a second CREATE.
  const fake3 = makeFakeNeo4j({ tagsOnlineAfterMs: Infinity });
  const r3 = await onFakeClock(() => onFakeGraph(fake3, (g) => port(g).ensureTagsConstraint({ timeoutMs: 60000 })));
  if (r3.out === 'HUNG') problems.push('never online: ensureTagsConstraint never gave up');
  else if (r3.out.error) problems.push(`never online: rejected (${firstLine(r3.out.error.message)}); it should resolve its last answer, tagsAddress not online`);
  else {
    const v = r3.out.value && r3.out.value.tagsAddress;
    if (!v || v.online !== false) problems.push(`never online: should resolve tagsAddress.online false; got ${show(r3.out.value)}`);
    if (r3.clock.ms < 50000 || r3.clock.ms > 70000) problems.push(`never online: gave up after ${r3.clock.ms} ms of fake time; expected about the 60,000 ms asked for`);
  }
  if (fake3.st.creates !== 1) problems.push(`never online: CREATE_TAGS_CONSTRAINT sent ${fake3.st.creates} times; expected once ("create it once")`);

  // The CREATE fails: the Neo4j error, with its code, reaches the caller (the runner refuses "schema" with that code).
  const neo4j = neo4jLib();
  const code = 'Neo.ClientError.Schema.ConstraintCreationFailed';
  const fake4 = makeFakeNeo4j({ createError: () => new neo4j.Neo4jError("fake: Unable to create Constraint( name='tags_address' )", code) });
  const r4 = await onFakeClock(() => onFakeGraph(fake4, (g) => port(g).ensureTagsConstraint({ timeoutMs: 60000 })));
  if (r4.out === 'HUNG' || !r4.out.error) problems.push(`a failing CREATE: should reject; got ${r4.out === 'HUNG' ? 'no answer' : show(r4.out.value)}`);
  else if (isHarnessError(r4.out.error)) throw r4.out.error;
  else if (r4.out.error.code !== code) problems.push(`a failing CREATE: the rejection's code should be ${code}; got ${show(r4.out.error.code)}`);
  assert(problems.length === 0, problems.join('\n        '));
});

test('SWR53: readAll({ timeoutMs }) runs READ_ALL with $scalarTypes in one read transaction with that time-out and resolves to a plain array of rows with the eight columns — a stored list holding 2^53+1 comes back exact (integers lossless)', async () => {
  const neo4j = neo4jLib();
  const big = F.storedRow(edgeFor(1));
  big.props.push(['bigList', 'LIST<INTEGER NOT NULL> NOT NULL', null, [neo4j.int('9007199254740993')]]);
  const fake = makeFakeNeo4j({ rows: [F.storedRow(edgeFor(0)), big, F.storedRow(edgeFor(2))], people: [F.ALICE, F.BOB] });
  const rows = await onFakeGraph(fake, (g) => {
    assert(typeof g.readAll === 'function', 'the port from openGraph must have readAll() (ADR 0002 Implementation notes → graph.js)');
    return g.readAll({ timeoutMs: 120000 });
  });
  assert(Array.isArray(rows), `readAll must resolve to a plain array of READ_ALL rows; got ${show(rows)}`);
  eq(rows.length, 3, 'rows read');
  for (const r of rows) {
    const gap = ROW_KEYS.filter((k) => !r || !(k in r));
    assert(gap.length === 0, `each row carries READ_ALL's eight columns; a row lacks ${gap.join(', ')}: ${show(r)}`);
  }
  const reads = fake.st.txs.filter((t) => t.runs.some((x) => x.kind === 'read-all'));
  eq(reads.length, 1, 'transactions that ran READ_ALL');
  eq(reads[0].mode, 'READ', 'the transaction READ_ALL ran in (executeRead)');
  eq(reads[0].config && reads[0].config.timeout, 120000, 'the read transaction\'s time-out (readAll({ timeoutMs }))');
  sameSet(reads[0].runs.find((x) => x.kind === 'read-all').params.scalarTypes || [], F.SCALAR_TYPES, 'READ_ALL\'s $scalarTypes');
  eq(writeTxs(fake).length, 0, 'write transactions opened by readAll()');
  const back = rows.find((r) => (r.props || []).some((p) => p[0] === 'bigList'));
  const entry = back && back.props.find((p) => p[0] === 'bigList');
  assert(entry && Array.isArray(entry[3]), `the list-valued key should come back as [key, type, null, raw list]; got ${show(entry)}`);
  eq(String(entry[3][0]), '9007199254740993', 'the list\'s element, 2^53+1, as read (a JS number would round it to …992)');
});

// ══ review round 2 (2026-09-28): the boot hook's "not created" codes (Blocking 2) ═════════════════════════════
test('SWR55: ensureTagsConstraint answers at once — no CREATE, no wait — when a rule with another definition holds the name tags_address, resolving tagsAddress not present, so the runner refuses "schema" (story Deviations; AC-6; review 2026-09-28, Blocking 2)', async () => {
  const schema = {
    constraints: [...clone(BASE_CONSTRAINTS), tagsConstraint(CONSTRAINT_NAME, { properties: ['eventId'] })],
    indexes: [...clone(BASE_INDEXES), tagsIndex(CONSTRAINT_NAME, 'ONLINE', { properties: ['eventId'] })],
  };
  const fake = makeFakeNeo4j({ schema });
  const { out, clock } = await onFakeClock(() => onFakeGraph(fake, (g) => g.ensureTagsConstraint({ timeoutMs: 60000 })));
  if (out === 'HUNG') throw new Error('ensureTagsConstraint should resolve; it did not settle');
  if (out.error) throw new Error(`ensureTagsConstraint should resolve; it rejected: ${firstLine(out.error.message)}`);
  eq(out.value && out.value.tagsAddress && out.value.tagsAddress.present, false, 'tagsAddress.present with the name taken by another definition');
  eq(fake.st.creates, 0, 'CREATE_TAGS_CONSTRAINT sent (IF NOT EXISTS would do nothing)');
  assert(clock.ms < 1000, `it should answer at once, not wait for an index that will never come; waited ${clock.ms} ms of fake time`);
});

test('SWR56: the boot hook logs the documented "not created: <code>" line when it cannot put the rule in place without an error — "name-taken" when a rule with another definition holds the name (OPERATIONS.md §12.8), "no-change" when its CREATE changed nothing (story Deviations) — sends no second CREATE and drops nothing (review 2026-09-28, Blocking 2)', async () => {
  const taken = [...clone(BASE_CONSTRAINTS), tagsConstraint(CONSTRAINT_NAME, { properties: ['eventId'] })];
  const takenIdx = [...clone(BASE_INDEXES), tagsIndex(CONSTRAINT_NAME, 'ONLINE', { properties: ['eventId'] })];
  const problems = [];
  for (const [code, constraints, indexes] of [['name-taken', taken, takenIdx], ['no-change', clone(BASE_CONSTRAINTS), clone(BASE_INDEXES)]]) {
    const writes = [];
    const st = await runBootHook({
      runRead: async (cypher) => (/CONSTRAINT/i.test(norm(cypher)) ? clone(constraints) : clone(indexes)),
      runWrite: async (cypher) => { writes.push(norm(cypher)); return []; }, // a CREATE that changes nothing
    });
    if (st.outcome.rejected) { problems.push(`${code}: rejected`); continue; }
    const creates = writes.filter((w) => /^CREATE CONSTRAINT/i.test(w));
    if (code === 'name-taken' && creates.length !== 0) problems.push(`${code}: sent ${creates.length} CREATE(s); IF NOT EXISTS would do nothing`);
    if (code === 'no-change' && creates.length !== 1) problems.push(`${code}: sent ${creates.length} CREATE(s); expected exactly one`);
    if (writes.some((w) => /\bDROP\b/i.test(w))) problems.push(`${code}: sent DROP`);
    const lines = st.lines.filter((l) => l.includes('not created'));
    if (lines.length !== 1) problems.push(`${code}: expected exactly one "not created" line; got ${show(st.lines)}`);
    else if (!lines[0].startsWith(`${LOG_PREFIX}${code}`)) problems.push(`${code}: the line must read "${LOG_PREFIX}${code}" (the documented <code>); got ${show(lines[0])}`);
  }
  assert(problems.length === 0, problems.join('\n        '));
});

// ══ review round 2 (2026-09-28): pre-images through the real port (principle 4; item 8) ══════════════════════
test('SWR57: applyLocked hands preimage(batch) each C6 row as the caller sent it — its snapshot, extra key and value included, and any other key the caller put on the row — before that batch\'s transaction opens (ADR "The guard" step 1; story Deviations: "the caller\'s other keys are kept and reach preimage"; review 2026-09-28, item 8)', async () => {
  const desired = edgeFor(0);
  const snapshot = F.storedRow(edgeFor(0), { set: { polarity: '0' }, extra: { note: 'kept-by-preimage-91c2' } });
  const row = { address: desired.address, snapshot, desired, story3Hint: 'caller-key-kept' };
  const fake = makeFakeNeo4j({ rows: [snapshot], people: [F.ALICE, F.BOB] });
  const seen = [];
  const preimage = async (batch) => { seen.push(batch); fake.st.events.push({ e: 'preimage' }); };
  await onFakeGraph(fake, (g) => g.applyLocked('update', [row], { timeoutMs: 60000, preimage }));
  eq(seen.length, 1, 'preimage calls');
  const got = seen[0][0] || {};
  eq(got.story3Hint, 'caller-key-kept', 'a caller\'s own key on the row reaches preimage');
  const snap = got.snapshot || got.row;
  assert(snap && Array.isArray(snap.props), `preimage must see the row's snapshot (READ_ALL row); got ${show(Object.keys(got))}`);
  assert(snap.props.some((p) => p[0] === 'note' && p[2] === 'kept-by-preimage-91c2'), `the snapshot preimage sees must still carry the extra key and its value; props: ${show(snap.props)}`);
  const firstOpen = fake.st.events.findIndex((e) => e.e === 'tx-open');
  const pre = fake.st.events.findIndex((e) => e.e === 'preimage');
  assert(pre >= 0 && pre < firstOpen, `preimage must resolve before the transaction opens; events: ${show(fake.st.events.slice(0, 6))}`);
  eq(propsOf(fake, desired.address).note, undefined, 'the extra key is dropped by the update (after its pre-image)');
});

test('SWR58: a real pass driven through the real graph port (openGraph over the fake driver) appends the pre-image of every edge carrying a key outside the nine — an update and a removal — with the key\'s type and value, before the transaction that drops it (ADR "The guard" step 1, owner decision 9; BIBLE §30; review 2026-09-28, item 8)', async () => {
  let runner;
  try { runner = require(RUNNER_PATH); } catch (e) { throw new Error(`reconcileTaggingEdges.js not implemented yet (require failed: ${firstLine(e.message)})`); }
  const graph = loadGraph();
  const X = F.makeTagging({ d: 'swr58-x', id: F.idOf('swr58:x') });
  const Y = F.makeTagging({ d: 'swr58-y', id: F.idOf('swr58:y') });
  const addr = (ev) => `39999:${ev.pubkey}:${ev.tags.find((t) => t[0] === 'd')[1]}`;
  const rowX = F.storedRowFor(X, { extra: { note: 'private-note-3b7e' } });
  const rowY = F.storedRowFor(Y, { extra: { legacyScore: 7 } });
  const fake = makeFakeNeo4j({ rows: [rowX, rowY], people: [F.ALICE, F.BOB], schema: schemaWithTags() });
  const records = [];
  const reports = [];
  const deps = {
    now: (() => { let t = Date.UTC(2026, 8, 28, 1, 2, 3); return () => t++; })(),
    randomId: () => '0a0b0c0d',
    lock: { busy: false, held: () => true },
    state: {
      readReport: () => null,
      writeReport: (doc) => { reports.push(JSON.parse(show(doc))); },
      appendPreimages: (runId, recs) => {
        fake.st.events.push({ e: 'preimage-append', addresses: recs.map((r) => r.address) });
        records.push(...JSON.parse(show(recs)));
        return `preimages/${runId}.jsonl`;
      },
      claimConfirmation: () => null,
      prune: () => {},
      processStartTime: () => '1',
      heldDigest: () => 'f'.repeat(64),
      writeHeld: () => {},
      readHeld: () => null,
    },
    identities: { canonicalZ: () => F.STAMP(F.CANONICAL), getOwnerAssistantPubkey: () => F.LOCAL },
    env: { NEO4J_URI: CREDS.uri, NEO4J_USER: CREDS.user, NEO4J_PASSWORD: CREDS.password, BRAINSTORM_RELAY_PUBKEY: F.LOCAL },
    openGraph: (cfg) => graph.openGraph(cfg),
    scan: async () => ({ events: [X], lines: 1, bytes: 1, elapsedMs: 1 }),
    emit: () => {},
    proc: { pid: 1, exitCode: undefined, startTime: '1' },
    signals: null,
  };
  const out = await withFakeDriver(fake, () => runner.run(deps));
  eq(out && out.outcome, 'done', `the pass's outcome (failure: ${show(out && out.failure)})`);
  sameSet(records.map((r) => r.address), [addr(X), addr(Y)], 'pre-image records (the update and the removal, each carrying a key outside the nine)');
  const recX = records.find((r) => r.address === addr(X));
  assert(recX.props.some((p) => show(p) === show(['note', 'STRING NOT NULL', 'private-note-3b7e'])), `X's pre-image keeps [key, type, value]; props: ${show(recX.props)}`);
  const recY = records.find((r) => r.address === addr(Y));
  assert(recY.props.some((p) => show(p) === show(['legacyScore', 'INTEGER NOT NULL', '7'])), `Y's pre-image keeps [key, type, value]; props: ${show(recY.props)}`);
  for (const [a, kind] of [[addr(X), 'update'], [addr(Y), 'remove']]) {
    const iAppend = fake.st.events.findIndex((e) => e.e === 'preimage-append' && e.addresses.includes(a));
    const tx = writeTxs(fake).find((t) => t.runs.some((r) => r.kind === kind));
    const iOpen = fake.st.events.findIndex((e) => e.e === 'tx-open' && e.tx === (tx && tx.id));
    assert(iAppend >= 0 && iOpen > iAppend, `${kind} ${a}: the pre-image must be appended before its transaction opens (append ${iAppend}, open ${iOpen})`);
  }
  eq(propsOf(fake, addr(X)).note, undefined, 'X lost the extra key');
  eq(fake.st.store.has(addr(Y)), false, 'Y removed');
  const last = reports[reports.length - 1].latest;
  eq(last.relationships.preimagesWritten, 2, 'relationships.preimagesWritten');
});

// ══ review round 2 (2026-09-28): partial commits and the port's row checks (items 13, 14) ════════════════════
test('SWR59: when applyCreates, re-running a refused batch one row per transaction, then meets an error that is not a uniqueness refusal, it rejects with err.partial — the rows that committed (applied, appliedAddresses), the refused row as a lost race, and the people added — so the runner can count them (ADR step 11 "with the partial counts"; story Deviations; review 2026-09-28, item 13)', async () => {
  const rows = [0, 1, 2].map((i) => createRow(i));
  const fake = makeFakeNeo4j({ people: [F.ALICE], conflicts: [rows[0].address] });
  const session = fake.driver.session;
  fake.driver.session = (...a) => {
    const s = session(...a);
    const executeWrite = s.executeWrite;
    s.executeWrite = (work, cfg) => executeWrite((tx) => work({
      run: (cypher, params) => {
        if (params && Array.isArray(params.rows) && params.rows.length === 1 && params.rows[0].address === rows[2].address) {
          return Promise.reject(Object.assign(new Error('fake: the third row failed for another reason'), { code: 'Neo.DatabaseError.General.UnknownError' }));
        }
        return tx.run(cypher, params);
      },
    }), cfg);
    return s;
  };
  const err = await rejectionOf(() => onFakeGraph(fake, (g) => g.applyCreates(rows, { timeoutMs: 60000 })), 'a create fallback that fails on its third row');
  eq(err.code, 'Neo.DatabaseError.General.UnknownError', 'the rejection is the non-uniqueness error');
  assert(err.partial && typeof err.partial === 'object', `the rejection must carry err.partial (what committed before it); got ${show(err && Object.keys(err))}`);
  eq(err.partial.applied, 1, 'err.partial.applied (row 1 committed in its own transaction)');
  same(err.partial.appliedAddresses, [rows[1].address], 'err.partial.appliedAddresses');
  eq(err.partial.lostRace, 1, 'err.partial.lostRace (row 0, refused by the uniqueness rule)');
  eq(err.partial.nodesCreated, 1, 'err.partial.nodesCreated (Bob, added with row 1)');
  eq(fake.st.store.has(rows[1].address), true, 'row 1 is in the graph');
});

test('SWR60: the port refuses, before any transaction and before preimage, a row with no address, without the snapshot or desired its kind needs, or whose desired is for another address — eight cases over update, move, remove and create (story Deviations: toPortRow, C6; review 2026-09-28, item 14)', async () => {
  const problems = [];
  const u0 = updateRow(0);
  const other = edgeFor(1);
  const without = (o, k) => { const c = { ...o }; delete c[k]; return c; };
  const cases = [
    ['update without address', 'update', without(u0, 'address')],
    ['update without snapshot', 'update', without(u0, 'snapshot')],
    ['update without desired', 'update', without(u0, 'desired')],
    ['update with desired for another address', 'update', { ...u0, desired: other }],
    ['move with desired for another address', 'move', { address: u0.address, snapshot: F.storedRow(edgeFor(0), { set: { polarity: '0' } }), desired: edgeFor(1, { target: F.CAROL }) }],
    ['remove without snapshot', 'remove', without(removeRow(0), 'snapshot')],
    ['create without desired', 'create', { address: edgeFor(7).address }],
    ['create with desired for another address', 'create', { address: edgeFor(7).address, desired: edgeFor(8) }],
  ];
  for (const [label, kind, row] of cases) {
    const fake = makeFakeNeo4j({ rows: [u0.snapshot], people: [F.ALICE, F.BOB] });
    let calls = 0;
    const preimage = async () => { calls += 1; };
    let refused = false;
    try {
      await onFakeGraph(fake, (g) => (kind === 'create' ? g.applyCreates([row], { timeoutMs: 60000 }) : g.applyLocked(kind, [row], { timeoutMs: 60000, preimage })));
    } catch (e) {
      if (isHarnessError(e)) throw e;
      refused = true;
    }
    if (!refused) problems.push(`${label}: not refused`);
    if (fake.st.txs.length) problems.push(`${label}: ${fake.st.txs.length} transaction(s) opened`);
    if (calls) problems.push(`${label}: preimage called ${calls} time(s)`);
    const p = propsOf(fake, u0.address);
    if (!p || p.polarity !== '0') problems.push(`${label}: stored polarity now ${show(p && p.polarity)}`);
    if (fake.st.store.size !== 1) problems.push(`${label}: store size ${fake.st.store.size}`);
  }
  assert(problems.length === 0, problems.join('\n        '));
});

async function run() {
  console.log('\n--- tagging-edges wiring and graph port tests (epic tagging-edges, Story 2) ---');
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  PASS  ${name}`); pass++; }
    catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failures.push({ name, message: err.message }); fail++; }
  }
  console.log(`\ntagging-edges-wiring: ${pass} passed, ${fail} failed`);
  return { pass, fail, skipped: 0, failures };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
