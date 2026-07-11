# ADR 0034: Follows-hops to this profile

**Status:** Proposed
**Date:** 2026-06-17
**Story:** `engineering-team/stories/profile/38-profile-follows-hops.md`

## Context

Story #38 (profile epic) adds a **HOPS** stat to the profile counts row — the directed `FOLLOWS` shortest-path distance from a *source* pubkey to the viewed profile. Source = the logged-in user, or, when logged out, the instance **Owner** (`BRAINSTORM_OWNER_PUBKEY`), explicitly **not** the House PoV. The value is computed **live** on every view (no precomputed `NostrUser.hops`, no reconciliation with the existing "Degrees of separation" card). Hop cap = **20**. The result has **three distinct display states**: a number N (incl. `0` for self-view), **∞** for a confirmed no-path-within-cap, and a non-misleading **unavailable** state for a lookup error/timeout. The stat must load **asynchronously** (never block the page) and render **present-but-not-clickable** (the destination page is deferred).

Established facts from investigation (verified against source):

- **Driver/helper.** `runCypher(cypher, params)` ([src/lib/neo4j-driver.js:53](src/lib/neo4j-driver.js)) is a pooled, READ-mode Bolt helper that returns plain rows with Neo4j `Integer`→JS `number` conversion. It does **not** currently expose a per-query timeout.
- **Cypher precedent.** The only native `shortestPath` over `FOLLOWS` is `checkOwnerReachable()` ([initializeScorecards.js:66](src/algos/customers/personalizedGrapeRank/initializeScorecards.js:66)): `MATCH p = shortestPath((c:NostrUser {pubkey:'…'})-[:FOLLOWS*..N]->(o:NostrUser {pubkey:'…'})) RETURN length(p) AS hops`. It string-interpolates pubkeys (injection smell), runs via per-request `cypher-shell`/`execSync` with a 30 s timeout — all of which we improve on here.
- **Cypher semantics (critical).** A variable-length pattern `[:FOLLOWS*..20]` has an **implicit lower bound of 1**. So for `source == target` the query looks for a *cycle* and returns no row — it does **not** return `0`. Self-view must be handled outside the query.
- **`runCypher` return shapes** for this query: `[{ hops: <int 1..20> }]` when a path exists; `[]` when none within the cap.
- **Auth.** `authMiddleware` ([src/middleware/auth.js:304](src/middleware/auth.js:304)) allows unauthenticated reads by default — only `writeEndpoints` / `protectedGetEndpoints` are blocked for anonymous callers ([auth.js:484-489](src/middleware/auth.js:484)); authenticated non-owner/non-customer users fall through to `next()` ([auth.js:427](src/middleware/auth.js:427)). Gating matches by `path.includes(...)`. A new `GET /api/get-follows-hops` is public for everyone and matches **no** gated substring (notably not `/calculate-hops`).
- **Frontend.** The counts row is `.bsp-counts` in [BrainstormProfile.jsx:257](ui/src/pages/BrainstormProfile.jsx) (Following / Verified Followers / Verified Reporters). The three values come from `useUserCounts(pubkey)` ([useUserCounts.js](ui/src/hooks/useUserCounts.js)), an `AbortController`-based async hook. The page already has `useAuth().user` ([:82](ui/src/pages/BrainstormProfile.jsx)) and `nip19` ([:3](ui/src/pages/BrainstormProfile.jsx)); it does **not** yet import `useConfig` (needed for `ownerPubkey`). The Verified Reporters else-branch is the present-but-inactive `<span className="bsp-count">` precedent; trust cards use native `title=` tooltips.

