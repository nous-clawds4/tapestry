# Epic: Firmware Explorer

**Created:** 2026-07-23
**Status:** Active
**Book:** bounded ask (no PRD) — intent anchor is the acceptance frame below
**Source:** operator request, 2026-07-23

## What this is

Settings → Firmware Explorer is the in-app lens for inspecting the firmware seed and
the concept graph it builds. It already lets an operator pick a concept and view its 8
core class-thread nodes (Concept Header, Superset, JSON Schema, …) as JSON, with a
Viewer ⇄ Raw toggle (shipped 2026-07-23, `fea8b0ef`). This epic grows that lens toward
letting a concept be explored **end to end — structure *and* membership — in one place**.

## Acceptance frame (intent anchor)

An operator can, inside the Firmware Explorer, browse a selected concept's live
**elements** (member instances) and **sets** (subsets), and drill into any one to see
its JSON with the same Viewer/Raw toggle used for core nodes — without leaving the
Firmware Explorer or dropping to raw Cypher.

## Stories

`stories/firmware-explorer/`:

1. **concept-elements-and-sets-viewer** — per-concept Elements and Sets views with a
   list → JSON-detail drill-down; Elements list has a Direct/Full scope toggle
   (default Direct). *(In flight)*

Prior work in this line (pre-epic, shipped directly): the core-node JSON Viewer/Raw
toggle + the dependency-free `JsonView` component (`fea8b0ef`).

## ADRs

`decisions/firmware-explorer/` — created per story at Architecture.

## Key facts / guardrails

- **This is a structural/ops inspector, not a POV-scoped view.** A concept's elements
  and sets are graph-structural facts (they hang off the concept's Superset), not
  personalized trust computations — so no per-POV trust filtering applies, and elements
  are shown regardless of author (decentralized-first; mirrors the existing Concepts
  admin Elements page).
- **Distinct from the sidebar "Integrations" (Elements / Subsets / Enumerations).**
  Those render firmware-*manifest* cross-concept wiring definitions. This epic renders a
  *given concept's live members* from the graph. No overlap; the Integrations views are
  untouched.
- **Read-only.** The Firmware Explorer inspects; it does not create/edit/delete graph
  content. Element/set authoring stays in the Concepts admin section.
- **TA pubkey is resolved at runtime, never hardcoded** (house rule) — concept handles
  are `39998:<TA>:<slug>` with `<TA>` from `getOwnerAssistantPubkey()` / `useConfig()`.
