# Test Plan: Story 1 — ORE-03 /rank/pubkeys (global)

**Story:** `engineering-team/stories/ore-parity/1-rank-pubkeys.md`
**ADR:** `engineering-team/decisions/ore-parity/0001-rank-pubkeys.md`
**Date:** 2026-08-15

## Coverage map

All tests live in `test/open-ranking-rank.test.js` (registered in `test/test.js`), hermetic
against the pure builder with injected deps — the testability seam from ADR open-ranking/0001,
reused by ADR ore-parity/0001: `buildRank(input, deps)` returns a `{httpStatus, headers, body}`
triple; `deps.fetchInfluences(pubkeys)` is spied per-test.

| Criterion | Test name | Level |
|---|---|---|
| AC-1 capability doc extended | `C1: capability doc advertises /rank/pubkeys (default = global graperank); stats/search entries unchanged` | unit (registry) |
| AC-1 SDK validation passes | `C2: the REAL open-ranking SDK validateCapabilities() accepts our document (npub.world Validate path)` | conformance (real SDK, hermetic) |
| AC-2 happy path / AC-3 rank semantics | `B1: batch happy path -> 200, every pubkey ranked once, sorted rank desc, rank = round(influence*100), no ttl` | unit (builder) |
| AC-3 rounding + every-pubkey contract | `B2: fractional influence rounds to nearest integer; a pubkey missing from the deps rows still appears with rank 0` | unit |
| AC-2 deterministic order (ADR d.3) | `B3: ties keep first-occurrence request order (deterministic stable sort)` | unit |
| AC-2 dedupe (ADR d.2) | `B4: duplicate entries collapse — fetch sees the deduped set; each pubkey once; default limit = deduped count` | unit |
| AC-4 limit truncate/clamp | `B5: explicit limit truncates to the top-ranked; a limit above the count silently clamps` | unit |
| AC-4 limit validation | `B6: zero / negative / non-integer / non-numeric limit -> 422 + X-Reason, fetch not called` | unit |
| AC-6 pubkeys validation (ORE-00) | `B7: missing / empty / non-array / invalid-entry pubkeys -> 422 + X-Reason, fetch not called` | unit |
| AC-5 request-size cap (ADR d.4) | `B8: more than 1000 entries -> 413 (counted pre-dedup); exactly 1000 stays 200` | unit |
| AC-6 algorithm selection (ORE-01) | `B9: unsupported algorithm -> 422 + X-Reason, fetch not called; explicit 'graperank' -> 200` | unit |
| AC-6 pov ignored on global | `B10: a pov sent to the global rank algorithm is ignored -> 200 (ORE-01)` | unit |
| AC-6 headers everywhere | `B11: 200, 422, and 413 all carry Access-Control-Allow-Origin:* and application/json` | unit |
| AC-6 malformed JSON 400 | `E1: oreJsonErrorHandler maps a body-parse error on /rank/pubkeys to 400 + X-Reason + ACAO:*` | unit (middleware) |
| AC-7 additive / isolated | `S1`/`S2` (module exports + route registration), C1's sibling-endpoint assertions, **and** the pre-existing `open-ranking-stats` (29) + `open-ranking-search` (18) suites staying green in the same `npm test` run | structural + regression |

## Edge cases

- [x] Duplicate pubkeys in the request (B4 — collapse; limit defaulting uses deduped count).
- [x] Rank ties (B3 — request-order stable).
- [x] Deps returning fewer rows than requested (B2 — builder owns the every-pubkey contract).
- [x] Boundary 1000 vs 1001, and 1001-duplicates-of-one (B8 — cap counts raw entries, pre-dedup).
- [x] Uppercase hex / bech32 `npub` / non-string entries (B7 — ORE-00 hex MUST).
- [x] Gate-on capability doc still SDK-valid (C2 runs gate-off AND `{personalizedStats: true}`).
- [x] SDK devDependency missing → C2 fails with an explicit "run npm install" message, not a
      silent skip (drift-proofing is the point of decision 6).

## Not covered (and why)

