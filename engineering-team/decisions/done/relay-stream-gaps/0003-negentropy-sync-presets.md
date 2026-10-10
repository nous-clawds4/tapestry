# ADR 0003: Negentropy-sync presets, run by one scheduled task through the control panel

**Status:** Accepted
**Date:** 2026-10-09
**Story:** `engineering-team/stories/relay-stream-gaps/3-scheduled-negentropy-sync-presets.md`

## Context

The story's acceptance criteria, restated:

- **AC-1:** save the Negentropy Sync form (relay, direction, kinds, authors, tag filters) as a
  named preset, under the one-shot's checks. Presets are listed with name, relay, direction,
  filter summary and an on/off switch, and can be loaded into the form or deleted. Since/until
  aren't saved. Presets survive restarts and deploys.
- **AC-2:** a preset needs at least one of kinds, authors or a tag filter, and the tab says why
  when it refuses one.
- **AC-3:** the Scheduled Tasks panel offers a **Negentropy Sync presets** task. Each run syncs
  every switched-on preset, one at a time, over the decided window, and never runs twice at
  once. Its runs appear in the panel's history.
- **AC-4:** each preset shows its last run: when, success, events in (and out), or why it
  failed. One failure doesn't stop the others.
- **AC-5:** on staging, a switched-on preset brings in missing content with no manual sync.

The product decisions:
1. A run looks back to the preset's last successful run, minus an hour; a first run covers 7
   days.
2. The task ships switched off, with 6 hours suggested.
3. AC-2's floor is at least one of kinds, authors or a tag filter.

**The one-shot sync today** is `src/api/strfry/negentropySync.js`:
- **Filter and command.** `buildFilterObj` (:28–42) keeps `kinds`, `authors`, `since`, `until`
  and `#<letter>` tag keys. `buildCommand` (:44–51) runs `strfry sync <relay> --filter <json>`,
  adding `--dir` unless it's `both`, which is strfry's default (Evidence 5).
