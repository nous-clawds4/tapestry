# Test Plan: Story 5 — The real-time path's switch, on the panel

**Story:** `engineering-team/stories/tagging-edges/5-real-time-path-switch.md`
**ADR:** `engineering-team/decisions/tagging-edges/0005-real-time-path-switch.md` (accepted, `8a082b75`)
**Date:** 2026-10-01
**Review:** `engineering-team/reviews/tagging-edges/5-real-time-path-switch.md`, round 1 (§ Review round 1 below)

## The suites

| Suite | Prefix | What it holds for story 5 |
|---|---|---|
| `test/tagging-edges-realtime-routes.test.js` | RS, RR | The store (version 2 `switch.json`, the history file, read errors against damage, file modes), and the status and switch routes (`inStartWindow`, `onSince`, the widened POST and its answers, the default dependencies) |
| `test/tagging-edges-switch-record.test.js` (new) | SR | The record's pure functions (`switchEntry`, `switchRecord`, `foldHistory`), the POST's write order and failure matrix, the residuals, concurrency, the record GET, `ownerOrAdmin`, no logging of who, and AC-6's static pin |
| `test/tagging-edges-realtime-wrapper.test.js` | RW | Version 2 lines read by the unchanged `run.sh` |
| `test/tagging-edges-wiring.test.js` | SWR | The two mounts on the switch path; the owner-or-admin check existing once; the admin-list default |
| `test/tagging-pipeline-view.test.js` | TV | `pathView`'s starting state, `offPromptVariant`, `turnOnWarning`, `switchRecordView`, `switchOutcome` |
| `test/tagging-pipeline-codes.test.js` | PC | R2-1, R2-11 and R2-13, and the reworded `no-status` |
| `test/tagging-pipeline-fetch.test.js` | TF | `sendSwitch` |
| `test/tagging-pipeline-panel-source.test.js` | PS | Story 4's GET-only pins, revised; the inline prompt, the shared `BackstopVerdict`, no new timer |
| `tests/brainstorm/tagging-pipeline-panel.spec.js` | B | The panel in a browser, against the rebuilt UI |

The new suite is registered in `test/registry.js`, after the routes suite. The browser fixtures are in
`test/helpers/taggingPipelineFixtures.js`.

## Coverage map

### Acceptance criteria

| Criterion | Tests |
|---|---|
| AC-1, the control: one control, "Turn off" or "Turn on", an unreadable switch reading off, nothing until the path status has a body | B51; PS26 |
| AC-1, under way: disabled, says so, `aria-busy` | B52 |
| AC-1, no answer within 15 s: enabled again, outcome unknown, then the next read's state; never retried | B54; TV79; TF22, TF24 |
| AC-1, the warning beside "Turn on": no finished pass, and could not check | B55; TV69 |
| AC-2, the normal prompt, for each of story 4's schedule states; heading, focus on Cancel, one "Turn off" on the page | B56; PS26, PS27 |
| AC-2, the schedule unreadable | B57 |
| AC-2, the schedule list's first read still loading: still being checked, never "could not be checked" (review round 1) | B82 |
| AC-2, the first-start variant, and none of the normal variant's claims | B58; TV68 |
| AC-2, the status unreadable (whether the first start completed is unknown) | B59; TV68 |
| AC-2, Cancel sends nothing; confirming sends one POST and shows off within 10 s | B60, B61 |
| AC-2, the prompt closes by itself on another viewer's off | B62 |
| AC-3, "Turn on" asks nothing and shows on, then starting | B53 |
| AC-3, the window: 60 s from the recorded on, server clock, seen by every viewer and after a reload | RR29; TV64, TV66, TV67; B63, B64 |
| AC-3, a process started before the on does not count | RR29; TV65; B65 |
| AC-3, an "on" while already on does not restart the window | RR29, RR31; SR19; B66 |
| AC-4, owner and admin each turn the path on and off | RR15, RR31; SR14; B61, B53 |
| AC-4, refusals (signed out, neither owner nor admin, cross-site) change and record nothing | RR9–RR14 (shared helper now also refuses record calls), RR10; SR31, SR32, SR33 |
| AC-4, last change wins | SR30; B70 |
| AC-4, refused or failed: the reason, and the state unchanged | TV80, TV81; B67, B68, B69; SR20, SR22; RR17 |
| AC-4, a failed change whose answer has no `body.code`: no data-volume remedy and no claimed state (review round 1) | TV82 |
| AC-4, an off still takes effect when it cannot be recorded | RR16; SR21; B73 |
| AC-5, every change records who and when, from the panel or another way | RR15, RR23, RR31; SR14, SR15, SR17; RW23, RW24 |
| AC-5, the one exception (an unrecorded off) | SR21, SR28; TV72; B73 |
| AC-5, the latest change and the last 10, newest first | SR12, SR13; TV70; B71 |
| AC-5, nothing recorded | SR8; TV73; B72 |
| AC-5, the pre-story-5 change shows as the owner's | SR3, SR18; RS29 |
| AC-5, it lasts | RR32; RS26 |
| AC-5, only an owner or admin may read who | SR31, SR35, SR39, SR40; RR30 |
| AC-6, no pass started, stopped or queued; no schedule changed; follows, mutes and reports untouched | SR14, SR47 |
| AC-6, the panel's reads change nothing; only this control's request is sent | PS13, PS14, PS28; B38, B60 |

