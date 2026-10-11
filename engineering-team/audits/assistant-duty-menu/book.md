# Book of Work: Duty Menu — the hub's Duty Menu page, built

**Slug:** assistant-duty-menu
**Status:** Open
**Opened:** 2026-10-11
**Closed:** —

## Intent anchor

**Acceptance frame (no PRD)**: the owner's ask, restated at intake (2026-10-11) and settled through three
questions there. Completion is *judged* against the bullets below.

The ask, verbatim (copied from the session transcript, not retyped):

> We recently created a new "Your Assistant's Treasure Map" page and a new "Duty Menu" page at https://staging.brainstorm.world/assistant/treasure-map and https://staging.brainstorm.world/assistant/duty-menu, respectively, each accessed from the Assistant Management page at https://staging.brainstorm.world/assistant. Currently, each of these two pages is a placeholder. There is a separate session that is actively updating the relevant protocols for these two pages. It may be the case that the relevant protocols are sufficiently spelled out that we can go ahead and implement the functionality of one or the other of these two pages. Is this the case for either page yet? If so, let's pick one page (not both) and proceed with building it out. If not, we can wait for the other session to finish first.

### Readiness, as found at intake (2026-10-11)

- **Duty Menu: ready on the spec side.** `protocols/drafts/duty-menus.md` passed review in round 3
  (`duty-menus-and-self-maps` #2, Done). The publisher's side (§§ 3–5, § 7, § 8.1, § 11) and validity (§ 6.1) are
  settled. What stories 3 and 4 of that book still change is mostly how readers resolve menu rows into Map entries
  (§ 6.2), and the key grammar. Ledger row `2026-10-11-duty-menus-spec-fold-forwards`: none of it changes a Map entry
  for a well-formed menu read as the spec intends.
- **Your Assistant's Treasure Map: not ready.** Self-Maps are `duty-menus-and-self-maps` #3, approved 2026-10-11 with
  no ADR or spec text yet. That page stays a placeholder in this book.

### Decisions taken at intake (2026-10-11)

1. **Preview and publish.** The page builds the menu from what this instance really publishes for the viewer's
   Assistant, shows it beside the menu published now, and one button has the Assistant sign and publish it (the
   Outbox Relays pattern). The person does not add or edit rows. *(Chosen from: preview and publish / read-only,
   auto-published by the instance / the person edits the rows.)*
2. **Done means published and current.** The card is **Done** when a valid menu (`duty-menus.md` § 6.1) is found for
   the Assistant and it matches what this instance offers now. When the offer changes, the card needs attention
   again. *(Chosen from: published and current / published at all.)*
3. **Path: Standard, all five phases.** *(Chosen from: Standard / the Light profile trial.)*

### Acceptance frame

*Proposed from the intake decisions; confirmed by the owner at story 1's approval (2026-10-11), with the Lists
commitment in "Honest rows" added there.*

- [ ] **A real Duty Menu page.** `/assistant/duty-menu` stops being a placeholder. It shows the menu this instance
      would publish for the viewer's Assistant (each duty and its relay) beside the menu found for it now, or says
      none is found.
- [ ] **Honest rows.** The menu offers the duties this instance publishes for that Assistant, each at the relay
      where those insights really land, and Lists for every Assistant, which the owner commits this instance to
      building (story 1, open question 2; tracked in `_intake.md`, 2026-10-11). Nothing else is listed.
- [ ] **One-click publish.** A button has the viewer's own Assistant sign and publish its menu, conforming to
      `protocols/drafts/duty-menus.md` (Nous' `z`, `p` = the Assistant, `d` = `duty-menu`), to the relays § 8.1 names,
      and reports what each relay said.
- [ ] **A real mark.** The hub's Duty Menu card, its count line and the Assistant Alert show **Done** when a valid,
      current menu is found, and **Needs attention** otherwise.
- [ ] **On staging**, at staging.brainstorm.world/assistant/duty-menu.
- [ ] **Nothing else changes.** Your Assistant's Treasure Map stays a placeholder; `/treasure-map`, the other hub
      actions and `protocols/` are unchanged.

## Epics in this book

- `assistant-duty-menu`: the Duty Menu page (stories to be planned; story 1 first).

## Path

**Standard, all five phases** (Decision 3).

## Shared lines

Book `duty-menus-and-self-maps` (open, docs only) is still editing `protocols/drafts/duty-menus.md` (its stories 3
and 4), and its story 3's AC8 adds a tracking surface for "the later code book". This book is that code book for the
Duty Menu page only: that surface should point here rather than plan the page again. This book reads the spec and
does not edit `protocols/`. Lines it touches: the hub's actions and attention checks (`ui/src/pages/assistant/`,
`src/api/assistant/`), and their tests. Before Implementation and again before Review, run `git fetch` and then
`git merge-tree --write-tree HEAD origin/staging` (ledger `2026-09-22-parallel-books-no-shared-line-recheck`), and
re-read `duty-menus.md` for changes to §§ 3–8 and § 11.

- **Recheck before Implementation (2026-10-11).** `duty-menus.md` is unchanged since intake. ADR
  `duty-menus-and-self-maps/0003` (Self-Maps; *accepted* 2026-10-11, spec edit not yet landed) sub-decision 11 would give § 6.1 a fifth
  condition: no `["z", "list"]`, and no `z` naming any author's `39998:<author>:concept-header`. Story 1's
  `isDutyMenu` implements the four conditions the spec states today, and this instance's own menus never carry such a
  `z`. If that sub-decision lands in `duty-menus.md`, `isDutyMenu` gains the fifth condition, and its tests gain a
  case for it. Recheck this before Review.

## Provenance

- **Mode:** Acceptance-frame
- **Confidence at close:** —

## Close artifacts *(filled by `/close-book`)*

- Build audit: `engineering-team/audits/assistant-duty-menu/audit.md`
- Product feedback: `engineering-team/audits/assistant-duty-menu/prd-seed.md`
