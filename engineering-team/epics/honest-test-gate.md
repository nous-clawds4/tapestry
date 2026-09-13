# Epic: honest-test-gate

**Created:** 2026-09-12
**Status:** Active
**Book:** `engineering-team/audits/honest-test-gate/book.md`
**Provenance:** `engineering-team/stories/_intake.md` 2026-08-18 — "Make the test gate fast and honest
(umbrella: the instrument cluster)"; proposed as H1 at the 2026-09-12 `/whats-open` meta
escalation and confirmed by the operator the same day.

## Goal

The test gate finishes inside the tool limits of the session that runs it, its verdict and exit
status are always true, and a red always means signal — so that nobody is trained to expect red and
shrug.

## Why it matters

The 2026-08-18 harness review traced the hours-class losses in the corpus to the gate's
*instruments*, not its rules: runs that outlast the tool, exit codes that report the wrong answer,
and reds that mean nothing. A gate whose instrument lies turns every control built on it — Reviewer
re-runs, Director Gate 4, the book-close certification — into noise. About a fifth of the open meta
rows in OPEN.md are this one problem.

## Stories

`stories/honest-test-gate/`:

1. **gate-result-tells-the-truth** — a run's verdict, exit status, progress and skip counts are
   true and readable afterwards, however it was launched or ended. Rows 103, 105, 111, 157, 227,
   235, 263 (plus the runner half of 104/106 and 192). **Approved.**

Anticipated, not yet planned:

2. **The gate fits a session** — the gate a role runs for its story actually scopes and finishes
   inside one tool call; the full run stays for pre-merge and book close; the Reviewer's gate
   includes the stack-free run. Rows 83, 181, 271. Likely needs an ADR on gate composition.
3. **Skip, don't fail** — a suite whose environment is missing reports SKIP with its reason, never
   FAIL and never a crash. Rows 104/106, 191, 192.

The assertion sweep (rows 59, 60, 108, 109, 126) is `test-suite-hermeticity` #2, in the same book.

## Out of scope (whole epic)

- Rewriting individual assertions — `test-suite-hermeticity`'s territory.
- Playwright / e2e in CI and the CI job's composition — `test-hermeticity-ci`'s deferred scope.
- The session tool's own background-completion notice — outside this repo.

## Decisions

(none yet)
