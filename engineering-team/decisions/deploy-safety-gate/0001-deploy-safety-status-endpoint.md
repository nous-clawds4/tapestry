# ADR 0001: Deploy-safety status endpoint — live-state aggregation with a pure verdict core

**Status:** Proposed
**Date:** 2026-07-18
**Story:** `engineering-team/stories/deploy-safety-gate/1-deploy-safety-status-endpoint.md`

## Context

Every merge to a deploy-triggering branch recreates the `tapestry` container with no drain, killing any task in flight (intake 2026-06-08; deploy mechanics in the 2026-07-18 intake entry's architectural background). The story asks for one unauthenticated read-only GET that answers "is it safe to redeploy this instance right now?" Its acceptance criteria, quoted for the record:

- **AC-1 (one read-only unauthenticated GET, complete answer):** "Given a deployed instance, when its deploy-safety status endpoint is fetched with a plain unauthenticated GET — no login, no signing, no credentials; the calling convention available to a shell script — then a single successful machine-readable response reports all three of: (a) whether any covered task is running right now; (b) the next scheduled fire — the entry's name, its fire time, and the time remaining until it; and (c) an explicit safe/unsafe verdict. The request is read-only and repeatable: calling it any number of times changes no state, starts nothing, and cancels nothing."
- **AC-2 (what "running" covers — both sources):** "Given a covered task is executing at request time, when the endpoint is called, then running-now is true and the verdict is unsafe. Covered tasks span both execution paths, each verified independently: (a) an active job on any task queue — whether it was started by the schedule or by a manual run-task trigger; and (b) an in-flight run of the legacy per-customer scheduler."
- **AC-3 (phantom-running exclusion):** "Given the task-event history contains a task start with no matching end (the signature left when a previous container restart killed a task mid-run), and no covered task is actually executing now, when the endpoint is called, then running-now is false and the verdict is not made unsafe by the stale record. This exclusion has an explicit automated test."
- **AC-4 (verdict policy):** "Given no covered task is running, then the verdict is unsafe when the next fire among **all enabled** scheduled entries is within the buffer (defaulting to **10 minutes**), and safe when the next fire is beyond the buffer or no entries are enabled."
- **AC-5 (queue-disabled is not nothing-scheduled):** "Given the instance's task-queue layer is disabled, when the endpoint is called, then the response states that the queue is disabled, distinguishably from 'queue enabled but nothing scheduled,' and still returns a verdict per the ratified policy."

The story delegates two things to this ADR: the response payload shape, and whether/how the 10-minute buffer is configurable.

### Concept Graph orientation

`GET /api/concept-graph/summaries` (46 concepts, checked 2026-07-18): no handle covers scheduled tasks, task queues, deploys, or instance operations — confirming the story's "Concepts touched: None." No `/neighbors` or `/node` calls warranted; orientation proceeded to source. **No concept definitions change in this ADR.**

### Verified subsystem facts (intake background re-checked against source)

- **BullMQ layer.** `initTaskQueue()` builds one Queue + Worker per registry task and caches module state (`src/manage/taskQueue/queue/index.js:77-149`); `bin/control-panel.js:263-268` initializes it at boot when `TASK_QUEUE_ENABLED === 'true'`, in the **same process** that serves the API. `getAllQueues()` (`queue/index.js:171-174`) returns every queue, `[]` when uninitialized. Both trigger paths land on these same queues: manual `/api/run-task` via `enqueueTask` → `queue.add` (`queue/index.js:190-200`, routed from `src/api/manage/commands/runTask.js:417`), and scheduled fires via `upsertJobScheduler` on the task's queue (`src/manage/taskQueue/queue/scheduler.js:81-97`). So BullMQ **active** jobs (`queue.getActive()` / `getActiveCount()`) cover AC-2(a) for both paths with one scan. `isQueueAvailable()` (`queue/index.js:155-164`) is a cheap Redis ping that also returns false when the state was never initialized.
- **Why active-only is correct, not just ratified.** Waiting and delayed jobs (including `sched:*` Job Scheduler ticks) live in Redis, and `tapestry-redis` survives deploys (AOF); they resume after the container reboots. Only **active** jobs have a child process inside the `tapestry` container that a deploy kills. Counting waiting/delayed would be over-blocking; counting active is exactly the harm surface.
- **Legacy layer.** `src/api/customer-schedule/index.js:20-22` holds a module-private `customerTimers` Map with a live `taskRunning` boolean per customer (set at trigger, cleared by a 30s PID poll, `:55-91`). Its status API is per-pubkey only (`handleStatus`, `:188-220`). Same process → a new exported aggregate function is trivial. Because the Map is in-process memory, a container restart clears it — the legacy source cannot phantom.
- **The phantom trap.** Every history surface derives from `/var/log/brainstorm/taskQueue/events.jsonl` TASK_START/TASK_END grouping (`groupEventsIntoSessions`, `src/api/scheduled-tasks/index.js:171-204`, where a session with no TASK_END keeps `status: 'running'`). A deploy-killed task reads "running" there for up to 24h. AC-3 forbids this source for running-now.
- **Next-fire.** `readConfig()` (`src/api/scheduled-tasks/index.js:104-127`) yields the entry list; `scheduler().getNextRun(entryId, taskId)` (`src/manage/taskQueue/queue/scheduler.js:126-144`) yields each entry's next ISO timestamp, already consumed by `handleList` via `nextRunSafe` (`src/api/scheduled-tasks/index.js:219-222, 295`). Aggregating "next fire among all enabled entries" is a min() over data that already exists.
- **Auth.** `authMiddleware` is global (`bin/control-panel.js:253`); unauthenticated GETs fall through to `next()` unless the path is in the write/protected lists (`src/middleware/auth.js:469-489`). A new GET under `/api/deploy-safety/...` matches neither list — unauthenticated by construction, same as `/api/scheduled-tasks/list` (verified live on staging at intake).
- **Degraded mode.** With `TASK_QUEUE_ENABLED=false` the queue module is never required (`src/api/index.js:507`, `bin/control-panel.js:263-274`); the legacy scheduler still runs (its `initCustomerSchedulers()` call at `src/api/index.js:492` is unconditional), so AC-5's "legacy run in flight while queue disabled" is a real state.

### Constraints

- Unauthenticated read-only GET; plain-curl calling convention (frame bullet 1; `docs/SMOKE_TEST.md` NIP-07 limit).
- Ratified verdict policy, "running" definition, and phantom exclusion (story §Product decisions — not relitigated here).
- No new dependencies, no new lint/typecheck/build tooling (house rule; none needed — BullMQ and ioredis are already in the tree).
- No new TA-pubkey literals (CLAUDE.md; ADR 0015). This endpoint touches no TA-pubkey surface at all — nothing here filters by author, composes handles, or signs.
- Adjacent ADRs checked for conflict: task-queue-scheduler **0019** (BullMQ Job Schedulers, kill-switch, skip-and-resume missed fires), **0021** (per-entry shape, `sched:${entry.id}`), **0024/0025** (timeout propagation, kill-on-timeout). This ADR is read-only introspection over those layers and contradicts none of them; 0019's kill-switch and 0025's kill-on-timeout are noted below as behaviors the verdict inherits, not changes.

### POV note (reflex check answered explicitly)

This endpoint is deliberately **not POV-scoped**, and that is consistent with the architecture invariants rather than an exception to them. "Who is this true for?" — for the *instance as a deployment artifact*: there is one container per instance and one deploy event that kills it; whether a child process is executing at this instant is an objective operational fact, not a perspective-dependent assertion. No WoT columns, no POV suffixes, no per-POV variance exists or could exist here. Contrast with the pov-selectable-tag-surfaces ADRs (0001–0002), which govern *content* surfaces where perspectives genuinely differ. Adding a POV parameter here would be cargo-culting the pattern onto the wrong layer.

## Options considered

### Option A — New `src/api/deploy-safety/` module: in-process live-state aggregation over a pure verdict core (chosen)

A small new API module, `GET /api/deploy-safety/status`, registered unconditionally in `src/api/index.js` (outside the `TASK_QUEUE_ENABLED` gate at `:507`, so it serves the AC-5 queue-disabled response). It aggregates three in-process sources and feeds them to an exported pure function `computeVerdict()`:

1. **Queue actives:** if `TASK_QUEUE_ENABLED === 'true'`, lazy-require the queue module (the `scheduler()` lazy-require pattern, `src/api/scheduled-tasks/index.js:96-100`), check `isQueueAvailable()`, then `getAllQueues()` → per-queue `getActive()`. Introspection failure or unavailable queue → **fail-closed** (verdict unsafe, reason `QUEUE_STATE_UNAVAILABLE`).
2. **Legacy in-flight:** new export `getInFlightCount()` on `src/api/customer-schedule/index.js` — iterate `customerTimers`, count `taskRunning === true`.
3. **Next fires:** `scheduledTasks.readConfig()` → for each `enabled` entry, `getNextRun(entry.id, entry.taskId)` → min.

Pros: reuses every existing accessor; the verdict is unit-testable as a pure function (the `groupEventsIntoSessions` / `filterSchedulableTasks` export-for-testability precedent in this exact subsystem); never touches events.jsonl, so AC-3 holds structurally; the module boundary matches the concern (deploy safety spans queue + legacy + schedule — it is not a scheduled-tasks CRUD feature). Cons: one new module and one new export on customer-schedule; three data sources means three failure modes to define (defined below).

### Option B — Extend `src/api/scheduled-tasks/index.js` with a `handleDeploySafety` route

Add `GET /api/scheduled-tasks/deploy-safety` to the existing module, which already owns `readConfig`/`nextRunSafe`.

Pros: no new module; next-fire plumbing is already local. Cons: the module is 566 lines of per-entry CRUD scoped to the BullMQ scheduler; deploy safety additionally spans customer-schedule state and queue actives, so the aggregation would import *into* a module whose charter (ADR 0021) is deliberately narrow; the path misleads consumers into thinking the answer covers only scheduled entries when AC-2 explicitly covers manual triggers and legacy runs too. Rejected: wrong home for a cross-cutting operational surface; saves ~20 lines of registration at the cost of the boundary.

### Option C — Derive running-now from events.jsonl session state

Reuse `groupEventsIntoSessions` and report `status === 'running'` sessions as running-now — the "obvious" reuse, since every existing running surface (watchdog, history, dashboard) does exactly this.

Rejected outright: this is the **phantom-running trap** the story exists to avoid (AC-3). A deploy-killed task's orphaned TASK_START reads "running" for up to 24h, deadlocking the gate after the very event it guards. Named as an option because it is the path of least resistance an implementer would otherwise reach for; the test plan should include an anti-pattern guard (see Implementation notes).

### Option D — HTTP self-aggregation over the existing per-item APIs

Have the endpoint (or the cycle skill directly) call `GET /api/scheduled-tasks/list` and iterate `GET /api/customer-schedule/status?pubkey=` across all customers.

Rejected: `/list` has no running-now signal at all (its `timer` block is next/last-run only, `src/api/scheduled-tasks/index.js:298-306`); the legacy iteration is N+1 over HTTP and requires enumerating customers first; and it would push verdict logic into every consumer instead of one place. (`customer-schedule` already hardcodes `127.0.0.1:7778` for its own self-call at `:67` — a wart to avoid replicating, not a precedent.)

## Sub-decisions (delegated to this ADR by the story / book)

1. **Path:** `GET /api/deploy-safety/status`. Follows the `<module>/status` convention (`/api/streaming-etl/status`, `/api/service-management/status`). Alternative `/api/scheduled-tasks/deploy-safety` rejected with Option B. The path substring-matches nothing in `writeEndpoints`/`protectedGetEndpoints` (`src/middleware/auth.js:406-479`), so it is unauthenticated by the existing fall-through — no auth change needed.
2. **Buffer configuration:** module constant `DEFAULT_BUFFER_MS = 10 * 60 * 1000`, overridable per-request via `?bufferMinutes=<n>` (finite, `> 0`, `<= 1440`; anything else → HTTP 400, so a typo in a future cycle-skill invocation fails loudly instead of silently gating at the wrong width). The effective `bufferMs` is echoed in the response. Alternatives: a `brainstorm.conf` variable (rejected: heavier surface — template + docs + per-instance drift — for a number nobody has asked to tune per-instance); constant-only (rejected: story 2's wait-and-recheck and any operator experiment would need a redeploy to try a different window; a read-only query param costs ~5 lines).
3. **Legacy aggregation (book delegated decision #3):** in-process export `getInFlightCount()` from `src/api/customer-schedule/index.js`, not per-pubkey HTTP iteration. Same process, one function, no customer enumeration.
4. **Detail level (book delegated decision #6 — "include only if free"):** include per-source detail that is free and non-leaking: active task **names** and start times (`job.name`, `job.processedOn`) and the scheduler kill-switch state (`schedulerEnabled()`, already exported from `scheduler.js`). Deliberately **exclude** BullMQ `job.id` and `job.data`, and legacy customer pubkeys: `computeJobId` embeds the customer pubkey (`queue/index.js:64-69`) and this is an unauthenticated surface — the verdict needs counts, not identities.
5. **Failure semantics:** the handler returns HTTP 200 with a verdict whenever it can compute one; queue-introspection failure while the queue is enabled degrades to a **fail-closed** unsafe verdict with reason `QUEUE_STATE_UNAVAILABLE` (never a 500 that a shell consumer would have to special-case, never fail-open). `TASK_QUEUE_ENABLED=true` with `_state` never initialized (boot init failed) also lands here via `isQueueAvailable() === false`.

### Response shape (payload contract for AC-1)

```json
{
  "success": true,
  "safeToDeploy": false,
  "verdict": "unsafe",
  "reasons": ["QUEUE_TASK_RUNNING"],
  "checkedAt": "2026-07-18T12:00:00.000Z",
  "bufferMs": 600000,
  "queue": {
    "enabled": true,
    "stateKnown": true,
    "activeCount": 1,
    "activeTasks": [ { "taskName": "processCustomer", "startedAt": "2026-07-18T11:58:41.000Z" } ],
    "schedulerHalted": false
  },
  "legacy": { "inFlightCount": 0 },
  "schedule": {
    "enabledEntryCount": 2,
    "nextFire": {
      "entryId": "seed:refreshPinnedTagTLs",
      "taskId": "refreshPinnedTagTLs",
      "label": "Refresh pinned tag TLs",
      "at": "2026-07-18T12:07:00.000Z",
      "inMs": 420000,
      "withinBuffer": true
    }
  }
}
```

- `verdict` ∈ `{"safe","unsafe"}`; `safeToDeploy` is its boolean twin so shell consumers can `curl -sf … | jq -e '.safeToDeploy'` (exit code = verdict) — the calling convention story 2 will lean on.
- `reasons` (empty when safe) ∈ `QUEUE_TASK_RUNNING`, `LEGACY_TASK_RUNNING`, `NEXT_FIRE_WITHIN_BUFFER`, `QUEUE_STATE_UNAVAILABLE`. Machine-checkable and journal-ready for story 2's wait-and-recheck.
- AC-1(b)'s three facts map to `nextFire.label` (name), `nextFire.at` (fire time), `nextFire.inMs` (time remaining). `nextFire: null` when no enabled entry has a scheduled next run.
- AC-5's distinction: `queue.enabled: false` (with `activeCount`/`activeTasks`/`schedulerHalted` omitted or null, `nextFire: null`) vs `queue.enabled: true` + `schedule.nextFire: null`. Verdict with queue disabled: unsafe iff `legacy.inFlightCount > 0`.

## Decision

We chose **Option A** — a new `src/api/deploy-safety/` module aggregating the three live in-process sources (BullMQ actives via lazy-required queue module, legacy in-flight via a new `customerTimers` aggregate export, next-fires via `readConfig` + `getNextRun`), with the verdict computed by an exported pure function and the sub-decisions above. It is the only option that satisfies AC-2's two-source coverage and AC-3's phantom exclusion structurally (the module has no code path that reads events.jsonl), it reuses every accessor the task-queue-scheduler epic already built, and the pure core gives AC-3/AC-4 their explicit automated tests without standing up Redis.

## Consequences

- **Enables:** story 2 (cycle-skill safe-to-merge check — `jq -e '.safeToDeploy'` + `reasons` journaling) and story 3 (settings countdown — `schedule.nextFire` is exactly the aggregate line's data) with no further backend work. Replaces the manual disable-everything-before-promoting habit.
- **Constrains:** the payload shape above becomes a consumed contract on deployed instances once story 2's skills and the shared recipe reference it; field renames after that are breaking changes to the ops tooling.
- **Inherited behaviors (documented, not changed):** ADR 0019's `scheduler:false` kill-switch surfaces as `schedulerHalted: true` with no next fires — accurately "nothing will fire," distinguishable from none-configured only by that flag. ADR 0024/0025 kill-on-timeout bounds how long an active job can hold the verdict unsafe.
- **Known conservative windows (accepted, in the safe direction):** (a) the legacy `taskRunning` flag clears by a 30s PID poll (`customer-schedule/index.js:76-84`), so unsafe can persist ≤30s after a legacy run actually exits; (b) immediately after a deploy, a killed active job can read as BullMQ-active until stall recovery re-queues it once workers reboot — a bounded transient (~stall interval), unlike the 24h events.jsonl phantom, and story 2's wait-and-recheck absorbs it; (c) a legacy fire routed through the queue (when `TASK_QUEUE_ENABLED=true`, `triggerCustomerTask` POSTs `/api/run-task`, which enqueues) counts in **both** sources — the verdict is an OR, so double-reporting is harmless, but `reasons` may carry both entries for one underlying run.
- **New debt / follow-ups:**
  - The new `getInFlightCount()` export couples deploy-safety to the legacy scheduler's in-memory Map; if `customer-schedule` is ever retired, deploy-safety must drop the source (leave a grep-able comment at both ends).
  - Task **names** of running jobs and schedule metadata become readable unauthenticated (counts and names only; pubkeys and job ids deliberately excluded). Accepted as operational metadata on par with the already-unauthenticated `/api/scheduled-tasks/list`; revisit if the scheduled-tasks surface is ever auth-gated (explicitly out of scope in the story).
  - The `?bufferMinutes=` override means the verdict is caller-tunable; the shared recipe (story 2) should pin the default or state its chosen value so instances aren't checked with divergent windows.
- **Firmware reinstall required?** **No** — no concept definitions are added or changed (verified against the live Concept Graph, 46 concepts, none in this domain).
- **New dependencies:** none. **New lint/build tooling:** none.

## Implementation notes

- **File: `src/api/deploy-safety/index.js` (new).**
  - `computeVerdict({ now, bufferMs, queueEnabled, queueStateKnown, activeCount, legacyInFlightCount, nextFires })` — **pure**, exported. `nextFires` is `[{ entryId, taskId, label, at }]` (enabled entries with a non-null next run). Returns `{ safeToDeploy, verdict, reasons, nextFire }` where `nextFire` is the min-`at` entry decorated with `inMs: at - now` and `withinBuffer`. Rules: any running source or unknown queue state → unsafe (`QUEUE_TASK_RUNNING` / `LEGACY_TASK_RUNNING` / `QUEUE_STATE_UNAVAILABLE`); else `nextFire.inMs <= bufferMs` → unsafe (`NEXT_FIRE_WITHIN_BUFFER`); else safe.
  - `handleStatus(req, res)` — parse/validate `bufferMinutes` (invalid → 400 `{ success:false, error }`); gather the three sources; respond per the payload contract. Gathering:
    - `brainstormConfig.get('TASK_QUEUE_ENABLED') === 'true'` decides `queue.enabled`. When true: lazy `require('../../manage/taskQueue/queue')` (mirror `scheduled-tasks/index.js:96-100` — never require when disabled); `await isQueueAvailable()`; if false → `queueStateKnown: false`. Else `getAllQueues()` → `Promise.all(queues.map(q => q.getActive()))`; map jobs to `{ taskName: job.name, startedAt: new Date(job.processedOn || job.timestamp).toISOString() }`. Wrap in try/catch → `queueStateKnown: false` on throw. Also read `require('../../manage/taskQueue/queue/scheduler').schedulerEnabled()` for `schedulerHalted`.
    - Legacy: `require('../customer-schedule').getInFlightCount()`.
    - Next fires: `const scheduledTasks = require('../scheduled-tasks'); scheduledTasks.readConfig().entries.filter(e => e.enabled)`, then per entry `getNextRun(entry.id, entry.taskId)` via the scheduler module (only when queue enabled and available; otherwise `nextFires: []`). Reuse the `nextRunSafe` try/null pattern (`scheduled-tasks/index.js:219-222`).
  - **Must not** reference `events.jsonl` / `EVENTS_PATH` / `getRecentRuns` / `groupEventsIntoSessions` anywhere in this module (AC-3).
- **File: `src/api/customer-schedule/index.js`** — add and export `getInFlightCount()`: iterate `customerTimers.values()`, count `state.taskRunning === true`. No other changes; keep the Map private otherwise. Comment-tag the export as a deploy-safety consumer.
- **File: `src/api/index.js`** — register `app.get('/api/deploy-safety/status', deploySafety.handleStatus);` adjacent to the Scheduled Tasks block (`:473-482`), **outside** the `TASK_QUEUE_ENABLED` gate at `:507`.
- **Read-only guarantee (AC-1):** the handler calls only `getActive`/`getJobSchedulers`/`ping` (Redis reads), file reads (`readConfig` — note it seeds fresh-install entries in memory only, never calls `writeConfig` on the read path, `scheduled-tasks/index.js:104-127`), and Map iteration. Nothing enqueues, upserts, or removes.
- **Testing seams (for the Tester — suggestions, not prescriptions):** `computeVerdict` unit tests cover AC-3 (running-now false despite a fabricated TASK_START-orphan history — which the module can't even see) and the AC-4 boundary (inMs just inside/outside bufferMs); an anti-pattern source guard asserting `src/api/deploy-safety/index.js` never mentions `events.jsonl`/`EVENTS_PATH` follows the T17/T18 precedent in `test/generalized-task-scheduler.test.js`; `getInFlightCount` is testable by driving `customerTimers` through the existing handlers or a direct export probe. Existing runner: `test/*.test.js` via `npm test`.

## Out of scope

- The cycle-skill integration, wait-and-recheck bounds, and the shared recipe doc (story 2); the settings-panel countdown line (story 3).
- Drain-on-deploy / SIGTERM wiring, resumable checkpointing, stalled-recovery `job.data` staleness, auth-gating scheduled-tasks writes, CI-side enforcement (story §Out of scope).
- Narrowing the buffer check to blocking-task classes (ratified as not-v1).
- Any change to how tasks run, are scheduled, or are timed out (ADRs 0019/0021/0024/0025 stand untouched).
