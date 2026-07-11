/**
 * Scheduled Tasks API — per-entry scheduling (story #24 / ADR 0021).
 *
 * Replaces ADR 0019's per-task shape with per-entry: each scheduled entry
 * has its own id, taskId, label, args, and schedule. Multiple entries can
 * share a taskId (e.g., processCustomer for Alice every 6h, for Bob every
 * 24h), each with independent args and an independent Job Scheduler keyed
 * `sched:${entry.id}`.
 *
 * The persisted config at /var/lib/brainstorm/scheduled-tasks.json is the
 * SOURCE OF TRUTH; BullMQ Job Schedulers in Redis are the EXECUTION layer.
 * This module owns the operator-facing CRUD + reconcile-on-boot; the
 * scheduler.js module owns the BullMQ Job Scheduler interaction.
 *
 * v2 on-disk shape:
 *   { version: 2, entries: [{ id, taskId, label, args, enabled,
 *       intervalDays, intervalHours, intervalMinutes, cron, lastError? }, ...] }
 *
 * readConfig() pipes through migrateConfigIfNeeded so v1 (ADR 0019's
 * `{ [taskId]: schedule }` shape) auto-upgrades on first read with stable
 * `legacy:<taskId>` IDs.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const brainstormConfig = require('../../utils/brainstormConfig');
const { migrateConfigIfNeeded } = require('./migration');
const { validateEntry } = require('./validation');

// Env-overridable for tests (mirror of settings.js's TAPESTRY_SETTINGS_PATH).
const CONFIG_PATH = process.env.SCHEDULED_TASKS_CONFIG_PATH
  || '/var/lib/brainstorm/scheduled-tasks.json';
const EVENTS_PATH = '/var/log/brainstorm/taskQueue/events.jsonl';

// ADR tag-stack-merge-hardening/0001 (AC-7): a fresh deployment ships these
// schedule entries, DISABLED. Matches every other scheduled task's default
// (operator opts in) and keeps stale-TL retraction dormant until enabled.
// Seeded only when the config file does not yet exist — never resurrected
// after a user deletes entries.
function freshInstallEntries(registry) {
  const taskId = 'refreshPinnedTagTLs';
  const label = (registry && registry.tasks && registry.tasks[taskId] && registry.tasks[taskId].name) || taskId;
  return [{
    id: `seed:${taskId}`,
    taskId,
    label,
    args: {},
    enabled: false,
    intervalDays: 1,
    intervalHours: 0,
    intervalMinutes: 0,
    cron: '',
  }];
}

// ── Registry access ───────────────────────────────────────────────────

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

// Lazy require — pulls in BullMQ via the queue module only when scheduling
// is actually invoked (gated by TASK_QUEUE_ENABLED at the call sites).
function scheduler() {
  return require('../../manage/taskQueue/queue/scheduler');
}

// ── Config read/write ──────────────────────────────────────────────────

function readConfig() {
  let parsed = null;
  let fileExisted = false;
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      fileExisted = true;
      parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    }
  } catch (e) {
    console.error('[scheduled-tasks] Error reading config:', e.message);
  }
  // Always pipe through the migrator — idempotent on v2, transparently
  // upgrades v1 (ADR 0019 per-task shape) on first read.
  let registry = null;
  try { registry = loadRegistry(); } catch (_e) { /* registry may be unavailable in test contexts */ }
  const config = migrateConfigIfNeeded(parsed, registry);
  // ADR tag-stack-merge-hardening/0001 (AC-7): fresh install only (file
  // absent) → seed the default-disabled entries. Existing files pass
  // through untouched, so a user-deleted entry is never resurrected.
  if (!fileExisted && Array.isArray(config.entries) && config.entries.length === 0) {
    config.entries = freshInstallEntries(registry);
  }
  return config;
}

