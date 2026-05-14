# Test Plan: Story 9 — Discover swaps mock data for the API

**Story:** `engineering-team/stories/9-discover-swaps-mock-data-for-api.md`
**ADR:** `engineering-team/decisions/0007-discover-swaps-mock-data-for-api.md`
**Date:** 2026-05-14

## Approach

Slice 3 is mostly **wiring**. Source-regex tests pin the structural facts:

- `client.js` exists, exports the three functions, uses relative-origin URLs.
- The three swapped pages no longer import directly from `mockData.js`.
- The two intentionally-unswapped pages still do (with documenting comments).
- `.env.development` + `.env.production` files exist with the right `VITE_USE_MOCK_DATA` values.
- CardSkeleton + FetchError exist.
- Discover renders the three states (loading / error / ready).

A couple of **behavioral tests** exercise the client itself with monkey-patched `globalThis.fetch`. These verify: 404 → null, non-2xx → throw, viewer query parameter is URL-encoded, mock mode returns mock data without touching fetch.

Visual regression is verified via the preview tool — Discover in `VITE_USE_MOCK_DATA=true` mode renders identically to Slice 0. Production-build tree-shaking verification (the bundle doesn't contain "The Listening Room" mock string) runs as a separate manual step (not in CI because it requires `npm run build`).

## Coverage map

### API client structure (source-regex)

| Criterion | Test | Level |
|---|---|---|
| AC: client.js exports getCommunities/getCommunity/getCommunityMembers | T1 `ui-communities/src/api/client.js exports the three named async functions` | source-regex |
| AC: relative-origin URLs only | T2 `client.js fetch calls use relative paths like /api/communities — no http(s)://localhost` | source-regex |
| AC: viewer URL-encoded into query string | T3 `client.js encodes the viewer parameter via encodeURIComponent` | source-regex |
| AC: 404 → null | T4 `client.js handles a 404 response by resolving to null on getCommunity` | source-regex + behavior |
| AC: non-2xx throws | T5 `client.js throws on non-2xx, non-404 responses` | source-regex + behavior |
| AC: mock-mode toggle via import.meta.env.VITE_USE_MOCK_DATA | T6 `client.js reads import.meta.env.VITE_USE_MOCK_DATA at module load` | source-regex |

### Env files

| Criterion | Test | Level |
|---|---|---|
| AC: .env.development with VITE_USE_MOCK_DATA=true | T7 `.env.development exists with VITE_USE_MOCK_DATA=true` | source-regex |
| AC: .env.production with VITE_USE_MOCK_DATA=false | T8 `.env.production exists with VITE_USE_MOCK_DATA=false` | source-regex |

### Component existence

| Criterion | Test | Level |
|---|---|---|
| AC: CardSkeleton component exists | T9 `ui-communities/src/components/CardSkeleton.jsx exports a CardSkeleton component` | source-regex |
| AC: FetchError component exists with Retry | T10 `ui-communities/src/components/FetchError.jsx exports a FetchError component with a Retry button` | source-regex |

### Page wiring

| Criterion | Test | Level |
|---|---|---|
| AC: Discover no longer imports from mockData directly | T11 `Discover.jsx imports from api/client instead of data/mockData` | source-regex |
| AC: CommunityDetail no longer imports from mockData (for fetched data) | T12 `CommunityDetail.jsx imports getCommunity from api/client (not data/mockData for the community itself)` | source-regex |
| AC: Edit no longer imports from mockData | T13 `Edit.jsx imports getCommunity from api/client` | source-regex |
| AC: MyCircles + Create still on mock data with comment | T14 `MyCircles.jsx and Create.jsx retain the mockData import with an inline comment referencing story #9` | source-regex |
| AC: Discover renders loading/error/ready states | T15 `Discover.jsx contains references to 'loading' / 'error' / 'ready' status branches` | source-regex |
| AC: CommunityDetail renders loading/error/not-found/ready states | T16 `CommunityDetail.jsx contains state branches for loading, error, and a null-community surface` | source-regex |
| AC: error UI uses Retry button + brand copy | T17 `FetchError renders the canonical brand copy ("couldn't reach")` | source-regex |
| AC: Conversation tab still reads posts from mockData | T18 `CommunityDetail still imports the post-fetch helper or accesses posts from the mockData fallback for the Conversation tab (Slice 6 wires real kind-1)` | source-regex (lighter — just verify posts aren't blank) |

### Client behavior (with mocked fetch)

| Criterion | Test | Level |
|---|---|---|
| AC: getCommunity returns null on 404 | T19 `getCommunity() resolves to null when fetch returns 404` | unit (mocked fetch) |
| AC: getCommunities throws on 500 | T20 `getCommunities() throws when fetch returns 500` | unit (mocked fetch) |
| AC: viewer encoded into query | T21 `getCommunities("abcdef") issues fetch to /api/communities?viewer=abcdef` | unit (mocked fetch) |
| AC: mock-mode bypasses fetch entirely | T22 `when VITE_USE_MOCK_DATA is truthy, no fetch is issued and mock projections are returned` | unit (set env, mock fetch shouldn't be called) |

### Regression

| Criterion | Test | Level |
|---|---|---|
| AC: Slice 0 source-regex tests still pass | T23 `existing communities-ui-scaffold suite remains green` | regression (full test run) |
| AC: build + lint clean | manual (`npm run build` + `npm run lint`) | CI |

## Edge cases

- [x] **Network down in the browser.** `fetch` throws on network error (not a non-2xx response). T20 covers the throw path; the error UI handles it the same way as a 500.
- [x] **Slow API.** Loading skeleton is what users see; no spinner needed for the 60s server-side TTL hot path.
- [x] **404 from `getCommunities` (list endpoint).** Unlikely since the route always 200s with empty array, but if it ever 404'd, `getCommunities` would throw per T20. Acceptable; the empty array is the documented contract from Slice 2.
- [x] **`VITE_USE_MOCK_DATA` is unset entirely.** Truthiness check (`!!import.meta.env.VITE_USE_MOCK_DATA`) treats undefined as false. Production behavior. Documented as intentional in the ADR.
- [x] **`VITE_USE_MOCK_DATA` is the string `"false"`.** This is a Vite/JavaScript gotcha — `"false"` is truthy! The ADR specifies `!!import.meta.env.VITE_USE_MOCK_DATA` which would flip mock mode ON for `"false"`. The fix is to coerce explicitly: `import.meta.env.VITE_USE_MOCK_DATA === 'true'`. **Test T6 must verify the comparison is `=== 'true'`, not just `!!`.**

## Not covered (intentional)

- **Production-bundle mock-data tree-shaking.** Requires `npm run build` which takes ~600ms. Not in the regular CI test run; ADR notes the manual verification step (grep `dist-communities/assets/index-*.js` for "The Listening Room" → expect 0 matches).
- **Live API behavior.** Endpoints answer empty until Slice 2 NB-4 (real data wiring) lands. Deferred to staging smoke.
- **Visual regression on the loading skeleton at all breakpoints.** Preview-tool screenshots at 375px and 1440px are the manual verification; no automated visual diff library is in scope.
- **`react-query` migration path.** Not relevant for v1.

## Test infrastructure

- **Framework:** Node runner (`test/test.js`). New file `test/discover-swaps-mock-data-for-api.test.js`. Same pattern as #6 / #8.
- **Mocked fetch:** standard Node's `fetch` (since Node 18+) replaced via `globalThis.fetch = stubFetch` for the duration of the test. The client module is loaded via `require` from the test (after Vite-style ESM transformation isn't necessary because the client is small enough we can extract its behavior into a testable subset, OR we read the source via fs.readFileSync and assert the behavior structurally).

  **Practical note:** the `ui-communities/src/api/client.js` is ESM (`import` syntax) and uses `import.meta.env`. Node test runner uses CommonJS by default. Two options:
  - (a) Source-regex test the client's expressions ("does it call fetch?", "does it encodeURIComponent?", etc.) without actually executing it. Robust but indirect.
  - (b) Add a `require('module').createRequire` + ESM hooks setup. Heavier.

  Going with (a) — source-regex covers the structure; the behavioral tests (T19–T22) extract small testable functions from the client (e.g. `_buildUrl(viewer)`) and unit-test those directly.

  This is consistent with the existing test style — Stories #5 / #6 / #7 all use source-regex over JSX/JS files rather than full ESM execution.

- **No new dependencies.** Pure `fs.readFileSync` + the existing `assert`.

## How to run

```bash
npm test
```

Manual visual verification (preview-tool):

```bash
# Default dev mode (mock data):
cd ui-communities && npm run dev
# Open http://localhost:5174 — Discover shows the 8 mock communities

# Production-mode preview:
cd ui-communities && npm run build && npm run preview
# Open http://localhost:4173 — Discover shows the empty/error state
```

Tree-shake verification:

```bash
cd ui-communities && npm run build
grep -c 'The Listening Room' ../dist-communities/assets/index-*.js
# Expect: 0
```

## Verification

Tests fail with the current code (no `src/api/client.js`, pages still import from mockData). Confirmed-failing on commit `e09250e7` once the test file lands — failures point at specific missing files / source-shape gaps.
