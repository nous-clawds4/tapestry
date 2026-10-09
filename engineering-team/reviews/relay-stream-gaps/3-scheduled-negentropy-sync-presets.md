# Review: Story 3 — Saved negentropy-sync presets, run on a schedule

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-09
**Diff:** `git diff efe611d5..ffda8152` (impl, commit `ffda8152`), plus the Tester's commits `11308d1f`
(suite and test plan) and `efe611d5` (ADR Amendment 1 and T10). The impl commit touches nothing
under `test/`.
**Story:** `engineering-team/stories/relay-stream-gaps/3-scheduled-negentropy-sync-presets.md`
**ADR:** `engineering-team/decisions/relay-stream-gaps/0003-negentropy-sync-presets.md` (Accepted, with Amendment 1)
**Test plan:** `engineering-team/stories/relay-stream-gaps/3-scheduled-negentropy-sync-presets.test-plan.md`

## Quality gates (run by reviewer, not trusted)

- [x] `npm test`: **FAIL, the baseline's red only.** `npm run gate:status -- --label rsg3-review`:
      `20261009T185907Z-29733-9632 [rsg3-review] started 2026-10-09T18:59:07.535Z on ffda8152 — FAIL, exit 1, 5385 passed, 72 failed, 591 skipped, 289/289 suites; failed: stamped-composite-avatar, my-assistant-page, one-writer-assistant-profile, assistant-profile-check, assistant-profile-checklist-page, assistant-stamped-avatar-for-everyone`.
  - Per-suite comparison of the run records against the Tester's baseline
    `20261009T170703Z-6216-e15d` (on `9a07e8e6`): the only difference is `negentropy-sync-presets`
    (absent → PASS 72/0/0).
  - The six failing suites have identical counts in both runs. They belong to another book:
    `stamped-composite-avatar` 8/5/2, `my-assistant-page` 28/3/0, `one-writer-assistant-profile`
    16/1/0, `assistant-profile-check` 3/30/0, `assistant-profile-checklist-page` 0/14/0,
    `assistant-stamped-avatar-for-everyone` 0/19/0. No stray errors.
  - Totals and every suite match the Implementer's run `20261009T185127Z-2475-07b7`.
  - Standalone, `node test/negentropy-sync-presets.test.js` three times: 72 passed, 0 failed,
    each in about 4.3 s, so the time-dilated tests are stable.
- [x] **UI build** (Implementer question 6): `vite build` exit 0, built in 45.7 s, with only the
      usual chunk-size warning. This checkout has no `ui/node_modules`, so I built a
      `git archive HEAD ui src/lib` export in scratch after `npm ci --ignore-scripts`. The bundle
      carries "Save as preset", `Scheduled preset "${…}" is syncing…` and `suggestedIntervalHours`.
      The TypeScript parser also reports 0 diagnostics on both edited JSX files.
- [x] `bash scripts/harness-lint.sh`: clean (0 violations). `git diff --check`: clean.
- [ ] `npm run test:playwright`: not applicable. The UI is pinned at source level, and there is
      no stack in this session.
- [ ] _Lint not configured; skipped._ _Typecheck not configured; skipped._ _Build: no server build step._

### strfry 1.1.0's sync output, checked in source and live (Implementer question 4)

- **Source.** Each of the three line types reports one batch, not a running total:
  - `cmd_sync.cpp:292` logs `UP:` once per upload batch (up to 100 in flight, refilled at 50 or
    fewer).
  - `:303` logs `DOWN:` once per request batch of up to 50 ids.
  - `WriterPipeline.h:190` logs `Writer: added:` once per flush. `written` is a local reset on
    every loop; the running totals are the separate `total*` counters.
  - The reconcile line (`:230`) prints once.
- **Live probe.** Patched strfry 1.1.0, an upstream store on `:7811` and a local DB:
  - Down, 130 needed: `DOWN: 50 / 50 / 30`, then `Writer: added: 130`. `parseSyncOutput` →
    `{ ok: true, need: 130, down: 130, added: 130 }`. The local store holds 130.
  - Up, 250 local-only: `UP: 100 / 50 / 50 / 50`, and upstream gained exactly 250. Parsed as
    `{ ok: true, have: 250, up: 250 }`.
  - So summing is right.
- **A relay with negentropy off** (`relay.negentropy.enabled = false`, `:7813`): strfry prints
  `WARN| Unexpected message from relay: ["NOTICE","ERROR: bad msg: negentropy disabled"]` and then
  waits forever (killed by a 20 s `timeout`, exit 124). See non-blocking finding 1.

### Scheduler wiring: registry → scheduler → launcher

- **Amendment 1 reaches the launcher.** The 6-hour timeout takes this path:
  - `scheduler.js:87` reads the task's own 21,600,000 ms through `resolveTaskTimeout`
    (`taskTimeout.js:41–52`) and puts it in the job data.
  - `processor.js:118–124` passes it as invocation options.
  - `launchChildTask.sh:196–211` deep-merges global → task → invocation: duration 6 h,
    `forceKill: true` from the task entry. It is enforced at `:369–403`.
