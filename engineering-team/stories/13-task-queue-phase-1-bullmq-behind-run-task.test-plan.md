# Test Plan: Story 13 — Route /api/run-task through BullMQ (task queue, phase 1)

**Story:** `engineering-team/stories/13-task-queue-phase-1-bullmq-behind-run-task.md`
**ADR:** `engineering-team/decisions/0010-task-queue-phase-1-bullmq.md`
**Date:** 2026-05-20

## Approach

Same precedent as #5/#6/#8/#10/#11/#12. Source/structural sentinels in the hand-rolled Node runner pin the ADR-required code shape — new files (`queue/index.js`, `queue/processor.js`, `queue/bullBoardMount.js`), feature-flag gate (`TASK_QUEUE_ENABLED`), BullMQ-native `jobId` dedup pattern, BullBoard mount at `/admin/queues` behind `requireOwnerOnly`, Redis AOF flags in the container startup, 503 `QUEUE_UNAVAILABLE` error code, and the `concurrencyByTask` config-consumer hooks.

The **behavioral round-trip** — actual dedup under two-concurrent-POSTs contention, actual sync `job.waitUntilFinished()` vs immediate async "queued" response, actual BullBoard owner-auth gate, actual flag-flip rollback, actual 503 on Redis-down, actual job survival across control-panel restart, actual AOF persistence across Redis restart, actual non-interference with the strfry-stream-consumer — is reproducible only against the live Docker stack and is the **authoritative cycle-local smoke** (Reviewer-required).

## Coverage map

| AC | Test / mechanism | File | Level |
|---|---|---|---|
| AC-1 (signature unchanged) | **R1** preserves the query-parameter names | test/task-queue-bullmq.test.js | source (regression sentinel) |
| AC-2 (BullMQ enqueue for customer-task) | **T1** (deps), **T2** (queue module exists + exports), **T13** (runTask.js branches on flag). Behavioral S1 = cycle-local | test/task-queue-bullmq.test.js | source + smoke |
| AC-3 (dedup on (taskName, pubkey)) | **T3** (queue module references both `jobId` and `pubkey` + `taskName`). Behavioral S2 = cycle-local | test/task-queue-bullmq.test.js | source + smoke |
| AC-4 (per-queue concurrency cap, configurable) | **T4** (queue module consumes `concurrency` and references `defaultConcurrency` or `concurrencyByTask`). Behavioral S3 = cycle-local | test/task-queue-bullmq.test.js | source + smoke |
| AC-5 (non-customer tasks: single-instance) | **T3** covers (same jobId-shape branching path) | test/task-queue-bullmq.test.js | source |
| AC-6 (BullMQ jobs invoke launchChildTask.sh; pgrep guard remains) | **T5** (processor invokes launchChildTask.sh) + **R4** (pgrep guard preserved) | test/task-queue-bullmq.test.js | source (positive + regression) |
| AC-7 (existing UIs work unchanged) | **R1** + **R2** (scheduled-tasks still POSTs to /api/run-task). Behavioral S4 = cycle-local | test/task-queue-bullmq.test.js | source + smoke |
| AC-8 (systemd timers continue) | **R1** + **R2** (same /api/run-task contract). Behavioral S5 = cycle-local | test/task-queue-bullmq.test.js | source + smoke |
| AC-9 (control-panel restart preserves jobs) | Behavioral S6 = cycle-local (BullMQ default retry; not source-pinnable) | — | smoke |
| AC-10 (Redis AOF + no adverse interaction with strfry-stream-consumer) | **T6** (AOF flags in docker-compose.yml or docker/redis.conf) + **R5** (redis-consumer.js unchanged). Behavioral S7 = cycle-local | test/task-queue-bullmq.test.js | source + smoke |
| AC-11 (BullBoard mount behind admin auth at /admin/queues) | **T1** (deps), **T7** (path + auth middleware). Behavioral S8 = cycle-local | test/task-queue-bullmq.test.js | source + smoke |
| AC-12 (in-process worker, no new supervisord entry) | **T8** (control-panel.js initializes queue gated on flag) + **T9** (no new supervisord `[program:...queue...]` entry) | test/task-queue-bullmq.test.js | source |
| AC-13 (sync vs async preserved) | **R3** (determineExecutionMode + resolveTaskTimeout still consumed). Behavioral S9 = cycle-local | test/task-queue-bullmq.test.js | source + smoke |
| AC-14 (push notifications NOT in scope) | n/a — negative AC, nothing to test | — | — |
| AC-15 (feature flag TASK_QUEUE_ENABLED toggles) | **T10** (`brainstorm.conf.template` defines `TASK_QUEUE_ENABLED=false`) + **T13** (runTask.js branches) + **T8** (control-panel gates init). Behavioral S10 = cycle-local | test/task-queue-bullmq.test.js | source + smoke |
| AC-16 (documentation in OPERATIONS.md) | **T11** (`TASK_QUEUE_ENABLED`, `/admin/queues`, drain/pause mentioned) | test/task-queue-bullmq.test.js | source |
| AC-17 (503 QUEUE_UNAVAILABLE when Redis unreachable + flag on) | **T12** (runTask.js references `QUEUE_UNAVAILABLE` + `503`). Behavioral S11 = cycle-local | test/task-queue-bullmq.test.js | source + smoke |

