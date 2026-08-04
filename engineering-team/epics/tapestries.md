# Epic: tapestries

**Created:** 2026-07-23
**Status:** Done *(re-retired 2026-08-04 at the `take-a-concept-back-out` book close — all six stories Done, folders under `done/tapestries/`; previously reopened 2026-07-30 for story #6 under the Direction book `audits/take-a-concept-back-out/book.md`; retired 2026-07-28 at the `add-a-concept-to-a-tapestry` book close after being reopened the same day for story #5, and Done before that after the read-only/create book)*

## Goal

Give users a way to **browse and explore Tapestries** — curated, self-describing collections of
concepts and their integrations — in the app. A Tapestry is a subset of Graph ("a graph of concept
graphs"): each Tapestry element carries its own `graph` block (nodes / relationshipTypes /
relationships / imports) that names its member concepts and the integrations between them. This
epic builds the **read-only** surface (a directory plus a per-tapestry exploration view), modeled
on the read-only parts of the Firmware Explorer. Authoring landed incrementally: create (#3), and
add-only membership editing (#5).

## Why it matters

The data model already exists — the `tapestry` concept, and elements that embed a self-describing
`graph` block (e.g. "Tapestry for Dog") — but there is **no UI to see or explore any of it**.
Tapestries are meant to be a first-class way to group and present related concepts; without a
surface they're invisible. This epic makes them reachable and legible, and establishes the
rendering conventions the later authoring features will build on.

## Stories

1. `stories/done/tapestries/1-tapestries-nav-and-directory.md` — "Tapestries" nav group under
   Nostr Users + the **View Tapestries** directory + the **Create New Tapestry** stub. *(Done)*
2. `stories/done/tapestries/2-tapestry-exploration-page.md` — the per-tapestry **Exploration
   page**, modeled on the Firmware Explorer's read-only views, rendered as-authored from the
   element's `graph` block + resolved imports. *(Done)*
3. `stories/done/tapestries/3-create-tapestry.md` — **Create a Tapestry** (members-only authoring):
   owner-gated title/description + concept picker, published under the owner's key or the TA.
   *(Done)*
4. `stories/done/tapestries/4-per-concept-detail-views.md` — per-concept detail views in the
   Exploration page (Firmware-Explorer parity). *(Done)*
5. `stories/done/tapestries/5-add-a-concept-to-a-tapestry.md` — **Add a concept to a Tapestry**:
   add-only membership editing on the existing Exploration page, for tapestries authored under
   the owner's key or the TA, republished the way tapestries are already published. *(Done)*
6. `stories/done/tapestries/6-take-a-concept-back-out.md` — **Take a concept out of a Tapestry**:
   remove-only membership editing on the existing Exploration page, for tapestries authored under
   the owner's key or the TA, republished the way tapestries are already published; a tapestry
   keeps at least one concept (taking out the last one is refused). *(Done)*

Future (not yet storied): the rest of Edit a Tapestry — changing how concepts connect
(integrations), editing title/description; editing tapestries published by someone else
(whose key may republish is unsettled — has its own goal); POV/WoT filtering of which tapestries
are shown; re-parenting/durability concerns.

## Key facts / guardrails

- **Render as-authored.** The Exploration page's source of truth is the tapestry element's own
  `graph` JSON block, plus resolving each `graph.imports` entry (a concept-graph core node) via the
  existing read-only concept-graph API. It does **not** re-derive the tapestry from live Neo4j the
  way the Firmware Explorer derives firmware from the manifest. Ratified in ADR tapestries/0002;
  evolved for the per-concept drill-down by story #4's ADR.
- **No new backend.** Reuse existing read-only endpoints (concept-graph API, `/api/neo4j/query`).
  If a convenience "resolve-tapestry" endpoint is ever warranted, that is a separate, measured
  decision — not part of this epic.
- **Route by uuid.** Per-tapestry URL is `/tapestry/tapestries/:uuid`; in this system a 3xxxx
  event's `uuid` is the stable a-tag coordinate (`kind:pubkey:d-tag`), which survives edits.
- **Public.** Lives in the main left nav (under Nostr Users), visible to all users — not the
  owner-gated Settings area.
- **Drop firmware-lifecycle controls.** The Exploration page ports only the Firmware Explorer's
  *read-only* views (concept sidebar, integration graph, integration tables, JSON viewer). Install
  / version / Neo4j-constraints controls are firmware-only and are omitted.
- **Don't hardcode the TA pubkey.** Concept handles are `39998:<TA>:<slug>`; `<TA>` is the
  runtime-resolved owner-assistant pubkey (client: `useConfig().taPubkey`) — never a literal.
- **Two curator gates exist by ratified decision** (ADR tapestries/0005, Director ruling
  2026-07-28): create (#3) admits owner-or-admin (`hasAdminAccess`); add-a-concept (#5) admits
  the **owner only**. An admin who is not the owner can create a tapestry but cannot add to one.
  Harmonizing "who curates" epic-wide is separately-goaled work if ever wanted.
- **Seed data already exists** (local + intended for staging): element
  `39999:<TA>:tapestry-for-dog-ca3b675e` ("Tapestry for Dog") with a full `graph` block, plus the
  `dog`, `dog-breed`, `irish-setter`, and `golden-retriever` concepts.
