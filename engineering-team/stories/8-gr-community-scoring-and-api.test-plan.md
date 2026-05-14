# Test Plan: Story 8 — GR-Community scoring + Communities REST API

**Story:** `engineering-team/stories/8-gr-community-scoring-and-api.md`
**ADR:** `engineering-team/decisions/0006-gr-community-scoring-and-api.md`
**Date:** 2026-05-14

## Approach

Slice 2 has two test surfaces:

1. **Algorithm correctness** — pure-function tests against synthetic graphs. The scoring module has no I/O, so we import it directly and feed it deterministic inputs. This is the load-bearing test surface: the math has to be right.
2. **REST contract** — source-regex tests against the new handler/data-source files. Tests pin the response envelope shape, route registration, viewer-fallback to `getOwnerAssistantPubkey()`, and the try/catch wrap on every data-source function.

Live behavior (does this return correct scores when wired to real strfry + Neo4j?) is deferred to staging smoke per ADR §"Verification on real data" — the test plan documents the smoke recipe.

The pure-function tests serve double duty: they're correctness tests AND they exercise the convergence/performance properties the algorithm needs to hold up against real graphs.

## Coverage map

### Algorithm correctness (pure-function)

| Criterion | Test | Level |
|---|---|---|
| AC: seeds always score 1 | T1 `seeds appear in the result map with score 1.0 regardless of how the rest of the graph votes` | unit |
| AC: bot endorsement (baseline_gr=0) does not lift target | T2 `endorsement from a rater with baselineGr=0 contributes zero weight (gate 1 fails)` | unit |
| AC: high-baseline outsider endorsement does not lift target | T3 `endorsement from a rater whose community_gr converges to 0 contributes zero weight (gate 2 fails)` | unit |
| AC: balanced endorse + veto cancels | T4 `equal-weight endorse + veto on the same target yields score below threshold` | unit |
| AC: function is pure | T5 `calling the function twice with the same input returns equal Map results` | unit |
| AC: convergence terminates | T6 `function converges within maxIterations on a 50-node synthetic graph (iterations < maxIterations)` | unit |
| AC: unknown weightingModel throws | T7 `function throws when options.weightingModel is not "gr-community-default-v1"` | unit |
| AC: self-ratings excluded | T8 `self-endorsement (rater === target) does not contribute to score` | unit |
| AC: performance bound | T9 `200-member synthetic graph with 800 signals computes in under 50ms` | unit (benchmark) |
| AC: result map is bounded | T10 `pubkeys absent from seeds + signals are not in the result map (no implicit zero-score entries)` | unit |
| AC: WEIGHTING_MODEL_ID exported | T11 `module exports WEIGHTING_MODEL_ID === "gr-community-default-v1"` | unit |
| AC: isMember + partitionMembers helpers | T12 `isMember(score, threshold) returns score >= threshold` + T13 `partitionMembers returns { members, nonMembers } with seeds always in members and lists sorted by score desc` | unit |

### REST contract (source-regex)

| Criterion | Test | Level |
|---|---|---|
| AC: four routes registered in src/api/index.js | T14 `src/api/index.js registers GET /api/communities, /:slug, /:slug/members` | source-regex |
| AC: handler modules export named functions | T15 `src/api/communities/index.js exports handleList, handleDetail, handleMembers` | source-regex |
| AC: viewer fallback to TA pubkey | T16 `each handler falls back to getOwnerAssistantPubkey() when req.query.viewer is absent` | source-regex |
| AC: data-source contract — 4 functions exist with try/catch | T17 `dataSources.js exports loadCommunityRecord/loadCommunitiesForViewer/loadEndorsementSignals/loadBaselineGrScores, each wrapped in try/catch` | source-regex |
| AC: pure-function module has zero I/O imports | T18 `src/algos/grCommunity/computeScores.js does not require fs, neo4j-driver, nostr-tools, child_process, or ws` | source-regex |
| AC: response envelope shape | T19 `each handler emits { success: true, ... } on success and { success: false, message } on 404` | source-regex |
| AC: openapi documentation | T20 `src/api/openapi.yaml contains entries for /api/communities, /api/communities/{slug}, /api/communities/{slug}/members` | source-regex |
| AC: empty-when-empty (no throws on fresh DB) | T21 `data-source functions return null / [] / {} from the catch branch — never re-throw` | source-regex (assert catch branch body) |
| AC: cache module shape | T22 `src/api/communities/cache.js exports getOrCompute with a 60000ms default TTL` | source-regex |

