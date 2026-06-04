# ADR 0021: Per-task arguments and multiple entries per task in the Scheduled Tasks panel

> **History — renumbering and amendment.** Drafted 2026-05-23 as ADR 0015 against a stale local branch (76 commits behind `origin/staging`). Renumbered 0015 → 0021 at sync time when the collision with `origin/staging`'s `0015-task-queue-on-by-default.md` was discovered. **Body amended 2026-05-23** to build on `origin/staging`'s `ADR 0019 (Generalized task scheduler via BullMQ Job Schedulers)` instead of the in-process `setInterval` scheduler the original draft assumed — that scheduler was retired by ADR 0019 while this work was in flight. Companion story is [`engineering-team/stories/24-scheduled-tasks-with-arguments.md`](../stories/24-scheduled-tasks-with-arguments.md); the original-numbering review at [`engineering-team/reviews/24-scheduled-tasks-with-arguments.md`](../reviews/24-scheduled-tasks-with-arguments.md) documents the collision and the architectural change request. Original-design content is preserved in the safety branch `story-17-original-attempt`.

**Status:** Proposed (amended)
**Date:** 2026-05-23 (drafted), 2026-05-23 (amended)
**Story:** `engineering-team/stories/24-scheduled-tasks-with-arguments.md`
**Builds on:** ADR 0012 (BullMQ queue), ADR 0013 (neo4j-heavy semaphore), ADR 0015 (queue on by default — the `origin/staging` ADR 0015, not this one), **ADR 0019 (Generalized task scheduler — the foundation this amendment extends)**.
**Extends:** ADR 0019's per-task BullMQ Job Schedulers to per-entry, adding per-entry argument payloads.

## Context

Story #24 needs the Scheduled Tasks panel to (a) accept per-task arguments (customer pubkey, warmStart, limit, …), (b) allow multiple scheduled entries per task ID so an operator can schedule `processCustomer` for Alice every 6h *and* for Bob every 24h independently, and (c) drive the argument-input form from `src/manage/taskQueue/taskRegistry.json` so any future task with an `arguments` block becomes schedulable automatically.

ADR 0019 — which landed on `origin/staging` while this story was in flight on a stale branch — already generalized scheduling from ADR 0003's hardcoded two-task `DEFAULTS` to any registry task, added cron + sub-hour intervals, and made scheduling durable by replacing the in-process `setInterval` with **BullMQ Job Schedulers attached to each task's existing per-task queue**. That work solved orthogonal problems: any task can be scheduled, cron and sub-hour intervals are supported, schedules survive control-panel restarts via Redis AOF, and every fire routes through the existing Worker → `processor.processJob` → `launchChildTask` chain (so the `neo4j-heavy` semaphore, per-task concurrency, jobId behavior, and BullBoard apply for free). ADR 0019 did **not** address per-entry arguments or multi-entry-per-task scheduling — that gap remains.

### Grounded facts from reading the relevant source on `origin/staging` (HEAD `dba2910a`)

- **`src/api/scheduled-tasks/index.js`** (rewritten by ADR 0019): `readConfig` returns the v1 shape `{ [taskId]: { enabled, intervalDays, intervalHours, intervalMinutes, cron } }`. `isRegisteredTask(taskId)` validates against the live registry (not a hardcoded DEFAULTS). `handleStatus`, `handleUpdate`, `handleHistory`, `handleList` all key by `taskId`. The boot reconcile is `reconcileSchedulesFromConfig` ([id.:82](src/api/scheduled-tasks/index.js:82)), called from `bin/control-panel.js` after `initTaskQueue`, gated on `TASK_QUEUE_ENABLED`.
- **`src/manage/taskQueue/queue/scheduler.js`** (new in ADR 0019): the BullMQ Job Scheduler layer. Exports `upsertSchedule(taskId, cfg, registry)`, `removeSchedule(taskId)`, `getNextRun(taskId)`, `reconcileSchedules(config, registry)`, plus helpers `schedulerEnabled` (kill-switch via `/etc/brainstorm-task-queue.json scheduler:false`), `schedulerId(taskId)` = `` `sched:${taskId}` ``, `toRepeatOpts(cfg)` (cron > intervalDays/Hours/Minutes summed to `every` ms), `isValidSchedule(cfg)` (cron OR any positive interval — no 1h floor).
- **Per-task BullMQ queue topology** (from ADR 0012, exposed at [src/manage/taskQueue/queue/index.js:166](src/manage/taskQueue/queue/index.js:166)): `taskQueue.getQueue(taskId)` returns the BullMQ `Queue` for that task. `getAllQueues()` returns the full set. Each queue's Worker runs `processor.processJob(job, taskDef)` ([processor.js:79](src/manage/taskQueue/queue/processor.js:79)).
- **The processor's job-data contract** ([processor.js:81-87](src/manage/taskQueue/queue/processor.js:81)): `const { taskName, customerArgs, queryParams, timeoutMs } = job.data;` then `buildChildArgs(taskDef, customerArgs, queryParams)`. `buildChildArgs` (lines 21-39) already handles registry `staticArgs`, customer triple from `customerArgs.{pubkey,customerId,customerName}`, optional `limit` from `queryParams.limit`, and the `warmStart` literal token from `queryParams.warmStart === 'true'`. **This is the key integration point** — the same shape that the manual `/api/run-task` path uses already, the scheduler just needs to populate it at upsert time.
- **`upsertJobScheduler` API** (BullMQ 5.76.10 — confirmed in-container, ADR 0019 §Context): `queue.upsertJobScheduler(schedulerId, repeatOpts, { name, data })`. The `data` payload becomes `job.data` on every tick. (This ADR uses `data: { taskName, entryId, timeoutMs }` — see Option A below for why args are resolved at fire time, not embedded here.)
- **`/api/get-customers`** ([src/api/customers/getCustomers.js](src/api/customers/getCustomers.js)) is the same data source the legacy Task Explorer's customer-selector modal uses. It's the natural reuse target for the new modal's customer picker.
- **Live registry shape** today: 54 tasks, 18 parameterized (14 with `customer: true`, plus warmStart/limit variants). `taskQueueManager`, `taskScheduler`, `taskExecutor`, `systemStateGatherer` carry `frequency: "continuous"` — daemons, not schedulable.
- **Live config on `origin/staging`** today contains the two no-arg legacy entries (`updateAllScoresForOwner`, `refreshSearchIndex`) at minimum; possibly the reconciliation tasks if the operator has enabled them via ADR 0019's panel.

