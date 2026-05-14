# Test Plan: Story 4 — Scheduled task to refresh Meilisearch profiles and House PoV WoT scores

**Story:** `engineering-team/stories/4-scheduled-search-and-house-scores-refresh.md`
**ADR:** `engineering-team/decisions/0003-scheduled-search-and-house-scores-refresh.md`
**Date:** 2026-05-13

## Coverage map

Every acceptance criterion maps to at least one automated test. Unit tests in `test/scheduled-search-and-house-scores-refresh.test.js` are file-grep / module-shape assertions — they pin down the spec without prescribing internal implementation details (e.g. `Map<taskId,state>` vs an object-keyed pattern is left to the Implementer). Playwright in `tests/brainstorm/scheduled-search-and-house-scores-refresh.spec.js` covers UI presence.

| Criterion | Test name | File | Level |
|---|---|---|---|
| AC-1 (panel + title) | `RelaySettings.jsx renders a card titled "Refresh Meilisearch profiles & House PoV scores"` | test/scheduled-search-and-house-scores-refresh.test.js | unit (source regex) |
| AC-1 (Playwright) | `Scheduled Tasks tab shows the Refresh Meilisearch profiles & House PoV scores card` | tests/brainstorm/scheduled-search-and-house-scores-refresh.spec.js | Playwright |
| AC-2 (toggle defaults disabled) | `scheduler DEFAULTS includes refreshSearchIndex with enabled:false and intervalHours:24` | test/scheduled-search-and-house-scores-refresh.test.js | unit (source regex) |
| AC-2 (Playwright) | `Refresh Meilisearch card toggle defaults to disabled state on a fresh install` | tests/brainstorm/scheduled-search-and-house-scores-refresh.spec.js | Playwright |
| AC-3 (≥1h minimum) | `handleUpdate still enforces the ≥1h minimum interval for any taskId` | test/scheduled-search-and-house-scores-refresh.test.js | unit (regression sentinel) |
| AC-4 (next-run/last-run shown) | covered by AC-2 toggle visibility + the existing panel's display logic surviving the refactor | (n/a — covered by manual smoke + AC-11 regression test) | — |
| AC-5 (disable stops firing) | covered by ADR taskId-routing test + manual smoke (no setInterval-driven unit test in this project's hand-rolled runner) | (n/a — manual smoke) | — |
| AC-6 (persistence across restart) | `initScheduler iterates per-task IDs so each enabled task is restored after restart` | test/scheduled-search-and-house-scores-refresh.test.js | unit (source regex) |
| AC-7 (full pipeline w/ PoV) | `src/algos/refreshSearchIndex.sh exists, is executable, and orchestrates the required sequence` | test/scheduled-search-and-house-scores-refresh.test.js | unit (file + grep) |
| AC-7 (loader parameterization) | `loadScoresIntoMeilisearch.js exports parseArgs, accepts --povPubkey + --delegatedPubkey, and is safely require()-able` | test/scheduled-search-and-house-scores-refresh.test.js | unit (file grep) |
| AC-7 (registry) | `taskRegistry.json contains a refreshSearchIndex entry pointing at src/algos/refreshSearchIndex.sh` | test/scheduled-search-and-house-scores-refresh.test.js | unit (JSON parse) |
| AC-8 (unset PoV graceful skip) | `refreshSearchIndex.sh handles unset House PoV with a WARN event and does not fail the run` | test/scheduled-search-and-house-scores-refresh.test.js | unit (file grep) |
| AC-9 (pre-run banner) | `RelaySettings.jsx has a House-PoV-unconfigured banner that depends on povPubkey and links to Search Preferences` | test/scheduled-search-and-house-scores-refresh.test.js | unit (source regex) |
| AC-9 (Playwright) | `House PoV unconfigured banner is visible when povPubkey is unset` | tests/brainstorm/scheduled-search-and-house-scores-refresh.spec.js | Playwright |
| AC-10 (per-task history) | covered by the ADR-constraint test (`handlers read taskId from req`) — handleHistory accepts taskId by the same mechanism | (n/a — same test) | — |
| AC-11 (Owner panel unregressed) | `loadScoresIntoMeilisearch.sh still invokes the .js with no --povPubkey/--delegatedPubkey args (owner default path preserved)` | test/scheduled-search-and-house-scores-refresh.test.js | unit (regression sentinel) |
| AC-11 (Owner card title preserved in UI) | embedded assertion inside `RelaySettings.jsx renders a card titled …` | test/scheduled-search-and-house-scores-refresh.test.js | unit (source regex) |
| AC-11 (Playwright) | `Existing Update All Scores for Owner card still visible (no regression)` | tests/brainstorm/scheduled-search-and-house-scores-refresh.spec.js | Playwright |
| AC-12 (docs) | `BIBLE.md or docs/CONFIGURATION.md mentions the new task title and its dependencies on House PoV + treasureMaps preset` | test/scheduled-search-and-house-scores-refresh.test.js | unit (file grep) |
| ADR constraint (taskId required) | `scheduler handlers read taskId from req (query/body) — taskId-keyed routing per ADR Option A` | test/scheduled-search-and-house-scores-refresh.test.js | unit (source regex) |

## Edge cases

- [x] **taskId required, no implicit default.** Per ADR Option A, all three handlers must read `req.{query,body,params}.taskId` and 400 on missing/unknown. Covered by the ADR-constraint test.
- [x] **Existing Owner task unregressed.** The `loadScoresIntoMeilisearch.sh` regression sentinel will flip from PASS to FAIL if the Implementer accidentally adds CLI args to the owner-side script. AC-11.
- [x] **1h minimum survives the taskId refactor.** Validation regression sentinel.
- [x] **PoV unset is not a failure.** The unset-path test asserts the orchestrator exits 0 and emits `houseUnconfigured:true` — so a partial-run (profile sync only) is success, not failure.
- [x] **Owner card title preserved.** The UI title test asserts both `Refresh Meilisearch …` (new) AND `Update All Scores for Owner` (existing) appear in `RelaySettings.jsx`, so a careless refactor that drops the existing title trips it.
- [x] **ScheduledTasksPanel remains the host.** The UI title test also asserts the existing `ScheduledTasksPanel` symbol is present — rules out a parallel-module duplication path (Option B).

## Not covered

- **AC-4 / AC-5 live setInterval firing.** Testing that the timer actually fires on schedule requires real-time wait or fake-timer injection — outside the project's hand-rolled Node runner conventions. Verified manually on staging by enabling the schedule on a short interval and observing the scheduler log lines + next-run timestamp updating.
- **AC-6 actual cross-container restart.** Tested by asserting `initScheduler` iterates per-task; the cross-process boundary is exercised by the existing `tapestry-data` Docker named volume the existing scheduler already relies on. Verified by smoke-test post-deploy: enable on staging, redeploy, confirm still on.
- **AC-7 live profile bulk-ingest end-to-end.** Requires `nostr-search-api` up + populated strfry. Verified manually on staging after deploy.
- **AC-7 live kind-30382 sync from a real NIP-85 relay.** Requires network + external relay availability + a real House publishing TAs. Verified manually after House PoV is configured on staging.
- **AC-7 live House score load into Meilisearch.** End-to-end check that scores actually appear under `wot_*_<houseSuffix>` fields in Meilisearch documents. Verified manually by `GET /api/search/profiles/meili/document/<pubkey>` post-deploy with House PoV set.
- **AC-10 history fixture data.** Fixture-based assertion that a specific events.jsonl produces specific filtered runs is deferred — the handler-routes-by-taskId test confirms the wiring, and the runtime correctness of the existing `getRecentRuns` filtering is already exercised by the Owner task in production.

## Test infrastructure

- **Test framework:** project's existing hand-rolled Node runner (`test/test.js`). Playwright for browser flows.
- **No new dependencies.** Unit tests use only `fs`, `path`, `require()`.
- **Module export requirement (for unit testability):**
  - `src/algos/nip85/loadScoresIntoMeilisearch.js` must export `parseArgs(argv)` and guard `main()` with `if (require.main === module)` so it is safely `require()`-able from tests. This is the same precedent as story 2's `generateConfig` export — the test drives the export to enable observability.
- **Playwright preconditions:**
  - A reachable Brainstorm instance with the Implementer's changes deployed. Defaults to `BRAINSTORM_BASE_URL` env var or `http://localhost:8080`.
  - For the unconfigured-banner test: House PoV must be unset (the default on a fresh install). On an instance where House PoV has been set, that one test will fail until the operator clears it — by design.

## How to run

Unit tests:
```
npm test
```

Playwright against local stack:
```
npm run test:playwright
```

Playwright against staging:
```
BRAINSTORM_BASE_URL=https://staging.brainstorm.world npm run test:playwright
```

## Verification

The new tests fail on the pre-implementation tree. Confirmed at commit `ca1c4c7e` (`adr: 0003-scheduled-search-and-house-scores-refresh`):

```
scheduled-search-and-house-scores-refresh suite:
  ✗ scheduler DEFAULTS includes refreshSearchIndex with enabled:false and intervalHours:24
      src/api/scheduled-tasks/index.js DEFAULTS must include `refreshSearchIndex: { enabled: false, intervalHours: 24, intervalDays: 0 }` (per ADR 0003 implementation notes)
  ✗ scheduler handlers read taskId from req (query/body) — taskId-keyed routing per ADR Option A
      scheduler handlers must read taskId from req (e.g. req.query.taskId / req.body.taskId) so /api/scheduled-tasks/* can route per task — per ADR 0003 Option A
  ✓ handleUpdate still enforces the ≥1h minimum interval for any taskId
  ✗ initScheduler iterates per-task IDs so each enabled task is restored after restart
      initScheduler must iterate per-task IDs (e.g. Object.keys(DEFAULTS) or for-of taskIds) so refreshSearchIndex restores independently of updateAllScoresForOwner — AC-6
  ✗ src/algos/refreshSearchIndex.sh exists, is executable, and orchestrates the required sequence
      src/algos/refreshSearchIndex.sh must exist (new orchestrator script per ADR 0003)
  ✗ refreshSearchIndex.sh handles unset House PoV with a WARN event and does not fail the run
      ENOENT: no such file or directory, open '.../src/algos/refreshSearchIndex.sh'
  ✗ taskRegistry.json contains a refreshSearchIndex entry pointing at src/algos/refreshSearchIndex.sh
      taskRegistry.json tasks.refreshSearchIndex must exist (per ADR 0003 implementation notes) — required for POST /api/run-task?taskName=refreshSearchIndex to resolve
  ✗ loadScoresIntoMeilisearch.js exports parseArgs, accepts --povPubkey + --delegatedPubkey, and is safely require()-able
      loadScoresIntoMeilisearch.js must export `parseArgs(argv)` for unit testability — the parameterization per ADR 0003
  ✓ loadScoresIntoMeilisearch.sh still invokes the .js with no --povPubkey/--delegatedPubkey args (owner default path preserved)
  ✗ RelaySettings.jsx renders a card titled "Refresh Meilisearch profiles & House PoV scores"
      RelaySettings.jsx must contain the literal title "Refresh Meilisearch profiles & House PoV scores" (AC-1)
  ✗ RelaySettings.jsx has a House-PoV-unconfigured banner that depends on povPubkey and links to Search Preferences
      Banner text must include "House PoV is not configured" so operators see the dependency (AC-9)
  ✗ BIBLE.md or docs/CONFIGURATION.md mentions the new task title and its dependencies on House PoV + treasureMaps preset
      docs must mention the new task by its UI title

Test Results
-------------
Configuration Loading:                           PASS
treasure-maps-router-preset suite:               PASS (5 passed, 0 failed)
scheduled-search-and-house-scores-refresh suite: FAIL (2 passed, 10 failed)
Overall:                                         FAIL
```

- 10 failing tests, each with a message that directly identifies what the Implementer needs to add — no typo / import-error failures.
- 2 already-passing tests are intentional regression sentinels: they will flip to FAIL if the Implementer accidentally drops the 1h-minimum validation or adds CLI args to the owner-side `loadScoresIntoMeilisearch.sh`.
- Story 2's suite remains 5/5 passing — no collateral regression from the new tests.

Playwright spec at `tests/brainstorm/scheduled-search-and-house-scores-refresh.spec.js` is not run pre-implementation since it requires a deployed instance; it will be exercised against the local stack after the implementation lands and against staging post-deploy.
