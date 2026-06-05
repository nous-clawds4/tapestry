# Story 44: Derive the per-viewer roster (the membership engine)

**Status:** Design-ahead (BLOCKED on the nostr-user-tag core + WoT lookup)
**Type:** Feature · **Epic:** `communities-membership` · **ADR:** 0030.

## Background
The core of Block 5: turn claimed-label tags into a roster, **per viewer**, GrapeRank-weighted. Pure, testable, the engine both membership and the trust signal read.

## User-facing description
As any viewer, I want to see who actually belongs to a circle from my point of view, so that the roster reflects my web of trust, not an admin's list.

## Acceptance criteria
- [ ] `deriveRoster(circle, tags, wotScore, {cutoff, threshold})` returns, per viewer: members + applicants.
- [ ] For each candidate, score = Σ GrapeRank(viewer→asserter) × polarity, over asserters above the cutoff.
- [ ] Member iff score ≥ threshold; applicant iff self-tagged below threshold.
- [ ] An untrusted asserter's vouch/dispute carries ≈ 0 ("no veto").
- [ ] Pure function over fetched tags + an injected WoT scorer (testable without the network).

## Out of scope
Caching/perf. Display (Story 45). The WoT lookup *source* (injected; confirmed in Q#2).

## Linked artifacts
ADR 0030; BLOCKED on the nostr-user-tag reader + the WoT lookup (Q#2).
