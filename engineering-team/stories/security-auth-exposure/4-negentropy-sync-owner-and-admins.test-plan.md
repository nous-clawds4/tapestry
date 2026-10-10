# Test Plan: Story 4 — Negentropy syncs are run by the owner and admins; signed-in people keep the POV sync

**Story:** `engineering-team/stories/security-auth-exposure/4-negentropy-sync-owner-and-admins.md`
**ADR:** `engineering-team/decisions/security-auth-exposure/0004-one-guard-for-negentropy-syncs.md`
**Date:** 2026-10-10

## Coverage map

Node suite `test/negentropy-sync-access.test.js` (stack-free; the owner/admin check is injected, no handler runs).

| Criterion | Test | Level |
|---|---|---|
| AC-1 not signed in → 401 | A3 (`requireSyncManager`, with and without a session object), A4 (`requireSyncManagerOrPovSync`, even with the POV body); A5/A6 put every route behind one of the two guards | unit (DI), wiring |
| AC-2 signed in → 403 | A3 (even with the POV body), A5 (stream, status, count behind `requireSyncManager`), A6 (the four legacy POSTs behind `requireSyncManager`) | unit (DI), wiring |
| AC-3 the POV sync only | A1 (the accepted shape, keys in either order), A2 (19 refused shapes: up/both/absent direction, other or extra kinds, a string kind, zero or two authors, uppercase or short hex, `since`, a tag key, non-object filters and bodies), A4 | unit |
| AC-4 managers run anything | A3, A4 (owner/admin and `localTrusted` with an upload sync) | unit (DI) |
| AC-5 the three pages | A8 (each page's fetch body is exactly the AC-3 shape) | source |
| AC-6 presets | A7 (`requireOwnerOrLocal` admits `isOwner` or direct-local; `isOwner` is the alias of `isOwnerOrAdmin`; the four preset POSTs call it, where the module exists) | source |
| Default wiring | A9 (the exported guards use the real `isOwnerOrAdmin`; an unknown signed-in pubkey is refused) | unit |
| AC-7 docs | `src/api/openapi.yaml` parses; the five documented routes carry 401 and 403 (checked by hand at the record step) | manual |

Live (no automated suite; run at deploy): anonymous `GET …/stream`, `…/count` (with an invalid relay, so old code would
answer without syncing) and `…/status` answer 401 on staging and production.

## Edge cases

- [x] A session object without `authenticated` (A3).
- [x] Upload or both directions from a signed-in person (A2, A4).
- [x] The filter keys in a different order (A1).
- [x] A direct-local caller with no session (A3, A4).

## How to run

```
node -e "require('./test/negentropy-sync-access.test.js').run()"
npm test
```

## Verification

The suite failed before the fix: 7 failed, 2 passed (A7 and A8 describe what was already true and pin it), on
`staging` at `2d6aa3e0` with the suite added, 2026-10-10. With the fix: 9/9; `npm test` 5537 passed, 0 failed on
`staging`, and 5394 passed, 0 failed on the hotfix branch off `main`.
