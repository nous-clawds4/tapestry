# Build Audit: Add a Concept to a Tapestry

**Book:** `engineering-team/audits/add-a-concept-to-a-tapestry/book.md`
**Date:** 2026-07-28
**Branch / commit range:** `db7c5a7a..f10b53f5` on `feat/add-a-concept-to-a-tapestry` — code merged to `staging` as `ac09d591` (PR #476, head `ff85bd43`); exactly **one** commit is post-merge and branch-local (`f10b53f5`: the completion report + the Stage-2/3 journal tail), plus this close commit.
**Provenance:** Acceptance-frame — **operational Direction, goal-derived**. The frame was transcribed by `GET /api/brain/direction/<slug>` from the owner-ratified goal at open (anchor distance 0), not hand-authored and not reconstructed at close.
**Confidence:** **high** for what shipped and for local behaviour (the deliverable was exercised live on local, and re-verified at close); **medium** for staging (deploy, byte-identical bundle, and read-only rendering verified; no add was performed there — by rule); **n/a** for production (nothing promoted; verified untouched).

> The Build Audit is the **as-built record** — what the product *is* now, factual and source-linked. It does not propose changes; that is the seed's job.

**Who wrote this, and why it is not the Director.** The Director directed this run and answered every gate. This audit is written by the Reviewer at book scope; every claim below that could be checked mechanically was re-checked here rather than harvested — the live relay state, the staging bundle, the GitHub facts, the diff scopes, both isolated suites, and the full close gate. Where the run's record and reality disagree, §4, §5 and §7 say so (three places: several committed journal timestamps post-date their own commits; the strfry-CLI probe caveat did not reproduce; the previous book's drafted OPEN.md rows were found never inserted).

---

## 1. What shipped

One capability, delivered whole: **the instance owner can grow a Tapestry in place.**

- From the existing Exploration page (`/tapestry/tapestries/<uuid>`), the owner of the instance can add a concept that is not already a member of a Tapestry published under their own key or the assistant's (TA's), and after saving, the Tapestry — same uuid, same URL, one directory row — shows the new member to the owner and to every other session that opens it afterwards. `stories/done/tapestries/5-add-a-concept-to-a-tapestry.md`
- **Add-only is structural, not behavioural**: the replacement event is a verbatim copy of the live event plus exactly one appended member node + import (`buildAddConceptDraft`, `ui/src/pages/tapestries/tapestryDraft.mjs:102`). Title, description, `name` tag, authored integrations, unknown tags/fields, and tag order all pass through byte-identical; `created_at` is strictly newer so replacement can never tie.
- **A graph-less legacy Tapestry can now be grown**: the first add creates the minimal `graph` envelope (ratified at the Architecture gate as inside "adding only"), un-degrading the instance's only real tapestry (`b0b48b00`) — demonstrated live on local with the `cat` concept via the real assistant publish path.
- **The affordance is owner-strict** (`user?.classification === 'owner'` and event author ∈ {TA, session pubkey} — `TapestryDetail.jsx:189`, Director gate ruling): guests, anonymous sessions, non-owner admins, and any foreign-authored tapestry get no affordance at all.
- **No new page, no new route, no new server endpoint, no new dependency** — verified in the diff (`src/` delta is 0 bytes; no router change; `package.json`/lockfile untouched).

**What did not ship:** removal, integration editing, title/description editing, batch add, foreign-tapestry editing, any change to story #3's create gate, any server or firmware change, any production promotion.

## 2. Epics & stories rolled up

### Epic: `tapestries` (`epics/tapestries.md` — **Done, retired at this close**)

This book contains one story; the epic's other four were shipped by earlier, closed books and are listed for completeness.

| Story | Delivered | Status | Review |
|---|---|---|---|
| #5 add-a-concept-to-a-tapestry | The add-only affordance + append transform + owner-strict gate + post-save re-read | Done | `reviews/done/tapestries/5-add-a-concept-to-a-tapestry.md` — PASS 2026-07-28 |
| #1–#4 *(prior books)* | Directory, Exploration page, create, per-concept views | Done | `reviews/done/tapestries/1…4` |

