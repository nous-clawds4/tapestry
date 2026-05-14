# ADR 0007: `ui-communities/` API client layering + mock-mode toggle

**Status:** Accepted
**Date:** 2026-05-14
**Story:** `engineering-team/stories/9-discover-swaps-mock-data-for-api.md`

## Context

Story #9 swaps `Discover.jsx`, `CommunityDetail.jsx`, and `Edit.jsx` from direct `mockData.js` imports to API fetches against the Slice 2 endpoints. Two questions to settle:

1. **Where does the API call live?** Inline in each page component? In a shared module? In a hook?
2. **How does local dev stay populated when the API is empty?** A build-time mode toggle? A runtime fallback? A separate dev-server proxy target?

Relevant facts:

- The Slice 2 endpoints (`GET /api/communities`, `/:slug`, `/:slug/members`) currently return `{ communities: [] }` because their data-source layer is stubbed (Slice 2 NB-4). Until that lands, "real mode" answers empty.
- `ui-communities/vite.config.js:11-19` already proxies `/api/*` to `http://localhost:8080` in dev. The relative-origin fetch pattern works in both dev and prod without per-environment URL configuration.
- `ui-communities/` is a parallel Vite app with its own `package.json` deps (React 19, Vite 7, React Router 7 — no fetch library beyond the browser's built-in `fetch`).
- Vite's static replacement of `import.meta.env.VITE_*` happens at build time. `if (import.meta.env.VITE_USE_MOCK_DATA) { ... }` becomes `if (true) { ... }` or `if (false) { ... }` in the production bundle; the dead branch tree-shakes out cleanly.
- The Slice 0 mock dataset (`src/data/mockData.js`) is the single source of truth for the eight curated example communities. Slice 3 doesn't change this file — it's read by the API client in mock mode and by MyCircles + Create directly (the two pages that intentionally stay on mock data per the story).
- No client-side state library (`react-query`, `SWR`, etc.) is in scope. The realistic load profile is "user opens Discover, fetches the list once, navigates around" — a few useState + useEffect hooks suffice.

Constraints we must honor:

- **No new dependencies** beyond what `ui-communities/package.json` already has (CLAUDE.md house rule).
- **The Slice 0 visual quality bar must hold** — loading and error states need real motion, real spacing, brand-consistent type.
- **Tests pin the substrate** — Slice 0's source-regex tests assert things like "no `Independent hosts` ships" and "Vouch/Raise a concern strings are present." Slice 3 changes how components get their data but must not change which strings/glyphs ship.

## Options considered

### Option A — Single `client.js` module + build-time mode toggle (chosen)

1. **`ui-communities/src/api/client.js`** exports three async functions: `getCommunities`, `getCommunity`, `getCommunityMembers`. The mode (mock vs real) is decided once at module load via `const USE_MOCK = !!import.meta.env.VITE_USE_MOCK_DATA;`. In mock mode each function returns `Promise.resolve(<projection of mockData.js>)`. In real mode each function issues `fetch('/api/communities...')`.
2. **Mock projections are derived once at module-load time.** `client.js` imports `mockData.js` and synthesizes the list-entry / detail-entry / member-entry shapes that the API would emit. Keeps the mock-mode shape identical to the real-mode response so consumer code is mode-agnostic.
3. **Pages use plain React hooks** (`useState` + `useEffect`) — no new dependency, no abstraction beyond what they already have. Each page that fetches has its own loading/error state.
4. **Loading and error states live inside the page components**, not the client. The client is pure I/O — it fetches or it throws. Pages render their own loading skeletons + error blocks; this keeps surface-level UX decisions where they belong (in the page, not in shared infrastructure).
5. **`.env.development` sets `VITE_USE_MOCK_DATA=true`**, `.env.production` sets it to `false`. `.env.local` (developer override) is gitignored — already in the existing `.gitignore` pattern at `ui-communities/.gitignore` if present, or covered by the root `.gitignore`'s `.env.local` line.
6. **Loading skeleton** is a new `CardSkeleton` component (rendered N times for the grid) that mirrors the layout of `CommunityCard` with shimmer animation via `@keyframes`. No new library.
7. **Error block** is rendered inline in each page that fetches. Uses the existing `Button` primitive for Retry. The error UI is brand-consistent — terracotta heading on `var(--danger)` is wrong palette; we'll use a softened version (the existing `--danger-muted`) so it doesn't shout, and the Retry button is the primary action.

**Pros:**
- One file owns the mode decision. Easy to reason about, easy to test.
- Mock-mode shape is identical to real-mode shape, so page components are oblivious to which mode they're in. No "switch on env var in each page" anti-pattern.
- Production bundles tree-shake the mock data away when `VITE_USE_MOCK_DATA=false`.
- No new dependencies.

**Cons:**
- The mock projections live next to the real fetch implementations — slight coupling. Mitigated by the fact that both are tiny and both share the response shape contract.

### Option B — Per-page custom hooks (`useCommunities`, `useCommunity`, `useCommunityMembers`)

A `ui-communities/src/api/hooks.js` exports React hooks that encapsulate `useState` + `useEffect` + the fetch. Pages call `const { data, loading, error } = useCommunities()`.

**Pros:**
- Pages get cleaner — no manually-tracked loading/error state.
- Hook abstraction is idiomatic React.

**Cons (why rejected):**
- Adds a layer of indirection that buys little at three call sites. Three pages, three hooks — the duplication-saved is tiny.
- The hooks would need to handle the mock-mode toggle too, which means the mode decision lives in two places (client + hooks) instead of one.
- Locks Slice 3 into a hook-centric pattern before we know what the right shape is. Slice 4 + 6 will introduce mutations; better to settle on a hook pattern then when we know what mutations need.

Revisit when there are 6+ call sites and a real reason to factor a hook layer.

### Option C — `react-query` (or `SWR` or similar) + `QueryClient` at the app root

Add a state-management library that handles fetching, caching, retries, deduplication, optimistic updates, etc.

**Pros:**
- Industrial-strength solution. Handles edge cases (background refetch, focus refetch, stale-while-revalidate) we'll eventually want.

**Cons (why rejected):**
- New dependency. CLAUDE.md house rule pushes against adding tooling without an ADR; this would be the ADR, but the value isn't there yet for three read endpoints with no caching needs.
- Premature. The realistic load profile doesn't justify it. Adding it now means carrying its mental + bundle cost from day one.
- Revisit when (a) we have 10+ call sites with real coordination needs, or (b) Slice 4 mutations + optimistic updates make the manual approach painful.

## Decision

We chose **Option A**.

The mock-mode toggle is the load-bearing decision; everything else falls out of it. Locating it in a single module (`client.js`) makes the mode obvious and the production bundle clean. Page components stay simple — three states (loading / loaded / error) tracked with two `useState` calls each.

We trade away: a future-flex hook layer (Option B) and a robust query library (Option C). Both can land later without rewriting the page components, because the client module gives us a stable API shape to swap out.

## Consequences

- **Enables:** Slice 3 ships fast. Slice 4 mutations slot in by adding `postEndorsement` etc. to the same `client.js`.
- **Constrains:** The mock projections in `client.js` need to stay in sync with the API response shape. If the API surface changes (Slice 4 adds fields, etc.), the mock projections must be updated. Mitigated by the fact that both files live in the same repo and PRs touching the API will surface the mismatch via the test suite.
- **New debt:** None significant. The `react-query` adoption story (if/when needed) is a clean separate decision.
- **Firmware reinstall?** No.

## Implementation notes

### Files & layout (new in `ui-communities/`)

```
src/api/
├── client.js              — getCommunities / getCommunity / getCommunityMembers + mock projections + mode toggle

src/components/
├── CardSkeleton.jsx       — loading-state placeholder for community cards
├── CardSkeleton.module.css
├── FetchError.jsx         — error state with brand copy + Retry
├── FetchError.module.css
```

`.env.development`, `.env.production` at the `ui-communities/` root.

### `ui-communities/src/api/client.js` shape

```js
import {
  communities as MOCK_COMMUNITIES,
  members as MOCK_MEMBERS,
  getCommunity as mockGetCommunity,
  getCommunityMembers as mockGetCommunityMembers,
  getVoucherNames as mockGetVoucherNames,
} from '../data/mockData.js'

const USE_MOCK = !!import.meta.env.VITE_USE_MOCK_DATA

// Mock projections — same shape as the real API response.
function projectListEntry(c) { /* slug, name, description, tags, ... */ }
function projectDetailEntry(c) { /* ...listEntry + founder, relays, ..., posts: [] */ }
function projectMemberEntries(slug) { /* { pubkey, score, isMember, vouchedBy, voucherNames } */ }

async function realGet(path) {
  const resp = await fetch(path, { credentials: 'same-origin' })
  if (resp.status === 404) return { _notFound: true }
  if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`)
  return resp.json()
}

