/**
 * Story #24 / ADR 0021 (amended 2026-05-23) — Per-task arguments + multiple
 * entries per task in the Scheduled Tasks panel, built on `origin/staging`'s
 * ADR 0019 (BullMQ Job Schedulers).
 *
 * Approach (matches stories #4, #13, #16):
 *  - **Behavioral unit tests** for the two pure modules the ADR introduces
 *    (`src/api/scheduled-tasks/migration.js`,
 *     `src/api/scheduled-tasks/validation.js`). Their entire purpose is to be
 *    tested in isolation; we `require()` them and exercise the contracts
 *    end-to-end against the live registry.
 *  - **Source / structural sentinels** for the backend refactor: per-entry
 *    BullMQ Job Schedulers (`sched:${entry.id}`); per-entry reconcile;
 *    customer resolution at fire time via the new entryResolver; the
 *    processor's `if (entryId)` branch; the new CRUD + registry-tasks
 *    handlers; route registrations.
 *  - **Source sentinels** for the frontend additions
 *    (`AddOrEditEntryModal.jsx`, `CustomerPicker.jsx`,
 *    `argFieldRenderer.jsx`, list-driven `ScheduledTasksPanel`,
 *    client-side `/api/get-customers` cross-check for display-label + badge).
 *  - **Regression guards** for the two existing entries' survival
 *    (story #4's `HousePovUnconfiguredBanner` + ADR 0019's
 *    `reconcileSchedulesFromConfig` boot hook).
 *
 * The behavioral round-trip — opening the modal, picking a customer,
 * watching `processCustomer` for Alice and Bob fire on independent
 * cadences, deleting a customer and observing fire-time auto-disable —
 * is reproducible only against the live Docker stack and is the
 * Reviewer-driven cycle-local smoke per the test plan.
 *
 * T1..T33 : FAIL pre-implementation, PASS post.
 * R1..R2  : PASS pre AND post — regression guards.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const SCHEDULER_API_PATH   = path.join(ROOT, 'src/api/scheduled-tasks/index.js');
const MIGRATION_PATH       = path.join(ROOT, 'src/api/scheduled-tasks/migration.js');
const VALIDATION_PATH      = path.join(ROOT, 'src/api/scheduled-tasks/validation.js');
const SCHEDULER_QUEUE_PATH = path.join(ROOT, 'src/manage/taskQueue/queue/scheduler.js');
const ENTRY_RESOLVER_PATH  = path.join(ROOT, 'src/manage/taskQueue/queue/entryResolver.js');
const PROCESSOR_PATH       = path.join(ROOT, 'src/manage/taskQueue/queue/processor.js');
const ROUTES_PATH          = path.join(ROOT, 'src/api/index.js');
const REGISTRY_PATH        = path.join(ROOT, 'src/manage/taskQueue/taskRegistry.json');
const RELAY_SETTINGS_PATH  = path.join(ROOT, 'ui/src/pages/settings/RelaySettings.jsx');
const MODAL_PATH           = path.join(ROOT, 'ui/src/pages/settings/scheduledTasks/AddOrEditEntryModal.jsx');
const CUSTOMER_PICKER_PATH = path.join(ROOT, 'ui/src/pages/settings/scheduledTasks/CustomerPicker.jsx');
const ARG_FIELD_PATH       = path.join(ROOT, 'ui/src/pages/settings/scheduledTasks/argFieldRenderer.jsx');

function readSafe(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }

function safeRequire(p) {
  try { delete require.cache[require.resolve(p)]; } catch (_e) { /* not yet loaded */ }
  try { return { ok: true, module: require(p) }; }
  catch (e) { return { ok: false, error: e.message }; }
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

// 64-char lowercase hex fixture pubkeys.
const ALICE_PUBKEY = 'a'.repeat(64);
const BOB_PUBKEY   = 'b'.repeat(64);

// ─────────────────────────────────────────────────────────────────────────
// MIGRATION SUITE (AC-11, AC-12; ADR §Tests "Migration")
//
// migration.js is a pure module: takes a parsed JSON object + registry,
// returns the v2 shape. Idempotent. Deterministic. We exercise it directly.
//
// v1 SHAPE is now ADR 0019's per-task shape with 5 schedule fields
// (intervalDays / intervalHours / intervalMinutes / cron, plus enabled),
// NOT ADR 0003's 3-field shape — migration must preserve all 5.
// ─────────────────────────────────────────────────────────────────────────

test('T1: src/api/scheduled-tasks/migration.js exists and exports migrateConfigIfNeeded', () => {
  const r = safeRequire(MIGRATION_PATH);
  assert(r.ok, `migration module missing or unparseable at ${MIGRATION_PATH}: ${r.error}. ADR 0021 §Files-to-add pins this module.`);
  assert(typeof r.module.migrateConfigIfNeeded === 'function',
    'migration.js must export a function `migrateConfigIfNeeded(loadedJson, registry) → { version, entries }` per ADR 0021.');
});

