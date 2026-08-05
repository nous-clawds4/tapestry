# Story 7: Brain-first tapestry authoring

**Status:** Approved
**Created:** 2026-08-04
**Type:** Bug

## Background

Tapestry authoring is "letter-only": creating a tapestry publishes the signed kind-39999 event to strfry but never writes the brain. Under BIBLE §30 (ratified 2026-07-25), Neo4j is the definitive "me" and signed events are letters — the current flow mails a letter the brain never thought. The user-visible defect: View Tapestries (reads letters) lists tapestries that the tapestry concept's own Elements view (reads the brain) says don't exist — observed on this machine (Tapestry for Farm Animals), on staging (Tapestry for Cat), and misdiagnosed once already as data loss (OPEN.md #88 → #136). ADR tapestries/0001's "strfry is the source of truth" premise predates §30 by two days and is inverted by it.

The owner has ratified scope (OPEN.md #136, 2026-08-04): authoring writes the brain and mails the letter; the new node is stamped with its `tapestryKey` and its LMDB doc is derived (derivation from the brain — never a co-equal authored copy); and the authored JSON includes a top-level `word` section alongside `tapestry` and `graph`. The wider LMDB-completeness doctrine is deliberately deferred (#137).

## User-facing description

As the instance owner, I want every tapestry I author to exist in my brain (Neo4j) the moment the flow completes — with the signed event published as its letter and the derived cache warmed — so that every surface of my instance agrees a tapestry exists, regardless of which store it reads, and my tapestries are part of the definitive "me" that a brain backup would preserve.

## Acceptance criteria

- [ ] **AC1 — assistant-signed create reaches both stores.** Given the local stack, when the owner creates a tapestry via Create New Tapestry signing as the Tapestry Assistant, then the new tapestry appears in **View Tapestries** *and* in the **tapestry concept's Elements view** (brain-backed), with no manual repair step in between.
- [ ] **AC2 — own-key create reaches both stores.** Same as AC1 with the owner's own key (NIP-07) selected as the signer: by the time the create flow completes, both views list the tapestry.
- [ ] **AC3 — the letter carries `word` + `tapestry` + `graph`.** The published event's JSON has all three top-level sections; the tapestry still validates against the tapestry concept's JSON Schema; and the existing directory and Exploration surfaces render title, description, and members exactly as before (no regression).
- [ ] **AC4 — the cache is derived.** The new tapestry's node carries a `tapestryKey`, and the tapestry-key API returns a derived doc for it containing `word`, `tapestry`, and `graph` sections plus derivation metadata.
- [ ] **AC5 — edits keep the stores agreeing.** Given an existing brain-known tapestry, when the owner adds a concept to it or takes one out, then the brain's copy and the letter reflect the same member list afterward (the Elements view still lists the tapestry; its content matches the republished letter).

## Concepts touched

- `39998:<TA>:tapestry` — the tapestry concept (elements of it are what this story writes; TA pubkey is runtime-resolved, never hardcoded)
- The tapestry-element JSON shape (`tapestry` + `graph`, now + `word`) as validated by the concept's JSON Schema

## Out of scope

- **Backfill of pre-existing tapestries** (Farm Animals local, Cat staging) — stage 2 of OPEN.md #136 (the general strfry→Neo4j letter ingest) covers them; they remain as live demonstrations of the pre-fix state.
- **The general letter ingest** for peers' or historical kind-39999 events (#136 stage 2).
- **The LMDB completeness doctrine** — when docs must be full, when `word` may be omitted, when entries may be absent (#137; self-ontology epic).
- **Retrofitting `word` into other word-wrapper doc types** for uniformity (#137).
- **Changing what View Tapestries reads** — it stays on strfry until the ingest exists; flipping it to the brain is a later story.

## Open questions

None — all three resolved by the owner at approval (2026-08-04):

1. Edits (add/remove concept) **in scope** alongside create — AC5 stands.
2. Backfill of pre-existing tapestries confirmed **out of scope** (stage 2 ingest covers them).
3. Own-key bar confirmed: **brain-known by flow completion**, same as assistant-signed.

## Linked artifacts

- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
