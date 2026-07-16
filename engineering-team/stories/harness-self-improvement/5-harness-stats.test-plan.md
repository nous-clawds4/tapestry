# Test Plan: Story 5 — harness-stats

**Story:** `engineering-team/stories/harness-self-improvement/5-harness-stats.md`
**ADR:** `engineering-team/decisions/harness-self-improvement/0005-harness-stats.md`
**Date:** 2026-07-02

## Coverage map

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1a phase-commit counts (per prefix + per epic + unattributed) | `phase commits are counted per prefix, with per-epic attribution and an unattributed bucket` | `test/harness-stats.test.js` | fixture-integration |
| AC-1b verdicts (last-token rule via the shared parser, both orderings; kick-back rate) | `review verdicts use the shared last-token rule: PASS-final and CR-final both classified` | 〃 | 〃 |
| AC-1b churn | `re-review churn counts story numbers with more than one review file` | 〃 | 〃 |
| AC-1c books (exact closed duration; open age; open/closed tallies) | `book throughput: closed-book duration is exact; open-book age is reported` | 〃 | 〃 |
| AC-1d cycle time + honest coverage | `cycle time: story→review elapsed from controlled timestamps, and the coverage line is honest` (fixture includes `9-never-mentioned.md`, which must appear in the denominator) | 〃 | 〃 |
| AC-1 summary block | `a summary block closes the report (the paste-into-the-retro unit)` | 〃 | 〃 |
| AC-2 always exit 0 | `the script always exits 0 — even in an empty, git-less directory` (plus every fixture test asserts exit 0) | 〃 | 〃 |
| AC-3 shared verdict source | the classification test exercises the shared parser end-to-end; **no-second-copy** verified at Review by inspection (grep: the last-token program exists once, in `scripts/lib/review-verdict.awk`) + the lint suite's 25 tests pin the refactored `review_verdict()` behavior | suite + Review | mixed |
| AC-4 workflow-6 step 7 citation flip | reviewer inspection (one-line prose change) | Review | reviewer-run |
| AC-5 suite integration + existing suites green | registration in `test/test.js` (require/banner/summary/conjunction) + full-run parity check | `test/test.js` | integration |
| AC-6 no network / no stack | fixtures run in temp dirs with no stack; the empty-dir test runs git-less | 〃 | fixture-integration |
| AC-7 def-path registration + CHANGELOG + lint clean | reviewer inspection + `harness-lint.sh` (L10 + the def-file self-listing property) | Review + lint | mixed |
| Real-repo contract | `the real repo: runs, exits 0, prints the summary block` (incl. the coverage-line regex) | `test/harness-stats.test.js` | repo-integration |

## Edge cases

- [x] **Controlled timestamps**: all fixture commits use `GIT_AUTHOR_DATE`/`GIT_COMMITTER_DATE` (noon UTC) — cycle-time (3d) and closed-book duration (10d) assertions are exact, not tolerant.
- [x] **Open-book age** depends on the real clock — asserted by format (`\d+d`), not value.
- [x] **CR-final vs PASS-final both orderings** (2-beta: PASS→CR; 3-gamma + amended: CR then PASS in a *separate* file — also the churn case).
- [x] **Non-phase commits** (`chore:`) present in the fixture — must not pollute prefix counts.
- [x] **Unmatched story** (`9-never-mentioned.md`) — coverage line reads "matched 1 of 2 stories"; never dropped.
- [x] **Empty git-less directory** — exit 0 (the instrument never gates).
- [ ] Books with malformed dates — degrade to "n/a" per ADR; not separately fixture-tested (covered by the always-exit-0 contract; add a fixture if it ever regresses).

## Test infrastructure

- Node built-in runner via `test/test.js` (registered per convention). Fixture repos in temp dirs, `git init` + dated commits; the seeded tree carries 2 epics, 2 stories, 4 reviews, 2 books. No stack, no network.
- The suite exercises `scripts/lib/review-verdict.awk` indirectly through the script — the shared-source property itself is a Review inspection (a grep can't prove "consumed by both"; the lint suite's 25 green tests prove the refactor preserved lint's behavior).

## How to run

```
npm test
```

Standalone: `node -e "require('./test/harness-stats.test.js').run().then(r=>process.exit(r.fail?1:0))"`

## Verification

The new tests fail with the current code. Confirmed 2026-07-02 at commit `4c390cdf` (pre-implementation): all 8 tests fail because `scripts/harness-stats.sh` does not exist — the feature itself; the harness-lint suite is untouched (25/25):

```
  ✗ the script always exits 0 — even in an empty, git-less directory
      bash: /home/user/tapestry/scripts/harness-stats.sh: No such file or directory
  … (same for phase counts, verdicts, churn, books, cycle time, summary block)
  ✗ the real repo: runs, exits 0, prints the summary block
      bash: /home/user/tapestry/scripts/harness-stats.sh: No such file or directory
suite: 0 passed, 8 failed
lint suite: 25 passed, 0 failed
```
