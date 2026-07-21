# Decision Journal — relationship-primitives (Direction mode)

Append-only. Format per `engineering-team/roles/director.md` → "The decision journal".

## 2026-07-21T08:36:20Z — Run kickoff: Stage-0 preflight complete
**Story/Phase:** relationship-primitives / Stage 0 (preflight)
**Decision:** INFO
**Judge:** n/a
**Why:** Book armed by operator (commit `117e5313`, Armed 2026-07-21T08:09:50Z, Deadline 2026-07-23T08:09:50Z, Baseline `27004981`, pinned SHAs verified against history: director.md @ `bdbc8cf6`, direct-feature SKILL @ `1d9f9b86`, gate-judge @ `3a2657b2`). Arming diff touches only the arming subsection (1 file, 4 insertions/4 deletions). Contamination check clean: no stories, ADRs, epic file, or source for this epic exist at the baseline SHA. Working tree clean; `feat/relationship-primitives` created at `117e5313`. Overlap scan: four other 🔴 OPEN handoffs (communities-protocol delivery, b-tag ratification, harness-review meta items, profile-followers) — none touch `/api/normalize`, `src/middleware/auth.js`, or this book's lane; open books task-timeline (parked) and unified-tagging-ui do not overlap. Pre-arming refresh of the pre-registration was operator-ratified and merged before arming (PR #405).
**Baseline test record:** command `npm test` (no filters), exit code 0, summary line `Overall: PASS`. 38 suites; 37 PASS; **harness-lint suite internally FAIL (28 passed, 1 failed)** — the single failure is the pre-existing `L9 BIBLE.md` last-updated staleness violation, present in the SessionStart digest before arming and at the baseline SHA; unrelated to this book's subsystem and outside the Director's lane to fix. Total skipped: 41. Gate 4 will re-run the identical command and be held to: Overall PASS, and the harness-lint violation set unchanged (exactly the pre-existing L9 entry, nothing new). Decision to proceed (not halt) journaled on these grounds and surfaced to the operator in-session.
**Next:** Spawn `product-owner` for Planning (story #1) against the intake entry (2026-07-18, `_intake.md` ~L1659) + the acceptance frame.

## 2026-07-21T08:45:03Z — Gate 1 verdict VOID: judge self-reported blinding breach
**Story/Phase:** relationship-primitives #1 / Gate 1 (Story)
**Decision:** INFO (verdict void; protocol breach journaled)
**Judge:** APPROVE — void. The judge's spawn prompt correctly scoped book.md to the "### Acceptance frame" section only, but the judge disclosed it over-read into "## Direction mode — pre-registered", exposing the arming timestamp, deadline, hypothesis odds, and ceiling. Per the pinned protocol (director.md → "The blinded gate-judge protocol": "An APPROVE from a judge who reports broken blinding is void"), the APPROVE does not stand. Not a KICK_BACK — no kick-back counter increments. The judge's item findings (all rubric items pass) are disregarded for the gate decision; a fresh judge decides cold.
**Why:** The breach was judge-side over-read, not a prompt leak, but the protocol's void clause keys on the report of broken blinding, not on fault. Re-spawn prompt corrected with a mechanical read boundary (bounded extraction of the frame section; instruction that reading any other book.md section invalidates the verdict). This is a live instance of the open harness lesson on mechanical blinding boundaries for judge spawns (OPEN.md meta rows on judge-blinding rigor) — noted for the post-mortem retro.
**Next:** Re-spawn fresh `gate-judge` for Gate 1 with the bounded-read prompt.

## 2026-07-21T08:48:38Z — Gate 1 APPROVED (story #1)
**Story/Phase:** relationship-primitives #1 / Gate 1 (Story)
**Decision:** APPROVE
**Judge:** APPROVE, blinding intact (bounded-read prompt held). All rubric items pass: five externally testable ACs, one subsystem, no solutioning (frame's implementation cites correctly abstracted), all five concept handles verified resolving in the live graph, placement/numbering/Status lines correct on story and epic, bullet-for-bullet trace to all nine frame bullets, intake out-of-scope carried verbatim. One non-blocking note: the story's fixture-hygiene clause cites a "book ceiling clarification" outside the judge's read boundary — it only tightens the frame, not a trace defect.
**Why:** Judge APPROVE + my concurrence from an independent read: the story is a faithful, solution-free restatement of the frame; the six delegated design decisions are correctly left neutral in the ACs and will be resolved through the Architect's proposal (simplest-option rule) with resolutions journaled at Gate 2.
**Next:** Commit story + epic (`story: relationship-add-delete-primitives`), spawn `architect` for Phase 2.

## 2026-07-21T09:02:06Z — Gate 2 APPROVED (ADR 0001)
**Story/Phase:** relationship-primitives #1 / Gate 2 (ADR)
**Decision:** APPROVE
**Judge:** APPROVE, blinding intact (bounded sed extraction held). Judge independently verified the decision's two load-bearing claims against the working tree: `requireOwner` 401s sessionless callers and ignores `localTrusted` (settingsApi.js:47-50) — so the in-handler wipe-pattern gate is the only correct owner gate for the local-curl path; and `normalize/index.js` imports exec/assistantKeys/nostr-tools at top (:9-13) — motivating the dedicated module whose import boundary makes the no-strfry guarantee structurally testable. All spot-checked file:line citations accurate. Two harmless nits, non-blocking: ADR cites security-auth-exposure/0002's authenticated-non-owner residual as "(c)" (it is "(b)"), and the firmware-install require sits at index.js:3326 not :3325. Carry-forward: fix in-lane at a later phase if convenient (Director never edits the ADR).
**Why:** Judge APPROVE + my concurrence: three genuine options with honest tradeoffs; six delegated decisions resolved inside the frame under the simplest-option rule (two POST routes matching surface convention; whitelist = the two class-thread membership types via `relAlias`, no literals; any-existing-node-pair validation with labels echoed; four idempotent outcomes as HTTP 200 with a `result` discriminator; U/S/H test split honoring test-hermeticity-ci/0001 with the negative assertion made both structurally and behaviorally). Firmware install untouched; no reinstall; no new dependencies; nothing superseded. Delegated-decision resolutions are hereby journaled as the Planning-time answers the book requires.
**Next:** Commit ADR (`adr: 0001 strfry-free relationship primitives (story #1)`), spawn `tester` for Phase 3 (Test Design).

## 2026-07-21T09:33:34Z — Phase 3 delivered; staging-probe premise falsified by Tester (surfaced to operator)
**Story/Phase:** relationship-primitives #1 / Test Design (pre-Gate 3)
**Decision:** INFO
**Judge:** n/a (Gate-3 judge spawning)
**Why:** Tester delivered plan + 23 tests (U1–U11, S1–S4, H1–H8) registered in test/test.js — deliberately wired into the *live* `overallOk` chain, avoiding the known severed-terminator defect (OPEN.md #43). Verbatim `npm test` shows 22 feature-missing failures + H7 passing by design; all other suites at baseline. Tester's story edit verified by diff: only the two Linked-artifacts bookkeeping lines; ACs untouched — no Gate-1 re-judge required. **Material finding:** frame bullet 8(a)'s parenthetical premise is factually wrong — default-deny 401s unauthenticated mutations *before route matching*, so a host-side POST to a **nonexistent** route already answers 401 today (Tester verified). A 401 from staging therefore cannot distinguish a deployed route from a missing one; the pre-registered probe mechanism does not discriminate. The bullet's substantive requirement ("journaled proof the routes are deployed on staging, distinguishable from a missing route") stands; the *mechanism* needs an operator ruling — candidate: journaled `deploy-staging.yml` run of the merge SHA + a read-only staging response reporting its running commit, proving the deployed SHA contains the routes. Droplet SSH/docker-exec is outside the ceiling and not proposed. Choosing a different evidence mechanism is frame-interpretation, not the Director's call → surfaced to the operator in-session at this boundary; Stage 2 will not proceed past the probe step without the ruling. Gate 3 itself is unaffected (tests/plan are frame-consistent) and proceeds.
**Next:** Gate-3 judge (bounded-read prompt); on APPROVE commit `test: failing tests for relationship-add-delete-primitives (story #1)` (excluding the untracked product-team/ discovery brief — other flow's artifact).

## 2026-07-21T14:08:33Z — Gate 3 APPROVED (test plan + failing tests, story #1)
**Story/Phase:** relationship-primitives #1 / Gate 3 (Test Design)
**Decision:** APPROVE
**Judge:** APPROVE, blinding intact. Judge ran the full `npm test` itself (exit 1; `relationship-primitives: 1 passed, 22 failed, 0 skipped`; failures all feature-missing — deliberate guard converts MODULE_NOT_FOUND into an explicit not-implemented message; H-routes 404 live), verified every AC and the frame's eight-case floor map to named tests, verified the harness-lint failure is the pre-existing L9 BIBLE.md row by running the lint directly, and verified post-run fixture hygiene (0 test-prefixed nodes). H7's pre-implementation PASS accepted as a documented regression guard on ratified auth layering. Implementation-reaching probes are all pinned by ADR 0001 (response table, import-surface clause, injection boundary, row contract).
**Why:** Judge APPROVE + my concurrence; the Tester's registration into the live `overallOk` chain (avoiding the OPEN.md #43 severed terminator) was independently confirmed at test/test.js:912-914.
**Next:** Commit test artifacts; spawn `implementer` (story #1, Phase 4) and `product-owner` (story #2 Planning) in parallel.

## 2026-07-21T14:08:33Z — Operator ruling: deployment-evidence mechanism → fix-forward story #2 (probe route)
**Story/Phase:** relationship-primitives #2 / pre-Planning
**Decision:** ANSWER
**Judge:** n/a
**Why:** Surfaced question (journal 2026-07-21T09:33:34Z): frame bullet 8(a)'s 401-discrimination premise is falsified (default-deny answers before route matching; global CORS answers OPTIONS 204 on every path — both verified locally). Operator ruled in-session, from the presented options: add a **fix-forward story #2** — a minimal read-only GET route deployed alongside the primitives whose 200-vs-404 is itself "a response distinguishable from a missing route," satisfying 8(a) as written with no frame amendment (frame text unchanged; run not voided). Alternatives declined: ruling CI-pipeline evidence sufficient (interpretation risk at the blinded completion audit); amending the frame (voids the run per the pre-registration). Story count will be 2 of 3 — within the cap; stopping rule 4 untriggered.
**Next:** Spawn `product-owner` for story #2 Planning; story #2 runs all five phases and all judged gates per Direction-mode rule.

## 2026-07-21T14:14:13Z — Gate 1 APPROVED (story #2, read-only deployment probe)
**Story/Phase:** relationship-primitives #2 / Gate 1 (Story)
**Decision:** APPROVE
**Judge:** APPROVE, blinding intact (spawn prompt carried the falsification/ruling trace, which the story itself records — no external progress state leaked). All rubric items pass: five solution-neutral, externally testable ACs; one subsystem with the scope note fencing off health/monitoring growth; concepts vacuously satisfied (no graph access by contract); placement/numbering/Status correct; trace chain frame-8(a) → falsification → ruling → AC5 explicit in the artifact. Judge's one observation (epic roster missing story #2) was a stale read — the roster line exists in the working tree, verified by diff; resolved in the PO's favor.
**Why:** Judge APPROVE + my concurrence. Story #2 is the operator-ruled fix-forward capture, bounded to exactly the evidence job.
**Next:** Commit (`story: read-only-deployment-probe`). Architecture for #2 deliberately held until story #1 clears Gate 4, so the Architect designs against settled source rather than mid-edit state.