- **`handleRankPubkeys` wrapper internals** (try/catch → 500): convention-thin per ADR; S1 pins
  its existence; the sibling suites set the precedent of not driving Express wrappers directly.
- **Live `UNWIND` Cypher against Neo4j**: `fetchInfluences` is injected; the query's contract
  (every pubkey a row, influence COALESCE 0) is pinned at the builder boundary by B1/B2. The
  live path is exercised at deploy verification (book frame: real `POST /rank/pubkeys` on the
  local stack / staging, then npub.world Validate).
- **npub.world itself**: C2 replays its exact validation code path (fetch→parse→validate emulated
  with the SDK's own exported constants); the real button is the book-frame check at deploy.

## Test infrastructure

- Test framework: the repo's hand-rolled runner — `npm test` → `node test/test.js`; the new suite
  exports `run()` and is registered in `test/test.js` (require + run block + summary line +
  overall-PASS condition + results object).
- **New devDependency (ADR ore-parity/0001 decision 6):** `open-ranking@0.1.1`, exact-pinned,
  installed at test design so C2 fails pre-implementation for the *right* reason (the SDK's real
  mandatory-endpoint throw — the npub.world symptom — not `ERR_MODULE_NOT_FOUND`). ESM package,
  loaded via dynamic `import()` from the CJS suite. Never installed in the container
  (`npm install --production`).
- Concept Graph API: not needed — no concept-graph behavior in this story.
- Firmware state: none required.
- Fixtures: inline (`HEX(c)`, `pk(i)` bulk hex generators; `makeRankDeps(influences)` spy).

## How to run

```
npm test
```

(The rank suite prints under `open-ranking-rank suite:`; overall PASS requires it green along
with every pre-existing suite.)

## Verification

The new tests fail with the current code — all 16, each for the feature-absent reason, none for
import/typo reasons. Confirmed on 2026-08-15 at commit 27a26650 (`feat/ore-rank-pubkeys`;
test-design working tree), standalone suite run (`node -e "require('./test/open-ranking-rank.test.js').run()…"`):

```
  ✗ S1: ORE module exports buildRank + handleRankPubkeys (ADR ore-parity/0001 §Impl / testability seam)
      open-ranking/index.js must export `buildRank` (ADR ore-parity/0001).
  ✗ S2: the ORE module registers POST /rank/pubkeys (ADR ore-parity/0001 §Impl)
      src/api/open-ranking/index.js must register the route '/rank/pubkeys'.
  ✗ C1 (AC-1): capability doc advertises /rank/pubkeys (default = global graperank); stats/search entries unchanged
      capability doc must advertise '/rank/pubkeys' as a non-empty array (the SDK's mandatory-endpoint check).
  ✗ C2 (AC-1): the REAL open-ranking SDK validateCapabilities() accepts our document (npub.world Validate path)
      SDK validateCapabilities rejected our capability document (gate-off): no algorithms registered in the mandatory /rank/pubkeys — this is exactly what npub.world's Validate button reports against the R&D instances.
  ✗ B1 (AC-2/AC-3): batch happy path -> 200, every pubkey ranked once, sorted rank desc, rank = round(influence*100), no ttl
      src/api/open-ranking/index.js must export an async `buildRank(input, deps)` — the ORE-03 rank feature is not implemented yet (ADR ore-parity/0001 §Implementation notes).
  [B2–B11 fail identically: `buildRank` absent]
  ✗ E1 (AC-6): oreJsonErrorHandler maps a body-parse error on /rank/pubkeys to 400 + X-Reason + ACAO:* (ORE_PATHS includes the new path)
      malformed JSON on /rank/pubkeys must yield 400.

RESULT {"pass":0,"fail":16}
```

C2's failure message is the exact SDK throw npub.world reports — the defect reproduced under test.
Full-runner regression check (`npm test`): pre-existing suites unaffected (`open-ranking-stats`
29 passed, `open-ranking-search` 18 passed; the overall FAIL comes only from the new suite) —
recorded at the Phase-3 gate.
