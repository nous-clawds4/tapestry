# Epic: Shared-Concepts Adoption

**Status:** Done
**Provenance:** `engineering-team/stories/_intake.md` entry 2026-08-05 (the owner's S-subset taxonomy + features F0–F5); book anchor at `engineering-team/audits/shared-concepts-adoption/book.md`. Doctrine prerequisite (F0) ratified as BIBLE §31 via `self-ontology` #2.

## What this is

The adoption machinery over the Shared Concepts observation surfaces (PRs #491–#494): turning what the instance can *see* — S1 self-declared concepts, S2 b-tag promotion, S3 z-tag usage — into guided owner action. Queues that nominate concepts to adopt or publish, coverage discipline over the instance's own headers, usage-derived dictionaries, and default stamping. The system nominates; the owner ratifies; first-person queries answer `authors:[TA]` per BIBLE §31.

## Stories

`stories/done/shared-concepts-adoption/` (all Done; retired at the book close 2026-08-07):

1. **b-coverage-audit-and-disposition** (F5) — coverage states + guided disposition + W16 sentinel + the wire-external b-append primitive.
2. **adoption-candidates-queue** (F1) — the S3 ∖ S2a nomination surface; Adopt / Recognize / Decline with the dated supersedable ledger.
3. **inverse-queue-publish-candidates** (F2) — "Mine to publish" with distinguishable z/b evidence; sentinel decline; deferred-in-use reveal.
4. **publish-time-default-stamping** (F4) — pin/TL personal-z parity + `selectPointerTargets` + the create-element dual-stamp seam.
5. **trusted-dictionary** (F3) — per-POV live view (verified-cutoff qualifying set) + owner-minted dated snapshots.
6. **self-cleaning-snapshot-fixtures** — the story-5 suite sweeps its own mints.
7. **graph-derived-twin-picker** — `GET /api/adoption-twins`: graph ∩ has-event, uuid-deduped.
8. **adoption-queue-view-explainers** — per-view explainers (owner's wording) + column/action tooltips.
9. **adoption-row-raw-event-view** — queue rows click through to the raw header event (`header/:coord`).

## ADRs

`decisions/done/shared-concepts-adoption/` — 0001 (b-coverage), 0002 (adoption queue), 0003 (inverse queue), 0004 (stamping stage 1 + sweep map), 0005 (trusted dictionary).

## Notes

F0 (the instance-identity doctrine) deliberately lives in `self-ontology` (#2, ADR 0002) — it is doctrine, not adoption machinery; this epic's stories cite §31 rather than restating it. Feature order in the book (F-numbers) is the owner's priority order, not story numbering — F5 goes first by owner decision (2026-08-06), inverting the intake's dependency sketch; the shared primitive moves with it.
