# Build Audit: Open Ranking (ORE) provider

**Book:** `engineering-team/audits/open-ranking/book.md`
**Date:** 2026-06-19
**Branch / commit range:** `feat/open-ranking` (off `origin/staging`) — shipped to staging via [apps#318](https://github.com/nous-clawds4/tapestry/pull/318) (ORE-01/02) + [apps#322](https://github.com/nous-clawds4/tapestry/pull/322) (ORE-05). BIBLE §28 + these close artifacts are branch-local pending a docs merge (OPEN.md #11).
**Provenance:** Acceptance-frame (no PRD)
**Confidence:** high — both endpoints are live on `staging.brainstorm.world` and independently smoke-verified (real Neo4j + nostr-search-api); every story passed a per-story review.

> As-built record — what the product *is* now. Audience-neutral; proposes nothing (that's the seed's job).

## 1. What shipped

A public, read-only HTTP interface to Brainstorm's web of trust, conformant to the external [Open Ranking](https://github.com/Open-Ranking/protocol) (ORE) protocol — a complement to the NIP-85 export over the same GrapeRank/Neo4j/Meili data.

- **ORE-01 capability discovery** — `GET /.well-known/open-ranking.json` advertises the supported endpoints/algorithms — `stories/open-ranking/1-ore-provider-and-stats.md`.
- **ORE-02 web-of-trust stats** — `POST /stats/pubkey` → `{pubkey, rank, follows, followers, mutes, muters, reporters, ttl}`; global (`grapevine`) + personalized (`grapevine-personalized`, provisioned POVs only, `422` otherwise) — same story.
- **ORE-05 profile search** — `POST /search/pubkeys` → `{results:[{pubkey, rank}], ttl}`, free-text, ranked under the owner POV, global only — `stories/open-ranking/2-search-pubkeys-global.md`.
- **BIBLE §28** documents the as-built implementation.

## 2. Epics & stories rolled up

### Epic: `open-ranking`
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 ore-provider-and-stats | ORE provider module + ORE-01 doc + ORE-02 `/stats/pubkey` (global + personalized) | Done | `reviews/open-ranking/1-ore-provider-and-stats.md` (PASS) |
| #2 search-pubkeys-global | ORE-05 `/search/pubkeys` (global) + doc extension | Done | `reviews/open-ranking/2-search-pubkeys-global.md` (PASS) |
| #3 search-personalized | personalized search — **planned, not built** (deferred, W13) | — | — |

## 3. As-built inventory (from the diff)

- **User-facing / endpoints** (all off the `/api/` prefix → auto-public; no auth; no nginx change): `GET /.well-known/open-ranking.json`, `POST /stats/pubkey`, `POST /search/pubkeys`.
- **New module** `src/api/open-ranking/`: `shared.js` (hex validation, ORE headers, error/apply triple, `ORE_STATS_TTL`/`ORE_SEARCH_TTL`), `capabilities.js` (CAPABILITIES registry + ORE-01 doc), `stats.js` (`buildStats` + `isPovProvisioned` + handler), `search.js` (`buildSearch` + `searchProfiles` calling `nostr-search-api` + handler), `index.js` (registration, `ORE_PATHS`, `oreJsonErrorHandler`, exports).
- **Refactor (authorized, behavior-preserving):** `src/api/export/users/queries/get-profile-scores.js` extracted `queryProfileScores`/`fetchProfileScores` (response shape + Cypher unchanged).
- **Wiring:** `src/api/index.js` (registers the module next to NIP-05).
- **Docs:** `BIBLE.md` §28.
- **Tests:** `test/open-ranking-stats.test.js` (20), `test/open-ranking-search.test.js` (18), wired into `test/test.js`.
- **Domain:** no concepts touched, **no schema/firmware change, no firmware reinstall**. No signing (so the never-hardcode-TA rule does not bite); the owner suffix is resolved at runtime via `getOwnerAssistantPubkey()`.
- **Data & contracts:** reads existing GrapeRank `influence` (→ `rank = round(influence×100)`) from Neo4j (stats, Owner PoV) and `wot_rank_<ownerSuffix>` Meili columns (search); no new stored shapes or event kinds.

## 4. Deviations from intent (acceptance frame)

| # | Specified (frame) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | "/search/pubkeys … grapevine + grapevine-personalized; personalized restricted to provisioned POVs" | Search advertises **global `grapevine` only**; personalized search deferred | deferred (operator-ratified amendment) | Cross-store POV-identity seam — Neo4j cards key by main pubkey, Meili by delegated suffix; personalized search needs a new main→delegated resolver (ADR 0002; book amendment; **W13**) | Personalized *search* unavailable; global search + personalized *stats* work | **Story 3** (W13 resolver) |
| 2 | "`OPTIONS` preflight → `200`" | `OPTIONS` → **`2xx` (204)** via the platform global CORS | constraint-discovered / interpretation | Platform `cors()` terminates preflight at 204; a route handler can't override without an entrypoint shim (ADR 0001 §CORS; story-1 Deviations) | None — real cross-origin clients work | Optional strict-200 shim |
| 3 | stats "reports/first_seen_at populated where data exists" | `reports` + `first_seen_at` **omitted** | constraint-discovered | No raw report-event count on the per-target query; only *latest*-activity ts exists (not earliest) (ADR 0001 field mapping) | Two optional ORE fields absent; required `rank` + the rest present | Revisit if a source appears |
| 4 | global served "from the house POV" | global = **owner-anchored** (Neo4j node for stats; owner-suffix Meili for search) | interpretation | Owner is the always-present baseline; §27 PoV model (ADR 0001/0002) | None material on this deployment | Unify if a distinct house delegate is configured |

**Undocumented work:** none — every diff hunk traces to a story/ADR. The `get-profile-scores` refactor is authorized by ADR 0001; the review-driven hardenings (null-pubkey filter, fetch timeout) are logged in `reviews/open-ranking/2-...md`.

## 5. Quality state at close

- **Test gate:** ORE suites green — `open-ranking-stats` **20/20**, `open-ranking-search` **18/18** (38 total). Full `npm test` is not host-runnable (other suites need the live Docker stack); the real Neo4j / `nostr-search-api` paths were verified by the **staging smoke** (both PRs: capability doc, stats with real ranks, search with desc ordering, the `422` paths, stats regression).
- **Accepted security finding (gated):** the `grapevine-personalized` **stats** path is an unauthenticated provisioning-enumeration oracle (`200` vs `422` reveals the customer set). Accepted for staging; **hard pre-prod gate** — `protocols/worksheet.md` **W12**, `reviews/open-ranking/1-...md`.
- **Debt (from ADR Consequences):** the two POV-identity schemes remain unreconciled (W13); strict ORE-00 preflight deferred; `reports`/`first_seen_at` unmapped.

## 6. Carry-forward register

- [ ] **Story 3 — personalized search**: build the server-side main→delegated POV resolver (owner→TA, customer→relay key) so ORE `pov` (the main pubkey) works across stats and search (W13).
- [ ] **Pre-prod gate**: gate the personalized-stats `pov:true` path (ORE-A/NWT auth or self-only check) before any production promotion (W12).
- [ ] **ORE-A / NWT auth** and the remaining ORE endpoints (`/rank/pubkeys`, `/recommend/pubkeys`, `/followers`, `/muters`, `/compromised/pubkeys`).
- [ ] **Upstream**: decide whether to propose a standard POV-availability/declared-POV mechanism to ORE, or stay conformant-without-it (W12).
- [ ] **Minor**: strict-200 `OPTIONS` shim; `reports`/`first_seen_at` population if a data source appears; house-vs-owner global unification.
- [ ] **Hygiene**: ship the close artifacts + BIBLE §28 to staging (docs-only PR) and delete `feat/open-ranking` after (OPEN.md #11).
