/**
 * entryResolver — fire-time resolution for scheduled-task entries
 * (story #24 / ADR 0021).
 *
 * Called by the processor's `if (entryId)` branch on every scheduled fire.
 * Reads /var/lib/brainstorm/scheduled-tasks.json FRESH (no caching — the
 * file is the source of truth and small enough to re-read cheaply),
 * re-validates the entry against the current registry, and resolves the
 * customer triple via CustomerManager. On failure, the entry is
 * auto-disabled and its BullMQ Job Scheduler is removed from Redis so
 * the fire-and-fail loop can't continue.
 *
 * This module is the bounded coupling point between the processor (which
 * stayed reconciliation-agnostic in ADR 0019) and the scheduled-tasks
 * config model: the processor's only import from this concern is this
 * single helper file.
 *
 * Exports:
 *   - resolveScheduledEntry(entryId, taskDef) →
 *       { ok: true,  customerArgs?, queryParams? }
 *     | { ok: false, error: { code, message, field?, pubkey? } }
 *   - disableEntryWithError(entryId, error) — persists enabled=false
 *     + lastError to the config file, removes the Job Scheduler, emits
 *     a structured ENTRY_AUTO_DISABLED event.
 *
 * Used by:
 *   - src/manage/taskQueue/queue/processor.js → processJob (the
 *     `if (entryId)` branch)
 *   - test/scheduled-tasks-with-arguments.test.js → T21–T25
 */

const fs = require('fs');
const path = require('path');
const brainstormConfig = require('../../../utils/brainstormConfig');
const { migrateConfigIfNeeded } = require('../../../api/scheduled-tasks/migration');
const { validateEntry } = require('../../../api/scheduled-tasks/validation');

// Lazy require for ./scheduler — that module transitively pulls in BullMQ
// via taskQueue/queue/index.js. Loading it eagerly would make entryResolver
// unrequireable in test environments that don't have bullmq installed (the
// host runs `npm test` against a stripped node_modules; bullmq is a
// runtime-only dep in the container). The functions below only need
// scheduler.removeSchedule, which is called on a real fire-time auto-disable
// — by then BullMQ is loaded.
function getScheduler() { return require('./scheduler'); }

const CONFIG_PATH = '/var/lib/brainstorm/scheduled-tasks.json';
const EVENTS_PATH = '/var/log/brainstorm/taskQueue/events.jsonl';

// ── Internal helpers ──────────────────────────────────────────────────

function loadRegistry() {
  const registryPath = path.join(
    brainstormConfig.get('BRAINSTORM_MODULE_MANAGE_DIR'),
    'taskQueue/taskRegistry.json'
  );
  return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
}

function readConfig() {
  let parsed = null;
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    }
  } catch (e) {
    console.error('[entryResolver] Error reading scheduled-tasks.json:', e.message);
  }
  // Defensive: pipe through migrateConfigIfNeeded in case the file is still
  // in ADR 0019's v1 shape (the boot reconcile normally writes back v2 quickly,
  // but a fire-before-first-write would otherwise see no entries).
  let registry = null;
  try { registry = loadRegistry(); } catch (_e) { /* fall through with null registry */ }
  return migrateConfigIfNeeded(parsed, registry);
}

