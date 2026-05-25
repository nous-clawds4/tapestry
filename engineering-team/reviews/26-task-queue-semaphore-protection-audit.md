# Review: Story 26 — Close `neo4j-heavy` semaphore coverage gaps for subshell-invoked task chains

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-24
**Diff:** `git diff origin/staging...HEAD` (commit `fe86b311`)
**Branch:** `fix/launch-child-task-protection-audit`
**Story:** [`engineering-team/stories/26-task-queue-semaphore-protection-audit.md`](../stories/26-task-queue-semaphore-protection-audit.md)
**ADR:** [`engineering-team/decisions/0023-task-queue-semaphore-protection-audit.md`](../decisions/0023-task-queue-semaphore-protection-audit.md) (includes 2026-05-24 amendment)
**Test plan:** [`engineering-team/stories/26-task-queue-semaphore-protection-audit.test-plan.md`](../stories/26-task-queue-semaphore-protection-audit.test-plan.md)

## Quality gates (run independently by reviewer, not trusted)

- [x] `npm test` — **PASS** (22 suites, 228 individual tests; `task-queue-semaphore-protection-audit suite: PASS (6 passed, 0 failed)`; Overall: PASS).
- [x] **Independent re-audit of subshell callers** (Reviewer's own grep across all 4 spawn patterns + task-name + script-name lookups) — confirms no protection-gap parent is missing from the Implementer's audit table. Two flagged scripts (`neo4jStabilityMonitor.sh`, `taskExecutor.sh`) turned out to be false positives in my grep (matched a log string + TODO comments respectively, no actual subshell spawns). Two others (`processFollowsMutesReports.sh` at owner and customer paths) are real subshell-spawners of tagged grandchildren but the great-grandparent chain (`updateAllScoresForOwner` / `updateAllScoresForSingleCustomer`) is already tagged — protection holds via great-grandparent. See Non-blocking #2 below.
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped._

## Spec adherence (story #26's 6 acceptance criteria)

| AC | Coverage | Verified |
|---|---|---|
| **AC #1** every tagged task under semaphore from any path (subshell scope) | Implication: T1 + T2 (the two known gaps closed) + T5 (audit attestation that no others found) | ✅ |
| **AC #1** (behavioral confirmation) | cycle-local smoke: trigger a newly-tagged orchestrator via `/api/run-task`, observe semaphore-active in BullBoard | deferred per test plan |
| **AC #2** `processAllTasks` + `processNpubsUpToMaxNumBlocks` gaps closed | T1 + T2 PASS; registry diff at [`src/manage/taskQueue/taskRegistry.json:92,463`](../../src/manage/taskQueue/taskRegistry.json:92) shows `"resourceClass": "neo4j-heavy"` added to both | ✅ |
| **AC #3** audit recorded in ADR amendment | T4 (table present) + T5 (attestation sentence present); audit table at [`engineering-team/decisions/0013-task-queue-neo4j-resource-class.md:138`](../decisions/0013-task-queue-neo4j-resource-class.md:138) covers 6 parent scripts with parent / child / spawn pattern / before / after columns | ✅ |
| **AC #4** ADR 0013 amended in place | Protection-model section + audit table + ADR 0023 cross-reference all present; T3-T5 PASS | ✅ |
| **AC #5** BIBLE.md §24 documents convention | T6 PASS; BIBLE.md gains the convention paragraph at §24 + ADR 0023 in the §24 ADR index | ✅ |
| **AC #6** no-downtime deploy | Pure data + doc change (no Redis migration, no schema change). Implementer confirmed brainstorm restarts cleanly inside the container. Cycle-staging will confirm the deploy profile end-to-end. | ✅ structurally; cycle-local pending |

- [x] Every acceptance criterion has a passing test or documented behavioral verification.
- [x] No criterion silently dropped.
- [x] No behavior added that isn't in the story.

## ADR adherence (ADR 0023 + 2026-05-24 amendment)

- [x] **Files changed match ADR 0023 §"Implementation notes"** + amendment scope. Two registry entries gain `resourceClass: "neo4j-heavy"`, ADR 0013 amended in place, BIBLE.md §24 updated.
- [x] **Outcome contract honored.** Implementer correctly invoked the "stop and re-open" branch when the audit surfaced a 5th spawn pattern (JS-driven `child_process.exec` from API handlers) — exactly the example the contract called out. Halted implementation, surfaced finding, Architect amended ADR 0023 in place (commit `53cf5d47`) to scope the JS-exec pattern OUT, Implementer resumed cleanly.
- [x] **Attestation sentence present and accurate.** [`ADR 0013:148`](../decisions/0013-task-queue-neo4j-resource-class.md:148) reads: "No other parent scripts reach a tagged child via an unprotected subshell chain — audit performed 2026-05-25 per ADR 0023 §Audit method, all four subshell spawn patterns checked. JS-driven `child_process.exec` from API handlers is explicitly out of scope per ADR 0023's 2026-05-24 amendment and is filed as a separate intake." Matches the amended template.
- [x] **JS-exec intake filed verbatim** per ADR 0023's "Implementer copy-to-file at commit time" instruction. Appended to [`engineering-team/stories/_intake.md:363`](../stories/_intake.md:363) with the full handler-to-tagged-task mapping table + three remediation options + classification/priority.
- [x] **Dormant child tags retained** per ADR 0023's Option D decision (kept as defense-in-depth on direct paths). Diff confirms no `resourceClass` was removed from any task.
- [x] **Probe skipped with defensible rationale.** ADR 0023 framed the probe as "Optional but recommended" (not required). Implementer's reasoning (data-only change; existing `task-queue-neo4j-resource-class.test.js` 15-test suite covers the semaphore primitive + Worker wrap) is sound. Unlike story #25's probe (which tested a load-bearing empirical claim), this story has no analogous empirical question.
- [x] **No new dependencies, no new infrastructure.** No `package.json` change; no new env vars; no new config files.

## Concept-graph integrity

- [x] **No concept handles touched.** Story #26 + ADR 0023 + ADR 0013 all confirm task-queue / resource-class subsystem has no concept-graph footprint. **Firmware reinstall: not required.**

## Things tests can't catch

- [x] **No secrets in committed files.** Diff scan clean — only data + docs + tests.
- [x] **No leftover debug logging.** None added.
- [x] **No commented-out code.** None.
- [x] **Error paths.** Registry-loading code is unchanged. New `resourceClass` field on the two entries goes through the same code path the other 26 tagged entries use; no new failure mode.
- [x] **Concurrency.** The semaphore primitive itself is unchanged (`src/manage/taskQueue/queue/index.js:118-131`, `resourceSemaphore.js`). The change only flips two more Worker callbacks to take the wrapped path — same wrap, same Lua, same Redis key. Tested behavior identical to the existing 26 tagged tasks.
- [x] **Security.** No new endpoints, no new input validation surface, no auth changes.
- [x] **Deploy hazards.** Pure registry data change; in-flight jobs at deploy time finish under whatever Worker construction they were started with (no retroactive rewriting of the wrap). The next post-deploy run of a newly-tagged task acquires the semaphore correctly. Matches ADR 0023 §"Deployment dry-run".

## House rules check

- [x] **Concept Graph API authority respected.** No graph reads/writes (correctly — none needed).
- [x] **No new lint/typecheck/build tooling.** Zero infrastructure added.
- [x] **JS-without-build preserved.** Diff is pure JSON + Markdown.

## Process integrity (this story specifically)

The Implementer-halted / Architect-re-entered / Implementer-resumed flow worked exactly as ADR 0023's Outcome contract designed. Worth recording as positive precedent:

- The Tester's pre-impl sentinels survived the ADR amendment without modification (T5's regex uses `.*` and matched both the original and amended attestation templates) — good Tester-side design.
- The Architect's in-place amendment (rather than a superseding ADR 0024) was the right call given ADR 0023 hadn't merged yet — clean history, single source of truth.
- The Implementer's decision to skip the optional probe was defensible and documented in the commit message — no silent omission.
- The JS-exec intake was filed verbatim per the ADR's `copy-to-file at commit time` instruction — no rephrasing drift between the ADR's pre-authored content and the filed intake.

