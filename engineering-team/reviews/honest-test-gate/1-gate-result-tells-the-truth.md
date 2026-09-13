# Review: Story 1 — A gate run's result tells the truth, however it was run

**Reviewer:** Claude (acting as Reviewer), with an independent read-only second audit by a fresh
Reviewer subagent; every finding below was reproduced or verified before it was kept
**Date:** 2026-09-13
**Diff:** `git diff b8ea1f4d...HEAD` — failing tests `2c3472f2`, implementation `072da83a`, ledger
housekeeping `d210b5ff` (reviewed at `d210b5ff`)

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — run twice by the Reviewer on the committed tree; red on both Node versions, and
      every failing suite is outside this diff (the AC-6 deviation in the story):
  - Node 16.17.0, the host default — `20260913T042419Z-65016-a9c5 [review-honest-test-gate-1-node16]
    started 2026-09-13T04:24:19.728Z on d210b5ff — FAIL, exit 1, 2676 passed, 9 failed, 504 skipped,
    198/198 suites; failed: honest-publish-reporting`
  - Node 22.23.2, CI's version — `20260913T042736Z-98078-5426 [review-honest-test-gate-1-node22]
    started 2026-09-13T04:27:36.585Z on d210b5ff — FAIL, exit 1, 3019 passed, 42 failed, 128 skipped,
    198/198 suites; failed: tag-detail, capture-a-goal-and-see-it, structures-the-brain-can-trust,
    break-a-goal-into-pieces, attach-the-world, sessions-read-the-brain, the-proposal-loop,
    teach-it-what-matters, the-brain-survives, return-the-four-on-every-read-surface,
    show-the-four-on-the-goal-screens-that-already-exist, recognizable-published-ta-profile,
    not-yet-shared-filter, concept-count-canonical, summaries-element-count`
  - The story's own guards pass in both: `gate-result-record` 29/0/0; `stack-free-npm-test` 6/0/1 on
    Node 16 (G2's probe needs the global `fetch`) and 7/0/0 on Node 22; `harness-lint` 41/0/0.
  - The Node-16 run matches the implementation's (`20260913T040449Z-80634-2042`) suite for suite. The
    Node-22 run failed 15 suites and 42 tests against the implementation's 16 and 75
    (`20260913T040914Z-14580-57d2`): `store-the-four-when-a-goal-is-captured-or-updated` passed this
    time. The live failures move with the instance's state between two runs of one commit, not with
    this diff. Both records name the clean commit they tested (`d210b5ff`, `dirty: false`) — AC-1
    working on the real registry.
- [ ] `npm run test:playwright` — not applicable; no browser surface changed.
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._

## Spec adherence

- [ ] **Every acceptance criterion has a passing test.** The test plan maps AC-1 to A1–A8, AC-2 to
      B1–B4, AC-3 to C1–C10, AC-4 to D1–D3 (plus the re-aimed G3 and G7), AC-5 to E1–E2 and AC-6 to
      F1–F2, and all 29 pass in both Reviewer runs — but untested AC-2/AC-3 edges fail when probed
      (Blocking 1 and 2).
- [x] **No criterion is silently dropped.** AC-6's full-run clause is not met on this host, and the
      story says so in § Deviations with the evidence; the Verdict records the Reviewer's reading of
      it. Its ledger half is done: rows 103, 105, 111, 157 (both status cells), 227, 235 and 263 read
      DONE, and rows 104, 106 and 192 carry the runner-half note.
- [x] **No behavior added that isn't in the story.** The `{ name, run }` config pseudo-entry and the
      "exports no run() function" failure are logged deviations inside ADR §1/§3's intent. OPEN.md
      rows 280–282 are evidence, not behavior. `d210b5ff` (row 283; rows 75 and 141 flipped) is a
      separate, operator-approved housekeeping commit, outside the story's delivery by design. One
      behavior was removed without a log line — non-blocking 7.
- **Test-deliverable carve-out:** verified. `test/gate-result-record.test.js`,
  `test/helpers/gateFixtures.js` and `test/stack-free-npm-test.test.js` are byte-identical to
  `2c3472f2`; the Phase-4 `test/` diff is confined to the files ADR §1–§6 name.

## ADR adherence

- [ ] **Files match the implementation notes** — §1 `test/helpers/gateRunner.js`; §2
      `test/helpers/gateRecord.js`; §3 `test/registry.js`; §4 thin `test/test.js`; §5
      `test/gate-status.js` + the `gate:status` script; §6 `test/helpers/stackHttp.js` and the nine
      suites; §7 the README section, 20 pointer sites and a CHANGELOG row (L10 clean); §8 the ledger
      — except that §1's "a missing or non-numeric `pass`/`fail` becomes a `returned no result
      counts` FAIL" does not hold for `NaN` (Blocking 2).
- [x] **The registry is the old runner, reordered for nothing.** Its 197 file entries are the old
      `await` sequence exactly (`git show 2c3472f2:test/test.js`), the config pseudo-entry is first,
      nothing is registered twice, all 45 skip notes carry over verbatim, and the four exclusions are
      the ADR's four with its reason (201 files = 197 + 4). Both reviewers derived this independently.
- [x] **Layering.** The engine and the reader share `gateRecord.js`; the nine suites reach the stack
      only through `stackHttp.js`, which passes an argv array to `execFileSync` (the five helpers it
      replaced interpolated into a shell string). Each migrated assertion keeps or strengthens its
      check: no response now fails where it used to read "got 500" or pass (`operational-direction`
      H1), and all eleven refresh call sites add `json.success`, as the logged deviation says.
- [x] **No new dependencies** — Node built-ins only.
- **Unlogged drift:** §1's signature names an `out` parameter that isn't built (nothing uses it); the
  reader's line (`— FAIL, exit 1, 2676 passed, …`) differs from §5's template
  (`— <STATE>: <verdict>, exit <n>, <p>/<f>/<s>, …`); and the ADR's Consequences say in-container
  records are invisible to the host, which the local dev container contradicts (non-blocking 5).

## Concept-graph integrity

- [x] Not applicable — no concept, handle or firmware definition changes (ADR: "Firmware reinstall
      required? No").

## Things tests can't catch

- [x] No secrets in committed files (added lines scanned for `nsec1`, private-key headers, API keys
      and 64-hex literals: none).
- [x] No leftover debug logging; the reader's `console.log` is its output.
- [x] No commented-out code.
- [ ] **Error paths** — untested edges give a result the run did not earn (Blocking 1 and 2).
- [x] Concurrency — overlapping runs keep separate records (A6), and each atomic write uses its own
      record's temp name; co-tenant hazards are non-blocking 2 and 5.
- [x] Security — `stackHttp` never builds a shell string; `gate:status` uses its arguments only to
      filter records.

## House rules check

- [x] Concept Graph API authority respected — not applicable.
- [x] No new lint/typecheck/build tooling.

## Product-guide adherence *(when the story traces to a PRD)*

- Not applicable — no PRD; the book runs on an acceptance frame.

## Findings

### Blocking

1. **`test/test.js:19`; `test/helpers/gateRunner.js:86–91, 105–112, 129–135, 150–152`** — a run can
   still end with exit status 0 and no verdict. The Reviewer reproduced each of the four routes below
   with a two-entry fixture registry.
   - **The engine's own exception.** A record write fails mid-run; the probe deletes the record
     directory during a suite. `runGate` rejects, and the engine's run-wide `unhandledRejection`
     listener (`:86–91`) records the error as a stray and swallows it. `test/test.js:19` has no
     `.catch`, and nothing is left on the event loop, so the process exits 0 with no `Overall:`
     line. The old runner's `main().catch(… process.exit(1))` has no successor.
   - **`process.exit` at module load.** The trap covers only `run()` (`:129–135`), not the load phase
     (`:105–112`), so a suite that calls `process.exit(0)` while loading ends the run with 0. The
     README section says a suite that "calls `process.exit` is that suite's FAIL, never the end of the
     run"; that is untrue for this route.
   - **A deferred `process.exit` from the last suite.** The trap is restored after each suite, so a
     timer the last suite leaves behind fires during the final `setTimeout(0)` (`:152`) and reaches
     the real exit, with 0. In any earlier position the same suite is caught as a stray-error FAIL,
     exit 1. C3 covers only the synchronous call.
   - **A `run()` that never settles and holds no handles.** The event loop drains and the process
     exits 0. The old runner had this one too.

   In every route the record stays honest: `gate:status` reads UNFINISHED, exit 3. But the process
   exit status — what CI and every launcher read — says 0 for a run that produced no verdict. That
   breaks AC-2 ("any exit status it returns is non-zero") and AC-3 ("the final verdict and exit
   status are still produced").

   Asked change:
   - **Tester, per the carve-out:** guards for the first three routes — a fault-injected record
     write, a load-time `process.exit(0)` fixture, and a deferred-exit fixture as the last entry —
     each red today.
   - **Implementer:** make an unsettled run's exit status non-zero, whatever ends it:
     - catch `runGate`'s rejection in `test/test.js` and exit non-zero through the real exit;
     - add a `process.on('exit')` guard that, while the run is unsettled, forces a non-zero code and
       marks the record synchronously;
     - keep `process.exit` trapped from the load phase until the engine's own exit.

     The README claim then holds as written. This stays within ADR §1's intent: every suite
     isolated, and the verdict written before the exit.
2. **`test/helpers/gateRunner.js:48–58`** — a suite reporting a malformed count is recorded as
   passing. `normalize()` only checks `typeof … === 'number'`, and `verdictOf()` fails a suite only
   when `fail > 0`.
   - `{ pass: 1, fail: NaN }` and `{ pass: 1, fail: -1 }` both read PASS, and the run exits 0
     (Reviewer probe through `runGate`). Separately, a string `skipped: "4"` is silently read as 0.
   - The old runner failed both counts: all 371 of its checks were `<x>Result.fail === 0`, feeding
     `process.exit(overallOk ? 0 : 1)`. ADR §1 also makes a non-numeric count a `returned no result
     counts` FAIL.
   - So this is a regression of the gate's strictness, in the check this story exists to make honest
     (AC-3: nothing "invents a result"). It is latent: no registered suite produces such counts
     today.

   Asked change:
   - **Tester:** fixtures returning `fail: NaN`, a negative count and a non-numeric `skipped`, each
     expected to FAIL and red today.
   - **Implementer:** accept only non-negative integers for `pass`, `fail` and a present `skipped`;
     anything else is `returned no result counts`. Keep the old strictness (`fail === 0`) in
     `verdictOf`.

### Non-blocking

1. **Dead imports left by the migration.** `const { execSync: _execSync } = require('child_process')`
   is now unused in `customize-pin-curation-publish`, `tag-detail-curated-view-and-pin-polish-publish`,
   `tl-publication-from-pins-publish` and `tl-publication-from-pins` (0 uses; 1 before), as is
   `const cp = require('child_process')` at `test/firmware-concept-elements-sets.test.js:38` and
   `test/move-nodes-between-sets-ui.test.js:47`. Optional improvement: drop the six lines in the same
   cycle.
2. **`test/helpers/gateRecord.js:52`** — `git status --porcelain` at run start refreshes and writes
   the index under a lock (git's "BACKGROUND REFRESH": "the lock held during the write may conflict
   with other simultaneous processes"), so on a checkout shared with other sessions a concurrent
   `git commit` can fail. Optional improvement: `git --no-optional-locks status --porcelain` — same
   output, no lock.
3. **`test/helpers/gateRunner.js:150–152`** — `current = null` is set before the final
   `setTimeout(0)` whose comment says it exists to catch the last suite's escaped rejection, so that
   rejection is attributed to "the runner". A rejection escaping at the tail of an earlier suite is
   attributed to the next one. The stray entry also never enters `results`, so an
   `Overall: FAIL — … 0 failed` line is possible. Optional improvement: clear `current` after the
   gap, and count the stray entry in the totals.
4. **`test/helpers/gateRunner.js:86–88`** — `strayErrors` is uncapped, and each stray rewrites the
   whole record synchronously, so a leaked interval throwing every few milliseconds slows the gate to
   a crawl. Optional improvement: cap it the way `failures` is capped.
5. **Liveness: `test/helpers/gateRecord.js:66–69`, `test/gate-status.js:47–51`.** A killed run whose
   pid is later reused reads RUNNING (exit 4) indefinitely, and prune never removes it.
   `docker-compose.dev.yml:20` bind-mounts the repo into the local container, so an in-container run
   writes into the host's `tmp/gate-runs/`, with a pid from another namespace. The ADR's
   Consequences (line 215) say such records are invisible to the host; locally they are not. The
   record already stores `host`. Optional improvement: have the reader treat a `running` record from
   another host as running elsewhere, and correct the ADR line at book close.
6. **Record-less windows and reader edges.** A Ctrl-C during prune or the three git calls
   (`gateRunner.js:69`, before the record exists and before any handler is installed) leaves
   `gate:status` showing the previous run, which AC-2 rules out; the window is narrow. In the reader:
   - an unreadable newest record is skipped silently;
   - a parseable file that isn't a record sorts as newest;
   - prune leaves 31 records;
   - an orphaned `.json.tmp` is never pruned.
7. **Removed without a log line.** The old runner printed "H-class: n executed / n skipped" lines for
   the three goal-surface suites and browser-only pointers such as
   `in-app-badged-ta-avatar B-class: browser only — tests/brainstorm/ta-badged-avatar.spec.js`
   (`2c3472f2:test/test.js:1188–1202`). The engine prints neither. Skips are still counted, but the
   executed breakdown and the Playwright pointers are gone. Optional improvement: record it in
   § Deviations, or carry the pointers as registry notes.
8. **ADR §1 and §5 against the build.** The unbuilt `out` parameter and the reader's line format are
   not in the story's § Deviations. Optional improvement: add one line there.
9. **Process.** The implementation's first full run came after the code was written;
   `4-implementation.md` step 1 asks for a baseline run first, which would have surfaced rows 280–282
   before any code changed.

### Harness friction

1. Recorded in the implementation commit, so no new rows:
   - row 280: the host checkout's empty `node_modules`;
   - row 281: the host's default Node 16, on which the full gate is falsely red and silently
     stack-free;
   - row 282: the live suites that are red against this instance once they actually run — 16 in the
     implementation's Node-22 run and 15 in the Reviewer's. This commit adds the re-run to the row.

## Verdict

**CHANGES_REQUESTED**

What stands and needs no change:
- The engine, record, reader, stack-HTTP helper, registry, docs and ledger match ADR §1–§8, apart
  from the edges above.
- The 29 guards pass on both Node versions.
- The Reviewer reads AC-6's full-run clause as met in intent, and accepts the story's recorded
  deviation. Every failing suite in both full runs is outside this diff and fails the same way
  without the engine, and the engine reports each one truthfully. The PR's CI stack-free check,
  which can run only once the branch is pushed, is a required check and must be green before merge.

What has to change:
- A run can still exit 0 without a verdict, by four reproduced routes (Blocking 1). That is the
  exact failure this story set out to end.
- A malformed failure count reads as passing, where the old runner failed it (Blocking 2).
- Both are latent — no registered suite takes any of these routes today — and each fix is small and
  contained.

Kick back to `/implement-feature`. Under the carve-out, the Tester adds the guards first.
