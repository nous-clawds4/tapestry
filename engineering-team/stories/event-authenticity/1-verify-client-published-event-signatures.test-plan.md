# Test Plan: Story 1 — Verify client-published event signatures

**Story:** `engineering-team/stories/event-authenticity/1-verify-client-published-event-signatures.md`
**ADR:** `engineering-team/decisions/event-authenticity/0001-verify-client-published-event-signatures.md`
**Date:** 2026-09-11

## Coverage map

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC1 — forged event rejected; not written to relay/graph/store | `AC1: a forged-signature client event is REJECTED and never reaches strfry import or the brain-write` | `test/publish-event-signature-verification.test.js` | unit (stubbed) |
| AC1 — default (no `signAs`) path also verifies | `AC1: the client path with no signAs (default) also verifies` | same | unit |
| AC3 — forged `d`-tag reuse can't overwrite a real element | `AC3 (destructive): a forged kind-39999 TA-shaped event is rejected BEFORE the brain-write` | same | unit |
| AC2 — validly-signed event from any pubkey still publishes | `AC2: a validly-signed event from any pubkey still publishes (permissionless preserved)` | same | unit (needs nostr-tools) |
| AC4 — `signAs:'assistant'` still owner/localTrusted-gated | `AC4 (regression): signAs:assistant still requires owner/localTrusted` | same | unit |
| AC5 — verification is app-level, not relay-reliant | proven structurally: the forged-event tests assert `strfry import` (exec) is **not reached**, so rejection cannot depend on the relay | same | unit |

## Edge cases

- [x] Forged event that *is* well-formed (has id/sig/pubkey) — the presence check passes, so only signature verification catches it.
- [x] Default `signAs` (omitted) routes through the client path — covered.
- [x] Destructive kind-39999 forged-TA shape — asserts the brain-write hook (which runs `importEventDirect`, the MERGE-by-`uuid` overwrite) is never entered.
- [x] Permissionless preserved — a valid event from a *throwaway* (non-owner) key still publishes.
- [ ] Non-signature relay rejections (dup / writePolicy) returning `success:true` — **out of scope** (ADR §Consequences: a separate publish-reporting issue, not the F1 vector).

## Test infrastructure

- Node built-in runner (`node test/test.js`); suite self-contained with `t()`/`run()` exporting `{pass, fail, skipped}`, registered in `test/test.js` (require + `.run()` + `overallOk` chain + summary array).
- **Stubs** (stack-free): `child_process.exec` is mutated to a spy before a fresh `require` of the handler (core module — not require-cache-stubbable), and `../tapestryBrainWrite` is stubbed via the require cache; both restored after every test (`cleanup()` in the run loop) so sibling suites are unaffected.
- **nostr-tools**: loaded resiliently (bare → absolute in-container path); the one signing-dependent test SKIPs if unavailable (runs in CI / in-container).
- No Neo4j / Redis / strfry required.

## How to run

```
npm test
```

In-container (deps present) for a single-suite run:
```
docker exec tapestry node /usr/local/lib/node_modules/brainstorm/test/publish-event-signature-verification.test.js
```

## Verification

The reject/destructive tests fail against current code; the two guards pass. Confirmed in-container 2026-09-11 (commit `7b1fa094`):

```
  FAIL  AC1: a forged-signature client event is REJECTED and never reaches strfry import or the brain-write
        a forged-sig publish must not succeed; got {"success":true,"event":{...,"sig":"00…00"}}.
  FAIL  AC1: the client path with no signAs (default) also verifies
  FAIL  AC3 (destructive): a forged kind-39999 TA-shaped event is rejected BEFORE the brain-write (no element overwrite)
  PASS  AC2: a validly-signed event from any pubkey still publishes (permissionless preserved) [needs nostr-tools]
  PASS  AC4 (regression): signAs:assistant still requires owner/localTrusted (unauthenticated → 403, no publish)
publish-event-signature-verification: 2 passed, 3 failed, 0 skipped
```

The 3 failures are behavioral (current code imports the forged event and calls the brain-write, returning `success:true`), not load/import errors — the two guards passing proves the handler loaded and ran.
