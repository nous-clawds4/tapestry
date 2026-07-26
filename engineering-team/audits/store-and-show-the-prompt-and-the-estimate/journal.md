# Decision journal — store-and-show-the-prompt-and-the-estimate

Append-only. Every gate decision, answered question, judge verdict, and halt.
Mode: **operational Direction** (goal-derived terms). Staging is the ceiling.

---

## 2026-07-26T16:50:48Z — Eligibility resolved before any book file existed

**Story/Phase:** — / Stage 0 preflight (step 1)
**Decision:** INFO
**Judge:** n/a
**Why:** `GET /api/brain/direction/store-and-show-the-prompt-and-the-estimate`, run from inside the container (host-side brain reads answer 403), returned `eligible: true` — anchor `store-and-show-the-prompt-and-the-estimate` at **distance 0** (the goal is its own anchor, as owner policy v1 `maxAnchorDistance: 0` requires), ratified by proposal `proposed-store-and-show-the-prompt-and-the-estimate-08e8c4c8` approved `2026-07-26`. `boundaryReview.required: false` with zero steps, so **no boundary judging is owed** — the two-call verdict flow does not apply at distance 0.
**Next:** Generate the book's derived section from this response; never hand-author it.

## 2026-07-26T16:55:00Z — Book opened eagerly; derived section generated, not typed

**Story/Phase:** — / Stage 0 preflight (step 1)
**Decision:** INFO
**Judge:** n/a
**Why:** `book.md` was opened **before any story exists**, so the anchor gates the work while it happens — the precise failure OPEN.md #110 filed against the previous book, which was opened only after its work reached production. The `## Direction mode (operational) — goal-derived` section is **generated** per `roles/director.md` line 40: a generator reads the live endpoint JSON and emits the section; the section was then diffed back out of the assembled file and is **byte-identical** to the generator's output, so no character of it was typed. It states the `surrendered` block verbatim — **baseline commit** and **pinned governing versions**, each carrying the endpoint's own reason — rather than dropping them quietly, and carries the `unavailable` block. The sole transform is redacting the TA pubkey inside the goal uuid to `<TA>` (house rule: never write a per-deployment TA pubkey into a shared file; precedent `audits/operational-direction/book.md:13`).
**Next:** Complete the remaining preflight steps.

## 2026-07-26T17:01:30Z — HALT: concurrent session detected on the same branch

**Story/Phase:** — / Stage 0 preflight (step 3–4)
**Decision:** HALT
**Judge:** n/a
**Why:** Stopping rule 6 (external interference). A second session was **actively mid-`/close-book`** on the unrelated `operational-direction` book: it rewrote `audit.md` (12:59:29 EDT), `book.md` (12:59:42, flipping `Status: Open → Closed`) and `epics/operational-direction.md` (13:00:31) — all *after* this session committed a snapshot of those same files at ~12:58, and with no git hook behind it. Directing a run on a branch another session is writing is exactly the entanglement step 4 forbids, so I stopped rather than working around it. I deliberately did **not** `git reset` my commit: another mutation on a branch a live session was mid-write on would compound the collision, not undo it. Nothing was lost — that session's newer content stayed in the working tree.
**Next:** Surface to the operator; resume only once the other session is verifiably finished.

## 2026-07-26T17:28:00Z — Interference cleared; verified, not assumed

**Story/Phase:** — / Stage 0 preflight (step 3–4)
**Decision:** INFO
**Judge:** n/a
**Why:** The operator reported the other session finished; I verified rather than taking it. Evidence: no repo write since 13:00:31 EDT (~28 min quiet); that session committed its own flip (`bfdef9cc`); its PR #471 merged to `staging` (deploy run `30212236080`, success) and PR #472 promoted `staging → main` (deploy run `30212340164`, success, 17:19:46Z); `book.md` reads `**Status:** Closed` and the epic `**Status:** Done` on **both** `origin/staging` and `origin/main`; working tree clean; no related open PRs. The `operational-direction` book is closed and shipped — it is a *different* book from this one and shares no files with it.
**Next:** Re-verify terms, branch, baseline.

## 2026-07-26T17:29:00Z — Terms-mismatch check: PASS (no anchor-stale)

**Story/Phase:** — / Stage 0 preflight (step 1)
**Decision:** INFO
**Judge:** n/a
**Why:** Re-asked the endpoint and compared the goal's **live** `deliverable` and `boundary` against the verbatim blocks recorded in the book's derived section: both match exactly, and `eligible` is still `true` at distance 0 under the same proposal. The goal has not been edited since derivation, so there is no `anchor-stale` condition. Per the role file this check re-runs at every preflight **and before every gate decision** — it is the operational analogue of armed mode's pinned governing hashes.
**Next:** Baseline suite.

