# OPERATIONS §13.2 says a schedule fire missed while the process was down is never replayed, but BullMQ's source suggests one overdue fire runs when it comes back

**Id:** 2026-09-30-missed-fire-policy-unverified
**Type:** docs
**Opened:** 2026-09-30 (tagging-edges: the owner-steps evidence docs lane, its accuracy check)
**Status:** OPEN
**Done:** —

**What was seen.** OPERATIONS §13.2 states the policy as "skip-and-resume, no backfill — a fire missed while the
process was down is not replayed; the next future occurrence runs normally." BullMQ's source (5.76.10, the version
the lockfile installs) points the other way for interval schedules:

- An interval Job Scheduler keeps its next run as a delayed job in Redis, which runs in its own container
  (`tapestry-redis`), so the job outlives a control-panel restart.
- At boot, `reconcileSchedules` (`src/manage/taskQueue/queue/scheduler.js`) upserts every enabled entry. For an
  unchanged `every`, `addJobScheduler-11.lua` removes the pending job and re-adds it at the same time
  (`if removedPrevJob then … if every and not updatedEvery then nextMillis = prevMillis`), so a job already due runs at
  once.
- A worker that comes back also runs delayed jobs that fell due while it was away.

So the likely behaviour is "at most one catch-up run when the process returns, then the usual interval". Nothing has
observed it on a host. Whether a deploy re-creates `tapestry-redis` (and so drops the delayed job) was not checked
either.

**How to settle it.** Locally, with an enabled interval entry: stop the backend across its due time
(`docker exec tapestry supervisorctl stop brainstorm`), start it again, and read
`GET /api/scheduled-tasks/history?entryId=…` and the entry's `timer.nextRunAt`. Then correct §13.2 either way. The same
paragraph's note that `reconcileRecent`'s watermark spans the gap stays true in both cases.

**Pointer:** OPERATIONS §13.2; `node_modules/bullmq/dist/cjs/commands/addJobScheduler-11.lua`;
`src/manage/taskQueue/queue/scheduler.js` `reconcileSchedules`.
