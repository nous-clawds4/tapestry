# Test Plan: pov-selectable-tag-surfaces Story 2 — honest state when the selected POV can't filter

**Story:** `engineering-team/stories/pov-selectable-tag-surfaces/2-honest-state-for-unprovisioned-pov.md`
**ADR:** `engineering-team/decisions/pov-selectable-tag-surfaces/0002-per-read-pov-resolution-status.md` (Accepted, with gate amendment)
**Date:** 2026-07-09
**Test file:** `test/pov-resolution-status.test.js`

## Test strategy

The server pieces (`src/api/_shared/pov.js`, new `src/api/_shared/povStatus.js`) are **CJS and
dependency-injectable by design** (the ADR's testability seams), so the crux is covered by real
behavioral units — no live Meili, no strfry. The UI pieces are ESM/JSX → source-contract, as in the
sibling suites. Live/browser behavior (banners on a real dev box) goes to the manual checklist.

- **BEHAVIORAL-UNIT** — `computePovStatus` (the pure state machine: the ADR's exact mode-precedence
  and `fellBackToHouse` orthogonality), `scoresExistFor`, `getWotFieldDistribution` (injected
  `fetchImpl`: success / non-OK / throw / TTL cache), `resolvePovWithStatus` (probe **skipped** when
  not filtering — the AC-5 zero-cost-on-dev guarantee), and `resolvePov` provenance (injected prefs:
  each cascade branch yields the right `requestedPov`/`delegateSource` **and** the five pre-existing
  return fields are unchanged — the no-regression check).
- **SOURCE-CONTRACT** — the nine endpoints attach `povResolution`; the `forTagCache` key gains the
  POV params; the TL publishers deliberately **stay** on bare `resolvePov` (boundary sentinel); the
  shared `PovStatusNotice` exists with the null-render rule; the six surfaces' hooks expose and wire
  the status; the **gate amendment**: `useNotesForTag` + `usePinnedNotes` thread `usePov().povParams`;
  `BrainstormSearch` does NOT adopt the notice (search's own UX untouched — boundary sentinel).
- **MANUAL** — the banner semantics on a live instance (dev box = mode `unfiltered`; own-selected
  with no computed WoT = fell-back disclosure), via `cycle-local`.

## Coverage map

| Criterion | Test(s) | Level |
|---|---|---|
| **AC-1** own-not-computed disclosed, not silently house-substituted | `B5` (provenance: user→house-prefs ⇒ `fellBackToHouse`), `B1c`; UI `S5` (message row exists) | behavioral + source |
| **AC-2** unfiltered disclosed, surface still works | `B1b`, `B4` (probe skipped ⇒ zero Meili dependency); `S5`/`S7` (banner over results) | behavioral + source + manual `M1` |
| **AC-3** not-computed ≠ genuinely-empty | `B1d` (mode `not-computed` when `scoresExist===false`), `B2` (`scoresExistFor`) | behavioral + manual `M2` |
| **AC-4** the read itself reports (machine-readable) | `S2` (all nine endpoints attach `povResolution`), `S3` (cache can't serve another POV's signal) | source |
| **AC-5** provisioned untouched / dev keeps functioning | `B1a` (filtered ⇒ notice-null case), `B1e` (`scoresExist:null` ⇒ never false `not-computed`), `B4`, `B6` (resolvePov original fields unchanged), `S4` (TL publishers untouched), `S8` (search untouched) | behavioral + source |
| **AC-6** consistency across surfaces, one wording source | `S5` (single shared `PovStatusNotice`), `S6` (hooks expose), `S7` (all six placements) | source |
| *(amendment)* tag-page Notes threading (Story-1 completeness) | `S9` (`useNotesForTag` + `usePinnedNotes` consume `usePov().povParams`) | source |

## Behavioral-unit tests (require the CJS modules; inject all I/O)

- **B1 — `computePovStatus` state table (the crux).**
  - a: `(house, house-prefs, suffix, minRank, scoresExist:true)` → `{mode:'filtered', fellBackToHouse:false}`.
  - b: no suffix (or non-finite minRank) → `mode:'unfiltered'`; **minRank 0 is finite** → still filtering.
  - c: `(user, house-prefs, suffix, minRank, true)` → `{mode:'filtered', fellBackToHouse:true}`; `(user, user-prefs, …)` → `fellBackToHouse:false`.
  - d: `scoresExist:false` → `mode:'not-computed'`; **precedence:** unfiltered beats not-computed.
  - e: `scoresExist:null` → `mode:'filtered'` (never claim a degradation we can't prove).
- **B2 — `scoresExistFor`:** count>0 → `true`; 0 → `false`; field absent → `false`; null distribution → `null`.
- **B3 — `getWotFieldDistribution` probe:** fake `fetchImpl` — OK → distribution; non-OK → `null`;
  throw → `null`; **TTL cache** — second call within TTL does not re-invoke `fetchImpl`
  (via `__resetPovStatusCacheForTests`).
- **B4 — `resolvePovWithStatus` skips the probe when not filtering:** with a spy `fetchImpl` and
  prefs that resolve no delegate, the spy is **never called** and `scoresExist` is `null` —
  the AC-5 "dev boxes add zero requests" guarantee.
- **B5 — `resolvePov` provenance (injected prefs impls):** user-with-`rankAuthor` →
  `{requestedPov:'user', delegateSource:'user-prefs'}`; user-without → `delegateSource:'house-prefs'`
  (the silent-substitution branch, now visible); house request → `requestedPov:'house'`; no delegate
  anywhere → `delegateSource:'none'`.
- **B6 — `resolvePov` no-regression:** the five pre-existing return fields
  (`delegatedPubkey, povSuffix, filters, sort, minRank`) are present and computed as before under
  the injected prefs (byte-equal values for a fixed fixture).

## Source-contract tests

- **S1 — the modules exist + export the seams** (`povStatus.js`: `computePovStatus`,
  `getWotFieldDistribution`, `scoresExistFor`, `resolvePovWithStatus`, `__resetPovStatusCacheForTests`).
- **S2 — the nine endpoints attach the signal:** `handleTagsForProfile`, `handleWotTags`,
  `handleProfilesTagged`, profile-side `handleTagIndex`, `handleAuthoredBy` (profile-tags);
  `buildTrustPredicate`+`handleForEvent`, `handleForTag`, event-tags `handleTagIndex` (event-tags);
  the meili proxy — each references `povResolution` (and the read paths use `resolvePovWithStatus`).
- **S3 — `forTagCache` key is POV-aware:** the `cacheKey` expression includes the normalized POV
  params (`wotPov`/`userPubkey`) so a cached `povResolution` can never describe another POV's read.
- **S4 — boundary sentinel (passes before AND after):** `refreshPinnedTags.js` does **not** adopt
  `resolvePovWithStatus` — TL publishers keep bare `resolvePov` (their honesty channel is the
  existing partial-signal doctrine).
- **S5 — `PovStatusNotice.jsx`** exists, renders `null` for `(filtered && !fellBackToHouse)` and for
  null status, and contains the message matrix's semantic anchors (unfiltered / house-fallback /
  not-computed wordings).
- **S6 — the hooks expose the status:** `useEventTags`, `useTagIndex`, `useTagDetail`,
  `useProfileTags`, `useAuthoredTagging` (+ `TagPageSearch`) reference `povResolution`.
- **S7 — placements:** `Tags.jsx`, `Tag.jsx`, `AuthoredTaggingSection.jsx`, `ProfileTagsSection.jsx`,
  `NoteTags.jsx`, `TagPageSearch.jsx` all render `PovStatusNotice`.
- **S8 — boundary sentinel (passes before AND after):** `BrainstormSearch.jsx` does **not** import
  `PovStatusNotice` (search's own readiness UX untouched).
- **S9 — gate amendment:** `useNotesForTag.js` and `usePinnedNotes.js` consume `usePov()` and thread
  `povParams` (the Story-1 pattern, extended to the two missed hooks).

## Manual browser checklist (`cycle-local`, `localhost:7778`)

- **M1 — dev box discloses unfiltered.** The local instance (no delegate configured) shows the
  "not trust-filtered" banner on the tags directory / tag page / profile tags — and everything still
  works beneath it (AC-2/AC-5).
- **M2 — not-computed ≠ empty.** Point the house prefs at a delegate with no `wot_rank_*` columns
  (or select own-POV with prefs `rankAuthor` set to an uncomputed key) → surfaces show the
  "no computed trust scores" state, distinguishable from an untagged page (AC-3).
- **M3 — own-POV fallback.** Logged in with no computed WoT, select "my own" → the tag surfaces say
  house is being shown (AC-1).

## Test infrastructure
- Node built-in runner. Behavioral tests `require()` the CJS `_shared` modules with injected
  `fetchImpl`/prefs impls — **no Meili, no strfry, no live API**. Source-contract reads files as text.
- Firmware state: none (no concept/schema change).

## How to run
```
node test/pov-resolution-status.test.js
```
(or the full suite via `npm test`).

## Verification
Confirmed 2026-07-09: **2 passed, 19 failed** — every failure for the right reason, and the two
passes are the intentional boundary sentinels.

```
--- pov-resolution-status tests (Story 2) ---
  FAIL  B1a..B4, S1   Cannot find module src/api/_shared/povStatus.js   (the module doesn't exist yet)
  FAIL  B5            requestedPov undefined                            (resolvePov lacks provenance fields)
  FAIL  B6            delegatedPubkey null                              (resolvePov ignores the injected deps — the seam doesn't exist)
  FAIL  S2a/S2b/S2c   handlers don't attach povResolution / no resolvePovWithStatus
  FAIL  S3            for-tag cacheKey omits the POV params (the pre-existing latent bug)
  PASS  S4            TL publishers stay on bare resolvePov            (boundary sentinel — passes before AND after)
  FAIL  S5            PovStatusNotice.jsx doesn't exist
  FAIL  S6/S7         hooks don't expose povResolution / surfaces don't render the notice
  PASS  S8            BrainstormSearch doesn't adopt the notice        (boundary sentinel)
  FAIL  S9            useNotesForTag/usePinnedNotes don't thread povParams (the gate amendment)

pov-resolution-status: 2 passed, 19 failed
```
