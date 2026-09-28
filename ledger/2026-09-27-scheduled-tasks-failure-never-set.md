# The Scheduled Tasks history marks every finished run a success: it reads a `failure` field no emitter writes

**Id:** 2026-09-27-scheduled-tasks-failure-never-set
**Type:** bug
**Opened:** 2026-09-27 (tagging-edges #2 Architecture, ADR `tagging-edges/0002` § Consequences, candidate row 4)
**Status:** OPEN
**Done:** —

`src/api/scheduled-tasks/index.js:207` sets a session's status to `rec.failure ? 'failed' : 'success'` from its
`TASK_END` event. No emitter writes a top-level `failure` field: `emit_task_event` (`src/utils/structuredLogging.sh`)
and `emitTaskEvent` (`src/utils/structuredEvents.js`) put outcome detail under `metadata`, and a `git grep` of `src/`
finds no writer of `failure` on a task event. So every run that reaches `TASK_END` reads as a success in the panel,
including one that emitted `TASK_ERROR` first.

**Fix shape.** Derive the status from a `TASK_ERROR` in the same session, or from a field the emitters actually write
(for example `metadata.outcome` where present), and pin it with a fixture of a failed run.

**Pointer:** `src/api/scheduled-tasks/index.js:198-210`; ADR
`engineering-team/decisions/tagging-edges/0002-gap-filling-pass.md` § Consequences.
