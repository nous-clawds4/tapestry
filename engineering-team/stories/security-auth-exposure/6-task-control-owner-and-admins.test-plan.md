# Test Plan: Story 6 — Task control is for the owner and admins

**Story:** `engineering-team/stories/security-auth-exposure/6-task-control-owner-and-admins.md`
**ADR:** none (Architecture skipped: the existing owner-only list and story 4's guard)
**Date:** 2026-10-10

## Coverage map

| Criterion | Test | File | Level |
|---|---|---|---|
| AC-1 | T1 (each of the six routes → 401, handler not reached) | `test/task-routes-owner-admin.test.js` | integration (real middleware + Express routing) |
| AC-2 | T2 (each route in three capitalizations → 403 for a signed-in non-owner) | same | integration |
| AC-3 | T3 (a loopback request with no forwarding header reaches each route) | same | integration |
| AC-4 | T4 (the six neighbouring reads reach their handlers when not signed in) | same | integration |
| AC-2 wiring | T5 (the six paths are on `ownerOnlyEndpoints`) | same | source |
| AC-5 | A10 (the list GET is mounted behind `requireSyncManager`); P12 (owner reads, signed-in non-owner 403, not signed in 401) | `test/negentropy-sync-access.test.js`, `test/negentropy-sync-presets.test.js` | wiring, unit (DI) |

The owner and admin pass is the existing `isOwner` (owner-or-admin) logic, which these suites cannot exercise without a
`brainstorm.conf`; T3 covers the direct-local pass, and P12 covers the owner pass through the presets suite's stub.

Live (run at deploy): anonymous task-control POSTs answer 401 (as before the fix: default-deny); the anonymous presets
list GET answers 401 (200 before the fix), which shows the deploy is live; the neighbouring reads answer 200.

## How to run

```
node -e "require('./test/task-routes-owner-admin.test.js').run()"
node -e "require('./test/negentropy-sync-presets.test.js').run()"
```

## Verification

Before the fix (`staging` at `3ace19de` plus the suite): T2 and T5 failed; T1, T3 and T4 passed (already true).
After: 5/5; `negentropy-sync-presets` 95/95 (P12 re-aimed), `negentropy-sync-access` 10/10; `npm test` 5548 passed,
0 failed on `staging` (identical tree to the hotfix branch).
