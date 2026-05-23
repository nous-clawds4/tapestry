# ADR 0019: Generalized task scheduler via BullMQ Job Schedulers

**Status:** Accepted
**Date:** 2026-05-22
**Story:** `engineering-team/stories/22-generalized-task-scheduler.md`
**Builds on:** ADR 0012 (BullMQ queue), ADR 0013 (neo4j-heavy semaphore), ADR 0015 (queue on by default), ADR 0018 (reconciliation modes — the motivating consumer).
**Supersedes:** the *scheduling execution mechanism* of ADR 0003 (the in-process `setInterval` scheduler). ADR 0003's generalized per-task config shape is preserved and extended; its `setInterval` execution is replaced.

## Context

Recurring scheduling today is `src/api/scheduled-tasks/index.js` (ADR 0003): an in-process `setInterval` loop. Its `makeTriggerTask` ([:82](src/api/scheduled-tasks/index.js:82)) fires `fetch('http://127.0.0.1:7778/api/run-task?taskName=…', {method:'POST'})` on a `setInterval` ([startScheduler:127](src/api/scheduled-tasks/index.js:127)), restored at boot from `/var/lib/brainstorm/scheduled-tasks.json` ([initScheduler:155](src/api/scheduled-tasks/index.js:155), wired at [bin/control-panel.js:282](bin/control-panel.js:282)). Story #22's four blockers map to four facts in that file:

- **1-hour floor** — [:130](src/api/scheduled-tasks/index.js:130) and [:258](src/api/scheduled-tasks/index.js:258) reject sub-hour intervals.
- **Hardcoded task set** — `DEFAULTS` ([:19](src/api/scheduled-tasks/index.js:19)) = `updateAllScoresForOwner`, `refreshSearchIndex`; `isKnownTaskId` rejects everything else.
- **Process-fragile** — `setInterval` lives in the control-panel process; a fire during downtime is silently lost (no persisted scheduler).
- **The sub-hour workaround is a host `systemd` timer** that runs the script directly, bypassing the queue + `neo4j-heavy` semaphore.

The good news is the heavy lifting already exists. Story #13 / ADR 0012 gave us, per registry task, **one BullMQ `Queue` + `Worker`** on a shared ioredis connection, with the `neo4j-heavy` semaphore wrap (ADR 0013) and BullBoard. The scheduler's *entire* job is to enqueue a task on a cadence — and **BullMQ 5.76.10 ships `Queue.upsertJobScheduler`** (verified in-container), a durable Job Scheduler that does exactly that: it adds a job to a queue on a cron pattern or fixed interval, with the scheduler definition persisted in Redis (which already runs AOF persistence per ADR 0012). So a scheduled fire becomes an ordinary job on the task's existing queue — automatically subject to the existing per-task concurrency, `neo4j-heavy` serialization, and BullBoard visibility.

The motivating consumers are story #21's reconcile tasks: `reconcileRecent` (sub-hour/hourly), `reconcileAll` (weekly), both `neo4j-heavy`. Their `--mode` is carried by the registry `staticArgs` field (ADR 0018 / processor.buildChildArgs), so a scheduled job needs only `{taskName}` in its data — the processor pulls `staticArgs` from the registry.

**Concept-graph impact:** none — operational/infra (scheduler/queue), no domain concepts. Concept Graph API was unreachable at design time; not consulted (consistent with ADR 0018). **Firmware reinstall: no.**

## Options considered

### Option A — BullMQ Job Schedulers on the existing per-task queues (chosen)

A small scheduler layer upserts one BullMQ Job Scheduler per *enabled* scheduled task onto that task's existing `Queue`:

```js
queue.upsertJobScheduler(
  schedulerId,                              // e.g. `sched:${taskName}`
  cron ? { pattern: cron } : { every: ms }, // cron OR fixed interval (sub-hour OK)
  { name: taskName, data: { taskName } }    // the job each tick adds; staticArgs come from the registry
);
```

The operator's intent lives in an **extended `scheduled-tasks.json`** (source of truth); BullMQ Job Schedulers in Redis are the **execution layer**. On boot (and on every operator update) the scheduler **reconciles** the two: upsert a Job Scheduler for each enabled entry, `removeJobScheduler` for disabled/removed ones. Scheduled fires flow into the same Worker manual runs use → `processor.processJob` → `launchChildTask` → the semaphore + concurrency + BullBoard, for free. The in-process `setInterval` scheduler is removed.

**Pros**
- Minimal new infrastructure — reuses the per-task `Queue`+`Worker` topology from ADR 0012; no new worker, no new process.
- Durable by construction — Job Schedulers persist in Redis (AOF); survive a control-panel restart, unlike `setInterval`.
- Native cron + fixed-interval + sub-hour — no custom timing code, no cron library.
- Queue-routed automatically — the `neo4j-heavy` semaphore, per-task concurrency, jobId behavior, and BullBoard apply because it's the same queue/worker as a manual `/api/run-task`.
- Config file stays human-readable/inspectable/backup-able; reconcile-on-boot makes it authoritative over Redis (recovers cleanly even if Redis is flushed).

