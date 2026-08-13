# Epic: ORE POV Availability

**Status:** Active (opened 2026-08-12)
**Book:** `engineering-team/audits/ore-pov-availability/book.md` (acceptance-frame, standard gated mode)
**Provenance:** Operator request 2026-08-12 — adopt [Open-Ranking/protocol#8](https://github.com/Open-Ranking/protocol/issues/8) "Solution 1" (error on unavailable POV). Realizes the carry-forward named in `audits/open-ranking/prd-seed.md` §6/§7 ("Standards stance (W12)") and ADR `open-ranking/0005`'s out-of-scope item ("the upstream question of proposing a standard POV-availability mechanism to ORE"). Successor to the retired `epics/open-ranking.md`.

## What this is

When a client requests personalized scores for a point of view the provider cannot serve, the provider must refuse explicitly — never silently substitute the house/global view under the caller's label. Upstream, the Open Ranking spec is silent on this case; the maintainer endorsed error-on-unavailable in issue #8. Tapestry's ORE surface already errors (the POV invariant, worksheet W12), but the contract is not yet normative upstream, not asserted as a *never-substitute* invariant by our tests, and only tersely documented. This epic:

1. drafts the upstream ORE-01 proposal (spec text + PR description) for the author to submit as **wds4**;
2. aligns tapestry's error semantics with the proposed language, with informative `X-Reason` guidance;
3. documents the contract on `/developers/open-ranking`;
4. records proposal status in worksheet **W12**.

## Stories

`stories/ore-pov-availability/`:
1. **pov-unavailable-error-and-upstream-proposal** — the whole bounded ask (single-story book unless review splits it).

## Out of scope (whole epic)

- W12 auth proper (ORE-A/NWT or self-only) and enabling `openRanking.personalizedStats` in production.
- Personalized search (retired open-ranking epic's Story 3 / worksheet W13).
- The internal search proxy's `povResolution` disclosure (operator-confirmed out, 2026-08-12 — right mechanism at that layer).
- A machine-readable reason-code taxonomy as normative spec text (may appear in the PR description as an open question only).
- Submitting the upstream PR (the author's act — wds4 does it manually).
- The NosFabrica codebase (adopts this behavior later, in its own effort, if we like the result here).
