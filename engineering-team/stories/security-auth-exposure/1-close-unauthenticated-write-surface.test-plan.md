# Test Plan: Story 1 — Close the unauthenticated write-surface exposure

**Story:** `engineering-team/stories/security-auth-exposure/1-close-unauthenticated-write-surface.md`
**ADR:** `engineering-team/decisions/security-auth-exposure/0001-honest-local-bypass-and-neo4j-write-gate.md`
**Date:** 2026-07-19

## Approach

The whole suite is **stack-free** — it needs neither Neo4j nor Redis, so it gates the stack-free CI job and runs everywhere. Two seams:

- **Auth middleware** — call the exported `authMiddleware(req, res, next)` with mock `req`/`res`/`next` and assert on `next()` vs `res.status(401)` and the `req.localTrusted` stamp. The paths under test (bypass, unauth-normalize→401, public-read pass-through) short-circuit before the customer branch, so no `CustomerManager`/DB is touched.
- **`queryPost`** — the Bolt driver (`src/lib/neo4j-driver`) is replaced in the require cache with call-recording stubs, and `queryPost` is loaded fresh against them. This lets the tests observe whether `runCypher`/`writeCypher` were reached (i.e., whether the write-gate let the query through) without a live database. `isOwner` short-circuits on a session-less request, so the unauthenticated cases need no config.

All tests live in `test/close-unauth-write-surface.test.js`, registered in `test/test.js`'s **live** `overallOk` chain (before the line-882 terminator — the block below it is severed, a pre-existing harness defect tracked in OPEN.md #43; noted, not touched here).

## Coverage map

| Criterion | Test name | Level | Fails pre-impl? |
|---|---|---|---|
| AC-1 (unauth `/api/normalize/*` → 401) | `AC1: unauthenticated POST /api/normalize behind a proxy (loopback peer + XFF) is rejected 401` | unit | **yes** |
| AC-3 (XFF spoof → remote) | `AC3: a spoofed X-Forwarded-For: 127.0.0.1 does NOT earn local (loopback peer) — 401` | unit | **yes** |
| AC-3 (defense-in-depth) | `AC3: a non-loopback peer with spoofed XFF:127.0.0.1 is remote — 401 (regression guard vs trust-proxy)` | unit | no (guard) |
| AC-6 / local path | `AC6/local: a genuinely-direct local request (loopback, no proxy header) is trusted and stamped req.localTrusted` | unit | **yes** |
| AC-5 (public reads) | `AC5: a public read (deploy-safety status) stays reachable unauthenticated behind a proxy` | unit | no (guard) |
| design boundary | `design boundary: unauthenticated /api/neo4j/query passes the middleware (write-gating is the handler’s job)` | unit | no (guard) |
| AC-2 (unauth write → 403) | `AC2: unauthenticated write Cypher (DETACH DELETE) is rejected 403 and no write runs` | unit | **yes** |
| AC-2 (write keywords) | `AC2: representative write keywords are each rejected unauthenticated (403)` | unit | **yes** |
| AC-2 (reads stay open) | `AC2: unauthenticated read Cypher still runs (reads stay public for browsing)` | unit | no (guard) |
| AC-6 (localTrusted write) | `AC6: a localTrusted write is allowed (firmware-install / local-dev path)` | unit | no (guard) |
| Anti-pattern (Option A) | `S: trust proxy is NOT enabled anywhere in src/ (guards the rejected spoofable Option A)` | source | no (guard) |
| AC-1/AC-3 shape | `S: auth middleware treats a forwarding header as proof of proxying and stamps req.localTrusted` | source | **yes** |
| AC-2/AC-4 shape | `S: queryPost gates writes on owner OR localTrusted (isOwner imported, 403 on write)` | source | **yes** |
| AC-6 (bridge) | `S/AC6: the firmware internal bridge no longer forges an x-forwarded-for header` | source | **yes** |

**AC-4 (owner UI works)** is covered structurally + by symmetry: the `queryPost` gate is `isWrite && !isOwner(req) && !req.localTrusted`; the localTrusted-write test proves an authorized flag bypasses the gate, and the source sentinel asserts `isOwner` occupies the same OR-position, so an owner write is authorized identically. The `/api/normalize` owner path is **unchanged** by ADR-0001 (only the early bypass changes; the authenticated-owner branch at `auth.js:327+` is untouched), so it needs no new failing test. End-to-end owner-UI authoring is confirmed at Review with a real owner session.

