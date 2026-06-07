# ADR 0031: Profile Verified Followers/Reporters counts from Neo4j (Owner PoV)

**Status:** Accepted
**Date:** 2026-06-07
**Story:** `engineering-team/stories/profile/35-profile-verified-counts-owner-pov.md`
**Epic:** `profile`
**Supersedes (count-source only):** ADR 0029 (Verified Followers count) and ADR 0001 / `verified-reporters` (Verified Reporters count) — see §Supersession.

## Context

The profile's Verified Followers + Verified Reporters **count badges** read from Meilisearch `trustScores` (`wot_<metric>_<povSuffix>`). On staging this produced a wrong, mislabeled number: Jack's badge showed **26,711 "Verified Followers"** (his *raw* follower count) because `wot_verifiedFollowerCount_a1420e44` was absent and the code `verifiedFollowerCount ?? followers` fell back to raw `followers`; Verified Reporters showed **"—"** for the same reason. The list pages (`/followers`, `/reporters`) read **live Neo4j, Owner PoV** (`influence > VERIFIED_*_INFLUENCE_CUTOFF`) and showed the real numbers — so badge and table disagreed.

**This was foreseen.** ADR 0029 §Decision chose Meili (Option A) *with a documented Contingency*: "if Meili unexpectedly does **not** carry `wot_verifiedFollowerCount_<suffix>` / `wot_followers_<suffix>`, fall back to **Option C** (extend `get-user-counts`)." Its Option C was: "Add a Neo4j `verifiedFollowerCount` branch to `/api/get-user-counts` (today strfry-only)." The contingency's trigger has now been observed in production, so we activate it.

