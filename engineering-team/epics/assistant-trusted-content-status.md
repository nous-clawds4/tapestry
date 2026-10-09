# Epic: assistant-trusted-content-status — Scores, Lists and Concepts on the hub, renamed and told true

**Status:** Active
**Created:** 2026-10-08
**Book:** `engineering-team/audits/assistant-trusted-content-status/book.md` (no PRD — acceptance frame)
**Provenance:** the owner's ask of 2026-10-08, quoted verbatim in the book, settled through two questions at
intake (book § Decisions). It follows `assistant-identification-tags` (an action whose hub card gets a real
"needs attention" answer from `GET /api/assistant/attention`) and reads the Treasure Map the way
`manage-treasure-map` #2 / `treasure-map-edit` #1–#2 read it.

## Goal

**The hub's first three "Publication of Trusted Content" cards become Scores, Lists and Concepts, and stop
being placeholders.** They mirror the Treasure Map page's three categories. Each is Done when the person's
Treasure Map gives that category to their Tapestry Assistant on this instance, and Needs attention otherwise,
so the hub, its count line and the Assistant Alert tell the truth for them.

## Stories

`stories/assistant-trusted-content-status/`.

1. `1-scores-lists-and-concepts-on-the-hub.md` (feature): the three names, the server's answer from the
   viewer's own Treasure Map, and the hub's marks, count line and pill reading it.

## Key facts / guardrails

- **"Whose Map, which Assistant?" is this epic's POV question.** The Map is the signed-in person's own kind 10040;
  the Assistant is their own Assistant on this instance (`user.assistantPubkey`, the one main→delegate mapping;
  for the Owner the instance TA). The TA pubkey is resolved at runtime, never hardcoded.
- **One reading of the Map.** Which entries count for which category is the Treasure Map page's rule; the hub
  must not grow a second one that could disagree with it.
- **An intended difference from `/treasure-map`'s own pill** (treasure-map-card-details #1): that pill marks a
  category with *no* Assistant. The hub asks whether *your Tapestry Assistant here* is one of them, because the
  hub is about what your Tapestry Assistant does (book Decision 1). A category held only by another provider's
  Assistant is fine on `/treasure-map` and needs attention on `/assistant`.
- **Read-only.** Nothing is published, signed or stored by the check. Changing the Map stays the Treasure Map
  page's job.
- **Open work this epic touches:** `assistant-profile-checklist` and `assistant-outbox-relays` (both open) change
  the same hub answer; the first adds the hub's **Done** badge, which this epic reuses (book § Shared lines).

## Deferred / out of scope

- The pages behind the three cards beyond their names, alert criteria and one link to `/treasure-map`: showing each
  category's status there, and any one-click fix.
- Renaming the cards' page addresses, their descriptions, or the FAQ's words.
- Whether the Assistant actually publishes those events (only that the Map points at it).
- `/treasure-map`'s own pill rule.

## ADRs

`decisions/assistant-trusted-content-status/`, created at Architecture.
