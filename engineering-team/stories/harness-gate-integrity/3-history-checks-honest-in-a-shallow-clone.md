# Story 3: The lint's history checks tell the truth in a shallow clone

**Status:** Approved
**Created:** 2026-10-09
**Type:** Bug

## Background
Cloud sessions clone the repo shallow (about 50 commits). In a shallow clone git treats the oldest
fetched commit, the *boundary*, as parentless: it seems to add every file in the tree. Two
`harness-lint` checks read git history and take the boundary at face value:

- **L10 (changelog-touch)** looks for the newest commit that touched a harness-definition path. When
  no real harness change falls inside the fetched history, it finds the boundary and reports it as
  a harness change with no CHANGELOG row. Seen three times: `aa9b373` (2026-10-07), `f932e16`
  (2026-10-09, book `assistant-outbox-relays`) and `695fac4` (2026-10-09). None of the three touched
  a harness-definition path.
- Even when the commit L10 finds did touch the CHANGELOG, the check can still fail. With thousands of
  file names to scan, the check stops reading at the first match, and the script's strict pipe
  settings count that early stop as a failure. A fresh one-commit-deep clone fails this way, which
  is why adding a CHANGELOG row for the named commit does not help: the next shallow clone names
  whatever commit sits at its own boundary.
- **L9 (stale-headers)** compares the `Last updated:` header of `BIBLE.md` / `OPERATIONS.md` with
  the file's last git change. In a shallow clone that last change can be the boundary date rather
  than the real one, so a header that is correct can read as stale.

The cost is a red that means nothing. The SessionStart digest reports "harness-lint: 1
violation(s)", and the `harness-lint` suite fails in every `npm test` run (its "real repo lints
clean" test), so the stack-free gate reads FAIL for a reason outside the work. Reviews have
recorded it as "a pre-existing L10 violation (another session's docs commit)", and that misreading
travelled into a promotion status. One session was asked to "fix" it by adding a CHANGELOG row for
a commit that changed no harness file. CI is unaffected: it checks out full history.

**Who is affected:** every session that works from a shallow clone (cloud sessions) and anyone who
reads its gate result, review, or promotion status.

Recorded as ledger row `ledger/2026-10-07-shallow-clone-trips-lint-l10.md`; this story closes it.

## User-facing description
As a session working from a shallow clone, I want the lint's history checks to report only what the
history they can see actually shows, and to say plainly when the history is too short to judge, so
that a red lint or a red gate always means a real problem in the tree.

## Acceptance criteria
Testable from the outside: the lint's printed lines and exit status, in fixture repositories and
in a shallow clone of this repo.

- [ ] **AC1: the boundary is not a harness change (L10).** Given a shallow clone in which the newest
      commit the L10 query finds is the clone's boundary commit, when `harness-lint` runs, then it
      reports no L10 violation and prints an `INFO` line that names L10 and the boundary commit, says
      the history is shallow, and names the remedy (`git fetch --unshallow`). With nothing else wrong,
      the lint exits 0.
- [ ] **AC2: real L10 violations are still caught.** Given a shallow clone whose newest
      harness-definition commit lies *inside* the fetched history (it has its parent) and did not
      touch the CHANGELOG, `harness-lint` still reports the L10 violation naming that commit. In a full
      clone, L10's outcomes are unchanged: newest harness-definition commit without the CHANGELOG →
      violation; with it → clean.
- [ ] **AC3: a large commit that touched the CHANGELOG satisfies L10.** Given the newest
      harness-definition commit touched `engineering-team/CHANGELOG.md` among thousands of other
      files, `harness-lint` reports no L10 violation.
- [ ] **AC4: L9 does not misread the boundary either.** Given a shallow clone in which
      `BIBLE.md`'s (or `OPERATIONS.md`'s) only visible git change is the boundary commit, `harness-lint`
      reports no L9 violation for that file and prints an `INFO` line saying its header could not be
      checked against shallow history. Given a full clone, a header more than 14 days behind the
      file's last change is still an L9 violation.
- [ ] **AC5: the repo itself lints clean from a shallow clone.** Given a shallow clone of this
      repo's current tree (one commit deep, and 50 commits deep), `bash scripts/harness-lint.sh`
      reports 0 violations, and the `harness-lint` suite's "the real repo lints clean" test passes
      there.

## Concepts touched
None. This is harness tooling only; no concept-graph handles are involved.

## Out of scope
- **Deepening or unshallowing the clone at session start.** It needs the network and time; the ledger
  row offered it as the costlier alternative. A session can still run `git fetch --unshallow`
  itself, and AC1's INFO line tells it to.
- **Other git-history readers outside `harness-lint`**, such as `/whats-open`'s "harness definition
  changed since your branch diverged" section and `scripts/harness-stats.sh`. They are not known to
  misfire. If they do, that is a new ledger row, not this story.
- **CI's checkout.** It already fetches full history (`fetch-depth: 0`).
- **A CHANGELOG row for `695fac4`, `aa9b373` or `f932e16`.** None of them changed a
  harness-definition path, so the changelog has nothing to record.
- Any product/runtime code, firmware, or concept change.

## Open questions
None.

## Linked artifacts
- Book: `engineering-team/audits/honest-test-gate/book.md` (joined 2026-10-09; the frame's "a suite
  the environment can't run says SKIP and why")
- Ledger row closed by this story: `ledger/2026-10-07-shallow-clone-trips-lint-l10.md`
- ADR: none (Standard strictness: a bug with an obvious fix skips Architecture). The fix extends the
  existing checks in `scripts/harness-lint.sh` under ADR `harness-self-improvement/0001`.
- Test plan: `engineering-team/stories/harness-gate-integrity/3-history-checks-honest-in-a-shallow-clone.test-plan.md`
  (tests in `test/harness-lint.test.js`, section "shallow clones (harness-gate-integrity #3)")
- Review: (filled in after Review phase)

Link by path only — never record verdicts or round history in this file (bare `KICK_BACK`/`CHANGES_REQUESTED` tokens in gate/round context trip harness-lint L14; backticked mentions are exempt). Outcomes live in the review file and, in Direction mode, the run journal. (ADR harness-gate-integrity/0002.)
