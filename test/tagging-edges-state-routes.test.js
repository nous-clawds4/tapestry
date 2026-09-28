'use strict';
/**
 * Tests for Story 2 (epic: tagging-edges) — the gap-filling pass's state files and its three routes.
 *
 * Story: engineering-team/stories/tagging-edges/2-gap-filling-pass-and-backfill.md (AC-5: large removals held and
 *        confirmed only by the owner; AC-7: every run leaves a report the owner can read, a stopped run reads failed)
 * ADR:   engineering-team/decisions/tagging-edges/0002-gap-filling-pass.md — D8, D9, "The owner's confirmation",
 *        "The report", "Who reads it", Implementation notes (state.js; src/api/tagging-edges/index.js; the
 *        reconcileTaggingEdges registry entry) and "Seams for Test Design" → State, Routes, Channels
 * Plan:  engineering-team/stories/tagging-edges/2-gap-filling-pass-and-backfill.test-plan.md
 *
 * Intentionally failing until story 2's implementation lands (red phase): src/pipeline/tagging-edges/state.js and
 * src/api/tagging-edges/index.js do not exist, and taskRegistry.json has no reconcileTaggingEdges entry. Each module
 * under test is require()d LAZILY inside the tests (afresh for every test, through load helpers that say what is
 * missing), so this suite always loads. RT28 pins behaviour that is already right and passes today. The routes'
 * registration in src/api/index.js is test/tagging-edges-wiring.test.js's (SWR11), not this suite's.
 *
 * Classes:
 *   ST — src/pipeline/tagging-edges/state.js against a real temp directory named by TAGGING_EDGES_STATE_DIR. /proc
 *        files reach it only through an injected readFile (the ADR's `{ readFile }` option), never the host's /proc.
 *   RT — src/api/tagging-edges/index.js: the pure computeStatus, and handleStatus / handleHeld /
 *        handleConfirmHeldRemovals called directly with a fake req/res and injected dependencies; and the task
 *        channels (processor.buildChildArgs, entryResolver.buildQueryParamsFromArgs) against the registry entry the
 *        ADR adds.
 *
 * Hermetic: temp directories only (fs.mkdtempSync under os.tmpdir()), removed afterwards; env restored; fake 64-hex
 * pubkeys only (never a deployment's TA, never the ADR 0015 literal); no graph, relay, network, task queue or host
 * /proc. Principle 4: nothing here touches the local graph or relay. RT9b alone points TAPESTRY_SETTINGS_PATH at a
 * temp settings.json naming the admin (so the house admin list is filled), restores it and forgets the house modules.
 *
 * Choices the ADR leaves open (recorded in the plan):
 *   - Handlers take their dependencies as a third argument, `handleX(req, res, deps)` — the handleSetupStatus
 *     precedent (src/api/setup/status.js), safe when Express passes `next` there. deps given: `readFile`
 *     (fs.readFileSync-shaped: (path, encoding) → contents, throwing ENOENT; awaiting it works; a trailing callback
 *     works), `isQueueAvailable`, `runViaQueueAsync`, and the owner as a getter, `getOwnerPubkey()` (env
 *     BRAINSTORM_OWNER_PUBKEY holds the same fake; TASK_QUEUE_ENABLED is 'true'). A handler makes every read through
 *     that readFile — report.json, confirmation.json, the held file, and liveness (`isAlive(record, { readFile })`,
 *     so /proc/<pid>/stat comes from the injected reader, never the host's /proc).
 *   - A confirmation record's nonce is 32 lower-case hex characters (the route mints it from crypto.randomBytes(16)),
 *     so claimed/<runId>-<nonce>.json is built from two checked grammars; every fixture nonce here has that form.
 *   - GET status's confirmationPending carries every field of the pending record except the nonce, and may add keys
 *     derived from it (the report shape is additive); the nonce appears nowhere in the answer.
 *   - A tracer on the fs module (fs, fs.promises and FileHandle) records every call on a path under the temp state
 *     directory, so "before any filesystem call", "no held-file read", "fsynced" and "renamed" are checked whichever
 *     fs API the module uses. The same tracer simulates the crash between temp write and rename, and a pass starting
 *     (and claiming) right after the confirm route writes its record.
 *   - The state directory starts as the wrapper leaves it — the directory alone — so state.js creates held/,
 *     claimed/ and preimages/ itself. writeHeld(runId, list) / readHeld(runId) → list; claimConfirmation(runId) → the
 *     claimed record (itself or as `.record`), nothing when there is none; withdrawConfirmation() → truthy when it
 *     withdrew a record, falsy (no throw) when there was none; isAlive takes the report record (`process: {pid,
 *     startTime}`); heldDigest(list) is the lower-case hex sha256.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { fileURLToPath } = require('url');
const FX = require('./helpers/taggingEdgesFixtures');

const REPO = path.join(__dirname, '..');
const STATE_MOD = path.join(REPO, 'src/pipeline/tagging-edges/state.js');
const ROUTES_MOD = path.join(REPO, 'src/api/tagging-edges/index.js');
const PROCESSOR_MOD = path.join(REPO, 'src/manage/taskQueue/queue/processor.js');
const RESOLVER_MOD = path.join(REPO, 'src/manage/taskQueue/queue/entryResolver.js');
const REGISTRY = path.join(REPO, 'src/manage/taskQueue/taskRegistry.json');
const STATE_LABEL = 'src/pipeline/tagging-edges/state.js';
const ROUTES_LABEL = 'src/api/tagging-edges/index.js';
const DEFAULT_STATE_DIR = '/var/lib/brainstorm/tagging-edges';
const TASK = 'reconcileTaggingEdges';
const TIMEOUT_MS = 1800000; // the registry entry's 30-minute time-out (ADR "Lock class, time-outs, sizes")
const DAY_MS = 24 * 60 * 60 * 1000;
const ENV_KEYS = ['TAGGING_EDGES_STATE_DIR', 'BRAINSTORM_OWNER_PUBKEY', 'TASK_QUEUE_ENABLED'];
const PATHS = {
  status: '/api/tagging-edges/status',
  held: '/api/tagging-edges/held',
  confirm: '/api/tagging-edges/confirm-held-removals',
};

// ─── people (fake 64-hex) ───
const OWNER = FX.pubkeyOf('owner');
const ADMIN = FX.pubkeyOf('admin');
const STRANGER = FX.pubkeyOf('stranger');
const HOST = 'tapestry.example';

// ─── run ids, each in RUN_ID_RE's grammar /^\d{8}T\d{6}Z-[0-9a-f]{8}$/ (ADR "The owner's confirmation") ───
const RUN_OLD = '20260926T101500Z-99887766';
const RUN_HELD = '20260927T101500Z-0a1b2c3d';
const RUN_DONE = '20260927T110000Z-00c0ffee';
const RUN_NEW = '20260927T120000Z-feedf00d';
const CLAIM_A = '20260928T030000Z-aaaaaaa1';
const CLAIM_B = '20260928T030000Z-bbbbbbb2';
/** Above every Linux pid_max, so no /proc entry exists for it on any host. */
const DEAD_PID = 2147483646;
const LIVE_PID = 4242;
const NEW_PID = 4243;

const tests = [];
function test(name, fn) { tests.push([name, fn]); }

