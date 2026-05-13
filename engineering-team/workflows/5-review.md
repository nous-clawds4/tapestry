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
