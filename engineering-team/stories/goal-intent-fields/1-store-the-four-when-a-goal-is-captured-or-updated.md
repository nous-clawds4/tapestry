# Story 1: Store the four when a goal is captured or updated

**Status:** Approved
**Created:** 2026-07-26
**Type:** Feature
**Epic:** `goal-intent-fields`
**Book:** `engineering-team/audits/store-and-show-the-prompt-and-the-estimate/book.md` — the
acceptance frame there is the constitution. The frame is satisfied by **the book**, not by this
story alone; this story carries one bounded part of it.
**Supersedes:** the Gate-1 draft that also carried the number 1
(`set-and-see-the-four-goal-properties`, KICK_BACK — unbounded extent, spanned three subsystems).
That draft was never committed; the number returns to the pool and this story takes it.

## Background

Four properties are declared on the goal concept — the prompt, the estimate, and two flags — and
nothing accepts them when a goal is written. This is the **write half** of the gap: values the owner
supplies have nowhere to land.

> **The ask (verbatim, from the frame):** All four properties we added to goals — the prompt, the
> estimate, and the two flags — are declared on the goal concept, but no producer accepts them and
> no read surface returns them, so anything set today is invisible.

Three sibling properties — `deliverable`, `boundary`, `parent` — already travel these same write
paths. These four were declared and left behind.

**The four, in the owner's words and as declared on the concept:**

| Owner's words | Declared as | What the concept says it means |
|---|---|---|
| the prompt | `prompt` | the markdown given to an agent at the start of a session aimed at this goal |
| the estimate | `chanceOfSuccess` | 0–100: chance an agent completes this goal with no human input; **default 0 if not otherwise estimated** |
| flag: needs the owner | `needsHumanInput` | the goal can't be carried forward without the owner answering something; **absent means false** |
| flag: too big as it stands | `needsBreakdown` | the goal is too large to work on as it stands and should be broken up; **absent means false** |

## Extent of this story — bounded at the Planning gate

**In scope: the three ways a goal gets written**, inventoried 2026-07-26 against the running stack:

1. capturing a goal from scratch
2. capturing a goal while breaking a bigger one down (a child goal)
3. updating an existing goal's intent

**Subsystem: the server-side goal write path only.** No read surface and no screen changes here —
those are `goal-intent-fields` #2 and #3.

**Verification without new read work:** the export already returns each goal's stored record
verbatim, so what this story stores is externally observable the moment it is stored.

**If the inventory is wrong, that is a kickback, not a silent widening.** If Architecture finds a
fourth way a goal gets written, it returns to Planning to have the extent re-bounded rather than
absorbing it.

## User-facing description

As the owner of this tapestry, I want the prompt, the estimate, and the two flags to be accepted
when I capture or update a goal, so that what I know about a goal is actually recorded instead of
being dropped on the way in.

## Acceptance criteria

- [ ] **Accepted at capture.** Given a goal is captured — from scratch or while breaking a bigger
      one down — with any subset of the four supplied, when the capture completes, then the stored
      record carries exactly the supplied values, and each one not supplied is **absent** from the
      record. Capturing a goal with none of the four supplied still succeeds.
- [ ] **Accepted at update.** Given an existing goal, when any subset of the four is updated, then
      those values are stored, and the other three are unchanged — as is everything else already on
      the goal (name, statement, origin, capture date, deliverable, boundary, parent).
- [ ] **Stored in the shape the concept declares.** Given a prompt of several lines of markdown, an
      estimate within 0–100, and either flag set true or false, when the record is read back, then
      the prompt is byte-identical to what was supplied, the estimate is stored as a number, and
      each flag is stored as a boolean.
- [ ] **Nothing acts on them at write time.** Given goals written with differing prompts, estimates,
      and flags, when each is captured or updated, then no write is rejected, gated, reordered, or
      transformed because of what those four contain. No rule decides which prompts may run.

## Concepts touched

- `39998:<TA>:tapestry-owner-goal` — tapestry owner goal (the record that carries all four declared
  properties). `<TA>` is resolved at runtime per the house rule — never hardcoded.

No concept is added and none is redefined; all four are already declared.

## Out of scope

- **Returning the four on read surfaces** — `goal-intent-fields` #2.
- **Showing the four on the owner's screens** — `goal-intent-fields` #3.
- **Values outside the concept's declared shape** (an estimate above 100 or below 0, a non-boolean
  flag). The frame is storing and showing; it makes no rules, so this story neither invents a
  rejection rule nor a clamping rule. What happens to a malformed value stays undefined here.
- **Clearing a value back to unset.** The frame's verb is *set*; a clear-to-unset capability it does
  not name would widen it. (Ratified at the Planning gate — see the epic.)
- **Backfilling values** onto goals that already exist.
- **The schema-`required` defect (OPEN.md row 102).** Out of scope for this story — handled
  separately as live-data cleanup. This story neither fixes nor closes it, and nothing here is
  evidence about its state.
- **`dependsOn` / prerequisites** — not one of the four; stays unavailable.

## Open questions

None. The three raised at Planning were answered at the gate and are recorded in the epic.

## Linked artifacts

- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
