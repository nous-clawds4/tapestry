# ADR 0012: Unified `/tags` directory — endpoint controls + UI wiring

**Status:** Accepted
**Date:** 2026-06-30
**Story:** `engineering-team/stories/event-tagging/13-unified-tags-directory-ui.md`
**Builds on:** ADR 0009 (`/api/tags/index`).

## Context

`/tags` (`Tags.jsx` → `useTagIndex` → `/api/profile-tags/index`) is profiles-only. Story 9's `/api/tags/index` already merges notes + profiles + `mine` (POV-filtered), but lacks the controls `Tags.jsx` needs: a **pinned count** + **viewerPinned**, the **sort modes** (`used`/`endorsed`/`divisive`/`most-pinned`), and the **authoredBy / pinnedByMe** filters. To switch `/tags` onto the unified endpoint with **zero control regression**, the endpoint gains those.

Facts:
- The profile index computes pins via `aggregateTagPins({ povSuffix, minRank, viewerPubkey }) → { pinCountByTagEventId, viewerPinnedSet }` (`src/api/profile-tags/index.js`), keyed by **tagEventId**. The unified rows already carry `tagEventId` (from the tag-element enrichment) → a clean join.
- Pins are a profile-curation concept; this story only **displays** the (profile) pin count — it adds **no** note-pin affordance (Story 12). So no "pinning only works for profiles" confusion arises here.

## Decision

Extend `handleTagIndex` (`/api/tags/index`) and wire `Tags.jsx` onto it; leave `/api/profile-tags/index` in place (Phase 1 — `/tags` simply stops calling it).

**Server (`handleTagIndex`):**
- Accept `sort` (`used`|`endorsed`|`divisive`|`most-pinned`, default `used`), `authoredBy`, `pinnedByMe`, plus existing `q`/`viewerPubkey`/`limit`/`offset`/POV.
- Reuse `aggregateTagPins` (exported from profile-tags — a read-only helper) to attach `pinnedCount` + `viewerPinned` to each unified row by its `tagEventId`.
- Add `name`/`tagEventId` (already), and sort the rows: `used` = applications+disputes (combined, spans types); `endorsed` = applications; `divisive` = combined min(app,disp)-style; `most-pinned` = pinnedCount. Apply `authoredBy` (row.tag.authorPubkey===X) and `pinnedByMe` (row.viewerPinned) filters, then paginate.
- Response row: `{ tag:{authorPubkey,slug}, tagEventId, name, description, applications, disputes, byType, mine, pinnedCount, viewerPinned }`.

**UI (`useTagIndex` + `Tags.jsx`):**
- Point `useTagIndex` at `/api/tags/index` (same params it already sends: sort/q/limit/offset/wotPov/userPubkey/viewerPubkey/authoredBy/pinnedByMe).
- `Tags.jsx` renders the unified rows: keep the existing name/counts/pinned columns (fields preserved) and add a small **note-usage** indicator from `byType.event` (Open Q1 presentation). No other page change.

## Consequences

- `/tags` reflects the whole tag universe with **no control regression** (sorts/filters/pins preserved).
- One small cross-module reuse: `aggregateTagPins` exported from profile-tags (read-only). Live `/api/profile-tags/index` untouched; `/tags` stops calling it.
- The pin *count* is still profile-pins only until Story 12 (note-pins) — displayed, not confusing.
- Firmware reinstall? No.

## Out of scope

- Note-pin affordance / generalized pinning (Story 12).
- Migrating `/api/profile-tags/index` away (deferred cleanup).
- `divisive` exact formula tuning beyond parity with the profile sort.
