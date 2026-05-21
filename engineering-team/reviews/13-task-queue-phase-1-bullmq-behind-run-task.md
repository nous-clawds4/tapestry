# Review: Story 13 — Route /api/run-task through BullMQ (task queue, phase 1)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-20
**Diff:** `git diff origin/staging...HEAD` (commit `bb1a4f03`, 4 commits: `0d1aaffa` story, `baeca451` ADR, `2a1d8790` tests, `bb1a4f03` impl)

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS**. `task-queue-bullmq suite: PASS (18 passed, 0 failed)`. All 11 prior suites still PASS, unchanged. Overall: PASS.
- [x] _Playwright not applicable — no UI surface changed._
- [x] `node -c` parse of all 3 new JS modules — clean (queue/index.js, queue/processor.js, queue/bullBoardMount.js).
- [x] _Lint not configured — skipped per house rules._
- [x] _Typecheck not configured — skipped per house rules._
- [x] _Build not configured — skipped per house rules._
- [ ] **Cycle-local smoke (S1–S11 from the test plan)** — **NOT RUN**, and the two blocking issues below mean it would fail. Tracking as the gating step after the fixes land.

## Spec adherence (AC walk)

| AC | Status | Notes |
|---|---|---|
| AC-1 signature unchanged | ✓ | R1 + visual audit of runTask.js new branch (additive only, legacy path untouched). |
| AC-2 BullMQ enqueue (customer task) | ⚠️ source PASS / runtime BROKEN | T2/T13 source sentinels pass; **runtime broken by Blocking #1** — every queued job fails with TypeError. |
| AC-3 dedup on (taskName, pubkey) | ✓ source | T3 + visual audit of `computeJobId` ([queue/index.js:63-68](src/manage/taskQueue/queue/index.js:63)). Smoke S2 would re-confirm. |
| AC-4 per-queue concurrency cap | ✓ source | T4 + `concurrencyByTask[taskName] \|\| defaultConcurrency` at [queue/index.js:98-100](src/manage/taskQueue/queue/index.js:98). |
| AC-5 non-customer single-instance | ✓ source | Same `computeJobId` branch — `taskName` alone when no pubkey. |
| AC-6 BullMQ jobs invoke launchChildTask.sh | ⚠️ source PASS / runtime BROKEN | T5 + R4 source pass. **Runtime broken by Blocking #1** — `processor.process` throws before spawn. |
| AC-7 existing UIs work | ✓ | R1 + R2 + no behavior change when flag is off. |
| AC-8 systemd timers continue | ✓ | Same /api/run-task contract. |
| AC-9 control-panel restart preserves jobs | deferred to smoke | BullMQ defaults + AOF (T6 ✓). |
| AC-10 Redis AOF + no strfry impact | ✓ | T6 + R5. Verified `command: redis-server --appendonly yes --appendfsync everysec` in [docker-compose.yml:37](docker-compose.yml:37). |
| AC-11 BullBoard mount behind admin auth | ⚠️ source PASS / runtime BROKEN | T7 source passes. **Runtime broken by Blocking #2** — mount silently skipped due to init-order race. |
| AC-12 in-process worker, no new supervisord entry | ✓ | T8 + T9. |
| AC-13 sync vs async preserved | ✓ source | R3 + visual audit of runTask.js new branch reusing `determineExecutionMode`. Smoke S9 would re-confirm. |
| AC-14 push notifications NOT in scope | ✓ | n/a |
| AC-15 feature flag toggles | ✓ source | T10 + T13. Both `runTask.js` and `control-panel.js` gate on `TASK_QUEUE_ENABLED`. |
| AC-16 OPERATIONS.md | ✓ | T11. New §10 covers flag, BullBoard URL, concurrency config, drain/pause, AOF. |
| AC-17 503 QUEUE_UNAVAILABLE | ✓ source | T12 + visual audit of [runTask.js:411-416](src/api/manage/commands/runTask.js:411). Shape matches ADR spec exactly. |

## ADR adherence

- [x] Files changed match ADR §Implementation notes file-for-file:
  - New `src/manage/taskQueue/queue/{index,processor,bullBoardMount}.js` ✓
  - Edited `src/api/manage/commands/runTask.js` ✓
  - Edited `src/api/index.js` (BullBoard mount + brainstormConfig import) ✓
  - Edited `bin/control-panel.js` (gated initTaskQueue) ✓
  - `config/brainstorm.conf.template` (TASK_QUEUE_ENABLED=false default) ✓
  - `/etc/brainstorm-task-queue.json` consumed as concurrency config source (Implementer chose this over the brainstorm.conf-section alternative; ADR-permitted) ✓
  - `docker-compose.yml` AOF flags ✓
  - `OPERATIONS.md` §10 ✓
- [x] Layering matches ADR Option A: per-task Queue + Worker + QueueEvents triples; shared `ioredis` connection (BullMQ duplicates internally for blocking ops, as expected); jobId-based dedup; sync/async wrappers around `determineExecutionMode`.
- [x] No new dependencies the ADR didn't authorize — `bullmq`, `@bull-board/api`, `@bull-board/express` added at the ADR-specified versions.
- [x] **Forward-compat hook preserved.** Per-task queue topology is intact; future sibling story (cross-task Neo4j-class coordination) can layer the semaphore wrapper around each Worker's processor with no topology refactor — exactly as the ADR's PO open-question response promised.

