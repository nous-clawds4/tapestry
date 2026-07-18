# Story 3: Scheduled Tasks panel aggregate countdown

**Epic:** deploy-safety-gate
**Status:** Draft
**Created:** 2026-07-18
**Type:** Feature

## Background

Stories #1 and #2 built the machine side of the gate: any instance can be asked whether it is safe to redeploy right now (deploy-safety-gate #1, Done, live on staging), and every cycle promotion asks before merging (deploy-safety-gate #2, Done). What's missing is the human side — the operator glancing at the settings page still has to read the per-entry rows one by one and do the arithmetic to answer the simple question the whole epic revolves around: *what fires next, and how soon?*

This story is the third and final slice of the book's acceptance frame (bullet 5): "The settings Scheduled Tasks panel shows an aggregate line — the next scheduled task's name and time-to-fire in hours and minutes, live-updating — alongside the existing per-entry rows." It is the operator's original request item 4, in their own words at intake: *"We can also update the UX on the settings page, Scheduled Tasks panel, to say 'Next Scheduled Task, \<name of task\>, starts in __ hours and __ minutes.'"*

Technical context (for orientation, not a requirement): per the intake's verified architectural background, the per-entry next-run data already flows to the panel — the panel renders a per-entry "next run" today. This is an **aggregation + presentation** story; no new backend is expected. Note also the book's staging-evidence constraint (frame bullet 6b): the deployed settings page sits behind NIP-07 owner sign-in, which cannot be scripted, so the panel's rendered evidence is gathered on the local stack while staging supplies the underlying data.

**Who is affected:** the operator (the signed-in instance owner) — judging at a glance when the next task fires, whether a manual promotion or maintenance window is imminent-risky, and whether the schedule is doing what they think it is.

## User-facing description

As **an operator looking at the settings page's Scheduled Tasks panel**, I want one line that tells me which scheduled task fires next and counts down the hours and minutes until it starts, so that I can see the instance's next scheduled activity at a glance — without scanning every row or doing time arithmetic — and so what I see matches what the deploy-safety gate would tell a promotion.

## Acceptance criteria

