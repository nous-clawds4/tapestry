# Review: Story 1 — Profile-tag reads resolve by the stable a-coordinate (consume-by-#a)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-07-08
**Diff:** implementation `4c6d5a8b`; tests `e741762f` (base `845d8d9d`), branch `feat/tags`

## Quality gates (run by reviewer, not trusted)

- [x] `node test/profile-tag-consume-by-a-coordinate.test.js` — **13 passed, 0 failed** (B1–B5, S1–S6b).
- [x] `node -c src/api/profile-tags/index.js` — syntax OK.
- [x] Sibling suites: `tag-read-union` 18/18, `profile-tags` 13/13, `authored-tagging` 6/6 — all green.
- [x] Pre-existing failures confirmed NOT caused by this diff: `ui/src/hooks/useProfileTags.js` is 0 lines changed in `4c6d5a8b` (the `dual-z-writer` source-contract failure and the two live-API integration tests are outside this diff).
- [ ] _Playwright not run — the story's runtime checks are the manual M1/M2 checklist; no Playwright spec in this story._
- [x] _Lint / typecheck / build — not configured; skipped per house rules._

## Spec adherence
- [x] AC-1/AC-2/AC-3/AC-4 — covered by passing tests and correct server wiring (see table).
- [~] AC-5 — server + `ProfileTagsSection` grouping are correct, BUT the shared UI change broke an out-of-scope consumer (see Blocking #1).
- [x] No behavior added beyond the story.

## AC-by-AC evidence

| AC | Evidence | Verdict |
|---|---|---|
| **AC-1** replaced tag-element resolves by coordinate, surfaces name | `assertionTagCoordinate` prefers `["a"]`; `handleTagsForProfile` emits `tagAddress` (index.js:295-307); `ManageTagsDialog`/`ProfileTagsSection` resolve by `tagAddress`. Tests B1/B4, S5a. | MET |
| **AC-2** pubkey TL spans versions | `aggregateProfilesTagged` resolves `tagEventId`→coord via `federatedScan({ids})`+`parseTagPayload`, unions `#a`∪`#e`, `dedupeReplaceable`, falls back to `#e`-only when unresolvable (index.js:634-652). `refreshPinnedTags` unaffected (passes only `tagEventId`, consumes `byTarget`). Test S1. | MET |
| **AC-3** legacy `e`-only union not replace | `#e` leg retained at all three changed sites; `assertionTagCoordinate` falls back to `e`→`tagById`. Tests B2, S2/S3 retain `#e`. | MET |
| **AC-4** strict superset / no double-count | `dedupeReplaceable` keys on `pubkey|d-tag`; un-replaced tag's `#a`/`#e` sets collapse. Tests B3, B5. | MET |
| **AC-5** coordinate identity in read + UI | Server exposes `tagAddress` on both `tags-for-profile` and `available-tags`; `ProfileTagsSection` groups by coordinate (destructures `{key, tag}`, keys `appsByTagId`/`disputesByTagId` by grouping key). **But** the shared `AddTagDialog` prop rename broke `NoteTags.jsx` — see Blocking #1. | **NOT MET (regression)** |

## ADR adherence
- [x] Three aggregation sites unioned exactly as ADR §(a) verdict table: site 1 `computeTagMatches` (CHANGE, stays LOCAL `strfryScan` both legs — SEARCH-IS-LOCAL preserved), site 2 `aggregateProfilesTagged` (CHANGE), site 4 `handleAuthoredBy` (CHANGE + regroup `parentCounts`/`peerCounts` by coordinate). Site 3 `handleTagById` viewer-pin scan correctly left `#e`-only (test S4 sentinel green).
- [x] Union primitive matches ADR: two scans concatenated → `dedupeReplaceable`; candidate coords built from `ev.pubkey`+`slug`.
- [x] `findTagsByNameSubstring` now returns `authorPubkey` (index.js:412) as ADR §(a) site-1 requires.
- [x] `handleTagIndex` / `handleWotTags` NOT touched (grep clean) — correctly deferred per ADR Out-of-scope; not half-changed.
- [x] Response-shape additions match ADR §(c): `tagAddress` added to `handleTagsForProfile` entries and `handleAvailableTags`, `tagEventId` retained.
- [~] ADR §(c) enumerates "all consumers of the `tags-for-profile` response" but the changed component (`AddTagDialog`) is **also** consumed by the note stack via `NoteTags.jsx`, which the ADR's consumer list did not account for — the shared-component blast radius was missed.

## Architecture invariants (CLAUDE.md)
- [x] POV-first / filter-at-read-time: no denormalized global applied-set introduced; union scans then existing per-POV `authorAllowed` filter applied unchanged.
- [x] TA pubkey: the `a` coordinate uses the tag author's real `ev.pubkey` (`tagCoordinate({authorPubkey: ev.pubkey, slug})`) — not the TA. ADR-0015 `LEGACY_*` z-tag carve-out untouched (no `LEGACY_*` constants removed; `#z` filter still `NOSTR_USER_TAG_Z_TAG`).
- [x] JS-without-build: no new tooling.
- [x] Federation boundary intact: search legs both `strfryScan` (local); browse/TL/authored-by legs both `federatedScan` — no federation leaked into search, no local-only regression on the visibility surfaces.

## Things tests can't catch
- [x] No secrets, no `console.log`, no commented-out code, no TODOs added.
- [x] `aggregateProfilesTagged` fallback path (`tagEl` unresolvable) preserves strict-superset (`#e`-only).
- [x] `handleAuthoredBy` step-6 rows still expose `tagEventId` for provenance; only counts made version-spanning — external shape unchanged.
- [ ] **Shared-component regression not caught by any test — see Blocking #1.** No test (and no manual step) exercises `NoteTags`'s use of `AddTagDialog`.

## House rules
- [x] Concept Graph authority respected; no firmware change needed (read-path only, `tagAddress` already in ADR-0022 schema).
- [x] No new lint/typecheck/build tooling.

## Findings

### Blocking

1. **`ui/src/components/AddTagDialog.jsx:5,16` + `ui/src/components/NoteTags.jsx:140` — renamed prop breaks the note-tagging "Add tag" dialog (out-of-scope stack regression).**
   `AddTagDialog` is a **shared** component with two consumers (`grep` confirms only `ProfileTagsSection.jsx` and `NoteTags.jsx`). The diff renamed the prop `appliedTagEventIds` → `appliedTagKeys` and updated `ProfileTagsSection` (line 174), but `NoteTags.jsx:140` still passes `appliedTagEventIds={appliedTagEventIds}`. So when a note's Add-tag dialog opens, `appliedTagKeys` is `undefined` and:
   ```js
   // AddTagDialog.jsx:16
   const isApplied = (t) => appliedTagKeys.has(t.tagAddress || t.eventId);
   ```
   is invoked from the `filtered` useMemo on mount (`availableTags.filter((t) => !isApplied(t) && inScope(t))`, line 58) → **TypeError: Cannot read properties of undefined (reading 'has')** → the note Add-tag dialog crashes on every deployment.
   The story marks the note/event-tag stack **out of scope**, but this change touched a shared component and broke it. This is exactly the "response/prop-shape consumer the ADR missed" the audit was asked to catch.
   **Asked change:** update `NoteTags.jsx:140` to pass `appliedTagKeys={appliedTagEventIds}` (the note stack's applied set is a set of `eventId`s — line 56-59 — which `isApplied`'s `t.tagAddress || t.eventId` fallback still matches, since note `availableTags` there carry `eventId`). Confirm the note dialog opens and correctly hides already-applied tags. Add a guard/default (e.g. `appliedTagKeys = new Set()`) OR a source-contract/render test so a future shared-prop rename can't silently reintroduce this. Verify on the local stack (`cycle-local`) that both the profile and note Add-tag dialogs open without error before re-review.

### Non-blocking

1. **`ui/src/components/ProfileTagsSection.jsx:59` / `ManageTagsDialog.jsx:62`** — the unresolvable-tag fallback renders `key.slice(0,8)` where `key` may be a full `a`-coordinate (`39999:<author>:<slug>`), so the truncated label shows `39999:78…` rather than a bare id prefix. Behavior is unchanged in spirit (still a truncated placeholder for an unknown tag) and this is a rare fallback path; noting only for cosmetics, not blocking.
2. `AddTagDialog.jsx:16` `isApplied` reads a prop with no default — brittle for a shared component. A default `appliedTagKeys = new Set()` in the destructure would make the contract self-defending. Optional.

## Verdict
**CHANGES_REQUESTED**

The server-side consume-by-#a doctrine (union `#a`∪`#e`, coordinate regrouping, response-shape additions) is correct, ADR-conformant, and fully green on the target + sibling suites; AC-1 through AC-4 are met. The single blocker is a shared-UI-component prop rename that crashes the out-of-scope note-tagging Add-tag dialog (`NoteTags.jsx:140` was not updated alongside `AddTagDialog`). Fix that one caller (plus a guard/test), re-verify both dialogs on the local stack, and this is a PASS.
