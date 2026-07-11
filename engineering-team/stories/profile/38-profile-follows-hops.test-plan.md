# Test Plan: Story 38 — Follows-hops to this profile

**Story:** `engineering-team/stories/profile/38-profile-follows-hops.md`
**ADR:** `engineering-team/decisions/profile/0034-profile-follows-hops.md`
**Date:** 2026-06-17

## Approach

Two layers, matching the profile feature-family convention (#33–#36):

1. **Primary — source-regex sentinels** in `test/profile-follows-hops.test.js` (wired into `test/test.js`, run by `npm test`). Each test `fs.readFileSync`s an implementation file and asserts the spec via regex. **No DB and no React harness** — deliberate, because the local neo4j stack is stale/near-empty and GDS/APOC are unloaded (OPEN.md #6), so tests must not depend on a live prod-scale graph. The 3-state contract, self-view short-circuit, validation, directionality, cap, timeout plumbing, and all UI states are pinned at the source level.
2. **Supplementary — live-data Playwright spec** in `tests/brainstorm/profile-follows-hops.spec.js` (not run pre-implementation; exercised at the staging smoke). Verifies the browser-rendered counter, its placement, and its not-an-anchor behavior — scoped to `.bsp-counts` to avoid the existing Reputation "Hops" trust card.

**Naming-collision note (flagged to PO):** `BrainstormProfile.jsx:46` already renders a TRUST_METRICS card `label: 'Hops'` ("Degrees of separation"). The new counts-row counter is also labeled HOPS, so two "Hops" labels coexist. All sentinels target `bsp-count-label` specifically and the Playwright spec scopes to `.bsp-counts`, so the tests are unambiguous either way — but the UX duplication is a decision for the PO (keep, or rename the counts-row label e.g. "Follow Hops"). If renamed, only the label/placement assertions and the spec's `hasText` need a one-line update.

## Coverage map

| Criterion (story AC) | Test(s) | Test file | Level |
|---|---|---|---|
| Placement & label (HOPS between Verified Followers and Verified Reporters) | `T17`, `T18` (+ spec test 1) | `test/profile-follows-hops.test.js` | source sentinel (+ Playwright) |
| Source = Owner when logged out / = viewer when logged in | `T15`, `T16` | same | source sentinel |
| Directionality (A→B may ≠ B→A) | `T4` (directed `-[:FOLLOWS*..20]->`) | same | source sentinel |
| Finite path N → shows N + tooltip | `T4`, `T22`, `T14` | same | source sentinel |
| No path within cap → ∞ + tooltip | `T7`, `T20`, `T21` | same | source sentinel |
| Self-view (source==target) → 0 | `T3` | same | source sentinel |
| Always computed live (no precomputed read) | `T4` (`length(p)`, shortestPath, not `n.hops`) | same | source sentinel |
| Async / non-blocking | `T13` (own AbortController hook), `T16` | same | source sentinel |
| Present but not clickable | `T19` (+ spec test 2) | same (+ Playwright) | source sentinel (+ Playwright) |
| Graceful failure (error/timeout → "—", not false ∞/number) | `T2`, `T6`, `T8`, `T9`, `T14`, `T20` | same | source sentinel |
| Tooltip singular/plural "hop(s)" | `T22` | same | source sentinel |
| Endpoint exists + publicly readable | `T10`, `T11`, `R3` | same | source sentinel |
| Cap = 20 | `T4` | same | source sentinel |

## Test inventory

**Failing pre-implementation (T1–T22)** — backend handler: `T1` exists/exports, `T2` validation+400, `T3` self-view short-circuit, `T4` directed capped shortestPath via `length(p)`, `T5` parameterized pubkeys, `T6` query timeout, `T7` no-path→`hops:null`, `T8` error→`success:false`; driver: `T9` `runCypher` 3rd-arg forwarding; routing: `T10` route, `T11` re-export; hook: `T12` exists, `T13` fetch+AbortController, `T14` hops/noPath/loading/error contract; page: `T15` imports, `T16` source selection, `T17` HOPS label, `T18` placement, `T19` non-link span, `T20` ∞ keyed on noPath, `T21` no-path tooltip, `T22` N-hops tooltip + plural.

**Regression / guard (must pass before AND after)** — `R1` existing three counters intact; `R2` `runCypher` keeps `params = {}` default (backward compatible); `R3` `/api/get-follows-hops` absent from `src/middleware/auth.js` (stays public).

## Edge cases covered

- [x] Self-view (`source === target`) → 0, no query (`T3`) — guards the `[:FOLLOWS*..20]` implicit-lower-bound-1 trap.
- [x] No path within cap vs lookup error are **distinct** states (`T7` vs `T8`/`T20`) — ∞ is never shown for a failure.
- [x] Malformed/missing pubkeys → 400 (`T2`).
- [x] Query timeout bounded so a view never hangs (`T6`, `T9`).
- [x] Injection safety — pubkeys are bound params, not interpolated (`T5`).
- [x] Backward compatibility of the shared `runCypher` (`R2`).
- [x] Endpoint stays public for logged-out viewers (`R3`).

## Not covered here (deferred / by design)

- The actual hop **value** against a real graph, and exact rendered tooltip text — data/runtime dependent; verified manually on **staging** (≈ prod scale) per the Playwright spec's note. The local stack cannot exercise this (OPEN.md #6).
- The `/follows-hops` destination page and link activation — out of scope (deferred story).

## Test infrastructure

- Framework: Node built-in runner via `npm test` (`node test/test.js`); Playwright for the supplementary browser spec.
- No new test framework introduced (house rule).
- Concept Graph API / firmware: not required (no concept/schema change).
- Playwright preconditions: a reachable instance (`BRAINSTORM_BASE_URL`, default `http://localhost:7778`) with a populated FOLLOWS graph — run against staging.

## How to run

```
npm test                     # primary sentinel suite (+ all suites)
npm run test:playwright      # supplementary browser spec (needs a running instance)
```

## Verification

Confirmed pre-implementation on 2026-06-17 (working tree atop commit `a2e3fc73`): the new sentinel suite fails for the right reasons (feature absent), regressions/guards pass, and every existing suite is unaffected.

```
profile-follows-hops suite:                      FAIL (3 passed, 22 failed)
Overall:                                         FAIL
```

Isolated run: `T1`–`T22` ✗ (each with a spec-describing message, e.g. "expected a new handler at src/api/export/users/queries/follows-hops.js"), `R1`/`R2`/`R3` ✓. All prior suites remained PASS in the full `npm test` run.
