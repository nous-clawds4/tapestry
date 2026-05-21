# Story 17: Make task queue ENABLED-by-default in the brainstorm.conf template

**Status:** Approved
**Created:** 2026-05-21
**Type:** Feature (default-behavior change with one-line implementation)

## Background

Story #13 shipped `TASK_QUEUE_ENABLED=false` as the phase-1 safe default — legitimate at the time because the queue was new and the rollback path needed to be the default. Stories #15 + #16 followed: cross-task neo4j-heavy serialization on top of the queue, and templates-as-source-of-truth for /etc/brainstorm.conf.

The template's `TASK_QUEUE_ENABLED=false` default is now an active operator pain point:

- Each deploy regenerates `/etc/brainstorm.conf` from the template (per story #16).
- On every fresh container start, the queue flag resets to `false`.
- The operator must run a manual `docker exec ... sed/echo` recipe + `supervisorctl restart brainstorm` on each environment after every deploy to restore the queue.
- We just lived through this dance on both staging and prod hours ago, immediately after story #16 landed.

The queue path is now mature enough to be the default:
- Staging and prod have both run with `TASK_QUEUE_ENABLED=true` for days (since story #15's rollout).
- Story #13's source-sentinel suite (18 tests), story #15's suite (14 tests), and story #16's suite (11 tests) all green.
- BullBoard UI and cross-task neo4j-heavy serialization both confirmed working in production.
- No reported runtime issues.

Story #13's rollback path remains intact — operators can still flip to `false` via the inverse recipe — only the *default* is changing. And because story #16 made the template the source of truth, "rollback" is now also "edit template + commit + deploy" (a real git-trackable operation), not a fragile in-container edit.

## User-facing description

**As an operator** spinning up fresh Tapestry containers (new droplets, post-deploy restarts, image rebuilds), **I want** `TASK_QUEUE_ENABLED=true` to be the deploy-safe default in the brainstorm.conf template, **so that** the BullMQ task queue, BullBoard UI, and cross-task neo4j-heavy serialization come up automatically — without me having to remember the manual flip recipe on every environment after every deploy.

## Acceptance criteria

- [ ] Given a fresh container start, when the entrypoint renders `/etc/brainstorm.conf` from the template, then the resulting file contains `export TASK_QUEUE_ENABLED=true`.
- [ ] Given a post-deploy `brainstorm` process start, when the boot log is inspected, then it shows the four-line task-queue stack: `Found TASK_QUEUE_ENABLED=true`, `[task-queue] Initialized N queues + workers (...)`, `Task queue initialized (TASK_QUEUE_ENABLED=true)`, `[bull-board] Mounted at /admin/queues (owner-only)`.
- [ ] Given an operator wants to disable the queue (rollback), when they apply the inverse manual recipe (set `TASK_QUEUE_ENABLED=false` in `/etc/brainstorm.conf` + `supervisorctl restart brainstorm`), then the system falls back to the legacy direct-spawn path with `Task queue disabled (TASK_QUEUE_ENABLED=false) — legacy direct-spawn path active` in the boot log.
- [ ] The `R2` regression sentinel in `test/entrypoint-template-rendering.test.js` (currently asserts the template carries `TASK_QUEUE_ENABLED=false`) is updated to assert the new default. No other regression in any of the 14 npm test suites.
- [ ] On staging and prod, after this story's deploy lands, the operator does NOT have to re-run the manual flip recipe. The task queue + BullBoard come up automatically.

## Concepts touched

- The `TASK_QUEUE_ENABLED` feature flag (story #13 / ADR 0012)
- `config/brainstorm.conf.template` — the conf-template source of truth (story #16 / ADR 0014)
- `test/entrypoint-template-rendering.test.js` R2 regression sentinel (story #16 test plan)
- Architect should resolve concept handles if any apply (Concept Graph API unreachable from host at planning time)

## Out of scope

- **Removing the `TASK_QUEUE_ENABLED` flag entirely / making the queue mandatory.** The flag stays as a rollback handle; this story only changes the default.
- **Removing the flag-off branch from `src/api/manage/commands/runTask.js`** (the legacy direct-spawn path). It remains the rollback path.
- **Auto-detecting Redis availability before enabling.** Story #13's `QUEUE_UNAVAILABLE` 503 failure mode already handles Redis-down loudly.
- **Backfilling `TASK_QUEUE_ENABLED=true` to long-running containers.** Staging and prod were manually flipped earlier today; this story benefits future fresh containers + post-deploy restarts.
- **Documentation rewrites in OPERATIONS.md beyond the minimum.** §10.1 (currently says "default false") needs a one-paragraph update; that's enough.
- **Architecture exploration.** The implementation is mechanical — one line in the template. Whether this needs a formal ADR is the Architect's call; the PO sees no design space.

## Open questions

Resolved at planning (2026-05-21):

- **Default for fresh containers** → `true`.
- **Risk of enabling by default** → acceptable. The queue has been running with `=true` on both staging and prod since story #15's rollout (days of stability), and story #16 made rollback a clean repo-tracked operation.
- **Test sentinel update** → R2 in `test/entrypoint-template-rendering.test.js` needs to be flipped along with the template. This is part of the implementation, not a separate story.

Deferred to Architect:

- **Does this change warrant a full ADR**, or is it small enough that a story + test-plan note is sufficient? The PO sees no design choices, but defers to the Architect's judgment about whether to skip Phase 2.
- **OPERATIONS.md §10.1 wording update** — Architect or Implementer to pick the right minimal edit (currently the section describes the flag's purpose; the "default is false" wording needs to flip).

## Linked artifacts

- ADR: [0015-task-queue-on-by-default.md](../decisions/0015-task-queue-on-by-default.md)
- Test plan: [17-task-queue-on-by-default.test-plan.md](17-task-queue-on-by-default.test-plan.md)
- Review: (filled in after Review phase)
