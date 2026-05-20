# Story 11: Community-reference Superset link (materialization placeholder)

**Status:** Approved
**Created:** 2026-05-19
**Type:** Feature

## Background
Stream #5 of the ADR 0006 deferred roadmap, now unblocked by #10 (deterministic Header→ConceptGraph resolution). Today the `REFERENCES` edge (`localHeader → communityHeader`) is **inert** — `pass_communityReferences` materializes only the community Header. This story wires the **structural placeholder** the owner described at the very start of this whole arc:

> *"I will not necessarily go through the motions of the importation … but by establishing the `is a superset of` relationship, this acts as a placeholder for some time in the future when I may wish to query the community for data and input it into my local Tapestry."*

Grounding finding: the community Superset a-tag is **deterministically derivable** exactly like #10's concept-graph — `39999:<curator-pubkey>:<slug>-superset` (firmware `${slug}-superset` convention, `index.js:338`).

## User-facing description
As an installer/operator, after firmware install completes, my local concept's Superset has a real `IS_A_SUPERSET_OF` edge to the materialized community curator's Superset. The community's structure is *reachable* by class-thread traversal — without bulk-copying the curator's element/set nodes (which is explicitly deferred).

## Acceptance criteria
- [ ] Given a `communityReference` whose curator Superset is published on `relayHints`, when firmware install runs, then `39999:<curator-pubkey>:<slug>-superset` is fetched, materialized as a distinct Neo4j node (uuid = its a-tag), and `(localSuperset)-[:IS_A_SUPERSET_OF]->(communitySuperset)` exists.
- [ ] Given the community Superset is unreachable (relay miss / not published), install **logs + continues**; no edge wired; local concept + the existing `REFERENCES` edge unaffected (graceful).
- [ ] Re-install is **idempotent** — no duplicate node, no duplicate edge (deterministic a-tags + MERGE).
- [ ] **Honest invariant (this story does NOT pull element/set data):** community element/set *nodes are NOT* materialized; the edge is a structural bookmark only. Class-thread traversal reaches the community Superset; surfacing concrete community elements is the explicitly-deferred next stream.
- [ ] Zero behavior change for anything not traversing the new edge.

## Concepts touched
- `localSuperset` (`39999:<localTA>:nostr-relay-superset`) — gains one outgoing `IS_A_SUPERSET_OF`.
- New foreign node `39999:<curator-pubkey>:nostr-relay-superset` (materialized community Superset).
- Existing `(localHeader)-[:REFERENCES]->(communityHeader)` — unchanged.

## Out of scope (named, deferred under ADR 0006)
- **Bulk element/set import (Option B / "full importation")** — the curator's elements + sets as local nodes; its own future stream with its own ADR (trust/provenance/dedup designed deliberately).
- Any consumer/query that surfaces community elements via the new link (the link is structural; surfacing/expansion is a separate on-demand stream).
- Changes to #10 (`concept-graph` tag), the `REFERENCES` edge, the `communityReference` manifest field, export, or any of the editorial-relationship deferred items.

## Open questions (resolved in Architecture / ADR 0008)
- **Canonical Superset-resolution path** — deterministic compute (`39999:<curator>:<slug>-superset`) vs via the #10 `concept-graph` tag → Concept Graph member resolution. Recommend deterministic-compute-only for this phase (Phase-A simplicity; matches #10's pragmatism); the concept-graph-mediated fallback is its own future enhancement.
- **`IS_A_SUPERSET_OF` interaction with existing normalization** — unlike the Neo4j-only `REFERENCES`, this is the **canonical class-thread propagation relationship**, so normalization already understands it (reachability "just works") *but*: (a) the install's "prune redundant Superset edges" pass — analyzed as non-firing for the new cross-curator edge (no alternate path to the foreign node), confirm in ADR; (b) Rule 5 ("Superset nodes MUST reference the canonical superset concept") — the foreign curator's Superset event z-tags reference *their* superset concept-header pubkey, not ours; ADR must state whether that audit interaction is benign/documented or needs a `source`-property exemption; cycle-local smoke will surface either way.
- **`:Superset` label on the materialized foreign node** — `buildImportCypher` labels by kind (`ListItem` for 39999); to satisfy the class-thread reachability promise, the community Superset needs the `:Superset` label SET as a follow-up (existing local pattern). One-line addition; ADR confirms.

## Linked artifacts
- ADR: `engineering-team/decisions/0008-community-reference-superset-link.md` (Accepted; Option A — deterministic compute + SET :Superset + post-derive IS_A_SUPERSET_OF MERGE)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
