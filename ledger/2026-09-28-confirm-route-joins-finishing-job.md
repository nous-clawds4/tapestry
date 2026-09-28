# The owner's confirm route can answer `enqueued: true` when its enqueue joined a pass's job that is already finishing, so no pass runs to apply the confirmation

**Id:** 2026-09-28-confirm-route-joins-finishing-job
**Type:** bug
**Opened:** 2026-09-28 (tagging-edges #2 review, Non-blocking 3)
**Status:** OPEN
**Done:** —

**What was seen.** After a gap-filling pass exits, its BullMQ job stays active for up to about 5 s, because
`launchChildTask.sh` checks the child every 5 s (`check_interval=5`, `src/manage/taskQueue/launchChildTask.sh:375`).
A confirm POST in that window passes every route check. Its enqueue then joins the finishing job: BullMQ's
`addStandardJob` returns the existing job id for a duplicate (`handleDuplicatedJob`), and `runViaQueueAsync` answers
`success: true`, so the route answers `enqueued: true` although no new pass will run.

The review's evidence: the local `events.jsonl` shows `TASK_END` at 03:25:01.941Z and `resource_class_released` at
03:25:06.574Z for one pass; a probe of the real handler with a BullMQ-faithful fake queue answered
`200 … "enqueued":true`, created no new job, and left the confirmation pending. The schedule seed is disabled, so on
an instance with no schedule the confirmation can expire after 24 h unused.

It is fail-safe (nothing is removed; `confirmationPending` stays visible in the status answer) and the window is
0–5 s, so the review rated it non-blocking.

**Fix shape.** The route must tell a finishing job from one that has not yet run its pass. A job waiting for the
`neo4j-heavy` lease is also active, so "active, and the latest report is not running" is the wrong test. Preferred:
when the joined job was already active, wait for it in the background and re-enqueue once if `confirmation.json` is
still unclaimed. Alternatively, compare the job's `processedOn` with the latest report's start. Pin both active-job
cases in `test/tagging-edges-state-routes.test.js`, and amend ADR `tagging-edges/0002` (the confirm route, "answers
`{ confirmed: true, enqueued, … }`") and OPERATIONS.md §12.8 "Confirming held removals".

**Pointer:** `engineering-team/reviews/tagging-edges/2-gap-filling-pass-and-backfill.md` § Non-blocking 3;
`src/api/tagging-edges/index.js` (`handleConfirmHeldRemovals`, the enqueue at :297-311).
