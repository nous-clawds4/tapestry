/**
 * The real-time path's routes (tagging-edges story 3, ADR tagging-edges/0003 § "Status and switch (D8-A)"; story 5,
 * ADR tagging-edges/0005).
 *
 *   GET  /api/tagging-edges/realtime/status   public read: whether the path is on and running, its state, the last
 *                                             catch-up, its counts since the first start, what it waits on, and
 *                                             whether it is within 60 s of being switched on (inStartWindow)
 *   POST /api/tagging-edges/realtime/switch   owner or admin: { on: true | false } → <stateDir>/realtime/switch.json,
 *                                             recording who (role and 8-character key) and when, and
 *                                             switch-history.json, the last 10 changes
 *   GET  /api/tagging-edges/realtime/switch   owner or admin: who changed the switch and when, the latest change and
 *                                             the last 10
 *
 * What the status serves comes from switch.json and status.json, which the path writes with fixed text only: counts,
 * states, times, stage names, allow-listed error codes, the pid and process start time, and the pre-image file's
 * relative name. Error codes pass the library's allow-list again here (lastError.code and the dbRefused.byReason keys),
 * so a code outside it answers 'error'. No config value, credential, URI, host, IP, port or absolute path appears. No
 * error's message reaches an answer: a failed read or write answers with a fixed sentence and an allow-listed code.
 * Who changed the switch is never on the public status, and no handler logs it (ADR 0005 D6): it reaches only a
 * signed-in owner or admin from this site, through the GET on the switch path.
 *
 * The switch sends no signal and enqueues nothing: the path polls switch.json (off takes effect within 5 s). A write of
 * { on: false } that fails removes switch.json instead, which needs no free space and reads as off; that off is
 * answered as not recorded. switch.json holds the latest change; the history is best effort, and never receives a
 * change before switch.json does (ADR 0005 D2). Changes run one at a time, in the order they were admitted (D9).
 *
 * The display logic is the pure computeRealtimeStatus(); validateSwitch() is the pure half of the switch route, and
 * switchEntry(), switchRecord() and foldHistory() the pure record. Handlers take their dependencies (readFile
 * included) as a third argument, for tests.
 */

const path = require('path');
const { allowErrorCode } = require('../../lib/tagging-edges/realtime');
const { isJson, ownerOrAdmin } = require('./index');

const STATUS_VERSION = 1;
const STALE_AFTER_MS = 60 * 1000;
const START_WINDOW_MS = 60 * 1000;
const TAKES_EFFECT_WITHIN_SECONDS = 5;
const HISTORY_CAP = 10;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const KEY_RE = /^[0-9a-f]{8}$/;
const ROLES = ['owner', 'admin'];

/** The fields status.json carries that the answer passes on as they are (T29); lastError and counts are re-checked. */
const PASS_THROUGH = [
  'firstStartedAt', 'relay', 'subscription', 'lastReflectedAt', 'lastRound', 'catchUp', 'counts', 'pending',
  'parked', 'seen', 'heard', 'journal', 'setupProblem', 'lastError', 'preimageFile', 'process', 'updatedAt',
];

const state = () => require('../../pipeline/tagging-edges/state');
const store = () => require('../../pipeline/tagging-edges/realtime/store');

/** The real dependencies, required lazily so this module loads stack-free. */
function defaultDeps() {
  return {
    readFile: (p, enc) => require('fs').promises.readFile(p, enc),
    stateDir: () => state().stateDir(),
    isAlive: (record) => state().isAlive(record),
    now: () => Date.now(),
    ownerPubkey: () => require('../../utils/config').getConfigFromFile('BRAINSTORM_OWNER_PUBKEY'),
    getAdminPubkeys: () => require('../../utils/config').getAdminPubkeys(),
  };
}

/**
 * As index.js's withDeps. The default switch and record methods are the store's, under the handler's own stateDir()
 * (T27, T32; ADR 0005 § Seams).
 */
