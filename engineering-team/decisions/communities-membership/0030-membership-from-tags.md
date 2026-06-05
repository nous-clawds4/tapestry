# ADR 0030: Community membership = claimed tags, trust-weighted per viewer

**Status:** Accepted (design ratified 2026-06-05; **Open Question #1 resolved by Vinney — a tag's target is a kind-39998 concept**). **Implementation still blocked** on the one remaining dependency: the `nostr-user-tag` core reaching `staging`. The remaining open items (Q2 WoT lookup, Q3 cold-start, Q4 threshold) are build-time choices, not design blockers.
**Date:** 2026-06-05
**Story:** epic `communities-membership` (Block 5 + Block 3)
**Builds on:** `docs/COMMUNITIES_PROTOCOL_DESIGN_HANDOFF.md` §3 (membership design); **David's correction** (Community-claims-Tag, many-to-many — supersedes the handoff's `['e', community]` framing); ADR 0029 (Community Declaration); BIBLE §26 (resolved definition — the CD's `claims` field resolves through inheritance like any other field).

## Context
Communities needs membership: *who belongs to a circle.* The "right way" makes belonging **earned through trust**, not granted by an admin. The atom is the existing **`nostr-user-tag`** primitive (Vinney's branch) — a general, person-scoped assertion ("asserter tags pubkey P with label L, polarity ±1"). 

**The correction (David):** the **Community claims the Tag**, not the reverse. The tag must stay general and community-agnostic; a Community Declaration declares **which label(s) it consumes** as its membership signal. This is many-to-many (one community claims several tags; one tag feeds several communities) and avoids baking a community pointer into the tag.

## Options considered

### Option A — CD claims tag-label(s); roster derived per-viewer, GrapeRank-weighted (chosen)
A Community Declaration carries a **`claims`** declaration: the tag-label(s) (shared concept references) that count as membership, plus a **threshold** and an **influence cutoff** preset. Membership is **not stored** — it is **derived per viewer**:
- **Candidates** = pubkeys carrying any claimed label.
- For each candidate `C`, from viewer `V`'s PoV:
  `score(C) = Σ over asserters A of [ GrapeRank(V → A) × polarity(A's tag on C) ]`, counting only asserters with influence ≥ the cutoff.
- `C` is a **member** if `score(C) ≥ threshold`; an **applicant** if self-tagged (`A == C`) but below threshold.
- **"No veto" falls out:** a `−1` from an untrusted asserter contributes ≈ 0.

**Pros:** consumes the existing general primitive unchanged; no community coupling on the tag; many-to-many; emergent, per-PoV, capture-resistant (matches the founding tenet). The trust signal (Block 3) is the *same* scoring, presented.
**Cons:** every roster read is a per-viewer computation over tags + WoT (perf/caching concern, deferred); depends on a WoT score-lookup whose shape must be confirmed.

### Option B — Tag carries a community pointer (`['e', community]`) (rejected)
The handoff's original framing.
**Why rejected:** David's correction — it forces a 1:1 tag↔community coupling, makes tags community-specific, and prevents one tag feeding many communities. The tag should be general.

### Option C — Stored membership list maintained by the founder (rejected)
An admin-curated roster.
**Why rejected:** reintroduces the privileged center the whole product rejects. Membership must be emergent and per-viewer.

## Decision
Adopt **Option A.** Membership = trust-weighted tally of claimed-label tags, per viewer, gated by cutoff + threshold. Roles: **applicant** (self-tagged, below threshold) / **member** (cleared threshold). **Admin off in v1.** The CD's `claims` field resolves through `b`-inheritance (§26) like any other definitional field, so a fork inherits its parent's membership rule unless it overrides.

The **trust signal (Block 3)** is a read of the same engine: "N people you trust are inside" = members whose qualifying support comes from asserters the viewer trusts; per-member legibility = each member's score sign/strength from the viewer's PoV; impersonators carry ≈ 0.

## Consequences
- **Positive:** powerless, forkable, per-PoV membership on a general primitive; Block 3 + Block 5 share one engine; no tag changes required of Vinney.
- **Negative/risk:** per-read computation cost (caching deferred); correctness depends on the WoT lookup + the cold-start answer; first-listed/diamond resolver fences (from the Blocks 1/2/4 review) must be cleared before the CD's `claims` field inherits through multi-parent.
- **Neutral:** existing bespoke endorsement members do **not** auto-convert (different primitive) — documented, no migration.

## Resolved
1. **What a tag's target/label references** → **RESOLVED (Vinney, 2026-06-05): a kind-39998 concept.** A `nostr-user-tag` attaches a person to a kind-39998 concept (a general label). A Community Declaration's **`claims`** field is therefore **one or more kind-39998 concept a-tags** (`39998:<pubkey>:<slug>`). Many-to-many: a concept can be claimed by many circles; a circle can claim several concepts. Stays decoupled per David — the tag targets a *label* concept, never the community.
5. **How the CD encodes `claims`** → **RESOLVED: a list of kind-39998 concept a-tag(s)** (follows from #1).

## Open (build-time choices, not design blockers)
2. **The per-PoV WoT score lookup** — the function/endpoint for `GrapeRank(V → A)` and the influence cutoff (the branch's `wotScore.js` / namespaced meili `wot_<metric>_<suffix>`). Confirm when the core lands.
3. **Cold-start first vouch** — founder-granted initial vouches vs time-bounded provisional standing vs invite-carries-a-vouch (Story 46).
4. **Threshold default** — 1 vouch vs N ≥ 2 (a "safe space" wants ≥ 2).

## Out of scope / deferred
- **All code** — blocked on the dependency; this is design-ahead only.
- Roster caching/perf. Admin roles. Reply-thread gating. The bespoke→CD membership migration.

## Implementation notes (for when unblocked)
- New `lib/membership.js`: `deriveRoster(circle, tags, wotScore, { cutoff, threshold })` (pure, given fetched tags + a WoT scorer) + a fetch of claimed-label tags.
- `Found.jsx`: the CD `claims` field in founding/fork (resolves via §26).
- `CommunityDetail`: People tab renders the derived roster (applicant/member) + the trust signal; composer gate swaps to membership (Story 47).
- Consume Vinney's `nostr-user-tag` reader + `wotScore` once on staging.