## Findings

### Blocking

_None._

### Non-blocking

1. **[`engineering-team/decisions/0013-task-queue-neo4j-resource-class.md:135,148`](../decisions/0013-task-queue-neo4j-resource-class.md:135)** — ADR 0013 amendment says "audit performed 2026-05-25" but the session and all other dates throughout the story / ADR / commits are 2026-05-24. Off-by-one. Implementer likely typed the wrong day. Optional fix: change `2026-05-25` → `2026-05-24` in both the section header parenthetical (line 135) and the attestation sentence (line 148). Non-blocking because the audit IS performed within the session and the precise date matters less than the attestation existing.

2. **Audit-results table multi-hop completeness.** [`engineering-team/decisions/0013-task-queue-neo4j-resource-class.md:138`](../decisions/0013-task-queue-neo4j-resource-class.md:138) enumerates 6 parents at one-hop depth, but skips deeper chains. For example, `updateAllScoresForOwner.sh` → spawns `processFollowsMutesReports.sh` (which is `processOwnerFollowsMutesReports`, tagged) → which then spawns `calculateVerifiedFollowerCounts.sh` (tagged) at line 75. The protection chain holds (great-grandparent semaphore is held throughout), but a future reader auditing the table won't see the multi-hop intermediaries enumerated. Optional fix: extend the table with the 2-3 multi-hop chains the Reviewer's re-audit surfaced. Non-blocking because protection is mathematically transitive (parent tagged + child runs in parent's process tree → grandchildren in same tree → all under the held semaphore) and the existing rows + attestation cover the audit attestation that AC #3 requires.

3. **Probe was skipped.** Documented in commit message; aligned with ADR 0023's "Optional but recommended" framing. Non-blocking, but worth recording that a behavioral integration check at staging-or-prod time (i.e., the cycle-local smoke checking BullBoard's active count when one of the newly-tagged orchestrators runs) becomes more important without the probe. The cycle-staging smoke should specifically observe one of the new tags engaging.