- **One sync at a time.** A module-level `activeSync` (:21) refuses a second start ("A sync is
  already in progress"), and `/status` (:222–241) reports the running one.
- **Server-side checks** are only the relay regex `^wss?://.+` (:69). Tag-value checks
  (p/e/a formats) live in the UI's shared `tagFilterValidation` module (relay-management #1).
- **Access.** These endpoints are open to any signed-in user, not just the owner
  (`src/middleware/auth.js:369–379`). *(Corrected after review round 1, finding 5: that holds
  for their POSTs; GETs are open to anyone who can reach the API, signed in or not, because
  the middleware lets unauthenticated GETs through, `auth.js:511–512`.)*

**The scheduler** (`src/api/scheduled-tasks/index.js`, ADRs 0019–0021 of the
task-queue-scheduler epic):
- **Entries** live in `/var/lib/brainstorm/scheduled-tasks.json`, each naming a `taskId` from
  `src/manage/taskQueue/taskRegistry.json`. BullMQ runs them.
- **Seeded entries.** A fresh install seeds a few entries, disabled (`freshInstallEntries`,
  :41–). Existing instances never get seeds added.
- **The Add dialog** (`ui/src/pages/settings/scheduledTasks/AddOrEditEntryModal.jsx`) lists
  every non-continuous registry task (`filterSchedulableTasks`, :339–359) and pre-fills 24 h.
- **How tasks run.** Registry tasks are shell scripts. The house pattern for work that lives in
  the control panel is a script that `curl`s a loopback endpoint and emits structured task
  events (`src/algos/refreshApplicabilityLists.sh`). Loopback calls are `req.localTrusted`
  (`auth.js:355–363`).

**strfry's sync output** (Verified evidence below) is all on stderr:
- `Set reconcile complete. Have H need N`: H events only here, N only there.
- `UP: n events (r remaining)` and `DOWN: n events (r remaining)`.
- `Writer: added: a dups: d …`: what was stored locally.
- An unreachable relay gives `Websocket connection error` and exit 1.
- A `since` window is by `created_at`, so an event backdated before the window is not fetched.

**Constraints:**
- JS without a build step, and no new dependencies.
- Presets are persistent, scheduled and may upload, so their writes need the owner (the router's
  `requireOwnerOrLocal`). The ledger row `2026-10-09-router-accepts-values-strfry-rejects`
  argues for validating values, not only shape, on a new persisted surface.
- The epic guardrail stands: generic tooling, so a `#z` value is just a string.
- No concepts change.

## Options considered

### Option A: A presets file and a control-panel runner, triggered by one registry task

- **Storage.** Presets live in `/var/lib/brainstorm/negentropy-presets.json` on the data volume.
- **Runner.** A control-panel module validates and stores presets and serves them to the tab.
  It runs every switched-on preset through `strfry sync`, taking the one-shot's `activeSync` slot
  so manual and scheduled syncs never overlap.
- **Task.** One registry task, `syncNegentropyPresets`, is a shell script that calls the runner
  over loopback.

Pros:
- It is the house pattern.
- One code path builds strfry commands, and one slot serializes syncs.
- Results are recorded where the tab reads them.
- Stack-free tests can stub `spawn`.

Cons:
- A long run is one long loopback HTTP request. This is bounded by a per-preset timeout and the
  script's curl timeout.

### Option B: One scheduled entry per preset

A parameterized task `syncNegentropyPreset(presetId)`, with each preset its own entry and
schedule.

Pros: per-preset cadence and per-preset history in the panel.

Cons:
- The operator chose one shared schedule.
- Switching a preset on or off would have to create or toggle scheduler entries, giving two
  sources of truth for "is this preset on".
- Many entries, many BullMQ schedulers.

### Option C: The task script does everything in bash

It reads the file with `jq`, works out `since`, runs `strfry sync` and writes results back.

Pros: no new HTTP surface for the run.

Cons:
- Validation, windowing, locking against the one-shot, and result-recording in bash are
  untestable stack-free.
- A second code path builds strfry commands.

## Decision

We chose **Option A**. It reuses the one-shot's command builder and its one-sync-at-a-time slot,
follows the existing loopback-task pattern, and keeps every rule (floor, window, overlap,
results) in one testable Node module. Option B contradicts decision 2's single schedule. Option
C splits logic into untestable bash.

## Consequences

- **Content no stream covers is caught on a schedule.** Holes bigger than a stream's Limit and
  kinds with no download stream are filled by the next run, as long as they fall inside a
  preset's filter and window.
- **Backdated events can still slip by.** An event whose `created_at` is older than the run's
  window isn't fetched (Evidence 4). Mitigations:
  - the first run reaches back 7 days;
  - the overlap is an hour;
  - the operator can always run the same preset once with no window, by loading it into the
    form and pressing Start.

  The window is by design (decision 1). The tab's explainer says so.
- **Manual and scheduled syncs share the one slot.** While a preset runs, the Negentropy Sync tab
  shows it as in progress and a manual Start is refused, as with a second manual sync today. A
  preset that finds a manual sync running waits up to 10 minutes, then is recorded as skipped
  ("a manual sync was running"). *(Amendment 2: a relay that refuses negentropy now holds the
  slot for about a minute, not 10.)*
- **Overlap.** A second trigger while a run is going returns `alreadyRunning`, and the script
  exits 0 noting the skip, so a slow run is never doubled.
- **Task history.** The task fails in the panel's history when any preset failed. Per-preset
  detail is on the tab.
- **Uploads happen automatically.** An `up` or `both` preset uploads local events in its window
  to the relay on every run. That is what the operator asked for when choosing the direction,
  as with a both-direction router stream. Only the owner can save presets.
- **Stricter server-side checks than the one-shot has.** Authors must be 64-character hex, and
  `#p`/`#e` values too (strfry rejects other values; ledger row above). The one-shot endpoint
  is unchanged (its open access and thin checks are pre-existing, out of scope).
- **Existing instances get no seeded entry.** On staging and production the operator adds the
  task from the Add dialog, which pre-fills 6 hours from the registry hint. Fresh installs get a
  disabled seed entry at 6 h.
- **Firmware reinstall required?** No.

## Implementation notes

**`src/api/strfry/negentropySync.js`**
- Export `isSyncActive()`.
- Export `runStrfrySync(relay, dir, filter, { timeoutMs = 600000 })`:
  - throws `{ code: 'BUSY' }` if `activeSync` is set;
  - otherwise sets `activeSync` (same shape, plus `source: 'preset'` and `presetName`) and
    spawns `buildCommand(...)`;
  - collects stdout and stderr, with the same 10-minute kill (*Amendment 2 adds an opt-in stop
    after a relay notice followed by 60 s of silence*);
  - clears the slot, and resolves `{ exitCode, output }`.

  The existing handlers keep their behavior. They already refuse while `activeSync` is set, and
  `/status` now also shows scheduled runs.

**`src/api/strfry/negentropyPresets.js` (new)**
- **Storage.**
  - `PRESETS_PATH = process.env.NEGENTROPY_PRESETS_PATH || '/var/lib/brainstorm/negentropy-presets.json'`,
    with the shape `{ version: 1, presets: [ … ] }`.
  - Each preset:
    `{ id, name, relay, dir, filter: { kinds?, authors?, '#x'? }, enabled, createdAt, updatedAt, lastRun?, lastSuccessAt? }`.
  - `id` is `crypto.randomUUID()`. Names are unique, case-insensitive.
  - Write to a temp file and rename (strfry doesn't watch this file).
  - All read-modify-write happens under an in-module promise-chain lock (as in routerConfig).
- **`validatePreset(input)` (pure, exported)** returns `{ ok, preset?, errors[] }`:
  - `name` is trimmed, 1–80 characters.
  - `relay` must pass `relayUrlProblem` (exported by routerConfig, PR #787).
  - `dir` is `down`, `up` or `both`; the default is `down`.
  - `kinds` are integers 0–65535, deduplicated.
  - `authors` are 64-character lowercase hex.
  - Tag keys match `^#[a-zA-Z]$` and hold non-empty strings of at most 512 characters. `#p`,
    `#P`, `#e` and `#E` values must be 64-character hex.
  - `since`, `until`, `limit`, `ids` and unknown keys are dropped.
  - **Floor (AC-2):** a preset is refused unless it has kinds, authors or a tag key, with the
    error
    `A preset must narrow what it syncs: add event kinds, authors or a tag filter.`
- **`windowSince(preset, nowSec)` (pure, exported):**
  `(preset.lastSuccessAt ? preset.lastSuccessAt - 3600 : nowSec - 7*86400)`, floored at 0.
- **`parseSyncOutput(text, exitCode)` (pure, exported)** returns
  `{ ok, have, need, up, down, added, error }`:
  - It reads the four lines above.
  - `ok` is true only when `exitCode === 0` and the `Set reconcile complete` line is present.
  - Otherwise `error` is the last line containing `error` or `ERR|`, with the log prefix
    stripped, falling back to `strfry sync exited with code <n>`. *(Amendment 2 adds relay
    NOTICE/CLOSED lines and a stop argument.)*
- **Runner `runEnabledPresets()`:**
  - A module flag refuses a second concurrent run, returning `{ alreadyRunning: true }`.
  - It snapshots the switched-on presets. *(Amendment 2: each is re-read just before it syncs,
    and doesn't sync if it was deleted or switched off meanwhile.)*
  - For each preset, in name order, it:
    - takes `since = windowSince(...)`;
    - waits for the shared slot (`isSyncActive()` polled every 5 s, for up to 10 min, else
      records it as skipped);
    - calls `runStrfrySync(preset.relay, preset.dir, { ...preset.filter, since }, …)`;
    - parses the output;
    - under the lock, writes
      `lastRun = { startedAt, finishedAt, since, ok, added, sent: up, error?, skipped? }`, and on
      `ok` sets `lastSuccessAt = startedAt` (the run's start, so events published during the
      run fall inside the next window). A preset deleted mid-run is dropped silently.
  - It returns
    `{ success: true, results: [{ id, name, ok, added, sent, error, skipped }], failed: <count> }`.
- **Handlers, registered by `registerNegentropyPresetRoutes(app)`:**
  - `GET /api/strfry/negentropy-presets` returns `{ success, presets, running }`, readable by
    any signed-in user, like the other negentropy reads. *(Corrected after review round 1,
    finding 5: readable by anyone who can reach the API, signed in or not, the same as
    `/negentropy-sync/status` and the router-config GET. Relay URLs, filters and last-run
    errors are therefore public; a relay URL carrying a token in its query string would be
    exposed.)*
  - `POST /api/strfry/negentropy-presets` with `{ name, relay, dir, filter, enabled? }` creates
    a preset, or replaces the one with the same name; replacing keeps its id, `enabled`,
    `lastRun` and `lastSuccessAt` unless the relay, direction or filter changed, in which case
    `lastSuccessAt` is cleared. A new preset starts **off**.
  - `POST …/toggle` takes `{ id, enabled }`. `POST …/delete` takes `{ id }`.
  - `POST …/run` returns the runner's result, with HTTP 409 for `alreadyRunning`.
  - Every POST calls `requireOwnerOrLocal` first (the same gate as routerConfig; reuse it, don't
    copy it).
  - Validation errors return 400 `{ success: false, error }`.
- Register the routes in `src/api/index.js` next to `registerNegentropySyncRoutes` (:472–473).

**`src/manage/negentropySync/syncPresets.sh` (new; pattern of `refreshApplicabilityLists.sh`)**
- It emits `TASK_START`, then calls
  `curl -s -m 21600 -X POST http://127.0.0.1:${CONTROL_PANEL_PORT:-7778}/api/strfry/negentropy-presets/run`.
- It parses the JSON with `node -e` (no `jq` dependency assumed) and exits:
  - 0 when the run succeeded and `failed === 0`;
  - 0 when the result is `alreadyRunning`, emitting a `WARN` with that reason;
  - 1 otherwise: an empty response, a non-2xx status, or any preset failed.
- It always emits `TASK_END` with `failure` set to match.

**`src/manage/taskQueue/taskRegistry.json`**
- Add the task `syncNegentropyPresets`:
  - name `Sync Negentropy Presets`;
  - categories `["network"]`;
  - script `$BRAINSTORM_MODULE_SRC_DIR/manage/negentropySync/syncPresets.sh`, with matching
    `scripts` and `script_relative_path`;
  - `arguments: false`, `scope: "system"`, `priority: "normal"`, `frequency: "periodic"`,
    `status: "active"`, `structuredLogging: true`;
  - a description naming this ADR;
  - `suggestedIntervalHours: 6`;
  - `options.completion.failure.timeout` of `{ "duration": 21600000, "forceKill": true }`
    (6 hours, matching the script's curl `-m`). *(Added by Amendment 1.)*
- Add a log-file mapping where the registry maps other sync tasks.

**`src/api/scheduled-tasks/index.js`**
- Add a disabled seed to `freshInstallEntries`:
  `{ id: 'seed:syncNegentropyPresets', taskId: 'syncNegentropyPresets', enabled: false, intervalDays: 0, intervalHours: 6, intervalMinutes: 0, cron: '' }`.
- `filterSchedulableTasks` passes through `suggestedIntervalHours`, when it's a positive integer.

**`ui/src/pages/settings/scheduledTasks/AddOrEditEntryModal.jsx`**
- When a **new** entry selects a task with `suggestedIntervalHours`, pre-fill days 0, hours N,
  minutes 0. Editing is unchanged.

**`ui/src/pages/settings/RelaySettings.jsx`, `NegentropySync`**
- **"Save as preset"**: a name input and a button below the form. The button is disabled until
  the relay is valid and the AC-2 floor is met, with the floor message shown inline. Saving
  under an existing name asks `Replace preset "<name>"?`. Server errors are shown as returned.
- **"Saved presets" list**, each row showing:
  - name, relay, direction, filter summary (kinds; author count; `#x: values`);
  - a `ToggleSwitch`, plus **Load** (fills relay, direction, kinds, authors and tag filters,
    and clears Since/Until) and **Delete** (with a confirm);
  - a last-run line: `Not run yet`, `Last run <time>: ✓ <added> in, <sent> out`,
    `✗ <error>`, or `skipped: <reason>`.
- **Explainer:** `Switched-on presets run with the "Sync Negentropy Presets" task in Scheduled
  Tasks (off until you turn it on). Each run covers events since that preset's last successful
  run, less an hour; the first run covers the last 7 days. Load a preset and press Start for a
  one-off full sync.`
- **Status line:** while a scheduled preset holds the slot, the existing status line shows
  `Scheduled preset "<name>" is syncing…`.

**Docs**
- BIBLE API table (`BIBLE.md:533` area): add rows for the five endpoints.
- `docs/CONFIGURATION.md` file table (`:172` area): a row for
  `/var/lib/brainstorm/negentropy-presets.json`.

**Tests (Phase 3, Tester's lane, listed so they aren't missed)**
- Stack-free, with `spawn` stubbed to emit Evidence-shaped stderr:
  - `validatePreset`: the floor, hex checks, dropped keys, name rules;
  - `windowSince`;
  - `parseSyncOutput`: success, up/down/both, unreachable, exit≠0 with no reconcile line;
  - the runner: order; failures isolated; skipped when the slot is busy, with a shortened wait
    via time dilation like the round-2 suite; `alreadyRunning`; `lastSuccessAt` set only on
    success and set to the start time; a preset deleted mid-run;
  - the handlers' owner gate, before any write;
  - the seed and registry hint;
  - the modal pre-fill (source-level);
  - the tab's wording (source-level, house style).
- AC-5 is the staging verification step.

## Amendment 1 (2026-10-09): the task's timeout matches the run's length

The Tester found a gap at Test Design (test plan § "One gap for the Architect"). The registry
entry above set no `options`. The scheduler runs every task through `launchChildTask.sh`
(`src/manage/taskQueue/queue/processor.js`, the same way as `runTask.js`). A task without
options gets the registry's `options_default.completion.failure.timeout` of 30 minutes with
`forceKill: true` (`taskRegistry.json:40`, enforced at `launchChildTask.sh:370–403`).

A presets run can legitimately take longer than that. Each preset can wait up to about 10 minutes
for a manual sync to finish, then sync for up to 10 minutes. With two or three slow presets the
script would be killed while the control panel carried on with the run, and the panel's history
would show a timeout for a run that went fine. The script's 6-hour curl only matters if the
task's own timeout is at least as long.

**Changed design.** The `syncNegentropyPresets` registry entry carries
`"options": { "completion": { "failure": { "timeout": { "duration": 21600000, "forceKill": true } } } }`:
6 hours, the same as the script's `curl -m 21600`, in the shape `syncWoT` and
`reconcileRecent` use. `forceKill` stays true: a script still running at 6 hours is stuck,
and killing it frees the panel's slot. The decision (Option A) is unchanged. The test plan adds
T10 for this.

## Amendment 2 (2026-10-09): a relay that refuses negentropy is stopped within a minute and named; a preset switched off or deleted mid-run doesn't sync

The review of story 3 (`engineering-team/reviews/relay-stream-gaps/3-scheduled-negentropy-sync-presets.md`)
passed with eight non-blocking findings. Before the PR, the owner chose to fix findings 1 and 3,
and this amendment designs both. The decision (Option A) is unchanged. Findings 2 and 4–8 are
filed elsewhere and are not part of it.

### Finding 1: a relay without negentropy

**Facts** (strfry 1.1.0 source; Verified evidence 7–14 below):
- **How `strfry sync` handles relay messages** (`src/apps/mesh/cmd_sync.cpp`):
  - NEG-MSG, OK, EVENT and EOSE drive the sync.
  - NEG-ERR logs `ERR| Got NEG-ERR response from relay: …` and exits 1 (:257–259). The current
    rule already records it.
  - Every other message, NOTICE and CLOSED included, gets one
    `WARN| Unexpected message from relay: <json>` line and changes nothing (:260–261).
  - So when that message was the relay refusing the request, strfry waits for an answer that
    never comes, until the 10-minute kill.
- **A strfry relay refuses `NEG-*` messages with a NOTICE, not NEG-ERR.** Each NOTICE text
  starts `ERROR: ` (`RelayServer.h:249–255`):
  - `bad msg: negentropy disabled` when negentropy is off (`RelayIngester.cpp:71`, sent at
    `:88`);
  - `bad msg: unknown cmd` from a relay that predates NIP-77 (`:79`);
  - `negentropy error: …` (`:76`);
  - `too many concurrent …` (`RelayNegentropy.cpp:218–227`).

  Its CLOSED has the same form (`RelayServer.h:257–263`). A relay that requires NIP-42 auth may
  answer with CLOSED `auth-required: …`.
- **strfry is silent while it reconciles, and after a refusal.** In Evidence 13 nothing followed
  the NOTICE for 75 s.
- **A sync can succeed after a NOTICE.** A notice sent on connect, or one in the middle of the
  download, was followed by the reconcile line, DOWN batches and exit 0 (Evidence 7, 8). A
  NOTICE alone does not mean failure.
- **The current rule picks the wrong line.** On the refused outputs, the current match rule
  records `Redis error: Connection refused`, an unprefixed line this patched build prints at
  startup (Evidence 14). The relay's line has no lowercase `error`. In a scheduled run the
  10-minute text replaces it anyway.

**Changed design.**

1. **What ends a sync early: a relay NOTICE or CLOSED, then 60 s with no other line from
   strfry.**
   - **`relayMessageOf(line)`** is a new pure export of `negentropySync.js`. It returns the
     relay's text when a line contains `Unexpected message from relay: ` followed by a JSON
     array whose first element is:
     - `"NOTICE"`: the text is element 1;
     - `"CLOSED"`: the text is element 2.

     It returns `null` for every other line, including AUTH and other unexpected message types,
     NEG-ERR, and strfry's own lines. If the array doesn't parse, or the element isn't a
     string, it returns the raw text after `relay: `. Text longer than 300 characters comes back
     as its first 300 characters followed by `…`. The text is the relay's, and the cap keeps a
     long notice out of the presets file.
   - **`runStrfrySync` takes a new option, `stallMs`** (default `null`, off). When it is set:
     - it reads complete lines, keeping a partial last line of each stream until its newline
       arrives;
     - a line for which `relayMessageOf` is non-null starts a `stallMs` timer, unless one is
       already running, so a relay repeating notices can't keep a dead sync alive;
     - any other line cancels the timer, because strfry is making progress (Evidence 7–8);
     - when the timer fires, it kills strfry with SIGTERM, as the 10-minute kill does;
     - only the first of the two stops is reported, and the other timer is cleared;
     - it resolves `{ exitCode, output, timedOut, stalled }`, where `stalled` is true only when
       the stall timer killed strfry.
   - **The runner passes `stallMs: RELAY_STALL_MS`**, a new constant of 60 000 ms in
     `negentropyPresets.js`.
   - **How soon.** A relay that refuses negentropy now holds the shared slot for about 60 s per
     run, not 10 minutes. A manual Start is refused for about a minute.
   - **Why 60 s.**
     - The one risk is a relay that sends an unrelated notice and then takes more than 60 s to
       finish the reconcile, which prints nothing. *(Widened after review round 2, R2-4: any
       silence over 60 s after a notice qualifies, for example a rate-limit notice followed by
       a held download or upload batch. Watch for it on staging.)*
     - A preset sync is windowed (product decision 1), so its reconcile normally takes seconds.
       In Evidence 7–8 it took under 0.1 s.
     - A wrong stop is recorded with the relay's words and doesn't advance `lastSuccessAt`, so
       the next run retries the same window.
     - Load + Start, which has no stall rule, remains the operator's fallback.

2. **What is recorded.** `parseSyncOutput(text, exitCode, stop)` takes an optional third
   argument: `'stalled'`, `'timeout'`, or absent. The runner passes runStrfrySync's
   `stalled`/`timedOut` through it and drops the timeout override at `negentropyPresets.js:226`,
   so all the error text comes from this one pure function.
   - **Error candidates**, in output order:
     - the existing ones: lines containing lowercase `error` or `ERR|`, recorded as the message
       without the log prefix;
     - new: relay NOTICE and CLOSED lines, recorded as `relay said "<text>"`, with `<text>` from
       `relayMessageOf`. A line that is both (a notice whose text contains `error`) is recorded
       in this form.
   - **The cause** is the last candidate, as now.
   - **`error`, when not `ok`:**

     | Stop | Cause found | `error` |
     |---|---|---|
     | none | yes | the cause (as now) |
     | none | no | the exit-code fallbacks (as now) |
     | `'stalled'` | yes | `<cause>; nothing followed for 60 s, so strfry sync was stopped` |
     | `'stalled'` | no | `strfry sync made no progress for 60 s and was stopped` (defensive; a stall always has a cause) |
     | `'timeout'` | yes | `<cause>; strfry sync did not finish within 10 minutes and was stopped` |
     | `'timeout'` | no | `strfry sync did not finish within 10 minutes and was stopped` (as now) |

   - **The review's relay** reads
     `relay said "ERROR: bad msg: negentropy disabled"; nothing followed for 60 s, so strfry sync was stopped`.
     The tab shows it as `✗ <error>`, unchanged. The operator can tell this case apart from:
     - an unreachable relay: `Websocket connection error`;
     - a sync that ran out of time: `strfry sync did not finish within 10 minutes and was stopped`;
     - a relay's NEG-ERR: `Got NEG-ERR response from relay: […]`, unchanged.
   - `ok`, the counts and the return shape are unchanged.

3. **The one-shot Start path stays as it is.**
   - **How it is untouched.** The one-shot handlers (`handleNegentropySync`,
     `handleNegentropySyncStream`) spawn strfry themselves. They share the slot and
     `buildCommand` with the runner, but not `runStrfrySync`, and `stallMs` is opt-in.
   - **Why it stays:**
     - The operator running a one-shot sees the relay's NOTICE in the live output as it
       arrives. A scheduled run has no one watching, which is why its reason must be recorded.
     - The one-shot is the full sync with no window (§ Consequences). A long, silent reconcile,
       the stall rule's one risk, is likeliest there.
     - It is pre-existing behavior outside the story, guarded by G1 and the relay-management
       suites. The one-shot's scope already has a ledger row
       (`2026-10-09-negentropy-sync-access-scope`).
   - **What remains.** A one-shot against such a relay still holds the slot for 10 minutes.
     That is a candidate follow-up, not part of this amendment.

4. **`lastRun` keeps no output tail.**
   - The line that explains a failure is now in `error`.
   - A tail would add relay-controlled text to the presets file on every run.
   - While a preset syncs, `/status`'s `recentLines` already shows the live output.
   - The per-preset log line (`:235`) is unchanged and carries the new `error`.

**Not changed:**
- **A relay that ignores the negentropy request** (Evidence 12) still costs 10 minutes and reads
  `strfry sync did not finish within 10 minutes and was stopped`. strfry prints nothing that
  tells it apart from a slow sync, so there is nothing to record.
- **NEG-ERR handling.**

### Finding 3: a preset switched off or deleted while the run goes on

**Changed design.** The snapshot at the start of the run still fixes which presets the run
considers and their order (name order). Each one is re-read from the store, by id, whenever the
runner is about to act on it.

1. **When.**
   - **Where it re-reads.** `syncInSlot` re-reads at every check of the slot:
     - on each 5-s poll while it waits for a manual sync;
     - in the same synchronous step that takes the slot.
   - **Nothing can come between.** `loadStore` is synchronous, so nothing runs between the
     re-read, `isSyncActive()` and `runStrfrySync` taking the slot.
   - **An answered switch-off or delete is always seen**, because both handlers write before
     they answer.
   - **The lock.** The re-read doesn't take the lock: saves replace the file by rename, so a
     read never sees half a file. The lock rule is unchanged; it is never held across the wait
     or the sync.
2. **Withdrawn.** The preset is withdrawn when the stored record is gone, or its `enabled` is
   not `true`. Then:
   - the wait ends at once, and the preset is not synced;
   - nothing is written to its record, so its last-run line keeps its previous result;
   - it is left out of `results` and not counted in `failed`;
   - one line is logged:
     `[negentropy-presets] "<name>": not run, switched off or deleted since the run began`.

   That is how a preset that was off when the run began is treated. A preset withdrawn as its
   wait for a manual sync runs out is withdrawn too, not recorded as skipped.
3. **Re-saved.** If the stored preset is still on, the runner uses the **re-read** record: its
   relay, direction, filter, name and `lastSuccessAt`.
   - A preset re-saved before its turn runs with the new target.
   - A changed target has cleared `lastSuccessAt` (the replace rule), so its window is the
     first run's 7 days.
   - `since` is `windowSince(current, startedAt)`. `startedAt` is still the start of the
     preset's turn, so test plan choice 2 holds: no later than the strfry start.
   - The record step's `sameTarget` compares the stored preset with the one that ran.
4. **Unreadable store at the re-check.** If the re-read throws (a corrupt or unreadable file):
   - the preset is not synced. This fails closed: an `up` sync is not run when the owner's
     wish can't be confirmed.
   - it goes in `results` as failed, with `error: 'Could not read the presets: <message>'`,
     and is counted in `failed`;
   - its record can't be written, as now (`:248–250`).
5. **Unchanged.**
   - A preset switched off or deleted **during its own sync** isn't stopped; the sync
     finishes. A deleted one isn't written back (R10). A switched-off one is recorded normally.
   - A preset switched on mid-run waits for the next run.
   - **The review's related note** stays as it is: a preset re-saved with another target during
     its own sync gets that sync's `lastRun`.
     - That `lastRun` really is the preset's latest run.
     - A replace already keeps `lastRun` across a target change, by design (Implementation
       notes, the save `POST`). The row would show an old-target result either way.
     - `lastSuccessAt` is still not set (the Implementer's deviation), so the next run covers
       the new target's 7 days.
     - Re-saves before the preset's turn, the common case, now run and record the new target
       (item 3).

### Options considered for this amendment

**Finding 1:**
- **A (chosen): stop after a relay notice and 60 s of silence, and record the relay's words.**
- **B: stop as soon as a NOTICE or CLOSED arrives, or when its text matches known refusals**
  (`negentropy`, `unknown cmd`, `auth-required`). Rejected:
  - Evidence 7–8 are syncs that succeed after a NOTICE.
  - Refusal wording differs between relay implementations.
  - B saves a minute but gets wrong cases that A gets right.
- **C: wording only.** Keep the 10-minute kill and join the relay's words to the timeout text.
  Rejected as the whole fix: it leaves the main cost, the slot held 10 minutes per run per such
  preset, with manual Starts refused. Its wording is part of A (the `'timeout'` row).

**Finding 3:**
- **A (chosen): re-read at every slot check, and run the current record.**
- **B: re-read once, at the preset's turn, before the wait.** Rejected: it misses a switch-off
  during the wait of up to 10 minutes for a manual sync, one of the two windows the review
  names.
- **C: also kill a running sync when its preset is switched off or deleted.** Rejected for this
  round:
  - it goes beyond the finding, which is about queued presets;
  - it couples the toggle and delete handlers to the runner;
  - a running sync is already bounded by the 10-minute kill and, now, the stall rule.
- **D: record a withdrawn preset as `skipped` in `lastRun`.** Rejected: it would overwrite the
  preset's last real result with a run that didn't happen. A preset that was off when the run
  began gets no such record.

### Consequences of this amendment

- **A negentropy-less relay costs about a minute**, not ten, per scheduled run, and its last-run
  line names the relay's reason.
- **A wrong stop needs two things**: a relay that sends an unrelated notice and then reconciles
  silently for more than 60 s (or, per R2-4, goes silent for that long for any reason, such as
  a held batch after a rate-limit notice). It shows the relay's words, doesn't advance the window, and the
  next run retries.
- **Switching a preset off, or deleting it, takes effect within the current run** for any
  preset not yet syncing, including an `up` or `both` upload.
- **The presets file is read every 5 s while a preset waits for the slot**: up to 120 reads in
  10 minutes, which is negligible.
- **No UI, route, registry, script or doc change.** The tab shows `error` as returned, and the
  BIBLE rows and the explainer still hold.
- **Firmware reinstall required?** No. No concepts change, and no TA pubkey is involved.

**Files:**
- `src/api/strfry/negentropySync.js`:
  - `relayMessageOf` (new export);
  - `runStrfrySync`'s `stallMs` option, line buffering and `stalled` flag.

  The one-shot handlers are untouched.
- `src/api/strfry/negentropyPresets.js`:
  - `RELAY_STALL_MS`;
  - `parseSyncOutput`'s third argument and new candidates;
  - the re-read and withdrawal in `syncInSlot`/`runPreset`;
  - the `:226` override removed.

### Test plan changes (Phase 3, Tester's lane)

**Choices that change:**
- **Choice 1 (seams):** `negentropyPresets.js` also imports `relayMessageOf` from
  `negentropySync.js`.
- **Choice 4 (lock scope):**
  - The re-read happens without the lock.
  - A preset withdrawn **before** its strfry start is left out of `results` (now pinned).
  - Whether a preset deleted **during** its own sync appears in `results` stays open.
- **Choice 5 (waiting for the slot):** the wait ends early, within one poll, when the preset is
  withdrawn. A withdrawn preset is never recorded `skipped`.
- **Choice 6 (`runStrfrySync`):**
  - add `stallMs` (opt-in, default off);
  - the resolve gains `stalled`;
  - the stall timer works as in Finding 1, item 1, and only the first stop is reported.

  N2's `{ exitCode, output }` stays true, since the new field is additive.
- **Choice 7 (`parseSyncOutput`):**
  - the candidates add relay NOTICE and CLOSED lines, as `relay said "<text>"`;
  - it takes the third argument, with the table above; the table's texts are exact.

  O5–O8 stay valid as written: their fixtures have no relay lines and no stop argument.
- **Edge cases:** "A toggle of a preset while it's mid-run" and "A relay that doesn't support
  negentropy" are now covered by the statements below. The second is now stack-free, using
  stderr from Evidence 7–14.

**Existing tests:** none needs to change.
- R11's hung strfry prints nothing, so it still runs to the 10-minute kill.
- R8's preset stays on, so it is still skipped.
- R10 deletes a preset during its own sync, after the re-check.

**New behaviors, as testable statements:**

Finding 1:
1. `relayMessageOf`:
   - Evidence 10's WARN line, with its loguru prefix → `ERROR: bad msg: negentropy disabled`;
   - Evidence 9's CLOSED line → element 2, `auth-required: sign in to sync`;
   - `null` for an AUTH line, a NEG-ERR line, a `Websocket connection error` line and a
     `Redis error: …` line;
   - text over 300 characters → its first 300 characters followed by `…`.
2. `parseSyncOutput(<Evidence 10's output>, null, 'stalled').error` is
   `relay said "ERROR: bad msg: negentropy disabled"; nothing followed for 60 s, so strfry sync was stopped`,
   even with the earlier `Redis error: Connection refused` line in the output.
3. `parseSyncOutput(<Evidence 11's output>, 1).error` is
   `relay said "ERROR: bad msg: negentropy disabled"`.
4. With `'timeout'`:
   - and a relay line: `relay said "<text>"; strfry sync did not finish within 10 minutes and was stopped`;
   - and no candidate: exactly `strfry sync did not finish within 10 minutes and was stopped`.
5. A harmless NOTICE followed by a successful sync (Evidence 7, 8) parses as `ok: true`, with
   `error` falsy and the same counts.
6. The last candidate wins:
   - a NOTICE line followed later by an `ERR|` line records the `ERR|` message;
   - an `ERR|` line followed by a NOTICE line records `relay said "…"`.
7. `runStrfrySync` with `stallMs`, when strfry prints a NOTICE line and then nothing:
   - it kills strfry (SIGTERM) after `stallMs` (time-dilated);
   - it resolves `stalled: true, timedOut: false`;
   - it frees the slot.
8. `runStrfrySync` with `stallMs`, when a NOTICE line is followed by any other line:
   - strfry is not killed at `stallMs`;
   - if it then hangs, it is killed at `timeoutMs` with `timedOut: true, stalled: false`.
9. `runStrfrySync` with `stallMs`: repeated NOTICE lines don't push the stop back; it fires
   `stallMs` after the first.
10. Without `stallMs`, a NOTICE then silence runs to the 10-minute kill, as today. The one-shot
    handlers are unchanged (G1, N2).
11. The runner, for a preset whose strfry prints Evidence 10's output and then hangs:
    - it is stopped after about 60 s (dilated), not 10 minutes;
    - its `lastRun.error` is statement 2's text;
    - it counts in `failed`;
    - its earlier `lastSuccessAt` is kept;
    - the next preset runs.

Finding 3:

12. A preset switched off while an earlier preset syncs:
    - is not synced (no spawn for its relay);
    - keeps its stored record, `lastRun` included, exactly as the switch-off left it;
    - is absent from `results`, and `failed` doesn't count it.
13. The same for a preset deleted while an earlier preset syncs, and it stays deleted.
14. A preset switched off while it waits for a manual sync:
    - stops waiting within one poll;
    - is not synced and not recorded `skipped`;
    - the run ends without waiting out the 10 minutes (time-dilated).
15. A preset re-saved with another relay while an earlier preset syncs:
    - is synced with the new relay;
    - with `since` = `startedAt` − 7 days;
    - and its `lastRun` records that run.
16. A preset whose stored record can't be read at the re-check:
    - is not synced;
    - is in `results` with `ok: false` and an error starting `Could not read the presets:`;
    - counts in `failed`.
17. A preset switched off during its own sync is not killed, and its run is recorded normally.

## Verified evidence (2026-10-09, sandbox; strfry 1.1.0 build from ADR 0001/0002)

Two strfry stores, an upstream relay on `127.0.0.1:7801` and a local DB. `strfry sync` run as
`buildCommand` builds it:

1. **Down, kinds `[1]`, local empty, upstream 12.** `Filter matches 0 events` →
   `Set reconcile complete. Have 0 need 12` → `DOWN: 12 events (0 remaining)` →
   `Writer: added: 12 dups: 0 …`, exit 0. All lines on **stderr**; stdout empty.
2. **The same sync again.** `Have 0 need 0`, `Writer: added: 0 …`, exit 0.
3. **Up, with 3 local-only events.** `Have 3 need 0` → `UP: 3 events (0 remaining)`, exit 0;
   upstream gained 3.
4. **A `since` window.** Five events created 2 days ago were added upstream. With
   `since = now−1h`: `Have 0 need 0`, none fetched. With `since = now−3d`: `need 5`, `DOWN: 5`,
   `added: 5`. A window excludes events backdated before it.
5. **No `--dir` means both** (strfry's default): `Have 2 need 0` → `UP: 2 …`.
6. **Unreachable relay.** `Websocket connection error`, `Writer: added: 0 …`, exit 1.

## Verified evidence 7–14 (2026-10-09, Amendment 2; the review's strfry 1.1.0 build, re-run by the Architect)

**Setup:**
- an upstream strfry relay with 130 kind-1 events, negentropy on, at `127.0.0.1:7821`;
- a fresh local DB for each case;
- a small Node relay that answers `NEG-OPEN` as each case says, or forwards to the upstream after
  sending its own notice.

Each case ran `strfry sync ws://… --filter '{"kinds":[1]}' --dir down`, as `buildCommand` builds
it, under `timeout`.

7. **A NOTICE on connect, then a normal relay.**
   - `WARN| Unexpected message from relay: ["NOTICE","welcome: this relay keeps logs for 30 days"]`;
   - 9 ms later, `Set reconcile complete. Have 0 need 130`;
   - `DOWN: 50 / 50 / 30`, then `Writer: added: 130`;
   - exit 0 after 0.13 s.
8. **A NOTICE mid-download.**
   - `Set reconcile complete …`, then `DOWN: 50 …`;
   - `WARN| … ["NOTICE","rate-limited: slow down a little"]`;
   - `DOWN: 50`, `DOWN: 30`, `Writer: added: 130`;
   - exit 0.
9. **A CLOSED in answer to NEG-OPEN.**
   `WARN| Unexpected message from relay: ["CLOSED","N","auth-required: sign in to sync"]`, then
   nothing; killed by `timeout` at 8 s (exit 124).
10. **A relay with negentropy off.** This re-runs the review's probe C: a strfry relay with
    `relay.negentropy.enabled = false`.
    - `WARN| Unexpected message from relay: ["NOTICE","ERROR: bad msg: negentropy disabled"]`
      arrived 1 ms after `Connected`, and nothing followed.
    - The pre-NIP-77 wording, `["NOTICE","ERROR: bad msg: unknown cmd"]`, behaves the same.
11. **The same NOTICE, then the relay closes the socket after 1 s.**
    `INFO| Disconnected from ws://127.0.0.1:7837 : 0/-` (`WSConnection.h:96`), then
    `Writer: added: 0 …`; exit 1 at 1.09 s (`cmd_sync.cpp:153–155`).
12. **A relay that ignores NEG-OPEN.** No line after `Connected`; killed at 8 s (exit 124).
13. **The silence lasts.** Case 10 was run against a real strfry relay with negentropy off and
    left for 75 s. No line followed the NOTICE until the kill (exit 124 at 75.0 s). The relay's
    55-s websocket pings print nothing on the client.
14. **The current rule on these outputs.**
    - The current `parseSyncOutput` gives `error: "Redis error: Connection refused"` for
      case 10 (exit `null`), 11 (exit 1) and 9 (exit `null`). That is an unprefixed line this
      patched build prints at startup when Redis is absent. The relay's line has no lowercase
      `error`.
    - A NEG-ERR, `["NEG-ERR","N","blocked: too many records"]`, exits 1 at once with
      `ERR| Got NEG-ERR response from relay: …`, which the current rule already records.

## Out of scope

- Per-preset schedules; a "run now" button for the whole task (the panel's own controls and
  the one-shot Start cover manual runs).
- Changing the one-shot endpoint's access or its checks; the fixed `syncWoT`/`syncProfiles`
  tasks.
- Shipping starter presets; sharing presets between instances.
- Catching backdated events outside the window.
