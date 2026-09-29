/**
 * The gap-filling pass's durable state (tagging-edges story 2, ADR tagging-edges/0002 D8/D9).
 *
 * Everything lives under one directory on the `tapestry-data` volume, so it survives restarts and
 * container re-creation (TAGGING_EDGES_STATE_DIR overrides it for tests):
 *
 *   report.json              { reportVersion: 1, latest, previous: [≤ 9] } — written atomically
 *   held/<runId>.json        a held report's held list { runId, held: [{ address, seenEventId, reason }] }
 *   confirmation.json        the owner's single-use confirmation, at most one pending
 *   claimed/<runId>-<nonce>.json   a confirmation a pass claimed (by atomic rename)
 *   preimages/<runId>.jsonl  pre-images of edges carrying keys outside the nine; never pruned here
 *   pass.lock                the wrapper's flock file
 *
 * Every write goes to a temp file, is fsynced, renamed over the target, and the directory fsynced.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { RUN_ID_RE, heldLines } = require('../../lib/tagging-edges/sweep');

const DEFAULT_STATE_DIR = '/var/lib/brainstorm/tagging-edges';
const REPORT_VERSION = 1;
const PREVIOUS_CAP = 9;
const KEEP_HELD = 5;
const KEEP_CLAIMED = 20;

function stateDir() {
  return process.env.TAGGING_EDGES_STATE_DIR || DEFAULT_STATE_DIR;
}

/** Make `dir` if it is missing, and fsync its parent so the new entry survives a power loss. */
function ensureDir(dir) {
  if (fs.existsSync(dir)) return;
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fsyncDir(path.dirname(dir));
}

function fsyncDir(dir) {
  let fd = null;
  try {
    fd = fs.openSync(dir, 'r');
    fs.fsyncSync(fd);
  } catch (_) {
    // Some filesystems refuse a directory fsync; the rename itself is still atomic.
  } finally {
    if (fd !== null) { try { fs.closeSync(fd); } catch (_) { /* closed */ } }
  }
}

