# ADR 0001: A session-bound Scores read and Recalculate route, enqueued on the task queue

**Status:** Accepted
**Date:** 2026-10-13
**Story:** `engineering-team/stories/assistant-scores/1-the-scores-page.md`
**Amends:** `task-queue-scheduler` ADR 0012 and ADR 0022, the customer jobId separator only (Amendment 1). Their
bodies are unchanged; each gains an **Amended by** header pointer.

## Context

The story replaces the hub's Scores placeholder (`/assistant/trusted-assertions`) with a page that shows when the
viewer's own Assistant last published Trusted Assertions (kind 30382) and how many, and gives the Owner and active
Customers one button that recalculates and republishes their own scores, one run at a time (AC-1 to AC-6).

The stack is absent this session (AGENTS.md §2 fallback). The story touches no concept definitions; it reads and
starts work on events and tasks only, so there are no handles to verify.

What exists, on `staging` at `9d65b2e3`:

- **Whose Assistant.** `getAssistantPubkeyFor(pubkey)` (`src/utils/assistantKeys.js`) is the one main→delegate
  mapping: the Owner gets the instance TA, anyone else their own relay key, or null. Every `/api/assistant/*` route
  takes the viewer from the session and nothing from the request (e.g. `createPublishDutyMenuHandler`,
  `src/api/assistant/dutyMenuPublish.js:183`).
- **Whose pipeline.** The Owner's scores are calculated, signed by the TA and loaded into search by
  `updateAllScoresForOwner` (registry children: hops, PageRank, GrapeRank, follows/mutes/reports, report scores,
  whitelist, `exportOwnerKind30382`, `loadOwnerScoresIntoMeilisearch`; 4 h timeout). A Customer's are calculated by
  `processCustomer` (`prepareNeo4jForCustomerData` + `updateAllScoresForSingleCustomer`, which ends with the
  customer's `publishNip85.sh` and `loadScoresIntoMeilisearch.sh`), which needs a CustomerManager record. An Admin
  without one, or a guest, has no pipeline here (book § Decisions 2).
- **Starting a run.** `POST /api/run-task` and `POST /api/customer-schedule/trigger` are `OWNER_ACTION` in the route
  table (`src/middleware/routeAccess.js:172,361`). With `TASK_QUEUE_ENABLED=true` (the template default since story #17;
  staging and production), run-task enqueues on the task's own BullMQ queue through `enqueueTask`
  (`src/manage/taskQueue/queue/index.js:190`). Its jobId is `computeJobId(taskName, customerArgs)`:
  `processCustomer:<pubkey>` or `updateAllScoresForOwner`. A second add with the same jobId while the first is waiting
  or active joins it (ADR 0022). Scheduled fires carry `{ taskName, entryId, timeoutMs }` and get BullMQ's own ids, so
  they don't dedupe against a manual run. Per-task concurrency defaults to 1, so two jobs on one task queue never
  overlap, and `launchChildTask.sh`'s pgrep guard skips a launch whose script is already running.
- **"Last landed".** The self-Map check already reads the newest Assistant-signed 30382 from this instance's strfry
  (`readUpkeep`, `src/api/assistant/selfMap.js:185-186`: `scanLocal({ kinds: [30382], authors: [A], limit: 1 })`,
  then `newest()` over the author/kind-filtered result). Both publishers re-sign every event every run, so that event's
  `created_at` is when the Grapevine was last published. `selfMap.js:53-55` also names the tasks whose runs re-sign an
  Assistant's Scores: `OWNER_SCORE_TASKS`, `ALL_CUSTOMER_SCORE_TASKS`, `ONE_CUSTOMER_SCORE_TASKS` (ADR
  assistant-self-map/0001 sub-decision 6).
- **Counting.** `strfry scan --count <filter>` is how `/api/strfry/scan/count` and `export/nip85/queries/info.js:114`
  count an author's 30382s.
- **Route table.** ADR security-auth-exposure/0005: every route needs an entry, an action opened to `signed-in` carries
  a `why`, and an unlisted route is the owner's side's. The route-walk suite names any route without one.
- **The page frame.** Built action pages are registered in `ACTION_PAGES` by action key (`ui/src/App.jsx:152`); their
  words live in a Node-loadable `*Copy.js` beside them (`dutyMenuCopy.js`); `ui/src/utils/timeAgo.js` exports a pure
  `timeAgo(unixSeconds)`.

Constraints: JS without a build; no new dependency; the viewer and their pipeline come from the session alone (AC-4);
the page must not claim a run either way when it can't tell (story § Open questions); POV-first and decentralized-first
are untouched (this reads the viewer's own Assistant's events and starts the viewer's own run; nothing is gated at
write time).

