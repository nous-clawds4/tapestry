# ADR 0002: Tapestry Exploration page — as-authored rendering + graph-embedding convention

**Status:** Proposed
**Date:** 2026-07-23
**Story:** `engineering-team/stories/tapestries/2-tapestry-exploration-page.md`

## Context

Story `tapestries` #2 replaces the Story-1 placeholder `ui/src/pages/tapestries/TapestryDetail.jsx`
(route `/tapestry/tapestries/:uuid`) with a real **Exploration page**: it shows a tapestry's member
concepts and the integrations between them, modeled on the **read-only** views of the Firmware
Explorer (concept sidebar, integration graph, integration tables, JSON viewer), scoped to one
tapestry and rendered **as-authored** from the tapestry element's own `graph` block plus resolved
`graph.imports`. Epic guardrails (`epics/tapestries.md`): no new backend, uuid routing, no hardcoded
TA pubkey, drop install/version/constraints.

**The tapestry element carries a self-describing `graph` block.** The seed element
`39999:<TA>:tapestry-for-dog-ca3b675e` (read from strfry per ADR `tapestries/0001`) has:
- `graph.nodes` (9): 4 concept-headers (`dog`, `dog-breed`, `irish-setter`, `golden-retriever`),
  their 4 supersets, and a synthetic `dog.breed` **property node** (slug-only, no uuid — there is no
  real Neo4j property node for a schema field).
- `graph.relationshipTypes` (3): each `{slug, alias}` — semantic slug (`CLASS_THREAD_PROPAGATION`)
  + Neo4j edge label (`IS_A_SUPERSET_OF`); likewise TERMINATION/`HAS_ELEMENT`, ENUMERATION/`ENUMERATES`.
- `graph.relationships` (5): `dog-breed-superset ENUMERATES dog.breed`; `dog-breed-superset
  HAS_ELEMENT` the two breed headers; `dog-superset IS_A_SUPERSET_OF` the two breed supersets.
- `graph.imports` (4): the `*-concept-graph` core nodes for the 4 member concepts.

Two orientation findings drive the design (verified against the current base, 2026-07-23):

- **F1 — the Firmware Explorer view components are inline and firmware-shaped.** `IntegrationGraph`
  (`FirmwareExplorer.jsx:981–1293`), `IntegrationPanel` (`:622–793`), etc. are module-private (the
  only export is the page itself, `:36`). They read the firmware **manifest** (`sets`/`elements`/
  `enumerations` with `existing-nodes`/`existing-sets`) and **author** each node's `type` from the
  section they're walking (`ensureSuperset`/`ensureConceptHeader`/property helpers, `:994–1069`) —
  there is no type inference. `JsonView` (`JsonView.jsx:124`) is the one genuinely-generic export.
  The plural-label bug is `:997` (`slugToPlural[slug] || slug + 's'` on already-plural keys → the
  "dog-breedss" artifact); there's also a dead effect-cleanup `return` at `:1209` (the live cleanup
  is the outer effect return `:1212–1217`).
- **F2 — strfry is the canonical import source; the Neo4j API has drifted.** Both
  `GET /api/concept-graph/node/:handle` (Neo4j) and a strfry `queryRelay` return the concept-graph's
  `graph` block (as a stringified `json` tag). But for `dog-concept-graph` they **disagree** (strfry:
  1 nested import; Neo4j/API: 2; different event ids) — a firmware pass mutated Neo4j's json in place
  without re-publishing. `/api/strfry/scan` forwards any Nostr filter verbatim (`src/api/strfry/
  queries/scan.js`) and supports `authors`+`#d` together (verified). OPEN.md #87's element-drop is
  **flapping** (present again right now, as an orphan `ListItem`) — reinforcing "never depend on
  Neo4j for tapestry data".
- **F3 — one-level import resolution is cheap.** The 4 imports' nodes (header+superset each) are
  already among the tapestry's own 9 nodes; resolving them one level adds only 4 `IS_THE_CONCEPT_FOR`
  edges (+1 rel type). The real node payload (schemas, properties) lives one level deeper
  (`property-tree-graph` / `core-nodes-graph`, which terminate with `imports:0`).

## Options considered

### Decision 1 — how to render the Firmware-Explorer-style views
**Option A — extract & generalize the Firmware Explorer's components into shared modules** that both
pages consume via a normalized `{nodes, edges}` model + a per-source adapter.
- Pros: DRY; one integration-graph implementation.
- Cons: refactors a **shipped owner-only page** (regression surface on Firmware Explorer, needs its
  own story/tests); must reconcile the manifest vocabulary + the type-authoring-vs-inference
  mismatch; inherits/forces-fixing the `:997` and `:1209` bugs mid-refactor. Rejected for this story.