## Verdict

**PASS.**

Implementation matches ADR 0023 + its 2026-05-24 amendment exactly. The audit closed both pre-identified subshell-pattern gaps (`processAllTasks`, `processNpubsUpToMaxNumBlocks`); the Reviewer's independent re-audit confirmed no other parent script reaches a tagged child via an unprotected chain. The 5th-pattern (JS-driven `child_process.exec` from API handlers) finding was correctly halted-on and routed back through Architecture per the ADR's Outcome contract — the resulting amendment + new intake demonstrate the harness's halt-and-resume mechanism working as designed. ADR 0013 amended in place with the Protection-model section + audit-results table + attestation sentence; BIBLE.md §24 carries the convention paragraph + ADR 0023 in the index. All 6 new sentinels pass; no regressions across the other 21 suites (228 individual tests total).

Three non-blocking observations recorded above (date typo, audit-table multi-hop completeness, probe-skip with cycle-local follow-on). None affect correctness, deploy safety, or operator-facing behavior.

Ready for the standard deploy chain: `cycle-staging` first, then `cycle-prod` on user approval. AC #1 (full-path semaphore engagement) and AC #6 (no-downtime deploy) get their final behavioral verification during those cycles per the test plan.

---

## ⚠️ 2026-05-24 (later) — PASS verdict withdrawn

Between this review's writing and the planned cycle-staging, the operator surfaced a discrepancy in the staging Scheduled Tasks panel that triggered deeper investigation. Pulling `resource_class_*` events from `events.jsonl` revealed that for `processCustomer` and `updateAllScoresForOwner` (both already-tagged in PR #201), the `neo4j-heavy` semaphore is released ~5-6 seconds after acquire while the actual bash subprocess runs for tens of minutes to hours unprotected. See ADR 0023's "2026-05-24 amendment (later) — chosen mechanism is functionally moot" section for the full evidence table.

The verdict above (**PASS**) was technically accurate to its declared scope (ADR adherence + AC list as written + test gate). It is **materially misleading** because the underlying mechanism that ADR 0023 chose (registry-data tagging of parent tasks to extend semaphore protection across subshell chains) does not work in the current architecture — the semaphore is released long before the work it's meant to protect finishes.

**Verdict withdrawn.** This review is preserved in the audit trail as evidence of what we believed at the time and how the discovery flowed; it should **not** be cited as approval to ship story #26 as-is. A new investigation story (intake content embedded in ADR 0023's later amendment, also appended to `engineering-team/stories/_intake.md`) takes over the work. Story #26's branch (`fix/launch-child-task-protection-audit`) is held unmerged pending the investigation's outcome.
