# Decision journal — add-a-concept-to-a-tapestry

Append-only. Every gate decision, answered question, judge verdict, and halt.
Mode: **operational Direction** (goal-derived terms). Staging is the ceiling.

---

## 2026-07-28T03:58:52Z — Eligibility resolved before any book file existed

**Story/Phase:** — / Stage 0 preflight (step 1)
**Decision:** INFO
**Judge:** n/a
**Why:** `GET /api/brain/direction/add-a-concept-to-a-tapestry`, run from inside the container (host-side brain reads answer 403), returned `eligible: true` — anchor `add-a-concept-to-a-tapestry` at **distance 0** (the goal is its own anchor, as owner policy v1 `maxAnchorDistance: 0` requires), ratified by proposal `proposed-add-a-concept-to-a-tapestry-56a594c4` approved `2026-07-28`. `boundaryReview.required: false` with zero steps, so **no boundary judging is owed** — the two-call verdict flow does not apply at distance 0. The operator's kickoff message pre-stated exactly this resolution; it was re-checked here rather than taken on report.
**Next:** Read the goal's prompt from the raw record, per the operator's instruction.

## 2026-07-28T03:59:30Z — Goal prompt read from the raw record; endpoint copy agrees

**Story/Phase:** — / Stage 0 preflight (step 1)
**Decision:** INFO
**Judge:** n/a
**Why:** The operator instructed reading the goal's `prompt` from the raw record because the goals read API drops the field (`parseGoalRow`). Done via `POST /api/neo4j/query`: the raw record carries `prompt` (`promptVersion: 1`) with the 2026-07-28 research — tapestries are relay-published and relay-read (Neo4j not in the path), kind-39999 replacement is native (same kind + author + d-tag), so editing is republishing with **no reindex step**; both publish paths (owner browser-sign, assistant `signAs`) and a concept picker already exist; the re-sign branch is decided by the Tapestry's author pubkey — data, not a design decision. The Direction endpoint on this deployment **also** returns `terms.prompt` (the `store-and-show-the-prompt-and-the-estimate` book shipped that), and the two copies agree. The evidence goal the prompt cites was read too: work record `worked-find-out-whether-saving-a-tapestry-again-actually-updates-it-cc07369c` answers "yes, cleanly" and corroborates every conclusion; its open question (the ~71 unread Neo4j tapestry rows) stays on that goal, not this book.
**Next:** Open the book eagerly; generate the derived section, never hand-author it.

## 2026-07-28T04:06:41Z — Book opened eagerly; derived section generated, not typed

**Story/Phase:** — / Stage 0 preflight (step 1)
**Decision:** INFO
**Judge:** n/a
**Why:** `book.md` was opened **before any story exists**, so the anchor gates the work while it happens. The `## Direction mode (operational) — goal-derived` section is **generated** per `roles/director.md`: a generator script read a fresh endpoint fetch (`derivedAt: 2026-07-28T04:06:02.932Z`) and emitted the section; the section was then extracted back out of the assembled file and diffed **byte-identical** against the generator's output, so no character of it was typed. The sole transform is redacting the pubkey inside the goal uuid to `<TA>` — verified first via `GET /api/assistant/pubkey` that it **is** the live assistant pubkey (house rule: never write a per-deployment pubkey into a shared file; precedent `audits/store-and-show-the-prompt-and-the-estimate/book.md`). The section states the `surrendered` block verbatim (baseline commit, pinned governing versions — each with the endpoint's own reason) and carries the `unavailable` block and the owner's `prompt` verbatim. Terms were identical across both of this session's fetches (03:58:52Z and 04:06:02Z) — no drift inside the session.
**Next:** Transcribe the operator's kickoff instructions, then complete preflight.

## 2026-07-28T04:07:30Z — Operator instructions at open: story cap 2, goal is read-only, splitting guidance

