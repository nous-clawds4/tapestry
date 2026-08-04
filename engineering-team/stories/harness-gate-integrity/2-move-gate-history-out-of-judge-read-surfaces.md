# Story 2: Move gate history out of judge-read surfaces

**Status:** Approved
**Created:** 2026-08-04
**Type:** Feature (harness infrastructure — docs, templates, lint-shaped checks, one script; no product surface)

## Background

Direction mode's strongest control is the **blinded gate judge**: a fresh subagent per verdict that audits one phase artifact against a rubric without knowing the run's progress, deadline, budget, or prior verdicts — so an APPROVE means the same on round one and round eight. Today that blinding is enforced by spawn-prompt instruction over a shared filesystem, and the record shows instruction is not enough. Five leak channels are catalogued:

- **(a) Artifacts carry verdict text** — a story's `Supersedes: … KICK_BACK` line; ADR prose like "this epic has already spent two Planning rounds" (store-and-show audit §7 P1).
- **(b) Commit subjects name gate outcomes** — eight `journal: Gate N KICK_BACK …` subjects sat in `git log` for any judge that runs it; the take-a-concept-back-out Gate-5 re-spawn met a subject recording a prior void the same way (2026-07-30).
- **(c) The Gate-1 rubric requires the epic file**, which accumulates kick-back counts and prior-verdict summaries **by design** — the rubric cannot be run as written without handing the judge gate history. Every Gate-1 spawn in the store-and-show run had this exposure (store-and-show audit §7 P2).
- **(d) Partial reads of `book.md` were instruction-bounded** — three consecutive judges disclosed that "read the frame section only" is unenforceable at the tool layer, and a Gate-5 APPROVE was voided on exactly that over-read. *Largely closed 2026-08-04:* OPEN.md #133 ratified mechanically pinned line-range reads into the Director protocol and the judge agent definition. This story **dispositions** the channel rather than re-solving it (see acceptance criterion 4).
- **(e) Unblinded roles carry run meta-state into judged artifacts** — the Product Owner read the book's story cap despite a scoping instruction; a review's mandated On-PASS section carried a cap remark the Gate-5 judge then met inside the artifact under audit (add-a-concept audit §7 F3).

The operator ratified the direction on 2026-07-28: **gate history moves somewhere no rubric requires a judge to read; the blinding contract becomes artifact hygiene enforced by construction, not prompt discipline.**

