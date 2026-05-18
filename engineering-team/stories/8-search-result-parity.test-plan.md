# Test Plan: Story 8 — Search-result parity (popup ↔ Enter-results page)

**Story:** `engineering-team/stories/8-search-result-parity.md`
**ADR:** `engineering-team/decisions/0007-search-result-parity.md`
**Date:** 2026-05-18

## Coverage map

Story 8 is almost entirely UI-state behavior in `ui/src/pages/BrainstormSearch.jsx`. The project's Node test runner can't directly require JSX/React modules, so the test surface is split:

- **Source-pattern assertions** (`test/search-result-parity.test.js`) verify the ADR-specified code lands at the right places. Same approach as `test/scheduled-search-and-house-scores-refresh.test.js` uses for its UI-source checks.
- **Playwright structural guards** (`tests/brainstorm/search-result-parity.spec.js`) verify the page doesn't crash and the existing tag-hits container contract still holds.
- **Visual / behavioral assertions** (specific bucket order, `povSwitching` indicator visible during a POV change) require fixture data and user-interaction simulation the project's Playwright lacks; the Reviewer + manual browser smoke verify these.

| Criterion | Behavior | Test name | File | Level |
|---|---|---|---|---|
| AC-1 (same set) | Popup is a *prefix* of results (intentional; ADR-clarified). The set itself is computed by the same server endpoint with different `limit` / `tagLimit` values. No new test — by construction both surfaces share `buildSearchUrl`. | n/a (out of scope per ADR) | n/a | n/a |
| AC-2 (same order) | Same `sortPopupHits` applied to both fetch paths | `sortPopupHits is invoked from at least TWO call sites` + `doSearch invokes sortPopupHits before storing data.hits` | `test/search-result-parity.test.js` | source-pattern |
| AC-3 (tag-result relative position) | Tags above profiles on both surfaces (already aligned post-Story-7) | `Story-7 regression: tagHits container exists` (Playwright) — guards against the layout breaking; the actual ordering is covered by AC-2 | `tests/brainstorm/search-result-parity.spec.js` | Playwright |
| AC-4 (profile/tag interleaving) | Bucket order is the interleaving — same as AC-2 | (covered by AC-2 tests) | n/a (same as AC-2) | n/a |
| AC-5 (POV-change consistency) | A `useEffect` on `[pov]` re-runs `fetchSuggestions` when the popup is active | `a useEffect mirrors the results-page POV-change pattern for the popup` + `the popup POV-effect calls fetchSuggestions` | `test/search-result-parity.test.js` | source-pattern |
| AC-6 (POV-selector loading indicator) | `povSwitching` state slot exists, gets set to true on POV change, cleared on fetch response | `povSwitching state slot is declared` + `setPovSwitching is flipped to true somewhere` + `setPovSwitching is cleared (false) somewhere` + `povSwitching is referenced in render JSX` | `test/search-result-parity.test.js` | source-pattern |
| AC-7 (logged-out parity) | Same code paths, `wotPov=house` — no separate test | covered transitively by AC-2 + AC-5 | n/a | n/a |
| Pagination | `setResults(prev => ...)` append branch also sorts the new slice | `doSearch pagination-append branch also sorts the new slice` | `test/search-result-parity.test.js` | source-pattern |

### Additional regression-guard tests (don't fail today; guard the existing behavior)

- `sortPopupHits is defined in BrainstormSearch.jsx (module-scope or imported)` — passes already; guards against the function disappearing.
- `sortPopupHits buckets in name → tag → description order` — passes already; guards against the bucket-order being silently changed.

## Edge cases

Covered explicitly by the source-pattern suite:

- [x] `sortPopupHits` is invoked from doSearch (the THE Story 8 change).
- [x] `sortPopupHits` is invoked from BOTH fetchSuggestions (preserves existing popup-sort fix) AND doSearch.
- [x] Bucket order is name → tag → description (regression guard).
- [x] Pagination-append slice is sorted (per-page sort, documented trade-off).
- [x] A second `useEffect` on `[pov]` exists for popup reactivity.
- [x] The popup POV-effect specifically calls fetchSuggestions (not doSearch).
- [x] `povSwitching` state slot declared.
- [x] `setPovSwitching(true)` called somewhere (POV-change handler).
- [x] `setPovSwitching(false)` called somewhere (clear path).
- [x] `povSwitching` is read in render (loading indicator is conditional on it).

Covered by Playwright (lightweight):

- [x] Landing page renders the search input (no JS crash from sort changes).
- [x] Typing + Enter doesn't crash the page (results-page sort doesn't throw).
- [x] Story-7 regression: the page settles cleanly even after triggering the results view.

