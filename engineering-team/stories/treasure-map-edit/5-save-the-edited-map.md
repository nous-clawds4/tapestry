# Story 5: Edit mode — Save signs and publishes the edited Map

**Status:** Approved
**Created:** 2026-10-08
**Type:** Feature
**Epic:** `treasure-map-edit`
**Book:** `engineering-team/audits/treasure-map-edit/book.md`

## Background

Stories 3 and 4 let a person change their Treasure Map in Edit mode and see exactly what it would say: who looks
after Scores, Lists and Concepts, which narrower duties to override, and whether to drop backup Assistants. Nothing
is saved yet. This story adds the blueprint's **Save changes**: the person's own signer signs the edited Map, it is
published, and the page shows "Treasure Map updated" (`engineering-team/audits/manage-treasure-map/blueprint/`,
`tmbSave` and the toast).

A real publish can do more than succeed or fail. The app already has a way to say what happened: accepted by every
relay, by some, kept on this instance's relay only (the instance's publish policy), or by none. It also has a guard
that refuses to sign when the signer extension is on a different account from the one signed in. Save uses both.

With no Map found, Save publishes a new one, after the warning the owner approved (book decisions 9 and 14).

This story also carries the reviews' last open points for Edit mode:
- **Story 3's review, non-blocking 4 and 9:** a pick that leaves the Map unchanged, and Save checking whose Map it is.
- **Story 4's review, non-blocking 1–4:** two choices for the owner, and two housekeeping points.

Shipping to staging follows, with the whole book.

## User-facing description

As a signed-in person editing my Treasure Map, I want to save my changes, signed by me, and be told plainly whether
they reached my relays, so that my Assistants and other apps follow the new Map.

## Acceptance criteria

"The published Map" is the one the page read. "The edited Map" is the one "View the raw Treasure Map — edited" shows.

- [ ] **AC-1: Save changes.** In Edit mode, the save note has a **Save changes** button beside it (blueprint).
  - It is on only when the edited Map differs from the published Map (book decision 17). Otherwise it is off, and the
    note reads "No changes yet", even if a card shows a pick. That happens when, for example, a Mixed card is given
    the Assistant its own entry already names (story 3 review, non-blocking 4).
  - With no Map found, any change turns it on. The edit then makes a new Map.
- [ ] **AC-2: what Save signs.** Pressing **Save changes** signs exactly the edited Map:
  - the person's own kind 10040;
  - its content unchanged;
  - its tags exactly as the edited raw viewer shows them;
  - a `created_at` later than the published Map's, so it replaces it.

  The person's own signer signs it, and only when the signer's account is the signed-in person (the app's existing
  signer check). Nothing is signed for any other Map or account, nor when the signed-in person has changed since the
  Map was read (story 3 review, non-blocking 9).
- [ ] **AC-3: where it goes.** The signed Map is published to this instance's relay and to the outside relays the
  instance publishes to, under the instance's publish policy. With outside publishing off, it stays on this
  instance's relay.
- [ ] **AC-4: while saving.** The button reads **Saving…** and is off. The edit can't change until the save ends:
  pickers, switches, Undo, Assign to all and Edit itself are off.
- [ ] **AC-5: a Map changed since it was read** (book decision 17). Just before signing, the page reads
  the Map again. If a newer Map has appeared since the page read it, nothing is signed. The page then:
  - says "Couldn’t save: your Treasure Map changed since this page read it. Reload the page to see the new one; these
    changes will be lost.";
  - keeps Edit mode and the changes as they are.
