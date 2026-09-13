# Test Plan: Story 1 — A gate run's result tells the truth, however it was run

**Story:** `engineering-team/stories/honest-test-gate/1-gate-result-tells-the-truth.md`
**ADR:** `engineering-team/decisions/honest-test-gate/0001-registry-runner-and-run-record.md`
**Date:** 2026-09-12
**Amended:** 2026-09-13 — `C11`–`C15` added at the review kick-back (review `c6ed2b35`); see
§ "Amendment, 2026-09-13".

## The shape of this story, and who edits what

This story's deliverable is test infrastructure, so the ADR's carve-out applies (ADR 0001,
Implementation notes; ratified at `test-suite-hermeticity` #1): the Tester writes guards that fail
against the code under repair, and the Implementer changes that code without touching the guards.

- **Phase 3 (this plan):**
  - adds the new guard suite `test/gate-result-record.test.js` (29 tests);
  - adds its helper `test/helpers/gateFixtures.js`, which writes fixture suites, drives the engine in
    child processes, reads records, and provides a fake `docker`;
  - re-aims `test/stack-free-npm-test.test.js` G3, G5, G6 and G7 (G1, G2 and G4 are unchanged);
  - registers the new suite in today's `test/test.js` at its five sites.
- **Phase 4 (Implementer)** builds ADR §1–§8. It **must not modify** `test/gate-result-record.test.js`,
  `test/helpers/gateFixtures.js`, or `test/stack-free-npm-test.test.js`.
- **The expected Phase-4 `test/` diff:** the rewritten `test/test.js`, `test/registry.js`,
  `test/gate-status.js`, `test/helpers/gateRunner.js`, `test/helpers/gateRecord.js`,
  `test/helpers/stackHttp.js`, and the nine suites named in ADR §6. Nothing else under `test/`.

Nothing in the guards requires the engine at module load. Today's runner loads every registered
suite before running any, so a load-time throw would crash the whole gate. Instead, each test calls
`need()`, which fails that test with the missing file's name and the ADR section defining it.

### Interface the guards rely on (all from ADR 0001, restated so nothing is implicit)

- **Engine.** `require('test/helpers/gateRunner.js').runGate({ suites, recordDir, label })`.
  - `suites` is a list of `{ file, skipNote? }`, with `file` resolved against `test/`. The guards
    pass fixture paths *relative to `test/`* (e.g. `../../../var/…/pass.test.js`), which any
    resolution against `test/` handles.
  - The guards set both the `recordDir` option and `GATE_RECORD_DIR`. With neither set, records go
    to `tmp/gate-runs/`.
- **Record (schema v1).** The guards read `runId`, `label`, `state`, `verdict`, `exitCode`, `signal`,
  `startedAt`, `git.commit`, `git.dirty`, `progress.completed`, `progress.total`, `totals.passed`,
  `totals.failed`, `totals.skipped`, `suites[].file`, `suites[].verdict`, `suites[].pass`,
  `suites[].fail`, `suites[].skipped`, `suites[].error`, and `strayErrors`.
- **Output.**
  - The first line names the record file.
  - Per-suite result lines read `[i/N] <name>: PASS|FAIL|SKIP (<p> passed, <f> failed, <s> skipped) …`.
  - A whole-suite skip reads `SKIP (<n> tests; <skipNote>)`.
  - A `Total skipped: <n>` line.
  - The last line reads `Overall: PASS|FAIL|INTERRUPTED — … <p> passed, <f> failed, <s> skipped … · record <path>`.
- **Reader.** `node test/gate-status.js [--list | --run <id> | --label <l>]`, honoring
  `GATE_RECORD_DIR`.
  - Exit status: the recorded exit code; 3 for unfinished, 4 for running, 2 when there is no record.
  - Output carries the run id and the state words (RUNNING / UNFINISHED / PASS / FAIL / INTERRUPTED).
  - `package.json` has `"gate:status"` pointing at it.
- **Stack-HTTP helper.** `test/helpers/stackHttp.js` exports:
  - `loopbackRequest({ container, method, url, body, timeoutS })`, sync or async, returning
    `{ status, json, raw, noResponse }`. It reaches the stack through whichever `docker` is first on
    `PATH`.
  - `describeResponse(r)`.

## Coverage map

`GRR` = `test/gate-result-record.test.js`; `SF` = `test/stack-free-npm-test.test.js`. "Engine" tests
run `runGate()` in a child process over fixture suites and judge its exit status, its output and the
record it leaves.

| Criterion | Test | File | Level |
|---|---|---|---|
| AC-1 | `A1` a foreground run records the same verdict and exit code it exits with (PASS/0, FAIL/1) | GRR | engine |
| AC-1 | `A2` the record says which run it is (start time, commit, dirty flag); first and last lines name the record | GRR | engine |
| AC-1 | `A3` piped into `tail -1` under bash: the tail still shows the verdict; the record reads FAIL/1 although the pipeline exits 0 | GRR | engine + shell |
| AC-1 | `A4` the same under zsh (SKIPs with a reason where zsh is not installed) | GRR | engine + shell |
| AC-1 | `A5` launched in the background: the launcher returns 0 at once; the finished record reads FAIL/1 | GRR | engine + shell |
| AC-1 | `A6` two overlapping runs leave two distinct records; the reader lists both and selects by label | GRR | engine + reader |
| AC-1 | `A7` with no record directory configured, the record lands in `tmp/gate-runs/` and `git status` is unchanged | GRR | engine |
| AC-1 | `A8` `gate:status` is the documented reader: newest run, recorded exit status, exit 2 with no records | GRR | reader |
| AC-2 | `B1` SIGINT mid-run gives INTERRUPTED with the finished-suite count and exit 130, never PASS | GRR | engine |
| AC-2 | `B2` SIGTERM mid-run gives INTERRUPTED and exit 143 | GRR | engine |
| AC-2 | `B3` a SIGKILLed run is reported UNFINISHED (exit 3), not as the previous run's PASS | GRR | engine + reader |
| AC-2 | `B4` a live run is reported RUNNING with its progress (exit 4) | GRR | engine + reader |
| AC-3 | `C1` a suite that throws is that suite's FAIL with its error; later suites run; a verdict prints | GRR | engine |
| AC-3 | `C2` a suite that throws while loading is that suite's FAIL; the others load and run | GRR | engine |
| AC-3 | `C3` a suite's `process.exit(0)` cannot end the run: that suite FAILs and the exit is 1 | GRR | engine |
| AC-3 | `C4` an escaped unhandled rejection is recorded as a failing stray error; no crash | GRR | engine |
| AC-3 | `C5` a suite returning no counts is a FAIL, not a silent PASS | GRR | engine |
| AC-3 (ADR Decision "Load order") | `C6` every suite loads before any runs: a later suite's load-time env read is untouched by an earlier suite's run-time write | GRR | engine |
| AC-3 | `C7` the helper reports "no response" (status `null`) for empty output, a missing marker, `000`, or a failed `docker exec` | GRR | unit (fake docker) |
| AC-3 | `C8` the helper passes real statuses through: a 200 with `success:false` stays 200, a real 500 stays 500 | GRR | unit (fake docker) |
| AC-3 | `C9` no suite derives a status from a body (`? 200 : 500`) or parses curl's status marker; the nine suites use the helper | GRR | source |
| AC-3 | `C10` `operational-direction` H1 fails when nothing answers (today `000` passes) | GRR | source, region-scoped |
| AC-3 | `C11` the engine's own failure (its run-record write throws mid-run) still ends `Overall: FAIL` with a non-zero exit; a precondition confirms the injected fault fired | GRR | engine, fault-injected |
| AC-3 | `C12` a `process.exit(0)` at module load cannot end the run: that suite FAILs naming `process.exit`, the suites before and after it pass, exit 1, and the record reads FAIL/1 | GRR | engine |
| AC-3 | `C13` a `process.exit(0)` the last suite leaves on a timer is a stray error (`strayErrors` names `process.exit`): `Overall: FAIL`, exit 1, and the record reads FAIL/1 | GRR | engine |
| AC-2 | `C14` a `run()` that never settles and holds nothing open ends `Overall: FAIL` with a non-zero exit, and the record reads FAIL with that exit, never PASS; the spawn is bounded at 20 s | GRR | engine, bounded |
| AC-3 | `C15` `fail: NaN`, `fail: -1` and `skipped: '4'` each make that suite FAIL with `returned no result counts`; the next suite still runs; `Overall: FAIL`, exit 1 | GRR | engine |
| AC-4 | `D1` totals equal the per-suite sums, and every result line shows passed/failed/skipped | GRR | engine |
| AC-4 | `D2` the verdict line states the skipped total (0 vs 3), plus `Total skipped:` | GRR | engine |
| AC-4 | `D3` a skip-only suite reads SKIP and leaves the verdict PASS; a failing suite with skips reads FAIL with its count | GRR | engine |
| AC-5 | `E1` stdout to a pipe, next suite blocking the event loop: the result line is readable within 5 s | GRR | engine, timed |
| AC-5 | `E2` the same with stdout to a file | GRR | engine, timed |
| AC-6 | `F1` the README "Running and reading the test gate" section names `gate:status` and `GATE_LABEL`, and warns off background notices and piped statuses | GRR | source |
| AC-6 | `F2` all 20 run-or-read doc sites point at that section; none carries `PIPESTATUS` | GRR | source |
| AC-4 (property kept) | `G3` re-aimed: the 12 live-API suites are registered with a `skipNote`; a whole-suite skip renders `SKIP (<n> tests; <note>)`; `Total skipped:` | SF | registry + engine |
| AC-6 ("every registered suite still feeding the verdict") | `G5` re-aimed: every `test/*.test.js` is registered or excluded with a reason, and the exclusions are exactly the known four; `test/test.js` runs the registry through `runGate`; a failure gives exit 1, a skip gives exit 0 | SF | registry + engine + source |
| AC-6 | `G6` re-aimed: a failure first, in the middle, or last fails the gate; an all-pass registry passes | SF | engine |
| AC-4 | `G7` re-aimed: `{ fail: 1, skipped: 2 }` renders FAIL with its skip count, never SKIP | SF | engine |

## Edge cases covered

- [x] Load-time vs run-time throws (`C2` vs `C1`); a suite calling `process.exit` (`C3`); a stray async
      rejection (`C4`); a suite returning nothing (`C5`).
- [x] Load-order semantics the ADR chose on purpose (`C6`). This is the eight `TAPESTRY_SETTINGS_PATH`
      readers' case, reduced to a fixture.
- [x] Every no-response shape: empty output, missing marker, `000`, `docker` failing (`C7`). Also the
      row-263 inversion: a 200 carrying `success:false` must not read 500 (`C8`).
- [x] Output lost at `process.exit`: `A3`/`A4` use a 4 MB fixture so a pipe really does fill.
- [x] A killed run that must not show the previous PASS (`B3`); a run that is still alive (`B4`).
- [x] Two runs at once in one checkout (`A6`); the default location plus `git status` (`A7`); no
      records at all (`A8`).
- [x] A green run with skips vs a green run without (`D2`); a failure hiding among skips (`D3`, `G7`).
- [x] A failure at every position in the registry (`G6`); a suite file nobody registered (`G5`).
- [x] *Added 2026-09-13:* each way the review found that a run could still end with exit 0 and no
      verdict: the engine's own exception (`C11`), `process.exit` while loading (`C12`), a deferred
      `process.exit` from the last suite (`C13`), and a `run()` that never settles and holds nothing
      open (`C14`). Also counts that are not non-negative integers (`C15`).

## Deliberately not automated — the Reviewer verifies

- **The ledger flips.** OPEN.md rows 103, 105, 111, 157, 227, 235 and 263 go to DONE, with notes on
  104, 106 and 192. Row numbers can be reassigned (row 151), so this follows the
  `test-suite-hermeticity` #1 precedent.
- **Registry order = today's execution order.** This is a one-time migration property. Compare
  `test/registry.js` with the `await` sequence in `git show <this plan's commit>:test/test.js`
  (lines 306–731). The extraction the satisfiability sketch used (below) does this mechanically.
- **All 45 skip notes carried over.** `G3` pins only the 12 live-API targets.
- **A full `npm test` on the finished change:** Overall PASS, read back with `npm run gate:status`,
  and the CI stack-free job green on the PR.
- **A terminal as stdout** (AC-5's third case). A child process has no pty to test with. The blocking
  writes cover every handle type, and the Reviewer eyeballs one terminal run.
- **Doc wording.** `F1`/`F2` pin the pointer and the absence of `PIPESTATUS`. Whether each doc's
  prose is right is a Reviewer read.
- **How `test/test.js` handles a rejected `runGate`** *(added 2026-09-13)*. The guards drive the
  engine through the fixture driver. When `runGate` rejects, that driver falls back to exiting 99, so
  the guards cannot see that `test/test.js` has no such fallback: through it, the review's route 1
  exits 0. Instead, `C11` requires the engine itself to end with a verdict and a non-zero exit, which
  leaves the entry point nothing to catch. The Reviewer confirms that `test/test.js` cannot end 0
  without a verdict, e.g. by driving `runGate` over `record-write-fault` the way `test/test.js` does,
  with no `.catch`.

## Satisfiability check — the suite was run against a throwaway, ADR-faithful sketch

The suite was built against a sketch of ADR §1–§7 in a scratch git worktree; nothing from it is
committed. The sketch covered the engine, record helpers, reader, stack-HTTP helper, a config
pseudo-entry, a registry generated from today's runner, a thin `test/test.js`, the `gate:status`
script, the README recipe, the 20 pointers and crude migrations of the nine suites.

- Against the sketch, `test/gate-result-record.test.js` gave **29 passed / 0 failed / 0 skipped**
  in 19 s.
- `test/stack-free-npm-test.test.js` gave **6 passed / 0 failed / 1 skipped**. The skip is G2, because
  no live stack was up.

Findings the Implementer should know. These are facts about the ADR's design, not extra requirements:

1. **The per-suite `process.exit` trap collides with the signal path.** In the first sketch, the
   signal handler exited through `process.exit` while a suite's trap was installed. The exit threw,
   the run carried on, and its later finish overwrote INTERRUPTED with FAIL. `B1`/`B2` caught it. The
   engine's own exits (the signal path and the final verdict) have to use the real exit.
2. **An escaped rejection is only seen while the engine still has turns to run.** Node reports
   unhandled rejections when the microtask queue drains, so the `C4` fixture yields one macrotask after
   rejecting. Any engine with a listener installed will see it.
3. **The sketch's registry extraction is a ready check for the migration.** Scanning today's
   `test/test.js` for the `require` map, the `await` order and the `<x>Line` ternaries yields 197
   suites (plus the config entry) and **45 skip notes**, matching the ADR.

## Mutation check — each test shown red against broken code

In the sketch, one ADR behavior was broken at a time and the affected tests were run.

| Broken behavior | Tests that went red |
|---|---|
| stdout not set blocking | `A3`, `A4`, `E1` (see note on `E2`) |
| no signal handlers | `B1`, `B2` |
| signal handler exits through the per-suite trap | `B1`, `B2` |
| no per-suite isolation | `C1`, `C2`, `C3` |
| `process.exit` not trapped | `C3` |
| no stray-error listener | `C4` |
| suites loaded lazily | `C6` |
| result lines without the skip count | `D1`, `D3` |
| totals summed from a list missing a suite | `D1` |
| a skip masks a failure | `D3`, `G7` |
| the first suite's failure ignored | `G6` |
| no write-ahead (record written only at the start and end) | `B1`, `B2`, `B3`, `B4` |
| helper derives 200/500 from the body | `C7`, `C8` |
| reader shows the oldest run | `A8`, `B3` |
| reader without a liveness check | `B4` |
| registry drops `profile-tags`, strips `tag-detail`'s skipNote | `G3`, `G5` |
| two migrations reverted; README recipe and one doc pointer removed | `C9`, `C10`, `F1`, `F2` |

**Not individually mutation-checked:** `A1`, `A2`, `A5`, `A6`, `A7`, `C5` and `D2`. Each fails
against today's tree (no engine) and passes against the sketch.

**About `E2`:** it stays green without blocking writes, because Node writes files synchronously. It
covers the AC's file case but cannot discriminate. `E1` is the discriminating AC-5 test on macOS. On
Linux, pipes are synchronous too, so `E1` passes there either way, which matches the AC: the outcome
is what's pinned.

## Test infrastructure

- **Runner:** the repo's own — `node test/test.js`, suites exporting `run()`. No new tooling
  (CLAUDE.md: JS-without-build).
- **Registration:** in today's `test/test.js`, at the require, the await, the summary line, the
  `overallOk` term and the skip tally.
- **Child processes and fixtures:** fixture suites live in `os.tmpdir()`. Records go to a per-test
  temp dir, except `A7`, which writes one record into the gitignored `tmp/gate-runs/` and deletes it.
- **Tools used:** `bash`, `sh`, `tail`, `sleep` and `git` are always used. `zsh` is optional; `A4`
  SKIPs with a reason without it, e.g. on CI Linux.
- **No live stack, no firmware precondition.** Everything here runs in the CI stack-free job.
- **Runtime** against a working engine: about 19 s for the new suite. `E1`/`E2` each block 6 s by
  design, longer than AC-5's 5 s bound. The re-aimed G3/G5/G6/G7 add about 2 s.

## How to run

```bash
node test/gate-result-record.test.js
```

```bash
node -e "require('./test/stack-free-npm-test.test.js').run().then((r) => console.log(r))"
```

Full gate:

```bash
npm test
```

## Verification

The new tests fail against the current code, each for the right reason: a missing piece named with
its ADR section, or a real offender listed. There are no import errors, and the current runner still
loads with the suite registered (`node --check test/test.js` passes and the suite `require`s
cleanly). Confirmed 2026-09-12 on this plan's working tree over `6c7bb2b0`:

```
--- gate result record tests (epic honest-test-gate, Story 1) ---
  FAIL  A1 … A8, B1 … B4, C1 … C6, D1 … D3, E1, E2
        test/helpers/gateRunner.js does not exist yet — the engine, runGate({ suites, recordDir, label })
        (engineering-team/decisions/honest-test-gate/0001-registry-runner-and-run-record.md, Implementation notes §1).
        [A6, A8, B3, B4 also:] test/gate-status.js does not exist yet — the reader behind `npm run gate:status` (… §5).
  FAIL  C7, C8
        test/helpers/stackHttp.js does not exist yet — the shared stack-HTTP helper (loopbackRequest, describeResponse) (… §6).
  FAIL  C9 (AC-3): no suite invents an HTTP status or parses curl's status itself …
      - customize-pin-curation-publish.test.js: derives a status from the response body (`? 200 : 500`) …
      - firmware-concept-elements-sets.test.js: formats or parses curl's status marker itself …
      - move-nodes-between-sets-ui.test.js: formats or parses curl's status marker itself …
      - operational-direction.test.js: formats or parses curl's status marker itself …
      - relationship-primitives.test.js: formats or parses curl's status marker itself …
      - tag-detail-curated-view-and-pin-polish-publish.test.js / tl-membership-method-selector.test.js /
        tl-publication-from-pins-publish.test.js / tl-publication-from-pins.test.js: derive a status from the body …
      - (all nine) does not use the shared helper (require('./helpers/stackHttp'))
  FAIL  C10 (AC-3): operational-direction H1 fails when nothing answers, instead of passing
        H1 must fail when the stack gives no response. Today it asserts `out.trim() !== '404'`, which curl's 000 satisfies …
  FAIL  F1 (AC-6): engineering-team/README.md must have a "Running and reading the test gate" section (ADR §7)
  FAIL  F2 (AC-6): 20 offenders — each of the 20 run-or-read sites "does not point at the README recipe"

gate-result-record: 0 passed, 29 failed, 0 skipped

stack-free-npm-test (re-aimed):
  ✓ G1   - SKIP G2 (control panel not reachable at http://localhost:7778)   ✓ G4
  ✗ G3 / G5 — test/registry.js does not exist yet — the ordered suite registry ({ suites, excluded }) (… §3). test/helpers/gateRunner.js does not exist yet …
  ✗ G6 / G7 — test/helpers/gateRunner.js does not exist yet — the engine … (… §1).
  RESULT {"pass":2,"fail":4,"skipped":1}
```

## Amendment, 2026-09-13 — guards added at the review kick-back (review `c6ed2b35`)

The review (`engineering-team/reviews/honest-test-gate/1-gate-result-tells-the-truth.md`, § Findings,
Blocking) sent the story back to implementation with two blocking edges, and the operator approved
the kick-back. Under the ADR's carve-out, the Tester adds the failing guards first. The Implementer
then fixes the engine, and still must not modify `test/gate-result-record.test.js` or
`test/helpers/gateFixtures.js`.

- **Blocking 1:** the review reproduced four routes by which a run still ends with exit status 0
  and no verdict. That breaks AC-2 ("any exit status it returns is non-zero") and AC-3 ("the final
  verdict and exit status are still produced"). `C11`–`C14` cover the four.
- **Blocking 2:** a malformed count reads PASS, where the old runner failed it. `C15` covers it.

The suite now has 34 tests, and seven fixtures were added to `FIXTURE_SOURCES`. Every new test:
- spawns the engine through the existing driver;
- runs stack-free;
- judges only what a launcher or a reader sees: the exit status, the last output line, per-suite
  verdicts and record fields.

| Test | Registry | Asserts | At `c6ed2b35` |
|---|---|---|---|
| `C11` | `pass`, `record-write-fault`, `second-pass` | a non-zero exit; the last line is `Overall: FAIL` | exit 99, the driver's fallback for a rejected `runGate` (0 through `test/test.js`, per the review); no verdict line |
| `C12` | `pass`, `exits-at-load`, `second-pass` | exit 1; `Overall: FAIL`; the record reads FAIL/1; that entry is FAIL, naming `process.exit`; the other two PASS | exit 0 while loading; the last line is the run's first |
| `C13` | `pass`, `deferred-exit` (last) | exit 1; `Overall: FAIL`; the record reads FAIL/1; `strayErrors` names `process.exit` | exit 0; no verdict line |
| `C14` | `pass`, `never-settles` | a non-zero exit within 20 s; `Overall: FAIL`; the record reads FAIL with that exit | exit 0 once the event loop drains; the record is left `running` |
| `C15` | `nan-fail`, `negative-fail`, `string-skipped`, each followed by `pass` | that entry is FAIL with `result counts`; `pass` is PASS; `Overall: FAIL`; exit 1 | each reads PASS; exit 0 |

Fixture notes:
- **`record-write-fault`** refuses every write under `GATE_RECORD_DIR`, by its given path and its real
  path. It does this through every `fs` write entry point (sync, callback and promise), so the guard
  does not depend on how the engine writes its record. It marks `GATE_FIXTURE_MARKER` on its first
  refusal, and `C11` fails with a re-aim message if the fault never fired.
- **`C11` does not read the record.** The fault leaves the record unwritable, so the reader reports the
  run UNFINISHED.
- **`C14`'s spawn is bounded at 20 s**, so a regression that keeps the run alive fails instead of
  hanging the suite.

### Pre-fix verification — Node 16.17.0, `c6ed2b35` plus these guards

The run used `node -e "require('./test/gate-result-record.test.js').run()…"` from the repo root. The
existing 29 pass and the five new tests fail, each for its stated reason. The 29 PASS lines are
collapsed, and temp paths are shortened to `$TMPDIR/`:

```
--- gate result record tests (epic honest-test-gate, Story 1) ---
  [22 PASS lines: A1–A8, B1–B4, C1–C10]
  FAIL  C11 (AC-3): when the engine itself fails — its run-record write throws mid-run — the run still ends with Overall: FAIL and a non-zero exit, never with exit 0 and no verdict
        the engine's own failure (a run-record write that throws): the run must end with a non-zero exit and with its verdict as the last line (Overall: FAIL …); it exited 99, its last line was "[2/3] record-write-fault: PASS (1 passed, 0 failed, 0 skipped) 1ms", and the record reads state running, verdict null, exit null, 1/3 suites finished. stderr: driver: runGate rejected: Error: injected record-write failure (fixture: record-write-fault)
    at Object.api.<computed> [as writeFileSync] ($TMPDIR/g…
  FAIL  C12 (AC-3): a suite that calls process.exit while its module loads cannot end the run — it is that suite's FAIL, the suites around it still run and pass, and the exit is 1, not the 0 it asked for
        a process.exit(0) while loading: the run must end with exit 1 and with its verdict as the last line (Overall: FAIL …); it exited 0, its last line was "Gate run 20260913T051214Z-49476-d557 — record: $TMPDIR/gate-guard-vxLG2T/records/20260913T051214Z-49476-d557.json", and the record reads state running, verdict null, exit null, 0/3 suites finished. stderr: 
  FAIL  C13 (AC-3): a process.exit(0) that the last suite leaves on a timer cannot end the run — it is recorded as a stray error, and the run ends Overall: FAIL with exit 1
        the last suite's deferred process.exit(0): the run must end with exit 1 and with its verdict as the last line (Overall: FAIL …); it exited 0, its last line was "[2/2] deferred-exit: PASS (1 passed, 0 failed, 0 skipped) 1ms", and the record reads state running, verdict null, exit null, 2/2 suites finished. stderr: 
  FAIL  C14 (AC-2): a suite whose run() never settles, holding nothing open, cannot end the run with exit 0 — the run ends Overall: FAIL with a non-zero exit, and its record reads FAIL, never PASS
        a run() that never settles: the run must end with a non-zero exit and with its verdict as the last line (Overall: FAIL …); it exited 0, its last line was "▶ [2/2] never-settles", and the record reads state running, verdict null, exit null, 1/2 suites finished. stderr: 
  FAIL  C15 (AC-3): a suite reporting malformed counts — fail: NaN, a negative fail, a non-numeric skipped — is that suite's FAIL ("returned no result counts"), the next suite still runs, and the run exits 1
        a count that is not a non-negative integer must make that suite FAIL with "returned no result counts" (ADR §1; review c6ed2b35, Blocking 2), the next suite must still run, and the run must end Overall: FAIL with exit 1; got:
      - run() returning { pass: 1, fail: NaN }: the run exited 0; its last line was "Overall: PASS — 3 passed, NaN failed, 0 skipped across 2 suites · record $TMPDIR/gate-guard-JCZR9G/records/20260913T051214Z-49488-2508.json"; the suite is recorded PASS (pass 1, fail null, skipped 0, error null)
      - run() returning { pass: 1, fail: -1 }: the run exited 0; its last line was "Overall: PASS — 3 passed, -1 failed, 0 skipped across 2 suites · record $TMPDIR/gate-guard-puzfnl/records/20260913T051214Z-49492-652f.json"; the suite is recorded PASS (pass 1, fail -1, skipped 0, error null)
      - run() returning { pass: 1, fail: 0, skipped: '4' }: the run exited 0; its last line was "Overall: PASS — 3 passed, 0 failed, 0 skipped across 2 suites · record $TMPDIR/gate-guard-4G8dVQ/records/20260913T051214Z-49496-684e.json"; the suite is recorded PASS (pass 1, fail 0, skipped 0, error null)
  [7 PASS lines: D1–D3, E1, E2, F1, F2]

gate-result-record: 29 passed, 5 failed, 0 skipped
{"pass":29,"fail":5,"skipped":0}
```

On Node 22.23.2, CI's version, the same run gave the same counts: 29 passed, 5 failed, 0 skipped.
The same five tests failed for the same reasons, and `C11` again exited 99.

### Satisfiability and mutation check

As in Phase 3, the guards were run against a throwaway sketch in a scratch git worktree. The
worktree was removed afterwards, and nothing from it is committed. The sketch is `c6ed2b35`'s engine
with the review's asked changes:
- every engine path ends through the real exit, with a verdict (a catch-all around the run);
- `process.exit` is trapped from the load phase until the engine's own exit;
- an `'exit'` guard, while the run is unsettled, forces exit 1, marks the record FAIL synchronously
  and prints the verdict line;
- counts are accepted only as non-negative integers, and `fail === 0` is the pass check.

Against the sketch, the suite gave **34 passed / 0 failed / 0 skipped** on Node 16.17.0. With one
change turned off at a time:

| Turned off | Tests that went red |
|---|---|
| count validation | `C15` |
| the trap from load to exit (trapped only while `run()` runs, as at `c6ed2b35`) | `C12`: the run ends during load, so no suite runs. `C13`: `strayErrors` stays empty |
| the `'exit'` guard | `C14` |
| the catch-all | none: the `'exit'` guard alone still ends route 1 with FAIL/1 |
| the catch-all and the `'exit'` guard | `C11` (exit 0), `C14` |

### Findings the Implementer should know

These are facts about the asked changes, not extra requirements.

1. **A trap kept until the engine's own exit also traps a caller's fallback.** In the last row above,
   `runGate` rejected, and the driver's `.catch(() => process.exit(99))` hit the trap. The exit threw,
   and the engine's own `unhandledRejection` listener swallowed the rejection. The run ended 0. A
   `.catch` added to `test/test.js` would be swallowed the same way, so every engine path must end
   through the real exit itself.
2. **`C11` pins the outcome, not the mechanism.** Either a catch-all inside `runGate` or an `'exit'`
   guard satisfies it.
3. **An `'exit'` guard alone does not satisfy `C12` or `C13`.** It turns both routes into exit 1,
   but a load-time exit still ends the run before any suite runs, and a deferred exit leaves no stray
   error. The trap has to cover the load phase and the tail of the run.
4. **Setting `process.exitCode` inside an `'exit'` listener changes the exit status.** That is how the
   sketch's guard turned route 4's drained event loop into exit 1.
