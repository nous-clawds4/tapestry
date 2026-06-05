# Post-Timeout-Fix Session Handoff (2026-05-25)

**Status:** ✅ **ADDRESSED** (2026-05-26) — every recommended next-session item in this handoff was picked up and shipped end-to-end during the 2026-05-26 session. See [`docs/POST_TIMEOUT_FIX_COMPLETION_HANDOFF_2026-05-26.md`](./POST_TIMEOUT_FIX_COMPLETION_HANDOFF_2026-05-26.md) for the completion narrative + the next-session pickup state. Body below preserved as the audit trail of what was queued.
**Audience:** the operator / next-session reader picking up after today's `neo4j-heavy` timeout-propagation fix shipped to production.
**Source session:** the work on 2026-05-25 that (a) addressed the open `SEMAPHORE_INVESTIGATION_HANDOFF_2026-05-24.md`, (b) shipped story #27 / ADR 0024 (scheduled-task timeout propagation fix) to prod, (c) shipped the Track A follow-up (per-task timeout overrides) to prod, and (d) surfaced two new high-signal intakes during cycle-prod verification.

---

## TL;DR for the new session

1. **The semaphore investigation from `SEMAPHORE_INVESTIGATION_HANDOFF_2026-05-24.md` is COMPLETE.** That handoff's recommended path (`/discuss` → probe → fix design → ship) was followed end-to-end. The fix landed via **PR #215** (story #27 / ADR 0024 — `8968b384` on main, `2026-05-25 14:13Z`) and was further refined via **PR #217** (Track A — `9d9fb98a` on main, `2026-05-25 17:36Z`).
2. **Production state:** ADR 0013's documented `cap=1 neo4j-heavy` semaphore contract is now actually enforced for the first time since story #15 shipped on 2026-05-20. `processCustomer`'s post-fix `held_seconds` jumped from `6` (pre-fix bug shape) to `1805` (post-story-#27) to **`5400`-bounded** (post-Track-A). Verified empirically.
3. **Two NEW intakes filed today** in `engineering-team/stories/_intake.md` — both surfaced during Track A's cycle-prod verification:
   - **`forceKill: false` orphans suppress subsequent scheduled fires via `check_task_already_running`** (medium-high priority). Production was silently skipping scheduled fires since story #15 whenever wrapper-script timeouts fired. Track A reduces the frequency of timeouts but doesn't fix the mechanism. **Strong argument for `forceKill: true` as the new default.**
   - **BullMQ Job Scheduler stalled-recovered ticks use pre-deploy `job.data`** (low priority). Cutover-only artifact at deploy boundary; clears within a few ticks. Documented for future debug clarity.
4. **Held branch `fix/launch-child-task-protection-audit` (story #26 / ADR 0023)** is now **architecturally enabled to ship**. Its parent-task tag-additions for `processAllTasks` and `processNpubsUpToMaxNumBlocks` would correctly extend semaphore protection across the parent's full subshell chain (which is no longer 5 seconds — it's the configured timeout duration). Decision deferred to the next session.

---

## What shipped to production today (2026-05-25)

| PR | mergeCommit | Time (UTC) | Summary |
|---|---|---|---|
| [#214](https://github.com/nous-clawds4/tapestry/pull/214) | `8d11198a` | 05:51Z | Story #27 / ADR 0024 → staging — three-layer defense-in-depth fix for scheduled-task timeout propagation |
| [#215](https://github.com/nous-clawds4/tapestry/pull/215) | `8968b384` | 14:13Z | Promotion of story #27 to main → live on `brainstorm.world` at 14:14:30Z |
| [#216](https://github.com/nous-clawds4/tapestry/pull/216) | `14338901` | 15:38Z | Track A → staging — per-task timeout overrides for `processCustomer` (90 min), `updateAllScoresForOwner` (4 hr), `updateAllScoresForSingleCustomer` (4 hr) |
| [#217](https://github.com/nous-clawds4/tapestry/pull/217) | `9d9fb98a` | 17:36Z | Promotion of Track A to main → live on `brainstorm.world` at 17:38Z |
| direct push | `2764f79f` | (post-Track-A) | Two new intake entries filed (forceKill orphan + stalled-tick recovery) — currently on staging, awaiting next prod promotion |

All five 5-phase engineering-team artifacts for story #27 live in the repo:
- Story: `engineering-team/stories/27-scheduled-task-timeout-propagation.md`
- ADR: `engineering-team/decisions/0024-scheduled-task-timeout-propagation.md`
- Test plan: `engineering-team/stories/27-scheduled-task-timeout-propagation.test-plan.md`
- Tests + probe: `test/scheduled-task-timeout-propagation.test.js` + `test/probe-scheduled-task-timeout-propagation.js`
- Review: `engineering-team/reviews/27-scheduled-task-timeout-propagation.md` (verdict PASS)

Track A shipped fast-track (Implementer + Reviewer only, per intake guidance) — no story / ADR / test-plan files. The PR description (`#216`) carries the rationale.

---

## Key empirical findings from prod verification

### The fix works end-to-end

Three layers verified independently:

1. **scheduler.js → resolveTaskTimeout adoption** (story #27 layer 1): verified by U1 unit test + the fact that the master Job Scheduler in Redis (`bull:processCustomer:repeat:sched:entry-...`) now stores `data.timeoutMs: 5400000` post-Track-A.
2. **processor.js → conditional optionsJson** (story #27 layer 2): verified by S3 sentinel test + the wrapper script's `resolved_options` JSON now correctly carries `duration: 5400000`.
3. **launchChildTask.sh → monitor-loop guard** (story #27 layer 3): verified by S4 sentinel + by Path 1 of the in-container probe (`test/probe-scheduled-task-timeout-propagation.js` — runs cleanly via `docker exec`).

### Production timeline (`brainstorm.world` `held_seconds` evolution)

```
Pre-story-#27 (~10 days):   held_seconds:    6   ← bug (semaphore released 6s after acquire)
Post-story-#27, pre-Track-A: held_seconds: 1805   ← 30-min options_default ceiling hit
Post-Track-A:                held_seconds: 5400   ← 90-min processCustomer override (or actual duration, whichever shorter)
```

The 22:06:32Z post-Track-A processCustomer fire was the conclusive evidence — `resolved_options.failure.timeout.duration: 5400000` computed correctly. (That specific fire didn't actually run because of the forceKill orphan-suppression interaction documented in intake #1 below — but the wrapper-level evidence is unambiguous.)

### Surprise discovery: `forceKill: false` orphans silently suppress subsequent scheduled fires

During cycle-prod verification, the 20:23:04Z scheduled processCustomer tick (post-Track-A, fresh data) hit `check_task_already_running` at 22:06:32 and found the orphan from the previous stale-recovered 17:23 tick still running (PID 195788). The default `processAlreadyRunning.withoutError.launchNew: false` policy prevented the new launch — the scheduled fire was effectively SKIPPED, silently.

This means: **production has been silently skipping scheduled fires since story #15 shipped**, whenever a wrapper-script timeout created an orphan that outlived the next scheduled tick's start. The cumulative impact wasn't visible because the `TASK_LAUNCH_PREVENTED` event looks like success from BullMQ's perspective.

Track A reduces the frequency of orphan-creating timeouts (90 min vs 30 min for `processCustomer`), but doesn't fix the underlying mechanism. **The next session should triage the `forceKill: false` reconsideration with this evidence in hand.** See intake entry below.

---

## Operational caveats while next session is pending

**Production is stable.** No on-call urgency from today's work. The semaphore now correctly serializes neo4j-heavy work; the only operator-visible change is a new class of `CHILD_TASK_ERROR error_type=timeout elapsed_time=1800000` (or `5400000` post-Track-A) events for tasks that genuinely exceed their configured timeout. Those are honest signals, not noise.

**Watch for** these specific signals over the next 24-48 hours (a regular `events.jsonl` grep is the cleanest check):

```bash
# 1. Track A's 90-min override holding for processCustomer
docker exec tapestry grep '"phase":"resource_class_released"' /var/log/brainstorm/taskQueue/events.jsonl | grep processCustomer | tail -5
# Expect: held_seconds in [1800, 5400] range. If consistently 5400+ → bump the 90-min override.

# 2. forceKill orphan suppression rate
docker exec tapestry grep 'TASK_LAUNCH_PREVENTED' /var/log/brainstorm/taskQueue/events.jsonl | tail -20
# Expect: dramatically lower than pre-Track-A, but non-zero. Higher than expected → escalates the
# forceKill intake's priority.

# 3. Other tasks hitting the 30-min options_default ceiling
docker exec tapestry sh -c 'grep CHILD_TASK_ERROR /var/log/brainstorm/taskQueue/events.jsonl | grep "\"elapsed_time\":1800000" | tail -20'
# Each task that hits this ceiling is a candidate for adding to the Track A override list.
# Current overrides: processCustomer (90 min), updateAllScoresForOwner (4 hr),
# updateAllScoresForSingleCustomer (4 hr). Other 20 neo4j-heavy tasks still at 30-min default.
```

---

## What to do first in the next session

1. **Read this handoff.** Read the two new 2026-05-25 intakes in `engineering-team/stories/_intake.md`.
2. **Decide priority for next work** (operator's call). The natural order:
   - **Held branch `fix/launch-child-task-protection-audit`** — re-evaluate. Now that the semaphore actually works for the configured timeout duration (90 min for `processCustomer`, etc.), the held branch's parent-task tagging would correctly extend semaphore coverage across subshell chains. Original story #26 framing was wrong-shape (assumed the semaphore released at 6s); the new shape is correct. Probably `/discuss` → small decision → either revert the branch, carry-forward into a fresh small story, or ship with light updates to ADR 0023's amendments.
   - **`forceKill: false` orphan-suppression intake (2026-05-25)** — medium-high. `/discuss` first to triage the 5 remediation options outlined in the intake. Likely a small story to flip the default + per-task overrides for tasks that legitimately need long-running timeouts.
   - **JS-exec API endpoints intake (2026-05-24)** — medium-high. Separate from the timeout work but same architectural class (load-bearing protection silently absent on a different invocation path). 5 endpoints to triage; `/discuss` to settle the three remediation options (refactor handlers, deprecate, accept+document).
   - **Track B auto-tune feature (intake `eb2df679` 2026-05-25)** — low-medium. Larger feature with 6 design questions outlined. Multi-session work.
   - **Other older intakes** — operator priority.

---

## State of the world

| Item | Status |
|---|---|
| `main` (prod) | `9d9fb98a` — story #27 + Track A live; smoke-verified |
| `origin/staging` | `2764f79f` — main + 2 new intakes (forceKill orphan + stalled-tick) — awaiting next prod promotion |
| `fix/launch-child-task-protection-audit` (held branch) | Unchanged from prior handoff. 6 commits of story #26's tag-additions + ADR 0023 amendments + reviewer report. Architecturally enabled to ship now that the semaphore works. Decision pending. |
| `docs/POST_TIMEOUT_FIX_HANDOFF_2026-05-25.md` (this doc) | Pending direct push to staging alongside the prior handoff's status update. |
| `docs/SEMAPHORE_INVESTIGATION_HANDOFF_2026-05-24.md` (prior handoff) | Status updated to ✅ ADDRESSED by today's work. Body preserved. |
| Working tree | Clean. Local `staging` matches `origin/staging`. |
| Chrome MCP | Not used in this session. Should still work for the next session per prior-session notes. |

---

## Open intakes (priority-ordered)

All in [`engineering-team/stories/_intake.md`](../engineering-team/stories/_intake.md). Picked-up intakes from this session marked `PICKED UP 2026-05-25`.

### HIGH

_(none open — story #27 closed the prior HIGH)_

### MEDIUM-HIGH

- **[2026-05-25] `forceKill: false` orphans suppress subsequent scheduled fires** — NEW today. Strong empirical evidence; production-impacting (silent fire suppression). Strong argument for flipping `forceKill: true` as default.
- **[2026-05-24] Legacy API handlers `child_process.exec` tagged-task scripts directly, bypassing BullMQ + semaphore** — 5 endpoints listed; same architectural concern class as story #27.

### MEDIUM

- **Held branch fate**: `fix/launch-child-task-protection-audit` (story #26 paused work). Now architecturally enabled. NOT a formal intake but tracked here.
- **[2026-05-24] Unified all-tasks timeline UI** (cross-queue past + present + future) — operator-experience feature.

### MEDIUM-LOW

- **[2026-05-25] Track B: auto-tune timeouts from observed average runtimes** (intake `eb2df679`, Track B portion). 6 design questions; multi-session.
- **[2026-05-21] `/relay` public HTTP landing page is unhelpful plain-text (+ NIP-11 merge silently incomplete)** — UX + bug, public-facing.
- **[2026-05-21] `reconcileAuthor` trigger surfaces** (profile button + API + per-customer scheduling).
- **[2026-05-21] Deprecate legacy `reconciliation` task + `reconcile.timer`** — cleanup; superseded by story #21.

### LOW

- **[2026-05-25] BullMQ Job Scheduler stalled-recovered ticks use pre-deploy `job.data`** — NEW today. Cutover-only impact; clears within a few ticks. Worth fixing or documenting but not load-bearing.
- **[2026-05-24] Scheduled-fire job retention** (`upsertJobScheduler` opts) — Redis-memory hygiene.
- **[2026-05-21] Per-request `/etc/brainstorm.conf` re-read spam in `brainstorm.log`** — log-hygiene.
- **[2026-05-24] Origin-sync check at PO + Architect phases** — meta-tooling for the engineering-team harness.

---

## Where to start the next session

1. Read this handoff. Read the two 2026-05-25 intakes (newest entries in `_intake.md`).
2. `/discuss` whichever next-work the operator chooses.
3. Standard 5-phase flow from there (or fast-track Implementer + Reviewer for data-only changes per the strictness table).

The first prod-promotion of the next session should bundle the 2 follow-up intakes already on staging (`2764f79f`) with whatever code change ships. Pure docs; no functional impact; no smoke complexity.
