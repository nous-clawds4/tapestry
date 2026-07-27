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

## 2026-07-26T19:30:00Z — Architecture invoked the story's kick-back clause; a judge finding disproved

**Story/Phase:** `goal-intent-fields` #1 / Architecture
**Decision:** KICK_BACK (Architecture → Planning, via the story's own clause)
**Judge:** n/a — no ADR was written, so there is nothing for Gate 2 to judge
**Why:** The Architect declined to write the ADR and returned the story, because writing one would have forced it to answer a scope question the clause reserves for Planning. That is the clause working exactly as intended, and it is the outcome I told it I would rather receive.

**The finding: "capture from scratch" maps to *two* endpoints, not one.** The story enumerates three write paths; "from scratch" is `create-element` **and** `note-goal-idea`, and they behave **oppositely** — `create-element` stores the caller's json verbatim (already carries the four), `note-goal-idea` builds the section from a fixed whitelist and silently **drops** them. `note-goal-idea` is no edge case: dedicated route, owner/loopback gate, its own refusal, ADR 0005 d7 ("Capture a NEW root goal"), and live H-coverage. A goal captured through it with a prompt loses the prompt.

**A gate judge's finding was factually wrong, and I verified the correction myself rather than choosing between two agents.** Gate 1's non-blocking note (a) claimed `create-element`'s no-json branch would auto-populate the four with type defaults, making them *present* rather than absent. I read `src/api/normalize/index.js:1823-1843` directly: the loop iterates the **top-level** schema properties, and the goal schema is a single-concept wrapper whose only top-level key is `tapestryOwnerGoal` (type `object`), so it takes the `t === 'object'` branch and yields `{tapestryOwnerGoal: {}}` — an empty section. It never descends into the inner properties. The tension does not arise. **The Gate 1 APPROVE stands**: the note was explicitly non-blocking and the verdict rested on none of it. Recorded because a judge being wrong on a detail while right on the verdict is exactly the kind of thing that quietly rots a record if unlogged. Judge note (b), `restore-brain` as a fourth writer, **holds** — verbatim passthrough, no work needed, to be named in the ADR.

**ANSWER to the Architect's Question 1 — `note-goal-idea` is in scope.** Frame-decided under rule 1, quotable: *"I can set any of the four … when **capturing** or updating a goal."* `note-goal-idea` captures a goal; therefore setting the four there is in the frame. Excluding it would **narrow** the frame — the identical error I refused at answer 2 — and would leave the owner capturing a goal with a prompt and silently losing it, which is precisely the invisibility the ask describes.

**ANSWER to Question 2 — operator's call, not mine.** `GOAL_SCHEMA` (used by `ensureGoalConcept` to self-provision on a fresh instance) has drifted to 8 properties and omits the four. Zero effect on this instance; on a fresh or restored one it would provision a schema that does not declare them, and undeclared fields are silently dropped by the element editor. The frame does not settle whether that is in scope — genuinely arguable both ways — so under rule 3 I surfaced it rather than deciding. **Operator: fold it into story 1.** Same module, same subsystem, and story 1 was returning to Planning regardless, so it costs no extra round trip.

**Counters:** this is a phase kick-back from the story's own clause, **not** a judge KICK_BACK at a gate; stopping rule 2's Gate 1 consecutive counter reset to 0 at the APPROVE and is unaffected. Book story count stays **3**.
**Next:** Return to Planning with both answers to re-bound story 1's inventory, then a fresh Gate 1 — the enumeration is what Gate 1 certified as bounded, so changing it re-opens that gate.

## 2026-07-26T19:48:30Z — Gate 1 round 3: KICK_BACK — the extent table is still incomplete

**Story/Phase:** `goal-intent-fields` #1 / Gate 1 (round 3)
**Decision:** KICK_BACK
**Judge:** **KICK_BACK**, blinding reported intact. Five of six items pass, with the judge independently confirming every per-path "state today" claim against source and the concept table against the live graph. The failure is the extent table: it omits `POST /api/normalize/save-element-json` — a live, owner-reachable route wired to the generic element screen that writes an existing goal's record as given. Its reasoning is the part that convinces: the table **lists the generic element *capture* path** as "no work; must not regress" and then **omits the generic element *update* path — the same mechanism on the other verb.** Its closing line is fair: *"I cannot certify an enumeration as the story's boundary when I found a counterexample to it by reading the route table."*
**Why:** Binding, and I verified the finding myself rather than relaying it: `handleSaveElementJson` (`:3302`) takes any element uuid, checks only that the element exists, and replaces the json wholesale via `regenerateJson` — **no concept-type gate** — and `ui/src/pages/concepts/ElementDetail.jsx:164` posts to it. It is unambiguously a goal-record write path.

**The sharper finding is where the omission came from.** This was not a discovery gap. The **Architect's own inventory named `save-element-json`** — "wholesale replacement, ungated (ADR 0003 debt (a)) … almost certainly how the 8 live goals got theirs." It had six rows; the re-bounded story has five, and this is the one that fell out. The information was in hand and was lost in transcription between roles. That is worth more attention than the missing row itself, because it is a failure mode no gate rubric currently names: an inventory can be *correct at discovery* and *incomplete at hand-off*.

**Two blinding disclosures from the judge, both honest, neither voiding the verdict — and one is a real harness defect.** (a) The story and epic files themselves carry run-state text the judge must read to do its job — "Re-bounded … returned from Architecture", "**Supersedes:** … KICK_BACK". The protocol says a judge must never receive prior verdicts beyond findings carried on a re-judge; here the *artifact* leaks what the *prompt* carefully withholds, and no amount of prompt discipline fixes it. (b) `Read` returned `book.md` in full despite the instruction to read the frame sections only — the blinding instruction is unenforceable at the tool layer. Both are **proposed amendments for the post-mortem**, not mid-run changes: goalpost-class material (judge protocol) is frozen while the run is live.

**Counters:** Gate 1 on story #1 — round 1 KICK_BACK, round 2 APPROVE (counter reset), round 3 KICK_BACK. **Consecutive = 1 of 3.** Book story count unchanged at 3.
**Next:** Back to Planning for a one-row fix; then Gate 1 round 4.

## 2026-07-26T20:06:16Z — Gate 1 round 4: APPROVE (concurred, over one known inaccuracy I am naming)

**Story/Phase:** `goal-intent-fields` #1 / Gate 1 (round 4)
**Decision:** APPROVE
**Judge:** **APPROVE**, blinding intact. Prior finding **resolved** — `save-element-json` is now a table row, correctly classified, and confirmed against source. All six items pass, and the judge certified the boundary by **re-deriving it from source rather than trusting the table**: `tapestryOwnerGoal` is constructed at exactly four sites repo-wide, all in one module, and the fresh-instance schema is in that same module. All eight table rows verified accurate.
**Why:** The re-derivation is what earns the approval. The **work-bearing class is closed by construction** — four construction sites, now independently verified twice by two different judges — and the work extent is one module. That is precisely what this rubric item asks a gate to certify, and it is certified by evidence rather than by the story's word.

**I am approving over a known inaccuracy, and stating it rather than absorbing it.** The judge found two further goal-record writers absent from the table — `fork-node` and `POST /api/neo4j/event-update` — and classified them immaterial. I checked its reasoning instead of accepting it, and **one leg of it is false**: it wrote that neither is reachable from any screen, but `event-update` is called from two list screens (`DListOverview.jsx`, `DListRatings.jsx`). The verdict survives anyway, because the load-bearing leg holds — `handleEventUpdate` takes only `{uuid}`, finds the event in strfry and re-imports it, so it **cannot drop the four** no matter who reaches it. Reachability is irrelevant when the operation is a verbatim re-import.

**Second judge factual error this run, and the pattern is worth naming.** Gate 1 round 2 claimed `create-element`'s no-json branch auto-populates the four (false — it yields an empty section). Round 4 claims `event-update` has no screen callers (false — two). Both were **non-blocking asides**; both verdicts were sound. The emerging shape: these judges are **reliable on verdicts and unreliable on incidental claims**, which is an argument for continuing to verify every finding I act on and for never letting an aside travel into an artifact unchecked. Proposed post-mortem amendment, not a mid-run change.

**Why I did not kick back a fourth time, having considered it.** The story's taxonomy — construct a section vs. store what you are given — is *sound*; what is overstated is calling the **store-as-given class** closed by construction. That class is open-ended and does not need closing, because nothing in it can drop the four. Criteria and work extent are unchanged by the correction, so re-gating would buy accuracy in a sentence at the cost of a full Planning-plus-judge cycle on the no-work class — and thrash is itself a harm the stopping rules exist to bound. I am requiring the precision fix **before Test Design**, since the test plan derives from this story, rather than letting it evaporate into a note.

**Counters:** Gate 1 story #1 — KICK_BACK, APPROVE, KICK_BACK, **APPROVE**. Consecutive counter reset to 0. Book story count 3.
**Next:** Precision correction to Planning (no re-gate), then Architecture resumes.

## 2026-07-26T20:20:00Z — Planning correction landed, and improved on the instruction

**Story/Phase:** `goal-intent-fields` #1 / post-Gate-1 correction
**Decision:** INFO
**Judge:** n/a
**Why:** Criteria untouched at 5, extent unchanged — which is why this did not re-open Gate 1. The claim asymmetry is now explicit: the **work-bearing class is closed** (four construction sites, one module, independently re-derived), the **no-work class is characterized, not enumerated** — membership decided by the property, with the story stating outright that the list is *not* claimed exhaustive and that a path missing from it is a record-keeping gap rather than a scope gap.

The role went further than instructed and made the **kick-back clause asymmetric to match**: a further *constructing* site returns the story; a further *replicating* one just adds a row. Better than what I specified — the clause now costs a round trip only when one buys something. It also explained the run's own history rather than excusing it: every path missed across three rounds was in the no-work class, exactly what the asymmetry predicts. And it caught more than I did — the re-import path is reachable from **four** screens, not the two I found. The judge's false unreachability reason is **not** in the story; replication is stated as the actual reason.
**Next:** Release Architecture.

## 2026-07-26T20:23:58Z — Gate 2 (story #1): APPROVE

**Story/Phase:** `goal-intent-fields` #1 / Gate 2
**Decision:** APPROVE
**Judge:** **APPROVE**, blinding intact. All seven rubric items pass, and by the judge's own account *"on evidence I gathered myself rather than on the ADR's word"* — it re-ran the three-call Concept Graph orientation against the live instance (57 concepts, the schema node's twelve inner properties, `required` exactly `["name","slug","description"]`, all four declared optional), reproduced the live-corpus counts, verified the firmware absence by grep, and spot-checked roughly two dozen line references, all landing exactly. Its own repo-wide sweep for `tapestryOwnerGoal` construction returned precisely the work-bearing set the ADR enumerates, and it sampled the replicating paths to confirm the "no change" rows are *earned rather than inherited*.
**Why:** I concur. The decisive quality is that the ADR's central claim is **checkable, and was checked by someone who did not write it** — twice now, independently, by two different judges at two different gates. Notably the Gate 2 judge also independently confirmed the correction I made to the Gate 1 judge's aside: the `create-element` defaults loop iterates top-level properties and yields `{tapestryOwnerGoal:{}}`, so the ADR is right to record that aside as not holding.

**The ADR's most valuable content is a trap it disarms.** `handleUpdateGoalIntent` keeps two field lists deliberately; appending the four to the existing list is a one-line change that *looks like tidying* and would silently create a rule the frame forbids — the `empty-value` loop would refuse `chanceOfSuccess: 75` **because of what it contains** (violating AC5), and the trim would break AC3's byte-identical prompt. The ADR requires an in-code comment on the asymmetry so a later reader does not "clean it up." That is exactly the kind of thing that survives review and breaks in production.

**Three non-blocking imperfections, recorded so they are not lost:** AC2 is engaged in substance but not cited by number; the ADR states an 8000-char S-pin slice budget where one pin actually slices 12000 (**stricter than reality, so it errs safe**); and a one-line off-by-one on the `GOAL_SCHEMA` range (`:4849`, not `:4850`). None touches a rubric item's purpose. The slice-budget one goes to the Tester, since it writes against those pins.

**One lane boundary held.** The Architect suggested I fill the story's `Linked artifacts → ADR:` line when committing. I did not: **the Director never edits the story file.** Routing it to the Product Owner, which owns that artifact — and doing it *after* Gate 2 rather than during, so no judge reads a file mid-edit.
**Next:** ADR link via Planning, then Phase 3 Test Design.

## 2026-07-26T22:29:13Z — Gate 3 (story #1): APPROVE

**Story/Phase:** `goal-intent-fields` #1 / Gate 3
**Decision:** APPROVE
**Judge:** **APPROVE**, blinding intact. It **ran the full suite itself** rather than reading my committed log, and reproduced the RED exactly: 40 tests, **16 pass / 24 fail**, H-class **11 executed / 0 skipped**, `Overall: FAIL`, exit 1. It then confirmed each failure class **against source and the live graph rather than against the failure messages** — `src/lib/brain/goals.js` requires cleanly and exports only its six pre-existing functions (so the U-class is not an import error), `pickIntentFields` appears nowhere in the normalize module, `GOAL_SCHEMA` declares exactly 8 inner properties, and `update-goal-intent` still answers its own 400 verbatim. It also verified the live concept node declares all four, so H10 fails on the constant and not on a moved premise.
**Why:** I concur, and my own independent run agreed before the judge's did. The 16 passes are **exactly** the 16 sentinels the plan declared in advance — a pre-declared pass set is what makes a partial-RED suite auditable instead of convenient.

**The most valuable artifact of this phase is a pin that would have failed on correct code.** The Tester measured the ADR's claim that additive growth keeps every source pin inside its window instead of trusting it, and found one that did not hold: `the-brain-survives` S7 anchors on a **comment** five lines above `GOAL_SCHEMA`, so its 4000-char window spanned the very constant this story grows — ~1631 chars of headroom against ~700 chars of new declarations. Re-aimed to structure-bounded extraction with **assertions byte-identical**, and the judge confirmed the re-aim is a genuine re-aim and not a weakening (extracted body 1047 chars, both required tokens present, suite 31/0). That is OPEN.md #109's failure class caught **prospectively**, before it broke anything.

**A side effect worth keeping.** The suite now prints its own `H-class: n executed / m skipped` roll-up and supports `TAPESTRY_REQUIRE_LIVE=1` to make an all-skipped live class a *suite failure*. That is a partial fix for OPEN.md #104/#106 arriving as a by-product of ordinary story work.

**Three non-blocking notes, one of which is a forward risk I am naming now rather than discovering at Gate 4.** (1) The plan quotes `Total skipped: 51` where my committed log tail reads 39 — two runs of the same code state, the suite's own block identical in all three. (2) The plan is right and the **ADR is wrong** about a sibling pin's slice width (12000, not 8000); the ADR's figure is stricter, so it errs safe. (3) **`relationship-primitives` H8 and `-probe` H4 failed in the judge's run too**, on global strfry scan-count brackets, ~1,000 log lines before this suite's first write — environmental, not caused by this change. **Gate 4 demands a clean full suite, and these two are count-bracket flaky in this environment.** Baseline run 2 was fully green, so it does pass; I will re-run rather than discount, and if it persists I will say so plainly instead of waving a red suite through a mechanical gate.

**The Gate-3 commit of record is `39b9a98c`** — Gate 4's `git diff 39b9a98c..HEAD -- test/` must come back empty.
**Next:** Phase 4, Implementation.

## 2026-07-26T22:56:12Z — Operator reviewed the run's pace and elected to change nothing

**Story/Phase:** `goal-intent-fields` #1 / Implementation (in flight)
**Decision:** ANSWER
**Judge:** n/a
**Why:** The operator asked why the session was taking so long and I gave them the accounting: ~6 hours elapsed, of which **~3 hours is pure test execution** (seven full `npm test` runs at ~25 min each — three mine, three the Tester's, one the Gate 3 judge's), 2h45m across 16 subagent spawns, ~40 min halted waiting on them, and four Gate 1 rounds on one story. I also named the part that was my own doing: answer 2 made the story unbounded, which is what triggered both the Gate 1 kick-back and the Architecture kick-back.

I offered four concrete levers — judges on a faster model, judges reading my committed log instead of re-running the suite, shipping story 1 alone, or letting it run — and stated the cost of each rather than presenting the fast options as free. In particular: a cheaper judge would likely not have caught the `save-element-json` omission, and dropping the judges' own suite runs would weaken the rule that has now caught **four** lying exit codes.

**The operator elected to change nothing.** Recorded because it matters at close: the run's thoroughness is now explicitly ratified rather than merely tolerated, and if this book is later audited for pace, the trade was surfaced with its costs and chosen deliberately. No rubric, budget, or ceiling was altered by this exchange — it changed nothing about the gates.
**Next:** Await Implementation; then Gate 4, which I verify mechanically myself.

## 2026-07-27T00:14:42Z — Gate 4 (story #1): PASS — on the second run, with nothing discounted

**Story/Phase:** `goal-intent-fields` #1 / Gate 4 (mechanical — no judge, by rubric)
**Decision:** APPROVE
**Judge:** n/a — Gate 4 is mechanical and the Director verifies it personally
**Why:** Every check verified by me, not read from the Implementer's report:

| Check | Result |
|---|---|
| Full suite, **identical** Stage-0 command `npm test` | `GATE4B_EXIT=0`, `Overall: PASS`, **no suite reported FAIL** |
| Story's own suite | **40 passed / 0 failed / 0 skipped** |
| H-class genuinely executed | **11 executed / 0 skipped** |
| `git diff 39b9a98c -- test/` | **0 lines** — re-verified at commit time |
| 64-hex pubkey literals added | **0** |
| `package.json` / lockfile changes | **0** |
| Firmware reinstall | correctly **not** run (ADR d7) |

**The first Gate-4 run was RED, and I did not wave it through.** It failed on `relationship-primitives` H8 and `-probe` H4 — the two I had named as a forward risk at Gate 3, with the pre-commitment *"I will re-run rather than discount."* I honored that: the story's own suite had **zero** FAIL lines in that run too, so the tempting move was to call the gate satisfied and note the flake. That is precisely the rationalization a mechanical gate exists to prevent. Re-ran the whole suite; it came back clean without intervention. **No quiescing, no filtering, no exception — the green is a real green.**

**Diagnosis of the flake, quantified rather than shrugged at.** `strfry-router` and `stream-consumer` run continuously and import from remote relays at a measured **~1 event per 15 seconds (0.07/sec)**. Both failing tests assert "this operation wrote nothing to strfry" by bracketing a **global** event count. That is **structurally unsound**, not merely flaky: any bracket spanning more than a few seconds will eventually catch an unrelated router write, so passing is the coincidence and failing is the expected behavior. Distinct from OPEN.md #104/#106, which is about probe timing and skipped classes. **Proposed OPEN.md row** (outside my lane to file): *a global-counter bracket cannot prove "wrote nothing" while a router is importing; the assertion needs to be scoped to the events under test, not the whole relay.* Evidence for whoever files it: counts moved `6014735 → 6014739` inside one bracket, and `6014739 → 6014740` in the next.

**The d4 trap is disarmed as specified, verified by reading the diff.** `intent` is computed **before** the refusal; the refusal is a presence test across both lists (`provided.length === 0 && Object.keys(intent).length === 0`); `provided` still holds exactly the three string fields, so the `empty-value` loop and the `.trim()` calls cannot reach the four; `intent` is passed through untrimmed and merged with `Object.assign`. The mandated comment is present and names the trap explicitly — that collapsing the lists "looks like tidying" but "silently creates a rule the story forbids."

**Two honest choices by the Implementer, recorded because both could have been hidden.** It declined to run the scratch-instance drill that would close AC4 end-to-end — it journals a durable record into the live brain and boots a second container, real side effects beyond a test gate — and said so rather than quietly skipping or quietly doing it. And it left the story's Deviations section **absent** rather than padding it, because nothing in the diff diverges from the ADR.
**Next:** Phase 5, Review — fresh context, never the Implementer's.

## 2026-07-27T01:29:15Z — Gate 5 (story #1): APPROVE — story #1 complete through all five phases

**Story/Phase:** `goal-intent-fields` #1 / Gate 5
**Decision:** APPROVE
**Judge:** **APPROVE**, blinding intact. Its summary is the standard I want held: *"This review demonstrates rather than asserts."* It **reproduced the Reviewer's test gate twice** — a full `npm test` whose roll-up matches the review's quoted block *line for line* (including the two false-positive `FAIL` regex hits), plus the `TAPESTRY_REQUIRE_LIVE=1` standalone at exit 0, 40/0/0, live class genuinely executed. It re-ran the review's independent greps, and sampled ~20 file:line references, all resolving to the construct claimed.
**Why:** I concur, and I verified the one thing the rubric assigns to me personally: the `**Status:** Done` flip is **present in the review commit** and is the Reviewer's own — `git show --name-status b942fd07` is exactly `A` review + `M` story, with `Approved → Done`, no renames, no moves, and no separate Director commit touching the story file.

**Defects found: cosmetic only.** An off-by-one line reference for `INTENT_FIELDS` (`:263` vs `:264`), a diff-size figure of +96 where the true insertion count is **+90**, a skipped-test total that does not reproduce (41 vs 51 — live-stack-dependent elsewhere in the suite, load-bearing for nothing), and the conditional product-guide section omitted rather than marked N/A (the book is explicitly no-PRD, so the condition does not apply). None is a rubric item; none affects mergeability.

**The Reviewer found a hole in the harness's own safety net — and caught itself falling into it.** Its `EXIT=${PIPESTATUS[0]}` echo came back **empty**: `PIPESTATUS` is bash and this shell is zsh, so **OPEN.md #103's own recommended mitigation silently evaporates under the `| tee` idiom that same row recommends**. It closed the hole with a second independent run rather than resting on a log line. Fifth exit-code incident this session, and the first where the *documented fix* was the thing that failed. Worth noting precisely: my own runs use `{ npm test; echo "EXIT=$?"; } > log`, which avoids the pipe entirely — **the brace form works, the pipe form does not**, and the ledger should say which.

**A Reviewer conclusion I can correct, because it lacked context I have.** It read the live schema's `required` as correct and concluded OPEN.md #102 "looks stale." It is not — I repaired that on **local only** at 18:07Z; staging and production presumably still carry it. Its restraint was right: it logged the observation for triage and explicitly declined to "close someone else's bug from a review." Right instinct, wrong conclusion, and only because the repair is invisible from where it stood.

**Completion detection correctly made no offer.** The frame's *"all four come back on every surface that shows a goal"* is untouched by design; stories #2 and #3 remain `Approved`. The book stays Open. That is the Reviewer declining to propose done on a third of a frame.

**Director sequencing call: no deploy yet.** The skill reads *"Phases 1–5 per story, then `/cycle-local` → `/cycle-staging`"*. Story #1 alone leaves the four **storable but still invisible** — precisely the state the goal's ask complains about — so shipping it to shared staging buys nothing and ships a half-feature. Local verification is already substantial: the H-class ran against the live local stack and passed, twice, in my Gate-4 runs. Deploy chain runs once all three stories are through their gates.

**Ledger items accumulating that are outside my lane to file** (evidence is in this journal for whoever writes them): (1) the global-counter bracket unsoundness, quantified; (2) the zsh/`PIPESTATUS` hole in #103's own mitigation; (3) ADR `Status: Proposed` never flips to `Accepted` because no workflow step assigns it.
**Next:** Story #2 — `2-return-the-four-on-every-read-surface`. It is drafted but **not gated**; being written early grandfathers nothing. Gate 1 on it as it stands.

## 2026-07-27T01:40:20Z — Gate 1 (story #2): KICK_BACK — AC3 contradicts a shipped production contract

**Story/Phase:** `goal-intent-fields` #2 / Gate 1
**Decision:** KICK_BACK
**Judge:** **KICK_BACK**, blinding intact. Five items pass — well-bounded, no solutioning, correctly anchored, and its "state today" column verified accurate **against the current branch** (which matters, because story #1's code shipped underneath it since drafting). One item fails: **AC3 is not testable as written.**
**Why:** Binding, and this is the sharpest finding of the run. AC3 requires every surface in the story's own table to return the estimate as `0` and both flags as `false` for a never-set goal — while **the same table's export row** says the export returns the stored record *verbatim* and "must not regress." Two opposite outputs demanded from one surface; a tester has no determinate expected value.

It is not a wording slip, and I verified the substance myself rather than relaying it:

- **Story #1's shipped ADR deliberately encodes absence as key-absence**, and says why: *"the only representation of 'unset' that survives storage, export and restore."* AC3 erases exactly that distinction on the export/restore path.
- **It would break a shipped, test-pinned production contract.** `test/operational-direction.test.js` **U25** reads *"an absent estimate is RECORDED AS ABSENT — never invented"*, asserting `estimate === null` and `estimateSource === 'absent'`; `src/lib/brain/direction.js:136-145` implements it. That pin came from the **operational-direction book, which is closed and in production**. AC3 mandates `0` there.

**ANSWER — the declared defaults are interpretation-side; verbatim surfaces must not inject them.** Decided from the frame plus the ceiling plus the shipped contract, jointly:
1. The frame says *"all four **come back** on every surface."* For a property never set there is nothing to come back — materializing a value is **adding** behavior the frame does not name.
2. The ceiling says *"nothing acts on the estimate or the flags."* Inventing a default **is** acting on the estimate.
3. The concept's own words — *"The default is 0, if not otherwise estimated"*, *"Absent means false"* — tell a **consumer how to interpret absence**; they do not oblige storage or transport to materialize it.

**I am recording the alternative reading rather than pretending it does not exist:** "all four come back" could be read as "all four keys are present in every response." I reject it because it would require breaking a production contract from a previously-closed book — which a frame cannot do silently — and because the risk is asymmetric: my reading preserves shipped behavior and adds nothing, and if it is wrong the correction is purely additive later. **Flagged to the operator as overrulable.**

**Secondary finding, same class as story #1's.** Two further verbatim goal-showing read surfaces sit outside the table (`/api/concept-graph/node/:handle`, `/api/concept/:handle/export-set`), and by the story's own clause they would bounce it back from Architecture anyway. The fix is the one the epic **already invented** for story #1's write paths: characterize the verbatim class by its property instead of enumerating it, and enumerate only the projecting class that does work. Story #2 currently enumerates one member of the verbatim class and closes the list.

**Counters:** Gate 1 on story #2 — **1** kick-back, 1 of 3 consecutive. Story #1 remains Done. Book story count 3.
**Next:** Route to Planning with the two-class answer; Gate 1 round 2 on story #2.

## 2026-07-27T01:50:00Z — Planning corrected MY answer, and was right

**Story/Phase:** `goal-intent-fields` #2 / Planning (round 2)
**Decision:** INFO
**Judge:** n/a
**Why:** I told Planning the declared defaults belong on the **projecting** reads. That rule was wrong. The Direction transcription **is** a projecting surface — it builds terms from a parsed record — and U25 is precisely the pin that it must never invent an estimate. My rule would have broken the same closed-book production contract I was protecting, one surface over. **The projecting/verbatim boundary and the invent/don't-invent boundary are not the same line.** My conclusion held; the rule I gave to carry it did not.

Its fix is better than my instruction: the two classes bind to **where the work is**, and the defaults rule binds to **neither**. AC3 becomes a *no-invention invariant* rather than a value, naming both shipped ways of saying "not set"; the declared defaults move to the interpretation point, the screens, in story #3.

**It also supplied an argument I had not made, which upgrades my reading from "safer bet" to "only one that survives."** Materializing defaults on the export path would be **destructive**, not merely wrong-shaped: restore stores the artifact's section verbatim, so an export inventing `chanceOfSuccess: 0` would have restore write those zeros back in — silently converting *"never estimated"* into *"estimated at zero"* on every goal, permanently, across a single backup cycle.
**Next:** Gate 1 round 2.

## 2026-07-27T01:54:35Z — Gate 1 (story #2, round 2): KICK_BACK — the epic still carries the rejected answer

**Story/Phase:** `goal-intent-fields` #2 / Gate 1 (round 2)
**Decision:** KICK_BACK
**Judge:** **KICK_BACK**, blinding intact. **Both prior findings confirmed genuinely resolved**, verified against source rather than the story's account — it independently re-derived the projecting class from the parser call sites and got exactly the story's five. One new blocker: the rework edited **only the two story files**. `engineering-team/epics/goal-intent-fields.md:134-136` still reads *"the estimate reads `0` when never estimated; each flag reads `false` when absent. **Stories 2 and 3 use exactly those, once each, so a test can discriminate.**"* — the rejected answer, still standing in the artifact the story itself points to for its ratified Planning answers, and **addressed squarely at the next gate's audience, the Tester.**
**Why:** Binding, correct, and **partly my fault**: when I routed the correction I told Planning to fix the stories and check story #3, and did not say *"and update the epic."* The epic is this epic's ratified-decision record and the story explicitly redirects readers to it, so leaving it stale relocated the contradiction rather than removing it — the same defect class as the prior FAIL, one document over. I verified the finding myself: `git show --stat ce205321` touched two story files and no epic.

**Non-blocking, carried forward:** a **fourth** off-list parser call-site exists — the hygiene check — which the story's accounting sentence does not cover. It emits problem records rather than goal fields, so it is neither projecting nor a scope gap; the sentence claiming a gate can account for *every* hit is simply incomplete. Also record-drift: the epic's story-2 entry still reads `**Approved** 2026-07-26` with no trace of this return and rework, unlike story #1's entry.

**A second blinding-leak vector, and this one is worse than the first.** The judge disclosed that a `git log --oneline -8` surfaced **commit subjects naming other gates' outcomes**. My own commit messages are the leak: they say things like "Gate 1 KICK_BACK", "Gate 5 APPROVE". Any judge that runs a git command can read the run's progress state straight out of history. Combined with the earlier finding that story/epic files carry `Supersedes: … KICK_BACK` text, this is now two independent channels by which artifacts and history defeat prompt-level blinding. **Proposed post-mortem amendment** — goalpost-class material is frozen mid-run, and I will not start sanitizing commit subjects while the run is live, because that would degrade the audit record to protect a control that needs redesigning anyway.

**Counters:** Gate 1 on story #2 — **2 consecutive KICK_BACKs. Stopping rule 2 halts the run at 3.** I am stating that before the next attempt, not after it. The fix here is a few lines in one file, so I expect it to clear; if it does not, the run halts and the operator looks at it, which is the rule working rather than failing.
**Next:** Planning updates the epic — retract or re-allocate the defaults sentence, record story #2's return, and widen the accounting sentence to the fourth call-site. Then Gate 1 round 3.

## 2026-07-27T02:07:47Z — Gate 1 (story #2, round 3): APPROVE — no halt

**Story/Phase:** `goal-intent-fields` #2 / Gate 1 (round 3)
**Decision:** APPROVE
**Judge:** **APPROVE**, blinding intact. All six items pass. It **re-derived the projecting-class inventory from source** rather than accepting the story's word and got exactly the story's five handlers, confirming every other `parseGoalRow` hit is write-side, hygiene, or the verbatim export. Both prior findings **resolved at root**: the epic now supersedes the rejected defaults rule in place and records decisions 6 and 7 in its stead, and grep confirms the only surviving "once each" sits inside the sentence retracting it. It checked story #3's AC2 as the mirror image and confirmed no governing document now demands opposite outputs for a never-set property.
**Why:** I concur. What earns it is that the fix was made **at the root rather than at the symptom** — the contradiction was removed from the artifact that *governs*, not patched in the artifact that was *judged*. Had Planning only edited story #2, the same defect would have relocated a third time.

**Three non-blocking observations, carried to Architecture rather than dropped:** (1) the story labels one normalize parser site "the decomposition validator" where it actually serves seven write functions — all write-side, none returning any of the four, so the accounting still balances; (2) AC1/AC3's verbatim clause names one client-side member while the subsystem line confines the story to server reads — testable via the export and the concept-graph node read, so not a defect; (3) generic graph-traversal reads return only a goal element's name and labels, so they fall outside the projecting/verbatim dichotomy while carrying no goal fields at all.

**Counters:** Gate 1 on story #2 — KICK_BACK, KICK_BACK, **APPROVE**. Consecutive counter **reset to 0**; the run did not reach stopping rule 2. Story #1 Done, story #2 through Gate 1, story #3 revised and not yet gated.

**Worth stating plainly at this point in the run: four Planning returns across two stories, and three trace to me** — the unbounded "every surface" answer, the projecting-surfaces rule that would have broken U25 one surface over, and routing a correction to the stories without saying "and the epic." The gates caught all three. The honest reading is not that the roles have been sloppy; it is that **the Director's answers have been the expensive part of this run**, and the blinded gates are what kept each of my errors from reaching code.
**Next:** Phase 2, Architecture on story #2.

## 2026-07-27T02:45:00Z — ANSWER: story #3's collision with a closed book — narrow supersession, operator-ratified

**Story/Phase:** `goal-intent-fields` #3 / pre-Planning
**Decision:** ANSWER
**Judge:** n/a
**Why:** ADR 0002 flagged rather than resolved a live collision: `second-brain` ADR 0006 d13/AC6 — **closed book, shipped** — forbids "no numeric score, percentage, gauge, or ranking number … in any owner-facing proposal string or rendered card/spine content", and story #3 is scoped to show a 0–100 estimate on the Proposals screen. I verified both halves: `test/the-proposal-loop.test.js:615` asserts no `score|rank|percent|gauge|★|toFixed(` token, and the card-key scan at `:705` does **not** match `chanceOfSuccess`. **So a bare number would likely slip past the test while still violating the ratified constraint** — squeaking past a regex is not a resolution.

Surfaced to the operator rather than decided, because it requires editing a closed book's ratified constraint. **Operator ratified a narrow, explicit supersession**: d13's prohibition targets *system-generated* scores that would make proposals look ranked; `chanceOfSuccess` is the **owner's own estimate**, a materially different thing. Story #3's ADR supersedes d13 narrowly, scoped to owner-authored values, leaving the ranking prohibition intact.
**Next:** Carry to story #3's Planning and Architecture.

## 2026-07-27T02:49:44Z — PROTOCOL BREACH (mine): Gate 2 blinding broken; APPROVE is VOID

**Story/Phase:** `goal-intent-fields` #2 / Gate 2
**Decision:** HALT *(of this verdict — the gate re-runs; the run continues)*
**Judge:** Reported **Blinding: BROKEN**, then judged the merits anyway and would have APPROVED. **Under `roles/director.md:87` an APPROVE from a judge reporting broken blinding is void.** I am discarding it and re-spawning. The merits finding is **not** carried forward as evidence — a void verdict is void, and quietly banking its conclusion while discarding its label would be worse than the original breach.
**Why:** **Both leaks were mine, in the spawn prompt.**
1. I annotated a neighbour ADR as *"sibling story 1, **implemented and shipped on this branch**"* — that is progress state, and annotating other documents is outside the Gate-2 input list entirely.
2. I routed the judge to `engineering-team/epics/goal-intent-fields.md`, **which is not a Gate-2 input at all**. That file carries `"returned by Gate 1 twice"` (`:44`), `"happened four times across two stories"` (`:60`), and a whole section summarizing prior gate-judge verdicts (`:118`) — i.e. prior verdicts beyond a re-judge's carried findings, which the protocol says a judge must **never** receive.

I added the epic because it holds this epic's ratified decisions and I wanted the judge to have them. That was helpful reasoning and a protocol violation; the input list is not advisory, and "the judge will do better work with more context" is precisely the argument the blinding rules exist to refuse.

**This exposes a third leak vector, and it is structural rather than my carelessness.** The **Gate 1** rubric *requires* checking that `epics/<epic-slug>.md` exists with a `**Status:**` line — while the epic is **not** on the blinding-safe input list and accumulates run history by design. So Gate 1 cannot be run to rubric without handing the judge a document that names prior verdicts. Every Gate 1 spawn in this run has that flaw. Together with the artifact leak (`Supersedes: … KICK_BACK` in story files) and the history leak (my commit subjects naming gate outcomes), that is **three independent channels defeating prompt-level blinding**. All three are **proposed post-mortem amendments** — goalpost-class material is frozen mid-run, and redesigning the blinding contract while running under it is exactly the self-serving edit the rule forbids.

**Not a Director defect, but the same class:** ADR 0002 itself contains *"this epic has already spent two Planning rounds on it"* (`:182`) — an artifact leaking its own run history to any judge required to read it.
**Next:** Re-spawn Gate 2 fresh, with **only** the protocol's Gate-2 inputs — ADR path, `decisions/` directory, story path, acceptance-frame-only book — no epic, no annotations.

## 2026-07-27T03:00:21Z — Gate 2 (story #2, clean re-spawn): APPROVE

**Story/Phase:** `goal-intent-fields` #2 / Gate 2
**Decision:** APPROVE
**Judge:** **APPROVE**, **blinding intact** — fresh judge, minimal prompt, no epic and no annotations. All seven items pass. In its own words it *"audited this by re-deriving rather than reading along,"* re-running the three Concept-Graph calls against the live stack, re-deriving ~30 citations, and independently reproducing the extent claim: six `parseGoalRow` call sites, five projecting consumers, **no sixth** — so the story's kickback clause does not fire.
**Why:** I concur. Two probes make this verdict worth more than its predecessor's: it verified the places a widened parser *could* have leaked into behavior are inert (`planRestore` compares on name/slug only; `hygiene.js` has no `Object.keys`), and it established that **the only exact-key sentinel over a goal shape in the entire suite** is the one the ADR names as its single re-pin — which is what makes the "expected to pass unmodified" list credible rather than hopeful.

**This verdict replaces the void one and is not a re-judge of it.** Fresh judge, no findings carried, no knowledge of the prior spawn. The earlier APPROVE stays discarded on the record rather than quietly reinstated by a second one agreeing with it.

**Two items to carry to Test Design.** (1) **Corpus drift:** the ADR says 6 of the 8 goals carrying `needsHumanInput` store `false` explicitly; a live read now shows **5 of 8**. Every other corpus count matches exactly. The load-bearing argument — an explicit stored `false` coexists with never-set, so fabricating `false` is lossy — is unaffected, but the Tester should read live rather than quote the ADR. (2) Two citation imprecisions, neither load-bearing: the Direction envelope is anchored on an ADR sub-decision that was itself superseded (the `terms` sub-shape is byte-identical in the corrected block, so the reasoning stands), and one shared-reader attribution names the wrong ADR inside a *rejected* option's con.

**The frame-section-only instruction leaked again, harmlessly and unavoidably.** This judge disclosed that its `grep -A 80` on the book pulled the adjacent generated Direction-mode terms block. Same unenforceable-at-the-tool-layer issue already logged; the block carries goal-derived terms only, no progress or budget state. Third consecutive judge to disclose it, which is itself evidence the instruction needs a structural fix rather than better wording.
**Next:** Phase 3, Test Design on story #2.
