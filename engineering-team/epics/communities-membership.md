# Epic: Communities — Membership & Trust (Block 5 + Block 3)

**Status:** Design-ahead (implementation BLOCKED on the `nostr-user-tag` core reaching `staging`)
**Created:** 2026-06-05
**Source:** PRD `product-team/prd/communities.md` §3/§7 + `stories-queue.md` Blocks 3 & 5; `docs/COMMUNITIES_PROTOCOL_DESIGN_HANDOFF.md` §3; David's correction (Community-claims-Tag, many-to-many).

## What this is
The membership layer (Block 5) and the trust signal that reads its roster (Block 3) — folded together because both ride the same per-viewer, GrapeRank-weighted roster engine. This is the "belonging earned by trust" payoff of the Communities product.

## Model (David's correction)
A community **claims** tags; the tag never points at the community. `nostr-user-tag` stays general and person-scoped (Vinney's primitive). A Community Declaration declares **which tag-label(s) it consumes** as its membership signal. Membership is **derived per viewer**: gather people carrying a claimed label → weight each asserter by GrapeRank from the viewer's PoV → net polarity → gate by an influence cutoff + threshold. Many-to-many: one community claims several tags; one tag feeds several communities.

## Dependencies
1. **`nostr-user-tag` core on `staging`** — the event kind/schema + read/WoT-score code (Vinney's `feat/pubkey-tagging-target`). **← the one remaining blocker.**
2. ~~What a tag's target/label references~~ — **RESOLVED (Vinney, 2026-06-05): a kind-39998 concept.** A CD `claims` one or more kind-39998 concept a-tags. ADR 0030 is now **Accepted** (design); only the merge remains.
3. The per-PoV WoT score lookup (function/endpoint) — build-time confirm, not a design blocker.

## Stories (`stories/communities-membership/`) — design-ahead
- **42 — CD claims membership tag(s)** (the CD declares which labels + threshold/cutoff). *Design-ahead.*
- **43 — membership assertion + vouch** (publish a self-tag / vouch via the nostr-user-tag primitive). *Blocked.*
- **44 — per-PoV roster engine** (the GrapeRank-weighted tally + cutoff/threshold → roster). *Blocked.*
- **45 — trust signal + applicant/member display** (Block 3: "N people you trust are inside" + per-member legibility + roles). *Blocked.*
- **46 — cold-start first vouch** (a path for a true outsider to earn vouch #1). *Blocked.*
- **47 — retire the interim posting gate** (swap `signedIn && joined` for trust-based membership). *Blocked.*

## ADR
`decisions/communities-membership/0030-membership-from-tags.md` — **Proposed** (pending dep #1 + open #2).
