# Test Plan: Story 1 — The Scores page

**Story:** `engineering-team/stories/assistant-scores/1-the-scores-page.md`
**ADR:** `engineering-team/decisions/assistant-scores/0001-a-session-bound-scores-read-and-recalculate-route.md`
**Date:** 2026-10-14

Three suites, one fixture file:

- `test/assistant-scores-route.test.js` — the server half, stack-free: `src/api/assistant/scores.js` through the seams
  the ADR names (`getConfigFromFile`, `getAssistantPubkeyFor`, `getCustomer`, `scanLocal`, `countLocal`, `taskQueue`,
  `readScheduleEntries`, `loadRegistry`, `resolveTaskTimeout`, `now`), with a fake task queue whose jobs carry BullMQ
  states. Classes G (the read), Q (the run state), P (the press), R (the wiring).
- `test/assistant-scores-page.test.js` — the client half, stack-free: `scoresCopy.js` loaded in Node as ESM (U),
  `assistantScores.js` against a fake `fetch` (C), and source sentinels on what the runner can't execute (S).
- `tests/brainstorm/assistant-scores.spec.js` — the browser class (B0–B10), every `/api` route mocked, against the
  built UI.
- `test/helpers/scoresFixtures.js` — the approved words (story § Copy, ADR sub-decision 7), the routes, the codes, the
  pipeline task names and canned answers, shared by all three so they can't disagree.

## Coverage map

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 last published | G1 newest 30382 by **their own** Assistant, the count, the filters; G2 the Owner's TA; G3 none → `latestAt` null, count 0 | `test/assistant-scores-route.test.js` | unit (DI) |
| AC-1 | U1 the words; U2 date + time + "(3h ago)", "not yet", the unreadable line; U3 the count, 0 shown, none hidden | `test/assistant-scores-page.test.js` | unit |
| AC-1 | S1 `/assistant/trusted-assertions` routes to the page, not the placeholder | `test/assistant-scores-page.test.js` | source |
| AC-1 | B3 idle page; B7 not yet / unreadable | `tests/brainstorm/assistant-scores.spec.js` | browser |
| AC-2 recalculate | P1 the Owner → `updateAllScoresForOwner`, no customer, its timeout, 202 queued; P2 a Customer → `processCustomer` with run-task's customer args; P3 an Admin who is a Customer | `test/assistant-scores-route.test.js` | unit (DI) |
| AC-2 | Q1, Q2 the run read as running / queued | `test/assistant-scores-route.test.js` | unit (DI) |
| AC-2 | U4 runLine; U5 buttonState; C2 one POST, no body | `test/assistant-scores-page.test.js` | unit |
| AC-2 | B4 the press: one POST, "Recalculation started.", the read asked again, then queued; B10 nothing but GETs on load | `tests/brainstorm/assistant-scores.spec.js` | browser |
| AC-3 one at a time | P4 409 `already` with the run, nothing enqueued (a manual job, and an orchestrator); P5 two racing presses dedup to run-task's jobId | `test/assistant-scores-route.test.js` | unit (DI) |
| AC-3 | Q2 another Customer's job isn't theirs; Q3 scheduled fires by their entry; Q4 orchestrators count, Owner/Customer tasks don't cross; Q5 `delayed` never counts | `test/assistant-scores-route.test.js` | unit (DI) |
| AC-3 | U5 the button off while queued, running or pressing; B5 running on load; B8 a refused press | both | unit, browser |
| AC-4 only your own | G8 a pubkey in query or body changes no read; P6 another pubkey or task in query or body still runs only the caller's pipeline, with no query params; P7 signed out → 401, nothing starts | `test/assistant-scores-route.test.js` | unit (DI) |
| AC-4 | R1 the route table (read public, press `signed-in` with its `why`); C1, C2 the client sends no parameters | both | unit |
| AC-5 no pipeline | G5 signed out reads nothing; G6 no Assistant reads nothing; G7 Admin / guest / inactive Customer see status with `pipeline` and `run` null; P8 403 `no-assistant`; P9 403 `no-pipeline` | `test/assistant-scores-route.test.js` | unit (DI) |
| AC-5 | U5 no button without a pipeline; U6 a reason for every code; S3 the hub's signed-out and no-Assistant lines | `test/assistant-scores-page.test.js` | unit, source |
| AC-5 | B1 signed out; B2 no Assistant; B6 no pipeline | `tests/brainstorm/assistant-scores.spec.js` | browser |
| AC-6 nothing else changes | S4 the hub's Scores entry (path, title, alert criteria, edit link) and its check's key unchanged; S3 the description and Treasure Map link stay | `test/assistant-scores-page.test.js` | source (regression sentinel) |
| AC-6 | B3 no placeholder text, the back link, the Treasure Map link | `tests/brainstorm/assistant-scores.spec.js` | browser |
| AC-6 | `/settings`, the other hub pages and the operator task tools unchanged: the Reviewer checks the diff stays inside the ADR's file list | review | diff |
| ADR wiring | R2 both routes registered; R3 openapi.yaml + the BIBLE API table; R4 `PIPELINE_TASKS` exported, each in the self-Map check's matching list (which `selfMap.js` now exports) and a real registry task | `test/assistant-scores-route.test.js` | source |

