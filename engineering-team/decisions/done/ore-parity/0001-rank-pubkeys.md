# ADR 0001: ORE-03 /rank/pubkeys — lean batch rank over the owner baseline

**Status:** Accepted
**Date:** 2026-08-15
**Story:** `engineering-team/stories/ore-parity/1-rank-pubkeys.md`

## Context

The story adds **ORE-03 `POST /rank/pubkeys`** (mandatory per the upstream spec) with the global
`graperank` algorithm only, registered in the ORE-01 capability document, so the official
`open-ranking` JS SDK's `validateCapabilities()` — npub.world's Validate path — accepts our
document. Acceptance criteria, restated: capability doc grows a `/rank/pubkeys` entry (default =
global `graperank`) and passes the SDK check; batch happy path returns `{ results: [{pubkey,
rank}, …] }` sorted rank-descending with every requested pubkey ranked exactly once; rank agrees
with ORE-02 for the same pubkey (`round(influence × 100)`, unknown → 0); `limit` defaults to the
request's pubkey count, silently clamps above it, `422`s when non-positive; over-max requests →
`413`; ORE-00/01 conventions (`422`/`400` + `X-Reason`, `ACAO:*`, JSON everywhere, `pov` ignored
on global); additive/isolated.

**No concepts touched** — like the rest of the ORE module, this is infrastructure over
already-computed scores (concept-graph `graperank` / `web-of-trust` referenced only). No firmware
reinstall.

Grounding facts (verified in-repo unless linked):

- **Module pattern (ADR open-ranking/0001).** `src/api/open-ranking/` is registry-driven:
  `capabilities.js` `CAPABILITIES` feeds both the served document and `resolveAlgorithm()`
  per-request validation (the no-drift rule); endpoints are **pure builders** `build*(input,
  deps)` returning `{httpStatus, headers, body}` triples with thin Express wrappers;
  ORE-00 helpers live in `shared.js` (`isValidHexPubkey`, `oreHeaders`, `errorTriple`,
  `applyTriple`); routes register in the module's `index.js` (`registerOpenRankingRoutes`), whose
  `ORE_PATHS` set also scopes the malformed-JSON `400` error middleware.
- **Rank source of truth for the global POV** (ADR open-ranking/0001 §POV semantics): the
  **owner baseline** on the Neo4j path — `NostrUser.influence`, `rank = round(influence × 100)`
  (`mapScoresToOre`, `src/api/open-ranking/stats.js:44`). ORE-02 reads it per-pubkey via
  `fetchProfileScores({pubkey, observerPubkey:'owner'})`, whose owner branch is
  `MATCH (u:NostrUser {pubkey: …}) RETURN … COALESCE(u.influence, 0) AS influence …`
  (`src/api/export/users/queries/get-profile-scores.js:88-115`) — but it opens a fresh
  driver+session per call and returns ~20 fields; a per-pubkey loop is the wrong shape for a
  1000-pubkey batch.
- **`runCypher` (`src/lib/neo4j-driver`)** is the module's existing parameterized one-shot query
  path (used by `isPovProvisioned`, `stats.js:31-37`), returning rows keyed by RETURN alias.
- **`ttl` is deliberately absent** from all ORE responses (ADR open-ranking/0004: "No `ttl`
  anywhere" — scores recompute on their own cadence). `ttl` is optional in ORE-03. npub.world's
  cache falls back to its 5-minute default when absent (`src/lib/open-ranking.js` in
  vertex-lab/npub.world) — harmless.
- **ORE-00 pubkey rule:** "Providers and clients MUST use the hex encoding [64-char lowercase] in
  all requests and responses" — an invalid entry violates a MUST, so the whole request is
  malformed (`422`), mirroring ORE-02's handling of its single `pubkey`. "Unknown" (valid hex,
  absent from the graph) stays distinct: ranked with floor 0, per ORE-03's every-pubkey rule.
- **The SDK check** (`Open-Ranking/js-sdk` `index.js:343-357`, npm `open-ranking@0.1.1`):
  `validateCapabilities` throws unless `/stats/pubkey` and `/rank/pubkeys` each register ≥1
  algorithm; also enforces id charset (`/^[-a-z0-9_.]+$/` — `graperank` passes) and
  topic-only-in-recommend. Zero-dependency ESM package, MIT.
- **Body size:** `express.json({ limit: '100mb' })` (`bin/control-panel.js:121`) — a 1000-pubkey
  JSON body (~67KB) is nowhere near the parser limit; the provider max is enforced in-builder.
- **No route collision:** nothing registers bare `/rank/pubkeys`; all existing ranking routes live
  under `/api/`.
- **Documentation surfaces that enumerate ORE endpoints** (stale the moment we add one): BIBLE
  §28 endpoint table (`BIBLE.md:1709-1713`) and the developers page
  (`ui/src/pages/developers/OpenRanking.jsx`), both updated in-story by precedent
  (ore-pov-availability book did the same for its contract change).

