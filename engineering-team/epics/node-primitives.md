# Epic: node-primitives

**Created:** 2026-09-12
**Status:** Active

## Goal

Give the Tapestry operator **strfry-free, node-level primitives for the Neo4j reference graph** — the next
members of the family `relationship-primitives` began. Its prd-seed names node-level operations as the
family's inferred next step (§1) and asks product to confirm the demand (§7); the operator confirmed it
on 2026-09-12. The first member creates a set with no nostr event behind it. The governing premise is
unchanged (operator, verbatim, 2026-07-18): *"Strfry is simply one format by which information can be
communicated between one tapestry instance and another."* BIBLE §30 has since made it doctrine: a Neo4j
write that is never published is a private thought.

This epic realizes the acceptance frame of book `engineering-team/audits/event-less-sets/book.md`.

## Why it matters

The operator is organizing concepts into subsets as private structure — first the local-only `firmware
concept` — and does not want to write a letter for every set. Today every route that creates a node signs
an event, so the only event-less path is raw Cypher. `relationship-primitives` retired raw Cypher for
edges; this epic does the same for nodes, starting with sets.

## Stories

1. `stories/node-primitives/1-event-less-create-set.md` — create a set under an existing superset or set
   with no event signed or stored, registered as an element of the `set` concept.

## Key facts / guardrails

- **The first event-less node.** No node in the graph lacks an event today, and BIBLE §6 still says the
  `NostrEvent` label means an imported event. Designs here decide what an event-less node looks like, and
  must keep a later letter possible without re-creating the node.
- **§30's "locally authored" marking is not this epic's to settle** — it is the `self-ontology` epic's
  open work, and nothing here may rule it out.
- **Same caller rules as the siblings:** owner or trusted local operator only; failures say what was
  wrong; repeating a request is safe.
- **The local stack is shared** — live checks go in a scratch container (see the book's known
  constraints).
