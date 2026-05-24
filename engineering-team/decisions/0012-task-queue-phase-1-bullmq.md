# ADR 0012: Route /api/run-task through BullMQ (task queue, phase 1)

> **Renumbered from ADR 0010 → 0012 at merge time:** story #14 (community-class-thread-pull) shipped to staging in parallel and consumed ADR slots 0010 + 0011 (its architecture + amendment). This ADR's content is unchanged; only the number moved. Inline references to "ADR 0010" in the test code's assertion messages and the test plan's "Verification" paste-in remain as historical artifacts of when this story was numbered 0010 on its branch.

**Status:** Proposed
**Date:** 2026-05-20
**Story:** `engineering-team/stories/13-task-queue-phase-1-bullmq-behind-run-task.md`

## Context

The story has already resolved the heavy strategic questions at planning (in-process worker, BullBoard for observability, AOF persistence, no push notifications, feature-flag rollback path). This ADR's job is the *mechanical* design: queue topology, dedup mechanism, sync-vs-async wrapper, BullBoard mount, Redis configuration patch, and the forward-compat hook the PO asked for so a future cross-task coordination story doesn't have to re-architect the dispatcher.

Grounded facts after reading the relevant source:

- **`/api/run-task` is unauthenticated today** ([src/api/index.js:270](src/api/index.js:270): `app.post('/api/run-task', manage.handleRunTask);` — no middleware). The story's "Out of scope" preserves this. BullBoard is the only new authed surface.
- **`runTask.js` already distinguishes sync from async** via `determineExecutionMode(timeoutConfig, task)` ([src/api/manage/commands/runTask.js:103-114](src/api/manage/commands/runTask.js:103)) and exposes two response shapes — sync (`{success, execution, message}` after completion) and async (`{success, execution: {async:true, pid, ...}, monitoring}` immediately). Both shapes must survive the queue layer for UI compatibility.
- **`launchChildTask.sh`'s `pgrep` guard remains in place** as belt-and-suspenders this phase (story AC). The queue's job ID dedup is the primary mechanism; `pgrep` is the secondary catch.
- **Task registry has 51 entries**: 15 customer-scoped (`arguments.customer = true`), 36 non-customer (`arguments` is `false` or missing the `customer` flag).
- **Redis is already used twice** in this codebase: by `src/pipeline/stream/redis-consumer.js` (strfry events queue via `blpop` on `strfry:events`) and by `bin/control-panel.js` (session store via `connect-redis`). BullMQ would be a third tenant, scoped to its own `bull:` key prefix — no key-space collision.
- **`ioredis` is already a direct dependency** at `^5.10.1`. BullMQ uses `ioredis` under the hood, so adding `bullmq` does not introduce a transitive Redis-client redundancy.
- **Admin auth pattern exists**: `adminApi.requireOwnerOnly` ([src/api/index.js:454-457](src/api/index.js:454)) — the canonical middleware for owner-only routes.
- **Redis is a Docker Compose service** (`tapestry-redis` per `docker ps`, configured via `docker/supervisord.conf` env + `docker/entrypoint.sh`). AOF persistence is enabled at the Redis container level, not in app code.

### Concept-graph impact

None. The Concept Graph `/api/concept-graph/summaries` returns zero concepts matching `task|queue|schedul|redis|bull|job|dispatch|worker` — this story is purely operational/infrastructure. **Firmware reinstall: no.**

## Options considered

### Option A — Per-task BullMQ queues + jobId-based dedup + in-process worker (chosen)

One BullMQ `Queue` and one `Worker` per `taskRegistry` task name. 51 (taskName, queue, worker) triples at full enrollment, sharing a single underlying `ioredis` connection via BullMQ's `connection` reuse. Each Worker's concurrency is configurable per task; default `1` for every task in phase 1 (matches the existing pgrep-serialization behavior).

**Dedup:** BullMQ's `Queue.add(name, data, { jobId })` is idempotent on `jobId` while a job with that ID exists in Redis. Empirically — confirmed against `bullmq@5.76.10` in [ADR 0022](0022-manual-task-retrigger-dedup-fix.md) — that idempotency spans **all job states**, including `completed` and `failed`, not only `wait`/`active`. To restore the wait/active-only dedup window we actually want (concurrent same-jobId fires join one execution while the job is running; once it finishes, a fresh add creates a fresh execution), we pass `removeOnComplete: true` and `removeOnFail: true` on every `queue.add`:

