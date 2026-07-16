# Review: Story 13 — Unified `/tags` directory (UI + endpoint controls)

**Reviewer:** Claude · **Date:** 2026-06-30 · **Impl:** `a1db7918` · **Book:** unified-tagging-ui
**Story/ADR:** `stories/event-tagging/13-…` / `decisions/event-tagging/0012-…`

## Gates
- [x] `unified-tags-directory` — **4/4**.
- [x] No regression: `tag-index` 7/0, `profile-tags` 13/0, `unified-tag-index` 14/0, `event-tagging-core` 15/0, `tag-detail` 8/0, `notes-by-author` 4/0.
- [x] UI build compiles.
- [x] Live end-to-end: `/api/tags/index` returns the merged universe — note-only tags (`drivechain`, `networking`) appear with note usage; profile pins preserved (`bird` 📌2); `sort`/`pinnedCount` honoured.

## Spec / ADR adherence
- [x] **`/tags` shows note usage** (AC-1): `useTagIndex` → `/api/tags/index` (source-contract + live).
- [x] **Legible note vs profile** (AC-2): `byType` breakdown + a note badge in `Tags.jsx`.
- [x] **No control regresses** (AC-3): handler honours `sort` (used/endorsed/divisive/most-pinned), `q`, `authoredBy`, `pinnedByMe`; `used/endorsed/divisive` now span notes+profiles.
- [x] **Pinned count preserved** (AC-4): reuses `aggregateTagPins` (joined on `tagEventId`) → `pinnedCount`/`viewerPinned`.
- [x] **POV/pagination unchanged** (AC-5), **profile-only tags unchanged** (AC-6).
- [x] **Phase 1**: `/api/profile-tags/index` byte-untouched; `/tags` just stops calling it. No wire/write change. No firmware change.

## Things tests can't catch
- [x] One small cross-module reuse (`require('../profile-tags').aggregateTagPins`, read-only, lazy inside the handler) — wrapped in try/catch so a pin-aggregate failure degrades to `pinnedCount:0`, never breaks the directory.
- [x] No secrets/debug; sort comparators are total; filters applied before pagination.

## Findings
### Blocking — none.
### Non-blocking
1. The `/tags` scan is unbounded (union of member concept-`z`s) + no response cache — same perf follow-up flagged for Story 9; fine for parity.
2. Author `displayName` isn't enriched on unified rows (Tags.jsx falls back to `shortNpub`) — cosmetic; add if desired in the UI pass.
3. Pin *count* is still profile-pins only until Story 12 (note-pins) — by design (displayed, not an affordance → no confusion).

## Verdict
**PASS** — `/tags` now reflects the whole tag universe with zero control regression, live-verified; the original "profiles-only" complaint is resolved. Additive; nothing existing touched.
