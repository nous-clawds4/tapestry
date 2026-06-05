# Review: Story 27 — Scheduled tasks bypass configured timeouts (restoring `neo4j-heavy` semaphore contract)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-25
**Diff:** `git diff origin/staging...HEAD` (tip commit `52457d2f`)
**Branch:** `staging` (4 commits ahead of `origin/staging`)
**Story:** [`engineering-team/stories/27-scheduled-task-timeout-propagation.md`](../stories/27-scheduled-task-timeout-propagation.md)
**ADR:** [`engineering-team/decisions/0024-scheduled-task-timeout-propagation.md`](../decisions/0024-scheduled-task-timeout-propagation.md)
**Test plan:** [`engineering-team/stories/27-scheduled-task-timeout-propagation.test-plan.md`](../stories/27-scheduled-task-timeout-propagation.test-plan.md)

## Quality gates (run independently by reviewer, not trusted)

- [x] `npm test` — **PASS** (23 suites, 233 individual tests; `scheduled-task-timeout-propagation suite: PASS (11 passed, 0 failed)`; Overall: PASS).
- [x] Empirical probe `test/probe-scheduled-task-timeout-propagation.js` re-run inside container — **PASS** (5/5 ASSERT-PASS across Path 1 + Path 2; exit 0; `bash` + `jq` against `/var/log/brainstorm/taskQueue/events.jsonl`).
- [x] `git diff origin/staging...HEAD -- src/manage/taskQueue/taskRegistry.json` — **empty** (no registry edits, deliberately, per ADR 0024 §"Not touched").
- [x] Diff scope verification: no files edited outside `engineering-team/`, `test/`, or the three named source files. Verified via `git diff origin/staging...HEAD --name-only`.
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped._

## Spec adherence (story #27's 7 acceptance criteria)

| AC | Coverage | Verified |
|---|---|---|
| **AC #1** Configured timeout reaches wrapper for `"options": {}` tasks | S1 sentinel ([scheduler.js:27](../../src/manage/taskQueue/queue/scheduler.js:27) requires `resolveTaskTimeout`) + S2 sentinel ([scheduler.js:87](../../src/manage/taskQueue/queue/scheduler.js:87) destructures `timeoutMs` from `resolveTaskTimeout(taskDef, registry)`) + U1 unit test (utility returns the registry default for empty-options task) + U3 unit test (utility never returns 0 when a default is present). | ✅ |
| **AC #2** No spurious `error_type: "timeout"` with `elapsed_time: 5000` for healthy fires | S3 sentinel ([processor.js:118-126](../../src/manage/taskQueue/queue/processor.js:118) — `optionsJson` is conditional on `timeoutMs > 0`) + S4 sentinel ([launchChildTask.sh:385](../../src/manage/taskQueue/launchChildTask.sh:385) — guard `timeout_seconds -gt 0`) + **probe Path 1** (5/5 ASSERT-PASS: `timeoutMs=0` against 8s sleep → CHILD_TASK_END emitted, NO CHILD_TASK_ERROR error_type=timeout, wrapper elapsed within tolerance of script duration). | ✅ |
| **AC #3** Genuine timeout still works | S4 sentinel (the guard preserves positive-timeout behavior) + **probe Path 2** (5/5 ASSERT-PASS: `timeoutMs=5000` against 15s sleep → CHILD_TASK_ERROR error_type=timeout, `elapsed_time=5000` exactly). | ✅ |
| **AC #4** Semaphore `held_seconds` matches actual work on scheduled path | R1 sentinel ([queue/index.js:115-131](../../src/manage/taskQueue/queue/index.js:115) — ADR 0013 wrap preserved). End-to-end behavioral verification deferred to **cycle-staging smoke** per test plan (same evidence shape that surfaced the original bug: tail launchChildTask.log + grep `resource_class_released.held_seconds` in events.jsonl). | ✅ (cycle-local verifies in deploy) |
| **AC #5** Same on manual `/api/run-task` path | R1 sentinel (same wrap). **Already correct pre-fix** for the manual path because runTask.js was already using `resolveTaskTimeout` ([runTask.js:110](../../src/api/manage/commands/runTask.js:110)) — the scheduled path was the broken one. The fix's correctness on the manual path is implicit (the wrap site is shared). cycle-staging smoke verifies. | ✅ (cycle-local verifies in deploy) |
| **AC #6** cap=1 serialization observable | R2 sentinel ([resourceSemaphore.js:115-137](../../src/manage/taskQueue/queue/resourceSemaphore.js:115) — three phase tokens `resource_class_wait_begin` / `wait_end` / `released` still emitted via `emitTaskEvent`). cycle-staging smoke verifies two-task back-to-back serialization. | ✅ (cycle-local verifies in deploy) |
| **AC #7** Per-task explicit timeout overrides still win | U2 unit test (`resolveTaskTimeout({options:{completion:{failure:{timeout:{duration:600000}}}}}, registry)` returns 600000, not the global 1800000). | ✅ |

