# ADR 0001: Apply stream changes by in-place config reload, confirmed from the router's log

**Status:** Proposed
**Date:** 2026-10-09
**Story:** `engineering-team/stories/relay-stream-gaps/1-stream-changes-without-router-restart.md`

## Context

The story's acceptance criteria, restated:

- **AC-1:** toggling one stream doesn't restart the router (uptime keeps counting). The other
  enabled streams stay connected. The toggled stream starts or stops within 10 s.
- **AC-2:** the same for saves (add, edit, delete, import a preset) and Restore Defaults. Only
  changed streams reconnect. Within 10 s the running streams match what the tab shows.
- **AC-3:** if the router doesn't take up a change, the operator sees it didn't take effect.
  Success is not reported, and the router keeps the streams it had.
- **AC-4:** the Restart button still restarts the router. No wording on the tab says that stream
  changes restart the router.
- **AC-5:** after a deploy or container restart, the router comes back with the saved streams.

**Today.** Every mutation in `src/api/strfry/routerConfig.js` follows the same path:
`saveState(state)` then `applyConfig(state)`. That covers `handleToggleStream` (:317–343),
`handleUpdateRouterConfig` (:245–310) and `handleRestoreDefaults` (:404–438).
`applyConfig` (:226–236) writes `/etc/strfry-router-tapestry.config` with `fs.writeFileSync`,
then runs `supervisorctl restart strfry-router`. The restart disconnects every stream.
`initRouter` (:445–455) runs once at control-panel startup. It writes the same file and does
**not** restart.

**What strfry does with the file** (strfry 1.1.0, `src/apps/mesh/cmd_router.cpp`, read at the
tag; the version is `STRFRY_REF=1.1.0` in `Dockerfile:26`):

- `run()` watches the config path with `hoytech::file_change_monitor`. The copy pinned by strfry
  1.1.0 (golpe `665df82` → hoytech-cpp `2324c80`, `hoytech/file_change_monitor.h`) adds an
  inotify watch with `IN_MODIFY` only, on the file's inode, and fires 50 ms after the first
  event. There's no re-watch: replacing the file (temp + rename) ends reloads silently until
  the process restarts.
- Each fire runs `reconcileConfig()`, which first logs `Loading router config file: <path>`
  (INFO). It then calls `StreamGroup::configure(spec)` per stream. That reconnects a stream
  **only** when its `dir` or `filter` string changed, closes URLs dropped from `urls`, and
  connects URLs added to it. It creates stream groups new to the file and erases groups
  missing from it; erasing a group closes its sockets. Streams that didn't change keep their
  sockets.
- If parsing fails after a successful first load, it logs `Failed to parse router config:
  <reason>` (ERROR) and **keeps the running config**. Only a failure on the very first load
  exits the process.
- strfry logs through loguru to **stderr**. supervisord sends that to
  `/var/log/supervisor/strfry-router-error.log` (`docker/supervisord.conf:39`). Seen in the
  field: `_intake.md:50–52` and ADR relay-management/0002 § Verified evidence 1 and 4 show
  `New stream group` (INFO) and `ERR| Failed to parse router config: …` in that file. The
  control panel runs as root (`supervisord.conf:57`), so it can read it.

**Field evidence that reload works in the deployed image.** Every deploy already depends on it.
The router starts at supervisord priority 25 with the entrypoint's empty `streams { }`
(`docker/entrypoint.sh:255–262`). The control panel starts at priority 30 and `initRouter`
writes the real config without a restart. On 2026-10-09 staging's router had been up since
the 23:50:46 UTC deploy and was delivering on all checked streams: 38/38 live events in a
2-minute test, and all 32 dcosl tag events since 2026-10-07.

**Constraints.** JS without a build step, and no new dependencies. Router mutations stay
owner-gated (`requireOwnerOrLocal`, ADR security-auth-exposure 0001/0002). Filter and value
sanitization stays at ingress (ADR relay-management/0002 and the value hardening).
`generateConfig` output stays byte-identical (test R2). No concepts change; the stream's
counterparty `39998:<TA>:nostr-relay` appears only as plain URL strings. The stack was absent
this session, so the handle was not checked against a live graph; nothing here depends on
it.

## Options considered

### Option A: Write in place, confirm from the router's log, fall back to restart

`applyConfig` stops restarting a router that is running. It writes the file in place, then
reads the router's stderr log from the byte offset it had before the write:

- a `Loading router config file` line with no `Failed to parse router config` after it means
  the change was taken up. Report success.
