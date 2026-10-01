# ADR 0005: The real-time path's switch on the panel: owner or admin, a recorded change, and a server-computed starting window

**Status:** Accepted
**Date:** 2026-10-01
**Story:** `engineering-team/stories/tagging-edges/5-real-time-path-switch.md`

## Context

Story 5 puts the real-time path's switch on story 4's panel. The owner or an admin may use it, the server enforces
that, and the last change wins. Six criteria:
- **AC-1:** the control, with the 15 s no-answer limit and the warning beside "Turn on".
- **AC-2:** a prompt before off, with a variant before the path's first start has completed.
- **AC-3:** a 60 s "starting" window, counted from the recorded off-to-on time and seen by every viewer.
- **AC-4:** who may change it.
- **AC-5:** a record of who changed it and when, readable only by the owner or an admin.
- **AC-6:** nothing else moves.

The story also carries story 4's review carry-forwards, R2-1 to R2-14. The Architect's share is R2-1's T12 half,
R2-7's and R2-8's ADR halves, R2-9 and R2-11. This ADR's commit makes those amendments in place (§ Amendments), as
story 4's Architecture did (`88af7df3`).

### What exists (read at `c557177f`)

- **The switch route.**
  - It is `POST /api/tagging-edges/realtime/switch`, behind `adminApi.requireOwnerOnly` (`src/api/index.js:531`).
  - `handleRealtimeSwitch` (`src/api/tagging-edges/realtime.js:166-199`) checks again: 401 with no session pubkey,
    403 when `session.authenticated !== true` or the caller is not the owner, 403 cross-site (`sameHost`), 415 if the
    body is not JSON, and 400 if `on` is not a boolean.
  - It then writes `{version:1, on, changedAt: now, changedBy: owner.slice(0,8)}`. It uses the store's `writeSwitch`
    (`store.js:276-278`) over `canonicalSwitch` (`:65-70`) and `state.writeAtomic` (`state.js:52-70`). `changedBy` is
    the configured owner, not the caller.
  - An `{on:false}` whose write fails unlinks `switch.json` and answers success, because a missing file reads as off
    (`realtime.js:190-196`; story 3 AC-5, "off means off"; ADR 0003:725). A failed `{on:true}` answers 500.
- **Reading the switch.** `parseSwitch` (`store.js:58-63`) returns only `{on, changedAt, changedBy}`, and
  `readSwitch` (`:270-274`) returns its output.
- **The status.** `GET /api/tagging-edges/realtime/status` is public (`src/api/index.js:530`). Its pure
  `computeRealtimeStatus` (`realtime.js:85-108`) serves:
  - `onSince = changedAt` while on, so an "on" while already on moves it;
  - `running`, the liveness of `status.json`'s process;
  - `runningSince`, that process's `startedAt`, which is the engine's own start.

  It carries no "who".
- **The wrapper and the engine read only the `on` flag.**
  - `run.sh:44` matches the text `"on":true` anywhere on `switch.json`'s first line, and the engine checks
    `on === true` every second (`index.js:64`, `:2194-2197`).
  - The wrapper polls every 2 s. After any exit within 60 s of starting, a clean one or an off included, it waits a
    backoff of 1 to 30 s, and only a run of 60 s or more resets it (`run.sh:57-66`).
- **The first start.** It is complete when the status serves `firstStartedAt`, which the engine sets only after the
  first baseline and the `record.json` and `started.json` writes (`index.js:1471-1479`). An off before then leaves no
  marker, so the next start is a first start again (`index.js:2200-2220`, `:2241-2254`).
- **The panel.**
  - Story 4's plain-ESM view module is clock-free (`taggingPipelineView.js:11-12`; TV4).
  - The fetch util (`taggingPipelineFetch.js`) races each GET against 15 s.
  - The panel folder has two `setInterval` timers, both cleared on unmount (`TaggingPipelinePanel.jsx:83`, `:92`).
- **Story 4's pins:**
  - PS10: no numeric delay on a timer in the panel folder;
  - PS11: every panel timer is cleared on unmount;
  - PS13: GET only;
  - PS14: five read paths;
  - TF1: `readSection` sends GET;
  - B38: no non-GET request.
- **The gate.** Story 4's drift route re-checks owner-or-admin in `gateOwnerOrAdmin` (`drift.js:66-89`). That returns
  null on admit, with no role. CORS reflects any origin with credentials (`bin/control-panel.js:114-119`), and
  `sameHost` refuses any request whose `Origin` names another host.

### Constraints

- **Principles 1–4 are untouched.** The switch is an instance's operating control. Its record lives on the
  tapestry-data volume, not in strfry or Neo4j.
- **No key of `switch.json` other than `on` may hold the text `"on":true`** (`run.sh:44`).
- **The engine and `run.sh` stay unchanged.** Story 3's stop and start behaviour stands (AC-6).
- **The view module stays clock-free.** The panel folder gains no new timer, and the 15 s race stays in
  `taggingPipelineFetch.js`.
- **No new lint, typecheck or build tooling.**
- **No concept changes.** The story touches `nostr-user-tag` and `nostr-user` only through the path it switches
  (`/api/concept-graph/summaries`, checked 2026-10-01), so no firmware reinstall is needed.

## Options considered

### Option A: switch.json v2 holds the latest change, a capped history file sits beside it, a gated GET on the switch path, and the public status gains only a server-computed starting verdict (chosen)

- **`switch.json` becomes version 2:** `{"version":2,"on":…,"changedAt":…,"changedBy":…,"role":…,"onSince":…}`. The
  latest change's who and when are written atomically with the state itself.
- **A new `switch-history.json`** keeps the last 10 changes, newest first, best effort. It never receives a new
  change before `switch.json` does. Before each switch write, it may first be brought up to date with the change
  `switch.json` already holds (D2).
- **The POST moves to `requireOwnerOrAdmin`,** with a shared re-check that returns the caller's role.
- **A GET on the same path,** behind the same gate with `sameHost` included, serves the latest change and the history
  through one pure function. The writer extends exactly the list that function gives.
- **The public status gains one field, `inStartWindow`,** a verdict on the server's clock like `stale`, and nothing
  about who.

**Pros:**
- Every accepted "on" is recorded atomically, so it needs no compensating write and leaves no phantom entry.
- The off fallback's unlink leaves the history file intact.
- The wrapper's substring match never sees a history entry.
- "Who" never reaches a public answer.
- The engine and the wrapper are untouched.
- Story-4 code reads version 2 (`parseSwitch` needs only a boolean `on`), so a rollback is safe.
- PS14 grows by exactly one path.

