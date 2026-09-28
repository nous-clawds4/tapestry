'use strict';
/**
 * Tests for Story 2 (epic: tagging-edges) — the gap-filling pass's runner, driven through fake ports.
 *
 * Story: engineering-team/stories/tagging-edges/2-gap-filling-pass-and-backfill.md (AC-1 … AC-7)
 * ADR:   engineering-team/decisions/tagging-edges/0002-gap-filling-pass.md — "Implementation notes →
 *        reconcileTaggingEdges.js" steps 1–12, the Decision diagram, D9, D11, "The owner's confirmation", "The report",
 *        and "Seams for Test Design → Runner with fake ports" and "→ Identities". Binding context: ADR
 *        tagging-edges/0001 (amended) and src/lib/tagging-edges/contract.js.
 * Plan:  engineering-team/stories/tagging-edges/2-gap-filling-pass-and-backfill.test-plan.md
 *
 * Intentionally failing until src/pipeline/tagging-edges/reconcileTaggingEdges.js lands, together with the pure
 * planner it calls (src/lib/tagging-edges/sweep.js) — red phase. The runner is require()d LAZILY inside each test
 * through load(), so this suite always loads.
 *
 * Levels:
 *   ports   — run(deps) with every port faked. Each fake records its calls, in order, in one log, so a test can say
 *             "the graph read resolved before the scan was called" or "zero write calls". The planner is the real
 *             sweep.js (the ADR injects no planner); SR33 swaps its planPass for a throwing stub through
 *             require.cache and puts it back.
 *   child   — the real entry file in a child Node process with a throwaway TAGGING_EDGES_STATE_DIR and structured
 *             logging off. Only the paths that must not reach the graph are run (--lock-busy, and a hand run outside
 *             the wrapper's lock), with no NEO4J_* variables and no identity in the environment.
 *   static  — a read of the runner's source.
 * Stack-free: no Neo4j, no strfry, no network, no signing. No test writes to the graph or the relay (principle 4).
 * Every pubkey is a fake 64-hex value from test/helpers/taggingEdgesFixtures.js: never a deployment's TA and never
 * the ADR 0015 literal. The canonical identity is a fake too — the runner reads it through an injected getter.
 *
 * The ports. ADR 0002 names deps = { now, randomId, lock, state, identities, env, openGraph, scan, emit, proc,
 * signals } and the graph port's and scanStrict's surfaces; it does not name every member. This suite fixes them,
 * and defaultDeps() is built to match:
 *   now()               → milliseconds since the epoch (a number; Date.now).
 *   randomId()          → 8 lower-case hex characters (crypto.randomBytes(4).toString('hex')).
 *   lock.held()         → true when /proc/self/fdinfo/9 shows this process's FLOCK WRITE lock (state.lockHeld(9)).
 *                         `--lock-busy` arrives in proc.argv. (The fake also answers as lock(), lock.busy and
 *                         state.lockHeld(), all consistent, so any of those readings works.)
 *   state               → state.js's surface: readReport() → the whole report.json document { reportVersion, latest,
 *                         previous } or null; writeReport(doc) takes the whole document; writeHeld(runId, list);
 *                         readHeld(runId) → the list [{ address, seenEventId, reason }]; heldDigest(list) → sha256 hex
 *                         over heldLines(list); appendPreimages(runId, records); claimConfirmation(runId) → the
 *                         claimed record or null (the fake's answer reads as the record itself and as `.record`,
 *                         the two forms test/tagging-edges-state-routes.test.js accepts); processStartTime(pid)
 *                         (proc.startTime carries the same value). The fakes answer synchronously; awaiting them works.
 *   identities          → { canonicalZ() → NOSTR_USER_TAG_Z_TAG, getOwnerAssistantPubkey() → the helper's result }
 *                         (the helper's own name; the env and conf sources the runner reads itself, from env).
 *   env                 → the environment (process.env in production).
 *   openGraph(cfg)      → graph.js's port { readSchema, ensureTagsConstraint, readAll, applyLocked, applyCreates,
 *                         close }. readSchema() resolves to the SHOW rows { constraints, indexes }; the fake also
 *                         spreads in schemaStatusFromRows(constraints, indexes) when graph.js loads, so the runner may
 *                         read either. ensureTagsConstraint({ timeoutMs }) creates the rule and waits, then resolves to
 *                         the same view of the schema as it now stands (schemaStatusFromRows' answer, plus the rows).
 *                         readAll({ timeoutMs }) resolves to a plain array of READ_ALL rows; the runner itself checks
 *                         each row for the eight columns (ADR step 8), whatever port supplied them.
 *                         applyCreates(rows, { timeoutMs }) and applyLocked(kind, rows, { timeoutMs, preimage }), kind
 *                         'update' | 'move' | 'remove': applyLocked awaits preimage(rows) before its transaction and
 *                         refuses to run without one; each apply resolves { applied, lostRace, nodesCreated,
 *                         transientRetries, appliedAddresses } for what committed — appliedAddresses naming the rows
 *                         that did, which is how the report attributes changedBy, removedBy, strippedKeys, unresolved
 *                         and confirmed.removalsApplied. (The fake does not read a row's shape beyond its address; the
 *                         shape is test/tagging-edges-wiring.test.js's.) A failed verify re-read reaches the runner as
 *                         an applyLocked rejection whose `read` is 'graph-verify'.
 *   scan(filter, opts)  → scanStrict's contract: { events, lines, bytes, elapsedMs }, or a rejection with a ScanError
 *                         { code, message, stderrTail }; opts carries { timeoutMs, isExpected }.
 *   emit(eventType, metadata) — the fake takes the last object argument as the metadata. A PROGRESS event names its
 *                         phase as metadata.phase (the report's phases[].phase names) with its ms.
 *   proc                → process-like { pid, argv, exitCode }. The runner leaves the exit code on proc.exitCode
 *                         (0 done or held, 2 refused, 1 failed; 0 for --lock-busy; the entry passes `process`) and
 *                         never calls process.exit.
 *   signals             → process-like: signals.on('SIGTERM' | 'SIGINT', handler).
 * A confirmation record's mintedAt / expiresAt are ISO-8601 strings.
 *
 * Hand-rolled in the project's existing test style — no new framework. Works on Node 16 and 22.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const F = require('./helpers/taggingEdgesFixtures');

const REPO = path.resolve(__dirname, '..');
const RUNNER_REL = 'src/pipeline/tagging-edges/reconcileTaggingEdges.js';
const RUNNER = path.join(REPO, RUNNER_REL);
const PIPELINE_DIR = path.join(REPO, 'src/pipeline/tagging-edges') + path.sep;
const SWEEP = path.join(REPO, 'src/lib/tagging-edges/sweep.js');
const LIB_INDEX = path.join(REPO, 'src/lib/tagging-edges/index.js');
const GRAPH = path.join(REPO, 'src/pipeline/tagging-edges/graph.js');
const SCAN_STRICT = path.join(REPO, 'src/lib/strfryScanStrict.js');

const { CANONICAL, LOCAL, OTHER_DEPLOY, ALICE, BOB, CAROL, STAMP, TAG_STAMP } = F;
/** The pubkey in the fake SecureKeyStorage file (a fake; different from both identities). */
const KEYFILE_PK = '7'.repeat(64);
/** A 64-hex value with upper-case letters (LOCAL and KEYFILE_PK are all digits, so upper-casing them changes nothing). */
const UPPER_HEX = 'ABCDEF01'.repeat(8);

/** ADR 0002 "The owner's confirmation": the one run-id grammar. */
const RUN_ID_RE = /^\d{8}T\d{6}Z-[0-9a-f]{8}$/;
const T0 = Date.UTC(2026, 8, 27, 12, 34, 56); // 2026-09-27T12:34:56Z
const RANDOM_ID = '0a1b2c3d';
const EXPECTED_RUN_ID = '20260927T123456Z-0a1b2c3d';
const PID = 4242;
const START_TIME = '987654';
/** Where the fake state errors claim to live: the production path, so a leaked absolute path is recognisable. */
const FAKE_STATE_DIR = '/var/lib/brainstorm/tagging-edges';
const PASSWORD = 'fake-neo4j-password-4d9e';
const PESSIMISTIC_REASON = 'stopped before it finished (time-out, deploy or restart)';
const HOUR = 3600 * 1000;
const RUN_BUDGET_MS = 5000;
const DEFAULT_ENV = Object.freeze({
  NEO4J_URI: 'bolt://neo4j.fake.invalid:7687',
  NEO4J_USER: 'neo4j',
  NEO4J_PASSWORD: PASSWORD,
  BRAINSTORM_RELAY_PUBKEY: LOCAL,
});

// Earlier runs (RUN_ID_RE grammar).
const RUN_HELD = '20260926T100000Z-aaaa0001';
const RUN_LATER = '20260926T200000Z-bbbb0002';
const RUN_REFUSED = '20260927T090000Z-cccc0003';
const RUN_PRIOR = '20260926T080000Z-dddd0004';
const RUN_STALE = '20260927T110000Z-eeee0005';

