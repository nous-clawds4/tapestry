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

None. **Confirmed at Architecture** against the live concept graph (48 concepts; `/summaries` then
`/neighbors` on `39998:<TA>:nostr-user`): no concept models the assistant identity, and this story
defines no graph structure. No firmware reinstall.

## Out of scope

- Publishing anything to nostr (stories 2 and 3 in this epic).
- Surfaces where the TA does not appear today (notes feed, search results, user menu, profile-tag
  chips) — they can adopt the same treatment later.
- Changing the 🤖 text labeling in author-filter dropdowns (stays as-is; guardrail in the epic).
- Badging customer assistants / other delegated identities — unless it falls out with zero extra
  behavior, it is a later story.

## Open questions

None. (Scope — full composite, published — was ratified at kickoff; this story is layer 1 of 3.)

## Deviations

Judgment calls made at Implementation, too small for an ADR amendment.

1. **The mark inside the badge is scaled 0.86, not the ADR's "≈70–75%".** At 0.75 the badge read as a
   plain purple dot at the 18px the table rows render it (verified by screenshot before/after) — it
   distinguished the assistant but was not *recognizable*, which is the epic's whole point. The ADR's
   stated requirement for that number was "so the mark never touches or clips at the disc edge"; at
   0.86 the mark's widest point lands 161 from the centre, inside the 187.5 radius, so that
   requirement still holds with ~14% clearance. Badge size (45%, 14px floor) is unchanged.
2. **The TA name fallback was applied to the user page as well as to AuthorCell.** The ADR named only
   AuthorCell, but `UserDetail` computes its own display name, so the assistant's own page — the
   click-through destination AC5 names — still titled itself `aaaaaaaa…aaaa`. Same two-line fallback,
   same rationale the ADR gives for AuthorCell ("naming nothing to a reader").

## Linked artifacts

- ADR: `engineering-team/decisions/ta-avatar/0001-shared-avatar-with-ta-badge-overlay.md`
- Test plan: `engineering-team/stories/ta-avatar/1-in-app-badged-ta-avatar.test-plan.md`
  (tests: `test/in-app-badged-ta-avatar.test.js` + `tests/brainstorm/ta-badged-avatar.spec.js`)
- Review: (filled in after Review phase)