**Cons**
- Missed fires during downtime are **not backfilled** (BullMQ schedules the next future slot) — a deliberate, documented policy change (see Decision §3); it's actually well-suited to `reconcileRecent`'s watermark.
- A new config↔Redis reconcile invariant to implement and keep correct.
- If a scheduled run *chronically* exceeds its interval, ticks can queue behind it (bounded — see Consequences).

### Option B — Patch the in-process scheduler (remove the floor, generalize the task set, persist next-run for crude durability)

Keep `setInterval`; drop the 1-hour floor and `DEFAULTS` restriction; add a cron library; persist `nextRunAt` to disk and replay on boot for a semblance of durability.

**Pros:** smaller diff; no new scheduling concept.
**Cons:** still in-process and fundamentally fragile — real durability means reimplementing persistent scheduling, cron parsing, and missed-fire handling that BullMQ Job Schedulers already provide and battle-test. Reinvents the wheel next to a wheel we already run. Rejected.

### Option C — A separate dedicated scheduler process (supervisord cron-like service enqueuing to BullMQ)

**Pros:** isolates scheduling from the control-panel process.
**Cons:** another supervisord entry — the exact operational cost ADR 0012 weighed when it chose an in-process worker over a separate process. BullMQ Job Schedulers give durability *without* a separate process. Over-engineered. Rejected.

## Decision

**We chose Option A.** Replace the in-process `setInterval` scheduler with BullMQ Job Schedulers attached to the existing per-task queues; `scheduled-tasks.json` (extended) is the source of truth, reconciled to Redis on boot and on every update; the Scheduled Tasks panel + its API are generalized to any registry task with interval **or** cron, sub-hour allowed.

Resolutions to the story's five open questions:

