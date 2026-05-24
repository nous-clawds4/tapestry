/**
 * Generalized task scheduler — BullMQ Job Schedulers on the per-task queues.
 * Story #22 / ADR 0019 (per-task), extended by story #24 / ADR 0021 (per-entry).
 *
 * ADR 0019 attached one Job Scheduler per registry task. ADR 0021 extends that
 * to one Job Scheduler per scheduled ENTRY, keyed `sched:${entry.id}` instead
 * of `sched:${taskId}`, so an operator can schedule the same task multiple
 * times (e.g., processCustomer for Alice every 6h AND for Bob every 24h).
 * Each entry's Job Scheduler lives on the same per-task BullMQ queue (the
 * task's queue from ADR 0012); BullMQ ticks each scheduler independently.
 *
 * Args are NOT resolved at upsert time — the Job Scheduler's job template
 * carries only { taskName, entryId, timeoutMs }. The processor's
 * `if (entryId)` branch loads the entry + resolves args FRESH at every
 * fire via entryResolver, so a rename surfaces immediately and a missing
 * referent triggers authoritative auto-disable at the next fire (not next
 * boot).
 *
 * CRITICAL layering note (ADR 0021 §Decision): this module is the
 * scheduling layer; it does NOT do per-entry data lookups or maintain
 * any per-entry runtime state. All such concerns live in entryResolver.
 * Test T17 / T18 are the anti-pattern guards — they assert this module's
 * source does not pack per-entry resolved data into the job template.
 */

const fs = require('fs');
const taskQueue = require('./index'); // getQueue, getAllQueues — per-task BullMQ queues (ADR 0012)

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

/** schedulerId is now per-entry (ADR 0021), not per-task (ADR 0019). */
function schedulerId(entryId) { return `${SCHEDULER_PREFIX}${entryId}`; }

/**
 * Convert a schedule config entry to BullMQ repeat options.
 *   cron wins; otherwise sum days/hours/minutes → `every` ms (sub-hour OK).
 * Unchanged from ADR 0019 — entry has the same schedule field surface as
 * the per-task shape it replaces.
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

/**
 * Upsert one entry's Job Scheduler on its task's queue. ADR 0021.
 *
 * The job template's data payload is intentionally minimal:
 *   { taskName, entryId, timeoutMs }
 *
 * No per-entry args or query params — those are resolved FRESH at fire time
 * by the processor's `if (entryId)` branch via entryResolver. This is the
 * load-bearing layering choice from ADR 0021 §Option A.
 */
async function upsertSchedule(entry, registry) {
  const queue = taskQueue.getQueue(entry.taskId);
  if (!queue) {
    throw new Error(`No BullMQ queue for task '${entry.taskId}' (not a registered task, or queue not initialized)`);
  }
  const taskDef = registry && registry.tasks && registry.tasks[entry.taskId];
  const timeoutMs =
    (taskDef && taskDef.options && taskDef.options.completion &&
      taskDef.options.completion.failure && taskDef.options.completion.failure.timeout &&
      taskDef.options.completion.failure.timeout.duration) || 0;

  await queue.upsertJobScheduler(
    schedulerId(entry.id),
    toRepeatOpts(entry),
    {
      name: entry.taskId,
      data: { taskName: entry.taskId, entryId: entry.id, timeoutMs },
    }
  );
}

/**
 * Remove one entry's Job Scheduler. The taskId hint avoids an O(N) queue
 * scan in the common case where the caller still holds the entry; when
 * omitted (e.g., entry was already deleted from config), we scan all
 * queues to find the right one. No-op if absent.
 */
async function removeSchedule(entryId, taskId) {
  const tryQueue = async (queue) => {
    try { await queue.removeJobScheduler(schedulerId(entryId)); } catch (_e) { /* not present */ }
  };

  if (taskId) {
    const queue = taskQueue.getQueue(taskId);
    if (queue) return tryQueue(queue);
  }

  // Fall-through: caller didn't supply a hint, or the hint resolved to no queue.
  // Scan all queues — bounded by the number of registered tasks.
  for (const queue of taskQueue.getAllQueues()) {
    await tryQueue(queue);
  }
}

/**
 * Next-run ISO timestamp for an entry's Job Scheduler, or null. Optional
 * taskId hint avoids the O(N) scan.
 */
async function getNextRun(entryId, taskId) {
  const find = async (queue) => {
    try {
      const schedulers = await queue.getJobSchedulers();
      const mine = schedulers.find(s => (s.key || s.id) === schedulerId(entryId));
      return mine && mine.next ? new Date(Number(mine.next)).toISOString() : null;
    } catch (_e) { return null; }
  };

  if (taskId) {
    const queue = taskQueue.getQueue(taskId);
    if (queue) return find(queue);
  }
  for (const queue of taskQueue.getAllQueues()) {
    const next = await find(queue);
    if (next) return next;
  }
  return null;
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
 * Per ADR 0021 the iteration shape is per-entry (config.entries array)
 * instead of ADR 0019's per-task (Object.entries(config)).
 *
 *   - kill-switch off → remove all managed schedulers, upsert none.
 *   - enabled + valid-schedule + registered-task entry → upsert.
 *   - disabled/invalid/unregistered entry → remove.
 *   - orphan sched:* schedulers not currently enabled in the config → remove.
 *
 * IMPORTANT: this function does NOT do per-entry-data lookups. ADR 0021
 * moved all such checks (e.g., customer existence) to fire time (in
 * entryResolver). Reintroducing an upsert-time lookup here is Option D
 * (rejected). Test T17 is the anti-pattern guard.
 */
async function reconcileSchedules(config, registry) {
  if (!schedulerEnabled()) {
    await removeAllManaged();
    console.log('[scheduler] kill-switch off (brainstorm-task-queue.json scheduler:false) — scheduling halted');
    return { upserted: 0, removed: 'all' };
  }

  // Defensive: tolerate both shapes during the very first boot after
  // ADR 0021 deploy — the migrator should normally hand us v2 already.
  const entries = Array.isArray(config && config.entries)
    ? config.entries
    : [];

  let upserted = 0;
  const enabledIds = new Set();
  for (const entry of entries) {
    const registered = !!(registry && registry.tasks && registry.tasks[entry.taskId]);
    if (entry && entry.enabled && isValidSchedule(entry) && registered) {
      await upsertSchedule(entry, registry);
      enabledIds.add(entry.id);
      upserted++;
    } else {
      await removeSchedule(entry.id, entry && entry.taskId);
    }
  }

  // Orphan cleanup: drop any sched:* scheduler whose entryId isn't currently
  // enabled in the config. Strips the `sched:` prefix and tests against
  // entryIds (NOT taskIds as in ADR 0019).
  for (const queue of taskQueue.getAllQueues()) {
    try {
      const schedulers = await queue.getJobSchedulers();
      for (const s of schedulers) {
        const key = s.key || s.id || '';
        if (key.startsWith(SCHEDULER_PREFIX)) {
          const entryId = key.slice(SCHEDULER_PREFIX.length);
          if (!enabledIds.has(entryId)) await queue.removeJobScheduler(key).catch(() => {});
        }
      }
    } catch (_e) { /* skip */ }
  }

  console.log(`[scheduler] reconciled ${upserted} enabled schedule(s) into BullMQ Job Schedulers (per-entry, ADR 0021)`);
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
