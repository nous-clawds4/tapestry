# Story 10: Unified tag search — find tags across the whole universe

**Status:** Draft
**Created:** 2026-06-30
**Type:** Feature
**Epic:** event-tagging

## Background

Tag search / name-match is profiles-only today (`/api/profile-tags/match` scans `nostr-user-tag` only). Once the unified taggings normalization core lands (Story 9 / ADR 0009), searching for a tag by name should span the **whole** tag universe — profiles, notes, and future types — because it's the same shared tag-element under the hood. Builds on the normalized stream and `searchTags` aggregator from ADR 0009.

> Read/aggregation only; no protocol or write change (per ADR 0009's constraints).

## User-facing description

As someone searching for a tag by name (anywhere the app searches tags), I want the results to reflect tags used across all target types — not just tags used on profiles — so search matches how tags are actually used.

## Acceptance criteria

Testable from the outside (given published taggings + a query, what the search returns).

- [ ] **A note-used tag is findable.** Given a tag used on notes but not profiles, when I search its name, then it appears in the results (today it does not).
- [ ] **Usage reflects all target types.** A tag's match result reflects its usage across profiles and notes (not a profile-only count).
- [ ] **POV-filtered.** Search results/counts obey the active point-of-view trust filtering, consistent with the epic.
- [ ] **Local-only.** Search stays local-only (consistent with the epic's read model).
- [ ] **Backward compatible.** Existing profile-tag search behavior/results are preserved for profile-used tags.

## Concepts touched

- `39998:<TA>:tag` — the shared tag-element searched by name.
- `39998:<TA>:nostr-user-tag`, `39998:<TA>:nostr-event-tag` — the family members whose usage the search spans.

## Out of scope

- **The unified core itself** — Story 9 / ADR 0009 (consumed here).
- **Migrating the live `/api/profile-tags/match` internals** — the deferred Phase-2 cleanup; this story adds unified search, it does not rewrite the live endpoint unless trivially folded in.
- **Profile search / "tag someone"** — that searches profiles, not tags; unrelated.

## Open questions

1. **Surface(s).** Which UI search/autocomplete actually needs this (the in-app tag search is largely the client-side `AddTagDialog` filter over the shared catalogue today) — confirm the real consumer before building UI. *(PO / Architecture)*
2. **Fold into Story 9?** `searchTags` is a thin view over the same normalized stream as the index; it may be cheapest to ship alongside Story 9. *(Architecture)*

## Linked artifacts
- ADR: `engineering-team/decisions/event-tagging/0009-unified-taggings-normalization.md` (built on the unified core)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
