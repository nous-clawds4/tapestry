# Test Plan: Story 3 — Scheduled Tasks panel aggregate countdown

**Story:** `engineering-team/stories/deploy-safety-gate/3-scheduled-tasks-panel-countdown.md`
**ADR:** `engineering-team/decisions/deploy-safety-gate/0003-panel-countdown-from-deploy-safety-status.md`
**Date:** 2026-07-18

## Coverage map

Two files, three lanes per ADR 0003 §Implementation notes:

- **Unit (U/D) + structural (S) + regression (R)** — `test/next-task-countdown.test.js`, node harness, stack-free. U/D dynamic-import the pure helper `ui/src/utils/nextTaskCountdown.js` (the `povNoticeText` precedent); S pins the ADR-named code shape of `ui/src/pages/settings/RelaySettings.jsx` (the `admin-tools-dashboard-panel` precedent); R passes pre AND post (rows untouched; ADR 0001 payload contract intact).
- **Playwright (P)** — `tests/brainstorm/scheduled-tasks-panel-countdown.spec.js`, the observable render/tick behavior, with every backend surface route-stubbed for determinism (the `login-failure-and-tag-collapse.spec.js` precedent). **Not part of `npm test`** — run command below.

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 (one aggregate line, operator's form, rows intact) | `U1`–`U4` formatting bands (multi-day / reference 1–24 h / exactly 1 h / under-an-hour); `U7` no seconds; `S1` component declared; `S2` rendered between hint and Add button; `S6` display name via resolveTitle→computeDisplayTitle; `R1` rows + `/list` + computeDisplayTitle remain; P `AC-1: exactly one aggregate line renders…` (visible, count=1, "Next Scheduled Task" + name + "starts in 1 hour and 30 minutes", rows + Add button still visible, display-title enrichment over the endpoint's bare label) | node + spec | unit + structural + e2e |
| AC-2 (soonest among enabled only; comes to reflect changes) | `D1` countdown carries the endpoint's `nextFire` verbatim; `D2` decoy fields never override the endpoint's selection (the Option-B re-derivation trap); `S5` scheduleVersion bump + onScheduleChanged wiring; P `AC-2: the line names the endpoint's soonest ENABLED entry…` (disabled-but-nominally-sooner entry never named; card toggle+save → line reflects the new soonest without reload, ≤15 s) | node + spec | unit + structural + e2e |
| AC-3 (visibly counts down; never frozen/negative; moves on at zero) | `U5` ceiling rounding ("0 minutes"/"0 hours and 0 minutes" unreachable); `U6` ≤0 → `null` (the transitional seam); `S4` 1 s tick + 10 s poll + clearInterval; P `AC-3: the countdown ticks down across a minute boundary without a reload` ("2 minutes"→"1 minute", no negative); P `AC-3: at the fire moment the line moves on…` (zero-cross → none-upcoming; never blank/stale/negative) | node + spec | unit + structural + e2e |
| AC-4 (nothing-upcoming vs queue-disabled, never conflated; plus unknown) | `D3` none-upcoming (no stale fields); `D4` queue-disabled (distinct; wins over stray nextFire); `D5` state-unknown ≠ none-upcoming (the fail-closed honesty case); `D6` malformed/absent payload → unknown (the loading case); `D7` four states pairwise distinct; P `AC-4: queue enabled but nothing upcoming…`; P `AC-4: task-queue layer disabled…` (each pins `data-state`, plain-language copy, cross-negatives against the other state's copy, no blank/stale/countdown) | node + spec | unit + e2e |
| AC-5 (never contradicts the deploy-safety answer) | `S3` the line's sole source is `/api/deploy-safety/status` (structural AC-5 — same `computeVerdict()` selection as the merge gate); `D5`/`D7` empty-state mapping mirrors the endpoint's distinctions; `R2` ADR 0001 payload fields the line consumes still present server-side; P `AC-5: …same entryId, time within rounding + Δt of the same fire` (in-page fetch through the same stubbed pipeline; identity by `data-entry-id`; time within 60 s ceiling + measured Δt + 5 s slack, ADR sub-decision 5) | node + spec | structural + unit + e2e |

Seam sentinel: `S7` pins the `data-testid="next-task-line"` / `data-state` / `data-entry-id` hooks the Playwright lane selects on; `S8` pins the helper module staying plain (no React import — node-importable).

## Edge cases

- [x] Exactly one hour remaining (band boundary) — `U3`.
- [x] Ceiling at the minute boundary: 60 001 ms → "2 minutes"; 60 000 ms and 1 ms → singular "1 minute" — `U5`.
- [x] Zero and negative remaining → `null`, never a negative rendering — `U6`; e2e never-negative asserts in both AC-3 specs.
- [x] Multi-day rendering with day/hour/minute ordering — `U1`.
- [x] Singular/plural throughout ("1 hour", never "1 hours") — `U2`/`U3`/`U5`.
- [x] Seconds never shown at any magnitude — `U7`.
- [x] Malformed / absent / `success:false` / non-object payload (fetch failed, still loading) → `unknown`, never an empty-state claim — `D6`.
- [x] Queue disabled but a stray `nextFire` present → queue-disabled wins (never a countdown toward a fire a disabled queue won't execute) — `D4`.
- [x] Decoy payload fields (activeTasks, injected entries array) never override the endpoint's `nextFire` selection — `D2`.
- [x] Endpoint label vs panel display title divergence → the line shows the panel's `computeDisplayTitle` (enrichment keyed by `entryId`) — P AC-1 (endpoint sends bare `exportGraph`; line must read "Alpha Export").
- [x] Fire passing while the panel is open → line moves on to none-upcoming — P AC-3 zero-cross.
- [x] Concept Graph API unavailable — n/a: story touches no concepts (verified in story §Concepts touched); the node suite is entirely stack-free.

## Test infrastructure

- Framework: Node built-in runner via `npm test` (`test/test.js`); suite also runs standalone: `node test/next-task-countdown.test.js`. Playwright via `playwright.config.js` (repo pins v1.55; chromium build v1187 installed this session via `npx playwright install chromium`).
- **Node suite is stack-free — no skips, no prerequisites.** No live API, no firmware state, no graph state. CI's stack-free job runs it fully.
- **Playwright suite needs only a reachable control panel serving the UI bundle** (`BRAINSTORM_BASE_URL`, default `http://localhost:7778`; guard env `BRAINSTORM_SERVER_ACCESSIBLE=true` per the login-failure precedent). Every API the settings page touches is route-stubbed in-test: `/api/auth/status` + `/api/auth/user-classification` (the client-side owner/admin gate in `SettingsIndex`), `/api/profiles`, `/api/settings`, `/api/scheduled-tasks/list|history|update`, `/api/get-customers`, `/api/grapevine/preferences`, and `/api/deploy-safety/status` itself (a per-request function, so tests can flip the answer mid-run for the toggle and zero-cross cases). No live schedule/queue state is read or written; no NIP-07 signer needed (auth is stubbed below the UI, per the staging-evidence constraint — frame bullet 6b).
- Firmware state: none required (story touches no concepts).
- Fixtures: `makeEntry(...)` (ADR-0021-shaped `/list` entries) and `statusPayload(...)` (ADR-0001-shaped status bodies, `inMs`/`withinBuffer` derived at fulfill time like the real endpoint) in the spec; `okPayload(...)`/`FIRE_B` payload builders in the node suite.
- Runner registration: `test/test.js` — require + run + summary line + a term in the **live** `overallOk` chain (added with `&&` directly after `safeToMergeCheckResult.fail === 0`, which was the live terminator; the OPEN.md #43 severed block below remains untouched). Also added to the informational `totalSkipped` array.

## Prototype validation of the harness

To prove the U/D machinery fails only because the feature is missing, a throwaway spec-conforming helper was placed at `ui/src/utils/nextTaskCountdown.js` from the session scratchpad and the suite re-run: **17 passed / 7 failed** — all 14 U/D tests plus `S8` passed against the prototype; `S1`–`S7` (the component sentinels) still failed on the absent `NextScheduledTaskLine`. The prototype was deleted in the same command (verified absent); the working tree contains no production code from this phase. Playwright harness validity is shown differently: every spec got **past** the stubbed auth gate and tab navigation (the panel-open assertion inside `openScheduledTasksPanel` succeeded) and failed only at the missing `next-task-line` element.

## Documented limits

- **Exact copy at the edges is deliberately under-pinned.** The story delegates edge wording to the Architect/Implementer; the four display *states* are pinned via the ADR-named `data-state` attribute (the load-bearing distinction), with meaning-level regexes (`/no scheduled task|no.*upcoming/i`, `/disabled|switched off/i`) plus cross-negatives for the AC-4 distinguishability. A legitimate rewording that still conveys the state may need a regex re-baseline — that is a conversation, not a silent pass.
- **The "starting now" transitional state is accepted, not demanded**: the AC-1/AC-5 specs accept `data-state` ∈ {countdown, starting} at observation time, since the zero-cross re-fetch can race the assertion. Its exact copy is untested (Implementer-tunable per ADR sub-decision 4).
- **Cadences (1 s / 10 s) are asserted structurally** (`S4`) — observing a 10 s poll behaviorally would add a flaky wall-clock wait; the AC-2 toggle spec bounds the observable outcome at ≤15 s (bump immediate, poll backstop ≤10 s) without asserting which mechanism fired, matching ADR sub-decision 5's refresh window.
- **AC-3's tick test crosses one minute boundary** (75 s → "2 minutes" → "1 minute", ≤25 s wall time). It proves live ticking without reload at the story's hours-and-minutes granularity; it does not watch multiple transitions.
- **AC-5 is verified against the stubbed pipeline**, comparing the DOM to the same payload the line consumed (in-page fetch goes through the route; `page.request` would bypass it). This is deliberate: it makes the test deterministic and pins the *rendering* contract — identity by `entryId`, time within 60 s + Δt. The endpoint side of AC-5 (that `schedule.nextFire` is truly the verdict's selection) is already held by story #1's suite (`test/deploy-safety-status.test.js`) and structurally by `S3`/`R2` here. Live-stack agreement is additionally observable on the local instance once implemented (the panel and `curl /api/deploy-safety/status` side by side) — Reviewer smoke, not scripted.
- **The helper does not expose a tolerance function** — ADR sub-decision 5's arithmetic (60 s + Δt) lives in the AC-5 spec's assertion, since the ADR names no exported tolerance helper.
- **Playwright ran on chromium only** this session (`--project=chromium`); the config's other four projects (firefox/webkit/mobile) were not exercised. The suite is browser-agnostic (route stubs + role/testid locators).
- **No staging evidence in this lane** (frame bullet 6b): the deployed settings page sits behind un-scriptable NIP-07 owner sign-in; rendered-panel evidence is local-stack by ratified constraint, while staging supplies data-level evidence via story #1's endpoint.

## How to run

Node suite (registered in `npm test`; gates `Overall` via the live `overallOk` chain):

```
npm test
```

Suite only (fast, stack-free):
```
node test/next-task-countdown.test.js
```

Playwright lane (NOT part of `npm test`; needs the local stack serving the UI):
```
BRAINSTORM_SERVER_ACCESSIBLE=true BRAINSTORM_BASE_URL=http://localhost:7778 \
  npx playwright test tests/brainstorm/scheduled-tasks-panel-countdown.spec.js --project=chromium
```

## Verification

The new tests fail with the current code — the helper module, the component, and its wiring do not exist. Confirmed 2026-07-18 at commit `2ef64b61` (branch `feat/deploy-safety-gate`).

**Node suite, standalone — 22 fail (feature-missing messages, no harness/typo errors), 2 regression guards pass:**

```
--- next-task-countdown tests (deploy-safety-gate story #3) ---
  FAIL  U1 (AC-1): multi-day remaining renders days, hours and minutes in order — hours-and-minutes granularity, no seconds
        ui/src/utils/nextTaskCountdown.js does not exist (or is not importable by node) yet — the pure countdown formatting/state helpers (ADR deploy-safety-gate/0003 §Implementation notes) are not implemented. […]
  [U2–U7, D1–D7 — same feature-missing failure, one per test]
  FAIL  S1 (AC-1): RelaySettings.jsx declares function NextScheduledTaskLine — the isolated aggregate-line component
        ui/src/pages/settings/RelaySettings.jsx does not declare `function NextScheduledTaskLine` (ADR 0003 §Implementation notes: an isolated component so the 1 s tick re-renders one line, not every ScheduledEntryCard). Declare it above ScheduledTasksPanel.
  FAIL  S2 (AC-1): ScheduledTasksPanel renders <NextScheduledTaskLine …> between the hint paragraph and the Add-button block, alongside (not replacing) the rows
        ScheduledTasksPanel never renders <NextScheduledTaskLine …> (story AC-1: exactly one aggregate line alongside the per-entry rows; ADR 0003 sub-decision 6).
  FAIL  S3 (AC-5): NextScheduledTaskLine sources /api/deploy-safety/status — the same schedule answer the merge gate consumes
        NextScheduledTaskLine declaration not found — S1 must pass first.
  FAIL  S4 (AC-3): the component carries the 1 s tick and the 10 s poll, both cleaned up on unmount
        NextScheduledTaskLine declaration not found — S1 must pass first.
  FAIL  S5 (AC-2): schedule-change refresh wiring — scheduleVersion bump in the panel and an onScheduleChanged prop on the cards
        RelaySettings.jsx never mentions scheduleVersion […]
  FAIL  S6 (AC-1/AC-5): the line's display name goes through resolveTitle → computeDisplayTitle, with the endpoint label as fallback
        RelaySettings.jsx never mentions resolveTitle […]
  FAIL  S7 (AC-1..AC-5 seams): the line's root carries data-testid="next-task-line" and a data-state attribute — the Playwright hooks
        NextScheduledTaskLine's root element must carry data-testid="next-task-line" […]
  FAIL  S8 (harness): the helper module stays plain — no React import, importable by node
        ui/src/utils/nextTaskCountdown.js does not exist yet […]
  PASS  R1 (AC-1 regression): the per-entry rows remain — ScheduledTasksPanel still fetches /api/scheduled-tasks/list and maps entries to ScheduledEntryCard
  PASS  R2 (ADR 0001 contract): the deploy-safety endpoint still carries the fields the line consumes — queue.enabled/stateKnown and schedule.nextFire{entryId,taskId,label,at}

next-task-countdown: 2 passed, 22 failed
EXIT: 1
```

**Playwright, chromium, local stack up — all 7 fail at the missing line element** (the stubbed auth gate and tab navigation succeed; every failure is `waiting for getByTestId('next-task-line')` / element not found, or its downstream assertion):

```
Error: expect(locator).toBeVisible() failed
    Locator:  getByTestId('next-task-line')
    Expected: visible
    Received: <element(s) not found>
    Timeout:  10000ms

  7 failed
    [chromium] › …spec.js:104:3 › AC-1: exactly one aggregate line renders — task name + hours-and-minutes — alongside intact per-entry rows
    [chromium] › …spec.js:139:3 › AC-3: the countdown ticks down across a minute boundary without a reload
    [chromium] › …spec.js:163:3 › AC-3: at the fire moment the line moves on to the then-current state — never a frozen or negative countdown
    [chromium] › …spec.js:190:3 › AC-2: the line names the endpoint's soonest ENABLED entry — a disabled entry never appears — and a toggle is reflected without a reload
    [chromium] › …spec.js:236:3 › AC-4: queue enabled but nothing upcoming — the line says so plainly; no blank, no stale name, no countdown
    [chromium] › …spec.js:253:3 › AC-4: task-queue layer disabled — stated in plain language, distinguishable from "nothing scheduled"
    [chromium] › …spec.js:269:3 › AC-5: the line never contradicts the deploy-safety answer — same entryId, time within rounding + Δt of the same fire
```

**Full `npm test` gating excerpt** (suite registered in the live `overallOk` chain — the term added with `&&` directly after `safeToMergeCheckResult.fail === 0`, which was the live terminator; the OPEN.md #43 severed block below it is untouched). Run against the local stack, 2026-07-18:

```
next-task-countdown: 2 passed, 22 failed

Test Results
-------------
[… every other suite line reads PASS or SKIP …]
deploy-safety-status suite:                      PASS (23 passed, 0 failed)
safe-to-merge-check suite:                       PASS (16 passed, 0 failed)
next-task-countdown suite:                       FAIL (2 passed, 22 failed)
Total skipped:                                   28
Overall:                                         FAIL
```

Gating attribution: `next-task-countdown suite: FAIL (2 passed, 22 failed)` is the only summary line with a nonzero fail count in the entire run (verified — no individual `FAIL` test line appears outside the new suite; the wholesale-SKIP publish suites carried zero failures this run, so no OPEN.md #58 masking occurred), and `Overall: FAIL` follows from the new `&&` term in the live chain. Implementing the feature is the only deterministic path back to PASS.
