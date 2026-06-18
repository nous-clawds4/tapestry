# Story 1: ORE provider surface + ORE-02 `/stats/pubkey` (walking skeleton)

**Status:** Approved
**Created:** 2026-06-18
**Type:** Feature

## Background
[Open Ranking](https://github.com/Open-Ranking/protocol) (ORE) is an external HTTP/JSON protocol that lets any client discover and query a provider's web-of-trust / ranking services over plain HTTP — without speaking the nostr relay protocol. **ORE-01** is the capability-discovery document (`GET /.well-known/open-ranking.json`); it is only meaningful paired with at least one backed endpoint, since it *advertises* the endpoints and algorithms a provider supports.

This story stands up the ORE provider surface on the control panel and its first backed endpoint, **ORE-02 `/stats/pubkey`**, advertised by the ORE-01 document — a complete, minimal, conformant provider (the "walking skeleton"). `rank` maps to Brainstorm's existing GrapeRank score (`round(influence × 100)`), already computed per-POV. The instance's **house point-of-view** serves the global algorithm; a **personalized** algorithm serves only **provisioned** POVs (owner / configured house / customers), returning `422` for any other `pov` (the per-POV columns it would need are not computed on demand). Affected: third-party nostr clients / developers who want HTTP access to Brainstorm's grapevine scores; no existing surface changes.

## User-facing description
As a third-party nostr client or developer, I want to discover this instance's Open-Ranking capabilities and fetch web-of-trust stats for a pubkey over plain HTTP, so that I can use Brainstorm's grapevine scores without subscribing to relays or parsing nostr events.

## Acceptance criteria
Testable from outside (anonymous HTTP; no auth). All ORE paths are served off the `/api/` prefix.

- [ ] **Capability document.** Given an anonymous `GET /.well-known/open-ranking.json`, then `200` with `Content-Type: application/json` and `Access-Control-Allow-Origin: *`, and a body that is a JSON object whose single key is `"/stats/pubkey"`, mapping to an array whose **first** element is `{ "id": "grapevine", "pov": false, … }` (the default) and whose **second** is `{ "id": "grapevine-personalized", "pov": true, … }`. The document contains no endpoint keys for endpoints not yet implemented.
- [ ] **Preflight.** Given an `OPTIONS` request to `/.well-known/open-ranking.json` or `/stats/pubkey`, then `200` with appropriate `Access-Control-Allow-Methods` and `Access-Control-Allow-Headers`.
- [ ] **Global stats.** Given an anonymous `POST /stats/pubkey` with body `{ "pubkey": "<valid 64-hex-lowercase>" }` and no `algorithm`, then `200` with a body `{ "pubkey": "<echo>", "rank": <number>, … }` where `rank` is the house-POV grapevine score (`round(influence × 100)`); the optional fields `follows`, `followers`, `mutes`, `muters`, `reports`, `reporters`, `first_seen_at`, `ttl` are present when Brainstorm has the underlying data.
- [ ] **Personalized stats — provisioned POV.** Given `POST /stats/pubkey` with `{ "pubkey": "<hex>", "algorithm": "grapevine-personalized", "pov": "<provisioned-pov-hex>" }`, then `200` with that POV's `rank` for the pubkey.
- [ ] **Personalized stats — unprovisioned POV.** Given the same request with a `pov` that has no provisioned WoT columns, then `422` with an `X-Reason` header stating the `pov` is not provisioned — and **no** silent house fallback.
- [ ] **ORE-00 conventions.** A non-hex or `npub` `pubkey` → `422`; a malformed JSON body → `400`; an unsupported `algorithm` id → `422`; a missing `pov` on `grapevine-personalized` → `422`; a `pov` supplied to the global `grapevine` algorithm → **ignored** (returns the `200` global result). Every response (including errors) carries `application/json` and `Access-Control-Allow-Origin: *`; error detail rides the `X-Reason` header.
- [ ] **Additive / isolated.** The change adds only the ORE module and its route registration; it performs no writes/publishes/signing and makes no firmware, schema, pipeline, or nginx change. With the ORE module unregistered, every other route behaves exactly as before (regression-free).

## Concepts touched
No new concept-graph concepts. Existing machinery the Architect will lean on (reference, do not re-define):
- **House point-of-view identity** — serves the global `grapevine` algorithm (`pov-resolution` epic / three-PoV standard; `src/api/_shared/pov.js`).
- **GrapeRank `influence`** — `rank = round(influence × 100)`; surfaced today by `GET /api/get-profile-scores` (`src/api/export/users/queries/get-profile-scores.js`).
- **Per-POV Meili columns / POV→suffix resolution** — `wot_<metric>_<suffix>`, `suffix = delegatedPubkey.slice(0,8)`; provisioned-POV set determined by the three loaders (`src/algos/nip85/`, `src/algos/customers/nip85/`).
- **`.well-known` route precedent** — `GET /.well-known/nostr.json` (`src/api/nip05.js`), the template for a public, CORS-open, off-`/api/` route.

## Out of scope
- **ORE-05 `/search/pubkeys`** (Story 2) and growing the capability document to advertise it.
- All other ORE endpoints (03/04/06/07/08), ORE-A / NWT auth, and the `202`/`Retry-After` async pattern (Brainstorm reads are synchronous → always `200` on success).
- A POV-availability probe and any upstream ORE PR (worksheet **W12**).
- On-demand GrapeRank computation for unprovisioned POVs.
- The BIBLE write-up of the as-built ORE implementation (authored in Story 2 / at book close).
- Any UI.

## Open questions
- **Algorithm display metadata** — the `name` / `description` / `learn_more` values in the capability document. Proposed defaults: `name` `"Grapevine"` / `"Personalized Grapevine"`; one-line plain-text `description`s; `learn_more` **omitted** (it's optional) until a `brainstorm.world` docs page exists. Operator may supply preferred copy.
- **`ttl` and `Cache-Control`** for `/stats/pubkey` — derive from the score-refresh cadence (Architect/ADR).
- **`first_seen_at`** — only populate if Brainstorm has a reliable earliest-activity timestamp per pubkey; otherwise omit (it's a MAY field).
- **`reports` / `reporters` mapping** — which NIP-56 aggregates map to ORE's `reports` (count against the key) and `reporters` (distinct reporters): verified vs. raw counts. Architect/ADR decision.
- **Story size** — 7 acceptance criteria, but one cohesive module (the document + one endpoint + shared conventions). If the Architect judges it too large, the conventions+document and the stats endpoint may split — but they must still **ship together** so the document never advertises a dead endpoint.

## Linked artifacts
- ADR: `engineering-team/decisions/open-ranking/0001-ore-provider-and-stats.md` (Accepted; amended 2026-06-18 for the testability seam)
- Test plan: `engineering-team/stories/open-ranking/1-ore-provider-and-stats.test-plan.md` (20 failing tests, `test/open-ranking-stats.test.js`)
- Review: (filled in after Review phase)
