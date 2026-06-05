# Test Plan: Story 27 — Scheduled tasks bypass configured timeouts (restoring `neo4j-heavy` semaphore contract)

**Story:** `engineering-team/stories/27-scheduled-task-timeout-propagation.md`
**ADR:** `engineering-team/decisions/0024-scheduled-task-timeout-propagation.md`
**Date:** 2026-05-25

## Approach

ADR 0024's chosen fix is defense-in-depth across three files (scheduler.js + processor.js + launchChildTask.sh, ~25 lines of code total). The fix is mechanically small but spans Node + bash, the BullMQ worker callback, and a real-time monitor loop. Three test tiers — matching the precedent set by story #15 (resource-class semaphore tests), story #24 (scheduler tests), and story #25 (manual re-trigger tests):

1. **Structural sentinels + unit tests** in `test/scheduled-task-timeout-propagation.test.js` — pin the three source-level fix points + verify the existing `resolveTaskTimeout` utility's hierarchical-resolution contract. Pure file-read + regex + a few unit calls into `src/utils/taskTimeout.js`. Run on the host via `npm test`; no Redis, no BullMQ, no Docker stack required.
2. **Empirical probe** at `test/probe-scheduled-task-timeout-propagation.js` — one-shot Node script that exercises the **actual** `launchChildTask.sh` against a temporary probe task. Confirms the wrapper-script fix works end-to-end against the installed bash + jq + structured-logging machinery. Runs inside the `tapestry` container; not registered in `test/test.js` (one-shot empirical check, not a regression test). The sentinels in tier 1 protect the probe's existence + shape.
3. **Cycle-local smoke** for the end-to-end integration (real BullMQ Worker callback → semaphore.acquire → processor.processJob → spawn launchChildTask.sh → release → events.jsonl `held_seconds` matches actual duration; cap=1 serialization observable across two tagged tasks). Exercised at `cycle-staging` and `cycle-prod` deploy time. No automated assertion; behavior is observed during deploy verification using the same evidence pattern that surfaced the original bug (tail launchChildTask.log + grep events.jsonl).

This split matches stories #13, #15, #22, #24, and #25 — the project deliberately keeps BullMQ semantics out of the host unit suite (no host BullMQ installation), and Docker-stack tests are run as probes + cycle-local smoke rather than CI.

