# PRD Seed: Deploy Safety (instance-operational awareness for promotions)

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/deploy-safety-gate/audit.md`
**Anchor:** acceptance frame in `book.md` (armed Direction-mode pre-registration; operator-ratified decisions at intake 2026-07-18)
**Confidence:** high
**Date:** 2026-07-19

> Reverse-engineered baseline in PRD shape, built from what shipped. A strawman for the product team, not a ratified spec. Confidence is high because the acceptance frame was operator-authored and every bullet shipped with evidence — but the *product framing* around it (vision, personas) is inferred and needs validation.

## 1. Product vision

`[FROM FRAME]` Deploys must never silently destroy in-progress computation. Every tapestry instance can now answer, machine-readably and unauthenticated, whether redeploying it right now would interrupt a scheduled task or collide with an imminent one — and the promotion procedures ask before every deploy-triggering merge, wait while unsafe, and stop loudly rather than guess.
`[INFERRED]` The deeper opportunity: instance-operational self-awareness as a product surface. This book shipped the first consumer-facing slice (the settings countdown); the same signal could ground richer operational UX (deploy dashboards, maintenance-window planning).
`[UNKNOWN — product input needed]` Whether deploy-safety should ever be visible to non-operator users (e.g., "maintenance imminent" notices).

## 2. Personas

`[INFERRED]` **The operator-promoter** (from story 2's "As an operator promoting a branch…"): technical, runs promotions via cycle skills or by hand, previously mitigated by manually disabling schedules before every promotion — the habit this book retires.
`[INFERRED]` **The instance owner/admin** (from story 3's panel placement behind the owner/admin gate): watches the Scheduled Tasks panel, wants to know what fires next without doing timestamp arithmetic.
`[INFERRED]` **The autonomous agent** (from Direction mode itself and the script's `jq`-free exit contract): a non-human promoter that needs the verdict as an exit code, not prose.

## 3. Scope (as-built)

`[FROM FRAME]` The status endpoint (running-now across BullMQ + legacy scheduler, next fire, verdict, 10-min buffer over all enabled entries, phantom-running excluded, queue-disabled distinguished); the bounded gated-merge check with one canonical recipe covering staging/prod/tags; the live-updating panel countdown consistent-by-construction with the endpoint.
`[FROM FRAME]` Explicitly out: drain-on-deploy, resumable checkpointing, stalled-recovery data staleness, write-endpoint auth, CI-side enforcement, blocking-task-class narrowing, sandbox-branch coverage, verdict/running surfaces on the panel.

## 4. Domain model

`[INFERRED]` No concept-graph handles — deploy safety is instance-operational, not perspectival (the POV reflex was answered explicitly in ADR 0001: this is one of the rare "true for the instance" facts). Entities: **scheduled entry** (config-owned, enabled/disabled, cron-or-interval), **task run** (queue-executed, deploy-killable), **fire** (the next scheduled instant), **verdict** (safe/unsafe + reasons), **safe window** (no run in flight, no fire within buffer). The verdict is derived state — computed live, never stored (view-time filtering honored).

## 5. Design rules (as-built)

`[INFERRED]` Fail closed: an unknowable queue state or unobtainable answer is never safe. The consumer never re-derives policy — the instance owns the verdict; consumers act on it as delivered. One canonical recipe, referenced everywhere, restated nowhere. Operator phrasing verbatim in UI copy ("Next Scheduled Task, X, starts in…"); hours-and-minutes granularity; empty states named plainly and distinguished. `[UNKNOWN]` No general design-language doc governs the settings panel; the line matched local convention by imitation.

## 6. Carry-forward & open questions

Promoted from audit §6: drain-on-deploy wiring; stalled-recovery `job.data` staleness; write-endpoint auth; the first prod/tags promotion's deliberate fail-closed stop (promote story #1 to main promptly to close the window); sandbox-branch rows; CI-side enforcement as the escalation path; the panel "why" notice for halted/legacy states; the shared `get-user-data` 504 (OPEN.md #61).

## 7. What product must validate

- [ ] Is the 10-minute buffer right as a *product* default, and should instances tune it (mechanism exists but is deliberately unpinned)?
- [ ] Should the panel eventually show the verdict / "running now" (explicitly out of scope this book), or does that surface belong elsewhere?
- [ ] Do sandbox-branch promotions warrant coverage, or is their unguarded state acceptable risk?
- [ ] Is procedural-only enforcement of "never merge on unsafe" sufficient, or should CI enforce (the recipe's named escalation)?
- [ ] The non-operator visibility question from §1.
