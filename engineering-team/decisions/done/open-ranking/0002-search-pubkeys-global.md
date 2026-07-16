# ADR 0002: ORE-05 /search/pubkeys (global only)

**Status:** Accepted
**Date:** 2026-06-19
**Story:** `engineering-team/stories/open-ranking/2-search-pubkeys-global.md`

## Context

Story 2 adds **ORE-05 `POST /search/pubkeys`** to the ORE provider shipped in Story 1: free-text profile search returning WoT-ranked pubkeys, **global only** (the `grapevine` algorithm, ranked under the instance's owner/global POV), extending the ORE-01 capability document. Acceptance criteria, restated: capability doc advertises `/search/pubkeys → [grapevine (pov:false)]` (stats unchanged); `POST {query}` → `200 {results:[{pubkey,rank}…], ttl}` sorted by rank desc, ≤ limit, profiles only; rank = owner-POV WoT rank (`round(influence×100)` scale, floor 0); ORE-00 conventions (query non-empty + ≤512, limit positive + ≤max, bad algorithm → 422, malformed JSON → 400, pov-on-global ignored, CORS + X-Reason); additive/read-only/off `/api/`.

**No concepts touched; no firmware reinstall.**

Grounding facts (verified, this branch):

- **The search backend is `nostr-search-api`.** The existing Meili proxy `handleMeiliSearchProfiles` (`src/api/search/profiles/meili/index.js:102`) forwards to `GET ${NOSTR_SEARCH_URL}/api/search` (default `http://nostr-search-api:3069`, `:12,:148`), Meili index `profiles`. Response: `{ hits:[{ id, pubkey, …profileFields, wot_<metric>_<suffix>, … }], estimatedTotalHits, _wotCount, … }` (`nostr-search/src/search.js`). The search-api's `/api/search` returns **profile docs only** — the tag-merge / NIP-05 / result-type logic lives in the *proxy*, layered on top.
- **The proxy has no per-request owner-POV path.** It resolves POV via `resolvePov({wotPov,userPubkey})` (`src/api/_shared/pov.js`): `wotPov='user'` → user-prefs `rankAuthor`; `wotPov='house'` → `settings.grapevine.searchPreferences.delegatedPubkey` (default **null**). There is no caller-supplied explicit suffix, and `house` is not guaranteed to be the owner.
- **The owner suffix is trivially available server-side.** `getOwnerAssistantPubkey()` (`src/utils/assistantKeys.js:49`, runtime lookup — env → `brainstorm.conf` → secure-keys JSON; **never hardcoded**) is the owner POV's delegated pubkey; `ownerSuffix = getOwnerAssistantPubkey().slice(0,8)`. This is exactly the suffix `src/algos/nip85/loadScoresIntoMeilisearch.js:38,49` uses when loading owner scores → so `wot_rank_<ownerSuffix>` is the owner POV's rank column.
- **Sort is a single param.** The proxy sends `sort=wot_<metric>_<suffix>:desc` to `/api/search` (`meili/index.js:174`). For rank that's `sort=wot_rank_<ownerSuffix>:desc`. The search-api runs a two-phase scored-then-backfill search, so scored profiles rank first, unscored append.
- **No programmatic (non-HTTP) callers** of the proxy/search-api exist in `src/` — all internal use is HTTP fetch to the endpoint URLs.
- **Limit cap** in the proxy is 200 (`Math.min(limit,200)`).
- **Story-1 ORE helpers are reusable as-is**: `oreHeaders`, `errorTriple`, `applyTriple`, `isValidHexPubkey`, the `CAPABILITIES` registry + `resolveAlgorithm`, `ORE_PATHS` + `oreJsonErrorHandler` (path-driven — covers any path added to the set), and the pure-`build*`+thin-handler testability seam.

## Options considered

### Option A — ORE-05 calls `nostr-search-api` directly with the owner-suffix sort *(chosen)*
A new `search.js` in the ORE module. A `searchProfiles(query, limit, ownerSuffix)` helper does `fetch(${NOSTR_SEARCH_URL}/api/search?q=…&limit=…&sort=wot_rank_<ownerSuffix>:desc)` — the **same backend the proxy uses** — and `buildSearch(input, deps)` maps hits → `{ pubkey: hit.pubkey||hit.id, rank: round(hit['wot_rank_'+ownerSuffix]||0) }`. `ownerSuffix = getOwnerAssistantPubkey().slice(0,8)`.

- **Pros:** Deterministic **owner-POV** ranking, consistent with Story 1's global=owner-baseline. Clean **profiles-only** hits (the search-api returns profile docs; no proxy tag/NIP-05 merging to strip). Reuses all Story-1 ORE helpers + the testability seam (inject a fake `searchProfiles`). No change to shared search code (`pov.js`/proxy). The owner suffix uses the runtime TA helper → honors the per-deployment-pubkey rule.
- **Cons:** A second call-site to `nostr-search-api` (duplicates a small fetch + URL/env handling that the proxy also has). Bypasses the proxy's result-type gating — fine, since ORE always wants profiles.

### Option B — Extend `resolvePov`/the proxy with an explicit owner path and call the proxy internally
Add `wotPov:'owner'` (→ `getOwnerAssistantPubkey()`) to `resolvePov`, then have ORE call the proxy handler.

- **Pros:** One search call-site; the owner path could help other callers.
- **Cons:** Modifies **shared** search code (`pov.js` + proxy) — wider blast radius for a story the ADR should keep additive. The proxy layers tag-merge/NIP-05/result-type logic ORE must then strip back out. Internal HTTP-to-self (`:7778`) indirection. More surface to break. Rejected for v1 (revisit if a second consumer wants an owner-POV proxy path).

### Option C — Use the proxy's `house` POV (`wotPov='house'`)
- **Pros:** Zero new search code.
- **Cons:** "Global" would mean whatever `settings.grapevine.searchPreferences.delegatedPubkey` is — **null by default** (→ no WoT sort, no `wot_rank` field → all ranks 0) and not guaranteed to equal the owner. Inconsistent with Story 1's owner baseline. Rejected.

## Decision

**Option A.** ORE-05 calls `nostr-search-api` `/api/search` directly with `sort=wot_rank_<ownerSuffix>:desc`, where `ownerSuffix = getOwnerAssistantPubkey().slice(0,8)`, and maps profile hits into `{pubkey, rank}`. Global `grapevine` = the **owner baseline POV** (matching Story 1's global stats).

- **rank** = `Math.round(hit['wot_rank_'+ownerSuffix] || 0)` — floor 0 for profiles unscored under the owner POV (ORE-05 has no 404; unscored matches sort last via the search-api's backfill phase). The owner POV is the always-loaded baseline, so scored profiles carry the column.
- **No min-rank filter** in v1 — return all query matches, ranked (the owner-POV sort provides ordering; no `wotFilters` sent).
- **limit**: default 20, max 200 (matching the proxy cap); non-integer / ≤0 / >200 → `422`.
- **ttl**: 300s (search/profile freshness; ORE-05 example value) — add `ORE_SEARCH_TTL = 300` to `shared.js`.
- **Degradation:** if `getOwnerAssistantPubkey()` is unset (misconfig), `ownerSuffix` is null → omit the sort (text-relevance order, ranks 0); no crash.

## Consequences

- **Enables** conformant global profile search reusing existing infra; owner-POV ranking consistent across `/stats/pubkey` and `/search/pubkeys`.
- **Constrains:** "global" = owner baseline, deliberately *not* the search page's configurable `house` delegate (documented; the global-vs-house question is a W13 sub-item). A second `nostr-search-api` fetch call-site now exists.
- **Debt/follow-ups:** Story 3 (personalized search) generalizes `searchProfiles` to take any **provisioned** suffix via the W13 main→delegated resolver + a readiness check → `422`. The BIBLE write-up (book-close) records the as-built ORE surface.
- **Firmware reinstall required?** **No.**

## Implementation notes

- **`src/api/open-ranking/search.js`** (new):
  - `searchProfiles(query, limit, ownerSuffix)` — the real dep: `const base = process.env.NOSTR_SEARCH_URL || 'http://nostr-search-api:3069'`; build `${base}/api/search` with params `q`, `limit`, and (when `ownerSuffix`) `sort=wot_rank_${ownerSuffix}:desc`; `fetch`, return `json.hits || []`. (Mirror the proxy's URL/env handling at `meili/index.js:12,148`.)
  - `mapHitToResult(hit, ownerSuffix)` → `{ pubkey: hit.pubkey || hit.id, rank: Math.round(Number(hit['wot_rank_'+ownerSuffix]) || 0) }`.
  - `async function buildSearch(input, deps)` — pure orchestrator returning a `{httpStatus, headers, body}` triple. `deps = { ownerSuffix, searchProfiles }`. Order: validate `query` (string, non-empty after trim, ≤512 → else `422`); `resolveAlgorithm('/search/pubkeys', body.algorithm)` (null → `422`); ignore any `body.pov` (global); validate `limit` (default 20; if provided: integer, >0, ≤200 → else `422`); `const hits = await deps.searchProfiles(query, limit, deps.ownerSuffix)`; `results = hits.map(h => mapHitToResult(h, deps.ownerSuffix))`; return `{200, oreHeaders(), { results, ttl: ORE_SEARCH_TTL }}`.
  - `async function handleSearchPubkeys(req, res)` — thin wrapper: `ownerSuffix = (getOwnerAssistantPubkey()||'').slice(0,8) || null`; `deps = { ownerSuffix, searchProfiles }`; `applyTriple(res, await buildSearch(req.body||{}, deps))`; catch → `applyTriple(res, errorTriple(500,'internal error'))`.
- **`src/api/open-ranking/capabilities.js`** — add to `CAPABILITIES`: `'/search/pubkeys': [{ id:'grapevine', name:'Grapevine', pov:false, description:'Global web-of-trust-ranked profiles for a free-text query, ranked by this instance\'s grapevine.' }]`.
- **`src/api/open-ranking/shared.js`** — add `const ORE_SEARCH_TTL = 300;` (export it).
- **`src/api/open-ranking/index.js`** — add `'/search/pubkeys'` to `ORE_PATHS`; in `registerOpenRankingRoutes`, `app.post('/search/pubkeys', handleSearchPubkeys)` (before the `app.use(oreJsonErrorHandler)`); re-export `buildSearch`, `handleSearchPubkeys`. (`oreJsonErrorHandler` needs no change — it's path-set-driven.)
- **Testability seam:** tests drive `buildSearch(input, {ownerSuffix, searchProfiles})` with a fake `searchProfiles` returning canned hits (incl. a `wot_rank_<suffix>` field and a no-score hit) — no live Meili. Mirrors ADR 0001's `buildStats` seam.

## Out of scope
- `grapevine-personalized` for search (Story 3, W13 resolver + readiness `422`).
- Any min-rank/quality filtering; tag/NIP-05/direct-pubkey results; pagination/offset beyond `limit`.
- Modifying the proxy or `resolvePov` (Option B); the BIBLE write-up (book close).
