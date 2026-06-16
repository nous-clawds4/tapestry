# Story 3: Tag-detail page (write — apply, dispute, search-and-apply)

**Status:** Done
**Created:** 2026-05-13
**Type:** Feature

## Background
Story 2 ships the tag page as a read-only view. This story turns it into a workspace: a logged-in user can apply or dispute the tag directly from any profile row, find arbitrary profiles via an on-page search and tag them, and see the result of their own publication immediately even before the broader POV catches up.

The POV-consistency wrinkle (the viewer's own assertion may not count under their active POV's WoT filter) is resolved in this story by always surfacing the viewer's own assertions in their personal view of the page, with a small badge indicating when those assertions are not yet visible to other POV viewers.

## User-facing description
As a NIP-07-authenticated user viewing a tag page, I want to apply or dispute the tag on any profile shown on the page, search for additional profiles to tag from the same page, and immediately see the profiles I've just touched — so the tag page becomes both a discovery and a maintenance surface.

## Acceptance criteria

- [ ] Given I am NIP-07-authenticated and viewing a profile row on a tag page, when I haven't yet applied this tag to that profile, then an **Apply** button is visible on the row. Clicking it publishes a positive assertion (per Story 1's `nostr-user-tag` wire shape) for this (tag, target) pair.
- [ ] Given I am NIP-07-authenticated and viewing a profile row, when I haven't yet disputed this tag on that profile, then a **Dispute** button is visible on the row. Clicking it publishes a negative assertion.
- [ ] Given I have already applied (or disputed) the tag on a profile, when I view that row, then the corresponding button shows an "applied"/"disputed" state and clicking it does **not** re-publish; the opposite-polarity button remains available so I can change my mind by publishing the opposite.
- [ ] Given I am NIP-07-authenticated and on a tag page, when I look at the page, then I see a profile-search input that lets me look up arbitrary profiles by name.
- [ ] Given I type a query in the page-search input and matching profiles are returned, when each result row renders, then it shows Apply / Dispute buttons (same state rules as the main list rows).
- [ ] Given I successfully apply this tag to a profile via the page-search, when the page settles, then that profile is now visible in the main list — even if my own assertion is the only one and I am not in the active POV's WoT.
- [ ] Given my own assertion is what's making a profile visible in the list — i.e. no other author in the active POV's WoT has applied or disputed this tag on that profile — when I view the row, then it carries a small badge or marker (e.g. "your assertion — not yet visible to this POV") so I know my action took effect even though the wider WoT view hasn't caught up.
- [ ] Given I am not NIP-07-authenticated, when I view the page, then no Apply / Dispute buttons or page-search input are rendered; the page behaves identically to Story 2's read-only view.
- [ ] Given publishing a new assertion fails (both local strfry and external relays), when I attempt to Apply or Dispute, then an error surface on the page shows the failure (consistent with Story 1's `publishOrThrow` behavior on the profile page).

## Concepts touched
- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:tag`
- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:nostr-user-tag`
- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:nostr-user`

## Out of scope
- Revoking an assertion from the tag page (still done from the profile-page Manage dialog).
- Editing or deleting the tag itself.
- Bulk apply / dispute across many profiles at once.
- Cross-POV authoring views.
- Anything in Stories 4 / 5 / 6.

## Open questions
- Where exactly does the page-search input live in the layout (above the main list, in a sidebar, modal)? **Architect.**
- Whether the profile-search reuses the existing typeahead component or a tag-page-local variant. **Architect.**
- Whether the "your assertion — not yet visible to this POV" marker is per-row or a one-time tooltip / banner. **Architect.**

## Linked artifacts
- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
