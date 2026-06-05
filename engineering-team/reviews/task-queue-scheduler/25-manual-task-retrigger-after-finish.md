# Review: Story 25 — Manual task re-triggers should work after the previous attempt finishes

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-24
**Diff:** `git diff origin/staging...HEAD` (commit `e45c410e`)
**Branch:** `fix/manual-task-retrigger-after-finish`
**Story:** [`engineering-team/stories/25-manual-task-retrigger-after-finish.md`](../stories/25-manual-task-retrigger-after-finish.md)
**ADR:** [`engineering-team/decisions/0022-manual-task-retrigger-dedup-fix.md`](../decisions/0022-manual-task-retrigger-dedup-fix.md)
**Test plan:** [`engineering-team/stories/25-manual-task-retrigger-after-finish.test-plan.md`](../stories/25-manual-task-retrigger-after-finish.test-plan.md)

## Quality gates (run independently by reviewer, not trusted)

- [x] `npm test` — **PASS** (21 suites, 222 individual tests; `manual-task-retrigger-after-finish suite: PASS (10 passed, 0 failed)`; Overall: PASS).
- [x] Empirical probe `test/probe-bullmq-removeOnComplete-immediate.js` re-run inside container — **PASS** (8/8 ASSERT-PASS; exit 0; `bullmq@5.76.10` against `redis:6379`).
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped._

## Spec adherence (story #25's 7 acceptance criteria)

| AC | Coverage | Verified |
|---|---|---|
| **AC #1** non-customer re-trigger after completion | T1 sentinel (queue.add has `removeOnComplete: true`) + probe Path 1 | ✅ |
| **AC #2** non-customer re-trigger after failure | T2 sentinel (queue.add has `removeOnFail: true`) + probe Path 2 | ✅ |
| **AC #3** customer re-trigger after finish | Same single call site at [`queue/index.js:189`](../../src/manage/taskQueue/queue/index.js:189); T1+T2 cover the shared mechanism. `computeJobId` returns `${taskName}:${pubkey}` for customer args (T3) so the jobId hits the same code path. Probe operates on a fixed jobId — equivalent to the customer-task case. | ✅ |
| **AC #4** customer concurrent-fire dedup preserved | T3 sentinel (jobId formula at [`queue/index.js:64-69`](../../src/manage/taskQueue/queue/index.js:64) unchanged). Mechanism: `removeOnComplete: true` only triggers on completion-finalization, not preemptively, so an `active` job's hash still exists for in-flight dedup. Probe indirectly confirms this — the second add in Path 1 only proceeds AFTER the first job finalized (the wait-for-`completed` would have timed out otherwise). Behavioral verification at cycle-local per test plan. | ✅ |
| **AC #5** scheduled-fire non-regression | T4 sentinel (`scheduler.js` still calls `upsertJobScheduler`) + existing `scheduled-tasks-with-arguments suite` (37 tests) all PASS. Implementer's deliberate non-edit of [`scheduler.js`](../../src/manage/taskQueue/queue/scheduler.js:91) honors ADR 0022 §"Files NOT to edit". | ✅ |
| **AC #6** ADR 0012 amendment matches actual behavior | T5 (cross-state ack), T6 (mechanism docs), T7 (cross-ref), T8 (Cons trade-off note) all pass against amended ADR 0012. In-place amendment per ADR 0022's preference. | ✅ |
| **AC #7** no-downtime deploy | Not unit-testable; covered by ADR 0022's deployment dry-run analysis and the cycle-staging/cycle-prod skill runs. Implementer's container-restart smoke confirmed brainstorm boots cleanly with `[task-queue] Initialized 54 queues + workers`. | ✅ (cycle-local verifies in deploy) |

- [x] Every acceptance criterion has a passing test or documented behavioral verification.
- [x] No criterion is silently dropped.
- [x] No behavior added that isn't in the story.

## ADR adherence (ADR 0022)

- [x] **Files changed match ADR 0022 §Implementation 1.** Single edit at [`src/manage/taskQueue/queue/index.js:185`](../../src/manage/taskQueue/queue/index.js:185); the options object gains `removeOnComplete: true, removeOnFail: true` exactly as the ADR specified, with `jobId` preserved and the JSDoc rewritten to describe the wait/active-only enforcement.
- [x] **ADR 0012 amendment matches §Implementation 2.** In-place edit (per agreed amendment shape); Dedup section rewritten to acknowledge cross-state dedup + document the mechanism + cross-reference ADR 0022; Cons list gains the BullBoard visibility note.
- [x] **BIBLE.md / OPERATIONS.md sweep done per §Implementation 3.** BIBLE.md §24 Topology paragraph clarifies the wait/active-only window + ADR 0022 added to the ADR index. OPERATIONS.md correctly left untouched — its only dedup mention is "Per-`(taskName, pubkey)` jobId dedup → unchanged" (line 542) in the resource-class section, which remains accurate post-fix (the mechanism IS unchanged; only the lifecycle of finalized jobs changed).
- [x] **Empirical probe written per §Pre-implementation empirical probe.** [`test/probe-bullmq-removeOnComplete-immediate.js`](../../test/probe-bullmq-removeOnComplete-immediate.js) implements the 7-step pattern; both Paths (completed + failed) verified. Reviewer re-ran independently inside the container — 8/8 ASSERT-PASS.
- [x] **Files NOT to edit honored.** `scheduler.js`, `processor.js`, `resourceSemaphore.js` all untouched per ADR §"Files NOT to edit".
- [x] **Stretch goal handled responsibly.** Deferred per ADR's "Defer if" criteria — follow-up intake filed at `engineering-team/stories/_intake.md` (entry `2026-05-24 — Cleanup: scheduled-fire job retention`). Decision rationale captured: probe + test plan were scoped to manual-trigger path; bundling would require extending both. This matches the discipline expected by the role doc.
- [x] **No new dependencies, no new infrastructure.** No `package.json` change; no new env vars; no new config files.

