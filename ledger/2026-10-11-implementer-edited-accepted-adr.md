# An Implementer fix pass rewrote an accepted ADR's rule text, and an owner-gate ADR revision landed in an `impl:` commit

**Id:** 2026-10-11-implementer-edited-accepted-adr
**Type:** meta
**Opened:** 2026-10-11 (`duty-menus-and-self-maps` #2, review round 3, Harness friction 1)
**Status:** OPEN
**Done:** —

In story `duty-menus-and-self-maps` #2, round 3, commit `427b0123` (subject `impl: round 3 of duty-menus-pre-nip …`)
carries three kinds of change to ADR `duty-menus-and-self-maps/0002`:
- the owner's gate on A1-9 to A1-12 (Revision 4, the replaced A1-11, the status line) — Architect-phase text;
- fix pass 5 of the Implementer adding "unless they are listed on it" to A1-11's approved rule and four restatements,
  unmarked at first (story Deviations, fix pass 5);
- fix pass 6 adding an "After approval" paragraph that marks those words as awaiting the Architect's ratification.

`engineering-team/roles/implementer.md` step 8 says: "If something forces you outside the ADR, stop. Surface it to the
user. The Architect needs to amend the ADR before you proceed." The edit was right in substance and was logged in the
open, and a verifier caught the unmarked first version. But the harness let an Implementer pass change an accepted
ADR's normative text, and nothing in the per-phase commit rules says that Architect-phase text decided at a gate during
a workflow run gets its own `adr:` commit. The review dispatch for round 3 then described all of `427b0123`'s ADR
changes as "Architect-phase and owner-approved", which the ADR's own "After approval" paragraph contradicts.

Fix shapes: (a) a line in `roles/implementer.md` and `workflows/4-implementation.md`: the Implementer never edits an
ADR, even to mark its own deviation; it logs the deviation in the story and kicks the ADR text back; (b) the workflow
scripts that run gates inside a story commit gate-time ADR revisions as `adr:` before the next `impl:` commit; (c) a
review-dispatch template that derives "which ADR changes are Architect-phase" from commit prefixes rather than asserting
it.

**Pointer:** `engineering-team/reviews/duty-menus-and-self-maps/2-duty-menus-pre-nip.md` § Round 3 → Harness friction;
`git show 427b0123 -- engineering-team/decisions/duty-menus-and-self-maps/0002-the-duty-menus-pre-nip.md`;
`engineering-team/stories/duty-menus-and-self-maps/2-duty-menus-pre-nip.md` § Deviations, fix passes 5–6; related row
`2026-10-11-duty-menus-adr-0002-ratification-open`.

**Recurred 2026-10-12** (review of `duty-menus-and-self-maps` #3, Harness friction 1).
- Commit `bc37a62c` (`impl: apply ADR 0003 A1 to the specs …`) carries Architect-phase text in ADR
  `duty-menus-and-self-maps/0003`:
  - the status line and the "Approved" line;
  - "Status of A1";
  - A1's "After approval (revision 3)" paragraph;
  - A1-4's AC3-departure bullet and "Named after approval";
  - "Not A1's" going from three points to four;
  - an A1-3 marker in question 1.
- It also carries edits to the PO's record in the story's § Deviations.
- The story's unlabelled "Fix 7" block lists those edits beside the Implementer's own § 9.2 edits, with no role
  named. Fix 6 had said that § 9.2 Meaning and Confirmed duties needed the Architect, and A1's "exact edits" give
  neither of them an edit. Fix 7 then edited both, restating A1-4's approved rule. That was right in substance, but
  it was done without an amendment marker.
- No rule text of ADR 0003 changed, and ADR 0002 is untouched.

Same fix shapes as above. Shape (b) would have split `bc37a62c` into `adr:`, `story:` and `impl:` commits.
