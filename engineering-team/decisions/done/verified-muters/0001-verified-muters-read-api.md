# ADR 0001: Verified Muters read API (count + list)

**Status:** Proposed
**Date:** 2026-06-21
**Story:** `engineering-team/stories/verified-muters/1-verified-muters-read-api.md`
**Epic:** `verified-muters`

## Context

The profile already surfaces a *verified-follower* count and a *verified-reporter* count via `handleGetUserCounts`, each backed by a list read path that returns exactly who those users are. There is no equivalent for *muting*. This story (backend only — Story 2 is the UI) closes that gap by mirroring **Verified Followers** (not Verified Reporters): same verification bar, same row shape, no report-specific fields.

### Acceptance criteria (quoted back from the story)

1. The profile-counts read path includes a **verified-muter count** alongside the existing verified-follower and verified-reporter counts (no longer omitted), under the **same verification bar** — the GrapeRank cutoff for muters — that defines "verified" for the siblings.
2. The verified-muters **list** read path returns the users who have muted the account **and** clear the verification bar; non-clearing users are excluded; each row carries the **same shape as the Verified Followers list** (identity + Rank/credibility metric) with **no** report-specific fields.
3. The size of the verified-muters list **equals** the verified-muter count served for that account under the same point of view (list length and count agree).
4. No verified muters → a normal, successful **empty** result (not an error); a missing/malformed account identifier → a clear **error** response (not a crash, not a silent empty success).
5. A non-owner / non-House observer is **refused** — the same owner/House-POV-only restriction the verified-follower and verified-reporter list read paths enforce.

### The data layer already exists end-to-end (verified on this branch)

This is a surfacing/wiring feature, not a pipeline build. Confirmed:

- **Edge:** kind-10000 mute lists are ingested and projected into Neo4j as a first-class `(muter:NostrUser)-[:MUTES]->(mutee:NostrUser)` relationship — symmetric with `:FOLLOWS` (kind 3) and `:REPORTS` (kind 1984).
- **Precomputed count:** `src/algos/follows-mutes-reports/calculateVerifiedMuterCounts.sh` writes `NostrUser.verifiedMuterCount` = count of inbound `:MUTES` edges whose muter's `influence > VERIFIED_MUTERS_INFLUENCE_CUTOFF` (default `0.05`). This is the exact analogue of `calculateVerifiedReporterCounts.sh` (see `verified-reporters` ADR 0002 §Context). The property is already selected and returned by `handleGetUserData` in `userdata.js:155,239`.
- **Cutoff knob:** `VERIFIED_MUTERS_INFLUENCE_CUTOFF` is already read in `cypherQueries.js:11` (`getConfigFromFile('VERIFIED_MUTERS_INFLUENCE_CUTOFF', '0.05')`).
- **A `verifiedMuters` Cypher already exists** in `cypherQueries.js:78-88`: `MATCH (observee:NostrUser {pubkey:$observee}) OPTIONAL MATCH (muter)-[:MUTES]->(observee) WHERE muter.influence > VERIFIED_MUTERS_INFLUENCE_CUTOFF RETURN muter.{pubkey,hops,influence}`.

### Concepts touched (Concept Graph orientation done first)

Per the three-call pattern (`/summaries` → `/node/<handle>/neighbors`), the story's named concepts —
`39998:…:web-of-trust`, `39998:…:graperank`, `39998:…:nostr-user` — resolve to **abstract concept-graph definitions** (class-thread / superset / schema nodes), not runtime data. The muter edge, the `verifiedMuterCount` property, and the influence cutoff are **runtime Neo4j node/edge properties**, not concept-graph nodes. **No concept definition or schema changes.** This matches `verified-reporters` ADR 0002 §Context ("Concept Graph API not consulted for runtime Neo4j properties — these are node properties, not graph-concept nodes").

### The decision this ADR must make

There are **two** detail-query patterns in the tree, and one of them already names "verifiedMuters" — so the wiring is not self-evident:

- **Standalone `*WithMetrics.js` modules** (`followersWithMetrics.js`, `reportersWithMetrics.js`), each a dedicated handler registered in `src/api/index.js`. These do hex validation → 400, owner-only `observer` → 400, a `NEO4J_QUERY_TIMEOUT_MS` deadline → 504, and return the **full row shape** (`pubkey, influence, hops, verifiedFollowerCount, verifiedMuterCount, verifiedReporterCount`).
- **The `cypherQueries.js` interaction-type registry**, served by the single generic `handleGetGrapevineInteraction` (`GET /api/get-grapevine-interaction?interactionType=verifiedMuters`). I read this handler (`grapevineInteractions/queries/index.js`). It returns **only `{pubkey, hops, influence}`** (`index.js:66-71`), has **no** owner-POV gate (it requires an `observer` param but does not restrict it to the owner), **no** `NEO4J_QUERY_TIMEOUT_MS`/504 deadline, and **no** hex-pubkey validation.