// ─── test harness ──────────────────────────────────────────────────────────────────────────────────────────────
const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
const show = (v) => {
  try { return JSON.stringify(v, (k, x) => (typeof x === 'bigint' ? `${x}n` : x)); } catch (_) { return String(v); }
};
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') return Object.keys(v).sort().reduce((o, k) => { o[k] = sortKeys(v[k]); return o; }, {});
  return v;
}
function eq(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}\n        expected: ${show(expected)}\n        actual:   ${show(actual)}`);
}
function same(actual, expected, label) {
  const a = show(sortKeys(actual));
  const e = show(sortKeys(expected));
  if (a !== e) throw new Error(`${label}\n        expected: ${e}\n        actual:   ${a}`);
}
const preview = (xs) => (xs.length > 6 ? `${show(xs.slice(0, 6))} … (+${xs.length - 6} more)` : show(xs));
function sameSet(actual, expected, label) {
  const a = [...(actual || [])].sort();
  const e = [...expected].sort();
  if (show(a) !== show(e)) {
    throw new Error(`${label}\n        expected (${e.length}): ${preview(e)}\n        actual   (${a.length}): ${preview(a)}`);
  }
}
const firstLine = (e) => String((e && e.message) || e).split('\n')[0];
const clone = (v) => (v === undefined ? undefined : JSON.parse(show(v)));
const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const tick = () => new Promise((r) => setImmediate(r));
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const iso = (ms) => new Date(ms).toISOString();

/** Run several cases; report every failing one, not only the first. */
async function cases(list, fn) {
  const failed = [];
  for (const c of list) {
    try { await fn(c); } catch (e) { failed.push(`[${c.name}] ${e.message}`); }
  }
  assert(failed.length === 0, `${failed.length} of ${list.length} case(s) failed:\n        ${failed.join('\n        ')}`);
}

/** Lazily load the runner with a descriptive red-phase message. */
function load() {
  try { return require(RUNNER); }
  catch (e) { throw new Error(`${RUNNER_REL} not implemented yet (require failed: ${firstLine(e)})`); }
}

// ─── fixtures ──────────────────────────────────────────────────────────────────────────────────────────────────
const firstD = (ev) => ev.tags.find((t) => Array.isArray(t) && t[0] === 'd')[1];
/** A fixture tagging's address (every fixture here has a short, plain first d). */
const addressOf = (ev) => `39999:${ev.pubkey}:${firstD(ev)}`;
const rowsFor = (evs, rowOpts) => evs.map((ev) => F.storedRowFor(ev, rowOpts));

// One tagging per stamp combination, each at its own address (story 2, "For Test Design": each stamp alone and both).
const T_CANON = F.makeTagging({ d: 'runner-canonical', id: F.idOf('runner:canonical') });
const T_LOCAL = F.makeTagging({ d: 'runner-local', id: F.idOf('runner:local'), stamps: [STAMP(LOCAL)], target: CAROL });
const T_BOTH = F.makeTagging({ d: 'runner-both', id: F.idOf('runner:both'), stamps: [STAMP(CANONICAL), STAMP(LOCAL)], polarity: '-1' });
/** A non-tagging (no target) at its own tagging address, carrying the canonical stamp: read, refused, counted. */
const T_REFUSED = F.makeNonTagging({ address: `39999:${ALICE}:runner-refused`, refusal: 'no-target', id: F.idOf('runner:refused') });
const ELEMENT = F.makeElement();

// One of each action (the order test and friends).
const T_NEW = F.makeTagging({ d: 'order-new', id: F.idOf('order:new') });
const T_UPD_V1 = F.makeTagging({ d: 'order-upd', id: F.idOf('order:upd:v1'), createdAt: 900 });
const T_UPD_V2 = F.makeTagging({ d: 'order-upd', id: F.idOf('order:upd:v2'), createdAt: 1100, polarity: '-1' });
const T_MOV_V1 = F.makeTagging({ d: 'order-mov', id: F.idOf('order:mov:v1'), createdAt: 900, target: BOB });
const T_MOV_V2 = F.makeTagging({ d: 'order-mov', id: F.idOf('order:mov:v2'), createdAt: 1100, target: CAROL });
const T_GONE = F.makeTagging({ d: 'order-gone', id: F.idOf('order:gone') });

/** The ordinary world: the graph holds T_CANON's relationship; the relay holds T_CANON and T_LOCAL (one create). */
const baseline = (extra = {}) => Object.assign({ rows: rowsFor([T_CANON]), events: [T_CANON, T_LOCAL] }, extra);

// Held lists, digests, earlier reports and confirmation records.
const heldListFor = (evs, reason = 'not-on-relay') => evs.map((ev) => ({ address: addressOf(ev), seenEventId: ev.id, reason }));
const heldLinesOf = (list) => list.map((h) => `${h.address}\t${h.seenEventId}\t${h.reason}\n`).sort().join('');
/** sha256 hex over heldLines (ADR 0002: `address\tseenEventId\treason\n`, sorted); accepts the list or the text. */
const digestOf = (x) => crypto.createHash('sha256').update(typeof x === 'string' ? x : heldLinesOf(x), 'utf8').digest('hex');
const byReason = (list) => list.reduce((o, h) => { o[h.reason] = (o[h.reason] || 0) + 1; return o; }, {});

function priorReport(runId, extra = {}) {
  return Object.assign({
    runId, startedAt: '2026-09-26T10:00:00.000Z', endedAt: '2026-09-26T10:00:05.000Z', durationMs: 5000,
    outcome: 'done', reasonCode: 'done', reason: 'finished', stopped: false, running: false,
    confirmed: null, confirmation: { found: false },
    phases: [{ phase: 'identities', ms: 1 }, { phase: 'schema', ms: 1 }, { phase: 'graph-read', ms: 5 }, { phase: 'relay-read', ms: 5 }, { phase: 'plan', ms: 1 }],
    process: { pid: 111, startTime: '222' },
  }, extra);
}
const heldReport = (runId, list) => priorReport(runId, {
  outcome: 'done-removals-held', reasonCode: 'removals-held',
  held: { total: list.length, byReason: byReason(list), digest: digestOf(list) },
});
const refusedReport = (runId) => priorReport(runId, { outcome: 'refused', reasonCode: 'identity', phases: [{ phase: 'identities', ms: 1 }] });
const reportDoc = (latest, previous = []) => ({ reportVersion: 1, latest, previous });
function confirmationFor(runId, list, o = {}) {
  const mintedAt = o.mintedAt === undefined ? T0 - HOUR : o.mintedAt;
  return {
    version: 1, runId, heldDigest: o.heldDigest || digestOf(list), heldCount: list.length, nonce: '5eed'.repeat(8), // 32 lower-case hex, as the confirm route mints it
    mintedAt: iso(mintedAt), expiresAt: iso(mintedAt + 24 * HOUR), mintedBy: 'b0b0b0b0',
  };
}

/** The held scenario: the graph holds `n` relationships whose taggings the relay no longer holds (> the limit). */
function heldScenario({ n = 60, prefix = 'held', latest, previous, fileList, confirmation } = {}) {
  const evs = F.manyTaggings(n, { prefix });
  const list = heldListFor(evs);
  const rh = heldReport(RUN_HELD, list);
  const report = latest ? reportDoc(latest, previous || [rh]) : reportDoc(rh, previous || []);
  return {
    evs, list, rows: rowsFor(evs),
    files: newFiles({
      report,
      held: { [RUN_HELD]: fileList || list },
      confirmation: confirmation === undefined ? confirmationFor(RUN_HELD, list) : confirmation,
    }),
  };
}

// ─── errors the fakes throw ────────────────────────────────────────────────────────────────────────────────────
function fsError(code, syscall, file) {
  const text = { ENOSPC: 'no space left on device', EACCES: 'permission denied', ENOENT: 'no such file or directory' }[code] || 'failed';
  const e = new Error(`${code}: ${text}, ${syscall} '${file}'`);
  e.code = code; e.syscall = syscall; e.path = file;
  return e;
}
function neoError(code, message) { const e = new Error(message); e.code = code; return e; }
/** A ScanError as scanStrict rejects with — an instance of the exported class when strfryScanStrict.js loads. */
function makeScanError(code) {
  let Cls = null;
  try { const m = require(SCAN_STRICT); if (typeof m.ScanError === 'function') Cls = m.ScanError; } catch (_) { /* reader not built yet */ }
  const e = Cls ? Object.create(Cls.prototype) : new Error();
  e.name = 'ScanError';
  e.code = code;
  e.message = `strfry scan failed (${code})`;
  e.stderrTail = 'strfry error: fake failure for the test';
  e.stack = `ScanError: ${e.message}`;
  return e;
}

// ─── the fake world ────────────────────────────────────────────────────────────────────────────────────────────
function newFiles({ report = null, held = {}, confirmation = null } = {}) {
  return { doc: clone(report), held: clone(held), pending: clone(confirmation), claimed: [], preimages: {} };
}

/** SHOW CONSTRAINTS / SHOW INDEXES rows (Neo4j 5 columns) for a schema state. */
function schemaRows(s) {
  const constraints = [];
  const indexes = [];
  let id = 1;
  const unique = (name, entityType, label, prop, type, state) => {
    constraints.push({ id: id++, name, type, entityType, labelsOrTypes: [label], properties: [prop], ownedIndex: name, propertyType: null });
    indexes.push({ id: id++, name, state, populationPercent: state === 'ONLINE' ? 100 : 40, type: 'RANGE', entityType, labelsOrTypes: [label], properties: [prop], indexProvider: 'range-1.0', owningConstraint: name, lastRead: null, readCount: 0 });
  };
  unique('nostrEvent_id', 'NODE', 'NostrEvent', 'id', 'UNIQUENESS', 'ONLINE');
  if (s.nostrUser) unique('nostrUser_pubkey', 'NODE', 'NostrUser', 'pubkey', 'UNIQUENESS', 'ONLINE');
  if (s.tags !== 'missing') {
    unique(s.tagsName, 'RELATIONSHIP', 'TAGS', 'address', 'RELATIONSHIP_UNIQUENESS', s.tags === 'online' ? 'ONLINE' : 'POPULATING');
  }
  indexes.push({ id: id++, name: 'nostrUser_hops', state: 'ONLINE', populationPercent: 100, type: 'RANGE', entityType: 'NODE', labelsOrTypes: ['NostrUser'], properties: ['hops'], indexProvider: 'range-1.0', owningConstraint: null, lastRead: null, readCount: 0 });
  return { constraints, indexes };
}
function schemaView(s) {
  const { constraints, indexes } = schemaRows(s);
  let status = {};
  try {
    const g = require(GRAPH);
    if (typeof g.schemaStatusFromRows === 'function') {
      const st = g.schemaStatusFromRows(clone(constraints), clone(indexes));
      if (isPlainObject(st)) status = st;
    }
  } catch (_) { /* graph.js not built yet: the raw rows only */ }
  return Object.assign({}, status, { constraints, indexes });
}

function fakeSignals(log) {
  const handlers = [];
  const api = {
    handlers,
    on(name, fn) { handlers.push({ name, fn, once: false }); return api; },
    once(name, fn) { handlers.push({ name, fn, once: true }); return api; },
    off(name, fn) { const i = handlers.findIndex((h) => h.name === name && h.fn === fn); if (i >= 0) handlers.splice(i, 1); return api; },
    listenerCount(name) { return handlers.filter((h) => h.name === name).length; },
    fire(name) {
      log('signal', { name });
      for (const h of handlers.filter((x) => x.name === name)) { if (h.once) api.off(name, h.fn); h.fn(name); }
    },
  };
  api.addListener = api.on;
  api.prependListener = api.on;
  api.removeListener = api.off;
  api.removeAllListeners = (name) => {
    for (let i = handlers.length - 1; i >= 0; i--) if (name === undefined || handlers[i].name === name) handlers.splice(i, 1);
    return api;
  };
  return api;
}

/** Where a planned row names its address (the fake port does not care about the rest of a row's shape). */
function addrOf(row) {
  if (typeof row === 'string') return row;
  if (!isPlainObject(row)) return undefined;
  if (typeof row.address === 'string') return row.address;
  for (const v of Object.values(row)) {
    if (!isPlainObject(v)) continue;
    if (typeof v.address === 'string') return v.address;
    if (Array.isArray(v.props)) {
      const e = v.props.find((p) => Array.isArray(p) && p[0] === 'address');
      if (e) return e[2];
    }
  }
  return undefined;
}
function normKind(k) {
  const s = String(k).toLowerCase();
  if (/^(remov|delet)/.test(s)) return 'remove';
  if (/^mov/.test(s)) return 'move';
  if (/^updat/.test(s)) return 'update';
  if (/^creat/.test(s)) return 'create';
  return s;
}

/** What getOwnerAssistantPubkey() returns (src/utils/assistantKeys.js:49-82): env, then a valid conf value, then the key file. */
function helperResult(env, keyFilePubkey) {
  if (env.TA_PUBKEY) return env.TA_PUBKEY;
  const conf = env.BRAINSTORM_RELAY_PUBKEY;
  if (conf && /^[0-9a-f]{64}$/.test(conf)) return conf;
  if (keyFilePubkey) return keyFilePubkey;
  return null;
}

/**
 * A world of fake ports. Options:
 *   files               share the state files with an earlier world (two passes over one instance)
 *   report / held / confirmation   the state files' starting content (when `files` is not given)
 *   busy, lockHeld      the lock (default: not busy, held)
 *   env                 overrides of DEFAULT_ENV (undefined deletes a key); keyFilePubkey (default LOCAL)
 *   canonicalZ          what the canonical getter returns (default STAMP(CANONICAL))
 *   schema              { tags: 'online' | 'missing' | 'populating', tagsName, nostrUser }; schemaAfterRead
 *   rows / readAllError / readAllDelayMs   the graph snapshot
 *   events / scanError  the relay scan
 *   ensureError, failReportWrite(n), failPreimage, onApply({ kind, rows, index, kindIndex, world })
 *   now, randomId
 */
function makeWorld(o = {}) {
  const w = { log: [], files: o.files || newFiles(o), result: undefined, error: undefined, exitCalled: undefined };
  const log = (op, extra) => { const e = Object.assign({ op }, extra); w.log.push(e); return e; };
  w.env = Object.assign({}, DEFAULT_ENV);
  for (const [k, v] of Object.entries(o.env || {})) { if (v === undefined) delete w.env[k]; else w.env[k] = v; }
  const keyFilePubkey = has(o, 'keyFilePubkey') ? o.keyFilePubkey : LOCAL;
  w.schema = Object.assign({ tags: 'online', tagsName: 'tags_address', nostrUser: true }, o.schema || {});
  const rows = o.rows || [];
  const events = o.events || [];
  const files = w.files;
  const lockHeld = o.lockHeld === undefined ? true : o.lockHeld;
  let clock = o.now === undefined ? T0 : o.now;
  let applyIndex = 0;
  const kindCount = {};

  w.signals = fakeSignals(log);
  w.proc = { pid: PID, argv: [process.execPath, RUNNER].concat(o.busy ? ['--lock-busy'] : []), exitCode: undefined, startTime: START_TIME };
  const lock = function held() { log('lock.held'); return lockHeld; };
  lock.held = lock;
  lock.busy = !!o.busy;
  lock.fd = 9;

  const state = {
    stateDir() { return FAKE_STATE_DIR; },
    readReport() { log('state.readReport'); return clone(files.doc); },
    writeReport(doc) {
      const n = w.log.filter((x) => x.op === 'state.writeReport').length;
      const e = log('state.writeReport', { doc: clone(doc), ok: false });
      if (o.failReportWrite && o.failReportWrite(n)) throw fsError('EACCES', 'open', path.join(FAKE_STATE_DIR, 'report.json.tmp'));
      files.doc = clone(doc);
      e.ok = true;
    },
    writeHeld(runId, list) { log('state.writeHeld', { runId, list: clone(list) }); files.held[runId] = clone(list); },
    readHeld(runId) {
      log('state.readHeld', { runId });
      if (typeof runId !== 'string' || !has(files.held, runId)) throw fsError('ENOENT', 'open', path.join(FAKE_STATE_DIR, 'held', `${runId}.json`));
      return clone(files.held[runId]);
    },
    heldDigest(listOrText) { log('state.heldDigest'); return digestOf(listOrText); },
    appendPreimages(runId, records) {
      log('state.appendPreimages', { runId, records: clone(records) || [] });
      if (o.failPreimage) throw fsError('ENOSPC', 'write', path.join(FAKE_STATE_DIR, 'preimages', `${runId}.jsonl`));
      files.preimages[runId] = (files.preimages[runId] || []).concat(clone(records) || []);
    },
    claimConfirmation(runId) {
      log('state.claimConfirmation', { runId });
      const r = files.pending;
      files.pending = null;
      if (r) files.claimed.push({ runId, record: clone(r) });
      // The claimed record, readable both as itself and as `.record` (test/tagging-edges-state-routes.test.js accepts either).
      return r ? Object.assign(clone(r), { record: clone(r) }) : null;
    },
    readPendingConfirmation() { log('state.readPendingConfirmation'); return clone(files.pending) || null; },
    writeConfirmation(r) { log('state.writeConfirmation'); files.pending = clone(r); },
    withdrawConfirmation() { log('state.withdrawConfirmation'); files.pending = null; },
    prune() { log('state.prune'); },
    processStartTime(pid) { log('state.processStartTime', { pid }); return pid === PID ? START_TIME : null; },
    isAlive() { log('state.isAlive'); return false; },
    lockHeld() { log('state.lockHeld'); return lockHeld; },
  };

  async function apply(kind, list, opts) {
      const kindIndex = kindCount[kind] = (kindCount[kind] === undefined ? 0 : kindCount[kind] + 1);
      const entry = log('graph.write', {
        kind, n: list.length, addresses: list.map(addrOf), index: applyIndex++, kindIndex, threw: false,
        timeoutMs: isPlainObject(opts) ? opts.timeoutMs : undefined,
      });
      await tick();
      const sent = list.map(addrOf);
      let result = { applied: list.length, lostRace: 0, nodesCreated: 0, transientRetries: 0, appliedAddresses: sent };
      if (o.onApply) {
        try {
          const r = await o.onApply({ kind, rows: list, index: entry.index, kindIndex, world: w });
          // A result that names no committed rows commits the first `applied` rows sent (tests that care say which).
          if (r) result = Array.isArray(r.appliedAddresses) ? r : Object.assign({}, r, { appliedAddresses: sent.slice(0, r.applied) });
        } catch (err) { entry.threw = true; throw err; }
      }
      return result;
  }
  const port = {
    async readSchema() { log('graph.readSchema'); await tick(); return schemaView(w.schema); },
    async ensureTagsConstraint(opts) {
      log('graph.ensureTagsConstraint', { opts: isPlainObject(opts) ? Object.assign({}, opts) : opts });
      await tick();
      if (o.ensureError) throw o.ensureError;
      w.schema = Object.assign({}, w.schema, { tags: 'online', tagsName: 'tags_address' });
      return schemaView(w.schema); // the schema as it now stands (clarification C4), rows included
    },
    async readAll(opts) {
      log('graph.readAll:called', { opts: isPlainObject(opts) ? Object.assign({}, opts) : opts });
      await delay(o.readAllDelayMs === undefined ? 5 : o.readAllDelayMs);
      if (o.readAllError) { log('graph.readAll:rejected'); throw o.readAllError; }
      if (o.schemaAfterRead) w.schema = Object.assign({}, w.schema, o.schemaAfterRead);
      const out = clone(rows);
      log('graph.readAll:resolved', { rows: out.length });
      return out;
    },
    async applyCreates(list, opts) { return apply('create', Array.isArray(list) ? list : [], opts); },
    async applyLocked(kind, list, opts) {
      if (!opts || typeof opts.preimage !== 'function') {
        log('graph.applyLocked:refused', { kind: normKind(kind) });
        throw new Error('applyLocked refuses to run without an injected preimage(rows) (ADR 0002, graph.js)');
      }
      await opts.preimage(list);
      return apply(normKind(kind), Array.isArray(list) ? list : [], opts);
    },
    async close() { log('graph.close'); },
  };

  w.deps = {
    now: () => clock++,
    randomId: () => { log('randomId'); return o.randomId || RANDOM_ID; },
    lock,
    state,
    identities: {
      canonicalZ: () => { log('identities.canonicalZ'); return has(o, 'canonicalZ') ? o.canonicalZ : STAMP(CANONICAL); },
      getOwnerAssistantPubkey: () => { log('identities.getOwnerAssistantPubkey'); return helperResult(w.env, keyFilePubkey); },
    },
    env: w.env,
    openGraph(cfg) {
      log('openGraph', { uri: cfg && cfg.uri, user: cfg && cfg.user, passwordMatches: !!cfg && cfg.password === w.env.NEO4J_PASSWORD });
      return port;
    },
    async scan(filter, opts) {
      const entry = log('scan', {
        filter: clone(filter), optKeys: isPlainObject(opts) ? Object.keys(opts) : null,
        timeoutMs: isPlainObject(opts) ? opts.timeoutMs : undefined, isExpected: isPlainObject(opts) ? opts.isExpected : undefined,
      });
      await tick();
      if (o.scanError) throw o.scanError;
      const evs = clone(events);
      const text = evs.map((e) => `${JSON.stringify(e)}\n`).join('');
      entry.bytes = Buffer.byteLength(text, 'utf8');
      return { events: evs, lines: evs.length, bytes: entry.bytes, elapsedMs: 3 };
    },
    emit(...args) {
      const meta = args.slice(1).reverse().find(isPlainObject);
      log('emit', { type: args[0], meta: meta ? Object.assign({}, meta) : {} });
    },
    proc: w.proc,
    signals: w.signals,
  };
  return w;
}

// ─── running and reading a pass ────────────────────────────────────────────────────────────────────────────────
function settle(promise, ms) {
  let timer;
  const hung = new Promise((r) => { timer = setTimeout(() => r('HUNG'), ms); });
  return Promise.race([promise.then((value) => ({ value }), (error) => ({ error })), hung]).finally(() => clearTimeout(timer));
}
const lastOps = (w, n = 14) => w.log.slice(-n).map((e) => e.op + (e.kind ? `(${e.kind})` : '')).join(', ') || 'none';

async function runPass(w, { mustResolve = true, mod } = {}) {
  const m = mod || load();
  if (typeof m.run !== 'function') throw new Error(`${RUNNER_REL} must export run(deps); it exports ${show(Object.keys(m))}`);
  const realExit = process.exit;
  process.exit = (code) => {
    w.exitCalled = code;
    throw new Error(`run(deps) called process.exit(${code})`);
  };
  try {
    const out = await settle(Promise.resolve().then(() => m.run(w.deps)), RUN_BUDGET_MS);
    if (out === 'HUNG') throw new Error(`run(deps) did not settle within ${RUN_BUDGET_MS} ms; last calls: ${lastOps(w)}`);
    if (out.error) w.error = out.error; else w.result = out.value;
  } finally { process.exit = realExit; }
  assert(w.exitCalled === undefined, `run(deps) called process.exit(${w.exitCalled}): it must return, leaving the exit code on deps.proc.exitCode`);
  if (mustResolve && w.error) {
    throw new Error(`run(deps) rejected: ${firstLine(w.error)} — every pass should end with a report, not a rejection; last calls: ${lastOps(w)}`);
  }
  return w;
}

const count = (w, op) => w.log.filter((e) => e.op === op).length;
const idx = (w, op) => w.log.findIndex((e) => e.op === op);
const lastIdx = (w, op) => { for (let i = w.log.length - 1; i >= 0; i--) if (w.log[i].op === op) return i; return -1; };
const writesOf = (w) => w.log.filter((e) => e.op === 'graph.write');
const describeWrites = (w) => writesOf(w).map((e) => `${e.kind}×${e.n}${e.threw ? '(threw)' : ''}`).join(', ') || 'none';
const writtenAddresses = (w, kind) => writesOf(w).filter((e) => e.kind === kind).reduce((a, e) => a.concat(e.addresses), []);
const emitsOf = (w) => w.log.filter((e) => e.op === 'emit');
const MUTATING_STATE_OPS = ['state.writeReport', 'state.writeHeld', 'state.appendPreimages', 'state.claimConfirmation',
  'state.writeConfirmation', 'state.withdrawConfirmation', 'state.prune'];
const mutatingStateCalls = (w) => w.log.filter((e) => MUTATING_STATE_OPS.includes(e.op)).map((e) => e.op);
const latestOf = (doc) => (isPlainObject(doc) && has(doc, 'latest') ? doc.latest : doc);
const reportDocsOf = (w) => w.log.filter((e) => e.op === 'state.writeReport' && e.ok).map((e) => e.doc);
function finalLatest(w) {
  const docs = reportDocsOf(w);
  assert(docs.length > 0, `the pass wrote no report (no successful state.writeReport); last calls: ${lastOps(w)}`);
  const l = latestOf(docs[docs.length - 1]);
  assert(isPlainObject(l), `the last report written has no latest record: ${show(docs[docs.length - 1])}`);
  return l;
}
const rel = (l) => (isPlainObject(l.relationships) ? l.relationships : {});
const exitOf = (w) => (w.proc.exitCode === undefined ? 0 : w.proc.exitCode); // an unset exitCode exits 0
function expectExit(w, code, why) {
  eq(exitOf(w), code, `exit code for ${why} (deps.proc.exitCode; 0 done or held, 2 refused, 1 failed)`);
}
function expectZeroWrites(w, why) {
  assert(writesOf(w).length === 0, `${why}: expected zero write calls (applyCreates / applyLocked); got ${describeWrites(w)}`);
}
function expectOutcome(l, outcome, why) {
  eq(l.outcome, outcome, `${why}: report outcome (reasonCode ${show(l.reasonCode)}, failure ${show(l.failure)})`);
}
/** reasonCode or failure.stage names `word` (ADR: "→ refused, `config`", "→ failed, `plan`"). */
function expectNames(l, word, why) {
  const stage = isPlainObject(l.failure) ? l.failure.stage : undefined;
  assert(l.reasonCode === word || stage === word,
    `${why}: the report should name '${word}' as its reasonCode or failure.stage; got reasonCode ${show(l.reasonCode)}, failure ${show(l.failure)}`);
}
/** The object in the report (latest itself or one level down) that names a refused identity. */
function identityRefusal(l) {
  const candidates = [l].concat(Object.values(l).filter(isPlainObject));
  return candidates.find((c) => typeof c.identity === 'string' && has(c, 'problem') && has(c, 'source')) || null;
}
function phaseNames(l) { return Array.isArray(l.phases) ? l.phases.map((p) => p && p.phase) : []; }

/** Swap sweep.planPass for a throwing stub for one body, then put the real planner back (ADR step 10). */
function forgetPipeline() {
  for (const k of Object.keys(require.cache)) if (k.startsWith(PIPELINE_DIR)) delete require.cache[k];
}
async function withThrowingPlanner(body) {
  let sweep;
  try { sweep = require(SWEEP); }
  catch (e) { throw new Error(`src/lib/tagging-edges/sweep.js not implemented yet (require failed: ${firstLine(e)})`); }
  assert(typeof sweep.planPass === 'function', `src/lib/tagging-edges/sweep.js must export planPass; it exports ${show(Object.keys(sweep))}`);
  load(); // the red-phase message comes from the runner itself
  const entry = require.cache[require.resolve(SWEEP)];
  const original = entry.exports;
  entry.exports = Object.assign({}, original, { planPass: () => { throw new Error('planPass exploded (test stub: a thrown planner)'); } });
  const dropIndex = () => { try { delete require.cache[require.resolve(LIB_INDEX)]; } catch (_) { /* no index */ } };
  forgetPipeline(); dropIndex();
  try { return await body(load()); }
  finally { entry.exports = original; forgetPipeline(); dropIndex(); }
}

// ─── the real entry in a child process ─────────────────────────────────────────────────────────────────────────
function needRunnerFile() {
  if (!fs.existsSync(RUNNER)) throw new Error(`${RUNNER_REL} not implemented yet (no such file)`);
}
/** A throwaway state and log directory, and an environment with no identity and no Neo4j settings. */
function childSandbox() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tagging-edges-runner-'));
  const stateDir = path.join(tmp, 'state');
  const logDir = path.join(tmp, 'log');
  fs.mkdirSync(stateDir);
  fs.mkdirSync(logDir);
  const env = {
    PATH: process.env.PATH, HOME: tmp, TAGGING_EDGES_STATE_DIR: stateDir,
    BRAINSTORM_STRUCTURED_LOGGING: 'false', BRAINSTORM_LOG_DIR: logDir, BRAINSTORM_MODULE_SRC_DIR: path.join(REPO, 'src'),
  };
  return { tmp, stateDir, env, cleanup: () => fs.rmSync(tmp, { recursive: true, force: true }) };
}
function childProbe() {
  needRunnerFile();
  const sb = childSandbox();
  try {
    const script = [
      `const r = require(${JSON.stringify(RUNNER)});`,
      'const out = { exports: Object.keys(r) };',
      "if (typeof r.defaultDeps === 'function') {",
      '  const d = r.defaultDeps();',
      '  out.deps = d ? Object.keys(d) : null;',
      "  out.identityGetters = d && d.identities ? Object.keys(d.identities).filter((k) => typeof d.identities[k] === 'function') : null;",
      '}',
      'out.loaded = Object.keys(require.cache);',
      "process.stdout.write('\\n@@PROBE@@' + JSON.stringify(out) + '\\n');",
    ].join('\n');
    const r = spawnSync(process.execPath, ['-e', script], { cwd: REPO, env: sb.env, encoding: 'utf8', timeout: 20000 });
    const line = String(r.stdout || '').split('\n').find((l) => l.startsWith('@@PROBE@@'));
    assert(line, `the probe (require the runner, call defaultDeps()) printed nothing; exit ${r.status}, signal ${r.signal}, stderr: ${String(r.stderr || '').slice(-600)}`);
    return JSON.parse(line.slice('@@PROBE@@'.length));
  } finally { sb.cleanup(); }
}

/* ══════════════════════════ surface and entry (child, static) ══════════════════════════ */

test('SR1: the runner exports run(deps) and defaultDeps(), and defaultDeps() builds all eleven ports — now, randomId, lock, state, identities, env, openGraph, scan, emit, proc, signals — with the canonicalZ and getOwnerAssistantPubkey getters', () => {
  const p = childProbe();
  for (const fn of ['run', 'defaultDeps']) assert((p.exports || []).includes(fn), `the runner should export ${fn}; it exports ${show(p.exports)}`);
  const want = ['now', 'randomId', 'lock', 'state', 'identities', 'env', 'openGraph', 'scan', 'emit', 'proc', 'signals'];
  const missing = want.filter((k) => !(p.deps || []).includes(k));
  assert(missing.length === 0, `defaultDeps() is missing port(s) ${show(missing)}; it returned ${show(p.deps)}`);
  for (const g of ['canonicalZ', 'getOwnerAssistantPubkey']) {
    assert((p.identityGetters || []).includes(g), `defaultDeps().identities should have a ${g}() getter (injected, since the helper caches); got ${show(p.identityGetters)}`);
  }
});

test('SR2: loading the runner and building defaultDeps() loads neither src/api/profile-tags (the canonical getter requires it lazily) nor neo4j-driver', () => {
  const p = childProbe();
  const loaded = p.loaded || [];
  const tags = loaded.filter((k) => k.includes(`${path.sep}src${path.sep}api${path.sep}profile-tags${path.sep}`));
  const driver = loaded.filter((k) => k.includes(`${path.sep}node_modules${path.sep}neo4j-driver${path.sep}`));
  assert(tags.length === 0, `profile-tags must be required only inside the canonical getter (ADR 0002 step 4, the identificationTaggings.js:71-73 precedent); already loaded: ${preview(tags)}`);
  assert(driver.length === 0, `neo4j-driver must load lazily (the runner loads stack-free); already loaded ${driver.length} file(s), e.g. ${preview(driver.slice(0, 2))}`);
});

test('SR3: the runner\'s source carries no 64-hex literal — the canonical stamp pubkey comes from the lazy profile-tags getter, never a copy of the ADR 0015 literal', () => {
  needRunnerFile();
  const src = fs.readFileSync(RUNNER, 'utf8');
  const m = /[0-9a-fA-F]{64}/.exec(src);
  assert(!m, `${RUNNER_REL} contains a 64-hex literal (${m && `${m[0].slice(0, 8)}…`}); read identities at runtime (CLAUDE.md, ADR 0015)`);
});

test('SR4: the real entry started with --lock-busy exits 0 and writes nothing into its state directory', () => {
  needRunnerFile();
  const sb = childSandbox();
  try {
    const r = spawnSync(process.execPath, [RUNNER, '--lock-busy'], { cwd: REPO, env: sb.env, encoding: 'utf8', timeout: 20000 });
    assert(!r.error && r.signal === null, `the entry did not exit on its own (error ${r.error && r.error.message}, signal ${r.signal})`);
    eq(r.status, 0, `exit status of \`node ${RUNNER_REL} --lock-busy\` (stderr: ${String(r.stderr || '').slice(-300)})`);
    const left = fs.readdirSync(sb.stateDir);
    assert(left.length === 0, `--lock-busy touches no file (ADR 0002 step 1); the state directory now holds ${show(left)}`);
  } finally { sb.cleanup(); }
});