- a `Failed to parse router config` line means the change was rejected. Restore the previous
  state and config, which is what the router is still running, and report the failure with
  strfry's reason (AC-3).
- no `Loading` line within the timeout means the router didn't notice: the watch is gone,
  the log is unreadable, or the router is stuck. Restart it, as today, and say so in the
  message. A router that isn't running is started by the same restart, as today.

Pros:
- Meets AC-1/AC-2 by construction, through strfry's own per-stream reconcile.
- AC-3 is met with a real signal.
- Every unknown falls back to today's behavior. The worst case is the status quo, never a
  silent "done".

Cons:
- Couples the control panel to two strfry log strings and one log path. Pinned to strfry
  1.1.0 and covered by tests; a strfry bump must re-check them, as it already must for the
  Redis patch set.
- Adds up to the timeout of latency, only on the fallback path.

### Option B: Write in place and report success without confirmation

Drop the `supervisorctl restart` and nothing else.

Pros: a one-line change, and it meets AC-1/AC-2 in the normal case.

Cons: fails AC-3. A rejected config, or a router that never noticed, is reported as
success while the router runs something else. Today a rejection at least surfaces as an
error. B would make it silent, a regression in honesty.

### Option C: Add an explicit reload acknowledgement to strfry

Extend the strfry patch set (`patches/strfry-redis/`) so the router writes a status file, or
answers on a control socket, after each `reconcileConfig`.

Pros: a structured signal, with no log scraping.

Cons: C++ changes and a rebuild for a signal the existing log already carries. It widens the
patch set beyond its current purpose. It is premature until the log signal proves
unreliable.

## Decision

We chose **Option A**. It is the only option that meets all five criteria without changing
strfry. Its failure modes reduce to today's behavior: restart, or a reported error. B is
rejected on AC-3. C is held in reserve: if a future strfry bump changes the log strings, C is
the replacement for the log reader, not a reason to drop confirmation.

## Consequences

- Toggles, saves and Restore Defaults no longer disconnect the streams they didn't change.
  Stream changes stop producing deploy-like holes.
- **New invariant: the router config is only ever rewritten in place.** Use
  `fs.writeFileSync(ROUTER_CONFIG_PATH, …)` on the existing path; never temp + rename, delete
  + create, or anything else that changes the inode. With the pinned file watcher, a replaced
  inode ends reloads silently (the fallback would then restart on every change). A code
  comment at the write site states this.
- **The success path depends on the strfry log.** The two strings
  (`Loading router config file`, `Failed to parse router config`) and the stderr log path are
  constants with a comment naming strfry 1.1.0. A strfry bump must re-verify them. If they
  drift, the fallback restarts on every change: today's behavior, not a silent failure.
- **A rejected change is rolled back** (state file and config file). The tab, the state file
  and the running router then agree. Rolling the config back fires one more reload of
  identical content, which strfry applies with no reconnects.
- **Mutations are serialized.** One router mutation runs at a time: read state, modify, save,
  write, confirm, and roll back if needed. That keeps rollback correct and log windows
  disjoint. Two concurrent toggles can no longer lose an update, a latent read-modify-write
  race that exists today.
- **Not changed:** the Restart button; `initRouter` and the entrypoint's empty-config fallback
  (AC-5, which already relies on reload); the owner gate; ingress validation; and
  `generateConfig` bytes.
- **Not fixed (out of scope, per the story):** deploy holes, upstream disconnects, and the
  router's live-only fetch. The other stories in this book cover those.
- **Firmware reinstall required?** No. No concept definitions change.

## Implementation notes

**`src/api/strfry/routerStatus.js`**
- Extract the `supervisorctl status strfry-router` parsing in `handleRouterStatus` (:26–45)
  into an exported `getRouterProcessStatus()`, which resolves `{ status, uptime?, detail? }`.
  `handleRouterStatus` calls it; its response is unchanged.

**`src/api/strfry/routerConfig.js`**
- New constants: `ROUTER_LOG_PATH = '/var/log/supervisor/strfry-router-error.log'`,
  `RELOAD_LOADED_MARK = 'Loading router config file'`,
  `RELOAD_FAILED_MARK = 'Failed to parse router config'`, `RELOAD_TIMEOUT_MS = 3000`,
  `RELOAD_POLL_MS = 100`, `RELOAD_SETTLE_MS = 300`. Add a comment block citing strfry 1.1.0
  `cmd_router.cpp` `reconcileConfig()` and the pinned file watcher, as in § Context.