export async function getCommunities(viewer) {
  if (USE_MOCK) return MOCK_COMMUNITIES.map(projectListEntry)
  const qs = viewer ? `?viewer=${encodeURIComponent(viewer)}` : ''
  const body = await realGet(`/api/communities${qs}`)
  return body && Array.isArray(body.communities) ? body.communities : []
}

export async function getCommunity(slug, viewer) {
  if (USE_MOCK) {
    const c = mockGetCommunity(slug)
    return c ? projectDetailEntry(c) : null
  }
  const qs = viewer ? `?viewer=${encodeURIComponent(viewer)}` : ''
  const body = await realGet(`/api/communities/${encodeURIComponent(slug)}${qs}`)
  if (body._notFound) return null
  return body && body.community ? body.community : null
}

export async function getCommunityMembers(slug, viewer) {
  if (USE_MOCK) return projectMemberEntries(slug)
  const qs = viewer ? `?viewer=${encodeURIComponent(viewer)}` : ''
  const body = await realGet(`/api/communities/${encodeURIComponent(slug)}/members${qs}`)
  return body && Array.isArray(body.members) ? body.members : []
}
```

The `_notFound` sentinel pattern keeps the contract clean: `realGet` returns it for 404s; callers check the marker and resolve to `null`. Avoids special-casing 404 vs other errors in two places.

### Page wiring

**`Discover.jsx`:**

```jsx
const [state, setState] = useState({ status: 'loading', communities: [], error: null })

