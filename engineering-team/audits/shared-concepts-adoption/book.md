# Book of Work: Shared-Concepts Adoption Suite

**Slug:** shared-concepts-adoption
**Status:** Closed
**Closed:** 2026-08-07 — frame 6/6 (F0–F5) + hygiene stories 6–9, all in production (PR #510, `f3d3ae43`). Close artifacts: [`audit.md`](./audit.md) + [`prd-seed.md`](./prd-seed.md) (acceptance-frame provenance, confidence high). Retro dispositions: audit §7. Epics retired at close: `shared-concepts-adoption` (stories 1–9), `self-ontology` (stories 1–2; its broader consequence-trajectory reopens per the established reopen pattern when a next story lands).
**Opened:** 2026-08-05 — **eagerly at the Planning of its first story** (self-ontology #2 / F0), per the OPEN.md #78 lesson: a bounded ask opens its anchor when the book opens, not at close. The intake entry (`stories/_intake.md` 2026-08-05) predates the book by one session; this anchor restates it, owner-confirmed in-session on 2026-08-05.

## Intent anchor

**Acceptance frame (no PRD)** — the owner's S-subset taxonomy and six dependency-ordered features, recorded verbatim in the `stories/_intake.md` entry dated 2026-08-05 (S1/S2/S3 with a/b POV refinements; the existing Shared Concepts surfaces, PRs #491–#494, are the observation instruments the taxonomy formalizes). Protocol side: worksheet W15 (graduates via F0) and W16 (F5's question). Governing doctrine once F0 lands: BIBLE §31 (instance identity — the TA is the instance's "me").

**The frame:** each feature below is realized through its own story cycle (F0 via the Protocol-Spec docs-mode variant; F1–F5 as Standard feature stories), gate-approved by the owner per phase.

- [x] **F0 — instance-identity doctrine** (prerequisite, docs-mode): ratify "me" = the TA into BIBLE §31 + `self-ontology` ADR 0002; W15 → Graduated. Story: `stories/self-ontology/2-ratify-instance-identity.md` — Done 2026-08-06 (review 2, PASS).
- [x] **F1 — adoption-candidates queue**: S3 (∪ S3a/S3b) ∖ S2a → a review surface prompting the owner per concept (adopt via pointer-b on the local twin header and/or create the registry record). Proposal-loop shape: the system nominates, the owner ratifies. *Consumed F5's b-append primitive as planned (order inverted by owner decision 2026-08-06).* Story: `stories/shared-concepts-adoption/2-adoption-candidates-queue.md` — Done 2026-08-06 (review 2, PASS). Dedicated queue page; dated supersedable decline ledger (`adoption disposition` runtime concept); S3b deferred to F3.
- [x] **F2 — inverse queue (self-declare candidates)**: my headers with cross-author z/b usage but no self-pointing b → prompt "Submit as a Shared Concept" (the existing button is the action). Story: `stories/shared-concepts-adoption/3-inverse-queue-publish-candidates.md` — Done 2026-08-06 (review 3, PASS). Second view on the Adoption Queue page; decline = the F5 sentinel (no new machinery); deferred-but-in-use behind a collapsed reveal; both evidence kinds (z filings / b affiliations) counted distinguishably.
- [x] **F3 — trusted dictionary**: S3b with a minimum-trusted-users threshold; a dated derived artifact; explicitly NOT the W1 inherit-consensus signal (ADR 0029 keeps pointer/usage at zero weight there). Story: `stories/shared-concepts-adoption/5-trusted-dictionary.md` — Done 2026-08-07 (review 5, PASS). Scoring ratified at `/discuss` 2026-08-07: verified influence cutoff (batch default 0.01), distinct-trusted-authors threshold (default 2, configurable), live per-POV view + owner-minted dated TA-signed snapshot (`trusted dictionary snapshot` runtime concept); sentinel-deferred visible-but-never-published; usage-derived by self-description.
- [x] **F4 — publish-time default stamping (stage 1)**: the ratified floor in the fixed-surface writers. Story: `stories/shared-concepts-adoption/4-publish-time-default-stamping.md` — Done 2026-08-06 (review 4, PASS after one in-session kickback round: the ADR-0015 caller pin amended to key-based intent). **The choice IS the pointer-b** (registry-field sketch deferred); pin/TL personal-z parity + `selectPointerTargets` + the create-element seam shipped. **Named follow-up (out of this book's frame unless the owner extends it): the client-built-writer sweep** — candidate map in ADR 0004 (confirmed: NewDListItem, tapestry drafts; unmapped: DListItemNeo4j; possibly display-only: NewElement/NewProperty).
- [x] **F5 — concept-header b-coverage audit + guided disposition**: coverage tracking on Concept Headers plus the owner-prompted disposition flow (wire to external / self-declare / deliberately private). W16 ruled and graduated: the sentinel `["b", "b-tag-deferred"]` (owner decision at `/discuss`, 2026-08-06); the ruling + spec edits rode the story. Story: `stories/shared-concepts-adoption/1-b-coverage-audit-and-disposition.md` — Done 2026-08-06 (review 1, PASS). The wire-external b-append primitive F1 consumes shipped here.

**Early close provision (standing):** the owner may ratify a close on a subset — completion is *computed* against all six, but the close is always the owner's act; an early close records the un-built features as out-of-frame residue for the return edge (`prd-seed.md`), not silent drops.

**Out of frame** (stated, not silently dropped): W1 cross-deployment concept identity (its own trajectory); the shared-concepts resolver / cloud computation beyond what F4 needs; re-parenting the ADR-0015 legacy concepts; multi-tenant normativity of the F0 doctrine.

## Epics in this book

- `self-ontology` — F0's epic (Active; story #2). The doctrine is self-ontology's second chapter ("§30 governs stores, §31 governs keys").
- F1–F5 pick their epic homes at their own Planning (noted here as they open).

## Completion

Computed against the frame above: after each per-story PASS, check the boxes and — when all six are checked *or* the owner signals "that's everything" — **offer** the close; the owner ratifies. The system never declares done. Close artifacts at that point: `audit.md` + `prd-seed.md` (acceptance-frame provenance).
