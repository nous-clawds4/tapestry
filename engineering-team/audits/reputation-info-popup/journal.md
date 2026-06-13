# Decision Journal — reputation-info-popup

Append-only. Every gate decision, answered question, judge verdict, and halt. Direction-mode run under `/direct-feature` + `engineering-team/roles/director.md`. Goalposts pinned at `3a2657b2` (director.md · direct-feature SKILL.md · gate-judge.md).

---

## 2026-06-13T23:11:08Z — Kickoff: Stage-0 preflight passed
**Story/Phase:** reputation-info-popup / Stage 0
**Decision:** INFO
**Judge:** n/a
**Why:** Book armed on `origin/staging` (arming commit `3a167ab8`, diff touches only the Arming subsection): Armed `2026-06-13T23:01:56Z`, Deadline `2026-06-16T23:01:56Z` (not passed), Baseline `19c542f972f35a39ca9b38735ca5ef1e94e656a2`, `Status: Open`. Working tree clean; local `staging` == `origin/staging` (0/0 drift). Baseline contamination check: no stories, ADRs, or source for the `reputation-info-popup` epic exist at baseline (only the book + intake pre-registration). Baseline `npm test` GREEN — exact command `npm test` (Gate 4 reruns it identically). Branch `feat/reputation-info-popup` created off `origin/staging`.
**Next:** Stage 1, Planning — spawn `product-owner` against the intake entry + acceptance frame.

