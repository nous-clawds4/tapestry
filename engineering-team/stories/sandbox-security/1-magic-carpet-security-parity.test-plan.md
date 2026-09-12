# Test Plan: Story 1 — magic-carpet runs production's security hardening

**Story:** `engineering-team/stories/sandbox-security/1-magic-carpet-security-parity.md`
**ADR:** `engineering-team/decisions/sandbox-security/0001-port-production-security-fixes-to-sandboxes.md`
**Date:** 2026-09-12

## Where the tests live

The failing test files are committed on **`fix/mc-security-parity`** (off `feature-magic-carpet`), commit `9b7dc355` — **not** on this record branch, and **not pushed** (public-repo disclosure discipline; the fix and its tests reach GitHub together when the port deploys). This plan is the harness record on `feat/sandbox-security`.

The suites are **ports of the ratified production suites** (the oracle): `security-auth-exposure/0001–0003` and `event-authenticity/0001`. Six were absent on `feature-magic-carpet`; `site-trust-signals.test.js` already existed and is modified for the ESTATE trim. All are **stack-free** (mock req/res, stubbed `child_process.exec`, source sentinels), so they run on a bare worktree with no Neo4j/Redis.

## Coverage map

| Criterion (story) | Test(s) | Suite file | Level |
|---|---|---|---|
| No credential-leaking query endpoint | `AC-2: no ui/src file references the removed run-query endpoint`; live: endpoint 404s, no password in any response | `users-page-neo4j-endpoint.test.js` (+ live) | source sentinel + live |
| Write surface closed (default-deny; proxied = remote) | `AC1/AC2/AC3/AC6` proxied-write rejection + write-Cypher gate; `AC1` firmware-install/meili-wipe/user-prefs denied; method-based default-deny sentinel | `close-unauth-write-surface.test.js`, `default-deny-mutations.test.js` | handler + source sentinel |
| Relay wipe owner-only | `authenticated non-owner / unauthenticated wipe → 403 and no strfry delete`; `S: wipe.js gates on owner OR localTrusted` | `strfry-wipe-owner-gate.test.js` | handler + source sentinel |
| No owner powers without a verified login | `AC (reframe): a bare challenge request establishes NO session identity`; default-deny unauth-mutation 401 | `login-signature-verification.test.js`, `default-deny-mutations.test.js` | handler |
| Published events authentic | `a forged client event is NOT published (never reaches strfry import)`; `a validly-signed event IS published` | `publish-event-signature-verification.test.js` | handler |
| Login at full prod parity | reframe / single-use / stale / wrong-kind / bogus-sig rejected; valid accepted + session regenerated; nsec never stored; paste-nsec page retired | `login-signature-verification.test.js` | handler + source sentinel |
| magic-carpet's own features still work | `AC-1: Users page POSTs {cypher} to /api/neo4j/query`; live: create a bounty + receiving setup still work, unauth still refused | `users-page-neo4j-endpoint.test.js` (+ live) | source sentinel + live |
| Ownership list current | `U6c the attestation no longer names the decommissioned sandboxes` (+ `U6` still names the live estate) | `site-trust-signals.test.js` | unit |
| Shipped and verified live | Reviewer/deploy live checks on magic-carpet.brainstorm.world | — | live (manual, at Review/deploy) |

## Edge cases

- [x] Valid signature by a **different** key than the challenged pubkey → rejected (login suite).
- [x] All-zeros signature with the right challenge → rejected (login suite).
- [x] Replayed (single-use) challenge → rejected (login suite).
- [x] Spoofed `X-Forwarded-For: 127.0.0.1` from a non-loopback peer → treated as remote (close-unauth suite).
- [x] A **valid** client event from any pubkey still publishes — permissionless publishing preserved (publish suite; guards against an over-strict fix).
- [x] `localTrusted` (loopback operator / firmware-install bridge) writes still allowed (close-unauth / wipe suites).

## Test infrastructure

- **Runner:** this branch's `test/test.js` is a minimal runner (bounty unit tests + `site-trust`); the six security suites were wired into it as an awaited list. `npm test` on the branch now reports `Overall: FAIL` until the fix lands.
- **Deps:** the suites are stack-free but their handlers pull in repo modules; running them needs the branch's `node_modules` (install with `npm install --ignore-scripts` — `feature-magic-carpet` carries `better-sqlite3`, whose native build is irrelevant here and is skipped). `nostr-tools` present → the signing cases run; absent → they SKIP.
- **In-container caveat:** two `default-deny` behavioral cases (`AC3` assistant-gate) and the publish handler load `fetchProfiles`, which on this old branch hardcodes an in-container path (`…/brainstorm/node_modules/ws`); on a bare host those cases error rather than assert, but the **source sentinels for the same requirement fail correctly** and the definitive behavioral run is in-container / CI (where the path resolves). The adapted publish suite sidesteps this by stubbing the sibling modules via a `Module._load` hook, so it runs cleanly on the host.
- **Firmware state:** none required (no concepts).

## How to run

On `fix/mc-security-parity`, with deps installed:

```
npm test
```

Or a single suite: `node test/login-signature-verification.test.js`

## Verification

The suites fail with the current `feature-magic-carpet` code. Confirmed 2026-09-12 on `fix/mc-security-parity` @ `9b7dc355` (`node test/test.js`, stack-free, host worktree):

```
close-unauth-write-surface: 6 passed, 8 failed, 0 skipped
default-deny-mutations: 4 passed, 10 failed, 0 skipped   (2 of the 10 are the in-container-path AC3 cases; source sentinels cover them)
login-signature-verification: 7 passed, 6 failed, 0 skipped
publish-event-signature-verification: 1 passed, 1 failed, 0 skipped
strfry-wipe-owner-gate: 1 passed, 2 failed, 0 skipped
users-page-neo4j-endpoint: 0 passed, 2 failed, 0 skipped
site-trust-signals: 19 passed, 1 failed, 8 skipped
Overall: FAIL
```

Each failure is a "the fix is not present" reason (not a typo/import error). The adapted suites (`publish-event-signature-verification`, `site-trust-signals` U6c) were additionally validated to flip **green** under a throwaway, ADR-faithful fix sketch (resilient `verifyEvent` before `strfry import`; ESTATE trim), then the sketch was reverted — the fix branch carries no production code.
