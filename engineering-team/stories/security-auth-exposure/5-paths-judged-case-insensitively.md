# Story 5: The auth middleware judges paths case-insensitively, as Express routes them

**Status:** Done
**Created:** 2026-10-10
**Type:** Bug (security / authentication)
**Epic:** `security-auth-exposure`
**Book:** `audits/negentropy-sync-access/`

## Background

Found by the Reviewer while auditing story 4 (2026-10-10), confirmed locally by the coordinator, and live on staging and
production until PR #839.

Express 4 matches routes case-insensitively by default, and nothing in `bin/control-panel.js` turns that off. The
central auth middleware (`src/middleware/auth.js`, `authMiddleware`) compared `req.path` case-sensitively everywhere:

- it skipped every path that did not start with lowercase `/api/`, so a capitalized prefix (`/API/…`, `/Api/…`) reached
  the route registered at `/api/…` with no central check at all: the default-deny for mutations (ADR
  security-auth-exposure/0002), the owner-only lists and the protected GETs were all bypassed;
- its list matches (`includes`) were case-sensitive too, so `/api/` followed by a capitalized name slipped past the
  owner-only and protected-GET lists (the default-deny for anonymous mutations still applied there).

nginx's `location /` forwards every path, normalized but with its capitals kept. Routes with their own guard (story 4's sync guard, `requireOwner`
routes) were not affected.

## User-facing description

As the owner of a Brainstorm instance, I want every protected route to stay protected however its path is
capitalized, so that the central auth check cannot be stepped around by spelling.

## Acceptance criteria

- [x] **AC-1** A visitor who is not signed in is refused 401 for a non-public mutation under every capitalization of
      its path, and the handler is not reached.
- [x] **AC-2** ... and for a protected GET under every capitalization.
- [x] **AC-3** A signed-in person who is not the owner or an admin is refused 403 for owner-only POST and GET endpoints
      under every capitalization, including an endpoint whose listed name has capitals (`/toggle-strfry-filteredContent`).
- [x] **AC-4** Public paths stay public under any capitalization: public reads, `/api/auth/*`, the two public
      mutations, and pages outside `/api/`.
- [x] **AC-5** Every path test in the middleware uses one lowercased copy of the path (no case-sensitive comparison
      left behind).

## Concepts touched

None.

## Out of scope

- **Case-sensitive routing** (`app.set('case sensitive routing', true)`), a second safeguard: the owner chose the
  middleware fix only, since registered paths with capitals (e.g. `filteredContent`) would need every caller checked.
  Carried as ledger row `2026-10-10-case-sensitive-routing`.

## Open questions

None.

## Deviations

- **Shipped before the record**, by the owner's choice (PR #839, merge `c2553c2d`, deploy run 143; `staging`
  `3ace19de`). Architecture skipped: an obvious bug fix inside one function (strictness table, bugs).

## Linked artifacts

- Test plan: `engineering-team/stories/security-auth-exposure/5-paths-judged-case-insensitively.test-plan.md`
- Tests: `test/auth-path-case.test.js`
- Code: `src/middleware/auth.js` (`authMiddleware`)
