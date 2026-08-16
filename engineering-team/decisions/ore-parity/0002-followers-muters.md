# ADR 0002: ORE-06/07 followers & muters — twin inbound endpoints over the verified line

**Status:** Accepted
**Date:** 2026-08-16
**Story:** `engineering-team/stories/ore-parity/2-followers-muters.md`

## Context

The story adds **ORE-06 `POST /followers`** and **ORE-07 `POST /muters`** (both optional in the
upstream spec, both served by the NosFabrica instances; npub.world lights up Followers), global
`graperank` only, registered in the ORE-01 capability document. Acceptance criteria, restated:
capability doc gains both endpoints (default = global `graperank`) and still passes the SDK's
`validateCapabilities()`; happy path returns `{ results: [{pubkey, rank}], total }` where
`results` are the target's **verified** followers/muters ranked by their own global GrapeRank
(`round(influence × 100)`), sorted descending, ≤ `limit`; `total` = verified-set cardinality
independent of truncation; no `ttl`; sensible default `limit`, over-provider-max → `422` (spec
06/07 semantics, unlike ORE-03's clamp), non-positive → `422`; unknown target → `200` +
`results: []` + `total: 0` (deliberate non-use of the spec's optional 404); ORE-00/01
conventions; additive/isolated.

**No concepts touched**; no firmware reinstall.

Grounding facts (verified in-repo):

- **The verified line already exists, per edge type.** `cypherQueries.js:43-56` (followers) and
  `:79-87` (muters): inbound `(x:NostrUser)-[:FOLLOWS|MUTES]->(observee)` filtered by
  `x.influence > <cutoff>` — with **separate config vars**:
  `VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF` and `VERIFIED_MUTERS_INFLUENCE_CUTOFF` (defaults 0.05,
  `/etc/graperank.conf`). `mutersWithMetrics.js:90-92` records the invariant this preserves:
  same edge + same cutoff ⇒ list agrees with the `verified*Count` node properties ORE-02
  reports (modulo batch-recompute drift, see Option C).
- **Existing list endpoints are the wrong shape to reuse.** `followersWithMetrics.js` /
  `mutersWithMetrics.js` (ADR 0030 lineage) materialize the **whole** verified set per request
  (client-side paging), open their own driver/session per call, and return profile metrics ORE
  doesn't carry. Precedent for cost, not a call target.
- **Per-query deadline convention:** `NEO4J_QUERY_TIMEOUT_MS` (default 15000,
  `followersWithMetrics.js:84`) passed as a transaction config; `runCypher(cypher, params,
  txConfig)` already forwards it (`src/lib/neo4j-driver.js`).
- **Module pattern** (ADR open-ranking/0001, reused by ore-parity/0001): registry-driven
  capability doc + `resolveAlgorithm`; pure builders returning `{httpStatus, headers, body}`
  triples; deps injection; thin wrappers; `ORE_PATHS`-scoped JSON-error middleware; ORE-00
  helpers in `shared.js`.
- **Sibling observation** (story Background): NosFabrica serves `{results, total, ttl}` with
  float ranks and 200-for-unknown. Spec-legal either way; we keep our integer scale, no-`ttl`
  (ADR open-ranking/0004), and the story's no-404 posture.

## Options considered

### Option A — Twin endpoints in one module: shared pure builder, one dep, two bounded statements *(chosen)*

New `src/api/open-ranking/inbound.js`: a single pure `buildInbound(input, deps, cfg)` where
`cfg` fixes `{ endpointPath: '/followers'|'/muters' }`, exported as `buildFollowers`/`buildMuters`
bindings plus `handleFollowers`/`handleMuters` wrappers. One injected dep:

    deps.fetchVerifiedInbound(edge, pubkey, limit) -> Promise<{ rows: [{pubkey, influence}], total }>

whose real implementation runs **two parameterized statements** via `runCypher`, both under
`txConfig { timeout: NEO4J_QUERY_TIMEOUT_MS }`, with the cutoff bound as `$cutoff` (the
mutersWithMetrics "safer form"), edge chosen from a whitelist (never interpolated from input):

```cypher
MATCH (t:NostrUser {pubkey: $pubkey})
MATCH (x:NostrUser)-[:FOLLOWS]->(t)          -- or [:MUTES]
WHERE x.influence > $cutoff
RETURN x.pubkey AS pubkey, x.influence AS influence
ORDER BY x.influence DESC, x.pubkey ASC
LIMIT $limit
```
```cypher
MATCH (t:NostrUser {pubkey: $pubkey})
MATCH (x:NostrUser)-[:FOLLOWS]->(t)
WHERE x.influence > $cutoff
RETURN count(x) AS total
```

An unknown target makes both `MATCH`es produce zero rows → `{rows: [], total: 0}` → the story's
200-empty answer with no special-casing. Top-N never materializes the 20k-row verified set the
existing list endpoints haul; the count is a pure aggregate over the same filter.

- **Pros:** twins stay literally one code path (the story's "identical contract" is enforced by
  construction); every module convention reused; bounded cost (`LIMIT` + aggregate + deadline);
  per-edge cutoffs read inside the real dep so the builder stays hermetic; deterministic order.
- **Cons:** two Neo4j round trips per request (list + count); a third place expressing the
  verified-inbound filter (after cypherQueries.js and the *WithMetrics modules).

### Option B — Reuse `followersWithMetrics` / `mutersWithMetrics` internally

- **Pros:** zero new Cypher; single expression of the verified filter.
- **Cons:** whole-set materialization per request (~20k rows for large accounts) to serve a
  top-50 answer; per-call driver construction; ORE would inherit an `/api` surface's shape and
  error semantics it doesn't want. Rejected on cost and coupling.

### Option C — `total` from the batch-written `verified*Count` node properties

- **Pros:** one statement per request; numerically identical to ORE-02's counts.
- **Cons:** the list comes from a live scan while `total` would come from the last batch run —
  a single response could contradict itself (e.g., `total` below the number of rows returned).
  Self-consistency inside one response beats cross-endpoint equality; the drift vs `/stats/pubkey`
  counts is documented instead. Rejected for `total`; the invariant note stays in the docs.

## Decision

**Option A.** Twin inbound endpoints in one module over the existing verified line, live top-N +
live count, registered in the capability registry.

Load-bearing sub-decisions:

1. **Rank scale & fields:** `rank = Math.round(influence × 100)` (house scale; deliberately not
   NosFabrica's floats); body `{ results, total }`, **no `ttl`** (ADR open-ranking/0004).
2. **`limit`:** `DEFAULT_LIMIT = 50` (spec's own example value); `MAX_LIMIT = 1000` (the spec's
   client SHOULD-NOT ceiling); `limit > MAX` → `422` per the ORE-06/07 error table (contrast:
   ORE-03 clamps — that difference is spec-driven, mirrored from each spec's table); zero /
   negative / non-integer → `422`.
3. **Order:** `influence DESC, pubkey ASC` — deterministic ties, pinned by tests.
4. **Cutoffs:** per-edge config (`VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF` /
   `VERIFIED_MUTERS_INFLUENCE_CUTOFF`), read via `getConfigFromFile` inside the real dep at
   request time, bound as `$cutoff`.
5. **No 404** (story AC): unknown targets fall out of the `MATCH` as the empty answer.
6. **Deadline:** both statements run with `txConfig { timeout: NEO4J_QUERY_TIMEOUT_MS }`
   (default 15000); a timeout surfaces through the existing wrapper catch as `500` + generic
   `X-Reason` (ORE has no 504 vocabulary; the deadline is a safety net, not a contract).
7. **Registry entries** for both endpoints (global `graperank` only), descriptions naming the
   verified-set semantics; SDK id-charset fine; capability doc order follows spec numbering.

## Consequences

- **Enables:** full endpoint-surface parity with NosFabrica minus pov variants; npub.world's
  Followers (ORE-06) capability lights up; the ore-parity book's parity bullet becomes
  satisfiable at deploy.
- **Constrains:** verified-inbound filter now expressed in three places (noted; a shared-query
  refactor is deliberately out of scope — the two existing expressions serve different shapes);
  `total` may drift from `/stats/pubkey`'s batch-written counts between recomputes (documented
  in BIBLE §28 and the docs page).
- **Debt:** none new beyond the filter triplication note.
- **Firmware reinstall required?** No.

## Implementation notes

- **`src/api/open-ranking/capabilities.js`** — add, after `/search/pubkeys` (spec order):
  ```js
  '/followers': [
    { id: 'graperank', name: 'GrapeRank', pov: false,
      description: "Verified followers of the target pubkey (WoT cutoff), each ranked by their own global GrapeRank (influence ×100), top-ranked first. total = verified-follower cardinality." },
  ],
  '/muters': [
    { id: 'graperank', name: 'GrapeRank', pov: false,
      description: "Verified muters of the target pubkey (WoT cutoff), each ranked by their own global GrapeRank (influence ×100), top-ranked first. total = verified-muter cardinality." },
  ],
  ```
  (`visibleAlgorithms` filters only `/stats/pubkey` — no change.)
- **`src/api/open-ranking/inbound.js`** (new):
  - `const EDGES = { '/followers': { rel: 'FOLLOWS', cutoffKey: 'VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF' }, '/muters': { rel: 'MUTES', cutoffKey: 'VERIFIED_MUTERS_INFLUENCE_CUTOFF' } };` — the rel whitelist; the Cypher embeds the whitelisted rel token, never request input.
  - `DEFAULT_LIMIT = 50`, `MAX_LIMIT = 1000`.
  - `async fetchVerifiedInbound(endpointPath, pubkey, limit)` — the two statements above;
    `Number(...)` coercions per module convention; timeout txConfig from
    `getConfigFromFile('NEO4J_QUERY_TIMEOUT_MS', 15000)`.
  - `async buildInbound(input, deps, endpointPath)` — validate `pubkey`
    (`isValidHexPubkey` → else `422`); `resolveAlgorithm(endpointPath, body.algorithm)` → null ⇒
    `422` (`unsupported algorithm '<x>' for <endpointPath>`); `limit` if present: integer > 0 →
    else `422` (`limit must be a positive integer`), `> MAX_LIMIT` → `422`
    (`limit must be a positive integer <= 1000`); default `DEFAULT_LIMIT`; global ignores `pov`;
    `await deps.fetchVerifiedInbound(endpointPath, pubkey, limit)`; map rows →
    `{pubkey, rank: Math.round((Number(influence)||0)*100)}` (order comes from the query; the
    builder slices to `limit` defensively); body `{ results, total: Number(total)||0 }`.
  - `handleFollowers` / `handleMuters` — thin wrappers (sibling try/catch → `500`), real deps
    `{ fetchVerifiedInbound }`.
  - Export `buildFollowers`, `buildMuters` (bound builders), `fetchVerifiedInbound`,
    `handleFollowers`, `handleMuters`.
- **`src/api/open-ranking/index.js`** — extend `ORE_PATHS` with `'/followers'`, `'/muters'`;
  `app.post('/followers', handleFollowers); app.post('/muters', handleMuters);`; header comment
  route list + re-export `buildFollowers`, `buildMuters`, `handleFollowers`, `handleMuters`.
- **BIBLE §28** — two table rows (ORE-06/07: `{ results, total }`, verified line, ≤`limit`,
  default 50 / max 1000, no `ttl`); PoV-mapping bullet (inbound endpoints → Neo4j live scan over
  the verified cutoffs; drift-vs-batch-counts note); Deferred list shrinks to ORE-04/08 (+ the
  standing W12 items).
- **`ui/src/pages/developers/OpenRanking.jsx`** — one combined section
  "5. Top followers & muters — `POST /followers` / `POST /muters`" (shared contract, one curl
  example each, `total` explained, default/max limit stated); Reference line gains ORE-06/07.
- Test file for Phase 3 (Tester's lane): `test/open-ranking-followers-muters.test.js` + the
  usual `test/test.js` registration; the SDK capability check already exists in the rank suite
  and will implicitly cover the grown doc — the Tester may add explicit 06/07 doc assertions
  there or in the new suite.

## Out of scope

- ORE-04 `/recommend/pubkeys`, ORE-08 `/compromised/pubkeys`; pov variants (W12/ADR-0005);
  `202`/`Retry-After`.
- Consolidating the three expressions of the verified-inbound filter.
- Aligning ORE-02's unknown-pubkey behavior with the spec's later-added 404 row (story keeps it
  out of scope; worksheet-grade if ever wanted).
- Cursor pagination beyond `limit`.
