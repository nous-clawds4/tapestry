# ADR 0029: Verified-followers count on the profile page

**Status:** Accepted
**Date:** 2026-06-06
**Story:** `engineering-team/stories/profile/33-profile-verified-followers-count.md`

## Context

Story 33 asks for a **"Verified Followers"** plain (non-link) count in the prominent counter block beside the existing "Following" count on the profile page — House PoV by default, personalized PoV when selected, reusing the existing verified-followers influence cutoff. Scope is the count display only (the followers table is sub-feature 2, deferred).

Acceptance criteria (quoted to confirm): (1) a count labeled "Verified Followers" appears in the prominent counter area beside "Following"; (2) it reflects only verified followers, not the raw total; (3) no PoV specified → House PoV; (4) personalized PoV selected & available → reflect it, else fall back to House; (5) no data → neutral placeholder (not error, not misleading "0"); (6) zero verified followers → "0"; (7) displayed as a plain, non-link number.

**Key finding — the data is already on the page, PoV-aware.** Tracing the current tree:

- The prominent counter block (`bsp-counts`) at [BrainstormProfile.jsx:236-242](ui/src/pages/BrainstormProfile.jsx:236) renders "Following" only, via `useUserCounts` → `GET /api/get-user-counts` (strfry kind-3 `p`-tag count — not applicable to followers).
- The **Reputation** section already fetches `GET /api/search/profiles/meili/document/<pubkey>` ([BrainstormProfile.jsx:141](ui/src/pages/BrainstormProfile.jsx:141)) and extracts `wot_<metric>_<povSuffix>` fields into a `trustScores` object ([:149-182](ui/src/pages/BrainstormProfile.jsx:149)). `povSuffix` = `?pov=` else the House `delegatedPubkey` suffix ([:130-139](ui/src/pages/BrainstormProfile.jsx:130)).
- `TRUST_METRICS` ([:34-46](ui/src/pages/BrainstormProfile.jsx:34)) already maps both `verifiedFollowerCount` ([:43](ui/src/pages/BrainstormProfile.jsx:43)) and `followers` ([:36](ui/src/pages/BrainstormProfile.jsx:36)) — both already render in the Reputation grid today.
- Pipeline producing the field: `calculateVerifiedFollowerCounts.sh` sets `NostrUser.verifiedFollowerCount` (House) and `NostrUserWotMetricsCard.verifiedFollowerCount` (personalized, per enrolled PoV); [publish_kind30382.js:154,161](src/algos/customers/nip85/publish_kind30382.js:154) emits both `["followers", N]` and `["verifiedFollowerCount", N]` tags; [loadScoresIntoMeilisearch.js:93](src/algos/nip85/loadScoresIntoMeilisearch.js:93) writes `wot_<tag>_<povSuffix>` for every non-structural tag → Meili docs carry `wot_verifiedFollowerCount_<suffix>` and `wot_followers_<suffix>`.

So `trustScores.verifiedFollowerCount` (and `.followers`, same value) is **already available client-side, already PoV-namespaced**, identical to what the Reputation grid consumes.

**Constraints:** JS-without-build (no new tooling); minimize new surface; staging≈prod scale (~32M FOLLOWS) so avoid heavy per-request graph queries; the verified cutoff is applied upstream in the `calculate*` step (this story consumes the result — cutoff reused implicitly). Concept Graph API at `:8877` was unreachable; this change introduces/alters **no concepts**, so concept-graph orientation is not load-bearing here.

## Options considered

### Option A — Reuse the client-side `trustScores` value (chosen)
Render the already-fetched `trustScores.verifiedFollowerCount` in the `bsp-counts` block as a plain counter. No backend change.
- **Pros:** zero new backend/endpoint/Neo4j surface; PoV resolution already done by the page; same source & freshness as the rest of the Reputation section (UI consistency); no new query on the prod-scale graph; smallest possible diff and test surface.
- **Cons:** value rides the Reputation Meili fetch's cadence (staleness — but identical to what the grid already shows) and its loading/error lifecycle (`trustLoading`/`trustError`), which is separate from the Following count's `useUserCounts` lifecycle; the rare "personalized PoV selected but not indexed" case degrades to the placeholder rather than substituting House (see Consequences).

### Option B — Server-side via `get-user-data` (Neo4j, observer-aware)
`handleGetUserData` returns `verifiedFollowerCount` from `NostrUser`/`NostrUserWotMetricsCard` ([userdata.js:154](src/api/export/users/queries/userdata.js:154), PoV via `observerPubkey`). The page would call it for the counter.
- **Pros:** reads the Neo4j property one pipeline hop fresher than Meili.
- **Cons:** that handler runs a large social-graph query (frens/groupies/idols/recommendations/mutuals) — heavyweight + 504 timeout risk on the prod-scale graph for a single number; the page doesn't call it today (new fetch + new loading/error handling); its PoV model (`observerPubkey`) differs from the page's `povSuffix` approach. Overkill for a page-load count.

