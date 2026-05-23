# ADR 0015: Per-task arguments and multiple entries per task in the Scheduled Tasks panel

**Status:** Proposed
**Date:** 2026-05-23
**Story:** `engineering-team/stories/17-scheduled-tasks-with-arguments.md`

## Context

Story #17 needs the Scheduled Tasks panel (built in story #4, ADR 0003) to (a) accept task arguments, (b) allow multiple scheduled entries per task ID, and (c) drive the argument-input form from `src/manage/taskQueue/taskRegistry.json` so any future task with an `arguments` block becomes schedulable automatically. Phase 2 (adding scheduling to the legacy Task Explorer / Bull Board) is out of scope.

Grounded facts from reading the relevant code:

- **Scheduler backend** ([src/api/scheduled-tasks/index.js:19-30](src/api/scheduled-tasks/index.js:19)) hardcodes two known tasks in a `DEFAULTS` const (`updateAllScoresForOwner`, `refreshSearchIndex`) and validates incoming taskIds against it ([id.:48-50](src/api/scheduled-tasks/index.js:48)). Per-task timer state is stored in `Map<taskId, timerState>` ([id.:34](src/api/scheduled-tasks/index.js:34)). `makeTriggerTask` POSTs `http://127.0.0.1:7778/api/run-task?taskName=${taskId}` with **no arguments** ([id.:97](src/api/scheduled-tasks/index.js:97)). Persisted config at `/var/lib/brainstorm/scheduled-tasks.json` is shaped `{ [taskId]: { enabled, intervalHours, intervalDays } }`.
- **Frontend panel** ([ui/src/pages/settings/RelaySettings.jsx:1390-1587](ui/src/pages/settings/RelaySettings.jsx:1390)): a reusable `<ScheduledTaskCard taskId, title, hint, banner />` component, instantiated twice with literal taskIds ([id.:1597-1602](ui/src/pages/settings/RelaySettings.jsx:1597)). Each card calls `GET /api/scheduled-tasks/status?taskId=…`, `GET /api/scheduled-tasks/history?taskId=…`, and `POST /api/scheduled-tasks/update` with `{ taskId, enabled, intervalDays, intervalHours }`.
- **Legacy Task Explorer** ([public/pages/manage/task-explorer.html:1618-1801](public/pages/manage/task-explorer.html:1618)) already reads the registry, detects `task.categories.includes('customer')` and `task.arguments.{limit,warmStart}`, and renders a customer-selector modal that loads customers from `GET /api/get-customers` ([src/api/customers/getCustomers.js](src/api/customers/getCustomers.js), registered at [src/api/index.js:340](src/api/index.js:340)). The same customer source can be reused by the new panel.
- **`/api/run-task`** ([src/api/manage/commands/runTask.js:76-100, :355-505](src/api/manage/commands/runTask.js:76)) accepts `taskName` from `req.query` and, for customer tasks, reads `pubkey` / `customerId` / `customerName` from `req.query`, validates the pubkey format and looks up the customer via `CustomerManager.getCustomer(pubkey)`, then passes `[pubkey, customerId, customerName]` as positional args to the script, plus optional `limit` (positional) and `warmStart` (literal string). When `TASK_QUEUE_ENABLED=true` ([id.:411-463](src/api/manage/commands/runTask.js:411)), the call is enqueued through BullMQ instead.
- **BullMQ jobId dedup** (ADR 0012): for customer tasks `jobId = ${taskName}:${pubkey}`; for non-customer tasks `jobId = ${taskName}`. Two scheduled entries that fire `processCustomer` for *different* customers get distinct jobIds (no dedup). Two scheduled entries for the *same* `(taskName, pubkey)` would dedup at the queue layer (which is the desirable safety behavior). Two scheduled entries for a non-customer parameterized task with *different* argument values would dedup — see Consequences for the constraint this implies.
- **Task registry** ([src/manage/taskQueue/taskRegistry.json](src/manage/taskQueue/taskRegistry.json)) has 51 tasks. ~18 have a non-empty `arguments` object (14 with `customer: true`, plus `warmStart`/`limit` variants). Three tasks have `frequency: "continuous"` (`taskQueueManager`, `taskScheduler`, `taskExecutor`, plus `systemStateGatherer`) and are daemons, not schedulable.
- **Concept Graph orientation:** PO queried `GET http://localhost:7778/api/concept-graph/summaries` (34 concepts). Architect re-confirmed via the three-call pattern for `graperank` and `nostr-user` — neither has any node specific to scheduling, arguments, or task registry. The Scheduled Tasks subsystem, Task Registry, Customer-as-operator-concept, and Task argument shape are **not formal concept-graph nodes**. The closest formal concept for "customer" is `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:nostr-user`. **No concept-graph or firmware schema changes are required by this ADR. No firmware reinstall.**