## 2026-06-13T23:11:08Z — Stage-0 overlap scan: proceed (handoff dormant, no in-flight epic)
**Story/Phase:** reputation-info-popup / Stage 0 (overlap check, skill step 4)
**Decision:** INFO
**Judge:** n/a
**Why:** Skill step 4 requires scanning for 🔴 OPEN handoffs and in-flight epics touching the same files; overlap → halt. Findings: three OPEN handoffs — `B_TAG_AFFILIATION_DESIGN_HANDOFF.md` and `COMMUNITIES_PROTOCOL_DESIGN_HANDOFF.md` are protocol-design docs that do not reference `BrainstormProfile.jsx`; `PROFILE_FOLLOWERS_HANDOFF_2026-06-06.md` (🔴 OPEN) does concern `BrainstormProfile.jsx`. Assessment: that handoff is a **dormant backlog catalog, not in-flight work** — the `profile` epic (stories #29–36) is fully **Done**, none of the handoff's items have an associated story or branch, the working tree is clean with 0/0 drift, and the repo convention defines 🔴 OPEN as "not picked up." Its live items (#4 a duplicate `TRUST_METRICS` row; #6 PoV for the follows/followers *tables*) are disjoint from this run's change region (the Reputation section heading + a new popup). The overlap-halt precondition (an active workstream to entangle with) is therefore not met. The operator was shown this finding in detail at preflight and responded "Direct the feature." Decision: proceed. Safeguard against a mid-run pickup: re-check `origin/staging` drift at every phase boundary (Stopping rule 6 halts if it moves under us).
**Next:** Stage 1, Planning — spawn `product-owner`.

## 2026-06-13T23:18:02Z — Planning pre-Gate-1: routing a verified factual defect back to the PO
**Story/Phase:** reputation-info-popup #1 / Planning (pre-Gate-1)
**Decision:** ANSWER (defect routed to owning role)
**Judge:** n/a (not yet spawned — correcting the artifact before the blinded gate)
**Why:** The PO produced `epics/reputation-info-popup.md` + `stories/reputation-info-popup/1-reputation-section-pov-explainer-popup.md`. The story is otherwise gate-shaped (testable ACs, no solutioning, scoped, Status lines), but its "Concepts touched" section asserts "Concept Graph API unreachable at Planning time." I verified the house-rule authoritative source directly: `GET http://localhost:7778/api/concept-graph/summaries` → 200; TA pubkey `e00ed09…`; 34 concepts present including `graperank` and `web-of-trust` but NO "point of view"/"House"/"Personalized" concept. So the unreachability claim is FALSE (the conclusion "no PoV handle to cite" is nonetheless correct — those terms aren't modeled as concepts). The false caveat isn't itself a Gate-1 rubric item, but it's a durable, inaccurate house-rule-compliance statement the Architect would inherit, so I won't concur with it. Role boundary: the story/epic live outside `audits/<book-slug>/`, so I may not edit them — the PO must. SendMessage (continue-same-agent) is unavailable in this harness, so I re-spawn a fresh PO with the existing files + the corrected fact (API reachable at :7778); scope unchanged. This is artifact-accuracy correction, not gate-gaming, and is the harness self-correcting before the independent judge.
**Next:** Re-spawn `product-owner` to redo Concept-Graph orientation and correct the caveat; then spawn the Gate-1 `gate-judge` on the corrected artifact.

## 2026-06-13T23:24:11Z — Gate 1 (Story) — APPROVE
**Story/Phase:** reputation-info-popup #1 / Gate 1 (Planning)
**Decision:** APPROVE
**Judge:** APPROVE, blinding intact (fresh `gate-judge`, one spawn/one reply). All six Gate-1 rubric items pass: ACs externally testable; one subsystem; no solutioning; ⚙ concepts cited by handle (`web-of-trust`, `graperank`) — judge independently verified both resolve live and that no `point-of-view`/`house`/`personalized`/`reputation` node exists; correct path/numbering/Status + epic file present; traces to the acceptance frame and reproduces the intake out-of-scope list.
**Why:** Judge applied the rubric item-by-item with file:line evidence and gathered its own Concept-Graph evidence (didn't trust quoted claims) — a real audit, not a rubber stamp. I concur: the corrected story is accurate, the ACs map 1:1 to the frame bullets, and the PO's earlier false caveat is fixed. Soft spot noted by the judge (6 ACs vs the "~5" guideline) is a regression-guard within one frontend subsystem — no split warranted. Deadline `2026-06-16T23:01:56Z` not passed; origin/staging drift 0 (still `3a167ab8`).
**Next:** Stage 1, Architecture — spawn `architect`; Gate 2 judged.

## 2026-06-13T23:32:31Z — Gate 2 (ADR) — APPROVE
**Story/Phase:** reputation-info-popup #1 / Gate 2 (Architecture)
**Decision:** APPROVE
**Judge:** APPROVE, blinding intact (fresh `gate-judge`). All seven Gate-2 rubric items pass, verified against primary sources: ACs quoted verbatim; three real options (chosen A = new sibling `ReputationInfo.jsx`; named alt B = generalize to `InfoPopover`; C = variant prop) with tradeoffs; specific files/pattern/function named; ADR at `decisions/reputation-info-popup/0034-…` (next global number, template-conformant); ⚙ Concept-Graph orientation done first (judge re-verified the 34-node graph, the `web-of-trust`/`graperank` descriptions, and the absence of PoV nodes); consistent with profile/0032 (clones, doesn't touch) and pov-resolution/0033 §27 (House/Personalized only for Reputation grid, not the Owner-PoV counts), supersedes none; no new deps/tooling; firmware N/A.
**Why:** Judge gathered its own live evidence rather than trusting the ADR's claims — a real audit. I concur: ADR 0034 is specific, options-rich, honors the regression boundary and the §27 naming boundary. The ⓘ-placement nuance the ADR surfaces (snug vs right-aligned, one-line CSS) is an implementation decision governed by the "consistent with the Verified control" AC — it is a design detail, not product intent, so not mine to dictate; the Implementer resolves it, Tester/Reviewer check consistency. Deadline `2026-06-16T23:01:56Z` not passed; origin/staging drift 0 (`3a167ab8`).
**Decision (convention):** ADR written as `Status: Proposed`; every ratified ADR in the repo is `Status: Accepted` and Gate 2 has accepted this one. Correct end-state is `Accepted`. The ADR is outside my edit lane (`audits/<book-slug>/` only), so I route a surgical one-line status flip to the `architect` (no substantive change → no re-judge needed) before committing the ADR in its accepted state.
**Next:** Spawn `architect` to flip ADR 0034 Status → Accepted; then commit `adr: …` + journal; then Stage 1 Test Design.

## 2026-06-13T23:43:13Z — Gate 3 (Test plan + failing tests) — APPROVE
**Story/Phase:** reputation-info-popup #1 / Gate 3 (Test Design)
**Decision:** APPROVE
**Judge:** APPROVE, blinding intact (fresh `gate-judge`). All six Gate-3 rubric items pass; the judge ran `npm test` itself: T1–T9 fail because `ui/src/components/ReputationInfo.jsx` is genuinely absent (test module loads clean — not a typo/import error), all 33 pre-existing suites PASS, and the seven regression sentinels (R1–R7) pass against real current source.
**Why:** I also ran `npm test` (didn't trust the claim) and confirmed the new suite fails for the right reason (feature-missing) with the AC6 regression boundary intact. Test plan at the correct path, every AC maps to ≥1 test, source-sentinel idiom (no new framework), copy sentinels anchor on required tokens not a verbatim string. Deadline `2026-06-16T23:01:56Z` not passed; origin/staging drift 0 (`3a167ab8`).
**Next:** Commit `test: failing tests …`; then resolve the Director-owned popup copy (below) and spawn `implementer`.

## 2026-06-13T23:43:13Z — Director-delegated decision: the popup's verbatim copy
**Story/Phase:** reputation-info-popup #1 / Implementation input (book-delegated)
**Decision:** ANSWER (the one open design decision the book delegates to the Director)
**Judge:** n/a
**Why:** The book delegates the popup's exact user-facing wording to the Director, to be the simplest copy that satisfies the frame's accuracy constraints (WoT point of view; either House (default) or Personalized depending on selection, general; bounded to the Reputation scores; no claim about the Following / Verified Followers / Verified Reporters counts). Finalized now, at the point of consumption (Implementation). Chosen copy, to be rendered verbatim by the Implementer:
- **Title:** `Where do these scores come from?`
- **Body:** `These reputation scores reflect a Web of Trust — a point of view on who is trustworthy. The numbers show either the House point of view (this Tapestry instance's default) or your Personalized point of view, depending on which is currently selected.`
This conveys all required content, stays general (does not name the active PoV), names none of the top-of-page counts, and satisfies the Tester's T6/T7/T8 token sentinels. It is product copy (book-delegated) — not code/design — so providing it to the Implementer is within role bounds.
**Next:** Commit Gate 3; spawn `implementer` with this copy.

## 2026-06-13T23:47:42Z — Gate 4 (Implementation) — PASS (mechanical, no judge)
**Story/Phase:** reputation-info-popup #1 / Gate 4 (Implementation)
**Decision:** APPROVE (mechanical)
**Judge:** n/a — Gate 4 is mechanical; the Director verifies.
**Why:** I ran all four mechanical checks myself. (A) `git diff d9de4aea -- test/` is empty — no test weakened. (B) Identical Stage-0 command `npm test` → `Overall: PASS`: the new `reputation-info-popup` suite is 16/16 (T1–T9 now pass, R1–R7 still pass) and every pre-existing suite still passes. (C) No concept-definition/firmware files touched → no firmware reinstall. (D) Implementer reports it was NOT forced outside the ADR (placement was an ADR-authorized bounded choice). I also confirmed `ReputationInfo.jsx` renders the Director-owned copy verbatim and clones the `bsp-info-btn`/`bsp-confirm-overlay`/`bsp-confirm-box`/`bsp-confirm-ok` pattern, prop-free/hook-free, leaving the Reputation data path and `VerificationInfo` untouched.
**Implementer choices noted:** (1) Placement — chose the zero-CSS right-aligned ⓘ (left `.bsp-info-btn { margin-left:auto }` in effect), the ADR-authorized default, rationale = matches the Verified ⓘ's existing right-aligned behavior; visual consistency with the frame's "consistent with the Verified control" bullet will be confirmed at Stage-2 local smoke / Tier-4 evidence and is the Reviewer's to audit. (2) The Implementer added a `## Deviations` section to the story (not in `templates/story.md`) recording that placement call. Accepted: additive, transparent, no change to ACs/scope; a net-positive audit note. Included in the impl commit. Deadline `2026-06-16T23:01:56Z` not passed; origin/staging drift 0 (`3a167ab8`).
**Next:** Stage 1, Review — spawn `reviewer` (fresh context); Gate 5 judged.




