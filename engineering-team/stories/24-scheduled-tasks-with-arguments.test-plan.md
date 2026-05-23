# Test Plan: Story 24 — Per-task arguments in the Scheduled Tasks panel

> **Renumbered from Story #17 / ADR 0015 → Story #24 / ADR 0021 at sync time (2026-05-23).** Internal references to "Story #17" and "ADR 0015" below are kept verbatim as historical record of how the test plan was drafted. The test plan will need amending after the Architect amends ADR 0021 to reconcile with ADR 0019's BullMQ Job Schedulers — T13-T20 (backend refactor sentinels for `entryId`-keyed `setInterval` state) are no longer the right contract.

**Story:** `engineering-team/stories/24-scheduled-tasks-with-arguments.md`
**ADR:** `engineering-team/decisions/0021-scheduled-tasks-with-arguments.md`
**Date:** 2026-05-23 (drafted), renumbered 2026-05-23 at sync

## Test posture

Three layers, matching the project's established pattern (stories #4, #13, #16):

1. **Behavioral unit tests** for the two new pure modules the ADR introduces — `src/api/scheduled-tasks/migration.js` and `src/api/scheduled-tasks/validation.js`. Their entire purpose is to be tested in isolation: take inputs, return outputs, no side effects. T1–T12 require them and exercise their contracts end-to-end.
2. **Source / structural sentinels** for the backend refactor of `src/api/scheduled-tasks/index.js`, the route registrations in `src/api/index.js`, and the new frontend components. These pin the contract shapes the ADR commits to (timer-state keyed by entryId, readConfig invokes the migrator, makeTriggerTask builds the query string from `entry.args`, deleted-customer auto-disable, new CRUD handlers exported and routed, registry-driven modal, customer picker fetching `/api/get-customers`, list-driven panel). T13–T26.
3. **Regression guards** (R1, R2) that pass NOW and must continue to pass POST-implementation — they protect story #4's `HousePovUnconfiguredBanner` and the cold-start `initScheduler` export consumed by `bin/control-panel.js`.

The **behavioral round-trip** — opening the Add Scheduled Entry modal in a browser, selecting Alice, saving a `processCustomer` entry, watching it fire on its own cadence while a separate Bob entry fires on a different cadence, both with their args reaching `/api/run-task` correctly — is reproducible only against the live Docker stack and is the **authoritative cycle-local smoke** the Reviewer drives. Documenting this split is deliberate: source/contract sentinels in CI run on every `npm test` (cheap, fast, regression-proof); behavioral smoke runs against the live stack (proves the end-to-end is actually wired).

## Coverage map

