# Test Plan: Story 2 — ORE-06 /followers + ORE-07 /muters (global)

**Story:** `engineering-team/stories/ore-parity/2-followers-muters.md`
**ADR:** `engineering-team/decisions/ore-parity/0002-followers-muters.md`
**Date:** 2026-08-16

## Coverage map

All tests live in `test/open-ranking-followers-muters.test.js` (registered in `test/test.js`),
hermetic against the twin pure builders with one injected dep — the seam from ADR
ore-parity/0002: `buildFollowers`/`buildMuters` return `{httpStatus, headers, body}` triples;
`deps.fetchVerifiedInbound(endpointPath, pubkey, limit) -> { rows, total }` is spied per-test.

| Criterion | Test name | Level |
|---|---|---|
| AC-1 capability doc + SDK | `C1: capability doc advertises /followers and /muters …` + `C2: the REAL open-ranking SDK validateCapabilities() accepts the grown document` (asserts registration under the SDK's own `ENDPOINT_FOLLOWERS`/`ENDPOINT_MUTERS` constants) | unit + conformance |
| AC-2 followers happy path | `B1: followers happy path -> 200 {results, total}; deps called once with (/followers, pubkey, 50); rank = round(influence*100); no ttl` | unit |
| AC-3 muters happy path (twin contract) | `B2: muters happy path — identical contract, deps called with /muters` | unit |
| AC-2 limit forwarding + ≤limit ownership | `B3: explicit valid limit forwarded; rows beyond limit are sliced off defensively` | unit |
| AC-2 mapping edge rows | `B4: missing/null influence floors to rank 0; malformed row without pubkey is dropped` | unit |
| AC-5 unknown/empty target no-404 | `B5: unknown / verified-empty target -> 200 with results [] and total 0` (both twins) | unit |
| AC-4 limit validation | `B6: zero / negative / non-integer / non-numeric limit -> 422 + X-Reason, fetch not called` | unit |
| AC-4 over-max 422 (spec 06/07, no clamp) | `B7: limit over the provider max (1000) -> 422; exactly 1000 is accepted` | unit |
| AC-6 pubkey validation (ORE-00) | `B8: missing / non-string / invalid-hex / npub / uppercase pubkey -> 422 …` (both twins) | unit |
| AC-6 algorithm selection | `B9: unsupported algorithm -> 422 naming the endpoint …; explicit 'graperank' -> 200` (both twins) | unit |
| AC-6 pov ignored | `B10: a pov sent to the global algorithm is ignored -> 200 (ORE-01)` | unit |
| AC-6 headers | `B11: 200 and 422 carry Access-Control-Allow-Origin:* and application/json` | unit |
| AC-6 malformed JSON 400 | `E1: oreJsonErrorHandler maps body-parse errors on /followers and /muters to 400 …` | unit (middleware) |
| AC-7 additive / isolated | `S1`/`S2` (exports + both route registrations), C1's sibling-endpoint assertions, and the pre-existing ORE suites (stats 29, search 18, rank 16) staying green in the same run | structural + regression |

## Edge cases

- [x] `total` independent of truncation (B1: rows 2, total 19470; B3: slicing leaves total 3).
- [x] Deps returning more rows than `limit` (B3 — builder owns the ≤limit contract).
- [x] Influence-less and pubkey-less rows (B4 — floor 0 / dropped).
- [x] Boundary limit 1000 vs 1001 (B7 — the 06/07 over-max 422, deliberately unlike ORE-03's clamp).
- [x] Both twins exercised for validation, no-404 posture, and algorithm errors (B5/B8/B9 loop
      both builders; B9 additionally pins the endpoint name inside `X-Reason`).
- [x] Gate interplay untouched (C1 re-checks stats' gate-off/gate-on algorithm counts).

## Not covered (and why)

- **Wrapper internals** (`handleFollowers`/`handleMuters` try/catch → 500): convention-thin per
  ADR; S1 pins existence — same posture as the sibling suites.
- **The live Cypher pair** (top-N + count statements, `$cutoff` binding, `NEO4J_QUERY_TIMEOUT_MS`
  txConfig): injected away; the deps contract (query-ordered rows, live total) is pinned at the
  builder boundary. The live path is exercised at cycle-local/staging verification (real
  followers of a scored pubkey, `total` sanity vs the verified-count ballpark).
- **Tie order inside the query** (`influence DESC, pubkey ASC`): a query property, not a builder
  property — verified at cycle-local by inspecting a real response ordering (the builder trusts
  and preserves row order, which B1/B3 pin).

## Test infrastructure

- Hand-rolled runner (`npm test` → `node test/test.js`); suite exports `run()`, registered at
  the five standard points.
- Reuses the `open-ranking@0.1.1` exact-pinned devDependency (ADR ore-parity/0001 decision 6) —
  C2 additionally asserts the new endpoints register under the SDK's own path constants, so a
  key typo (e.g. `/follower`) cannot silently pass.
- No concept-graph or firmware prerequisites; fixtures inline.

## How to run

```
npm test
```

(New suite prints under `open-ranking-followers-muters suite:`; overall PASS requires it green.)

## Verification

The new tests fail with the current code — all 16, each for the feature-absent reason.
Confirmed on 2026-08-16 at commit eee6f23b (`feat/ore-followers-muters`; test-design working
tree), standalone suite run:

```
  ✗ S1 … open-ranking/index.js must export `buildFollowers` (ADR ore-parity/0002).
  ✗ S2 … src/api/open-ranking/index.js must register the route '/followers'.
  ✗ C1 … capability doc must advertise '/followers' as a non-empty array.
  ✗ C2 … capability doc must register the SDK ENDPOINT_FOLLOWERS path (/followers).
  ✗ B1–B11 … must export an async `buildFollowers(input, deps)` / `buildMuters(input, deps)` —
      the ORE-06/07 inbound feature is not implemented yet (ADR ore-parity/0002 §Implementation notes).
  ✗ E1 … malformed JSON on /followers must yield 400.

RESULT {"pass":0,"fail":16}
```

Sibling ORE suites re-run green on the same tree: stats 29/29, search 18/18, rank 16/16.