**Story/Phase:** — / Stage 0 preflight
**Decision:** ANSWER
**Judge:** n/a
**Why:** The operator's kickoff message set three run-governing instructions, transcribed into `book.md` § "Operator instructions at open" and recorded here as an ANSWER because they are operator-authored terms, not Director inferences: (1) **story cap for this book is 2** — halt *before* approving a story that would exceed it; operational mode derives no deadline and no story cap from the goal, so two of the six stopping rules cannot fire on their own, and this cap substitutes for them (the last book reached three stories and 34 hours with nothing to stop it); (2) **do not edit the goal** — any change to its `deliverable` or `boundary` halts the run with `anchor-stale` and costs a fresh approval, which has already happened once on an earlier run; (3) **splitting the goal is the most expensive known move** (~11 hours per story, measured) — context, not licence: a story genuinely spanning more than one subsystem must still be split, and said so; no under-splitting to save time. The operator also attested the preflight: branch `feat/add-a-concept-to-a-tapestry` fresh off staging at 0/0 with a clean tree, and the Stage-0 baseline **verified GREEN** — `npm test`, `Overall: PASS`, 81 suites, 1452 passing, 0 failures, 31 skipped (the known environmental family), ~32 minutes, completed at "23:44 on 2026-07-28" by the operator's clock (~14 minutes before this session's first eligibility call) — with the explicit instruction **not to redo it, but to confirm the rest**.
**Next:** Confirm the remaining preflight steps independently; journal the kickoff.

## 2026-07-28T04:08:00Z — Kickoff: preflight status, confirmed rather than taken

**Story/Phase:** `tapestries` / Stage 0 preflight
**Decision:** INFO
**Judge:** n/a
**Why:** Preflight state, honestly recorded. **Step 2 arming baseline — not applicable, and not silently skipped:** operational mode *knowingly surrenders* the pinned baseline commit and pinned governing versions, for the endpoint's own stated reason (reproducibility traded for operational cost; both retained in armed mode). The branch point (`origin/staging` `db7c5a7a`) is noted for cold resume only and is **not** a pinned baseline. **Contamination check passes, and not vacuously:** the `tapestries` epic exists (`**Status:** Done`) with shipped stories 3–4 belonging to the *closed* `tapestries` book — prior art, not contamination; nothing for **this** goal predates the run (no story or ADR about adding a concept to an existing Tapestry — `stories/tapestries/` holds only 3–4, `decisions/tapestries/` only 0003 create-authoring and 0004 detail-views; branch tip **equals** `origin/staging` at `db7c5a7a`, zero commits, no source changes). **Step 3:** working tree clean; fetched; no drift to rebase. **Step 4:** the two other open books (`task-timeline`, `unified-tagging-ui`) and the `🔴 OPEN` handoffs (communities protocol delivery, harness review, b-tag affiliation) were scanned — none touches the tapestries UI surface; no entanglement. **Step 5:** on `feat/add-a-concept-to-a-tapestry` (created in the operator's preflight). **Step 6:** baseline GREEN, **operator-attested** (previous entry) — command of record **`npm test`**, no filters; Gate 4 reruns exactly this, tee'd to a log, with the verdict read from the log's `Overall:` line and an explicitly echoed exit code — never the background notification's exit code (OPEN.md #103/#105) — and with skip-scrutiny on the suites the diff touches (#104/#106).
**Next:** Stage 1, Planning — spawn `product-owner` with the acceptance frame, the goal terms verbatim, and the prompt as context-not-terms.

## 2026-07-28T04:15:00Z — Planning returned: one story, epic reactivated

