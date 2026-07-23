# Epic: graph-curation-ui

**Created:** 2026-07-22
**Status:** Active

## Goal

Give the Tapestry owner **front-end affordances for editing the Neo4j reference graph** through
the strfry-free relationship-primitives family — starting with placing, moving, and removing
nodes under sets from the concept pages. This continues the "second brain" premise of epic
`relationship-primitives`: Neo4j is the reference; these affordances edit it directly, minting no
nostr events.

## Why it matters

The primitives shipped API-only — "UI affordances" were explicitly descoped from that book and
never re-homed. Routine curation therefore still requires hand-crafted container-loopback calls
with exact uuids, relationship spellings, and direction. The concept pages display the DAG but
cannot change it; the one existing write flow ("Add Node as Element") targets only a concept's
top-level superset.

## Stories

1. `stories/graph-curation-ui/1-move-nodes-between-sets-ui.md` — place / move / remove
   placements from the set detail page, the element detail page, and the Organization (Sets)
   overview; both placement kinds (element, subset). **Done** (review PASS 2026-07-22; live on
   staging, tapestry.brainstorm.world, and tags.brainstorm.world as of 2026-07-23).

## Key facts / guardrails

- **ADR `relationship-primitives/0001` binds every story here:** per-operation owner gate (owner
  OR trusted-local), the two whitelisted relationship kinds only (`CLASS_THREAD_TERMINATION` /
  `HAS_ELEMENT`, `CLASS_THREAD_PROPAGATION` / `IS_A_SUPERSET_OF`), the idempotent response
  contract, and the hazard note on every graph-changing success — the UI surfaces that note,
  never suppresses it.
- **Primitives carry no policy.** Placement semantics (what may be placed under what, and from
  which surface) live in the UI layer this epic builds.
- **Durability is out of initial scope.** The firmware-install overwrite hazard remains
  documentation-only; event-backed durable moves are a candidate follow-up story, not part of
  story 1.
- **TA pubkey is never hardcoded** (CLAUDE.md rule). Story docs may quote local-instance handles;
  code resolves the pubkey at runtime.