```js
queue.add(taskName, data, { jobId, removeOnComplete: true, removeOnFail: true })
```

These options map to BullMQ's `{count: 0}` `keepJobs` semantics, which delete the per-job Redis hash as part of finalization. With the hash gone, the next `queue.add` for the same jobId finds nothing in any state and creates a fresh job — the wait/active-only dedup window the AC requires. We compute:
```
jobId = customerTask ? `${taskName}:${pubkey}` : `${taskName}`
```
This satisfies the per-`(taskName, pubkey)` dedup AC for customer tasks and per-`taskName` dedup for non-customer tasks, using BullMQ-native mechanics (no custom precheck). See ADR 0022 for the empirical probe (`test/probe-bullmq-removeOnComplete-immediate.js`) that pins this behavior against the installed BullMQ version and the deployment dry-run analysis showing the no-downtime path.

**Sync vs async:** preserved by branching on the existing `determineExecutionMode`:
- **Async path:** `await queue.add(jobId, data); return res.json({queued: true, jobId, status: 'queued', ...})` — immediate response, same shape as today's async response (substitutes `jobId` for `pid` and adds it alongside; keeps legacy `pid` field as `null` to avoid breaking parsers).
- **Sync path:** `const job = await queue.add(jobId, data); const result = await job.waitUntilFinished(queueEvents, timeoutMs); return res.json({...})` — Express handler waits up to the configured timeout; same wait semantics as today's `child.on('close')`.

**Worker processor:** invokes `launchChildTask.sh` the same way `executeTask` does today — same args, same stdout parsing, same `LAUNCHCHILDTASK_RESULT` JSON capture. The worker is a thin adapter; `launchChildTask.sh`'s pgrep guard remains untouched.

**Feature flag:** `TASK_QUEUE_ENABLED` in `/etc/brainstorm.conf` (default **`false`** initially). `runTask.js` branches:
```
if (TASK_QUEUE_ENABLED === 'true') return runViaQueue(...);
else return runViaDirectSpawn(...);   // current code path, unchanged
```
When false, the diff against today is functionally zero — the rollback path is "set the flag and restart."

**Per-task concurrency config:** server-side file at `/etc/brainstorm-task-queue.json` (or a new section of `brainstorm.conf`; ADR leaves the exact location for the Implementer to choose between two named places, both well-trodden). Shape:
```json
{
  "concurrencyByTask": {
    "calculateCustomerGrapeRank": 1,
    "calculateOwnerGrapeRank": 1,
    "...": 1
  },
  "defaultConcurrency": 1
}
```
Worker reads this at startup. Unset tasks get `defaultConcurrency`. No UI for tuning in this phase (per story Out of scope).

**BullBoard mount:** mount the Express adapter at `/admin/queues` behind `adminApi.requireOwnerOnly` ([src/api/index.js:454-457](src/api/index.js:454) for the canonical use). Mount-time wrapping:
```js
app.use('/admin/queues', adminApi.requireOwnerOnly, serverAdapter.getRouter());
```
Render a header banner ("Task Queue Operations — Owner Only — retry / remove / pause can affect running calculations") via BullBoard's UI config or a wrapping middleware that injects an HTML banner — Implementer picks the cheaper option.

**Redis AOF persistence:** patch the Redis container's startup so `redis-server` runs with `--appendonly yes --appendfsync everysec`. Concretely: add the flags to the `command:` in `docker-compose.yml` for the `tapestry-redis` service, or supply a `redis.conf` mounted as a volume. Implementer picks; both are reversible.

**Forward-compat hook (PO open-question response):** per-task queues are the **natural injection point** for the future "Neo4j-heavy class" cross-task coordination story. That sibling story will:
1. Add an optional `resourceClass` field to task registry entries (e.g., `"resourceClass": "neo4j-heavy"`).
2. Add a Redis-backed counted semaphore module (e.g., `neo4j-heavy: max 1`).
3. Wrap each Worker's processor with `acquire(resourceClass) → run → release(resourceClass)`.