## Options considered

### Option A — Lean batch endpoint in the existing module: one `UNWIND` Cypher, registry entry, SDK-backed conformance test *(chosen)*

New `rank.js` beside `stats.js`/`search.js`: pure `buildRank(input, deps)` with
`deps.fetchInfluences(pubkeys)` — the real implementation a module-local, parameterized one-shot:

```cypher
UNWIND $pubkeys AS p
OPTIONAL MATCH (u:NostrUser {pubkey: p})
RETURN p AS pubkey, COALESCE(u.influence, 0) AS influence
```

One round trip on the indexed `NostrUser.pubkey`; unknown pubkeys fall out of `OPTIONAL MATCH`
with influence 0 (= rank 0) — ORE-03's every-pubkey rule for free. Sort + clamp in JS (n ≤ 1000).
Registry gains a `/rank/pubkeys` entry, so the capability document and request validation grow in
lockstep. Conformance is pinned by a test that runs the **real** SDK `validateCapabilities` (dev
dependency, exact-pinned) against `buildCapabilityDocument()`.

- **Pros:** matches every established module convention (registry, triples, deps injection, local
  fetch à la `searchProfiles`); minimal query cost; rank semantics *identical by construction* to
  ORE-02's owner path (same node, same property, same rounding); the SDK test makes "npub.world
  validates us" a regression-proof invariant rather than a hope.
- **Cons:** a second place reading `NostrUser.influence` directly (the batch Cypher duplicates the
  `COALESCE(u.influence, 0)` semantics rather than reusing `fetchProfileScores`); one new
  dev-only dependency.

### Option B — Loop `fetchProfileScores` per pubkey

Reuse the ORE-02 data path unchanged: `Promise.all(pubkeys.map(p => fetchProfileScores({pubkey:
p, observerPubkey:'owner'})))`.

- **Pros:** zero new Cypher; single score-reading path.
- **Cons:** up to 1000 sequential-ish Neo4j calls, each opening its **own driver + session**
  (`get-profile-scores.js:83-84`) and returning ~20 unused fields — seconds of latency and
  connection churn for a batch a single `UNWIND` answers in one trip. Refactoring
  `queryProfileScores` to be batch-capable means touching the shared `/api/get-profile-scores`
  path for no consumer benefit. Rejected.

### Option C — Meili-backed batch (read `wot_rank_<ownerSuffix>` by document id)

- **Pros:** one HTTP call to the search API; rank already denormalized.
- **Cons:** Meili only holds indexed profiles (coverage gap vs the Neo4j `NostrUser` set), and its
  columns are keyed by the **delegated-suffix** POV identity while ORE-02 stats reads the **owner
  Neo4j baseline** — the unreconciled W13 seam. Ranks would disagree with `/stats/pubkey` for the
  same pubkey, violating the story's consistency AC. Rejected.

## Decision

**Option A.** Extend `src/api/open-ranking/` with a lean, registry-registered batch endpoint over
the owner baseline, and pin conformance with the real SDK validator.

Load-bearing sub-decisions:

1. **No `ttl`** — honors ADR open-ranking/0004 ("No `ttl` anywhere"); `ttl` is optional in
   ORE-03. Story's happy-path AC amended at the gate to `{ results }` (operator-approved,
   2026-08-15).
2. **Duplicates collapse.** The spec is silent on duplicate entries; "a rank for every requested
   pubkey" + the story's "each requested pubkey exactly once" read naturally as set semantics.
   `pubkeys` is deduplicated (first occurrence kept) before ranking; the "number of pubkeys in
   the request" used for `limit` defaulting/clamping is the **deduplicated count**.
3. **Deterministic order.** Sort by `rank` descending; ties keep first-occurrence request order
   (stable `Array.prototype.sort`). Response = first `limit` entries.
4. **Provider max = 1000** (`MAX_PUBKEYS`), the spec's SHOULD-NOT ceiling; exceeding → `413` +
   `X-Reason`. (Counted pre-dedup: a client sending 1001 entries is out of contract regardless.)
5. **Invalid entry ⇒ whole-request `422`** (ORE-00 MUST, mirrors ORE-02); unknown-but-valid ⇒
   rank 0. One reason string covers missing/empty/non-array/invalid-entry:
   `pubkeys must be a non-empty array of 64-char lowercase hex pubkeys`.
6. **SDK as dev dependency, exact-pinned** (`"open-ranking": "0.1.1"`, no range). The
   capability-doc suite dynamic-`import()`s it (ESM in our CJS tests) and asserts
   `validateCapabilities(buildCapabilityDocument(...))` does not throw, both gate-off and
   gate-on. This is the exact code npub.world runs; replicating its assertions by hand (the
   no-dep alternative) was rejected because validator drift is precisely how this gap stayed
   invisible for two months. Runtime dependencies: unchanged (`npm install --production` in the
   container never installs it — `docker/entrypoint.sh:224`).

