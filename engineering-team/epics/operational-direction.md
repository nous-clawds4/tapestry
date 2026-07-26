# Epic: Operational Direction

**Status:** Open
**Book:** `engineering-team/audits/operational-direction/book.md` (acceptance-frame) *(to be opened)*
**Parent lineage:** `harness-self-improvement` (Done) → `harness-gate-integrity` (Done). Neither is reopened; this epic adds a second on-ramp to a harness those epics built and repaired.

## What this is

Direction mode has exactly one way in: a hand-written, **armed** pre-registration. It works — it has carried books end to end with no human at the gates — and it goes almost unused, because arming is a long document (a hypothesis with a probability, a deadline, a baseline commit, three pinned governing hashes, an exhaustive delegation list, an outcome table).

Most of that is **experiment apparatus**, not work order. The armed section says "Hypothesis being tested," estimates a success probability, and scores operator takeover as *experiment failure*. Those are the rules of a scientific pre-registration; they exist so the harness cannot grade its own homework. They are right when the question is *"does autonomous direction work?"* and pure overhead when the question is *"please do this work."* Direction mode conflates the two, and the cost of the first suppresses all use of the second.

This epic adds **operational direction**: a second mode whose terms are *derived from the goal being pursued* rather than authored per run — deliverable → success criteria, boundary → ceiling, statement → the ask, chanceOfSuccess → the estimate. The owner still sets every goalpost; they set them once, at goal-writing time, instead of again per run. Arming stops being authorship and becomes transcription, and the act of arming becomes the owner approving the proposal that nominated the goal.

**The existing armed mode is untouched** — it remains the mode for when the harness itself is the thing under test.

**The safety edge.** Deriving goalposts from a goal record is only safe if the record is the owner's. Sessions can author goals today (`createChildGoal`, second-brain #3), so the mode carries an **owner-ratified anchor** requirement — the nearest goal in the ancestry chain named by an approved proposal fact — paired inseparably with a **boundary-narrowing invariant** (a sub-goal narrows its parent's boundary, never widens it). The anchor's permitted distance is a **policy parameter**, v1-set to zero (the goal itself), so that loosening it later is an owner policy act under PRD §7.6, not a redesign. A distant anchor without boundary inheritance is a laundering path; shipping either without the other is worse than shipping neither.

**Knowingly surrendered:** the baseline commit and the pinned governing versions. They buy reproducibility — knowing which Director ran under which rubric — which is acceptable for operational runs and *not* acceptable for experimental ones. That asymmetry is exactly why this is a second mode and not a replacement, and it is stated in the artifacts rather than quietly dropped.

## Stories

`stories/operational-direction/`:

1. **operational-direction-mode** — the whole mode as one story: the second named on-ramp, goal-derived terms, the honest statement of what is surrendered and what is unavailable, the owner-ratified anchor with its policy parameter, the boundary-narrowing invariant, and the non-negotiables carried over verbatim. Also disposes of OPEN.md row 41.

## Out of scope (whole epic)

- **Making `chanceOfSuccess` and the goal `prompt` readable through the goals API** — `parseGoalRow` drops both. That is the goal `store-and-show-the-prompt-and-the-estimate`; named as a dependency here, not built here.
- **Who may author a prompt** — the goal `make-sure-only-prompts-i-wrote-can-run` ("that loop has to be closed before anything runs unattended"). A named dependency, explicitly not this epic's work.
- **`dependsOn` / prerequisites** — the field exists on no goal and nowhere in the codebase. Out until it exists.
- **The `task-timeline` pre-arming refresh** — that book is pre-registered but `Armed: No`; if this epic lands first its Direction-mode section needs a refresh before arming (precedent: relationship-primitives' "Pre-arming refresh, operator-ratified"). Flagged as a downstream dependency; performed elsewhere.
- **The pending goalpost-class amendments against the same two files** — OPEN.md rows 57, 63, 64, 74, 76, 92 all propose edits to `roles/director.md` or `.claude/skills/direct-feature/SKILL.md` awaiting owner ratification. They are not folded in here; each needs its own ratification.
- **Any change to armed Direction mode's rules**, to the five engineering phases, to the gate rubrics, or to `.claude/agents/gate-judge.md` beyond what the new mode requires.
- **Loosening the anchor distance past the goal itself** — a future owner policy act (PRD §7.6), not a code or doc change made here.

## Related

- Owner goal `hand-work-to-the-engineering-team-without-arming-a-book` (parent: `hand-a-goal-to-a-session`) — the brief this epic executes, held in the local graph.
- `engineering-team/audits/relationship-primitives/book.md` § "Direction mode — pre-registered" — the worked armed example whose overhead motivates this epic.
- OPEN.md row 41 — "Session-mode standing gate authorization — formalize or forbid." This epic is its named-mode answer.
- `product-team/prd/second-brain.md` §7.5 (autonomy earned by category, granted by the owner, explicit and revocable) and §7.6 (policy changes are the owner's alone) — the constitution the anchor-distance parameter obeys.