## Concept-graph integrity

- [x] **No concept handles touched.** ADR 0012 + ADR 0022 + story #25 all confirm task-queue subsystem has no concept-graph footprint. Architect and Implementer both attempted `http://localhost:8877/api/concept-graph/summaries` and noted the local stack wasn't running; codebase-wide search confirmed no new handles. **Firmware reinstall: not required.**
- [x] **No code added that re-derives from BIBLE.md.** The only doc edit reads ADR 0012 itself, not BIBLE.md or firmware JSON.

## Things tests can't catch

- [x] **No secrets in committed files.** Verified via diff scan — only code, docs, tests; no credentials, tokens, or pubkeys beyond what was already there.
- [x] **No leftover debug logging.** The probe's `console.log` lines are intentional output for operator-readable PASS/FAIL reporting.
- [x] **No commented-out code.** Clean.
- [x] **Error paths handled.** Probe wraps `main()` in `.catch(e => { console.error...; process.exit(2); })`. Production code's only change is options on `queue.add`; failure modes are the same as before (BullMQ throws on unreachable Redis, already handled via the 503 path in `runTask.js`).
- [x] **Concurrency considered.** The new options affect *finalization-time* behavior, not the *add-time* dedup mechanism — `active` jobs still dedup at add time (preserving AC #4). Probe's invocation-counter pattern correctly distinguishes fresh-execution from dedup-return.
- [x] **Security.** No new endpoints, no new input parsing surface, no auth changes. `/api/run-task`'s authentication posture (unauthenticated per ADR 0012 §Out of scope) is unchanged.
- [x] **Deploy hazards reviewed.** ADR 0022 §"Deployment dry-run analysis" walks the cycle-staging → cycle-prod path moment-by-moment. Reviewer concurs: per-job options are written to the Redis hash at add time, so legacy in-Redis jobs from before the deploy keep their original options (default-keep) and tolerably block re-trigger for their jobId until cleared via BullBoard — exactly as story #25 §Out of scope accepts.

## House rules check

- [x] **Concept Graph API authority respected.** No concept-graph reads/writes (correctly — none are needed).
- [x] **No new lint/typecheck/build tooling.** Diff adds zero infrastructure.
- [x] **JS-without-build preserved.** Source change is plain JS; tests use the existing hand-rolled runner.

## Findings

### Blocking

_None._

### Non-blocking

1. **[`test/probe-bullmq-removeOnComplete-immediate.js:43-51, 52-60`](../../test/probe-bullmq-removeOnComplete-immediate.js:43)** — two helper functions `assertNeq` and `assertGt` are defined but unused after the Implementer revised the probe (the original version used `assertNeq` for a `job.id` comparison that was correctly identified as buggy and replaced with `assertEq` on the Worker invocation counter; see the probe header comment lines 86-88). Optional cleanup: remove the unused helpers. Non-blocking because the probe is a one-shot research script not in the regression suite; dead code there has near-zero cost.

2. **[`engineering-team/stories/25-manual-task-retrigger-after-finish.md:3`](../stories/25-manual-task-retrigger-after-finish.md:3)** — Story Status field is still `Draft`. Optional update: change to `Done` on PASS verdict. This is a paperwork convention question; previous stories in the repo show mixed handling (some updated to `Done`, others left at the original status), so non-blocking. The reviewer-side authoritative signal is this review file.

3. **[`engineering-team/decisions/0012-task-queue-phase-1-bullmq.md:7`](../decisions/0012-task-queue-phase-1-bullmq.md:7)** — ADR 0012's top-of-file `**Status:**` field is still `Proposed`. Amending the Dedup section in place didn't change the overall ADR status, which is fine, but the document is now a hybrid of the original ADR text + an inline amendment from ADR 0022. Optional improvement: add an `**Amended:** 2026-05-24 by ADR 0022 (§Dedup, §Option A Cons)` line near the top so readers see the amendment trail without having to scroll. Non-blocking because the amendment is already cross-referenced inline at the affected points.

## Verdict

**PASS.**

The implementation is the minimum change that satisfies all 7 acceptance criteria. It matches ADR 0022's design verbatim — single-line code edit at the documented site, in-place amendment of ADR 0012 + BIBLE.md, no scope creep into `scheduler.js` (correctly punted to a separate intake), and a working empirical probe that independently confirms BullMQ's installed-version behavior. The full test suite is green (222 tests across 21 suites), and the probe re-run inside the container reproduces 8/8 ASSERT-PASS for both completed and failed paths. Three non-blocking observations above are paperwork or hygiene; none affect correctness, deployability, or operator-facing behavior.

Ready for the standard deploy chain: `cycle-staging` first, then `cycle-prod` on user approval. AC #4 (customer concurrent-fire dedup) and AC #7 (no-downtime deploy) get their final behavioral verification during those cycles per the test plan.
