# Review: Story 1 — Profile-tag reads resolve by the stable a-coordinate (consume-by-#a)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-07-08
**Diff:** implementation `4c6d5a8b`; tests `e741762f`; blocker fix `7a882109` (base `845d8d9d`), branch `feat/tags`

> **Re-audit note (2026-07-08):** initial verdict was CHANGES_REQUESTED for one blocker (shared
> `AddTagDialog` prop rename crashing the note-tagging dialog). Fixed in `7a882109` and re-audited
> below. **Final verdict: PASS.**

## Quality gates (run by reviewer, not trusted)

- [x] `node test/profile-tag-consume-by-a-coordinate.test.js` — **15 passed, 0 failed** (B1–B5, S1–S6b, plus new S7/S7b regression sentinels).
- [x] `node -c src/api/profile-tags/index.js` — syntax OK.
- [x] Sibling suites: `tag-read-union` 18/18, `profile-tags` 13/13, `authored-tagging` 6/6 — all green.
- [x] Pre-existing failures confirmed NOT caused by this diff: `ui/src/hooks/useProfileTags.js` is 0 lines changed (the `dual-z-writer` source-contract failure and the two live-API integration tests are outside this diff).
- [ ] _Playwright not run — the story's runtime checks are the manual M1/M2 checklist; no Playwright spec in this story. Live browser open-both-dialogs check deferred (no extension in env); the crash is now structurally impossible (empty-Set default) and locked by S7/S7b — see Blocking #1 (resolved)._
- [x] _Lint / typecheck / build — not configured; skipped per house rules._

## Spec adherence
- [x] AC-1/AC-2/AC-3/AC-4/AC-5 — covered by passing tests and correct wiring (see table).
- [x] No behavior added beyond the story.

## AC-by-AC evidence