**Cons:**
- Two files describe the switch, and one pure function must reconcile them.
- `switch.json`'s canonical form grows (T26 is amended).
- Two residuals, each needing a failing data volume (Consequences).

### Option B: the history inside switch.json, and who on the public status

- **Sketch:** `switch.json` carries an array of the last 10 changes, and the status passes `changedBy` and `role`
  through.
- **Pros:** one file, one read, no new route.
- **Rejected on three counts:**
  - `run.sh:44` would match a past `"on":true` entry on the one-line file, and keep the path running after an off.
  - The off fallback unlinks `switch.json`, which would destroy the history.
  - The status is public, and AC-5 says a signed-out reader gets no "who" from any route.

### Option C: a log-line audit

- **Sketch:** the handler logs "turned on by role key at time", and the panel reads it back.
- **Rejected:**
  - Supervisor logs live in the container, not on the data volume, so the record would not survive a deploy (AC-5,
    "It lasts").
  - It is unstructured, so there is no rule for the latest change or for an off that was not recorded.
  - It would need a route that serves logs, which this ADR keeps out of the design.

## Decision

We chose **Option A**:
- **Atomic.** The latest change's who and when are written atomically with the state.
- **History.** The history file survives the off fallback.
- **Gated.** "Who" reaches only a signed-in owner or admin.
- **Server clock.** The starting window is judged by the server, so every viewer sees the same thing and the view
  module stays clock-free.
- **Unchanged.** Story 3's engine and wrapper are untouched.

What we trade away is a second file with a reconciling read rule (D3). Two residuals also remain, and each needs a
failing data volume. The owner accepted both at the Architecture gate (2026-10-01), as departures from AC-5
(Consequences).

## Consequences

- **Enables:**
  - The owner or an admin turns the path on and off from the panel.
  - The console snippet keeps working for both, through the same mount and handler, and is recorded the same way.
- **Editing `switch.json` by hand is the only unrecorded way left.**
  - The read rule shows a hand edit as not recorded only when it removes or damages `changedBy`, `changedAt` or
    `role`, or leaves `on` and `onSince` contradicting each other (D3).
  - An edit that keeps them is credited to the previous change's author and time. A version 1 shaped file with a
    valid key and time reads as the owner's.
  - The next switch's pre-fold copies that reading into the history.
- **`switch.json` becomes version 2,** with `role` and `onSince` after `changedBy`. Every writer goes through
  `canonicalSwitch`, and no future key may hold text containing `"on":true`.
- **The public status gains exactly one field, `inStartWindow`.** `onSince` now means the last off-to-on time: the
  same as before for a real transition, but an "on" while on no longer moves it. `running` stays liveness alone.
- **The status never carries who.** Who and when live on the data volume, in files written 0600 inside a 0700
  directory. They are served only by the owner-or-admin GET on the switch path, `sameHost` included. No handler logs
  who.
- **`switch.json` is the authority for the latest change.** The 10-entry history is best effort. A failed history
  write never fails a change, and never makes an earlier change look like the latest.
- **The owner-or-admin check exists once,** as `ownerOrAdmin(req, d)` in `src/api/tagging-edges/index.js`. The drift
  route and the switch share it, and the drift route behaves as before (the DR suite is the check).
- **Two residuals, each needing a failing data volume.** The owner accepted them at the Architecture gate
  (2026-10-01), as departures from story 5 AC-5's "The history recorded before it survives", and from the story's test task "the
  earlier history is intact".
  - **(a) An off fallback after a failed pre-fold.** An off whose `switch.json` write fails unlinks the file (story 3,
    unchanged). The earlier change is lost from the record when it was not yet stored in the history file, because
    D2's pre-fold, which copies it there first, failed too. In practice that means a full data volume.
    - The cases are the pre-story-5 change at an instance's first story-5 switch, and a change whose own fold failed.
    - **When the history file already holds an earlier entry,** the panel then shows the off as not recorded
      (`unrecorded-off`).
    - **Otherwise** it shows the never-switched state: "no change has been recorded", with an empty history. This is
      always so for the pre-story-5 change at the first story-5 switch, because no history file exists before then
      (D10).
    - **In both cases** the POST's own answer (`recorded:false`, and `switchOutcome`'s `done-unrecorded` sentence)
      says the off was not recorded, and an earlier change is never shown as the latest.
    - Only the declined rename-instead-of-unlink option (§ Out of scope) would let the panel tell this apart from a
      never-switched instance.
  - **(b) A history file that gives a read error.** While it does, each change still lands in `switch.json`, but
    neither the pre-fold nor the fold writes the history. In practice that is `EIO`, or something other than a file
    at the path; the control panel runs as root, so a permission error is unlikely.
    - Every change in that spell except the last is lost from the history.
    - The first change after the error clears pre-folds only the latest one.
- **Not changed:**
  - `src/pipeline/tagging-edges/realtime/index.js` and `run.sh`. The store only gains methods and keys.
  - Off still means off, within 5 s.
  - A switch change starts, stops and queues no pass, and changes no schedule.
- **Story 4's GET-only pins are revised, not deleted.**
  - PS13 allows exactly `sendSwitch`'s POST.
  - PS14 gains the one switch path.
  - B38's allowed set gains the record read.
  - TF1 is unchanged.
  - The AC-6 relay-subtab baseline is not re-recorded, because nothing new is sent outside the panel.
- **Tests that fail by design,** each revised by the Tester with a story-5 citation:
  - **RR10:** an admin may now switch. Keep a row in which a stranger carries admin session flags with no admin-list
    entry, refused with 403, as DR4 does.
  - **RR15:** the record and the answer's shape.
  - **RR23:** the default-dependencies write is now version 2 bytes, with `role` and `onSince`.
  - **SWR67:** it now counts the `app.get` and `app.post` registrations of the switch path, once each, not the path
    literal.
- **Tests to extend or retitle,** which stay green as written: RR2 and RR27 (`onSince`), RS2 (key order), RR16 and RR17
  (the answers gain `recorded` and `code`). Each gains version 2 rows.
- **A risk carried into Review.** The panel's POST is the first panel request that carries `Origin`, so a public host
  whose outer proxy rewrote `Host` would refuse it as cross-site. nginx forwards `Host` (`docker/nginx.conf:40-42`).
  The console snippet already depends on the same check, and the story's staging evidence is the test.
