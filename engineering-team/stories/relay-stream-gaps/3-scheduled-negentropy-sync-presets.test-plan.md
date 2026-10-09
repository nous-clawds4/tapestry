# Test Plan: Story 3 — Saved negentropy-sync presets, run on a schedule

**Story:** `engineering-team/stories/relay-stream-gaps/3-scheduled-negentropy-sync-presets.md`
**ADR:** `engineering-team/decisions/relay-stream-gaps/0003-negentropy-sync-presets.md`
**Date:** 2026-10-09

All new tests are in one stack-free suite, `test/negentropy-sync-presets.test.js`. It has 72
tests: 69 fail now, and 3 guards (G1–G3) pass before and after. It is registered in
`test/registry.js` right after `router-stream-limit-on-connect`. No fixtures, dependencies or test
infrastructure are added, and no existing test changes.

## Coverage map

Levels:
- **unit**: a pure exported function, run directly.
- **handler**: the real route handlers. They are registered on a fake `app` and driven with
  req/res mocks. `child_process.spawn` is stubbed, so a fake strfry answers.
- **script**: the real task script, run under `bash` against a stub control panel on 127.0.0.1.
- **child**: the fresh-install schedule, read through `readConfig()` in a child `node`.
- **source**: a source-text sentinel. JSX and docs are checked this way (house style; there is
  no JSX transpile).
- **manual**: a staging check, not part of `npm test`.

