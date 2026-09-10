# Story 2: Restore the "Add Node as Element" page

**Status:** Approved
**Created:** 2026-09-09
**Type:** Bug

## Background

Adding an **existing** graph node as an element of a concept is the one write flow this epic
inherited (epic `graph-curation-ui` → "Why it matters"). It is how an owner curates a concept
whose elements already exist in the graph — as distinct from authoring a brand-new element.

That page is currently dead on arrival. Opening it replaces the whole route with the router's
raw developer error screen: no picker, no filters, no partial render, no recovery short of
navigating away. The failure is unconditional on any populated graph, so the flow has no
working UI at all.

The cost is not theoretical. Wiring the first element into the new `firmware concept` on
2026-09-09 required hand-building a request with a hand-copied UUID, because the picker could
not be opened. A curation pass over the concept graph — the next task in that line of work —
would mean repeating that by hand for every element.

Two further points bear on scope:

- The flow's **server side is healthy.** The confirm step's endpoint works; it is the picker
  that cannot be reached. Restoring the page restores the whole flow.
- The page is reached by a button reading **"Add Node as Element"**, but its breadcrumb and
  route shorten this to **"Add Node"** — which reads as *add a node to Neo4j*, the opposite of
  what it does (it adds an existing node to a **concept**, minting no node). This misreading
  happened in the 2026-09-09 session. The rename rides this story by the requester's decision.

Diagnostic detail — the observed error and its cause — is recorded in `OPEN.md` row 222.
The Architect should confirm it independently rather than inherit it.

## User-facing description

As the **Tapestry owner**, I want the "Add Node as Element" page to open and work, so that I
can add existing nodes to a concept from the UI instead of hand-building one API call per
element.

## Acceptance criteria

Testable from the outside, on the local stack, in an owner-authenticated session.

- [ ] Given a concept and a populated graph, when the owner opens that concept's "Add Node as
      Element" page, then the picker renders — no error screen — and the page stays usable.
- [ ] Given the picker is open, when the owner selects an author from the author filter, then
      each author is shown by display name where one is known (falling back to a shortened
      pubkey), and the candidate list narrows to that author's nodes.
- [ ] Given the picker is open, when the owner filters by node label, then the candidate list
      narrows to nodes carrying that label.
- [ ] Given a candidate node that is already an element of this concept, when the candidate
      list renders, then that node is visibly marked as already added.
- [ ] Given a selected candidate, when the owner confirms it on the review step, then the node
      becomes an element of that concept and appears on the concept's Elements tab.
- [ ] Given the owner is on that page, when the breadcrumb renders, then it reads "Add Node as
      Element", matching the button that leads there.

## Concepts touched

Handles below are this instance's; the TA pubkey segment is per-deployment and must be
resolved at runtime in code (CLAUDE.md), never copied from this file.

- `39998:<TA>:concept-header` — concept header (the class of thing being curated)
- `39998:<TA>:firmware-concept` — firmware concept (the concept that surfaced the defect)
- `39998:<TA>:nostr-relay` — nostr relay (the element added by hand as the workaround)

## Out of scope

- **The element counter on the concept detail header** — a separate defect, and its own story
  (`graph-curation-ui` #3 / `OPEN.md` row 224). Do not fold the two.
- **The other four findings from the same session** — `OPEN.md` rows 219, 220, 221, 223. Each
  is a distinct surface; none blocks this flow.
- **Any change to the confirm-step endpoint or its behavior.** The server side is working and
  this story does not touch it.
- **Bulk / multi-select adding.** Restoring the page restores its existing one-at-a-time
  behavior; making a long curation pass ergonomic is a candidate follow-up, not this story.
- **Widening what may be added as an element.** Placement policy is unchanged.

## Open questions

None. The defect is reproducible on demand and the intended behavior is the page's own
documented behavior.

## Linked artifacts

- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
