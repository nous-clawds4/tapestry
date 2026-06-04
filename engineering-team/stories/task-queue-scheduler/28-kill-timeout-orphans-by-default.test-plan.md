# Test Plan: Story 28 — Kill timeout-orphans by default so they stop suppressing subsequent scheduled fires

**Story:** `engineering-team/stories/28-kill-timeout-orphans-by-default.md`
**ADR:** `engineering-team/decisions/0025-kill-timeout-orphans-by-default.md`
**Date:** 2026-05-25

## Approach

ADR 0025's chosen fix is a two-layer change across `taskRegistry.json` (flip global default `forceKill: true`) + `queue/processor.js` (omit the hardcoded per-invocation `forceKill: false`). The mechanically-changed surface is tiny — under 5 lines of code — but the bug shape is operational (orphan persists past wrapper exit; next fire is silently suppressed by `check_task_already_running`), so behavioral verification needs to actually exercise the wrapper script's resolved kill behavior.

Three test tiers — matching the precedent set by stories #15 (resource-class semaphore tests), #24 (scheduler tests), #25 (manual re-trigger tests), and #27 (timeout-propagation tests):

1. **Structural sentinels + intake sentinel** in `test/kill-timeout-orphans-by-default.test.js` — pin the two source-level fix points (registry default + processor.js literal) and the ADR-mandated follow-up intake. Pure file-read + JSON-parse + regex. Run on the host via `npm test`; no Redis, no BullMQ, no Docker stack required.

2. **Regression guards** in the same file — verify the wrapper script's existing `force_kill` block + CHILD_TASK_ERROR emit + queue/index.js's semaphore wrap + the 11 per-task `forceKill: false` overrides ALL remain unchanged. ADR 0025 §Decision specifies the 11 overrides as explicit non-changes (Architect chose Option A over D); this guard prevents accidental scope creep into Option D territory.

3. **Empirical probe** at `test/probe-kill-timeout-orphans.js` — one-shot Node script that exercises the **actual** `launchChildTask.sh` against a temporary probe task. Confirms two behavioral claims: (Path 1) after wrapper-script timeout, the child PID is dead (kill happened); (Path 2) the immediately-next invocation of the same task is allowed to launch (no `TASK_LAUNCH_PREVENTED`). Runs inside the `tapestry` container; not registered in `test/test.js` (one-shot empirical check, not a regression test). The P0/P1 sentinels in tier 1 protect the probe's existence + shape.

This split matches the precedent of stories #15, #22, #24, #25, #27 — the project deliberately keeps BullMQ semantics out of the host unit suite (no host BullMQ installation), and Docker-stack tests are run as probes + cycle-local smoke rather than CI.

