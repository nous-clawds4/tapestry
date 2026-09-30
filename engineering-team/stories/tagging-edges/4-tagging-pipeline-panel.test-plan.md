# Test Plan: Story 4 — The tagging pipeline panel

**Story:** `engineering-team/stories/tagging-edges/4-tagging-pipeline-panel.md`
**ADR:** `engineering-team/decisions/tagging-edges/0004-tagging-pipeline-panel.md`, with § Clarifications (Test Design,
2026-09-30) T1–T11
**Date:** 2026-09-30

## The suites

Seven new suites, and edits to two existing ones. Every Node suite exports `run()` and is registered in
`test/registry.js`. The browser spec runs in the Playwright lane (below), not in `npm test`.

| Suite | Ids | Level | What it holds |
|---|---|---|---|
| `test/tagging-pipeline-view.test.js` | TV1–TV58 | unit (ESM by `import()`) | `taggingPipelineView.js`: `POLL_MS`, `EXPLANATIONS`, `FAMILIES`, `explain`, `passView`, `newestFinishedPass`, `pathView`, `scheduleView`, `driftView`, and the module's form |
| `test/tagging-pipeline-codes.test.js` | PC1–PC40 | unit + source scan | The guard: every code the producers can write today has its own sentence |
| `test/tagging-pipeline-fetch.test.js` | TF1–TF19 | unit (ESM) | `readSection` over a fake `fetchImpl` |
| `test/strfry-count-strict.test.js` | SC1–SC22 | unit (fake `strfry` on `PATH`) | `countStrict` |
| `test/tagging-edges-drift-route.test.js` | DR1–DR27 | unit (route with injected deps) + source | `GET /api/tagging-edges/drift-counts`: the gate, the counts, the answer, single flight, the registration |
| `test/tagging-pipeline-panel-source.test.js` | PS1–PS25 | source (text and the `typescript` JSX parser) | The panel's files, `RELAY_TABS`, the render line, the timers, the requests, colours, lengths, emoji, `!`, class names |
| `tests/brainstorm/tagging-pipeline-panel.spec.js` | B0–B40 (B36a–d) | browser (Playwright, every route stubbed) | What the owner and an admin see, every state AC-2 to AC-5 name, refresh, "changes nothing", AC-6's request baseline |
| `test/tagging-edges-realtime-resilience.test.js` | + RX29, RX30 | engine (fakes) | C6: clarification 26's two unpinned halves |
| `test/tagging-edges-realtime-routes.test.js` | `FORGET` | — | C9: `src/lib/strfryScanStrict.js` added to the list |

Shared fixtures: `test/helpers/taggingPipelineFixtures.js`, which is CommonJS and deep-frozen. It holds realistic
status, realtime, schedule, held and drift bodies for every state the criteria name. The AC-6 baseline is
`tests/brainstorm/fixtures/relay-subtab-requests.json`, recorded at `88af7df3` (T10).

## Coverage map

| Criterion | Tests |
|---|---|
| **AC-1** where, who, changes nothing | PS1, PS2, PS4, PS5, PS13, PS14; TF1 (every read a `GET`); B1 (owner: the sub-tab directly after Streaming ETL), B2 (admin), B3 (the other sub-tabs unchanged), B38 (a minute open with two Recounts: only `GET`s, exactly three drift-counts requests) |
| **AC-2** the pass, held removals, the confirmation, the schedule | TV12–TV20 (running by `running` alone, `current`, `finishing`, `empty`, `earlier`, the five confirmation states), TV21–TV22 (newest finished pass), TV34–TV43 (the schedule's verdicts, intervals, cron rule); PC1–PC9, PC27; PS5, PS14, PS15 (the held URL with `runId`, `offset`, `limit=50`), PS25 (the schedule button calls `onOpenTab('schedule')`); B5–B18 and B40 (the held list's 404 restart) |
| **AC-3** the path | TV23–TV33 (`onButNotRunning`, warnings, `countsSince`, `lastFigures`, counts and gauges, `setupProblemKey`); PC10–PC15; B19–B26 (every state, the three warnings, "not yet available", counts reset, the last catch-up) |
| **AC-4** drift | TV45–TV58 (the arithmetic, the story's 5/1/1 → 3, 3, 0 example, unknown, report unavailable, no finished pass, the one used instead, left to the next pass, the path on and off); SC1–SC22; DR1–DR27; TF13, TF19; B27–B34, B37 |
| **AC-5** refresh, states, colours, copy | TV1–TV11, PC35–PC40, TF1–TF19; PS9–PS12 (timers by name, each cleared on unmount), PS16–PS20 and PS22–PS24 (no colour literal, only the eight tokens, no length, no emoji, no `!`, only the listed classes, nothing added to `styles.css`); B4 (loading), B35 (refresh after `POLL_MS`), B36a–d (a failed read names itself and retries while the others stay ready), B37 |
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
- **Polling.** A poll that answers late is dropped. A tick is skipped while one is in flight. A drift count is never
  on a timer (B38).

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
