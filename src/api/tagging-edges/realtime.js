/**
 * The real-time path's routes (tagging-edges story 3, ADR tagging-edges/0003 § "Status and switch (D8-A)").
 *
 *   GET  /api/tagging-edges/realtime/status   public read: whether the path is on and running, its state, the last
 *                                             catch-up, its counts since the first start, and what it waits on
 *   POST /api/tagging-edges/realtime/switch   owner only: { on: true | false } → <stateDir>/realtime/switch.json
 *
 * What is served comes from switch.json and status.json, which the path writes with fixed text only: counts, states,
 * times, stage names, allow-listed error codes, the pid and process start time, and the pre-image file's relative
 * name. Error codes pass the library's allow-list again here (lastError.code and the dbRefused.byReason keys), so a
 * code outside it answers 'error'. No config value, credential, URI, host, IP, port or absolute path appears. No
 * error's message reaches an answer: a failed read or write answers with a fixed sentence and an allow-listed code.
 *
 * The switch sends no signal and enqueues nothing: the path polls switch.json (off takes effect within 5 s). A write of
 * { on: false } that fails removes switch.json instead, which needs no free space and reads as off.
 *
 * The display logic is the pure computeRealtimeStatus(); validateSwitch() is the pure half of the switch route.
 * Handlers take their dependencies (readFile included) as a third argument, for tests.
 */

const path = require('path');
const { allowErrorCode } = require('../../lib/tagging-edges/realtime');
const { sameHost, isJson } = require('./index');

const STATUS_VERSION = 1;
const STALE_AFTER_MS = 60 * 1000;
const TAKES_EFFECT_WITHIN_SECONDS = 5;
const OWNER_RE = /^[0-9a-f]{64}$/;

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
  };
}

/** As index.js's withDeps. The default switch writer is the store's, under the handler's own stateDir() (T27, T32). */
function withDeps(deps) {
  const given = deps && typeof deps === 'object' ? deps : {};
  const d = { ...defaultDeps(), ...given };
  if (typeof given.getOwnerPubkey === 'function') d.ownerPubkey = given.getOwnerPubkey;
  else if (typeof given.ownerPubkey === 'string') { const o = given.ownerPubkey; d.ownerPubkey = () => o; }
  if (given.readFile && !given.isAlive) { const rf = given.readFile; d.isAlive = (r) => state().isAlive(r, { readFile: rf }); }
  const realtimeStore = () => store().createStore({ dir: path.join(d.stateDir(), 'realtime') });
  if (typeof given.writeSwitch !== 'function') d.writeSwitch = (record) => realtimeStore().writeSwitch(record);
  if (typeof given.unlinkSwitch !== 'function') d.unlinkSwitch = () => realtimeStore().unlinkSwitch();
  return d;
}

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

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
 * - running comes from liveness alone, and runningSince is status.json's process.startedAt while alive (T32);
 * - stale: alive, and updatedAt missing, unparseable or more than 60 s old (T27);
 * - error codes pass the allow-list again (T27).
 * A stored on, onSince, running, runningSince, switchUnreadable or stale is never passed through.
 */
function computeRealtimeStatus({ status, switchRecord, alive, now } = {}) {
  const s = isObject(status) ? status : {};
  const sw = isObject(switchRecord) ? switchRecord : null;
  const switchUnreadable = !!sw && sw.unreadable === true;
  const on = !!sw && !switchUnreadable && sw.on === true;
  const running = !!alive;
  const proc = isObject(s.process) ? s.process : null;
  const updatedAt = typeof s.updatedAt === 'string' ? Date.parse(s.updatedAt) : NaN;

  const out = {
    statusVersion: STATUS_VERSION,
    on,
    onSince: on && typeof sw.changedAt === 'string' ? sw.changedAt : null,
    running,
    runningSince: running && proc && typeof proc.startedAt === 'string' ? proc.startedAt : null,
    state: on ? (s.state === undefined ? null : s.state) : 'off',
  };
  for (const k of PASS_THROUGH) out[k] = s[k] === undefined ? null : s[k];
  if (isObject(s.lastError) && s.lastError.code !== undefined) out.lastError = { ...s.lastError, code: allowErrorCode(s.lastError.code) };
  if (isObject(s.counts) && s.counts.dbRefused !== undefined) out.counts = { ...s.counts, dbRefused: allowedReasons(s.counts.dbRefused) };
  out.switchUnreadable = switchUnreadable;
  out.stale = running && !(Number.isFinite(updatedAt) && now - updatedAt <= STALE_AFTER_MS);
  return out;
}

/** Pure. → { ok: true, on } for a JSON object whose own `on` is a boolean, else { ok: false, status: 400, error }. */
function validateSwitch(body) {
  if (!isObject(body) || !Object.prototype.hasOwnProperty.call(body, 'on') || typeof body.on !== 'boolean') {
    return { ok: false, status: 400, error: 'the body must be {"on": true} or {"on": false}' };
  }
  return { ok: true, on: body.on };
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

/** POST /api/tagging-edges/realtime/switch { on } — owner only. */
async function handleRealtimeSwitch(req, res, deps) {
  const d = withDeps(deps);
  const session = req && req.session;
  if (!session || typeof session.pubkey !== 'string' || session.pubkey === '') {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  let owner = null;
  try { owner = d.ownerPubkey(); } catch (_) { owner = null; }
  if (session.authenticated !== true || typeof owner !== 'string' || !OWNER_RE.test(owner) || session.pubkey !== owner) {
    return res.status(403).json({ success: false, error: 'Owner access required' });
  }
  if (!sameHost(req)) return res.status(403).json({ success: false, error: 'cross-site request refused' });
  if (!isJson(req)) return res.status(415).json({ success: false, error: 'the body must be application/json' });
  const v = validateSwitch(req.body);
  if (!v.ok) return res.status(v.status).json({ success: false, error: v.error });

  const record = { version: 1, on: v.on, changedAt: new Date(d.now()).toISOString(), changedBy: owner.slice(0, 8) };
  try {
    await d.writeSwitch(record);
  } catch (err) {
    if (v.on) {
      return res.status(500).json({ success: false, error: `could not write the switch: ${allowErrorCode(err && err.code)}` });
    }
    // Off must mean off: a missing switch.json reads as off, and removing it needs no free space.
    try {
      await d.unlinkSwitch();
    } catch (unlinkErr) {
      return res.status(500).json({ success: false, error: `could not write or remove the switch: ${allowErrorCode(err && err.code)}, ${allowErrorCode(unlinkErr && unlinkErr.code)}` });
    }
    return res.json({ success: true, on: false, takesEffectWithinSeconds: TAKES_EFFECT_WITHIN_SECONDS });
  }
  return res.json({ success: true, on: v.on, changedAt: record.changedAt, takesEffectWithinSeconds: TAKES_EFFECT_WITHIN_SECONDS });
}

module.exports = {
  computeRealtimeStatus,
  validateSwitch,
  handleRealtimeStatus,
  handleRealtimeSwitch,
};
