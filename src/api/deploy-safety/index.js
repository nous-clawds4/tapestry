/**
 * Deploy-Safety Status API — epic deploy-safety-gate, Story 1 / ADR 0001.
 *
 * One unauthenticated read-only GET (/api/deploy-safety/status) answering
 * "is it safe to redeploy this instance right now?" by aggregating three
 * LIVE in-process sources:
 *
 *   1. BullMQ ACTIVE jobs (scheduled fires and manual run-task triggers
 *      alike) — only active jobs have a child process a deploy would kill.
 *   2. The legacy per-customer scheduler's in-flight runs
 *      (customer-schedule getInFlightCount()).
 *   3. The next fire among all enabled scheduled entries, gated by a buffer
 *      (ratified default: 10 minutes).
 *
 * AC-3 (phantom-running exclusion) holds STRUCTURALLY: this module must
 * never read the task-event history file — a deploy-killed task leaves an
 * orphaned TASK_START there and reads "running" for hours. Running-now
 * comes from live state only. A source sentinel in
 * test/deploy-safety-status.test.js (S1) enforces this.
 *
 * The verdict is computed by the exported pure function computeVerdict()
 * so AC-3/AC-4 have stack-free unit tests. This module must stay
 * requireable without Redis: the queue module is lazy-required inside the
 * handler, only when TASK_QUEUE_ENABLED is true.
 */

const brainstormConfig = require('../../utils/brainstormConfig');

// Ratified 10-minute default buffer (story AC-4 / product decision 1).
const DEFAULT_BUFFER_MS = 10 * 60 * 1000;
const MAX_BUFFER_MINUTES = 1440;

/**
 * Pure verdict core (ADR 0001 §Implementation notes).
 *
 * @param {object} input
 * @param {number} input.now                 epoch ms
 * @param {number} input.bufferMs            effective buffer width
 * @param {boolean} input.queueEnabled       TASK_QUEUE_ENABLED
 * @param {boolean} input.queueStateKnown    queue introspection succeeded
 * @param {number} input.activeCount         BullMQ active jobs (both trigger paths)
 * @param {number} input.legacyInFlightCount legacy per-customer runs in flight
 * @param {Array<{entryId, taskId, label, at}>} input.nextFires
 *        enabled entries with a non-null next run (ISO `at`)
 * @returns {{ safeToDeploy: boolean, verdict: string, reasons: string[], nextFire: object|null }}
 */
function computeVerdict({ now, bufferMs, queueEnabled, queueStateKnown, activeCount, legacyInFlightCount, nextFires }) {
  const reasons = [];
  if (activeCount > 0) reasons.push('QUEUE_TASK_RUNNING');
  if (legacyInFlightCount > 0) reasons.push('LEGACY_TASK_RUNNING');
  // Fail closed: an ENABLED queue whose state is unknown blocks the deploy.
  // A disabled queue is a known state, not an unavailable one (AC-5).
  if (queueEnabled && !queueStateKnown) reasons.push('QUEUE_STATE_UNAVAILABLE');

  // Min-`at` among the enabled entries' next fires, decorated with the
  // time remaining and whether it lands within the buffer.
  let nextFire = null;
  for (const f of nextFires || []) {
    if (!f || !f.at) continue;
    if (!nextFire || Date.parse(f.at) < Date.parse(nextFire.at)) nextFire = f;
  }
  if (nextFire) {
    const inMs = Date.parse(nextFire.at) - now;
    nextFire = { ...nextFire, inMs, withinBuffer: inMs <= bufferMs };
  }

  // AC-4: with nothing running (and the queue state known), the next fire
  // landing within the buffer makes the verdict unsafe.
  if (reasons.length === 0 && nextFire && nextFire.withinBuffer) {
    reasons.push('NEXT_FIRE_WITHIN_BUFFER');
  }

  const verdict = reasons.length === 0 ? 'safe' : 'unsafe';
  return { safeToDeploy: verdict === 'safe', verdict, reasons, nextFire };
}

