# Phase 5: Review

## Role
Reviewer. See `engineering-team/roles/reviewer.md`.

## Input
- A diff (`git diff` or `git diff <base>...HEAD`).
- The story, ADR, and test plan that the diff is supposed to satisfy.

## Output
A review file at `engineering-team/reviews/<epic-slug>/<n>-<slug>.md` (same epic folder as the story) ending in **PASS** or **CHANGES_REQUESTED**.

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

## On PASS — mark the story Done

When the verdict is PASS, set `**Status:** Done` at the top of the story file in the same review commit. **That's the whole per-story close-out — do not move individual files.** Retirement happens per-epic, not per-story, so an epic's stories stay together in `stories/<epic-slug>/` while the epic is still in flight (even if some are already Done). Save your review under the epic too: `engineering-team/reviews/<epic-slug>/<n>-<slug>.md`.

## Completion detection — offer to close the book

The moment a *book of work* can become complete is always "the last story just passed review." So after a PASS, check the book this story belongs to (`engineering-team/audits/<book-slug>/book.md`):

- **PRD-backed (structural):** are all stories tracing to the anchor's §sections now `Done` and their epics closed? If yes → the book looks complete.
- **No-PRD (semantic):** is every bullet of the acceptance frame now satisfied by what shipped? If yes → the book looks complete.

When a book looks complete, **offer — don't auto-run:**

> Your original ask was *<anchor summary>*. What's shipped now covers it: *<evidence, linked to stories>*. This book of work looks complete — want me to close it? I'll generate the build audit and the PRD {addendum|seed}.

- **Yes** → run `/close-book` (Phase 6). The human's "yes" is the invocation.
- **Not yet / also need X** → extend the acceptance frame (or note the remaining PRD scope), leave the book `Open`, write nothing.

The system never *declares* a book done — it *proposes* done and the human ratifies. That's the safety valve against false-positive completion. A natural-language "I think that's everything" triggers the same offer — see `CLAUDE.md` → "Intent Detection".

## Epic close-out

When an epic ships (its branch is merged to the shared line), move the epic's whole folders under `done/` — **one `git mv` per area, on the directory, not per file:**

- `engineering-team/stories/<epic-slug>/`     → `engineering-team/stories/done/<epic-slug>/`
- `engineering-team/decisions/<epic-slug>/`   → `engineering-team/decisions/done/<epic-slug>/`
- `engineering-team/reviews/<epic-slug>/`     → `engineering-team/reviews/done/<epic-slug>/`

Because each epic owns a disjoint folder, these moves never collide across branches, and the relative paths *inside* the folder (story ↔ test-plan ↔ ADR ↔ review) stay intact — no link-rewriting needed. Set `**Status:** Done` on the epic file (`epics/<epic-slug>.md`). Everything outside `done/` is active, fair-game work; everything under `done/` is shipped and read-only by convention.

> **Numbering note (Phase 1):** story numbers are scoped per epic folder — scan the epic's own folder (and its `done/<epic-slug>/` counterpart) for the highest `<n>`. Numbers are unique within an epic, not globally.
