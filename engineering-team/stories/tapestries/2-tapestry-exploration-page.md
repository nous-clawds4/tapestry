# Story 2: Tapestry Exploration page

**Status:** Draft
**Created:** 2026-07-23
**Type:** Feature

## Background
Once a user can reach a tapestry (`tapestries` #1), opening it should let them **explore** the
member concepts and the integrations between them. A Tapestry element is self-describing: it
carries a `graph` block (nodes / relationshipTypes / relationships / imports) that names its member
concepts and asserts the integrations among them, and imports each member's concept-graph. The
exploration experience is modeled on the **read-only** parts of the Firmware Explorer, but scoped
to one tapestry and rendered from the tapestry's own definition rather than from the firmware
manifest. This is the substantial piece of the skeleton and carries the rendering conventions the
later authoring features will depend on, so it warrants its own ADR.

## User-facing description
As any visitor, I want to open a tapestry and see its member concepts and how they integrate, so
that I can understand what the tapestry groups together and how those concepts relate.

## Acceptance criteria
Testable from the outside. Each criterion gets at least one test.

- [ ] Given a tapestry's exploration page (reached at `/tapestry/tapestries/<uuid>`), when it
  loads, then it presents the tapestry's **member concepts** and their **integrations**, with the
  same read-only presentation families as the Firmware Explorer — a **concept sidebar**, an
  **integration graph** (visualization), **integration tables** (enumerations / elements /
  subsets), and a **JSON viewer** — and **without** install / version / constraints controls.
- [ ] Given the seed tapestry **"Tapestry for Dog"**, when I open its exploration page, then the
  integrations shown reflect its authored `graph`: **dog-breed enumerates `dog.breed`**;
  **dog-breed has elements irish-setter and golden-retriever**; and **the dog superset is a
  superset of the irish-setter and golden-retriever supersets**.
- [ ] Given a tapestry whose `graph.imports` reference concept-graph core nodes, when the page
  loads, then it **resolves those imports** and includes their concepts/relationships in the views
  (the page's content is derived from the element's `graph` block plus resolved imports, not from a
  live re-derivation of the whole Neo4j graph).
- [ ] Given a tapestry element with a **missing or malformed** `graph` block, when I open its
  exploration page, then the page **degrades gracefully** — it shows whatever it can and a clear
  notice/empty state, and does not crash or show a raw error.
- [ ] Given I open the exploration page for a given uuid, when the underlying tapestry element is
  later edited (same uuid), then the URL still resolves to the same tapestry (identity is the
  stable uuid, not a volatile event id).

## Concepts touched
- `39998:<TA>:tapestry` — the Tapestry concept (the page's subject is one of its elements).
- The **member concepts of the tapestry being viewed**, resolved at read time from the element's
  `graph` block — for "Tapestry for Dog": `39998:<TA>:dog`, `39998:<TA>:dog-breed`,
  `39998:<TA>:irish-setter`, `39998:<TA>:golden-retriever` (and their `*-concept-graph` core nodes
  named in `graph.imports`). `<TA>` is runtime-resolved (never hardcode).

## Out of scope
- Editing the tapestry or its `graph` block (authoring is a future story).
- POV/WoT filtering.
- The firmware-lifecycle controls (install / version / Neo4j constraints) — omitted by design.
- Do **not** replicate the Firmware Explorer's plural-slug label artifact (the "dog-breedss"
  double-`s`); node labels should read cleanly.

## Open questions
None blocking. The Architect will decide how much of the Firmware Explorer's presentation to reuse
vs. build fresh, and will formalize in an ADR: (a) the **graph-embedding convention** (a tapestry
element carrying a top-level `graph` block alongside `tapestry`) and (b) the **as-authored +
import-resolution rendering** approach (source of truth = element `graph` block + resolved imports;
no new backend).

## Linked artifacts
- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
