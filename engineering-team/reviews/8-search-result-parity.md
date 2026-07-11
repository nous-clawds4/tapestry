# Review: Story 8 — Search-result parity (popup ↔ Enter-results page)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-18
**Diff:** `git diff 140bfe51^...HEAD` (commits `140bfe51` ADR, `79cfcfa0` failing tests, `fd49a1d9` impl)
**Story:** `engineering-team/stories/done/8-search-result-parity.md`
**ADR:** `engineering-team/decisions/0007-search-result-parity.md`
**Test plan:** `engineering-team/stories/done/8-search-result-parity.test-plan.md`

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS**. 15 suites, all green; 24 publish-flow tests SKIP on sandbox precondition (`/var/lib/brainstorm/settings.json` not writable from the test process); no regressions in any prior-story or main-side suite.
  ```
  search-result-parity suite:                      PASS (11 passed, 0 failed)
  …
  Overall:                                         PASS
  ```
- [x] `npm run test:playwright` — _not run in this environment (Playwright not installed); same caveat as Stories 1–7._ Playwright spec parses cleanly; Implementer / CI envs run it.
- [x] _Lint / typecheck / build not configured — skipped (project rule)._
- [x] **End-to-end verified in browser by user.** ("looks good") — popup-to-Enter ordering coheres; POV-switch indicator visible during transition.

## Spec adherence

- [x] Every acceptance criterion has a passing test or is covered transitively per the test plan's mapping:
  - **AC-1 (same set)** — covered by construction: both surfaces share `buildSearchUrl`. `limit`/`tagLimit` deltas are intentional (popup is a preview prefix). Out of scope per ADR.
  - **AC-2 (same order)** — `sortPopupHits` invoked from both call sites. `sortPopupHits is invoked from at least TWO call sites` + `doSearch invokes sortPopupHits before storing data.hits`.
  - **AC-3 (tag-result relative position)** — both surfaces render tagHits above profile rows (post-Story-7); structural Playwright guard confirms the contract still holds.
  - **AC-4 (profile/tag interleaving)** — bucket order IS the interleaving; covered by AC-2 tests.
  - **AC-5 (POV-change consistency)** — popup-side `useEffect([pov])` mirrors the existing results-page `prevPovRef` pattern. `a useEffect mirrors the results-page POV-change pattern for the popup` + `the popup POV-effect calls fetchSuggestions`.
  - **AC-6 (POV-selector loading indicator)** — `povSwitching` state declared, set true on POV-picker clicks (all four — landing + results-page variants), cleared by fetch-response handlers (both `doSearch` and `fetchSuggestions`) AND by a 1500ms timeout for the empty-query case. Rendered as `<span class="bs-personalization-switching">Updating POV…</span>` before the existing personalized/not-personalized branches.
  - **AC-7 (logged-out parity)** — same code paths; house POV via `resolvePov`. No new test; covered transitively.
- [x] No criterion silently dropped.
- [x] No behavior added that isn't authorized by the ADR.

## ADR adherence

- [x] All four ADR-specified changes landed exactly as specified:
  1. `sortPopupHits` applied in `doSearch` (initial fetch + pagination-append). `BrainstormSearch.jsx:872, 878-881`.
  2. Popup-side `useEffect([pov])` with `prevPovPopupRef` pattern, mirroring the results-page effect. `BrainstormSearch.jsx:994-1001`.
  3. `povSwitching` state slot declared. `BrainstormSearch.jsx:770`.
  4. `setPovSwitching(true)` in all four POV-picker click handlers (landing house, landing user, results house, results user) — `BrainstormSearch.jsx:1156, 1185, 1264, 1291`. `setPovSwitching(false)` in `doSearch` response (`:887`), in `fetchSuggestions` response (`:935`), AND in a 1500ms-timeout fallback effect (`:1006-1010`) for the empty-query case.
- [x] Layering / module boundaries respected. Pure UI-state changes inside `BrainstormSearch.jsx`; no other files touched.
- [x] **Server contract unchanged.** Zero non-UI files in the diff. Matches ADR's "Server: No server changes." note.
- [x] No new dependencies. No new lint/typecheck/build tooling.

## Concept-graph integrity

