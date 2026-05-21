# Story 13: Route /api/run-task through BullMQ (task queue, phase 1)

**Status:** Approved
**Created:** 2026-05-19
**Type:** Feature

## Background

Tapestry today has no real task queue. Four trigger surfaces — the Scheduled Tasks UI, the legacy Task Explorer, direct HTTP `POST /api/run-task`, and systemd `.timer` units on the host — all converge on `src/api/manage/commands/runTask.js`, which spawns `src/manage/taskQueue/launchChildTask.sh`. Concurrency is enforced only by `launchChildTask.sh` doing a `pgrep` on the task script name plus a per-task `killPreexisting` / `launchNew` policy from `taskRegistry.json`. This has three consequences that block the next stage of work:

- The script-name match doesn't distinguish customers. Two `calculateCustomerGrapeRank` invocations for different customers look identical to the guard, so the second is dropped or kills the first depending on policy.
- The in-process scheduler at `src/api/scheduled-tasks/index.js` uses `setInterval` inside the control-panel Node process. State lives in `/var/lib/brainstorm/scheduled-tasks.json`. If the process dies between fires, that interval is silently skipped.
- There is no durable record of "I scheduled job X for customer Y at time T" — fired and forgotten — and no observability beyond log scraping and `pgrep`.

The operator is preparing to schedule routine per-customer recalculations (GrapeRank, etc.). The current architecture will silently corrupt outputs or drop work at scale.

**Operational context (2026-05-20 update):** in practice the operator has stopped using cron and the Scheduled Tasks panel for routine recalculations — `reconciliation` is unreliable and there's no point recalculating against a possibly-stale Neo4j. The only currently-scheduled task is `Refresh Meilisearch profiles & House PoV scores`. All other score calculations are triggered manually, and the immediate operational pain driving this story is **cross-task Neo4j contention on manual triggers** (e.g., triggering `calculateOwnerGrapeRank` and `calculateOwnerPageRank` back-to-back from the Task Explorer results in both running concurrently and threatening Neo4j stability). This story's phase-1 scope is unchanged — durable queue behind `/api/run-task` with per-task dedup — but the cross-task coordination layer that solves the *immediate* manual-trigger pain is tracked as a sibling story (see Out of scope).

This story is **phase 1** of a multi-phase migration to durable, observable task execution. Phase 1's scope is intentionally minimal: route the existing `/api/run-task` endpoint through a real queue without changing any UI, scheduler, or systemd timer. The scheduler keeps calling `/api/run-task` exactly as today; behind it, jobs flow through BullMQ. This proves the architecture on production traffic with the smallest possible reversible change.

**Phases 2 and 3 are explicitly out of scope and will be tracked as separate stories:**

- **Phase 2:** migrate `scheduled-tasks.json` to BullMQ repeatable jobs; replace the in-process `setInterval`.
- **Phase 3:** decide each systemd `.timer` unit's fate task-by-task — either convert to a BullMQ repeatable or retain for system-level recovery.

`ioredis` is already a runtime dependency (used by `src/pipeline/stream/redis-consumer.js` for strfry event streaming). BullMQ runs on Redis and is the natural fit.

**Design decisions baked into phase 1 (resolved with operator at Planning, 2026-05-19):**

- **Worker runs in-process** within the existing control-panel Node process — no separate supervisord entry. The actual task work already happens in child processes (`launchChildTask.sh` spawns the script); the in-process worker is just a dispatch loop polling Redis. Adding a separate worker process means another supervisord entry on top of strfry, strfry-router, neo4j, and the control-panel — real operational cost. A failed job can't crash the API because the job runs in a child process either way. If the in-process dispatcher later interferes with API responsiveness, splitting it out is a mechanical refactor with no architectural lock-in.
- **Observability via BullBoard**, mounted behind existing admin auth at `/admin/queues` (or equivalent admin-only path). BullBoard ships ~80% of operator value with no UI work and is the standard tool for BullMQ. Alternatives evaluated: Arena (less actively maintained), Taskforce.sh (commercial SaaS, ships queue data off-prem), JSON-API-only (pushes retry / remove / drain friction onto the operator at incident time), and a Tapestry-themed UI built in-house (real cost, would be built blind to what the operator actually needs — a defensible later-phase enhancement once we have evidence). The Architect should ensure the mount path and/or a banner make clear this is an admin operations surface, since retry / remove / pause can cause damage if misused.
- **Failure surface is additive, not replacing.** BullBoard becomes the authoritative source for queue-level state (active / waiting / failed jobs). The existing Scheduled Tasks panel run history is unchanged in this phase — the scheduler hasn't been migrated to BullMQ yet (phase 2), so its in-process state remains authoritative for scheduled-task fires. Push notifications (email, Slack) on failure are explicitly out of scope until there's a real "I missed a failure" incident.
- **Redis configured with AOF persistence (`appendfsync everysec`).** Queued jobs survive a Redis restart (planned maintenance, container update, crash). Cost is negligible at this throughput; this is the BullMQ-recommended production setting. Note: Redis also hosts the strfry event-stream consumer (`src/pipeline/stream/redis-consumer.js`); the Architect verifies persistence has no adverse interaction with that pipeline.