### Test tasks and ADR seams

| Item | Tests |
|---|---|
| Server: a failed on (the write fails, the answer is an error, nothing changes) | SR20; RR17 |
| Server: the record and the history, the pre-story-5 change, the empty state | SR2–SR8, SR18; RS29 |
| Server: an off that could not be recorded keeps the earlier history | SR21, SR23 (first half) |
| Server: refused readers of "who" | SR31, SR39 |
| The write order: pre-fold, then switch, then fold; the base is the list the GET showed | SR16, SR17, SR26, SR28, SR29 |
| A read error on the current switch | SR24; RR17; RS30 |
| A history read error, and damage | SR25, SR26; RS27 |
| The residuals the owner accepted at Architecture | SR23 (a), SR27 (b) |
| Concurrency | SR33, SR34 |
| The GET reads the history before the switch | SR36 |
| Per-file read errors on the GET | SR37, SR38 |
| `ownerOrAdmin` | SR41–SR45 |
| The owner-or-admin check exists once; the admin-list default | SWR73, SWR74 |
| The mounts | SWR67 |
| The store: history methods, version 2 text, `EBADSWITCH`, `version`, `readError`, atomicity, scope, synchrony, modes | RS2, RS19, RS21, RS22, RS25–RS31 |
| No test reaches the live state directory | the status and switch bundles' sentinels (RR18–RR22, RR25, RR27–RR30); RR33 |
| `withDeps`' defaults follow an injected `stateDir()` | RR33 |
| No handler logs who | SR46 |
| `sendSwitch` | TF20–TF24 |
| Story 4's pins revised, not deleted | PS13, PS14; B38; TF1 unchanged |
| Browser: no re-read after the panel closes | B79 |
| Browser: the record view's states and its consistency with the status | B74–B78; TV71, TV74–TV77 |

### Carry-forwards (the Tester's)

| Item | Tests | Now |
|---|---|---|
| R2-1: exact entries for `N/A` and `ProtocolError` under both kinds | PC50, PC51 | fail now |
| R2-1: `no-status` points at a bug, not at Neo4j | PC55 | fails now |
| R2-3: confirmed removals as a lower bound when a pass never recorded its end | B80 | fails now |
| R2-6 (added by the Product Owner): the redacted fields, and remedies that no longer name the task log | B81 | fails now |
| R2-10: the held list's 404 restart, overtaken by a failing tick | B50 | pins |
| R2-11: `ERR_` codes read not recognised; `Security.Forbidden` is the Security family | PC52, PC53 | pin |
| R2-12: TV48's title; the two readings in story 4's test plan | TV48 (title only); `4-tagging-pipeline-panel.test-plan.md` | done |
| R2-13: the T12 guard sees shapes it used to miss | PC54 | pins |

