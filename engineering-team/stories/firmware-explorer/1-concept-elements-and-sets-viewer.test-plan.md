# Test Plan — firmware-explorer #1: Concept Elements & Sets viewer

**Story:** `engineering-team/stories/firmware-explorer/1-concept-elements-and-sets-viewer.md`
**ADR:** `engineering-team/decisions/firmware-explorer/0001-concept-elements-and-sets-viewer.md`
**Suite:** `test/firmware-concept-elements-sets.test.js`

## Approach

The feature is frontend-only over the existing `/api/neo4j/query` endpoint (ADR Option A).
The harness has no jsdom/vitest and CI runs stack-free, so tests split into the project's
established classes:

- **U-class (EXECUTED, stack-free — the CI gate).** The pure ESM core
  `ui/src/api/conceptMembers.js` (`buildMembersQuery`, `fetchConceptMembers`) and the
  `params` extension to `ui/src/api/cypher.js`, loaded via the `loadEsm()` dynamic-import
  precedent (`move-nodes-between-sets-ui`). These assert the four validated Cypher shapes
  and — load-bearing — that the concept handle travels as a **`$h` param, never interpolated**
  into the query string (the write-guard-dodge; ADR Context §1).
- **S-class (source assertions, stack-free).** `ConceptMembersView.jsx` and the
  `FirmwareExplorer.jsx` wiring exist and are wired per the ADR (new tabs, scope default
  `direct`, Viewer default, JsonView reuse, no-JSON + empty states, name sort).
- **H-class (integration sentinels — SKIP when the local stack is unreachable OR the core is
  not yet built).** Build a throwaway ConceptHeader→Superset→elements/subsets fixture via the
  container loopback (`docker exec`, `localTrusted`) and run **the builder's own output**
  against real Neo4j, asserting Direct vs Full for both lists incl. an implicit z-tag element.
  Ties the pure builder to real DB semantics post-implementation.
- **R-class (regression sentinels, stack-free — pass before AND after).** `FirmwareExplorer.jsx`
  keeps its core-node tabs, the `FirmwareNodeJson` Viewer/Raw toggle, and the Integrations
  views. Guards the additive edit.

## Acceptance-criterion → test map

| AC | Tests |
|---|---|
| Elements & Sets offered as views | S1, S3 |
| Elements list renders by name / empty state | S2, S3, H1 |
| Sets list renders by name / empty state | S2, S3, H3 |
| Direct/Full toggle, default Direct, governs both | U1–U6, S2, H1–H4 |
| Direct = direct only; Full = transitive (+implicit for elements) | U2, U3, U5, U6, H1–H4 |
| Click item → JSON, Viewer default, Raw toggle | S2 |
| No-JSON item → clear message | S2 |
| Not-installed concept degrades gracefully | S3 (branch sits behind the existing guard) |
| Elements from any author show (no gating) | U2 (no author predicate), H2 (implicit incl.) |
| Count header per view | S2 |
| Handle is a param, not interpolated (write-guard dodge) | U6, U7, U8 |

## Prerequisites for H-class (local only)

Local Docker stack up (`localhost:7778`, container `tapestry`); firmware installed. H tests
create and DETACH DELETE `test-fecs-*` fixtures via loopback `/api/neo4j/query`. All H tests
SKIP when the stack is unreachable or the core module is absent (so they neither fail CI nor
fail pre-implementation).

## Expected pre-implementation result

U1–U8 and S1–S2 (and S3's new assertions) FAIL — `conceptMembers.js` and
`ConceptMembersView.jsx` do not exist, `cypher()` ignores `params`, and `FirmwareExplorer.jsx`
has no Elements/Sets wiring. H1–H4 SKIP (core absent). R1–R3 PASS. This is the correct
red state.