**Gate record (from `journal.md`, 24 entries — 23 committed, the ratification entry riding this close commit):** 6 APPROVE (Gates 1, 2, 3, 5 + the final completion judge — all blinded, all first-round; Gate 4 mechanical, Director-verified) · 6 ANSWER · 12 INFO · **0 KICK_BACK · 0 HALT**. One Gate-3 judge spawn was **voided by absence** (it backgrounded the ~32-minute full suite and was reaped verdict-less; re-spawned fresh — §7 F1) — a re-spawn, not a kick-back. One story used of the operator's cap of two.

## 3. As-built inventory

Derived from the diff (`git diff --stat db7c5a7a..f10b53f5`: 19 files, +6 278/−82; production surface = 6 files under `ui/src/pages/tapestries/`) and re-verified against the running stack at close.

**User-facing**

- **`AddConceptToTapestry.jsx` (new, 131 lines)** — the sidebar affordance on the existing Exploration page: typeahead over the shared concept options (accessible name "Add a concept…"), excludes current members by uuid from the event's own graph block, **picking a result performs the save** (one concept per save; repeat to add more), busy-guard against double-submit (`:57`, input `disabled` `:102`), inline error on failure, membership untouched on every failure path.
- **`TapestryDetail.jsx`** — computes `canAdd` owner-strict (`:189`), renders the affordance in the sidebar "Concepts" section and in the `degraded` branch when `rawGraph === null` (first-add path); `notFound`/error/malformed-graph states get nothing.
- **`tapestryDraft.mjs`** — `buildAddConceptDraft({event, member, taPubkey})` (`:102`): verbatim copy + one member node + one import (dedup if present); envelope on first add; refuses unparseable json, non-array `graph.nodes`/`imports`, duplicate member, slug collision, wrong kind, missing d-tag; `created_at = max(now, event.created_at + 1)`.
- **`useTapestryGraph.js`** — now also returns the raw `event` and `reload()`; post-save visibility is **re-read of the same coordinate**, not client-side optimism.
- **`useConceptOptions.js` (new)** — the kind-39998 picker loader extracted verbatim from `useCreateTapestry.js`, which now consumes it (`create()` unchanged — regression-guarded).
- **No route, page, or nav change** (`ui/src/App.jsx`/`Layout.jsx` delta: 0 lines, verified).

**Endpoints** — none added, none changed. `git diff db7c5a7a..ac09d591 -- src/` is empty (verified at close, twice: whole `src/` and `src/api/`). Both publish paths are story #3's, byte-unchanged: owner-key → NIP-07 in-browser signature → `publishOrThrow`; TA → `POST /api/strfry/publish {signAs:'assistant'}` (server still 403-gates non-owner sessions — regression-guarded R3).

**Domain**

