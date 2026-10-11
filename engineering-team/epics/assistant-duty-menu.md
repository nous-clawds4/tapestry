# Epic: assistant-duty-menu — the hub's Duty Menu page

**Status:** Active
**Created:** 2026-10-11
**Book:** `engineering-team/audits/assistant-duty-menu/book.md` (no PRD — acceptance frame)
**Provenance:** the owner's ask of 2026-10-11, quoted verbatim in the book and settled through three questions at
intake (book § Decisions).

## Goal

**Replace the hub's Duty Menu placeholder (assistant-duty-cards #1) with a real page.** The page shows the Duty Menu
this instance would publish for the viewer's Assistant beside the one published now. One button has the Assistant
sign and publish it, per `protocols/drafts/duty-menus.md`. The card's mark becomes a real check: **Done** when a
valid, current menu is found.

## Stories

`stories/assistant-duty-menu/`.

1. `1-the-duty-menu-page-and-its-check.md`: what this instance offers for the viewer's Assistant, the menu found
   for it now, whether they match, the hub's real mark, and the page that shows all three. Read-only.
2. `2-your-assistant-publishes-its-duty-menu.md` (approved 2026-10-11): Your Assistant publishes its Duty Menu: the button, the event (`duty-menus.md` §§ 4–5), where it
   goes (§ 8.1's publisher rule), and the report. Depends on 1. Carried from story 1's review (non-blocking):
   - **Hub latency.** Every hub load waits for the slowest outside relay, up to 8 s, even when this instance's relay
     holds the menu. The measured worst case is about 24 s, against the ADR's about 19 s (NB1, NB2). Once story 2
     writes each menu here first, consider a local-first lookup: § 8.1 lets a reader ask fewer relays. That needs an
     AC-3 amendment and an ADR.
   - **`isDutyMenu` never checks `event.pubkey`.** Its callers must filter by author first (NB5). The publisher must not
     rely on it alone.
   - **Doc touch-ups:** `attention.js`'s header lines 10 and 48 (NB9); BIBLE §11's row for the DList fallback and the
     50-relay cap (NB12); an empty found menu shows only the heading and the mark (NB7).
   - **The relay-list-publish S3 sentinel.** Consider an allow-list, or moving `isPublicRelayHostWithin` into
     `src/utils/ssrfGuard.js` (ADR 0001 Amendment 1 item 8; NB10).

## Key facts / guardrails

- **"Whose Assistant?"** is the viewer's own, from the session, as on the rest of the hub.
- **Honest rows.** A menu says what a key *offers*: what it will publish if a Treasure Map assigns it. It lists what
  this instance publishes for that key, at the relay where it lands (book Decision 1), plus Lists for every
  Assistant, a commitment the owner made at story 1's approval (tracked in `_intake.md`, 2026-10-11).
- **The spec is read, not edited.** `protocols/drafts/duty-menus.md` belongs to book `duty-menus-and-self-maps`.
- **Nous' pubkey is a community constant**, not the per-deployment TA pubkey. Define it once in shared code.
- **Not this epic:** Your Assistant's Treasure Map (self-Maps are not ratified yet), `/treasure-map`'s relay fill
  order, and the empty-relay fix (ledger `2026-10-10-external-assistant-relay-left-empty`).
