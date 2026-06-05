# Test Plan: Story 25 — Manual task re-triggers should work after the previous attempt finishes

**Story:** `engineering-team/stories/25-manual-task-retrigger-after-finish.md`
**ADR:** `engineering-team/decisions/0022-manual-task-retrigger-dedup-fix.md`
**Date:** 2026-05-24

## Approach

The fix is a one-line code change (add two BullMQ job options to a `queue.add` call) plus an in-place amendment to ADR 0012. Following the project's task-queue test convention (`test/task-queue-bullmq.test.js`'s explicit pattern: "Source/structural sentinels pin the ADR-required code shape. The behavioral proofs… are reproducible only against the live Docker stack and are the **authoritative cycle-local smoke**"), this plan splits into three tiers:

1. **Structural sentinels** (10 tests, in `test/manual-task-retrigger-after-finish.test.js`) — pin the code-shape + ADR-amendment-shape. Run on the host via `npm test`; no Redis/BullMQ required.
2. **Empirical probe** (1 script, `test/probe-bullmq-removeOnComplete-immediate.js`) — one-shot research script the Implementer writes per ADR 0022 §"Pre-implementation empirical probe" and runs inside the container against the installed `bullmq@^5.76.10`. Confirms the BullMQ behavior the ADR was built on actually holds on the installed version. Not registered in `test/test.js` (it's a one-shot, not a regression).
3. **Cycle-local smoke** (AC #7) — exercised at `cycle-staging` and `cycle-prod` deploy time. No automated test; behavior is observed during deploy verification.

This split matches how stories #13, #15, and #24 have handled similar BullMQ-Worker behavior — the unit suite cannot exercise BullMQ semantics without installing BullMQ on the host, which the project deliberately avoids.

## Coverage map

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| **AC #1** non-customer re-trigger after completion | T1: `enqueueTask passes removeOnComplete: true to queue.add` | `test/manual-task-retrigger-after-finish.test.js` | structural sentinel |
| **AC #1** (behavioral confirmation) | probe step 1-5 (add → complete → assert hash gone → re-add → assert new job.id) | `test/probe-bullmq-removeOnComplete-immediate.js` | empirical probe (Implementer-run inside container) |
| **AC #2** non-customer re-trigger after failure | T2: `enqueueTask passes removeOnFail: true to queue.add` | `test/manual-task-retrigger-after-finish.test.js` | structural sentinel |
| **AC #2** (behavioral confirmation) | probe step 6 (add throwing job → wait failed → re-add → assert new job.id) | `test/probe-bullmq-removeOnComplete-immediate.js` | empirical probe |
| **AC #3** customer re-trigger after finish | Same call site as AC #1, #2 — T1 + T2 cover it (one `queue.add` site handles both customer and non-customer paths via `computeJobId`) | `test/manual-task-retrigger-after-finish.test.js` | structural sentinel |
| **AC #4** customer concurrent-fire dedup preserved | T3: `computeJobId still uses ${taskName}:${pubkey} for customer args and bare taskName for non-customer` | `test/manual-task-retrigger-after-finish.test.js` | structural sentinel (regression guard) |
| **AC #4** (behavioral confirmation) | cycle-local smoke: trigger `processCustomer` for the same customer twice with the first job held in `active` (e.g., long-running) and assert both calls receive the same `jobId` from `/api/run-task` response. The probe's removeOnComplete-true behavior is finalization-triggered (not preemptive) — by construction, an `active` job's hash still exists. | cycle-local smoke | manual |
| **AC #5** scheduled-fire non-regression | T4: `scheduler.js still calls queue.upsertJobScheduler` | `test/manual-task-retrigger-after-finish.test.js` | structural sentinel (regression guard) |
| **AC #5** (behavioral confirmation) | Existing story #24 test suite (`scheduled-tasks-with-arguments.test.js`) covers scheduled-fire behavior. Re-run it post-fix and confirm no regressions. | `test/scheduled-tasks-with-arguments.test.js` (existing) | structural + cycle-local |
| **AC #6** ADR 0012 amendment text matches actual behavior | T5: `Dedup section acknowledges actual cross-state dedup` | `test/manual-task-retrigger-after-finish.test.js` | structural sentinel |
| **AC #6** ADR 0012 documents the mechanism | T6: `Dedup section documents removeOnComplete:true + removeOnFail:true mechanism` | `test/manual-task-retrigger-after-finish.test.js` | structural sentinel |
| **AC #6** ADR 0012 cross-references ADR 0022 | T7: `ADR 0012 cross-references ADR 0022` | `test/manual-task-retrigger-after-finish.test.js` | structural sentinel |
| **AC #6** ADR 0012 notes the trade-off | T8: `Option A Cons list notes BullBoard completed/failed visibility loss` | `test/manual-task-retrigger-after-finish.test.js` | structural sentinel |
| **AC #7** no-downtime deploy | cycle-staging then cycle-prod runs. The ADR's §"Deployment dry-run analysis" walks the moment-by-moment expectations; the cycle-local skill confirms each phase by observation (in-flight jobs survive container restart; new jobs apply new options; legacy stuck jobs handleable via BullBoard "Remove"). | cycle-local smoke | manual |
| **ADR mandate**: probe script exists | T9: `probe script exists at test/probe-bullmq-removeOnComplete-immediate.js` | `test/manual-task-retrigger-after-finish.test.js` | structural sentinel |
| **ADR mandate**: probe script shape | T10: `probe script exercises both removeOnComplete: true and removeOnFail: true paths and compares job.id across re-adds` | `test/manual-task-retrigger-after-finish.test.js` | structural sentinel |

## Edge cases

Beyond the AC-driven sentinels above, the following edges are worth surfacing — most are deliberately deferred to the cycle-local smoke since they require a live Docker stack:

- [ ] **Concurrent-fire-while-active race window.** The new `removeOnComplete: true` semantic only triggers on completion, not preemptively. If the same `(taskName, pubkey)` lands twice within the same millisecond before either has reached the Worker, BullMQ's `queue.add` returns the first job to both callers. This is the *intended* dedup behavior (AC #4) and is verified by T3 (jobId formula is preserved). Cycle-local smoke confirms behavior end-to-end.
- [ ] **In-flight job at deploy moment.** Per ADR 0022's "Deployment dry-run analysis": jobs created with old options (no `removeOnComplete`) before the deploy keep those options — they finalize under the old behavior and remain in Redis. The new code does NOT retroactively rewrite their options. This is the "legacy stuck jobs" pile that story #25 §Out-of-scope explicitly accepts. Cycle-local smoke observes this; no automated assertion.
- [ ] **BullMQ version drift.** If a future `npm install` bumps `bullmq` past `^5.76.10` to a version where `removeOnComplete: true` no longer maps to `{count: 0}`, the fix could silently regress. **Mitigation:** the ADR-mandated empirical probe (T9/T10) is exactly the regression guard — re-running the probe after any bullmq bump catches this. The probe is one-shot by design and not part of `npm test`, so this requires a manual re-run policy. Document in `OPERATIONS.md` as a follow-up (out of scope here).
- [ ] **`removeOnComplete: true` interacting with the `neo4j-heavy` semaphore (ADR 0013).** Verified architecturally in ADR 0022 §"Files NOT to edit": the semaphore wrap is in the Worker callback (before `processor.processJob`), which is independent of BullMQ's finalization path (where `removeOnComplete` fires). No interaction. Cycle-local smoke after the fix confirms `neo4j-heavy` tasks still serialize correctly.
- [ ] **Scheduler.js stretch goal.** If the Implementer chooses the stretch goal (apply `removeOnComplete: true` / `removeOnFail: true` to `scheduler.js`'s `upsertJobScheduler` job template), no new unit test is required — T4 still passes (it only checks the `upsertJobScheduler` call exists), and the cycle-local smoke covers scheduled-fire behavior. If the Implementer adds an explicit `opts: {...}` field, the probe script could be extended with a step that schedules a one-shot repeatable, confirms two fires, and asserts the first job's hash is gone after the second fires — Implementer's call whether to add this.

## Test infrastructure

- **Test framework:** Node built-in runner via `npm test` (entry: `test/test.js`). No new dependencies.
- **Concept Graph API:** not used. Story #25 has no concept-graph impact (confirmed by ADR 0022).
- **Firmware state:** no precondition.
- **Fixtures:** none.
- **Local-vs-container split:**
  - The 10 sentinels in `test/manual-task-retrigger-after-finish.test.js` are pure file-read + regex — they run on the host with no runtime dependencies.
  - The probe at `test/probe-bullmq-removeOnComplete-immediate.js` requires the installed `bullmq` package + a reachable Redis. Both exist inside the `tapestry` container. Run via:
    ```
    docker exec tapestry node /usr/local/lib/node_modules/brainstorm/test/probe-bullmq-removeOnComplete-immediate.js
    ```
    The probe MUST be run before the Implementer changes `src/manage/taskQueue/queue/index.js:185` (per ADR 0022). Expected output: two ASSERT-PASS lines (completed + failed paths). If anything FAILs, the Implementer re-opens ADR 0022.

## How to run

```
npm test
```

For the empirical probe (after the Implementer has written it):
```
docker exec tapestry node /usr/local/lib/node_modules/brainstorm/test/probe-bullmq-removeOnComplete-immediate.js
```

For AC #7 (cycle-staging then cycle-prod): use the `cycle-staging` skill, then on user approval, `cycle-prod`.

## Verification

The 10 sentinels were committed against the pre-implementation tree on 2026-05-24. Expected pre-impl state: 8 FAIL (T1, T2, T5–T10), 2 PASS (T3, T4 — regression guards that already hold).

Confirmed on 2026-05-24 at commit `66141559` (post-ADR, pre-implementation):

```
manual-task-retrigger-after-finish suite:
  ✗ T1: src/manage/taskQueue/queue/index.js enqueueTask passes removeOnComplete: true to queue.add (AC #1, #3; ADR 0022 §Implementation 1)
      enqueueTask's queue.add call must pass `removeOnComplete: true` so completed job hashes are removed immediately as part of completion finalization. Without this, BullMQ's queue.add dedups against the completed hash forever and manual re-triggers after completion are silently blocked. (AC #1, #3; ADR 0022 §Implementation 1)
  ✗ T2: src/manage/taskQueue/queue/index.js enqueueTask passes removeOnFail: true to queue.add (AC #2; ADR 0022 §Implementation 1)
      enqueueTask's queue.add call must pass `removeOnFail: true` so failed job hashes are removed immediately on failure finalization. Without this, manual re-triggers after a failure are silently blocked — defeating the recovery-from-failure path. (AC #2; ADR 0022 §Implementation 1)
  ✓ T3: computeJobId still uses `${taskName}:${pubkey}` for customer args and bare `taskName` for non-customer (AC #4 — preserves concurrent-fire dedup)
  ✓ T4: scheduler.js still calls queue.upsertJobScheduler (AC #5 — scheduled-fire path untouched by the primary fix)
  ✗ T5: ADR 0012's "Dedup" section acknowledges BullMQ's actual cross-state dedup (AC #6 — text matches actual behavior)
      ADR 0012's **Dedup:** section must acknowledge that BullMQ dedups across all job states (including completed and failed), not only wait/active as the original text claimed. The amendment is required by story #25 AC #6 — the documented contract must match actual code behavior. (AC #6; ADR 0022 §Implementation 2)
  ✗ T6: ADR 0012's "Dedup" section documents the removeOnComplete: true + removeOnFail: true mechanism (AC #6)
      ADR 0012's **Dedup:** section must document the `removeOnComplete: true` mechanism that restores the wait/active-only dedup window. (AC #6; ADR 0022 §Implementation 2)
  ✗ T7: ADR 0012 cross-references ADR 0022 (AC #6 — readers can follow the amendment trail)
      ADR 0012 must cross-reference ADR 0022 so readers can follow the amendment trail. Add the reference in the Dedup section, the Cons list, or a top-of-file amendment note. (AC #6; ADR 0022 §Implementation 2)
  ✗ T8: ADR 0012's Option A Cons list notes the BullBoard completed/failed visibility loss (AC #6 — readers understand the trade-off)
      Option A's **Cons** list must note that BullBoard's completed/failed views are empty for queues using removeOnComplete:true / removeOnFail:true — `events.jsonl` is the durable failure record. Operators reading the ADR need to understand the trade-off they're inheriting. (AC #6; ADR 0022 §Implementation 2)
  ✗ T9: empirical probe script exists at test/probe-bullmq-removeOnComplete-immediate.js (ADR 0022 §Pre-implementation empirical probe)
      Probe script must exist at /Users/clawds4/repos/nous-clawds4/tapestry/test/probe-bullmq-removeOnComplete-immediate.js. ADR 0022 mandates this script as a pre-implementation empirical check — the Implementer runs it inside the container (`docker exec tapestry node /usr/local/lib/node_modules/brainstorm/test/probe-bullmq-removeOnComplete-immediate.js`) to confirm that the installed BullMQ ^5.76.10 actually behaves the way the GitHub-master source said it would. If the probe fails, the ADR must be re-opened.
  ✗ T10: probe script exercises both removeOnComplete: true and removeOnFail: true paths and compares job.id across re-adds (loose shape check)
      Probe script missing — T9 must pass first.

Result: 2 passed, 8 failed
```

All 8 failures fail for the right reason — they reference the absent fix (T1, T2), the un-amended ADR text (T5–T8), and the missing probe script (T9, T10). The 2 passing tests (T3, T4) are intentional regression guards on existing behavior the fix must NOT break (the jobId formula for AC #4; the `upsertJobScheduler` call for AC #5). The Implementer's success criterion is: all 10 PASS after the fix lands.
