# Story 5: harness-stats — the retro runs on measurement, not anecdote

**Status:** Done
**Created:** 2026-07-02
**Approved:** 2026-07-02 (operator, in-session gate — approved as drafted incl. all three recommendations)
**Done:** 2026-07-02 (review PASS — `reviews/harness-self-improvement/5-harness-stats.md`)
**Type:** Feature

## Background

The harness is self-measuring and nobody is reading the instruments. ~205 phase-prefixed commits (`story:`/`adr:`/`test:`/`impl:`/`review:`), 60+ review files with a canonical two-valued verdict, and book manifests with Opened/Closed dates already encode: which gate kicks back most, how long stories take per phase, how often re-reviews happen, and whether books close or accumulate. The harness review noted the tell: review commits *outnumber* impl commits on main — re-review churn, quantified by accident. Story 3's retro step says "cite `scripts/harness-stats.sh` output when available" — this story makes it available, so retro proposals ("gate X is weak", "phase Y drags") argue from numbers.

This is the **measure** stage of the loop (review §5.5), and the last purely additive mechanism before enforcement (6) and the restructure (7).

## User-facing description

As an operator running a book-close retro (or just wondering how the process is performing), I want one command that derives gate kick-back rates, phase cycle times, re-review churn, and book throughput from the repo's own conventions, so process claims are checkable numbers instead of impressions.

## Acceptance criteria

- [ ] Given the repo root, `bash scripts/harness-stats.sh` prints a report with four sections, then a compact **summary block** (the paste-into-the-retro unit): **(a) phase commits** — counts per prefix, overall and per epic; **(b) review verdicts** — total reviews, final-PASS vs final-CHANGES_REQUESTED (the operator-ratified last-token rule), re-review files per story (churn), and the kick-back rate; **(c) books** — opened vs closed, each open book's age, each closed book's open→close duration; **(d) story cycle times** — first-phase-commit → review-commit elapsed per story *where commit messages are matchable to a story*, with an explicit **coverage line** ("matched N of M stories") — unmatchable stories are counted, never silently dropped.
- [ ] Given any repo state, the script **always exits 0** — it is an instrument, not a gate (the ADR-0004 principle: advisory surfaces never poison exit codes or hooks).
- [ ] Given that harness-lint already parses review verdicts, the last-token rule lives in **one shared source** consumed by both scripts — no second copy of the verdict parser (mechanism is the Architect's call).
- [ ] Given `workflows/6-book-close.md` step 7, its "cite `scripts/harness-stats.sh` output *when available*" becomes a direct instruction (the script now exists).
- [ ] Given `npm test`, a `harness-stats` suite covers the parsing logic against fixture repos with **controlled commit timestamps** (via `GIT_AUTHOR_DATE`/`GIT_COMMITTER_DATE`): phase-prefix counting, final-verdict classification (both orderings), re-review counting, book duration math, cycle-time matching + the coverage line, and always-exit-0; plus a real-repo smoke test (runs, exits 0, summary block present). Existing suites stay green.
- [ ] Given the script needs no network and no stack (bash + git + coreutils), it runs identically in remote sessions.
- [ ] Given this story's commits, `scripts/harness-stats.sh` is registered in `scripts/harness-def-paths.txt` (it shapes retro behavior — definition, not record), the CHANGELOG carries the row, and `harness-lint.sh` stays clean.

## Concepts touched

None — harness tooling only. (Stack not required.)

## Out of scope

- **Defect-escape tracking** (prod `fix:` commits naming the review they escaped) — needs a commit-message convention that doesn't exist yet; a candidate retro proposal, not this story.
- Trend lines, historical snapshots, or any output persistence — the script derives fresh from git each run.
- Wiring into `/whats-open` or the SessionStart hook — stats are on-demand + retro-time; the roll-up stays fast and focused (story 6 decides hook contents).
- Judging the numbers — thresholds and "is this bad?" stay human/retro territory.

## Open questions

*All resolved at the Planning gate (2026-07-02, operator):*

1. **Verdict-parser sharing — RESOLVED:** extract to a shared file consumed by both scripts.
2. **Cycle-time matching — RESOLVED:** conventional-pattern matching with an honest coverage line.
3. **Classification — RESOLVED:** full cycle including Test Design.

## Linked artifacts

- ADR: `engineering-team/decisions/harness-self-improvement/0005-harness-stats.md` (Accepted 2026-07-02)
- Test plan: `engineering-team/stories/harness-self-improvement/5-harness-stats.test-plan.md`
- Review: `engineering-team/reviews/harness-self-improvement/5-harness-stats.md` (PASS, 2026-07-02)
