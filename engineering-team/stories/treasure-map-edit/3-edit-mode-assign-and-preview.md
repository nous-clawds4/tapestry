# Story 3: Edit mode — assign Assistants and preview the result

**Status:** Draft
**Created:** 2026-10-08
**Type:** Feature
**Epic:** `treasure-map-edit`
**Book:** `engineering-team/audits/treasure-map-edit/book.md`

## Background

`/treasure-map` shows who a person's Treasure Map gives their Scores, Lists and Concepts to, but nothing on it changes
anything. The blueprint's Edit mode (`engineering-team/audits/manage-treasure-map/blueprint/`, the `tmbEdit` blocks)
lets the person pick an Assistant per category, or one for all duties, see the result before saving, and then sign the
new Map.

Edit mode is three stories (epic `treasure-map-edit`). This one makes the assignments and shows exactly what saving
would publish. Story 4 adds the override switches and the backup switch, and story 5 adds Save. Nothing in this story
signs or publishes, and the book ships the three together.

What an assignment changes on a real Map is the owner's decision 12. The words come from the blueprint (book decision
3), plus the no-Map warning the owner approved (decision 14) and the few states the blueprint has no words for
(§ Copy).

## User-facing description

As a signed-in person, I want to choose which of my Assistants looks after my Scores, my Lists and my Concepts, or one
Assistant for everything, and see exactly what my Treasure Map would say before I save it.

## Acceptance criteria

"Your Assistants" means the list the My Assistants page shows for the signed-in person (book decision 1), with their
Assistant here, the one `/assistants` marks Local. In the examples, A, B and C are Assistants and L is the person's
Assistant here.

- [ ] **AC-1: Edit mode on and off.** Once the Map has been read, found or not, the **Assistants by category** heading
  has an **Edit** button beside it.
  - Pressing it turns Edit mode on. The button reads **Editing**, shows as pressed, and the controls of AC-2 to AC-6
    appear.
  - Pressing it again turns Edit mode off and discards every unsaved change. The cards and the page are as before
    Edit.
  - While the Map is loading or couldn't be read, or when signed out, there is no Edit button.
  - **With no Map found** (the read said "none"), Edit works the same, and the top of Edit mode shows the no-Map
    warning (§ Copy, book decision 14).
- [ ] **AC-2: an Assistant per card.** In Edit mode each card has a **Choose an Assistant** button.
  - It opens a list of your Assistants. Your Assistant here comes first, marked **Local**; the rest follow in the My
    Assistants page's order. Each row shows the avatar letter, the name, and the website (else the NIP-05, else the
    shortened npub) by the same name rule as the cards.
  - The card's current Assistant, when the card names exactly one, is marked **Current**. The row the card will be
    assigned to has a check mark.
  - Picking an Assistant other than the current one makes the change pending. The card shows **Unsaved**, "Will be
    assigned to *name*" and **Undo**, and its button reads **Change**. Picking the current one again removes the
    card's pending change.
  - While your Assistants load, the list shows the loading line. If they can't be loaded, it shows the error line and
    **Try again** (§ Copy). With none, it says so and links to the My Assistants page.
  - Only one list is open at a time. Picking a row, or pressing the button again, closes it.
