/**
 * The gap-filling pass's routes (tagging-edges story 2, ADR tagging-edges/0002).
 *
 *   GET  /api/tagging-edges/status                  public read: the latest report, the previous ones, and
 *                                                   any pending owner confirmation (without its nonce)
 *   GET  /api/tagging-edges/held?runId=&offset=&limit   public read, paged: the LATEST report's held list only
 *   POST /api/tagging-edges/confirm-held-removals   owner only: { runId } → a single-use confirmation record
 *                                                   the next pass claims, then an enqueue through the task system
 *
 * What is served: counts, run ids, timestamps, relay- and graph-derived values (tagging addresses, event ids,
 * property-key names), the held list's digest, the pass's pid and process start time, reason text and redacted
 * error text. The stamp identities and the confirming owner appear only as 8-character prefixes, while a tagging
 * address carries its author's full pubkey; no config value or credential appears, and no absolute path that starts a
 * word (a `/` at the start or after whitespace, a quote, `[`, `(` or `=`): the runner redacts error text before it
 * enters the report, replacing any URI, any such path and any `host:port` (an IPv4 address; a letter-led name,
 * single-label or dotted, with a 2–5-digit port; or a bracketed IPv6 address). The held route never builds a path from
 * request input.
 *
 * The display logic is the pure computeStatus(); validateConfirmation() is the pure half of the confirm
 * route. Handlers take their dependencies (readFile included) as a third argument, for tests.
 */

const path = require('path');
const crypto = require('crypto');
const { RUN_ID_RE } = require('../../lib/tagging-edges/sweep');

const TASK_NAME = 'reconcileTaggingEdges';
const HELD_PAGE_MAX = 1000;
const CONFIRMATION_TTL_MS = 24 * 60 * 60 * 1000;
const OWNER_RE = /^[0-9a-f]{64}$/;

/** The real dependencies, required lazily so this module loads stack-free. */
function defaultDeps() {
  const state = () => require('../../pipeline/tagging-edges/state');
  return {
    readFile: (p, enc) => require('fs').promises.readFile(p, enc),
    stateDir: () => state().stateDir(),
    isAlive: (record) => state().isAlive(record),
    heldDigest: (list) => state().heldDigest(list),
    readHeld: (runId, opts) => state().readHeld(runId, opts),
    writeConfirmation: (record) => state().writeConfirmation(record),
    withdrawConfirmation: () => state().withdrawConfirmation(),
    now: () => Date.now(),
    nonce: () => crypto.randomBytes(16).toString('hex'),
    ownerPubkey: () => require('../../utils/config').getConfigFromFile('BRAINSTORM_OWNER_PUBKEY'),
    // false when the queue is disabled (never initialised) or Redis does not answer
    isQueueAvailable: () => require('../../manage/taskQueue/queue').isQueueAvailable(),
    runViaQueueAsync: (args) => require('../../manage/taskQueue/queue').runViaQueueAsync(args),
    taskTimeoutMs: () => {
      const registry = require('../../manage/taskQueue/taskRegistry.json');
      const { resolveTaskTimeout } = require('../../utils/taskTimeout');
      return resolveTaskTimeout(registry.tasks[TASK_NAME], registry).timeoutMs;
    },
  };
}

function withDeps(deps) {
  const d = { ...defaultDeps(), ...(deps && typeof deps === 'object' ? deps : {}) };
  if (deps && typeof deps.getOwnerPubkey === 'function') d.ownerPubkey = deps.getOwnerPubkey;
  else if (deps && typeof deps.ownerPubkey === 'string') { const o = deps.ownerPubkey; d.ownerPubkey = () => o; }
  if (deps && deps.readFile && !deps.isAlive) { const rf = deps.readFile; d.isAlive = (r) => require('../../pipeline/tagging-edges/state').isAlive(r, { readFile: rf }); }
  return d;
}