**Option B — build fresh tapestry-specific view components that copy the idiom (chosen)**, driving
off the composed tapestry graph model, reusing `JsonView` directly.
- Pros: no change to the shipped Firmware Explorer; the components consume the clean
  `{nodes, relationshipTypes, relationships}` model natively; we add the type inference the tapestry
  needs and skip the two known bugs; matches the story's "modeled after" (not "reuse exact").
- Cons: duplicates the ~300-line vis-network block + the table/grouping idiom. Accepted; a later
  consolidation story can extract a shared `GraphExplorer` once a 2nd consumer justifies it.

### Decision 2 — import resolution data path
**Option A — concept-graph API (`/api/concept-graph/node/:handle`)** — Neo4j-backed; rejected: it
can't even serve the root element (ADR 0001), and F2 shows it has drifted from the signed events.
**Option B — strfry `queryRelay` (chosen)** — resolve each import by `queryRelay({kinds:[39999],
authors:[pubkey], "#d":[dTag]})` (pubkey/dTag parsed from the import's `uuid`), uniform with the
element read. One data path, one trust model, decentralized-first, immune to the Neo4j reconcile.

### Decision 3 — resolution depth
**One-level (chosen default)** — resolve the concept-graphs named in `graph.imports`; do not expand
their nested imports. Satisfies the AC ("resolves those imports and includes their concepts/
relationships"), is cheap (F3), and the element's own graph block already carries the substantive
cross-concept integrations. **Transitive** (property-tree/core-nodes) is deferred to a future opt-in
"expand" affordance — it's where the large payload is, and it needs the `dog-concept-graph` publish
desync (F2) fixed first.

## Decision
Build the Exploration page as **fresh tapestry-specific components (Option B)** that render an
**as-authored composed graph model**: parse the element's `graph` block (from strfry), resolve
`graph.imports` **one level via strfry `queryRelay`**, compose + dedup into
`{nodes, relationshipTypes, relationships}`, infer node types and normalize relationship types to
their canonical aliases, and render the Firmware-Explorer-style read-only views off that model.
Reuse `JsonView` directly; do not reuse the Neo4j-coupled `ConceptMembersView`.

## Consequences
- **Enables** a self-describing, POV-neutral exploration view that renders exactly what a tapestry
  author asserted, plus the imported concept spines — no Neo4j dependency, no new backend.
- **Establishes** the graph-embedding convention (below) that the future Create/Edit-Tapestry
  authoring features will target.
- **Constrains:** a second integration-graph implementation now exists alongside the Firmware
  Explorer's; they may drift. Logged as a future consolidation candidate (see Out of scope).
- **Deltas vs the Firmware Explorer:** node type is inferred (not authored); labels come from
  `node.name` (no "ss" bug); relationship types are normalized via a canonical slug↔alias table;
  per-concept detail shows the resolved concept-graph JSON (not live Neo4j members).
- **Follow-ups:** transitive import expansion; the `dog-concept-graph` strfry↔Neo4j publish desync
  (a seed defect — re-publish to fix; only bites transitive resolution). Both noted, not blocking.
- **Firmware reinstall required?** No — no concept definitions change.

## Implementation notes

The `:uuid` route already points at `ui/src/pages/tapestries/TapestryDetail.jsx` (Story 1) — rebuild
that file's body; no `App.jsx`/`Layout.jsx` change needed. Suggested module split:

- **`ui/src/pages/tapestries/tapestryGraphModel.js`** — PURE helpers (no React → unit-testable in the
  node runner):
  - `CANONICAL_RELS` — the slug↔alias table: `CLASS_THREAD_PROPAGATION↔IS_A_SUPERSET_OF`,
    `CLASS_THREAD_TERMINATION↔HAS_ELEMENT`, `PROPERTY_ENUMERATION↔ENUMERATES`, plus the core-node
    aliases pass through as-is (`IS_THE_CONCEPT_FOR`, …).
  - `toAlias(relTypeSlug, relTypesFromGraph)` → canonical alias. Resolve via the graph's own
    `relationshipTypes[].alias` when present, else the `CANONICAL_RELS` table, else pass through
    (imported concept-graphs already store the alias form as `slug`).
  - `inferNodeType(node)` → `'conceptHeader' | 'superset' | 'property' | 'other'`:
    `uuid` starts `39998:` → `conceptHeader`; slug starts `superset-for-` or uuid ends `-superset`
    → `superset`; no `uuid` (synthetic, e.g. `dog.breed`) → `property`; else `other`.
  - `composeGraph(elementGraph, importedGraphs[])` → `{ nodes, relationships, relationshipTypes }`
    deduped: nodes by `slug` (keep the first non-empty `name`/`uuid`), relationships by
    `nodeFrom.slug | alias | nodeTo.slug`, relationshipTypes unioned into a slug→alias map.
  - `groupRelationships(composed)` → `{ enumerations, elements, subsets, spine }` bucketed by alias
    (`ENUMERATES` / `HAS_ELEMENT` / `IS_A_SUPERSET_OF` / `IS_THE_CONCEPT_FOR`) for the tables.
- **`ui/src/pages/tapestries/useTapestryGraph.js`** — the pipeline hook (React):
  1. Read the element: `queryRelay({kinds:[39999], authors:[pubkey], "#d":[dTag]})` (parse
     `pubkey`/`dTag` from `uuid` via the existing `parseUuid` in `TapestryDetail.jsx:13-22`).
  2. Parse its `json` tag → `{ tapestry, graph }`.
  3. Resolve imports one level: for each `graph.imports[i].uuid`, `queryRelay({kinds:[39999],
     authors:[pubkey], "#d":[dTag]})`, parse each `json` tag's `graph` block. A failed/absent import
     is skipped (not fatal).
  4. `composeGraph(...)`. Return `{ loading, error, tapestry, rawGraph, composed, degraded }` where
     `degraded=true` when the element exists but has no/invalid `graph` block.
- **`ui/src/pages/tapestries/TapestryDetail.jsx`** (rebuilt) — the page container: `<Breadcrumbs/>`,
  a two-pane layout (reuse the existing `.firmware-layout` / `.firmware-sidebar` / `.firmware-content`
  CSS to avoid new styles — or add `.tapestry-*` aliases), a sidebar listing member concepts (nodes
  of type `conceptHeader`) + an Integrations section (`Integration Graph`, `Enumerations`,
  `Elements`, `Subsets`), and a content area switching on selection:
  - integration graph → `<TapestryIntegrationGraph composed={composed} />`;
  - a table view → grouped rows from `groupRelationships` (copy the `IntegrationPanel` table idiom,
    minus the firmware-specific `IntegrationDetail`/columns);
  - a member concept → its resolved concept-graph `graph` block via `<JsonView data={…} />` + a
    Viewer/Raw toggle (copy the ~5-line toggle from `FirmwareExplorer.jsx:936-957`);
  - a "JSON" view → the element's raw `graph` block via `<JsonView>`.
  - **Degraded/empty:** if `degraded`, show the tapestry title + a clear "This tapestry has no graph
    to explore yet" notice (no crash, no raw error); if the element itself isn't found, an empty
    state. (Keeps the Story-1 uuid-stability behavior: identity is the uuid, unaffected by edits.)
- **`ui/src/pages/tapestries/TapestryIntegrationGraph.jsx`** — vis-network view: copy the idiom from
  `IntegrationGraph` (`FirmwareExplorer.jsx:981-1293`) — `GRAPH_COLORS`/`GRAPH_EDGE_COLORS`
  (`:967-979`), triangle/diamond/box shapes, physics + freeze-on-`stabilized`, the legend, the
  click-tooltip, the lazy `import('vis-network/standalone')` (existing dep — no new package) — but:
  (a) build nodes from `composed.nodes` typed via `inferNodeType`; (b) build edges from
  `composed.relationships` colored by `toAlias(...)`; (c) label nodes from `node.name` (**not** a
  re-pluralized slug — avoids the `:997` "ss" bug); (d) use the **outer** effect-return cleanup only
  (skip the dead `:1209` inner return).

Reuse directly: `JsonView` (`ui/src/components/JsonView.jsx`), `Breadcrumbs`, `queryRelay`
(`ui/src/api/relay.js`), the existing `vis-network` dependency. No hardcoded TA pubkey (the element
read is by uuid; import handles come from the element's own `graph.imports`).

Test-file changes (suite re-aims, fixtures) belong to Phase 3 (Tester), not here.

## Out of scope
- **Transitive import expansion** (property-tree-graph / core-nodes-graph) — deferred opt-in; gate on
  fixing the `dog-concept-graph` publish desync (F2) first.
- **Extracting a shared `GraphExplorer`** component unifying this page and the Firmware Explorer —
  future consolidation story once a 2nd consumer justifies it.
- Reusing `ConceptMembersView` — it's Neo4j/firmware-topology-coupled; per-concept detail uses the
  resolved concept-graph JSON instead.
- Editing tapestries; POV/WoT filtering; install/version/constraints controls.