| AC | Evidence | Verdict |
|---|---|---|
| **AC-1** replaced tag-element resolves by coordinate, surfaces name | `assertionTagCoordinate` prefers `["a"]`; `handleTagsForProfile` emits `tagAddress` (index.js:295-307); `ManageTagsDialog`/`ProfileTagsSection` resolve by `tagAddress`. Tests B1/B4, S5a. | MET |
| **AC-2** pubkey TL spans versions | `aggregateProfilesTagged` resolves `tagEventId`→coord via `federatedScan({ids})`+`parseTagPayload`, unions `#a`∪`#e`, `dedupeReplaceable`, falls back to `#e`-only when unresolvable (index.js:634-652). `refreshPinnedTags` unaffected (passes only `tagEventId`, consumes `byTarget`). Test S1. | MET |
| **AC-3** legacy `e`-only union not replace | `#e` leg retained at all three changed sites; `assertionTagCoordinate` falls back to `e`→`tagById`. Tests B2, S2/S3 retain `#e`. | MET |
| **AC-4** strict superset / no double-count | `dedupeReplaceable` keys on `pubkey|d-tag`; un-replaced tag's `#a`/`#e` sets collapse. Tests B3, B5. | MET |
| **AC-5** coordinate identity in read + UI | Server exposes `tagAddress` on both `tags-for-profile` and `available-tags`; `ProfileTagsSection` groups by coordinate (destructures `{key, tag}`, keys `appsByTagId`/`disputesByTagId` by grouping key); shared `AddTagDialog` now consistent across both consumers (see Blocking #1, resolved). Tests S5a/S5b/S6a/S6b, S7. | MET |

## ADR adherence
- [x] Three aggregation sites unioned exactly as ADR §(a) verdict table: site 1 `computeTagMatches` (CHANGE, stays LOCAL `strfryScan` both legs — SEARCH-IS-LOCAL preserved), site 2 `aggregateProfilesTagged` (CHANGE), site 4 `handleAuthoredBy` (CHANGE + regroup `parentCounts`/`peerCounts` by coordinate). Site 3 `handleTagById` viewer-pin scan correctly left `#e`-only (test S4 sentinel green).
- [x] Union primitive matches ADR: two scans concatenated → `dedupeReplaceable`; candidate coords built from `ev.pubkey`+`slug`.
- [x] `findTagsByNameSubstring` now returns `authorPubkey` (index.js:412) as ADR §(a) site-1 requires.
- [x] `handleTagIndex` / `handleWotTags` NOT touched — correctly deferred per ADR Out-of-scope; not half-changed.
- [x] Response-shape additions match ADR §(c): `tagAddress` added to `handleTagsForProfile` entries and `handleAvailableTags`, `tagEventId` retained.
- [x] The shared-component blast radius the ADR consumer list missed (`AddTagDialog` via `NoteTags`) is now closed and pinned by a regression sentinel (S7).

## Architecture invariants (CLAUDE.md)
- [x] POV-first / filter-at-read-time: no denormalized global applied-set introduced; union scans then existing per-POV `authorAllowed` filter applied unchanged.
- [x] TA pubkey: the `a` coordinate uses the tag author's real `ev.pubkey` — not the TA. ADR-0015 `LEGACY_*` z-tag carve-out untouched (no `LEGACY_*` constants removed; `#z` filter still `NOSTR_USER_TAG_Z_TAG`).
- [x] JS-without-build: no new tooling.
- [x] Federation boundary intact: search legs both `strfryScan` (local); browse/TL/authored-by legs both `federatedScan` — no federation leaked into search.

## Things tests can't catch
- [x] No secrets, no `console.log`, no commented-out code, no TODOs added.
- [x] `aggregateProfilesTagged` fallback path (`tagEl` unresolvable) preserves strict-superset (`#e`-only).
- [x] `handleAuthoredBy` step-6 rows still expose `tagEventId` for provenance; only counts made version-spanning — external shape unchanged.
- [x] Shared-component regression now covered by S7 (both consumers pass `appliedTagKeys`, neither passes the removed prop) and S7b (dialog never `.has`-es the raw prop).

## House rules
- [x] Concept Graph authority respected; no firmware change needed (read-path only, `tagAddress` already in ADR-0022 schema).
- [x] No new lint/typecheck/build tooling.

## Findings

### Blocking — RESOLVED in `7a882109`

1. **~~`AddTagDialog` shared prop rename crashed the note-tagging dialog~~ — FIXED.**
   `NoteTags.jsx:141` now passes `appliedTagKeys={appliedTagKeys}` (memo renamed and re-derived with the dialog's own key formula `new Set(displayedTags.map((t) => t.tagAddress || t.eventId))` — note tags carry no `tagAddress`, so it degrades to `eventId`, matching prior behavior symmetrically on both the applied-set and the `availableTags` membership side). `AddTagDialog.jsx:16-17` adds a defensive default (`const applied = appliedTagKeys || new Set()`), so an omitting caller can never `TypeError` on mount. Verified: no `appliedTagEventIds` remains anywhere in `ui/src/`; only the two known consumers exist; suite 15/15. The two new sentinels are meaningful — S7 catches a future one-sided rename, S7b enforces the guard.

### Non-blocking (unchanged, optional)

1. **`ui/src/components/ProfileTagsSection.jsx:59` / `ManageTagsDialog.jsx:62`** — unresolvable-tag fallback renders `key.slice(0,8)` where `key` may be a full `a`-coordinate, so the placeholder shows `39999:78…`. Rare fallback path; cosmetic only.
2. **Live browser check deferred** — the coordinator rebuilt the bundle (compiles clean) but could not open both dialogs in a live Chrome (no extension in env). The crash is now structurally impossible and locked by S7/S7b; recommend a quick manual open-both-dialogs pass at next `cycle-local` as belt-and-suspenders, but not blocking given the empty-Set default and the sentinel coverage.

## Verdict
**PASS**

The consume-by-#a doctrine is correctly and uniformly applied across the three aggregation sites, the response-shape additions, and the UI grouping; AC-1 through AC-5 are met; the target and sibling suites are fully green (15/15 + 18/18 + 13/13 + 6/6). The sole blocker — a shared `AddTagDialog` prop rename that broke the out-of-scope note-tagging dialog — is fully resolved in `7a882109` (caller fixed + defensive default + two regression sentinels). Mergeable as-is.
