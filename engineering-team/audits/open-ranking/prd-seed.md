# PRD Seed: Open Ranking (ORE) provider

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/open-ranking/audit.md`
**Anchor:** acceptance frame in `book.md`
**Confidence:** medium — the *as-built scope* is high-confidence (shipped + smoke-verified); the *product framing* below (who consumes it, why, what's next) is inferred and needs product validation.
**Date:** 2026-06-19

> Reverse-engineered baseline in the product-team PRD shape — a strawman for `/discover`, not a ratified spec. Sections tagged `[FROM FRAME]`, `[INFERRED]`, `[UNKNOWN — product input needed]`.

## 1. Product vision

`[INFERRED]` Make Brainstorm's web of trust consumable over plain HTTP by clients that don't speak the nostr relay protocol, by implementing the external **Open Ranking** standard. A consumer can discover the instance's capabilities, ask for a pubkey's trust stats, and search profiles ranked by trust — without subscribing to relays or parsing nostr events. It **complements** the existing NIP-85 (signed-event) export rather than replacing it: ORE answers ad-hoc queries (text search; arbitrary-pubkey stats) that the publish-based NIP-85 channel structurally can't.
`[UNKNOWN]` The demand signal — who is asking for an HTTP interface, and the business goal (developer adoption? a paid API tier? interop with other ORE providers?) — was never stated.

## 2. Personas

`[INFERRED]`, from the stories' "As a third-party nostr client or developer…" lines:
- **Nostr client developer** — wants WoT-ranked profile search + per-pubkey trust stats over HTTP to enrich a client without running their own graph.
- **Non-nostr / server-side integrator** — wants Brainstorm's trust data as a plain JSON API.
`[UNKNOWN]` Whether either persona actually exists yet, and their relative priority.

## 3. Scope (as-built)

`[FROM FRAME]` Shipped and live on staging:
- ORE-01 capability document (`/.well-known/open-ranking.json`).
- ORE-02 `/stats/pubkey` — global + personalized (provisioned POVs only).
- ORE-05 `/search/pubkeys` — **global only**.
- Public, read-only, unauthenticated, unsigned; additive (no change to existing surfaces).

`[INFERRED]` Deliberately **out** of this baseline: personalized search; auth (ORE-A/NWT); the other ORE endpoints (rank/recommend/followers/muters/compromised); any UI; production deployment.

## 4. Domain model

`[INFERRED]` No new domain entities. Reuses: GrapeRank **`influence`** (→ ORE `rank = round(influence×100)`); the **three-PoV** model (§27 BIBLE) — global = owner-anchored, personalized = a provisioned POV; **provisioning** = the owner or a customer with a `NostrUserWotMetricsCard` / loaded Meili `wot_*_<suffix>` columns. A POV is keyed by the human's **main pubkey** in Neo4j but by a **delegated-key suffix** in Meili — the unresolved seam (W13).

## 5. Design rules (as-built)

`[INFERRED]` API-only (no UI). Wire conventions are the external ORE-00 spec (hex pubkeys, `application/json`, `Access-Control-Allow-Origin: *`, `X-Reason` on errors, `422`/`400`). One Brainstorm-specific product rule was enforced: **never present a global answer as a caller's personal one** — an unprovisioned personalized request returns `422`, not a silent house fallback. `[INFERRED]` No rule was recorded for how "global" should behave if an operator configures a house delegate distinct from the owner (today global = owner).

## 6. Carry-forward & open questions

Promoted from audit §6:
- Personalized search (Story 3 / W13 main→delegated resolver).
- The **personalized-stats enumeration-oracle** pre-prod gate (W12) — the single blocker to a production launch.
- ORE-A auth + the remaining ORE endpoints; an upstream POV-availability proposal (W12).
- Minor: strict-200 `OPTIONS`; `reports`/`first_seen_at`; house-vs-owner global.

## 7. What product must validate

- [ ] **Who consumes this, and why?** The vision + personas are inferred — confirm the demand and the goal before investing further.
- [ ] **Production posture.** Ship to prod global-only (search + global stats, no oracle), or first gate the personalized-stats path (W12)? And *how* — ORE-A/NWT auth, or a self-only check?
- [ ] **Personalized everywhere?** Is personalized *search* (Story 3) wanted, given it requires the W13 resolver and re-introduces the same enumeration concern as personalized stats?
- [ ] **Breadth.** Which of the other ORE endpoints (recommend / rank / followers / muters / compromised) are worth implementing, if any?
- [ ] **Standards stance (W12).** Push back on ORE's "every provider supports every POV" reflex upstream, or quietly stay conformant-without-it?