- Concepts touched, all with runtime-resolved `<TA>` (no literal anywhere in the production diff — re-swept here: 0 64-hex matches): `39998:<TA>:tapestry` (the edited element's z-tag handle), and per added member `39998:<TA>:<slug>` + `39999:<TA>:<slug>-concept-graph` — the member shape create already publishes.
- **No concept definitions changed → no firmware reinstall** (ADR 0005 states it with the correct reason: the republished tapestry is an *element*, not a definition; the diff confirms `firmware/` untouched).
- Replacement semantics are relay-native (same kind + author + d-tag, newer wins); Neo4j is not in the read path; there is no reindex step — the run's prompt claimed it, the cited evidence goal verified it, and the live add confirmed it (exactly **one** event at the coordinate after the add, re-verified at close: `created_at` 1785225434, tag order `d,name,z,json`, envelope holding exactly the cat node + cat import, `tapestry` block intact).

**Test surface**

- `test/add-a-concept-to-a-tapestry.test.js` (new, binding, stack-free; registered additively in `test/test.js`): P1–P13 pure-transform, S1–S6 source sentinels (S4 pins the owner-strict gate: `classification === 'owner'`, **not** `hasAdminAccess`), R1–R4 regression guards. **23/0 at close, run here.**
- `tests/brainstorm/tapestry-add-concept.spec.js` (new, mocked-network Playwright, E1–E13; both signing branches, every negative, the first-add/malformed split, the fresh-anonymous-session read). **13/13 at close, run here (3.6s).**
- Test-path integrity: `git diff cd938861..e3e9de51 -- test/ tests/` is **empty** (re-verified here) — the Implementer touched no test file after the Gate-3 anchor.

**Environment note, stated so nobody trips on it later:** the local container's TA resolves to `11f23fe4…` at close — *not* the `82b75e47…` CLAUDE.md's parenthetical names for this machine (the container identity has evidently been recreated since that note; staging's TA is `8e901369…`, different again). Nothing broke, which is the runtime-resolution rule doing its job; the ADR-0015 `LEGACY_*` constants are untouched by this book.

## 4. Deviations from intent

Anchor = the eight acceptance-frame bullets in `book.md` (decomposed verbatim from the goal's `deliverable`/`boundary`). All eight are satisfied; the deviations below are interpretations, ratified narrowings, and demonstration limits — harvested from the ADR, the story's Deviations log, the review, and the journal, then reconciled against the diff.

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | *"my own key or my assistant one"* | "my" = **the instance owner**, strictly: only an `owner`-classified session is ever offered the affordance; a non-owner session gets no affordance even on a tapestry authored under its own key. | interpretation (ratified) | Director ANSWER at Planning, from quotable frame text (the goal prompt's *"let the owner add"*; *"published by someone else cannot be edited here"* forecloses the alternative reading). Journal 04:17. | Non-owner users cannot edit their own-key tapestries on this instance. | Product validates the reading for multi-user instances (seed §7). |
| 2 | Story AC-1 *"a viewer who is not the owner… no add affordance"* vs the epic's shipped create idiom | The gate rejects `hasAdminAccess` (owner-or-admin, #3's shipped create gate) in favour of owner-only — **the epic now has two curator gates**. | intentional-change (gate ruling) | Director veto of the Architect's chosen gate at the Architecture gate; ADR 0005 Decision 3 + Consequences record the cost honestly. | An admin who is not the owner can create a tapestry but cannot add to one. | Epic-wide "who curates" harmonization — separately-goaled work if wanted. |
| 3 | *"Adding only"* on a tapestry with **no graph block at all** | First add **creates the minimal envelope** `{graphType:'tapestry', nodes:[member], relationshipTypes:[], relationships:[], imports:[import]}`. | interpretation (ratified) | Confirmed at the Architecture gate: the ask is unconditional, nothing is removed or altered, and without it the instance's only real tapestry could never be grown. ADR 0005 Decision 1-A. | The graph-less legacy tapestry un-degrades on first add (demonstrated live). | — |
| 4 | The goal-prompt's mechanism sketch: re-run the create builder with the existing d-tag suffix | **Rejected** for a new pure append transform — the sketch cannot hit the live event's bare-hex coordinate, rewrites the `name` tag, drops authored integrations, and re-derives imports (each verified against the real `b0b48b00` event). | interpretation (context-not-terms) | The prompt is owner *context*, never terms; ADR 0005 Option 1-B records all four mismatches; the Gate-2 judge re-verified them against source **and** the live relay. | None — the deliverable's wording is met more faithfully than the sketch would have. | — |
| 5 | *"the Tapestry shows the new concept … to anyone else who opens it afterwards"* — verified where? | Verified **live end-to-end on local** (real add of `cat` to `b0b48b00` through the shipped transform + real assistant publish path; anonymous browser session then rendered it; state re-verified at this close). **On staging: deploy + byte-identical bundle (`index-B5IfxynM.js`, affordance string ×2) + read-only anonymous rendering — no add performed there.** | constraint-discovered (mode ceiling) | Mutating shared staging data is an escalation trigger; staging smoke is read-only by rule (journal, Stage 2). Bundle identity re-verified here against both instances. | Staging behaviour of the *save* rests on a byte-identical bundle plus local live proof, not on a staging write. | One-click operator demonstration on staging, if wanted. |
| 6 | The owner's real click — a NIP-07-signed add from a real browser session | Not exercised by automation **anywhere** (no NIP-07 signer in any automation browser — `docs/SMOKE_TEST.md` limit). Covered by mocked Playwright E7/E8 (both signing branches through the real component and served bundle) + the owner-strict sentinel + the live assistant-path add. | constraint-discovered | Test plan §"Not covered by automation"; review accepted both gaps as legitimate; the completion report states it plainly. | The one seam automation cannot cross remains a one-click operator act. | Operator click-through (local or staging). |
| 7 | Operational-mode ceiling: staging is the hard limit | Merged to `staging` (`ac09d591`, PR #476, deploy run 30340623300 success 1m32s — all re-verified here via `gh`). **Not on `main`**: `git merge-base --is-ancestor ac09d591 origin/main` is false (verified here). | intentional (mode) | Operational Direction; promotion is never the Director's. | The owner cannot see this on production. | Promotion is the operator's call. |
| 8 | Knowingly surrendered: baseline commit, pinned governing versions | Stated verbatim with the endpoint's own reasons in the book's generated section; not silently dropped. | intentional (mode) | Endpoint `surrendered` block, carried at open. | Nobody can reconstruct which Director/rubric versions ran this book. | Accepted property of the mode. |

**Story-level deviations (Implementer-logged, all three audited and accepted at review):** `useAuth()` dropped from the component (gate lives in the page; signer guard pins the key); story #3's committed S3/S8 grep-sentinels satisfied by a truthful docstring after the sanctioned extraction (the behavioural pin moved to the new suite's S6/R4 — residue tracked as OPEN.md #116); transform refusals slightly broader than the ADR's named list, inside Decision 1-A's stated principle.

**Undocumented work — none found.** Every file in the diff traces to the story, ADR 0005, the test plan, or the Direction-mode process artifacts (book/journal/completion-report/Gate-4 log, plus the review commit's OPEN.md row and the Planning-phase epic reactivation, both journaled).

## 5. Quality state at close

**Test gate, run by the Reviewer at close** — `{ npm test; echo "CLOSE_GATE_EXIT=$?"; }` (brace form per OPEN.md #111), over the **final close state** (book Closed, epic retired, folders moved). **The verdict is read from the log, never the notification — and this run reproduced the lying notification live again**: the background completion event reported "exit code 0" for a run whose log ends `Overall: FAIL`, `CLOSE_GATE_EXIT=1` (the #103/#105 signature, one more occurrence).

**Result: `Overall: FAIL`, `CLOSE_GATE_EXIT=1` — two failing suites, both environmental flakes, both green on immediate isolated re-run, neither reachable by this book's diff.**

| | |
|---|---|
| `Overall:` | **FAIL** |
| echoed `CLOSE_GATE_EXIT=` | **1** |
| Suites | **120 PASS · 2 FAIL** |
| Total skipped | 53 (the same same-environment figure as Gate 4; the operator's Stage-0 baseline showed 31 under its environment) |
| `add-a-concept-to-a-tapestry` suite | **PASS — 23/0/0** inside the failing run |
| `harness-lint` suite | **PASS — 32/0** *with the close state in place* (book Closed + epic Done + folders moved): the previous book's deliberate L2-red close is **not** repeated |

**The two failures, named exactly, with the flake evidence:**

1. `relationship-primitives` H8 — *"scan count went 6020718 → 6020719"*: the **OPEN.md #75 bracket flake**, whose failure message names its own mechanism (a concurrent publisher during the bracket). Green on isolated re-run minutes later (**23/0**). Second occurrence in this book (the first was the stalled Gate-3 judge's full run); this book's Gate-4 run was green.
2. `most-pinned-tag-index-publish` AC-8 — kind-5 deletion propagation, *"expected 1, got undefined"*: live publish-flow timing in the tag stack. Green on isolated re-run (**7/0**). Not this book's doing: the executable diff at close is identical to the Gate-4-green state (everything since is markdown), `src/` is untouched by the book, and the book's one data mutation (a tapestry element) does not enter the tag index's scan. Single occurrence; not filed as a row (§7 F6 note).

**The binding green of record for the shipped code** remains Gate 4's committed log (`gate4-full-npm-test-2026-07-28.log`: `GATE4_EXIT=0`, `Overall: PASS`, zero failing suites, identical command — verified here at lines 3795–3798), corroborated by every suite this diff can touch re-run green at review, at Gate 5, and again at this close.

**Browser gate at close:** the new spec **13/13 (3.6s)** against the live local panel, run here — a passing E1 also proves the served bundle carries the feature (local serves `index-B5IfxynM.js`, the same content hash staging serves; re-verified both at close).

**Known open issues / accepted debt**

- **OPEN.md #116** — the S3/S8 prose-satisfied sentinels (Tester-lane relax asked) + story #1's permanently-failing Playwright AC-5 (outside the `npm test` gate; pre-existing at baseline, proven by commit archaeology at review).
- **OPEN.md #75** — the scan-count bracket flake; two more occurrences recorded by this book (append landed at this close).
- **Journal tail timestamps are unreliable** (§7 F2; OPEN.md #122): five committed entries post-date their own commits. Chronology of record = `git log`, not the stamps.
- ADR 0005 debt, rolled up: the member object is now shared by create and add (a change touches both builders); two-tab edits are last-write-wins at whole-event granularity (accepted, single-owner actor); external co-publish for TA-signed tapestries remains out (inherited from #3); the legacy `name`-tag slug/title divergence passes through unchanged; the ~71 unread Neo4j tapestry rows stay untouched (recorded on the evidence goal).
- CLAUDE.md's "local-dev TA" parenthetical is stale for this machine (§3 environment note) — cosmetic; the rule it illustrates is unaffected.

## 6. Carry-forward register

- [ ] **Ship the close trail to `staging`** (docs-only PR; everything after `ff85bd43` is branch-local) and delete the branch — **OPEN.md #125**.
- [ ] **Operator demonstrations deliberately left undone:** a live add on staging (read-only rule) and the owner's real NIP-07 click-through (no signer in automation). One click each. (§4 #5/#6)
- [ ] **Promote tapestries #5 `staging`→`main`, or decide not to.** Nothing from this book is on production. (§4 #7)
- [ ] **The rest of Edit a Tapestry** (epic future list): remove a member; author/alter integrations; edit title/description — each separately-goaled under the owner's Direction model.
- [ ] **Editing tapestries published by someone else** — whose key may republish is unsettled and has its own goal; deliberately unanswered here.
- [ ] **The two-curator-gates seam** (create admits owner-or-admin; add admits owner only) — ratify or harmonize. (§4 #2; ADR 0005 Consequences)
- [ ] **OPEN.md #116** — relax S3/S8 to probe the shared hook (Tester's lane, next touch); rewrite or retire the stale nav-spec AC-5 (fold with #89(b)).
- [ ] **OPERATIONS.md note for the `docker cp` bind-mount write-through gotcha** — OPEN.md #124.
- [ ] **External co-publish for TA-signed tapestries** (inherited from #3; a TA tapestry's reach is the local relay).
- [ ] **Legacy `name`-tag divergence** (slug vs title) — normalizing is an edit beyond adding; wants its own decision if ever.
- [ ] **~71 unread Neo4j tapestry rows** — parked on the evidence goal `find-out-whether-saving-a-tapestry-again-actually-updates-it`; explicitly not this book's problem.
- [ ] **POV/WoT filtering** of the directory / affordance (epic-level continuity).

## 7. Process findings (harness)

Harvested from `journal.md` (24 entries), the review's *Harness friction* section, the story's `## Deviations`, and this close's own re-verification. **Every finding carries exactly one terminal state** — operator-ratified harness commit · OPEN.md row · declined (reason). No fourth state.

**Measurement first, per step 7.** `scripts/harness-stats.sh` at retro time: 146 reviews decided repo-wide, kick-back rate 1%, churn 2; books 3 open / 27 closed; `tapestries` phase commits 21; this book **0d open→close**. The instrument scores this book by its one PASS-final review — which this time happens to match the journal (0 kick-backs, 0 halts across 24 entries) — but the instrument still cannot see Direction-mode gates at all (F8 / OPEN.md #119). Journal tally, counted here: 6 APPROVE · 6 ANSWER · 12 INFO · 0 KICK_BACK · 0 HALT · 1 spawn voided by absence.

| # | Finding | Source | Ports to the other flow? | Terminal state |
|---|---|---|---|---|
| F1 | **A gate judge that backgrounds the ~32-min full suite and ends its turn is reaped verdict-less.** First Gate-3 spawn stalled exactly so (task registry forgot it; transcript ends at a status note); re-spawned fresh with one neutral foreground-mechanics prompt line, which fixed it. The fix is per-run folklore until it lives in the spawn instructions. | journal 05:20 + 05:53 | Yes — any subagent running the long gate | **OPEN.md #123** (inserted at this close) |
| F2 | **Five committed journal entries carry future timestamps relative to their own commits** (Gate 1 04:22 in a 04:20:17 commit; Gate 2 04:45 in 04:43:26; Gate 5 08:05 and local-cycle 08:35 in 08:00:01; completion judge 08:25 in 08:14:35) — after the run caught and fixed a sixth pre-commit and said so. The local-cycle stamp also breaks file order against the staging entry and briefly makes the externally-fixed merge time (08:00:36Z) look impossible. Chronology recovered from `git log`; no decision hinged on a stamp. | this audit (journal vs `git log --format=%ci`); journal 04:38's own correction note | Yes — any journaled flow | **OPEN.md #122** (inserted at this close) |
| F3 | **Run meta-state reaches judged artifacts through unblinded roles**: the Product Owner read the book's operator story cap despite a scoping instruction; the review's mandated On-PASS section carried a cap remark that the Gate-5 judge then met inside a judged artifact (classified honestly by the judge as artifact-embedded exposure, not a spawn-prompt leak). A fifth structural blinding channel, joining the four the store-and-show close identified. | journal 04:15 + 08:05 | Mostly Direction-specific (judged artifacts) | **OPEN.md #117** — appended as the fifth channel on insertion at this close |
| F4 | **Committed test artifacts from earlier stories go brittle under later sanctioned changes, and no phase owns amending them** (S3/S8 docstring-satisfied sentinels; story #1's permanently-failing AC-5 spec). | review Findings #1–#2; story Deviations | Yes | **OPEN.md #116** — already filed in the review commit; nothing further |
| F5 | **The exit-code / skip-scrutiny discipline held end-to-end**: Stage-0 baseline attested with `Overall:` + explicit exit; Gate 4's `GATE4_EXIT=` marker force-added past `.gitignore`; skip delta (53 vs 31) explained line-by-line against the suite source rather than waved off; and the close gate reproduced the lying background notification ("exit code 0" over a FAIL log) without being believed. | journal 04:07, 06:45, 07:35:42; this close §5 | Yes | **Declined** — existing rows #103/#105/#111 + #104/#106 already carry the practice; this book is evidence it works, not a new lesson |
| F6 | **The run's strfry-CLI caveat did not reproduce**: the journal's local-cycle entry recorded the raw `strfry scan` CLI returning 0 rows for the `#z` filter (server scan endpoint correct). At close the same CLI probe returns the correct 1 row. Transient or probe-error at run time; no product surface uses the CLI path. Related: the close gate's one-off `most-pinned-tag-index-publish` AC-8 flake (§5), also self-cleared on re-run. | journal 08:35 caveat (1); this close §5 (both) | — | **Declined** — not reproducible, nothing to chase; recorded here as a record-correction so the caveat isn't re-investigated |
| F7 | **`docker cp` into the container's brainstorm path writes through to the host repo (bind mount)** — the Implementer briefly clobbered the served `index.html` during a baseline experiment (repaired; final state verified twice downstream). OPERATIONS.md should say it out loud. | journal 06:45 (Implementer findings) | Yes — any local deployer | **OPEN.md #124** (inserted at this close) |
| F8 | **The previous close's retro dispositions never landed**: store-and-show audit §7a drafted five OPEN.md rows + two appends as "paste-ready, insertion pending" (the file was held by a concurrent session), assigned the insertion to the operator — and a full subsequent book ran with the ledger never updated. A disposition of "row drafted, not inserted" is the fourth state the rule forbids, in slow motion. **Repaired at this close**: rows #117–#121 inserted (renumbered from the draft), the #75 and #114 appends applied, all attributed to their source close. | store-and-show audit §7a + `git log -- OPEN.md` (verified: no insertion between the two closes) | Yes | **Declined as a new rule** — `6-book-close.md` step 7 already forbids a fourth state; the deviation was circumstantial and the repair is done. The enforcement lesson is recorded here: the insertion belongs *inside the close commit*, as this close does it |
| F9 | **The epic close-out was performed inside the close** (epic Done + per-file `git mv`s into the pre-existing `done/tapestries/` folders + story-list/annotation refresh), so the close-out gate ran green (`harness-lint` 32/0 within the close-gate run) instead of repeating the previous book's deliberate L2-red close. The workflow still has no step saying to do this. | this close; store-and-show P14 lineage | Yes | **OPEN.md #121** — the note that fix (a) was executed manually here was added on insertion; the workflow amendment stays the operator's to ratify |

**Also verified, no action:** the run's positive disciplines held under re-verification — eligibility/terms byte-match checks at every phase boundary, the generated section never hand-edited (its verbatim carriage is judge-unverifiable *by design* and was verified here only as far as the protocol allows), preflight contamination checks non-vacuous, and the Gate-4 log's committed evidence chain intact.

---

## Verdict on the book

**Closed, and the record is accurate where it matters.** All eight frame bullets are satisfied by shipped code that this audit re-verified against the live systems rather than harvesting: the live add's relay state reproduces exactly (one event, newer `created_at`, envelope + cat member, tag order preserved), the staging bundle is byte-identical with the affordance present, production is untouched, both new suites pass at close, and the merged diff is exactly the six ADR-named production files with zero server delta.

**The close gate is RED for two reasons, and neither is this book** — a known bracket flake (#75, message names its own mechanism) and a one-off live publish-flow timing miss, both green on immediate isolated re-run, both in code this book cannot reach. The book's own suite is 23/0 inside that same failing run, and `harness-lint` is 32/0 **with the close state in place** — the epic retirement rode this close precisely so the previous book's L2-red pattern would not repeat.

**Where the record is loose**, in descending order of consequence:

1. **The journal's tail timestamps cannot be trusted** — five committed entries post-date their own commits (§7 F2). File order and `git log` are the chronology of record; the stamps are not.
2. **The staging demonstration is thinner than the local one, and the record mostly says so**: no add was performed on staging (by rule), so the save-path bullets rest there on a byte-identical bundle plus local live proof (§4 #5). Stated in the completion report; restated here so the summary tables don't overclaim.
3. **The strfry-CLI caveat in the local-cycle entry did not reproduce** (§7 F6) — treat it as a probe artifact, not a system property.
4. **The previous close's OPEN.md dispositions were dangling until this close repaired them** (§7 F8) — a defect of the *prior* book's record that this book inherited silently and this close discharges.

None of these changes what shipped. The owner asked to put a concept into a Tapestry that did not have it before; the instance's only real Tapestry now carries one it did not have, at the same address, visible to anyone who opens it.
