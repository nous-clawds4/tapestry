# Story 2: Tag-detail page (read)

**Status:** Approved
**Created:** 2026-05-13
**Type:** Feature

## Background
Story 1 made tagging possible but gave it no home. Today a user sees chips on profiles, opens the popover, and that's the depth of what a tag *is*. There's no way to ask "show me everyone in my WoT who's been tagged 'Podcaster'" or to discover profiles through a tag. This story gives every tag a stable, navigable landing page that displays the tag and the WoT-counted list of profiles tagged with it. Active-tagging affordances (Apply / Dispute / search-and-apply) ship in Story 3.

Per Story 1's POV-first principle, every count, list, and ordering on this page is computed against the **active POV's WoT** (default house POV; switches when the user changes POV).

## User-facing description
As a Brainstorm user, I want to visit a stable page for any tag — seeing its description, who created it, and the full set of profiles tagged with it in my active POV's WoT, sortable by consensus / dispute / divisiveness — so that I can understand what a tag means in my community and discover profiles through it.

## Acceptance criteria

- [ ] Given I am viewing a tag chip anywhere in the UI, when I click the chip's name (not an in-popover action), then I navigate to a stable shareable URL for that tag.
- [ ] Given I land on a tag-detail page, when the header renders, then I see the tag's name, description, and the original author (signer of the kind-39999 tag element) with their display name + avatar where available, falling back to a shortened pubkey.
- [ ] Given I am on a tag-detail page, when the list of tagged profiles renders, then each row shows the profile's display name, avatar, the count of WoT applications, and the count of WoT disputes for this tag — counted *only* over assertions from authors in my active POV's WoT.
- [ ] Given I am on a tag-detail page, when I look at the sort controls, then I see three labelled options. Each label hints at its behavior:
  - **Most applied** — descending by WoT count of applications.
  - **Most disputed** — descending by WoT count of disputes.
  - **Most divisive** — profiles whose tag assertions are most evenly split between application and dispute *with non-trivial total volume* (so a single 1-apply-vs-1-dispute profile doesn't outrank a 50-vs-50 one).
- [ ] Given the page loads for the first time, when no sort is selected, then the default is "Most applied".
- [ ] Given I change the sort, when the new ordering is applied, then the list updates in place without a full page reload.
- [ ] Given I click a profile row, when I navigate, then I land on that user's profile page.
- [ ] Given no profile in my active POV's WoT has been tagged with this tag, when the page loads, then I see a friendly empty state that still includes the tag's name, description, and author.

## Concepts touched
- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:tag`
- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:nostr-user-tag`
- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:nostr-user`

## Out of scope
- Apply / Dispute affordances on profile rows (Story 3).
- Search input on the tag page to find arbitrary profiles to tag (Story 3).
- Revoking an assertion from this page.
- Editing or deleting a tag's definition.
- Cross-POV comparison views.
- Tag index / catalog page (Story 4).
- Authored-tagging scroll section on profile pages (Story 5).
- Polish bundle — chip-popover persistence, asserter names/avatars, search placeholder (Story 6).
- Pagination / virtualization for very large WoT-tag sets.

## Open questions
- Routing convention (`/tag/<slug>` vs `?tag=<slug>` vs other). **Architect.** PO lean: `/tag/<slug>` for consistency with `/user/<pubkey>`.
- "Most divisive" formula details — sort by closeness of `applied/(applied+disputed)` to 0.5, with a volume floor or volume weighting so a 1v1 profile doesn't outrank a 50v50. **Architect.**
- Chip click-target split: clicking the chip's *name area* navigates to the tag page; hover/focus opens the popover. Needs to coexist with Story 6's popover-persistence improvements. **Architect to define a coherent interaction model.**

## Linked artifacts
- ADR: `engineering-team/decisions/0002-tag-detail-page-read.md`
- Test plan: `engineering-team/stories/2-tag-detail-page-read.test-plan.md`
- Review: (filled in after Review phase)
