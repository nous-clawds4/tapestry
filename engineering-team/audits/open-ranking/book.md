# Book of Work: Open Ranking (ORE) provider

**Slug:** open-ranking
**Status:** Closed
**Opened:** 2026-06-18
**Closed:** 2026-06-19

## Intent anchor
**Acceptance frame (no PRD)** — the operator's ask, restated and confirmed at kickoff. Completion is *judged* against the bullets below. Standard human-gated mode (not Direction mode).

Source request (verbatim): *"On our staging domain I would like to implement ORE-01, as specified here: https://github.com/Open-Ranking/protocol/blob/main/01.md Can you help me figure out how exactly to go about doing this?"*

Scoping conversation of 2026-06-18 established that **ORE-01 is the capability-discovery document** (`GET /.well-known/open-ranking.json`) and is only meaningful paired with at least one backed endpoint. The operator chose a first cut of **ORE-01 + ORE-02 (`/stats/pubkey`) + ORE-05 (`/search/pubkeys`)**, both fully backed by existing Brainstorm data (GrapeRank scores via `get-profile-scores`; the Meilisearch profile index). Each endpoint advertises a **global default algorithm** (`grapevine`, `pov:false`, served from the instance's **house POV** — array position 0 so a no-`pov` caller never trips a `422`) and a **personalized variant** (`grapevine-personalized`, `pov:true`). Personalized algorithms are **restricted to already-provisioned POVs** (owner / configured house / provisioned customers); an unprovisioned `pov` returns an honest **`422` + `X-Reason`**, never a silent house fallback (POV invariant: do not present a global answer as the caller's personal one). The provider is **public, read-only, unauthenticated, and unsigned** (ORE-A / NWT auth deliberately deferred).

**Amendment (2026-06-19, operator-ratified).** During Story 2 planning the **cross-store POV-identity seam** surfaced: Neo4j cards key a POV by the human's **main pubkey** (`observer_pubkey`), but Meili columns key by the **delegated-key suffix** (TA for owner, relay key for customers — see worksheet **W13**). That makes personalized *search* materially different from personalized *stats* and not feasible for external callers via the prefs-file path. Scope amended: **Story 2 ships global-only `/search/pubkeys`; personalized search moves to Story 3**, which builds the server-side main→delegated resolver (W13). Personalized *stats* (Story 1, shipped) is unaffected. Also: `OPTIONS` preflight is satisfied as a **2xx** (the platform's global CORS yields 204; strict-200 is a deferred follow-up — Story 1 deviations).

