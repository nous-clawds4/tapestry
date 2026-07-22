# Test Plan: Story 2 — Default-deny for unauthenticated mutations

**Story:** `engineering-team/stories/security-auth-exposure/2-default-deny-mutating-endpoints.md`
**ADR:** `engineering-team/decisions/security-auth-exposure/0002-default-deny-for-mutations.md`
**Date:** 2026-07-20

## Approach

Stack-free, matching the story-1 suite. Two seams:

- **`authMiddleware`** — called directly with mock `req`/`res`/`next`. Two request shapes: `proxied()` (an external request — `X-Forwarded-For` present, no session) and `directLocal()` (loopback peer, no forwarding header — the cron/bridge). The deny/allow paths short-circuit before any DB, so no stack.
- **`publishEvent.handlePublishEvent`** — exercised only at its early-return paths: the new 403 assistant-gate and the 400 client-validation, both of which return before any signing/`exec`. The container-path `nostr-tools` require is lazy (`getNostrTools`) and never reached.

All in `test/default-deny-mutations.test.js`, registered in `test/test.js`'s **live** `overallOk` chain (after the story-1 suite, before the line-882-area terminator — the block below it is severed, OPEN.md #43).

## Coverage map

| Criterion | Test name | Level | Fails pre-impl? |
|---|---|---|---|
| AC-1 (deny unlisted mutation) | `AC1: unauthenticated POST /api/firmware/install (proxied) is denied 401` | unit | **yes** |
| AC-1 (DELETE verb) | `AC1: unauthenticated DELETE /api/search/profiles/meili/wipe … 401` | unit | **yes** |
| AC-1 (PUT verb) | `AC1: unauthenticated PUT /api/user-prefs (proxied) is denied 401` | unit | **yes** |
| AC-2 / allowlist | `allowlist: … POST /api/neo4j/query (proxied) passes the middleware` | unit | no (guard) |
| AC-2 / allowlist | `allowlist: … POST /api/strfry/publish (proxied) passes the middleware` | unit | no (guard) |
| AC (cron / broadened bypass) | `AC (cron): a direct-local POST to /api/trusted-list/* … req.localTrusted` | unit | **yes** |
| AC-1 (remote ≠ cron) | `AC1: a PROXIED unauthenticated POST to /api/trusted-list/* is denied 401` | unit | **yes** |
| AC-5 (public reads) | `AC5: a public GET read (deploy-safety status, proxied) … passes` | unit | no (guard) |
| AC (no regression) | `AC (no regression): an authenticated-session mutation is unaffected` | unit | no (guard) |
| AC-3 (TA-signing gate) | `AC3: unauthenticated signAs:"assistant" is denied 403` | unit | **yes** |
| AC-3 (client stays public) | `AC3: signAs:"client" is NOT blocked by the assistant-gate` | unit | no (guard) |
| AC-1/AC-2 shape | `S: auth middleware does method-based default-deny with an exact-match public allowlist` | source | **yes** |
| bypass broadening | `S: the honest-local bypass is broadened beyond normalize/neo4j` | source | **yes** |
| AC-3 shape | `S: publishEvent gates signAs:"assistant" on owner OR localTrusted` | source | **yes** |

**AC-4 (owner mutations still work)** is covered by the authenticated-session guard (a logged-in mutation passes the middleware) plus the `publishEvent` assistant-gate's structural check (`isOwner` in the same OR-position as `localTrusted`, symmetric to the live `localTrusted` proof). A browser owner-session smoke is a deploy-time item (NIP-07 unscriptable), per the ADR.

**AC-6 (delivered to three instances)** is a deploy criterion, not a unit test.

## Edge cases

- [x] Non-POST mutations (`PUT`, `DELETE`) — the old list was POST-only; both now denied.
- [x] The two allowlisted paths stay reachable (handler does the finer gate).
- [x] Direct-local (cron/bridge) still trusted for a non-normalize/non-neo4j path (the broadening).
- [x] A *remote* caller to the same cron path is denied (the bypass is not a hole).
- [x] `signAs:'client'` (permissionless publish) not caught by the assistant-gate.
- [x] Authenticated branch untouched (no regression to logged-in users).

## Test infrastructure

- **Framework:** Node built-in runner (`node test/test.js`); no new deps.
- **Stack:** none — middleware called directly; publish handler hit only at early returns.
- **Firmware state:** none.
- **Fixtures:** inline mock `req`/`res`.

## How to run

```
node test/default-deny-mutations.test.js   # this suite alone
npm test                                    # full suite (this is in the live gate)
```

## Verification

New tests fail with current code. Confirmed 2026-07-20 (pre-implementation), suite standalone:

```
--- default-deny for unauthenticated mutations (epic security-auth-exposure, Story 2) ---
  FAIL  AC1: unauthenticated POST /api/firmware/install (proxied) is denied 401
        firmware/install was allowed through — an unlisted mutation is still default-open.
  FAIL  AC1: unauthenticated DELETE /api/search/profiles/meili/wipe (proxied) is denied 401 (verb blind spot)
        a DELETE mutation must be denied unauth; got next=true status=null.
  FAIL  AC1: unauthenticated PUT /api/user-prefs (proxied) is denied 401
        a PUT mutation must be denied unauth; got next=true status=null.
  PASS  allowlist: unauthenticated POST /api/neo4j/query (proxied) passes the middleware (handler gates writes)
  PASS  allowlist: unauthenticated POST /api/strfry/publish (proxied) passes the middleware (handler gates TA-signing)
  FAIL  AC (cron): a direct-local POST to /api/trusted-list/* is trusted and stamped req.localTrusted (broadened bypass)
        a direct-local call must be stamped req.localTrusted so it is recognized as trusted for all paths.
  FAIL  AC1: a PROXIED unauthenticated POST to /api/trusted-list/* is denied 401 (remote cannot invoke the cron)
        a remote caller must not reach the cron; got next=true status=null.
  PASS  AC5: a public GET read (deploy-safety status, proxied) is unaffected — passes
  PASS  AC (no regression): an authenticated-session mutation is unaffected (authenticated branch)
  FAIL  AC3: unauthenticated signAs:"assistant" is denied 403 (no TA-signing without owner/localTrusted)
        expected 403 for unauthenticated TA-signing, got 500.
  PASS  AC3: signAs:"client" is NOT blocked by the assistant-gate (public client-signed publish)
  FAIL  S: auth middleware does method-based default-deny with an exact-match public allowlist
        auth.js does not list /api/strfry/publish on the public-mutation allowlist.
  FAIL  S: the honest-local bypass is broadened beyond normalize/neo4j (covers all /api paths)
        the honest-local bypass is still restricted to /api/normalize||/api/neo4j — it must be broadened to all /api paths (ADR 0002).
  FAIL  S: publishEvent gates signAs:"assistant" on owner OR localTrusted (isOwner imported, 403)
        publishEvent does not import/use isOwner from the auth middleware.

default-deny-mutations: 5 passed, 9 failed, 0 skipped
```

The 9 failures are all "feature-missing" — the mutation is allowed through (default-open), the cron bypass isn't broadened, the assistant-gate is absent (the request proceeds to sign, 500-ing only because the host lacks the TA key — on a deployed instance it would mint a TA event, which is the hole). The 5 passing guards confirm the harness is sound (allowlist paths, public reads, and the authenticated branch behave, and the modules load). The Implementer makes the 9 pass without touching this file.