function withDeps(deps) {
  const given = deps && typeof deps === 'object' ? deps : {};
  const d = { ...defaultDeps(), ...given };
  if (typeof given.getOwnerPubkey === 'function') d.ownerPubkey = given.getOwnerPubkey;
  else if (typeof given.ownerPubkey === 'string') { const o = given.ownerPubkey; d.ownerPubkey = () => o; }
  if (given.readFile && !given.isAlive) { const rf = given.readFile; d.isAlive = (r) => state().isAlive(r, { readFile: rf }); }
  const realtimeStore = () => store().createStore({ dir: path.join(d.stateDir(), 'realtime') });
  if (typeof given.writeSwitch !== 'function') d.writeSwitch = (record) => realtimeStore().writeSwitch(record);
  if (typeof given.unlinkSwitch !== 'function') d.unlinkSwitch = () => realtimeStore().unlinkSwitch();
  if (typeof given.readSwitch !== 'function') d.readSwitch = () => realtimeStore().readSwitch();
  if (typeof given.readSwitchHistory !== 'function') d.readSwitchHistory = () => realtimeStore().readSwitchHistory();
  if (typeof given.writeSwitchHistory !== 'function') d.writeSwitchHistory = (obj) => realtimeStore().writeSwitchHistory(obj);
  return d;
}

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
/** An ISO time as Date#toISOString writes it (the writers' only form). */
const isIso = (v) => typeof v === 'string' && ISO_RE.test(v) && Number.isFinite(Date.parse(v));

/** The dbRefused counts with every reason key passed through the allow-list; keys that collapse are summed (T32). */
function allowedReasons(dbRefused) {
  if (!isObject(dbRefused) || !isObject(dbRefused.byReason)) return dbRefused;
  const byReason = {};
  for (const [reason, n] of Object.entries(dbRefused.byReason)) {
    const key = allowErrorCode(reason);
    byReason[key] = byReason[key] === undefined ? n : byReason[key] + n;
  }
  return { ...dbRefused, byReason };
}

/**
 * Pure. What the status route shows (§ Status), from status.json, the switch record (readSwitch's shape, the raw
 * file, null when missing, or { unreadable: true }), the process's liveness and the clock.
 * - on and onSince come from the switch alone, so off shows at once; state is 'off' whenever the switch is off;
 * - onSince is the last off-to-on time (ADR 0005 D4): the switch's onSince when it is an ISO time, else its changedAt
 *   (a version 1 record), else null; null when off;
 * - running comes from liveness alone, and runningSince is status.json's process.startedAt while alive (T32);
 * - inStartWindow (ADR 0005 D7): on, within 60 s of onSince on the server's clock, and no running process started at
 *   or after onSince — so a process still stopping from before the on does not count as this on's;
 * - stale: alive, and updatedAt missing, unparseable or more than 60 s old (T27);
 * - error codes pass the allow-list again (T27).
 * A stored on, onSince, running, runningSince, switchUnreadable, stale or inStartWindow is never passed through, and
 * who changed the switch is never served (ADR 0005 D6).
 */
function computeRealtimeStatus({ status, switchRecord, alive, now } = {}) {
  const s = isObject(status) ? status : {};
  const sw = isObject(switchRecord) ? switchRecord : null;
  const switchUnreadable = !!sw && sw.unreadable === true;
  const on = !!sw && !switchUnreadable && sw.on === true;
  const running = !!alive;
  const proc = isObject(s.process) ? s.process : null;
  const updatedAt = typeof s.updatedAt === 'string' ? Date.parse(s.updatedAt) : NaN;
  let onSince = null;
  if (on) onSince = isIso(sw.onSince) ? sw.onSince : (isIso(sw.changedAt) ? sw.changedAt : null);

  const out = {
    statusVersion: STATUS_VERSION,
    on,
    onSince,
    running,
    runningSince: running && proc && typeof proc.startedAt === 'string' ? proc.startedAt : null,
    state: on ? (s.state === undefined ? null : s.state) : 'off',
  };
  for (const k of PASS_THROUGH) out[k] = s[k] === undefined ? null : s[k];
  if (isObject(s.lastError) && s.lastError.code !== undefined) out.lastError = { ...s.lastError, code: allowErrorCode(s.lastError.code) };
  if (isObject(s.counts) && s.counts.dbRefused !== undefined) out.counts = { ...s.counts, dbRefused: allowedReasons(s.counts.dbRefused) };
  out.switchUnreadable = switchUnreadable;
  out.stale = running && !(Number.isFinite(updatedAt) && now - updatedAt <= STALE_AFTER_MS);
  const since = onSince === null ? NaN : Date.parse(onSince);
  const started = out.runningSince === null ? NaN : Date.parse(out.runningSince);
  const elapsed = now - since;
  out.inStartWindow = on && Number.isFinite(since) && elapsed >= 0 && elapsed < START_WINDOW_MS
    && !(running && Number.isFinite(started) && started >= since);
  return out;
}

