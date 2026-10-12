# Story 3's record and ADR 0003's Amendment A2 were left with four small bookkeeping gaps after review round 2

**Id:** 2026-10-12-self-maps-record-loose-ends
**Type:** docs
**Opened:** 2026-10-12 (`duty-menus-and-self-maps` #3, review round 2, non-blocking findings 21–24)
**Status:** DONE
**Done:** 2026-10-12 (`duty-menus-and-self-maps` #4, ADR 0004 sub-decision 11): each item done by the role it names.

Story 3 (Self-Maps) is Done. None of these four gaps changes spec text, and none gives a reader a second reading.
Each belongs to one role, and any of them can be fixed before the epic closes out. Line numbers are as of `11cc0008`.

1. **Implementer.** The story's "Implementer, round 2 fix 1" block lists four kick-backs as open
   (`engineering-team/stories/duty-menus-and-self-maps/3-self-maps.md`:633–642). Three were already done:
   - the departures heading (:500, in `fe163bc0`);
   - the A2-2 markers (ADR 0003:1718 and :2058, in `38947382`);
   - the approval line (`11cc0008`).

   Add a dated close-out line under the block saying so, and that item 2 below is the one still open (review NB21).
2. **Architect.** ADR 0003, Verification, AC3 (:1482–1485). The "§ 3's sentence reads …" part of the A2-1/A2-5 marker
   sits on the allowance bullet, above the § 3 quote it amends. Move it into its own marker after :1485 (review NB22).
3. **Architect.** ADR 0003, A2's Questions for the owner (:2429–2440), still read as an open gate. Add one past-tense
   sentence: approved on 2026-10-12, without the extra reader rule, as "Status of A2" (:2190–2193) says (review NB23).
4. **PO.** The record's AC3 "only that key's slice" gloss (story :448–456) lists only stale copies as what can show
   outside the slice. Since A2-1, a List the key retracted can also show as a List with no members (Treasure Maps
   § 9.2, third and fourth cases, :415–416). Add "or, for a List the key retracted, a List with no members (Treasure Maps
   § 7)" (review NB24).

**Pointer:** `engineering-team/reviews/duty-menus-and-self-maps/3-self-maps.md` § Round 2, Findings (round 2); ADR
`engineering-team/decisions/duty-menus-and-self-maps/0003-self-maps.md` Amendment A2; related row
`2026-10-12-self-maps-spec-fold-forwards`.

**Note, 2026-10-12 (story 4, ADR `duty-menus-and-self-maps/0004` sub-decision 11).** Each item was done by the role it
names, in the ADR's order:
- items 2 and 3, by the Architect in ADR 0003, with ADR 0004's `adr:` commit: the A2-5 marker sits in a line of its
  own after the § 3 quote in Verification, AC3, and A2's Questions for the owner end with the approval line;
- item 4, by the PO in story 3's record, in a `story:` commit: the AC3 slice gloss gains the List the key retracted;
- item 1, by the Implementer: a dated line under the record's "Implementer, round 2 fix 1" block.

The Implementer checked that items 2–4 are in before closing the row. DONE.
