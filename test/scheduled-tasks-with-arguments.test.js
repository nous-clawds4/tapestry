/**
 * Story #17 / ADR 0015 — Per-task arguments + multiple entries per task
 * in the Scheduled Tasks panel.
 *
 * Approach (matches stories #4, #13, #16):
 *  - **Unit tests** for the two new pure modules that the ADR creates
 *    (`src/api/scheduled-tasks/migration.js`,
 *     `src/api/scheduled-tasks/validation.js`). Their entire purpose is to
 *    be tested in isolation; we `require()` them and exercise the contracts
 *    end-to-end.
 *  - **Source/structural sentinels** for the backend refactor of
 *    `src/api/scheduled-tasks/index.js` (timer-state keyed by entryId,
 *    readConfig calls the migrator, makeTriggerTask builds the query
 *    string from entry.args, deleted-customer auto-disable branch, new
 *    CRUD handlers exported and routed) — these contract shapes are what
 *    the ADR pins; the actual end-to-end firing is reproducible only
 *    against a live stack and is the Reviewer-driven cycle-local smoke.
 *  - **Source sentinels** for the frontend additions
 *    (`AddOrEditEntryModal.jsx`, `CustomerPicker.jsx`,
 *    `argFieldRenderer.jsx`, and the list-driven ScheduledTasksPanel
 *    refactor). The behavioral UI flow — opening the modal, picking a
 *    customer, saving, watching a `processCustomer` entry fire on its
 *    own cadence — is cycle-local smoke per the test plan.
 *  - **Regression guards** for the two existing entries' survival
 *    (story #4's panel + the HousePovUnconfiguredBanner wiring).
 *
 * T1..T26 : FAIL pre-implementation, PASS post.
 * R1..R2  : PASS pre AND post — regression guards.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const SCHEDULER_PATH       = path.join(ROOT, 'src/api/scheduled-tasks/index.js');
const MIGRATION_PATH       = path.join(ROOT, 'src/api/scheduled-tasks/migration.js');
const VALIDATION_PATH      = path.join(ROOT, 'src/api/scheduled-tasks/validation.js');
const ROUTES_PATH          = path.join(ROOT, 'src/api/index.js');
const REGISTRY_PATH        = path.join(ROOT, 'src/manage/taskQueue/taskRegistry.json');
const RELAY_SETTINGS_PATH  = path.join(ROOT, 'ui/src/pages/settings/RelaySettings.jsx');
const MODAL_PATH           = path.join(ROOT, 'ui/src/pages/settings/scheduledTasks/AddOrEditEntryModal.jsx');
const CUSTOMER_PICKER_PATH = path.join(ROOT, 'ui/src/pages/settings/scheduledTasks/CustomerPicker.jsx');
const ARG_FIELD_PATH       = path.join(ROOT, 'ui/src/pages/settings/scheduledTasks/argFieldRenderer.jsx');

function readSafe(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }

function safeRequire(p) {
  // Clear from require cache so re-runs in the same process pick up fresh files.
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
// ─────────────────────────────────────────────────────────────────────────

test('T1: src/api/scheduled-tasks/migration.js exists and exports migrateConfigIfNeeded', () => {
  const r = safeRequire(MIGRATION_PATH);
  assert(r.ok, `migration module missing or unparseable at ${MIGRATION_PATH}: ${r.error}. ADR 0015 §Implementation "Files to add" pins this module.`);
  assert(typeof r.module.migrateConfigIfNeeded === 'function',
    'migration.js must export a function `migrateConfigIfNeeded(loadedJson, registry) → { version, entries }` per ADR 0015.');
});

test('T2: migration converts v1 flat shape to v2 entries array with stable legacy:<taskId> IDs, preserving enabled/intervalHours/intervalDays bit-for-bit', () => {
  const r = safeRequire(MIGRATION_PATH);
  assert(r.ok, `migration module unavailable: ${r.error}`);
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));

  const v1 = {
    updateAllScoresForOwner: { enabled: true,  intervalHours: 12, intervalDays: 0 },
    refreshSearchIndex:      { enabled: false, intervalHours:  6, intervalDays: 1 },
  };
  const v2 = r.module.migrateConfigIfNeeded(v1, registry);

  assert(v2 && v2.version === 2,
    `migration must produce { version: 2, ... }; got: ${JSON.stringify(v2)}`);
  assert(Array.isArray(v2.entries) && v2.entries.length === 2,
    `migration of the 2 legacy entries must produce a 2-element entries array; got length: ${v2.entries?.length}`);

  const byId = Object.fromEntries(v2.entries.map(e => [e.id, e]));
  const owner = byId['legacy:updateAllScoresForOwner'];
  const refresh = byId['legacy:refreshSearchIndex'];
  assert(owner, `migration must assign id "legacy:updateAllScoresForOwner" to the migrated Owner entry (stable for backward-compat) — got ids: ${v2.entries.map(e=>e.id).join(', ')}`);
  assert(refresh, `migration must assign id "legacy:refreshSearchIndex" to the migrated refresh entry — got ids: ${v2.entries.map(e=>e.id).join(', ')}`);

  assert(owner.taskId === 'updateAllScoresForOwner', `legacy Owner entry must carry taskId="updateAllScoresForOwner"; got: ${owner.taskId}`);
  assert(owner.enabled === true,                    `legacy Owner enabled must be preserved bit-for-bit (true→true); got: ${owner.enabled}`);
  assert(owner.intervalHours === 12,                `legacy Owner intervalHours must be preserved (12); got: ${owner.intervalHours}`);
  assert(owner.intervalDays === 0,                  `legacy Owner intervalDays must be preserved (0); got: ${owner.intervalDays}`);
  assert(owner.args && typeof owner.args === 'object' && Object.keys(owner.args).length === 0,
    `legacy Owner entry's args must be an empty object {} (no args to carry over); got: ${JSON.stringify(owner.args)}`);

  assert(refresh.taskId === 'refreshSearchIndex',   `legacy refresh entry must carry taskId="refreshSearchIndex"; got: ${refresh.taskId}`);
  assert(refresh.enabled === false,                 `legacy refresh enabled must be preserved (false); got: ${refresh.enabled}`);
  assert(refresh.intervalHours === 6,               `legacy refresh intervalHours must be preserved (6); got: ${refresh.intervalHours}`);
  assert(refresh.intervalDays === 1,                `legacy refresh intervalDays must be preserved (1); got: ${refresh.intervalDays}`);
});

test('T3: migration of a v2 object passes through unchanged (idempotent on already-migrated config)', () => {
  const r = safeRequire(MIGRATION_PATH);
  assert(r.ok, `migration module unavailable: ${r.error}`);
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));

  const v2In = {
    version: 2,
    entries: [
      { id: 'legacy:updateAllScoresForOwner', taskId: 'updateAllScoresForOwner', label: 'Update All Scores for Owner', args: {}, enabled: true, intervalHours: 24, intervalDays: 0 },
      { id: 'uuid-alice', taskId: 'processCustomer', label: 'Process Customer — Alice', args: { customer: ALICE_PUBKEY }, enabled: true, intervalHours: 6, intervalDays: 0 },
    ],
  };
  const v2Out = r.module.migrateConfigIfNeeded(v2In, registry);
  assert(v2Out.version === 2,
    `v2 input must round-trip to v2 output unchanged; got version: ${v2Out.version}`);
  assert(v2Out.entries.length === 2,
    `v2 input with 2 entries must produce 2 entries; got: ${v2Out.entries.length}`);
  assert(v2Out.entries.some(e => e.id === 'uuid-alice' && e.args?.customer === ALICE_PUBKEY),
    `v2 entries must pass through with args intact; got: ${JSON.stringify(v2Out.entries)}`);
});

test('T4: migration of an empty / falsy input produces v2 with empty entries array (fresh-install posture)', () => {
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
    updateAllScoresForOwner: { enabled: false, intervalHours: 24, intervalDays: 0 },
    refreshSearchIndex:      { enabled: false, intervalHours: 24, intervalDays: 0 },
  };
  const once = r.module.migrateConfigIfNeeded(v1, registry);
  const twice = r.module.migrateConfigIfNeeded(once, registry);
  assert(JSON.stringify(once) === JSON.stringify(twice),
    `migration must be idempotent (a v2 input round-trips). once=${JSON.stringify(once)}; twice=${JSON.stringify(twice)}`);
});

// ─────────────────────────────────────────────────────────────────────────
// VALIDATION SUITE (AC-6, AC-10; ADR §Tests "CRUD" / "Deleted-customer")
//
// validation.js is the entrypoint for both HTTP-handler validation and
// fire-time re-validation. Tests exercise the contract end-to-end.
// ─────────────────────────────────────────────────────────────────────────

test('T6: src/api/scheduled-tasks/validation.js exists and exports validateEntry', () => {
  const r = safeRequire(VALIDATION_PATH);
  assert(r.ok, `validation module missing or unparseable at ${VALIDATION_PATH}: ${r.error}. ADR 0015 §Implementation "Files to add" pins this module.`);
  assert(typeof r.module.validateEntry === 'function',
    'validation.js must export `validateEntry(entry, registry) → { ok, errors }` per ADR 0015.');
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

test('T8: validateEntry rejects a taskId whose registry frequency is "continuous" (queue-daemon, not schedulable)', () => {
  const r = safeRequire(VALIDATION_PATH);
  assert(r.ok, `validation module unavailable: ${r.error}`);
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  // Pick a real continuous task from the registry. Per the registry, taskScheduler/taskExecutor/taskQueueManager are continuous.
  const continuousTaskId = Object.keys(registry.tasks).find(k => registry.tasks[k].frequency === 'continuous');
  assert(continuousTaskId, 'precondition: registry must declare at least one continuous task — none found, the test is moot. Update the registry or the test.');
  const entry = { id: 'uuid-x', taskId: continuousTaskId, args: {}, enabled: true, intervalHours: 24, intervalDays: 0 };
  const result = r.module.validateEntry(entry, registry);
  assert(result && result.ok === false,
    `validateEntry must reject taskId="${continuousTaskId}" because its registry frequency is "continuous" (queue-daemon, not schedulable); got: ${JSON.stringify(result)}`);
});

test('T9: validateEntry rejects a customer-task entry whose args.customer is missing (CUSTOMER_REQUIRED)', () => {
  const r = safeRequire(VALIDATION_PATH);
  assert(r.ok, `validation module unavailable: ${r.error}`);
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  const entry = { id: 'uuid-x', taskId: 'processCustomer', args: {}, enabled: true, intervalHours: 6, intervalDays: 0 };
  const result = r.module.validateEntry(entry, registry);
  assert(result && result.ok === false,
    `validateEntry must reject processCustomer with no customer arg (story #17 AC-6 "Required arguments block save"); got: ${JSON.stringify(result)}`);
  assert(Array.isArray(result.errors) && result.errors.some(e => e.field === 'customer' || /customer/i.test(e.message || '')),
    `validateEntry must surface an error naming the customer field; got errors: ${JSON.stringify(result.errors)}`);
});

test('T10: validateEntry rejects a customer-task entry whose args.customer is a malformed pubkey (not 64-char lowercase hex)', () => {
  const r = safeRequire(VALIDATION_PATH);
  assert(r.ok, `validation module unavailable: ${r.error}`);
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));

  const malformed = [
    'too-short',
    'A'.repeat(64),     // uppercase (ADR pins "64-char lowercase hex")
    'g'.repeat(64),     // non-hex character
    'z'.repeat(64),
    'a'.repeat(63),     // off-by-one
    '',                 // empty string
  ];
  for (const customer of malformed) {
    const entry = { id: 'uuid-x', taskId: 'processCustomer', args: { customer }, enabled: true, intervalHours: 6, intervalDays: 0 };
    const result = r.module.validateEntry(entry, registry);
    assert(result && result.ok === false,
      `validateEntry must reject malformed customer pubkey "${customer}" (expected 64-char lowercase hex per ADR 0015 §validation.js); got ok=${result?.ok}`);
  }
});

test('T11: validateEntry accepts a well-formed processCustomer entry with a valid 64-char lowercase hex customer pubkey', () => {
  const r = safeRequire(VALIDATION_PATH);
  assert(r.ok, `validation module unavailable: ${r.error}`);
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  const entry = { id: 'uuid-x', taskId: 'processCustomer', args: { customer: ALICE_PUBKEY }, enabled: true, intervalHours: 6, intervalDays: 0 };
  const result = r.module.validateEntry(entry, registry);
  assert(result && result.ok === true,
    `validateEntry must accept a well-formed processCustomer entry (customer=${ALICE_PUBKEY}); got: ${JSON.stringify(result)}`);
});

test('T12: validateEntry accepts a no-args legacy entry (updateAllScoresForOwner has no required args)', () => {
  const r = safeRequire(VALIDATION_PATH);
  assert(r.ok, `validation module unavailable: ${r.error}`);
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  const entry = { id: 'legacy:updateAllScoresForOwner', taskId: 'updateAllScoresForOwner', args: {}, enabled: true, intervalHours: 24, intervalDays: 0 };
  const result = r.module.validateEntry(entry, registry);
  assert(result && result.ok === true,
    `validateEntry must accept a migrated no-args legacy entry (AC-11 "Existing entries survive the upgrade"); got: ${JSON.stringify(result)}`);
});

// ─────────────────────────────────────────────────────────────────────────
// BACKEND REFACTOR SOURCE SENTINELS (AC-1, AC-4, AC-7, AC-10, AC-12, AC-13)
//
// We assert the shape of src/api/scheduled-tasks/index.js after the refactor:
// timer state keyed by entryId, readConfig calls migrateConfigIfNeeded,
// makeTriggerTask builds query string from entry.args including the customer
// triple, deleted-customer auto-disable branch present, new handlers exported.
// ─────────────────────────────────────────────────────────────────────────

test('T13: scheduler timer-state map is keyed by entryId (not taskId) — multi-entry-per-task support (AC-4)', () => {
  const src = readSafe(SCHEDULER_PATH);
  assert(src, `cannot read ${SCHEDULER_PATH}`);
  // The ADR pins Map<entryId, …>. Accept either an explicit type comment or function args named entryId.
  assert(/entryId/.test(src),
    'src/api/scheduled-tasks/index.js must reference `entryId` (the new key for timer state) per ADR 0015 — it currently keys by `taskId` only, which collapses the multi-entry-per-task contract (story #17 AC-4).');
});

test('T14: readConfig invokes migrateConfigIfNeeded so on-disk v1 files are auto-upgraded (AC-11, AC-12)', () => {
  const src = readSafe(SCHEDULER_PATH);
  assert(src, `cannot read ${SCHEDULER_PATH}`);
  assert(/migrateConfigIfNeeded/.test(src),
    'src/api/scheduled-tasks/index.js must call migrateConfigIfNeeded (from ./migration) inside readConfig so v1 → v2 happens transparently on first read. ADR 0015 §Implementation "Files to edit".');
  assert(/require\(['"]\.\/migration['"]\)/.test(src) || /from\s+['"]\.\/migration['"]/.test(src),
    'src/api/scheduled-tasks/index.js must require("./migration") (or ES-import equivalent) to obtain migrateConfigIfNeeded.');
});

test('T15: makeTriggerTask builds the query string from entry.args — customer triple + warmStart + limit (AC-7)', () => {
  const src = readSafe(SCHEDULER_PATH);
  assert(src, `cannot read ${SCHEDULER_PATH}`);
  // The ADR pins: customer arg expands to pubkey=<hex>&customerId=<id>&customerName=<name> in the query string.
  // These three param names are the runTask.js contract (see src/api/manage/commands/runTask.js handleRunTask).
  assert(/entry\.args/.test(src) || /entryArgs/.test(src),
    'src/api/scheduled-tasks/index.js trigger path must read from `entry.args` so configured arguments are passed to /api/run-task — currently the trigger sends only `taskName` (story #17 AC-7 "The fired task receives its configured arguments").');
  assert(/pubkey=/.test(src),
    'trigger query string must include `pubkey=` (the customer triple required by runTask.js validateCustomerArguments).');
  assert(/customerId=/.test(src),
    'trigger query string must include `customerId=` (positional arg #2 for processCustomer.sh — see src/api/manage/commands/runTask.js:86).');
  assert(/customerName=/.test(src),
    'trigger query string must include `customerName=` (positional arg #3 for processCustomer.sh).');
  assert(/warmStart/.test(src),
    'trigger path must propagate `warmStart` when configured (optional boolean arg; matches legacy Task Explorer behavior — AC-3).');
});

test('T16: trigger path auto-disables an entry on customer-lookup failure (AC-10 "Deleted-customer warning")', () => {
  const src = readSafe(SCHEDULER_PATH);
  assert(src, `cannot read ${SCHEDULER_PATH}`);
  // The ADR resolves this as auto-disable + lastError. Accept either an explicit CUSTOMER_NOT_FOUND constant
  // or a clear in-trigger branch that sets enabled=false on lookup failure.
  assert(/CUSTOMER_NOT_FOUND/.test(src),
    'scheduler must surface a `CUSTOMER_NOT_FOUND` error code when a referenced customer is no longer present (ADR 0015 §Open-Question resolution #2; AC-10).');
  assert(/lastError/.test(src),
    'scheduler must record a `lastError` field on the entry when fire-time validation fails so the panel can flag it.');
  // The disable behavior — entry.enabled = false on customer-not-found — should be visible somewhere in the trigger or a disable helper.
  assert(/disable/i.test(src),
    'scheduler must auto-disable an entry whose customer is missing (ADR 0015: "auto-disable on fire-time customer lookup failure").');
});

test('T17: scheduler module exports the new CRUD handlers (handleList, handleCreate, handleDelete) alongside the existing handlers', () => {
  const r = safeRequire(SCHEDULER_PATH);
  assert(r.ok, `scheduler module unavailable: ${r.error}`);
  const m = r.module;
  assert(typeof m.handleList   === 'function', 'scheduler must export handleList (new endpoint: GET /api/scheduled-tasks/list).');
  assert(typeof m.handleCreate === 'function', 'scheduler must export handleCreate (new endpoint: POST /api/scheduled-tasks/create).');
  assert(typeof m.handleDelete === 'function', 'scheduler must export handleDelete (new endpoint: POST /api/scheduled-tasks/delete).');
  assert(typeof m.handleUpdate === 'function', 'scheduler must continue to export handleUpdate (regression guard: existing endpoint).');
  assert(typeof m.handleStatus === 'function', 'scheduler must continue to export handleStatus (regression guard: existing endpoint).');
  assert(typeof m.handleHistory === 'function','scheduler must continue to export handleHistory (regression guard: existing endpoint).');
  assert(typeof m.initScheduler === 'function','scheduler must continue to export initScheduler (regression guard: cold-start restoration).');
});

test('T18: scheduler module exports a handler returning the parameterized-task subset (handleRegistryTasks or equivalent) — AC-1, AC-2', () => {
  const r = safeRequire(SCHEDULER_PATH);
  assert(r.ok, `scheduler module unavailable: ${r.error}`);
  const exportNames = Object.keys(r.module);
  const hasRegistryHandler =
    typeof r.module.handleRegistryTasks === 'function' ||
    typeof r.module.handleAddableTasks === 'function' ||
    typeof r.module.handleSchedulableTasks === 'function';
  assert(hasRegistryHandler,
    `scheduler must export a handler that powers GET /api/scheduled-tasks/registry-tasks — the dropdown source for the add-entry modal. ADR 0015 §Implementation "Files to add → AddOrEditEntryModal.jsx" pins this endpoint. Got exports: ${exportNames.join(', ')}`);
});

// ─────────────────────────────────────────────────────────────────────────
// API ROUTE SENTINELS (AC-1, AC-4, AC-6)
// ─────────────────────────────────────────────────────────────────────────

test('T19: src/api/index.js registers the new scheduled-tasks routes (list, create, delete, registry-tasks)', () => {
  const src = readSafe(ROUTES_PATH);
  assert(src, `cannot read ${ROUTES_PATH}`);
  assert(/\/api\/scheduled-tasks\/list/.test(src),
    "src/api/index.js must register GET /api/scheduled-tasks/list (new endpoint per ADR 0015).");
  assert(/\/api\/scheduled-tasks\/create/.test(src),
    "src/api/index.js must register POST /api/scheduled-tasks/create (new endpoint per ADR 0015).");
  assert(/\/api\/scheduled-tasks\/delete/.test(src),
    "src/api/index.js must register POST /api/scheduled-tasks/delete (new endpoint per ADR 0015).");
  assert(/\/api\/scheduled-tasks\/registry-tasks/.test(src),
    "src/api/index.js must register GET /api/scheduled-tasks/registry-tasks (the parameterized-task subset for the modal's task picker).");
});

// ─────────────────────────────────────────────────────────────────────────
// BACKWARD-COMPAT SENTINEL (story #17 AC-11; ADR §Tests "Backward-compat")
// ─────────────────────────────────────────────────────────────────────────

test('T20: handleUpdate has backward-compat resolution from bare taskId → legacy:<taskId> entryId for the swap window', () => {
  const src = readSafe(SCHEDULER_PATH);
  assert(src, `cannot read ${SCHEDULER_PATH}`);
  // The ADR pins: a body carrying only `taskId` (legacy frontend) resolves to the `legacy:<taskId>` entry rather than 400.
  // Accept either an explicit "legacy:" string prefix or an obvious resolution branch.
  assert(/legacy:/.test(src),
    'src/api/scheduled-tasks/index.js must contain a "legacy:" prefix (per ADR 0015 the migrated entries get stable IDs `legacy:<taskId>`, and handleUpdate must resolve bare-taskId requests to these IDs during the swap window).');
});

// ─────────────────────────────────────────────────────────────────────────
// FRONTEND SOURCE SENTINELS (AC-2, AC-3, AC-5, AC-6, AC-9, AC-13)
// ─────────────────────────────────────────────────────────────────────────

test('T21: ui/src/pages/settings/scheduledTasks/AddOrEditEntryModal.jsx exists and references the new endpoints', () => {
  const src = readSafe(MODAL_PATH);
  assert(src, `cannot read ${MODAL_PATH} — modal must exist per ADR 0015 §Implementation "Files to add".`);
  assert(/\/api\/scheduled-tasks\/registry-tasks/.test(src),
    'AddOrEditEntryModal.jsx must fetch /api/scheduled-tasks/registry-tasks for the task-picker dropdown.');
  assert(/\/api\/scheduled-tasks\/(create|update)/.test(src),
    'AddOrEditEntryModal.jsx must POST to /api/scheduled-tasks/create (new entry) or /update (existing entry) on save.');
});

test('T22: ui/src/pages/settings/scheduledTasks/CustomerPicker.jsx exists and reuses /api/get-customers (AC-9)', () => {
  const src = readSafe(CUSTOMER_PICKER_PATH);
  assert(src, `cannot read ${CUSTOMER_PICKER_PATH} — CustomerPicker must exist per ADR 0015.`);
  assert(/\/api\/get-customers/.test(src),
    'CustomerPicker.jsx must fetch /api/get-customers (the same source the legacy Task Explorer uses) — story #17 AC-9 "Customer picker shares the legacy explorer\'s source".');
});

test('T23: argFieldRenderer.jsx renders customer/boolean/optional cases plus a text-input fallback for unknown shapes (AC-2, AC-3)', () => {
  const src = readSafe(ARG_FIELD_PATH);
  assert(src, `cannot read ${ARG_FIELD_PATH} — argFieldRenderer must exist per ADR 0015.`);
  // The renderer is a switch over known arg shapes. Accept either a JS switch, conditional chains, or a lookup table.
  assert(/customer/i.test(src),
    'argFieldRenderer.jsx must handle the `customer` arg shape (used by all 14 customer-scoped tasks).');
  assert(/boolean/i.test(src),
    'argFieldRenderer.jsx must handle the `boolean` arg shape (e.g., warmStart).');
  assert(/optional/i.test(src) || /limit/i.test(src),
    'argFieldRenderer.jsx must handle the `optional` arg shape (e.g., limit).');
  // ADR pins: "Anything else → text input fallback (logged at runtime so a future maintainer notices the gap)."
  assert(/default/i.test(src) || /fallback/i.test(src) || /unknown/i.test(src),
    'argFieldRenderer.jsx must have an explicit fallback for unknown arg shapes (per ADR 0015 §Option A: text-input fallback so future arg shapes don\'t silent-fail).');
});

test('T24: ScheduledTasksPanel fetches the new /api/scheduled-tasks/list (list-driven, not hardcoded taskIds)', () => {
  const src = readSafe(RELAY_SETTINGS_PATH);
  assert(src, `cannot read ${RELAY_SETTINGS_PATH}`);
  assert(/\/api\/scheduled-tasks\/list/.test(src),
    'RelaySettings.jsx ScheduledTasksPanel must fetch /api/scheduled-tasks/list (replacing the hardcoded per-taskId /status calls — AC-4 "Multiple scheduled entries per task" and AC-1 "Every parameterized task is schedulable").');
});

test('T25: ScheduledEntryCard component takes an `entry` object (id, taskId, label, args, …), not just a taskId', () => {
  const src = readSafe(RELAY_SETTINGS_PATH);
  assert(src, `cannot read ${RELAY_SETTINGS_PATH}`);
  // The ADR renames ScheduledTaskCard → ScheduledEntryCard with prop `entry`. Accept either name AS LONG AS
  // the card surface receives the full entry (not just a taskId).
  const hasNewCardName = /ScheduledEntryCard/.test(src);
  const hasEntryProp   = /entry\.(id|taskId|label|args|enabled|intervalHours|intervalDays)/.test(src);
  assert(hasNewCardName || hasEntryProp,
    'RelaySettings.jsx must rename ScheduledTaskCard → ScheduledEntryCard (or restructure it to accept an `entry` prop). Per ADR 0015: the card receives the full entry object so the listing renders one card per entry (AC-5 "Each entry has a recognizable label").');
});

test('T26: Add-or-edit modal disables Save while required args are missing (AC-6 "Required arguments block save")', () => {
  const src = readSafe(MODAL_PATH);
  assert(src, `cannot read ${MODAL_PATH}`);
  // The story's AC-6 commits to "refuse to save / enable" with form-level validation. The modal must reflect that.
  // Accept either an explicit "disabled" attribute tied to validation state, or a "Save" button conditionally rendered.
  assert(/disabled/i.test(src),
    'AddOrEditEntryModal.jsx must conditionally disable Save when required args are missing — AC-6 "Required arguments block save". Look for `disabled={…}` on the Save button or an equivalent guard.');
  assert(/required/i.test(src) || /validateEntry/i.test(src) || /errors/i.test(src),
    'AddOrEditEntryModal.jsx must compute a "missing required arg" state (look for `required`, `errors`, or a call to a shared validation helper). Per ADR 0015, validation logic lives in src/api/scheduled-tasks/validation.js and the modal mirrors it client-side.');
});

// ─────────────────────────────────────────────────────────────────────────
// REGRESSION SENTINELS (PASS pre AND post — story #17 must not break story #4)
// ─────────────────────────────────────────────────────────────────────────

test('R1: HousePovUnconfiguredBanner from story #4 is still defined in RelaySettings.jsx (no regression on the refreshSearchIndex card UX)', () => {
  const src = readSafe(RELAY_SETTINGS_PATH);
  assert(src, `cannot read ${RELAY_SETTINGS_PATH}`);
  assert(/HousePovUnconfiguredBanner/.test(src),
    'RelaySettings.jsx must still define/render HousePovUnconfiguredBanner — the story #4 banner that surfaces when povPubkey is unset must keep working on the migrated `legacy:refreshSearchIndex` entry.');
});

test('R2: src/api/scheduled-tasks/index.js still exports initScheduler (called from bin/control-panel.js at server startup)', () => {
  const r = safeRequire(SCHEDULER_PATH);
  assert(r.ok, `scheduler module unavailable: ${r.error}`);
  assert(typeof r.module.initScheduler === 'function',
    'src/api/scheduled-tasks/index.js must continue to export initScheduler — bin/control-panel.js invokes it once at startup to restore enabled schedules across restart (AC-12 "Persistence across restarts").');
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
