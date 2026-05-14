/**
 * Scheduled Tasks API
 *
 * Manages recurring timers for one or more named tasks, keyed by taskId.
 * Config is persisted in /var/lib/brainstorm/scheduled-tasks.json.
 * Timers run in-process via setInterval and trigger their task through
 * the existing /api/run-task endpoint.
 *
 * Per ADR 0003 (Option A): generalized from a single hardcoded task to a
 * Map<taskId, timerState>. Handlers require taskId from req.query/body.
 */

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = '/var/lib/brainstorm/scheduled-tasks.json';
const EVENTS_PATH = '/var/log/brainstorm/taskQueue/events.jsonl';

const DEFAULTS = {
  updateAllScoresForOwner: {
    enabled: false,
    intervalHours: 24,
    intervalDays: 0,
  },
  refreshSearchIndex: {
    enabled: false,
    intervalHours: 24,
    intervalDays: 0,
  },
};

// ── Per-task in-memory timer state ──────────────────────────
// taskId → { schedulerTimer, nextRunAt, lastRunAt, taskRunning }
const timerState = new Map();

function getTimerState(taskId) {
  if (!timerState.has(taskId)) {
    timerState.set(taskId, {
      schedulerTimer: null,
      nextRunAt: null,
      lastRunAt: null,
      taskRunning: false,
    });
  }
  return timerState.get(taskId);
}

function isKnownTaskId(taskId) {
  return Boolean(taskId) && Object.prototype.hasOwnProperty.call(DEFAULTS, taskId);
}

// ── Config read/write ───────────────────────────────────────

function readConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    }
  } catch (e) {
    console.error('[scheduled-tasks] Error reading config:', e.message);
  }
  return { ...DEFAULTS };
}

