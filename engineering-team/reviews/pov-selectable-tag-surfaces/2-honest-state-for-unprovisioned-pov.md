# Review: Story 2 — Tag surfaces are honest when the selected POV can't actually filter

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-07-09
**Diff:** two commits on `feat/tags` —
`6af5b71a` (feat: tag surfaces disclose degraded POV state via per-read povResolution) +
`daccde3b` (feat: split the unfiltered POV disclosure — no-delegate vs no-threshold; Amendment 2).
Story-3's `resolvePov` minRank fix (`f6b00cec`, `3cc66ef4`) is in the same file but already
reviewed (Story 3 PASS) — not re-flagged here.

## Quality gates (run by reviewer, not trusted)

- [x] **Target suites — `node test/pov-resolution-status.test.js` → 21 passed, 0 failed.** (Story-2 core: B1–B6 behavioral + S1–S9 source-contract.)
- [x] **Amendment-2 — `node test/pov-notice-text.test.js` → 8 passed, 0 failed.** (N1–N7 wording matrix incl. the no-delegate/no-threshold split + both null-render cases; S1 delegation contract.)
- [x] **Cross-suite no-regression:** Story 1 `pov-selectable-tag-surfaces` → 17/17; Story 3 `pov-rank-threshold-key` → 7/7.
- [x] **Response-shape-adjacent suites:** `event-tagging-read-api` 11/0, `event-tagging-for-tag` 15/0, `tag-index` 7/0, `authored-tagging` 6/0, `unified-tags-directory` 4/0 — all green.
- [x] **`npm --prefix ui run build` → clean** (`✓ built in 15.63s`; only the pre-existing chunk-size advisory).
- [x] **`node -c`** on all five changed server files (`pov.js`, `povStatus.js`, event-tags, profile-tags, meili) → OK.
- [x] **Full `node test/test.js`:** one failure only — `POST /api/trusted-list/refresh-pinned-tag rejects an unauthenticated call` → **`fetch failed`** (local API/stack not up). This is the KNOWN live-API integration category, in the TL-publication suite, wholly unrelated to POV disclosure; **not newly caused by this diff** (this story touches no TL auth path). The run truncated on the live-API suites without the docker stack; the targeted runs above are authoritative for the no-regression claim.
- [x] _Lint / typecheck / build tooling — not configured; none added._

## Spec adherence — AC-by-AC evidence

| AC | Requirement | Evidence | Status |
|---|---|---|---|
| **AC-1** | Own-POV-not-computed disclosed, not silently house-substituted | `resolvePov` now returns `requestedPov`/`delegateSource` (`pov.js:52,60,64,80`); `computePovStatus` sets `fellBackToHouse = requestedPov==='user' && delegateSource!=='user-prefs'` (`povStatus.js:50`); `povNoticeText` `filtered+fellBackToHouse` → "showing the house point of view instead" (`povNoticeText.js:41-44`). Tests B5, N3. | ✅ |
| **AC-2** | Unfiltered disclosed, surface still works (disclosure not blockage) | `mode='unfiltered'` on the exact `wotFiltering` guard (`povStatus.js:42`); notice renders **over** results at every placement, never replaces them. Probe skipped when unfiltered → dev boxes keep functioning at zero Meili cost (`povStatus.js:98-100`). Tests B1b, B4, N4/N5. | ✅ |
| **AC-3** | Not-computed distinguishable from genuinely-empty | `scoresExist===false` → `mode='not-computed'` (`povStatus.js:44`); `NoteTags` discloses silent-emptiness per card even with zero tags (`NoteTags.jsx:106`, `tags.length>0 \|\| mode==='not-computed'`); wording "An empty page here does not mean nothing is tagged" (`povNoticeText.js:40`). Tests B1d, B2, N6. | ✅ |
| **AC-4** | The read itself reports its honesty (machine-readable) | All nine POV-aware handlers attach `povResolution` on **every** return path — event-tags `handleForEvent`/`handleForTag`/`handleTagIndex` (via `buildTrustPredicate`), profile-tags `handleTagsForProfile`/`handleWotTags`/`handleProfilesTagged`/`handleTagIndex`/`handleAuthoredBy` (incl. all early-empty returns), meili `handleMeiliSearchProfiles`. Additive — no existing field changed meaning. Tests S2a/S2b/S2c. | ✅ |
| **AC-5** | Provisioned untouched / dev keeps functioning (strict superset) | Trust predicates and every inline `wotFiltering` guard untouched (verified in diff — only call-swap + one spread key). `resolvePov` gains fields only; five pre-existing fields byte-identical (B6). `scoresExist:null` never escalates to `not-computed` (`povStatus.js:44,46`, B1e). `PovStatusNotice` renders `null` for healthy POV and null status (N1/N2). `for-tag` cacheKey now includes normalized `wotPov`/`userPubkey` (`event-tags:344-351`) so one POV's cached signal can't serve another (S3). | ✅ |
| **AC-6** | Consistency across surfaces, one wording source | Single `PovStatusNotice` delegating to the pure `povNoticeText` util (one wording source). All six surfaces render it: `Tags.jsx`, `Tag.jsx`, `AuthoredTaggingSection`, `ProfileTagsSection`, `NoteTags`, `TagPageSearch`. Five hooks expose `povResolution`; `TagPageSearch` reads it from its own meili response. `BrainstormSearch` does NOT adopt it (boundary). Tests S5/S6/S7/S8. | ✅ |
| **Added AC** (wording split) | Unfiltered distinguishes no-delegate from no-threshold | `povNoticeText` splits every unfiltered branch on `!!povSuffix`: delegate absent → "this instance has no point of view configured"; delegate present → "the selected point of view has no trust threshold set" (`povNoticeText.js:28-34`). Same split for the fell-back variants. No status-shape change (`povSuffix` already carried the distinction). Tests N4 (no-delegate) / N5 (the operator bug: delegate present, no threshold). | ✅ |

