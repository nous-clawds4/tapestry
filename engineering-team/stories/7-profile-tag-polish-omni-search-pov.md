# Story 7: Profile-tag polish bundle — omni-search popup + POV correctness

**Status:** Approved
**Created:** 2026-05-14
**Type:** Feature

## Background
Stories 1–5 of the profile-tag stack shipped the core feature: tagging users, tag-detail pages, tag-index page, and the authored-tagging section on profile pages. A handful of small polish and correctness items remain before the feature is buttoned up. Bundling them into one story so they ride a single test plan and review pass.

Three categories of work here, all small individually but coherent as a "tighten the feature" sweep:

1. **Omni-search expansion.** Tags exist as a first-class result type in the live autocomplete popup. The data plumbing exists (Story 1 added `_matchedTags` to profile-search hits, and `computeTagMatches` already produces tag matches by query); this story wires tags through to the popup as their own result-row variant so a user typing "homesteader" sees the tag itself surface, not only profiles tagged with it. The Enter-results page is explicitly **out of scope** for this story — that's Story 8's parity work.
2. **POV correctness sweep.** The TAGS chip row on profile pages doesn't WoT-filter assertion authors, so its counts aren't POV-scoped — a CLAUDE.md POV-first invariant violation that predates the invariants becoming explicit. Fix it, and while in there, audit every other read endpoint in the profile-tag stack for the same gap and fix any others found.
3. **Cross-cutting accessibility / polish.** The POV selector currently lives below the main search field; surfacing it in the upper-right avatar menu would let users switch POV from anywhere — *conditional* on first verifying that on-the-fly POV switching actually re-derives all POV-dependent state correctly. Plus the small remaining bit of Story 6 (search placeholder mentions "tag") and a verification that Story 6's scroll AC holds on busy profiles.

This story also formally closes out Story 6 — its three main items shipped via commit `1e5b3044`, but the placeholder-text AC (AC-5) and the scroll-verify AC (AC-4) were never confirmed.

## User-facing description
As a Brainstorm user, I want the search popup to surface tags as their own result type (not only profiles tagged with them), the search placeholder to suggest I can search by tag, the chip-row counts on profile pages to honor my active POV, and a way to switch POV from anywhere in the app without losing track of where I am — so the feature feels coherent and POV-aware everywhere it should be.

## Acceptance criteria

### Omni-search: tags in the live popup

- [ ] Given I type a query that matches a tag's name or description (case-insensitive substring), when the live popup renders, then I see a tag result-row for that match alongside any profile results.
- [ ] Given a tag result-row appears in the live popup, when I click it, then I navigate to that tag's detail page (`/tag/:slug/:tagId`).
- [ ] Given a tag result-row appears, when I look at it, then it's visually distinguishable from profile rows (a different row layout, label, or marker — Architect's call on the exact treatment) so I don't mistake one for the other.

### Search placeholder text *(inherits Story 6 AC-5)*

- [ ] Given I view the home/search page, when I look at the main search input's placeholder, then "tag" is included in the suggested-searchable list (e.g. "Search by name, bio, tag, NIP-05, website…").

### POV-scoped chip counts *(POV correctness fix)*

- [ ] Given I am viewing a profile page and the TAGS chip row renders, when I look at the per-chip application and dispute counts, then those counts reflect only assertions authored by people in my active POV's WoT — not all assertions on the network.
- [ ] Given I am viewing a profile page and the chip-popover lists asserters, when I look at it, then the asserter list reflects only POV-WoT-allowed authors.
- [ ] Given I switch my active POV, when the chip row re-fetches, then the counts re-derive against the new POV's WoT.
- [ ] Given my active POV resolves to no configured POV (e.g., logged-out, no house POV configured), when the chip row renders, then it degrades to the existing "all assertions count" behavior (no regression for the no-POV path).

### POV sweep across the rest of the profile-tag stack

