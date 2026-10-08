# The review template's "On PASS" heading is read as the verdict, so a CHANGES_REQUESTED review lints as PASS-final

**Id:** 2026-10-07-on-pass-heading-reads-as-verdict
**Type:** meta
**Opened:** 2026-10-07 (manage-treasure-map book close, retro; first seen at story 2's review 1)
**Status:** OPEN
**Done:** —

`scripts/lib/review-verdict.awk` takes the **last** `PASS` / `CHANGES_REQUESTED` token on a heading or bold line as a
review's verdict. `engineering-team/templates/review-checklist.md` ends with `## On PASS (same commit)` *after*
`## Verdict`, so a review written to the template and ending CHANGES_REQUESTED reads as PASS-final, and harness-lint L1
reports "review is PASS-final but story status is 'Approved'". manage-treasure-map #2's review 1 hit it: its commit
went lint-red until the not-applicable section was deleted (`80168e3`). Reviewers either delete the section by hand on
every CHANGES_REQUESTED, or lint lies.

**Fix shape.** Rename the template's heading so it carries no verdict token (for example `## Close-out on a pass`, as
the my-assistants reviews already did by hand), or move it above `## Verdict`; and add a lint fixture: a template-shaped
CHANGES_REQUESTED review must read `CR`.

**Pointer:** `engineering-team/audits/manage-treasure-map/audit.md` § 7.
