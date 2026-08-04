# Build Audit: Blinding Rebuild — move gate history out of judge-read surfaces

**Book:** `engineering-team/audits/blinding-rebuild/book.md`
**Date:** 2026-08-04
**Branch / commit range:** `harness/blinding-rebuild`, `c0c92c3f` (staging base) → the close commit (cycle: book `0e34c0cf` · story `81ceb9ea` · ADR `e239bb78` · tests `197a614b` · impl `7b02fdf7` · review `7420fde4` · follow-up `f4a84bcc`)
**Provenance:** Acceptance-frame (eagerly opened at intake, same-day as the work — the rows-78/99/110 lesson practiced)
**Confidence:** high

> As-built record for a harness-infrastructure book: one story (`harness-gate-integrity` #2), human-gated by design because it rewrites Direction mode's own gate protocol. No product surface, no concepts, no firmware.

## 1. What shipped

- **Gate-1 epic channel closed structurally** — the judge runs a pinned epic-status extraction supplied in the spawn prompt (`grep -m1 -o '^\*\*Status:\*\* *[A-Za-z-]*' …`); the epic file is never handed over; the rubric line says so — `stories/done/harness-gate-integrity/2-move-gate-history-out-of-judge-read-surfaces.md` AC-1, `roles/director.md`.
- **Verdict outcomes are journal-only by written rule**, with outcome-free journal-commit subjects (`journal: gate decision (<epic> #<n>, gate <G>)`) — `roles/director.md` § "The decision journal" (AC-1/AC-3).
- **Artifact hygiene enforced forward-only** — `harness-lint` `check_L14` (two token shapes; fenced/backtick mentions exempt; `done/` + `stories/_intake.md` exempt) **plus** the template guidance lines in `templates/user-story.md` and `templates/adr.md` (follow-up `f4a84bcc`); corpus-silent with zero waivers (AC-2).
- **Partial-read channel dispositioned as ratify-#133, extended to field extractions** — `.claude/agents/gate-judge.md`; the last stop-at-a-section instruction (`director.md:83`) replaced with the pinned frame-read command; extinction is test-pinned (AC-4).
- **Role scoping** — roles receive the frame via pinned partial reads; run meta-state reaches no role; the review template's On-PASS completion-detection line sends arithmetic to journal/chat, never the review file (AC-5) — exercised live by this very book's review.
- **Retro instrument sees Direction outcomes** — `harness-stats.sh` section (b2): per-book APPROVE/KICK_BACK/ANSWER/HALT/INFO from journal `**Decision:**` lines + a `direction gates` summary; live: 94/14/6 across 10 journaled books that previously scored as zero rework (AC-6).

## 2. Epics & stories rolled up

### Epic: `harness-gate-integrity` (reopened 2026-08-04 for this book; re-retired Done at this close)
| Story | Delivered | Status | Review |
|---|---|---|---|
| #2 move-gate-history-out-of-judge-read-surfaces | All six ACs; 13 new tests (9 lint suite, 4 stats suite); one sanctioned post-PASS follow-up (`f4a84bcc`, template guidance line) | Done | `reviews/done/harness-gate-integrity/2-move-gate-history-out-of-judge-read-surfaces.md` — PASS `7420fde4` |

(Story #1 predates this book — closed 2026-07-25 under the `harness-gate-integrity` book; its folders ride the same `done/` moves performed at this close.)

## 3. As-built inventory

- **User-facing:** none — harness definition surfaces only.
- **Harness definition:** `roles/director.md` (every-gate pinned frame-read item; Gate-1 pinned epic extraction; Gate-1 rubric line; § decision-journal locality + subject convention; role-input scoping bullet), `.claude/agents/gate-judge.md` (field-extraction pins), `templates/review-checklist.md:62`, `templates/user-story.md` + `templates/adr.md` (hygiene guidance lines), `scripts/harness-lint.sh` (`check_L14`), `scripts/harness-stats.sh` ((b2) + summary line), `engineering-team/CHANGELOG.md` (4 rows: relocation, L14, (b2), template line; +1 at close for the waiver removal).
- **Tests:** `test/harness-lint.test.js` +9, `test/harness-stats.test.js` +4 — no new suites, no runner change; `test/` diff after the Gate-3 commit `197a614b` empty through impl (verified both phases).
- **Domain / concepts / firmware:** none touched.

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame: hygiene "forward-only … grandfathered corpus"; ADR calibration bar "zero hits" stated as fact | One active-path hit existed (shape (ii), operational-direction #1 linked-artifacts line); reworded outcome-free at impl | constraint-discovered | Only shape (i) was measured at Architecture; zero-waiver corpus-silence is a test contract, and `done/`-grandfathering doesn't cover active paths (story `## Deviations`; review § Deviation assessment: faithful) | none — the pointed-to review file keeps the outcomes | OPEN.md #107 append (this close) |
| 2 | Frame channel-a bullet: "a template line **plus** a lint-shaped check" | Impl shipped the check only; the template line landed post-PASS as `f4a84bcc` (operator-sanctioned path (a)) | deferred → delivered in-book | Caught by the review's completion detection, reported in chat per the new rule (review final report; non-blocking finding 2) | none | — |
| 3 | ADR notes: L14 scope "`engineering-team/{stories,decisions,epics}`" | Glob covers epic-foldered paths + story-root files; the 22 legacy top-level `decisions/00NN-*.md` are unscanned | interpretation | Reviewer NB-1: ran the pipeline over all 22 — zero hits; new ADRs land in epic folders, so forward coverage is intact | none | §6: optional glob extension |
| 4 | Intake wording: epic check "becomes a derived existence/`Status:` assertion" | Delivered as a **judge-run** pinned extraction, not a Director-computed assertion | interpretation | ADR 0002 sub-option A1: a Director-computed assertion re-trusts the invested party (ADR § Decision) | none — strictly stronger | — |

**Undocumented work:** none — every hunk in `c0c92c3f..HEAD` traces to the story, the ADR's implementation notes, the logged deviation, or the sanctioned follow-up (review scope-creep sweep + this close's diff walk concur).

## 5. Quality state at close

- Test gate at close (step 10, run **after** the flip + epic close-out, certifying the tree the close leaves behind): **`Overall: PASS`, `EXIT=0`** (log-read per the brace-form rule; launcher notification not consulted), 0 failing suites, 53 environmental skips; `harness-lint` clean over the post-move tree with the L2 waiver already removed — L2 green on merit, no STALE-WAIVER. The #75 drift signature did not fire on this run.
- Impl-phase gate: `Overall: PASS`, `EXIT=0`, 53 environmental skips (log-verified). Review-phase gate: `Overall: FAIL`/`EXIT=1` with the sole failure being the known #75 drift signature (probe H4, scan 6598831→6598832, +1); isolated re-run 9/0 green; dispositioned environmental per precedent. The launcher notification claimed exit 0 for that failed run — the lying-notification signature, caught by the read-the-log mandate (§7).
- Suites: harness-lint 41/0 · harness-stats 12/0 (reproduced independently by the reviewer); real-repo `harness-lint.sh` clean, no `VIOLATION L14`, no `WAIVED L14`.
- Known accepted limitations: prose-shaped history leaks ("spent two rounds") are mechanically uncatchable — L14 pins token shapes; the template guidance + judge self-report duty are the prose backstop (ADR Consequences). Judge obedience to pinned commands is enforced by the #133 void-on-over-read sanction, not by test (review "Not verified").

## 6. Carry-forward register

- [ ] **Extend the L14 glob to the 22 legacy top-level `decisions/00NN-*.md`** — optional hardening; verified zero-hit today (review NB-1; §4 #3).
- [ ] **Option B (generated frame excerpt) is the named escalation** if any future judge discloses over-reading past a pinned command (ADR § Options, revisit trigger).
- [ ] **The gate-run/read-the-log doc rules (#83/#103/#105/#111) are still spawn-prompt-carried, not doc-stated** — this book's reviewer needed them in its prompt; the pending ratification-batch story (proposed at the 2026-08-04 triage) is the vehicle.
- [ ] **Ship to staging** — harness-infra cadence, not prod-held (`/cycle-staging`; the whole trail rides one PR).
- [ ] **Book retirement** — `audits/blinding-rebuild/` (and the sibling `audits/harness-gate-integrity/`) → `audits/done/` once the next phase ingests this audit (OPEN.md #101, narrowed at this close).

## 7. Process findings (harness)

`scripts/harness-stats.sh` at retro time: this book — review verdicts 1 PASS / 0 CR, churn 0, cycle time 0d (same-day); and, self-referentially, this human-gated book has no `journal.md`, so it is correctly **absent** from the (b2) section its own story added — the instrument's journalless-book contract holding live. Direction totals now visible: approve 94 · kick-back 14 · halt 6.

| Finding | Source | Terminal state |
|---|---|---|
| #75 drift recurrence (probe H4, +1, sole failure of the review's full gate; isolated re-run green) | review § Gate results + § Harness friction | OPEN.md row **75** appended (this close) |
| Lying-notification recurrence — launcher exit 0 vs log `Overall: FAIL`/`EXIT=1`; read-the-log mandate caught it | review § Gate results | OPEN.md row **111** appended (occurrence ten; this close) |
| ADR stated its calibration bar as fact with only shape (i) measured; execute-don't-trust caught it at impl | story `## Deviations`; review § Deviation assessment | OPEN.md row **107** appended (instance; this close) |
| Frame's template-line half missed at impl; surfaced by completion detection reported in chat (the new rule's first live exercise) | review final report (completion detection) | operator-ratified harness commit **`f4a84bcc`** |
| Completion-arithmetic-out-of-the-review-file rule worked on its first live use | this close + review final report | shipped in **`7b02fdf7`** (`templates/review-checklist.md:62`) — no further action |
| Independent-reviewer-when-main-session-implemented practice followed by choice; the mandate remains unratified | this run; row 80(b) | existing OPEN.md row **80** (no new state — the ratification-batch story's lane) |

Portability check (step 7): every finding above ports Direction ↔ human-gated unchanged — the gate-run rules and the hygiene shapes are flow-agnostic; the pinned-read and journal-locality rules are Direction-specific by construction but their artifacts (stories/ADRs/epics) are shared.
