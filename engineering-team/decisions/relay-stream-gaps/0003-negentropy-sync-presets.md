# ADR 0003: Negentropy-sync presets, run by one scheduled task through the control panel

**Status:** Proposed
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
  (`src/middleware/auth.js:369–379`).

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
  ("a manual sync was running").
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
  - collects stdout and stderr, with the same 10-minute kill;
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
    stripped, falling back to `strfry sync exited with code <n>`.
- **Runner `runEnabledPresets()`:**
  - A module flag refuses a second concurrent run, returning `{ alreadyRunning: true }`.
  - It snapshots the switched-on presets.
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
    any signed-in user, like the other negentropy reads.
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
  - `suggestedIntervalHours: 6`.
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

## Out of scope

- Per-preset schedules; a "run now" button for the whole task (the panel's own controls and
  the one-shot Start cover manual runs).
- Changing the one-shot endpoint's access or its checks; the fixed `syncWoT`/`syncProfiles`
  tasks.
- Shipping starter presets; sharing presets between instances.
- Catching backdated events outside the window.
