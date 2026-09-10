# Story 3: Report a concept's element count correctly on the concept page

**Status:** Done
**Created:** 2026-09-09
**Revised:** 2026-09-09 — rewritten after an Architecture-phase kick-back. The first draft
asserted that the page header was the lone outlier and required it to match the Overview and
the summaries endpoint. Measurement showed the opposite: those two are the *more* broken
surfaces, and satisfying the original criteria would have made the header worse. The original
framing, its acceptance criteria, and why they were wrong are preserved under
"Superseded framing" below rather than quietly deleted.
**Type:** Bug

## Background

A concept's elements can live directly under its superset, or under sets nested beneath it, or
both. The number a person sees for "how many elements does this concept have" should not depend
on which.

Today the concept detail page shows that number **twice and differently**, and both numbers are
wrong in different ways. Measured against the live graph on 2026-09-09:

| Concept | Page header shows | Overview shows | Should be |
|---|---|---|---|
| firmware concept | **0** | 37 | 37 |
| concept header | **0** | 44 | 44 |
| word | 538 | **0** | 582 |
| validation tool | 57 | **0** | 57 |
| graph | 173 | **132** | 173 |
| set | 137 | **111** | 137 |
| property | 70 | **57** | 70 |
| nostr relay | 12 | 12 | 12 |
| nostr kind | 41 | 41 | 41 |

Seven of thirteen concepts checked have the two disagreeing. Two distinct defects are in play:

1. **The header ignores elements that are themselves concepts.** This is why `firmware concept`
   reads `0` while holding 37, and why `concept header` has read `0` for as long as it has had
   concepts as elements. It surfaced when a concept appeared whose elements are *exclusively*
   concepts.
2. **The Overview ignores elements that live under nested sets.** It counts only what hangs
   directly off the superset. For `word` — 582 elements, 47 sets — it reports **zero**. Same for
   `validation tool`. This is the larger error of the two, and the original draft of this story
   mistook it for the correct answer.

The operator's ruling (2026-09-09): counting only direct members is a **bug**, not a deliberate
second metric. One meaning of "element count" — everything reachable through the set tree.

Diagnostic detail, including the four-way measurement across all surfaces that compute this
number, is recorded in `OPEN.md` row 224 and in this story's Architecture-phase kick-back.

## User-facing description

As the **Tapestry owner**, I want a concept's element count to mean the same thing everywhere it
appears on the concept page — every element, however it is nested — so that the page agrees with
itself and with what is actually in the graph.

## Acceptance criteria

Testable from the outside, on the local stack. Expected values are as measured 2026-09-09; a
test should **derive them from the graph rather than hard-code them**.

That is not boilerplate caution. `word` read **575** at the start of the 2026-09-09 session and
**582** by the end — creating one new concept minted seven new word-typed nodes, which are
themselves elements of `word`. Any test that pins these numbers as literals will rot the next
time someone adds a concept.

- [ ] Given any concept, when its detail page is opened, then the element count in the page
      header and the element count in the Overview are **the same number**.
- [ ] Given a concept whose elements are themselves concepts — `firmware concept` (37),
      `concept header` (44) — when its page is opened, then both surfaces report that count and
      neither reports `0`.
- [ ] Given a concept whose elements live under nested sets — `word` (582 elements, 47 sets),
      `validation tool` (57 elements, 2 sets) — when its page is opened, then both surfaces
      report every element reachable through the set tree, and neither reports `0`.
- [ ] Given a concept with a mix of direct and set-nested elements — `graph` (173), `set` (137),
      `property` (70) — when its page is opened, then both surfaces report the full count, not
      the direct-only subtotal (132, 111, 57 respectively).
- [ ] Given a concept whose elements are all direct and none are concepts — `nostr relay` (12),
      `nostr kind` (41) — when its page is opened, then both surfaces report the value they
      report today. **This is the regression guard: today's correct answers must not move.**

## Concepts touched

Handles below are this instance's; the TA pubkey segment is per-deployment and must be resolved
at runtime in code (CLAUDE.md), never copied from this file.

- `39998:<TA>:firmware-concept` — firmware concept (concepts-as-elements: 0 → 37)
- `39998:<TA>:concept-header` — concept header (concepts-as-elements: 0 → 44)
- `39998:<TA>:word` — word (set-nested: header 538 → 582; Overview 0 → 582)
- `39998:<TA>:validation-tool` — validation tool (set-nested: Overview 0 → 57)
- `39998:<TA>:nostr-relay` — nostr relay (control: 12, must not move)

## Out of scope

- **The `/api/concept-graph/summaries` endpoint**, which has the same direct-only defect. It is a
  documented public read contract that every agent session orients from, so changing what its
  `elementCount` means carries different risk than a UI counter. Split out as
  `graph-curation-ui` #4 by operator decision.
- **Reconciling element counting across the whole UI.** This story covers the concept detail
  page. Other surfaces that count elements are not in scope unless they are one of the two here.
- **Changing what may be an element**, or how sets nest. This is a counting defect only.
- **The remaining findings from the same session** — `OPEN.md` rows 219, 220, 221, 223, 225–228.

## Superseded framing *(kept so the error is legible, not repeated)*

The first draft required: "the header count equals the Overview count" and "the summaries API
agrees with the header." Both treated the Overview and the summaries endpoint as correct.
Measurement at Architecture showed they implement a *different and narrower* rule — direct
members only. Implementing the original criteria literally would have taken `word`'s header from
538 to **0**, trading an undercount of 44 for an undercount of 582. The lesson worth keeping:
"make these two numbers agree" is not a safe criterion until someone has established which of
them is right.

## Open questions

None. The correct semantics is settled by operator ruling; the expected values are measured.

## Linked artifacts

- ADR: `engineering-team/decisions/graph-curation-ui/0003-one-canonical-concept-count.md`
- Test plan: `engineering-team/stories/graph-curation-ui/3-count-concepts-as-elements.test-plan.md`
- Review: `engineering-team/reviews/graph-curation-ui/3-count-concepts-as-elements.md`