/** Pure. → { ok: true, on } for a JSON object whose own `on` is a boolean, else { ok: false, status: 400, error }. */
function validateSwitch(body) {
  if (!isObject(body) || !Object.prototype.hasOwnProperty.call(body, 'on') || typeof body.on !== 'boolean') {
    return { ok: false, status: 400, error: 'the body must be {"on": true} or {"on": false}' };
  }
  return { ok: true, on: body.on };
}

/** A change not recorded: who and when unknown (ADR 0005 D1, D3). */
const unrecorded = (on) => ({ on: on === true, at: null, role: null, key: null });

/**
 * Pure. One parsed switch record → its history entry { on, at, role, key } (ADR 0005 D3). A recorded change is either
 * an 8-hex changedBy, an ISO changedAt and the role 'owner' or 'admin', with on and onSince agreeing (on with an ISO
 * onSince, off with a null one), or a version 1 record with no role, an 8-hex changedBy and an ISO changedAt — the
 * change made before story 5, which only the owner could make (D10). Anything else readable is a change not recorded.
 */
function switchEntry(rec) {
  const r = isObject(rec) ? rec : {};
  const who = typeof r.changedBy === 'string' && KEY_RE.test(r.changedBy) && isIso(r.changedAt);
  if (who && ROLES.includes(r.role) && (r.on === true ? isIso(r.onSince) : r.onSince === null)) {
    return { on: r.on === true, at: r.changedAt, role: r.role, key: r.changedBy };
  }
  if (who && r.version === 1 && r.role === undefined) return { on: r.on === true, at: r.changedAt, role: 'owner', key: r.changedBy };
  return unrecorded(r.on);
}

/** A history entry D1 allows — recorded (ISO at, a role, an 8-hex key) or not recorded (all three null) — as just those four members, else null. */
function validEntry(e) {
  if (!isObject(e) || typeof e.on !== 'boolean') return null;
  if (e.at === null && e.role === null && e.key === null) return unrecorded(e.on);
  if (isIso(e.at) && ROLES.includes(e.role) && typeof e.key === 'string' && KEY_RE.test(e.key)) return { on: e.on, at: e.at, role: e.role, key: e.key };
  return null;
}

const sameEntry = (a, b) => a.on === b.on && a.at === b.at && a.role === b.role && a.key === b.key;
/** Drops an entry equal in on, at, role and key to the one before it (ADR 0005 D3). */
const dedupe = (list) => list.filter((e, i) => i === 0 || !sameEntry(e, list[i - 1]));

/** A read switch-history.json (readSwitchHistory's shape) → whether it is present, unreadable, and its valid entries. */
function historyOf(historyObj) {
  const present = historyObj !== null && historyObj !== undefined;
  const unreadable = present && (!isObject(historyObj) || historyObj.unreadable === true || !Array.isArray(historyObj.changes));
  const changes = present && !unreadable ? historyObj.changes : [];
  return { present, unreadable, changes, valid: changes.map(validEntry).filter(Boolean) };
}

/**
 * Pure. The latest change and the record, from switch.json and switch-history.json as the store reads them (null when
 * missing, { unreadable: true[, readError] }, or the parsed object) — ADR 0005 D3.
 * → { on, switchUnreadable, historyUnreadable, state, latest, history }, state one of
 *   'recorded'           switch.json readable; latest is switchEntry(switch.json)
 *   'switch-unreadable'  switch.json gives a read error or is damaged; latest null, the stored history still returned
 *   'unrecorded-off'     switch.json missing after a change (the history holds an entry, or is unreadable): an off
 *                        whose write failed, so latest is an off without who or when
 *   'never-switched'     both missing, or the history empty; latest null, history []
 * history is dedupe([latest, ...the history's valid entries]).slice(0, 10), the list the writer extends (D2).
 */
function switchRecord(switchRec, historyObj) {
  const h = historyOf(historyObj);
  const swPresent = switchRec !== null && switchRec !== undefined;
  const switchUnreadable = swPresent && (!isObject(switchRec) || switchRec.unreadable === true || typeof switchRec.on !== 'boolean');
  let state;
  let latest = null;
  if (swPresent && !switchUnreadable) { state = 'recorded'; latest = switchEntry(switchRec); }
  else if (switchUnreadable) state = 'switch-unreadable';
  else if (h.present && (h.unreadable || h.changes.length > 0)) { state = 'unrecorded-off'; latest = unrecorded(false); }
  else state = 'never-switched';
  return {
    on: state === 'recorded' && switchRec.on === true,
    switchUnreadable,
    historyUnreadable: h.unreadable,
    state,
    latest,
    history: dedupe(latest ? [latest, ...h.valid] : h.valid).slice(0, HISTORY_CAP),
  };
}

