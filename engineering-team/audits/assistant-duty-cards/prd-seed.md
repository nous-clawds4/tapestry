# PRD Seed: Assistant Management — Duty Menu and Your Assistant's Treasure Map

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/assistant-duty-cards/audit.md`
**Anchor:** acceptance frame in `book.md`
**Confidence:** high for what shipped (one story, verbatim copy, verified on staging). The product questions in §7 are
open by design: this book built placeholders for a protocol that is still being ratified.
**Date:** 2026-10-11

> This is a **reverse-engineered baseline** in the product-team PRD shape, built from what shipped. It is a *strawman
> for the product team*, not a ratified spec. Every section is tagged:
> - `[FROM FRAME]`: grounded in the kickoff acceptance frame;
> - `[INFERRED]`: read off the as-built system;
> - `[UNKNOWN — product input needed]`.
>
> It is small because the book was. Its main job is to carry the questions in §6–§7 into the book that builds the real
> pages.

## 1. Product vision

`[FROM FRAME]` A person's Tapestry Assistant will tell the world two things:
- which duties it is **capable of supporting**, through a **Duty Menu**, one item on the DList of Duty Menus;
- which duties it is **actively managing**, through **its own Treasure Map**, in which it acts as its own Assistant.

The protocol is being ratified separately (book `duty-menus-and-self-maps`, docs only). Meanwhile the Assistant
Management page shows both as placeholders, so the person can see these duties coming.

`[INFERRED]` The owner's scenario, from the design handoff (`docs/DUTY_MENUS_AND_SELF_MAPS_DESIGN_HANDOFF.md` § 1): a
person switching a duty between two Assistants wants to know two things:
- does each Assistant offer it?
- is it **already** publishing it, so that the switch is instant instead of waiting for a first computation?

## 2. Personas

`[INFERRED]` The signed-in person who has a Tapestry Assistant on this instance and manages it from `/assistant`, the
same persona as the rest of the hub. They see the two cards marked, and the hub's count and the Assistant Alert include
them.

`[INFERRED]` Secondarily, the session that builds the real pages. The placeholder pages' planning notes are written
for it.

## 3. Scope (as-built)

- `[FROM FRAME]` Two cards at the end of "Your Assistant's Public Persona", after Outbox Relays: **Duty Menu**, then
  **Your Assistant's Treasure Map** (the title in the hub's own voice; book Decision 1).
- `[FROM FRAME]` Each card leads to a placeholder page (`/assistant/duty-menu`, `/assistant/treasure-map`) with the
  description, "Not yet defined." alert criteria and planning notes.
- `[FROM FRAME]` Marked **Needs attention** like every other placeholder, on the hub, in its count line and in the
  Assistant Alert (book Decision 2).
- `[FROM FRAME]` On staging. Production waits for the owner's next promotion.
- `[INFERRED]` Out of scope, as built: publishing or reading any Duty Menu or self-Map, any check, any Done state, any
  link to the person's `/treasure-map`, and any FAQ change.

## 4. Domain model

`[INFERRED]` No entity is modelled in code yet. From the design handoff and the protocol book:
- **Duty Menu:** one DList item per Assistant key, under a shared header that Nous publishes
  (`39998:<Nous>:duty-menu`). It says which duties that key offers, and the relay for each. Not published yet.
- **Self-Map:** the Assistant's own kind 10040, naming itself, listing the duties it is actively publishing now.
- **Duty:** a Treasure Map key (a category of trusted content: Scores, Lists, Concepts, …) given to an Assistant.

`[UNKNOWN — product input needed]` These become real once book `duty-menus-and-self-maps` ratifies them. The UI's
domain should follow the ratified spec, not the handoff.

## 5. Design rules (as-built)

- `[INFERRED]` The hub's cards speak in the second person ("Your …"). The avatar menu speaks in the first ("My Treasure
  Map", "My Assistant's Profile"). The new card follows the hub.
- `[INFERRED]` Every unbuilt action is marked **Needs attention** and counted until its real check exists. No unmarked
  "coming soon" state exists (rejected for this book: ADR assistant-duty-cards/0001 Option B).
- `[INFERRED]` Placeholder pages carry the owner's planning notes for the session that builds them.
- `[INFERRED]` The person's own Treasure Map (`/treasure-map`) and the Assistant's self-Map are kept apart. No card
  links one to the other.

## 6. Carry-forward & open questions

Promoted from audit §6:
1. **Promote to production** with the next `staging` → `main` promotion.
2. **The real pages and checks** for both cards, in the code book that publishes menus and self-Maps. That book
   decides what **Done** means for each, which also takes two marks off every viewer's count.
3. **Where the Assistant's Treasure Map page links**, if anywhere: beside the person's own Map, or not.
4. **The FAQ**, which does not yet mention the Duty Menu or the self-Map.
5. **Engineering-only:** derive the attention spec's hub counts from the fixture before the next card.

## 7. What product must validate

- [ ] **Is "always marked" right for these two cards until they are built?** Everyone with an Assistant now sees two
      marks they cannot act on. The alternative, a non-counting "coming soon" state, was declined for consistency;
      revisit if the nag outweighs it.
- [ ] **When is each card "done"?**
  - Duty Menu: perhaps once the Assistant's menu is published and lists at least one duty?
  - Treasure Map: perhaps once the self-Map lists every duty the person's own Map gives this Assistant?

  `[UNKNOWN — product input needed]`
- [ ] **What can a person do on each page?** Read only: see what the Assistant offers and runs? Or act: choose which
      duties the Assistant offers, start or stop one? `[UNKNOWN — product input needed]`
- [ ] **Who sees a person's Duty Menu?** The handoff's D9 notes that every menu points at Nous' header, so one query
      lists every provider's Assistant keys, per-customer keys included. Does the page need to say that publicly?
      `[UNKNOWN — product input needed]`
- [ ] **"Your" or "My".** Confirm the hub's voice for the real page's heading (book Decision 1 chose "Your" for the
      card).