## Not covered (intentionally)

- **Exact pixel ordering of popup vs results-page rows for a specific query.** Requires fixture data the Playwright suite can't publish. Source-pattern tests prove `sortPopupHits` is applied identically; the algorithm correctness was verified at popup-sort-fix time.
- **Visual `povSwitching` indicator transition.** Triggering a POV change in Playwright requires authenticated session + UI interaction with the POV switcher. The source-pattern tests prove the state flag is wired and rendered; visual treatment is the Implementer's UX choice, verified manually.
- **Network-level assertion that a POV change re-fires `fetchSuggestions`.** Would need a network-intercept harness Playwright supports but the project doesn't currently use. Source-pattern test (`the popup POV-effect calls fetchSuggestions`) proves the wiring.
- **Cross-page POV invalidation** (the dropped Story-7 avatar-menu AC). Out of scope for Story 8 per ADR-0007.
- **NIP-05 result placement parity** (inline-in-popup vs pinned card on results-page). Out of scope per ADR-0007 — per-surface UX choice.
- **Server-side ranking contract.** Out of scope per ADR-0007 — future ADR if needed.
- **`limit` / `tagLimit` value parity.** Out of scope per ADR-0007 — intentional preview-vs-full-list deltas.
- **`useSearch` hook extraction.** Out of scope per ADR-0007 — future refactor.

## Test infrastructure

- **Test framework:** project's hand-rolled Node runner (`test/test.js`). Playwright for browser flows. No new frameworks.
- **Source path:** `ui/src/pages/BrainstormSearch.jsx`. The source-pattern tests `fs.readFileSync` this file and apply regex/substring assertions — same pattern as `test/scheduled-search-and-house-scores-refresh.test.js`.
- **No fixtures required.** Source-pattern tests are deterministic; Playwright tests are structural / smoke-level.
- **Control panel API:** not exercised — there are no server changes.
- **Concept Graph API:** not exercised — no concept changes.
- **Playwright precondition:** `BRAINSTORM_SERVER_ACCESSIBLE=true`.

## How to run

```sh
# All suites
npm test

# Story 8 source-pattern subset
node test/search-result-parity.test.js

# Story 8 Playwright subset (requires the SPA served by the control panel)
BRAINSTORM_SERVER_ACCESSIBLE=true \
  npx playwright test tests/brainstorm/search-result-parity.spec.js \
  --project=chromium --reporter=line
```

## Verification

Confirmed failing for the right reasons on 2026-05-18, against the test-plan commit (no Story 8 implementation yet). All prior-story tests + main-side suites continue to pass:

```
--- search-result-parity tests (Story 8) ---
  PASS  sortPopupHits is defined in BrainstormSearch.jsx (module-scope or imported)
  PASS  sortPopupHits buckets in name → tag → description order (regression guard for the popup-sort fix)
  FAIL  sortPopupHits is invoked from at least TWO call sites in BrainstormSearch.jsx
        sortPopupHits must appear in at least 3 places (definition + 2 call sites) — popup AND Enter-results page. Found 2.
  FAIL  doSearch (results-page fetch) invokes sortPopupHits before storing data.hits
  FAIL  doSearch pagination-append branch also sorts the new slice
  FAIL  a useEffect mirrors the results-page POV-change pattern for the popup
  FAIL  the popup POV-effect calls fetchSuggestions
  FAIL  povSwitching state slot is declared
  FAIL  setPovSwitching is flipped to true somewhere (POV-change handler)
  FAIL  setPovSwitching is cleared (false) somewhere
  FAIL  povSwitching is referenced in render JSX (loading indicator is conditional on it)

search-result-parity: 2 passed, 9 failed

Overall:                                         FAIL
```

**Right-reason analysis:** the 2 PASSing tests are regression guards for the popup-sort fix already in the codebase (the `sortPopupHits` function exists and has the right bucket order). The 9 FAILing tests describe exactly what ADR-0007 specifies the Implementer needs to add:

- 3 failures around `sortPopupHits` being called from `doSearch` (including the pagination branch).
- 2 failures around the popup-side POV-change `useEffect`.
- 4 failures around the `povSwitching` state model (declaration, setter usages, render reference).

After the Implementation phase, all 11 tests in this suite will PASS.

**Playwright spec:** parses cleanly but is not executed in this sandbox (Playwright not installed locally). Implementer / Reviewer envs install it via `npm run test:playwright`. The 3 Playwright tests are structural / no-crash guards — they should pass before AND after the Implementer's changes (they don't depend on the new code), so they serve as regression detection rather than progress indicators.
