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

**Pointer:** `engineering-team/reviews/done/duty-menus-and-self-maps/2-duty-menus-pre-nip.md` § Round 3 → Harness friction;
`git show 427b0123 -- engineering-team/decisions/duty-menus-and-self-maps/0002-the-duty-menus-pre-nip.md`;
`engineering-team/stories/done/duty-menus-and-self-maps/2-duty-menus-pre-nip.md` § Deviations, fix passes 5–7; related row
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

**Recurred 2026-10-12, other direction** (story `duty-menus-and-self-maps` #3, round 2): at ADR 0003 A2's revision 1, an
Architect script (`s3r2/r1/apply_r1.py`, session scratchpad) rewrote the PO's A2-4 line in story 3's record. The
substance was right; the role was not. Same fix shapes as above, for every role: an edit to another role's text is a
kick-back, not a script.

**Recurred 2026-10-12, commit packaging** (review of `duty-menus-and-self-maps` #3, round 2, Harness friction 1).
- The PO's A2-4 lines in story 3's record, and the rename of the departures heading, landed in `fe163bc0`, an `impl:`
  commit.
- The fix-1 block's own plan (story :643–644) put the record's hunk in an `adr:` commit. `38947382` (`adr:`) touches
  only ADR 0003 and this row.
- No rule text changed. The fix shapes above apply: one commit per role, or a role-named block per edit.

**Recurred 2026-10-12, commit packaging** (review of `duty-menus-and-self-maps` #4, non-blocking 9 and Harness
friction 1–2).
- ADR `duty-menus-and-self-maps/0004` asks for the PO's edits in "a `story:` commit of their own", and for the
  Implementer's item-1 line "after the PO's `story:` commit". `899253ee` (`story:`) also carries the Implementer's
  Deviations block in story 4 and its item-1 line in story 3 (:660–662). `ae888a7e` (`impl:`) does not touch story 3.
  The story's "Commits" bullet (:445–447) says the `story:` commit carries "the PO's text".
- No rule text changed. The same fix shapes apply: one commit per role, or a role-named block per edit.
- **What went right:** ADR 0004's Clarifications after acceptance (KB-1 to KB-3) landed in an `adr:` commit of their
  own (`0311cca3`) before the next `impl:` commit, as fix shape (b) asks. But the record says "each by option (a)"
  without naming who chose it. ADR 0003's amendments went through owner gates. Each clarification changes no rule,
  and the Reviewer audited each one. That is the gap row `2026-10-08-new-browser-spec-amendments-unratified` names for
  test plans: who ratifies a no-rule-change amendment. Fix shape: an accepted ADR's post-acceptance section names its
  approver, or says that the Reviewer ratifies it by audit.

**Recurred 2026-10-12, the approver of a post-acceptance section** (review of `duty-menus-and-self-maps` #5, Harness
friction 1).
- ADR `duty-menus-and-self-maps/0005`'s "Clarifications after acceptance" (KB-C2, KB-RD-1, KB-RD-2) landed in an
  `adr:` commit of their own (`8287d951`), between the Implementer's first pass (`984c7cc8`) and the kick-back pass
  (`930c5454`), as fix shape (b) asks. The Implementer carried the text verbatim and edited no ADR.
- The section again names no approver. Two clarifications change no rule (the Reviewer audited each). KB-C2 adds an
  open question that it says "the owner has not confirmed" (Treasure Maps § 13 question 13); it answers nothing, so
  the spec states no new rule, but whether the owner keeps the question on row `2026-10-12-bare-39998-ta-discovery`
  is still the owner's call. Same fix shape as the story-4 note: the section names its approver, or says that the
  Reviewer ratifies it by audit and the owner confirms any question it opens.

**Note, 2026-10-13 (book close `duty-menus-and-self-maps`, audit §7 P5–P6).**
- Two more mixed-role commits of the book, not named above. Each names both roles in its subject, and neither changes
  rule text:
  - `fc4d55ab` (`adr: propose Amendment A1 to ADR 0003; PO records the owner's answers …`) carries the PO's "Owner's
    answers to ADR 0003's questions" record in story 3 beside the Architect's A1 proposal;
  - `8a9a420d` (`story: owner confirms ADR 0003 A1-4's AC3 departure by name …`) edits ADR 0003 to record the owner's
    confirmation.
- The question KB-C2 opened: at story 5's review gate (2026-10-13) the owner was asked whether Treasure Maps § 13
  question 13 should stay on row `2026-10-12-bare-39998-ta-discovery` or move. The owner answered "Proceed." and did
  not move it, so it stays on that row for the docs pass after the book.
- Does it port to the other flow? Yes. A Direction-mode book commits the same phases, and its Director answers the
  gates, so "who approves a post-acceptance section" needs the same answer there.

**Note, 2026-10-13 (the owner's approvals after the close of `duty-menus-and-self-maps`).** The owner confirmed that
Treasure Maps § 13 question 13, the question KB-C2 opened, stays on row `2026-10-12-bare-39998-ta-discovery` for the
docs pass after the book. That makes the call the story-5 note above leaves to the owner, for this question. Only the
placement is confirmed, and the question itself stays open. The fix shape is unchanged, and the row stays OPEN.
