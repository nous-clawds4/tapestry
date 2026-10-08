# Story 4: Edit mode — the override switches and the backup switch

**Status:** Draft
**Created:** 2026-10-08
**Type:** Feature
**Epic:** `treasure-map-edit`
**Book:** `engineering-team/audits/treasure-map-edit/book.md`

## Background

Story 3 lets a person give each category, or all duties, to one of their Assistants, and previews the Map that would
result. Two kinds of entry survive an assignment untouched:
- **Individually assigned duties:** a score for one Tag, a list for one DList, a curator for one list. Book decision
  12 calls these a category's narrower entries.
- **Backup Assistants:** the second and later Assistants on an entry.

The blueprint's Edit mode (`engineering-team/audits/manage-treasure-map/blueprint/`, the `tmbEdit` blocks) gives each
pending card an **override switch** that removes that card's individually assigned duties, and the All duties row one
that does it for every category. The owner added one **backup switch**, off by default, that leaves every entry in the
Map with only its first Assistant (book decisions 2, 8 and 13).

This story adds those switches to Edit mode, with the preview showing what they'd remove. It also carries two notes from
story 3's reviews: a card's Undo after **Assign to all** (round 1, non-blocking 5) and when focus lands after a pick
(round 2, non-blocking 1). Save is story 5. Nothing in this story signs or publishes.

## User-facing description

As a signed-in person editing my Treasure Map, I want to choose whether a new assignment also removes the narrower
duties other Assistants hold, and whether to drop every backup Assistant, and see exactly what that would remove before
I save.

## Acceptance criteria

The examples use the same notation as story 3: A, B, C and D are Assistants; `<X>` and `<Y>` are Tags, `<T>` a
DList and `<d>` a list's d-tag.
"Individually assigned duty" means book decision 12's narrower entry: `3038x:tag:…`, `30382:tag:…` and other one-Tag or
one-Pin scores; `3039x:tag:…`, `30396:tag:…` and other one-Tag or one-DList lists; and `39998:<d>` or `39999:…`
curators for one list.

- [ ] **AC-1: a card's override switch.** In Edit mode, a card shows the switch when it has a pending Assistant and its
  category has at least one individually assigned duty naming any Assistant other than that one. Otherwise there is
  no switch.
  - It reads **Override N individually assigned duty** (or **duties**). N counts those duties, each entry key once,
    however many Assistants it names. A duty that names only the pending Assistant isn't counted.
  - It starts off, with the note "Kept as they are; they take priority over this assignment." On, the note reads
    "These will be removed from your Treasure Map."
  - **On:** each counted duty leaves the edited Map, every Assistant on it included. Nothing else changes.
  - **Changing the pick** to another Assistant keeps the switch as it was and recounts N against the new one. If N
    becomes 0, the switch goes and changes nothing.
  - **The card's Undo,** or picking its current Assistant (which removes the card's change), turns its switch off.
  - The switch is part of the card's change: it doesn't change the save note's count.
- [ ] **AC-2: the All duties override switch.** While **Assign to all** has a pending Assistant and any category has
  duties AC-1 would count, the All duties row shows a switch reading **Override N individually assigned duties
  across all categories**. N is the sum over the three categories, each counted against the Assistant that category
  is pending to. It has the same two notes as AC-1.
  - It reads on when every category with such duties has its switch on. Turning it on or off turns all three cards'
    switches on or off. Each card's switch still works on its own.
  - Picking an Assistant in **Assign to all** turns every override switch off, as the blueprint does. The All duties
    **Undo** removes every pending assignment and turns every override switch off.
- [ ] **AC-3: a card's Undo after Assign to all** (open question 1, as recommended). While **Assign to all** is
  pending, a card's **Undo**, or picking that card's current Assistant, also cancels the everything entry's change
  (`*`), as the blueprint's Undo does.
  - The All duties row then shows no name and no **Undo**. The other cards keep their changes.
  - The undone card reads as it did before Edit, never "Mixed" with no **Unsaved** marker (story 3 review round 1,
    non-blocking 5).
- [ ] **AC-4: the backup switch** (book decisions 8 and 13). In Edit mode, below the cards and above the save note,
  the switch shows when the edited Map has at least one backup Assistant: a second or later entry for the same key.
  Two spellings of one key are one key, as on the cards: `39998` and `39998:dlist-header` are the same key.
  - It reads **Remove N backup Assistants** (**Remove 1 backup Assistant**). N counts the entries it would remove.
  - Off, the note reads "Kept as they are. Apps use a backup when an entry's first Assistant can't be reached." On:
    "Every entry keeps only its first Assistant, including entries not shown on this page."
  - It starts off each time Edit turns on.
  - **On:** every key in the Map keeps only its first entry. That includes other categories' keys, `*:…` entries
    (book decision 11) and keys this page doesn't read. Tags that aren't entries (no key and Assistant the page can
    read) stay. Everything kept keeps its bytes and its place.
  - **It works on the Map as the assignments and override switches leave it.** A moved entry's backups are still
    backups. An entry an override removes isn't counted. If N becomes 0, the switch goes and changes nothing.
  - **On counts as one unsaved change.** While it's on, the save note gives the count ("N unsaved changes"), even when
    all duties are pending to one Assistant.
  - **It is its own change:** it works with nothing else pending, and the All duties **Undo** leaves it as it is.
    Turning it off removes its change.

  | Map before (in order) | Change | Map after |
  |---|---|---|
  | `3038x` → A, `3038x:tag:<X>` → C | Scores → B, override on | `3038x` → B; `3038x:tag:<X>` removed. Scores reads B |
  | `30392` → A, `30396:tag:<X>:<T>` → C, `30396:tag:<Y>:<T>` → B | Lists → B | "Override 1 individually assigned duty" (the one naming C) |
  | the same | Lists → B, override on | `30392` → B, `30396:tag:<Y>:<T>` → B (kept), `3039x` → B added; `30396:tag:<X>:<T>` removed |
  | `39998` → A, `39998:<d>` → C, then `39998:<d>` → B | Concepts → B, override on | `39998` → B; both `39998:<d>` entries removed |
  | `*:tag` → D, `3038x:tag:<X>` → C | Scores → B, override on | `*:tag` → D (kept), `3038x` → B added; `3038x:tag:<X>` removed |
  | `30382:rank` → A, `30382:rank` → C, `*:tag` → D, `*:tag` → A | backup switch on | "Remove 2 backup Assistants"; `30382:rank` → A, `*:tag` → D |
  | `30382:rank` → A, `30382:rank` → C | Scores → B, backup switch on | `30382:rank` → B, `3038x` → B added |
  | `39998:dlist-header` → A, `39998` → C | backup switch on | `39998:dlist-header` → A |