The dispatcher architecture chosen here makes step 3 a one-line wrapper around each Worker's processor function — no refactor of the queue topology, no change to enqueue semantics. **This ADR does NOT introduce the `resourceClass` field or the semaphore.** Phase-1 scope is enforced; the design just leaves the door open.

**Redis-as-queue-runtime dependency:** when `TASK_QUEUE_ENABLED=true` and Redis is unreachable, `/api/run-task` returns **503** with body `{success:false, error:"task queue (Redis) unreachable", code:"QUEUE_UNAVAILABLE"}`. The flag-off direct-spawn path is the rollback (no Redis required).

**Pros**
- Native BullMQ semantics throughout (dedup, retry, observability) — minimal custom code.
- Per-task queue topology gives natural per-task concurrency tuning AND clean injection point for the cross-task overlay.
- Sync vs async preserved at the response-shape level — no UI change required.
- Feature flag = clean rollback that costs nothing when off.
- BullBoard ships ~80% of operator-visibility value with one mount line.
- In-process worker = no new supervisord entry. If later problematic, refactor to separate process is mechanical (BullMQ Workers can run in any Node process pointing at the same Redis).
- Composes cleanly with the existing `launchChildTask.sh` `pgrep` guard (defense-in-depth this phase).

**Cons**
- 51 (queue, worker) pairs at full enrollment = ~50–100 Redis subscriptions/connections (BullMQ Workers each maintain a blocking-pop connection plus listener connections). Mitigation: BullMQ's `connection: sharedConnection` cuts this materially; document the connection-pooling choice in the Implementer's setup.
- Worker in the API process means a runaway worker can starve API responsiveness. Mitigation: per-task default concurrency `1`; long-running work is in a child process spawned by `launchChildTask.sh` anyway, so the worker itself is mostly idle awaiting child exit.
- BullBoard is a new direct dependency (`@bull-board/api`, `@bull-board/express`). Acceptable: story authorized it explicitly.
- BullBoard's `completed`/`failed` tabs are empty for queues using `removeOnComplete: true` / `removeOnFail: true` (added in [ADR 0022](0022-manual-task-retrigger-dedup-fix.md)) — `events.jsonl` is the durable failure record. The `wait`/`active`/`delayed` tabs are unaffected and remain the surface for "what is happening now."

### Option B — Single shared queue + custom Redis sorted-set for per-group concurrency

One BullMQ queue (`task-runner`), every job carries `taskName` and payload. Per-group concurrency implemented by the worker's processor consulting/incrementing a Redis sorted-set keyed by `${taskName}:${pubkey||''}` BEFORE invoking the task.

**Pros:** single queue, single worker, fewer Redis connections.

**Cons:**
- Reimplements per-group concurrency that BullMQ natively provides via per-queue worker concurrency — a poor reuse of the library.
- Job dedup loses BullMQ's `jobId` natively-idempotent semantics; you'd write a custom precheck (race-prone).
- BullBoard UI shows one queue with mixed task types — operator visibility worse than per-task queues.
- When the sibling cross-task story arrives, you'd still want resource-class tagging — and the single-queue model handles that no better than per-task queues do, with worse operator visibility along the way.

Rejected.

### Option C — In-process JS queue with sqlite WAL durability (no BullMQ)

Drop the BullMQ dependency. In-memory Map<groupKey, Queue> with sqlite-WAL append for crash-recovery durability.

**Pros:** zero new external dependency for queue semantics. No Redis-as-queue runtime dependency.

**Cons:**
- Reinvents BullMQ poorly. Retries, dedup, fairness, BullBoard-equivalent UI, all become local maintenance burden.
- Story explicitly authorized BullMQ; this is a re-litigation of the choice the operator already approved.
- Doesn't use Redis which is already provisioned.

Rejected. Listed for completeness.

### Option D — Raw `ioredis` + Lua scripts (no BullMQ)

Same goal as Option C but using Redis instead of sqlite. Custom Lua scripts for atomic enqueue/dequeue/dedup.

**Pros:** maximum visibility into the queue mechanics.

**Cons:** massive correctness work (retries, error handling, observability). Loses the BullMQ ecosystem (BullBoard, community-tested edge cases, etc.).

Rejected.

## Decision

**We chose Option A.**

