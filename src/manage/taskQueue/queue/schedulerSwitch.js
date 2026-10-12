/**
 * The task scheduler's kill switch (ADR task-queue-scheduler/0019 Q1), on its own so a reader can ask it without loading
 * BullMQ (ADR assistant-self-map/0001 sub-decision 6): /etc/brainstorm-task-queue.json { "scheduler": false } halts
 * all scheduling. Default true (absent or unreadable → on). scheduler.js re-exports it.
 */

const fs = require('fs');

const QUEUE_CONFIG_PATH = '/etc/brainstorm-task-queue.json';

function schedulerEnabled() {
  try {
    if (fs.existsSync(QUEUE_CONFIG_PATH)) {
      const raw = JSON.parse(fs.readFileSync(QUEUE_CONFIG_PATH, 'utf8'));
      if (raw && raw.scheduler === false) return false;
    }
  } catch (_e) { /* default on */ }
  return true;
}

module.exports = { schedulerEnabled, QUEUE_CONFIG_PATH };