## Coverage map

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| **AC #1** Configured timeout reaches wrapper for tasks with `"options": {}` | S1: `scheduler.js requires resolveTaskTimeout from ../../../utils/taskTimeout` | `test/scheduled-task-timeout-propagation.test.js` | structural sentinel |
| **AC #1** | S2: `scheduler.js calls resolveTaskTimeout(taskDef, registry) inside upsertSchedule and destructures timeoutMs` | `test/scheduled-task-timeout-propagation.test.js` | structural sentinel |
| **AC #1** (contract regression guard — PASSES pre and post) | U1: `resolveTaskTimeout(taskWithEmptyOptions, registry) returns the registry's options_default.completion.failure.timeout.duration` | `test/scheduled-task-timeout-propagation.test.js` | unit |
| **AC #1** (anti-regression on the specific bug) | U3: `resolveTaskTimeout(taskWithEmptyOptions, registryWithDefault).timeoutMs is > 0` | `test/scheduled-task-timeout-propagation.test.js` | unit |
| **AC #2** No spurious `error_type: "timeout"` with `elapsed_time: 5000` for healthy fires | S3: `processor.js's optionsJson construction is conditional on timeoutMs > 0` (don't ship 0 as a real override) | `test/scheduled-task-timeout-propagation.test.js` | structural sentinel |
| **AC #2** | S4: `launchChildTask.sh contains the timeout_seconds -gt 0 guard in the monitor-loop timeout check` | `test/scheduled-task-timeout-propagation.test.js` | structural sentinel |
| **AC #2** (behavioral confirmation) | probe Path 1 — invoke wrapper with `timeoutMs: 0`; assert events.jsonl contains a `CHILD_TASK_END` for this run AND does NOT contain a `CHILD_TASK_ERROR error_type="timeout"` for this run | `test/probe-scheduled-task-timeout-propagation.js` | empirical probe (Implementer-run inside container) |
| **AC #3** Genuine timeout still works | S4 (same) — the guard makes timeout=0 mean "no timeout" but leaves positive-timeout behavior intact | `test/scheduled-task-timeout-propagation.test.js` | structural sentinel |
| **AC #3** (behavioral confirmation) | probe Path 2 — invoke wrapper with `timeoutMs: 5000` against a 15-second sleep script; assert events.jsonl contains a `CHILD_TASK_ERROR error_type="timeout"` whose `elapsed_time` is approximately 5000 (within tolerance) | `test/probe-scheduled-task-timeout-propagation.js` | empirical probe |
| **AC #4** Semaphore `held_seconds` matches actual work on scheduled path | R1: `queue/index.js's Worker callback still wraps tagged tasks with semaphore.acquire / release in try-finally` (regression guard — fix mustn't accidentally remove ADR 0013's wrap) | `test/scheduled-task-timeout-propagation.test.js` | regression guard |
| **AC #4** (behavioral confirmation) | cycle-staging smoke: trigger a scheduled `processCustomer` fire on staging; grep events.jsonl for the run's `resource_class_released.held_seconds`; assert close to actual processCustomer duration (~30–60 min, not ~6s). Same evidence shape the original bug was found with. | cycle-local smoke | manual |
| **AC #5** Same on manual `/api/run-task` path | R1 (same) | `test/scheduled-task-timeout-propagation.test.js` | regression guard |
| **AC #5** (behavioral confirmation) | cycle-staging smoke: trigger a tagged task via `POST /api/run-task?taskName=updateAllScoresForOwner`; grep same `held_seconds` shape as AC #4 | cycle-local smoke | manual |
| **AC #6** cap=1 serialization observable | R2: `resourceSemaphore.js still emits resource_class_wait_begin, resource_class_wait_end, resource_class_released phase tokens via emitTaskEvent` (regression guard on the observability surface AC #6 relies on) | `test/scheduled-task-timeout-propagation.test.js` | regression guard |
| **AC #6** (behavioral confirmation) | cycle-staging smoke: trigger two tagged tasks back-to-back; grep events.jsonl; assert the second task's `resource_class_wait_end outcome="acquired"` timestamp is **after** the first task's `resource_class_released` timestamp, with a non-zero wait | cycle-local smoke | manual |
| **AC #7** Per-task explicit timeout overrides still win | U2: `resolveTaskTimeout(taskWithExplicitOverride, registry) returns the task's own value, NOT the global default` | `test/scheduled-task-timeout-propagation.test.js` | unit |
| **ADR mandate**: probe script exists | P0: `probe script exists at test/probe-scheduled-task-timeout-propagation.js` | `test/scheduled-task-timeout-propagation.test.js` | structural sentinel |
| **ADR mandate**: probe script shape | P1: `probe script exercises both bug-case (timeoutMs=0) and genuine-timeout (timeoutMs=5000) paths and asserts against events.jsonl` | `test/scheduled-task-timeout-propagation.test.js` | structural sentinel |

## Edge cases

Beyond the AC-driven coverage above, the following edges are surfaced — some deliberately deferred to cycle-local smoke:

- [ ] **Wrapper-script "timeout=0 means no timeout" semantic change.** Before the fix, `timeout_seconds=0` trivially fired at first tick. After the fix, it means "monitor indefinitely." Any test or operational use that relied on the pre-fix behavior to force a quick exit would break. None known. The probe's Path 1 explicitly verifies the new behavior; the source-sentinel S4 protects against future regression.

- [ ] **Per-task averageDuration heuristic** (resolveTaskTimeout Priority 3). The utility falls through to `task.averageDuration × 2` when neither task-specific nor global-default timeout is set. Not exercised by ACs (every task with averageDuration also tends to have one of the other priorities), but the utility's fallback chain is tested via U1/U2 implicitly. Worth noting that a future task without options AND without options_default AND with averageDuration would get the heuristic, NOT 0 — the bug specifically required the registry's options_default to be present (which it is today).