// ─── assertions ───
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') return Object.keys(v).sort().reduce((o, k) => { o[k] = sortKeys(v[k]); return o; }, {});
  return v;
}
function brief(v, n = 300) {
  let s;
  try { s = JSON.stringify(v); } catch (_) { s = String(v); }
  if (s === undefined) s = String(v);
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
function same(actual, expected, label) {
  const a = JSON.stringify(sortKeys(actual));
  const e = JSON.stringify(sortKeys(expected));
  if (a !== e) throw new Error(`${label}\n        expected: ${brief(expected, 600)}\n        actual:   ${brief(actual, 600)}`);
}
function eq(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}\n        expected: ${brief(expected)}\n        actual:   ${brief(actual)}`);
}
function firstLine(s) { return String(s).split('\n')[0]; }

// ─── lazy loading (afresh for each test, so an env read at load time sees this test's state directory) ───
function forgetModules() {
  for (const p of [STATE_MOD, ROUTES_MOD]) delete require.cache[p];
}
function loadState() {
  forgetModules();
  try { return require(STATE_MOD); } catch (e) {
    throw new Error(`${STATE_LABEL} not implemented yet (require failed: ${firstLine(e.message)})`);
  }
}
function loadRoutes() {
  forgetModules();
  try { return require(ROUTES_MOD); } catch (e) {
    throw new Error(`${ROUTES_LABEL} not implemented yet (require failed: ${firstLine(e.message)})`);
  }
}
function need(mod, name, label) {
  if (!mod || typeof mod[name] !== 'function') {
    throw new Error(`${label} does not export ${name}() yet (ADR tagging-edges/0002, Implementation notes)`);
  }
  return mod[name];
}

// ─── fs tracer ───────────────────────────────────────────────────────────────────────────────────────────────
// Wraps fs, fs.promises and FileHandle for the whole run. While a test's trace is live it records every call whose
// path (or fd / FileHandle) lies under that test's state directory as { op, rel[, to] }; everything else passes
// straight through. The suite's own fixture I/O runs inside quiet(), unrecorded.
let TRACE = null;
let QUIET = 0;
const PATCHED = [];

function quiet(fn) { QUIET++; try { return fn(); } finally { QUIET--; } }
async function quietAsync(fn) { QUIET++; try { return await fn(); } finally { QUIET--; } }
function live() { return TRACE && QUIET === 0 ? TRACE : null; }

function newTrace(root) {
  const roots = [path.resolve(root)];
  try { const real = fs.realpathSync(root); if (!roots.includes(real)) roots.push(real); } catch (_) { /* keep one */ }
  return {
    roots, ops: [], fds: new Map(), handles: new WeakMap(), failRenameTo: null, onCreate: null,
    reset() { this.ops.length = 0; },
  };
}
function absOf(p) {
  if (typeof p === 'string') return path.resolve(p);
  if (Buffer.isBuffer(p)) return path.resolve(p.toString('utf8'));
  if (p instanceof URL && p.protocol === 'file:') return path.resolve(fileURLToPath(p));
  return null;
}
function relTo(t, abs) {
  if (!abs) return null;
  for (const r of t.roots) {
    if (abs === r) return '';
    if (abs.startsWith(r + path.sep)) return abs.slice(r.length + 1).split(path.sep).join('/');
  }
  return null;
}
function targetOf(t, p) {
  if (typeof p === 'number') return t.fds.get(p) || null;
  if (p && typeof p === 'object' && t.handles.has(p)) return t.handles.get(p);
  return absOf(p);
}
function note(t, op, a, b) {
  const rel = relTo(t, a);
  const to = b === undefined ? undefined : relTo(t, b);
  if (rel === null && (to === undefined || to === null)) return;
  t.ops.push(to === undefined ? { op, rel } : { op, rel, to });
}
function crash() {
  const e = new Error('simulated crash between the temp write and the rename');
  e.code = 'EIO';
  return e;
}
function created(t, abs) {
  const c = t.onCreate;
  if (!c || c.fired || relTo(t, abs) !== c.rel) return;
  c.fired = true;
  quiet(c.fn);
}
function openKind(flags) {
  if (flags === undefined || flags === null || typeof flags === 'function') return 'open-read';
  if (typeof flags === 'number') {
    const w = fs.constants.O_WRONLY | fs.constants.O_RDWR | fs.constants.O_APPEND | fs.constants.O_CREAT | fs.constants.O_TRUNC;
    return (flags & w) ? 'open-write' : 'open-read';
  }
  return /[wa+]/.test(String(flags)) ? 'open-write' : 'open-read';
}
function patch(obj, key, make) {
  if (!obj || typeof obj[key] !== 'function') return;
  const orig = obj[key];
  PATCHED.push([obj, key, orig]);
  obj[key] = make(orig);
}

const SYNC_ONE = {
  readFileSync: 'read', existsSync: 'stat', statSync: 'stat', lstatSync: 'stat', accessSync: 'stat',
  readdirSync: 'readdir', opendirSync: 'readdir', writeFileSync: 'write', appendFileSync: 'append',
  unlinkSync: 'unlink', rmSync: 'unlink', rmdirSync: 'unlink', mkdirSync: 'mkdir', truncateSync: 'write',
  utimesSync: 'write', chmodSync: 'write', createReadStream: 'read', createWriteStream: 'write', openSync: 'open',
};
const SYNC_TWO = { renameSync: 'rename', copyFileSync: 'copy', linkSync: 'link' };
const CB_ONE = {
  readFile: 'read', exists: 'stat', stat: 'stat', lstat: 'stat', access: 'stat', readdir: 'readdir', opendir: 'readdir',
  writeFile: 'write', appendFile: 'append', unlink: 'unlink', rm: 'unlink', rmdir: 'unlink', mkdir: 'mkdir',
  truncate: 'write', open: 'open',
};
const CB_TWO = { rename: 'rename', copyFile: 'copy', link: 'link' };
const P_ONE = {
  readFile: 'read', stat: 'stat', lstat: 'stat', access: 'stat', readdir: 'readdir', opendir: 'readdir',
  writeFile: 'write', appendFile: 'append', unlink: 'unlink', rm: 'unlink', rmdir: 'unlink', mkdir: 'mkdir',
  truncate: 'write', open: 'open',
};
const P_TWO = { rename: 'rename', copyFile: 'copy', link: 'link' };
const FD_SYNC = { fsyncSync: 'fsync', fdatasyncSync: 'fsync', writeSync: 'fdwrite', closeSync: 'close' };
const FD_CB = { fsync: 'fsync', fdatasync: 'fsync', write: 'fdwrite', close: 'close' };
const FH_METHODS = { sync: 'fsync', datasync: 'fsync', writeFile: 'fdwrite', appendFile: 'fdwrite', write: 'fdwrite', readFile: 'read', close: 'close' };

async function installTracer(scratch) {
  const probe = path.join(scratch, 'filehandle-probe');
  const fh = await fs.promises.open(probe, 'w');
  const fhProto = Object.getPrototypeOf(fh);
  await fh.close();

  for (const [k, op] of Object.entries(SYNC_ONE)) {
    patch(fs, k, (orig) => function tracedSync(...a) {
      const t = live();
      if (!t) return orig.apply(this, a);
      const abs = targetOf(t, a[0]);
      note(t, k === 'openSync' ? openKind(a[1]) : op, abs);
      const out = orig.apply(this, a);
      if (k === 'openSync' && abs) t.fds.set(out, abs);
      if (k === 'writeFileSync') created(t, abs);
      return out;
    });
  }
  for (const [k, op] of Object.entries(SYNC_TWO)) {
    patch(fs, k, (orig) => function tracedSync2(...a) {
      const t = live();
      if (!t) return orig.apply(this, a);
      const from = absOf(a[0]);
      const to = absOf(a[1]);
      note(t, op, from, to);
      if (k === 'renameSync' && t.failRenameTo !== null && relTo(t, to) === t.failRenameTo) throw crash();
      const out = orig.apply(this, a);
      if (k === 'renameSync') created(t, to);
      return out;
    });
  }
  for (const [k, op] of Object.entries(CB_ONE)) {
    patch(fs, k, (orig) => function tracedCb(...a) {
      const t = live();
      if (!t) return orig.apply(this, a);
      const abs = targetOf(t, a[0]);
      note(t, k === 'open' ? openKind(a[1]) : op, abs);
      const at = a.length - 1;
      if ((k === 'open' || k === 'writeFile') && typeof a[at] === 'function') {
        const cb = a[at];
        a[at] = function tracedDone(err, ...rest) {
          if (!err && k === 'open' && abs) t.fds.set(rest[0], abs);
          if (!err && k === 'writeFile') created(t, abs);
          return cb.call(this, err, ...rest);
        };
      }
      return orig.apply(this, a);
    });
  }
  for (const [k, op] of Object.entries(CB_TWO)) {
    patch(fs, k, (orig) => function tracedCb2(...a) {
      const t = live();
      if (!t) return orig.apply(this, a);
      const from = absOf(a[0]);
      const to = absOf(a[1]);
      note(t, op, from, to);
      const at = a.length - 1;
      const cb = typeof a[at] === 'function' ? a[at] : null;
      if (k === 'rename' && t.failRenameTo !== null && relTo(t, to) === t.failRenameTo) {
        if (cb) process.nextTick(cb, crash());
        return undefined;
      }
      if (k === 'rename' && cb) a[at] = function tracedDone(err, ...rest) { if (!err) created(t, to); return cb.call(this, err, ...rest); };
      return orig.apply(this, a);
    });
  }
  for (const [k, op] of Object.entries(P_ONE)) {
    patch(fs.promises, k, (orig) => function tracedP(...a) {
      const t = live();
      if (!t) return orig.apply(this, a);
      const abs = targetOf(t, a[0]);
      note(t, k === 'open' ? openKind(a[1]) : op, abs);
      const p = orig.apply(this, a);
      if (k !== 'open' && k !== 'writeFile') return p;
      return p.then((out) => {
        if (k === 'open' && abs && out) { t.handles.set(out, abs); if (typeof out.fd === 'number') t.fds.set(out.fd, abs); }
        if (k === 'writeFile') created(t, abs);
        return out;
      });
    });
  }
  for (const [k, op] of Object.entries(P_TWO)) {
    patch(fs.promises, k, (orig) => function tracedP2(...a) {
      const t = live();
      if (!t) return orig.apply(this, a);
      const from = absOf(a[0]);
      const to = absOf(a[1]);
      note(t, op, from, to);
      if (k === 'rename' && t.failRenameTo !== null && relTo(t, to) === t.failRenameTo) return Promise.reject(crash());
      const p = orig.apply(this, a);
      return k === 'rename' ? p.then((out) => { created(t, to); return out; }) : p;
    });
  }
  for (const [k, op] of Object.entries(FD_SYNC)) {
    patch(fs, k, (orig) => function tracedFd(...a) {
      const t = live();
      if (t) note(t, op, t.fds.get(a[0]) || null);
      const out = orig.apply(this, a);
      if (t && k === 'closeSync') t.fds.delete(a[0]);
      return out;
    });
  }
  for (const [k, op] of Object.entries(FD_CB)) {
    patch(fs, k, (orig) => function tracedFdCb(...a) {
      const t = live();
      if (t) { note(t, op, t.fds.get(a[0]) || null); if (k === 'close') t.fds.delete(a[0]); }
      return orig.apply(this, a);
    });
  }
  for (const [k, op] of Object.entries(FH_METHODS)) {
    patch(fhProto, k, (orig) => function tracedHandle(...a) {
      const t = live();
      if (t) note(t, op, t.handles.get(this) || t.fds.get(this.fd) || null);
      return orig.apply(this, a);
    });
  }
}
function uninstallTracer() {
  while (PATCHED.length) { const [obj, key, orig] = PATCHED.pop(); obj[key] = orig; }
  TRACE = null;
}
function showOps(ops) {
  if (!ops.length) return '(none)';
  return ops.map((o) => `${o.op} ${o.rel === null ? '<outside>' : o.rel === '' ? '<state dir>' : o.rel}${o.to !== undefined ? ` → ${o.to === null ? '<outside>' : o.to}` : ''}`).join('; ');
}

// ─── per-test state directory ───
let SUITE_ROOT = null;
function saveEnv() { return ENV_KEYS.reduce((o, k) => { o[k] = process.env[k]; return o; }, {}); }
function restoreEnv(saved) {
  for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
}
/** A fresh state directory (the directory alone, as the wrapper's `mkdir -p` leaves it), a live trace, env set. */
async function withState(fn) {
  const root = quiet(() => fs.mkdtempSync(path.join(SUITE_ROOT, 'state-')));
  const saved = saveEnv();
  process.env.TAGGING_EDGES_STATE_DIR = root;
  process.env.BRAINSTORM_OWNER_PUBKEY = OWNER;
  process.env.TASK_QUEUE_ENABLED = 'true';
  const trace = newTrace(root);
  TRACE = trace;
  try {
    return await fn({ root, trace });
  } finally {
    TRACE = null;
    forgetModules();
    restoreEnv(saved);
    quiet(() => fs.rmSync(root, { recursive: true, force: true }));
  }
}

// ─── fixture I/O (always quiet) ───
function put(root, rel, content) {
  quiet(() => {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, typeof content === 'string' || Buffer.isBuffer(content) ? content : JSON.stringify(content, null, 2));
  });
}
function readText(root, rel) { return quiet(() => fs.readFileSync(path.join(root, rel), 'utf8')); }
function readJson(root, rel) {
  const text = readText(root, rel);
  try { return JSON.parse(text); } catch (e) { throw new Error(`${rel} is not JSON (${e.message}): ${text.slice(0, 200)}`); }
}
function exists(root, rel) { return quiet(() => fs.existsSync(path.join(root, rel))); }
function listDir(root, rel) {
  return quiet(() => {
    try { return fs.readdirSync(path.join(root, rel)).sort(); } catch (e) { if (e.code === 'ENOENT') return []; throw e; }
  });
}
function snapshot(root) {
  return quiet(() => {
    const out = [];
    (function walk(dir, prefix) {
      for (const name of fs.readdirSync(dir).sort()) {
        const abs = path.join(dir, name);
        const rel = prefix ? `${prefix}/${name}` : name;
        if (fs.statSync(abs).isDirectory()) { out.push(`${rel}/`); walk(abs, rel); } else {
          out.push(`${rel} sha256:${crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex').slice(0, 16)}`);
        }
      }
    })(root, '');
    return out;
  });
}
function diffSnap(before, after) {
  const gone = before.filter((x) => !after.includes(x));
  const added = after.filter((x) => !before.includes(x));
  return gone.length || added.length ? `removed or changed: ${gone.join(', ') || '(none)'}; added or changed: ${added.join(', ') || '(none)'}` : '';
}
/** Make `rel` unreadable with an error whose message names the absolute path (a symlink to itself: ELOOP). */
function unreadable(root, rel) {
  quiet(() => {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.symlinkSync(path.basename(abs), abs);
  });
}
function relIn(root, p) {
  if (typeof p !== 'string') return null;
  const abs = path.resolve(p);
  const t = newTrace(root);
  return relTo(t, abs);
}
function leaksPath(body, root) {
  const s = JSON.stringify(body === undefined ? null : body) || '';
  return newTrace(root).roots.some((r) => s.includes(r)) || s.includes(SUITE_ROOT);
}

// ─── held lists, reports, records ───
const byAddress = (a, b) => (a.address < b.address ? -1 : a.address > b.address ? 1 : 0);
/** `n` held entries {address, seenEventId, reason}, sorted by address (so file order and sorted order agree). */
function heldList(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      address: `39999:${FX.pubkeyOf(`tagger-${i}`)}:tag-${i}`,
      seenEventId: FX.idOf(`seen-${i}`),
      reason: i % 7 === 3 ? 'non-tagging' : 'not-on-relay',
    });
  }
  return out.sort(byAddress);
}
/** ADR heldLines: `address\tseenEventId\treason\n` per entry, sorted; the digest is its sha256 (lower-case hex). */
function canonicalHeldText(list) {
  return list.map((h) => `${h.address}\t${h.seenEventId}\t${h.reason}\n`).sort().join('');
}
function digestOf(list) { return crypto.createHash('sha256').update(canonicalHeldText(list), 'utf8').digest('hex'); }
function byReasonOf(list) { return list.reduce((o, h) => { o[h.reason] = (o[h.reason] || 0) + 1; return o; }, {}); }