useEffect(() => {
  let cancelled = false
  setState(s => ({ ...s, status: 'loading' }))
  getCommunities(null /* viewer wired in Slice 4 */)
    .then(communities => { if (!cancelled) setState({ status: 'ready', communities, error: null }) })
    .catch(error => { if (!cancelled) setState({ status: 'error', communities: [], error }) })
  return () => { cancelled = true }
}, [/* retryNonce */])
```

Then in render: `status === 'loading'` → skeleton grid; `'error'` → `<FetchError onRetry={triggerRetry} />`; `'ready'` → existing card grid (uses `state.communities` instead of the prior import).

**`CommunityDetail.jsx`:** fetches both `getCommunity(slug)` and `getCommunityMembers(slug)` in parallel via `Promise.all`. Renders loading state for both; if `getCommunity` resolves to null, render the NotFound surface; else render the existing layout. The People tab consumes `state.members` from the fetched roster (instead of `getCommunityMembers` from mockData).

**`Edit.jsx`:** same pattern as `CommunityDetail` but only fetches the community detail (no members needed for Edit).

**`MyCircles.jsx`** and **`Create.jsx`** stay unchanged — they continue to import from `mockData.js`. Add an inline comment in each referencing this ADR + story #9.

### CardSkeleton

```jsx
function CardSkeleton({ delay = 0 }) {
  return <div className={s.skeleton} style={{ animationDelay: `${delay}ms` }} aria-hidden />
}
```

CSS: `background: linear-gradient(90deg, var(--bg-elevated) 0%, var(--bg-hover) 50%, var(--bg-elevated) 100%)` with `background-size: 200% 100%` and a `@keyframes shimmer` that translates `background-position` from `100% 0` to `-100% 0`. Height matches a real card; border-radius matches; the accent bar at top is a thin colored placeholder. **No content jumps when the real cards replace skeletons** (verified by hand at the matching breakpoints).

Discover renders 8 skeletons (matches the mock dataset size — the real API might return more or fewer, but 8 is a reasonable visual placeholder).

### FetchError

```jsx
function FetchError({ onRetry, message }) {
  return (
    <div className={s.block} role="alert">
      <h2 className={s.title}>We couldn't reach the circle network.</h2>
      <p className={s.copy}>{message || 'Check your connection and try again.'}</p>
      <Button variant="primary" onClick={onRetry}>Retry</Button>
    </div>
  )
}
```

Tokens: title in `--text` on transparent bg; copy in `--text-muted`; surrounded by a `--danger-muted` left border to flag distinctness from the empty state without shouting.

### Tree-shaking verification

After `npm run build` with `VITE_USE_MOCK_DATA=false`, inspect the production bundle:

```bash
grep -c 'The Listening Room' dist-communities/assets/index-*.js
# Expect: 0 (mock community names are gone)
```

If non-zero, the toggle isn't tree-shaking properly — likely the `if (USE_MOCK)` branch isn't being recognized as dead code. The fix is usually to move the `USE_MOCK` constant out of conditional positions (e.g. compute it once, branch on it once at module export time):

```js
const realImpl = { getCommunities: realGetCommunities, ... }
const mockImpl = { getCommunities: () => Promise.resolve(MOCK_LIST), ... }
const impl = USE_MOCK ? mockImpl : realImpl
export const { getCommunities, getCommunity, getCommunityMembers } = impl
```

The verification test (in the Tester's phase) greps the built bundle.

### Tests

Tester writes a Node-runner suite that:
- T1–T3: `client.js` exports the three named functions
- T4: client uses relative-origin URLs (no `http://localhost` or `https://` in fetch calls)
- T5: viewer parameter, when present, is URL-encoded into the query string
- T6: `getCommunity` resolves null on 404 (mocked fetch response with status=404)
- T7: non-2xx throws Error (mocked fetch response with status=500)
- T8: mock mode returns Promise-wrapped mock data when `VITE_USE_MOCK_DATA` toggle is on
- T9: pages no longer import directly from `'../data/mockData'` (Discover, CommunityDetail, Edit) — but MyCircles and Create do
- T10: `.env.development` and `.env.production` files exist with the right `VITE_USE_MOCK_DATA` values
- T11: CardSkeleton + FetchError component files exist with the expected exports
- T12: Discover renders 3 states (loading / error / ready); source-grep for `status === 'loading'`, `'error'`, `'ready'`
- T13: production build (when run separately) does not contain the literal "The Listening Room" mock community name — verified by reading `dist-communities/assets/index-*.js`

Test 13 requires building the app, which is slow. Run as a separate verification step (or skip in CI if needed); the source-regex tests above cover the structural pieces.

## Out of scope

- **`react-query` adoption** — Option C, deferred.
- **Custom hook factoring** — Option B, deferred.
- **Client-side caching beyond the per-page-mount fetch** — none.
- **Service-worker / offline-first** — none.
- **Profile resolution for voucher names** — Slice 2 NB-1; the API returns `voucherNames: []` so the UI shows the count-only form ("12 people vouch").
- **Network panel telemetry** — staging smoke verifies the real fetches happen.