1. **Rollback / cutover safety.** The scheduler requires the queue, so it is gated on `TASK_QUEUE_ENABLED` (already on by default, ADR 0015) — no duplicate feature flag re-creating the in-process path (operator chose full replacement). Practical control is per-task `enabled` (disabling a task removes its Job Scheduler). As cheap coarse insurance, add a single `"scheduler": true` kill-switch to `/etc/brainstorm-task-queue.json`: when `false`, the boot reconcile upserts nothing (and removes existing schedulers), halting all scheduling without code changes. Default `true`.
2. **Where definitions live.** `scheduled-tasks.json` is the **source of truth** (operator intent: which tasks, enabled?, interval/cron); BullMQ Job Schedulers in Redis are the **execution layer**. Reconcile file→Redis on boot and on each update. The file is authoritative — on conflict, it wins (orphan Redis schedulers are removed).
3. **Missed-fire policy.** **Skip-and-resume, no backfill.** BullMQ Job Schedulers, on restart, schedule the next future occurrence; a fire missed during downtime is not replayed. The schedule itself is never lost (persisted), which is the real fix vs `setInterval`. Documented in OPERATIONS.md. (For `reconcileRecent`, a skipped run is harmless — the next run's watermark window simply spans the gap.)
4. **No-surprise-bootstrap.** The generic scheduler stays **reconciliation-agnostic** — it knows nothing about watermarks (layering). Protection is: (a) **runbook** — seed the watermark with a deliberate `reconcileAll` before enabling a frequent `reconcileRecent` schedule; (b) the existing observability — `reconcileRecent`'s bootstrap already logs `"bootstrap": true` and the run is visible in BullBoard. An optional reconciliation-side guard (refuse to bootstrap on a *scheduled* trigger) belongs to the reconciliation module, not this generic scheduler — noted as a follow-up, out of scope here.
5. **UI phasing.** Kept in this story per the operator's choice. The Implementer may land the engine/API first and the panel second within the story; the Reviewer validates the full surface.

## Consequences

**Enabled**
- Durable, any-task, interval **or** cron, sub-hour scheduling that survives control-panel restarts and routes every fire through the queue (semaphore-aware, BullBoard-visible). One scheduler, no per-task code.
- **Unblocks story #21's prod usability** — `reconcileRecent` (sub-hour/hourly) and `reconcileAll` (weekly) become schedulable and serialize via `neo4j-heavy`.

**Constrained / made harder**
- Missed fires aren't backfilled (documented policy).
- New config↔Redis reconcile invariant; the boot reconcile must remove orphaned Job Schedulers so the file stays authoritative.
- **Overlap/pile-up:** if a scheduled run chronically exceeds its interval, ticks can queue. Bounded by (a) per-task concurrency = 1 (the next job waits, doesn't run concurrently), (b) BullMQ Job Schedulers keep at most one upcoming delayed job per scheduler, and (c) the seed-first runbook (no hours-long *scheduled* bootstrap). Worth noting for `reconcileRecent` if its interval were ever set below its typical runtime.

**Follow-up debt (out of scope here)**
- A reconciliation-side bootstrap guard (Q4) if the runbook proves insufficient.
- Host `systemd` `.timer` migration (task-queue phase 3).

**Firmware reinstall required?** No.

## Implementation notes

The Implementer reads this section verbatim.

### Scheduler layer
- Add a reconcile function — a `Map<taskId, scheduleConfig>` → BullMQ Job Schedulers reconciler. It may live in `src/api/scheduled-tasks/index.js` (rewritten internals) or a small `src/manage/taskQueue/queue/scheduler.js` that the scheduled-tasks module calls. It uses the queue module's `getQueue(taskName)` (already exported, [queue/index.js:166](src/manage/taskQueue/queue/index.js:166)) to `upsertJobScheduler` / `removeJobScheduler`.
- Reconcile on: (a) boot (replacing `initScheduler`), and (b) each `handleUpdate`. For each enabled entry → `upsertJobScheduler(`sched:${taskId}`, {pattern|every}, {name: taskId, data: {taskName: taskId}})`; for disabled/absent → `removeJobScheduler`. Then list existing schedulers (`queue.getJobSchedulers()`) and remove any not in the config (orphan cleanup).
- Honor the `scheduler` kill-switch from `/etc/brainstorm-task-queue.json` (Q1).

### Retire the in-process scheduler
- Remove `makeTriggerTask`, `startScheduler`, `stopScheduler`, the `setInterval`, and the `totalIntervalMs`-only timing ([:78-165](src/api/scheduled-tasks/index.js:78)). Remove the in-memory `timerState`/`getTimerState` `setInterval` machinery (next/last-run now come from BullMQ + events.jsonl).
- `bin/control-panel.js:282` calls the new boot reconcile instead of `initScheduler` — gated by `TASK_QUEUE_ENABLED` (the scheduler needs the queue initialized; sequence the call after `initTaskQueue`).

### Config schema (extend, backward-compatible)
- `scheduled-tasks.json` entries gain optional `intervalMinutes` (sub-hour) and `cron` (string); keep `enabled`, `intervalHours`, `intervalDays` working so the live `refreshSearchIndex` schedule migrates with no edit. Precedence: `cron` > (`intervalDays`/`Hours`/`Minutes` summed to `every` ms). Drop the 1-hour floor ([:130](src/api/scheduled-tasks/index.js:130), [:258](src/api/scheduled-tasks/index.js:258)) and the `isKnownTaskId`/`DEFAULTS` restriction — validate against the **task registry** instead (any registered task is schedulable; unknown task → 400).
- Migration: on first boot, existing entries (`updateAllScoresForOwner`, `refreshSearchIndex`) reconcile straight into Job Schedulers from their current `intervalHours/Days`. No gap: the new reconcile runs at boot before the old `setInterval` would have fired (the old code is removed in the same change).

### API handlers (`src/api/scheduled-tasks/index.js`, routes at [index.js:439-442](src/api/index.js:439))
- `handleStatus` / `handleUpdate` / `handleHistory`: accept any registry task (validate against the registry, not `DEFAULTS`); accept `cron` + `intervalMinutes`; report `enabled`, schedule spec, and next/last run derived from `queue.getJobSchedulers()` + the existing `getRecentRuns` events.jsonl reader ([:169](src/api/scheduled-tasks/index.js:169), reused). Add a `GET /api/scheduled-tasks/list` (or similar) returning all schedulable registry tasks + their current schedule, to drive the UI.

### UI (Scheduled Tasks panel)
- Extend the panel (the scheduled-tasks control currently in `ui/src/pages/settings/RelaySettings.jsx` — Implementer confirms the exact component) to: list **any** registry task (from the new list endpoint), accept minutes/cron in addition to hours/days, drop the 1-hour client-side guard, and show next/last run + enabled state per task.

### Config / ops
- `/etc/brainstorm-task-queue.json`: add `"scheduler": true` (kill-switch).
- `OPERATIONS.md`: document the new scheduler (any task, interval/cron, sub-hour), durability + skip-no-backfill policy, the kill-switch, the retirement of the in-process scheduler, and the reconciliation seed-first runbook.

### Tests (for the Tester)
- **Source sentinels:** scheduler layer calls `upsertJobScheduler` / `removeJobScheduler`; `setInterval` and the 1-hour-floor literals are gone from `scheduled-tasks/index.js`; validation is against the registry not `DEFAULTS`; the config schema accepts `cron` + `intervalMinutes`; `bin/control-panel.js` calls the new reconcile gated by `TASK_QUEUE_ENABLED`; the kill-switch is read.
- **Regression guards:** the queue module's per-task `Queue`+`Worker` topology and `getQueue` export are intact; the `refreshSearchIndex` entry remains valid under the new schema.
- **Behavioral (cycle-local / staging smoke — authoritative):** a task scheduled every ~2 min fires via the queue; a cron schedule fires on pattern; a schedule survives a control-panel restart (still fires after); the migrated `refreshSearchIndex` keeps firing; `reconcileRecent`/`reconcileAll` schedule and serialize via `neo4j-heavy`; the kill-switch halts scheduling.

## Out of scope
- `reconcileAuthor` trigger surfaces; legacy `reconciliation` key + `reconcile.timer` cleanup; host `systemd` `.timer` migration (phase 3); event/dependency-driven triggers; per-customer fan-out scheduling; the reconciliation-side bootstrap guard; and actually enabling the production reconcile schedules (operator action, gated by the prod-promotion decision).
