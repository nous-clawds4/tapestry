# Test Plan: Story 1 — Changing streams doesn't interrupt the other streams

**Story:** `engineering-team/stories/relay-stream-gaps/1-stream-changes-without-router-restart.md`
**ADR:** `engineering-team/decisions/relay-stream-gaps/0001-reload-router-config-in-place.md`
**Date:** 2026-10-09

All new tests are in one stack-free suite, `test/router-config-reload-in-place.test.js`
(33 tests), registered in `test/registry.js` right after `strfry-router-value-hardening`.
One existing test is re-aimed: R1 in `test/router-stream-tag-filters.test.js`.

## Coverage map

Levels: **unit** = pure function; **handler** = an Express handler called with a fake
`req`/`res`, with `child_process` and the router's files behind seams (see Test
infrastructure); **source** = source-text sentinel, the house style for JSX and BIBLE.

| Criterion | Test name (abridged; full names in the suite) | Test file | Level |
|---|---|---|---|
| AC-1 | H1: toggling one stream off while the router runs: no restart, config rewritten in place, the untouched stream's block byte-identical, success with `applied: "reloaded"` | `test/router-config-reload-in-place.test.js` | handler |
| AC-1 | H2: toggling a stream on while the router runs: no restart, stream added in place, `Stream "gamma" enabled.` | same | handler |
| AC-1 | X1: the log rotating between the config write and the Loading line still confirms the reload, with no restart | same | handler |
| AC-1, AC-2 | C1–C5: `classifyReloadLog`: Loading only → loaded; Loading + Failed → rejected with strfry's reason; no Loading → not loaded; a Failed line *before* Loading doesn't count; a later Loading line bounds the search | same | unit |
| AC-1, AC-2 | L1–L4: `readLogSince`: reads from the offset and returns the size; reads from 0 when the log shrank (rotation); a missing or unreadable log gives `{ text: '', size: 0 }` and never throws | same | unit |
| AC-1, AC-2 | P1: `getRouterProcessStatus` is exported from routerStatus.js and reads RUNNING (with uptime) and STOPPED | same | unit |
| AC-2 | H3: saving streams (keep, edit, delete, add) while the router runs: no restart, config in place matches the saved streams, `Router config updated.` | same | handler |
| AC-2 | H4: Restore Defaults while the router runs: no restart, config in place matches the presets, the `Restored N preset stream(s) (K enabled).` message has no restart wording | same | handler |
| AC-3 | J (x3, toggle / save / Restore Defaults): strfry rejects the change → HTTP 500, `success: false`, the error has strfry's reason and "It is still running the previous streams; nothing was changed."; state file and config are rolled back in place; no restart | same | handler |
| AC-3 | J4: a rejection logged 100 ms after the Loading line is still caught (settle window) | same | handler |
| AC-3 | T (x3, toggle / save / Restore Defaults): no reload logged within the timeout (an older Loading line in the log doesn't count) → restarted once, after the write; `applied: "restarted"`; the message says the router "did not pick it up by itself, so it was restarted" | same | handler |
| AC-3 | T4: a missing router log ends in the restart fallback, never a silent success or a crash | same | handler |
| AC-3 (ADR step 1) | N (x2, STOPPED / FATAL): router not running → write, then restart straight away (under 2 s, no log wait), `applied: "restarted"` | same | handler |
| AC-1, AC-3 (ADR serialization) | Q1: two overlapping toggles of different streams both persist, both confirmed by reload | same | handler |
| AC-3 (ADR serialization) | Q2: a rejected toggle's rollback doesn't undo an overlapping toggle of another stream | same | handler |
| AC-4 | G1: the Restart button still runs `supervisorctl restart strfry-router` (guard) | same | handler |
| AC-4 | U1: RelaySettings.jsx no longer says "This will restart the router"; the delete confirmation is `` `Delete stream "${name}"?` ``; no confirmation in the Router Management section mentions a restart | same | source |
| AC-4 (server wording) | H1–H4 exact reload messages and T's restart clause: no success message says the router was restarted unless it was | same | handler |
| AC-5 | G2: `initRouter` still writes the saved streams to the config in place (over the entrypoint's empty fallback, same inode) and doesn't restart (guard) | same | handler |
| ADR (routerStatus refactor) | G3: GET router-status answers as before: process status with uptime, paths, saved streams (guard) | same | handler |
| ADR § Implementation notes (BIBLE) | D1: BIBLE §14 "Presets are opt-in…" mentions in-place rewrite, reload, reconnecting only changed streams, and that only the Restart button restarts | same | source |
| ADR § Consequences (strfry bump) | S1: routerConfig.js defines the log path and both strfry log strings, with a comment naming strfry 1.1.0 | same | source |
| AC-3, AC-4 (contract reversal) | R1 (re-aimed): exports kept; `applyConfig` calls `getRouterProcessStatus()` and `waitForReload()`; config written with `fs.writeFileSync(ROUTER_CONFIG_PATH…)` and never renamed, copied or unlinked; `handleRestartRouter` still runs `supervisorctl restart strfry-router` | `test/router-stream-tag-filters.test.js` | source |

**What "not restarted" means at this level.** The router-status uptime is the
`supervisorctl status strfry-router` line, so "uptime keeps counting" = no
`supervisorctl restart strfry-router` ran. "Other streams stay connected" depends on strfry
reconnecting only streams whose `dir`/`filter` changed (ADR § Context, § Verified evidence 1).
Our side of that is (a) no restart and (b) untouched streams' config blocks staying
byte-identical. H1 asserts both.

### Live verification (not run; no stack this session)

These parts of AC-1, AC-2 and AC-5 need a running strfry and can't be tested stack-free:
- the 10-second window;
- untouched streams still receiving events;
- uptime on a real router;
- deploy and container restart.

Suggested manual check for the Reviewer or operator on a running stack:
1. `docker exec tapestry supervisorctl status strfry-router`: note the pid and uptime.
2. Toggle one stream in `/tapestry/settings/relays`. Within 10 s,
   `docker exec tapestry tail -n 40 /var/log/supervisor/strfry-router-error.log` should show a
   new `Loading router config file` line, with Disconnected/Connecting lines only for the
   toggled stream. The status pid is unchanged and the uptime keeps counting.
3. Publish an event upstream matching an untouched stream's filter. It arrives locally.
4. Repeat for save (add, edit, delete), Restore Defaults and preset import.
5. Press Restart: the uptime resets (AC-4). Restart the container: the same streams come back
   (AC-5).

## Edge cases

- [x] A stale rejection and a stale Loading line are already in the log before the write.
  Every handler test seeds them; reading from 0 instead of the pre-write offset fails 13 tests
  (see Verification).
- [x] Log rotated between the write and the Loading line (X1, L2).
- [x] Router log missing (T4, L3), or unreadable because it's a directory (L4).
- [x] Rejection line arriving after the Loading line, inside the settle window (J4).
- [x] Router not running: STOPPED and FATAL (N x2).
- [x] Concurrent calls: overlapping toggles, with and without a rejection (Q1, Q2).
- [x] The config is replaced instead of rewritten (temp + rename, copy, unlink): caught by the
  recorded fs calls and the inode check in every handler test.
- [x] Rollback writes the previous config **in place** too (J: ≥ 2 config writes, inode
  unchanged, content = `generateConfig(prev.streams)`).
- [ ] Concept Graph API unavailable / concept handle not found: not applicable. The story touches
  no concepts (ADR § Constraints).
- [ ] Ingress validation and owner gate: unchanged by this story and pinned by
  `strfry-router-value-hardening` and `strfry-router-owner-gate`. Both still pass with the new
  path: their exec stubs answer `ok` to `supervisorctl status`, so the router counts as not
  running and they take the immediate write + restart path, with no log wait.

## Choices the ADR left open (the Implementer should know)

1. **`readLogSince` must be exported.** The ADR says "Export it" only for `classifyReloadLog`;
   L1–L4 call `readLogSince(path, offset)` directly. They compare only `text` and `size`.
2. **Router status comes from `supervisorctl status strfry-router` via `child_process.exec`.**
   This is the existing parsing, moved into `getRouterProcessStatus()`. The tests stub
   `exec`/`execFile` (incl. `util.promisify`) before **both** routerStatus.js and routerConfig.js
   load, so any import style works. A different status command would read as "not running".
3. **Config writes must be `fs.writeFileSync(ROUTER_CONFIG_PATH, …)`** (or `fs.writeFile` /
   `fs.promises.writeFile`) by path. The fake strfry only reacts to those. A write through a file
   descriptor or stream isn't seen and would end in the timeout fallback.
4. **Log reads must go through `fs` by path** (`statSync`, `readFileSync`, `openSync` + fd
   reads, `createReadStream`, or the `fs.promises` equivalents). The suite redirects those for
   `ROUTER_LOG_PATH`.
5. **The timeout isn't injectable, so the suite dilates time 20x for the T tests.** It patches
   global `setTimeout`/`setInterval`, `Date.now`, `performance.now` and
   `timers/promises.setTimeout`, and keeps `util.promisify(setTimeout)` working. A
   `waitForReload` built from those runs each T test in about 150 ms. One built on anything else
   (e.g. `new Date()`) still passes but takes the full 3 s per test (4 tests, about +12 s). No
   production seam is needed.
6. **Message punctuation for the restart clause.** The update message is pinned exactly:
   `Router config updated; the router did not pick it up by itself, so it was restarted.` For
   toggle and Restore Defaults the tests check the kept prefix (`Stream "beta" disabled`,
   `Restored N preset stream(s) (K enabled)`) plus the clause, so the joining punctuation is
   the Implementer's choice. The reloaded messages are pinned exactly (today's message).
7. **The reason's leading `": "` isn't pinned.** Tests check `error.includes(reason)`.
   Recommendation: strip it, so the operator sees
   `(unrecognised filter item: bogusfield)` rather than `(: unrecognised…)`.
8. **The not-running message isn't pinned.** Only `success`, `applied: 'restarted'`, write
   before restart, and no log wait (< 2 s) are.
9. **The rejection error is pinned by substrings**: `The router rejected the new configuration`,
   the reason, and `It is still running the previous streams; nothing was changed.`
10. **The rolled-back state file must equal the pre-mutation state** (JSON, key order as
    loaded), so `prev` must be a copy taken inside the lock before the mutation.
11. **Lock order.** Q2 assumes handlers enter `withRouterLock` in call order (synchronously at
    handler entry), with the read-state → … → rollback span inside the lock.
12. **R1 / S1 source sentinels.**
    - The body of `async function applyConfig` must call `getRouterProcessStatus(` and
      `waitForReload(` by those names. The slice ends at the next top-level `/**` or `// ──`.
    - The file must contain the three log constants' string values and the text
      `strfry 1.1.0`.
13. **The auth module is stubbed while routerConfig.js loads.** The stub exports only
    `isOwner`, so routerConfig.js should keep needing only `isOwner` from it, as the ADR says.

## Test infrastructure

- Test framework: Node built-in runner (`npm test` → `test/test.js` → `test/registry.js`).
  Read a run's result per [Running and reading the test gate](../../README.md#running-and-reading-the-test-gate).
  No new dependencies or infrastructure.
- Concept Graph API: not used. No live-API suites; the live checks above are manual.
- Firmware state: none required.
- Seams, all inside the suite's `run()` and removed when it ends:
  - `child_process.exec`/`execFile` stub: answers RUNNING / STOPPED / FATAL and records
    commands.
  - `fs` redirect of the three router paths (`/etc/strfry-router-tapestry.config`,
    `/var/lib/brainstorm/router-state.json`, `/var/log/supervisor/strfry-router-error.log`)
    into a temp dir, with every call recorded.
  - A fake strfry 1.1.0 that appends the real log line shapes (ADR § Verified evidence 4)
    about 50 ms after each config write: reload, reject, late reject, rotate + reload, or
    silent.
  - Time dilation for the timeout tests only.
  - An `auth` stub while routerConfig.js loads, so the suite runs without `node_modules`.
  - Fresh `require`s of routerStatus.js and routerConfig.js, evicted from the cache afterwards.
- Fixtures (in-suite): three streams (`alpha` on, `beta` on, `gamma` off), an edit set
  (keep / edit / delete / add), and `setup/router-presets.json` (read, never written).

## How to run

```
npm test
node test/router-config-reload-in-place.test.js        # just this suite
```

Since 2026-10-09 this checkout has root `node_modules` installed (`npm ci`, as CI does), so `npm test` runs every suite. On a checkout without it, The new suite doesn't need it (auth stub), but many
pre-existing suites do. For a fuller run without touching the repo, install the locked deps
elsewhere and point `NODE_PATH` at them (ESM `import`s ignore `NODE_PATH`, so a few suites still
fail to import `nostr-tools`):

```
mkdir -p /tmp/deps && cp package.json package-lock.json /tmp/deps && (cd /tmp/deps && npm ci --ignore-scripts)
NODE_PATH=/tmp/deps/node_modules npm test
```

No browser/e2e tests: the only UI change is one confirm string (source-level U1).

## Verification

The new tests fail with the current code. Confirmed on 2026-10-09 at commit `9c977c2`, with
the test changes uncommitted (Node v22.22.0, no stack, no `node_modules`):

```
--- router config reload-in-place tests (relay-stream-gaps #1) ---
  FAIL  C1: classifyReloadLog — a Loading line with no failure after it means the router took the change up
        routerConfig.js must export classifyReloadLog(): not implemented yet (ADR relay-stream-gaps/0001).
  FAIL  C2: classifyReloadLog — a "Failed to parse router config" line after the Loading line means the router rejected the change, and carries strfry's reason
        routerConfig.js must export classifyReloadLog(): not implemented yet (ADR relay-stream-gaps/0001).
  FAIL  C3: classifyReloadLog — no Loading line (empty log, unrelated lines, or a lone Failed line) means the router has not reacted yet
        routerConfig.js must export classifyReloadLog(): not implemented yet (ADR relay-stream-gaps/0001).
  FAIL  C4: classifyReloadLog — a rejection logged BEFORE the Loading line belongs to an older edit and does not count
        routerConfig.js must export classifyReloadLog(): not implemented yet (ADR relay-stream-gaps/0001).
  FAIL  C5: classifyReloadLog — a later Loading line bounds the search: a failure after it belongs to the later reload, a failure before it to this one
        routerConfig.js must export classifyReloadLog(): not implemented yet (ADR relay-stream-gaps/0001).
  FAIL  L1: readLogSince — returns only the text written after the given byte offset, and the file's current size
        routerConfig.js must export readLogSince(): not implemented yet (ADR relay-stream-gaps/0001).
  FAIL  L2: readLogSince — reads from the start when the log shrank below the offset (supervisord rotated it)
        routerConfig.js must export readLogSince(): not implemented yet (ADR relay-stream-gaps/0001).
  FAIL  L3: readLogSince — a missing log returns empty text and size 0, never throws
        routerConfig.js must export readLogSince(): not implemented yet (ADR relay-stream-gaps/0001).
  FAIL  L4: readLogSince — an unreadable log (here a directory) returns empty text and size 0, never throws
        routerConfig.js must export readLogSince(): not implemented yet (ADR relay-stream-gaps/0001).
  FAIL  P1: getRouterProcessStatus is exported from routerStatus.js and reads supervisorctl's RUNNING line with its uptime, and STOPPED
        routerStatus.js must export getRouterProcessStatus(): not implemented yet (ADR relay-stream-gaps/0001).
  FAIL  H1: toggling one stream off while the router runs — no restart, config rewritten in place, the untouched stream's block byte-identical, success with applied "reloaded" (AC-1)
        toggle off: the router was restarted (supervisorctl restart strfry-router ran 1x), which disconnects every stream. Stream changes must be applied by an in-place reload (ADR relay-stream-gaps/0001).
  FAIL  H2: toggling a stream on while the router runs — no restart, the stream is added to the config in place, "Stream "gamma" enabled." (AC-1)
        toggle on: the router was restarted (supervisorctl restart strfry-router ran 1x), which disconnects every stream. Stream changes must be applied by an in-place reload (ADR relay-stream-gaps/0001).
  FAIL  H3: saving streams (keep one, edit one, delete one, add one) while the router runs — no restart, config in place matches the saved streams, "Router config updated." with applied "reloaded" (AC-2)
        save: the router was restarted (supervisorctl restart strfry-router ran 1x), which disconnects every stream. Stream changes must be applied by an in-place reload (ADR relay-stream-gaps/0001).
  FAIL  H4: Restore Defaults while the router runs — no restart, config in place matches the presets, the message keeps its "Restored N preset stream(s)" form with no restart wording (AC-2)
        Restore Defaults: the router was restarted (supervisorctl restart strfry-router ran 1x), which disconnects every stream. Stream changes must be applied by an in-place reload (ADR relay-stream-gaps/0001).
  FAIL  X1: the log rotating between the config write and the Loading line still confirms the reload, with no restart (AC-1)
        toggle with a log rotation: the router was restarted (supervisorctl restart strfry-router ran 1x), which disconnects every stream. Stream changes must be applied by an in-place reload (ADR relay-stream-gaps/0001).
  FAIL  J: toggling a stream off that strfry rejects — HTTP 500 naming strfry's reason and saying the previous streams still run; state file and config rolled back in place; no restart (AC-3)
        expected HTTP 500 for a change the router rejected; got null {"success":true,"message":"Stream \"beta\" disabled.","stream":{"name":"beta","enabled":false}}. Success must never be reported for a change that did not take effect (AC-3).
  FAIL  J: saving streams (add, edit, delete) that strfry rejects — HTTP 500 naming strfry's reason and saying the previous streams still run; state file and config rolled back in place; no restart (AC-3)
        expected HTTP 500 for a change the router rejected; got null {"success":true,"message":"Router config updated and restarted."}. Success must never be reported for a change that did not take effect (AC-3).
  FAIL  J: Restore Defaults that strfry rejects — HTTP 500 naming strfry's reason and saying the previous streams still run; state file and config rolled back in place; no restart (AC-3)
        expected HTTP 500 for a change the router rejected; got null {"success":true,"message":"Restored 7 preset stream(s) (0 enabled)."}. Success must never be reported for a change that did not take effect (AC-3).
  FAIL  J4: a rejection logged a moment after the Loading line is still caught (the settle window), not reported as success (AC-3)
        a Failed line arriving 100 ms after the Loading line must still be reported as a rejection; got null {"success":true,"message":"Stream \"beta\" disabled.","stream":{"name":"beta","enabled":false}}
  FAIL  T: toggling a stream off when the router never logs a reload (an older Loading line in the log doesn't count) — restarted as before, applied "restarted", and the message says the router "did not pick it up by itself, so it was restarted"
        the response must say the change was applied by restart
        expected: "restarted"
        actual:   undefined
  FAIL  T: saving streams (add, edit, delete) when the router never logs a reload (an older Loading line in the log doesn't count) — restarted as before, applied "restarted", and the message says the router "did not pick it up by itself, so it was restarted"
        the response must say the change was applied by restart
        expected: "restarted"
        actual:   undefined
  FAIL  T: Restore Defaults when the router never logs a reload (an older Loading line in the log doesn't count) — restarted as before, applied "restarted", and the message says the router "did not pick it up by itself, so it was restarted"
        the response must say the change was applied by restart
        expected: "restarted"
        actual:   undefined
  FAIL  T4: a missing router log ends in the restart fallback, never a silent success or a crash
        with no readable log the change is applied by restart
        expected: "restarted"
        actual:   undefined
  FAIL  N: router STOPPED — the config is written and the router restarted straight away (no wait on the log), applied "restarted"
        a router that is not running is started by the restart
        expected: "restarted"
        actual:   undefined
  FAIL  N: router FATAL — the config is written and the router restarted straight away (no wait on the log), applied "restarted"
        a router that is not running is started by the restart
        expected: "restarted"
        actual:   undefined
  FAIL  Q1: two overlapping toggles of different streams both persist — neither update is lost, and both are confirmed by reload
        the alpha toggle must succeed by reload; got null {"success":true,"message":"Stream \"alpha\" disabled.","stream":{"name":"alpha","enabled":false}}
  FAIL  Q2: a rejected toggle's rollback does not undo an overlapping toggle of another stream (mutations are serialized)
        the first toggle's config was rejected, so it must report HTTP 500; got null {"success":true,"message":"Stream \"alpha\" disabled.","stream":{"name":"alpha","enabled":false}}
  PASS  G1: the Restart button still restarts the router — handleRestartRouter runs supervisorctl restart strfry-router (AC-4)
[router] Initialized: 3 streams (3 enabled)
  PASS  G2: initRouter (deploy / container start) still writes the saved streams to the config in place and does not restart the router (AC-5)
  PASS  G3: GET /api/strfry/router-status answers as before — process status with uptime, config and state paths, and the saved streams
  FAIL  U1: the Router Management tab no longer warns that deleting a stream restarts the router, and no stream-change confirmation mentions a restart (AC-4)
        RelaySettings.jsx still says "This will restart the router." Stream changes no longer restart it (AC-4).
  FAIL  D1: BIBLE §14 says stream changes rewrite the router config in place and reload it, reconnecting only changed streams, and that only the Restart button restarts the router
        BIBLE §14 must gain the ADR's sentence; it doesn't mention "in place" (ADR relay-stream-gaps/0001 § Implementation notes).
  FAIL  S1: routerConfig.js pins the strfry 1.1.0 log strings and the router stderr log path, with a comment naming strfry 1.1.0 (a strfry bump must re-verify them)
        routerConfig.js must define the constant "/var/log/supervisor/strfry-router-error.log": not implemented yet (ADR relay-stream-gaps/0001).
router-config-reload-in-place: 3 passed, 30 failed, 0 skipped
```

Re-aimed R1 (`NODE_PATH` deps; current code):

```
  ✗ R1 (re-aimed by relay-stream-gaps #1, ADR relay-stream-gaps/0001): routerConfig.js keeps its existing exports; …
      applyConfig must check the router process (getRouterProcessStatus) and confirm the in-place reload from the router log (waitForReload) instead of always restarting — relay-stream-gaps #1 not implemented yet (ADR relay-stream-gaps/0001).
```

Full gate totals (`npm test`, read from the printed `Overall:` line):

| Run | Before | After | Delta |
|---|---|---|---|
| bare (no `node_modules`) | 4284 passed, 472 failed, 584 skipped, 276 suites | 4287 passed, 502 failed, 584 skipped, 277 suites | +3 / +30: exactly the new suite (3 guards pass, 30 fail). No other suite changed. |
| `NODE_PATH` deps | 4851 passed, 261 failed, 590 skipped, 276 suites | 4853 passed, 292 failed, 590 skipped, 277 suites | +2 / +31: the new suite (+3 / +30) and the re-aimed R1 (pass → fail). No other suite changed. |

Both "before" runs were already FAIL. The failures there are environmental: missing
`node_modules`, ESM imports of `nostr-tools`, and live-stack preconditions.
`strfry-router-owner-gate` (10/10) and `strfry-router-value-hardening` (14/14) pass in the deps
run, before and after. `stack-free-npm-test` (G5, registration) passes.

**The tests can pass.** They were run against a throwaway implementation of the ADR's
Implementation notes, built in the session scratchpad: a copy of the files, never in `src/`,
not committed, not handed over. Results:
- 33/33 passed in about 6 s;
- stable over 5 sequential and 6 concurrent runs;
- the re-aimed R1 passes;
- `strfry-router-value-hardening` still passes 14/14.

Mutants of that implementation were each caught:

| Mutant | Tests that fail |
|---|---|
| no lock | Q2 |
| log read from offset 0 | 13 (H1–H4, J x3, J4, T x3, Q1, Q2) |
| temp file + rename instead of in-place write | 15 |
| no settle wait | J4 |
| no rollback | 5 (J x3, J4, Q2) |

## Amendment (2026-10-09): PR #787's restart-counting assertions

The operator chose to land PR #787 (router hardening) before this story, so its suite
`test/strfry-router-saved-state.test.js` reached this branch after test design. Three of its
assertions counted every `exec` call and expected exactly one, the restart (P, V2, V6). Under
ADR 0001 a stream change first asks supervisord for the router's status, and that suite's stub
never answers RUNNING, so the change is applied by the not-running restart: one status call
plus one restart. The three assertions now count `supervisorctl restart strfry-router`
commands (exactly one) instead of all exec calls. Their intent, "config written once, then the
router restarted", is unchanged, and they pass on #787's code as well. The "no exec at all"
assertions (refused requests, `initRouter`) and V3 (the Restart button) are untouched.

## Amendment 2 (2026-10-09): tests for ADR 0001 Amendment 1

Added after review 1 (`engineering-team/reviews/relay-stream-gaps/1-stream-changes-without-router-restart.md`),
for ADR 0001 Amendment 1. All in `test/router-config-reload-in-place.test.js`:

| Criterion | Test | Level |
|---|---|---|
| AC-3 (review 1, blocking 1) | K1: A rejected, B queued and also rejected → both HTTP 500, state and config back to the previous streams, no restart. Fails on the round-1 code: B returns `success: true, applied: "reloaded"` | handler |
| AC-3 (Amendment 1 item 1) | K ×2: the rollback's reload is never logged, or is itself rejected → exactly one restart (after the in-place rollback write), HTTP 500 with `It was restarted to put the previous streams back; nothing was changed.` | handler |
| Amendment 1 item 2 | W1: the first log read after the write fails (EMFILE) → the read position is kept, so the old Loading + Failed pair before the offset is not read; the toggle succeeds by reload | handler |
| Amendment 1 item 2 | L5: `readLogSince` marks a failed read with `ok: false`; a good read isn't marked failed. L3/L4 now compare `text` and `size` only, since the return value gains `ok` | unit |
| Review 1, non-blocking 6 | G4 (guard): #787's `skipped` reporting on the reload path. An invalid saved stream is left out of the config and listed, and the change still applies by reload | handler |
| Review 1, blocking 2 | D1 also requires BIBLE §14 to mention the fallback restart. D2: `docs/CONFIGURATION.md` no longer says toggling restarts the router or "restarts as usual", and its Router Management paragraph mentions in place, reload, fallback and Restart | source |

New seams:
- **Log-read failure.** `env.failLogReads` arms a one-shot EMFILE on the next stat/open/read of the log path.
- **Fake strfry reaction `read-error-reload`.** It arms that failure on a config write, then logs the reload 50 ms later.

Against the round-1 code: 33 passed, 7 failed (L5, K1, K ×2, W1, D1, D2), each for the defect it targets.

