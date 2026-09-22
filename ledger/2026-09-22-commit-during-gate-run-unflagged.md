# A commit landed in the checkout while the Reviewer's gate was running there, and the gate record still names the old commit

**Id:** 2026-09-22-commit-during-gate-run-unflagged
**Type:** meta
**Opened:** 2026-09-22 (assistant-management #2 review, round 2, harness friction 1)
**Status:** OPEN
**Done:** —

**What happened.** The session that ran the fix round committed `396d98cf` and `86bbc320` at 02:14:55Z. Both
were doc-only: the owner's 679 px call, and a cleanup ledger row. They went into the one checkout, at a moment
when the Reviewer was running the book's gate there.
- **The gate run.** Run `20260922T020935Z-27290-6cac` started at 02:09:35Z, and it records "on `fc411a0d`".
- **What it actually read.** The suites after about #90 read the new tip's tree.
- **Why they share a checkout.** The Reviewer is an in-process agent working in the session's own checkout.
  The session had messaged it about the new commits, but did not check whether a gate was running before
  committing.
- **The cost.** One re-run on the tip, about 4 minutes, because the changes were docs only. A code commit would
  have made the record describe a tree that no single commit matches.

**Why the record cannot show it.** `gitIdentity()` (`test/helpers/gateRecord.js:49-59`) reads HEAD and
`git status --porcelain` once, when the record is created (`:129`). The finish path (`:147`) writes the verdict
and totals without reading git again.

**Fix shape** (from the review):
- **Before committing into a checkout another agent may be testing in,** run `npm run gate:status -- --list`,
  and wait while any record there reads RUNNING.
- **At finish,** let the gate engine read HEAD and the porcelain again, and mark a record whose tree moved
  during the run.

The first is a habit, and belongs in the Implementer's and the session's instructions for handing work to a
Reviewer. The second makes the record honest whoever forgets the habit.

**Pointer:** review `engineering-team/reviews/assistant-management/2-the-assistant-alert.md`, § Round 2 →
Findings (round 2) → Harness friction 1.