**Totals:** T1..T8, T10..T13 = **12 failing sentinels** pre-impl (flip to PASS post-impl). T9, R1..R5 = **6 regression guards** that PASS pre AND post (catch regressions on supervisord, runTask signature, scheduled-tasks contract, sync/async branching, pgrep guard, strfry-consumer).

## Edge cases

- [x] **Defensive file reads.** Every Tn that consumes a not-yet-existing file (`queue/index.js`, `queue/processor.js`, `queue/bullBoardMount.js`) uses `readSafe(p)` and short-circuits to "module missing — Tn must pass first" when the parent existence test (T2 or T5) fails. Avoids confusing "regex undefined" cascades.
- [x] **T3 jobId tolerance.** Doesn't pin a literal `${taskName}:${pubkey}` template — checks the module references all three tokens (`jobId`, `pubkey`, `taskName`) so the Implementer can write `customer ? \`${taskName}:${pubkey}\` : taskName` or any semantically-equivalent form.
- [x] **T6 AOF two-paths.** Implementer can either patch `docker-compose.yml`'s `command:` OR mount a `redis.conf`. Test accepts either; checks `docker-compose.yml` first, falls back to `docker/redis.conf` and `config/redis.conf`.
- [x] **T7 mount-module two-paths.** BullBoard mount can live in dedicated `bullBoardMount.js` OR inline in `src/api/index.js`. Test concatenates both candidates and checks the path + auth middleware appear in EITHER.
- [x] **T9 negative pattern tolerance.** Forbids new supervisord entries matching `[program:...]` AND containing any of `queue|worker|bull|taskqueue` (case-insensitive). Wide enough to catch most names; narrow enough that the existing entries (`tapestry`, `strfry`, `strfry-router`, `neo4j`, `nostr-search-api`, etc.) won't false-positive.
- [x] **T13 vs T8.** Both check `TASK_QUEUE_ENABLED` but in different files (runTask.js vs control-panel.js) — both branches are required and the ADR is explicit; redundant pin is intentional.
- [ ] **Real BullMQ semantics under contention, sync `waitUntilFinished` vs immediate "queued" responses, BullBoard auth gate, flag-flip rollback, 503 on Redis-down, job survival across control-panel restart, AOF persistence across Redis restart** — not catchable in source; **cycle-local smoke is the authoritative check**.

## Not covered (deferred to cycle-local smoke — authoritative, Reviewer-required)

Run on the local Docker stack (`http://localhost:80`; control-panel API), with `TASK_QUEUE_ENABLED=true` for behavioral scenarios:

**S1 — AC-2 (customer-task → BullMQ enqueue):** Flip flag on. `POST /api/run-task?taskName=calculateCustomerGrapeRank&pubkey=<pk>&customerId=<id>&customerName=<name>`. Assert: response indicates queued (sync or async per `determineExecutionMode`); inspecting Redis via `redis-cli KEYS 'bull:calculateCustomerGrapeRank:*'` shows job keys. Inspecting BullBoard's `/admin/queues` shows the queue with the job.