One test (or one tightly-scoped trio) per acceptance criterion, with the multi-entry data-model AC (AC-4), the registry-driven form AC (AC-2), and the "fired task receives its args" AC (AC-7) drawing the heaviest concentration because they're the load-bearing changes.

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| **AC-1** Every parameterized task is schedulable | `T18: scheduler module exports a handler returning the parameterized-task subset` + `T19: /api/scheduled-tasks/registry-tasks registered` + `T24: ScheduledTasksPanel fetches /api/scheduled-tasks/list` | `test/scheduled-tasks-with-arguments.test.js` | source sentinel |
| **AC-2** Registry is the single source of truth for the argument form | `T18` (registry-tasks endpoint) + `T23: argFieldRenderer renders customer/boolean/optional + text-input fallback` + `T21: AddOrEditEntryModal references /api/scheduled-tasks/registry-tasks` | `test/scheduled-tasks-with-arguments.test.js` | source sentinel |
| **AC-3** Argument-form parity with the legacy Task Explorer | `T23` (renderer handles the same arg shapes the legacy explorer handles: `customer`, `boolean` warmStart, `optional` limit) + `T22: CustomerPicker reuses /api/get-customers` (same source the legacy explorer uses). **Reviewer-driven cycle-local smoke** for the actual side-by-side parity. | `test/scheduled-tasks-with-arguments.test.js` + smoke | source sentinel + smoke |
| **AC-4** Multiple scheduled entries per task | `T2: migration produces v2 entries array` + `T13: timer state keyed by entryId` + `T17: scheduler exports handleCreate` + `T24: panel fetches /list` | `test/scheduled-tasks-with-arguments.test.js` | unit + source sentinel |
| **AC-5** Each entry has a recognizable label that exposes its arguments | `T2` (migration preserves a label per entry) + `T25: ScheduledEntryCard takes an entry object (id, taskId, label, args, …)` | `test/scheduled-tasks-with-arguments.test.js` | unit + source sentinel |
| **AC-6** Required arguments block save | `T9: validateEntry rejects processCustomer without customer` + `T10: validateEntry rejects malformed customer pubkey` + `T26: modal disables Save when required args missing` | `test/scheduled-tasks-with-arguments.test.js` | unit + source sentinel |
| **AC-7** The fired task receives its configured arguments | `T15: makeTriggerTask builds query string from entry.args (pubkey + customerId + customerName + warmStart + limit)`. **Reviewer-driven cycle-local smoke** asserts an actual `processCustomer` entry fires and the script receives the customer triple. | `test/scheduled-tasks-with-arguments.test.js` + smoke | source sentinel + smoke |
| **AC-8** Optional arguments respect their declared defaults | `T15` (warmStart propagation in trigger). **Reviewer-driven cycle-local smoke** verifies pre-fill behavior in the modal matches the legacy explorer's default. | `test/scheduled-tasks-with-arguments.test.js` + smoke | source sentinel + smoke |
| **AC-9** Customer picker shares the legacy explorer's source | `T22: CustomerPicker.jsx exists and fetches /api/get-customers` | `test/scheduled-tasks-with-arguments.test.js` | source sentinel |
| **AC-10** Deleted-customer warning | `T16: trigger path auto-disables entry on CUSTOMER_NOT_FOUND, records lastError`. **Reviewer-driven cycle-local smoke** asserts the panel surfaces the warning visually after a customer deletion. | `test/scheduled-tasks-with-arguments.test.js` + smoke | source sentinel + smoke |
| **AC-11** Existing entries survive the upgrade | `T2: migration preserves enabled/intervalHours/intervalDays bit-for-bit` + `T12: validateEntry accepts a no-args legacy entry` + `T14: readConfig calls migrateConfigIfNeeded` + `R1: HousePovUnconfiguredBanner still wired (story #4 regression)` + `R2: initScheduler still exported (cold-start regression)` | `test/scheduled-tasks-with-arguments.test.js` | unit + source sentinel + regression |
| **AC-12** Persistence across restarts | `T2/T3/T4/T5: migration round-trips (any subsequent read of the persisted file produces the same in-memory shape)` + `T14: readConfig invokes the migrator on every load` + `R2: initScheduler still exported (restores enabled schedules on restart)` | `test/scheduled-tasks-with-arguments.test.js` | unit + source sentinel + regression |
| **AC-13** Per-entry last-run / next-run visibility | `T13: timer state keyed by entryId (so entries with the same taskId track timestamps independently)`. **Reviewer-driven cycle-local smoke** verifies the panel displays per-entry timestamps. | `test/scheduled-tasks-with-arguments.test.js` + smoke | source sentinel + smoke |
| ADR §Tests "Migration" — v1 → v2 deterministic | `T2` | `test/scheduled-tasks-with-arguments.test.js` | unit |
| ADR §Tests "Migration" — v2 passthrough | `T3` | `test/scheduled-tasks-with-arguments.test.js` | unit |
| ADR §Tests "Migration" — empty → v2 with empty entries | `T4` | `test/scheduled-tasks-with-arguments.test.js` | unit |
| ADR §Tests "Migration" — idempotent | `T5` | `test/scheduled-tasks-with-arguments.test.js` | unit |
| ADR §Tests "CRUD" — `create` rejects missing required args | `T9` (validateEntry contract) + `T17` (handleCreate exported, uses validateEntry per ADR) | `test/scheduled-tasks-with-arguments.test.js` | unit + source sentinel |
| ADR §Tests "CRUD" — `update` rejects re-introducing missing args | `T9/T10` (validateEntry shared by create and update per ADR) + `T17` (handleUpdate exported) | `test/scheduled-tasks-with-arguments.test.js` | unit + source sentinel |
| ADR §Tests "CRUD" — `delete` refuses to remove an enabled entry without `force: true` | **Reviewer-driven cycle-local smoke** (HTTP-level contract, harder to source-grep without false positives) | — | smoke |
| ADR §Tests "Backward-compat" — bare-taskId update → legacy:<taskId> entry | `T20: scheduler contains "legacy:" prefix; backward-compat resolution present` | `test/scheduled-tasks-with-arguments.test.js` | source sentinel |
| ADR §Tests "Frontend" — argFieldRenderer text-input fallback | `T23` (explicit `default` / `fallback` / `unknown` branch) | `test/scheduled-tasks-with-arguments.test.js` | source sentinel |
| ADR §Tests "Frontend" — modal save disabled when required args missing | `T26` (disabled attribute on Save bound to a "required" state) | `test/scheduled-tasks-with-arguments.test.js` | source sentinel |

