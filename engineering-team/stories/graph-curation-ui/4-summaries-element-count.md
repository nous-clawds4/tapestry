# Story 4: Make the summaries endpoint's element count mean what the rest of the system means

**Status:** Approved
**Created:** 2026-09-09
**Type:** Bug

## Background

`GET /api/concept-graph/summaries` is not an incidental endpoint. AGENTS.md §2 makes it the
**first call of the orientation ladder** — the compact picture of the entire domain that every
agent session reads before touching anything, and §3 documents its shape: each entry carries
`handle`, `name`, `description`, `elementCount`, `setCount`.

Its `elementCount` is wrong in the same way the concept page's Overview is wrong: it counts only
the elements hanging **directly** off a concept's superset, ignoring everything nested under
sets. Measured 2026-09-09:

| Concept | summaries reports | Actual elements | Sets |
|---|---|---|---|
| word | **0** | 582 | 47 |
| validation tool | **0** | 57 | 2 |
| graph | 132 | 173 | 4 |
| set | 111 | 137 | 2 |
| property | 57 | 70 | 1 |
| nostr relay | 12 | 12 | 13 |
| firmware concept | 37 | 37 | 0 |

The failure is worst exactly where it is most misleading. `word` is the largest concept in the
graph — 582 elements — and the orientation endpoint reports it as empty. An agent following the
documented ladder is told the richest concept in the system has nothing in it, and will
reasonably deprioritise reading further.

The operator ruled on 2026-09-09 that direct-only counting is a **bug**, not a second deliberate
metric: element count means everything reachable through the set tree.

This is split from `graph-curation-ui` #3 (which fixes the same defect on the concept page)
because this endpoint is a **published read contract with a documented shape**. Changing what one
of its fields means is a different class of change from correcting a number on a page, and
deserves its own design and its own review.

## User-facing description

As an **agent or operator orienting via the concept-graph API**, I want `elementCount` to report
every element a concept actually has, so that the endpoint the project designates as the entry
point to the domain does not describe its largest concepts as empty.

## Acceptance criteria

Testable from the outside against the running API. Expected values are as measured 2026-09-09; a
test should derive them from the graph rather than hard-code them.

- [ ] Given the summaries endpoint, when it is queried, then each concept's `elementCount`
      equals the number of elements reachable through that concept's set tree at any depth.
- [ ] Given a concept whose elements live entirely under nested sets — `word` (582),
      `validation tool` (57) — when the endpoint is queried, then its `elementCount` is that
      number and **not** `0`.
- [ ] Given a concept with both direct and set-nested elements — `graph` (173), `set` (137),
      `property` (70) — when the endpoint is queried, then `elementCount` is the full count, not
      the direct-only subtotal (132, 111, 57).
- [ ] Given a concept whose elements are all direct — `nostr relay` (12), `firmware concept`
      (37) — when the endpoint is queried, then `elementCount` is unchanged from today.
      **Regression guard.**
- [ ] Given the endpoint, when it is queried, then every other documented field
      (`handle`, `name`, `description`, `setCount`, `labels`) is unchanged in name, shape, and
      value, and response time remains acceptable for an orientation call on the full graph.
- [ ] Given a concept page and the endpoint, when both are consulted for the same concept, then
      they report the same element count. *(Requires #3; if #3 has not shipped, this criterion
      is checked against #3's expected values rather than the live page.)*

## Concepts touched

Handles below are this instance's; the TA pubkey segment is per-deployment and must be resolved
at runtime in code (CLAUDE.md), never copied from this file.

- `39998:<TA>:word` — word (0 → 582, the worst case)
- `39998:<TA>:validation-tool` — validation tool (0 → 57)
- `39998:<TA>:graph` — graph (132 → 173)
- `39998:<TA>:nostr-relay` — nostr relay (control: 12, must not move)

## Out of scope

- **The concept detail page** — `graph-curation-ui` #3.
- **Adding a separate "direct elements" figure.** The operator ruled direct-only is a bug, not a
  second metric worth surfacing. If a distinct direct-member count is ever wanted, it is a new
  field with its own name, not this one.
- **Any other field of the summaries response**, and any other concept-graph endpoint
  (`/neighbors`, `/node/:handle`) unless the same defect is found there.
- **AGENTS.md prose**, except a factual correction if the endpoint's documented description of
  `elementCount` turns out to state the narrower meaning.

## Open questions

- Does anything downstream consume `elementCount` in a way that depends on the narrower meaning?
  The Architect should check before widening it. Nothing is known to; the field's documented
  description does not promise direct-only.

## Linked artifacts

- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