/** A final report whose outcome is done-removals-held (ADR "The report"). */
function heldLatest(runId, list, over = {}) {
  return {
    runId, startedAt: '2026-09-27T10:15:00.000Z', endedAt: '2026-09-27T10:15:04.200Z', durationMs: 4200,
    outcome: 'done-removals-held', reasonCode: 'removals-held', reason: 'removals over the limit were held for the owner to confirm',
    stopped: false, confirmed: null, confirmation: { found: false, honoured: false },
    taggingsRead: 0, tagElementsRead: 0,
    relationships: { atStart: list.length + 40, added: 0, changed: 0, removed: 0, unchanged: 40, unresolved: 0, leftInPlace: 0 },
    peopleAdded: 0,
    refused: { total: 0, byReason: {} },
    held: { total: list.length, byReason: byReasonOf(list), digest: digestOf(list) },
    limit: { base: list.length + 40, leftInPlaceExcluded: 0, baseAfterConfirmed: null, removalsPlanned: list.length, floor: 50, fraction: '1/10', exceeded: true },
    identities: { canonical: FX.CANONICAL.slice(0, 8), local: FX.LOCAL.slice(0, 8) },
    phases: [{ phase: 'graph-read', ms: 12 }, { phase: 'relay-read', ms: 40 }, { phase: 'plan', ms: 3 }],
    running: false,
    process: { pid: DEAD_PID, startTime: '1' },
    ...over,
  };
}
/** A final report that held nothing. */
function doneLatest(runId, over = {}) {
  return heldLatest(runId, [], { outcome: 'done', reasonCode: 'done', reason: 'done', held: { total: 0, byReason: {}, digest: null }, ...over });
}
/** The first record a pass writes (ADR "Stopped runs"): it already reads failed and stopped. */
function pessimistic(runId, proc = { pid: DEAD_PID, startTime: '1' }) {
  return {
    runId, startedAt: '2026-09-27T12:00:00.000Z', outcome: 'failed', stopped: true, reasonCode: 'stopped',
    reason: 'stopped before it finished (time-out, deploy or restart)', running: true, process: proc,
  };
}
function reportOf(latest, previous = []) { return { reportVersion: 1, latest, previous }; }
function nineEarlier() {
  return Array.from({ length: 9 }, (_, i) => doneLatest(`202609${String(10 + i).padStart(2, '0')}T080000Z-${(0xb0000000 + i).toString(16)}`));
}
/** A confirmation record as the confirm route writes it (ADR "The owner's confirmation"). */
function confirmationRecord(o = {}) {
  const mintedAt = o.mintedAt || '2026-09-27T10:30:00.000Z';
  return {
    version: 1, runId: o.runId || RUN_HELD, heldDigest: o.heldDigest || 'd'.repeat(64), heldCount: o.heldCount || 60,
    nonce: o.nonce || nonceOf('default'), mintedAt, expiresAt: new Date(Date.parse(mintedAt) + DAY_MS).toISOString(),
    mintedBy: OWNER.slice(0, 8),
  };
}
const OLD_PENDING = confirmationRecord({ runId: RUN_OLD, nonce: nonceOf('older-pending') });
function claimedRecordOf(res) {
  if (res && typeof res === 'object' && typeof res.nonce === 'string') return res;
  if (res && typeof res === 'object' && res.record && typeof res.record.nonce === 'string') return res.record;
  return null;
}
function timeOf(v) { return typeof v === 'number' ? v : Date.parse(v); }
/** A fixture nonce in the route's form: 32 lower-case hex characters, distinct per label. */
function nonceOf(label) { return crypto.createHash('sha256').update(`nonce:${label}`, 'utf8').digest('hex').slice(0, 32); }
const NONCE_RE = /^[0-9a-f]{32}$/;

// ─── /proc fixtures ───
/** A /proc/<pid>/stat line: field 22 (starttime) is `start`; its neighbours (fields 21 and 23) differ from it. */
function statLine({ pid, comm = 'node', state = 'S', start }) {
  const after = [state, 1, pid, pid, 0, -1, 4194560, 1200, 0, 3, 0, 150, 30, 0, 0, 20, 0, 11, 0, start, 1234567168, 25000,
    '18446744073709551615', 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 17, 3, 0, 0, 0, 0, 0];
  return `${pid} (${comm}) ${after.join(' ')}\n`;
}
const procStat = (pid, o) => ({ [`/proc/${pid}/stat`]: statLine({ pid, ...o }) });
const FDINFO_HEAD = 'pos:\t0\nflags:\t02100001\nmnt_id:\t1461\nino:\t5634551\n';
function fdinfo(lockLines) {
  const text = FDINFO_HEAD + lockLines.map((l, i) => `lock:\t${i + 1}: ${l}\n`).join('');
  return { '/proc/self/fdinfo/9': text, [`/proc/${process.pid}/fdinfo/9`]: text };
}

/** An injected readFile: /proc paths from `proc` only (never the host's), anything else from disk (traced). */
function makeReadFile(proc = {}) {
  const calls = [];
  function readFile(p, ...rest) {
    const cb = rest.length && typeof rest[rest.length - 1] === 'function' ? rest.pop() : null;
    calls.push(typeof p === 'number' ? `fd:${p}` : String(p));
    const opt = rest[0];
    const enc = typeof opt === 'string' ? opt : (opt && typeof opt === 'object' && opt.encoding) || null;
    let out;
    let err = null;
    try {
      const key = String(p);
      if (Object.prototype.hasOwnProperty.call(proc, key)) out = enc ? proc[key] : Buffer.from(proc[key], 'utf8');
      else if (key.startsWith('/proc/')) {
        throw Object.assign(new Error(`ENOENT: no such file or directory, open '${key}'`), { code: 'ENOENT', errno: -2, syscall: 'open', path: key });
      } else out = fs.readFileSync(p, ...rest);
    } catch (e) { err = e; }
    if (cb) { process.nextTick(cb, err, out); return undefined; }
    if (err) throw err;
    return out;
  }
  readFile.calls = calls;
  return readFile;
}
/** processStartTime through the module itself, so a record carries the start time in the module's own form. */
async function startTimeOf(st, pid, proc) {
  need(st, 'processStartTime', STATE_LABEL);
  return quietAsync(() => st.processStartTime(pid, { readFile: makeReadFile(proc) }));
}

// ─── fake req / res, and the handlers' dependencies ───
function fakeReq({ method = 'POST', session, localTrusted, headers = {}, body, query = {}, url = '' } = {}) {
  const h = {};
  for (const [k, v] of Object.entries(headers)) if (v !== undefined) h[k.toLowerCase()] = v;
  const req = {
    method, url, originalUrl: url, path: url.split('?')[0], headers: h, body, query, session,
    hostname: String(h.host || '').split(':')[0], protocol: 'http', secure: false, ip: '203.0.113.9',
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
function confirmReq(body, o = {}) {
  const headers = { host: HOST, 'content-type': 'application/json', ...(o.headers || {}) };
  if (o.origin !== undefined) headers.origin = o.origin;
  if (o.contentType !== undefined) headers['content-type'] = o.contentType;
  return fakeReq({
    method: 'POST', url: PATHS.confirm, headers, body,
    session: 'session' in o ? o.session : ownerSession(), localTrusted: o.localTrusted,
  });
}
function getReq(url, query = {}) {
  const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => typeof v === 'string')).toString();
  return fakeReq({ method: 'GET', url: `${url}${qs ? `?${qs}` : ''}`, headers: { host: HOST }, query });
}
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
  if (!res.finished) throw new Error(`the handler never answered${thrown ? ` (it threw: ${firstLine(thrown.message)})` : ''}`);
  return res;
}
const FAKE_JOB_ID = 'reconcileTaggingEdges';
/** The handlers' dependencies: an owner, a queue that is up unless told otherwise, and a readFile spy. */
function routeDeps(o = {}) {
  const readFile = makeReadFile(o.proc || {});
  const enqueued = [];
  let pings = 0;
  const deps = {
    readFile,
    getOwnerPubkey: () => OWNER,
    getAdminPubkeys: () => [ADMIN],
    isAdminPubkey: (pk) => pk === ADMIN,
    isQueueAvailable: async () => { pings++; return o.queueUp !== false; },
    runViaQueueAsync: async (args) => {
      enqueued.push(args);
      return { success: true, taskName: args && args.taskName, executionMode: 'async', queued: true, jobId: FAKE_JOB_ID, status: 'queued' };
    },
  };
  return { deps, readFile, enqueued, pings: () => pings };
}
function showRes(res) { return `${res.statusCode} ${brief(res.body)}`; }
/** Call a handler with a fresh trace window: what it answered, what it touched, what it changed, what it enqueued. */
async function tryHandler(ctx, fn, req, bundle) {
  const before = snapshot(ctx.root);
  ctx.trace.reset();
  const res = await callHandler(fn, req, bundle.deps);
  const ops = ctx.trace.ops.slice();
  return { res, ops, changed: diffSnap(before, snapshot(ctx.root)), reads: bundle.readFile.calls.slice(), enqueued: bundle.enqueued.slice() };
}
/** Report and held files for a confirm / held request: by default the latest report holds 60 removals for RUN_HELD. */
async function seed(root, o = {}) {
  const st = loadState();
  need(st, 'writeHeld', STATE_LABEL);
  const list = o.list || heldList(60);
  const latest = o.latest !== undefined ? o.latest : heldLatest(RUN_HELD, list);
  if (o.report !== null) put(root, 'report.json', o.report || reportOf(latest, [doneLatest(RUN_OLD)]));
  const files = o.heldFiles || { [RUN_HELD]: list };
  for (const [runId, l] of Object.entries(files)) {
    try { await quietAsync(() => st.writeHeld(runId, l)); } catch (e) {
      throw new Error(`fixture setup: writeHeld(${runId}, list) failed: ${firstLine(e.message)}`);
    }
  }
  if (o.pending) put(root, 'confirmation.json', o.pending);
  return { st, list, latest };
}

// Run ids a route or readHeld must refuse (RUN_ID_RE fails, or not a string / an array).
const BAD_STRING_IDS = [
  ['empty', ''],
  ['a ../ traversal', '../x'],
  ['a traversal to report.json', '../report'],
  ['a traversal with / encoded as %2F', '..%2Fx'],
  ['a double traversal encoded as %2F', '..%2F..%2Fsecret'],
  ['a valid id followed by a traversal', `${RUN_HELD}/../../secret`],
  ['an absolute path', '/etc/passwd'],
  ['an absolute path ending in a valid id', `/held/${RUN_HELD}`],
  ['a valid id with an embedded NUL', `${RUN_HELD}\u0000`],
  ['a NUL then a traversal', `${RUN_HELD}\u0000../../secret`],
  ['a valid id with a trailing newline', `${RUN_HELD}\n`],
  ['a valid id with ".json"', `${RUN_HELD}.json`],
  ['upper-case hex', RUN_HELD.replace(/-([0-9a-f]{8})$/, (m, x) => `-${x.toUpperCase()}`)],
  ['a leading space', ` ${RUN_HELD}`],
];
const NOT_STRING_IDS = [
  ['an array holding a valid run id', [RUN_HELD]],
  ['an array of two run ids', [RUN_HELD, RUN_OLD]],
  ['an object', { id: RUN_HELD }],
];

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════
// ST — src/pipeline/tagging-edges/state.js
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('ST1: stateDir() is TAGGING_EDGES_STATE_DIR when that is set, and /var/lib/brainstorm/tagging-edges when it is not (ADR "The report")', async () => {
  await withState(async ({ root }) => {
    const st = loadState();
    need(st, 'stateDir', STATE_LABEL);
    eq(path.resolve(await st.stateDir()), path.resolve(root), 'stateDir() with TAGGING_EDGES_STATE_DIR set to a temp directory');
  });
  const saved = saveEnv();
  delete process.env.TAGGING_EDGES_STATE_DIR;
  try {
    const st = loadState();
    eq(await st.stateDir(), DEFAULT_STATE_DIR, 'stateDir() with TAGGING_EDGES_STATE_DIR unset (the tapestry-data volume)');
  } finally { restoreEnv(saved); forgetModules(); }
});

test('ST2: writeReport stores { reportVersion: 1, latest, previous } at <stateDir>/report.json — previous holding up to nine earlier runs — and readReport gives the same report back (ADR "The report")', async () => {
  await withState(async ({ root }) => {
    const st = loadState();
    need(st, 'writeReport', STATE_LABEL);
    need(st, 'readReport', STATE_LABEL);
    const report = reportOf(heldLatest(RUN_HELD, heldList(3)), nineEarlier());
    await st.writeReport(report);
    assert(exists(root, 'report.json'), `writeReport should write <stateDir>/report.json; the state directory holds: ${snapshot(root).join(', ') || '(nothing)'}`);
    same(readJson(root, 'report.json'), report, 'report.json on disk after writeReport(report)');
    same(await st.readReport(), report, 'readReport() after writeReport(report)');
  });
});

