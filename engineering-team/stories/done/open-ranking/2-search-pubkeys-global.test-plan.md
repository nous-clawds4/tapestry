# Test Plan: Story open-ranking #2 — ORE-05 /search/pubkeys (global only)

**Story:** `engineering-team/stories/open-ranking/2-search-pubkeys-global.md`
**ADR:** `engineering-team/decisions/open-ranking/0002-search-pubkeys-global.md`
**Suite:** `test/open-ranking-search.test.js` (wired into `test/test.js`)

## Strategy

Hermetic, mirroring the Story-1 harness. ADR 0002 ratifies a pure-builder testability seam: `buildSearch(input, deps)` returns a `{httpStatus, headers, body}` triple from **injected** deps (`{ ownerSuffix, searchProfiles(query, limit, suffix) }`), and the thin `handleSearchPubkeys` wrapper supplies the real deps. Tests drive `buildSearch` directly with a **fake `searchProfiles`** returning canned Meili hits — **no live `nostr-search-api`/Meili**. The capability document is asserted via `buildCapabilityDocument()`; the malformed-JSON path via `oreJsonErrorHandler`.

All tests **FAIL pre-implementation** (Story 1 shipped the module, but `buildSearch`/`handleSearchPubkeys` aren't exported, `/search/pubkeys` isn't in `CAPABILITIES` or `ORE_PATHS`) and must **PASS post**.

## Coverage map (test ID → acceptance criterion)

| ID | Asserts | AC |
|---|---|---|
| **S1** | module exports `buildSearch` + `handleSearchPubkeys` | seam |
| **S2** | `src/api/open-ranking/index.js` registers `'/search/pubkeys'` | AC-7 |
| **C1** | capability doc advertises `/search/pubkeys` (non-empty) **and** keeps `/stats/pubkey` (2 algos) | AC-1 |
| **C2** | search default = global `grapevine` (`pov:false`); **no** `pov:true` search algo in v1 | AC-1 |
| **B1** | non-empty query, no algorithm → 200 `{results[], ttl}`; `searchProfiles` called once with `(query, default-limit 20, ownerSuffix)` | AC-2 |
| **B2** | results map to `{pubkey, rank}`, `rank` from `wot_rank_<ownerSuffix>`, order preserved | AC-2/3 |
| **B3** | a hit with no `wot_rank_<suffix>` → `rank` 0 (floor; ORE no-404) | AC-3 |
| **B4** | `pubkey` falls back to `hit.id` when `hit.pubkey` absent | AC-2 |
| **B5** | explicit valid `limit` forwarded to `searchProfiles` | AC-5 |
| **B6** | `limit` non-positive / non-integer / >max → 422 + `X-Reason`; search not called | AC-5 |
| **B7** | `query` missing / empty / whitespace / >512 / non-string → 422 + `X-Reason`; search not called | AC-6 |
| **B8** | unsupported `algorithm` → 422 + `X-Reason`; search not called | AC-6 |
| **B9** | `pov` sent to the global algorithm is ignored → 200 | AC-6 |
| **B10** | both 200 and 422 carry `Access-Control-Allow-Origin: *` + `application/json` | AC-6 |
| **B11** | `rank` rounded to nearest integer | AC-3 |
| **B12** | search `ttl` hint is 300 | AC-2 |
| **E1** | `oreJsonErrorHandler` maps a parse error on `/search/pubkeys` → 400 + `X-Reason` + ACAO:* (i.e. `ORE_PATHS` now includes it) | AC-6 |

**Not unit-tested (staging-verified):** the real `nostr-search-api` call, the owner-suffix derivation against the live TA, and the actual `wot_rank_<ownerSuffix>` ranking — covered by the Story-2 staging smoke (Tier 3).

## Run
`node test/open-ranking-search.test.js` (standalone) or via the aggregator `node test/test.js` → "open-ranking-search suite".
