# Review: Story 5 — harness-stats

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-07-02
**Diff:** story-5 commits — `scripts/harness-stats.sh` (new), `scripts/lib/review-verdict.awk` (extracted), `scripts/harness-lint.sh` (thin-wrapper refactor), `test/harness-stats.test.js` + registration, workflow-6 citation flip, def-paths + CHANGELOG

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — full run on the final committed state: **harness-lint 25/25, harness-stats 8/8**; failing set identical to the pre-book baseline — zero regression. Standalone re-runs of both suites independently confirmed (25/25, 8/8).
- [x] `bash scripts/harness-lint.sh` — **clean** through the shared-parser refactor; L10 satisfied by the riding CHANGELOG row; the def-file self-listing property held (adding `scripts/lib` was itself L10-visible).
- [x] **No-second-copy grep:** the verdict match-loop program exists in exactly one file — `scripts/lib/review-verdict.awk`; both consumers resolve it via `BASH_SOURCE` (lint:83, stats:24) — fixture cwds cannot break the lookup.
- [x] **Real-repo numbers sanity-checked:** 391 phase commits; 78 decided reviews — 76 PASS-final, 2 CR-final (2%), **18 with kick-back history** (kick-backs overwhelmingly amend to PASS in-file — the distinction the two labels encode); churn 2; books 2 open / 8 closed — verified against `ls` (10 active book folders; `audits/done/` has never been populated, the known book-retirement gap); cycle coverage an honest 74 of 93.
- [ ] Playwright / lint / typecheck — n/a.

## Spec adherence (AC-by-AC)

- [x] **AC-1** all four sections + the summary block present; the coverage line counts unmatched stories (fixture-pinned by `9-never-mentioned.md`).
- [x] **AC-2** exit 0 unconditionally — fixture-pinned including an empty git-less directory; no `set -e`; final `exit 0`.
- [x] **AC-3** one shared source, both consumers — grep-verified above; lint's 25 green tests pin the refactor as behavior-preserving.
- [x] **AC-4** workflow-6 step 7 now reads "run it at retro time" — direct instruction.
- [x] **AC-5** suite covers every listed case with exact assertions (controlled timestamps: 3d cycle, 10d duration); registered in `test/test.js` (require/banner/summary/conjunction).
- [x] **AC-6** bash + git + coreutils only; no network; runs in this remote session.
- [x] **AC-7** def-paths registration (`harness-stats.sh` + `scripts/lib`), CHANGELOG row, lint clean.

## ADR adherence

- [x] Option A precisely: shared awk with the ratified-rule header naming both consumers and the known tq-#22 edge; slug matching with story→review preference and first→last fallback; books include the (currently empty) `done/` path; per-epic attribution labeled heuristic with a floor-semantics unattributed bucket, exactly as the ADR accepted.
- [x] No deviations.

## Concept-graph integrity

- [x] n/a — harness tooling only.

## Things tests can't catch

- [x] No arrays beyond none (strings/counters — bash-3.2 safe); `date -d` guarded (ages degrade to "?"/"n/a" on non-GNU date, per the house pattern).
- [x] The one `git log` scan feeds both sections (a) and (d) — no per-story git forks.

## Findings

### Blocking
_None._

### Non-blocking
1. **Median 0d needs reading guidance** — day-resolution cycle times render same-day stories (this book's five, the recent Direction runs) as `0d`. Correct, but a retro reader should interpret 0d as "same-day," not "instant." One parenthetical in the summary line whenever the script is next touched; alternatively the retro simply knows.
2. **`scripts/harness-stats.sh:66-68`** — the `case "$rf" …` statement in the verdict loop is a no-op (both arms empty). Dead code, cosmetic; remove on next touch.
3. **Per-epic attribution can double-count** a subject naming two epic slugs — ADR-acknowledged floor semantics, already commented in-script. No action.

### Harness friction *(→ OPEN.md `meta` rows)*
1. None new — though the coverage line's 19 unmatched stories are the standing, now-quantified argument for the prospective commit-trailer convention (ADR 0005 Option C), queued as retro input.

## Verdict
**PASS**

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection run: the book is **not** complete — **5 of 7** stories Done; frame bullets 7–9 open (enforcement, session-start restructure, the first live retro). No `/close-book` offer. Next per dependency order: **story 6, enforcement**.
