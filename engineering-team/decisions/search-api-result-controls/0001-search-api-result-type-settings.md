# ADR 0001: Per-result-type settings gate on the public search API

**Status:** Accepted
**Date:** 2026-06-10
**Story:** `engineering-team/stories/search-api-result-controls/1-search-api-result-type-settings.md`
**Epic:** search-api-result-controls

## Context

The search proxy `GET /api/search/profiles/meili` (`src/api/search/profiles/meili/index.js:80`) is the public search API. On this branch it includes tag-derived data that `main` does not have. Verified against `origin/main`: zero occurrences of `tagHits` / `computeTagMatches` / `_matchedTags` in main's proxy.

All tag-derived data enters the response through **exactly two call sites** in `handleMeiliSearchProfiles`:

1. `computeTagMatches(...)` (line 155) → `_matchedTags` annotations on name-match hits (line 212), plus tag-match-only profiles appended to `hits` (lines 219–231).
2. `findTagsByNameSubstring(...)` (line 167) → `tagHits` / `tagHitsHasMore` response fields (lines 244–255, added by ADR-0006).

Nothing tag-related is baked into the Meilisearch index — tag matching is computed at query time (consistent with the filter-at-view-time invariant). Therefore the gate is purely a response-assembly decision in this one handler.

Supporting facts:

- **Settings:** two-layer system (`src/config/settings.js`) — `defaults.json` (shipped) deep-merged with `/var/lib/brainstorm/settings.json` (overrides). `getSettings()` reads disk per call → **a per-request read satisfies AC-4 (no restart)**. `TAPESTRY_SETTINGS_PATH` env override exists for tests (established pattern, Stories 2–4 test plans).
- **Write path:** `PUT /api/settings` (`src/api/settings/settingsApi.js`) already exists, deep-merges arbitrary override patches, and is gated by its `requireOwner` middleware which accepts **owner or adminPubkeys** → AC-5 is satisfied by existing infrastructure; no new endpoint needed.
- **Client:** `BrainstormSearch.jsx` reads defensively (`data.tagHits || []` at :914, :971; `!!data.tagHitsHasMore` at :972). When the server omits the fields, no tag rows render in popup or results page → **AC-6 is automatic; zero client search-path changes**.
- **Other search surfaces:** the NIP-50 proxy and the legacy/keyword search endpoints carry no tag data (verified by grep) — nothing to gate there.
- **POV invariants check:** this is an instance-level *API contract* control, not a trust judgment — "who is this true for?" → this deployment's consumers, uniformly. When tags are enabled, their POV-filtering at query time is unchanged. No per-POV denormalization introduced.

## Options considered

### Option A — New `search.resultTypes` settings section; per-request gate in the meili proxy; admin card on SearchPreferences (chosen)

- `src/config/defaults.json` gains a top-level section:
  ```json
  "search": { "resultTypes": { "profiles": true, "tags": false } }
  ```
  Shipped default = main's exact contract (tags off).
- `handleMeiliSearchProfiles` reads `getSettings().search?.resultTypes` per request (with `{profiles:true, tags:false}` as the hard fallback when the section is missing, so stale `settings.json` files behave like defaults).
  - **tags disabled:** skip both tag promises; **omit** `tagHits`/`tagHitsHasMore` keys from the response entirely (resolves story open question 1 — omission, byte-compatible with main); no `_matchedTags`, no appended tag-only hits (both live inside the skipped branch).
  - **tags enabled:** behavior identical to today.
  - **profiles disabled:** skip the downstream nostr-search-api fetch, the NIP-05 lookup, and the `pubkeyLookup` short-circuit (all profile-type results); return `hits: [], estimatedTotalHits: 0, nip05Result: null`. Tag results still flow if tags are enabled — "tags-only search" is a coherent configuration.
- Transport: existing `GET /api/settings` + `PUT /api/settings` (owner/admin). No new endpoint.
- UI: one new card on `ui/src/pages/grapevine/SearchPreferences.jsx` (which already has the `isOwnerOrAdmin` gate pattern at :115 and is the established admin search surface): two toggles + persistent warning shown when profiles is off.

**Pros:** smallest possible diff in the hot path (one settings read + two conditionals); default-safe for every existing deployment; AC-4/5/6 satisfied by existing infrastructure; clean layer separation (contract control ≠ POV prefs). **Cons:** the card reads via owner-gated `GET /api/settings` (invisible to non-admins — acceptable, the card is admin-only anyway); `search` is a new top-level settings namespace to document.

