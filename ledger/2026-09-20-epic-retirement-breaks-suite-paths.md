# Retiring an epic to done/ breaks any suite that cites its story or ADR by the in-flight path

**Id:** 2026-09-20-epic-retirement-breaks-suite-paths
**Type:** meta
**Opened:** 2026-09-20 (book close `shared-concepts-row-detail`, retro finding 5)
**Status:** OPEN
**Done:** —

Book close step 9 moves an epic's `stories/`, `decisions/` and `reviews/` folders under `done/`. Any
test that holds one of those documents as a path constant then reads a file that no longer exists.

**Hit live during this book's own close.** `test/shared-concepts-row-detail.test.js` held:

```js
const ADR   = path.join(ROOT, 'engineering-team/decisions/shared-concepts-row-detail/0001-….md');
const STORY = path.join(ROOT, 'engineering-team/stories/shared-concepts-row-detail/1-….md');
```

Immediately after the step-9 move, its two D-class tests failed (`19 passed, 2 failed`) — the book
close broke the book's own suite. Step 10's "run the gate **after** the flip and the epic close-out"
is what caught it; in the other order the close would have committed green and the breakage would
have surfaced in a later session with no obvious cause.

Fixed in that suite by resolving either location, since the assertions are about what the documents
*say*, not where they sit:

```js
function epicDoc(kind, file) { /* try <kind>/<epic>/, then <kind>/done/<epic>/ */ }
```

**The trap is loaded elsewhere.** Scanning `test/*.test.js` for load-bearing epic-doc path constants
with block comments stripped and lint/stats fixtures excluded: **31 constants, of which 4 point at
in-flight epic documents that will move when their epic retires.** None is broken today.

| Suite | Cited document | Epic that will move it |
|---|---|---|
| `attach-the-world.test.js` | `decisions/second-brain/0003-record-based-decomposition-and-validated-goal-writes.md` | `second-brain` |
| `break-a-goal-into-pieces.test.js` | `decisions/second-brain/0002-hygiene-check-and-primary-property-reconcile.md` | `second-brain` |
| `manual-task-retrigger-after-finish.test.js` | `decisions/task-queue-scheduler/0012-task-queue-phase-1-bullmq.md` | `task-queue-scheduler` |
| `task-queue-semaphore-protection-audit.test.js` | `decisions/task-queue-scheduler/0013-task-queue-neo4j-resource-class.md` | `task-queue-scheduler` |

(References to `engineering-team/stories/_intake.md` are safe — that file never moves. Suites already
citing `done/` paths are safe for the opposite reason.)

**Why it is worth a row:** the breakage is invisible until an unrelated session closes an unrelated
book, and it lands on whoever runs the gate next, far from the cause. `second-brain` has a closed
book already and `task-queue-scheduler` is active, so both retirements are plausible near-term.

**Fix shape:** either (a) a small shared helper in `test/helpers/` that resolves an epic document in
both locations, adopted by the four suites above — the pattern this book's suite now uses; or (b) a
line in `workflows/6-book-close.md` step 9 telling the closer to grep `test/` for the epic slug
before moving folders. (a) is durable and (b) is free; they are not exclusive.

**Pointer:** `engineering-team/workflows/6-book-close.md` steps 9–10;
`test/shared-concepts-row-detail.test.js` (`epicDoc`); audit
`engineering-team/audits/shared-concepts-row-detail/audit.md` §7.
