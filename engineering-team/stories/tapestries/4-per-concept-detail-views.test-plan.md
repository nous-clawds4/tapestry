# Test Plan: Story 4 — Per-concept detail views (Firmware-Explorer parity)

**Story:** `engineering-team/stories/tapestries/4-per-concept-detail-views.md`
**ADR:** `engineering-team/decisions/tapestries/0004-per-concept-detail-views-neo4j-lmdb.md`
**Date:** 2026-07-25
**Suite:** `test/tapestry-per-concept-detail-views.test.js` (registered in `test/test.js`)

## Test taxonomy (per `test/firmware-concept-elements-sets.test.js`)

- **U-class** — EXECUTED, stack-free, **gates CI**. Requires the CommonJS helper directly
  (neo4j-driver connects lazily, so the require opens no connection); `runCypher`/`resolveValue`
  are **injected** so no stack is touched. This is where the ontology crux is proven.
- **S-class** — source assertions (the harness has no jsdom; React/endpoints are pinned by reading
  source, exactly as the create-tapestry and firmware-concept suites do).
- **H-class** — live integration **sentinels**; SKIP when the endpoint/stack is unreachable. The
  local Docker stack serves the **shared** checkout, not this worktree, so these **SKIP locally** and
  bind on staging (cycle-staging smoke) once the code ships — the same arrangement as
  create-tapestry's Playwright spec.
- **R-class** — regression sentinels; PASS **before and after**.

## Coverage map

| Criterion | Test(s) | Level |
|---|---|---|
| **AC1** View parity (Overview + 8 core nodes + Elements + Sets) | `U4` (8-core-node shape), `S4` (shared views exist), `S6` (TD tab bar mounts them), `S7` (client fetch) | unit + source |
| **AC2** Overview (name/desc + which core nodes exist/have JSON) | `U4` (shape carries every core node incl. missing → null), `S4` (`ConceptOverview` exported), `S6` | unit + source |
| **AC3** Core-node JSON + **source of truth = neo4j+LMDB** | `U1` (inline string parses), `U2` (LMDB object passthrough), **`U5` (lmdb:<key> resolves via the store — the crux)**, `U7` (header-uuid $param query + resolve), `S2` (helper routes JSON through `resolveValue`), `S8` (TD keys detail on the neo4j handle, drops the strfry import-JSON view), `H1` (live: schema + primary-property present for `dog` — data strfry lacks) | unit + source + live |
| **AC4** Elements & Sets (Direct/Full, count, JSON drill-down) | `S6` (mounts `ConceptMembersView` with the header uuid) — the Direct/Full/scope/sort behavior itself is already covered by `test/firmware-concept-elements-sets.test.js` (reused component) | source |
| **AC5** Graceful degradation (absent/partial in graph) | `U3` (missing JSON → null), `U6` (`found:false` for unknown header), `H3` (live: unknown handle → found:false) | unit + live |
| **AC6** No regression of tapestry-level Integration views | `R2` (TD keeps Integration Graph / Enumerations / Subsets) | source regression |
| **ADR Decision 2/3** DRY rewire is behavior-preserving | `S3` (firmware endpoint on the shared helper; inline query removed), `S5` (FE imports the extracted views), `H2` (live: firmware `/concept/dog` == core-nodes endpoint for the same nodes), `R1` (firmware page keeps its tabs/Elements-Sets/Integrations) | source + live regression |

## Edge cases covered
- [x] Node JSON offloaded to LMDB (`lmdb:<key>` pointer) — `U5` (the reason 0-pointers-today doesn't matter).
- [x] Node JSON stored as an object vs an inline string — `U2` / `U1`.
- [x] Concept / core node absent from the graph — `U3`, `U6`, `H3`.
- [x] Handle travels as `$uuid` param, never interpolated — `U7` (mirrors the members write-guard discipline).
- [x] Firmware page unchanged after extraction/rewire — `R1`, `S3`, `S5`, `H2`.

## Test infrastructure
- **Runner:** Node built-in (`node test/test.js`). New suite self-registers and is wired into the
  aggregate pass/fail + skip totals.
- **Stack-free binding gate:** U-class + S-class (17 tests) run with no Docker/Neo4j/LMDB/live-API —
  they are the CI gate. `resolveValue`/`runCypher` are injected in U-tests; a synthesized `lmdb:<key>`
  case proves resolution (the instance has **0** live pointers today, so a real pointer must be faked).
- **Live sentinels (H-class):** hit `http://127.0.0.1:$TAPESTRY_PORT`. Require the `dog` concept
  installed in Neo4j (present on this instance). SKIP automatically when the endpoint 404s (not yet
  deployed to the serving stack) or the stack is down. **Precondition to bind:** the code must be
  served by the target stack (staging smoke), or `POST /api/firmware/install` for a fresh graph.
- **Fixtures:** none created (H-class reads the existing `dog` concept read-only — no graph writes,
  unlike the firmware-concept suite's fixtures).

## Full-page E2E (deferred to verification, not in this suite)
The full browser round-trip (open a tapestry → select a concept → tab through Overview/core
nodes/Elements/Sets) is **not** a node-runner test (no jsdom). The epic's `Tapestry for Dog` seed is
**absent under this instance's TA**, so end-to-end verification during Implementation means authoring
a test tapestry via the owner-gated Create page, then opening it. A server-gated Playwright spec
(`tests/brainstorm/…`) mirroring create-tapestry's is a reasonable **follow-up**; it is deliberately
out of this suite because it cannot run stack-free and needs seeded data.

## How to run
```
node test/tapestry-per-concept-detail-views.test.js
```
Full gate:
```
npm test
```

## Verification
The new tests fail with the current code. Confirmed 2026-07-25 (worktree
`feat/tapestries-per-concept-views`):

```
tapestry-per-concept-detail-views: 2 passed, 15 failed, 3 skipped
```
- **U1–U7, S1–S8 FAIL** — each with a specific "not implemented" message (helper/endpoint/shared
  UI/TD wiring absent; firmware not yet rewired). Not typos/import errors: the failure messages name
  the missing artifact.
- **H1–H3 SKIP** — the running stack serves the shared checkout without the `/core-nodes` endpoint.
- **R1–R2 PASS** — the Firmware Explorer's and TapestryDetail's existing Integration surfaces are
  intact (they must stay green after implementation too).
