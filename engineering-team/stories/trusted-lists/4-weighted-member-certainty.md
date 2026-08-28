# Story 4: Formalize the certainty contract (rung 4)

**Status:** Approved (operator ratified the five-item package, 2026-08-27; delegated cycle)
**Created:** 2026-08-27
**Type:** Feature

> **Provenance:** originally approved as Story 1 (a direct swap of the membership math per the
> brainstorm_server D12 spec handoff `/home/vcavallo/tl-weighted-certainty-spec-for-tapestry.md`),
> re-sequenced into the stepwise ladder, and finally scoped at rung 3's close to this
> five-item formalization package, each item operator-decided explicitly (2026-08-27):
> 1. integer rounding — YES; 2. `score ≥ 1` predicate + score ordering — YES;
> 3. `rigor` tag — YES (it is required by the approved D12 spec);
> 4. `membership-method` tag — **REMOVE** from published TLs (never spec'd);
> 5. `includeScoreInTL` — retire (slot means one thing everywhere).

## Background

Rungs 1–3 delivered the selectable method ladder, all validated. The certainty method
currently publishes 6-decimal 0–100 scores as annotations while membership stays count-based.
This story makes certainty's published contract final per the D12 spec: integer scores decide
membership and order, reproducibility metadata rides the event, and the two
ladder/legacy-era wire artifacts (`membership-method` tag, `includeScoreInTL` rank-in-slot)
are removed. Count and Input remain selectable as diagnostics, unchanged.

## Acceptance criteria

All under the **certainty** method unless stated; count/input behavior byte-unchanged.

- [ ] **Integer scores.** Per member: `score = round(max(agreement × certainty, 0) × 100)`,
      an integer 0–100 (spec formula incl. the negative clamp). Wire: integer string in the
      p-tag slot; integer in content JSON. Known values: A(100@apply)→50; B(10×3@apply)→19;
      C(2×90@apply)→71; D(40,40@apply+40@dispute)→19; E(equal-weight split)→0; F(dispute
      dominance)→0 (clamped).
- [ ] **Membership predicate v2.** Member iff `applications ≥ cutoff AND score ≥ 1` — E and
      F publish on NO list (net-zero/negative members drop off entirely, the operator's
      50/50 intuition). Count/input keep the count predicate.
- [ ] **Score ordering.** Certainty TLs order members score desc, then pubkey asc; identical
      inputs → identical published order.
- [ ] **Reproducibility.** Certainty TLs carry `["rigor", "0.5"]` alongside cutoff/min-rank
      (required by D12); a consumer applying the spec formula to the live taggings + ranks
      reproduces every score exactly. Rigor is a constant, not a knob.
- [ ] **`membership-method` tag removed** from ALL published TLs (every method). It was
      ladder tooling, never spec'd. Suites/kit identify the active method by its observable
      output instead.
- [ ] **`includeScoreInTL` retired.** The legacy per-pin option no longer injects members'
      raw wot_rank into the score slot under any method; old pins carrying the flag are
      accepted and the flag ignored (no rejections). The slot's meaning is now singular:
      the method's score, always on for weighted methods, absent for count.
- [ ] **Invariants.** WoT floor (inclusive `minRank`), polarity bucketing, raw
      endorsements/disputes counts in content JSON, replaceable dedupe, retraction, d-tags,
      TA signing, no-POV fallback (publishes as count, no scores): all unchanged.
- [ ] **Kit + suites updated.** Kit validates the formalized contract (integer expectations,
      membership expectations — "E/F correctly excluded"); prior suites' method-tag
      assertions amended to assert the tag's ABSENCE.
- [ ] **Local-only publishing** throughout.

## Out of scope

- Flipping the DEFAULT method from `count` to `certainty` — a deploy/promotion decision,
  recorded as the book's final open item, not a code change here.
- Protocol-spec prose for the TL wire contract (rigor tag etc.) — the tags/TL draft spec
  lineage update is docs-mode work, noted for the book close.
- Tunable rigor; multi-hop propagation; consumer-side changes; brainstorm_server-side work.

## Linked artifacts

- Book: `engineering-team/audits/tl-weighted-certainty/book.md`
- Epic: `engineering-team/epics/trusted-lists.md`
- Spec handoff: `/home/vcavallo/tl-weighted-certainty-spec-for-tapestry.md`
- ADR: `engineering-team/decisions/trusted-lists/0004-formalized-certainty-contract.md`
- Test plan: `engineering-team/stories/trusted-lists/4-weighted-member-certainty.test-plan.md`
- Review: (filled in after Review phase)
