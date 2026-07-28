# ADR 0004: Tapestry per-concept detail views — Neo4j + LMDB read path

**Status:** Accepted
**Date:** 2026-07-25
**Story:** `engineering-team/stories/tapestries/4-per-concept-detail-views.md`
**Relationship to prior ADRs:** **Partially supersedes ADR `tapestries/0002` (Decision 2)** — for
per-concept *detail* data only. ADR 0002's other decisions (fresh view components; membership and the
tapestry-level integration graph rendered as-authored from strfry) **stand unchanged**.

## Context

Story `tapestries` #4 replaces today's per-concept view on the Exploration page
(`ui/src/pages/tapestries/TapestryDetail.jsx`) — which shows only a member concept's *concept-graph
JSON* (a 2-node header+superset skeleton) — with the Firmware Explorer's full per-concept experience:
**Overview**, the **8 core-node types** (Concept Header, Superset, JSON Schema, Primary Property,
Properties Set, Property Tree Graph, Core Nodes Graph, Concept Graph), and **Elements** and **Sets**.

Acceptance criteria (quoted):
1. **View parity** — Overview + 8 core-node types + Elements + Sets, replacing the single JSON view.
2. **Overview** — name/description + which core nodes exist / have JSON.
3. **Core-node JSON + source of truth** — Viewer/Raw toggle; the views surface core nodes/JSON **not
   present in the tapestry's authored strfry block**, proving the data comes from the instance's graph.
4. **Elements & Sets** — name-sorted list, Direct/Full scope, count, member JSON drill-down;
   membership from the instance's graph (structural, not POV-scoped).
5. **Graceful degradation** — concept/core-node absent from the graph → clear notice, no crash.
6. **No regression** of the tapestry-level Integration views.

### Constraints and findings (verified against the base this session)

- **Owner ontology (`docs/SELF_ONTOLOGY_DESIGN_HANDOFF.md`, Status OPEN).** neo4j = primary source of
  truth; **Tapestry LMDB = its low-latency cache**; strfry/nostr = secondary. Per-concept **node JSON
  → Tapestry LMDB**; **relationships → neo4j**. Membership (which concepts belong) stays authored from
  the tapestry nostr event.
- **The tension with ADR 0002.** ADR 0002 **Decision 2 rejected the Neo4j concept-graph API** as the
  data path (finding F2: Neo4j's json had "drifted" from the signed events after a firmware pass;
  "never depend on Neo4j for tapestry data") and chose strfry. That choice was correct for *membership
  and the composed integration graph*, and it is why today's per-concept view is thin: **strfry's
  `*-concept-graph` import carries only the header + superset** (verified: `dog-concept-graph` = 2
  nodes, `{slug,uuid}` only, no schema / primary-property / properties / JSON). The rich views are
  **impossible from strfry** — only Neo4j holds schema, primary property, properties, and the graph
  core nodes. The owner has since **ratified Neo4j as the definitive self**, which resolves the tension
  in Neo4j's favor and makes the drift a bug to fix (non-destructive reconciliation; a future
  "recompute JSON from Neo4j" affordance — both out of scope here).
- **LMDB resolution is server-side and currently a no-op.** `src/lib/tapestry-resolve.js`
  `resolveValue(v)` is **synchronous**: an `lmdb:<key>` pointer → `store.get(key).data`; any other value
  passes through unchanged. The store envelope's `data` is an **object** (`src/lib/tapestry-store.js:5`),
  whereas an inline json tag is a **string**. Empirically, **433 json tags exist and 0 are `lmdb:`
  pointers** (`/api/neo4j/query`), so today all JSON is inline. Routing reads through `resolveValue`
  therefore costs nothing now and transparently honors "JSON from LMDB" once offloading is enabled.
- **The client cannot resolve LMDB.** The LMDB store is embedded server-side. Any path that returns raw
  json-tag values to the browser (both `/api/concept-graph/node/:handle` and today's client
  composition) **cannot** satisfy the ontology for offloaded values — resolution must happen on the server.
- **The existing read paths.** The firmware read `GET /api/firmware/concept/:slug`
  (`src/api/firmware/index.js:175-277`) already produces the exact shape the UI wants —
  `{ nodes: { header, superset, schema, primaryProperty, properties, ptGraph, coreGraph, conceptGraph }
  }`, each `{uuid,name,json}` — via one `OPTIONAL MATCH` **already keyed on the header `uuid`**
  (`:210`). Only its *header lookup* is firmware-specific (slug → manifest → match by `names` tag,
  `:181-207`), and it returns `parseJson(rawValue)` **without** LMDB resolution. The concept-graph
  `GET /node/:handle/neighbors` returns all 8 core-node edges + `HAS_ELEMENT` (verified for
  `39998:<TA>:dog`) but no JSON. `ConceptMembersView` (`ui/src/pages/settings/ConceptMembersView.jsx`)
  already takes `{headerUuid, kind, scope}` and reads members' relationships + JSON from neo4j via
  `/api/neo4j/query` (`src/api/conceptMembers.js`) — **already handle-keyed and reusable**.