- [x] Every acceptance criterion has a passing test or documented behavioral verification.
- [x] No criterion is silently dropped.
- [x] No behavior added that isn't in the story.

## ADR adherence (ADR 0024)

- [x] **Files changed match ADR 0024 §"Implementation notes" exactly.** Three files, three edits:
  - [`src/manage/taskQueue/queue/scheduler.js`](../../src/manage/taskQueue/queue/scheduler.js) — require + destructured call. Diff: +1, -3.
  - [`src/manage/taskQueue/queue/processor.js`](../../src/manage/taskQueue/queue/processor.js) — conditional `optionsJson` with `'{}'` fallback. Diff: +9, -10. **The `forceKill: false` hardcode is preserved** in the positive-timeout branch, matching the ADR's explicit instruction to keep it (story scopes out reconsidering).
  - [`src/manage/taskQueue/launchChildTask.sh`](../../src/manage/taskQueue/launchChildTask.sh) — one-line guard at the monitor loop. Diff: +1, -1.
- [x] **Files NOT touched** (per ADR 0024 §"Not touched (deliberately)"): `taskRegistry.json`, `resourceSemaphore.js`, `queue/index.js`, `runTask.js`, `taskTimeout.js`. Verified via `git diff` — all unchanged.
- [x] **No new dependencies, no new infrastructure.** No `package.json` change; no new env vars; no new config files; no new lint/typecheck/build tooling.
- [x] **Layering preserved.** scheduler.js's `upsertSchedule` still produces a job-data payload of `{ taskName, entryId, timeoutMs }` (ADR 0021's load-bearing layering choice); only the source of `timeoutMs` changed from a buggy inline lookup to a shared utility call. processor.js's caller-to-wrapper interface is now cleaner (no false override when caller has no value) but otherwise unchanged. launchChildTask.sh's hierarchical-options merge is unchanged — the guard sits inside the monitor loop, not in the merge logic.
- [x] **Three-layer defense-in-depth honored.** All three layers fixed at their own surface; each independently corrects one of the three semantic mismatches the ADR catalogued.

## Concept-graph integrity

- [x] **No concept handles touched.** ADR 0010 + ADR 0013 + ADR 0021 + ADR 0024 all confirm task-queue subsystem has no concept-graph footprint. Reviewer-side `curl http://localhost:8877/api/concept-graph/summaries` from the Architect phase returned empty (local stack not reachable from this session). Codebase scan confirms no new handles. **Firmware reinstall: not required.**
- [x] **No code added that re-derives from BIBLE.md.** The implementation reads only the shared `resolveTaskTimeout` utility + existing registry JSON it was already reading.

## Things tests can't catch

