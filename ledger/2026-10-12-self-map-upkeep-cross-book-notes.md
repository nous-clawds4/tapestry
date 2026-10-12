# Story 5's rules for keeping a self-Map true, for book assistant-self-map and the curation code

**Id:** 2026-10-12-self-map-upkeep-cross-book-notes
**Type:** docs
**Opened:** 2026-10-12 (`duty-menus-and-self-maps` #5, ADR 0005 sub-decision 10)
**Status:** OPEN
**Done:** —

Story 5 of `duty-menus-and-self-maps` settled what a key does with its curation copies when it stops, that removing a
self-entry is no stop, that `["status", "retracted"]` means "stopped" and is never a copy, how Enumerate reads it,
and how a change to the supported sets bears on the allowance. These bear on what book `assistant-self-map` builds
and on the shipped curation code. The five items below are ADR `duty-menus-and-self-maps/0005`'s Consequences, "For
book `assistant-self-map` and the curation code", as written. In them, "sub-decision" is that ADR's, "item 5" is
item 5 of row `2026-10-12-self-maps-spec-fold-forwards`, and the "its" of "its Decision 1", "Its stop points" and
"Its ADR 0001" names book `assistant-self-map`. Where no spec is named, § 9, § 9.2, and When it changes and A part A
does not publish (paragraphs of § 9.2) are Treasure Maps', and When curation stops and Revocation are Assistant
Designation's. "The docs pass" (item 4) is the docs pass after book `duty-menus-and-self-maps` that takes row
`2026-10-12-bare-39998-ta-discovery`. No code changes in story 5. The code books follow these, and close this row
when each item is built or answered.

1. **The "off" button** (its Decision 1, story 2) is no stop. It removes self-entries, and the keys go on
   publishing. Nothing is retracted, and no copy is deleted. It does end the allowance: readers then accept the
   keys' insights only while they are no older than the reader accepts, so stable Lists, Scores and Concepts fall
   to the next Alternate, or are not found.
2. **Its stop points:**
   - a customer leaving `active` is a stop for every family that customer's key publishes;
   - a relay that moves is a move: When it changes publishes the new relay first, and nothing is retracted;
   - Scores that stop landing are a stop for those Scores: narrow or remove the self-entry, and the values stay;
   - the person's Map dropping a key, or giving it to another key, is a stop only for the Scores and Lists that no
     remaining entry of that Map gives to the Assistant (§ 9). Those Lists SHOULD be retracted. An insight that
     another entry still gives the Assistant (`*` after `3038x` is dropped, say) stays a duty. Re-giving a key to
     the same Assistant, at the same relay or another, is no stop. For Concepts, see item 4.

   None of these changes the supported sets. The re-pin window (sub-decision 6) arises once the instance reads real
   supported sets.
3. **Supported Scores.** A self-entry speaks for the observer's supported Scores under its key, not for what the
   instance computes (item 5). The instance's reading, the eleven metrics, holds as a reading of the supported
   Scores while no supported-Scores set is published. Once one names a metric the instance does not compute, a
   `30382` self-entry claims it falsely, and the self-Map must narrow to `30382:<metric>` keys (A part A does not
   publish). Its ADR 0001 already plans to read a real set.
4. **Concepts.** The instance stops curating a list when no entry in the person's Map empowers it any longer
   (Assistant Designation, Revocation), or for another cause in When curation stops (sub-decision 1). It narrows or
   removes its self-entries as § 9.2's When it changes asks. It keeps the header, its `b` and the copies, sends no
   deletion, and copies nothing more for that list. A Map change that leaves the list's first entry naming the
   Assistant (Assistant Designation: on duplicate entries for one (kind, d-tag), the first occurrence wins) is no
   stop for that list: dropping a bare `39998`, say, or re-giving the entry at another relay. A reorder that puts
   another assistant's entry for the list first ends curation as Revocation does, though Treasure Maps §§ 7 and 9
   still give the Assistant a duty as an Alternate: the same question as a bare `39998` (below).
   - **A bare `39998` in the same Map.** If the Map drops a list's entry but keeps a bare `39998` naming the
     Assistant, then under Assistant Designation's current text, where only a per-DList entry empowers (the blanket
     entry names no list), curation of that list ends. Where the list is among the person's Supported Concepts
     (Treasure Maps § 8), Treasure Maps § 9 still gives its Concept to the Assistant through the bare key, and
     Spawning § 3.6's gates (principle 3) still pass, so a bare `39998` self-entry would win and speak for it. The
     self-Map narrows to exact keys until the docs pass decides whether a bare `39998` asks for curation
     (sub-decision 10).
   - Shipped Revoke conforms.
   - Update list opens only for a list whose first entry in the Map names the assistant (`curatedDListRows` and
     `curatedDListAccess`, `ui/src/utils/treasureMap.js`:313–323, :357–371), so after a reorder the page already
     opens it read-only.
     `POST /api/dlist-curation/update` does not itself check the Map entry, so "copies and deletes nothing more"
     rests on the page.
5. **Lists.** Today it claims none (`older-form`). Sub-decision 10's note on the list-`d`-tags row says what an old
   `d` gets.

**Pointer:** ADR `engineering-team/decisions/duty-menus-and-self-maps/0005-self-map-upkeep.md` (Consequences;
sub-decisions 1, 2, 6 and 10); book `engineering-team/audits/assistant-self-map/book.md`; related rows
`2026-10-12-list-d-tags-not-treasure-maps` and `2026-10-12-bare-39998-ta-discovery`.