- **Member header handles are already in hand.** `useTapestryGraph` composes the tapestry graph; member
  nodes with `inferNodeType(n) === 'conceptHeader'` carry `uuid = 39998:<TA>:<slug>` — the handle the
  new read path needs. `<TA>` is runtime-resolved (never hardcode).

## Options considered

### Decision 1 — Source of truth for per-concept detail data

**Option A — strfry, as-authored (ADR 0002's choice).** *Rejected.* The imports carry only
header+superset; the schema / primary-property / properties / core-graph nodes and their JSON are not
in strfry at all. Cannot satisfy AC 1–4.

**Option B — neo4j (relationships + node identity) + Tapestry LMDB (node JSON) — chosen.** Matches the
owner ontology; it is the *only* source that has the data. **Partially supersedes ADR 0002 Decision 2**
for per-concept detail; membership + the tapestry-level integration graph remain strfry-sourced (ADR
0002 unchanged there). Trade-off: the detail views reflect **Neo4j's** state, which may differ from the
signed event (the F2 drift). Per the ratified ontology that is *correct* (Neo4j is the self);
reconciliation / recompute-from-Neo4j are the backstops, deferred.

### Decision 2 — How to fetch the 8 core nodes + JSON by header handle

**Option A — client composes from existing concept-graph endpoints** (`/node/:h/neighbors` → then
`/node/:coreHandle` per core node). *Rejected:* 1 + up-to-8 round-trips per concept, **and it cannot
LMDB-resolve** (client can't reach the store) — so it violates the ontology the moment JSON is offloaded.

**Option B — a server-side, handle-keyed read that LMDB-resolves — chosen.** Extract the firmware
endpoint's core-node query (already `uuid`-keyed) into a shared helper that runs the same Cypher, then
maps each json value through `resolveValue` before returning the `{nodes:{…}}` shape. Expose it at
`GET /api/concept-graph/node/:handle/core-nodes`. This **generalizes an existing read** (same query,
keyed by handle, plus the LMDB step the ontology requires) rather than inventing new derivation — the
warranted-endpoint bar the epic sets ("no new backend *unless* measured"): client-side resolution is
impossible, so a server path is required. The firmware endpoint is rewired to the same helper
(behavior-identical today — 0 pointers — and it gains LMDB-correctness for free), keeping one copy of
the query.

### Decision 3 — UI reuse

**Option A — copy the Firmware Explorer's per-concept idiom into a tapestry component** (ADR 0002's
"build fresh" precedent). *Alternative;* avoids touching the firmware page but duplicates ~95 lines
(`FirmwareOverview`, `FirmwareNodeJson`) that would drift.

**Option B — extract the small, already-generic pieces into a shared module + reuse the
already-standalone `ConceptMembersView` — chosen.** `FirmwareOverview` and `FirmwareNodeJson` already
consume the generic `{nodes:{…}}` shape (no firmware-manifest coupling, unlike the integration-graph
components ADR 0002 deliberately avoided), so extracting them is mechanical and low-risk.
`ConceptMembersView` is already exported and handle-keyed — import it directly. Trade-off: touches the
shipped Firmware Explorer's imports → it joins the regression-test surface (Tester/Reviewer must confirm
it renders identically).

## Decision

Adopt **Option B in all three decisions.** Per-concept detail data comes from **neo4j + Tapestry LMDB**
via a new **server-side, handle-keyed, LMDB-resolving** read (`GET
/api/concept-graph/node/:handle/core-nodes`) backed by a shared helper that the firmware endpoint is
rewired onto. The tapestry per-concept view is built from **shared, extracted** presentational pieces
(`ConceptOverview`, `ConceptNodeJson`, `CORE_NODES`) plus the **existing** `ConceptMembersView`.
Membership and the tapestry-level Integration views are untouched (still strfry, per ADR 0002).

## Consequences

- **Enables** full Firmware-Explorer parity for each tapestry concept, sourced from the instance's
  authoritative graph, with JSON read through the LMDB resolver (correct now; future-proof under
  offloading).
- **Narrows ADR 0002 Decision 2**: "never depend on Neo4j for tapestry data" now holds only for
  membership + the composed integration graph; per-concept *detail* depends on Neo4j by design. A
  forward-pointer note is added to ADR 0002.
- **Drift caveat (F2).** Detail views reflect Neo4j state, which can diverge from the signed
  `*-concept-graph` event (e.g. the known `dog-concept-graph` desync). Acceptable under the ratified
  ontology. **The Tester must assert against Neo4j / the concept-graph API, not strfry.**
- **Mixed-source page.** One Exploration page now reads membership + integration graph from strfry and
  per-concept detail from neo4j+LMDB. Intentional and documented; a later story may migrate the rest.
