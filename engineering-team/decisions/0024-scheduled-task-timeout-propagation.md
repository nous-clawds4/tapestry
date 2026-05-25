# ADR 0024: Restore scheduled-task timeout propagation via shared `resolveTaskTimeout` adoption + defense-in-depth at processor and wrapper

**Status:** Proposed
**Date:** 2026-05-25
**Story:** `engineering-team/stories/27-scheduled-task-timeout-propagation.md`
**Builds on:** ADR 0010 (story #13 — BullMQ task queue), ADR 0013 (story #15 — `neo4j-heavy` cap=1 semaphore — this ADR restores its contract without changing it), ADR 0019 (story #22 — generalized task scheduler — where the upstream miss originated), ADR 0021 (story #24 — per-entry scheduling — which inherited the miss).
**Does NOT supersede ADR 0013.** ADR 0013's contract is correct. The bug being fixed is that the timeout propagation chain that supports the contract was never actually honoring the registry's default.

## Context

### The bug, restated from story #27

Story #27 captures the empirically-confirmed root cause of the symptom the operator observed on staging on 2026-05-24: tagged `neo4j-heavy` tasks released the semaphore ~5–6 seconds after acquiring it, while the actual Neo4j-heavy work continued for up to hours. The ADR 0013 cap=1 contract has therefore been functionally absent since story #15 (~2026-05-20). Empirical evidence: 18 `CHILD_TASK_ERROR` events in 24 hours on staging, every one with `timeout_duration: 0, elapsed_time: 5000`, across `refreshSearchIndex`, `processCustomer`, and `updateAllScoresForOwner`.

The root cause is a propagation chain that **never carried the registry's default timeout to the wrapper script** for tasks with `"options": {}` in `taskRegistry.json`:

1. [`src/manage/taskQueue/queue/scheduler.js:86-89`](src/manage/taskQueue/queue/scheduler.js:86) — reads `timeoutMs` only from `taskDef.options.completion.failure.timeout.duration`; does NOT fall through to `registry.options_default.completion.failure.timeout.duration` (1800000 / 30 min). For tasks with `"options": {}` this produces `timeoutMs === 0`.
2. [`src/manage/taskQueue/queue/processor.js:117-127`](src/manage/taskQueue/queue/processor.js:117) — unconditionally ships `{ failure: { timeout: { duration: timeoutMs || 0, forceKill: false } } }` to launchChildTask.sh as the per-invocation options JSON, even when `timeoutMs` is 0. The per-invocation merge takes highest precedence in launchChildTask.sh's hierarchical-options logic and **clobbers the global default** at [launchChildTask.sh:208-211](src/manage/taskQueue/launchChildTask.sh:208).
3. [`src/manage/taskQueue/launchChildTask.sh:374-390`](src/manage/taskQueue/launchChildTask.sh:374) — monitor loop's `if [[ $elapsed -ge $timeout_seconds ]]` check is trivially true on the first iteration when `timeout_seconds == 0`. The script declares "timed out after 5s", does NOT kill the child (because the hardcoded `forceKill: false`), exits with code 124. Node's `child.on('close')` fires; the Worker callback's `finally { await release() }` releases the semaphore. The backgrounded child keeps running orphaned.

### Architectural lineage the Implementer should understand

This bug was not introduced by a deliberate design choice — it's a **DRY violation**.

A shared timeout-resolution utility already exists at [`src/utils/taskTimeout.js:31`](src/utils/taskTimeout.js:31) — `resolveTaskTimeout(task, registry, options?)`. It implements the correct hierarchical priority:

> Priority 1: task-specific `task.options.completion.failure.timeout.duration`
> Priority 2: global `registry.options_default.completion.failure.timeout.duration`
> Priority 3: `task.averageDuration × 2` (averageDuration with 100% safety buffer)
> Priority 4: hardcoded 30-minute default
> Plus: enforced 5-minute floor / 24-hour ceiling.

The **manual `/api/run-task` handler** at [`src/api/manage/commands/runTask.js:110`](src/api/manage/commands/runTask.js:110) uses this utility correctly — calls `resolveTaskTimeout`, passes the bounded result to `enqueueTask` as `timeoutMs`. **The scheduled-task path does not.** [`src/manage/taskQueue/queue/scheduler.js:86-89`](src/manage/taskQueue/queue/scheduler.js:86) rolls its own one-liner that reads only task-specific config and falls through to `|| 0`. The same utility is sitting two `require`s away and was not adopted when ADR 0019 introduced the scheduler.

This reframes the architectural question. We don't need to invent a new resolution strategy; we need to **use the existing one** and **harden the caller→wrapper-script interface** so the same bug can't recur via a future buggy caller.

### Two related semantic mismatches the fix needs to address

The bug surfaces three independent semantic problems at three layers. Any one of them, fixed alone, blocks the symptom. The architectural question is whether to fix one or all three:

- **Mismatch 1 — at the scheduler→queue caller boundary.** scheduler.js intends "the caller is responsible for resolving timeoutMs"; runTask.js honors that contract via `resolveTaskTimeout`; scheduler.js doesn't.
- **Mismatch 2 — at the caller→wrapper-script boundary.** processor.js conflates "no timeout override" with "timeout = 0". It always ships a per-invocation timeout block, even when the upstream caller passed 0. The wrapper script's hierarchical-options merge then treats this as a real override and clobbers the registry default.
- **Mismatch 3 — inside the wrapper script.** launchChildTask.sh's monitor-loop `elapsed >= timeout_seconds` check treats `timeout_seconds == 0` as "timeout immediately at first tick" rather than the Unix-conventional "no timeout, monitor indefinitely."

Each of these is independently a defect. Fixing only Mismatch 1 leaves the wrapper script dangerous for any future buggy caller. Fixing only Mismatch 3 leaves the upstream semantic confusion intact. The cleanest posture treats all three as defects and fixes each at its own layer — **defense in depth** rather than a single chokepoint.

### Constraints from the story

- AC #4 covers the **scheduled-task path** semaphore behavior; AC #5 covers the **manual `/api/run-task` path** semaphore behavior. Both must be honored. The runTask.js path is already correct via `resolveTaskTimeout`; the scheduled-task path is what's broken. Fixing only the scheduled-task path is sufficient for AC #5 (which already passes today on the manual path), but the wrapper-script and processor-side mismatches also need to be addressed if we want the manual path to be robust against future regressions on its own side.
- The story scopes out **forceKill default reconsideration** explicitly. This ADR preserves the current `forceKill: false` behavior — even after the fix, a genuinely-timed-out task continues running (status quo). Operators wanting actual process kills must wait for a separate ADR.
- The story scopes out the **held branch fate**. This ADR's choice of fix surface affects whether the held branch's parent-task tagging becomes load-bearing or remains moot; we note that explicitly but defer the decision.

### Concept-graph impact

Concept Graph API was not reachable from this Architect session (curl to `http://localhost:8877/api/concept-graph/summaries` returned empty). The /discuss session confirmed the same. The task-queue, scheduler, semaphore, and wrapper-script surfaces are operational/infrastructure layer with no concept-graph footprint (ADR 0013 explicitly confirmed this; ADR 0021 reconfirmed). **Firmware reinstall: no.**

## Options considered

### Option A — Defense-in-depth at all three layers (chosen)

Fix each of the three mismatches at its own layer:

1. **scheduler.js adopts `resolveTaskTimeout`.** Replace the inline `|| 0` one-liner with a call to the existing utility. This brings scheduler.js into alignment with runTask.js.
2. **processor.js sends per-invocation options only when there's a real override.** When `timeoutMs > 0`, ship `{ duration: timeoutMs, forceKill: false }` (preserving the current `forceKill` hardcode). When `timeoutMs === 0`, omit the entire `timeout` sub-object so the wrapper script's hierarchical merge falls through to `options_default`.
3. **launchChildTask.sh's monitor loop guards against `timeout_seconds == 0`.** Change `if [[ $elapsed -ge $timeout_seconds ]]; then` to `if [[ $timeout_seconds -gt 0 && $elapsed -ge $timeout_seconds ]]; then`. This makes `0` semantically equivalent to "no timeout, monitor indefinitely" — matching Unix convention (`timeout 0 cmd`, etc.).

Sketch (illustrative — Implementer adapts to surrounding style):

```js
// scheduler.js — at top:
const { resolveTaskTimeout } = require('../../../utils/taskTimeout');

// in upsertSchedule, replacing the current `const timeoutMs = (taskDef && …) || 0;`:
const { timeoutMs } = resolveTaskTimeout(taskDef, registry);
```

```js
// processor.js — in runWithResolvedArgs, replacing the current optionsJson literal:
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

```bash
# launchChildTask.sh — line ~385:
if [[ $timeout_seconds -gt 0 && $elapsed -ge $timeout_seconds ]]; then
```

**Pros**
- **Each layer is independently correct after the fix.** A future regression at any single layer doesn't re-introduce the bug.
- **Adopts an existing utility** (`resolveTaskTimeout`) — closes the DRY violation. scheduler.js and runTask.js now share resolution logic. Future timeout-resolution improvements land in one place.
- **Fixes the dangerous "0 means immediate timeout" surprise** in the wrapper script. Future test probes or one-off invocations that want "no timeout" can now legitimately pass 0 and get the intuitive behavior.
- **Closes the semantic mismatch at the caller→wrapper boundary** — processor.js no longer pretends to override something it doesn't have a value for.
- **Defensive against future invocation paths.** Any new caller of `enqueueTask` (other than scheduler.js and runTask.js) is now insulated from the wrapper-script foot-gun by Layer 3's guard.
- **Story AC alignment:** AC #1 (timeout reaches wrapper), #2 (no spurious 5s timeout), #3 (genuine timeout still works), #4 (semaphore held for actual duration on scheduled path), #5 (same on manual path), #6 (cap=1 observable), #7 (per-task overrides still win) — all satisfied by this combination.

**Cons**
- **Three files touched instead of one.** Bigger PR surface for review. Mitigated: each diff is 1–10 lines; total diff is well under 50 lines of code.
- **Defense-in-depth can mask future regressions.** If Layer 1 silently regresses, Layer 2 or 3 catches it — meaning the test suite must explicitly cover each layer's behavior independently. The Tester gets specific guidance on this in the Implementation notes.
- **The `forceKill: false` hardcode in processor.js remains** as a known-but-deferred concern. After this fix, a genuine timeout still won't kill the child — the wrapper just correctly identifies "timed out" at the right time. Operators who want process-kill-on-timeout must wait for a follow-up ADR (per story scope-out).

### Option B — Surgical upstream-only fix (scheduler.js adopts `resolveTaskTimeout`; processor.js and wrapper untouched)

The smallest possible diff. scheduler.js calls `resolveTaskTimeout(taskDef, registry)`; everything else stays.

**Pros**
- Smallest diff (one require + one line changed).
- Most surgical posture; least review surface.
- Restores correct behavior for every scheduled-task fire today.

**Cons**
- **Doesn't fix the semantic mismatches at processor or wrapper layers.** A future bug introduced in processor.js (e.g., a new code path that passes a 0 timeout) would re-orphan tasks.
- **Doesn't fix the dangerous "0 means immediate timeout" wrapper-script foot-gun.** Future test probes or experimental invocations that pass timeoutMs=0 still get the surprising behavior.
- **Leaves the DRY violation partially.** scheduler.js now uses the shared utility, but processor.js still has its own incorrect "always ship duration" logic (it'll just always ship a correct value because scheduler.js is the only upstream that wasn't using `resolveTaskTimeout`).
- **Layer 3's guard is genuinely useful as a safety net** independent of Layer 1's fix — declining it leaves a knife on the floor.

**Rejected** because the wrapper-script foot-gun (Layer 3) is genuinely dangerous independent of any upstream bug, and the processor-side mismatch (Layer 2) is a 5-line cleanup that markedly improves the caller-to-wrapper contract. The marginal cost of doing all three is small; the marginal correctness benefit is large.

### Option C — Wrapper-script symptom fix only (launchChildTask.sh monitor guard)

Add the `&& timeout_seconds -gt 0` guard to launchChildTask.sh's monitor loop. Leave scheduler.js and processor.js alone.

**Pros**
- One-line diff. Most surgical possible. The bug stops manifesting.

**Cons**
- **Symptom-only.** Doesn't fix the upstream miss (scheduler.js still sends `timeoutMs: 0` for tasks with `options: {}`; processor.js still ships `{ duration: 0 }` to the wrapper). The wrapper-script guard correctly interprets this as "no timeout" — but the system has now lost the global-default 30-minute timeout entirely for affected tasks.
- **Wrong semantics.** A task with `"options": {}` should get the registry's 30-minute default timeout (that's why `options_default` exists), not "monitor indefinitely with no timeout." Option C silently changes the effective contract for ~half the registry.
- Doesn't address the DRY violation. The shared `resolveTaskTimeout` utility remains unused by the scheduler path.

**Rejected** because it fixes the symptom but changes a registry-level invariant (the global default timeout) silently. Operators relying on the existence of a 30-min ceiling would lose it without knowing.

### Option D — Refactor: move all timeout resolution into launchChildTask.sh (wrapper becomes authoritative)

Make the wrapper script the authoritative timeout-resolution layer. Have processor.js stop sending per-invocation timeout options entirely. The wrapper script's hierarchical merge becomes the only resolution path.

**Pros**
- Single resolution chokepoint. No DRY violation.
- Wrapper script is already doing hierarchical resolution; just delete the per-invocation override pathway.

**Cons**
- **Breaks the existing manual `/api/run-task` contract** that supports per-invocation timeout overrides (e.g., a test/probe that wants a short timeout for fast feedback). Future stories that need per-invocation timeouts would have to re-introduce the override mechanism.
- **Loses `resolveTaskTimeout`'s averageDuration-based heuristic and min/max bounds enforcement.** The wrapper script doesn't currently implement these; reimplementing them in bash is harder than reusing the Node utility.
- **Inverts the existing direction of trust.** Today the Node layer is authoritative; the wrapper script's hierarchical merge is fallback. Inverting this is a larger architectural change than the bug requires.

**Rejected** as out-of-scope for a bug fix. If the team later decides to make the wrapper script authoritative, that's a separate ADR.

## Decision

**We chose Option A** — defense-in-depth at all three layers:

1. scheduler.js adopts the shared `resolveTaskTimeout` utility.
2. processor.js conditionally builds the per-invocation options JSON — sends `timeout` block only when `timeoutMs > 0`.
3. launchChildTask.sh monitor loop guards against `timeout_seconds == 0` treating it as "no timeout."

The reasoning: each layer's defect is independently real and independently low-cost to fix. The cumulative diff is small (well under 50 lines across three files). Defense-in-depth posture is appropriate given:
- The bug has been live for ~5 days affecting every scheduled task with `"options": {}`.
- The bug went undetected through code review of ADR 0019, ADR 0021, ADR 0023, and the related stories.
- The held branch's prior architectural attempt (story #26 / ADR 0023) was based on the wrong root-cause hypothesis and required a session-spanning investigation to surface the actual cause.

What we are trading away: a slightly larger PR surface (~50 lines across three files vs. ~5 lines in one file). What we gain: each layer is correct independently; the foot-gun is gone in three places at once; the DRY violation is closed.

## Consequences

**Enabled**
- ADR 0013's `cap=1` `neo4j-heavy` semaphore contract becomes actually-enforced for the first time since story #15 shipped. Concurrent heavy tasks serialize at the BullMQ Worker callback level.
- Every scheduled task with `"options": {}` in the registry now gets the registry's global default timeout (30 min today) — restoring the long-intended safety ceiling.
- Operators reading the Scheduled Tasks panel see accurate task lifecycle — TASK_START is followed by a real TASK_END (not a spurious 5s "timeout" + orphaned long-runner).
- `events.jsonl` stops accumulating spurious `CHILD_TASK_ERROR error_type=timeout elapsed_time=5000` records (~96/day across affected tasks today on staging).
- Future callers of `enqueueTask` that forget to pass a `timeoutMs` are protected by Layer 3's wrapper-script guard (the task gets monitored indefinitely instead of timing out at 5s).
- The shared `resolveTaskTimeout` utility now has two real consumers (runTask.js + scheduler.js), establishing it firmly as the canonical resolution path. Future timeout-policy improvements land in one place.

**Constrained / made harder**
- The wrapper script's `timeout_seconds == 0` semantics changed from "timeout at first tick" to "no timeout, monitor indefinitely." Any test or operational use that relied on the old (buggy) behavior to force a quick exit would break. None known.
- processor.js's per-invocation options JSON shape becomes conditional rather than uniform. Code reading the wrapper-script input now needs to handle both "full options" and "empty options" shapes. The wrapper's existing hierarchical-merge logic already handles both cases gracefully (it merges with `options_default` either way), so this is invisible to the wrapper.
- The `forceKill: false` hardcode in processor.js's per-invocation block remains. After this fix, a genuinely-timed-out task is correctly identified as timed out but is still not killed. A separate ADR can revisit (per story scope-out).
- Defense-in-depth means the test suite must verify each layer's correctness independently — Layer 1's regression mustn't be masked by Layer 2 or Layer 3 being correct. The Tester gets explicit guidance below.

**Follow-up debt (deferred — do NOT pull into this story)**
- **The held branch `fix/launch-child-task-protection-audit`** (story #26). After this fix lands and the semaphore actually works, the held branch's tag-additions for `processAllTasks` and `processNpubsUpToMaxNumBlocks` become **load-bearing again** — they would correctly extend the protection across the parent's subshell chain (because the parent's Worker callback would now hold the semaphore for the parent's actual full duration, not just 5 seconds). The decision of whether to revert / carry-forward / land-as-follow-up is a separate small follow-up. NOT this ADR's call.
- **JS-exec API endpoints** (the 5 endpoints in the MEDIUM-HIGH intake). Same neo4j-heavy concern via a different (non-BullMQ) invocation path. Different fix shape. Separate story.
- **`forceKill: false` reconsidered.** Story scope-out. A future operator-visible incident or an explicit story can revisit.
- **Programmatic enforcement** that all `enqueueTask` callers either supply a `timeoutMs` or use `resolveTaskTimeout`. Could be a sentinel test; could be a wrapper. Not needed for this fix; consider if drift recurs.

**Firmware reinstall required?** No. No concept-graph or firmware-definition changes.

## Implementation notes

The Implementer reads this section verbatim.

### Files to edit

**1. [`src/manage/taskQueue/queue/scheduler.js`](src/manage/taskQueue/queue/scheduler.js)**

- Add at the top alongside the other `require`s: `const { resolveTaskTimeout } = require('../../../utils/taskTimeout');`
- In `upsertSchedule`, replace the current `timeoutMs` block at lines 86-89:
  ```js
  // BEFORE (broken — doesn't fall through to options_default):
  const taskDef = registry && registry.tasks && registry.tasks[entry.taskId];
  const timeoutMs =
    (taskDef && taskDef.options && taskDef.options.completion &&
      taskDef.options.completion.failure && taskDef.options.completion.failure.timeout &&
      taskDef.options.completion.failure.timeout.duration) || 0;
  ```
  with:
  ```js
  // AFTER (uses shared utility — same logic as runTask.js):
  const taskDef = registry && registry.tasks && registry.tasks[entry.taskId];
  const { timeoutMs } = resolveTaskTimeout(taskDef, registry);
  ```
- No other changes in this file. `taskDef` is already in scope for the existing flow. The `resolveTaskTimeout` utility handles task-level → registry-default → averageDuration → 30-min-hardcode → min/max-bounds resolution and returns a bounded value.
- Note for the Implementer: `resolveTaskTimeout` returns `{ timeoutMs, timeoutSeconds, timeoutMinutes, ..., forceKill, source, ... }`. Only `timeoutMs` is needed for the Job Scheduler's `data` payload (which is what gets passed through to processor.js → wrapper script).

**2. [`src/manage/taskQueue/queue/processor.js`](src/manage/taskQueue/queue/processor.js)**

- In `runWithResolvedArgs` at lines 117-127, replace the current unconditional `optionsJson` construction:
  ```js
  // BEFORE (always ships a duration, even when 0):
  const optionsJson = JSON.stringify({
    completion: {
      failure: {
        timeout: {
          duration: timeoutMs || 0,
          forceKill: false
        }
      }
    }
  });
  ```
  with a conditional build that omits the `timeout` block when `timeoutMs` is falsy/zero:
  ```js
  // AFTER (only ships override when there's a real value):
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
- The `forceKill: false` hardcode is preserved (story scopes out forceKill reconsideration).
- The wrapper script's hierarchical-merge logic at [launchChildTask.sh:208-211](src/manage/taskQueue/launchChildTask.sh:208) treats an empty per-invocation options JSON (`{}`) as "no overrides," which is exactly what we want — the registry's `options_default.completion.failure.timeout` becomes effective.
- No other changes in this file.

**3. [`src/manage/taskQueue/launchChildTask.sh`](src/manage/taskQueue/launchChildTask.sh)**

- In the monitor loop around line 385, change the timeout check:
  ```bash
  # BEFORE (trivially true when timeout_seconds=0):
  if [[ $elapsed -ge $timeout_seconds ]]; then
  ```
  to:
  ```bash
  # AFTER (0 means "no timeout, monitor indefinitely" — Unix convention):
  if [[ $timeout_seconds -gt 0 && $elapsed -ge $timeout_seconds ]]; then
  ```
- This is a single-line logical change. Surrounding code unchanged (the `sleep $check_interval`, the `elapsed` increment, the `timed_out=true; break` body).
- The `Starting monitoring loop for PID X (timeout: 0s)` log line stays as-is — it correctly reports the configured timeout. After the fix, the loop simply never trips on it.
- No other changes in this file.

### What this fix touches and what it doesn't

**Touched**: timeout-propagation chain across three files; ~25 lines of code total.

**Not touched (deliberately)**:
- `taskRegistry.json` — no entries modified. The `options_default.completion.failure.timeout.duration: 1800000` value is what we're now correctly propagating. No task entries need their `options: {}` filled in — that's the whole point of having a default.
- `resourceSemaphore.js` — the semaphore's `acquire` / `release` logic is correct. The bug was that release happened too early because the wrapped Node-side process exited too early. With this fix, the Node-side process now stays alive for the actual task duration; the semaphore release happens at the right time naturally.
- `queue/index.js` — the Worker callback's `acquire → processJob → finally release` pattern from ADR 0013 is correct. No change.
- `taskTimeout.js` — the utility is correct. We're just adopting it from a second caller.
- `runTask.js` — already correct. No change.

### Sentinel tests the Tester should write

Per Tapestry's testing convention (source-sentinel style for code-shape assertions; behavioral assertions for end-to-end), the Tester should produce both:

**Source sentinels (cheap, pin the fix in place):**
- `scheduler.js` imports `resolveTaskTimeout` from `../../../utils/taskTimeout` (path adjusted to actual depth).
- `scheduler.js` calls `resolveTaskTimeout(taskDef, registry)` inside `upsertSchedule` and destructures `timeoutMs`.
- `processor.js`'s `optionsJson` construction is conditional on `timeoutMs > 0` (i.e., the file contains both `'{}'` and `'duration: timeoutMs'` patterns with a guard).
- `launchChildTask.sh` contains the literal `timeout_seconds -gt 0 && $elapsed -ge $timeout_seconds` (or its semantic equivalent — Implementer may format slightly differently but the `-gt 0` guard must be present).

**Behavioral / integration assertions (cover the AC):**

Each story AC maps to one or more behavioral tests:

- **AC #1** (configured timeout reaches the wrapper for `options: {}` tasks): test that `resolveTaskTimeout(taskWithEmptyOptions, registry)` returns `registry.options_default.completion.failure.timeout.duration` (1800000). And/or test that the scheduler's enqueued job-data payload has `timeoutMs === 1800000` for a fixture task with `"options": {}`.
- **AC #2** (no spurious `error_type: timeout` with `elapsed_time: 5000` for healthy fires): integration-style test that enqueues a task with timeoutMs=1800000, runs to completion in <30 min, and verifies no `CHILD_TASK_ERROR error_type=timeout` events fire. Can be run against the dev stack with a synthetic short task.
- **AC #3** (genuine timeout still works): integration test with a synthetic task whose script sleeps for longer than its configured timeout; verify `CHILD_TASK_ERROR error_type=timeout` fires with `elapsed_time` matching the configured timeout (within tolerance, not 5s).
- **AC #4** (semaphore `held_seconds` matches actual work on scheduled path): probe-style test like `test/probe-bullmq-removeOnComplete-immediate.js` — enqueue a tagged task with a known-duration script (e.g., 30-second sleep), observe the `resource_class_released` event reports `held_seconds ≈ 30` (within ±5s tolerance).
- **AC #5** (same on manual `/api/run-task` path): same probe shape but triggered via `enqueueTask` directly with no explicit timeoutMs override. Verify `held_seconds ≈ work duration`.
- **AC #6** (cap=1 serialization observable): two tagged tasks back-to-back; verify the second's `resource_class_wait_end outcome=acquired` timestamp is **after** the first's `resource_class_released` timestamp, with a wait > 0.
- **AC #7** (per-task explicit overrides still win): test that `resolveTaskTimeout(taskWithExplicitOverride, registry)` returns the task's own value, not the registry default. Already implicitly tested by the utility's existing test surface (if any); confirm or add.

The probe-style tests (#4, #5) are the same shape as story #25's `test/probe-bullmq-removeOnComplete-immediate.js`. The Tester can model from that.

### Concept handle

None. No concept-graph changes.

### Operations docs

No new operator surface is added. `OPERATIONS.md` doesn't need a new section. The existing `events.jsonl` documentation (resource_class_wait_begin/end, resource_class_released) becomes more meaningful since the events now reflect real holding behavior.

A one-line sentence in `BIBLE.md` §24 (or wherever the task-queue / timeout protocol is documented) clarifying that `options_default.completion.failure.timeout.duration` is the default for any task without an explicit override would be useful but not strictly required — the behavior matches what an operator reading the registry would intuit.

### Implementer self-check before commit

Before opening a PR:

1. Verify on the dev stack: enqueue a tagged task (e.g., `processCustomer` with a test customer) via `enqueueTask` directly. Tail `events.jsonl` (`/var/log/brainstorm/taskQueue/events.jsonl` inside the container) and verify the `resource_class_released` event reports `held_seconds` close to the actual task duration, not ~6.
2. Verify the wrapper-script log shows `Starting monitoring loop for PID X (timeout: 1800s)` for a task with `"options": {}` (was 0 before).
3. Verify no new `CHILD_TASK_ERROR error_type=timeout elapsed_time=5000` events accumulate.
4. Run the source-sentinel and behavioral test suites.

## Out of scope

- **Held branch `fix/launch-child-task-protection-audit` fate.** Note this ADR enables the held branch's tag-additions to become functionally load-bearing again (the parent's BullMQ Worker callback would now correctly hold the semaphore for the parent's actual duration). Whether to revert / carry-forward / land-as-follow-up is a separate decision. Recommended: a small follow-up story after this fix verifies on staging + prod.
- **JS-exec API endpoints** that spawn tagged-task scripts directly from Node (bypassing BullMQ). Separately filed intake (MEDIUM-HIGH). Different fix shape (refactor handlers to enqueue via BullMQ, or deprecate, or accept-and-document). Same neo4j-heavy concern; different surface.
- **`forceKill: false` reconsideration.** After this fix, a genuinely-timed-out task continues running — the wrapper just correctly identifies the timeout. Whether to change the default to `true` (or make it task-configurable in practice) is a separate ADR. The current behavior is preserved as status quo.
- **Programmatic enforcement of `resolveTaskTimeout` adoption.** A test sentinel or a lint rule that forces every `enqueueTask` caller to either pass a `timeoutMs` from `resolveTaskTimeout` or document why not. Worth doing if drift recurs; not required for this fix.
- **Migration of any other Node code paths** that might similarly bypass `resolveTaskTimeout`. The current callers are runTask.js (correct) and scheduler.js (fixed by this ADR). If a future grep finds others, address them in their own stories.
- **Story #26's "subshell coverage gaps" framing.** Explicitly NOT re-imported.
- **Lint / typecheck / build infrastructure** to catch this class of bug. Per CLAUDE.md house rules.
