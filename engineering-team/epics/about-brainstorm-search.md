# Epic: About Brainstorm Search

**Status:** Done (epic retired 2026-07-22 at book close — story 1 Done + live on all three instances; audit + prd-seed under `audits/about-brainstorm-search/`)
**Provenance:** Operator request 2026-07-21. The search home page's only explanatory footer link was `How search works` — a *mechanism* page (Meilisearch + GrapeRank verification). Nothing told a visitor **what they could do** with Brainstorm Search, or that it can be reached other than through the search bar.

## What this is

A visitor-facing entry point — `/about-brainstorm-search` — that answers "what is this and how do I use it," and routes onward to the existing mechanism pages rather than replacing them.

Its organizing idea is **three ways to use Brainstorm Search**:

1. **Directly**, through the search bar.
2. **Through your agent** — the position that search is going agentic; a placeholder page (`/brainstorm-skill`) stakes out that direction.
3. **Via other nostr clients** — routed to the existing `/developers` hub.

The page becomes the home-page footer link, displacing `How search works` from the footer (that page is unchanged and is reached from the new page's first section).

Frontend-only: React routes + static components. No backend, API, data, or POV logic.

## Stories

`stories/about-brainstorm-search/`:
1. **about-page-and-agentic-placeholder** — the About page, the footer swap, and the `/brainstorm-skill` placeholder. *(this story)*

## Out of scope

- Any change to `/how-search-works` or `/personalization` content — they stay exactly as-is.
- Reconciling the naming overlap with the pre-existing `/about` page. Operator acknowledged the overlap 2026-07-21 and **deliberately deferred** it; do not "fix" it opportunistically.
- Real content for `/brainstorm-skill` beyond the operator's draft copy — the packaged agent skill does not exist yet (verified: no skill, MCP server, or agent integration anywhere in the repo).
- The `/developers` hub expansion — that lives in the **`developers-pages`** epic, whose own out-of-scope note reserved it ("future feature pages slot into the same hub").
- ADR + failing-tests ceremony — lightweight docs-UI treatment, operator-approved 2026-07-21, matching the precedent set by `developers-pages` story 1. Verification is browser-based.
