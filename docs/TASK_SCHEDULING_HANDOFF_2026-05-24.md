# Task Scheduling — Session Handoff (2026-05-24)

**Status:** ✅ **ADDRESSED / SUPERSEDED** by [`SEMAPHORE_INVESTIGATION_HANDOFF_2026-05-24.md`](SEMAPHORE_INVESTIGATION_HANDOFF_2026-05-24.md).

The follow-on session this handoff was written for took place on 2026-05-24. During it: story #25 (Intake B — manual task re-trigger dedup fix) shipped to prod; story #26 (Intake A — close subshell-chain semaphore coverage gaps) ran through Planning → Architecture → Test Design → Implementation → Review and was then PAUSED when an operator-surfaced discrepancy revealed that the `neo4j-heavy` semaphore is functionally broken (released ~5-6 seconds after acquire while tagged work runs unprotected for hours). That discovery is now the primary investigation target. **New work continues from the superseding handoff doc above, not from this one.**

The testing checklist (T1–T28) below was largely overtaken by events — story #25 implicitly verified many of the items by shipping cleanly, and the semaphore discovery makes T11/T27's behavioral claims about cross-task serialization moot until the investigation lands.

The original content of this handoff is preserved below for historical context.

---

> **Audience:** the operator / next-session reader who wants to know what shipped today, what's been verified, what hasn't, and where to start testing.
> **Source session:** the multi-PR cycle on 2026-05-24 that closed story #24 (per-entry scheduled tasks with arguments) plus three operator-discovered follow-up fixes.

---

## What shipped to production today

All four PRs are on `main` and live at `https://brainstorm.world`.

