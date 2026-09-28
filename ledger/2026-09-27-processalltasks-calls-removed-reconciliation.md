# `processAllTasks` still launches the `reconciliation` task that story task-queue-scheduler #23 removed, so the orchestrator reconciles nothing

**Id:** 2026-09-27-processalltasks-calls-removed-reconciliation
**Type:** bug
**Opened:** 2026-09-27 (tagging-edges #2 Planning, fact-gathering pass)
**Status:** OPEN
**Done:** —

**What was seen.** `src/manage/processAllTasks.sh:152` runs `launch_child_task "reconciliation" "processAllTasks" "" ""`
as its child task 4. The `reconciliation` key left `src/manage/taskQueue/taskRegistry.json` in `02689be0` (story
`task-queue-scheduler` #23 phase 4, ADR `task-queue-scheduler/0020`); the registry now holds `reconcileRecent`,
`reconcileAll`, `reconcileAuthor` and `reconcileNetwork`. `launch_child_task` logs "Task 'reconciliation' not found in
registry" and returns 1 (`src/manage/taskQueue/launchChildTask.sh:151-155`); `processAllTasks.sh` has no `set -e`, so
it moves on to child task 5. A scheduled or on-demand `processAllTasks` therefore runs its score calculations on a
graph that no step of it reconciled.

The intake entry "2026-05-21 — Cleanup: deprecate legacy `reconciliation` task + `reconcile.timer`" named exactly this
line as the reason to keep the key, and its item 1 set the choice: repoint `:152` to `reconcileRecent`, or decouple
reconciliation from the chain and schedule it on its own, keeping the order "reconciliation before the owner score
calcs". The entry is marked PICKED UP by story #23; the key was removed and the line was not changed.

**Fix shape.** Take the intake entry's choice: repoint `:152` to `reconcileRecent` (it is `neo4j-heavy`, like its
parent, so it runs under the parent's lease, BIBLE §24), or remove child task 4 and document that reconciliation is
scheduled separately.

**Pointer:** `src/manage/processAllTasks.sh:150-153`; `engineering-team/stories/_intake.md` § "2026-05-21 — Cleanup:
deprecate legacy `reconciliation` task"; `engineering-team/stories/task-queue-scheduler/23-reconciliation-rearchitecture.md`.