## Options considered

### Option A — A new session-bound module with one read and one action, enqueuing directly on the task queue

`src/api/assistant/scores.js` serves `GET /api/assistant/scores` (the page's one answer) and
`POST /api/assistant/scores/recalculate` (the button). Both resolve the viewer from the session, the Assistant through
`getAssistantPubkeyFor`, and the pipeline from the viewer's role. The action calls `enqueueTask` with the same task
names, customer args and jobId run-task would use. The run state is read from the same queues, using `selfMap.js`'s
three task lists.

- Pros: nothing an operator route allows is widened; the request can't name anyone; dedup is the queue's own (same
  jobId as run-task); the "is a run of mine in progress?" rule is the self-Map check's, so the two pages can't disagree;
  fully testable through injected seams like every other `/api/assistant/*` module.
- Cons: with the queue off (the rollback path) the page can't start a run and answers 503; a run started outside the
  queue isn't seen (see Consequences).

### Option B — Open `/api/run-task` (or `/api/customer-schedule/trigger`) to signed-in callers, clamped to their own pubkey

Change the route-table entry to `signed-in` and add a handler check: a non-owner may only run an allowlisted task with
`pubkey` = session.

- Pros: smallest server diff; works on the legacy direct-spawn path too.
- Cons: widens a generic operator surface that takes `taskName` and arbitrary query params. The allowlist and the clamp
  would live inside a generic handler, which is exactly the shape ADR security-auth-exposure/0005 moved away from. It
  also gives no status read, so a second route is needed anyway. Rejected.

### Option C — Client-side reads, a server route only for the press

The page reads the latest event and the count through the public `/api/strfry/scan` and `/scan/count` with
`user.assistantPubkey`, and only `POST …/recalculate` is new.

- Pros: one route instead of two.
- Cons: the page can't tell an Admin who is also a Customer from one who isn't (`classification` says `admin` for
  both), and can't see the queue, so it still needs a server read for AC-3 and AC-5. Two sources of "whose Assistant".
  Rejected.

### Option D — Option A, but the action calls `/api/run-task` over loopback (the customer-schedule pattern)

- Pros: inherits the legacy path when the queue is off.
- Cons: a second HTTP hop with a hard-coded port (`customer-schedule/index.js:67` does this today), and the run-state
  read needs the queue module anyway. Rejected; the queue-off case is the rollback path, and refusing honestly there is
  enough.

## Decision

We chose **Option A**. The page gets one session-shaped answer and one session-bound action. The action enqueues the
viewer's own pipeline on the existing per-task queues, with run-task's jobIds, so an operator's manual trigger and a
press join one run. "A run of mine is in progress" is read with the self-Map check's own task lists.

### Sub-decisions

1. **Pipeline by role, from the session.** Owner (session pubkey = `BRAINSTORM_OWNER_PUBKEY`) → `updateAllScoresForOwner`.
   Otherwise an active Customer (CustomerManager record with `status === 'active'`, whatever their admin status) →
   `processCustomer` with customer args built as `entryResolver.js:184-188` builds them (`pubkey`, `customerId` as a
   string, `customerName`). Anyone else → no pipeline. `updateAllScoresForOwner`, not `processAllTasks`: it recalculates
   and republishes the Owner's scores without the instance-wide sync, reconciliation and every Customer's run.
2. **Last published and how many.** `latestAt` is the `created_at` of the newest kind 30382 authored by the viewer's
   Assistant on this instance's strfry, read as `readUpkeep` reads it (scan with `limit: 1`, then `newest()` over the
   events whose `kind` and `pubkey` match). `count` is `strfry scan --count` with the same filter minus the limit, run
   with `execFile` (argv, no shell) under a timeout. The two reads run together and fail separately: a failed scan
   makes `published.finished` false and is never read as "not yet"; a failed count leaves `count` null.
3. **Run state.** `'running'` if any matching job is `active`, else `'queued'` if any is `waiting` or `prioritized`,
   else `null`. Never `delayed`: a Job Scheduler's next fire sits there. A job matches when its queue's task is in
   `OWNER_SCORE_TASKS` (Owner), or in `ALL_CUSTOMER_SCORE_TASKS` (Customer), or in `ONE_CUSTOMER_SCORE_TASKS` and it is
   the viewer's: `data.customerArgs.pubkey` is the viewer, or `data.entryId` names a schedule entry whose
   `args.customer` is the viewer (lowercased, as `scheduleIntervals` compares). It's `'unknown'` when the queue is off
   (`TASK_QUEUE_ENABLED` not exactly `"true"`), unavailable (`isQueueAvailable()` false), or any read throws. It's
   `null` with no pipeline (nothing is read).
