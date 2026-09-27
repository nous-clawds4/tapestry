# `launchChildTask` returns 0 after a time-out or failure by default and looks for error events in the wrong file, so a task job's success means little

**Id:** 2026-09-27-launchchildtask-reports-success-always
**Type:** bug
**Opened:** 2026-09-27 (tagging-edges #2 Architecture, ADR `tagging-edges/0002` § Consequences, candidate row 3)
**Status:** OPEN
**Done:** —

Two defects in `src/manage/taskQueue/launchChildTask.sh`:
- **The error lookup reads the wrong file.** To tell a caught failure from an uncaught one it greps
  `${BRAINSTORM_LOG_DIR}/events.jsonl` (:460), but structured events are written to
  `${BRAINSTORM_LOG_DIR}/taskQueue/events.jsonl` (`src/utils/structuredLogging.sh:32-38`,
  `src/utils/structuredEvents.js:40-41`). The count is therefore always 0 and every failure is classed uncaught.
- **Failures return 0.** Each completion status resolves `parentNextStep` with a default of `"continue"` (:500-509),
  and `"continue"` returns 0 (:519). Unless a task's registry options say `"exit"`, a time-out or a failure exits 0,
  so the BullMQ job completes as a success and anything reading job state (BullBoard, deploy-safety's history) sees
  success.

ADR `tagging-edges/0002` treats the pass's own report as authoritative for this reason.

**Fix shape.** Grep the `taskQueue/events.jsonl` path (or read `EVENTS_FILE` from `structuredLogging.sh`); decide
whether an entry-point task (no parent) should return its child's exit code on failure, and pin it with a test.

**Pointer:** `src/manage/taskQueue/launchChildTask.sh:460`, :496-523; ADR
`engineering-team/decisions/tagging-edges/0002-gap-filling-pass.md` § Consequences.
