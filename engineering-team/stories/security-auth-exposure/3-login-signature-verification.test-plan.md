# Test Plan: Story 3 — Login endpoints must verify the signed challenge

**Story:** `engineering-team/stories/security-auth-exposure/3-login-signature-verification.md`
**ADR:** `engineering-team/decisions/security-auth-exposure/0003-verify-signed-login-challenge.md`
**Date:** 2026-09-11
**Suite:** `test/login-signature-verification.test.js` (registered in `test/test.js`: require @169, run @583, `overallOk` chain @1349, summary array @1495)

## Coverage map

| Acceptance criterion | Test name | Level | Fails pre-impl? |
|---|---|---|---|
| Invalid (all-zeros) signature → failure + `status.authenticated:false` | `an all-zeros-sig event … is REJECTED (login-user); status stays authenticated:false` | unit (behavioral) | **yes** (current authenticates) |
| Validly-signed challenge → authenticated | `a validly-signed challenge is ACCEPTED (login-user)` | unit, needs nostr-tools | no — regression guard |
| `created_at` outside ±600 s → fail | `a valid signature with a stale created_at (2h old) is REJECTED` | unit, needs nostr-tools | **yes** (no created_at check today) |
| Challenge single-use (consumed by any attempt) | `after one failed attempt, the same challenge cannot be reused` | unit (behavioral) | **yes** (first bogus attempt authenticates) |
| Wrong kind → fail | `a wrong-kind event (kind 1) is REJECTED …` | unit (behavioral) | **yes** (no kind check today) |
| `event.pubkey` ≠ challenged pubkey → fail (even with a valid sig) | `a valid signature by a DIFFERENT key … is REJECTED` | unit, needs nostr-tools | no — guard (current checks pubkey equality) |
| A bare challenge request establishes **no** identity (reframe) | `a bare challenge request (verify-user) establishes NO session identity` | unit (behavioral) | **yes** (verify-user sets `session.pubkey`) |
| Session id regenerated on success + no `nsec` in session | `a successful login regenerates the session id and leaves no nsec` | unit, needs nostr-tools | **yes** (no regenerate today) |
| Both handlers enforce it (`/api/auth/login` owner path) + no `nsec` stored | `/api/auth/login (owner) rejects a bogus sig and never stores the client nsec` | unit (behavioral) | **yes** (current authenticates + stores nsec) |
| ADR decision: `verifyEvent` is used | `S: auth.js verifies the signed event with nostr-tools verifyEvent` | source sentinel | **yes** |
| ADR decision: no `session.nsec` write | `S: auth.js no longer assigns a client-supplied nsec to the session` | source sentinel | **yes** |
| ADR decision: session regeneration | `S: a successful login regenerates the session (fixation defense)` | source sentinel | **yes** |
| ADR decision: nsec page retired | `S: the paste-your-nsec sign-in page is retired` | source sentinel | **yes** |

Every acceptance criterion has ≥1 test. The two non-"fails-pre-impl" cases are deliberate regression guards (valid-login accept; wrong-key rejection) that must stay green before and after.

## Edge cases
- [x] Wrong kind (kind 1) with an otherwise-correct pubkey + challenge.
- [x] Valid signature by the *wrong* key while the challenge was issued for another pubkey (the "sign with my own key, log in as owner" trap the ADR calls out).
- [x] Stale `created_at` (2 h old) with an otherwise-valid signed event — isolates the freshness check from the signature check.
- [x] Replay: the same challenge presented on a second attempt after a failed first attempt.
- [x] Reframe: identity must not exist after only `verify-user` (no login).
- [x] Both login endpoints (`login-user` covered thoroughly; `login` owner-path covered for bogus-sig + nsec).
- Not covered (out of scope per ADR): F1–F5 audit follow-ups; the `kind10040.js` writer (F6); rate-limiting.

## Test infrastructure
- **Runner:** Node built-in via `node test/test.js` (this suite: `test/login-signature-verification.test.js`, self-runnable with `node test/login-signature-verification.test.js`).
- **Stack-free:** no Neo4j/Redis. Handlers are driven with a mock `req`/`res` and a mock session that emulates `express-session`'s `regenerate()`/`save()`.
- **`nostr-tools`:** the four signing-dependent cases lazily load `nostr-tools` (bare `require`, then the absolute in-container path) and **SKIP** if it can't be loaded. It is present in CI (`npm ci`) and in the container, so they run there; on a bare host with an empty `node_modules` they skip.
- **Firmware state:** none required.
- **Fixtures:** none (keys minted per-test with `generateSecretKey`).

## How to run

```
npm test
```

Or the suite alone. Because `auth.js` pulls in `customerManager` (→ `proper-lockfile`), run where `node_modules` exists — CI, or the container:

```
docker exec tapestry node /usr/local/lib/node_modules/brainstorm/test/login-signature-verification.test.js
```

## Verification

The new tests fail against current code for the right reasons. Confirmed 2026-09-11 at commit `9f59bf6e`, run in-container (so `node_modules` incl. `nostr-tools` is present):

```
  FAIL  AC: an all-zeros-sig event with the right challenge is REJECTED (login-user); status stays authenticated:false
        a bogus-signature login must not succeed; got {"success":true,...,"pubkey":"aaaa…"}.
  FAIL  AC: a wrong-kind event (kind 1) is REJECTED even with the right pubkey + challenge
  FAIL  AC (reframe): a bare challenge request (verify-user) establishes NO session identity
        verify-user set session.pubkey as identity before any signature …
  FAIL  AC (single-use): after one failed attempt, the same challenge cannot be reused
        the first (bogus-sig) attempt must be rejected, not authenticated.
  FAIL  AC (both handlers): /api/auth/login (owner) rejects a bogus sig and never stores the client nsec
        owner login must reject a bogus sig; got {"success":true,...}.   [+ log: "Private key stored in session for signing events"]
  PASS  AC: a validly-signed challenge is ACCEPTED (login-user) [needs nostr-tools]
  FAIL  AC: a successful login regenerates the session id and leaves no nsec [needs nostr-tools]
  FAIL  AC: a valid signature with a stale created_at (2h old) is REJECTED [needs nostr-tools]
  PASS  AC: a valid signature by a DIFFERENT key than the challenged pubkey is REJECTED [needs nostr-tools]
  FAIL  S: auth.js verifies the signed event with nostr-tools verifyEvent
  FAIL  S: auth.js no longer assigns a client-supplied nsec to the session
  FAIL  S: a successful login regenerates the session (fixation defense)
  FAIL  S: the paste-your-nsec sign-in page is retired

login-signature-verification: 2 passed, 11 failed, 0 skipped
```

(On a bare host with empty `node_modules` the four `[needs nostr-tools]` cases SKIP and the behavioral cases can't load `auth.js`; run in CI or the container, as above.)
