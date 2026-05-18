# Story 8: Search-result parity — live popup ↔ Enter-results page

**Status:** Approved
**Created:** 2026-05-14
**Type:** Feature

## Background
The root app's search has two surfaces: the **live autocomplete popup** that appears as you type, and the **Enter-results page** you land on when you press Enter (or submit) on a query. Today these two surfaces diverge — different result sets, different sort orders, sometimes different affordances entirely. A user who narrows in on a profile via the popup may not see it on the results page, or sees it in a different position; tags surfaced in one surface aren't reliably present in the other.

**Residual jank after Story 7 (ADR-0006):** Story 7 surfaces tag-results in **both** the popup AND the Enter-results page (a scope expansion landed during architecture: same endpoint, free data flow). What Story 7 does *not* do is unify sort order or interleaving across the two surfaces — tags-then-profiles is the popup's choice; the results page renders in whatever order `doSearch` produces. The two surfaces show the same *set* of results post-Story-7 but may differ in *position*. Story 8 closes that gap: sort coherence, interleaving symmetry, and any remaining affordance unification (e.g., the popup's "Show more tags →" semantics on the results page itself).

This story closes that gap. Same query → same results in both surfaces, in the same order. Whatever the popup ranks first, the Enter-results page ranks first too. New result types (e.g., tags, surfaced into the popup by story #7) carry over coherently.

Story #7 first adds tag results to the live popup; this story brings the Enter-results page into alignment so the user experience is consistent regardless of which path they took. Treat this as the "omni-search consistency" pass — once it lands, the search surface speaks with one voice.

A small POV-selector polish item (loading state below the main search field) rides this story as well, since POV affects search and the parity work touches the same UI region.

## User-facing description
As a Brainstorm user, I want the search popup and the Enter-results page to show me the same results in the same order for the same query, so that I don't get confused, lose track of a result I just saw, or have to re-narrow my search when I move from one surface to the other. As an extension: when I change POV in the selector below the main search field, I want to see a brief loading indicator so I know the change is being applied.

## Acceptance criteria

- [ ] Given I type a query that produces results in the live popup, when I press Enter (or otherwise submit) on the same query, then the Enter-results page renders the same set of results.
- [ ] Given the live popup shows results in a specific order (whatever the ranking is), when I press Enter on the same query, then the Enter-results page shows them in the same order.
- [ ] Given a query produces **tag results** in the live popup (as introduced by story #7), when I press Enter, then those tag results appear on the Enter-results page in the same relative position as in the popup.
- [ ] Given a query produces **profile results** alongside tag results in the live popup, when I press Enter, then the interleaving of profile vs tag results on the Enter-results page matches the popup.
- [ ] Given I change my POV mid-session, when I run the same query in both surfaces, then both surfaces re-derive against the new POV consistently — neither surface lags behind the other.
- [ ] Given the POV selector below the main search field is in the middle of resolving a POV change, when I look at the selector, then a visible loading indicator (spinner, label change, or equivalent) tells me the change is in flight. The indicator resolves once the change has taken effect across the search surfaces.
- [ ] Given I'm logged out (house POV) and I run the same query in both surfaces, then they remain consistent — POV consistency is not a logged-in-only guarantee.

## Concepts touched
- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:nostr-user-tag` — tag results introduced by story #7 propagate from popup to Enter-results page.
- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:tag` — same.
- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:nostr-user` — profile results.

## Out of scope
- Introducing new result types beyond profiles + tags (no NIP-05 / npub-lookup result-row variants in this story).
- Pagination changes on either surface — orthogonal concern.
- Sort-by controls or filter affordances on either surface — this story locks parity at whatever the current ranking is, not redefines the ranking.
- Caching layer on either surface.
- POV-selector relocation to the upper-right avatar menu — that's a story #7 item.
- Visual redesign of either surface — only the parity-relevant changes.

## Open questions
- Whether the popup's debounced fetch path and the Enter-results page's fetch path should be unified into one shared client-side query helper, or kept as parallel calls into the same server endpoint with matched parameters. **Architect.**
- Whether server-side ranking is already consistent (and the divergence is purely client-side / debounce-related) or whether the two surfaces hit different endpoints with different ranking. **Architect to audit.**
- If the divergence has a server-side root cause, whether to fix it server-side (single endpoint, single ranking) or document the matched-parameters contract and enforce it on the client. **Architect.**
- Exact UX of the POV-selector loading indicator (spinner, label change, disabled state, all three). **Architect.**

## Linked artifacts
- ADR: `engineering-team/decisions/0007-search-result-parity.md`
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