test('SR5: the real entry run by hand, outside the wrapper\'s lock (no FLOCK WRITE on fd 9), writes nothing into its state directory', () => {
  needRunnerFile();
  const sb = childSandbox();
  try {
    const r = spawnSync(process.execPath, [RUNNER], { cwd: REPO, env: sb.env, encoding: 'utf8', timeout: 20000 });
    assert(!r.error && r.signal === null, `the entry did not exit on its own (error ${r.error && r.error.message}, signal ${r.signal})`);
    const left = fs.readdirSync(sb.stateDir);
    assert(left.length === 0, `a hand run outside the lock must refuse before writing (ADR 0002 step 1, "not-started-under-the-lock"); the state directory now holds ${show(left)}`);
  } finally { sb.cleanup(); }
});

/* ══════════════════════════ the lock (ports) ══════════════════════════ */

test('SR6: started with --lock-busy, the pass emits TASK_START, TASK_ERROR and TASK_END "not-started — another pass is running", touches no state file, never opens the graph or scans, and exits 0', async () => {
  const w = await runPass(makeWorld(baseline({ busy: true, lockHeld: false })));
  const mut = mutatingStateCalls(w);
  assert(mut.length === 0, `--lock-busy must touch no file (ADR 0002 step 1; owner decision 15: no report); state calls: ${show(mut)}`);
  eq(count(w, 'openGraph'), 0, '--lock-busy: openGraph calls');
  eq(count(w, 'scan'), 0, '--lock-busy: relay scans');
  same(emitsOf(w).map((e) => e.type), ['TASK_START', 'TASK_ERROR', 'TASK_END'], '--lock-busy: events emitted, in order');
  const end = emitsOf(w).find((e) => e.type === 'TASK_END');
  eq(end.meta.outcome, 'not-started', '--lock-busy: TASK_END outcome');
  assert(/another pass is running/.test(show(end.meta)), `--lock-busy: TASK_END should say why, "another pass is running"; got ${show(end.meta)}`);
  expectExit(w, 0, '--lock-busy');
});

