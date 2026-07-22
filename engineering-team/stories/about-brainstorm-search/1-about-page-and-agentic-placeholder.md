# Story 1: About Brainstorm Search page + agentic-search placeholder

**Status:** Approved
**Created:** 2026-07-21
**Type:** Feature (UI / docs)

## Background

The search home page ([ui/src/pages/BrainstormSearch.jsx:1307-1311](../../../ui/src/pages/BrainstormSearch.jsx)) has a three-link footer: `Developers · How search works · Settings`. The only explanatory link, `How search works`, goes to a *mechanism* page (Meilisearch, GrapeRank verification scoring). Nothing on the site tells a visitor **what they can do** with Brainstorm Search — and in particular, nothing signals that it is reachable other than by typing into the search bar.

Operator request 2026-07-21: add an overview page organized around the ways search can be used, and make it the footer entry point. Built lightweight (no ADR / failing tests; browser-verified), matching the precedent set by `developers-pages` story 1.

## User-facing description

As a visitor to Brainstorm Search, I want one page that explains what it is and the different ways I can use it, so that I can find the path that fits how I work — typing a query myself, letting an agent do it, or reaching it from another nostr client.

## Acceptance criteria

Browser-testable on the rendered SPA.

- [ ] **`/about-brainstorm-search` renders** with the standard informational-page chrome — logo top bar + `BrainstormUserMenu`, centered content column — visually consistent with `/how-search-works` and `/personalization`.
- [ ] **Section 1 "How Search Works"** renders a brief paragraph containing a link to **`/how-search-works`**.
- [ ] **Section 2 "How to Use Brainstorm Search"** lists exactly three ways to use it:
  1. **Directly, through the search bar** — no outbound link required.
  2. **Using your agent** — links to **`/brainstorm-skill`**.
  3. **Via other nostr clients** — links to **`/developers`**.
- [ ] **Footer swap:** the home-page footer renders a link labeled **"About Brainstorm Search"** → `/about-brainstorm-search`, and **no longer renders** the `How search works` link. The other two footer links (`Developers`, `Settings`) are unchanged.
- [ ] **`/how-search-works` is unchanged and still reachable** — the page's content and route are untouched; it is now entered via Section 1 rather than the footer.
- [ ] **`/brainstorm-skill` renders** the operator's draft copy (below) with page chrome consistent with the other informational pages.
- [ ] **Deep-linking** directly to `/about-brainstorm-search` and `/brainstorm-skill` loads each page (SPA catch-all; no server change).
- [ ] **Additive / isolated:** frontend only. No console errors on any of the three pages. No other page, route, or backend behavior changes.

### `/brainstorm-skill` draft copy (operator-supplied, verbatim)

> Google search was revolutionary back in the day. A user goes to the search bar, types in keywords or a sentence, and sees a list of results. But the future of search is not the search bar. It is agentic. You're not going to deal with the search bar; your agent will do the typing for you. Watch this space for more information.

Operator note: *"will undergo much editing when the time comes."* Ship as-is; treat as a placeholder, not final copy.

## Concepts touched

None. This story adds static presentational pages only — no concept-graph reads, no POV-dependent data, no trust scoring. (Verified against `/api/concept-graph/summaries`, 45 concepts, 2026-07-21.)

## Out of scope

- **Any edit to `/how-search-works` or `/personalization`.** They stay byte-identical.
- **The `/about` naming overlap.** `/about` (`BrainstormAbout.jsx`) already exists; having both it and `/about-brainstorm-search` is a known, *deliberately deferred* overlap (operator decision 2026-07-21). Do not rename, merge, or "clean up" either page in this story.
- **Real agent-integration content.** No packaged skill / MCP server / agent integration exists in the repo (verified 2026-07-21). `/brainstorm-skill` is a placeholder staking out a direction, not documentation of a shipped capability.
- **The `/developers` hub expansion** (Trusted Assertions + Relay Tools cards) — that is `developers-pages` story 2. This story only *links to* `/developers` as it already exists.
- **Restyling the footer** beyond swapping the one link.

## Open questions

None blocking. Resolved during planning:

1. ~~Agent section dead-ends on an empty page?~~ — Resolved: operator supplied vision copy, so the page has substance rather than a bare "coming soon".
2. ~~`/about` vs `/about-brainstorm-search` overlap?~~ — Resolved: deliberately deferred, out of scope here.
3. ~~Footer swap buries the GrapeRank/verification explanation one click deeper?~~ — Resolved: accepted tradeoff; the new page is the better front door and Section 1 carries the link.

## Linked artifacts

- ADR: none (lightweight docs-UI treatment, operator-approved 2026-07-21)
- Test plan: none (browser-verified)
- Review: (filled after Review phase)
