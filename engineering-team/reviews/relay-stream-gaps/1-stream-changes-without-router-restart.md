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
