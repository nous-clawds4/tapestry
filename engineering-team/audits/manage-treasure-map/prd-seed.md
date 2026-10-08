# PRD Seed: Manage your Treasure Map

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/manage-treasure-map/audit.md`
**Anchor:** the acceptance frame in `book.md`, confirmed by the owner with story 1, plus the owner's nine recorded
decisions
**Confidence:** high for what shipped and why; medium for the personas and next-phase framing, which no product phase
ever stated
**Date:** 2026-10-07

> This is a **reverse-engineered baseline** in the product-team PRD shape, built from what shipped. It is a *strawman
> for the product team*, not a ratified spec. Every section is tagged `[FROM FRAME]` (grounded in the acceptance frame
> or a recorded owner decision), `[INFERRED]` (read off the as-built system), or `[UNKNOWN — product input needed]`.
> The product team adopts it as the starting point for `/discover` on the next phase and validates each section.

## 1. Product vision

- `[FROM FRAME]` **A plain-language page about your Treasure Map, on the Brainstorm side of the app.** It answers "who
  looks after my Scores, my Lists and my Concepts?" at a glance, explains what a Treasure Map is, and keeps the raw
  event one click away. The Tapestry side keeps its operator-facing TA Treasure Map page.
- `[FROM FRAME]` **View-only first** (decision 1). The design's Edit mode, which assigns Assistants and signs a new
  Treasure Map, is the intended next step.
- `[UNKNOWN — product input needed]` **Whether this page replaces the TA Treasure Map page for everyone** once Edit and
  Advanced exist, or the two stay side by side for different audiences.

## 2. Personas

- `[INFERRED]` **A Brainstorm user who has activated their account.** They have a Treasure Map, published at setup or
  by hand, and want to know what it says without reading JSON.
- `[INFERRED]` **The owner-operator.** Several Assistants across providers; reads the cards to check that a Map says
  what they meant (the "rank to A, all Scores to B is Mixed" decision came from this view).
- `[UNKNOWN — product input needed]` **A newcomer with no Treasure Map yet.** Today they see three "Not assigned yet"
  cards and "No Treasure Map found", but no path to create one from this page.

## 3. Scope (as-built)

- `[FROM FRAME]` `/treasure-map`: heading, introduction, FAQ, the Assistants by category cards, the raw Treasure Map
  viewer with its four states, and the Advanced management link. Read-only.
- `[FROM FRAME]` `/treasure-map/advanced`: a placeholder pointing at the TA Treasure Map page (decision 5).
- `[FROM FRAME]` "My Treasure Map" in the Brainstorm menus opens `/treasure-map`; the Tapestry menu keeps the TA page;
  the My Assistants page's Treasure Map links follow the Brainstorm side (decision 3).
- `[FROM FRAME]` **The cards' rules** (decisions 7–9):
  - a category nothing on the Map covers says **Not assigned yet**;
  - broad entries (everything, all Scores, all Lists) count;
  - a card lists every Assistant the Map would ask for something in that category, so a broad entry alongside a
    specific one reads **Mixed**.
- `[INFERRED]` Only the first-listed Assistant per entry counts; later ones are alternates and aren't shown.

## 4. Domain model

- `[INFERRED]` **Treasure Map** — the person's kind 10040. Each entry names an insight key and the Assistant that
  publishes it. The page reads it; nothing writes it.
- `[INFERRED]` **Category** — Scores (kinds 30380–30389), Lists (30390–30399), Concepts (39998/39999), plus the draft
  grammar's broad keys (`*`, `3038x`, `3039x`, `*:<system>`, bare `39998`).
- `[INFERRED]` **Assistant** — a pubkey named on the Map, shown by its profile name; the person's own Assistant here is
  marked.
- `[UNKNOWN — product input needed]` **Preferred vs alternate Assistants:** the cards show only Preferred. Should
  alternates ever appear here, or only on the Advanced page?

## 5. Design rules (as-built)

- `[FROM FRAME]` The owner's Claude Design blueprint, kept in `engineering-team/audits/manage-treasure-map/blueprint/`.
  The blueprint's words are kept even where they run ahead of the app (decision 4).
- `[INFERRED]` Nothing is claimed before the Map has been read: loading and error states replace the cards and the raw
  panel, never "Not assigned yet" or "No Treasure Map found".
- `[INFERRED]` Every name on a mixed card is available to screen readers; the raw box is keyboard-reachable.
- `[UNKNOWN — product input needed]` No rule yet for how the page should look while an edit is unsaved; the blueprint
  has one (Unsaved / Undo / Save), for the next phase to adopt or change.

## 6. Carry-forward & open questions

Promoted from audit §6:
- **The Edit mode:** assign by category or to everything, override individually assigned duties, Save (a signed kind
  10040). The cards' rule (`categoryAssistants`) is the natural preview of what an edit changes, after its edge cases
  are fixed (ledger `2026-10-07-treasure-map-card-rule-edge-cases`).
- **The Advanced page:** every entry, its Preferred and Alternate Assistants, and the catch-all rows the blueprint
  shows.
- **Copy that runs ahead of the app:** "Brainstorm keeps it up to date for you", "Brainstorm creates your Treasure Map
  during setup", and the Advanced-page FAQ answer.
- **The top bar's sign-in during the session check** (ledger `2026-10-07-top-bar-sign-in-while-loading`).
- **Production:** done 2026-10-08, together with the treasure-map-edit book (PR #823).

## 7. What product must validate

- [ ] Is "Not assigned yet" the right words for an uncovered category, and should it link somewhere (setup, or Edit)?
- [ ] Should the cards ever show alternates, or a hint that a category has backups?
- [ ] Does the TA Treasure Map page stay for operators once Edit and Advanced exist here?
- [x] What should a person with no Treasure Map be offered on this page? *Answered 2026-10-08 by the owner: Edit
  creates one, after a warning that a Map on a relay that wasn't read would be replaced (treasure-map-edit book
  decisions 9 and 14).*
- [ ] Keep, or revise, the introduction and FAQ lines that describe behaviour the app doesn't have yet?
