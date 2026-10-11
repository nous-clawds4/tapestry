# Story 1: The hub's Duty Menu and Your Assistant's Treasure Map cards, as placeholders

**Status:** Approved
**Created:** 2026-10-11
**Type:** Feature
**Epic:** `assistant-duty-cards`
**Book:** `engineering-team/audits/assistant-duty-cards/book.md`

## Background

The Assistant Management hub at `/assistant` lists eleven actions under three headings
(assistant-management #1). Its first section, "Your Assistant's Public Persona", ends with three cards:
the Assistant's profile, Identification Tags and Outbox Relays (assistant-outbox-relays #1). An action
whose page is not built yet leads to the hub's shared placeholder page, and it is always marked
**Needs attention**: on the hub, in the hub's count line and in the Assistant Alert in the top bar.

A protocol is being written for an Assistant to tell others two things (book `duty-menus-and-self-maps`,
docs only, in progress in another session):

- which duties it is **able** to take on, and the relay for each: its **Duty Menu**, one item on the
  shared list of Duty Menus;
- which duties it is **actively** publishing now: its **own Treasure Map**, a kind 10040 in which it names
  itself as its own Assistant.

The owner wants the hub to show both now, as placeholders, while the protocol settles. The real pages
come in a later code book that publishes menus and self-Maps.

## User-facing description

As someone with a Tapestry Assistant on this instance, I want the hub's persona section to show that my
Assistant will publish a Duty Menu and its own Treasure Map, each with a page that says what it is for,
so that I can see these duties coming before they are built.

## Acceptance criteria

- [ ] **AC-1: two new cards, in place.** The "Your Assistant's Public Persona" section ends with two more
      cards, after Outbox Relays and in this order: **Duty Menu**, then **Your Assistant's Treasure Map**,
      each with its description from § Copy. A click anywhere on a card opens its page:
      `/assistant/duty-menu` and `/assistant/treasure-map`. The hub now lists thirteen actions. The other
      eleven keep their order, sections, words and pages.
- [ ] **AC-2: each card leads to a placeholder page.** Each address shows the hub's placeholder page, as
      the other unbuilt actions do:
  - the card's title as the page heading;
  - "Placeholder page.";
  - the card's description;
  - the alert criteria, which read "Not yet defined.";
  - the planning notes from § Copy;
  - the link back to Assistant Management.

  Each address also works when opened directly or reloaded, not only when reached from the hub.
- [ ] **AC-3: marked like the other placeholders.** Given a signed-in viewer with an Assistant on this
      instance, both cards are always marked **Needs attention** and never show **Done**. The hub's count
      line counts them, so it reads two higher than before. The Assistant Alert in the top bar counts them
      the same way. Given a visitor who is not signed in, or a signed-in viewer with no Assistant here, the
      cards show no mark and nothing is counted, as today.
- [ ] **AC-4: nothing else changes.** Nothing is published, signed, checked or stored for either card. The
      FAQ, the other two sections, the other actions' marks and answers, and `/treasure-map` (the person's
      own Treasure Map page) are unchanged.

## Copy

**Duty Menu**
- Card title: **Duty Menu**
- Card description: "Let other clients, apps and Assistants know which duties your Assistant can take on,
  and which relay each one is published to. Your Assistant's Duty Menu is one item on the shared list of
  Duty Menus."
- Placeholder page, alert criteria: none yet (the page shows "Not yet defined.").
- Placeholder page, planning notes: "Your Assistant will tell the world which duties it is capable of
  supporting by publishing a Duty Menu, which is an item on the DList of Duty Menus. The protocol is still
  being written; this page will be built once it is settled."

**Your Assistant's Treasure Map**
- Card title: **Your Assistant's Treasure Map**
- Card description: "Your Assistant keeps its own Treasure Map (kind 10040), naming itself as its own
  Assistant, to show which duties it is publishing right now. If you move a duty to this Assistant and it
  is already publishing it, the switch takes effect right away instead of waiting for a first
  computation."
- Placeholder page, alert criteria: none yet (the page shows "Not yet defined.").
- Placeholder page, planning notes: "Your Assistant will tell the world which duties it is actively
  managing by publishing its own Treasure Map, in which it acts as its own Assistant. The protocol is still
  being written; this page will be built once it is settled."

The card descriptions were approved by the owner on 2026-10-11. The planning notes paraphrase the owner's
own description of the protocol from the same conversation.

## Concepts touched

- `39998:<TA>:nostr-user`: nostr user. The Assistant whose cards these are is the viewer's own.

No concept changes and no firmware reinstall. The Duty Menu list header is Nous' Shared Concept
(`39998:<Nous>:duty-menu`, per `docs/DUTY_MENUS_AND_SELF_MAPS_DESIGN_HANDOFF.md` D9–D10). It is not
published yet, and this story does not read it.

## Out of scope

- Building either page: publishing a Duty Menu or a self-Map, or reading them. A later code book does
  this, once book `duty-menus-and-self-maps` has ratified the protocol.
- A real "needs attention" check or a **Done** state for either card.
- A link from the Treasure Map placeholder to `/treasure-map`. That page is the person's own Map, not the
  Assistant's, so a link would mix the two.
- Changes to the FAQ, the Assistant Alert's wording, or any other action.
- Any change under `protocols/`.

## Open questions

None.

## Linked artifacts

- ADR: `engineering-team/decisions/assistant-duty-cards/0001-two-placeholder-entries-in-the-one-action-list.md`
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
