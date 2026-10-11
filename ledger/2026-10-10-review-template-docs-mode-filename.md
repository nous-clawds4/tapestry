# The review template treats storied docs-mode reviews and storyless doc-lane reviews as one case, and would mis-file the first

**Id:** 2026-10-10-review-template-docs-mode-filename
**Type:** meta
**Opened:** 2026-10-10 (`duty-menus-and-self-maps` #1 review, Harness friction 1)
**Status:** OPEN
**Done:** —

The blockquote in `engineering-team/templates/review-checklist.md` § "Spec adherence", "Docs-mode / doc-lane variant",
makes three claims for both cases at once:
- there are no acceptance criteria;
- the claims-adherence table replaces the section;
- the review is filed "under the non-numbered form (0-intake §3)".

That fits the **doc lane**: storyless doc or typo fixes, Implementer + Reviewer. `workflows/0-intake.md` step 3 reserves
the non-numbered filename for them.

It does not fit a **Protocol-Spec docs-mode story**. That story runs the storied flow (story → ADR → skip Test Design →
Implementer → Reviewer), has acceptance criteria, and takes the numbered filename `reviews/<epic>/<n>-<slug>.md`, which
lint L4 matches to its story. Read literally, the template tells that Reviewer to drop the ACs and to file the review
under the wrong name.

Fix shape: split the blockquote into two cases.
- **Docs-mode story:** keep the AC section, add the claims-adherence table beside it, and use the numbered filename.
- **Doc lane:** as now.

A harness-definition change: it needs a CHANGELOG row (L10).

**Pointer:** `engineering-team/templates/review-checklist.md` § "Spec adherence"; `engineering-team/workflows/0-intake.md`
step 3; `engineering-team/reviews/duty-menus-and-self-maps/1-ratify-self-pointing-b.md` § Harness friction.