## Consequences

- **Enables:** npub.world (and any SDK client) validates the R&D instances the moment this
  deploys — the failing check is document-level; story 2 (ORE-06/07) reuses the same pattern.
- **Constrains:** `/rank/pubkeys` answers only from the owner baseline until the W12 auth work
  unlocks personalized variants (unchanged gate, ADR open-ranking/0005); the batch Cypher is a
  second reader of `NostrUser.influence` — if the score property ever moves, two files change.
- **Debt:** dev-only supply-chain surface of one zero-dep pinned package; revisit the pin when
  upstream tags a new SDK release.
- **Firmware reinstall required?** No.

## Implementation notes

- **`src/api/open-ranking/capabilities.js`** — add to `CAPABILITIES`:
  ```js
  '/rank/pubkeys': [
    {
      id: 'graperank',
      name: 'GrapeRank',
      pov: false,
      description: "Batch GrapeRank web-of-trust ranking of the supplied pubkeys (influence ×100) from this instance's global point of view. Unknown pubkeys rank 0.",
    },
  ],
  ```
  `visibleAlgorithms` filters only `/stats/pubkey` — no change; the doc gains the entry
  automatically (all callers of `buildCapabilityDocument` inherit it).
- **`src/api/open-ranking/rank.js`** (new) — mirror `search.js`'s shape:
  - `const MAX_PUBKEYS = 1000;`
  - `async function fetchInfluences(pubkeys)` — the `UNWIND` query above via
    `runCypher(query, { pubkeys })`; returns `[{pubkey, influence}]` (`Number(...)` the
    influence, as `stats.js` does for `n`).
  - `async function buildRank(input, deps)` — validation order: `pubkeys` present, is array,
    non-empty, → else `422`; length > `MAX_PUBKEYS` → `413` (`too many pubkeys (max 1000)`);
    every entry `isValidHexPubkey` → else `422`; dedupe (first occurrence, `Set`);
    `resolveAlgorithm('/rank/pubkeys', body.algorithm)` → `null` ⇒ `422`
    (`unsupported algorithm '<x>' for /rank/pubkeys`); `limit` if present: integer > 0 → else
    `422` (`limit must be a positive integer`), then `limit = Math.min(limit, deduped.length)`,
    default `deduped.length`; global algorithm ignores `pov` (ORE-01); `await
    deps.fetchInfluences(deduped)`; map `rank = Math.round((Number(influence) || 0) * 100)`;
    stable-sort desc; slice `limit`; return `{ httpStatus: 200, headers: oreHeaders(),
    body: { results } }`.
  - `handleRankPubkeys(req, res)` — thin wrapper with the same try/catch → `500` shape as
    `handleStatsPubkey` (`stats.js:118-131`); real deps `{ fetchInfluences }`.
  - Export `buildRank`, `fetchInfluences`, `handleRankPubkeys`.
- **`src/api/open-ranking/index.js`** — add `'/rank/pubkeys'` to `ORE_PATHS` (the malformed-JSON
  `400` middleware keys on it); `app.post('/rank/pubkeys', handleRankPubkeys);`; re-export
  `buildRank` + `handleRankPubkeys` (the hermetic-suite seam, per ADR open-ranking/0001's
  testability amendment).
- **`package.json`** — `devDependencies`: `"open-ranking": "0.1.1"` (exact pin, dev-only).
- **BIBLE §28** — add the `| POST | /rank/pubkeys | ORE-03 | … |` row to the endpoint table
  (`BIBLE.md:1709-1713`) and the one-line algorithm note alongside the existing entries.
- **`ui/src/pages/developers/OpenRanking.jsx`** — add the `/rank/pubkeys` endpoint section
  (request/response/errors), mirroring the existing `/stats/pubkey` + `/search/pubkeys` sections.
  Documentation of the public contract, not new UI (precedent: ore-pov-availability's
  `/developers/open-ranking` contract section rode its story).
- Test-file naming for Phase 3 (Tester's lane): `test/open-ranking-rank.test.js` beside the
  existing two suites; the SDK-backed capability assertions belong wherever the Tester puts the
  capability-doc coverage.

## Out of scope

- ORE-06 `/followers` / ORE-07 `/muters` (story 2 — will get its own ADR; expected to reuse this
  endpoint pattern over the verified-inbound edge queries).
- Personalized (`pov:true`) ranking, ORE-A auth, `202`/`Retry-After` (unchanged W12/ADR-0005
  posture).
- Bundle fields on rank results (`hops`, `pagerank`, …) — ORE-02 carries the rich per-pubkey
  view; the batch stays `{pubkey, rank}`-lean by design.
- Reconciling the W13 owner-vs-delegated POV identity seam (untouched).