- [ ] **AC-5: the preview.** Every switch shows its effect at once:
  - The cards read what the Map would say. For example, a Mixed card whose other Assistant held only overridden
    duties reads as the one Assistant.
  - "View the raw Treasure Map — edited" shows the Map without the removed entries.
  - The raw Treasure Map viewer still shows the Map as published.
  - Nothing signs, publishes or stores.
- [ ] **AC-6: the switches for keyboards and screen readers.** Each switch:
  - is announced as a switch, on or off, with its label, and its note as its description;
  - turns with Space or Enter;
  - keeps focus on itself when turned;
  - lies inside the screen at 375 px, as every open list does.

  After a pick, an **Undo** or **Try again**, focus lands on the list's button once the button already reads its new
  words and description (story 3 review round 2, non-blocking 1). So moving a card from one Assistant to another is
  heard as "Will be assigned to *name*".

## Copy

From the blueprint, exactly (book decision 3):
- **Override N individually assigned duty** / **duties**
- **Override N individually assigned duties across all categories**
- "Kept as they are; they take priority over this assignment."
- "These will be removed from your Treasure Map."

Approved by the owner (book decision 13):
- **Remove N backup Assistants**
- "Kept as they are. Apps use a backup when an entry's first Assistant can't be reached."
- "Every entry keeps only its first Assistant, including entries not shown on this page."

New here, to approve with this story: **Remove 1 backup Assistant**, the singular of decision 13's label.

## Concepts touched

The stack wasn't running in this session, so no concept handles were checked. No concept definition changes.

- The Treasure Map (kind 10040): read, and in this story only previewed as edited.
- The person's Assistants (the My Assistants page's list): read, as in story 3.

## Out of scope

- **Save,** signing, publishing and "Treasure Map updated" (story 5). The story-5 notes from story 3's review are
  there too: a pick that leaves the Map byte-identical, and checking the viewer when Save is clicked.
- **Finer control of backups,** such as keeping some, reordering them or choosing which is first. These belong to the
  Advanced page, a later book (book decision 2).
- **Removing individually assigned duties without a pending assignment,** or one at a time.
- **Remembering switch states** across leaving Edit mode, reloading or leaving the page.

## Open questions

1. **After Assign to all, what does one card's Undo do?** Recommended: it also cancels the everything entry's change,
   as the blueprint's Undo does (AC-3). Today the everything entry stays pending to that Assistant. On a Map with no
   bare `3038x`, the undone Scores card then reads "Mixed · 2 Assistants" with no **Unsaved** marker (story 3 review
   round 1, non-blocking 5). The alternative is to keep today's behaviour, which is an honest preview but reads like
   a glitch.

## Defaults assumed (to approve with this story)

1. **What the override counts and removes (blueprint):** a duty counts when it names any Assistant other than the
   pending one. On, it's removed whole, every Assistant on it included. A duty naming only the pending Assistant
   stays.
2. **Override switches don't count as changes** in the save note; they're part of the card's change (blueprint).
3. **The backup switch is counted on the edited Map,** after assignments and overrides. Two spellings of one key are
   one key.
4. **With the backup switch on, the save note counts** rather than saying "All duties → *name*", so the removal isn't
   hidden.
5. **The All duties Undo leaves the backup switch as it is,** because the switch isn't an assignment. Leaving Edit
   turns it off.

## Linked artifacts
- Book decisions: `engineering-team/audits/treasure-map-edit/book.md`, decisions 2, 3, 8, 11, 12 and 13
- Blueprint: `engineering-team/audits/manage-treasure-map/blueprint/treasure-map-screen.html.txt` (the `c.ovToggle`
  and `tmbAllOvToggle` switches) and `treasure-map-logic.js.txt` (`tmbConflicts`, `tmbPendDel`, the card Undo)
- Story 3: `engineering-team/stories/treasure-map-edit/3-edit-mode-assign-and-preview.md`
- Story 3's review: `engineering-team/reviews/treasure-map-edit/3-edit-mode-assign-and-preview.md` (round 1
  non-blocking 5; round 2 non-blocking 1)
- Epic: `engineering-team/epics/treasure-map-edit.md`, story 4
