# ADR 0002: Verified reporters membership data

**Status:** Accepted
**Date:** 2026-06-07
**Story:** `engineering-team/stories/verified-reporters/2-verified-reporters-membership-data.md`
**Epic:** `verified-reporters`

## Context

Story 2 needs the *membership* behind the verified-reporter count: given an account and a point of view, the verified users who NIP-56-reported it, each with enough identity to display and weigh (AC1, AC2). The load-bearing requirement is **AC3 — the returned set size must equal the count shown for that account under the same point of view** (count = list length). AC4: no calculated PoV → House fallback. AC5: empty set on none. AC6: reject a bad account identifier.

**How the count is actually computed (verified on this branch):**
`src/algos/follows-mutes-reports/calculateVerifiedReporterCounts.sh:13-18`:
```cypher
MATCH (n:NostrUser)<-[f:REPORTS]-(m:NostrUser)
WHERE m.influence > ${VERIFIED_REPORTERS_INFLUENCE_CUTOFF:-0.05}
WITH n, count(f) AS verifiedReporterCount
SET n.verifiedReporterCount = verifiedReporterCount
```
So a "verified report" is the Neo4j edge **`(reporter:NostrUser)-[:REPORTS]->(reported:NostrUser)`** where the **reporter's `influence` > `VERIFIED_REPORTERS_INFLUENCE_CUTOFF`** (House/owner GrapeRank, default 0.05). The result is written to `reported.verifiedReporterCount`, published to Meilisearch via kind-30382, and read by Story 1 as `wot_verifiedReporterCount_<povSuffix>` (`BrainstormProfile.jsx:155-166`).

**The membership is the literal inverse of that count query** — return `m` (the reporters) instead of `count(f)`. Same edge, same cutoff, same `influence` source ⇒ `count(rows) === reported.verifiedReporterCount` at House PoV, by construction.

**The PoV dimension (the deferral that this whole feature area already made):**
- The House count uses `m.influence` (one GrapeRank per node).
- A **personalized/customer** count (`src/algos/customers/calculateVerifiedReporterCounts.sh`) traverses a per-customer `NostrUserWotMetricsCard` with a per-customer `VERIFIED_REPORTERS_INFLUENCE_CUTOFF`. This is the same `NostrUserWotMetricsCard` / `?observer=<customer>` machinery that **ADR 0026 (follows) and ADR 0030 (followers) explicitly deferred** ("owner/House PoV only" for v1).

**The count-vs-list reality (ADR 0030 already found this):** the profile count comes from **Meili** (precomputed, refreshed periodically via kind-30382); a membership endpoint is a **live Neo4j** query. Even at House PoV with the identical cutoff, the two are different *snapshots*, so they match in steady state but can transiently diverge across a refresh. ADR 0030 §Consequences documents exactly this for followers and told tests not to assume real-time equality.

**Precedent to mirror:** follows = `GET /api/get-grapevine-follows` (`src/api/grapevineInteractions/queries/followsWithMetrics.js`, `handleGetGrapevineFollows`); followers = `GET /api/get-grapevine-followers` (ADR 0030) — an isolated, purpose-built endpoint with `isValidHexPubkey(observee)` → 400, a `NEO4J_QUERY_TIMEOUT_MS` deadline → 504, owner-only `observer` → 400, response `{ success, observer:'owner', observee, count, data }`, consumed by a `useGrapevine*` hook.

Constraints: JS-without-build (no new lint/typecheck); honor the Neo4j deadline pattern; no concept-graph/firmware change (Concept Graph API not consulted for runtime Neo4j properties — these are node properties, not graph-concept nodes).

## Scope decision to ratify (PoV): House/owner PoV for v1
Story 2's AC1/AC3 say "under the viewer's point of view." The honest, precedent-consistent v1 is **House/owner PoV only**, deferring personalized/customer PoV exactly as follows/followers did. Under that scope: **AC4 (House fallback) is the v1 path and is fully met; AC1/AC3 hold at House PoV** (membership = inverse of the House count, count = list length in steady state). For a *personalized-PoV* viewer, Story 1's profile count (which can be a customer-PoV Meili value) and this House-PoV list can differ — a documented v1 limitation, the same divergence ADR 0030 accepted. This is flagged for the user to ratify at the gate (it scopes AC1/AC3); personalized-PoV membership is a named follow-up.

## Options considered

### Option A — New isolated endpoint, inverse-REPORTS traversal, House PoV *(chosen)*
`GET /api/get-grapevine-reporters?observee=<pk>` — a sibling of `followsWithMetrics.js` / `followersWithMetrics.js`. Cypher: `MATCH (observee)<-[:REPORTS]-(reporter:NostrUser) WHERE reporter.influence > $cutoff RETURN reporter.{pubkey,influence,hops,verified*Count}`, `$cutoff` from `VERIFIED_REPORTERS_INFLUENCE_CUTOFF` (the **same** var the count algo uses). Whole verified set, no server ORDER BY/LIMIT; `{ success, observer:'owner', observee, count, data }` with `count === data.length`. New `useGrapevineReporters` hook for Story 3.
- **Pros:** membership is the literal inverse of the count computation → AC3 holds at House PoV by construction (and the endpoint's own `count` always equals `data.length`); zero regression risk to live follows/followers (ADR 0026/0030 isolation precedent); same validation/deadline/shape as its siblings; verified-reporter sets are *small* (being reported by trusted users is rare — the feature's whole premise), so ADR 0030's mega-account scale worry barely applies.
- **Cons:** a third near-duplicate endpoint/hook. Addressed: the DRY follow-up ADR 0030 already filed (`<GrapevineList>` + shared cypher builder) should absorb reporters too.