test('T2: migration converts v1 (ADR 0019 5-field) shape to v2 entries with stable legacy:<taskId> IDs, preserving ALL FIVE schedule fields bit-for-bit', () => {
  const r = safeRequire(MIGRATION_PATH);
  assert(r.ok, `migration module unavailable: ${r.error}`);
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));

  // v1 shape per ADR 0019: { [taskId]: { enabled, intervalDays, intervalHours, intervalMinutes, cron } }
  const v1 = {
    updateAllScoresForOwner: { enabled: true,  intervalDays: 0, intervalHours: 12, intervalMinutes: 0,  cron: '' },
    refreshSearchIndex:      { enabled: false, intervalDays: 1, intervalHours:  6, intervalMinutes: 30, cron: '' },
    reconcileRecent:         { enabled: true,  intervalDays: 0, intervalHours:  0, intervalMinutes: 10, cron: '' },
    reconcileAll:            { enabled: false, intervalDays: 0, intervalHours:  0, intervalMinutes: 0,  cron: '0 4 * * 0' },
  };
  const v2 = r.module.migrateConfigIfNeeded(v1, registry);

  assert(v2 && v2.version === 2,
    `migration must produce { version: 2, ... }; got: ${JSON.stringify(v2)}`);
  assert(Array.isArray(v2.entries) && v2.entries.length === 4,
    `migration of 4 v1 entries must produce a 4-element entries array; got length: ${v2.entries?.length}`);

  const byId = Object.fromEntries(v2.entries.map(e => [e.id, e]));
  const owner       = byId['legacy:updateAllScoresForOwner'];
  const refresh     = byId['legacy:refreshSearchIndex'];
  const reconcileR  = byId['legacy:reconcileRecent'];
  const reconcileA  = byId['legacy:reconcileAll'];
  assert(owner && refresh && reconcileR && reconcileA,
    `migration must assign id "legacy:<taskId>" to each migrated entry (stable for backward-compat) — got ids: ${v2.entries.map(e=>e.id).join(', ')}`);

  // Owner: enabled, 12h interval
  assert(owner.taskId === 'updateAllScoresForOwner', `legacy Owner taskId; got: ${owner.taskId}`);
  assert(owner.enabled === true,           `legacy Owner enabled preserved (true→true); got: ${owner.enabled}`);
  assert(owner.intervalDays === 0,         `legacy Owner intervalDays preserved (0); got: ${owner.intervalDays}`);
  assert(owner.intervalHours === 12,       `legacy Owner intervalHours preserved (12); got: ${owner.intervalHours}`);
  assert(owner.intervalMinutes === 0,      `legacy Owner intervalMinutes preserved (0); got: ${owner.intervalMinutes}`);
  assert(owner.cron === '',                `legacy Owner cron preserved (''); got: ${JSON.stringify(owner.cron)}`);
  assert(owner.args && Object.keys(owner.args).length === 0,
    `legacy Owner args must be empty object {} (no args at migration time); got: ${JSON.stringify(owner.args)}`);

  // Refresh: disabled, 1d + 6h + 30min
  assert(refresh.intervalDays === 1,       `legacy refresh intervalDays preserved (1); got: ${refresh.intervalDays}`);
  assert(refresh.intervalHours === 6,      `legacy refresh intervalHours preserved (6); got: ${refresh.intervalHours}`);
  assert(refresh.intervalMinutes === 30,   `legacy refresh intervalMinutes preserved (30); got: ${refresh.intervalMinutes}`);
  assert(refresh.cron === '',              `legacy refresh cron preserved (''); got: ${JSON.stringify(refresh.cron)}`);

  // reconcileRecent: sub-hour (10min) — proves ADR 0019's intervalMinutes carries through
  assert(reconcileR.intervalMinutes === 10, `legacy reconcileRecent intervalMinutes preserved (10); got: ${reconcileR.intervalMinutes}`);

  // reconcileAll: cron pattern — proves ADR 0019's cron string carries through unchanged
  assert(reconcileA.cron === '0 4 * * 0',   `legacy reconcileAll cron preserved ('0 4 * * 0'); got: ${JSON.stringify(reconcileA.cron)}`);
});

test('T3: migration of a v2 object passes through unchanged (idempotent on already-migrated config)', () => {
  const r = safeRequire(MIGRATION_PATH);
  assert(r.ok, `migration module unavailable: ${r.error}`);
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));

  const v2In = {
    version: 2,
    entries: [
      { id: 'legacy:updateAllScoresForOwner', taskId: 'updateAllScoresForOwner', label: 'Update All Scores for Owner', args: {}, enabled: true, intervalDays: 0, intervalHours: 24, intervalMinutes: 0, cron: '' },
      { id: 'uuid-alice', taskId: 'processCustomer', label: 'Process Customer — Alice', args: { customer: ALICE_PUBKEY }, enabled: true, intervalDays: 0, intervalHours: 6, intervalMinutes: 0, cron: '' },
    ],
  };
  const v2Out = r.module.migrateConfigIfNeeded(v2In, registry);
  assert(v2Out.version === 2,
    `v2 input must round-trip to v2 output; got version: ${v2Out.version}`);
  assert(v2Out.entries.length === 2,
    `v2 input with 2 entries must produce 2 entries; got: ${v2Out.entries.length}`);
  assert(v2Out.entries.some(e => e.id === 'uuid-alice' && e.args?.customer === ALICE_PUBKEY),
    `v2 entries must pass through with args intact; got: ${JSON.stringify(v2Out.entries)}`);
});

test('T4: migration of empty / falsy input produces v2 with empty entries array (fresh-install posture)', () => {
  const r = safeRequire(MIGRATION_PATH);
  assert(r.ok, `migration module unavailable: ${r.error}`);
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));

  for (const empty of [{}, null]) {
    const v2 = r.module.migrateConfigIfNeeded(empty, registry);
    assert(v2 && v2.version === 2,
      `migration of empty input (${JSON.stringify(empty)}) must produce { version: 2, ... }; got: ${JSON.stringify(v2)}`);
    assert(Array.isArray(v2.entries) && v2.entries.length === 0,
      `migration of empty input must produce empty entries array; got: ${JSON.stringify(v2.entries)}`);
  }
});

