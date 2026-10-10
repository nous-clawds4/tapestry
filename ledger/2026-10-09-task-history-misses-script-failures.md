# The Scheduled Tasks history shows every script task's run as a success, even when the script reported failure

**Id:** 2026-10-09-task-history-misses-script-failures
**Type:** bug
**Opened:** 2026-10-09 (relay-stream-gaps #3 review, non-blocking 2)
**Status:** OPEN
**Done:** —

**What was seen.** `groupEventsIntoSessions` (`src/api/scheduled-tasks/index.js:210`) reads `rec.failure` from a
`TASK_END` record, but `emit_task_event` (`src/utils/structuredLogging.sh:227`) nests the script's metadata under
`metadata`, so the flag is never found. The Reviewer fed a real `TASK_START` / `TASK_END {"failure":true}`, emitted
through `structuredLogging.sh`, to `groupEventsIntoSessions` and got `status: "success"`. The panel shows ❌ only for
`'failed'` (`ui/src/pages/settings/RelaySettings.jsx:1984`). The R4 fixture in
`test/scheduled-tasks-with-arguments.test.js` puts `failure` at the top level, which is why that suite passes.

**Why it matters.** It predates relay-stream-gaps #3 and affects every script task that reports failure this way
(`refreshApplicabilityLists.sh`, the new `syncPresets.sh`). ADR relay-stream-gaps/0003:140 ("the task fails in the
panel's history when any preset failed") does not hold until this is fixed. Until then, judge a presets run by each
preset's last-run line on the Negentropy Sync tab.

**Fix shape.** Read `rec.failure ?? rec.metadata?.failure`, and change the R4 fixture to the shape
`structuredLogging.sh` actually writes, with a test that pipes a real `emit_task_event` line through.

**Pointer:** `engineering-team/reviews/done/relay-stream-gaps/3-scheduled-negentropy-sync-presets.md` non-blocking 2.