Concepts touched (additive, no schema change): **NostrUser** (source & target nodes), **FOLLOWS** (the traversed edge), **Owner** (`BRAINSTORM_OWNER_PUBKEY`). The Concept Graph API (`:8877`) was unreachable (stale local stack — OPEN.md #6); no concept/firmware change is involved, so handle resolution is not load-bearing.

## Options considered

### Option A — Dedicated public read endpoint + parameterized `shortestPath` via the pooled driver, with a self-view short-circuit and a 3-state contract *(chosen)*

A new `GET /api/get-follows-hops?source=&target=` handler that:
1. validates both pubkeys (64-char hex) → `400 {success:false,error}` if missing/malformed;
2. short-circuits `source === target` → `{success:true, hops:0}` (no query);
3. otherwise runs, via an extended `runCypher` with a transaction **timeout**:
   ```cypher
   MATCH p = shortestPath((a:NostrUser {pubkey: $src})-[:FOLLOWS*..20]->(b:NostrUser {pubkey: $tgt}))
   RETURN length(p) AS hops
   ```
   (pubkeys are **bound params**; the `*..20` upper bound is a hardcoded literal because Neo4j does not allow parameterizing variable-length bounds — and 20 is not user input).

Response contract — three states:
- `{ success: true, hops: <int 0..20> }` — path found (incl. self-view `0`).
- `{ success: true, hops: null }` — confirmed no path within cap → frontend renders **∞**.
- `{ success: false, error: "…" }` — bad input / lookup error / timeout → frontend renders **unavailable** (`—`).

Frontend: a dedicated async hook `useFollowsHops(source, target)` (mirrors `useUserCounts`) and a non-link `<span className="bsp-count">` inserted between Verified Followers and Verified Reporters.

**Pros:** public for logged-out viewers (the core requirement) with zero auth wiring; parameterized (no injection on user input); cleanly expresses the three required states; reuses the established pooled-driver + async-hook patterns; the endpoint is reusable by the deferred click-through page.
**Cons:** adds a small backward-compatible change to the shared `runCypher`; one live DB traversal per profile view (no cache); at cap 20 a far/disconnected pair from a highly-connected source can be expensive (see Consequences).

### Option B — Call the existing generic `POST /api/neo4j/query` runner from the frontend

Pass the `shortestPath` Cypher straight to the generic runner ([queryPost.js](src/api/neo4j/queryPost.js)).
**Pros:** no new endpoint.
**Cons:** **disqualifying** — that route is in `customerOrOwnerEndpoints` ([auth.js:343](src/middleware/auth.js:343)), so it 403s for logged-out viewers, breaking the primary use case; it ships raw Cypher from the client (abuse/injection surface); and it couples the UI to the DB query shape. Rejected.

### Option C — Dedicated endpoint, but compute via the `cypher-shell`/`execSync` precedent

Mirror `checkOwnerReachable()` / `hops-count.js` ([hops-count.js:45](src/api/algos/hops/queries/hops-count.js)): build a `cypher-shell` string and `exec` it.
**Pros:** matches an existing in-repo pattern.
**Cons:** a process fork per request is a poor fit for request latency; string-interpolated pubkeys are an injection vector; the precedent's 30 s timeout is wrong for a view. The pooled Bolt driver (Option A) is strictly better and is what the requester asked for. Rejected.

## Decision

We chose **Option A**. It is the only option that satisfies the must-work-logged-out requirement without auth changes, expresses the three display states cleanly, parameterizes user input, and reuses the project's current pooled-driver + async-hook conventions. The self-view short-circuit is required because `[:FOLLOWS*..20]` cannot itself yield `0`.

This ADR does **not** supersede ADR 0031 (verified counts, Owner-PoV precomputed). By design this feature uses an independent live data path and does not reconcile with it.

## Consequences

- **Enables** the HOPS stat and gives the future `/follows-hops` click-through page a ready data source.
- **Live, uncached** per view. Typical/near distances are cheap (`shortestPath` is bidirectional BFS). The honest risk: at **cap 20**, determining a number for a *far-but-connected* pair, or confirming **∞** for a disconnected target whose both endpoints have large reachable sets, can exceed the query **timeout** and therefore surface as **unavailable (`—`)** rather than ∞. (Disconnected targets in small components terminate fast, so this is bounded, not universal.) This is inherent to live uncached shortest-path at a high cap on the ~32M-edge graph and is the requester's deliberate trade for not excluding far pairs. **Validate frequency on staging** (≈ prod scale; local is stale/near-empty — OPEN.md #6). Mitigations if needed — caching, a lower cap, or a longer timeout — are **deferred** (story-scoped out).
- **Shared helper change:** `runCypher` gains an optional third arg (transaction config) — backward compatible; existing callers unaffected.
- **New public endpoint:** it exposes only follow-graph *distance*, derived from already-public follow data — no sensitive data. It does run an unauthenticated DB traversal; the **cap + timeout bound** the per-call cost. If abuse becomes a concern, rate-limiting/caching can be added later (noted, not done here).
- **Follow-ups / debt:** the deferred destination page + link activation (planned story); an optional request/short-TTL cache pending staging profiling; optional enrichment of the *source* name in the tooltip (the Owner's display name is not loaded on the page today, so the source falls back to a shortened npub).
- **Firmware reinstall required?** **No** — no concept/schema change.

## Implementation notes

**Backend**

- `src/lib/neo4j-driver.js` — extend `runCypher(cypher, params = {}, txConfig)` to pass an optional third arg through to `session.run(cypher, params, txConfig)`. Backward compatible (omitted → current behavior). The handler passes `{ timeout: HOPS_QUERY_TIMEOUT_MS }` (recommend ~2500 ms). Confirm the installed `neo4j-driver` accepts `timeout` as a number of ms in `transactionConfig`; if it needs a Duration/`int()` wrapper, adapt. *Fallback if the txConfig timeout proves finicky:* wrap the call in a `Promise.race` with a JS timer (bounds client latency but does not cancel the server-side query — prefer the real transaction timeout).
- **New** `src/api/export/users/queries/follows-hops.js` — `handleGetFollowsHops(req, res)`:
  - read `source`, `target` from `req.query`; validate both are 64-char lowercase hex → else `res.status(400).json({success:false, error})`.
  - if `source === target` → `res.json({success:true, hops:0})`.
  - else `const rows = await runCypher(CYPHER, { src: source, tgt: target }, { timeout: HOPS_QUERY_TIMEOUT_MS })` inside try/catch:
    - `rows.length === 1` → `res.json({success:true, hops: rows[0].hops})`.
    - `rows.length === 0` → `res.json({success:true, hops: null})`.
    - catch → `console.warn(...)` + `res.json({success:false, error: err.message})`.
  - `CYPHER` = the parameterized query above with the literal `*..20`.
- `src/api/export/users/index.js` — re-export `handleGetFollowsHops` (mirror `handleGetUserCounts`).
- `src/api/index.js` — register `app.get('/api/get-follows-hops', users.handleGetFollowsHops);` near the other `users.*` routes (`get-user-counts` is at ~[:199](src/api/index.js)). `users = require('./export/users')`. **Do not** name it with a gated substring (avoid `/calculate-hops`, `/neo4j`, `/get-customer`, `/normalize`). `get-follows-hops` is clear.

**Frontend**

- **New** `ui/src/hooks/useFollowsHops.js` — async hook mirroring `useUserCounts`: no fetch unless both `source` and `target` are set; `AbortController`; fetch `/api/get-follows-hops?source=${source}&target=${target}`; map the response to `{ hops, noPath, loading, error }` where `hops` = number|null, `noPath` = `true` iff `success && hops === null`, `error` = string|null (fetch failure or `success:false`). Re-run on `[source, target]`.
- `ui/src/pages/BrainstormProfile.jsx`:
  - add `import { useConfig } from '../context/ConfigContext';` (confirm the exact export name) and `import useFollowsHops from '../hooks/useFollowsHops';`.
  - `const { ownerPubkey } = useConfig();` and `const hopsSource = user?.pubkey || ownerPubkey;`
  - `const { hops, noPath, loading: hopsLoading, error: hopsError } = useFollowsHops(hopsSource, pubkey);`
  - between the Verified Followers `</Link>` ([:267](ui/src/pages/BrainstormProfile.jsx)) and the Verified Reporters comment ([:268](ui/src/pages/BrainstormProfile.jsx)), render a **non-link**:
    ```jsx
    <span className={`bsp-count${hopsLoading ? ' bsp-count-loading' : ''}`} title={hopsTitle}>
      <span className="bsp-count-value">{hopsDisplay}</span>
      <span className="bsp-count-label">Hops</span>
    </span>
    ```
    (CSS uppercases `.bsp-count-label`, matching the sibling "Following" markup; renders as **HOPS**.)
  - small inline helpers:
    - `hopsDisplay`: `hopsError` → `'—'`; else `hopsLoading && hops == null && !noPath` → `'—'`; else `noPath` → `'∞'`; else `String(hops)`.
    - `hopsTitle`: `hopsError` → `'Hop distance unavailable.'`; `noPath` → `` `There is no follow path from ${sourceName} to ${targetName}.` ``; number → `` `${targetName} is ${hops} hop${hops === 1 ? '' : 's'} away from ${sourceName} by follows.` ``.
    - `targetName` = the page's `displayName`. `sourceName` = if `hopsSource === user?.pubkey` use the logged-in user's display name (from `user.profile`) when present else a shortened npub; for the Owner case use a shortened npub (`nip19.npubEncode(hopsSource).slice(0, 12) + '…'`) — **no extra fetch** for the source name (see Consequences).
- **No CSS change** — reuses `.bsp-count`, `.bsp-count-value`, `.bsp-count-label`, `.bsp-count-loading`.

## Out of scope

- The `/follows-hops` destination page and activating the link (deferred story).
- Any caching / short-TTL layer (revisit after staging profiling).
- Neo4j GDS and in-memory projections.
- Rate-limiting the endpoint (note only).
- Reconciling with the precomputed "Degrees of separation" figure.
