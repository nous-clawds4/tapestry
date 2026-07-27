# Story 3: Show the four on the goal screens that already exist

**Status:** Approved
**Created:** 2026-07-26
**Type:** Feature
**Epic:** `goal-intent-fields`
**Book:** `engineering-team/audits/store-and-show-the-prompt-and-the-estimate/book.md` — the
acceptance frame there is the constitution. The frame is satisfied by **the book**, not by this
story alone; this story carries one bounded part of it.
**Depends on:** `goal-intent-fields` #2 (a screen can only show what the read surface returns).

## Background

The book is called *store and show*. Stories #1 and #2 make the four storable and returnable; a
screen that never displays them still leaves the owner unable to see what was recorded. This story
is the **show** half, on the screens that already exist.

> **The boundary (verbatim, from the frame):** Storing and showing only. No rules about which
> prompts may run, nothing acts on the estimate or the flags, and **no new screen is built**.

"No new screen" is not a constraint this story works around — it is the reason this story is small.
The goal screens already exist; the four are added to what they already display.

## Extent of this story — bounded at the Planning gate

**In scope: the owner-facing screens that show a goal**, inventoried 2026-07-26 against the running
stack:

1. the Goals screen (the list)
2. the Goal detail screen
3. the Proposals screen (each proposal names the goal it nominates)

**Subsystem: the control-panel client only.** No server change belongs here; if a screen can't get a
value, that is #2's gap, not this story's.

**If Architecture finds a fourth screen that shows a goal, that is a kickback to Planning** to
re-bound the extent, not something to absorb quietly.

## User-facing description

As the owner of this tapestry, I want to see a goal's prompt, its estimate, and its two flags on the
goal screens I already use, so that what was recorded about a goal is visible to me without going
through an export.

## Acceptance criteria

- [ ] **All four visible.** Given a goal with all four stored, when the owner views each screen
      above that shows that goal, then all four are visible on that screen.
- [ ] **A goal with none of them stored still renders.** Given a goal that has never had any of the
      four set, when the owner views each screen above, then the screen renders without error, the
      goal is still listed or shown, and the four appear at their declared defaults — the estimate
      `0`, both flags `false`. **The screen is the interpretation point**: it applies the concept's
      own *"default is 0, if not otherwise estimated"* and *"absent means false"* to a property the
      read surface reported as not set. It is not handed fabricated values — `goal-intent-fields` #2
      forbids any surface from inventing one.
- [ ] **No new screen.** Given the change is complete, when the control panel is navigated, then no
      new screen and no new route exists — every change lands on one of the three screens above.
- [ ] **Nothing acts on them.** Given goals whose stored estimates and flags differ, when the owner
      views these screens, then which goals appear, and in what order, is identical to before this
      story. No sorting, filtering, grouping, or badge-driven prioritization by the four is added.

## Concepts touched

- `39998:<TA>:tapestry-owner-goal` — tapestry owner goal (the record behind what these screens show).
  `<TA>` is resolved at runtime per the house rule — never hardcoded.

## Out of scope

- **Accepting the four at write time** — `goal-intent-fields` #1.
- **Returning the four from read surfaces** — `goal-intent-fields` #2.
- **Any editing affordance.** These screens display the four; setting them is #1's write path. A
  prompt editor or estimate control on a screen would be new screen-level machinery the frame does
  not ask for.
- **New screens, routes, tabs, or views** of any kind.
- **New design tokens or components** invented for these four.

## Notes for later phases (not acceptance criteria)

Owner-facing copy on these screens follows the plain-language register those screens already use
(the second-brain style guide). This is a review consideration, not an externally testable
criterion — the testable core is "all four are visible" and "no new screen is built," above.

## Open questions

None. The three raised at Planning were answered at the gate and are recorded in the epic.

## Linked artifacts

- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
