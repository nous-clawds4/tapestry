# Epic: deploy-safety-gate

**Created:** 2026-07-18
**Status:** Active

## Goal

**Make branch-promotion deploys provably safe with respect to scheduled tasks.** Every tapestry instance runs scheduled tasks; every merge to a deploy-triggering branch recreates the container and kills whatever is in flight, with no drain. Today the only protection is a manual habit — disable every scheduled entry before promoting — in effect since June 2026 and easy to forget. This epic replaces that habit with a checkable gate: an instance can be *asked* whether it is safe to redeploy right now, the answer is checked before every merge, and the operator can see the next-task countdown at a glance.

The epic realizes the acceptance frame of book `engineering-team/audits/deploy-safety-gate/book.md` (Direction mode), in three slices:

1. a read-only, unauthenticated **status endpoint** reporting running-now, next scheduled fire, and a safe/unsafe verdict;
2. the **safe-to-merge check** wired into the cycle skills via one canonical shared recipe (covering `feat/tags` promotions too);
3. the settings Scheduled Tasks panel's aggregate **countdown line**.

## Why it matters

A deploy-killed scoring batch leaves owner trust scores partially written and silently unreliable — hours-long to repair at production scale (intake entry 2026-06-08, "Owner scoring batch is not deploy-safe"). This epic is the operator-ratified **guard** branch of that entry; the **resumable-checkpointing** and **drain-on-deploy** branches remain open there and are out of scope for every story here. The gate is also the precondition for arming the parked task-timeline Direction-mode book.

## Stories

1. `stories/deploy-safety-gate/1-deploy-safety-status-endpoint.md` — the deploy-safety status endpoint: one read-only unauthenticated GET reporting running-now (both task sources, phantom-running excluded), the next scheduled fire, and the safe/unsafe verdict, with the queue-disabled/nothing-scheduled distinction. **Done** (review PASS 2026-07-18; live on staging).
2. `stories/deploy-safety-gate/2-cycle-safe-to-merge-check.md` — cycle-skill safe-to-merge check + canonical shared recipe: the pre-merge check of the story-1 answer against the instance the merge will redeploy, bounded journaled wait-and-recheck while unsafe (never merge on unsafe, never wait silently), cycle-full inheriting by delegation, canonical in one shared recipe that also covers `feat/tags` → tags.brainstorm.world promotions. **Done** (review PASS 2026-07-18).
3. `stories/deploy-safety-gate/3-scheduled-tasks-panel-countdown.md` — Scheduled Tasks panel aggregate countdown: one line, in the operator's phrasing ("Next Scheduled Task, \<name\>, starts in __ hours and __ minutes"), naming the soonest upcoming fire among all enabled entries and counting down live alongside the existing per-entry rows, with distinct nothing-scheduled and queue-disabled states, never contradicting the deploy-safety answer. **Draft**.

## Key facts / guardrails

- **The operator's ratified decisions (intake entry 2026-07-18) are requirements, not preferences.** Verdict policy: unsafe if any covered task is running OR the next fire among **all enabled** scheduled entries is within a buffer defaulting to **10 minutes**; safe otherwise. "Running" covers the task queue's active jobs — scheduled fires and manual run-task triggers alike — **plus** the legacy per-customer scheduler's in-flight runs. Narrowing to blocking-task classes is a future reconsideration, not v1. No story relitigates these.
- **The phantom-running trap is the epic's central correctness hazard.** A deploy-killed task leaves a start-without-end signature in the task-event history and can read as "running" for hours. A gate that trusts that signal deadlocks after the very event it guards against. The exclusion is a ratified requirement with an explicit automated test (story 1).
- **Guard only.** Drain/graceful shutdown on deploy, resumable checkpointing, stale job-data on stalled recovery, and auth-gating the scheduled-tasks write endpoints are tracked elsewhere and out of scope for every story in this epic.
- **The book runs in Direction mode** — every story runs all five phases under judged gates regardless of classification; see the book's pre-registration before touching any story.
