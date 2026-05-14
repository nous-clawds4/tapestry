# Test Plan: Story 7 — Profile-tag polish bundle (omni-search popup + POV correctness)

**Story:** `engineering-team/stories/done/7-profile-tag-polish-omni-search-pov.md`
**ADR:** `engineering-team/decisions/0006-profile-tag-polish-omni-search-pov.md`
**Date:** 2026-05-14

## Coverage map

The story's ACs fall into five clusters; the test surface mirrors them. The server-contract suite runs with no preconditions beyond a reachable control panel; the live publish-flow suite needs `nak` + a reachable control panel + a writable `settings.json` (the POV-correctness assertions need a configured POV to be meaningful); the Playwright spec runs against the served SPA.

| AC cluster | Behavior | Test name | File | Level |
|---|---|---|---|---|
| **Omni-search: tagHits in popup** | Server response includes `tagHits` array; popup renders tag rows | `search proxy: q=<unique-substring> returns tagHits including the fixture tags` + Playwright "typing renders dropdown" regression guard | `test/profile-tag-polish-publish.test.js` + `tests/brainstorm/profile-tag-polish.spec.js` | live publish + Playwright |
| **Omni-search: tag-row click → tag-detail** | Click navigates to `/tag/:slug/:tagId` | Deterministic URL construction; transitively covered by Story 2's `/tag/:slug/:tagId` route tests. No new test. | n/a | n/a |
| **Omni-search: tag rows visually distinguishable** | New row variant in dropdown | UI-level affordance check; covered by Implementer's `<TagResultRow>` component + CSS namespace `bs-suggest-tag-*`. Reviewer verifies. | n/a | n/a |
| **Omni-search: cap + "Show more tags →"** | Default `tagHits` cap = 5; `tagHitsHasMore` true when more exist; affordance routes to Enter-results page | `search proxy: default tagLimit caps at 5 and sets tagHitsHasMore=true when more exist` + `search proxy: tagLimit=10 returns all 7 fixture matches and tagHitsHasMore=false` | `test/profile-tag-polish-publish.test.js` | live publish |
| **Omni-search: `tagLimit` query param** | Server accepts and respects `tagLimit`; clamped at 50 | `accepts tagLimit query param` + `clamps tagLimit to server-side max (<= 50)` (contract) + `tagLimit=10 returns all 7 fixture matches` (publish-flow) | `test/profile-tag-polish.test.js` + `test/profile-tag-polish-publish.test.js` | server contract + live publish |
| **Omni-search: tags on Enter-results page** | Both surfaces render tag rows; same `<TagResultRow>` component | Same server tagHits tests cover the data path; both surfaces hit the same endpoint per ADR. UI render covered by Implementer/Reviewer code inspection. | n/a | n/a |
| **Placeholder text mentions "tag"** | Inherits Story 6 AC-5 (verified already implemented at `BrainstormSearch.jsx:951`) | `AC: search placeholder mentions "tag"` (Playwright regression guard against placeholder regressing) | `tests/brainstorm/profile-tag-polish.spec.js` | Playwright |
| **POV: chip-row counts WoT-filtered** | `tags-for-profile` filters assertion authors by `wot_rank_<suffix> >= minRank` | `tags-for-profile WITH wotPov=house filters out below-WoT-rank assertion authors` | `test/profile-tag-polish-publish.test.js` | live publish |
| **POV: popover asserter list WoT-filtered** | Same endpoint; same response shape; popover renders from response | Same test as above (response carries both `applications` and `disputes` lists, both filtered) | `test/profile-tag-polish-publish.test.js` | live publish |
| **POV: re-fetch on POV change** | Client-side React state pattern; no dedicated test | UI hook concern. The pattern is the same one `useTagDetail` / `useTagIndex` already use. Reviewer verifies via code inspection. | n/a | n/a |
| **POV: no-POV degrades cleanly** | Without POV params, all assertions count (backward-compat) | `tags-for-profile WITHOUT POV params returns all 3 fixture assertions (no WoT filter)` | `test/profile-tag-polish-publish.test.js` | live publish |
| **POV: contract tests** | `tags-for-profile` accepts new params + echoes `povSuffix`/`minRank` | `tags-for-profile returns POV-echo fields` + `accepts wotPov=house` + `accepts wotPov=user with userPubkey` | `test/profile-tag-polish.test.js` | server contract |
| **POV sweep: `wot-tags`** | New POV-param contract replaces deprecated `viewer` | `wot-tags accepts wotPov=house` + `wot-tags accepts wotPov=user with userPubkey` + `wot-tags returns POV-echo fields` (contract) + `wot-tags WITH wotPov=house filters assertion authors by WoT rank` (publish-flow) | `test/profile-tag-polish.test.js` + `test/profile-tag-polish-publish.test.js` | server contract + live publish |
| **Avatar-menu POV selector** | **AC DROPPED per ADR-0006.** Cross-page POV invalidation files as a follow-up. | None — explicitly out of scope per ADR. | n/a | n/a |
| **Story 6 AC-4 verify** | Asserter list scrolls within max-height | Verified in code at `ui/src/styles.css:3881-3890` (max-height: 12rem; overflow-y: auto). Reviewer verifies. | n/a | n/a |
| **Story 6 retire to done/** | Admin task; no tests | Reviewer performs during the Story-7 review. | n/a | n/a |
| **Regression: profile page still renders TAGS chip row** | `tags-for-profile` shape change must not break the existing `<ProfileTagsSection>` | `Story 6 regression: profile page still renders the TAGS chip row` (Playwright) | `tests/brainstorm/profile-tag-polish.spec.js` | Playwright |

### Additional behavior captured beyond the explicit ACs

- **Backward-compat for `tags-for-profile`.** The endpoint must still work without POV params (the no-POV path). Asserted both at the contract layer (`preserves applications/disputes shape`) and the publish-flow layer (`WITHOUT POV params returns all 3 fixture assertions`).
- **Below-WoT-rank authors filtered out, not just excluded from counts.** The publish-flow test verifies the *surviving application's author is the in-WoT one* — guards against an off-by-one where a below-WoT author's record leaks into the response even with non-zero counts.
- **`tagHit` row shape contract.** Each entry carries `eventId` (64-hex), `slug`, `name`, `description`. Asserted in `each tagHit carries {eventId, slug, name, description}`.
- **Empty-query / no-match resilience.** Server emits `tagHits` (possibly empty) and `tagHitsHasMore: false` for queries with zero matches. Asserted via the contract tests using a synthetic no-match query.

## Edge cases

Covered explicitly:

- [x] No-POV path: `tags-for-profile` without POV params returns all assertions (backward-compat).
- [x] POV active: below-WoT-rank authors filtered out of both applications and disputes.
- [x] Below-WoT-rank author's record does not survive as an applications[0] entry under POV.
- [x] `tagLimit` defaults to 5 when omitted.
- [x] `tagLimit` capped at 50 when an absurd value is passed.
- [x] `tagHitsHasMore` accurately reflects the current limit (true when fixture has 7 matches at limit 5; false when limit 10 > 7 matches).
- [x] `tagHit` entries include all four documented fields.
- [x] No-match query returns empty `tagHits` + `tagHitsHasMore: false`.
- [x] Existing `tags-for-profile` consumers (no POV params) continue to work after the shape change.

## Not covered (intentionally)

- **Tag-row click navigation to `/tag/:slug/:tagId`.** Deterministic URL construction; route already exists from Story 2 with its own tests.
- **Tag-row visual styling.** UI affordance; Reviewer verifies CSS namespacing.
- **Enter-results page tag-row rendering specifics.** Same data path as the popup (verified server-side); Reviewer verifies the JSX render block.
- **Mid-session POV change re-fetch on the chip-row.** Hook-level React concern. The hook pattern is the same one `useTagDetail` / `useTagIndex` already use. Reviewer verifies via inspection.
- **Avatar-menu POV selector.** Dropped per ADR — pre-verification gate failed; cross-page POV invalidation is filed as a separate follow-up.
- **Story 6 AC-1/2/3/4/5.** All verified already-implemented in code (specific line references in the ADR). No new test.
- **`handleAvailableTags` POV-scoping.** Intentionally global per ADR; no change, no test.
- **"Show more tags →" affordance click navigates to Enter-results page.** The affordance's `onClick` reuses the existing `doSearch()` / Enter-submit pattern. Reviewer verifies it routes consistently with Enter.
- **`tagHits` ordering / ranking.** Server sorts however `findTagsByNameSubstring` returns matches (currently no defined sort beyond strfry's iteration order). Story 8 covers sort coherence.

## Test infrastructure

- **Test framework:** project's existing hand-rolled Node runner (`test/test.js` orchestrates suites). Playwright for browser flows. No new frameworks introduced.
- **Control panel API:** `http://localhost:7778` (override via `BRAINSTORM_BASE_URL`).
- **Concept Graph API:** not directly exercised — no concept changes per ADR-0006.
- **Live publish-flow preconditions:** `nak` on PATH AND `/api/strfry/publish` reachable AND `TAPESTRY_SETTINGS_PATH` (default `/var/lib/brainstorm/settings.json`) writable. If any are missing, the publish suite skips per-suite (same pattern as Stories 4/5).
  - The settings.json write is required because every POV-correctness test depends on a configured POV being in effect. The suite installs a synthetic POV in `setupSuite()`, captures the prior `settings.json`, and restores it in `teardownSuite()`. Per-suite SKIP when not writable.
- **Meili enrichment precondition:** `MEILI_URL_HOST` (default `http://localhost:7700`) reachable. The publish suite upserts profile docs for the WoT-author predicate to resolve.
- **Playwright preconditions:** `BRAINSTORM_SERVER_ACCESSIBLE=true` and the SPA served by the control panel.
- **Fixtures:** none on disk — publish-flow tests generate ephemeral keypairs per test run. Two fixture clusters: (1) POV-correctness — 1 target, 3 assertion authors (in-WoT applier, in-WoT disputer, below-WoT applier), 1 tag-element; (2) Omni-search — 7 tag-elements with a unique sub-slug so `q=<subSlug>` matches all 7 deterministically.

## How to run

```sh
# All suites (Stories 1–7 + main-side suites)
npm test

# Story 7 server contract subset
node test/profile-tag-polish.test.js

# Story 7 publish-flow subset (requires nak + writable settings.json)
node test/profile-tag-polish-publish.test.js

# Story 7 UI affordances — chromium, single project, line reporter
BRAINSTORM_SERVER_ACCESSIBLE=true \
  npx playwright test tests/brainstorm/profile-tag-polish.spec.js \
  --project=chromium --reporter=line
```

> The Playwright environment caveat from earlier stories still applies (`@playwright/test` isn't in this dev box's local `node_modules`; existing repo Playwright specs share this constraint).

## Verification

Confirmed failing for the right reasons on 2026-05-14, against the test-plan commit (no Story 7 implementation yet). Stories 1–5 existing tests + the main-side tests continue to pass — no regression from wiring the new suites into `test/test.js`:

```
--- profile-tag-polish tests (Story 7) ---
  FAIL  GET /api/profile-tags/tags-for-profile returns POV-echo fields (povSuffix + minRank)
        response must include povSuffix (may be null)
  PASS  GET /api/profile-tags/tags-for-profile accepts wotPov=house
  PASS  GET /api/profile-tags/tags-for-profile accepts wotPov=user with userPubkey
  PASS  GET /api/profile-tags/tags-for-profile preserves applications/disputes shape
  FAIL  GET /api/profile-tags/wot-tags accepts wotPov=house
        status — got 400, expected 200
  FAIL  GET /api/profile-tags/wot-tags accepts wotPov=user with userPubkey
        status — got 400, expected 200
  FAIL  GET /api/profile-tags/wot-tags returns POV-echo fields
        status — got 400, expected 200
  FAIL  GET /api/search/profiles/meili returns tagHits field in response (array)
        tagHits must be an array (possibly empty)
  FAIL  GET /api/search/profiles/meili returns tagHitsHasMore field (boolean)
        tagHitsHasMore must be a boolean
  FAIL  GET /api/search/profiles/meili accepts tagLimit query param
        tagHits remains array
  FAIL  GET /api/search/profiles/meili clamps tagLimit to server-side max (<= 50)
        tagHits is array

profile-tag-polish: 3 passed, 8 failed

--- profile-tag-polish publish-flow tests (Story 7) ---
  SKIP  /var/lib/brainstorm/settings.json not writable from this process; suite needs POV install

Test Results
-------------
…
profile-tag-polish suite:                        FAIL (3 passed, 8 failed)
profile-tag-polish-publish suite:                SKIP (8 tests; preconditions not met)
…
Overall:                                         FAIL
```

**Right-reason analysis:** all 8 failures are due to the feature not yet being implemented:
- 3 `tags-for-profile` tests would PASS without changes if the endpoint added `povSuffix` + `minRank` echo fields. The endpoint currently ignores unknown query params silently (no 400 on `wotPov=`), which is why the 3 "accepts wotPov=..." tests already pass — they only assert the response is still 200 + success: true, not that POV is applied. Behavioral assertions live in the publish-flow suite.
- 3 `wot-tags` tests 400 because the current endpoint requires a `viewer` query param; the new contract uses `wotPov` + `userPubkey`. After the swap, these flip to PASS.
- 4 search-proxy tests fail because the response doesn't include `tagHits` / `tagHitsHasMore` yet. After the additive response-shape change, these flip to PASS.

**Publish-flow suite:** SKIPs cleanly in this sandbox (`/var/lib/brainstorm/settings.json` not writable from the test process). The 8 tests in that suite will run end-to-end in CI / Implementer envs with writable settings.json. Fixture design verified by inspection (mirrors Story 4/5 publish-suite patterns).

The Playwright spec parses cleanly but is not executed here (Playwright not installed locally); Implementer / Reviewer envs install via `npm run test:playwright`.