async function readJson(d, rel) {
  const file = path.join(d.stateDir(), rel);
  let text;
  try {
    text = await d.readFile(file, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') return null;
    throw Object.assign(new Error(`${(err && err.code) || 'error'} ${rel}`), { code: (err && err.code) || 'error', rel });
  }
  try {
    return JSON.parse(Buffer.isBuffer(text) ? text.toString('utf8') : String(text));
  } catch (_) {
    throw Object.assign(new Error(`unreadable ${rel}`), { code: 'EBADJSON', rel });
  }
}

/**
 * The held list for a run id, through state.readHeld (which rejects a run id outside RUN_ID_RE and asserts the
 * resolved path is inside held/ before reading) with the injected readFile. → the list, or null when absent.
 */
async function readHeld(d, runId) {
  try {
    return await d.readHeld(runId, { readFile: d.readFile });
  } catch (err) {
    throw Object.assign(new Error(`${(err && err.code) || 'error'} held/`), { code: (err && err.code) || 'error', rel: 'held/' });
  }
}

function withoutNonce(record) {
  if (!record || typeof record !== 'object') return null;
  const rest = { ...record };
  delete rest.nonce;
  return rest;
}

/**
 * Pure. What the status route shows. `running` comes from liveness only — the stored value (the pessimistic
 * record stores `running: true`) is never passed through; a run that is not alive shows its stored text.
 */
function computeStatus({ report, alive, confirmation, now } = {}) {
  const running = !!alive && !!(report && report.latest);
  let pending = withoutNonce(confirmation);
  if (pending) {
    const expires = Date.parse(pending.expiresAt);
    pending = { ...pending, expired: Number.isFinite(expires) && Number.isFinite(now) ? now >= expires : false };
  }
  return {
    reportVersion: (report && report.reportVersion) || 1,
    running,
    latest: report && report.latest ? { ...report.latest, running } : null,
    previous: report && Array.isArray(report.previous) ? report.previous : [],
    confirmationPending: pending,
  };
}

/**
 * Pure. May the owner confirm this held report? Checks the posted run id's grammar, then its equality with the
 * latest report's, before any held file is touched. → { ok: true, runId, latest } | { ok: false, status, code, error }
 */
function validateConfirmation({ body, report, alive } = {}) {
  const runId = body && typeof body === 'object' ? body.runId : undefined;
  if (typeof runId !== 'string' || !RUN_ID_RE.test(runId)) {
    return { ok: false, status: 400, code: 'bad-run-id', error: 'runId must be a run id' };
  }
  const latest = report && report.latest;
  if (!latest || latest.runId !== runId) {
    return { ok: false, status: 409, code: 'not-the-latest-report', error: 'that run is not the latest report' };
  }
  if (latest.outcome !== 'done-removals-held' || !latest.held || !(latest.held.total > 0)) {
    return { ok: false, status: 409, code: 'nothing-held', error: 'the latest report holds no removals' };
  }
  if (alive) {
    return { ok: false, status: 409, code: 'running', error: 'that pass is still running' };
  }
  return { ok: true, runId, latest };
}

/**
 * The cross-site rule of src/api/dlist-curation/update.js:107-115 (ADR curated-dlist-update/0006), copied until
 * ledger row 326 (the house-wide cross-origin posture) centralises it. A browser always sends Origin on a
 * cross-site POST; with no Origin the request goes on to the other checks.
 */
function sameHost(req) {
  const headers = (req && req.headers) || {};
  if (headers.origin === undefined) return true;
  try {
    return new URL(String(headers.origin)).hostname.toLowerCase() === new URL(`http://${headers.host}`).hostname.toLowerCase();
  } catch {
    return false;
  }
}

function isJson(req) {
  const ct = req && req.headers ? req.headers['content-type'] : undefined;
  return typeof ct === 'string' && /^application\/json(\s*;|$)/i.test(ct.trim());
}

function fsError(res, err) {
  const code = (err && err.code) || 'error';
  const rel = err && err.rel ? ` ${err.rel}` : '';
  return res.status(500).json({ success: false, error: `could not read the pass's state: ${code}${rel}` });
}

/** GET /api/tagging-edges/status */
async function handleStatus(req, res, deps) {
  const d = withDeps(deps);
  try {
    const report = await readJson(d, 'report.json');
    // A side file that cannot be read must not hide the report (AC-7): say so in its place.
    let confirmation = null;
    try { confirmation = await readJson(d, 'confirmation.json'); } catch (err) { confirmation = { unreadable: (err && err.code) || 'error' }; }
    let alive = false;
    try { alive = !!(report && report.latest && (await d.isAlive(report.latest.process || report.latest))); } catch (_) { alive = false; }
    return res.json(computeStatus({ report, alive, confirmation, now: d.now() }));
  } catch (err) {
    return fsError(res, err);
  }
}

function parseNonNegativeInt(v, fallback) {
  if (v === undefined) return fallback;
  if (typeof v !== 'string' || !/^\d{1,9}$/.test(v)) return null;
  return Number(v);
}

/** GET /api/tagging-edges/held?runId=&offset=&limit≤1000 — the latest report's held list, and no other. */
async function handleHeld(req, res, deps) {
  const d = withDeps(deps);
  const q = (req && req.query) || {};
  if (q.runId !== undefined && (typeof q.runId !== 'string' || !RUN_ID_RE.test(q.runId))) {
    return res.status(400).json({ success: false, error: 'runId must be a run id' });
  }
  const offset = parseNonNegativeInt(q.offset, 0);
  const limit = parseNonNegativeInt(q.limit, HELD_PAGE_MAX);
  if (offset === null || limit === null || limit < 1 || limit > HELD_PAGE_MAX) {
    return res.status(400).json({ success: false, error: `offset must be a whole number and limit 1–${HELD_PAGE_MAX}` });
  }
  try {
    const report = await readJson(d, 'report.json');
    const latest = report && report.latest;
    if (!latest || typeof latest.runId !== 'string') return res.status(404).json({ success: false, error: 'no report yet' });
    if (q.runId !== undefined && q.runId !== latest.runId) {
      return res.status(404).json({ success: false, error: 'that run is not the latest report', latestRunId: latest.runId });
    }
    const heldTotal = latest.held && Number.isInteger(latest.held.total) ? latest.held.total : 0;
    let list = [];
    if (heldTotal > 0) {
      if (!RUN_ID_RE.test(latest.runId)) return res.status(404).json({ success: false, error: 'no held list' });
      list = await readHeld(d, latest.runId);
      if (list === null) return res.status(404).json({ success: false, error: 'the held list is gone' });
    }
    return res.json({
      success: true,
      runId: latest.runId,
      outcome: latest.outcome,
      digest: latest.held ? latest.held.digest || null : null,
      total: list.length,
      offset,
      limit,
      items: list.slice(offset, offset + limit),
    });
  } catch (err) {
    return fsError(res, err);
  }
}

/** POST /api/tagging-edges/confirm-held-removals { runId } — owner only. */
async function handleConfirmHeldRemovals(req, res, deps) {
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

  const body = req.body;
  const runId = body && typeof body === 'object' ? body.runId : undefined;
  if (typeof runId !== 'string' || !RUN_ID_RE.test(runId)) {
    return res.status(400).json({ success: false, error: 'runId must be a run id' });
  }

  try {
    const report = await readJson(d, 'report.json');
    const pre = validateConfirmation({ body, report, alive: false });
    if (!pre.ok) return res.status(pre.status).json({ success: false, code: pre.code, error: pre.error });
    let alive = false;
    try { alive = !!(report && report.latest && (await d.isAlive(report.latest.process || report.latest))); } catch (_) { alive = false; }
    const v = validateConfirmation({ body, report, alive });
    if (!v.ok) return res.status(v.status).json({ success: false, code: v.code, error: v.error });

    const list = await readHeld(d, v.latest.runId);
    if (list === null || d.heldDigest(list) !== v.latest.held.digest) {
      return res.status(409).json({ success: false, code: 'held-list-changed', error: 'the held list does not match its report' });
    }

    const mintedAtMs = d.now();
    const record = {
      version: 1,
      runId: v.runId,
      heldDigest: v.latest.held.digest,
      heldCount: list.length,
      nonce: d.nonce(),
      mintedAt: new Date(mintedAtMs).toISOString(),
      expiresAt: new Date(mintedAtMs + CONFIRMATION_TTL_MS).toISOString(),
      mintedBy: owner.slice(0, 8),
    };
    try {
      await d.writeConfirmation(record);
    } catch (err) {
      return res.status(500).json({ success: false, error: `could not write the confirmation: ${(err && err.code) || 'error'} confirmation.json` });
    }

    // A pass that started meanwhile: withdraw the record, unless that pass already claimed it.
    const after = await readJson(d, 'report.json');
    const afterLatest = after && after.latest;
    if (!afterLatest || afterLatest.runId !== v.runId) {
      let withdrawn;
      try {
        withdrawn = await d.withdrawConfirmation();
      } catch (err) {
        // The record may still be pending, and the pass that started may honour it (owner decision 6).
        return res.status(500).json({ success: false, code: 'withdraw-failed', error: `a pass started and the confirmation could not be withdrawn (${(err && err.code) || 'error'}); that pass may honour it — read its report` });
      }
      if (!withdrawn) {
        return res.json({ success: true, confirmed: true, enqueued: false, claimedBy: afterLatest ? afterLatest.runId : null, expiresAt: record.expiresAt });
      }
      return res.status(409).json({ success: false, code: 'pass-started', error: 'a pass started; confirm its report when it ends' });
    }

    let enqueued = false;
    let jobId;
    try {
      if (await d.isQueueAvailable()) {
        const out = await d.runViaQueueAsync({ taskName: TASK_NAME, timeoutMs: d.taskTimeoutMs() });
        enqueued = !!(out && out.success !== false);
        jobId = out && out.jobId ? out.jobId : undefined;
      }
    } catch (err) {
      console.warn(`[tagging-edges] confirmation recorded but not enqueued: ${(err && err.code) || 'error'}`);
      enqueued = false;
    }
    const answer = { success: true, confirmed: true, enqueued, expiresAt: record.expiresAt };
    if (jobId !== undefined) answer.jobId = jobId;
    return res.json(answer);
  } catch (err) {
    return fsError(res, err);
  }
}

module.exports = {
  TASK_NAME,
  computeStatus,
  validateConfirmation,
  sameHost,
  isJson,
  handleStatus,
  handleHeld,
  handleConfirmHeldRemovals,
};
