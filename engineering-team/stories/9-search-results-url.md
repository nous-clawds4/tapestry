# Story 9: Stable URL for the search-results page

**Status:** Approved
**Created:** 2026-05-18
**Type:** Feature

## Background
Today the Brainstorm search lives at a single client-side route (`/`). The landing view (search input, autocomplete popup) and the Enter-results view (full results page) are both rendered by the same component at the same URL — only React-internal state distinguishes them. As the user noticed during Story 8 verification:

- A results page has no shareable URL. You can't paste a link to "this exact search."
- The browser back button does the wrong thing — it takes you to whatever was before the landing page, skipping over the results state you were just viewing.
- Refreshing a results page resets you to the landing view with an empty query.
- Bookmarking is impossible.

Once tag results (Story 7) and parity (Story 8) shipped, the search page became a meaningful destination — but it isn't addressable as such. This story makes it addressable.

The fix is conceptually small but user-visible: the results view gets its own URL that round-trips through paste/refresh/share/browser-history. Landing on a results URL directly should produce the same view as typing the query and pressing Enter.

## User-facing description
As a Brainstorm user, I want the search-results page to have its own stable URL so I can share a link to a specific search, bookmark it, refresh without losing my place, and use the browser's back and forward buttons in the way I'd expect anywhere else on the web.

## Acceptance criteria

- [ ] Given I am on the landing page with a query typed in, when I press Enter (or otherwise submit), then the URL changes to a stable, shareable form that encodes my query. The URL is unique per query — two different queries produce two different URLs.
- [ ] Given I have a results-page URL (received via share / bookmark / paste / refresh), when I navigate to it, then the page loads directly into the results view for that query without me re-typing anything. The displayed query, results, sort, and tag-results all match what a fresh `landing → type → Enter` would produce for the same query.
- [ ] Given I am on a results page, when I press the browser back button, then I am taken to the previous entry in browser history (typically the landing page if I started there). The results page does not appear "skipped" in history.
- [ ] Given I have navigated landing → results → back → landing, when I press the browser forward button, then I return to the results page for the same query I was on, with the same results visible. No re-fetching the user can perceive as a regression.
- [ ] Given my query contains special characters (spaces, punctuation, non-ASCII), when the URL is constructed and later parsed back, then the query received on parse equals the query that was sent — round-trip is lossless.
- [ ] Given I change my POV (via the selector below the search field) while on a results page, when the URL is updated, then the URL reflects the active POV in a way that a recipient pasting the URL into their own browser sees the same POV-scoped view (subject to their own client-side POV settings — see "Open questions"). If the Architect decides POV does not belong in the URL for v1, the URL captures only the query and the recipient sees results under their own active POV.
- [ ] Given I am logged out (house POV), when I share a results URL with another logged-out user, then they see the same results under their instance's house POV.
- [ ] Given I am on the landing page (no query, no submit), when I look at the URL, then it remains the landing URL — typing into the input does not change the URL until I submit.

## Concepts touched
- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:nostr-user` — profile results surfaced under the URL.
- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:tag` — tag-element results surfaced under the URL.
- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:nostr-user-tag` — tag-matched profiles surfaced under the URL.

(All three are read-only on this story — no schema or concept changes.)

## Out of scope
- **Filter / sort state in the URL.** Could be a future story if we want shareable filtered views; today the search has no user-facing sort/filter affordances on the results page.
- **Pagination state in the URL** (`&page=N` or `&offset=N`). The shareable URL captures the query; the user's current scroll/page position is ephemeral.
- **Tag-detail / profile-page / authored-tagging URLs** — already deep-linkable; this story is specifically the Brainstorm root search.
- **Server-side rendering of results.** No SSR change; React Router handles the URL → state hydration on the client.
- **Cross-app POV deep-linking** (e.g., "what's this profile look like from house POV?"). Out of scope; ties into the existing cross-page POV invalidation follow-up.
- **Migration / redirect** from any pre-existing URL shape — the search has only ever lived at `/`, so there's nothing to migrate from.

## Open questions
- **Exact URL shape.** Candidates include `/search?q=<query>`, `/?q=<query>`, `/results?q=<query>`, `/q/<query>`. The choice affects routing setup, link aesthetics, and back-compat with any existing `/`-only state. **Architect.**
- **POV in the URL?** Three positions worth considering: (a) yes, always — full shareability of "what I'm looking at"; (b) no, never — keep URLs short and let each viewer's POV apply; (c) only when explicitly set (e.g., not the recipient's default). **Architect, with PO available for product framing.** PO lean: (a) for shareability — Brainstorm's POV-first principle means "what I see" includes POV, so a shareable URL should capture it.
- **What URL does the landing page have when the query input is empty?** Likely the bare route, with no `?q=`. Confirms the "typing alone doesn't update the URL" AC. **Architect to formalize.**
- **What happens to the URL if the user clears the query (deletes all input) while on a results page?** Should the URL revert to landing, or remain at the results URL with the now-empty query box? PO lean: revert to landing — empty query means "I'm done with this search." **Architect.**
- **Browser-history granularity.** Should every keystroke produce a history entry (no), or only Enter-submits (yes), or also significant transitions like POV changes (maybe)? PO lean: only Enter-submits and POV changes create history entries. Typing alone does not. **Architect.**

## Linked artifacts
- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
