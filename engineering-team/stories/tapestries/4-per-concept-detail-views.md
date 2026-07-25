# Story 4: Per-concept detail views in the Tapestry exploration page (Firmware-Explorer parity)

**Status:** Approved
**Created:** 2026-07-25
**Type:** Feature

## Background

Story #2 built the tapestry exploration page. Today, selecting a member concept shows **only its
concept-graph JSON** — a 2-node header+superset skeleton, rendered as-authored from the tapestry's
strfry event. That's the thinnest possible view of a concept.

The **Firmware Explorer** (`ui/src/pages/settings/FirmwareExplorer.jsx`) offers a much richer
per-concept experience: an **Overview**, the **8 core-node types** (Concept Header, Superset, JSON
Schema, Primary Property, Properties Set, Property Tree Graph, Core Nodes Graph, Concept Graph), and
**Elements** and **Sets**. Users want that same depth for each concept inside a tapestry.

**Owner data-source constraint (intent, for the Architect to honor).** Per the owner's ontology
(`docs/SELF_ONTOLOGY_DESIGN_HANDOFF.md`): **neo4j is the primary source of truth; Tapestry LMDB is
its low-latency cache; strfry/nostr are secondary.** Therefore each concept's **node JSON must come
from Tapestry LMDB** and its **relationships from neo4j** — *not* re-composed from the tapestry's
authored strfry graph. Only **membership** (which concepts belong to the tapestry) continues to come
from the authored tapestry event. This deliberately **evolves ADR tapestries/0002's "render
as-authored from strfry" stance** for the per-concept drill-down; the new ADR must reconcile the two.

## User-facing description

As a person exploring a tapestry, I want to inspect each member concept with the same depth the
Firmware Explorer gives me — an overview, each of its core node types, and its elements and sets — so
that I understand what each concept *is*, not just its skeletal header.

## Acceptance criteria
*Testable from the outside. Each gets at least one test.*

- [ ] **View parity.** Given a selected member concept on a tapestry's exploration page, when I
  inspect it, then I can choose among the same per-concept views the Firmware Explorer offers — an
  **Overview**, the **8 core-node types**, and **Elements** and **Sets** — replacing today's single
  concept-graph-JSON view.
- [ ] **Overview.** Given a selected concept, when I open its Overview, then it shows the concept's
  name/description and which of its core nodes exist / have JSON (the Firmware Explorer's overview
  behavior).
- [ ] **Core-node JSON + source of truth.** Given a selected concept and a chosen core-node type,
  when I view it, then it renders that node's JSON with a **Viewer / Raw JSON** toggle — and the
  views surface core nodes and JSON that are **not present in the tapestry's authored graph block**
  (e.g. JSON Schema, Primary Property), demonstrating the data is sourced from the instance's own
  graph (neo4j + LMDB), not the authored event.
- [ ] **Elements & Sets.** Given a selected concept and the Elements or Sets view, when I browse it,
  then I get a name-sorted member list with a **Direct / Full** scope toggle and a count, and
  selecting a member shows its JSON (Viewer/Raw). Membership reflects the concept's relationships
  **in the instance's graph** (structural — shown regardless of author, matching the Firmware
  Explorer; POV filtering is out of scope).
- [ ] **Graceful degradation.** Given a member concept that is absent or only partially present in
  the instance's graph, when I view it, then the page clearly indicates the concept/core-node isn't
  in the graph and does **not** crash or show a raw error.
- [ ] **No regression of tapestry-level views.** Given the tapestry-level Integration views story #2
  built (Integration Graph, Enumerations, Elements, Subsets, Tapestry JSON), when this ships, then
  they remain available (this story enriches the per-concept drill-down; it does not remove the
  tapestry-level section).

## Concepts touched
- `39998:<TA>:tapestry` — the Tapestry concept (the page's subject is one of its elements).
- The **member concepts of the viewed tapestry**, resolved from the authored event, then read in
  depth from the graph — e.g. for "Tapestry for Dog": `39998:<TA>:dog`, `39998:<TA>:dog-breed`,
  `39998:<TA>:irish-setter`, `39998:<TA>:golden-retriever`, each with its 8 core nodes. `<TA>` is
  runtime-resolved (never hardcode).

## Out of scope
- A button to **recompute** a node's JSON from neo4j (owner explicitly deferred).
- **POV / WoT filtering** of concepts, elements, or sets (consistent with the epic's deferral).
- Editing the tapestry or any concept.
- Migrating the tapestry-level Integration views or the membership read off strfry — only the
  per-concept data moves to neo4j+LMDB in this story.

## Open questions
- **For the Architect:** how to obtain the 8 core nodes + JSON + members for an arbitrary member
  concept identified by its **header handle**. The Firmware Explorer's `/api/firmware/concept/:slug`
  is keyed on firmware-manifest slug; the concept-graph API is keyed on handle and already returns
  the core-node edges + `HAS_ELEMENT`. Reconcile reuse vs. a handle-keyed read path — and reconcile
  with ADR tapestries/0002 in the new ADR.
- **For the Tester:** local end-to-end needs a tapestry to open. The epic names a seed
  (`39999:<TA>:tapestry-for-dog-ca3b675e`); none was found under this instance's TA — so testing
  likely means authoring one via the owner-gated Create page. To confirm in Test Design.

## Linked artifacts
- ADR: *(after Architecture)*
- Test plan: *(after Test Design)*
- Review: *(after Review)*