function writeConfig(config) {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function getTaskConfig(taskId) {
  const config = readConfig();
  return config[taskId] || DEFAULTS[taskId];
}

// ── Scheduler logic ─────────────────────────────────────────

function totalIntervalMs(cfg) {
  return ((cfg.intervalDays || 0) * 24 + (cfg.intervalHours || 0)) * 3600000;
}

function makeTriggerTask(taskId) {
  return async function triggerTask() {
    const state = getTimerState(taskId);
    if (state.taskRunning) {
      console.log(`[scheduled-tasks] Skipping trigger — previous ${taskId} is still running (started at ${state.lastRunAt})`);
      return;
    }

    state.lastRunAt = new Date().toISOString();
    state.taskRunning = true;
    const intervalMs = totalIntervalMs(getTaskConfig(taskId));
    state.nextRunAt = new Date(Date.now() + intervalMs).toISOString();

    console.log(`[scheduled-tasks] Triggering ${taskId} at ${state.lastRunAt}`);
    try {
      const resp = await fetch(`http://127.0.0.1:7778/api/run-task?taskName=${taskId}`, {
        method: 'POST',
      });
      const data = await resp.json();
      console.log(`[scheduled-tasks] Task trigger response (${taskId}):`, data.success ? 'success' : data.message);

      // Wait for task to complete by polling its process
      if (data.execution?.pid) {
        const pid = data.execution.pid;
        const { execSync } = require('child_process');
        const checkInterval = setInterval(() => {
          try {
            execSync(`ps -p ${pid} > /dev/null 2>&1`);
            // Process still running, continue waiting
          } catch {
            clearInterval(checkInterval);
            state.taskRunning = false;
            console.log(`[scheduled-tasks] ${taskId} completed (PID ${pid} exited)`);
          }
        }, 30000); // Check every 30 seconds
      } else {
        state.taskRunning = false;
      }
    } catch (err) {
      console.error(`[scheduled-tasks] Error triggering ${taskId}:`, err.message);
      state.taskRunning = false;
    }
  };
}

function startScheduler(taskId, cfg) {
  stopScheduler(taskId);
  const intervalMs = totalIntervalMs(cfg);
  if (intervalMs < 3600000) {
    console.warn(`[scheduled-tasks] Interval too short (< 1 hour) for ${taskId}, not starting`);
    return;
  }
  const state = getTimerState(taskId);
  state.nextRunAt = new Date(Date.now() + intervalMs).toISOString();
  state.schedulerTimer = setInterval(makeTriggerTask(taskId), intervalMs);
  console.log(`[scheduled-tasks] Scheduler started for ${taskId}: every ${cfg.intervalDays || 0}d ${cfg.intervalHours || 0}h (next run: ${state.nextRunAt})`);
}

function stopScheduler(taskId) {
  const state = getTimerState(taskId);
  if (state.schedulerTimer) {
    clearInterval(state.schedulerTimer);
    state.schedulerTimer = null;
    state.nextRunAt = null;
    console.log(`[scheduled-tasks] Scheduler stopped for ${taskId}`);
  }
}

/**
 * Called once at server startup. Iterates every known taskId in DEFAULTS
 * and restores the scheduler for any task whose persisted config has
 * enabled:true. Per ADR 0003, no single task is privileged here.
 */
function initScheduler() {
  for (const taskId of Object.keys(DEFAULTS)) {
    const cfg = getTaskConfig(taskId);
    if (cfg.enabled) {
      console.log(`[scheduled-tasks] Restoring enabled schedule from config: ${taskId}`);
      startScheduler(taskId, cfg);
    } else {
      console.log(`[scheduled-tasks] Scheduler disabled in config for ${taskId}, not starting`);
    }
  }
}

// ── Task execution history ──────────────────────────────────

function getRecentRuns(taskName, maxRuns = 5) {
  const runs = [];
  try {
    if (!fs.existsSync(EVENTS_PATH)) return runs;
    const lines = fs.readFileSync(EVENTS_PATH, 'utf8').trim().split('\n').filter(Boolean);

    // Collect starts and ends for this task
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

    // Walk starts in reverse (most recent first), find matching end
    for (let i = starts.length - 1; i >= 0 && runs.length < maxRuns; i--) {
      const start = starts[i];
      let matchedEnd = null;
      for (const end of ends) {
        if (new Date(end.timestamp) > new Date(start.timestamp)) {
          matchedEnd = end;
          break;
        }
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

// ── API Handlers ────────────────────────────────────────────

function handleStatus(req, res) {
  const taskId = req.query.taskId;
  if (!isKnownTaskId(taskId)) {
    return res.status(400).json({
      success: false,
      error: `Unknown or missing taskId: ${taskId}. Known: ${Object.keys(DEFAULTS).join(', ')}`,
    });
  }
  const cfg = getTaskConfig(taskId);
  const state = getTimerState(taskId);
  const totalHours = (cfg.intervalDays || 0) * 24 + (cfg.intervalHours || 0);
  return res.json({
    success: true,
    taskId,
    schedule: {
      enabled: cfg.enabled,
      intervalHours: cfg.intervalHours,
      intervalDays: cfg.intervalDays,
      totalIntervalHours: totalHours,
    },
    timer: {
      active: state.schedulerTimer !== null,
      nextRunAt: state.nextRunAt,
      lastRunAt: state.lastRunAt,
    },
  });
}

async function handleUpdate(req, res) {
  try {
    const taskId = req.body.taskId;
    const { enabled, intervalHours, intervalDays } = req.body;

    if (!isKnownTaskId(taskId)) {
      return res.status(400).json({
        success: false,
        error: `Unknown or missing taskId: ${taskId}. Known: ${Object.keys(DEFAULTS).join(', ')}`,
      });
    }

    const days = parseInt(intervalDays) || 0;
    const hours = parseInt(intervalHours) || 0;
    const totalHours = days * 24 + hours;

    if (enabled && totalHours < 1) {
      return res.status(400).json({ success: false, error: 'Minimum interval is 1 hour' });
    }
    if (days < 0 || hours < 0) {
      return res.status(400).json({ success: false, error: 'Interval values must be non-negative' });
    }

    // Save
    const config = readConfig();
    config[taskId] = {
      enabled: !!enabled,
      intervalHours: hours,
      intervalDays: days,
    };
    writeConfig(config);

    // Start or stop timer (per-task)
    if (enabled) {
      startScheduler(taskId, config[taskId]);
    } else {
      stopScheduler(taskId);
    }

    const state = getTimerState(taskId);
    return res.json({
      success: true,
      message: enabled ? `${taskId} enabled: every ${days}d ${hours}h` : `${taskId} disabled`,
      taskId,
      schedule: config[taskId],
      timer: {
        active: state.schedulerTimer !== null,
        nextRunAt: state.nextRunAt,
        lastRunAt: state.lastRunAt,
      },
    });
  } catch (err) {
    console.error('[scheduled-tasks] Error updating:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

function handleHistory(req, res) {
  const taskId = req.query.taskId;
  if (!isKnownTaskId(taskId)) {
    return res.status(400).json({
      success: false,
      error: `Unknown or missing taskId: ${taskId}. Known: ${Object.keys(DEFAULTS).join(', ')}`,
    });
  }
  const runs = getRecentRuns(taskId, 5);
  return res.json({ success: true, taskId, runs });
}

module.exports = { handleStatus, handleUpdate, handleHistory, initScheduler };
