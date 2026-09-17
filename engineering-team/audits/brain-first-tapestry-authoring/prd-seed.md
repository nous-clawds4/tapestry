# PRD Seed: Brain-First Tapestry Authoring

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/brain-first-tapestry-authoring/audit.md`
**Anchor:** acceptance frame in `book.md` (eagerly anchored at intake, 2026-08-04)
**Confidence:** high *(single story, full trail, frame-first)*

**Date:** 2026-08-05

> A **reverse-engineered baseline** in PRD shape, built from what shipped. Strawman for the product team, not a ratified spec. Tags: `[FROM FRAME]` / `[INFERRED]` / `[UNKNOWN — product input needed]`.

## 1. Product vision

`[FROM FRAME]` Tapestry is first and foremost a local-first personal knowledge graph in which **Neo4j is the definitive "me" and signed nostr events are letters** (BIBLE §30). Authoring a tapestry must therefore be a *thought before it is a letter*: the instance's own brain knows every tapestry the moment it is created or edited, and the published event is the durable, shareable proof — never the only copy. `[INFERRED]` The user-felt promise: every surface of the instance agrees about what exists, regardless of which store it reads; no more "the directory shows it but the concept's Elements view says it doesn't exist."

## 2. Personas

`[FROM FRAME]` **The instance owner** — the only persona this book serves: they author tapestries (directly or via their Tapestry Assistant) and expect their own instance to be self-consistent. `[INFERRED]` **Peers/visitors** are explicitly *not* served yet: their published tapestries appear in the permissionless directory but do not enter the owner's brain (deferred to the ingest, which owns trust/provenance semantics). `[UNKNOWN — product input needed]` whether peers' tapestries should ever auto-enter the brain, and under what WoT filter.

## 3. Scope (as-built)

`[FROM FRAME]` Creating a tapestry (either signing mode) writes the brain and mails the letter in one flow; edits (add/remove a concept) keep the two agreeing; the node carries its `tapestryKey` with a derived cache doc; the authored JSON carries `word` + `tapestry` + `graph`. `[FROM FRAME]` Out of scope, stated at intake and held: backfill of pre-existing tapestries; the general letter ingest; the LMDB completeness doctrine; flipping the directory's read source. `[INFERRED]` Also shipped as enabling behavior: third-party publishing is untouched (allow-list), and a failed brain write reports in the API response without failing the publish. `[INFERRED, operator-validated on staging]` An emergent property narrows the backfill gap: because the hook fires on every *owned republish*, editing a legacy (pre-#7) tapestry heals it into the brain — only **untouched** legacy elements still wait for stage-2 ingest.

## 4. Domain model

`[INFERRED]` A **tapestry element** = kind-39999 letter z-tagged to `39998:<TA>:tapestry`, JSON `{word, tapestry, graph}` (legacy elements may lack `word`; readers tolerate both). Its brain form: a `ListItem` node placed via `HAS_ELEMENT` under the tapestry concept's Superset, carrying the same tags (implicit membership via the `z` tag), a once-assigned `tapestryKey`, and a derived LMDB doc `{word, tapestry, graph, graphContext}`. The **derivation direction is one-way**: brain → cache; the cache is invalidated and recomputed when content changes, never authored into.

## 5. Design rules (as-built)

`[INFERRED]` No new screens — the change is invisible when it works; the existing create/add/remove flows and both read surfaces behave as before, now consistently. `[INFERRED]` Authoring safety rule carried from prior books: publish under the owner's own key or the TA's, chosen at authoring time. `[UNKNOWN — product input needed]` What the owner should *see* when a brain write fails behind a successful publish (currently: nothing — OPEN.md #138); a designed partial-failure state is product territory.

## 6. Carry-forward & open questions

Promoted from audit §6: **stage-2 ingest** (provenance, read-source flip, backfill — OPEN.md #136), **LMDB completeness doctrine** (#137), **UI surfacing of brain-write failures** (#138), **deriver staleness audit** (#139), prod promotion via the operator's batch (#131), cross-doc `word` uniformity (#137's scope).

## 7. What product must validate

- [ ] Should peers' tapestries ever enter the owner's brain automatically, and under what POV/WoT filter? (This decides stage-2 ingest's product shape, not just its mechanics.)
- [ ] What does the owner see on a partial failure (letter published, brain write failed)? Silent + repairable, warned, or blocking?
- [ ] When the ingest lands, does View Tapestries flip to reading the brain (per-POV filtered), and does the directory then *distinguish* brain-known from letter-only tapestries?
- [ ] Is `word`-in-every-letter the standard for all future word-wrapper doc types, or a tapestry-local choice? (#137 owns the doctrine; product owns the intent.)
