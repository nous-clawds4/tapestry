# PRD Seed: Manage your Treasure Map — Edit mode

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/treasure-map-edit/audit.md`
**Anchor:** the acceptance frame in `book.md`, which the owner confirmed at intake, plus nineteen recorded decisions
(four carried from the handoff, fifteen made in this book)
**Confidence:** high for what shipped and why; medium for the personas and the next-phase framing, which no product
phase ever stated
**Date:** 2026-10-08

> This is a **reverse-engineered baseline** in the product-team PRD shape, built from what shipped. It is a *strawman
> for the product team*, not a ratified spec. Every section is tagged `[FROM FRAME]` (grounded in the acceptance frame
> or a recorded owner decision), `[INFERRED]` (read off the as-built system), or `[UNKNOWN — product input needed]`.
> The product team adopts it as the starting point for `/discover` on the next phase and validates each section. It
> extends the manage-treasure-map seed (`engineering-team/audits/manage-treasure-map/prd-seed.md`), which covers the
> view-only page.

## 1. Product vision

- `[FROM FRAME]` **Change who looks after your Scores, Lists and Concepts in plain language, and sign the new Treasure
  Map yourself.** On `/treasure-map`, Edit lets a person:
  - give each category, or everything, to one of their own Assistants;
  - see exactly what their Map would say;
  - save it, signed by their own signer.
- `[FROM FRAME]` **Honest about where it went.** "Treasure Map updated" means every relay tried accepted it. Anything
  less shows where the Map went (decision 17).
- `[FROM FRAME]` **The person's Map is theirs.** Nothing the edit doesn't change is touched, including entries this
  page never shows. Only the switches a person turns on remove anything.
- `[FROM FRAME]` **An experiment in the draft grammar** (decision 15). Assignments are written as family entries
  (`3038x`, `3039x`, `39998`, `*`) that the standards may adopt later.
- `[UNKNOWN — product input needed]` **Whether other apps should follow an edit today.** Apps that read only NIP-85
  don't read family entries yet, so they won't see an assignment written only as one.

## 2. Personas

- `[INFERRED]` **A Brainstorm user with several Assistants** (their own here, plus others on the My Assistants page).
  They want one to look after Scores and another Lists, without reading or writing JSON.
- `[INFERRED]` **The owner-operator.** Uses the override and backup switches to tidy a Map that setup and older
  generators filled in, and reads the edited raw Map before saving.
- `[FROM FRAME]` **A person with no Treasure Map found.** Edit makes them one, after a warning that a Map kept on a
  relay the page couldn't read would be replaced (decisions 9, 14).
- `[UNKNOWN — product input needed]` **A person whose Map is also written by another app or Assistant.** Save shows
  them a newer Map with their changes on top (decision 19). How often this happens, and whether they need more than
  that, is unknown.

## 3. Scope (as-built)

- `[FROM FRAME]` **Edit**, shown to a signed-in person once their Map has been read (or found missing).
- `[FROM FRAME]` **Assigning:**
  - one Assistant per card (Scores, Lists, Concepts), or **Assign to all**;
  - only the person's own Assistants, from the My Assistants list, with the Assistant here marked **Local**;
  - each pending change reads Unsaved, with Undo, and the save note counts them.
- `[FROM FRAME]` **The switches:**
  - **Override N individually assigned duties** per card, and one for All duties, which turns on only the cards with
    duties (decision 18);
  - **Remove N backup Assistants**, which reaches every key in the Map (decisions 8, 13).
- `[FROM FRAME]` **The preview:** the cards preview the edit, and "View the raw Treasure Map — edited" is exactly what
  Save signs.
- `[FROM FRAME]` **Save changes** (decisions 17–19):
  - on only when something really changes;
  - signed by the person's own signer, on the signed-in account;
  - published to this instance's relay and its outside relays;
  - then "Treasure Map updated", the publish report, or a reason it wasn't sent;
  - a newer Map found at Save is shown with the changes on top.
- `[FROM FRAME]` **Ignored entries:** an everything entry that names anything after `*` (`*:…`) counts nowhere, and no
  edit removes it (decision 11).
- `[INFERRED]` Leaving Edit discards what's unsaved, and nothing is remembered across a reload.

## 4. Domain model

- `[INFERRED]` **Treasure Map:** the person's own kind 10040, an ordered list of entries (key → Assistant). The first
  entry of a key is its Preferred Assistant, and the rest are backups (draft grammar § 7).
- `[INFERRED]` **Category:** Scores, Lists, Concepts.
  - Its **broad entries** are the ones an assignment takes over: a whole kind, a family (`3038x`, `3039x`, `39998`), or
    a standard score row (`30382:<metric>`).
  - Its **individually assigned duties** are the narrower ones, such as a score for one Tag, a list for one DList, or a
    curator for one list (decision 12).
- `[INFERRED]` **Pending edit:**
  - the choices: per category, everything, the overrides and the backup switch;
  - applied to whichever Map is current, so they survive a newer Map (decision 19).
- `[INFERRED]` **Save outcome:** saved (everywhere), partial (somewhere), failed (nowhere), or not sent (no signer,
  another account, declined, a newer Map, or the person changed).
- `[UNKNOWN — product input needed]` **Whether the Treasure Map deserves a concept-graph handle** (carried from earlier
  books; still unanswered).

## 5. Design rules (as-built)

- `[FROM FRAME]` The owner's Claude Design blueprint, kept in `engineering-team/audits/manage-treasure-map/blueprint/`.
  Its words are kept. New words were approved story by story: the switches, the warning, Saving…, the refusals and the
  newer-Map message.
- `[FROM FRAME]` **Two departures from the blueprint:**
  - the All duties switch skips cards with no duties (decision 18);
  - "Treasure Map updated" only after a publish accepted everywhere (decision 17).
- `[INFERRED]` **Nothing is offered before the read.** No Edit or Save while the Map is loading or its read failed.
- `[INFERRED]` **The edit can't change while a save runs,** and one save runs at a time.
- `[INFERRED]` **Keyboard and screen readers:**
  - every control is in the Tab order, and the switches are real switches, each described by its card's title;
  - status words arrive in live regions that are already on the page;
  - focus returns to the control the person used.
- `[INFERRED]` Everything lies inside the screen at 375 px (the top bar at 320 px is a separate open issue).

## 6. Carry-forward & open questions

Promoted from audit §6:
- **Production:** done 2026-10-08. This book and manage-treasure-map reached `main` together (PR #823).
- **Save's hardening:**
  - a timeout or Cancel for a signer that never answers;
  - telling a declined account prompt from a missing signer;
  - checking a returned event's whole content;
  - focus after a newer Map.
- **Family entries and today's readers** (decision 15), and the **legacy generators** that rewrite edited `30382:*`
  rows (decision 12).
- **`*:<scope>` support**, an open question in the draft grammar.
- **The Advanced page:** every entry, finer control of backups, and somewhere to show ignored entries.
- **Merging a newer Map entry by entry,** and remembering an unsaved edit.

## 7. What product must validate

- [ ] Should an assignment also write the entries today's apps read (NIP-85 keys), so other apps follow it, or stay
  family-only while the standards are open?
- [ ] Should Edit warn when the legacy generators could undo a Scores edit, or should those generators learn to keep
  it?
- [ ] Is "one switch removes every backup" enough on this page, or do people need to keep some backups before the
  Advanced page exists?
- [ ] Should the cards show that a category has backups (carried from manage-treasure-map's seed)?
- [ ] When Save finds a newer Map, is "your changes on top" right, or should the person choose per change?
- [ ] Should unsaved edits survive a reload?
- [ ] Does the TA Treasure Map page stay for operators now that Edit exists here (carried from manage-treasure-map's
  seed)?
