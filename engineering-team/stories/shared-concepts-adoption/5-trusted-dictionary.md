# Story 5: Trusted dictionary — S3b with a trusted-usage threshold

**Status:** Approved
**Created:** 2026-08-07
**Type:** Feature
**Epic:** `shared-concepts-adoption`
**Book:** `shared-concepts-adoption` (F3)

## Background

The owner's taxonomy (intake 2026-08-05): *"I can use this to create a 'dictionary' of concepts:
concepts that are in S3b, perhaps with added qualifications, such as needs to be used by some
minimum threshold number of trusted users"* — toward the stated goal of *"an ever-growing
community dictionary."* S3b = concepts z-used by people in the owner's trust network, with the
cross-author rule applying throughout: a carrier signed by the header's own author is internal
filing, never usage (the PR #494 rule F1/F2 already encode).

Scoring semantics ratified at `/discuss` (owner decisions, 2026-08-07):

- **Trusted = the product's existing notion.** A qualifying author is one whose GrapeRank
  influence from the active POV clears the same cutoff the verified-followers/muters/reporters
  family already uses. One notion of "trusted" across the product; no dictionary-specific scoring
  formula.
- **The threshold counts distinct trusted authors, each once.** Binary trust gate, plain count —
  not an influence-weighted sum. The instance's own usage never counts toward the threshold
  (self-evidence isn't community evidence — F2's rule).
- **Live view + deliberate snapshot.** Membership is computed at read time from the active POV;
  nothing persists from viewing. The dated artifact exists only when the owner acts: an
  owner-triggered publication mints a dated, attributed, TA-signed snapshot with its parameters
  embedded. No timer, no auto-publication — the book's proposal-loop DNA (the system computes,
  the owner ratifies).

Boundary (book frame + community-reference ADR 0029): this is a **usage-derived aggregate,
explicitly NOT the W1 inherit-consensus signal** — consensus counts inherit-typed b-edges only;
z-usage and pointers carry zero weight there. The dictionary must not read as, feed, or
manufacture consensus.

**Who is affected:** the owner (curates and offers the dictionary); logged-in visitors (read the
dictionary from their own POV where available); the community dictionary this feeds; downstream
consumers of published snapshots.

## User-facing description

As **the owner**, I want a live view of the concepts my trust network genuinely uses — those used
by at least a threshold number of trusted people — and a one-click way to publish that view as a
dated snapshot, so that **the community dictionary grows from real, trusted usage rather than
from any single person's say-so.**

## Acceptance criteria

- [ ] **Membership:** given the active POV, the dictionary lists exactly the concept headers with
      z-usage by **≥ N distinct qualifying authors**, where qualifying = (a) influence above the
      established verified cutoff from that POV, (b) not the header's own author, (c) not this
      instance's TA. Headers with fewer qualifying users do not appear. Default N = 2; N is
      instance-configurable.
- [ ] **Evidence:** each entry shows its qualifying-author count (and its total cross-author
      usage for context), sorted by qualifying-author count descending.
- [ ] **POV:** with no POV selected, the house POV applies; with a personalized POV selected and
      available, that POV's scores apply; unavailable → house fallback (the verified-followers
      pattern). Switching POV changes membership at read time — no reindex, no migration.
- [ ] **Read-computed:** viewing stores nothing. A new qualifying carrier (or a score change) is
      reflected on the next read with no republish/recompute step. The view is a public read
      surface under the Shared Concepts area, distinct from the adoption worklist.
- [ ] **Snapshot:** an owner-gated action publishes a dated, TA-signed snapshot carrying the
      member concept coordinates and the parameters that produced them (POV identifier, cutoff,
      N, computed-at), self-describing as usage-derived. Nothing is published without this
      explicit act.
- [ ] **Snapshot hygiene:** headers under the F5 keep-private sentinel never ride into a
      snapshot, even when their usage qualifies. F1-declined concepts remain in the computed view
      and in snapshots (decline governs adoption, not the observability of usage).
- [ ] **Consensus firewall:** the feature creates no b-tags and alters no inherit-consensus
      input; the snapshot's self-description marks it usage-derived (ADR 0029's zero-weight line
      holds).

## Concepts touched

`39998:<TA>:shared-concept` (members are shared-concept headers), `39998:<TA>:concept-header`
(the S3b population), `39998:<TA>:graperank` (scoring source — referenced, not changed),
`39998:<TA>:adoption-disposition` (F1's decline ledger — read for the hygiene rule, never
written). The Architect re-checks whether the snapshot warrants a runtime-created concept (the
`adoption disposition` proposal-loop precedent) — runtime-created either way; **no firmware
reinstall expected**.

## Out of scope

- Influence-weighted membership or any graded scoring (binary gate + plain count is the v1
  semantics; revisit only with evidence).
- A dictionary-specific cutoff knob (reuses the verified cutoff).
- Per-member curation UI at publish time (the v1 snapshot = the computed view minus the sentinel
  exclusions).
- Consuming other instances' snapshots (cross-instance dictionary reads — a future trajectory).
- Any b-tag creation, W1 registry mechanics, or the W11 / community-reference ADR 0033 cloud
  machinery.
- Auto/timer publication of snapshots.

## Open questions

- Default N: drafted as 2 ("more than one trusted person uses this"); confirmed at the approval
  gate 2026-08-07 (owner approved the draft as written).
- (For the Architect, not blocking approval:) the snapshot artifact's concrete home and whether
  it mints a runtime concept.

## Linked artifacts
- ADR: `engineering-team/decisions/shared-concepts-adoption/0005-trusted-dictionary.md`
- Test plan: `engineering-team/stories/shared-concepts-adoption/5-trusted-dictionary.test-plan.md`
- Review: (filled in after Review phase)
