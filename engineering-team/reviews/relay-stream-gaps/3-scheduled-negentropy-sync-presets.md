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
