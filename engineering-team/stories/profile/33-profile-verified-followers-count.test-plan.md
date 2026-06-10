# Test Plan: Story 33 — Verified-followers count on the profile page

**Story:** `engineering-team/stories/profile/33-profile-verified-followers-count.md`
**ADR:** `engineering-team/decisions/profile/0029-profile-verified-followers-count.md`
**Date:** 2026-06-06

## Approach

ADR 0029 chose **Option A** — a pure front-end change to one file (`ui/src/pages/BrainstormProfile.jsx`): render the already-fetched, PoV-aware `trustScores.verifiedFollowerCount` (fallback `.followers`) as a **plain (non-link)** "Verified Followers" counter in the `bsp-counts` block, beside the existing "Following" `<Link>`, formatted with the existing `fmtCount` helper.

Tests are **source-regex sentinels**, following the **story #29 (profile-follows-list)** precedent: a single-file profile-UI change in a repo with **no React render harness** (no vitest/jest; `ui/` has no test runner) and a house rule against adding test tooling. *(Story #30 used a pure importable helper only because its logic was shared across two files; here the logic lives in one file, so #29's source-sentinel style fits.)* Browser-rendered behavior — the element is not an `<a>`, PoV via `?pov=` — is covered by a **supplementary, live-data** Playwright spec.

**False-positive note:** `BrainstormProfile.jsx` already contains the strings `"Verified Followers"`, `verifiedFollowerCount`, and `followers` inside the `TRUST_METRICS` array (the Reputation grid). Every sentinel therefore targets the **new** counter specifically — a *2nd* `bsp-count-*` span, a direct `trustScores.verifiedFollowerCount` read, a *2nd* `fmtCount(...)` call — none of which exist pre-implementation. Verified by the pre-impl baseline counts (all 1) below.

## Coverage map

| Acceptance criterion | Test(s) | File | Level |
|---|---|---|---|
| AC1 — "Verified Followers" count in the prominent counter area, beside "Following" | `T1` + `PW1` | node + spec | source + e2e |
| AC2 — reflects the **verified** score, not the raw total | `T2` | node | source |
| AC3 — no PoV → **House** | `T2` (value from PoV-resolved `trustScores`) + `PW3` (manual) | node + e2e | source + e2e |
| AC4 — personalized PoV when available, else House (partial-personalized → placeholder, **accepted edge**) | `T2` + `T4` + `PW3` (manual) | node + e2e | source + e2e |
| AC5 — no data → neutral placeholder "—" | `T4` (value via `fmtCount`; `fmtCount(null)→"—"`) | node | source |
| AC6 — zero → "0" | `T3` (`??` preserves 0) + `T4` (`fmtCount(0)→"0"`) | node | source |
| AC7 — plain, **non-link** number | `T5` + `PW2` | node + spec | source + e2e |
| Regression — existing "Following" count unchanged | `R1` + `PW2` | node + spec | source + e2e |

Node suite: `test/profile-verified-followers-count.test.js` (wired into `test/test.js`).
Playwright: `tests/brainstorm/profile-verified-followers-count.spec.js` (supplementary, live-data dependent).

## Edge cases
- [x] **0 vs. null (the key trap):** `T3` pins nullish-coalescing (`verifiedFollowerCount ?? followers`) and forbids `||`, so a genuine `0` renders "0" (AC6) rather than being treated as falsy and dropped to "—" or the `.followers` value.
- [x] **Missing data:** `T4` ties the value to `fmtCount`, which renders "—" for null/undefined (AC5).
- [x] **Partial personalized PoV (accepted edge, per ADR 0029 + user):** when a personalized `?pov=` is selected but that account has no indexed score, the existing Reputation fetch yields no value → the counter shows the placeholder "—" (NOT a silent House substitute). Covered by `T4`'s placeholder path; *not* a strict per-lookup House fallback (deferred by decision).
- [x] **False positives from pre-existing TRUST_METRICS tokens:** every sentinel uses count thresholds (`≥2`) or new-only patterns (`trustScores.verifiedFollowerCount`, `verifiedFollowerCount ??`) — confirmed failing pre-impl.

## Test infrastructure
- **Node runner:** `npm test` (entry `test/test.js`); the `profile-verified-followers-count` suite is wired in. The suite is **pure source-regex — no Docker/Neo4j/Concept-Graph/Meili dependency**, so it runs anywhere. Standalone (clean signal, independent of other suites):
  ```
  node -e "require('./test/profile-verified-followers-count.test.js').run().then(r=>{console.log(r);process.exit(0)})"
  ```
  *(The full `npm test` also runs other suites, some of which expect the live stack at `localhost:8877`; the local stack is currently down by choice, so the standalone command above is the clean way to verify just this suite.)*
- **Playwright (supplementary, live):** `tests/brainstorm/profile-verified-followers-count.spec.js` — needs a deployed instance (`BRAINSTORM_BASE_URL`, default `:7778`) with House-PoV WoT scores loaded into Meilisearch and the target account (Jack Dorsey, `82341f88…e6a2`) having verified followers indexed. **Not run pre-implementation;** exercised at the staging smoke after deploy. Fragile to live data (flagged in-file).
- No concept/firmware change → no `POST /api/firmware/install` precondition.

## How to run
```
npm test                 # node suites (includes profile-verified-followers-count)
npm run test:playwright  # browser/e2e (needs a deployed instance with House scores loaded)
```

## Verification
Node suite confirmed **failing for the right reason** on 2026-06-06 (pre-implementation), run standalone against commit `30c0aae8`:

```
✗ T1: BrainstormProfile.jsx renders a "Verified Followers" count in the bsp-counts block (AC1)
      a SECOND counter must be added to the bsp-counts block (expected >=2 `bsp-count-label` spans; …).
✗ T2: the new counter sources its value from trustScores.verifiedFollowerCount (verified score, PoV-resolved) (AC2; AC3/AC4 source)
      the counter must read `verifiedFollowerCount` directly off the PoV-resolved `trustScores` object …
✗ T3: the verifiedFollowerCount->followers fallback uses ?? (not ||) so a real 0 is preserved (AC6)
      the count must fall back with nullish-coalescing: `trustScores?.verifiedFollowerCount ?? trustScores?.followers` …
✗ T4: the new counter formats its value via the existing fmtCount helper (AC5 placeholder, AC6 zero)
      the new counter must format its value through the existing `fmtCount` helper (a 2nd `fmtCount(...)` call …).
✗ T5: the "Verified Followers" counter is plain (not a <Link>); the followers table is deferred (AC7)
      the new counter must exist (expected >=2 `bsp-count-value` spans; only "Following" has one …).
✓ R1: the existing "Following" count is unchanged — useUserCounts + <Link> to /follows (regression)

RESULT: 1 passed, 5 failed
```

Pre-impl baseline counts in `BrainstormProfile.jsx` (each must be `1`, confirming the `≥2`/`===1` thresholds gate correctly): `bsp-count-label=1`, `bsp-count-value=1`, `bsp-count-link=1`, `fmtCount(=1`. `test/test.js` passes `node --check`.

Playwright spec: not run pre-implementation (it tests deployed state); exercised against staging after the feature deploys.
```
