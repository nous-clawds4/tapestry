# Review: Story 22 — Generalized Task Scheduler (durable, any-task, sub-hour)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-22
**Diff:** `git diff 458a736f..HEAD` (story #22 commits `0ab48fbf`→`1b12e73c`)

> **⚠️ Prod-promotion verdict revised 2026-05-22 → CHANGES REQUESTED.** The static-diff **PASS** below stands (scheduler design/code is correct), but the Reviewer-required staging smoke surfaced a **blocking, prod-scale failure** in the reconcile task this story exists to schedule. See the **Staging smoke addendum** at the end of this file. **Do not `cycle-prod`.**

> **Base note:** `main` does not yet contain the PR #185 merge (`458a736f`, story #21), so `git diff main...HEAD` pulls in all of story #21's reconciliation diff. This review isolates **story #22 only** by diffing against the #185 merge commit. Story #22 touches 13 files: `OPERATIONS.md`, `bin/control-panel.js`, `src/api/index.js`, `src/api/scheduled-tasks/index.js`, `src/manage/taskQueue/queue/scheduler.js` (new), the UI panel, the new test + two re-baselined tests + the runner, and the three engineering-team artifacts.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS**. 18/18 suites green, including the new `generalized-task-scheduler` suite **12/12** (T1–T8 flipped to PASS; R1–R4 green). The re-baselined `scheduled-search-and-house-scores-refresh` (12/12) and `task-queue-bullmq` (18/18) stay green. `reconciliation-incremental-mode` 16/16 unaffected. Overall: PASS.
- [ ] `npm run test:playwright` — not applicable at the sentinel layer (UI validation is part of the Chrome smoke, S9).
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped._

## Spec adherence

Every acceptance criterion has source-level coverage by a passing sentinel; the behavioral guarantees are deferred to cycle-local/staging smoke per the test plan's documented (and project-standard) approach.

- [x] **AC-1 any registered task schedulable** — `isRegisteredTask` validates against `taskRegistry.json` ([scheduled-tasks/index.js:42](src/api/scheduled-tasks/index.js:42)); `handleList` enumerates the registry ([:222](src/api/scheduled-tasks/index.js:222)); UI picker offers any task ([RelaySettings.jsx:1654](ui/src/pages/settings/RelaySettings.jsx:1654)). DEFAULTS gone. (T5)
- [x] **AC-2 interval OR cron** — `toRepeatOpts`: cron wins, else days/hours/minutes summed to `every` ms ([scheduler.js:44](src/manage/taskQueue/queue/scheduler.js:44)). (T6, T7)
- [x] **AC-3 sub-hour allowed** — 1-hour floor removed; `isValidSchedule` accepts any positive interval ([scheduler.js:54](src/manage/taskQueue/queue/scheduler.js:54)); no client-side floor ([RelaySettings.jsx:1434](ui/src/pages/settings/RelaySettings.jsx:1434)). (T4)
- [x] **AC-4 durable across restart** — BullMQ Job Schedulers persisted in Redis; boot reconcile re-wired ([control-panel.js:283](bin/control-panel.js:283)). Mechanism is correct (T1, R4). **Behavioral proof = S3, smoke-required.**
- [x] **AC-5 fires route through the queue** — scheduled job is an ordinary `upsertJobScheduler` add on the task's existing queue ([scheduler.js:70](src/manage/taskQueue/queue/scheduler.js:70)) → existing Worker → `processor.processJob`. Verified the processor handles a scheduled job's `{taskName,timeoutMs}` data: `buildChildArgs` guards on `customerArgs`/`queryParams` truthiness and pulls `staticArgs` from the registry ([processor.js:21-38](src/manage/taskQueue/queue/processor.js:21)), so `reconcileAll`'s `--mode all` is applied with no `customerArgs` present. (T1, R1)
- [x] **AC-6 no regression for existing schedules** — schema is backward-compatible (`intervalHours`/`intervalDays` still summed); `refreshSearchIndex`/`updateAllScoresForOwner` remain in the registry and migrate with no edit. (re-baselined scheduled-search suite). **Continuity proof = S4, smoke-required.**
- [x] **AC-7 in-process `setInterval` retired** — `makeTriggerTask`/`startScheduler`/`stopScheduler`/`initScheduler`/timer-polling all removed; grep finds **no dangling references** in `src/`, `bin/`, `ui/src/` (the one `DEFAULTS` hit is the unrelated `customer-schedule` module). (T3)
- [x] **AC-8 enable/disable + change interval/cron via panel, any task, reflects state** — `handleUpdate`/`handleStatus`/`handleList` ([scheduled-tasks/index.js:141-247](src/api/scheduled-tasks/index.js:141)); UI card has toggle + d/h/m + cron + next/last-run ([RelaySettings.jsx:1390](ui/src/pages/settings/RelaySettings.jsx:1390)). (T2, R3). **S7/S9 smoke.**
- [x] **AC-9 reconcileRecent/reconcileAll schedulable + serialize via `neo4j-heavy`** — both registered; `reconcileAll` carries `staticArgs:"--mode all"` + 8h timeout (confirmed in registry); routed through the semaphore-wrapped worker. Capability present. **Serialization proof = S5, smoke-required.**
- [x] **AC-10 no-surprise-bootstrap documented** — OPERATIONS §13.4 seed-via-`reconcileAll`-first runbook; scheduler stays reconciliation-agnostic. (T8)
- [x] **AC-11 OPERATIONS.md covers the scheduler** — §13 covers the mechanism, config shape, sub-hour/cron, durability + skip-no-backfill, kill-switch, retirement, runbook. (T8)
- [x] No behavior added beyond the story. Diff is tightly scoped — no unrelated edits in the #22 commits.

## ADR adherence

- [x] **Option A implemented exactly** — Job Schedulers on the existing per-task queues; `scheduled-tasks.json` is source of truth, Redis is execution layer, reconciled on boot + each update ([scheduler.js:115](src/manage/taskQueue/queue/scheduler.js:115)).
- [x] **Layout** — scheduler reconcile placed in the ADR-sanctioned sibling `src/manage/taskQueue/queue/scheduler.js`; uses the exported `getQueue`/`getAllQueues` ([queue/index.js:166,171](src/manage/taskQueue/queue/index.js:166)).
- [x] **Boot gating** — reconcile runs only when `taskQueueEnabled`, after `initTaskQueue` + `api.register`, wrapped in a non-fatal try/catch ([control-panel.js:283-289](bin/control-panel.js:283)). Sequencing correct (queue init at :267 precedes reconcile at :286).
- [x] **Kill-switch** — `"scheduler": false` in `/etc/brainstorm-task-queue.json` removes all managed schedulers and upserts none ([scheduler.js:28,116](src/manage/taskQueue/queue/scheduler.js:28)).
- [x] **Missed-fire policy** — skip-and-resume is inherent to Job Schedulers; documented in OPERATIONS §13.2.
- [x] **No-surprise-bootstrap** — generic scheduler knows nothing about watermarks (Q4 layering honored); protection is the runbook.
- [x] **No new dependencies** — `bullmq` already declared (R2). No lint/typecheck/build tooling added (house rule respected).
- [~] **One justified deviation:** the scheduled job's `data` is `{taskName, timeoutMs}` rather than the ADR's literal `{taskName}` ([scheduler.js:70-74](src/manage/taskQueue/queue/scheduler.js:70)). The added `timeoutMs` is read from the registry's `options.completion.failure.timeout.duration` so a scheduled fire honors the same per-task timeout a manual enqueue does (otherwise scheduled `reconcileAll` would run with `timeoutMs||0` = no timeout). This is additive and strictly better than the sketch — **non-blocking, no change required.**

## Concept-graph integrity

- [x] No domain concepts touched — operational/infra only (scheduler/queue). ADR documents Concept Graph API was unreachable at design time, consistent with ADR 0018. Handles N/A.
- [x] No concept definitions changed → **firmware reinstall not required** (ADR confirms).
- [x] New code orients via the queue module + registry, not by re-deriving from BIBLE.md.

## Things tests can't catch

- [x] No secrets in committed files.
- [x] No leftover debug logging — the `[scheduler]` `console.log`s ([scheduler.js:118,150](src/manage/taskQueue/queue/scheduler.js:118)) are intentional operational logging, matching the established `[task-queue]` style.
- [x] No commented-out code.
- [x] Error paths handled — `handleUpdate` returns 400 on invalid input, 503 when the queue isn't initialized, 500 on unexpected error; `readConfig`/`schedulerEnabled`/`getNextRun` are defensive (return safe defaults, never throw to the caller).
- [x] Concurrency — scheduling is idempotent (`upsertJobScheduler`); the config file is authoritative and reconcile is deterministic; orphan cleanup ([scheduler.js:136](src/manage/taskQueue/queue/scheduler.js:136)) drops any `sched:*` not enabled in the config. Single-operator UI, so the non-atomic read-modify-write in `handleUpdate` is not a realistic race.
- [x] Security — `taskId` is validated against the registry before any scheduling (no arbitrary-task injection); intervals are clamped non-negative.

## House rules check

- [x] Concept Graph API authority respected (N/A — no domain concepts).
- [x] No new lint/typecheck/build tooling without an ADR.
- [x] Firmware reinstall correctly called out as **not** required.

## Findings

### Blocking
_None._

### Non-blocking (do not gate merge; optional follow-ups)
1. **[scheduler.js:54](src/manage/taskQueue/queue/scheduler.js:54) / [scheduled-tasks/index.js:181](src/api/scheduled-tasks/index.js:181)** — `isValidSchedule` treats any non-empty `cron` string as valid; a syntactically invalid cron passes validation and only fails later at `upsertJobScheduler`, surfacing as a **503** ("Scheduling unavailable…") rather than a **400**. The operator still sees the parse error in the UI flash, so it's cosmetic. Optional: pre-validate the cron pattern in `handleUpdate` and return 400.
2. **[scheduler.js:70-74](src/manage/taskQueue/queue/scheduler.js:70)** — `timeoutMs` is baked into the Job Scheduler template at upsert time; if a task's registry timeout later changes, the persisted scheduler carries the old value until the next reconcile (boot or operator update re-upserts it). Benign given boot reconcile refreshes it; noting for awareness.

## Smoke gate (Reviewer-required before prod promotion)

`npm test` proves the **mechanism** is wired (Job Schedulers, floor/DEFAULTS gone, cron/sub-hour in the schema, queue-routed, boot reconcile, kill-switch read). It does **not** prove runtime behavior. Per the test plan and ADR, the behavioral heart is the **authoritative cycle-local/staging smoke** and must be exercised during `cycle-staging` before any prod promotion — especially since this story's entire purpose is to **gate story #21's prod promotion**:

- **S3 (durability — the headline AC-4):** enable a schedule, `supervisorctl restart brainstorm`, confirm the Job Scheduler persists and the next fire still occurs with no re-enable.
- **S4 (no regression):** migrated `refreshSearchIndex` keeps firing on cadence after cutover.
- **S5 (reconcile integration):** `reconcileRecent` (sub-hour) + `reconcileAll` (weekly) enqueue and serialize via `neo4j-heavy` (events.jsonl `resource_class_wait_*`); seed the watermark via `reconcileAll` first.
- **S6 (kill-switch):** `"scheduler": false` halts all upserts after restart.
- **S1/S2/S7–S9:** sub-hour fire, cron-on-pattern, disable+orphan cleanup, missed-fire skip-and-resume, UI panel.

## Verdict

**PASS** — The diff matches the story's acceptance criteria and ADR 0019's chosen design (Option A); the in-process `setInterval` scheduler is cleanly retired with no dangling references; all 18 test suites are green (new suite 12/12); the two re-baselined sentinels are legitimate ADR-0019 evolutions (1-hour-floor and `/api/run-task` guards correctly inverted for the phase-2 migration), not weakenings. The one ADR deviation (`timeoutMs` in job data) is a justified improvement. No blocking issues.

This PASS authorizes the standard deploy chain. **The S1–S9 cycle-local/staging smoke is the authoritative behavioral gate and must pass on `staging.brainstorm.world` before `cycle-prod`** — the durability (S3), no-regression (S4), and reconcile-serialization (S5) checks in particular, since prod promotion of story #21 depends on them.

---

## Staging smoke addendum — behavioral gate result (2026-05-22, post-#186 merge)

The PASS above was a static-diff verdict that deferred the behavioral heart to the **Reviewer-required S1–S9 staging smoke**, naming S3/S4/S5 as the gate before `cycle-prod`. That gate has now been exercised on `staging.brainstorm.world` — a **prod-scale** graph (~2.5M `NostrUser`, ~300k with `FOLLOWS`, **~32M `FOLLOWS`**). **Result: the gate is NOT met — prod promotion is blocked.** The scheduler code in this diff is not at fault; the blocker is downstream in the reconcile task it correctly scheduled.

**What ran.** Per AC-10 / OPERATIONS §13.4, S5 begins by seeding the watermark with a deliberate `reconcileAll`. A single manual `reconcileAll` was triggered. Live confirmation of the **#22 mechanism**: BullBoard showed it enqueued and run through the queue (AC-5) under the registry `--mode all` static-arg (AC-9); the new `GET /api/scheduled-tasks/list` enumerated any registry task (AC-1), an unregistered `taskId` → 400, and `refreshSearchIndex` showed a live `nextRunAt` exactly 1h after `lastRunAt` — its schedule migrated and the durable Job Scheduler is firing (AC-6 mechanism, partial S4). Tier 1/2 were green; the staging *deploy* itself was clean. Then the reconcile task failed.

### S5-BLOCKER — `reconcileAll` not viable at prod scale  *(root cause: story #21 / ADR 0018 reconcile extractor — NOT the #22 scheduler)* — **BLOCKING for prod**

`reconcileAll --mode all` ran 05:22:59 → ~11:21 UTC (**~6h**) and died mid-pass without a terminal event:

- Phase A (mutes) ✓ 70s (+277/−46, ~191k edges); Phase C (reports) ✓ 76s (+1284, ~168k edges); **Phase B (follows)** started 05:25:25, read current follows in 1000-row batches, reached **batch 1359 / 2195 (~62%)**, then errored in `getCurrentFollowsFromNeo4j`:
  > `Failed to get raters: The allocation of an extra 2.0 MiB would use more than the limit 3.9 GiB. Currently using 3.9 GiB. dbms.memory.transaction.total.max threshold reached`
- **Not** a restart (container `tapestry` up 11h continuously) and **not** a host/container OOM (`TASK_START` `systemContext`: mem 51.5%, load 2.55, neo4j accessible) — it is **Neo4j's transaction-memory ceiling**.
- `reconciliation.sh` persists the watermark only on success (lines 360–376); it died first, so **the watermark was not seeded** (`/var/lib/brainstorm/pipeline/reconciliation/state.json` absent). A re-run reproduces identically. At ~62% of the *read* alone after 6h, a clean pass would be ≥10–12h even absent the memory wall.

**Consequence.** The seed cannot complete → `reconcileRecent`'s no-watermark bootstrap hits the same wall → **S5 is unvalidatable**, and decisively the **production reconcile schedules this entire story exists to enable cannot run at prod scale.** Story #22 met its purpose by surfacing this before prod.

### OBS-1 — a failed `neo4j-heavy` job reads as perpetually "running"  *(story #22, AC-8)* — **should-fix**

The failure emitted **no `TASK_END` and no `TASK_ERROR`** (the `reconciliation.sh` `ERR` trap is scoped to a narrow cleanup block; the extractor error didn't trip it, and a `SIGKILL` couldn't either). `getRecentRuns` infers "running" from a `TASK_START` with no terminal event, so `/api/scheduled-tasks/status` and the panel report the dead job **"running" indefinitely** (verified live: API said `running` for >8h after death). This contradicts AC-8 ("panel reflects current state … last run") and misleads the operator. No reaper exists.

### OBS-2 — reconcile tasks' "last run" is always blank in the panel  *(story #22, AC-8; root in legacy `reconciliation` identity)* — **should-fix**

All reconcile registry tasks wrap `reconciliation.sh`, which logs run events under the script identity `reconciliation`. `getRecentRuns(taskId)` filters `events.jsonl` by exact `taskName`, so for `reconcileAll`/`reconcileRecent` it returns empty → the panel's "last run" / Recent Runs is **always blank** for them (next-run, keyed off the Job Scheduler, is unaffected). Root cause is the shared-script log identity (the legacy `reconciliation` key — explicitly out of scope per the story), but it surfaces through #22's panel and partially misses AC-8 for the reconcile tasks.

### Revised verdict — prod promotion: **CHANGES REQUESTED**

The static-diff **PASS stands** (scheduler design/code correct; staging deploy + #22 mechanism observed healthy), but the **Reviewer-required behavioral gate (S5) cannot pass** until the reconcile extractor scales. Kick back:

1. **Primary — new bug, story #21 / ADR 0018 territory:** bound transaction memory in `getCurrentFollowsFromNeo4j` so a full pass completes at 32M-edge scale. *PO should open a dedicated bug story; this is distinct from #22.*
2. **Secondary — story #22:** OBS-1 (emit a terminal event / add a stalled-job reaper so a dead job stops reading "running") and OBS-2 (resolve reconcile-task run history to the `reconciliation` identity, or document the gap).
3. Re-run the seed → exercise **S3 + S5** only after the primary fix lands.

This addendum supersedes the original "*This PASS authorizes the standard deploy chain … before `cycle-prod`*" to the extent of prod promotion: **do not `cycle-prod` until S5 passes.**
