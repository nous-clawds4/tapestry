# Review: Story 3 — Certainty method (0–100) + fixture prune

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-08-27
**Diff:** test commit → `1ae9a519`
**Story:** `engineering-team/stories/trusted-lists/3-certainty-method.md`
**ADR:** `engineering-team/decisions/trusted-lists/0003-certainty-method-and-prune.md`
**Mode note:** operator delegated the full rung-3 cycle (gates answered under that
delegation, 2026-08-27); this review is the cycle's audit record for operator check-back.

## Quality gates (run by reviewer)

- [x] Story suite `test/tl-certainty-method.test.js`: **7/7** (incl. live LB matrix and LP
      prune-effectiveness). Failing-first verified pre-implementation (6 fail / 1 guard).
- [x] Kit `--all` live: **every cell ✓** across count/input/certainty for all six scenarios
      (A 50, B 18.77476, C 71.282541, D 18.824157, E 0, F −42.52002 on the certainty column).
- [x] Regression after ladder-evolution amendments: story-1 **12/12**, story-2 **8/8** (+1
      standing LA skip when a POV exists).
- [x] `node --check` all changed files; UI build clean; app restarted before green runs.
- [x] Prune verified live twice (suite LP + kit pre-seed); post-prune refreshes are seconds.

## Spec adherence

- [x] Certainty selectable; wire records `certainty`; score = agreement × (1 − 0.5^input) ×
      100 at 6 decimals in p-tag + content JSON (`refreshPinnedTags.js` certainty fold).
- [x] 0–100 scale from rung 3 (operator decision at kickoff) — anchors: A exactly 50; F
      negative. Expectations computed by the same JS expression (float-exact, no hand-rounded
      literals).
- [x] Membership/order/counts/fallback unchanged (LB asserts; fallback generalized to any
      non-count method without `wotFiltering`, wire records what ran).
- [x] Prune: id-list-only deletion, fixture-prefix matching, local-only guard, standalone +
      kit-integrated (`--no-prune` escape). OPEN 182's acceptance ("refresh-all returns to
      seconds") observed directly.
- [x] Rungs 1–2 still work (regression + kit count/input columns).

## Deviations / judgment calls (for operator check-back)

1. **Ladder-evolution test amendments** (story-1 U4 → "every method resolves to itself";
   story-2 U1 → prefix assertion; story-2 U3 → garbage-id fail-safe): prior rungs' snapshot
   assertions were invalidated by rung 3 by design, same precedent as the rung-2 amendments.
   The fail-safe property itself remains covered (garbage/malformed → count).
2. **S2's textual proxy loosened** during the green pass (the prune uses argv-form
   `['strfry','delete']`, not the literal string) — test wrong, not code; OPEN-174 pattern.
3. Legacy-suite prefixes (`s11b-`, `s12-`, `cpin-`) included in the prune list — their
   fixtures are the bulk of the debris; deletion is id-list-bounded and prefix-matched only.
4. Meili fixture docs intentionally left (story out-of-scope note).

## Verdict

**PASS** — all ACs verified live by the reviewer; the three-method ladder is complete and
cross-validated by the kit's combined table; the dev-loop debt (OPEN 182) is paid. Remaining
book scope: Story 4 (Formalization: integer rounding, `score ≥ 1` predicate + score
ordering, `rigor` tag, `membership-method` spec-or-strip, `includeScoreInTL`
reconciliation), then the queued kind-10040 TL-provider line.
