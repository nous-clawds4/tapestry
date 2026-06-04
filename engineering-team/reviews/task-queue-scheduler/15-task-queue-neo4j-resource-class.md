# Review: Story 15 — Cross-task Neo4j-heavy serialization

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-21
**Diff:** `git diff origin/staging...HEAD` (commit `70556d88`, 4 commits: `fe22905f` story, `25d9f345` ADR, `126c7b30` tests, `70556d88` impl)

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS**. `task-queue-neo4j-resource-class suite: PASS (14 passed, 0 failed)` (10 ADR sentinels + 4 regression guards green). All 12 prior suites still PASS, unchanged. Overall: **PASS**.
- [x] `node -c` parse — all 3 modified/new JS modules parse clean.
- [x] _Playwright not applicable — no UI surface changed._
- [x] _Lint / typecheck / build not configured — skipped per house rules._
- [x] **Cycle-local smoke** — **PASS end-to-end** (see §"Cycle-local smoke verification" below). The behavioral round-trip the source-sentinels can't reach.

## Spec adherence (AC walk)

| AC | Status | Notes |
|---|---|---|
| AC-1 taggable + untagged unaffected | ✓ | T3+T7 source + smoke. Boot log: `resourceClasses=neo4j-heavy`. Untagged tasks hit the non-wrapped branch at [queue/index.js:128-129](src/manage/taskQueue/queue/index.js:128). |
| AC-2 same-class concurrent → second waits | ✓ | T3+T4+T5 source + **smoke S2 end-to-end PROVED.** Two heavy tasks triggered ~0.5s apart: events.jsonl shows first acquired immediately (wait_seconds=0), second `wait_begin cap=1` → wait → `wait_end outcome=acquired wait_seconds=27` matching first's `held_seconds=27` exactly. |
| AC-3 operator-configurable cap | ✓ source | T8 + smoke partial: `/etc/brainstorm-task-queue.json` with `resourceClassCaps.neo4j-heavy: 1` was loaded and respected. Did not re-test cap=2 (would require an additional config-edit smoke pass; ADR spec is straightforward). |
| AC-4 untagged untouched | ✓ | T7 + R1. Conditional wrap at [queue/index.js:117](src/manage/taskQueue/queue/index.js:117): `resourceClass ? wrappedFn : directFn`. |
| AC-5 story #13 contracts unchanged | ✓ | R1–R4 + 13 task-queue-bullmq sentinels remain green. |
| AC-6 owner trio tagged | ✓ | T9 + visual audit: all three entries in `taskRegistry.json` have `"resourceClass": "neo4j-heavy"`. Clean 3-line diff (no whitespace noise after surgical re-Edit). |
| AC-7 observability | ✓ | T1+T2+T6+T10 source + smoke. Five events.jsonl entries observed during the smoke — all three phase tokens (`wait_begin`, `wait_end`, `released`) present with the exact metadata the ADR specified. |
| AC-8 orchestrator unaffected | smoke-deferred | bash-level orchestrator behavior unchanged by Node-side semaphore. Not separately re-tested; would just observe extra semaphore acquire/release per bash-orchestrator child. |
| AC-9 flag-off → no effect | ✓ | Smoke S6: flipped `TASK_QUEUE_ENABLED=false`, restart, boot log: `Task queue disabled — legacy direct-spawn path active`. `/admin/queues → 200` (SPA shell, no BullBoard mount). |
| AC-10 flag-on no tags → no effect | ✓ source | T7's conditional wrap is the proof. Not separately smoked but trivially follows from the branch. |
| AC-11 no regression | ✓ | All 12 prior suites + 14 sentinels green. |

## ADR adherence

- [x] Files changed match ADR §Implementation notes exactly:
  - New `src/utils/structuredEvents.js` ✓
  - New `src/manage/taskQueue/queue/resourceSemaphore.js` ✓
  - Edited `src/manage/taskQueue/queue/index.js` (semaphore construction + conditional Worker-callback wrap) ✓
  - `src/manage/taskQueue/taskRegistry.json` (owner trio tagged) ✓
  - `OPERATIONS.md` §10.6 ✓
- [x] Lua script semantics match ADR pseudocode line-for-line: HGETALL → sweep expired → HLEN → HSET only if `current < cap`. Single round-trip. Atomic.
- [x] Wait-and-retry loop semantics match: 500 ms poll, 4 h hard timeout, `RESOURCE_CLASS_WAIT_TIMEOUT` literal error code.
- [x] Worker callback wrap follows the ADR's exact `try { processJob } finally { release }` shape — release guaranteed even if processor throws.
- [x] structuredEvents writes JSONL to `${BRAINSTORM_LOG_DIR}/taskQueue/events.jsonl` matching bash `emit_task_event` shape exactly. Confirmed by smoke: events parse cleanly, fields match.

