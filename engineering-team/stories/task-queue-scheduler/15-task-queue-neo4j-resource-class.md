# Story 15: Serialize cross-task Neo4j-heavy operations through a shared concurrency cap

**Status:** Done (backfilled 2026-07-02 — PASS review on record; see docs/HARNESS_REVIEW_HANDOFF_2026-07-02.md Appendix A)
**Created:** 2026-05-21
**Type:** Feature (sibling to story #13)

## Background

Story #13's BullMQ task queue shipped **per-task** concurrency caps (default 1) plus per-`(taskName, pubkey)` dedup. This serializes within a single task name — two `calculateOwnerGrapeRank` triggers can't coexist. But two *different* task names live in different per-task queues with independent concurrency budgets and **run concurrently**. Observed on prod immediately after story #13 promoted (`brainstorm.world`, 2026-05-21): the operator triggered `calculateOwnerGrapeRank + calculateOwnerPageRank` back-to-back and both ran concurrently, exactly as before story #13 shipped.

This is the operational pain that originally motivated story #13 (per its Background §"2026-05-20 update"). Story #13 deliberately deferred the fix to a sibling story so it could ship the durable-queue foundation first. This is that sibling.

The operator's day-to-day pattern is **manual triggers from Task Explorer** (cron is disabled because reconciliation is broken; the only scheduled task is the Meilisearch refresh). Without cross-task serialization for Neo4j-heavy operations, every manual recalc requires the operator to remember to wait for prior heavy work to finish before triggering the next — and forgetting risks Neo4j crashes.

ADR 0012 §Forward-compat hook pinned the design space: a resource-class tag on registry entries + a shared counted semaphore around the Worker's processor. This story ratifies that design and adds the operator-facing knobs.

## User-facing description

**As an operator** manually triggering Neo4j-heavy tasks via Task Explorer (or any future trigger surface), **I want** tasks tagged as "Neo4j-heavy" to share a concurrency cap (one at a time by default), **so that** I can trigger a sequence of heavy recalcs without remembering to wait for each to finish — and Neo4j is protected from concurrent expensive operations regardless of how many tasks I queue.

## Acceptance criteria

- [ ] Task registry entries can be tagged with a resource-class name (e.g., `"resourceClass": "neo4j-heavy"`). Tasks without a tag are unaffected by this story.
- [ ] When two tasks tagged with the same resource class are submitted to the queue concurrently, only one runs at a time; the second waits until the first completes. Per-class cap is configurable; **default cap = 1** for `neo4j-heavy`.
- [ ] The cap is operator-configurable per class (raise to 2 if Neo4j proves it can handle two concurrent heavies).
- [ ] Tasks **without** a resource class continue to run per their own per-task concurrency cap — semaphore is **additive**, not replacing.
- [ ] Story #13's per-task concurrency caps + per-`(taskName, pubkey)` dedup continue to work unchanged. The semaphore composes cleanly with them.
- [ ] **Initial registry tag set:** the owner trio `calculateOwnerHops`, `calculateOwnerPageRank`, `calculateOwnerGrapeRank` are tagged `neo4j-heavy` in this story (resolves the prod-observed pain directly). Operator can extend the set in `taskRegistry.json` operationally without changing this story.
- [ ] **Observability:** when a task is waiting on the resource-class semaphore (queued but not running due to the cap), this is visible — at minimum via structured events on `events.jsonl` with phase tokens like `resource_class_wait_begin` / `resource_class_wait_end`. Operator can answer "why hasn't my task started?" without reading source. Architect may additionally surface the wait state in BullBoard (deferring marking the job `active` until the semaphore acquires) if cheap; that's an Architect upgrade, not pinned by this story.
- [ ] **Orchestrator scripts unaffected:** `updateAllScoresForOwner.sh` and similar pipelines that invoke multiple heavy tasks sequentially at the bash level already serialize at the script level — adding the semaphore does not break or duplicate that serialization (each child's enqueue + wait still works correctly).
- [ ] **Behavior when `TASK_QUEUE_ENABLED=false`:** this story has no effect (the legacy direct-spawn path is unaware of the semaphore). That's intentional — the path to relief is to flip the queue flag on per environment, then this story serializes manual triggers.
- [ ] **Behavior when `TASK_QUEUE_ENABLED=true` but no tasks are tagged:** no effect. Story #13's behavior unchanged.
- [ ] No regression in story #13's 18-test source-sentinel suite or any of the other 11 suites.

## Concepts touched

- BullMQ task queue (introduced by story #13 / ADR 0012)
- Task Registry (`taskRegistry.json`)
- Redis (semaphore storage; shared with BullMQ + sessions + strfry-stream-consumer; all three coexist on different keyspaces)
- Operator triggers via Task Explorer / `/api/run-task` (existing — contract unchanged)

## Out of scope

- **Auto-detection of "which tasks are Neo4j-heavy."** Operator tags them; the Architect may suggest extensions to the initial set.
- **Per-customer or per-tenant resource budgets.** Single global semaphore per class. Per-customer caps are a future story.
- **Multiple resource classes with cross-class interactions** (priority, deadlock detection, fair scheduling). This story introduces one class (`neo4j-heavy`); the mechanism may support multiple, but inter-class dynamics are not in scope.
- **Retrofitting the legacy direct-spawn path** (`TASK_QUEUE_ENABLED=false`). If the operator wants protection without the queue, that's a separate, simpler story (bash-level lock or per-class `pgrep`).
- **UI for tagging tasks or tuning caps.** Server-side config + registry edits in this phase, matching story #13's posture.
- **Cross-host distributed coordination.** Single droplet, single Redis. Same scope as story #13.
- **Expanding the initial tag set to customer-equivalent tasks** (`calculateCustomerHops/PageRank/GrapeRank`, etc.) or other orchestrator-aware heavies (`syncWoT`, `reconciliation`, `processOwnerFollowsMutesReports`, `calculateReportScores`). Operator will extend operationally as load patterns emerge; not in initial scope to avoid front-loading tags before observation.

## Open questions

**Resolved with operator at Planning (2026-05-21):**

- **Default cap for `neo4j-heavy`** → **1** (one heavy task at a time; matches the demonstrated pain directly).
- **Initial registry tag set** → **owner trio only** (`calculateOwnerHops`, `calculateOwnerPageRank`, `calculateOwnerGrapeRank`). Narrow start; operator extends operationally as load patterns emerge.
- **Observability surface** → **structured events minimum** (`resource_class_wait_begin` / `resource_class_wait_end` phase tokens on `events.jsonl`). Architect may upgrade to BullBoard-visible `waiting` state if the change is cheap; not required.

**Deferred to Architect (PO reviews at architecture gate):**

- Exact config-file location for per-class caps (extend `/etc/brainstorm-task-queue.json` or sibling file).
- Wait-timeout behavior (what happens if a task can't acquire the semaphore within N seconds — fail, requeue, infinite wait).
- Whether to extend `resourceClass` to support multiple classes per task (`["neo4j-heavy", "io-bound"]`) or keep single-string for now.
- Semaphore implementation primitive (Redis SET with TTL, Lua-script atomicity, BullMQ's built-in rate-limiter, etc.) — ADR 0012 mentioned "Redis-backed counted semaphore" as the forward-compat hook; Architect picks the concrete primitive.

## Linked artifacts

- ADR: [0013-task-queue-neo4j-resource-class.md](../decisions/0013-task-queue-neo4j-resource-class.md)
- Test plan: [15-task-queue-neo4j-resource-class.test-plan.md](15-task-queue-neo4j-resource-class.test-plan.md)
- Review: [../reviews/15-task-queue-neo4j-resource-class.md](../reviews/15-task-queue-neo4j-resource-class.md) — **PASS** end-to-end (14/14 sentinels + cycle-local smoke S2 cross-task serialization PROVED on the live container).
