# neo4j-heavy Semaphore Investigation — Session Handoff (2026-05-24)

**Status:** 🔴 **OPEN** — investigation work not yet started; awaiting fresh session.
**Audience:** the operator / next-session reader who is picking up the task-queue semaphore investigation.
**Source session:** the multi-phase work on 2026-05-24 that (a) shipped story #25 (manual task re-trigger dedup fix) to prod, and (b) discovered during story #26's review that the `neo4j-heavy` semaphore is functionally broken — it releases ~5-6 seconds after acquire while tagged work runs unprotected for hours.

---

## TL;DR for the new session

1. **The investigation target is the new HIGH-priority intake at [`engineering-team/stories/_intake.md`](../engineering-team/stories/_intake.md)** — the entry titled "**2026-05-24 — Bug: `neo4j-heavy` semaphore released ~5s after acquire while tagged work runs unprotected for hours**" (last entry in the file). It has the probe steps, fix-shape options, and impact analysis.
2. **The full evidence + architectural context is in [`engineering-team/decisions/0023-task-queue-semaphore-protection-audit.md`](../engineering-team/decisions/0023-task-queue-semaphore-protection-audit.md)** — specifically the section titled "**2026-05-24 amendment (later) — chosen mechanism is functionally moot; story #26 paused pending root-cause investigation**". Read this for the empirical PID-by-PID evidence table, candidate hypotheses, and impact on past work (PR #201 + story #26).
3. **There's a held branch** [`fix/launch-child-task-protection-audit`](https://github.com/nous-clawds4/tapestry/tree/fix/launch-child-task-protection-audit) on origin (pushed for preservation; NOT merged). It contains story #26's tag-additions + ADR amendments. After the investigation completes, the new session decides whether to revert, carry forward, or ship as no-op-with-honest-docs.
4. **Don't trust ADR 0013's documented contract** (cap concurrent neo4j-heavy at 1) until the investigation completes. The contract is not actually enforced. See operational caveats below.

---

## What shipped to production today (story #25 only)

| PR | Merge commit | Summary |
|---|---|---|
| [#205](https://github.com/nous-clawds4/tapestry/pull/205) | `cfa25e23` | Story #25 / ADR 0022 — manual task re-trigger dedup fix (closes Intake B) |
| [#206](https://github.com/nous-clawds4/tapestry/pull/206) | `f94d3458` | Promotion of #205 to main |

Story #25 added `removeOnComplete: true, removeOnFail: true` to the `queue.add` call at `src/manage/taskQueue/queue/index.js:185`. Manual `/api/run-task` re-triggers now correctly create fresh executions after the previous attempt finishes (completed or failed). Cycle-staging + cycle-prod both clean; current docs at brainstorm.world reflect the fix.

## What's PAUSED (story #26)

Story #26 ("Close `neo4j-heavy` semaphore coverage gaps for subshell-invoked task chains") went through Planning → Architecture → Test Design → Implementation → **paused at Review** when the operator surfaced the held_seconds=6 discovery.

The paused work lives on `fix/launch-child-task-protection-audit` (6 commits ahead of `origin/staging` at the time of handoff). It contains:
- `processAllTasks` and `processNpubsUpToMaxNumBlocks` tagged `resourceClass: "neo4j-heavy"` in `taskRegistry.json`
- ADR 0013 amended in place with a "Protection model" section + audit-results table
- BIBLE.md §24 updated with the parent-tag convention paragraph
- ADR 0023 written + amended twice (JS-exec scope-out, then premise-undermined)
- Reviewer report committed WITH withdrawal addendum (preserved audit trail)
- 6 structural sentinels in `test/task-queue-semaphore-protection-audit.test.js`

**The work is structurally correct against the AC list it was written against.** It just doesn't actually protect anything in production because the semaphore is released within ~6 seconds regardless. Decision on what to do with these commits is part of the investigation outcome.

---

## The discovery

Operator noticed on staging Scheduled Tasks panel: `Process Brainstorm` (taskId: processCustomer) had a TASK_START at 7:12 PM EDT with no matching TASK_END for 1.5 hours. BullBoard active view: empty. Task explorer: TASK_START without TASK_END.

Pulling `resource_class_*` events from `events.jsonl` revealed (all UTC):

| Timestamp | Event | PID | Detail |
|---|---|---|---|
| 23:12:57.975 | `resource_class_wait_end` | 188 (Node Worker) | semaphore **acquired**, wait_seconds: 0 |
| 23:12:58 | `TASK_START` (×2) | 1723 (processCustomer.sh) | task begins |
| **23:13:03.973** | **`resource_class_released`** | **188** | semaphore released, **`held_seconds: 6`** |
| (77-min gap — processCustomer.sh PID 1723 still running) | | | |
| 00:29:37 (2026-05-25) | `TASK_END` (×2) | 1723 | task finishes |

**Confirmed against another tagged task:** `updateAllScoresForOwner`'s most recent run (19:08:19 UTC) — same `held_seconds: 6` shape. Pattern is likely universal across all tagged tasks that go through the scheduler.

**Mechanism (not yet root-caused):** The BullMQ Worker callback in `src/manage/taskQueue/queue/index.js:118-131` is `await processor.processJob(...)` then `await release()` in `finally`. processor.processJob spawns `bash launchChildTask.sh ...` and resolves on `child.on('close')`. Empirically that close fires within 5-6 seconds even when the backgrounded task script is clearly still running. **Why** the close fires is the open investigation question. Hypotheses (all unverified) in the intake entry.

---

## What to do first in the new session

1. **Read the intake entry** (last entry in `engineering-team/stories/_intake.md`) for the probe shape + fix-shape options + impact analysis.
2. **Read ADR 0023's amendment** for the full evidence + candidate root-cause hypotheses.
3. **Write the reproduction probe** described in the intake (Method section: deterministic, runs inside the container, instruments every event in the chain). The probe identifies which event at T+~5s causes the close to fire while the work continues. Without the probe, fix design is guesswork.
4. **Then design the fix** — the intake lists 5 fix shapes (fix launchChildTask PID tracking, fix processor.js spawn, refactor semaphore wrap into bash, lease/poll model, refactor parents to /api/run-task). Architect picks one after the probe results land.
5. **Then re-evaluate story #26's held branch** — revert / carry forward / ship as no-op-with-honest-docs.

Workflow: `/discuss` first (align on investigation scope + interpret the probe outcome), then Planning + Architecture + Test + Implementation + Review.

---

## Operational caveats while the investigation is open

**Do NOT** rely on the `neo4j-heavy` semaphore for cross-task serialization until this is fixed. Specifically:

- **Avoid the JS-exec API endpoints** (they bypass BullMQ AND the semaphore — separate intake also filed, see "JS-driven `child_process.exec`" entry in `_intake.md`):
  - `POST /api/process-all-active-customers`
  - `POST /api/generate-pagerank`
  - `POST /api/generate-reports`
  - `POST /api/generate-verified-followers`
  - `GET /api/calculate-hops`-ish
- **Don't manually trigger `/api/run-task` for heavy tasks** while another heavy task is scheduled to fire — the semaphore won't actually serialize them.
- **Don't add new tagged scheduled entries** that overlap in cadence with existing ones.

**But leave automated tasks running.** The broken-protection state has been live since story #15 shipped (~2026-05-20) without a Neo4j crash. Current scheduled fires are stable. Halting them would cost more (no GrapeRank recalcs, no Meili refresh, no NPub sync, no reconciliation, no customer processing) than the marginal risk reduction is worth. Whatever's been keeping Neo4j stable will continue.

---

## Other open intakes (so the new session doesn't lose track)

All in [`engineering-team/stories/_intake.md`](../engineering-team/stories/_intake.md) — sorted by priority:

### HIGH

- **[2026-05-24] `neo4j-heavy` semaphore released ~5s after acquire** — THIS investigation (the one this handoff is about).

### MEDIUM-HIGH

- **[2026-05-24] Legacy API handlers `child_process.exec` tagged-task scripts directly, bypassing BullMQ + semaphore** — 5 endpoints listed; same root concern as this investigation but via different URLs.

### MEDIUM

- **[2026-05-24] `launch_child_task` subshell pattern bypasses BullMQ + `neo4j-heavy` semaphore** (the original Intake A — story #26's premise; superseded by this handoff's investigation but the architectural framing is still useful).

### MEDIUM-LOW

- **[2026-05-24] Unified all-tasks timeline UI (cross-queue past + present + future)** — operator-experience Feature surfaced during `/discuss` of Intake B. Independent from the semaphore work.
- **[2026-05-21] `/relay` public HTTP landing page is unhelpful plain-text (+ NIP-11 merge silently incomplete)** — UX + Bug, public-facing.
- **[2026-05-21] `reconcileAuthor` trigger surfaces (profile button + API + per-customer scheduling)** — Feature; engine works, UI/API surfaces deferred.
- **[2026-05-21] Deprecate legacy `reconciliation` task + `reconcile.timer`** — Cleanup; superseded by story #21.

### LOW

- **[2026-05-24] Scheduled-fire job retention (`upsertJobScheduler` opts)** — Redis-memory hygiene; deferred from story #25.
- **[2026-05-21] Per-request `/etc/brainstorm.conf` re-read spam in `brainstorm.log`** — log-hygiene.
- **[2026-05-24] Origin-sync check at PO + Architect phases** — meta-tooling for the engineering-team harness; prevents stale-branch bugs at session start.

Already-shipped older intakes from May 13–21 (`Scheduled task: refresh Meilisearch…`, `strfry-router FATAL on first boot`, `NIP-05 SSRF`, `graperank shared CSV race`, `generalized Task Scheduler`) are still in the log for historical context but no longer need action. A future cleanup pass could prune them.

---

## State of the world

| Item | Status |
|---|---|
| `main` (prod) | `f94d3458` — story #25 live, behaves correctly within the now-known semaphore limitations |
| `origin/staging` | `6aa92c08` — = main + PR #207 (`feat/assistant-profile` — unrelated, merged during this session by user) |
| `fix/launch-child-task-protection-audit` | Pushed to origin, NOT merged. 6 commits of paused story #26 work + investigation evidence. |
| `docs/semaphore-investigation-handoff-2026-05-24` | THIS doc + intake updates + README + CLAUDE.md updates. Ready for cycle-staging. |
| Empirical probe | NOT YET WRITTEN. New session's first concrete work. |
| Chrome MCP | Confirmed working at end of source session. Sign-in cookies shared with the user's main Chrome profile. |

---

## Where to start the next session

1. Read this doc. Read the new-intake entry. Read ADR 0023's amendment.
2. `/discuss` the investigation scope. Confirm: probe first, then fix design.
3. `/plan-feature` the investigation as its own story.
4. `/design-architecture` once the probe identifies the root cause.
5. `/design-tests` + `/implement-feature` + `/review-changes` per the standard chain.
6. After the fix lands and verifies on staging+prod, return to the held branch (`fix/launch-child-task-protection-audit`) and decide its fate.
