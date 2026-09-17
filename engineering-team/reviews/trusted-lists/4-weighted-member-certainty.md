# Review: Story 4 — Formalized certainty contract (Light profile)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-08-27
**Diff:** commit `6e17ab66` (on top of the staging merge `32e60cc5`)
**Story:** `engineering-team/stories/trusted-lists/4-weighted-member-certainty.md`
**Mode:** Light profile (operator direction — no separate Test Design phase; existing
suites amended in-diff; no ADR — the story's five operator-decided items are the contract).

## Quality gates (run by reviewer)

- [x] All three ladder suites green post-change: story-1 **12/12**, story-2 **8/8** (+1
      standing skip), story-3 **7/7** — each amended to the formalized contract (method-tag
      absence, integer/exclusion expectations).
- [x] Kit `--all` live: **every cell ✓** — certainty column now integers (A 50, B 19, C 71,
      D 19), **E and F excluded** per the `score ≥ 1` predicate, raw p-tags show score-desc
      ordering (71, 50, 19, 19), `["rigor","0.5"]` present, no `membership-method` tag.
- [x] `node --check` all changed files; UI build clean; app restarted before runs.

## The five operator decisions, verified

1. **Integer rounding** — `Math.round(Math.max(agreement × certainty, 0) × 100)` (spec
   formula incl. negative clamp); wire + content JSON integers.
2. **Predicate v2 + ordering** — `.filter(score >= 1).sort(score desc, pubkey asc)` in the
   certainty fold only; count/input byte-unchanged as diagnostics. E (50/50) and F
   (net-negative) verifiably publish on no list.
3. **`rigor` tag** — rides certainty TLs only (the constant is meaningless for count/input);
   D12-required; kit asserts it.
4. **`membership-method` stripped** — removed from the emit path for ALL methods; every
   suite + the kit now asserts its absence; count TLs are byte-identical to pre-ladder shape.
5. **`includeScoreInTL` retired** — the Story-12 wot_rank enrichment block deleted; old pins
   accepted, flag ignored; the slot's meaning is singular.

## Notes

- Net diff is −53 lines: formalization mostly *removed* ladder scaffolding.
- The UI certainty blurb now defines "agreement" inline (operator-flagged twice — the term
  needed its definition at point of use).
- Deliberately NOT done (story out-of-scope): flipping the default method to `certainty`
  (deploy decision — the book's final open item) and the TL draft-spec prose update (docs
  work, noted for book close).

## Verdict

**PASS** — all five items implemented exactly as decided, verified live end-to-end; count
path provably unchanged; the D12 wire contract is now fully realized behind the certainty
method selection.
