# PRD Seed: Graph curation — organizing the second brain's sets

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/graph-curation-ui/audit.md`
**Anchor:** acceptance frame in `book.md` *(reconstructed same-session from the operator's ask;
operator-gated)*
**Confidence:** medium
**Date:** 2026-07-23

> Reverse-engineered baseline in PRD shape. Strawman for the product team, not a ratified spec.
> `[FROM FRAME]` = grounded in the kickoff ask · `[INFERRED]` = read off the as-built system ·
> `[UNKNOWN]` = needs product input.

## 1. Product vision

`[FROM FRAME]` The Tapestry owner's Neo4j graph is their "second brain" reference; organizing it
should be a few clicks, not hand-crafted API calls. This book put the first *curation verbs* —
place, move, remove — onto the surfaces where the owner already looks at their graph.
`[INFERRED]` The larger arc: the relationship-primitives family (backend) plus per-surface
affordances (front end) gradually make the reference graph directly malleable, with durability
and richer relationship kinds arriving later.

## 2. Personas

`[FROM FRAME]` **The instance owner/operator** (David) — curates their own concept graph;
technically fluent but wants ergonomics over curl. The only persona with write affordances.
`[FROM FRAME]` **Non-owner visitors** — explicitly unaffected; their read-only views are pinned
unchanged (verified byte-level). `[UNKNOWN]` whether any future persona (delegated curator,
community member proposing placements) should exist — decentralized-first suggests *assertions
from anyone, filtered per POV* as the eventual shape, but nothing was specified.

## 3. Scope (as-built)

`[FROM FRAME]` Place an existing node under a set as **element** or **subset**; **move** a
specific placement between sets; **remove** a placement — from the set detail page, the element
detail page, and the Organization (Sets) overview. `[INFERRED]` Supporting behavior that
shipped: owner-only gating; confirmation on removal; direct-vs-inherited placement
distinction (only direct placements removable from a set's page); advisory cycle guard in
pickers; hazard warning on every graph change; idempotent "no change was needed" outcomes;
in-place refresh. Out of scope (recorded): cross-concept placement, bulk moves, drag-and-drop,
event-backed durability, new relationship kinds.

## 4. Domain model

`[INFERRED]` A **placement** is one typed, directed edge `(set)-[kind]->(node)` in the reference
graph, where kind ∈ {member element `HAS_ELEMENT` / `CLASS_THREAD_TERMINATION`, subset
`IS_A_SUPERSET_OF` / `CLASS_THREAD_PROPAGATION`} — the two class-thread membership types of the
concept model (`39998:<TA>:class-thread`, `:set`, `:superset`). Node identity is the nostr
coordinate `kind:pubkey:dtag`. A node may hold multiple simultaneous placements (DAG, not
tree); a **move** relocates one named placement, never all. The graph is per-instance (four
deployments, four TA identities, four graphs).

## 5. Design rules (as-built)

`[INFERRED]` Write affordances render only for owner/admin (server re-gates regardless);
destructive actions confirm first; every graph-changing success surfaces the backend's hazard
note verbatim (an epic guardrail — never suppressed); failures are inline and loud; moves are
add-before-delete so a partial failure leaves the node visible in two places, never zero, and
says so. Dialog + banner idioms reuse the existing house components (`ConfirmDialog`,
`health-banner` classes). *(Flag: no global design system or toast convention exists — each
page renders its own banners; never formally recorded as a rule.)*

## 6. Carry-forward & open questions

Promoted from audit §6: event-backed durable moves; `HAS_SUBGOAL` (and further kinds) whitelist
extension with a UI landing site ready; the row-79 dialog hardening items; bulk / drag-and-drop
/ cross-concept interactions; migrating the legacy superset-only "Add Node as Element" flow;
the duplicate-superset data quirk on prod/tags now fixable with this tool.

## 7. What product must validate

- [ ] **Non-owner visibility:** the Placements panel is owner-only end-to-end (deviation #2).
      Should non-owners get the read-only view? (POV-first suggests eventually yes, per-POV.)
- [ ] **Leaf-as-subset semantics:** the UI deliberately allows placing an element as a *subset*
      (the frame's literal ask). Is that the intended long-term model, or should the UI steer
      kinds by node type?
- [ ] **Durability bar:** is "instant + warned, overwritable by firmware install" acceptable
      long-term, or does routine curation demand the event-backed path next?
- [ ] **Who else curates:** single-owner tool forever, or per-POV placement assertions from
      others (decentralized-first) later?
- [ ] **Interaction ceiling:** are dialogs "with ease" enough, or is drag-and-drop on the DAG
      the real bar?
