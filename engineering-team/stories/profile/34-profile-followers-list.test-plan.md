# Test Plan: Story 34 — Followers list on the primary profile page

**Story:** `engineering-team/stories/profile/34-profile-followers-list.md`
**ADR:** `engineering-team/decisions/profile/0030-profile-followers-list.md`
**Date:** 2026-06-06

## Approach

ADR 0030 chose **Option A (mirror, not generalize)**: a NEW isolated endpoint `GET /api/get-grapevine-followers` + a NEW page `BrainstormFollowers.jsx` + a NEW hook `useGrapevineFollowers.js` + route `/user/:pubkey/followers`, leaving the live Follows feature untouched; and the #33 "Verified Followers" count becomes a `<Link>` to the new page. v1: verified followers only (`WHERE follower.influence > VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF`), owner/House PoV, whole-set fetch + client-side 50-row pagination (faithful #29 parity).

Tests are **source-regex sentinels**, mirroring the #29 suite (`test/profile-follows-list.test.js`) — this repo has no React render harness and CLAUDE.md forbids adding one. Browser behavior is covered by the supplementary, live Playwright spec.

**Direction discipline:** `follows`/`following` = OUTBOUND `(observee)-[:FOLLOWS]->(x)`; `followers` = INBOUND `(x)-[:FOLLOWS]->(observee)`. The substrings differ (`follows` vs `follow*ers*`), so route/endpoint regexes don't cross-match.

## Coverage map

| Acceptance criterion | Test(s) | Level |
|---|---|---|
| Entry point — count → `/user/:pubkey/followers` link | `T11` + `PW1` (+ #33 `T5`, updated) | source + e2e |
| Return — Back-to-profile | `T12` + `PW2` | source + e2e |
| Direct load — owner-POV verified followers | `T1`,`T2`,`T6`,`T8`,`T9` | source |
| Row navigation → `/user/<pubkey>` | `T13` | source |
| Listing + empty state | `T9` | source |
| **Verified scope** (influence > cutoff) | `T3` | source |
| Default sort = verifiedFollowerCount desc (whole set) | `T20` | source |
| Re-sort / Search | `T18` (DataTable) | source |
| Pagination (client-side, 50/page) | `T19` | source |
| Default visibility / Toggle | `T14` | source |
| Persistence + reset (followers-specific key) | `T21` | source |
| Name fallback / Rank / npub | `T16`,`T15`,`T17` | source |
| Owner PoV only (non-owner → 400) | `T5` | source |
| Local-data disclosure (NIP-85, tappable) | `T22` | source |
| Follows-page parity (columns/controls) | `T14`,`T18`,`T19`,`T23` | source |
| Backend contract (handler, validation, 504, response shape, registration) | `T1`,`T2`,`T4`,`T6`,`T7` | source |
| Regression — live Follows feature untouched | `R1`–`R4` | source |

Node suite: `test/profile-followers-list.test.js` (wired into `test/test.js`). Playwright: `tests/brainstorm/profile-followers-list.spec.js` (supplementary, live).

## Cross-story update (#33)
Story #34 **reverses** #33's "plain, non-link" decision. `test/profile-verified-followers-count.test.js` **T5** has been **updated** from "the counter is plain (1 bsp-count-link, no /followers link)" to "the counter **links** to `/user/${pubkey}/followers` (≥2 bsp-count-link)". This is an intended behavior change, not a regression — #33's T5 now fails until #34's count→link lands, then passes. #33's T1–T4 + R1 are unchanged.

## Edge cases
- [x] **Direction** — `T3` pins INBOUND `(follower)-[:FOLLOWS]->(observee)` (not the follows outbound) and the verified filter; `R1` guards the follows endpoint stays OUTBOUND + unfiltered.
- [x] **Verified scope** — `T3` requires `influence > cutoff` reusing `VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF` (not all followers, not a new constant).
- [x] **Key collision** — `T21` forbids reusing the follows localStorage key (`bsp-follows-columns`) so the two pages don't clobber each other's column prefs.
- [x] **`/api/profiles` cap** — `T23` keeps `PROFILE_CHUNK ≤ 50` (matters more at followers scale).
- [x] **Mirror, not generalize** — `R1`/`R2`/`R3` guard that the live follows endpoint/page/route are untouched (the ADR's whole isolation rationale).
- [x] **Mega-account scale** (≈26k for Jack) — a documented watch-out (ADR 0030), to be observed at staging; not a unit-test concern.

## Test infrastructure
- **Node runner:** `npm test` (entry `test/test.js`); the `profile-followers-list` suite is wired in. Pure source-regex — **no Docker/Neo4j/Meili dependency**. Standalone (clean signal):
  ```
  node -e "require('./test/profile-followers-list.test.js').run().then(r=>{console.log(r);process.exit(0)})"
  ```
- **Playwright (supplementary, live):** `tests/brainstorm/profile-followers-list.spec.js` — needs a deployed instance (`BRAINSTORM_BASE_URL`, default `:7778`). **Not run pre-implementation.** A pre-existing harness bug (`tests/global-setup.js:16` reads `config.use`, undefined in the installed Playwright) blocks `npm run test:playwright` locally — verify at the staging smoke or via a Chrome MCP tab. *(That global-setup bug is intake-worthy, separate from this story.)*
- No concept/firmware change → no `POST /api/firmware/install` precondition.

## How to run
```
npm test                 # node suites (includes profile-followers-list)
npm run test:playwright  # browser/e2e — staging only (see global-setup caveat)
```

## Verification
Confirmed **failing for the right reasons** on 2026-06-06 (pre-implementation), run standalone:

```
profile-followers-list:  RESULT { pass: 4, fail: 23 }
  ✓ R1–R4  (regression sentinels: live follows endpoint/page/route + Following count all untouched)
  ✗ T1–T23 (each meaningful: "followersWithMetrics.js does not exist yet", "App.jsx must declare /user/:pubkey/followers",
            "BrainstormFollowers.jsx does not exist yet", "must link the Verified Followers count to /user/${pubkey}/followers", …)

profile-verified-followers-count (after the T5 update):  RESULT { pass: 5, fail: 1 }
  ✓ T1–T4, R1
  ✗ T5  — "the Verified Followers counter must link to /user/${pubkey}/followers" (fails until #34's count→link lands; intended)
```
`node --check test/test.js` passes. Playwright not run pre-implementation (tests deployed state).
```
