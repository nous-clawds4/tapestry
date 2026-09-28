# A review's own suggested replacement text is adopted verbatim without being checked as a claim, so its defects spread before step 10 catches them

**Id:** 2026-09-28-review-suggested-wording-unverified
**Type:** meta
**Opened:** 2026-09-28 (tagging-edges #2 re-review, harness friction 1)
**Status:** OPEN
**Done:** —

**What was seen.** Story `tagging-edges` #2's round-1 review asked for specific replacement sentences and one regex.
Its verify pass tried to refute the findings, not the replacement text, and the Implementer adopted the text verbatim.
The re-review (reviewer role step 10) then found defects in four of them — the BIBLE §16 "changes nothing" wording
(false on a confirmed run), "after which the re-run performs an ordinary pass" (a scoring run can take the freed
slot), the path-redaction rule's "any absolute path", and "a hand-run … is refused" (not under a flock on another
file) — one round late, after the text had spread to as many as five documents.

**Fix shape.** In `engineering-team/workflows/5-review.md` (or the review template), a review's verify pass checks each
asked sentence and each suggested regex as a claim before the review is saved; step 10 stays as the backstop.

**Pointer:** `engineering-team/reviews/tagging-edges/2-gap-filling-pass-and-backfill.md` § "Re-review" → Harness
friction 1; `engineering-team/roles/reviewer.md` step 10.
