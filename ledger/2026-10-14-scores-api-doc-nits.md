# Two small wording inaccuracies in the Scores press's docs: the 401's "no code", and a jobId note that reads as covering the Owner

**Id:** 2026-10-14-scores-api-doc-nits
**Type:** docs
**Opened:** 2026-10-14 (book `assistant-scores`, review round 2)
**Status:** OPEN
**Done:** —

- `src/api/openapi.yaml` (`/api/assistant/scores/recalculate`, description and 401) and the BIBLE row for `POST /api/assistant/scores/recalculate` say the route table refuses a signed-out press "with no code". That holds for remote callers. A direct-local caller (loopback, no proxy header) skips the table, so a signed-out one gets the handler's `401 { code: 'not-signed-in' }`. Fix: add "; a direct-local caller gets the handler's `not-signed-in`".
- The same BIBLE row says "with run-task's jobId (`processCustomer-<pubkey>`)" after naming both the Owner's and the Customer's task. The Owner's id is the bare `updateAllScoresForOwner`. Fix: "(`processCustomer-<pubkey>` for a Customer)", as `openapi.yaml` already says.

**Pointer:** `engineering-team/reviews/assistant-scores/1-the-scores-page.md` § Round 2, Non-blocking 1–2.