**Grounding (verified on this branch):**
- `ui/src/pages/BrainstormProfile.jsx` — VF/VR badges read `trustScores` (Meili, `/api/search/profiles/meili/document`, `povSuffix` = `?pov=` else House `delegatedPubkey`). The page **already** calls `useUserCounts(pubkey)` for the Following count.
- `src/api/export/users/queries/userdata.js:315` `handleGetUserCounts` — strfry-only, returns `{success, data:{pubkey, followingCount}}`. Its docstring: "this endpoint can grow a hybrid implementation: strfry for follow*, Neo4j for the WoT-derived counts."
- `handleGetUserData` (same file) returns node-property `verifiedFollowerCount`/`verifiedReporterCount` but is the **heavy** multi-count query (504s on dense nodes — it returned all-null for the reference profile during the smoke).
- The Owner-PoV source of truth: `NostrUser.verifiedFollowerCount` / `.verifiedReporterCount` node properties, set by `calculateVerified{Follower,Reporter}Counts.sh` = count of verified edges (`influence > VERIFIED_*_INFLUENCE_CUTOFF`, default 0.05) — the same definition the tables compute live.
- **PoV naming:** the `NostrUser` node property is the **Owner** PoV (the instance owner's GrapeRank crawl), not "House" (= kind 30382). ADR 0029 called the node property "House" loosely; per the three-PoV standard (`docs/POV_RESOLUTION_DESIGN_HANDOFF.md`) it is **Owner**.

Constraints: JS-without-build; honor the Neo4j deadline pattern; no concept/schema change (no firmware). Owner-PoV only — per-viewer PoV selection is the deferred three-PoV standard.

## Options considered

### Option A — Extend `get-user-counts` (hybrid) + read badges from `useUserCounts` *(chosen)*
Grow `handleGetUserCounts` into the hybrid its docstring anticipates (= ADR 0029's contingency Option C): keep strfry `followingCount`, **add Owner-PoV `verifiedFollowerCount` + `verifiedReporterCount` from Neo4j** — the `NostrUser` node property, with a **count-only live-cypher fallback** when the property is null. Surface both in `useUserCounts`; point the profile badges at `userCounts` and drop the Meili/`trustScores` source (and the `?? followers` raw fallback).
- **Pros:** one hook/endpoint already on the page serves all three counts; node-property read is **O(1)** (cheap even for Jack); Owner-PoV → badge and table share one definition; removes Meili *and* the raw-followers bug; unifies the three counts under one loading lifecycle (`userCountsLoading`), fixing ADR 0001's loading-parity note. It is the path ADR 0029 pre-authorized.
- **Cons:** `get-user-counts` becomes hybrid (strfry + a Neo4j read) — slightly more handler complexity; the live fallback on a dense node must be deadline-bounded.

### Option B — Reuse `get-user-data`
It already returns the node-property verified counts (PoV via `observerPubkey`).
- **Cons:** it's the **heavy** query — 504-prone on dense nodes (observed returning all-null for the reference profile). Sourcing a glanceable badge from it makes the profile as slow/fragile as `get-user-data`. Rejected.

### Option C — New dedicated count-only endpoint
A separate `/api/get-verified-counts`.
- **Cons:** a third counts fetch on the profile (Following via `get-user-counts`, this, plus `trustScores` for the Reputation grid). Extending the endpoint the page already calls (Option A) is less surface. Rejected.

## Decision
**Option A.** Activate ADR 0029's contingency: the verified-count badges become **Owner-PoV from Neo4j** via an extended `get-user-counts` — node property first (O(1)), count-only live fallback (deadline-bounded) when absent — read through the existing `useUserCounts` hook. Drop the Meili source and the `?? followers` fallback for the badges.

## Consequences
- **Fixes the bug:** no raw-follower substitution (a missing value → "—"); Verified Reporters now resolves to the Owner count instead of "—" when computed.
- **Badge ≡ table definition** (Owner PoV, same edge + `VERIFIED_*_INFLUENCE_CUTOFF`) → they agree in **steady state**. Residual drift is node-property(batch) vs table(live) — Neo4j-internal, small, the same class ADR 0002/0003 accepted (not a real-time guarantee).
- **All three counts share `useUserCounts`'s loading lifecycle** — resolves ADR 0001's non-blocking loading-parity note; the badges no longer ride `trustLoading`.
- **Meili still powers the Reputation grid** (rank, influence, etc.) — unchanged; only the two count badges leave Meili.
- **`get-user-counts` is now hybrid** (strfry following + a Neo4j node read). Still lightweight (O(1) node read); the live fallback is the only potentially-heavy path and is deadline-guarded.
- **Mega-account scale:** node-property read is O(1) for any node; the live count-only fallback on a dense node (e.g. Jack's inbound FOLLOWS) is bounded by `NEO4J_QUERY_TIMEOUT_MS` → "—" on timeout. No unbounded per-profile-view traversal.
- **Copy:** the `/reporters` PoV line changes from "House" to Owner wording (proposed "Relative to the owner's web of trust." — pending style-guide ratification under the three-PoV standard; engineering relabels the page, the product style guide catches up later — flagged, `product-team/` not edited here).
- **Firmware reinstall?** No.
- **Follow-up:** per-viewer PoV (House/Personalized) selection — the three-PoV standard (`docs/POV_RESOLUTION_DESIGN_HANDOFF.md`).

## Supersession
- **ADR 0029 (Verified Followers count):** supersedes its **count-source** decision (Meili `trustScores`) by invoking its own contingency (extend `get-user-counts`). Its *placement* decision (the count-link in `bsp-counts`) stands.
- **ADR 0001 (`verified-reporters`, Verified Reporters count):** supersedes its **count-source** (Meili `trustScores.verifiedReporterCount`). Its *negative-signal treatment, link, and display states* (>0 link / 0 neutral / "—" / loading) stand — only the value's origin and the PoV label change.
- ADR 0002 / 0003 (the membership endpoint + list page) are unaffected (already Owner-PoV Neo4j).

## Implementation notes
- **`src/api/export/users/queries/userdata.js` (`handleGetUserCounts`):** keep the strfry `followingCount` scan; add a Neo4j read returning `u.verifiedFollowerCount` / `u.verifiedReporterCount` for `MATCH (u:NostrUser {pubkey})`. When a property is null, run a **count-only** fallback bounded by `NEO4J_QUERY_TIMEOUT_MS`:
  - VF: `MATCH (f:NostrUser)-[:FOLLOWS]->(u:NostrUser {pubkey:$pubkey}) WHERE f.influence > $vfCutoff RETURN count(f)`.
  - VR: `MATCH (u:NostrUser {pubkey:$pubkey})<-[:REPORTS]-(r:NostrUser) WHERE r.influence > $vrCutoff RETURN count(r)`.
  - `$vfCutoff`/`$vrCutoff` from `getConfigFromFile('VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF'|'VERIFIED_REPORTERS_INFLUENCE_CUTOFF', 0.05)`. On timeout/error, return the field as `null` (→ "—"); never raw followers. Response: `{success, data:{pubkey, followingCount, verifiedFollowerCount, verifiedReporterCount}}`.
- **`ui/src/hooks/useUserCounts.js`:** surface `verifiedFollowerCount` + `verifiedReporterCount` from `data` (alongside `followingCount`).
- **`ui/src/pages/BrainstormProfile.jsx`:** VF badge reads `userCounts.verifiedFollowerCount` (remove `trustScores?.verifiedFollowerCount ?? trustScores?.followers`); VR badge reads `userCounts.verifiedReporterCount` (remove `trustScores?.verifiedReporterCount`) while keeping ADR 0001's >0-link / 0-neutral / "—" / negative-signal logic; both gate on `userCountsLoading`. Leave the Reputation grid on `trustScores` (Meili) untouched. `fmtCount(null)` → "—".
- **`ui/src/pages/BrainstormReporters.jsx`:** change the PoV line from the "House" string to the Owner wording.
- No change to the table endpoints, the Following source, or the Meili document fetch (Reputation grid).

## Out of scope
- Per-viewer PoV (House/Personalized) selection + the 3-way selector (three-PoV standard).
- The Meili / kind-30382 pipeline, the cutoff-inconsistency intake, the deploy-interrupts-batch ops bug.
- The duplicate `TRUST_METRICS` grid rows (existing intake).
- Editing `product-team/` (style guide copy ratification happens product-side).