test('T5: migration is idempotent — migrate(migrate(v1)) is deep-equal to migrate(v1)', () => {
  const r = safeRequire(MIGRATION_PATH);
  assert(r.ok, `migration module unavailable: ${r.error}`);
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));

  const v1 = {
    updateAllScoresForOwner: { enabled: false, intervalDays: 0, intervalHours: 24, intervalMinutes: 0, cron: '' },
    refreshSearchIndex:      { enabled: false, intervalDays: 0, intervalHours: 24, intervalMinutes: 0, cron: '' },
  };
  const once = r.module.migrateConfigIfNeeded(v1, registry);
  const twice = r.module.migrateConfigIfNeeded(once, registry);
  assert(JSON.stringify(once) === JSON.stringify(twice),
    `migration must be idempotent (a v2 input round-trips). once=${JSON.stringify(once)}; twice=${JSON.stringify(twice)}`);
});

// ─────────────────────────────────────────────────────────────────────────
// VALIDATION SUITE (AC-6, AC-10; ADR §Tests "CRUD" / "Deleted-customer")
//
// validation.js is the entrypoint for HTTP-handler validation AND for
// fire-time re-validation inside entryResolver. Tests exercise the
// contract end-to-end.
// ─────────────────────────────────────────────────────────────────────────

test('T6: src/api/scheduled-tasks/validation.js exists and exports validateEntry', () => {
  const r = safeRequire(VALIDATION_PATH);
  assert(r.ok, `validation module missing or unparseable at ${VALIDATION_PATH}: ${r.error}. ADR 0021 §Files-to-add pins this module.`);
  assert(typeof r.module.validateEntry === 'function',
    'validation.js must export `validateEntry(entry, registry) → { ok, errors }` per ADR 0021.');
});

test('T7: validateEntry rejects an entry whose taskId is not in the registry (UNKNOWN_TASK)', () => {
  const r = safeRequire(VALIDATION_PATH);
  assert(r.ok, `validation module unavailable: ${r.error}`);
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  const entry = { id: 'uuid-x', taskId: 'nonExistentTask', args: {}, enabled: true, intervalHours: 24, intervalDays: 0 };
  const result = r.module.validateEntry(entry, registry);
  assert(result && result.ok === false,
    `validateEntry must reject an unknown taskId; got: ${JSON.stringify(result)}`);
  assert(Array.isArray(result.errors) && result.errors.some(e => e.field === 'taskId'),
    `validateEntry must return at least one error with field="taskId" when taskId is unknown; got errors: ${JSON.stringify(result.errors)}`);
});

test('T8: validateEntry rejects a taskId whose registry frequency is "continuous" (queue daemon, not schedulable)', () => {
  const r = safeRequire(VALIDATION_PATH);
  assert(r.ok, `validation module unavailable: ${r.error}`);
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  const continuousTaskId = Object.keys(registry.tasks).find(k => registry.tasks[k].frequency === 'continuous');
  assert(continuousTaskId, 'precondition: registry must declare at least one continuous task — none found, the test is moot.');
  const entry = { id: 'uuid-x', taskId: continuousTaskId, args: {}, enabled: true, intervalHours: 24, intervalDays: 0 };
  const result = r.module.validateEntry(entry, registry);
  assert(result && result.ok === false,
    `validateEntry must reject taskId="${continuousTaskId}" because its registry frequency is "continuous"; got: ${JSON.stringify(result)}`);
});

test('T9: validateEntry rejects a customer-task entry whose args.customer is missing (CUSTOMER_REQUIRED)', () => {
  const r = safeRequire(VALIDATION_PATH);
  assert(r.ok, `validation module unavailable: ${r.error}`);
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  const entry = { id: 'uuid-x', taskId: 'processCustomer', args: {}, enabled: true, intervalHours: 6, intervalDays: 0 };
  const result = r.module.validateEntry(entry, registry);
  assert(result && result.ok === false,
    `validateEntry must reject processCustomer with no customer arg (AC-6); got: ${JSON.stringify(result)}`);
  assert(Array.isArray(result.errors) && result.errors.some(e => e.field === 'customer' || /customer/i.test(e.message || '')),
    `validateEntry must surface an error naming the customer field; got errors: ${JSON.stringify(result.errors)}`);
});

test('T10: validateEntry rejects malformed customer pubkeys (not 64-char lowercase hex)', () => {
  const r = safeRequire(VALIDATION_PATH);
  assert(r.ok, `validation module unavailable: ${r.error}`);
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));

  const malformed = [
    'too-short',
    'A'.repeat(64),     // uppercase (ADR 0021 pins lowercase per CustomerManager canon)
    'g'.repeat(64),     // non-hex character
    'z'.repeat(64),
    'a'.repeat(63),     // off-by-one
    '',                 // empty string
  ];
  for (const customer of malformed) {
    const entry = { id: 'uuid-x', taskId: 'processCustomer', args: { customer }, enabled: true, intervalHours: 6, intervalDays: 0 };
    const result = r.module.validateEntry(entry, registry);
    assert(result && result.ok === false,
      `validateEntry must reject malformed customer pubkey "${customer}" (expected 64-char lowercase hex); got ok=${result?.ok}`);
  }
});

