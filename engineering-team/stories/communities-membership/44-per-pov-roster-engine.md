# Story 44: Derive the per-viewer roster (the membership engine)

**Status:** DONE (engine built + independently reviewed, 2026-06-05). The live wire-in (real tag reader + WoT scorer) stays BLOCKED on the nostr-user-tag core, but the pure engine is complete with its inputs injected — it does not change when the source lands.
**Type:** Feature · **Epic:** `communities-membership` · **ADR:** 0030.

## Background
The core of Block 5: turn claimed-label tags into a roster, **per viewer**, GrapeRank-weighted. Pure, testable, the engine both membership and the trust signal read.

## User-facing description
As any viewer, I want to see who actually belongs to a circle from my point of view, so that the roster reflects my web of trust, not an admin's list.

## Acceptance criteria
- [x] `deriveRoster(circle, tags, wotScore, {cutoff, threshold})` returns, per viewer: members + applicants.
- [x] For each candidate, score = Σ GrapeRank(viewer→asserter) × polarity, over asserters above the cutoff.
- [x] Member iff score ≥ threshold; applicant iff self-tagged below threshold.
- [x] An untrusted asserter's vouch/dispute carries ≈ 0 ("no veto").
- [x] Pure function over fetched tags + an injected WoT scorer (testable without the network).

## Out of scope
Caching/perf. Display (Story 45). The WoT lookup *source* (injected; confirmed in Q#2).

## Build notes (2026-06-05)
- `ui-communities/src/lib/membership.js` — `deriveRoster(...)`, pure. Tests: `test/roster-engine.test.js` (8/8). Trust-bar defaults (cutoff 0.5 / threshold 1) live here as the single source of truth (`== null` coalesce, so `0` is a real value).
- Independent review: **PASS, no blocking issues.** Two pre-wire traps hardened on review feedback: (a) a re-vouch from the same asserter now supersedes instead of stacking — last-writer-wins per `asserter|target|concept`; (b) an absent polarity counts as a vouch (+1), never a silent downvote.

## Linked artifacts
ADR 0030; live wire-in BLOCKED on the nostr-user-tag reader + the WoT lookup (Q#2).
