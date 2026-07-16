# Story 11: Profile "Tagging Activity" spans notes

**Status:** Approved — server/core DONE + REVIEWED PASS (impl eae1285f); UI held for the unified-UI pass
**Created:** 2026-06-30
**Type:** Feature
**Epic:** event-tagging

## Background

A profile's "Tagging Activity" section (`AuthoredTaggingSection`, fed by `/api/profile-tags/authored-by`) shows what that person has tagged — but **only on profiles**. All the notes they've tagged are hidden, so it's a half-picture of that person's tagging. With the unified taggings normalization core (Story 9 / ADR 0009), the same person's activity can be shown across target types: an author-filtered view over the normalized tagging stream.

> Read/aggregation only; no protocol or write change (per ADR 0009).

## User-facing description

As a viewer on someone's profile, I want their "Tagging Activity" to include the **notes** they've tagged, not just the profiles — so I see the full picture of how this person tags.

## Acceptance criteria

Testable from the outside (given a person's published taggings, what their activity view shows).

- [ ] **Their note-taggings appear.** Given a person who has tagged one or more notes, when I view their Tagging Activity, then those note-taggings are shown (today they are hidden).
- [ ] **Profile-taggings still appear.** Their profile-taggings remain shown (backward compatible).
- [ ] **Distinguishable.** A viewer can tell a note-tagging from a profile-tagging (target type is legible), whether interleaved or sectioned — presentation is a design detail.
- [ ] **POV-filtered.** Consistent with the epic's point-of-view trust model.
- [ ] **Own view.** When viewing my own profile, my own note-taggings appear regardless of POV (the `mine` principle), consistent with Stories 7–9.

## Concepts touched

- `39998:<TA>:nostr-user-tag`, `39998:<TA>:nostr-event-tag` — the family members; the view is filtered by asserter across both.
- `39998:<TA>:nostr-event` — the note targets shown.

## Out of scope

- **The unified core** — Story 9 / ADR 0009 (consumed here).
- **Migrating the live `/api/profile-tags/authored-by` internals** — deferred Phase-2 cleanup.
- **Pins / Trusted Lists** — profile-only feature, unrelated.

## Open questions

1. **Presentation.** Interleave note + profile taggings in one activity list, or two sub-sections? Mirror the existing section's layout unless there's reason to diverge. *(Design)*
2. **Rendering note-taggings.** A note-tagging row could show the tag + the target note (link / mini-preview) — reuse the shared note unit where sensible. *(Design / Architecture)*

## Linked artifacts
- ADR: `engineering-team/decisions/event-tagging/0009-unified-taggings-normalization.md` (built on the unified core)
- Test plan: covered by `test/event-tagging-notes-by-author.test.js` (core + source-contract + HTTP; UI held)
- Review: `engineering-team/reviews/event-tagging/11-profile-tagging-activity-spans-notes.md` — **PASS (server/core)** (2026-06-30)