function writeConfig(config) {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function findEntry(config, entryId) {
  return config.entries.find(e => e.id === entryId);
}

// ── Boot reconcile (replaces ADR 0003's initScheduler; preserves the
//    ADR 0019 function name + signature so bin/control-panel.js stays put) ──

async function reconcileSchedulesFromConfig() {
  const config = readConfig();
  const registry = loadRegistry();
  return scheduler().reconcileSchedules(config, registry);
}

// ── Task execution history (events.jsonl — task-keyed; multi-entry
//    entries that share a taskId share this surface, per ADR 0021's
//    documented constraint) ──

/**
 * Group raw events.jsonl lines into one logical "run" per session, where a
 * session is `<pid>_<YYYY-MM-DD>`. Pure function — exported for testability.
 *
 * Why session-dedup is necessary: the structured-logging utility writes
 * TASK_START + TASK_END events from MULTIPLE layers per fire — the
 * launchChildTask.sh wrapper AND the task script's own emit each write a
 * record. Both share the same PID. Without dedup, `getRecentRuns` returns
 * 2× rows per fire — exactly the bug operator reported (panel showing
 * `processCustomer` ran twice at each scheduled tick when it only ran once).
 *
 * Matches the legacy task explorer's contract
 * (src/api/taskExplorer/getTaskExplorerSingleTaskData), which groups by
 * sessionId = `<pid>_<YYYY-MM-DD>` and reports one row per session.
 *
 * Returns an array of `{ startedAt, endedAt, durationMs, status, exitCode }`
 * sorted by startedAt descending. Each session uses the earliest TASK_START
 * timestamp and the latest TASK_END timestamp.
 */
function groupEventsIntoSessions(taskName, lines) {
  const sessions = new Map(); // sessionKey → { startedAt, endedAt, durationMs, status, exitCode }
  for (const line of lines) {
    let rec;
    try { rec = JSON.parse(line); } catch { continue; }
    if (!rec || rec.taskName !== taskName) continue;
    if (rec.eventType !== 'TASK_START' && rec.eventType !== 'TASK_END') continue;

    const pid = (rec.pid !== undefined && rec.pid !== null) ? String(rec.pid) : 'unknown';
    const date = (rec.timestamp || '').slice(0, 10); // YYYY-MM-DD
    const key = `${pid}_${date}`;

    let s = sessions.get(key);
    if (!s) {
      s = { startedAt: null, endedAt: null, durationMs: null, status: 'running', exitCode: null };
      sessions.set(key, s);
    }

    if (rec.eventType === 'TASK_START') {
      // Earliest TASK_START within the session.
      if (!s.startedAt || (rec.timestamp && rec.timestamp < s.startedAt)) s.startedAt = rec.timestamp;
    } else {
      // Latest TASK_END within the session.
      if (!s.endedAt || (rec.timestamp && rec.timestamp > s.endedAt)) s.endedAt = rec.timestamp;
      s.status = rec.failure ? 'failed' : 'success';
      if (rec.exitCode !== undefined) s.exitCode = rec.exitCode;
      if (rec.duration !== undefined) s.durationMs = rec.duration;
    }
  }

  return Array.from(sessions.values())
    .filter(s => s.startedAt) // drop sessions that only saw TASK_END (orphan / pre-process)
    .sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''));
}