## Concept-graph integrity

- [x] No concept-graph schema changes (ADR §Consequences explicitly: "Firmware reinstall: no"). Verified — no `firmware/concepts/` edits in the diff.
- [x] No handles touched.
- [x] No `BIBLE.md` reads in the new code.

## Things tests can't catch (this is where the blocking issues hide)

Two runtime bugs surfaced during my code-walk that source-grep sentinels by design cannot catch. Both confirmed via Node REPL repro and call-graph trace.

### Concurrency / race-condition audit

| Hazard | Status |
|---|---|
| Two concurrent same-(taskName, pubkey) POSTs both execute | **Closed** by BullMQ-native jobId dedup |
| Worker fd / connection leak on shutdown | **Open (non-blocking)** — `closeTaskQueue` exists but isn't wired into SIGTERM/SIGINT handlers; BullMQ recovers via stalled-job detection so jobs aren't lost |
| Queue init race between api.register and control-panel boot | **OPEN (BLOCKING — Blocking #2)** — see below |
| Worker `process` invocation crashes | **OPEN (BLOCKING — Blocking #1)** — see below |
| Redis disconnect mid-pipeline | **Closed** by ioredis auto-reconnect + `isQueueAvailable()` returning false during outage |

## Findings

### Blocking

1. **[src/manage/taskQueue/queue/processor.js:69](src/manage/taskQueue/queue/processor.js:69) — `function process(job, taskDef)` shadows Node's global `process`.** Inside the function body, `process.env` at [line 99](src/manage/taskQueue/queue/processor.js:99) resolves to the FUNCTION's `.env` (undefined), not the Node global. Repro:
   ```
   function process() { return typeof process.env; }
   process();  // → 'undefined'
   { ...process.env }  // → spreads `undefined` (works silently — yields `{}`)
   ```
   Effective behavior at runtime: every queued job's spawn receives `env: { BRAINSTORM_STRUCTURED_LOGGING: 'true' }` only — no PATH, no NEO4J_*, no BRAINSTORM_MODULE_*. `launchChildTask.sh` would either fail to find `cypher-shell` (no PATH) or fail to source `/etc/brainstorm.conf`-derived paths (no BRAINSTORM_MODULE_BASE_DIR inherited). Worse — depending on Node version specifics, the spread may THROW (`Cannot read properties of undefined`), causing the processor's Promise to reject, BullMQ to mark the job failed, and the Worker to retry forever with the same outcome. **Zero jobs would ever complete via the queue path.** AC-2, AC-3, AC-4, AC-5, AC-6, AC-9 all fail at runtime.
   - **Source-sentinel tests didn't catch this** — they grep for tokens, not runtime semantics. Cycle-local smoke S1 (first POST under flag-on) would catch it immediately.
   - **Ask:** rename the function. Suggested: `processJob` (matches BullMQ's "processor function" idiom). Update both the function declaration ([line 69](src/manage/taskQueue/queue/processor.js:69)) and the `module.exports` ([line 133](src/manage/taskQueue/queue/processor.js:133)), and the call site in `queue/index.js` at [line 105](src/manage/taskQueue/queue/index.js:105) (`processor.process(...)` → `processor.processJob(...)`).

2. **[bin/control-panel.js:257 vs 268](bin/control-panel.js:257) — init-order race: `api.register(app)` runs BEFORE `taskQueue.initTaskQueue()`, so the BullBoard mount silently skips.** The flow:
   1. `await api.register(app)` ([line 257](bin/control-panel.js:257)) executes the BullBoard mount block ([src/api/index.js:460-471](src/api/index.js:460)), which calls `taskQueue.getAllQueues()` ([src/api/index.js:468](src/api/index.js:468)).
   2. `getAllQueues()` ([src/manage/taskQueue/queue/index.js:141-144](src/manage/taskQueue/queue/index.js:141)) returns `[]` because `_state` is still `null` — `initTaskQueue` hasn't run yet.
   3. `mountBullBoard(app, { queues: [] })` ([src/manage/taskQueue/queue/bullBoardMount.js:22-26](src/manage/taskQueue/queue/bullBoardMount.js:22)) early-returns with `console.warn('[bull-board] mountBullBoard called with no queues — skipping mount.')`.
   4. THEN `await taskQueue.initTaskQueue()` ([bin/control-panel.js:268](bin/control-panel.js:268)) populates `_state.queues` — but BullBoard's mount opportunity is gone; the Express route never gets attached.
   5. Operator hits `https://staging.brainstorm.world/admin/queues` → 404 (or SPA catch-all). AC-11 broken at runtime despite T7 source-sentinel passing.
   - **Source-sentinel tests didn't catch this** — T7 grep'd for tokens, not call order. Cycle-local smoke S8 would catch it.
   - **Ask:** reorder in `bin/control-panel.js` — call `initTaskQueue()` BEFORE `api.register(app)`. Suggested minimal patch:
     ```js
     // Before api.register so BullBoard mount sees the populated queue list.
     const taskQueueEnabled = getConfigFromFile('TASK_QUEUE_ENABLED', 'false') === 'true';
     if (taskQueueEnabled) {
       try {
         const taskQueue = require('../src/manage/taskQueue/queue');
         await taskQueue.initTaskQueue();
         console.log('Task queue initialized (TASK_QUEUE_ENABLED=true)');
       } catch (e) {
         console.error(`Failed to initialize task queue: ${e.message}`);
         console.error('Continuing without queue — /api/run-task will return 503 QUEUE_UNAVAILABLE');
       }
     } else {
       console.log('Task queue disabled (TASK_QUEUE_ENABLED=false) — legacy direct-spawn path active');
     }

     await api.register(app);
     console.log('API routes registered');
     ```
     I.e., swap the two blocks. The `scheduledTasks.initScheduler()` call after `api.register` can stay where it is.

### Non-blocking (recommend but do not gate)

1. **[src/manage/taskQueue/queue/index.js:96-100](src/manage/taskQueue/queue/index.js:96) — concurrency `||` fallback bug on `0`.** `(queueConfig.concurrencyByTask && queueConfig.concurrencyByTask[taskName]) || queueConfig.defaultConcurrency` short-circuits to `defaultConcurrency` if the operator sets a task's concurrency to `0` (legitimate "pause this task" semantics). Same for `defaultConcurrency: 0`. Phase-1 ships with everything at `1` so this is theoretical, but `??` is the safer operator. Single-character fix in a future PR.

2. **No `removeOnComplete` / `removeOnFail` configured on `Queue.add`** ([src/manage/taskQueue/queue/index.js:155](src/manage/taskQueue/queue/index.js:155)). BullMQ defaults are "keep everything forever" (the ADR's "last N completed, all failed" claim is incorrect about BullMQ defaults — `removeOnComplete: true` would remove, but the absence means retain). Over time, AOF-persisted job records bloat Redis. Easy fix in a follow-up: pass `defaultJobOptions: { removeOnComplete: { count: 1000 }, removeOnFail: { count: 5000 } }` when constructing each Queue. Non-blocking for first ship; should be addressed before this runs in steady-state for weeks.

3. **`closeTaskQueue` is exported but never wired** ([src/manage/taskQueue/queue/index.js:218](src/manage/taskQueue/queue/index.js:218), `bin/control-panel.js:297-298` SIGTERM/SIGINT handlers). On clean shutdown, the shared Redis connection isn't gracefully closed. BullMQ recovers via stalled-job detection so jobs aren't lost, but a graceful close is cleaner. Add to the SIGTERM handler in a follow-up.

4. **Duplication of `buildTaskCommand` + `LAUNCHCHILDTASK_RESULT` parser between `runTask.js` and `processor.js`.** Same minimal-diff stance as story #12's ADR §Out of scope. Acceptable for phase 1; future refactor story candidate.

5. **`QueueEvents` shares the underlying connection** ([src/manage/taskQueue/queue/index.js:113](src/manage/taskQueue/queue/index.js:113)). BullMQ duplicates internally for blocking ops in v5, so this works but produces ~3× the connection count the ADR implied (51 Queues + 51 Workers + 51 QueueEvents, each potentially duplicating). Redis handles it fine — well under any practical limit — but the "shared connection" framing in the ADR was optimistic.

6. **No HTTPS-only enforcement on `/admin/queues` cookie auth.** If the operator hits the URL via plain `http://`, the session cookie may not transmit (depending on cookie `secure` flag setup). Beyond story scope but worth a note in OPERATIONS.md §10.2.

## House rules check

- [x] Concept Graph API authority respected (no concept change).
- [x] No new lint/typecheck/build tooling.
- [x] No firmware reinstall needed.
- [x] Per-phase commits in order: story → adr → test → impl. Clean stack on top of `origin/staging` (which already includes story #12 merged).
- [x] No source files modified outside the ADR's scope.

## Verdict

**CHANGES REQUESTED.**

Two blocking runtime bugs prevent the queue path from working at all:
1. **Blocking #1** — `process` function name shadows `process.env` → every queued job fails. One-rename fix.
2. **Blocking #2** — `api.register` runs before `initTaskQueue` → BullBoard mount silently skipped. Two-line reorder fix in `bin/control-panel.js`.

Source-sentinel tests pass because they grep tokens, not runtime behavior. Cycle-local smoke S1 + S8 would catch both immediately — but better to fix now before flag-on smoke is even attempted.

Both fixes are tiny (one rename + one reorder). Once they land:
- Re-run `npm test` (should remain 18/18 + 11 prior).
- Then cycle-local smoke can drive S1–S11 against the live stack. **That** validation will decide PASS / re-CHANGES.

The six non-blocking observations are recorded above for context but do not gate this verdict. They can be addressed in follow-up commits or deferred to a future small-fixes story — Implementer's call.
