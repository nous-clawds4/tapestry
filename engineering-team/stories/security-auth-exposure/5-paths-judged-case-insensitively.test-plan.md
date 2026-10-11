# Test Plan: Story 5 — The auth middleware judges paths case-insensitively, as Express routes them

**Story:** `engineering-team/stories/security-auth-exposure/5-paths-judged-case-insensitively.md`
**ADR:** none (Architecture skipped: an obvious bug fix inside one function)
**Date:** 2026-10-10

## Coverage map

Node suite `test/auth-path-case.test.js`: the real `authMiddleware` in a local Express app in front of dummy handlers
on an ephemeral loopback port. Every request carries `X-Forwarded-For`, as nginx-proxied traffic does, so none is
treated as direct-local.

| Criterion | Test | Level |
|---|---|---|
| AC-1 | P1 (`/api/run-task`, `/API/run-task`, `/Api/run-task`, `/api/RUN-TASK`, `/API/RUN-TASK` → 401, handler not reached) | integration (real middleware + Express routing) |
| AC-2 | P2 (`/api/backups` and three capitalizations → 401) | integration |
| AC-3 | P3 (`batch-transfer`, `toggle-strfry-filteredContent` in three spellings, `personalized-pagerank` → 403 for a signed-in non-owner) | integration |
| AC-4 | P4 (public reads, `/api/auth/status`, `/api/strfry/publish`, `/api/neo4j/query`, `/some-page`, each capitalized → reach the handler) | integration |
| AC-5 | P5 (`req.path` appears once in `authMiddleware`, lowercased) | source |

Live (run at deploy): capitalized `POST /API/run-task` with no task name (the handler would answer 400 and do nothing)
answers 401 on staging and production; capitalized public reads answer 200.

## Edge cases

- [x] Capitals after `/api/` as well as in the prefix (P1–P3).
- [x] A listed endpoint that itself has capitals (P3).
- [x] Public mutations under capitals stay public, so their own handler gates still decide (P4).

## How to run

```
node -e "require('./test/auth-path-case.test.js').run()"
```

## Verification

Before the fix (`staging` at `dc318717` plus the suite): 4 failed, 1 passed (P4, already true). After: 5/5; auth
suites `close-unauth-write-surface` 14/14 and `default-deny-mutations` 14/14; `npm test` 5542 passed, 0 failed on
`staging` and 5399 passed, 0 failed on the hotfix branch off `main`.