test('ST3: writeReport is atomic — a crash between the temp write and the rename leaves the old report.json byte for byte, writeReport fails, and readReport still gives the old report (ADR D9, "The report")', async () => {
  await withState(async ({ root, trace }) => {
    const st = loadState();
    need(st, 'writeReport', STATE_LABEL);
    need(st, 'readReport', STATE_LABEL);
    const OLD = reportOf(doneLatest(RUN_OLD));
    put(root, 'report.json', OLD);
    const before = readText(root, 'report.json');
    trace.reset();
    trace.failRenameTo = 'report.json';
    let err = null;
    try { await st.writeReport(reportOf(heldLatest(RUN_HELD, heldList(2)), [OLD.latest])); } catch (e) { err = e; }
    trace.failRenameTo = null;
    eq(readText(root, 'report.json'), before, 'report.json after a crash just before the rename (the old file, unchanged)');
    assert(trace.ops.some((o) => o.op === 'rename' && o.to === 'report.json'),
      `writeReport should replace report.json by a rename (temp, fsync, rename); calls seen: ${showOps(trace.ops)}`);
    assert(err, 'writeReport should fail when its rename fails — the runner then stops before any graph contact (ADR runner step 3)');
    same(await st.readReport(), OLD, 'readReport() after the crash');
  });
});

test('ST4: writeReport writes a temp file in the state directory, fsyncs it, renames it over report.json, then fsyncs the directory; report.json itself is never opened for writing (ADR Implementation notes: "tmp, fsync, rename, directory fsync")', async () => {
  await withState(async ({ root, trace }) => {
    const st = loadState();
    need(st, 'writeReport', STATE_LABEL);
    put(root, 'report.json', reportOf(doneLatest(RUN_OLD)));
    trace.reset();
    await st.writeReport(reportOf(heldLatest(RUN_HELD, heldList(2))));
    const ops = trace.ops.slice();
    const i = ops.findIndex((o) => o.op === 'rename' && o.to === 'report.json');
    assert(i >= 0, `report.json should be replaced by a rename; calls seen: ${showOps(ops)}`);
    const tmp = ops[i].rel;
    assert(tmp && tmp !== 'report.json', `the rename's source should be a temp file inside the state directory; got ${brief(tmp)}`);
    assert(ops.slice(0, i).some((o) => o.op === 'fsync' && o.rel === tmp), `the temp file ${tmp} should be fsynced before the rename; calls seen: ${showOps(ops)}`);
    assert(ops.slice(i + 1).some((o) => o.op === 'fsync' && o.rel === ''), `the state directory should be fsynced after the rename; calls seen: ${showOps(ops)}`);
    const inPlace = ops.filter((o) => o.rel === 'report.json' && ['write', 'append', 'open-write', 'fdwrite'].includes(o.op));
    assert(inPlace.length === 0, `report.json should never be opened or written in place; saw: ${showOps(inPlace)}`);
    assert(!exists(root, tmp), `the temp file ${tmp} should be gone after the rename`);
  });
});

test('ST5: a temp file a crashed write left behind disturbs nothing — readReport still gives the old report, and the next writeReport succeeds', async () => {
  await withState(async ({ root }) => {
    const st = loadState();
    need(st, 'writeReport', STATE_LABEL);
    need(st, 'readReport', STATE_LABEL);
    const OLD = reportOf(doneLatest(RUN_OLD));
    put(root, 'report.json', OLD);
    put(root, 'report.json.tmp', '{"reportVersion":1,"latest":{"runId":"2026');
    put(root, '.report.json.tmp', 'half-written');
    same(await st.readReport(), OLD, 'readReport() beside half-written temp files');
    const NEW = reportOf(heldLatest(RUN_HELD, heldList(2)), [OLD.latest]);
    await st.writeReport(NEW);
    same(await st.readReport(), NEW, 'readReport() after the next writeReport');
    same(readJson(root, 'report.json'), NEW, 'report.json after the next writeReport');
  });
});

test('ST6: writeHeld(runId, list) writes held/<runId>.json from a state directory holding nothing yet, and readHeld(runId) gives the list back (ADR "The removal rule and the limit")', async () => {
  await withState(async ({ root }) => {
    const st = loadState();
    need(st, 'writeHeld', STATE_LABEL);
    need(st, 'readHeld', STATE_LABEL);
    const list = heldList(3);
    await st.writeHeld(RUN_HELD, list);
    assert(exists(root, `held/${RUN_HELD}.json`), `writeHeld(runId, list) should write held/<runId>.json; the state directory holds: ${snapshot(root).join(', ') || '(nothing)'}`);
    same(await st.readHeld(RUN_HELD), list, 'readHeld(runId) after writeHeld(runId, list)');
  });
});

test('ST7: readHeld refuses — before reading anything — a run id that fails RUN_ID_RE, a ../ traversal (plain, %2F-encoded, after a valid id), an absolute path, an embedded NUL, and a non-string (ADR "Who reads it": path.resolve-based, inside held/)', async () => {
  await withState(async ({ root, trace }) => {
    const st = loadState();
    need(st, 'writeHeld', STATE_LABEL);
    need(st, 'readHeld', STATE_LABEL);
    const list = heldList(2);
    await quietAsync(() => st.writeHeld(RUN_HELD, list));
    put(root, 'secret.json', '["not a held list"]');
    put(root, 'report.json', reportOf(heldLatest(RUN_HELD, list)));
    same(await st.readHeld(RUN_HELD), list, 'readHeld of a valid run id (the control case)');
    const cases = [...BAD_STRING_IDS, ['a number', 20260927], ['null', null], ['undefined', undefined]];
    const wrong = [];
    for (const [label, v] of cases) {
      trace.reset();
      let out;
      let err = null;
      try { out = await st.readHeld(v); } catch (e) { err = e; }
      const reads = trace.ops.filter((o) => o.op === 'read' || o.op === 'open-read');
      if (!err) wrong.push(`${label} ${brief(v)}: returned ${brief(out, 80)}`);
      else if (reads.length) wrong.push(`${label} ${brief(v)}: refused, but only after reading ${showOps(reads)}`);
    }
    assert(wrong.length === 0, `readHeld should throw (or reject) before any read for:\n        ${wrong.join('\n        ')}`);
  });
});

test('ST8: heldDigest(list) is the lower-case hex sha256 of heldLines — one "address\\tseenEventId\\treason\\n" line per entry, sorted — so entry order does not matter and any changed field changes it (ADR Implementation notes, sweep.heldLines)', async () => {
  await withState(async () => {
    const st = loadState();
    need(st, 'heldDigest', STATE_LABEL);
    const list = heldList(4);
    const expected = digestOf(list);
    eq(await st.heldDigest(list), expected, 'heldDigest(list) — sha256 over the sorted address<TAB>seenEventId<TAB>reason<LF> lines');
    eq(await st.heldDigest([list[2], list[0], list[3], list[1]]), expected, 'heldDigest of the same entries in another order');
    const changed = list.map((h, i) => (i === 1 ? { ...h, reason: h.reason === 'non-tagging' ? 'not-on-relay' : 'non-tagging' } : h));
    assert(await st.heldDigest(changed) !== expected, 'heldDigest should change when one entry\'s reason changes');
    const otherId = list.map((h, i) => (i === 2 ? { ...h, seenEventId: FX.idOf('another-version') } : h));
    assert(await st.heldDigest(otherId) !== expected, 'heldDigest should change when one entry\'s seenEventId changes');
  });
});

function preimage(i) {
  const address = `39999:${FX.ALICE}:d-${i}`;
  return {
    runId: RUN_HELD, address, rid: `5:0f0e0d0c-0000-0000-0000-00000000000${i}:${i}`, fromPubkey: FX.ALICE, toPubkey: FX.BOB,
    props: [['address', 'STRING NOT NULL', address], ['note', 'LIST<STRING NOT NULL> NOT NULL', '["x","y"]'], ['weight', 'FLOAT NOT NULL', '1.5']],
  };
}

test('ST9: appendPreimages(runId, records) creates preimages/<runId>.jsonl with one JSON line per record, fsyncs the file, and — because it created the file — fsyncs the directory (ADR "The guard", step 1)', async () => {
  await withState(async ({ root, trace }) => {
    const st = loadState();
    need(st, 'appendPreimages', STATE_LABEL);
    const file = `preimages/${RUN_HELD}.jsonl`;
    const recs = [preimage(1), preimage(2)];
    trace.reset();
    await st.appendPreimages(RUN_HELD, recs);
    const ops = trace.ops.slice();
    assert(exists(root, file), `appendPreimages should create ${file}; the state directory holds: ${snapshot(root).join(', ') || '(nothing)'}`);
    const text = readText(root, file);
    assert(text.endsWith('\n'), `${file} should end each line with a newline; got ${brief(text.slice(-40))}`);
    same(text.split('\n').filter(Boolean).map((l) => JSON.parse(l)), recs, `${file}'s lines`);
    assert(ops.some((o) => o.op === 'fsync' && o.rel === file), `the pre-image file should be fsynced; calls seen: ${showOps(ops)}`);
    assert(ops.some((o) => o.op === 'fsync' && o.rel === 'preimages'), `the preimages/ directory should be fsynced when the file is created; calls seen: ${showOps(ops)}`);
  });
});

test('ST10: appendPreimages appends — a second call keeps the first call\'s lines byte for byte, adds its own after them, and fsyncs the file again', async () => {
  await withState(async ({ root, trace }) => {
    const st = loadState();
    need(st, 'appendPreimages', STATE_LABEL);
    const file = `preimages/${RUN_HELD}.jsonl`;
    await quietAsync(() => st.appendPreimages(RUN_HELD, [preimage(1), preimage(2)]));
    const first = readText(root, file);
    trace.reset();
    await st.appendPreimages(RUN_HELD, [preimage(3)]);
    const ops = trace.ops.slice();
    const text = readText(root, file);
    assert(text.startsWith(first), `the second call should keep the first call's lines as they were\n        first:  ${brief(first, 200)}\n        now:    ${brief(text, 200)}`);
    same(text.split('\n').filter(Boolean).map((l) => JSON.parse(l)), [preimage(1), preimage(2), preimage(3)], `${file}'s lines after two calls`);
    assert(ops.some((o) => o.op === 'fsync' && o.rel === file), `the second append should fsync the file; calls seen: ${showOps(ops)}`);
  });
});

test('ST11: writeConfirmation writes confirmation.json atomically (a temp file renamed over it, never written in place) and readPendingConfirmation reads it back; with none pending it reads nothing', async () => {
  await withState(async ({ root, trace }) => {
    const st = loadState();
    need(st, 'writeConfirmation', STATE_LABEL);
    need(st, 'readPendingConfirmation', STATE_LABEL);
    const none = await st.readPendingConfirmation();
    assert(none === null || none === undefined, `readPendingConfirmation() with nothing pending should give null; got ${brief(none)}`);
    const rec = confirmationRecord({ nonce: nonceOf('write-me') });
    trace.reset();
    await st.writeConfirmation(rec);
    const ops = trace.ops.slice();
    same(readJson(root, 'confirmation.json'), rec, 'confirmation.json after writeConfirmation(record)');
    same(await st.readPendingConfirmation(), rec, 'readPendingConfirmation()');
    const i = ops.findIndex((o) => o.op === 'rename' && o.to === 'confirmation.json');
    assert(i >= 0 && ops[i].rel && ops[i].rel !== 'confirmation.json', `confirmation.json should be written by renaming a temp file over it; calls seen: ${showOps(ops)}`);
    const inPlace = ops.filter((o) => o.rel === 'confirmation.json' && ['write', 'append', 'open-write', 'fdwrite'].includes(o.op));
    assert(inPlace.length === 0, `confirmation.json should never be written in place; saw: ${showOps(inPlace)}`);
  });
});

