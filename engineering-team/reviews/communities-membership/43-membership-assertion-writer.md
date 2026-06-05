# Review: Story 43 — membership-assertion writer

**Reviewer:** independent agent (separate context, adversarial; verified wire shape against the handoff doc, ADR 0030, and the reader).
**Date:** 2026-06-05
**Scope:** `ui-communities/src/events/assertion.js` (`buildTagElement`, `buildMembershipAssertion`, consts, `tagElementCoord`); tests `test/membership-assertion.test.js`.

## Quality gates
- `node test/test.js` — **PASS** (membership-assertion 10/10; full suite green).
- `eslint` (ui-communities) — clean.

## Verdict: PASS, no blocking issues.

The shipped builders are wire-faithful and reader-consistent on every load-bearing axis (independently verified):
- **Wire shape exact** vs the handoff table: kind 39999; tag-element `d=<bare slug>`, `z=39998:<LEG>:tag`, `content.tag`; assertion `p/e/a`, `z=39998:<LEG>:nostr-user-tag`, `polarity`, `content.nostrUserTag`.
- **LEG pubkey byte-correct** (`82b75e47…3833`), identical across source / handoff / ADR.
- **Polarity matches the reader exactly** — writer `polarity < 0 ? '-1' : '1'` ↔ reader `isApply = !(t.polarity < 0)`. No writer/reader disagreement; absent/0/positive → apply.
- **Re-vouch replaces correctly** — d-tag `profile-tag-<slug>-<target8>-<asserter8>` is deterministic (no time/nonce), so a re-vouch shares the `(author, d)` key and supersedes, matching the reader's `(asserter,target,concept)` dedup. Intentionally excludes the element version so a re-vouch against a drifted element still replaces (`a`=identity, `e`=provenance per ADR 0030).
- **Crypto policy clean** — pure builders, sign nothing; signing routes through `publishEvent → signEventViaNip07`. No hand-rolled crypto.
- **Community-agnostic** — no `claims`, no `t=brainstorm-community` on either event (T7 enforces). Honors David's invariant.

## Addressed on review feedback
- **N1 (false confidence):** the eval harness injected `LEGACY_Z_TAG_PUBKEY`, shadowing the source const — so byte-correctness of the security-critical ADR-0015 pubkey was only grep-checked. **Fixed:** added T9 (assert the *source* const directly) + T10 (assert the exported z-consts compose from it, and `tagElementCoord`'s formula). The unused-export concern (N2) is resolved by treating these as the *tested canonical constants* the live roster reader will import (centralizing the LEG pubkey so it's never re-typed).
- **N3 coverage gap:** added the `buildTagElement` missing-`viewerPubkey` throw to T8.

## Non-blocking (carried)
- The regex/`new Function` harness terminates a body at the first column-0 `}` — sound today, but a direct ESM import would be more robust. Latent test-infra debt across the suite, not specific to this story.
- AC#4 (peer/trust-framed copy) is genuinely out of this pure-builder file — deferred to the Story 45 display batch with the vouch/self-tag UI.

## Outcome
Story 43 writer **DONE**. Live publish wiring (the People-tab actions) ships with Story 45. Block 5 still cannot close — display (45), cold-start (46), gate retirement (47), and the live roster read all wait on the carve reaching `staging`. Book stays OPEN.
