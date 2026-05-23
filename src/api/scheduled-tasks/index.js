/**
 * Scheduled Tasks API — generalized, durable scheduling (story #22 / ADR 0019).
 *
 * Recurring scheduling is now served by BullMQ Job Schedulers attached to each
 * task's existing queue (see ../../manage/taskQueue/queue/scheduler.js), NOT an
 * in-process setInterval. This module owns the operator-facing config (which
 * tasks, enabled?, interval/cron) — the SOURCE OF TRUTH — persisted in
 * /var/lib/brainstorm/scheduled-tasks.json, and reconciles it into Job
 * Schedulers on boot and on every update.
 *
 * Generalized from ADR 0003's hardcoded task set: ANY task in the registry can
 * be scheduled. Schema (backward-compatible): per task
 *   { enabled, intervalDays?, intervalHours?, intervalMinutes?, cron? }
 * — cron wins; otherwise days/hours/minutes sum to an interval. No 1-hour floor.
 */

const fs = require('fs');
const path = require('path');
const brainstormConfig = require('../../utils/brainstormConfig');

const CONFIG_PATH = '/var/lib/brainstorm/scheduled-tasks.json';
const EVENTS_PATH = '/var/log/brainstorm/taskQueue/events.jsonl';

// ── Task registry (the schedulable-task universe — replaces ADR 0003's DEFAULTS) ──

let _registry = null;
function loadRegistry() {
  if (_registry) return _registry;
  try {
    const registryPath = path.join(
      brainstormConfig.get('BRAINSTORM_MODULE_MANAGE_DIR'),
      'taskQueue/taskRegistry.json'
    );
    _registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  } catch (e) {
    console.error('[scheduled-tasks] Could not load taskRegistry.json:', e.message);
    _registry = { tasks: {} };
  }
  return _registry;
}

function isRegisteredTask(taskId) {
  const reg = loadRegistry();
  return Boolean(taskId) && Boolean(reg.tasks && reg.tasks[taskId]);
}

// Lazy require — pulls in BullMQ via the queue module only when scheduling runs
// (gated by TASK_QUEUE_ENABLED at the call sites), keeping module load cheap.
function scheduler() {
  return require('../../manage/taskQueue/queue/scheduler');
}

// ── Config read/write ───────────────────────────────────────

function readConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (e) {
    console.error('[scheduled-tasks] Error reading config:', e.message);
  }
  return {};
}