### Option B — Fold into `grapevine.searchPreferences` via `grapevinePrefApi.js`

Add `resultTypes` to the allowed-fields whitelist (`grapevinePrefApi.js:44`) and store under `settings.grapevine.searchPreferences`.

**Pros:** reuses the public GET (client could read it unauthenticated); one settings namespace. **Cons:** wrong layer — `searchPreferences` is the house-POV ranking cascade (user prefs → house prefs → relevance), conceptually per-viewer; result-type inclusion is per-instance contract, must NOT be user-overridable. Mixing them invites a future bug where a per-user pref override toggles the API contract. Rejected on layering.

### Option C — Client-side gating only

Hide tag rows in the UI behind a setting; leave the server response unchanged. **Rejected outright:** the story's entire point is external API consumers; the server contract is the thing being protected.

## Decision

**Option A.** The gate lives where the contract is assembled (the proxy handler), the setting lives in the instance-level settings layer with shipped defaults equal to main's behavior, and transport/auth reuse `PUT /api/settings`.

## Consequences

- Enables merging the tag feature to main with the default response contract provably identical to main's current one (AC-1 is directly testable: default-settings response has no tag keys).
- tags.brainstorm.world must flip `search.resultTypes.tags → true` via the new card after this lands there (ops note already in the epic file).
- The early-return paths (empty `q`, `pubkeyLookup`) already omit tag fields today; with the gate this inconsistency (review 7, non-blocking note) becomes the uniform contract when disabled. When tags are *enabled*, those early returns still omit the keys — unchanged from today's shipped behavior; not worsened.
- New top-level `search` settings namespace — future search-related instance settings have a home.
- Adds one `getSettings()` disk read (two small JSON files) per search request. Acceptable: the same request already does multi-service network I/O; measure only if profiling ever flags it.
- **Firmware reinstall required?** No — no concept changes.

## Implementation notes

- **File: `src/config/defaults.json`** — add the `search.resultTypes` section shown above.
- **File: `src/api/search/profiles/meili/index.js`** —
  - Add module-local helper `getResultTypes()` → `{ profiles, tags }` booleans from `getSettings().search?.resultTypes`, hard-fallback `{ profiles: true, tags: false }`. Call it once at the top of `handleMeiliSearchProfiles` (per request, AC-4).
  - `tags === false`: replace `tagMatchPromise` with `Promise.resolve({ matches: [] })` and `tagHitsPromise` with `Promise.resolve(null)`; build the final `res.json` WITHOUT the `tagHits`/`tagHitsHasMore` keys (spread conditionally, e.g. `...(includeTags ? { tagHits, tagHitsHasMore } : {})`). Distinguish "tags disabled" (`null`) from "enabled but zero matches" (`[]`) so the enabled-but-empty response still carries `tagHits: []`.
  - `profiles === false`: skip the `pubkeyLookup` branch (line 94), force `nip05Promise` to `null`, and skip the downstream fetch — synthesize `data = { hits: [], estimatedTotalHits: 0, processingTimeMs: 0, query: q.trim() }`. Keep `povSuffix`/`_wotCount: 0`/`_filtered` keys for shape stability.
- **File: `ui/src/pages/grapevine/SearchPreferences.jsx`** — new card "Search API result types", rendered inside the existing `isOwnerOrAdmin` section. Load current values from `GET /api/settings` (→ `settings.search.resultTypes`); save via `PUT /api/settings` body `{ search: { resultTypes: { profiles, tags } } }`. When the profiles toggle is off, render a warning: "Profiles are excluded — search responses will contain no profile results for any consumer of this instance's API." (AC-3.)
- **No changes** to `BrainstormSearch.jsx` (defensive reads already correct — AC-6), `grapevinePrefApi.js`, the NIP-50 proxy, or `/api/profile-tags/*` (story out-of-scope).
- **Relationship to prior ADRs:** amends **ADR-0006** (tagHits become conditional on the instance setting; default off) and is neutral to **ADR-0007** (popup/results parity holds — both surfaces consume the same response). Does not supersede either.
- **Test hook:** point `TAPESTRY_SETTINGS_PATH` at a temp file to flip settings per test (same pattern as Story 2–4 plans).

## Out of scope

- Gating `/api/profile-tags/*` endpoints (already dormant on main; story out-of-scope).
- A per-result-type framework beyond profiles/tags (the object shape extends naturally when a third type exists).
- Cache/invalidation strategy for settings reads (per-request disk read is the decision; revisit only with profiling data).
- tags.brainstorm.world's opt-in flip (ops step in the epic).