/** Pure. dedupe([newEntry, ...list]).slice(0, 10): the history after a change (ADR 0005 D3, D2 step 5). */
function foldHistory(newEntry, list) {
  return dedupe([newEntry, ...(Array.isArray(list) ? list : [])]).slice(0, HISTORY_CAP);
}

const toText = (out) => (Buffer.isBuffer(out) ? out.toString('utf8') : String(out));

/** A file's text through the injected readFile, or null when it does not exist; any other error is thrown. */
async function readText(d, file) {
  try {
    return toText(await d.readFile(file, 'utf8'));
  } catch (err) {
    if (err && err.code === 'ENOENT') return null;
    throw err;
  }
}

/** GET /api/tagging-edges/realtime/status */
async function handleRealtimeStatus(req, res, deps) {
  const d = withDeps(deps);
  try {
    const dir = path.join(d.stateDir(), 'realtime');
    // A missing switch.json reads as off; an unreadable one reads as off and says so (fail-safe, T26).
    let switchRecord;
    try {
      const text = await readText(d, path.join(dir, 'switch.json'));
      switchRecord = text === null ? null : store().parseSwitch(text);
    } catch (_) {
      switchRecord = { unreadable: true };
    }
    // A missing status.json is the path never having run; one that cannot be read or parsed names no process.
    let status = null;
    let statusUnreadable = false;
    try {
      const text = await readText(d, path.join(dir, 'status.json'));
      if (text !== null) {
        status = JSON.parse(text);
        if (!isObject(status)) { status = null; statusUnreadable = true; }
      }
    } catch (_) {
      status = null;
      statusUnreadable = true;
    }
    let alive = false;
    try { alive = !!(status && isObject(status.process) && (await d.isAlive(status.process))); } catch (_) { alive = false; }
    const answer = computeRealtimeStatus({ status, switchRecord, alive, now: d.now() });
    if (statusUnreadable) answer.statusUnreadable = true;
    return res.json(answer);
  } catch (err) {
    return res.status(500).json({ success: false, error: `could not read the real-time path's state: ${allowErrorCode(err && err.code)}` });
  }
}

/** A store read that should not throw, as the store maps a throw: { unreadable: true, readError } (ADR 0005 D1). */
async function readOrError(read) {
  try {
    return await read();
  } catch (err) {
    return { unreadable: true, readError: (err && err.code) || 'error' };
  }
}

/**
 * The last off-to-on time for an on (ADR 0005 D4): while prev reads on, its onSince when that is an ISO time, else its
 * changedAt (a version 1 record), else now; from off, missing or damaged, now.
 */
function onSinceFor(prev, now) {
  if (!isObject(prev) || prev.unreadable === true || prev.on !== true) return now;
  if (isIso(prev.onSince)) return prev.onSince;
  return isIso(prev.changedAt) ? prev.changedAt : now;
}

/** The entries' wire text, to tell whether two lists hold the same changes in the same order. */
const entriesText = (list) => JSON.stringify(list.map((e) => [e.on, e.at, e.role, e.key]));

/**
 * One admitted, validated change (ADR 0005 D2), run inside the chain: read the current switch and history; refuse an
 * on whose switch cannot be read; bring the history up to the list a GET shows now (the pre-fold, best effort); write
 * switch.json; then fold the change into the history (best effort). An off whose write fails unlinks switch.json and
 * is answered as not recorded, with no fold. → { status, body }
 */