- [ ] **AC-3: All duties.** In Edit mode, above the cards, the **All duties** row ("Assign one Assistant to Scores,
  Lists, Concepts, and everything else.") has an **Assign to all** button with the same list as AC-2.
  - Picking an Assistant makes Scores, Lists and Concepts pending to it, and everything else too (the plain `*`
    entry). The row shows the name and **Undo**, which removes every pending change.
  - **Current** marks the Assistant only when all three cards name it alone. Picking that one removes every pending
    change.
  - A card changed afterwards changes only that card. Its **Undo** removes only that card's change.
- [ ] **AC-4: the save note.** In Edit mode, under the cards, a note says what is pending:
  - "No changes yet" when nothing is;
  - "All duties → *name*" when Scores, Lists, Concepts and everything else are all pending to one Assistant;
  - otherwise "N unsaved change" / "N unsaved changes", counting each pending card and the everything entry.

  There is no Save button in this story (story 5).
- [ ] **AC-5: what an assignment changes** (book decision 12). Giving a category to an Assistant changes the Map like
  this:
  - **The category's own entries move to the new Assistant, in place.** These are the entries that cover a whole
    family (`3038x`, `3039x`, `39998` in either spelling), a whole kind (`30382`, `30392`, …) or, for Scores, one
    standard score (`30382:rank` and the other `30382:<metric>`
    rows the Treasure Map generators write). Each keeps its position, and the new Assistant
    becomes its first Assistant. Its backups stay (only story 4's backup switch removes backups).
  - **The family entry is added** when the Map has none: `3038x` for Scores, `3039x` for Lists, `39998` for Concepts.
  - **Individually assigned duties stay as they are.** These are the category's narrower entries, a score or list for
    one Tag, one DList or one Pin (`3038x:tag:…`, `30396:tag:…`, …), or a curator for one list (`39998:<d-tag>`).
    Story 4's override switch is what removes them.
  - **"Assign to all"** does this for all three categories, and gives the plain everything entry (`*`) to the
    Assistant too, adding it when there is none.
  - **Everything else stays exactly as it was and where it was.** That covers other categories' entries, `*:…`
    entries (book decision 11), and entries this page doesn't read.

  | Map before (in order) | Change | Map after |
  |---|---|---|
  | `30382:rank` → A, `30382:followers` → A, `30392` → L | Scores → B | `30382:rank` → B, `30382:followers` → B, `30392` → L, and `3038x` → B added |
  | `30382:rank` → A, then `30382:rank` → C | Scores → B | `30382:rank` → B, then `30382:rank` → C (the backup stays), and `3038x` → B added |
  | `3038x` → A, `3038x:tag:<X>` → C | Scores → B | `3038x` → B, `3038x:tag:<X>` → C; the Scores card reads Mixed (B, C) |
  | `30392` → A, `30396:tag:<X>:<T>` → C | Lists → B | `30392` → B, `30396:tag:<X>:<T>` → C, and `3039x` → B added |
  | `39998:dlist-header` → A, `39998:<d>` → C | Concepts → B | `39998:dlist-header` → B (the family entry, in its own spelling), `39998:<d>` → C |
  | `*:tag` → D, `30382:rank` → A | Assign to all → B | `*:tag` → D, `30382:rank` → B, and `3038x`, `3039x`, `39998` and `*` → B added |
  | no Map | Scores → B | a new Map: `3038x` → B *(see Open question 1)* |

- [ ] **AC-6: the preview.** In Edit mode, what the page shows follows the pending changes:
  - **The cards** show what the Map would say after saving, by the same counting rule as now. Taking the first
    example, the Scores card reads B.
  - **"View the raw Treasure Map — edited"**, with an **Unsaved draft** chip, appears under the raw Treasure Map
    viewer, starting closed. Opened, it shows the edited Map exactly as Save would sign it: the person's own kind
    10040, its content unchanged, and the tags as AC-5 makes them. It has no id or signature yet. Its button then reads
    "Hide the raw Treasure Map — edited".
  - **The raw Treasure Map viewer** still shows the Map as published.
  - Nothing on the page signs, publishes or stores anything.
- [ ] **AC-7: story 2's review, non-blocking 1 and 3.** The counting rule's description says a `*:…` entry "that names
  anything after the `*`" never counts. The names of story 1's tests H1–H5 no longer say "covers" for an entry that
  is now ignored.

## Copy

From the blueprint, exactly (book decision 3): **Edit**, **Editing**; **All duties**; "Assign one Assistant to Scores,
Lists, Concepts, and everything else."; **Assign to all**; **Choose an Assistant**, **Change**; **Unsaved**; "Will be
assigned to *name*"; **Undo**; **Local**, **Current**; "No changes yet"; "*N* unsaved change" / "*N* unsaved changes";
"All duties → *name*"; "View the raw Treasure Map — edited", "Hide the raw Treasure Map — edited"; **Unsaved draft**.

Approved by the owner (book decision 14), the no-Map warning:

> We didn't find a Treasure Map on your relays, so saving will publish a new one. If you already have one on a relay we
> couldn't check, the new one will replace it.

New here, for the states the blueprint has no words for (to approve with this story):

- loading your Assistants: "Loading your Assistants…"
- can't load them: "Couldn't load your Assistants." and **Try again**
- none: "You have no Assistants yet. Add one on the **My Assistants** page." (the link opens `/assistants`)

## Concepts touched

The stack wasn't running in this session, so no concept handles were checked. No concept definition changes.

- The Treasure Map (kind 10040): read, and, in this story, only previewed as edited.
- The person's Assistants (the My Assistants page's list): read.

## Out of scope

- **The override switches and the backup switch** (story 4).
- **Save, signing, publishing, "Treasure Map updated"** and their failure states (story 5).
- **Which relay each written entry names,** and where an added entry is placed: for Architecture. Existing entries
  keep their places.
- **Picking an Assistant that isn't on the My Assistants page,** and editing entries one by one (the Advanced page).
- **Changing the older Tapestry-side generators,** which rewrite the `30382:*` rows (ledger
  `2026-10-08-legacy-generators-overwrite-edited-scores`).
- **Remembering unsaved changes** across leaving Edit mode, reloading or leaving the page.

## Open questions

1. **Should an assignment also add the entries today's apps read, when the Map lacks them?** Apps that read only
   NIP-85 look for exact keys such as `30382:rank`, and this app's own readers look for `30392` and
   `39998:dlist-header`. None of them reads `3038x`, `3039x` or bare `39998` (the draft grammar's § 13, item 7, says
   writers SHOULD also write the explicit entries). So a new Map with only `3038x` → B would give B no Scores in those
   apps. **Recommended:** when the Map lacks them, assigning a category also adds those entries, naming the new
   Assistant:
   - Scores: the standard score rows (the eleven `30382:<metric>` rows the Treasure Map generators write);
   - Lists: `30392`;
   - Concepts: `39998:dlist-header`, the spelling today's readers use, written in place of a bare `39998`.

## Linked artifacts
- Book decisions: `engineering-team/audits/treasure-map-edit/book.md`, decisions 1, 3, 9, 11, 12 and 14
- Blueprint: `engineering-team/audits/manage-treasure-map/blueprint/treasure-map-screen.html.txt` and
  `treasure-map-logic.js.txt`, the `tmbEdit` blocks
- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