test('ST12: of two concurrent claimConfirmation calls exactly one wins — the record moves by rename to claimed/<winner runId>-<nonce>.json, confirmation.json is gone, and the loser gets no record (ADR "The owner\'s confirmation": claimed by an atomic rename)', async () => {
  await withState(async ({ root, trace }) => {
    const st = loadState();
    need(st, 'claimConfirmation', STATE_LABEL);
    const rec = confirmationRecord({ nonce: nonceOf('c0ffee') });
    put(root, 'confirmation.json', rec);
    trace.reset();
    const [a, b] = await Promise.all([
      Promise.resolve().then(() => st.claimConfirmation(CLAIM_A)),
      Promise.resolve().then(() => st.claimConfirmation(CLAIM_B)),
    ]);
    const ops = trace.ops.slice();
    const ra = claimedRecordOf(a);
    const rb = claimedRecordOf(b);
    eq([ra, rb].filter(Boolean).length, 1, `exactly one of two concurrent claims should get the record (results: ${brief(a)} / ${brief(b)})`);
    const winner = ra ? CLAIM_A : CLAIM_B;
    same(ra || rb, rec, 'the record the winning claim returns');
    same(listDir(root, 'claimed'), [`${winner}-${rec.nonce}.json`], 'claimed/ after the race');
    same(readJson(root, `claimed/${winner}-${rec.nonce}.json`), rec, 'the claimed file\'s content');
    assert(!exists(root, 'confirmation.json'), 'confirmation.json should be gone once claimed');
    assert(ops.some((o) => o.op === 'rename' && o.rel === 'confirmation.json'), `the claim should move confirmation.json by a rename; calls seen: ${showOps(ops)}`);
  });
});

test('ST13: a confirmation is single-use — with nothing pending claimConfirmation gives no record and throws nothing, and after one claim the next finds nothing', async () => {
  await withState(async ({ root }) => {
    const st = loadState();
    need(st, 'claimConfirmation', STATE_LABEL);
    const empty = await st.claimConfirmation(CLAIM_A);
    eq(claimedRecordOf(empty), null, `claimConfirmation with nothing pending should give no record (got ${brief(empty)})`);
    eq(listDir(root, 'claimed').length, 0, 'claimed/ should hold no file after a claim that found nothing');
    const rec = confirmationRecord({ nonce: nonceOf('single-use') });
    put(root, 'confirmation.json', rec);
    same(claimedRecordOf(await st.claimConfirmation(CLAIM_A)), rec, 'the first claim gets the record');
    eq(claimedRecordOf(await st.claimConfirmation(CLAIM_B)), null, 'a second claim of the same record should find nothing');
  });
});

test('ST14: withdrawConfirmation takes a pending record away so no pass can claim it and says it found one; with nothing pending it says so and throws nothing (ADR "The owner\'s confirmation": the withdraw race)', async () => {
  await withState(async ({ root }) => {
    const st = loadState();
    need(st, 'withdrawConfirmation', STATE_LABEL);
    need(st, 'claimConfirmation', STATE_LABEL);
    put(root, 'confirmation.json', confirmationRecord({ nonce: nonceOf('withdraw-me') }));
    const found = await st.withdrawConfirmation();
    assert(found, `withdrawConfirmation() with a record pending should say it withdrew one (a truthy result); got ${brief(found)}`);
    assert(!exists(root, 'confirmation.json'), 'confirmation.json should be gone after withdrawConfirmation()');
    eq(claimedRecordOf(await st.claimConfirmation(CLAIM_A)), null, 'a withdrawn record cannot be claimed');
    const again = await st.withdrawConfirmation();
    assert(!again, `withdrawConfirmation() with nothing pending should say it found nothing (a falsy result); got ${brief(again)}`);
  });
});

test('ST15: prune keeps the 5 newest held files plus any a pending or claimed record names, keeps the 20 newest claimed records, and never touches preimages/, report.json or confirmation.json (ADR Implementation notes: prune)', async () => {
  await withState(async ({ root }) => {
    const st = loadState();
    need(st, 'prune', STATE_LABEL);
    const HR = (i) => `202609${String(10 + i).padStart(2, '0')}T090000Z-${(0xa0000000 + i).toString(16)}`;
    const CR = (j) => `20260920T${String(j).padStart(2, '0')}0000Z-${(0xc0000000 + j).toString(16)}`;
    const base = Date.parse('2026-09-10T00:00:00Z') / 1000;
    quiet(() => {
      for (let i = 1; i <= 8; i++) {
        put(root, `held/${HR(i)}.json`, heldList(2));
        fs.utimesSync(path.join(root, `held/${HR(i)}.json`), base + i * 60, base + i * 60);
      }
      for (let j = 1; j <= 23; j++) {
        // Only the newest claimed record names a held run (HR(1)); the others name runs with no held file.
        const names = j === 23 ? HR(1) : `20250101T000000Z-${(0xe0000000 + j).toString(16)}`;
        const file = `claimed/${CR(j)}-${nonceOf(j)}.json`;
        put(root, file, confirmationRecord({ runId: names, nonce: nonceOf(j) }));
        fs.utimesSync(path.join(root, file), base + 10000 + j * 60, base + 10000 + j * 60);
      }
      for (let i = 1; i <= 3; i++) put(root, `preimages/${HR(i)}.jsonl`, `${JSON.stringify(preimage(i))}\n`);
    });
    put(root, 'confirmation.json', confirmationRecord({ runId: HR(2), nonce: nonceOf('pending') }));
    put(root, 'report.json', reportOf(doneLatest(HR(8))));
    const keep = (xs) => xs.filter((x) => x.startsWith('preimages/') || x.startsWith('report.json') || x.startsWith('confirmation.json'));
    const before = keep(snapshot(root));
    await st.prune();
    same(listDir(root, 'held'), [1, 2, 4, 5, 6, 7, 8].map((i) => `${HR(i)}.json`),
      'held/ after prune — the 5 newest (4–8), plus 2 (the pending record names it) and 1 (a claimed record names it); 3 removed');
    same(listDir(root, 'claimed'), Array.from({ length: 20 }, (_, k) => `${CR(k + 4)}-${nonceOf(k + 4)}.json`), 'claimed/ after prune — the 20 newest');
    same(keep(snapshot(root)), before, 'preimages/, report.json and confirmation.json after prune (untouched)');
  });
});

test('ST16: processStartTime reads field 22 of /proc/<pid>/stat, counted after the last ")" — for a plain name, a name with spaces and parentheses, and a name that imitates the fields after it (ADR "Stopped runs")', async () => {
  await withState(async () => {
    const st = loadState();
    need(st, 'processStartTime', STATE_LABEL);
    const cases = [
      ['a plain name', 'node'],
      ['a name with spaces and parentheses', 'tapestry (x) y'],
      ['a name that imitates the fields after it', `x) R ${'1 '.repeat(18)}555 (y`],
    ];
    for (const [label, comm] of cases) {
      const readFile = makeReadFile(procStat(LIVE_PID, { comm, start: 987654321 }));
      const got = await st.processStartTime(LIVE_PID, { readFile });
      eq(String(got), '987654321', `processStartTime for ${label} (${JSON.stringify(comm)})`);
      assert(readFile.calls.includes(`/proc/${LIVE_PID}/stat`), `processStartTime should read /proc/${LIVE_PID}/stat through the injected readFile; it read ${brief(readFile.calls)}`);
    }
  });
});

test('ST17: isAlive is true for the record\'s process while /proc/<pid>/stat shows the same start time and a state other than Z or X — R, S and D, and a name that contains ") Z " (ADR D9 (c), "Stopped runs")', async () => {
  await withState(async () => {
    const st = loadState();
    need(st, 'isAlive', STATE_LABEL);
    const startTime = await startTimeOf(st, LIVE_PID, procStat(LIVE_PID, { start: 987654321 }));
    const record = pessimistic(RUN_NEW, { pid: LIVE_PID, startTime });
    const cases = [
      ['state R', { state: 'R' }], ['state S', { state: 'S' }], ['state D', { state: 'D' }],
      ['a name containing ") Z " (the real state S)', { state: 'S', comm: 'a) Z (b' }],
    ];
    for (const [label, o] of cases) {
      const got = await st.isAlive(record, { readFile: makeReadFile(procStat(LIVE_PID, { start: 987654321, ...o })) });
      eq(got, true, `isAlive for ${label}, start time matching`);
    }
  });
});

test('ST18: isAlive is false for a zombie (Z) or dead (X) process, for a start time that no longer matches (the pid was reused), when /proc/<pid>/stat is gone, and for a record carrying no process', async () => {
  await withState(async () => {
    const st = loadState();
    need(st, 'isAlive', STATE_LABEL);
    const startTime = await startTimeOf(st, LIVE_PID, procStat(LIVE_PID, { start: 987654321 }));
    const record = pessimistic(RUN_NEW, { pid: LIVE_PID, startTime });
    const cases = [
      ['state Z (a zombie after kill -9)', record, procStat(LIVE_PID, { state: 'Z', start: 987654321 })],
      ['state X', record, procStat(LIVE_PID, { state: 'X', start: 987654321 })],
      ['another start time (pid reused)', record, procStat(LIVE_PID, { state: 'S', start: 987654322 })],
      ['no /proc/<pid>/stat', record, {}],
      ['a record with no process', { runId: RUN_OLD, outcome: 'done', running: false }, procStat(LIVE_PID, { start: 987654321 })],
    ];
    for (const [label, rec, proc] of cases) {
      const got = await st.isAlive(rec, { readFile: makeReadFile(proc) });
      eq(got, false, `isAlive for ${label}`);
    }
  });
});