async function switchStep(d, on, who) {
  const prev = await readOrError(() => d.readSwitch());
  const hist = await readOrError(() => d.readSwitchHistory());
  if (on && isObject(prev) && prev.readError) {
    // Whether the path is already on decides onSince, so an on that cannot read the switch changes nothing.
    const code = allowErrorCode(prev.readError);
    return { status: 500, body: { success: false, error: `could not read the switch: ${code}`, code } };
  }
  // The list a GET shows now; null while the history gives a read error, and then nothing writes it (residual (b)).
  const base = isObject(hist) && hist.readError ? null : switchRecord(prev, hist).history;
  if (base !== null && entriesText(base) !== entriesText(historyOf(hist).valid)) {
    // Only changes already made, so never a phantom entry: the pre-story-5 change, or an earlier unrecorded off.
    try { await d.writeSwitchHistory({ version: 1, changes: base }); } catch (_) { /* best effort: base stays in memory */ }
  }

  const changedAt = new Date(d.now()).toISOString();
  const next = { version: 2, on, changedAt, changedBy: who.pubkey.slice(0, 8), role: who.role, onSince: on ? onSinceFor(prev, changedAt) : null };
  try {
    await d.writeSwitch(next);
  } catch (err) {
    const code = allowErrorCode(err && err.code);
    if (on) return { status: 500, body: { success: false, error: `could not write the switch: ${code}`, code } };
    // Off must mean off: a missing switch.json reads as off, and removing it needs no free space. Nothing records it.
    try {
      await d.unlinkSwitch();
    } catch (unlinkErr) {
      const unlinkCode = allowErrorCode(unlinkErr && unlinkErr.code);
      return { status: 500, body: { success: false, error: `could not write or remove the switch: ${code}, ${unlinkCode}`, code, unlinkCode } };
    }
    return { status: 200, body: { success: true, on: false, recorded: false, takesEffectWithinSeconds: TAKES_EFFECT_WITHIN_SECONDS } };
  }
  if (base !== null) {
    // switch.json holds the change; a failed fold is repaired by the next change's pre-fold.
    try { await d.writeSwitchHistory({ version: 1, changes: foldHistory(switchEntry(next), base) }); } catch (_) { /* best effort */ }
  }
  return { status: 200, body: { success: true, on, changedAt, recorded: true, takesEffectWithinSeconds: TAKES_EFFECT_WITHIN_SECONDS } };
}

/** The changes admitted so far, run one after another (ADR 0005 D9); a failure never breaks the chain. */
let chain = Promise.resolve();

/**
 * POST /api/tagging-edges/realtime/switch { on } — owner or admin. Refusals (ownerOrAdmin's 401 and 403s, 415, 400)
 * are answered before the change joins the chain, and read, write and record nothing. An unexpected throw inside the
 * change answers 500 with an allow-listed code.
 */
async function handleRealtimeSwitch(req, res, deps) {
  const d = withDeps(deps);
  const who = ownerOrAdmin(req, d);
  if (!who.ok) return res.status(who.status).json({ success: false, error: who.error });
  if (!isJson(req)) return res.status(415).json({ success: false, error: 'the body must be application/json' });
  const v = validateSwitch(req.body);
  if (!v.ok) return res.status(v.status).json({ success: false, error: v.error });

  const step = chain.then(() => switchStep(d, v.on, who));
  chain = step.catch(() => {});
  let answer;
  try {
    answer = await step;
  } catch (err) {
    const code = allowErrorCode(err && err.code);
    answer = { status: 500, body: { success: false, error: `could not change the switch: ${code}`, code } };
  }
  return res.status(answer.status).json(answer.body);
}

/**
 * A record file through the injected readFile: null when missing, { unreadable: true, readError } on any other read
 * error, else `parse` of its text — as the store maps it (ADR 0005 D6).
 */
async function readRecordFile(d, file, parse) {
  let text;
  try { text = await readText(d, file); } catch (err) { return { unreadable: true, readError: (err && err.code) || 'error' }; }
  return text === null ? null : parse(text);
}

/**
 * GET /api/tagging-edges/realtime/switch — owner or admin, this site only (ADR 0005 D6): the latest change and the
 * last 10, from switch-history.json read first and then switch.json (so the history never holds a change newer than
 * the switch read after it, D2's invariant). It writes nothing. A file that cannot be read is part of the 200 answer;
 * only a throw outside the two reads answers 500.
 */
async function handleRealtimeSwitchRecord(req, res, deps) {
  const d = withDeps(deps);
  const who = ownerOrAdmin(req, d);
  if (!who.ok) return res.status(who.status).json({ success: false, error: who.error });
  try {
    const dir = path.join(d.stateDir(), 'realtime');
    const history = await readRecordFile(d, path.join(dir, 'switch-history.json'), (t) => store().parseSwitchHistory(t));
    const switchRec = await readRecordFile(d, path.join(dir, 'switch.json'), (t) => store().parseSwitch(t));
    return res.json({ success: true, ...switchRecord(switchRec, history) });
  } catch (err) {
    return res.status(500).json({ success: false, error: `could not read the switch record: ${allowErrorCode(err && err.code)}` });
  }
}

module.exports = {
  computeRealtimeStatus,
  validateSwitch,
  switchEntry,
  switchRecord,
  foldHistory,
  handleRealtimeStatus,
  handleRealtimeSwitch,
  handleRealtimeSwitchRecord,
};