function writeConfig(config) {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function getTaskConfig(taskId) {
  const config = readConfig();
  return config[taskId] || { enabled: false, intervalDays: 0, intervalHours: 0, intervalMinutes: 0, cron: '' };
}

// ── Boot reconcile (replaces the old setInterval initScheduler) ──

/**
 * Read the persisted config + registry and reconcile into BullMQ Job
 * Schedulers. Called once at control-panel boot (gated by TASK_QUEUE_ENABLED,
 * since it needs the queue initialized).
 */
async function reconcileSchedulesFromConfig() {
  const config = readConfig();
  const registry = loadRegistry();
  return scheduler().reconcileSchedules(config, registry);
}

// ── Task execution history (events.jsonl — unchanged from ADR 0003) ──

function getRecentRuns(taskName, maxRuns = 5) {
  const runs = [];
  try {
    if (!fs.existsSync(EVENTS_PATH)) return runs;
    const lines = fs.readFileSync(EVENTS_PATH, 'utf8').trim().split('\n').filter(Boolean);
    const starts = [];
    const ends = [];
    for (const line of lines) {
      try {
        const rec = JSON.parse(line);
        if (rec.taskName !== taskName) continue;
        if (rec.eventType === 'TASK_START') starts.push(rec);
        else if (rec.eventType === 'TASK_END') ends.push(rec);
      } catch { /* skip bad lines */ }
    }
    for (let i = starts.length - 1; i >= 0 && runs.length < maxRuns; i--) {
      const start = starts[i];
      let matchedEnd = null;
      for (const end of ends) {
        if (new Date(end.timestamp) > new Date(start.timestamp)) { matchedEnd = end; break; }
      }
      runs.push({
        startedAt: start.timestamp,
        endedAt: matchedEnd ? matchedEnd.timestamp : null,
        durationMs: matchedEnd ? matchedEnd.duration : null,
        status: matchedEnd ? (matchedEnd.failure ? 'failed' : 'success') : 'running',
        exitCode: matchedEnd ? matchedEnd.exitCode : null,
      });
    }
  } catch (e) {
    console.error('[scheduled-tasks] Error reading history:', e.message);
  }
  return runs;
}

// ── Helpers ─────────────────────────────────────────────────

function unknownTask(res, taskId) {
  return res.status(400).json({
    success: false,
    error: `Unknown or unregistered taskId: ${taskId}. Schedulable tasks come from the task registry.`,
  });
}

async function nextRunSafe(taskId) {
  try { return await scheduler().getNextRun(taskId); }
  catch (_e) { return null; }
}

// ── API Handlers ────────────────────────────────────────────

async function handleStatus(req, res) {
  const taskId = req.query.taskId;
  if (!isRegisteredTask(taskId)) return unknownTask(res, taskId);
  const cfg = getTaskConfig(taskId);
  const nextRunAt = await nextRunSafe(taskId);
  const runs = getRecentRuns(taskId, 1);
  return res.json({
    success: true,
    taskId,
    schedule: {
      enabled: !!cfg.enabled,
      intervalDays: cfg.intervalDays || 0,
      intervalHours: cfg.intervalHours || 0,
      intervalMinutes: cfg.intervalMinutes || 0,
      cron: cfg.cron || '',
    },
    timer: {
      active: !!nextRunAt,
      nextRunAt,
      lastRunAt: runs[0] ? runs[0].startedAt : null,
    },
  });
}

async function handleUpdate(req, res) {
  try {
    const { taskId, enabled, intervalDays, intervalHours, intervalMinutes, cron } = req.body;
    if (!isRegisteredTask(taskId)) return unknownTask(res, taskId);

    const entry = {
      enabled: !!enabled,
      intervalDays: parseInt(intervalDays) || 0,
      intervalHours: parseInt(intervalHours) || 0,
      intervalMinutes: parseInt(intervalMinutes) || 0,
      cron: typeof cron === 'string' ? cron.trim() : '',
    };
    if (entry.intervalDays < 0 || entry.intervalHours < 0 || entry.intervalMinutes < 0) {
      return res.status(400).json({ success: false, error: 'Interval values must be non-negative' });
    }
    // No 1-hour floor (ADR 0019) — but an enabled schedule must specify SOMETHING.
    if (entry.enabled && !scheduler().isValidSchedule(entry)) {
      return res.status(400).json({ success: false, error: 'Enabled schedule needs a cron expression or a positive interval' });
    }

    const config = readConfig();
    config[taskId] = entry;
    writeConfig(config);

    // Reconcile just this task's Job Scheduler.
    try {
      if (entry.enabled) await scheduler().upsertSchedule(taskId, entry, loadRegistry());
      else await scheduler().removeSchedule(taskId);
    } catch (e) {
      return res.status(503).json({ success: false, error: `Scheduling unavailable (task queue not initialized?): ${e.message}` });
    }

    const nextRunAt = await nextRunSafe(taskId);
    const spec = entry.cron ? `cron "${entry.cron}"` : `every ${entry.intervalDays}d ${entry.intervalHours}h ${entry.intervalMinutes}m`;
    return res.json({
      success: true,
      message: entry.enabled ? `${taskId} enabled: ${spec}` : `${taskId} disabled`,
      taskId,
      schedule: entry,
      timer: { active: !!nextRunAt, nextRunAt, lastRunAt: null },
    });
  } catch (err) {
    console.error('[scheduled-tasks] Error updating:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

function handleHistory(req, res) {
  const taskId = req.query.taskId;
  if (!isRegisteredTask(taskId)) return unknownTask(res, taskId);
  return res.json({ success: true, taskId, runs: getRecentRuns(taskId, 5) });
}

/**
 * List every schedulable (registered) task with its current schedule + next/last
 * run. Drives the generalized Scheduled Tasks UI panel (ADR 0019).
 */
async function handleList(req, res) {
  const reg = loadRegistry();
  const config = readConfig();
  const out = [];
  for (const taskId of Object.keys(reg.tasks || {})) {
    const def = reg.tasks[taskId] || {};
    const cfg = config[taskId] || {};
    const nextRunAt = await nextRunSafe(taskId);
    const runs = getRecentRuns(taskId, 1);
    out.push({
      taskId,
      name: def.name || taskId,
      categories: def.categories || [],
      resourceClass: def.resourceClass || null,
      schedule: {
        enabled: !!cfg.enabled,
        intervalDays: cfg.intervalDays || 0,
        intervalHours: cfg.intervalHours || 0,
        intervalMinutes: cfg.intervalMinutes || 0,
        cron: cfg.cron || '',
      },
      timer: { active: !!nextRunAt, nextRunAt, lastRunAt: runs[0] ? runs[0].startedAt : null },
    });
  }
  return res.json({ success: true, tasks: out });
}

module.exports = {
  handleStatus,
  handleUpdate,
  handleHistory,
  handleList,
  reconcileSchedulesFromConfig,
  // exported for testability / reuse
  readConfig,
  isRegisteredTask,
  getRecentRuns,
};
