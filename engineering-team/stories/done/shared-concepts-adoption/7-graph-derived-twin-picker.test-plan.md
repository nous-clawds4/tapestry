# Test Plan: Story 7 — Graph-derived twin picker

**Story:** `engineering-team/stories/shared-concepts-adoption/7-graph-derived-twin-picker.md`
**ADR:** skipped (fast-track; approach in the story's Background)
**Date:** 2026-08-07
**Suite:** `test/adoption-twins.test.js` (registered in `test/test.js`, the standard five-touch)

## Coverage map

| Criterion | Test(s) | Level |
|---|---|---|
| AC-1 source (server-assembled graph read; page's raw scan gone) | `S1` (endpoint registered + runCypher; page fetches it; no `api/strfry/scan` left in the page) | structural |
| AC-2 wireability (graph-only OUT; event-only OUT) | `H2` (the three-way fixture discrimination: graph-only node, graph+event pair, event-only publish) | live |
| AC-3 uniqueness (no coordinate twice) | `H1` | live |
| AC-4 shape (`{handle, name}`, graph name wins) | `H1` (shape) + `H2` (the both-sides fixture carries the graph's name) | live |
| AC-5 regression | `H3` (adoption-queue contract, passes pre AND post) | live |

## Edge cases

- [x] Same-uuid graph duplicates collapse (AC-3's uniqueness assertion over the full live corpus,
      which on the dev machine includes six same-handle duplicate pairs).
- [x] Event-only fixtures (e.g. story-5's `trusted-dictionary-fixture-*`) never offered (the
      general event-only exclusion, discriminated by `H2`).
- [x] Stack down → every H row SKIPs.

## Test infrastructure

- Established idioms: loopback cypher fixtures via `POST /api/neo4j/query` (DETACH DELETE at
  teardown), TA event publishes with the `nextStamp` discipline, bare-republish teardown.
- Fixtures: one graph-only ConceptHeader node, one graph+event pair, one event-only publish —
  stable d-tags (`twin-fixture-*`), all removed in H3's finally.
- No firmware precondition; no Playwright row (the picker swap is verified structurally + via the
  live endpoint; the review-phase manual walk covers the rendered selector).

## How to run

```
node test/adoption-twins.test.js
```

## Verification

The new tests fail with the current code. Confirmed 2026-08-07 (see below — output pasted after
the pre-implementation run):

```
  ✗ S1 — GET /api/adoption-twins must be registered in the adoption module (story #7)
  ✗ H1 — GET /api/adoption-twins must answer 200 success:true (got 404)
  ✗ H2 — GET /api/adoption-twins must answer 200 success:true (got 404)
  ✓ H3 (regression, passes pre AND post): the adoption queue is untouched — then teardown

adoption-twins: 1 passed, 3 failed, 0 skipped
```
