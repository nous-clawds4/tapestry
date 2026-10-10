# Story 7: The auth middleware judges a HEAD request as it judges a GET

**Status:** In Progress
**Created:** 2026-10-10
**Type:** Bug (security / authentication)
**Epic:** `security-auth-exposure`
**Book:** `audits/negentropy-sync-access/`

## Background

Found by the Reviewer in round 2 of story 4's review (2026-10-10), confirmed locally by the coordinator, and live on
staging and production until PR #841.

Express answers a HEAD request by running the route's GET handler; only the body is dropped. The central auth
middleware's owner-only GET list and protected-GET list (`src/middleware/auth.js`) tested `req.method === 'GET'`, so a
HEAD request passed them and the handler ran:

- `HEAD /api/personalized-pagerank?pubkey=…` ran the personalized PageRank (loading the follows graph into Neo4j and
  computing over it, up to about three minutes) for a visitor who was not signed in, and could be repeated: an
  availability risk;
- HEAD on `/api/backups`, `/backups/download` and `/restore/sets` ran those handlers too; with the body dropped, only
  response headers leaked (sizes, whether a named backup exists).

`/get-customer-relay-keys` was safe: its handler checks the caller itself.

## User-facing description

As the owner of a Brainstorm instance, I want a protected read to stay protected whatever HTTP method asks for it, so
that a stranger cannot make my instance run an expensive computation or probe my backups by sending HEAD instead of GET.

## Acceptance criteria

- [x] **AC-1** A visitor who is not signed in is refused 401 for HEAD on a protected GET, and the handler does not run.
- [x] **AC-2** A signed-in person who is not the owner or an admin is refused 403 for HEAD on an owner-only GET, and the
      handler does not run.
- [x] **AC-3** GET answers exactly as before.
- [x] **AC-4** HEAD on a public read still reaches its handler.
- [x] **AC-5** No GET-only method test is left in the middleware: each one admits HEAD too.

## Concepts touched

None.

## Out of scope

- The owner-only list matches POST only. No owner-only path is registered for PUT, PATCH or DELETE (checked
  2026-10-10), but one owner-only path is served by a GET that can perform an action, so the list does not cover it.
  By the owner's decision (2026-10-10) it belongs to the sweep of admin actions without an owner check of their own
  (`_intake.md` 2026-07-21), not to this story. A route added later under another method needs the list or its own
  guard.

## Open questions

None.

## Deviations

- **Shipped before the record**, by the owner's choice (PR #841, merge `c0aa8d1d`, deploy run 145; `staging`
  `d0c2e8ff`). Architecture skipped: an obvious bug fix inside one function (strictness table, bugs).

## Linked artifacts

- Test plan: `engineering-team/stories/security-auth-exposure/7-head-judged-as-get.test-plan.md`
- Tests: `test/auth-head-requests.test.js`
- Code: `src/middleware/auth.js` (`authMiddleware`, `isRead`)