- [ ] **AC-6: the outcomes** (book decision 17).
  - **Accepted everywhere** (this instance's relay, and every outside relay that was tried):
    - Edit mode ends.
    - The cards and the raw Treasure Map show the new Map, signed.
    - "Treasure Map updated" appears for a few seconds, announced to screen readers (blueprint).
  - **Accepted somewhere, but not everywhere** (some relays refused or couldn't be reached, or the publish policy kept
    it on this instance's relay):
    - Edit mode ends, and the page shows the new Map as above.
    - In place of "Treasure Map updated", the app's publish report says where it went: one summary line, with "Your
      Treasure Map" as its subject, and one line per relay. For example, "Your Treasure Map was saved on this
      instance's relay and accepted by 2 of 3 relays. 1 did not accept it; see below."
    - The report stays until the person edits again or leaves the page.
  - **Accepted nowhere:** Edit mode stays on with every change. The report says nothing accepted it, and **Save
    changes** can be pressed again.
- [ ] **AC-7: refused before signing.** In each case nothing is signed or published, Edit mode and the changes stay,
  and a message by **Save changes** says why:
  - **No signer extension:** "Couldn’t save: no Nostr signer was found in this browser."
  - **The signer is on another account:** the app's existing words, which name both accounts and say how to fix it.
  - **The person declines to sign:** "Couldn’t save: the signature was declined."
- [ ] **AC-8: with no Map found** (book decisions 9, 14, 15). Save publishes a new Map holding only what the edit
  added. Afterwards the page shows it, and the no-Map warning is gone.
- [ ] **AC-9: story 4's switches, as the owner decides** (book decision 18).
  - **Each card's override switch is described by its card's title, then its note.** A screen reader hears, for
    example, "Override 1 individually assigned duty, switch, off, Scores. Kept as they are; …". This amends story 4's
    AC-6, which had the note alone.
  - **The All duties switch turns on only the cards that have duties to override.** A card with none keeps its switch
    off, so a later pick on it never starts with its switch already on (story 4 review, non-blocking 2). This amends
    story 4's AC-2, which follows the blueprint in turning all three.
- [ ] **AC-10: keyboard and screen readers.**
  - **Save changes** is a button in the Tab order.
  - "Saving…", the outcome messages and the report are announced.
  - After a save that ends Edit mode, focus goes to the **Edit** button. After one that doesn't, focus stays on **Save
    changes**.
  - Everything new lies inside the screen at 375 px.

## Copy

From the blueprint, exactly (book decision 3): **Save changes**; "Treasure Map updated".

The app's own words, reused:
- the signer-account message;
- the publish report's sentences and relay lines, with "Your Treasure Map" as the subject.

New here, to approve with this story:
- **Saving…**
- "Couldn’t save: your Treasure Map changed since this page read it. Reload the page to see the new one; these changes
  will be lost."
- "Couldn’t save: no Nostr signer was found in this browser."
- "Couldn’t save: the signature was declined."

## Concepts touched

The stack wasn't running in this session, so no concept handles were checked. No concept definition changes.

- The Treasure Map (kind 10040): read, and now signed and published by its owner.
- The person's Assistants (the My Assistants page's list): read, as in stories 3–4.

## Out of scope

- **Merging a newer Map into the edit** (open question 2's alternative): this story stops and asks for a reload.
- **The legacy generators rewriting the `30382:*` rows** after a save (ledger
  `2026-10-08-legacy-generators-overwrite-edited-scores`, book decision 12): accepted for now.
- **Teaching other readers the family entries** (book decision 15).
- **The Advanced page,** and finer control of backups.
- **Remembering unsaved changes** across reloads.

## Open questions

None.

## Resolved at the story gate

Approved as drafted, 2026-10-08, verbatim: "Approved." The draft's five recommendations, its five defaults and the
words new in § Copy are approved with it.

1. **"Treasure Map updated" only for a publish accepted everywhere it was tried.** Anything less ends Edit mode and
   shows the app's publish report instead (book decision 17).
2. **A Map changed since the page read it:** checked just before signing. If it changed, nothing is signed and the
   person is asked to reload (book decision 17).
3. **A pick that changes nothing:** Save stays off and the note says "No changes yet" (book decision 17).
4. **Each card's override switch is described by its card's title, then its note** (book decision 18).
5. **The All duties switch turns on only the cards that have duties** (book decision 18).

## Defaults approved with the story

1. **Where it's published:** this instance's relay and the outside relays the instance publishes to, under its
   publish policy (AC-3). These are the same places the app's other signed publishes go.
2. **During a save, the edit can't change** (AC-4).
3. **The publish report stays on the page** until the person edits again or leaves (AC-6).
4. **Focus after a save:** the Edit button when Edit mode ends; **Save changes** when it doesn't (AC-10).
5. **Housekeeping from story 4's review rides with this story's code and tests,** with no change to behaviour:
   - `editedTags`' description says tags can be removed;
   - V10's title no longer promises Try again;
   - E9 again covers the All duties Undo after a card was changed.

## Linked artifacts
- Book decisions: `engineering-team/audits/treasure-map-edit/book.md`, decisions 3, 9, 12, 14, 15, 17 and 18
- Blueprint: `engineering-team/audits/manage-treasure-map/blueprint/treasure-map-screen.html.txt` (the save bar) and
  `treasure-map-logic.js.txt` (`tmbSave`, `tmbSaveDisabled`, the toast)
- Stories 3–4 and their reviews: `engineering-team/stories/treasure-map-edit/`,
  `engineering-team/reviews/treasure-map-edit/`
- Epic: `engineering-team/epics/treasure-map-edit.md`, story 5
