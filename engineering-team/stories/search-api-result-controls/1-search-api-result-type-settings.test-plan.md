# Test Plan: Story 1 (search-api-result-controls) — Admin control over result types in the public search API

**Story:** `engineering-team/stories/search-api-result-controls/1-search-api-result-type-settings.md`
**ADR:** `engineering-team/decisions/search-api-result-controls/0001-search-api-result-type-settings.md`
**Date:** 2026-06-10

## Coverage map

All tests live in `test/search-api-result-type-settings.test.js`, registered in `test/test.js` (runs in the default `npm test` gate).

| Criterion | Test name | Level |
|---|---|---|
| AC-1 (safe default) | `defaults.json ships search.resultTypes = { profiles: true, tags: false }` | source contract |
| AC-1 | `AC-1: default settings → response has NO tagHits / tagHitsHasMore keys` | unit (handler) |
| AC-1 | `AC-1: default settings → profile hits pass through, none carry _matchedTags` | unit (handler) |
| AC-1 (fallback) | `AC-1: missing resultTypes section falls back to safe defaults` | unit (handler) |
| AC-2 (opt-in) | `AC-2: tags enabled → tagHits array + tagHitsHasMore boolean present` | unit (handler) |
| AC-2 | `AC-2: partial override { tags: true } keeps profiles enabled via deep-merge` | unit (handler) |
| AC-3 (per-type control + warning) | `profiles disabled → hits empty even though downstream search has results` + `profiles disabled + tags enabled → tags-only search is coherent` + `profiles disabled → pubkeyLookup returns no profile document` (server semantics); `AC-3: SearchPreferences.jsx renders a "Search API result types" admin card` + `AC-3: SearchPreferences.jsx warns when the profiles type is disabled` (UI source contract) | unit + source contract |
| AC-4 (no redeploy) | `AC-4: flipping the setting between requests changes behavior without restart` — three calls in one process against a mutated settings file | unit (handler) |
| AC-5 (authorization) | `AC-5: unauthenticated PUT /api/settings is rejected (401)` + `…GET…` | live HTTP (`:7778`), per-test SKIP when unreachable |
| AC-6 (own UI coherence) | `AC-6: BrainstormSearch.jsx reads tagHits defensively (omitted keys → no tag rows)` | source contract |

Plus one regression control: `control: profiles enabled + pubkeyLookup returns the document (existing behavior)`.

## Test mechanics — why unit-level works here

- `src/config/settings.js` resolves `SETTINGS_PATH` from `TAPESTRY_SETTINGS_PATH` at module load and **reads disk on every `getSettings()` call**. The suite points the env var at a temp file, busts the `require.cache` for `src/` once, and requires `handleMeiliSearchProfiles` directly. Rewriting the temp file between calls in the same process IS the AC-4 no-restart proof.
- `global.fetch` is stubbed: downstream nostr-search-api returns two stub hits; Meili document lookups are controllable (`docLookupOk`). The handler captures `fetch` at call time, so the stub takes effect without touching the module.
- The tag pipeline (`computeTagMatches` / `findTagsByNameSubstring`) reaches strfry via `exec('strfry …')`, which fails fast on hosts without the binary and **degrades to empty** through the proxy's existing `.catch` handlers. Tags-enabled tests therefore assert key **presence/types**, not tag content. (Tag-content behavior is unchanged by this story and already covered by Story 7's suite.)
- The suite is required by `test/test.js` at load, but the env mutation + cache-bust happen lazily on first handler call — and the suite runs **last**, so it cannot affect other suites (which are HTTP-based and never read host-local settings).

## Edge cases covered

- `tagLimit` param present while tags disabled (keys still omitted) — folded into the first AC-1 test.
- `resultTypes` section missing entirely from overrides (stale settings.json) → safe defaults.
- Partial override (`{ tags: true }` only) → deep-merge keeps `profiles: true`.
- `pubkeyLookup` short-circuit under `profiles: false` (profile-type result must be suppressed) + control test for the enabled path.
- Tags-only configuration (`profiles: false, tags: true`) is coherent.

## Deliberately NOT covered

- The empty-`q` early return's key omission (pre-existing shipped behavior; review-7 noted the inconsistency as optional cleanup — not pinned, Implementer remains free).
- Tag-match content/POV-filtering when enabled — unchanged; covered by Story 7 tests.
- Browser-level toggle flow (Playwright): the admin card is covered at source-contract level; AC-5/AC-4 are covered at API/unit level. A Playwright pass can ride a later UI story if desired.
- Authenticated admin PUT (positive path): requires a NIP-07 session; exercised manually during implementation's cycle-local. The negative path (401) is automated.

## Pre-implementation pass/fail map

**Failing (9) — the implementation contract:** defaults.json contract; AC-1 key omission; AC-1 fallback; AC-4 flip; 3× profiles-disabled; 2× AC-3 UI card.
**Passing (7) — regression pins:** AC-1 `_matchedTags` absence (degraded-env note above); 2× AC-2 (current behavior already emits the keys — these keep the opt-in path honest); pubkeyLookup control; AC-6 client reads; 2× AC-5 (settings API gate already exists).

## How to run

```
node test/search-api-result-type-settings.test.js   # suite alone
npm test                                             # full gate
```

## Verification

The new tests fail with the current code. Confirmed 2026-06-10 at commit `f4644a58`:

```
--- search-api-result-type-settings tests (epic search-api-result-controls, Story 1) ---
  FAIL  defaults.json ships search.resultTypes = { profiles: true, tags: false }
  FAIL  AC-1: default settings → response has NO tagHits / tagHitsHasMore keys
  PASS  AC-1: default settings → profile hits pass through, none carry _matchedTags
  FAIL  AC-1: missing resultTypes section falls back to safe defaults
  PASS  AC-2: tags enabled → tagHits array + tagHitsHasMore boolean present
  PASS  AC-2: partial override { tags: true } keeps profiles enabled via deep-merge
  FAIL  AC-4: flipping the setting between requests changes behavior without restart
  FAIL  profiles disabled → hits empty even though downstream search has results
  FAIL  profiles disabled + tags enabled → tags-only search is coherent
  FAIL  profiles disabled → pubkeyLookup returns no profile document
  PASS  control: profiles enabled + pubkeyLookup returns the document (existing behavior)
  FAIL  AC-3: SearchPreferences.jsx renders a "Search API result types" admin card
  FAIL  AC-3: SearchPreferences.jsx warns when the profiles type is disabled
  PASS  AC-6: BrainstormSearch.jsx reads tagHits defensively (omitted keys → no tag rows)
  PASS  AC-5: unauthenticated PUT /api/settings is rejected (401)
  PASS  AC-5: unauthenticated GET /api/settings is rejected (401)

search-api-result-type-settings: 7 passed, 9 failed
```
