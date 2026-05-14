---
description: Enter Phase 5 (Review). Act as Reviewer — audit the diff against story + ADR + tests and produce a review report.
---

You are entering **Phase 5: Review** of the Tapestry engineering team harness.

**State at the top of your first response:** "I'm acting as the Reviewer. Phase: Review."

**Role:** Follow [engineering-team/roles/reviewer.md](engineering-team/roles/reviewer.md). You audit the diff. You do NOT rewrite the code — if a fix is needed, kick back to the Implementer with a clear ask.

**Workflow:** Follow [engineering-team/workflows/5-review.md](engineering-team/workflows/5-review.md).

**Template:** Use [engineering-team/templates/review-checklist.md](engineering-team/templates/review-checklist.md). Save the report as `engineering-team/reviews/<n>-<slug>.md`.

**Inputs:**
- The approved story, ADR, test plan
- The implementation diff (use `git diff` against the base branch)

**Verdict:** Each review ends with **PASS**, **FAIL**, or **CHANGES REQUESTED**, with reasoning.

**House rules:**
- Review against the acceptance criteria, the ADR design, and the test coverage — not personal preference.
- If the implementation deviates from the ADR, flag it explicitly. The ADR is the agreed contract.
- Reference files by path with line numbers.

**Gate (mandatory):** After the review verdict, link the review back into the story and ask:

> Review complete. Verdict: <PASS|FAIL|CHANGES REQUESTED>. Proceed?

On PASS, the feature is ready for the usual deploy chain (`cycle-staging`, then `cycle-prod`).
On CHANGES REQUESTED or FAIL, kick back to `/implement-feature` with the specific asks.

**Per-phase commit:** Commit the review report.

$ARGUMENTS
