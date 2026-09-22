# Story 2's "no pill" browser checks pass while the check is still running, so they bite only because the mock answers at once

**Id:** 2026-09-22-setup-alert-no-pill-checks-early
**Type:** cleanup
**Opened:** 2026-09-22 (setup-status-and-alert #3, review round 3 fix; found while fixing story 3's Non-blocking 1)
**Status:** OPEN
**Done:** —

Story 3's round-3 review found that its "no pill" checks could not tell a finished answer from a check still
running (review `engineering-team/reviews/done/setup-status-and-alert/3-setup-alert-polish.md`, round 3,
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
- **B11**'s two "stays when there is no pill" tests (`:398`, `:412`), and **B12**'s first-load check at five widths
  (`:440`). Both were added by story 3's round-4 review (Non-blocking 1).

**Measured by the round-4 review,** on its M7 and an env-switched copy of story 2's spec. M7 hides the pill while
the check runs and draws it wrongly once answered. With the answer at once, B4's "nothing left", both B11 tests and
the five B12 tests fail, 8 of 8. With the answer 3.5 s late, all eight pass.

**Why it is not a failure today.** The mock answers at once, so the answer lands well inside the waits. The code
is right: story 2's review passed, and story 3's P4 now covers the setup pages' case variants with the answer
known to be in. The gap is a regression that answers late, or a slower machine, passing these checks whatever the
pill does.

**Fix shape (Tester's lane).** End each check on something only a finished answer shows, as story 3's round 4 did:
- **For B4, B5 on the setup pages, B11 and B12:** reach the page in-app after another page has drawn the pill.
  Or, where nothing is left to draw one, confirm the answer in-app on `/setup` ("N of 3 complete") and come
  back.
- **For the failed answer and the unfinished checks,** `/setup` looks the same as while checking ("0 of 3").
  Those two need another marker, such as the mock's answer count, then a positive wait. Or accept a
  documented limit.
- **Then prove each check** with a late answer on an M7-style mutant. Story 2's mock (`:123–129`) does not accept
  `{ body, delayMs }` yet, so it needs that first. Make the answer later than the waits. The mutant hides the pill
  while checking and shows it wrongly once answered (ledger row `2026-09-21-single-run-satisfiability`, round-4
  clause).

Story 1's spec (`tests/brainstorm/setup-status.spec.js`) was not audited for the same shape.

**Pointer:** story 3's round-4 test changes (`tests/brainstorm/setup-alert-polish.spec.js`, `expectMapNothingLeft` and
P4) and test plan § Round 4; ledger row `2026-09-21-single-run-satisfiability` ("serve the stale answer late as well
as at once").
