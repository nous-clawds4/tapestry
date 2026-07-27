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

A screen that shows a goal either **projects** it — builds a display from the goal reads — or renders
the **stored record as stored**. Same asymmetry as stories 1 and 2, and it decides where the work is.

### Projecting screens — the work, exhaustively derived

Derived from a query a gate can re-run: every screen that consumes a goal read. Three, and no others.

1. the Goals screen (the list)
2. the Goal detail screen
3. the Proposals screen (each proposal names the goal it nominates)

### Record-rendering screens — no work, characterized rather than enumerated

Any screen that renders a goal's **stored record as stored**. These already display whatever the
record holds, the four included, so **none needs work** — they must simply not start filtering what
they render. Known member: the generic element screen's record view, which `goal-intent-fields` #2
already names as a verbatim surface. This list is **not** claimed exhaustive and does not need to be:
membership follows from the property. One missing from it is a record-keeping gap, not a scope gap.

**Subsystem: the control-panel client only.** No server change belongs here; if a screen can't get a
value, that is #2's gap, not this story's.

**The kickback clause applies to the projecting class.** A further screen that *projects* a goal is
work and returns to Planning. A further *record-rendering* screen is a record-keeping addition.

## User-facing description

As the owner of this tapestry, I want to see a goal's prompt, its estimate, and its two flags on the
goal screens I already use, so that what was recorded about a goal is visible to me without going
through an export.

## Acceptance criteria

- [ ] **All four visible, and the prompt shown as content.** Given a goal with all four stored, when
      the owner views each projecting screen above, then all four are visible there — the estimate
      and both flags as values, and the prompt **as its own text**: in full on the goal detail
      screen, and as an excerpt of the actual prompt on list-type screens. A bare presence indicator
      — a badge, an icon, a "has prompt" label with none of the text — does **not** satisfy this, on
      any screen. On a record-rendering screen, all four remain visible as stored, unchanged by this
      story. *The estimate on the Proposals screen rests on a ratified supersession — see below.*
- [ ] **A goal with none of them stored still renders — and the prompt says so.** Given a goal that
      has never had any of the four set, when the owner views each projecting screen above, then the
      screen renders without error and still shows the goal, and:
      **the three that declare a default** show it — the estimate `0`, both flags `false`;
      **the prompt, which declares none**, is shown explicitly as *not set*. Rendering a literal
      `null` or `undefined`, or an area indistinguishable from a prompt that was set to empty, does
      **not** satisfy this. **The screen is the interpretation point**: it applies the concept's own
      *"The default is 0, if not otherwise estimated"* and *"Absent means false"* to a property the
      read surface reported as not set, and where the concept declares nothing it says so rather
      than inventing. It is never handed fabricated values — `goal-intent-fields` #2 forbids any
      surface from inventing one.
- [ ] **No new screen.** Given the change is complete, when the control panel is navigated, then no
      new screen and no new route exists — every change lands on one of the three screens above.
- [ ] **Nothing acts on them, and the estimate is not a ranking.** Given goals whose stored
      estimates and flags differ, when the owner views these screens, then which goals appear, and
      in what order, is identical to before this story. No sorting, filtering, grouping, or
      badge-driven prioritization by the four is added. On the Proposals screen the estimate appears
      as **the owner's own recorded value** — not as a score, gauge, percentage bar, or ranking
      number, and not attached to any runner-up ordering. The prohibition on *system-generated*
      ranking survives this story intact.

## Concepts touched

- `39998:<TA>:tapestry-owner-goal` — tapestry owner goal (the record behind what these screens show).
  `<TA>` is resolved at runtime per the house rule — never hardcoded.

## Ratified authority — the estimate on the Proposals screen

AC1 puts the estimate on the Proposals screen. A live, **Accepted** ADR — `second-brain` ADR 0006
d13/AC6 — forbids "no numeric score, percentage, gauge, or ranking number" in any owner-facing
proposal string or rendered card. Without authority to resolve that, this story would mandate a
collision.

**The authority exists.** The owner has ratified a **narrow, explicit supersession** of `second-brain`
ADR 0006 d13/AC6, scoped to **owner-authored values only**. The prohibition targets *system-generated*
scores that would make proposals look ranked; `chanceOfSuccess` is the owner's own estimate, a
materially different thing. **The system-generated-ranking prohibition remains fully intact** — AC4
above is where that boundary is tested.

**Story 3's ADR is to carry the supersession explicitly.** This story records only that the authority
exists; writing the superseding decision into the ADR is Architecture's job, not Planning's.

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

None. The questions this story raised are settled and recorded in the epic's decision list — the
three answered at the Planning gate, plus the supersession above and the two prompt-visibility calls
(decisions 8 and 9). Two of those, the list-screen excerpt and the never-set prompt, are **Product
Owner calls rather than owner ratifications**, and are flagged as such in the epic so the operator can
overrule either without disturbing the rest.

## Linked artifacts

- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
