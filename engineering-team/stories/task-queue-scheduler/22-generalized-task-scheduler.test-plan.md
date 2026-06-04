# Test Plan: Story 22 — Generalized Task Scheduler (BullMQ Job Schedulers)

**Story:** `engineering-team/stories/22-generalized-task-scheduler.md`
**ADR:** `engineering-team/decisions/0019-generalized-task-scheduler.md`
**Date:** 2026-05-22

## Approach

Same precedent as #5/#6/#8/#10–#13/#15/#21. The implementation rewrites a Node module (`src/api/scheduled-tasks/index.js`) plus a thin reconcile layer over the existing BullMQ queue, plus a UI panel — so the `npm test` layer uses **source/structural sentinels** that pin the ADR-required code shape, and the **behavioral heart runs as cycle-local / staging smoke**.

The behavioral guarantees this story makes — a sub-hour schedule actually *fires*, a cron schedule fires *on pattern*, a schedule **survives a control-panel restart** (the durability claim), the migrated `refreshSearchIndex` keeps firing, the kill-switch halts scheduling — are all only reproducible against a live Redis + BullMQ + control-panel process. They are the **authoritative cycle-local/staging smoke** (Reviewer-required). `npm test` proves the mechanism is wired (BullMQ Job Schedulers, not `setInterval`; floor + DEFAULTS gone; cron/sub-hour in the schema), which is the precondition for the behavior.

- **T1..T8** — FAIL pre-implementation, PASS post. The ADR-required new code shape.
- **R1..R4** — PASS pre AND post. Regression guards on the BullMQ queue topology the scheduler attaches to, the `bullmq` dependency, the operator API surface, and the boot wiring.
- **S1..S9** — cycle-local/staging smoke. The durability, cron, sub-hour, queue-routing, migration, kill-switch, and UI behavior.

The reconcile logic may live inline in `scheduled-tasks/index.js` or in a sibling `src/manage/taskQueue/queue/scheduler.js` (ADR leaves layout open) — the source sentinels read a **combined source** of both so they don't over-constrain file layout.

## Coverage map

| AC | Test / mechanism | Level |
|---|---|---|
| Any registered task schedulable (not hardcoded DEFAULTS) | **T5** (validates against the registry / `getAllQueues`). **S1** = schedule a non-DEFAULTS task | source + smoke |
| Interval **or** cron | **T6** (cron) + **T7** (`intervalMinutes`/interval). **S2** = cron fires on pattern | source + smoke |
| Sub-hour allowed | **T4** (1-hour floor removed) + **T7** (`intervalMinutes`). **S1** = ~2-min fire | source + smoke |
| Durable across control-panel restart | **T1** (Job Schedulers = the durable mechanism) + **R4** (boot reconcile wired). **S3** = restart, schedule persists + fires (authoritative) | source + smoke |
| Fires route through the queue (semaphore/concurrency/BullBoard) | **T1** (upsert on the existing per-task queue) + **R1** (queue topology + getQueue). **S1/S5** | source + smoke |
| No regression for existing schedules | **R3** (routes) . **S4** = migrated `refreshSearchIndex` keeps firing | source + smoke |
| In-process `setInterval` scheduler retired | **T3** (no `setInterval(` in scheduled-tasks) | source |
| Operator enable/disable + change interval/cron via the Scheduled Tasks panel | **T2** (removeJobScheduler/reconcile) + **R3** (API surface). **S7** = disable stops fires; **S9** = UI panel | source + smoke |
| `reconcileRecent`/`reconcileAll` schedulable + serialize via `neo4j-heavy` | **T5/T6/T7** (capability). **S5** = schedule both, observe serialization | source + smoke |
| No-surprise-bootstrap | **T8** (runbook documented). Scheduler stays reconciliation-agnostic; **S5** notes seed-first | source + smoke |
| OPERATIONS.md documents the scheduler | **T8** | source |

**Totals:** T1..T8 = **8 failing sentinels** (flip to PASS post-impl). R1..R4 = **4 regression guards** (PASS pre AND post). Confirmed `{pass: 4, fail: 8}` pre-implementation.

## Edge cases

