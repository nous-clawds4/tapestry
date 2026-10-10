# ADR 0004: One guard in front of every negentropy-sync route

**Status:** Accepted
**Date:** 2026-10-10
**Story:** `engineering-team/stories/security-auth-exposure/4-negentropy-sync-owner-and-admins.md`

## Context

Eight routes start or inspect a negentropy sync: the strfry family (`POST /api/strfry/negentropy-sync`; `GET …/stream`,
`…/status`, `…/count` in `src/api/strfry/negentropySync.js`) and four legacy POSTs (`/api/negentropy-sync`, `-wot`,
`-profiles`, `-personal` in `src/api/index.js`). The central auth middleware (`src/middleware/auth.js`) lets any
authenticated session through for paths on its `authenticatedEndpoints` list, which names all of them by substring, and
lets every unauthenticated GET through as a public read. So the POSTs were open to any signed-in session, and the GETs
to anyone.

Constraints:
- The owner's rule (book `negentropy-sync-access`): owner and admins run syncs; other signed-in people only the POV
  sync (download one author's kind 30382), which three search pages send.
- Direct-local callers must keep working: the presets task script curls `127.0.0.1` and arrives with
  `req.localTrusted` and no session.
- `isOwnerOrAdmin(req)` (auth.js) is the existing owner-or-admin check; `isOwner` is its alias. `requireOwnerOrAdmin`
  in `src/api/admin/index.js` exists but answers 401 to a direct-local caller (it requires a session pubkey).
- Ship as a hotfix: small, testable without a stack, the same commit applying to `main` and `staging`.

## Options considered

### Option A — move the paths into the middleware's owner-only lists
Delete them from `authenticatedEndpoints` and add them to `ownerOnlyEndpoints` / `ownerOnlyGetEndpoints`. Pros: one
place. Cons: those lists match by substring and only for authenticated sessions; the unauthenticated GET branch would
need its own list too; the POV-sync exception would need body inspection inside the generic middleware; and the
middleware's substring matching has already over-matched once (`/negentropy-sync` matches all eight).

### Option B — a guard module, mounted per route
`src/api/strfry/negentropyAccess.js` exports `requireSyncManager` (owner, admin or direct-local) and
`requireSyncManagerOrPovSync` (the same, or a signed-in person with exactly the POV-sync body), built by
`createSyncGuards({ isOwnerOrAdmin })` so tests inject the check. Each route names its guard where it is registered.
Pros: the rule and its one exception live in one small file; every route's wiring is visible and testable; nothing in
the generic middleware changes; direct-local callers pass. Cons: a new sync route must remember to mount a guard (A5/A6
pin the current eight, not future ones).

### Option C — check inside each handler
Add the check at the top of each of the eight handlers. Cons: eight copies; the legacy handlers live in other modules.

## Decision

We chose **Option B**: one module holds the rule, each route mounts it, and the middleware is left as is except for a
comment pointing at the guard. Refusals are 401 when not signed in and 403 when signed in, in the route family's
`{ success: false, error }` shape. The POV-sync shape is matched exactly (`dir: "down"`, filter keys exactly `kinds` and
`authors`, `kinds` `[30382]`, one lowercase 64-hex author) so nothing wider passes by accident. The saved presets keep
`requireOwnerOrLocal`, which already admits admins.

## Consequences

- Anonymous visitors can no longer start, count against, or watch a sync; ordinary signed-in people can run only the
  POV sync; Relay Settings' sync panel and the legacy control panel's sync buttons are for the owner and admins.
- A future sync route must mount one of the two guards. A5/A6 catch a guard removed from the current routes, not a new
  unguarded route.
- The POV sync can still name any `ws(s)://` relay (ledger `2026-10-10-pov-sync-relay-scope`).
- The registered sync tasks are started through the task-control routes, not these eight; story 6 puts those behind
  the middleware's owner-only list, and mounts `requireSyncManager` on the presets list GET.
- The middleware's `authenticatedEndpoints` entries now only route signed-in sessions to the guard; removing them later
  would not widen access.