So although the registry already *has* a `verifiedMuters` entry, the route that serves it cannot satisfy AC2 (Verified-Followers row shape — it drops the three `verified*Count` columns) or AC5 (owner/House-only refusal). The standalone module pattern satisfies all five ACs by construction. Followers is the closer template than Reporters: muters, like followers and unlike reporters, have **no per-edge sub-type/timestamp** (`reportersWithMetrics.js` binds `rel.report_type`/`rel.timestamp`; there is nothing analogous on a `:MUTES` edge — and AC2 explicitly forbids report-specific fields).

Constraints: JS-without-build (no new lint/typecheck/build tooling); honor the Neo4j deadline → 504 pattern (story #5 / ADRs 0024-0025); reuse the existing cutoff var that the count algo uses (the count = list-length invariant); no concept/firmware change.

## Options considered

### Option A — New standalone `mutersWithMetrics.js` module, mirroring `followersWithMetrics.js` *(chosen)*

A new handler `handleGetGrapevineMuters` in `src/api/grapevineInteractions/queries/mutersWithMetrics.js`, registered as `GET /api/get-grapevine-muters` next to its siblings in `src/api/index.js`. It is a near-copy of `followersWithMetrics.js` with the edge reversed to `:MUTES` and the cutoff switched to `VERIFIED_MUTERS_INFLUENCE_CUTOFF`:

```cypher
MATCH (muter:NostrUser)-[:MUTES]->(observee:NostrUser {pubkey: $observee})
WHERE muter.influence > $cutoff
RETURN muter.pubkey AS pubkey,
       muter.influence AS influence,
       muter.hops AS hops,
       muter.verifiedFollowerCount AS verifiedFollowerCount,
       muter.verifiedMuterCount AS verifiedMuterCount,
       muter.verifiedReporterCount AS verifiedReporterCount
```

The count gap is closed **in the same `handleGetUserCounts` handler that already serves the two sibling counts** (`userdata.js`), adding a `verifiedMuterCount` branch beside `verifiedFollowerCount`/`verifiedReporterCount` — node property first (O(1)), count-only `:MUTES` live fallback (deadline-bounded → `null` on timeout/error), exactly mirroring the existing two branches per ADR 0031.

- **Pros:**
  - Satisfies **all five ACs by construction**: AC2 (identical row shape to the Verified Followers list — same six `RETURN` columns, no report fields), AC5 (owner-only `observer` → 400, like both siblings), AC4 (hex validation → 400; empty `data:[]` is a normal 200), AC1 (the count joins the sibling counts in the one handler the profile already calls), AC3 (the list is the literal inverse of the count computation — same `:MUTES` edge, same `VERIFIED_MUTERS_INFLUENCE_CUTOFF`, so `count === data.length` within the read path).
  - **Zero regression risk** to the live Follows/Followers/Reporters endpoints and to the shared `get-grapevine-interaction` registry route (untouched) — the isolation precedent of ADR 0026 / 0030 / `verified-reporters` 0002.
  - Followers is the exact template (no per-edge sub-type to handle); the diff is mechanical and reviewable.
- **Cons:**
  - A **fourth** near-duplicate module/handler. Mitigated: this is the standing DRY follow-up (ADR 0030's `<GrapevineList>` + shared cypher builder) that should later absorb follows/followers/reporters/muters together — explicitly out of scope here, same as its siblings deferred it.
  - Leaves the `cypherQueries.js` `verifiedMuters` entry as a second, thinner code path for the same concept. Acceptable: it predates this work, is shape-incompatible with the list contract, and is left untouched (no behavior change).

### Option B — Serve the list from the existing `cypherQueries.js` `verifiedMuters` registry entry

Wire the list read path to the already-present `verifiedMuters` interaction type via `GET /api/get-grapevine-interaction?interactionType=verifiedMuters`, reusing the entry that exists at `cypherQueries.js:78-88`.

- **Pros:** No new module; reuses an entry that is already written and already applies the muter cutoff; superficially the most DRY.
- **Cons (disqualifying for this story):**
  - **Wrong row shape (fails AC2).** `handleGetGrapevineInteraction` returns only `{pubkey, hops, influence}` — it drops `verifiedFollowerCount`/`verifiedMuterCount`/`verifiedReporterCount`, which the Verified Followers list row carries. Matching the Followers shape would require editing the shared generic handler (and the registry `RETURN` clause), i.e. changing a route used by every other interaction type — regression risk on shared code, the exact thing ADR 0026/0030/0002 chose isolation to avoid.
  - **No owner/House gate (fails AC5).** The handler requires an `observer` param but never restricts it to the owner; adding owner-only refusal would, again, mean editing shared multi-consumer code.
  - **No deadline/504 and no hex validation** — diverges from the sibling read-path contract (AC4's error behavior; the story asks for the *same* restriction and error discipline the siblings enforce).
  - Would not produce a read path that is the inverse-shape twin of the Verified Followers list — the story's central framing ("the muter analogue of the existing verified-follower list read path").
- Rejected: it cannot meet AC2/AC5 without modifying shared, multi-consumer code, which is more risk and more change than Option A, for a worse result.

### Option C — Generalize one endpoint over an interaction-type / direction param (follows + followers + reporters + muters)

Collapse the standalone modules into one parameterized handler now.

- **Pros:** the genuinely DRY end state.
- **Cons:** edits live, prod-shipped handlers (Follows is on prod) — regression risk; ADR 0026/0030/0002 each explicitly deferred this. This is the *follow-up* refactor, not this story's job. Rejected for v1 for the same reason the siblings rejected it.

## Decision

**Option A.** Add a new standalone `mutersWithMetrics.js` module (`GET /api/get-grapevine-muters`, `handleGetGrapevineMuters`) mirroring `followersWithMetrics.js` with the `:MUTES` edge and the `VERIFIED_MUTERS_INFLUENCE_CUTOFF` cutoff, and close the count gap inside the existing `handleGetUserCounts` by adding a `verifiedMuterCount` branch beside the two sibling counts (node property first, deadline-bounded `:MUTES` count-only fallback → `null`).

Owner/House-POV only in v1, matching the siblings (POV-first invariant: "verified" is computed from the owner's GrapeRank vantage; a non-owner `observer` is refused 400 rather than served a wrong-POV answer). The verified set is filtered **at view time** by re-applying `influence > cutoff` on read (the precomputed property is an O(1) shortcut for the badge, not a denormalized per-POV result) — honoring "filter at view time, not write time." The chosen cutoff var is the **same** one the count algo writes with, which is what makes AC3 hold.

We accept a fourth near-duplicate handler as the price (as the siblings accepted duplication) and leave the DRY `<GrapevineList>`/shared-cypher-builder refactor as the standing follow-up; the `cypherQueries.js` `verifiedMuters` entry and the shared registry route are left untouched.

## Consequences

- **Enables** Story 2 (the badge, the list page, the line break) with a count that joins its two siblings in one response and a list whose `count === data.length` by construction.
- **AC3 is exact within the read path** (`count === data.length`) and holds at owner PoV against the count algo (same `:MUTES` edge + same `VERIFIED_MUTERS_INFLUENCE_CUTOFF`). As the siblings document (ADR 0002 §Consequences, ADR 0030 §Consequences), it is **not** a hard real-time guarantee versus any separately-precomputed value (node-property batch vs. live query can transiently skew across a refresh). Tests must not assert real-time equality across distinct data sources — only within a single read path. This matches the story's own non-blocking "Open questions" note.
- **Owner/House PoV only.** Per-POV/customer muter counts (the `NostrUserWotMetricsCard` traversal) are deferred — the same named follow-up the follower/reporter detail endpoints already carry.
- **Duplication → the standing DRY follow-up.** A fourth `*WithMetrics.js` module joins follows/followers/reporters; the `<GrapevineList>` + shared-cypher-builder refactor (ADR 0030's follow-up) should later absorb all four. Not bundled here.
- **The `cypherQueries.js` `verifiedMuters` entry remains a second, thinner path** for the same concept (returns only `{pubkey,hops,influence}`, no owner gate). It is left as-is; a reviewer should not expect it to be removed or rewired by this story.
- **Mega-account scale:** the count's node-property read is O(1); its live `:MUTES` count-only fallback and the list traversal are bounded by `NEO4J_QUERY_TIMEOUT_MS` → 504 (list) / `null` → "—" (count) on timeout. Verified-muter sets are expected small (being muted by *trusted* users is rare — the feature's premise), so ADR 0030's mega-account inbound-traversal worry barely applies here; no new unbounded traversal is introduced.
- **Cutoff inconsistency** (the existing 0.01/0.05/"score>2" intake item) is inherited, not fixed here — but using the *same* `VERIFIED_MUTERS_INFLUENCE_CUTOFF` as the count algo is precisely what makes AC3 hold.
- **Firmware reinstall required?** **No.** No concept definitions or schemas change — only runtime Neo4j reads. (`POST /api/firmware/install` is not needed.)

## Implementation notes

The Implementer reads this; specifics below.

**Backend — list endpoint (new):**

- New file `src/api/grapevineInteractions/queries/mutersWithMetrics.js` exporting `handleGetGrapevineMuters(req, res)` — a near-copy of `followersWithMetrics.js`. Keep its `toInt`/`toFloat`/`isValidHexPubkey` helpers, the `observee` validation → 400 (AC4), the owner-only `observer` → 400 (AC5; `getConfigFromFile('BRAINSTORM_OWNER_PUBKEY', '')`, accept `'owner'` or the owner pubkey), the `NEO4J_QUERY_TIMEOUT_MS` deadline → 504, and the `{ success, observer:'owner', observee, count, data }` response (`count === data.length`; empty `data:[]` is a normal 200, AC4).
- The Cypher is the inverse-`:MUTES` analogue (see Option A code block). **No server ORDER BY/LIMIT** — return the whole verified set (Story 2 sorts/paginates client-side, like Followers).
- The cutoff MUST be `getConfigFromFile('VERIFIED_MUTERS_INFLUENCE_CUTOFF', 0.05)` — **not** the followers or reporters cutoff. Pass it as a `$cutoff` parameter (as `reportersWithMetrics.js` does) and annotate that this is the AC3 invariant. Note `followersWithMetrics.js` interpolates its cutoff into the query string while `reportersWithMetrics.js` binds `$cutoff`; prefer the **bound `$cutoff`** form (reporters) — it is the safer of the two sibling shapes.
- Register in `src/api/index.js`: import `handleGetGrapevineMuters` (next to the other three `grapevineInteractions/queries/*WithMetrics` imports at lines 32-34) and `app.get('/api/get-grapevine-muters', handleGetGrapevineMuters)` next to the sibling routes at lines 341-345.

**Backend — count gap (extend existing handler):**

- `src/api/export/users/queries/userdata.js`, `handleGetUserCounts`: add a third verified-count branch for `verifiedMuterCount`, mirroring the existing `verifiedFollowerCount`/`verifiedReporterCount` logic exactly (ADR 0031 pattern):
  - In the precomputed-property read at `userdata.js:371-379`, also select `u.verifiedMuterCount AS vmc` and assign it.
  - Add a count-only live fallback when the property is null (mirroring the VR fallback at `:395-407`), deadline-bounded by `NEO4J_QUERY_TIMEOUT_MS`, with cutoff `getConfigFromFile('VERIFIED_MUTERS_INFLUENCE_CUTOFF', 0.05)`:
    `MATCH (m:NostrUser)-[:MUTES]->(u:NostrUser {pubkey: $pubkey}) WHERE m.influence > $cutoff RETURN count(m) AS c`.
    On timeout/error → `verifiedMuterCount = null` (renders "—"); never substitute a raw or other-metric value.
  - Add `verifiedMuterCount` to the response payload at `userdata.js:418` → `data: { pubkey, followingCount, verifiedFollowerCount, verifiedMuterCount, verifiedReporterCount }`.

**Not built here (Story 2):** `useGrapevineMuters` hook, the `BrainstormMuters` list page + route, the counts-row badge, and the line break. `handleGetUserData` already returns `verifiedMuterCount` and is **not** touched.

## Out of scope

- All frontend — the counts-row badge, the list page/route, the line break (Story 2).
- **Personalized/customer PoV** muter counts (the `NostrUserWotMetricsCard` traversal) — deferred, same named follow-up as follows/followers/reporters.
- The **DRY `<GrapevineList>` / shared-cypher-builder** refactor (ADR 0030's standing follow-up) — should later absorb all four `*WithMetrics` modules; not bundled here.
- Rewiring or removing the `cypherQueries.js` `verifiedMuters` entry or the shared `get-grapevine-interaction` route — left untouched.
- Any change to mute ingestion, the `:MUTES` projection, the `calculateVerifiedMuterCounts.sh` precompute, or graperank config — all consumed as-is.
- Fixing the verified-influence-cutoff inconsistency (0.01 vs 0.05 vs "score>2") — existing intake item, untouched.
- Any muter alarm threshold / red-flag styling — the metric is neutral, like Verified Followers.