- [ ] Given any other read endpoint in the profile-tag stack returns counts derived from authored assertions, when called with a POV, then those counts are POV-scoped (no remaining POV-naive endpoints). The Architect enumerates which endpoints qualify; any that intentionally remain POV-naive must be documented in the ADR with a stated rationale.

### POV selector in the upper-right avatar menu *(conditional)*

- [ ] **Pre-verification gate:** Before this AC is shippable, the Architect must verify that changing POV via a selector accessible from anywhere correctly re-derives all POV-dependent state across the application without a page refresh — including (at minimum) search results, tag chip counts (post-fix), tag-detail page rows, the TAGGING ACTIVITY section, and the active-POV indicator. If gaps surface, drop this AC from the story and file the gaps as follow-ups; do not ship a half-working selector.
- [ ] Given the pre-verification passes, when I open the upper-right avatar menu on any page in the app, then I see a POV selector (or POV-switch affordance) that lets me change my active POV without leaving the page I'm on.
- [ ] Given the avatar-menu POV selector exists, when I change POV through it, then every POV-dependent surface visible on the current page re-derives against the new POV.

### Close out Story 6

- [ ] Given a profile has more asserters on a tag than fit comfortably in the chip popover, when I open that tag's popover, then the asserter list scrolls within the popover and the popover does not expand past a reasonable max-height. *(Inherits Story 6 AC-4 — verify and surface as CHANGES_REQUESTED in Review if not already satisfied.)*
- [ ] Given Story 7 passes Review, then Story 6 is retired to `engineering-team/stories/done/` with its Status set to Done, since all of Story 6's intent is then covered (AC-1/2/3 via commit `1e5b3044`; AC-4 verified above; AC-5 satisfied by this story's placeholder-text AC).

## Concepts touched
- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:nostr-user-tag` — assertion concept whose counts gain POV-correctness.
- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:tag` — first-class result type in the popup; new row variant.
- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:nostr-user` — profile result-row interleaving alongside tag rows.

## Out of scope
- ~~Tag results on the **Enter-results page** — Story 8.~~ **Now in scope** (rolled in during Architecture per PO direction: both popup and Enter-results page surface tag results in Story 7; sort-order coherence + interleaving symmetry remain Story 8's job).
- Sort-order coherence between popup and Enter-results page — Story 8.
- POV selector loading state polish — Story 8.
- Agree/disagree framing UX normalization across tag-detail rows and chip popovers — remains in `engineering-team/follow-ups.md`.
- `e` vs `a` wire-shape decision for nostr-user-tag — remains in `engineering-team/follow-ups.md`.
- Surfacing additional result types beyond tags + profiles in the popup (no NIP-05 / npub-lookup variants here).
- Caching layer on any of the affected endpoints.
- Pagination retrofits — orthogonal.

## Open questions
- Visual treatment of the tag result-row in the popup vs the profile result-row. **Architect.**
- Whether the tag-result data flows through the existing profile-search proxy as a bolt-on (today's path for `_matchedTags`) or whether tag-only results need their own fetch concurrent with the profile-search fetch. **Architect.**
- Exact set of "POV-dependent surfaces" that the avatar-menu POV-selector pre-verification has to cover. **Architect** — should enumerate in the ADR.
- Whether the avatar-menu POV change is durable (writes to user prefs / settings) or session-only. PO lean: same persistence as the existing below-search selector — whatever that does, this should match. **Architect to confirm.**
- If the pre-verification fails, the avatar-menu AC drops — but **does any of the underlying re-derivation work still ship anyway** (e.g., wiring up cross-page invalidation, even if no visible UI lands)? PO lean: yes, if cheap; no, if it'd require speculative infrastructure. **Architect's judgment.**

## Linked artifacts
- ADR: `engineering-team/decisions/0006-profile-tag-polish-omni-search-pov.md`
- Test plan: `engineering-team/stories/7-profile-tag-polish-omni-search-pov.test-plan.md`
- Review: (filled in after Review phase)
