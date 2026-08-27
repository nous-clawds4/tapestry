# Epic: trusted-lists

**Created:** 2026-08-27
**Status:** Open

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

- `stories/trusted-lists/1-weighted-member-certainty.md` — replace count-based membership with
  GrapeRank single-hop weighting and publish per-member certainty scores.
