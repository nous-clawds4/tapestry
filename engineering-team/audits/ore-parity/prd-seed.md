# PRD Seed: Brainstorm as a first-class Open-Ranking provider

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/ore-parity/audit.md`
**Anchor:** acceptance frame in `book.md`
**Confidence:** high
**Date:** 2026-08-16

> This is a **reverse-engineered baseline** in the product-team PRD shape, built from what
> shipped. It is a *strawman for the product team*, not a ratified spec. Every section is tagged
> — `[FROM FRAME]`, `[INFERRED]`, or `[UNKNOWN — product input needed]`.

## 1. Product vision
`[FROM FRAME]` The R&D Brainstorm instances are **interchangeable Open-Ranking providers**: any
ORE client — npub.world being the reference — can select `staging.brainstorm.world` or
`tapestry.brainstorm.world` as its ranking provider and have validation succeed and every
required capability work, exactly as it does with the NosFabrica instances. `[INFERRED]` The
underlying opportunity: ORE is the interoperable HTTP face of Brainstorm's web of trust — the
channel through which non-nostr-native clients consume GrapeRank — so provider-surface
completeness is distribution, not just conformance.

## 2. Personas
`[INFERRED]` from story "As a…" lines and the frame:
- **The provider-switching end user** — an npub.world (or similar client) user who picks their
  ranking provider in Settings and expects Validate to go green.
- **The third-party client developer** — integrates the `open-ranking` SDK; needs the mandatory
  endpoints, honest capability advertisement, and predictable error conventions.
- **The instance operator (wds4)** — runs R&D instances and needs them representable in the
  ecosystem at parity with the NosFabrica production line. `[UNKNOWN]` whether other operators
  deploying this codebase are an audience for provider-surface guarantees.

## 3. Scope (as-built)
`[FROM FRAME]` ORE-03 batch rank (mandatory) + ORE-06 followers + ORE-07 muters, global
algorithms only, registered in the ORE-01 capability document; npub.world validates both
instances. `[INFERRED]` supporting scope that shipped with it: the SDK-backed conformance test
(the real validator runs on every `npm test`), house conventions extended to the new endpoints
(integer ×100 ranks, no `ttl`, no-404 honest-empty answers, `X-Reason` errors), live
verified-set `total`s, and full developer documentation (BIBLE §28 + `/developers/open-ranking`).

**Explicitly out (still):** `pov: true` personalized variants (W12 auth gate — the sole remaining
surface gap vs NosFabrica), ORE-04 `/recommend/pubkeys`, ORE-08 `/compromised/pubkeys`, ORE-A
auth, `202`/`Retry-After` async answers.

## 4. Domain model
`[INFERRED]` from the as-built system (no concept-graph changes):
- **Rank** — `round(GrapeRank influence × 100)` under the instance's owner-baseline (global)
  point of view; one scale across all five endpoints.
- **Verified inbound set** — followers/muters whose own influence clears the per-edge cutoff
  (`VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF` / `VERIFIED_MUTERS_INFLUENCE_CUTOFF`); the same line
  the profile surfaces and kind-30382 counts use. Its live cardinality (`total`) may drift from
  the batch-written counts between recomputes — an accepted, documented property.
- **Capability document** — the single registry-driven advertisement; an endpoint exists in it
  iff the instance serves it (the honesty rule).

## 5. Design rules (as-built)
`[INFERRED]`, consistently applied and now documented:
- Never advertise what isn't served; never serve another POV's answer under the caller's label.
- House scale over sibling mimicry where the spec leaves freedom (integer ranks; verified sets;
  no `ttl`; unknown targets get honest-empty 200s, never 404).
- Every response carries `ACAO: *` + JSON; errors are status + human-readable `X-Reason`.
- Bounded cost by construction: batch caps, limit maxima, one-or-two parameterized statements
  per request under the per-query deadline.

## 6. Carry-forward & open questions
Promoted from audit §6: W12 auth for personalized variants (the remaining parity gap); W13
personalized search; ORE-04/08 (unplanned; npub.world lists both as optional); ORE-02 404-row
alignment (OPEN.md 179); `runCypher` integer-param doc note (178); cutoff-config guard (180);
upstream PR [Open-Ranking/protocol#9](https://github.com/Open-Ranking/protocol/pull/9) watch.

## 7. What product must validate
- [ ] `[UNKNOWN]` Is unlocking `pov: true` personalization (the W12 auth work) the next
      increment of provider value, or is global-only sufficient for the audiences that matter?
- [ ] `[UNKNOWN]` Does any real client want ORE-04 `/recommend/pubkeys` (npub.world shows the
      row; nobody serves it in this ecosystem yet) — is there first-mover value?
- [ ] `[INFERRED]` The verified-set reading of followers/muters (smaller, curated totals vs
      NosFabrica's full-index totals) — confirm this is the product stance when clients display
      "N followers" side-by-side across providers.
- [ ] `[INFERRED]` Whether provider-surface guarantees should extend to *all* deployments of
      this codebase (e.g., tags.brainstorm.world) or remain per-instance operator choices.