## User-facing description

**As an operator** triggering or scheduling tasks against this Tapestry instance, **I want** every task invocation to go through a durable queue with per-customer deduplication and configurable concurrency, **so that** I can schedule recalculations for many customers without silently corrupted outputs, dropped jobs, or surprise kill-restart behavior — and so that I can see what's running, queued, and failing.

## Acceptance criteria

- [ ] The `POST /api/run-task` endpoint signature is unchanged. All existing query parameters (`taskName`, `pubkey`, `customerId`, `customerName`, `limit`, `warmStart`) are accepted. Existing response fields are unchanged; new fields may be added.
- [ ] When `/api/run-task` is called for a customer-scoped task, the request enqueues a BullMQ job keyed by `(taskName, pubkey)` instead of directly spawning `launchChildTask.sh`.
- [ ] Submitting the same `(taskName, pubkey)` twice within a small window (e.g., before the first one starts running) results in exactly **one** job execution. The second submission is deduplicated; the response indicates which job it joined.
- [ ] Submitting the same `taskName` for **different** customer pubkeys results in concurrent execution up to a per-queue concurrency cap (configurable; default `1` initially for `calculateCustomerGrapeRank`, tunable per task in a server-side config).
- [ ] Non-customer tasks (taskRegistry entries without `arguments.customer = true`) still execute through the queue with single-instance semantics (concurrency 1, dedup on taskName alone).
- [ ] BullMQ jobs invoke the same `launchChildTask.sh` they would have today. `launchChildTask.sh`'s `pgrep` guard and per-task launch policy remain in place as belt-and-suspenders during this phase.
- [ ] Existing UIs work unchanged: the Scheduled Tasks tab triggers the same endpoint and surfaces the same run history; the Legacy Task Explorer continues to work.
- [ ] systemd `.timer` units continue to fire and reach `/api/run-task`, now enqueueing instead of directly spawning.
- [ ] If the control-panel process is restarted while jobs are in flight, in-flight jobs continue (or fail-and-retry) per BullMQ defaults — they are not silently lost.
- [ ] Redis is configured with AOF persistence (`appendfsync everysec`). A planned Redis restart (e.g., container update) or crash does not lose queued jobs. Architect verifies this configuration does not adversely affect the strfry event-stream consumer.
- [ ] **BullBoard** is mounted behind the existing admin auth at `/admin/queues` (or equivalent admin-only path), showing: active jobs, waiting jobs, completed jobs (last N), failed jobs (last N), per-queue concurrency settings, with the standard retry / remove / pause operations available. The mount path and/or a banner make clear this is an admin operations surface (retry / remove / pause can cause damage if misused).
- [ ] The worker runs **in-process** within the existing control-panel Node process — no separate supervisord entry in phase 1.
- [ ] The Scheduled Tasks panel's run history shows, for each scheduled-task fire, at least as much information as it does today (timestamp of fire; outcome for sync tasks; status reference for async tasks). Introducing the queue must not regress this surface — the Architect's design preserves the existing sync-vs-async semantics of `/api/run-task` (sync callers still get an outcome response; async callers still get "queued / started" with a status reference).
- [ ] Push notifications (email, Slack, etc.) on job failure are explicitly NOT in scope for this phase.
- [ ] A **feature flag** (`TASK_QUEUE_ENABLED=true|false` in `brainstorm.conf`) toggles the queue layer. When `false`, `/api/run-task` falls back to the current direct-spawn behavior with no functional regression. This is the rollback path.
- [ ] Documentation in `OPERATIONS.md` covers the new env vars, the feature flag, the BullBoard URL (if exposed), and how to drain / pause the queue for maintenance.
- [ ] Redis is treated as a runtime dependency for the queue. If Redis is unreachable when the queue is enabled, `/api/run-task` returns a 503 with a clear error rather than silently degrading.

