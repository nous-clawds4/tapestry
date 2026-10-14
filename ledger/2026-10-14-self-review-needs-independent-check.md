# When one session plays every role, its own Review missed a page-breaking defect that an independent checker found

**Id:** 2026-10-14-self-review-needs-independent-check
**Type:** meta
**Opened:** 2026-10-14 (book `about-this-instance` close, retro)
**Status:** OPEN
**Done:** —

**What was seen.**
- In book `about-this-instance`, one session wrote the story, the ADR, the tests and the code, then reviewed them.
- The workflow's optional independent check (workflow 5, "an independent check before the commit") was run anyway: a read-only reviewer agent with no stake in the code.
- That checker found the one blocking defect: a non-string Owner or Admin profile name replaced all of `/about` with "Unexpected Application Error!" for every visitor.
- The author-reviewer had passed the same component, and the gate and the browser spec were green. The defect was reproduced, fixed and pinned in round 2.

**Fix shape.** Make the independent check **required, not optional**, whenever the session that reviews also authored the Implementation (or the Test Design), not only for docs-mode stories. Record in the review that it was applied and what it found, as this review did. An alternative is for the review template to carry a "Who reviewed" line that names the author when they are the same.

**Second occurrence (2026-10-14, book `assistant-scores`, review round 1).** Again one session wrote the story, ADR,
tests and code. The full gate (6078 passed) and the story's browser spec (11/11) were green and the author had nothing
blocking. The independent read-only checker found that every Customer's Recalculate press fails at BullMQ's jobId
validation (`Custom Id cannot contain :`), a defect the fakes in the tests could not see. Pointer:
`engineering-team/reviews/assistant-scores/1-the-scores-page.md` Blocking 1.

**Pointer:** `engineering-team/reviews/done/about-this-instance/1-owner-admins-customer-count.md` (round 1 "Independent check applied"; Blocking 1); audit §7.