test('T11: validateEntry accepts a well-formed processCustomer entry with a cron schedule (ADR 0019 cron field flows through)', () => {
  const r = safeRequire(VALIDATION_PATH);
  assert(r.ok, `validation module unavailable: ${r.error}`);
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  const entry = {
    id: 'uuid-x',
    taskId: 'processCustomer',
    args: { customer: ALICE_PUBKEY, warmStart: false },
    enabled: true,
    intervalDays: 0, intervalHours: 0, intervalMinutes: 0,
    cron: '0 */6 * * *',   // every 6 hours
  };
  const result = r.module.validateEntry(entry, registry);
  assert(result && result.ok === true,
    `validateEntry must accept a well-formed processCustomer entry with a cron schedule; got: ${JSON.stringify(result)}`);
});

test('T12: validateEntry accepts a no-args legacy entry (updateAllScoresForOwner has no required args)', () => {
  const r = safeRequire(VALIDATION_PATH);
  assert(r.ok, `validation module unavailable: ${r.error}`);
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  const entry = { id: 'legacy:updateAllScoresForOwner', taskId: 'updateAllScoresForOwner', args: {}, enabled: true, intervalDays: 0, intervalHours: 24, intervalMinutes: 0, cron: '' };
  const result = r.module.validateEntry(entry, registry);
  assert(result && result.ok === true,
    `validateEntry must accept a migrated no-args legacy entry (AC-11 "Existing entries survive the upgrade"); got: ${JSON.stringify(result)}`);
});

test('T13: validateEntry rejects an enabled entry whose schedule has neither a positive interval nor a cron (ADR 0019 isValidSchedule rule)', () => {
  const r = safeRequire(VALIDATION_PATH);
  assert(r.ok, `validation module unavailable: ${r.error}`);
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  const entry = {
    id: 'uuid-x',
    taskId: 'processCustomer',
    args: { customer: ALICE_PUBKEY },
    enabled: true,
    intervalDays: 0, intervalHours: 0, intervalMinutes: 0,
    cron: '',  // no schedule at all + enabled = invalid per ADR 0019 (no 1h floor, but SOMETHING must be specified)
  };
  const result = r.module.validateEntry(entry, registry);
  assert(result && result.ok === false,
    `validateEntry must reject an enabled entry with no cron AND no positive interval — ADR 0019's isValidSchedule rule (no 1h floor, but SOMETHING must be set); got: ${JSON.stringify(result)}`);
});

// ─────────────────────────────────────────────────────────────────────────
// SCHEDULER REFACTOR SENTINELS (AC-1, AC-4, AC-7, AC-10, AC-12, AC-13)
//
// The amended ADR 0021 extends ADR 0019's per-task BullMQ Job Schedulers
// to per-entry. The schedulerId becomes `sched:${entry.id}`; reconcile
// iterates config.entries; the job-data payload is minimal (taskName +
// entryId + timeoutMs) because args are resolved at FIRE time in the
// processor's new branch (NOT at upsert time).
// ─────────────────────────────────────────────────────────────────────────