### Story's "Deferred to Architect" — resolved decisions captured up-front

1. **Data-model migration shape** → array of entries keyed by `id`, on-disk file auto-migrates the existing two flat-shaped entries on first read with stable `legacy:<taskId>` IDs.
2. **Deleted-customer runtime behavior** → **auto-disable on fire-time customer lookup failure**, surface the warning in the panel. Failing forever in the background pollutes logs; auto-disable forces operator visibility and matches the AC's "visibly flagged in the listing" intent.
3. **Server-side re-validation at fire time** → **yes**. Re-validate the task is still in the registry, re-validate required args are present in `entry.args`, and (for customer tasks) re-validate the customer record exists. Re-validation failures are recorded in the entry's last-error and the entry is auto-disabled.
4. **Entry label** → auto-generated as `"<task.name> — <customer.name>"` for customer-task entries, `"<task.name>"` for non-customer entries; the operator may override with a free-text `label` field in the edit modal. Auto-labels are recomputed if the underlying customer is renamed.
5. **Default argument shape on first add** → pre-fill optional arguments from their registry `default` (matches the legacy Task Explorer's behavior for the same task).

## Options considered

### Option A — Per-entry array + registry-driven form + in-place backend refactor (chosen)

**On-disk shape change** at `/var/lib/brainstorm/scheduled-tasks.json`:

```json
{
  "version": 2,
  "entries": [
    { "id": "legacy:updateAllScoresForOwner",
      "taskId": "updateAllScoresForOwner",
      "label": "Update All Scores for Owner",
      "args": {},
      "enabled": false, "intervalHours": 24, "intervalDays": 0 },
    { "id": "legacy:refreshSearchIndex",
      "taskId": "refreshSearchIndex",
      "label": "Refresh Meilisearch profiles & House PoV scores",
      "args": {},
      "enabled": false, "intervalHours": 24, "intervalDays": 0 },
    { "id": "01HF…uuid",
      "taskId": "processCustomer",
      "label": "Process Customer — Alice",
      "args": { "customer": "<alice-hex-pubkey>", "warmStart": false },
      "enabled": true, "intervalHours": 6, "intervalDays": 0 }
  ]
}
```

**Auto-migration on read:** if the loaded JSON has no `version` field and no `entries` key, treat its top-level keys as legacy task entries, wrap each as `{ id: "legacy:<taskId>", taskId, args: {}, label: registry.tasks[taskId]?.name || taskId, ...cfg }`, set `version: 2`, and persist the new shape on the next `writeConfig`. Migration is one-way; old server code reading the new file would fail loudly (acceptable: the old code is gone after this PR ships).

**Backend refactor** of `src/api/scheduled-tasks/index.js`:

- `DEFAULTS` shrinks to a single `NEW_ENTRY_DEFAULTS = { enabled: false, intervalHours: 24, intervalDays: 0 }` (used only by the "create" endpoint to pre-fill schedule fields).
- `isKnownTaskId` is replaced by `isSchedulableTaskId(taskId)` which checks `registry.tasks[taskId]` exists and `registry.tasks[taskId].frequency !== "continuous"`.
- Timer state changes from `Map<taskId, timerState>` to `Map<entryId, timerState>`.
- `makeTriggerTask(entryId)`:
  1. Reads the entry from the config (always fresh; the schedule could have been edited).
  2. Validates `taskId` is still in the registry and `frequency !== "continuous"`.
  3. Validates required args (currently only `customer: true`) are present in `entry.args`.
  4. For customer tasks, resolves the customer record via the existing `CustomerManager.getCustomer(pubkey)`. On `not found`: auto-disables the entry (writes `entry.enabled=false`, `entry.lastError={ code: "CUSTOMER_NOT_FOUND", at: <iso>, pubkey: <hex> }`), logs a structured event, and returns without firing.
  5. Builds the query string from `entry.args` — for `customer` arg, expands to `pubkey=<hex>&customerId=<id>&customerName=<name>` (matching what `runTask.js` expects); for `warmStart=true`, appends `warmStart=true`; for a non-empty `limit`, appends `limit=<n>`.
  6. POSTs to `/api/run-task?taskName=<taskId>&<args>`.
- New CRUD HTTP surface (additive — existing endpoints kept but adapted):
  - `GET  /api/scheduled-tasks/list` → `{ entries: [...] }`. Replaces the per-taskId `status` call as the primary list source.
  - `POST /api/scheduled-tasks/create` body `{ taskId, args, label?, enabled, intervalHours, intervalDays }` → assigns `id = crypto.randomUUID()` (or short form), validates args against the registry shape, returns the new entry. Rejects with 400 if required args missing.
  - `POST /api/scheduled-tasks/update` body `{ entryId, ...patch }` → updates the named entry. Re-validates args on each update. Rejects 400 on missing required args. Existing two-entry callers (carrying `taskId` only, no `entryId`) get backward-compat: if `taskId` is given without `entryId`, resolve to the matching `legacy:<taskId>` entry — preserves the URL the existing frontend would use during the swap window.
  - `POST /api/scheduled-tasks/delete` body `{ entryId }` → removes; refuses to delete an enabled entry without an explicit `force: true` (safety guard).
  - `GET  /api/scheduled-tasks/status?entryId=<id>` → per-entry `nextRunAt`/`lastRunAt`/`lastError` from the scheduler's timer state map.
  - `GET  /api/scheduled-tasks/history?entryId=<id>` → returns the per-task-name event-log records (filtered by `taskName = entry.taskId`). **Caveat:** entries that share a taskId share this history; the response includes a `note` field declaring this caveat so the UI can render it inline. Per-entry history (entryId in the event log) is a follow-up. See Consequences.
- `initScheduler()` iterates `config.entries` and starts a timer for each `enabled: true` entry (instead of iterating `DEFAULTS`).

**Frontend** (`ui/src/pages/settings/RelaySettings.jsx`):

- Rename `<ScheduledTaskCard taskId ... />` → `<ScheduledEntryCard entry ... />`. The card receives the full entry object (including `id`, `taskId`, `label`, `args`, `enabled`, `intervalHours`, `intervalDays`). Each card has an "Edit" button (re-opens the add/edit modal) and a "Delete" button (with confirmation).
- `<ScheduledTasksPanel>` fetches `/api/scheduled-tasks/list`, renders an `<ScheduledEntryCard>` per entry, plus a `+ Add Scheduled Entry` button at the top.
- New `<AddOrEditEntryModal>` component:
  1. **Task picker** (dropdown). On new-entry mode: options are every task in `taskRegistry.json` whose `arguments` is a non-empty object AND whose `frequency !== "continuous"` — that's the story's "every parameterized task" rule, with the daemon-exclusion safety guard. (Legacy no-arg entries appear in the list as cards but are not addable as new — the operator can edit/delete the existing two but cannot create new no-arg entries from this panel. New no-arg scheduling stays a developer/admin concern.) On edit-entry mode: task picker is disabled (the taskId is fixed for an existing entry; changing taskId would require deleting and re-creating).
  2. **Argument form** rendered from `task.arguments` using a `renderArgField(name, schema, value, onChange)` switch:
     - `name === "customer"` (truthy) → `<CustomerPicker>` (new sub-component, fetches `/api/get-customers`, filters by name/pubkey, returns the selected customer's `pubkey`).
     - `schema.type === "boolean"` → labeled checkbox; defaults to `schema.default ?? false`.
     - `schema === "optional"` or `name === "limit"` → optional integer input (empty = omit).
     - Anything else → text input fallback (logged at runtime so a future maintainer notices the gap).
  3. **Label** (optional text input). If empty, the auto-generated label is shown as a placeholder ("Auto: Process Customer — Alice").
  4. **Schedule** (days + hours, ≥ 1 hour minimum — same validation as today).
  5. **Save** is disabled while any required arg is unset; the offending field has a red border and an inline error like "Customer is required". This is the AC's "refuse to save / enable" rule.
- `<CustomerPicker>` is a new React component that wraps the same data source the legacy explorer uses (`/api/get-customers`). It supports type-ahead search on `name` and `pubkey`. Architect picks a minimal scope: no advanced filters, no inline create.

**Argument flow at fire time, summary diagram:**

```
scheduler timer fires for entryId
  ↓
look up entry; validate task in registry; validate required args; resolve customer
  ↓                                          ↘ customer not found / task gone / required arg missing
build query string from entry.args            ↘ auto-disable, record lastError, return
  ↓
POST /api/run-task?taskName=<taskId>&pubkey=…&customerId=…&customerName=…&warmStart=true
  ↓
runTask.js (unchanged) → either direct-spawn or BullMQ (depending on TASK_QUEUE_ENABLED)
```

**Pros**
- Stays in the existing scheduler module — no parallel paths, no duplicated state.
- Registry is the single source of truth; no static arg-shape table elsewhere to drift.
- Migration is small, deterministic, and one-way: the existing two entries survive without operator intervention.
- Customer picker reuses `/api/get-customers` — no new customer-management surface.
- Argument form's switch-based renderer is mechanically simple for the three shapes that exist today; the text-input fallback prevents new arg shapes (added to the registry later) from being silent footguns.
- BullMQ dispatch is preserved exactly because the scheduler still POSTs to `/api/run-task` — no scheduler-specific BullMQ integration needed in this story.

**Cons**
- One-way migration: rollback after first save would lose the new entries. Mitigated by the file being a single ~5KB JSON; operators can snapshot it before the upgrade if they want a manual rollback path. (The existing two entries are no-op-default on a fresh install, so a roll-back-and-lose-config scenario is also tolerable.)
- Two entries for the same `taskId` share the task-name-keyed event-log history. The per-entry **last-run / next-run** AC is satisfied from the scheduler's in-memory timer state, but the "Recent Runs" execution-history table cannot distinguish per-entry. We document the caveat inline. A follow-up story can wire entryId into the structured-logging events.
- For non-customer parameterized tasks (e.g., `processAllTasks` with different `warmStart`), two entries with different argument values will dedup at the BullMQ layer when `TASK_QUEUE_ENABLED=true` (jobId is just `${taskName}`). Documented as a constraint; if it becomes painful, a future task-queue ADR can extend the jobId rule to include an entry-args hash.

### Option B — Sidecar config: keep `scheduled-tasks.json` as-is, add `scheduled-task-entries.json` for parameterized entries

`scheduled-tasks.json` stays exactly as today, continues to drive the two legacy no-arg tasks via the existing code path. New parameterized entries live in a separate `/var/lib/brainstorm/scheduled-task-entries.json` with the array shape from Option A and a parallel scheduler module that drives them. The panel merges both lists.

**Pros**
- Zero risk to the existing two entries; their schedule/history code path is byte-identical to today.
- No migration step.

**Cons (why rejected)**
- Two persistent data shapes, two scheduler modules in `src/api/scheduled-tasks/`, two timer maps, two startup-init paths, two sets of validation rules. The two paths will drift on every bugfix touching either file (echoes the lesson from ADR 0003 Option B).
- The UI has to merge two lists with different shapes — adds an order-of-magnitude more frontend code than Option A.
- The legacy two entries can't be edited from the new UI without bridging into the old code path anyway, so the "leave the working code alone" benefit half-evaporates the moment any UI parity work touches them.

### Option C — Defer the schema change to BullMQ repeatable jobs

Drop `scheduled-tasks.json` and the in-process `setInterval` scheduler entirely. Use BullMQ's `Queue.add(name, data, { repeat: { every: ms }, jobId })` to register recurring jobs; the panel reads/writes BullMQ repeatable-job state via the queue module from ADR 0012.

**Pros**
- Eliminates a custom scheduler. Aligns with the "Phase 2: migrate scheduled-tasks.json to BullMQ repeatable jobs" follow-up listed in ADR 0012's Out-of-scope.
- Per-entry concurrency / pause / inspection comes for free via BullBoard.

**Cons (why rejected)**
- Story #17 says: "Existing entries survive the upgrade … no operator action required." `TASK_QUEUE_ENABLED` is `false` by default on production today; flipping it for production is its own deploy with its own risk surface and is explicitly out of this story's scope.
- Forces a hard dependency on Redis for *any* scheduled task to function, which is the constraint ADR 0012 deliberately gated behind the feature flag. Reverting that gating implicitly here is out of role.
- The history surface and the panel's "Recent Runs" table both move to BullMQ data; the operator's mental model of "scheduled tasks" gets quietly merged with "task queue" — a significant UX shift that should be its own story.
- A follow-up Phase 2 story (per ADR 0012) is the right place for this work, not Story #17.

## Decision

**We chose Option A.** The existing scheduler module is in good shape (already keyed by taskId, structured logging plumbed, history endpoint working), and the gap between today's shape and the story's requirements is genuinely small once we accept a one-way migration. Option B's two-paths cost compounds with every future tweak; Option C is the right end-state but the wrong story to deliver it in.

We trade away rollback flexibility on the on-disk file (one-way migration) and per-entry history granularity (events.jsonl stays task-keyed). Both are acceptable given the story's scope and the available follow-ups.

## Consequences

**Enabled**
- The operator's primary motivation — schedule `processCustomer` per customer on independent cadences — works on the first deploy of this change.
- Any future task that gets a `customer: true` arg (or any other shape in the existing switch) becomes schedulable with no panel-side code change.
- Phase 2 of the original user request (legacy Task Explorer scheduling, Bull Board) is unblocked: the new entry data model gives that future story a clean shape to read/write.
- BullMQ dispatch flows through transparently. When `TASK_QUEUE_ENABLED=true`, per-customer entries deduplicate naturally via the existing `${taskName}:${pubkey}` jobId rule.

**Constrained / made harder**
- **One-way on-disk migration.** Rolling back to a pre-ADR-0015 server image after entries have been created in the new shape would require the operator to either snapshot the JSON before the upgrade or manually edit it back to flat shape. Document this in OPERATIONS.md. The two existing entries' `enabled` and schedule values are preserved bit-for-bit through the migration so the prod-default state (both disabled) survives no-op-style.
- **Shared task-keyed event history** for entries sharing a taskId. The per-entry timestamps the panel shows for next/last run come from in-memory scheduler state, which is fine; the "Recent Runs" table inherits the existing task-keyed behavior with an inline caveat note.
- **BullMQ jobId dedup for non-customer parameterized tasks** (`processAllTasks` with varying `warmStart`, etc.) means two such entries with different args dedup when `TASK_QUEUE_ENABLED=true`. The panel does not prevent operators from creating such a pair; we document the constraint instead of adding a UI guard. A follow-up task-queue ADR can extend the jobId rule (e.g., `${taskName}:${hash(args)}`) if real operators hit this.

**Follow-up debt (out of scope here)**
- **Entry-id-aware structured logging** so per-entry "Recent Runs" can replace the task-keyed table — small change to `launchChildTask.sh`'s event emission once a shape is agreed on.
- **Phase 2: Legacy Task Explorer scheduling on Bull Board** — separate story per the operator's planning.
- **Argument types beyond customer/boolean/optional-int** (enums, datetimes, multi-select) — render as text-input today, typed renderer in a future story.
- **BullMQ jobId rule extension to include args hash** — only if operator need surfaces.
- **`<CustomerPicker>` extraction** to a shared React component for reuse from elsewhere — defer until a second consumer appears.
- **"Schedule for ALL customers" bulk-create** — story explicitly out of scope.

**Firmware reinstall required?** No. Zero concept-graph or firmware-schema changes.

## Implementation notes

The Implementer reads this section verbatim.

### Files to add

- **`src/api/scheduled-tasks/migration.js`** — exports `migrateConfigIfNeeded(loadedJson, registry) → { version, entries }`. Pure function; takes a parsed JSON object and a registry, returns the v2 shape. Idempotent: a v2 input returns itself unchanged. Used by `readConfig` on every load (cheap — JSON is small).

- **`src/api/scheduled-tasks/validation.js`** — exports `validateEntry(entry, registry) → { ok: boolean, errors: [{ field, code, message }] }`. Validates:
  - `entry.taskId` exists in `registry.tasks` AND `registry.tasks[taskId].frequency !== "continuous"`.
  - For each key in `registry.tasks[taskId].arguments`:
    - if it's `customer: true`, require `entry.args.customer` is a 64-char lowercase hex string.
    - if it's `{ type: "boolean", ... }`, require `entry.args[k]` is a boolean (allow `undefined` → use default at fire time).
    - if it's `"optional"` (the `limit` shape), allow `entry.args[k]` undefined or a non-negative integer.
    - any unrecognized shape: pass through (the text-input fallback writes a string; runtime validation deferred to the script).
  Used by both create/update endpoints AND at fire time.

- **`ui/src/pages/settings/scheduledTasks/AddOrEditEntryModal.jsx`** — modal as described in Option A. Reads the registry from a new endpoint `GET /api/scheduled-tasks/registry-tasks` (returns only the addable subset: tasks with non-empty `arguments` and `frequency !== "continuous"`). This avoids ship-the-entire-registry-to-the-browser and gives the backend a single place to enforce the filter rule.

- **`ui/src/pages/settings/scheduledTasks/CustomerPicker.jsx`** — search-and-select customer component, fetching `/api/get-customers`. Returns the selected customer's `pubkey` (the canonical arg shape).

- **`ui/src/pages/settings/scheduledTasks/argFieldRenderer.jsx`** — exports `renderArgField({ name, schema, value, onChange })`. The switch-based renderer described in Option A. Co-locate with the modal — not yet a shared lib, since the only consumer is the modal.

### Files to edit

- **`src/api/scheduled-tasks/index.js`** — the bulk of the backend refactor:
  - Replace `DEFAULTS` map with `NEW_ENTRY_DEFAULTS = { enabled: false, intervalHours: 24, intervalDays: 0 }`.
  - Replace `isKnownTaskId` with `isSchedulableTaskId(taskId, registry)`.
  - Change `timerState` from `Map<taskId, …>` to `Map<entryId, …>`. Keep the per-entry shape (`schedulerTimer`, `nextRunAt`, `lastRunAt`, `taskRunning`, `lastError`).
  - `readConfig()` now calls `migrateConfigIfNeeded(parsedJson, registry)` before returning.
  - `makeTriggerTask(entryId)` performs the fire-time validation chain (registry → required args → customer lookup), auto-disables on failure (calls `disableEntry(entryId, lastError)` helper that updates the on-disk config), then builds the query string and POSTs. Customer lookup uses the existing `new CustomerManager()` + `getCustomer(pubkey)` pattern from [src/api/manage/commands/runTask.js:25-72](src/api/manage/commands/runTask.js:25); factor the lookup into a tiny shared helper if duplication bothers the Implementer.
  - `startScheduler(entryId, cfg)`, `stopScheduler(entryId)`, `initScheduler()` all updated to operate on entries.
  - New HTTP handlers: `handleList`, `handleCreate`, `handleUpdate` (extended), `handleDelete`. `handleStatus` and `handleHistory` accept `entryId` (with backward-compat `taskId` → legacy-id resolution for the short swap window).

- **`src/api/index.js`** — register the new endpoints: `/api/scheduled-tasks/list`, `/api/scheduled-tasks/create`, `/api/scheduled-tasks/delete`, `/api/scheduled-tasks/registry-tasks`. Keep `status`, `update`, `history` mounted.

- **`ui/src/pages/settings/RelaySettings.jsx`** —
  - Rename `<ScheduledTaskCard>` → `<ScheduledEntryCard>`. Props change from `{ taskId, title, hint, banner }` to `{ entry, onEdit, onDelete }`. The card still owns its enable-toggle + schedule-edit-and-save UX for *inline* fast tweaks; the modal is for full edits (label, args).
  - `<ScheduledTasksPanel>` becomes a list-driven component: fetches `/api/scheduled-tasks/list` once on mount, refetches after any create/update/delete, renders one `<ScheduledEntryCard>` per entry, plus the `+ Add Scheduled Entry` button.
  - The `HousePovUnconfiguredBanner` stays — it's now rendered conditionally inside the `legacy:refreshSearchIndex` entry's card (the card optionally accepts a banner-prop wired from a small mapping table `entry.taskId → bannerComponent`). This preserves story #4's UX.

- **`OPERATIONS.md`** — add a "Scheduled Tasks on-disk shape (v2)" subsection: documents the migration step, the one-way nature, and the recommended snapshot-before-upgrade for rollback comfort. Document the new endpoints. Document the BullMQ-dedup constraint for non-customer parameterized entries.

### Tests the Tester should write

(Architect leaves Phase 3 to the Tester, but flags what the design hinges on so the test plan can cover the load-bearing paths.)

- **Migration:** v1 input → v2 output is deterministic; v2 input passes through unchanged; an empty file produces a v2 file with `entries: []`; the two existing entries' `enabled` and `intervalHours`/`intervalDays` are preserved bit-for-bit.
- **CRUD:** `create` rejects missing required args; `update` rejects re-introducing missing args; `delete` refuses to remove an enabled entry without `force: true`.
- **Multi-entry firing:** two enabled `processCustomer` entries with different customer pubkeys both fire on their own cadences (timer state map keyed by entryId), and both reach `/api/run-task` with the correct `pubkey=…&customerId=…&customerName=…` query string.
- **Deleted-customer auto-disable:** fire-time customer lookup failure flips `entry.enabled=false`, records `entry.lastError`, and emits an observable warning (event-log or response payload).
- **Backward-compat short window:** a `POST /api/scheduled-tasks/update` body carrying `{ taskId: "updateAllScoresForOwner", enabled: true, ... }` (without `entryId`, mimicking the legacy frontend) updates the migrated `legacy:updateAllScoresForOwner` entry rather than 400-ing.
- **Frontend:** modal save is disabled when a required arg is missing; modal save enabled when all required args present + schedule ≥ 1h; customer picker filters by name and by pubkey-prefix; argFieldRenderer falls back to text input on an unknown arg shape.

### Concept handle

None — no new concept-graph nodes, no firmware definitions touched.

## Out of scope

- **Adding entryId to the structured-log event records** — the "Recent Runs" table stays task-keyed with an inline caveat. Follow-up story can wire entryId through `launchChildTask.sh` and the event emitters.
- **Per-entry priority / dependency / chaining / run-on-startup** — explicitly out per the story.
- **Cron-style schedule expressions** — still days/hours intervals, per the story.
- **"Schedule for ALL customers" bulk-create UI** — explicitly out per the story.
- **Legacy Task Explorer scheduling on Bull Board** — Phase 2, separate story per the operator's planning.
- **BullMQ jobId rule extension** for non-customer parameterized tasks — documented constraint; out-of-scope here.
- **Typed argument renderers** for shapes not in the registry today (enums, datetimes, multi-select) — text-input fallback for now.
- **`<CustomerPicker>` extracted to shared component** — defer until a second consumer appears.
- **Auth changes on `/api/scheduled-tasks/*`** — the routes inherit the existing auth posture (admin/owner via the existing mount-point middleware in `src/api/index.js`). This ADR does not change it.
- **Removing the in-process scheduler in favor of BullMQ repeatable jobs (Option C)** — that's a Phase-2-of-ADR-0012 story, not this one.
