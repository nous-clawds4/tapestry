# Story 13: Unified `/tags` directory (UI + endpoint controls)

**Status:** Approved — DONE + REVIEWED PASS (impl a1db7918)
**Created:** 2026-06-30
**Type:** Feature
**Epic:** event-tagging · **Book:** unified-tagging-ui

## Background

Story 9 built the unified tag index (`/api/tags/index`) — tags counted across notes **and** profiles, POV-filtered, on the shared coordinate. But the `/tags` page (`Tags.jsx`) still calls the profiles-only `/api/profile-tags/index`, so a viewer still sees "profile tags only" (the original complaint). This story finally wires `/tags` to the unified endpoint.

The one catch: `/tags` today has controls the unified endpoint doesn't yet carry — a **pinned count**, sort modes (`used` / `endorsed` / `divisive` / `most-pinned`), and **"only mine" / "only pinned"** filters. To switch without regressing them, the unified endpoint gains those controls (spanning notes + profiles where it makes sense). Pins are *displayed* (a count) — this story does **not** add a note-pin affordance (that's Story 12), so there's no "pinning only works for profiles" confusion here.

> Read/display only; no wire/write change. Local-only per the epic.

## User-facing description

As someone browsing `/tags`, I want the directory to reflect the whole tag universe — tags used on **notes** as well as profiles, with usage that combines both — while keeping the sorts, filters, and pinned counts I already have, so `/tags` stops silently meaning "profile tags."

## Acceptance criteria

- [ ] **`/tags` shows note usage.** A tag used on notes (even only on notes) appears in the `/tags` list, and a tag used on both shows combined usage — served by `/api/tags/index`, not `/api/profile-tags/index`.
- [ ] **Note vs profile usage is legible.** A row conveys that a tag is used on notes (a breakdown or combined-with-detail), not silently folded away.
- [ ] **No control regresses.** The existing `/tags` controls still work against the unified data: the **sort modes** (used / endorsed / divisive / most-pinned), the **text filter**, **"only tags I authored"**, and **"only tags I've pinned"** — with `used`/`endorsed`/`divisive` now spanning notes + profiles.
- [ ] **Pinned count preserved.** Each row still shows its pinned count (profile-pins; unchanged data) and the viewer's own-pin marker.
- [ ] **POV + pagination unchanged.** POV filtering and load-more paging behave as before.
- [ ] **Backward compatible.** A profile-only tag looks the same as today.

## Concepts touched

- `39998:<TA>:tag`, `nostr-user-tag`, `nostr-event-tag`, `tagging-with-specific-tag`, `tag-pinning` — the unified index + the pin count.

## Out of scope

- **The note-pin affordance / generalized pinning** — Story 12 (this story only *displays* the existing pin count).
- **Migrating `/api/profile-tags/index` away** — deferred Phase-2 cleanup; `/tags` simply stops calling it.
- **Tag-detail page / profile activity** — Story 8 (done) / Story 14.

## Open questions

1. **Row presentation.** Combined "used" with a profile/note breakdown vs. separate figures — mirror the current row unless there's reason to diverge. *(Design)*
2. **Sort semantics for `divisive`/`most-pinned`** over the unified set — confirm `divisive` uses combined conflict and `most-pinned` uses the (profile) pin count. *(Architecture)*

## Linked artifacts
- ADR: `engineering-team/decisions/event-tagging/0012-unified-tags-directory-ui.md`
- Test plan: `test/unified-tags-directory.test.js` (source-contract + HTTP; UI manual). Review: `engineering-team/reviews/event-tagging/13-unified-tags-directory-ui.md` — **PASS** (2026-06-30)
- Built on: ADR 0009 (`/api/tags/index`), book `engineering-team/audits/unified-tagging-ui/book.md`.
