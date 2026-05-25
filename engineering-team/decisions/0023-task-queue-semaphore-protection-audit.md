# ADR 0023: Close `neo4j-heavy` semaphore coverage gaps via comprehensive parent-tag audit + ADR 0013 amendment

**Status:** Proposed
**Date:** 2026-05-24
**Story:** `engineering-team/stories/26-task-queue-semaphore-protection-audit.md`

## Context

ADR 0013 introduced a Redis-backed counted semaphore (`neo4j-heavy`, cap=1) to prevent Neo4j crashes from concurrent heavy work. The semaphore wrap lives in the BullMQ Worker callback at [`src/manage/taskQueue/queue/index.js:118-131`](src/manage/taskQueue/queue/index.js:118): a tagged task's Worker `await semaphore.acquire(...)` before `processor.processJob`, releasing in `finally`.

Story #26 surfaced — and a planning + architecture-phase audit confirmed — that this protection only engages when the entry-point task itself is invoked via BullMQ. Tasks invoked as bash subshells from parent scripts run as forked subprocesses outside BullMQ; their Worker callback never executes; their semaphore wrap is dormant. PR #201 (story #24 follow-up) tagged the orchestrator-level parents (`updateAllScoresForOwner`, `processCustomer`, `processAllActiveCustomers`) so the parent's BullMQ Worker holds the semaphore across its entire subshell chain. This works — verified — but it created an implicit convention: **a tagged task is only protected when the entry-point in its invocation chain is itself tagged**.

The story's 6 ACs require: (1) every tagged task is reachable from a BullMQ-invoked entry point with semaphore engaged; (2) the two known gaps (`processAllTasks`, `processNpubsUpToMaxNumBlocks`) are closed; (3) any other parent script in the codebase is audited and either confirmed tagged or confirmed unreachable; (4) ADR 0013 amended in-place; (5) BIBLE.md §24 documents the convention; (6) no-downtime deploy.

### Constraints and grounded facts

- **Concept Graph:** Not impacted. Story #26 confirms no concept-graph footprint (matches ADR 0013 §"Concept-graph impact"). I re-attempted `http://localhost:8877/api/concept-graph/summaries` — local stack not running. **Firmware reinstall: no.**
- **Four spawn patterns to audit** (a child running via any of these escapes BullMQ):
  1. `launch_child_task "<taskName>" ...` — the wrapper from `launchChildTask.sh`. Used by [`src/algos/updateAllScoresForOwner.sh`](src/algos/updateAllScoresForOwner.sh), [`src/manage/processAllTasks.sh`](src/manage/processAllTasks.sh).
  2. `bash $script` — bare bash invocation. Used by customer-side parents ([`src/algos/customers/processCustomer.sh:83,102`](src/algos/customers/processCustomer.sh:83), [`src/algos/customers/updateAllScoresForSingleCustomer.sh:94,165,236,307,383,451`](src/algos/customers/updateAllScoresForSingleCustomer.sh:94), [`src/algos/customers/processAllActiveCustomers.sh:119`](src/algos/customers/processAllActiveCustomers.sh:119)).
  3. `"$script"` — direct executable invocation (requires executable bit). Used by [`src/manage/nostrUsers/processNpubsOneBlock.sh:50,105`](src/manage/nostrUsers/processNpubsOneBlock.sh:50).
  4. `node $script` — direct node invocation for .js scripts. Used by [`src/manage/nostrUsers/processNpubsOneBlock.sh:72`](src/manage/nostrUsers/processNpubsOneBlock.sh:72).