test('SR7: not under the lock and not --lock-busy (a hand-run node), the pass refuses "not-started-under-the-lock" the same way — the three events, no state file touched, no graph, no scan — and exits 2 (refused; owner ruling at the Test Design gate)', async () => {
  const w = await runPass(makeWorld(baseline({ lockHeld: false })));
  const mut = mutatingStateCalls(w);
  assert(mut.length === 0, `a start outside the lock must touch no file; state calls: ${show(mut)}`);
  eq(count(w, 'openGraph'), 0, 'outside the lock: openGraph calls');
  eq(count(w, 'scan'), 0, 'outside the lock: relay scans');
  same(emitsOf(w).map((e) => e.type), ['TASK_START', 'TASK_ERROR', 'TASK_END'], 'outside the lock: events emitted, in order');
  const end = emitsOf(w).find((e) => e.type === 'TASK_END');
  eq(end.meta.outcome, 'not-started', `outside the lock: TASK_END outcome (TASK_END: ${show(end.meta)})`);
  eq(end.meta.reasonCode, 'not-started-under-the-lock', `outside the lock: TASK_END reasonCode — the ADR's name for this refusal, carried where TASK_END carries its reasonCode (TASK_END: ${show(end.meta)})`);
  eq(exitOf(w), 2, 'exit code for a hand run outside the lock (deps.proc.exitCode; refused → 2, unlike --lock-busy, which exits 0)');
});

/* ══════════════════════════ the report's bookkeeping (D9) ══════════════════════════ */

test('SR8: the first thing a pass writes is the pessimistic record — failed, stopped, reasonCode "stopped", running, with its pid and process start time — and it is written before any graph contact', async () => {
  const w = await runPass(makeWorld(baseline()));
  const firstMut = w.log.find((e) => MUTATING_STATE_OPS.includes(e.op));
  assert(firstMut && firstMut.op === 'state.writeReport', `the first state write should be the pessimistic report; it was ${firstMut ? firstMut.op : 'none'}`);
  const iWrite = w.log.indexOf(firstMut);
  const iOpen = idx(w, 'openGraph');
  assert(iOpen > iWrite, `the pessimistic record must be written before any graph contact (openGraph at call ${iOpen}, the record at ${iWrite}); calls: ${lastOps(w, 40)}`);
  const iScan = idx(w, 'scan');
  assert(iScan > iWrite, `the pessimistic record must be written before the relay scan (scan at ${iScan}, the record at ${iWrite})`);
  eq(firstMut.doc && firstMut.doc.reportVersion, 1, 'the pessimistic write\'s reportVersion');
  const p = latestOf(firstMut.doc);
  eq(p.outcome, 'failed', 'pessimistic outcome');
  eq(p.stopped, true, 'pessimistic stopped');
  eq(p.reasonCode, 'stopped', 'pessimistic reasonCode');
  eq(p.reason, PESSIMISTIC_REASON, 'pessimistic reason');
  eq(p.running, true, 'pessimistic running');
  eq(p.runId, EXPECTED_RUN_ID, 'pessimistic runId');
  eq(p.process && p.process.pid, PID, 'pessimistic process.pid');
  eq(String(p.process && p.process.startTime), START_TIME, 'pessimistic process.startTime (field 22 of /proc/self/stat)');
});

test('SR9: when the pessimistic write fails, the pass ends with no graph contact and no scan, emits TASK_ERROR then TASK_END, and exits 1', async () => {
  const w = await runPass(makeWorld(baseline({ failReportWrite: (n) => n === 0 })), { mustResolve: false });
  eq(count(w, 'openGraph'), 0, 'openGraph calls after a failed pessimistic write');
  eq(count(w, 'scan'), 0, 'relay scans after a failed pessimistic write');
  eq(count(w, 'state.claimConfirmation'), 0, 'confirmation claims after a failed pessimistic write');
  const types = emitsOf(w).map((e) => e.type);
  const iErr = types.indexOf('TASK_ERROR');
  const iEnd = types.lastIndexOf('TASK_END');
  assert(iErr >= 0 && iEnd > iErr && iEnd === types.length - 1, `expected TASK_ERROR, then TASK_END as the last event; got ${show(types)}`);
  expectExit(w, 1, 'a failed pessimistic write');
});

test('SR10: the prior latest report moves into previous (at most 9 kept), and the final report replaces the pass\'s own pessimistic record rather than joining previous', async () => {
  const L0 = priorReport(RUN_PRIOR);
  const P1 = priorReport('20260925T080000Z-dddd0005');
  const w = await runPass(makeWorld(baseline({ report: reportDoc(L0, [P1]) })));
  const d = w.files.doc;
  eq(latestOf(d).runId, EXPECTED_RUN_ID, 'latest after the pass');
  expectOutcome(latestOf(d), 'done', 'the stored latest');
  const ids = (d.previous || []).map((r) => r && r.runId);
  eq(ids.filter((x) => x === RUN_PRIOR).length, 1, `the prior latest appears once in previous (previous: ${show(ids)})`);
  assert(ids.includes(P1.runId), `the older previous entry is kept; previous: ${show(ids)}`);
  assert(!ids.includes(EXPECTED_RUN_ID), `the pass's own pessimistic record must be replaced, not pushed into previous; previous: ${show(ids)}`);

  const nine = Array.from({ length: 9 }, (_, i) => priorReport(`20260901T0${i}0000Z-dddd100${i}`));
  const w2 = await runPass(makeWorld(baseline({ report: reportDoc(L0, nine) })));
  const prev2 = (w2.files.doc.previous || []).map((r) => r && r.runId);
  eq(prev2.length, 9, `previous is capped at 9 (it held 9 plus the prior latest); previous: ${show(prev2)}`);
  assert(prev2.includes(RUN_PRIOR), `the prior latest is kept when the cap drops an older one; previous: ${show(prev2)}`);
});

test('SR11: a stored latest that still reads running (its owner is dead — the lock is ours) moves into previous with running: false and a stoppedDetectedAt', async () => {
  const stale = priorReport(RUN_STALE, {
    outcome: 'failed', stopped: true, reasonCode: 'stopped', reason: PESSIMISTIC_REASON, running: true, process: { pid: 999, startTime: '1' },
  });
  const w = await runPass(makeWorld(baseline({ report: reportDoc(stale, []) })));
  const first = reportDocsOf(w)[0];
  assert(first, 'no report was written');
  const moved = (first.previous || []).find((r) => r && r.runId === RUN_STALE);
  assert(moved, `the stale record should be in previous from the pessimistic write on; previous: ${show((first.previous || []).map((r) => r && r.runId))}`);
  eq(moved.running, false, 'the stale record\'s running flag in previous');
  assert(moved.stoppedDetectedAt !== undefined && moved.stoppedDetectedAt !== null, `the stale record should carry stoppedDetectedAt; got ${show(moved)}`);
  eq(latestOf(first).runId, EXPECTED_RUN_ID, 'the pessimistic record is the new latest');
});

test('SR12: the runId is the UTC start time as YYYYMMDDTHHMMSSZ, "-", and randomId()\'s 8 hex characters — RUN_ID_RE — and the same id rides TASK_START, the pessimistic record, the final report and TASK_END', async () => {
  const w = await runPass(makeWorld(baseline()));
  const final = finalLatest(w);
  eq(final.runId, EXPECTED_RUN_ID, 'the final report\'s runId (now() = 2026-09-27T12:34:56Z, randomId() = "0a1b2c3d")');
  assert(RUN_ID_RE.test(final.runId), `runId ${show(final.runId)} must match ${RUN_ID_RE}`);
  let sweep = null;
  try { sweep = require(SWEEP); } catch (_) { /* reported by load() already */ }
  if (sweep && sweep.RUN_ID_RE instanceof RegExp) assert(sweep.RUN_ID_RE.test(final.runId), `sweep.RUN_ID_RE should accept the generated runId ${final.runId}`);
  eq(latestOf(reportDocsOf(w)[0]).runId, EXPECTED_RUN_ID, 'the pessimistic record\'s runId');
  const start = emitsOf(w).find((e) => e.type === 'TASK_START');
  const end = emitsOf(w).filter((e) => e.type === 'TASK_END').pop();
  eq(start && start.meta.runId, EXPECTED_RUN_ID, 'TASK_START runId');
  eq(end && end.meta.runId, EXPECTED_RUN_ID, 'TASK_END runId');

  const w2 = await runPass(makeWorld(baseline({ now: Date.UTC(2027, 0, 2, 3, 4, 5), randomId: 'ffee0011' })));
  eq(finalLatest(w2).runId, '20270102T030405Z-ffee0011', 'runId with single-digit month, day and time fields (zero-padded, UTC)');
});

test('SR13: a done pass emits TASK_START first and TASK_END last — { runId, outcome, reasonCode, confirmed, counts } — with no TASK_ERROR; a refused or failed pass emits TASK_ERROR before its TASK_END', async () => {
  const w = await runPass(makeWorld(baseline()));
  const types = emitsOf(w).map((e) => e.type);
  eq(types[0], 'TASK_START', `the first event (events: ${show(types)})`);
  eq(types[types.length - 1], 'TASK_END', `the last event (events: ${show(types)})`);
  assert(!types.includes('TASK_ERROR'), `a done pass emits no TASK_ERROR; events: ${show(types)}`);
  const end = emitsOf(w).pop().meta;
  eq(end.outcome, 'done', 'TASK_END outcome');
  for (const k of ['runId', 'outcome', 'reasonCode', 'confirmed', 'counts']) assert(has(end, k), `TASK_END should carry ${k}; got ${show(Object.keys(end))}`);
  await cases([
    { name: 'refused (upper-case env TA_PUBKEY)', world: baseline({ env: { TA_PUBKEY: UPPER_HEX } }), outcome: 'refused' },
    { name: 'failed (graph read)', world: baseline({ readAllError: neoError('Neo.TransientError.General.DatabaseUnavailable', 'database unavailable') }), outcome: 'failed' },
  ], async (c) => {
    const wc = await runPass(makeWorld(c.world));
    const t = emitsOf(wc).map((e) => e.type);
    const iErr = t.indexOf('TASK_ERROR');
    assert(iErr >= 0 && t[t.length - 1] === 'TASK_END' && iErr < t.length - 1, `expected TASK_ERROR before a final TASK_END; events: ${show(t)}`);
    eq(emitsOf(wc).pop().meta.outcome, c.outcome, 'TASK_END outcome');
  });
});

/* ══════════════════════════ identities (AC-4; ADR step 4, Seams → Identities) ══════════════════════════ */

/** Assert a pass was refused on an identity, with zero write calls and nothing read or claimed. */
function expectIdentityRefused(w, { identity, problem, source }) {
  const l = finalLatest(w);
  expectOutcome(l, 'refused', `identity ${identity}`);
  eq(l.reasonCode, 'identity', 'reasonCode');
  const r = identityRefusal(l);
  assert(r, `the report should name the refused identity, its problem and its source ({ identity, problem, source }); got ${show(l)}`);
  eq(r.identity, identity, 'refused identity');
  eq(r.source, source, 'refused identity\'s source');
  if (problem) eq(r.problem, problem, 'refused identity\'s problem');
  else assert(typeof r.problem === 'string' && r.problem.length > 0, `a problem should be named; got ${show(r.problem)}`);
  expectZeroWrites(w, 'an identity refusal');
  eq(count(w, 'openGraph'), 0, 'openGraph calls on an identity refusal (identities come before config and the driver)');
  eq(count(w, 'scan'), 0, 'relay scans on an identity refusal');
  eq(count(w, 'state.claimConfirmation'), 0, 'confirmation claims on an identity refusal');
  expectExit(w, 2, 'an identity refusal');
}

test('SR14: a malformed canonical stamp identity — upper-case, mixed-case, 63 or 65 characters, non-hex, an empty pubkey, or no nostr-user-tag stamp at all — refuses the pass naming identity "canonical", source "profile-tags", with zero write calls', async () => {
  await cases([
    { name: 'upper-case', z: STAMP(CANONICAL.toUpperCase()), problem: 'upper-case' },
    { name: 'mixed-case', z: STAMP(`A${CANONICAL.slice(1)}`), problem: 'upper-case' },
    { name: '63 characters', z: STAMP(CANONICAL.slice(1)), problem: 'not-64-hex' },
    { name: '65 characters', z: STAMP(`${CANONICAL}a`), problem: 'not-64-hex' },
    { name: 'non-hex', z: STAMP('g'.repeat(64)), problem: 'not-64-hex' },
    { name: 'empty pubkey', z: '39998::nostr-user-tag', problem: 'empty' },
    { name: 'a :tag stamp, not :nostr-user-tag', z: TAG_STAMP(CANONICAL), problem: null },
    { name: 'no value', z: undefined, problem: null },
  ], async (c) => {
    const w = await runPass(makeWorld(baseline({ canonicalZ: c.z })));
    expectIdentityRefused(w, { identity: 'canonical', problem: c.problem, source: 'profile-tags' });
  });
});

test('SR15: a malformed env TA_PUBKEY — upper-case, mixed-case, 63 or 65 characters, non-hex — refuses the pass naming identity "local", source "env TA_PUBKEY", with zero write calls', async () => {
  await cases([
    { name: 'upper-case', v: UPPER_HEX, problem: 'upper-case' },
    { name: 'mixed-case', v: `${LOCAL.slice(0, 63)}F`, problem: 'upper-case' },
    { name: '63 characters', v: LOCAL.slice(1), problem: 'not-64-hex' },
    { name: '65 characters', v: `${LOCAL}5`, problem: 'not-64-hex' },
    { name: 'non-hex', v: 'z'.repeat(64), problem: 'not-64-hex' },
  ], async (c) => {
    const w = await runPass(makeWorld(baseline({ env: { TA_PUBKEY: c.v } })));
    expectIdentityRefused(w, { identity: 'local', problem: c.problem, source: 'env TA_PUBKEY' });
  });
});

test('SR16: a malformed brainstorm.conf value (BRAINSTORM_RELAY_PUBKEY) refuses naming source "brainstorm.conf" — even when the secure-keys file holds a valid pubkey the helper would fall through to, and even when env TA_PUBKEY is valid', async () => {
  await cases([
    { name: 'upper-case conf, valid key file', env: { BRAINSTORM_RELAY_PUBKEY: UPPER_HEX }, problem: 'upper-case' },
    { name: 'short conf, valid key file', env: { BRAINSTORM_RELAY_PUBKEY: 'abc' }, problem: 'not-64-hex' },
    { name: 'valid env TA_PUBKEY, upper-case conf', env: { TA_PUBKEY: LOCAL, BRAINSTORM_RELAY_PUBKEY: UPPER_HEX }, problem: 'upper-case' },
  ], async (c) => {
    const w = await runPass(makeWorld(baseline({ env: c.env, keyFilePubkey: LOCAL })));
    expectIdentityRefused(w, { identity: 'local', problem: c.problem, source: 'brainstorm.conf' });
  });
});