## Concepts touched

To be resolved by the Architect via `/api/concept-graph/summaries`:

- Task Registry (`taskRegistry.json`)
- launchChildTask (`launchChildTask.sh`)
- Customer Manager / `customer.directory`
- Scheduled Tasks subsystem (touched only as caller — not modified in this phase)
- ioredis / Redis (existing strfry-events use → new task-queue use)

## Out of scope

- **Migrating `scheduled-tasks.json` to BullMQ repeatable jobs.** Phase 2 story.
- **Retiring or converting systemd `.timer` units.** Phase 3 story.
- **Removing or refactoring `launchChildTask.sh`'s `pgrep` guard.** Keep as redundant safety in phase 1; revisit once BullMQ behavior is proven in production.
- **UI changes** to the Scheduled Tasks tab or Task Explorer.
- **Authentication / authorization on `/api/run-task`.** Existing access controls are preserved unchanged.
- **Per-task queue configuration UI.** Concurrency caps are set in a server-side config file in this phase; UI for tuning them is later.
- **Cross-host distributed workers.** Single-host queue + single-host workers initially.
- **Fixing the GrapeRank shared CSV race condition** (story #12). The queue's per-customer concurrency cap of `1` for `calculateCustomerGrapeRank` is the temporary safety mechanism until story #12 ships, at which point the cap can be raised.
- **Cross-task Neo4j coordination.** This story enforces per-task concurrency (and per-`(taskName, pubkey)` dedup) but does NOT address the case where two *different* tasks (e.g., `calculateOwnerGrapeRank` + `calculateOwnerPageRank`) both touch Neo4j and the operator wants them serialized to avoid Neo4j load spikes. That belongs in a sibling story; the Architect should design the queue model here so that a future shared "Neo4j-heavy class" coordination layer is mechanically easy to layer on (e.g., resource-class tagging on registry entries, a shared semaphore overlay, or an equivalent).

## Open questions

**Resolved with operator at Planning (2026-05-19):**

- **Worker model** → In-process for phase 1. Rationale in Background.
- **Observability tool** → BullBoard (alternatives evaluated; rationale in Background).
- **Failure surface** → BullBoard for queue state; Scheduled Tasks panel run history unchanged; push notifications deferred. Rationale in Background.
- **Redis persistence** → AOF with `appendfsync everysec`. Rationale in Background. Architect to verify no adverse interaction with the strfry event-stream consumer (`src/pipeline/stream/redis-consumer.js`).

**Deferred to Architect (PO reviews at architecture gate):**

- **Sync-vs-async wrapper design.** `/api/run-task` already distinguishes sync (waits, returns outcome) from async (returns "queued, check Task Explorer") tasks. With BullMQ, sync semantics can be preserved via `job.waitUntilFinished()`. Architect to design the wrapper that preserves this distinction without regressing the existing UX.
- **Job retention policy.** BullMQ defaults (last N completed, all failed) are likely fine to start; Architect to recommend a default with operator-tunable values.
- **Queue-model friendliness to future cross-task coordination.** A sibling story (forthcoming) will introduce a shared "Neo4j-heavy class" concurrency cap across multiple task types. The Architect's queue-model choice in this story should not paint that future into a corner — ideally the design accommodates either resource-class tagging on registry entries or a shared semaphore overlay without re-architecting the dispatcher.

## Linked artifacts

- ADR: [0010-task-queue-phase-1-bullmq.md](../decisions/0010-task-queue-phase-1-bullmq.md)
- Test plan: [13-task-queue-phase-1-bullmq-behind-run-task.test-plan.md](13-task-queue-phase-1-bullmq-behind-run-task.test-plan.md)
- Review: (filled in after Review phase)
