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

Implementer runs a systematic audit across all four spawn patterns + traces every multi-hop chain that ends in a tagged task. For each chain, ensures the entry-point task name is itself tagged. The audit results — the full list of parent scripts inspected, the chains identified, the tag-additions made — are recorded in the ADR 0013 in-place amendment. The chosen tag set is enumerated in this ADR's Implementation notes (Implementer expected to match it, with deviations reported back if the audit surfaces additional parents).

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
- **Programmatic enforcement** (Option C). File as a follow-up intake if registry drift becomes a recurring problem. The audit script the Implementer writes for this story is half the work of such an enforcer.
- **Dual-registry entries for the same script** (e.g., `processNpubsUpToMaxNumBlocks` vs `npubManager` for `processNpubsUpToMaxNumBlocks.sh`) — this story tags the untagged variant so both paths engage. Whether to consolidate the duplicate registrations entirely is a separate hygiene question for a future story.
- **Option B from the `/discuss`** (refactor parents to invoke children via `/api/run-task`) — the cleaner long-term architecture. Worth revisiting when there's a forcing function (e.g., per-child concurrency tuning becomes operationally critical, or new tagged-task additions repeatedly break the convention).

**Firmware reinstall required?** No. No concept-graph changes.

## Implementation notes

The Implementer reads this section verbatim.

### Audit method (run first, before any registry changes)

Goal: enumerate every parent script whose subshell-spawn chain reaches a tagged child, and confirm the parent's task name is itself tagged.

1. **List tagged-task scripts.** From [`src/manage/taskQueue/taskRegistry.json`](src/manage/taskQueue/taskRegistry.json), extract the set of scripts referenced by tasks where `resourceClass === "neo4j-heavy"`. Expected: ~22 unique .sh files (26 task entries, some duplicates per dual-registration).
2. **Grep for callers, all four spawn patterns.** For each tagged-task script S (basename, e.g. `updateNpubsInNeo4j.sh`):
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

- **Audit confirms the pre-audit set is complete (no additional gaps):** Implementer proceeds to tag exactly the 2 listed entries. The ADR 0013 audit-results table must explicitly include a final row reading: **"No other parent scripts reach a tagged child via an unprotected chain — audit performed 2026-MM-DD per ADR 0023 §Audit method, all four spawn patterns checked."** This sentence is not optional — it converts a silent omission into a positive assertion that future readers can rely on.
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
