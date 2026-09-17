# PRD Seed: Firmware Explorer — concept membership browsing

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/firmware-explorer/audit.md`
**Anchor:** acceptance frame in `book.md`
**Confidence:** high
**Date:** 2026-07-23

> A reverse-engineered baseline in PRD shape, for the product team to adopt as the starting
> point if the Firmware Explorer becomes a larger product line. Tags: `[FROM FRAME]`,
> `[INFERRED]`, `[UNKNOWN — product input needed]`.

## 1. Product vision

`[FROM FRAME]` The Firmware Explorer is the in-app lens for an operator to inspect the firmware
seed and the concept graph it builds. This book extended it from "inspect a concept's
*structure* (its 8 core class-thread nodes)" to also "inspect a concept's *membership* — the
actual elements and subsets that hang off it" — so a concept can be understood end-to-end in
one place, without dropping to raw Cypher. `[INFERRED]` The user is an operator/developer
maintaining a Tapestry deployment, not an end consumer.

## 2. Personas

`[INFERRED]` **Operator/maintainer** — signed-in owner of a Tapestry instance, comfortable with
the concept-graph model (ConceptHeader / Superset / elements / subsets), using Settings →
Firmware to verify what the graph actually contains after a firmware install or data change.
No consumer-facing persona; this surface is owner-gated.

## 3. Scope (as-built)

`[FROM FRAME]` In scope, shipped:
- Per-concept **Elements** and **Sets** lists (name-sorted, counted).
- A **Direct / Full** scope toggle on both (Direct = one hop off the Superset; Full = transitive
  closure through nested subsets, plus implicit z-tagged members for elements).
- **JSON detail** for any item with a Viewer/Raw toggle.
- Graceful empty / no-JSON / not-installed states; members shown regardless of author.

`[INFERRED]` Explicitly **out of scope** (from the story): creating/editing/deleting members
(authoring stays in the Concepts admin section), schema validation of elements, author
display/filtering, and any change to the manifest-level Integrations views.

## 4. Domain model

`[INFERRED]` No new domain. Reads the existing class thread:
`ConceptHeader (39998:<TA>:<slug>) —IS_THE_CONCEPT_FOR→ Superset —HAS_ELEMENT→ elements`, and
`Superset —IS_A_SUPERSET_OF→ subsets`. "Direct" = one hop; "Full" = `IS_A_SUPERSET_OF*` closure,
plus (elements only) events z-tagged to the header. Structural facts, not POV-scoped — no
per-perspective trust filtering applies. `<TA>` is the per-deployment runtime pubkey.

## 5. Design rules (as-built)

`[INFERRED]` The Firmware Explorer's own idiom, reused not reinvented: the membership views hang
off the same per-concept tab row as the core nodes (after a visual divider), and the JSON detail
reuses the `JsonView` Viewer/Raw component and the `.firmware-view-*` / `.firmware-json-*`
styles. Master-detail: scoped list on the left, JSON on the right. `[UNKNOWN]` No written design
guide governs the Firmware Explorer; the rules are read off the shipped code.

## 6. Carry-forward & open questions

Promoted from build audit §6:
- Harden the sibling `ConceptElements` admin page against the same write-guard fragility
  (parameterize its queries) — OPEN.md #84.
- Optional: extract a shared JSON-detail component (DRY with `FirmwareNodeJson`).

## 7. What product must validate

- [ ] `[UNKNOWN]` Is "Firmware Explorer" a product line worth deepening (e.g. cross-concept
  membership search, element editing in-place, per-author views), or a maintainer utility that
  is now feature-complete for its purpose?
- [ ] `[UNKNOWN]` Should any of this membership view be exposed beyond the owner (e.g. a
  read-only public concept browser), or is owner-only correct long-term?
- [ ] `[INFERRED→confirm]` Is the Direct/Full distinction (and the implicit-member inclusion in
  Full) the right mental model for operators, or should "Full" be the default?