A sibling instrument gap rides along (OPEN.md #119): `scripts/harness-stats.sh` — which `workflows/6-book-close.md` step 7 tells every retro to cite "so the retro runs on measurement rather than anecdote" — parses only review verdicts and phase-commit subjects. It scored the store-and-show book at **kick-back rate 0, churn 0** while that book's journal records **8 gate KICK_BACKs and 3 HALTs across 47 entries**. The instrument is structurally blind to exactly the books that generate the most rework.

This story runs under the human-gated book [`audits/blinding-rebuild/book.md`](../../audits/blinding-rebuild/book.md) — deliberately not Direction mode, because it changes Direction mode's own gate protocol. Per that book's classification, Test Design is folded to the pieces that are code (the stats tally, the hygiene check); this line records the adaptation so the phase plan is explicit.

## User-facing description

As the **operator of Direction-mode books**, I want gate history to live only in surfaces no judge is ever required to read, and my retro instrument to count gate outcomes from the journal, so that a blinded verdict is equally trustworthy however troubled the run that produced it — and retros run on measurement rather than anecdote.

## Acceptance criteria

Testable from the outside. For the protocol/docs criteria, "testable" means source inspection of the harness definition (the established S-class idiom); for criteria 2 and 6 it means an executable check with a seeded fixture.

- [ ] **1. The Gate-1 epic channel is closed.** Given the Direction-mode protocol after this story, when the Gate-1 judge's required inputs are enumerated, then no epic file is among them — the epic-existence/status condition reaches the judge as a derived assertion, per the ratified direction — and when any gate verdict is recorded during a run, then the epic file's run-era diff contains no verdict outcomes (they land only in the journal, which judges are already forbidden to read).
- [ ] **2. Artifact hygiene is enforced, forward-only.** Given a story or ADR file created or modified after this story ships, when it references a prior phase round (e.g., a `Supersedes:` line), then it carries no gate-outcome vocabulary; and a mechanical check exists that (i) flags a seeded violation in a new/changed file and (ii) stays silent on the grandfathered pre-existing corpus, whose history is kept as written.
- [ ] **3. Commit subjects stop naming gate outcomes.** Given the Direction-mode protocol's commit conventions after this story, when a journal/gate commit is described, then the stated convention is: subject carries story/gate identity only; the outcome lives in the body a judge never reads. The convention is stated wherever Direction-mode commits are specified, and the harness's own instrument (criterion 6) no longer depends on outcome-bearing subjects.
- [ ] **4. The partial-read channel is dispositioned, not duplicated.** Given ADR 0002 of this epic, when the frame-only-read channel is addressed, then it either ratifies the #133 pinned line-range read as the structural answer (and the protocol docs say so in one place) or ships a stronger mechanism (e.g., a generated frame excerpt) — and in either case, no harness-definition doc still instructs a judge to stop reading at a heading.
- [ ] **5. Unblinded roles stop receiving or embedding run meta-state.** Given the phase workflows and role docs after this story, when an unblinded role's inputs are enumerated, then run meta-state (story caps, deadlines, budgets, gate tallies) is excluded unless that role's function requires it; and no mandated section of a judged artifact requires embedding run meta-state — the review's completion-detection arithmetic no longer lands inside the artifact a Gate-5 judge audits.
- [ ] **6. The retro instrument counts gate outcomes.** Given a closed Direction book whose journal records gate decisions (live fixture: store-and-show — 8 KICK_BACK, 3 HALT among 47 entries), when `scripts/harness-stats.sh` runs, then its per-book output includes a gate tally (APPROVE / KICK_BACK / HALT / ANSWER) derived from journal `**Decision:**` lines; books without a journal are reported unchanged; and the tally is exercised by an automated test against the fixture.

## Concepts touched

None. This story touches harness definition surfaces only — no concept-graph entities, no firmware, no runtime product code. (Stack is up at :7778; orientation deliberately skipped as not applicable.)

## Out of scope

- **Rewriting git history or scrubbing closed artifacts.** Hygiene is forward-only; `done/` stories, ADRs, and existing commit subjects keep their history as written (the row-38 principle: records encode real historical state). History rewriting is additionally a Director hard-stop on its own.
- **Changing what judges verify.** Rubric standards, stopping rules, arming semantics, the staging ceiling, and halt behavior are untouched — only input handling and history hygiene change.
- **The sibling intake proposals** — meta-ledger sweep #2 and the OPEN.md file-per-row migration.
- **Re-working the 2026-08-04 ratifications** (#132 denial shapes, #133 pinned reads). Criterion 4 builds on #133 — documents or strengthens, never reverts.
- **The L2 reopen carve-out itself** (#129's kept-visible rule-fix proposal). This book runs under the established waiver pattern; the lint rule change is a separate act.
- **New parallel tooling or lesson surfaces** (epic design constraint): every mechanism extends existing machinery — the journal, the `harness-lint` invariant set, `harness-stats.sh`.

## Open questions

None blocking. The one intent-level choice — **forward-only hygiene with the pre-existing corpus grandfathered** — is stated in criterion 2 and Out of scope, and is ratified by approving this story.

## Linked artifacts

- Book: `engineering-team/audits/blinding-rebuild/book.md`
- ADR: `engineering-team/decisions/harness-gate-integrity/0002-move-gate-history-out-of-judge-read-surfaces.md`
- Test plan: (filled in after Test Design phase — folded to criteria 2 and 6 per the book's classification)
- Review: (filled in after Review phase)