## Pins that pass now, by design

These check behaviour that already exists and that story 5 must keep. Each was shown to fail on a wrong build:
- **RW23, RW24.** `run.sh` stays unchanged, and already reads version 2 lines correctly.
- **PC52, PC53.** R2-11's readings, which story 4 shipped and this ADR ratifies.
- **PC54.** R2-13's shape check over today's producers.
- **B50.** R2-10's behaviour, already in place. It fails on a build with the pre-fix `readHeld`.
- **SR47.** AC-6's static half. `realtime.js` imports nothing that schedules, queues, or reaches the graph or relay.
- **RS31's two `writeSwitch` rows.** The 0600 file and 0700 directory already hold for `switch.json`.

## Edge cases covered

- [x] **Two changes at once,** and a refusal arriving while a change is held (SR33, SR34).
- [x] **A full data volume:** a failed on, a failed off and a double failure (SR20–SR22; RR16, RR17).
- [x] **The history file:** missing, damaged, holding only invalid entries, a read error, or a read-error spell
  (SR6–SR9, SR25–SR27; RS27).
- [x] **A hand-edited switch:** no role, `on` contradicting `onSince`, a full pubkey as the key (SR4, SR10, SR40). Since
  review round 1, SR4 also holds an off with no `onSince` and a version 1 record with `role: null`.
- [x] **A version 1 record** at the first story-5 switch, with and without the pre-fold (SR18, SR23).
- [x] **A quick off then on** with the old process still alive (RR29; TV65; B65).
- [x] **A client clock far from the server's.** The view module reads no clock (TV67).
- [x] **A lapsed session** on the POST (B67), and on the record read (TV77, B78).
- [x] **A record read and a status read that disagree** (TV76, B77).
- [x] **An answer after the panel closed** (B79).
- [x] **A failed change whose answer has no `body.code`:** a body-less 404 from an older backend, or a proxy's 502
  with no JSON (TV82, review round 1).
- [x] **The off prompt opened while the schedule list's first read is loading** (B82, review round 1).

## Readings for the owner to ratify at this gate

The writers had to decide these where the ADR leaves room. Each is in its test's message.
- **The status's `onSince` for a version 1 record whose `changedAt` is not ISO is null** (RR2). That follows D4's
  "else null", and ends story 3's pass-through of any string.
- **The public status's members are exactly story 3's, plus `inStartWindow`** (RR30): "the public status gains
  exactly one field".
- **`parseSwitch` returns `version` as parsed,** and nothing for a file without one, never a default of 1 (RS29). D3
  credits only `version === 1` to the owner.
- **A history whose `changes` holds only invalid entries** reads `unrecorded-off`, not `never-switched` (SR7). D3
  keeps `never-switched` for a missing history or an empty array.
- **A valid history entry** is either a recorded one (`on` boolean, ISO `at`, role owner or admin, an 8 lower-case hex
  key), or an unrecorded one (`at`, `role` and `key` all null). Mixed nulls and 64-hex keys are invalid (SR10).
- **No pre-fold on the first change** (SR16). A missing history's stored valid entries are `[]`, which equals the
  base, so D2 step 4 writes nothing.
- **Exact answers.** The POST's 200 answers and the GET's answer are pinned exactly, so an extra member fails (SR14,
  SR35; RR15, RR31). The 500s are pinned by their sentence, `code` and `unlinkCode`. A `code` on the 500 for a read
  error on the current switch is optional, but must be allow-listed if present (SR24).
- **What a refusal may call.** A non-401 refusal may call only the owner and admin lookups; `now()` and `stateDir()`
  count as dependencies (SR32). SR47's dynamic half allows `stateDir` and `now` in an admitted POST (D1, D4).
