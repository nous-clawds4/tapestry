# Test Plan: Story 24 — Per-task arguments in the Scheduled Tasks panel

> **Re-derived 2026-05-23** to match the amended ADR 0021 (per-entry BullMQ Job Schedulers + fire-time customer resolution via the new `entryResolver` helper module). Supersedes the earlier setInterval-anchored test plan that was drafted on the stale-staging branch.

**Story:** `engineering-team/stories/24-scheduled-tasks-with-arguments.md`
**ADR:** `engineering-team/decisions/0021-scheduled-tasks-with-arguments.md` (amended)
**Date:** 2026-05-23

## Test posture

Three layers, matching the project's established pattern (stories #4, #13, #16, #22):

1. **Behavioral unit tests** for the two pure modules `migration.js` and `validation.js`. We `require()` them and exercise their input→output contracts against the live `taskRegistry.json` — no mocking. T1–T13.
2. **Source / structural sentinels** for the backend refactor (per-entry Job Schedulers, fire-time resolution, processor branch, route registrations) and the frontend additions. T14–T33.
3. **Regression guards** (R1, R2) that pass NOW and must continue to pass POST-implementation — they protect story #4's `HousePovUnconfiguredBanner` and ADR 0019's `reconcileSchedulesFromConfig` boot hook (consumed by `bin/control-panel.js`).

The behavioral round-trip — opening the modal, picking Alice, watching `processCustomer` for Alice and Bob fire on independent cadences, deleting Bob mid-schedule and observing fire-time auto-disable — is reproducible only against the live Docker stack and is the **Reviewer-driven cycle-local smoke**. The fire-time customer-delete round-trip becomes load-bearing under ADR 0021's per-fire-resolution decision (not just nice-to-have like in the prior draft).

## Coverage map