| Criterion | Test (abridged; full names in the suite) | Level |
|---|---|---|
| AC-1 | P2: a save stores the preset switched off, with a server-made UUID, in `{ version: 1, presets }` at `NEGENTROPY_PRESETS_PATH`; GET lists name, relay, dir, filter, enabled | handler |
| AC-1 | P3: `id`, `lastRun`, `lastSuccessAt` in a save body are ignored | handler |
| AC-1 | P4: presets survive a restart. A seeded file is listed as stored, and a save plus a switch-on are still there after the modules are re-required | handler |
| AC-1 | P5: an invalid preset gets 400 `{ success: false, error }` with the reason, and nothing is written | handler |
| AC-1 | P6: saving under an existing name, in any letter case, with the same relay/dir/filter replaces it. Id, switch, `lastRun` and `lastSuccessAt` are kept, and since/until in the body don't count as a change | handler |
| AC-1 | P7: changing the relay, the direction or the filter clears `lastSuccessAt` and keeps id, switch and `lastRun` | handler |
| AC-1 | P8: toggle on/off is saved; an unknown id is refused and changes nothing | handler |
| AC-1 | P9: delete removes that preset only | handler |
| AC-1 | P10: the file is written to a temp file and renamed into place, never written in place | handler |
| AC-1 | P12: the owner and a loopback caller can save; any signed-in user can list | handler |
| AC-1 | P13: the default path is `/var/lib/brainstorm/negentropy-presets.json` (the data volume) with the env override; the gate is routerConfig's `requireOwnerOrLocal`, exported and reused | source |
| AC-1 | V3, V4, V5, V10: the name is trimmed and 1–80 characters; the relay passes `relayUrlProblem` (the error names the relay); dir is down/up/both, defaulting to down; since/until/limit/ids and unknown keys are dropped | unit |
| AC-1 | U1: "Save as preset" button (disable-able) with a name input; `Replace preset "${…}"?` | source |
| AC-1 | U3: "Saved presets" with `<ToggleSwitch>`, Load, Delete (with a confirm), calling the presets endpoints | source |
| AC-1 | U4: Load calls `setDir(`, `setAuthors(`, `setTagFilters(`, `setSince(null)`, `setUntil(null)` | source |
| AC-1 | D1, D2, D3: BIBLE API rows for the five endpoints; the CONFIGURATION.md file row; routes registered in `src/api/index.js` | source |
| AC-2 | V1: no kinds, authors or tag filter → refused with exactly `A preset must narrow what it syncs: add event kinds, authors or a tag filter.` (empty filter, missing filter, empty arrays, only dropped keys) | unit |
| AC-2 | V2: kinds alone, authors alone, a `#z` alone (any string) or a `#t` alone each meet the floor | unit |
| AC-2 | V6–V9: kinds 0–65535 deduplicated; authors 64-char lowercase hex; `#p/#P/#e/#E` 64-hex; other tag values 1–512 characters | unit |
| AC-2 | P5: the floor message reaches the client in the 400's `error` | handler |
| AC-2 | U2: the tab shows the floor message inline | source |
| AC-3 | R1: a run syncs only switched-on presets, in name order, one at a time, each with its own relay, direction and filter plus `since` = now − 7 days, argv = the one-shot's `buildCommand` | handler |
| AC-3 | R2: after a success, `since` = `lastSuccessAt` − 3600 | handler |
| AC-3 | R6: a second run while one goes → 409 `{ alreadyRunning: true }`, nothing started; the next run after it works | handler |
| AC-3 | R7: a preset sync holds the one-shot slot. `/status` shows it, a manual Start is refused, GET says `running`, and the slot is free afterwards | handler |
| AC-3 | R8: a preset that finds a manual sync waits about 10 minutes, then is recorded skipped (`a manual sync was running`) without running (time dilated ×600) | handler |
| AC-3 | R9: a preset that finds the slot busy runs once the manual sync ends (×60) | handler |
| AC-3 | R12: no switched-on presets → success, `results: []`, `failed: 0`, nothing run | handler |
| AC-3 | T1: registry entry `syncNegentropyPresets` with every ADR field, `suggestedIntervalHours: 6`, a description naming `relay-stream-gaps/0003`, and a `monitoring.logFiles` mapping | source |
| AC-3 | T2: the script exists where the registry points and passes `bash -n`. It POSTs `http://127.0.0.1:${CONTROL_PANEL_PORT:-7778}/api/strfry/negentropy-presets/run` with `-m` ≥ 21600, parses with `node -e`, and has no `jq` | source |
| AC-3 | T3: run OK and `failed: 0` → exit 0 after one loopback POST, with TASK_START … TASK_END `failure: false` | script |
| AC-3 | T4: any preset failed → exit 1, TASK_END `failure: true` (the panel history shows a failure) | script |
| AC-3 | T5: 409 `alreadyRunning` → exit 0, a WARN with the reason, TASK_END `failure: false` | script |
| AC-3 | T6: empty answer, control panel down, 500, 403, non-JSON → exit 1, TASK_END `failure: true` | script |
| AC-3 | T7: fresh install seeds `seed:syncNegentropyPresets` disabled at 0 d 6 h 0 m after the existing seeds, valid as shipped and switched on; seeds only when the file is absent | child |
| AC-3 | T8: `filterSchedulableTasks` passes `suggestedIntervalHours` only when it's a positive integer, and offers the task with 6 | unit |
| AC-3 | T9: the Add dialog pre-fills 0 d / N h / 0 m for a new entry, with edits left alone; the 24 h default stays | source |
| AC-3 | T10: the registry entry's `options.completion.failure.timeout` is `{ duration: 21600000, forceKill: true }`, so a long run isn't killed at the 30-minute default (ADR 0003 Amendment 1) | source |
| AC-3 | U6: the explainer's three sentences, verbatim | source |
| AC-3 | U7: `Scheduled preset "<name>" is syncing…` | source |
| AC-4 | O1–O4: `parseSyncOutput` reads have/need/UP/DOWN/Writer for down, up, both and nothing-to-do (Evidence 1, 2, 3, 5) | unit |
| AC-4 | O5: unreachable relay (Evidence 6) → `ok: false`, `error: 'Websocket connection error'` (prefix stripped) | unit |
| AC-4 | O6–O8: the `strfry sync exited with code <n>` fallback; `ok` needs exit 0 **and** the reconcile line; the error is the last `error`/`ERR|` line | unit |
| AC-4 | R3: `lastRun { startedAt, finishedAt, since, ok, added, sent }` in unix seconds; down → added 12, up → sent 3; `lastSuccessAt = lastRun.startedAt` | handler |
| AC-4 | R4: `lastSuccessAt` is the start of a slow run, not its end (×20) | handler |
| AC-4 | R5: one failing preset doesn't stop the next; its error is recorded, its earlier `lastSuccessAt` is kept, `failed: 1`, HTTP 200 | handler |
| AC-4 | R10: a preset deleted mid-run is not written back, the delete answers during the sync, and the others are recorded | handler |
| AC-4 | R11: a hung strfry is killed after 10 minutes and recorded failed; the next preset runs (×600) | handler |
| AC-4 | U5: `Not run yet`, `Last run <time>:`, `✓ <added> in, <sent> out`, `✗ <error>`, `skipped: <reason>` | source |
| AC-5 | V-AC5: the missing events arrive on staging after a scheduled run (manual, below) | manual |
| Product decision 1 | W1–W3: `windowSince` = last success − 3600; first run now − 7 days; never below 0 | unit |
| ADR § Implementation notes (`negentropySync.js`) | N1: `isSyncActive()`; N2: `runStrfrySync` spawns `buildCommand`'s argv, holds the slot (`/status` shows it) and resolves `{ exitCode, output }`; N3: refuses with `code: 'BUSY'` while a one-shot runs | handler |
| ADR constraint (owner gate) | P11: save/toggle/delete/run from a signed-in non-owner or an anonymous caller → 403 before any write or strfry run | handler |
| Guards | G1: the one-shot POST runs and answers as before and refuses a second start; G2: existing seeds keep their order; G3: `syncWoT`/`syncProfiles` unchanged | handler / child / source |

### AC-5: verified on staging (manual; not `npm test`)

After the deploy that ships this story, on staging:

1. **Pick content inside the window.** A scheduled run covers only events created in the
   last 7 days on its first run (product decision 1). Choose missing events created in that
   window. Staging's backlog from 2026-10-09 (the dcosl concept headers, kind 39998, and
   `food-and-drink-places` items) qualifies only if those events are newer than 7 days. If they
   aren't, publish a fresh test event upstream of a kind or `#z` no download stream covers, and
   use that. Older content is fetched by Load + Start, the one-off full sync (ADR § Consequences).