- [x] **No secrets in committed files.** Diff is pure code + docs + tests; no credentials, tokens, or pubkeys beyond what was already there.
- [x] **No leftover debug logging or `console.log`.** The probe's `console.log` lines are intentional operator-readable output. The wrapper script's existing `echo "$(date): Starting monitoring loop for PID $child_pid (timeout: ${timeout_seconds}s)"` log line is unchanged — and remains a useful post-fix diagnostic (if `timeout: 0s` ever shows up in production logs post-fix, that's evidence of a regression).
- [x] **No commented-out code.** Clean. The old `|| 0` block in scheduler.js and the unconditional optionsJson in processor.js are gone, not commented out.
- [x] **Error paths handled.** The probe wraps its main flow in a try/finally that always calls `removeProbeScript()` + `restoreRegistry()` — registry mutation is reversible even on crash. Production code's failure modes are unchanged: `enqueueTask` still 503s on Redis unreachable; `upsertSchedule` still propagates queue construction errors; `resolveTaskTimeout` returns a bounded value (5-min min, 24-hr max) so wildly wrong inputs are clamped, not propagated.
- [x] **Concurrency considered.** ADR 0013's `try { processJob } finally { release }` wrap is preserved — semaphore release is still tied to the Node-side child process exit. The fix only makes that exit happen at the right time (when the actual task work completes, not at 5s). No new concurrency surface.
- [x] **Security.** No new endpoints, no new input parsing surface, no auth changes. The probe modifies `taskRegistry.json` under backup/restore; the modification adds a probe-only task whose script lives at `/tmp/probe-script-<stamp>.sh` — both paths are inside the container, neither is operator-visible or reachable via HTTP.
- [x] **Deploy hazards reviewed.** The fix is in-process — no migration, no Redis state to clear, no operator action required. On deploy, the next scheduled task fire will pick up the fixed scheduler.js → processor.js → launchChildTask.sh chain immediately. Pre-deploy in-flight jobs (started under the broken wrapper) are not retroactively fixed; they'll continue running orphaned until their work completes (which is exactly what they were doing anyway). No-downtime; no operator-visible regression.

## House rules check

- [x] **Concept Graph API authority respected.** No concept-graph reads/writes (correctly — none are needed).
- [x] **No new lint/typecheck/build tooling.** Diff adds zero infrastructure.
- [x] **JS-without-build preserved.** Source changes are plain JS + bash; tests use the existing hand-rolled runner.
- [x] **Docker stack context honored.** The probe runs via `docker exec tapestry ...` per CLAUDE.md's "stack runs in Docker" rule; events.jsonl path inside the container matches the operator-discovered location (`/var/log/brainstorm/taskQueue/events.jsonl`).

## Findings

### Blocking

_None._

### Non-blocking

1. **[`src/manage/taskQueue/queue/processor.js:118`](../../src/manage/taskQueue/queue/processor.js:118)** — the conditional `(timeoutMs && timeoutMs > 0)` is mildly redundant: `timeoutMs > 0` alone correctly handles `null`/`undefined`/`0` (all three comparisons evaluate to `false`). The dual guard matches the ADR's suggested sketch verbatim, so it's intentional and defensive. Optional simplification: drop the `timeoutMs &&` prefix. Style preference; non-blocking.

2. **[`src/manage/taskQueue/queue/scheduler.js:87`](../../src/manage/taskQueue/queue/scheduler.js:87)** — the pre-fix code defensively short-circuited if `taskDef === undefined` (returning `0`); the new code would throw on `taskDef.options` access inside `resolveTaskTimeout`. In practice this edge case is unreachable: `reconcileSchedules` ([scheduler.js:190-192](../../src/manage/taskQueue/queue/scheduler.js:190)) explicitly checks `registered = !!(registry && registry.tasks && registry.tasks[entry.taskId])` before calling `upsertSchedule`, and the two API call sites ([scheduled-tasks/index.js:341, :398](../../src/api/scheduled-tasks/index.js:341)) wrap the call in try/catch that returns 503 on any throw. So the new "loud failure on bad input" behavior is contained — but it IS a strictness change from the old "silent 0" behavior, and arguably more correct (the bug we're fixing was caused by silent zero-propagation). Worth being aware of; non-blocking.

3. **[`test/probe-scheduled-task-timeout-propagation.js:177-181`](../../test/probe-scheduled-task-timeout-propagation.js:177)** — Path 1's tolerance is ±4000ms around the 8000ms expected (12.5–50% margin); independent runs measured 10.7s and 11.5s. The overhead is bash + jq + structured-event emission; the wide tolerance accommodates it. Optional tightening: shrink to ±3000ms once the operator has more data points across container loads. Non-blocking; the assertion correctly distinguishes "wrapper ran for the script's full duration" from "wrapper exited at 5s (the bug)."

4. **[`engineering-team/stories/27-scheduled-task-timeout-propagation.md:3`](../stories/27-scheduled-task-timeout-propagation.md:3) and [`engineering-team/decisions/0024-scheduled-task-timeout-propagation.md:3`](../decisions/0024-scheduled-task-timeout-propagation.md:3)** — Story Status and ADR Status are both still `Draft` / `Proposed` respectively. Optional paperwork update: change to `Done` / `Accepted` on PASS. Previous stories show mixed handling (some updated, some not); the authoritative signal is this review file. Non-blocking.

5. **Held-branch decision is correctly deferred** (per story #27 §"Out of scope" and ADR 0024 §"Out of scope"). After this fix verifies on staging + prod, the `fix/launch-child-task-protection-audit` branch's tag-additions for `processAllTasks` and `processNpubsUpToMaxNumBlocks` become load-bearing again — but that decision belongs to a separate follow-up story, not this PR. Reviewer concurs with the deferral. Non-blocking observation.

## Verdict

**PASS.**

The implementation is the minimum diff that satisfies all 7 acceptance criteria and matches ADR 0024 §"Implementation notes" verbatim — three files, three intent-aligned edits, ~25 lines net (11 additions, 14 deletions). The shared `resolveTaskTimeout` utility adoption closes the DRY violation that originally caused the bug; the conditional `optionsJson` in processor.js cleanly separates "caller has an override" from "caller has nothing to say"; the wrapper-script guard makes `timeout_seconds=0` mean "no timeout" (Unix convention) instead of the buggy "timeout at first tick."

Quality gates are clean: 23 host suites PASS (233 individual tests), the in-container probe re-runs 5/5 ASSERT-PASS for both bug-case (Path 1) and genuine-timeout (Path 2) paths, and the implementation diff is scoped exactly to the three files the ADR authorized. Regression guards (R1 ADR 0013 wrap, R2 semaphore phase tokens, U1-U3 `resolveTaskTimeout` contract) all remain green by design.

End-to-end behavioral verification of AC #4 / #5 / #6 (semaphore `held_seconds` matches actual work; cap=1 serialization observable) is correctly deferred to cycle-staging — the same evidence shape that surfaced the original bug (tail launchChildTask.log + grep `resource_class_released.held_seconds` in events.jsonl) is the right verification surface, and it can only run against the live Docker stack with a real scheduled task fire.

Five non-blocking observations above are paperwork, style, or future-tightening; none affect correctness, deployability, or operator-facing behavior.

Ready for the standard deploy chain: `cycle-staging` first, then on user approval `cycle-prod`. After both verify, schedule the follow-up story on the held branch's fate.
