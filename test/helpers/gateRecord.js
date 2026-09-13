'use strict';
/**
 * The gate's run record — honest-test-gate #1, ADR honest-test-gate/0001 §2.
 *
 * Every gate run writes one JSON record: created before its first suite runs,
 * rewritten after every suite, and finished with the same verdict and exit code the
 * runner exits with. The record is the gate's answer however the run was launched or
 * ended; a background-completion notice, a piped `$?`, or the tail of captured output
 * are not (engineering-team/README.md — "Running and reading the test gate").
 *
 * Location: tmp/gate-runs/<runId>.json (gitignored through tmp/); GATE_RECORD_DIR
 * overrides it. Writes are atomic (write <file>.tmp, then rename), so a killed run
 * never leaves half a record. Shared by the engine (gateRunner.js) and the reader
 * (test/gate-status.js).
 *
 * Schema v1:
 *   { schema, runId, label, state: running|finished|interrupted,
 *     verdict: PASS|FAIL|INTERRUPTED|null, exitCode, signal,
 *     startedAt, updatedAt, finishedAt, pid, host, node, cwd, argv,
 *     git: { commit, branch, dirty, dirtyCount } | { error },
 *     progress: { total, completed, current },
 *     totals: { passed, failed, skipped, suitesPassed, suitesFailed, suitesSkipped } | null,
 *     suites: [{ file, verdict, pass, fail, skipped, ms, error, failures }],
 *     strayErrors: [{ during, message }] }
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const crypto = require('crypto');

const REPO = path.resolve(__dirname, '..', '..');
const DEFAULT_DIR = path.join(REPO, 'tmp', 'gate-runs');
const KEEP = 30; // newest records kept; a live run's record is never pruned
const MAX_FAILURES = 20;
const MAX_MESSAGE = 500;

function recordDir(explicit) {
  return explicit || process.env.GATE_RECORD_DIR || DEFAULT_DIR;
}

function newRunId(now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  return `${stamp}-${process.pid}-${crypto.randomBytes(2).toString('hex')}`;
}

/** Which commit the run is testing, and whether the tree had uncommitted changes. */
function gitIdentity() {
  try {
    const git = (args) => cp.execFileSync('git', args, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const porcelain = git(['status', '--porcelain']);
    const dirtyCount = porcelain ? porcelain.split('\n').length : 0;
    return { commit: git(['rev-parse', 'HEAD']), branch: git(['rev-parse', '--abbrev-ref', 'HEAD']), dirty: dirtyCount > 0, dirtyCount };
  } catch (e) {
    return { error: String((e && e.message) || e).split('\n')[0] };
  }
}

function writeAtomic(file, obj) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(obj, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

function isAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

function readRecord(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

/** Every readable record in dir, newest first: [{ path, rec }]. */
function listRecords(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ path: path.join(dir, f), rec: readRecord(path.join(dir, f)) }))
    .filter((x) => x.rec)
    .sort((a, b) => String(b.rec.startedAt).localeCompare(String(a.rec.startedAt)));
}

function prune(dir) {
  for (const x of listRecords(dir).slice(KEEP)) {
    if (x.rec.state === 'running' && isAlive(x.rec.pid)) continue;
    try { fs.unlinkSync(x.path); } catch { /* already gone */ }
  }
}

function clip(v) {
  const s = String(v);
  return s.length > MAX_MESSAGE ? `${s.slice(0, MAX_MESSAGE)}…` : s;
}
function clipFailures(failures) {
  if (!Array.isArray(failures)) return [];
  return failures.slice(0, MAX_FAILURES).map((f) => (f && typeof f === 'object'
    ? { name: f.name === undefined ? null : clip(f.name), message: f.message === undefined ? null : clip(f.message) }
    : clip(f)));
}

/** Create the record for a new run; returns the handle { file, rec }. */
function createRecord({ dir, label, total }) {
  fs.mkdirSync(dir, { recursive: true });
  prune(dir);
  const runId = newRunId();
  const now = new Date().toISOString();
  const handle = {
    file: path.join(dir, `${runId}.json`),
    rec: {
      schema: 1,
      runId,
      label: label || null,
      state: 'running',
      verdict: null,
      exitCode: null,
      signal: null,
      startedAt: now,
      updatedAt: now,
      finishedAt: null,
      pid: process.pid,
      host: os.hostname(),
      node: process.version,
      cwd: process.cwd(),
      argv: process.argv.slice(),
      git: gitIdentity(),
      progress: { total, completed: 0, current: null },
      totals: null,
      suites: [],
      strayErrors: [],
    },
  };
  writeAtomic(handle.file, handle.rec);
  return handle;
}

/** Merge a patch into the record and rewrite it. */
function updateRecord(h, patch) {
  Object.assign(h.rec, patch, { updatedAt: new Date().toISOString() });
  writeAtomic(h.file, h.rec);
}

function finishRecord(h, { verdict, exitCode, totals }) {
  updateRecord(h, { state: 'finished', verdict, exitCode, totals, finishedAt: new Date().toISOString() });
}

function interruptRecord(h, { signal, exitCode }) {
  updateRecord(h, { state: 'interrupted', verdict: 'INTERRUPTED', signal, exitCode, finishedAt: new Date().toISOString() });
}

module.exports = {
  REPO,
  DEFAULT_DIR,
  recordDir,
  createRecord,
  updateRecord,
  finishRecord,
  interruptRecord,
  listRecords,
  readRecord,
  isAlive,
  clip,
  clipFailures,
};