AC → handle lines:

- AC-1 → G1, G2, G3, G4, U1, U2, U3, S1, B3, B7
- AC-2 → P1, P2, P3, P11, Q1, U4, U5, C2, C3, B4, B10
- AC-3 → P4, P5, Q2, Q3, Q4, Q5, U5, B5, B8
- AC-4 → G8, P6, P7, R1, C1, C2
- AC-5 → G5, G6, G7, P8, P9, U5, U6, S3, B1, B2, B6
- AC-6 → S3, S4, B3 (+ the Reviewer's diff-scope check)
- Story § Open questions (can't tell → claim nothing) → Q6, P10, U4, B9

## Edge cases

Not derivable from any single criterion, each pinned:

- [x] **A failed scan is not "not yet"** (G4, U2, B7). Reading `null` on a strfry failure would tell a person their
      Assistant never published. The answer drops `latestAt`; the page says "couldn't be read right now".
- [x] **A count of 0 is shown, not hidden** (G3, U3, B7): the falsy-zero regression.
- [x] **Someone else's newer event never counts as yours** (G1: another author's 30382 at 9000 and the Assistant's
      own kind 1 at 8000 both lose to its own 30382 at 3000).
- [x] **A scheduler's next fire sits in `delayed`** (Q5). Counting it would read "queued" forever for anyone with a
      schedule.
- [x] **Scheduled fires carry only an `entryId`** (Q3): matched through the entry's `args.customer`, case-insensitively;
      an entry that's gone isn't theirs.
- [x] **Racing presses** (P5): both may pass the check; the jobIds they produce are run-task's own
      (`processCustomer:<viewer>`, `updateAllScoresForOwner`, through the real `computeJobId`), so BullMQ keeps one.
- [x] **The request's own fields never reach the task** (P6: `taskName`, `warmStart`, `customerArgs` in query and body).
- [x] **An Admin who is also an active Customer** presses as a Customer (G7, P3); an **inactive** Customer has no
      pipeline (G7, P9); an **active Customer with no Assistant key** is refused `no-assistant` before the pipeline (P8).
- [x] **Every external dependency's failure**: strfry scan (G4), strfry count (G4), the queue flag off (Q6, P10), Redis
      unavailable (Q6, P10), a queue read that throws (Q6, P10), the enqueue that throws (P11: 500, never "queued"), the
      client's non-JSON answer (C3). CustomerManager and the key store fail only through `getCustomer` /
      `getAssistantPubkeyFor`, which the module awaits; not separately covered (their own suites cover them).
- [x] **No polling** (S2), **one read per load** (B10), and **the words' one home** (S2: the page spells none of them).

Not covered, with the reason:

- **Live queue, real strfry, a real run end to end.** The stack is absent this session. AC-2's "reloading after the run
  ends shows a newer time" is covered by its parts (the read's newest-30382 rule, G1, plus the press, P1/P2). The whole
  is the staging smoke check: press on staging.brainstorm.world/assistant/trusted-assertions, wait, reload.
- **`countLocal`'s and `defaultDeps()`'s real wiring** (execFile argv, the 15 s timeout, lazy requires): reviewed, not
  run. They need strfry on the path.

## Test infrastructure

- Test framework: Node runner (`node test/test.js`; both new suites are registered in `test/registry.js`) and
  Playwright. A run's result is read per [Running and reading the test gate](../../README.md#running-and-reading-the-test-gate).
- Concept Graph API: not used. The story touches no concepts; no live-API suites.
- Firmware state: none.
- Fixtures: `test/helpers/scoresFixtures.js`; `test/helpers/assistantManagementFixtures.js` for the hub's shared lines.
- Dependencies: `npm ci` at the root (R's P5 loads `src/manage/taskQueue/queue/index.js`, so BullMQ must be installed).
  The browser class needs the built UI: `cd ui && npm ci && npm run build && npx vite preview --port 4173 --strictPort`.

## How to run

```
npm test
node test/assistant-scores-route.test.js
node test/assistant-scores-page.test.js
```

For the browser class:
```
BRAINSTORM_SERVER_ACCESSIBLE=true BRAINSTORM_BASE_URL=http://localhost:4173 \
  npx playwright test tests/brainstorm/assistant-scores.spec.js --project=chromium
```

**Scoped gate for this story:** the two Node suites above, plus `test/admin-action-sweep.test.js` (the route walk:
every registered route has a table entry) and `test/stack-free-npm-test.test.js` (every suite registered).

## Re-aims (returned to Test Design after Implementation, 2026-10-14)

Building the page broke three existing tests that pinned `/assistant/trusted-assertions` as a placeholder. This plan
missed them; the owner approved returning to Test Design to re-aim them, as each earlier page story did:

- `test/assistant-identification-tags-page.test.js` **S3**: `trusted-assertions` joins the list of built action pages
  in `ACTION_PAGES` (as the Duty Menu and Treasure Map pages joined it).
- `tests/brainstorm/assistant-management-page.spec.js` **B8**: the Scores path skips as "no longer a placeholder
  (assistant-scores #1)", like the five built pages before it; `assistant-scores.spec.js` pins the page.
- `tests/brainstorm/assistant-trusted-content.spec.js` **TC5**: the Scores page keeps its title and its Treasure Map link
  (still asserted, navigation included); only the placeholder's alert-criteria line is no longer expected there.

**Lesson for the next page story:** grep `test/` and `tests/` for the action's path and key, and for lists of built
pages, before writing the plan.

## Round 2 (ADR Amendment 1, after review round 1)

Review round 1 found that BullMQ rejects every customer jobId `computeJobId` builds (`processCustomer:<pubkey>`), so no
Customer's press, and no customer task through `/api/run-task`, could enqueue. Every test here faked `enqueueTask`, and
the plan's "Not covered: live queue" let the library's own rule go unchecked. Amendment 1 changes the separator to `-`
and takes six of the review's non-blocking items. This round adds:

| Item | Test | File | Level |
|---|---|---|---|
| Amendment §1–2: every jobId passes BullMQ's own rule | **V1** every registry task's id, with customer args where the task takes a customer, through BullMQ's `Job#validateOptions` (no Redis) | `test/task-queue-jobid-valid.test.js` (new, registered) | unit (real library) |
| ADR 0022's dedup contract | **V2** one stable id per (task, pubkey), distinct across pubkeys and tasks; bare name for non-customer tasks | same | unit (regression sentinel) |
| The guard is not vacuous | **V3** the same harness rejects a one-colon id and an all-digit id | same | unit (regression sentinel) |
| The formula | **T3** re-aimed to `${taskName}-${customerArgs.pubkey}` | `test/manual-task-retrigger-after-finish.test.js` | source |
| AC-3's shared jobId | **P5** re-aimed to `processCustomer-<viewer>` | `test/assistant-scores-route.test.js` | unit (DI) |
| N3 the read's own 500 words | **G9** | same | unit (DI) |
| N4 one strict count reader | **R5** `countStrict` from `src/lib/strfryScanStrict.js`; no reader of its own | same | source |
| N1, N7 docs | **R6** openapi: 401 from the route table, `queued` includes prioritized; the BIBLE row says the 401 is the route table's | same | source |
| N2 the failed-press reason | **U7** `REASONS.failed` is "this instance couldn't start one." | `test/assistant-scores-page.test.js` | unit |
| N1 a route-table 401 | **C4** the client answers `code: 'not-signed-in'` for a 401 with no code, and keeps a refusal's own code | same | unit |
| N1 in the page | **B11** a 401 press shows "Couldn't start a recalculation: …" with neither the failed-instance reason nor "didn't answer" | `tests/brainstorm/assistant-scores.spec.js` | browser |

`test/task-queue-bullmq.test.js` T3's message names the new formula; its assertion is unchanged.

**Not covered, with the reason:** N6 (the page clears the answer and the notice when the signed-in viewer changes) needs
an account switch without a reload, which the mocked shell can't drive. The Reviewer checks it by reading `Scores.jsx`.

**AC → handle lines (round 2):** AC-2 → V1, P5; AC-3 → V2, P5; AC-4 → C4, B11; ADR wiring → T3, R5, R6, G9, U7.

**Verification (round 2, before the fix).** Each new or re-aimed test fails for the right reason against `776c7c39`
plus these tests:

```
task-queue-jobid-valid: 2 passed, 1 failed
  V1 — BullMQ rejects 15 jobId(s) the queue would compute … processCustomer:a1a1… → Custom Id cannot contain :
manual-task-retrigger-after-finish: 9 passed, 1 failed (T3)
assistant-scores-route: 28 passed, 4 failed
  P5 — got ["processCustomer:cccc…"]
  G9 — got "This instance could not start a recalculation."
  R5 — scores.js must read the count through require('../../lib/strfryScanStrict').countStrict
  R6 — openapi's /api/assistant/scores says queued counts prioritized jobs too
assistant-scores-page: 13 passed, 2 failed
  U7 — got "this instance didn't answer."
  C4 — got {"status":401,"success":false,"error":"Sign in to do this."}
tests/brainstorm/assistant-scores.spec.js: 11 passed, 1 failed (B11: not the old "didn't answer" reason)
```

These were also checked against a throwaway prototype of Amendment 1 (never committed, reverted with `git checkout`).
`assistant-scores-route` passed 32/32, `assistant-scores-page` 15/15, `task-queue-jobid-valid` 3/3 and
`manual-task-retrigger-after-finish` 10/10.

## Verification

The new tests fail with the current code, for the right reason. Confirmed on 2026-10-14 at `5438bd2f` (plus the
uncommitted tests):

```
assistant-scores-route: 0 passed, 29 failed
  G*, Q*, P*, R4 — src/api/assistant/scores.js must exist and load in a bare checkout — Cannot find module …
  R1 — 'GET /api/assistant/scores': PUBLIC_READ — got undefined
  R2 — register app.get('/api/assistant/scores', …)
  R3 — src/api/openapi.yaml must document /api/assistant/scores

assistant-scores-page: 1 passed, 12 failed
  U1–U6 — ui/src/pages/assistant/scoresCopy.js does not exist
  C1–C3 — ui/src/utils/assistantScores.js does not exist
  S1 — App.jsx must import the page from './pages/assistant/Scores'
  S2, S3 — ui/src/pages/assistant/Scores.jsx must exist
  S4 passes (the AC-6 regression sentinel, by design)

tests/brainstorm/assistant-scores.spec.js (chromium, against `vite preview` of the current build): 11 failed
  B0 — the bundle … does not carry "Recalculate and republish" (searched 11 JS chunks)
  B1–B10 — the placeholder page: the lines, the button and the read are not there
```

The full gate, the same tree (`npm test`, record `tmp/gate-runs/20261014T000233Z-7598-f949.json`):

```
Failed suites: assistant-scores-route, assistant-scores-page
Overall: FAIL — 6020 passed, 41 failed, 582 skipped across 311 suites
```

The 41 are exactly the new suites' (29 + 12); every other suite passes, `admin-action-sweep` and
`stack-free-npm-test` included.

**The tests themselves were checked against a throwaway prototype of the ADR's design** (never committed, removed after):
the server prototype passed every G, Q and P test and R4 (26/29; R1–R3 need the wiring it didn't add), and the
words/client prototype passed U1–U6 and C1–C3 (10/13; S1–S3 need the page). So the failures above are the missing
feature, not mistakes in the tests.