test('SR17: with no brainstorm.conf value and a valid pubkey in the secure-keys file, the pass proceeds under that pubkey', async () => {
  const w = await runPass(makeWorld({ rows: [], events: [T_CANON], env: { BRAINSTORM_RELAY_PUBKEY: undefined }, keyFilePubkey: KEYFILE_PK }));
  const l = finalLatest(w);
  expectOutcome(l, 'done', 'conf absent, valid key file');
  eq(l.identities && l.identities.local, KEYFILE_PK.slice(0, 8), 'the report\'s local identity (8-character prefix)');
  const f = (w.log.find((e) => e.op === 'scan') || {}).filter || {};
  const z = f['#z'] || [];
  assert(z.includes(STAMP(KEYFILE_PK)) && z.includes(TAG_STAMP(KEYFILE_PK)), `the scan should ask for the key file pubkey's two stamps; '#z' was ${show(z)}`);
  expectExit(w, 0, 'a done pass');
});

test('SR18: with no brainstorm.conf value and an upper-case pubkey in the secure-keys file, the pass refuses naming source "secure-keys file"', async () => {
  const w = await runPass(makeWorld(baseline({ env: { BRAINSTORM_RELAY_PUBKEY: undefined }, keyFilePubkey: UPPER_HEX })));
  expectIdentityRefused(w, { identity: 'local', problem: 'upper-case', source: 'secure-keys file' });
});

test('SR19: with no local identity anywhere (no env, no conf, no key file), the pass refuses: local, "missing", source "brainstorm.conf" (where setup writes it)', async () => {
  const w = await runPass(makeWorld(baseline({ env: { BRAINSTORM_RELAY_PUBKEY: undefined }, keyFilePubkey: null })));
  expectIdentityRefused(w, { identity: 'local', problem: 'missing', source: 'brainstorm.conf' });
});

test('SR20: the pass uses the helper\'s result — env TA_PUBKEY valid and a different valid conf value → the scan asks for the env pubkey\'s stamps, and the report names it', async () => {
  const w = await runPass(makeWorld(baseline({ env: { TA_PUBKEY: LOCAL, BRAINSTORM_RELAY_PUBKEY: OTHER_DEPLOY } })));
  const l = finalLatest(w);
  expectOutcome(l, 'done', 'env TA_PUBKEY and conf both valid');
  eq(l.identities && l.identities.local, LOCAL.slice(0, 8), 'the report\'s local identity');
  const z = ((w.log.find((e) => e.op === 'scan') || {}).filter || {})['#z'] || [];
  assert(z.includes(STAMP(LOCAL)) && !z.includes(STAMP(OTHER_DEPLOY)), `the scan should use the helper's result (env TA_PUBKEY), not the conf value; '#z' was ${show(z)}`);
});

/* ══════════════════════════ config and the driver (ADR step 5) ══════════════════════════ */

test('SR21: NEO4J_URI or NEO4J_USER missing or empty refuses the pass ("config") before the graph is opened, with zero write calls and no claim', async () => {
  await cases([
    { name: 'NEO4J_URI missing', env: { NEO4J_URI: undefined } },
    { name: 'NEO4J_URI empty', env: { NEO4J_URI: '' } },
    { name: 'NEO4J_USER missing', env: { NEO4J_USER: undefined } },
    { name: 'NEO4J_USER empty', env: { NEO4J_USER: '' } },
  ], async (c) => {
    const w = await runPass(makeWorld(baseline({ env: c.env })));
    const l = finalLatest(w);
    expectOutcome(l, 'refused', c.name);
    expectNames(l, 'config', c.name);
    eq(count(w, 'openGraph'), 0, 'openGraph calls on a config refusal');
    eq(count(w, 'scan'), 0, 'relay scans on a config refusal');
    eq(count(w, 'state.claimConfirmation'), 0, 'confirmation claims on a config refusal');
    expectZeroWrites(w, 'a config refusal');
    expectExit(w, 2, 'a config refusal');
  });
});

test('SR22: the pass opens its own graph port with NEO4J_URI, NEO4J_USER and NEO4J_PASSWORD from the environment; the password appears in no report and no event; the port is closed', async () => {
  const w = await runPass(makeWorld(baseline()));
  eq(count(w, 'openGraph'), 1, 'openGraph calls');
  const o = w.log.find((e) => e.op === 'openGraph');
  eq(o.uri, DEFAULT_ENV.NEO4J_URI, 'openGraph uri');
  eq(o.user, DEFAULT_ENV.NEO4J_USER, 'openGraph user');
  eq(o.passwordMatches, true, 'openGraph got NEO4J_PASSWORD as its password');
  const written = show(reportDocsOf(w)) + show(emitsOf(w).map((e) => e.meta));
  assert(!written.includes(PASSWORD), 'the Neo4j password must appear in no report and no event');
  assert(count(w, 'graph.close') >= 1 && lastIdx(w, 'graph.close') > lastIdx(w, 'graph.write'), `the graph port should be closed after the last write; calls: ${lastOps(w)}`);
});

/* ══════════════════════════ schema pre-flight (AC-6; ADR step 6) ══════════════════════════ */

test('SR23: when tags_address is missing, the pass creates it once — waiting up to 60 s for it — before any graph read or write, and then proceeds', async () => {
  const w = await runPass(makeWorld(baseline({ schema: { tags: 'missing' } })));
  eq(count(w, 'graph.ensureTagsConstraint'), 1, 'ensureTagsConstraint calls');
  const en = w.log.find((e) => e.op === 'graph.ensureTagsConstraint');
  eq(en.opts && en.opts.timeoutMs, 60000, 'ensureTagsConstraint({ timeoutMs }) — the schema ONLINE wait (ADR "Lock class, time-outs, sizes": 60 s)');
  assert(idx(w, 'graph.ensureTagsConstraint') < idx(w, 'graph.readAll:called'), `the rule must be created before the graph read; calls: ${lastOps(w, 30)}`);
  expectOutcome(finalLatest(w), 'done', 'after creating tags_address');
});

test('SR24: when tags_address cannot be created, the pass is refused ("schema") naming the Neo4j code — no graph read, no scan, no claim, zero write calls, exit 2, port closed', async () => {
  const code = 'Neo.ClientError.Schema.ConstraintCreationFailed';
  const w = await runPass(makeWorld(baseline({ schema: { tags: 'missing' }, ensureError: neoError(code, "Unable to create Constraint( name='tags_address' )") })));
  const l = finalLatest(w);
  expectOutcome(l, 'refused', 'tags_address not creatable');
  expectNames(l, 'schema', 'tags_address not creatable');
  assert(show(l).includes(code), `the report should carry the Neo4j code ${code}; got ${show(l)}`);
  eq(count(w, 'graph.readAll:called'), 0, 'graph reads after a schema refusal');
  eq(count(w, 'scan'), 0, 'relay scans after a schema refusal');
  eq(count(w, 'state.claimConfirmation'), 0, 'confirmation claims after a schema refusal');
  expectZeroWrites(w, 'a schema refusal');
  expectExit(w, 2, 'a schema refusal');
  assert(count(w, 'graph.close') >= 1, 'the graph port should be closed on a schema refusal');
});

test('SR25: when nostrUser_pubkey is missing, the pass is refused ("schema") and never creates it — no graph read, zero write calls', async () => {
  const w = await runPass(makeWorld(baseline({ schema: { nostrUser: false } })));
  const l = finalLatest(w);
  expectOutcome(l, 'refused', 'nostrUser_pubkey missing');
  expectNames(l, 'schema', 'nostrUser_pubkey missing');
  eq(count(w, 'graph.ensureTagsConstraint'), 0, 'ensureTagsConstraint calls (tags_address is present; nothing else is the pass\'s to create)');
  eq(count(w, 'graph.readAll:called'), 0, 'graph reads after a schema refusal');
  expectZeroWrites(w, 'a schema refusal');
  expectExit(w, 2, 'a schema refusal');
});

test('SR26: a TAGS.address uniqueness rule present under another name counts as present (by definition) — the pass creates nothing and proceeds', async () => {
  const w = await runPass(makeWorld(baseline({ schema: { tagsName: 'tags_address_legacy' } })));
  eq(count(w, 'graph.ensureTagsConstraint'), 0, 'ensureTagsConstraint calls when the rule exists under another name');
  expectOutcome(finalLatest(w), 'done', 'the rule under another name');
});

/* ══════════════════════════ the claim's place in the sequence (ADR step 7) ══════════════════════════ */

test('SR27: the pass claims a pending confirmation with its own runId only after its identity, config and schema checks, and before it reads the graph', async () => {
  const s = heldScenario();
  const w = await runPass(makeWorld({ files: s.files, rows: s.rows, events: [] }));
  eq(count(w, 'state.claimConfirmation'), 1, 'claims');
  const iClaim = idx(w, 'state.claimConfirmation');
  eq(w.log[iClaim].runId, EXPECTED_RUN_ID, 'claimConfirmation(runId) is called with the claiming run\'s id');
  const iIdentity = Math.max(lastIdx(w, 'identities.canonicalZ'), lastIdx(w, 'identities.getOwnerAssistantPubkey'));
  assert(iIdentity >= 0 && iIdentity < iClaim, `the identities are read before the claim; calls: ${lastOps(w, 40)}`);
  assert(idx(w, 'openGraph') < iClaim, 'the config check and the driver come before the claim');
  const before = w.log.slice(0, iClaim);
  assert(before.some((e) => e.op === 'graph.readSchema'), `the schema pre-flight comes before the claim; calls before it: ${lastOps({ log: before }, 40)}`);
  const iRead = idx(w, 'graph.readAll:called');
  assert(iRead > iClaim, `the claim comes before the graph read (claim at ${iClaim}, read at ${iRead})`);
});

test('SR28: an identity, config or schema refusal while a confirmation is pending leaves it unclaimed, and the next pass claims and honours it', async () => {
  await cases([
    { name: 'identity', bad: { env: { TA_PUBKEY: UPPER_HEX } } },
    { name: 'config', bad: { env: { NEO4J_URI: '' } } },
    { name: 'schema', bad: { schema: { nostrUser: false } } },
  ], async (c) => {
    const s = heldScenario();
    const pending = clone(s.files.pending);
    const w1 = await runPass(makeWorld(Object.assign({ files: s.files, rows: s.rows, events: [] }, c.bad)));
    expectOutcome(finalLatest(w1), 'refused', `pass 1 (${c.name} refusal)`);
    eq(count(w1, 'state.claimConfirmation'), 0, `claims by a pass refused on ${c.name}`);
    same(s.files.pending, pending, `the pending confirmation after a ${c.name} refusal`);
    const w2 = await runPass(makeWorld({ files: s.files, rows: s.rows, events: [] }));
    const l2 = finalLatest(w2);
    eq(l2.confirmation && l2.confirmation.honoured, true, `pass 2 honours the confirmation (confirmation: ${show(l2.confirmation)})`);
    sameSet(writtenAddresses(w2, 'remove'), s.list.map((h) => h.address), 'pass 2 removes the confirmed held relationships');
  });
});

/* ══════════════════════════ the reads (AC-4; ADR steps 8–10, D2) ══════════════════════════ */

test('SR29: the graph read resolves before the relay scan is called, and the pass makes exactly one scan — { kinds: [39999], "#z": the four stamps } with no since and no kind 5 — after a graph read asked for 120 s', async () => {
  const w = await runPass(makeWorld(baseline({ readAllDelayMs: 30 })));
  const iRes = idx(w, 'graph.readAll:resolved');
  const iScan = idx(w, 'scan');
  assert(iRes >= 0 && iScan >= 0, `expected a graph read and a scan; calls: ${lastOps(w, 40)}`);
  assert(iRes < iScan, `the scan must start only after the graph read resolved (read first, relay second; ADR "Why the order of reads matters"); resolved at ${iRes}, scan at ${iScan}`);
  eq(count(w, 'scan'), 1, 'relay scans per pass');
  const f = w.log[iScan].filter || {};
  same(Object.keys(f).sort(), ['#z', 'kinds'], 'the scan filter\'s keys (no since, until, limit, authors or ids)');
  same(f.kinds, [39999], 'the scan filter\'s kinds (no kind-5 read)');
  sameSet(f['#z'], F.fourStamps(), 'the scan filter\'s #z: canonical and local nostr-user-tag and tag stamps');
  const ra = w.log.find((e) => e.op === 'graph.readAll:called');
  eq(ra.opts && ra.opts.timeoutMs, 120000, 'readAll({ timeoutMs }) for the graph snapshot (120 s)');
});

test('SR30: a graph read that fails or times out ends the pass failed, failure.read "graph" — no scan, zero write calls, exit 1, port closed', async () => {
  await cases([
    { name: 'error', err: neoError('Neo.TransientError.General.DatabaseUnavailable', 'database unavailable') },
    { name: 'time-out', err: neoError('Neo.ClientError.Transaction.TransactionTimedOutClientConfiguration', 'transaction timed out') },
  ], async (c) => {
    const w = await runPass(makeWorld({ rows: rowsFor(F.manyTaggings(3, { prefix: 'kept' })), events: F.manyTaggings(3, { prefix: 'kept' }), readAllError: c.err }));
    const l = finalLatest(w);
    expectOutcome(l, 'failed', `graph read ${c.name}`);
    eq(l.failure && l.failure.read, 'graph', 'failure.read');
    eq(count(w, 'scan'), 0, 'relay scans after a failed graph read');
    expectZeroWrites(w, `a graph read ${c.name}`);
    expectExit(w, 1, 'a failed pass');
    assert(count(w, 'graph.close') >= 1, 'the graph port should be closed');
  });
});

test('SR31: a graph snapshot row missing a column ends the pass failed, failure.read "graph", with zero write calls', async () => {
  await cases(['props', 'toIsUser', 'rid'].map((col) => ({ name: `no ${col}`, col })), async (c) => {
    const bad = F.storedRowFor(T_CANON);
    delete bad[c.col];
    const w = await runPass(makeWorld({ rows: [bad].concat(rowsFor([T_BOTH])), events: [T_CANON, T_BOTH, T_LOCAL] }));
    const l = finalLatest(w);
    expectOutcome(l, 'failed', `a row with ${c.name}`);
    eq(l.failure && l.failure.read, 'graph', 'failure.read');
    eq(count(w, 'scan'), 0, 'relay scans after an incomplete graph read');
    expectZeroWrites(w, `a row with ${c.name}`);
  });
});

