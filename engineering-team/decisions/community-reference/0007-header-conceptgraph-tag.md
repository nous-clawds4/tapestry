# ADR 0007: Header→ConceptGraph self-describing tag (hybrid)

**Status:** Accepted
**Date:** 2026-05-19
**Story:** `engineering-team/stories/10-header-conceptgraph-tag.md`
**Relates to:** ADR 0006 (deferred this stream), BIBLE §22

## Context
Off-relay, a single kind-39998 Header can't resolve its concept (the `IS_THE_CONCEPT_GRAPH_FOR` Neo4j edge is invisible without the graph). The Concept Graph a-tag is deterministically `39999:<pubkey>:<slug>-concept-graph` (`src/api/normalize/index.js:643`). Ratified design **C (hybrid)**: emit an explicit tag on new headers; resolution = **tag-if-present else compute**. Tapestry's tag idiom (BIBLE §5) is custom semantic tags — `["z","39998:<pubkey>:<dtag>"]`, `["json",…]`, `["d",slug]`; it deliberately does NOT use NIP-01 `a` tags for its pointers. Header build site: `handleCreateConcept` (`src/api/normalize/index.js:1183`).

## Options considered — the tag shape
- **Option A (chosen) — descriptive custom tag** `["concept-graph", "39999:<pubkey>:<slug>-concept-graph"]`. Mirrors the existing `z`/`json`/`d` custom-semantic idiom; value reuses the exact `kind:pubkey:dtag` form `z` uses; self-describing in `strfry scan`; the role name `concept-graph` already exists in code vocabulary (NODE_ROLES, slugs). Trivial emit/consume.
- **Option B — NIP-01** `["a","39999:…-concept-graph","<relay-hint>","concept-graph"]`. NIP-01-standard + relay-hint slot, but inconsistent with Tapestry's non-NIP-01 pointer idiom; relay-hint slot unneeded (importer already has `communityReference.relayHints`; per BIBLE §22 relay invariant the curator's concept-graph rides the same relay as their header); multi-`a`+marker parsing heavier. Rejected.
- **Option C — no tag (convention-only).** = Discovery option B, rejected by the owner (folds into #5, not self-describing). Noted for completeness.

## Decision
**Option A.** Descriptive custom `concept-graph` tag, value `39999:<header-pubkey>:<header-dtag>-concept-graph`, **computed** (not Neo4j-looked-up — correct even before the concept-graph node exists). Resolution contract: **tag-if-present else compute**. New headers only — hybrid C, no mass re-emit.

## Consequences
- Unblocks stream #5 (resolve a fetched Header → its Concept Graph: explicit tag, or computed fallback for legacy/firmware headers).
- `create-concept` emits one extra tag; firmware reinstall regenerates firmware headers with it (deterministic ⇒ idempotent, strfry-replaceable; no special migration).
- BIBLE §5/§8 + glossary document the tag and the tag-else-compute contract. **BIBLE update required.**
- No consumer yet; zero behavior change for anything not reading the tag.
- **Firmware reinstall required?** Recommended (so prod firmware headers become self-describing) but NOT required for correctness — the compute-fallback resolves un-reinstalled/legacy headers.
- **Blast radius:** `handleCreateConcept` (one tag) + BIBLE docs. Explicitly NOT an every-prod-header re-emit.

## Implementation notes
- `src/api/normalize/index.js` `handleCreateConcept` (~:1183): when assembling the kind-39998 header tags, add `['concept-graph', \`39999:${pubkey}:${dTag}-concept-graph\`]` (pubkey = header/TA pubkey; dTag = header d-tag/slug). Pure compute — no graph lookup.
- Idempotent: same inputs → identical tag → strfry-replaceable; Neo4j MERGE-on-uuid unaffected.
- BIBLE.md: §5 tag vocabulary + the tag-else-compute resolution contract; §8 note; glossary entry; state hybrid (legacy resolves by compute).
- Tester: structural sentinel that `handleCreateConcept` emits the deterministic tag; behavioral proof = cycle-local (firmware reinstall, `strfry scan`, assert the 39998 header carries `["concept-graph","39999:<TA>:<slug>-concept-graph"]`).
- No change to materialization / REFERENCES / `communityReference` / export.

## Out of scope
Consumption/traversal of the pointer (that **is** stream #5); mass re-emit/backfill of existing prod headers; policing foreign-curator tagging (compute-fallback + explicit tag both resolve).