- **Firmware reinstall required?** No.

## Implementation notes

### Server

**D1. Where the record lives, and its shape.** Both files are in `<stateDir>/realtime/` on the data volume.
- **`switch.json`, version 2.** Canonical compact JSON on one line, keys in the order `version, on, changedAt,
  changedBy, role, onSince`. For example: `{"version":2,"on":false,"changedAt":"…","changedBy":"ab12cd34","role":"admin","onSince":null}`.
  - `changedBy` is the caller's `session.pubkey.slice(0, 8)`.
  - `role` is `'owner'` or `'admin'`.
  - `onSince` is as in D4.
  - `canonicalSwitch` keeps throwing `EBADSWITCH` for a non-boolean `on`. It also throws for a version 2 record whose
    `role` is not `'owner'` or `'admin'`.
  - A record with no `version` still serialises as version 1, which keeps story 3's writers and tests valid.
- **`switch-history.json`, new.** It holds `{version:1, changes:[{on, at, role, key}]}`, newest first, at most 10
  entries (the `report.json` precedent, `state.js:24`, `:102-107`).
  - It is pretty JSON, written with `state.writeAtomic`.
  - In each entry, `on` is a boolean. For a recorded change, `at` is an ISO time, `role` is `'owner'` or `'admin'`,
    and `key` is 8 hex digits. For a change not recorded, all three are null.
- **Store** (`store.js`):
  - The header (`:8-9`) names the new file, and `createStore` (`:239-246`) gains
    `SWITCH_HISTORY = file('switch-history.json')`.
  - **New methods.** `readSwitchHistory()` and `writeSwitchHistory(obj)` are synchronous, and `writeSwitchHistory`
    takes the whole `{version, changes}` object. `parseSwitchHistory(text)` is pure.
  - **`parseSwitch`** (`:58-63`), and so `readSwitch`, also returns `version` (the raw parsed value), `role` and
    `onSince`.
  - **Readers tell a read error from damage.** A missing file gives `null`. A read error other than `ENOENT` gives
    `{ unreadable: true, readError: code }`. Text that does not parse, or has the wrong shape, gives
    `{ unreadable: true }`. `readSwitch` gains the same `readError` field. The engine still sees `unreadable` and
    treats it as off, as today.

**D2. Write order and the failure matrix.** Each admitted, validated POST runs one serialised step (D9). The answers
are in D11.
1. **Read the current state.** Read `prev` (`readSwitch()`) and `hist` (`readSwitchHistory()`).
2. **A read error on `prev`.**
   - For `{on:true}`: answer 500 `could not read the switch: <code>`, and change and record nothing. This case can't
     tell whether the path is already on, which `onSince` needs.
   - For `{on:false}`: go on, because off means off.
3. **The base list,** in memory.
   - If `hist` gave a `readError`, `base` is null and no history write happens in this request. That is residual (b).
   - Otherwise `base = switchRecord(prev, hist).history` (D3): the list a GET would show right now. A damaged history
     counts as having no valid entries.
   - The base includes `prev`'s entry, or the `unrecorded-off` placeholder when `switch.json` is missing after a
     recorded change.
4. **The pre-fold, best effort.** When `base` is not null and differs from the history's stored valid entries, write
   `{version:1, changes: base}` with `writeSwitchHistory`. A failure here is ignored. `base` stays in memory whether
   or not the write succeeded.
   - The pre-fold writes only changes that were already made, so it can never create a phantom entry.
   - It moves the pre-story-5 change, and an earlier unrecorded off, into the history before the new write can
     replace or unlink them.
