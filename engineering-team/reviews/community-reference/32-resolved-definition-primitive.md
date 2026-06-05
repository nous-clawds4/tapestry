# Review: Story 32 — Resolved Definition primitive (read-side of the `b` tag)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-06
**Diff:** `git diff origin/staging` (commits `2407a8ac` story, `6efda988` adr, `db6a1219` impl)
**Story:** `engineering-team/stories/community-reference/32-resolved-definition-primitive.md`
**ADR:** `engineering-team/decisions/community-reference/0028-resolved-definition.md` (Accepted)
**Test plan:** none — Test Design skipped (story resolved-Q2, docs-only). Verified by claim-accuracy/consistency audit + the test gate, per the story #20 / #31 precedent.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **24/26 suites PASS**, independently re-run. **This change introduces zero regressions.** Two suites fail (`manual-task-retrigger-after-finish` 6/4, `task-queue-semaphore-protection-audit` 3/3) — **pre-existing and unrelated** (see Findings → Non-blocking #1; independently confirmed below). Every suite that could be affected by a BIBLE change is green.
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped._
- [x] **Diff scope:** `BIBLE.md` (the substantive change) + the ADR 0028 and story #32 artifacts. **No source/test/firmware files touched.** No new lint/typecheck/build tooling.

## Spec adherence (story acceptance criteria)

All 5 ACs satisfied:

- [x] **AC1 — general read-side primitive.** §26 opens "the read-side of the `b` tag… It is **general** — Alice's resolved definition of `dogs` vs Bob's… not community-specific" (BIBLE:1709–1711).
- [x] **AC2 — resolution rule.** §26 states the three-step rule (own-stated-fields-win → first-listed-`b`-wins → visited-set bounds cycles), with pseudocode, and "the closure is **not guaranteed acyclic**" (BIBLE:1713–1733). Always terminates / always yields an answer — stated.
- [x] **AC3 — fills 0027's deferred order + defines the general `effectiveX`; §25 updated.** §26 "What it settles" (BIBLE:1737); §25 multi-parent note now "resolution order is **defined in §26**" (BIBLE:1677); §25's `effectiveCD` mention now "the general **Resolved Definition** primitive — see §26; … `effectiveCD` is a named instance" (BIBLE:1687).
- [x] **AC4 — ADR records the decision.** ADR 0028 records the closure-merge + override→first-listed→visited-set rule; first-listed-wins flagged "good-enough heuristic"; WoT-weighted resolution recorded as the rejected alternative (Option B).
- [x] **AC5 — no test regression / no new tooling.** Confirmed: zero regression (below); BIBLE-only; no tooling.

## ADR adherence (fidelity to ADR 0028)

- [x] **The three specified BIBLE edits are all present and match** ADR 0028 §Implementation notes: (1) new **§26** + TOC entry (anchor `#26-resolved-definition`) + cross-links to §25/§22; (2) §25 multi-parent note → §26; (3) §25 `effectiveCD` → named instance of §26.
- [x] Pseudocode present (matches ADR 0028's). **Set-valued override** noted as still-deferred per ADR 0027 (BIBLE:1739). **WoT-weighted** resolution noted as out-of-scope/rejected (BIBLE:1741, "would make a node's own definition vary by observer").
- [x] §26 attributes itself to ADR 0028 and the §25 lineage to ADR 0027 — no silent contradiction; it completes 0027's deferral as the ADR states.

## Internal consistency / accuracy audit

- [x] **§26 is consistent with §25 (the write side).** §25 describes the `b` write tag + a single-parent resolution sketch; §26 is the general/canonical read-side, and §25 now points to it for resolution order. No conflict; the pseudocode generalizes §25's `effective(node)` sketch to multi-parent.
- [x] **Cross-references resolve.** TOC `#26-resolved-definition` (BIBLE:39) matches heading `## 26. Resolved Definition` (BIBLE:1709). §25↔§26 pointers are bidirectional and correct. The §22 grapevine-resolution link is accurate (it selects among resolved definitions).
- [x] **Story #31's previously-dangling `effectiveCD` forward-reference now resolves** — it points to §26 (a real, present section). That non-blocking follow-up from the #31 review is **closed** by this change.
- [x] Pseudocode matches the prose rule (cycle guard, listed-order parents, own-fields overlay). Accurate.

## Concept-graph integrity
- [x] **N/A — no concepts, handles, or schemas changed.** Documentation of a protocol primitive; no firmware concept definitions edited, no graph nodes created.
- [x] **Firmware reinstall:** **not required** (ADR 0028 §Consequences correctly states "No — documentation only"). A future resolver-*implementation* story re-evaluates.
- [x] Concept Graph API was unreachable all session; grounding in the BIBLE is correct here (the deliverable *is* BIBLE prose, the subject a new primitive) — the precedent set by ADR 0027 this session and the standing direction. Not a defect.

## Things tests can't catch
- [x] No secrets, no debug logging, no commented-out code (prose-only diff).
- [x] No scope creep: `db6a1219` touches **only** `BIBLE.md`; the ADR/story are the harness artifacts. Set-valued override and the Communities consumer layer are correctly left out of scope.
- [x] No silent AC drop; no behavior added beyond the story.

## House rules check
- [x] Concept Graph API authority respected (down → grounded in BIBLE, appropriate for a BIBLE-prose deliverable).
- [x] No new lint/typecheck/build tooling.

## Findings

### Blocking
_None._

### Non-blocking
1. **Test gate red due to a PRE-EXISTING, unrelated breakage (not this story).** `test/task-queue-semaphore-protection-audit.test.js:47` reads `engineering-team/decisions/0013-task-queue-neo4j-resource-class.md` (and the manual-retrigger suite reads ADR 0012 similarly) — **flat paths the #236 epic-folder reorg moved** into `decisions/task-queue-scheduler/`. Independently confirmed: `git cat-file -e origin/staging:engineering-team/decisions/0013-…` → **absent** — so the suites fail on the clean `staging` base itself, with or without this change. This BIBLE-only diff touches none of it; **zero regression**. A fix is already spawned (`task_00e94771`: update the test paths + audit `test/` for other stale flat-path refs). This is **not** a CHANGES_REQUESTED reason for story #32, but the team should land that fix to un-break staging's gate.
2. *(Context, not a defect)* The branch-convention divergence surfaced during planning (Avi's `feat/communities` and Vinney's `feat/pubkey-tagging-target` haven't adopted the epic-folder scheme) is captured in `docs/COMMUNITIES_PROTOCOL_DESIGN_HANDOFF.md` §7 for the three-branch reconciliation. Noted so it isn't lost.

## Verdict
**PASS** — the diff matches the story (5/5 ACs), conforms to ADR 0028 (all three edits, decision + rejected alternative recorded), is internally consistent and accurate against §25/§22, every cross-reference resolves (and story #31's dangling `effectiveCD` reference is now closed). Documentation-only; no source/test/firmware. The two failing suites are an **independently-confirmed pre-existing `staging` breakage** from the #236 reorg, demonstrably not caused by this change (separately tracked in `task_00e94771`); 24/24 unaffected suites pass.