function writeConfig(config) {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function emitAutoDisabledEvent(entryId, taskId, error) {
  // Append a single JSONL record so the panel's history surface (and BullBoard,
  // indirectly) can show the auto-disable cause. Best-effort — never throws.
  try {
    const dir = path.dirname(EVENTS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const record = {
      eventType: 'ENTRY_AUTO_DISABLED',
      entryId,
      taskName: taskId,                          // matches the existing per-task history keying
      timestamp: new Date().toISOString(),
      error,
    };
    fs.appendFileSync(EVENTS_PATH, JSON.stringify(record) + '\n');
  } catch (e) {
    console.error('[entryResolver] Failed to emit ENTRY_AUTO_DISABLED event:', e.message);
  }
}

/**
 * Build the queryParams object the processor's buildChildArgs expects from
 * an entry's args. Mirrors the legacy /api/run-task query-string shape so
 * the processor doesn't need a separate code path for scheduled fires.
 */
function buildQueryParamsFromArgs(args) {
  const qp = {};
  if (args && typeof args === 'object') {
    if (args.warmStart === true) qp.warmStart = 'true';
    if (typeof args.limit === 'number' && args.limit >= 0) qp.limit = String(args.limit);
    // limit may also arrive as a string from the modal; tolerate that.
    else if (typeof args.limit === 'string' && args.limit !== '') qp.limit = args.limit;
  }
  return qp;
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Fire-time resolution: load the entry, re-validate, resolve customer.
 *
 * Note: `taskDef` is accepted as a forward-compatible parameter but the
 * registry is reloaded fresh here so that a mid-life registry change is
 * actually caught (the Worker's closed-over taskDef snapshot may be
 * stale). If you have a recent registry handy, pass it via taskDef;
 * otherwise we'll load it.
 */
async function resolveScheduledEntry(entryId, taskDef) {
  // (1) Load fresh config + find the entry.
  const config = readConfig();
  const entry = config.entries.find(e => e.id === entryId);
  if (!entry) {
    return {
      ok: false,
      error: {
        code: 'INVALID_ENTRY',
        message: `Scheduled entry '${entryId}' not found in scheduled-tasks.json — was it deleted between upsert and fire?`,
      },
    };
  }

  // (2) Load fresh registry + re-validate. Catches a registry change that
  //     made the entry's args invalid since upsert.
  let registry;
  try { registry = loadRegistry(); }
  catch (e) {
    return {
      ok: false,
      error: { code: 'REGISTRY_UNAVAILABLE', message: `Could not load task registry: ${e.message}` },
    };
  }
  const validation = validateEntry(entry, registry);
  if (!validation.ok) {
    const first = validation.errors[0] || { code: 'INVALID_ENTRY', message: 'unknown validation error' };
    return {
      ok: false,
      error: { code: first.code, field: first.field, message: first.message },
    };
  }

  // (3) For customer-task entries, resolve the customer triple via
  //     CustomerManager. Lookup miss → CUSTOMER_NOT_FOUND auto-disable trigger.
  let customerArgs = null;
  const task = registry.tasks[entry.taskId];
  if (task && task.arguments && task.arguments.customer === true) {
    const customerPubkey = entry.args && entry.args.customer;
    try {
      const CustomerManager = require('../../../utils/customerManager');
      const cm = new CustomerManager();
      await cm.initialize();
      const customer = await cm.getCustomer(customerPubkey);
      if (!customer) {
        return {
          ok: false,
          error: {
            code: 'CUSTOMER_NOT_FOUND',
            field: 'customer',
            message: `Customer ${customerPubkey} no longer exists; entry auto-disabled`,
            pubkey: customerPubkey,
          },
        };
      }
      customerArgs = {
        pubkey: customer.pubkey,
        customerId: customer.id.toString(),
        customerName: customer.name,
      };
    } catch (e) {
      return {
        ok: false,
        error: {
          code: 'CUSTOMER_LOOKUP_ERROR',
          field: 'customer',
          message: `CustomerManager lookup failed: ${e.message}`,
          pubkey: customerPubkey,
        },
      };
    }
  }

  // (4) Build queryParams (warmStart / limit) from entry.args.
  const queryParams = buildQueryParamsFromArgs(entry.args);

  return { ok: true, customerArgs, queryParams };
}

/**
 * Auto-disable an entry: persists enabled=false + lastError to disk and
 * removes the BullMQ Job Scheduler so the entry can't fire again.
 * Also emits an ENTRY_AUTO_DISABLED structured event to events.jsonl.
 *
 * Best-effort across all three side effects: a failure in one does not
 * prevent the others (e.g., Redis unreachable shouldn't block the
 * config-file persistence).
 */
async function disableEntryWithError(entryId, error) {
  const errorWithTimestamp = { ...error, at: new Date().toISOString() };
  let taskId = null;

  // (1) Persist enabled=false + lastError to scheduled-tasks.json.
  try {
    const config = readConfig();
    const entry = config.entries.find(e => e.id === entryId);
    if (entry) {
      taskId = entry.taskId;
      entry.enabled = false;
      entry.lastError = errorWithTimestamp;
      writeConfig(config);
    }
  } catch (e) {
    console.error(`[entryResolver] Failed to persist disable for entry ${entryId}:`, e.message);
  }

  // (2) Remove the BullMQ Job Scheduler.
  try {
    await getScheduler().removeSchedule(entryId, taskId);
  } catch (e) {
    console.error(`[entryResolver] Failed to remove Job Scheduler for entry ${entryId}:`, e.message);
  }

  // (3) Emit the structured event (best-effort).
  emitAutoDisabledEvent(entryId, taskId, errorWithTimestamp);
}

module.exports = {
  resolveScheduledEntry,
  disableEntryWithError,
  // Exported for testability / reuse.
  buildQueryParamsFromArgs,
};
