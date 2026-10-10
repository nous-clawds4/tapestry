# Review: Story 6 — Task control is for the owner and admins

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-10
**Diff:** `git show 1b3d538f 742a7e32`, the fix on `staging`. The same trees reached `main` as `44b903f1` and
`b0fc5510` (PR #840, merge `46c8254b`); `git diff 1b3d538f 44b903f1` and `git diff 742a7e32 b0fc5510` are both empty.
Also `git show 0f028254`, the record: story, test plan, book, epic. Read on `staging` at `0f028254`. Shipped as a hotfix
before its record; this is the first independent read.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS.** `npm run gate:status -- --label reviewer-sae4-6-r2`:
      `20261010T050008Z-10501-dbeb [reviewer-sae4-6-r2] started 2026-10-10T05:00:08.729Z on 0f028254 — PASS, exit 0, 5548 passed, 0 failed, 582 skipped, 293/293 suites`.
      The `tagging-edges-realtime-wrapper` RW7 flake did not appear.
- [x] Focused suites: `task-routes-owner-admin` 5 passed, 0 failed; `negentropy-sync-access` 10 passed, 0 failed;
      `negentropy-sync-presets` 95 passed, 0 failed.
- [x] Fails before the fix, as the test plan says. I used detached scratch worktrees, since removed:
      - `task-routes-owner-admin` on `3ace19de`: T2 and T5 failed; T1, T3 and T4 passed.
      - A10 and P12 on the tree before `742a7e32`: each failed alone.
- [x] `bash scripts/harness-lint.sh` — clean (0 violations), exit 0.
- [x] Live, anonymous, side-effect-free, on production and staging:
      - `POST /api/run-task` and `/API/run-task` with no task name → 401;
      - `GET /api/strfry/negentropy-presets` → 401 (and 401 capitalized);
      - the neighbouring reads reach their handlers: `scheduled-tasks/list` and `/registry-tasks` → 200;
        `scheduled-tasks/status` and `customer-schedule/history` with no parameter → the handler's own 400.
- [x] Shipping facts: PR #840 merged into `main` as `46c8254b` (GitHub REST, 2026-10-10T04:45:08Z). Deploy run 144 on
      `46c8254b` completed successfully. `staging` deploy run 564 on `742a7e32`.
- [ ] `npm run test:playwright` — not applicable (no UI change).
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._

## Spec adherence
- [x] Every acceptance criterion has a passing test:
      - AC-1: T1.
      - AC-2: T2 (three capitalizations each) and T5 (the list entries).
      - AC-3: T3 covers the direct-local caller. The owner or admin pass is the existing `isOwner` shared by every
        owner-only entry; the test plan says so, and P12 covers it for the presets list through its stub.
      - AC-4: T4.
      - AC-5: A10 (wiring) and P12 (owner 200, signed-in non-owner 403, not signed in 401).
- [x] No criterion is silently dropped.
- [x] No behavior added that isn't in the story.
- [ ] **The user-facing description claims more than shipped.** See Blocking 1.

## ADR adherence
- [x] No ADR. Architecture was skipped: the fix adds six entries to an existing list and mounts story 4's existing guard
      on one more route, which the strictness table allows for bugs.
- [x] Files changed:
      - `src/middleware/auth.js:436-443` (the six entries, POST-only like the rest of the list);
      - `src/api/strfry/negentropyPresets.js:403` (the list GET behind `requireSyncManager`);
      - the new suite, A10, P12 and `test/registry.js`.
- [x] No new dependencies. `negentropyPresets.js` now requires `negentropyAccess.js`. That module requires only
      `src/middleware/auth.js`, so there is no cycle.

## Concept-graph integrity
- [x] No concepts, handles, event kinds or firmware touched. No reinstall needed.

## Things tests can't catch

**Do the substring matches over-match anything a non-admin needs?** No.
- I listed every API path literal under `src/api`. No registered path except the six contains `/run-task`,
  `/scheduled-tasks/create|update|delete` or `/customer-schedule/update|trigger`.
- The matching is POST-only, so the neighbouring GETs are untouched in any case.
- A parameter segment could carry `/run-task` into a path. The parameterized POST routes are `concept/:handle/*` (a
  handle starts with a kind number), `io/imports/:tempId/execute` (a random id) and `tapestry-key/*` (an owner surface).
  None of them has a legitimate non-admin value starting `run-task`.
- The two lists consulted before the owner-only list don't intersect the six: the `/negentropy-sync` early pass and
  `customerOrOwnerEndpoints`.

**Is any other route that starts or schedules a registered task still open to signed-in sessions?** No route that
dispatches through the registry is open:
- BullBoard can retry or promote jobs, and it is mounted with `requireOwnerOrAdmin`
  (`src/manage/taskQueue/queue/bullBoardMount.js:58`).
- The tagging-edges enqueue is behind `requireOwnerOnly` (`src/api/index.js:528`, `tagging-edges/index.js:333`).
- Every route that runs a registry script directly is on the owner-only list or behind a route guard: the
  generate/calculate/export POSTs, `brainstorm-control`, `run-script`, `batch-transfer`, `reconciliation`,
  `neo4j-setup-constraints-and-indexes`, `process-all-active-customers`, and the three legacy sync POSTs.
- Two designed, signed-in triggers run registry work in-process, both deliberate:
  - `trusted-list/notify-applicability` is debounced and republishes only on change (ADR tag-applicability/0003);
  - `trusted-list/refresh-pinned-tags-for-viewer` refreshes only the caller's own pins.

One route is the exception to the story's wider wording (Blocking 1). `POST /api/publish-kind30382`
(`src/api/index.js:184` → `src/api/export/nip85/commands/kind30382.js:16-47`) checks only that the caller is signed in,
and no middleware list names it. It spawns `src/algos/nip85/brainstorm-publish-kind30382.js`. That script signs this
instance's kind 30382 scores with the owner's assistant key and imports them for the router to send out. It is a
near-copy of the script the registry's `exportOwnerKind30382` task runs (`publish_kind30382.js`, via `publishNip85.sh`).
So a signed-in non-owner can still start the signed score export, just not through the task routes. The route
predates this story. It belongs to the class that `stories/_intake.md:1814` (2026-07-21, "gate authenticated-non-owner
access to admin mutations") and OPEN.md row 276 track, together with `meili/resync`, `firmware/install`,
`streaming-etl/control` and `trusted-list/publish`.

**Is leaving the neighbouring reads public sound?** Yes.
- What they show: scheduled-tasks list, status, history and registry-tasks, and customer-schedule status and history,
  give task names, intervals, run times and entry arguments. On production the only argument value is one customer
  pubkey, and `GET /api/get-customers` already lists every customer anonymously.
- The presets schedule entry carries no arguments, so the relays and filters stay behind the now-guarded presets list.
- This matches the other public task dashboards (task-dashboard, task-explorer, task-watchdog).
- The story leaves the question to the owner (Out of scope). Nothing here needs it decided now.

**Callers.** The direct-local pass still serves the one non-page caller. The customer scheduler calls
`POST http://127.0.0.1:7778/api/run-task` in-process (`src/api/customer-schedule/index.js:67`). It arrives over loopback
with no forwarding header, so it gets `req.localTrusted` before the owner-only list is consulted; T3 pins that path.
The page callers are Settings, Relay Settings, the task explorer and customer management. All but the task explorer
check for the owner client-side (see non-blocking 3).

- [x] No secrets in the diff.
- [x] No debug logging added.
- [x] No commented-out code.
- [x] Refusals use the middleware's existing 401/403 answers. The presets list uses story 4's guard and its
      `{ success: false, error }` shape. Both answer HEAD too: the middleware's list is POST-only, and route guards run
      for HEAD.
- [x] Concurrency: list membership only, with no state.

## House rules check
- [x] Concept Graph API authority respected (not touched).
- [x] No new lint/typecheck/build tooling.
- [x] TA pubkey not involved.

## Product-guide adherence
- N/A: no-PRD book.

## Findings

### Blocking

1. **`engineering-team/stories/security-auth-exposure/6-task-control-owner-and-admins.md:32-33` — the user-facing
   description says more than shipped.**
   - **The claim.** "…so that a stranger who signs in cannot run heavy recomputes, publish signed exports or start
     syncs on my instance."
   - **What is true.** Starting syncs is closed (story 4 plus this story). The other two clauses are not true of the
     system:
     - a signed-in non-owner can still start the signed kind 30382 export through `POST /api/publish-kind30382` (see
       above);
     - they can still start heavy work through `POST /api/search/profiles/meili/resync` (a full re-index) and
       `POST /api/firmware/install`.
   - **Why it blocks.** These are the authenticated-non-owner class the owner deferred, not regressions from this diff.
     But the record states, as a result of this story, that they are closed. This is the same kind of overclaim as
     story 4's round-1 Blocking 1. A reader deciding how urgent that sweep is would be misled.
   - **Asked change** (record only; the code is correct and stays):
     - (a) Narrow the sentence to what the six routes control. For example: "…so that a stranger who signs in cannot
       start or schedule the instance's registered tasks (recomputes, signed exports and syncs among them)."
     - (b) Add an Out-of-scope bullet: other admin mutations stay open to signed-in non-owners, tracked by
       `stories/_intake.md` 2026-07-21 and OPEN.md row 276. Name `POST /api/publish-kind30382` there as the one
       remaining route that launches the same work as a registered task.
     - (c) Add a dated addendum to that intake entry. It should say that story 6 closed `run-task`,
       `scheduled-tasks/create|update|delete` and `customer-schedule/update|trigger`, all of which the entry names as
       exposed. It should name `publish-kind30382` as a member, and note that `streaming-etl/control` remains.

### Non-blocking

1. **`6-…md:11` — "Six routes start a registered task or change what runs on a schedule".** BullBoard
   (`/admin/queues`) also starts registered tasks (retry, promote); it was already behind `requireOwnerOrAdmin`.
   Optional: "Six routes, with no caller check, …".
2. **`6-…md:25` — "No loopback script calls them over HTTP".** True of scripts, but the in-process customer scheduler
   calls `/api/run-task` over loopback (`src/api/customer-schedule/index.js:67`) and depends on the direct-local pass.
   Optional: name it, so a later change to that branch, or to case-sensitive routing (ledger
   `2026-10-10-case-sensitive-routing`), keeps it working. This fits naturally in the same edit as Blocking 1.
3. **`6-…md:23` — "Every caller is an owner page".** `public/pages/manage/task-explorer.html` and `task.html` have no
   client-side owner check, so a non-admin who opens one sees Run buttons that now answer 403. This is harmless and
   only UX; out of scope.
4. **Test plan, AC-3.** The owner or admin pass is not exercised against the real middleware (`isOwner` reads
   `/etc/brainstorm.conf`). Accepted: it is the same check every owner-only entry uses, and P12 covers it for the
   presets list.

### Harness friction
1. None new. Frame bullet 7 was ticked before review; that is recorded in story 4's round 2 against
   `ledger/2026-10-10-frame-ticked-before-review.md`. This story is also the second time an after-the-fact record
   generalized past its diff ("cannot run heavy recomputes, publish signed exports"). That is the pattern
   `ledger/2026-10-10-after-the-fact-record-misses-siblings.md` describes; add it there as evidence.

## Verdict
**CHANGES_REQUESTED**

The shipped code is correct, well pinned and should stay in production. The six task-control POSTs are for the owner,
admins and direct-local callers under every capitalization; the presets list is guarded like the sync status; nothing
legitimate is over-matched; and the neighbouring reads stay public, which is sound. The block is on the record: the
story's "so that" claims signed exports and heavy recomputes are now out of a signed-in stranger's reach, and they are
not. Three small edits (Blocking 1 a–c) fix it.

## Close-out
- Story status stays In Progress until the record edit is reviewed.
- Completion detection was not run, because the verdict is not a pass.

# Round 2

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-10
**Diff:** `git show deca5b15 -- engineering-team/stories/security-auth-exposure/6-task-control-owner-and-admins.md
engineering-team/stories/_intake.md` (the record correction). Read on `staging` at `deca5b15`. Story 6's code has not
changed since round 1: `git diff --stat 0f028254 deca5b15 -- src test bin scripts ui public` shows only story 7's fix
(`src/middleware/auth.js`, `test/auth-head-requests.test.js`, `test/registry.js`) and `50117a3c`
(`test/negentropy-sync-access.test.js`). The six list entries and the presets mount are as reviewed in round 1.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS.** `npm run gate:status -- --label reviewer-sae6r2-7`:
      `20261010T145542Z-14650-1898 [reviewer-sae6r2-7] started 2026-10-10T14:55:42.855Z on deca5b15 — PASS, exit 0, 5553 passed, 0 failed, 582 skipped, 294/294 suites`.
      The `tagging-edges-realtime-wrapper` RW7 flake did not appear.
- [x] Focused suites: `task-routes-owner-admin` 5 passed, 0 failed; `negentropy-sync-access` 10 passed, 0 failed;
      `negentropy-sync-presets` 95 passed, 0 failed; `auth-path-case` 5 passed, 0 failed; `auth-head-requests` 5 passed,
      0 failed.
- [x] `50117a3c` (A7 and A10 no longer skip). In a scratch worktree at `deca5b15` with
      `src/api/strfry/negentropyPresets.js` removed, `negentropy-sync-access` gives 8 passed, 2 failed: A7 and A10. The
      suite as it was before `50117a3c`, on the same tree, gives 10 passed: the old guards hid the missing module. The
      module is on `origin/main`. This closes story 4's round-2 non-blocking 3. Worktree removed.
- [x] `bash scripts/harness-lint.sh` — clean (0 violations), exit 0.
- [x] Live, anonymous, side-effect-free, on production and staging: `POST /api/run-task` with no task name → 401;
      HEAD `/api/strfry/negentropy-presets` → 401 (the route guard answers HEAD as it answers GET).
- [ ] `npm run test:playwright` — not applicable (no UI change).

## Blocking 1 — resolved

Blocking 1 asked for two things. The record must not say that signed exports and heavy recomputes are out of a
signed-in stranger's reach. And a reader weighing the sweep must not be misled. I re-derived each changed statement,
my own suggested wording included.

- **(a) The "so that" sentence** (`6-…md:33-35`) now reads "cannot start or schedule the instance's registered tasks
  (recomputes, exports, syncs) through the task routes". This is true:
  - the six task routes are on `ownerOnlyEndpoints` (`src/middleware/auth.js:440-445`), and T2 pins them under every
    capitalization;
  - BullBoard is the only other HTTP path that acts on registered tasks, and it is behind `requireOwnerOrAdmin`
    (`src/api/index.js:561` → `src/manage/taskQueue/queue/bullBoardMount.js:58`).

  "Through the task routes" limits the claim to what shipped. The sentence no longer says the effects are
  unreachable. Dropping "signed" from my wording is fine, because the registry also has unsigned exports.
- **(b) The Out-of-scope bullet** (`6-…md:54-57`) names the class and points at the 2026-07-21 intake entry. It says
  some members "reach the same effects by other means", and it records the owner's decision to sweep. That sentence is
  true: at least one open member launches work that a registered task also runs, and others start heavy work (round 1,
  above; I don't repeat them here).

  The bullet does not name the member I asked for. Deviations (`6-…md:72-73`) records why. I accept this. The point of
  naming it was that no reader should take those effects as closed, and "reach the same effects by other means" says
  that. The owner has decided the sweep, so the urgency question that worried round 1 is settled. The bullet does not
  cite OPEN.md row 276; that is optional.
- **(c) The intake addendum** (`stories/_intake.md:1847`) is dated. It says which routes story 6 put on the owner-only
  list. It says `streaming-etl/control` is still open, which I verified: the route at `src/api/index.js:483` has no
  route guard, its handler has no owner check, and neither middleware list names it. It also records the owner's sweep
  decision.

  The addendum does not repeat my round-1 phrase "all of which the entry names as exposed". That is good, because the
  phrase was wrong. The entry names `run-task`, and its 2026-09-30 addendum names `scheduled-tasks/create|update|delete`,
  but neither names `customer-schedule/update|trigger`.

**Round 1's non-blocking items.**
1. BullBoard: taken (`6-…md:12`), and verified as above.
2. The loopback scheduler: taken (`6-…md:25-26`), and verified. `src/api/customer-schedule/index.js:66-68` POSTs to
   `http://127.0.0.1:7778/api/run-task` with no forwarding header, so it gets `req.localTrusted`
   (`auth.js:357-371`) before the owner-only list is consulted. T3 pins it.

   "Nothing outside the process calls them" also holds. I searched the repo, outside `test/` and `engineering-team/`,
   for the six paths. The other hits are the owner pages the Background names, the route registrations, comments,
   docs and one Playwright spec. No script or cron calls them.
3. The task explorer pages: unchanged. Out of scope, as round 1 said.
4. Accepted in round 1.

## Findings (round 2)

### Blocking
None.

### Non-blocking
1. **`6-…md:57` — "this story closes only the task routes".** The story also guards the presets list (AC-5). In its
   bullet ("Other admin actions…") it reads as "of that class", and the presets list is a read, not an admin action.
   Optional: "of that class, this story closes only the task routes".

### Harness friction
1. Round 1 asked for this story to be added as evidence on
   `ledger/2026-10-10-after-the-fact-record-misses-siblings.md`. The row has not changed since `0f028254`. It is still
   worth doing, and story 7's record is a third instance (review 7, Blocking 1). No new row is needed.

## Verdict
**PASS**

The record now matches what shipped. The purpose is narrowed to the task routes. The open class is named, with its
pointer and the owner's decision. BullBoard and the loopback scheduler are described accurately. Story 6 is Done.

## On PASS
- [x] Story `**Status:**` flipped to `Done` in place (and the epic's line for story 6).
- [x] Completion detection performed; the result is reported in the hand-off, not in this file.