- [x] Every acceptance criterion has a passing test.
- [x] No criterion silently dropped.
- [x] No behavior added beyond the story — strictly additive disclosure; no filtering outcome changed.

## ADR adherence (0002 + gate amendment + Amendment 2)

- [x] **Option A implemented as decided.** `povStatus.js` exports exactly the four seams + `__resetPovStatusCacheForTests` (`povStatus.js:113-119`); `computePovStatus` mode precedence matches the ADR verbatim (`unfiltered` → `not-computed` → `filtered`); `getWotFieldDistribution` = one GET to `${MEILI_URL}/indexes/${MEILI_INDEX}/stats`, 60s-success / 10s-failure single-entry cache, `null` on non-OK/throw (`povStatus.js:72-88`); `scoresExistFor` null-tolerant (`povStatus.js:64-66`); `resolvePovWithStatus` skips the probe on the `wotFiltering` guard (`povStatus.js:96-111`).
- [x] **`resolvePov` additive fields exactly as specified** (`requestedPov` mirrors the branch condition; `delegateSource` tracks the cascade; optional `deps` seam) — no validation added the branch didn't have (`pov.js:46-81`).
- [x] **All 9 `resolvePov` call-site swaps** match the ADR's table; TL publishers (`refreshPinnedTags.js`) deliberately stay on bare `resolvePov` (S4 boundary sentinel).
- [x] **`for-tag` cacheKey fix** implemented as required (`event-tags:344-351`).
- [x] **Gate amendment (notes threading):** `useNotesForTag` + `usePinnedNotes` thread `usePov().povParams` and add `povParams.wotPov`/`userPubkey` to their effect deps (S9). Threading only — no `povResolution` exposed, per the ADR's single-Tag-page-banner design.
- [x] **Amendment 2** implemented as a clean extract: wording matrix moved verbatim into the pure `ui/src/utils/povNoticeText.js`; `PovStatusNotice.jsx` reduced to presentation delegating to it; the split added within each unfiltered branch. Testable `.js` seam mirrors `povReadParams.js`. No status-shape change.
- [x] **Layering / boundaries respected.** No new dependencies. `BrainstormSearch` untouched; applicability untouched; write/publish paths untouched.

## Deviation assessment (story `## Deviations`)