- [x] **Layout-tolerant reads:** `schedulerSource()` concatenates `scheduled-tasks/index.js` + an optional `queue/scheduler.js`, so T1/T2/T5/T6/T7 pass whether the reconcile lives inline or in a sibling module.
- [x] **T4 dual assertion:** both the operator-facing "Minimum interval is 1 hour" 400 message AND the `< 3600000` `startScheduler` guard must be gone — covers both floor sites.
- [x] **T5 tolerance:** accepts `taskRegistry` OR `getAllQueues` (the schedulable set can come from the registry file or the queue module's loaded registry).
- [x] **T8 token choice:** asserts `intervalMinutes` + /job scheduler/i — both absent today. Deliberately avoids `cron` (already in OPERATIONS for systemd timers), `backfill`, and `BullMQ repeatable` (both already appear in the §10 task-queue phase-2 note), so the sentinel can't pass on pre-existing text.
- [x] **Defensive reads:** `readSafe`/`readJsonSafe` return null on missing/malformed files with a "re-baseline" message rather than a parse crash.
- [ ] **Real Job Scheduler firing, cron timing, restart-durability, queue-routing, migration continuity, kill-switch, missed-fire policy, UI** — not catchable in source; **cycle-local/staging smoke is authoritative**.

## Not covered (deferred to cycle-local / staging smoke — authoritative, Reviewer-required)

Run against a live stack (`http://localhost:8080` locally, then `staging.brainstorm.world`) with Redis + the queue on:

**S1 — any-task + sub-hour + queue-routed:** schedule a benign non-DEFAULTS task at `intervalMinutes: 2`; observe it produce a queued job ~every 2 min (BullBoard `/admin/queues` or `getJobSchedulers`), not a direct spawn.

**S2 — cron:** schedule a task with a cron pattern; confirm it fires at the pattern time, not on a fixed interval.

**S3 — durability (the headline):** enable a schedule; `supervisorctl restart brainstorm`; confirm the Job Scheduler persists (`queue.getJobSchedulers()`) and the next fire still occurs with no re-enable. This is the claim `setInterval` couldn't make.

**S4 — no regression:** confirm the migrated `refreshSearchIndex` schedule still fires on its cadence after cutover (no gap, no operator reconfig).

**S5 — reconcile integration:** schedule `reconcileRecent` (sub-hour) + `reconcileAll` (weekly); confirm both enqueue and serialize via the `neo4j-heavy` semaphore (events.jsonl `resource_class_wait_*`). Seed the watermark via a deliberate `reconcileAll` first (the no-surprise-bootstrap runbook).

**S6 — kill-switch:** set `"scheduler": false` in `/etc/brainstorm-task-queue.json`; restart; confirm no Job Schedulers are upserted (all scheduling halted).

**S7 — disable + orphan cleanup:** disable a task's schedule → `removeJobScheduler` → it stops firing. Remove an entry from the config and restart → its orphaned Job Scheduler is cleaned up on boot (file authoritative).

**S8 — missed-fire policy:** stop the process across a scheduled slot, restart; confirm the next *future* occurrence fires (skip-and-resume), with no backlog flood of missed runs.

**S9 — UI (Chrome visual):** the Scheduled Tasks panel lists any registered task, accepts minutes/cron (no 1-hour client guard), and shows enabled state + next/last run.

## Test infrastructure

- Existing hand-rolled Node runner (`npm test` → `test/test.js`); no new deps (house rule).
- Registered: `generalizedTaskScheduler`, last in `test/test.js`'s suite list (after `reconciliationIncrementalMode`).
- Asserts only against in-repo files: `src/api/scheduled-tasks/index.js`, `src/manage/taskQueue/queue/{index,scheduler}.js`, `src/api/index.js`, `bin/control-panel.js`, `package.json`, `OPERATIONS.md`.
- No Playwright at the sentinel layer; the UI validation (S9) is part of the Chrome smoke.

## How to run

```
npm test
```

Targeted: `node -e "require('./test/generalized-task-scheduler.test.js').run()"`

## Verification

New tests fail on the pre-implementation tree (atop ADR commit `82200ccf`); all 18 prior suites stay green (incl. the now-merged `reconciliation-incremental-mode` 16/16). Confirmed 2026-05-22:

```
generalized-task-scheduler suite:
  ✗ T1: scheduling uses BullMQ Job Schedulers (upsertJobScheduler), not setInterval
  ✗ T2: the scheduler reconciles disabled/orphan schedules (removeJobScheduler / getJobSchedulers)
  ✗ T3: the in-process setInterval scheduler is retired from scheduled-tasks/index.js
  ✗ T4: the 1-hour minimum-interval floor is removed
  ✗ T5: schedulable tasks are validated against the task registry, not a hardcoded DEFAULTS set
  ✗ T6: schedules support cron expressions
  ✗ T7: schedules support sub-hour intervals via intervalMinutes
  ✗ T8: OPERATIONS.md documents the generalized scheduler (sub-hour + the Job Scheduler mechanism)
  ✓ R1: the BullMQ per-task Queue+Worker topology the scheduler attaches to is intact, and getQueue is exported
  ✓ R2: bullmq is a declared runtime dependency
  ✓ R3: the scheduled-tasks operator API surface remains registered
  ✓ R4: the scheduler is still wired at control-panel boot

generalized-task-scheduler suite:                FAIL (4 passed, 8 failed)
Overall:                                          FAIL
```