### Functional tests (handlers with mocked data sources)

| Criterion | Test | Level |
|---|---|---|
| AC: handleList returns empty array on empty data | T23 `handleList returns { success: true, communities: [] } when dataSources.loadCommunitiesForViewer returns []` | unit (handler with monkey-patched data source) |
| AC: handleDetail returns 404 on missing slug | T24 `handleDetail returns 404 with { success: false } when loadCommunityRecord returns null` | unit |
| AC: handleMembers computes scores and sorts desc | T25 `handleMembers computes GR-Community scores for the community's endorsement set and returns members sorted by score desc` | unit |

## Edge cases

- [x] **All raters have baseline 0** — algorithm should converge with only seeds scoring above zero (no random non-seed lifts itself).
- [x] **Empty endorsement set** — algorithm returns only the seeds, no exception.
- [x] **A pubkey is both endorsed and vetoed by the same rater** (deduplication should happen at the data-source layer per PLAN.md §3 / COMMUNITY_ENDORSEMENTS_DLIST.md's "latest stance wins" semantics — that's not Slice 2's job; the algorithm trusts what's passed in). Document explicitly that the algorithm does NOT deduplicate; that's the caller's job.
- [x] **Veto-heavy community** — algorithm doesn't go negative; clamp to [0, 1].
- [x] **maxIterations reached without convergence** — function returns the last computed scores with `iterations === maxIterations`. Caller decides whether to warn.
- [x] **viewer is malformed** (e.g. not 64 hex chars) — handler falls back to TA without throwing or 400-ing. Documented in ADR §"What happens if viewer is malformed".
- [x] **Cache evicts oldest when size > 200** — covered by source-regex on the eviction branch; explicit unit test would require introspection that's brittle. Source check is sufficient.

## Not covered (intentional)

- **Live behavior against real strfry events.** Requires running tapestry instance with at least one community-record and at least one endorsement event. Deferred to staging smoke after Slice 4 lands writes. Recipe in ADR §"Verification on real data".
- **Concept-graph wiring assertions.** The `loadCommunityRecord` function builds a query against the kind-39999 ListItem; whether Neo4j actually returns the row is a live-data concern. The data-source unit tests use the mocked-empty path.
- **End-to-end performance under realistic load.** The 50ms benchmark is for the pure function on synthetic data. Real-world wall-clock latency (with Neo4j query + strfry query + scoring) depends on the deployment, not the code shape.
- **Real GrapeRank library behavior.** We don't reuse `@graperank/calculator` (ADR Option B rejection); the new module's correctness is verified independently.
- **Cache cross-process consistency.** The cache is per-process; if multiple Express workers are spawned, each computes independently. Not a problem at v1 scale.

## Test infrastructure

- **Test framework:** project's existing hand-rolled Node runner (`test/test.js`). Single new file `test/gr-community-scoring-and-api.test.js`. Same pattern as #5 / #6 / #7.
- **No new dependencies.** Pure-function tests use `require('../src/algos/grCommunity')` directly. Source-regex tests use `fs.readFileSync`. Handler tests monkey-patch the data-source module via `require.cache` or by passing test-only handlers a factory function (Implementer's choice; the test verifies behavior either way).
- **No Playwright** — no browser-observable change in Slice 2.
- **Performance benchmark uses `process.hrtime.bigint()`** for accurate timing; no benchmark library.

## How to run

```bash
npm test
```

Manual staging smoke (after deploy + Slice 4 writes land):

```bash
# Empty-instance check (right after fresh deploy):
curl -s https://communities.brainstorm.world/api/communities | jq
# Expect: {"success":true,"communities":[]}

# After a community + endorsements exist:
curl -s "https://communities.brainstorm.world/api/communities?viewer=$VIEWER_HEX" | jq '.communities | length'
curl -s "https://communities.brainstorm.world/api/communities/<slug>/members?viewer=$VIEWER_HEX" | jq '.members[0]'
```

## Verification

Tests fail with the current code (no `src/algos/grCommunity/`, no `src/api/communities/`). Confirmed-failing on commit `5a7afd61` once the test file lands — failures point at specific missing modules and source-shape gaps that the Implementer must close.