Reasons:
- It's the only option that uses BullMQ as the story explicitly resolved at planning. Re-litigating that choice in Architecture is out of role.
- Per-task queues + BullMQ-native `jobId` dedup is the smallest mechanical bridge from today's direct-spawn behavior to a real queue. Sync/async semantics, the feature-flag rollback path, and BullBoard mount all fall out naturally.
- The architecture leaves the cleanest possible hook for the sibling cross-task story: that story adds a `resourceClass` registry field and a semaphore wrapper around each Worker's processor — no refactor of the dispatcher or topology.

What we are trading away: a slightly heavier Redis connection footprint than a single-queue design. Acceptable per BullMQ's connection-sharing primitives.

## Consequences

**Enabled**
- Sibling story can layer cross-task Neo4j coordination on top with a one-line processor wrapper.
- Phase 2 (migrate `scheduled-tasks.json` to BullMQ repeatable jobs) is mechanical — the queues already exist; just add `Queue.add(name, data, { repeat: {...} })`.
- Phase 3 (systemd timer evaluation) can proceed task-by-task without architectural changes.
- BullBoard gives operator-grade visibility into queue state, retries, and failures without a custom UI.

**Constrained / made harder**
- Redis becomes a hard runtime dependency for `/api/run-task` when the flag is on. Mitigated by the feature flag (off = no dependency).
- The in-process worker means a BullMQ bug or runaway processor can interfere with API responsiveness. Per-task default `concurrency: 1` keeps the surface small; mitigation if it bites: separate worker process (mechanical refactor).
- 51 Worker instances at full enrollment is a real memory/connection footprint. Mitigated by shared `ioredis` connection; document the pattern.

