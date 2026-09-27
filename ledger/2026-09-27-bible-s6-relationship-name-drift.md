# BIBLE §6 spells three relationships and one node label differently from the code and the live graph, and gives ENUMERATES endpoints that firmware does not write

**Id:** 2026-09-27-bible-s6-relationship-name-drift
**Type:** docs
**Opened:** 2026-09-27 (tagging-edges #1, kickoff orientation map of BIBLE §6; re-checked against code and the local stack)
**Status:** OPEN
**Done:** —

**What was seen.** Checked 2026-09-27 against the code, the firmware and the local stack's concept-graph API. Line
numbers are `BIBLE.md` at `origin/staging` `72469bde`.

- **`AUTHORED`** (Infrastructure table, `:289`). The code writes `AUTHORS`: `src/api/neo4j/eventSync.js:207` and
  `src/manage/concept-graph/apocCypherCommand1_conceptGraph:6`. Firmware registers `AUTHORS`
  (`concepts/relationship-type/elements/authors.json`). The canonical `nostr-user-tag` header's neighbours on the local
  stack include an `AUTHORS` edge. `AUTHORED` appears in no file under `src/`, `ui/src/` or `firmware/`.
- **`IS_THE_CORE_NODES_GRAPH_FOR`** (Core Node Wiring, `:251`). The alias is `IS_THE_CORE_GRAPH_FOR`
  (`elements/core-node-core-graph.json`), and `/api/concept-graph/node/39998:<TA>:relationship-type/neighbors` returns
  that name.
- **`IS_THE_PROPERTIES_FOR`** (`:249`). The alias is `IS_THE_PROPERTIES_SET_FOR` (`elements/core-node-properties.json`),
  and the same neighbours call returns it.
- **The `ClassThreadHeader` label** (`:227`). The code sets `ConceptHeader` (`src/api/normalize/index.js:384`,
  `:1282`), and the audit checks for it (`src/api/audit/index.js:177-184`). All 54 concept headers in
  `/api/concept-graph/summaries` carry `ConceptHeader`, and none carries `ClassThreadHeader`. The label table does not
  list `ConceptHeader` at all, though §6's own relationship tables use it. Nothing writes `ClassThreadHeader`. Readers
  still accept it as an alternative in 18 Cypher `WHERE` clauses (`src/api/normalize/index.js`,
  `src/api/property/index.js:21`, `src/api/adoption/index.js:276`). `docs/NORMALIZATION_TOOLING.md:97` and
  `docs/NEO4J_OPTIMIZATION.md:154` repeat the old name.
- **`ENUMERATES`** (Property Relationships, "Superset → Property"). Firmware install writes Superset → JSONSchema, with
  `sourcePath` and `destinationPath` properties (`src/firmware/install.js:731-733`), and `src/api/normalize/index.js:5797`
  reads it that way. The firmware element's description says Concept Header → Property
  (`elements/property-enumeration.json`). The wiring audit's rule expects ListHeader → Property
  (`src/api/audit/index.js:141`). On the local stack, `GET /api/audit/wiring` reports all five ENUMERATES edges as
  violations, and each of them is Superset → JSONSchema.
- **The tag-level `REFERENCES`** (`NostrEventTag → NostrEvent`, written at `eventSync.js:240`) is missing from the
  Infrastructure table. The Editorial table names it only to tell it apart from the concept-level one.

The other class-thread and core-node wiring names in §6 match the firmware aliases.

**Fix shape.** A doc-lane PR that corrects §6:
- the three relationship names;
- `ConceptHeader` in the label table, with `ClassThreadHeader` described as a legacy label that readers still accept,
  if that is the intent;
- ENUMERATES' real endpoints and properties;
- the tag-level `REFERENCES` in the Infrastructure table.

Correct the two `docs/` files in the same PR. The audit's ENUMERATES rule is code, so the doc lane can name the
one-line fix but cannot make it.

**Pointer:** `BIBLE.md` § 6 "Neo4j Node Labels" and "Relationship Types"; `firmware/versions/v1.0.0/concepts/relationship-type/elements/`;
the tagging-edges kickoff orientation (ADR `engineering-team/decisions/tagging-edges/0001-tagging-edge-contract.md`
§ Context, "Concepts").
