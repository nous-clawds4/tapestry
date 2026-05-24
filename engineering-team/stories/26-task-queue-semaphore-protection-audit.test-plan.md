# Test Plan: Story 26 — Close `neo4j-heavy` semaphore coverage gaps for subshell-invoked task chains

**Story:** `engineering-team/stories/26-task-queue-semaphore-protection-audit.md`
**ADR:** `engineering-team/decisions/0023-task-queue-semaphore-protection-audit.md`
**Date:** 2026-05-24

## Approach

This story is a registry-data fix (tag two more parent tasks) plus an ADR + BIBLE.md amendment. Following the project's task-queue test convention established by story #13's `test/task-queue-bullmq.test.js` and reinforced by story #25's `test/manual-task-retrigger-after-finish.test.js`, the plan splits into three tiers:

1. **Structural sentinels** (6 tests, in `test/task-queue-semaphore-protection-audit.test.js`) — pin the registry-tag additions + ADR 0013 in-place amendment shape + BIBLE.md §24 changes. Run on the host via `npm test`; no Redis/BullMQ required.
2. **Optional Implementer-side behavioral probe** — ADR 0023 §"Test scenarios for the Tester" suggests an integration-level probe at `test/probe-resource-class-semaphore-serialization.js` (~30 min, patterned after story #25's `probe-bullmq-removeOnComplete-immediate.js`). The ADR's framing is **"Optional but recommended"** — this test plan does NOT require it via sentinel, respecting the ADR's discretion. If the Implementer writes it, the sentinel suite implicitly benefits (extra integration-level evidence); if they skip it, the structural sentinels + cycle-local smoke provide sufficient coverage.
3. **Cycle-local smoke** (AC #1, AC #2 behavioral, AC #6) — exercised at `cycle-staging` and `cycle-prod` deploy time. Trigger one of the newly-tagged orchestrators via `/api/run-task`; observe in BullBoard that the `neo4j-heavy` semaphore is held (active=1) for the duration of the orchestrator's subshell chain. Trigger a second neo4j-heavy task while the first is running; verify it waits inside `semaphore.acquire()` (look for `resource_class_wait_begin` events in `events.jsonl`).

This split matches story #25's pattern. The story's AC #1 (every tagged task reachable from a BullMQ-invoked entry point under semaphore protection) is not unit-testable in its full form — it's a property that depends on the audit completeness + the tag set. The sentinels structurally pin the audit's outputs (T1, T2 for the known gaps; T4, T5 for the audit attestation requirement); the cycle-local smoke verifies the engagement.

## Coverage map

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| **AC #1** every tagged task under semaphore from any path | (no direct sentinel — AC #2's tag additions + AC #3's audit attestation collectively imply AC #1) | (implicit via T1, T2, T4, T5) | implication |
| **AC #1** (behavioral confirmation) | cycle-local smoke: trigger a tagged orchestrator via `/api/run-task`; observe semaphore-active in BullBoard for the duration of the run including subshell-children | cycle-local | manual |
| **AC #2** processAllTasks gap closed | T1: `taskRegistry.json tags processAllTasks with resourceClass "neo4j-heavy"` | `test/task-queue-semaphore-protection-audit.test.js` | structural sentinel |
| **AC #2** processNpubsUpToMaxNumBlocks gap closed | T2: `taskRegistry.json tags processNpubsUpToMaxNumBlocks with resourceClass "neo4j-heavy"` | `test/task-queue-semaphore-protection-audit.test.js` | structural sentinel |
| **AC #2** (behavioral confirmation, both tasks) | cycle-local smoke as above | cycle-local | manual |
| **AC #3** audit recorded in ADR amendment | T4 (audit-results table present) + T5 (positive attestation sentence per Outcome contract) | `test/task-queue-semaphore-protection-audit.test.js` | structural sentinel |
| **AC #4** ADR 0013 amended in place with Protection-model section | T3 (Protection-model sub-section + cross-ref to ADR 0023) + T4 (audit-results table) + T5 (attestation) | `test/task-queue-semaphore-protection-audit.test.js` | structural sentinel |
| **AC #5** BIBLE.md §24 documents convention | T6 (parent-tag convention text + ADR 0023 in §24 ADR index) | `test/task-queue-semaphore-protection-audit.test.js` | structural sentinel |
| **AC #6** no-downtime deploy | cycle-staging then cycle-prod runs; ADR 0023 §"Deployment dry-run" walks the expected moment-by-moment | cycle-local smoke | manual |

## Edge cases

Beyond the AC-driven sentinels above, the following edges are worth surfacing — most are deliberately deferred to cycle-local smoke or to the optional probe:

- [ ] **Audit-surfaced additional gaps beyond the two pre-audit set.** If the Implementer's audit surfaces gaps not listed in ADR 0023 §"Confirmed gaps", T1 + T2 still pass (those two are known); T5's attestation should reflect the extended scope (table will have >2 rows; the attestation phrasing covers "all four spawn patterns checked" regardless of how many parents needed tagging). If the audit triggers a re-open of ADR 0023 per the Outcome contract (new spawn pattern surfaces), the test plan's coverage may need updating — flag back to the Tester.
- [ ] **Children tag preservation.** ADR 0023 explicitly decided to KEEP dormant child tags as defense-in-depth (the tag engages on direct `/api/run-task` or scheduled-as-entry paths). This isn't covered by a sentinel — removing tags wouldn't fail any of T1-T6, but it would violate ADR 0023's Decision. Reviewer's responsibility to catch unintended tag removals.
- [ ] **Dual-registered scripts.** `processNpubsUpToMaxNumBlocks.sh` is registered under both `processNpubsUpToMaxNumBlocks` (untagged → T2 tags) and `npubManager` (already tagged). After T2 lands, both registry entries pointing to the script engage the semaphore. T1/T2 don't assert this consistency directly — that's the audit's job (recorded in T4's table).
- [ ] **Concurrency under the new tags.** Tagging two more parents means more deterministic serialization through the cap=1 semaphore. Per ADR 0023 §"Constrained / made harder", this is the desired behavior. Behavioral observation at cycle-local smoke confirms the serialization works; the sentinels don't observe it directly.
- [ ] **Behavioral probe (optional Implementer enhancement).** If the Implementer writes `test/probe-resource-class-semaphore-serialization.js` per ADR 0023's suggestion, it provides integration-level coverage that bridges the structural-vs-cycle-local gap. The Tester does not require it via sentinel; if it's written, it's a bonus signal.

## Test infrastructure

- **Test framework:** Node built-in runner via `npm test` (entry: `test/test.js`). No new dependencies.
- **Concept Graph API:** not used. Story #26 has no concept-graph impact (confirmed by story + ADR 0023; ADR 0013's prior baseline).
- **Firmware state:** no precondition.
- **Fixtures:** none.
- **Local-vs-container split:**
  - All 6 sentinels in `test/task-queue-semaphore-protection-audit.test.js` are pure file-read + regex; run on the host with no runtime dependencies.
  - The optional probe (if the Implementer writes it) requires `bullmq` + a reachable Redis. Both exist inside the `tapestry` container; run via `docker exec tapestry node /usr/local/lib/node_modules/brainstorm/test/probe-resource-class-semaphore-serialization.js`.

## How to run

```
npm test
```

For the optional behavioral probe (if the Implementer writes it):
```
docker exec tapestry node /usr/local/lib/node_modules/brainstorm/test/probe-resource-class-semaphore-serialization.js
```

For AC #6 (cycle-staging then cycle-prod): use the `cycle-staging` skill, then on user approval, `cycle-prod`.

## Verification

The 6 sentinels were committed against the pre-implementation tree on 2026-05-24. Expected pre-impl state: 0 PASS, 6 FAIL (none of T1-T6 can pass before the registry / ADR / BIBLE.md changes ship).

Confirmed on 2026-05-24 at commit `0a9ed023` (post-ADR, pre-implementation):

```
task-queue-semaphore-protection-audit suite:
  ✗ T1: taskRegistry.json tags `processAllTasks` with resourceClass "neo4j-heavy" (AC #2; ADR 0023 §Confirmed gaps)
      `processAllTasks` must be tagged `resourceClass: "neo4j-heavy"` so its BullMQ Worker holds the semaphore for the duration of its run (including the ~10 tagged children it spawns via `launch_child_task`, all of which are dormant on this path otherwise). Currently: resourceClass=undefined. (AC #2; ADR 0023 §Confirmed gaps)
  ✗ T2: taskRegistry.json tags `processNpubsUpToMaxNumBlocks` with resourceClass "neo4j-heavy" (AC #2; ADR 0023 §Confirmed gaps)
      `processNpubsUpToMaxNumBlocks` must be tagged `resourceClass: "neo4j-heavy"`. This is the live-on-prod scheduled entry whose subshell chain reaches the tagged `updateNpubsInNeo4j` child; without the tag, that chain runs unprotected. Currently: resourceClass=undefined. (AC #2; ADR 0023 §Confirmed gaps + §Context)
  ✗ T3: ADR 0013 contains a "Protection model" sub-section documenting the subshell-children-inherit-from-tagged-parent convention + cross-reference to ADR 0023 (AC #4; ADR 0023 §Implementation 2)
      ADR 0013 must contain a "Protection model" sub-section (heading or labeled paragraph) per ADR 0023 §Implementation 2. The section should explain that subshell-invoked children's `resourceClass` tags are dormant on parent-driven paths, and that every tagged task's invocation chain must therefore have a tagged entry point. (AC #4)
  ✗ T4: ADR 0013 contains an audit-results table with the columns ADR 0023 specifies (parent | child | spawn pattern | gap before/after) (AC #3, AC #4; ADR 0023 §Audit method step 4)
      ADR 0013 must contain a markdown table whose header row references "parent", "child", and "spawn" (any column ordering). This is the audit-results table per ADR 0023 §Audit method step 4 — the Implementer compiles it from the audit walk over all four spawn patterns and embeds it in the in-place amendment. The Reviewer needs this to confirm the audit was actually performed. (AC #3, AC #4)
  ✗ T5: ADR 0013's audit-results section includes an explicit attestation sentence per ADR 0023's Implementer outcome contract (AC #3; ADR 0023 §Outcome contract)
      ADR 0013's audit-results section must include a positive attestation that the audit was performed and that all four spawn patterns (launch_child_task, bash $script, direct executable, node $script) were checked. Per ADR 0023 §Outcome contract this attestation is "not optional — it converts a silent omission into a positive assertion that future readers can rely on." Acceptable phrasings include: "audit performed <DATE> per ADR 0023 §Audit method, all four spawn patterns checked" or "all four spawn patterns checked, no additional gaps". (AC #3; ADR 0023 §Outcome contract)
  ✗ T6: BIBLE.md §24 documents the parent-tag-is-load-bearing convention and includes ADR 0023 in the §24 ADR index (AC #5; ADR 0023 §Implementation 3)
      BIBLE.md §24's ADR index must include ADR 0023 so readers landing on the task-queue narrative can follow the protection-model amendment trail. (AC #5; ADR 0023 §Implementation 3)

Result: 0 passed, 6 failed
```

All 6 failures fail for the right reason — they reference the absent registry tags (T1, T2), the un-amended ADR 0013 text (T3, T4, T5), and the un-amended BIBLE.md §24 (T6). The Implementer's success criterion is: all 6 PASS after the audit + tag + amendments land.
