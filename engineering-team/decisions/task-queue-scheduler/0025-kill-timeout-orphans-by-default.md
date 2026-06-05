# ADR 0025: Flip `forceKill: true` as the default in both the registry and processor.js so timeouts actually terminate work

**Status:** Proposed
**Date:** 2026-05-25
**Story:** `engineering-team/stories/28-kill-timeout-orphans-by-default.md`
**Builds on:** ADR 0013 (story #15 — `neo4j-heavy` cap=1 semaphore — this ADR closes a separate timeout-shaped escape from its contract), ADR 0024 (story #27 — scheduled-task timeout propagation fix — which restored the no-timeout case; this ADR completes the picture for the timeout case).
**Does NOT supersede ADR 0013 or ADR 0024.** ADR 0013's contract is correct; ADR 0024's fix is correct. This ADR closes the third hole: when a timeout actually fires, the work should terminate cleanly.

## Context

### The bug, restated from story #28 + grounded in code

When a task hits the wrapper-script timeout in `src/manage/taskQueue/launchChildTask.sh:374-413`, the monitor loop's `force_kill` check at `:403` reads `resolved_options.failure.timeout.forceKill // false`. With the current default `false`, the wrapper declares timeout, emits `CHILD_TASK_ERROR`, and **exits without killing the backgrounded child** (`bash $script &`). The child process keeps running orphaned.

The Node Worker callback at `src/manage/taskQueue/queue/index.js:118-131` receives `child.on('close')`, executes `finally { await release() }`, and releases the `neo4j-heavy` semaphore. The orphan continues doing Neo4j-heavy work without semaphore protection — already a violation of ADR 0013's cap=1 contract.

The compounding bug: the next scheduled fire of the same task lands. Its wrapper runs `check_task_already_running` at `launchChildTask.sh:25-67`, which `pgrep -f`-finds the orphan PID. Under the default `processAlreadyRunning.withoutError.launchNew = false` policy at `taskRegistry.json:22-26`, the wrapper emits `TASK_LAUNCH_PREVENTED` and exits success — BullMQ records job completion. **The scheduled fire was silently dropped.**

Concrete empirical evidence from prod 2026-05-25 (Track A verification): the post-deploy `processCustomer` tick at 20:23:04Z had its launch prevented at 22:06:32Z because the prior stale-recovered tick's orphan (PID 195788) was still running. Story #27 + Track A fixed the no-timeout case (semaphore now holds for configured duration); this ADR closes the timeout case.

### The fix needs to land in TWO places, not one

The story's user-facing description says "flip the global default." A naive read suggests a one-line change to `src/manage/taskQueue/taskRegistry.json:41`. **That alone would not work.**

The wrapper script's hierarchical-options merge gives per-invocation JSON HIGHEST precedence (it overrides per-task overrides which override `options_default`). The Node-side processor at `src/manage/taskQueue/queue/processor.js:117-127` currently hardcodes `forceKill: false` into the per-invocation JSON:

```js
const optionsJson = (timeoutMs && timeoutMs > 0)
  ? JSON.stringify({
      completion: {
        failure: {
          timeout: { duration: timeoutMs, forceKill: false }
        }
      }
    })
  : '{}';
```

For every BullMQ-invoked task (which is essentially every scheduled fire and every `/api/run-task` call — the bulk of the system), this per-invocation `forceKill: false` would WIN at the wrapper's merge, defeating any registry-default change. The fix must land in both layers.

### Per-task `forceKill: false` overrides — surveyed during this Architect session

The 11 per-task overrides break into two classes (confirmed by reading each task's full registry entry):

| Line | Task | Duration | Class | Risk if global forceKill flips to true while this override stays |
|---|---|---|---|---|
| 110 | `processAllTasks` | 6h | Reasonable | None — 6h is generous for the orchestrator |
| **231** | **`syncWoT`** | **60s** | **WRONG** | Would kill every sync run that exceeds 60s; `estimatedDuration: "30-60 minutes"`, `averageDuration: 44500` — many runs exceed |
| **262** | **`syncProfiles`** | **60s** | **WRONG** | Same as syncWoT |
| 291 | `callBatchTransfer` | 1h | Reasonable | None |
| 342 | `reconcileRecent` | 30min | Reasonable | None |
| 373 | `reconcileAll` | 8h | Reasonable | None |
| 403 | `reconcileAuthor` | 10min | Reasonable | None |
| 435 | `reconcileNetwork` | 60min | Reasonable | None |
| 1431 | `applicationHealthMonitor` | 10min | Reasonable | None |
| 1460 | `neo4jPerformanceMonitor` | 10min | Reasonable | None |
| 1489 | `externalNetworkConnectivityMonitor` | 10min | Reasonable | None |

The 9 "reasonable" overrides have `forceKill: false` that looks like copy-paste artifacts from the registry's early scaffolding — none have a `comments` field justifying the choice (only duration justifications). The 2 "wrong" overrides (`syncWoT`, `syncProfiles`) carry a 60-second duration that's clearly mis-sized for their actual workload — but that mis-sizing is a separate bug; story #28 is about kill-on-timeout, not about timeout durations.

### Neo4j cleanliness on `kill -9` — Open Question 1 resolved

The wrapper's kill is `kill -9 "$child_pid"` at `launchChildTask.sh:407` — the `$child_pid` is the bash subprocess spawned with `bash "$child_script" &`. That bash process is the parent of any `cypher-shell` (or equivalent Bolt-protocol client) it spawned to do Neo4j work.

Killing the bash process:
1. Bash dies immediately (no cleanup chance).
2. Bash's children become orphaned; in the tapestry container, supervisord (PID 1) reaps them.
3. The TCP connection from cypher-shell to Neo4j drops (either from cypher-shell itself catching SIGHUP or from kernel-level socket cleanup at process death).
4. **Neo4j observes a dropped connection and rolls back any in-flight transaction on that connection.** This is standard Bolt server semantics — atomic at the transaction boundary; partial-write half-applied state is not exposed.

Partial-work risk does exist: a script that splits its work into many small transactions and commits each will lose any work not yet committed. But this risk is **identical to today's BullMQ stalled-recovery risk** — when a Worker is recycled mid-task (default `stalledInterval: 30000` × `maxStalledCount: 1`), the task gets re-tried, and any partially-committed work is the same shape. Script idempotence is already a requirement (which is why tasks already get retried via `restart: true, maxRetries: 3` in `options_default`). This ADR doesn't introduce new requirements on script idempotence; it makes use of one that already exists.

### Constraints from the story

- AC #1: timeout produces a kill (no orphan). Layer 1 + Layer 2 both must change.
- AC #2: next scheduled fire runs. Consequence of AC #1 — no orphan means no `check_task_already_running` match means launch proceeds.
- AC #3: operator visibility via existing `CHILD_TASK_ERROR` events — no new event types. Already satisfied by the wrapper's existing emit at `launchChildTask.sh:416-435`; this ADR doesn't change emit behavior, only kill behavior.
- AC #4: uniform across invocation paths. Layer 1's registry-default change reaches all paths through the wrapper; Layer 2's processor.js change reaches the BullMQ Worker path specifically. Together they cover all invocation paths that reach `launchChildTask.sh`.
- AC #5: no manual cleanup of in-flight tasks. Pre-existing orphans on prod continue until natural completion or operator kill. The change affects new wrapper invocations post-deploy.

### Concept-graph impact

Concept Graph API not reachable from this Architect session (curl to `http://localhost:8877/api/concept-graph/summaries` returned connection refused). Same circumstance as ADR 0023 and ADR 0024 today. The task-queue + wrapper-script subsystem has no concept-graph footprint — ADR 0013 explicitly confirmed, ADR 0021 reconfirmed, ADR 0024 reconfirmed. Story #28 explicitly notes "Concepts touched: None." **Firmware reinstall: no.**

## Options considered

### Option A — Flip both layers; preserve per-task overrides; file follow-up intake (chosen)

Two-file change:

1. **`src/manage/taskQueue/taskRegistry.json:41`** — flip `options_default.completion.failure.timeout.forceKill: false → true`.
2. **`src/manage/taskQueue/queue/processor.js:117-127`** — remove the hardcoded `forceKill: false` from the per-invocation JSON. The merged options block ships only `{ duration: timeoutMs }`; the wrapper's hierarchical merge then resolves `forceKill` from per-task override (if present) or global default (now `true`).

Preserve all 11 per-task `forceKill: false` overrides as-is. The 9 reasonable ones retain pre-fix behavior — story #28's bug is fixed for the 27 tasks without overrides (the bulk of the scheduled-tasks surface). The 2 problematic ones (syncWoT, syncProfiles) keep pre-fix behavior, which is what we want until their duration mis-sizing is separately triaged. File a follow-up intake to clean up the 9-of-11 redundant overrides + investigate the 2-of-11 duration mis-sizing.

Illustrative sketches:

```json
// taskRegistry.json — at the global default block (around line 39):
"failure": {
  "timeout": {
    "duration": 1800000,
    "forceKill": true,
    "restart": true,
    "maxRetries": 3,
    "parentNextStep": "nextTaskInQueue"
  }
}
```

```js
// processor.js — replacing the current optionsJson literal:
const optionsJson = (timeoutMs && timeoutMs > 0)
  ? JSON.stringify({
      completion: {
        failure: {
          timeout: { duration: timeoutMs }
        }
      }
    })
  : '{}';
```

**Pros**
- **Satisfies all 5 ACs.** Layer 1 reaches non-BullMQ invocation paths (`launch_child_task` recursive calls, manual `bash launchChildTask.sh`); Layer 2 reaches BullMQ-invoked paths. Together they cover AC #4.
- **Minimal blast radius.** Two files, ~3 lines of net change. Compare to Option D's 9 additional registry edits.
- **Avoids the hidden regression** on syncWoT/syncProfiles. Those tasks' wrong 60s timeout stays paired with `forceKill: false` until separately fixed — no surprise kills.
- **Architecturally cleaner per-invocation contract.** processor.js no longer asserts opinions about `forceKill` that have nothing to do with per-invocation context. The wrapper's hierarchical merge becomes the single source of truth for resolved `forceKill`.
- **Defense-in-depth at the wrapper.** The wrapper already supports any value of `forceKill` correctly (kill -9 vs no-op). No wrapper edit required for the fix.

**Cons**
- **9 redundant per-task `forceKill: false` overrides remain.** Reading the registry, a future maintainer sees these explicit `false` values and may interpret them as deliberate — they're not, they're copy-paste artifacts. Mitigated: follow-up intake captures the cleanup as a properly-scoped task.
- **2 known-wrong duration values remain unfixed** (syncWoT, syncProfiles). The story-scope-correct call is to preserve them with their explicit override; the follow-up intake flags the bug separately. Operator-visible impact today: noisy spurious 60s timeout events that are no-ops (orphan continues until natural completion).

### Option B — Flip Layer 1 only (registry default)

Single-line change to `taskRegistry.json:41`. Don't touch processor.js.

**Pros**
- Smallest possible diff (1 line).

**Cons**
- **Does not satisfy any AC.** Layer 2's hardcoded `forceKill: false` in processor.js wins at runtime via per-invocation precedence in the wrapper's hierarchical merge. For BullMQ-invoked tasks (essentially everything that fires today), nothing changes. Operator would see no behavior change.
- **Documentation lie.** Registry says `true`; runtime says `false`. Anyone reading the registry to predict behavior would be wrong.

**Rejected.** Doesn't actually fix the bug.

### Option C — Flip Layer 2 only (processor.js hardcode)

Change processor.js's hardcoded `forceKill: false → true` (or omit it). Don't touch the registry default.

**Pros**
- Single-file change.
- Closes the BullMQ-invoked path correctly.

**Cons**
- **Doesn't satisfy AC #4 (uniform across invocation paths).** Non-BullMQ paths through the wrapper (`launch_child_task` recursive calls from parent scripts, manual `bash launchChildTask.sh` for testing/operator use) don't go through processor.js. They consult the registry global default at the wrapper's hierarchical merge. With Layer 1 unchanged, those paths retain `forceKill: false`.
- **The registry default remains misleading documentation.** Same problem as Option B's documentation lie, in the other direction.
- **More fragile.** Future code paths that bypass processor.js (e.g., a CLI debug tool that invokes the wrapper directly) silently fall off the fix.

**Rejected.** Doesn't satisfy AC #4.

### Option D — Option A + delete the 9 redundant per-task overrides

Same as Option A, plus surgical removal of the `forceKill: false` line from the 9 reasonable per-task overrides (lines 110, 291, 342, 373, 403, 435, 1431, 1460, 1489). Keep the 2 unsafe ones (231, 262) with an added `comments` field justifying why.

**Pros**
- **More uniform behavior post-fix** — all 25 reasonable-duration tasks gain `forceKill: true` consistently.
- **Cleaner registry** — fewer copy-paste artifacts left around for future readers.

**Cons**
- **Mixes two concerns.** Story #28 is "flip the default"; deleting per-task overrides is a different change. Tester needs separate coverage for the cleanup; Reviewer needs to verify each deletion is safe.
- **Larger diff** — 9 additional edits, each requiring JSON trailing-comma care.
- **The follow-up intake from Option A captures this cleanly** as a properly-scoped story. The 60s-mis-sizing investigation belongs in the same follow-up, where it can get its own ADR.

**Rejected.** Right architectural direction but wrong story to bundle it into. Story #28 stays narrowly-scoped; follow-up intake carries the cleanup.

## Decision

**We chose Option A** — flip both layers (registry default + processor.js hardcode), preserve all 11 per-task overrides as-is for this story, file a follow-up intake for the per-task override cleanup.

This is the minimal-correct-change that satisfies all 5 story ACs without expanding scope into the per-task override surface or the orthogonal 60s-mis-sizing bug.

What we trade away:
- The 9 redundant per-task `forceKill: false` overrides remain in the registry as noise (and as functional carve-outs that retain pre-fix behavior on those 9 tasks). The bulk of the system — the 27 tasks without overrides — gets the new behavior, including the 3 highest-impact tasks (`processCustomer`, `updateAllScoresForOwner`, `updateAllScoresForSingleCustomer`) that Track A just sized to 90 min / 4 hr / 4 hr and have NO explicit forceKill override.
- The 2 problematic per-task overrides (syncWoT, syncProfiles) remain with their 60s mis-sizing — which is unchanged from today's state. No regression, no improvement, deferred.
- ~30 minutes of mechanical follow-up work to author the intake + later triage.

## Consequences

**Enabled**
- Story #28's 5 ACs all pass for the 27 tasks without per-task `forceKill: false` overrides — including the 3 biggest neo4j-heavy orchestrators that Track A just sized.
- ADR 0013's cap=1 contract holds across timeout boundaries — when a task times out, the bash subprocess dies, the semaphore release matches the actual end of work, the next scheduled fire runs cleanly.
- `processor.js`'s per-invocation JSON becomes minimal and intent-aligned (`{ duration: timeoutMs }` only) — it stops asserting opinions about `forceKill` that have no per-invocation justification.
- Future operator-debug invocations via manual `bash launchChildTask.sh` get the same kill-on-timeout behavior as BullMQ-invoked fires.

**Constrained / made harder**
- Tasks that previously relied on "wrapper times out at N, but bash keeps running past N" as an implicit semantic now get their work killed at N. Operators who set N too tight will see work cut short. Mitigation: per-task timeout sizing is now load-bearing; Track A established the pattern; Track B will automate it.
- The 11 per-task `forceKill: false` overrides become functionally meaningful (they were always functionally meaningful — they're just no longer redundant copies of the global default). A future reader of the registry must understand that those 11 tasks opt OUT of the new default.

**Follow-up debt (filed at commit time)**
- **Per-task `forceKill: false` override cleanup.** Intake entry to be appended to `engineering-team/stories/_intake.md` (Implementer copy-to-file at commit time, similar pattern to ADR 0023's amendment block). The intake breaks the work into two halves:
  - **9-of-11 redundant overrides** (`processAllTasks`, `callBatchTransfer`, `reconcileRecent`, `reconcileAll`, `reconcileAuthor`, `reconcileNetwork`, `applicationHealthMonitor`, `neo4jPerformanceMonitor`, `externalNetworkConnectivityMonitor`) — likely safe to delete; durations look reasonable; deletion makes them inherit the new global default. Standard 5-phase fits.
  - **2-of-11 duration mis-sizing** (`syncWoT`, `syncProfiles`) — 60s timeout is wrong for tasks with `estimatedDuration: "30-60 minutes"`, `averageDuration: 44500`. Bug fix: investigate correct timeout duration (probably ~30-60 min matching estimatedDuration with headroom), then drop the `forceKill: false` override. Could ride as part of the same intake's story or a separate one.

**Firmware reinstall required?** No. No concept-graph changes.

## Implementation notes

The Implementer reads this section verbatim.

### Files to edit

1. **`src/manage/taskQueue/taskRegistry.json`** (1 line)
   - Change `options_default.completion.failure.timeout.forceKill: false → true` (at line ~41 today, around the global default block lines 35-47). Preserve adjacent fields (`duration`, `restart`, `maxRetries`, `parentNextStep`).
   - **Do NOT touch** the 11 per-task overrides at lines 110, 231, 262, 291, 342, 373, 403, 435, 1431, 1460, 1489. Those stay as-is for this story.

2. **`src/manage/taskQueue/queue/processor.js`** (1 line + JSON shape)
   - In the `runWithResolvedArgs` function (around line 110-130), modify the `optionsJson` builder: remove `forceKill: false` from the per-invocation JSON. The resulting shape is `{ completion: { failure: { timeout: { duration: timeoutMs } } } }` when `timeoutMs > 0`, else `'{}'` (unchanged for the empty case).
   - The wrapper's hierarchical merge at `launchChildTask.sh:208-211` will resolve `forceKill` from per-task override (if any) or global default (now `true`).

### Files NOT to edit

- `src/manage/taskQueue/launchChildTask.sh` — already supports `forceKill: true` correctly at `:402-412`. No change needed.
- `src/manage/taskQueue/queue/scheduler.js` — doesn't touch forceKill. No change needed.
- `src/manage/taskQueue/queue/resourceSemaphore.js` — unchanged.
- `src/manage/taskQueue/queue/index.js` — Worker-callback semaphore wrap unchanged.
- `src/utils/taskTimeout.js` — resolveTaskTimeout is duration-only; doesn't touch forceKill. Unchanged.

### Intake to file at commit time

Append the following block verbatim to `engineering-team/stories/_intake.md` (end of file). This intake filing is a deliverable of story #28; it doesn't need re-Architect review.

> **## 2026-05-25 — Cleanup + Bug: per-task `forceKill: false` overrides after story #28's default-flip**
>
> **Surfaced during:** Architect-phase audit for story #28 / ADR 0025 (2026-05-25). The audit of all 11 per-task `forceKill: false` overrides in `taskRegistry.json` found two distinct concerns that story #28's narrow scope (flip the global default) deliberately did not address.
>
> **Part A — Cleanup: 9 redundant overrides.** The following 9 entries have a `forceKill: false` override that appears to be a copy-paste artifact rather than a deliberate choice (no `comments` field justifying the choice; durations are reasonable for the work):
>
> | Line | Task | Duration |
> |---|---|---|
> | 110 | processAllTasks | 6h |
> | 291 | callBatchTransfer | 1h |
> | 342 | reconcileRecent | 30min |
> | 373 | reconcileAll | 8h |
> | 403 | reconcileAuthor | 10min |
> | 435 | reconcileNetwork | 60min |
> | 1431 | applicationHealthMonitor | 10min |
> | 1460 | neo4jPerformanceMonitor | 10min |
> | 1489 | externalNetworkConnectivityMonitor | 10min |
>
> Deleting just the `"forceKill": false` line from each (preserving `duration`/`comments` if present) would let these tasks inherit the new `forceKill: true` global default. Each is independently low-risk (durations are generous; if the kill bites, it bites for a real reason).
>
> **Part B — Bug: 2 mis-sized timeout durations.** The following 2 entries carry a 60-second timeout that's clearly wrong for tasks with `estimatedDuration: "30-60 minutes"` and `averageDuration: 44500` (44.5s average — many runs exceed):
>
> | Line | Task | Duration | Comment |
> |---|---|---|---|
> | 231 | syncWoT | 60s | `estimatedDuration: "30-60 minutes"`, `averageDuration: 44500` |
> | 262 | syncProfiles | 60s | same |
>
> Today the `forceKill: false` override masks the impact (wrapper declares timeout, bash continues unprotected, work eventually completes). If we drop the override without fixing the duration, work gets killed at 60s every time a sync runs slow. The right sequence is: investigate the correct duration value (probably 30-60 min matching the estimatedDuration with headroom) FIRST, then drop the override.
>
> **Suggested phase path:**
> - Part A (cleanup): one fast-track story or part of a story. Standard 5-phase if bundled with Part B.
> - Part B (bug): properly-scoped story + ADR (the right duration value is an architectural choice that affects operator expectations + may have a follow-on on auto-tune Track B).
>
> **Classification:** Mixed (cleanup + bug). **Priority:** Medium — incomplete coverage of story #28's intended fix; cosmetic + 2 latent bugs.

### Deployment dry-run

Identical no-downtime profile to ADR 0024's:
- Pure registry-data change + tiny JS change. No Redis schema change, no migration code, no scheduler pause, no manual operator step.
- In-flight wrapper invocations at deploy time finish with their pre-deploy `resolved_options` — i.e., whatever forceKill they resolved at wrapper entry. New invocations post-deploy resolve forceKill from the new defaults.
- Pre-existing orphans on prod (from past timeouts) continue running until natural completion or operator action. The deploy itself doesn't kill them. Operator may choose to clean them up pre-deploy for tidiness; not required.
- Worst-case interaction: a long-running task already in its wrapper monitor loop at deploy time. It will use its pre-deploy resolved forceKill (likely false). The next invocation post-deploy gets the new default.

## Out of scope

- **Per-task `forceKill: false` override cleanup** — captured in the follow-up intake above.
- **Investigation of the 60s timeout on syncWoT / syncProfiles** — captured in Part B of the follow-up intake.
- **SIGTERM-then-SIGKILL graceful-kill ladder.** The current wrapper uses `kill -9` directly. A more graceful pattern (SIGTERM, wait N seconds, then SIGKILL) would give scripts a chance to clean up if they trap SIGTERM. Existing scripts don't trap SIGTERM, so the change is non-trivial; deferred.
- **Auto-tune of timeout durations** (Track B from 2026-05-25 intake `eb2df679`). Separate multi-session feature.
- **Held branch `fix/launch-child-task-protection-audit`** — separate work proceeding in parallel.
- **JS-exec API handlers intake** — those handlers bypass the wrapper entirely; story #28's fix doesn't reach them.
- **Changes to the `processAlreadyRunning.withoutError.launchNew` default** — explicitly rejected during /discuss (intake Option 3).
- **Smarter `check_task_already_running` PID-attribute detection** — explicitly rejected during /discuss (intake Option 2).
