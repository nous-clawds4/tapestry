# Epic: Shared-Concepts Adoption

**Status:** Active
**Provenance:** `engineering-team/stories/_intake.md` entry 2026-08-05 (the owner's S-subset taxonomy + features F0–F5); book anchor at `engineering-team/audits/shared-concepts-adoption/book.md`. Doctrine prerequisite (F0) ratified as BIBLE §31 via `self-ontology` #2.

## What this is

The adoption machinery over the Shared Concepts observation surfaces (PRs #491–#494): turning what the instance can *see* — S1 self-declared concepts, S2 b-tag promotion, S3 z-tag usage — into guided owner action. Queues that nominate concepts to adopt or publish, coverage discipline over the instance's own headers, usage-derived dictionaries, and default stamping. The system nominates; the owner ratifies; first-person queries answer `authors:[TA]` per BIBLE §31.

## Stories

`stories/shared-concepts-adoption/`:

1. **b-coverage-audit-and-disposition** — F5: coverage states on the concept-headers list (wired / self-declared / deliberately private / undispositioned) + guided iteration through the undispositioned with three symmetric actions (wire external b / auto b-tag / sentinel `b-tag-deferred`). Carries the W16 ruling (sentinel as reserved third `b` value form) + the wire-external b-append primitive that F1 later consumes.

Anticipated (not yet planned — numbers assigned at planning; see the book anchor):
- F1 adoption-candidates queue (S3 ∖ S2a nomination surface; consumes story 1's primitive).
- F2 inverse queue (self-declare candidates).
- F3 trusted dictionary (S3b + threshold; dated derived artifact).
- F4 publish-time default stamping (the ratified floor in the authoring flows).

## ADRs

`decisions/shared-concepts-adoption/` — none yet; 0001 lands with story 1.

## Notes

F0 (the instance-identity doctrine) deliberately lives in `self-ontology` (#2, ADR 0002) — it is doctrine, not adoption machinery; this epic's stories cite §31 rather than restating it. Feature order in the book (F-numbers) is the owner's priority order, not story numbering — F5 goes first by owner decision (2026-08-06), inverting the intake's dependency sketch; the shared primitive moves with it.