/** Write `text` to `file` atomically: temp file, fsync, rename, directory fsync. */
function writeAtomic(file, text) {
  const dir = path.dirname(file);
  ensureDir(dir);
  const tmp = `${file}.tmp-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
  let fd = null;
  try {
    fd = fs.openSync(tmp, 'w', 0o600);
    fs.writeFileSync(fd, text); // loops until every byte is written; throws on ENOSPC / EFBIG
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = null;
    fs.renameSync(tmp, file);
  } catch (err) {
    if (fd !== null) { try { fs.closeSync(fd); } catch (_) { /* closed */ } }
    try { fs.unlinkSync(tmp); } catch (_) { /* never created */ }
    throw err;
  }
  fsyncDir(dir);
}

const isThenable = (v) => !!v && typeof v.then === 'function';
/** Apply `f` to a value or to what a promise resolves to — the readers are sync unless an injected readFile is async. */
const after = (v, f) => (isThenable(v) ? v.then(f) : f(v));
const toText = (out) => (Buffer.isBuffer(out) ? out.toString('utf8') : String(out));

/**
 * Parsed JSON from `file`, or null when it does not exist. Synchronous with the default reader; returns a
 * promise when the injected `readFile` does.
 */
function readJson(file, readFile) {
  const rf = readFile || ((p, enc) => fs.readFileSync(p, enc));
  const absent = (err) => { if (err && err.code === 'ENOENT') return null; throw err; };
  let out;
  try {
    out = rf(file, 'utf8');
  } catch (err) {
    return absent(err);
  }
  if (isThenable(out)) return out.then((t) => JSON.parse(toText(t)), absent);
  return JSON.parse(toText(out));
}

function reportPath() { return path.join(stateDir(), 'report.json'); }
function confirmationPath() { return path.join(stateDir(), 'confirmation.json'); }

/** report.json, or null when there is none. */
function readReport({ readFile } = {}) {
  return readJson(reportPath(), readFile);
}

function writeReport(report) {
  const out = { reportVersion: REPORT_VERSION, latest: null, previous: [], ...report };
  out.previous = Array.isArray(out.previous) ? out.previous.slice(0, PREVIOUS_CAP) : [];
  writeAtomic(reportPath(), `${JSON.stringify(out, null, 2)}\n`);
  return out;
}

/**
 * The held file's path for a run id. Rejects a run id outside RUN_ID_RE, and asserts the resolved path
 * stays inside held/ — no request input ever builds a path by itself.
 */
function heldPath(runId) {
  if (typeof runId !== 'string' || !RUN_ID_RE.test(runId)) {
    const err = new Error('not a run id');
    err.code = 'EBADRUNID';
    throw err;
  }
  const root = path.resolve(stateDir(), 'held') + path.sep;
  const file = path.resolve(root, `${runId}.json`);
  if (!file.startsWith(root)) {
    const err = new Error('held path escapes held/');
    err.code = 'EBADRUNID';
    throw err;
  }
  return file;
}

/** sha256 over the held list's canonical text. */
function heldDigest(held) {
  return crypto.createHash('sha256').update(heldLines(held), 'utf8').digest('hex');
}

function writeHeld(runId, held) {
  const file = heldPath(runId);
  const list = (Array.isArray(held) ? held : []).map((h) => ({ address: h.address, seenEventId: h.seenEventId == null ? null : h.seenEventId, reason: h.reason }));
  writeAtomic(file, `${JSON.stringify({ runId, held: list })}\n`);
  return heldDigest(list);
}

/**
 * The held list written for `runId`, or null when the file is absent. Rejects a bad run id before any read.
 * Synchronous with the default reader; a promise when the injected `readFile` is async.
 */
function readHeld(runId, { readFile } = {}) {
  const file = heldPath(runId);
  return after(readJson(file, readFile), (parsed) => {
    if (parsed === null) return null;
    if (!parsed || !Array.isArray(parsed.held)) {
      const err = new Error('held file is not a held list');
      err.code = 'EBADHELD';
      throw err;
    }
    return parsed.held;
  });
}

/**
 * Append pre-image records, one JSON line each, and fsync the file (and the directory when this
 * append created the file). → the relative file name, or null when there was nothing to write.
 */
function appendPreimages(runId, records) {
  const list = Array.isArray(records) ? records : [];
  if (list.length === 0) return null;
  if (typeof runId !== 'string' || !RUN_ID_RE.test(runId)) throw Object.assign(new Error('not a run id'), { code: 'EBADRUNID' });
  const dir = path.join(stateDir(), 'preimages');
  ensureDir(dir);
  const file = path.join(dir, `${runId}.jsonl`);
  const existed = fs.existsSync(file);
  const fd = fs.openSync(file, 'a', 0o600);
  const sizeBefore = fs.fstatSync(fd).size;
  try {
    fs.writeFileSync(fd, list.map((r) => `${JSON.stringify(r)}\n`).join('')); // every byte, or a throw
    fs.fsyncSync(fd);
  } catch (err) {
    // Cut a torn tail back off, so the next append does not stick onto a partial line.
    try { fs.ftruncateSync(fd, sizeBefore); fs.fsyncSync(fd); } catch (_) { /* the run fails anyway */ }
    throw err;
  } finally {
    fs.closeSync(fd);
  }
  if (!existed) fsyncDir(dir);
  return `preimages/${runId}.jsonl`;
}

function writeConfirmation(record) {
  writeAtomic(confirmationPath(), `${JSON.stringify(record, null, 2)}\n`);
  return record;
}

function readPendingConfirmation({ readFile } = {}) {
  return readJson(confirmationPath(), readFile);
}

/**
 * Claim the pending confirmation for pass `runId`: rename it into claimed/ (atomic, so exactly one
 * claimant), then read what was claimed. → the record, or null when none was pending.
 */
function claimConfirmation(runId) {
  // The claimed name is built only from checked grammars (clarification C13).
  if (typeof runId !== 'string' || !RUN_ID_RE.test(runId)) throw Object.assign(new Error('not a run id'), { code: 'EBADRUNID' });
  const src = confirmationPath();
  let nonce = 'x';
  try {
    const pending = JSON.parse(fs.readFileSync(src, 'utf8'));
    if (pending && typeof pending.nonce === 'string' && /^[0-9a-f]{32}$/.test(pending.nonce)) nonce = pending.nonce;
  } catch (err) {
    if (err && err.code === 'ENOENT') return null;
    // An unreadable record is still claimed (and then not honoured).
  }
  const dir = path.join(stateDir(), 'claimed');
  ensureDir(dir);
  const dest = path.join(dir, `${runId}-${nonce}.json`);
  try {
    fs.renameSync(src, dest);
  } catch (err) {
    if (err && err.code === 'ENOENT') return null;
    throw err;
  }
  fsyncDir(stateDir());
  try {
    return JSON.parse(fs.readFileSync(dest, 'utf8'));
  } catch (_) {
    return { unreadable: true };
  }
}

/** Withdraw the pending confirmation by renaming it away. → true if it was there, false if a pass claimed it. */
function withdrawConfirmation() {
  try {
    fs.renameSync(confirmationPath(), path.join(stateDir(), 'confirmation.withdrawn.json'));
    return true;
  } catch (err) {
    if (err && err.code === 'ENOENT') return false;
    throw err;
  }
}

/** Keep the last 5 held files plus any a pending or claimed record names; the last 20 claimed records; never preimages/. */
function prune() {
  const root = stateDir();
  const claimedDir = path.join(root, 'claimed');
  const heldDir = path.join(root, 'held');
  const list = (dir) => { try { return fs.readdirSync(dir).sort(); } catch (_) { return []; } };

  const claimed = list(claimedDir).filter((f) => f.endsWith('.json'));
  const keepClaimed = claimed.slice(-KEEP_CLAIMED);
  for (const f of claimed) {
    if (!keepClaimed.includes(f)) { try { fs.unlinkSync(path.join(claimedDir, f)); } catch (_) { /* gone */ } }
  }

  const named = new Set();
  const noteRun = (file) => {
    try {
      const rec = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (rec && typeof rec.runId === 'string') named.add(rec.runId);
    } catch (_) { /* none */ }
  };
  noteRun(confirmationPath());
  for (const f of keepClaimed) noteRun(path.join(claimedDir, f));

  const held = list(heldDir).filter((f) => f.endsWith('.json'));
  const keepHeld = new Set(held.slice(-KEEP_HELD));
  for (const f of held) {
    const runId = f.slice(0, -'.json'.length);
    if (keepHeld.has(f) || named.has(runId)) continue;
    try { fs.unlinkSync(path.join(heldDir, f)); } catch (_) { /* gone */ }
  }
}

function syncRead(readFile) {
  return readFile || ((p) => fs.readFileSync(p, 'utf8'));
}

/** Parse a /proc/<pid>/stat line: fields after the last ')' (the name may hold spaces and parentheses). */
function parseStat(text) {
  const s = String(text);
  const close = s.lastIndexOf(')');
  if (close < 0) return null;
  const rest = s.slice(close + 1).trim().split(/\s+/);
  // rest[0] is field 3 (state); field N is rest[N - 3].
  if (rest.length < 20) return null;
  return { state: rest[0], startTime: rest[19] };
}

/** Field 22 of /proc/<pid>/stat (the process start time, in clock ticks since boot), or null. */
function processStartTime(pid, { readFile } = {}) {
  try {
    const st = parseStat(syncRead(readFile)(`/proc/${pid}/stat`));
    return st ? st.startTime : null;
  } catch (_) {
    return null;
  }
}

/**
 * Is the process a report names still that same running process? Only while /proc/<pid>/stat exists
 * with the recorded start time and a state that is neither Z (zombie) nor X (dead).
 * Accepts the `process` record or a report entry carrying one.
 */
function isAlive(record, { readFile } = {}) {
  const proc = record && record.process && typeof record.process === 'object' ? record.process : record;
  if (!proc || !Number.isInteger(proc.pid) || proc.pid <= 0 || proc.startTime == null) return false;
  const judge = (text) => {
    const st = parseStat(toText(text));
    return !!st && st.state !== 'Z' && st.state !== 'X' && String(st.startTime) === String(proc.startTime);
  };
  try {
    // A promise when the injected readFile is async (clarification C11: awaiting it works).
    const out = syncRead(readFile)(`/proc/${proc.pid}/stat`);
    return isThenable(out) ? out.then(judge, () => false) : judge(out);
  } catch (_) {
    return false;
  }
}

/**
 * Does this process hold an exclusive flock on file descriptor `fd`? (/proc/self/fdinfo/<fd> shows `FLOCK … WRITE`.)
 * With `file` (ADR tagging-edges/0003 C20), fd must also be that file: fdinfo's `ino:` must equal the file's inode,
 * compared as strings (the lock line's pid reads 0 in the container's pid namespace, so it proves nothing). A missing
 * file, a foreign inode or no `ino:` line reads as not held. Without `file` the old answer stands (clarification T24).
 */
function lockHeld(fd, { file, readFile } = {}) {
  try {
    const lines = String(syncRead(readFile)(`/proc/self/fdinfo/${fd}`)).split('\n');
    const locked = lines.some((l) => /^lock:/.test(l) && /\bFLOCK\b/.test(l) && /\bWRITE\b/.test(l));
    if (!locked || file === undefined || file === null) return locked;
    const ino = lines.map((l) => /^ino:\s*(\d+)\s*$/.exec(l)).find(Boolean);
    return !!ino && ino[1] === fs.statSync(file, { bigint: true }).ino.toString();
  } catch (_) {
    return false;
  }
}

module.exports = {
  DEFAULT_STATE_DIR,
  REPORT_VERSION,
  PREVIOUS_CAP,
  stateDir,
  writeAtomic,
  readReport,
  writeReport,
  heldPath,
  writeHeld,
  readHeld,
  heldDigest,
  appendPreimages,
  writeConfirmation,
  claimConfirmation,
  withdrawConfirmation,
  readPendingConfirmation,
  prune,
  parseStat,
  processStartTime,
  isAlive,
  lockHeld,
};
