# Review: Story 2 — Move gate history out of judge-read surfaces

**Reviewer:** Claude (acting as Reviewer — independent fresh-context spawn; the main session authored the implementation)
**Date:** 2026-08-04
**Diff:** `git diff 197a614b..7b02fdf7` (impl commit `7b02fdf7`); full story-cycle context `c0c92c3f..7b02fdf7`
**Story:** `engineering-team/stories/harness-gate-integrity/2-move-gate-history-out-of-judge-read-surfaces.md`
**ADR:** `engineering-team/decisions/harness-gate-integrity/0002-move-gate-history-out-of-judge-read-surfaces.md`
**Test plan:** `engineering-team/stories/harness-gate-integrity/2-move-gate-history-out-of-judge-read-surfaces.test-plan.md`

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — full gate run detached to a log; verdict read from the log itself (`Overall:` + echoed `EXIT=`), never the launcher. **Log says `Overall: FAIL`, `EXIT=1` — the sole failure is a named environmental signature, dispositioned below; every other suite green, 53 environmental skips (matches the Implementer's report).**
  - Failing suite: `relationship-primitives-probe suite: FAIL (8 passed, 1 failed)` — single test `H4 (AC-4): repeated probes write NOTHING to strfry — scan counts bracket equal`, message `scan count went 6598831 -> 6598832`. This is exactly the OPEN.md #75 strfry scan-count drift class (+1 mid-bracket router sync; `test/relationship-primitives-probe.test.js` H4 is named in that row), in a suite this diff cannot touch — the diff contains no runtime code at all (role docs, one agent def, one template, two report scripts). **Isolated re-run of the suite by me: `{"pass":9,"fail":0}` — H4 green.** Dispositioned **environmental** per the #75 precedent (occurrences five and six: independent reviews accepted the disposition; this one adds the immediate isolated green re-run, the add-a-concept-close form).
  - In-gate story suites: `harness-lint suite: PASS (41 passed, 0 failed)`; `harness-stats suite: PASS (12 passed, 0 failed)`.
- [x] Suite-scoped standalone runs (my own): harness-lint `{"pass":41,"fail":0}`, harness-stats `{"pass":12,"fail":0}` — all 13 new tests green (the 10 expected-RED now pass for the feature-present reason; the 3 documented guard-greens hold), 40 pre-existing tests unregressed.
- [x] `bash scripts/harness-lint.sh` on the real repo — exit 0, `harness-lint: clean (0 violations)`; **no `VIOLATION L14` and no `WAIVED L14` lines** — the corpus-silence-with-zero-waivers calibration bar holds live, not just in the test.
- [x] `bash scripts/harness-stats.sh` on the real repo — exit 0; section "Direction-mode gate outcomes" present with one line per journaled book; `store-and-show-the-prompt-and-the-estimate: APPROVE 17 · KICK_BACK 8 · ANSWER 5 · HALT 3 · INFO 15` (exact match to the frozen-fixture counts in ADR/test plan); totals line across 10 journaled books; summary block carries `direction gates — approve: 94 · kick-back: 14 · halt: 6`. The story's headline claim is now observable: the book the old instrument scored "kick-back rate 0" reports its 8 KICK_BACKs and 3 HALTs.
- [x] `npm run test:playwright` — not applicable (no browser/UI surface in the diff).
- [x] _Lint/typecheck/build not configured — skipped._

## Spec adherence

Per the test plan's coverage map, AC-2/4/6 are test-pinned and AC-1/3/5 review-verified. All six checked against ADR 0002's implementation notes item by item:

- [x] **AC-1 (Gate-1 epic channel closed)** — `engineering-team/roles/director.md:85`: the Gate-1 spawn item carries the pinned epic-status extraction (`grep -m1 -o '^\*\*Status:\*\* *[A-Za-z-]*' engineering-team/epics/<epic-slug>.md`) — the judge runs it, empty output fails the item (Option A1 as decided, not a Director-computed assertion). `:103`: the rubric item now reads "verified only via the spawn prompt's pinned extraction; the judge never opens the epic file". `:183` journal locality: verdict outcomes, kick-back counts, and gate tallies live only in the journal, never the epic/story/ADR — and `check_L14` scans `epics/*.md`, so run-era verdict accumulation in an epic is mechanically flagged (test: "an epic file accumulating verdict history is a violation"). Verified live: on the reactivated `epics/harness-gate-integrity.md`, the `-o` extraction emits exactly `**Status:** Active` — it structurally truncates the reopen annotation on the same line, so the extraction cannot leak history even from an annotated Status line.
- [x] **AC-2 (artifact hygiene, forward-only)** — `scripts/harness-lint.sh` `check_L14` (:317–341): the two ratified shapes; fenced-block + inline-code mention exemption via awk preprocess; `done/` segments and `stories/_intake.md` exempt (grandfather by location); emission through the standard `violation()` so waivers/STALE-WAIVER work unchanged (waiver-routing test green). Eight L14 tests cover positive shapes in story/ADR/epic fixtures, mention-vs-use, narrowness (the "Background" substring hazard), scope, waiver, and the corpus-silence + zero-waiver bar — which my own repo run independently confirms.
- [x] **AC-3 (commit subjects)** — `engineering-team/roles/director.md:185`: stated convention `journal: gate decision (<epic> #<n>, gate <G>)`; the Decision value appears in the entry body, never the subject. No other harness doc prescribes a journal-commit subject (`.claude/skills/direct-feature/SKILL.md` and the commands specify phase-commit subjects only — checked), so the convention is stated at the one place Direction-mode journal commits are specified. The instrument no longer depends on outcome-bearing subjects: (b2) parses journal files, not `git log`.
- [x] **AC-4 (partial-read channel dispositioned, not duplicated)** — resolved as ratify-#133 per the ADR: `director.md:84` (every-gate item) now hands judges "the book path with its pinned frame-read command (per the partial-reads rule above) — a partial read is never phrased as an instruction to stop at a section"; `.claude/agents/gate-judge.md:15` extends exact-and-exclusive from line-range to field-extraction commands with unchanged over-read-voids semantics. The S-class extinction test is green, and my independent sweep of every def-path plus `roles/`, `workflows/`, `.claude/agents/`, `.claude/skills/direct-feature/`, `.claude/commands/` finds exactly one remaining "section only" occurrence — `director.md:83`, the rule *forbidding* the phrasing.
- [x] **AC-5 (role scoping)** — `engineering-team/roles/director.md:49`: role spawns needing the acceptance frame receive it via the same pinned partial-read mechanism as judges, and run meta-state (deadline, story cap, budgets, gate tallies) reaches a role only if its phase function requires it — "none does". `engineering-team/templates/review-checklist.md:62`: completion-detection results and book arithmetic go to the run journal (Direction) or the chat (human-gated), **never the review file** — closing the add-a-concept §7 F3 channel. Template sweep: no other mandated section of a judged artifact requires run meta-state (`templates/book.md`'s Direction fields are the operator's book, which judges reach only via the pinned frame read; `templates/adr.md`'s "perf budget" is a product constraint, not run state).
- [x] **AC-6 (retro instrument counts gate outcomes)** — `scripts/harness-stats.sh` (b2) (:97–124): per-journal counts of `^\*\*Decision:\*\* <V>` for APPROVE/KICK_BACK/ANSWER/HALT/INFO; journalless books absent by glob construction (not zero-filled); a zero-Decision journal prints all zeros; `exit 0` preserved (instrument principle); summary block gains the direction-gates line. Four tests including the exact frozen store-and-show fixture; my live run reproduces every pinned string.
- [x] No criterion silently dropped; no behavior beyond the story (scope sweep below).

## ADR adherence

- [x] Files changed match implementation notes 1–5 + 7 exactly: `roles/director.md` (four amendments: :84, :85, :103, :183/:185, plus the note-1 role-scoping line at :49), `.claude/agents/gate-judge.md` (note 2), `templates/review-checklist.md:62` (note 3 — the replacement keeps the pre-existing "/close-book offered" clause, a faithful superset preserving workflow-5 semantics), `scripts/harness-lint.sh` (note 4), `scripts/harness-stats.sh` (note 5), `engineering-team/CHANGELOG.md` (note 7 — three rows in the same commit; `git show --name-only 7b02fdf7` confirms the L10 touch-rule is satisfied for all def-paths touched).
- [x] Note 6 honored: the impl commit contains **zero `test/` changes** — the 13 tests landed in the Tester's commit `197a614b`, and `git diff 197a614b..7b02fdf7 -- test/` is empty.
- [x] Option A1 implemented as decided (the judge runs every pinned extraction itself).
- [x] Layering respected; no new dependencies — both scripts remain bash+git+coreutils, and every mechanism extends existing machinery (journal, harness-lint invariant set, harness-stats), honoring the epic constraint.

## Concept-graph integrity

- [x] N/A, and verified so: the diff touches no concept handles, no firmware, no runtime product code; the story records orientation as deliberately skipped (stack up, unused).
- [x] Firmware reinstall: not required (ADR states it; the diff confirms nothing concept-bearing changed).
- [x] No new code needing `/summaries` orientation.

## Things tests can't catch

- [x] No secrets in committed files; no leftover debug logging; no commented-out code (docs + two report scripts; the scripts' output lines are their product).
- [x] Shell portability (bash 3.2 target): no `mapfile`, no associative arrays, no globstar reliance; unmatched-glob guard `[ -e "$f" ] || continue`; `|| true` on every `grep -c` (which exits 1 on zero matches) under `set -uo pipefail`; the awk fence-toggle + inline-span strip is POSIX. Proven on this macOS host by the suite and script runs above.
- [x] L14 regex sanity: valid POSIX ERE (group-leading `^`/`$` anchors are legal there); word-boundary guards around `[Gg]ate[- ][0-9]` / `[Rr]ounds?` block the "Background" substring hazard (test-pinned; manually traced); PASS/FAIL deliberately excluded from the token list per ADR Consequences (legitimate status/review vocabulary).
- [x] (b2) globs cannot double-count: `audits/*/journal.md` would only overlap the done tree via `audits/done/journal.md`, which does not exist; nested done books come solely from the second glob.
- [x] Concurrency/races: N/A — sequential report scripts, no shared state.
- [x] Scope creep: none. The impl commit is exactly the ADR's implementation notes plus the logged deviation plus the story's own `## Deviations` entry. The full-cycle diff (`c0c92c3f..7b02fdf7`, 16 files) is fully phase-accounted: book open; epic reactivation + run-scoped L2 waiver + intake pickup annotation (Planning, all pre-announced in the book); story/ADR/test-plan/tests (their phases); the eight impl files above.

## Deviation audit (story `## Deviations`)

The one logged deviation — rewording one line of `engineering-team/stories/operational-direction/1-operational-direction-mode.md` — verified faithful:

- [x] One-line diff; the Round-1/2/3 sub-bullets beneath it are untouched context.
- [x] Pointer and date kept; the verdict tokens are gone from the line; the rework is annotated in place with date and ADR citation.
- [x] The review file the line points to still holds the outcomes: `engineering-team/reviews/operational-direction/1-operational-direction-mode.md:147` CHANGES_REQUESTED, `:247` CHANGES_REQUESTED, `:357` PASS.
- [x] Rationale honest: the zero-waiver bar is a real test contract ("L14 exists and the real repo is L14-silent with zero waivers"), so waiving was unavailable without failing the suite; the file is active-path, so `done/`-grandfathering could not apply; and the old line ("two rounds, both **CHANGES_REQUESTED**") was the sole shape-(ii) match in the active corpus — I enumerated the file's remaining token line (`:76`) and confirmed it sits outside both pinned shapes.
- [x] The story's claim that the Architecture-phase calibration covered shape (i) only is consistent with ADR 0002's "Measured facts" (which measured only the Supersedes shape).

## House rules check

- [x] Concept Graph API authority respected (untouched).
- [x] No new lint/typecheck/build tooling: L14 and (b2) are extensions of the two existing scripts, ratified by this ADR; nothing new enters the toolchain.

## Product-guide adherence

- N/A — no PRD; harness-infrastructure book under an acceptance frame.

## Findings

### Blocking

None.

### Non-blocking

1. **scripts/harness-lint.sh:329-330** — the L14 loop scans `decisions/*/*.md` but not the 22 legacy top-level `engineering-team/decisions/00NN-*.md` ADRs, while ADR note 4 wrote the scope as `decisions/**/*.md`. Measured: I ran the exact awk+grep pipeline over all 22 — **zero hits**, so the corpus-silence claim holds over the unscanned set too. New ADRs land under `decisions/<epic-slug>/` by convention (Gate-2 rubric, workflow 2), so the forward-only enforcement target is fully covered — and bash 3.2 (no globstar) would evaluate the ADR's own `**` pattern to exactly what shipped. Optional improvement: add `engineering-team/decisions/*.md` to the glob list, or note the legacy-location exclusion in the check's comment block.
2. **engineering-team/decisions/harness-gate-integrity/0002-move-gate-history-out-of-judge-read-surfaces.md:64** — the Consequences line "the templates' guidance line and the judge's self-report duty remain the backstop for prose" references a template guidance line that does not exist in `templates/user-story.md` or `templates/adr.md` (swept). A dangling reference in ADR prose, not an implementation gap — the implementation notes never listed one, and the Implementer correctly implemented the notes. Optional: a one-line hygiene note in the story/ADR templates would ground the reference; that reconciliation belongs to book close-out, not this diff.
3. **engineering-team/stories/operational-direction/1-operational-direction-mode.md:76** — retains bare "after review CHANGES_REQUESTED" prose. It sits outside both pinned shapes — a live instance of the ADR's documented accepted limitation (prose-shaped history is mechanically uncatchable; L14 pins the two token shapes only). Correctly left alone: rewording beyond the single matching line would have exceeded the deviation's minimal scope.

### Harness friction

1. Full-gate spurious red: relationship-primitives-probe H4 +1 strfry scan-count drift (this run: 6598831→6598832; isolated re-run 9/0 green) — the already-ledgered OPEN.md #75 class, no new row needed; this occurrence belongs in row 75's running tally at the book close.

## Verdict

**PASS**

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place; the story's Linked-artifacts Review line filled with this file's path.
- [x] Completion detection performed; the result and any book arithmetic recorded in the run journal (Direction) or the chat (human-gated) — never in this file. `/close-book` offered if the book looks complete.
