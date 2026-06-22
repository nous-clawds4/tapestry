# Review: Story 1 — Verified Muters read API (count + list)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-21
**Diff:** `git show 7ea9cf4a` (commit `7ea9cf4a0e589ab6958b6f81353fdc1e116fd5c4`, branch `feat/verified-muters`)
**Files reviewed:** `src/api/grapevineInteractions/queries/mutersWithMetrics.js` (new), `src/api/index.js`, `src/api/export/users/queries/userdata.js`

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **ran it myself.** New suite: `verified-muters-read-api suite: PASS (18 passed, 0 failed)`. Overall line is `FAIL`, driven by 8 pre-existing tag/pin/TL/publish/profile-tag suites that fail for unrelated environment reasons (strfry-router FATAL + un-configured POV). Confirmed none of those 8 suites reference the changed code (`mutersWithMetrics` / `get-grapevine-muters` / `handleGetUserCounts` / `verifiedMuterCount`), and every verified-* sibling suite is green (`profile-verified-followers-count` PASS, `profile-verified-reporters-count` PASS, `verified-reporters-membership-data` PASS, `verified-reporters-list-page` PASS, `profile-verified-counts-owner-pov` PASS). No previously-green suite went red.
- [x] `npm run test:playwright` — **not applicable.** Backend-only change (no UI; frontend is explicitly Story 2). Skipped per scope.
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped._

### Verbatim new-suite result
```
verified-muters-read-api suite:                  PASS (18 passed, 0 failed)
```
(T1–T14 feature sentinels + R1–R4 regression sentinels all pass.)

## Spec adherence — all 5 ACs satisfied

- [x] **AC1 (count joins the siblings under the muter bar).** `handleGetUserCounts` adds a third `verifiedMuterCount` branch beside follower/reporter: node-property-first read (`userdata.js:374` selects `u.verifiedMuterCount AS vmc`, assigned `:380`); count-only `:MUTES` live fallback `userdata.js:398-410` using `vmCutoff = VERIFIED_MUTERS_INFLUENCE_CUTOFF` (`:360`); field added to the response payload `userdata.js:434`. Covered by T11–T14 (PASS).
- [x] **AC2 (Verified-Followers row shape, no reporter fields).** New handler's Cypher returns exactly the six follower columns (`mutersWithMetrics.js:111-118`): `pubkey, influence, hops, verifiedFollowerCount, verifiedMuterCount, verifiedReporterCount` — identical to `followersWithMetrics.js:96-101`, and *no* `report_type`/`timestamp` (unlike `reportersWithMetrics.js:108-109`). Covered by T5 + T10 (PASS).
- [x] **AC3 (count === list length).** Response `count: data.length` (`mutersWithMetrics.js:142`); the verified filter is the *same* `VERIFIED_MUTERS_INFLUENCE_CUTOFF` the count algo writes with (`:99`), over the same inbound `:MUTES` edge (`:106`) — the literal inverse of the count. Covered by T4 (PASS).
- [x] **AC4 (empty = 200; malformed id = clear 400).** `observee` hex-validated → 400 (`:60-64`) plus nip19 round-trip guard → 400 (`:66-72`); success body is built by `.map` over `result.records` (`:121`), so zero muters yields `data:[] count:0` as a 200. Covered by T2 + T7 (PASS).
- [x] **AC5 (non-owner refused).** Owner-only `observer` gate → 400 (`:78-83`), identical to the follower/reporter siblings. Covered by T6 (PASS).

No criterion silently dropped; no behavior added beyond the story.

## ADR adherence — Option A followed exactly

- [x] **Standalone module mirroring followers** (Option A, not the `cypherQueries.js` registry path). New `mutersWithMetrics.js` is a near-copy of `followersWithMetrics.js` with the edge reversed to `:MUTES`.
- [x] **Bound `$cutoff` = `VERIFIED_MUTERS_INFLUENCE_CUTOFF`** — the ADR's explicit instruction to prefer the *bound* reporters form over the followers' string-interpolated form. List query: `parseFloat(getConfigFromFile('VERIFIED_MUTERS_INFLUENCE_CUTOFF', 0.05))` (`:99`), passed as `{ observee, cutoff }` (`:120`); `WHERE muter.influence > $cutoff` (`:107`). **Not** the follower/reporter cutoff (T4 copy-paste guards pass).
- [x] **Six-column row shape** — matches the ADR Option A code block exactly (`:111-118`).
- [x] **Owner-only → 400** (`:78-83`); **hex → 400** (`:60-64`); **`NEO4J_QUERY_TIMEOUT_MS` → 504** (`:95`, `:131-138` with `success:false`); **`count === data.length`** (`:142`).
- [x] **Count branch added in `handleGetUserCounts` only.** `handleGetUserData` is **untouched** — confirmed absent from the diff; it already returned `verifiedMuterCount` before this story (the slice-scoped T11–T14 prove the count sentinels hit `handleGetUserCounts`, not its sibling).
- [x] **Route registered** in `src/api/index.js` — import `:35`, `app.get('/api/get-grapevine-muters', ...)` `:347-348`, both placed beside the sibling routes as the ADR directed.

