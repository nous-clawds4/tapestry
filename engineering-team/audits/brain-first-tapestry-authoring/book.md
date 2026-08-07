# Book of Work: Brain-First Tapestry Authoring

**Slug:** brain-first-tapestry-authoring
**Status:** Closed
**Opened:** 2026-08-04 — **eagerly at intake**, before any phase ran (the OPEN.md #78 lesson: a bounded ask opens its anchor when the book opens, not at close).
**Closed:** 2026-08-05 — ratified by the operator in-session (*"Let's close the book and also deploy to staging"*), deploy-first per the Reviewer's recommendation: staging deploy PR [#489](https://github.com/nous-clawds4/tapestry/pull/489) (merge `1b0cb47d`, run 30969587875 green in 83s, five-tier smoke clean) preceded this close so the audit records the deployed state. Close artifacts: `audit.md` + `prd-seed.md` (acceptance-frame provenance, confidence high). Story #7 review: PASS. **Operator validation on staging (2026-08-05):** created a tapestry, saw it in both views; edited a pre-#7 tapestry and watched it appear in the Elements view — *"all of which is as intended"* (the edit-heals-legacy property; audit §3). Prod promotion deliberately not part of this book — rides the operator's #131 batch.

## Intent anchor

**Acceptance frame (no PRD)** — a bounded ask, restated and owner-confirmed in-session on 2026-08-04. The ratified scope decisions are recorded in OPEN.md **#136** (fix stage 1) and the story; the wider questions deliberately split out live in **#137** (LMDB completeness doctrine) and #136 stage 2 (general letter ingest). Governing doctrine: BIBLE **§30** (Neo4j is the definitive "me"; signed events are letters; the LMDB doc is *derived*, never co-equally authored).

**The ask, as confirmed:** every tapestry authoring write is brain-first — the tapestry exists in Neo4j, the signed event is published to strfry as its letter, the node is stamped with its `tapestryKey` and its LMDB doc derived, and the authored JSON carries `word` alongside `tapestry` and `graph`. Success is the end of the split-brain: View Tapestries and the tapestry concept's Elements view agree without manual repair.

- [x] Creating a tapestry (assistant-signed) leaves it visible in **View Tapestries** and in the **tapestry concept's Elements view**, no manual repair step.
- [x] Creating a tapestry (own-key / NIP-07) reaches the same end state **by flow completion**.
- [x] The authored letter carries `word` + `tapestry` + `graph`, stays schema-valid, and the directory + Exploration surfaces render as before.
- [x] The new node carries a `tapestryKey` and a derived LMDB doc (`word`/`tapestry`/`graph` + derivation metadata).
- [x] Add-a-concept and take-a-concept-out keep brain and letter agreeing (AC5 — edits are in scope by owner decision at story approval).

**Out of frame** (stated, not silently dropped): backfill of the two pre-existing tapestries (Farm Animals local, Cat staging — #136 stage 2's ingest covers them); the general strfry→Neo4j letter ingest; the LMDB completeness doctrine (#137); flipping View Tapestries' read source to the brain.

## Epics in this book

- `tapestries` — reactivated 2026-08-04 for story #7 (the Product Owner's act at Planning; precedent: the `add-a-concept-to-a-tapestry` book reactivated it for #5, the `take-a-concept-back-out` book for #6). Story path: `stories/tapestries/7-brain-first-tapestry-authoring.md`; ADR path: `decisions/tapestries/0007-<slug>.md`. The epic re-retires to Done at this book's close, and the L2 reopen waiver (OPEN.md #129 precedent) is removed then.

## Completion

Computed against the frame above: after the per-story PASS (single-story book unless scope grows), check the bullets and **offer** the close — the operator ratifies; the system never declares done.
