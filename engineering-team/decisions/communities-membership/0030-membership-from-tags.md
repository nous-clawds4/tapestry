# ADR 0030: Community membership = claimed tags, trust-weighted per viewer

**Status:** Accepted (design ratified 2026-06-05). **Two updates 2026-06-05 (PM) from Vinney's wire-shape + integration message:**
1. **Claim coord corrected — a community claims a kind-39999 tag-ELEMENT, not a 39998 concept** (see "Wire shape" below). This supersedes the earlier §Resolved-#1 reading ("a kind-39998 concept"), which conflated the tag-element with the assertion's `z` type-header `39998:<TA>:nostr-user-tag`. ⚠️ *Pending Vinney's one-line confirm; the engine is coord-agnostic so only the builder default + ADR text change.*
2. **Open Q2 (WoT lookup) RESOLVED** and the **production roster path decided** (consume the server aggregation) — see below.
**Implementation still blocked** on the one remaining dependency: the `nostr-user-tag` core reaching `staging` (carve-out planned). Q3 cold-start / Q4 threshold remain build-time choices.
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

## Wire shape (Vinney, ADR-0022 on the nostr-user-tag side — hybrid `e` + `a`)
A `nostr-user-tag` **assertion** is a kind-39999 event:
```
["p", "<targetPubkey>"]                   the person being tagged
["a", "39999:<tagAuthorPubkey>:<slug>"]   the tag-ELEMENT applied — STABLE identity  ← claim/scan this
["e", "<tagEventId>"]                      the element version at apply-time — provenance only
["z", "39998:<TA>:nostr-user-tag"]         assertion type-header (same for ALL tags)
["polarity", "1" | "-1"]                   apply / dispute
```
- **A community claims tag-ELEMENT coords** `39999:<tagAuthor>:<slug>` (single-char `#a`, fully relay-filterable). The roster scan filters assertions by `#a` ∈ the claimed coords. The `39998` in `z` is the *type* concept (every nostr-user-tag carries it) — claiming it would mean claiming all tags, so it is **not** what `claims` holds.
- **Default for a new circle:** founding auto-claims its own tag-element `39999:<founder>:<slug>` ("tagged into this circle"). Forks inherit via §26.
- **`e` = provenance, not identity.** Because both are kept, a membership read can detect **tag-definition drift** (live `a`-resolved element vs the frozen `e` version a voucher signed against) — a tag author can otherwise mutate a tag's meaning under existing assertions. Drift handling is a live-wiring concern (Story 43 reader); captured here as a known design item.
- **Transition:** assertions published before the hybrid carry `e` only and won't surface in a `#a` scan. **Decision: one-pass backfill** (Vinney re-emits legacy assertions with `a` added — slug-keyed replaceables, clean replace, small instance-local volume) so our reader is pure `#a`, no legacy-`#e` union to carry.

## Resolved
1. **What `claims` references** → **CORRECTED 2026-06-05 (PM): a kind-39999 tag-ELEMENT coord** `39999:<tagAuthor>:<slug>` (was: a kind-39998 concept — that was the `z` type-header). Many-to-many: a tag-element can be claimed by many circles; a circle can claim several tag-elements. Stays decoupled per David — the tag never points at the community. ⚠️ *pending Vinney's confirm.*
2. **The per-PoV WoT score lookup** → **RESOLVED (Vinney, 2026-06-05).** There is no single `trust(viewer,target)` endpoint. Trust is precomputed per delegated pubkey and stored on Meili profile docs as `wot_rank_<povSuffix>` columns; `resolvePov({wotPov,userPubkey})` (`src/api/_shared/pov.js`) → `{delegatedPubkey, povSuffix, minRank}`; gate asserters on `wot_rank_<povSuffix> >= minRank`. The **house PoV** is always indexed; an arbitrary viewer's PoV requires WoT provisioning first (so per-viewer rosters aren't free — v1 uses house PoV, matching the agreed UX).
5. **How the CD encodes `claims`** → **RESOLVED: a list of kind-39999 tag-element a-tag(s)** (follows from #1).
6. **Production roster path** → **RESOLVED: consume the server aggregation.** Vinney's branch already implements the exact math: `aggregateProfilesTagged({tagEventId|#a, povSuffix, minRank})` (scans assertions, gates asserters by WoT-from-PoV, nets polarity per target, dedupes replaceables) + `applyDisputesFunction(byTarget, cutoff)` (membership gate). The app consumes this endpoint (app-as-consumer, gap #4); the server owns WoT/Meili. Our `lib/membership.js#deriveRoster` is retained as the **semantic reference + test oracle + an offline house-PoV fallback**, not the production path — so we don't duplicate trust math client-side.

## Open (build-time choices, not design blockers)
3. **Cold-start first vouch** — founder-granted initial vouches vs time-bounded provisional standing vs invite-carries-a-vouch (Story 46).
4. **Threshold default** — 1 vouch vs N ≥ 2 (a "safe space" wants ≥ 2).

## Out of scope / deferred
- **All code** — blocked on the dependency; this is design-ahead only.
- Roster caching/perf. Admin roles. Reply-thread gating. The bespoke→CD membership migration.

## Implementation notes (for when unblocked)
- ✅ **Built 2026-06-05:** `lib/membership.js#deriveRoster` (pure semantic reference / oracle / offline house-PoV path); CD `claims`/threshold/cutoff write+read+§26 inheritance (`declaration.js`, `fetch.js`, `resolveDefinition.js`). Claims now hold 39999 tag-element coords.
- **Production roster:** consume the server `aggregateProfilesTagged` + `applyDisputesFunction` over the circle's claimed `#a` coords at the resolved PoV (house in v1). The app calls the endpoint; it does not re-run trust math client-side.
- `Found.jsx`: surface the CD `claims`/threshold/cutoff in founding/fork (deferred to the Story 45 display batch — builder already accepts the inputs).
- `CommunityDetail`: People tab renders the roster (applicant/member) + the trust signal; composer gate swaps to membership (Story 47).
- Consume the carve-out (`profile-tags/`, `pov.js`, `trustedList/`, firmware concepts) once on staging; reader is pure `#a` (backfill handles legacy `e`-only assertions).
