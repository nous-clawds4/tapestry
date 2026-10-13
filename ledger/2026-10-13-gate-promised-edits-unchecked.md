# A gate assigned the PO an edit, and nothing checked that it landed until a later role tripped over it

**Id:** 2026-10-13-gate-promised-edits-unchecked
**Type:** meta
**Opened:** 2026-10-13 (`duty-menus-and-self-maps` book close, audit §7 P11)
**Status:** OPEN
**Done:** —

Book `duty-menus-and-self-maps` had two cases. Both were edits that a gate gave the Product Owner, and both were
found only by the next role to need them:
- **Story 5's approval.** The story's Approval paragraph says: "At approval the PO commits this story together with
  the epic. The epic's story-5 entry then records the owner's answers to questions 2, 4 and 5." The approval commit
  `7ab2c955` touched only the story. Story 4's approval (`b13bb6b5`) had committed the story, the epic and `book.md`
  together. Story 5's review found the miss (non-blocking 4), and the PO fixed it after the PASS in `d234c066`. No
  per-story review covers that commit; the book close audited it.
- **Story 3's PO record.** ADR `duty-menus-and-self-maps/0003`, at its gate, asked the PO to record in the story how
  AC2's "copied verbatim", AC3's "only that key's slice" and AC5's "one answer" now read. The record was absent through
  the Implementer's first three fix passes. Each pass flagged it and rightly did not write it. The PO added it in
  `fc4d55ab`, before review.

Neither did harm: the answers were already in the story's Open questions and the ADRs. But a promise made at a gate
is checked only when a later role trips over it, and the second case ran three implementation passes without it.

Fix shape: the gate's own commit step re-reads what the gate promised other files (the story's Approval paragraph;
an ADR's asks of the PO). Each named edit is in that commit, or the commit names the edit it still owes. A Reviewer
check, "every edit a gate promised is in history", is the backstop, and story 5's review already did it by hand.

Does it port to the other flow? Partly. A Direction-mode Director records each decision in `journal.md`, but the
edits a decision promises are as unchecked there.

**Pointer:** `engineering-team/stories/done/duty-menus-and-self-maps/5-self-map-upkeep.md` § Approval;
`engineering-team/reviews/done/duty-menus-and-self-maps/5-self-map-upkeep.md` § Findings, non-blocking 4;
`engineering-team/stories/done/duty-menus-and-self-maps/3-self-maps.md` § Deviations (Implementer, fixes 1–3); audit
`engineering-team/audits/duty-menus-and-self-maps/audit.md` §7. Related rows:
`2026-09-22-linked-artifacts-not-written-at-gates` (the same genus, for a story's Linked artifacts lines) and
`2026-09-20-human-gated-approvals-leave-no-record`.
