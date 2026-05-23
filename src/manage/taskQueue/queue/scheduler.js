/**
 * Generalized task scheduler — BullMQ Job Schedulers on the per-task queues.
 * Story #22 / ADR 0019. Replaces the in-process setInterval scheduler.
 *
 * Recurring scheduling = a durable BullMQ Job Scheduler attached to each
 * scheduled task's existing queue (from ADR 0012). On each tick BullMQ adds a
 * job to that queue → the existing Worker → processor.processJob →
 * launchChildTask, so the neo4j-heavy semaphore, per-task concurrency, jobId
 * behavior, and BullBoard all apply for free.
 *
 * The schedule config file (scheduled-tasks.json, owned by
 * src/api/scheduled-tasks) is the SOURCE OF TRUTH; Job Schedulers in Redis are
 * the EXECUTION layer. reconcileSchedules() upserts/removes schedulers to match
 * the config and cleans up orphans, so the file stays authoritative across
 * restarts and even a Redis flush.
 */

const fs = require('fs');
const taskQueue = require('./index'); // getQueue, getAllQueues — the per-task BullMQ queues (ADR 0012)

const QUEUE_CONFIG_PATH = '/etc/brainstorm-task-queue.json';
const SCHEDULER_PREFIX = 'sched:';

/**
 * Kill-switch (ADR 0019 Q1). /etc/brainstorm-task-queue.json { "scheduler": false }
 * halts all scheduling. Default true (absent/unreadable → on).
 */
function schedulerEnabled() {
  try {
    if (fs.existsSync(QUEUE_CONFIG_PATH)) {
      const raw = JSON.parse(fs.readFileSync(QUEUE_CONFIG_PATH, 'utf8'));
      if (raw && raw.scheduler === false) return false;
    }
  } catch (_e) { /* default on */ }
  return true;
}

function schedulerId(taskId) { return `${SCHEDULER_PREFIX}${taskId}`; }

/**
 * Convert a schedule config entry to BullMQ repeat options.
 *   cron wins; otherwise sum days/hours/minutes → `every` ms (sub-hour OK).
 */
function toRepeatOpts(cfg) {
  if (cfg && cfg.cron && String(cfg.cron).trim()) return { pattern: String(cfg.cron).trim() };
  const minutes =
    (Number(cfg && cfg.intervalDays) || 0) * 24 * 60 +
    (Number(cfg && cfg.intervalHours) || 0) * 60 +
    (Number(cfg && cfg.intervalMinutes) || 0);
  return { every: minutes * 60000 };
}

/** A config entry is a runnable schedule iff it has a cron or a positive interval. No 1-hour floor. */
function isValidSchedule(cfg) {
  if (cfg && cfg.cron && String(cfg.cron).trim()) return true;
  return toRepeatOpts(cfg).every > 0;
}

/** Upsert one task's Job Scheduler on its queue. */
async function upsertSchedule(taskId, cfg, registry) {
  const queue = taskQueue.getQueue(taskId);
  if (!queue) throw new Error(`No BullMQ queue for task '${taskId}' (not a registered task, or queue not initialized)`);
  const taskDef = registry && registry.tasks && registry.tasks[taskId];
  const timeoutMs =
    (taskDef && taskDef.options && taskDef.options.completion &&
      taskDef.options.completion.failure && taskDef.options.completion.failure.timeout &&
      taskDef.options.completion.failure.timeout.duration) || 0;
  // The scheduled job carries only taskName + timeoutMs; the Worker's closed-over
  // taskDef + processor.buildChildArgs supply staticArgs (e.g. reconcileAll's --mode all).
  await queue.upsertJobScheduler(
    schedulerId(taskId),
    toRepeatOpts(cfg),
    { name: taskId, data: { taskName: taskId, timeoutMs } }
  );
}

/** Remove one task's Job Scheduler (no-op if absent). */
async function removeSchedule(taskId) {
  const queue = taskQueue.getQueue(taskId);
  if (!queue) return;
  try { await queue.removeJobScheduler(schedulerId(taskId)); } catch (_e) { /* not present */ }
}

/** Next-run ISO timestamp for a task (from its Job Scheduler), or null. */
async function getNextRun(taskId) {
  const queue = taskQueue.getQueue(taskId);
  if (!queue) return null;
  try {
    const schedulers = await queue.getJobSchedulers();
    const mine = schedulers.find(s => (s.key || s.id) === schedulerId(taskId));
    return mine && mine.next ? new Date(Number(mine.next)).toISOString() : null;
  } catch (_e) { return null; }
}

/** Remove every sched:* Job Scheduler this module manages, across all queues. */
async function removeAllManaged() {
  for (const queue of taskQueue.getAllQueues()) {
    try {
      const schedulers = await queue.getJobSchedulers();
      for (const s of schedulers) {
        const key = s.key || s.id || '';
        if (key.startsWith(SCHEDULER_PREFIX)) await queue.removeJobScheduler(key).catch(() => {});
      }
    } catch (_e) { /* skip */ }
  }
}

/**
 * Reconcile the persisted config → Job Schedulers (file is authoritative).
 *   - kill-switch off → remove all managed schedulers, upsert none.
 *   - enabled + valid + registered entry → upsert.
 *   - disabled/invalid/unregistered entry → remove.
 *   - orphan sched:* schedulers not enabled in the config → remove.
 */
async function reconcileSchedules(config, registry) {
  if (!schedulerEnabled()) {
    await removeAllManaged();
    console.log('[scheduler] kill-switch off (brainstorm-task-queue.json scheduler:false) — scheduling halted');
    return { upserted: 0, removed: 'all' };
  }

  const entries = Object.entries(config || {});
  let upserted = 0;
  const enabledIds = new Set();
  for (const [taskId, cfg] of entries) {
    const registered = !!(registry && registry.tasks && registry.tasks[taskId]);
    if (cfg && cfg.enabled && isValidSchedule(cfg) && registered) {
      await upsertSchedule(taskId, cfg, registry);
      enabledIds.add(taskId);
      upserted++;
    } else {
      await removeSchedule(taskId);
    }
  }

  // Orphan cleanup: drop any sched:* scheduler not currently enabled in the config.
  for (const queue of taskQueue.getAllQueues()) {
    try {
      const schedulers = await queue.getJobSchedulers();
      for (const s of schedulers) {
        const key = s.key || s.id || '';
        if (key.startsWith(SCHEDULER_PREFIX)) {
          const taskId = key.slice(SCHEDULER_PREFIX.length);
          if (!enabledIds.has(taskId)) await queue.removeJobScheduler(key).catch(() => {});
        }
      }
    } catch (_e) { /* skip */ }
  }

  console.log(`[scheduler] reconciled ${upserted} enabled schedule(s) into BullMQ Job Schedulers`);
  return { upserted };
}

module.exports = {
  schedulerEnabled,
  schedulerId,
  toRepeatOpts,
  isValidSchedule,
  upsertSchedule,
  removeSchedule,
  getNextRun,
  reconcileSchedules,
  removeAllManaged,
};
