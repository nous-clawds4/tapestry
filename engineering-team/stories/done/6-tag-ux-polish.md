# Story 6: Polish bundle — tag chip popover + search placeholder

**Status:** Done
**Created:** 2026-05-14
**Type:** Feature

## Background
Three small UX gaps surfaced in Story 1 review and live use:

1. The chip popover closes on mouseleave / blur, so a user can't move their cursor down into the popover to click an asserter row.
2. Asserter rows currently show a raw 8-char pubkey prefix; mockup intent (and basic usability) calls for display name + avatar.
3. The main app-search placeholder ("Search by name, bio, NIP-05, website…") doesn't mention tags, even though Story 1's search integration makes tags a first-class search target.

None of these are full features; they're polish on existing surfaces. Bundling them so they ride a single test-plan and review pass.

## User-facing description
As a Brainstorm user interacting with tag chips and the global search, I want the chip popover to stay open long enough for me to click an asserter and navigate to them, with their human-readable name + avatar instead of a hex pubkey, and I want the search placeholder to suggest that I can search by tag too.

## Acceptance criteria

- [ ] Given I hover or focus a tag chip and the popover opens, when I move the cursor into the popover, then the popover stays open. It only closes on click-outside, Escape, or when focus moves to a non-popover element.
- [ ] Given the popover is open and showing asserter rows, when I click an asserter row, then I navigate to that user's profile page (`/user/<pubkey>`).
- [ ] Given an asserter has a kind-0 metadata event known to the server, when their row renders in the popover, then I see their `display_name` or `name` and `picture` (avatar). If no kind-0 is known, the row falls back to a shortened pubkey and a placeholder avatar.
- [ ] Given the asserter list grows beyond a comfortable popover height, when the popover renders, then the inner list scrolls within the popover without expanding it past a reasonable max-height.
- [ ] Given I view the home/search page, when I look at the search input placeholder, then "tag" is included in the suggested-searchable list (e.g. "Search by name, bio, tag, NIP-05, website…").

## Concepts touched
- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:nostr-user-tag`
- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:nostr-user`

## Out of scope
- Any new components or routes; this story modifies the existing chip popover and search input only.
- Caching strategy for kind-0 metadata (use whatever the app already does; if no caching exists, fetch on demand and accept the latency).
- Click-vs-navigate interaction model for the chip itself (that's Story 2's territory — chip's name area navigates; this story owns what happens *inside* the popover once it's open).
- Bulk-fetch optimisations for asserter profiles.

## Open questions
- Whether the popover anchors itself to allow click-inside (could be CSS focus-within trickery, JS-managed open state, or a `<dialog>` element). **Architect.**
- How to fetch kind-0 metadata for asserters at scale — single endpoint that batches lookups, or per-pubkey fetch with caching. **Architect.**

## Linked artifacts
- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
