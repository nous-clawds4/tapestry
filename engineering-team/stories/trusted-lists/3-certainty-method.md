# Story 3: Certainty membership method (rung 3) + fixture prune

**Status:** Approved (operator delegated the full rung-3 cycle, 2026-08-27)
**Created:** 2026-08-27
**Type:** Feature

## Background

Rung 3 of the `tl-weighted-certainty` ladder. Rung 2 (weighted sum) is operator-validated.
This rung adds the **Certainty** method — the full spec formula — as the third selectable
option, and pays down the dev-loop debt that made rung 2 painful (OPEN 182: fixture
accumulation makes every refresh O(all pins ever)).

Scale decision (operator, 2026-08-27, at rung-3 kickoff): **certainty publishes on the
0–100 scale immediately**, decimals kept for hand-validation — e.g. `50`, `18.774834`.
Rung 4 then only rounds to integers and flips the membership predicate. (NIP-85 quantum:
÷100 is the one rule consumers ever need.)

## User-facing description

As the operator, I want to switch the pipeline to "Certainty" and see each member's
0–100 certainty × agreement score on the published TL — and I want the fixture debris from
testing pruned so refreshes take seconds again — so I can hand-validate the final formula
quickly.

## Acceptance criteria

Notation: per member, `input` = Σ(rank/100) over non-neutral gate-passing taggings,
`agreement` = Σ(rank/100 × ±1) ÷ input; `certainty = 1 − 0.5^input` (rigor 0.5, constant).

- [ ] **Method selectable.** "Certainty" is enabled on the Trust Determination Methods page;
      selection persists pipeline-wide as before. All three methods now selectable.
- [ ] **Wire records it.** TLs refresh under it carry `["membership-method", "certainty"]`.
- [ ] **Score = agreement × certainty × 100**, 6-decimal precision, in the p-tag score slot
      and content JSON — same slot as rung 2, new formula, 0–100 scale.
- [ ] **Known-value checks** (same fixture matrix as rung 2):
      - A (one rank-100 apply): agreement 1, certainty 0.5 → score **50**;
      - B (ten rank-3 applies): input 0.3 → score ≈ **18.77** (low-trust crowd saturates low);
      - C (two rank-90 applies): input 1.8 → score ≈ **71.35** (weighting still beats counting);
      - D (2× rank-40 apply + rank-40 dispute): agreement ⅓, input 1.2 → score ≈ **18.62**;
      - E (equal-weight split): agreement 0 → score **0**;
      - F (dispute dominance): negative agreement → negative score (visible; predicate still
        count-based until rung 4).
      Exact expectations computed by the same formula in tests/kit (no hand-rounded decimals).
- [ ] **Membership, ordering, counts, fallback unchanged** — same guarantees as rung 2:
      count-based predicate and order; raw counts intact; unresolvable POV → publishes as
      `count`, no scores.
- [ ] **Rungs 1–2 still work.** Switching among count/input/certainty produces each method's
      already-validated output.
- [ ] **Kit covers certainty.** `scripts/tl-ladder-validate.js certainty` and `--all` (now
      three columns) print published-vs-expected; kit refuses nothing anymore (all methods
      implemented).
- [ ] **Fixture prune (OPEN 182).** A dev-only script deletes fixture events from local
      strfry by known fixture slug prefixes ONLY (kit + suite prefixes; never touches
      non-fixture events), covering the fixture kind-39999 events (tags, taggings, pins) and
      the TA-signed TLs derived from them. The kit prunes before seeding; the script is also
      runnable standalone. After a prune, `refresh-all` returns to seconds on a
      previously-bloated stack. Local relay only; refuses to run if publish policy is not
      local-only.
- [ ] **Local-only publishing** throughout.

## Concepts touched

Same as Story 2 (no concept definitions change; no firmware reinstall).

## Out of scope

- Rung 4: integer rounding, `score ≥ 1` predicate, score ordering, `rigor` wire tag,
  `membership-method` spec-or-strip, `includeScoreInTL` reconciliation.
- Tunable rigor (constant 0.5).
- Meilisearch fixture-doc cleanup (harmless leftovers; noted, not blocking).
- Hardening the two legacy suites (OPEN 183).

## Linked artifacts

- Book: `engineering-team/audits/tl-weighted-certainty/book.md`
- Epic: `engineering-team/epics/trusted-lists.md`
- ADR: `engineering-team/decisions/trusted-lists/0003-certainty-method-and-prune.md`
- Test plan: `engineering-team/stories/trusted-lists/3-certainty-method.test-plan.md`
- Review: (filled in after Review phase)
