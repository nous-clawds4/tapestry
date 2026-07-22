# Test Plan: Story 1 — Deploy-safety status endpoint

**Story:** `engineering-team/stories/deploy-safety-gate/1-deploy-safety-status-endpoint.md`
**ADR:** `engineering-team/decisions/deploy-safety-gate/0001-deploy-safety-status-endpoint.md`
**Date:** 2026-07-18

## Approach

One suite, `test/deploy-safety-status.test.js`, in three classes:

- **U-class (unit, stack-free, gates CI):** the ADR's pure-core seam — the exported `computeVerdict({ now, bufferMs, queueEnabled, queueStateKnown, activeCount, legacyInFlightCount, nextFires })` from `src/api/deploy-safety/index.js`. This is where AC-3's phantom exclusion and AC-4's boundary policy get their explicit automated tests without standing up Redis. A corollary the tests enforce implicitly: the module must be **requireable stack-free** (no Redis connection at module init) — it registers unconditionally in `src/api/index.js`, so init-time queue work would be a bug anyway.
- **S-class (structural sentinels, stack-free, gates CI):** source-level guards in the precedent of tests **T3/T4** in `test/generalized-task-scheduler.test.js` (negative source sentinels). (Note: the ADR's Implementation notes miscite that precedent as "T17/T18"; the correct IDs are T3/T4.)
- **H-class (live HTTP, per-test SKIP when the stack is absent):** the AC-1 payload contract, bufferMinutes validation/override, the AC-5 enabled-half shape, and a live AC-2(a) observation against `http://localhost:7778`.

## Coverage map

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 (unauthenticated GET, complete machine-readable answer) | `H1: one plain unauthenticated GET answers with the full machine-readable contract` | `test/deploy-safety-status.test.js` | integration (live) |
| AC-1 (read-only, repeatable) | `H2: the request is repeatable and read-only — three calls succeed and change no schedule state` | same | integration (live) |
| AC-1 (route exists) | `S3: GET /api/deploy-safety/status is registered in src/api/index.js` | same | structural |
| AC-2(a) (queue actives ⇒ unsafe) | `U2: an active queue job makes the verdict unsafe with QUEUE_TASK_RUNNING` + `H6: a genuinely running queue task (refreshApplicabilityLists) flips running-now and the verdict` | same | unit + integration (live) |
| AC-2(b) (legacy in-flight ⇒ unsafe) | `U3: a legacy per-customer run in flight makes the verdict unsafe with LEGACY_TASK_RUNNING` + `S5: customer-schedule exports getInFlightCount() and it returns a number` | same | unit + seam |
| AC-2 (both sources, independently verified) | `U4: both sources running at once ⇒ unsafe with both reasons` + `S2: the module aggregates BOTH ratified running sources` | same | unit + structural |
| AC-3 (phantom-running exclusion) | `U1: a fabricated orphaned-TASK_START history is invisible — nothing actually running reads safe` + `S1: the deploy-safety module never touches the events.jsonl history surfaces` | same | unit + structural (anti-pattern guard) |
| AC-4 (buffer boundary, inside) | `U5: next fire exactly AT the buffer edge (inMs === bufferMs) is within the buffer ⇒ unsafe` | same | unit |
| AC-4 (buffer boundary, outside) | `U6: next fire just OUTSIDE the buffer (inMs === bufferMs + 1) ⇒ safe, and the fire is still reported` | same | unit |
| AC-4 (no enabled entries ⇒ safe) | `U7: no enabled entries ⇒ safe with nextFire null` | same | unit |
| AC-4 (min over ALL enabled entries) | `U8: among several enabled entries the EARLIEST fire is the next fire, decorated with inMs + withinBuffer` | same | unit |
| AC-4 (10-minute default) | `S4: the ratified 10-minute default buffer is pinned in the module` + H1's `bufferMs === 600000` assert | same | structural + integration |
| AC-5 (disabled ⇒ verdict per policy) | `U10: queue disabled with nothing in flight ⇒ safe` + `U11: queue disabled but a legacy run in flight ⇒ unsafe` | same | unit |
| AC-5 (disabled ≠ broken; enabled half live) | U10's no-`QUEUE_STATE_UNAVAILABLE` assert + `H5: with the queue enabled the response says so, with the queue-state block present` | same | unit + integration (live) |
| Fail-closed (ADR sub-decision 5) | `U9: queue enabled but state unknown ⇒ unsafe with QUEUE_STATE_UNAVAILABLE, never fail-open` | same | unit |
| Payload contract (ADR "Response shape") | `U12: safeToDeploy is the boolean twin of verdict, and reasons is empty exactly when safe` + H1 | same | unit + integration |
| bufferMinutes validation (ADR sub-decision 2) | `H3: a malformed bufferMinutes fails loudly with 400` (`abc`, `0`, `-5`, `1441`) + `H4: a valid bufferMinutes override is applied and echoed` (`45`, boundary `1440`) | same | integration (live) |

## Edge cases

- [x] Buffer edge exactly at `inMs === bufferMs` (unsafe — ADR rule is `<=`) and one ms beyond (safe): U5/U6.
- [x] No enabled entries at all → safe, `nextFire: null`: U7.
- [x] Multiple enabled entries → min-`at` selection: U8.
- [x] Queue enabled but unintrospectable → fail-closed `QUEUE_STATE_UNAVAILABLE`: U9.
- [x] Queue *disabled* must NOT read as `QUEUE_STATE_UNAVAILABLE` (disabled ≠ broken): U10.
- [x] Both running sources at once → both reasons: U4.
- [x] `bufferMinutes` boundary values: `0` and `1441` rejected, `1440` accepted: H3/H4.
- [x] Unauthenticated-surface privacy: `activeTasks` entries carry ONLY `{taskName, startedAt}` — no job ids, no pubkeys (ADR sub-decision 4): H6.
- [x] Phantom history offered to `computeVerdict` under every plausible key name (`events`, `history`, `sessions`) — must be ignored: U1.
- Not pinned (left to Implementer, deliberately untested): fractional `bufferMinutes` rounding; the exact `reasons` ordering; `queue` sub-field presence when `enabled: false` (ADR allows "omitted or null").

## Test infrastructure

- Test framework: Node built-in runner (`node test/test.js`); no Playwright (no UI in this story).
- Control panel: `http://localhost:7778` (override via `BRAINSTORM_BASE_URL`). H-class tests probe `/api/auth/user-classification` with a 2s timeout (the `profile-tags-publish` idiom) and **SKIP individually** when unreachable — CI's stack-free job skips all six H tests cleanly while U/S still gate.
- Firmware state: none required — this story touches no concepts (verified in story/ADR).
- Graph/queue state prerequisites: none seeded. H1/H2/H5 assert contract *shape*, not specific verdicts, so they hold regardless of which schedule entries are enabled locally. H2 additionally requires `GET /api/scheduled-tasks/list` to be serving (it is, on any deployed stack).
- Local stack facts verified 2026-07-18: control panel reachable at :7778; `TASK_QUEUE_ENABLED=true` in the container (`/etc/brainstorm.conf`); `GET /api/deploy-safety/status` currently 404; `POST /api/run-task` is **not** in `writeEndpoints` (`src/middleware/auth.js:430-467`) so the unauthenticated live trigger in H6 is legitimate.
- test/test.js registration (OPEN.md #43 trap): the suite's result term is registered in the **live** `overallOk` chain — the `&&` chain that terminates at `noteTaggingRawEventsInspectorHttpResult.fail === 0;` — NOT in the severed block below it. All touches made: require, banner+run, skip-aware summary line, `overallOk` term, `totalSkipped` entry. Gating verified by observation (see Verification): with the suite failing, `Overall: FAIL` and exit code 1.

### Live-trigger policy (H6)

The only task this suite ever enqueues is **`refreshApplicabilityLists`** — chosen because its `src/manage/taskQueue/taskRegistry.json` entry carries **no `resourceClass`** (not neo4j-heavy), it is bounded (strfry scan + diff-guarded publish; seconds), and it is not `reconcileAll`. Ordering guarantee: H6 asserts `GET /api/deploy-safety/status` answers 200 *before* firing the trigger, so a pre-implementation run (404) fails without ever enqueuing anything — confirmed in the verification output below ("no task was enqueued"). If the task completes inside a poll gap (200ms polling, 20s budget) the test **SKIPs with a note rather than failing** — racy-environment honesty.

## Known coverage limits (documented honestly)

1. **AC-5 live (queue-disabled response):** the local stack runs `TASK_QUEUE_ENABLED=true`, so the disabled state is not reachable over HTTP in-suite. The disabled-state *verdict policy* is fully pinned at the `computeVerdict` seam (U10/U11, including the disabled ≠ `QUEUE_STATE_UNAVAILABLE` distinction), and the *distinguishing flag* (`queue.enabled` boolean) is pinned live (H1/H5). What remains unverified end-to-end: the actual HTTP response of a `TASK_QUEUE_ENABLED=false` deployment. **Reviewer manual verify (optional):** restart the local container with `TASK_QUEUE_ENABLED=false` and `curl /api/deploy-safety/status` → expect `queue.enabled: false` and a verdict driven only by `legacy.inFlightCount`.
2. **AC-2(b) live (legacy run in flight):** driving a real legacy run requires `processCustomer` — `resourceClass: "neo4j-heavy"`, explicitly off-limits for in-suite triggering. Covered at the `computeVerdict` seam (U3), the export seam (S5), and the source sentinel (S2). **Reviewer manual verify:** on a stack with an active customer, trigger the per-customer schedule and confirm `legacy.inFlightCount ≥ 1` + `LEGACY_TASK_RUNNING`.
3. **AC-2(a) live race:** H6 can SKIP if `refreshApplicabilityLists` finishes between polls. If the Reviewer sees a SKIP there, the manual recipe is: `curl -X POST 'http://localhost:7778/api/run-task?taskName=refreshApplicabilityLists' &` then immediately `curl 'http://localhost:7778/api/deploy-safety/status'` → expect `verdict: "unsafe"`, `reasons: ["QUEUE_TASK_RUNNING"]`, an `activeTasks` entry named `refreshApplicabilityLists`.
4. **U/S classes fail (not skip) when the module is absent** — by design: they are the feature's stack-free gate and must fail in CI until the Implementer lands the module. Only the H class has environment-dependent skips.

## How to run

```
npm test
```

Single suite (faster iteration):

```
node test/deploy-safety-status.test.js
```

## Verification

The new tests fail with the current code **because the feature is missing** — the module `src/api/deploy-safety/index.js` does not exist, `customer-schedule` has no `getInFlightCount` export, and the route 404s. No import errors, no typos: the U/S failures carry explicit feature-missing messages, and every H failure is the 404. Confirmed 2026-07-18 at commit 56d26d92 (`node test/deploy-safety-status.test.js`):

```
--- deploy-safety status endpoint tests (epic deploy-safety-gate, Story 1) ---
  FAIL  U1 (AC-3): a fabricated orphaned-TASK_START history is invisible — nothing actually running reads safe
        src/api/deploy-safety/index.js does not exist yet — the deploy-safety module (ADR deploy-safety-gate/0001 Option A) is not implemented.
  [... U2–U12 fail identically: module does not exist ...]
  FAIL  S1 (AC-3 anti-pattern guard): the deploy-safety module never touches the events.jsonl history surfaces
        src/api/deploy-safety/index.js does not exist yet — the deploy-safety module (ADR deploy-safety-gate/0001 Option A) is not implemented.
  FAIL  S3 (AC-1): GET /api/deploy-safety/status is registered in src/api/index.js
        src/api/index.js does not register the /api/deploy-safety/status route — ...
  FAIL  S5 (AC-2b seam): customer-schedule exports getInFlightCount() and it returns a number (0 with no timers)
        src/api/customer-schedule/index.js does not export getInFlightCount() — ...
  FAIL  H1 (AC-1): one plain unauthenticated GET answers with the full machine-readable contract
        GET /api/deploy-safety/status must answer 200 (got 404) — the endpoint is not implemented.
  [... H2–H5 fail identically: 404 ...]
  FAIL  H6 (AC-2a live): a genuinely running queue task (refreshApplicabilityLists) flips running-now and the verdict
        GET /api/deploy-safety/status must answer 200 before the live trigger (got 404) — the endpoint is not implemented; no task was enqueued.

deploy-safety-status: 0 passed, 23 failed, 0 skipped
```

Stack-absent behavior confirmed the same day (`BRAINSTORM_BASE_URL=http://localhost:9`): H1–H6 all `SKIP`, U/S still fail → `0 passed, 17 failed, 6 skipped`. The suite never *fails* for environmental reasons.

### Build-gating proof (OPEN.md #43 trap)

Two full `npm test` runs on 2026-07-18, identical environment, back to back:

1. **Baseline (suite not yet wired):** `Overall: PASS`, exit 0, `Total skipped: 50` — every gating suite green without this one.
2. **Wired (suite registered in the live `overallOk` chain):** the summary's ONLY `FAIL` line is the new suite, and the build flips:

```
deploy-safety-status suite:                      FAIL (0 passed, 23 failed)
Total skipped:                                   50
Overall:                                         FAIL
```

Exit code 1. The A/B delta — same tree, same stack, only the suite registration differing — proves the `overallOk` term gates the build; the genuine feature-missing failure served as the forced failure, so there was no artificial force left to revert. When the Implementer lands the feature the same term turns green.
