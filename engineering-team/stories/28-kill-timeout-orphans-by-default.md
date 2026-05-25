# Story 28: Kill timeout-orphans by default so they stop suppressing subsequent scheduled fires

**Status:** Draft
**Created:** 2026-05-25
**Type:** Bug

## Background

ADR 0013 (story #15, 2026-05-20) introduced a Redis-backed `neo4j-heavy` semaphore (cap=1) to serialize concurrent Neo4j-heavy work and prevent crashes. Story #27 / ADR 0024 (2026-05-25) plus its Track A follow-up (PR #217) restored the contract that the semaphore actually be held for the configured task duration rather than releasing at ~6 seconds — the no-timeout case is now correct on prod.

A second failure mode remains. When a tagged task hits its configured timeout (either genuine — the task really did run too long — or operator-misjudged — the configured timeout was too tight), the wrapper script's monitor loop declares timeout and exits. The current default `forceKill: false` (registry global default + a hardcoded fallback in `processor.js`) means the backgrounded child process is **not** killed. The Node Worker callback's `finally { release() }` releases the semaphore. The orphaned bash subprocess keeps running.

When the next scheduled fire of the same task occurs, the wrapper script's `check_task_already_running` (`launchChildTask.sh:25-67`) finds the orphan PID via `pgrep -f`. Under the default `processAlreadyRunning.withoutError.launchNew = false` policy, it emits `TASK_LAUNCH_PREVENTED` and exits success — BullMQ records job completion. The scheduled fire was silently dropped.

This was concretely observed on prod 2026-05-25 during Track A verification: the post-deploy `processCustomer` tick at 20:23:04Z had its launch prevented at 22:06:32Z because the prior stale-recovered tick's orphan (PID 195788) was still running. The fresh tick's actual neo4j-heavy work did not run at all. Cumulatively, since story #15 shipped on 2026-05-20, the system has likely dropped a meaningful fraction of scheduled fires for tasks whose work routinely exceeded their pre-Track-A 30-min timeouts.

The current posture is architecturally incoherent. `forceKill: false` carries the semantic "let the work finish past its timeout"; the orphan-detection carries the semantic "if a prior fire is still running, skip the new one." Together they violate both ADR 0013's cap=1 contract (the orphan runs unprotected after semaphore release) AND the scheduling contract (fires silently dropped). Track A reduced timeout frequency for the three biggest offenders but did not change the kill-on-timeout decision. Story #27 explicitly scoped this out (its ADR 0024 §"Constraints from the story" notes "this ADR preserves the current `forceKill: false` behavior").

The fix ships into a live prod task queue. The deploy must not require operator cleanup of in-flight tasks or pre-existing orphans.

## User-facing description

As an operator of a Brainstorm deployment who relies on scheduled task fires to actually execute,
I want a task that hits its configured timeout to be killed rather than left running as an orphan,
so that the next scheduled fire of the same task runs at its scheduled time instead of being silently dropped by the wrapper's already-running detection.

## Acceptance criteria

- [ ] Given a task whose script exceeds its configured timeout, when the wrapper script's monitor loop fires timeout, then the backgrounded child process is killed (no surviving orphan PID after wrapper exit).
- [ ] Given a tagged task whose prior fire was killed at timeout, when the next scheduled fire occurs, then `check_task_already_running` finds no orphan and the new fire's script runs (a `TASK_START` event lands in `events.jsonl`; no `TASK_LAUNCH_PREVENTED` event).
- [ ] Given a timeout-triggered kill, when an operator queries `events.jsonl`, then the timeout is observable via the existing `CHILD_TASK_ERROR` / timeout token — no new event type is required (operator can distinguish "killed via timeout" from other failure modes through existing fields).
- [ ] Given any invocation path that reaches `launchChildTask.sh` (BullMQ Worker, parent script's `launch_child_task` recursive call, manual `bash launchChildTask.sh ...`), when timeout fires, the kill behavior applies uniformly — controlled by the wrapper's `resolved_options`, which honors the registry global default regardless of caller.
- [ ] Given the deploy of this change, when prod restarts, no manual cleanup of in-flight tasks or pre-existing orphans is required. Pre-existing orphans run to natural completion or operator action; new timeouts post-deploy kill cleanly.

## Concepts touched

None. Per ADR 0013, the task-queue + wrapper-script subsystem has no concept-graph footprint. The Architect should re-confirm by querying `/api/concept-graph/summaries` once the local control panel is up (per AGENTS.md §1–§3).

## Out of scope

- **Track B — auto-tune timeouts from observed average runtimes** (2026-05-25 intake at `_intake.md`, "Follow-up: per-task timeout overrides ... and auto-tune"). Separate multi-session feature with 6 design questions.
- **Cleanup of the 11 existing per-task `forceKill: false` overrides** in `taskRegistry.json` (lines 110, 231, 262, 291, 342, 373, 403, 435, 1431, 1460, 1489). The Architect decides whether to delete them so the global default applies uniformly, keep them with documented justification, or preserve as-is. This story specifies the global default change, not the per-task cleanup.
- **Smarter `check_task_already_running` PID-attribute detection** (intake Option 2 — distinguish "expected concurrent run" from "orphan-from-timeout"). Rejected during `/discuss` 2026-05-25 — significant complexity, doesn't address the semaphore-contract issue, and treats a symptom rather than the cause.
- **Flipping `processAlreadyRunning.withoutError.launchNew = true`** (intake Option 3 — let the new fire run alongside the orphan). Rejected during `/discuss` 2026-05-25 — would violate ADR 0013's cap=1 contract during the overlap window.
- **New operator-facing surfaces for kill visibility** — no new event types, no new dashboard fields, no new BullBoard columns. Existing `CHILD_TASK_ERROR` tokens carry the information.
- **The held branch `fix/launch-child-task-protection-audit`** (story #26 / ADR 0023). Separate work, separate Implementer pickup. Independent from this story.
- **The 2026-05-24 JS-exec API handlers intake** (legacy handlers that `child_process.exec` task scripts directly, bypassing the wrapper). Those paths do not go through `launchChildTask.sh` so this story's fix does not reach them. Separate triage.
- **Changes to the `forceKill` field's location or shape** in the registry schema. The change is a single value flip + (optionally, per Architect) cleanup of overrides. No schema redesign.

## Open questions

- **Neo4j cleanliness on `kill -9` of a bash subprocess running an in-flight Cypher transaction.** Architect to research/affirm: does killing the bash wrapper around a `cypher-shell` invocation (or equivalent) leave Neo4j in a half-applied transactional state? Working hypothesis: no — Neo4j transactions are atomic at the query level, and any in-flight transaction at process death is rolled back by the server. But this is the highest-risk operator-visible aspect of the change and deserves explicit confirmation in the ADR rather than implicit acceptance.
- **Per-task override policy.** The 11 explicit `forceKill: false` overrides in `taskRegistry.json` need an Architect decision: delete (uniform), keep (documented per-task reason), or preserve (those tasks retain pre-fix behavior). Resolve in Phase 2.

## Linked artifacts

- ADR: [`engineering-team/decisions/0025-kill-timeout-orphans-by-default.md`](../decisions/0025-kill-timeout-orphans-by-default.md)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
