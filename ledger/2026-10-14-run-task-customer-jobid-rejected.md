# With the task queue on, every customer task started through /api/run-task fails: BullMQ rejects the jobId `<task>:<pubkey>`

**Id:** 2026-10-14-run-task-customer-jobid-rejected
**Type:** bug
**Opened:** 2026-10-14 (book `assistant-scores`, review round 1)
**Status:** DONE
**Done:** 2026-10-14 — `d4b056e0` on `staging` (assistant-scores ADR 0001 Amendment 1; review round 2 PASS). On production 2026-10-14 via PR #864 (merge `38c10be1`, deploy run 158).

**What was seen.**
- `computeJobId` (`src/manage/taskQueue/queue/index.js:64-69`) gives a customer task the jobId `` `${taskName}:${pubkey}` ``.
- BullMQ 5.76.10, pinned in `package-lock.json` since 2026-05-20, throws `Custom Id cannot contain :` for a custom jobId whose `split(':')` length isn't 3 (`node_modules/bullmq/dist/cjs/classes/job.js:1043-1045`). This was reproduced against real BullMQ and a throwaway Redis.
- So, while `TASK_QUEUE_ENABLED=true` (the default on staging and production), these all fail at enqueue:
  - `/api/run-task` for `processCustomer` and every other `arguments.customer` task, which answers 500;
  - the per-Customer scheduler, which calls run-task over loopback (`src/api/customer-schedule/index.js:67`);
  - the new Scores page's Recalculate press for Customers.
- Scheduled per-entry fires use their own Job Scheduler ids and are unaffected. Non-customer tasks (no colon) are unaffected.

**Fix shape.** A separator BullMQ accepts (e.g. `` `${taskName}-${pubkey}` ``), still one stable id per (task, pubkey) so ADR task-queue-scheduler/0022's dedup holds. Re-aim `test/manual-task-retrigger-after-finish.test.js` T3, and add a guard that runs `computeJobId`'s outputs through BullMQ's own validation. No migration is needed: no job with the old id was ever accepted.

**Pointer:** `engineering-team/reviews/assistant-scores/1-the-scores-page.md` Blocking 1 (the fix is asked there, for this story's next round).
