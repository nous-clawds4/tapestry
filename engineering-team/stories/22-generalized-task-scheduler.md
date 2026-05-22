# Story 22: Generalized Task Scheduler (durable, any-task, sub-hour) — task-queue phase 2

**Status:** Approved
**Created:** 2026-05-22
**Type:** Feature

## Background

Tapestry's recurring-task scheduling today is an **in-process `setInterval` scheduler** (`src/api/scheduled-tasks/index.js`, per ADR 0003). It works, but it has four structural limits that now block real work:

- **1-hour minimum interval** — it rejects anything more frequent than hourly. Story #21's `reconcileRecent` wants to run every ~10 minutes; it can't.
- **Hardcoded task set** — it only knows a fixed list (`updateAllScoresForOwner`, `refreshSearchIndex`). Scheduling any other registered task requires a code edit. The three new reconcile tasks (`reconcileRecent`, `reconcileAll`, `reconcileAuthor`) can't be scheduled at all.
- **Process-fragile** — the timers live in `setInterval` inside the control-panel Node process. If that process dies between fires, the fire is silently skipped (called out as a reliability hole in story #13's background).
- **The only sub-hour workaround is a host `systemd` timer** (e.g. `reconcile.timer`), which runs the script *directly* — bypassing the BullMQ queue (story #13 / ADR 0012) and the `neo4j-heavy` semaphore (story #15 / ADR 0013). That defeats the contention protection those stories added.

**Why now:** Story #21 made reconciliation incremental and shipped three manually-triggerable tasks, but deliberately wired **no cadence** because the current scheduler can't serve them (sub-hour, arbitrary task, queue-routed). The operator has decided **not to promote story #21's reconciliation to production until it is actually usable** — i.e., the sweep tasks run automatically on a schedule. **This story is the gating dependency for that prod promotion.**

This is **task-queue phase 2** — the migration story #13's background foreshadowed: *"migrate `scheduled-tasks.json` to BullMQ repeatable jobs; replace the in-process `setInterval`."* It builds on the BullMQ queue (ADR 0012), the `neo4j-heavy` semaphore (ADR 0013), and the existing Scheduled Tasks subsystem (ADR 0003).

**Operator decisions captured at Planning (2026-05-22):**
- **Full replacement.** Stand up the durable scheduler, migrate the existing schedule(s) onto it, and retire the in-process `setInterval` scheduler. One scheduler at the end — no lingering dual system.
- **Interval + cron.** Schedules can be expressed as a simple interval *and* as a cron expression (so a heavy run like `reconcileAll` can be pinned to a low-traffic window).
- **Managed from the existing Scheduled Tasks UI panel**, extended to cover any registered task and the new interval/cron + sub-hour capabilities.

## User-facing description

**As the operator,** I want to schedule **any** registered task on a **durable** scheduler that supports **sub-hour intervals and cron**, **survives control-panel restarts**, and **routes fires through the task queue** — all managed from the Scheduled Tasks panel — **so that** reconciliation (and every other task) runs automatically, with one generalized scheduler instead of per-task code or a process-fragile `setInterval` timer.

## Acceptance criteria

- [ ] **Any** task defined in the task registry can be scheduled — not a hardcoded subset. Given a registered task name, the operator can create/enable a recurring schedule for it.
- [ ] A schedule can be expressed as an **interval** (every N minutes/hours/days) **or** a **cron expression**. Both forms are accepted and honored.
- [ ] **Sub-hour intervals are allowed.** A schedule of, e.g., every 10 minutes is accepted and fires roughly every 10 minutes (the prior 1-hour floor is gone).
- [ ] **Durability:** an enabled schedule survives a control-panel process restart — after a restart, the schedule is still active and its next fire still occurs without the operator re-enabling it. A fire missed during downtime is handled per a defined, documented policy (not silently lost without trace).
- [ ] **Scheduled fires route through the existing task queue** — a scheduled invocation is enqueued the same way a manual `/api/run-task` call is, so per-task concurrency, `(taskName[,pubkey])` dedup, the `neo4j-heavy` semaphore, and BullBoard visibility all apply. (No direct script spawn that bypasses the queue.)
- [ ] **No regression for existing schedules:** the currently-active schedule(s) — the Meilisearch-profiles/House-PoV-scores refresh (`refreshSearchIndex`) and `updateAllScoresForOwner` — continue to run on their existing cadence across the migration, with no gap and no operator reconfiguration.
- [ ] **The in-process `setInterval` scheduler is retired** once the migration is complete — recurring scheduling is served by the new durable scheduler only.
- [ ] The operator can **enable/disable** a task's schedule and **change its interval/cron** from the **Scheduled Tasks UI panel**, for any registered task. The panel reflects current schedule state (enabled?, next run, last run) for each.
- [ ] `reconcileRecent` and `reconcileAll` can be scheduled through this surface (`reconcileRecent` at a sub-hour/hourly cadence, `reconcileAll` weekly). Because both flow through the queue, they serialize via the `neo4j-heavy` semaphore against each other and against the GrapeRank/PageRank tasks.
- [ ] **No surprise bootstrap:** enabling a frequent `reconcileRecent` schedule on a graph that has no reconciliation watermark must not silently kick off a multi-hour full-pass bootstrap with no operator awareness. The behavior here (e.g., require/recommend seeding via a deliberate `reconcileAll` first, or surface a clear warning) is documented in an operator runbook.
- [ ] Operator documentation (`OPERATIONS.md`) covers: the new scheduler, how to schedule any task (interval + cron), durability/restart behavior, the retirement of the in-process scheduler, and the reconciliation seeding/runbook note.

## Concepts touched

To be resolved by the Architect via `/api/concept-graph/summaries` (operational/infra concepts; likely none in the domain graph):

- Scheduled Tasks subsystem (`src/api/scheduled-tasks/`, ADR 0003) — the thing being replaced
- BullMQ task queue (story #13 / ADR 0012) — repeatable/cron jobs are the foundation
- `neo4j-heavy` resource-class semaphore (story #15 / ADR 0013)
- Task Registry (`taskRegistry.json`)
- Scheduled Tasks UI panel (the operator surface to extend)
- The reconcile tasks (`reconcileRecent` / `reconcileAll`, story #21 / ADR 0018) — the motivating consumers

## Out of scope

- **`reconcileAuthor` trigger surfaces** (profile button / API endpoint passing `--pubkey` / per-customer scheduling) — separate follow-up story.
- **Deprecating the legacy `reconciliation` registry key and `reconcile.timer`** — separate follow-up (this story removes the *in-process* scheduler, not the host systemd timers).
- **Migrating or retiring the host `systemd` `.timer` units** (e.g. `processAllTasks.timer`) — that's task-queue phase 3 (story #13 foreshadowed deciding each timer's fate task-by-task). This story replaces the in-process scheduler only.
- **Event- or dependency-driven triggers** ("run X after Y completes"). `processAllTasks` already handles task chaining; this story is interval/cron recurrence only.
- **Per-customer fan-out scheduling** (scheduling a task across many customers). Single schedule per task here.
- **Actually enabling the production reconciliation schedules.** This story delivers the *capability* + runbook; turning on `reconcileRecent`/`reconcileAll` in prod (with deliberate watermark seeding) is an operator action, gated by the prod-promotion decision.

## Open questions

To resolve at the architecture gate (Architect proposes; operator ratifies):

1. **Rollback safety for the cutover.** The end state is full replacement, but migrating the *active* `refreshSearchIndex` schedule without a gap is delicate. Does the Architect want a feature flag (à la `TASK_QUEUE_ENABLED` from #13) to fall back to the in-process scheduler during cutover, even though it's removed at the end?
2. **Where schedule definitions live.** BullMQ repeatable jobs live in Redis; the operator's enable/disable/interval settings currently live in `/var/lib/brainstorm/scheduled-tasks.json`. Migrate that file, store config in Redis, or keep a config file as the source of truth with Redis as the execution layer? Architect's call.
3. **Missed-fire policy.** When the process was down across a scheduled fire, should the scheduler run the missed job once on recovery, skip it, or surface it? Define the policy.
4. **No-surprise-bootstrap mechanism.** Runbook-only (document "seed via `reconcileAll` first"), or a built-in guard (detect missing watermark + refuse/warn before a scheduled `reconcileRecent` bootstraps)? Architect proposes.
5. **Scope size / phasing.** This story is large (durable scheduler engine + queue integration + cron + migration + UI). The Architect may recommend phasing the UI as a fast-follow behind the engine/API; PO to ratify if so.

## Testability notes

How we'll know it works (informational; the Tester writes the plan in Phase 3):

- **Any-task + sub-hour:** schedule an arbitrary registered task at, e.g., every 2 minutes; observe it fire ~every 2 minutes via the queue (BullBoard / events). The prior 1-hour rejection no longer occurs.
- **Cron:** schedule a task with a cron expression; confirm it fires at the cron-specified time, not on a fixed interval.
- **Durability:** enable a schedule, restart the control-panel process, confirm the schedule persists and the next fire still happens (no re-enable needed).
- **Queue routing:** confirm a scheduled fire appears as a queued job (subject to the semaphore / dedup), not a direct spawn.
- **No regression:** confirm the migrated `refreshSearchIndex` schedule still fires on cadence after cutover.
- **Reconcile integration:** schedule `reconcileRecent` sub-hour + `reconcileAll` weekly; confirm they enqueue and serialize via `neo4j-heavy`.
- **No-surprise-bootstrap:** with no watermark, confirm enabling a frequent `reconcileRecent` schedule follows the defined guard/runbook behavior rather than silently launching a multi-hour bootstrap.

## Linked artifacts

- ADR: [0019-generalized-task-scheduler.md](../decisions/0019-generalized-task-scheduler.md)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
