/**
 * Per-Customer Scheduled Tasks API
 *
 * Manages recurring timers for processCustomer per customer.
 * Config persisted in each customer's directory: /var/lib/brainstorm/customers/<name>/schedule.json
 * Timers run in-process via setInterval and trigger via /api/run-task.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const CustomerManager = require('../../utils/customerManager');
const { getConfigFromFile } = require('../../utils/config');

const EVENTS_PATH = '/var/log/brainstorm/taskQueue/events.jsonl';
const CUSTOMERS_DIR = '/var/lib/brainstorm/customers';

const DEFAULTS = { enabled: false, intervalHours: 24, intervalDays: 0 };

// ── In-memory timer state per customer ─────────────────────
// Map<pubkey, { timer, nextRunAt, lastRunAt, taskRunning, customerName }>
const customerTimers = new Map();

// ── Config helpers ─────────────────────────────────────────

function getSchedulePath(customerName) {
  return path.join(CUSTOMERS_DIR, customerName, 'schedule.json');
}

function readSchedule(customerName) {
  try {
    const p = getSchedulePath(customerName);
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {}
  return { ...DEFAULTS };
}

function writeSchedule(customerName, config) {
  const p = getSchedulePath(customerName);
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(config, null, 2));
}

function totalIntervalMs(cfg) {
  return ((cfg.intervalDays || 0) * 24 + (cfg.intervalHours || 0)) * 3600000;
}

// ── Timer management ───────────────────────────────────────

async function triggerCustomerTask(pubkey) {
  const state = customerTimers.get(pubkey);
  if (!state) return;

  if (state.taskRunning) {
    console.log(`[customer-schedule] Skipping trigger for ${pubkey.slice(0, 8)} — previous run still active`);
    return;
  }

  state.lastRunAt = new Date().toISOString();
  state.taskRunning = true;
  const intervalMs = totalIntervalMs(readSchedule(state.customerName));
  state.nextRunAt = new Date(Date.now() + intervalMs).toISOString();

  console.log(`[customer-schedule] Triggering processCustomer for ${pubkey.slice(0, 8)} at ${state.lastRunAt}`);
  try {
    const resp = await fetch(`http://127.0.0.1:7778/api/run-task?taskName=processCustomer&pubkey=${pubkey}`, {
      method: 'POST',
    });
    const data = await resp.json();
    console.log(`[customer-schedule] Trigger response for ${pubkey.slice(0, 8)}:`, data.success ? 'success' : data.message);

    // Poll PID to detect completion
    if (data.execution?.pid) {
      const pid = data.execution.pid;
      const checkInterval = setInterval(() => {
        try {
          execSync(`ps -p ${pid} > /dev/null 2>&1`);
        } catch {
          clearInterval(checkInterval);
          state.taskRunning = false;
          console.log(`[customer-schedule] processCustomer completed for ${pubkey.slice(0, 8)} (PID ${pid} exited)`);
        }
      }, 30000);
    } else {
      state.taskRunning = false;
    }
  } catch (err) {
    console.error(`[customer-schedule] Error triggering for ${pubkey.slice(0, 8)}:`, err.message);
    state.taskRunning = false;
  }
}

function startCustomerTimer(pubkey, customerName, cfg) {
  stopCustomerTimer(pubkey);
  const intervalMs = totalIntervalMs(cfg);
  if (intervalMs < 3600000) {
    console.warn(`[customer-schedule] Interval too short for ${pubkey.slice(0, 8)}, not starting`);
    return;
  }
  const state = {
    timer: setInterval(() => triggerCustomerTask(pubkey), intervalMs),
    nextRunAt: new Date(Date.now() + intervalMs).toISOString(),
    lastRunAt: null,
    taskRunning: false,
    customerName,
  };
  customerTimers.set(pubkey, state);
  console.log(`[customer-schedule] Timer started for ${pubkey.slice(0, 8)}: every ${cfg.intervalDays || 0}d ${cfg.intervalHours || 0}h`);
}

function stopCustomerTimer(pubkey) {
  const state = customerTimers.get(pubkey);
  if (state?.timer) {
    clearInterval(state.timer);
    customerTimers.delete(pubkey);
    console.log(`[customer-schedule] Timer stopped for ${pubkey.slice(0, 8)}`);
  }
}

// ── History from events.jsonl ──────────────────────────────

function getCustomerRuns(pubkey, maxRuns = 5) {
  const runs = [];
  try {
    if (!fs.existsSync(EVENTS_PATH)) return runs;
    const lines = fs.readFileSync(EVENTS_PATH, 'utf8').trim().split('\n').filter(Boolean);

    const starts = [];
    const ends = [];
    for (const line of lines) {
      try {
        const rec = JSON.parse(line);
        if (rec.taskName !== 'processCustomer') continue;
        // Match by customer pubkey in metadata
        const meta = rec.metadata || rec.oMetadata || {};
        const recPubkey = meta.customer_pubkey || meta.customerPubkey || '';
        if (recPubkey !== pubkey) continue;
        if (rec.eventType === 'TASK_START') starts.push(rec);
        else if (rec.eventType === 'TASK_END') ends.push(rec);
      } catch {}
    }

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
      });
    }
  } catch {}
  return runs;
}

// ── Startup initialization ─────────────────────────────────

async function initCustomerSchedulers() {
  try {
    const customerManager = new CustomerManager();
    await customerManager.initialize();
    const customers = await customerManager.listActiveCustomers();

    let started = 0;
    for (const customer of customers) {
      const cfg = readSchedule(customer.directory);
      if (cfg.enabled) {
        startCustomerTimer(customer.pubkey, customer.directory, cfg);
        started++;
      }
    }
    console.log(`[customer-schedule] Initialized ${started} customer schedulers`);
  } catch (err) {
    console.error(`[customer-schedule] Init error:`, err.message);
  }
}

// ── API Handlers ───────────────────────────────────────────

async function handleStatus(req, res) {
  try {
    const { pubkey } = req.query;
    if (!pubkey) return res.status(400).json({ success: false, error: 'pubkey is required' });

    const customerManager = new CustomerManager();
    await customerManager.initialize();
    const customer = await customerManager.getCustomer(pubkey);
    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });

    const cfg = readSchedule(customer.directory);
    const state = customerTimers.get(pubkey);
    const totalHours = (cfg.intervalDays || 0) * 24 + (cfg.intervalHours || 0);

    return res.json({
      success: true,
      schedule: {
        enabled: cfg.enabled,
        intervalHours: cfg.intervalHours || 0,
        intervalDays: cfg.intervalDays || 0,
        totalIntervalHours: totalHours,
      },
      timer: {
        active: !!state?.timer,
        nextRunAt: state?.nextRunAt || null,
        lastRunAt: state?.lastRunAt || null,
        taskRunning: state?.taskRunning || false,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function handleUpdate(req, res) {
  try {
    const { pubkey } = req.query;
    if (!pubkey) return res.status(400).json({ success: false, error: 'pubkey is required' });

    const { enabled, intervalHours, intervalDays } = req.body;
    const days = parseInt(intervalDays) || 0;
    const hours = parseInt(intervalHours) || 0;
    const totalHours = days * 24 + hours;

    if (enabled && totalHours < 1) {
      return res.status(400).json({ success: false, error: 'Minimum interval is 1 hour' });
    }

    const customerManager = new CustomerManager();
    await customerManager.initialize();
    const customer = await customerManager.getCustomer(pubkey);
    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });

    const config = { enabled: !!enabled, intervalHours: hours, intervalDays: days };
    writeSchedule(customer.directory, config);

    if (enabled) {
      startCustomerTimer(pubkey, customer.directory, config);
    } else {
      stopCustomerTimer(pubkey);
    }

    const state = customerTimers.get(pubkey);
    return res.json({
      success: true,
      message: enabled ? `Schedule enabled: every ${days}d ${hours}h` : 'Schedule disabled',
      schedule: config,
      timer: {
        active: !!state?.timer,
        nextRunAt: state?.nextRunAt || null,
        lastRunAt: state?.lastRunAt || null,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function handleTrigger(req, res) {
  try {
    const { pubkey } = req.query;
    if (!pubkey) return res.status(400).json({ success: false, error: 'pubkey is required' });

    const customerManager = new CustomerManager();
    await customerManager.initialize();
    const customer = await customerManager.getCustomer(pubkey);
    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });

    // Ensure state exists
    if (!customerTimers.has(pubkey)) {
      customerTimers.set(pubkey, {
        timer: null,
        nextRunAt: null,
        lastRunAt: null,
        taskRunning: false,
        customerName: customer.directory,
      });
    }

    const state = customerTimers.get(pubkey);
    if (state.taskRunning) {
      return res.json({ success: false, error: 'Task is already running for this customer' });
    }

    // Trigger immediately
    triggerCustomerTask(pubkey);

    return res.json({
      success: true,
      message: `processCustomer triggered for ${customer.directory}`,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function handleHistory(req, res) {
  try {
    const { pubkey } = req.query;
    if (!pubkey) return res.status(400).json({ success: false, error: 'pubkey is required' });

    const runs = getCustomerRuns(pubkey, 5);
    return res.json({ success: true, runs });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  handleStatus,
  handleUpdate,
  handleTrigger,
  handleHistory,
  initCustomerSchedulers,
};