4. **The press.** Refusals first, in order, each starting nothing: 401 `not-signed-in`; 403 `no-assistant`; 403
   `no-pipeline`; 503 `queue-unavailable` (run state `'unknown'`); 409 `already` when the run state is `'running'` or
   `'queued'` (the answer carries it). Otherwise it calls `enqueueTask({ taskName, customerArgs, queryParams: {},
   timeoutMs })`, with `timeoutMs` from `resolveTaskTimeout(taskDef, registry)` as the scheduler does. It answers 202
   `{ success: true, run: 'queued' }`. Two presses that race past the check share run-task's jobId, so BullMQ keeps one
   job (AC-3). Nothing in the query or body is read (AC-4).
5. **The read.** `GET /api/assistant/scores` is `PUBLIC_READ` in the route table and session-shaped, like
   `/api/assistant/attention`: signed out → `{ success: true, signedIn: false }` with no reads; no Assistant →
   `{ success: true, signedIn: true, hasAssistant: false }`; otherwise
   `{ success: true, signedIn: true, hasAssistant: true, assistantPubkey, published, pipeline, run }`, where
   `published` is `{ finished: true, latestAt: <unix s>|null, count: <int>|null }` or `{ finished: false }`, and
   `pipeline` is `'owner' | 'customer' | null`. It's a read: it starts nothing, so the route walk's `read` kind holds.
6. **The page.** `/assistant/trusted-assertions` gets its own page (`ACTION_PAGES['trusted-assertions']`), in the Duty
   Menu page's frame: back link, the action's title ("Scores") and description, then the status lines, then the button
   for a pipeline, else the no-pipeline line. It fetches the read once on mount (no polling, story § Out of scope). It
   shows the button only when `pipeline` is set, and disables it while `run` is `'running'` or `'queued'` (or while
   its own press is in flight). After a press it shows the answer's words and asks the read again. Signed out and no
   Assistant read as on the other hub pages (`ASSISTANT_COPY.signedOutLine`, `noAssistantLine`). The hub's Scores card,
   its mark and `actions.js` are unchanged (AC-6), so the card's `editLink` ("Manage your Treasure Map →") still shows
   at the foot of the page.
7. **Words.** The story's § Copy, plus one state it did not name: when `published.finished` is false,
   "Last published: couldn't be read right now" (and no count line). The refusal reasons fill "Couldn't start a
   recalculation: {reason}" as lowercase fragments; the server sends `code`, the page owns the words.

## Consequences

- **Customers can start neo4j-heavy work themselves.** It's bounded per person by one-at-a-time, and per task by the
  queue's concurrency of 1 plus the resource semaphore: a busy instance queues presses, it never runs two
  `processCustomer` at once. While a pressed run is active, `/api/deploy-safety/status` reads unsafe (it counts active
  jobs on both trigger paths), so presses can delay a deploy by up to a run's length.
- **"Running" can over-report for a Customer.** During `processAllTasks` or `processAllActiveCustomers` the page says
  running even after that Customer's part finished. That's the self-Map check's reading, kept for agreement, and it is
  the safe direction: the button is off while the orchestrator still holds the script.
- **A run started outside the queue isn't seen**: the legacy direct-spawn path, the bare-metal systemd timer, or an
  operator's shell. A press then enqueues a job that `launchChildTask.sh`'s guard turns into a no-op if the script is
  still running. Nothing runs twice.
- **The queue off means no press.** The read says `run: 'unknown'` and shows the button; a press answers 503 with its
  reason. This is the rollback path (OPERATIONS.md §10.1), not a normal state.
- **The pipeline names live in two places**: here (`updateAllScoresForOwner`, `processCustomer`) and in `selfMap.js`'s
  three lists (which also include both). If a Customer's pipeline is renamed, both change; a test pins that each name
  this module enqueues is in the matching `selfMap.js` list.
- **Follow-ups (not this story):** Admins without a Customer record (book § Decisions 2); live progress; letting the
  hub's Scores mark flag stale scores.
- **Firmware reinstall required?** No. No concept definitions change.

## Implementation notes

Server:

- `src/api/assistant/selfMap.js` — add `OWNER_SCORE_TASKS`, `ALL_CUSTOMER_SCORE_TASKS`, `ONE_CUSTOMER_SCORE_TASKS` to
  `module.exports` (values unchanged). Nothing else in the file changes.
