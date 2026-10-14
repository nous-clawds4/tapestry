# A test's fake for a third-party call hid that library's own input validation, so a feature passed every gate and could never work

**Id:** 2026-10-14-fakes-hide-library-validation
**Type:** meta
**Opened:** 2026-10-14 (book `assistant-scores`, review round 1)
**Status:** OPEN
**Done:** —

**What was seen.**
- The Scores page's press enqueues a Customer's `processCustomer` with run-task's jobId, `processCustomer:<pubkey>`.
- The server suite faked `enqueueTask` and asserted the arguments and the jobId string, so it passed.
- The installed BullMQ (5.76.10) rejects any custom jobId with one colon (`Custom Id cannot contain :`), so the press can never succeed for a Customer.
- Neither the full gate nor the browser spec (whose API is mocked) could see that. An independent reviewer found it by adding the job to real BullMQ over a throwaway Redis.
- ADR task-queue-scheduler/0022's own probe had used a jobId with no colon (`'fixed'`), so the rule was never met there either. The same formula has made `/api/run-task`'s queue branch fail for every customer task.

**Fix shape.** One line in workflow 3's "Common pitfalls": when a test fakes a third-party call (a queue, a relay, a database driver), run at least one real input through that library's own validation (most expose it without a network), or name the gap in the plan's "Not covered" as a risk the Reviewer must check by hand.

**Pointer:** `engineering-team/reviews/assistant-scores/1-the-scores-page.md` Blocking 1 and § Harness friction.
