# Story 9: Discover swaps mock data for the Communities REST API (Slice 3)

**Status:** Approved
**Created:** 2026-05-14
**Type:** Feature

## Background

Slice 0 built the `ui-communities/` SPA against an in-repo `mockData.js`. Slice 2 landed `GET /api/communities`, `/api/communities/:slug`, and `/api/communities/:slug/members`. Slice 3 connects the two: the read-only surfaces in `ui-communities/` start fetching from the real REST endpoints.

Two tensions Slice 3 has to resolve:

1. **The endpoints currently return `{ communities: [] }`.** Slice 2's data-source layer is stubbed (Slice 2 NB-4 in `engineering-team/reviews/8-...`). A naive swap would replace the populated mock dataset with an empty one — every page would render its empty state, and the local-dev experience would feel broken. Until live data flows, we need to keep the mock data accessible for development without making it visible in production.
2. **Mock-data fallback must not be implicit.** If the API returns `[]` and the UI silently falls back to mock data, users in production won't be able to tell the difference between "this droplet has no communities yet" and "the data source is broken." The fallback must be an explicit build-time mode toggle, not a runtime heuristic.

Slice 3 introduces a thin API client (`ui-communities/src/api/client.js`) with two implementations: a real one that calls `fetch('/api/communities/...')` and a mock one that synchronously returns the existing `mockData.js` shape (wrapped in Promise.resolve for API-compatibility). A `VITE_USE_MOCK_DATA` env var picks which implementation is exported. Default `true` in dev (so local visual review stays rich), default `false` in build (so production deploys are honest).

The Slice 0 components are restructured to accept their data via props/loader rather than importing `mockData.js` directly. Loading states, error states, and the existing empty state are all wired through the same surface so the API failure modes are visually consistent with the existing not-found / empty-search patterns.

**Scoped to read-only surfaces.** MyCircles and Create stay on `mockData.js` this slice — MyCircles renders the viewer's joined-set which is local React state until Slice 4 wires NIP-07, and Create depends on a member-search endpoint that doesn't exist yet. Write paths land in Slice 4.

## User-facing description

**As a first-time visitor** to `communities.brainstorm.world` after the staging deploy lands, I want Discover to fetch real community data over HTTP, **so that** circles surfaced on the page come from what's actually been published into the network — not a hand-typed list inside the React bundle.

**As a developer** running `cd ui-communities && npm run dev` locally without a Docker stack up, I want the page to render with the existing mock dataset by default, **so that** I can iterate on visual design and copy without standing up Docker or pointing the dev proxy at a remote API. The mock-data toggle is explicit and visible to me in the build environment, never silently triggered by an empty API response.

**As an operator** verifying staging post-deploy, I want a clean signal in the network panel that the UI is hitting the real API endpoints, **so that** I can tell from `/api/communities` traffic alone whether the data path is wired correctly — without needing to read source.

## Acceptance criteria

Testable from the outside.

### API client

- [ ] A new module at `ui-communities/src/api/client.js` exports three async functions:
  - `getCommunities(viewer?: string) -> Promise<CommunityCard[]>`
  - `getCommunity(slug: string, viewer?: string) -> Promise<CommunityDetail | null>` (null on 404)
  - `getCommunityMembers(slug: string, viewer?: string) -> Promise<MemberEntry[]>`