### Why one suite, not split

All 28 tests (T1–T26, R1, R2) target the same story-17 implementation surface: `src/api/scheduled-tasks/{index,migration,validation}.js`, `src/api/index.js` route registrations, and four new `ui/src/pages/settings/scheduledTasks/*.jsx` files. Splitting would duplicate the registry-load and the fixture pubkeys, inviting drift. One suite, 28 tests, clear unit/sentinel/regression sections — same as story #16's pattern (11 tests + 3 regression in one file).

## Edge cases

Covered explicitly inside the suite:

- [x] **Migration of an empty / fresh-install file** — T4 covers `{}` and `null` inputs producing `{ version: 2, entries: [] }`.
- [x] **Migration idempotence** — T5 covers `migrate(migrate(v1)) ≡ migrate(v1)`. Critical because readConfig invokes the migrator on every read (per ADR §Files-to-edit), so a non-idempotent migrator would rewrite the file on every server boot.
- [x] **Bit-for-bit preservation of legacy entries' schedule** — T2 asserts `enabled`, `intervalHours`, `intervalDays` survive migration unchanged. Without this, an enabled production scheduler could silently flip to disabled.
- [x] **Continuous-frequency tasks** rejected by validation — T8 picks a real continuous task (e.g., `taskQueueManager`) from the live registry and asserts validation rejects scheduling it. Prevents the operator from accidentally scheduling a daemon.
- [x] **Multiple malformed-pubkey shapes** — T10 covers six malformed-pubkey cases (too short, uppercase, non-hex, off-by-one, empty). The "uppercase rejected" case is particularly important: ADR pins 64-char *lowercase* hex; a permissive validator would let the legacy explorer's mixed-case display pass through and fail downstream in CustomerManager.
- [x] **No-args legacy entries accepted by validation** — T12 ensures the new validator doesn't accidentally reject the migrated `updateAllScoresForOwner` entry on its first post-migration save.
- [x] **Story #4 regression — HousePovUnconfiguredBanner** — R1 ensures the banner wiring survives the panel refactor. Without this guard, the refresh-meilisearch operator UX silently regresses.
- [x] **Restart-persistence — initScheduler still exported** — R2 ensures `bin/control-panel.js`'s startup call to `initScheduler` still resolves; without this guard, every restart would silently leave all schedules off.

Surfaced as Reviewer-watch / cycle-local smoke items (out-of-band of the automated suite):