### Option C — Extend `get-user-counts` (the "hybrid" the docstring anticipates)
Add a Neo4j `verifiedFollowerCount` branch to `/api/get-user-counts` (today strfry-only, `followingCount` only — [userdata.js:315](src/api/export/users/queries/userdata.js:315)), plus PoV handling it currently lacks.
- **Pros:** co-locates with `followingCount`; one clean "counts" endpoint; decouples the counter from the Reputation fetch.
- **Cons:** new query + new PoV plumbing for no fresher data (same upstream pipeline); duplicates data already in hand client-side; more code and test surface. A reasonable *future* consolidation, unnecessary now.

*(A live per-request count cypher over inbound FOLLOWS with an influence filter was rejected outright — too heavy at prod scale for a page-load number, and unnecessary given precomputed counts exist.)*

## Decision
**Option A.** The verified-follower count is already client-side, already PoV-aware, and already the source the Reputation section uses. The feature is a small, self-contained front-end change with no backend, endpoint, Neo4j, or concept surface, and no new prod-scale query. It is also the most *consistent* choice — the prominent counter and the Reputation grid will show the same number from the same source.

**Contingency:** if, at implementation time against a live stack, Meili unexpectedly does **not** carry `wot_verifiedFollowerCount_<suffix>` / `wot_followers_<suffix>`, fall back to **Option C** (extend `get-user-counts`). The Tester/Implementer will confirm against a live Meili document early.

## Consequences
- **Enables:** the prominent "Verified Followers" counter with House-default + personalized PoV, reusing existing infrastructure; near-zero risk; no firmware/concept changes.
- **Constrains:** the counter shares the Reputation section's data source and refresh cadence (Meili, refreshed by the scheduled score-load). Staleness is bounded by that cadence — acceptable and consistent with the existing grid.
- **Loading states:** the counter's value derives from the `trustScores` fetch (`trustLoading`/`trustError`), which is *separate* from the Following count's `useUserCounts` (`userCountsLoading`). The two counters in `bsp-counts` will resolve independently; the Implementer handles the verified-followers value with the existing `fmtCount` helper so it shows "—" until `trustScores` resolves.
- **PoV fallback edge (flag for Tester + user):** the page resolves one active PoV (`?pov=` else House). House is the default → satisfies AC#3 and the common-case intent of AC#4 ("default to House when no personalized PoV is in play"). For a *selected personalized PoV that has no scores indexed*, the existing fetch reports "no trust scores" for the whole Reputation section, so the counter shows the placeholder (AC#5) rather than silently substituting House. This matches the user's stated intent for the dominant no-personalized case; strict per-lookup House substitution in the rare partial case is a small possible follow-up (read the House-suffix value as an explicit fallback) — **recommend deferring**.
- **Duplicate-field note:** `wot_verifiedFollowerCount_<suffix>` and `wot_followers_<suffix>` carry the same value. The counter reads `verifiedFollowerCount` with `followers` as a defensive fallback. (The duplicate `TRUST_METRICS` *grid* rows remain a separate intake cleanup — untouched here.)
- **Cutoff:** reused implicitly — the count reflects whatever `VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF` the upstream `calculate*` step applied. No cutoff logic enters this change. (The 0.01 / 0.05 / "score > 2" inconsistency remains an intake item.)
- **Firmware reinstall required?** No (no concept/schema changes).

## Implementation notes
Single file. No backend changes.

- **File: [ui/src/pages/BrainstormProfile.jsx](ui/src/pages/BrainstormProfile.jsx)**
  - In the `bsp-counts` block (currently [:236-242](ui/src/pages/BrainstormProfile.jsx:236)), add a second count element beside the existing Following `<Link>`.
  - **Value:** `trustScores?.verifiedFollowerCount ?? trustScores?.followers`. Format with the existing `fmtCount` helper ([:97](ui/src/pages/BrainstormProfile.jsx:97)) — `fmtCount(null)` → `"—"` (AC#5), `fmtCount(0)` → `"0"` (AC#6).
  - **Render as a plain element** (e.g. `<div className="bsp-count">` with `bsp-count-value` + `bsp-count-label`), **not** a `<Link>`, and without `bsp-count-link` (AC#7 — non-link until the followers table ships). Leave the existing Following `<Link>` exactly as-is.
  - **Label:** `"Verified Followers"` (AC#1).
  - **PoV:** no new logic — the value rides the existing `povSuffix` resolution ([:130-139](ui/src/pages/BrainstormProfile.jsx:130)) and `trustScores` fetch ([:141-182](ui/src/pages/BrainstormProfile.jsx:141)). House by default (AC#3); `?pov=` honored (AC#4).
  - **Do NOT touch:** the Following count; the Reputation grid; the `TRUST_METRICS` array (duplicate-row cleanup is out of scope); any backend file.
  - **Styling:** reuse the existing `bsp-count` / `bsp-count-value` / `bsp-count-label` classes; a small CSS tweak for the non-link variant (if needed) belongs in the existing profile stylesheet — no new build step.

## Out of scope
- The followers table page (`/user/:pubkey/followers`) — sub-feature 2.
- Reconciling the duplicate "Verified Followers" rows in `TRUST_METRICS` — intake.
- Reconciling the cutoff inconsistency (0.01 / 0.05 / "score > 2") — intake.
- Any change to how `verifiedFollowerCount` is computed/published/loaded (`calculate*`, `publish_kind30382`, `loadScoresIntoMeilisearch`).
- Strict per-lookup personalized→House substitution (recommend defer).
- Changing `get-user-counts` / `get-user-data`.
