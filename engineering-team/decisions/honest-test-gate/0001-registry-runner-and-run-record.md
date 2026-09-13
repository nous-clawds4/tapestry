# ADR 0001: The gate runs from one registry and writes a run record; the record, not stdout, is the verdict

**Status:** Accepted
**Date:** 2026-09-12
**Story:** `engineering-team/stories/honest-test-gate/1-gate-result-tells-the-truth.md`

## Context

The story asks for a gate whose verdict, exit status, progress and skip counts are true and readable
afterwards however the run was launched or ended (AC-1…AC-6). The operator ruled at the planning gate
that overlapping runs on one checkout are allowed, each keeping its own record.

What the gate is today (line numbers from `origin/staging` `b8ea1f4d`):

- **One 1,558-line hand-written runner.** `package.json:13` makes `npm test` = `node test/test.js`.
  The runner `require`s 196 suites at load (`test/test.js:27–299`), then `main()` awaits them one by
  one as 196 separate statements (`:306–731`), prints 119 hand-written summary lines plus 45
  `const <x>Line` ternaries (`:733–1250`), ANDs 196 `…Result.fail === 0` terms into `overallOk`
  (`:1252–1503`), sums a separately maintained 160-name skip list (`:1507–1549`), prints
  `Total skipped:` / `Overall:` and calls `process.exit(overallOk ? 0 : 1)` (`:1550–1552`).
  `main().catch` prints `Test runner crashed:` and exits 1 (`:1555–1558`).
- **Four parallel hand-maintained lists** (require, await, summary line, gate term), plus the skip
  list, must agree for every suite. They already disagree: 36 of 196 results are missing from the
  skip list and 4 appear two or three times (OPEN.md row 235; measured on this branch). Many summary
  lines omit the skipped count (e.g. `:736–744`), so a suite whose live tests all skipped prints PASS
  (rows 104/106). This is the same defect class as #43 (a severed chain) and #58 (SKIP masking FAIL).
- **Four suite files never run.** `generalized-tag-pinning`, `pinned-notes-display`,
  `signer-guard-rollout` and `tag-a-note-modal` exist in `test/` but are not registered (200 files,
  196 registered). Nothing says so.
