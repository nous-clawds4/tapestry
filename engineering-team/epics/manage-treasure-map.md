# Epic: manage-treasure-map — the Manage your Treasure Map page at `/treasure-map`

**Status:** Active
**Created:** 2026-10-07
**Book:** `engineering-team/audits/manage-treasure-map/book.md` (no PRD — acceptance frame)
**Blueprint:** the Claude Design artifact's "Manage your Treasure Map" screen, kept as it stood at intake in
`engineering-team/audits/manage-treasure-map/blueprint/`.

## Goal

**A plain-language page, on the Brainstorm side of the app, where a signed-in person sees their Treasure Map**: which
Assistant looks after their Scores, their Lists and their Concepts, and the Map itself. **My Treasure Map** in the
Brainstorm menus opens it. The Tapestry side keeps the TA Treasure Map page, unchanged.

## Stories

Both are features, so both take the five phases (Standard). They're built in this order, then shipped to staging
together.

1. `1-the-manage-your-treasure-map-page.md`: the page, the menu links, the FAQ, the raw Treasure Map, the Advanced
   management placeholder, and the My Assistants page's links. It reads. It publishes nothing.
2. `2-the-assistants-by-category-cards.md`: the **Assistants by category** cards (Scores, Lists, Concepts), each with
   the Assistant, "Mixed · N Assistants" or "Not assigned yet" the Map gives it (book decisions 7–8); plus story 1's
   review findings 1, 2 and 4. Read-only. Depends on #1.

Queued for a later book, by the owner's decision at intake (book decision 1): the design's **Edit** mode (assign an
Assistant to a category or to everything, override individually assigned duties, Save, which signs a new Treasure Map)
and the full **Advanced** page.

## Key facts / guardrails

- **"Whose Treasure Map?" is this epic's POV question.** Always the signed-in person's own kind 10040. A signed-out
  visitor sees a sign-in prompt, never someone else's Map.
- **Read-only in this book.** Nothing on these pages signs, publishes or stores anything.
- **Two shells, two destinations.** The Brainstorm menus (search landing page, Brainstorm top bar) send **My Treasure
  Map** to `/treasure-map`; the Tapestry header's menu keeps `/tapestry/grapevine/treasure-map`. Tapestry-side links
  (the sidebar's TA Treasure Map, My Curated DLists) don't move.
- **"Local" means the viewer's own Assistant on this instance**, resolved at runtime, as on `/assistants`. Never a
  hardcoded pubkey (CLAUDE.md house rule).
