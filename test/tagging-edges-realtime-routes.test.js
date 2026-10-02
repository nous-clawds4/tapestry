'use strict';
/**
 * Tests for Story 3 (epic tagging-edges) — the real-time path's durable store and its two routes.
 *
 * Story: engineering-team/stories/tagging-edges/3-real-time-path.md — AC-4 (the record of where the path left off; a
 *        lost record is never a first start), AC-5 (off by default; the owner-only switch; "any session that is not
 *        the owner's is refused and changes nothing"; the choice survives restarts; off within the ADR's bound), AC-6
 *        (the owner reads the status on the instance, at most a minute stale, never a credential or an address;
 *        separate from the pass's report), and "For Test Design → The switch and status" and "Bypass probing" (AC-5's
 *        switch).
 * ADR:   engineering-team/decisions/tagging-edges/0003-real-time-path.md — § "Knowing what changed while it was away"
 *        (the state-file table and the journal rules), § "Status and switch (D8-A)", Implementation notes (store.js;
 *        src/api/tagging-edges/realtime.js; "Tests the Tester owns → The routes"), and the Test Design
 *        clarifications T21 and T26 (the store), T22 and T27 (the routes module), T25 (the record's shapes), T29
 *        (what status.json carries, and what the route derives), T32 (status.json's process and runningSince; a missing
 *        status.json) and T33 (ISO times; when statusUnreadable is present). Bindings: ADR 0002's routes module
 *        (src/api/tagging-edges/index.js: withDeps, sameHost, isJson and the confirm route's owner check, :230-242)
 *        and state.writeAtomic (src/pipeline/tagging-edges/state.js).
 *
 * Intentionally failing until the implementation lands (red phase): src/pipeline/tagging-edges/realtime/store.js and
 * src/api/tagging-edges/realtime.js do not exist yet. Each is require()d LAZILY inside every test (afresh, so a default
 * read of TAGGING_EDGES_STATE_DIR sees that test's directory) through load helpers that say what is missing, so this
 * suite always loads and every test fails naming the missing module.
 *
 * Classes:
 *   RS — the store, createStore({ dir }) (T21), against a real temp directory under os.tmpdir(), removed afterwards.
 *        T21 gives the store no injection seam, so atomicity and fsync are observed from outside: a short-lived wrapper
 *        around fs, fs.promises and FileHandle records opens, fsyncs, truncations and renames under the temp
 *        directory (and can make a rename onto one named file fail), active only for the call under test (the store
 *        is loaded inside that window too, so a destructured fs reference is still seen) and restored in `finally`.
 *   RR — the routes module (T22): the pure computeRealtimeStatus and validateSwitch; handleRealtimeStatus and
 *        handleRealtimeSwitch called directly with a fake req/res and injected deps that record every call. RR23 alone
 *        runs the handlers on their default deps (Express passes `next` as the third argument) against a temp
 *        TAGGING_EDGES_STATE_DIR, so the store's switch.json is what the status route then reads. RR26 reads the
 *        module's source (comments dropped) for where allowErrorCode comes from.
 *
 * Hermetic: temp directories only, removed afterwards; env restored; no graph, relay, network, task queue, signal or
 * host /proc (RR21 serves /proc/<pid>/stat through the injected readFile). Fake 64-hex pubkeys only (never a
 * deployment's TA, never the ADR 0015 literal). Principle 4: nothing here touches the local graph or relay.
 *
 * What T26 / T27 / T32 / T33 fix, and this suite pins:
 *   - Store methods are synchronous (T26): RS22 checks no method returns a promise. Every other call is still
 *     awaited ("awaiting works").
 *   - openJournal().lines (T21's Iterable<string>) yields the journal's complete lines WITHOUT their trailing newline,
 *     with no empty item after the last one (T26): an item carrying "\n" fails. A missing journal.jsonl gives
 *     { lines: [] }, never unreadable (T26; RS24).
 *   - switch.json's canonical form (T26): compact JSON, keys in the order version, on, changedAt, changedBy, so the
 *     text is exactly JSON.stringify({ version, on, changedAt, changedBy }). One trailing "\n" is tolerated (T26 does
 *     not say either way).
 *   - readSwitch gives { unreadable: true } unless switch.json parses to an object whose on is a boolean (T26; RS5).
 *   - record.json's sha256 (T26) is lower-case hex SHA-256 over the UTF-8 of JSON.stringify of the record without
 *     sha256, object keys sorted recursively (default JS string order; arrays keep their order). RS8 computes it and
 *     compares exactly; RS23 has readRecord verify it over the parsed value, not the file's bytes.
 *   - readStarted() and readStatus() give null for a missing file (T26).
 *   - The record's pending / rechecks / parked entries have T25's shapes (the store treats them as opaque).
 *   - The routes (T27): a failed off-write unlinks and answers 200 { success: true, on: false }, 500 when the unlink
 *     fails too; a failed on-write answers 500 and unlinks nothing; state 'off' whenever the switch is off; onSince
 *     null when off; runningSince null when not alive; stale when alive with updatedAt missing, unparseable or older
 *     than 60 s; allowErrorCode re-applied to lastError.code and the dbRefused.byReason keys; a status.json that
 *     cannot be read or parsed answers 200 with the switch fields, running and statusUnreadable: true; the owner's
 *     pubkey on a session whose authenticated !== true (absent included) answers 403; the default writeSwitch is the
 *     store's; the routes module requires allowErrorCode from src/lib/tagging-edges/realtime.js (RR26, static).
 *   - runningSince (T32, T27): status.json's process.startedAt while alive, null when not. RR4, RR6, RR18 and RR21 pin
 *     the value, a stored runningSince is ignored, and RR7 allows the answer no text (runningSince included) beyond
 *     what status.json and the switch hold. RR18 compares the handler's body with computeRealtimeStatus's whole.
 *   - Times (T33): every time field the answer carries is an ISO string, or null where the field is unset (RR27).
 *   - statusUnreadable (T33, T32): present, as true, only when status.json cannot be read — a good read and a MISSING
 *     status.json (the path never ran) answer without it (RR7, RR18–RR22).
 *
 * Choices this suite makes where T21–T31 leave a detail open (recorded for the owner in the Test Design return):
 *   - appendJournal takes lines as journalLine (T19) makes them, each ending in "\n".
 *   - status.json fixtures hold only what T29 says it carries, with process in T32's shape { pid, startTime,
 *     startedAt } — startedAt an ISO time no other fixture field holds, so runningSince's value shows its source.
 *   - statusUnreadable "absent" is judged as on the wire: a member whose value is undefined counts as absent;
 *     statusUnreadable: false does not.
 *   - A status.json naming no process.startedAt (an empty status) gives an alive answer a runningSince that carries no
 *     time: null or undefined (RR4). T32 names only process.startedAt as its source.
 *   - The status route's switchUnreadable follows readSwitch's rule (T26): a switch.json that parses but whose on is
 *     not a boolean ("on":"true", 1, no on, null, an array) is unreadable there too (RR20).
 *   - A status.json that cannot be read names no process to ask about, so its answer says running: false (RR22).
 *   - RR24 uses one refused key per row. Two or more dbRefused.byReason keys that all become 'error' have their counts
 *     summed (T32 settled what T27 left open); RR28 pins it, from computeRealtimeStatus and GET status alike.
 *   - Route deps are T22's: readFile (fs.readFileSync-shaped — returns the text or throws ENOENT; RR18 also runs an
 *     fs.promises-shaped one), stateDir, isAlive, now (ms), getOwnerPubkey (or ownerPubkey as a string, as in
 *     withDeps), writeSwitch, unlinkSwitch. Story 2's queue and admin helpers are also handed in, as spies, to show
 *     none is used. process.kill is replaced by a recorder while the switch handler runs ("It sends no signal").
 *   - An answer "carries" a leak when its JSON holds an absolute path that starts a word, a URI, the full owner
 *     pubkey (either case), the state directory, or one of the address needles below.
 *
 * Story 5 (engineering-team/stories/tagging-edges/5-real-time-path-switch.md — AC-3, AC-4, AC-5) and ADR
 * engineering-team/decisions/tagging-edges/0005-real-time-path-switch.md (D1, D4, D5, D7, D11, and D2 where an answer
 * depends on it; "Seams for Test Design": the store, computeRealtimeStatus, the handler's dependencies) extend this
 * suite:
 *   - RS25–RS31, with RS2, RS19, RS21 and RS22 extended: switch.json version 2 ({ version, on, changedAt, changedBy,
 *     role, onSince }, in that key order), EBADSWITCH for a version 2 record without a valid role, parseSwitch's
 *     version / role / onSince, readError beside unreadable, switch-history.json's methods (readSwitchHistory,
 *     writeSwitchHistory, parseSwitchHistory), and the modes: files 0600 inside a 0700 realtime/ the store makes (RS31).
 *   - RR29–RR31, with RR2 and RR27 extended: inStartWindow (D7), onSince as the last off-to-on time (D4), and the public
 *     status gaining exactly inStartWindow and no "who" (D6).
 *   - RR32: AC-5's "It lasts", end to end on the default dependencies (identity lookups only) under a temporary
 *     TAGGING_EDGES_STATE_DIR — two POSTs, then handleRealtimeSwitchRecord on its default readFile and stateDir, then a
 *     fresh require and a fresh createStore({}). RR33: withDeps' record defaults follow an injected stateDir(), with
 *     TAGGING_EDGES_STATE_DIR pointed at a decoy that must stay empty.
 *   - statusBundle (every GET status test) also injects the store-backed dependencies the status route could take
 *     (readSwitch, readSwitchHistory, writeSwitchHistory, readStatus) as sentinels that record their call and throw
 *     "the status route reads through the injected readFile (ADR 0005 D6; T32)"; callStatus fails on any such call,
 *     so a route reading through the store fails loudly instead of reading FAKE_ROOT, the production directory.
 *   - Revised by design (ADR 0005 Consequences), IDs kept: RR10 (an admin is admitted), RR15 (the version 2 record, the
 *     fold, and the answer's recorded), RR23 (version 2 bytes and the history file on the default deps). RR16 and RR17
 *     keep their rows and gain story-5 rows (recorded: false, code, unlinkCode).
 *   - switchBundle injects readSwitch (default: missing), readSwitchHistory (default: missing) and writeSwitchHistory (a
 *     spy; default: succeeds) beside writeSwitch and unlinkSwitch, so no POST test reaches FAKE_ROOT's real store (ADR
 *     0005 Seams: FAKE_ROOT is the production state directory). calls.order keeps story 3's switch writes only;
 *     calls.seq records every record dependency in call order. RR23 and RR32 alone run every default, under a
 *     temporary TAGGING_EDGES_STATE_DIR; RR33 runs the record defaults under an injected temporary stateDir().
 *   Choices where ADR 0005 leaves a detail open (recorded for the owner in the Test Design return):
 *   - parseSwitchHistory may be store.js's export (as parseSwitch is) or the store's own method.
 *   - A read error is produced by a directory in the file's place; its code is the platform's (EISDIR here).
 *   - "No readError" means the member is absent or null.
 *   - A running process whose runningSince is missing or unparseable is not shown to have started for this "on", so
 *     inStartWindow stays true within the window (D7: "not both running and started at or after onSince").
 *   - A 500's body is pinned by success, its error sentence, code and unlinkCode, not as a whole; a 200's is exact.
 *   - The fold (D2 step 5) is pinned as the LAST history write after writeSwitch; a pre-fold before it may hold only
 *     changes already made (never the new one).
 *
 * Hand-rolled in the project's existing test style — no new framework. Works on Node 16 and 22.
 */

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { fileURLToPath } = require('url');
const F = require('./helpers/taggingEdgesFixtures');

const REPO = path.resolve(__dirname, '..');
const STORE_REL = 'src/pipeline/tagging-edges/realtime/store.js';
const ROUTES_REL = 'src/api/tagging-edges/realtime.js';
const STORE_MOD = path.join(REPO, STORE_REL);
const ROUTES_MOD = path.join(REPO, ROUTES_REL);
const STATE_MOD = path.join(REPO, 'src/pipeline/tagging-edges/state.js');
/** Where allowErrorCode lives (T2, T27). */
const REALTIME_LIB_MOD = path.join(REPO, 'src/lib/tagging-edges/realtime.js');
/**
 * Forgotten before every load, so env read at load or call time is this test's, and no module outlives a fs window.
 * strfryScanStrict.js re-exports realtime.js's escapeFilterArgv (T1: "the one escape"), so it is forgotten with it:
 * otherwise a later suite in the same process gets a stale strfryScanStrict holding an older copy's function
 * (SS36 and RP5 then fail; story 3's review, round 3, carry-forward C9).
 */
const FORGET = [
  STORE_MOD,
  ROUTES_MOD,
  STATE_MOD,
  path.join(REPO, 'src/api/tagging-edges/index.js'),
  REALTIME_LIB_MOD,
  path.join(REPO, 'src/lib/strfryScanStrict.js'),
];

const { CANONICAL, LOCAL, ALICE, BOB, CAROL, ADDRESS, idOf, pubkeyOf } = F;
const OWNER = pubkeyOf('owner');
const ADMIN = pubkeyOf('admin');
const STRANGER = pubkeyOf('stranger');
const HOST = 'tapestry.example';
/** Where the fake reads claim to live: the production path, so a leaked absolute path is recognisable. */
const FAKE_ROOT = '/var/lib/brainstorm/tagging-edges';
const SWITCH_FILE = path.join(FAKE_ROOT, 'realtime', 'switch.json');
const STATUS_FILE = path.join(FAKE_ROOT, 'realtime', 'status.json');
const PID = 4242;
const START_TIME = '987654';
const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const T0 = Date.UTC(2026, 8, 28, 12, 0, 0); // 2026-09-28T12:00:00Z
/** status.json's process.startedAt (T32): an ISO time no other fixture field holds, so runningSince's source shows. */
const PROCESS_STARTED_AT = new Date(T0 - 97 * MIN).toISOString();
const STATES = ['off', 'starting', 'waiting-setup', 'waiting-graph', 'waiting-relay', 'catching-up', 'live', 'stopped'];
const STORE_METHODS = [
  'readSwitch', 'writeSwitch', 'unlinkSwitch', 'readStarted', 'writeStarted', 'readRecord', 'writeRecord',
  'openJournal', 'appendJournal', 'truncateJournal', 'journalBytes', 'readStatus', 'writeStatus',
];
/** Story 5's store methods (ADR 0005 D1). */
const HISTORY_METHODS = ['readSwitchHistory', 'writeSwitchHistory'];
const ROUTE_EXPORTS = ['computeRealtimeStatus', 'validateSwitch', 'handleRealtimeStatus', 'handleRealtimeSwitch'];
const JOURNAL = 'journal.jsonl';
const REL_JOURNAL = `realtime/${JOURNAL}`;
/** Address text an answer must never carry (AC-6: "a URI, a host name, an IP address or a port"). */
const ADDRESS_NEEDLES = ['neo4j.internal', ':7687', ':7777', '[::1]', '127.0.0.1', 'redis:6379', 'bolt://', 'ws://'];
const ODD_CODE = 'neo4j.internal:7687';

// ─── test harness ──────────────────────────────────────────────────────────────────────────────────────────────
const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v instanceof Map) return { '<Map>': [...v.entries()].map(([k, x]) => [k, sortKeys(x)]) };
  if (v instanceof Set) return { '<Set>': [...v].map(sortKeys) };
  if (v && typeof v === 'object' && !Buffer.isBuffer(v)) return Object.keys(v).sort().reduce((o, k) => { o[k] = sortKeys(v[k]); return o; }, {});
  return v;
}
/** JSON with sorted keys; long strings shortened. */
function show(v) {
  if (v === undefined) return 'undefined';
  if (Buffer.isBuffer(v)) return `<${v.length} bytes: ${JSON.stringify(v.toString('utf8'))}>`;
  try {
    return JSON.stringify(sortKeys(v), (k, x) => {
      if (typeof x === 'bigint') return `${x}n`;
      if (typeof x === 'number' && !Number.isFinite(x)) return String(x);
      if (typeof x === 'string' && x.length > 160) return `${x.slice(0, 40)}…(${Buffer.byteLength(x, 'utf8')} bytes)`;
      return x;
    });
  } catch (_) {
    return String(v);
  }
}
/** Exact JSON with sorted keys (undefined members dropped, as on the wire). */
function exact(v) { return JSON.stringify(sortKeys(v)); }
function eq(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}\n        expected: ${show(expected)}\n        actual:   ${show(actual)}`);
}
function same(actual, expected, label) {
  if (exact(actual) !== exact(expected)) throw new Error(`${label}\n        expected: ${show(expected)}\n        actual:   ${show(actual)}`);
}
const firstLine = (e) => String((e && e.message) || e).split('\n')[0];
const isThenable = (v) => !!v && (typeof v === 'object' || typeof v === 'function') && typeof v.then === 'function';
/** Plain JSON with object keys sorted recursively (default JS string order); arrays keep their order (T26). */
function sortedDeep(v) {
  if (Array.isArray(v)) return v.map(sortedDeep);
  if (v && typeof v === 'object') return Object.keys(v).sort().reduce((o, k) => { o[k] = sortedDeep(v[k]); return o; }, {});
  return v;
}
/** T26: record.json's sha256 — lower-case hex SHA-256 over the UTF-8 of JSON.stringify(record without sha256, keys sorted recursively). */
function recordSha(record) {
  const body = { ...(record || {}) };
  delete body.sha256;
  return crypto.createHash('sha256').update(JSON.stringify(sortedDeep(body)), 'utf8').digest('hex');
}
/** JS source with comments removed (string contents kept), as test/tagging-edges-wiring.test.js reads source. */
function jsCodeOnly(src) {
  let out = '';
  let i = 0;
  let q = null;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (q) {
      out += c;
      if (c === '\\') { out += n || ''; i += 2; continue; }
      if (c === q) q = null;
      i += 1;
      continue;
    }
    if (c === '/' && n === '*') { const end = src.indexOf('*/', i + 2); i = end < 0 ? src.length : end + 2; out += ' '; continue; }
    if (c === '/' && n === '/') { const end = src.indexOf('\n', i); i = end < 0 ? src.length : end; continue; }
    if (c === '\'' || c === '"' || c === '`') q = c;
    out += c;
    i += 1;
  }
  return out;
}
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const iso = (ms) => new Date(ms).toISOString();
const has = (o, k) => !!o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k);
const pick = (o, keys) => keys.reduce((out, k) => { if (has(o, k)) out[k] = o[k]; return out; }, {});
function around(s, at) { return show(`${at > 60 ? '…' : ''}${s.slice(Math.max(0, at - 60), at + 60)}${at + 60 < s.length ? '…' : ''}`); }

/** Run several cases; report every failing one, not only the first. */
async function cases(list, fn) {
  const failed = [];
  for (const c of list) {
    try { await fn(c); } catch (e) { failed.push(`[${c.name}] ${e.message}`); }
  }
  assert(failed.length === 0, `${failed.length} of ${list.length} case(s) failed:\n        ${failed.join('\n        ')}`);
}

// ─── lazy loading ──────────────────────────────────────────────────────────────────────────────────────────────
function forget() { for (const p of FORGET) delete require.cache[p]; }
function loadStore() {
  forget();
  try { return require(STORE_MOD); } catch (e) { throw new Error(`${STORE_REL} not implemented yet (require failed: ${firstLine(e)})`); }
}
function loadRoutes() {
  forget();
  try { return require(ROUTES_MOD); } catch (e) { throw new Error(`${ROUTES_REL} not implemented yet (require failed: ${firstLine(e)})`); }
}
function need(mod, name, label, clar) {
  if (!mod || typeof mod[name] !== 'function') {
    throw new Error(`${label} does not export ${name}() yet (${clar}); it exports ${show(Object.keys(mod || {}))}`);
  }
  return mod[name];
}
/** A fresh store over `dir` (createStore({ dir }), T21). `dir` undefined → createStore({}), the default directory. */
function storeAt(dir) {
  const createStore = need(loadStore(), 'createStore', STORE_REL, 'T21');
  const store = createStore(dir === undefined ? {} : { dir });
  assert(store && typeof store === 'object', `createStore() should return the store object (T21); got ${show(store)}`);
  return store;
}
/** Call one store method, awaited (T26: the methods are synchronous, and awaiting works; RS22 pins the first half). */
async function call(store, name, ...args) {
  if (typeof store[name] !== 'function') throw new Error(`createStore() gives no ${name}() yet (T21${HISTORY_METHODS.includes(name) ? '; ADR 0005 D1: "readSwitchHistory() and writeSwitchHistory(obj)"' : ''})`);
  return store[name](...args);
}
/**
 * parseSwitchHistory(text) (ADR 0005 D1: pure, named under the store): store.js's export, as parseSwitch is, or the
 * store's own method — the ADR leaves which open.
 */
function parseHistoryFn(store) {
  const mod = loadStore();
  if (typeof mod.parseSwitchHistory === 'function') return mod.parseSwitchHistory;
  if (store && typeof store.parseSwitchHistory === 'function') return store.parseSwitchHistory;
  throw new Error(`${STORE_REL} gives no parseSwitchHistory(text) yet (ADR 0005 D1: "parseSwitchHistory(text) is pure"); it exports ${show(Object.keys(mod))}`);
}
/** The code this platform gives for reading a directory as a file (EISDIR here): ADR 0005's "something other than a file at the path". */
function dirReadCode(dir) {
  const probe = path.join(dir, '.dir-read-probe');
  fs.mkdirSync(probe);
  try { fs.readFileSync(probe, 'utf8'); return null; } catch (e) { return e.code; } finally { fs.rmdirSync(probe); }
}
function routeFn(name) { return need(loadRoutes(), name, ROUTES_REL, 'T22'); }

