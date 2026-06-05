# ADR 0006: Community-reference protocol model & deferred roadmap

**Status:** Accepted
**Date:** 2026-05-19
**Relates to:** ADR 0004 (+Rev 1), ADR 0005 (+Rev 1, Rev 2) — the implementing decisions; 0006 is their theory umbrella.

## Context
The community-reference + concept-export feature shipped through a long arc (stories #8/#9; ADRs 0004/0005 and three revisions; PRs #156/#157/#158/#159). The *implementation* decisions are recorded, but the *theory* — why it's shaped this way, the resolution model, the accepted compromise and its exit, and the explicitly-deferred protocol/feature streams — lived only in the originating session's transcript. Tapestry Theory belongs in BIBLE.md; ratified decisions belong in an ADR.

## Options considered
- **Option A — Umbrella theory ADR (0006) + canonical BIBLE §22 + §6/glossary updates (chosen).** One ratifiable theory record; the artifact future cycles get ratified against; the collision contract documented where consumers look.
- **Option B — Leave theory inside 0004/0005 + revisions.** Rejected: not discoverable as a whole; no single ratifiable model; the deferred roadmap stays tribal memory.
- **Option C — BIBLE only, no ADR.** Rejected: BIBLE is descriptive, not decision-historied; loses the options/why and the ratification record.

## Decision
**Option A.** Record the model as ratified theory; defer the rest explicitly with blast radii so each future stream is designed against a written model.

## Consequences
- Theory is durable + ratifiable; Header→ConceptGraph, privacy tiers, registry-as-DList, materialization, and the signed editorial relationship-type each get designed against BIBLE §22.
- The `REFERENCES` collision contract is documented where consumers will hit it (BIBLE §6 + glossary).
- Flaw A and its exit (registry-as-DList) are on the record, not tribal.
- **Firmware reinstall required?** No. **Blast radius:** docs only.

## Implementation notes
- New `engineering-team/decisions/0006-community-reference-theory.md` (this file).
- BIBLE.md: new `## 22. Community-Reference Model` before the maintainer footer; add a concept-level `REFERENCES` row to §6 with the collision contract; glossary entries for `REFERENCES` (concept-level), `communityReference`, and the `grapevine → firmware → none` resolution fallback.

## Out of scope
Implementing any deferred stream. This ADR only records the model and defers, with blast radius:
- **Header→ConceptGraph tag** — single-event full retrieval; every header `create-concept` emits + re-derivation of all existing headers + BIBLE §5/§8. Own ADR.
- **Privacy tiers** (private/encrypted, local/unencrypted, published) — consensus computable only over the published tier by construction; tier-promotion leaks prior versions unless a fresh event is minted. Own ADR.
- **Signed/first-class editorial relationship-type** (the protocol-correct IMPORT-as-signed-event, ADR 0005 Option B) — firmware relationship-types change → reinstall + cross-instance. Own ADR.
- **Registry-as-DList** — retires flaw A; the per-concept pointer becomes a community-curated, Grapevine-ranked DList. Own stories/ADR.
- **Element/superset materialization** — walk the `REFERENCES` edge to pull the community concept's elements/subsets/schema; wants this theory + possibly Header→ConceptGraph first.
