# ADR 0013: Cross-task Neo4j-heavy serialization via Redis-backed counted semaphore

**Status:** Proposed
**Date:** 2026-05-21
**Story:** `engineering-team/stories/15-task-queue-neo4j-resource-class.md`
**Builds on:** ADR 0012 (story #13 — task-queue phase 1 BullMQ)

## Context

Story #13 / ADR 0012 shipped per-task BullMQ Queue+Worker pairs with per-task concurrency caps (default 1) and per-`(taskName, pubkey)` jobId dedup. Confirmed in production cycle-staging + cycle-prod: each task name correctly serializes against itself. But **two different task names** (e.g., `calculateOwnerGrapeRank` and `calculateOwnerPageRank`) live in different per-task queues with independent concurrency budgets and run concurrently — directly reproduced on `brainstorm.world` after #13's promote, matching the operational pain the operator originally articulated when story #13 was being planned.

ADR 0012's "Forward-compat hook" pinned the architectural shape for this story:

> Per-task queues are the natural injection point for the future "Neo4j-heavy class" cross-task coordination story. That sibling story will: (1) Add an optional `resourceClass` field to task registry entries (e.g., `"resourceClass": "neo4j-heavy"`). (2) Add a Redis-backed counted semaphore module (e.g., `neo4j-heavy: max 1`). (3) Wrap each Worker's processor with `acquire(resourceClass) → run → release(resourceClass)`.

This ADR ratifies that design and resolves the four Architect-deferred questions from story #15: semaphore primitive, wait-timeout behavior, config-file location, and single-string vs. list `resourceClass`.

### Grounded facts after re-reading the shipped source

- **Worker construction** ([src/manage/taskQueue/queue/index.js:103](src/manage/taskQueue/queue/index.js:103)): `new Worker(taskName, async (job) => processor.processJob(job, taskDef), { connection: redis, concurrency })`. The Worker callback closure already has `taskDef` in scope — the natural place to wrap `processJob` with semaphore acquire/release. Keeps [processor.js](src/manage/taskQueue/queue/processor.js) resource-class-agnostic.
- **Processor signature** ([processor.js:73](src/manage/taskQueue/queue/processor.js:73)): `processJob(job, taskDef) → Promise<result>`. No internal changes needed; the wrap is around the call.
- **Shared ioredis connection** is already provided by `_state.redis` from ADR 0012. The semaphore reuses it (BullMQ duplicates internally for blocking ops; the semaphore's Lua scripts are not blocking, so the shared connection works directly).
- **Owner trio in registry** confirmed present at the top level of `taskRegistry.json`: `calculateOwnerHops`, `calculateOwnerPageRank`, `calculateOwnerGrapeRank`. Each has a standard top-level shape (name, script, arguments, scope) — adding a sibling `resourceClass` field is non-invasive.
- **Story #13's config file** at `/etc/brainstorm-task-queue.json` already established the shape `{defaultConcurrency, concurrencyByTask}`. Extending it with a sibling `resourceClassCaps` key is the obvious single-file operator surface.
- **No `emit_task_event` Node-side equivalent exists yet** — story #13's processor uses plain `console.log` for queue-side logging. This ADR adds the Node-side equivalent (`src/utils/structuredEvents.js`) so queue events land in `events.jsonl` alongside bash-emitted events — making the existing structured-event UI / `events.jsonl` grep workflow uniform across bash- and Node-emitted events. (PO-resolved: invest now rather than defer.)

### Concept-graph impact

None. `/api/concept-graph/summaries` returns zero concepts matching `task|queue|redis|concurrency|semaphore|dispatch|worker|scheduler|bull` — operational/infrastructure layer only. **Firmware reinstall: no.**

## Options considered

### Option A — Custom Lua-scripted counted semaphore with TTL leases + poll-and-retry acquire (chosen)

A small new module `src/manage/taskQueue/queue/resourceSemaphore.js`. Per-class state lives in a Redis hash `taskQueue:resource-class:<className>:holders`, mapping `leaseId → expiresAtMs`. Operations:

- **Acquire** (atomic via a Lua script):
  1. Sweep entries with `expiresAtMs < now` (crash-recovery — if a Worker died without releasing, its lease ages out and the next acquirer reclaims the slot).
  2. If `HLEN(holders) < cap`, `HSET leaseId = now + leaseTtlMs`, return `1` (acquired).
  3. Otherwise return `0` (denied).
- **Release**: `HDEL holders leaseId`.
- **Wait loop** (JS-side): on denial, sleep 500 ms, retry. Hard timeout at `acquireTimeoutMs` (default 4 h) → reject with `RESOURCE_CLASS_WAIT_TIMEOUT`.

Wrap at Worker construction in `queue/index.js` (NOT inside `processor.js`):
```js
const sem = resourceSemaphore.createSemaphore(redis, queueConfig.resourceClassCaps || {});
// ...
const worker = new Worker(taskName, async (job) => {
  const rc = taskDef.resourceClass;
  if (rc) {
    const release = await sem.acquire(rc);
    try { return await processor.processJob(job, taskDef); }
    finally { await release(); }
  }
  return processor.processJob(job, taskDef);
}, { connection: redis, concurrency });
```

**Pros**
- No new external dependency. Lua script is ~25 lines; JS wrapper ~80 lines.
- TTL leases give crash-safety automatically — a Worker that dies mid-task doesn't permanently consume a slot. Next acquirer sweeps the stale lease.
- Composes cleanly with story #13's per-task concurrency: a task with both per-task cap and resourceClass cap waits on whichever binds first.
- Reuses the existing shared `ioredis` connection — no extra Redis client.
- Processor stays resource-class-agnostic. Future stories that add new wrap behavior (rate-limiting, priority, etc.) follow the same pattern: edit the Worker callback in queue/index.js.
- Operator failure mode is recognizable: `RESOURCE_CLASS_WAIT_TIMEOUT` is a literal error code; BullMQ marks the job failed with the error message visible in BullBoard's "failed" tab.

**Cons**
- 500 ms polling adds ~2 Redis ops/sec per waiter. At a cap of 1 and the operator's manual-trigger cadence, this is irrelevant load (Redis handles 10k+ ops/sec trivially).
- TTL sweep is best-effort: if the entire process dies and no other acquire fires, the lease can technically outlive its TTL until the next acquire sweeps it. Acceptable because Worker restart implies a new acquire immediately.
- BullMQ's BullBoard shows the waiting task as `active` (the Worker is in its processor callback, just sleeping in the acquire loop). This matches story #15's accepted observability minimum (structured events on wait) — the BullBoard misleading-active-state is documented and operator-detectable via the wait events.

### Option B — Redlock or @sesamecare-oss/redlock library (counted-semaphore variant)

Add a battle-tested distributed-lock library that ships counted-semaphore primitives.

**Pros:** library handles fencing tokens, retry/backoff, crash-recovery internally; less code to maintain.
**Cons:** new dependency for a single tiny use-case (~80 lines of our own code); redlock's algorithm is designed for multi-Redis-node clusters we don't have; brings opinionated retry behavior that may interact unpredictably with BullMQ's retry behavior. Rejected on minimal-deps + YAGNI grounds.

### Option C — Defer marking the job `active` until the semaphore acquires (use BullMQ's `waiting` state to model the wait)

Custom Worker that polls Redis for jobs in `waiting`, checks semaphore availability, and only `moveToActive`s when both are satisfied.

**Pros:** BullBoard shows the wait state honestly (jobs appear in `waiting` while semaphore is full).
**Cons:** rewrites the Worker dispatch loop that BullMQ provides. Significant complexity for a UI nicety. Story #15 explicitly marks this an "Architect upgrade if cheap" — it isn't cheap. Rejected; deferred as a potential follow-up if operator observability proves inadequate in practice.

### Option D — BullMQ's per-Worker `limiter` option

BullMQ Workers accept `{ limiter: { max: N, duration: Y } }`. But this is per-Worker, not cross-Worker. With 51 Workers (one per task), there's no way to share a limiter across `calculateOwnerGrapeRank` and `calculateOwnerPageRank` Workers using this API.

Rejected — doesn't address the cross-task case at all.

## Decision

**We chose Option A** — custom Lua-scripted counted semaphore with TTL leases, polling acquire loop, wrap at Worker callback site.

Reasons:
- Smallest mechanical bridge from ADR 0012's per-task queue topology to cross-task serialization.
- Uses the existing Redis dependency without adding a third concurrent library.
- TTL leases close the crash-leak hole that any blocking-pop-on-a-token-pool design would have.
- The Lua-script + 500ms-poll pair is well within the operator's mental model (read the script, understand the semantics in 5 minutes).
- Composes additively with story #13's per-task concurrency — no breakage, just an additional gate.

What we are trading away: visual fidelity in BullBoard (jobs appear `active` during wait, not `waiting`). Mitigated by the structured-event vocabulary that tells the operator what's happening; upgrade to honest `waiting` state is a future story if needed.

## Consequences

**Enabled**
- Operator can trigger `calculateOwnerGrapeRank` + `calculateOwnerPageRank` back-to-back from Task Explorer and have them automatically serialize through Neo4j, eliminating the manual "wait for one to finish before starting the next" discipline.
- Future resource classes (e.g., `io-bound`, `cpu-heavy`) are a one-config-line addition with no code change — the semaphore module is class-agnostic.
- A future "honest `waiting` state in BullBoard" upgrade is mechanically possible without touching the registry or the cap configuration.

**Constrained / made harder**
- Adds a new module (`resourceSemaphore.js`) and a wrap point in the Worker callback. Anyone modifying queue/index.js needs to remember the wrap exists.
- The 500 ms poll cadence is a tunable, but adds a small heartbeat of Redis traffic when many tasks are waiting on the same class. Bounded; not concerning at expected scale.
- Operator who tags a task with a non-existent `resourceClass` (typo) gets `cap = 0` semantics in this design (no entry in `resourceClassCaps` → undefined → treated as 0 → tasks never acquire). Mitigation: log a warning at init for tagged-but-unconfigured classes; treat missing-cap as cap=1 with a console warning (operator-friendly default).

**Follow-up debt (out of scope here)**
- **BullBoard honest `waiting` state** (Option C above).
- **Per-customer or per-tenant resource budgets.** This story does global per-class caps.
- **Adopt `structuredEvents.emitTaskEvent` in story #13's processor.js** so queue-lifecycle events (currently `console.log`-only) also land in `events.jsonl`. Trivial follow-up commit once the helper exists.

**Firmware reinstall required?** No.

## Implementation notes

The Implementer reads this section verbatim.

### New files

- **`src/utils/structuredEvents.js`** — Node-side equivalent of bash `emit_task_event` (from `src/utils/structuredLogging.sh`). Exports:
  - `emitTaskEvent(eventType, taskName, target, metadata)` — writes a single JSONL line to `${BRAINSTORM_LOG_DIR}/taskQueue/events.jsonl` matching the bash version's shape exactly:
    ```json
    {"timestamp":"<ISO-8601>","eventType":"<...>","taskName":"<...>","target":"<...>","metadata":{...},"scriptName":"<source.js>","pid":<process.pid>}
    ```
  - Reads `BRAINSTORM_LOG_DIR` from `brainstormConfig.get('BRAINSTORM_LOG_DIR')` (defaults to `/var/log/brainstorm`).
  - Implementation: `fs.appendFileSync(path, line + '\n')`. Atomic at the syscall level for line sizes under `PIPE_BUF` (4 KB on Linux); resource-class metadata payloads are <500 bytes, well within bounds. Sync write is acceptable because emissions are infrequent (a handful per minute under expected load).
  - Captures `scriptName` from `require.main` or the call stack (best-effort; fallback to `'node'`). `pid` is `process.pid` of the control-panel process — that's correct attribution since all Worker emissions originate there (in contrast to bash where each spawned script has its own `$$`).
  - Honors `BRAINSTORM_STRUCTURED_LOGGING=false` env var to short-circuit (matches the bash version's gate).
  - Does NOT implement the bash version's rotation (`BRAINSTORM_EVENTS_MAX_SIZE`) — the bash side already rotates this file; Node-side just appends. Architect's call to keep ownership of rotation in one place.
  - Future stories (Cypher dedup, story #13's processor, etc.) can adopt this helper as an incremental cleanup; not required by this story.

- **`src/manage/taskQueue/queue/resourceSemaphore.js`** — exports:
  - `createSemaphore(redis, caps, options?)` — factory. `caps` is the `resourceClassCaps` object (`{ "neo4j-heavy": 1, ... }`). `options` is optional with `{ leaseTtlMs, pollIntervalMs, acquireTimeoutMs }` defaults below.
  - The returned semaphore has `.acquire(resourceClass) → Promise<release>` where `release` is an `async () => Promise<void>` to release the lease. On timeout, the Promise rejects with an `Error` whose `code === 'RESOURCE_CLASS_WAIT_TIMEOUT'`.
  - On startup, validate that every task in the registry whose `resourceClass` is set has a corresponding entry in `caps`. For mismatches: log a warning `[task-queue] Task X has resourceClass Y but caps has no entry — treating as cap=1 with warning`; proceed with effective cap = 1.
  - Defaults: `leaseTtlMs = 4 * 60 * 60 * 1000` (4 hours), `pollIntervalMs = 500`, `acquireTimeoutMs = 4 * 60 * 60 * 1000` (4 hours).
  - Internal Lua script (loaded once at construction via `redis.defineCommand`):
    ```lua
    -- KEYS[1] = holders key (Redis hash)
    -- ARGV: leaseId, cap, leaseTtlMs, nowMs
    local fields = redis.call('HGETALL', KEYS[1])
    for i = 1, #fields, 2 do
      if tonumber(fields[i+1]) < tonumber(ARGV[4]) then
        redis.call('HDEL', KEYS[1], fields[i])
      end
    end
    local current = redis.call('HLEN', KEYS[1])
    if current < tonumber(ARGV[2]) then
      redis.call('HSET', KEYS[1], ARGV[1], tonumber(ARGV[4]) + tonumber(ARGV[3]))
      return 1
    end
    return 0
    ```
  - Acquire emits **structured events via `structuredEvents.emitTaskEvent`** (new — see below) — same JSONL shape as bash-side `emit_task_event`, landing in the same `events.jsonl`:
    - On wait-begin: `eventType="PROGRESS"`, `taskName=<taskName-being-waited-for>`, `metadata={phase:"resource_class_wait_begin", resourceClass, cap, jobId}`.
    - On wait-end (acquired): `eventType="PROGRESS"`, `metadata={phase:"resource_class_wait_end", resourceClass, wait_seconds, outcome:"acquired", jobId}`.
    - On wait-end (timeout): `eventType="TASK_ERROR"`, `metadata={phase:"resource_class_wait_end", resourceClass, wait_seconds, outcome:"timeout", jobId}` and reject the Promise.
  - On release: `emitTaskEvent("PROGRESS", taskName, "", {phase:"resource_class_released", resourceClass, held_seconds, jobId})` (best-effort; ignore release errors).

### Edited files

- **`src/manage/taskQueue/queue/index.js`** — three changes inside `initTaskQueue`:
  1. After loading `queueConfig`, construct the semaphore: `const semaphore = resourceSemaphore.createSemaphore(redis, queueConfig.resourceClassCaps || {});`
  2. Inside the Worker construction loop, wrap the processor callback:
     ```js
     const rc = taskDef && taskDef.resourceClass;
     const workerFn = rc
       ? async (job) => {
           const release = await semaphore.acquire(rc, { jobId: job.id });
           try { return await processor.processJob(job, taskDef); }
           finally { await release(); }
         }
       : async (job) => processor.processJob(job, taskDef);
     const worker = new Worker(taskName, workerFn, { connection: redis, concurrency });
     ```
  3. Add `semaphore` to the `_state` object; close it in `closeTaskQueue` (no-op call for the Lua-scripted variant; the JS module just clears its in-memory map).
- Optionally export `getSemaphore()` for cycle-local smoke / future tooling.

- **`src/manage/taskQueue/taskRegistry.json`** — add `"resourceClass": "neo4j-heavy"` to each of the three owner-trio entries (top-level, alongside `name`, `script`, etc.):
  - `calculateOwnerHops`
  - `calculateOwnerPageRank`
  - `calculateOwnerGrapeRank`

### Config

- **`/etc/brainstorm-task-queue.json`** — extend the JSON shape with a sibling `resourceClassCaps` key. Deploy default:
  ```json
  {
    "defaultConcurrency": 1,
    "concurrencyByTask": {},
    "resourceClassCaps": {
      "neo4j-heavy": 1
    }
  }
  ```
  The Implementer ships the deploy-time default in whichever file generation step produces `/etc/brainstorm-task-queue.json` on the droplet. If no such generation step exists yet (story #13 may have left it as "operator-creates-on-demand"), the queue module already handles the missing-file case (empty `resourceClassCaps` → no class enforcement, all tagged tasks log a warning + proceed at cap=1).

### Documentation (`OPERATIONS.md` §10)

Add a new subsection **§10.6 Resource-class concurrency caps**:
- Explains the `resourceClass` registry field and the `resourceClassCaps` config key.
- Documents the initial `neo4j-heavy: 1` cap and the three tagged tasks.
- Documents the structured-event vocabulary written to `events.jsonl` via the new `src/utils/structuredEvents.js`:
  - `metadata.phase: "resource_class_wait_begin"` — waiter starts polling for a slot.
  - `metadata.phase: "resource_class_wait_end"` with `metadata.outcome: "acquired" | "timeout"` — wait resolved.
  - `metadata.phase: "resource_class_released"` — task done, slot returned.
  Each event's `taskName` is the task being waited on; `metadata.resourceClass` identifies the class.
- Documents how to add a new tagged task: add `"resourceClass": "<class>"` to the registry entry, ensure `<class>` is in `resourceClassCaps`, restart control-panel.
- Documents how to raise/lower a cap: edit `resourceClassCaps` in `/etc/brainstorm-task-queue.json`, restart control-panel.
- Documents the rare `RESOURCE_CLASS_WAIT_TIMEOUT` failure mode and what it means.

### Tests

The Tester writes source-sentinel tests pinning:
- `resourceSemaphore.js` exists, exports `createSemaphore`, uses Redis Lua scripting, has the `RESOURCE_CLASS_WAIT_TIMEOUT` error code literal.
- `queue/index.js` constructs a semaphore and wraps the Worker callback conditionally on `taskDef.resourceClass`.
- `taskRegistry.json` has `"resourceClass": "neo4j-heavy"` on the three owner-trio entries.
- `src/utils/structuredEvents.js` exists and exports `emitTaskEvent` with the bash-matching JSONL shape (writes to `${BRAINSTORM_LOG_DIR}/taskQueue/events.jsonl`).
- `resourceSemaphore.js` calls `structuredEvents.emitTaskEvent` (not `console.log`) for `resource_class_wait_begin` / `resource_class_wait_end` / `resource_class_released` phase tokens.
- `OPERATIONS.md` §10.6 documents the new vocabulary.
- Regression: story #13's per-task concurrency (`concurrencyByTask`), `jobId` dedup, BullBoard mount, feature-flag rollback, and 503 path remain intact.

Cycle-local smoke (Reviewer-driven) validates the behavioral round-trip: trigger `calculateOwnerHops + calculateOwnerPageRank` with flag on + tags applied, observe the second waits via console-log `phase=wait_begin` then `phase=wait_end outcome=acquired` once the first releases.

### Concept handle

None. No new concepts.

## Out of scope

- **Honest `waiting` state in BullBoard** (Option C). Deferred unless operator observability proves inadequate in practice.
- **Multi-class `resourceClass`** (e.g., `["neo4j-heavy", "io-bound"]`). Single string in this story; can be extended later without breaking the registry.
- **Per-customer or per-tenant resource budgets.** Global per-class caps only.
- **Auto-tagging additional tasks** as `neo4j-heavy`. Operator extends operationally.
- **Retrofitting the legacy direct-spawn path** (`TASK_QUEUE_ENABLED=false`). Same scope boundary as ADR 0012.
- **Cross-host distributed coordination.** Single droplet, single Redis.
- **Pub/Sub wake-up instead of polling.** Polling at 500 ms is plenty for the expected cap/cadence.
