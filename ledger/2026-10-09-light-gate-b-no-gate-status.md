# A Light Gate B that skips the full suite has no gate:status line to record, and the template doesn't say what instead

**Id:** 2026-10-09-light-gate-b-no-gate-status
**Type:** meta
**Opened:** 2026-10-08 (treasure-map-card-details #1–#2, Gate B reviews, harness friction)
**Status:** OPEN
**Done:** —

The review template (`engineering-team/templates/review-checklist.md`) asks the reviewer to quote the run's
`npm run gate:status` line. The Light profile (`engineering-team/workflows/light-profile.md` § Gate B) leaves the full
`npm test` to the reviewer's discretion and runs it at book close. A Light Gate B that runs only the scoped gate and
the browser specs therefore has no gate-run record to quote, and neither document says what to record in its place.
Both reviews in this book recorded the scoped gates' exit codes and counts instead. **Fix shape:** give the template a
Light form ("scoped gate: command, exit code, TOTAL_FAIL; full suite: deferred to book close"), or have Light Gate B
always run the full suite. Belongs with the standing harness-story grouping.

**Pointer:** `engineering-team/reviews/done/treasure-map-card-details/1-needs-attention-pill.md` and
`2-show-details-panel.md` (§ Harness friction).