- **PS13 requires `sendSwitch`'s POST to exist.** It does not merely tolerate it.
- **PS28** forbids any `setTimeout`, `requestAnimationFrame` or `requestIdleCallback`, and any direct `fetch` or XHR,
  in the panel folder. The only timers are the two poll intervals.
- **The view's answers are read shape-free.** `switchRecordView` and `switchOutcome` are read through their string
  values, never by key names. Times may be passed through in any parseable form, and the panel formats them (TV70,
  TV71, TV75).
- **`switchOutcome`'s target is the boolean sent** to `sendSwitch(on)` (TV78–TV81).
- **`turnOnWarning`'s "none"** may be null, undefined or `'none'` (TV69).
- **TF24 pins the 15 000 ms default** by spying on `setTimeout` during the call.
- **B80 accepts several lower-bound wordings,** such as "at least", "or more", "may have", "possibly", "last save" and
  "before it stopped".
- **PC55** also refuses a sentence that sends the reader to Neo4j's log. Only the imperative "check that Neo4j is
  running" is refused, so a sentence saying such a check will not help passes.

## Review round 1

The review (`engineering-team/reviews/tagging-edges/5-real-time-path-switch.md`, CHANGES_REQUESTED at `ee170bf0`)
asked for these tests. "Fails now" means it fails on `ee170bf0` for the missing behaviour, with a message that says
what is expected. "Pins" means the behaviour is already there: the test passes now, and a wrong version built in
scratch fails it.

| Test | Finding it answers | Now |
|---|---|---|
| SR34 | Blocking 1: each case row names its own first status (`status1: 200` or `500`), and the assertion reads it. Nothing derives it from `want1`, in any spelling. SR34 asserts what it did before: the first answer's status and exact body, the second's, the order the writes land, the second's switch record, `switch.json` and the history | passes; `gate-result-record`'s C9 passes again |
| SR4, two rows | Requested 12: a version 2 off with no `onSince`, and a version 1 record with `role: null`, each read as a change not recorded (`{ on, at: null, role: null, key: null }`). These are the two readings story 5 § Deviations logs ("`switchEntry` follows D3 literally") | pins |
| PC55 | Requested 1: it also refuses the false premise that every error the Neo4j driver raises carries a code. The driver's own checks of what it is passed throw code-less `TypeError` and `Error` (ADR 0004 T12, amended at story 5) | fails now: "it says "Every error the Neo4j driver raises carries a code", which is false …" |
| TV82 (new) | Requested 6: a failed change with no `body.code`, a body-less 404 and a 502 with no JSON, for each target, names no data-volume remedy ("free space", "writable"). It claims no state ("unchanged", "still on", "as before", is or was on or off), and says the state shown is from the next read. The handler's coded 500s (`ENOSPC`; `EIO` with `unlinkCode`) keep the remedy for both targets | fails now (the code-less half; the coded half pins) |
| B82 (new) | Requested 5: with the schedule list's first read held open, the off prompt says neither "could not be checked" nor any verdict, and says the backstop is still being checked. The rest of the normal prompt stands. Once the read is released, the prompt already open shows the one entry's verdict (every 6 hours, and its next run), with no "still being checked" or "could not be checked", and nothing is sent | fails now: the prompt says "The backstop could not be checked, because the schedule list could not be read." |

**The pins are not vacuous.** Each was checked in scratch, on a `git archive` of `ee170bf0` with this round's tests:
- SR4's two rows each fail under their own wrong `switchEntry`, and no other SR test catches either:
  - an off's `onSince` compared loosely (`== null`) fails only "off with no onSince" (46 / 1);
  - a version 1 record's role compared loosely (`== null`) fails only "version 1 with a null role" (46 / 1).
- TV82's coded half fails, with TV81, under a `switchOutcome` that gives every failure the code-less sentence.
- SR34's own rows still bite: a failed on that answers 200 fails SR34's third row, with SR20 and SR46.
- The new red tests can pass:
  - A scratch fix that states PC55's premise truly and gives a code-less failure its own sentence per target passes
    PC55 and TV82 (codes 54 / 0, view 82 / 0).
  - A scratch UI that tells `BackstopVerdict` the read is pending passes the whole spec, 86 / 0, B82 included.

