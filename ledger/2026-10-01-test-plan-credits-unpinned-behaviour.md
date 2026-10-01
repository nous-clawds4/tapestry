# A test plan can credit a test with behaviour it does not pin, and no gate or review step checks the claim

**Id:** 2026-10-01-test-plan-credits-unpinned-behaviour
**Type:** meta
**Opened:** 2026-10-01 (tagging-edges #4 review, round 1, harness friction 1)
**Status:** OPEN
**Done:** —

**What was seen.** Story 4's test plan, § Edge cases, said B38 pinned three polling rules from ADR 0004 § UI: a late
answer is dropped, a tick is skipped while a read is in flight, and a failed re-poll keeps its figures under their read
time. B38 asserted none of them: it counts requests over a minute. The review's UI lens found the gap by reading the
spec against the plan. Round 1's Tester then added B46–B48, and each fails on a deliberately wrong build. Until then a
regression in the stale-answer guard would have passed the gate.

The plan's claim was written by the Test Design phase, and the per-suite reviewers checked the tests, not the plan's
prose about them. No step re-reads an edge-case bullet against the assertion it cites.

**Fix shape.** Workflow 3, or the test-plan template, asks each § Edge cases bullet to name the assertion (test id and
line) that pins it. The Reviewer's checklist gains one line: spot-check two edge-case bullets against their cited
assertions. This is related to row `2026-09-29-test-plan-misses-injected-seams`, which covers real modules behind
injected seams, not prose claims.

**Pointer:** `engineering-team/reviews/tagging-edges/4-tagging-pipeline-panel.md` § Harness friction 1 (round 1) and
§ Re-review, round 2; `engineering-team/stories/tagging-edges/4-tagging-pipeline-panel.test-plan.md` § Edge cases.