- [ ] **Min/max bound enforcement** (resolveTaskTimeout's MIN_TIMEOUT_MS / MAX_TIMEOUT_MS). The utility clamps to 5 min / 24 hours. Tests use values within those bounds (1800000 / 600000) so clamping doesn't interfere. Not a behavioral concern for this story.

- [ ] **forceKill behavior on genuine timeout.** Story #27 explicitly scopes out reconsidering `forceKill: false`. After the fix, a genuinely-timed-out task (Path 2 in the probe) is correctly identified as timed out — but the child process is NOT killed (status quo). Operators will see a `CHILD_TASK_ERROR error_type="timeout"` event but the underlying script keeps running. The probe Path 2 verifies the event fires correctly; it does not assert the child process was killed (because that's not in scope).

- [ ] **The held branch (`fix/launch-child-task-protection-audit`) tag-additions.** Out of scope for this story (per AD R0024 §"Out of scope"). After this fix lands on staging + prod, the held branch's tag-additions for `processAllTasks` and `processNpubsUpToMaxNumBlocks` become load-bearing again — but that's a follow-up decision, not part of story #27's success criteria.

- [ ] **JS-exec API handler endpoints.** Separate intake (MEDIUM-HIGH), separate story. Not exercised by these tests. After this fix, the five endpoints in that intake still bypass BullMQ and the semaphore; that's a different problem.

- [ ] **Concurrent fires of the same task on the same Worker.** ADR 0013's `cap=1` covers cross-task serialization within a resource class; per-task concurrency (ADR 0010) covers same-task serialization. Both are independent of this fix. The probe doesn't exercise this; cycle-local smoke covers the end-to-end behavior.

## Test infrastructure

- **Test framework:** Node built-in runner via `npm test` (entry: `test/test.js`). No new dependencies.
- **Concept Graph API:** not used. Story #27 has no concept-graph impact (confirmed by ADR 0024).
- **Firmware state:** no precondition.
- **Fixtures:** the unit tests construct synthetic task/registry objects inline — no fixture files. The probe creates a temporary probe-only entry in `taskRegistry.json` (backup → modify → run → restore) and a temporary script in `/tmp`.
- **Local-vs-container split:**
  - The 11 sentinels + unit tests in `test/scheduled-task-timeout-propagation.test.js` are pure file-read + regex + direct calls into `src/utils/taskTimeout.js` — they run on the host with no runtime dependencies.
  - The probe at `test/probe-scheduled-task-timeout-propagation.js` requires `bash`, `jq`, the wrapper script's source dependencies, and a writable `events.jsonl` — all inside the `tapestry` container. Run via:
    ```
    docker exec tapestry node /usr/local/lib/node_modules/brainstorm/test/probe-scheduled-task-timeout-propagation.js
    ```
    Expected output: two ASSERT-PASS blocks (Path 1 and Path 2). If anything FAILs, the Implementer re-opens ADR 0024 with the probe output attached.

## How to run

```
npm test
```

For the empirical probe (after the Implementer has run the host suite and committed the fix):
```
docker exec tapestry node /usr/local/lib/node_modules/brainstorm/test/probe-scheduled-task-timeout-propagation.js
```

For AC #4 / #5 / #6 (cycle-staging then cycle-prod): use the `cycle-staging` skill, observe the `held_seconds` and `wait_end` events in `events.jsonl` per the evidence pattern that surfaced the original bug. Then on user approval, `cycle-prod` with the same observation pattern.

## Verification

The 11 sentinels + unit tests were committed against the pre-implementation tree on 2026-05-25. Pre-implementation state: **4 FAIL (S1, S2, S3, S4) + 7 PASS (U1, U2, U3, P0, P1, R1, R2)**. The four failing sentinels are the three fix-surface guards (one per file the Implementer touches) plus the wrapper-script guard. The seven passing tests are:

- **U1, U2, U3** — regression guards on the existing `resolveTaskTimeout` utility's contract. The fix's correctness depends on this contract, so these guards must remain green; the bug is that scheduler.js didn't *use* this utility, not that the utility itself is wrong.
- **P0, P1** — probe-file existence + shape guards. The Tester ships the probe alongside the sentinels (the probe is more complex than story #25's — it modifies the registry under backup/restore — so writing it now de-risks the Implementer's self-check step). After implementation these still pass; they're regression guards against accidental probe-file deletion.
- **R1, R2** — regression guards on the ADR 0013 semaphore wrap and the structured-events observability surface that AC #6's cycle-local smoke depends on. These must remain green; the fix only restores the wrap's *effective* duration, it must not remove the wrap.

Confirmed on 2026-05-25 (pre-implementation tree):

```
scheduled-task-timeout-propagation suite:
  ✗ S1: scheduler.js requires resolveTaskTimeout from ../../../utils/taskTimeout (AC #1; ADR 0024 §Implementation 1)
      scheduler.js must require '../../../utils/taskTimeout' (the shared hierarchical-timeout-resolution utility) so tasks with `"options": {}` in the registry get the global default timeout instead of falling through to 0. The same utility is already used by runTask.js; the bug was that scheduler.js rolled its own one-liner that didn't fall through to options_default. (AC #1; ADR 0024 §Implementation 1)
  ✗ S2: scheduler.js calls resolveTaskTimeout(taskDef, registry) inside upsertSchedule and destructures timeoutMs (AC #1; ADR 0024 §Implementation 1)
      scheduler.js's upsertSchedule must call `resolveTaskTimeout(taskDef, registry)` so the per-fire job-data payload carries the correctly-resolved timeoutMs. The pre-fix one-liner read only `taskDef.options.completion.failure.timeout.duration` and fell through to `0` — never honoring the registry's options_default. (AC #1; ADR 0024 §Implementation 1)
  ✗ S3: processor.js builds optionsJson conditionally on timeoutMs > 0 (AC #2; ADR 0024 §Implementation 2)
      processor.js must include an empty-options branch (`'{}'` or `"{}"`) for the case where `timeoutMs` is falsy/zero. Without this, the wrapper script's hierarchical-options merge always sees a per-invocation timeout = 0 and clobbers the global default. The fix omits the per-invocation timeout block entirely when there's no real value to ship. (AC #2; ADR 0024 §Implementation 2)
  ✗ S4: launchChildTask.sh monitor loop guards the timeout check with `timeout_seconds -gt 0` (AC #2, AC #3; ADR 0024 §Implementation 3)
      launchChildTask.sh's monitor-loop timeout check must include the `$timeout_seconds -gt 0` guard alongside the existing `$elapsed -ge $timeout_seconds` comparison. Without this guard, a per-invocation `timeout: { duration: 0 }` trivially trips at first iteration (5 >= 0 is TRUE), declaring 'timed out' and exiting while the backgrounded task continues — the precise bug story #27 fixes. The guard makes `timeout_seconds=0` mean 'no timeout, monitor indefinitely' (matching Unix convention: `timeout 0 cmd` doesn't timeout). (AC #2, AC #3; ADR 0024 §Implementation 3)
  ✓ U1: resolveTaskTimeout(taskWithEmptyOptions, registryWithGlobalDefault) returns the registry default duration (AC #1)
  ✓ U2: resolveTaskTimeout(taskWithExplicitOverride, registry) returns the per-task override, not the global default (AC #7)
  ✓ U3: resolveTaskTimeout(taskWithEmptyOptions, registryWithGlobalDefault).timeoutMs is greater than 0 (AC #1 — direct anti-regression on the specific bug)
  ✓ P0: empirical probe exists at test/probe-scheduled-task-timeout-propagation.js (ADR 0024 §Implementer self-check)
  ✓ P1: probe script exercises both Path 1 (timeoutMs=0 → no spurious timeout) and Path 2 (genuine timeout) and asserts against events.jsonl (ADR 0024 §Implementer self-check)
  ✓ R1: queue/index.js still wraps tagged-task Worker callback with semaphore.acquire / release in try-finally (AC #4, #5 — ADR 0013 wrap preserved)
  ✓ R2: resourceSemaphore.js still emits resource_class_wait_begin / wait_end / released phase tokens (AC #6 — observability surface preserved)

scheduled-task-timeout-propagation suite:        FAIL (7 passed, 4 failed)
Overall:                                         FAIL
```

All 4 failures fail for the right reason — they reference the absent fix in each of the three files the Implementer must touch (S1 + S2 cover scheduler.js, S3 covers processor.js, S4 covers launchChildTask.sh). The Implementer's success criterion: all 11 PASS after the three-layer fix lands; the probe runs cleanly inside the container with all ASSERTs PASSing.