- [ ] **AC-1 (the aggregate line, in the operator's phrasing):** Given the settings page's Scheduled Tasks panel is open and at least one enabled scheduled entry has an upcoming fire, when the panel renders, then exactly one aggregate line appears alongside the existing per-entry rows — which remain present and unchanged — communicating, in the operator's requested form "Next Scheduled Task, \<name of task\>, starts in __ hours and __ minutes": the name of a scheduled task and the time remaining until it fires, at hours-and-minutes granularity.

- [ ] **AC-2 (soonest fire among all enabled entries — and only enabled entries):** Given several scheduled entries with differing next-fire times, some enabled and some disabled, when the aggregate line is shown, then the task it names is the one with the soonest upcoming fire among the **enabled** entries, and the time shown is the time remaining until that fire. A disabled entry never appears as the next scheduled task, however soon its nominal time; and when the enabled set or its ordering changes (an entry is toggled, or the current soonest fire passes), the line comes to reflect the new soonest rather than continuing to show the old one.

- [ ] **AC-3 (it visibly counts down):** Given the panel stays open with no operator interaction, when time passes, then the displayed time remaining decreases observably — the operator can watch the countdown tick down without reloading the page — and the display is never frozen at a stale value and never counts into negative time; once the displayed fire time is reached, the line moves on to the then-current state (the next soonest upcoming fire, or the nothing-upcoming state of AC-4).

- [ ] **AC-4 (sensible empty states — nothing-scheduled and queue-disabled, not conflated):** Given the task-queue layer is enabled but no scheduled entry is enabled (or none has an upcoming fire), when the panel renders, then in place of the countdown the aggregate line states plainly that no scheduled task is upcoming — never a blank, a stale task name, or a nonsense countdown. Given instead the instance's task-queue layer is disabled, then the panel states that in plain language, distinguishably from "nothing scheduled" — the same distinction the deploy-safety answer already makes — so the operator is never told nothing is scheduled when scheduling is simply switched off.

- [ ] **AC-5 (never contradicts the deploy-safety answer):** Given the instance's deploy-safety status answer (deploy-safety-gate #1) reports a next scheduled fire, when the panel is viewed at effectively the same moment, then the aggregate line names the same task and shows a time remaining consistent with the same fire time — any difference explained by hours-and-minutes rounding and the moments elapsed between the two observations. The panel and the merge gate speak from the same schedule: the line never names as "next" a task the status answer would not, nor the reverse, and the empty states of AC-4 mirror the answer's own queue-disabled / nothing-scheduled distinction.

## Product decisions (operator-ratified at intake, 2026-07-18 — requirements, not open for relitigation)

1. **The line's content and phrasing are the operator's own** (intake, request item 4): "update the UX on the settings page, Scheduled Tasks panel, to say 'Next Scheduled Task, \<name of task\>, starts in __ hours and __ minutes.'" Frame bullet 5 fixes the rest: aggregate line, next task's name, time-to-fire in hours and minutes, live-updating, alongside the existing per-entry rows.
2. **All enabled entries count toward "next"** (agreed decision 1): the next fire is taken "among **all enabled** scheduled entries," regardless of what the task does — narrowing to blocking-task classes is a future reconsideration, not v1. The panel's aggregate line applies the same selection the verdict does.
3. **Queue-disabled is not nothing-scheduled** (agreed decision / frame bullet 3): the deploy-safety response "distinguishes 'queue disabled' from 'nothing scheduled' rather than conflating them." This story applies the same ratified distinction to the panel's states.

Verbatim sources: intake entry "2026-07-18 — Feature: scheduled-task deploy-safety gate" in `engineering-team/stories/_intake.md`; acceptance-frame bullets 3 and 5 in `engineering-team/audits/deploy-safety-gate/book.md`.

## Concepts touched

None. Verified live against the local Concept Graph 2026-07-18 (46 concepts): no handle covers scheduled tasks, task queues, settings surfaces, or instance operations. Nothing in this story redefines an existing concept.

## Scope notes

- **One subsystem:** the settings Scheduled Tasks panel. Aggregation + presentation over data the panel already receives; no new backend is expected (intake architectural background). If Architecture finds the existing data genuinely insufficient, that is a kick-back conversation, not silent scope growth.
- **Refresh and tick mechanics are the Architect's call** — how the countdown updates, on what cadence, and how the panel learns of schedule changes. The story requires only the observable behaviors of AC-2/AC-3: the line follows the schedule, ticks down without a reload, and is never frozen or negative.
- **Exact copy at the edges is the Architect's/Implementer's call**, bounded by the operator's reference phrasing and hours-and-minutes granularity: renderings for under an hour, many days out, or singular/plural units may adapt the wording naturally. Seconds precision is not required — the operator asked for hours and minutes.
- **Placement and styling within the panel are presentation calls**, bounded by AC-1: one aggregate line, visibly alongside (not replacing) the per-entry rows.
- **How consistency with the deploy-safety answer is achieved is the Architect's call** — AC-5 constrains the observable outcome (no contradiction), not the data path.

## Out of scope

- Any change to the deploy-safety status endpoint, its verdict policy, or the 10-minute buffer — deploy-safety-gate #1, Done.
- Any change to the cycle-skill check or the shared recipe — deploy-safety-gate #2, Done.
- Showing the safe/unsafe verdict, a buffer warning, or a "running now" indicator on the panel — frame bullet 5 asks for the next task's name and time-to-fire only; a verdict surface would be new scope for a future request.
- The legacy per-customer scheduler's timers in the aggregate line — the ratified "next fire" selection covers the enabled scheduled entries (the rows this panel lists); legacy runs count toward "running," which this line does not display.
- Changes to the existing per-entry rows themselves.
- Drain-on-deploy, resumable checkpointing, stale job data on stalled recovery, auth-gating the scheduled-tasks write endpoints — epic guardrails, tracked elsewhere.

## Open questions

None. The operator's verbatim phrasing, frame bullet 5, and the ratified decisions (all-enabled-entries selection; queue-disabled vs nothing-scheduled) answer the product questions this story raises; refresh mechanics, edge-case copy, and placement are explicitly delegated to Architecture.

## Linked artifacts

- Book: `engineering-team/audits/deploy-safety-gate/book.md`
- ADR: `engineering-team/decisions/deploy-safety-gate/0003-panel-countdown-from-deploy-safety-status.md`
- Test plan: `engineering-team/stories/deploy-safety-gate/3-scheduled-tasks-panel-countdown.test-plan.md`
- Review: (filled in after Review phase)
