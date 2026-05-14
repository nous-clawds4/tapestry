# Story 4: Tag index page

**Status:** Approved
**Created:** 2026-05-14
**Type:** Feature

## Background
Stories 2 & 3 give every tag its own detail page, but a user needs a way to *find* tags in the first place — to browse the catalog of what their community is actually labelling things with, sort by what's getting traction or controversy, and discover tags they might want to apply themselves. This story adds a top-level "all tags" index page.

Per Story 1's POV-first principle, every count, list, and ordering on this page is computed against the **active POV's WoT** (default house POV; switches when the user changes POV).

## User-facing description
As a Brainstorm user, I want a page that lists every tag known to my community (the active POV's WoT), with sort and filter affordances, so I can browse what's getting used, see what's contested, and click through to any tag's detail page.

## Acceptance criteria

- [ ] Given a top-level navigation entry exists for the tag index, when I click it, then I navigate to a stable shareable URL for the index.
- [ ] Given I land on the tag index, when the list renders, then I see one row per tag that has at least one assertion (application or dispute) authored by someone in my active POV's WoT.
- [ ] Given the list renders, when I look at each row, then I see the tag's name, description, original author, total WoT applications, total WoT disputes, and the row is clickable as a link to that tag's detail page (Story 2).
- [ ] Given I am on the tag index, when I look at the sort controls, then I see three labelled options. Each label hints at its formula:
  - **Most used** — descending by total WoT assertions (applications + disputes).
  - **Most endorsed** — descending by WoT applications.
  - **Most divisive** — apply/dispute most evenly split with non-trivial total volume (same rule as Story 2).
- [ ] Given the page loads for the first time, when no sort is selected, then the default is "Most used".
- [ ] Given I change the sort, when the ordering is applied, then the list updates in place without a full page reload.
- [ ] Given I type into the index-page search input, when the input changes, then the list narrows in place to tags whose name or description contains the substring (case-insensitive). The input should reuse the same component (and visual treatment) the root app uses for its main search bar — the goal is a consistent search affordance, not a parallel one-off.
- [ ] Given the WoT-known tag set exceeds a page-size threshold, when the page renders, then results are paginated with controls to load more / navigate pages. Page size and pagination model (cursor vs offset, "Load more" vs numbered pages) are the Architect's call. The motivation: under negentropy sync we can go from a handful of tags to a very large catalog quickly; this surface needs to degrade gracefully from day one.
- [ ] Given I change sort or search-filter, when the list refetches, then I'm reset to the first page of the new result set.
- [ ] Given no tag in my active POV's WoT has any assertions, when the page loads, then I see a friendly empty state explaining the POV and inviting me to either switch POV or start tagging.

## Concepts touched
- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:tag`
- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:nostr-user-tag`

## Out of scope
- Creating a new tag from this page (still done via the Add-tag dialog on a profile).
- Deleting / editing tags.
- Cross-POV comparisons.
- Per-tag detail (Story 2/3).
- Tag categories or hierarchical grouping.
- Surfacing tags as a result type in the root app's main search (tracked in `engineering-team/follow-ups.md`).

## Open questions
- Where the top-level nav entry lives (header link, dashboard tile, side-nav). **Architect.**
- URL convention (`/tags`, `/tag-index`, …). **Architect.**
- Pagination model: cursor-based (better for ranked sort orders that may re-rank under new data) vs page-offset (simpler). **Architect.**

## Linked artifacts
- ADR: `engineering-team/decisions/0003-tag-index-page.md`
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
