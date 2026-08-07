# Test Plan: Story 1 — Concept-header b-coverage audit and guided disposition

**Story:** `engineering-team/stories/shared-concepts-adoption/1-b-coverage-audit-and-disposition.md`
**ADR:** `engineering-team/decisions/shared-concepts-adoption/0001-b-coverage-audit-and-disposition.md`
**Date:** 2026-08-06
**Suite:** `test/b-coverage-audit-and-disposition.test.js` (registered in `test/test.js`, the standard five-touch)

## Coverage map

| Criterion | Test(s) | Level |
|---|---|---|
| AC-1 coverage visibility (states + filter) | `U5`, `U6` (classifier semantics) + `S7` (QUERY collects bValues; ConceptList classifies via the util) + `H4` (graph carries the coverage value) | unit + structural + live |
| AC-2 guided iteration | `S7` (panel component + wiring exist); interaction walk deferred to review-phase manual check — no Playwright row (panel is fetch+rerender; the endpoints are H-covered) | structural |
| AC-3 wire-external | `H4` (append + returned signed event + append-only), `H6` (idempotent), `S1` (route + requireOwner) | live + structural |
| AC-4 auto b-tag reachable/idempotent | `H7` (self-declare after defer; existing idempotency is shipped behavior) | live |
| AC-5 keep private (sentinel; no external publish; owner-only) | `H1` (exactly one sentinel), `H2` (idempotent), `S1` (requireOwner), `H8` (remote refusal); no-external-publish is structural-by-design (defer's server path has no relay publisher; reviewer spot-checks) | live + structural |
| AC-6 sentinel hygiene (no phantom; surfaces skip) | `G1`, `G2` (chokepoint derives nothing for sentinel/malformed — behavioral, via exported `buildImportCypher`), `G3` (valid derivation regression), `H3` (graph phantom-free), `S2` (lib consumed), `S5` (three b-surfaces skip by name) | behavioral + live + structural |
| AC-7 mutual exclusivity + re-disposition | `U6` (real b beats stale sentinel), `U7` (stripSentinel pure), `H4` (append replaces sentinel), `H5` (defer refused on wired header), `H7` (declare replaces sentinel), `S3` (selfDeclare carve-out present) | unit + live + structural |
| AC-8 spec ruling lands | `S3` (literal in all four homes), `S6` (inherit-from reserves; shared-concepts ruling; W16 Graduated) | structural |
| AC-9 gates | the suite itself in `npm test` (five-touch registration); harness-lint unchanged | — |

## Edge cases

- [x] Near-miss values fail closed (`U4`: 63/65-hex, empty d-tag, short pubkey, non-numeric kind, case variance, trailing space, empty string — arity-asserted per OPEN.md #108).
- [x] Multi-b headers: wired + self-declared coexist (`U6`); sentinel never co-reads with real b (`U6`).
- [x] Repeat actions are idempotent (`H2`, `H6`).
- [x] Unauthenticated remote callers (`H8` — 401 via default-deny *before* routing, so it holds pre and post; regression-class).
- [x] Stack down → every H row SKIPs with a recorded count (never silent).

## Test infrastructure

- Framework: the house micro-runner (plain node; `tests[]` + `run()`), registered in `test/test.js`.
- Live rows: reads via host fetch on `localhost:$TAPESTRY_PORT` (7778 default); privileged writes via docker-exec loopback (`localTrusted`) — the brain-first suite's pattern.
- Fixtures: TA-signed kind-39998 headers with **stable d-tags** (`b-coverage-fixture-s1a`/`-s1b`, OPEN.md #128 — replaceable, zero corpus growth); teardown republishes bare. Fixture pubkeys are non-secret literals (test files only).
- No firmware precondition; no Playwright row (rationale in the AC-2 line).
- Structural rows are line-based only (OPEN.md #109); route assertions are absence-based, never counts (OPEN.md #143).

## How to run

```
node test/b-coverage-audit-and-disposition.test.js
```

Full gate: `npm test`.

## Verification

The suite fails with current code for the right reasons. Confirmed 2026-08-06 at commit `8a83fa27` (stack up):

```
b-coverage-audit-and-disposition: 4 passed, 22 failed, 0 skipped
  — U1–U8 fail: "precondition: src/lib/bValueForms.js is missing"
  — G1 fails: "buildImportCypher must not MERGE a NostrEvent keyed by the sentinel — phantom node
     (found uuid: 'b-tag-deferred' in the generated Cypher)"   ← the live hazard, demonstrated
  — G2 fails: phantom MERGE for a malformed value
  — S1–S3, S5–S7 fail: routes/lib/UI util/skips/spec edits absent
  — H1, H2, H4–H7 fail: loopback (localTrusted) callers reach routing and 404 on the unrouted endpoints
  — Passing by design (regression guards, pre AND post): G3 (valid b derivation),
     S4 (no feature-named route in App.jsx), H3 (graph phantom-free today), H8 (default-deny 401s
     unauthenticated remote POSTs before routing — security-auth 0002)
```