The logged deviation — `useNotesForTag`/`usePinnedNotes` thread POV but do NOT expose `povResolution`, because `useTagDetail`'s page-level banner is the single Tag-page disclosure surface — is **coherent and verified**. `Tag.jsx` renders exactly one `PovStatusNotice` (from `useTagDetail`, `Tag.jsx:252`); the notes reads still return their own `povResolution` server-side (`handleForTag`), so integrators reading `/api/event-tags/for-tag` get an honest per-read signal even though our own tag page shows one banner. No double-banner; no dishonest read. Correct.

## Residual-dishonesty & risk areas audited

- [x] **Meili-fully-down residual dishonesty is genuinely documented + accepted, and the design makes NO false `not-computed` claim.** When Meili is down and a POV is configured, per-doc lookups fail → empty results still reported `filtered` with `scoresExist:null`. `computePovStatus` only reaches `not-computed` on `scoresExist===false`; `null` falls through to `filtered` (`povStatus.js:44-47`, test B1e). The ADR Consequences section records this as accepted, out-of-scope follow-up. Verified — the system never overclaims a degradation it can't prove.
- [x] **Null / partial `povResolution` tolerance.** `povNoticeText({})` → `mode` undefined, fails every branch, hits the final `return null` (`povNoticeText.js:46`) — no crash. `PovStatusNotice` returns `null` when `povNoticeText` returns `null`. Every hook defaults `povResolution` to `null` and sets `data.povResolution || null`. No surface can crash on a null/partial signal.
- [x] **`NoteTags` gating** (`NoteTags.jsx:106`) renders the compact notice only when `tags.length > 0 || povResolution?.mode === 'not-computed'` — untagged dev feeds aren't spammed, yet silent-emptiness (mode `not-computed`) is still disclosed per card. Exactly the ADR's rule.
- [x] **Correct `variant` at every placement:** banners on `Tags`/`Tag`/`AuthoredTaggingSection`; compact on `ProfileTagsSection`/`NoteTags`/`TagPageSearch` — matches the ADR placement table.
- [x] **`for-tag` cache can't cross POVs** (S3) — key now carries normalized `wotPov`/`userPubkey`; behavior-preserving for current callers (constant suffix appended).

## Concept-graph integrity

- [x] No concept/schema/definition change — read-response + UI honesty plumbing only (ADR §orientation). **No firmware reinstall required** (ADR confirms).
- [x] No new handles; nothing in `kind:pubkey:slug` space touched.

## Things tests can't catch

- [x] No secrets, no TA-pubkey literals (`grep` for `82b75e47` in new files → none; `MEILI_URL` uses `process.env` with the standard container default).
- [x] No `console.log` / TODO / FIXME / commented-out code in the new files.
- [x] Error paths handled: probe swallows non-OK/throw → `null`; all handler early-returns thread `povResolution`.
- [x] Concurrency: per-process single-entry cache; a stale-but-recent distribution is acceptable by design (60s TTL), and never produces a false `not-computed` (only `false` does).

## House rules

- [x] Concept Graph API authority respected (orientation done in ADR; no source-first re-derivation).
- [x] No new lint/typecheck/build tooling.
- [x] JS-without-build preserved; the testable wording rule lives in a plain `.js` util the Node harness dynamic-imports (JSX stays presentation-only).

## Findings

### Blocking
_None._

### Non-blocking
1. **`src/api/event-tags/index.js:25` and `src/api/search/profiles/meili/index.js:21`** — `const { resolvePov } = require(...)` is now imported but no longer *called* in either file (all POV resolution goes through `resolvePovWithStatus`; only comment references to `resolvePov` remain). Harmless dead import (no lint gate; CJS require has no runtime cost). Optional cleanup on a future touch.

## Verdict
**PASS**

Strictly-additive honesty plumbing that satisfies all six original ACs plus the Amendment-2 wording split. Trust predicates and filtering outcomes are byte-identical (AC-5 strict superset); the read reports its own honesty at all nine handlers (AC-4); one shared wording source covers all six surfaces (AC-6); the notes-hooks gate amendment is threaded; and the one residual dishonesty is documented and provably never overclaims. Target suites 21/21 + 8/8, all no-regression suites green, build clean. The single full-suite failure is a pre-existing live-API `fetch failed` unrelated to this diff. The dead-import is non-blocking.