test('ST19: lockHeld(fd) reads /proc/self/fdinfo/<fd> and is true only for a "FLOCK … WRITE" lock line — false with no lock, a shared (READ) flock, a POSIX write lock, or no fdinfo file (ADR runner step 1)', async () => {
  await withState(async () => {
    const st = loadState();
    need(st, 'lockHeld', STATE_LABEL);
    const W = 'FLOCK  ADVISORY  WRITE 4242 00:3e:5634551 0 EOF';
    const cases = [
      ['a FLOCK WRITE line', fdinfo([W]), true],
      ['a POSIX READ line, then a FLOCK WRITE line', fdinfo(['POSIX  ADVISORY  READ 4242 00:3e:5634551 0 EOF', W]), true],
      ['no lock line', fdinfo([]), false],
      ['a FLOCK READ (shared) line', fdinfo(['FLOCK  ADVISORY  READ 4242 00:3e:5634551 0 EOF']), false],
      ['a POSIX WRITE line', fdinfo(['POSIX  ADVISORY  WRITE 4242 00:3e:5634551 0 EOF']), false],
      ['no fdinfo file', {}, false],
    ];
    for (const [label, proc, want] of cases) {
      let got;
      try { got = await st.lockHeld(9, { readFile: makeReadFile(proc) }); } catch (e) { got = `threw: ${firstLine(e.message)}`; }
      eq(got, want, `lockHeld(9) with ${label}`);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════
// RT — src/api/tagging-edges/index.js and the task channels
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════

const NOW = Date.parse('2026-09-27T12:00:00Z');
const STATUS_KEYS = ['reportVersion', 'running', 'latest', 'previous', 'confirmationPending'];

test('RT1: computeStatus sets running from liveness alone — a live process reads running whatever the stored flag says (ADR "Stopped runs": never passes the stored value through)', () => {
  const routes = loadRoutes();
  need(routes, 'computeStatus', ROUTES_LABEL);
  const a = routes.computeStatus({ report: reportOf(pessimistic(RUN_NEW)), alive: true, confirmation: null, now: NOW });
  eq(a && a.running, true, 'running for a live pass (stored running: true)');
  eq(a.latest && a.latest.running, true, 'latest.running for a live pass');
  const b = routes.computeStatus({ report: reportOf(heldLatest(RUN_HELD, heldList(2), { running: false })), alive: true, confirmation: null, now: NOW });
  eq(b && b.running, true, 'running when alive is true and the stored flag is false');
  eq(b.latest && b.latest.running, true, 'latest.running when alive is true and the stored flag is false');
});

test('RT2: computeStatus — a stored running: true whose process is dead reads not running, and its stored text reads failed and stopped (ADR D9 (c): after a kill -9 or a restart the report already says so)', () => {
  const routes = loadRoutes();
  need(routes, 'computeStatus', ROUTES_LABEL);
  const stored = pessimistic(RUN_NEW);
  const out = routes.computeStatus({ report: reportOf(stored, [doneLatest(RUN_OLD)]), alive: false, confirmation: null, now: NOW });
  eq(out && out.running, false, 'running for a dead process whose record stores running: true');
  eq(out.latest && out.latest.running, false, 'latest.running for that record');
  eq(out.latest.outcome, 'failed', 'latest.outcome');
  eq(out.latest.stopped, true, 'latest.stopped');
  eq(out.latest.reasonCode, 'stopped', 'latest.reasonCode');
  eq(out.latest.reason, stored.reason, 'latest.reason (the stored text)');
});

test('RT3: computeStatus with no report yet reads not running, with no latest', () => {
  const routes = loadRoutes();
  need(routes, 'computeStatus', ROUTES_LABEL);
  const out = routes.computeStatus({ report: null, alive: false, confirmation: null, now: NOW });
  eq(out && out.running, false, 'running with no report');
  assert(out.latest === null || out.latest === undefined, `latest with no report should be null; got ${brief(out.latest)}`);
});

test('RT4: computeStatus shows a pending confirmation without its nonce — every other field kept as stored, keys derived from it allowed — none as null, and carries reportVersion 1 and previous as stored (ADR "Who reads it")', () => {
  const routes = loadRoutes();
  need(routes, 'computeStatus', ROUTES_LABEL);
  const rec = confirmationRecord({ nonce: nonceOf('rt4-secret'), mintedAt: '2026-09-27T11:00:00.000Z' });
  const previous = [doneLatest(RUN_OLD)];
  const out = routes.computeStatus({ report: reportOf(heldLatest(RUN_HELD, heldList(2)), previous), alive: false, confirmation: rec, now: NOW });
  const pending = out && out.confirmationPending;
  assert(pending && typeof pending === 'object', `confirmationPending should show the pending record; got ${brief(pending)}`);
  assert(!('nonce' in pending), `confirmationPending should not carry the nonce; got ${brief(pending)}`);
  const { nonce, ...rest } = rec;
  // "the pending record without its nonce": every other field, as stored. A key derived from the record (for
  // example whether it has expired at `now`) may be added — the report shape is additive (ADR Consequences).
  const lost = Object.keys(rest).filter((k) => JSON.stringify(pending[k]) !== JSON.stringify(rest[k]));
  assert(lost.length === 0, `confirmationPending should keep every field of the record but the nonce, as stored; these differ or are missing: ${lost.map((k) => `${k} (record ${brief(rest[k])}, shown ${brief(pending[k])})`).join(', ')}`);
  assert(!JSON.stringify(out).includes(nonce), 'the nonce should appear nowhere in the status');
  eq(out.reportVersion, 1, 'reportVersion');
  same(out.previous, previous, 'previous');
  const none = routes.computeStatus({ report: reportOf(heldLatest(RUN_HELD, heldList(2))), alive: false, confirmation: null, now: NOW });
  assert(none.confirmationPending === null || none.confirmationPending === undefined, `confirmationPending with none pending should be null; got ${brief(none.confirmationPending)}`);
});

test('RT5: GET status (handleStatus) is public — no session — and answers { reportVersion, running, latest, previous, confirmationPending }: a dead pass\'s stored running: true reads not running, a live one reads running, and neither the nonce nor the state directory\'s path appears (ADR "Who reads it")', async () => {
  await withState(async ({ root }) => {
    const st = loadState();
    const nonce = nonceOf('rt5-secret');
    put(root, 'report.json', reportOf(pessimistic(RUN_NEW), [heldLatest(RUN_HELD, heldList(2)), doneLatest(RUN_OLD)]));
    put(root, 'confirmation.json', confirmationRecord({ nonce, mintedAt: new Date(Date.now() - 3600e3).toISOString() }));
    const routes = loadRoutes();
    need(routes, 'handleStatus', ROUTES_LABEL);
    const res = await callHandler(routes.handleStatus, getReq(PATHS.status), routeDeps().deps);
    eq(res.statusCode, 200, `status code with no session (answer: ${showRes(res)})`);
    const body = res.body || {};
    for (const k of STATUS_KEYS) assert(k in body, `the answer should carry ${k}; got ${brief(body)}`);
    eq(body.running, false, 'running for a dead pass whose record stores running: true');
    eq(body.latest && body.latest.running, false, 'latest.running for that record');
    eq(body.latest.outcome, 'failed', 'latest.outcome');
    eq(body.latest.stopped, true, 'latest.stopped');
    assert(body.confirmationPending && body.confirmationPending.runId === RUN_HELD && !('nonce' in body.confirmationPending),
      `confirmationPending should show the pending record without its nonce; got ${brief(body.confirmationPending)}`);
    assert(!JSON.stringify(body).includes(nonce), 'the nonce should appear nowhere in the answer');
    assert(!leaksPath(body, root), 'the answer should carry no absolute path');
    const proc = procStat(LIVE_PID, { start: 555000 });
    put(root, 'report.json', reportOf(pessimistic(RUN_NEW, { pid: LIVE_PID, startTime: await startTimeOf(st, LIVE_PID, proc) })));
    const live = await callHandler(routes.handleStatus, getReq(PATHS.status), routeDeps({ proc }).deps);
    eq(live.body && live.body.running, true, `running for a live pass (its /proc stat served through the injected readFile; answer: ${showRes(live)})`);
  });
});

test('RT6: GET status with no report yet answers 200, not running, with no latest', async () => {
  await withState(async () => {
    const routes = loadRoutes();
    need(routes, 'handleStatus', ROUTES_LABEL);
    const res = await callHandler(routes.handleStatus, getReq(PATHS.status), routeDeps().deps);
    eq(res.statusCode, 200, `status code with no report.json (answer: ${showRes(res)})`);
    eq(res.body && res.body.running, false, 'running with no report');
    assert(res.body.latest === null || res.body.latest === undefined, `latest with no report should be null; got ${brief(res.body.latest)}`);
  });
});

test('RT7: GET status when report.json cannot be read answers without the state directory\'s absolute path — the error\'s code, never its message (ADR "Who reads it")', async () => {
  await withState(async ({ root }) => {
    unreadable(root, 'report.json');
    const routes = loadRoutes();
    need(routes, 'handleStatus', ROUTES_LABEL);
    const res = await callHandler(routes.handleStatus, getReq(PATHS.status), routeDeps().deps);
    assert(!leaksPath(res.body, root), `the answer should carry no absolute path; got ${showRes(res)}`);
  });
});

/** Run a confirm request against a fully valid fixture (so only what the case changes can refuse it). */
async function refusedConfirm(ctx, req, bundle) {
  await seed(ctx.root, { pending: OLD_PENDING });
  const routes = loadRoutes();
  need(routes, 'handleConfirmHeldRemovals', ROUTES_LABEL);
  return tryHandler(ctx, routes.handleConfirmHeldRemovals, req, bundle || routeDeps());
}
function refusalProblems(label, r, statuses) {
  const p = [];
  if (!statuses.includes(r.res.statusCode)) p.push(`${label}: answered ${showRes(r.res)}, expected ${statuses.join(' or ')}`);
  if (r.changed) p.push(`${label}: wrote to the state directory (${r.changed})`);
  if (r.enqueued.length) p.push(`${label}: enqueued ${brief(r.enqueued)}`);
  return p;
}

test('RT8: POST confirm-held-removals with no session answers 401 — a localTrusted (loopback) request included — and writes nothing, enqueues nothing (ADR "The owner\'s confirmation": the handler re-checks)', async () => {
  const cases = [
    ['no session', { session: undefined }],
    ['a localTrusted request with no session', { session: undefined, localTrusted: true }],
    ['a localTrusted request with an empty session', { session: {}, localTrusted: true }],
    ['a session that is not authenticated', { session: { authenticated: false } }],
  ];
  const problems = [];
  for (const [label, o] of cases) {
    await withState(async (ctx) => { problems.push(...refusalProblems(label, await refusedConfirm(ctx, confirmReq({ runId: RUN_HELD }, o)), [401])); });
  }
  assert(problems.length === 0, problems.join('\n        '));
});

test('RT9: POST confirm-held-removals from an admin\'s session answers 403 and writes nothing — owner only, admins included (ADR D8, owner decision 13)', async () => {
  const problems = [];
  await withState(async (ctx) => {
    const req = confirmReq({ runId: RUN_HELD }, { session: { authenticated: true, pubkey: ADMIN } });
    problems.push(...refusalProblems('an admin', await refusedConfirm(ctx, req), [403]));
  });
  assert(problems.length === 0, problems.join('\n        '));
});

test('RT9b: POST confirm-held-removals from an admin on the house admin list (settings.json adminPubkeys, which utils/config isAdminPubkey and middleware/auth isOwnerOrAdmin read) answers 403 and writes nothing — the handler must not reach for the house owner-or-admin helpers (ADR D8, owner decision 13)', async () => {
  const HOUSE = ['src/config/settings.js', 'src/utils/config.js', 'src/middleware/auth.js'].map((p) => path.join(REPO, p));
  const forgetHouse = () => { for (const p of HOUSE) delete require.cache[p]; };
  const saved = process.env.TAPESTRY_SETTINGS_PATH;
  let settings = null;
  const problems = [];
  try {
    await withState(async (ctx) => {
      // Outside the state directory, so it never reads as a state write.
      settings = path.join(path.dirname(ctx.root), `settings-${path.basename(ctx.root)}.json`);
      quiet(() => fs.writeFileSync(settings, JSON.stringify({ adminPubkeys: [ADMIN] })));
      process.env.TAPESTRY_SETTINGS_PATH = settings;
      forgetHouse();
      // Without this check the case could pass for the wrong reason: a settings file the house code never read.
      const houseSaysAdmin = quiet(() => require(HOUSE[1]).isAdminPubkey(ADMIN));
      assert(houseSaysAdmin === true, `fixture: the house admin list should name ADMIN (utils/config isAdminPubkey answered ${brief(houseSaysAdmin)})`);
      const req = confirmReq({ runId: RUN_HELD }, { session: { authenticated: true, pubkey: ADMIN } });
      problems.push(...refusalProblems('an admin on the house list', await refusedConfirm(ctx, req), [403]));
    });
  } finally {
    if (saved === undefined) delete process.env.TAPESTRY_SETTINGS_PATH; else process.env.TAPESTRY_SETTINGS_PATH = saved;
    forgetHouse();
    if (settings) quiet(() => fs.rmSync(settings, { force: true }));
  }
  assert(problems.length === 0, problems.join('\n        '));
});

test('RT10: POST confirm-held-removals from any session that is not the owner\'s is refused and writes nothing — a signed-in stranger (403), the owner\'s pubkey in upper case (403), the owner\'s pubkey on a session not marked authenticated (401 or 403)', async () => {
  const cases = [
    ['a signed-in stranger', { session: { authenticated: true, pubkey: STRANGER } }, [403]],
    ['a localTrusted request from a stranger\'s session', { session: { authenticated: true, pubkey: STRANGER }, localTrusted: true }, [403]],
    ['the owner\'s pubkey in upper case', { session: { authenticated: true, pubkey: OWNER.toUpperCase() } }, [403]],
    ['the owner\'s pubkey without authenticated === true', { session: { pubkey: OWNER } }, [401, 403]],
  ];
  const problems = [];
  for (const [label, o, statuses] of cases) {
    await withState(async (ctx) => { problems.push(...refusalProblems(label, await refusedConfirm(ctx, confirmReq({ runId: RUN_HELD }, o)), statuses)); });
  }
  assert(problems.length === 0, problems.join('\n        '));
});

test('RT11: POST confirm-held-removals from the owner with an Origin naming another host answers 403 and writes nothing (ADR: the sameHost rule of dlist-curation/update.js)', async () => {
  const cases = [
    ['Origin https://evil.example', 'https://evil.example'],
    ['Origin null (a sandboxed frame)', 'null'],
    ['Origin whose host only starts with ours', `https://${HOST}.evil.test`],
  ];
  const problems = [];
  for (const [label, origin] of cases) {
    await withState(async (ctx) => { problems.push(...refusalProblems(label, await refusedConfirm(ctx, confirmReq({ runId: RUN_HELD }, { origin })), [403])); });
  }
  assert(problems.length === 0, problems.join('\n        '));
});

test('RT12: POST confirm-held-removals from the owner with a body that is not application/json answers 415 and writes nothing (ADR: a cross-site form cannot send JSON)', async () => {
  const cases = [
    ['text/plain', 'text/plain'],
    ['application/x-www-form-urlencoded', 'application/x-www-form-urlencoded'],
    ['multipart/form-data', 'multipart/form-data; boundary=x'],
    ['no Content-Type', null],
  ];
  const problems = [];
  for (const [label, ct] of cases) {
    const headers = ct === null ? { 'content-type': undefined } : { 'content-type': ct };
    await withState(async (ctx) => { problems.push(...refusalProblems(label, await refusedConfirm(ctx, confirmReq({ runId: RUN_HELD }, { headers })), [415])); });
  }
  assert(problems.length === 0, problems.join('\n        '));
});

test('RT13: POST confirm-held-removals whose runId is missing, not a string, an array, or fails RUN_ID_RE (../ traversal, %2F-encoded, absolute path, embedded NUL, …) answers 400 before any filesystem call — the injected readFile is never called — and writes nothing', async () => {
  await withState(async (ctx) => {
    await seed(ctx.root, { pending: OLD_PENDING });
    const routes = loadRoutes();
    need(routes, 'handleConfirmHeldRemovals', ROUTES_LABEL);
    const cases = [
      ['no body', undefined], ['no runId', {}], ['runId null', { runId: null }], ['runId a number', { runId: 20260927 }],
      ['runId true', { runId: true }],
      ...NOT_STRING_IDS.map(([l, v]) => [`runId ${l}`, { runId: v }]),
      ...BAD_STRING_IDS.map(([l, v]) => [`runId ${l}`, { runId: v }]),
    ];
    const problems = [];
    for (const [label, body] of cases) {
      const bundle = routeDeps();
      const r = await tryHandler(ctx, routes.handleConfirmHeldRemovals, confirmReq(body), bundle);
      problems.push(...refusalProblems(`${label} ${brief(body)}`, r, [400]));
      if (r.reads.length) problems.push(`${label}: called readFile(${brief(r.reads)}) before refusing`);
      if (r.ops.length) problems.push(`${label}: touched the state directory before refusing (${showOps(r.ops)})`);
    }
    assert(problems.length === 0, problems.join('\n        '));
  });
});

test('RT14: POST confirm-held-removals with a well-formed runId that is not the latest report\'s answers 409, reads no held file (nothing but report.json is touched) and writes nothing', async () => {
  await withState(async (ctx) => {
    await seed(ctx.root, { pending: OLD_PENDING, heldFiles: { [RUN_HELD]: heldList(60), [RUN_OLD]: heldList(5) } });
    const routes = loadRoutes();
    need(routes, 'handleConfirmHeldRemovals', ROUTES_LABEL);
    const bundle = routeDeps();
    const r = await tryHandler(ctx, routes.handleConfirmHeldRemovals, confirmReq({ runId: RUN_OLD }), bundle);
    const problems = refusalProblems(`runId ${RUN_OLD} (an older run with a held file of its own)`, r, [409]);
    const otherReads = r.reads.filter((p) => relIn(ctx.root, p) !== 'report.json');
    if (otherReads.length) problems.push(`read ${brief(otherReads)} through readFile; only report.json may be read before the run id is checked`);
    const otherOps = r.ops.filter((o) => o.rel !== '' && o.rel !== 'report.json');
    if (otherOps.length) problems.push(`touched ${showOps(otherOps)}; only report.json may be touched before the run id is checked`);
    assert(problems.length === 0, problems.join('\n        '));
  });
});

test('RT15: POST confirm-held-removals answers 409 and writes nothing — an older pending record left as it was — when the latest report is done, holds nothing, is a running pass\'s record, has no held file, has a held file that no longer hashes to held.digest, or does not exist', async () => {
  const cases = [
    ['the latest report finished done, holding nothing', () => ({ latest: doneLatest(RUN_HELD) })],
    ['the latest report is done-removals-held with held.total 0', () => ({ list: [] })],
    ['a pass is running: its pessimistic record is latest', () => ({ latest: pessimistic(RUN_HELD) })],
    ['the held file for latest.runId is missing', () => ({ heldFiles: {} })],
    ['the held file no longer hashes to held.digest', () => ({ heldFiles: { [RUN_HELD]: heldList(60).slice(1) } })],
    ['there is no report.json', () => ({ report: null })],
  ];
  const problems = [];
  for (const [label, make] of cases) {
    await withState(async (ctx) => {
      await seed(ctx.root, { pending: OLD_PENDING, ...make() });
      const routes = loadRoutes();
      need(routes, 'handleConfirmHeldRemovals', ROUTES_LABEL);
      problems.push(...refusalProblems(label, await tryHandler(ctx, routes.handleConfirmHeldRemovals, confirmReq({ runId: RUN_HELD }), routeDeps()), [409]));
    });
  }
  assert(problems.length === 0, problems.join('\n        '));
});

test('RT16: POST confirm-held-removals answers 409 and writes nothing while the latest report\'s process is still alive (its /proc stat, served through the injected readFile, matches) — "it is not running"', async () => {
  await withState(async (ctx) => {
    const st = loadState();
    const proc = procStat(LIVE_PID, { start: 777000 });
    const list = heldList(60);
    const latest = heldLatest(RUN_HELD, list, { process: { pid: LIVE_PID, startTime: await startTimeOf(st, LIVE_PID, proc) } });
    await seed(ctx.root, { pending: OLD_PENDING, list, latest });
    const routes = loadRoutes();
    need(routes, 'handleConfirmHeldRemovals', ROUTES_LABEL);
    const problems = refusalProblems('a live process behind the latest report', await tryHandler(ctx, routes.handleConfirmHeldRemovals, confirmReq({ runId: RUN_HELD }), routeDeps({ proc })), [409]);
    assert(problems.length === 0, problems.join('\n        '));
  });
});

test('RT17: the owner\'s confirmation of the latest held report writes confirmation.json { version: 1, runId, heldDigest, heldCount, nonce (32 lower-case hex), mintedAt, expiresAt: mintedAt + 24 h, mintedBy: 8-character prefix } in place of an older pending one, enqueues reconcileTaggingEdges once with no queryParams, and answers { confirmed: true, enqueued: true, expiresAt } without the nonce', async () => {
  await withState(async (ctx) => {
    const { list, latest } = await seed(ctx.root, { pending: OLD_PENDING });
    const routes = loadRoutes();
    need(routes, 'handleConfirmHeldRemovals', ROUTES_LABEL);
    const bundle = routeDeps();
    const t0 = Date.now();
    const req = confirmReq({ runId: RUN_HELD }, { origin: `http://${HOST}:8080`, contentType: 'application/json; charset=utf-8' });
    const r = await tryHandler(ctx, routes.handleConfirmHeldRemovals, req, bundle);
    const t1 = Date.now();
    eq(r.res.statusCode, 200, `status code for the owner, same host (another port), JSON body (answer: ${showRes(r.res)})`);
    assert(exists(ctx.root, 'confirmation.json'), 'confirmation.json should hold the new record');
    const rec = readJson(ctx.root, 'confirmation.json');
    eq(rec.version, 1, 'record.version');
    eq(rec.runId, RUN_HELD, 'record.runId');
    eq(rec.heldDigest, latest.held.digest, 'record.heldDigest (the held report\'s digest)');
    eq(rec.heldCount, list.length, 'record.heldCount');
    assert(typeof rec.nonce === 'string' && NONCE_RE.test(rec.nonce) && rec.nonce !== OLD_PENDING.nonce,
      `record.nonce should be a new nonce of 32 lower-case hex characters (crypto.randomBytes(16)); got ${brief(rec.nonce)}`);
    eq(rec.mintedBy, OWNER.slice(0, 8), 'record.mintedBy (the owner\'s 8-character prefix)');
    const minted = timeOf(rec.mintedAt);
    assert(minted >= t0 - 5000 && minted <= t1 + 5000, `record.mintedAt should be the time of the request; got ${brief(rec.mintedAt)}`);
    eq(timeOf(rec.expiresAt) - minted, DAY_MS, 'record.expiresAt − record.mintedAt (24 h)');
    const body = r.res.body || {};
    eq(body.confirmed, true, 'answer.confirmed');
    eq(body.enqueued, true, 'answer.enqueued');
    eq(timeOf(body.expiresAt), timeOf(rec.expiresAt), 'answer.expiresAt (the record\'s)');
    if ('jobId' in body) eq(body.jobId, FAKE_JOB_ID, 'answer.jobId (from runViaQueueAsync)');
    assert(!JSON.stringify(body).includes(rec.nonce), `the answer should not carry the nonce; got ${brief(body)}`);
    eq(r.enqueued.length, 1, `runViaQueueAsync calls (got ${brief(r.enqueued)})`);
    const call = r.enqueued[0] || {};
    eq(call.taskName, TASK, 'runViaQueueAsync({ taskName })');
    eq(call.timeoutMs, TIMEOUT_MS, 'runViaQueueAsync({ timeoutMs }) — resolveTaskTimeout over the registry entry (30 min)');
    assert(call.queryParams === undefined, `runViaQueueAsync should get no queryParams; got ${brief(call.queryParams)}`);
    assert(bundle.pings() >= 1, 'isQueueAvailable() should be asked before enqueueing');
  });
});

test('RT18: with the task queue down the owner\'s confirmation still writes the record and answers { confirmed: true, enqueued: false } without enqueueing — the next pass within 24 h uses it (ADR "The owner\'s confirmation")', async () => {
  await withState(async (ctx) => {
    await seed(ctx.root);
    const routes = loadRoutes();
    need(routes, 'handleConfirmHeldRemovals', ROUTES_LABEL);
    const bundle = routeDeps({ queueUp: false });
    const r = await tryHandler(ctx, routes.handleConfirmHeldRemovals, confirmReq({ runId: RUN_HELD }), bundle);
    assert(r.res.statusCode >= 200 && r.res.statusCode < 300, `status code with the queue down (answer: ${showRes(r.res)})`);
    eq(r.res.body && r.res.body.confirmed, true, 'answer.confirmed');
    eq(r.res.body.enqueued, false, 'answer.enqueued');
    assert(exists(ctx.root, 'confirmation.json') && readJson(ctx.root, 'confirmation.json').runId === RUN_HELD, 'the record should stay in confirmation.json');
    eq(r.enqueued.length, 0, 'runViaQueueAsync calls with the queue down');
  });
});

/** Make a pass start (and optionally claim) the moment the confirm route has written confirmation.json. */
async function arrangeRace(ctx, { claim }) {
  const st = loadState();
  const proc = procStat(NEW_PID, { start: 888000 });
  const startTime = await startTimeOf(st, NEW_PID, proc);
  const { latest } = await seed(ctx.root);
  ctx.trace.onCreate = {
    rel: 'confirmation.json',
    fired: false,
    fn: () => {
      put(ctx.root, 'report.json', reportOf(pessimistic(RUN_NEW, { pid: NEW_PID, startTime }), [latest]));
      if (claim) {
        const rec = readJson(ctx.root, 'confirmation.json');
        fs.mkdirSync(path.join(ctx.root, 'claimed'), { recursive: true });
        fs.renameSync(path.join(ctx.root, 'confirmation.json'), path.join(ctx.root, 'claimed', `${RUN_NEW}-${rec.nonce}.json`));
      }
    },
  };
  return { proc };
}

test('RT19: the withdraw race — when a pass starts right after the record is written and has not claimed it, the route withdraws the record and answers 409 without enqueueing, so that pass runs unconfirmed (ADR "The owner\'s confirmation": fail-safe)', async () => {
  await withState(async (ctx) => {
    const { proc } = await arrangeRace(ctx, { claim: false });
    const routes = loadRoutes();
    need(routes, 'handleConfirmHeldRemovals', ROUTES_LABEL);
    const r = await tryHandler(ctx, routes.handleConfirmHeldRemovals, confirmReq({ runId: RUN_HELD }), routeDeps({ proc }));
    assert(ctx.trace.onCreate.fired, `the race never started: the handler did not write confirmation.json by a rename or writeFile (answer: ${showRes(r.res)}; calls: ${showOps(r.ops)})`);
    eq(r.res.statusCode, 409, `status code when a pass started before its claim (answer: ${showRes(r.res)})`);
    assert(!exists(ctx.root, 'confirmation.json'), 'the record should be withdrawn (confirmation.json gone)');
    eq(listDir(ctx.root, 'claimed').length, 0, 'nothing should be in claimed/: the starting pass never claimed it');
    eq(r.enqueued.length, 0, 'runViaQueueAsync calls after a withdrawal');
  });
});

test('RT20: the withdraw race — when the pass that started has already claimed the record, the withdrawal finds nothing and the route answers 200 with claimedBy: that pass\'s runId (ADR "The owner\'s confirmation")', async () => {
  await withState(async (ctx) => {
    const { proc } = await arrangeRace(ctx, { claim: true });
    const routes = loadRoutes();
    need(routes, 'handleConfirmHeldRemovals', ROUTES_LABEL);
    const r = await tryHandler(ctx, routes.handleConfirmHeldRemovals, confirmReq({ runId: RUN_HELD }), routeDeps({ proc }));
    assert(ctx.trace.onCreate.fired, `the race never started: the handler did not write confirmation.json by a rename or writeFile (answer: ${showRes(r.res)}; calls: ${showOps(r.ops)})`);
    eq(r.res.statusCode, 200, `status code when the starting pass already claimed the record (answer: ${showRes(r.res)})`);
    eq(r.res.body && r.res.body.claimedBy, RUN_NEW, 'answer.claimedBy (the runId of the pass that claimed it)');
    eq(listDir(ctx.root, 'claimed').filter((f) => f.startsWith(`${RUN_NEW}-`)).length, 1, 'the claimed record should stay in claimed/');
  });
});

/** The page of held entries in a held-route answer: the one array of {address, …} it carries. */
function pageItems(body) {
  if (Array.isArray(body)) return body;
  const arrays = body && typeof body === 'object'
    ? Object.values(body).filter((v) => Array.isArray(v) && v.every((x) => x && typeof x === 'object' && 'address' in x))
    : [];
  if (arrays.length !== 1) throw new Error(`could not find the page of held entries (one array of { address, seenEventId, reason }) in the answer: ${brief(body)}`);
  return arrays[0].map((h) => ({ address: h.address, seenEventId: h.seenEventId, reason: h.reason }));
}

test('RT21: GET held (handleHeld) is public and pages the latest report\'s held list — offset/limit slices, 1,000 at most per page (limit 1000 allowed, a larger limit refused or capped) (ADR "Who reads it")', async () => {
  await withState(async (ctx) => {
    const list = heldList(1500);
    await seed(ctx.root, { list });
    const routes = loadRoutes();
    need(routes, 'handleHeld', ROUTES_LABEL);
    const ask = (query) => callHandler(routes.handleHeld, getReq(PATHS.held, query), routeDeps().deps);
    let res = await ask({ offset: '10', limit: '5' });
    eq(res.statusCode, 200, `status code with no session (answer: ${showRes(res)})`);
    same(pageItems(res.body), list.slice(10, 15), 'offset=10&limit=5');
    res = await ask({ limit: '1000' });
    same(pageItems(res.body), list.slice(0, 1000), 'limit=1000');
    res = await ask({ offset: '1000', limit: '1000' });
    same(pageItems(res.body), list.slice(1000), 'offset=1000&limit=1000');
    res = await ask({});
    const first = pageItems(res.body);
    assert(first.length >= 1 && first.length <= 1000, `with no limit, a page of 1 to 1000 entries; got ${first.length}`);
    same(first, list.slice(0, first.length), 'with no offset, the page starts at the first entry');
    res = await ask({ limit: '5000' });
    assert(res.statusCode === 400 || (res.statusCode === 200 && pageItems(res.body).length <= 1000),
      `limit=5000 should be refused (400) or capped at 1000; got ${res.statusCode} with ${res.statusCode === 200 ? pageItems(res.body).length : '-'} entries`);
  });
});

test('RT22: GET held with runId equal to the latest report\'s serves that list', async () => {
  await withState(async (ctx) => {
    const list = heldList(12);
    await seed(ctx.root, { list });
    const routes = loadRoutes();
    need(routes, 'handleHeld', ROUTES_LABEL);
    const res = await callHandler(routes.handleHeld, getReq(PATHS.held, { runId: RUN_HELD, offset: '0', limit: '3' }), routeDeps().deps);
    eq(res.statusCode, 200, `status code (answer: ${showRes(res)})`);
    same(pageItems(res.body), list.slice(0, 3), `runId=${RUN_HELD}&offset=0&limit=3`);
  });
});

test('RT23: GET held with a runId that is not a string (repeated, or an object) or fails RUN_ID_RE (../ traversal, %2F-encoded, absolute path, embedded NUL, …) answers 400 before any filesystem call — the injected readFile is never called', async () => {
  await withState(async (ctx) => {
    await seed(ctx.root);
    const routes = loadRoutes();
    need(routes, 'handleHeld', ROUTES_LABEL);
    const cases = [...NOT_STRING_IDS, ...BAD_STRING_IDS.filter(([l]) => l !== 'empty')];
    const problems = [];
    for (const [label, runId] of cases) {
      const bundle = routeDeps();
      const r = await tryHandler(ctx, routes.handleHeld, getReq(PATHS.held, { runId }), bundle);
      if (r.res.statusCode !== 400) problems.push(`runId ${label} ${brief(runId)}: answered ${showRes(r.res)}, expected 400`);
      if (r.reads.length) problems.push(`runId ${label}: called readFile(${brief(r.reads)}) before refusing`);
      if (r.ops.length) problems.push(`runId ${label}: touched the state directory before refusing (${showOps(r.ops)})`);
    }
    assert(problems.length === 0, problems.join('\n        '));
  });
});

test('RT24: GET held with a well-formed runId that is not the latest report\'s answers 404 without reading any held file — its own held file included', async () => {
  await withState(async (ctx) => {
    await seed(ctx.root, { heldFiles: { [RUN_HELD]: heldList(60), [RUN_OLD]: heldList(5) } });
    const routes = loadRoutes();
    need(routes, 'handleHeld', ROUTES_LABEL);
    const r = await tryHandler(ctx, routes.handleHeld, getReq(PATHS.held, { runId: RUN_OLD }), routeDeps());
    const problems = [];
    if (r.res.statusCode !== 404) problems.push(`answered ${showRes(r.res)}, expected 404`);
    const heldReads = r.reads.filter((p) => String(relIn(ctx.root, p) || '').startsWith('held'));
    if (heldReads.length) problems.push(`read ${brief(heldReads)} through readFile`);
    const heldOps = r.ops.filter((o) => String(o.rel || '').startsWith('held'));
    if (heldOps.length) problems.push(`touched ${showOps(heldOps)}`);
    assert(problems.length === 0, problems.join('\n        '));
  });
});

test('RT25: GET held serves only the latest report\'s list — when the latest run held nothing, an older run\'s held file is neither served nor read', async () => {
  await withState(async (ctx) => {
    const older = heldList(5);
    await seed(ctx.root, { latest: doneLatest(RUN_DONE), heldFiles: { [RUN_OLD]: older } });
    put(ctx.root, 'report.json', reportOf(doneLatest(RUN_DONE), [heldLatest(RUN_OLD, older)]));
    const routes = loadRoutes();
    need(routes, 'handleHeld', ROUTES_LABEL);
    const r = await tryHandler(ctx, routes.handleHeld, getReq(PATHS.held, {}), routeDeps());
    const served = r.res.statusCode === 200 ? (() => { try { return pageItems(r.res.body); } catch (_) { return []; } })() : [];
    assert(served.length === 0, `no held entries should be served when the latest run held nothing; got ${showRes(r.res)}`);
    const oldTouched = r.ops.filter((o) => o.rel === `held/${RUN_OLD}.json`).concat(r.reads.filter((p) => relIn(ctx.root, p) === `held/${RUN_OLD}.json`));
    assert(oldTouched.length === 0, `the older run's held file should not be read; saw ${brief(oldTouched)}`);
  });
});

test('RT26: GET held when the held file cannot be read answers without the state directory\'s absolute path (ADR "Who reads it")', async () => {
  await withState(async (ctx) => {
    await seed(ctx.root, { heldFiles: {} });
    unreadable(ctx.root, `held/${RUN_HELD}.json`);
    const routes = loadRoutes();
    need(routes, 'handleHeld', ROUTES_LABEL);
    const res = await callHandler(routes.handleHeld, getReq(PATHS.held, {}), routeDeps().deps);
    assert(!leaksPath(res.body, ctx.root), `the answer should carry no absolute path; got ${showRes(res)}`);
  });
});

function registryEntry() {
  const registry = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));
  const entry = registry.tasks && registry.tasks[TASK];
  assert(entry, `src/manage/taskQueue/taskRegistry.json has no ${TASK} entry yet (ADR 0002 Implementation notes → Changed files)`);
  return entry;
}

test('RT27: no task argument reaches the pass — buildChildArgs(the reconcileTaggingEdges entry, customer args, { confirm: "1", limit: "0", warmStart: "true" }) is [] (ADR "The owner\'s confirmation": arguments false, staticArgs "")', () => {
  const entry = registryEntry();
  const { buildChildArgs } = require(PROCESSOR_MOD);
  same(buildChildArgs(entry, { pubkey: FX.ALICE, customerId: '7', customerName: 'someone' }, { confirm: '1', limit: '0', warmStart: 'true' }), [],
    'buildChildArgs with confirm, limit and warmStart query params and customer args');
  same(buildChildArgs(entry, null, { confirm: '1', limit: '0' }), [], 'buildChildArgs with { confirm: "1", limit: "0" }');
});

test('RT28: a schedule entry\'s confirm-shaped args are dropped — buildQueryParamsFromArgs({ confirm: true }) is {} (ADR D8 B: a confirmation never rides a schedule)', () => {
  const { buildQueryParamsFromArgs } = require(RESOLVER_MOD);
  same(buildQueryParamsFromArgs({ confirm: true }), {}, 'buildQueryParamsFromArgs({ confirm: true })');
  same(buildQueryParamsFromArgs({ confirm: '1', runId: RUN_HELD, nonce: 'n', confirmedRunId: RUN_HELD }), {}, 'buildQueryParamsFromArgs with every confirm-shaped key');
});

test('RT29: nothing a schedule entry carries reaches the pass\'s argv — its args through buildQueryParamsFromArgs, then buildChildArgs with the reconcileTaggingEdges entry, give []', () => {
  const entry = registryEntry();
  const { buildQueryParamsFromArgs } = require(RESOLVER_MOD);
  const { buildChildArgs } = require(PROCESSOR_MOD);
  const qp = buildQueryParamsFromArgs({ confirm: true, limit: 0, warmStart: true, runId: RUN_HELD });
  same(buildChildArgs(entry, null, qp), [], `buildChildArgs(entry, null, ${brief(qp)})`);
});

// ─── runner ───
async function run() {
  console.log('\n--- tagging-edges state files and routes (epic tagging-edges, Story 2) ---');
  let pass = 0, fail = 0;
  const skipped = 0;
  const failures = [];
  SUITE_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'tagging-edges-state-routes-'));
  const savedEnv = saveEnv();
  try {
    await installTracer(SUITE_ROOT);
    for (const [name, fn] of tests) {
      try { await fn(); console.log(`  PASS  ${name}`); pass++; } catch (err) {
        console.log(`  FAIL  ${name}\n        ${err.message}`);
        failures.push({ name, message: err.message });
        fail++;
      } finally {
        TRACE = null;
        QUIET = 0;
        forgetModules();
        restoreEnv(savedEnv);
      }
    }
  } finally {
    uninstallTracer();
    forgetModules();
    restoreEnv(savedEnv);
    try { fs.rmSync(SUITE_ROOT, { recursive: true, force: true }); } catch (_) { /* best effort */ }
  }
  console.log(`\ntagging-edges-state-routes: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped, failures };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
