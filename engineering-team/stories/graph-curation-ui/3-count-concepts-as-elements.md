# Story 3: Count concepts-as-elements in the concept header

**Status:** Approved
**Created:** 2026-09-09
**Type:** Bug

## Background

A concept's elements can themselves be concepts. That is not an edge case — it is how the
concept graph expresses that one class contains another, and `concept header` has been built
that way since it existed: its elements are the other concepts in the graph.

The concept detail page reports the element count **twice**, and the two disagree whenever the
elements are concepts:

| Concept | Header reads | Overview reads |
|---|---|---|
| `concept header` (44 concepts as elements) | 0 | 44 |
| `firmware concept` (1 concept as element) | 0 | 1 |
| `nostr relay` (12 ordinary elements) | 12 | 12 |

The header is the outlier: the Overview and the concept-graph summaries API agree with each
other and with the graph. The discrepancy is not staleness — it survives a fresh page load —
and it is not new: it has been wrong for `concept header` all along, and surfaced only when a
concept appeared whose elements are *exclusively* concepts.

The effect on the owner is a page that contradicts itself in two places a few lines apart, and
a headline number that reads `Elements: 0` for a concept that demonstrably has elements. The
work now under way — populating `firmware concept` with the concepts that belong in firmware —
would leave that header reading `0` no matter how many are added.

Diagnostic detail — the two differing queries and the label that discriminates them — is
recorded in `OPEN.md` row 224. The Architect should confirm it independently rather than
inherit it, and should check whether any other surface depends on the narrower count before
widening it.

## User-facing description

As the **Tapestry owner**, I want a concept's element count to include elements that are
themselves concepts, so that the number in the page header matches what the page below it
shows and what is actually in the graph.

## Acceptance criteria

Testable from the outside, on the local stack.

- [ ] Given any concept, when its detail page is opened, then the element count in the page
      header equals the element count shown on that page's Overview.
- [ ] Given `concept header`, whose elements are other concepts, when its detail page is
      opened, then the header count reads the true number of those elements, not `0`.
- [ ] Given `firmware concept` with one concept as its element, when its detail page is
      opened, then the header count reads `1`.
- [ ] Given a concept whose elements are ordinary list items — `nostr relay`, with 12 — when
      its detail page is opened, then its header count is unchanged from its present value.
- [ ] Given the concept-graph summaries API, when it is queried for any of the concepts above,
      then its element count for that concept agrees with the page header.

## Concepts touched

Handles below are this instance's; the TA pubkey segment is per-deployment and must be
resolved at runtime in code (CLAUDE.md), never copied from this file.

- `39998:<TA>:concept-header` — concept header (the long-standing wrong case: 44 vs 0)
- `39998:<TA>:firmware-concept` — firmware concept (the case that surfaced it: 1 vs 0)
- `39998:<TA>:nostr-relay` — nostr relay (the ordinary-elements control: 12, must not regress)

## Out of scope

- **The "Add Node as Element" page crash** — `graph-curation-ui` #2 / `OPEN.md` row 222.
  Separate surface, separate story.
- **Reconciling every element counter in the UI into one shared source.** This story requires
  the two counters on *this* page to agree and to be right; consolidating counting across the
  concepts UI is a larger refactor and a candidate follow-up.
- **Changing what may be an element of a concept.** Placement policy is unchanged; this is a
  counting defect only.
- **The remaining findings from the same session** — `OPEN.md` rows 219, 220, 221, 223.

## Open questions

None blocking. One judgment belongs to the Architect: whether any consumer relies on the
header's present, narrower count. The acceptance criteria pin the ordinary-elements case so a
widening cannot silently change it.

## Linked artifacts

- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