test('SR32: a relay scan that rejects with any ScanError — time-out, exit, signal, truncated, unparseable, duplicate, off-filter, too-large — ends the pass failed, failure.read "relay" with that code, and zero write calls (never "the relay is empty")', async () => {
  const kept = F.manyTaggings(3, { prefix: 'relay-fail' });
  await cases(['timeout', 'exit', 'signal', 'truncated', 'unparseable', 'duplicate', 'off-filter', 'too-large'].map((code) => ({ name: code, code })), async (c) => {
    const w = await runPass(makeWorld({ rows: rowsFor(kept), events: kept, scanError: makeScanError(c.code) }));
    const l = finalLatest(w);
    expectOutcome(l, 'failed', `scan ${c.code}`);
    eq(l.failure && l.failure.read, 'relay', 'failure.read');
    eq(l.failure && l.failure.code, c.code, 'failure.code');
    expectZeroWrites(w, `a scan that failed (${c.code})`);
    expectExit(w, 1, 'a failed pass');
  });
});

test('SR33: a planner that throws ends the pass failed ("plan") with zero write calls and exit 1', async () => {
  await withThrowingPlanner(async (mod) => {
    const w = await runPass(makeWorld(baseline()), { mod });
    const l = finalLatest(w);
    expectOutcome(l, 'failed', 'a thrown planner');
    expectNames(l, 'plan', 'a thrown planner');
    expectZeroWrites(w, 'a thrown planner');
    expectExit(w, 1, 'a failed pass');
    assert(count(w, 'graph.close') >= 1, `the graph port should be closed when the planner fails (ADR step 5: "close it on every exit path"); calls: ${lastOps(w)}`);
  });
});

/* ══════════════════════════ snapshot conflicts (ADR step 8) ══════════════════════════ */

const conflictRows = () => [F.storedRowFor(T_CANON), F.storedRowFor(T_CANON, { rid: '5:fixture:conflict-b', toPubkey: CAROL })];

test('SR34: two snapshot rows at one address (a concurrent write) get no action and are counted in anomalies.snapshotConflicts; the schema is re-read, tags_address is still ONLINE, and the rest of the pass applies', async () => {
  const w = await runPass(makeWorld({ rows: conflictRows(), events: [T_NEW] }));
  const l = finalLatest(w);
  expectOutcome(l, 'done', 'a snapshot conflict with the rule ONLINE');
  const touched = writesOf(w).filter((e) => e.addresses.includes(addressOf(T_CANON)));
  assert(touched.length === 0, `no write may touch the conflicting address; got ${describeWrites(w)}`);
  sameSet(writtenAddresses(w, 'create'), [addressOf(T_NEW)], 'the rest of the pass still applies (one create)');
  assert(l.anomalies && l.anomalies.snapshotConflicts > 0, `anomalies.snapshotConflicts should count the conflict; got ${show(l.anomalies)}`);
  assert(count(w, 'graph.readSchema') >= 2, `a snapshot conflict makes the runner re-read the schema; readSchema calls: ${count(w, 'graph.readSchema')}`);
});

test('SR35: two snapshot rows at one address with tags_address no longer ONLINE on the re-read end the pass failed ("the one-per-tagging rule is not holding") with zero write calls', async () => {
  const w = await runPass(makeWorld({ rows: conflictRows(), events: [T_NEW], schemaAfterRead: { tags: 'missing' } }));
  const l = finalLatest(w);
  expectOutcome(l, 'failed', 'a snapshot conflict with the rule gone');
  assert(/one-per-tagging rule is not holding/i.test(show(l)), `the report should say "the one-per-tagging rule is not holding"; got reason ${show(l.reason)}, failure ${show(l.failure)}`);
  expectZeroWrites(w, 'the rule gone');
});

/* ══════════════════════════ applying the plan (AC-1, AC-2, AC-3, AC-5; ADR step 11) ══════════════════════════ */

test('SR36: a first run over an empty graph creates one relationship per accepted tagging — canonical stamp alone, local alone, both — counts the refused one, and added = taggingsRead − refused.total', async () => {
  const w = await runPass(makeWorld({ rows: [], events: [T_CANON, T_LOCAL, T_BOTH, T_REFUSED, ELEMENT] }));
  sameSet(writtenAddresses(w, 'create'), [T_CANON, T_LOCAL, T_BOTH].map(addressOf), 'addresses created');
  eq(writesOf(w).filter((e) => e.kind !== 'create').length, 0, `locked writes on a first run (writes: ${describeWrites(w)})`);
  eq(count(w, 'scan'), 1, 'relay scans');
  const l = finalLatest(w);
  expectOutcome(l, 'done', 'a first run');
  eq(rel(l).added, 3, 'relationships.added');
  eq(l.taggingsRead, 4, 'taggingsRead (events carrying a nostr-user-tag stamp)');
  eq(l.refused && l.refused.total, 1, 'refused.total');
  same(l.refused && l.refused.byReason, { 'no-target': 1 }, 'refused.byReason');
  eq(rel(l).added, l.taggingsRead - l.refused.total, 'added = taggingsRead − refused.total');
  expectExit(w, 0, 'a done pass');
});

test('SR37: a graph that already agrees with the relay gets zero write calls, and the report says nothing was added, changed or removed', async () => {
  const w = await runPass(makeWorld({ rows: rowsFor([T_CANON, T_LOCAL, T_BOTH]), events: [T_CANON, T_LOCAL, T_BOTH, T_REFUSED, ELEMENT] }));
  expectZeroWrites(w, 'relay and graph agree');
  const l = finalLatest(w);
  expectOutcome(l, 'done', 'agreement');
  const r = rel(l);
  same({ atStart: r.atStart, added: r.added, changed: r.changed, removed: r.removed, unchanged: r.unchanged },
    { atStart: 3, added: 0, changed: 0, removed: 0, unchanged: 3 }, 'relationships counts');
});

test('SR38: the pass applies creates, then updates, then moves, then removals — one of each here, the removal within the limit', async () => {
  const w = await runPass(makeWorld({ rows: rowsFor([T_UPD_V1, T_MOV_V1, T_GONE]), events: [T_NEW, T_UPD_V2, T_MOV_V2] }));
  same(writesOf(w).map((e) => e.kind), ['create', 'update', 'move', 'remove'], `write calls in order (got ${describeWrites(w)})`);
  sameSet(writtenAddresses(w, 'create'), [addressOf(T_NEW)], 'created');
  sameSet(writtenAddresses(w, 'update'), [addressOf(T_UPD_V2)], 'updated');
  sameSet(writtenAddresses(w, 'move'), [addressOf(T_MOV_V2)], 'moved');
  sameSet(writtenAddresses(w, 'remove'), [addressOf(T_GONE)], 'removed');
  const r = rel(finalLatest(w));
  same({ added: r.added, changed: r.changed, removed: r.removed }, { added: 1, changed: 2, removed: 1 }, 'relationships counts (a move is a change, not a removal)');
  expectOutcome(finalLatest(w), 'done', 'one of each');
});

test('SR39: no write call carries more than 250 rows — 600 creates go in three or more batches that together create all 600', async () => {
  const evs = F.manyTaggings(600, { prefix: 'batch' });
  const w = await runPass(makeWorld({ rows: [], events: evs }));
  const creates = writesOf(w).filter((e) => e.kind === 'create');
  assert(creates.length >= 3, `600 rows need at least three calls of ≤ 250; got ${describeWrites(w)}`);
  const big = creates.filter((e) => e.n > 250);
  assert(big.length === 0, `a write call carried more than 250 rows: ${big.map((e) => e.n).join(', ')}`);
  sameSet(writtenAddresses(w, 'create'), evs.map(addressOf), 'all 600 addresses created, once each');
  eq(rel(finalLatest(w)).added, 600, 'relationships.added');
});

test('SR40: removals over the limit are held — no removal call — while creates and moves still apply; the outcome is done-removals-held with held.total, byReason and digest, the held list is written for this run, and the exit code is 0', async () => {
  const gone = F.manyTaggings(60, { prefix: 'gone' });
  const w = await runPass(makeWorld({ rows: rowsFor(gone.concat([T_MOV_V1])), events: [T_NEW, T_MOV_V2] }));
  same(writesOf(w).map((e) => e.kind), ['create', 'move'], `write calls (no removal while held; got ${describeWrites(w)})`);
  const l = finalLatest(w);
  expectOutcome(l, 'done-removals-held', '60 removals over a base of 61');
  const expected = heldListFor(gone);
  eq(l.held && l.held.total, 60, 'held.total');
  same(l.held && l.held.byReason, { 'not-on-relay': 60 }, 'held.byReason');
  eq(l.held && l.held.digest, digestOf(expected), 'held.digest (sha256 over heldLines of the held list)');
  eq(rel(l).removed, 0, 'relationships.removed');
  eq(l.limit && l.limit.base, 61, 'limit.base (relationships at tagging addresses when the pass started)');
  const hw = w.log.filter((e) => e.op === 'state.writeHeld');
  eq(hw.length, 1, 'writeHeld calls');
  eq(hw[0].runId, EXPECTED_RUN_ID, 'writeHeld(runId, …) for this run');
  sameSet((hw[0].list || []).map((h) => `${h.address}|${h.seenEventId}|${h.reason}`), expected.map((h) => `${h.address}|${h.seenEventId}|${h.reason}`), 'the held list written: { address, seenEventId, reason }');
  assert(phaseNames(l).includes('graph-read'), `a pass that read the graph lists the graph-read phase (the confirmation rule looks for it); phases: ${show(phaseNames(l))}`);
  expectExit(w, 0, 'a pass whose removals were held');
});

/* ══════════════════════════ the owner's confirmation (AC-5; ADR "The owner's confirmation") ══════════════════════════ */

test('SR41: a valid confirmation is claimed and honoured — the pass removes the confirmed entries still due, reports them as confirmed (with those no longer due), and ends done', async () => {
  const s = heldScenario({ prefix: 'confirm' });
  const keep = s.evs.slice(0, 5); // the relay holds these five again: no longer due
  const w = await runPass(makeWorld({ files: s.files, rows: s.rows, events: keep }));
  sameSet(writtenAddresses(w, 'remove'), s.evs.slice(5).map(addressOf), 'removed: the 55 confirmed entries still due');
  eq(writesOf(w).filter((e) => e.kind !== 'remove').length, 0, `only removals (got ${describeWrites(w)})`);
  const l = finalLatest(w);
  expectOutcome(l, 'done', 'a confirmed run');
  same({ found: l.confirmation && l.confirmation.found, honoured: l.confirmation && l.confirmation.honoured }, { found: true, honoured: true }, 'confirmation');
  same(l.confirmed, { confirmedRunId: RUN_HELD, heldCount: 60, removalsApplied: 55, heldNoLongerDue: 5 }, 'confirmed');
  eq(rel(l).removed, 55, 'relationships.removed');
  eq(s.files.pending, null, 'the confirmation is spent (claimed)');
  const end = emitsOf(w).filter((e) => e.type === 'TASK_END').pop();
  assert(end && end.meta.confirmed, `TASK_END should say the run was confirmed; got ${show(end && end.meta)}`);
});

test('SR42: a confirmed run judges the removals it was not confirmed for against the graph left after the confirmed ones — 60 confirmed of 120 due: the 60 apply, the other 60 are held (600 > 120 − 60)', async () => {
  const all = F.manyTaggings(120, { prefix: 'mixed' });
  const list = heldListFor(all.slice(0, 60));
  const files = newFiles({ report: reportDoc(heldReport(RUN_HELD, list)), held: { [RUN_HELD]: list }, confirmation: confirmationFor(RUN_HELD, list) });
  const w = await runPass(makeWorld({ files, rows: rowsFor(all), events: [] }));
  sameSet(writtenAddresses(w, 'remove'), all.slice(0, 60).map(addressOf), 'removed: only the confirmed 60');
  const l = finalLatest(w);
  expectOutcome(l, 'done-removals-held', 'the others held');
  eq(l.held && l.held.total, 60, 'held.total');
  eq(l.confirmed && l.confirmed.removalsApplied, 60, 'confirmed.removalsApplied');
  eq(l.limit && l.limit.baseAfterConfirmed, 60, 'limit.baseAfterConfirmed (base − |C|)');
  const hw = w.log.filter((e) => e.op === 'state.writeHeld').pop();
  sameSet(((hw && hw.list) || []).map((h) => h.address), all.slice(60).map(addressOf), 'the new held list: the 60 unconfirmed removals');
});

/** A confirmation that is claimed but not honoured: the pass runs unconfirmed and holds again. */
async function expectNotHonoured(s, why) {
  const w = await runPass(makeWorld({ files: s.files, rows: s.rows, events: [] }));
  eq(count(w, 'state.claimConfirmation'), 1, `${why}: the record is still claimed (a claim is spent whatever happens after it)`);
  eq(s.files.pending, null, `${why}: the record is no longer pending`);
  const l = finalLatest(w);
  eq(l.confirmation && l.confirmation.found, true, `${why}: confirmation.found`);
  eq(l.confirmation && l.confirmation.honoured, false, `${why}: confirmation.honoured`);
  assert(l.confirmation && typeof l.confirmation.why === 'string' && l.confirmation.why.length > 0, `${why}: confirmation.why should say why; got ${show(l.confirmation)}`);
  eq(l.confirmed, null, `${why}: confirmed`);
  eq(writtenAddresses(w, 'remove').length, 0, `${why}: removals applied`);
  expectOutcome(l, 'done-removals-held', why);
  eq(l.held && l.held.total, 60, `${why}: held.total`);
}

test('SR43: an expired confirmation is claimed but not honoured — the pass runs unconfirmed and holds the removals again', async () => {
  const list = heldListFor(F.manyTaggings(60, { prefix: 'held' }));
  await expectNotHonoured(heldScenario({ confirmation: confirmationFor(RUN_HELD, list, { mintedAt: T0 - 25 * HOUR }) }), 'expired');
});

test('SR44: a confirmation whose held file no longer hashes to its heldDigest is not honoured', async () => {
  const list = heldListFor(F.manyTaggings(60, { prefix: 'held' }));
  await expectNotHonoured(heldScenario({ fileList: list.slice(1) }), 'digest mismatch');
});

test('SR45: a confirmation for a held report that is no longer the most recent graph-reading report (a later pass read the graph since) is not honoured', async () => {
  await expectNotHonoured(heldScenario({ latest: priorReport(RUN_LATER) }), 'report changed');
});