### Acceptance frame
- [ ] **ORE-01 capability document.** An anonymous `GET https://staging.brainstorm.world/.well-known/open-ranking.json` returns `200`, `Content-Type: application/json`, `Access-Control-Allow-Origin: *`, and a body conforming to ORE-01: a JSON object keyed by endpoint path → non-empty arrays of Algorithm Objects. At book close it advertises `/stats/pubkey` (with `[grapevine, grapevine-personalized]`) and `/search/pubkeys` (with `[grapevine]` — **global only**; personalized search deferred to Story 3 per the amendment + W13). `OPTIONS` preflight on each ORE path returns a `2xx`.
- [ ] **ORE-02 `/stats/pubkey`.** An anonymous `POST /stats/pubkey` with a valid 64-hex-lowercase `pubkey` and no `algorithm` returns `200` with `{ pubkey, rank, … }` where `rank` derives from the GrapeRank score under the **house POV**; optional `follows`/`followers`/`mutes`/`muters`/`reports`/`reporters`/`first_seen_at`/`ttl` are populated where Brainstorm has the data. The `grapevine-personalized` variant with a **provisioned** `pov` returns that POV's `rank`; with an **unprovisioned** `pov` returns `422` + `X-Reason`.
- [ ] **ORE-05 `/search/pubkeys` (global only — Story 2).** An anonymous `POST /search/pubkeys` with a non-empty `query` returns `200` with `{ results: [ { pubkey, rank }, … ], ttl? }` sorted by `rank` descending and capped at `limit`, backed by the Meilisearch profile index, ranked under the instance's global (owner) POV. Advertises only the global `grapevine` algorithm. (`grapevine-personalized` for search is **Story 3**, gated on the W13 main→delegated resolver.)
- [ ] **ORE-00 conventions** honored on every endpoint: pubkeys validated as 64-char lowercase hex (`npub`/bech32 rejected → `422`); request/response `application/json`; `Access-Control-Allow-Origin: *`; `OPTIONS` preflight → `2xx`; errors signaled by HTTP status (`400` malformed JSON, `422` validation/algorithm/`pov`) plus a human-readable `X-Reason` header. A `pov` sent to a global algorithm is **ignored**, not rejected. (Reads are synchronous, so success is always `200`; no `202`/`Retry-After` path is built.)
- [ ] **Additive, read-only, unauthenticated.** All ORE routes live **off the `/api/` prefix** (auto-public via the existing auth-middleware exemption). No writes, no signing (so the never-hardcode-TA-pubkey rule does not apply), no firmware/schema/pipeline changes, and **no nginx change** (the catch-all `location /` already forwards `.well-known` and bare paths to the app). With the ORE module unregistered, the rest of the app behaves exactly as before.
- [ ] **Positioned as additive to NIP-85**, documented in BIBLE: ORE is the **HTTP query interface** to the same underlying GrapeRank / Neo4j / Meili data that the existing **NIP-85 (kind 30382/10040)** export publishes as signed nostr events — a complementary surface for a different (HTTP, possibly non-nostr) audience, **not** a replacement. A BIBLE section records the as-built implementation (emission sites, field mapping, the provisioned-POV/`422` policy).
- [ ] **Live on `staging.brainstorm.world` with the staging smoke test passing.** Evidence: anonymous `GET /.well-known/open-ranking.json` → `200` conforming doc; anonymous `POST /stats/pubkey` and `POST /search/pubkeys` with sample inputs → `200` conforming responses; one `grapevine-personalized` request with an unprovisioned `pov` demonstrating the `422` + `X-Reason`.

## Epics in this book
- `open-ranking` — the public, read-only ORE provider surface on the control panel: the ORE-01 capability document plus the ORE-02 `/stats/pubkey` (global + personalized) and ORE-05 `/search/pubkeys` (global only in v1; personalized → Story 3) endpoints, mapping existing GrapeRank/Meili data into ORE's wire shapes.

## Out of scope (whole book)
- Other ORE endpoints: ORE-03 `/rank/pubkeys`, ORE-04 `/recommend/pubkeys`, ORE-06 `/followers`, ORE-07 `/muters`, ORE-08 `/compromised/pubkeys`.
- ORE-A / Nostr Web Token (kind 27519) authentication.
- A Tapestry-namespaced **POV-availability probe** ("is this `pov` provisioned?") — deferred pending the auth/privacy decision (an unauthenticated probe leaks the customer set). Parked as worksheet **W12**.
- Any upstream PR to the ORE spec (e.g. a standard POV-availability / declared-POV mechanism). Parked as **W12**.
- Any **on-demand POV computation**: arbitrary POVs are not computed at query time; only provisioned POVs are servable.
- **Personalized `/search/pubkeys`** (`grapevine-personalized` for search) — moved to **Story 3**, pending the cross-store POV-identity unification (the main→delegated resolver, worksheet **W13**). Personalized *stats* remains in scope (shipped, Story 1).
- Any UI; any change to the existing search page, profile pages, ranking/scoring pipeline, firmware, or the NIP-85 export.

## Direction mode (experiment) — pre-registered
*(Not used. This book runs in standard human-gated mode: the operator answers the per-story phase gates.)*

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** **high** — both endpoints (ORE-01 + ORE-02 + ORE-05 global) are live on `staging.brainstorm.world` and independently smoke-verified ([#318](https://github.com/nous-clawds4/tapestry/pull/318), [#322](https://github.com/nous-clawds4/tapestry/pull/322)); all stories PASS. Personalized search deferred to Story 3 (W13); personalized-stats pre-prod gate W12. See `audit.md` + `prd-seed.md`.

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/open-ranking/audit.md`
- Product feedback: `engineering-team/audits/open-ranking/prd-seed.md`