The cycle-local smoke at deploy time (AC #5) verifies the no-downtime deploy profile end-to-end — same evidence pattern that surfaced the original bug (operator-observed orphans via `pgrep -f`; `TASK_LAUNCH_PREVENTED` events in `events.jsonl`).

## Coverage map

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| **AC #1** Timeout produces a kill (no surviving orphan PID) | S1: `taskRegistry.json's options_default.completion.failure.timeout.forceKill === true` | `test/kill-timeout-orphans-by-default.test.js` | structural sentinel |
| **AC #1** | S2: `processor.js's optionsJson literal omits the forceKill field entirely (lets hierarchical merge resolve it)` | `test/kill-timeout-orphans-by-default.test.js` | structural sentinel |
| **AC #1** (behavioral confirmation) | probe Path 1 — invoke wrapper with `timeoutMs: 5000` against a 15-second sleep script (NO per-invocation forceKill); assert `ps -p $childPid` returns dead after wrapper exit AND events.jsonl contains a `CHILD_TASK_ERROR error_type="timeout"` for this run | `test/probe-kill-timeout-orphans.js` | empirical probe (Implementer-run inside container) |
| **AC #2** Next scheduled fire runs (no `TASK_LAUNCH_PREVENTED`) | probe Path 2 — immediately after Path 1, re-invoke wrapper with same task name; assert events.jsonl contains a `CHILD_TASK_START` for the second run AND does NOT contain a `TASK_LAUNCH_PREVENTED` between Path 1's `CHILD_TASK_ERROR` and the second run's `CHILD_TASK_START` | `test/probe-kill-timeout-orphans.js` | empirical probe |
| **AC #3** Operator visibility via existing `CHILD_TASK_ERROR` events | R2: `launchChildTask.sh still emits CHILD_TASK_ERROR event with error_type="timeout"` (regression guard — fix must not change the emit shape) | `test/kill-timeout-orphans-by-default.test.js` | regression guard |
| **AC #3** (transitive) | probe Path 1 (same) — the kill assertion is paired with verifying the `CHILD_TASK_ERROR error_type="timeout"` event lands, which proves the existing observability surface still carries the timeout signal | `test/probe-kill-timeout-orphans.js` | empirical probe |
| **AC #4** Uniform across all wrapper invocation paths | S1 (registry default reaches all paths) + S2 (processor.js stops asserting per-invocation forceKill, so per-task and global default win for the BullMQ-mediated path) | `test/kill-timeout-orphans-by-default.test.js` | structural sentinel (combined) |
| **AC #4** (regression guard on the wrapper-side kill mechanism) | R1: `launchChildTask.sh's force_kill block at :402-412 still reads from resolved_options and conditionally executes kill -9` (the wrapper's kill machinery must be preserved — the fix only flips the resolved default, the kill path must still work) | `test/kill-timeout-orphans-by-default.test.js` | regression guard |
| **AC #4** (regression guard on ADR 0013 wrap) | R3: `queue/index.js still wraps tagged-task Worker callback with semaphore.acquire / release in try-finally` (ADR 0013 wrap preserved — story #28 must not regress story #15's contract) | `test/kill-timeout-orphans-by-default.test.js` | regression guard |
| **AC #5** No-downtime deploy / no manual cleanup | cycle-staging smoke: deploy to staging; verify brainstorm container restarts cleanly; verify no pre-existing in-flight tasks are killed/disrupted by the deploy itself; on user approval, cycle-prod with the same check | cycle-local smoke | manual |
| **ADR 0025 Decision: 11 per-task overrides preserved** | R4: `the 11 per-task forceKill: false overrides remain unchanged in taskRegistry.json` (Architect chose Option A over Option D — the cleanup of these overrides is explicitly deferred to a follow-up intake; this guard prevents scope creep) | `test/kill-timeout-orphans-by-default.test.js` | regression guard |
| **ADR 0025 §"Intake to file at commit time"** | I1: `_intake.md contains the "## 2026-05-25 — Cleanup + Bug: per-task forceKill: false overrides after story #28's default-flip" section header at end of file` (the Implementer copies the intake block verbatim from ADR 0025 at commit time — same pattern as ADR 0023's amendment block) | `test/kill-timeout-orphans-by-default.test.js` | structural sentinel |
| **ADR 0025 §"Implementer self-check"** (implied) | P0: `empirical probe exists at test/probe-kill-timeout-orphans.js` | `test/kill-timeout-orphans-by-default.test.js` | structural sentinel |
| **ADR 0025 §"Implementer self-check"** | P1: `probe script exercises both Path 1 (kill verification) and Path 2 (next-fire-runs verification) and asserts against events.jsonl + ps` | `test/kill-timeout-orphans-by-default.test.js` | structural sentinel |

## Edge cases

Beyond the AC-driven coverage above, the following edges are surfaced — some deliberately deferred:

- [ ] **Bash subprocess vs. its grandchildren.** `kill -9 $child_pid` kills the bash subprocess that the wrapper spawned via `bash "$child_script" &`. It does NOT cascade to the bash's own children (e.g., `sleep 15`). Those grandchildren become orphaned to init/supervisord and continue running until natural completion. The probe's Path 2 verifies that check_task_already_running's `pgrep -f $script_relative_path` does not match those grandchildren (whose cmdline doesn't carry the script path), so the next fire isn't blocked. This is the precise reason AC #1 says "no surviving orphan PID" (singular, referring to the script-path-bearing process) rather than "all descendant processes killed."

- [ ] **The 11 per-task `forceKill: false` overrides retain pre-fix behavior.** Architect's Option A explicitly preserves these. After the fix, tasks like `processAllTasks`, `syncWoT`, `syncProfiles`, `callBatchTransfer`, etc. (full list in ADR 0025 §"Per-task overrides") still get `forceKill: false` at the wrapper's merge — meaning their timeout behavior is UNCHANGED. R4 guards against accidental removal. The follow-up intake (filed by Implementer at commit time per the ADR's "Intake to file at commit time" block) captures the proper triage for these.

- [ ] **`syncWoT` and `syncProfiles` 60-second timeout mis-sizing** is a separate bug surfaced during ADR 0025's audit. Story #28 explicitly preserves the override on these (Architect Option A vs Option D) precisely BECAUSE flipping them would cause a hidden regression. The follow-up intake's Part B captures the bug investigation. Not exercised by these tests; covered transitively by R4.

- [ ] **Neo4j atomicity on `kill -9` mid-Cypher.** ADR 0025 §Context resolved this as a non-issue (TCP drops → Neo4j rolls back in-flight transactions; partial-work risk identical to today's stalled-recovery risk). Not directly testable from the host test suite — would require a live Neo4j + cypher-shell + an in-flight transaction state. The cycle-staging smoke against real prod-shape work provides the operational evidence; no host-level assertion possible.

- [ ] **Pre-existing orphans at deploy time** (AC #5) — the deploy doesn't kill them; they run to natural completion or operator action. Operationally verifiable via `pgrep -f $script_path` before/after deploy; not a code-level assertion.

- [ ] **Story #27's existing test suite (`scheduled-task-timeout-propagation`)** must continue to PASS. Story #28 builds on story #27's fix; the regression guards in story #27 (S1-S4 in that suite + R1, R2 in that suite) cover the timeout-propagation correctness this story relies on. We don't re-duplicate them here; the overall `npm test` run is the regression guard.

- [ ] **JS-exec API handlers** (2026-05-24 intake) — those handlers bypass `launchChildTask.sh` entirely; story #28's fix does not reach them. Out of scope, covered by the separate intake's eventual story.

## Test infrastructure

- **Test framework:** Node built-in runner via `npm test` (entry: `test/test.js`). No new dependencies.
- **Concept Graph API:** not used. Story #28 has no concept-graph impact (confirmed by ADR 0025 §"Concept-graph impact").
- **Firmware state:** no precondition.
- **Fixtures:** the structural sentinels read source files directly (no fixtures). The probe creates a temporary probe-only entry in `taskRegistry.json` (backup → modify → run → restore) and a temporary script in `/tmp` (identical pattern to story #27's `test/probe-scheduled-task-timeout-propagation.js`).
- **Local-vs-container split:**
  - The 9 sentinels + regression guards in `test/kill-timeout-orphans-by-default.test.js` are pure file-read + JSON-parse + regex — they run on the host with no runtime dependencies.
  - The probe at `test/probe-kill-timeout-orphans.js` requires `bash`, `jq`, the wrapper script's source dependencies, and a writable `events.jsonl` — all inside the `tapestry` container. Run via:
    ```
    docker exec tapestry node /usr/local/lib/node_modules/brainstorm/test/probe-kill-timeout-orphans.js
    ```
    Expected output: 4 ASSERT-PASS blocks across Path 1 (3 asserts: wrapper-exit-shape, child-pid-dead, CHILD_TASK_ERROR present) and Path 2 (1 assert: CHILD_TASK_START present, no TASK_LAUNCH_PREVENTED). If anything FAILs, the Implementer re-opens ADR 0025 with the probe output attached.

## How to run

```
npm test
```

For the empirical probe (after the Implementer has run the host suite and committed the fix):
```
docker exec tapestry node /usr/local/lib/node_modules/brainstorm/test/probe-kill-timeout-orphans.js
```

For AC #5 (cycle-staging then cycle-prod): use the `cycle-staging` skill, verify the brainstorm container restarts cleanly + no in-flight tasks are disrupted. Then on user approval, `cycle-prod` with the same observation.

## Verification

The 9 sentinels + regression guards were committed against the pre-implementation tree on 2026-05-25. Pre-implementation state: **3 FAIL (S1, S2, I1) + 6 PASS (R1, R2, R3, R4, P0, P1)**. The three failing sentinels are the two fix-surface guards (one per file the Implementer touches) plus the intake sentinel. The six passing tests are:

- **R1, R2, R3** — regression guards on the wrapper-script kill mechanism, the CHILD_TASK_ERROR emit, and the ADR 0013 semaphore wrap. These must remain green; the fix flips a default value, it must not remove the kill machinery, the timeout-emit surface, or the semaphore wrap.
- **R4** — regression guard on Architect's explicit non-change decision (preserve the 11 per-task overrides). Must remain green; story #28 deliberately doesn't touch these.
- **P0, P1** — probe-file existence + shape guards. The Tester ships the probe alongside the sentinels (de-risks the Implementer's self-check step). After implementation these still pass; they're regression guards against accidental probe-file deletion.

Confirmed on 2026-05-25 (pre-implementation tree, commit `7d2c9355`'s tree updated with the test files):

```
kill-timeout-orphans-by-default suite:
  ✗ S1: taskRegistry.json's options_default.completion.failure.timeout.forceKill === true (AC #1, AC #4; ADR 0025 §Implementation 1)
      Pre-fix the global default is `false`. The Implementer must flip this to `true`. (AC #1, AC #4; ADR 0025 §Implementation 1)
  ✗ S2: processor.js's optionsJson literal omits the forceKill field entirely (AC #1, AC #4; ADR 0025 §Implementation 2)
      Pre-fix processor.js hardcodes `forceKill: false` at line 122. The fix removes the field entirely so the wrapper's hierarchical merge resolves forceKill from per-task override (if any) or global default (now true). (AC #1, AC #4; ADR 0025 §Implementation 2)
  ✗ I1: _intake.md contains the new follow-up section header from ADR 0025's "Intake to file at commit time" block (ADR 0025 §"Intake to file at commit time")
      Pre-fix the intake has not been appended. The Implementer copies the full block verbatim from ADR 0025 at commit time. (ADR 0025 §"Intake to file at commit time")
  ✓ R1: launchChildTask.sh's force_kill block at :402-412 still reads from resolved_options and conditionally executes kill -9 (AC #1, AC #4 — wrapper kill machinery preserved)
  ✓ R2: launchChildTask.sh still emits CHILD_TASK_ERROR event with error_type="timeout" (AC #3 — observability surface preserved)
  ✓ R3: queue/index.js still wraps tagged-task Worker callback with semaphore.acquire / release in try-finally (AC #4 — ADR 0013 wrap preserved)
  ✓ R4: the 11 per-task forceKill: false overrides remain unchanged in taskRegistry.json (ADR 0025 §Decision — explicit non-change)
  ✓ P0: empirical probe exists at test/probe-kill-timeout-orphans.js (ADR 0025 §"Implementer self-check")
  ✓ P1: probe script exercises both Path 1 (kill verification) and Path 2 (next-fire-runs verification) and asserts against events.jsonl + ps (ADR 0025 §"Implementer self-check")

kill-timeout-orphans-by-default suite:           FAIL (6 passed, 3 failed)
Overall:                                         FAIL
```

All 3 failures fail for the right reason — they reference the absent fix in each of the two files the Implementer must touch (S1 covers `taskRegistry.json`, S2 covers `processor.js`) plus the absent intake (I1). The Implementer's success criterion: all 9 PASS after the two-layer fix lands + the intake is appended; the probe runs cleanly inside the container with all 4 ASSERTs PASSing.
