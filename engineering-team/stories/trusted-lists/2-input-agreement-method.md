# Story 2: Weighted-sum membership method (rung 2)

**Status:** Approved
**Created:** 2026-08-27
**Type:** Feature

## Background

Rung 2 of the `tl-weighted-certainty` ladder (book
`engineering-team/audits/tl-weighted-certainty/book.md`; spec handoff
`/home/vcavallo/tl-weighted-certainty-spec-for-tapestry.md`). Story 1 delivered the
pipeline-wide method selector with only Count available; the operator has hand-validated it.
This story makes **Weighted sum** the first weighted method. Every rung publishes **one
score per member** — the same slot, the same meaning, converging on the final contract
(operator direction 2026-08-27: one evolving "score-ish" number, not a decomposition):

- **Rung 2 (this story):** score = Σ(weight × rating) — each non-neutral tagger's trust
  weight (their 0–100 WoT rank in the observer's POV ÷ 100), signed by their vote: applies
  add, disputes subtract. Disagreement is inherent: an equal-weight 50/50 split nets to 0.
- **Rung 3:** score = the full formula — the same sum reshaped as (Σ(w×r) ÷ Σw) ×
  (1 − 0.5^Σw), i.e. agreement × certainty. Full precision.
- **Rung 4:** the same number formalized: ×100, rounded, integer, `score ≥ 1` predicate.

The purpose of stopping at rung 2 is validation: prove the weight-reading and the signed fold
are right before certainty stacks on top. Therefore this rung **changes what is published,
not who is a member**: the membership predicate and ordering stay count-based, per the ladder
plan recorded in Story 1.

## User-facing description

As the operator, I want to switch the pipeline to "Weighted sum" and see each TL member's
score — the trust-weighted applies-minus-disputes sum — on the published list, so that I can
verify the weighted math by hand against the taggers' known ranks before any deeper formula
is built on it.

## Acceptance criteria

Notation: a tagger's weight w = their `wot_rank` in the observer's POV ÷ 100; ratings are
+1 (apply) / −1 (dispute); taggings with an explicit polarity strictly inside (−0.5, 0.5) are
excluded and absent polarity counts as apply — identical bucketing to today.

- [ ] **Method becomes selectable.** On the Trust Determination Methods page, the rung-2
      method (labeled "Weighted sum", id `input`) is enabled; Certainty and Score remain
      disabled. Selecting it persists pipeline-wide exactly as Story 1's selection does.
      The option's label/blurb are updated to describe the single-number semantics.
- [ ] **The wire records it.** With the method selected, the next refresh publishes TLs
      carrying `["membership-method", "input"]`.
- [ ] **One score per member, on the TL itself.** Each member's `p` tag carries the score in
      the existing reserved slot — `["p", <pubkey>, "", <score>]` — and the content JSON
      entry gains the same `score` alongside the existing endorsements/disputes counts.
      Unrounded (full precision) at this rung; not yet the 0–100 integer contract (rung 4).
      Same slot every rung; only the formula behind it evolves.
- [ ] **Known-value checks.** With the WoT gate passing and ranks seeded:
      - one apply from a rank-100 tagger → score 1.0;
      - applies from ten rank-3 taggers → score 0.3;
      - applies from two rank-90 taggers → score 1.8 (weighting beats counting: fewer,
        stronger taggers outscore the rank-3 crowd);
      - an apply from rank 80 plus a dispute from rank 40 → score 0.4;
      - equal-rank apply + dispute (50/50) → score 0.
- [ ] **Membership and ordering unchanged.** For identical inputs, the member set and member
      order are identical to Count's (predicate `applies ≥ cutoff AND applies > disputes`;
      order endorsements desc, pubkey asc). Only the content-JSON numbers and the
      membership-method tag differ.
- [ ] **Counts keep their meaning.** Raw endorsements/disputes counts publish unchanged.
- [ ] **No-POV fallback.** When the observer's POV is unresolvable (no rank columns to read),
      the refresh still succeeds and that TL publishes as Count — recording
      `["membership-method", "count"]` (the math that actually ran) with no scores. No error,
      no empty TL.
- [ ] **Count still works.** Switching back to Count restores Story-1 output exactly.
- [ ] **Operator validation kit — zero authoring for the operator.** One command seeds the
      entire known-value fixture on the local stack: the ephemeral npubs, their WoT ranks in
      the observer's POV, one tag per known-value scenario, the taggings (applies/disputes),
      and the pins — then triggers the refresh and prints each resulting TL's per-member
      numbers next to the expected values. The operator's whole job is reading that output
      (and, if they want, re-inspecting the published events by hand). Re-runnable; seeds are
      clearly named as test fixtures; local relay only.
- [ ] **Local-only publishing.** All events produced while building and verifying this story
      go to the local dev relay only.

## Concepts touched

Same surfaces as Story 1 (handles verified there): **nostr-user-tag** taggings and
**tag-pinning** pins (read-only), **Trusted List** events (content JSON gains per-member
weighted fields when this method is active), the per-POV WoT rank surface (read-only), and
the Trust Determination Methods selector (one option flips to enabled).

## Out of scope

- Certainty (rung 3) and the formalized 0–100 score contract, `score ≥ 1` predicate,
  score-ordering, `rigor` metadata (rung 4).
- Any change to membership predicate or ordering — explicitly deferred to rung 4.
- Restoring the strict p-tag contract — deliberately bent this rung (see AC above); rung 4
  settles the final wire shape and cleans up.
- Changes to WoT rank computation, polarity bucketing, retraction, d-tags, signing.

## Open questions

- None. (The no-POV fallback semantics above are the PO's call: record what actually ran.
  If the Architect finds a cleaner degrade, flag it at the gate.)

## Linked artifacts

- Book: `engineering-team/audits/tl-weighted-certainty/book.md`
- Epic: `engineering-team/epics/trusted-lists.md`
- Spec handoff: `/home/vcavallo/tl-weighted-certainty-spec-for-tapestry.md`
- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