- [ ] **End-to-end multi-entry firing.** Create two scheduled `processCustomer` entries with different customer pubkeys (Alice + Bob) and 1h cadences; observe both fire independently in the events log with the customer triple in their respective query strings. **Reviewer-driven.**
- [ ] **Modal Save disablement is observable in the browser.** The source sentinel T26 asserts the `disabled` attribute is wired; the Reviewer confirms that, in the live UI, the Save button is visually disabled when a required field is empty and re-enabled when filled.
- [ ] **Deleted-customer auto-disable round-trip.** Delete a customer that an enabled entry references; on the next fire tick, the entry flips to disabled and the panel surfaces a "Customer no longer exists" warning. **Reviewer-driven** — couples scheduler tick + customer-management state, not easily reproducible in a unit context.
- [ ] **Per-entry last-run / next-run independence.** With two enabled `processCustomer` entries on different cadences, the per-entry timestamps shown in the panel must advance independently (Alice's `next-run` != Bob's `next-run`). **Reviewer-driven**, observed in the browser.
- [ ] **Recent-Runs caveat note.** ADR documents that history is task-keyed (not entry-keyed) and the UI renders an inline caveat. **Reviewer eyeballs** the caveat on a multi-entry-per-task card.
- [ ] **handleDelete force-flag protection.** A `POST /api/scheduled-tasks/delete { entryId, force: false }` against an enabled entry must return non-200 with a clear error; the same call with `force: true` must succeed. **Reviewer-driven** HTTP smoke; not source-greppable without false positives.
- [ ] **BullMQ jobId dedup constraint for non-customer parameterized entries.** Two `processAllTasks` entries with different `warmStart` values will dedup at the BullMQ layer when `TASK_QUEUE_ENABLED=true`. ADR documents this as accepted; no automated test — Reviewer confirms the documented constraint behaves as ADR'd, or notes the deviation.
- [ ] **One-way migration acceptance.** Operators considering rolling back to pre-ADR-0015 server image must take a JSON snapshot of `/var/lib/brainstorm/scheduled-tasks.json` first. **Reviewer-watch** of `OPERATIONS.md` documentation.

## Test infrastructure

- **Framework:** Hand-rolled Node runner (`node test/test.js`). Matches the in-repo style; no jest/mocha/vitest. Each test is an `async fn` that throws on assertion failure; the suite reports per-test pass/fail; non-zero exit if any suite fails.
- **No external dependencies beyond Node stdlib.** `fs`, `path`. Migration and validation modules are pure JS — testable with plain `require()`.
- **Fixture pubkeys:** `'a'.repeat(64)` (Alice), `'b'.repeat(64)` (Bob). Synthetic but well-formed 64-char lowercase hex. These never collide with real customer data and require no test-database state.
- **Concept Graph API:** not required for this story (no concept handles touched).
- **Firmware reinstall:** no.
- **Test-database state:** none. `validateEntry` is tested without invoking `CustomerManager.getCustomer`; the customer-not-found code path is asserted as a source sentinel (T16) rather than exercised live, because the live exercise belongs to the cycle-local smoke.

## How to run

```
npm test
```

The suite registers as `scheduled-tasks-with-arguments suite:` after `entrypoint-template-rendering suite:` in `test/test.js`.

For the Reviewer's cycle-local smoke (behavioral round-trip; runs against the live Docker stack):

```bash
# Once the implementation is in:
docker exec tapestry npm test
# Confirms all 28 tests pass server-side.

# Open the live panel:
open http://localhost:8080/tapestry/settings/relays
# Navigate to Scheduled Tasks tab. Verify the two pre-existing entries
# (Update All Scores for Owner, Refresh Meilisearch profiles & House PoV
# scores) are still listed, with their pre-upgrade enabled state and schedule.

# Add a processCustomer entry for Alice, 1h cadence, enabled.
# Add a second processCustomer entry for Bob, 2h cadence, enabled.
# Wait ≥ 1h. Confirm in /var/log/brainstorm/taskQueue/events.jsonl:
docker exec tapestry tail -n 200 /var/log/brainstorm/taskQueue/events.jsonl | grep processCustomer
# Should show separate TASK_START records for both Alice and Bob's pubkeys.

# Confirm per-entry timestamps advance independently in the panel UI.

# Delete Bob from the customer-management surface. On the next fire tick (or
# manually trigger by reducing Bob's interval to 1h), confirm Bob's entry
# flips to disabled and the panel shows "Customer no longer exists."

# Pre-upgrade rollback test (optional, paranoia-level):
docker exec tapestry cat /var/lib/brainstorm/scheduled-tasks.json
# Confirm v2 shape (version: 2, entries: [...]).
```

## Verification

The new tests fail with the current code (pre-implementation). Confirmed on 2026-05-23 at commit `b6888587`:

