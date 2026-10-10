# Story 6: Task control is for the owner and admins

**Status:** Done
**Created:** 2026-10-10
**Type:** Bug (security / access control)
**Epic:** `security-auth-exposure`
**Book:** `audits/negentropy-sync-access/`

## Background

Found by the Reviewer while auditing story 4 (2026-10-10). Six routes start a registered task or change what runs on a
schedule (BullBoard, which can also act on queued jobs, was already behind `requireOwnerOrAdmin`):

- `POST /api/run-task` (`src/api/manage/commands/runTask.js`): start any of the 58 tasks in
  `src/manage/taskQueue/taskRegistry.json`, among them the negentropy sync tasks (`syncWoT`, `syncProfiles`,
  `syncNegentropyPresets`), whole-graph recomputes, and exports that publish signed score events;
- `POST /api/scheduled-tasks/create`, `/update`, `/delete` (`src/api/scheduled-tasks/index.js`): schedule any of them;
- `POST /api/customer-schedule/update`, `/trigger` (`src/api/customer-schedule/`).

None had a caller check, and the auth middleware's lists did not name them, so any signed-in session could use them.
Sign-in is open to any nostr key. Visitors who are not signed in were refused by default-deny (ADR
security-auth-exposure/0002), and since story 5 under every capitalization. ADR tagging-edges/0002 had recorded these
routes as open to signed-in sessions. Every caller is an owner page: Settings (scheduled tasks, Relay Settings), the
task explorer (`public/pages/manage/task-explorer.html`, `task.html`) and customer management
(`public/pages/customers/manage-customer.html`). The in-process customer scheduler calls `/api/run-task` over loopback
(`src/api/customer-schedule/index.js`) and passes as a direct-local caller; nothing outside the process calls them.

The owner decided on 2026-10-10: restrict them to the owner, admins and direct-local callers, as a hotfix. In the same
round the owner decided to guard the saved presets list (`GET /api/strfry/negentropy-presets`) like the live sync status.

## User-facing description

As the owner of a Brainstorm instance, I want only me and my admins to start or schedule the instance's tasks, so that
a stranger who signs in cannot start or schedule the instance's registered tasks (recomputes, exports, syncs) through
the task routes.

## Acceptance criteria

- [x] **AC-1** A visitor who is not signed in is refused 401 on each of the six routes.
- [x] **AC-2** A signed-in person who is not the owner or an admin is refused 403 on each route, under any
      capitalization.
- [x] **AC-3** The owner, an admin, or a direct-local caller still reaches each route.
- [x] **AC-4** The reads beside them stay public: scheduled-tasks status, list, history and registry-tasks;
      customer-schedule status and history.
- [x] **AC-5** `GET /api/strfry/negentropy-presets` is for the owner, admins and direct-local callers (401 not signed in,
      403 otherwise).

## Concepts touched

None.

## Out of scope

- **Other admin actions with no owner check of their own** stay reachable by any signed-in session: the class recorded
  in `engineering-team/stories/_intake.md` (2026-07-21, security-auth-exposure phase 2). Some of them reach the same
  effects by other means. The owner decided (2026-10-10) to sweep that class exhaustively as its own story rather than
  hotfix its members one by one; this story closes the task routes and guards the presets list.
- Whether the neighbouring reads (task status, history, schedules) should also be restricted.
- `/api/run-task`'s own handler-level checks (none were added: the middleware's owner-only list is the gate, as for the
  other administrative POSTs).

## Open questions

None.

## Deviations

- **Shipped before the record**, by the owner's choice (PR #840, merge `46c8254b`, deploy run 144; `staging` `1b3d538f`, `742a7e32`). Architecture
  skipped: the fix adds six entries to the middleware's existing owner-only list and mounts story 4's existing guard on
  one more route (strictness table, bugs). `negentropy-sync-presets` P12 re-aimed to the decision, and that suite now
  reloads `negentropyAccess.js` under its auth stub.
- **The out-of-scope bullet names the class, not its open members** (review round 1 asked to name one); the sweep
  story will list them. The round-1 review file itself, committed in `deca5b15`, does name several open members; the
  owner kept the sweep-first plan after learning that (2026-10-10).

## Linked artifacts

- Test plan: `engineering-team/stories/security-auth-exposure/6-task-control-owner-and-admins.test-plan.md`
- Tests: `test/task-routes-owner-admin.test.js`; `test/negentropy-sync-access.test.js` A10;
  `test/negentropy-sync-presets.test.js` P12
- Code: `src/middleware/auth.js` (`ownerOnlyEndpoints`), `src/api/strfry/negentropyPresets.js`
