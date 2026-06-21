# Test Plan: Story 1 — Verified Muters read API (count + list)

**Story:** `engineering-team/stories/verified-muters/1-verified-muters-read-api.md`
**ADR:** `engineering-team/decisions/verified-muters/0001-verified-muters-read-api.md`
**Date:** 2026-06-21

## Scope and approach

This is a **backend** story: a new list endpoint `GET /api/get-grapevine-muters`
(handler `handleGetGrapevineMuters` in a new
`src/api/grapevineInteractions/queries/mutersWithMetrics.js`) plus a count gap
closed inside the existing `handleGetUserCounts` (`src/api/export/users/queries/userdata.js`).
Tests go in `test/` (Node's built-in runner), **not** Playwright.

The tests are **source-regex sentinels** — the exact established pattern of the two
sibling backend read-API suites the ADR mirrors:

- `test/verified-reporters-membership-data.test.js` (the LIST/membership suite for
  `reportersWithMetrics.js`), and
- `test/profile-verified-counts-owner-pov.test.js` (the COUNT suite that asserts the
  `handleGetUserCounts` body in `userdata.js`).

Why source-regex and not a live HTTP call: every sibling suite for these
`*WithMetrics` endpoints and for `handleGetUserCounts` is a source sentinel (the CJS
test harness cannot stand up the Express app + Neo4j driver in-process, and the
running Docker stack bind-mounts the *shared* checkout — see MEMORY). Asserting the
contract at source is how this codebase pins these endpoints, and it lets the suite
**fail because the feature is missing** (the new file does not exist; the count
branch is absent) rather than because of an unreachable port. **No heavy /
`neo4j-heavy` task, no `reconcileAll`, no graph mutation is triggered** — the suite
only reads source files off disk.

Each sentinel targets a string/identifier that does **not** exist anywhere in the tree
pre-implementation (`handleGetGrapevineMuters`, `mutersWithMetrics.js`,
`/api/get-grapevine-muters`, the `verifiedMuterCount` branch *inside the
`handleGetUserCounts` slice*), so the false-positive risk noted in the siblings is
avoided. `verifiedMuterCount` already appears in `followsWithMetrics.js` /
`followersWithMetrics.js` / `reportersWithMetrics.js` RETURN clauses (each row already
surfaces the muter *column*) and in `handleGetUserData` (the *other* handler in
`userdata.js`) — so the count assertion is scoped to the sliced `handleGetUserCounts`
function body, and the list assertions are scoped to the new `mutersWithMetrics.js`
file, never to the siblings.

## Coverage map

Each acceptance criterion maps to at least one test in
`test/verified-muters-read-api.test.js`.

| Criterion | Test name | Level |
|---|---|---|
| **AC1** — count read path includes `verifiedMuterCount` beside the sibling counts, under the muter cutoff | `T11` (`handleGetUserCounts` returns `verifiedMuterCount` beside the two siblings), `T12` (it reads from Neo4j `NostrUser`, not Meili), `T13` (count-only `[:MUTES]` live fallback uses `VERIFIED_MUTERS_INFLUENCE_CUTOFF`, deadline-bounded), `T14` (`verifiedMuterCount` is in the response payload object) | integration (source) |
| **AC2** — list returns verified muters with the **Verified Followers row shape**, no report-specific fields | `T1` (handler exists + exported), `T3` (Cypher traverses inbound `[:MUTES]` with an `influence >` filter), `T5` (rows carry the six follower-shape columns), `T10` (**no** `report_type`/`reportType`/`timestamp` field — the muter row is NOT the reporter row) | integration (source) |
| **AC3** — list length equals the muter count under the same POV (count === data.length within the read path) | `T4` (cutoff is `VERIFIED_MUTERS_INFLUENCE_CUTOFF`, the same var the count algo writes with — **not** the follower/reporter cutoff; and `count: data.length`) | integration (source) |
| **AC4** — empty result is a normal success; missing/malformed id → clear error, not a crash or silent empty | `T2` (missing/invalid `observee` → 400 with hex validation), `T7` (success shape built from `result.records.map`, so zero muters yields `data:[] count:0` as a 200 — empty is success, not error) | integration (source) |
| **AC5** — non-owner / non-House observer is refused (owner/House-POV-only, like the siblings) | `T6` (a non-owner `observer` → 400, owner-only) | integration (source) |

Supporting / contract sentinels (still tied to ACs, not implementation-detail probes):

| Test | Purpose |
|---|---|
| `T8` | The `NEO4J_QUERY_TIMEOUT_MS` deadline → `504 {success:false}` branch — the same error discipline AC4 says the siblings enforce. |
| `T9` | `GET /api/get-grapevine-muters` is registered in `src/api/index.js` → `handleGetGrapevineMuters` (the endpoint is reachable). |

## Edge cases (explicitly covered)

- [x] **Empty verified-muter set is a normal 200**, not an error — `T7` (data built by `.map` over `result.records`; zero rows → `data:[]`, `count:0`).
- [x] **Missing / malformed account id → 400**, not a crash and not a silent empty success — `T2` (hex validation + `.status(400)`).
- [x] **Non-owner observer → refused (400)** — `T6` (owner/House-POV only in v1).
- [x] **count === list length within the read path** — `T4` (`count: data.length`) anchored to the **muter** cutoff so it is the literal inverse of the count computation; this is asserted as a real contract on the new handler, never as a trivially-true `0 === 0`.
- [x] **Row shape has NO report-specific fields** — `T10` (no `report_type` / `reportType` / `timestamp` in `mutersWithMetrics.js`; muters mirror Followers, not Reporters). Guards the central story framing.
- [x] **Wrong-cutoff copy-paste guard** — `T4` asserts the handler does **not** use `VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF` / `VERIFIED_REPORTERS_INFLUENCE_CUTOFF` (which would silently break AC3).
- [x] **Query-timeout degradation** — `T8` (504 on `NEO4J_QUERY_TIMEOUT_MS`), the deadline pattern AC4's error behavior inherits from the siblings.

## Regression sentinels (must PASS before AND after implementation)

These guard the explicit "no change to the siblings" out-of-scope items in the story/ADR.
They PASS now and must keep passing — they are **not** the newly-failing tests.

- `R1` — the follows endpoint is untouched (`followsWithMetrics.js` still exports `handleGetGrapevineFollows` over `[:FOLLOWS]`).
- `R2` — the reporters endpoint is untouched (`reportersWithMetrics.js` still exports `handleGetGrapevineReporters` over `[:REPORTS]`).
- `R3` — `handleGetUserCounts` still returns `followingCount` from the strfry kind-3 scan, and still returns `verifiedFollowerCount` + `verifiedReporterCount` (the muter branch is *added beside* them, not in place of them).
- `R4` — the shared `cypherQueries.js` `verifiedMuters` registry entry and the generic `/api/get-grapevine-interaction` route are left untouched (ADR: a reviewer should not expect them removed/rewired). The route registration remains.

## Test infrastructure

- Test framework: Node built-in runner via `npm test` (entry `test/test.js`). The new
  suite `test/verified-muters-read-api.test.js` exports `{ run }` and is registered in
  `test/test.js` (one `require` line + the mechanical `.run()` invocation/banner and
  `overallOk` term every sibling suite has).
- **No running services required.** The suite reads source files off disk; it does not
  hit `localhost:8877`, Neo4j, strfry, or Redis, and triggers no task. (The
  source-regex precedent of the sibling backend suites.)
- Firmware state: **none** — ADR §Consequences: "Firmware reinstall required? No."
  No concept definitions or schemas change.
- Fixtures: none.

## How to run

```
npm test
```

(The full Node suite runs; the new suite prints under the
`verified-muters-read-api suite:` banner.)

## Verification

The new tests fail with the current code, for the right reason: the feature is missing.

- `mutersWithMetrics.js` / `handleGetGrapevineMuters` / the `/api/get-grapevine-muters`
  route do **not** exist (`safeRead` returns `''` → the handler sentinels T1–T10
  fail with a descriptive "does not exist yet" message), and
- `handleGetUserCounts` returns `{ pubkey, followingCount, verifiedFollowerCount,
  verifiedReporterCount }` with **no** `verifiedMuterCount` and **no** `[:MUTES]`
  branch (the count sentinels T11–T14 fail).

The regression sentinels R1–R4 pass now (the siblings + the shared route are present
and untouched), confirming the failures are about the *missing muter feature*, not a
broken harness.

Confirmed on 2026-06-21 (pre-implementation, before the per-phase commit). The
new suite is the ONLY newly-failing suite (the other `FAIL` suites — tag / pin / TL /
publish — fail for pre-existing, unrelated reasons: strfry-router FATAL + no POV in
this environment, untouched here). All verified-* sibling suites still PASS.

Suite-level summary line:

```
verified-muters-read-api suite:                  FAIL (4 passed, 14 failed)
```

Per-test output (T1–T14 fail because the feature is missing; R1–R4 pass):

```
verified-muters-read-api suite:
  ✗ T1: mutersWithMetrics.js exists and exports handleGetGrapevineMuters (ADR 0001 §Impl)
      src/api/grapevineInteractions/queries/mutersWithMetrics.js does not exist yet — the Implementer must create the new endpoint handler (ADR 0001 Option A: a new standalone module mirroring followersWithMetrics.js).
  ✗ T2: handler requires + 64-hex-validates `observee`, returning 400 otherwise (AC4)
      mutersWithMetrics.js does not exist yet.
  ✗ T3: handler Cypher traverses the inbound :MUTES edge with a verified-influence filter (AC2)
      mutersWithMetrics.js does not exist yet.
  ✗ T4: the verified filter uses VERIFIED_MUTERS_INFLUENCE_CUTOFF (not the follower/reporter cutoff) and the response count is data.length (AC3)
      mutersWithMetrics.js does not exist yet.
  ✗ T5: success rows carry the SAME six columns as the Verified Followers list (identity + Rank/credibility metric) (AC2)
      mutersWithMetrics.js does not exist yet.
  ✗ T6: a non-owner `observer` is rejected with 400 — owner/House PoV only in v1 (AC5)
      mutersWithMetrics.js does not exist yet.
  ✗ T7: success response shape is {success, observer:'owner', observee, count, data}; an empty muter set is a normal 200 (AC4)
      mutersWithMetrics.js does not exist yet.
  ✗ T8: handler enforces the Neo4j deadline (NEO4J_QUERY_TIMEOUT_MS) with a 504 {success:false} branch (ADR §Impl, mirrors followers)
      mutersWithMetrics.js does not exist yet.
  ✗ T9: GET /api/get-grapevine-muters is registered in src/api/index.js → handleGetGrapevineMuters (endpoint reachable)
      src/api/index.js must register the route '/api/get-grapevine-muters' (alongside the follows/followers/reporters routes).
  ✗ T10: the muters row carries NO report-specific fields — it mirrors Verified Followers, not Verified Reporters (AC2)
      mutersWithMetrics.js does not exist yet.
  ✗ T11: handleGetUserCounts returns verifiedMuterCount beside verifiedFollowerCount + verifiedReporterCount (AC1)
      handleGetUserCounts must compute + return verifiedMuterCount (pre-implementation it returns only followingCount + verifiedFollowerCount + verifiedReporterCount — the muter count is omitted).
  ✗ T12: the verified-muter count is read from the Neo4j NostrUser node, not Meili (AC1)
      the muter count must come from the Owner-PoV NostrUser node property (e.g. u.verifiedMuterCount) — the same source the siblings use, computed under the muter verification bar (AC1).
  ✗ T13: the muter count has a count-only [:MUTES] live fallback under VERIFIED_MUTERS_INFLUENCE_CUTOFF, deadline-bounded (AC1)
      the count-only live fallback (used when the node property is null) must traverse the :MUTES edge — mirroring the [:FOLLOWS]/[:REPORTS] fallbacks already present for the siblings.
  ✗ T14: verifiedMuterCount is included in the handleGetUserCounts response payload (AC1)
      the response `data` object must include verifiedMuterCount (e.g. data: { pubkey, followingCount, verifiedFollowerCount, verifiedMuterCount, verifiedReporterCount }) so it reaches the profile counts row alongside its siblings (AC1).
  ✓ R1: the follows endpoint is untouched — followsWithMetrics.js still exports handleGetGrapevineFollows over :FOLLOWS (regression)
  ✓ R2: the reporters endpoint is untouched — reportersWithMetrics.js still exports handleGetGrapevineReporters over :REPORTS (regression)
  ✓ R3: handleGetUserCounts still returns followingCount (strfry) + the two existing verified counts — the muter branch is ADDED beside them (regression)
  ✓ R4: the existing grapevine routes remain registered — the shared get-grapevine-interaction route is untouched (regression)
```
