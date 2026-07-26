# Story 2: Return the four on every read surface that shows a goal

**Status:** Approved
**Created:** 2026-07-26
**Type:** Feature
**Epic:** `goal-intent-fields`
**Book:** `engineering-team/audits/store-and-show-the-prompt-and-the-estimate/book.md` — the
acceptance frame there is the constitution. The frame is satisfied by **the book**, not by this
story alone; this story carries one bounded part of it.
**Depends on:** `goal-intent-fields` #1 (nothing can be returned before it can be stored).

## Background

Four properties are declared on the goal concept and the read surfaces drop them. This is the
**read half** of the gap: even a goal that carries all four looks empty to anything that reads it.

> **The success criterion (verbatim, from the frame):** I can set any of the four properties we
> added to goals — the prompt, the estimate, and the two flags — when capturing or updating a goal,
> and all four come back on every surface that shows a goal.

One consequence is already on the record in the book's own *Unavailable* block: the Direction
eligibility endpoint reports the estimate as underivable through the goals read API and works around
it by reading the raw goal record instead. That workaround exists because of this gap.

**The four and their declared defaults** — these are the concept's own words, not this story's
invention: the estimate is *"a number between 0 and 100 … The default is 0, if not otherwise
estimated"*; each flag is a boolean where *"absent means false."*

## Extent of this story — bounded at the Planning gate

**In scope: the surfaces that show a goal**, inventoried 2026-07-26 against the running stack:

| Surface | State today |
|---|---|
| the goals list | drops all four |
| a single goal's detail | drops all four |
| the session orientation read | drops all four |
| the proposal queue (a proposal names the goal it nominates) | drops all four |
| the Direction transcription for a goal | reads the estimate off the raw record as a workaround; drops the other three |
| the export | **already returns all four** — it returns each goal's stored record verbatim. No work; must not regress. |

**Subsystem: the server-side goal read surfaces only.** The owner's screens are
`goal-intent-fields` #3.

**"Every surface that shows a goal" stays universal at the book level.** This table is not a
narrowing of the frame — it is this story's bounded extent, so the gate can confirm one subsystem.
**If Architecture finds a surface that shows a goal and is not in this table, that is a kickback to
Planning** to have the extent re-bounded, not something to absorb quietly.

## User-facing description

As the owner of this tapestry — and as any session reading my brain — I want every surface that
shows me a goal to include its prompt, its estimate, and its two flags, so that what was recorded
about a goal is actually there when I or a session goes looking.

## Acceptance criteria

- [ ] **All four, on each surface.** Given a goal with all four stored, when it is read on each
      surface in the table above, then that surface returns all four, with the stored values.
- [ ] **The prompt comes back whole.** Given a prompt of several lines of markdown, when the goal is
      read on each surface — **including the list-type surfaces** — then the prompt is byte-identical
      to what was stored: not truncated, not reflowed, not re-escaped, and not replaced by a
      presence indicator.
- [ ] **A goal with none of them stored reads as the declared defaults.** Given a goal that has
      never had any of the four set (most goals today), when it is read on each surface, then the
      surface returns the goal without error and returns the estimate as `0` and both flags as
      `false`. No surface omits the goal or fails because the values are absent.
- [ ] **Nothing acts on them.** Given goals whose stored estimates and flags differ, when these
      surfaces are read, then which goals they return, and in what order, is identical to before
      this story. No ranking, filtering, gating, or selection keys off the four, and no rule decides
      which prompts may run.

## Concepts touched

- `39998:<TA>:tapestry-owner-goal` — tapestry owner goal (the record these surfaces read).
  `<TA>` is resolved at runtime per the house rule — never hardcoded.

## Out of scope

- **Accepting the four at write time** — `goal-intent-fields` #1.
- **Showing the four on the owner's screens** — `goal-intent-fields` #3.
- **Shrinking any payload for size.** The full prompt travels on list-type surfaces. If that later
  proves a real problem, it is a separate, measured decision this story does not pre-empt.
  (Ratified at the Planning gate — see the epic.)
- **Retiring the Direction endpoint's raw-record workaround.** This story makes the workaround
  unnecessary; removing it is not required here.
- **`dependsOn` / prerequisites** — not one of the four. It stays underivable, and the book says the
  close should report it still unavailable rather than treat it as missed.
- **The schema-`required` defect (OPEN.md row 102).** Out of scope — handled separately as live-data
  cleanup; this story neither fixes nor closes it.

## Open questions

None. The three raised at Planning were answered at the gate and are recorded in the epic.

## Linked artifacts

- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
