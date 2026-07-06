# Story 3: Same-slug cross-type duplicate warning (fast-follow)

**Status:** Draft
**Created:** 2026-07-06
**Type:** Feature

## Background
Story 2 makes the picker type-aware with a full-search escape. This fast-follow adds the
**primary anti-duplicate-minting affordance** (§3c of the ask): when a user is about to create a
new tag whose slug already exists in the **other** type's usage set, surface it and let them
adopt the existing tag instead of forking the identity.

Deferred from Story 2 to keep the visible picker shippable; it is the key anti-fork guard and
should land immediately after.

Affected: anyone creating a new tag in either tagging context.

## User-facing description
As someone about to mint a new tag, I want to be told when a same-named tag already exists in
the other context ("'podcaster' exists and is used on profiles — use it here too?"), so I reuse
the shared tag instead of creating a duplicate identity.

## Acceptance criteria
Testable from the outside.

- [ ] **Warn on same-slug cross-type create.** Given a user is about to **create** a new tag
  whose slug matches a tag already present in the **other** type's usage set, when they reach the
  create step, then the dialog surfaces that existing tag and offers to use it here instead.

- [ ] **Adopt-instead affordance.** Given the warning is shown, when the user accepts it, then
  the existing tag is applied (no new tag-element is minted); when they decline, then minting the
  new tag proceeds — the warning **never blocks** creation.

- [ ] **Create-only.** Given the user is selecting an already-listed tag (not creating), then no
  warning shows — the affordance fires only on the new-tag path.

- [ ] **No regression.** The type-aware picker and full-search behavior from Story 2 are
  unchanged.

## Concepts touched
- `39998:<TA>:tag` — the shared vocabulary the same-slug lookup queries.
- `39998:<TA>:nostr-user-tag`, `39998:<TA>:nostr-event-tag` — the two usage sets compared.

## Out of scope
- Merging/deduplicating existing duplicate tags (retroactive) — not in scope.
- Warning on same-slug **within** the same type (that's an existing tag the picker already shows).
- Any push/deploy without operator approval.

## Open questions
- Source of the cross-type same-slug lookup (the other type's TL vs live `/api/tags/index`) —
  Architecture; reuse Story 2's data path.

## Linked artifacts
- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
