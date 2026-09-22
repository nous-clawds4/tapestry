# Story 2's "no pill" browser checks pass while the check is still running, so they bite only because the mock answers at once

**Id:** 2026-09-22-setup-alert-no-pill-checks-early
**Type:** cleanup
**Opened:** 2026-09-22 (setup-status-and-alert #3, review round 3 fix; found while fixing story 3's Non-blocking 1)
**Status:** OPEN
**Done:** —

Story 3's round-3 review found that its "no pill" checks could not tell a finished answer from a check still
running (review `engineering-team/reviews/setup-status-and-alert/3-setup-alert-polish.md`, round 3,
Non-blocking 1). The pill also hides while the check runs, so `toHaveCount(0)` can pass before any answer is drawn.
Round 4 fixed story 3's spec. Story 2's spec has the same shape, and it was left alone because the round was
scoped to story 3's spec.

**Where, in `tests/brainstorm/setup-alert.spec.js`:**
- **B4** "no pill when nothing is left", "…a Map naming another provider", "…checks did not finish", "…the check
  failed" (`:251–265`): each loads the page, waits (`open()` waits 2 s, then 1 s more), and checks
  `toHaveCount(0)`.
- **B5** "no pill on /setup, …/create-account, …/follow, …/activate" (`:282–289`): the same, after `open()`.
- **B5** signed out (`:273–281`): no status read is made, so only a mutant that reads anyway and draws the pill
  could fail it, and only within the wait.

**Why it is not a failure today.** The mock answers at once, so the answer lands well inside the waits. The code
is right: story 2's review passed, and story 3's P4 now covers the setup pages' case variants with the answer
known to be in. The gap is a regression that answers late, or a slower machine, passing these checks whatever the
pill does.

**Fix shape (Tester's lane).** End each check on something only a finished answer shows, as story 3's round 4 did:
- **For B4 and B5 on the setup pages:** reach the page in-app after another page has drawn the pill, or check
  `/setup`'s "N of 3 complete" first.
- **For the failed answer and the unfinished checks,** `/setup` looks the same as while checking ("0 of 3").
  Those two need another marker, such as the mock's answer count, then a positive wait. Or accept a
  documented limit.
- **Then prove each check** against a late answer (`{ body, delayMs }` beyond the waits) on a mutant that shows
  the pill.

Story 1's spec (`tests/brainstorm/setup-status.spec.js`) was not audited for the same shape.

**Pointer:** story 3's round-4 test changes (`tests/brainstorm/setup-alert-polish.spec.js`, `expectMapNothingLeft` and
P4) and test plan § Round 4; ledger row `2026-09-21-single-run-satisfiability` ("serve the stale answer late as well
as at once").
