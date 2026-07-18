# Story 1: Deploy-safety status endpoint

**Epic:** deploy-safety-gate
**Status:** Draft
**Created:** 2026-07-18
**Type:** Feature

## Background

Every tapestry instance (production, staging, tags) runs scheduled tasks. Every merge to a deploy-triggering branch rebuilds and recreates the container, killing any task in flight — no drain, no warning. A killed owner-scoring batch leaves trust scores partially written and silently unreliable (intake entry 2026-06-08, "Owner scoring batch is not deploy-safe"). The operator's mitigation since June has been manual: disable every scheduled entry before promoting. On staging today all four entries are still disabled — the habit works, and it is exactly the kind of habit that gets forgotten once.

This story is the first slice of the gate that replaces that habit (book `engineering-team/audits/deploy-safety-gate/book.md`, acceptance-frame bullets 1–3): a single question an instance can answer about itself — *is it safe to redeploy you right now?* Later stories in this epic wire the answer into the pre-merge cycle checks and put a countdown on the settings panel; neither is possible until the answer exists.

The central correctness hazard is ratified at intake as the **phantom-running trap**: the existing "is a task running" surfaces are derived from a task-event history in which a deploy-killed task leaves a start with no matching end — and so reads as "running" for hours afterward. A gate built on that signal would deadlock after the very event it exists to guard against. This story must report *actual* execution state, not the historical inference.

**Who is affected:** the operator (and any cycle skill acting for them) deciding whether a merge is safe right now; instance owners whose scoring data is silently corrupted when the decision is wrong.

## User-facing description

As **an operator about to promote a branch that will redeploy an instance**, I want to ask that instance — with one plain unauthenticated request — whether any scheduled task is running now, when the next one fires, and whether it is safe to deploy, so that I never again kill a task mid-run or rely on remembering to disable the schedule by hand.

## Acceptance criteria

- [ ] **AC-1 (one read-only unauthenticated GET, complete answer):** Given a deployed instance, when its deploy-safety status endpoint is fetched with a plain unauthenticated GET — no login, no signing, no credentials; the calling convention available to a shell script — then a single successful machine-readable response reports all three of: (a) whether any covered task is running right now; (b) the next scheduled fire — the entry's name, its fire time, and the time remaining until it; and (c) an explicit safe/unsafe verdict. The request is read-only and repeatable: calling it any number of times changes no state, starts nothing, and cancels nothing.

- [ ] **AC-2 (what "running" covers — both sources, per the ratified decision):** Given a covered task is executing at request time, when the endpoint is called, then running-now is true and the verdict is unsafe. Covered tasks span both execution paths, each verified independently: (a) an active job on any task queue — whether it was started by the schedule or by a manual run-task trigger; and (b) an in-flight run of the legacy per-customer scheduler.

- [ ] **AC-3 (phantom-running exclusion — ratified):** Given the task-event history contains a task start with no matching end (the signature left when a previous container restart killed a task mid-run), and no covered task is actually executing now, when the endpoint is called, then running-now is false and the verdict is not made unsafe by the stale record. This exclusion has an explicit automated test.

- [ ] **AC-4 (verdict policy — ratified):** Given no covered task is running, then the verdict is unsafe when the next fire among **all enabled** scheduled entries is within the buffer (defaulting to **10 minutes**), and safe when the next fire is beyond the buffer or no entries are enabled. Every enabled entry counts toward "next fire," regardless of what the task does — narrowing to blocking-task classes is explicitly not v1.

- [ ] **AC-5 (queue-disabled is not nothing-scheduled):** Given the instance's task-queue layer is disabled, when the endpoint is called, then the response states that the queue is disabled, distinguishably from "queue enabled but nothing scheduled," and still returns a verdict per the ratified policy (with no upcoming fire to buffer against, unsafe only if a covered task — e.g. a legacy per-customer run — is in flight).

## Product decisions (operator-ratified at intake, 2026-07-18 — requirements, not open for relitigation)

1. **Gate policy:** unsafe if any covered task is running, or if the next fire among all enabled scheduled entries is within a buffer defaulting to 10 minutes; safe otherwise. (Replaces the originally proposed fixed 60-minute look-ahead, which sub-hourly entries could never satisfy.)
2. **"Running" definition:** active jobs on any task queue — scheduled fires and manual run-task triggers alike — plus the legacy per-customer scheduler's in-flight runs.
3. **Phantom exclusion:** a task killed by a previous container restart must not be reported as running.

Verbatim source: intake entry "2026-07-18 — Feature: scheduled-task deploy-safety gate" in `engineering-team/stories/_intake.md` (agreed-decisions list and architectural background), anchored by the book's acceptance frame.

## Concepts touched

None. Verified against the local Concept Graph 2026-07-18 (46 concepts): no handle covers scheduled tasks, task queues, deploys, or instance operations. Nothing in this story redefines an existing concept.

## Scope notes

- **One subsystem, one deliverable:** the status endpoint and its verdict. The consumers (cycle-skill check, settings countdown) are later stories in this epic and place no requirements here beyond what the acceptance frame's bullets 1–3 already state.
- **The buffer's default is the requirement; its configuration mechanism is not.** Whether and how the 10-minute buffer can be tuned (instance config, request parameter, neither) is the Architect's call — the story only requires the default.
- **Response field names, time-remaining representation, and payload shape are the Architect's call**, bounded by AC-1: one response, machine-readable, all three facts present.

## Out of scope

- The cycle-skill safe-to-merge integration, the bounded wait-and-recheck, the canonical shared recipe, and `feat/tags` promotion coverage (frame bullet 4) — next story in this epic.
- The settings Scheduled Tasks panel aggregate countdown line (frame bullet 5) — later story in this epic.
- Drain-on-deploy / graceful shutdown, and resumable checkpointing — the still-open branches of the 2026-06-08 intake entry.
- Stale job data on stalled recovery (intake entry 2026-05-25).
- Auth-gating the scheduled-tasks write endpoints.
- CI-side enforcement inside the deploy workflows; deploy-workflow concurrency groups and shell-strictness gaps (pre-existing pipeline issues, noted at intake).
- Narrowing the buffer check to blocking-task classes (future reconsideration, not v1 — ratified).

## Open questions

None. The intake entry's ratified decisions and the book's acceptance frame answer the policy questions this story raises.

## Linked artifacts

- Book: `engineering-team/audits/deploy-safety-gate/book.md`
- ADR: `engineering-team/decisions/deploy-safety-gate/0001-deploy-safety-status-endpoint.md`
- Test plan: `engineering-team/stories/deploy-safety-gate/1-deploy-safety-status-endpoint.test-plan.md`
- Review: (filled in after Review phase)