// ─── temp directories and env ──────────────────────────────────────────────────────────────────────────────────
/** A temp state root holding realtime/ (as the wrapper leaves it, mode 0700); removed afterwards. */
async function withDir(fn, { makeRealtime = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tagging-edges-realtime-rs-'));
  const dir = path.join(root, 'realtime');
  if (makeRealtime) fs.mkdirSync(dir, { mode: 0o700 });
  try {
    return await fn({ root, dir });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
async function withEnv(vars, fn) {
  const saved = {};
  for (const k of Object.keys(vars)) saved[k] = process.env[k];
  try {
    for (const [k, v] of Object.entries(vars)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    forget();
  }
}
/** Every file under `root` (relative, '/'-separated) with its bytes, skipping one top-level folder. */
function snapshot(root, skip) {
  const out = {};
  const walk = (d, rel) => {
    for (const name of fs.readdirSync(d).sort()) {
      const r = rel ? `${rel}/${name}` : name;
      if (!rel && name === skip) continue;
      const abs = path.join(d, name);
      if (fs.statSync(abs).isDirectory()) walk(abs, r); else out[r] = fs.readFileSync(abs).toString('base64');
    }
  };
  walk(root, '');
  return out;
}

// ─── a short-lived fs observer (RS only) ───────────────────────────────────────────────────────────────────────
let FH_PROTO = null;
async function fileHandleProto(dir) {
  if (FH_PROTO) return FH_PROTO;
  const probe = path.join(dir, '.filehandle-probe');
  const fh = await fs.promises.open(probe, 'w');
  FH_PROTO = Object.getPrototypeOf(fh);
  await fh.close();
  fs.unlinkSync(probe);
  return FH_PROTO;
}
/**
 * Run `fn(ops)` while fs is observed under `root`: → { result, error, ops }. ops are { op, rel[, to] } with op one of
 * open | fsync | truncate | rename | rename-failed, rel relative to root. A rename onto a rel in `failRenameOnto`
 * fails with EIO (sync, callback and promise forms). Everything outside root passes straight through.
 */
async function traced(root, { failRenameOnto = [] } = {}, fn) {
  const roots = [path.resolve(root)];
  try { const real = fs.realpathSync(root); if (!roots.includes(real)) roots.push(real); } catch (_) { /* keep one */ }
  const relOf = (p) => {
    let abs = null;
    if (typeof p === 'string') abs = path.resolve(p);
    else if (Buffer.isBuffer(p)) abs = path.resolve(p.toString('utf8'));
    else if (p instanceof URL && p.protocol === 'file:') abs = path.resolve(fileURLToPath(p));
    if (!abs) return null;
    for (const r of roots) {
      if (abs === r) return '';
      if (abs.startsWith(r + path.sep)) return abs.slice(r.length + 1).split(path.sep).join('/');
    }
    return null;
  };
  const proto = await fileHandleProto(root);
  const ops = [];
  const fds = new Map();
  const handles = new WeakMap();
  const saved = [];
  const fail = new Set(failRenameOnto);
  const fdRel = (fd) => (fds.has(fd) ? fds.get(fd) : null);
  const handleRel = (h) => (handles.has(h) ? handles.get(h) : fdRel(h && h.fd));
  const note = (op, rel, extra) => { if (rel !== null && rel !== undefined) ops.push({ op, rel, ...(extra || {}) }); };
  const renameFault = (to) => Object.assign(new Error(`EIO: i/o error, rename onto '${to}' (simulated by the test)`), { code: 'EIO' });
  const patch = (obj, key, make) => {
    if (!obj || typeof obj[key] !== 'function') return;
    const orig = obj[key];
    saved.push([obj, key, orig]);
    obj[key] = make(orig);
  };
  const wrapCb = (a, onOk) => {
    const at = a.length - 1;
    if (typeof a[at] !== 'function') return;
    const cb = a[at];
    a[at] = function observed(err, ...rest) { if (!err) onOk(...rest); return cb.call(this, err, ...rest); };
  };

  patch(fs, 'openSync', (orig) => function openSync(p, ...a) {
    const fd = orig.call(this, p, ...a);
    const r = relOf(p);
    if (r !== null) { fds.set(fd, r); note('open', r); }
    return fd;
  });
  patch(fs, 'open', (orig) => function open(p, ...a) {
    const r = relOf(p);
    if (r !== null) wrapCb(a, (fd) => { fds.set(fd, r); note('open', r); });
    return orig.call(this, p, ...a);
  });
  patch(fs.promises, 'open', (orig) => async function open(p, ...a) {
    const fh = await orig.call(this, p, ...a);
    const r = relOf(p);
    if (r !== null) { handles.set(fh, r); if (typeof fh.fd === 'number') fds.set(fh.fd, r); note('open', r); }
    return fh;
  });
  for (const k of ['fsyncSync', 'fdatasyncSync']) {
    patch(fs, k, (orig) => function fsyncSync(fd, ...a) { const out = orig.call(this, fd, ...a); note('fsync', fdRel(fd)); return out; });
  }
  for (const k of ['fsync', 'fdatasync']) {
    patch(fs, k, (orig) => function fsync(fd, ...a) { const r = fdRel(fd); wrapCb(a, () => note('fsync', r)); return orig.call(this, fd, ...a); });
  }
  for (const k of ['sync', 'datasync']) {
    patch(proto, k, (orig) => async function sync(...a) { const out = await orig.apply(this, a); note('fsync', handleRel(this)); return out; });
  }
  patch(fs, 'truncateSync', (orig) => function truncateSync(p, ...a) {
    const out = orig.call(this, p, ...a);
    note('truncate', typeof p === 'number' ? fdRel(p) : relOf(p));
    return out;
  });
  patch(fs, 'ftruncateSync', (orig) => function ftruncateSync(fd, ...a) { const out = orig.call(this, fd, ...a); note('truncate', fdRel(fd)); return out; });
  for (const k of ['truncate', 'ftruncate']) {
    patch(fs, k, (orig) => function truncate(p, ...a) {
      const r = typeof p === 'number' ? fdRel(p) : relOf(p);
      wrapCb(a, () => note('truncate', r));
      return orig.call(this, p, ...a);
    });
  }
  patch(fs.promises, 'truncate', (orig) => async function truncate(p, ...a) { const out = await orig.call(this, p, ...a); note('truncate', relOf(p)); return out; });
  patch(proto, 'truncate', (orig) => async function truncate(...a) { const out = await orig.apply(this, a); note('truncate', handleRel(this)); return out; });
  patch(fs, 'renameSync', (orig) => function renameSync(from, to, ...a) {
    const rf = relOf(from);
    const rt = relOf(to);
    if (rt !== null && fail.has(rt)) { ops.push({ op: 'rename-failed', rel: rf, to: rt }); throw renameFault(rt); }
    const out = orig.call(this, from, to, ...a);
    if (rf !== null || rt !== null) ops.push({ op: 'rename', rel: rf, to: rt });
    return out;
  });
  patch(fs, 'rename', (orig) => function rename(from, to, cb) {
    const rf = relOf(from);
    const rt = relOf(to);
    if (rt !== null && fail.has(rt)) { ops.push({ op: 'rename-failed', rel: rf, to: rt }); process.nextTick(cb, renameFault(rt)); return undefined; }
    return orig.call(this, from, to, function renamed(err, ...rest) {
      if (!err && (rf !== null || rt !== null)) ops.push({ op: 'rename', rel: rf, to: rt });
      return cb.call(this, err, ...rest);
    });
  });
  patch(fs.promises, 'rename', (orig) => async function rename(from, to) {
    const rf = relOf(from);
    const rt = relOf(to);
    if (rt !== null && fail.has(rt)) { ops.push({ op: 'rename-failed', rel: rf, to: rt }); throw renameFault(rt); }
    const out = await orig.call(this, from, to);
    if (rf !== null || rt !== null) ops.push({ op: 'rename', rel: rf, to: rt });
    return out;
  });

  let result;
  let error = null;
  try {
    result = await fn(ops);
  } catch (e) {
    error = e;
  } finally {
    for (let i = saved.length - 1; i >= 0; i--) { const [obj, key, orig] = saved[i]; obj[key] = orig; }
    forget(); // no module loaded inside the window keeps a wrapped fs function
  }
  return { result, error, ops };
}
/** Was `rel` made durable after its last truncation — an fsync of it, or an fsynced file renamed onto it? */
function durableAfterCut(ops, rel) {
  let lastCut = -1;
  ops.forEach((o, i) => { if (o.op === 'truncate' && o.rel === rel) lastCut = i; });
  const fsyncedAfter = ops.some((o, i) => o.op === 'fsync' && o.rel === rel && i > lastCut);
  const renamedDurable = ops.some((o, i) => o.op === 'rename' && o.to === rel && ops.slice(0, i).some((x) => x.op === 'fsync' && x.rel === o.rel));
  return fsyncedAfter || renamedDurable;
}
const fsyncedAny = (ops, rel) => ops.some((o) => o.op === 'fsync' && o.rel === rel);

// ─── store fixtures ────────────────────────────────────────────────────────────────────────────────────────────
const SW_ON = { version: 1, on: true, changedAt: iso(T0 - 2 * DAY), changedBy: OWNER.slice(0, 8) };
const SW_OFF = { version: 1, on: false, changedAt: iso(T0 - MIN), changedBy: OWNER.slice(0, 8) };
/** The same record with its keys in another order (canonical form ⇒ the same bytes). */
const reorder = (rec) => ({ changedBy: rec.changedBy, on: rec.on, changedAt: rec.changedAt, version: rec.version });
/** T26: switch.json's canonical text — compact, keys in the order version, on, changedAt, changedBy. */
const canonicalSwitch = (rec) => JSON.stringify({ version: rec.version, on: rec.on, changedAt: rec.changedAt, changedBy: rec.changedBy });

// Story 5 (ADR 0005 D1): switch.json version 2 and switch-history.json.
const OWNER8 = OWNER.slice(0, 8);
const ADMIN8 = ADMIN.slice(0, 8);
/** ADR 0005 D1: version 2's key order. */
const SWITCH2_KEYS = ['version', 'on', 'changedAt', 'changedBy', 'role', 'onSince'];
/** ADR 0005 D1: switch.json version 2's canonical text — compact, keys in the order version, on, changedAt, changedBy, role, onSince. */
const canonicalSwitch2 = (rec) => JSON.stringify(SWITCH2_KEYS.reduce((o, k) => { o[k] = rec[k]; return o; }, {}));
/** The same record with its keys reversed (canonical form ⇒ the same bytes). */
const reverseKeys = (rec) => Object.keys(rec).reverse().reduce((o, k) => { o[k] = rec[k]; return o; }, {});
/** Turned on by the owner two days ago. */
const SW2_ON = { version: 2, on: true, changedAt: iso(T0 - 2 * DAY), changedBy: OWNER8, role: 'owner', onSince: iso(T0 - 2 * DAY) };
/** An admin's "on" an hour ago while already on: changedAt moved, onSince did not (ADR 0005 D4). */
const SW2_ON_AGAIN = { version: 2, on: true, changedAt: iso(T0 - HOUR), changedBy: ADMIN8, role: 'admin', onSince: iso(T0 - 2 * DAY) };
/** Turned off by an admin a minute ago. */
const SW2_OFF = { version: 2, on: false, changedAt: iso(T0 - MIN), changedBy: ADMIN8, role: 'admin', onSince: null };
/** ADR 0005 D1: a history entry { on, at, role, key }; a change not recorded has null at, role and key. */
const entryOf = (rec) => ({ on: rec.on, at: rec.changedAt, role: rec.role, key: rec.changedBy });
const UNRECORDED_OFF = { on: false, at: null, role: null, key: null };
/** switch-history.json (ADR 0005 D1: { version: 1, changes }, newest first). */
const HIST_A = { version: 1, changes: [entryOf(SW2_OFF), entryOf(SW2_ON_AGAIN), entryOf(SW2_ON)] };
const HIST_B = { version: 1, changes: [UNRECORDED_OFF, ...HIST_A.changes] };
/** Ten entries, alternating on and off, newest first (the cap, ADR 0005 D1). */
const HIST_10 = {
  version: 1,
  changes: Array.from({ length: 10 }, (_, i) => ({ on: i % 2 === 1, at: iso(T0 - (i + 1) * HOUR), role: i % 3 ? 'admin' : 'owner', key: i % 3 ? ADMIN8 : OWNER8 })),
};

const JL = (o) => `${JSON.stringify(o)}\n`;
const HEARD = idOf('rs-heard');
const L_V = JL({ t: 'v', id: HEARD, a: ADDRESS });
const L_D = JL({ t: 'd', a: ADDRESS, p: { type: 'revoke', kind5Id: idOf('rs-kind5'), created_at: 1790000000, by: 'e', target: HEARD } });
const L_C = JL({ t: 'c', id: HEARD, a: ADDRESS });
const L_B = JL({ t: 'b', id: idOf('rs-baseline') });
/** A line with multi-byte characters: its byte length exceeds its character length. */
const L_UTF8 = JL({ t: 'v', id: idOf('rs-utf8'), a: `39999:${CAROL}:profile-tag-café-☕-${BOB.slice(0, 8)}` });
const strip = (s) => (s.endsWith('\n') ? s.slice(0, -1) : s);
const linesOfText = (text) => text.split('\n').filter((l, i, all) => !(i === all.length - 1 && l === ''));

/**
 * A record body in the state-file table's fields, its entries in T25's shapes. Keys are deliberately NOT in sorted
 * order at any level (and one address has multi-byte characters), so only T26's recursive key sort and UTF-8 give
 * the pinned sha256.
 */
function recordBody(o = {}) {
  const writer = `39999:${CAROL}:profile-tag-writer-${ALICE.slice(0, 8)}`;
  const cafe = `39999:${BOB}:profile-tag-café-☕-${CAROL.slice(0, 8)}`;
  return {
    version: 1,
    firstStartedAt: iso(T0 - 3 * DAY),
    identities: { local: LOCAL, canonical: CANONICAL },
    compactedAt: iso(T0 - HOUR),
    seen: [[idOf('rs-seen-1'), ADDRESS], [idOf('rs-seen-2'), writer], [idOf('rs-seen-3'), cafe]],
    heard: [[HEARD, ADDRESS]],
    baseline: [idOf('rs-seen-2')],
    refusedSeen: [[idOf('rs-refused'), cafe]],
    pending: [{ a: ADDRESS, entry: { version: { id: HEARD }, revokes: [], look: false }, lane: 'live', attempts: 0, notBefore: 0 }],
    rechecks: [{ runId: '20260928T030000Z-aaaaaaa1', a: writer, entry: { version: null, revokes: [], look: true } }],
    deadSeenAt: { '20260928T030000Z-aaaaaaa1': T0 - HOUR, '20260927T030000Z-bbbbbbb2': T0 - DAY },
    parked: [{ code: 'Neo.ClientError.Schema.ConstraintValidationFailed', a: cafe, nextAt: T0 + MIN, attempts: 2 }],
    ...o,
  };
}
const withoutSha = (r) => { const out = { ...(r || {}) }; delete out.sha256; return out; };

/**
 * openJournal()'s lines, checked to be a synchronous Iterable<string> (T21) of whole lines WITHOUT their trailing
 * newline (T26): an item carrying "\n" fails here.
 */
function linesOf(result, label) {
  assert(result && typeof result === 'object', `${label}: openJournal() should give { lines } or { unreadable: true } (T21); got ${show(result)}`);
  assert(result.unreadable !== true, `${label}: openJournal() said the journal is unreadable (${show(result)})`);
  const it = result.lines;
  assert(it && typeof it !== 'string' && typeof it[Symbol.iterator] === 'function', `${label}: openJournal().lines should be an Iterable<string> (T21); got ${show(it)}`);
  const out = [];
  for (const l of it) {
    if (typeof l !== 'string') throw new Error(`${label}: openJournal().lines yielded a ${typeof l}, not a string: ${show(l)}`);
    if (l.includes('\n')) throw new Error(`${label}: openJournal().lines yielded an item carrying a newline (T26: lines exclude the trailing newline): ${show(l)}`);
    out.push(l);
  }
  return out;
}

// ─── route fixtures ────────────────────────────────────────────────────────────────────────────────────────────
/**
 * status.json as the path writes it: exactly the fields T29 says it carries, process as T32 gives it and every time an
 * ISO string (T33). The route derives statusVersion, on, onSince, running, runningSince, switchUnreadable and stale
 * (T29); tests that show a stored copy of one is ignored add it themselves.
 */
function fullStatus(o = {}) {
  return {
    state: 'live',
    firstStartedAt: iso(T0 - 3 * DAY),
    relay: { lastReadOkAt: iso(T0 - 4 * SEC) },
    subscription: { connected: true, since: iso(T0 - HOUR), lastEventAt: iso(T0 - 9 * SEC) },
    lastReflectedAt: iso(T0 - 9 * SEC),
    lastRound: { ms: 412, addresses: 3 },
    catchUp: {
      underway: false,
      current: null,
      last: {
        outcome: 'done', startedAt: iso(T0 - HOUR), endedAt: iso(T0 - HOUR + 5120), durationMs: 5120,
        reflected: { added: 4, changed: 1, removed: 2, unchanged: 7010 },
      },
    },
    counts: {
      added: 12, changed: 5, changedBy: { newer: 2, older: 1, moved: 1, refreshed: 1, repaired: 0 },
      removed: 3, removedBy: { 'not-on-relay': 2, 'non-tagging': 1 }, unchanged: 7010, peopleAdded: 4,
      refused: { total: 2, byReason: { 'no-target': 1, 'bad-polarity': 1 } },
      leftInPlace: { total: 1, byReason: { 'no-address': 1 } },
      deletionsMatchedNothing: 9, deletionsForeign: 2,
      failedReads: { relay: 1, graph: 0, element: 0, catchUp: 1 },
      lostRaces: { create: 1, update: 0, move: 0, remove: 0 },
      dbRefused: { total: 1, byReason: { 'Neo.ClientError.Schema.ConstraintValidationFailed': 1 } },
      heldPreExisting: 7000, removalsNotPrompted: 1, relooks: 2, conflicts: 0, droppedOverBacklog: 0,
    },
    pending: 0,
    parked: 1,
    seen: 7030,
    heard: 2,
    journal: { bytes: 2048, skippedLines: 1 },
    setupProblem: null,
    lastError: { at: iso(T0 - 10 * MIN), stage: 'relay-read', code: 'timeout', text: 'a relay read timed out' },
    preimageFile: 'preimages/20260928T110000Z-0a1b2c3d.jsonl',
    process: { pid: PID, startTime: START_TIME, startedAt: PROCESS_STARTED_AT },
    updatedAt: iso(T0 - 5 * SEC),
    ...o,
  };
}
/** Waiting on a bad identity, a catch-up under way, the last one not established, counts reset. */
function waitingStatus() {
  const base = fullStatus();
  return fullStatus({
    state: 'waiting-setup',
    catchUp: {
      underway: true,
      current: { startedAt: iso(T0 - 20 * SEC), trigger: 'start', arrivals: 12, lookOnly: 3, deletionsFound: 1, remaining: 9 },
      last: {
        outcome: 'not-established', reason: 'record-missing', startedAt: iso(T0 - DAY), endedAt: iso(T0 - DAY + 3000),
        durationMs: 3000, reflected: { added: 0, changed: 0, removed: 0, unchanged: 0 },
      },
    },
    setupProblem: { kind: 'identity', identity: 'local', problem: 'upper-case', source: 'env' },
    lastError: { at: iso(T0 - MIN), stage: 'graph', code: 'Neo.TransientError.Transaction.DeadlockDetected', text: 'the graph refused a write' },
    counts: { ...base.counts, countsReset: true },
  });
}
/** Waiting on a missing database rule. */
function schemaStatus() {
  return fullStatus({ state: 'waiting-setup', setupProblem: { kind: 'schema', rule: 'tags_address', problem: 'missing' }, lastError: null });
}
/** The fields § Status lists that the route passes through from status.json (T29: the rest are the route's). */
const PASS_THROUGH = [
  'state', 'firstStartedAt', 'relay', 'subscription', 'lastReflectedAt', 'lastRound', 'catchUp', 'counts',
  'pending', 'parked', 'seen', 'heard', 'journal', 'setupProblem', 'lastError', 'preimageFile', 'process', 'updatedAt',
];
function stringsIn(v, out = []) {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => stringsIn(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => stringsIn(x, out));
  return out;
}
/** An ISO-8601 UTC time as Date#toISOString gives it (fixed format: carries no text). */
const isIsoTime = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(s) && !Number.isNaN(Date.parse(s));
/** The time fields § Status lists for the answer (T33: each an ISO string), as dotted paths. */
const TIME_PATHS = [
  'onSince', 'runningSince', 'firstStartedAt', 'relay.lastReadOkAt', 'subscription.since', 'subscription.lastEventAt',
  'lastReflectedAt', 'catchUp.current.startedAt', 'catchUp.last.startedAt', 'catchUp.last.endedAt', 'lastError.at',
  'process.startedAt', 'updatedAt',
];
/** The value at a dotted path, or undefined when a step is missing or null. */
const valueAt = (o, p) => p.split('.').reduce((v, k) => (v && typeof v === 'object' ? v[k] : undefined), o);
/** A member absent as on the wire: not there, or undefined (JSON drops it). statusUnreadable: false is present. */
const absent = (o, k) => !has(o, k) || o[k] === undefined;

/** A /proc/<pid>/stat line whose field 22 is `startTime` and field 3 is `state`. */
function statLine(pid, startTime, state = 'S') {
  return `${pid} (node) ${state} 1 ${pid} ${pid} 0 -1 4194560 100 0 0 0 5 3 0 0 20 0 1 0 ${startTime} 12345678 2000 18446744073709551615\n`;
}
function enoent(p) {
  return Object.assign(new Error(`ENOENT: no such file or directory, open '${p}'`), { code: 'ENOENT', errno: -2, syscall: 'open', path: p });
}
/**
 * A readFile over `files` (absolute path → text | Error), fs.readFileSync-shaped (returns or throws), or
 * fs.promises-shaped when `async`. Missing → ENOENT. Records every path asked for.
 */
function makeReadFile(files, { async = false } = {}) {
  const calls = [];
  const sync = (p) => {
    const key = path.normalize(String(p));
    calls.push(key);
    const v = Object.prototype.hasOwnProperty.call(files, key) ? files[key] : undefined;
    if (v === undefined) throw enoent(key);
    if (v instanceof Error) throw v;
    return v;
  };
  const readFile = async ? (p) => new Promise((resolve, reject) => { try { resolve(sync(p)); } catch (e) { reject(e); } }) : (p) => sync(p);
  readFile.calls = calls;
  return readFile;
}
const pidOf = (r) => { const p = r && r.process && typeof r.process === 'object' ? r.process : r; return p && p.pid; };

function fakeReq({ method = 'POST', url = '', session, localTrusted, headers = {}, body, query = {}, ip = '203.0.113.9' } = {}) {
  const h = {};
  for (const [k, v] of Object.entries(headers)) if (v !== undefined) h[k.toLowerCase()] = v;
  const req = {
    method, url, originalUrl: url, path: url.split('?')[0], headers: h, body, query, session,
    hostname: String(h.host || '').split(':')[0], protocol: 'http', secure: false, ip, ips: [],
    socket: { remoteAddress: ip }, connection: { remoteAddress: ip },
    get(name) { return h[String(name).toLowerCase()]; },
    header(name) { return h[String(name).toLowerCase()]; },
    is(...types) {
      const ct = String(h['content-type'] || '').split(';')[0].trim().toLowerCase();
      if (!ct) return false;
      const [x, y] = ct.split('/');
      for (const t of types.flat()) {
        const want = String(t).includes('/') ? String(t).toLowerCase()
          : ({ json: 'application/json', urlencoded: 'application/x-www-form-urlencoded', multipart: 'multipart/*', text: 'text/*' })[t] || `*/${t}`;
        const [a, b] = want.split('/');
        if ((a === '*' || a === x) && (b === '*' || b === y)) return t;
      }
      return false;
    },
  };
  if (localTrusted !== undefined) req.localTrusted = localTrusted;
  return req;
}
const ownerSession = () => ({ authenticated: true, pubkey: OWNER });
const SWITCH_PATH = '/api/tagging-edges/realtime/switch';
const STATUS_PATH = '/api/tagging-edges/realtime/status';
function switchReq(body, o = {}) {
  const headers = { host: HOST, 'content-type': 'application/json' };
  if (o.origin !== undefined) headers.origin = o.origin;
  if (has(o, 'contentType')) headers['content-type'] = o.contentType === null ? undefined : o.contentType;
  return fakeReq({
    method: 'POST', url: SWITCH_PATH, headers, body,
    session: has(o, 'session') ? o.session : ownerSession(), localTrusted: o.localTrusted, ip: o.ip,
  });
}
const statusReq = () => fakeReq({ method: 'GET', url: STATUS_PATH, headers: { host: HOST } });
/** GET on the switch path (ADR 0005 D6), same host, no Origin. */
const recordReq = (session) => fakeReq({ method: 'GET', url: SWITCH_PATH, headers: { host: HOST }, session });
function fakeRes() {
  const res = { statusCode: 200, body: undefined, finished: false, headers: {} };
  let done;
  res.done = new Promise((r) => { done = r; });
  const finish = (b) => {
    if (res.finished) return res;
    res.finished = true;
    if (typeof b === 'string') { try { res.body = JSON.parse(b); } catch (_) { res.body = b; } } else res.body = b;
    done();
    return res;
  };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => finish(b);
  res.send = (b) => finish(b);
  res.end = (b) => finish(b);
  res.sendStatus = (c) => { res.statusCode = c; return finish(undefined); };
  res.set = (k, v) => { res.headers[String(k).toLowerCase()] = v; return res; };
  res.setHeader = res.set;
  res.header = res.set;
  res.type = () => res;
  return res;
}
async function callHandler(fn, req, deps) {
  const res = fakeRes();
  let thrown = null;
  try { await fn(req, res, deps); } catch (e) { thrown = e; }
  if (!res.finished) {
    let timer;
    await Promise.race([res.done, new Promise((r) => { timer = setTimeout(r, 2000); })]);
    clearTimeout(timer);
  }
  if (!res.finished) throw new Error(`the handler never answered${thrown ? ` (it threw: ${firstLine(thrown)})` : ''}`);
  return res;
}
const showRes = (res) => `${res.statusCode} ${show(res.body)}`;
/** The leaks an answer carries: an absolute path that starts a word, a URI, the owner's full pubkey, an address. */
function leakProblems(label, res, extraNeedles = []) {
  const text = typeof res.body === 'string' ? res.body : JSON.stringify(res.body === undefined ? null : res.body);
  const p = [];
  const abs = /(^|[\s'"[(=])\/[^\s'"\])]/.exec(text);
  if (abs) p.push(`${label}: the answer carries an absolute path: ${around(text, abs.index)}`);
  const uri = /\b[a-z][a-z0-9+.-]*:\/\//i.exec(text);
  if (uri) p.push(`${label}: the answer carries a URI: ${around(text, uri.index)}`);
  for (const needle of [OWNER, OWNER.toUpperCase(), FAKE_ROOT, ODD_CODE, ...ADDRESS_NEEDLES, ...extraNeedles]) {
    const at = text.indexOf(needle);
    if (at >= 0) p.push(`${label}: the answer carries ${needle === OWNER || needle === OWNER.toUpperCase() ? "the owner's full pubkey" : show(needle)}: ${around(text, at)}`);
  }
  return p;
}

/** An admin's full pubkey in an answer (ADR 0005 D11: "No answer carries a full pubkey"); leakProblems covers the owner's. */
function adminLeakProblems(label, res) {
  const text = typeof res.body === 'string' ? res.body : JSON.stringify(res.body === undefined ? null : res.body);
  return [ADMIN, ADMIN.toUpperCase()].filter((k) => text.includes(k)).map(() => `${label}: the answer carries an admin's full pubkey: ${show(text)}`);
}
/**
 * The switch handler's deps: every call recorded; the owner by getter unless told otherwise.
 * Story 5 (ADR 0005 Seams, "Use the shared switchBundle"): the record dependencies are injected too — readSwitch
 * (o.prev; default: missing, null), readSwitchHistory (o.hist; default: missing, null) and writeSwitchHistory (a spy;
 * fails with o.historyWriteError) — because stateDir() is FAKE_ROOT, the production state directory, and the defaults
 * are the store's under it (inside the container they would read the live switch.json and overwrite the live
 * switch-history.json). o.admins replaces the admin list (an array, or a function that may throw). calls.order keeps
 * story 3's writeSwitch / unlinkSwitch sequence; calls.seq records every record dependency in call order.
 */
function switchBundle(o = {}) {
  const calls = { readFile: [], writeSwitch: [], unlinkSwitch: 0, order: [], queue: 0, readSwitch: 0, readSwitchHistory: 0, writeSwitchHistory: [], seq: [] };
  const deps = {
    readFile: (p) => { calls.readFile.push(String(p)); throw enoent(String(p)); },
    stateDir: () => FAKE_ROOT,
    isAlive: () => false,
    now: () => T0,
    getOwnerPubkey: () => OWNER,
    writeSwitch: async (record) => { calls.writeSwitch.push(clone(record)); calls.order.push('writeSwitch'); calls.seq.push('writeSwitch'); if (o.writeError) throw o.writeError; },
    unlinkSwitch: async () => { calls.unlinkSwitch++; calls.order.push('unlinkSwitch'); calls.seq.push('unlinkSwitch'); if (o.unlinkError) throw o.unlinkError; },
    readSwitch: () => { calls.readSwitch++; calls.seq.push('readSwitch'); return has(o, 'prev') ? clone(o.prev) : null; },
    readSwitchHistory: () => { calls.readSwitchHistory++; calls.seq.push('readSwitchHistory'); return has(o, 'hist') ? clone(o.hist) : null; },
    writeSwitchHistory: (obj) => { calls.writeSwitchHistory.push(clone(obj)); calls.seq.push('writeSwitchHistory'); if (o.historyWriteError) throw o.historyWriteError; },
    isQueueAvailable: async () => { calls.queue++; return true; },
    runViaQueueAsync: async () => { calls.queue++; return { success: true, jobId: 'x' }; },
    getAdminPubkeys: () => [ADMIN],
    isAdminPubkey: (pk) => pk === ADMIN,
  };
  if (has(o, 'owner')) deps.getOwnerPubkey = o.owner;
  if (has(o, 'ownerString')) { delete deps.getOwnerPubkey; deps.ownerPubkey = o.ownerString; }
  if (has(o, 'admins')) {
    deps.getAdminPubkeys = typeof o.admins === 'function' ? o.admins : () => o.admins;
    deps.isAdminPubkey = (pk) => { const list = deps.getAdminPubkeys(); return Array.isArray(list) && list.includes(pk); };
  }
  return { deps, calls };
}
/** Each history write in call order, and whether writeSwitch had been called before it (ADR 0005 D2: pre-fold, then switch, then fold). */
function historyWrites(calls) {
  const out = [];
  let h = 0;
  let switched = false;
  for (const op of calls.seq) {
    if (op === 'writeSwitch') switched = true;
    if (op === 'writeSwitchHistory') out.push({ obj: calls.writeSwitchHistory[h++], afterSwitch: switched });
  }
  return out;
}
/** History writes that hold an entry for the change made at `at` (ISO) — the request's own change. */
const holdsChangeAt = (w, at) => !!(w.obj && Array.isArray(w.obj.changes) && w.obj.changes.some((e) => e && e.at === at));
/** ADR 0005 D2 step 5 when writeSwitch failed: "run no fold", and the attempted change is recorded nowhere. */
function noFoldProblems(r, at) {
  const p = [];
  const writes = historyWrites(r.calls);
  const after = writes.filter((w) => w.afterSwitch);
  if (after.length) p.push(`the history was written after the failed writeSwitch (ADR 0005 D2 step 5: "run no fold"): ${show(after.map((w) => w.obj))}`);
  const holding = writes.filter((w) => holdsChangeAt(w, at));
  if (holding.length) p.push(`a history write holds the attempted change (at ${at}), which switch.json never held (ADR 0005 D2's invariant): ${show(holding.map((w) => w.obj))}`);
  return p;
}
async function callSwitch(req, bundle) {
  const h = routeFn('handleRealtimeSwitch');
  const kills = [];
  const realKill = process.kill;
  process.kill = function recordKill(...a) { kills.push(a.map(String)); return true; };
  try {
    const res = await callHandler(h, req, bundle.deps);
    return { res, kills, calls: bundle.calls };
  } finally {
    process.kill = realKill;
  }
}
/** What a refused switch request must not do: answer otherwise, touch a file, signal, enqueue, or leak. */
function refusalProblems(label, r, statuses) {
  const p = [];
  if (!statuses.includes(r.res.statusCode)) p.push(`${label}: answered ${showRes(r.res)}, expected ${statuses.join(' or ')}`);
  if (r.res.body && r.res.body.success === true) p.push(`${label}: answered success: true`);
  if (r.calls.writeSwitch.length) p.push(`${label}: called writeSwitch(${show(r.calls.writeSwitch)})`);
  if (r.calls.unlinkSwitch) p.push(`${label}: called unlinkSwitch()`);
  if (r.calls.readFile.length) p.push(`${label}: read ${show(r.calls.readFile)} before refusing`);
  // Story 5 (ADR 0005 D5): "No refusal reads, writes or unlinks a file … so it changes and records nothing."
  if (r.calls.readSwitch) p.push(`${label}: called readSwitch() before refusing (ADR 0005 D5)`);
  if (r.calls.readSwitchHistory) p.push(`${label}: called readSwitchHistory() before refusing (ADR 0005 D5)`);
  if (r.calls.writeSwitchHistory.length) p.push(`${label}: called writeSwitchHistory(${show(r.calls.writeSwitchHistory)}) — a refusal records nothing (ADR 0005 D5)`);
  if (r.kills.length) p.push(`${label}: sent a signal ${show(r.kills)}`);
  if (r.calls.queue) p.push(`${label}: touched the task queue`);
  p.push(...leakProblems(label, r.res));
  return p;
}
/** What a store-backed dependency of the status route says when it is called: the route reads through readFile. */
const STATUS_READS_THROUGH = 'the status route reads through the injected readFile (ADR 0005 D6; T32)';
/** The store-backed dependencies the status route could take (ADR 0005 D1's record methods, and the store's readStatus). */
const STATUS_STORE_SENTINELS = ['readSwitch', 'readSwitchHistory', 'writeSwitchHistory', 'readStatus'];
/**
 * The status handler's deps over `files`; alive answers `alive` for a record carrying PID. stateDir() is FAKE_ROOT,
 * the production state directory, so (story 5, ADR 0005 Seams) every store-backed dependency the route could take is
 * injected as a sentinel that records its call and THROWS: a route that read through the store instead of the
 * injected readFile would otherwise read the live switch.json under FAKE_ROOT. callStatus fails loudly on any call,
 * even one the route swallowed.
 */
function statusBundle({ files = {}, alive = false, async = false, noIsAlive = false, now = T0 } = {}) {
  const readFile = makeReadFile(files, { async });
  const aliveCalls = [];
  const writes = [];
  const storeCalls = [];
  const deps = {
    readFile,
    stateDir: () => FAKE_ROOT,
    isAlive: (r) => { aliveCalls.push(clone(r)); return !!alive && pidOf(r) === PID; },
    now: () => now,
    getOwnerPubkey: () => OWNER,
    writeSwitch: async (rec) => { writes.push(['writeSwitch', clone(rec)]); },
    unlinkSwitch: async () => { writes.push(['unlinkSwitch']); },
  };
  for (const name of STATUS_STORE_SENTINELS) {
    deps[name] = () => { storeCalls.push(name); throw new Error(`${STATUS_READS_THROUGH}: it called ${name}()`); };
  }
  if (noIsAlive) delete deps.isAlive;
  return { deps, readFile, aliveCalls, writes, storeCalls };
}
async function callStatus(bundle) {
  const h = routeFn('handleRealtimeStatus');
  const res = await callHandler(h, statusReq(), bundle.deps);
  if (bundle.storeCalls && bundle.storeCalls.length) {
    throw new Error(`${STATUS_READS_THROUGH}, never through the store under stateDir() (FAKE_ROOT, the production directory): it called ${show(bundle.storeCalls.map((n) => `${n}()`))}`);
  }
  return res;
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════
// RS — the store, src/pipeline/tagging-edges/realtime/store.js (T21)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('RS1: createStore({ dir }) gives every method T21 names — readSwitch, writeSwitch, unlinkSwitch, readStarted, writeStarted, readRecord, writeRecord, openJournal, appendJournal, truncateJournal, journalBytes, readStatus and writeStatus (T21)', async () => {
  await withDir(async ({ dir }) => {
    const store = storeAt(dir);
    const missing = STORE_METHODS.filter((m) => typeof store[m] !== 'function');
    assert(missing.length === 0, `createStore({ dir }) lacks ${show(missing)}; it has ${show(Object.keys(store))}`);
  });
});

test('RS2: writeSwitch writes <dir>/switch.json in the canonical compact form — one JSON object, no whitespace outside strings, exactly { version, on, changedAt, changedBy } with the keys in that order (the text is JSON.stringify of them, one trailing newline at most), "on":true (or "on":false) literally present for the wrapper\'s pure-bash match, the same bytes whatever the record\'s key order — and readSwitch gives { on, changedAt, changedBy } back (ADR § "Knowing what changed…" state-file table; § "Where it runs": the wrapper matches the canonical "on":true; T21; T26: key order version, on, changedAt, changedBy); story 5 adds version 2 rows — an owner\'s on, an admin\'s on while on, an admin\'s off — written exactly as { version: 2, on, changedAt, changedBy, role, onSince } in that key order, with "on": appearing once (no other key may hold the text "on":true), and readSwitch giving all six back (ADR 0005 D1; Constraints: run.sh:44; T26 as amended)', async () => {
  await cases([
    { name: 'on', rec: SW_ON },
    { name: 'off', rec: SW_OFF },
    { name: 'version 2, the owner\'s on (story 5)', rec: SW2_ON, v2: true },
    { name: 'version 2, an admin\'s on while on (story 5)', rec: SW2_ON_AGAIN, v2: true },
    { name: 'version 2, an admin\'s off (story 5)', rec: SW2_OFF, v2: true },
  ], async (c) => {
    await withDir(async ({ dir }) => {
      const file = path.join(dir, 'switch.json');
      const canonical = c.v2 ? canonicalSwitch2 : canonicalSwitch;
      const backKeys = c.v2 ? SWITCH2_KEYS : ['on', 'changedAt', 'changedBy'];
      await call(storeAt(dir), 'writeSwitch', clone(c.rec));
      assert(fs.existsSync(file), `writeSwitch wrote no ${path.basename(dir)}/switch.json (files: ${show(fs.readdirSync(dir))})`);
      const bytes = fs.readFileSync(file);
      const text = bytes.toString('utf8');
      const body = text.endsWith('\n') ? text.slice(0, -1) : text;
      const problems = [];
      let parsed;
      try { parsed = JSON.parse(body); } catch (e) { problems.push(`switch.json is not one JSON document: ${show(text)}`); }
      if (parsed !== undefined) {
        if (body.includes('\n')) problems.push(`switch.json spans several lines: ${show(text)}`);
        if (JSON.stringify(parsed) !== body) problems.push(`switch.json is not compact (whitespace outside strings): ${show(text)}`);
        if (exact(parsed) !== exact(c.rec)) problems.push(`switch.json should hold exactly ${show(c.rec)}; holds ${show(parsed)}`);
      }
      if (body !== canonical(c.rec)) problems.push(`switch.json should be exactly the canonical text (${c.v2 ? 'ADR 0005 D1: keys in the order version, on, changedAt, changedBy, role, onSince' : 'T26: keys in the order version, on, changedAt, changedBy'})\n          expected: ${show(canonical(c.rec))}\n          actual:   ${show(body)}`);
      if (c.rec.on === true && !body.includes('"on":true')) problems.push(`switch.json lacks the literal "on":true the wrapper matches: ${show(text)}`);
      if (c.rec.on === false && (body.includes('"on":true') || !body.includes('"on":false'))) problems.push(`an off switch.json should carry "on":false and never "on":true: ${show(text)}`);
      if (c.v2 && body.split('"on":').length !== 2) problems.push(`"on": should appear exactly once in switch.json (ADR 0005 Constraints: no key but on may hold the text "on":true): ${show(text)}`);
      await call(storeAt(dir), 'writeSwitch', (c.v2 ? reverseKeys : reorder)(clone(c.rec)));
      const again = fs.readFileSync(file);
      if (!again.equals(bytes)) problems.push(`the same record with its keys in another order gave other bytes (not canonical):\n          first:  ${show(text)}\n          second: ${show(again.toString('utf8'))}`);
      const back = await call(storeAt(dir), 'readSwitch');
      if (!back || exact(pick(back, backKeys)) !== exact(pick(c.rec, backKeys))) {
        problems.push(`readSwitch() should give ${c.v2 ? '{ version, on, changedAt, changedBy, role, onSince } (ADR 0005 D1)' : '{ on, changedAt, changedBy }'} of what was written; gave ${show(back)}`);
      }
      assert(problems.length === 0, problems.join('\n        '));
    });
  });
});

test('RS3: with no switch.json (a fresh install: the path ships off) readSwitch gives null (AC-5 "ships turned off"; T21: null when missing)', async () => {
  await withDir(async ({ dir }) => {
    const r = await call(storeAt(dir), 'readSwitch');
    eq(r, null, 'readSwitch() with no switch.json');
  });
});

test('RS4: a switch.json that is present but unreadable — not JSON, empty, torn mid-write, binary bytes, or a directory in its place — reads as { unreadable: true }, never as on (ADR § "Status and switch": "a missing or unreadable switch.json reads as off", switchUnreadable; T21)', async () => {
  await cases([
    { name: 'not JSON', bytes: 'on' },
    { name: 'empty', bytes: '' },
    { name: 'torn mid-write', bytes: '{"version":1,"on":tr' },
    { name: 'binary bytes', bytes: Buffer.from([0xff, 0xfe, 0x00, 0x7b, 0x22]) },
    { name: 'a directory in its place', dirInPlace: true },
  ], async (c) => {
    await withDir(async ({ dir }) => {
      const file = path.join(dir, 'switch.json');
      if (c.dirInPlace) fs.mkdirSync(file); else fs.writeFileSync(file, c.bytes);
      let r;
      try { r = await call(storeAt(dir), 'readSwitch'); } catch (e) {
        if (/not implemented yet|gives no/.test(e.message)) throw e;
        throw new Error(`readSwitch() threw instead of answering { unreadable: true }: ${firstLine(e)}`);
      }
      assert(r && r.unreadable === true, `readSwitch() should give { unreadable: true }; gave ${show(r)}`);
      assert(r.on !== true, `an unreadable switch.json must never read as on; gave ${show(r)}`);
    });
  });
});

test('RS5: a switch.json that parses but is not an object whose "on" is a boolean — "on":"true", "on":"false", "on":1, "on":null, no "on", JSON null, an empty array, [true], a bare true — reads as { unreadable: true }, never as on (fail-safe off, ADR § "Status and switch"; § "Where it runs"; T21; T26: "readSwitch gives { unreadable: true } unless the file parses to an object whose on is a boolean")', async () => {
  await cases([
    { name: '"on":"true"', text: `{"version":1,"on":"true","changedAt":"${SW_ON.changedAt}","changedBy":"${SW_ON.changedBy}"}` },
    { name: '"on":"false"', text: `{"version":1,"on":"false","changedAt":"${SW_OFF.changedAt}","changedBy":"${SW_OFF.changedBy}"}` },
    { name: '"on":1', text: `{"version":1,"on":1,"changedAt":"${SW_ON.changedAt}","changedBy":"${SW_ON.changedBy}"}` },
    { name: '"on":null', text: '{"version":1,"on":null}' },
    { name: 'no "on"', text: '{"version":1}' },
    { name: 'JSON null', text: 'null' },
    { name: 'an empty array', text: '[]' },
    { name: 'an array', text: '[true]' },
    { name: 'a bare true', text: 'true' },
  ], async (c) => {
    await withDir(async ({ dir }) => {
      fs.writeFileSync(path.join(dir, 'switch.json'), c.text);
      let r;
      try { r = await call(storeAt(dir), 'readSwitch'); } catch (e) {
        if (/not implemented yet|gives no/.test(e.message)) throw e;
        throw new Error(`readSwitch() threw instead of answering { unreadable: true }: ${firstLine(e)}`);
      }
      assert(r && r.unreadable === true, `readSwitch() of ${show(c.text)} should give { unreadable: true } (T26); gave ${show(r)}`);
      assert(r.on !== true, `readSwitch() reads ${show(c.text)} as on: ${show(r)}`);
    });
  });
});

test('RS6: unlinkSwitch removes switch.json, after which readSwitch gives null — the route\'s fallback when an off-write fails, since an unlink needs no free space (ADR § "Status and switch"; T21)', async () => {
  await withDir(async ({ dir }) => {
    await call(storeAt(dir), 'writeSwitch', clone(SW_ON));
    await call(storeAt(dir), 'unlinkSwitch');
    assert(!fs.existsSync(path.join(dir, 'switch.json')), 'switch.json still exists after unlinkSwitch()');
    eq(await call(storeAt(dir), 'readSwitch'), null, 'readSwitch() after unlinkSwitch()');
  });
});

test('RS7: writeStarted writes <dir>/started.json and readStarted gives { version: 1, firstStartedAt } back from a fresh store (it survives a restart); before any write readStarted gives null (ADR state-file table: started.json { version: 1, firstStartedAt }; § "First start"; T21; T26: null for a missing file)', async () => {
  await withDir(async ({ dir }) => {
    eq(await call(storeAt(dir), 'readStarted'), null, 'readStarted() with no started.json (T26)');
    const started = { version: 1, firstStartedAt: iso(T0 - 3 * DAY) };
    await call(storeAt(dir), 'writeStarted', clone(started));
    assert(fs.existsSync(path.join(dir, 'started.json')), `writeStarted wrote no started.json (files: ${show(fs.readdirSync(dir))})`);
    const back = await call(storeAt(dir), 'readStarted');
    same(pick(back, ['version', 'firstStartedAt']), started, 'readStarted() from a fresh store');
  });
});

test('RS8: writeRecord writes <dir>/record.json holding the body plus a sha256 that is exactly SHA-256 (lower-case hex) over the UTF-8 of JSON.stringify of the record without sha256, object keys sorted recursively — computed here and compared — for the body, a different body, and a body handed in still carrying a stale sha256 (which is replaced, not hashed); readRecord from a fresh store gives the body back (ADR state-file table; T21: "writeRecord(body) adds sha256 over the canonical body"; T26: the sha256\'s exact input)', async () => {
  await withDir(async ({ dir }) => {
    const file = path.join(dir, 'record.json');
    const problems = [];
    const rows = [
      { name: 'the body', body: recordBody(), hand: recordBody() },
      { name: 'a different body', body: recordBody({ compactedAt: iso(T0), heard: [] }), hand: recordBody({ compactedAt: iso(T0), heard: [] }) },
      { name: 'a body carrying a stale sha256', body: recordBody(), hand: { ...recordBody(), sha256: 'f'.repeat(64) } },
    ];
    for (const r of rows) {
      await call(storeAt(dir), 'writeRecord', clone(r.hand));
      if (!fs.existsSync(file)) { problems.push(`[${r.name}] writeRecord wrote no record.json (files: ${show(fs.readdirSync(dir))})`); continue; }
      const onDisk = JSON.parse(fs.readFileSync(file, 'utf8'));
      const want = recordSha(r.body);
      if (onDisk.sha256 !== want) problems.push(`[${r.name}] record.json's sha256 should be ${want} (T26: sha256 over JSON.stringify of the record without sha256, keys sorted recursively); it is ${show(onDisk.sha256)}`);
      if (exact(withoutSha(onDisk)) !== exact(r.body)) problems.push(`[${r.name}] record.json should hold the body plus sha256;\n          body:    ${show(r.body)}\n          on disk: ${show(withoutSha(onDisk))}`);
      const back = await call(storeAt(dir), 'readRecord');
      if (!back || back.unreadable) problems.push(`[${r.name}] readRecord() should give the record back; gave ${show(back)}`);
      else if (exact(withoutSha(back)) !== exact(r.body)) problems.push(`[${r.name}] readRecord() should give the body back;\n          body: ${show(r.body)}\n          got:  ${show(withoutSha(back))}`);
    }
    assert(problems.length === 0, problems.join('\n        '));
  });
});

test('RS9: with no record.json readRecord gives null (T21)', async () => {
  await withDir(async ({ dir }) => {
    eq(await call(storeAt(dir), 'readRecord'), null, 'readRecord() with no record.json');
  });
});

test('RS10: a record.json that does not match its sha256 or its version reads as { unreadable: true, reason: "record-unreadable" } — a changed value, an added seen entry, an altered or missing sha256, a torn or non-JSON file, the version edited to 2, and a version-2 body the store itself hashed — so the path re-baselines as not-established instead of trusting it (AC-4 "a lost record"; ADR § "Lost record"; T21: "a sha256 or version mismatch counts")', async () => {
  const flipHex = (h) => `${h[0] === '0' ? '1' : '0'}${h.slice(1)}`;
  await cases([
    { name: 'a changed value', edit: (r) => ({ ...r, firstStartedAt: iso(T0 - 9 * DAY) }) },
    { name: 'an added seen entry', edit: (r) => ({ ...r, seen: [...r.seen, [idOf('rs-forged'), ADDRESS]] }) },
    { name: 'a removed baseline id', edit: (r) => ({ ...r, baseline: [] }) },
    { name: 'the sha256 altered', edit: (r) => ({ ...r, sha256: flipHex(String(r.sha256)) }) },
    { name: 'the sha256 removed', edit: (r) => withoutSha(r) },
    { name: 'the version edited to 2', edit: (r) => ({ ...r, version: 2 }) },
    { name: 'a torn file', raw: (text) => text.slice(0, Math.floor(text.length / 2)) },
    { name: 'not JSON', raw: () => 'record' },
    { name: 'a version-2 body the store hashed', storeWrites: recordBody({ version: 2 }) },
  ], async (c) => {
    await withDir(async ({ dir }) => {
      const file = path.join(dir, 'record.json');
      if (c.storeWrites) {
        let threw = false;
        try { await call(storeAt(dir), 'writeRecord', clone(c.storeWrites)); } catch (e) {
          if (/not implemented yet|gives no/.test(e.message)) throw e;
          threw = true; // refusing to write a version-2 record is also fine
        }
        if (threw || !fs.existsSync(file) || JSON.parse(fs.readFileSync(file, 'utf8')).version !== 2) return; // nothing version-2 on disk to read
      } else {
        await call(storeAt(dir), 'writeRecord', recordBody());
        const text = fs.readFileSync(file, 'utf8');
        fs.writeFileSync(file, c.raw ? c.raw(text) : JSON.stringify(c.edit(JSON.parse(text))));
      }
      let r;
      try { r = await call(storeAt(dir), 'readRecord'); } catch (e) {
        if (/not implemented yet|gives no/.test(e.message)) throw e;
        throw new Error(`readRecord() threw instead of answering unreadable: ${firstLine(e)}`);
      }
      assert(r && r.unreadable === true && r.reason === 'record-unreadable', `readRecord() should give { unreadable: true, reason: 'record-unreadable' }; gave ${show(r)}`);
    });
  });
});

test('RS11: openJournal() cuts a torn tail — the partial last line a crash mid-append leaves — back to just after the last newline byte, on disk and byte for byte before it returns, fsyncs that cut, and yields only the complete lines; a torn multi-byte character is cut by bytes, and a journal holding only a partial line is cut to 0 bytes and yields nothing (ADR § "Journal rules": "cut back to just after its last newline and fsynced"; T21)', async () => {
  const utf8 = Buffer.from(L_UTF8, 'utf8');
  const midChar = utf8.indexOf(Buffer.from('☕', 'utf8')) + 1; // inside the 3-byte sequence
  await cases([
    { name: 'two complete lines and a torn third', before: Buffer.from(L_V + L_D + L_C.slice(0, 25)), after: L_V + L_D },
    { name: 'a line torn inside a multi-byte character', before: Buffer.concat([Buffer.from(L_V), utf8.subarray(0, midChar)]), after: L_V },
    { name: 'a complete multi-byte line and a torn one', before: Buffer.concat([utf8, Buffer.from(L_B.slice(0, 12))]), after: L_UTF8 },
    { name: 'only a partial line', before: Buffer.from(L_B.slice(0, 10)), after: '' },
  ], async (c) => {
    await withDir(async ({ root, dir }) => {
      const jf = path.join(dir, JOURNAL);
      fs.writeFileSync(jf, c.before);
      const t = await traced(root, {}, async () => call(storeAt(dir), 'openJournal'));
      if (t.error) throw (/not implemented yet|gives no/.test(t.error.message) ? t.error : new Error(`openJournal() threw: ${firstLine(t.error)}`));
      const disk = fs.readFileSync(jf);
      const want = Buffer.from(c.after, 'utf8');
      assert(disk.equals(want), `journal.jsonl right after openJournal() returned should be cut to ${want.length} bytes\n          expected: ${show(want)}\n          actual:   ${show(disk)}`);
      assert(durableAfterCut(t.ops, REL_JOURNAL), `the cut journal was never fsynced (no fsync of ${REL_JOURNAL} after its truncation, and no fsynced file renamed onto it); observed ${show(t.ops)}`);
      same(linesOf(t.result, c.name), linesOfText(c.after), 'the lines openJournal() yields');
    });
  });
});

test('RS12: after openJournal() cuts a torn tail, appending continues cleanly — the next line starts on a line of its own, never glued to the partial one — and a later openJournal() yields the old lines then the new (ADR § "Journal rules": the cut comes "at open, before the first append"; T21)', async () => {
  await withDir(async ({ dir }) => {
    const jf = path.join(dir, JOURNAL);
    fs.writeFileSync(jf, L_V + L_D.slice(0, 30));
    const store = storeAt(dir);
    linesOf(await call(store, 'openJournal'), 'the first open');
    await call(store, 'appendJournal', [L_C]);
    const disk = fs.readFileSync(jf, 'utf8');
    eq(disk, L_V + L_C, 'journal.jsonl after the cut and one append');
    same(linesOf(await call(storeAt(dir), 'openJournal'), 'the second open'), [strip(L_V), strip(L_C)], 'the lines a later openJournal() yields');
  });
});

test('RS13: appendJournal(lines) appends in order and fsyncs the journal on every call; the bytes on disk are exactly the lines concatenated, and openJournal() from a fresh store yields them back in order (ADR state-file table: journal.jsonl "flushed and fsynced"; T19 lines; T21)', async () => {
  await withDir(async ({ root, dir }) => {
    const jf = path.join(dir, JOURNAL);
    fs.writeFileSync(jf, '');
    const problems = [];
    /** One store per window: opened first (as the engine does), then only the append is watched for its fsync. */
    const appendWatched = async (label, lines) => {
      let mark = 0;
      const t = await traced(root, {}, async (ops) => {
        const store = storeAt(dir);
        linesOf(await call(store, 'openJournal'), `${label}: the open before appending`);
        mark = ops.length;
        return call(store, 'appendJournal', lines);
      });
      if (t.error) throw (/not implemented yet|gives no|openJournal/.test(t.error.message) ? t.error : new Error(`${label}: appendJournal() threw: ${firstLine(t.error)}`));
      if (!fsyncedAny(t.ops.slice(mark), REL_JOURNAL)) problems.push(`${label}: appendJournal() never fsynced ${REL_JOURNAL}; observed during the append ${show(t.ops.slice(mark))}`);
    };
    await appendWatched('the first append', [L_V, L_D]);
    await appendWatched('the second append', [L_UTF8]);
    const disk = fs.readFileSync(jf);
    const want = Buffer.from(L_V + L_D + L_UTF8, 'utf8');
    if (!disk.equals(want)) problems.push(`journal.jsonl should be the lines concatenated\n          expected: ${show(want)}\n          actual:   ${show(disk)}`);
    const lines = linesOf(await call(storeAt(dir), 'openJournal'), 'the reopen');
    if (exact(lines) !== exact([L_V, L_D, L_UTF8].map(strip))) problems.push(`openJournal() should yield the three lines in order; yielded ${show(lines)}`);
    assert(problems.length === 0, problems.join('\n        '));
  });
});

test('RS14: openJournal() on a journal whose last line ends in a newline changes nothing on disk and yields every line (ADR § "Journal rules"; T21)', async () => {
  await withDir(async ({ dir }) => {
    const jf = path.join(dir, JOURNAL);
    const text = L_V + L_D + L_C;
    fs.writeFileSync(jf, text);
    const lines = linesOf(await call(storeAt(dir), 'openJournal'), 'an intact journal');
    eq(fs.readFileSync(jf, 'utf8'), text, 'journal.jsonl after openJournal()');
    same(lines, [L_V, L_D, L_C].map(strip), 'the lines openJournal() yields');
  });
});

test('RS15: a journal that cannot be opened or read at all (a directory in its place) makes openJournal() answer { unreadable: true } without throwing — the lost-record signal "journal-unreadable" (AC-4; ADR § "Journal rules", § "Lost record"; T21)', async () => {
  await withDir(async ({ dir }) => {
    fs.mkdirSync(path.join(dir, JOURNAL));
    let r;
    try { r = await call(storeAt(dir), 'openJournal'); } catch (e) {
      if (/not implemented yet|gives no/.test(e.message)) throw e;
      throw new Error(`openJournal() threw instead of answering { unreadable: true }: ${firstLine(e)}`);
    }
    assert(r && r.unreadable === true, `openJournal() should give { unreadable: true }; gave ${show(r)}`);
  });
});

test('RS16: truncateJournal() empties the journal — journalBytes() is 0 and a fresh openJournal() yields no line and is not unreadable (a compaction is never a lost record) — and a later append starts the journal again (ADR § "Compaction": "writes record.json and truncates the journal"; T21)', async () => {
  await withDir(async ({ dir }) => {
    const jf = path.join(dir, JOURNAL);
    fs.writeFileSync(jf, '');
    const store = storeAt(dir);
    linesOf(await call(store, 'openJournal'), 'the first open');
    await call(store, 'appendJournal', [L_V, L_C]);
    await call(store, 'truncateJournal');
    const problems = [];
    const bytes = await call(store, 'journalBytes');
    if (bytes !== 0) problems.push(`journalBytes() after truncateJournal() should be 0; is ${show(bytes)}`);
    if (fs.existsSync(jf) && fs.statSync(jf).size !== 0) problems.push(`journal.jsonl still holds ${fs.statSync(jf).size} bytes`);
    const again = storeAt(dir); // a restart after the compaction
    const reopened = await call(again, 'openJournal');
    if (!reopened || reopened.unreadable) problems.push(`openJournal() after a truncation should not read as a lost record; gave ${show(reopened)}`);
    else {
      const lines = linesOf(reopened, 'the open after truncation');
      if (lines.length) problems.push(`openJournal() after truncateJournal() yielded ${show(lines)}`);
    }
    try {
      await call(again, 'appendJournal', [L_B]);
      const after = linesOf(await call(storeAt(dir), 'openJournal'), 'the open after a fresh append');
      if (exact(after) !== exact([strip(L_B)])) problems.push(`after truncating then appending one line, openJournal() yielded ${show(after)}`);
      const n = await call(storeAt(dir), 'journalBytes');
      if (n !== Buffer.byteLength(L_B, 'utf8')) problems.push(`journalBytes() after one append should be ${Buffer.byteLength(L_B, 'utf8')}; is ${show(n)}`);
    } catch (e) {
      problems.push(`appending after truncateJournal() failed: ${firstLine(e)}`);
    }
    assert(problems.length === 0, problems.join('\n        '));
  });
});

test('RS17: journalBytes() is the journal\'s size in bytes — UTF-8 bytes, not characters — growing with each append (the compaction trigger at 1 MiB and the status\'s journal.bytes; ADR § "Compaction"; T21)', async () => {
  await withDir(async ({ dir }) => {
    const jf = path.join(dir, JOURNAL);
    fs.writeFileSync(jf, '');
    const store = storeAt(dir);
    linesOf(await call(store, 'openJournal'), 'the open');
    const problems = [];
    const at0 = await call(store, 'journalBytes');
    if (at0 !== 0) problems.push(`an empty journal's journalBytes() should be 0; is ${show(at0)}`);
    await call(store, 'appendJournal', [L_UTF8]);
    const at1 = await call(store, 'journalBytes');
    const want1 = Buffer.byteLength(L_UTF8, 'utf8');
    if (at1 !== want1) problems.push(`after one multi-byte line (${L_UTF8.length} characters, ${want1} bytes) journalBytes() should be ${want1}; is ${show(at1)}`);
    await call(store, 'appendJournal', [L_V, L_C]);
    const at2 = await call(store, 'journalBytes');
    const want2 = fs.statSync(jf).size;
    if (at2 !== want2) problems.push(`after three lines journalBytes() should be the file's size, ${want2}; is ${show(at2)}`);
    assert(problems.length === 0, problems.join('\n        '));
  });
});

test('RS18: writeStatus writes <dir>/status.json, whose JSON holds every field written — the file the public status route reads — and readStatus from a fresh store gives them back; before any write readStatus gives null (AC-6 "it survives restarts and deploys"; ADR § "Status and switch"; T21, T22; T26: null for a missing file)', async () => {
  await withDir(async ({ dir }) => {
    eq(await call(storeAt(dir), 'readStatus'), null, 'readStatus() with no status.json (T26)');
    const status = fullStatus();
    await call(storeAt(dir), 'writeStatus', clone(status));
    const file = path.join(dir, 'status.json');
    assert(fs.existsSync(file), `writeStatus wrote no status.json (files: ${show(fs.readdirSync(dir))})`);
    const onDisk = JSON.parse(fs.readFileSync(file, 'utf8'));
    same(pick(onDisk, Object.keys(status)), status, 'status.json on disk (every field written)');
    const back = await call(storeAt(dir), 'readStatus');
    same(pick(back, Object.keys(status)), status, 'readStatus() from a fresh store');
  });
});

test('RS19: every whole-file write is atomic — with each rename onto the target failing, writeSwitch, writeStarted, writeRecord and writeStatus each fail loudly and leave the old file byte for byte, and the matching read still gives the old value (ADR state-file table: "atomically"; T21: "Whole-file writes go through state.writeAtomic"; tested by outcome, T21 has no injection seam); story 5 extends it to writeSwitch of a version 2 record and to writeSwitchHistory over switch-history.json (ADR 0005 D1: "pretty JSON, written with state.writeAtomic"; Seams "The store": RS19 extended)', async () => {
  const rows = [
    { name: 'writeSwitch', file: 'switch.json', read: 'readSwitch', v1: SW_ON, v2: SW_OFF, key: (r) => pick(r, ['on', 'changedAt']) },
    { name: 'writeStarted', file: 'started.json', read: 'readStarted', v1: { version: 1, firstStartedAt: iso(T0 - DAY) }, v2: { version: 1, firstStartedAt: iso(T0) }, key: (r) => pick(r, ['firstStartedAt']) },
    { name: 'writeRecord', file: 'record.json', read: 'readRecord', v1: recordBody(), v2: recordBody({ compactedAt: iso(T0), seen: [] }), key: (r) => withoutSha(r) },
    { name: 'writeStatus', file: 'status.json', read: 'readStatus', v1: fullStatus(), v2: fullStatus({ state: 'stopped', seen: 1 }), key: (r) => pick(r, ['state', 'seen']) },
    { name: 'writeSwitch, version 2 (story 5)', method: 'writeSwitch', file: 'switch.json', read: 'readSwitch', v1: SW2_ON, v2: SW2_OFF, key: (r) => pick(r, ['on', 'changedAt']) },
    { name: 'writeSwitchHistory (story 5)', method: 'writeSwitchHistory', file: 'switch-history.json', read: 'readSwitchHistory', v1: HIST_A, v2: HIST_B, key: (r) => pick(r, ['version', 'changes']) },
  ];
  await cases(rows, async (c) => {
    const method = c.method || c.name;
    await withDir(async ({ root, dir }) => {
      const file = path.join(dir, c.file);
      await call(storeAt(dir), method, clone(c.v1));
      assert(fs.existsSync(file), `${method} wrote no ${c.file}`);
      const old = fs.readFileSync(file);
      const t = await traced(root, { failRenameOnto: [`realtime/${c.file}`] }, async () => call(storeAt(dir), method, clone(c.v2)));
      const problems = [];
      if (!t.error) problems.push(`${c.name} succeeded although every rename onto ${c.file} failed — it did not write through a temp file and a rename (observed ${show(t.ops)})`);
      if (!fs.readFileSync(file).equals(old)) problems.push(`${c.file} changed although its rename failed:\n          before: ${show(old)}\n          after:  ${show(fs.readFileSync(file))}`);
      const back = await call(storeAt(dir), c.read);
      if (exact(c.key(back)) !== exact(c.key(c.v1))) problems.push(`${c.read}() after the failed write should give the old value ${show(c.key(c.v1))}; gave ${show(back)}`);
      assert(problems.length === 0, problems.join('\n          '));
    });
  });
});

test('RS20: createStore({}) defaults its directory to <stateDir>/realtime — TAGGING_EDGES_STATE_DIR when set — and a write there makes realtime/ when missing, so switch.json lands where the status route reads it (T21: "dir defaults to path.join(state.stateDir(), \'realtime\')"; T22)', async () => {
  await withDir(async ({ root }) => {
    await withEnv({ TAGGING_EDGES_STATE_DIR: root }, async () => {
      const store = storeAt(undefined);
      await call(store, 'writeSwitch', clone(SW_ON));
      const file = path.join(root, 'realtime', 'switch.json');
      assert(fs.existsSync(file), `createStore({}).writeSwitch should write <TAGGING_EDGES_STATE_DIR>/realtime/switch.json; the state directory holds ${show(snapshot(root))}`);
      const back = await call(storeAt(undefined), 'readSwitch');
      same(pick(back, ['on', 'changedAt']), pick(SW_ON, ['on', 'changedAt']), 'readSwitch() from createStore({})');
    });
  }, { makeRealtime: false });
});

test('RS21: the store writes only inside its own directory — the pass\'s report.json, held/ and pass.lock beside it are left byte for byte, and no file appears outside realtime/ (AC-6 "separate from the pass\'s report … without changing it"; ADR 0002 binding 4 as settled by ADR 0003: the path never writes report.json; T21); story 5 extends it to a version 2 writeSwitch and to writeSwitchHistory / readSwitchHistory, whose file is realtime/switch-history.json — and unlinkSwitch, the off fallback, leaves that history file byte for byte (ADR 0005 D1: "Both files are in <stateDir>/realtime/"; Option A: "The off fallback\'s unlink leaves the history file intact"; Seams "The store": RS21 extended)', async () => {
  await withDir(async ({ root, dir }) => {
    fs.writeFileSync(path.join(root, 'report.json'), `${JSON.stringify({ reportVersion: 1, latest: null, previous: [] }, null, 2)}\n`);
    fs.mkdirSync(path.join(root, 'held'));
    fs.writeFileSync(path.join(root, 'held', '20260928T030000Z-aaaaaaa1.json'), '{"runId":"20260928T030000Z-aaaaaaa1","held":[]}\n');
    fs.writeFileSync(path.join(root, 'pass.lock'), '');
    const before = snapshot(root, 'realtime');
    const store = storeAt(dir);
    const problems = [];
    /** Story 5's calls: a missing method is a problem, and the story-3 checks below still run. */
    const story5 = async (name, ...args) => { try { return await call(store, name, ...args); } catch (e) { problems.push(`${name}: ${firstLine(e)}`); return undefined; } };
    await call(store, 'writeSwitch', clone(SW_ON));
    await call(store, 'writeStarted', { version: 1, firstStartedAt: iso(T0) });
    await call(store, 'writeRecord', recordBody());
    await call(store, 'writeStatus', fullStatus());
    fs.writeFileSync(path.join(dir, JOURNAL), '');
    linesOf(await call(store, 'openJournal'), 'the open');
    await call(store, 'appendJournal', [L_V]);
    await call(store, 'truncateJournal');
    await call(store, 'writeSwitch', clone(SW2_ON));
    await story5('writeSwitchHistory', clone(HIST_A));
    await story5('readSwitchHistory');
    const histFile = path.join(dir, 'switch-history.json');
    const histBefore = fs.existsSync(histFile) ? fs.readFileSync(histFile) : null;
    if (histBefore === null) problems.push(`writeSwitchHistory wrote no realtime/switch-history.json (ADR 0005 D1); realtime/ holds ${show(fs.readdirSync(dir))}`);
    await call(store, 'unlinkSwitch');
    if (histBefore !== null) {
      const histAfter = fs.existsSync(histFile) ? fs.readFileSync(histFile) : null;
      if (histAfter === null || !histAfter.equals(histBefore)) problems.push(`unlinkSwitch() changed switch-history.json (ADR 0005: the off fallback's unlink leaves the history intact)\n          before: ${show(histBefore)}\n          after:  ${show(histAfter)}`);
    }
    const after = snapshot(root, 'realtime');
    if (exact(after) !== exact(before)) problems.push(`the state directory outside realtime/ (file → base64 bytes) changed\n          expected: ${show(before)}\n          actual:   ${show(after)}`);
    assert(problems.length === 0, problems.join('\n        '));
  });
});

test('RS22: every store method is synchronous — none returns a promise or other thenable — writeSwitch, readSwitch, unlinkSwitch, writeStarted, readStarted, writeRecord, readRecord, openJournal, appendJournal, journalBytes, truncateJournal, writeStatus and readStatus (T26: "Methods are synchronous (awaiting works)"); story 5 adds writeSwitchHistory and readSwitchHistory (ADR 0005 D1: "readSwitchHistory() and writeSwitchHistory(obj) are synchronous"; Seams "The store": RS22 extended)', async () => {
  await withDir(async ({ dir }) => {
    const store = storeAt(dir);
    const steps = [
      ['writeSwitch', [clone(SW_ON)]], ['readSwitch', []], ['unlinkSwitch', []],
      ['writeStarted', [{ version: 1, firstStartedAt: iso(T0) }]], ['readStarted', []],
      ['writeRecord', [recordBody()]], ['readRecord', []],
      ['openJournal', []], ['appendJournal', [[L_V]]], ['journalBytes', []], ['truncateJournal', []],
      ['writeStatus', [fullStatus()]], ['readStatus', []],
      ['writeSwitchHistory', [clone(HIST_A)]], ['readSwitchHistory', []],
    ];
    const problems = [];
    for (const [name, args] of steps) {
      if (typeof store[name] !== 'function') { problems.push(`createStore() gives no ${name}() yet (T21${HISTORY_METHODS.includes(name) ? '; ADR 0005 D1' : ''})`); continue; }
      let out;
      try { out = store[name](...args); } catch (e) { problems.push(`${name}() threw: ${firstLine(e)}`); continue; }
      if (isThenable(out)) {
        problems.push(`${name}() returned a promise (T26: the store's methods are synchronous)`);
        try { await out; } catch (_) { /* settled; the problem is already recorded */ }
      }
    }
    assert(problems.length === 0, problems.join('\n        '));
  });
});

test('RS23: readRecord verifies the sha256 over the parsed record by T26\'s rule, not over the file\'s bytes — a record.json another writer left pretty-printed, with its keys reversed at every level, or with sha256 first, whose sha256 is T26\'s, reads back as its body; one whose sha256 was taken over the unsorted JSON or over JSON sorted at the top level only reads as { unreadable: true, reason: "record-unreadable" } (AC-4 "a lost record"; T21; T26: sha256 over JSON.stringify of the record without sha256, keys sorted recursively)', async () => {
  const body = recordBody();
  const sha = recordSha(body);
  const hex = (text) => crypto.createHash('sha256').update(text, 'utf8').digest('hex');
  const reversedDeep = (v) => {
    if (Array.isArray(v)) return v.map(reversedDeep);
    if (v && typeof v === 'object') return Object.keys(v).reverse().reduce((o, k) => { o[k] = reversedDeep(v[k]); return o; }, {});
    return v;
  };
  const topSorted = Object.keys(body).sort().reduce((o, k) => { o[k] = body[k]; return o; }, {});
  const compact = JSON.stringify(body);
  await cases([
    { name: 'pretty-printed, T26\'s sha256', text: `${JSON.stringify({ ...body, sha256: sha }, null, 2)}\n`, good: true },
    { name: 'keys reversed at every level, T26\'s sha256', text: JSON.stringify(reversedDeep({ ...body, sha256: sha })), good: true },
    { name: 'sha256 first, keys sorted', text: JSON.stringify({ sha256: sha, ...sortedDeep(body) }), good: true },
    { name: 'a sha256 over the unsorted JSON', text: JSON.stringify({ ...body, sha256: hex(compact) }), good: false },
    { name: 'a sha256 over JSON sorted at the top level only', text: JSON.stringify({ ...body, sha256: hex(JSON.stringify(topSorted)) }), good: false },
  ], async (c) => {
    await withDir(async ({ dir }) => {
      fs.writeFileSync(path.join(dir, 'record.json'), c.text);
      let r;
      try { r = await call(storeAt(dir), 'readRecord'); } catch (e) {
        if (/not implemented yet|gives no/.test(e.message)) throw e;
        throw new Error(`readRecord() threw: ${firstLine(e)}`);
      }
      if (c.good) {
        assert(r && r.unreadable !== true, `readRecord() should accept a record whose sha256 follows T26; gave ${show(r)}`);
        same(withoutSha(r), body, 'the body readRecord() gives back');
      } else {
        assert(r && r.unreadable === true && r.reason === 'record-unreadable', `readRecord() should give { unreadable: true, reason: 'record-unreadable' } for a sha256 not taken by T26's rule; gave ${show(r)}`);
      }
    });
  });
});

test('RS24: with no journal.jsonl (a first start) openJournal() gives { lines: [] } — not unreadable, no line — and a first appendJournal then starts the journal, which a later openJournal() yields (ADR § "Journal rules"; T21; T26: "openJournal() gives { lines: [] } for a missing journal.jsonl (not unreadable)")', async () => {
  await withDir(async ({ dir }) => {
    const jf = path.join(dir, JOURNAL);
    const store = storeAt(dir);
    let r;
    try { r = await call(store, 'openJournal'); } catch (e) {
      if (/not implemented yet|gives no/.test(e.message)) throw e;
      throw new Error(`openJournal() threw on a missing journal instead of giving { lines: [] }: ${firstLine(e)}`);
    }
    assert(r && typeof r === 'object' && r.unreadable !== true, `openJournal() with no journal.jsonl should give { lines: [] }, not unreadable (T26); gave ${show(r)}`);
    same(linesOf(r, 'a missing journal'), [], 'the lines openJournal() yields with no journal.jsonl');
    await call(store, 'appendJournal', [L_V, L_C]);
    assert(fs.existsSync(jf), 'appendJournal() after opening a missing journal wrote no journal.jsonl');
    eq(fs.readFileSync(jf, 'utf8'), L_V + L_C, 'journal.jsonl after the first append');
    same(linesOf(await call(storeAt(dir), 'openJournal'), 'the reopen'), [strip(L_V), strip(L_C)], 'the lines a later openJournal() yields');
  });
});

// ─── story 5: switch.json version 2 and switch-history.json (ADR 0005 D1; Seams "The store") ─────────────────────

test('RS25: createStore({ dir }) also gives readSwitchHistory and writeSwitchHistory, and store.js gives the pure parseSwitchHistory(text) [story 5 AC-5 "the last 10 changes"; ADR 0005 D1 Store, "New methods"; T21 as amended by ADR 0005]', async () => {
  await withDir(async ({ dir }) => {
    const store = storeAt(dir);
    const problems = [];
    const missing = HISTORY_METHODS.filter((m) => typeof store[m] !== 'function');
    if (missing.length) problems.push(`createStore({ dir }) lacks ${show(missing)} (ADR 0005 D1); it has ${show(Object.keys(store))}`);
    try { parseHistoryFn(store); } catch (e) { problems.push(firstLine(e)); }
    assert(problems.length === 0, problems.join('\n        '));
  });
});

test('RS26: writeSwitchHistory(obj) writes <dir>/switch-history.json beside switch.json — pretty JSON holding exactly the { version: 1, changes } it was given (a change not recorded, with null at, role and key, included; ten entries included), with no group or other permission bits, switch.json untouched — and readSwitchHistory() from a fresh store gives it back; with no history file readSwitchHistory() gives null [story 5 AC-5 "It lasts", "Who may read it"; ADR 0005 D1: "{version:1, changes:[{on, at, role, key}]} … pretty JSON, written with state.writeAtomic", "A missing file gives null"; Consequences: "files written 0600 inside a 0700 directory"]', async () => {
  await withDir(async ({ dir }) => {
    const store = storeAt(dir);
    for (const m of HISTORY_METHODS) assert(typeof store[m] === 'function', `createStore() gives no ${m}() yet (ADR 0005 D1)`);
    const problems = [];
    const none = await call(store, 'readSwitchHistory');
    if (none !== null) problems.push(`readSwitchHistory() with no switch-history.json should give null (ADR 0005 D1: "A missing file gives null"); gave ${show(none)}`);
    const swFile = path.join(dir, 'switch.json');
    fs.writeFileSync(swFile, canonicalSwitch2(SW2_OFF));
    const swBefore = fs.readFileSync(swFile);
    const file = path.join(dir, 'switch-history.json');
    for (const [name, hist] of [['four changes, the newest not recorded', HIST_B], ['ten changes', HIST_10]]) {
      try { await call(store, 'writeSwitchHistory', clone(hist)); } catch (e) { problems.push(`[${name}] writeSwitchHistory() threw: ${firstLine(e)}`); continue; }
      if (!fs.existsSync(file)) { problems.push(`[${name}] writeSwitchHistory wrote no <dir>/switch-history.json (files: ${show(fs.readdirSync(dir))})`); continue; }
      const text = fs.readFileSync(file, 'utf8');
      let parsed;
      try { parsed = JSON.parse(text); } catch (e) { problems.push(`[${name}] switch-history.json is not JSON: ${show(text)}`); continue; }
      if (exact(parsed) !== exact(hist)) problems.push(`[${name}] switch-history.json should hold exactly what was written\n          expected: ${show(hist)}\n          actual:   ${show(parsed)}`);
      if (!text.trim().includes('\n')) problems.push(`[${name}] switch-history.json should be pretty JSON (ADR 0005 D1), not one line: ${show(text)}`);
      const mode = fs.statSync(file).mode & 0o777;
      if (mode & 0o077) problems.push(`[${name}] switch-history.json is mode ${mode.toString(8)}: who changed the switch is readable beyond the file's owner (ADR 0005 Consequences: "files written 0600")`);
      const back = await call(storeAt(dir), 'readSwitchHistory');
      if (!back || back.unreadable === true || exact(pick(back, ['version', 'changes'])) !== exact(hist)) problems.push(`[${name}] readSwitchHistory() from a fresh store should give ${show(hist)} back; gave ${show(back)}`);
    }
    if (!fs.readFileSync(swFile).equals(swBefore)) problems.push(`writeSwitchHistory changed switch.json: ${show(fs.readFileSync(swFile))}`);
    assert(problems.length === 0, problems.join('\n        '));
  });
});

test('RS27: readSwitchHistory() and parseSwitchHistory(text) tell damage from a read error — text that does not parse or has the wrong shape (not JSON, empty, torn mid-write, JSON null, an array, no changes, changes an object, a string or null) gives { unreadable: true } with no readError; something other than a file at the path gives { unreadable: true, readError: <its code> }; a parseable history whose changes is an array of entries that are not valid is not unreadable (an entry\'s validity is switchRecord\'s); neither throws [ADR 0005 D1: "Readers tell a read error from damage. A missing file gives null. A read error other than ENOENT gives { unreadable: true, readError: code }. Text that does not parse, or has the wrong shape, gives { unreadable: true }"; D3: historyUnreadable when the file "does not parse, or its changes is not an array", and "a parseable history with no valid entries" apart]', async () => {
  const junk = { version: 1, changes: [{ on: 'yes' }, 7, null, { on: true, at: 'yesterday', role: 'stranger', key: 'zz' }] };
  await cases([
    { name: 'not JSON', text: 'history', want: 'damaged' },
    { name: 'empty', text: '', want: 'damaged' },
    { name: 'torn mid-write', text: '{\n  "version": 1,\n  "changes": [\n    { "on": tr', want: 'damaged' },
    { name: 'JSON null', text: 'null', want: 'damaged' },
    { name: 'an array', text: JSON.stringify(HIST_A.changes), want: 'damaged' },
    { name: 'no changes', text: '{"version":1}', want: 'damaged' },
    { name: 'changes an object', text: '{"version":1,"changes":{"0":{"on":true}}}', want: 'damaged' },
    { name: 'changes a string', text: '{"version":1,"changes":"[]"}', want: 'damaged' },
    { name: 'changes null', text: '{"version":1,"changes":null}', want: 'damaged' },
    { name: 'a directory in its place (a read error)', dirInPlace: true, want: 'read-error' },
    { name: 'parseable, with no valid entries', text: JSON.stringify(junk, null, 2), want: 'parsed' },
  ], async (c) => {
    await withDir(async ({ dir }) => {
      const file = path.join(dir, 'switch-history.json');
      if (c.dirInPlace) fs.mkdirSync(file); else fs.writeFileSync(file, c.text);
      const store = storeAt(dir);
      const problems = [];
      const readers = [];
      if (typeof store.readSwitchHistory !== 'function') problems.push('createStore() gives no readSwitchHistory() yet (ADR 0005 D1)');
      else {
        try { readers.push(['readSwitchHistory()', await store.readSwitchHistory()]); } catch (e) { problems.push(`readSwitchHistory() threw instead of answering: ${firstLine(e)}`); }
      }
      if (!c.dirInPlace) {
        let parse = null;
        try { parse = parseHistoryFn(store); } catch (e) { problems.push(firstLine(e)); }
        if (parse) { try { readers.push(['parseSwitchHistory(text)', parse(c.text)]); } catch (e) { problems.push(`parseSwitchHistory(text) threw instead of answering: ${firstLine(e)}`); } }
      }
      const code = c.want === 'read-error' ? dirReadCode(dir) : null;
      for (const [who, v] of readers) {
        if (c.want === 'damaged') {
          if (!v || v.unreadable !== true) problems.push(`${who} should give { unreadable: true }; gave ${show(v)}`);
          else if (v.readError != null) problems.push(`${who} gave a readError for damaged text, which is not a read error: ${show(v)}`);
        } else if (c.want === 'read-error') {
          if (!v || v.unreadable !== true || v.readError !== code) problems.push(`${who} should give { unreadable: true, readError: ${show(code)} }; gave ${show(v)}`);
        } else if (!v || v.unreadable === true || !Array.isArray(v.changes)) {
          problems.push(`${who} should give the parsed history (changes an array), not unreadable — an entry's validity is switchRecord's (ADR 0005 D3); gave ${show(v)}`);
        }
      }
      assert(problems.length === 0, problems.join('\n          '));
    });
  });
});

test('RS28: writeSwitch refuses a version 2 record whose role is not "owner" or "admin" — missing, null, empty, "stranger", "Owner" or "ADMIN" — throwing EBADSWITCH and leaving switch.json byte for byte (or absent), as it does for a non-boolean on; and a record with no version still serialises as version 1, exactly { version: 1, on, changedAt, changedBy } (story 3\'s writers stay valid) [ADR 0005 D1: "canonicalSwitch keeps throwing EBADSWITCH for a non-boolean on. It also throws for a version 2 record whose role is not \'owner\' or \'admin\'. A record with no version still serialises as version 1"]', async () => {
  const withoutRole = () => { const r = clone(SW2_ON); delete r.role; return r; };
  const noVersion = { on: true, changedAt: SW_ON.changedAt, changedBy: SW_ON.changedBy };
  await cases([
    { name: 'role missing', rec: withoutRole(), throws: true },
    { name: 'role null', rec: { ...SW2_ON, role: null }, throws: true },
    { name: 'role empty', rec: { ...SW2_ON, role: '' }, throws: true },
    { name: 'role "stranger"', rec: { ...SW2_ON, role: 'stranger' }, throws: true },
    { name: 'role "Owner"', rec: { ...SW2_ON, role: 'Owner' }, throws: true },
    { name: 'role "ADMIN", an off', rec: { ...SW2_OFF, role: 'ADMIN' }, throws: true },
    { name: 'a non-boolean on, version 2', rec: { ...SW2_ON, on: 'true' }, throws: true },
    { name: 'no version (story 3\'s shape)', rec: noVersion, text: canonicalSwitch({ version: 1, ...noVersion }) },
  ], async (c) => {
    for (const prior of [null, SW_OFF]) {
      const label = prior ? 'over an earlier switch.json' : 'with no switch.json';
      await withDir(async ({ dir }) => {
        const file = path.join(dir, 'switch.json');
        if (prior) await call(storeAt(dir), 'writeSwitch', clone(prior));
        const old = prior ? fs.readFileSync(file) : null;
        let err = null;
        try { await call(storeAt(dir), 'writeSwitch', clone(c.rec)); } catch (e) { if (/gives no/.test(e.message)) throw e; err = e; }
        const now = fs.existsSync(file) ? fs.readFileSync(file) : null;
        if (c.throws) {
          assert(err && err.code === 'EBADSWITCH', `${label}: writeSwitch(${show(c.rec)}) should throw EBADSWITCH (ADR 0005 D1); ${err ? `it threw ${show(err.code)}: ${firstLine(err)}` : `it wrote ${show(now)}`}`);
          if (prior) assert(now && now.equals(old), `${label}: switch.json changed although the write was refused\n          before: ${show(old)}\n          after:  ${show(now)}`);
          else assert(now === null, `${label}: a refused write left switch.json ${show(now)}`);
        } else {
          assert(!err, `${label}: writeSwitch(${show(c.rec)}) threw: ${err && firstLine(err)}`);
          eq(now === null ? null : strip(now.toString('utf8')), c.text, `${label}: a record with no version should serialise as version 1 (ADR 0005 D1)`);
        }
      });
    }
  });
});

test('RS29: parseSwitch(text) and readSwitch() also give version — the raw parsed value: 2, 1, the string "2", and nothing when the file holds none (never defaulted) — and role and onSince: a version 2 owner\'s on and an admin\'s off give all six fields back, and the pre-story-5 version 1 record gives version 1 with no role or onSince [ADR 0005 D1: "parseSwitch, and so readSwitch, also returns version (the raw parsed value), role and onSince"; D3 reads version === 1 with no role as the pre-story-5 record; D10\'s local text]', async () => {
  const parseSwitch = need(loadStore(), 'parseSwitch', STORE_REL, 'T32');
  const D10 = { version: 1, on: false, changedAt: '2026-09-29T17:43:18.937Z', changedBy: 'f0178122' };
  const rows = [
    { name: 'version 2, the owner\'s on', text: canonicalSwitch2(SW2_ON), want: SW2_ON },
    { name: 'version 2, an admin\'s off', text: canonicalSwitch2(SW2_OFF), want: SW2_OFF },
    { name: 'version 1, D10\'s local record', text: JSON.stringify(D10), want: D10, none: ['role', 'onSince'] },
    { name: 'no version', text: JSON.stringify({ on: true, changedAt: SW_ON.changedAt, changedBy: OWNER8 }), want: { on: true, changedAt: SW_ON.changedAt, changedBy: OWNER8 }, none: ['version', 'role', 'onSince'] },
    { name: 'version the string "2"', text: JSON.stringify({ ...SW2_ON, version: '2' }), want: { ...SW2_ON, version: '2' } },
  ];
  const problems = [];
  for (const r of rows) {
    let got;
    try { got = parseSwitch(r.text); } catch (e) { problems.push(`[${r.name}] parseSwitch threw: ${firstLine(e)}`); continue; }
    if (!got || got.unreadable === true || exact(pick(got, Object.keys(r.want))) !== exact(r.want)) problems.push(`[${r.name}] parseSwitch should give ${show(r.want)} (ADR 0005 D1: version as parsed, role and onSince); gave ${show(got)}`);
    for (const k of r.none || []) if (got && got[k] != null) problems.push(`[${r.name}] parseSwitch gave ${k} ${show(got[k])}, which the file does not hold (ADR 0005 D1: the raw parsed value)`);
  }
  await withDir(async ({ dir }) => {
    for (const rec of [SW2_ON, SW2_OFF]) {
      await call(storeAt(dir), 'writeSwitch', clone(rec));
      const back = await call(storeAt(dir), 'readSwitch');
      if (!back || exact(pick(back, SWITCH2_KEYS)) !== exact(rec)) problems.push(`readSwitch() after writeSwitch(${show(rec)}) should give all six fields back (ADR 0005 D1); gave ${show(back)}`);
    }
  });
  assert(problems.length === 0, problems.join('\n        '));
});

test('RS30: readSwitch() tells a read error from damage — something other than a file at switch.json gives { unreadable: true, readError: <its code> }, never on; text that does not parse, or is not an object whose on is a boolean, gives { unreadable: true } with no readError; a missing file still gives null [ADR 0005 D1: "readSwitch gains the same readError field. The engine still sees unreadable and treats it as off, as today"; D2 step 2 keys on it]', async () => {
  await cases([
    { name: 'a directory in its place (a read error)', dirInPlace: true },
    { name: 'not JSON', text: 'on' },
    { name: 'torn mid-write', text: '{"version":2,"on":tr' },
    { name: '"on":"true", version 2', text: canonicalSwitch2({ ...SW2_ON, on: 'true' }) },
    { name: 'missing', missing: true },
  ], async (c) => {
    await withDir(async ({ dir }) => {
      const file = path.join(dir, 'switch.json');
      if (c.dirInPlace) fs.mkdirSync(file); else if (!c.missing) fs.writeFileSync(file, c.text);
      let r;
      try { r = await call(storeAt(dir), 'readSwitch'); } catch (e) {
        if (/not implemented yet|gives no/.test(e.message)) throw e;
        throw new Error(`readSwitch() threw instead of answering: ${firstLine(e)}`);
      }
      if (c.missing) { eq(r, null, 'readSwitch() with no switch.json'); return; }
      assert(r && r.unreadable === true && r.on !== true, `readSwitch() should give { unreadable: true }, never on; gave ${show(r)}`);
      if (c.dirInPlace) {
        const code = dirReadCode(dir);
        assert(r.readError === code, `readSwitch() should give { unreadable: true, readError: ${show(code)} } for a read error (ADR 0005 D1); gave ${show(r)}`);
      } else {
        assert(r.readError == null, `readSwitch() gave a readError for damaged text, which is not a read error (ADR 0005 D1): ${show(r)}`);
      }
    });
  });
});

test('RS31: who and when sit in files written 0600 inside a 0700 directory — writeSwitch of a version 2 record and writeSwitchHistory, each the first write into a realtime/ that does not exist yet, leave the file with no group or other permission bits and the realtime/ directory the store made with mode 0700 [story 5 AC-5 "Who may read it. Only a signed-in owner or admin may read who made a change"; ADR 0005 Consequences: "Who and when live on the data volume, in files written 0600 inside a 0700 directory"; D1: "Both files are in <stateDir>/realtime/"]', async () => {
  await cases([
    { name: 'writeSwitch, the owner\'s version 2 on', method: 'writeSwitch', file: 'switch.json', value: SW2_ON },
    { name: 'writeSwitch, an admin\'s version 2 off', method: 'writeSwitch', file: 'switch.json', value: SW2_OFF },
    { name: 'writeSwitchHistory (story 5)', method: 'writeSwitchHistory', file: 'switch-history.json', value: HIST_A },
  ], async (c) => {
    await withDir(async ({ dir }) => {
      assert(!fs.existsSync(dir), 'fixture: realtime/ should not exist before the store writes');
      await call(storeAt(dir), c.method, clone(c.value));
      const problems = [];
      const file = path.join(dir, c.file);
      if (!fs.existsSync(dir)) problems.push(`${c.method} made no realtime/ directory (ADR 0005 D1)`);
      else {
        const dirMode = fs.statSync(dir).mode & 0o777;
        if (dirMode !== 0o700) problems.push(`the realtime/ directory the store made is mode ${dirMode.toString(8)}, not 700 (ADR 0005 Consequences: "inside a 0700 directory")`);
      }
      if (!fs.existsSync(file)) problems.push(`${c.method} wrote no realtime/${c.file} (realtime/ holds ${show(fs.existsSync(dir) ? fs.readdirSync(dir) : null)})`);
      else {
        const mode = fs.statSync(file).mode & 0o777;
        if (mode & 0o077) problems.push(`realtime/${c.file} is mode ${mode.toString(8)}: who changed the switch is readable beyond the file's owner (ADR 0005 Consequences: "files written 0600")`);
      }
      assert(problems.length === 0, problems.join('\n          '));
    }, { makeRealtime: false });
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════
// RR — the routes module, src/api/tagging-edges/realtime.js (T22)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('RR1: src/api/tagging-edges/realtime.js exports computeRealtimeStatus, validateSwitch, handleRealtimeStatus and handleRealtimeSwitch (T22)', () => {
  const mod = loadRoutes();
  const missing = ROUTE_EXPORTS.filter((n) => typeof mod[n] !== 'function');
  assert(missing.length === 0, `${ROUTES_REL} lacks ${show(missing)}; it exports ${show(Object.keys(mod))}`);
});

test('RR2: computeRealtimeStatus takes on and onSince from the switch record alone — on: true gives on with onSince = its changedAt (as readSwitch or the raw file gives it); on: false, no switch.json (null) and an unreadable one all give off with onSince null; switchUnreadable is true only for { unreadable: true } (AC-5, AC-6 "whether the path is on … and since when"; ADR § "Status and switch"; T22; T27: "onSince is null when off"); story 5 adds rows — while on, onSince is the switch\'s onSince when that is an ISO time (version 2: the last off-to-on time, so an on while on does not move it), else its changedAt when that is an ISO time, else null; off gives null whatever the record holds; readSwitch\'s read error reads off and unreadable (story 5 AC-3; ADR 0005 D4: "The status\'s onSince becomes … This replaces realtime.js:97"; D1 readError)', () => {
  const compute = routeFn('computeRealtimeStatus');
  const rows = [
    { name: 'the raw switch.json, on', sw: SW_ON, on: true, since: SW_ON.changedAt, unreadable: false },
    { name: 'readSwitch()\'s shape, on', sw: pick(SW_ON, ['on', 'changedAt', 'changedBy']), on: true, since: SW_ON.changedAt, unreadable: false },
    { name: 'off', sw: SW_OFF, on: false, since: null, unreadable: false },
    { name: 'no switch.json (null)', sw: null, on: false, since: null, unreadable: false },
    { name: 'unreadable', sw: { unreadable: true }, on: false, since: null, unreadable: true },
    { name: 'version 2, an admin\'s on while on: the switch\'s onSince, not its changedAt (story 5)', sw: SW2_ON_AGAIN, on: true, since: SW2_ON_AGAIN.onSince, unreadable: false },
    { name: 'version 2 in readSwitch()\'s shape, the owner\'s on (story 5)', sw: pick(SW2_ON, SWITCH2_KEYS), on: true, since: SW2_ON.onSince, unreadable: false },
    { name: 'version 2, on, onSince not an ISO time: changedAt (story 5)', sw: { ...SW2_ON_AGAIN, onSince: 'two days ago' }, on: true, since: SW2_ON_AGAIN.changedAt, unreadable: false },
    { name: 'version 2, on, onSince null: changedAt (story 5)', sw: { ...SW2_ON_AGAIN, onSince: null }, on: true, since: SW2_ON_AGAIN.changedAt, unreadable: false },
    { name: 'on, neither onSince nor changedAt an ISO time: null (story 5)', sw: { ...SW2_ON, changedAt: 'yesterday', onSince: 'last week' }, on: true, since: null, unreadable: false },
    { name: 'version 1, on, changedAt not an ISO time: null (story 5)', sw: { ...SW_ON, changedAt: 'yesterday' }, on: true, since: null, unreadable: false },
    { name: 'version 2, off, carrying a stray onSince: null (story 5)', sw: { ...SW2_OFF, onSince: iso(T0 - DAY) }, on: false, since: null, unreadable: false },
    { name: 'a read error, as readSwitch() gives it (story 5)', sw: { unreadable: true, readError: 'EIO' }, on: false, since: null, unreadable: true },
  ];
  const problems = [];
  for (const r of rows) {
    // status.json's own on / onSince / switchUnreadable say the opposite, so a pass-through shows.
    const status = fullStatus({ on: !r.on, onSince: iso(T0 - 7 * DAY), switchUnreadable: !r.unreadable });
    let body;
    try { body = compute({ status, switchRecord: clone(r.sw), alive: true, now: T0 }); } catch (e) { problems.push(`[${r.name}] threw: ${firstLine(e)}`); continue; }
    if (!body || body.on !== r.on) problems.push(`[${r.name}] on should be ${r.on}; is ${show(body && body.on)}`);
    if (!body || body.onSince !== r.since) problems.push(`[${r.name}] onSince should be ${show(r.since)}; is ${show(body && body.onSince)}`);
    if (!body || body.switchUnreadable !== r.unreadable) problems.push(`[${r.name}] switchUnreadable should be ${r.unreadable}; is ${show(body && body.switchUnreadable)}`);
  }
  assert(problems.length === 0, problems.join('\n        '));
});

test('RR3: off shows at once — with switch.json off, missing or unreadable, the answer says on: false, onSince null and state "off" even while status.json still says state "live" (and holds a stored on: true) and the process is alive and running; with the switch on, state is status.json\'s (AC-5 "within a few seconds … its status says off"; ADR § "Status and switch": on from switch.json "so the answer says off at once"; T22; T27: "state is \'off\' whenever the switch is off", "onSince is null when off")', () => {
  const compute = routeFn('computeRealtimeStatus');
  const rows = [
    { name: 'switch off', sw: SW_OFF, on: false, state: 'off' },
    { name: 'no switch.json', sw: null, on: false, state: 'off' },
    { name: 'an unreadable switch.json', sw: { unreadable: true }, on: false, state: 'off' },
    { name: 'switch on (control)', sw: SW_ON, on: true, state: 'live' },
  ];
  const problems = [];
  for (const r of rows) {
    let body;
    try { body = compute({ status: fullStatus({ on: true, onSince: iso(T0 - 5 * DAY) }), switchRecord: clone(r.sw), alive: true, now: T0 }); } catch (e) { problems.push(`[${r.name}] threw: ${firstLine(e)}`); continue; }
    if (!body || body.on !== r.on) { problems.push(`[${r.name}] on should be ${r.on}; is ${show(body && body.on)}`); continue; }
    if (body.state !== r.state) problems.push(`[${r.name}] state should be ${show(r.state)} (status.json says "live"); is ${show(body.state)}`);
    if (!r.on && body.onSince !== null) problems.push(`[${r.name}] onSince should be null while off; is ${show(body.onSince)}`);
    if (body.running !== true) problems.push(`[${r.name}] running should be true (the process is still alive while it stops); is ${show(body.running)}`);
  }
  assert(problems.length === 0, problems.join('\n        '));
});

test('RR4: running and runningSince come from liveness and status.json\'s process alone — a status.json storing running: true, a runningSince and state "live" reads not running with runningSince null when the process is not alive; while it is alive, a stored running: false with a stored runningSince reads running with runningSince = process.startedAt (the stored copy ignored), and an empty status (no process named) reads running with runningSince present but carrying no time (null or undefined) (ADR § "Status and switch": "running comes only from state.isAlive(process)"; T22; T27: "runningSince is null when not alive"; T29: the route derives runningSince; T32: "The route\'s runningSince is process.startedAt while alive")', () => {
  const compute = routeFn('computeRealtimeStatus');
  const rows = [
    { name: 'stored running and runningSince, not alive', status: fullStatus({ running: true, runningSince: iso(T0 - HOUR) }), alive: false, running: false, since: null },
    { name: 'stored running and runningSince, an empty status, not alive', status: { running: true, runningSince: iso(T0 - HOUR) }, alive: false, running: false, since: null },
    { name: 'stored running: false and another runningSince, alive', status: fullStatus({ running: false, runningSince: iso(T0 - 7 * DAY), state: 'stopped' }), alive: true, running: true, since: PROCESS_STARTED_AT },
    { name: 'a full status, alive', status: fullStatus(), alive: true, running: true, since: PROCESS_STARTED_AT },
    { name: 'an empty status, alive', status: {}, alive: true, running: true, since: null },
  ];
  const problems = [];
  for (const r of rows) {
    let body;
    try { body = compute({ status: r.status, switchRecord: clone(SW_ON), alive: r.alive, now: T0 }); } catch (e) { problems.push(`[${r.name}] threw: ${firstLine(e)}`); continue; }
    if (!body || body.running !== r.running) { problems.push(`[${r.name}] running should be ${r.running}; is ${show(body && body.running)}`); continue; }
    if (!r.running && body.runningSince !== null) problems.push(`[${r.name}] runningSince should be null when not alive (T27); is ${show(body.runningSince)}`);
    if (r.running && !has(body, 'runningSince')) problems.push(`[${r.name}] the answer lacks runningSince (§ Status)`);
    else if (r.running && r.since !== null && body.runningSince !== r.since) problems.push(`[${r.name}] runningSince should be status.json's process.startedAt ${show(r.since)} while alive (T32); is ${show(body.runningSince)}`);
    else if (r.running && r.since === null && body.runningSince != null) problems.push(`[${r.name}] runningSince should carry no time when status.json names no process.startedAt (T32); is ${show(body.runningSince)}`);
  }
  assert(problems.length === 0, problems.join('\n        '));
});

test('RR5: stale is true exactly when the process is alive and status.json\'s updatedAt is missing, unparseable or more than 60 s old — 60 001 ms true, 60 000 ms false, 5 s false, missing, null, not a date or no status at all true while alive, an hour old or missing but not alive false — whatever stale value status.json stores (AC-6 "every figure covers the path\'s work up to at most 1 minute earlier"; T22: stale = alive && now − Date.parse(updatedAt) > 60000; T27: "stale is true when alive and updatedAt is missing, unparseable or older than 60 s")', () => {
  const compute = routeFn('computeRealtimeStatus');
  const noUpdatedAt = () => { const s = fullStatus({ stale: false }); delete s.updatedAt; return s; };
  const rows = [
    { name: 'alive, 60 001 ms old, stored stale: false', alive: true, status: fullStatus({ updatedAt: iso(T0 - 60001), stale: false }), stale: true },
    { name: 'alive, 60 000 ms old', alive: true, status: fullStatus({ updatedAt: iso(T0 - 60000), stale: true }), stale: false },
    { name: 'alive, 5 s old, stored stale: true', alive: true, status: fullStatus({ updatedAt: iso(T0 - 5000), stale: true }), stale: false },
    { name: 'not alive, 1 h old', alive: false, status: fullStatus({ updatedAt: iso(T0 - HOUR), stale: true }), stale: false },
    { name: 'alive, 10 min old', alive: true, status: fullStatus({ updatedAt: iso(T0 - 10 * MIN), stale: false }), stale: true },
    { name: 'alive, updatedAt missing, stored stale: false', alive: true, status: noUpdatedAt(), stale: true },
    { name: 'alive, updatedAt null', alive: true, status: fullStatus({ updatedAt: null, stale: false }), stale: true },
    { name: 'alive, updatedAt not a date', alive: true, status: fullStatus({ updatedAt: 'yesterday', stale: false }), stale: true },
    { name: 'alive, an empty status', alive: true, status: {}, stale: true },
    { name: 'alive, no status at all', alive: true, status: null, stale: true },
    { name: 'not alive, updatedAt missing', alive: false, status: noUpdatedAt(), stale: false },
    { name: 'not alive, updatedAt not a date', alive: false, status: fullStatus({ updatedAt: 'yesterday', stale: true }), stale: false },
  ];
  const problems = [];
  for (const r of rows) {
    let body;
    try { body = compute({ status: clone(r.status), switchRecord: clone(SW_ON), alive: r.alive, now: T0 }); } catch (e) { problems.push(`[${r.name}] threw: ${firstLine(e)}`); continue; }
    if (!body || body.stale !== r.stale) problems.push(`[${r.name}] stale should be ${r.stale}; is ${show(body && body.stale)}`);
  }
  assert(problems.length === 0, problems.join('\n        '));
});

test('RR6: every AC-6 figure status.json holds reaches the answer as it is — state, firstStartedAt, relay, subscription, lastReflectedAt, lastRound, catchUp (current and last, not-established included), every count (added, changed and changedBy, removed and removedBy, unchanged, peopleAdded, refused and leftInPlace by reason, deletionsMatchedNothing, deletionsForeign, failedReads, lostRaces, dbRefused by reason, heldPreExisting, removalsNotPrompted, relooks, conflicts, droppedOverBacklog, countsReset), pending, parked, seen, heard, journal, setupProblem (identity and schema), lastError (its code on the allow-list), preimageFile, process ({ pid, startTime, startedAt }) and updatedAt, with runningSince = process.startedAt while alive and a statusVersion — and the inputs are not changed (AC-6 "What it shows"; ADR § "Status and switch" field list; T22; T29: status.json\'s fields, the route deriving runningSince; T32: process { pid, startTime, startedAt }, "runningSince is process.startedAt while alive")', () => {
  const compute = routeFn('computeRealtimeStatus');
  const problems = [];
  for (const [name, status] of [['live', fullStatus()], ['waiting on an identity, catch-up under way', waitingStatus()], ['waiting on a schema rule', schemaStatus()]]) {
    const input = { status: clone(status), switchRecord: clone(SW_ON), alive: true, now: T0 };
    const before = exact(input);
    let body;
    try { body = compute(input); } catch (e) { problems.push(`[${name}] threw: ${firstLine(e)}`); continue; }
    if (exact(input) !== before) problems.push(`[${name}] computeRealtimeStatus changed its inputs`);
    for (const k of PASS_THROUGH) {
      if (!has(body, k)) problems.push(`[${name}] the answer lacks ${k}`);
      else if (exact(body[k]) !== exact(status[k])) problems.push(`[${name}] ${k} should be status.json's ${show(status[k])}; is ${show(body[k])}`);
    }
    if (!has(body, 'runningSince')) problems.push(`[${name}] the answer lacks runningSince (§ Status; T29: the route derives it)`);
    else if (body.runningSince !== status.process.startedAt) problems.push(`[${name}] runningSince should be status.json's process.startedAt ${show(status.process.startedAt)} while alive (T32); is ${show(body.runningSince)}`);
    if (!Number.isInteger(body.statusVersion) || body.statusVersion < 1) problems.push(`[${name}] statusVersion should be a whole number ≥ 1; is ${show(body.statusVersion)}`);
  }
  assert(problems.length === 0, problems.join('\n        '));
});

test('RR7: the answer adds no text of its own — every string in it, runningSince included, is one status.json holds, the switch\'s changedAt or changedBy prefix, a state name or \'error\' (the allow-list\'s stand-in) — for a full, waiting, empty and missing status and every switch, and none of those answers carries statusUnreadable (it is given status.json\'s value, or null for a missing file); with no status.json at all it still answers: off unless the switch says on, not running, not stale (AC-6 "What it never shows … error text included"; ADR § "Status and switch": "All text is fixed"; T22; T29: the route derives runningSince; T32: runningSince is process.startedAt, and a missing status.json is not statusUnreadable; T33: statusUnreadable is present only when status.json cannot be read)', () => {
  const compute = routeFn('computeRealtimeStatus');
  const problems = [];
  const statuses = [['full', fullStatus()], ['waiting', waitingStatus()], ['schema', schemaStatus()], ['empty', {}], ['missing', null]];
  const switches = [['on', SW_ON], ['off', SW_OFF], ['none', null], ['unreadable', { unreadable: true }]];
  for (const [sn, status] of statuses) {
    for (const [wn, sw] of switches) {
      for (const alive of [true, false]) {
        const label = `status ${sn}, switch ${wn}, ${alive ? 'alive' : 'not alive'}`;
        let body;
        try { body = compute({ status: clone(status), switchRecord: clone(sw), alive, now: T0 }); } catch (e) { problems.push(`[${label}] threw: ${firstLine(e)}`); continue; }
        if (!body || typeof body !== 'object') { problems.push(`[${label}] gave ${show(body)}`); continue; }
        const allowed = new Set([...stringsIn(status), ...(sw && !sw.unreadable ? [sw.changedAt, sw.changedBy] : []), ...STATES, 'error']);
        const added = [...new Set(stringsIn(body))].filter((s) => !allowed.has(s));
        if (added.length) problems.push(`[${label}] the answer carries text status.json does not hold: ${show(added)}`);
        if (!absent(body, 'statusUnreadable')) problems.push(`[${label}] the answer carries statusUnreadable ${show(body.statusUnreadable)} (T33: present only when status.json cannot be read)`);
        if (status === null && !alive) {
          if (body.on !== (sw === SW_ON)) problems.push(`[${label}] on should be ${sw === SW_ON}; is ${show(body.on)}`);
          if (body.running !== false) problems.push(`[${label}] running should be false; is ${show(body.running)}`);
          if (body.stale !== false) problems.push(`[${label}] stale should be false; is ${show(body.stale)}`);
        }
      }
    }
  }
  assert(problems.length === 0, problems.join('\n        '));
});

test('RR8: validateSwitch accepts only a JSON object whose on is a boolean — { on: true } and { on: false } give { ok: true, on } — and gives { ok: false, status: 400, error } for on as the string "true" or "false", 1, 0, null, an array, an object or a Boolean object, for no on, a differently-cased key or an own "__proto__" key carrying on, and for a body that is missing, null, a string, a boolean or an array (AC-5 bypass probing; ADR § "Status and switch": "on not a boolean → 400"; T22)', () => {
  const validate = routeFn('validateSwitch');
  const problems = [];
  for (const on of [true, false]) {
    const v = validate({ on });
    if (exact(v) !== exact({ ok: true, on })) problems.push(`validateSwitch({ on: ${on} }) should give { ok: true, on: ${on} }; gave ${show(v)}`);
  }
  const bad = [
    ['on "true"', { on: 'true' }], ['on "false"', { on: 'false' }], ['on 1', { on: 1 }], ['on 0', { on: 0 }],
    ['on null', { on: null }], ['on [true]', { on: [true] }], ['on {}', { on: {} }],
    // eslint-disable-next-line no-new-wrappers
    ['on a Boolean object', { on: new Boolean(true) }],
    ['no on', {}], ['"On": true', { On: true }], ['an own "__proto__" carrying on', JSON.parse('{"__proto__":{"on":true}}')],
    ['a missing body', undefined], ['a null body', null], ['a string body', 'on'], ['a boolean body', true], ['an array body', [true]],
  ];
  for (const [name, body] of bad) {
    let v;
    try { v = validate(body); } catch (e) { problems.push(`[${name}] threw: ${firstLine(e)}`); continue; }
    if (!v || v.ok !== false || v.status !== 400 || typeof v.error !== 'string' || !v.error) problems.push(`[${name}] should give { ok: false, status: 400, error }; gave ${show(v)}`);
  }
  assert(problems.length === 0, problems.join('\n        '));
});

test('RR9: POST switch with no session answers 401 — a loopback (req.localTrusted, 127.0.0.1) request included — and changes nothing: no file read, written or unlinked, no signal, no enqueue (AC-5 "any session that is not the owner\'s is refused and changes nothing"; ADR § "Status and switch": "No session → 401, loopback included"; T22)', async () => {
  const rows = [
    ['no session', { session: undefined }],
    ['a loopback request with no session', { session: undefined, localTrusted: true, ip: '127.0.0.1' }],
    ['a loopback request with an empty session', { session: {}, localTrusted: true, ip: '127.0.0.1' }],
    ['a session with no pubkey', { session: { authenticated: true } }],
  ];
  const problems = [];
  for (const [label, o] of rows) {
    problems.push(...refusalProblems(label, await callSwitch(switchReq({ on: true }, o), switchBundle()), [401]));
  }
  assert(problems.length === 0, problems.join('\n        '));
});

test('RR10: POST switch from any session that is neither a signed-in owner\'s nor a signed-in admin\'s answers 403 { success: false, error: "Owner or admin access required" } and changes and records nothing — a signed-in stranger (also on loopback), a stranger whose session claims admin flags (isAdmin, admin, role "admin") with no admin-list entry, the owner\'s pubkey in upper case or with a trailing space, an admin in upper case, an admin list holding the admin in upper case, the owner\'s or an admin\'s pubkey on a session whose authenticated is false, the string "true", 1 or absent, and a stranger or an admin when the admin lookup throws — while an admin, signed in from the same host, is now admitted and the change is written [story 5 AC-4 "It accepts a change only from a signed-in owner or admin", "It refuses everyone else, and changes and records nothing"; ADR 0005 D5 (the drift route\'s order and bodies; the role from configuration, never session flags) and Consequences "Tests that fail by design: RR10" — revised from story 3\'s owner-only rule; DR4\'s rows; T27 as amended: authenticated !== true with the owner\'s or an admin\'s pubkey answers 403]', async () => {
  const throwsAdmins = () => { throw new Error('could not source /etc/brainstorm.conf'); };
  const rows = [
    ['a signed-in stranger', { session: { authenticated: true, pubkey: STRANGER } }, {}],
    ['a stranger on loopback', { session: { authenticated: true, pubkey: STRANGER }, localTrusted: true, ip: '127.0.0.1' }, {}],
    ['a stranger whose session claims admin flags', { session: { authenticated: true, pubkey: STRANGER, isAdmin: true, admin: true, role: 'admin' } }, {}],
    ['the owner in upper case', { session: { authenticated: true, pubkey: OWNER.toUpperCase() } }, {}],
    ['the owner with a trailing space', { session: { authenticated: true, pubkey: `${OWNER} ` } }, {}],
    ['an admin in upper case', { session: { authenticated: true, pubkey: ADMIN.toUpperCase() } }, {}],
    ['an admin list holding the admin in upper case', { session: { authenticated: true, pubkey: ADMIN } }, { admins: [ADMIN.toUpperCase()] }],
    ['the owner, authenticated false', { session: { authenticated: false, pubkey: OWNER } }, {}],
    ['the owner, authenticated "true"', { session: { authenticated: 'true', pubkey: OWNER } }, {}],
    ['the owner, authenticated absent', { session: { pubkey: OWNER } }, {}],
    ['the owner, authenticated 1', { session: { authenticated: 1, pubkey: OWNER } }, {}],
    ['an admin, authenticated false', { session: { authenticated: false, pubkey: ADMIN } }, {}],
    ['an admin, authenticated "true"', { session: { authenticated: 'true', pubkey: ADMIN } }, {}],
    ['an admin, authenticated 1', { session: { authenticated: 1, pubkey: ADMIN } }, {}],
    ['an admin, authenticated absent', { session: { pubkey: ADMIN } }, {}],
    ['a stranger when the admin lookup throws', { session: { authenticated: true, pubkey: STRANGER } }, { admins: throwsAdmins }],
    ['an admin when the admin lookup throws', { session: { authenticated: true, pubkey: ADMIN } }, { admins: throwsAdmins }],
  ];
  const problems = [];
  for (const [label, o, bundle] of rows) {
    const r = await callSwitch(switchReq({ on: true }, o), switchBundle(bundle));
    problems.push(...refusalProblems(label, r, [403]), ...adminLeakProblems(label, r.res));
    if (r.res.statusCode === 403 && (!r.res.body || r.res.body.error !== 'Owner or admin access required')) problems.push(`${label}: the 403 should say "Owner or admin access required" (ADR 0005 D5: the drift route's bodies); it is ${show(r.res.body)}`);
  }
  // Story 5: an admin is admitted (ADR 0005 Consequences: "RR10: an admin may now switch"). RR15 pins the record.
  const admitted = await callSwitch(switchReq({ on: true }, { session: { authenticated: true, pubkey: ADMIN } }), switchBundle());
  if (admitted.res.statusCode !== 200) problems.push(`a signed-in admin, same host, answered ${showRes(admitted.res)}; expected 200 (story 5 AC-4: "It accepts a change only from a signed-in owner or admin")`);
  if (admitted.calls.writeSwitch.length !== 1) problems.push(`a signed-in admin's on should write the switch once; writeSwitch was called ${admitted.calls.writeSwitch.length} times`);
  assert(problems.length === 0, problems.join('\n        '));
});

test('RR11: POST switch answers 403 and changes nothing when the configured owner is not a lower-case 64-hex pubkey — empty, missing, null, upper-case or 63 characters, with the session holding that same value — or the owner lookup throws (ADR § "Status and switch": "equals the configured lowercase 64-hex owner"; the confirm route\'s pattern; T22)', async () => {
  const rows = [
    ['an empty owner', '', [401, 403]],
    ['no owner', undefined, [403]],
    ['a null owner', null, [403]],
    ['an upper-case owner', OWNER.toUpperCase(), [403]],
    ['a 63-character owner', OWNER.slice(1), [403]],
    ['an owner lookup that throws', 'throws', [403]],
  ];
  const problems = [];
  for (const [label, owner, statuses] of rows) {
    const getter = owner === 'throws' ? () => { throw new Error(`could not read /etc/brainstorm.conf for ${OWNER}`); } : () => owner;
    const sessionPubkey = typeof owner === 'string' && owner !== 'throws' ? owner : OWNER;
    const r = await callSwitch(switchReq({ on: true }, { session: { authenticated: true, pubkey: sessionPubkey } }), switchBundle({ owner: getter }));
    problems.push(...refusalProblems(label, r, statuses));
  }
  assert(problems.length === 0, problems.join('\n        '));
});

test('RR12: POST switch from the owner with an Origin naming another host answers 403 and changes nothing — another site, Origin null (a sandboxed frame), and a host that only starts with ours (AC-5; ADR § "Status and switch": "A cross-site Origin → 403 (sameHost)"; T22)', async () => {
  const rows = [
    ['Origin https://evil.example', 'https://evil.example'],
    ['Origin null', 'null'],
    ['a host that only starts with ours', `https://${HOST}.evil.test`],
  ];
  const problems = [];
  for (const [label, origin] of rows) {
    problems.push(...refusalProblems(label, await callSwitch(switchReq({ on: true }, { origin }), switchBundle()), [403]));
  }
  assert(problems.length === 0, problems.join('\n        '));
});

test('RR13: POST switch from the owner with a body that is not application/json answers 415 and changes nothing — text/plain, a form, multipart, no Content-Type (ADR § "Status and switch": "not application/json → 415 (isJson)"; T22)', async () => {
  const rows = [
    ['text/plain', 'text/plain'],
    ['a form', 'application/x-www-form-urlencoded'],
    ['multipart', 'multipart/form-data; boundary=x'],
    ['no Content-Type', null],
  ];
  const problems = [];
  for (const [label, contentType] of rows) {
    problems.push(...refusalProblems(label, await callSwitch(switchReq({ on: true }, { contentType }), switchBundle()), [415]));
  }
  assert(problems.length === 0, problems.join('\n        '));
});

test('RR14: POST switch from the owner whose on is not a boolean answers 400 before any file access — readFile, writeSwitch and unlinkSwitch never called — for on "true", "false", 1, 0, null, an array, no on, an own "__proto__" key, and a missing, string or array body (AC-5 bypass probing; ADR § "Status and switch": "on not a boolean → 400, before any file access"; T22)', async () => {
  const rows = [
    ['on "true"', { on: 'true' }], ['on "false"', { on: 'false' }], ['on 1', { on: 1 }], ['on 0', { on: 0 }],
    ['on null', { on: null }], ['on [true]', { on: [true] }], ['no on', {}],
    ['an own "__proto__" carrying on', JSON.parse('{"__proto__":{"on":true}}')],
    ['a missing body', undefined], ['a string body', 'true'], ['an array body', [true]],
  ];
  const problems = [];
  for (const [label, body] of rows) {
    problems.push(...refusalProblems(label, await callSwitch(switchReq(body), switchBundle()), [400]));
  }
  assert(problems.length === 0, problems.join('\n        '));
});

test('RR15: the owner or an admin, from the same host, with JSON, turns the path on and off — writeSwitch is called once with exactly the version 2 record { version: 2, on, changedAt: now as ISO, changedBy: the caller\'s 8-character prefix, role: "owner" or "admin" (from configuration, the owner checked first — never from session flags), onSince: now for an on from a missing switch, null for an off }; nothing is unlinked, no signal is sent and nothing is enqueued; the history then gains exactly that change — the last history write comes after writeSwitch and is { version: 1, changes: [{ on, at, role, key }] }, and no write before it holds the new change — and the answer is exactly 200 { success: true, on, changedAt, recorded: true, takesEffectWithinSeconds: 5 }, with no full pubkey — with no Origin, a same-host Origin, and the owner given as a string [story 5 AC-4, AC-5 "Every change records who made it (owner or admin, and a shortened key) and when"; ADR 0005 D1, D2 step 5 and its invariant, D4, D5, D11, and Consequences "Tests that fail by design: RR15" — revised from story 3\'s { version: 1, on, changedAt, changedBy: the owner\'s prefix } and its answer without recorded]', async () => {
  const rows = [
    { name: 'the owner, on, no Origin', on: true, o: {}, by: OWNER, role: 'owner' },
    { name: 'the owner, off, no Origin', on: false, o: {}, by: OWNER, role: 'owner' },
    { name: 'the owner, on, a same-host Origin', on: true, o: { origin: `https://${HOST}` }, by: OWNER, role: 'owner' },
    { name: 'the owner, off, the owner as a string', on: false, o: {}, bundle: { ownerString: OWNER }, by: OWNER, role: 'owner' },
    { name: 'an admin, on, no Origin', on: true, o: { session: { authenticated: true, pubkey: ADMIN } }, by: ADMIN, role: 'admin' },
    { name: 'an admin, off, a same-host Origin', on: false, o: { origin: `https://${HOST}`, session: { authenticated: true, pubkey: ADMIN } }, by: ADMIN, role: 'admin' },
    { name: 'an admin whose session claims owner flags is recorded as an admin', on: true, o: { session: { authenticated: true, pubkey: ADMIN, isOwner: true, owner: true, role: 'owner' } }, by: ADMIN, role: 'admin' },
    { name: 'the owner, also on the admin list, is recorded as the owner', on: false, o: {}, bundle: { admins: [ADMIN, OWNER] }, by: OWNER, role: 'owner' },
  ];
  await cases(rows, async (c) => {
    const r = await callSwitch(switchReq({ on: c.on }, c.o), switchBundle(c.bundle || {}));
    const problems = [];
    const want = { version: 2, on: c.on, changedAt: iso(T0), changedBy: c.by.slice(0, 8), role: c.role, onSince: c.on ? iso(T0) : null };
    if (r.res.statusCode !== 200) problems.push(`answered ${showRes(r.res)}, expected 200`);
    if (r.calls.writeSwitch.length !== 1) problems.push(`writeSwitch should be called once; was called ${r.calls.writeSwitch.length} times`);
    else if (exact(r.calls.writeSwitch[0]) !== exact(want)) problems.push(`writeSwitch should get exactly ${show(want)} (ADR 0005 D1, D4); got ${show(r.calls.writeSwitch[0])}`);
    if (r.calls.unlinkSwitch) problems.push('unlinkSwitch was called');
    if (r.kills.length) problems.push(`a signal was sent: ${show(r.kills)}`);
    if (r.calls.queue) problems.push('the task queue was touched');
    const writes = historyWrites(r.calls);
    const entry = { on: c.on, at: iso(T0), role: c.role, key: c.by.slice(0, 8) };
    const early = writes.filter((w) => !w.afterSwitch && holdsChangeAt(w, iso(T0)));
    if (early.length) problems.push(`a history write before writeSwitch holds the new change (ADR 0005 D2: "the history never receives the new change before switch.json does"): ${show(early.map((w) => w.obj))}`);
    const last = writes.length ? writes[writes.length - 1] : null;
    const fold = { version: 1, changes: [entry] };
    if (!last || !last.afterSwitch) problems.push(`the history should be written after writeSwitch with the change (ADR 0005 D2 step 5, the fold); history writes were ${show(writes)}; call order ${show(r.calls.seq)}`);
    else if (exact(last.obj) !== exact(fold)) problems.push(`the fold should write exactly ${show(fold)} (ADR 0005 D1, D2 step 5; nothing stored before); wrote ${show(last.obj)}`);
    const wantAnswer = { success: true, on: c.on, changedAt: iso(T0), recorded: true, takesEffectWithinSeconds: 5 };
    if (exact(r.res.body) !== exact(wantAnswer)) problems.push(`the answer should be exactly ${show(wantAnswer)} (ADR 0005 D11); it is ${show(r.res.body)}`);
    problems.push(...leakProblems(c.name, r.res), ...adminLeakProblems(c.name, r.res));
    assert(problems.length === 0, problems.join('\n          '));
  });
});

test('RR16: when writing an off switch fails — for lack of space (ENOSPC), an i/o error, or an error whose code is off the allow-list and whose message names a URI and a path — the route unlinks switch.json, which needs no free space and reads as off, and answers 200 { success: true, on: false }, naming no absolute path from the error (AC-5 "off means off"; ADR § "Status and switch": "If the atomic write for {on:false} fails (for example ENOSPC), it unlinks switch.json … and answers accordingly"; T22; T27: "A {on:false} whose write fails unlinks switch.json and answers 200 { success: true, on: false } when the unlink succeeds"); story 5 adds rows — an admin\'s off over the owner\'s recorded on, and the owner\'s off with nothing stored — whose answer is exactly 200 { success: true, on: false, recorded: false, takesEffectWithinSeconds: 5 }, with no history write after the failed writeSwitch and none holding the attempted off [story 5 AC-4 "An off still takes effect when the server cannot record it", AC-5 "The one exception … Its answer says the change could not be recorded"; ADR 0005 D2 step 5 "Call unlinkSwitch() … and run no fold. Answer as an off that was not recorded", D11]', async () => {
  const enospc = () => Object.assign(new Error(`ENOSPC: no space left on device, write '${SWITCH_FILE}.tmp-4242-0a1b2c3d'`), { code: 'ENOSPC' });
  await cases([
    { name: 'ENOSPC', err: enospc },
    { name: 'EIO', err: () => Object.assign(new Error(`EIO: i/o error, rename '${SWITCH_FILE}.tmp-4242-0a1b2c3d' -> '${SWITCH_FILE}'`), { code: 'EIO' }) },
    { name: 'an odd code with a URI and a path in its message', err: () => Object.assign(new Error(`connect ECONNREFUSED bolt://neo4j.internal:7687 at ${SWITCH_FILE}`), { code: ODD_CODE }) },
    { name: 'an admin\'s off over the owner\'s recorded on, ENOSPC (story 5)', err: enospc, story5: true, o: { session: { authenticated: true, pubkey: ADMIN } }, bundle: { prev: SW2_ON, hist: { version: 1, changes: [entryOf(SW2_ON)] } } },
    { name: 'the owner\'s off with nothing stored, an odd code (story 5)', err: () => Object.assign(new Error(`connect ECONNREFUSED bolt://neo4j.internal:7687 at ${SWITCH_FILE}`), { code: ODD_CODE }), story5: true },
  ], async (c) => {
    const r = await callSwitch(switchReq({ on: false }, c.o || {}), switchBundle({ writeError: c.err(), ...(c.bundle || {}) }));
    const problems = [];
    if (r.calls.writeSwitch.length !== 1) problems.push(`writeSwitch should be tried once; was called ${r.calls.writeSwitch.length} times`);
    if (r.calls.unlinkSwitch !== 1) problems.push(`unlinkSwitch should be called once after the failed write; was called ${r.calls.unlinkSwitch} times`);
    else if (r.calls.order.join(',') !== 'writeSwitch,unlinkSwitch') problems.push(`the unlink should follow the failed write; order was ${show(r.calls.order)}`);
    if (r.res.statusCode !== 200) problems.push(`answered ${showRes(r.res)}, expected 200 (the switch now reads as off)`);
    const b = r.res.body || {};
    if (b.on !== false) problems.push(`the answer should say on: false; it is ${show(b)}`);
    if (b.success !== true) problems.push(`the answer should say success: true (the path is off); it is ${show(b)}`);
    if (r.kills.length) problems.push(`a signal was sent: ${show(r.kills)}`);
    problems.push(...leakProblems(`a failed off-write (${c.name})`, r.res));
    if (c.story5) {
      const wantAnswer = { success: true, on: false, recorded: false, takesEffectWithinSeconds: 5 };
      if (exact(r.res.body) !== exact(wantAnswer)) problems.push(`the answer should be exactly ${show(wantAnswer)} (ADR 0005 D11: "An off that was not recorded"); it is ${show(r.res.body)}`);
      problems.push(...noFoldProblems(r, iso(T0)), ...adminLeakProblems(c.name, r.res));
    }
    assert(problems.length === 0, problems.join('\n          '));
  });
});

test('RR17: a switch write that fails otherwise never answers success — turning on with ENOSPC answers 500, does not say on and unlinks nothing; an off-write whose unlink also fails answers 500; and an error whose code is not on the allow-list (neo4j.internal:7687) or whose message names a path or URI reaches the answer as none of those (AC-5; AC-6 "never … the address the database … is reached at, error text included"; ADR § "Status and switch" and the error-code allow-list; "Tests the Tester owns → The routes": err.code = \'neo4j.internal\' → \'error\'; T22; T27: "A failed on-write answers 500, never success: true, and does not unlink", an off-write whose unlink fails too answers 500); story 5 adds rows — each 500 keeps its sentence and gains code, the write\'s error code through the allow-list, plus unlinkCode on the double failure; a failed on runs no fold and records the attempted on nowhere, an admin\'s included; and an on whose switch.json gives a read error answers 500 "could not read the switch: <code>" and changes and records nothing [story 5 AC-4 "Refused or failed … Turning on fails, for example, when the server cannot write the switch"; ADR 0005 D2 steps 2 and 5, D11: "500s keep their sentences (realtime.js:188, :194) and gain code, passed through allowErrorCode, plus unlinkCode on the double failure. A read error on prev for an on answers 500 could not read the switch: <code>"]', async () => {
  const enospc = () => Object.assign(new Error(`ENOSPC: no space left on device, write '${SWITCH_FILE}.tmp-1-ab'`), { code: 'ENOSPC' });
  const odd = () => Object.assign(new Error('connect ECONNREFUSED bolt://neo4j.internal:7687 at /var/lib/brainstorm/tagging-edges/realtime'), { code: ODD_CODE });
  const eacces = () => Object.assign(new Error(`EACCES: permission denied, unlink '${SWITCH_FILE}'`), { code: 'EACCES' });
  const adminO = { session: { authenticated: true, pubkey: ADMIN } };
  const rows = [
    { name: 'on, ENOSPC', on: true, bundle: { writeError: enospc() }, noUnlink: true },
    { name: 'on, an odd code with a URI and a path in its message', on: true, bundle: { writeError: odd() }, noUnlink: true },
    { name: 'off, the write and the unlink both failing', on: false, bundle: { writeError: enospc(), unlinkError: eacces() } },
    { name: 'off, an odd code on both', on: false, bundle: { writeError: odd(), unlinkError: odd() } },
    { name: 'an admin\'s on, ENOSPC: code (story 5)', on: true, o: adminO, bundle: { writeError: enospc(), prev: SW2_OFF, hist: { version: 1, changes: [entryOf(SW2_OFF)] } }, noUnlink: true, story5: { error: 'could not write the switch: ENOSPC', code: 'ENOSPC', noFold: true } },
    { name: 'on, an odd code: code "error" (story 5)', on: true, bundle: { writeError: odd() }, noUnlink: true, story5: { error: 'could not write the switch: error', code: 'error', noFold: true } },
    { name: 'off, the write and the unlink both failing: code and unlinkCode (story 5)', on: false, bundle: { writeError: enospc(), unlinkError: eacces() }, story5: { error: 'could not write or remove the switch: ENOSPC, EACCES', code: 'ENOSPC', unlinkCode: 'EACCES', noFold: true } },
    { name: 'an admin\'s off, an odd code on both (story 5)', on: false, o: adminO, bundle: { writeError: odd(), unlinkError: odd() }, story5: { error: 'could not write or remove the switch: error, error', code: 'error', unlinkCode: 'error', noFold: true } },
    { name: 'on, switch.json gives a read error EIO (story 5)', on: true, bundle: { prev: { unreadable: true, readError: 'EIO' } }, noUnlink: true, story5: { error: 'could not read the switch: EIO', nothing: true } },
    { name: 'an admin\'s on, switch.json gives a read error with an odd code (story 5)', on: true, o: adminO, bundle: { prev: { unreadable: true, readError: ODD_CODE } }, noUnlink: true, story5: { error: 'could not read the switch: error', nothing: true } },
  ];
  await cases(rows, async (c) => {
    const r = await callSwitch(switchReq({ on: c.on }, c.o || {}), switchBundle(c.bundle));
    const problems = [];
    if (r.res.statusCode !== 500) problems.push(`answered ${showRes(r.res)}, expected 500 (T27)`);
    const b = r.res.body || {};
    if (b.success === true) problems.push(`answered success: true: ${show(b)}`);
    if (c.on && b.on === true) problems.push(`answered on: true although the write failed: ${show(b)}`);
    if (c.noUnlink && r.calls.unlinkSwitch) problems.push('unlinkSwitch was called for a failed on-write (that would turn the path off, which the owner did not ask)');
    problems.push(...leakProblems(c.name, r.res));
    const s5 = c.story5;
    if (s5) {
      if (b.success !== false) problems.push(`the answer should say success: false; it is ${show(b)}`);
      if (b.error !== s5.error) problems.push(`the error should keep its sentence: ${show(s5.error)} (ADR 0005 D11); it is ${show(b.error)}`);
      if (has(s5, 'code') && b.code !== s5.code) problems.push(`the answer should carry code ${show(s5.code)} (ADR 0005 D11: "gain code, passed through allowErrorCode"); it is ${show(b)}`);
      if (has(s5, 'unlinkCode') && b.unlinkCode !== s5.unlinkCode) problems.push(`the answer should carry unlinkCode ${show(s5.unlinkCode)} on the double failure (ADR 0005 D11); it is ${show(b)}`);
      if (b.recorded === true) problems.push(`a failed change answered recorded: true: ${show(b)}`);
      if (s5.noFold) problems.push(...noFoldProblems(r, iso(T0)));
      if (s5.nothing) {
        const touched = [];
        if (r.calls.writeSwitch.length) touched.push(`writeSwitch(${show(r.calls.writeSwitch)})`);
        if (r.calls.unlinkSwitch) touched.push('unlinkSwitch()');
        if (r.calls.writeSwitchHistory.length) touched.push(`writeSwitchHistory(${show(r.calls.writeSwitchHistory)})`);
        if (touched.length) problems.push(`an on whose switch.json gives a read error should change and record nothing (ADR 0005 D2 step 2); it called ${touched.join(', ')}`);
      }
      problems.push(...adminLeakProblems(c.name, r.res));
    }
    assert(problems.length === 0, problems.join('\n          '));
  });
});

test('RR18: GET status reads realtime/switch.json and realtime/status.json under stateDir() through the injected readFile (fs.readFileSync- or fs.promises-shaped), asks isAlive about status.json\'s process, and answers 200 with exactly computeRealtimeStatus\'s body for those inputs and deps.now() — runningSince included, and it is status.json\'s process.startedAt — with no statusUnreadable on a good read (ADR § "Status and switch": "a thin handler reads switch.json, status.json and /proc through an injected readFile"; T22; T27; T29; T32: "The route\'s runningSince is process.startedAt while alive"; T33: statusUnreadable is present, as true, only when status.json cannot be read)', async () => {
  await cases([{ name: 'a readFile shaped like fs.readFileSync', async: false }, { name: 'a readFile shaped like fs.promises.readFile', async: true }], async (c) => {
    const status = fullStatus();
    const files = { [SWITCH_FILE]: JSON.stringify(SW_ON), [STATUS_FILE]: `${JSON.stringify(status, null, 2)}\n` };
    const b = statusBundle({ files, alive: true, async: c.async });
    const res = await callStatus(b);
    const problems = [];
    if (res.statusCode !== 200) problems.push(`answered ${showRes(res)}, expected 200`);
    for (const f of [SWITCH_FILE, STATUS_FILE]) if (!b.readFile.calls.includes(f)) problems.push(`never read ${f} through readFile (read ${show(b.readFile.calls)})`);
    const stray = b.readFile.calls.filter((p) => p !== SWITCH_FILE && p !== STATUS_FILE && !p.startsWith('/proc/'));
    if (stray.length) problems.push(`read files beyond switch.json, status.json and /proc: ${show(stray)}`);
    if (!b.aliveCalls.some((r) => pidOf(r) === PID)) problems.push(`isAlive was never asked about status.json's process (calls: ${show(b.aliveCalls)})`);
    const expected = routeFn('computeRealtimeStatus')({ status: clone(status), switchRecord: clone(SW_ON), alive: true, now: T0 });
    if (exact(res.body) !== exact(expected)) problems.push(`the body should be computeRealtimeStatus's answer\n          expected: ${show(expected)}\n          actual:   ${show(res.body)}`);
    if (!has(res.body, 'runningSince')) problems.push(`the answer lacks runningSince (§ Status): ${show(res.body)}`);
    else if (res.body.runningSince !== PROCESS_STARTED_AT) problems.push(`runningSince should be status.json's process.startedAt ${show(PROCESS_STARTED_AT)} (T32); is ${show(res.body.runningSince)}`);
    if (!absent(res.body, 'statusUnreadable')) problems.push(`a good read answered statusUnreadable ${show(res.body.statusUnreadable)} (T33: present only when status.json cannot be read)`);
    if (b.writes.length) problems.push(`the public read wrote: ${show(b.writes)}`);
    problems.push(...leakProblems(c.name, res));
    assert(problems.length === 0, problems.join('\n          '));
  });
});

test('RR19: GET status is public and still answers 200 when status.json is missing (the path never ran, or is off) — no session needed; on and onSince from switch.json (onSince null and state "off" when off), not running, runningSince null, not stale, and no statusUnreadable (a missing file is not an unreadable one); with neither file it answers 200 off (AC-6 "the owner reads it on the instance, without a shell"; story item 11: the status is a public read; T22; T27: state \'off\', onSince and runningSince null; T32: "A missing status.json is not statusUnreadable"; T33: statusUnreadable is present only when status.json cannot be read)', async () => {
  await cases([
    { name: 'switch on, no status.json', files: { [SWITCH_FILE]: JSON.stringify(SW_ON) }, on: true, since: SW_ON.changedAt },
    { name: 'switch off, no status.json', files: { [SWITCH_FILE]: JSON.stringify(SW_OFF) }, on: false, since: null },
    { name: 'neither file (a fresh install)', files: {}, on: false, since: null },
  ], async (c) => {
    const res = await callStatus(statusBundle({ files: c.files, alive: true }));
    const problems = [];
    if (res.statusCode !== 200) problems.push(`answered ${showRes(res)}, expected 200`);
    const b = res.body || {};
    if (b.on !== c.on) problems.push(`on should be ${c.on}; is ${show(b.on)}`);
    if (b.onSince !== c.since) problems.push(`onSince should be ${show(c.since)}; is ${show(b.onSince)}`);
    if (!c.on && b.state !== 'off') problems.push(`state should be "off" while the switch is off (T27); is ${show(b.state)}`);
    if (b.running !== false) problems.push(`running should be false with no status.json (no process to ask about); is ${show(b.running)}`);
    if (b.runningSince !== null) problems.push(`runningSince should be null when not running (T27); is ${show(b.runningSince)}`);
    if (b.stale !== false) problems.push(`stale should be false; is ${show(b.stale)}`);
    if (b.switchUnreadable !== false) problems.push(`switchUnreadable should be false; is ${show(b.switchUnreadable)}`);
    if (!absent(b, 'statusUnreadable')) problems.push(`a missing status.json (the path never ran) answered statusUnreadable ${show(b.statusUnreadable)} (T32: a missing status.json is not statusUnreadable; T33: present only when it cannot be read)`);
    problems.push(...leakProblems(c.name, res));
    assert(problems.length === 0, problems.join('\n          '));
  });
});

test('RR20: GET status with a switch.json that is present but unreadable — not JSON, empty, torn, a read error such as EACCES, or one that parses but is not an object whose on is a boolean ("on":"true", "on":1, no on, JSON null, an empty array) — answers 200 off, onSince null, state "off" and switchUnreadable: true — and, status.json being readable, no statusUnreadable (ADR § "Status and switch": "A missing or unreadable switch.json reads as off (fail-safe), and the status shows switchUnreadable"; T22; T26: what "unreadable" means for switch.json; T27: state \'off\', onSince null; T33: statusUnreadable is present only when status.json cannot be read)', async () => {
  const eacces = Object.assign(new Error(`EACCES: permission denied, open '${SWITCH_FILE}'`), { code: 'EACCES' });
  await cases([
    { name: 'not JSON', sw: 'on' },
    { name: 'empty', sw: '' },
    { name: 'torn', sw: '{"version":1,"on":tr' },
    { name: 'EACCES', sw: eacces },
    { name: '"on":"true"', sw: `{"version":1,"on":"true","changedAt":"${SW_ON.changedAt}","changedBy":"${SW_ON.changedBy}"}` },
    { name: '"on":1', sw: `{"version":1,"on":1,"changedAt":"${SW_ON.changedAt}","changedBy":"${SW_ON.changedBy}"}` },
    { name: 'no "on"', sw: `{"version":1,"changedAt":"${SW_ON.changedAt}","changedBy":"${SW_ON.changedBy}"}` },
    { name: 'JSON null', sw: 'null' },
    { name: 'an empty array', sw: '[]' },
  ], async (c) => {
    const res = await callStatus(statusBundle({ files: { [SWITCH_FILE]: c.sw, [STATUS_FILE]: JSON.stringify(fullStatus()) }, alive: true }));
    const problems = [];
    if (res.statusCode !== 200) problems.push(`answered ${showRes(res)}, expected 200`);
    const b = res.body || {};
    if (b.on !== false) problems.push(`on should be false; is ${show(b.on)}`);
    if (b.onSince !== null) problems.push(`onSince should be null while off (T27); is ${show(b.onSince)}`);
    if (b.state !== 'off') problems.push(`state should be "off" while the switch reads off (T27); is ${show(b.state)}`);
    if (b.switchUnreadable !== true) problems.push(`switchUnreadable should be true (T26: unreadable unless an object whose on is a boolean); is ${show(b.switchUnreadable)}`);
    if (!absent(b, 'statusUnreadable')) problems.push(`status.json was read, yet the answer carries statusUnreadable ${show(b.statusUnreadable)} (T33: present only when status.json cannot be read)`);
    problems.push(...leakProblems(c.name, res));
    assert(problems.length === 0, problems.join('\n          '));
  });
});

test('RR21: without an injected isAlive, GET status judges liveness from /proc/<pid>/stat read through the injected readFile — the host\'s /proc is never consulted: a matching start time reads running, with runningSince = status.json\'s process.startedAt; another start time (a reused pid), a zombie or no /proc entry reads not running, with runningSince null; status.json being readable, no answer carries statusUnreadable (ADR § "Status and switch": "/proc through an injected readFile (story 2\'s C11 pattern)"; T22: deps default like withDeps; T27: runningSince null when not alive; T32: runningSince is process.startedAt while alive; T33: statusUnreadable only when status.json cannot be read)', async () => {
  let parseStat;
  try { ({ parseStat } = require(STATE_MOD)); } catch (e) { parseStat = null; }
  if (parseStat) {
    const st = parseStat(statLine(PID, START_TIME));
    assert(st && st.startTime === START_TIME && st.state === 'S', `fixture: statLine() should parse to start time ${START_TIME}, state S; parsed ${show(st)}`);
  }
  const procFile = `/proc/${PID}/stat`;
  await cases([
    { name: 'the same process', proc: statLine(PID, START_TIME), running: true },
    { name: 'a reused pid (another start time)', proc: statLine(PID, '111111'), running: false },
    { name: 'a zombie', proc: statLine(PID, START_TIME, 'Z'), running: false },
    { name: 'no /proc entry', proc: undefined, running: false },
  ], async (c) => {
    const files = { [SWITCH_FILE]: JSON.stringify(SW_ON), [STATUS_FILE]: JSON.stringify(fullStatus()) };
    if (c.proc !== undefined) files[procFile] = c.proc;
    const b = statusBundle({ files, noIsAlive: true });
    const res = await callStatus(b);
    const problems = [];
    if (res.statusCode !== 200) problems.push(`answered ${showRes(res)}, expected 200`);
    if (!b.readFile.calls.includes(procFile)) problems.push(`never read ${procFile} through the injected readFile (read ${show(b.readFile.calls)})`);
    const b2 = res.body || {};
    if (b2.running !== c.running) problems.push(`running should be ${c.running}; is ${show(b2.running)}`);
    const since = c.running ? PROCESS_STARTED_AT : null;
    if (b2.runningSince !== since) problems.push(`runningSince should be ${show(since)} (${c.running ? "status.json's process.startedAt while alive, T32" : 'null when not alive, T27'}); is ${show(b2.runningSince)}`);
    if (!absent(b2, 'statusUnreadable')) problems.push(`status.json was read, yet the answer carries statusUnreadable ${show(b2.statusUnreadable)} (T33)`);
    assert(problems.length === 0, problems.join('\n          '));
  });
});

test('RR22: GET status when a read fails other than "missing" answers 200 and leaks nothing — a status.json that cannot be read (EACCES naming the absolute path, or an error whose code is off the allow-list and whose message carries a bolt:// URI) or does not parse answers the switch fields (on, onSince, switchUnreadable), running: false and statusUnreadable: true; a switch.json that cannot be read answers off, state "off" and switchUnreadable: true beside status.json\'s figures; both at once answer off and both flags; statusUnreadable is absent whenever status.json was read — and no answer carries an absolute path, a URI, a host:port or that code (AC-6 "What it never shows"; ADR error-code allow-list; "Tests the Tester owns → The routes": err.code = \'neo4j.internal\' → \'error\'; T22; T27: "A status.json that cannot be read, or does not parse, answers 200 with the switch fields, running, and statusUnreadable: true"; T33: "statusUnreadable is present, as true, only when status.json cannot be read")', async () => {
  const eacces = (f) => Object.assign(new Error(`EACCES: permission denied, open '${f}'`), { code: 'EACCES', path: f });
  const odd = () => Object.assign(new Error(`connect ECONNREFUSED bolt://neo4j.internal:7687 reading ${STATUS_FILE}`), { code: ODD_CODE });
  const good = JSON.stringify(fullStatus());
  await cases([
    { name: 'EACCES on status.json', sw: JSON.stringify(SW_ON), st: eacces(STATUS_FILE), switchBad: false, statusBad: true },
    { name: 'an odd code on status.json', sw: JSON.stringify(SW_ON), st: odd(), switchBad: false, statusBad: true },
    { name: 'status.json not JSON', sw: JSON.stringify(SW_ON), st: `{"state":"live","lastError":{"text":"${STATUS_FILE}"`, switchBad: false, statusBad: true },
    { name: 'status.json empty', sw: JSON.stringify(SW_OFF), st: '', switchBad: false, statusBad: true },
    { name: 'EACCES on switch.json', sw: eacces(SWITCH_FILE), st: good, switchBad: true, statusBad: false },
    { name: 'an odd code on switch.json', sw: odd(), st: good, switchBad: true, statusBad: false },
    { name: 'both unreadable', sw: eacces(SWITCH_FILE), st: odd(), switchBad: true, statusBad: true },
  ], async (c) => {
    const res = await callStatus(statusBundle({ files: { [SWITCH_FILE]: c.sw, [STATUS_FILE]: c.st }, alive: true }));
    const problems = leakProblems(c.name, res);
    if (res.statusCode !== 200) problems.push(`answered ${showRes(res)}, expected 200 (T27)`);
    const b = res.body && typeof res.body === 'object' ? res.body : {};
    const sw = c.switchBad ? null : JSON.parse(c.sw);
    const wantOn = !!(sw && sw.on === true);
    if (b.on !== wantOn) problems.push(`on should be ${wantOn}; is ${show(b.on)}`);
    if (b.onSince !== (wantOn ? sw.changedAt : null)) problems.push(`onSince should be ${show(wantOn ? sw.changedAt : null)}; is ${show(b.onSince)}`);
    if (b.switchUnreadable !== c.switchBad) problems.push(`switchUnreadable should be ${c.switchBad}; is ${show(b.switchUnreadable)}`);
    if (c.statusBad) {
      if (b.statusUnreadable !== true) problems.push(`statusUnreadable should be true (T27); is ${show(b.statusUnreadable)}`);
      if (b.running !== false) problems.push(`running should be false (an unreadable status.json names no process to ask about); is ${show(b.running)}`);
    } else {
      if (!absent(b, 'statusUnreadable')) problems.push(`a readable status.json answered statusUnreadable ${show(b.statusUnreadable)} (T33: present only when status.json cannot be read)`);
      if (b.seen !== fullStatus().seen) problems.push(`status.json's figures should still reach the answer (seen ${fullStatus().seen}); seen is ${show(b.seen)}`);
    }
    // T27 lists no state for an unreadable status.json, so state is pinned only beside a readable one.
    if (c.switchBad && !c.statusBad && b.state !== 'off') problems.push(`state should be "off" while the switch reads off (T27); is ${show(b.state)}`);
    assert(problems.length === 0, problems.join('\n          '));
  });
});

test('RR23: on their default deps — as Express calls them, (req, res, next), the owner and admin lists injected, against a temporary TAGGING_EDGES_STATE_DIR only — the owner\'s POST on writes <TAGGING_EDGES_STATE_DIR>/realtime/switch.json through the store as version 2: the canonical compact text { version: 2, on, changedAt, changedBy, role, onSince } ("on":true literally, for the wrapper), byte for byte what the store\'s own writeSwitch writes for that record; GET status reads it back as on with onSince = that on\'s time; an admin\'s on while on then writes role "admin" and the same onSince, which GET status still serves; a POST off writes the canonical off text with onSince null and reads off, state "off", onSince null; switch-history.json beside it then holds the three changes, newest first; nothing appears outside realtime/; and no answer names the state directory [story 5 AC-5 "It lasts", AC-3 "An on while the path is already on does not restart the window"; ADR 0005 D1, D2, D4, Seams: "Default-dependency coverage (RR23 revised) runs only against a temporary TAGGING_EDGES_STATE_DIR", "withDeps\' defaults keep following d.stateDir()"; Consequences "Tests that fail by design: RR23" — revised from story 3\'s version 1 bytes; T21 default dir; T22; T26 as amended; T27]', async () => {
  await withDir(async ({ root }) => {
    await withEnv({ TAGGING_EDGES_STATE_DIR: root }, async () => {
      const next = function next() {};
      const handleSwitch = routeFn('handleRealtimeSwitch');
      const handleStatus = need(require(ROUTES_MOD), 'handleRealtimeStatus', ROUTES_REL, 'T22');
      const problems = [];
      const file = path.join(root, 'realtime', 'switch.json');
      /** Only the lists are injected: every record dependency is the default, the store's under the temporary stateDir(). */
      const deps = (now) => ({ getOwnerPubkey: () => OWNER, getAdminPubkeys: () => [ADMIN], now: () => now });
      const adminO = { session: { authenticated: true, pubkey: ADMIN } };
      const needles = [root, fs.realpathSync(root), ADMIN, ADMIN.toUpperCase()];
      /** The switch.json the route left, checked against the canonical version 2 text and against the store's own bytes. */
      const checkFile = async (label, rec) => {
        if (!fs.existsSync(file)) { problems.push(`${label} wrote no <stateDir>/realtime/switch.json (the state directory holds ${show(Object.keys(snapshot(root)))})`); return; }
        const bytes = fs.readFileSync(file);
        const text = bytes.toString('utf8');
        const body = text.endsWith('\n') ? text.slice(0, -1) : text;
        if (body !== canonicalSwitch2(rec)) problems.push(`${label}: switch.json should be the canonical version 2 text (ADR 0005 D1)\n          expected: ${show(canonicalSwitch2(rec))}\n          actual:   ${show(text)}`);
        if (rec.on && !body.includes('"on":true')) problems.push(`${label}: switch.json lacks the literal "on":true: ${show(text)}`);
        if (!rec.on && body.includes('"on":true')) problems.push(`${label}: switch.json still carries "on":true`);
        const other = fs.mkdtempSync(path.join(os.tmpdir(), 'tagging-edges-realtime-rr23-'));
        try {
          await call(storeAt(other), 'writeSwitch', clone(rec));
          const storeBytes = fs.readFileSync(path.join(other, 'switch.json'));
          if (!storeBytes.equals(bytes)) problems.push(`${label}: switch.json is not what the store's writeSwitch writes for the same record (T27: the default writeSwitch is the store's)\n          store: ${show(storeBytes)}\n          route: ${show(bytes)}`);
        } finally {
          fs.rmSync(other, { recursive: true, force: true });
        }
      };
      const onRes = await callHandler(handleSwitch, switchReq({ on: true }), deps(T0));
      if (onRes.statusCode !== 200) problems.push(`POST on answered ${showRes(onRes)}, expected 200`);
      problems.push(...leakProblems('POST on', onRes, needles));
      await checkFile('POST on', { version: 2, on: true, changedAt: iso(T0), changedBy: OWNER8, role: 'owner', onSince: iso(T0) });
      const read1 = await callHandler(handleStatus, statusReq(), next);
      if (read1.statusCode !== 200) problems.push(`GET status (deps = next) answered ${showRes(read1)}, expected 200`);
      else if (!read1.body || read1.body.on !== true || read1.body.onSince !== iso(T0)) problems.push(`GET status should read on since ${iso(T0)}; read ${show(read1.body)}`);
      problems.push(...leakProblems('GET status after on', read1, needles));
      const againRes = await callHandler(handleSwitch, switchReq({ on: true }, adminO), deps(T0 + 30 * SEC));
      if (againRes.statusCode !== 200) problems.push(`an admin's POST on while on answered ${showRes(againRes)}, expected 200`);
      problems.push(...leakProblems('an admin\'s POST on while on', againRes, needles));
      await checkFile('an admin\'s POST on while on', { version: 2, on: true, changedAt: iso(T0 + 30 * SEC), changedBy: ADMIN8, role: 'admin', onSince: iso(T0) });
      const readAgain = await callHandler(handleStatus, statusReq(), next);
      if (!readAgain.body || readAgain.body.on !== true || readAgain.body.onSince !== iso(T0)) problems.push(`GET status after an on while on should still read on since ${iso(T0)} (ADR 0005 D4: an on while on never moves onSince); read ${showRes(readAgain)}`);
      problems.push(...leakProblems('GET status after the on while on', readAgain, needles));
      const offRes = await callHandler(handleSwitch, switchReq({ on: false }), deps(T0 + MIN));
      if (offRes.statusCode !== 200) problems.push(`POST off answered ${showRes(offRes)}, expected 200`);
      problems.push(...leakProblems('POST off', offRes, needles));
      await checkFile('POST off', { version: 2, on: false, changedAt: iso(T0 + MIN), changedBy: OWNER8, role: 'owner', onSince: null });
      const read2 = await callHandler(handleStatus, statusReq(), next);
      const b2 = read2.body || {};
      if (b2.on !== false || b2.onSince !== null || b2.state !== 'off') problems.push(`GET status after POST off should read on: false, onSince null, state "off" (T27); read ${showRes(read2)}`);
      problems.push(...leakProblems('GET status after off', read2, needles));
      // The history, through the default writeSwitchHistory under the temporary stateDir() (ADR 0005 D1, D2).
      const histFile = path.join(root, 'realtime', 'switch-history.json');
      const wantHist = {
        version: 1,
        changes: [
          { on: false, at: iso(T0 + MIN), role: 'owner', key: OWNER8 },
          { on: true, at: iso(T0 + 30 * SEC), role: 'admin', key: ADMIN8 },
          { on: true, at: iso(T0), role: 'owner', key: OWNER8 },
        ],
      };
      if (!fs.existsSync(histFile)) problems.push(`the three changes left no <stateDir>/realtime/switch-history.json (ADR 0005 D1; the state directory holds ${show(Object.keys(snapshot(root)))})`);
      else {
        let hist = null;
        try { hist = JSON.parse(fs.readFileSync(histFile, 'utf8')); } catch (e) { problems.push(`switch-history.json is not JSON: ${firstLine(e)}`); }
        if (hist && exact(hist) !== exact(wantHist)) problems.push(`switch-history.json should hold the three changes, newest first (ADR 0005 D1, D2)\n          expected: ${show(wantHist)}\n          actual:   ${show(hist)}`);
      }
      const outside = Object.keys(snapshot(root, 'realtime'));
      if (outside.length) problems.push(`files appeared outside realtime/: ${show(outside)} (ADR 0005 D1: both files are in <stateDir>/realtime/)`);
      assert(problems.length === 0, problems.join('\n        '));
    });
  }, { makeRealtime: false });
});

test('RR24: computeRealtimeStatus re-applies allowErrorCode to lastError.code and to the dbRefused.byReason keys — a status.json carrying neo4j.internal, neo4j.internal:7687, a bolt:// URI, an IP or redis:6379 as a code is answered with \'error\' in its place (the count and the other lastError fields kept), while E-codes, Neo4j status codes, ServiceUnavailable, SessionExpired and ScanError codes pass unchanged; the inputs are not changed (AC-6 "What it never shows"; ADR § "Status and switch": error codes pass an allow-list, else \'error\'; "Tests the Tester owns → The routes": err.code = \'neo4j.internal\' → \'error\'; T27: "it re-applies allowErrorCode to lastError.code and to the dbRefused.byReason keys")', () => {
  const compute = routeFn('computeRealtimeStatus');
  const refused = ['neo4j.internal', ODD_CODE, 'bolt://neo4j:7687', '10.1.2.3', 'redis:6379'];
  const allowed = [
    'ECONNREFUSED', 'ENOSPC', 'Neo.TransientError.Transaction.DeadlockDetected', 'Neo.ClientError.Schema.ConstraintValidationFailed',
    'ServiceUnavailable', 'SessionExpired', 'timeout', 'filter-too-large',
  ];
  const OTHER = 'Neo.DatabaseError.General.UnknownError'; // a second, allowed key that no row uses
  const rows = [...refused.map((code) => ({ code, want: 'error' })), ...allowed.map((code) => ({ code, want: code }))];
  const problems = [];
  for (const r of rows) {
    const base = fullStatus();
    const lastError = { at: iso(T0 - MIN), stage: 'graph', code: r.code, text: 'the graph refused a write' };
    const status = fullStatus({ lastError, counts: { ...base.counts, dbRefused: { total: 3, byReason: { [r.code]: 2, [OTHER]: 1 } } } });
    const input = { status: clone(status), switchRecord: clone(SW_ON), alive: true, now: T0 };
    const before = exact(input);
    let body;
    try { body = compute(input); } catch (e) { problems.push(`[${r.code}] threw: ${firstLine(e)}`); continue; }
    if (exact(input) !== before) problems.push(`[${r.code}] computeRealtimeStatus changed its inputs`);
    const wantError = { ...lastError, code: r.want };
    if (exact(body && body.lastError) !== exact(wantError)) problems.push(`[${r.code}] lastError should be ${show(wantError)}; is ${show(body && body.lastError)}`);
    const wantRefused = { total: 3, byReason: { [r.want]: 2, [OTHER]: 1 } };
    const gotRefused = body && body.counts && body.counts.dbRefused;
    if (exact(gotRefused) !== exact(wantRefused)) problems.push(`[${r.code}] counts.dbRefused should be ${show(wantRefused)}; is ${show(gotRefused)}`);
    if (r.want === 'error' && JSON.stringify(body || {}).includes(r.code)) problems.push(`[${r.code}] the answer still carries the refused code`);
  }
  assert(problems.length === 0, problems.join('\n        '));
});

test('RR25: GET status re-applies the allow-list to what status.json holds — a status.json whose lastError.code is \'neo4j.internal\' and whose dbRefused.byReason has a neo4j.internal:7687 key is answered with \'error\' in both places and carries neither (AC-6; "Tests the Tester owns → The routes": err.code = \'neo4j.internal\' → \'error\'; T27: "a status.json carrying code \'neo4j.internal\' is answered as \'error\'")', async () => {
  const base = fullStatus();
  const status = fullStatus({
    lastError: { at: iso(T0 - MIN), stage: 'graph', code: 'neo4j.internal', text: 'the graph could not be reached' },
    counts: { ...base.counts, dbRefused: { total: 4, byReason: { [ODD_CODE]: 4 } } },
  });
  const res = await callStatus(statusBundle({ files: { [SWITCH_FILE]: JSON.stringify(SW_ON), [STATUS_FILE]: JSON.stringify(status) }, alive: true }));
  const problems = [];
  if (res.statusCode !== 200) problems.push(`answered ${showRes(res)}, expected 200`);
  const b = res.body || {};
  if (!b.lastError || b.lastError.code !== 'error') problems.push(`lastError.code should be 'error'; lastError is ${show(b.lastError)}`);
  const refused = b.counts && b.counts.dbRefused;
  if (exact(refused) !== exact({ total: 4, byReason: { error: 4 } })) problems.push(`counts.dbRefused should be { total: 4, byReason: { error: 4 } }; is ${show(refused)}`);
  problems.push(...leakProblems('a status.json carrying neo4j.internal', res));
  assert(problems.length === 0, problems.join('\n        '));
});

test('RR26: src/api/tagging-edges/realtime.js takes allowErrorCode from src/lib/tagging-edges/realtime.js — a require() by a relative path that resolves to that file binds allowErrorCode (destructured, as a member, or through the module\'s variable) — and keeps no allow-list of its own: no function, variable or assignment named allowErrorCode, no copy of the Neo4j status-code pattern, and no ServiceUnavailable or SessionExpired (comments dropped; a static check) (ADR § "Status and switch": one allow-list; T2; T27: "The routes module imports allowErrorCode from src/lib/tagging-edges/realtime.js")', () => {
  let src;
  try { src = fs.readFileSync(ROUTES_MOD, 'utf8'); } catch (e) { throw new Error(`${ROUTES_REL} not implemented yet (${firstLine(e)})`); }
  const code = jsCodeOnly(src);
  const libNoExt = REALTIME_LIB_MOD.replace(/\.js$/, '');
  const all = [];
  const specs = [];
  const reqRe = /require\(\s*(['"])([^'"]+)\1\s*\)/g;
  let m;
  while ((m = reqRe.exec(code))) {
    all.push(m[2]);
    if (!m[2].startsWith('.')) continue;
    const abs = path.resolve(path.dirname(ROUTES_MOD), m[2]);
    if (abs === REALTIME_LIB_MOD || abs === libNoExt) specs.push(m[2]);
  }
  const problems = [];
  if (!specs.length) problems.push(`${ROUTES_REL} requires nothing that resolves to src/lib/tagging-edges/realtime.js (its require()s: ${show(all)})`);
  const binds = specs.some((spec) => {
    const req = `require\\(\\s*['"]${escapeRe(spec)}['"]\\s*\\)`;
    if (new RegExp(`(?:const|let|var)\\s*\\{[^}]*(?<![\\w$])allowErrorCode(?![\\w$])[^}]*\\}\\s*=\\s*${req}`).test(code)) return true;
    if (new RegExp(`${req}\\s*\\.\\s*allowErrorCode(?![\\w$])`).test(code)) return true;
    const named = new RegExp(`(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*${req}`).exec(code);
    if (!named) return false;
    const v = escapeRe(named[1]);
    return new RegExp(`(?<![\\w$.])${v}\\s*\\.\\s*allowErrorCode(?![\\w$])`).test(code)
      || new RegExp(`(?:const|let|var)\\s*\\{[^}]*(?<![\\w$])allowErrorCode(?![\\w$])[^}]*\\}\\s*=\\s*${v}(?![\\w$])`).test(code);
  });
  if (specs.length && !binds) problems.push(`${ROUTES_REL} requires ${show(specs)} but binds no allowErrorCode from it`);
  const own = [
    [/(?<![\w$])function\s*\*?\s*allowErrorCode\s*\(/, 'defines a function allowErrorCode'],
    [/(?:const|let|var)\s+allowErrorCode\s*=/, 'defines a variable allowErrorCode'],
    [/(?<![\w$.])allowErrorCode\s*=(?![=>])/, 'assigns allowErrorCode'],
    [/ClientError\|TransientError|TransientError\|DatabaseError|ClientError\|DatabaseError/, 'holds a copy of the Neo4j status-code pattern'],
    [/(?<![\w$])ServiceUnavailable(?![\w$])/, 'names ServiceUnavailable (an allow-list entry)'],
    [/(?<![\w$])SessionExpired(?![\w$])/, 'names SessionExpired (an allow-list entry)'],
  ];
  for (const [re, what] of own) {
    const hit = re.exec(code);
    if (hit) problems.push(`${ROUTES_REL} ${what} — the one allow-list is src/lib/tagging-edges/realtime.js's: ${around(code, hit.index)}`);
  }
  assert(problems.length === 0, problems.join('\n        '));
});

test('RR27: every time field the status answer carries is an ISO string — onSince (the switch\'s changedAt), runningSince (process.startedAt), firstStartedAt, relay.lastReadOkAt, subscription.since and lastEventAt, lastReflectedAt, catchUp.current.startedAt, catchUp.last.startedAt and endedAt, lastError.at, process.startedAt and updatedAt — or null where the field is unset (onSince while off, runningSince while not alive), from computeRealtimeStatus and from GET status alike (T33: "Every time field in status.json and in the status answer is an ISO string"; T32: process.startedAt an ISO time, runningSince its value while alive; T27: onSince null when off, runningSince null when not alive; ADR § "Status and switch" field list); story 5 adds version 2 rows, where onSince is the switch\'s onSince — the last off-to-on time — not its changedAt (ADR 0005 D4)', async () => {
  const compute = routeFn('computeRealtimeStatus');
  const rows = [
    { name: 'computeRealtimeStatus, live, on, alive', via: 'compute', status: fullStatus(), sw: SW_ON, alive: true },
    { name: 'computeRealtimeStatus, a catch-up under way, on, alive', via: 'compute', status: waitingStatus(), sw: SW_ON, alive: true },
    { name: 'computeRealtimeStatus, live, off, not alive', via: 'compute', status: fullStatus(), sw: SW_OFF, alive: false },
    { name: 'GET status, live, on, alive', via: 'route', status: fullStatus(), sw: SW_ON, alive: true },
    { name: 'GET status, a catch-up under way, off, not alive', via: 'route', status: waitingStatus(), sw: SW_OFF, alive: false },
    { name: 'computeRealtimeStatus, live, version 2 on while on, alive (story 5)', via: 'compute', status: fullStatus(), sw: SW2_ON_AGAIN, alive: true },
    { name: 'GET status, live, version 2 on while on, alive (story 5)', via: 'route', status: fullStatus(), sw: SW2_ON_AGAIN, alive: true },
    { name: 'GET status, a catch-up under way, version 2 off, not alive (story 5)', via: 'route', status: waitingStatus(), sw: SW2_OFF, alive: false },
  ];
  await cases(rows, async (c) => {
    let body;
    if (c.via === 'compute') {
      body = compute({ status: clone(c.status), switchRecord: clone(c.sw), alive: c.alive, now: T0 });
    } else {
      const res = await callStatus(statusBundle({ files: { [SWITCH_FILE]: JSON.stringify(c.sw), [STATUS_FILE]: JSON.stringify(c.status) }, alive: c.alive }));
      assert(res.statusCode === 200, `answered ${showRes(res)}, expected 200`);
      body = res.body;
    }
    assert(body && typeof body === 'object', `the answer should be an object; is ${show(body)}`);
    const unset = new Set([...(c.sw.on ? [] : ['onSince']), ...(c.alive ? [] : ['runningSince'])]);
    const problems = [];
    for (const p of TIME_PATHS) {
      const v = valueAt(body, p);
      if (unset.has(p)) {
        if (v !== null) problems.push(`${p} should be null (${p === 'onSince' ? 'the switch is off' : 'the process is not alive'}; T27); is ${show(v)}`);
        continue;
      }
      const held = p === 'onSince' || p === 'runningSince' || valueAt(c.status, p) !== undefined;
      if (v === undefined) { if (held) problems.push(`${p} is missing from the answer`); continue; }
      if (!isIsoTime(v)) problems.push(`${p} should be an ISO time string (T33); is ${show(v)}`);
    }
    if (c.sw.version === 2 && c.sw.on && body.onSince !== c.sw.onSince) problems.push(`onSince should be the version 2 switch's onSince ${show(c.sw.onSince)}, the last off-to-on time, not its changedAt ${show(c.sw.changedAt)} (ADR 0005 D4); is ${show(body.onSince)}`);
    assert(problems.length === 0, problems.join('\n          '));
  });
});

// ─── found by the mutation pass over the blind reference implementation ────────────────────────────────────────
test('RR28: dbRefused.byReason keys that collapse to \'error\' under allowErrorCode have their counts summed — a status.json holding \'error\' (1), neo4j.internal (2), redis:6379 (3) and neo4j.internal:7687 (4) beside two allowed codes is answered with error: 10 and the allowed codes\' own counts, total unchanged, carrying none of the collapsed keys; the inputs are not changed — from computeRealtimeStatus and GET status alike (T32 "Allow-listed keys. When dbRefused.byReason keys collapse to \'error\' under allowErrorCode, their counts are summed"; T27: "it re-applies allowErrorCode to … the dbRefused.byReason keys"; AC-6 "What it never shows")', async () => {
  const compute = routeFn('computeRealtimeStatus');
  const ALLOWED = 'Neo.ClientError.Schema.ConstraintValidationFailed';
  // The collapsing keys come first and last in insertion order, so neither "first wins" nor "last wins" gives 10.
  const byReason = { error: 1, 'neo4j.internal': 2, [ALLOWED]: 5, 'redis:6379': 3, ENOSPC: 6, [ODD_CODE]: 4 };
  const want = { total: 21, byReason: { error: 10, [ALLOWED]: 5, ENOSPC: 6 } };
  const base = fullStatus();
  const status = fullStatus({ counts: { ...base.counts, dbRefused: { total: 21, byReason } } });
  await cases([{ name: 'computeRealtimeStatus', via: 'compute' }, { name: 'GET status', via: 'route' }], async (c) => {
    let body;
    if (c.via === 'compute') {
      const input = { status: clone(status), switchRecord: clone(SW_ON), alive: true, now: T0 };
      const before = exact(input);
      body = compute(input);
      assert(exact(input) === before, 'computeRealtimeStatus changed its inputs');
    } else {
      const res = await callStatus(statusBundle({ files: { [SWITCH_FILE]: JSON.stringify(SW_ON), [STATUS_FILE]: JSON.stringify(status) }, alive: true }));
      assert(res.statusCode === 200, `answered ${showRes(res)}, expected 200`);
      body = res.body;
    }
    same(body && body.counts && body.counts.dbRefused, want, 'counts.dbRefused: the collapsed keys\' counts summed under \'error\' (T32)');
    const text = JSON.stringify(body || {});
    const carried = ['neo4j.internal', 'redis:6379', ODD_CODE].filter((k) => text.includes(k));
    assert(carried.length === 0, `the answer still carries collapsed key(s) ${show(carried)}`);
  });
});

// ─── story 5: the starting window, the last off-to-on time, and no "who" on the public status (ADR 0005 D4, D6, D7, D11) ───

test('RR29: computeRealtimeStatus derives inStartWindow on the server\'s clock — a boolean, true exactly when the path is on, its onSince parses, 0 ≤ now − onSince < 60 000 ms, and the process is not both running and started at or after onSince: 59 999 ms true and 60 000 ms false, 0 ms true; a process started at onSince or later is running for this on (false); one started before it (an old process still stopping), or whose start is unparseable or unknown, is not (true, with running still true: liveness alone); now before onSince (a clock stepped back) false; off, a stray onSince on an off, missing or unreadable false; onSince from a version 2 switch\'s onSince — so an on while on does not restart the window — and from a version 1 switch\'s changedAt — from computeRealtimeStatus and from GET status alike (deps.now) [story 5 AC-3 "The starting window counts from the time the server recorded the switch last going from off to on … Every viewer sees it, and it survives a reload", "Within the window … A process that started before that on does not count as running", "Past 60 seconds", "An on while the path is already on does not restart the window"; ADR 0005 D4, D7: START_WINDOW_MS 60 000, "running stays liveness alone"; Seams "Pure server functions … computeRealtimeStatus"]', async () => {
  const compute = routeFn('computeRealtimeStatus');
  /** A version 2 on whose onSince was `agoMs` before T0 (and whose changedAt was `changedAgoMs` before it). */
  const v2on = (agoMs, changedAgoMs = agoMs) => ({ version: 2, on: true, changedAt: iso(T0 - changedAgoMs), changedBy: OWNER8, role: 'owner', onSince: iso(T0 - agoMs) });
  const proc = (startedAt) => fullStatus({ process: { pid: PID, startTime: START_TIME, startedAt } });
  const S10 = 10 * SEC;
  const rows = [
    { name: '59 999 ms after the on, not running', sw: v2on(59999), alive: false, want: true, since: iso(T0 - 59999) },
    { name: '60 000 ms after the on, not running', sw: v2on(60000), alive: false, want: false, since: iso(T0 - 60000) },
    { name: 'at the moment of the on (0 ms)', sw: v2on(0), alive: false, want: true, since: iso(T0) },
    { name: 'running, started exactly at onSince', sw: v2on(S10), status: proc(iso(T0 - S10)), alive: true, want: false },
    { name: 'running, started after onSince', sw: v2on(S10), status: proc(iso(T0 - 4 * SEC)), alive: true, want: false },
    { name: 'running, started 1 ms before onSince (an old process still stopping)', sw: v2on(S10), status: proc(iso(T0 - S10 - 1)), alive: true, want: true, running: true },
    { name: 'running, started long before onSince', sw: v2on(S10), status: fullStatus(), alive: true, want: true, running: true },
    { name: 'running, its start unparseable', sw: v2on(S10), status: proc('not a time'), alive: true, want: true, running: true },
    { name: 'running, its start unknown (an empty status)', sw: v2on(S10), status: {}, alive: true, want: true, running: true },
    { name: 'now before onSince (a clock stepped back)', sw: { ...v2on(0), changedAt: iso(T0 + SEC), onSince: iso(T0 + SEC) }, alive: false, want: false },
    { name: 'version 2, off 10 s ago', sw: { ...SW2_OFF, changedAt: iso(T0 - S10) }, alive: false, want: false, since: null },
    { name: 'version 2, off, carrying a stray onSince 10 s ago', sw: { ...SW2_OFF, changedAt: iso(T0 - S10), onSince: iso(T0 - S10) }, alive: false, want: false, since: null },
    { name: 'no switch.json', sw: null, alive: false, want: false },
    { name: 'an unreadable switch.json', sw: { unreadable: true }, alive: false, want: false },
    { name: 'version 1, on 30 s ago: onSince is its changedAt', sw: { version: 1, on: true, changedAt: iso(T0 - 30 * SEC), changedBy: OWNER8 }, alive: false, want: true, since: iso(T0 - 30 * SEC) },
    { name: 'version 1, on 2 min ago', sw: { version: 1, on: true, changedAt: iso(T0 - 2 * MIN), changedBy: OWNER8 }, alive: false, want: false, since: iso(T0 - 2 * MIN) },
    { name: 'version 2, an on while on 10 s ago after a first on 5 min ago: not restarted', sw: v2on(5 * MIN, S10), alive: false, want: false, since: iso(T0 - 5 * MIN) },
    { name: 'version 2, onSince not a time, changedAt 20 s ago', sw: { ...v2on(20 * SEC), onSince: 'soon' }, alive: false, want: true, since: iso(T0 - 20 * SEC) },
    { name: 'version 2, neither onSince nor changedAt a time', sw: { ...v2on(0), changedAt: 'now', onSince: 'soon' }, alive: false, want: false, since: null },
  ];
  const problems = [];
  for (const r of rows) {
    let body;
    try { body = compute({ status: clone(has(r, 'status') ? r.status : fullStatus()), switchRecord: clone(r.sw), alive: r.alive, now: T0 }); } catch (e) { problems.push(`[${r.name}] threw: ${firstLine(e)}`); continue; }
    if (!body || body.inStartWindow !== r.want) problems.push(`[${r.name}] inStartWindow should be ${r.want} (ADR 0005 D7); is ${show(body && body.inStartWindow)}`);
    if (body && has(r, 'since') && body.onSince !== r.since) problems.push(`[${r.name}] onSince should be ${show(r.since)} (ADR 0005 D4); is ${show(body.onSince)}`);
    if (body && r.running && body.running !== true) problems.push(`[${r.name}] running should stay true — liveness alone (ADR 0005 D7) — while inStartWindow says the process is not this on's; is ${show(body.running)}`);
  }
  // GET status: the same verdict from the handler, on deps.now(), for every viewer (it is in the body).
  const routeRows = [
    { name: 'GET status, 20 s after the on, an older process alive', sw: v2on(20 * SEC), now: T0, want: true },
    { name: 'GET status, 60 s after the same on, that process alive', sw: v2on(20 * SEC), now: T0 + 40 * SEC, want: false },
    { name: 'GET status, a version 1 on 5 s ago, an older process alive', sw: { version: 1, on: true, changedAt: iso(T0 - 5 * SEC), changedBy: OWNER8 }, now: T0, want: true },
  ];
  for (const r of routeRows) {
    const files = { [SWITCH_FILE]: r.sw.version === 2 ? canonicalSwitch2(r.sw) : canonicalSwitch(r.sw), [STATUS_FILE]: JSON.stringify(fullStatus()) };
    let res;
    try { res = await callStatus(statusBundle({ files, alive: true, now: r.now })); } catch (e) { problems.push(`[${r.name}] ${firstLine(e)}`); continue; }
    const b = res.body || {};
    if (res.statusCode !== 200) problems.push(`[${r.name}] answered ${showRes(res)}, expected 200`);
    if (b.inStartWindow !== r.want) problems.push(`[${r.name}] inStartWindow should be ${r.want} (ADR 0005 D7); is ${show(b.inStartWindow)}`);
    if (b.running !== true) problems.push(`[${r.name}] running should be true (liveness alone); is ${show(b.running)}`);
  }
  assert(problems.length === 0, problems.join('\n        '));
});

test('RR30: the public status gains exactly one member, inStartWindow, and carries no "who" — for a version 2 switch changed by an admin or by the owner, the answer\'s members are story 3\'s (§ Status, T29: the pass-through fields, statusVersion, on, onSince, running, runningSince, switchUnreadable, stale) plus inStartWindow, none named role, changedBy, key or who; no string in it is the changer\'s key or a full pubkey, nor "admin" or "owner"; counts.changedBy (the reflection labels) is kept — from computeRealtimeStatus and from GET status alike [story 5 AC-5 "Who may read it … A signed-out reader … gets no who from any route. The public status may still say when"; ADR 0005 D6 "No who anywhere public … The fields are named role and key, never changedBy, because the public status already carries counts.changedBy", D7, Consequences "The public status gains exactly one field, inStartWindow" and "The status never carries who"]', async () => {
  const compute = routeFn('computeRealtimeStatus');
  const want = [...PASS_THROUGH, 'statusVersion', 'on', 'onSince', 'running', 'runningSince', 'switchUnreadable', 'stale', 'inStartWindow'].sort();
  const status = fullStatus();
  const statusText = JSON.stringify(status);
  assert(![OWNER8, ADMIN8, '"owner"', '"admin"'].some((k) => statusText.includes(k)), 'fixture: status.json should hold neither key nor role');
  await cases([
    { name: 'computeRealtimeStatus, an admin\'s on while on', via: 'compute', sw: SW2_ON_AGAIN, alive: true },
    { name: 'computeRealtimeStatus, an admin\'s off', via: 'compute', sw: SW2_OFF, alive: false },
    { name: 'computeRealtimeStatus, the owner\'s on', via: 'compute', sw: SW2_ON, alive: true },
    { name: 'GET status, an admin\'s on while on', via: 'route', sw: SW2_ON_AGAIN, alive: true },
    { name: 'GET status, an admin\'s off', via: 'route', sw: SW2_OFF, alive: false },
  ], async (c) => {
    let body;
    if (c.via === 'compute') body = compute({ status: clone(status), switchRecord: clone(c.sw), alive: c.alive, now: T0 });
    else {
      const res = await callStatus(statusBundle({ files: { [SWITCH_FILE]: canonicalSwitch2(c.sw), [STATUS_FILE]: statusText }, alive: c.alive }));
      assert(res.statusCode === 200, `answered ${showRes(res)}, expected 200`);
      body = res.body;
    }
    assert(body && typeof body === 'object', `the answer should be an object; is ${show(body)}`);
    const problems = [];
    const keys = Object.keys(body).filter((k) => body[k] !== undefined).sort();
    const missing = want.filter((k) => !keys.includes(k));
    const extra = keys.filter((k) => !want.includes(k));
    if (missing.length || extra.length) problems.push(`the answer's members should be story 3's plus inStartWindow, exactly (ADR 0005 Consequences); missing ${show(missing)}, extra ${show(extra)}`);
    const whoKeys = ['role', 'changedBy', 'key', 'who'].filter((k) => has(body, k));
    if (whoKeys.length) problems.push(`the public status carries ${show(whoKeys)} (ADR 0005 D6: no who anywhere public)`);
    const text = JSON.stringify(body);
    for (const needle of [c.sw.changedBy, OWNER, ADMIN, OWNER.toUpperCase(), ADMIN.toUpperCase()]) if (text.includes(needle)) problems.push(`the public status carries ${needle === c.sw.changedBy ? "the changer's key" : 'a full pubkey'} ${show(needle)}: ${around(text, text.indexOf(needle))}`);
    const roles = stringsIn(body).filter((s) => s === 'owner' || s === 'admin');
    if (roles.length) problems.push(`the public status carries the role ${show(roles)} (ADR 0005 D6)`);
    if (exact(body.counts && body.counts.changedBy) !== exact(status.counts.changedBy)) problems.push(`counts.changedBy (the reflection labels) should pass through as ${show(status.counts.changedBy)}; is ${show(body.counts && body.counts.changedBy)}`);
    assert(problems.length === 0, problems.join('\n          '));
  });
});

test('RR31: every accepted POST is a change, and the record\'s onSince is the last off-to-on time — an on while on carries the previous onSince (version 2) or its changedAt (the pre-story-5 version 1 record), so the window does not restart; an on from off, from a missing switch, from a damaged one, or from an on record carrying no time starts it now; an off writes null; changedAt, changedBy and role always move, a same-state off included — each written once as the exact version 2 record and answered exactly 200 { success: true, on, changedAt, recorded: true, takesEffectWithinSeconds: 5 } [story 5 AC-3 "An on while the path is already on does not restart the window", the story\'s "A change is a request to turn the switch on or off that the server accepts"; ADR 0005 D4 "Every accepted request is a change … onSince is the last off-to-on time", D11]', async () => {
  await cases([
    { name: 'an admin\'s on while on (version 2): its onSince carried', on: true, by: ADMIN, role: 'admin', prev: SW2_ON, onSince: SW2_ON.onSince },
    { name: 'the owner\'s on while on (version 1): its changedAt carried', on: true, by: OWNER, role: 'owner', prev: { version: 1, on: true, changedAt: SW_ON.changedAt, changedBy: OWNER8 }, onSince: SW_ON.changedAt },
    { name: 'an on while on, the record carrying no time: now', on: true, by: OWNER, role: 'owner', prev: { on: true }, onSince: iso(T0) },
    { name: 'an admin\'s on from off: now', on: true, by: ADMIN, role: 'admin', prev: SW2_OFF, onSince: iso(T0) },
    { name: 'an on from a missing switch: now', on: true, by: OWNER, role: 'owner', prev: null, onSince: iso(T0) },
    { name: 'an on over a damaged switch: now', on: true, by: OWNER, role: 'owner', prev: { unreadable: true }, onSince: iso(T0) },
    { name: 'an admin\'s off from on: null', on: false, by: ADMIN, role: 'admin', prev: SW2_ON_AGAIN, onSince: null },
    { name: 'an admin\'s off while the owner\'s off stands: still a change', on: false, by: ADMIN, role: 'admin', prev: { ...SW2_OFF, changedBy: OWNER8, role: 'owner' }, onSince: null },
  ], async (c) => {
    const o = c.by === ADMIN ? { session: { authenticated: true, pubkey: ADMIN } } : {};
    const r = await callSwitch(switchReq({ on: c.on }, o), switchBundle({ prev: c.prev }));
    const problems = [];
    const want = { version: 2, on: c.on, changedAt: iso(T0), changedBy: c.by.slice(0, 8), role: c.role, onSince: c.onSince };
    if (r.res.statusCode !== 200) problems.push(`answered ${showRes(r.res)}, expected 200`);
    if (r.calls.writeSwitch.length !== 1) problems.push(`writeSwitch should be called once; was called ${r.calls.writeSwitch.length} times`);
    else if (exact(r.calls.writeSwitch[0]) !== exact(want)) problems.push(`writeSwitch should get exactly ${show(want)} (ADR 0005 D4); got ${show(r.calls.writeSwitch[0])}`);
    const wantAnswer = { success: true, on: c.on, changedAt: iso(T0), recorded: true, takesEffectWithinSeconds: 5 };
    if (exact(r.res.body) !== exact(wantAnswer)) problems.push(`the answer should be exactly ${show(wantAnswer)} (ADR 0005 D11); it is ${show(r.res.body)}`);
    problems.push(...leakProblems(c.name, r.res), ...adminLeakProblems(c.name, r.res));
    assert(problems.length === 0, problems.join('\n          '));
  });
});

test('RR32: "It lasts", end to end on the default dependencies, against a temporary TAGGING_EDGES_STATE_DIR only — with only the owner and admin lookups injected (no clock, readFile, stateDir or record method), the owner\'s POST on and then an admin\'s POST off each answer 200 recorded: true; handleRealtimeSwitchRecord, on its default readFile and stateDir, then answers the owner exactly 200 { success: true, on: false, switchUnreadable: false, historyUnreadable: false, state: "recorded", latest: the admin\'s off, history: [the admin\'s off, the owner\'s on] } at the times the POSTs answered, and writes nothing; after a fresh require (a restart) it answers an admin the same; and a fresh createStore({}) reads the same switch.json (version 2, the admin\'s off) and the same two-entry switch-history.json [story 5 AC-5 "It lasts. The record survives restarts and deploys", "What the panel shows: the latest change … the last 10 changes, newest first", "Who may read it"; ADR 0005 D1 ("Both files are in <stateDir>/realtime/ on the data volume"), D2, D3, D6 ("It writes nothing, and answers 200 …"), D11; Seams: "Default-dependency coverage … runs only against a temporary TAGGING_EDGES_STATE_DIR"]', async () => {
  await withDir(async ({ root }) => {
    await withEnv({ TAGGING_EDGES_STATE_DIR: root }, async () => {
      const mod = loadRoutes();
      const handleSwitch = need(mod, 'handleRealtimeSwitch', ROUTES_REL, 'T22');
      const problems = [];
      /** Only the identity lookups, as the drift route's defaults would give them; every other dependency is the default. */
      const identity = () => ({ getOwnerPubkey: () => OWNER, getAdminPubkeys: () => [ADMIN] });
      const adminSession = { authenticated: true, pubkey: ADMIN };
      const needles = [root, fs.realpathSync(root), ADMIN, ADMIN.toUpperCase()];
      /** A POST on the defaults → the change's changedAt from its answer (ADR 0005 D11), or null. */
      const post = async (label, on, o) => {
        const res = await callHandler(handleSwitch, switchReq({ on }, o), identity());
        if (res.statusCode !== 200 || !res.body || res.body.recorded !== true) problems.push(`${label} answered ${showRes(res)}, expected 200 with recorded: true (ADR 0005 D11)`);
        problems.push(...leakProblems(label, res, needles));
        const at = res.body && isIsoTime(res.body.changedAt) ? res.body.changedAt : null;
        if (at === null) problems.push(`${label}: the answer should carry the change's changedAt, an ISO time (ADR 0005 D11); it is ${show(res.body)}`);
        return at;
      };
      const ownerAt = await post('the owner\'s POST on', true, {});
      const adminAt = await post('an admin\'s POST off', false, { session: adminSession });
      const ownerEntry = { on: true, at: ownerAt, role: 'owner', key: OWNER8 };
      const adminEntry = { on: false, at: adminAt, role: 'admin', key: ADMIN8 };
      const want = { success: true, on: false, switchUnreadable: false, historyUnreadable: false, state: 'recorded', latest: adminEntry, history: [adminEntry, ownerEntry] };
      const before = snapshot(root);
      /** The gated GET on its default readFile and stateDir; false when the export is missing (a named failure). */
      const getRecord = async (label, routes, session) => {
        let handler;
        try {
          handler = need(routes, 'handleRealtimeSwitchRecord', ROUTES_REL, 'ADR 0005 D6: the owner-or-admin GET on the switch path; T22 as amended');
        } catch (e) { problems.push(`${label}: ${firstLine(e)}`); return false; }
        const res = await callHandler(handler, recordReq(session), identity());
        if (res.statusCode !== 200) problems.push(`${label} answered ${showRes(res)}, expected 200 (ADR 0005 D6)`);
        else if (exact(res.body) !== exact(want)) problems.push(`${label}: the record read back on the default readFile and stateDir should be exactly what the two changes left (AC-5 "It lasts"; ADR 0005 D3, D6)\n          expected: ${show(want)}\n          actual:   ${show(res.body)}`);
        problems.push(...leakProblems(label, res, needles));
        return true;
      };
      if (await getRecord('GET on the switch path, the owner', mod, ownerSession())) {
        await getRecord('GET on the switch path after a fresh require (a restart), an admin', loadRoutes(), adminSession);
      }
      const after = snapshot(root);
      if (exact(after) !== exact(before)) problems.push(`the GET changed the state directory (ADR 0005 D6: "It writes nothing")\n          before: ${show(Object.keys(before))}\n          after:  ${show(Object.keys(after))}`);
      // A fresh store over the default directory: the same two files, as a restart or a deploy finds them.
      const store = storeAt(undefined);
      const wantSwitch = { version: 2, on: false, changedAt: adminAt, changedBy: ADMIN8, role: 'admin', onSince: null };
      let sw;
      try { sw = await call(store, 'readSwitch'); } catch (e) { problems.push(`a fresh store's readSwitch(): ${firstLine(e)}`); }
      if (!sw || exact(pick(sw, SWITCH2_KEYS)) !== exact(wantSwitch)) problems.push(`a fresh createStore({})'s readSwitch() should give the admin's off, version 2 ${show(wantSwitch)} (ADR 0005 D1); gave ${show(sw)}`);
      const wantHist = { version: 1, changes: [adminEntry, ownerEntry] };
      let hist;
      try { hist = await call(store, 'readSwitchHistory'); } catch (e) { problems.push(`a fresh store's readSwitchHistory(): ${firstLine(e)}`); }
      if (hist !== undefined && (!hist || exact(pick(hist, ['version', 'changes'])) !== exact(wantHist))) problems.push(`a fresh createStore({})'s readSwitchHistory() should give the two changes, newest first ${show(wantHist)} (ADR 0005 D1, D2); gave ${show(hist)}`);
      assert(problems.length === 0, problems.join('\n        '));
    });
  }, { makeRealtime: false });
});

test('RR33: withDeps\' defaults follow an injected stateDir() — with stateDir() injected as a temporary directory, TAGGING_EDGES_STATE_DIR pointed at a second (decoy) one, and readSwitch, readSwitchHistory, writeSwitchHistory, writeSwitch and unlinkSwitch left to their defaults, the owner\'s POST on writes <stateDir>/realtime/switch.json and <stateDir>/realtime/switch-history.json and nothing else; an admin\'s on while on then carries the onSince the default readSwitch read there; the owner\'s off leaves three changes in that history, which the default readSwitchHistory read there; the owner\'s off whose (injected) write fails is unlinked there by the default unlinkSwitch, the history left byte for byte; and nothing ever appears under the decoy [ADR 0005 Seams: "withDeps\' defaults keep following d.stateDir(), as T27 does for writeSwitch", "The default record dependencies are the store\'s under it"; D1 ("Both files are in <stateDir>/realtime/"), D2, D4; Option A ("The off fallback\'s unlink leaves the history file intact"); T27]', async () => {
  await withDir(async ({ root }) => {
    const decoy = fs.mkdtempSync(path.join(os.tmpdir(), 'tagging-edges-realtime-rr33-decoy-'));
    try {
      await withEnv({ TAGGING_EDGES_STATE_DIR: decoy }, async () => {
        const handleSwitch = routeFn('handleRealtimeSwitch');
        const problems = [];
        /** stateDir() and the identity lookups and clock injected; every record dependency left to its default. */
        const deps = (now, extra = {}) => ({ stateDir: () => root, getOwnerPubkey: () => OWNER, getAdminPubkeys: () => [ADMIN], now: () => now, ...extra });
        const adminO = { session: { authenticated: true, pubkey: ADMIN } };
        const needles = [root, fs.realpathSync(root), decoy, fs.realpathSync(decoy)];
        const SW_REL = 'realtime/switch.json';
        const HIST_REL = 'realtime/switch-history.json';
        const swFile = path.join(root, SW_REL);
        const histFile = path.join(root, HIST_REL);
        const post = async (label, on, o, d) => {
          const res = await callHandler(handleSwitch, switchReq({ on }, o), d);
          if (res.statusCode !== 200 || !res.body || res.body.success !== true) problems.push(`${label} answered ${showRes(res)}, expected 200 success`);
          problems.push(...leakProblems(label, res, needles));
          return res;
        };
        /** What lies under the injected stateDir() and under the decoy, against the files expected. */
        const where = (label, expected) => {
          const inRoot = Object.keys(snapshot(root)).sort();
          const extra = inRoot.filter((k) => !expected.includes(k));
          if (extra.length) problems.push(`${label}: files appeared under the injected stateDir() beyond ${show(expected)}: ${show(extra)}`);
          const lacking = expected.filter((k) => !inRoot.includes(k));
          if (lacking.length) problems.push(`${label}: no ${show(lacking)} under the injected stateDir() (ADR 0005 Seams: "withDeps' defaults keep following d.stateDir()"); it holds ${show(inRoot)}`);
          const inDecoy = Object.keys(snapshot(decoy));
          if (inDecoy.length) problems.push(`${label}: files appeared under TAGGING_EDGES_STATE_DIR instead of the injected stateDir() — a default followed state.stateDir(), not d.stateDir(): ${show(inDecoy)}`);
        };
        const fileIs = (label, rec) => {
          const text = fs.existsSync(swFile) ? fs.readFileSync(swFile, 'utf8') : null;
          if (text === null || strip(text) !== canonicalSwitch2(rec)) problems.push(`${label}: <stateDir>/${SW_REL} should be the canonical version 2 text ${show(canonicalSwitch2(rec))} (ADR 0005 D1, D4); is ${show(text)}`);
        };
        await post('the owner\'s POST on', true, {}, deps(T0));
        where('after the owner\'s on', [SW_REL, HIST_REL]);
        fileIs('after the owner\'s on', { version: 2, on: true, changedAt: iso(T0), changedBy: OWNER8, role: 'owner', onSince: iso(T0) });
        await post('an admin\'s POST on while on', true, adminO, deps(T0 + 30 * SEC));
        fileIs('after an admin\'s on while on (the default readSwitch read the owner\'s onSince under the injected stateDir())', { version: 2, on: true, changedAt: iso(T0 + 30 * SEC), changedBy: ADMIN8, role: 'admin', onSince: iso(T0) });
        await post('the owner\'s POST off', false, {}, deps(T0 + MIN));
        where('after three changes', [SW_REL, HIST_REL]);
        fileIs('after the owner\'s off', { version: 2, on: false, changedAt: iso(T0 + MIN), changedBy: OWNER8, role: 'owner', onSince: null });
        const wantHist = {
          version: 1,
          changes: [
            { on: false, at: iso(T0 + MIN), role: 'owner', key: OWNER8 },
            { on: true, at: iso(T0 + 30 * SEC), role: 'admin', key: ADMIN8 },
            { on: true, at: iso(T0), role: 'owner', key: OWNER8 },
          ],
        };
        let hist = null;
        if (fs.existsSync(histFile)) { try { hist = JSON.parse(fs.readFileSync(histFile, 'utf8')); } catch (e) { problems.push(`<stateDir>/${HIST_REL} is not JSON: ${firstLine(e)}`); } }
        if (exact(hist) !== exact(wantHist)) problems.push(`<stateDir>/${HIST_REL} should hold the three changes, newest first — the default readSwitchHistory and writeSwitchHistory both under the injected stateDir() (ADR 0005 D1, D2)\n          expected: ${show(wantHist)}\n          actual:   ${show(hist)}`);
        // The off fallback: only writeSwitch injected (failing); the default unlinkSwitch must remove the injected stateDir()'s switch.json.
        const histBefore = fs.existsSync(histFile) ? fs.readFileSync(histFile) : null;
        const enospc = Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' });
        const fallback = await post('the owner\'s POST off whose write fails', false, {}, deps(T0 + 2 * MIN, { writeSwitch: () => { throw enospc; } }));
        if (fallback.statusCode === 200 && fs.existsSync(swFile)) problems.push(`the off fallback answered 200 but left <stateDir>/${SW_REL} in place — the default unlinkSwitch did not follow the injected stateDir(): ${show(fs.readFileSync(swFile, 'utf8'))}`);
        const histAfter = fs.existsSync(histFile) ? fs.readFileSync(histFile) : null;
        if (histBefore !== null && (histAfter === null || !histAfter.equals(histBefore))) problems.push(`the off fallback changed <stateDir>/${HIST_REL} (ADR 0005 Option A: the unlink leaves the history intact; D2 step 5: "run no fold")\n          before: ${show(histBefore)}\n          after:  ${show(histAfter)}`);
        where('after the off fallback', histBefore === null ? [] : [HIST_REL]);
        assert(problems.length === 0, problems.join('\n        '));
      });
    } finally {
      fs.rmSync(decoy, { recursive: true, force: true });
    }
  }, { makeRealtime: false });
});

// ─── runner ────────────────────────────────────────────────────────────────────────────────────────────────────
async function run() {
  console.log('\n--- tagging-edges real-time store and routes tests (epic tagging-edges, Story 3 — T21, T22, T26, T27, T32, T33; Story 5 — ADR 0005) ---');
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  PASS  ${name}`); pass++; }
    catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failures.push({ name, message: err.message }); fail++; }
  }
  console.log(`\ntagging-edges-realtime-routes: ${pass} passed, ${fail} failed, 0 skipped`);
  return { pass, fail, skipped: 0, failures };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