| PR | Merge commit | One-line summary |
|---|---|---|
| [#195](https://github.com/nous-clawds4/tapestry/pull/195) | `c9bef416` | **Story #24 / ADR 0021 main feature** — per-entry scheduled tasks with arguments |
| [#197](https://github.com/nous-clawds4/tapestry/pull/197) | `49e0b861` | **Dropdown filter fix** — re-included non-parameterized tasks (`reconcileAll`/`Recent`/`Author`/`Network`) in the Add Scheduled Entry modal |
| [#199](https://github.com/nous-clawds4/tapestry/pull/199) | `6ad154d2` | **Recent Runs dedup** — one row per fire (was 2× per fire because `events.jsonl` records the wrapper + script emits separately) |
| [#201](https://github.com/nous-clawds4/tapestry/pull/201) | `da1e8c66` | **`neo4j-heavy` registry backfill** — 20 task tags added, closing the concurrency gap that let `updateAllScoresForOwner` run alongside `reconcileAll` |

Net effect: any parameterized task in the registry can now be scheduled per-customer (or per-arg-combination) on independent cadences, with proper fire-time customer resolution, deduplicated Recent Runs reporting, and `neo4j-heavy` semaphore serialization for the 26 tagged tasks.

---

## Verified working on prod (Tier 4 visual + targeted endpoint smoke)

These were exercised end-to-end through Chrome MCP and curl during the cycle-staging + cycle-prod runs today:

### Story #24 acceptance criteria — all 13

| AC | Verification |
|---|---|
| **AC-1** Every parameterized task is schedulable | ✅ `/api/scheduled-tasks/registry-tasks` returns 51 tasks; modal dropdown renders all of them |
| **AC-2** Registry is single source of truth for arg form | ✅ argFieldRenderer reads from registry; new args appear without code change |
| **AC-3** Argument-form parity with legacy Task Explorer | ✅ customer/boolean/optional shapes render identically; CustomerPicker reuses `/api/get-customers` |
| **AC-4** Multiple scheduled entries per task | ✅ Two `processCustomer` entries (different customers, different cadences) coexist; each has its own Job Scheduler keyed `sched:${entry.id}` |
| **AC-5** Each entry has recognizable label exposing args | ✅ "Process Brainstorm" entry shows `Args: warmStart=true, customer=25fc4856…a6bd`; operator-customized labels take precedence over auto-derive |
| **AC-6** Required arguments block save | ✅ Modal disables Save while customer is missing; backend 400 on `/create` confirms server-side enforcement |
| **AC-7** Fired task receives configured arguments | ✅ `events.jsonl` shows the customer triple reaching processCustomer.sh per fire |
| **AC-8** Optional arguments respect declared defaults | ✅ warmStart pre-fills from registry default in modal |
| **AC-9** Customer picker shares legacy explorer's source | ✅ Both surfaces call `/api/get-customers` |
| **AC-10** Deleted-customer warning | ✅ Fire-time `CUSTOMER_NOT_FOUND` round-trip verified during cycle-staging; auto-disables + records `lastError` + removes Job Scheduler + emits `ENTRY_AUTO_DISABLED` |
| **AC-11** Existing entries survive the upgrade | ✅ Two legacy entries (`updateAllScoresForOwner`, `refreshSearchIndex`) migrated with stable `legacy:<taskId>` IDs; schedules preserved bit-for-bit |
| **AC-12** Persistence across restarts | ✅ Boot reconcile restores all enabled entries; staging deploys confirmed the persistence path |
| **AC-13** Per-entry last-run / next-run visibility | ✅ Panel shows distinct timestamps per entry; verified live |

### Follow-up PR features

| Feature | Verification |
|---|---|
| All 4 reconcile* tasks in Add Entry dropdown | ✅ `reconcileAll`, `reconcileRecent`, `reconcileAuthor`, `reconcileNetwork` all present (PR #197) |
| Continuous-frequency daemons excluded | ✅ `taskQueueManager`, `taskScheduler`, `taskExecutor` not in dropdown |
| Recent Runs shows one row per fire | ✅ All 4 prod entries' Recent Runs tables — no duplicate `startedAt` timestamps (PR #199) |
| Session dedup matches legacy explorer | ✅ My endpoint's row count (capped at 5) matches legacy explorer's `executionSessions` for the same task |
| `neo4j-heavy` semaphore tagging | ✅ Structural — 26 tagged tasks; brainstorm process restarted on PR #201 deploy, BullMQ Workers re-initialized with new tags active |

### Architectural integrity

| Property | Verification |
|---|---|
| Story #4's `HousePovUnconfiguredBanner` preserved | ✅ Still wired to `legacy:refreshSearchIndex` entry |
| Story #4's exact UI titles preserved | ✅ `LEGACY_TITLE_OVERRIDES` shows "Update All Scores for Owner" + "Refresh Meilisearch profiles & House PoV scores" |
| ADR 0019's `reconcileSchedulesFromConfig` boot hook intact | ✅ `bin/control-panel.js` call site unchanged |
| ADR 0019's Job Scheduler durability intact | ✅ Boot reconcile re-establishes Job Schedulers; survives control-panel restart |
| No console errors on the panel | ✅ Confirmed via Chrome MCP |

---

## NOT yet verified behaviorally (testing gaps)

These haven't been exercised against real load on prod — either because there's no current operator-driven trigger pattern that would produce them, or because they require a deliberate setup:

### Semaphore behavior under real overlap

The `neo4j-heavy` semaphore (cap=1) is now correctly tagged on 26 tasks, but **two tagged BullMQ-Worker-driven jobs running at literally the same instant** hasn't been observed yet — the current scheduled set is staggered. To verify the semaphore actually engages:

- **Test:** schedule two enabled tagged entries with cron expressions that fire at the same minute (e.g., `0 14 * * *` and `0 14 * * *` — both at 14:00 UTC). Watch BullBoard's `active` count: one should hold while the other waits inside `semaphore.acquire()` (showing as `active=1, waiting=0, jobs in queue but not yet picked up`). After the first finishes, the second's `acquire()` resolves and it proceeds.
- **Caveat:** subshell-invoked children don't go through BullMQ Workers — see Intake A.

### Modal edge cases not yet exercised

- **Edit an existing entry's args** (changing the customer from Alice to Bob): expected to re-validate at save-time + re-upsert the Job Scheduler with the same `entry.id`.
- **Edit just the schedule** (no args change): expected to skip the save-time CustomerManager check (per PR #195 fix #2's gate on `args !== undefined`).
- **Delete an enabled entry without force**: expected to return 400 with `code: 'ENABLED_NO_FORCE'` and refuse.
- **Delete an enabled entry with force**: expected to succeed, remove from config, remove Job Scheduler.
- **Argument type beyond customer/boolean/optional** (e.g., a new task added to the registry with an enum arg): expected to render as a text-input fallback with a `console.warn`. None exist in the registry today.

### Customer-lifecycle edge cases

- **Rename a customer mid-schedule**: expected — next fire's structured event carries the new `customerName`; panel's display label refreshes on next refresh (computed client-side from `/api/get-customers`).
- **Delete a customer with an enabled entry referencing it**: expected — next fire auto-disables the entry, persists `lastError.code='CUSTOMER_NOT_FOUND'`, removes the Job Scheduler, emits `ENTRY_AUTO_DISABLED`. The panel's render-time orphan badge surfaces this before the next fire.
- **Re-create a customer with the same pubkey after auto-disable**: expected — entry stays disabled. Operator must explicitly re-enable. (Intentional design per ADR 0021.)

### Migration on a fresh container

The migration was tested on staging/prod (which had ADR 0019's per-task config to migrate). What hasn't been tested:

- A truly empty `/var/lib/brainstorm/scheduled-tasks.json` (e.g., a brand-new container) — should yield `{version:2, entries:[]}`.
- A v2 file already present — should pass through idempotently.

### BullBoard behavior under retries / failures

- A scheduled fire that fails (script exits non-zero): expected to mark the BullMQ job as `failed`; the entry stays enabled and the next tick fires normally; events.jsonl records the failure.

---

## Open architectural questions (queued as next-session intake entries)

Both are documented in detail in `engineering-team/stories/_intake.md`:

### Intake A — `launch_child_task` subshell pattern bypasses BullMQ + semaphore

Parent task scripts (`updateAllScoresForOwner.sh`, `processAllActiveCustomers.sh`, etc.) invoke their children via the `launch_child_task` shell function (sourced from `launchChildTask.sh`). These children run as in-process subshells, bypassing BullMQ entirely. So their `resourceClass` tags are dormant on parent-driven paths. The Tier 1 fix in PR #201 (tagging parents) is the load-bearing piece; tagging children is a safety net for ad-hoc operator runs.

**Trade-offs to triage next session:**
1. Accept the current architecture (parent-tagging works; document the pattern).
2. Refactor parent scripts to invoke children via `/api/run-task` so children flow through BullMQ + their own Worker callbacks.
3. Have `launch_child_task` itself acquire the semaphore directly via Redis (more invasive).

### Intake B — BullMQ `jobId` dedup silently blocks manual re-triggers

BullMQ's `queue.add` dedups by `jobId` across **all** states (including `completed`/`failed`), not just `wait`/`active` as ADR 0012 implied. Practical consequence: manually triggering a non-customer task that's ever completed via BullMQ returns the stale completed job's metadata without running fresh.

**Three remediation options:**
1. `removeOnComplete: 10` (or similar) — auto-removes old completed jobs, freeing the `jobId`. Smallest diff. **Recommended.**
2. Unique `jobId` per attempt (e.g., `${taskName}:${Date.now()}`) — eliminates dedup. Trade-off: loses ADR 0012's intentional concurrent-fire dedup for customer tasks.
3. Hybrid — keep stable `jobId` during `wait`/`active`, switch to a fresh ID once in `completed`. Requires a precheck before `queue.add`.

---

## Testing checklist for the next session

Work through these in order. Each item has an Expected outcome + a Tier (1=must-pass, 2=should-pass, 3=nice-to-verify).

### Tier 1 — must pass (regression guards on the shipped feature)

- [ ] **T1** Open `https://brainstorm.world/tapestry/settings/relays` → Scheduled Tasks tab. Panel loads, shows all current scheduled entries, no console errors.
- [ ] **T2** Each entry's "Recent Runs" table shows ONE row per fire (no duplicate `startedAt` timestamps). [PR #199]
- [ ] **T3** Each entry's `Last triggered` and `next run` timestamps are independent (Alice's `next run` ≠ Bob's `next run` if you have two `processCustomer` entries).
- [ ] **T4** "+ Add Scheduled Entry" button opens the modal with a 51-task dropdown.
- [ ] **T5** Modal dropdown includes all four `reconcile*` tasks (`reconcileAll`, `reconcileRecent`, `reconcileAuthor`, `reconcileNetwork`). [PR #197]
- [ ] **T6** Modal dropdown excludes the three continuous-frequency daemons (`taskQueueManager`, `taskScheduler`, `taskExecutor`).
- [ ] **T7** Pick `processCustomer` from the dropdown → modal shows the CustomerPicker. Search by customer name — results filter correctly. Pick a customer.
- [ ] **T8** Save button is disabled while no customer is picked. Becomes enabled once one is picked.
- [ ] **T9** Save the entry → it appears in the panel list with the correct args summary (`customer=<short>…<last4>`).
- [ ] **T10** Operator-customized label takes precedence — type a custom label, save; the panel shows the custom string. Don't type one, save; the panel shows `<task name> — <customer name>` derived from the live customer list.

### Tier 2 — should pass (semaphore + lifecycle behaviors)

- [ ] **T11** Schedule two `neo4j-heavy`-tagged top-level entries with cron expressions that fire at the same minute (e.g., `updateAllScoresForOwner` and `reconcileAll` with the same `cron`). Watch `https://brainstorm.world/admin/queues` — one should be `active` while the other waits inside its Worker callback (NOT in `waiting`; the semaphore-wait happens *after* the Worker picks the job up). After the first finishes, the second proceeds.
- [ ] **T12** Edit an existing entry's args (change customer from A to B). Verify (a) save-time CustomerManager check runs against the new customer, (b) the Job Scheduler is upserted preserving the same `entry.id`, (c) the next fire runs against customer B.
- [ ] **T13** Edit just an entry's schedule (toggle enabled/disabled, change interval). Verify the save-time CustomerManager check does NOT bounce on a customer that may have been deleted since create-time (since `args` isn't in the patch).
- [ ] **T14** Delete an enabled entry without `force: true` via the modal (or curl). Expect 400 with `code: 'ENABLED_NO_FORCE'`.
- [ ] **T15** Delete an enabled entry via the "Delete" button in the panel (which prompts for force confirmation). Expect: removed from `scheduled-tasks.json`; Job Scheduler removed from Redis (verify via BullBoard).
- [ ] **T16** Trigger the `CUSTOMER_NOT_FOUND` round-trip: pick a customer, schedule a `processCustomer` entry with a short cadence (1-2 min), delete the customer via the customer-management surface, wait for the next fire. Verify: entry auto-disables in the panel; red `lastError` banner appears with `CUSTOMER_NOT_FOUND`; `events.jsonl` carries an `ENTRY_AUTO_DISABLED` record; the Job Scheduler is removed from Redis. Restart the control-panel — disabled state persists.
- [ ] **T17** Customer rename: rename a customer mid-schedule. Verify the next fire's structured event carries the new `customerName`. Refresh the panel — the display label now shows the new name (client-side cross-check with `/api/get-customers`).
- [ ] **T18** Render-time orphan badge: delete a customer; refresh the panel IMMEDIATELY (before the next fire). Verify the orphan entry shows `⚠️ Customer no longer exists` from the client-side `/api/get-customers` cross-check.

### Tier 3 — nice to verify (edge cases + adjacent surfaces)

- [ ] **T19** Schedule a non-customer parameterized task (e.g., `processAllTasks` with `warmStart=true`). Verify it fires correctly with the arg.
- [ ] **T20** Schedule a non-parameterized task (`reconcileNetwork`). Verify the modal shows no arg fields, Save is enabled immediately, the entry fires on schedule.
- [ ] **T21** Schedule via `cron` instead of interval. Verify the Job Scheduler uses the cron pattern (BullBoard shows the next scheduled time matching the cron).
- [ ] **T22** Schedule with sub-hour interval (`intervalMinutes: 10`). Verify ADR 0019's no-1h-floor.
- [ ] **T23** Verify legacy entries' titles still render exactly as story #4 had them: `Update All Scores for Owner`, `Refresh Meilisearch profiles & House PoV scores`.
- [ ] **T24** Verify the `HousePovUnconfiguredBanner` still appears on the `legacy:refreshSearchIndex` entry's card when House PoV is unset in Search Preferences.
- [ ] **T25** Verify `/api/scheduled-tasks/list` returns the new `{entries: [...]}` shape and `/api/scheduled-tasks/registry-tasks` returns the parameterized + non-continuous subset.
- [ ] **T26** Verify the `bin/control-panel.js` boot reconcile log line appears in the brainstorm log on container restart: `[scheduler] reconciled N enabled schedule(s) into BullMQ Job Schedulers (per-entry, ADR 0021)`.

### Tier 4 — open questions to confirm / replicate (the architectural surprises)

- [ ] **T27 (Intake A)** Confirm that a parent-driven child invocation does NOT engage the child's Worker semaphore. Method: schedule `updateAllScoresForOwner` (parent), wait for it to fire; while it's running, observe BullBoard — its calculated children (`calculateOwnerPageRank`, etc.) do NOT show up as `active` in their respective queues. They appear in `events.jsonl` though.
- [ ] **T28 (Intake B)** Confirm BullMQ `jobId` dedup blocks re-triggers. Method: pick a non-customer task that has a completed job in BullMQ (e.g., `calculateOwnerPageRank` per current prod state). Manually trigger it via the legacy task explorer's "Run Task" button. Verify: BullBoard count stays at 1 completed (no new job created); `events.jsonl` does NOT carry a new TASK_START. If it DOES create a new job, the dedup hypothesis is wrong — investigate further before opening a fix story.

---

## Operational notes

### Chrome MCP works

The "Claude in Chrome" extension was confirmed working at the end of the 2026-05-24 session. The MCP tab inherits cookies from the user's main Chrome profile, so signing in via NIP-07 in any tab makes the MCP tab authenticated as the same identity. Useful for any visual verification in the next session.

### Spawned task still parked

From early in the 2026-05-24 session, a spawned task was filed proposing an "origin-sync check at the start of PO + Architect phases" to prevent the stale-branch issue that started this session. It's still parked as a chip — spin it off whenever you want to address it (or dismiss it if you'd rather not).

### Branches to clean up locally and on origin

Several feature branches accumulated during the session. After this docs deploy lands, they can be deleted (their work is fully in `main`):

- `feat/scheduled-tasks-per-entry-args`
- `fix/scheduled-tasks-registry-tasks-filter`
- `fix/scheduled-tasks-recent-runs-session-dedup`
- `fix/neo4j-heavy-registry-tagging-backfill`
- `story-17-original-attempt` (the safety branch from the sync — no longer needed)

GitHub may auto-delete the merged ones; the safety branch is local-only.

---

## Where to start the next session

1. **Open a `/discuss` to triage Intake A + Intake B.** Decide which (if either) to formalize as the next story. Intake B is the smaller change and addresses a more immediate operator pain point (the inability to manually re-trigger tasks); my hunch is that's the higher-priority follow-up.
2. **Or, work through the testing checklist (T1-T26) first** to discover any additional gaps before formalizing follow-ups. If T27/T28 confirm the intake-entry hypotheses, you'll have empirical evidence to prioritize Intake B (or Intake A) higher.
3. **Once a fix lands for Intake B**, T28 becomes a regression guard — add it to a test suite.

The branch `feat/scheduled-tasks-per-entry-args` and friends have been merged; future work should branch off the latest `origin/staging` per the cycle-staging skill, and a fresh origin-sync check at session start avoids re-creating the stale-branch issue.
