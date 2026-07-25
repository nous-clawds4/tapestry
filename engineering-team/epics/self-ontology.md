# Epic: Self Ontology

**Status:** Active
**Provenance:** `docs/SELF_ONTOLOGY_DESIGN_HANDOFF.md` (Protocol-Spec Workflow — Scope+Capture done, 2026-07-24)

## What this is
The cross-cutting standard for **which store holds the self, and what everything else is for**.
Tapestry is first and foremost a *local-first personal knowledge graph*: **neo4j is the definitive
"me"**; the tapestry LMDB is a subordinate cache; signed nostr events are "letters" — the proof,
communication, and durability axis, not the identity substrate.

This resolves a live tension in the codebase. Protocol-first flows (import, normalization, firmware
reinstall, reconciliation) treat neo4j as freely re-derivable from strfry, while brain-first work
(second-brain, graph-curation, relationship-primitives) accumulates neo4j state that has **no event
behind it**. Under the old framing those rebuild flows may destroy authoritative state. This epic
ratifies the ontology into the canonical spec, then works through its consequences — provenance,
non-destructive rebuilds, lossless serialization, and backup.

## Stories
`stories/self-ontology/`:
1. **ratify-the-self-ontology** — docs-mode: the settled ontology (identity model, asserted core,
   reconciliation with the architecture invariants) plus the settled *requirements* (provenance
   taxonomy, non-destructive rebuild invariant, LMDB dual role, coverage-vs-normalization) →
   new BIBLE section + CLAUDE.md pointer + umbrella ADR. *(this story)*

Anticipated (not yet planned — see handoff §10 consequence map):
2. Provenance primitive — representation, migration, writer discipline (gates the code work).
3. Non-destructive rebuild/reconcile hardening across the import/normalize/reinstall/reconcile surfaces.
4. Deriver audit + lossless serialization mode + run manifest.
5. Backup pipeline — serialize → encrypt → chunk → stash → verified restore drill.
6. Health monitoring — orphans, missing/stale LMDB docs, schema-invalid docs, coverage drift.

## ADRs
`decisions/self-ontology/` — 0001 (this story; umbrella ontology ADR).

## Notes
The handoff doc stays **🔴 OPEN** after story 1 — only part of its content ratifies here. It flips to
✅ SUPERSEDED once the remaining open designs (§4 representation, §7 backup mechanics, §8 covering
conjecture) have landed.