2. **Measure the gap.** In Settings → Relays → Negentropy Sync, choose the source relay and
   the filter (e.g. kinds `39998`, or `#z` = the concept's handle), direction Down, and press
   **Count Events**. Note local vs remote. Or run
   `docker exec tapestry strfry scan --count '<filter>'` against the source relay's count.
3. **Save the preset.** Name it, press **Save as preset**, then switch it on in **Saved
   presets**. Check that an unfiltered form can't be saved (the floor message shows).
4. **Schedule it.** Scheduled Tasks → Add → **Sync Negentropy Presets**. The interval
   pre-fills 6 hours. For the check, set a short interval (e.g. 5 minutes) and enable it.
5. **After the next run:**
   - the preset's row shows `Last run <time>: ✓ <n> in, 0 out` with n ≥ the gap;
   - Scheduled Tasks history shows a successful run of the task;
   - **Count Events** shows no remote surplus for the filter;
   - the specific missing events are present (`docker exec tapestry strfry scan '<filter>'`).

   No manual sync was pressed.
6. **Optional.** Switch the preset off, wait for one more run, and check its last-run line is
   unchanged (switched-off presets are skipped).
7. Set the task's interval back to 6 hours, or the operator's choice.

Record the counts and the last-run line in the review as the book's "verified on staging"
bullet.

## Edge cases

- [x] Empty filters in every form: `{}`, missing, empty arrays, only dropped keys (V1).
- [x] Boundary values: name 80/81 (V3), kind 0/65535/65536/−1/1.5 (V6), tag value 512/513/empty (V9).
- [x] Values strfry rejects: uppercase or short authors (V7), non-hex `#p/#P/#e/#E` (V8).
- [x] Loopback relay URL accepted, as the router accepts it on an owner-only surface (V4).
- [x] Forged server fields in a save body (P3).
- [x] Name collision in a different letter case (P6). A re-save with since/until isn't a change (P6).
- [x] Concurrency: a second run (R6); a manual sync before a run, ending during it (R9) or not
  (R8); a manual Start during a run (R7); a delete during a run (R10).
- [x] Failure modes: unreachable relay (R5, O5), non-zero exit without a reconcile line (O6),
  exit 0 without a reconcile line (O7), a hung strfry (R11).
- [x] Nothing to run (R12). A fresh install with no file (P1).
- [x] The task script's answers: success, failures, overlap, empty, down, 500, 403, non-JSON (T3–T6).
- [x] Non-owner and anonymous POSTs (P11). A non-owner GET (P12).
- [ ] A corrupt presets file. The ADR doesn't say what happens, so it isn't tested.
- [ ] A toggle of a preset while it's mid-run. The snapshot semantics aren't pinned beyond R10's
  delete.
- [ ] A relay that doesn't support negentropy. Its real stderr wasn't captured in the ADR's
  evidence. O8 pins the general rule (last `error`/`ERR|` line), and AC-5/staging covers it live.
- [ ] Concept Graph API unavailable / handle not found: not applicable, no concepts change.

## Choices the ADR left open (the Implementer must follow these)

1. **Seams.**
   - `negentropyPresets.js` takes strfry only through `negentropySync.js`
     (`runStrfrySync`/`isSyncActive`), so it shares the one `activeSync` slot.
   - It takes `relayUrlProblem` and `requireOwnerOrLocal` from `routerConfig.js`, which must
     **export** `requireOwnerOrLocal`.
   - From `src/middleware/auth.js` (stubbed in the suite) only `isOwner` may be used.
   - The presets path may be read at load or per call. Tests set `NEGENTROPY_PRESETS_PATH`
     before loading and re-require to "restart".
2. **Units.** `lastRun.startedAt`, `finishedAt`, `since` and `lastSuccessAt` are integer unix
   seconds, and the `since` sent to strfry is an integer. `lastSuccessAt` must equal
   `lastRun.startedAt`. That start may be the preset's or the whole run's, but no later than the
   preset's strfry start (R3).
3. **What a failure or skip leaves.** A failed or skipped preset keeps its earlier
   `lastSuccessAt` (R5, R8).
4. **Lock scope.** The read-modify-write lock must not be held across a strfry sync. A
   delete (or toggle) must answer while a preset is syncing (R10). A deleted preset's result is
   dropped. Whether it still appears in `results` is open.
5. **Waiting for the slot.**
   - Wait with `setTimeout`/`setInterval`/`timers/promises` or `Date.now` deadlines; all are
     dilated.
   - The wait must last at least 9.5 minutes and end before 30 (R8).
   - A skipped preset gets `lastRun.skipped` as a string containing
     `a manual sync was running`, and `lastRun.ok` not true.
   - Whether a skip counts in `failed` is open.
6. **`runStrfrySync`.**
   - It rejects (or throws) an error whose `.code === 'BUSY'`.
   - It spawns exactly `buildCommand(...).args` with program `strfry`.
   - It keeps the slot's existing fields (`relay`, `dir`, `preview`, `lines`, `startedAt`) so
     `/status` keeps working.
   - It kills via a `setTimeout` of `timeoutMs` (default 600000) and resolves once the child
     closes.
7. **`parseSyncOutput`.**
   - Counts strfry didn't print (no UP, DOWN or Writer line) may be `0` or `null`.
   - The error is the message after the loguru `| `, trimmed, matched on lowercase `error` or
     `ERR|`.
   - `error` is falsy on success.
8. **Responses.**
   - Save/replace: 200 `{ success: true, … }`.
   - Validation: 400 `{ success: false, error }`, where `error` is a string containing the
     messages. The floor message is verbatim (the UI shows server errors as returned).
   - Toggle of an unknown id: `success: false` with any 4xx. Delete of an unknown id: open.
   - Non-owner: 403 `{ success: false }`. The message is open (the reused router message is
     acceptable).
   - `/run`: 200 `{ success: true, results, failed }` even when presets failed. 409 with
     `alreadyRunning: true` for an overlap; its other fields are open.
   - GET: `{ success, presets, running }`, where `running` is falsy when idle and truthy during
     a run (a boolean or an object).
   - `results` are `{ id, name, ok, added, sent, error, skipped }` in run order.
9. **Validation details.**
   - A bad relay's error mentions "relay" (any case). Other messages are open.
   - `errors[]` items may be strings or `{ message }`.
   - Keys like `#zz` or `#1` are unknown keys: dropped, not refused.
   - A tag key with an empty array, and numeric strings in kinds, are open.
10. **Replace.**
    - "Changed" compares the validated relay, dir and filter, after since/until are dropped
      (P6).
    - Whether a reordered kinds list counts as a change is open.
    - New presets start off when the body has no `enabled`. Whether a create honors
      `enabled: true` is open.
11. **Registry.** The description contains `relay-stream-gaps/0003`.
    `monitoring.logFiles.syncNegentropyPresets` is a `.log` name (suggest
    `syncNegentropyPresets.log`). `options` is open; see the note below.
12. **Seed.** Append `seed:syncNegentropyPresets` **after** `seed:reconcileTaggingEdges`.
    `tagging-edges-wiring` SWR6 needs `seed:refreshApplicabilityLists` immediately before
    `seed:reconcileTaggingEdges`, and G2 pins the first three. `label`/`args` are open.
13. **`filterSchedulableTasks`.** Leave the hint out (or `null`) unless it's a positive
    integer; the string `'6'` doesn't pass.
14. **Add dialog.**
    - Pre-fill in the task-selection effect, guarded by `isEdit` (it already returns early
      when editing), or in the task picker's `onChange` (disabled while editing).
    - Write the setters with literal zeros: `setIntervalDays(0)`, `setIntervalHours(…)`,
      `setIntervalMinutes(0)`.
    - Keep `useState(entry?.intervalHours ?? 24)`.
15. **Task script.**
    - Tolerate a missing `/etc/brainstorm.conf` (`source /etc/brainstorm.conf 2>/dev/null || true`).
    - Source structured logging from `${BRAINSTORM_MODULE_BASE_DIR…}/src/utils/structuredLogging.sh`
      or `${BRAINSTORM_MODULE_SRC_DIR…}/utils/structuredLogging.sh` (the suite points both at a
      double).
    - Emit with task name `syncNegentropyPresets`: TASK_START first, TASK_END last, its
      metadata JSON carrying `"failure": true|false`. On overlap, a WARN whose metadata says
      `alreadyRunning`/"already running".
    - The literal `CONTROL_PANEL_PORT:-7778` and `127.0.0.1` must appear.
    - `curl` takes `-X POST` and `-m`/`--max-time` ≥ 21600 on the same logical line (`\`
      continuations are joined).
    - **Don't use `curl -f`**: the 409 body is needed. Detect non-2xx with
      `-w '%{http_code}'` or similar.
    - Parse with `node -e`/`-p`; no `jq` anywhere in code lines.
16. **UI scope.** The checks read `NegentropySync`, any top-level declaration in
    `RelaySettings.jsx` whose name contains "preset" or "negentropy" (any case), and any local
    module it imports whose file name does. Wording elsewhere isn't seen. Within that scope:
    - "Save as preset" is inside a `<button` that has `disabled={…}`, with an `<input` within
      2,500 characters.
    - `Replace preset "${…}"?`, `Scheduled preset "{…}" is syncing…` and the last-run forms
      take **simple** interpolations (`{x}` or `${x}`, no nested braces).
    - Load/Delete labels end the element text (`>Load<`, `>🗑 Delete<`). A `confirm('…')`
      literal mentions delete.
    - The literal `/api/strfry/negentropy-presets` appears, plus `/toggle` and `/delete`.
    - The floor message and the three explainer sentences match visible text. Tags are dropped,
      whitespace collapsed and `{' '}` is a space. Straight or curly quotes and `&quot;` are
      equal, as are `...` and `…`. Words and punctuation must match the ADR.
    - Where the status line gets the preset name (`/status` or GET's `running`) is open.
17. **Docs.**
    - The five BIBLE rows go in the strfry API table, the block with the
      `/api/strfry/negentropy-sync` row with no blank line between, in the form
      ``| GET | `/api/strfry/negentropy-presets` |``.
    - At least one POST row says "owner".
    - CONFIGURATION.md gets a row starting ``| `/var/lib/brainstorm/negentropy-presets.json` |``.
18. **Wiring and source.**
    - `src/api/index.js` requires `./strfry/negentropyPresets` and calls
      `registerNegentropyPresetRoutes(app)` within 600 characters of
      `registerNegentropySyncRoutes(app)`.
    - `negentropyPresets.js` contains the default path literal and `NEGENTROPY_PRESETS_PATH`,
      and defines no `requireOwnerOrLocal` of its own.
19. **Atomic write.** Never write, append, truncate, open-for-write or copy onto the final
    path. Rename a temp file onto it (sync or `fs.promises` both work).

**The task's timeout (ADR 0003 Amendment 1; T10).** At Test Design the ADR's registry entry set
no `options`, so `launchChildTask.sh` would apply `options_default.completion.failure.timeout`:
30 minutes with `forceKill: true`. A presets run longer than that would have its script killed
(exit 124, a timeout in the history) while the server-side run carried on. The gate (2026-10-09)
approved Amendment 1: the entry sets a 6-hour timeout with `forceKill: true`, matching the
script's `curl -m 21600`. T10 checks it. T10 was added at the gate, after the runs recorded under
Verification, so those show 71 tests; with T10 the suite is 3 passed, 69 failed.

## Test infrastructure

- Test framework: Node built-in runner (`npm test` → `test/test.js` → `test/registry.js`). Read a
  run's result per [Running and reading the test gate](../../README.md#running-and-reading-the-test-gate).
  No new dependencies or infrastructure.
- Concept Graph API: not used. The stack was absent this session (probe failed), so no live
  suites apply. AC-5 is the manual staging check above.
- Firmware state: none required (no concepts change).
- Seams, installed only while the suite runs:
  - a fake `child_process.spawn` (strfry 1.1.0 stderr with the loguru prefix, an exit code,
    hold or kill);
  - a stub `src/middleware/auth.js` (`isOwner` true only for the test's owner session);
  - `NEGENTROPY_PRESETS_PATH` set to a temp file per test;
  - a time-dilation clock for the 10-minute waits (×20, ×60, ×600).
- Host tools: `bash` and `curl` for T2–T6. T3–T6 **skip** (counted as skipped, not failed) if
  `/etc/brainstorm.conf` exists, because the script sources it and could reach a real control
  panel; they also skip if `curl` is missing. Neither is the case in CI or this sandbox.
- The suite runs in about 1 s while failing and about 4.5 s once implemented. A broken runner
  that never frees the slot costs up to 10 s per test (the per-test cap).
- Temp files are under `os.tmpdir()` and are removed when the suite ends.
- **Reachability check (done once, not committed).** The ADR was applied to a throwaway copy
  of the tree outside the repo. The suite passed 71/71 there. The copy's full gate,
  `20261009T175015Z-2883-06ae [rsg3-tester-impl-2] — FAIL, exit 1, 5384 passed, 72 failed, 591
  skipped, 289/289 suites`, differs from the baseline only in `negentropy-sync-presets`
  (PASS 71/0/0). Its six failures are the baseline's six. `sync-panel-tag-filters`,
  `negentropy-sync-input`, `tagging-edges-wiring` (SWR6), `scheduled-tasks-with-arguments`
  and the router suites keep their results. An earlier run of the copy's gate overlapped
  another test process. In that run `tagging-edges-realtime-wrapper` RW7, a backoff-timing
  check on files this story doesn't touch, failed once (0.72 s vs ≥ 0.8 s). It passed 24/24
  alone and in the uncontended run above.
  - **28 mutations, all caught:** `lastSuccessAt` = finish time (R4); bypassing the shared slot
    (R7, R11); no wait for the slot (R8, R9); keeping `lastSuccessAt` on a changed replace
    (P7); case-sensitive names (P6); the lock held across the run (R1–R12); the gate after the
    write (P11 and others); `ok` on exit 0 alone (O7); no floor at 0 (W3); no hour of overlap
    (W1, R2); `since` in ms (R1, R3); disabled presets run (R1, R12); a deleted preset written
    back (R10); no kill timer (R11); the slot never freed (N2, R1 and others); unknown keys
    refused (V10); new presets on (P2); an in-place write (P10); 200 instead of 409 (R6);
    `curl -f` (T5); ignoring `failed` (T4); 409 treated as failure (T5); the seed inserted
    mid-list (T7, G2); an unguarded modal effect (T9); any hint passed through (T8); Load
    keeping Since/Until (U4); uppercase authors (V7); `#p` unchecked (V8).
  - **Allowed variants that still pass 71/71:** a destructured `timers/promises.setTimeout`
    poll; `running` as an object; skips counted as failed; 400 for an unknown toggle id; async
    `fs.promises` writes; `null` counts; the ADR's literal seed without label/args; structured
    logging via `BRAINSTORM_MODULE_SRC_DIR`; the modal pre-fill in `onChange`.

## How to run

```
npm test
node test/negentropy-sync-presets.test.js        # just this suite
```

No browser/e2e tests: the UI changes are pinned at source level.

## Verification

The new tests fail with the current code. Confirmed on 2026-10-09 at commit `9a07e8e6` (Node
v22, no stack), with the test changes uncommitted. Every failure is a missing module, export,
route, file, registry entry or UI text; none is a load error. The 3 guards pass.

`node test/negentropy-sync-presets.test.js`:

```

--- negentropy sync presets tests (relay-stream-gaps #3) ---
  FAIL  V1: a preset with no event kinds, no authors and no tag filter is refused with the exact floor message, however its filter is empty (AC-2, product decision 3)
        src/api/strfry/negentropyPresets.js must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  V2: any one of event kinds, authors or a tag filter meets the floor; a #z value is just a string (AC-2, epic guardrail)
        src/api/strfry/negentropyPresets.js must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  V3: the name is trimmed and must be 1–80 characters
        src/api/strfry/negentropyPresets.js must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  V4: the relay must be a ws:// or wss:// URL by the router's relayUrlProblem check; a bad one is refused with an error that names the relay (AC-1)
        src/api/strfry/negentropyPresets.js must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  V5: the direction is down, up or both, and defaults to down
        src/api/strfry/negentropyPresets.js must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  V6: kinds are integers from 0 to 65535, saved without duplicates
        src/api/strfry/negentropyPresets.js must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  V7: authors must be 64-character lowercase hex pubkeys
        src/api/strfry/negentropyPresets.js must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  V8: #p, #P, #e and #E tag values must be 64-character hex (strfry rejects anything else)
        src/api/strfry/negentropyPresets.js must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  V9: other tag values are non-empty strings of at most 512 characters
        src/api/strfry/negentropyPresets.js must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  V10: since, until, limit, ids and unknown keys are dropped from the saved filter, not refused (AC-1, product decision 1)
        src/api/strfry/negentropyPresets.js must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  W1: after a successful run, the next run looks back to that success less an hour (product decision 1)
        src/api/strfry/negentropyPresets.js must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  W2: a preset with no earlier success covers the last 7 days
        src/api/strfry/negentropyPresets.js must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  W3: the window never starts before 0
        src/api/strfry/negentropyPresets.js must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  O1: a down sync (Evidence 1) reads as success with 12 needed, 12 down and 12 added
        src/api/strfry/negentropyPresets.js must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  O2: an up sync (Evidence 3) reads as success with 3 sent up
        src/api/strfry/negentropyPresets.js must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  O3: a both-ways sync reads both counts and what was stored
        src/api/strfry/negentropyPresets.js must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  O4: a sync with nothing to do (Evidence 2) is still a success
        src/api/strfry/negentropyPresets.js must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  O5: an unreachable relay (Evidence 6, exit 1) is a failure whose error is strfry's line without the log prefix (AC-4)
        src/api/strfry/negentropyPresets.js must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  O6: a non-zero exit with no reconcile line and no error line falls back to "strfry sync exited with code <n>"
        src/api/strfry/negentropyPresets.js must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  O7: ok needs both exit 0 and the "Set reconcile complete" line
        src/api/strfry/negentropyPresets.js must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  O8: the error is the LAST line containing "error" or "ERR|", with the log prefix stripped
        src/api/strfry/negentropyPresets.js must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  N1: isSyncActive() is false when idle, true while a one-shot sync runs, and false again after
        negentropySync.js must export isSyncActive(): not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  N2: runStrfrySync spawns the one-shot's buildCommand argv, holds the shared slot while strfry runs, and resolves { exitCode, output } with strfry's stderr
        negentropySync.js must export runStrfrySync(relay, dir, filter, opts): not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  N3: runStrfrySync refuses with code BUSY while a one-shot sync holds the slot, and starts nothing
        negentropySync.js must export runStrfrySync(relay, dir, filter, opts): not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  P1: a fresh install has no presets: GET answers { success: true, presets: [] } and nothing is running (story: no starter presets)
        src/api/strfry/negentropyPresets.js must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  P2: saving a preset stores it switched off, with a server-made UUID, in { version: 1, presets } at NEGENTROPY_PRESETS_PATH (AC-1)
        src/api/strfry/negentropyPresets.js must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  P3: a save cannot forge the server's fields: id, lastRun and lastSuccessAt in the body are ignored
        src/api/strfry/negentropyPresets.js must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  P4: presets survive a restart: a saved file is listed as stored, and a save and a switch-on are still there after the server restarts (AC-1)
        src/api/strfry/negentropyPresets.js must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  P5: an invalid preset is refused with 400 { success: false, error } carrying the reason, and nothing is written (AC-1, AC-2)
        src/api/strfry/negentropyPresets.js must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  P6: saving under an existing name (any letter case) with the same relay, direction and filter replaces it and keeps its id, switch, lastRun and lastSuccessAt; since/until in the body don't count as a change
        src/api/strfry/negentropyPresets.js must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  P7: replacing a preset with a changed relay, direction or filter clears lastSuccessAt (the next run covers 7 days) but keeps id, switch and lastRun
        src/api/strfry/negentropyPresets.js must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  P8: the switch: POST …/toggle { id, enabled } switches a preset on and off and is saved; an unknown id is refused and changes nothing (AC-1)
        src/api/strfry/negentropyPresets.js must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  P9: POST …/delete { id } removes that preset only, and it stays removed (AC-1)
        src/api/strfry/negentropyPresets.js must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  P10: the presets file is replaced whole: each save writes another file and renames it onto negentropy-presets.json, never writing it in place
        src/api/strfry/negentropyPresets.js must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  P11: every POST — save, toggle, delete and run — from a signed-in non-owner or an anonymous caller is refused 403 before anything is written or run (ADR constraint: owner-or-local)
        src/api/strfry/negentropyPresets.js must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  P12: the owner and a local (loopback) caller pass the gate; any signed-in user can read the list
        src/api/strfry/negentropyPresets.js must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  P13: presets live in /var/lib/brainstorm/negentropy-presets.json (the data volume) unless NEGENTROPY_PRESETS_PATH is set, and the owner gate is routerConfig's requireOwnerOrLocal, reused not copied
        src/api/strfry/negentropyPresets.js must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  R1: a run syncs only switched-on presets, in name order, one at a time, each with its own relay, direction and filter plus since = now − 7 days on a first run (AC-3, product decision 1)
        src/api/strfry/negentropyPresets.js must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  R2: a preset with an earlier success syncs from that success less an hour
        src/api/strfry/negentropyPresets.js must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  R3: each preset's run is recorded — lastRun { startedAt, finishedAt, since, ok, added, sent } in unix seconds — and a success sets lastSuccessAt to that run's start (AC-4)
        src/api/strfry/negentropyPresets.js must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  R4: lastSuccessAt is the run's start, not its end, so events published during a slow sync fall inside the next window (time dilated)
        src/api/strfry/negentropyPresets.js must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  R5: one preset failing doesn't stop the others: the unreachable relay's error is recorded, its earlier success is kept, the next preset runs, and failed counts it (AC-4)
        src/api/strfry/negentropyPresets.js must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  R6: a run requested while one is going answers 409 { alreadyRunning: true } and starts nothing; once the first ends, the next run starts normally (AC-3)
        src/api/strfry/negentropyPresets.js must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  R7: while a preset syncs it holds the one-shot's slot: /status shows it, a manual Start is refused, GET reports running; afterwards the slot is free again (ADR § Consequences)
        src/api/strfry/negentropyPresets.js must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  R8: a preset that finds a manual sync running waits up to 10 minutes, then is recorded skipped ("a manual sync was running") without running, its last success kept and the manual sync untouched (time dilated ×600)
        src/api/strfry/negentropyPresets.js must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  R9: a preset that finds the slot busy runs once the manual sync ends, within a poll (time dilated ×60)
        src/api/strfry/negentropyPresets.js must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  R10: a preset deleted while the run is going is dropped: the delete answers during the sync, the preset is not written back, and the others are recorded
        src/api/strfry/negentropyPresets.js must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  R11: a strfry sync that hangs is killed after 10 minutes and recorded as failed, and the next preset still runs (time dilated ×600)
        src/api/strfry/negentropyPresets.js must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  R12: with no switched-on presets a run does nothing and succeeds: results [] and failed 0
        src/api/strfry/negentropyPresets.js must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  T1: the registry offers syncNegentropyPresets — "Sync Negentropy Presets", network, system, periodic, structured logging, suggested every 6 hours — with its script and a log-file mapping (AC-3, product decision 2)
        taskRegistry.json must have tasks.syncNegentropyPresets: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  T2: the task script exists where the registry points, parses with bash -n, and POSTs the run endpoint over loopback with a curl timeout of at least 6 hours, parsing the answer with node -e (no jq)
        src/manage/negentropySync/syncPresets.sh must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  T3: the task script exits 0 when the run succeeded with no failed preset, after one loopback POST to the run endpoint, emitting TASK_START then TASK_END { failure: false } (AC-3)
        src/manage/negentropySync/syncPresets.sh must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  T4: the task script exits 1 when any preset failed, with TASK_END { failure: true }, so the panel's history shows the run failed (ADR § Consequences)
        src/manage/negentropySync/syncPresets.sh must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  T5: when a run is already going (409 alreadyRunning) the task script exits 0 with a WARN giving that reason, so a slow run is never doubled or counted a failure (AC-3)
        src/manage/negentropySync/syncPresets.sh must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  T6: the task script exits 1 with TASK_END { failure: true } on an empty answer, a control panel that is down, a non-2xx status, or an answer that is not JSON
        src/manage/negentropySync/syncPresets.sh must exist: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  T7: a fresh install seeds the task switched off at every 6 hours, after the existing seeds, valid as shipped and once switched on; existing instances get no seed (product decision 2)
        the fresh-install seeds are ["seed:refreshPinnedTagTLs","seed:refreshApplicabilityLists","seed:reconcileTaggingEdges"]; expected one with id "seed:syncNegentropyPresets": not implemented yet (ADR relay-stream-gaps/0003).
[BrainstormConfig] Config file not found: /etc/brainstorm.conf
  FAIL  T8: the Add dialog's task list passes suggestedIntervalHours through when it is a positive integer, and offers syncNegentropyPresets with 6
        a positive integer hint is passed through
        expected: 6
        actual:   undefined
  FAIL  T9: the Add dialog pre-fills 0 days, <suggestedIntervalHours> hours, 0 minutes when a NEW entry picks a task with a hint; editing is unchanged (source)
        AddOrEditEntryModal.jsx must read the task's suggestedIntervalHours: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  U1: the tab can save the form as a named preset: a "Save as preset" button that can be disabled, a name input, and a `Replace preset "<name>"?` confirm for an existing name (AC-1)
        the Negentropy Sync tab must offer "Save as preset": not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  U2: when the form has no kinds, authors or tag filter the tab says why, with the floor message (AC-2)
        the tab must show "A preset must narrow what it syncs: add event kinds, authors or a tag filter." inline: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  U3: the "Saved presets" list gives each preset an on/off ToggleSwitch, Load and Delete (with a confirm), backed by the presets endpoints (AC-1)
        the tab must list "Saved presets": not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  U4: Load fills relay, direction, kinds, authors and tag filters and clears Since/Until (AC-1, product decision 1)
        Load must call setSince(null): not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  U5: each preset shows its last scheduled run: "Not run yet", "Last run <time>: ✓ <added> in, <sent> out", "✗ <error>" or "skipped: <reason>" (AC-4)
        a preset that never ran must say "Not run yet": not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  U6: the tab explains the schedule in the ADR's words: the "Sync Negentropy Presets" task, off until turned on, since the last success less an hour, 7 days first, Load + Start for a full sync (AC-3, product decisions 1–2)
        the explainer must say: Switched-on presets run with the "Sync Negentropy Presets" task in Scheduled Tasks (off until you turn it on).: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  U7: while a scheduled preset holds the slot, the status line reads `Scheduled preset "<name>" is syncing…` (ADR § Consequences)
        the status line must read `Scheduled preset "<name>" is syncing…`: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  D1: the BIBLE strfry API table lists the five presets endpoints, and says the POSTs are owner or local only
        the BIBLE strfry API table must have a "| GET | `/api/strfry/negentropy-presets` |" row: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  D2: docs/CONFIGURATION.md lists /var/lib/brainstorm/negentropy-presets.json in a file table
        CONFIGURATION.md must have a "| `/var/lib/brainstorm/negentropy-presets.json` |" row: not implemented yet (ADR relay-stream-gaps/0003).
  FAIL  D3: src/api/index.js registers the presets routes next to the one-shot sync routes
        src/api/index.js must require('./strfry/negentropyPresets'): not implemented yet (ADR relay-stream-gaps/0003).
[negentropy-sync] Starting: strfry sync wss://t45-g1.example --filter '{"kinds":[1]}' --dir down
[negentropy-sync] Starting: strfry sync wss://t45-g1b.example --filter '{"kinds":[1]}' --dir down
  PASS  G1: the one-shot POST /api/strfry/negentropy-sync still runs `strfry sync <relay> --filter <json> --dir down`, answers with the output and exit code, and refuses a second start while one runs
  PASS  G2: the existing fresh-install seeds keep their order (refreshPinnedTagTLs, refreshApplicabilityLists, reconcileTaggingEdges)
  PASS  G3: the fixed syncWoT and syncProfiles tasks are unchanged (story: out of scope)

negentropy-sync-presets: 3 passed, 68 failed, 0 skipped
```

The full gate, read with `npm run gate:status` (baseline taken on the same checkout before
any change, then with the suite registered):

```
20261009T170703Z-6216-e15d [rsg3-tester-baseline] started 2026-10-09T17:07:03.828Z on 9a07e8e6 — FAIL, exit 1, 5313 passed, 72 failed, 591 skipped, 288/288 suites; failed: stamped-composite-avatar, my-assistant-page, one-writer-assistant-profile, assistant-profile-check, assistant-profile-checklist-page, assistant-stamped-avatar-for-everyone
20261009T174031Z-8207-ccdd [rsg3-tester-red] started 2026-10-09T17:40:31.204Z on 9a07e8e6+dirty — FAIL, exit 1, 5316 passed, 140 failed, 591 skipped, 289/289 suites; failed: negentropy-sync-presets, stamped-composite-avatar, my-assistant-page, one-writer-assistant-profile, assistant-profile-check, assistant-profile-checklist-page, assistant-stamped-avatar-for-everyone
```

Per-suite comparison of the two run records: the only difference is
`negentropy-sync-presets.test.js` (absent → FAIL 3/68/0). Every other suite has the same
verdict and counts. The baseline was already red: the six failing suites are the
assistant-profile-checklist epic's own red-phase suites. They are unrelated to this story and
unchanged by it.