- [ ] The real-mode implementation issues `fetch('/api/communities...')` calls against the relative origin (no hardcoded `http://localhost:8080` — the Vite dev-server proxy and production hosting both route same-origin to the right place).
- [ ] The `viewer` parameter (when present) is passed as the `?viewer=<hex>` query string, exactly matching the API contract from Slice 2 / ADR-0006.
- [ ] Network errors and non-2xx HTTP responses surface as thrown `Error` objects with a clear `message`. The handler files (`Discover.jsx`, `CommunityDetail.jsx`, `Edit.jsx`) catch these and render an error UI rather than crashing the page.
- [ ] When `getCommunity` receives a 404 response, it resolves with `null` rather than throwing — page handlers branch on `null` to render the NotFound surface.
- [ ] The response shape from `getCommunities()` matches the Slice 2 envelope: `[]` of community-list-entries with the field set documented in [Story #8 AC](8-gr-community-scoring-and-api.md#rest-api-surface) (slug / name / description / tags / memberCount / trustedHere / activity / accent / members / joined). Field names match the JSON the API emits; the UI does not re-rename fields client-side.

### Mock-mode toggle

- [ ] `ui-communities/src/api/client.js` checks `import.meta.env.VITE_USE_MOCK_DATA` at module load. When truthy, the three exports become functions that return `Promise.resolve(<mock-data-projection>)` instead of issuing fetches. The mock projections derive from the existing `mockData.js`, transformed once into the API-response shape so the consumer code is identical in both modes.
- [ ] `ui-communities/.env.development` is added with `VITE_USE_MOCK_DATA=true`. `ui-communities/.env.production` is added with `VITE_USE_MOCK_DATA=false`. Both files are committed.
- [ ] `ui-communities/.env.local` is **not** committed (this is the developer override). The pattern follows Vite's standard precedence (`.env.local` > `.env.<mode>` > `.env`).
- [ ] In production builds (`npm run build`), the `VITE_USE_MOCK_DATA` value is replaced at build time via Vite's static replacement. The `import.meta.env.VITE_USE_MOCK_DATA` reference in `client.js` becomes a literal `false`, and any dead `if (USE_MOCK)` branches are tree-shaken out of the production bundle. Verified by inspecting the built `dist-communities/assets/index-*.js` for absence of `mockData` references.
- [ ] The mock projections are derived in-module — `client.js` imports `mockData.js` at the top, and the mock-mode functions return Promise-wrapped projections. **No** branch where the mock data is fetched/served from a separate URL; the mode is purely a build-time switch.

### Page wiring

- [ ] `ui-communities/src/pages/Discover.jsx` no longer imports from `'../data/mockData.js'` directly. Instead it imports from `'../api/client.js'` and fetches via `getCommunities(viewer)` inside an effect. `viewer` is null/undefined for Slice 3 (no auth yet); the API's TA-fallback kicks in server-side.
- [ ] Discover renders four states cleanly:
  - **Loading** — a skeleton row of community-card-shaped placeholders (≥ 3 cards) with a subtle shimmer animation. Replaces the grid until the fetch resolves.
  - **Loaded with results** — the existing card grid, identical to Slice 0's behavior.
  - **Loaded with empty array** — the existing "Nothing matches that search" empty state.
  - **Error** — a focused error block with brand copy ("We couldn't reach the circle network. Try again?") plus a Retry button that re-triggers the fetch. Visually consistent with the rest of the page (uses the existing tokens).
- [ ] `ui-communities/src/pages/CommunityDetail.jsx` no longer imports `getCommunity` / `getCommunityMembers` from `mockData.js`. Instead it imports from `client.js` and fetches the community detail + members in parallel inside an effect. The People tab consumes the fetched member list; the Conversation tab continues to read posts from the mock data (kind-1 feed lands in Slice 6 — out of scope).
- [ ] CommunityDetail renders the same four states (loading / loaded / not found / error). The not-found surface (when `getCommunity` returns null) uses the existing "Circle not found" CTA back to Discover.
- [ ] `ui-communities/src/pages/Edit.jsx` swaps its `getCommunity` import to the API client. Slice 3 only changes the read path; the form continues to update local state on save (Slice 4 wires the publish path).

### Out-of-scope read paths (stays on mock data)

- [ ] **MyCircles** continues to import from `mockData.js` and filters against `joinedSet`. This is correct for Slice 3 because joined-set is React state (no auth yet); a server-side "my circles" endpoint would require knowing who "me" is, which is a Slice 4 concern. The mock-data import in this file is **intentional and documented inline** with a comment referencing this story.
- [ ] **Create** continues to import from `mockData.js` for the similar-circles step (which queries community names) and the founding-voices step (which surfaces a list of members the viewer trusts). A real similar-circles endpoint and a real member-search endpoint are out of scope for Slice 3. Inline comment with a forward reference.

### Loading / error visual quality

- [ ] The loading skeleton holds its layout at 375×812 mobile and at desktop widths. No content jump (CLS = 0) when fetched data replaces the skeleton.
- [ ] The error block uses `var(--danger)` for the heading + `var(--text-muted)` for the body + a `primary` Button for Retry. Brand-consistent; visually distinct from the empty state so the user can tell the difference.
- [ ] No raw `Error: fetch failed` strings reach the user. Error UI uses friendly copy; the technical details go to `console.error` for operator debugging.

### Regression

- [ ] All 25 Slice 0 source-regex tests in `test/communities-ui-scaffold.test.js` continue to pass. The mock-data file stays in place; the components just import differently. The "no mirror count rendered" / "Vouch + Raise a concern strings present" / etc. tests remain green.
- [ ] All 25 Slice 2 tests in `test/gr-community-scoring-and-api.test.js` continue to pass. No server-side code is touched by Slice 3.
- [ ] All 14 Slice 1 firmware tests pass. No firmware changes.
- [ ] `cd ui-communities && npm run build` succeeds. ESLint clean.
- [ ] The dev server still starts cleanly via the existing `communities-dev` preview entry.

### Visual verification (manual, via preview)

- [ ] In `VITE_USE_MOCK_DATA=true` mode (default dev), Discover renders the 8 mock communities identically to Slice 0 — same visual output, same content. The preview tool confirms no regression.
- [ ] In `VITE_USE_MOCK_DATA=false` mode (production build served by Vite preview), Discover renders the loading skeleton, then the "Nothing matches that search" empty state (because the real API on the test machine has no Docker stack and would 502 — that maps to the error UI, not the empty UI). The Retry button appears.

## Concepts touched

None at the concept-graph layer this slice. The UI consumes the REST contract from Slice 2; the contract abstracts over concept handles.

## Out of scope

- **NIP-07 sign-in.** Slice 4.
- **Write endpoints** (Join, Vouch, Raise a concern, Save your view). Slice 4.
- **MyCircles + Create migration to the API.** Stays on mock data; documented inline.
- **kind-1 read for the Conversation tab.** Slice 6.
- **Profile resolution for `voucherNames`.** Slice 2 NB-1 — empty array from the API stays empty in the UI until that decision lands.
- **API-level pagination.** The bounded scale doesn't require it.
- **Caching strategy beyond the existing 60s server-side TTL.** No client-side cache library added.
- **Service-worker / offline-first.** Not introduced; viewer must be online to fetch.
- **Animation polish on the loading skeleton beyond a single shimmer.** Subtle pulse is enough; richer motion is post-v1.

## Open questions

Resolved before story approval:

- **Mock-data fallback: implicit-on-empty or explicit toggle?** Explicit toggle. Implicit fallback would mask data-layer breakage in production. Documented in §"Mock-mode toggle".
- **Does the UI cache fetched data client-side?** Not in v1. The server-side 60s TTL is sufficient for the realistic visit pattern. Adding a client-side `react-query` or `SWR` is a separate ADR if/when needed.
- **What URL does the fetch hit in dev?** Relative origin (`/api/communities`) — the Vite dev proxy at `:5174` forwards `/api/*` to `localhost:8080`. Matches the existing pattern in `ui-communities/vite.config.js`. No hardcoded origin in `client.js`.
- **Where does `viewer` come from in Slice 3?** Always undefined. Slice 4 introduces NIP-07 and passes the viewer pubkey through. The API's TA-fallback handles the unauthenticated case server-side.

## Linked artifacts

- ADR: `engineering-team/decisions/0007-discover-swaps-mock-data-for-api.md` (filled in by Architect)
- Test plan: `engineering-team/stories/9-discover-swaps-mock-data-for-api.test-plan.md` (filled in by Tester)
- Review: `engineering-team/reviews/9-discover-swaps-mock-data-for-api.md` (filled in by Reviewer)
