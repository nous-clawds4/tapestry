# Epic: assistant-shared-categories — Done, but shared: Scores, Lists and Concepts held by another Assistant

**Status:** Done (book closed 2026-10-11; the folders sit under `done/`; on staging since `397d236`, with the Gate B fixes in `14455d4`; in production 2026-10-12 via PR #851, merged as `df457d6`, deploy run 149)
**Created:** 2026-10-11
**Book:** `engineering-team/audits/assistant-shared-categories/book.md` (no PRD — acceptance frame; Light trial)
**Provenance:** the owner's ask of 2026-10-11, quoted verbatim in the book, settled through three questions at
intake (book § Decisions). It revisits `assistant-trusted-content-status` (Done), whose book Decision 1 made a category
held only by other Assistants **Needs attention** on the hub.

## Goal

**A category that another Assistant holds is done, and says so quietly.** On `/assistant`, Scores, Lists and Concepts
each get a third state besides **Needs attention** and **Done**: **Done, shared**. It keeps the Done look, adds a muted
**Shared** pill and one short line linking to `/treasure-map`, and the hub's count line and the top-bar pill don't
count it.

## Stories

`stories/done/assistant-shared-categories/`.

1. `1-done-but-shared.md` (feature): the rule's third state in the server's answer, the hub card's Shared pill and
   line, the counts, and the rule's words on the three pages, in the BIBLE and in the API description.

## Key facts / guardrails

- **"Whose Map, which Assistant?" is unchanged.** The Map is the signed-in person's own kind 10040. "Local" means
  their own Assistant on this instance (`user.assistantPubkey`; for the Owner the instance TA). The TA pubkey is
  resolved at runtime, never hardcoded.
- **One reading of the Map.** Which Assistants a category is given to stays the Treasure Map page's rule
  (`src/lib/treasureMapCategories.mjs`, `categoryAssistants`). The hub must not grow a second one.
- **Read-only.** Nothing is published, signed or stored by the check. Moving duties stays the Treasure Map page's
  job; the new line only links there.
- **Open work this epic touches:** `assistant-duty-menu` #1 is changing the same hub answer (book § Shared lines).

## Deferred / out of scope

- Showing the state, or the line, on the pages behind the three cards (beyond their *Alert criteria*).
- A one-click "move it to my Assistant" that edits the Map.
- `/treasure-map`'s own pill rule.

## ADRs

None expected (Light: a Design note in the story file, unless an irreversibility trigger fires).
