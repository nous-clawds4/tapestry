# Test Plan: Story 7 — The auth middleware judges a HEAD request as it judges a GET

**Story:** `engineering-team/stories/security-auth-exposure/7-head-judged-as-get.md`
**ADR:** none (Architecture skipped: an obvious bug fix inside one function)
**Date:** 2026-10-10

## Coverage map

Node suite `test/auth-head-requests.test.js`: the real `authMiddleware` in a local Express app in front of dummy GET
handlers that count their runs, on an ephemeral loopback port; requests carry `X-Forwarded-For`.

| Criterion | Test | Level |
|---|---|---|
| AC-1 | H1 (HEAD `/api/backups`, `/api/restore/sets`, `/api/personalized-pagerank`, `/API/Backups` → 401, handler not run) | integration (real middleware + Express routing) |
| AC-2 | H2 (HEAD `/api/personalized-pagerank`, `/api/backups` → 403 for a signed-in non-owner, handler not run) | integration |
| AC-3 | H3 (GET on the same paths → 401 / 403 as before) | integration |
| AC-4 | H4 (HEAD `/api/relays` → 200, handler ran) | integration |
| AC-5 | H5 (every `req.method === 'GET'` test in `authMiddleware` is paired with HEAD) | source |

Live (run at deploy): HEAD `/api/personalized-pagerank` with no pubkey (the handler would answer 400 and do nothing)
answers 401 on staging and production; HEAD `/api/relays` answers 200.

## How to run

```
node -e "require('./test/auth-head-requests.test.js').run()"
```

## Verification

Before the fix (`staging` at `6c972fc8` plus the suite): H1, H2 and H5 fail; H3 and H4 pass (already true). After:
5/5; auth suites pass; `npm test` 5553 passed, 0 failed on `staging`, whose `src/`, `test/`, `bin/` and `scripts/`
match the hotfix branch.
