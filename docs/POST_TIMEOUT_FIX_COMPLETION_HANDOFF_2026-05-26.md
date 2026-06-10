# Post-Timeout-Fix Completion Session Handoff (2026-05-26)

**Status:** 🔴 **OPEN** — six PRs landed end-to-end today; the post-2026-05-20 task-queue timeout series is now complete; a 24–48h passive verification window is in progress; the next session inherits a fully-resolved task-queue subsystem and a fresh prioritized intake queue.
**Audience:** the operator / next-session reader picking up after today's six-deploy cascade.
**Source session:** the work on 2026-05-26 that completed the post-2026-05-20 task-queue timeout series — picked up every item the [prior handoff](./POST_TIMEOUT_FIX_HANDOFF_2026-05-25.md) queued, plus two additional items surfaced as natural follow-ons during the work.

---

## TL;DR for the new session

1. **The post-2026-05-20 task-queue timeout series is COMPLETE.** ADR 0013's `cap=1 neo4j-heavy` semaphore contract — functionally absent since 2026-05-20 — is now correctly enforced across every layer it touches (no-timeout case, timeout case, orchestrator-chain coverage, the 9 previously-opted-out tasks, and the bash-level defensive default).
2. **Six prod deploys today, all clean.** PRs #219, #221, #223, #225 shipped from this session; PRs #215, #217 had shipped in the prior session and were inherited as already-live state. Smoke clean at every step.
3. **The held branch `fix/launch-child-task-protection-audit` (story #26 / ADR 0023) is OBSOLETE.** Its value was carried forward via PR #221 (the fast-track Option C path from `/discuss`). The branch can be deleted locally.
4. **Two new intakes filed during the session** (both surfaced organically during the work + captured in the relevant ADRs):
   - **Part B of the forceKill cleanup** (`syncWoT` + `syncProfiles` 60s mis-sizing) — the 2 remaining `forceKill: false` overrides need their duration fixed before they can be removed (medium-high priority; clear scope).
   - **launchChildTask.sh:403 hygiene** — closed within the session (PR #225); no longer open.

---

## What shipped to production today (2026-05-26)

The first two rows are inherited from the prior session and were already live; included for the complete picture. Rows 3–6 are this session's work.

| # | PR | mergeCommit | Time (UTC) | Summary |
|---|---|---|---|---|
| 1 | [#215](https://github.com/nous-clawds4/tapestry/pull/215) | `8968b384` | 14:13Z | Story #27 / ADR 0024 → main — scheduled-task timeout propagation fix (three-layer defense-in-depth) |
| 2 | [#217](https://github.com/nous-clawds4/tapestry/pull/217) | `9d9fb98a` | 17:36Z | Track A → main — per-task timeout overrides (`processCustomer` 90 min, `updateAllScoresForOwner` + `updateAllScoresForSingleCustomer` 4 hr) |
| 3 | [#219](https://github.com/nous-clawds4/tapestry/pull/219) | `17f83be1` | 01:40Z | Story #28 / ADR 0025 → main — kill timeout-orphans by default (two-layer fix: registry `forceKill: true` + processor.js omits per-invocation override) |
| 4 | [#221](https://github.com/nous-clawds4/tapestry/pull/221) | `7d5e1046` | 02:53Z | Held-branch carry-forward → main — parent-tag coverage for `processAllTasks` + `processNpubsUpToMaxNumBlocks` + ADR 0013 audit-results amendment + BIBLE.md §24 + stub ADR 0023 |
| 5 | [#223](https://github.com/nous-clawds4/tapestry/pull/223) | `748ab30c` | 03:57Z | forceKill override cleanup Part A → main — 9 redundant `forceKill: false` overrides deleted so those tasks inherit story #28's global default |
| 6 | [#225](https://github.com/nous-clawds4/tapestry/pull/225) | `5bbc03a4` | 04:36Z | launchChildTask.sh jq fallback hygiene → main — `// false` → `// true` defensive-default alignment |

All five 5-phase engineering-team artifacts for story #28 live in the repo (story / ADR 0025 / test plan / 9 sentinel tests + empirical probe / review PASS). Stub ADR 0023 (from PR #221) cross-references held-branch git history as the audit trail for the 336-line full ADR + amendments. Held-branch story #26 / full ADR 0023 / review #26 (verdict withdrawn) deliberately NOT merged to main; stay in held-branch git history.

PRs #221, #223, #225 shipped fast-track (Implementer + Reviewer only, per Standard strictness — data/doc changes with already-shipped mechanism). PRs #219 shipped full 5-phase.

---

## Key architectural evolution — five layers of the fix

| Layer | What | When shipped |
|---|---|---|
| **1. No-timeout case** | Semaphore now actually holds for the configured task duration. The ~6s release bug from story #15 (2026-05-20) → 1800s default → per-task overrides (90 min / 4h) | PR #215 + #217 (prior session) |
| **2. Timeout case** | When timeout fires, bash subprocess is killed; semaphore release matches end-of-work; next scheduled fire isn't suppressed by orphan PID | PR #219 (this session) |
| **3. Orchestrator-chain coverage** | `processAllTasks` + `processNpubsUpToMaxNumBlocks` now tagged `neo4j-heavy` so their BullMQ Worker holds the semaphore across the full subshell chain | PR #221 (this session) |
| **4. Per-task override cleanup** | 9 tasks that were opted out of layer 2 (via copy-paste `forceKill: false` artifacts) now inherit the new default and benefit from kill-on-timeout too | PR #223 (this session) |
| **5. Defensive-default alignment** | Bash-level jq fallback `// false` → `// true` matches the rest of the system's default; closes the documentation lie | PR #225 (this session) |

Per ADR 0013's stated contract (cap=1 cross-task serialization of neo4j-heavy work to prevent Neo4j crashes), every invocation path through `launchChildTask.sh` now correctly engages the semaphore for the actual work duration. Two exceptions remain, both documented and tracked:

- `syncWoT` + `syncProfiles` retain explicit `forceKill: false` pending Part B's 60s-duration investigation. Their work continues past the wrapper-side timeout as it did before (no behavior change). When Part B fixes the duration, the override can be dropped.
- The JS-exec API handlers (separate 2026-05-24 intake) bypass `launchChildTask.sh` entirely. None of today's work reaches them.

---

## Empirical verification trail

- **Cycle-local empirical probe** (`test/probe-kill-timeout-orphans.js`, ADR 0025 §"Implementer self-check"): 4/4 ASSERT-PASS against the actually-installed wrapper script + jq + structured logging. Path 1 (kill verification, AC #1) + Path 2 (next-fire-runs, AC #2) both green. Verified the kill mechanism end-to-end at the bash level before any prod deploy.
- **Track A's prod evidence** (carried forward from prior session): `held_seconds=5400`-bounded on `processCustomer` runs confirmed the no-timeout case works.
- **Each prod deploy's smoke test:** Tier 1 stability ✓ + Tier 2 sanity ✓ + Tier 3 PR-specific ✓ + Tier 5 regression ✓ for all 4 deploys this session.
- **Host `npm test`** clean throughout: 246 tests across 24 suites PASS at session end. No regressions across the cascade.

---

## Operational caveats while next session is pending

**Production is stable.** No on-call urgency from today's work. The semaphore now correctly serializes neo4j-heavy work end-to-end; the only operator-visible change is that timed-out tasks die cleanly (no surviving orphan PID) and the next scheduled fire runs cleanly (no `TASK_LAUNCH_PREVENTED` event).

**24-48 hour passive verification window** is in progress. Watch for these specific signals (regular `events.jsonl` grep is the cleanest check):

```bash
# 1. TASK_LAUNCH_PREVENTED rate should drop to near-zero
docker exec tapestry grep 'TASK_LAUNCH_PREVENTED' /var/log/brainstorm/taskQueue/events.jsonl | tail -20
# Expect: dramatic drop from pre-2026-05-26 baseline. Any remaining occurrences would be
# from the 2 preserved overrides (syncWoT, syncProfiles) timing out — but those tasks
# run for 44.5s average against a 60s timeout, so the orphan window is short + the
# daily-frequency cadence rarely overlaps the orphan window.

# 2. CHILD_TASK_ERROR timeout events should correlate with PID-dead
docker exec tapestry grep 'CHILD_TASK_ERROR.*"error_type":"timeout"' /var/log/brainstorm/taskQueue/events.jsonl | tail -10
# For each event, extract child_pid from metadata, then `docker exec tapestry kill -0 <pid>`.
# Expect "No such process" for all events from tasks WITHOUT explicit forceKill override.
# Events from syncWoT/syncProfiles would still show PID-alive (orphan); that's expected
# pending Part B.

# 3. NEW from PR #221: orchestrator-chain protection observable
docker exec tapestry grep 'resource_class_' /var/log/brainstorm/taskQueue/events.jsonl | grep -E 'processAllTasks|processNpubsUpToMaxNumBlocks|updateNpubsInNeo4j' | tail -10
# Expect: resource_class_wait_* events now fire for processNpubsUpToMaxNumBlocks (~6h
# cadence) AND for its updateNpubsInNeo4j chain. processAllTasks fires per its systemd
# timer (3 timer files exist: .timer, _likeCron.timer, _q2Hours.timer).

# 4. Sanity: held_seconds continues to track actual task duration (Track A invariant)
docker exec tapestry grep '"phase":"resource_class_released"' /var/log/brainstorm/taskQueue/events.jsonl | grep processCustomer | tail -5
# Expect: held_seconds in [1800, 5400] range. Nothing from today's work changes this.
```

**Pre-existing prod orphans from past timeouts** (if any are still alive) are unaffected by any of today's deploys. They continue running until natural completion or operator action. If the operator wants to clean them up:

```bash
docker exec tapestry pgrep -f 'src/algos/customers/processCustomer.sh|src/algos/updateAllScoresForOwner.sh|src/algos/customers/updateAllScoresForSingleCustomer.sh'
# For each PID returned: docker exec tapestry kill -9 <pid>
```

Not required — the system stops the bleed on next-fire iteration; cleanup just accelerates the return to a clean baseline.

---

## What to do first in the next session

1. **Read this handoff.** Read the latest two intakes in `engineering-team/stories/_intake.md` (the 2026-05-25 forceKill cleanup intake — Part B is what's left — and the 2026-05-24 JS-exec API handlers intake).
2. **Confirm passive verification window is clean.** Run the four `events.jsonl` grep recipes above. If all four show the expected patterns, the cascade is operationally confirmed.
3. **Decide priority for next work** (operator's call). The natural order:
   - **Part B — syncWoT/syncProfiles 60s mis-sizing investigation** (medium-high). The 2 remaining `forceKill: false` overrides on staging + prod retain pre-fix behavior until their duration is fixed. Investigation: read syncWoT.sh / syncProfiles.sh, understand the actual workload size, settle on a correct timeout (probably 30-60 min matching `estimatedDuration` with headroom). Then a small Implementer + Reviewer change to fix the duration + drop the `forceKill: false` override. Could be one-session work end-to-end.
   - **JS-exec API handlers intake** (medium-high, 2026-05-24). 5 endpoints (`/api/process-all-active-customers`, `/api/generate-pagerank`, `/api/generate-reports`, `/api/generate-verified-followers`, `/api/calculate-hops`) that `child_process.exec` task scripts directly, bypassing BullMQ + the wrapper entirely. Same architectural class as today's work but on a different invocation path. Needs `/discuss` first to triage 3 remediation options (refactor handlers to enqueue via BullMQ, deprecate the legacy endpoints, or accept + document). Multi-session work likely.
   - **Unified all-tasks timeline UI** (2026-05-24 medium intake) — operator-experience feature. Cross-queue past + present + future view. Larger feature, lower urgency.
   - **Track B auto-tune** (medium-low) — larger multi-session feature with 6 design questions outlined in the intake. The Track A pattern Track A established (per-task explicit overrides) is the foundation; Track B automates it.
   - **Other older intakes** (medium-low + low priority) — operator priority.

---

## State of the world

| Item | Status |
|---|---|
| `main` (prod) | `5bbc03a4` — six PRs from today live; smoke-verified |
| `origin/staging` | `04686058` — matches main (last promotion synced everything; new direct-push of this handoff doc will land staging-ahead-by-1) |
| `docs/POST_TIMEOUT_FIX_HANDOFF_2026-05-25.md` | Status updated to ✅ ADDRESSED by today's work. Body preserved. |
| `docs/POST_TIMEOUT_FIX_COMPLETION_HANDOFF_2026-05-26.md` (this doc) | Direct push to staging. Will ride along on the next prod promotion. |
| `fix/launch-child-task-protection-audit` (held branch) | **OBSOLETE.** Value shipped via PR #221. Branch's 6 commits remain in git history as the audit trail for ADR 0023's full investigation (Status: Paused → effectively closed). Can be deleted locally. |
| Working tree | Clean. Local `staging` matches `origin/staging` at the time of this push. |
| Chrome MCP | Not used in this session. Should still work for the next session per prior-session notes. |

---

## Open intakes (priority-ordered)

All in [`engineering-team/stories/_intake.md`](../engineering-team/stories/_intake.md). Picked-up intakes from this session are noted in the relevant rows.

### HIGH

_(none open — the post-2026-05-20 timeout series is closed)_

### MEDIUM-HIGH

- **[2026-05-25] Part B of the forceKill cleanup** (`syncWoT` + `syncProfiles` 60s mis-sizing) — appended to the 2026-05-25 cleanup+bug intake. Part A shipped today (PR #223); Part B requires investigating correct timeout duration before the overrides can be dropped.
- **[2026-05-24] Legacy API handlers `child_process.exec` tagged-task scripts directly, bypassing BullMQ + semaphore** — 5 endpoints listed; same architectural concern class as today's work, different invocation path.

### MEDIUM

- **[2026-05-24] Unified all-tasks timeline UI** (cross-queue past + present + future) — operator-experience feature.

### MEDIUM-LOW

- **[2026-05-25] Track B: auto-tune timeouts from observed average runtimes** (intake `eb2df679`, Track B portion). 6 design questions; multi-session.
- **[2026-05-21] `/relay` public HTTP landing page is unhelpful plain-text (+ NIP-11 merge silently incomplete)** — UX + bug, public-facing.
- **[2026-05-21] `reconcileAuthor` trigger surfaces** (profile button + API + per-customer scheduling).
- **[2026-05-21] Deprecate legacy `reconciliation` task + `reconcile.timer`** — cleanup; superseded by story #21.

### LOW

- **[2026-05-25] BullMQ Job Scheduler stalled-recovered ticks use pre-deploy `job.data`** — cutover-only impact; clears within a few ticks.
- **[2026-05-24] Scheduled-fire job retention** (`upsertJobScheduler` opts) — Redis-memory hygiene.
- **[2026-05-21] Per-request `/etc/brainstorm.conf` re-read spam in `brainstorm.log`** — log-hygiene.
- **[2026-05-24] Origin-sync check at PO + Architect phases** — meta-tooling for the engineering-team harness.

### CLOSED THIS SESSION

- **[2026-05-25] `forceKill: false` orphan-suppression** → shipped via story #28 / ADR 0025 / PR #219.
- **[2026-05-25] Part A of the forceKill cleanup** (9 redundant overrides) → shipped via PR #223.
- **[2026-05-25] launchChildTask.sh:403 jq fallback hygiene** (flagged Non-blocking #1 in story #28 review) → shipped via PR #225.
- **Held branch fate** → resolved via PR #221 fast-track (Option C of /discuss).

---

## Where to start the next session

1. Read this handoff. Read the 2026-05-25 cleanup+bug intake (Part B is what's left to do).
2. Run the four passive-verification grep recipes (above) to confirm the cascade is operationally clean.
3. `/discuss` Part B if you want to settle the correct syncWoT/syncProfiles timeout value before opening a story. The investigation is small enough that you could also go straight to `/plan-feature` and let the Architect choose the duration during Phase 2.
4. Standard 5-phase flow from there.

The next prod-promotion of the next session should bundle this handoff doc (currently staging-ahead-by-1) with whatever code change ships. Pure docs; no functional impact; no smoke complexity.
