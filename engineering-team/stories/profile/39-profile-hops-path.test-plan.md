# Test Plan: Story 39 — Follows-hops path page + HOPS link activation

**Story:** `engineering-team/stories/profile/39-profile-hops-path.md`
**ADR:** `engineering-team/decisions/profile/0035-profile-hops-path.md`
**Date:** 2026-06-17

## Approach

Two layers, matching the profile feature-family convention (#33–#38):

1. **Primary — source-regex sentinels** in `test/profile-hops-path.test.js` (wired into `test/test.js`, run by `npm test`). Each test `fs.readFileSync`s an implementation file and asserts the spec via regex. No DB / React harness (local neo4j is stale/near-empty, OPEN.md #6). Pins the 3-state contract, the self-view short-circuit, `allShortestPaths` + cap-20/`LIMIT 25` literals + bound params, the path-as-cards rendering, rank = `Math.round(influence*100)`, re-roll gating, link activation, and the public-endpoint guard.
2. **Supplementary — live-data Playwright spec** in `tests/brainstorm/profile-hops-path.spec.js` (not run pre-implementation; exercised on staging). Asserts the activated link + that the page renders a path of profile cards — structure, not specific people/N (data-dependent).

## Coverage map

| Criterion (story AC) | Test(s) | Level |
|---|---|---|
| Link activation (HOPS → page, all states) | `T23` (+ spec test 1) | sentinel (+ Playwright) |
| Route registered | `T22` | sentinel |
| Count, consistent with #38 | `T8` (derived from path), `T21` (copy) | sentinel |
| Path as cards (N+1, source→target, pic/name/rank) | `T5`, `T16`, `T17`, `T18` | sentinel |
| Cards link to /user/<pubkey> | `T16` (+ spec test 2) | sentinel (+ Playwright) |
| No-path (∞) state | `T7` (backend), `T20` (page) | sentinel |
| Self-view → single card, short-circuit | `T3` | sentinel |
| Re-roll present when >1 path | `T19` | sentinel |
| Re-roll hidden when ≤1 / self-view / no-path | `T19` (`paths.length > 1` gate) | sentinel |
| Graceful failure (error/timeout → unavailable, not false path/∞) | `T2`, `T6`, `T9`, `T13` | sentinel |
| `allShortestPaths` + cap 20 + `LIMIT 25` literals, bound params | `T4`, `T6` | sentinel |
| Owner-PoV rank = `Math.round(influence*100)` | `T5` (influence returned), `T17` | sentinel |
| Public endpoint (not gated) | `R4` | guard |
| `runCypher` 3rd-arg timeout reused | `T6` | sentinel |
| Endpoint registered + exported | `T10`, `T11` | sentinel |
| Hook contract | `T12`, `T13` | sentinel |

## Test inventory

**Failing pre-implementation (T1–T23)** — backend handler `T1`–`T9`; route/export `T10`/`T11`; hook `T12`/`T13`; page `T14`–`T21`; route `T22`; link activation `T23`.

**Regression / guard (pass before AND after)** — `R1` HOPS stays between Verified Followers and Verified Reporters (#38 placement preserved); `R2` sibling counters/links intact; `R3` #38's `/api/get-follows-hops` still registered; `R4` `/api/get-follows-hops-paths` absent from `src/middleware/auth.js` (stays public).

## Edge cases covered

- [x] Self-view (`source === target`) → single-node path, `hops:0`, no `allShortestPaths`, no re-roll (`T3`, `T19`).
- [x] No path vs error are **distinct** (`T7` `{hops:null,paths:[]}` vs `T9` `{success:false}`) — ∞ never shown for a failure.
- [x] Count derived from the actual path so count and path can't disagree (`T8`).
- [x] `allShortestPaths` cost bounded by `LIMIT 25` + timeout; `truncated` flag (`T4`, `T8`, `T6`).
- [x] Malformed input → 400 (`T2`); endpoint stays public (`R4`).
- [x] #38 not broken — its endpoint and the HOPS placement persist (`R1`, `R3`).

## Not covered here (deferred / by design)

- Real path **values** (actual people, finite N, ∞, re-roll variety) — data-dependent; verified on **staging** via the Playwright spec + manual check (local graph is stale/near-empty — OPEN.md #6).
- Uniform sampling fairness across all shortest paths (we sample among the first 25; `truncated` flags it).

## Test infrastructure

- Node built-in runner via `npm test`; Playwright for the supplementary spec. No new framework.
- Concept Graph / firmware: not required by the sentinel suite (no concept/schema change).

## How to run

```
npm test                     # primary sentinel suite (+ all suites)
npm run test:playwright      # supplementary browser spec (needs a running instance)
```

## Verification

Confirmed pre-implementation on 2026-06-17 (working tree atop commit `bd707170`):

```
profile-hops-path suite:                         FAIL (4 passed, 23 failed)
```

- Isolated run: `T1`–`T23` ✗ (each with a spec-describing message, e.g. "expected a new handler at src/api/export/users/queries/follows-hops-paths.js"); `R1`–`R4` ✓.
- **Related suites stay green:** `profile-follows-hops` 25/25, `profile-identity-details-popover` 14/14, `trusted-list-pin-publish-blockers` 11/11.

**Note — unrelated local-env failures (NOT a #39 regression):** the full `npm test` also shows several **tags-feature** suites failing (`profile-tags*`, `pin-a-tag*`, `tl-publication*`, `most-pinned*`, concept-graph / Meili / firmware live tests). These fail because the **stale local stack lacks the tags runtime** — confirmed: the local concept-graph returns 0 `nostr-user-tag` matches (firmware not installed) and Meili returns 0 `tagHits`. They are green on staging CI (that's how tags shipped) and are independent of #39: the #39 diff touches only `test/test.js` (suite wiring) and the two new `profile-hops-path` test files — **zero** tag/concept/Meili/publish source. During #39 implementation/review, judge success by the `profile-hops-path` suite + the related suites above, not the full `Overall` (which the local tag-env failures will keep red until the stack is refreshed or those are verified on staging).