**AC-7 (ships to staging/prod/feat/tags)** is a deploy criterion, verified in Stage 2, not by a unit test.

## Edge cases

- [x] Spoofed `X-Forwarded-For: 127.0.0.1` from a loopback peer (the deployed-instance reality) — AC3 test.
- [x] Non-loopback peer that lies via XFF — guards against a future `trust proxy` regression.
- [x] Read Cypher must stay open (public browsing) while writes are gated — both asserted.
- [x] `localTrusted` write (firmware-install bridge + local-dev) must pass.
- [x] Multiple write keywords (`CREATE/MERGE/SET/REMOVE/DELETE/DROP`), not just `DETACH DELETE`.

## Test infrastructure

- **Framework:** Node built-in runner (`node test/test.js`), matching the repo. No new deps.
- **Stack:** none required — driver stubbed, middleware called directly. Runs in CI's stack-free job.
- **Firmware state:** none. (The firmware-install end-to-end path is guarded structurally here — the bridge no longer forges a proxy header — and verified live by the Reviewer via a local firmware reinstall, since a full reinstall is too heavy/stateful for the automated suite.)
- **Fixtures:** inline mock `req`/`res`; require-cache stub of `src/lib/neo4j-driver`.

## How to run

```
node test/close-unauth-write-surface.test.js   # this suite alone
npm test                                        # full suite (this is in the live gate)
```

## Verification

New tests fail with current code. Confirmed 2026-07-19 (pre-implementation) running the suite standalone at commit `70531bc6`:

```
--- close unauthenticated write-surface tests (epic security-auth-exposure, Story 1) ---
  FAIL  AC1: unauthenticated POST /api/normalize behind a proxy (loopback peer + XFF) is rejected 401
        the request was allowed through (next called) — the localhost bypass still fires for proxied traffic.
  FAIL  AC3: a spoofed X-Forwarded-For: 127.0.0.1 does NOT earn local (loopback peer) — 401
        spoofed loopback XFF was trusted (next called) — presence of a forwarding header must mean "proxied".
  PASS  AC3: a non-loopback peer with spoofed XFF:127.0.0.1 is remote — 401 (regression guard vs trust-proxy)
  FAIL  AC6/local: a genuinely-direct local request (loopback, no proxy header) is trusted and stamped req.localTrusted
        the bypass must stamp req.localTrusted = true so the queryPost write-gate can honor it.
  PASS  AC5: a public read (deploy-safety status) stays reachable unauthenticated behind a proxy
  PASS  design boundary: unauthenticated /api/neo4j/query passes the middleware (write-gating is the handler’s job)
  FAIL  AC2: unauthenticated write Cypher (DETACH DELETE) is rejected 403 and no write runs
        expected 403 for an unauthenticated write, got null.
  FAIL  AC2: representative write keywords are each rejected unauthenticated (403)
        expected 403 for unauth write "CREATE (n:X) RETURN n…", got null.
  PASS  AC2: unauthenticated read Cypher still runs (reads stay public for browsing)
  PASS  AC6: a localTrusted write is allowed (firmware-install / local-dev path)
  PASS  S: trust proxy is NOT enabled anywhere in src/ (guards the rejected spoofable Option A)
  FAIL  S: auth middleware treats a forwarding header as proof of proxying and stamps req.localTrusted
        auth.js does not consult x-forwarded-for — the honest-local heuristic is missing.
  FAIL  S: queryPost gates writes on owner OR localTrusted (isOwner imported, 403 on write)
        queryPost does not import/use isOwner from the auth middleware.
  FAIL  S/AC6: the firmware internal bridge no longer forges an x-forwarded-for header
        the internal-bridge mock req still sets x-forwarded-for — it must not, so the in-process call is honestly direct-local (AC #6).

close-unauth-write-surface: 6 passed, 8 failed, 0 skipped
```

The 8 failures are all "feature-missing" (bypass still trusts proxied loopback; no write-gate; bridge still forges XFF), not typos or import errors — the 6 passing guards confirm the harness itself is sound (the driver stub is exercised, the modules load). The Implementer makes the 8 pass without touching this file.