5. **`writeSwitch(next)`,** with `next` built as in D1 and D4.
   - **It succeeds.** When `base` is not null, write
     `{version:1, changes: foldHistory(switchEntry(next), base)}` with `writeSwitchHistory`. A failure there is
     ignored: `switch.json` holds the change, and the next successful change's pre-fold repairs the file.
   - **It fails, for `{on:true}`.** Answer 500, unlink nothing, and run no fold.
     - The switch state, `switch.json` and the served record (the GET's answer and the public status) are unchanged,
       and the attempted change is recorded nowhere.
     - The only history write a failed on can leave is step 4's pre-fold, which may have added the previous,
       already-made change.
   - **It fails, for `{on:false}`.** Call `unlinkSwitch()`, as story 3 does, and run no fold. Answer as an off that
     was not recorded. If the unlink fails too, answer 500 as today.

The invariant: the history never receives the new change before `switch.json` does, and the pre-fold writes only
changes `switch.json` already held or the record already showed.

**D3. The latest change and the record, derived by one pure function.** Add these pure exports to `realtime.js`.

`switchEntry(rec)` reads one parsed switch record:
- **A recorded change.** Either of these gives `{on, at: changedAt, role, key: changedBy}`:
  - `changedBy` is 8 hex, `changedAt` is ISO, and `role` is `'owner'` or `'admin'`, with `on` and `onSince` agreeing:
    on with an ISO `onSince`, or off with a null `onSince`;
  - `version === 1`, no `role`, an 8-hex `changedBy` and an ISO `changedAt`. This is the pre-story-5 reading, with
    role `'owner'`: only the owner route wrote such a record (ADR 0003:366).
- **Anything else readable is a change not recorded:** `{on, at: null, role: null, key: null}`. This covers a
  version 2 record without a role, and one whose `on` contradicts its `onSince`, which D4's writer never produces.

`switchRecord(switchRec, historyObj)` returns `{ on, switchUnreadable, historyUnreadable, state, latest, history }`.
- **`historyUnreadable`** is true when the history file is present but gives a read error, does not parse, or its
  `changes` is not an array.
- **`state` is one of these:**
  - `'recorded'`: `switch.json` is readable, and `latest` is `switchEntry(switch)`.
  - `'switch-unreadable'`: `switch.json` gives a read error or is damaged. `latest` is null, and the stored history is
    still returned.
  - `'unrecorded-off'`: `switch.json` is missing, and the history file is present, holding at least one entry or
    unreadable. `latest` is `{on:false, at:null, role:null, key:null}`.
  - `'never-switched'`: `switch.json` is missing, and the history file is missing or its `changes` is an empty array.
    `latest` is null, and `history` is `[]`.
- **In every state,** `history = dedupe([latest when it is not null, ...validEntries(file)]).slice(0, 10)`. `dedupe`
  drops an entry equal in `on`, `at`, `role` and `key` to the one before it.

`foldHistory(newEntry, list)` returns the array `dedupe([newEntry, ...list]).slice(0, 10)`.

The writer extends exactly the list the GET showed (D2 step 3). So the two cannot disagree, an unrecorded off keeps its
row when later changes come, and an earlier "Turned on by …" is never the latest change or the list's first row
(AC-5).

**D4. A same-state request, and the off-to-on time.**
- **Every accepted request is a change** (the story's definition). `changedAt`, `changedBy` and `role` always move.
- **`onSince`** is the last off-to-on time:
  - for `{on:true}` when `prev` reads on: carry `prev.onSince` if it is an ISO time, else `prev.changedAt` (a
    version 1 record), else now;
  - for `{on:true}` when `prev` reads off, is missing, or is damaged: now;
  - for `{on:false}`: null.
- **The status's `onSince`** becomes: while on, `sw.onSince` if it is ISO, else `sw.changedAt` if ISO, else null;
  null when off. This replaces `realtime.js:97`.

So an "on" while on never moves the window (AC-3), and an off followed by an on always does.

**D5. Who may switch.**
- **The mount.** `src/api/index.js:531` changes to `adminApi.requireOwnerOrAdmin`, as drift-counts is mounted
  (`:538`). The comment at `:525-528` is rewritten.
- **The re-check.** A new `ownerOrAdmin(req, d)` in `src/api/tagging-edges/index.js`, beside `sameHost` and
  `isJson`, is exported. It returns `{ok:true, role, pubkey}` or `{ok:false, status, error}`. Its order and bodies are
  the drift route's (`drift.js:73-89`):
  - 401 `Not authenticated` when there is no non-empty string `session.pubkey`;
  - 403 `Owner or admin access required` when `session.authenticated !== true`, or when the pubkey is neither the
    owner (checked first, against the lowercase 64-hex configured owner) nor in `d.getAdminPubkeys()`. As in the
    drift route, an owner lookup that throws admits no owner, and an admin lookup that throws admits no admin.
  - 403 `cross-site request refused` when not `sameHost`.
- **The switch handler** keeps 415 (`isJson`) and 400 (`validateSwitch`) after the re-check.
- **What a refusal touches.** A 401 calls no dependency. Every other refusal (the role 403, the cross-site 403, 415
  and 400) calls only the owner and admin lookups. No refusal reads, writes or unlinks a file, joins D9's chain,
  signals, or touches the queue, so it changes and records nothing. The same holds for refusals on D6's GET.
- **Shared helpers.** `drift.js`'s `gateOwnerOrAdmin` becomes a delegate that keeps its null-on-admit contract.
  `realtime.js`'s `defaultDeps` (`:40-48`) gains `getAdminPubkeys`, required lazily as `drift.js:41` does.
- **The role** comes from configuration at the moment of the change, never from session flags. DR4 shows a stranger
  with admin session flags is refused. Both lists are re-read on every request, so an admin who is removed is refused
  on their next request.

**D6. Who may read who: GET on the switch path.**
- **The mount.** `app.get('/api/tagging-edges/realtime/switch', adminApi.requireOwnerOrAdmin,
  taggingEdgesRealtime.handleRealtimeSwitchRecord)`, beside the POST, re-checked with `ownerOrAdmin` (`sameHost`
  included). So no foreign page can read who through the reflecting CORS.
- **What it reads.** It reads through the injected `readFile`, as the status route does (`realtime.js:131-160`):
  `switch-history.json` first, then `switch.json`. Each file's read error other than `ENOENT` is caught on its own and
  mapped as the store maps it, which matches the status route's catch (`realtime.js:136-142`).
  - The order is safe because of D2's invariant: a history the GET reads never holds a change newer than the switch it
    reads next.
- **What it answers.** It writes nothing, and answers 200
  `{success:true, on, switchUnreadable, historyUnreadable, state, latest, history}` from D3. That covers
  `state:'switch-unreadable'` and `historyUnreadable:true`. It answers 500 `could not read the switch record:
  <code>` only for a throw outside the two file reads.
- **No "who" anywhere public.**
  - The public status gains none, and `PASS_THROUGH` (`realtime.js:31-34`) is unchanged.
  - The fields are named `role` and `key`, never `changedBy`, because the public status already carries
    `counts.changedBy`, the path's reflection labels.
  - No handler logs who.

**D7. The starting window: a verdict on the public status.**
- **The verdict.** `computeRealtimeStatus` (already given `now`) adds `inStartWindow`. It is true when all of these
  hold:
  - the path is on;
  - `onSince` parses;
  - `0 <= now − onSince < START_WINDOW_MS` (60 000, beside `STALE_AFTER_MS`, `:26`);
  - the process is not both running and started at or after `onSince` (by `runningSince`).
- **`running` stays liveness alone** (RR4 and RR18 pin it).
- **`pathView`** (`taggingPipelineView.js:370-435`) changes:
  - `starting = on && rtBody.inStartWindow === true`;
  - `onButNotRunning = on && !running && !starting`;
  - while starting, `state` is null, as for `onButNotRunning`, and the view exposes `runningForThisOn =
    running && !starting`.
- **`OnLine`** (`PathSection.jsx:16-29`) **checks `starting` first, before "on and running".**
  - Its copy says the path was switched on at the time, and is starting, which can take up to about 30 seconds.
  - Within the window it never prints that the process is running, and never shows `runningSince`.
- **B20's patterns.** In the starting fixtures (`STARTING` and `STARTING_OLD_PROCESS`), the `tp-path` section's
  whole text must not match `NOT_RUNNING` (`tests/brainstorm/tagging-pipeline-panel.spec.js:170`, which B20 matches
  positively) or `NOT_RUNNING_STRICT` (`:171`, which B19 asserts absent).
  - `NOT_RUNNING` is matched against the whole section, and its `[^.]*` runs to the next full stop.
  - So: no "not running" or "isn't running" anywhere, and no "process" or "path" followed in the same sentence by
    "stopped", "not started", "not alive", "isn't alive" or "is down".
  - `NOT_RUNNING_STRICT` also forbids "is not alive" and "isn't alive" on their own.
- **Past 60 s,** `running` is plain liveness again. A quick off then on can leave the old process alive. That shows
  "starting" for up to a minute, then "on and running", never red.
- **Clocks.** `changedAt` and the process's `startedAt` come from two supervisord programs in one container, so they
  share a clock. A backwards clock step reads as not starting.

**D8. AC-2's first-start variant.** A pure `offPromptVariant(rtBody)` in the view module:
- `'unknown'` when `statusUnreadable === true`. The prompt is the normal one, plus a line saying it could not check
  whether the first start completed, with the first-start consequences stated as a condition.
- `'normal'` when `firstStartedAt` is a string.
- `'first-start'` otherwise.

It never keys on `started`, which is true during a first start, or on state `'starting'`, which every start reports.

**D9. Concurrent changes.**
- A module-level promise chain in `realtime.js` runs each admitted, validated POST's step (D2) after the previous one
  settles. A failure never breaks the chain.
- Refusals are answered before joining the chain.
- The control panel is one Node process, and the store is synchronous. When the owner and an admin switch within
  milliseconds, both land in order, the last write wins, and both are in the history.

**D10. The pre-story-5 record: no write at deploy or on read.** A version 1 `switch.json` reads as the owner's change,
with its stored time and key, kept even if the configured owner has changed since. D2's pre-fold copies it into the
history at the first story-5 switch. Locally, `{"version":1,"on":false,"changedAt":"2026-09-29T17:43:18.937Z","changedBy":"f0178122"}`
reads as turned off by the owner (f0178122…).

**D11. The POST's answers.**
- **A change, recorded:** 200 `{success:true, on, changedAt, recorded:true, takesEffectWithinSeconds:5}`.
- **An off that was not recorded:** 200 `{success:true, on:false, recorded:false, takesEffectWithinSeconds:5}`.
- **500s** keep their sentences (`realtime.js:188`, `:194`) and gain `code`, passed through `allowErrorCode`, plus
  `unlinkCode` on the double failure. A read error on `prev` for an on answers 500 `could not read the switch:
  <code>`.
- **No answer carries a full pubkey.** Refusal bodies are the drift route's (D5).

### UI

**D12. The control, its request, and the 15 s limit.**
- **`sendSwitch(on, { fetchImpl, timeoutMs = 15000 })`** in `taggingPipelineFetch.js`:
  - It shares `readSection`'s race through a private helper.
  - It sends `POST` to `/api/tagging-edges/realtime/switch`, with `Content-Type: application/json`, the body
    `{"on":…}` and the default same-origin credentials.
  - It resolves `readSection`'s result shapes and never rejects.
  - `readSection` is untouched, so TF1 holds.
- **`TaggingPipelinePanel.jsx`.**
  - **The record read** is a `useRead('/api/tagging-edges/realtime/switch')`, polled with the status reads
    (`Promise.allSettled` at `:87`), so other viewers see a change within `POLL_MS`.
  - **A change state** `{target, pending, outcome}`, with an unmount guard.
  - **When the answer is unknown** (timeout, network, or a 2xx with bad JSON), clear `pending` at once and show the
    "outcome unknown" sentence. Then start the re-reads without waiting for them. So AC-1's 15 s holds even when the
    server hangs.
  - **When the server answered** (2xx, 4xx or 5xx), await `Promise.allSettled([readRealtime(), readRecord()])` in
    parallel, each bounded at 15 s, then clear `pending`.
  - **After an unmount,** no re-read is sent. B38 pins that no tagging read follows a close.
- **`switchOutcome(result, target)`** in the view module gives one of these, each with a fixed sentence for its
  target:
  - `done`: ok, and `recorded` is not false;
  - `done-unrecorded`: ok, and `recorded === false`;
  - `unknown`: timeout, network, or bad JSON;
  - `refused`: `http-401` or `http-403`. Its own sentence says to sign in again as the owner or an admin, from the
    instance's own address. The HTTP status is shown beside it.
  - `failed`: any other non-2xx, with `body.code`.

  A failed off says the path could not be turned off and is still on as before. A failed on says the path's state is
  unchanged, and to check that the data volume has free space and is writable.
- **`switchRecordView(recordRead, rtBody)`** shows the latest change and the history only when the record read is
  current, its `on` equals `rtBody.on`, and its `switchUnreadable` agrees. Otherwise it says the record is being
  refreshed, or could not be read, and it never renders a kept body's latest line after a failed record read. One
  sentence per state:
  - `recorded`, with a role: "Turned off by an admin (ab12cd34…) at …", or "by the owner".
  - `recorded`, with a null role: turned on (or off); who and when were not recorded.
  - `unrecorded-off`: turned off, but the change was not recorded.
  - `never-switched`: no change has been recorded.
  - `switch-unreadable`: the on/off record cannot be read.
  - `historyUnreadable`: the history cannot be read, with the latest change still shown.

  History rows that were not recorded render without who or when.
- **The control** sits in `PathSection` after `OnLine`.
  - It reads "Turn off" while on, and "Turn on" while off. An unreadable switch reads off.
  - While pending it is disabled, with text such as "Turning the path off…" and `aria-busy`. It adds no new
    `data-state` value (PS12).
  - It renders only once the path status has a body. `PathSection`'s early return (`:148-156`) stands.
  - The record shows as a latest-change line plus an ordered list of up to 10. It is not a `Figures`, whose label
    keys would collide, and it has its own `ReadFailed`.
- **No role is needed in the panel.** Settings admits only the owner and admins (`ui/src/pages/settings/Index.jsx:35`),
  and PS5/PS8 forbid new props from `RelaySettings`.

**D13. The off prompt.** An inline confirmation inside `tp-path` replaces the control while open, so only one "Turn
off" button exists at a time.
- **Layout.** It has a heading, the variant's text (D8), and the buttons "Turn off" and "Cancel" (`btn-small`).
  Focus moves to "Cancel" on open, through a `useEffect`, with no timer.
- **The normal variant says:**
  - the path stops reflecting changes within seconds;
  - what it holds is kept, and changes stored meanwhile are caught up at the next "Turn on", apart from story 3's
    cases for the next pass;
  - what keeps the graph in step meanwhile. A `BackstopVerdict` component is extracted from `ScheduleSection.jsx:44-67`
    and used by both, so the two cannot drift apart. With no schedule view, it says the backstop could not be
    checked.
- **The first-start variant says:**
  - what the path has gathered so far is dropped;
  - the next "Turn on" is a first start again;
  - run a pass after the path shows live (OPERATIONS §12.9's order).
- **It closes by itself** if a read shows the path off. "Cancel" sends nothing.
- **Style:** token colours only, nothing added to `styles.css`, no "!" and no emoji (PS16/17/18/20/22/24).
- **Why not the alternatives.**
  - `ConfirmDialog` (`ui/src/components/ConfirmDialog.jsx:5-20`) wraps its message in a `<p>`, so block content
    would nest wrongly. Its buttons are fixed, and its colours are not tokens.
  - `window.confirm` freezes the page's timers and cannot hold structured text.

**D14. The warning beside "Turn on".** It shows only while the path is off, from a pure `turnOnWarning(statusRead)`:
- `'no-finished-pass'` when the status body is present and `newestFinishedPass(body) === null`
  (`taggingPipelineView.js:345`);
- `'could-not-check'` when the status read failed with no body;
- none while loading.

`TaggingPipelinePanel.jsx:171` passes the status read to `PathSection`.

### Seams for Test Design

- **Pure server functions in `realtime.js`.**
  - `computeRealtimeStatus` with `inStartWindow`. Cases:
    - 59 999 against 60 000 ms elapsed;
    - `runningSince` equal to, earlier than, and unparseable against `onSince`;
    - now before `onSince`;
    - off;
    - version 1 against version 2 `onSince`.
  - `switchEntry`, `switchRecord` and `foldHistory`. Cases:
    - every D3 state and every input that leads to it;
    - version 1 (owner, its stored key and time);
    - version 2, owner and admin;
    - a version 2 record without a role, and one whose `on` contradicts its `onSince`;
    - a history read error, damage, and a parseable history with no valid entries;
    - the cap at 10, and `dedupe`.
- **The handler's dependencies, injected through `withDeps`.**
  - **Use the shared `switchBundle`.** It injects all three record dependencies: `readSwitch` (default: missing),
    `readSwitchHistory` (default: missing) and `writeSwitchHistory` (a spy; default: succeeds), beside `writeSwitch`
    and `unlinkSwitch`. Every POST test, RR15-RR17 included, uses this bundle.
    - The reason: the bundle's `stateDir` is `FAKE_ROOT` (`test/tagging-edges-realtime-routes.test.js:129`), which is
      the production state directory. The default record dependencies are the store's under it, and they use the
      store's own `fs`, not the injected `readFile`.
    - So inside the container a test running on those defaults would read the live `switch.json` and overwrite the
      live `switch-history.json`.
    - Default-dependency coverage (RR23 revised) runs only against a temporary `TAGGING_EDGES_STATE_DIR`.
    - `withDeps`' defaults keep following `d.stateDir()`, as T27 does for `writeSwitch`.
  - **Spies record the call order:** pre-fold, then switch, then fold. Each dependency can be made to fail, a read
    error and damage included.
  - **Refusals.** A 401 calls nothing. Other refusals call only the owner and admin lookups (D5).
  - **The cases include:**
    - **A version 1 file.** Parse it with the real `parseSwitch`, using D10's local text. The pre-fold copies it as
      `{on:false, at, role:'owner', key:'f0178122'}`.
    - **A version 1 file and a failed off.** With no history file and the pre-fold succeeding, the history keeps that
      change. With the pre-fold failing too, it is residual (a).
    - **A damaged history keeps `prev`.**
    - **A read-error spell of two changes loses the first** (residual (b)).
    - **An unrecorded off, then a successful on.** The history keeps the off's row, without who or when.
    - **A failed on.** The spies show the pre-fold (only when `prev`'s entry was not already the history's newest),
      then `writeSwitch`, then no fold. `switch.json` is byte-identical afterwards. The history file is unchanged, or
      exactly the pre-fold's base list, and holds no entry for the attempted on. The GET's answer equals its answer
      before the request.
- **Concurrency.** Two POSTs issued without awaiting, with async fake writers: both entries land in order, the last
  state wins, and the second's `onSince` comes from the first.
- **`handleRealtimeSwitchRecord`.**
  - It takes an injected `readFile`, and no writer is ever called.
  - It reads the history before the switch. Pin this with a `readFile` that lets a POST complete between the GET's
    two reads.
  - **Read-error cases:** a history read error with `switch.json` readable; a `switch.json` read error; `switch.json`
    missing with an unreadable history.
  - **Refusals:** 401 signed out; 403 for a stranger, for `authenticated !== true`, and cross-site.
  - No who appears in any refusal, or in the public status. Beware `counts.changedBy`.
- **`ownerOrAdmin`.** The order is 401, then the role 403, then the cross-site 403, and the owner is checked before
  admins. As in the drift route, a throwing owner lookup admits no owner, and a throwing admin lookup admits no admin.
  The DR suite stays the check on `gateOwnerOrAdmin`.
- **The store,** in RS-style temp-dir tests:
  - the history methods;
  - version 2 canonical text and key order;
  - `EBADSWITCH` for a version 2 record without a role;
  - `version` returned by `parseSwitch`;
  - `readError` against `unreadable`;
  - RS19, RS21 and RS22 extended.
- **The wrapper** (`test/tagging-edges-realtime-wrapper.test.js`): a version 2 off line carrying `role` and
  `"onSince":null` reads off, and a version 2 on line reads on.
- **The wiring (SWR67 revised):** `app.get` and `app.post` on the switch path, each behind
  `adminApi.requireOwnerOrAdmin`, each registered once.
- **The fetch util, TF-style.** `sendSwitch` calls `fetchImpl` exactly once, with
  `{method:'POST', headers:{'Content-Type':'application/json'}, body:'{"on":true}', signal}`. It resolves timeout at
  `timeoutMs` and never rejects. TF1 is unchanged.
- **The view module,** clock-free (TV4):
  - `pathView`: `starting`, `runningForThisOn`, `onButNotRunning` false while starting, and the state hidden;
  - `switchRecordView`: every state, the null-role `recorded` case, and the two consistency cases (a skewed pair, and
    a failed record read after a good one);
  - `switchOutcome(result, target)`: each outcome against each target;
  - `offPromptVariant` and `turnOnWarning`.
- **Static pins.**
  - PS13 allows exactly one non-GET: the method `'POST'` inside `sendSwitch`, to the literal switch path.
  - PS14's `READ_PATHS` gains the switch path.
  - PS10, PS11 and PS12 hold.
- **Browser mocks.**
  - `mock()` gains `switch` (the POST's answer) and `record` (the GET's answer) on one route, branching on
    `req.method()`. `F.ROUTES` gains the switch path, and B38's allowed set gains the record read.
  - `log.nonGet` equals exactly `['POST /api/tagging-edges/realtime/switch']` after a confirm, and `[]` after a cancel
    and for a viewer who never presses.
- **Browser fixtures:**
  - `STARTING`: on, `inStartWindow`, not running.
  - `STARTING_OLD_PROCESS`: on, `inStartWindow`, running, with `runningSince` before `onSince`. It shows no "is
    running" sentence and no `runningSince`.
  - Past the window: the existing `ON_NOT_RUNNING`.
  - A reload and a second viewer see the same, because the flag is in the body.
  - An "on" while already on: the same `onSince`, and not in the window.
- **The 15 s cases:**
  - The switch, realtime and record routes all hang. After `page.clock.runFor(15000)`, the control is enabled and
    says the outcome is unknown.
  - A refused request, and a failed on and a failed off, each with its own sentence.
- **R2-11 pins:** an `ERR_` code under countCode and under failureCode reads "not recognised", and
  `Neo.ClientError.Security.Forbidden` reads as the Security family under both kinds.
- **R2-1 pins:** exact entries for `N/A` and `ProtocolError` under both kinds, added as guard floors because no
  producer mints them literally.

### Docs (the Implementer)

- **OPERATIONS.**
  - **§12.8 `:725`:**
    - The panel now carries the path's switch, its prompt and its record (owner or admin; §12.9). Only the pass's
      run, stop and confirm move to story 6. Until then the Task Explorer runs a pass, and the held-removal console
      snippet confirms.
    - Qualify "It changes nothing": the panel changes nothing except the path's switch.
    - Change "the panel only reads them": the panel reads these routes, including the new owner-or-admin GET on the
      switch path, and sends one POST, the switch's. The JSON routes stay the reference.
  - **§12.9 `:778`:** the backoff follows any exit within 60 s of starting, a clean one and an off included, and only a
    run of 60 s or more resets it (`run.sh:57-66`).
  - **§12.9 `:780-788`:** owner or admin, the 403 text, and up to about 30 s to start.
  - **§12.9, the table rows `:794-797`:** `onSince` and `inStartWindow`.
  - **§12.9 `:815`, step 3:** the panel's control, with the snippet as the alternative.
- **BIBLE.** `:8`, `:163` (§4), `:321` (§6), `:665` and `:669-670` (§11: the switch row, the status row with
  `inStartWindow`, and the new GET), and `:1482-1483` (§16), plus a §16 entry and the Last-updated line.
- **Comments.**
  - `TaggingPipelinePanel.jsx:4-6` and `:152-155` (the hint "It changes nothing" becomes true of everything but the
    switch);
  - `taggingPipelineFetch.js:10`;
  - `HeldSection.jsx:4` (point at story 6).
- **The story's own copy and docs tasks,** and R2-1's copy, R2-2 to R2-6, R2-7's OPERATIONS half, R2-8's handoff half
  and R2-14, are the Implementer's (story 5 § Carry-forwards).

## Amendments to ADRs 0002, 0003 and 0004, and story 3

This ADR's commit makes these changes in place, as dated notes beside the text they amend, each citing this ADR. The
original text stays, so the history reads in order. That covers the story's Architect
tasks: ADR 0003's who-may-switch and record, the story 3 AC-5 note, R2-1's T12 half, R2-7's and R2-8's ADR halves,
R2-9, and R2-11's ratification.

### ADR 0003 (who may switch; the record; the starting window)

- **`:11` and `:23`:** beside "owner-only switch", a note: owner or admin since story 5, enforced by the server, last
  change wins, each change recording who and when.
- **`:201-202`:** the POST is owner or admin, and a gated GET on the same path serves who changed it (D5, D6).
- **`:225-226` (the diagram):**
  - `POST /api/tagging-edges/realtime/switch {on}` → owner or admin → `switch.json`, and the history file;
  - `GET /api/tagging-edges/realtime/switch` → owner or admin: who and when, the latest and the last 10.
- **`:366` (the files table).**
  - The `switch.json` row: version 2 (D1). A version 1 record reads as the owner's change. Written by the
    owner-or-admin route only.
  - A new `switch-history.json` row (D1, D2).
- **After `:726` (the POST):** a dated block giving D2, D4, D5 and D11 (who, what it writes, what it answers), and
  the GET (D6).
- **`:746`, `:1458` (T29) and T27 (`:1422-1428`):**
  - the route also derives `inStartWindow` (D7);
  - `onSince` is the last off-to-on time;
  - a failed off-write answers as in D11.
- **`:1058`:** the registration shows `requireOwnerOrAdmin`, plus the GET.
- **`:1071`:** the panel's control is the way to switch. The snippet still works for both, and is recorded the same.
- **`:1100`:** `requireOwnerOrAdmin` on the POST and on the GET; SWR67 revised.
- **`:1135`:** in the auth matrix, an admin is now admitted. The refused callers are listed instead.
- **`:1344` (T21):** `readSwitch()` gains `version`, `role`, `onSince` and `readError`. Add `readSwitchHistory()`,
  `writeSwitchHistory(obj)` and `parseSwitchHistory(text)`.
- **`:1359-1360` (T22):** the routes module also exports `switchEntry`, `switchRecord`, `foldHistory` and
  `handleRealtimeSwitchRecord`.
- **`:1365` (the handler's dependencies):** add `getAdminPubkeys` and the record methods.
- **`:1414` (T26):** the version 2 key order. No key but `on` may hold the text `"on":true`.
- **`:1433` (T27):** `authenticated !== true` with the owner's or an admin's pubkey answers 403.
- **`:917-919` (R2-8):** story 4's panel reads five routes and posts nothing. Story 5 adds the switch's POST, widened
  to owner or admin, and its gated GET. The pass's run, stop and confirm are story 6's.

### Story 3 (a note after `3-real-time-path.md:253`, AC-5, in the C7 format of `:470`)

Story 5's Planning (the owner, 2026-10-01) changed AC-5's rules:
- **Who may switch.** The owner or an admin turns the path on and off, enforced by the server, and the last change
  wins. A session that is neither the owner's nor an admin's is refused and changes nothing.
- **The record.** Each change records who (owner or admin, and an 8-character key) and when. Only a signed-in owner
  or admin may read who.
- **Off still means off.** An off that cannot be recorded still takes effect, and its answer says so.

See story 5 and this ADR. The wording of `:101` and `:444` stands as story 3 shipped it.

### ADR 0004 (story 5's changes to the panel; R2-1, R2-7, R2-9, R2-11)

- **`:181-182`:** the gate is extracted as `ownerOrAdmin(req, d)`, which also returns the role. `gateOwnerOrAdmin`
  delegates to it, with its contract unchanged (D5).
- **`:247-249`, the no-cors bullet (R2-7).**
  - A no-cors cross-site GET joins a pending answer. So a new pair of counts starts only after the previous answer
    settles (`drift.js:184`), and repeated requests can start one pair after another, as fast as answers settle.
  - A count that lost its race is abandoned, not stopped. The relay count's strfry child is killed at its own 10 s
    limit, but a graph count keeps its session until Neo4j ends it.
  - So abandoned graph counts can run beside newer ones, bounded by the driver's pool of 20
    (`src/lib/neo4j-driver.js:35-38`). They only read, and nobody can read their answer.
  - This replaces round 1's "at most one count at a time".
- **`:326-331`, the `FAMILIES` line (R2-11).** It is brought into step with T12 and `taggingPipelineView.js:243-269`:
  - `^E(?!RR_)[A-Z0-9_]+$` is an operating-system code, and excludes Node's own `ERR_…`;
  - `^Neo\.ClientError\.Security\.[A-Za-z]+$` is credentials or permission, and comes before the general Neo4j
    family;
  - under both countCode and failureCode.
- **`:347`:** "(until story 5)" becomes "(until story 6)".
- **`:362` and T3 (`:679-684`):** `pathView` gains `starting` and `runningForThisOn`. `onButNotRunning` is
  `on && !running && !starting`, and `state` is null while starting too (D7).
- **`:382`:** while starting, `onSince` is shown and `runningSince` is not (D7).
- **`:466-468`:** the poll also re-reads the switch's record (D12).
- **`:500-501`:** every code is shown through `explain`, apart from the switch's failure code, which is shown beside
  `switchOutcome`'s sentence for its target (D12). Every request the panel sends is a GET, apart from `sendSwitch`'s
  POST (D12).
- **`:786-787`, T12's Schema bullet (R2-1).**
  - `no-status` is an error that carried no `code`. Every Neo4jError the driver makes carries a code, `N/A` when none
    was given (`node_modules/neo4j-driver-core/lib/error.js:245-247`; `newError` is the driver's only constructor of
    Neo4jError).
  - The driver's code-less errors are plain `TypeError` or `Error` throws from its own checks of arguments and
    configuration (`internal/util.js:142`, `:207`, `:221`; `driver.js:822-910`).
  - So `no-status` is a fault in the schema check's own code, including what that code passes to the driver, or in
    a library other than the driver. It never comes from Neo4j's answer.
  - Its sentence says so, and points at reporting a bug, not at Neo4j.
- **`:789-790`, T12's "The rest" (R2-1, R2-9).**
  - **The driver's own `N/A` and `ProtocolError`** (`error.js:86-96`) reach `failure.code` raw at any graph stage.
    Each gets an exact entry under failureCode, worded for any graph stage:
    - `N/A` is the driver's unclassified error. Most often no connection was had within the 30 s acquisition limit,
      or `NEO4J_URI` or TLS is set wrong.
    - `ProtocolError` is a Bolt protocol fault: a version mismatch, or something other than Neo4j at the Bolt port.
  - **The same two codes also get countCode entries,** as R2-1 asks. Today every countCode source either passes
    `allowErrorCode`, which turns both into `error` (`drift.js:118`, `:133`; `realtime.js:103`; the engine `:623`), or
    carries only filesystem codes (the confirmation read, `index.js:175`). So these entries are floors against a
    future source, not reachable today.
  - **`fsFailure`** (`reconcileTaggingEdges.js:102`) joins the list of `error` fallbacks. It is stored through
    `fail()` at `:548` (via `:486`) and at `:569`. The one at `:245` is never stored, because the report write itself
    failed.
  - **`passReason.schema`'s copy.** "Any other code has its own explanation beside it" becomes: explained beside it,
    or shown as not recognised.
- **`:792-796`, T12's families paragraph (R2-11): ratified.**
  - **The `ERR_` exclusion.** The E family's sentence says the operating system reported the code, which is false for
    Node's own `ERR_*` family. No Linux errno starts with `ERR_`, so the exclusion drops no real operating-system
    code, and an `ERR_*` code reads honestly as not recognised, with the code shown.
  - **`Security.Forbidden` as a permission.** Neo4j's status codes treat `Forbidden` as a missing privilege and
    `Unauthorized` as bad credentials.
    - The repo agrees: the pass's boot-retry credential list names `Unauthorized`, `AuthenticationRateLimit` and
      `CredentialsExpired` and leaves `Forbidden` out (`graph.js:432-443`).
    - So does the path's own list of auth failure codes (`realtime/index.js:91-95`).
    - Both Security sentences already name the credentials, or the permission that user has.
  - **The repo's own `EBADJSON`, `EBADRUNID`, `EBADHELD` and `EBADSWITCH`** also match `^E…`. `EBADJSON` has an
    exact entry, and the others reach a code only through a bug, so nothing changes.
- **`:812-813` (Out of scope):** the switch, its prompt and its widening to admins are story 5's (this ADR). The
  pass's run, stop and confirm are story 6's.

### ADR 0002 (R2-8)

- **`:548-550`:** keep the sentence. Since story 5's Planning (2026-10-01), the pass's controls, Stop included, are
  story 6's, and story 5 is the path's switch.
- **`:815-817`, decision 14:**
  - **until story 4,** AC-7's "read its report on the instance" was met by the JSON status URL, and since story 4 the
    panel shows it;
  - **until story 6,** AC-5's confirmation is a signed-in `fetch` from the owner's browser (OPERATIONS carries the
    snippet).
- **`:1237` (Out of scope):** the real-time path (story 3), the panel (story 4), the path's switch on it (story 5),
  and the pass's run, stop and confirm (story 6), except the bindings for story 3 above.

## Out of scope

- **The pass's controls** (run, stop, confirm, a waiting pass, the run-task gate, ledger
  `2026-09-28-confirm-route-joins-finishing-job`): story 6.
- **Changing how fast the path starts or stops.** Story 3's engine and wrapper stand.
- **Refusing an off that cannot be recorded.** It would change story 3 AC-5.
- **Keeping the previous `switch.json` when the off fallback runs.** Renaming it to a sibling file, instead of
  unlinking it, would close residual (a). It was weighed and not taken: it changes story 3's fallback for a full-disk
  corner.
- **An `ERR_` family with its own sentence.** It is a possible later nicety.
- **The 2026-07-21 intake sweep** of other open routes, and Streaming ETL's controls.
