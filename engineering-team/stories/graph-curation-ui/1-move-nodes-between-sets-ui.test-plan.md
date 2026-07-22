# Test Plan: Story 1 — Place and move nodes between sets from the concept pages

**Story:** `engineering-team/stories/graph-curation-ui/1-move-nodes-between-sets-ui.md`
**ADR:** `engineering-team/decisions/graph-curation-ui/0001-shared-placement-dialog-over-primitives.md`
**Date:** 2026-07-22

All tests live in one suite, `test/move-nodes-between-sets-ui.test.js`, registered in
`test/test.js` (require + await + skip-aware summary line + the **live** `overallOk` chain —
inserted *before* the severed terminator, per OPEN.md #43 — + the `totalSkipped` roster).

Four classes (conventions from `relationship-primitives.test.js` / `event-page-ui.test.js`):

- **U (executed, stack-free, gates CI):** `ui/src/utils/placement.js` and
  `ui/src/api/relationships.js` are pure ESM (`ui/package.json` `"type":"module"`) and run in the
  Node runner via dynamic import; the client is driven against a stubbed `globalThis.fetch`.
- **S (source assertions, stack-free, gates CI):** the dialog + three pages, asserted at source
  level — the harness deliberately has no jsdom/testing-library.
- **H (live sentinels, SKIP when stack absent):** the two Cypher shapes the UI will embed
  (EXISTS direct-flag; direct-parents) validated against real Neo4j via container-loopback
  `POST /api/neo4j/query` with throwaway fixtures. **Pass before AND after** implementation — they
  pin query semantics so a Neo4j surprise fails in CI, not in the browser.
- **R (regression sentinels):** existing read queries/buttons survive the edit. Pass before and
  after.

## Coverage map

| Criterion | Test(s) | Level |
|---|---|---|
| AC1 Set page — place (kind choice, no reload) | U1 kind map, U2 element direction, U3 subset direction, S2 SetDetail wiring (owner gate, `intoSet`, "Add to this set", `onChanged`+`refetch`) | U executed / S source |
| AC2 Set page — remove (direct-only, confirmed) | S3 (EXISTS `AS direct`, `deleteRelationship`, `ConfirmDialog`, `stopPropagation`), U10 delete client, H1 direct-flag semantics | S / U / H sentinel |
| AC3 Element page — placements visible | S4 (parents query `[r:HAS_ELEMENT\|IS_A_SUPERSET_OF]` + `type(r)`, "Placements" section), H2 parents-query semantics | S / H sentinel |
| AC4 Element page — move / add | U4 move ordering (add-before-delete, source relType), U5 same-place no-op, S4 (`forNode`, "Move…", "Add placement…", `source`) | U / S |
| AC5 Organization overview affordance | S5 (owner-gated per-row Place/move, `forNode`), U7 cycle filter | S / U |
| AC6 Gating (non-owner unchanged) | S2/S4/S5 classification-gate asserts; server-side 401/403 already pinned by `test/relationship-primitives.test.js` (U-gate + H7) — not re-tested here | S (+ existing suite) |
| AC7 Warning on every change | U8/U10 (client returns full body incl. `note`), S1 (dialog renders `.note` in a banner, `already-existed` neutral path) | U / S |
| AC8 Failures surfaced | U9 (throw carries server error text, `.status`, `.allowed`), S1 (partial-failure "both places" message) | U / S |

## Edge cases

- [x] **Same-destination move is a silent-destruction trap** — add reports `already-existed`,
  then delete removes the only edge. U5 pins `buildPlacementOps` → `[]` (no-op).
- [x] Unknown placement kind throws, naming the kind (U6).
- [x] Cycle guard: subset placements exclude self + descendants; element placements exclude only
  self (U7).
- [x] Multi-parent node: Move targets ONE named source placement, delete uses the *source's*
  relType, not the new kind (U4, S4).
- [x] Indirect element rows (owned by a descendant set) must not offer remove (S3 + H1).
- [x] Stack absent: H tests SKIP, counted in the runner's `totalSkipped` (never silent).
- Concurrent edits between fetch and confirm (TOCTOU) — accepted by the ADR; not tested.

## Test infrastructure

- Framework: Node built-in runner via `npm test` (entry `test/test.js`); no new infra.
- Live path: container loopback `docker exec tapestry curl … http://127.0.0.1:7778/api/neo4j/query`
  (host→`:7778` is remote by design, ADR `security-auth-exposure/0001`); env overrides
  `TAPESTRY_CONTAINER` / `TAPESTRY_CONTAINER_PORT`.
- Firmware state: none required — fixtures are free-floating `:NostrEvent` nodes, never touching
  firmware or `39998:<TA>:*` structure.
- Fixtures: four throwaway nodes `test-gcui-<pid>-<ts>-{a,m,b,c}` wired
  `A-[:HAS_ELEMENT]->B`, `A-[:IS_A_SUPERSET_OF]->M`, `M-[:HAS_ELEMENT]->C`; torn down in the
  suite's `finally` via `DETACH DELETE` on the exact uuid list.

## How to run

```
npm test
```

Single suite directly:

```
node test/move-nodes-between-sets-ui.test.js
```

## Verification

The U and S tests fail with the current code (feature absent); H and R sentinels pass; the
runner's overall exit goes FAIL via the live chain. Confirmed 2026-07-22 (working tree at
`92f812f6` + these uncommitted test files), abridged:

```
--- move-nodes-between-sets-ui tests (epic graph-curation-ui, Story 1) ---
  FAIL  U1 (AC1/AC4): PLACEMENT_KINDS maps exactly element→HAS_ELEMENT and subset→IS_A_SUPERSET_OF
        ui/src/utils/placement.js does not exist yet — the pure placement-ops core (ADR graph-curation-ui/0001 decision 1) is not implemented.
  FAIL  U2…U7  (same feature-missing reason: placement.js absent)
  FAIL  U8…U10 (same feature-missing reason: relationships.js absent)
  FAIL  S1     ui/src/components/PlacementDialog.jsx does not exist yet — the shared dialog (ADR Option A) is not implemented.
  FAIL  S2     SetDetail must gate the new affordances on the owner/admin classification (the ElementDetail.jsx:19 pattern).
  FAIL  S3     SetDetail's elements query must gain a per-row EXISTS { … } AS direct flag — …
  FAIL  S4     ElementDetail must query the node's direct parents across BOTH placement kinds …
  FAIL  S5     ConceptDag must gate the new per-row affordance on owner/admin classification (AC6).
  PASS  H1 (sentinel, AC2): the EXISTS direct-placement flag distinguishes direct vs chain-inherited elements in real Neo4j
  PASS  H2 (sentinel, AC3): the direct-parents query returns each parent with its relationship type
  PASS  R1, R2, R3 (regression sentinels)

move-nodes-between-sets-ui: 5 passed, 15 failed, 0 skipped
…
relationship-primitives suite:                   PASS (23 passed, 0 failed)
relationship-primitives-probe suite:             PASS (9 passed, 0 failed)
move-nodes-between-sets-ui suite:                FAIL (5 passed, 15 failed)
Overall:                                         FAIL
```

Every failure is the feature's absence (no import errors, no typos). The two H sentinels passing
proves the ADR's `EXISTS { … }` subquery and `[r:HAS_ELEMENT|IS_A_SUPERSET_OF]` + `type(r)`
shapes against the running Neo4j before any UI embeds them. Pre-existing, unrelated:
`harness-lint suite: FAIL (1)` — the known BIBLE.md `Last updated` staleness (session-start
digest L9), present before this story.