No deviation from the ADR. No new dependencies (`neo4j-driver`, `nostr-tools`, `utils/config` are all already in use by the siblings).

## Concept-graph integrity

- [x] No concept handles introduced or changed — this is a runtime Neo4j read (node properties + `:MUTES` edge), not a concept-graph node. ADR §Consequences: "Firmware reinstall required? No."
- [x] **No firmware reinstall needed** — no concept definitions or schemas changed. Correctly called out as not required.
- [x] New code does not re-derive from BIBLE.md; it mirrors the established sibling read-path pattern.

## Things tests can't catch

- [x] **No secrets** committed. Neo4j creds come from `getConfigFromFile` (`:90-92`), as in every sibling.
- [x] **No hardcoded TA pubkey.** Scanned the new file for any 64-hex literal / `82b75e47…` — none. The only pubkey is the runtime `observee` query param. House rule respected.
- [x] **Security / injection: Cypher is fully parameterized.** Both queries bind values — list: `session.run(cypherQuery, { observee, cutoff }, ...)` (`:120`); count fallback: `{ pubkey, cutoff: vmCutoff }` (`userdata.js:402`). No user input is string-concatenated into Cypher. `$cutoff` is config-sourced (not user input) and bound; `$observee` is the validated hex param, bound. This is the safer bound form the ADR required.
- [x] **Input validation at the boundary** — `observee` is hex-validated *and* nip19-round-trip-checked before any DB call (`:60-72`).
- [x] **Error handling** — `try/catch` wraps the synchronous body (`:51`/`:152-155`); the promise has `.catch` distinguishing 504 (timeout) from 500 (other) (`:130-150`); `.finally` closes session + driver (`:151-154`), so no leaked connections on any path. The count fallback wraps each branch in its own `try/catch` → `null` on failure (`:406-409`), matching the sibling discipline ("never substitute a raw/other-metric value").
- [x] **No leftover debug / `console.log`.** The only `console.*` calls are `console.error` on genuine error paths, identical to the siblings — appropriate, not debug noise.
- [x] **No commented-out code.** Comments are explanatory and accurate.
- [x] **Concurrency / races** — each request opens and closes its own driver+session (matches siblings); no shared mutable state. Module-load config reads are read-once like the siblings. No new race surface.

## House rules check

- [x] Concept Graph API authority respected (no concept change; runtime properties only).
- [x] No new lint/typecheck/build tooling. No new dependencies. JS-without-build preserved.
- [x] Per-deployment TA pubkey rule respected (no literal anywhere in the diff).

## Scope-creep sweep

- [x] Exactly the 3 ADR-scoped files changed (`mutersWithMetrics.js`, `index.js`, `userdata.js`). No frontend, no per-POV/customer path, no alarm/red-flag styling.
- [x] `cypherQueries.js` `verifiedMuters` registry entry and the shared `/api/get-grapevine-interaction` route **untouched** (not in the diff) — as the ADR required (R4 passes).
- [x] `followsWithMetrics.js` / `reportersWithMetrics.js` untouched (R1/R2 pass). `handleGetUserData` untouched. Mute ingestion / `:MUTES` projection / `calculateVerifiedMuterCounts.sh` / graperank config all consumed as-is.
- [x] `test/` untouched by this commit (the suite was committed separately in `5487b117`).

## Findings

### Blocking
None.

### Non-blocking
1. **`mutersWithMetrics.js:96-99`** — the muter cutoff is read inside the handler each request (parsed `$cutoff`), whereas `followersWithMetrics.js` reads its cutoff once at module load. This is intentional and *correct* per the ADR (it deliberately follows the reporters bound-`$cutoff` form, the safer of the two), so it is not a defect — just noting the divergence from followers is by design, not an oversight.
2. **`mutersWithMetrics.js:121` / `userdata.js`** — the duplicated `toInt`/`toFloat`/`isValidHexPubkey` helpers are now a fourth copy. This is the standing DRY follow-up the ADR explicitly defers (the `<GrapevineList>`/shared-cypher-builder refactor). Out of scope here; no action for this story.

## Verdict
**PASS** — the diff satisfies all 5 ACs, follows ADR 0001 Option A exactly (standalone module mirroring followers, bound `$cutoff` = `VERIFIED_MUTERS_INFLUENCE_CUTOFF`, six-column shape, owner-only/hex → 400, timeout → 504, `count === data.length`, count branch in `handleGetUserCounts` only with `handleGetUserData` untouched), the new test suite is green (18/18) under my own `npm test` run with no previously-green suite regressed, the Cypher is fully parameterized with no injection surface or hardcoded TA pubkey, and nothing was touched beyond the 3 in-scope files. Mergeable as-is.