test('SR46: a refused start after the held report does not stand in its way — the most recent earlier report whose phases include graph-read is still the held one, so the confirmation is honoured', async () => {
  const s = heldScenario({ latest: refusedReport(RUN_REFUSED) });
  const w = await runPass(makeWorld({ files: s.files, rows: s.rows, events: [] }));
  const l = finalLatest(w);
  eq(l.confirmation && l.confirmation.honoured, true, `confirmation.honoured (confirmation: ${show(l.confirmation)})`);
  sameSet(writtenAddresses(w, 'remove'), s.list.map((h) => h.address), 'the confirmed held relationships are removed');
  expectOutcome(l, 'done', 'a confirmed run after a refused start');
});

test('SR47: with no pending confirmation, the pass records confirmation.found false and confirmed null, and holds removals over the limit', async () => {
  const s = heldScenario({ confirmation: null });
  const w = await runPass(makeWorld({ files: s.files, rows: s.rows, events: [] }));
  const l = finalLatest(w);
  eq(l.confirmation && l.confirmation.found, false, 'confirmation.found');
  eq(l.confirmed, null, 'confirmed');
  eq(writtenAddresses(w, 'remove').length, 0, 'removals applied');
  expectOutcome(l, 'done-removals-held', 'no confirmation');
});

/* ══════════════════════════ pre-images (ADR "The guard", step 1; owner decision 9) ══════════════════════════ */

test('SR48: before the transaction that changes or removes a relationship carrying keys outside the nine, the pass appends its pre-image { runId, address, rid, fromPubkey, toPubkey, props } — for those rows only — and the report counts them and names the dropped keys, never their values', async () => {
  const X = F.makeTagging({ d: 'pre-x', id: F.idOf('pre:x') });
  const Y = F.makeTagging({ d: 'pre-y', id: F.idOf('pre:y') });
  const Z1 = F.makeTagging({ d: 'pre-z', id: F.idOf('pre:z:v1'), createdAt: 900 });
  const Z2 = F.makeTagging({ d: 'pre-z', id: F.idOf('pre:z:v2'), createdAt: 1100 });
  const rowX = F.storedRowFor(X, { extra: { note: 'private-note-value' } });
  const rowY = F.storedRowFor(Y, { extra: { legacyScore: 7 } });
  const w = await runPass(makeWorld({ rows: [rowX, rowY, F.storedRowFor(Z1)], events: [X, Z2] }));
  const appends = w.log.filter((e) => e.op === 'state.appendPreimages');
  const records = appends.reduce((a, e) => a.concat(e.records || []), []);
  sameSet(records.map((r) => r && r.address), [addressOf(X), addressOf(Y)], 'pre-image records (only rows with a key outside the nine)');
  for (const e of appends) eq(e.runId, EXPECTED_RUN_ID, 'appendPreimages(runId, …)');
  const recX = records.find((r) => r && r.address === addressOf(X));
  same({ runId: recX.runId, rid: recX.rid, fromPubkey: recX.fromPubkey, toPubkey: recX.toPubkey },
    { runId: EXPECTED_RUN_ID, rid: rowX.rid, fromPubkey: ALICE, toPubkey: BOB }, 'the pre-image record for the updated edge');
  assert((recX.props || []).some((p) => show(p) === show(['note', 'STRING NOT NULL', 'private-note-value'])),
    `the pre-image keeps the extra key as [key, type, value]; props: ${show(recX.props)}`);
  const recY = records.find((r) => r && r.address === addressOf(Y));
  assert((recY.props || []).some((p) => show(p) === show(['legacyScore', 'INTEGER NOT NULL', '7'])),
    `the pre-image keeps an INTEGER extra key as its text; props: ${show(recY && recY.props)}`);
  for (const [a, label] of [[addressOf(X), 'update'], [addressOf(Y), 'remove']]) {
    const iAppend = w.log.findIndex((e) => e.op === 'state.appendPreimages' && (e.records || []).some((r) => r && r.address === a));
    const iWrite = w.log.findIndex((e) => e.op === 'graph.write' && e.addresses.includes(a));
    assert(iAppend >= 0 && iWrite > iAppend, `the pre-image of ${label} ${a} must be appended before its transaction (append at ${iAppend}, write at ${iWrite})`);
  }
  const r = rel(finalLatest(w));
  eq(r.preimagesWritten, 2, 'relationships.preimagesWritten');
  eq(r.preimageFile, `preimages/${EXPECTED_RUN_ID}.jsonl`, 'relationships.preimageFile (state-relative)');
  const stripped = show(r.strippedKeys);
  assert(stripped.includes('note'), `relationships.strippedKeys should name the dropped key "note"; got ${stripped}`);
  assert(!stripped.includes('private-note-value'), `relationships.strippedKeys must never carry a dropped value; got ${stripped}`);
});

test('SR49: a pre-image append that fails (ENOSPC) fails the pass ("write") before that batch — no transaction for it, nothing after — and failure.message carries err.code and the state-relative file name, never an absolute path or err.message', async () => {
  const X = F.makeTagging({ d: 'pre-fail', id: F.idOf('pre:fail') });
  const w = await runPass(makeWorld({ rows: [F.storedRowFor(X, { extra: { note: 'kept-value' } }), F.storedRowFor(T_GONE)], events: [X, T_NEW], failPreimage: true }));
  same(writesOf(w).map((e) => e.kind), ['create'], `write calls: the create batch commits first, then nothing (got ${describeWrites(w)})`);
  const l = finalLatest(w);
  expectOutcome(l, 'failed', 'a failed pre-image append');
  eq(l.failure && l.failure.stage, 'write', 'failure.stage');
  const msg = String(l.failure && l.failure.message);
  assert(msg.includes('ENOSPC'), `failure.message should carry err.code ENOSPC; got ${show(msg)}`);
  assert(msg.includes(`preimages/${EXPECTED_RUN_ID}.jsonl`), `failure.message should name the state-relative file preimages/${EXPECTED_RUN_ID}.jsonl; got ${show(msg)}`);
  assert(!msg.includes(FAKE_STATE_DIR) && !msg.includes('/var/lib'), `failure.message must carry no absolute path; got ${show(msg)}`);
  assert(!msg.includes('no space left on device'), `failure.message must not carry err.message; got ${show(msg)}`);
  eq(rel(l).added, 1, 'relationships.added (the committed create batch stands)');
  expectExit(w, 1, 'a failed pass');
});

/* ══════════════════════════ stops and partial writes (AC-7; ADR step 11, D9) ══════════════════════════ */

test('SR50: a SIGTERM or SIGINT during a write batch stops the pass at the next batch boundary — the batch in flight completes, no further write — and the report reads failed, stopped, reasonCode "signal"', async () => {
  await cases(['SIGTERM', 'SIGINT'].map((sig) => ({ name: sig, sig })), async (c) => {
    const evs = F.manyTaggings(600, { prefix: `stop-${c.sig}` });
    const w = await runPass(makeWorld({ rows: [], events: evs, onApply: ({ index, world }) => { if (index === 0) world.signals.fire(c.sig); } }));
    const writes = writesOf(w);
    assert(writes.length === 1, `the pass should stop after the batch in flight; it made ${describeWrites(w)} (handlers registered on deps.signals for ${c.sig}: ${w.signals.listenerCount(c.sig)})`);
    const l = finalLatest(w);
    expectOutcome(l, 'failed', `stopped by ${c.sig}`);
    eq(l.stopped, true, 'stopped');
    eq(l.reasonCode, 'signal', 'reasonCode');
    eq(rel(l).added, writes[0].n, 'relationships.added (the committed batch)');
    expectExit(w, 1, 'a stopped pass');
    assert(count(w, 'graph.close') >= 1 && lastIdx(w, 'graph.close') > lastIdx(w, 'graph.write'), `the graph port should be closed after a stop (ADR step 5: "every exit path"); calls: ${lastOps(w)}`);
  });
});

test('SR51: the report counts what the port says committed — applied, lostRace and nodesCreated summed over the calls — not what was planned', async () => {
  const evs = F.manyTaggings(300, { prefix: 'count' });
  const w = await runPass(makeWorld({
    rows: [], events: evs,
    onApply: ({ rows }) => ({ applied: rows.length - 1, lostRace: 1, nodesCreated: 2, transientRetries: 1, appliedAddresses: rows.slice(1).map(addrOf) }),
  }));
  const calls = writesOf(w).filter((e) => e.kind === 'create').length;
  assert(calls >= 2, `300 creates need at least two calls; got ${describeWrites(w)}`);
  const l = finalLatest(w);
  eq(rel(l).added, 300 - calls, 'relationships.added = Σ applied');
  eq(rel(l).lostRace && rel(l).lostRace.create, calls, 'relationships.lostRace.create = Σ lostRace');
  eq(l.peopleAdded, 2 * calls, 'peopleAdded = Σ nodesCreated');
});

test('SR52: a write batch that fails after an earlier batch committed ends the pass failed ("write"); the counts cover the committed batch only and nothing is written after', async () => {
  const evs = F.manyTaggings(600, { prefix: 'write-fail' });
  const w = await runPass(makeWorld({
    rows: [], events: evs,
    onApply: ({ index }) => { if (index === 1) throw neoError('Neo.DatabaseError.Transaction.TransactionCommitFailed', 'commit failed'); },
  }));
  const writes = writesOf(w);
  eq(writes.length, 2, `write calls (one committed, one failed, then none; got ${describeWrites(w)})`);
  const l = finalLatest(w);
  expectOutcome(l, 'failed', 'a failed write batch');
  eq(l.failure && l.failure.stage, 'write', 'failure.stage');
  eq(rel(l).added, writes[0].n, 'relationships.added (the committed batch only)');
  expectExit(w, 1, 'a failed pass');
  assert(count(w, 'graph.close') >= 1 && lastIdx(w, 'graph.close') > lastIdx(w, 'graph.write'), `the graph port should be closed after a failed write (ADR step 5: "every exit path"); calls: ${lastOps(w)}`);
});

test('SR53: a verify re-read that fails inside a later write transaction ends the pass failed, failure { stage "write", read "graph-verify" }, and the batches committed before it stand in the counts', async () => {
  const evs = F.manyTaggings(300, { prefix: 'verify' });
  const w = await runPass(makeWorld({
    rows: rowsFor(evs, { floatCreatedAt: true }), events: evs,
    onApply: ({ kind, kindIndex }) => {
      if (kind === 'update' && kindIndex === 1) throw Object.assign(neoError('Neo.TransientError.Transaction.Terminated', 'verify re-read failed'), { read: 'graph-verify' });
    },
  }));
  const updates = writesOf(w).filter((e) => e.kind === 'update');
  assert(updates.length === 2, `300 repairs need two update calls, the second failing; got ${describeWrites(w)}`);
  const l = finalLatest(w);
  expectOutcome(l, 'failed', 'a failed verify re-read');
  same({ stage: l.failure && l.failure.stage, read: l.failure && l.failure.read }, { stage: 'write', read: 'graph-verify' }, 'failure');
  eq(rel(l).changed, updates[0].n, 'relationships.changed (the committed batch)');
});

/* ══════════════════════════ exit codes ══════════════════════════ */

test('SR54: exit codes — 0 for done and for done-removals-held, 2 for refused, 1 for failed', async () => {
  await cases([
    { name: 'done', world: () => baseline(), code: 0, outcome: 'done' },
    { name: 'done-removals-held', world: () => ({ rows: rowsFor(F.manyTaggings(60, { prefix: 'exit' })), events: [] }), code: 0, outcome: 'done-removals-held' },
    { name: 'refused', world: () => baseline({ env: { TA_PUBKEY: 'nope' } }), code: 2, outcome: 'refused' },
    { name: 'failed', world: () => baseline({ scanError: makeScanError('timeout') }), code: 1, outcome: 'failed' },
  ], async (c) => {
    const w = await runPass(makeWorld(c.world()));
    expectOutcome(finalLatest(w), c.outcome, c.name);
    expectExit(w, c.code, c.name);
  });
});

/* ══════════════════════════ what the report attributes, and when it is written (AC-7; ADR "The report", D9) ══════════════════════════ */

test('SR55: the report counts only the rows the port says committed (appliedAddresses) — a lost update is not in changedBy, a lost removal not in removedBy — and counts the lost ones under lostRace', async () => {
  const U1v1 = F.makeTagging({ d: 'attr-u1', id: F.idOf('attr:u1:v1'), createdAt: 900 });
  const U1v2 = F.makeTagging({ d: 'attr-u1', id: F.idOf('attr:u1:v2'), createdAt: 1100, polarity: '-1' });
  const U2 = F.makeTagging({ d: 'attr-u2', id: F.idOf('attr:u2') });
  const R1 = F.makeTagging({ d: 'attr-r1', id: F.idOf('attr:r1') });
  const R2 = F.makeTagging({ d: 'attr-r2', id: F.idOf('attr:r2') });
  const R2non = F.makeNonTagging({ address: addressOf(R2), id: F.idOf('attr:r2:non'), createdAt: 2000 });
  const rows = [F.storedRowFor(U1v1), F.storedRowFor(U2, { floatCreatedAt: true }), F.storedRowFor(R1), F.storedRowFor(R2)];
  const lose = { update: addressOf(U2), remove: addressOf(R2) };
  const w = await runPass(makeWorld({
    rows, events: [U1v2, U2, R2non],
    onApply: ({ kind, rows: sent }) => {
      const addrs = sent.map(addrOf);
      const ok = addrs.filter((a) => a !== lose[kind]);
      return { applied: ok.length, lostRace: addrs.length - ok.length, nodesCreated: 0, transientRetries: 0, appliedAddresses: ok };
    },
  }));
  sameSet(writtenAddresses(w, 'update'), [addressOf(U1v2), addressOf(U2)], 'fixture: the two updates sent (U1 newer, U2 repaired)');
  sameSet(writtenAddresses(w, 'remove'), [addressOf(R1), addressOf(R2)], 'fixture: the two removals sent (R1 not-on-relay, R2 non-tagging)');
  const l = finalLatest(w);
  expectOutcome(l, 'done', 'lost races are not failures');
  const r = rel(l);
  const by = (m, k) => (isPlainObject(m) && typeof m[k] === 'number' ? m[k] : 0);
  same({ changed: r.changed, newer: by(r.changedBy, 'newer'), repaired: by(r.changedBy, 'repaired'), lostUpdate: by(r.lostRace, 'update') },
    { changed: 1, newer: 1, repaired: 0, lostUpdate: 1 }, 'relationships.changed / changedBy / lostRace.update (U2, the repair, lost its race)');
  same({ removed: r.removed, notOnRelay: by(r.removedBy, 'not-on-relay'), nonTagging: by(r.removedBy, 'non-tagging'), lostRemove: by(r.lostRace, 'remove') },
    { removed: 1, notOnRelay: 1, nonTagging: 0, lostRemove: 1 }, 'relationships.removed / removedBy / lostRace.remove (R2, the non-tagging, lost its race)');
});

