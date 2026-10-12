# Epic: assistant-coming-soon — the hub's unbuilt cards say Coming soon and stop counting

**Status:** Active
**Created:** 2026-10-12
**Book:** `engineering-team/audits/assistant-coming-soon/book.md` (no PRD — acceptance frame; Light trial)
**Provenance:** the owner's ask of 2026-10-12, quoted verbatim in the book. It revisits `assistant-management` (Done),
whose story 1 made every action without a check an always-marked, always-counted placeholder.

## Goal

**A card for something not built yet says so, and doesn't nag.** On `/assistant`, Bounties, Pins, Tags,
Notifications and Alerts, and Preferences show a muted **Coming soon** pill in place of **Needs attention**, and
neither the hub's count line nor the top-bar pill counts them, the way the background image panel on
`/assistant/profile` already works. Their pages say "Coming soon." too.

## Stories

`stories/assistant-coming-soon/`.

1. `1-coming-soon-cards.md` (feature): the five cards' pill, the two counts, and the line on their pages.

## Key facts / guardrails

- **Coming soon is the same for every viewer.** Whether an action is built is a fact about this instance's build, not
  about the viewer's Assistant, so the pill shows for visitors too, as on `/assistant/profile`. The marks and counts
  stay about the viewer's own Assistant.
- **One answer.** The hub's marks, its count line and the top-bar pill all read `assistantAttention` in
  `ui/src/pages/assistant/actions.js`. The change lives there, so the three can't disagree.
- **Read-only, client-only.** Nothing is fetched, published, signed or stored that wasn't before. The server's
  attention answer is unchanged.
- **Your Assistant's Treasure Map card is out of scope** (the owner: "let's just not do anything to that card in this
  session").

## Deferred / out of scope

- Your Assistant's Treasure Map card.
- Building any of the five actions.

## ADRs

None expected (Light: a Design note in the story file, unless an irreversibility trigger fires).
