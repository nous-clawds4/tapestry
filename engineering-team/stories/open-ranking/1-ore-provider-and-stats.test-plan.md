# Test Plan: Story open-ranking #1 — ORE provider surface + ORE-02 /stats/pubkey

**Story:** `engineering-team/stories/open-ranking/1-ore-provider-and-stats.md`
**ADR:** `engineering-team/decisions/open-ranking/0001-ore-provider-and-stats.md`
**Date:** 2026-06-18

## Approach

Hermetic unit tests against the ADR's **pure builders** (`buildStats(input, deps)`, `buildCapabilityResponse()`, `oreJsonErrorHandler`) with the Neo4j data path injected as `deps` (`fetchProfileScores`, `isPovProvisioned`, `ownerPubkey`). This drives every behavioral acceptance criterion — algorithm selection, the POV rules, field mapping, validation, CORS headers — **without** a running Docker stack, mirroring the live-feed read-path suite. One test file: `test/open-ranking-stats.test.js`, registered in `test/test.js`.

## Coverage map

| Criterion (story) | Test(s) | Test file | Level |
|---|---|---|---|
| AC-1 capability doc: advertises only `/stats/pubkey`; `grapevine` default `pov:false`; `grapevine-personalized` `pov:true`; 200/json/ACAO:* | `C1`, `C2`, `C3`, `S1`, `S2` | `test/open-ranking-stats.test.js` | unit + structural |
| AC-2 `OPTIONS` preflight succeeds | *(integration — see Flags)* | — | staging smoke |
| AC-3 global stats: 200, `rank = round(influence×100)`, mapped fields, read under owner | `B1`, `B2`, `B3`, `B10`, `B11` | same | unit |
| AC-4 personalized stats, provisioned `pov` | `B4`, `B12` | same | unit |
| AC-5 personalized stats, unprovisioned `pov` → 422 + `X-Reason`, no house fallback | `B5` | same | unit |
| AC-6 conventions: npub/invalid pubkey→422; malformed JSON→400; bad algorithm→422; missing pov→422; pov-on-global ignored | `B6`,`B7`,`B8`,`B9`,`B11`,`V1`,`E1`,`E2` | same | unit |
| AC-7 additive / isolated (off `/api/`; no writes/firmware/nginx) | `S2` (bare-path registration) + additive-by-construction | same | structural |

## Edge cases

- [x] Unknown pubkey (influence 0) → 200 with floor `rank` 0, **no** 404 (`B10`).
- [x] `pov === owner` on the personalized algorithm → treated as provisioned, read under owner (`B12`).
- [x] `pov` sent to the global algorithm → ignored, never consults provisioning (`B7`).
- [x] Unprovisioned `pov` must **not** fetch scores (no silent house fallback) (`B5`).
- [x] `rank` rounding (`0.915 → 92`) (`B3`).
- [x] Pubkey validation matrix: uppercase, 63/65 chars, npub, empty/undefined (`B9`, `V1`).
- [x] Error middleware passes non-ORE paths through to `next` (`E2`).
- [x] CORS headers present on **error** responses too, not just 200 (`B11`, `E1`).

## Flags for the gate

- **ADR-refinement (resolved):** the tests require a **testability seam** — pure builders + injected `deps`, with `index.js` re-exporting them. ADR 0001 was **amended 2026-06-18** to ratify this (Implementation notes → "Testability seam"), mirroring live-feed/0001's `buildFeed({deps})`. The Implementer must honor injected deps.
- **AC-2 (OPTIONS preflight) is not unit-tested.** Per ADR 0001's CORS decision, preflight is handled by the platform's global `cors()` (returns a 2xx — 204 — reflecting the origin), which a hermetic unit test of the ORE module can't exercise. It is verified at the **staging smoke** step. Recommend reading AC-2 as "preflight returns a 2xx with `Allow-Methods`/`Allow-Headers` permitting `POST`+`Content-Type`" (the strict-200 shim remains a deferred follow-up). **This is the one open AC-wording item from the architecture gate.**

## Test infrastructure

- Test runner: Node's built-in runner via `npm test` (entry `test/test.js`). The ORE suite exports `run()` and is wired into the aggregator (require + run + result line + `overallOk`).
- **No external services required** for this suite — the Neo4j/score path is injected. (The full `npm test` exercises other suites that do need the stack; this suite does not.)
- Firmware state: none.
- Fixtures: in-file hex pubkeys (`OWNER`, `TARGET`, `PROV_POV`, `UNPROV_POV`) and a representative `get-profile-scores` result.

## How to run

```
npm test                                   # full suite
node -e "require('./test/open-ranking-stats.test.js').run().then(r=>console.log(r))"   # this suite only
```

## Verification

The new tests fail with the current code (the ORE module does not exist yet). Confirmed 2026-06-18 on `feat/open-ranking`, pre-implementation — **all 20 fail for the right reason** (feature absent), none on syntax/import:

```
  ✗ S1: src/api/open-ranking/index.js exists ... — module does not exist / does not load yet
  ✗ S2: src/api/index.js registers /.well-known/open-ranking.json and /stats/pubkey ...
  ✗ C1/C2/C3: buildCapabilityResponse missing — feature absent
  ✗ B1..B12: buildStats(input, deps) not exported — feature not implemented yet
  ✗ V1: isValidHexPubkey missing — feature absent
  ✗ E1/E2: oreJsonErrorHandler missing — feature absent
--- RESULT: {"pass":0,"fail":20}
```
