# Story 27: Scheduled tasks bypass configured timeouts (restoring `neo4j-heavy` semaphore contract)

**Status:** Draft
**Created:** 2026-05-25
**Type:** Bug

## Background

Since the generalized task scheduler shipped (story #24, ADR 0021) and began interacting with the cross-task resource-class semaphore (story #15, ADR 0013), every scheduled task whose registry entry has `"options": {}` — i.e., no per-task `completion.failure.timeout` configured — has been silently running with **no effective timeout protection** and has been triggering a spurious "timed out at 5s" status emission while the underlying work continues normally for as long as it needs.

The user-visible consequence operators have been seeing on the Scheduled Tasks panel:
- A task shows a `TASK_START` with no matching `TASK_END` for many minutes (or hours), even though the BullMQ Worker for that task has long since reported the job complete and moved on.
- The `neo4j-heavy` cross-task semaphore released its slot roughly 5–6 seconds after acquiring it, regardless of how long the actual Neo4j-heavy work took to finish. The `cap=1` serialization contract documented in ADR 0013 has therefore been functionally absent since story #15 shipped on ~2026-05-20: two `neo4j-heavy`-tagged tasks scheduled to fire concurrently have been running concurrently against Neo4j, not serialized.

Empirical evidence confirms this is the steady-state behavior, not a one-time stuck condition:
- 18 `CHILD_TASK_ERROR` events with `error_type: "timeout"` in a 24-hour window on staging, every one with `timeout_duration: 0` and `elapsed_time: 5000`.
- Confirmed affected tasks include `refreshSearchIndex` (hourly), `processCustomer` (hourly per customer), and `updateAllScoresForOwner` (6-hourly). The pattern is universal across any scheduled task with `"options": {}` in the registry.
- Production has presumably been running the same broken behavior — no Neo4j crash has been observed despite the broken serialization, which is fortunate but not load-bearing.

The bug compounds two related failures that the operator experiences as one symptom:
1. **Configured timeouts don't apply.** The registry has a global default timeout (`options_default.completion.failure.timeout.duration`, currently 30 minutes) intended to apply when a task doesn't override it. That default is not being honored — tasks with `"options": {}` are getting an effective timeout of zero milliseconds.
2. **The semaphore releases prematurely.** Because the wrapper script declares "timeout" almost immediately and exits without killing its backgrounded child, the Node-side process completes early, the BullMQ Worker callback's release-finally fires, and the semaphore slot is freed long before the actual heavy work finishes.

Who is affected:
- **Operators** relying on the documented `neo4j-heavy` cap=1 contract for safety reasoning when adding new heavy tasks.
- **The Scheduled Tasks panel and BullBoard observers** see misleading task-status output (spurious timeout errors; orphaned long-runs).
- **Neo4j itself**, in principle — the contract that prevented concurrent heavy work hasn't been engaging. (No crash observed in practice.)

## User-facing description

As an **operator** running scheduled tasks against a Neo4j-heavy workload, I want **the timeouts I configure in the task registry to actually apply at runtime, and the `neo4j-heavy` serialization contract to actually serialize concurrent heavy work**, so that I can trust the documented behavior of ADR 0013 when reasoning about safety and reason accurately from the Scheduled Tasks panel about whether tasks are still running.

## Acceptance criteria

Externally observable. Each criterion is testable from outside source code.

- [ ] **Configured timeout reaches the wrapper.** Given a scheduled task whose registry entry has `"options": {}`, when the scheduler fires that task, then the per-fire options resolved at wrapper-script entry show the global default timeout duration (the registry's `options_default.completion.failure.timeout.duration` value), not zero.

- [ ] **No spurious "timeout at 5 seconds" for healthy fires.** Given a scheduled task that completes within its configured timeout, when the fire finishes, then the structured events log contains **no** `CHILD_TASK_ERROR` event with `error_type: "timeout"` and `elapsed_time: 5000` for that fire.

- [ ] **Genuine timeout still works.** Given a scheduled task whose underlying script genuinely exceeds the configured timeout, when the timeout is reached, then a `CHILD_TASK_ERROR` event with `error_type: "timeout"` is emitted whose `elapsed_time` reflects the actual configured duration (not 5 seconds), and the configured `forceKill` policy is honored.

- [ ] **Semaphore holds for actual work duration on the scheduled path.** Given a `neo4j-heavy`-tagged scheduled task that takes N seconds of real Neo4j work to complete, when the fire completes successfully, then the `resource_class_released` event for that fire reports `held_seconds` within a small tolerance of N (not ~5–6 seconds).

- [ ] **Semaphore holds for actual work duration on the manual `/api/run-task` path.** Given a `neo4j-heavy`-tagged task triggered manually via `/api/run-task` without an explicit per-invocation timeout override, when the task completes, then the `resource_class_released` event reports `held_seconds` matching the task's actual duration (within tolerance).

- [ ] **cap=1 serialization is observable.** Given two `neo4j-heavy`-tagged tasks scheduled or triggered such that they would otherwise overlap, when both run, then the second task's `resource_class_wait_end` event shows `outcome: "acquired"` only **after** the first task's `resource_class_released` event has fired, with a measurable wait. (i.e., they were serialized, not concurrent.)

- [ ] **Per-task explicit timeout overrides still win.** Given a scheduled task whose registry entry has its own `options.completion.failure.timeout.duration` set (e.g., the existing 6-hour and 8-hour overrides on certain tasks), when the task fires, then that explicit per-task value is honored — not the global default and not zero.

## Concepts touched

Concept Graph API was not reachable from this session; the Architect should resolve handles when entering Phase 2. Concepts in plain language:

- **Task Queue / BullMQ worker** — the per-task BullMQ Worker that invokes the scheduler.
- **Task Registry** — the canonical declaration of tasks, their scripts, and their per-task and global completion/timeout options.
- **Resource-class semaphore (`neo4j-heavy`)** — the cap=1 serialization primitive from ADR 0013.
- **Task wrapper script** — the bash entry point that monitors a backgrounded task script and emits structured events.
- **Generalized task scheduler** — the BullMQ-backed scheduled-fire dispatcher introduced in ADR 0021.
- **Structured events log** — the `events.jsonl` audit stream consumed by the Scheduled Tasks panel and BullBoard.

## Out of scope

Deferred deliberately; do not let the Architect or Implementer pull these in:

- **The fate of the held branch `fix/launch-child-task-protection-audit`** (6 commits of paused story #26 work + ADR 0023 + reviewer report). Whether to revert, carry forward, or ship as no-op-with-honest-docs depends on which fix surface the Architect chooses in Phase 2. This story commits only to fixing the bug; the held-branch decision is a follow-up after Phase 2 lands.

- **Tag additions for parent tasks** (e.g., adding `resourceClass: "neo4j-heavy"` to `processAllTasks` and `processNpubsUpToMaxNumBlocks`). That's story #26's framing. May become relevant again as a follow-up depending on the fix shape, but is not a prerequisite for restoring the semaphore contract on its own.

- **The five JS-exec API endpoints** that bypass BullMQ and the semaphore entirely (`/api/process-all-active-customers`, `/api/generate-pagerank`, `/api/generate-reports`, `/api/generate-verified-followers`, calculate-hops). Separate intake (MEDIUM-HIGH). Same root concern in spirit, different invocation path, different fix.

- **Story #26's "close subshell coverage gaps" framing** in general. That framing was looking at one symptom (untagged parent tasks running subshells) of the broader pathology this story now addresses. Don't re-import that framing into this story; the Implementer doesn't need to think about it.

- **Revisiting `forceKill: false` as the default for timeout handling.** A reasonable separate conversation but not this story's concern.

- **Adding lint or typecheck infrastructure** to catch this class of bug going forward. Out per CLAUDE.md house rules.

## Open questions

None at the PO level. The diagnosis is locked from `/discuss` + empirical staging evidence. All open questions are now Architect-level (which fix surface(s) to use, how to test, etc.).

## Linked artifacts

- ADR: [`engineering-team/decisions/0024-scheduled-task-timeout-propagation.md`](../decisions/0024-scheduled-task-timeout-propagation.md)
- Test plan: [`engineering-team/stories/27-scheduled-task-timeout-propagation.test-plan.md`](27-scheduled-task-timeout-propagation.test-plan.md)
- Review: [`engineering-team/reviews/27-scheduled-task-timeout-propagation.md`](../reviews/27-scheduled-task-timeout-propagation.md) — **PASS**

### Prior context the Architect should read

- **ADR 0010** (story #13) — original BullMQ task queue.
- **ADR 0013** (story #15) — `neo4j-heavy` resource-class semaphore; the contract this story restores.
- **ADR 0021** (story #24) — generalized task scheduler; the path where this bug lives.
- **ADR 0023** — exists only on `fix/launch-child-task-protection-audit` branch; the in-place amendments to ADR 0013 there should be considered when designing this fix (some are right, some are based on the now-corrected premise).
- **Intake entry** at `engineering-team/stories/_intake.md` for 2026-05-24 ("Bug: `neo4j-heavy` semaphore released ~5s after acquire ...") — superseded by this story; PO will mark it picked-up after approval.
- **Session handoff doc** `docs/SEMAPHORE_INVESTIGATION_HANDOFF_2026-05-24.md` — full prior-session state.