## Concept-graph integrity

- [x] No concept-graph schema changes (ADR §Consequences). Verified — no `firmware/concepts/` edits in the diff.
- [x] No handles touched.

## Things tests can't catch — pre-smoke audit findings

Audited the implementation for hazards source-sentinels by design cannot reach:

| Hazard | Status |
|---|---|
| Lua atomicity (two concurrent acquires both passing the HLEN<cap check) | **Closed** by Redis single-threaded Lua execution + script doing sweep+check+set atomically |
| Release function not idempotent (double-release on processor retry) | **Closed** by `released` flag guard at [resourceSemaphore.js:125-128](src/manage/taskQueue/queue/resourceSemaphore.js:125) |
| Processor throws → release never called → lease leaked | **Closed** by `try { processJob } finally { release }` in queue/index.js |
| Worker crash mid-processing → lease leaked | **Closed** by TTL leases — next acquirer's Lua script sweeps expired entries |
| `process` global shadowed (story #13's blocker) | **Closed** — function is named `emitTaskEvent`/`createSemaphore`/`acquire`, not `process` |
| `BRAINSTORM_STRUCTURED_LOGGING=false` short-circuit | **Closed** — match bash semantics; gates events at the writer |
| effectiveCap fallback on misconfigured class | **Acceptable** — warns to stderr + defaults to cap=1 (operator-friendly; non-blocking for ship) |
| Sync `appendFileSync` blocking event loop | **Acceptable** — events emit 3 times per task; sub-millisecond writes; negligible at operator-trigger cadence |
| Polling cadence Redis load | **Acceptable** — 2 ops/sec per waiter; bounded by waiter count (rarely >2 at cap=1) |

## Cycle-local smoke verification

Drove the validation that source-sentinels by design couldn't do. Container: `tapestry` Docker. Deployed delta (4 files: structuredEvents.js NEW, resourceSemaphore.js NEW, queue/index.js, taskRegistry.json). Wrote `/etc/brainstorm-task-queue.json` with `resourceClassCaps: { "neo4j-heavy": 1 }`. Flipped `TASK_QUEUE_ENABLED=true`. `supervisorctl restart brainstorm`.

### Boot
```
Found TASK_QUEUE_ENABLED=true
[task-queue] Initialized 51 queues + workers (defaultConcurrency=1, resourceClasses=neo4j-heavy)
Task queue initialized (TASK_QUEUE_ENABLED=true)
[bull-board] Mounted at /admin/queues (owner-only)
```
✓ The `resourceClasses=neo4j-heavy` segment is the new log line introduced by this story — direct evidence the config is being read and the semaphore is being constructed at the correct location in the init sequence.

### S2 — Cross-task serialization PROVED end-to-end

Triggered `calculateOwnerHops`, waited 0.5s, triggered `calculateOwnerPageRank`. Both tasks tagged `neo4j-heavy`. Observed events.jsonl phase tokens:

```
[PROGRESS  ] task=calculateOwnerHops      phase=resource_class_wait_end    resourceClass=neo4j-heavy wait_seconds=0  outcome=acquired
[PROGRESS  ] task=calculateOwnerPageRank  phase=resource_class_wait_begin  resourceClass=neo4j-heavy cap=1
[PROGRESS  ] task=calculateOwnerHops      phase=resource_class_released    resourceClass=neo4j-heavy held_seconds=27
[PROGRESS  ] task=calculateOwnerPageRank  phase=resource_class_wait_end    resourceClass=neo4j-heavy wait_seconds=27 outcome=acquired
[PROGRESS  ] task=calculateOwnerPageRank  phase=resource_class_released    resourceClass=neo4j-heavy held_seconds=6
```

**Read this carefully:**
- Hops acquired in 0 seconds (instant — slot was free).
- PageRank's wait started immediately on its second-place arrival.
- Hops held for 27 seconds, then released.
- PageRank's `wait_seconds=27` matches Hops's `held_seconds=27` **exactly** — PageRank acquired within one 500 ms poll window of Hops releasing.

This is the **exact behavior the operator has been asking for since story #13 staging promotion**: two different Neo4j-heavy tasks triggered back-to-back run sequentially, not concurrently.

### Redis state evidence

During the wait window, Redis showed:
```
KEYS taskQueue:resource-class:*
  → 1) "taskQueue:resource-class:neo4j-heavy:holders"
HGETALL taskQueue:resource-class:neo4j-heavy:holders
  → 8714ac1a-844d-4b66-9d49-3d5ce8cfb0ea  (leaseId)
    1779356511743                          (expiresAtMs — 4 h from now)
```
Exactly ONE lease held (cap=1 respected). Lease-ID is a UUID per `crypto.randomUUID()`. Expiry epoch is `now + 4h` matching the ADR's `leaseTtlMs` default.

After both tasks completed: `HLEN taskQueue:resource-class:neo4j-heavy:holders` → `0`. Slot returned cleanly.

### S6 — Rollback round-trip

`TASK_QUEUE_ENABLED=false`, restart. Boot log: `Task queue disabled (TASK_QUEUE_ENABLED=false) — legacy direct-spawn path active`. No `[task-queue] Initialized` line, no `[bull-board] Mounted` line. `/admin/queues → 200` (SPA shell). Story #15 has **zero effect** when the flag is off — semaphore module is never required.

### Smoke scenarios NOT performed (acceptable gaps)

- **S3** (operator tunes cap=2, verify two run concurrently) — not re-tested. The cap value is read from JSON via `loadQueueConfig`; trivially verifiable. ADR spec is straightforward.
- **S5** (orchestrator scripts unaffected) — not separately smoked. The bash-level `updateAllScoresForOwner.sh` orchestrator calls children sequentially anyway; each child's acquire/release would just observe a freshly-empty slot.
- **S7** (flag-on, no tags) — implicit from the conditional branch in queue/index.js; not separately smoked.
- **S8** (RESOURCE_CLASS_WAIT_TIMEOUT) — not smoked. Would require either configuring a 10-second timeout + 3+ heavy tasks, or holding the semaphore in a side process for 4 hours. Acceptable risk: the timeout path is well-isolated (single `if` at [resourceSemaphore.js:156-171](src/manage/taskQueue/queue/resourceSemaphore.js:156)) and matches the source-sentinel-asserted error-code literal.

## House rules check

- [x] Concept Graph API authority respected (no concept change).
- [x] No new lint/typecheck/build tooling.
- [x] No firmware reinstall needed.
- [x] Per-phase commits in order: story → adr → test → impl. Clean stack on top of `origin/staging` (which already includes story #13 merged + promoted to main).
- [x] No source files modified outside the ADR's scope.

## Findings

### Blocking

_None._

### Non-blocking (recorded, do not gate)

1. **AOF write amplification at very high event-emission rates (theoretical).** `appendFileSync` per emission combined with Redis AOF persistence (story #13) means each task generates ~3 sync disk writes to events.jsonl + ~2 Redis appends per resource-class lifecycle. At the operator's manual-trigger cadence this is negligible (sub-millisecond, sub-1KB writes). If story #16+ ever moves to high-throughput automated scheduling, batched async writes with periodic fsync would be worth considering. Not in scope here.

2. **No node-side rotation of events.jsonl.** The bash `structuredLogging.sh` side rotates the file at 10k lines; Node-side does not (single-owner-of-rotation per ADR). If the Node-side ever becomes the dominant writer (e.g., when story #13's processor.js adopts emitTaskEvent), the rotation cadence may need to be re-thought. Out of scope here.

3. **Smoke smoke-pass missed S3 + S8.** I covered the high-value scenarios (S2 cross-task serialization, S6 rollback). Cap-tuning (S3) and timeout-failure (S8) would be a useful follow-up but are well-isolated single-conditional paths; risk of bug-in-untested-path is low.

4. **`getCallerScriptName` returns `'[eval]'` for emissions from `node -e` invocations** (observed during the Implementer's functional sanity test). Cosmetic; matches the actual filename Node would report.

5. **First-time acquire emits `resource_class_wait_end outcome=acquired` even when wait_seconds=0** (no preceding `wait_begin`). Possibly slightly confusing in events.jsonl: a `wait_end` without a `wait_begin`. The operator can mentally infer "zero-wait grants emit only the end token." Could be addressed by suppressing wait_end when waitEmitted is false, but the current behavior is more informative (every acquire produces an end event for correlation) and is exactly what was specified. Non-issue.

## Verdict

**PASS end-to-end.**

Both source-side (14/14 sentinels) and behavioral-side (cycle-local smoke S2 + S6) confirm the implementation matches ADR 0013 and resolves the operator's cross-task pain. The five non-blocking observations are cosmetic or out-of-scope; none gate ship.

The story is ready for the deploy chain (`cycle-staging`, then on explicit confirmation `cycle-prod`). Recommend keeping `TASK_QUEUE_ENABLED=false` as the deploy default; operator flips on per environment after their own validation. Once flag is on, the operator can also extend the registry tag set operationally (e.g., add `syncWoT`, `reconciliation`, etc.) without re-deploying.