**Story/Phase:** `tapestries` #5 / Planning
**Decision:** INFO
**Judge:** n/a
**Why:** The Product Owner wrote `stories/tapestries/5-add-a-concept-to-a-tapestry.md` (Draft; 5 acceptance criteria, one subsystem — the tapestries UI surface) and reactivated `epics/tapestries.md` (Done → Active with a reopen note; story list corrected to the real Done paths including `stories/done/tapestries/` for #1–2; future list narrowed to what add-only leaves behind). **Recommended story count: 1** — grounded in the frame: every frame bullet is observable in one loop through one existing view, and the only visible seam ("affordance + gating" vs "publish + visibility") would split into a first story with no independent value and a second that cannot be demonstrated without the first. I spot-checked its accuracy claims rather than taking them: the epic's new `ADR tapestries/0002` reference is real (`decisions/done/tapestries/0002-exploration-page-as-authored-rendering.md`), and story numbering 5 is correct across `stories/tapestries/` + `stories/done/tapestries/`. **One honest note:** the role's report shows it read the book's Operator-instructions section despite my scoping instruction ("the operator's cap of 2 is headroom, not a target") — roles are not blinded, so this is no protocol breach, but it is the exposure I tried to avoid; recorded because the pattern matters. It cannot have inflated the decomposition: the recommendation (1) sits *below* the cap, and I never confirmed or denied any count preference to the role.
**Next:** Answer the one recorded reading, then Gate 1.

## 2026-07-28T04:16:15Z — Terms-mismatch check before Gate 1: PASS

**Story/Phase:** `tapestries` #5 / pre-Gate-1
**Decision:** INFO
**Judge:** n/a
**Why:** Re-asked the endpoint from inside the container: `eligible: true`, anchor distance 0, and the live `deliverable` and `boundary` byte-match the verbatim blocks in the book's derived section (compared programmatically, not by eye). No `anchor-stale`.
**Next:** Journal the ANSWER, spawn the Gate-1 judge.

## 2026-07-28T04:17:00Z — ANSWER to Planning: "my" = the instance owner; reading confirmed from the frame

**Story/Phase:** `tapestries` #5 / Planning
**Decision:** ANSWER
**Judge:** n/a
**Why:** The Product Owner recorded one reading for veto: that the frame's *"my own key or my assistant one"* means **the instance owner's key and the instance TA**, so non-owner sessions get no affordance anywhere. Confirmed under rule 1 (answer from the frame) — the words are quotable: the goal's prompt says *"let the **owner** add a concept to a Tapestry from the Tapestry view"*; the boundary's first person (*"**my** own key or **my** assistant one"*) is the goal's author, the owner; and *"a Tapestry published by someone else cannot be edited here and the option is not offered for it"* excludes every other author, which forecloses the alternative reading (any signed-in user editing tapestries under their own key — such a tapestry is "published by someone else" from this instance's view). Story #3's owner-gated authoring is corroborating precedent, not the ground. No delegation was needed and nothing was frame-changing, so no halt.
**Next:** Gate 1 — fresh blinded `gate-judge`.

## 2026-07-28T04:22:00Z — Gate 1: APPROVE

