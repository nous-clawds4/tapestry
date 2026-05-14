# Phase 5: Review

## Role
Reviewer. See `engineering-team/roles/reviewer.md`.

## Input
- A diff (`git diff` or `git diff <base>...HEAD`).
- The story, ADR, and test plan that the diff is supposed to satisfy.

## Output
A review file at `engineering-team/reviews/<n>-<slug>.md` ending in **PASS** or **CHANGES_REQUESTED**.

## Steps

1. **Run the gate yourself:** `npm test` (and `npm run test:playwright` if applicable). Record actual results in the review.
2. **Walk the diff file by file.** Note anything unclear.
3. **Spec check.** Every acceptance criterion has a test? Every test passes?
4. **ADR check.** Files match? Layering matches? No unauthorized new deps?
5. **Concept-graph integrity:**
   - Handles still in `kind:pubkey:slug` form.
   - Firmware reinstall called out if concept definitions changed.
   - New code orients via `/summaries` rather than reading BIBLE.md.
6. **Things tests can't catch:** off-by-ones in untested branches, race conditions, security issues, secrets, leftover debug code, scope creep.
7. **House rules:**
   - Concept Graph API authority respected.
   - No new lint/typecheck/build tooling without an ADR.
8. **Write the review** using `engineering-team/templates/review-checklist.md`.
9. **State verdict:** PASS or CHANGES_REQUESTED with file:line refs.

## Calibration
Be skeptical, not pedantic. PASS means the diff is mergeable as-is. CHANGES_REQUESTED means there's at least one blocking issue. Style preferences not in house rules are not blocking.

## Per-phase commits
Yes. Commit the review file regardless of verdict. Accumulated reviews are valuable signal over time.

## On PASS — close the story out

When the verdict is PASS, do these three things in the same review commit (or a tight follow-up commit) so the story is properly retired:

1. **Set `**Status:** Done`** at the top of the story file.
2. **`git mv`** the story and its test-plan into `engineering-team/stories/done/`:
   - `engineering-team/stories/<n>-<slug>.md` → `engineering-team/stories/done/<n>-<slug>.md`
   - `engineering-team/stories/<n>-<slug>.test-plan.md` → `engineering-team/stories/done/<n>-<slug>.test-plan.md`
3. **Update path references** that now point at the moved files:
   - The story's own ADR (`engineering-team/decisions/NNNN-<slug>.md`) — `**Story:**` line.
   - The test plan's `**Story:**` line.
   - The story's `Linked artifacts` block (if it references the test-plan by path).
   - The review's own `**Story:**` / `**Test plan:**` lines if you wrote them with the pre-move paths.

This keeps `engineering-team/stories/` showing only in-flight work. Shipped stories remain readable in `done/` and the git history shows the transition.

> **For Product Owner (Phase 1):** when picking the next story number, scan **both** `engineering-team/stories/` AND `engineering-team/stories/done/` for the highest existing `<n>` — numbers are never reused.
