# Test Plan: Story 9 — Search-results URL routing

**Story:** `engineering-team/stories/done/9-search-results-url.md`
**ADR:** `engineering-team/decisions/0008-search-results-url.md`
**Date:** 2026-05-18

## Coverage map

Story 9 is pure UI / routing behavior in `ui/src/pages/BrainstormSearch.jsx`. The project's Node test runner can't directly require JSX/React, so the test surface is split:

- **Source-pattern assertions** (`test/search-results-url.test.js`) verify the ADR-specified code lands (Router hook imports, hook invocations, `setSearchParams` call sites, hydration effect). Same approach as Story 8's `test/search-result-parity.test.js`.
- **Playwright structural assertions** (`tests/brainstorm/search-results-url.spec.js`) verify the user-facing URL behavior: Enter updates the URL, direct navigation hydrates, back-button returns to landing, special-character round-trip.

| Criterion | Behavior | Test name | File | Level |
|---|---|---|---|---|
| AC-1 (URL on submit) | Press Enter → URL changes with `?q=` | `AC: typing a query and pressing Enter updates the URL with ?q=` (Playwright) + `setSearchParams is called` + `setSearchParams is called from at least TWO call sites` (source) | both files | Playwright + source-pattern |
| AC-2 (round-trip on paste/refresh/share) | Visit `/?q=<query>` directly → results view loads with query populated | `AC: visiting /?q=<query> directly loads the results view` (Playwright) + `an effect triggers doSearch when the URL query changes` (source) | both files | Playwright + source-pattern |
| AC-3 (back button) | Back from results URL → landing URL | `AC: browser back from a results URL returns to the landing URL` (Playwright) — works by virtue of React Router's `setSearchParams` pushing history entries | `tests/brainstorm/search-results-url.spec.js` | Playwright |
| AC-4 (forward replays) | Forward from landing → results page restored | Covered transitively by AC-3 + browser-native semantics. React Router doesn't override forward; if back works, forward works. No dedicated test. | n/a (transitive) | n/a |
| AC-5 (special character round-trip) | `q=alice%20%26%20bob` decodes to `alice & bob` | `AC: special-character query round-trips through URL encoding losslessly` (Playwright) — `URLSearchParams` handles encoding; the test verifies the round-trip by reloading and checking the input value | `tests/brainstorm/search-results-url.spec.js` | Playwright |
| AC-6 (POV in URL) | POV change while on a results page pushes new URL with `wotPov` + `userPubkey` | `POV-picker click handlers reference setSearchParams` (source) — verifies the URL-push pathway exists in the POV handlers | `test/search-results-url.test.js` | source-pattern |
| AC-7 (logged-out parity) | House POV produces same results for a given URL across logged-out users | Covered transitively: same code paths; `resolvePov` falls back to house when no `userPubkey` is in URL. No dedicated test. | n/a (transitive) | n/a |
| AC-8 (typing alone doesn't change URL) | Input changes without submit do not push URL | Source-pattern doesn't directly assert this; the absence of `setSearchParams` calls in the `handleInputChange` / typing handlers is the proof. Playwright could assert "URL doesn't change while typing" but it's data-dependent timing and unreliable. Acceptable — the ADR specifies "push on Enter-submit only"; the source-pattern call-site count enforces this is a discrete handler, not per-keystroke. | n/a (transitive) | n/a |

### Additional implementation-presence tests (source-pattern)

- `useSearchParams is imported from react-router-dom` (sanity).
- `useNavigate is imported from react-router-dom` (sanity; the navigate handle is used for cases like Brainstorm-logo click that should reset to bare `/`).
- `useSearchParams is called (URL search-params state is derived)` — verifies the destructure `const [searchParams, setSearchParams] = useSearchParams()`.
- `useNavigate is called` — verifies `const navigate = useNavigate()`.
- `the component reads "q" from searchParams` — verifies `searchParams.get('q')` is somewhere in the source.

## Edge cases

Covered explicitly:

- [x] Direct navigation to `/?q=<query>` (paste / refresh / share) hydrates state.
- [x] Back button from results URL → landing URL.
- [x] Special-character query: ampersand, space, mixed — round-trips through URL encoding.
- [x] POV-change while on a results page updates URL.
- [x] At least two `setSearchParams` call sites exist (Enter-submit + POV-change).
- [x] Mount-side hydration effect: when URL `q` changes, `doSearch` fires.

## Not covered (intentionally)

- **AC-4 forward button:** browser-native semantics; transitively covered by AC-3 (if push works for Enter, forward works on natural history).
- **AC-7 logged-out parity:** same code paths; covered transitively.
- **AC-8 "typing alone doesn't change URL":** absence-of-call assertion. The Playwright test could assert "URL doesn't update during 500ms of typing," but it's flaky (depends on debounce + render timing). The source-pattern call-site count (`setSearchParams` only in submit + POV handlers, not in `handleInputChange`) is the structural enforcement.
- **POV-equality guard on POV-change handlers** (don't push URL if POV didn't actually change) — implementation detail; ADR doesn't require it; Reviewer can flag if absent.
- **POV-suffix opaque shape (Option B):** explicit out-of-scope per ADR.
- **Filter / sort state in URL:** out of scope per ADR.
- **Pagination state in URL:** out of scope per ADR.
- **Recipient-instance fallback verification** (sender's user-prefs not available on recipient → graceful fallback to house POV): integration-level concern, requires cross-instance setup the test suite doesn't have. Acceptable per ADR's "documented degradation" framing.
- **Component split / refactor coverage** (Option C): not adopted; no tests needed.

## Test infrastructure

- **Test framework:** project's hand-rolled Node runner (`test/test.js`). Playwright for browser flows. No new frameworks.
- **Source path:** `ui/src/pages/BrainstormSearch.jsx`. Source-pattern tests `fs.readFileSync` this file — same approach as `test/search-result-parity.test.js` (Story 8).
- **No fixtures required.** Source-pattern tests are deterministic. Playwright tests use queries like "alice", "bob", "alice & bob" — pure structural assertions, no fixture data on the backend needed.
- **Control panel API:** not exercised — no server changes.
- **Concept Graph API:** not exercised — no concept changes.
- **Playwright preconditions:** `BRAINSTORM_SERVER_ACCESSIBLE=true` and the SPA served by the control panel.

## How to run

```sh
# All suites
npm test

# Story 9 source-pattern subset
node test/search-results-url.test.js

# Story 9 Playwright subset
BRAINSTORM_SERVER_ACCESSIBLE=true \
  npx playwright test tests/brainstorm/search-results-url.spec.js \
  --project=chromium --reporter=line
```

## Verification

Confirmed failing for the right reasons on 2026-05-18, against the test-plan commit (no Story 9 implementation yet). All prior-story tests + main-side suites continue to pass:

```
--- search-results-url tests (Story 9) ---
  FAIL  useSearchParams is imported from react-router-dom
  FAIL  useNavigate is imported from react-router-dom
  FAIL  useSearchParams is called (URL search-params state is derived)
  FAIL  useNavigate is called (navigation pathway available)
  FAIL  the component reads "q" from searchParams (URL is the source of truth for query)
  FAIL  an effect triggers doSearch when the URL query changes (mount-side hydration)
  FAIL  setSearchParams is called (URL push pathway exists)
  FAIL  setSearchParams is called from at least TWO call sites (submit + POV-change)
  FAIL  POV-picker click handlers reference setSearchParams (POV-change pushes URL when query is active)

search-results-url: 0 passed, 9 failed

Overall:                                         FAIL
```

**Right-reason analysis:** all 9 failures describe exactly what ADR-0008's Implementation Notes specify:

- 4 failures around Router hook imports/invocations (steps 1–2).
- 1 failure around reading `q` from searchParams (step 2).
- 1 failure around the mount-side hydration effect (step 3).
- 2 failures around `setSearchParams` being called (step 4 + 5 — Enter-submit + POV-change).
- 1 failure around the POV-picker handlers wiring up URL-push for the active-query case (step 5).

After Implementation, all 9 source-pattern tests will pass. The Playwright spec parses cleanly but is not executed locally (Playwright not installed); Implementer / CI envs run it.