**Readings taken in this round:**
- **PC55 refuses only the unqualified claim:** "every", "each" or "any" error, or "all errors", then "driver", then
  "carry" or "carries" a code, within one sentence. When the words before "carries" limit the errors to Neo4j's answer
  or the server's, the claim is true, and passes ("every error the driver builds from Neo4j's answer carries a code").
  So does "every Neo4jError …".
- **TV82 reads "claims a state"** as "unchanged", "still on" or "still off", "as before", "remains", "stays" and the
  like with on or off, or "is" or "was" on or off. "Whether the path is on or off" asks rather than claims, so it
  passes. "The next read" is "next" followed by "read" within one sentence.
- **TV82 does not pin the 400 and 415 sentences.** Their bodies carry no code either, and both sentences would be true
  for them.
- **A code-less failure stays the outcome `failed`** (TV81 already requires it). Its sentence is a sentence of `failed`,
  not a sixth outcome.
- **B82 holds the read for a few seconds,** well inside `readSection`'s 15 s time-out, which would make it a failed
  read. It covers the first read only. A re-read after a failed read is not covered.
- **B82 matches "still being checked" by idea** (`BACKSTOP_CHECKING`): backstop or schedule with "being checked",
  "being read" or "loading", or "checking", "reading" or "loading" before backstop or schedule.

## Test infrastructure

- **Runner:** Node's `test/test.js` (`npm test`). Read a run's result from its record (`npm run gate:status`), never
  from a pipe. The unit and source suites run on host Node 16.17 and on Node 22, with the same results.
- **No live state.** The status and switch bundles inject every store-backed dependency, and the status bundle's are
  sentinels that throw. RR23, RR32 and RR33 run on default dependencies only under a temporary
  `TAGGING_EDGES_STATE_DIR`. `/var/lib/brainstorm` did not exist on the host before or after any run.
- **Firmware:** no precondition. No concept or schema changes.
- **The browser lane** is as story 4's test plan describes ("The browser lane"). Build inside the container into the
  gitignored `tmp/tp-dist`, serve it on `:4174`, and run the spec under Node 22 with Chromium. The page runs in UTC
  with the `en-GB` locale, on `page.clock`. The AC-6 baseline is not re-recorded.

## How to run

```
npm test
```

One suite:

```
node -e "require('./test/tagging-edges-switch-record.test.js').run().then(r=>{console.log(JSON.stringify(r));process.exit(0)})"
```

## Verification

Run on 2026-10-01 against `8a082b75` (the ADR commit) with the failing tests in place. Each suite was run through
`run()` on Node 22.23.3, and the unit suites again on host Node 16.17.0, with the same results.

| Suite | At `8a082b75` | With the tests | Failing |
|---|---|---|---|
| tagging-edges-realtime-routes | 52 / 0 | 41 / 23 | RS2, RS19, RS21, RS22, RS25–RS31, RR2, RR10, RR15–RR17, RR23, RR27, RR29–RR33 |
| tagging-edges-switch-record (new) | — | 1 / 46 | SR1–SR46 (SR47 is a passing pin) |
| tagging-edges-realtime-wrapper | 22 / 0 | 24 / 0 | none (RW23, RW24 are pins) |
| tagging-edges-wiring | 72 / 0 | 71 / 3 | SWR67, SWR73, SWR74 |
| tagging-edges-drift-route (unchanged) | 27 / 0 | 27 / 0 | none |
| tagging-pipeline-view | 63 / 0 | 63 / 18 | TV64–TV81 |
| tagging-pipeline-codes | 48 / 0 | 51 / 3 | PC50, PC51, PC55 (PC52–PC54 are pins) |
| tagging-pipeline-fetch | 19 / 0 | 19 / 5 | TF20–TF24 |
| tagging-pipeline-panel-source | 25 / 0 | 23 / 5 | PS13, PS14, PS26–PS28 |
| tagging-pipeline-panel.spec.js (Chromium, current UI) | 53 / 0 | 53 / 32 | B38 and B51–B81 (B50 is a pin) |