/**
 * GET /api/deploy-safety/status[?bufferMinutes=<n>]
 * Read-only and repeatable: only Redis reads (ping, active jobs, job
 * schedulers), a config-file read, and in-memory Map iteration. Nothing
 * is enqueued, upserted, or removed.
 */
async function handleStatus(req, res) {
  try {
    let bufferMs = DEFAULT_BUFFER_MS;
    if (req.query.bufferMinutes !== undefined) {
      const n = Number(req.query.bufferMinutes);
      if (!Number.isFinite(n) || n <= 0 || n > MAX_BUFFER_MINUTES) {
        // Fail loudly (ADR sub-decision 2): a typo must never silently gate
        // at the wrong width.
        return res.status(400).json({
          success: false,
          error: `Invalid bufferMinutes '${req.query.bufferMinutes}' — must be a number > 0 and <= ${MAX_BUFFER_MINUTES}`,
        });
      }
      bufferMs = n * 60 * 1000;
    }

    const now = Date.now();
    const queueEnabled = brainstormConfig.get('TASK_QUEUE_ENABLED') === 'true';

    // Enabled schedule entries — file-backed, readable regardless of queue
    // state (readConfig never writes on the read path).
    let enabledEntries = [];
    try {
      const config = require('../scheduled-tasks').readConfig();
      enabledEntries = (config.entries || []).filter((e) => e && e.enabled);
    } catch (_e) { /* unreadable config → no enabled entries */ }

    let queueStateKnown = false;
    let activeCount = 0;
    let activeTasks = [];
    let schedulerHalted = false;
    const nextFires = [];

    if (queueEnabled) {
      try {
        // Lazy require — pulls in BullMQ/Redis only when the queue layer is
        // enabled (the scheduled-tasks scheduler() pattern). Never required
        // at module init: this route registers unconditionally.
        const taskQueue = require('../../manage/taskQueue/queue');
        if (await taskQueue.isQueueAvailable()) {
          const queues = taskQueue.getAllQueues();
          const activeLists = await Promise.all(queues.map((q) => q.getActive()));
          for (const job of activeLists.flat()) {
            // Names and start times ONLY — no job ids, no job.data, no
            // pubkeys on this unauthenticated surface (ADR sub-decision 4).
            activeTasks.push({
              taskName: job.name,
              startedAt: new Date(job.processedOn || job.timestamp).toISOString(),
            });
          }
          activeCount = activeTasks.length;

          const schedulerMod = require('../../manage/taskQueue/queue/scheduler');
          schedulerHalted = !schedulerMod.schedulerEnabled();
          for (const entry of enabledEntries) {
            let at = null;
            try { at = await schedulerMod.getNextRun(entry.id, entry.taskId); }
            catch (_e) { at = null; }
            if (at) {
              nextFires.push({
                entryId: entry.id,
                taskId: entry.taskId,
                label: entry.label || entry.taskId,
                at,
              });
            }
          }
          queueStateKnown = true;
        }
      } catch (e) {
        // Fail closed (ADR sub-decision 5): introspection failure while the
        // queue is enabled → unknown state → unsafe, never a 500.
        console.warn(`[deploy-safety] Queue introspection failed: ${e.message}`);
        queueStateKnown = false;
      }
    }

    // Legacy per-customer scheduler — in-process memory; cleared by any
    // container restart, so this source cannot phantom (AC-3).
    const legacyInFlightCount = require('../customer-schedule').getInFlightCount();

    const { safeToDeploy, verdict, reasons, nextFire } = computeVerdict({
      now,
      bufferMs,
      queueEnabled,
      queueStateKnown,
      activeCount,
      legacyInFlightCount,
      nextFires,
    });

    const queue = queueEnabled
      ? (queueStateKnown
        ? { enabled: true, stateKnown: true, activeCount, activeTasks, schedulerHalted }
        : { enabled: true, stateKnown: false })
      : { enabled: false };

    return res.json({
      success: true,
      safeToDeploy,
      verdict,
      reasons,
      checkedAt: new Date(now).toISOString(),
      bufferMs,
      queue,
      legacy: { inFlightCount: legacyInFlightCount },
      schedule: { enabledEntryCount: enabledEntries.length, nextFire },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  computeVerdict,
  handleStatus,
};
