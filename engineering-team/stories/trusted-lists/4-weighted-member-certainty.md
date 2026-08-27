# Story 4: Weighted member certainty for Trusted-List membership (full formula)

**Status:** Draft — re-approve when rungs 1–3 are operator-validated
**Created:** 2026-08-27
**Type:** Feature

> **Restructured 2026-08-27 (Planning):** originally approved as Story 1 (a direct swap of the
> membership math), then re-sequenced by the operator into a stepwise ladder — Story 1: method
> selector (Count only); Story 2: Input (weighted sum); Story 3: Certainty; this story: the
> full `certainty × agreement` formula, where disputes discount and a 50/50 equal-rank split
> scores 0 and drops off the list. The ACs below describe that end state and now apply *as the
> fourth selectable method* under the pipeline-wide selector rather than as an unconditional
> replacement of Count.

## Background

Trusted-List membership is count-based today: a target joins the TL when at least `cutoff`
gate-passing asserters applied the tag and applies outnumber disputes, with every asserter past
the WoT floor counting as exactly 1. That makes ten barely-trusted taggers (rank 3) outweigh two
highly-trusted ones (rank 90) — the opposite of what an observer's web of trust means. And the
published TL exposes only raw counts, so any consumer that wants a trust-aware read (search
ranking, other instances) must re-derive the math itself.

The direction comes from the brainstorm_server decision record
`engineering-team/decisions/trusted-lists/0001`, Amendment D12 (2026-08-27), operator-redirected
to be implemented tapestry-first. The self-contained spec handoff — the normative statement of
the intended math, units, and wire behavior — is
`/home/vcavallo/tl-weighted-certainty-spec-for-tapestry.md`. This story treats that spec's
behavioral contract as its requirement; anything the spec leaves open is listed under Open
questions.

Affected: every consumer of published TLs for the `nostr-user-tag` pin pipeline, and any
downstream reader of TL events (kinds 30392–30395).

## User-facing description

As an observer whose pinned tag produces a Trusted List, I want membership and ordering to be
weighted by how much *my* web of trust stands behind each asserter — and I want each member
published with a certainty score — so that a couple of voices I strongly trust count for more
than a crowd I barely trust, and so that consumers of my TL can read the trust level directly
instead of recomputing it.

## Acceptance criteria

All criteria are observable from the published TL event and/or the refresh pipeline's output.
"Score" below means the spec's number: per-tagging rating `+1` (apply) / `−1` (dispute), weight
= asserter's POV influence on the unit interval (their 0–100 WoT rank ÷ 100), `average` =
Σ(w×r)/Σw (0 when Σw = 0), `certainty` = 1 − rigor^Σw with rigor 0.5, `score` =
round(max(average × certainty, 0) × 100), an integer 0–100.

- [ ] **Weighting beats counting.** Given one tag with ten distinct applying asserters of WoT
      rank 3 on target A, and two distinct applying asserters of rank 90 on target B (all above
      the WoT floor, no disputes), when the TL is refreshed, then B's published score is higher
      than A's and B is ordered above A.
- [ ] **Score on the wire, no shape change.** Given a TL refresh producing members, then each
      member's `p` tag carries the integer score as a string in the tag's existing reserved
      third position (with an empty relay placeholder when no relay is present), the same score
      appears in the event's content JSON alongside the existing endorsement/dispute counts, and
      the event validates against the existing TL shape (no new tag positions invented).
- [ ] **Reproducibility metadata.** Given any published TL from this pipeline, then it carries a
      `["rigor", "0.5"]` tag alongside the existing `cutoff`/`min-rank` metadata, and a consumer
      applying the spec formula to the live taggings and published parameters reproduces each
      member's score exactly.
- [ ] **Units.** Internal math on [0, 1]; wire values are ×100, rounded, integer strings —
      an asserter set whose combined math yields 1.0 publishes as `"100"`, 0.5 as `"50"`,
      0.375 as `"38"`.
- [ ] **Known-value check.** Given exactly one applying asserter of rank 100 and no disputes,
      when the TL refreshes, then that member's published score is `50` (certainty 1 − 0.5¹ = 0.5,
      average 1).