**S2 — AC-3 (dedup):** Two parallel POSTs for the same `(taskName, pubkey)` within ~100ms (use a fake cypher-shell shim that pauses, like S3 in story #12). Assert: BullBoard shows ONE job in `active` (not two); the second response indicates dedup (BullMQ returns the existing job; runTask.js surfaces this through whichever response field the Implementer chooses).

**S3 — AC-4 (per-customer concurrency for same task):** Two POSTs for the SAME `taskName` (`calculateCustomerGrapeRank`) but DIFFERENT customer pubkeys. With queue `concurrency: 1` (default), assert: one runs, one waits — observable in BullBoard (one `active`, one `waiting`). Raise `concurrencyByTask.calculateCustomerGrapeRank = 2` in the config file, restart control-panel, retry: assert both run concurrently.

**S4 — AC-7 (existing UIs work):** Open the Scheduled Tasks tab in the control-panel UI; trigger a task; assert it queues and surfaces run history the same way it does today. Open the Legacy Task Explorer (`/legacy/task-explorer.html`); trigger a task; assert response shape unchanged for the UI's parser.

**S5 — AC-8 (systemd timers):** Manually invoke a systemd `.timer`-driven script that hits `/api/run-task` (or simulate by curl with the same headers). Assert: enqueues; response same as today.

**S6 — AC-9 (control-panel restart preserves jobs):** Enqueue a long-running job (`calculateCustomerGrapeRank` or a deliberately-slow test task). Mid-execution, `supervisorctl restart brainstorm`. Assert: the in-flight job either continues or fails-and-retries per BullMQ defaults — NOT silently dropped. Verify via BullBoard's `failed`/`completed` views after the dust settles.

**S7 — AC-10 (Redis AOF persists across restart, no adverse interaction):** Enqueue several jobs (delayed start, so they sit in `waiting`). `docker restart tapestry-redis`. Assert: after Redis comes back, the jobs are still in `waiting`. Separately: tail `/var/log/brainstorm/...stream-consumer.log` during the Redis restart — confirm the strfry-stream-consumer (`redis-consumer.js`) reconnects cleanly via its existing reconnect path and resumes blpop on `strfry:events` without losing events.

**S8 — AC-11 (BullBoard mount + auth):** Logged out: `GET https://localhost/admin/queues` → redirect or 401/403 (whatever `requireOwnerOnly` does). Logged in as owner: → BullBoard UI renders, shows the per-task queues, exposes retry/remove/pause controls, and the "Owner Only — retry/remove/pause can affect running calculations" banner is visible.

**S9 — AC-13 (sync vs async response preservation):** For a SYNC task (per `determineExecutionMode` — short-timeout task): POST → response includes outcome (same shape as today's sync response). For an ASYNC task (long-timeout): POST → immediate response with `jobId` (and legacy `pid: null` per ADR §Option A: Sync vs async) so existing UI parsers don't break.

**S10 — AC-15 (feature-flag rollback):** With flag on and the queue running, set `TASK_QUEUE_ENABLED=false` in `/etc/brainstorm.conf`, `supervisorctl restart brainstorm`. Assert: `POST /api/run-task?...` now uses the legacy direct-spawn path (no BullMQ; no Redis dependency). Trigger a task; confirm behavior matches today's direct-spawn behavior exactly. Flip back on; confirm queue resumes.

**S11 — AC-17 (503 QUEUE_UNAVAILABLE):** With flag on, stop Redis: `docker stop tapestry-redis`. POST `/api/run-task?...`. Assert: response `503` with body `{success:false, error:"task queue (Redis) unreachable", code:"QUEUE_UNAVAILABLE"}`. Restart Redis; confirm POSTs succeed again.

## Test infrastructure

- Existing hand-rolled Node runner (`npm test` → `test/test.js`); no new deps.
- Registered: `taskQueueBullmq` (at the end of `test/test.js`'s suite list, after `graperankSharedCsvRace`).
- Asserts only against in-repo files: `package.json`, `src/api/manage/commands/runTask.js`, `src/manage/taskQueue/queue/{index,processor,bullBoardMount}.js` (new), `src/api/index.js`, `bin/control-panel.js`, `docker/supervisord.conf`, `docker-compose.yml` (and `docker/redis.conf` / `config/redis.conf` as alternates), `config/brainstorm.conf.template`, `OPERATIONS.md`, `src/manage/taskQueue/launchChildTask.sh`, `src/api/scheduled-tasks/index.js`, `src/pipeline/stream/redis-consumer.js`.
- No Playwright (the behavioral layer is HTTP + Redis + BullMQ + child-process orchestration — all smoke territory; nothing pure-frontend to render).

## How to run

```
npm test
```

Targeted: `node -e "require('./test/task-queue-bullmq.test.js').run()"`

## Verification

New tests fail on the pre-implementation tree (atop ADR commit `baeca451`):

```
task-queue-bullmq suite:
  ✗ T1: package.json declares bullmq, @bull-board/api, @bull-board/express as direct dependencies (AC-2, AC-11, ADR 0010 §Dependencies)
      package.json is missing required dependencies (AC-2/AC-11; ADR 0010 §Dependencies): bullmq, @bull-board/api, @bull-board/express. Add them under "dependencies" — ioredis is already present so no Redis-client duplication.
  ✗ T2: queue module exists at src/manage/taskQueue/queue/index.js and exports the dispatch surface (AC-2, AC-12, ADR 0010 §New files)
      Queue module does not exist at src/manage/taskQueue/queue/index.js (AC-2/AC-12; ADR 0010 §New files). Create the sourceable module that owns per-task BullMQ Queue + Worker pairs, the enqueue surface, and the sync/async wrappers (initTaskQueue, enqueueTask, runViaQueueSync, runViaQueueAsync, isQueueAvailable).
  ✗ T3: queue module computes jobId from (taskName, pubkey) for customer tasks and from taskName alone for non-customer tasks (AC-3, AC-5, ADR 0010 §Option A: Dedup)
      Queue module missing — T2 must pass first.
  ✗ T4: queue module consumes per-task concurrency configuration (AC-4, ADR 0010 §Option A: Per-task concurrency config)
      Queue module missing — T2 must pass first.
  ✗ T5: processor module exists and invokes launchChildTask.sh (AC-6, ADR 0010 §New files)
      Processor module does not exist at src/manage/taskQueue/queue/processor.js (AC-6; ADR 0010 §New files). Create the per-task processor that the Worker invokes; it must spawn launchChildTask.sh the same way executeTask does today, preserving the pgrep guard and the LAUNCHCHILDTASK_RESULT stdout parse.
  ✗ T6: Redis container is configured with AOF persistence (appendonly yes, appendfsync everysec) (AC-10, ADR 0010 §Redis configuration)
      Redis is not configured with AOF persistence (AC-10; ADR 0010 §Redis configuration). Patch the tapestry-redis service's startup: either add `--appendonly yes --appendfsync everysec` to the service's `command:` in docker-compose.yml, or mount a redis.conf at docker/redis.conf containing `appendonly yes` + `appendfsync everysec`. Without AOF, queued jobs are lost on Redis restart.
  ✗ T7: BullBoard is mounted at /admin/queues behind owner-only auth (AC-11, ADR 0010 §BullBoard mount)
      BullBoard is not mounted at the path `/admin/queues` (AC-11; ADR 0010 §BullBoard mount). The ADR pins this canonical admin-operations path; either the dedicated bullBoardMount.js module or src/api/index.js must reference it.
  ✗ T8: control-panel.js initializes the task queue at startup, gated on TASK_QUEUE_ENABLED (AC-12, AC-15, ADR 0010 §Edited files)
      bin/control-panel.js does not initialize the task queue module at startup (AC-12; ADR 0010 §Edited files). The in-process worker model requires the queue and Workers to be constructed during control-panel boot so they are ready when /api/run-task fires.
  ✓ T9: docker/supervisord.conf does NOT gain a new entry for a separate task-queue worker process (AC-12, ADR 0010 §Decision)
  ✗ T10: brainstorm.conf.template defines TASK_QUEUE_ENABLED=false as the default rollback-safe value (AC-15, ADR 0010 §Config)
      config/brainstorm.conf.template does not define `export TASK_QUEUE_ENABLED=false` (AC-15; ADR 0010 §Config). The knob must be present in the template (deployment installs it at /etc/brainstorm.conf) with the deploy-safe `false` default. Operator flips on after smoke confirms.
  ✗ T11: OPERATIONS.md documents the new env var, BullBoard URL, and the queue drain/pause workflow (AC-16, ADR 0010 §Documentation)
      OPERATIONS.md is missing documentation for: TASK_QUEUE_ENABLED, /admin/queues, drain / pause workflow (AC-16; ADR 0010 §Documentation). Operators need to know how to flip the flag, where to reach BullBoard, and how to drain or pause the queue for maintenance.
  ✗ T12: runTask.js returns 503 with code QUEUE_UNAVAILABLE when the queue is enabled but Redis is unreachable (AC-17, ADR 0010 §Implementation notes)
      runTask.js does not return the QUEUE_UNAVAILABLE 503 path (AC-17; ADR 0010 §Implementation notes). When TASK_QUEUE_ENABLED=true and Redis is unreachable, the handler must return 503 with body `{success:false, error:"task queue (Redis) unreachable", code:"QUEUE_UNAVAILABLE"}` so the failure mode is machine-identifiable.
  ✗ T13: runTask.js branches on TASK_QUEUE_ENABLED at the top of the handler (AC-2, AC-15, ADR 0010 §Implementation notes)
      runTask.js does not consult TASK_QUEUE_ENABLED (AC-2/AC-15; ADR 0010 §Implementation notes). The handler must branch on the feature flag — when true, delegate to the queue module; when false, run the existing direct-spawn path unchanged. That branch IS the rollback path.
  ✓ R1: runTask.js still accepts the existing query parameters (taskName, pubkey, customerId, customerName) (AC-1, regression guard)
  ✓ R2: scheduled-tasks/index.js still POSTs to /api/run-task (AC-7, AC-8, regression guard)
  ✓ R3: runTask.js still uses determineExecutionMode for the sync-vs-async branch (AC-13, regression guard)
  ✓ R4: launchChildTask.sh still implements its pgrep-based same-task serialization guard (AC-6, regression guard)
  ✓ R5: strfry-stream-consumer still uses ioredis blpop on `strfry:events` (AC-10, regression guard)

task-queue-bullmq suite:                         FAIL (6 passed, 12 failed)
Overall:                                         FAIL
```

All 11 prior suites continue to PASS (no regressions introduced by the new sentinel registration).
