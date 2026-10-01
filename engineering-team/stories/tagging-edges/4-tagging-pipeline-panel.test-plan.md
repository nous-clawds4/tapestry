# Test Plan: Story 4 — The tagging pipeline panel

**Story:** `engineering-team/stories/tagging-edges/4-tagging-pipeline-panel.md`
**ADR:** `engineering-team/decisions/tagging-edges/0004-tagging-pipeline-panel.md`, with § Clarifications (Test Design,
2026-09-30) T1–T11, as amended at `c496d853` (review round 1: T5's `countsPredatePass`), and T12 at `3a672f68`
(review round 1: `failureCode`)
**Review:** `engineering-team/reviews/tagging-edges/4-tagging-pipeline-panel.md`, round 1 (§ Review round 1 below)
**Date:** 2026-09-30

## The suites

Seven new suites, and edits to two existing ones. Every Node suite exports `run()` and is registered in
`test/registry.js`. The browser spec runs in the Playwright lane (below), not in `npm test`.

| Suite | Ids | Level | What it holds |
|---|---|---|---|
| `test/tagging-pipeline-view.test.js` | TV1–TV63 | unit (ESM by `import()`) | `taggingPipelineView.js`: `POLL_MS`, `EXPLANATIONS`, `FAMILIES`, `explain`, `passView`, `newestFinishedPass`, `pathView`, `scheduleView`, `driftView`, and the module's form |
| `test/tagging-pipeline-codes.test.js` | PC1–PC49 | unit + source scan | The guard: every code the producers can write today has its own sentence |
| `test/tagging-pipeline-fetch.test.js` | TF1–TF19 | unit (ESM) | `readSection` over a fake `fetchImpl` |
| `test/strfry-count-strict.test.js` | SC1–SC22 | unit (fake `strfry` on `PATH`) | `countStrict` |
| `test/tagging-edges-drift-route.test.js` | DR1–DR27 | unit (route with injected deps) + source | `GET /api/tagging-edges/drift-counts`: the gate, the counts, the answer, single flight, the registration |
| `test/tagging-pipeline-panel-source.test.js` | PS1–PS25 | source (text and the `typescript` JSX parser) | The panel's files, `RELAY_TABS`, the render line, the timers, the requests, colours, lengths, emoji, `!`, class names |
| `tests/brainstorm/tagging-pipeline-panel.spec.js` | B0–B49 (B36a–d) | browser (Playwright, every route stubbed) | What the owner and an admin see, every state AC-2 to AC-5 name, refresh, "changes nothing", AC-6's request baseline |
| `test/tagging-edges-realtime-resilience.test.js` | + RX29, RX30 | engine (fakes) | C6: clarification 26's two unpinned halves |
| `test/tagging-edges-realtime-routes.test.js` | `FORGET` | — | C9: `src/lib/strfryScanStrict.js` added to the list |

Shared fixtures: `test/helpers/taggingPipelineFixtures.js`, which is CommonJS and deep-frozen. It holds realistic
status, realtime, schedule, held and drift bodies for every state the criteria name. Review round 1 added the pass
records and status bodies `WRITE_FAILED`, `SCHEMA_UNREACHABLE`, `CONFIRMED_FAILED` and `CONFIRMED_APPLIED`, the
`catchUpLast()` helper with `REALTIME.CATCH_UP_FAILED_WITH_REASON` and `CATCH_UP_NOT_ESTABLISHED`, and
`DRIFT.PREDATING` with `EXPECTED_DRIFT.PREDATING`. The AC-6 baseline is
`tests/brainstorm/fixtures/relay-subtab-requests.json`, recorded at `88af7df3` (T10).

## Coverage map

| Criterion | Tests |
|---|---|
| **AC-1** where, who, changes nothing | PS1, PS2, PS4, PS5, PS13, PS14; TF1 (every read a `GET`); B1 (owner: the sub-tab directly after Streaming ETL), B2 (admin), B3 (the other sub-tabs unchanged), B38 (a minute open with two Recounts: only `GET`s, exactly three drift-counts requests) |
| **AC-2** the pass, held removals, the confirmation, the schedule | TV12–TV20 (running by `running` alone, `current`, `finishing`, `empty`, `earlier`, the five confirmation states), TV21–TV22 (newest finished pass), TV34–TV43 (the schedule's verdicts, intervals, cron rule); PC1–PC9, PC27; PS5, PS14, PS15 (the held URL with `runId`, `offset`, `limit=50`), PS25 (the schedule button calls `onOpenTab('schedule')`); B5–B18 and B40 (the held list's 404 restart); B42 (a failure's code with its explanation, and a schema refusal that names Neo4j), B44 (the confirmed-removals sentence only when some were applied), B49 (a pass-minted code, `plan-error`, has its own sentence) |
| **AC-3** the path | TV23–TV33 (`onButNotRunning`, warnings, `countsSince`, `lastFigures`, counts and gauges, `setupProblemKey`); PC10–PC15; B19–B26 (every state, the three warnings, "not yet available", counts reset, the last catch-up); B45 (a catch-up's reason labelled as why only when not established) |
| **AC-4** drift | TV45–TV58 (the arithmetic, the story's 5/1/1 → 3, 3, 0 example, unknown, report unavailable, no finished pass, the one used instead, left to the next pass, the path on and off); TV59–TV62 (`countsPredatePass`), TV63 (`usedInsteadOfLatest` while a pass runs); SC1–SC22; DR1–DR27; TF13, TF19; B27–B34, B37; B41 (drift while a pass runs), B43 (counts that predate the explaining pass) |
| **AC-5** refresh, states, colours, copy | TV1–TV11, PC35–PC41 (PC41: `EBADJSON`'s own sentence), PC42–PC49 (T12: `failureCode`), TF1–TF19; PS9–PS12 (timers by name, each cleared on unmount), PS16–PS20 and PS22–PS24 (no colour literal, only the eight tokens, no length, no emoji, no `!`, only the listed classes, nothing added to `styles.css`); B4 (loading), B35 (refresh after `POLL_MS`), B36a–d (a failed read names itself and retries while the others stay ready), B37; B46 (a failed re-poll keeps the earlier figures under their read time), B47 (a late answer is dropped), B48 (a tick is skipped while a read is in flight) |
| **AC-6** nothing else moves | PS3, PS7, PS8 (today's five `RELAY_TABS` entries and render lines, which pass now), PS13; B1, B39 (each existing sub-tab sends the same requests as the baseline) |
| **Docs tasks** | The Reviewer checks them against the diff. No tests. |
| **C6** | RX29 (a refused removal's kind-5 found again at the safety diff merges and waits for the timer), RX30 (a newer version with its notice lost lifts a removal park at the catch-up that finds it) |
| **C9** | The `FORGET` edit. Strict, routes, strict, then plan in one process now pass. |
| **C4** | Story 3's test plan now uses clarification 24's wipe wording, and says it is the fakes that lose the write. |

## Edge cases covered

- **A running pass.** Its record is the pessimistic `failed` / `stopped` one: TV12, TV14, B5. A running first pass is
  not "no pass yet": TV17. A running pass that already reads `done` is not finished: TV22, TV55.
- **Confirmations.** An unreadable one reported with `expired: false` is unreadable, and an unparseable `expiresAt`
  is `unknown-expiry`. The client clock is never read (TV19, TV20).
- **Explanations.** An own-property lookup (`constructor`, `__proto__`) is not recognised, and neither are the open
  families' near misses (TV7, TV11).
- **Drift.** A count read as 0 is never a figure: `countStrict` rejects `"\n"`, `" \n"`, `-5`, `1e3`, `0x1F` and
  `7030\r\n` (SC7). The graph count rejects `[]`, `[{n:null}]`, `-1` and `1.5` (DR16).
- **The gate.** A refused request spawns nothing, runs no Cypher, resolves no identity and never joins a count (DR3–DR8,
  T11). Admin case is checked exactly. Every `Origin` row is covered: none, same-host, foreign and `null` (DR4, DR7).
- **Time-outs.** A graph count that never settles loses its race through the injected timer, and every timer is
  cleared (DR17). A body that never arrives ends as `timeout` (TF19), and a body that rejects ends as `network`
  (TF18).
- **Single flight.** Two concurrent requests make one count; a request after it settles counts again (DR20).
- **The schedule.** A cron with doubled spaces or tabs, and an entry with `cron` absent or `null` (TV38, TV42).
- **Polling.** A drift count is never on a timer (B38). A poll that answers late is dropped (B47). A tick is skipped
  while one is in flight (B48). A failed re-poll keeps the earlier figures, labelled with their read time (B46).
  *(Corrected at review round 1: this line used to give B38 for all three polling rules, and B38 pins none of them.
  Review friction 1.)*
- **Counts older than the pass.** `countsPredatePass` compares `Date.parse` instants, strictly before, against the
  explaining pass's `endedAt`, not a later failed latest's. A time that does not parse makes it false (TV59–TV61).

## Readings for the owner to ratify at this gate

ADR 0004's T1–T11 fix the shapes. The suites also take these readings, which the ADR leaves open:

1. **The explanation tables are frozen too.** Each kind's table inside `EXPLANATIONS` is frozen, not only the outer
   map (TV2).
2. **`current` has only its four keys.** While a pass runs, `current` carries only `{ runId, startedAt, phases,
   finishing }`, with no outcome or reason (TV12).
3. **Result objects are compared field by field.** One extra key, `tone`, is allowed, and it must be `ok`, `warn`,
   `bad` or `neutral` (TV6–TV8, TV11, TV19, TV34–TV36).
4. **Interval text.** "every 1 day" and "every 1 days" are both accepted for N = 1; N > 1 is plural. T4's mixed
   fallback ("every D days H hours M minutes") never happens with whole-number fields.
5. **"Not its own code"** reads as the story words it. A sentence fails only when it equals its code once normalised,
   or when a code with `-`, `_`, `:` or `.` appears in it verbatim. Plain one-word codes such as `failed` or `live`
   may appear in ordinary English (PC39).
6. **Setup problems** are the product of the schema rules and problems. That product includes
   `schema:nostrUser_pubkey:not-online`, which nothing produces today but which costs one sentence (PC15).
7. **Class names.** The panel folder's class names are only `settings-group`, `settings-hint`, `btn-small`,
   `text-muted` and `settings-section`, reading the ADR's list as exhaustive (PS24).
8. **Stricter static rules.** These are stricter than the ADR's wording, so that the scans can be sure:
   - API paths are whole string literals;
   - no `var(--…)` is built from pieces;
   - no number appears in an inline style (PS14, PS17, PS19).

   So a skeleton bar takes its height from a line of text, not from a length.
9. **Browser wording.** Only T9's words are matched as words. Every other note is matched by its idea, with regexes
   listed at the top of the spec. Each note is also checked absent where it must not show.
10. **Held entries** show their address, and the page buttons are named Previous and Next (B10).
11. **The schedule warning's button** is named after Scheduled Tasks (B13, B14).

## Review round 1

The review (`engineering-team/reviews/tagging-edges/4-tagging-pipeline-panel.md`, CHANGES_REQUESTED at `39d94811`)
asked for these tests. "Fails now" means it fails on `c496d853` for the missing behaviour, with a message that says
what is expected. "Pins" means the behaviour is already there: the test passes now, and a wrong version built in
scratch fails it.

| Test | Finding it answers | Now |
|---|---|---|
| TV59 | NB3, T5: `countsPredatePass` is true when the earlier `takenAt` is before the explaining pass's `endedAt` (the earlier one decides; instants, so an offset time counts by its instant); `tone` is `neutral`, and the figures are still computed | fails now |
| TV60 | NB3, T5: false when the counts are later, when the earlier `takenAt` equals `endedAt` (strictly before), when only a later failed latest ended after them, and for an offset time whose instant is later | fails now |
| TV61 | NB3, T5: false when a `takenAt` or the pass's `endedAt` does not parse (garbage, `null`, missing, `''`); the figures are still computed | fails now |
| TV62 | NB3, T5: false without an explaining pass (no report, no finished pass, an empty report) and when a count is unknown or the counts are `null` | fails now |
| TV63 | NB1, T5's note: while a pass runs, `passRunning` and `explainedBy.usedInsteadOfLatest` are both true, and the newest finished earlier pass explains, whether the running record is pessimistic or already reads `done` | pins |
| PC41 | NB10: `EXPLANATIONS.countCode` has its own `EBADJSON` entry, which `explain` returns; it is not the E-family sentence and says the file is damaged. It first checks that the route still throws `EBADJSON` | fails now |
| B41 | NB1: drift while a pass runs says a pass is running and the newest finished pass explains; never "did not finish" | fails now |
| B42 | Blocking 1, NB2: a write failure shows `ENOSPC` beside `explain('countCode', 'ENOSPC')` under where it failed; a schema refusal shows `ServiceUnavailable` with its explanation, and the text names Neo4j down or unreachable | fails now (both halves, checked in a scratch copy of the spec) |
| B43 | NB3, T5: counts that predate the explaining pass show no "Unexplained" figure and no warn tone, and ask for a Recount; after a Recount the explained and unexplained lines return | fails now (the Recount half passes now) |
| B44 | NB5: the confirmed-removals sentence shows for `removalsApplied` 120, and not for a failed confirmed run with 0 | fails now (the 120 half passes now) |
| B45 | NB11 part 3: a not-established catch-up labels its reason as why; a failed catch-up carrying one does not | fails now (the not-established half passes now) |
| B46 | Friction 1: a failed re-poll sets `tp-pass` to error, keeps the earlier figures and outcome, and labels them with their read time | pins |
| B47 | Friction 1: the late answer to the opening status read ("no pass yet") arrives after a newer answer and is dropped; the section never shows `empty` | pins |
| B48 | Friction 1: while a status read hangs, two more ticks start no second status or path read; after it settles the next tick reads again | pins |

**The pins are not vacuous.**
- TV63 fails under three wrong `driftView`s: `usedInsteadOfLatest` taken from whether the latest is finished, a
  running latest that reads `done` chosen to explain (which also fails TV22 and TV55), and `passRunning` taken from
  the latest's outcome.
- B46–B48 each fail under their own wrong build of `TaggingPipelinePanel.jsx`, and only there:
  - `noguard` (the newest-answer check made `if (true)`) fails B47 alone: expected `ready`, received `empty`;
  - `noskip` (the in-flight skip dropped) fails B48 alone: expected 1 status read, received 3;
  - `nokeep` (a failure sets `body: null, readAt: null`) fails B46 alone: the earlier taggings figure (7064) is gone.

**Readings taken in this round:**
- `countsPredatePass` is strictly before, and compares `Date.parse` instants, never the strings (TV59, TV60).
- B44 does not count a negated sentence ("applied none …") as the claim.
- B48 holds the hang for two skipped ticks, not four, because the panel's read gives up at 15 s and reports a
  time-out. The reason is a comment in the test.
- The view suite's flags helper now holds five flags, so `countsPredatePass` must be a boolean in every case. That
  turns TV48–TV51 red for the same missing field (for example "`driftView(no report).countsPredatePass` must be a
  boolean (T5); got undefined").

### T12 — `failureCode`

ADR 0004 T12 (`3a672f68`) moves a pass's own `failure.code` out of `countCode` into its own kind. These tests pin it.

| Test | What it checks | Now |
|---|---|---|
| PC42–PC45 | The extractions in T12's guard bullet, each with a floor at today's count: the runner's `code: '…'` literals, plain or after `(err && err.code) \|\|` (9). The config check's `missing-` keys (2). The schema ternary (2). `graph.js`'s `invariant` (1). `checkIdentity` plus `missing` (4). `SCAN_ERROR_CODES` (12). The union holds 29 codes, and every code T12 names is in it | pass now |
| PC46 | Each of the 29 has its own `EXPLANATIONS.failureCode` entry (`hasOwnProperty`), which `explain('failureCode', c)` returns | fails now: "`EXPLANATIONS.failureCode` has no own sentence for 29 of 29 code(s) …" |
| PC47 | The families under `failureCode`: `ENOSPC`, `EACCES`, `ECONNREFUSED`, two `Neo.…` statuses, a Security code, `ServiceUnavailable` and `SessionExpired` are recognised, each through a `failureCode` FAMILIES entry | fails now: "does not recognise 8 of 8 family input(s)" |
| PC48 | Two `Neo.ClientError.Security.…` codes read as credentials (`/credential\|password/i`). A general Neo4j status does not get that sentence | fails now: "… -> not recognised" |
| PC49 | `countCode` keeps its meaning: it has no own entry for a pass-only code (`plan-error`, `driver`, `no-status`, …), and `explain('countCode', 'plan-error')` is not recognised | pins |
| TV2 | `EXPLANATIONS` has eighteen kinds, `failureCode` among them | fails now: "`EXPLANATIONS` lacks a table for the kind(s) ["failureCode"]" |
| B42 | `ENOSPC` and `ServiceUnavailable` are matched against `explanation('failureCode', …)`, no longer `countCode` | fails now: "`explain('failureCode', 'ENOSPC')` is recognised" |
| B49 | A plan failure's `plan-error` is shown under where it failed, beside its own `failureCode` sentence. The section never reads "not recognised" | fails now: "`explain('failureCode', 'plan-error')` is recognised" |

PC38–PC40's copy rules cover the new table and families without change.

**Findings with no test in this round.** They change copy, labels, comments or docs, and the Reviewer checks them
against the diff. PC38 and PC39's copy rules still hold over every new sentence.
- Copy and labels: NB4, NB6 (the backlog relabel, ADR § UI `pathView` as amended), NB7, NB8, NB9, NB11 parts 1–2,
  NB12, NB13, and the Neo4j-side wording of Blocking 1's four producers beyond what B42 checks.
- Comments and docs: NB14–NB17.
- Friction 2 is a ledger row. Friction 3, the held list left on "Loading", is a code ask with no test here.

## Test infrastructure

- **Runner:** Node's `test/test.js` (`npm test`). Read a run's result from its record (`npm run gate:status`), never
  from a pipe.
  - The unit and source suites run on host Node 16.17 and on Node 22.
  - The route and count suites use fakes, with no stack and no network.
- **Firmware:** no precondition. No concept or schema changes.
- **The browser lane.** It is not in CI. The whole Playwright class is red on staging already (ledger
  `2026-09-22-staging-browser-class-83-red`), so compare against a baseline.
  - **Build.** `ui/node_modules` holds Linux binaries, so build inside the container, into the gitignored repo `tmp/`
    and never `dist/`:

    ```
    docker exec tapestry sh -c 'cd /usr/local/lib/node_modules/brainstorm/ui && npx vite build --outDir ../tmp/tp-dist --emptyOutDir'
    ```

  - **Serve.** Serve it on the host with `python3 -m http.server 4174 --directory tmp/tp-dist`. The spec answers
    `/tapestry/**` documents with the app shell, and stubs every `/api/**` route. Its catch-all is registered first
    and answers 599.
  - **Run** under Node 22, with `@playwright/test` 1.56.1 and Chromium 1194:

    ```
    BRAINSTORM_SERVER_ACCESSIBLE=true BRAINSTORM_BASE_URL=http://localhost:4174 PATH=<node22>/bin:$PATH npx playwright test tests/brainstorm/tagging-pipeline-panel.spec.js --project=chromium
    ```

  - **The page** runs in UTC with the `en-GB` locale, on `page.clock`.
  - **Afterwards,** stop the server and delete `tmp/tp-dist`.
  - **Recording.** `TP_RECORD_BASELINE=1` re-records the AC-6 baseline, and refuses to record from a build that
    already holds the panel.
- **Live evidence** (after the merge, not a suite):
  - the owner and an admin view the panel on staging;
  - a drift count there is compared with the relay and graph counts read directly;
  - for AC-1's "no pass is queued", BullBoard (`/admin/queues`) shows the `reconcileTaggingEdges` queue with no
    waiting, delayed or active job before and after.

## How to run

```
npm test
```

One suite:

```
node -e "require('./test/tagging-pipeline-view.test.js').run().then(r=>{console.log(JSON.stringify(r));process.exit(0)})"
```

## Verification

The red phase was confirmed on 2026-09-30.
- Each suite was run through `run()` on Node 22.23.3 and on host Node 16.17, with the same results on both.
- The full gate ran under Node 22 on a snapshot of this commit's tree (`refs/scratch/te4-red`), and was compared suite
  by suite with a baseline run at `88af7df3`. It is filled in below.

| Suite | Result | Why the failures fail |
|---|---|---|
| tagging-pipeline-view | 0 passed, 58 failed | "`ui/src/utils/taggingPipelineView.js` not implemented yet: it does not export X" (TV4: "it does not exist") |
| tagging-pipeline-codes | 17 passed, 22 failed | PC1–PC17 (the producers' extractions and their floors) pass. The rest fail because the view module is missing. |
| tagging-pipeline-fetch | 0 passed, 19 failed | "`ui/src/utils/taggingPipelineFetch.js` not implemented yet …" |
| strfry-count-strict | 1 passed, 22 failed | "`src/lib/strfryScanStrict.js` … does not export countStrict". The one pass is SC20, `scanStrict` unchanged. |
| tagging-edges-drift-route | 1 passed, 26 failed | "`src/api/tagging-edges/drift.js` not implemented yet …". The one pass is DR26, the substring check on the path. |
| tagging-pipeline-panel-source | 4 passed, 21 failed | Today's `RELAY_TABS`, render lines and `styles.css` pass (PS3, PS7, PS8, PS22). The rest fail because the panel files are missing. |
| tagging-edges-realtime-resilience | 30 passed, 0 failed | RX29 and RX30 pin existing behaviour. Each fails under its own mutant of `bringsNew`. |
| tagging-edges-realtime-routes | 52 passed, 0 failed | C9: strict, routes, strict, plan in one process gave 41/0, 52/0, 40/1 (SS36), 93/1 (RP5) before the edit, and 41/0, 52/0, 41/0, 94/0 after. |
| browser spec (today's UI) | 2 passed, 42 failed | B3 and B39 pass, as the unchanged tab bar and baseline should. B0 fails at the bundle guard, B1 on the tab order, and the rest at "Settings › Relays has a "Tagging pipeline" sub-tab … not implemented yet". |

**Proven not vacuous.** Each suite was run against a reference implementation in scratch, which passed it in full,
and against wrong versions, each of which a named test catches.
- The Node suites: under the session scratchpad `wf7/`, and the fixers' `wf8/`.
- The browser spec: 44/44 against a reference panel, with builds A–E each failing their named tests (`wf8/browser/`).

**The full gate** (Node 22.23.3, records read with `gate:status`):

```
20260930T195708Z-12825-9302 [te4-baseline-88af7df3] on 88af7df3 — FAIL, exit 1, 4533 passed, 33 failed, 177 skipped, 244/244 suites
20260930T210210Z-29679-8432 [te4-red-4b0053b3]      on 4b0053b3 — FAIL, exit 1, 4558 passed, 201 failed, 177 skipped, 250/250 suites
```

Suite by suite, the only differences are these:
- the six new suites: 23 passed and 168 failed, all red for the reasons in the table above;
- `tagging-edges-realtime-resilience`: 28 → 30 passed.

The 13 suites that fail in both runs are the same live-stack suites, failing identically (`capture-a-goal-and-see-it` …
`summaries-element-count`). No existing suite changed.

### Review round 1

The round-1 red phase was confirmed on 2026-09-30, on `c496d853` with the round's test edits in the working tree.
Each Node suite was run through `run()` on Node 22.23.3 and on host Node 16.17, with the same results on both.

| Suite | Result | The failures |
|---|---|---|
| tagging-pipeline-view | 55 passed, 8 failed | TV59–TV62, and TV48–TV51 through the five-flag helper: "`countsPredatePass` must be true …" or "… must be false …", "got undefined". TV63 passes. |
| tagging-pipeline-codes | 39 passed, 1 failed | PC41: "`EXPLANATIONS.countCode` must have its own 'EBADJSON' entry …" |
| browser spec (the current build, `tmp/tp-wf12-current`) | 47 passed, 5 failed | Exactly B41–B45, each on its expected-behaviour message. B0–B40 still pass, B39's AC-6 baseline included. B46–B48 pass, and pass 9/9 with `--repeat-each=3`. |

**Proven not vacuous.**
- A correct T5 `driftView` (`min` of the two `Date.parse` times `<` `Date.parse(endedAt)`, NaN gives false, `tone`
  neutral when true) passes the view suite 63/63. A correct `EBADJSON` sentence passes the codes suite 40/40, PC38 and
  PC39 included.
- Eleven wrong `countsPredatePass` versions are each caught by a named test among TV48–TV51 and TV59–TV62: `max` for
  `min`, the latest record's `endedAt`, `<=`, a string compare, an unparseable time skipped or read as true, `tone`
  not neutral, no known-counts gate, left undefined without a pass, the figures nulled, and the latest used when no
  pass explains. Three wrong versions each fail TV63, and three fail PC41 (the E-family sentence, no "damaged", the
  families looked up first).
- B46–B48: the `noguard`, `noskip` and `nokeep` builds above.
- The variants and their logs are under the session scratchpad `wf12/node/variants/` (generator `wf12/node/mutants.py`)
  and `wf12/browser/`.

**T12's red phase** was confirmed on 2026-10-01, on `3a672f68` with the T12 test edits in the working tree. The Node
suites ran through `run()` on Node 22.23.3 and on host Node 16.17, with the same results on both.

| Suite | Result | The failures |
|---|---|---|
| tagging-pipeline-codes | 45 passed, 3 failed | PC46–PC48, each because `failureCode` has no table and no families. PC42–PC45 and PC49 pass. |
| tagging-pipeline-view | 62 passed, 1 failed | TV2: "`EXPLANATIONS` lacks a table for the kind(s) ["failureCode"]" |
| browser spec (current UI, built at `4722e0ac`'s `ui/src`) | 51 passed, 2 failed | B42 and B49, each at "`explain('failureCode', …)` is recognised" |

**Proven not vacuous** (in the session scratchpad, `wf14/tester/`):
- A reference view with a 29-entry `failureCode` table and four `failureCode` families passes the codes suite 48/48
  and the view suite 63/63.
- Each wrong version fails only its named test:
  - one entry dropped (`plan-error`) fails PC46;
  - the entries inherited through a prototype fail PC46;
  - no `failureCode` families fails PC47 and PC48;
  - a Security sentence that does not name credentials fails PC48, and so does the general Neo4j family checked first;
  - `plan-error` added to `countCode` fails PC49.
- The browser spec passes 53/53 against a reference build: that view, with `PassSection` explaining
  `failure.code` under `failureCode`. Two wrong builds fail:
  - `PassSection` still under `countCode` fails B42 and B49;
  - `plan-error` missing from the table fails B49 alone.
