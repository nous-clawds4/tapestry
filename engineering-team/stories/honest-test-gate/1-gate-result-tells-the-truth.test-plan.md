# Test Plan: Story 1 — A gate run's result tells the truth, however it was run

**Story:** `engineering-team/stories/honest-test-gate/1-gate-result-tells-the-truth.md`
**ADR:** `engineering-team/decisions/honest-test-gate/0001-registry-runner-and-run-record.md`
**Date:** 2026-09-12

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