**Follow-up debt (out of scope here)**
- **Cross-task Neo4j coordination** — sibling story (will become story #15 or similar).
- **Migrate `scheduled-tasks.json` to BullMQ repeatable jobs** — phase 2 story per the PO.
- **Systemd timer evaluation** — phase 3 story per the PO.
- **Per-task concurrency tuning UI** — explicitly deferred by the PO.
- **Push notifications on failure** — explicitly deferred by the PO.

**Firmware reinstall required?** No. No concept-graph or firmware concept changes.

## Implementation notes

The Implementer reads this section verbatim.

### New files

- **`src/manage/taskQueue/queue/index.js`** — module exports:
  - `initTaskQueue({ registry, config, redis })` — called once at startup; creates one `Queue` and one `Worker` per registry task. Workers share a single `ioredis` connection via `connection: sharedConnection`. Each Worker's `concurrency` resolved from the per-task config; default from `defaultConcurrency`.
  - `enqueueTask({ taskName, customerArgs, queryParams, executionMode, timeoutMs })` — computes `jobId`, calls `queue.add(jobId, data, { jobId })`. Returns the BullMQ `job` instance.
  - `runViaQueueSync({ taskName, ..., timeoutMs })` — enqueues + `await job.waitUntilFinished(queueEvents, timeoutMs)`. Returns the same response shape today's sync path returns.
  - `runViaQueueAsync({ taskName, ... })` — enqueues, returns the same response shape today's async path returns (with `jobId` added and `pid` set to `null`).
  - `isQueueAvailable()` — fast Redis-ping check; consumed by the 503 path in `runTask.js`.

- **`src/manage/taskQueue/queue/bullBoardMount.js`** — exports a function `mountBullBoard(app, { queues })` that creates the BullBoard server adapter, mounts at `/admin/queues` behind `adminApi.requireOwnerOnly`, and injects the "Owner Only" banner.

- **`src/manage/taskQueue/queue/processor.js`** — the per-task processor. Spawns `launchChildTask.sh` with the same `(taskName, parent, optionsJson, childArgs)` pattern `executeTask` uses today. Parses `LAUNCHCHILDTASK_RESULT` from stdout. Returns the structured result the BullMQ Worker stores on the job.

### Edited files

- **`src/api/manage/commands/runTask.js`** — add a top-level branch:
  ```js
  if (brainstormConfig.get('TASK_QUEUE_ENABLED') === 'true') {
    if (!await taskQueue.isQueueAvailable()) {
      return res.status(503).json({success:false, error:'task queue (Redis) unreachable', code:'QUEUE_UNAVAILABLE'});
    }
    if (executionConfig.executionMode.shouldRunAsync) {
      return res.json(await taskQueue.runViaQueueAsync({...}));
    } else {
      return res.json(await taskQueue.runViaQueueSync({..., timeoutMs}));
    }
  }
  // …existing direct-spawn path unchanged below…
  ```

- **`src/api/index.js`** — after the existing admin mounts (around line 454), add `require('./taskQueue/queue/bullBoardMount').mountBullBoard(app, { queues: taskQueue.getAllQueues() });` (wrapped in the same `TASK_QUEUE_ENABLED` check so disabled deployments don't mount the route).

- **`bin/control-panel.js`** — at startup, after Redis session-store init, call `await taskQueue.initTaskQueue({...})` (also gated on `TASK_QUEUE_ENABLED`).

### Config

- **`config/brainstorm.conf.template`** — append:
  ```bash
  # Task queue (story #13 / ADR 0012). When true, /api/run-task enqueues
  # jobs through BullMQ instead of directly spawning launchChildTask.sh.
  # When false (default in phase 1), the legacy direct-spawn path runs
  # unchanged — this is the rollback path. Requires Redis (already a
  # runtime dependency for sessions and the strfry stream consumer).
  export TASK_QUEUE_ENABLED=false
  ```

- **`/etc/brainstorm-task-queue.json`** (or a new section of `brainstorm.conf` — Implementer's call) — shape:
  ```json
  {
    "defaultConcurrency": 1,
    "concurrencyByTask": {}
  }
  ```
  Document this file in `OPERATIONS.md`. Phase 1 ships with `defaultConcurrency: 1` and an empty override map — every task is `concurrency: 1`.

### Redis configuration (deployment)

- Edit the `tapestry-redis` service's startup so Redis runs with `--appendonly yes --appendfsync everysec`. Two acceptable paths (Implementer picks):
  - Add to the `command:` in `docker-compose.yml`.
  - Mount a custom `redis.conf` (e.g., `docker/redis.conf`) as a volume.
- **Architect verification of strfry-stream-consumer interaction:** `redis-consumer.js` uses `blpop` on `strfry:events`. AOF semantics: every write (LPUSH/RPUSH/BLPOP-driven LREM) is appended to the AOF file. At `appendfsync everysec`, the fsync overhead is bounded; strfry-event write volume is modest. No semantic interaction; only an additional ~one extra disk write per event-list operation. Verified safe.

### Dependencies (`package.json`)

- Add `bullmq` (BullMQ — Redis-backed queue; uses `ioredis` we already have).
- Add `@bull-board/api` and `@bull-board/express` (BullBoard UI + Express adapter).
- No version pin opinion from the ADR — Implementer picks current stable.

### Documentation (`OPERATIONS.md`)

- Document `TASK_QUEUE_ENABLED` env var and the rollback path.
- Document `/admin/queues` URL and the requirement to be logged in as owner.
- Document drain / pause procedure: BullBoard supports pause/resume per queue; document the workflow ("to pause all incoming jobs: pause each queue in BullBoard; jobs remain queued and resume on unpause").
- Document the `concurrencyByTask` config file location and shape.
- Document the 503 `QUEUE_UNAVAILABLE` response and how to remediate (Redis health check).

### Concept handle

None. No new concepts.

## Out of scope

- **Cross-task Neo4j coordination** — sibling story per the PO. Architecture leaves a clean hook (per-task queues + a future `resourceClass` registry field + Redis semaphore wrapper).
- **Migrating `scheduled-tasks.json` to BullMQ repeatable jobs** — phase 2 story.
- **Retiring or converting systemd `.timer` units** — phase 3 story.
- **Removing or refactoring `launchChildTask.sh`'s `pgrep` guard** — keep as redundant safety this phase.
- **UI changes** to the Scheduled Tasks tab or Task Explorer.
- **Authentication on `/api/run-task`** — preserved as-is (unauthenticated; story Out of scope).
- **Per-task queue configuration UI** — server-side config file in phase 1.
- **Cross-host distributed workers** — single-host queue + single-host workers.
- **Removing the `pgrep` guard from `launchChildTask.sh`** — keep until BullMQ behavior is proven in production over multiple recalc cycles.
- **Push notifications on job failure** — explicitly deferred by the PO.
