# Story 1: Place and move nodes between sets from the concept pages

**Status:** Approved
**Created:** 2026-07-22
**Type:** Feature

## Background

The `relationship-primitives` book (closed 2026-07-22) gave the operator strfry-free backend
primitives to add and delete a single typed relationship in the Neo4j reference graph — API-only
by design; "UI affordances" were explicitly descoped and never re-homed as forward work. Today,
placing an existing element under a set means hand-writing a container-loopback API call with
exact uuids, the right relationship spelling, and the right direction — slow and error-prone for
something graph curation needs routinely. The concept pages already *display* set structure
(subsets/supersets, elements, DAG overview) but offer no way to change it.

Affected: the instance owner/operator curating their concept graph ("second brain"). Non-owners
keep today's read-only views.

## User-facing description

As the Tapestry owner, I want to place an existing node under a set — as a member **element** or
as a **subset** — and move or remove such placements directly from the concept pages, so that I
can reorganize my concept graph in a few clicks instead of hand-crafted API calls.

## Acceptance criteria

A "placement" = one node put under one set, as either *element* or *subset*, chosen per action.
All destination choices are scoped to the same concept's sets.

- [ ] **Set page — place:** Given the owner views a set's detail page, when they choose "add a
      node to this set…", pick an existing node of the concept and a placement kind
      (element / subset), and confirm, then the node appears in the corresponding table
      (Elements / Direct Subsets) without a full page reload.
- [ ] **Set page — remove:** rows that represent a *direct* placement in this set offer a remove
      control (with confirmation); after removal the row disappears. Rows shown via indirect
      chains (elements belonging to a descendant set) offer no remove here.
- [ ] **Element page — current placement visible:** the node's page shows its direct parent
      set(s), each linking to that set's page. (Today this page shows none.)
- [ ] **Element page — move / add:** the owner can move a specific existing placement to a
      different set (old placement removed, new one created in one flow) and can add an
      additional placement; the page reflects the change.
- [ ] **Organization (Sets) overview:** each row offers the same place/move affordance.
- [ ] **Gating:** a logged-out visitor or an authenticated non-owner sees none of these
      affordances; their views are unchanged from today.
- [ ] **Warning on every change:** every successful graph change surfaces the backend's hazard
      warning (a firmware install can overwrite manual edits).
- [ ] **Failures surfaced:** a failed operation (missing node, disallowed relationship kind,
      insufficient permissions) shows an inline error; no silent failures.

## Concepts touched

Handles are the local instance's (TA pubkey resolved at runtime — never hardcoded in code):

- `39998:11f23fe40984a07be717d1628bdd0e87a2b4569f05dd7625923c20b89df93767:set` — set ("a subset
  of elements within a concept") — the destination of every placement
- `39998:11f23fe40984a07be717d1628bdd0e87a2b4569f05dd7625923c20b89df93767:superset` — superset
  (top of a concept's DAG; already reachable via the existing add-node flow)
- `39998:11f23fe40984a07be717d1628bdd0e87a2b4569f05dd7625923c20b89df93767:class-thread` — class
  thread (the structural pattern whose subset/element relationships this story edits)
- `39998:11f23fe40984a07be717d1628bdd0e87a2b4569f05dd7625923c20b89df93767:shared-concept` —
  shared concept (the motivating example's concept)

## Out of scope

- Event-backed durability for moves (candidate follow-up story, recorded in the epic)
- Any change to firmware-install behavior (the documented overwrite hazard stands)
- New relationship kinds (e.g. the named `HAS_SUBGOAL` follow-up)
- Migrating the existing "Add Node as Element" (superset-targeting, event-backed) flow
- Cross-concept placement, bulk/multi-node moves, drag-and-drop
- Creating new nodes or sets (existing flows cover this)

## Open questions

None — resolved 2026-07-22 with the operator: both placement kinds; all three surfaces; instant
reference-graph edit with the warning surfaced.

## Linked artifacts

- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