**Story/Phase:** `tapestries` #5 / Gate 1
**Decision:** APPROVE
**Judge:** **APPROVE**, blinding reported intact. All six rubric items pass with file:line findings: five externally testable criteria (the one soft adjective, "a clear error," judged non-blocking because the operative assertions — error shown, membership unchanged — are testable); exactly 5 criteria on one surface (AC-3's density accepted as one cohesive claim: "republish changes membership and nothing else"); no solutioning (the URL route and the prior-story publish-behavior description are user-visible facts, not implementation artifacts); concept handles in required form with `<TA>` left to runtime; filing/numbering continuous across `stories/tapestries/` + `stories/done/tapestries/`; full bidirectional frame coverage (every frame bullet lands in a criterion, every boundary exclusion lands in Out of scope). The judge independently verified the intake-absence claim against `_intake.md` (full heading scan + keyword greps) rather than taking my prompt's word.
**Why:** I concur on the merits — my own pre-gate read found the same shape (and my spot-checks of the epic edit's factual claims held). The story adds nothing to the owner's words; the one interpretive move ("my" = instance owner) is the ANSWER I gave from quotable frame text, surfaced in the story for exactly this veto. Approving and committing the Planning artifacts.
**Next:** Phase 2 — spawn the `architect` for ADR 0005 under `decisions/tapestries/`.

## 2026-07-28T04:33:30Z — Architecture returned; ANSWER ×2 on its recorded readings (one veto, one confirm)

**Story/Phase:** `tapestries` #5 / Architecture
**Decision:** ANSWER
**Judge:** n/a
**Why:** The Architect wrote `decisions/tapestries/0005-add-concept-add-only-republish.md` — a pure append transform (copy the event verbatim, append one member; same-coordinate republish), membership judged from the authored graph block, the #3 publish paths unchanged, post-save re-read. It rejected the goal-prompt's mechanism sketch (re-run the create builder with the existing suffix) on live evidence — the real tapestry's d-tag `b0b48b00` is underivable by the builder, and a rebuild would rewrite the `name` tag, drop authored integrations, and re-derive imports; the prompt is context-not-terms, so that is a legitimate design judgment, and a well-supported one. It flagged two readings for veto:

1. **VETOED — gate breadth.** Its chosen gate `hasAdminAccess(user)` admits `classification === 'admin'` as well as `'owner'` (verified: `ui/src/utils/auth.js:6–8`), so a non-owner admin viewing a TA-authored tapestry would be offered the affordance. The approved story decides this in quotable terms: AC-1 — *"or a viewer who is not the owner, then no add affordance is offered"* — and Out of scope — *"Editing by non-owner users."* The goal's prompt: *"let the **owner** add a concept."* Ruling: the acting user is the owner, strictly; adopt the ADR's own named alternative (the strict owner-classification gate). The consistency-with-#3 argument relitigates a product decision the story fixed at a gate that already passed; harmonizing "who curates" epic-wide would touch #3's shipped behavior and is separately-goaled work, not this story's.
2. **CONFIRMED — envelope creation on first add.** Creating the `{graphType:'tapestry', …}` envelope when the graph block is absent is inside *"adding only"*: the ask is unconditional (*"Put a concept into a Tapestry that did not have it before"* — the graph-less `b0b48b00` tapestry is exactly that), nothing is removed or altered, and the envelope is the minimal container for a member. Without it the instance's only real tapestry could never be grown and the deliverable would fail on the only real data.

Both answers carry product intent only; the mechanism for (1) is the Architect's own named alternative, selected, not designed. Continuing the **same** architect agent to revise (Decision 3, the Decision summary, the Implementation-notes gate expression), per the skill's continue-don't-restart rule.
**Next:** Revised ADR → terms-mismatch check → Gate 2 (fresh blinded judge).

## 2026-07-28T04:38:00Z — ADR revision verified; terms-mismatch check before Gate 2: PASS

**Story/Phase:** `tapestries` #5 / pre-Gate-2
**Decision:** INFO
**Judge:** n/a
**Why:** The same architect agent (continued, not restarted) applied both rulings; verified in the file rather than taken from its report: Decision 3's chosen gate is now `user?.classification === 'owner' && author ∈ {taPubkey, user.pubkey}` with the ruling cited, `hasAdminAccess` demoted to the named-and-rejected alternative with the cost recorded honestly (an admin who is not the owner can create per #3, shipped, but cannot add here), the Implementation-notes `canAdd` expression propagated owner-strict, and story #3's shipped gate pinned untouched under Out of scope. Everything else (append transform, membership source, signing-branch-as-data, UI composition, degraded handling, no firmware reinstall) unchanged. A timestamp correction to the 04:33:30Z entry above was made before commit: it was first stamped 04:40:00Z, ahead of the real clock — an editing error, fixed while still uncommitted. Terms-mismatch re-run at 04:37:28Z: `eligible: true`, distance 0, live deliverable and boundary byte-match the book's pins.
**Next:** Gate 2 — fresh blinded `gate-judge` over the ADR.

## 2026-07-28T04:45:00Z — Gate 2: APPROVE

**Story/Phase:** `tapestries` #5 / Gate 2
**Decision:** APPROVE
**Judge:** **APPROVE**, blinding reported intact. All seven rubric items pass, several with independent verification: the five ACs are quoted faithfully; four decisions each carry a real named alternative, and Option 1-B's four rejection grounds all verify in source (`tapestryDraft.mjs:42/:58–59/:60–65/:74`) **and against the live relay** — the judge itself confirmed the `b0b48b00` event (bare-hex d-tag, slug-valued name tag, no graph block) that makes the rebuild option concretely wrong; every spot-checked file:line reference is accurate; 0005 is the correct next number in template shape; the prior-ADR citations (0001/0002/0003/0004 all deferring editing) are verbatim-accurate with nothing superseded; no new dependencies or tooling; firmware reinstall explicitly ruled out with the correct reason. One disclosed exposure: while grepping for the frame heading, one preamble line of the book's intent anchor surfaced (operational-mode provenance, no progress/deadline/budget/stakes content — the same facts appear in the story and ADR) — the judge assessed blinding intact, and I concur; the fact it was disclosed rather than swallowed is what the protocol wants.
**Why:** I concur on the merits. I read the full ADR and the revision before the spawn; the design is add-only by construction, stays inside the boundary (no new page/endpoint, existing publish paths), and implements the story's AC-1 as ratified (owner-strict gate, revised on my ANSWER before the judge saw it). Committing the ADR.
**Next:** Phase 3 — spawn the `tester` for the test plan + failing tests.

## 2026-07-28T05:01:05Z — Test Design returned; failing runs reproduced by the Director; ANSWER on the Tester's pinned UI contract; terms check PASS

**Story/Phase:** `tapestries` #5 / Test Design
**Decision:** ANSWER
**Judge:** n/a
**Why:** The Tester wrote the plan (`stories/tapestries/5-add-a-concept-to-a-tapestry.test-plan.md`), a stack-free Node suite (`test/add-a-concept-to-a-tapestry.test.js`: P1–P13 pure-transform, S1–S6 sentinels, R1–R4 regression guards), a mocked Playwright spec (`tests/brainstorm/tapestry-add-concept.spec.js`: E1–E13), registered the suite in `test/test.js` (diff inspected: purely additive — require, banner, summary line, `overallOk` term, skip roll-up; nothing existing touched), and filled the story's Linked-artifacts ADR/test-plan lines. **I reran both suites myself rather than taking the claim:** Node isolated — 19 failed / 4 passed, every failure articulate and for the right reason (missing export / missing component / missing owner-strict gate; the S4 sentinel pins my Gate-2 ruling: `classification === 'owner'`, NOT `hasAdminAccess`); Playwright — 7 failed (E1, E6–E9, E11, E12) / 6 passed (13.0s), all failures `waiting for getByRole('textbox', { name: /add a concept/i })` — the affordance does not exist. Identical to the Tester's reported figures.

**ANSWER — no veto on the Tester-authored contract:** the affordance's stable selector (a textbox accessibly named per the ask's own words, matches as `Add <name>` buttons) is test mechanics in the owning phase's lane; "picking performs the save" is ADR 0005 Decision 4, already gate-approved; the phrase "add a concept" is the ask verbatim. Nothing widens or narrows the frame. The two items recorded as not-automated (double-submit busy-guard → Reviewer's manual sweep; live directory non-duplication → structural from P1 + the evidence goal's verified replacement) are accepted as documented, not waved through silently.

Terms-mismatch check at 05:01:05Z: `eligible: true`, distance 0, both pins byte-match.
**Next:** Gate 3 — fresh blinded `gate-judge` over plan + failing tests.

## 2026-07-28T05:20:00Z — Gate-3 judge running the full suite itself; awaiting its verdict

**Story/Phase:** `tapestries` #5 / Gate 3 (in progress)
**Decision:** INFO
**Judge:** pending — the judge reported (status note, not a verdict) that every other rubric item is checked and it is executing the full `npm test` itself to verify the failing-for-the-right-reason item on primary evidence. That is the rubric's "Run it yourself; don't take the claim," taken literally, at ~32 minutes of runtime.
**Why:** No follow-up was or will be sent to the judge — one spawn, one reply; its status note is its own output, and the verdict comes from the same spawn when its background run completes. A fallback wakeup is scheduled in case the notification chain stalls; on wake with no verdict, the resume path is this journal's tail.
**Next:** Judge verdict → on APPROVE + concurrence: commit `test: failing tests for add-a-concept-to-a-tapestry (story #5)`; on KICK_BACK: route to the Tester.

## 2026-07-28T05:53:00Z — Gate-3 judge spawn stalled without a verdict; re-spawning fresh

**Story/Phase:** `tapestries` #5 / Gate 3
**Decision:** INFO
**Judge:** none produced — the spawn is void by absence, not by any follow-up. The judge backgrounded its full `npm test` (~32 min) and ended its turn expecting re-invocation when the run finished; the harness reaped the task instead (verified: the task registry no longer knows the ID; a bounded tail of its transcript shows the status note as its final message; no test process is running). **No follow-up was sent** — one spawn, one reply, preserved. Per protocol, a spawn that produced no verdict is re-spawned fresh.
**Why:** Recording two facts so they are not lost. (1) The stalled judge's orphaned run log (`npm-test.log`, completed 05:42Z) shows exactly the expected pre-implementation state: `add-a-concept-to-a-tapestry suite: FAIL (4 passed, 19 failed)` is the **only** failing suite; `Overall: FAIL`; no other suite fails; 53 skipped (vs the baseline's 31 — consistent with stack-gated suites skipping under the judge's run environment; flagged for Gate-4 scrutiny, where skip-counts on relevant suites are checked against the baseline). This log is **context for me, not judge evidence** — the fresh judge verifies on primary evidence itself. (2) The re-spawn prompt adds one neutral harness-mechanics line — run commands in the foreground; a turn ended with background tasks running is never resumed — which carries no progress, budget, or artifact-quality signal and changes no rubric; without it, any judge that backgrounds a long verification will stall the same way.
**Next:** Fresh Gate-3 judge; fallback wakeup re-armed.

## 2026-07-28T06:20:00Z — Gate 3: APPROVE (re-spawned judge)

**Story/Phase:** `tapestries` #5 / Gate 3
**Decision:** APPROVE
**Judge:** **APPROVE**, blinding reported intact (incidental exposure limited to filenames in `git status`/`log`; no contents, no progress signal). All six rubric items pass, with the decisive one verified on primary evidence: the judge ran the **full `npm test` itself** — exit 1, `Overall: FAIL`, the new suite the only failing suite (4 passed / 19 failed), every failure an articulate feature-missing reason (module loads cleanly, export genuinely absent — not a typo or import error) — plus the isolated Node suite and the Playwright spec, reproducing the plan's numbers exactly. It independently confirmed the live `b0b48b00` event and the divergent concept-graph slug in the container relay. One unrelated flake in its full run (`relationship-primitives` H8, the known strfry scan-count bracket family) was characterized with its own anticipating failure message and does not bear on this gate. It accepted S1–S6 as source probes because every probed detail is pinned by the ADR, and it verified the two disclosed automation gaps are recorded for the Reviewer rather than dropped.
**Why:** I concur — my own isolated runs matched (19/4 and 7/6), the registration diff is purely additive, and the stalled first spawn's orphaned log independently showed the same full-suite state. Committing the Test Design artifacts; this commit is Gate 4's `git diff <Gate-3 commit>..HEAD -- test/` anchor.
**Next:** Phase 4 — spawn the `implementer`.