- **Regression surface.** The firmware endpoint (rewired to the shared server helper) and the Firmware
  Explorer page (imports the extracted components) must be regression-checked — behavior is meant to be
  identical.
- **Deferred debt:** (a) member-JSON in `ConceptMembersView` is still read raw via `/api/neo4j/query`
  (no LMDB resolution) — a no-op today (0 pointers), to be closed when offloading is enabled, same gap
  the firmware page already has; (b) the "recompute JSON from Neo4j" button (owner-deferred); (c)
  POV/WoT filtering (epic-deferred).
- **Firmware reinstall required?** **No** — no concept definitions change.

## Implementation notes

**Server**
- **New `src/lib/conceptCoreNodes.js`** — `async getConceptCoreNodes(headerUuid)`. Runs the 8-core-node
  `OPTIONAL MATCH` Cypher **moved verbatim** from `src/api/firmware/index.js:209-244` (keyed on
  `{uuid: headerUuid}`). Build `{ header, superset, schema, primaryProperty, properties, ptGraph,
  coreGraph, conceptGraph }`, each `{ uuid, name, json }`, where
  `json = coerce(resolveValue(rawValue))` and `coerce(v)` = `null` if falsy, `JSON.parse(v)` if a
  string, else `v` as-is (LMDB envelopes return objects). Return `{ found: boolean, nodes }`
  (`found=false` when the header uuid matches no node).
- **`src/api/concept-graph/index.js`** — register `GET /api/concept-graph/node/:handle/core-nodes` →
  `getConceptCoreNodes(decodeURIComponent(handle))` → `{ success, handle, found, nodes }`. Place the
  route **before** the existing `/node/:handle` registration is unaffected (distinct suffix, like
  `/neighbors` at `:195`).
- **`src/api/firmware/index.js`** — in `handleConcept`, replace the inline query+shaping block
  (`:209-262`) with `const { nodes } = await getConceptCoreNodes(headerUuid)`. Header lookup and the
  `installed:false` branch are unchanged. (Behavior-identical today; adds LMDB-resolution.)

**Client**
- **New `ui/src/api/conceptCoreNodes.js`** — `fetchConceptCoreNodes(handle)` → GET the new endpoint,
  throw on `!success`, return `{ found, nodes }`.
- **New shared module `ui/src/components/concept/CoreNodeViews.jsx`** — export `CORE_NODES` (the 9-entry
  list incl. `overview`), `ConceptOverview` (extracted from `FirmwareExplorer.jsx:573-618`
  `FirmwareOverview`), and `ConceptNodeJson` (extracted from `:905-960` `FirmwareNodeJson`). Verbatim
  move; only the names generalize.
- **`ui/src/pages/settings/FirmwareExplorer.jsx`** — delete the inline `CORE_NODES`, `FirmwareOverview`,
  `FirmwareNodeJson`; import `{ CORE_NODES, ConceptOverview as FirmwareOverview, ConceptNodeJson as
  FirmwareNodeJson }` from the shared module. No other change (the page's `MEMBER_VIEWS`, integration
  code, and `ConceptMembersView` usage stay).
- **`ui/src/pages/tapestries/TapestryDetail.jsx`** — replace `ConceptDetail` (the JSON-only view,
  `:73-90`) with a firmware-style per-concept panel: a `.firmware-node-tabs` bar (Overview → the 8 core
  nodes → divider → Elements, Sets), fetching `fetchConceptCoreNodes(concept.uuid)` for the selected
  member (its `uuid` is the `39998:<TA>:<slug>` handle from `composed.nodes`). Route content:
  `overview` → `<ConceptOverview data={coreData}/>`; a core-node key → `<ConceptNodeJson data={coreData}
  nodeKey={key}/>`; `elements`/`sets` → `<ConceptMembersView conceptData={coreData} kind={key}/>`
  (import from `ui/src/pages/settings/ConceptMembersView.jsx`). Show loading / `found:false` /
  not-in-graph states (reuse the components' own missing-node handling). The sidebar's **Integrations**
  section and all tapestry-level views are **unchanged**.
- Reuse directly: `ConceptMembersView`, `JsonView`, existing `.firmware-*` CSS classes. No new deps.

**Docs**
- Add a one-line forward-pointer to `engineering-team/decisions/done/tapestries/0002-…md` noting Decision
  2 is partially superseded by this ADR for per-concept detail data.

Test-file changes (fixtures, suite re-aims, authoring a test tapestry to exercise the page) belong to
Phase 3 (Tester), not here.

## Out of scope
- Migrating membership or the tapestry-level integration graph off strfry (only per-concept detail moves).
- LMDB resolution for `ConceptMembersView` member JSON (no-op today; deferred to when offloading lands).
- "Recompute JSON from Neo4j" button; POV/WoT filtering; editing.
- Any change to the concept-graph schema or firmware definitions (no reinstall).