- New pure function `classifyReloadLog(text)` → `{ loaded: boolean, error: string|null }`.
  It finds the first `RELOAD_LOADED_MARK` line in `text`. `error` is the remainder of the
  first `RELOAD_FAILED_MARK` line after it and before any later `Loading` line; otherwise
  `null`. With no `Loading` line, it returns `{ loaded: false, error: null }`. Export it.
- New `readLogSince(path, offset)` → `{ text, size }`. It `stat`s the file; if the size shrank
  (supervisord rotation), it reads from 0. It never throws: a missing or unreadable log returns
  `{ text: '', size: 0 }`, which ends in the timeout fallback.
- New `async waitForReload(offset)`. It polls `readLogSince` every `RELOAD_POLL_MS`. Once
  `loaded`, it waits `RELOAD_SETTLE_MS` more and re-classifies, so the failure line, written in
  the same `reconcileConfig` call, is caught. It resolves `'loaded'`, `{ rejected: reason }`, or
  `'timeout'` after `RELOAD_TIMEOUT_MS`.
- Rewrite `applyConfig(state)` → `async applyConfig(state, prev)`, which resolves
  `{ applied: 'reloaded' | 'restarted' }` or throws a `RouterRejectedError` carrying strfry's
  reason:
  1. `getRouterProcessStatus()`. If not `running`: write the config, then
     `supervisorctl restart strfry-router` (today's code path, unchanged). Return
     `'restarted'`.
  2. Note `offset` = the log file's current size (0 if absent). Write the config **in place**.
     `await waitForReload(offset)`.
  3. `'loaded'` → `'reloaded'`. `'timeout'` → restart as today, return `'restarted'`.
     `{ rejected }` → `saveState(prev)`, rewrite `generateConfig(prev.streams)` in place, and
     throw `RouterRejectedError(reason)`.
- New in-module serializer `withRouterLock(fn)`, a promise chain. Each mutating handler wraps
  its read-state → modify → `saveState` → `applyConfig(state, prev)` in it, with `prev` loaded
  inside the lock. `handleRestartRouter` and `initRouter` are not wrapped: the restart is
  idempotent, and `initRouter` runs before the server accepts requests.
- Handler responses: add `applied` to the JSON. Messages:
  - `handleUpdateRouterConfig`: `'Router config updated.'` when reloaded, or
    `'Router config updated; the router did not pick it up by itself, so it was restarted.'`
  - `handleToggleStream`: keep `Stream "<name>" enabled.` / `disabled.` and append the same
    restart clause on `'restarted'`.
  - `handleRestoreDefaults`: keep its message, same clause.
  - On `RouterRejectedError`: HTTP 500,
    `{ success: false, error: 'The router rejected the new configuration (<reason>). It is still running the previous streams; nothing was changed.' }`.
- Leave `handleRestartRouter`, `initRouter`, `generateConfig`, the sanitizers and the owner gate
  untouched.

**`ui/src/pages/settings/RelaySettings.jsx`**
- `handleDeleteStream` (:340): the confirm becomes `Delete stream "${name}"?` (drop "This will
  restart the router."). No other UI changes. The toggle, save and restore paths already show
  `d.message` on success and `d.error` on failure, and skip the status refetch on failure, so
  the switch stays in its pre-click position on a rejection.

**`BIBLE.md` §14 "Presets are opt-in cross-instance mirroring" (:1152–1154)**
- Add one sentence after "Toggle via …": changing streams rewrites the router config in place
  and strfry's router reloads it, reconnecting only the streams whose direction, filter or
  relays changed; the Restart button is the only path that restarts the router.

**Tests (Phase 3, Tester's lane, listed so they aren't missed)**
- `test/router-stream-tag-filters.test.js` R1 (:376–385) asserts the save path restarts via
  supervisorctl. This ADR reverses that contract, so the Tester re-aims R1 to the new one
  (save path writes in place, confirms, restarts only on fallback) rather than deleting it.
  The `supervisorctl restart strfry-router` substring still exists in `handleRestartRouter`,
  so R1 would keep passing by accident unless re-aimed.
- The existing stubs in `strfry-router-owner-gate` and `strfry-router-value-hardening`
  (`child_process.exec`, `fs.writeFileSync` interception) are the seam to extend. The log
  reader also needs a seam (`fs.statSync` / `fs.readFileSync` / `fs.openSync` for
  `ROUTER_LOG_PATH`, or a temp file via the exported pure functions).

## Out of scope

- Making the router fetch what it missed: the Limit story and the scheduled-sync story in this
  book.
- strfry changes, including Option C.
- The router's reconnect cadence after an upstream drop.
- Showing reload status or history in the UI beyond the existing flash and error messages.
