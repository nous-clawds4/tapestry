# ADR 0022: Restore `wait`/`active`-only dedup via `removeOnComplete`+`removeOnFail` immediate eviction

**Status:** Proposed
**Date:** 2026-05-24
**Story:** `engineering-team/stories/25-manual-task-retrigger-after-finish.md`

## Context

Story #25 closes a gap between ADR 0012's documented dedup contract and BullMQ's actual behavior. ADR 0012 § "Dedup" (lines 33-38) said `queue.add(name, data, {jobId})` would dedup *only while the job is in `wait` or `active`* and would create a fresh execution once the prior attempt finished. In practice BullMQ's `queue.add` dedups across all job states (including `completed` and `failed`). The result: manual `/api/run-task` triggers for any task that has ever completed via BullMQ return the stale completed job's metadata without running anything. Affects 39 non-customer tasks always-after-first-run and 15 customer tasks per `(taskName, pubkey)` pair (per story #25 Background). Scheduled fires use Job Schedulers (unique generated jobIds per fire) and are not affected.

**Story ACs to honor** (paraphrasing #25):
1. Non-customer re-trigger after completion → fresh execution.
2. Non-customer re-trigger after failure → fresh execution.
3. Customer re-trigger after finish for a given customer → fresh execution.
4. Customer concurrent-fire dedup *preserved* — two simultaneous triggers for `processCustomer:alice` while one is `active` → second joins the first.
5. Scheduled-fire behavior — no regression.
6. ADR 0012's "Dedup" text matches actual code behavior.
7. No-downtime deploy: no Redis migration, no manual queue drain, no scheduled-task pause; in-flight jobs survive.

### Constraints and grounded facts

- **Concept Graph:** None impacted. Per ADR 0012 §"Concept-graph impact" the task-queue subsystem has no concept handles. I re-attempted `http://localhost:8877/api/concept-graph/summaries` during this design pass — local control panel is not running. The codebase-wide search confirms no `task|queue|jobid|bullmq|dedup` concept handles were added since ADR 0012. **Firmware reinstall: no.**
- **Single `queue.add` call site:** `src/manage/taskQueue/queue/index.js:185` — `return queue.add(taskName, data, { jobId });`. No other consumers — `scheduler.js` uses `queue.upsertJobScheduler` (separate code path with unique per-fire IDs; see Out of scope §B).
- **BullMQ version:** `^5.76.10` (per `package.json`). Confirmed against current source on GitHub.
- **Graceful shutdown exists:** `closeTaskQueue` at `src/manage/taskQueue/queue/index.js:248` closes Workers + Queues during SIGTERM/SIGINT. BullMQ's `worker.close()` waits up to a configurable grace period for the current job to drain. Relevant to the no-downtime AC dry-run below.
- **BullMQ semantic verification (the crux of this ADR):** the option-parsing logic at [`src/classes/scripts.ts` `getKeepJobs`](https://github.com/taskforcesh/bullmq/blob/master/src/classes/scripts.ts) maps:
  ```ts
  // shouldRemove is the per-job removeOnComplete (or removeOnFail) value
  return typeof shouldRemove === 'object'
    ? shouldRemove
    : typeof shouldRemove === 'number'
      ? { count: shouldRemove }
      : { count: shouldRemove ? 0 : -1 };
  ```
  i.e. `removeOnComplete: true` → `{count: 0}`. The Lua at [`src/commands/moveToFinished-14.lua`](https://github.com/taskforcesh/bullmq/blob/master/src/commands/moveToFinished-14.lua) lines 169-189 then branches:
  ```lua
  if maxCount ~= 0 then
      -- Keep: add to completed/failed sorted set, then lazily prune by age/count
      rcall("ZADD", targetSet, timestamp, jobId)
      if maxAge ~= nil then removeJobsByMaxAge(...) end
      if maxCount ~= nil and maxCount > 0 then removeJobsByMaxCount(...) end
  else
      -- Remove this job now, as part of its own completion finalization
      removeJobKeys(jobIdKey)
  end
  ```
  **Consequence:** `removeOnComplete: true` (→ `{count: 0}`) takes the immediate-removal branch and deletes the hash as part of completion. All other forms (`number > 0`, `{age}`, `{count}`, `{age, count}`, `false`) keep the job and prune lazily. The lazy prune is documented as "jobs are not removed unless a new job completes or fails" — meaning for our per-task queues with a single repeating jobId, lazy pruning never fires because no new job can complete (dedup blocks the next `queue.add`). **Only `removeOnComplete: true` and `removeOnFail: true` actually solve story #25 for single-jobId queues.**
- **Failure event capture** is independent of BullMQ: tasks emit `TASK_ERROR` / `TASK_END` via the script-level `emit_task_event` (bash) and `emitTaskEvent` (Node), writing to `/var/log/brainstorm/taskQueue/events.jsonl` regardless of whether the BullMQ job hash survives. BullBoard's "failed jobs" tab is therefore a UI surface, not the source of truth.

## Options considered

### Option A — `removeOnComplete: true` + `removeOnFail: true` on `queue.add` (chosen)

Add two options to the existing `queue.add` call at `src/manage/taskQueue/queue/index.js:185`:

```js
return queue.add(taskName, data, {
  jobId,
  removeOnComplete: true,
  removeOnFail: true,
});
```

This maps to BullMQ's `{count: 0}` semantics for both, which routes the completion/failure finalization through the immediate-removal Lua branch (verified above). After any job finalizes, its hash is gone; a subsequent `queue.add` with the same `jobId` finds nothing in any state and creates a fresh job. ADR 0012's documented contract ("dedup only while wait/active") becomes the actual behavior.

**Pros**
- One-line change to existing call site. Minimum mechanical surface.
- Restores ADR 0012's documented dedup intent without any custom code.
- Preserves AC #4: a job that's still `active` for `taskA:alice` is still in `active`, so a concurrent `queue.add` for that jobId dedups — the immediate removal only triggers on *completion*, not while running.
- No-downtime deploy: the change is per-call; no Redis schema migration, no queue surgery, no draining. In-flight jobs at deploy time complete under whatever options they were created with (default: keep), and from the deploy onward new jobs apply `true`. Legacy in-Redis completed/failed jobs sit harmlessly until an operator manually clears them via BullBoard (story #25 explicitly accepts this).
- Doesn't touch the scheduled-fire path (`upsertJobScheduler` in `scheduler.js`); scheduled fires keep current behavior — AC #5 honored by non-modification.

**Cons**
- BullBoard "completed jobs" and "failed jobs" tabs become empty for per-task queues triggered via `/api/run-task` (the Worker finalization deletes the hash before BullBoard can render it). Operators who used BullBoard for "what failed recently" lose that surface; they must read `events.jsonl` or `brainstorm.log` instead. Story #25 explicitly accepts this in its Out-of-scope clause.
- Loss of BullMQ-side retry counts and error-payload introspection for completed/failed jobs. Same mitigation: `events.jsonl` `TASK_ERROR` carries error context; `brainstorm.log` carries the Worker's `console.error` line (queue/index.js:135).

### Option B — Unique `jobId` per attempt (e.g., `${taskName}:${Date.now()}` non-customer, `${taskName}:${pubkey}:${Date.now()}` customer)

Bypass the dedup mechanism by making every `queue.add` produce a new jobId.

**Pros**
- BullBoard sees every attempt as a distinct job; completed/failed history preserved within BullMQ's default retention.
- No reliance on the `removeOnComplete: true` semantics.

**Cons**
- **Breaks AC #4 directly.** Two simultaneous `/api/run-task` triggers for `processCustomer:alice` would both run because their jobIds differ — the very race condition story #12 (graperank shared CSV) and ADR 0013 (`neo4j-heavy` semaphore) exist to prevent. Either we accept the race (regression on hard-won behavior) or we reintroduce a per-`(taskName, pubkey)` precheck (custom code; defeats the option's appeal).
- More invasive change to `computeJobId` than Option A.
- BullBoard now accumulates one completed hash per fire forever; Redis memory growth becomes unbounded without an explicit retention policy. We'd need `removeOnComplete: {age: T}` anyway — which works fine here because jobIds differ each fire, so lazy pruning has triggers — but that's more configuration plumbing than Option A's `true`.

**Rejected.** AC #4 is load-bearing.

### Option C — Hybrid: stable jobId + atomic precheck (custom Lua) before `queue.add`

Keep stable jobIds for concurrent-dedup, but write a Lua script that atomically does: "if `jobId` is in `wait`/`active`/`delayed`/`paused` return existing; if in `completed`/`failed` remove and add fresh; else add fresh." Wire it as a custom command via `Queue.prototype.add` override or a parallel `enqueueAtomic` helper.

**Pros**
- Preserves BullBoard's completed/failed visibility (jobs are removed only when an operator re-triggers).
- Matches ADR 0012's documented dedup contract exactly with no caveats.

**Cons**
- Net new Lua script + script-loading infrastructure inside BullMQ's API surface. BullMQ doesn't expose a public mechanism for custom commands on `Queue.add`; we'd be writing around it, which is brittle across BullMQ minor versions.
- Race window still possible without careful script construction (two concurrent re-triggers landing while job is `completed` could both pass the check).
- Larger code change for the same observed outcome as Option A on the path operators actually use (manual re-trigger). The Cons of Option A (BullBoard visibility) are tolerated by story #25.
- More surface area for the no-downtime AC to interact with (Lua script needs to deploy and be loaded before the first invocation).

**Rejected.** Solving for BullBoard completed/failed visibility doesn't justify the complexity given the story's explicit acceptance of that loss.

## Decision

**We chose Option A.**

Add `removeOnComplete: true, removeOnFail: true` to the single `queue.add` call at `src/manage/taskQueue/queue/index.js:185`. Amend ADR 0012's "Dedup" section in-place to describe this mechanism and correct the original wait/active-only claim. Update `OPERATIONS.md` and `BIBLE.md` if either currently document the dedup contract (Implementer to verify).

This is the smallest change that satisfies all seven ACs:
- ACs 1, 2, 3: re-triggers after finalization create fresh jobs because the prior hash is gone (verified in BullMQ source).
- AC 4: concurrent-fire dedup still works because the removal is finalization-triggered, not preemptive — while a job is `active`, its hash exists and dedups.
- AC 5: scheduled-fire path (`upsertJobScheduler` in `scheduler.js`) is unchanged.
- AC 6: ADR amendment bundled in this change.
- AC 7: per-call option flip with no Redis migration; in-flight jobs at deploy time finish under their existing options (see Deployment dry-run analysis below).

What we trade away: BullBoard's `completed` and `failed` views for queues triggered by `/api/run-task`. Mitigated by `events.jsonl` (full TASK_START/TASK_END/TASK_ERROR record) and `brainstorm.log` Worker error lines. Story #25's Out-of-scope clause makes this trade explicit.

## Consequences

**Enabled**
- Operators can re-trigger any task via `/api/run-task` and the legacy Task Explorer's "Run Task" button after a previous attempt finishes — debugging, recovery, ad-hoc reruns work as documented.
- ADR 0012's stated contract becomes the enforced contract — readers of either document get accurate semantics.
- Redis memory associated with finalized `/api/run-task` jobs returns to zero between fires (small but non-zero benefit; per-task queues won't accumulate completed hashes anymore).

**Constrained / made harder**
- BullBoard's per-queue `completed` and `failed` tabs show empty for the 54 per-task queues' manually-triggered jobs. Operators who relied on BullBoard for failure context must switch to `events.jsonl` or `brainstorm.log`. The `wait`/`active`/`delayed` tabs still show in-flight state — BullBoard remains the right surface for "what is happening now."
- Retry policies, error payloads, and BullMQ-side failure-introspection metadata are not retained on disk. (We don't use BullMQ retries today, so this is a future-proofing note rather than a current loss.)

**Deployment dry-run analysis (AC #7)**

Walking through a `cycle-staging` (or `cycle-prod`) deploy moment-by-moment, accounting for in-flight BullMQ jobs and Redis state at the deploy boundary:

| Phase | What's happening | What the new code does | Risk |
|---|---|---|---|
| **T-ε** (just before deploy) | Redis holds: a set of completed/failed hashes from prior runs under old options (default-keep); possibly one or more `active` jobs being executed by the soon-to-die Workers. `/api/run-task` calls hit the old code path. | (Old code still running) | Status quo — bug active. |
| **T₀** (SIGTERM lands on brainstorm container) | Supervisord-style SIGTERM triggers `closeTaskQueue` at `src/manage/taskQueue/queue/index.js:248`. BullMQ's `worker.close()` waits up to the docker stop grace period (default 10s) for currently-running jobs to drain. | (Still old code, now closing.) Workers stop pulling new jobs but allow the in-flight one to finalize. | Short-running jobs (< grace period) drain cleanly and finalize under **old** options (no removeOnComplete); they remain in Redis after. Long-running jobs (orchestrators that take hours) are SIGKILLed when the grace period elapses — the same behavior the queue handles today via stalled-job recovery. |
| **T₁** (new brainstorm container starts) | `initTaskQueue` runs with the new code. Worker callbacks are reattached to existing queues. Any jobs that were SIGKILLed mid-flight are still in `active` state in Redis; BullMQ's stall detector (default `stalledInterval: 30000` ms, `maxStalledCount: 1`) moves them back to `wait` within ~30s. | When stall-recovered jobs are picked up by the new Worker, BullMQ uses the job's *original* options (stored on the hash at first add) — so a job created pre-deploy still finalizes under default-keep. Subsequent new-trigger paths (`/api/run-task` → `queue.add`) use the new options. | Stall-recovered legacy jobs finalize under old options and stay in Redis. This adds at most a small number of "legacy stuck" entries to the existing pile — the same class story #25 explicitly accepts. |
| **T₁+ε** (operator triggers a task) | `/api/run-task` → `enqueueTask` → `queue.add(..., {jobId, removeOnComplete: true, removeOnFail: true})` | New options on every fresh add. If the jobId still has a legacy completed/failed hash from before the deploy, BullMQ's dedup returns the legacy hash (no new run). Operator clears it via BullBoard's "Remove" control, then re-triggers — second attempt creates fresh under new options and the bug stops recurring for that task name. | Per story #25 §"Out of scope" — legacy stuck jobs are tolerable, manual clear is the unblock path. |
| **T₁+N** (steady state after the legacy pile is cleared) | All new completions/failures evict immediately. Re-triggers always create fresh executions. | Documented contract is the actual contract. | None. |

**No-downtime checklist confirmed:**
- ✓ No Redis schema migration (BullMQ keys unchanged; the option is per-job, written into the per-job hash at add time).
- ✓ No manual queue drain (Workers gracefully drain via existing `closeTaskQueue`).
- ✓ No scheduled-task pause (scheduler path untouched; Job Schedulers continue firing throughout the restart window).
- ✓ In-flight jobs that drain within grace period finalize cleanly.
- ✓ Stall-recovered jobs re-process under their original options; behavior identical to a normal restart today.

**Follow-up debt (out of scope here)**
- **Scheduled-fire job retention.** `scheduler.js`'s `upsertJobScheduler` does not currently pass `removeOnComplete`/`removeOnFail` to its job template, so scheduled fires accumulate completed/failed hashes in Redis indefinitely (different from the dedup bug — jobIds are unique per fire, but they pile up). This is a separate Redis-hygiene concern; file as intake after this story lands. See the "Stretch goal" sub-section below — if the Implementer addresses it inline, file the closing note; otherwise, file the new intake.
- **Unified all-tasks timeline UI.** Already filed as a 2026-05-24 intake. The BullBoard observability gap surfaced by this ADR is part of the same problem space and would be addressed in that Feature.

**Firmware reinstall required?** No. No concept-graph changes.

## Implementation notes

The Implementer reads this section verbatim.

### Files to edit

1. **`src/manage/taskQueue/queue/index.js`** — modify the `enqueueTask` function around line 180–186. Today:
   ```js
   async function enqueueTask({ taskName, customerArgs, queryParams, timeoutMs }) {
     const queue = getQueue(taskName);
     if (!queue) throw new Error(`Unknown task: ${taskName}`);
     const jobId = computeJobId(taskName, customerArgs);
     const data = { taskName, customerArgs, queryParams, timeoutMs };
     return queue.add(taskName, data, { jobId });
   }
   ```
   Change the last line to:
   ```js
     return queue.add(taskName, data, {
       jobId,
       removeOnComplete: true,
       removeOnFail: true,
     });
   ```
   Update the JSDoc above the function to note the immediate-eviction behavior on completion/failure and that this restores ADR 0012's documented `wait`/`active`-only dedup contract.

2. **`engineering-team/decisions/0012-task-queue-phase-1-bullmq.md`** — amend the "Dedup" paragraph inside Option A (currently lines 33-38 of that file) **in place**. Replace its second sentence onward with text that:
   - Acknowledges that BullMQ's native `queue.add({jobId})` dedups across *all* job states (including `completed`/`failed`), not only `wait`/`active`.
   - Documents that `removeOnComplete: true` and `removeOnFail: true` are passed to `queue.add` to evict finalized jobs immediately, restoring the documented dedup window.
   - Cross-references ADR 0022 ("Restore wait/active-only dedup…") for the empirical investigation and rationale.
   - Keep the `jobId` formula (`customerTask ? ${taskName}:${pubkey} : ${taskName}`) unchanged.
   - Add a one-line note in the Cons list of Option A: "BullBoard's `completed`/`failed` tabs are empty for queues using these options — `events.jsonl` is the durable failure record."

3. **`docs/BIBLE.md`** and **`OPERATIONS.md`** — Implementer to `grep` for any mention of "dedup" / "removeOnComplete" / "wait/active" / "completed jobs" in the task-queue sections and update to match the new contract. If neither file documents the dedup contract today, no edit needed.

### Files NOT to edit

- `src/manage/taskQueue/queue/scheduler.js` — scheduled fires use `upsertJobScheduler` and unique per-fire jobIds; they are not affected by this fix's primary scope. Per AC #5, do not change the manual-trigger fix's behavior toward this file. (But see "Stretch goal" below — the Implementer MAY choose to add the same options to its job template if it improves Redis hygiene without expanding test scope.)
- `src/manage/taskQueue/queue/processor.js` — the Worker callback is unchanged. Failure throwing still works the same; the BullMQ Worker still receives the throw and finalizes the job as `failed` — at which point the new `removeOnFail: true` triggers immediate removal.
- `src/manage/taskQueue/queue/resourceSemaphore.js` — the `neo4j-heavy` semaphore wrap (story #15, ADR 0013) is unaffected. Acquire/release happens inside the Worker callback, outside the BullMQ finalization path.

### Pre-implementation empirical probe (REQUIRED before changing `queue/index.js`)

This ADR's central claim — that `removeOnComplete: true` maps to `{count: 0}` and triggers the immediate-removal Lua branch — was verified by reading BullMQ's source on GitHub at `master`. Before relying on that behavior in production, the Implementer must confirm it holds against the **installed** BullMQ version (`^5.76.10`) inside the running container. Write a 30-line probe and run it against the container's local Redis:

- **Location:** `test/probe-bullmq-removeOnComplete-immediate.js` — *test fixture*, not a permanent test in `test/test.js`'s registered suite (or register it under a dedicated `probe-only` block — Implementer picks; the goal is one-shot evidence, not a regression guard).
- **What it does, in order:**
  1. Create a Queue + minimal Worker for a synthetic queue name (e.g., `__probe-removeOnComplete`).
  2. `queue.add('probe', {}, { jobId: 'fixed', removeOnComplete: true, removeOnFail: true })` — capture the returned `job.id`.
  3. Wait for `Worker` to process and complete (Worker just `return null` immediately).
  4. Use `queue.getJob('fixed')` — assert returns `null` or `undefined` (hash gone).
  5. `queue.add('probe', {}, { jobId: 'fixed', removeOnComplete: true, removeOnFail: true })` again — capture the new `job.id`; assert it is *different* from step 2's job.id (proves a fresh job was created).
  6. Repeat steps 2-5 once more but force the Worker to throw — verifies `removeOnFail: true` symmetrically removes failed-state jobs.
  7. Clean up: `queue.obliterate({ force: true })`; close Worker + Queue + Redis connection.
- **Run:** `docker exec tapestry node /usr/local/lib/node_modules/brainstorm/test/probe-bullmq-removeOnComplete-immediate.js`. Expected output: two ASSERT-PASS lines (one for completed, one for failed). If anything asserts FAIL, **stop implementation and re-open this ADR** — the option semantics differ from what GitHub-master indicated and we need a different mechanism (likely Option C).
- **Why this matters:** the BullMQ source on GitHub master may have diverged from `5.76.10`'s tag. The probe takes ~5 minutes to write and run; the cost of being wrong about the semantic is shipping a broken fix to prod.

### Stretch goal (Implementer's discretion)

`src/manage/taskQueue/queue/scheduler.js` line 91-98 calls `queue.upsertJobScheduler(...)` with a job template that does NOT pass `removeOnComplete`/`removeOnFail`. Each scheduled fire thus accumulates in Redis indefinitely (different bug than story #25's: jobIds are unique per fire, so no dedup hit, but Redis memory grows unbounded over time).

The mechanically identical fix is to add the same two options inside the job template's `opts` field:
```js
await queue.upsertJobScheduler(
  schedulerId(entry.id),
  toRepeatOpts(entry),
  {
    name: entry.taskId,
    data: { taskName: entry.taskId, entryId: entry.id, timeoutMs },
    opts: { removeOnComplete: true, removeOnFail: true },  // <-- stretch
  }
);
```

**Implementer's call** whether to include in this PR or defer to a separate intake:
- **Include if:** the empirical probe also covers the scheduled-fire path (one extra ~10-line probe step) and the Tester is comfortable adding one regression test (schedule an entry, wait two fires, assert the first fire's hash is gone after the second fire's Worker callback runs).
- **Defer if:** scope feels stretched, probe time is tight, or any concern arises about whether `opts` on `upsertJobScheduler`'s job template is the right BullMQ surface (it is per BullMQ's docs at `master`, but the probe should re-verify before relying on it).

If deferred: append a one-paragraph intake entry to `engineering-team/stories/_intake.md` titled "Cleanup: scheduled-fire job retention (`upsertJobScheduler` opts)" describing the bug, the fix shape, and the reason it was punted from story #25.

### Concept handle

None. No new concepts. No firmware reinstall.

### Test scenarios for the Tester (Phase 3)

Hand off to /design-tests with these scenarios in mind:
- **AC 1 (non-customer completed re-trigger):** enqueue `calculateOwnerPageRank` (or a synthetic test task), wait for completion (or stub the processor for fast finalization), enqueue again, assert the second call returned a new `job.id` and a new `TASK_START` lands in `events.jsonl`. Assert the first job's Redis hash is removed (BullMQ Redis-level inspection via `queue.getJob(jobId)` returning falsy).
- **AC 2 (non-customer failed re-trigger):** force a failure (e.g., stub the processor to throw), enqueue once, wait for the BullMQ `failed` state, enqueue again, assert second call returned a new `job.id` and the second attempt runs (the throw could succeed or fail again — both are equivalent for this AC; what matters is that a fresh job was created).
- **AC 3 (customer re-trigger after finish):** same as AC 1 but with a customer-scoped task; verify the `${taskName}:${pubkey}` jobId path.
- **AC 4 (customer concurrent-fire dedup):** stub the processor to hold (sleep) for N seconds, enqueue `processCustomer:alice`, then *while it's still active*, enqueue again, assert `enqueueTask` returns the same `job.id` both times (the second call joined the first via the still-existing `active` hash).
- **AC 5 (scheduled-fire non-regression):** schedule an entry via `upsertSchedule` (`scheduler.js`), wait for two fires, assert each fire was a fresh execution (different jobIds, separate TASK_START events). Existing story #24 tests likely cover this — verify they still pass without modification.
- **AC 6 (ADR amendment):** grep the amended ADR 0012 file; assert the new dedup wording is present and the old "wait/active only" claim is removed or explicitly corrected.
- **AC 7 (no-downtime deploy):** verified end-to-end at staging+prod cycle time; covered by the cycle-staging / cycle-prod smoke runs, not by unit tests.

The behavioral tests for ACs 1-5 can run against a real local Redis (the testbed already has one, per other task-queue tests) or against a `bullmq`-compatible in-memory mock. Hand-rolled runner per repo convention (`test/test.js`).

## Out of scope

- **Restoring BullBoard `completed`/`failed` visibility for `/api/run-task` jobs.** Accepted trade-off per story #25's Out-of-scope clause. Future work via the unified all-tasks timeline UI intake.
- **`removeOnComplete`/`removeOnFail` for `scheduler.js` (scheduled fires).** Implementer's stretch-goal call per the section above. If the stretch goal is declined, this is a separate intake to file at PR-merge time.
- **Custom Lua precheck infrastructure** (Option C). Declined; complexity not justified by the story's accepted trade-off.
- **Per-task retention tuning** (e.g., letting operators configure `removeOnComplete: {age: T}` per task name for ones where they want history). No operator has asked for this; can be a follow-up if BullBoard visibility loss bites.
- **Retry policy work.** BullMQ supports automatic retries via job options; we don't use them. Out of scope.
- **All inherited Out-of-scope items from story #25** (Intake A subshell bypass, unified timeline UI, `/api/run-task` auth, etc.).
