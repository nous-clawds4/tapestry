# Story 26: Close `neo4j-heavy` semaphore coverage gaps for subshell-invoked task chains

**Status:** Draft
**Created:** 2026-05-24
**Type:** Bug

## Background

The `neo4j-heavy` resource-class semaphore from story #15 / ADR 0013 caps concurrent neo4j-heavy work at 1 to prevent Neo4j crashes. Its acquire/release lives in the BullMQ Worker callback — meaning the semaphore engages when a task is invoked via the BullMQ path (`/api/run-task` or a Job Scheduler). When tasks invoke their children via bash subshell (`launch_child_task` from `launchChildTask.sh`, or bare `bash $child_script` calls in customer-side parents), the children run as forked subprocesses outside BullMQ — **their semaphore wrap never engages**.

PR #201 (story #24 follow-up) closed the immediate operator-reported case by tagging the orchestrator-level parents (`updateAllScoresForOwner`, `processCustomer`, `processAllActiveCustomers`, etc.) so the parent's BullMQ Worker holds the semaphore across the parent's entire subshell chain. This works — verified during the 2026-05-24 cycle. But it created an implicit, undocumented architectural convention: **a tagged task is only protected when the entry-point in its invocation chain is itself tagged**. Children's `resourceClass` tags are dormant on parent-driven paths.

An audit during this story's planning pass surfaced two confirmed live gaps on the owner side:

- **`processAllTasks`** is NOT tagged but its subshell chain (via `launch_child_task`) includes ~10 tagged children (`updateAllScoresForOwner`, `calculateOwnerHops`, `calculateOwnerPageRank`, etc.). If `processAllTasks` is triggered via `/api/run-task` or a future scheduled entry, none of those tagged children's protection engages.
- **`processNpubsUpToMaxNumBlocks`** is NOT tagged but spawns `updateNpubsInNeo4j` (tagged) as a subshell child. `processNpubsUpToMaxNumBlocks` is currently scheduled on prod (fires every ~6h), so this is an actively-running unprotected path.

Customer-side parents (`processAllActiveCustomers`, `processCustomer`, `updateAllScoresForSingleCustomer`) are all tagged, so their subshell chains are protected — but they use bare `bash $script` calls rather than `launch_child_task`, which the Architect should account for in any audit (the architectural property is the same regardless of the spawn syntax).

The bug isn't operator-visible today (no Neo4j crashes attributable to it, no immediate operator complaint). It's a latent protection gap. Future scheduling changes — or someone adding a new tagged child without realizing the parent needs tagging too — could expose it as an incident.

The fix ships into a live prod task queue. The deploy must not require any operator intervention beyond a normal cycle-staging / cycle-prod flow.

## User-facing description

As an operator who relies on the `neo4j-heavy` semaphore to serialize Neo4j-intensive work and prevent crashes,
I want every task tagged `neo4j-heavy` to actually engage that protection regardless of how it's invoked,
so that the documented contract from ADR 0013 — "concurrent neo4j-heavy work is capped at 1" — holds for every code path that runs a tagged task, including subshell-invoked chains.

## Acceptance criteria

- [ ] Given any tagged `neo4j-heavy` task X reachable from `/api/run-task`, a scheduled-tasks entry, or as a subshell child of any parent script, when X is invoked through any of those paths, then the `neo4j-heavy` semaphore engages for X's execution window (verified via BullBoard's active-count, the `resource_class_wait_*` events in `events.jsonl`, or both).
- [ ] Given the two currently-unprotected orchestrator paths identified during planning — `processAllTasks` and `processNpubsUpToMaxNumBlocks` — when either runs, the semaphore is held for the entire run including its subshell-invoked tagged children. Two simultaneous triggers (one of these and any other neo4j-heavy task) serialize: one waits while the other runs.
- [ ] Given any other parent script in the codebase that invokes a tagged child via bash subshell (`launch_child_task` or bare `bash $script`), the audit confirms either (i) the parent is itself tagged, or (ii) the child is unreachable via that subshell path. The audit results are recorded in the ADR amendment.
- [ ] ADR 0013's text describes the actual protection model — specifically that subshell-invoked children inherit protection from their parent's BullMQ wrap, and therefore every entry-point in a tagged child's invocation chain must be tagged. (Bundled with the fix as an in-place amendment, same shape as ADR 0022's amendment of ADR 0012.)
- [ ] BIBLE.md §24 documents the parent-tag-is-load-bearing convention so future developers adding a new tagged task know what entry-point coverage is required.
- [ ] The fix deploys via the standard `cycle-staging` → `cycle-prod` flow with no Redis intervention, no scheduled-task pause, and no manual cleanup of in-flight jobs.

## Concepts touched

None. Per ADR 0013, the task-queue / resource-class subsystem has no concept-graph footprint. The Architect should re-confirm by querying `/api/concept-graph/summaries` once the local control panel is up (per AGENTS.md §1–§3).

## Out of scope

- **Refactoring `launchChildTask.sh` (or any parent script) to invoke children via `/api/run-task` instead of bash subshell** — that's the "Option B" from the `/discuss` triage. Substantial architectural change, deferred to a future Feature story when there's a forcing function.
- **Implementing semaphore acquire directly inside `launch_child_task` / bare-bash spawn paths** — that's the "Option C" from `/discuss`. Rejected due to deadlock risk against the parent's already-held semaphore.
- **Unified all-tasks timeline UI** (separate 2026-05-24 intake) — addresses operator visibility into subshell-invoked children via `events.jsonl`. Independent from this story.
- **Removing the "dormant tag" on child tasks** — leaving `resourceClass: neo4j-heavy` on tagged children is intentional defense-in-depth (the tag engages when the child is invoked directly via `/api/run-task` or scheduled independently — not dormant on those paths, only on parent-driven paths). If the Architect wants to revisit this trade-off, it can be raised during Phase 2.
- **Adding programmatic registry-walking validators** that enforce the parent-tag convention at boot or in CI — could be a follow-up if drift becomes a recurring problem; not needed for this story.
- **Performance changes to BullMQ Worker startup, concurrency tuning, or BullBoard UI** — out of scope.

## Open questions

- (Resolved during `/discuss` 2026-05-24:) Option (a) — accept the architecture + close the audit gaps + document — was chosen over Options (b) and (c).
- (Resolved during PO audit 2026-05-24:) Customer-side parent scripts use bare `bash $script`, not `launch_child_task`. The Architect's audit must account for both spawn syntaxes.
- (For Architecture phase:) The exact tag set to add (likely `processAllTasks` + `processNpubsUpToMaxNumBlocks` plus anything else the Architect's audit surfaces) is the Architect's call.

## Linked artifacts

- ADR: [`engineering-team/decisions/0023-task-queue-semaphore-protection-audit.md`](../decisions/0023-task-queue-semaphore-protection-audit.md) (includes in-place amendment to ADR 0013's protection-model section)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