```
scheduled-tasks-with-arguments suite:
  ✗ T1: src/api/scheduled-tasks/migration.js exists and exports migrateConfigIfNeeded
      migration module missing or unparseable at .../src/api/scheduled-tasks/migration.js: Cannot find module ...
        ADR 0015 §Implementation "Files to add" pins this module.
  ✗ T2..T5: migration tests (all fail with "migration module unavailable")
  ✗ T6: src/api/scheduled-tasks/validation.js exists and exports validateEntry
      validation module missing or unparseable at .../src/api/scheduled-tasks/validation.js: ...
        ADR 0015 §Implementation "Files to add" pins this module.
  ✗ T7..T12: validation tests (all fail with "validation module unavailable")
  ✗ T13: scheduler timer-state map is keyed by entryId
      src/api/scheduled-tasks/index.js must reference `entryId` ...
  ✗ T14: readConfig invokes migrateConfigIfNeeded
      src/api/scheduled-tasks/index.js must call migrateConfigIfNeeded ...
  ✗ T15: makeTriggerTask builds the query string from entry.args
      ... trigger path must read from `entry.args` ...
  ✗ T16: trigger path auto-disables on customer-lookup failure
      scheduler must surface a `CUSTOMER_NOT_FOUND` error code ...
  ✗ T17: scheduler exports handleList, handleCreate, handleDelete
      scheduler must export handleList ...
  ✗ T18: scheduler exports a parameterized-task-subset handler
      scheduler must export a handler that powers GET /api/scheduled-tasks/registry-tasks ...
        Got exports: handleStatus, handleUpdate, handleHistory, initScheduler
  ✗ T19: src/api/index.js registers the new scheduled-tasks routes
      src/api/index.js must register GET /api/scheduled-tasks/list ...
  ✗ T20: handleUpdate has backward-compat for bare taskId → legacy:<taskId>
      src/api/scheduled-tasks/index.js must contain a "legacy:" prefix ...
  ✗ T21..T23: frontend files missing
      cannot read .../ui/src/pages/settings/scheduledTasks/{AddOrEditEntryModal,CustomerPicker,argFieldRenderer}.jsx
  ✗ T24: ScheduledTasksPanel fetches /api/scheduled-tasks/list
      RelaySettings.jsx ScheduledTasksPanel must fetch /api/scheduled-tasks/list ...
  ✗ T25: ScheduledEntryCard takes an `entry` object
      RelaySettings.jsx must rename ScheduledTaskCard → ScheduledEntryCard ...
  ✗ T26: modal disables Save when required args missing
      cannot read .../AddOrEditEntryModal.jsx
  ✓ R1: HousePovUnconfiguredBanner from story #4 is still defined in RelaySettings.jsx
  ✓ R2: src/api/scheduled-tasks/index.js still exports initScheduler

Test Results
-------------
Configuration Loading:                           PASS
treasure-maps-router-preset suite:               PASS (5 passed, 0 failed)
scheduled-search-and-house-scores-refresh suite: PASS (12 passed, 0 failed)
strfry-router-first-boot-config suite:           PASS (3 passed, 0 failed)
per-query-neo4j-timeout-safety-net suite:        PASS (8 passed, 0 failed)
nip05-checkmark-verification suite:              PASS (4 passed, 0 failed)
publish-export-a-concept suite:                  PASS (3 passed, 0 failed)
community-reference-nostr-relay-stub suite:      PASS (4 passed, 0 failed)
header-conceptgraph-tag suite:                   PASS (2 passed, 0 failed)
community-reference-superset-link suite:         PASS (4 passed, 0 failed)
graperank-shared-csv-race suite:                 PASS (13 passed, 0 failed)
community-class-thread-pull suite:               PASS (10 passed, 0 failed)
task-queue-bullmq suite:                         PASS (18 passed, 0 failed)
task-queue-neo4j-resource-class suite:           PASS (14 passed, 0 failed)
entrypoint-template-rendering suite:             PASS (11 passed, 0 failed)
scheduled-tasks-with-arguments suite:            FAIL (2 passed, 26 failed)
Overall:                                         FAIL
```

The 14 sibling suites continue to PASS — **no collateral damage** from the new suite. Each of the 26 failures carries a right-reason message that points the Implementer at the exact gap (which file is missing, which export is absent, which contract sentinel is unmet). R1 and R2 pass now and must continue passing post-impl — they guard story #4's banner and the cold-start `initScheduler` export.