- [x] **No concept-graph changes.** ADR-0007 specified no schema / concept changes; verified by reading the diff (only `ui/src/pages/BrainstormSearch.jsx` and test/docs files changed).
- [x] No `BIBLE.md` reads, no firmware-JSON reads.
- [x] **Firmware reinstall not required.** Confirmed.

## Things tests can't catch

- [x] No secrets committed.
- [x] No leftover debug logging. `console.error` calls weren't added or modified.
- [x] No commented-out code, no TODOs, no FIXMEs introduced.
- [x] Error paths handled:
  - `doSearch` keeps its existing try/catch shape; `setPovSwitching(false)` lives in the success branch (matches ADR semantic — clear on response).
  - `fetchSuggestions` same shape.
  - The empty-query timeout fallback uses `clearTimeout` in the effect cleanup — no stuck timers.
- [x] Concurrency / race: the indicator can be cleared from up to three independent sources (popup fetch response, results-page fetch response, 1500ms timeout). All call `setPovSwitching(false)` — idempotent flip-to-false; no race issues.
- [x] Security: no new query-param parsing or DOM injection vectors. POV name is one of `'user'`/`'nosfabrica'` — closed set.

## House rules check

- [x] Concept Graph API authority respected.
- [x] No new lint/typecheck/build tooling.
- [x] No firmware reinstall needed (no concept changes).

## Findings

### Blocking

None.

### Non-blocking — observations (no action required)

1. **`BrainstormSearch.jsx:1004-1010` (1500ms timeout fallback)** — covers the empty-query case where no fetch fires to clear `povSwitching`. Subtle side effect: if the user changes POV with a non-empty query but the fetch takes >1500ms (slow network), the indicator clears *before* the fresh results arrive. User sees stale results with no "still loading" hint. Acceptable for v1; if it becomes noticeable, a fix would gate the timeout on "no fetch in flight." Not blocking.
2. **The POV-picker click handlers** use `if (pov !== 'nosfabrica') setPovSwitching(true)` (and the symmetric `'user'` guard) so the indicator only fires when the POV actually changes. This is more thoughtful than the test requires — the test only asserts the literal `setPovSwitching(true)` string appears somewhere. Noted as a positive: clicking the already-active POV doesn't flash the indicator.
3. **`bs-personalization-switching` CSS class** is referenced in JSX but has no explicit rule in `ui/src/styles.css` (verified by grep). The text "Updating POV…" will inherit the parent `.bs-personalization-status` styling and render legibly, but if a future designer wants a distinct treatment (e.g., a pulsing animation), they'll need to add the rule. Optional polish; not blocking.
4. **Four-callsite duplication for POV-picker handlers.** The landing-view picker and results-view picker each have their own house+user click handlers — four total, all structurally identical. ADR didn't call for component extraction, and the duplication is pre-existing (Story 8 just added the same wrapping to all four). If a future refactor extracts a `<PovPicker>` component, the `setPovSwitching` wrap will move with it. Not blocking; just a place to remember.
5. **Story 8's tag-results positioning AC (AC-3)** is satisfied transitively but the test plan calls it out as "covered by AC-2 tests + Playwright structural guard." Slightly indirect — the actual Playwright assertion is structural rather than positional. Acceptable per the test plan's "data-dependent assertions are out of scope" framing.

## Story-8's documented out-of-scopes (verified still out of scope)

- **NIP-05 placement parity** (inline-in-popup vs pinned card on results-page) — preserved as different per-surface UX.
- **`limit` / `tagLimit` value parity** — preserved as intentional preview-vs-full-list deltas.
- **Server-side ranking contract** — no server changes; future ADR if needed.
- **`useSearch` hook extraction** — future refactor.
- **Cross-page POV invalidation** — still tracked as a follow-up.
- **Search-results URL routing** (raised post-impl by the user during browser verification) — **NEW follow-up: this becomes Story 9**. Story 8 closes parity; URL state is a separate concern.

## Verdict

**PASS**

ADR-0007 adhered to strictly: four specified changes landed, no creep, server contract unchanged, no concept-graph touch, no firmware reinstall. The 11 source-pattern tests all pass; the 3 Playwright structural guards parse cleanly. Five non-blocking observations captured (1500ms timeout edge case, smart POV-equality guard, missing CSS rule on the new class, four-callsite duplication is pre-existing, Playwright assertions are necessarily structural for this UI-state surface).