- New `src/api/assistant/scores.js`, in `dutyMenuPublish.js`'s shape (`'use strict'`, a header naming this ADR,
  `defaultDeps()` required lazily so the module loads in a bare checkout, `create…Handler(deps)` factories):
  - `defaultDeps()`: `getConfigFromFile`, `getAssistantPubkeyFor`, `getCustomer(pubkey)` (a fresh `CustomerManager`,
    `initialize()`, `getCustomer`), `scanLocal` (`setup/status.scanLocalStrict`), `countLocal(filter)` (`execFile('strfry',
    ['scan', '--count', JSON.stringify(filter)])` with a 15 s timeout, resolving the parsed integer and rejecting on error
    or a non-integer), `taskQueue()` (lazy `require('../../manage/taskQueue/queue')`), `readScheduleEntries` (as
    `selfMap.js`'s), `loadRegistry` (the registry JSON), `resolveTaskTimeout`, `now`.
  - `resolveViewer({ viewer }, d)` → `{ assistantPubkey, pipeline: 'owner'|'customer'|null, customerArgs }`.
  - `readPublished({ assistantPubkey }, d)` → `{ finished, latestAt, count }` (sub-decision 2). Reuse
    `require('./attention').newest`.
  - `readRunState({ viewer, pipeline }, d)` → `'running'|'queued'|'unknown'|null` (sub-decision 3), over
    `getQueue(task).getJobs(['active'])` and `getJobs(['waiting', 'prioritized'])` for each task in the relevant lists.
    A task with no queue is skipped.
  - `createScoresStatusHandler(deps)` / `handleScoresStatus`, and `createRecalculateHandler(deps)` /
    `handleRecalculateScores` (sub-decisions 4 and 5). Export `CODES`, the pipeline task names
    (`PIPELINE_TASKS = { owner: 'updateAllScoresForOwner', customer: 'processCustomer' }`) and the pure helpers.
  - Log one line per press (`[assistant/scores] <viewer prefix> → <task> queued`) and per refusal other than 401.
- `src/api/index.js` — register beside `/api/assistant/self-map`, with a one-line comment naming this ADR:
  `app.get('/api/assistant/scores', …handleScoresStatus)` and
  `app.post('/api/assistant/scores/recalculate', …handleRecalculateScores)`.
- `src/middleware/routeAccess.js` — `'GET /api/assistant/scores': PUBLIC_READ` and
  `'POST /api/assistant/scores/recalculate': allow('signed-in', "Recalculates your own scores; whose run comes from your session, and only the Owner and active Customers have one here.")`.
- `src/api/openapi.yaml` — both paths, beside `/api/assistant/self-map`.
- `BIBLE.md` — two rows in the API table beside `/api/assistant/self-map` (around line 531), stating the session
  binding, the role → task mapping, the refusal order and the 409/202 answers.

Client:

- New `ui/src/pages/assistant/scoresCopy.js` (Node-loadable: imports with explicit `.js`, no React): the words
  (`SCORES_COPY`, story § Copy plus sub-decision 7), `REASONS` by code, and pure helpers:
  `lastPublishedLine(published, nowSeconds)` (date via `new Date(latestAt * 1000).toLocaleString()` plus `timeAgo`),
  `countLine(published)` (null when there's no count), `runLine(run)` (null for `null` and `'unknown'`), and
  `buttonState(answer, pressing)` → `{ show, disabled }`.
- New `ui/src/utils/assistantScores.js`: `fetchAssistantScores()` and `recalculateAssistantScores()`. The page's only
  network calls go through these.
- New `ui/src/pages/assistant/Scores.jsx`: the page (sub-decision 6). Reuse the Duty Menu and Identification Tags
  pages' classes (`bs-setup-main`, `bs-setup-back`, `bs-setup-title`, the `bs-idtags-*` card and result classes); add
  CSS only for a state no existing class covers.
- `ui/src/App.jsx` — import the page and add `'trusted-assertions': <ScoresPage />` to `ACTION_PAGES`, extending the
  comment above it with this story.

Branches: a feature, built on `staging` and promoted to `main` the usual way; no other live branch needs a port.

## Out of scope

- Calculating for Admins without a Customer record, a cooldown, live progress and scheduling (story § Out of scope).
- Changing who may use `/api/run-task` or `/api/customer-schedule/*`.
- Seeing runs started outside the queue, or making the queue-off path start runs.
- Any change to the hub's Scores check (`trustedContent.js`) or the self-Map check beyond the three exports.

## Amendment 1 (2026-10-14): the customer jobId BullMQ accepts, and the review's ride-along fixes

**Why.** Review round 1, Blocking 1 (`engineering-team/reviews/assistant-scores/1-the-scores-page.md`):
- Sub-decision 4's premise is false for Customers. `computeJobId` (`src/manage/taskQueue/queue/index.js:64-69`) gives a
  customer task the jobId `` `${taskName}:${pubkey}` ``.
- BullMQ 5.76.10 (`package-lock.json`) rejects any custom jobId whose `split(':')` length isn't 3, with "Custom Id cannot
  contain :" (`node_modules/bullmq/dist/cjs/classes/job.js:1043-1045`).
- So no Customer's press can be enqueued. Neither can any customer task through `/api/run-task`'s queue branch, which
  includes the per-Customer scheduler's loopback triggers (ledger row `2026-10-14-run-task-customer-jobid-rejected`).
- BullMQ's own `Job#validateOptions` reproduces the rule without Redis: `processCustomer:<hex>` is rejected,
  `processCustomer-<hex>` and `updateAllScoresForOwner` pass, and an all-digit id is rejected ("Custom Id cannot be
  integers").

**Decision.**

1. **The customer jobId becomes `` `${taskName}-${customerArgs.pubkey}` ``; the non-customer jobId stays `taskName`.**
   - It is still one stable id per (task, pubkey), so ADR 0022's contract holds unchanged: a second add while the first
     is waiting or active joins it, and a fresh add after it finishes runs again (story #25 AC #4).
   - This supersedes only the separator in ADR 0012 (its "Dedup" formula) and in ADR 0022 (which pins it through story
     #25 AC #4's `processCustomer:alice` example).
   - The same one-line change fixes `/api/run-task` and the per-Customer scheduler.
   - No migration: BullMQ refused every add with the old id, so no such job exists in Redis.
   - Why `-`: BullMQ forbids `:` in a custom id, apart from the three-part legacy repeat ids its own source marks for
     removal, and forbids all-digit ids. Task names are camelCase and pubkeys are hex, so `-` cannot be ambiguous.
   - Rejected: `` `${taskName}:${pubkey}:x` `` passes today's check only through that legacy three-part allowance,
     which BullMQ's source says a later breaking change will remove.
2. **A guard on the library's own rule (Tester).**
   - Every jobId `computeJobId` can produce, for every task in `taskRegistry.json`, with and without customer args, must
     pass BullMQ's own `Job#validateOptions`. Run it on a `Job` built over a minimal queue stub, with no Redis. Don't
     copy the rule into the test.
   - Re-aim `test/manual-task-retrigger-after-finish.test.js` T3 and this story's P5 to the new formula.
   - `test/task-queue-bullmq.test.js` T3 only checks that the two tokens appear; its message may be updated, and its
     assertion needn't change.
3. **The review's non-blocking items taken now** (each small, inside this story's files):
   - **N1:** the page reads an HTTP 401 as `not-signed-in`. The route table refuses a signed-out press before the
     handler runs, and its refusal carries no `code`. The BIBLE row and `openapi.yaml` say that the 401 comes from the
     route table.
   - **N2:** `REASONS.failed` becomes "this instance couldn't start one."
   - **N3:** the read's 500 gets its own words: "This instance could not read your Scores right now."
   - **N4:** the count is read with `countStrict` from `src/lib/strfryScanStrict.js`, which answers one safe integer or
     rejects and is never 0 for unparseable output. `countLocalStrict` is removed.
   - **N6:** the page clears `answer` and `notice` when the signed-in viewer changes.
   - **N7:** `openapi.yaml` says `queued` means waiting or prioritized.
   - **Not taken:** N5, a Customer record with no `id`. Malformed records are CustomerManager's to prevent, and run-task
     fails on them too. N8, the cross-site POST and the public read's `CustomerManager.initialize()`, predates this
     story and applies app-wide.

**Files** (Implementer):
- `src/manage/taskQueue/queue/index.js`: `computeJobId`'s customer branch, and the comment at line 57 that spells the
  formula. Lines 8 and 179 say "(taskName, pubkey)" and stay true.
- `BIBLE.md`, around line 1684: the formula sentence in the task-queue section.
- `src/api/assistant/scores.js`: its header comment, N3 and N4.
- `ui/src/pages/assistant/scoresCopy.js`: N2.
- `ui/src/pages/assistant/Scores.jsx` or `ui/src/utils/assistantScores.js`: N1 and N6.
- `src/api/openapi.yaml` and the two BIBLE API rows: N1 and N7.
- `test/` and `tests/`: none; the Tester owns them.

**Consequences.**
- Customers' presses and every customer `/api/run-task` trigger enqueue again.
- Logs, BullBoard and the Task Explorer show customer job ids with `-` rather than `:`.
- Nothing reads job ids back by format: the Scores run state matches on `job.data`, and deploy-safety reads names only.