test('T14: src/api/scheduled-tasks/index.js readConfig invokes migrateConfigIfNeeded so on-disk v1 files are auto-upgraded (AC-11, AC-12)', () => {
  const src = readSafe(SCHEDULER_API_PATH);
  assert(src, `cannot read ${SCHEDULER_API_PATH}`);
  assert(/migrateConfigIfNeeded/.test(src),
    'src/api/scheduled-tasks/index.js must call migrateConfigIfNeeded (from ./migration) inside readConfig so v1 (ADR 0019 shape) → v2 happens transparently on first read. ADR 0021 §Files-to-edit.');
  assert(/require\(['"]\.\/migration['"]\)/.test(src) || /from\s+['"]\.\/migration['"]/.test(src),
    'src/api/scheduled-tasks/index.js must require("./migration") (or ES-import equivalent) to obtain migrateConfigIfNeeded.');
});

test('T15: src/manage/taskQueue/queue/scheduler.js calls upsertJobScheduler with `sched:${entry.id}` schedulerId (per-entry, not per-task) — AC-4', () => {
  const src = readSafe(SCHEDULER_QUEUE_PATH);
  assert(src, `cannot read ${SCHEDULER_QUEUE_PATH}`);
  assert(/upsertJobScheduler/.test(src),
    'scheduler.js must continue to call upsertJobScheduler (ADR 0019 contract).');
  // ADR 0021 pins schedulerId = `sched:${entry.id}`. The original ADR 0019 was `sched:${taskId}`.
  // The amendment must reference entry.id (not taskId) in the schedulerId computation.
  assert(/entry\.id/.test(src) || /entryId/.test(src),
    'scheduler.js must reference `entry.id` (or `entryId`) in the schedulerId construction — ADR 0021 changes ADR 0019\'s `sched:${taskId}` to `sched:${entry.id}` to support multiple Job Schedulers per task (AC-4).');
});

test('T16: scheduler.js\'s reconcileSchedules iterates config.entries (per-entry, not per-task)', () => {
  const src = readSafe(SCHEDULER_QUEUE_PATH);
  assert(src, `cannot read ${SCHEDULER_QUEUE_PATH}`);
  assert(/reconcileSchedules/.test(src),
    'scheduler.js must export reconcileSchedules (ADR 0019 contract).');
  // ADR 0021 changes reconcileSchedules from iterating `Object.entries(config)` (ADR 0019)
  // to iterating `config.entries` (the v2 array).
  assert(/config\.entries/.test(src),
    'scheduler.js\'s reconcileSchedules must iterate `config.entries` (the v2 array shape) — ADR 0021 changes ADR 0019\'s `Object.entries(config)` per-task iteration.');
});

test('T17: scheduler.js does NOT call CustomerManager — customer resolution moved to fire time (entryResolver)', () => {
  const src = readSafe(SCHEDULER_QUEUE_PATH);
  assert(src, `cannot read ${SCHEDULER_QUEUE_PATH}`);
  // ADR 0021 §Decision: "boot reconcile does NOT call CustomerManager — customer existence is no longer the
  // boot reconcile's concern (the processor handles it per fire)." This is a deliberate anti-pattern check.
  assert(!/CustomerManager/.test(src),
    'scheduler.js must NOT reference CustomerManager — ADR 0021 moves customer resolution to FIRE time via the processor branch + entryResolver. A CustomerManager reference in scheduler.js means upsert-time resolution was reintroduced (Option D, explicitly rejected).');
  assert(!/getCustomer/.test(src),
    'scheduler.js must NOT call getCustomer — see above (ADR 0021 Option A vs Option D).');
});

test('T18: scheduler.js\'s upsertJobScheduler job-data carries `entryId` (not customerArgs/queryParams — those resolve at fire time)', () => {
  const src = readSafe(SCHEDULER_QUEUE_PATH);
  assert(src, `cannot read ${SCHEDULER_QUEUE_PATH}`);
  // The minimal job-data per ADR 0021: { taskName, entryId, timeoutMs }. NO customerArgs/queryParams
  // because the processor's fire-time branch resolves them fresh.
  assert(/entryId/.test(src),
    'scheduler.js\'s upsertSchedule must include `entryId` in the BullMQ job-data payload so the processor\'s fire-time branch can look the entry up — ADR 0021 §Option-A point 4.');
  // Negative: NO customerArgs/queryParams should appear in scheduler.js — those belong to entryResolver / processor.
  assert(!/customerArgs/.test(src),
    'scheduler.js must NOT pack `customerArgs` into the job-data — ADR 0021 resolves customer state at fire time via entryResolver, not at upsert time (Option A vs Option D).');
});

test('T19: src/api/scheduled-tasks/index.js exports the per-entry CRUD handlers + reconcileSchedulesFromConfig + handleRegistryTasks', () => {
  const r = safeRequire(SCHEDULER_API_PATH);
  assert(r.ok, `scheduler API module unavailable: ${r.error}`);
  const m = r.module;
  assert(typeof m.handleList   === 'function', 'must export handleList (ADR 0019 already exports this; ADR 0021 changes handler body to per-entry).');
  assert(typeof m.handleCreate === 'function', 'must export handleCreate (new endpoint per ADR 0021).');
  assert(typeof m.handleDelete === 'function', 'must export handleDelete (new endpoint per ADR 0021).');
  assert(typeof m.handleUpdate === 'function', 'must continue to export handleUpdate (regression guard).');
  assert(typeof m.handleStatus === 'function', 'must continue to export handleStatus (regression guard).');
  assert(typeof m.handleHistory === 'function','must continue to export handleHistory (regression guard).');
  assert(typeof m.handleRegistryTasks === 'function' ||
         typeof m.handleAddableTasks === 'function' ||
         typeof m.handleSchedulableTasks === 'function',
    `must export a handler powering GET /api/scheduled-tasks/registry-tasks (the dropdown source). Got exports: ${Object.keys(m).join(', ')}`);
  assert(typeof m.reconcileSchedulesFromConfig === 'function',
    'must continue to export reconcileSchedulesFromConfig (ADR 0019 boot hook; bin/control-panel.js calls it at startup — AC-12 "Persistence across restarts").');
});

// ─────────────────────────────────────────────────────────────────────────
// API ROUTE SENTINELS (AC-1, AC-4, AC-6)
// ─────────────────────────────────────────────────────────────────────────

test('T20: src/api/index.js registers list/create/delete/registry-tasks routes', () => {
  const src = readSafe(ROUTES_PATH);
  assert(src, `cannot read ${ROUTES_PATH}`);
  assert(/\/api\/scheduled-tasks\/list/.test(src),
    "src/api/index.js must register GET /api/scheduled-tasks/list (ADR 0019 already registered; ADR 0021 changes the response shape).");
  assert(/\/api\/scheduled-tasks\/create/.test(src),
    "src/api/index.js must register POST /api/scheduled-tasks/create (new endpoint per ADR 0021).");
  assert(/\/api\/scheduled-tasks\/delete/.test(src),
    "src/api/index.js must register POST /api/scheduled-tasks/delete (new endpoint per ADR 0021).");
  assert(/\/api\/scheduled-tasks\/registry-tasks/.test(src),
    "src/api/index.js must register GET /api/scheduled-tasks/registry-tasks (the parameterized-task subset for the modal's task picker).");
});

// ─────────────────────────────────────────────────────────────────────────
// ENTRY RESOLVER MODULE SENTINELS (AC-7, AC-10) — NEW for ADR 0021 amendment
//
// The entryResolver is the fire-time helper called by the processor's
// `if (entryId)` branch. It re-loads the entry from disk, re-validates,
// and resolves the customer triple fresh via CustomerManager.
// ─────────────────────────────────────────────────────────────────────────

test('T21: src/manage/taskQueue/queue/entryResolver.js exists and exports resolveScheduledEntry + disableEntryWithError', () => {
  const r = safeRequire(ENTRY_RESOLVER_PATH);
  assert(r.ok, `entryResolver module missing or unparseable at ${ENTRY_RESOLVER_PATH}: ${r.error}. ADR 0021 §Files-to-add pins this module.`);
  assert(typeof r.module.resolveScheduledEntry === 'function',
    'entryResolver.js must export `resolveScheduledEntry(entryId, taskDef) → { ok, customerArgs?, queryParams?, error? }` per ADR 0021 §Files-to-add.');
  assert(typeof r.module.disableEntryWithError === 'function',
    'entryResolver.js must export `disableEntryWithError(entryId, error)` per ADR 0021 §Files-to-add.');
});

test('T22: entryResolver.js reads scheduled-tasks.json and calls validateEntry', () => {
  const src = readSafe(ENTRY_RESOLVER_PATH);
  assert(src, `cannot read ${ENTRY_RESOLVER_PATH}`);
  // ADR 0021: "Loads /var/lib/brainstorm/scheduled-tasks.json (fresh fs.readFileSync each call)."
  assert(/scheduled-tasks\.json/.test(src) || /readConfig/.test(src),
    'entryResolver.js must load /var/lib/brainstorm/scheduled-tasks.json (or call readConfig) to fetch the current entry state — ADR 0021 §Option-A point 5.');
  // ADR 0021: "Re-validates via validateEntry(entry, registry) — catches a registry change that made the args invalid since upsert."
  assert(/validateEntry/.test(src),
    'entryResolver.js must call validateEntry to re-validate the entry against the current registry at fire time — ADR 0021 §Option-A point 5.');
});

test('T23: entryResolver.js imports CustomerManager and calls getCustomer (fire-time customer resolution)', () => {
  const src = readSafe(ENTRY_RESOLVER_PATH);
  assert(src, `cannot read ${ENTRY_RESOLVER_PATH}`);
  assert(/CustomerManager/.test(src),
    'entryResolver.js must reference CustomerManager — fire-time customer resolution is the WHOLE point of this module (ADR 0021 Option A).');
  assert(/getCustomer/.test(src),
    'entryResolver.js must call getCustomer(entry.args.customer) to resolve the customer triple at fire time.');
});

test('T24: entryResolver.js surfaces CUSTOMER_NOT_FOUND as an error code (the AC-10 contract)', () => {
  const src = readSafe(ENTRY_RESOLVER_PATH);
  assert(src, `cannot read ${ENTRY_RESOLVER_PATH}`);
  assert(/CUSTOMER_NOT_FOUND/.test(src),
    'entryResolver.js must use the literal `CUSTOMER_NOT_FOUND` code when CustomerManager.getCustomer returns null/undefined — ADR 0021 §Open-Q-2; AC-10.');
});

test('T25: entryResolver.disableEntryWithError persists enabled=false + lastError and removes the Job Scheduler', () => {
  const src = readSafe(ENTRY_RESOLVER_PATH);
  assert(src, `cannot read ${ENTRY_RESOLVER_PATH}`);
  // ADR 0021 §Files-to-add bullet for disableEntryWithError: persists enabled=false, sets lastError, calls scheduler.removeSchedule.
  assert(/lastError/.test(src),
    'entryResolver.js disableEntryWithError must set `lastError` on the entry — ADR 0021 §Files-to-add.');
  assert(/enabled\s*[:=]\s*false/.test(src) || /enabled\s*=\s*false/.test(src),
    'entryResolver.js disableEntryWithError must persist `enabled: false` on the entry — ADR 0021 §Open-Q-2.');
  assert(/removeSchedule/.test(src) || /removeJobScheduler/.test(src),
    'entryResolver.js disableEntryWithError must drop the Job Scheduler from Redis (call scheduler.removeSchedule or queue.removeJobScheduler) — ADR 0021 §Files-to-add.');
});

// ─────────────────────────────────────────────────────────────────────────
// PROCESSOR BRANCH SENTINEL (AC-7, AC-10) — NEW for ADR 0021 amendment
// ─────────────────────────────────────────────────────────────────────────

test('T26: src/manage/taskQueue/queue/processor.js has the `if (entryId)` branch and imports from ./entryResolver', () => {
  const src = readSafe(PROCESSOR_PATH);
  assert(src, `cannot read ${PROCESSOR_PATH}`);
  // ADR 0021 §Files-to-edit: processor adds an `if (entryId)` branch that calls resolveScheduledEntry / disableEntryWithError.
  assert(/entryId/.test(src),
    'processor.js must reference `entryId` — the new branch is `if (entryId) { ... resolveScheduledEntry ... }` per ADR 0021 §Option-A point 5.');
  assert(/resolveScheduledEntry/.test(src),
    'processor.js must call resolveScheduledEntry (imported from ./entryResolver) — ADR 0021 §Option-A point 5.');
  // The import wiring. Accept require() or ES import.
  assert(/require\(['"]\.\/entryResolver['"]\)/.test(src) || /from\s+['"]\.\/entryResolver['"]/.test(src),
    'processor.js must require("./entryResolver") (or ES-import equivalent) — the new file is co-located by ADR 0021 to keep the layering visible.');
});

// ─────────────────────────────────────────────────────────────────────────
// FRONTEND SOURCE SENTINELS (AC-2, AC-3, AC-5, AC-6, AC-9, AC-13)
// ─────────────────────────────────────────────────────────────────────────

test('T27: AddOrEditEntryModal.jsx references registry-tasks + create/update endpoints + intervalMinutes/cron inputs (full ADR 0019 schedule surface)', () => {
  const src = readSafe(MODAL_PATH);
  assert(src, `cannot read ${MODAL_PATH} — modal must exist per ADR 0021 §Files-to-add.`);
  assert(/\/api\/scheduled-tasks\/registry-tasks/.test(src),
    'AddOrEditEntryModal.jsx must fetch /api/scheduled-tasks/registry-tasks for the task-picker dropdown.');
  assert(/\/api\/scheduled-tasks\/(create|update)/.test(src),
    'AddOrEditEntryModal.jsx must POST to /api/scheduled-tasks/create or /update on save.');
  // ADR 0021 §Files-to-add bullet: "add intervalMinutes and cron inputs to the schedule section" — ADR 0019 schedule surface.
  assert(/intervalMinutes/.test(src),
    'AddOrEditEntryModal.jsx must include an `intervalMinutes` input — ADR 0019 added sub-hour intervals; ADR 0021 carries them forward in the per-entry modal.');
  assert(/cron/i.test(src),
    'AddOrEditEntryModal.jsx must include a `cron` input — ADR 0019 added cron expressions; ADR 0021 carries them forward.');
});

test('T28: CustomerPicker.jsx exists and reuses /api/get-customers (AC-9)', () => {
  const src = readSafe(CUSTOMER_PICKER_PATH);
  assert(src, `cannot read ${CUSTOMER_PICKER_PATH} — CustomerPicker must exist per ADR 0021.`);
  assert(/\/api\/get-customers/.test(src),
    'CustomerPicker.jsx must fetch /api/get-customers (same source the legacy Task Explorer uses) — AC-9.');
});

test('T29: argFieldRenderer.jsx renders customer/boolean/optional cases plus a text-input fallback', () => {
  const src = readSafe(ARG_FIELD_PATH);
  assert(src, `cannot read ${ARG_FIELD_PATH} — argFieldRenderer must exist per ADR 0021.`);
  assert(/customer/i.test(src),
    'argFieldRenderer.jsx must handle the `customer` arg shape.');
  assert(/boolean/i.test(src),
    'argFieldRenderer.jsx must handle the `boolean` arg shape (e.g., warmStart).');
  assert(/optional/i.test(src) || /limit/i.test(src),
    'argFieldRenderer.jsx must handle the `optional` arg shape (e.g., limit).');
  assert(/default/i.test(src) || /fallback/i.test(src) || /unknown/i.test(src),
    'argFieldRenderer.jsx must have an explicit fallback for unknown arg shapes — ADR 0021 §Option-A point 10.');
});

test('T30: ScheduledTasksPanel fetches /api/scheduled-tasks/list (list-driven, not hardcoded taskIds)', () => {
  const src = readSafe(RELAY_SETTINGS_PATH);
  assert(src, `cannot read ${RELAY_SETTINGS_PATH}`);
  assert(/\/api\/scheduled-tasks\/list/.test(src),
    'RelaySettings.jsx ScheduledTasksPanel must fetch /api/scheduled-tasks/list — AC-1 + AC-4. ADR 0021 changes the response shape from ADR 0019\'s `{tasks:[]}` to `{entries:[]}`.');
});

test('T31: ScheduledEntryCard takes an `entry` object (id, taskId, label, args, …) — multi-entry-per-task UX (AC-5)', () => {
  const src = readSafe(RELAY_SETTINGS_PATH);
  assert(src, `cannot read ${RELAY_SETTINGS_PATH}`);
  const hasNewCardName = /ScheduledEntryCard/.test(src);
  const hasEntryProp   = /entry\.(id|taskId|label|args|enabled|intervalHours|intervalDays|intervalMinutes|cron)/.test(src);
  assert(hasNewCardName || hasEntryProp,
    'RelaySettings.jsx must rename ScheduledTaskCard → ScheduledEntryCard (or restructure it to accept an `entry` prop). Per ADR 0021: the card receives the full entry object so the listing renders one card per entry (AC-5).');
});

test('T32: AddOrEditEntryModal disables Save when required args are missing (AC-6 "Required arguments block save")', () => {
  const src = readSafe(MODAL_PATH);
  assert(src, `cannot read ${MODAL_PATH}`);
  assert(/disabled/i.test(src),
    'AddOrEditEntryModal.jsx must conditionally disable Save when required args are missing — AC-6.');
  assert(/required/i.test(src) || /validateEntry/i.test(src) || /errors/i.test(src),
    'AddOrEditEntryModal.jsx must compute a "missing required arg" state. Per ADR 0021, validation logic lives in src/api/scheduled-tasks/validation.js and the modal mirrors it client-side.');
});

test('T33: ScheduledTasksPanel cross-references /api/get-customers (client-side display-label + deleted-customer badge) — AC-5 + AC-10', () => {
  const src = readSafe(RELAY_SETTINGS_PATH);
  assert(src, `cannot read ${RELAY_SETTINGS_PATH}`);
  // ADR 0021 §Q4: "the panel computes a display-label at render time for customer-task entries: if the operator hasn't set
  // an explicit label, the panel re-derives '<task.name> — <current customer.name>' from the live customer list."
  // ADR 0021 §Q2: render-time UI badge cross-references /api/get-customers to surface deletions before the next fire.
  assert(/\/api\/get-customers/.test(src),
    'RelaySettings.jsx ScheduledTasksPanel must fetch /api/get-customers — (a) client-side display-label derivation for renamed customers (ADR 0021 §Q4), (b) render-time "customer no longer exists" badge for orphans (ADR 0021 §Q2).');
});

// ─────────────────────────────────────────────────────────────────────────
// REGRESSION SENTINELS (PASS pre AND post — story #24 must not break stories #4 or #22)
// ─────────────────────────────────────────────────────────────────────────

test('R1: HousePovUnconfiguredBanner from story #4 is still defined in RelaySettings.jsx (no regression on the refreshSearchIndex card UX)', () => {
  const src = readSafe(RELAY_SETTINGS_PATH);
  assert(src, `cannot read ${RELAY_SETTINGS_PATH}`);
  assert(/HousePovUnconfiguredBanner/.test(src),
    'RelaySettings.jsx must still define/render HousePovUnconfiguredBanner — the story #4 banner that surfaces when povPubkey is unset must keep working on the migrated `legacy:refreshSearchIndex` entry.');
});

test('R2: src/api/scheduled-tasks/index.js still exports reconcileSchedulesFromConfig (story #22 / ADR 0019 boot hook; bin/control-panel.js depends on it)', () => {
  const r = safeRequire(SCHEDULER_API_PATH);
  assert(r.ok, `scheduler API module unavailable: ${r.error}`);
  assert(typeof r.module.reconcileSchedulesFromConfig === 'function',
    'src/api/scheduled-tasks/index.js must continue to export reconcileSchedulesFromConfig — bin/control-panel.js invokes it once at startup to reconcile config → BullMQ Job Schedulers (story #22 / ADR 0019 cold-start hook; ADR 0021 keeps the function name and call site, only changes internals to iterate entries).');
});

test('R3: filterSchedulableTasks includes non-parameterized tasks like reconcile* (regression guard — ADR 0019 surface preserved)', () => {
  // Background: when ADR 0021's "+ Add Scheduled Entry" modal first shipped,
  // handleRegistryTasks had an overly strict filter that excluded any task
  // whose `arguments` block was empty/false — silently dropping all four
  // reconcile* tasks from the dropdown (story #22 / ADR 0019's motivating
  // consumers). This test pins the corrected contract: every non-continuous
  // task in the registry is schedulable, regardless of whether it takes args.
  const r = safeRequire(SCHEDULER_API_PATH);
  assert(r.ok, `scheduler API module unavailable: ${r.error}`);
  assert(typeof r.module.filterSchedulableTasks === 'function',
    'src/api/scheduled-tasks/index.js must export `filterSchedulableTasks(registry) → tasks[]` for direct testability of the dropdown-population rule.');

  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  const tasks = r.module.filterSchedulableTasks(registry);
  const taskIds = new Set(tasks.map(t => t.taskId));

  // Must-include: the four reconcile* tasks (ADR 0019's motivating consumers
  // — story #22 explicitly designed scheduling around them). All four have
  // arguments: false in the registry, so any "non-empty arguments required"
  // filter would silently exclude them — exactly the regression this guards.
  for (const id of ['reconcileAll', 'reconcileRecent', 'reconcileAuthor', 'reconcileNetwork']) {
    assert(taskIds.has(id),
      `filterSchedulableTasks must include "${id}" — it has arguments:false but a real schedule via ADR 0019. Schedulable tasks the modal returned: ${[...taskIds].join(', ').slice(0, 200)}…`);
  }

  // Sanity-include: a parameterized task (must still work).
  assert(taskIds.has('processCustomer'),
    'filterSchedulableTasks must include parameterized tasks like processCustomer too.');

  // Must-exclude: continuous-frequency queue-internal daemons. These are
  // the queue runtime, not user-schedulable tasks; including them would
  // let an operator accidentally start/stop daemon-like infrastructure.
  for (const id of ['taskQueueManager', 'taskScheduler', 'taskExecutor', 'systemStateGatherer']) {
    if (registry.tasks[id] && registry.tasks[id].frequency === 'continuous') {
      assert(!taskIds.has(id),
        `filterSchedulableTasks must EXCLUDE "${id}" (frequency: continuous — queue-internal daemon, not schedulable).`);
    }
  }

  // The returned shape must normalize `arguments` to an object so the modal's
  // `Object.entries(task.arguments || {})` iteration is well-defined for
  // non-parameterized tasks (where the registry has arguments:false).
  const reconcileAll = tasks.find(t => t.taskId === 'reconcileAll');
  assert(reconcileAll && typeof reconcileAll.arguments === 'object' && !Array.isArray(reconcileAll.arguments),
    'filterSchedulableTasks must normalize `arguments` to an object on the returned task — `false` collapses to `{}` so the modal\'s arg-form iteration is safe.');
});

// ─────────────────────────────────────────────────────────────────────────
// Runner
// ─────────────────────────────────────────────────────────────────────────

async function run() {
  let pass = 0;
  let fail = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`  ✓ ${t.name}`);
      pass++;
    } catch (err) {
      console.log(`  ✗ ${t.name}`);
      console.log(`      ${err.message}`);
      fail++;
    }
  }
  return { pass, fail };
}

module.exports = { run };