- **Any suite that throws erases the run.** There is no per-suite isolation: a rejection from any
  `.run()`, or a throw from any suite module at load, lands in `main().catch`; later suites never run
  and no `Overall:` prints (row 192). An escaped unhandled rejection or uncaught exception kills the
  process the same way (Node's default).
- **No signal handling.** An interrupted run ends mid-output with no verdict (row 263); a SIGKILLed
  run leaves nothing.
- **stdout is not a reliable carrier on this machine.** Measured on this Mac (Node v16.17.0, Darwin)
  during this design: writing 4 MB to a **pipe** and then calling `process.exit(0)` loses the tail —
  the last line never arrives — while the same run with `process.stdout._handle.setBlocking(true)`
  first, or with stdout redirected to a **file**, delivers it. A burst followed by an
  event-loop-blocking `execSync` and `process.exit` lost everything queued after the pipe buffer
  filled. Node writes to pipes asynchronously on macOS, and the runner's last act is
  `process.exit`, so a piped or tool-captured `npm test` can drop its own `Overall:` line (rows 157,
  227). That is independent of the session tool's background-completion notice reporting the
  launcher's exit code rather than the suite's (rows 103, 105, 111).
- **Live suites invent HTTP statuses.** Nine suites reach the stack through `docker exec … curl` and
  derive a status themselves:
  - Five synthesize it from the body with `status: json && json.success ? 200 : 500`, so an empty
    response from an interrupted call reads "got 500" (row 263). The five are
    `customize-pin-curation-publish`, `tag-detail-curated-view-and-pin-polish-publish`,
    `tl-membership-method-selector`, `tl-publication-from-pins-publish` and `tl-publication-from-pins`
    (e.g. `tl-publication-from-pins.test.js:32–42`).
  - Three parse a `__STATUS__%{http_code}` marker and report `0` when nothing answered:
    `relationship-primitives.test.js:216–229`, `firmware-concept-elements-sets.test.js:~258–268` and
    `move-nodes-between-sets-ui.test.js:~336–345`.
  - One, `operational-direction.test.js:1116` (H1), asserts `out.trim() !== '404'` on curl's bare
    `%{http_code}`, so no response at all (`000`) *passes*.
- **The docs point at the wrong evidence.** 20 role, agent, command, workflow, template and skill
  files tell someone to run `npm test` and read its result (inventory in Implementation notes). None
  says where a trustworthy result lives.

Constraints:

- **`npm test` stays the one gate command.** Local and CI run the same thing (ADR
  `test-hermeticity-ci/0001` Option A; `.github/workflows/test.yml:36–37`). Its exit code keeps
  meaning PASS = 0, FAIL ≠ 0.
- **Guards pin today's source shape.** `test/stack-free-npm-test.test.js` G3 (`:145–158`), G5
  (`:175–202`), G6 (`:204–246`) and G7 (`:248–254`) regex-read `test/test.js` for the `overallOk`
  chain, `<var>.skipped`, `Total skipped:`, `process.exit(overallOk ? 0 : 1)` and the `const <x>Line`
  forms. G5 is the anti-recurrence guard that `harness-gate-integrity/0001` Decision 2 placed there.
  Any restructure must re-aim them without losing their properties.
- **Load-time reads depend on load order.** Eight `*-publish` suites read `TAPESTRY_SETTINGS_PATH`
  at module load (`authored-tagging-publish`, `customize-pin-curation-publish`,
  `most-pinned-tag-index-publish`, `profile-tag-polish-publish`, `tag-detail-publish`,
  `tag-detail-write-publish`, `tag-index-publish`, `tl-publication-from-pins-publish`). Four suites
  set it at run time, and `search-api-result-type-settings` deliberately leaves it set for the rest
  of the process (`search-api-result-type-settings.test.js:54–61`; it runs at `test/test.js:439`,
  after all eight readers). Today every module loads before any suite runs, so the readers never see
  a leaked value. No suite mutates `process.env` or globals *at load*; the six that write env do so
  inside functions.
- **Node versions in use.** This host runs v16.17.0 (despite `engines >=18`, `package.json:92–94`);
  CI and the Docker image run 22. No API newer than Node 16.
- **No new tooling** (CLAUDE.md house rule: no build step, no lint/typecheck).
- **The record must not dirty the tree** (AC-1). `.gitignore:79` already ignores `tmp/`.
- **Coexisting listeners.** `honest-publish-reporting` R1 (`test/honest-publish-reporting.test.js:272–291`)
  attaches its own `unhandledRejection` listener to count rejections it caused and asserts zero. Node
  delivers to every listener, so a run-wide listener leaves R1's result unchanged.
- **Lane rules.** This story's deliverable is test infrastructure, so the ADR template's carve-out
  applies (ratified at `test-suite-hermeticity` #1; OPEN.md row 167). See Implementation notes.

No concepts are touched — test infrastructure only. The concept-graph probe answered HTTP 200; there
are no handles to walk. Firmware reinstall: no.

## Options considered

### Option A — a registry-driven runner that writes a run record (chosen)

Replace the four parallel lists with **one ordered registry** of suite files and a small **engine**
that runs it. The engine:

- **writes the record ahead of the run.** A per-run record file under `tmp/gate-runs/` is created
  before the first suite and updated after every suite. The final verdict and exit code go into it
  before the process exits with that same code.
- **isolates every suite.** Each suite is loaded up front in its own try/catch, run in its own
  try/catch, and has `process.exit` trapped while it runs. One run-wide listener catches escaped
  rejections and exceptions. No single failure can erase the others.
- **makes stdout trustworthy.** stdout/stderr are set blocking, and a reader that goes away (EPIPE)
  is tolerated, so progress lines arrive as each suite finishes and the last line survives
  `process.exit`.
- **handles interruption.** SIGINT, SIGTERM and SIGHUP write INTERRUPTED with the progress so far.
- **computes every total from one results array**, so omission and double counting are impossible
  by construction.

A new `npm run gate:status` reads the records back. It shows the latest run by default and takes
`--run <id>` and `--list` for overlapping runs; it detects a killed run by its dead pid and exits with
the recorded outcome. One shared helper replaces the nine private curl-status parsers. The docs point
at one canonical recipe.

- *Pros:*
  - Fixes every AC at its cause rather than downstream.
  - The class behind #43, #58 and #235 disappears: a new suite is one registry line.
  - The record survives `tail`, background launches, closed pipes, tool timeouts and SIGKILL,
    because the run's state never depends on stdout.
  - `npm test` stays the command with the same exit semantics, so CI needs no edit.
  - A suite that fails to load becomes that suite's failure instead of a crash.
  - Per-suite timings in the record give story 2 its runtime data for free.
- *Cons:*
  - A one-time rewrite of `test/test.js`.
  - The four G-guards must be re-aimed (Phase 3).
  - The summary's per-suite labels become suite file names.
  - The records are a new artifact directory to prune.
  - Blocking stdout relies on `_handle.setBlocking`, which is widely used but undocumented. If it is
    missing, the record stays authoritative and only piped-progress timing degrades.

### Option B — a supervisor process around the unchanged runner

`npm test` becomes a wrapper that spawns `node test/test.js`, tees its output to a file, records the
child's exit code or signal, and forwards signals.

- *Pros:* leaves `test/test.js` and its guards untouched; the parent sees a SIGKILLed child's signal
  directly.
- *Cons:* cannot satisfy AC-3 or AC-4, and ends up needing Option A's runner changes anyway, plus a
  second process to reason about. Rejected. In detail:
  - One suite's throw still kills the child, and every later suite stays unrun.
  - The skipped totals stay wrong, and per-suite data would have to be scraped from text.
  - The child still ends with `process.exit` into a pipe the wrapper reads, so on macOS its last
    lines can still be lost unless the child is changed.
  - A process-group SIGKILL (the tool-timeout case) kills the wrapper too, so the write-ahead state
    is still needed.

### Option C — patch the existing runner in place

Wrap each of the 196 awaits in a `safeRun()`, hand-fix the skip list (add 36, dedupe 4), add
skipped counts to 119 summary lines, and add signal handlers and record writing inline.

- *Pros:* smallest conceptual change; most of G5/G6's current regexes keep working.
- *Cons:* keeps the four hand-synchronized lists that produced #43, #58 and #235. Every new suite
  still needs five coordinated edits, so the next omission is a matter of time. It fixes the
  instances, not the class. Rejected.

## Decision

We chose **Option A**. It is the only option that makes AC-3 and AC-4 true by construction rather
than by vigilance, and the only one that keeps the verdict readable when stdout is lost. Option B
cannot isolate suites; Option C preserves the defect class.

What we trade away: a one-time runner rewrite, four re-aimed guards, and the old hand-written summary
labels, which are replaced by suite file names plus the carried skip notes.

**Load order.** The engine loads every suite **before running any**, as today, with each load
guarded. Loading lazily (just before each suite runs) was considered and rejected. It is inert under
today's order, but it would make the eight load-time `TAPESTRY_SETTINGS_PATH` readers sensitive to
their position relative to `search-api-result-type-settings`' deliberate leak — a new ordering
coupling. Snapshotting and restoring `process.env` around each suite was also rejected: it would
change cross-suite env semantics that suite documents as intended, which is the assertion sweep's
business, not this story's.

**Supersession.** This ADR supersedes the *mechanism* that `harness-gate-integrity/0001` Decision 2
guards, since the `overallOk` chain no longer exists. It keeps that decision's placement (the
anti-recurrence guard stays in `test/stack-free-npm-test.test.js`) and its property (every registered
suite gates the exit code). It likewise supersedes the source-shape contract behind G3
(`test-hermeticity-ci` story 2) while keeping its property: skips are visible per suite and in
aggregate, and never mask a failure. It is consistent with `test-hermeticity-ci/0001`, since CI still
runs plain `npm test`. Both superseded decisions are retired under `decisions/done/` and are not
edited.

## Consequences

- **What this enables:**
  - a verdict that survives any launch or ending;
  - one registry line per new suite;
  - per-suite timings, which are story 2's runtime data;
  - a status command that Directors, Reviewers and judges can script against;
  - the four unregistered suite files, now visible as explicit exclusions.
- **What this constrains:**
  - Every `test/*.test.js` file must be registered or listed as excluded with a reason, which the
    re-aimed G5 enforces.
  - Registry order is both the load order and the run order. Load order changes from today's
    require-list order to the registry order. This is inert: no suite mutates `process.env` or
    globals at load.
  - `Overall:` keeps its leading token (`Overall: PASS|FAIL|INTERRUPTED`) because existing readers
    grep `Overall: *PASS`.
- **Changes a reader will notice:**
  - Escaped rejections and exceptions, which crash the process today, appear as a failing
    `stray async errors` entry in a completed run. The run is red either way, but now every suite
    runs and a verdict prints.
  - A suite that fails at load is that suite's FAIL rather than a crash.
  - Progress lines bracket each suite's own output.
- **New debt / follow-ups:**
  - The four unregistered suite files need a disposition (register or retire). They are listed here,
    not fixed; row 38's event-tagging reconciliation is their natural home.
  - `search-api-result-type-settings`' deliberate `TAPESTRY_SETTINGS_PATH` leak is a latent
    cross-suite coupling, and a candidate for the assertion sweep (`test-suite-hermeticity` #2).
  - `tmp/gate-runs/` is bounded (the newest 30 records) and local.
  - Records from in-container runs (`docker exec tapestry node …`) land inside the container and are
    invisible to the host's `gate:status`. The documented gate is host-side `npm test`.
  - Per-suite timeouts are story 2's.
- **Firmware reinstall required?** No — no concept definitions change.

## Implementation notes

**Lane mapping — the carve-out applies.** The artifact under repair is test infrastructure
(`test/test.js` and nine suites' HTTP helpers), so the standing test-lane rule inverts (ADR template,
"Carve-out"):

- **Phase 3 (Tester):**
  - writes a new guard suite, `test/gate-result-record.test.js`, that fails against today's runner
    and helpers;
  - re-aims `stack-free-npm-test` G3, G5, G6 and G7 (listed below);
  - registers the new suite.
- **Phase 4 (Implementer):**
  - builds the engine, the registry, the status command and the shared helper;
  - migrates the nine suites and edits the docs;
  - must not touch the new guard suite or the re-aimed guards.

A Phase-4 `test/` diff is therefore expected. The Reviewer checks that it is confined to the files
named below.

**1. Engine — new `test/helpers/gateRunner.js`,** exporting
`runGate({ suites, recordDir, label, out })`. `suites` is an ordered array of `{ file, skipNote? }`
resolved against `test/`.

- **Setup, before anything runs:**
  - Prune `recordDir` to the newest 30 records, never deleting one whose pid is alive.
  - Create the run record, then print its id and path as the run's **first** line.
  - Call `process.stdout._handle.setBlocking(true)`, and the same for stderr, when available.
  - Install `process.stdout.on('error', …)`, so an EPIPE (a reader that closed early, e.g.
    `| head`) stops stdout output while the run and the record continue.
  - Install one run-wide `unhandledRejection` / `uncaughtException` listener. It appends
    `{ during: <current suite>, message }` to `strayErrors`, and coexists with suite-local listeners
    such as `honest-publish-reporting` R1.
- **Load:** `require` every entry in registry order, each inside its own try/catch. A load failure
  becomes that entry's result `{ fail: 1, error: 'failed to load: …' }`, and its `run()` is not
  attempted. Eager, per the Decision.
- **Run each entry, in registry order:**
  - Print `▶ [i/N] <name>`.
  - While the suite runs, replace `process.exit` with a function that throws; restore it afterwards.
  - `await run()` inside try/catch; a throw becomes `{ fail: 1, error }`.
  - Normalize the result to `{ pass, fail, skipped }`. A missing or non-numeric `pass`/`fail` becomes
    a `returned no result counts` FAIL; a missing `skipped` becomes 0.
  - Print `  [i/N] <name>: PASS|FAIL|SKIP (<p> passed, <f> failed, <s> skipped) <ms>ms`.
  - Rewrite the record with the progress and that entry's result.
- **Suite verdict:**
  - FAIL if `fail > 0` or the suite errored.
  - SKIP if `pass + fail === 0 && skipped > 0`, rendered `SKIP (<s> tests; <skipNote>)` when a
    skipNote exists.
  - Otherwise PASS.
  - Skips never affect the gate.
- **End of run:**
  - If `strayErrors` is non-empty, add a failing `stray async errors` entry.
  - The verdict is PASS iff every entry passed or skipped. Totals are summed from the results array —
    the only place they are computed.
  - Print the final table, one line per entry.
  - If anything failed, print a `Failed suites: <names>` line.
  - Print `Total skipped: <n>`.
  - Print the last line:
    `Overall: PASS|FAIL — <p> passed, <f> failed, <s> skipped across <N> suites · record <path>`.
  - Write the final record synchronously, then `process.exit(code)` with 0 for PASS and 1 for FAIL.
- **Signals.** On SIGINT, SIGTERM or SIGHUP, and only if the record is not already finished (the
  first transition wins):
  - write `state: "interrupted"`, `verdict: "INTERRUPTED"`, `signal`, the progress and
    `exitCode: 128 + signo`;
  - print `Overall: INTERRUPTED — <signal> after <completed>/<N> suites · record <path>`;
  - exit with that code.

  SIGKILL leaves `state: "running"`; the reader decides such a run is unfinished.

**2. Record — new `test/helpers/gateRecord.js`,** shared by the engine and the reader.

- **Where records live:** `tmp/gate-runs/<runId>.json`. `GATE_RECORD_DIR` overrides the directory,
  which the guard's fixture runs need.
- **Run id:** `<compact UTC timestamp>-<pid>-<4 random hex>`.
- **Writes are atomic:** write `<id>.json.tmp`, then `renameSync`.
- **Schema v1:**
  - identity: `schema`, `runId`, `label` (`GATE_LABEL` or `null`), `pid`, `host`, `node`, `cwd`,
    `argv`;
  - outcome: `state` (`running|finished|interrupted`), `verdict` (`PASS|FAIL|INTERRUPTED|null`),
    `exitCode`, `signal`;
  - timing: `startedAt`, `updatedAt`, `finishedAt`;
  - `git`: `{ commit, branch, dirty, dirtyCount }`, from `git rev-parse HEAD`,
    `git rev-parse --abbrev-ref HEAD` and `git status --porcelain` at start, or `{ error }` when git
    is unavailable;
  - `progress`: `{ total, completed, current }`;
  - `totals`: `{ passed, failed, skipped, suitesPassed, suitesFailed, suitesSkipped }`;
  - `suites`: `[{ file, verdict, pass, fail, skipped, ms, error, failures }]`, where `failures` is
    capped at 20 entries of at most 500 characters each;
  - `strayErrors`.
- **Helpers:**
  - `createRecord`, `updateRecord`, `finishRecord`, `interruptRecord`, `listRecords(dir)`,
    `readRecord(path)`;
  - `isAlive(pid)`, via `process.kill(pid, 0)`, treating ESRCH as dead and EPERM as alive.

**3. Registry — new `test/registry.js`,** exporting:

- **`suites`:** an ordered array of `{ file, skipNote? }`.
  - Its order is **the current execution order** — the `await` sequence at `test/test.js:306–731`,
    not the `require` order.
  - A config pseudo-entry wrapping today's `testConfigLoading()` (`:15–24`) stays first.
  - `skipNote` carries over the reason text each existing `<x>Line` ternary embeds (e.g.
    `control panel not reachable` at `:747`, `preconditions not met` at `:752`), so no skip reason is
    lost in the move.
- **`excluded`:** `[{ file, reason }]` for the four unregistered files, each with the reason
  `not run as of 2026-09-12; disposition pending the event-tagging reconciliation (OPEN.md row 38)`.

**4. Runner — `test/test.js`** becomes a thin entry point. It keeps the config smoke check's env setup
(`:11–13`) and calls
`runGate({ suites: require('./registry').suites, recordDir, label: process.env.GATE_LABEL })`.
Everything from `:26` to `:1558` goes. `npm test` is unchanged (`package.json:13`).

**5. Reader — new `test/gate-status.js`,** plus `"gate:status": "node test/gate-status.js"` in
`package.json`.

- **Which runs it shows:** the newest record by `startedAt` by default; `--run <id>`,
  `--label <text>`, or `--list` for the newest 10.
- **Output:** one line per run:
  `<runId> [<label>] started <t> on <commit><+dirty> — <STATE>: <verdict>, exit <n>, <p>/<f>/<s>, <completed>/<N> suites · <path>`.
  `--json` prints the raw record instead.
- **A record still marked `running`:**
  - if its pid is dead, it shows as `UNFINISHED — process <pid> is gone (killed?) after <completed>/<N>, last progress <ago>`;
  - if its pid is alive, it shows as `RUNNING — <completed>/<N>, current <suite>, last progress <ago>`.
- **Exit status:**
  - the recorded `exitCode` for a finished or interrupted run;
  - 3 for unfinished;
  - 4 for still running;
  - 2 when there is no record or it can't be read.

**6. Shared stack-HTTP helper — new `test/helpers/stackHttp.js`.**

- **Exports:**
  - `loopbackRequest({ container, method, url, body, timeoutS })` runs
    `docker exec <container> curl -s -m <t> … -w '\n__STATUS__%{http_code}'`.
  - It returns `{ status, json, raw, noResponse }`.
  - `noResponse` is true on empty output, a missing marker, or `%{http_code}` = `000`. In that case
    `status` is `null`, never synthesized.
  - `describeResponse(r)` returns `no response from the stack (…)` or `HTTP <status>`, for assertion
    messages.
- **The nine suites that move onto it:**
  - **The five synthesizers.** Their `refreshAllViaLoopback()` (or equivalent) returns the helper's
    result. Assertions that compared `status === 200` now compare
    `!r.noResponse && r.status === 200 && r.json?.success === true`, with `describeResponse(r)` in
    the message.
  - **The three `__STATUS__` parsers.**
  - **`operational-direction` H1.** It fails on `noResponse` before testing `!== 404`.

**7. Docs (AC-6) — one canonical recipe, pointed to from every site that runs or reads the gate.**

- **Add a section "Running and reading the test gate" to `engineering-team/README.md`:**
  - Run the gate however suits the session: foreground `npm test`, backgrounded, redirected or piped.
  - Tag a run with `GATE_LABEL=<who/what>` when others may be running.
  - Read the answer with `npm run gate:status`, adding `-- --list` or `-- --run <id>` when runs
    overlap. Its verdict and exit status are the gate's answer.
  - Never take a verdict from a background-completion notice, a piped `$?` or `PIPESTATUS`, or the
    tail of captured output.
- **Point to it from these sites** (the verified inventory, 20 files):
  - `roles/implementer.md:19,27,36`; `roles/reviewer.md:21,35`; `roles/tester.md:16,17,23`
  - `roles/director.md:119,124,132` — Gate 4 journals the run id and the recorded verdict
  - `workflows/3-test-design.md:13,24`; `workflows/4-implementation.md:13,18,31`;
    `workflows/5-review.md:15`; `workflows/6-book-close.md:38`; `workflows/light-profile.md:54`;
    `workflows/protocol-spec-workflow.md:36`
  - `templates/review-checklist.md:9`; `templates/test-plan.md:24,32`; `templates/build-audit.md:40`
  - `.claude/agents/implementer.md:19,23`; `.claude/agents/reviewer.md:22`;
    `.claude/agents/tester.md:21`; `.claude/agents/gate-judge.md:23`
  - `.claude/commands/implement-feature.md:18`; `.claude/commands/review-changes.md:21`
  - `.claude/skills/direct-feature/SKILL.md:53,61`
- **CHANGELOG row.** Every one of these is a harness-definition path (`scripts/harness-def-paths.txt`),
  so the same commit carries an `engineering-team/CHANGELOG.md` row. Otherwise L10 fires after the
  commit (row 98).

**8. Ledger** (in the implementation commit; the Reviewer verifies):

- Flip OPEN.md rows 103, 105, 111, 157, 227, 235 and 263 to `DONE`, citing this ADR.
- Append to rows 104, 106 and 192: "runner half shipped (honest-test-gate #1); the suite-side skip
  decision remains story 3."

**Phase-3 re-aims — `test/stack-free-npm-test.test.js`.** Each keeps its property; only the mechanism
moves.

- **G3** (the 12 targets render SKIP, plus `Total skipped:`): the 12 are registered with a
  `skipNote`, and the engine renders a result with `pass + fail = 0, skipped > 0` as
  `SKIP (<n> tests; <note>)` and states the total.
- **G5** (every suite gates; skips are never consulted; the exit is strict):
  - *registry completeness:* every `test/*.test.js` is in `suites`, or in `excluded` with a reason,
    and the exclusions are exactly the known four;
  - *behavior:* a fixture registry run through `runGate` exits 1 with `Overall: FAIL` when any entry
    fails, and 0 when the only non-pass entry is a skip.
- **G6** (a planted failure flips the verdict): the same behavioral check, with the failing entry
  planted first, in the middle and last.
- **G7** (no `.skipped`-only ternary): behavioral — `{ fail: 1, skipped: 2 }` renders
  `FAIL (… 2 skipped)`, never SKIP.

**Phase 3 — the new guard suite's expected coverage.** This is the Tester's design space; the list is
the coverage this ADR expects. It must run stack-free: fixture suites written to a temp dir,
`GATE_RECORD_DIR` pointed at a temp dir, and the engine spawned in a child `node` process.

- **AC-1:**
  - Launch four ways: foreground, `| tail -1`, and detached under both `bash -c` and `zsh -c`
    (SKIP with a reason where zsh is absent, e.g. on CI Linux).
  - Each time, the record's verdict and exit code match the child's, and the git identity fields
    are present.
  - Two concurrent runs leave two distinct, readable records.
  - `git status --porcelain` is unchanged after a run.
- **AC-2:**
  - SIGINT or SIGTERM to a run parked in a slow fixture gives INTERRUPTED, the completed count, and
    exit 128+n.
  - SIGKILL leaves `running`, which `gate:status` reports as UNFINISHED with exit 3.
  - Never PASS, and never the previous run's result.
- **AC-3:**
  - A fixture that throws in `run()`, one that throws at load, one that calls `process.exit`, and one
    that leaves an unhandled rejection. In each case later fixtures still run and a verdict still
    prints.
  - `stackHttp` given empty output, a missing marker, or `000` reports `noResponse` with a
    "no response" description.
- **AC-4:** totals equal the per-entry sums, and the verdict line carries the skipped total.
- **AC-5:** with stdout to a file and to a pipe, and with a fixture that blocks the event loop via
  `execSync`, each entry's result line is readable within 5 s of that entry finishing.
- **AC-6:** each listed doc site references the README section, and none says to trust a
  notification or a piped status.

## Out of scope

- **Making the gate fit a session** — per-suite timeouts and a story-scoped gate (story 2; rows 83,
  181, 271).
- **Deciding when a suite should skip because its environment is missing** (story 3; rows 104/106,
  191, 192). This ADR only guarantees that a suite's error cannot erase the run.
- **Registering or retiring the four unregistered suite files.** They are listed as exclusions; their
  disposition belongs to row 38.
- **Cross-suite env hygiene**, including `search-api-result-type-settings`' deliberate
  `TAPESTRY_SETTINGS_PATH` leak, and any assertion-level fix beyond the nine HTTP helpers. Both belong
  to the assertion sweep (`test-suite-hermeticity` #2).
- **Playwright**, and any change to CI's workflow or to which suites CI runs.
- **The session tool's background-completion notice.**