function getRecentRuns(taskName, maxRuns = 5) {
  try {
    if (!fs.existsSync(EVENTS_PATH)) return [];
    const lines = fs.readFileSync(EVENTS_PATH, 'utf8').trim().split('\n').filter(Boolean);
    return groupEventsIntoSessions(taskName, lines).slice(0, maxRuns);
  } catch (e) {
    console.error('[scheduled-tasks] Error reading history:', e.message);
    return [];
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

async function nextRunSafe(entryId, taskId) {
  try { return await scheduler().getNextRun(entryId, taskId); }
  catch (_e) { return null; }
}

function entryNotFound(res, entryId) {
  return res.status(404).json({
    success: false,
    error: `Entry '${entryId}' not found`,
  });
}

function newEntryId() {
  return `entry-${crypto.randomUUID()}`;
}

function deriveDefaultLabel(taskId, registry) {
  return (registry && registry.tasks && registry.tasks[taskId] && registry.tasks[taskId].name) || taskId;
}

/**
 * Save-time CustomerManager existence check (ADR 0021 §Files-to-edit;
 * §Q2 "save-time check (fast feedback)"). For customer-task entries whose
 * `args.customer` is set, verifies the pubkey resolves to a current
 * customer record before persisting. Pubkey FORMAT is already validated
 * by validateEntry; this is the EXISTENCE check, complementing it.
 *
 * Returns `null` on success (or when the task doesn't take a customer arg,
 * or when no customer was supplied — the latter is validateEntry's job to
 * reject if required). Returns an error object on miss; the caller maps it
 * to a 400 response with the same shape as validateEntry's errors.
 *
 * NB: this is "defense-in-depth for fast feedback, not the load-bearing
 * check" — the fire-time path in entryResolver is what guarantees
 * correctness. Skipping this check still leaves the system correct; the
 * operator just gets feedback at the next fire instead of immediately.
 */
async function verifyCustomerExists(entry, registry) {
  const task = registry && registry.tasks && registry.tasks[entry.taskId];
  if (!task || !task.arguments || task.arguments.customer !== true) return null;

  const pubkey = entry.args && entry.args.customer;
  if (!pubkey) return null; // validateEntry handles required-missing case

  try {
    const CustomerManager = require('../../utils/customerManager');
    const cm = new CustomerManager();
    await cm.initialize();
    const customer = await cm.getCustomer(pubkey);
    if (!customer) {
      return {
        field: 'customer',
        code: 'CUSTOMER_NOT_FOUND',
        message: `Customer ${pubkey} is not present in CustomerManager — pick a different customer or create one before scheduling.`,
        pubkey,
      };
    }
  } catch (e) {
    return {
      field: 'customer',
      code: 'CUSTOMER_LOOKUP_ERROR',
      message: `CustomerManager lookup failed at save time: ${e.message}`,
      pubkey,
    };
  }
  return null;
}

// ── API Handlers ────────────────────────────────────────────────────────

/** GET /api/scheduled-tasks/list — returns the per-entry view. */
async function handleList(req, res) {
  const config = readConfig();
  const registry = loadRegistry();
  const entries = [];
  for (const entry of config.entries) {
    const nextRunAt = await nextRunSafe(entry.id, entry.taskId);
    const lastRun = getRecentRuns(entry.taskId, 1)[0] || null;
    const taskDef = registry.tasks && registry.tasks[entry.taskId];
    entries.push({
      ...entry,
      taskName: (taskDef && taskDef.name) || entry.taskId,
      timer: {
        active: !!nextRunAt,
        nextRunAt,
        lastRunAt: lastRun ? lastRun.startedAt : null,
      },
    });
  }
  return res.json({ success: true, entries });
}

/**
 * Pure-function filter for the Add Entry modal's task dropdown. Exported
 * for unit testability — handleRegistryTasks wraps it for the HTTP boundary.
 *
 * Rule: any non-continuous task in the registry. ADR 0019's panel already
 * permitted scheduling any non-continuous task; ADR 0021's amendment
 * preserves that surface — non-parameterized tasks (e.g., reconcileAll,
 * reconcileRecent, reconcileAuthor, reconcileNetwork) MUST remain
 * schedulable from the modal even though they don't take operator-supplied
 * arguments. The modal handles a no-args task gracefully: argsSchema is
 * empty so no arg form fields render, and Save is enabled immediately.
 *
 * "continuous" excludes the queue-internal daemons (taskQueueManager /
 * taskScheduler / taskExecutor / systemStateGatherer) which are not
 * scheduled tasks at all.
 */
function filterSchedulableTasks(registry) {
  const tasks = [];
  for (const [taskId, task] of Object.entries((registry && registry.tasks) || {})) {
    if (!task || typeof task !== 'object') continue;
    if (task.frequency === 'continuous') continue;
    tasks.push({
      taskId,
      name: task.name || taskId,
      description: task.description || '',
      // Normalize arguments to an object for the modal — `false` / missing
      // collapses to `{}` so the modal's switch over `Object.entries(args)`
      // is well-defined for non-parameterized tasks.
      arguments: (task.arguments && typeof task.arguments === 'object' && !Array.isArray(task.arguments))
        ? task.arguments
        : {},
      categories: task.categories || [],
      frequency: task.frequency || 'periodic',
    });
  }
  return tasks;
}

/** GET /api/scheduled-tasks/registry-tasks — the dropdown source for the
 *  Add Entry modal. Returns every non-continuous registered task; the modal
 *  renders an arg form only for tasks whose arguments object is non-empty. */
function handleRegistryTasks(req, res) {
  return res.json({ success: true, tasks: filterSchedulableTasks(loadRegistry()) });
}

/** POST /api/scheduled-tasks/create — new entry. */
async function handleCreate(req, res) {
  try {
    const { taskId, args, label, enabled, intervalDays, intervalHours, intervalMinutes, cron } = req.body || {};
    if (!taskId) return res.status(400).json({ success: false, error: 'taskId is required' });

    const registry = loadRegistry();
    const entry = {
      id: newEntryId(),
      taskId,
      label: label || deriveDefaultLabel(taskId, registry),
      args: args || {},
      enabled: !!enabled,
      intervalDays:    parseInt(intervalDays)    || 0,
      intervalHours:   parseInt(intervalHours)   || 0,
      intervalMinutes: parseInt(intervalMinutes) || 0,
      cron: typeof cron === 'string' ? cron.trim() : '',
    };

    const validation = validateEntry(entry, registry);
    if (!validation.ok) {
      return res.status(400).json({ success: false, error: 'Entry validation failed', errors: validation.errors });
    }

    // Save-time CustomerManager existence check (ADR 0021 §Files-to-edit).
    const customerError = await verifyCustomerExists(entry, registry);
    if (customerError) {
      return res.status(400).json({ success: false, error: 'Entry validation failed', errors: [customerError] });
    }

    const config = readConfig();
    config.entries.push(entry);
    writeConfig(config);

    if (entry.enabled) {
      try { await scheduler().upsertSchedule(entry, registry); }
      catch (e) {
        return res.status(503).json({ success: false, error: `Scheduling unavailable: ${e.message}` });
      }
    }

    return res.json({ success: true, entry });
  } catch (err) {
    console.error('[scheduled-tasks] handleCreate error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/** POST /api/scheduled-tasks/update — update entry by entryId. */
async function handleUpdate(req, res) {
  try {
    const { entryId, enabled, intervalDays, intervalHours, intervalMinutes, cron, args, label } = req.body || {};
    if (!entryId) return res.status(400).json({ success: false, error: 'entryId is required' });

    const config = readConfig();
    const entry = findEntry(config, entryId);
    if (!entry) return entryNotFound(res, entryId);

    // Apply the patch (only fields explicitly provided).
    const updated = { ...entry };
    if (enabled !== undefined) updated.enabled = !!enabled;
    if (intervalDays !== undefined)    updated.intervalDays    = parseInt(intervalDays)    || 0;
    if (intervalHours !== undefined)   updated.intervalHours   = parseInt(intervalHours)   || 0;
    if (intervalMinutes !== undefined) updated.intervalMinutes = parseInt(intervalMinutes) || 0;
    if (cron !== undefined) updated.cron = typeof cron === 'string' ? cron.trim() : '';
    if (args !== undefined) updated.args = args;
    if (label !== undefined) updated.label = label;
    if (enabled === true) delete updated.lastError;

    const registry = loadRegistry();
    const validation = validateEntry(updated, registry);
    if (!validation.ok) {
      return res.status(400).json({ success: false, error: 'Entry validation failed', errors: validation.errors });
    }

    // Save-time CustomerManager existence check (ADR 0021 §Files-to-edit).
    // Only enforce when the customer arg actually changes in this patch —
    // otherwise an operator toggling enabled/schedule on an entry whose
    // customer existed at create-time but has since been deleted would
    // bounce on save instead of being caught by the fire-time path.
    if (args !== undefined) {
      const customerError = await verifyCustomerExists(updated, registry);
      if (customerError) {
        return res.status(400).json({ success: false, error: 'Entry validation failed', errors: [customerError] });
      }
    }

    const idx = config.entries.findIndex(e => e.id === entryId);
    config.entries[idx] = updated;
    writeConfig(config);

    try {
      if (updated.enabled) await scheduler().upsertSchedule(updated, registry);
      else await scheduler().removeSchedule(updated.id, updated.taskId);
    } catch (e) {
      return res.status(503).json({ success: false, error: `Scheduling unavailable: ${e.message}` });
    }

    const nextRunAt = await nextRunSafe(updated.id, updated.taskId);
    const spec = updated.cron
      ? `cron "${updated.cron}"`
      : `every ${updated.intervalDays}d ${updated.intervalHours}h ${updated.intervalMinutes}m`;
    return res.json({
      success: true,
      message: updated.enabled ? `${updated.id} enabled: ${spec}` : `${updated.id} disabled`,
      entry: updated,
      timer: { active: !!nextRunAt, nextRunAt, lastRunAt: null },
    });
  } catch (err) {
    console.error('[scheduled-tasks] handleUpdate error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/** POST /api/scheduled-tasks/delete — remove entry; refuses enabled-without-force. */
async function handleDelete(req, res) {
  try {
    const { entryId, force } = req.body || {};
    if (!entryId) return res.status(400).json({ success: false, error: 'entryId is required' });

    const config = readConfig();
    const entry = findEntry(config, entryId);
    if (!entry) return entryNotFound(res, entryId);

    if (entry.enabled && !force) {
      return res.status(400).json({
        success: false,
        error: `Entry '${entryId}' is enabled; disable it first or pass force: true`,
        code: 'ENABLED_NO_FORCE',
      });
    }

    config.entries = config.entries.filter(e => e.id !== entryId);
    writeConfig(config);

    try { await scheduler().removeSchedule(entry.id, entry.taskId); }
    catch (e) { /* best-effort — config is already removed */ }

    return res.json({ success: true, message: `Entry '${entryId}' deleted` });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/** GET /api/scheduled-tasks/status?entryId=<id> — per-entry status. */
async function handleStatus(req, res) {
  const entryId = req.query.entryId;
  if (!entryId) return res.status(400).json({ success: false, error: 'entryId is required' });
  const config = readConfig();
  const entry = findEntry(config, entryId);
  if (!entry) return entryNotFound(res, entryId);

  const nextRunAt = await nextRunSafe(entry.id, entry.taskId);
  const lastRun = getRecentRuns(entry.taskId, 1)[0] || null;
  return res.json({
    success: true,
    entryId,
    taskId: entry.taskId,
    label: entry.label,
    args: entry.args,
    schedule: {
      enabled: !!entry.enabled,
      intervalDays: entry.intervalDays || 0,
      intervalHours: entry.intervalHours || 0,
      intervalMinutes: entry.intervalMinutes || 0,
      cron: entry.cron || '',
    },
    timer: {
      active: !!nextRunAt,
      nextRunAt,
      lastRunAt: lastRun ? lastRun.startedAt : null,
    },
    lastError: entry.lastError || null,
  });
}

/** GET /api/scheduled-tasks/history?entryId=<id> — per-task event-log records.
 *  ADR 0021 documents the caveat: entries sharing a taskId share this list. */
function handleHistory(req, res) {
  const entryId = req.query.entryId;
  if (!entryId) return res.status(400).json({ success: false, error: 'entryId is required' });
  const config = readConfig();
  const entry = findEntry(config, entryId);
  if (!entry) return entryNotFound(res, entryId);

  return res.json({
    success: true,
    entryId,
    taskId: entry.taskId,
    runs: getRecentRuns(entry.taskId, 5),
    note: 'Recent runs are reported per task name, not per entry. Multiple entries sharing a taskId share this list. Per-entry granularity is a future story.',
  });
}

module.exports = {
  handleStatus,
  handleUpdate,
  handleHistory,
  handleList,
  handleCreate,
  handleDelete,
  handleRegistryTasks,
  reconcileSchedulesFromConfig,
  // Exported for testability / reuse:
  readConfig,
  isRegisteredTask,
  getRecentRuns,
  groupEventsIntoSessions,
  filterSchedulableTasks,
};
