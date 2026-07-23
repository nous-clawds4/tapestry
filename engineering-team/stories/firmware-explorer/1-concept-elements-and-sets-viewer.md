# Story 1: Browse a concept's Elements and Sets in the Firmware Explorer

**Status:** Approved
**Created:** 2026-07-23
**Type:** Feature

## Background

Settings → Firmware Explorer lets an operator select a concept (e.g. *dog*) and inspect
its 8 core class-thread nodes — Concept Header, Superset, JSON Schema, Primary Property,
… — each rendered as JSON with a Viewer ⇄ Raw toggle (shipped 2026-07-23).

What it does **not** show is the concept's actual membership: its **elements** (the
member instances of the concept — e.g. individual dogs) and its **sets** (the subsets
grouped under the concept). Those live in the concept graph, hanging off the concept's
Superset. Today, seeing them means leaving the Firmware Explorer for the Concepts admin
section or dropping to raw queries.

This story adds two per-concept views — **Elements** and **Sets** — so a concept can be
explored end to end (structure + membership) in one place, reusing the same
JSON Viewer/Raw drill-down.

**Not to be confused with** the sidebar's *Integrations → Elements / Subsets*: those
render firmware-*manifest* cross-concept wiring (e.g. "dog's header is an element of the
*animals* superset"), which is a different thing from a given concept's live members.
The Integrations views are out of scope and untouched.

**Point of view:** this is a structural/ops inspector, not a personalized view. A
concept's elements and sets are graph-structural facts, so no per-POV trust filtering
applies; elements are shown regardless of which author published them (decentralized-first,
matching the existing Concepts admin Elements view).

## User-facing description

As an operator exploring the concept graph in the Firmware Explorer, I want to see a
selected concept's elements and sets — and open any one as JSON (Viewer or Raw) — so that
I can inspect a concept's real membership without leaving the Firmware Explorer or writing
a query.

## Acceptance criteria

- [ ] Given a concept is selected in the Firmware Explorer, when I look at its view
      selector, then **Elements** and **Sets** are offered as views alongside the existing
      per-concept views (Overview, Concept Header, Superset, …).
- [ ] Given I select **Elements** for a concept that has elements, then I see a list of
      those elements identified by name, each selectable.
- [ ] Given I select **Elements** (or **Sets**) for a concept that has none, then I see a
      clear empty-state message — not an error and not a blank pane.
- [ ] Given I select **Sets** for a concept that has sets, then I see a list of those sets
      identified by name, each selectable.
- [ ] Given the **Elements** or **Sets** view, then it offers a **Direct** / **Full**
      scope toggle that defaults to **Direct** on first open, and toggling it updates the
      list in place:
  - Elements — **Direct**: only elements attached directly to the concept. **Full**: also
    elements that belong through nested sets, plus elements that reference the concept
    without a direct attachment (implicit).
  - Sets — **Direct**: only the concept's direct subsets. **Full**: also nested/transitive
    subsets.
- [ ] Given the Elements or Sets view, then a count of the listed items is shown (e.g.
      "12 elements", "3 sets"), reflecting the active Direct/Full scope.
- [ ] Given a list of elements or sets, when I click one item, then its detail appears as
      JSON, defaulting to the collapsible **Viewer** with a toggle to **Raw JSON** — the
      same two-mode toggle behaviour as the existing core-node JSON views.
- [ ] Given an element or set that has no JSON, when I select it, then the detail shows a
      clear "no JSON" message rather than an error or blank.
- [ ] Given a concept defined in firmware but **not installed** in the graph, when I open
      Elements or Sets, then the view degrades gracefully (a clear message, no crash),
      consistent with how the core-node views already handle a not-installed concept.
- [ ] Given an element published by an author other than the assistant, then it still
      appears in the list (no author-based gating).

## Concepts touched

Generic over every installed concept; the story is an inspector, not a change to any one
concept. For the Architect's orientation (handles use the runtime `<TA>` pubkey — never
hardcode; `getOwnerAssistantPubkey()` / `useConfig()`):

- `39998:<TA>:dog` — *dog* (example concept with membership to test against)
- `39998:<TA>:set` — *set* (rich example: many elements + subsets)
- Structural basis: a ConceptHeader `—IS_THE_CONCEPT_FOR→` Superset `—HAS_ELEMENT→`
  elements, and Superset `—IS_A_SUPERSET_OF→` subsets. "Direct" vs "Full" (transitive +
  implicit z-tag) mirrors the distinction already implemented in the Concepts admin
  Elements view.

## Out of scope

- Creating, editing, or deleting elements/sets — the Firmware Explorer is read-only;
  authoring stays in the Concepts admin section.
- Schema validation of elements (the Concepts admin Elements page already shows ✓/✗ vs the
  concept schema; not replicated here).
- Author/profile display, filtering, or grouping controls.
- Any change to the Integrations (manifest-level Elements / Subsets / Enumerations) views.
- Any change to concept-graph data, the firmware seed, or server write paths.

## Resolved decisions

1. **Sets scope** — the Direct/Full toggle governs **both** Elements and Sets. For Sets,
   Direct = the concept's direct subsets, Full = nested/transitive subsets. (Operator,
   2026-07-23.)
2. **Counts** — each view shows a count header reflecting the active scope. (Operator,
   2026-07-23.)

## Linked artifacts
- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