test('SR56: the pass rewrites its record at each phase boundary and at least every 10 write batches, and every rewrite before the final report still reads failed, stopped, reasonCode "stopped", running — so a kill at any point leaves "failed — stopped"', async () => {
  const evs = F.manyTaggings(2750, { prefix: 'cadence' }); // eleven create calls of at most 250 rows
  const w = await runPass(makeWorld({ rows: [], events: evs }));
  expectOutcome(finalLatest(w), 'done', '2,750 creates');
  const reportsBetween = (a, b) => w.log.slice(a + 1, b).filter((e) => e.op === 'state.writeReport' && e.ok).length;
  const iRead = idx(w, 'graph.readAll:resolved');
  const iScan = idx(w, 'scan');
  const iWrite = idx(w, 'graph.write');
  assert(iRead >= 0 && iScan > iRead && iWrite > iScan, `fixture: expected read, scan, then writes; calls: ${lastOps(w, 30)}`);
  assert(reportsBetween(iRead, iScan) >= 1, 'the record should be rewritten at the graph-read → relay-read boundary (between the graph read and the scan)');
  assert(reportsBetween(iScan, iWrite) >= 1, 'the record should be rewritten between the relay read and the first write (the relay-read, plan and write-creates boundaries)');
  const writes = writesOf(w).length;
  assert(writes >= 11, `fixture: 2,750 creates need at least eleven write calls; got ${describeWrites(w)}`);
  let streak = 0;
  let worst = 0;
  for (const e of w.log) {
    if (e.op === 'graph.write') { streak++; worst = Math.max(worst, streak); } else if (e.op === 'state.writeReport' && e.ok) streak = 0;
  }
  assert(worst <= 10, `the record should be rewritten at least every 10 write batches; ${worst} write calls ran in a row without a rewrite`);
  const docs = reportDocsOf(w);
  const between = docs.slice(1, -1); // the first is the pessimistic record (SR8), the last the final report
  assert(between.length >= 3, `expected several rewrites between the pessimistic record and the final report; got ${between.length}`);
  const bad = between.map(latestOf).filter((x) => !(x && x.runId === EXPECTED_RUN_ID && x.outcome === 'failed' && x.stopped === true && x.reasonCode === 'stopped' && x.running === true));
  assert(bad.length === 0, `every rewrite before the final report must still read { runId, outcome: 'failed', stopped: true, reasonCode: 'stopped', running: true } (ADR D9 (c)); ${bad.length} did not, e.g. ${show(bad[0] && { runId: bad[0].runId, outcome: bad[0].outcome, stopped: bad[0].stopped, reasonCode: bad[0].reasonCode, running: bad[0].running })}`);
});

const PHASES = ['identities', 'schema', 'graph-read', 'relay-read', 'plan', 'write-creates', 'write-updates', 'write-moves', 'write-removals'];

test('SR57: a done pass emits one PROGRESS per phase — identities, schema, graph-read, relay-read, plan, write-creates, write-updates, write-moves, write-removals, in that order — each naming its phase with its ms, and the report\'s phases list the same', async () => {
  const w = await runPass(makeWorld({ rows: rowsFor([T_UPD_V1, T_MOV_V1, T_GONE]), events: [T_NEW, T_UPD_V2, T_MOV_V2] }));
  const types = emitsOf(w).map((e) => e.type);
  const progress = emitsOf(w).filter((e) => e.type === 'PROGRESS');
  same(progress.map((e) => e.meta.phase), PHASES, `PROGRESS events by metadata.phase, in order (all events: ${show(types)})`);
  const noMs = progress.filter((e) => typeof e.meta.ms !== 'number' || !(e.meta.ms >= 0)).map((e) => e.meta.phase);
  assert(noMs.length === 0, `each PROGRESS should carry its phase's ms (a number ≥ 0); missing on ${show(noMs)}`);
  assert(types.indexOf('PROGRESS') > types.indexOf('TASK_START') && types.lastIndexOf('PROGRESS') < types.lastIndexOf('TASK_END'), `PROGRESS events come between TASK_START and TASK_END; events: ${show(types)}`);
  const l = finalLatest(w);
  same(phaseNames(l), PHASES, 'the report\'s phases[].phase, in order');
  const odd = (l.phases || []).filter((p) => typeof p.ms !== 'number');
  assert(odd.length === 0, `each report phase carries its ms; got ${show(odd)}`);
});

test('SR58: the report\'s write phases give their batches and the transient retries the port reported — 600 creates in three calls, one retry each, read write-creates { batches: 3, transientRetries: 3 }', async () => {
  const evs = F.manyTaggings(600, { prefix: 'phase-batches' });
  const w = await runPass(makeWorld({
    rows: [], events: evs,
    onApply: ({ rows }) => ({ applied: rows.length, lostRace: 0, nodesCreated: 0, transientRetries: 1, appliedAddresses: rows.map(addrOf) }),
  }));
  const calls = writesOf(w).filter((e) => e.kind === 'create').length;
  assert(calls >= 3, `fixture: 600 creates need at least three calls; got ${describeWrites(w)}`);
  const p = ((finalLatest(w).phases) || []).find((x) => x && x.phase === 'write-creates');
  assert(p, `the report should list a write-creates phase; phases: ${show(phaseNames(finalLatest(w)))}`);
  same({ batches: p.batches, transientRetries: p.transientRetries }, { batches: calls, transientRetries: calls }, 'phases[write-creates] { batches, transientRetries } (ADR "The report": phases [{ phase, ms, batches, transientRetries }])');
});

test('SR59: the pass hands each read and write its time-out — the relay scan 60 s with an isExpected that takes kind 39999 carrying one of the four stamps and nothing else; every write call 60 s', async () => {
  const w = await runPass(makeWorld({ rows: rowsFor([T_UPD_V1, T_MOV_V1, T_GONE]), events: [T_NEW, T_UPD_V2, T_MOV_V2] }));
  const sc = w.log.find((e) => e.op === 'scan');
  eq(sc && sc.timeoutMs, 60000, 'scan(filter, { timeoutMs }) — the relay scan\'s 60 s (ADR "Lock class, time-outs, sizes")');
  assert(sc && typeof sc.isExpected === 'function', `scan(filter, { isExpected }) should get the predicate (ADR: "every event passes isExpected — kind 39999 and a z among the requested stamps"); opts keys: ${show(sc && sc.optKeys)}`);
  const elLocal = F.makeElement({ id: F.idOf('sr59:el-local'), d: 'musician', stamps: [TAG_STAMP(LOCAL)] });
  const judged = [
    ['a canonical-stamped tagging', T_CANON, true],
    ['a local-stamped tagging', T_LOCAL, true],
    ['a canonical :tag element', ELEMENT, true],
    ['a local :tag element', elLocal, true],
    ['a kind-5 deletion', F.makeDeletion({ e: [T_CANON.id] }), false],
    ['a tagging carrying only another deployment\'s stamp', F.makeTagging({ d: 'sr59-other', id: F.idOf('sr59:other'), stamps: [STAMP(OTHER_DEPLOY)] }), false],
    ['a canonical-stamped event of another kind', Object.assign({}, T_CANON, { kind: 30000 }), false],
    ['an event with no z stamp', F.makeTagging({ d: 'sr59-none', id: F.idOf('sr59:none'), stamps: [] }), false],
  ];
  const wrong = judged.filter(([, ev, want]) => { let got; try { got = !!sc.isExpected(clone(ev)); } catch (_) { got = 'threw'; } return got !== want; }).map(([what, , want]) => `${what}: expected ${want}`);
  assert(wrong.length === 0, `the scan's isExpected judged wrongly:\n        ${wrong.join('\n        ')}`);
  const slow = writesOf(w).filter((e) => e.timeoutMs !== 60000).map((e) => `${e.kind}: ${show(e.timeoutMs)}`);
  assert(writesOf(w).length === 4 && slow.length === 0, `every write call should pass { timeoutMs: 60000 } (ADR: "each write transaction 60 s"); got ${show(slow)} over ${describeWrites(w)}`);
});

test('SR60: the rows of each create and update write call come sorted by (from, to) — the tagger\'s pubkey, then the tagged person\'s', async () => {
  const taggers = [F.pubkeyOf('sort-a'), F.pubkeyOf('sort-b'), F.pubkeyOf('sort-c'), ALICE];
  const targets = [F.pubkeyOf('sort-x'), F.pubkeyOf('sort-y'), BOB, CAROL];
  // Each tagger tags every target, and neither the address order nor the event order follows (from, to).
  const fresh = F.manyTaggings(300, { prefix: 'sort-new', over: (i) => ({ author: taggers[i % 4], target: targets[(Math.floor(i / 4) * 3) % 4] }) });
  const kept = F.manyTaggings(300, { prefix: 'sort-upd', over: (i) => ({ author: taggers[(i + 1) % 4], target: targets[(Math.floor(i / 4) * 3 + 1) % 4] }) });
  const targetOf = (ev) => ev.tags.find((t) => t[0] === 'p')[1];
  const ends = new Map(fresh.concat(kept).map((ev) => [addressOf(ev), `${ev.pubkey}\u0000${targetOf(ev)}`]));
  const w = await runPass(makeWorld({ rows: rowsFor(kept, { floatCreatedAt: true }), events: fresh.concat(kept) }));
  const problems = [];
  for (const e of writesOf(w).filter((x) => x.kind === 'create' || x.kind === 'update')) {
    const keys = e.addresses.map((a) => ends.get(a));
    for (let i = 1; i < keys.length; i++) {
      if (keys[i - 1] > keys[i]) { problems.push(`${e.kind} call ${e.kindIndex + 1}: row ${i} (${keys[i - 1].slice(0, 8)}…→${keys[i - 1].slice(65, 73)}…) comes before row ${i + 1} (${keys[i].slice(0, 8)}…→${keys[i].slice(65, 73)}…)`); break; }
    }
  }
  assert(writesOf(w).filter((x) => x.kind === 'create').length >= 2 && writesOf(w).filter((x) => x.kind === 'update').length >= 2, `fixture: expected creates and updates over several calls; got ${describeWrites(w)}`);
  assert(problems.length === 0, `rows must be sorted by (from, to) within each write transaction (ADR "Lock class, time-outs, sizes"):\n        ${problems.join('\n        ')}`);
});

test('SR61: the report gives reads.graph { rows, ms }, reads.relay { events, bytes, ms }, tagElementsRead, relationships.unresolved and anomalies.sameAddressConflicts from what this pass read', async () => {
  const T_UNRES_NEW = F.makeTagging({ d: 'sr61-unres-new', id: F.idOf('sr61:unres-new'), a: null, e: F.idOf('sr61:absent-1') });
  const T_UNRES_KEPT = F.makeTagging({ d: 'sr61-unres-kept', id: F.idOf('sr61:unres-kept'), a: null, e: F.idOf('sr61:absent-2') });
  const T_BY_ID = F.makeTagging({ d: 'sr61-by-id', id: F.idOf('sr61:by-id'), a: null, e: F.TAG_V1 }); // resolves against ELEMENT
  const EL_LOCAL = F.makeElement({ id: F.idOf('sr61:el-local'), d: 'musician', stamps: [TAG_STAMP(LOCAL)] });
  const DUP_1 = F.makeTagging({ d: 'sr61-dup', id: F.idOf('sr61:dup:1'), createdAt: 900 });
  const DUP_2 = F.makeTagging({ d: 'sr61-dup', id: F.idOf('sr61:dup:2'), createdAt: 1100 });
  const rows = rowsFor([T_CANON, T_UNRES_KEPT, DUP_1]);
  const events = [T_CANON, T_UNRES_NEW, T_UNRES_KEPT, T_BY_ID, ELEMENT, EL_LOCAL, DUP_1, DUP_2];
  const w = await runPass(makeWorld({ rows, events }));
  const l = finalLatest(w);
  expectOutcome(l, 'done', 'the SR61 world');
  sameSet(writtenAddresses(w, 'create'), [T_UNRES_NEW, T_BY_ID].map(addressOf), 'fixture: the two creates (one unresolved, one resolved by id)');
  eq(writesOf(w).filter((e) => e.addresses.includes(addressOf(DUP_1))).length, 0, 'write calls at the address the scan holds two versions of');
  eq(l.anomalies && l.anomalies.sameAddressConflicts, 1, 'anomalies.sameAddressConflicts (two scanned versions at one address)');
  eq(l.tagElementsRead, 2, 'tagElementsRead (scanned events carrying a :tag stamp: the canonical and the local element)');
  eq(rel(l).unresolved, 2, 'relationships.unresolved (tagAddress null afterwards: the id-only tagging created unresolved, and the one left unresolved; the one resolved by id is not)');
  const reads = l.reads || {};
  const scanned = w.log.find((e) => e.op === 'scan');
  same({ graphRows: reads.graph && reads.graph.rows, relayEvents: reads.relay && reads.relay.events, relayBytes: reads.relay && reads.relay.bytes },
    { graphRows: rows.length, relayEvents: events.length, relayBytes: scanned.bytes }, 'reads.graph.rows / reads.relay.events / reads.relay.bytes');
  assert(typeof (reads.graph && reads.graph.ms) === 'number' && typeof (reads.relay && reads.relay.ms) === 'number', `reads.graph.ms and reads.relay.ms should be numbers; got ${show(reads)}`);
});

test('SR62: relationships.strippedKeys names the dropped keys, never their values, for at most 100 edges — 120 edges each dropping "note" give 100 entries — while preimagesWritten counts all 120', async () => {
  const evs = F.manyTaggings(120, { prefix: 'strip' });
  const w = await runPass(makeWorld({ rows: evs.map((ev) => F.storedRowFor(ev, { extra: { note: 'dropped-value-7c1e' } })), events: evs }));
  const r = rel(finalLatest(w));
  eq(r.changed, 120, 'relationships.changed (each edge repaired, its extra key dropped)');
  eq(r.preimagesWritten, 120, 'relationships.preimagesWritten');
  assert(Array.isArray(r.strippedKeys) && r.strippedKeys.length === 100, `relationships.strippedKeys should list 100 edges (at most 100; 120 dropped a key); got ${Array.isArray(r.strippedKeys) ? r.strippedKeys.length : show(r.strippedKeys)}`);
  const text = show(r.strippedKeys);
  assert(text.includes('note') && !text.includes('dropped-value-7c1e'), `strippedKeys names the key "note" and never its value; got ${text.slice(0, 200)}…`);
});

async function run() {
  console.log('\n--- tagging-edges runner tests (epic tagging-edges, Story 2 — the gap-filling pass, fake ports) ---');
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  PASS  ${name}`); pass++; }
    catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failures.push({ name, message: err.message }); fail++; }
  }
  console.log(`\ntagging-edges-runner: ${pass} passed, ${fail} failed, 0 skipped`);
  return { pass, fail, skipped: 0, failures };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
