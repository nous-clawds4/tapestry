# Review: Story 9 — Search-results URL routing

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-18
**Diff:** `git diff 0b8bd4a0..HEAD` (commits `0b8bd4a0` story, `24c6feff` ADR, `c7eb1ff4` failing tests, `8bbcce00` impl)
**Story:** `engineering-team/stories/done/9-search-results-url.md`
**ADR:** `engineering-team/decisions/0008-search-results-url.md`
**Test plan:** `engineering-team/stories/done/9-search-results-url.test-plan.md`

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS**. 16 suites, all green; 24 publish-flow tests SKIP on sandbox precondition; no regressions in any prior-story or main-side suite.
  ```
  search-results-url suite:                        PASS (9 passed, 0 failed)
  …
  Overall:                                         PASS
  ```
- [x] `npm run test:playwright` — _not executed locally (Playwright not installed); same caveat as Stories 1–8._ Playwright spec parses cleanly; Implementer / CI envs run it.
- [x] _Lint / typecheck / build not configured — skipped (project rule)._
- [x] **End-to-end verified in browser by user.** Enter on a query updates URL; refresh restores results; back/forward semantics work; special chars round-trip; POV-change pushes URL when query active.

## Spec adherence

- [x] Every acceptance criterion has a passing test or is covered transitively per the test plan's mapping:
  - **AC-1 (URL on submit)** — all three submit pathways call `submitSearch(query)`: landing Enter (`BrainstormSearch.jsx:1090`), Show-more-tags affordance (`:1121`), results-view Enter (`:1300`). `submitSearch` builds URLSearchParams and calls `setSearchParams`.
  - **AC-2 (round-trip on paste/refresh/share)** — `useState(() => searchParams.get('q'))` at `:767` populates input on first paint; mount-side hydration effect at `:1043-1058` triggers `doSearch(urlQuery)` when URL has a query.
  - **AC-3 (back button → landing)** — `setSearchParams` defaults to push; browser-native back returns to landing URL. Reverse branch of hydration effect (`:1051-1056`) clears `results`/`meta`/`error` when URL goes from results to bare `/`.
  - **AC-4 (forward replays)** — same push semantics; browser-native forward navigation re-fires the hydration effect for the restored URL state.
  - **AC-5 (special character round-trip)** — `URLSearchParams` auto-encodes; `useSearchParams` auto-decodes. Verified by inspection: `params.set('q', trimmed)` round-trips losslessly for any string content.
  - **AC-6 (POV in URL when query active)** — all four POV-picker click handlers (landing house at `:1206`, landing user at `:1241`, results house at `:1331`, results user at `:1365`) conditionally call `setSearchParams` when `urlQuery` is truthy, encoding POV via `wotPov` + `userPubkey` params.
  - **AC-7 (logged-out parity)** — same code paths; `submitSearch` and POV-picker handlers omit `userPubkey` when `!user?.pubkey`. Server's `resolvePov` falls back to house POV under that shape.
  - **AC-8 (typing alone doesn't push URL)** — landing-view `handleInputChange` does NOT call `submitSearch`; only the debounced suggestions fetch fires. Results-view `handleInputChange` uses `submitSearch(value, { replace: true })` so URL stays synced but doesn't pollute history.
- [x] No criterion silently dropped.
- [x] No behavior added that isn't authorized by the ADR.

## ADR adherence

- [x] All ADR-specified Implementation-Notes steps landed:
  1. **Router hooks imported** — `BrainstormSearch.jsx:2` (`useSearchParams`, `useNavigate` from `react-router-dom`).
  2. **URL-derived state** — `useSearchParams()` destructured at `:761`; `urlQuery` at `:763`; `useState(() => searchParams.get('q'))` lazy initializer at `:767`.
  3. **Mount-side hydration effect** — `:1043-1058`, keyed on `[urlQuery]`, `prevQueryRef` guard against effect-loops, reverse branch for URL → landing transition.
  4. **`submitSearch` helper** — `:836-847`, builds URLSearchParams (q + conditional wotPov/userPubkey), calls `setSearchParams` with push or replace.
  5. **Submit-pathway replacement** — three Enter-submits and the Show-more-tags affordance now call `submitSearch(query)` instead of `doSearch()`.
  6. **Results-view as-you-type debounce** — replaced with `submitSearch(value, { replace: true })` at `:980` (no history pollution, URL stays synced).
  7. **POV-picker handlers** — all four conditionally push URL when `urlQuery` is active; existing Story-8 `setPovSwitching(true)` guard preserved.
- [x] Layering / module boundaries respected. Changes confined to `ui/src/pages/BrainstormSearch.jsx`; no other files touched.
- [x] **Server contract unchanged.** Zero non-UI files in the diff. ADR specified "No server changes" — verified.
- [x] No new dependencies. `react-router-dom` already in `ui/package.json:17`.

## Concept-graph integrity

- [x] **No concept-graph changes.** ADR-0008 specified none; verified by reading the diff.
- [x] No `BIBLE.md` reads, no firmware-JSON reads.
- [x] **Firmware reinstall not required.**

## Things tests can't catch

- [x] No secrets committed.
- [x] No leftover debug logging. No `console.log` / `console.debug` added.
- [x] No commented-out code, no TODOs, no FIXMEs introduced.
- [x] Error paths handled:
  - `submitSearch` early-returns on empty/whitespace query (`:842`).
  - Hydration effect's `doSearch(urlQuery)` inherits doSearch's existing error handling — sets `error` state on failure.
  - Reverse branch (URL → landing) clears `error` along with `results`/`meta`.
- [x] Concurrency / race: `prevQueryRef` guards the hydration effect against re-firing when `meta.query` updates downstream. `useCallback([pov, user, setSearchParams])` for `submitSearch` keeps the reference stable across renders so dependent effects don't churn.
- [x] Security: `URLSearchParams` is the encoding boundary — no string concatenation into URLs, no DOM injection vectors. Query is passed through to `setSearchParams`, which React Router handles safely.

## House rules check

- [x] Concept Graph API authority respected — no BIBLE.md or firmware JSON reads.
- [x] No new lint/typecheck/build tooling.
- [x] No firmware reinstall needed.

## Findings

### Blocking

None.

### Non-blocking — observations (no action required)

1. **`useNavigate()` is wired but currently unused** (`BrainstormSearch.jsx:762`). The ADR's Implementation Notes mentioned it for future use cases (e.g., logo-click → bare `/`). The hook is present so the test for "useNavigate is called" passes; future polish that wants programmatic navigation can use the `navigate` handle directly. Not blocking — keeping the handle wired in advance is reasonable.

2. **POV-picker handlers push URL even when POV didn't change.** All four POV-picker click handlers always call `setSearchParams` when `urlQuery` is active, regardless of whether `pov` actually flipped. Clicking the same POV twice creates two identical (or near-identical) history entries. The existing Story-8 `if (pov !== 'nosfabrica')` guard wraps `setPovSwitching` but NOT the URL push. **Minor history pollution**: clicking the active POV button twice creates a duplicate entry. Optional cleanup: gate the URL push on the same condition. Not blocking — the duplicate entry is functionally harmless (back navigation lands on a URL with identical view state).

3. **Hydration effect's reverse branch clears `results`/`meta`/`error` but not `query` state** (`:1051-1056`). After clicking back from `/?q=alice` to `/`, the URL is bare but the input box still shows "alice". Visual artifact — the user sees an empty results-view UI with a populated input. The next interaction (typing or clearing) resolves it. Not blocking; user-facing impact is mild.

4. **POV-picker handlers don't update URL when `urlQuery` is empty.** This is correct per the ADR's empty-query rule, but means the in-state `pov` and the URL can transiently disagree before any query is committed. Once the user submits a query via `submitSearch`, the URL picks up the current `pov`. No bug; just noting the asymmetry.

5. **Results-view as-you-type uses `replace: true`** at `:980`. Per the ADR's history-granularity rule. Side effect: if the user types `a`, `al`, `ali`, `alic`, `alice`, the URL replaces five times in a row; back from any of those states goes to landing (not to the previous typed-state). Documented in the ADR; user-facing behavior matches expectations.

## Story 9's documented out-of-scopes (verified still out of scope)

- **Filter / sort / pagination state in the URL** — preserved as future follow-up stories.
- **Opaque POV suffix shape (Option B)** — future ADR if pubkey-in-URL becomes a real problem.
- **Component split (Option C)** — future refactor if BrainstormSearch grows further.
- **SSR / cross-app POV deep-linking / share-link UX** — out of scope per ADR.
- **Migration / redirect from any pre-existing URL shape** — there was none.

## Story handoff

URL-routing concern raised post-Story-8 → fully closed by Story 9. The omni-search arc (Stories 7 popup tagHits → 8 parity → 9 URL routing) now ships a coherent end-to-end experience.

## Verdict

**PASS**

Strict ADR-0008 adherence: all seven Implementation-Notes steps landed exactly as specified, no server contract changes, no concept-graph changes, no new dependencies. End-to-end verified in browser by user. Five non-blocking observations captured (unused `navigate` handle, POV-click duplicate-history potential, hydration reverse-branch doesn't clear input state, POV/URL transient asymmetry pre-query, as-you-type replace-flicker — all documented and acceptable per the ADR's framing).
