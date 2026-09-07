# Epic: trusted-lists

**Created:** 2026-08-27
**Status:** Done — ladder complete; default-method flip to `certainty` is a deploy decision (book close item)

## Goal

**Make Trusted-List membership reflect *how much* the observer's web of trust stands behind each
member, not merely *how many* gate-passing asserters mentioned them — and publish that as a number
consumers can read without re-deriving trust math.**

Today a TL admits a member when enough asserters applied the tag and applies outnumber disputes,
with every asserter past the WoT floor counting as exactly 1. Ten barely-trusted taggers therefore
outweigh two highly-trusted ones, and downstream consumers (search, Vespa, other instances) see
only raw counts.

This epic realizes the acceptance frame of book
`engineering-team/audits/tl-weighted-certainty/book.md`. Direction originates from the
brainstorm_server decision record `engineering-team/decisions/trusted-lists/0001`, Amendment D12
(2026-08-27), implemented tapestry-first per the operator's instruction; the self-contained spec
handoff is `/home/vcavallo/tl-weighted-certainty-spec-for-tapestry.md`.

## Stories

Delivered as a **stepwise ladder** (operator direction, 2026-08-27): one rung per story, with
operator hand-validation between rungs. The membership method is a single pipeline-wide
selection on the Trust Determination Methods page.

- `stories/trusted-lists/1-tl-method-selector.md` — the selector itself, Count (current math)
  as the only available method; behavior unchanged, method recorded on published TLs.
- `stories/trusted-lists/2-input-agreement-method.md` — **Input & agreement**: publish
  per-member `input` (weighted sum Σ(rank/100) over all non-neutral taggings) and
  `agreement` (weighted apply/dispute vote ÷ input; 50/50 equal-rank → 0), hand-validatable
  against Meili ranks. Membership predicate and ordering stay count-based at this rung.
- `stories/trusted-lists/3-certainty-method.md` — **Certainty**: `agreement ×
  (1 − 0.5^input)` via the existing input→confidence function (rigor 0.5). The full spec
  formula's number, still under the count-based predicate.
- `stories/trusted-lists/4-weighted-member-certainty.md` — **Formalization** (Done, Light
  profile): integer scores, score>=1 predicate + score ordering, rigor tag on certainty TLs,
  membership-method tag stripped (operator: never spec'd), includeScoreInTL retired.
- ~~kind-10040 TL-provider line~~ — reassigned to David (external to this repo), 2026-08-27.
