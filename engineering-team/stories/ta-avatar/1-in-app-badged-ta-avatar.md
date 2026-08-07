# Story 1: In-app badged TA avatar

**Status:** Approved
**Created:** 2026-08-06
**Type:** Feature
**Epic:** `ta-avatar`
**Book:** `engineering-team/audits/ta-avatar/book.md`

## Background

The Tapestry Assistant authors much of what the control panel shows — concept-graph nodes, lists,
trusted lists, tapestries, dashboard activity — but its avatar is an empty grey disc: the TA has no
profile picture, and the placeholder carries no glyph at all. Only the author-filter dropdowns hint
at what it is, with a 🤖 text prefix. A viewer scanning any table cannot tell at a glance that a row
was authored by the instance's assistant, nor whose assistant it is.

Separately, avatars in these tables have no failure handling: an author whose picture URL is dead
shows the browser's broken-image glyph.

## User-facing description

As a Tapestry user browsing any surface that shows authors, I want the TA's avatar to be the
instance owner's avatar stamped with the brain-and-lightning brand mark on one corner, so that I
instantly recognize both that the author is the assistant and whose instance it serves.

## Acceptance criteria

- [ ] Given the TA authored a row on a surface that renders author avatars (concepts, concept
      elements, nodes, lists, tapestries, trusted lists, dashboard activity), when the page renders,
      then the TA's avatar shows the owner's profile picture with the brand-mark badge on one
      corner — visibly distinct from the owner's own unbadged avatar at the sizes those surfaces
      use.
- [ ] Given a viewer hovers (or reads via assistive technology) the TA's badged avatar, then it is
      identified as the Tapestry Assistant of the owner, using the owner's display name when one is
      known.
- [ ] Given the owner has no profile picture, or the owner's picture fails to load, when a TA row
      renders, then a branded placeholder still carries the badge — never an empty disc and never a
      broken-image glyph.
- [ ] Given any non-TA author whose picture URL is dead, when their avatar renders on these
      surfaces, then a lettered placeholder (from their display name) appears instead of the
      broken-image glyph.
- [ ] Given the TA's own user page in the control panel, when opened, then its header avatar is the
      same badged avatar.

## Concepts touched

None known — the TA is an infrastructure identity, not a concept-graph concept. The local stack was
not reachable at planning time; the Architect should confirm via the concept-graph summaries that no
concept models the assistant identity before assuming so.

## Out of scope

- Publishing anything to nostr (stories 2 and 3 in this epic).
- Surfaces where the TA does not appear today (notes feed, search results, user menu, profile-tag
  chips) — they can adopt the same treatment later.
- Changing the 🤖 text labeling in author-filter dropdowns (stays as-is; guardrail in the epic).
- Badging customer assistants / other delegated identities — unless it falls out with zero extra
  behavior, it is a later story.

## Open questions

None. (Scope — full composite, published — was ratified at kickoff; this story is layer 1 of 3.)

## Linked artifacts

- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
