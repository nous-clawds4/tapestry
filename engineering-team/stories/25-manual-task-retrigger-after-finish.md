# Story 25: Manual task re-triggers should work after the previous attempt finishes

**Status:** Draft
**Created:** 2026-05-24
**Type:** Bug

## Background

Operators manually trigger tasks via `/api/run-task` — through the legacy Task Explorer's "Run Task" button or directly via curl — for debugging, recovery from failures, and ad-hoc "fire X now" workflows. The task queue (story #13 / ADR 0012) was designed so manual re-triggers dedup *only while a previous attempt is in `wait` or `active`* — once the prior attempt finishes, a re-trigger should create a fresh execution. ADR 0012's text under "Dedup" says exactly this.

In actual operation, manual re-triggers are silently blocked once a task has any completed (or failed) job in BullMQ. Operators don't see an error; they get the stale prior attempt's metadata back without anything new running. This affects:
- **All 39 non-customer tasks** — blocked after their first ever completed/failed run.
- **All 15 customer tasks** — blocked per `(taskName, pubkey)` combo once that pair has any completed/failed job.

Scheduled fires (story #24 / ADR 0021) are NOT affected — Job Schedulers generate a unique jobId per fire — which is why this bug hasn't surfaced via the Scheduled Tasks panel.

Reproduced live on staging + prod against `calculateOwnerPageRank` during story #24 follow-up diagnosis on 2026-05-24 (per intake B). Has been present since ADR 0012 shipped to prod.

The fix ships into a live prod task queue. The deploy path must not require operator intervention beyond a normal cycle-staging / cycle-prod flow — no Redis data wipe, no manual queue drain, no scheduled-task pause window.

## User-facing description

As an operator debugging or recovering from a task failure,
I want manually re-triggering a task via `/api/run-task` to always create a fresh execution once the previous attempt is no longer running,
so that "fire X now" workflows work as the operator expects and as ADR 0012 documents.

## Acceptance criteria

- [ ] Given a non-customer task (e.g., `calculateOwnerPageRank`) that has previously completed via BullMQ, when an operator manually re-triggers it via `/api/run-task`, then a new BullMQ job is created and the task actually runs again (verified by a new `TASK_START` event in `events.jsonl` and a new job ID returned in the API response).
- [ ] Given a non-customer task whose previous attempt FAILED in BullMQ, when an operator manually re-triggers it via `/api/run-task`, then a new BullMQ job is created and the task actually runs again (recovery-from-failure path).
- [ ] Given a customer-scoped task (e.g., `processCustomer` for customer Alice) whose previous attempt for Alice has finished (completed or failed), when an operator re-triggers it for Alice, then a new BullMQ job is created and runs.
- [ ] Given a customer-scoped task currently `active` for customer Alice, when a second concurrent trigger lands for the same customer, then the second trigger joins the existing in-flight job (the intentional concurrent-fire dedup from ADR 0012 is preserved).
- [ ] Given any scheduled task entry (per-entry, ADR 0021), when its scheduled cadence fires, then it continues to create fresh executions on each fire — no regression to scheduled-fire behavior.
- [ ] After the fix lands, ADR 0012's text under "Dedup" describes the actual code behavior. Specifically: the documented dedup window (`wait`/`active` only) matches what the code enforces.
- [ ] The fix deploys via the standard `cycle-staging` → `cycle-prod` flow with no Redis data migration, no manual queue drain, and no scheduled-task pause. In-flight BullMQ jobs at the moment of deploy continue to completion without manual intervention.

## Concepts touched

None. Per ADR 0012, the task-queue subsystem has no concept-graph footprint. The Architect should re-confirm by querying `/api/concept-graph/summaries` once the local control panel is up, per AGENTS.md §1–§3.

## Out of scope

- **Intake A — `launch_child_task` subshell bypass.** Subshell-invoked children don't flow through BullMQ at all (per intake A 2026-05-24); this story doesn't change that behavior. The two intakes are independently fixable.
- **Unified all-tasks timeline UI** (intake 2026-05-24, just filed). The observability gap surfaced during this story's `/discuss` is a separate Feature.
- **Per-task concurrency tuning, retry policies, BullMQ priority queues** — not part of this fix.
- **Authentication on `/api/run-task`** — preserved as-is per ADR 0012's out-of-scope list.
- **BullBoard, `events.jsonl`, or any other observability surface** — observability is unchanged in shape, though BullBoard's "recent completed jobs" view may show a smaller window depending on the Architect's mechanism choice.
- **Redis data migration or queue-state surgery on existing completed/failed jobs.** Any legacy jobs blocking the dedup at deploy time are tolerable — the fix takes effect for new completions from the deploy onward. Operators who need an immediate unblock can clear specific stale jobs via BullBoard's existing "Remove" controls.

## Open questions

- (Resolved during `/discuss` 2026-05-24:) ADR 0012 amendment is bundled with the fix — same PR, not a separate doc-only change.
- (Resolved during `/discuss` 2026-05-24:) Failed-job re-trigger is in scope alongside completed-job re-trigger; both are operator recovery workflows.
- (Resolved during PO drafting 2026-05-24:) No-downtime deploy is a mandated AC; Redis data migration is out of scope.
- (For Architecture phase:) The specific BullMQ mechanism — `removeOnComplete: true` + `removeOnFail: true`, or `{ age: T }` variants, or a hybrid scheme — is the Architect's call.

## Linked artifacts

- ADR: [`engineering-team/decisions/0022-manual-task-retrigger-dedup-fix.md`](../decisions/0022-manual-task-retrigger-dedup-fix.md) (includes in-place amendment to ADR 0012's "Dedup" section)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