### Option B — Generalize the follows/followers endpoint with an interaction-type param
One endpoint serving follows / followers / reporters.
- **Pros:** DRY now.
- **Cons:** edits live, prod-shipped code (follows is on prod) — regression risk; ADR 0026/0030 deliberately rejected this for v1. Rejected for the same reason here; fold into the planned DRY refactor later, not now.

### Option C — Personalized/customer per-PoV membership now
Reproduce the per-customer `NostrUserWotMetricsCard` traversal so the list matches Story 1's PoV-namespaced count for *every* PoV.
- **Pros:** AC3 would hold for personalized PoV too.
- **Cons:** this is exactly the customer-observer complexity follows/followers deferred; high scope/risk, a `?observer=<customer>` selector and metrics-card traversal. Rejected for v1; named as the personalized-PoV follow-up.

## Decision
**Option A**, **House/owner PoV only for v1** (pending user ratification of the PoV scoping above). The membership endpoint is the inverse of the existing House count query, reusing `VERIFIED_REPORTERS_INFLUENCE_CUTOFF`, so `count = list length` holds at House PoV in steady state and the endpoint's own `count` equals `data.length` exactly. Personalized-PoV membership and the DRY refactor are follow-ups.

## Consequences
- **Enables** Story 3 (the list page) with data whose count matches the House-PoV count by construction.
- **AC3 is exact within the capability** (`count === data.length`) and holds at House PoV vs the count algo (same edge + cutoff). **It is not a hard real-time guarantee vs Story 1's profile count**, which is precomputed in Meili: transient refresh-skew and personalized-PoV differences are possible — Story 3 should display *its own* (live) count as the list header so the page is internally consistent, and copy/tests must not assert real-time equality with the profile badge (mirrors ADR 0030).
- **Personalized/customer PoV deferred** — for such viewers the profile count (personal) and this list (House) can differ. Named follow-up.
- **Duplication → the existing DRY follow-up** (ADR 0030's `<GrapevineList>` + shared cypher builder) should later absorb follows/followers/reporters.
- **Cutoff inconsistency** (the existing intake item: 0.01 vs 0.05 vs "score>2") is inherited, not fixed here — but using the *same* `VERIFIED_REPORTERS_INFLUENCE_CUTOFF` as the count algo is what makes count = list length hold.
- **Firmware reinstall required?** No (no concept/schema change; runtime Neo4j properties only).

## Implementation notes
**Backend** — new `src/api/grapevineInteractions/queries/reportersWithMetrics.js` exporting `handleGetGrapevineReporters(req, res)`, a near-copy of `followsWithMetrics.js` with:
- Cypher: `MATCH (observee:NostrUser {pubkey:$observee})<-[:REPORTS]-(reporter:NostrUser) WHERE reporter.influence > $cutoff RETURN reporter.pubkey AS pubkey, reporter.influence AS influence, reporter.hops AS hops, reporter.verifiedFollowerCount AS verifiedFollowerCount, reporter.verifiedMuterCount AS verifiedMuterCount, reporter.verifiedReporterCount AS verifiedReporterCount`. **No server ORDER BY/LIMIT** — return the whole verified set (Story 3 sorts/paginates client-side, like follows).
- `$cutoff` from `getConfigFromFile('VERIFIED_REPORTERS_INFLUENCE_CUTOFF', 0.05)` — the **same** variable `calculateVerifiedReporterCounts.sh` uses (NOT the followers cutoff). This is the AC3 invariant; call it out in code.
- Same `isValidHexPubkey(observee)` → 400 (AC6), owner-only `observer` → 400, `NEO4J_QUERY_TIMEOUT_MS` deadline → 504 with `{success:false}`, `toInt`/`toFloat` parsing, and `{ success:true, observer:'owner', observee, count, data }` response shape (`count === data.length`, AC3/AC5; empty `data:[]` is a normal 200, not an error).
- Register in `src/api/index.js` next to the follows/followers routes: `app.get('/api/get-grapevine-reporters', handleGetGrapevineReporters)` + import.

**Frontend** — new `ui/src/hooks/useGrapevineReporters.js`, mirroring `useGrapevineFollows.js` (raw `fetch` + AbortController) against `/api/get-grapevine-reporters?observee=<pk>`. (The page that consumes it is Story 3 — not built here.)

## Out of scope
- The list page UI/route `/user/:pubkey/reporters` and the count→behavior — Story 3 / Story 1 (done).
- **Personalized / customer PoV** membership (the `NostrUserWotMetricsCard` traversal) — deferred, named follow-up (mirrors ADR 0026/0030).
- Splitting by NIP-56 report type (Phase 2); pile-on discounting (Phase 3).
- The DRY `<GrapevineList>` / shared-cypher refactor — the existing ADR 0030 follow-up, later.
- Fixing the verified-influence-cutoff inconsistency — existing intake item, untouched.
- Changing follows/followers endpoints or the `[:REPORTS]` ingestion.