| Criterion | Test(s) | Test file | Level |
|---|---|---|---|
| **AC-1** Every parameterized task is schedulable | `T19` (handleRegistryTasks exported) + `T20` (/registry-tasks route) + `T30` (panel fetches /list) | `test/scheduled-tasks-with-arguments.test.js` | source sentinel |
| **AC-2** Registry is single source of truth for the arg form | `T19` + `T27` (modal fetches /registry-tasks) + `T29` (argFieldRenderer handles 3 shapes + fallback) | `test/scheduled-tasks-with-arguments.test.js` | source sentinel |
| **AC-3** Argument-form parity with legacy Task Explorer | `T29` (renderer handles `customer`/`boolean`/`optional` — same shapes the legacy explorer reads) + `T28` (CustomerPicker reuses `/api/get-customers`). **Reviewer-driven** cycle-local for actual side-by-side parity. | `test/scheduled-tasks-with-arguments.test.js` + smoke | source sentinel + smoke |
| **AC-4** Multiple scheduled entries per task | `T2` (v2 migration produces array) + `T15` (`sched:${entry.id}` schedulerId) + `T16` (reconcile iterates entries) + `T19` (handleCreate exported) | `test/scheduled-tasks-with-arguments.test.js` | unit + source sentinel |
| **AC-5** Each entry has a recognizable label exposing its args | `T2` (migration assigns labels) + `T31` (card takes entry prop) + `T33` (panel derives display-label from `/api/get-customers` for fresh customer names) | `test/scheduled-tasks-with-arguments.test.js` | unit + source sentinel |
| **AC-6** Required arguments block save | `T9` (validateEntry rejects missing customer) + `T10` (malformed pubkey) + `T32` (modal disables Save on missing required arg) | `test/scheduled-tasks-with-arguments.test.js` | unit + source sentinel |
| **AC-7** Fired task receives its configured arguments | `T18` (scheduler packs `entryId` in job-data, no customerArgs at upsert) + `T22` (entryResolver reads scheduled-tasks.json + calls validateEntry at fire time) + `T23` (entryResolver calls CustomerManager.getCustomer) + `T26` (processor's `if (entryId)` branch wires it together). **Reviewer-driven** smoke: actual processCustomer fires reach the script with the customer triple. | `test/scheduled-tasks-with-arguments.test.js` + smoke | source sentinel + smoke |
| **AC-8** Optional arguments respect declared defaults | `T18` (queryParams flows through fire-time resolution). **Reviewer-driven** smoke: modal pre-fills warmStart from registry default. | `test/scheduled-tasks-with-arguments.test.js` + smoke | source sentinel + smoke |
| **AC-9** Customer picker shares legacy explorer's source | `T28` (CustomerPicker.jsx fetches `/api/get-customers`) | `test/scheduled-tasks-with-arguments.test.js` | source sentinel |
| **AC-10** Deleted-customer warning | `T24` (entryResolver surfaces `CUSTOMER_NOT_FOUND` code) + `T25` (disableEntryWithError persists enabled=false + lastError + removes Job Scheduler) + `T33` (panel render-time badge cross-checks /api/get-customers). **Reviewer-driven** cycle-local smoke: load-bearing fire-time round-trip — delete a customer; on the next fire, the entry auto-disables with lastError in the panel and a `ENTRY_AUTO_DISABLED` event in events.jsonl. | `test/scheduled-tasks-with-arguments.test.js` + smoke | source sentinel + smoke |
| **AC-11** Existing entries survive the upgrade | `T2` (v1 → v2 migration preserves all 5 schedule fields bit-for-bit) + `T12` (validateEntry accepts no-args legacy entry) + `T14` (readConfig calls migrator) + `R1` (HousePovUnconfiguredBanner kept) + `R2` (reconcileSchedulesFromConfig kept) | `test/scheduled-tasks-with-arguments.test.js` | unit + source sentinel + regression |
| **AC-12** Persistence across restarts | `T2/T3/T4/T5` (migration round-trips) + `T14` (readConfig migrates on every load) + `R2` (reconcileSchedulesFromConfig hook intact for `bin/control-panel.js`) | `test/scheduled-tasks-with-arguments.test.js` | unit + source sentinel + regression |
| **AC-13** Per-entry last-run / next-run visibility | `T15` (per-entry Job Schedulers via `sched:${entry.id}`) + ADR 0019's `scheduler.getNextRun(entryId, taskId)` returning per-scheduler timing. **Reviewer-driven** cycle-local: panel displays per-entry timestamps independently. | `test/scheduled-tasks-with-arguments.test.js` + smoke | source sentinel + smoke |
| ADR §Tests "Migration" — v1 → v2 deterministic | `T2` | unit |
| ADR §Tests "Migration" — v2 passthrough | `T3` | unit |
| ADR §Tests "Migration" — empty → v2 with empty entries | `T4` | unit |
| ADR §Tests "Migration" — idempotent | `T5` | unit |
| ADR §Tests "validation" — `isValidSchedule` rule (no 1h floor, but SOMETHING must be set if enabled) | `T13` (NEW; rejects enabled-but-zero-schedule) | unit |
| ADR §Tests "validation" — cron accepted as a valid schedule | `T11` (accepts processCustomer with cron `0 */6 * * *`) | unit |
| ADR §Tests "Scheduler-layer entryId keying" | `T15` (`sched:${entry.id}`) + `T16` (per-entry reconcile iteration) + `T18` (entryId in job-data) | source sentinel |
| ADR §Tests "Reconcile does NOT call CustomerManager" | `T17` (negative-grep: no CustomerManager/getCustomer in scheduler.js) | source sentinel |
| ADR §Tests "entryResolver structure" | `T21` (exports) + `T22` (reads config + validates) + `T23` (CustomerManager) + `T24` (CUSTOMER_NOT_FOUND code) + `T25` (disable persists + removes Job Scheduler) | source sentinel |
| ADR §Tests "Processor branch wired" | `T26` (`if (entryId)` + import from `./entryResolver`) | source sentinel |
| ADR §Tests "CRUD: delete refuses enabled without force" | **Reviewer-driven** cycle-local (HTTP-level; source-grep would be false-positive-prone) | smoke |
| ADR §Tests "Frontend: modal full schedule surface (cron + minutes)" | `T27` (modal references `intervalMinutes` + `cron` inputs) | source sentinel |
| ADR §Tests "Frontend: panel cross-checks /api/get-customers" | `T33` (panel fetches /api/get-customers for label derivation + badge) | source sentinel |

### Why one suite, not split

All 35 tests target the same story-24 implementation surface: `src/api/scheduled-tasks/{index,migration,validation}.js`, `src/manage/taskQueue/queue/{scheduler,entryResolver,processor}.js`, `src/api/index.js` route registrations, and four new `ui/src/pages/settings/scheduledTasks/*.jsx` files plus the `RelaySettings.jsx` panel rewrite. Splitting would duplicate the registry-load and the fixture pubkeys. One suite, 35 tests, clear sectioned structure — same pattern stories #16 and #22 used.

## Edge cases

Covered explicitly inside the suite:

- [x] **Migration preserves ADR 0019's 5 schedule fields** (not just ADR 0003's 3) — T2 covers intervalDays, intervalHours, intervalMinutes, cron, and enabled all preserved bit-for-bit on four fixture entries including sub-hour (`reconcileRecent` at 10min) and cron (`reconcileAll` at `0 4 * * 0`).
- [x] **Migration of empty / fresh-install file** — T4 covers `{}` and `null` inputs producing `{ version: 2, entries: [] }`.
- [x] **Migration idempotence** — T5 covers `migrate(migrate(v1)) ≡ migrate(v1)`. Critical because readConfig invokes the migrator on every read (ADR 0021 §Files-to-edit).
- [x] **isValidSchedule rule** — T13 covers `enabled: true` with all-zero interval AND empty cron → must reject. ADR 0019 dropped the 1h floor but kept the "schedule must specify SOMETHING" rule.
- [x] **Cron in a validated entry** — T11 covers `processCustomer` with `cron: '0 */6 * * *'` (every 6 hours) accepted; proves the validator doesn't unintentionally require a positive interval.
- [x] **Multiple malformed-pubkey shapes** — T10 covers six rejection cases including uppercase (ADR pins lowercase per CustomerManager canon), non-hex chars, off-by-one length, and empty string.
- [x] **Per-entry schedulerId** — T15 covers `sched:${entry.id}` (not ADR 0019's `sched:${taskId}`). This is the central enablement for multi-entry-per-task scheduling.
- [x] **Anti-pattern: scheduler.js must NOT call CustomerManager** — T17 covers the negative grep. ADR 0021 explicitly moves customer resolution to FIRE time; a reintroduction at upsert time means Option D (rejected) slipped in.
- [x] **Anti-pattern: scheduler.js must NOT pack customerArgs in job-data** — T18 covers the negative grep. If customerArgs appears in scheduler.js's job-template data, the implementation regressed to upsert-time resolution.
- [x] **entryResolver wired into the processor** — T26 covers the `if (entryId)` branch and the import.
- [x] **No-args legacy entries accepted** — T12 ensures the migrated `updateAllScoresForOwner` survives the first post-migration save without bouncing on validation.
- [x] **Modal includes intervalMinutes + cron inputs** — T27 covers ADR 0019's full schedule surface in the new modal.
- [x] **Panel cross-checks /api/get-customers at render** — T33 covers both the display-label freshness (renamed customer) and the deleted-customer badge.
- [x] **Story #4 regression — HousePovUnconfiguredBanner** — R1 ensures the banner wiring survives the panel rewrite.
- [x] **Story #22 regression — reconcileSchedulesFromConfig boot hook** — R2 ensures the cold-start path stays wired so `bin/control-panel.js` keeps working.

Surfaced as Reviewer-watch / cycle-local smoke items (out-of-band of the automated suite):

- [ ] **End-to-end multi-entry firing.** Create two `processCustomer` entries (Alice every 1h, Bob every 2h); verify both fire independently via BullBoard `/admin/queues` and the events.jsonl `TASK_START` records carry the right customer triple. **Reviewer-driven.**
- [ ] **Customer rename round-trip (NEW under per-fire resolution).** Rename Alice mid-schedule; verify the NEXT FIRE'S structured event carries the new `customerName`, not the old one. **Reviewer-driven** — proves fire-time resolution is actually picking up renames.
- [ ] **Customer delete round-trip (NEW load-bearing under ADR 0021).** Delete Bob mid-schedule; verify (a) the next fire auto-disables Bob's entry (`entry.enabled=false`, `entry.lastError.code='CUSTOMER_NOT_FOUND'` persisted in `/var/lib/brainstorm/scheduled-tasks.json`); (b) the BullMQ Job Scheduler `sched:<bob-entry-id>` is removed from Redis; (c) an `ENTRY_AUTO_DISABLED` event appears in `/var/log/brainstorm/taskQueue/events.jsonl`; (d) the panel shows Bob's entry as disabled with the lastError red banner on next refresh; (e) the disabled state survives a control-panel restart (the boot reconcile doesn't re-enable the entry). **Reviewer-driven.**
- [ ] **Render-time deleted-customer badge.** Delete a customer; immediately refresh the panel (do NOT wait for the next fire); verify the orphan entry shows `⚠️ Customer no longer exists` from the client-side `/api/get-customers` cross-check.
- [ ] **Display-label rename freshness.** Rename a customer; refresh the panel; verify the customer-task entry's displayed label uses the NEW customer name (panel re-derives client-side per ADR 0021 §Q4) — without the operator having edited the entry.
- [ ] **Modal Save disablement is observable in the browser.** Source sentinel T32 asserts the `disabled` attribute; the Reviewer confirms visually.
- [ ] **Per-entry timestamp independence.** Two enabled `processCustomer` entries (Alice + Bob) on different cadences must show separate next-run/last-run in the panel.
- [ ] **handleDelete force-flag protection.** A `POST /api/scheduled-tasks/delete { entryId, force: false }` against an enabled entry must return non-200 with a clear error; the same call with `force: true` must succeed. HTTP-level — Reviewer-driven smoke.
- [ ] **API-shape-break acceptance.** ADR 0019's `GET /api/scheduled-tasks/list` returned `{tasks:[…]}`; ADR 0021 returns `{entries:[…]}`. No backward-compat shim. Reviewer notes this in the deploy diff against any consumers.
- [ ] **One-way migration acceptance.** Operators considering rolling back to pre-ADR-0021 server image must take a JSON snapshot of `/var/lib/brainstorm/scheduled-tasks.json` first. **Reviewer-watch** of OPERATIONS.md documentation.

## Test infrastructure

- **Framework:** Hand-rolled Node runner (`node test/test.js`). Matches the in-repo style. Each test is an `async fn` that throws on assertion failure.
- **No external dependencies beyond Node stdlib.** `fs`, `path`. Migration and validation modules are pure JS — testable with plain `require()`.
- **Fixture pubkeys:** `'a'.repeat(64)` (Alice), `'b'.repeat(64)` (Bob). Synthetic but well-formed 64-char lowercase hex. Never collide with real customer data; require no test-database state.
- **No mocking of CustomerManager.** `entryResolver` is tested as source sentinels only (T21–T25); the behavioral fire-time lookup belongs to cycle-local smoke against a real CustomerManager-backed container.
- **Concept Graph API:** not required for this story (no concept handles touched).
- **Firmware reinstall:** no.

## How to run

```
npm test
```

The suite registers as `scheduled-tasks-with-arguments suite:` at the end of `test/test.js`'s suite list.

For the Reviewer's cycle-local smoke (behavioral round-trip; runs against the live Docker stack):

```bash
# Once the implementation is in:
docker exec tapestry npm test
# Confirms all 35 tests pass server-side.

# Open the live panel:
open http://localhost:8080/tapestry/settings/relays
# Navigate to Scheduled Tasks tab. Verify the migrated legacy entries
# (Update All Scores for Owner, Refresh Meilisearch profiles & House PoV
# scores) are still listed, with their pre-upgrade enabled state + schedule.

# Add a processCustomer entry for Alice, 1h cadence, enabled.
# Add a second processCustomer entry for Bob, 2h cadence, enabled.
# Wait ≥ 1h. Confirm both fire in BullBoard (/admin/queues) and in:
docker exec tapestry tail -n 200 /var/log/brainstorm/taskQueue/events.jsonl | grep -E 'processCustomer|ENTRY_AUTO_DISABLED'

# ── Customer rename round-trip (NEW under per-fire resolution) ──
# Rename Alice via customer-management. Verify the next fire's TASK_START
# event carries the NEW customerName (not the old).

# ── Customer delete round-trip (NEW load-bearing under ADR 0021) ──
# Delete Bob via customer-management. On the NEXT fire (not next boot):
#  - Bob's entry flips to enabled:false in /var/lib/brainstorm/scheduled-tasks.json
#  - entry.lastError = {code:'CUSTOMER_NOT_FOUND', ...} persists
#  - sched:<bob-entry-id> is removed from BullMQ (BullBoard shows it gone)
#  - events.jsonl carries an ENTRY_AUTO_DISABLED record
#  - Panel shows the disabled state + red lastError banner on next refresh
# Restart the control panel; verify the disabled state survives (boot reconcile
# doesn't re-enable).

# ── Render-time deleted-customer badge ──
# Delete a different customer with an enabled entry; refresh the panel
# IMMEDIATELY (before next fire). Verify ⚠️ "Customer no longer exists"
# appears from the client-side /api/get-customers cross-check.

# Pre-upgrade rollback test (optional, paranoia-level):
docker exec tapestry cat /var/lib/brainstorm/scheduled-tasks.json
# Confirm v2 shape (version: 2, entries: [...]).
```

## Verification

The new tests fail with the current code (pre-implementation). Confirmed on 2026-05-23 at commit `f4951c7b`:

```
scheduled-tasks-with-arguments suite:
  ✗ T1..T13   migration + validation modules don't exist yet
  ✗ T14-T16   scheduler.js (queue layer) doesn't reference entry.id / config.entries / migrateConfigIfNeeded
  ✓ T17       scheduler.js does NOT call CustomerManager (currently true — anti-pattern check vacuously holds)
  ✗ T18       scheduler.js doesn't pack entryId in job-data
  ✗ T19       handleCreate / handleDelete / handleRegistryTasks not yet exported
  ✗ T20       /create, /delete, /registry-tasks routes not registered
  ✗ T21..T25  entryResolver.js doesn't exist
  ✗ T26       processor.js doesn't have the if (entryId) branch
  ✗ T27..T29  frontend files missing
  ✓ T30       ScheduledTasksPanel already fetches /list (ADR 0019 work intact)
  ✗ T31..T33  panel doesn't have ScheduledEntryCard / entry-prop / /api/get-customers cross-check
  ✓ R1        HousePovUnconfiguredBanner still present (story #4 regression guard holds)
  ✓ R2        reconcileSchedulesFromConfig still exported (story #22 / ADR 0019 boot hook intact)

Test Results
-------------
Configuration Loading:                           PASS
treasure-maps-router-preset suite:               PASS (5/5)
scheduled-search-and-house-scores-refresh suite: PASS (12/12)
strfry-router-first-boot-config suite:           PASS (3/3)
per-query-neo4j-timeout-safety-net suite:        PASS (8/8)
nip05-checkmark-verification suite:              PASS (4/4)
publish-export-a-concept suite:                  PASS (3/3)
community-reference-nostr-relay-stub suite:      PASS (4/4)
header-conceptgraph-tag suite:                   PASS (2/2)
community-reference-superset-link suite:         PASS (4/4)
graperank-shared-csv-race suite:                 PASS (13/13)
community-class-thread-pull suite:               PASS (10/10)
task-queue-bullmq suite:                         PASS (18/18)
task-queue-neo4j-resource-class suite:           PASS (14/14)
entrypoint-template-rendering suite:             PASS (11/11)
bullboard-admin-access suite:                    PASS (9/9)
admin-tools-dashboard-panel suite:               PASS (9/9)
reconciliation-incremental-mode suite:           PASS (16/16)
generalized-task-scheduler suite:                PASS (12/12)
reconciliation-rearchitecture suite:             PASS (15/15)
scheduled-tasks-with-arguments suite:            FAIL (4 passed, 31 failed)
Overall:                                         FAIL
```

The 20 sibling suites continue to PASS — **no collateral damage** from the new suite. Each of the 31 failures carries a right-reason message that points the Implementer at the exact gap (missing module, absent export, contract sentinel unmet). The 4 passing tests confirm the on-ramp from origin/staging: T17 (anti-pattern check vacuously satisfied), T30 (ADR 0019 panel /list fetch intact), R1 (story #4 banner intact), R2 (ADR 0019 boot hook intact).
