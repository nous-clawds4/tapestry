# `gate:status` names the last finished suite as "current", so a long suite that is still running looks hung

**Id:** 2026-09-21-gate-status-current-lags-one
**Type:** meta
**Opened:** 2026-09-21 (setup-page-scaffold #1 review)
**Status:** OPEN
**Done:** —

The runner sets `h.rec.progress.current` when a suite starts (`test/helpers/gateRunner.js:170`) but
writes the record to disk only after that suite finishes (`R.updateRecord`, `:191`).
`test/gate-status.js` reads the file (`describe`, `:49`), so while suite N runs, the RUNNING line
names suite N−1 as "current", and "last progress" counts from N−1's end.

Seen twice on 2026-09-21, both confirmed against the run log: `current pin-a-tag-publish, last
progress 2m ago` while the log showed `tl-publication-from-pins` running; and `current
tl-publication-from-pins-publish, last progress 6m ago` while `customize-pin-curation-publish` (about
12 minutes long) ran. Read literally, both lines say a suite has hung. The Reviewer misread it once
too.

**Fix shape.** Persist the record when a suite starts as well: one `R.updateRecord` right after
`current` is set. Or rename what the line prints to "last finished". Either way the RUNNING line then
matches the log.

**Pointer:** `test/helpers/gateRunner.js:165–191`, `test/gate-status.js:49`; run
`20260921T033649Z-59242-3315 [review-setup-page-scaffold-1]`.
