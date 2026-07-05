# Story 2: ORE-05 /search/pubkeys (global only)

**Status:** Done
**Created:** 2026-06-19
**Type:** Feature

## Background
Story 1 shipped the ORE provider scaffold + ORE-01 capability document + ORE-02 `/stats/pubkey` (live on staging, [apps#318](https://github.com/nous-clawds4/tapestry/pull/318)). This story adds the second backed endpoint, **ORE-05 `POST /search/pubkeys`** — free-text profile search returning web-of-trust-ranked pubkeys — and extends the capability document to advertise it.

**Global only.** Story-2 planning surfaced the cross-store POV-identity seam (Neo4j cards key a POV by main pubkey; Meili columns by a delegated-key suffix — worksheet **W13**), which makes personalized *search* materially different from personalized *stats* and infeasible for external callers via the prefs-file path. So this story ships the **global** `grapevine` algorithm only (ranked by the instance's owner/global POV — what logged-out search already serves); `grapevine-personalized` for search is **Story 3**, gated on the W13 main→delegated resolver. Affected: third-party nostr clients / developers wanting HTTP profile search; no existing surface changes.

## User-facing description
As a third-party nostr client or developer, I want to search Brainstorm's profiles by a free-text query over plain HTTP and get back web-of-trust-ranked pubkeys, so that I can surface the most relevant/trusted accounts for a query without speaking the nostr relay protocol.

## Acceptance criteria
Testable from outside (anonymous HTTP; no auth). Routes off the `/api/` prefix.

- [ ] **Capability doc extended.** `GET /.well-known/open-ranking.json` → 200 and now advertises **`/search/pubkeys`** mapped to an array whose single element is `{ "id": "grapevine", "pov": false, … }` (the default). `/stats/pubkey` is unchanged (still `[grapevine, grapevine-personalized]`). Body remains a JSON object keyed by endpoint path; `Content-Type: application/json`; `Access-Control-Allow-Origin: *`.
- [ ] **Search happy path.** `POST /search/pubkeys` with body `{ "query": "<non-empty>" }` (no `algorithm`) → 200 with `{ results: [ { pubkey, rank }, … ], ttl }`, where `results` are **profile (kind-0) pubkeys** matching the query, **sorted by `rank` descending**, length ≤ `limit`.
- [ ] **Rank semantics.** Each `rank` is the profile's grapevine WoT rank under the instance's **global (owner) POV** — the same scale/meaning as `/stats/pubkey`'s `rank` (`round(influence × 100)`); a matched profile with no score under that POV gets a floor `rank` of 0.
- [ ] **Profiles only.** Results contain only profile pubkeys; non-profile result types the underlying search may surface (tag hits, etc.) are excluded.
- [ ] **`limit`.** Optional positive integer; provider default when omitted; a non-positive `limit` → `422`; a `limit` over the provider maximum → `422` (per ORE-05). Response holds at most `limit` results.
- [ ] **ORE-00 conventions.** Missing/empty `query` → `422` + `X-Reason`; `query` longer than 512 chars → `422`; unsupported `algorithm` → `422`; malformed JSON body → `400`; a `pov` supplied to the global algorithm is **ignored** (200). Every response (success and error) carries `Content-Type: application/json` + `Access-Control-Allow-Origin: *`; error detail rides `X-Reason`.
- [ ] **Additive / isolated.** Reuses the existing Meilisearch search path; adds no new search infrastructure, no firmware/schema/pipeline change, no nginx change, no writes. With the ORE module unregistered, the rest of the app behaves exactly as before.

## Concepts touched
No new concept-graph concepts. Existing machinery (reference, do not re-define):
- **Meili search proxy** — `src/api/search/profiles/meili/index.js` (`handleMeiliSearchProfiles`), the single authority for POV→suffix + filter/sort + field namespacing; forwards to the `nostr-search-api`.
- **Global/owner POV suffix** — the owner's Meili columns (`wot_rank_<ownerSuffix>`), loaded by `src/algos/nip85/loadScoresIntoMeilisearch.js` (suffix = `getOwnerAssistantPubkey()`).
- **POV resolver** — `src/api/_shared/pov.js` (`resolvePov`).

## Out of scope
- **`grapevine-personalized` for search** — Story 3, gated on the W13 main→delegated resolver.
- All other ORE endpoints (03/04/06/07/08), ORE-A/NWT auth, the `202`/`Retry-After` async pattern.
- Tag hits / NIP-05 lookups / direct-pubkey lookup as ORE results (profiles only).
- Any UI; the BIBLE write-up (Story 3 / book close).

## Open questions
- **Global POV source.** Rank under the **owner TA suffix** (consistent with Story 1's owner-baseline global stats) vs the proxy's `wotPov='house'` default (the configurable house delegate). Recommend **owner**, for cross-endpoint consistency — Architect to confirm how to invoke search for a specific suffix (extend `resolvePov`/the proxy with an explicit-suffix path, or call the `nostr-search-api` directly with the owner-suffix sort).
- **Reuse vs extract.** The proxy is a GET Express handler (`req`/`res`, query params). ORE is POST/JSON. Architect: extract a reusable search core (à la `fetchProfileScores`) vs invoke the proxy internally — honoring the Story-1 testability seam (a pure `buildSearch(input, deps)` returning a `{httpStatus, headers, body}` triple, deps-injected).
- **`rank` field.** Map from `hit['wot_rank_'+ownerSuffix]` (floor 0 if absent); confirm hits carry the column and that the sort is by it.
- **Min-rank filtering.** Whether to apply any WoT min-rank filter (e.g. the house `filters.rank.min`) or return all query matches ranked. Default: no extra filter in v1 (the owner-POV sort provides ordering + rank).
- **`limit` default + max** (e.g. default 20, max 200 to match the proxy's internal cap) and **`ttl`** value (e.g. 300, per the ORE-05 example).

## Deviations
- **Story-1 `C1` test updated (stale assertion).** Story 1's `C1` asserted the capability document advertises *only* `/stats/pubkey`. Story 2 legitimately adds `/search/pubkeys`, so `C1` was relaxed to assert `/stats/pubkey` is still advertised with its two algorithm objects (no longer "the only endpoint"). Not a behavior change.
- **`searchProfiles` uses global `fetch`** (Node 18+) and `NOSTR_SEARCH_URL` (default `http://nostr-search-api:3069`), mirroring the existing Meili proxy's downstream call exactly.
- **`limit` over max → 422** (not silent clamp), per ORE-05's "exceeds provider max → 422"; provider max = 200 (matches the proxy cap), default 20.

## Linked artifacts
- ADR: `engineering-team/decisions/open-ranking/0002-search-pubkeys-global.md` (Accepted)
- Test plan: `engineering-team/stories/open-ranking/2-search-pubkeys-global.test-plan.md` (`test/open-ranking-search.test.js`, 17 tests)
- Review: (filled in after Review phase)
