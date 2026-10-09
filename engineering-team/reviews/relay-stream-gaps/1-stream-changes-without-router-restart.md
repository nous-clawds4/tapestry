# Review: Story 1 — Changing streams doesn't interrupt the other streams

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-09
**Diff:** story 1's commits on `relay-stream-gaps`: `1069b8bf` (tests), `440863b3` (Phase 3 amendment to #787's suite), `fea06ec7` (impl). Implementation diff: `git diff 82b54ece..fea06ec7` (HEAD `fea06ec7`). PR #787 (merged in at `82b54ece`) was not itself reviewed; story 1 is reviewed on top of it.
**Story:** `engineering-team/stories/relay-stream-gaps/1-stream-changes-without-router-restart.md`
**ADR:** `engineering-team/decisions/relay-stream-gaps/0001-reload-router-config-in-place.md`
**Test plan:** `engineering-team/stories/relay-stream-gaps/1-stream-changes-without-router-restart.test-plan.md`

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` (root `node_modules` installed, as in CI). `npm run gate:status`:
  `20261009T041932Z-5548-ce58 [reviewer-rsg1] started 2026-10-09T04:19:32.039Z on fea06ec7 — PASS, exit 0, 5177 passed, 0 failed, 590 skipped, 278/278 suites`.
  This matches the Implementer's recorded run (`20261009T035909Z-25122-d60b`, same totals).
- [x] Router suites run directly: `router-config-reload-in-place` 33/0, `strfry-router-saved-state` 32/0,
  `strfry-router-owner-gate` 10/0, `strfry-router-value-hardening` 14/0. `router-stream-tag-filters` 21/0 in the gate run, with re-aimed R1 ✓.
- [x] `bash scripts/harness-lint.sh`: `harness-lint: clean (0 violations)`.
- [ ] `npm run test:playwright`: not applicable. The only UI change is one confirm string, pinned by source sentinel U1.
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._

Extra evidence gathered by the reviewer (session scratchpad, not committed):
- **Probe of the suite's own fake strfry.** I copied the suite with one added test: toggle A is rejected, toggle B is queued behind it, and B is also rejected (plan `['reject','reload','reject']`). Result: A `500`. B returned `{"success":true,"message":"Stream \"gamma\" enabled.","applied":"reloaded"}`, a false success. See Blocking 1.
- **Live strfry 1.1.0 sandbox.** I used the binary built for the ADR's Verified evidence, an upstream relay, and a router with streams `a1 {kinds:[1]}` and `b2 {kinds:[7]}`. I made an in-place write that changes `a1` to `kinds:[30000]` (valid) and gives `b2` a non-hex author. Log:
  `Loading router config file` → `a1: Disconnected / Connecting` → `ERR| Failed to parse router config: error parsing authors: unexpected character in from_hex: 110` → `a1: Connected`.
  A kind-1 published upstream then did **not** arrive: the rejected config was half-applied. Rewriting the previous config in place (the code's rollback) reconnected `a1` and `b2`, and kind 1 arrived again. See Blocking 1 and Non-blocking 1.
- **#787's code with the amended assertions.** I exported a tree at `440863b3` (#787's routerConfig plus the amended test) and ran `strfry-router-saved-state`: P, V2 and V6 pass. The one failure, D1, came from my export omitting `docs/`. This confirms the test plan Amendment's claim.

## Spec adherence
- [x] Every acceptance criterion has a passing test at the level reachable stack-free:
  - **AC-1:** H1, H2, X1, plus C1–C5, L1–L4, P1, Q1.
  - **AC-2:** H3, H4.
  - **AC-3:** J ×3, J4, T ×3, T4, N ×2, Q2.
  - **AC-4:** G1, U1, and the exact messages in H/T.
  - **AC-5:** G2.
  - **Contract reversal:** R1.
  - **BIBLE wording:** D1.
- [ ] No criterion is silently dropped. **AC-3 has a gap:** a queued mutation can be confirmed by the previous mutation's rollback reload (Blocking 1). The 10-second live behaviour of AC-1/AC-2 and the deploy behaviour of AC-5 are not checkable stack-free; they become the post-deploy manual check (Non-blocking 5).
- [x] No behavior added that isn't in the story. The extra not-running message is accurate and inside the test plan's open choice 8 (Non-blocking 4).

## ADR adherence
- [x] Files changed match the ADR's implementation notes: `routerConfig.js`, `routerStatus.js`, `RelaySettings.jsx`, BIBLE §14. Constants, `classifyReloadLog`, `readLogSince`, `waitForReload`, `RouterRejectedError`, `withRouterLock`, `applied` in responses and the message strings all match. **One omission:** `docs/CONFIGURATION.md` describes the changed behaviour and is not in the ADR's file list (Blocking 2).
- [ ] Consequence "Mutations are serialized … keeps rollback correct and log windows disjoint" (ADR :139–142) is **not delivered**. The rollback's own reload is not awaited inside the lock (Blocking 1).
- [x] In-place invariant. Every write of `ROUTER_CONFIG_PATH` is `fs.writeFileSync(ROUTER_CONFIG_PATH, …)`: `routerConfig.js` :485, :491, :501, :696, :763. No rename, copy or unlink anywhere. The only other writers are `docker/entrypoint.sh:247,256`, which run before supervisord starts the router.
- [x] Layering respected; `routerConfig.js` → `routerStatus.js` creates no cycle. No new dependencies.

## Concept-graph integrity
- [x] No concept handles touched (the router config holds plain URL strings only).
- [x] No firmware reinstall needed (no concept definitions changed).
- [x] N/A: no concept-graph reads.

## Things tests can't catch
- [x] No secrets in committed files.
- [x] No leftover debug logging. The new code adds no `console.*`; existing `console.error` calls in the handlers are unchanged.
- [x] No commented-out code.
- [ ] Error paths and edge cases. Rotation, missing log, partial lines and large logs are handled:
  - `readLogSince` reads only the bytes after the offset (`:403–419`); `logSize` only stats.
  - Partial lines join up because `waitForReload` appends raw text (`:440–444`).
  - Rotation reads the new file from 0.
  - Weak spots: a transient read error re-reads the whole log (Non-blocking 2), and the rollback is unconfirmed (Blocking 1).
- [ ] Concurrency.
  - What is correct: all three handlers call `withRouterLock` synchronously before their first await (`:597`, `:622`, `:735`). `prev` is cloned inside the lock (`:598`, `:623`, `:736`). `routerLock = run.catch(() => {})` (`:519`), so a throw never poisons the chain.
  - What is not: log windows are not disjoint after a rejection (Blocking 1).
- [x] Security. `requireOwnerOrLocal` is still the first statement of every mutating handler: `:542`, `:616`, `:693`, `:714`. No new inputs. strfry's reason is reflected only to the owner and rendered as React text.

## House rules check
- [x] Concept Graph API authority respected (not applicable).
- [x] No new lint/typecheck/build tooling.

## Product-guide adherence *(when the story traces to a PRD)*
- N/A (acceptance-frame book, no PRD).

## Findings

### Blocking

1. **`src/api/strfry/routerConfig.js:499–503` (with `:490`, `:516–521`): the rollback's reload is not awaited, so the next queued mutation can take it as its own confirmation, which gives a false success (AC-3).**
   - **Sequence.** On a rejection, `applyConfig` writes the previous config back and throws at once, and the lock releases. strfry logs that rollback's `Loading router config file` line about 50 ms later.
   - **How B is misread.** A mutation B already queued behind it takes its log offset (`:490`) as soon as `getRouterProcessStatus()` returns. If that is before the rollback's Loading line, B's window starts with the rollback's reload. `classifyReloadLog` binds B to that first Loading line and stops at B's own Loading line, so a rejection of B's config is never seen. B reports `success: true, applied: "reloaded"` while strfry runs the rolled-back config and the state file holds B's.
   - **Demonstrated** with the suite's own fake strfry (Quality gates, probe).
   - **In production** only the latency of B's `supervisorctl status` call stands between the two, usually 100–300 ms against strfry's 50 ms debounce. A busy router main thread can exceed that. So AC-3 holds by accident of timing, not by construction, and the ADR's "log windows disjoint" (ADR :139–142) is not met.
   - **The rollback is also load-bearing.** strfry 1.1.0 does not keep the running config when a later stream group fails. It configures groups in name order, so earlier groups have already taken the new settings (Non-blocking 1, live sandbox). Until the rollback reload lands, the router runs a mix. The error's "It is still running the previous streams; nothing was changed." is a claim the code never checks.
   - **Asked change (Implementer):** after the rollback write, take a fresh offset before it and `await waitForReload(…)` inside the lock before throwing. That makes the next mutation's window start after the rollback's reload. Record it as a deviation (or as an ADR addendum note).
   - **Architect's call:** what to do when the rollback reload is itself not seen (timeout) or rejected. My recommendation: fall back to the restart, which loads the rolled-back file, and adjust the message to match.
   - **Asked change (Tester):** add a regression test for the probe case (A rejected, B queued and also rejected → B gets HTTP 500). The current suite cannot catch this: Q2 passes because B's own write reloads.
   - **Effect on existing tests:** I traced J ×3, J4 and Q2 against the asked change. They stay green; each J case gains about 0.4 s.

2. **`docs/CONFIGURATION.md:175`, `:190` and `BIBLE.md:1155`: the operator docs now contradict the code on the exact behaviour this story changes.**
   - **CONFIGURATION.md:175** says "toggling enabled/disabled rewrites the daemon config and restarts `strfry-router` via `supervisorctl`".
   - **CONFIGURATION.md:190** says that on toggle and restore-defaults "the other streams are written and the router restarts as usual". BIBLE §14 links this page as the authority on router values.
   - **BIBLE.md:1155** (the ADR-prescribed sentence) ends "only the Restart button restarts the router". The same diff restarts on two fallbacks and tells the operator so (`routerConfig.js:484–487`, `:494–496`, messages `:506–511`). An operator who sees "the router did not pick it up by itself, so it was restarted" and then reads the BIBLE gets a contradiction.
   - **Asked change:**
     - Correct both CONFIGURATION.md sentences: stream changes rewrite the config in place and strfry reloads it; the router restarts only as a fallback or via Restart.
     - Qualify the BIBLE sentence. Suggested wording, which still satisfies D1's regexes (`in place`, `reload`, `reconnect`, `Restart button`, `only`): "…reconnecting only the streams whose direction, filter or relays changed. The router is restarted only by the Restart button, or as a fallback when it isn't running or logs no reload within 3 s (the response then says so)."
     - Saved-state D1 pins a different CONFIGURATION.md section ("Auditing saved plugin paths"), so these edits don't touch it.
     - This is a file outside the ADR's list, so log it as a deviation.
     - Per reviewer rule 10, the next round checks this wording as a fresh claim.

### Non-blocking

1. **ADR `0001` :43–45 and :136–138: two factual claims about strfry are wrong in general.**
   - **"Keeps the running config"** holds only when the failure is in parsing or in the first group processed. `reconcileConfig()` (`cmd_router.cpp:299–356`) calls `StreamGroup::configure()` (`:80–134`) per group in `std::map` (name) order (`tao/json/basic_value.hpp:49`). Groups before the failing one are reconfigured, new ones are created and connected, and the failing group's `dir`/`filterStr` are updated.
   - **"Rolling the config back … applies with no reconnects"** is also false: the rollback reconnected `a1` and `b2` in the sandbox.
   - **Why Verified evidence 2 didn't show it:** the rejected stream was `s2`, and the only earlier group, `s1`, was unchanged.
   - **Suggest:** the Architect appends a "Verified evidence 5" with the sandbox result above. It is the factual basis for Blocking 1.
2. **`routerConfig.js:416–418` with `:440–444`: a transient read error re-reads the whole log.** A transient `stat`/`open` failure on a log that exists (for example EMFILE) returns `size: 0`. `pull()` then sets `pos = 0`, so the next good read takes the whole log, up to supervisord's 50 MB, and can classify a stale Loading or Failed line.
   - **Suggest:** keep `pos` when the read failed, and reset only on a successful stat that shows the file shrank. Rare; not blocking.
3. **Operator surprise: the router's Redis client no longer gets an incidental restart.** `ledger/2026-09-27-strfry-redis-never-reconnects.md:23–24` (Status OPEN) names "the app restarts it on a router-config change" as one of two ways the router's dead Redis client recovers after `docker restart tapestry-redis`. After this story, stream changes no longer restart the router. Recovery is now only the Restart button or a deploy.
   - **Suggest:** add a dated line to that ledger row and mention it in the staging rollout note: after a Redis restart, press Restart on the Router Management tab.
4. **`routerConfig.js:509`: an extra message the ADR didn't name.** The not-running message `…; the router was not running, so it was started.` is not in the ADR, which named only the no-reload clause. It is accurate, and the test plan leaves it open (choice 8). It also covers status `unknown`, for example STARTING/BACKOFF or supervisorctl unreachable.
5. **AC-1/AC-2 10-second live behaviour and AC-5 deploy/container restart: not verifiable stack-free.** The strfry mechanism is covered by ADR § Verified evidence 1–4 and the reviewer sandbox. **Post-deploy manual check on staging:** test plan § Live verification steps 1–5 (pid/uptime unchanged on a toggle, a `Loading` line with reconnects only for the toggled stream, an untouched stream still delivering, Restart resets uptime, a container restart brings the same streams back).
6. **`test/strfry-router-saved-state.test.js` (`440863b3`): judged sound.** It preserves the tests' intent. P/V2/V6 still require exactly one config write and exactly one `supervisorctl restart`. The refused-request (`:203`) and `initRouter` (`:250`) "no exec at all" assertions are untouched. V3 (`:240`) still counts every exec, which is still exactly one because `handleRestartRouter` doesn't ask for status.
   - **Coverage gap:** that suite's stub never answers RUNNING, so #787's `skipped` reporting on the reload path (`routerConfig.js:493`, `:602`, `:640`, `:745`) is verified by inspection only.
   - **Optional:** a reload-path `skipped` test.
7. **Test plan § How to run says "This environment has no `node_modules`".** That is stale for this checkout, where root `node_modules` is installed. Cosmetic.

### Harness friction *(anything the process itself got wrong this story — stale doc, wrong port/path, contradictory instruction; each becomes an OPEN.md row, type `meta`)*
1. none

## Verdict
**CHANGES_REQUESTED**

Two blocking items:
1. Await the rollback's own reload inside the lock, with a regression test, so AC-3's "never a false done" holds by construction.
2. Correct `docs/CONFIGURATION.md:175/:190` and qualify `BIBLE.md:1155`.

Story status stays `Approved`.

## On PASS (same commit)
- [ ] Story `**Status:**` flipped to `Done` in place. *(not applicable: CHANGES_REQUESTED)*
- [ ] Completion detection: not run (no PASS).

---

## Round 2

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-09
**Diff:** `git diff 843c299b..92d44995` (HEAD `92d44995`):
- `bdc45e38`: ADR 0001 Amendment 1 and Verified evidence 5.
- `cc159a18` and `86ec0492`: tests (test plan Amendment 2).
- `92d44995`: impl (`routerConfig.js`, `BIBLE.md` §14, `docs/CONFIGURATION.md`, the Redis ledger row).

Each commit stays in its lane. The ADR commit touches only the ADR, the test commits only the suite and the plan, and the impl commit no test file.

### Quality gates (run by reviewer, not trusted)

- [x] `npm test` (root `node_modules` installed, as in CI). `npm run gate:status -- --label reviewer-rsg1-r2`:
  `20261009T044542Z-29808-8d09 [reviewer-rsg1-r2] started 2026-10-09T04:45:42.219Z on 92d44995 — PASS, exit 0, 5184 passed, 0 failed, 590 skipped, 278/278 suites`.
  This matches the Implementer's recorded run (`20261009T044052Z-31706-e218`, same totals).
- [x] Router suites run directly: `router-config-reload-in-place` 40/0, `strfry-router-saved-state` 32/0, `strfry-router-owner-gate` 10/0, `strfry-router-value-hardening` 14/0, `router-stream-tag-filters` 21/0.
- [x] `bash scripts/harness-lint.sh`: `harness-lint: clean (0 violations)`.
- [ ] `npm run test:playwright`: not applicable (no UI change this round).

Extra evidence gathered by the reviewer (session scratchpad, not committed):
- **Test plan Amendment 2's "fails on round-1 code" claim, checked.** I ran the current suite against `843c299b`'s `routerConfig.js`, `BIBLE.md` and `CONFIGURATION.md`. Result: 33 passed, 7 failed, exactly L5, K1, K ×2, W1, D1 and D2.
  - K1 fails with my round-1 probe's symptom. B returned `{"success":true,"message":"Stream \"beta\" disabled.","applied":"reloaded",…}`.
  - W1 fails on the stale reason from before the offset (`stale reason from an earlier edit`).
- **Probe suite.** A copy of the suite with a failing-restart seam and a reload logged 2 s late. 46/0 on `92d44995`:
  - **Order.** When the rollback's reload is never logged, or is rejected, the single restart comes after the *last* config write (the rollback). There are exactly 2 config writes.
  - **Restart fails.** The rollback's reload is never logged and `supervisorctl restart` exits 1. The response is HTTP 500 `…, and restarting it to put the previous streams back failed (strfry-router: stopped / ERROR (spawn error)). Press Restart…`. State and config are back on the previous streams. A following toggle runs and succeeds by reload, so the lock is not poisoned.
  - **The same, with B queued behind A.** B runs after A's throw and is judged on its own reload (rejected, so 500).
  - **Slow rollback.** A is rejected and its rollback reload is logged 2 s late. B, queued and rejected, still gets 500, with no restart: A held the lock across its slow rollback.
  - **A rejected, B fine.** B is queued and its config reloads fine. B succeeds by reload, and the state holds only B's change.
- **strfry and supervisor sources, for the restart paths.**
  - strfry 1.1.0's router constructor calls `reconcileConfig()` (`cmd_router.cpp:295`). So a restarted router logs a `Loading` line at startup. A parse failure on that first load is `::exit(1)` (`:350–351`).
  - supervisor 4.2.x `startProcess` waits until the process is RUNNING, meaning up longer than `startsecs` (default 1 s; `strfry-router` sets none, `docker/supervisord.conf:33–41`). If the process dies first, it raises `ABNORMAL_TERMINATION`/`SPAWN_ERROR`, and `supervisorctl`'s `do_start` sets a non-zero exit status.
  - So by the time `restartRouter()` resolves, the startup `Loading` line is already in the log. A router that won't start makes it reject.
- **A value strfry rejects passes our checks.** `sanitizeStreamFilter` and `vetStreamsForConfig` both pass `{"kinds":[7],"authors":["nothex"]}` (Evidence 5's value) unchanged. This is the premise of R2-1.

### Round-1 blocking findings

1. **The rollback reload is now awaited (AC-3). Resolved by construction.**
   - **What changed.** `applyConfig` (`routerConfig.js:508–517`) restores the state, takes a fresh offset (`:509`), rewrites the previous config in place (`:510`) and awaits `waitForReload` on it (`:511`), all inside the lock. Each way out of the rejection path:
     - The rollback's own `Loading` line was read, plus the 300 ms settle. It throws `RouterRejectedError` with the round-1 message, which is now checked rather than assumed.
     - A restart completed. The old process is gone, and the startup `Loading` line is already logged (supervisord `startsecs`, above).
     - The restart failed. It throws a plain `Error`. The next mutation then finds the router not running and takes the restart path, which reads no log window.
   - In every case, the next mutation's offset is taken after everything this one caused. Nothing relies on a timing margin beyond the 300 ms settle the success path already uses.
   - K1, the round-1 probe case, fails on round-1 code and passes now. My probes cover the slow-rollback and restart-failure variants.
   - **Lock.** `withRouterLock` (`:531–535`) is unchanged. A throw from `restartRouter` is caught and rethrown as an `Error` (`:512–516`), which rejects `run`; `routerLock = run.catch(() => {})` keeps the chain alive. The probe shows the next toggle succeeding.
   - **`prev` is always defined.** The `if (prev)` guard is gone, and every caller passes `prev`: `handleUpdateRouterConfig` `:612`/`:615`, `handleToggleStream` `:637`/`:647` and `handleRestoreDefaults` `:750`/`:752`. Each passes `cloneState(ensureState())`, and `ensureState` (`:277–298`) always returns an object with `streams`. `applyConfig` is not exported.
2. **The operator docs now match the code on every path a stream change normally takes. Resolved.**
   - `CONFIGURATION.md:175` and `:190` no longer say stream changes restart the router.
   - `BIBLE.md:1155` names the fallback.
   - The remaining gap is a corner branch (Non-blocking R2-2).

### Docs: fresh-claim check (reviewer rule 10)

The BIBLE sentence is my own round-1 suggested wording, so I re-derived it from the code, along with the CONFIGURATION.md and ledger wording:

| Claim | Evidence | Holds |
|---|---|---|
| Stream changes rewrite the config in place and strfry reloads it | `:500`, `:510` `fs.writeFileSync(ROUTER_CONFIG_PATH, …)`; no restart on `'loaded'` (`:502`) | yes |
| Restarted by the Restart button, or as a fallback when the router isn't running | `handleRestartRouter` `:706–721`; `:493–496` (`status !== 'running'`, which includes `unknown`) | yes |
| …or when it logs no reload within 3 s | `RELOAD_TIMEOUT_MS = 3000` (`:374`), deadline loop `:438–457`, restart at `:503–505`; rollback timeout at `:511–513` | yes |
| …and *only* those | a rejected rollback also restarts (`:511–513`), a third trigger the list doesn't name | **no** (R2-2) |
| "the response then says so" | not running `:523`; no reload `:524`; rollback restarted `:463`; restart failed `:515` | yes |
| "a change strfry rejects is rolled back and reported" (CONFIGURATION.md) | `:508–517`; K1, J ×3, Q2 | yes |
| The **🔄 Restart** button | `RelaySettings.jsx:480` | yes |
| Ledger: one of the two recoveries is gone; press Restart or deploy | stream changes no longer restart; Restart rebuilds and restarts (`:706–721`) | yes |

### Spec / ADR adherence (changes since round 1)
- [x] AC-3 now holds by construction (above). The other ACs are as in round 1.
- [x] The code matches Amendment 1 items 1–2: the message variants (`:460–467`), the rejection path (`:508–517`), `readLogSince`'s `ok` flag (`:404–420`) and `pull` (`:441–446`). The docs and ledger match items 3–4.
- [x] Files changed match the amended file list. No new dependencies.
- [x] Concept graph not touched; no firmware reinstall.
- [x] No secrets, no new `console.*`, no commented-out code.

### Round-1 non-blocking items

| # | Item | Status |
|---|---|---|
| 1 | The ADR's two wrong strfry claims | **Addressed.** Corrected inline (ADR :43–46, :137–140), and Verified evidence 5 matches my round-1 sandbox. Residue: the module comment still states the old claim (R2-3). |
| 2 | A transient read error re-reads the whole log | **Addressed** in `waitForReload` (W1, L5). Residue: `logSize` (`:422–428`) still returns 0 on a stat failure for the offsets at `:499`/`:509`. That is benign: `statSync` holds no fd, so EMFILE can't hit it, and a missing log correctly gives 0. No action. |
| 3 | The router's Redis client no longer gets an incidental restart | **Addressed.** Dated update in `ledger/2026-09-27-strfry-redis-never-reconnects.md:43–47`. |
| 4 | Extra not-running message | Unchanged; accepted in round 1. |
| 5 | AC-1/AC-2 10 s live behaviour and AC-5 deploy behaviour | **Remains.** Already tracked by the book's acceptance frame ("Each of the above is verified on staging before production", `engineering-team/audits/relay-stream-gaps/book.md`), so it needs no OPEN.md row. Use test plan § Live verification steps 1–5. |
| 6 | `skipped` reporting on the reload path | **Addressed** by G4. |
| 7 | Stale "How to run" note | **Addressed**, with a typo (R2-6). |

### Findings (round 2)

#### Blocking
None.

#### Non-blocking

1. **R2-1. ADR 0001 Amendment 1 :284–285: when the rollback is itself rejected, the restart cannot put the previous streams back.**
   - **The claim.** "The file on disk is the previous config, so the restarted router runs the previous streams." That holds when the rollback's reload is never seen (timeout), but not when it is rejected. strfry has just refused that file, and a parse failure on first load is `::exit(1)` (`cmd_router.cpp:350–351`).
   - **What happens instead.** The restart at `routerConfig.js:513` normally fails and supervisorctl exits non-zero. The operator gets the `:515` message. Its "Press Restart on the Router Management tab" can't help, because Restart rebuilds the same saved config.
   - **The code is still honest.** `:463` ("It was restarted to put the previous streams back") is returned only if the restart succeeded, which means strfry parsed `prev` on first load. Otherwise `:515` says the restart failed.
   - **No worse than before the story,** when every change restarted the router.
   - **Reachable only when the saved state already holds something strfry rejects.** Our checks let such values through (see the extra evidence). An example is legacy state whose reload strfry refused after a deploy (`initRouter`).
   - **Test note.** The K "is itself rejected" test pins the code's logic with a fake restart that always succeeds. That is fine, but the message it expects is practically unreachable.
   - **Suggest.** The Architect corrects :284–285. Optionally, the Implementer makes `:515` point at strfry's reason as the thing to fix when it was the rollback that was rejected.
2. **R2-2. `BIBLE.md:1155`, `docs/CONFIGURATION.md:175`, `ledger/2026-09-27-strfry-redis-never-reconnects.md:45–46`: the list of restart triggers omits the rejected rollback.**
   - The docs say the router is "restarted only by … or as a fallback when it isn't running or logs no reload within 3 s". They don't name the restart after a rejected rollback (`routerConfig.js:511–513`).
   - My round-1 wording predates Amendment 1, which added that trigger.
   - The response says so when it happens, and CONFIGURATION.md adds "a change strfry rejects is rolled back and reported", so an operator isn't misled at that moment.
   - **Suggest:** "…or as a fallback when it isn't running, logs no reload within 3 s, or rejects the rollback of a refused change". It keeps D1's regexes. Per rule 10, whoever adopts it checks it as a fresh claim.
3. **R2-3. `routerConfig.js:361–362`: the module comment still says a config strfry can't parse leaves "the running streams kept".**
   - This is the claim Amendment 1 corrected, and it contradicts the file's own `applyConfig` JSDoc (`:483–485`).
   - That JSDoc's "thrown once the router is confirmed back on `prev`" (`:482–483`) also leaves out the restart-failed `Error` (`:515`).
   - **Suggest:** align both comments with Evidence 5.
4. **R2-4. `docs/CONFIGURATION.md:190`: the new parenthetical "(an in-place reload, or a restart only as a fallback)" fits only some of the row's triggers.**
   - It fits toggle and restore-defaults.
   - It does not fit "restart", which is the Restart button and always restarts, or "startup", where `initRouter` writes the config without confirming.
   - **Suggest:** "applied as usual for that path".
5. **R2-5. Test coverage of the new branches.**
   - K ×2 call `assertWriteBeforeRestart` (`test/router-config-reload-in-place.test.js:304–308`). It compares the *first* config write with the restart, so the plan row's "after the in-place rollback write" is not literally pinned. The code is right; my probe's order check shows it.
   - The restart-failure branch (`routerConfig.js:514–516`) has no committed test. I verified it by probe only.
   - **Optional (Tester):** check the last write's index, and add a failing-restart seam.
6. **R2-6. Test plan `:163`: "On a checkout without it, The new suite…" has a stray capital.** Cosmetic.

**OPEN.md.** R2-1 to R2-4 are small doc and comment corrections in one area. I recommend **one OPEN.md row** (type `doc`) so they aren't lost if no later story in this epic touches `routerConfig.js`. Story 2 is mid-review in its own worktree, so they can't be folded into it. R2-5 and R2-6 don't need a row.

#### Harness friction
1. none

### Verdict
**PASS**

Both round-1 blocking findings are resolved. AC-3's "never a false done" now holds by construction, and the docs describe what the code does on every path a stream change normally takes. The gate is green: run `20261009T044542Z-29808-8d09`, PASS, 5184 passed, 0 failed, 590 skipped, 278/278 suites. What remains is non-blocking: doc and comment precision in one corner branch (R2-1 to R2-4) and optional test tightening (R2-5).

### On PASS
- [x] Story `**Status:**` flipped to `Done` in place, and its Linked artifacts "Review:" line points to this file. Commit left to the caller.
- [x] Completion detection performed. The result is reported in the chat, not here.