## 2026-07-26T17:30:54Z — Kickoff: preflight status, and what this mode surrenders

**Story/Phase:** `goal-intent-fields` / Stage 0 preflight
**Decision:** INFO
**Judge:** n/a
**Why:** Preflight state, honestly recorded. **Step 2 arming baseline — not applicable, and not silently skipped:** operational mode *knowingly surrenders* the pinned baseline commit and the pinned governing versions (`roles/director.md`, the skill, `gate-judge.md`), for the reason the endpoint itself gives — reproducibility traded for operational cost, retained in armed mode. The branch point (`origin/staging` `e75d738b`) is noted for cold resume only and is **not** a pinned baseline; scoring may not treat it as one. **Contamination check passes vacuously and verifiably:** epic `goal-intent-fields` does not yet exist — no stories, ADRs, or source changes for it predate this run. **Step 3:** working tree clean, branch `feat/store-and-show-the-prompt-and-the-estimate` created off `origin/staging` `e75d738b`, no drift to rebase. **Step 4:** five `🔴 OPEN` handoffs and two other open books (`task-timeline`, `unified-tagging-ui`) scanned — **none** references `brain/goals`, `api/brain`, `parseGoalRow`, `tapestryOwnerGoal`, `chanceOfSuccess`, or `normalize/index`; no overlap, nothing to entangle. **Step 6:** baseline `npm test` running, tee'd to a log with an explicit `BASELINE_EXIT=$?` — per OPEN.md #103/#105 the background notification's exit code is **not** evidence and will not be used; the log's `Overall:` line and that echoed code are.
**Next:** Read the baseline verdict from the log; green → Planning (spawn `product-owner`), red → halt.

## 2026-07-26T18:02:30Z — HALT: Stage-0 baseline is RED

**Story/Phase:** `goal-intent-fields` / Stage 0 preflight (step 6)
**Decision:** HALT
**Judge:** n/a
**Why:** Step 6 requires a green baseline before any new work and says a red one is "not yours to fix silently." `BASELINE_EXIT=1`, `Overall: FAIL` — **four** failures across four suites. I characterized them rather than reporting a bare count, and verified both classes by isolated re-run instead of trusting the ledger:

- **Deterministic, pre-existing (2)** — `structures-the-brain-can-trust` **H4** and `break-a-goal-into-pieces` **H1**, both failing on `required must stay exactly [name, slug, description] … got ["name","slug","description","chanceOfSuccess"]`. Isolated re-run reproduces exactly (23/1 and 29/1, identical to the full run). This is **OPEN.md #102**, which assigns the fix *to this very goal by name*.
- **Non-deterministic, environmental (2)** — `relationship-primitives` **H8** and `relationship-primitives-probe` **H4**, both strfry event-count brackets (`scan count went 6013581 -> 6013582`). The tests' own message anticipates a concurrent publisher; on isolated re-run both are **fully green (23/0 and 9/0)**. Not a regression — a shared-stack race, and further evidence for OPEN.md #104/#106 on H-class non-determinism.

**The notification lied, live.** The background task reported "exit code 0" for a run that ended `Overall: FAIL`; only the explicitly echoed `BASELINE_EXIT=1` and the log's `Overall:` line were truthful. Third independent reproduction of OPEN.md #103/#105 — and the exact mechanism by which a Director could journal a green Gate 4 that was red. The mitigation held because it was applied in advance.

**Why I am not proceeding on my own judgement.** Whether the #102 schema fix falls inside this goal's frame — *"set … when capturing or updating a goal"* — is genuinely arguable in both directions, and the frame does not decide it in terms I can quote. Role file rule 3 makes that the operator's call, not mine. Fixing it directly would also be a hot patch outside the harness, which Stage 2 forbids.
**Next:** Surface to the operator with the options; resume only on their explicit instruction.

## 2026-07-26T18:08:09Z — Operator instruction: repair the live schema, then run clean

**Story/Phase:** `goal-intent-fields` / Stage 0 preflight (step 6)
**Decision:** ANSWER
**Judge:** n/a
**Why:** Presented three options; the operator chose **repair the schema first, then run the book on a green baseline**, explicitly authorizing the `save-schema` call against the **local** stack. This resolves the question I could not answer myself: OPEN.md #102 is treated as **live-data repair, not this book's scope**, so the frame is untouched and the 5-story budget stays with the feature work. Recording it as an ANSWER because it is the operator deciding a scope question, not me inferring one. The act is local-only — no staging or prod schema was touched, and the same defect presumably still stands on those instances (flagged below, not fixed here).
**Next:** Apply, verify, re-baseline.