### Concept-graph impact

The PO oriented at planning time and re-verified at architecture; nothing relevant has changed since. The Scheduled Tasks subsystem, Task Registry, "customer-as-an-operator-concept", and Task argument shape are not formal concept-graph nodes. The closest concept for "customer" is `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:nostr-user`. **No concept-graph or firmware schema changes. No firmware reinstall.**

### Story-#24 open questions — resolved

1. **Data-model migration shape** → entries array (v2 schema below), idempotent migrator, stable `legacy:<taskId>` IDs for entries migrated from ADR 0019's v1 shape. Bit-for-bit preservation of all five schedule fields (`enabled`, `intervalDays`, `intervalHours`, `intervalMinutes`, `cron`).
2. **Deleted-customer runtime behavior** → **fire-time check (load-bearing) + save-time check (fast feedback) + render-time UI badge (cosmetic).** At fire time the processor resolves the entry's customer via `CustomerManager`; on miss it persists `entry.enabled = false` + `entry.lastError = { code: 'CUSTOMER_NOT_FOUND', … }`, removes the Job Scheduler, and fails the job (so the run is visible in BullBoard with a clear cause). At save time, create/update endpoints reject 400 if `args.customer` doesn't resolve — fast feedback for the operator. At render time, the panel additionally cross-references each entry's `args.customer` against `/api/get-customers` and surfaces an inline "⚠️ Customer no longer exists" badge for any orphan, so deletions surface even before the next fire.
3. **Server-side re-validation at fire time** → **yes.** The processor's fire-time branch (see Option A below) re-loads the entry from the on-disk config, re-validates against the current registry via `validateEntry`, and re-resolves the customer triple via `CustomerManager`. If anything fails — registry change made the entry invalid, customer was deleted, args got malformed — the entry is auto-disabled with `lastError` recorded and the job fails fast (no launchChildTask). This trades a small per-fire CustomerManager + readConfig cost for fresh state and authoritative auto-disable.
4. **Entry label** → in-data label is set once at save time (auto-generated `"<task.name> — <customer.name>"` for customer-task entries, `"<task.name>"` for non-customer entries; the operator may override). The panel **computes a display-label at render time** for customer-task entries: if the operator hasn't set an explicit label, the panel re-derives `"<task.name> — <current customer.name>"` from the live customer list. So a customer rename is reflected in the UI on the next refresh without operator intervention. (The stored `entry.label` is only used when the operator explicitly set it.)
5. **Default argument shape on first add** → pre-fill optional arguments from their registry `default` value (matches the legacy Task Explorer's behavior for the same task).

## Options considered

### Option A — Per-entry BullMQ Job Schedulers, args resolved at FIRE time via a processor branch (chosen)

The smallest mechanical extension of ADR 0019:

1. **On-disk shape** at `/var/lib/brainstorm/scheduled-tasks.json` (v2):

    ```json
    {
      "version": 2,
      "entries": [
        { "id": "legacy:updateAllScoresForOwner",
          "taskId": "updateAllScoresForOwner",
          "label": "Update All Scores for Owner",
          "args": {},
          "enabled": false,
          "intervalDays": 0, "intervalHours": 24, "intervalMinutes": 0, "cron": ""
        },
        { "id": "legacy:refreshSearchIndex",
          "taskId": "refreshSearchIndex",
          "label": "Refresh Meilisearch profiles & House PoV scores",
          "args": {},
          "enabled": false,
          "intervalDays": 0, "intervalHours": 24, "intervalMinutes": 0, "cron": ""
        },
        { "id": "01HF…uuid",
          "taskId": "processCustomer",
          "label": "Process Customer — Alice",
          "args": { "customer": "<alice-hex-pubkey>", "warmStart": false },
          "enabled": true,
          "intervalDays": 0, "intervalHours": 6, "intervalMinutes": 0, "cron": ""
        }
      ]
    }
    ```

   The schedule shape (the five existing fields — `enabled`, `intervalDays`, `intervalHours`, `intervalMinutes`, `cron`) is preserved exactly from ADR 0019; this amendment only adds the per-entry `id`, `taskId`, `label`, `args`, and optional `lastError`. The container of those entries changes from `{ [taskId]: schedule }` to `{ version: 2, entries: [{ id, taskId, label, args, ...schedule, lastError? }, ...] }`.

2. **Auto-migration on read.** `readConfig()` pipes through `migrateConfigIfNeeded(loadedJson, registry)`:
   - v2 input (has `version === 2 && Array.isArray(entries)`) → passes through unchanged.
   - v1 input (ADR 0019's flat shape — has top-level taskId keys) → each top-level key becomes a v2 entry with `id: "legacy:<taskId>"`, `args: {}`, `label: registry.tasks[taskId].name || taskId`, all five schedule fields preserved bit-for-bit.
   - Empty / null / non-object input → `{ version: 2, entries: [] }` (fresh-install posture).
   - Migration is idempotent.

3. **Job Schedulers keyed by entryId, not taskId.** Story #24's central enablement. Each enabled entry upserts a Job Scheduler keyed `` `sched:${entry.id}` `` (instead of ADR 0019's `` `sched:${taskId}` ``) onto the **same per-task queue** (`taskQueue.getQueue(entry.taskId)`). Two `processCustomer` entries (one for Alice, one for Bob) become **two distinct Job Schedulers** on the **same `processCustomer` queue** — BullMQ schedules each independently. Each tick adds one job per scheduler, both flow into the same Worker, both respect per-task concurrency = 1 (so Alice's run blocks Bob's run when they overlap — acceptable; the BullMQ queue serializes naturally).

4. **Job Scheduler's job template carries ONLY identity — no resolved args.** The data payload is minimal; everything resolvable is resolved fresh at fire time:

    ```js
    queue.upsertJobScheduler(
      `sched:${entry.id}`,
      toRepeatOpts(entry),                     // cron > sum(d,h,m); ADR 0019's helper
      {
        name: entry.taskId,
        data: {
          taskName: entry.taskId,
          entryId:  entry.id,                  // tells the processor "this is a scheduled fire, look me up"
          timeoutMs                            // pulled from registry.tasks[taskId].options.completion.failure.timeout.duration (ADR 0019 pattern)
        }
      }
    );
    ```

   No `customerArgs` or `queryParams` are embedded. This is the deliberate trade for fresh state.

5. **Fire-time resolution in the processor (new branch).** [`src/manage/taskQueue/queue/processor.js → processJob`](src/manage/taskQueue/queue/processor.js:79) gains a branch at the top:

    ```js
    function processJob(job, taskDef) {
      let { taskName, customerArgs, queryParams, timeoutMs, entryId } = job.data;

      // ── Scheduled-fire branch (story #24 / ADR 0021) ─────────────────
      if (entryId) {
        const resolved = resolveScheduledEntry(entryId, taskDef);  // reads /var/lib/brainstorm/scheduled-tasks.json + CustomerManager
        if (!resolved.ok) {
          // Auto-disable the entry, remove its Job Scheduler, fail the job.
          await disableEntryWithError(entryId, resolved.error);
          throw new Error(`[scheduler] entry ${entryId} auto-disabled: ${resolved.error.code} — ${resolved.error.message}`);
        }
        customerArgs = resolved.customerArgs;
        queryParams  = resolved.queryParams;
      }
      // ── Existing manual-/api/run-task path (unchanged) ──────────────
      const args = buildChildArgs(taskDef, customerArgs, queryParams);
      // … rest of processJob unchanged …
    }
    ```

   `resolveScheduledEntry(entryId, taskDef)` is the new helper. It:
   - Loads `/var/lib/brainstorm/scheduled-tasks.json` (the v2 file — small, cheap to re-read; no in-memory caching needed since it's authoritative on disk).
   - Finds the entry by `id`.
   - Re-validates via `validateEntry(entry, registry)` — catches a registry change that made the args invalid since upsert.
   - For customer-task entries: calls `new CustomerManager().getCustomer(entry.args.customer)`; failure → returns `{ ok: false, error: { code: 'CUSTOMER_NOT_FOUND', … } }`.
   - On success returns `{ ok: true, customerArgs, queryParams }` ready for `buildChildArgs`.

   `disableEntryWithError(entryId, error)` is the auto-disable helper. It:
   - Loads the config, sets `entry.enabled = false`, sets `entry.lastError = error`, writes back.
   - Calls `scheduler.removeSchedule(entryId)` to drop the Job Scheduler from Redis.
   - Logs a structured event to `events.jsonl` for visibility.

   The branch is gated on `if (entryId)` — manual `/api/run-task` calls (which embed `customerArgs`/`queryParams` directly per the existing pattern) take the unmodified path; the processor stays backward-compatible for those.

6. **Reconcile invariant extended (simpler than before).** ADR 0019's `reconcileSchedules(config, registry)` becomes per-entry but **does NOT call CustomerManager** — customer existence is no longer the boot reconcile's concern (the processor handles it per fire):
   - For each entry in `config.entries`: if `enabled` AND `isValidSchedule(entry)` AND `isRegisteredTask(entry.taskId)` → `upsertSchedule(entry, registry)` and add `entry.id` to `enabledIds`. (Customer existence is intentionally NOT checked here — see point 5.)
   - For each entry NOT in those criteria → `removeSchedule(entry.id)`.
   - Orphan cleanup: iterate every queue's `getJobSchedulers()`, find any key starting with `sched:` whose entryId (after stripping the prefix) isn't in `enabledIds` → `removeJobScheduler`. **Critical:** ADR 0019's orphan cleanup currently strips `sched:` and tests against a taskId set. This amendment changes that to test against an entryId set. The old `sched:${taskId}` schedulers (left over from the per-task era) become orphans after migration — the cleanup correctly removes them (their stripped key won't be in the new entryId set).
   - On boot, any entry that was previously auto-disabled (has `enabled: false` + `lastError.code: 'CUSTOMER_NOT_FOUND'`) stays disabled because it's not in the enabled set; its Job Scheduler stays removed. The operator must edit (re-enable + select a new customer, or delete) to clear the state.

7. **New CRUD HTTP surface** (additive, replacing ADR 0019's per-task handlers):
   - `GET  /api/scheduled-tasks/list` → `{ entries: [...] }` — replaces ADR 0019's per-task list with the per-entry list. Each entry includes timer state from `getNextRun(entry.id)`. **This is a breaking API shape change** versus ADR 0019's `{ tasks: [...] }` — but ADR 0019's panel is being replaced in the same change, and no external client is known to consume this endpoint.
   - `POST /api/scheduled-tasks/create` → `{ taskId, args, label?, enabled, intervalDays?, intervalHours?, intervalMinutes?, cron? }` → assigns `id = "entry-" + crypto.randomUUID()`, validates via `validateEntry`, persists, upserts the Job Scheduler if enabled.
   - `POST /api/scheduled-tasks/update` → `{ entryId, ...patch }` → loads, applies patch, re-validates, persists, upserts/removes Job Scheduler.
   - `POST /api/scheduled-tasks/delete` → `{ entryId, force?: boolean }` → refuses to remove an enabled entry without `force: true`; removes the entry from config + removes the Job Scheduler.
   - `GET  /api/scheduled-tasks/status?entryId=<id>` → per-entry status.
   - `GET  /api/scheduled-tasks/history?entryId=<id>` → per-task-name event-log records filtered by `entry.taskId`. Inline caveat: entries sharing a taskId share this history surface; per-entry history granularity is a follow-up that requires entryId tagging in `events.jsonl`, out of scope here.
   - `GET  /api/scheduled-tasks/registry-tasks` → parameterized-task subset (tasks with non-empty `arguments` and `frequency !== "continuous"`) for the add-entry modal's task picker.

8. **Validation rules** (`validateEntry(entry, registry)` returns `{ ok, errors: [{field, code, message}] }`):
   - `entry.taskId` exists in registry.
   - `registry.tasks[taskId].frequency !== "continuous"`.
   - For each declared `arguments` shape:
     - `customer: true` → required, 64-char *lowercase* hex string. (Customer existence is checked separately at save and boot reconcile via CustomerManager.)
     - `customer: false` → if provided, must still match the pubkey shape; absent allowed.
     - `{ type: "boolean", … }` → boolean or undefined.
     - `"optional"` (e.g. `limit`) → undefined or non-negative integer.
     - Any other shape → text-input fallback (passes through, logged via console.warn).
   - Schedule shape: if `enabled`, must satisfy `scheduler.isValidSchedule(entry)` (cron OR any positive interval — no 1h floor, per ADR 0019).

9. **Boot reconcile sequencing** unchanged from ADR 0019: `bin/control-panel.js` calls `scheduledTasks.reconcileSchedulesFromConfig()` once at startup, gated on `TASK_QUEUE_ENABLED`. The function now uses the v2-aware `readConfig` (which migrates if needed) and the per-entry `reconcileSchedules`.

10. **Frontend.** Replace ADR 0019's per-task `ScheduledTasksPanel` with a per-entry version. Same shape as the original ADR 0021 draft (which the Implementer's safety branch already has, mostly correct):
    - **`<ScheduledTasksPanel>`** lists every entry from `/api/scheduled-tasks/list`. "Add Scheduled Entry" button opens the modal. `LEGACY_TITLE_OVERRIDES` map preserves story #4's exact titles for `legacy:updateAllScoresForOwner` and `legacy:refreshSearchIndex` cards. The HousePovUnconfiguredBanner from story #4 still renders inside `legacy:refreshSearchIndex`'s card.
    - **`<ScheduledEntryCard entry, onEdit, onDelete, banner, displayTitle>`** renders one entry: toggle, days/hours/minutes/cron (ADR 0019's full set), Save (inline schedule tweak), Edit (opens modal for args/label), Delete (with `force` confirm if enabled). Args summary line below the title. `lastError` red badge when present.
    - **`<AddOrEditEntryModal entry?>`** — task picker (registry-tasks endpoint, filtered to parameterized subset), registry-driven argument form via `argFieldRenderer`, label input, full schedule controls (days/hours/minutes/cron). Save is disabled while required args are unset.
    - **`<CustomerPicker>`** — fetches `/api/get-customers`, type-ahead by name + pubkey substring.
    - **`argFieldRenderer({name, schema, value, onChange, error})`** — switch over `customer` / `boolean` / `"optional"` arg shapes with text-input fallback for unknown shapes.

11. **Deleted-customer indicator at panel render.** The panel additionally fetches `/api/get-customers` once on mount; each enabled entry whose `args.customer` doesn't appear in the customer list gets an inline "⚠️ Customer no longer exists" badge regardless of whether the boot reconcile has run since. This is cosmetic but surfaces the problem quickly.

**Pros**

- **Fresh customer state every fire.** Per-fire `CustomerManager.getCustomer(entry.args.customer)` means a rename surfaces immediately (next fire uses the new name in logs / structured events) and a delete is caught with **authoritative auto-disable** the moment it would otherwise have caused a bad run — no stale-data window, no fire-and-fail-then-cleanup-on-next-boot.
- **Single load-bearing customer check, in one place.** Save-time rejection gives fast feedback; render-time badge gives ambient visibility; but the **fire-time check is what guarantees** that a scheduled fire never runs with a missing customer. The other two are nice-to-have UX, not correctness — operator can disable either without semantic regression.
- **Durable by construction.** Inherits ADR 0019's Redis-AOF persistence for the schedule itself; the args resolution is rebuilt at every fire from the on-disk config (the source of truth), which is itself bounded by file-system durability.
- **Cron + sub-hour supported.** Inherits ADR 0019's `intervalMinutes` + `cron`.
- **Reusable code from the safety branch.** `migration.js`, `validation.js`, `argFieldRenderer.jsx`, `CustomerPicker.jsx`, `AddOrEditEntryModal.jsx` are largely unchanged from the original ADR 0021 draft — the Implementer cherry-picks them from `story-17-original-attempt`.

**Cons**

- **Per-fire cost.** Every scheduled fire does (a) a small `fs.readFileSync` of `scheduled-tasks.json` (~few KB), (b) a `validateEntry` pass (pure-JS, microsecond-scale), and (c) for customer tasks, a `new CustomerManager().initialize() + getCustomer()` call. At realistic operator scale (~10–30 enabled customer-task entries on per-hour or sub-hour cadences), this is bounded at ~30 lookups/hour = trivial. Worth measuring at staging if the entry count ever climbs into the hundreds.
- **Processor layering coupling.** ADR 0019 made the processor reconciliation-agnostic — it knew nothing about `scheduled-tasks.json`. This ADR breaks that by adding a fire-time branch that reads the scheduled-tasks file and invokes the `validateEntry`/`disableEntry` helpers. **Mitigation:** keep the data dependency (file read, not API import) lightweight and contained to the `if (entryId)` branch; the manual `/api/run-task` code path is unchanged and remains scheduled-tasks-agnostic. The new helper `resolveScheduledEntry` lives in a small co-located module (`src/manage/taskQueue/queue/entryResolver.js`) so the processor's only added import is one helper, not the whole scheduled-tasks API.
- **One-way on-disk migration.** Rolling back to a pre-ADR-0021 server image after entries have been created in v2 shape requires a JSON snapshot taken before the upgrade or manual reshape. Documented in OPERATIONS.md.
- **Job Scheduler proliferation.** N entries per task = N Job Schedulers. At realistic scale (e.g., 10 customers × `processCustomer` + `calculateCustomerGrapeRank` + `loadCustomerScoresIntoMeilisearch` = 30 schedulers), tiny by Redis standards — each is a hash entry.
- **API shape change versus ADR 0019.** `GET /api/scheduled-tasks/list` returns `{ entries: [...] }` instead of `{ tasks: [...] }`; `handleStatus`/`handleUpdate` key by `entryId` instead of `taskId`. ADR 0019's panel is being replaced in the same PR; no external client is documented; no backward-compat shim is added (operator explicitly approved the break).
- **Auto-disable is permanent until edit.** A `CUSTOMER_NOT_FOUND` auto-disable stays disabled until the operator edits the entry — even if the customer is later re-created with the same pubkey (e.g., recovery from accidental deletion). The operator must explicitly re-enable. Acceptable: the alternative ("auto-re-enable if customer reappears") is sketchy from a security/observability standpoint.

### Option B — Per-task Job Scheduler, scheduled-tick wrapper picks one entry per fire (rejected)

Keep ADR 0019's per-task Job Schedulers; have a custom job-add hook resolve which entry to fire at each tick.

**Cons:** Doesn't actually work. BullMQ's `upsertJobScheduler` adds **one** job per tick. To fire multiple entries on independent cadences, you need multiple Job Schedulers. A per-task Job Scheduler firing once per tick can't satisfy "Alice every 6h, Bob every 24h, both `processCustomer`" simultaneously. Fundamentally wrong shape.

### Option C — Single global Job Scheduler with a custom dispatcher (rejected)

One Job Scheduler at the highest-frequency interval; a custom processor decides which entries are "due" each tick.

**Cons:**
- Loses BullMQ's native per-scheduler timing — every entry shares one tick rate.
- Reinvents per-scheduler timing in user code; loses Redis-AOF durability of the schedule itself.
- Doesn't compose with the per-task queue topology (which entry goes to which queue?).
- Strictly worse than Option A on every axis.

### Option D — Resolve customerArgs at UPSERT time (rejected — would have been the original choice)

Embed `{ taskName, customerArgs, queryParams, timeoutMs }` in the Job Scheduler's job template at upsert time, so every fire reuses the snapshot. The processor stays unchanged (matches the existing manual `/api/run-task` data shape exactly).

**Pros:**
- **No processor change** — the existing `job.data` shape already supports this.
- **Cleanest layering** — the queue/processor layer stays reconciliation-agnostic, ADR 0019's "scheduler is dumb" property is preserved.
- **No per-fire CustomerManager cost.**

**Cons (why rejected after operator decision):**
- **Customer-rename staleness.** A renamed customer's `customerName` stays in the Job Scheduler's job template until the operator edits the entry. The customer triple resolves correctly by pubkey at script time (so the run works), but log messages, structured events, and any name-driven downstream effects show the old name. Cosmetic but real.
- **Customer-delete window.** A customer deleted between two boot reconciles fails at fire time (script can't find the customer directory) until the next boot reconcile catches it. Run-history surfaces the failure, but the failure happens at all — multiple times before cleanup, if the cadence is short.
- **Auto-disable is delayed.** Cleanup happens at next boot reconcile, not at the fire that exposed the problem. For an operator running with infrequent restarts, a deleted customer's entry might fail-and-recover-fail-and-recover daily for days.

The operator explicitly chose the layering cost in §Story-#24-open-questions Q2/Q3 to get fresh customer state and authoritative auto-disable. Rejected.

## Decision

**We chose Option A.** Per-entry BullMQ Job Schedulers; the Job Scheduler's job template carries only `{ taskName, entryId, timeoutMs }`; the processor branches on `entryId` to load the entry, re-validate against the registry, resolve the customer fresh via `CustomerManager`, and auto-disable on miss; v2 on-disk shape with stable `legacy:<taskId>` IDs for migration.

The reasoning: per-entry Job Schedulers are the smallest extension of ADR 0019's per-task pattern that supports multi-entry-per-task scheduling, and the BullMQ Job Scheduler API supports the per-scheduler durability + timing we need for free. The customer-resolution question (fire-time vs. upsert-time — Option A vs. D above) was decided by the operator in favor of fresh state and authoritative auto-disable, accepting a small per-fire cost and a small processor-layering coupling.

What we are trading away (relative to ADR 0019's status quo):
- The processor is no longer reconciliation-agnostic — it gains an `if (entryId)` branch that reads `scheduled-tasks.json` + calls `CustomerManager`. Contained to one branch + one helper module.
- A small per-fire cost (file read + CustomerManager lookup).
- One-way migration (no rollback without a snapshot).
- API shape change versus ADR 0019's per-task `/list` (no external clients known; same-PR panel replacement; operator explicitly approved the break).

What we are not changing:
- The per-task queue topology.
- The kill-switch (`/etc/brainstorm-task-queue.json scheduler:false`).
- The `events.jsonl` history surface (still task-keyed; per-entry granularity is a follow-up).
- The manual `/api/run-task` code path through the processor (the new branch is gated on `entryId`, only scheduled fires take it).

## Consequences

**Enabled**
- Operator's primary motivation: schedule `processCustomer` (and the other 13 customer-scoped tasks, plus `processAllTasks`/warmStart and `exportOwnerKind30382`/limit) per-customer on independent cadences, with each fire reaching the script with the configured args.
- Durable per-entry scheduling (Redis AOF) with cron + sub-hour intervals (inherited from ADR 0019).
- Every fire flows through the existing queue → Worker → processor → launchChildTask chain, automatically subject to per-task concurrency, the `neo4j-heavy` semaphore, and BullBoard visibility.
- **Fresh customer state per fire.** A customer rename surfaces in the next fire's logs / structured events without operator intervention; a customer deletion triggers authoritative auto-disable at the fire that would otherwise have failed, not days later at next boot reconcile.
- **Display-label freshness** in the panel — for entries without an operator-supplied label, the panel re-derives `"<task.name> — <current customer.name>"` at render time from the live customer list, so a rename shows up immediately on the next refresh.

**Constrained / made harder**
- **Processor layering coupling.** The processor is no longer reconciliation-agnostic — it reads `scheduled-tasks.json` and calls `CustomerManager` in the new fire-time branch. Contained to `if (entryId)` and a single helper module (`src/manage/taskQueue/queue/entryResolver.js`); manual `/api/run-task` calls take the unchanged path.
- **Per-fire cost** (small but real): `fs.readFileSync` on a few-KB JSON + `validateEntry` (microsecond-scale) + for customer tasks, `CustomerManager.initialize() + getCustomer()`. At realistic scale (~30 enabled customer-task entries on hourly cadence) ~30 lookups/hour. Worth measuring at staging if entry count grows past a hundred.
- **Auto-disable persists until edit.** Once a `CUSTOMER_NOT_FOUND` fire auto-disables an entry, it stays disabled even if the customer is re-created with the same pubkey — operator must explicitly edit/re-enable. (Alternative — "auto-re-enable on customer reappearance" — was considered and rejected as too magical from a security/observability standpoint.)
- **One-way on-disk migration** (documented).
- **Per-entry history granularity unavailable**; multiple entries sharing a taskId share the task-keyed `events.jsonl`. Inline UI caveat. Follow-up story can wire entryId through `launchChildTask.sh`'s event emission.
- **BullMQ jobId dedup for non-customer parameterized tasks** (e.g., two `processAllTasks` entries with different warmStart): the manual `/api/run-task` path dedups by `${taskName}`; scheduled fires via `upsertJobScheduler` auto-generate per-tick jobIds and don't share that dedup, but the per-task queue concurrency = 1 serializes them anyway — operator behavior matches expectation.

**Follow-up debt** (out of scope here)
- Entry-id-aware structured logging (per-entry history granularity).
- BullMQ-jobId-tagged-with-args for sub-second-overlap dedup on non-customer parameterized tasks (only matters if operator schedules two such entries with sub-task-runtime intervals — pathological).
- A `<CustomerPicker>` extraction to a shared component (defer until a second consumer appears).
- Cron preset library / common-pattern dropdown ("hourly", "daily 04:00 UTC", etc.). Pure UX; not load-bearing.

**Firmware reinstall required?** No.

## Implementation notes

The Implementer reads this section verbatim.

### Files to add

These are largely unchanged from the original ADR 0021 draft and can be cherry-picked from the safety branch `story-17-original-attempt` with the noted adjustments.

- **`src/api/scheduled-tasks/migration.js`** — `migrateConfigIfNeeded(loadedJson, registry) → { version: 2, entries: [...] }`. Pure function; idempotent; deterministic `legacy:<taskId>` IDs. **One change from the safety-branch version:** the v1 source shape now has five schedule fields (`enabled`, `intervalDays`, `intervalHours`, `intervalMinutes`, `cron`) per ADR 0019; the migrator must preserve all five, not just the three the safety-branch version preserves.
- **`src/api/scheduled-tasks/validation.js`** — `validateEntry(entry, registry) → { ok, errors }`. **One change from the safety-branch version:** add a check that `entry.cron` (when present) is a non-empty string; add a check that the schedule satisfies `scheduler.isValidSchedule(entry)` if `enabled === true`. Reuse the existing PUBKEY_RE regex for customer validation.
- **`ui/src/pages/settings/scheduledTasks/AddOrEditEntryModal.jsx`** — registry-driven modal. **One change from the safety-branch version:** add `intervalMinutes` and `cron` inputs to the schedule section (cron overrides interval, per ADR 0019). Save remains disabled while required args are unset.
- **`ui/src/pages/settings/scheduledTasks/CustomerPicker.jsx`** — search-and-select component. **Reusable as-is** from the safety branch.
- **`ui/src/pages/settings/scheduledTasks/argFieldRenderer.jsx`** — switch over customer / boolean / optional with text-input fallback. **Reusable as-is** from the safety branch.

### Files to add

(In addition to the ones listed above.)

- **`src/manage/taskQueue/queue/entryResolver.js`** — new helper, the home for the processor's fire-time branch. Exports:
  - `resolveScheduledEntry(entryId, taskDef) → { ok: true, customerArgs, queryParams } | { ok: false, error: { code, message, field?, pubkey? } }`. Loads `/var/lib/brainstorm/scheduled-tasks.json` (fresh `fs.readFileSync` each call — small file, no caching), finds the entry by id, re-validates via `validateEntry`, and for `task.arguments.customer === true` resolves the customer via `new CustomerManager().initialize() + getCustomer(entry.args.customer)`. Returns the customer triple + queryParams (built from `entry.args.warmStart`/`entry.args.limit`) on success, or a clear error code on miss.
  - `disableEntryWithError(entryId, error)` — loads the config, sets `entry.enabled=false`+`entry.lastError=error`, writes back, calls `scheduler.removeSchedule(entryId)`, emits a structured event to `events.jsonl` with `{ eventType: 'ENTRY_AUTO_DISABLED', entryId, error }`.

  This file is the only new dependency the processor takes on the scheduled-tasks model. Co-located with the processor (`src/manage/taskQueue/queue/`) so the "processor knows about scheduled tasks" coupling is visible in one directory.

### Files to edit

- **`src/manage/taskQueue/queue/scheduler.js`** (ADR 0019's file) — generalize per-task → per-entry:
  - `upsertSchedule(entry, registry)` — takes the full entry. **No CustomerManager lookup at upsert time.** Just looks up `timeoutMs` from the registry and calls `queue.upsertJobScheduler(`sched:${entry.id}`, toRepeatOpts(entry), { name: entry.taskId, data: { taskName: entry.taskId, entryId: entry.id, timeoutMs } })`.
  - `removeSchedule(entryId, taskId?)` — keyed by entryId; optional taskId hint to avoid scanning all queues; falls back to scanning all queues when the entry is already removed from config.
  - `getNextRun(entryId, taskId)` — adds the taskId hint to avoid an O(N) queue search; falls back to scanning all queues if taskId isn't supplied.
  - `reconcileSchedules(config, registry)` — iterates `config.entries`. For each enabled+valid+registered entry → `upsertSchedule`. (No CustomerManager check — fire-time handles it.) For each disabled/invalid/unregistered entry → `removeSchedule`. Orphan cleanup strips `sched:` and tests against entryIds.
  - `removeAllManaged()` — unchanged.
- **`src/manage/taskQueue/queue/processor.js`** (ADR 0019's file) — add the fire-time branch:
  - At the top of `processJob`, after destructuring `job.data`, add `if (entryId) { ... resolveScheduledEntry + auto-disable on miss ... }` as sketched in §Option-A point 5 above.
  - On `resolveScheduledEntry` failure: `await disableEntryWithError(entryId, resolved.error); throw new Error(...)`. The `throw` marks the BullMQ job as failed so BullBoard shows the cause; the disable persists the state so subsequent fires of this entry can't happen.
  - On success: overwrite the local `customerArgs` and `queryParams` variables with the resolved values, then continue into the existing `buildChildArgs` + `spawn` path **unchanged**. The branch never reaches the manual-call code path for scheduled fires (the `if` short-circuits).
  - Import `resolveScheduledEntry` and `disableEntryWithError` from `./entryResolver`.
- **`src/api/scheduled-tasks/index.js`** (ADR 0019's file) — generalize per-task → per-entry:
  - Replace `getTaskConfig(taskId)` with `findEntry(config, entryId)`.
  - `readConfig` pipes through `migrateConfigIfNeeded` (import from `./migration`).
  - `handleStatus(req)` — read `req.query.entryId`; return per-entry status with timer state from `scheduler.getNextRun(entryId, entry.taskId)`. Include `lastError` from the entry.
  - `handleList(req)` — return `{ success: true, entries: config.entries.map(decorate) }` where `decorate` adds the timer state and the entry's `lastError`. Do NOT compute display-label here (the panel does it client-side from the customer list — see frontend below).
  - `handleUpdate(req)` — read `req.body.entryId`; load, apply patch, re-validate via `validateEntry`, persist, call `scheduler.upsertSchedule` (if enabled) or `removeSchedule` (otherwise). For customer-task updates with `args.customer` set, do a synchronous CustomerManager check and 400 on miss — fast feedback so the operator doesn't save an entry that would auto-disable on its first fire. (This is the save-time check from Q2 — defense-in-depth for fast feedback, not the load-bearing check.)
  - `handleCreate(req)` — new. Generate `id = "entry-" + crypto.randomUUID()`; validate; do the save-time customer check; persist; upsert if enabled.
  - `handleDelete(req)` — new. Read `req.body.entryId` + `req.body.force`. Refuse 400 if enabled-without-force; remove from config + `scheduler.removeSchedule(entryId, entry.taskId)`.
  - `handleHistory(req)` — read `req.query.entryId`; return `getRecentRuns(entry.taskId, 5)` plus the per-entry caveat note.
  - `handleRegistryTasks(req)` — new. Iterate registry, filter to `frequency !== "continuous"` AND non-empty `arguments`, return `{ tasks: [...] }`.
  - `reconcileSchedulesFromConfig()` — unchanged in name; internally now operates on entries.
- **`src/api/index.js`** — register the new routes alongside ADR 0019's existing ones:
  - `app.get('/api/scheduled-tasks/list', scheduledTasks.handleList)` — ADR 0019 already registered this; the handler shape changes, route stays.
  - `app.post('/api/scheduled-tasks/create', scheduledTasks.handleCreate)` — new.
  - `app.post('/api/scheduled-tasks/delete', scheduledTasks.handleDelete)` — new.
  - `app.get('/api/scheduled-tasks/registry-tasks', scheduledTasks.handleRegistryTasks)` — new.
  - `app.get('/api/scheduled-tasks/status', …)`, `app.post('/api/scheduled-tasks/update', …)`, `app.get('/api/scheduled-tasks/history', …)` already registered by ADR 0019; the handlers change to key by `entryId` but route stays.
- **`ui/src/pages/settings/RelaySettings.jsx`** — replace the ADR 0019 per-task `ScheduledTasksPanel` with the per-entry version. Component structure already drafted in the safety branch; bring it forward with the schedule-input enhancements (intervalMinutes + cron in the inline-edit row of the card, mirroring the modal). Keep `LEGACY_TITLE_OVERRIDES` and `HousePovUnconfiguredBanner` wired. **Compute display-label client-side:** the panel fetches `/api/get-customers` once on mount; for each customer-task entry without an operator-set `entry.label`, derive `"<task.name> — <current customer.name>"` from the live customer list (so renames reflect immediately). For each customer-task entry whose `args.customer` isn't in the customer list, show the `⚠️ Customer no longer exists` badge. Render `entry.lastError` (red banner) whenever present.
- **`bin/control-panel.js`** — no change needed. The existing `scheduledTasks.reconcileSchedulesFromConfig()` call is the entry point; its internals change but the call site stays.
- **`OPERATIONS.md`** — extend ADR 0019's scheduled-tasks section with: (a) the per-entry model (entries array, IDs, args, label, lastError); (b) the v1 → v2 migration (one-way; recommend a JSON snapshot before deploy for rollback comfort); (c) the deleted-customer behavior — fire-time check + auto-disable + `lastError` recorded + Job Scheduler removed; operator must edit/re-enable to recover; (d) the small per-fire cost (file read + CustomerManager) and why we chose it over upsert-time resolution.

### What the Tester must update from the existing test plan

The existing test file at `test/scheduled-tasks-with-arguments.test.js` (preserved by the sync commit) is mostly reusable but needs updates:

- **Migration tests (T1-T5):** fixtures must include all five v1 schedule fields (the original draft only had three). T2's expected output must include `intervalMinutes` and `cron` preserved bit-for-bit.
- **Validation tests (T6-T12):** add coverage for `cron` field validation and the `isValidSchedule` rule (cron OR any positive interval, no 1h floor). Drop any assertions about the 1h floor.
- **Backend refactor sentinels (T13-T20):** the contract shifts. T13 ("timer-state map keyed by entryId") no longer applies (no in-process timer state). Replace with:
  - "scheduler.js exports `upsertSchedule(entry, …)` taking an entry, not a taskId"
  - "scheduler.js calls `queue.upsertJobScheduler(`sched:${entry.id}`, …)` with `entry.id`-prefixed key"
  - "scheduler.js's job-data payload includes `entryId` (NOT `customerArgs`/`queryParams` — those are resolved fresh at fire time)"
  - "reconcileSchedules iterates `config.entries`"
  - "scheduler.js's reconcileSchedules does NOT call CustomerManager — customer existence is fire-time, not reconcile-time"
  - "src/api/scheduled-tasks/index.js's handlers key by entryId, not taskId"
- **New behavioral tests for the fire-time branch:**
  - **entryResolver T1:** `resolveScheduledEntry(entryId, taskDef)` returns `{ ok: true, customerArgs, queryParams }` for a valid customer-task entry with a real customer pubkey fixture.
  - **entryResolver T2:** `resolveScheduledEntry` returns `{ ok: false, error: { code: 'CUSTOMER_NOT_FOUND', … } }` when the customer pubkey doesn't resolve via CustomerManager (mock or test-fixture).
  - **entryResolver T3:** `resolveScheduledEntry` returns `{ ok: false, error: { code: 'UNKNOWN_TASK' | 'INVALID_ENTRY', … } }` when the entry has been deleted from the config since upsert.
  - **disableEntryWithError T1:** writing the disable persists `enabled=false` + `lastError` + (mock-verifies) calls `scheduler.removeSchedule`.
  - **processor branch sentinel:** `src/manage/taskQueue/queue/processor.js`'s `processJob` references `entryId` and `resolveScheduledEntry` and `disableEntryWithError` — confirms the branch is wired.
- **Frontend sentinels (T21-T26):** mostly reusable; the modal's schedule section now includes `intervalMinutes` + `cron` inputs. Add: panel computes the display-label client-side from `/api/get-customers` (so a renamed customer reflects on next render).
- **Regression sentinels (R1-R2):** R1 (HousePovUnconfiguredBanner) keeps. R2 (initScheduler exported) no longer applies — ADR 0019 removed initScheduler in favor of `reconcileSchedulesFromConfig`. Replace with "reconcileSchedulesFromConfig still exported".

The cycle-local smoke items in the test plan (Reviewer-driven) become more important under per-fire resolution and gain a few:
- **Multi-entry firing** of two `processCustomer` entries with different customers on different cadences, observed in `events.jsonl` and BullBoard.
- **Customer rename round-trip:** rename a customer mid-schedule; verify the next fire's structured event carries the new `customerName` (not the old one).
- **Customer delete round-trip (NEW load-bearing test):** delete a customer mid-schedule; verify the NEXT FIRE (not the next boot) auto-disables the entry, writes `lastError`, removes the Job Scheduler from Redis, and emits the `ENTRY_AUTO_DISABLED` event in `events.jsonl`. Verify the panel shows the disabled state + lastError badge on next refresh. Verify the entry stays disabled across a control-panel restart.
- **Render-time deleted-customer badge:** delete a customer; refresh the panel; the entry shows `⚠️ Customer no longer exists` even before the next fire would tick.
- **Browser-visible Save disablement** on missing required args.
- **Per-entry timestamp independence** in the panel (Alice's next-run ≠ Bob's next-run).
- **handleDelete force-flag protection** at HTTP level.

### Concept handle

None — no new concept-graph nodes, no firmware definitions touched.

## Out of scope

- **Adding scheduling support to the legacy Task Explorer (Bull Board path).** Phase 2 of the original operator ask, separate story.
- **Per-entry priority / dependency / chaining / run-on-startup.** Each entry is independent.
- **Bulk-create UI** ("schedule for ALL customers"). Operator creates entries one at a time; bulk is a future story.
- **Notifications/alerts** on entry failure.
- **Argument types not yet present in the registry** (enums, datetimes, multi-select, file-upload). Text-input fallback for now; typed renderer is a future story.
- **Customer-management workflows.** Form consumes the existing list; doesn't modify it.
- **Argument-form refactor of the legacy Task Explorer** to share code with the new panel.
- **Reconciliation of the panel with the legacy Task Explorer's run-history view.** Each surface keeps its own history.
- **Per-entry granularity in `events.jsonl`.** Task-keyed today; entry-keyed is a follow-up that touches `launchChildTask.sh`'s structured-logging emission.
- **Server-side display-label refresh on customer rename.** The panel computes display labels client-side from `/api/get-customers`; the stored `entry.label` is set once at save time and only used when the operator explicitly customized it. A "rewrite-all-labels" backend pass on rename is unnecessary and out of scope.
- **Re-enable-on-customer-reappearance.** Once an entry auto-disables via `CUSTOMER_NOT_FOUND`, it stays disabled even if the customer is later re-created with the same pubkey. The operator must explicitly re-enable (which re-triggers the save-time customer check). Auto-re-enabling on reappearance is intentionally NOT done — too magical from a security/observability standpoint.