The registry check (`stack-free-npm-test`, G5) passes, with the new suite registered once.

**Every failure is for the missing behaviour.** Each message names the missing export, method or field, an admin
refused where AC-4 admits one, version 1 bytes where version 2 is expected, or "not implemented yet". None is a
`TypeError`, `ReferenceError`, `SyntaxError` or import error.

**No regressions.** Every test that passed at `8a082b75` and fails now is one ADR 0005 revises or extends:
- revised, failing by design: RR10, RR15, RR23 and SWR67;
- extended, gaining version 2 rows: RS2, RS19, RS21, RS22, RR2, RR16, RR17 and RR27;
- revised: PS13, PS14 and B38.

*(Corrected at review round 1, 2026-10-01, blocking 2.)* That list covered the story's suites only, and missed one
regression outside them:
- **What.** `gate-result-record`'s C9 (row 263) refuses, in every test file, a status derived from a body's success
  flag. SR34, added at `b6726818`, derived its first expected status that way, at
  `test/tagging-edges-switch-record.test.js:1350`. So `gate-result-record` went from 34 / 0 to 33 / 1 at `b6726818`,
  and stayed red to `ee170bf0`.
- **When.** No test file matched C9's pattern at `c557177f` or `8a082b75`. From `b6726818` to `ee170bf0`, that one
  line did.
- **Fixed in review round 1.** `gate-result-record` passes 34 / 0 again through `run()`, on Node 22.23.3 and on host
  Node 16.17.0.
- **The full gate after the round.** Run `20261002T030856Z-37748-d97b` on `078aa6c3` was compared suite by suite with
  run `20261002T023413Z-26270-9616` on `c557177f`, from before the story.
  - `gate-result-record` passes 34 in both.
  - The only suites that differ are the story's own, all green and larger, plus the new switch-record suite.
  - The same 12 standing live-stack suites fail in both, with identical counts (story 5 § Evidence, "The gate").

**How the tests were checked.**
- Two independent critics re-ran every unit suite and reviewed the diff: one for coverage, one for right reason and
  brittleness.
- A fix round answered both. A final checker re-ran everything against a `git archive` of `8a082b75`.
- In scratch only, the SR suite was run against a reference implementation of ADR 0005, which passed 45 of 45. A
  30-mutation pass on that implementation was caught every time.

### Review round 1

The round's red phase was confirmed on 2026-10-01, on `ee170bf0` with the round's test edits in the working tree.
Each Node suite was run through `run()` on Node 22.23.3 and on host Node 16.17.0, with the same results on both.

| Suite | With the round's tests | Failing |
|---|---|---|
| tagging-edges-switch-record | 47 / 0 | none (SR34 rewritten; SR4's two new rows pin) |
| gate-result-record | 34 / 0 | none (C9 passes again) |
| tagging-pipeline-codes | 53 / 1 | PC55 |
| tagging-pipeline-view | 81 / 1 | TV82 |
| tagging-pipeline-panel-source, tagging-pipeline-fetch, stack-free-npm-test (unchanged) | 28 / 0, 24 / 0, 7 / 0 | none |
| tagging-pipeline-panel.spec.js (Chromium, the UI at `ee170bf0`) | 85 / 1 | B82 |

- **No file matches C9's pattern** but C9's own: `grep -nE "\?\s*200\s*:\s*500\b" test/*.test.js` finds only
  `gate-result-record.test.js:415`, the guard's own message, a file C9 skips.
- **The browser run.** The UI was built inside the container from a `git archive` of `ee170bf0`, copied to a private
  directory there, so no edit in progress in the shared checkout could enter the build. It was served on
  `127.0.0.1:4179`, and the whole spec ran as § Test infrastructure says: 85 passed, and B82 failed for the reason
  above. Then the server was stopped, and the build and its copy were deleted.
