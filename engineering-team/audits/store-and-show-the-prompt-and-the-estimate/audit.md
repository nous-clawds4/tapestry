# Build Audit: Store and Show the Prompt and the Estimate

**Book:** `engineering-team/audits/store-and-show-the-prompt-and-the-estimate/book.md`
**Date:** 2026-07-27
**Branch / commit range:** `e75d738b..5d8bf9c7` on `feat/store-and-show-the-prompt-and-the-estimate` — code merged to `staging` as `c0565e15` (PR #473); the four commits after the merge are documentation only (`git diff --stat origin/staging..HEAD -- src/ ui/ test/ tests/` is empty, verified).
**Provenance:** Acceptance-frame — **operational Direction, goal-derived**. The frame was transcribed by `GET /api/brain/direction/<slug>` from an owner-ratified goal at open, not hand-authored and not reconstructed at close.
**Confidence:** **high** for what shipped and for the local behaviour; **medium** for staging behaviour (gating and bundle identity verified; the owner-gated JSON could not be read there); **n/a** for production (nothing was promoted).

> The Build Audit is the **as-built record** — what the product *is* now, factual and source-linked. It does not propose changes; that is the seed's job.

**Who wrote this, and why it is not the Director.** The Director directed this run: it answered every gate, made several of the errors the gates caught, and had its own completion report kicked back for a false leading claim. This audit is written by the Reviewer at book scope, and every claim below that could be checked mechanically was re-checked here rather than harvested from the run's own record. Where the record overstates what was achieved, §4 and §7 say so.

**Two record hazards this audit was told about and honoured.** `book.md` → *"Record corrections"* names two classes of wrong commit message (four claiming an evidence log was committed while `.gitignore` had swallowed it; one attributing a vacuous test to a Tester artifact that had no such defect). Neither claim is harvested here as fact. `journal.md` was treated as authoritative wherever it and a commit message disagree.

---

## 1. What shipped

Four properties already declared on the goal concept — the prompt, the estimate, and two flags — now survive a round trip end to end. Before this book they could be *declared* but not *set through the goal-specific paths*, and no projecting read surface or screen returned them.

- **The four are accepted by every path that constructs a goal record** — capturing a new root goal from an assistant session, capturing a child goal during decomposition, and updating an existing goal's intent — while the seven record-replicating paths keep carrying them untouched. `stories/goal-intent-fields/1-store-the-four-when-a-goal-is-captured-or-updated.md`
- **A fresh instance now declares all four** when it self-provisions the goal concept, so *"I can set"* no longer fails outright on a new or restored instance. Same story (criterion 4).
- **All five projecting read surfaces return the four** — the goals list, a goal's detail, the session orientation read's `served` object, the proposal queue's nominated goal, and the Direction transcription. A never-set property reads `null`; a stored `0`, `false` or `''` comes back as itself. `stories/goal-intent-fields/2-return-the-four-on-every-read-surface.md`
- **The three existing goal screens display all four** — Goals (list), Goal detail, Proposals — with the prompt shown as its own text (in full on the detail screen, as an excerpt of the real text on the two list-type screens), never as a bare "has prompt" badge. `stories/goal-intent-fields/3-show-the-four-on-the-goal-screens-that-already-exist.md`
- **A ratified, narrow exception to a closed book's rule**: an estimate the *owner* recorded may render as a number on a proposal card. The prohibition on *system-generated* scores, gauges and ranking numbers is untouched. `decisions/goal-intent-fields/0003-…` d1; reciprocal pointer in `decisions/second-brain/0006-the-proposal-loop.md` (+1/−0, still `Accepted`).
- **A harness instrument shipped alongside**: `test/test.js` now prints a per-suite `H-class: n executed / m skipped` roll-up for the three new suites, so a live class that silently skipped is visible in the summary instead of indistinguishable from a real pass (OPEN.md #104/#106). Specified in test plan #1 (`:9`, `:129`).

**What did not ship:** no new screen, no new route, no new endpoint, no new dependency, no new design token, no firmware change, no production promotion.

## 2. Epics & stories rolled up

### Epic: `goal-intent-fields` (`epics/goal-intent-fields.md`, `Status: Active`)

| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 store-the-four-when-a-goal-is-captured-or-updated | `INTENT_FIELDS` + pure `pickIntentFields()`; applied at the three constructing write paths; `GOAL_SCHEMA` gains the four declarations | Done | `reviews/goal-intent-fields/1-…md` — PASS 2026-07-26 |
| #2 return-the-four-on-every-read-surface | `parseGoalRow` extended; pure `projectIntentFields()`; spread into four response literals in `src/api/brain/index.js`; three literally-named terms in `src/lib/brain/direction.js` | Done | `reviews/goal-intent-fields/2-…md` — PASS 2026-07-27 (after one Gate-5 kick-back on an accuracy defect in the review's own prose) |
| #3 show-the-four-on-the-goal-screens-that-already-exist | `ui/src/utils/goalIntent.js` (one pure formatter module); edits to Goals, GoalDetail, Proposals; one CSS declaration | Done | `reviews/goal-intent-fields/3-…md` — PASS 2026-07-27 |

All three ran the full five phases with every judged gate. The epic is `Active` because retirement is per-epic and happens at epic close-out, not here.

**Gate record (from `journal.md`, 47 entries):** 3 HALTs · 8 KICK_BACKs · 5 ANSWERs · 17 APPROVEs · 14 INFOs. Gate 1 alone ran four rounds on story #1, three on story #2 and two on story #3. One Gate-2 APPROVE was **voided by the Director for broken blinding** and re-run on a clean spawn (journal `2026-07-27T02:49:44Z`).

## 3. As-built inventory

Derived from the diff (`git diff e75d738b..HEAD -- src/ ui/ test/ tests/`: 15 files, +4 549 / −18) and re-verified against the running stack.

**User-facing**

- **Goals list** (`ui/src/pages/brain/Goals.jsx`, +12) — each row gains one `·`-separated line (`Could run on its own: … · Needs you: … · Too big as it stands: …`) and one prompt-excerpt line.
- **Goal detail** (`ui/src/pages/brain/GoalDetail.jsx`, +13) — four `brain-detail-field` paragraphs; the prompt renders in full with `white-space: pre-wrap`.
- **Proposals** (`ui/src/pages/brain/Proposals.jsx`, +15/−2) — the nominated goal's four on the card; `passedOver` runners-up unchanged at their exact three keys.
- **No new screen or route.** `git diff -- ui/src/App.jsx ui/src/Layout.jsx` is **0 lines** (verified here).
- **No editing affordance anywhere.** The goal screens contain no form, input, textarea or submit handler (verified here). The four are *set* through the write endpoints — reached from an assistant session or the generic element record editor — and *shown* on these screens.

**Endpoints (shape changes, all additive)**

| Endpoint | Change |
|---|---|
| `GET /api/brain/goals` | each goal gains `prompt, chanceOfSuccess, needsHumanInput, needsBreakdown` |
| `GET /api/brain/goals/:slug` | the goal object gains the four (this goal's own, never the parent's) |
| `GET /api/brain/orient` | `served` gains the four; `roots` and `ancestry` deliberately do **not** |
| `GET /api/brain/proposals` | the card gains the four for the nominated goal; `passedOver` deliberately does **not** |
| `GET /api/brain/direction/:slug` | `terms` gains `prompt, needsHumanInput, needsBreakdown` (the estimate was already there) |
| `POST /api/normalize/note-goal-idea`, `create-child-goal`, `update-goal-intent` | accept the four as body keys under the concept's own names |

Verified live from inside the container at close: `GET /api/brain/goals` returns **31 goals, all four keys present on every one** (7 carrying an estimate, 5 storing `needsHumanInput: false` explicitly, 23 reading `null`, 1 carrying a prompt); `terms` on the Direction endpoint carries all eight keys; `orient.roots[0]` carries exactly `{slug, name, standing}`; the proposal card carries the four and `passedOver` carries exactly `{goal, goalName, whyNot}`.

**Domain**

- Concept touched: `39998:<TA>:tapestry-owner-goal` — **adopted, not redefined**. No concept added, none redefined, no property invented; all four were already declared on the live schema node.
- `GOAL_SCHEMA` in `src/api/normalize/index.js` gains four property declarations (what a *fresh* instance self-provisions). `required` and `x-tapestry.unique` untouched.
- **Firmware reinstall: not required**, and the reason is recorded identically in all three ADRs — the goal concept is runtime-created and has never been firmware-seeded (no goal concept under `firmware/versions/*/concepts/`). `firmware/` is untouched in the diff (verified here).

**Data & contracts**

- `pickIntentFields(input)` — write side; copies verbatim; `undefined` is the *only* omission test; absence is expressed by **not writing the key**.
- `projectIntentFields(record)` — read side; always returns all four keys; present ⇒ verbatim, absent ⇒ `null`.
- The write/read asymmetry (key-absence vs `null`) is deliberate and documented at both functions: key-absence is the only representation of "unset" that survives storage, export and restore, and restore writes an export's section back verbatim — so a value invented at the export layer would become permanent.
- `src/lib/brain/direction.js` names its three fields **literally** because the module is pinned dependency-free by `operational-direction` S1 and cannot import `INTENT_FIELDS`. A comment says so. **This is a standing hazard** — see §6.
- Test surface: three new Node suites (`test/store-the-four-…`, `return-the-four-…`, `show-the-four-…`) and one Playwright spec (`tests/brainstorm/goal-intent-screens.spec.js`, 8 tests, fully network-mocked). One existing pin re-aimed (`test/the-brain-survives.test.js` S7, from a 4 000-char byte window to the file's own pre-existing `fnBody()` structure-bounded helper — OPEN.md #109).

**Hygiene checks run here, all clean:** no package/lock change; no `console.log`/`TODO`/`FIXME`/`debugger` added to `src/` or `ui/`; no real TA pubkey literal anywhere in the diff. The two 64-hex constants in the browser spec (`tests/brainstorm/goal-intent-screens.spec.js:77-78`) are **synthetic mock fixtures** in a fully `page.route`-mocked spec, matching four existing precedents in the same directory; handles are built as `39999:${TA}:slug`, i.e. `kind:pubkey:slug` form. The house rule on runtime TA resolution is not engaged.

## 4. Deviations from intent

Anchor = the acceptance frame in `book.md` → `### Acceptance frame`, decomposed verbatim from the goal's `deliverable` and `boundary`.

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | *"all four come back on **every** surface that shows a goal"* | Three goal-showing payloads carry **none** of the four: orient's bounded `roots` slice, `ancestry`, and the proposal card's `passedOver` runners-up. The Direction envelope's `chain` and `blindSteps` are likewise closed to goal content. | interpretation | ADR 0002 d6 — `roots`' boundedness is a ratified property (second-brain ADR 0005 d11); `ancestry`/`passedOver` name *other* goals; a goal field in `blindSteps` would break the boundary judge's blinding contract. | A session reading orient's root list, a goal's ancestry, or a proposal's runners-up sees no intent fields for those goals and must read each goal individually. | — (ratified; recorded so "every" is not read as absolute) |
| 2 | *"I can **set** any of the four … when capturing or updating a goal"* | Settable through the three constructing write endpoints and the record-replacing paths. **No field-level control exists on any goal screen.** | interpretation / deferred | Story #3 → *Out of scope: any editing affordance*; the frame's *"no new screen is built"* ceiling. | The owner sets the four in conversation with an assistant or through the generic element record editor — not on the screens where they are now displayed. | Whether a set-from-the-screen affordance is wanted is a product question this book never asked. |
| 3 | Epic guardrail: absence is *interpreted* at the screen using the concept's declared defaults | On Goals and Goal detail a never-set estimate renders **`0 out of 100`**, indistinguishable from a stored `0`; both flags render **`no`** whether stored `false` or never set. | intentional-change (ratified) | AC2 + epic "declared defaults are interpretation-side" guardrail; ADR 0003 d2/d4. | The screens cannot distinguish *never estimated* from *estimated at 0*, nor *explicitly not blocked on you* from *never flagged*. The read surfaces and the export **do** keep the distinction. | Product decides whether the distinction should be visible. |
| 4 | AC2 read literally — the never-set estimate shows `0` on each projecting screen | On the **Proposals card** it renders in words: *"no — you haven't estimated this one"*. | interpretation, disclosed at the gate | ADR 0003 d2 — a screen-applied default is authored by nobody, so it falls **outside** the owner-authored scope the supersession was ratified in; widening it is the operator's lever, not the Architect's. | The estimate reads differently on the Proposals card than on the other two screens. | ADR 0003 Consequences → *"the single open lever"*: Option C (widen the ratification, one formatter) or Option B (words everywhere). Operator's call. |
| 5 | second-brain ADR 0006 d13/AC6 — *no numeric score, percentage, gauge or ranking number* in owner-facing proposal content | Superseded **narrowly**: an owner-recorded `chanceOfSuccess` may render as its number on the proposal card. | intentional-change | Operator ratification 2026-07-27 (epic decision 8); ADR 0003 d1; reciprocal `**Amended by:**` pointer added to 0006 at +1/−0 with `Status: Accepted` unchanged (verified here). Narrowness demonstrated mechanically: `the-proposal-loop` S11/S13/H2 pass **unmodified**. | A number now appears on a proposal card where the design principle said none ever would. | **The second-brain style guide still says a numeric score never appears in owner-facing copy in v1.** Engineering may not write into `product-team/`; the guide is the product team's to update. (ADR 0003 Consequences.) |
| 6 | `book.md` → *"One thing this book closes about itself"* — the Direction endpoint should stop needing its raw-record estimate workaround | The workaround is now **unnecessary** but still **present**, and `src/lib/brain/direction.js:91` still ships the sentence *"the goals read API drops it (parseGoalRow)"* — **now false**, verified: `GET /api/brain/goals` returns `chanceOfSuccess`. | deferred | ADR 0002 debt (a): editing a closed book's shipped constant is exactly what kicked this epic back twice. Governance restraint, not a test constraint — the completion report's earlier claim that `U28` pins the sentence was itself corrected; `U28` asserts only that the block names the dependency slug and `dependsOn`. | A session or Director reading the Direction envelope's `unavailable` block is given a stale reason. | Retire the workaround and correct the sentence — a follow-up, not a defect in what shipped. |
| 7 | Out of scope by the epic's own words: OPEN.md row 102 (the schema `required` defect) | Repaired **on the local stack only**, as a Stage-0 unblock on explicit operator instruction; the same defect presumably stands on staging and production. | constraint-discovered | journal `2026-07-26T18:08:09Z` — operator chose "repair the schema, then run on a green baseline"; recorded as live-data repair, not book scope. Exactly one field moved (`required`: 4 entries → 3); all 12 properties, `x-tapestry.unique` and the d8 fold verified unchanged after the write. | On deployed instances a goal without `chanceOfSuccess` is still schema-invalid. | **Row 102 stays OPEN and must not be closed on this book's account.** |
| 8 | Story #1 criterion 4 — *a fresh instance declares all four* | `GOAL_SCHEMA` grows by four declarations, covered by three decomposed assertions, all green. **No test provisions a concept-less instance**, and the scratch-instance drill that would prove it end to end was deliberately not run. | deferred (stated residual) | Review #1 verdict records the residual and judges it acceptable; the drill journals a durable record into the live brain and boots a second container. | Unproven end to end on a genuinely fresh instance. | Named by review #1 as a **book-close item**; carried in §6. |
| 9 | Operational-mode ceiling: staging is the hard limit | Merged to `staging` (`c0565e15`, deploy run 30313783862, success). **Not on `main`** — `origin/main` is `f7ff5392` and `git merge-base --is-ancestor HEAD origin/main` returns false (verified here). | intentional (mode ceiling) | Operational Direction; the operator asked for `/cycle-prod` earlier and the Director declined (journal `2026-07-28T01:45:00Z`). | The owner cannot see any of this on production. | Promotion is the operator's call. |
| 10 | Frame: *all four come back on every surface* — verified where? | Verified **end to end on local live data**. On **staging**, verified only to *correct gating + byte-identical bundle*: all five brain read endpoints return `403 Owner access required` and the served bundle is `assets/index-EZ-5jXBH.js` (both re-verified here against `staging.brainstorm.world`), which is present in the local `dist/`. The owner-gated JSON could not be read on staging. | constraint-discovered | Reading it there needs a signed-in session or in-container access; droplet SSH is outside this run's ceiling. | The staging behaviour of the read surfaces rests on bundle identity plus local evidence, not on a staging read. | A staging read (or a signed-in check) would close it. |
| 11 | Knowingly surrendered: baseline commit, pinned governing versions | Stated verbatim with the endpoint's own reasons in `book.md`'s generated section; not silently dropped. | intentional (mode) | Operational mode trades reproducibility for operational cost; armed mode retains both. | Nobody can reconstruct which Director ran under which rubric for this book. | Accepted property of the mode. |

**`dependsOn` / prerequisites** — the eligibility endpoint's other `unavailable` entry. **Still unavailable**, exactly as `book.md` predicted at open. Not one of the four, never in scope, and reported here as still-unavailable rather than as a miss — which is what the book asked for.

**Undocumented work — none found.** Every file in the diff traces to a story, an ADR or a test plan:
- `test/test.js` H-class roll-up lines → test plan #1 `:9` / `:129` (OPEN.md #104/#106).
- `test/the-brain-survives.test.js` S7 re-aim → test plan #1 *"Sibling pins"* (`:10`, `:226`, `:232`); uses `fnBody()`, which already existed in that file at `:212`.
- `ui/src/styles.css` +1 → ADR 0003 d8.
- `decisions/second-brain/0006-…` +1 → ADR 0003 d1 (reciprocal pointer).

## 5. Quality state at close

**Test gate, run by the Reviewer at close** — `{ npm test; echo "EXIT=$?"; } > log 2>&1`, brace form per OPEN.md #111. **The verdict is read from the log, never from the notification — and this run reproduced the lying notification live: the background completion event reported "exit code 0" for a run that ended `Overall: FAIL` with an echoed `EXIT=1`** (another occurrence of the OPEN.md #103/#105 signature; row 111 had it at nine when this book began).

**Result: `Overall: FAIL`, `EXIT=1` — one failing suite, and the failure is caused by this close-out, not by the book.**

| | |
|---|---|
| `Overall:` | **FAIL** |
| echoed `EXIT=` | **1** |
| Failing suite | `harness-lint` — **31 passed, 1 failed**. Every other suite `PASS`. |
| Total skipped | 51 |

**The one failure, named exactly:**

```
VIOLATION L2 engineering-team/epics/goal-intent-fields.md
  — book engineering-team/audits/store-and-show-the-prompt-and-the-estimate/book.md
    is Closed but this epic is 'Active'
```

`harness-lint` L2 is *"a Closed book ⇒ every epic it lists is Done"* (`scripts/harness-lint.sh:126-150`). It fired the moment step 9 of this workflow flipped `book.md` to `Closed` while `epics/goal-intent-fields.md` still reads `**Status:** Active`. It is **deterministic**, fully explained, and **not** a defect in anything this book shipped. It is also **not** OPEN.md row 75's flake — see below. **It is not resolved here**; see §7 P14 and the note at the end of this section.

**Everything the book itself is responsible for is green, and the live classes genuinely ran:**

| Suite | Result | H-class |
|---|---|---|
| `store-the-four` | **PASS** — 40 passed, 0 failed, 0 skipped | **11 executed / 0 skipped** |
| `return-the-four` | **PASS** — 54 passed, 0 failed, 0 skipped | **8 executed / 0 skipped** |
| `show-the-four` | **PASS** — 37 passed, 0 failed, 0 skipped | **5 executed / 0 skipped** |

**OPEN.md row 75's flake did NOT fire this run** — `relationship-primitives` 23/0/0 and `relationship-primitives-probe` 9/0/0, both `PASS`. Stated explicitly rather than left to inference, because the whole point of row 75 is that a red at this gate has two very different meanings and a bare colour hides which one you got. This red is the other kind.

Log: `/private/tmp/claude-501/.../scratchpad/npm-test-close.log` (scratch, not committed — the book's eleven committed evidence logs live under `audits/store-and-show-the-prompt-and-the-estimate/`).

**What has to happen before this close is committed.** The epic shipped to the shared line on 2026-07-27 (`c0565e15`), so its close-out under `workflows/5-review.md` → *Epic close-out* is already owed: set `**Status:** Done` on `epics/goal-intent-fields.md` and `git mv` the three `goal-intent-fields/` folders (stories, decisions, reviews) under `done/`. **The Reviewer deliberately did not do it here** — `workflows/6-book-close.md` does not list it, the folder moves would invalidate every `stories/goal-intent-fields/…` path reference in this audit, in `book.md`, in the three reviews, in the completion report and in `journal.md`, and a cross-cutting rename during a close is the operator's call, not a silent side effect of it. The alternative — leaving the book `Open` — is worse: it would hide a completed book to keep a lint green.

**Browser gate.** Not re-run at close. `npm test` **cannot** fail on a browser-level defect (OPEN.md #114), so the Node result above is not evidence about the screens. The screen evidence of record is Gate 4's committed `gate4-green-story3-browser.log` (8 tests ran, 8 passed) plus review #3's independent run, and — the strongest instrument in the book — review #3's rebuild of the committed `ui/` tree into a scratch directory and `diff -rq` against the served `dist/`, confirming the browser class measured the committed diff rather than a stale bundle.

**Known open issues / accepted bugs**

- **OPEN.md #102** — goal schema `required` carries `chanceOfSuccess` on staging and production. **Not closed by this book.**
- **OPEN.md #75** — global strfry scan-count brackets, measured at a **~40% spurious-red rate** at Gate 4 across ten runs of this branch (fired in 4, green in 6).
- **OPEN.md #104/#106, #109, #111, #112, #113, #114** — all touched by this book; #112–#114 were *filed* by it.
- `src/lib/brain/direction.js:91` ships a now-false sentence (§4 #6).

**Debt logged by ADRs, rolled up**

- ADR 0001: (a) a wrong-typed value (`chanceOfSuccess: "75"`) is stored as supplied — undefined by design; (b) `GOAL_SCHEMA` drift vs the live schema node is invisible because `ensureGoalConcept` no-ops on any instance that already has the concept — a checker comparing the two is a natural later addition; (c) `save-element-json` / `set-json-tag` remain ungated wholesale-replacement hatches (pre-existing, unwidened).
- ADR 0002: (a) the stale `UNAVAILABLE` sentence (§4 #6); (b) a stored explicit `null` is indistinguishable from never-set on the projecting surfaces (inherited; the export still distinguishes them); (c) `INTENT_FIELDS` is exported unfrozen.
- ADR 0003: (a) `brain-goal-hint` now carries two meanings on a Goals row; (b) a 6 155-character prompt renders in full on the detail page with no collapse affordance; (c) the two-formatter estimate split is a per-screen inconsistency the owner may notice; (d) `ConceptElements.jsx`'s 80-character JSON preview means the generic element **list** shows the four only as truncated JSON.

## 6. Carry-forward register

- [ ] **BLOCKS THIS COMMIT — the `goal-intent-fields` epic close-out.** `harness-lint` L2 is red until `epics/goal-intent-fields.md` reads `**Status:** Done`, and `workflows/5-review.md` pairs that flip with three directory `git mv`s under `done/` that will invalidate path references across this book's own artifacts. (§5, §7 P14)
- [ ] **A staging (or signed-in) read of the five brain surfaces** — the one frame bullet verified there only to gating + bundle identity. (§4 #10)
- [ ] **Promote to production, or decide not to.** Nothing is on `main`. (§4 #9)
- [ ] **OPEN.md row 102 on staging and production** — the local repair does not travel. Row stays OPEN. (§4 #7)
- [ ] **Retire the Direction endpoint's raw-record estimate workaround and correct `direction.js:91`'s now-false sentence.** (§4 #6, ADR 0002 debt (a))
- [ ] **The `direction.js` literal-field hazard**: that module is pinned dependency-free and cannot import `INTENT_FIELDS`; a fifth intent property added later will be missed there silently. A pin that asserts the two lists agree would close it. (journal `2026-07-27T07:39:02Z`; ADR 0002 implementation notes)
- [ ] **`GOAL_SCHEMA` vs the live schema node** — no checker compares them, and the drift this book closed was invisible for exactly that reason. (ADR 0001 debt (b))
- [ ] **A fresh-instance drill for story #1 criterion 4** — the only acceptance criterion in the book without end-to-end evidence. (§4 #8)
- [ ] **The estimate's two-formatter split** — the operator's open lever: widen the supersession (Option C) or unify in words (Option B). (§4 #4)
- [ ] **The second-brain style guide's "no numeric score in owner-facing copy" rule** now has a ratified exception and is out of date. Product's to update; engineering may not edit `product-team/`. (§4 #5)
- [ ] **Whether an editing affordance for the four belongs on the goal screens** — the four are now visible where they cannot be set. (§4 #2)
- [ ] **Whether stored-`false` should be distinguishable from never-set at the screen**, and stored-`0` from never-estimated. (§4 #3)
- [ ] **A collapse affordance for very long prompts** on the goal detail page. (ADR 0003 debt (b))
- [ ] **`ConceptElements.jsx`'s 80-character JSON preview** leaves the generic element list showing the four unusably. Deliberately left alone; recorded so it is not mistaken for a gap. (ADR 0003 debt (d))

## 7. Process findings (harness)

Harvested from `journal.md` (47 entries), the three reviews' *Harness friction* sections, the two stories' `## Deviations` logs, and the book's `meta` rows. **Every finding carries exactly one terminal state.**

**Measurement first, per step 7.** `scripts/harness-stats.sh`, run at retro time: 762 phase commits repo-wide, **15 attributed to `goal-intent-fields`**; 145 reviews decided, kick-back rate **1%**, re-review churn **2**; books open 3 / closed 26; this book **1d open→close**. **The instrument reports this book at zero kick-backs and zero churn** — which is finding **P8** below, not a fact about the run.

| # | Finding | Source | Terminal state |
|---|---|---|---|
| P1 | **Three independent structural channels defeat prompt-level judge blinding**, and no amount of careful spawn-prompt wording closes them: (a) artifacts carry `Supersedes: … KICK_BACK` text (story #1 `:14-16`); (b) Director commit subjects name gate outcomes (`journal: Gate 1 KICK_BACK …` ×8 in `git log`); (c) **the Gate-1 rubric *requires* the epic file**, which is not on the blinding-safe input list and accumulates run history by design (`epics/goal-intent-fields.md` `:38-51` carries "re-bounded twice", "returned by Gate 1 twice", and a whole prior-verdict section). A fourth, milder instance: ADR 0002 itself contains *"this epic has already spent two Planning rounds on it."* Every Gate 1 spawn in this run had (c). | journal `2026-07-27T02:49:44Z`, `09:42:22Z` | **OPEN.md `meta` row — drafted, not inserted** (see §7a, row A). File held by a concurrent session. |
| P2 | **The "frame section only" instruction to judges is unenforceable at the tool layer.** Three consecutive judges disclosed that a `grep -A 80` on `book.md` pulled the adjacent generated Direction-mode block. Harmless here (goal-derived terms only, no progress or budget state), but it is a structural leak, not a wording problem. | journal `2026-07-27T03:00:21Z` | **Folded into §7a row A** — same class as P1(c): blinding enforced by instruction over a shared filesystem. |
| P3 | **A ~40% spurious-red rate at Gate 4**, now measured rather than anecdotal: across **ten** full runs of this branch the `relationship-primitives` pair fired in **4** and was green in **6**. The cost is not the 25-minute re-run; it is that a two-in-five false positive trains whoever runs the gate to expect red and shrug, converting a mechanical check back into a judgement call. | journal `2026-07-27T19:13:14Z`; review #2 friction #2 | **OPEN.md row 75 — append drafted, not inserted** (§7a, row 75-append). Row 75 already exists and is the operator's to update. |
| P4 | **Source-level tests cannot fail on a screen that renders nothing.** The Gate-3 judge built the counterexample: ADR-faithful formatter, imported into all three screens, all four properties named, every formatter *called*, **no result rendered** — Node suite **37 passed / 0 failed**, owner sees a blank screen. | journal `2026-07-27T12:54:53Z`, `15:13:43Z` | **OPEN.md row 113** — filed and committed at HEAD. |
| P5 | **`npm test` cannot fail on a browser defect, and nothing says so at the point of use**, plus two adjacent edges (`tests/global-setup.js` throws rather than skipping; the panel serves `dist/`, so a `ui/src` edit is invisible until rebuild). | test plan #3 § *Harness defects*; journal `15:13:43Z` | **OPEN.md row 114** — filed and committed at HEAD. |
| P6 | **`roles/reviewer.md` presents the test gate as `npm test` *or* Playwright**, where for any story with a browser-visible surface the two gates are **conjunctive** — 37/0 on a build that renders nothing was exactly P4. It is the first file every Reviewer reads. **Citation correction:** review #3 and the journal both cite `roles/reviewer.md:22`; the line is **`:21`** (verified). | review #3 friction #1; journal `2026-07-27T20:36:26Z` | **OPEN.md row 114 — append drafted, not inserted** (§7a, row 114-append). Review #3 consciously declined to file it because the file was held; this discharges that. |
| P7 | **False reports of completed actions, and the run's own tally of them is wrong.** Journal `:544` says *"four false reports of completed actions in this run — three from roles, four from me"* — which does not sum. The **checkable** inventory: **two role-originated** (the Reviewer's vacuous-`D13` claim; the Architect's "reciprocal pointer added" claim) and **two Director-originated** (four commit messages claiming an evidence log was committed while `.gitignore` swallowed it; amplifying the Reviewer's false claim into a commit subject and an operator report). *"Three from roles"* is not substantiated anywhere in the journal. Every one was checkable in under a minute; every one was caught, two of them by the party that made them. | journal `2026-07-27T05:13:51Z`, `08:58:28Z`, `10:20:00Z` | **OPEN.md `meta` row — drafted, not inserted** (§7a, row B). |
| P8 | **`scripts/harness-stats.sh` is blind to Direction-mode gate outcomes.** It parses review verdict files and phase-commit subjects only — no awareness of `journal.md`, gates, KICK_BACKs or HALTs (verified: no such string in the script). It therefore scores this book at **kick-back rate 0, churn 0** while the journal records **8 gate kick-backs and 3 halts**, and all three reviews passed first time. Step 7 tells the retro to *"run on measurement rather than anecdote"* using this instrument; for Direction books the instrument systematically under-reports rework. | this audit, §7 measurement paragraph | **OPEN.md `meta` row — drafted, not inserted** (§7a, row C). |
| P9 | **"Journaling is not recording."** A ratified answer must land in the epic's decision list at the moment of ratification. This failed **three times** in one run; the third time an operator ratification lived only in the journal, which no role reads, and an Architect would have reached Gate 2 mandated into a collision with a live `Accepted` ADR and no recorded authority. The epic now carries it as a *practice* (`epics/goal-intent-fields.md:73-75`) — but that is a per-epic file no future run reads, and `roles/director.md` carries no such rule (verified). | journal `2026-07-27T09:51:22Z`, `10:05:14Z`; `epics/goal-intent-fields.md:60-75` | **OPEN.md `meta` row — drafted, not inserted** (§7a, row D). |
| P10 | **`.gitignore`'s `*.log` silently swallowed every evidence log**, and `git add` reported success each time because the other files in the command were fine. Four commit messages consequently made a false claim about the permanent record. Fixed by force-add (`a67571f8`, all five logs, 18 187 lines); `.gitignore` deliberately not edited (the rule is correct, and it is outside the Director's lane). | journal `2026-07-27T05:13:51Z`; `book.md` → *Record corrections* | **Folded into §7a row B** — same class as P7: a silent-success command believed rather than checked. |
| P11 | **Gate judges are reliable on verdicts and unreliable on incidental claims.** **Two** asides in this run were factually wrong and each was disproved by reading source: that `create-element`'s no-json branch auto-populates the four with type defaults (it yields an empty section and never descends), and that re-import from the relay is unreachable from any screen (four screens post to it). Both sat inside sound verdicts, and both are recorded in the epic so no one designs around them. *(Distinct and in the judges' favour: judges also caught several **artifact** inaccuracies — the ADR's "grep returns exactly four hits" where it returns seven lines, and its 6-of-8 `needsHumanInput` corpus count where a live read gives 5-of-8. Those are the instrument working, not failing, and this audit's own live read confirms 5.)* The practice the epic established — *a gate verdict binds; the incidental claims inside it are unverified until checked against source* — is the right one and was applied without exception. | journal `2026-07-26T19:30:00Z`, `20:06:16Z`; `epics/goal-intent-fields.md:129-145` | **Declined** — the standing practice is already recorded in the epic and was followed without exception; no amendment is proposed and the failure mode caused no defect that reached an artifact. |
| P12 | **A Direction run's completion report is written by the least neutral party**, and this one led with a false claim (live corpus values attributed to write paths that did not exist when those values were signed). | journal `2026-07-28T01:40:00Z`; `completion-report.md` § *On this report's calibration* | **Declined** — the existing control worked: the blinded completion audit caught it on round 1, the correction is recorded verbatim in the report rather than absorbed, and book close is already the Reviewer's at book scope. **Residual named:** the report was *presented to the operator* only after the audit, so the control's coverage depends on the Director choosing to run it; nothing in the workflow requires the audit before the completion offer. |
| P13 | **Three near-misses where a green or red signal would have lied**, each caught by asking *why* rather than *that*: a notification reporting "exit code 0" with no relation to the verdict (review #1 records three occurrences in its own session; the Stage-0 baseline was another); four Playwright projects failing at launch because only chromium's browser is installed, which could have been read as the Gate-3 RED; and a spec that runs **zero** tests also exiting 0 — checked by comparing *"Running 8 tests"* against *"8 passed"*. | journal `2026-07-26T18:02:30Z`, `2026-07-27T15:13:43Z`, `19:13:14Z` | **OPEN.md rows 103/105/111** — the exit-code class is already filed and row 111 already names the working brace form, which this run used throughout. The zero-tests-also-exits-0 check is folded into §7a row 114-append. |
| P14 | **Closing a book makes an epic close-out mandatory, and the book-close workflow never says so — so the close-out gate cannot be green when it is run.** `harness-lint` L2 (*"a Closed book ⇒ every epic it lists is Done"*) fires the instant `workflows/6-book-close.md` step 9 flips `book.md` to `Closed`, but that workflow has **no step for the epic close-out** and never mentions L2; the close-out lives in a different workflow (`5-review.md`) and is triggered by a different event (the epic's merge to the shared line). Step 8 then tells the same Reviewer to run `npm test` and record the result — which is now guaranteed red by step 9. **Discovered by running the gate at this close**, and it is not a one-off: it will fire on *every* book close where the epic close-out has not already happened. It is also not merely a bookkeeping annoyance — the close-out includes three directory `git mv`s that invalidate every `stories/<epic>/…` path reference in the book's own audit, `book.md`, its reviews, its completion report and its journal, so it is a cross-cutting rename that wants an explicit decision rather than a silent side effect of a close. | this audit §5; `scripts/harness-lint.sh:126-150`; `workflows/6-book-close.md` steps 8–9; `workflows/5-review.md` § *Epic close-out* | **OPEN.md `meta` row — drafted, not inserted** (§7a, row E). |
| P15 | **Ports to the human-gated flow?** Asked per finding, per step 7: **P4, P5, P6, P13 port directly** — they are properties of the test harness and the Reviewer role, not of Direction mode, and any human-gated UI story has the same holes. **P1, P2, P8, P9 are Direction-specific** (blinding, journal-vs-artifact, Direction-mode measurement). **P7, P10 port** — a role or a human reporting a completed action unchecked is flow-independent. **P3 and P14 port** — row 75 bites any full-gate run, and L2 fires on any Closed book regardless of which flow produced it. | this audit | **Recorded here**; the porting judgement is carried in each drafted row's text. |

### §7a — OPEN.md rows drafted but not inserted

`OPEN.md` is currently held by a concurrent session: it carries an uncommitted row 115 and an untracked `product-team/discoveries/second-brain-prior-art.md`. Neither was touched. **The dispositions above are recorded; the mechanical insertion is pending.** These are paste-ready.

*(Numbering assumes 115 is the highest existing row. Renumber on paste if the concurrent session has added more.)*

**Row A — new (116):**

~~~
| 116 | meta | **Prompt-level judge blinding is defeated by three structural channels that no spawn-prompt wording can close.** In `store-and-show-the-prompt-and-the-estimate` the Director voided a Gate-2 APPROVE for broken blinding and then found the leak is not only carelessness: (a) **artifacts carry gate history** — a story's `Supersedes: … KICK_BACK` line, and ADR 0002's own *"this epic has already spent two Planning rounds on it"*; (b) **commit subjects name gate outcomes** — eight `journal: Gate N KICK_BACK …` subjects sit in `git log` for any judge that runs it; (c) **the Gate-1 rubric REQUIRES the epic file**, which is not on the blinding-safe input list and accumulates run history by design (kick-back counts, prior-verdict summaries) — so Gate 1 cannot be run to rubric without handing the judge prior verdicts. Every Gate-1 spawn in that run had (c). A fourth, milder instance: three consecutive judges disclosed that `grep -A N` on `book.md` pulls the adjacent generated Direction-mode block — the "frame section only" instruction is unenforceable at the tool layer. **Why it matters:** the blinded gate is the single strongest control in Direction mode, and its enforcement is currently by instruction over a shared filesystem. **Candidate fixes:** put gate history somewhere no rubric requires a judge to read (a per-run journal, not the epic file); have Gate 1 check the epic's existence via a derived assertion rather than by handing over the file; or accept that blinding is best-effort and say so in `roles/director.md` rather than treating a leak as a protocol breach. Goalpost-class — frozen mid-run by design, so it lands here. | 2026-07-27 (store-and-show book close, audit §7 P1/P2) | OPEN | | `engineering-team/audits/store-and-show-the-prompt-and-the-estimate/journal.md` 2026-07-27T02:49:44Z + 09:42:22Z; `engineering-team/roles/director.md` :87; `engineering-team/epics/goal-intent-fields.md` :38-51. |
~~~

**Row B — new (117):**

~~~
| 117 | meta | **Roles and Directors report actions as completed that were not, and every instance was checkable in under a minute.** Four in one book: the Reviewer claimed it caught a vacuous test that was not vacuous; the Architect reported adding a reciprocal ADR pointer to an unmodified file; the Director amplified the first into an immutable commit subject and an operator report; and `git add` on five evidence logs succeeded silently while `.gitignore`'s `*.log` excluded all five, producing four commit messages that falsely claimed a log was committed. **The shared shape is a silent success believed rather than checked** — `git add` does not error on an ignored path, and a role summarising *"the ADR specifies it"* compresses to *"added"*. **The sharper lesson, named independently by two agents within an hour:** conclusions that are right protect provenance that is wrong, because nothing downstream forces a re-read; the Director's own words were *"I verify what I expect to be wrong and accept what I hope is right."* **Candidate fix:** state in `roles/director.md` and the phase workflows that a claim of a completed file action is verified by `git show --name-status` / `git status --porcelain` before it enters a commit message or a report — the check is seconds and the record is immutable. **Ports to the human-gated flow unchanged.** Note: the source journal's own tally of this finding (`:544`, *"three from roles, four from me"*) does not sum; the checkable inventory is two role-originated and two Director-originated. | 2026-07-27 (store-and-show book close, audit §7 P7/P10) | OPEN | | `engineering-team/audits/store-and-show-the-prompt-and-the-estimate/journal.md` 2026-07-27T05:13:51Z, 08:58:28Z, 10:20:00Z; `book.md` § "Record corrections". |
~~~

**Row C — new (118):**

~~~
| 118 | meta | **`scripts/harness-stats.sh` is blind to Direction-mode gate outcomes, so the retro's own instrument under-reports rework on exactly the books that generate most of it.** The script parses review verdict files and phase-commit subjects; it has no awareness of `journal.md`, gates, KICK_BACKs or HALTs. It therefore scored `store-and-show-the-prompt-and-the-estimate` at **kick-back rate 0, churn 0** — all three reviews passed first time — while that book's journal records **8 gate KICK_BACKs and 3 HALTs** across 47 entries. `workflows/6-book-close.md` step 7 instructs the retro to cite this script *"so the retro runs on measurement rather than anecdote"*; for a Direction book the measurement is structurally incomplete. **Candidate fix:** have the script parse `audits/*/journal.md` for `**Decision:**` lines and emit a per-book gate tally (APPROVE / KICK_BACK / HALT / ANSWER) alongside the review verdicts. Cheap — the journal format is already uniform and greppable. | 2026-07-27 (store-and-show book close, audit §7 P8) | OPEN | | `scripts/harness-stats.sh`; `engineering-team/workflows/6-book-close.md` step 7; `engineering-team/audits/store-and-show-the-prompt-and-the-estimate/journal.md`. |
~~~

**Row D — new (119):**

~~~
| 119 | meta | **"Journaling is not recording" — a ratified answer must land in the epic's decision list at the moment of ratification, and nothing in the harness enforces it.** This failed three times in one book. The third occurrence was the worst: an operator-ratified supersession of a live `Accepted` ADR lived only in the Director's journal, which no role reads — so an Architect would have reached Gate 2 mandated by the story into a collision with that ADR and with no recorded authority to resolve it. The epic now carries the practice in its own words (*"a ratified answer is recorded in this epic's decision list at the moment of ratification, with its provenance"*), but that is a per-epic file no future run reads, and `roles/director.md` carries no such rule. **The failure mode in one line:** treating "I have decided something" as equivalent to "the artifacts know it." **Candidate fix:** a rule in `roles/director.md` — an ANSWER journal entry is not complete until the answer is written into the epic's decision list, with provenance, in the same commit. Ports to the human-gated flow, where the Product Owner plays the same role. | 2026-07-27 (store-and-show book close, audit §7 P9) | OPEN | | `engineering-team/audits/store-and-show-the-prompt-and-the-estimate/journal.md` 2026-07-27T09:51:22Z + 10:05:14Z; `engineering-team/epics/goal-intent-fields.md` :60-75; `engineering-team/roles/director.md`. |
~~~

**Row E — new (120):**

~~~
| 120 | meta | **Closing a book makes an epic close-out mandatory in the same breath, and `workflows/6-book-close.md` never says so — so its own test gate is guaranteed red when it is run.** `harness-lint` L2 (*"a Closed book ⇒ every epic it lists is Done"*, `scripts/harness-lint.sh:126-150`) fires the instant step 9 flips `book.md` to `Closed`; the workflow has no step for the epic close-out, never mentions L2, and step 8 then asks the same Reviewer to run `npm test` and record the result. Found by running the gate at the close of `store-and-show-the-prompt-and-the-estimate`: `Overall: FAIL`, `EXIT=1`, one violation, every other suite green. **Not a one-off** — it fires on every book close where the epic close-out has not already happened, and the epic close-out is triggered by a *different* event (the epic's merge to the shared line) in a *different* workflow (`5-review.md`). **Not merely bookkeeping either:** the close-out includes three directory `git mv`s that invalidate every `stories/<epic>/…` path reference in the book's audit, its `book.md`, its reviews, its completion report and its journal — a cross-cutting rename that wants an explicit decision, not a silent side effect of a close. **Candidate fixes, in increasing order of ambition:** (a) add an explicit step to `6-book-close.md` between the flip and the gate — *"if the book's epics have shipped, run the epic close-out first"* — and order the gate after it; (b) have L2 accept a Closed book whose epic is Done-but-not-yet-moved, decoupling the status flip from the folder move; (c) make the `done/` move link-safe, or stop moving folders and mark retirement by status alone. **Ports to the human-gated flow unchanged** — L2 does not care which flow produced the book. | 2026-07-27 (store-and-show book close, audit §7 P14) | OPEN | | `engineering-team/audits/store-and-show-the-prompt-and-the-estimate/audit.md` §5 + §7 P14; `scripts/harness-lint.sh` :126-150; `engineering-team/workflows/6-book-close.md` steps 8–9; `engineering-team/workflows/5-review.md` § "Epic close-out". |
~~~

**Row 75 — append (existing row, operator's to update):**

~~~
**Measured across ten full runs of one branch in `goal-intent-fields` (2026-07-27): the pair fired in 4 and was green in 6 — a ~40% spurious-red rate at Gate 4, whose entire value is being mechanical.** The cost is not the ~25-minute re-run; it is that a two-in-five false positive trains whoever runs the gate to expect red and shrug, converting a mechanical check back into a judgement call. Occurrences eight and nine also observed this book (a Gate-5 judge's run; the Gate-4 first run). **Did NOT fire on the book-close gate run.**
~~~

**Row 114 — append (existing row, filed by this book):**

~~~
**Two additions from the book close (2026-07-27):** (a) **`engineering-team/roles/reviewer.md:21`** reads *"test: `npm test` (or `npm run test:playwright`)"* — for any story with a browser-visible surface the two gates are **conjunctive**, not alternative, and 37/0 on a build that rendered nothing was exactly row 113's finding. It is the first file every Reviewer reads; suggested wording: *"run every gate the story's test plan names."* (Review #3 and the run's journal both cite this as `:22`; the line is `:21`.) (b) **A Playwright spec that runs zero tests also exits 0** — check *"Running N tests"* against *"N passed"*, not just the exit code. Both port to the human-gated flow unchanged.
~~~

---

## Verdict on the book

**The close-out gate is RED, for exactly one reason, and that reason is this close itself** — `harness-lint` L2, because the book now reads `Closed` while its epic still reads `Active`. Every other suite is green; all three of the book's own suites pass with their live classes executed; row 75's flake did not fire. The fix is the epic close-out, it is already owed since the staging merge, and it is deliberately left to the operator (§5, §7 P14). **Nothing about this red is a defect in what shipped.**

**Closed, and the record is broadly accurate.** Every frame bullet is satisfied by shipped code that I re-verified against the running stack rather than harvesting from the run's own report. The three places the record could have overstated itself — the corpus-provenance claim, the `U28` pin claim, and the "four brain endpoints" count — were each caught and corrected *inside* the run and are preserved in the report rather than smoothed away, which is the behaviour an audit should reward.

**Where the record is still loose**, in descending order of consequence:

1. **The word "every" in *"all four come back on every surface that shows a goal"* is not literally true**, and the completion report certifies it under bullet 3 with the exclusions listed beside it. That placement is right and was itself a correction. But the frame bullet reads as satisfied in the summary table, and it is satisfied *as ratified*, not *as written*. §4 #1 states it plainly.
2. **Bullet 3 on staging rests on gating plus bundle identity, not on a read.** The report says so; the summary tables elsewhere in the record do not carry the qualification. §4 #10.
3. **The journal's own count of false completion reports (`:544`) does not sum**, and *"three from roles"* is unsubstantiated. §7 P7.
4. **`roles/reviewer.md:22` is cited twice for a line that is `:21`.** §7 P6.
5. **`harness-stats.sh` scores this book at zero kick-backs**, which is the instrument's blindness, not the run's record. §7 P8.

None of these changes what shipped. All five are corrections to how the run describes itself, which is the thing this audit exists to get right.
