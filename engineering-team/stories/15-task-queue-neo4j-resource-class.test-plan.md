# Test Plan: Story 15 — Cross-task Neo4j-heavy serialization

**Story:** `engineering-team/stories/15-task-queue-neo4j-resource-class.md`
**ADR:** `engineering-team/decisions/0013-task-queue-neo4j-resource-class.md`
**Date:** 2026-05-21

## Approach

Same precedent as #5/#6/#8/#10/#11/#12/#13. Source/structural sentinels in the hand-rolled Node runner pin the ADR-required code shape — new modules (`src/utils/structuredEvents.js`, `src/manage/taskQueue/queue/resourceSemaphore.js`), Lua-scripted Redis primitives, `RESOURCE_CLASS_WAIT_TIMEOUT` error code literal, conditional Worker-callback wrap on `taskDef.resourceClass`, `resourceClassCaps` config extension, owner-trio registry tags, and the structured-event phase vocabulary.

The **behavioral round-trip** — actually triggering two `neo4j-heavy`-tagged tasks back-to-back with the queue flag on and observing the second wait via `events.jsonl` phase tokens; confirming the 4-hour timeout; verifying cap-tuning via config — is reproducible only against the live Docker stack with BullMQ deps installed and is the **authoritative cycle-local smoke** (Reviewer-required, per project precedent #5/#6/#8/#10/#11/#12/#13).

## Coverage map

| AC | Test / mechanism | File | Level |
|---|---|---|---|
| AC-1 (tasks taggable with resourceClass; untagged unaffected) | **T3** (semaphore module exists), **T7** (queue/index.js wraps only when `resourceClass` is truthy). Behavioral S1 = cycle-local | test/task-queue-neo4j-resource-class.test.js | source + smoke |
| AC-2 (same-class concurrent → second waits; default cap 1) | **T3** + **T4** (Lua atomicity) + **T5** (timeout code). Behavioral S2 = cycle-local | test/task-queue-neo4j-resource-class.test.js | source + smoke |
| AC-3 (cap operator-configurable) | **T8** (`resourceClassCaps` consumed from queueConfig). Behavioral S3 = cycle-local (operator raises cap to 2; verify two run) | test/task-queue-neo4j-resource-class.test.js | source + smoke |
| AC-4 (untagged tasks per per-task concurrency; semaphore additive) | **T7** (conditional wrap) + **R1** (per-task topology preserved) | test/task-queue-neo4j-resource-class.test.js | source |
| AC-5 (story #13 per-task concurrency + jobId dedup unchanged) | **R1** + **R2** + **R3** + **R4** + the 18-test task-queue-bullmq suite remaining green | test/task-queue-neo4j-resource-class.test.js + test/task-queue-bullmq.test.js | source (regression) |
| AC-6 (initial registry tags: owner trio = neo4j-heavy) | **T9** (taskRegistry.json owner-trio entries have the tag) | test/task-queue-neo4j-resource-class.test.js | source |
| AC-7 (observability via structured events; phase tokens) | **T1** + **T2** (structuredEvents.js exists, writes JSONL) + **T6** (semaphore calls emitTaskEvent with the three phase tokens) + **T10** (OPERATIONS.md §10.6 documents the vocabulary). Behavioral S4 = cycle-local (grep events.jsonl) | test/task-queue-neo4j-resource-class.test.js | source + smoke |
| AC-8 (orchestrator scripts unaffected — bash-level serialization unchanged) | Behavioral only — bash orchestrator behavior not changed by Node-side semaphore. S5 = cycle-local | — | smoke |
| AC-9 (TASK_QUEUE_ENABLED=false → no effect) | Inherits from story #13's #T13: when flag is off, queue module is never required → semaphore module never loaded → tag fields have no effect. **R3** preserves the flag branch | test/task-queue-neo4j-resource-class.test.js | source (via R3) + smoke S6 |
| AC-10 (TASK_QUEUE_ENABLED=true but no tags → no effect) | Same as AC-1 conditional-wrap behavior (**T7**). Behavioral S7 = cycle-local | test/task-queue-neo4j-resource-class.test.js | source + smoke |
| AC-11 (no regression in story #13's 18 sentinels + other 11 suites) | **R1**–**R4** + full `npm test` re-run pre/post-impl | full test gate | source (regression) |

**Totals:** T1..T10 = **10 failing sentinels** pre-impl (flip to PASS post-impl). R1..R4 = **4 regression guards** that PASS pre AND post (catch regressions on per-task topology, the `process`→`processJob` rename, the feature-flag/503 contract, and the BullBoard mount).

## Edge cases

- [x] **Defensive file reads.** T2/T4/T5/T6 first check the parent file exists and short-circuit to "module missing — Tn must pass first" — avoids confusing "regex undefined" cascades when the implementer hasn't created the file yet.
- [x] **T4 Lua-pattern tolerance.** Accepts any of `defineCommand`, `eval`, or `evalsha` — ioredis's three idiomatic ways to put Lua on the wire. Implementer can pick.
- [x] **T4 hash-op tolerance.** Case-insensitive grep for `HSET`/`HDEL`/`HLEN` covers both Redis command-name casing conventions.
- [x] **T6 multi-token assertion.** All three phase tokens (`resource_class_wait_begin`, `_wait_end`, `_released`) must appear; partial coverage fails with a specific message naming which token is missing.
- [x] **T7 token-set assertion.** Pins three independent signals (`resourceSemaphore`/`createSemaphore` reference, `resourceClass` reference, `acquire`/`release` reference) so a partial wrap that imports the module but doesn't use it correctly still fails.
- [x] **T9 JSON parse.** `readJsonSafe` returns null on malformed JSON so a registry corruption surfaces as a clear error rather than a parse exception. Each task tested independently with task-specific failure messages.
- [x] **R2 anti-shadow guard.** Asserts both the positive (`processJob` referenced) AND the negative (no `function process(` re-introduction). Prevents the story-#13 review's blocking bug from sneaking back in via a refactor.
- [ ] **Real Redis Lua atomicity, actual wait-and-release under contention, real timeout behavior, real config-tuned cap changes, real events.jsonl content shape under load** — not catchable in source; **cycle-local smoke is the authoritative check**.

## Not covered (deferred to cycle-local smoke — authoritative, Reviewer-required)

Run on the live Docker stack with `TASK_QUEUE_ENABLED=true` + BullMQ deps installed:

**S1 — AC-1 (taggable + untagged unaffected):** Trigger `calculateOwnerGrapeRank` (tagged) — observe `resource_class_wait_begin` + `resource_class_wait_end outcome=acquired` events in `/var/log/brainstorm/taskQueue/events.jsonl`. Trigger an untagged task (e.g., `exportWhitelist`) — observe NO `resource_class_*` events for it.

**S2 — AC-2 (concurrent → second waits):** Trigger `calculateOwnerGrapeRank` (long-running). While it runs, trigger `calculateOwnerPageRank`. Observe in events.jsonl:
- First task: `wait_begin` → immediate `wait_end outcome=acquired`.
- Second task: `wait_begin` → blocks → `wait_end outcome=acquired` only after first task's `released`.
- Both tasks complete successfully; no concurrent execution overlap.

**S3 — AC-3 (operator tunes cap):** Edit `/etc/brainstorm-task-queue.json` to set `"neo4j-heavy": 2`; `supervisorctl restart brainstorm`. Trigger the same two tasks back-to-back: assert both run concurrently. Restore cap to 1; restart; assert serial behavior returns.

**S4 — AC-7 (observability surface):** Inspect `events.jsonl` after S2 — confirm JSONL well-formed; each event has the bash-matching shape (`timestamp`, `eventType`, `taskName`, `target`, `metadata`, `scriptName`, `pid`); `metadata.resourceClass` field present; `metadata.phase` field carries the three phase tokens; `metadata.wait_seconds` reasonable.

**S5 — AC-8 (orchestrator scripts unaffected):** Trigger `updateAllScoresForOwner` (which in bash invokes Hops → PageRank → GrapeRank → ... sequentially). The orchestrator's sequential bash-level invocation continues to work; each child task enqueues through the queue path; the semaphore observes them one at a time (which they already are, by bash-level serialization). No deadlock, no duplicate serialization.

**S6 — AC-9 (flag-off → no effect):** Set `TASK_QUEUE_ENABLED=false`; restart. Trigger the two heavy tasks back-to-back — both run concurrently (legacy direct-spawn path; semaphore module never loaded). No `resource_class_*` events emitted.

**S7 — AC-10 (flag-on but no tags → no effect):** Flag on; temporarily revert the three owner-trio `resourceClass` tags in the runtime taskRegistry (or trigger a never-tagged task). Confirm: no semaphore wrap, no events emitted, behavior identical to story #13.

**S8 — RESOURCE_CLASS_WAIT_TIMEOUT failure mode:** Configure a very short `acquireTimeoutMs` (e.g., 10 s) via the config or set the cap to 1 and trigger 3 heavy tasks back-to-back. The third should fail with `RESOURCE_CLASS_WAIT_TIMEOUT` after the timeout. BullBoard's failed tab surfaces the job; events.jsonl has `wait_end outcome=timeout` + a `TASK_ERROR` event.

## Test infrastructure

- Existing hand-rolled Node runner (`npm test` → `test/test.js`); no new deps.
- Registered: `taskQueueNeo4jResourceClass` (at the end of `test/test.js`'s suite list, after `taskQueueBullmq`).
- Asserts only against in-repo files: `src/utils/structuredEvents.js` (new), `src/manage/taskQueue/queue/{resourceSemaphore,index,processor,bullBoardMount}.js`, `src/manage/taskQueue/taskRegistry.json`, `src/api/manage/commands/runTask.js`, `OPERATIONS.md`.
- No Playwright (the behavioral layer is filesystem + Redis + BullMQ + Lua — smoke territory; nothing pure-frontend).

## How to run

```
npm test
```

Targeted: `node -e "require('./test/task-queue-neo4j-resource-class.test.js').run()"`

## Verification

New tests fail on the pre-implementation tree (atop ADR commit `25d9f345`):

```
task-queue-neo4j-resource-class suite:
  ✗ T1: src/utils/structuredEvents.js exists and exports emitTaskEvent (ADR 0013 §New files; PO refinement)
      Node-side structured-events helper does not exist at src/utils/structuredEvents.js (ADR 0013 §New files). Create the Node equivalent of bash emit_task_event (from src/utils/structuredLogging.sh) so queue-side events land in events.jsonl alongside bash-emitted events — PO-resolved to invest now rather than defer to console.log + a future cleanup.
  ✗ T2: structuredEvents.js writes JSONL to taskQueue/events.jsonl using sync atomic append (ADR 0013 §New files)
      structuredEvents.js missing — T1 must pass first.
  ✗ T3: resourceSemaphore.js exists at the ADR-specified path and exports createSemaphore (AC-1, AC-2; ADR 0013 §New files)
      Resource-semaphore module does not exist at src/manage/taskQueue/queue/resourceSemaphore.js (AC-1, AC-2; ADR 0013 §New files). Create the module that owns cross-task serialization via a Redis-backed counted semaphore with TTL leases.
  ✗ T4: resourceSemaphore.js uses Redis-side Lua atomicity for check+set+sweep (AC-2; ADR 0013 §Option A)
      resourceSemaphore.js missing — T3 must pass first.
  ✗ T5: resourceSemaphore.js carries the RESOURCE_CLASS_WAIT_TIMEOUT error code literal (AC-2; ADR 0013 §Decision)
      resourceSemaphore.js missing — T3 must pass first.
  ✗ T6: resourceSemaphore.js emits structured events via emitTaskEvent (not console.log) (AC-7; ADR 0013 §Observability)
      resourceSemaphore.js missing — T3 must pass first.
  ✗ T7: queue/index.js constructs the semaphore and wraps the Worker callback conditionally on taskDef.resourceClass (AC-1, AC-4; ADR 0013 §Edited files)
      queue/index.js does not reference the semaphore module (AC-1, AC-4; ADR 0013 §Edited files). The Worker construction loop must import and call createSemaphore so per-class caps are enforced before processor.processJob runs.
  ✗ T8: queue/index.js consumes queueConfig.resourceClassCaps from the existing brainstorm-task-queue.json (AC-3; ADR 0013 §Config)
      queue/index.js does not consume queueConfig.resourceClassCaps (AC-3; ADR 0013 §Config). The per-class cap configuration extends story #13's /etc/brainstorm-task-queue.json — same file, sibling key. Pass queueConfig.resourceClassCaps to createSemaphore so operators tune caps in one config surface.
  ✗ T9: taskRegistry.json owner trio is tagged "resourceClass": "neo4j-heavy" (AC-6; ADR 0013 §Implementation notes)
      taskRegistry.json entry for `calculateOwnerHops` is not tagged with "resourceClass": "neo4j-heavy" (AC-6; ADR 0013 §Implementation notes). This is the initial tag set the operator demonstrated the pain with on brainstorm.world (calculateOwnerGrapeRank + calculateOwnerPageRank running concurrently post-story-#13). Add the tag at the top level of the entry, alongside `name`, `script`, etc.
  ✗ T10: OPERATIONS.md §10.6 documents the resource-class config + phase tokens (AC-7; ADR 0013 §Documentation)
      OPERATIONS.md does not document: the `resourceClass` registry field, the `resourceClassCaps` config key, the `neo4j-heavy` class name, the resource_class_wait_begin/wait_end/released phase tokens (AC-7; ADR 0013 §Documentation). Add §10.6 covering: …
  ✓ R1: queue/index.js still constructs per-task Queue + Worker per registry task (story #13 topology preserved, AC-5)
  ✓ R2: processor.js still exports processJob (NOT process, story #13 blocker-fix preserved)
  ✓ R3: runTask.js feature-flag branch + 503 QUEUE_UNAVAILABLE preserved (story #13 / ADR 0012 contract)
  ✓ R4: BullBoard mount module still exists and references /admin/queues + requireOwnerOnly (story #13 / ADR 0012 contract)

task-queue-neo4j-resource-class suite:           FAIL (4 passed, 10 failed)
Overall:                                         FAIL
```

All 12 prior suites continue to PASS (no regressions introduced by the new sentinel registration).