- **A second fire is never doubled.**
  - While the script runs, `launchChildTask.sh`'s already-running guard (`pgrep` on
    `script_relative_path`) applies `options_default`'s `withoutError` policy
    (`killPreexisting: false, launchNew: false`) and refuses the new launch.
  - If the script has died (curl timeout or kill) while the server's run carries on, the
    server's 409 path covers it. Both cases exit 0.
- **Queue.** `queue/index.js:104` creates a queue for every registry task, so the new task
  needs no other wiring.
- **Offered in the Add dialog.** `filterSchedulableTasks` offers it (non-continuous) with the
  hint, and the dialog pre-fills 0 d / 6 h / 0 m.
- **Port.** The script's `${CONTROL_PANEL_PORT:-7778}` matches the panel's bind
  (`bin/control-panel.js:113`).
- **Long requests.** The loopback request skips nginx, and the panel sets no `server.timeout`
  (Node's default is 0), so a long `/run` isn't cut off server-side.

## Spec adherence

- [x] **AC-1** (save, list, manage):
  - Handlers: P2–P12, plus V3–V5 and V10.
  - Source checks: U1, U3, U4, D1–D3.
  - Presets live in `/var/lib/brainstorm/negentropy-presets.json`, on the `tapestry-data` volume
    (`docker-compose.yml:33`).
- [x] **AC-2** (no runaway presets):
  - V1, V2 and V6–V9; the floor message travels in P5's 400.
  - The tab shows it inline (U2), and the Save button stays disabled until the floor is met.
- [x] **AC-3** (the scheduled task):
  - The run: R1, R2, R6–R9, R12.
  - The task: T1–T10, including T10 for Amendment 1.
  - "Not started twice" holds at both layers (see Scheduler wiring).
- [x] **AC-4** (results visible; one failure doesn't stop the others):
  - Covered: R3–R5, R10, R11, O1–O8 and U5. The unreachable relay is O5/R5 and a hung strfry
    is R11.
  - Not covered: AC-4's other named example, a relay without negentropy. It fails, is
    isolated and is shown, but its reason reads as a 10-minute timeout (finding 1). The test
    plan deferred this case explicitly (§ Edge cases).
- [ ] **AC-5** (verified on staging): a post-deploy manual check (test plan § AC-5). Not a
      blocker. When doing it, judge success by the preset's last-run line. Scheduled Tasks
      history reads "success" even for a failed run (finding 2), so step 5's "history shows a
      successful run" proves nothing on its own.
- [x] No criterion silently dropped.
- [x] No behavior beyond the story. The extras are the Deviations, all within the ADR (below).

## ADR adherence

- [x] **Files.** The changed files are exactly the Implementation notes' list, plus
  `routerConfig.js` exporting `requireOwnerOrLocal` (test plan choice 1). `negentropyPresets.js`
  defines no gate of its own and holds the default-path literal and `NEGENTROPY_PRESETS_PATH`
  (choice 18).
- [x] **Layering.**
  - strfry is reached only through `negentropySync.js`'s `isSyncActive` / `runStrfrySync`, so
    there is one slot.
  - The read-modify-write lock is never held across a sync (`withPresetsLock` wraps only the
    record step, `:238–247`).
  - Routes are registered next to the one-shot's (`src/api/index.js:474–476`).
- [x] **Amendment 1.** The registry entry carries
  `options.completion.failure.timeout = { duration: 21600000, forceKill: true }` in `syncWoT`'s
  shape. It is verified end to end above.
- [x] **No new dependencies or tooling.** No `package.json` change. The script uses bash, curl
  and `node -e`, with no `jq`.
- [x] **Deviations reviewed; each is within the ADR's intent:**
  - `{ exitCode, output, timedOut }` and `presetName`: additive.
  - `/status` naming the preset: the ADR put `source`/`presetName` on the slot; this exposes them.
  - Skips not counted in `failed`: a skip isn't a failure, and the test plan left it open.
  - Create honoring `enabled: true`: the ADR lists `enabled?`, and the UI never sends it.
  - A corrupt file is never overwritten: right under BIBLE §30.
  - No `lastSuccessAt` for a preset re-targeted mid-run: the ADR's own changed-target rule.
  - Unknown-id 404, empty arrays counted as absent, hex case: all open in the test plan, or
    worded by the ADR.
  - Summing: verified above.
  - Log file: it matches `monitoring.logFiles`.
  - Compact seed: a workaround for BK1 (finding 6).

## Implementer's questions

1. **Auth parity: equivalent in effect, but no defense in depth.** The middleware and the
   handler together already produce the right answers:
   - An anonymous POST gets 401 from default-deny (`auth.js:492–494`).
   - A signed-in non-owner passes the middleware (the path isn't in `auth.js:388–430`), then
     gets 403 from `requireOwnerOrLocal` before any write (P11).
   - Loopback is `localTrusted` (`auth.js:361–364`).

   The router's POSTs are gated in both places ("handlers also gate"); the presets' only in the
   handler. Finding 4.
2. **Public list: acceptable.** The list is actually readable **without** signing in: an
   unauthenticated GET falls through to "Public read-only API access" (`auth.js:511–512`). That
   is the same posture as `/negentropy-sync/status` and `GET /api/strfry/router-config`, which
   carry the same kind of data (relay URLs, filters). The ADR's "signed-in" is inaccurate.
   Finding 5.
3. **BK1: confirmed.** 45 characters of headroom remain (finding 6). It's an OPEN.md row
   candidate; I did not edit OPEN.md.
4. **Summing: right.** Verified in source and live (above).
5. **UI awareness gap: confirmed, non-blocking.** Finding 7.
6. **JSX: sound.** `vite build` passes on the committed tree, and every identifier the new JSX
   uses resolves in scope:
   - imports: `useCallback`, `tagFiltersFromFilter`;
   - module-level helpers: `ToggleSwitch`, `DIR_LABELS`, `KIND_PRESETS`, `isValidRelay`;
   - component state and setters.

## Concept-graph integrity

- [x] No concepts change. No handles, no firmware reinstall (ADR: "No").
- [x] N/A: no new code reads domain concepts. Presets are generic tooling, and a `#z` value is
  just a string (V2).

## Things tests can't catch

- [x] **No secrets.** No TA-pubkey literals: no 64-hex string in the added lines, and the
  `LEGACY_*` constants are untouched. No commented-out code.
- [x] **No debug output.** The new `console.log` lines are operational, in the module's
  existing `[negentropy-sync]` style. The `node -e` ones are the script's verdict channel.
- [x] **Concurrency.**
  - Check-and-take of the slot is one synchronous step: `isSyncActive()` is followed in the same
    tick by `runStrfrySync`'s executor setting `activeSync`, and the one-shot handlers check and
    set synchronously too.
  - `runInProgress` is set before the first `await`.
  - `release()` frees the slot only if it still owns it.
  - Delete and toggle answer during a run (R10).
  - A queued preset is still synced after a delete or switch-off (finding 3).
- [x] **Atomic write.** A temp file `<path>.<pid>.tmp` in the same directory, renamed onto the
  final path, inside the lock. It is never written in place (P10).
- [x] **Task script.**
  - No `-f`, so the 409 body is read.
  - `-w '\n%{http_code}'` splits status from body, and `000` (panel down or curl timeout) →
    exit 1.
  - Non-2xx, empty or non-JSON → exit 1. `failed > 0` → exit 1. 409 `alreadyRunning` → WARN,
    exit 0.
  - `TASK_END` is emitted on every path through `finish`.
  - `source /etc/brainstorm.conf 2>/dev/null || true` and the structured-logging fallback follow
    `refreshApplicabilityLists.sh`.
- [x] **10-minute kill.** The timer runs from spawn; the slot wait before it is separate, so one
  preset takes at most about 20 minutes. On kill, `close` resolves with code `null`, and the
  `timedOut` message replaces the generic "exited with code null".
- [x] **Security.**
  - strfry is spawned with an argv array (no shell).
  - The relay passes `relayUrlProblem` (it can't start with `-`), and the direction is from a
    fixed list.
  - The filter is one JSON argv element.
  - Every POST is gated before validation or writes.

## House rules check

- [x] Concept Graph API authority respected (N/A).
- [x] No new lint, typecheck or build tooling.
- [x] Architecture invariants:
  - Presets are this instance's own operator tooling.
  - `strfry sync` accepts whatever matches, through the existing write policy; nothing gates
    events at write time.
  - The presets file is local state that is never discarded or overwritten when unreadable
    (BIBLE §30).

## Findings

### Blocking

None.

### Non-blocking

1. **`src/api/strfry/negentropyPresets.js:151,226`: a relay without negentropy costs 10 minutes
   per run and is reported only as a timeout.**
   - The evidence is the probe above.
   - strfry 1.1.0 logs the relay's NOTICE as a WARN and waits forever. So every scheduled run
     holds the single slot for the full 10 minutes (`negentropySync.js:287–290`), and manual
     Starts are refused meanwhile.
   - The run is then recorded as `strfry sync did not finish within 10 minutes and was stopped`.
     The real reason, `ERROR: bad msg: negentropy disabled`, is in the output, but:
     - the match rule doesn't catch it (`/error/` is case-sensitive, and the line is `WARN|`, not
       `ERR|`);
     - the timeout text would replace it anyway (`:226`);
     - nothing keeps it: `lastRun` stores no output tail, and the log line at `:235` carries only
       the summary.
   - AC-4 names this case ("the relay doesn't support negentropy").
   - Why this isn't blocking:
     - the failure is shown and isolated, which is AC-4's core;
     - the match rule is ADR 0003's, and test plan choice 7 pins lowercase `error` / `ERR|`;
     - the test plan's Edge cases deferred exactly this case to staging.

     Changing it means changing a pinned rule, so it's a follow-up through the Architect and
     Tester, not an Implementer patch.
   - Suggested:
     - treat `Unexpected message from relay: ["NOTICE"…` (and `["CLOSED"…`) as the error line;
     - let it join the timeout text, e.g.
       `relay said "ERROR: bad msg: negentropy disabled"; stopped after 10 minutes`;
     - optionally keep the last few output lines in `lastRun`.
   - Candidate OPEN.md row, or a story 4 in this epic.
2. **`src/api/scheduled-tasks/index.js:210`: the Scheduled Tasks history never shows this task,
   or any script task, as failed.** This predates the story.
   - `groupEventsIntoSessions` reads `rec.failure`, but `emit_task_event` nests the script's
     metadata under `metadata` (`src/utils/structuredLogging.sh:227`).
   - Verified: a real `TASK_START` / `TASK_END {"failure":true}` emitted through
     `structuredLogging.sh`, then fed to `groupEventsIntoSessions`, gives `status: "success"`. The
     panel shows ❌ only for `'failed'` (`RelaySettings.jsx:1984`).
   - The R4 fixture in `test/scheduled-tasks-with-arguments.test.js` puts `failure` at the top
     level, which is why that suite passes.
   - This story's script does its part (T4: exit 1, `TASK_END` with `failure: true`), as
     `refreshApplicabilityLists.sh` does.
   - But ADR 0003:140 ("The task fails in the panel's history when any preset failed") doesn't
     hold on the panel, and the test plan's AC-5 step 5 (`…test-plan.md:101`) can't tell success
     from failure.
   - Candidate OPEN.md row (bug).
3. **`src/api/strfry/negentropyPresets.js:264–268`: a queued preset still syncs after it is
   deleted or switched off mid-run.**
   - The run snapshots the switched-on presets, and `runPreset` never re-reads them.
   - A preset deleted or switched off while earlier presets sync, or while it waits up to
     10 minutes for the slot, still runs when its turn comes. For `up`/`both`, that is an
     upload the owner just tried to stop. Only its record is dropped (`:241`).
   - This matches the ADR ("It snapshots the switched-on presets"). Toggle-mid-run was left
     unpinned (test plan § Edge cases).
   - Optional: re-read the stored preset just before `syncInSlot`, and skip it if it is gone or
     switched off.
   - Related and harmless: a preset re-saved with another target mid-run gets the old target's
     `lastRun` (`:242`).
4. **`src/middleware/auth.js:388–430`: the presets' POSTs are gated only in the handler.** The
   effect is the same as the router's two-layer gate (question 1).
   - Optional: add `'/strfry/negentropy-presets'` to `ownerOnlyEndpoints`. That check is
     POST-only, so the list stays readable.
   - Cosmetic: the reused 403 says "Changing the relay router requires owner authentication"
     (`routerConfig.js:28`). The test plan accepted that.
5. **ADR 0003:38–39 and :212–213: "signed-in" should be "anyone".**
   - Unauthenticated GETs pass (`auth.js:511–512`), so presets are listed to anyone who can
     reach the API. That includes relay URLs, filters and last-run errors.
   - That is the same posture as `GET /api/strfry/router-config` and `/negentropy-sync/status`,
     so it is acceptable.
   - One caveat applies to both: a relay URL with a token in its query string is exposed.
   - Optional: correct the ADR wording at book close.
6. **`test/applicability-republish.test.js:177`: BK1 has 45 characters left.**
   - It matches `freshInstallEntries` with `[\s\S]{0,1800}?`, and the span is now 1,755
     characters by my count (the Deviations say 1,757).
   - The next seed, in any form, breaks BK1 with a misleading "must define freshInstallEntries".
   - It is not this story's defect; the compact two-line seed works around it.
   - Candidate OPEN.md row (test fragility): anchor the match on the function's `return [` …
     `];` rather than a character count.
7. **`ui/src/pages/settings/RelaySettings.jsx:942–956,967–986`: the tab follows only a scheduled
   run it saw on opening** (question 5).
   - A run that starts later goes unnoticed. Start then gets the stream's 409
     (`negentropySync.js:153–155`), which `EventSource` can't read, so the output clears and the
     button flips back with no message.
   - That is pre-existing for colliding manual syncs, but scheduled runs make it likelier: each
     preset can hold the slot up to 20 minutes.
   - A poll that lands in the few milliseconds between two presets also ends the follow.
   - Optional: GET `/status` before opening the stream, and say "A sync is already in progress".
8. **`ui/src/pages/settings/scheduledTasks/AddOrEditEntryModal.jsx:62–66`: the pre-filled
   interval sticks.** Picking the presets task and then another task leaves 6 h instead of
   24 h. Trivial.

### Harness friction

1. Recurrence of OPEN.md row 316. The role and workflow 5 say the Reviewer commits; this brief
   reserved the commit. I followed the brief: the review and the status flip are uncommitted.
2. This checkout has no `ui/node_modules`, so the Implementer could only transpile the JSX.
   Exporting with `git archive HEAD ui src/lib` to scratch, then `npm ci --ignore-scripts` and
   `npx vite build`, took about a minute and leaves the tree untouched. Candidate `meta` row:
   name that fallback in the Implementer and Reviewer guidance for UI changes.

## Verdict
**PASS**

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place, and this review linked in its Linked
      artifacts. Left uncommitted, per the brief.
- [x] Completion detection performed; the result is reported in the hand-off, not here.

## Round 2

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-09
**Diff:** `git diff abd62917..a6597121`, the implementation commit `a6597121`. It touches
`src/api/strfry/negentropySync.js`, `src/api/strfry/negentropyPresets.js` and the story's
Deviations, and nothing under `test/`.
- It rests on ADR 0003 Amendment 2 (`4b90d70d`, approved by the owner) and the Tester's 23 new
  tests (`abd62917`).
- This round fixes round-1 findings 1 and 3. The other six are covered in the table below.

### Quality gates (run by reviewer, not trusted)

- [x] `npm test`: **FAIL, the baseline's red only.** `npm run gate:status -- --label rsg3-review-r2`:
      `20261009T203009Z-5726-d2a7 [rsg3-review-r2] started 2026-10-09T20:30:09.342Z on a6597121 — FAIL, exit 1, 5408 passed, 72 failed, 591 skipped, 289/289 suites; failed: stamped-composite-avatar, my-assistant-page, one-writer-assistant-profile, assistant-profile-check, assistant-profile-checklist-page, assistant-stamped-avatar-for-everyone`.
  - The record shows a clean tree on `a6597121` (`dirty: false`) and no stray errors.
  - **Per-suite comparison** with round 1's run `20261009T185907Z-29733-9632` (on `ffda8152`):
    the only difference is `negentropy-sync-presets`, PASS 72/0/0 → PASS 95/0/0.
  - The six failing suites have the same counts as in round 1: 8/5/2, 28/3/0, 16/1/0, 3/30/0,
    0/14/0 and 0/19/0. They belong to another book.
  - Every suite also matches the Implementer's run `20261009T201509Z-18922-9c3f`. That run was
    recorded on `abd62917` with the implementation uncommitted (`dirty: true`, 2 files).
- [x] **The neighbouring suites that load these modules are unchanged from round 1.**
  - `negentropy-sync-input` 5/0/0, `router-stream-tag-filters` 21/0/0 and
    `sync-panel-tag-filters` 20/0/0 all pass, and each exits 0 when run directly.
  - `nip51-list-export-from-pins` skips 0/0/8 for want of a stack, as in round 1.
- [x] **Flakiness.** The suite has dilated timers, so I ran it repeatedly. Every run gave
      95 passed, 0 failed:
  - 5 of 5 standalone runs, in sequence, each in about 9.5 s;
  - 6 of 6 copies run at once with four CPU burners on a 4-core sandbox.
- [x] **The Tester's red claim holds.** I ran the suite against a `git archive abd62917` export:
  - 76 passed, 19 failed;
  - the 19 failures are exactly M1–M4, O9–O12, O14, N4–N6, N8 and R13–R18;
  - the four guards O13, N7, R19 and G4 pass.
- [x] `bash scripts/harness-lint.sh`: clean (0 violations).
- [x] `git diff --check 59adeaab..a6597121`: clean. The added lines carry no debug output, no
      TODOs and no 64-hex literals.
- [ ] `npm run test:playwright`: not applicable (no UI change this round).

### Live check against real strfry (reviewer's sandbox, not committed)

- **Setup.** Patched strfry 1.1.0, with the same Redis patch as `patches/strfry-redis/`, and no
  Redis in the sandbox.
- **Relays:**
  - an upstream strfry relay with 130 kind-1 events (`:7821`);
  - a strfry relay with `relay.negentropy.enabled = false` (`:7825`);
  - the Architect's fake relays: NOTICE then proxy, silent, NOTICE then close, CLOSED.
- **What the probes run.** They call the committed `runStrfrySync` and `parseSyncOutput`, which
  spawn `strfry` through `buildCommand`, as the panel does.

| Relay | Options | Result | `error` |
|---|---|---|---|
| negentropy off (`:7825`) | `stallMs: 5000` | stopped at 5.1 s, exit `null`, `stalled: true`, slot freed | `relay said "ERROR: bad msg: negentropy disabled"; nothing followed for 60 s, so strfry sync was stopped` |
| NOTICE on connect, then a normal relay | `stallMs: 5000` | exit 0 at 0.17 s, not stalled | none; `ok`, need 130, down 130, added 130 |
| NOTICE, then the relay closes | `stallMs: 5000` | exit 1 at 1.09 s | `relay said "ERROR: bad msg: negentropy disabled"` |
| CLOSED `auth-required` | `stallMs: 5000` | stopped at 5.1 s, `stalled: true` | `relay said "auth-required: sign in to sync"; nothing followed for 60 s, …` |
| ignores NEG-OPEN | `timeoutMs: 8000` | killed at 8.0 s, `timedOut: true` | `Redis error: Connection refused; strfry sync did not finish within 10 minutes and was stopped` (R2-2) |
| negentropy off, no `stallMs` | `timeoutMs: 8000` | killed at 8.0 s, `timedOut: true`, not stalled | `relay said "…negentropy disabled"; strfry sync did not finish within 10 minutes …` |

- **SIGTERM ends strfry.** No `strfry sync` process was left after the six cases.
- **The runner (`runEnabledPresets`), with the real 60-s `RELAY_STALL_MS`.** Four presets ran in
  name order. Ten seconds in, the probe rewrote the file by rename, as `saveStore` does. It
  switched `b-withdrawn` (an `up` preset) off. It re-saved `c-resaved` from the CLOSED relay to
  `:7821`, with another filter and name case, and cleared its `lastSuccessAt`.
  - `a-noneg` stopped at **60.1 s**, not 10 minutes. Its error is the table's first row, and
    its `lastSuccessAt` is kept.
  - `b-withdrawn` had no strfry run, and the withdrawal line was logged. Its stored record is
    unchanged, and it is absent from `results`.
  - `C-Resaved` ran against `:7821` with kinds `[1]` and `since` = its turn's start − 7 days, and
    added 130. `lastSuccessAt` was set, and the result carries the re-read name.
  - `d-good` ran normally. Result: `failed: 1`.

### Round-1 finding 1: a relay without negentropy. Resolved.

- **The stall rule** (`negentropySync.js:310–340`) matches Amendment 2, item 1:
  - **Opt-in.** `if (!stallMs) return` (`:328`) comes after `output`/`slot.lines` are updated as
    before. Without `stallMs` nothing changes except the additive `stalled: false` (N7, G4).
  - **Whole lines, per stream.** `partial[stream]` keeps the unfinished tail (`:298`, `:329–331`).
    N8 covers a notice split across two chunks.
  - **Start, cancel, no restart.** A relay line starts the timer only when none is running
    (`:315`), so repeated notices can't push the stop back (N6). Any other non-blank line
    cancels it (`:312–314`, N5).
  - **One SIGTERM.** The stall callback clears the 10-minute timer (`:318`), and the 10-minute
    callback clears the stall timer (`:338`). Clearing a Node timer inside another timer's
    callback removes it even when both are due in the same tick. `onLine` ignores every line
    once either stop has fired (`:311`). N4 counts one kill past `timeoutMs`, and the live
    probe left no process behind.
  - **Initialization order.** The stall callback reads `timeout`, which is declared at `:336`.
    That is safe: data events arrive only after the executor has finished.
  - **The SIGTERM-ignored case.** A strfry that ignored SIGTERM after a stall stop would have no
    backstop, because the 10-minute timer is cleared. That matches the 10-minute stop, which
    never had a second kill either. strfry 1.1.0 dies on SIGTERM (live, and
    `Loguru caught a signal: SIGTERM`).
- **`relayMessageOf`** (`:257–267`) matches item 1 and choice 20:
  - **NOTICE and CLOSED.** Element 1 or element 2 (`:264`). Every other array gives `null`
    (`:263`), including AUTH and COUNT (M2).
  - **Cap.** 300 characters plus `…` (`:266`, M3).
  - **Fallback.** The raw text after the mark (`:265`, M4).
  - **The non-array deviation is harmless.** strfry prints `msg` as reserialized tao JSON
    (`cmd_sync.cpp:261`). A non-array message would throw at `msg.at(0)` first and log
    `ERR| Error processing websocket message` instead. So the branch can't be reached from
    strfry 1.1.0, and returning the raw text is the sensible reading of "doesn't parse".
- **`parseSyncOutput`** (`negentropyPresets.js:135–175`):
  - **Candidates.** Relay lines are candidates in the `relay said "<text>"` form, ahead of the
    lowercase-`error`/`ERR|` test, so a notice holding `error` takes the relay form (O14).
  - **The table is exact.** It is at `:159–173` (O9–O12).
  - **The runner no longer overrides it.** It passes `stalled`/`timedOut` as the third argument
    (`:267`), and the old `:226` override is gone.
  - **`ok` and the counts** are computed as before (O13), with the caveat in R2-1.
- **The one-shot paths are untouched.** The diff has no hunk in `handleNegentropySync` or
  `handleNegentropySyncStream`. `runStrfrySync` has no other caller (grep), and G1 and G4 pass.
- **AC-4's named case is now met in substance.** "The relay doesn't support negentropy" is
  recorded in the relay's own words, after about a minute (live, 60.1 s).

### Round-1 finding 3: a preset switched off or deleted mid-run. Resolved.

- **The re-read is in the same synchronous step as the slot take.**
  - `syncInSlot` (`:237–246`) runs `storedSwitchedOn(id)`, a synchronous `loadStore`, then
    `isSyncActive()`, then `start(current)`.
  - `start` calls `runStrfrySync`, whose Promise executor checks and sets `activeSync` before
    returning.
  - Nothing can run in between. The re-read happens on every poll, and withdrawal is checked
    before the deadline, so a preset withdrawn as its wait runs out is withdrawn, not skipped.
- **Withdrawn** (`:241`, `:260–263`, `:310–313`):
  - nothing is written;
  - `runPreset` returns `null`, so the preset is out of `results` and not in `failed`;
  - the ADR's log line is printed with the `JSON.stringify`-quoted snapshot name.

  R14–R16 cover this, and so does the live probe.
- **Re-saved** (`:255–259`, `:286`, `:293`):
  - `ran` and `since` come from the re-read record;
  - the argv comes from `current`;
  - `sameTarget(stored, ran)` decides `lastSuccessAt`;
  - the result's `name` is `ran.name`.

  R17 covers this, and so does the live probe.
- **An unreadable store fails closed, during polls too. This is right.**
  - `storedSwitchedOn` wraps the error (`:220–229`). The throw rejects `syncInSlot`, and
    `runPreset`'s existing catch (`:269–271`) records `Could not read the presets: …`, counted
    in `failed`.
  - The record step's `loadStore` then throws inside the lock and is only logged, so the file
    is never overwritten.
  - Applying this to the polls isn't an extension beyond the ADR. Item 1 puts a re-read at
    every poll, and item 4 says what a throwing re-read does.
  - Ending the wait at once, rather than polling on, is the fail-closed choice for an `up`
    preset. The next scheduled run retries.
  - A missing file (`ENOENT`) reads as no presets, so every preset is withdrawn. That is also
    right: nothing the owner switched on remains.
- **Deviation 3 (a skipped preset records the snapshot) is accepted.**
  - Only `lastRun.since` and the result's `name` differ from the last re-read, and only if the
    preset was re-saved during the wait.
  - `windowSince` reads only `lastSuccessAt` (`:118–121`), and the tab never shows
    `lastRun.since` (`RelaySettings.jsx:1509–1520`).
  - A same-name re-save can change the name only in letter case.

### Spec / ADR adherence (changes since round 1)

- [x] The code matches Amendment 2's file list exactly, and nothing else changed. There is no
      UI, route, registry, script or doc change. The BIBLE rows (`BIBLE.md:534–538`) and
      CONFIGURATION.md (`:174`) make no timing claim the stall rule contradicts.
- [x] Test plan choices 4–7, 20 and 21 are followed (above). There are no new dependencies.
- [x] Story Deviations, round 2: all three lines are accurate against the code and within the
      amendment's intent.
- [x] The concept graph is not touched, so no firmware reinstall is needed. There are no
      secrets and no TA-pubkey literal, and the `LEGACY_*` constants are untouched.

### Round-1 non-blocking items

| # | Item | Status |
|---|---|---|
| 1 | A relay without negentropy costs 10 minutes and is reported as a timeout | **Resolved** (above) |
| 2 | Scheduled Tasks history never shows a script task failed | Open: ledger `2026-10-09-task-history-misses-script-failures`. It still matters for AC-5 step 5: judge the staging check by the preset's last-run line |
| 3 | A queued preset syncs after a switch-off or delete | **Resolved** (above) |
| 4 | Presets' POSTs gated only in the handler | Unchanged, optional. I found no row |
| 5 | ADR "signed-in" should be "anyone" | Unchanged. Correct it at book close. I found no row |
| 6 | BK1 has 45 characters left | Open: ledger `2026-10-09-bk1-seed-match-char-window` |
| 7 | The tab follows only a scheduled run it saw on opening | Unchanged, optional. Less likely now that a refused relay holds the slot about a minute. I found no row |
| 8 | The pre-filled interval sticks | Unchanged, trivial |

### Findings (round 2)

#### Blocking

None.

#### Non-blocking

1. **R2-1. The relay's text is now decoded, but it isn't cleaned, and relay lines still feed
   the counts.**
   - **(a) A relay can write lines into the panel log.** `relayMessageOf` JSON-decodes the
     relay's text (`negentropySync.js:262–265`), so a `\n` or a terminal escape in a NOTICE
     becomes a raw character in `error`.
     - `negentropyPresets.js:276` prints `failed: ${lastRun.error}` unescaped into the panel's
       log, so a relay can forge a `[negentropy-presets] …` line. A probe confirmed it.
     - The presets file and the `/run` body carry the text JSON-encoded, the task script logs
       that body (`syncPresets.sh:45`), and the tab renders through React. Those paths are
       safe.
     - In round 1 the recorded text was a strfry line, split on newlines, so it could hold no
       newline.
   - **(b) A relay can inflate the counts.** `parseSyncOutput` still runs the count regexes on
     relay lines (`:143–153`, before the relay check at `:154`). A NOTICE reading
     `DOWN: 900 events …` or `Writer: added: 900` inflates `down`/`added` on a successful sync.
     A probe recorded 902 for a real 2.
     - This predates the round.
     - But test plan choice 7 now states that a relay line doesn't change `ok` or the counts
       (O13), and that holds only for harmless text.
   - **Impact is low.**
     - The owner chose the relay.
     - The text is capped at 300 characters.
     - It reaches only the owner's own log and count display.
   - **Optional fix:**
     - in `relayMessageOf`, replace control characters with spaces before the cap;
     - in `parseSyncOutput`, `continue` once a line is recorded as a relay line;
     - the Tester can turn both probes into tests.
2. **R2-2. The Tester's `Redis error: Connection refused` flag: acceptable, not a defect of
   this round.**
   - **Production prints the same line.** It is unprefixed (`patches/strfry-redis/redis.cpp:11`),
     and strfry prints it only when Redis can't be reached at startup. With Redis up it prints
     `Redis connected to …`, which doesn't match the rule.
   - **When it wins.** Only when nothing later in the output is a candidate. In practice that
     is a relay that ignores NEG-OPEN, or a strfry that dies with no error line. The record
     then reads
     `Redis error: Connection refused; strfry sync did not finish within 10 minutes and was stopped`
     (reproduced live).
   - **Why that is acceptable:**
     - The timeout clause still says what happened.
     - Redis being down is a real fault on that instance. While it lasts, the sync's kinds 3,
       10000 and 1984 also miss the streaming ETL.
     - Round 1 already named this line for exit-code failures. This round adds the timeout
       row, where round 1's override used to hide it.
   - **Not pinned by a test.** Evidence 12's fixture deliberately leaves the Redis line out
     (`test/negentropy-sync-presets.test.js:1573`).
   - **Optional (Architect):** take no candidates from strfry's startup lines (everything before
     `Connected to`).
3. **R2-3. The literals "60 s" and "10 minutes" (`negentropyPresets.js:162–163`, `:166–167`)
   are not built from `RELAY_STALL_MS`/`SYNC_TIMEOUT_MS` (`:45–46`). This is harmless today.**
   - The texts are exact by the ADR's table and test plan choice 7 (O9–O12). `parseSyncOutput`
     is pure, and the ADR gives it only the kind of stop.
   - **The hazard is a future change.** R13 accepts a stop 50–150 s after the notice, so moving
     `RELAY_STALL_MS` to 90 or 120 s would pass while the record still says 60 s.
   - **Optional:** a comment at `:46` naming the texts, or texts built from the constants. The
     tests pass either way at 60 000 and 600 000.
4. **R2-4. ADR 0003 Amendment 2 (`:386`, `:537`) names the wrong-stop risk too narrowly.**
   - It calls the risk "a relay that sends an unrelated notice and then reconciles silently for
     more than 60 s".
   - Any silence after a notice counts, not only during the reconcile. strfry logs `UP:`/`DOWN:`
     per batch (`cmd_sync.cpp:292`, `:303`) and `Writer: added` per flush. So a relay that
     sends a rate-limit NOTICE and then holds a download batch, or an upload batch's OKs, for
     more than 60 s is also stopped.
   - The consequences are the ADR's: the relay's words are recorded, the window isn't
     advanced, and the next run retries.
   - **Suggest:** widen the sentence at book close. Watch for it on staging.
5. **R2-5. Test plan `:410` says the suite runs "about 4.5 s once implemented". It now runs in
   about 9.5 s.** Cosmetic.

**OPEN.md.** I recommend one OPEN.md row (type `cleanup`), "presets' reading of relay text":
- R2-1 (a) and (b);
- R2-2's optional startup-line exclusion.

R2-3 to R2-5 are wording and comments the book close can absorb. I did not edit OPEN.md or the
ledger.

#### Harness friction

1. A recurrence of OPEN.md row 316. The role and workflow 5 say the Reviewer commits, but this
   brief reserved the commit. I followed the brief: this round's section is uncommitted.

### Verdict

**PASS**

Both fixes do what Amendment 2 says, in the code and against real strfry:
- **Finding 1.** A relay that refuses negentropy is stopped after a minute and named in its own
  words.
- **Finding 3.** A preset switched off or deleted before its turn, or while it waits, is not
  synced. A re-saved one runs as saved.

The gate shows only the baseline's six unrelated suites failing: run `20261009T203009Z-5726-d2a7`,
FAIL, 5408 passed, 72 failed, 591 skipped, 289/289 suites. It differs from round 1 only in this
suite, 72/0/0 → 95/0/0, and the suite is stable under load. What remains is non-blocking: relay
text hygiene (R2-1), the Redis-line corner (R2-2) and wording (R2-3 to R2-5).

### On PASS

- [x] The story's `**Status:**` stays `Done`, as round 1 set it. Its Linked artifacts already
      point to this file. The commit is left to the caller.
- [x] Completion detection performed. The result is reported in the hand-off, not here.
