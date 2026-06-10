# Test Plan: Story profile #35 — Verified Followers/Reporters counts from Neo4j (Owner PoV)

**Story:** `engineering-team/stories/profile/35-profile-verified-counts-owner-pov.md`
**ADR:** `engineering-team/decisions/profile/0031-profile-verified-counts-owner-pov.md`
**Date:** 2026-06-07

## Approach
Deterministic **source-regex node suite** — `test/profile-verified-counts-owner-pov.test.js`, run by `npm test`, wired into `test/test.js`. Matches the `profile-*` precedents. **T1–T7 are the failing tests** (the Owner-PoV sourcing doesn't exist; the raw fallback + "House" label still do); **R1–R4** are regression sentinels (Following stays strfry; the Reputation grid stays on Meili; the hook passthrough is intact) — pass before and after.

This story is mostly *change/removal* of existing behavior, so several assertions are **absence** assertions (the `?? trustScores?.followers` raw fallback gone; the badge values no longer read `trustScores`; the "House" line gone). Those *fail pre-implementation because the bad pattern is present* and pass once removed.

**False-positive control:** the target strings live in multiple places — `handleGetUserData` (same file as `handleGetUserCounts`) already contains `verifiedFollowerCount` / `[:FOLLOWS]` / `NEO4J_QUERY_TIMEOUT_MS`, and the Reputation grid keeps `trustScores`. So:
- Backend asserts are scoped to a **sliced `handleGetUserCounts` function body** (`sliceFn`), excluding `handleGetUserData`.
- Frontend asserts target the **badge value sourcing** (`userCounts?.verifiedFollowerCount`) and the **specific removed patterns** (`?? trustScores?.followers`, `trustScores?.verified*Count` dot-access), while R3 confirms the grid's `trustScores[metric.tag]` bracket access survives.

## Coverage map
| Criterion | Test(s) | Level |
|---|---|---|
| AC1 — verified counts from Owner Neo4j (not Meili) | T1 (endpoint returns both), T2 (reads NostrUser via Neo4j), T5 (badges read `userCounts`) | source-regex |
| AC2 — unavailable → "—", never raw followers | T6 (`?? trustScores?.followers` removed; badge values off `trustScores`), T4 (fallback deadline-bounded → "—") | source-regex |
| AC3 — badge ≡ table definition | T3 (`[:FOLLOWS]`/`[:REPORTS]` + the matching `VERIFIED_*_INFLUENCE_CUTOFF`), T4 (count-only) | source-regex |
| AC4 — Following unchanged | R1 (strfry kind-3 in the handler), R2 (profile reads `userCounts.followingCount` → `/follows`) | source-regex |
| AC5 — `/reporters` PoV "House" → "Owner" | T7 (PoV line), T8 (no `House (default)` anywhere — incl. popover) | source-regex |
| Regression — Reputation grid stays on Meili | R3 | source-regex |
| Regression — hook passthrough (no hook change needed) | R4 | source-regex |

## Edge cases
- [x] Dense-node fallback degrades, not hangs — T4 (NEO4J_QUERY_TIMEOUT_MS bound; → "—").
- [x] Never substitutes raw followers — T6 (the `?? followers` fallback is gone).
- [x] Right cutoff per metric (the AC3 invariant; guards copy-paste of the wrong cutoff) — T3.
- [x] Don't rip out `trustScores` wholesale — R3 (grid survives); the badges' dot-access is what's removed.
- [x] No hook change required — R4 (the passthrough already surfaces new `data` fields).
- count = list length: steady-state (node-prop batch vs table live), not real-time — asserted only at the *definition* level (T3 shared cutoff/edges); live numeric parity is a staging-smoke check once the Owner batch completes, not a deterministic test.

## Test infrastructure
- Node built-in runner (`node test/test.js`); wired in `test/test.js`.
- No Concept Graph / live stack needed (source-regex). No Playwright this story — the live numbers depend on a clean `updateAllScoresForOwner` run (currently mid-recompute on staging), so numeric verification is a deferred staging-smoke step, not a gate here.

## How to run
```
npm test
```

## Verification
The new suite fails with the current code (T1–T7 fail; R1–R4 pass). Confirmed via `npm test` on 2026-06-07:

```
profile-verified-counts-owner-pov suite:
  ✗ T1: handleGetUserCounts returns verifiedFollowerCount + verifiedReporterCount (AC1)
  ✗ T2: handleGetUserCounts reads the verified counts from Neo4j (NostrUser), not Meili (AC1)
  ✗ T3: the live fallback uses the [:FOLLOWS]/[:REPORTS] edges and the correct per-metric cutoffs (AC3)
  ✗ T4: the live fallback is count-only and deadline-bounded (AC2/AC3)
  ✗ T5: the profile VF + VR badges source their value from userCounts (AC1)
  ✗ T6: the badge values no longer come from Meili trustScores, and the raw-followers fallback is removed (AC2)
  ✗ T7: the /reporters PoV line is relabeled from "House" to Owner (AC5)
  ✓ R1: handleGetUserCounts still computes followingCount from strfry (kind 3) — Following unchanged (AC4)
  ✓ R2: the profile Following count still reads userCounts.followingCount and links to /follows (AC4)
  ✓ R3: the Reputation grid still uses Meili trustScores — only the badges moved (regression)
  ✓ R4: useUserCounts still passes json.data through unchanged (regression)

profile-verified-counts-owner-pov suite:         FAIL (4 passed, 7 failed)
```

Each `✗` fails for the right reason — the Owner-PoV sourcing is unimplemented, and the removal-assertions see the still-present raw fallback / "House" label — not from a typo or import error. All other suites stay PASS.
