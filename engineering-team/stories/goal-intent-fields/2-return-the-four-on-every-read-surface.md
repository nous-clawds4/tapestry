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

A surface that shows a goal either **projects** it — builds a response shape from a parsed record —
or returns the **stored record as stored**. The two classes carry different work and different
claims, the same asymmetry story 1 established for write paths.

### Projecting reads — the work, exhaustively derived

Derived from a query a gate can re-run: every place that builds a goal response from a parsed goal
record. Five, and no others.

| Projecting surface | State today |
|---|---|
| the goals list | drops all four |
| a single goal's detail | drops all four |
| the session orientation read | drops all four |
| the proposal queue (a proposal names the goal it nominates) | drops all four |
| the Direction transcription for a goal | reads the estimate off the raw record as a workaround; drops the other three |

**Four parser call-sites are deliberately *not* on this list**, named so a gate re-running the query
can account for every hit it will find: the decomposition validator and the restore planner are
write-side internals, not surfaces anyone reads a goal from (and both belong to story 1's territory);
**the export calls the parser only as a validity filter** — it returns the raw stored section, so it
belongs to the verbatim class below; and **the hygiene check** emits check results rather than goal
fields, so it shows no goal to anyone. None of the four is a scope gap.

### Verbatim surfaces — no work, characterized rather than enumerated

Any surface that returns a goal's **stored record as stored**. These carry whatever the record holds,
so **none of them can drop the four and none needs work** — they must simply not start projecting.
Known members: the export; the concept-graph node read (full node content, including the stored
record); the generic element screen's record view. This list is **not** claimed exhaustive, and does
not need to be: membership follows from the property, not from appearing here. A verbatim surface
missing from it is a record-keeping gap, not a scope gap — and unlike the projecting class, finding
one does not return this story.

**Subsystem: the server-side goal read surfaces only.** The owner's screens are
`goal-intent-fields` #3.

**"Every surface that shows a goal" stays universal at the book level.** Splitting the surfaces into
two classes is not a narrowing of the frame: both classes return all four when a goal has them. The
split says where the *work* is, so the gate can confirm one subsystem.

**The kickback clause applies to the projecting class.** If a later phase finds a further surface
that *projects* a goal, that is work, and it returns to Planning rather than being absorbed. A
further *verbatim* surface is a record-keeping addition to the list above.

## User-facing description

As the owner of this tapestry — and as any session reading my brain — I want every surface that
shows me a goal to include its prompt, its estimate, and its two flags, so that what was recorded
about a goal is actually there when I or a session goes looking.

## Acceptance criteria

- [ ] **All four, on each surface.** Given a goal with all four stored, when it is read on each
      projecting surface above, then that surface returns all four with the stored values; and when
      it is read on a verbatim surface, all four still come back as stored, unchanged by this story.
- [ ] **The prompt comes back whole.** Given a prompt of several lines of markdown, when the goal is
      read on each surface — **including the list-type surfaces** — then the prompt is byte-identical
      to what was stored: not truncated, not reflowed, not re-escaped, and not replaced by a
      presence indicator.
- [ ] **Nothing is invented for a property that was never set.** Given a goal that has never had any
      of the four set (most goals today), when it is read on **any** surface, then the surface
      returns the goal without error and without omitting it, and reports each of the four as *not
      set* rather than substituting a value — no surface returns `0` for an estimate, `false` for a
      flag, or an empty prompt that the owner never supplied. Where a surface already has a shipped
      way of reporting "not set", that behavior is preserved exactly: the Direction transcription
      still records an absent estimate as absent, and the export still omits the key entirely.
- [ ] **Nothing acts on them.** Given goals whose stored estimates and flags differ, when these
      surfaces are read, then which goals they return, and in what order, is identical to before
      this story. No ranking, filtering, gating, or selection keys off the four, and no rule decides
      which prompts may run.

## Concepts touched

- `39998:<TA>:tapestry-owner-goal` — tapestry owner goal (the record these surfaces read).
  `<TA>` is resolved at runtime per the house rule — never hardcoded.

## Out of scope

- **Materializing the concept's declared defaults.** *"The default is 0, if not otherwise estimated"*
  and *"absent means false"* tell a **consumer how to interpret absence**; they do not oblige a read
  surface to fabricate a value. Inventing one would also be *acting on* the estimate, which the
  ceiling forbids. The interpretation point is where a goal is displayed — `goal-intent-fields` #3.
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

## Deviations

- **The proposal card's name lookup went through a two-line local helper, not an inlined expression.**
  ADR d9 turns `nameBySlug` into `recordBySlug` and says `goalName` reads `rec && rec.name` with the
  identical `|| p.goal` fallback. The old map served *two* call sites — the card and each
  `passedOver` runner-up — so inlining the record lookup would have restated it twice. A local
  `nameOf(slug)` states it once and is behavior-identical at both sites for every input (a record
  with a null or empty name, and a slug with no record, all still fall through to the slug). The
  runners-up keep their exact three-key shape; only the card gains the four.
- **`parseGoalRow` assigns the four in a loop after building the record**, rather than moving
  `INTENT_FIELDS` above the function. Both were explicitly the implementer's call (ADR
  Implementation notes); the loop leaves the constant in the place story 1 put it, next to
  `pickIntentFields`, so the one list still reads as one list.

## Linked artifacts

- ADR: `engineering-team/decisions/goal-intent-fields/0002-read-side-intent-projection-absence-as-null.md`
- Test plan: `engineering-team/stories/goal-intent-fields/2-return-the-four-on-every-read-surface.test-plan.md`
  (tests: `test/return-the-four-on-every-read-surface.test.js`; plus the re-aimed **R1** in
  `test/store-the-four-when-a-goal-is-captured-or-updated.test.js`)
- Review: (filled in after Review phase)