- [ ] **Membership predicate v2.** A target is a member iff `applications ≥ cutoff` AND
      `score ≥ 1`. Given a target whose disputes outweigh its applies (net-negative average) or
      whose total asserter weight is negligible (score rounds to 0), then it does not appear in
      the TL even if raw applies exceed cutoff.
- [ ] **Ordering.** Members are ordered score descending, then pubkey ascending; two refreshes
      over identical inputs publish identically ordered lists.
- [ ] **Polarity handling unchanged.** A tagging with no polarity value counts as an apply (+1);
      polarity ≥ 0.5 counts as apply; ≤ −0.5 counts as dispute; an explicit value strictly
      inside (−0.5, 0.5) is excluded from both the fold and the counts — same bucketing as today.
- [ ] **The WoT floor stays.** Given an asserter below the active POV's `minRank` (inclusive
      floor unchanged), then their tagging contributes nothing — no weight, no count — exactly
      as today. Weighting supplements the gate; it does not replace it.
- [ ] **Counts keep their meaning.** The published endorsement/dispute counts remain the raw
      per-asserter counts (unweighted), unchanged from today's values for the same inputs.
- [ ] **Everything else untouched.** Retraction publishes, d-tag computation, replaceable
      dedupe, POV resolution, and TA signing behave identically to before for the same inputs.
- [ ] **Local-only publishing.** All events produced while building and verifying this story go
      to the local dev relay only (standing project rule for tag-stack work).

## Concepts touched

Concept Graph API was not reachable at planning time (strfry answering on the panel port) — the
Architect should resolve handles at orientation. Plain-language list:

- **nostr-user-tag** taggings (kind 39999) — the assertions being weighted (read-only here).
- **tag-pinning** pins (kind 39999) — the trigger for TL refresh (read-only here).
- **Trusted List** events (kinds 30392–30395) — the published output whose membership math and
  member annotations this story changes.
- The per-POV WoT rank surface (Meilisearch `wot_rank_<povSuffix>`) — the source of asserter
  weight (read-only here).

## Out of scope

- Making `rigor` tunable — it is a published constant (0.5) in this story.
- Changing the WoT floor value or semantics, or replacing the gate with weighting.
- Any change to how WoT ranks are computed (GrapeRank pipeline untouched — this story only
  *reads* ranks).
- Trust propagation *through the tag graph itself* (e.g., weighting an asserter up because
  trusted people tagged them as a good tagger, or feeding tag-derived scores back into
  influence iteratively). Note the asserter weights are already the output of the full
  multi-hop GrapeRank computation over the follow graph — this story applies one
  interpretation step on top of those weights and adds no further propagation.
- Consumer-side changes (search/Vespa reading the score) — separate work, likely not in this repo.
- Re-deriving or migrating historical TLs — scores appear on the next refresh naturally.
- Publishing beyond the local dev relay, and any brainstorm_server-side implementation.

## Open questions

- **`membership-method` tag: spec it or strip it before deploy.** Story 1 added a
  `['membership-method', <id>]` tag to published TLs for ladder-testing visibility. It is not
  part of the brainstorm_server spec handoff and appears in no protocol spec. Operator
  direction (2026-08-27): keep during the ladder; decide at this story — either write it into
  the rung-4 wire contract (protocols entry) or remove it from the emit path before anything
  deploys beyond local.

- ~~**D12 finality.**~~ Resolved 2026-08-27: the operator confirmed the source decision record
  is **Approved**, no longer Proposed. Wire details in the spec handoff are final.
- ~~**Score emission: default or flag?**~~ Resolved 2026-08-27 at the Planning gate: the
  operator chose **always on** for this pipeline — every TL this pipeline publishes carries
  per-member scores, no opt-in switch.
- **Reusing the existing certainty function.** The spec requires reusing the estate's existing
  input→confidence conversion rather than a second implementation; *how* it is shared is the
  Architect's call.

## Linked artifacts

- Book: `engineering-team/audits/tl-weighted-certainty/book.md`
- Epic: `engineering-team/epics/trusted-lists.md`
- Spec handoff: `/home/vcavallo/tl-weighted-certainty-spec-for-tapestry.md`
- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