- **26 tasks currently tagged `neo4j-heavy`** in [`taskRegistry.json`](src/manage/taskQueue/taskRegistry.json) (per PR #201 backfill).
- **Confirmed live unprotected path on prod:** the scheduled `processNpubsUpToMaxNumBlocks` entry uses an untagged registry entry and spawns `processNpubsOneBlock.sh` (not a registered task), which in turn directly-invokes `updateNpubsInNeo4j.sh` (registered + tagged). updateNpubsInNeo4j's tag is dormant on this path. Fires every ~6 hours.
- **Subtle gotcha — script registered under multiple task names with different tag status:**
  ```
  processNpubsUpToMaxNumBlocks.sh → task name "processNpubsUpToMaxNumBlocks" (untagged) AND task name "npubManager" (tagged)
  ```
  The scheduler entry on prod uses the **untagged** `processNpubsUpToMaxNumBlocks` task name; a future operator firing `npubManager` via `/api/run-task` would hit the same script through the tagged path and engage the semaphore correctly. Three other scripts have similar dual-registration (`processFollowsMutesReports.sh`, `publishNip85.sh`, `loadScoresIntoMeilisearch.sh`), but their dual-entries are intentional context distinctions (owner-vs-customer) and both variants have consistent tag status.
- **Latent unprotected path (not currently scheduled, but registered + has a systemd timer file):** `processAllTasks` is registered (untagged) with parents-many tagged children invoked via `launch_child_task`. `systemd/processAllTasks.timer` exists in the repo. If activated (host systemd, not Docker-internal) this would fire `processAllTasks.sh` and run a long subshell chain of dormant-tagged children. Operator status of this timer is not visible from the host; the safe assumption is it could become active.
- **Defense-in-depth premise (from PR #201):** tags on children are NOT pure decoration — they engage when the child is independently invoked via `/api/run-task` or scheduled as its own entry. Children's tags are dormant only on parent-driven paths; they're load-bearing on direct paths. Story Out-of-scope explicitly preserves these "dormant tags" as defense-in-depth.

### 2026-05-24 amendment — JS-driven `child_process.exec` from API handlers: explicitly scoped out

During the Implementer's audit pass on 2026-05-24, a 5th spawn pattern was surfaced that does NOT fall into the subshell taxonomy this ADR addresses: legacy API handlers in `src/api/algos/*/commands/*.js`, `src/api/customers/commands/process-all-active-customers.js`, and `src/api/pipeline/reconcile/commands/execute.js` use `child_process.exec` to spawn tagged-task scripts directly from Node, bypassing both BullMQ and the parent-tag chain entirely. The Implementer correctly invoked the Outcome contract's "stop and re-open ADR 0023" branch ("a tagged child reached via a non-bash mechanism like a cron entry or a JS-driven `exec()`").

**Confirmed live cases that map to tagged tasks:**

| Endpoint | Handler file:line | Script spawned | Tagged task it maps to |
|---|---|---|---|
| `POST /api/process-all-active-customers` | [`src/api/customers/commands/process-all-active-customers.js:21`](src/api/customers/commands/process-all-active-customers.js:21) | `processAllActiveCustomers.sh` | processAllActiveCustomers ✓ |
| `POST /api/generate-pagerank` | [`src/api/algos/pagerank/commands/generate.js:21`](src/api/algos/pagerank/commands/generate.js:21) | `calculatePersonalizedPageRank.sh` | calculateOwnerPageRank ✓ |
| `POST /api/generate-reports` | [`src/api/algos/reports/commands/generate.js:21`](src/api/algos/reports/commands/generate.js:21) | `calculateReportScores.sh` | calculateReportScores ✓ |
| `POST /api/generate-verified-followers` | [`src/api/algos/verifiedFollowers/commands/generate.js:21`](src/api/algos/verifiedFollowers/commands/generate.js:21) | `calculateVerifiedFollowerCounts.sh` | calculateVerifiedFollowerCounts ✓ |
| `GET /api/calculate-hops`-ish | [`src/api/algos/hops/commands/calculate.js:31`](src/api/algos/hops/commands/calculate.js:31) | `src/algos/calculateHops.sh` | calculateCustomerHops ✓ (per registry script-path match) |

Also surfaced but not currently a tagged-task gap: `algos/graperank/commands/generate.js` (spawns `calculatePersonalizedGrapeRank.sh` which isn't registered — possibly legacy/superseded), `pipeline/reconcile/commands/execute.js` (spawns `reconciliation.sh`, also not in the registry — the deprecated path per OPERATIONS.md §"reconcile.timer remains deprecated"), and three `negentropySync` handlers (spawn scripts that aren't tagged tasks — no gap).

**Why this is materially different from the four subshell patterns.** Subshell-spawned children at least inherit protection from a tagged parent's BullMQ Worker callback. JS-exec API handlers are *top-level* entry points — there's no parent in the Worker callback chain to inherit from. The mitigation is fundamentally different (refactor handler to enqueue via BullMQ → Worker → semaphore wrap, or deprecate the legacy endpoint, or accept). None of those fixes are this ADR's chosen mechanism (registry-data tagging). Story #26 / ADR 0023 is the wrong vehicle.

**Decision: explicitly scope OUT of story #26 / ADR 0023; file as a new intake for separate triage.** Story #26's AC #1 already enumerates only three invocation paths ("`/api/run-task`, a scheduled-tasks entry, or as a subshell child of any parent script") — JS-exec API endpoints are not named. The story is literally already scoped to subshell patterns; this amendment makes explicit what was implicit. The Implementer's attestation sentence template is updated below to reflect the narrowed scope.

**Implementer copy-to-file at commit time.** When committing the story #26 implementation, the Implementer copies the following block verbatim into `engineering-team/stories/_intake.md` (append at end). This filing is a deliverable of the story; it doesn't need re-Architect review.

> **## 2026-05-24 — Architecture: legacy API handlers `child_process.exec` tagged-task scripts directly, bypassing BullMQ + semaphore**
>
> **Surfaced during:** the Implementer's audit pass for story #26 / ADR 0023 on 2026-05-24. Halted implementation per ADR 0023's Outcome contract ("stop and re-open ADR 0023 if the audit surfaces a new spawn pattern not enumerated... or any other novelty"). ADR 0023's amendment scopes the JS-exec pattern OUT and files this intake.
>
> **Mechanism:** five registered API endpoints in `src/api/index.js` route to JS handlers that use `child_process.exec` to spawn bash scripts directly. The spawned scripts map to neo4j-heavy tagged tasks in the registry, but the exec path completely bypasses BullMQ — no Worker callback runs, no semaphore acquire happens. Parent-tag inheritance (the mechanism story #26 ships for the subshell pattern) does not apply because there's no parent in a BullMQ Worker callback chain; the handler IS the entry point.
>
> **Confirmed handler-to-tagged-task mappings:**
> | Endpoint | Handler | Tagged task |
> |---|---|---|
> | `POST /api/process-all-active-customers` | `process-all-active-customers.js:21` | processAllActiveCustomers |
> | `POST /api/generate-pagerank` | `algos/pagerank/commands/generate.js:21` | calculateOwnerPageRank |
> | `POST /api/generate-reports` | `algos/reports/commands/generate.js:21` | calculateReportScores |
> | `POST /api/generate-verified-followers` | `algos/verifiedFollowers/commands/generate.js:21` | calculateVerifiedFollowerCounts |
> | `GET /api/calculate-hops`-ish | `algos/hops/commands/calculate.js:31` | calculateCustomerHops |
>
> Also flagged: `algos/graperank/commands/generate.js` spawns `calculatePersonalizedGrapeRank.sh` (not in registry — possibly superseded by `/api/run-task?taskName=calculateOwnerGrapeRank`), `pipeline/reconcile/commands/execute.js` spawns `reconciliation.sh` (deprecated path per OPERATIONS.md). These two probably want deprecation rather than refactor.
>
> **Three remediation options (Architect to triage):**
> 1. **Refactor JS handlers to enqueue via BullMQ.** Replace the `exec` call with a call to `taskQueue.enqueueTask` (or an internal `/api/run-task` HTTP call). Job goes through Worker callback, semaphore engages, BullBoard sees it. Closest to ADR 0012's intent. Trade-off: ~5 handler files to touch + behavioral migration (sync vs async semantics, response shape).
> 2. **Deprecate the legacy endpoints.** These handlers predate `/api/run-task` (story #13 / ADR 0012, 2026-05-20). Confirm no live consumers (UI, scripts, cron); if clear, remove the endpoint + handler; document `/api/run-task?taskName=<task>` as the replacement. Smallest diff if no consumers; can't ship if consumers exist.
> 3. **Accept + document.** Add a warning to each handler comment + OPERATIONS.md noting these bypass the semaphore. Punts the gap. Probably unacceptable for the live `/api/generate-pagerank` and `/api/process-all-active-customers` endpoints — they run heavy Neo4j work.
>
> **Classification:** Bug — public API endpoints bypass the documented ADR 0013 protection model. Same neo4j-heavy serialization concern as Intake A but via different URLs.
> **Strictness:** Standard.
> **Phase path:** `/discuss` first to triage the three options (especially: which endpoints have live consumers? which to refactor vs deprecate?), then Planning → Architecture → Test Design → Implementation → Review.
> **Priority:** Medium-high. Operator-triggerable, currently unprotected on prod. Same severity as Intake B was before story #25 closed it.

### 2026-05-24 amendment (later) — chosen mechanism is functionally moot; story #26 paused pending root-cause investigation

After the Implementer completed story #26's implementation, an operator-observed discrepancy on `staging.brainstorm.world` surfaced data that invalidates this ADR's premise. During Review-phase triage, the operator noticed:

- `Process Brainstorm` (taskId: `processCustomer`) showed "Running" on the Scheduled Tasks panel from a 7:12 PM EDT TASK_START with no TASK_END.
- BullBoard's active view was empty.
- The legacy task explorer showed TASK_START with no TASK_END.

Pulling the structured events from `events.jsonl` revealed the actual sequence (all UTC):

| Timestamp | Event | PID | Detail |
|---|---|---|---|
| 23:12:57.975 | `resource_class_wait_end` | 188 (Node Worker) | semaphore **acquired**, wait_seconds: 0 |
| 23:12:58 | `TASK_START` (×2) | 1723 (processCustomer.sh) | task begins |
| **23:13:03.973** | **`resource_class_released`** | **188** | **semaphore released, `held_seconds: 6`** |
| (77-min gap, processCustomer.sh PID 1723 still running) | — | 1723 | task continues unprotected |
| 00:29:37 (2026-05-25) | `TASK_END` (×2) | 1723 | task finishes naturally |

**The semaphore was held for ~6 seconds out of a ~77-minute task.** The same pattern was confirmed against another tagged task: `updateAllScoresForOwner`'s most recent run (19:08:19 UTC) shows the same `held_seconds: 6` shape.

**Implications:**

- **PR #201's parent-tagging fix is functionally moot.** Tagging parents adds ~6 seconds of semaphore-held setup time, not protection over the actual heavy work. The bash subprocess (where the heavy Neo4j work actually happens) runs *outside* the semaphore for the bulk of its duration.
- **Story #26 / ADR 0023's chosen mechanism (Option B: comprehensive tag) is also functionally moot.** Tagging `processAllTasks` and `processNpubsUpToMaxNumBlocks` will give them ~6 seconds of semaphore protection each, then their work runs unprotected like everything else.
- **ADR 0013's documented contract ("cap concurrent neo4j-heavy work at 1") is not what the system actually enforces.** Two scheduled tagged tasks firing in the same minute would both acquire+release in ~6 seconds and then run in parallel for hours. The reason Neo4j hasn't crashed despite this is either (a) the actual concurrent workload hasn't been heavy enough to trigger the crash mode ADR 0013 was guarding against, (b) Neo4j is more tolerant than ADR 0013 assumed, or (c) other coincidences have masked it.
- **The audit attestation in ADR 0013's amendment ("audit performed... all four subshell spawn patterns checked") is technically accurate but materially misleading** — the audit was complete given the (incorrect) premise that parent-tag protects the chain.

**Root cause: requires investigation, not architect speculation.** The mechanism by which the Worker's `await processor.processJob` resolves after ~6 seconds while the bash subprocess keeps running is not yet identified. Candidate hypotheses (all unverified):

1. `launchChildTask.sh:380-390` monitor loop exits prematurely — possibly the captured `child_pid` from `bash "$child_script" &` corresponds to a short-lived intermediate shell rather than the actual long-running script process.
2. BullMQ stalled-job recovery fires within 30s (default `stalledInterval`), moves the job, fires the Worker callback's `finally` block. The orphaned bash subprocess keeps running.
3. processor.js's `child.on('close')` fires on the bash launchChildTask.sh PID, but that PID exits early due to some bash subshell semantics related to backgrounded processes + `set -e`/`set -o pipefail`.
4. Some other Node/BullMQ race condition.

The exact cause needs a focused reproduction probe — not architecture guesswork.

**Decision: story #26 is paused; this ADR's chosen mechanism is marked premise-undermined; new investigation story spun off.**

- Story #26's branch (`fix/launch-child-task-protection-audit`) is NOT to be deployed to staging until the root cause is identified and a real fix lands. The implementation work (registry tags + ADR/BIBLE.md amendments) is reversible — `git revert` if the investigation determines the tags should be removed, or carry forward into the new story if the root cause fix vindicates the parent-tag pattern.
- The Reviewer's PASS verdict from earlier in this session is **withdrawn** in light of this finding. The verdict was technically accurate to its stated scope (ADR adherence + AC list as written + test gate) but materially misleading because the underlying mechanism is broken. The Reviewer report should not be committed as-is.
- A new investigation story is spun off (intake content below). It carries the actual root-cause work and any architectural redesign that follows.

**Implementer copy-to-file at commit time** (if story #26's tag/doc work is kept; otherwise the investigation story carries this forward). Append the following to `engineering-team/stories/_intake.md`:

> **## 2026-05-24 — Bug: `neo4j-heavy` semaphore released ~5s after acquire while tagged work runs unprotected for hours**
>
> **Surfaced during:** Review-phase operator triage on story #26 / ADR 0023. Operator noticed a "Running" task in the Scheduled Tasks panel with no matching TASK_END for 1.5 hours; investigation revealed `held_seconds: 6` on `resource_class_released` events across MULTIPLE tagged tasks (`processCustomer`, `updateAllScoresForOwner` confirmed; pattern likely universal). See ADR 0023's 2026-05-24 (later) amendment for the full evidence table.
>
> **The bug:** The BullMQ Worker callback at `src/manage/taskQueue/queue/index.js:118-131` is `await processor.processJob(...)` then `await release()`. processor.processJob spawns `bash launchChildTask.sh ...` and resolves on `child.on('close')`. Empirically, that close event fires ~5-6 seconds after spawn EVEN WHEN the underlying task script (e.g., processCustomer.sh) is still running and will continue running for hours. As a result, the semaphore releases ~5-6s after acquire, and the actual heavy Neo4j work runs concurrently with any other heavy work — defeating ADR 0013's cap=1 serialization contract.
>
> **Investigation required:** what causes `child.on('close')` on the launchChildTask.sh bash process to fire within 5-6 seconds when the backgrounded child it spawned is still running? Candidate hypotheses (unverified):
> 1. `launchChildTask.sh:380-390`'s `while ps -p $child_pid` monitor loop exits prematurely — possibly the captured PID from `bash $child_script &` corresponds to a short-lived intermediate.
> 2. BullMQ stalled-job recovery (default 30s `stalledInterval` × `maxStalledCount`=1) fires and moves the job, triggering the `finally` block.
> 3. Bash subshell semantics with `&` + `set -e`/`set -o pipefail` cause the wrapper to exit unexpectedly.
> 4. Something else.
>
> **Method:** write a deterministic reproduction probe (similar in shape to story #25's `probe-bullmq-removeOnComplete-immediate.js`). Steps:
> 1. Create a synthetic tagged task whose script sleeps for N=120 seconds.
> 2. Wire it through the actual `initTaskQueue` machinery (real BullMQ Worker, real semaphore wrap, real processor.js → launchChildTask.sh path).
> 3. Trigger via `enqueueTask` or scheduler.
> 4. Observe and log: Worker callback entry time, semaphore acquire time, bash subprocess spawn time, every `ps -p $child_pid` check result in launchChildTask.sh, `child.on('close')` fire time, semaphore release time, bash subprocess actual end time.
> 5. Identify exactly which event fires at T+~5s that causes the close to fire while the work continues.
>
> **Once root cause identified, design the fix.** Possible fix shapes (architect chooses after the probe finishes):
> - **Fix launchChildTask.sh's PID tracking** so the monitor loop waits for the actual long-running process, not an intermediate.
> - **Fix the spawn pattern in processor.js** to use `child_process.spawn` with options that don't background-detach the subprocess.
> - **Refactor the semaphore wrap location** to be inside launchChildTask.sh itself (using Redis directly) so it covers the full subprocess lifetime regardless of Node-side timing.
> - **Refactor to a poll/lease model** where the Worker periodically checks if the bash subprocess is still running and re-acquires/renews the semaphore lease.
> - **Bigger refactor:** Option B from `/discuss` (refactor parents to enqueue children via /api/run-task) — children flow through their own BullMQ Workers, semaphore engages on each.
>
> **Impact on story #26:** That story's tag-additions are functionally moot pending this fix. They can be: (a) reverted, (b) kept as "no-op-but-documented" with the BIBLE.md / ADR amendments updated to reflect the actual broken state, or (c) carried forward into the investigation story and shipped together with the real fix. Architect/PO call.
>
> **Impact on PR #201's tagging:** Same. PR #201's value was always "defense-in-depth on the BullMQ-direct path" — that part still works (when a tagged task is fired via `/api/run-task` directly, the Worker callback wraps the few seconds of setup with the semaphore). But the "protect the subshell chain" intent is empty.
>
> **Classification:** Bug — high severity (load-bearing assumption violated, ADR 0013's documented contract not enforced, multiple shipped stories built on this assumption).
> **Strictness:** Standard.
> **Phase path:** `/discuss` first to align on the investigation scope, then Planning (probe + investigation story), then Architecture (fix design after probe results), then Test Design / Implementation / Review.
> **Priority:** **HIGH.** Architecture's stated contract has been functionally absent for the entire life of the resource-class semaphore (story #15, 2026-05-20 onward). Each new Neo4j-heavy task added since then has been relying on a protection that doesn't actually engage. Investigation deserves immediate attention.

## Options considered

### Option A — Minimal: tag only the two known gaps (rejected)

Add `resourceClass: neo4j-heavy` to `processAllTasks` and `processNpubsUpToMaxNumBlocks` in the registry. Skip the broader audit. Document the convention.

**Pros**
- Smallest diff (2 registry entries + doc updates).
- Closes the live operator-impacting gap.

**Cons**
- Violates story AC #3, which requires the audit. The story's framing ("every parent script in the codebase ... the audit confirms either (i) the parent is itself tagged, or (ii) the child is unreachable") is explicit about completeness.
- Hidden chains (subshell paths that don't surface from a casual reading) may still be unprotected. Operators reading PR #201 + ADR 0013 today don't know about the npub chain three layers deep; future hidden chains likely exist.
- "We'll come back to the audit later" rarely happens once the immediate bug is closed.

**Rejected.** Story explicitly asks for completeness.

### Option B — Comprehensive audit + tag (chosen)

Implementer runs a systematic audit across all four **subshell** spawn patterns + traces every multi-hop chain that ends in a tagged task. (Per the 2026-05-24 amendment above, JS-driven `child_process.exec` from API handlers is explicitly scoped out and filed as a separate intake — the Implementer's audit confirms subshell coverage, not API-handler coverage.) For each chain, ensures the entry-point task name is itself tagged. The audit results — the full list of parent scripts inspected, the chains identified, the tag-additions made — are recorded in the ADR 0013 in-place amendment. The chosen tag set is enumerated in this ADR's Implementation notes (Implementer expected to match it, with deviations reported back if the audit surfaces additional parents).

**Pros**
- Satisfies story AC #3 in full.
- Closes the live and latent gaps in one pass.
- Future maintainers reading the amended ADR 0013 + BIBLE.md §24 understand the protection model and the convention they must follow.

**Cons**
- Larger audit effort (~30–60 minutes of grep + chain-walking). Mitigated: the spawn-pattern grep recipes are spelled out in Implementation notes, so the audit is mechanical, not interpretive.
- More tasks tagged `neo4j-heavy` means more orchestrator-level work serializes through the cap=1 semaphore. This is **the correct, desired behavior** — the heavy work was always serializing, just sometimes opportunistically (parent semaphore happened to be held); after this story, serialization is deterministic. No throughput regression for already-protected paths; for the previously-unprotected paths, throughput goes from "race the cluster" to "serialize cleanly," which is the entire point of the fix.
- Registry diff is larger but it's pure data — no behavioral change for already-tagged paths.

### Option C — Programmatic enforcement (rejected, out of story scope)

Write a registry-walking validator that, at boot or in `npm test`, traverses every tagged task's potential invocation chains and fails / warns if a dormant chain is detected. Could live as a permanent test sentinel.

**Pros**
- Catches future regressions automatically. No one can add a tagged task with a dormant parent chain without CI complaining.

**Cons**
- Story Out-of-scope explicitly says: "Adding programmatic registry-walking validators that enforce the parent-tag convention at boot or in CI — could be a follow-up if drift becomes a recurring problem; not needed for this story."
- Builds an enforcement layer before we know whether drift will actually be a recurring problem. Premature.

**Rejected.** Honor story scope. Surface as a follow-up below.

### Option D — Revisit the "dormant child tag" question (NOT a separate option — addressed inline)

Story #26 left open whether to trim the dormant `resourceClass` tags from children whose only invocation path is from a tagged parent. **Decision: keep them.** The tags are not dormant on direct paths (`/api/run-task`, scheduled-as-entry) — they engage there. Trimming would create a *new* gap any time an operator scheduled a child task independently. Defense-in-depth wins on a clear cost-benefit basis: the cost of keeping the tags is zero (BullMQ ignores them on subshell paths anyway); the cost of removing them is a future incident when someone schedules a tagged child independently and expects protection.

## Decision

> ⚠️ **Premise undermined (2026-05-24 later amendment, above):** the chosen mechanism — registry-data tagging of parent tasks — is functionally moot in the current architecture. The semaphore is released ~5-6 seconds after acquire while the actual heavy work runs unprotected for hours. Story #26 is **paused**; a new investigation story (intake content embedded in the amendment) carries the root-cause work. Do NOT ship story #26 as-is.

**We chose Option B (comprehensive audit + tag) + keep dormant child tags.**

The Implementer runs the audit per the spawn-pattern grep recipes in Implementation notes, tags the parent tasks whose chains reach a tagged child but who are themselves not tagged, records the audit findings in an in-place amendment to ADR 0013 (same pattern as ADR 0022 amending ADR 0012), and updates BIBLE.md §24 with the protection-model convention. Child-task tags remain (defense-in-depth).

This satisfies all 6 story ACs:
- AC 1, 2: every tagged task — including those reachable only via subshell chains — is under semaphore protection whenever it runs.
- AC 3: the audit results are in the ADR amendment, with every chain explicitly accounted for.
- AC 4: ADR 0013 amended in-place.
- AC 5: BIBLE.md §24 documents the convention.
- AC 6: no-downtime deploy — pure registry data changes (no Redis migration, no schema change, no scheduled-task pause). In-flight jobs run under their pre-deploy options; new jobs from deploy onward inherit the new tags.

What we trade away: marginally more deterministic serialization across paths that were previously running concurrently (no measurable cost — they were neo4j-heavy and meant to serialize anyway). And ~30–60 minutes of mechanical audit effort during Implementation.

## Consequences

**Enabled**
- ADR 0013's stated contract ("neo4j-heavy cross-task serialization") holds for every invocation path, not just direct-BullMQ ones.
- Future developers adding new tagged tasks have a documented convention to follow + a clear audit method.
- The Implementer's audit findings (full chain enumeration) become institutional knowledge in ADR 0013 — readers don't need to re-derive them.

**Constrained / made harder**
- The implicit "tag children for defense" pattern from PR #201 is now formal: every child tag is intentional, but only load-bearing on direct invocation paths. Documented.
- Adding a new tagged task means also auditing its subshell-spawn parents. New convention to remember.
- The cap=1 semaphore now reliably serializes more paths than before. Throughput at the orchestrator level may feel slightly more sequential; this matches the original intent of ADR 0013 + is the desired behavior for neo4j-heavy work.

**Follow-up debt (out of scope here)**
- **JS-driven `child_process.exec` from legacy API handlers** (surfaced during the Implementer's audit on 2026-05-24). ~5 public API endpoints (`/api/process-all-active-customers`, `/api/generate-pagerank`, `/api/generate-reports`, `/api/generate-verified-followers`, `/api/calculate-hops`-ish) directly `exec` tagged-task scripts from Node, bypassing BullMQ + the semaphore entirely. Materially different mitigation from the subshell pattern this ADR addresses — needs its own Architect triage between refactor-to-enqueue / deprecate-the-endpoint / accept. Filed by the Implementer at commit time per the "Implementer copy-to-file at commit time" block in the 2026-05-24 amendment above.
- **Programmatic enforcement** (Option C). File as a follow-up intake if registry drift becomes a recurring problem. The audit script the Implementer writes for this story is half the work of such an enforcer.
- **Dual-registry entries for the same script** (e.g., `processNpubsUpToMaxNumBlocks` vs `npubManager` for `processNpubsUpToMaxNumBlocks.sh`) — this story tags the untagged variant so both paths engage. Whether to consolidate the duplicate registrations entirely is a separate hygiene question for a future story.
- **Option B from the `/discuss`** (refactor parents to invoke children via `/api/run-task`) — the cleaner long-term architecture. Worth revisiting when there's a forcing function (e.g., per-child concurrency tuning becomes operationally critical, or new tagged-task additions repeatedly break the convention).

**Firmware reinstall required?** No. No concept-graph changes.

## Implementation notes

The Implementer reads this section verbatim.

### Audit method (run first, before any registry changes)

Goal: enumerate every parent script whose subshell-spawn chain reaches a tagged child, and confirm the parent's task name is itself tagged.

1. **List tagged-task scripts.** From [`src/manage/taskQueue/taskRegistry.json`](src/manage/taskQueue/taskRegistry.json), extract the set of scripts referenced by tasks where `resourceClass === "neo4j-heavy"`. Expected: ~22 unique .sh files (26 task entries, some duplicates per dual-registration).
2. **Grep for callers, all four subshell spawn patterns** (JS-exec is explicitly out of scope per the 2026-05-24 amendment). For each tagged-task script S (basename, e.g. `updateNpubsInNeo4j.sh`):
   ```bash
   grep -rln -E "(launch_child_task[[:space:]]+[\"']${TASK_NAME}[\"']|bash[[:space:]]+[^[:space:]]*${S}|^[[:space:]]*[^[:space:]]*${S}[[:space:]]|node[[:space:]]+[^[:space:]]*${S%.sh}.js)" --include="*.sh" .
   ```
   Note: pattern 1 (`launch_child_task`) searches by *task name* (string arg). Patterns 2-4 search by *script basename*. Both surfaces matter — a child can be invoked by either.
3. **For each caller script C** identified in step 2:
   - Look up C in the registry. If C is itself a tagged task, the chain through C is protected — record and continue.
   - If C is not in the registry (e.g., `processNpubsOneBlock.sh`, an intermediate script not directly schedulable), recurse: find who calls C, and walk back to a registered task. The chain is protected iff some ancestor in the chain is a tagged registered task.
   - If C is in the registry but NOT tagged, **this is a gap**. Record: `(parent task name, child task name, spawn-pattern line)`. The parent needs tagging.
4. **Compile the audit summary** as a markdown table for the ADR 0013 amendment (Implementer's column layout: parent task | child task(s) reached | spawn pattern + file:line | gap status before fix | gap status after fix).

### Confirmed gaps (Architect's pre-audit) — Implementer contract

Pre-audit identified the following entries to tag. The Implementer's audit either *confirms this set is complete* or *extends it*. The contract distinguishes the two outcomes:

| Task name to tag | Why | Current registry shape |
|---|---|---|
| `processAllTasks` | top-level orchestrator; spawns ~10 tagged children via `launch_child_task` (e.g., `updateAllScoresForOwner`, `calculateOwnerHops`, `processNpubsUpToMaxNumBlocks`) — all dormant on this path | currently untagged; has parent=undefined |
| `processNpubsUpToMaxNumBlocks` | scheduled on prod (~6h cadence); spawns `processNpubsOneBlock.sh` (not a registered task) which directly-invokes `updateNpubsInNeo4j.sh` (tagged child) | currently untagged; has parent="processAllTasks" |

**Outcome contract:**

- **Audit confirms the pre-audit set is complete (no additional gaps):** Implementer proceeds to tag exactly the 2 listed entries. The ADR 0013 audit-results table must explicitly include a final row reading: **"No other parent scripts reach a tagged child via an unprotected subshell chain — audit performed 2026-MM-DD per ADR 0023 §Audit method, all four subshell spawn patterns checked. JS-driven `child_process.exec` from API handlers is explicitly out of scope per ADR 0023's 2026-05-24 amendment and is filed as a separate intake."** This sentence is not optional — it converts a silent omission into a positive assertion that future readers can rely on, and it precisely scopes what the audit covers vs. what's separately tracked.
- **Audit surfaces additional gaps:** Implementer **pauses before tagging** and reports the new findings back. Each new finding gets a row in the audit-results table (parent task | child task(s) reached | spawn-pattern + file:line). Then: if the new finding is a clean parallel to the known gaps (an untagged orchestrator with subshell-reachable tagged children, no architectural novelty), proceed to tag without re-opening this ADR. If the new finding involves a *new* spawn pattern not enumerated in §"Four spawn patterns to audit" above, or any other novelty (e.g., a tagged child reached via a non-bash mechanism like a cron entry or a JS-driven `exec()`), **stop and re-open ADR 0023** — the Architect needs to evaluate whether the protection model assumption still holds.
- **Audit cannot be completed (e.g., genuine ambiguity in a chain):** Implementer surfaces the ambiguity back, doesn't tag speculatively.

This tightens the round-trip so the Implementer knows exactly when to proceed alone vs. when to come back.

### Files to edit

1. **[`src/manage/taskQueue/taskRegistry.json`](src/manage/taskQueue/taskRegistry.json)** — add `"resourceClass": "neo4j-heavy"` to the task entries identified by the audit (at minimum: `processAllTasks` and `processNpubsUpToMaxNumBlocks`).

2. **[`engineering-team/decisions/0013-task-queue-neo4j-resource-class.md`](engineering-team/decisions/0013-task-queue-neo4j-resource-class.md)** — in-place amendment (same pattern as ADR 0022 amending ADR 0012). Add a new sub-section near the end of the Decision or Consequences area titled **"Protection model — entry-point tagging is load-bearing (amended 2026-05-24, ADR 0023)"** that:
   - Acknowledges the architectural property: the semaphore wrap lives in the BullMQ Worker callback, so subshell-invoked children's tags are dormant on parent-driven paths.
   - Documents the convention: every tagged task must have its entry-point in any invocation chain itself tagged — direct `/api/run-task` and scheduled-entry paths engage the tag natively; subshell-spawned children inherit protection only from a tagged ancestor.
   - Cross-references ADR 0023 (this ADR) and story #26.
   - Includes the audit-results table (the markdown table the Implementer compiles in Audit Method step 4).
   - Notes that child-task tags remain by design as defense-in-depth on the direct paths.

3. **[`BIBLE.md`](BIBLE.md) §24** — extend the task-queue section with a short paragraph documenting the parent-tag-is-load-bearing convention + a pointer to ADR 0023. Add ADR 0023 to the ADR index at the end of §24.

### Files NOT to edit

- `src/manage/taskQueue/launchChildTask.sh` — no change to the spawn mechanism (Option C from `/discuss` rejected).
- `src/manage/taskQueue/queue/index.js` — no change to the Worker callback or semaphore wrap (already correct per ADR 0013 + story #15).
- `src/manage/taskQueue/queue/resourceSemaphore.js` — no change to the semaphore primitive.
- Any parent shell script (`updateAllScoresForOwner.sh`, `processAllTasks.sh`, `processCustomer.sh`, etc.) — no behavior change; we're tagging task-name entries in the registry, not editing the scripts themselves.

### Test scenarios for the Tester (Phase 3)

- **Structural sentinels** (FAIL pre-impl, PASS post): the audit-identified tasks (at minimum `processAllTasks` and `processNpubsUpToMaxNumBlocks`) have `resourceClass: "neo4j-heavy"` in the registry; ADR 0013 contains the new "Protection model" sub-section + cross-reference to ADR 0023; BIBLE.md §24 contains the parent-tag convention text + ADR 0023 in the index; ADR 0013's audit-results table is present and non-empty (and contains the explicit "No other parent scripts reach a tagged child via an unprotected chain" sentence per the Implementer contract).
- **Behavioral via cycle-local smoke** (not unit-testable in this form): trigger `processAllTasks` or `processNpubsUpToMaxNumBlocks` via `/api/run-task`; observe in BullBoard that the `neo4j-heavy` semaphore is held for the duration (active=1, no other neo4j-heavy task progresses). Trigger a second `neo4j-heavy` task while the first is running; verify it waits inside `semaphore.acquire()` (the wait-event token `resource_class_wait_begin` lands in `events.jsonl`).
- **Suggested: behavioral probe inside the container** (one-shot, similar in shape to story #25's [`test/probe-bullmq-removeOnComplete-immediate.js`](test/probe-bullmq-removeOnComplete-immediate.js)). If the Tester has appetite, this bridges the structural-vs-cycle-local gap with a deterministic, repeatable check. Suggested probe shape:
  1. Spin up two synthetic per-task BullMQ Queues + Workers using `initTaskQueue`'s machinery (or its constituent parts) with two test task names — e.g., `__probe-heavy-A` and `__probe-heavy-B`, both with `resourceClass: "neo4j-heavy"` in an in-memory registry passed to `initTaskQueue`.
  2. Worker A's processor sleeps N seconds (e.g., 3s) then returns; Worker B's processor returns immediately. Both track invocation timestamps.
  3. `queue.add` job to A; immediately `queue.add` job to B.
  4. Assert: B's processor starts AFTER A's processor finishes (verified by comparing the timestamps; gap should be ≥ A's sleep duration). If they ran in parallel, the semaphore did not engage — fail with a message instructing the Tester to re-open ADR 0023.
  5. Cleanup: `obliterate({force:true})` both queues; close Workers + Redis.
  - Run via `docker exec tapestry node /usr/local/lib/node_modules/brainstorm/test/probe-resource-class-semaphore-serialization.js`. Not registered in `test/test.js` (one-shot, matches story #25's convention for empirical probes).
  - Headache estimate: ~30 min to write + run. Mostly mechanical — the harness shape is well-trodden after story #25's probe. Existing `test/task-queue-neo4j-resource-class.test.js` (15 tests, PASS) already covers the semaphore primitive itself; the probe's added value is an integration-level check that the BullMQ Worker construction wires the wrap correctly for tagged tasks. **Optional but recommended.**
- **Non-regression** (existing test suites): the `task-queue-neo4j-resource-class suite` (15 tests, currently PASS) and the `scheduled-tasks-with-arguments suite` (37 tests, currently PASS) should continue to PASS — none of their assertions cover the specific tasks being tagged, but the same registry file is being modified.

### Concept handle

None. No new concepts. No firmware reinstall.

### Deployment dry-run

Identical no-downtime profile to ADR 0022's:
- Pure registry change (`taskRegistry.json`). No Redis schema change, no migration code, no scheduler pause, no manual operator step.
- In-flight tasks at deploy time complete under whatever (already-acquired-or-not) semaphore state they had pre-deploy. New tasks from the deploy onward read the updated registry on `initTaskQueue` and acquire (or not) accordingly.
- Worst-case interaction: a `processAllTasks` or `processNpubsUpToMaxNumBlocks` invocation that was *running* at deploy time finishes under the old (untagged) options — i.e., didn't engage the semaphore. The very next invocation post-deploy engages correctly. Tolerable per story #26 "no manual cleanup of in-flight jobs" AC.

## Out of scope

- **Refactoring parent scripts to invoke children via `/api/run-task`** (Option B from `/discuss`) — substantial architectural change, deferred.
- **Implementing semaphore acquire in `launch_child_task` / bare-bash spawn paths** (Option C from `/discuss`) — deadlock risk + duplicate semaphore implementations.
- **Trimming dormant child-task tags** — explicitly kept as defense-in-depth (this ADR decides; story left open).
- **Programmatic enforcement** (registry-walking validator, CI-enforced) — out of story scope; file follow-up intake if drift becomes recurring.
- **Consolidating duplicate-script registry entries** (e.g., `processNpubsUpToMaxNumBlocks` and `npubManager` both → `processNpubsUpToMaxNumBlocks.sh`) — separate hygiene story.
- **Unified all-tasks timeline UI** (already-filed 2026-05-24 intake) — independent from this story.
- **All inherited Out-of-scope items from story #26.**
