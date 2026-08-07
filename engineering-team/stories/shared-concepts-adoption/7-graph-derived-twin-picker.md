# Story 7: Graph-derived twin picker — offer wireable concepts, not wire archaeology

**Status:** Approved
**Created:** 2026-08-07
**Type:** Bug (fast-track — Architecture skipped, the approach was settled at discussion with the
owner 2026-08-07; tests retained since production code changes)

## Background

The Adoption Queue's "Choose my twin header…" selector enumerates a raw strfry scan
(`{kinds:[39998], authors:[TA]}`), so it faithfully lists every wire address ever minted —
including the March-2026 era's random-d orphan headers (three-plus dead addresses per concept on
the owner's dev machine: 166 addresses for 83 names). That inverts the store hierarchy (BIBLE
§30 / architecture invariant 4): **Neo4j is the definitive "me"; strfry is the proof layer.**
"Which concepts are mine and offerable as twins" is an identity question and should be answered
from the graph — with one load-bearing caveat the owner named: the Adopt action appends a
pointer-b to the twin's kind-39998 **event** and republishes it, so a graph concept with **no
event behind it** (principle 4 explicitly allows those) has nothing to append to and must not be
offered.

**Population = my graph concept headers ∩ has a corresponding kind-39998 event.** Side benefits:
same-uuid graph duplicates collapse (enumeration dedupes by coordinate), and event-only fixtures
(e.g. the story-5 test headers, which have no graph nodes) stop appearing.

**Who is affected:** the owner adopting foreign shared concepts (the selector's only consumer);
anyone whose dev instance carries wire archaeology.

## User-facing description

As **the owner**, I want the twin selector to offer each of my real concepts exactly once — and
only ones that can actually be wired — so that **adopting never points a b-tag at a dead or
duplicate address.**

## Acceptance criteria

- [ ] **Source:** the selector's options come from a server-assembled read over the concept graph
      (this instance's kind-39998 concept headers), not from a client-side strfry scan.
- [ ] **Wireability caveat:** a graph concept with no corresponding kind-39998 event in strfry is
      not offered. An event-only address with no graph node (orphans, test fixtures) is not
      offered either.
- [ ] **Uniqueness:** no coordinate appears twice, even where the local graph carries same-handle
      duplicate nodes.
- [ ] **Shape preserved:** options still render as name-sorted `{handle, name}` and the Adopt
      action (`wireAndBroadcast(twinChoice, …)`) works unchanged.
- [ ] **Regression:** `/api/adoption-queue`'s response contract is untouched.

## Concepts touched

None changed — a read over existing concept-header nodes (`ListHeader`/`ClassThreadHeader`/
`ConceptHeader`, uuid-prefixed `39998:<TA>:`). No firmware reinstall.

## Out of scope

- Cleaning up the orphaned strfry husks or the six same-handle graph duplicates (data hygiene,
  separately dispositioned — the picker change makes them un-offered, which was the harm).
- Any change to the Adopt/Recognize/Decline actions themselves.

## Open questions

None — direction settled at discussion 2026-08-07 (graph ∩ has-event, per the owner's framing).

## Linked artifacts
- ADR: skipped (fast-track; approach recorded in Background)
- Test plan: `engineering-team/stories/shared-concepts-adoption/7-graph-derived-twin-picker.test-plan.md`
- Review: (filled in after Review phase)
