/**
 * Scheduled Tasks API
 *
 * Manages a recurring timer for updateAllScoresForOwner.
 * Config is persisted in /var/lib/brainstorm/scheduled-tasks.json.
 * The timer runs in-process via setInterval and triggers the task
 * through the existing /api/run-task endpoint.
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
};

// ── In-memory timer state ───────────────────────────────────
let schedulerTimer = null;
let nextRunAt = null;
let lastRunAt = null;
let taskRunning = false;

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

function getTaskConfig() {
  const config = readConfig();
  return config.updateAllScoresForOwner || DEFAULTS.updateAllScoresForOwner;
}

// ── Scheduler logic ─────────────────────────────────────────

function totalIntervalMs(cfg) {
  return ((cfg.intervalDays || 0) * 24 + (cfg.intervalHours || 0)) * 3600000;
}

async function triggerTask() {
  // Skip if previous run is still active
  if (taskRunning) {
    console.log(`[scheduled-tasks] Skipping trigger — previous updateAllScoresForOwner is still running (started at ${lastRunAt})`);
    return;
  }

  lastRunAt = new Date().toISOString();
  taskRunning = true;
  const intervalMs = totalIntervalMs(getTaskConfig());
  nextRunAt = new Date(Date.now() + intervalMs).toISOString();

  console.log(`[scheduled-tasks] Triggering updateAllScoresForOwner at ${lastRunAt}`);
  try {
    const resp = await fetch('http://127.0.0.1:7778/api/run-task?taskName=updateAllScoresForOwner', {
      method: 'POST',
    });
    const data = await resp.json();
    console.log(`[scheduled-tasks] Task trigger response:`, data.success ? 'success' : data.message);

    // Wait for task to complete by polling its process
    if (data.execution?.pid) {
      const pid = data.execution.pid;
      const { execSync } = require('child_process');
      const checkInterval = setInterval(() => {
        try {
          execSync(`ps -p ${pid} > /dev/null 2>&1`);
          // Process still running, continue waiting
        } catch {
          // Process finished
          clearInterval(checkInterval);
          taskRunning = false;
          console.log(`[scheduled-tasks] updateAllScoresForOwner completed (PID ${pid} exited)`);
        }
      }, 30000); // Check every 30 seconds
    } else {
      taskRunning = false;
    }
  } catch (err) {
    console.error(`[scheduled-tasks] Error triggering task:`, err.message);
    taskRunning = false;
  }
}

function startScheduler(cfg) {
  stopScheduler();
  const intervalMs = totalIntervalMs(cfg);
  if (intervalMs < 3600000) {
    console.warn('[scheduled-tasks] Interval too short (< 1 hour), not starting');
    return;
  }
  nextRunAt = new Date(Date.now() + intervalMs).toISOString();
  schedulerTimer = setInterval(triggerTask, intervalMs);
  console.log(`[scheduled-tasks] Scheduler started: every ${cfg.intervalDays || 0}d ${cfg.intervalHours || 0}h (next run: ${nextRunAt})`);
}

function stopScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    nextRunAt = null;
    console.log('[scheduled-tasks] Scheduler stopped');
  }
}

/**
 * Called once at server startup to restore the scheduler if it was enabled.
 */
function initScheduler() {
  const cfg = getTaskConfig();
  if (cfg.enabled) {
    console.log('[scheduled-tasks] Restoring enabled schedule from config');
    startScheduler(cfg);
  } else {
    console.log('[scheduled-tasks] Scheduler disabled in config, not starting');
  }
}

// ── Task execution history ──────────────────────────────────

function getRecentRuns(taskName = 'updateAllScoresForOwner', maxRuns = 5) {
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

    // Pair starts with ends (most recent first)
    const endsByTimestamp = new Map();
    for (const end of ends) {
      endsByTimestamp.set(end.timestamp, end);
    }

    // Walk starts in reverse (most recent first), find matching end
    for (let i = starts.length - 1; i >= 0 && runs.length < maxRuns; i--) {
      const start = starts[i];
      // Find the first end after this start
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
  const cfg = getTaskConfig();
  const totalHours = (cfg.intervalDays || 0) * 24 + (cfg.intervalHours || 0);
  return res.json({
    success: true,
    schedule: {
      enabled: cfg.enabled,
      intervalHours: cfg.intervalHours,
      intervalDays: cfg.intervalDays,
      totalIntervalHours: totalHours,
    },
    timer: {
      active: schedulerTimer !== null,
      nextRunAt,
      lastRunAt,
    },
  });
}

async function handleUpdate(req, res) {
  try {
    const { enabled, intervalHours, intervalDays } = req.body;

    // Validate
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
    config.updateAllScoresForOwner = {
      enabled: !!enabled,
      intervalHours: hours,
      intervalDays: days,
    };
    writeConfig(config);

    // Start or stop timer
    if (enabled) {
      startScheduler(config.updateAllScoresForOwner);
    } else {
      stopScheduler();
    }

    // Return updated status
    return res.json({
      success: true,
      message: enabled ? `Scheduler enabled: every ${days}d ${hours}h` : 'Scheduler disabled',
      schedule: config.updateAllScoresForOwner,
      timer: {
        active: schedulerTimer !== null,
        nextRunAt,
        lastRunAt,
      },
    });
  } catch (err) {
    console.error('[scheduled-tasks] Error updating:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

function handleHistory(req, res) {
  const runs = getRecentRuns('updateAllScoresForOwner', 5);
  return res.json({ success: true, runs });
}

module.exports = { handleStatus, handleUpdate, handleHistory, initScheduler };