## 2026-07-26T18:07:00Z — Live schema repaired; exactly one field moved

**Story/Phase:** `goal-intent-fields` / Stage 0 preflight (step 6)
**Decision:** INFO
**Judge:** n/a
**Why:** `save-schema` **replaces** the schema, so I read the live node first (`GET /api/concept-graph/node/39999:<TA>:tapestry-owner-goal-schema`, the same read path the failing test uses) and mutated only `required`, inventing nothing. Diff of the whole schema object before/after is **one hunk**: `["name","slug","description","chanceOfSuccess"] → ["name","slug","description"]`. Verified after the write: `required` reads back correct; all **12** properties intact (`prompt`, `chanceOfSuccess`, `needsHumanInput`, `needsBreakdown` still declared — the goal's premise is unchanged); `x-tapestry.unique` still `["name","slug"]`; the d8 primary-property fold reported `reconciled` with before/after property lists **identical**; `GET /api/brain/hygiene` green (`sound: true`, 0 problems). The two deterministic failures then went green in isolation — `structures-the-brain-can-trust` **24/0** (was 23/1) and `break-a-goal-into-pieces` **30/0** (was 29/1).
**Next:** Full `npm test` re-baseline — targeted re-runs are not a baseline, and Gate 4 must rerun the identical command.

## 2026-07-26T18:08:09Z — Two facts recorded now, so they are not lost later

**Story/Phase:** `goal-intent-fields` / Stage 0 preflight
**Decision:** INFO
**Judge:** n/a
**Why:** (1) **OPEN.md #102 is only fixed on local.** The same schema node presumably still carries `chanceOfSuccess` in `required` on staging and production; repairing those is an operational act on deployed instances, outside my ceiling, and belongs to the operator. The row should not be closed on the strength of this local repair. (2) **The strfry-count race is expected to recur** in the new baseline (`relationship-primitives` H8 / `-probe` H4). If it does, I will treat it as environmental **only** on the evidence already gathered — isolated re-run green at 23/0 and 9/0 — and I will say so explicitly rather than quietly discounting a red. If anything *else* fails, that is a fresh halt.
**Next:** Read `BASELINE_EXIT` and `Overall:` from the log when the run completes — never the notification's exit code.

## 2026-07-26T18:33:00Z — Baseline GREEN, and verified to be a real green

**Story/Phase:** `goal-intent-fields` / Stage 0 preflight (step 6) — CLEARED
**Decision:** INFO
**Judge:** n/a
**Why:** `BASELINE_EXIT=0`, `Overall: PASS`, **zero** `FAIL` lines, no suite reporting a failure. Baseline command of record: **`npm test`** — Gate 4 reruns exactly this. Log committed as `baseline-green-2026-07-26.log`.

I did not stop at "PASS", because OPEN.md #104/#106 documents that a **fully-skipped H-class still reports suite PASS** — a green that means "nothing ran." Checked: all four suites of interest ran with **0 skipped** — `relationship-primitives` 23/0/0, `relationship-primitives-probe` 9/0/0, `structures-the-brain-can-trust` 24/0/0, `break-a-goal-into-pieces` 30/0/0 — and each previously-failing H test is present in the log as an executed PASS (`H8 (AC-5)`, `H4 (AC-4)`, `H4 (AC 3)`, `H1 (ADR d13)`). 26 tests skipped elsewhere in the run, none in these suites.

The strfry-count race did **not** recur, so the prediction I recorded before the run went unused — noted because a pre-commitment that turns out unnecessary is still worth recording honestly, and because it means the environmental-race discount was never actually applied to reach this green.
**Next:** Stage 1, Planning.

## 2026-07-26T18:38:47Z — Planning spawned

**Story/Phase:** `goal-intent-fields` #1 / Planning
**Decision:** INFO
**Judge:** n/a
**Why:** Spawned the `product-owner` subagent. Inputs given: the acceptance frame by path, the three goal terms verbatim, and two disclosures — that **no intake entry exists** (all 58 checked, none match), and that the book's "Context available to Planning — not terms" section is informational and may not be used to widen scope, with the already-repaired schema defect named as explicitly out of scope so it is not written up as a story. Told it to return questions rather than invent product intent, and not to put file paths or function names in the story (Gate 1 fails on solutioning). Asked it to state a recommended story count; stopping rule 4 caps the book at 5, which I deliberately did **not** disclose — a role told its own budget tends to decompose to fit the budget rather than the frame.
**Next:** On its return, re-run the terms-mismatch check, then Gate 1 with a fresh blinded `gate-judge`.

## 2026-07-26T18:44:00Z — Terms-mismatch check before Gate 1: PASS

**Story/Phase:** `goal-intent-fields` #1 / pre-Gate-1
**Decision:** INFO
**Judge:** n/a
**Why:** Role file requires this check before **every** gate decision, not just at preflight. Re-asked the endpoint: `eligible: true`, anchor distance 0, and both verbatim blocks in the book still match the goal's live `deliverable` and `boundary` exactly. No `anchor-stale`.
**Next:** Answer the Product Owner's three questions.

## 2026-07-26T18:45:17Z — ANSWER ×3 to Planning: all three settled by the frame, none delegated

**Story/Phase:** `goal-intent-fields` #1 / Planning
**Decision:** ANSWER
**Judge:** n/a
**Why:** The Product Owner returned three product questions rather than guessing — correct behavior. **None of them was a halt and none required rule 2's "underdetermined → simplest":** the operational book's generated section carries no delegation list (that is an armed-mode field), so rule 2 was unavailable to me by construction, and all three had to be answered from the frame's own words under rule 1 or halted. All three were quotable:

1. **Full prompt on every surface, no truncation.** Frame: *"all four **come back** on every surface that shows a goal."* A truncated prompt is not the value coming back, and nothing licenses a list-surface exception.
2. **"Every surface" is universal, including a goal embedded in something else.** *"Every"* is the owner's word. Narrowing it to goal-centric surfaces would shrink the owner's terms to make the work smaller — as illegitimate as widening them, and it would let this book claim done with the bullet unmet. Corroborated by the book's own `unavailable` block: the Direction endpoint reads the estimate from the raw record *because* the goals API drops it, so an embedded reader is the named beneficiary.
3. **Setting only; clearing back to unset stays out.** The frame's verb is *"set."* Erasing a value is a capability the frame does not name, so adding it would widen the frame.

Each answer is the most literal reading, which is also what the role recommended — noted because agreement is not evidence of correctness, and the reasoning above stands independent of it.

**One correction issued.** The Product Owner observed the live local schema now reads `required: ["name","slug","description"]` and inferred OPEN.md #102 is stale and flippable. Wrong, and corrected before it could reach another artifact: the repair was **local-only**; staging and production presumably still carry the defect, which is where the "25 of 30 goals schema-invalid" consequence actually bites. Instructed not to flip the row and to confirm no flip was written anywhere.

I also withheld one thing deliberately: I did **not** tell the role whether its recommended story count is acceptable, so its answer stays grounded in the frame rather than in what it infers I want.
**Next:** On its return, Gate 1 — fresh blinded `gate-judge`.

## 2026-07-26T18:53:41Z — Gate 1: KICK_BACK (binding) — story is not one subsystem

**Story/Phase:** `goal-intent-fields` #1 / Gate 1
**Decision:** KICK_BACK
**Judge:** **KICK_BACK**, blinding reported intact. Fails one rubric item — *"≤ ~5 criteria, one subsystem. Larger → split before approving."* Six criteria is within tolerance of "~5"; the decisive half is **one subsystem**, and the story spans three: the goal write path, a **deliberately unenumerated universal** of read surfaces, and the control-panel React screens. Verified against the tree rather than asserted (server `brain/goals`, `api/brain`, `brain/direction`, `normalize`; React `Goals.jsx`, `GoalDetail.jsx`, `Proposals.jsx`, plus two hooks) — server API and React client are two subsystems at minimum. Compounding it: *"the story's extent is undetermined by construction at this gate — a judge cannot confirm 'one subsystem' for a scope the story declines to bound."* Five other items pass, several with independent verification (property meanings checked against the live Concept Graph; the intake absence confirmed by its own search rather than taken from my prompt).
**Why:** Binding, and I do not approve over it — but I also concur on the merits, which matters more than the bindingness. The judge caught something my own read missed: I was watching the **six-vs-five count**, which is the surface reading of that rubric item and the part the Product Owner had already argued well. The real failure is the *unbounded* half — answer 2, my own answer, made the read surface a universal, and a universal cannot be confirmed as one subsystem by anyone, at any gate. That is a direct consequence of a Director answer, not a Planning defect, and I am recording it as such rather than letting it read as the role's mistake.

Two criteria the judge flagged for tightening while reworking, recorded so they are not lost before Gate 3: (a) *"the estimate as 0/unset"* names two mutually exclusive observable outcomes as both acceptable and sits in tension with *"the ones not supplied stay unset"* — no test can discriminate; (b) *"visible there in the register those screens already use"* is an editorial judgment, not an external observation.

The judge's closing point resolves the tension I expected here: **"Splitting does not narrow the owner's frame, since the frame is satisfied by the book rather than by any single story."** That is correct and worth pinning — the frame is the *book's* contract, so decomposition across stories neither widens nor narrows it. Answer 2 stands unchanged.

One observation the judge explicitly placed outside its verdict: OPEN.md #102 says the schema fix *"belongs with `store-and-show-the-prompt-and-the-estimate`"* while the story scopes it out. That is not a contradiction the judge should resolve and it did not try — it is the operator's ANSWER of 18:08Z, already on this record.

**Counters:** Gate 1 KICK_BACKs on story #1 = **1** of 3 (stopping rule 2 halts at 3 consecutive).
**Next:** Route back to Planning for a split. I will **not** disclose the 5-story cap — a split shaped to fit a budget hides the very signal the cap exists to raise. If the honest split exceeds 5, that is a halt, and the halt is the system working.

## 2026-07-26T19:00:00Z — Planning rework: three bounded stories; the role reversed itself on evidence

**Story/Phase:** `goal-intent-fields` #1–#3 / Planning (round 2)
**Decision:** INFO
**Judge:** n/a
**Why:** Split into **three** stories — write path, read surfaces, existing screens — four criteria each, strict 1→2→3 dependency. **Book total is 3, under stopping rule 4's cap of 5, so no halt** — and reached without the cap ever being disclosed, which is the outcome I was hoping for when I withheld it.

The role fixed the *actual* defect rather than the symptom: the kick-back was not about the count but about extent being deferred, so each story now **enumerates its surfaces** and carries a clause routing back to Planning if Architecture finds one off the list. Bounded at the gate instead of delegated.

Worth recording: the role **withdrew its own earlier objection on evidence**, unprompted. It had argued a split would leave story 2 with no architecture of its own; verifying its inventory it found `familyEntries` builds export entries from the raw record and uses `parseGoalRow` only as a validity filter — so the export already returns all four today while every parsed surface drops them. A real seam, found by looking rather than by being told.

**Two Director calls.** (1) Numbering 1–3 reused rather than renumbered to 4–6: the rejected draft was never committed, slugs differ, story 1 carries an explicit `Supersedes:` line, and renumbering would leave phantom gaps implying missing stories. (2) I committed the rework **before** re-judging. The judge protocol says an artifact unchanged since its last verdict may not be re-judged and names a commit as the mechanism; the skill says commit on approve. Those pull opposite ways, and I resolved it toward the anti-judge-shopping purpose — the commit message states plainly that approval was still pending.
**Next:** Terms check, then Gate 1 round 2.

## 2026-07-26T19:08:53Z — Gate 1 (story #1): APPROVE

**Story/Phase:** `goal-intent-fields` #1 / Gate 1
**Decision:** APPROVE
**Judge:** **APPROVE**, blinding intact — and the judge explicitly treated my prompt's claim that no intake entry exists as *unverified*, checking it itself with two keyword sweeps. All six rubric items pass. All three prior findings confirmed resolved: extent now fixed at Planning by an inventory the judge **confirmed against the tree** (the three named write operations are three POST handlers in one server module, and it verified the four are genuinely dropped there today); the `0/unset` disjunction replaced by a single outcome (absent from the stored record), with read-layer defaults separated into the epic; the "register" clause demoted to a review consideration.
**Why:** I concur independently, and the concurrence is not a formality — the thing that persuaded me is that story 1 is **externally verifiable the moment it lands, with no read work**, because the export already returns each goal's raw stored record. A story whose acceptance can be observed without its successors is genuinely one subsystem, which is exactly what the prior verdict said was missing. Terms-mismatch check re-run immediately before this decision: PASS.

**Two non-blocking notes the judge left for Architecture, carried forward so they are not lost:** (a) `create-element`'s no-json branch auto-populates every declared property with type defaults, so a goal captured with no explicit json body would carry `prompt: ''`, `chanceOfSuccess: 0` and both flags `false` — **present rather than absent**, in tension with the story's AC2; (b) `restore-brain` is a **fourth** goal-writing path, though it passes the record section through verbatim and so adds no subsystem. If either turns out to be in scope, the story's own clause routes it back to Planning rather than letting it be absorbed silently.

**Counters:** Gate 1 on story #1 — 1 kick-back, then APPROVE. Stories #2 and #3 are drafted but **not** gated; each gets its own Gate 1 when its cycle begins.
**Next:** Phase 2, Architecture on story #1.
