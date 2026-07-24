# PRD Seed: Tapestries

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/tapestries/audit.md`
**Anchor:** acceptance frame in `book.md`
**Confidence:** medium — grounded in a verbatim operator acceptance frame + two operator-gated build cycles, but never validated as a product spec.
**Date:** 2026-07-24

> A reverse-engineered baseline in the product-team PRD shape, built from what shipped. A **strawman for the product team**, not a ratified spec. Sections tagged `[FROM FRAME]`, `[INFERRED]`, or `[UNKNOWN — product input needed]`. Adopt as the starting point for `/discover` on the next phase (Create / Edit Tapestry) and validate each section.

## 1. Product vision

`[FROM FRAME]` Tapestries let a user **browse and explore Tapestries** — curated collections of concepts grouped under a common theme or purpose, integrated with one another (subsets, elements, enumerations). `[INFERRED]` The value is legibility: the knowledge graph already holds concepts and their integrations, but there was no way to *see a curated slice of it* as a coherent, self-describing unit. A Tapestry is a subset of Graph ("a graph of concept graphs"); this phase makes them reachable and explorable read-only. `[UNKNOWN]` The end-user goal a Tapestry ultimately serves (teaching? auditing a domain? sharing a curated view with others?) was never stated — only the mechanism.

## 2. Personas

`[INFERRED]` from the acceptance frame and the "As any visitor" story lines:
- **The explorer** (any visitor, signed-in or not): opens a Tapestry to understand what concepts it groups and how they relate. Read-only; public.
- **The curator** (`[UNKNOWN]` — implied by the deferred create/edit features): will assemble a Tapestry from concepts and assert their integrations. Not yet built; the whole authoring persona is unvalidated.

## 3. Scope (as-built)

`[FROM FRAME]` **In scope now (shipped):** a Tapestries nav area; a directory of all tapestries; an inert Create placeholder; a per-tapestry Exploration page (concept sidebar + integration graph + enumerations/elements/subsets tables + JSON viewer), modeled on the Firmware Explorer's read-only views and rendered from the tapestry's own definition.
`[FROM FRAME]` **Explicitly out (deferred):** creating a Tapestry; editing a Tapestry. `[INFERRED]` also deferred: POV/WoT filtering of which tapestries are shown; seeding real tapestries onto staging/prod (only local seed data exists).

## 4. Domain model

`[INFERRED]` from the concepts touched + ADRs:
- **Tapestry** (`39998:<TA>:tapestry`) — a concept whose *elements* are individual tapestries (kind-39999 addressable events). A Tapestry is a subset of **Graph**, so each element also validates as a graph.
- **Graph-embedding convention** (the load-bearing model this book established): a tapestry element's JSON carries a top-level **`graph`** block beside `tapestry`:
  - `nodes` — the member concepts / supersets / synthetic property nodes `{slug, uuid?, name?}`
  - `relationshipTypes` — `{slug (semantic, e.g. CLASS_THREAD_PROPAGATION), alias (Neo4j label, e.g. IS_A_SUPERSET_OF)}`
  - `relationships` — the asserted integrations `{nodeFrom, relationshipType, nodeTo}` (by slug)
  - `imports` — the member concepts' `*-concept-graph` core nodes, resolved at read time
- **Read model:** tapestries and their imports are read from **strfry** (the durable source of truth), not the Neo4j projection. `[UNKNOWN]` whether tapestry membership should ultimately be defined by the `graph` block (as now), by explicit membership edges, or both — the seed used author-asserted relationships; the "right" membership contract is a product/domain question for the authoring phase.

## 5. Design rules (as-built)

`[INFERRED]` from the shipped UI + reviews:
- The Exploration page reuses the Firmware Explorer's read-only visual language (superset ▲ / concept-header ◆ / property ■; the same edge colors and vis-network layout) but drops firmware-lifecycle controls (install / version / constraints).
- Node labels read cleanly from `node.name` (the Firmware Explorer's "dog-breedss" plural artifact was deliberately not reproduced).
- Directory rows mirror the app's other directory pages (title/description/author, `DataTable`, empty state). `[UNKNOWN]` no written design guide exists for Tapestries — these are conventions read off the code, not ratified rules.

## 6. Carry-forward & open questions

Promoted from `audit.md` §6:
- Create-a-Tapestry and Edit-a-Tapestry authoring (the next phase; operator starting it).
- Publishing the wire-level `graph` z-tag on tapestry elements; transitive import expansion.
- POV/WoT filtering of the directory; seeding real tapestries onto staging/prod.
- Neo4j-desync root cause (OPEN.md #88); shared-`GraphExplorer` consolidation; review nits (OPEN.md #89/#90).

## 7. What product must validate

- [ ] **The authoring UX** — how a curator creates a Tapestry (pick concepts? assert integrations? auto-derive from existing edges?) and edits one. This is the whole next phase and is entirely `[UNKNOWN]`.
- [ ] **Membership contract** — is a Tapestry's content the author's `graph` block, live-derived edges, or a hybrid? (§4)
- [ ] **Visibility model** — tapestries are currently public and unfiltered; should the directory be POV/WoT-filtered, and can anyone publish a tapestry others see? (decentralized-first says publishing is permissionless; the *view* is the open question.)
- [ ] **What a Tapestry is *for*** — the end-user job (§1 `[UNKNOWN]`), which should drive the authoring design.
- [ ] **Seeding / demo strategy** — real tapestries need to exist on staging/prod to be exercised; today only local seed data exists.
