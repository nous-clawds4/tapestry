# ADR 0035: Follows-hops path page + HOPS link activation

**Status:** Proposed
**Date:** 2026-06-17
**Story:** `engineering-team/stories/profile/39-profile-hops-path.md`

## Context

Story #39 builds the click-through page for the HOPS stat from #38 (ADR 0034) and activates the link. The page shows the hop count *and the actual shortest FOLLOWS path* from the source (logged-in viewer, else the Owner) to the viewed profile, as a vertical column of profile cards (pic, name, Owner-PoV rank), ordered source→target, with a re-roll button that swaps in a random one of the equally-short paths.

Established facts (verified against source on this branch, which has #38):

- **#38 endpoint** `GET /api/get-follows-hops` ([follows-hops.js](src/api/export/users/queries/follows-hops.js)) returns the hop **count** via `shortestPath … RETURN length(p)`. The pooled-driver helper `runCypher(cypher, params, txConfig)` ([neo4j-driver.js:53](src/lib/neo4j-driver.js)) takes an optional transaction-timeout config (added by ADR 0034). Auth middleware allows unauthenticated reads by default; gated paths are an allowlist matched by `path.includes(...)` ([auth.js:304](src/middleware/auth.js)).
- **Sibling list pages** are route objects in `createBrowserRouter` ([App.jsx:111-122](ui/src/App.jsx)) → `BrainstormFollows`/`BrainstormFollowers`/`BrainstormReporters`. The list-page convention ([BrainstormReporters.jsx](ui/src/pages/BrainstormReporters.jsx)): page chrome `bsp-page` / `bsp-top-bar` / `bsp-content` / `bsp-follows-header`; **pic/name from `/api/profiles?pubkeys=<csv>`** batched ≤50 ([:96](ui/src/pages/BrainstormReporters.jsx)); **rank = `Math.round(influence * 100)`** ([:115](ui/src/pages/BrainstormReporters.jsx)); avatar class `bsp-follows-avatar`; row click → `/user/<pubkey>`.
- **Owner-PoV influence** is a `NostrUser` node property (the owner GrapeRank pass writes `influence`/`average`/`confidence`/`input` onto nodes), so a path query over `nodes(p)` can return each node's `influence` directly — no extra round-trip for rank.
- `BrainstormProfile.jsx` (staging) renders the #38 HOPS stat as a **non-link** `<span className="bsp-count">` between Verified Followers and Verified Reporters.

No concept/schema change (additive) → **firmware reinstall N/A**. Concept Graph (`:8877`) unreachable (stale local stack — OPEN.md #6).

## Options considered

### Option A — One new endpoint returning up to N shortest paths; client renders one and re-rolls client-side *(chosen)*

`GET /api/get-follows-hops-paths?source=&target=` runs **one** `allShortestPaths` query (cap 20, `LIMIT N`) returning up to N equally-short paths, each as an ordered `[{pubkey, influence}]`. The page shows one path, derives the count from it, shows the re-roll button iff `paths.length > 1`, and re-rolls by picking a random index **client-side** (no re-query). Pic/name come from a batched `/api/profiles` call; rank = `Math.round(influence*100)`.

**Pros:** one round-trip for the whole feature; re-roll is instant and free (no repeated expensive query); count and path are inherently consistent (same query); reuses the `/api/profiles` + influence→rank conventions; `LIMIT N` + the `runCypher` timeout bound the cost.
**Cons:** the single up-front query is `allShortestPaths` (costlier than `shortestPath`); the random pick samples among the first N paths Neo4j returns, not a uniform draw over all of them; one new endpoint + a small payload of up to N paths.

### Option B — Fast first path (`shortestPath`) for display + lazy `allShortestPaths` only on first re-roll

Show one path fast via a `shortestPath`-returns-nodes endpoint (≈ #38 cost); fetch the all-paths set lazily only if the user clicks re-roll.
**Pros:** fast initial render even if `allShortestPaths` is slow; pays the expensive query only when needed.
**Cons:** two endpoints + two query shapes; the re-roll button's visibility needs the path count up front anyway (so we'd still pay something up front, or hide the button until the lazy fetch resolves — awkward UX). More moving parts. **Deferred fallback** if staging profiling shows Option A's up-front `allShortestPaths` is too slow.

### Option C — Server-side random path per re-roll

Each re-roll is a fresh server call returning a random shortest path.
**Cons:** re-runs the expensive `allShortestPaths` (or an `ORDER BY rand()`) on **every** re-roll — bad latency and DB cost. Rejected.

## Decision

**Option A.** One endpoint, one query, client-side re-roll. It is the simplest design that satisfies all ACs, keeps count/path consistent, makes re-roll instant, and bounds cost with `LIMIT` + a transaction timeout. If staging profiling shows the up-front `allShortestPaths` is too slow for common pairs, fall back to Option B (recorded above). This ADR does not change #38's `/api/get-follows-hops` contract; the stat keeps using it.

## Consequences

- **Enables** the path page and link activation; reuses #38's source rule, the `runCypher` timeout, and the list-page enrichment conventions.
- **`allShortestPaths` cost.** It can be materially more expensive than `shortestPath`, and the number of equally-short paths can blow up for highly-connected pairs. Mitigations: `LIMIT N` (Neo4j stops after N), a transaction **timeout** (~3 s; on timeout → `{success:false}` → "unavailable", never a false path), and the cap-20 bound. `truncated:true` is returned when ≥N paths exist so the UI can say "a random one of N+". **Validate on staging** (local graph is stale/near-empty — OPEN.md #6); if too slow, take Option B.
- **Re-roll fairness:** random among the first N returned shortest paths, not a uniform draw over all — acceptable per the story ("a random one"); documented, not hidden.
- **New public endpoint:** exposes only follow-path structure + already-public rank — no sensitive data. Must **not** be added to any auth gate (`get-follows-hops-paths` contains no gated substring).
- **Minimal new CSS** for the vertical card column (the sibling pages use a `DataTable`, not a card stack) — a small, bounded addition; reuse `bsp-follows-avatar` and page chrome.
- **Firmware reinstall:** No.

## Implementation notes

**Backend**

- **New** `src/api/export/users/queries/follows-hops-paths.js` — `handleGetFollowsHopsPaths(req, res)`:
  - read/validate `source`, `target` as 64-char lowercase hex → else `400 {success:false, error}` (mirror #38).
  - **self-view** (`source === target`): run `MATCH (a:NostrUser {pubkey:$src}) RETURN a.influence AS influence` and respond `{success:true, hops:0, paths:[[{pubkey:source, influence:<influence|null>}]], truncated:false}` (single card; if the node is absent, still return one card with `influence:null`).
  - else run, via `runCypher(CYPHER, {src,tgt}, { timeout: HOPS_PATHS_QUERY_TIMEOUT_MS })` (~3000 ms):
    ```cypher
    MATCH p = allShortestPaths((a:NostrUser {pubkey: $src})-[:FOLLOWS*..20]->(b:NostrUser {pubkey: $tgt}))
    RETURN [n IN nodes(p) | { pubkey: n.pubkey, influence: n.influence }] AS nodes
    LIMIT 25
    ```
    (cap `20` and `LIMIT 25` are **literals** — Neo4j can't parameterize var-length bounds; pubkeys are bound params.)
    - `rows.length === 0` → `{success:true, hops:null, paths:[]}` (∞).
    - else → `paths = rows.map(r => r.nodes)`; `hops = paths[0].length - 1`; `truncated = (rows.length === 25)`; respond `{success:true, hops, paths, truncated}`.
  - `catch` → `{success:false, error: err.message}`.
- `src/api/export/users/index.js` — re-export `handleGetFollowsHopsPaths`.
- `src/api/index.js` — register `app.get('/api/get-follows-hops-paths', users.handleGetFollowsHopsPaths)` near the other `users.*` routes. Do **not** add to any auth gate.

**Frontend**

- **New** `ui/src/hooks/useFollowsHopsPaths.js` — async, AbortController-scoped (mirror `useFollowsHops`): fetch `/api/get-follows-hops-paths?source=&target=`; return `{ hops, paths, truncated, noPath, loading, error }` where `noPath = success && paths.length === 0 && hops === null`.
- **New** `ui/src/pages/BrainstormFollowsHops.jsx` (mirror `BrainstormReporters` chrome):
  - `useParams()` → `pubkey` (target); `useAuth()` → `user`; `useConfig()` → `ownerPubkey`; `source = user?.pubkey || ownerPubkey`.
  - `useFollowsHopsPaths(source, pubkey)`.
  - `selectedIndex` state (default 0). **Re-roll** button → set a random index in `[0, paths.length)` (prefer ≠ current); render iff `paths.length > 1`.
  - **Enrich**: gather unique pubkeys across all returned paths, batch `/api/profiles?pubkeys=<csv>` (≤50/chunk, as BrainstormReporters does); `name = display_name||name||shortNpub`, `picture`; `rank = influence == null ? null : Math.round(influence*100)`.
  - **Render**: a header (back-link to `/user/:pubkey`, title e.g. "Follow hops"); a count line consistent with #38's tooltip copy (`"<target> is N hop(s) away from <source> by follows."` / `"There is no follow path from <source> to <target>."` / self-view `0`); the selected path as a vertical column of cards (each card a `<Link to={/user/<pubkey>}>` with avatar + name + rank); the re-roll button; loading/error/no-path/self-view states (reuse `bsp-follows-skeleton`/`bsp-trust-unavailable`/`bsp-empty` patterns).
- `ui/src/App.jsx` — import `BrainstormFollowsHops`; add route `{ path: '/user/:pubkey/follows-hops', element: <BrainstormFollowsHops /> }` next to the sibling routes ([:111-122](ui/src/App.jsx)).
- `ui/src/pages/BrainstormProfile.jsx` — **activate the link**: change the #38 HOPS `<span className="bsp-count …">` to `<Link to={`/user/${pubkey}/follows-hops`} className={`bsp-count bsp-count-link${followsHopsLoading ? ' bsp-count-loading' : ''}`} title={hopsTitle}>` … `</Link>` — a link in **all** states (finite/0/∞); keep the value + tooltip.
- `ui/src/styles.css` — add minimal classes for the path-card column (e.g. `.bsp-hops-path`, `.bsp-hops-card`, `.bsp-hops-card-rank`), reusing `.bsp-follows-avatar`.

## Out of scope
- Changing #38's `/api/get-follows-hops` count contract.
- Listing all paths at once / pagination (one path + re-roll only).
- Uniform sampling over *all* shortest paths when there are more than `N` (we sample among the first N; `truncated` flags it).
- A fast-first-path split (Option B) unless staging profiling forces it.
- The two-"Hops" PoV reconciliation (OPEN.md #7).
