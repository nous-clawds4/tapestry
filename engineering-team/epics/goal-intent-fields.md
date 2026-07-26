# Epic: Goal Intent Fields

**Status:** Active
**Created:** 2026-07-26
**Book:** `engineering-team/audits/store-and-show-the-prompt-and-the-estimate/book.md` (no PRD — operational Direction, goal-derived acceptance frame)
**Named by:** the book, at open — the story path was fixed in advance.

## What this is

Four properties are declared on the goal concept — **the prompt**, **the estimate**, and **two
flags** — and none of them survives a round trip. Most of the ways a goal gets written drop them,
and the read surfaces drop them, so anything set today is invisible. This epic makes those four
writable and readable end to end.

Storing and showing only. The four are carried, not consulted: no rule says which prompts may run,
and nothing ranks, gates, filters, or acts on the estimate or the flags. No new screen.

The four, with the concept graph's own words for each:

| Owner's words | Declared as | What it says |
|---|---|---|
| the prompt | `prompt` | the markdown given to an agent at the start of a session aimed at this goal |
| the estimate | `chanceOfSuccess` | 0–100: chance an agent completes this goal with no human input; default 0 |
| flag: needs the owner | `needsHumanInput` | the goal can't move without the owner answering something; absent means false |
| flag: too big as it stands | `needsBreakdown` | the goal should be broken into smaller goals; absent means false |

They sit alongside `deliverable` / `boundary` / `parent`, which second-brain ADR 0003 d13 added and
which *are* already carried end to end. That existing plumbing is the shape this epic matches.

## Stories

`stories/goal-intent-fields/` — strictly ordered; each depends on the one before.

1. **store-the-four-when-a-goal-is-captured-or-updated** — the write half: all four accepted by every
   way a goal record gets written — three fixed-field paths that drop them today (noting a root goal,
   child capture, intent update) and five that already store what they are handed — plus the goal
   concept a fresh instance provisions for itself, which today omits all four. Server write path.
   **Approved** 2026-07-26, **re-bounded twice** 2026-07-26 → returns to Gate 1.
2. **return-the-four-on-every-read-surface** — the read half: all four returned by the goals list, a
   goal's detail, the session orientation read, the proposal queue, and the Direction transcription;
   the export already carries them and must not regress. Server read surfaces. **Approved**
   2026-07-26.
3. **show-the-four-on-the-goal-screens-that-already-exist** — the show half: all four visible on the
   Goals screen, the Goal detail screen, and the Proposals screen. No new screen. Control-panel
   client. **Approved** 2026-07-26.

**Why three, not one.** Gate 1 kicked back a single combined story: its extent was unbounded by
construction (it deferred enumerating the read surfaces to Architecture), so no one could confirm
"one subsystem" at the gate, and it spanned the write path, the read surfaces, and the client.
Each story above is bounded at Planning by an explicit inventory and sits in exactly one subsystem.
**Splitting does not narrow the frame** — the frame is satisfied by the book, not by any single
story, so "every surface that shows a goal" remains universal across the epic.

**The inventories are boundaries, not guesses — and they are enforced.** Each story lists what it
covers, verified against the running stack. If a later phase finds something that belongs and is not
listed, it returns to Planning to re-bound the extent rather than absorbing it silently. **This has
happened twice on story 1** — Architecture returned it, then Gate 1 found a counterexample by reading
the route list — which is the clause working, at the cost of two round trips.

**The lesson, recorded because it will recur.** Every miss was the same shape: a write path that
needs *no work* because it replicates whatever record it is handed. A list recalled from what must
change systematically forgets that class. Story 1's extent is therefore **derived, with the
derivation stated** — and the two classes carry different claims, deliberately:

- **The work-bearing class is closed.** Sites that *construct* a goal section can drop properties;
  there are four repo-wide, all in one module, independently re-derived from source at Gate 1. A
  fifth would be work, and the kickback clause applies.
- **The no-work class is characterized, not enumerated.** Paths that replicate a supplied or stored
  record cannot drop anything, so the list of them is record-keeping. Claiming it exhaustive would
  be claiming something unprovable to no purpose — membership follows from the property.

An enumeration a gate can re-derive beats one it has to trust; and where re-derivation isn't
possible, a stated property beats a list that pretends to be complete.

## Ratified at the Planning gate (2026-07-26)

Questions raised at Planning and answered by the owner. Recorded once here; the stories reference
them rather than restating the reasoning.

1. **How much of the prompt on list-type surfaces?** → **Full prompt everywhere; no truncation.**
   The frame says all four *come back* on every surface; a truncated prompt is a different, smaller
   value, not the prompt coming back. Binds story 2.
2. **Does "every surface" include a goal shown inside something else?** → **Yes — "every" is the
   operative word**, so surfaces that embed a goal (the orientation read, a proposal that nominates
   a goal, the Direction transcription, the export) are in scope. Narrowing it would let the book
   claim done with a frame bullet unmet. Binds stories 2 and 3.
3. **Is "clear it back to unset" needed?** → **No — setting only.** The frame's verb is *set*;
   erasing a value back to absent is a capability it does not name. Binds story 1.

## Ratified on return from Architecture (2026-07-26) — story 1

4. **Is noting a new root goal from a session in scope?** → **Yes.** "Capture from scratch" is two
   paths that behave oppositely: supplying a record directly already carries all four, while noting
   a new root goal builds its section from a fixed set of fields and silently drops them. It
   captures a goal, so the frame's *"when capturing"* covers it; excluding it would narrow the frame
   and would leave the owner losing a prompt at capture — the exact invisibility the ask describes.
5. **Does the goal concept a fresh instance provisions belong in story 1?** → **Yes** (operator's
   call). What a fresh instance self-provisions declares eight properties and omits all four; since
   undeclared properties are silently dropped, *"I can set"* fails outright on a fresh or restored
   instance regardless of what the write paths accept. Same module, same subsystem as story 1.

**Two gate-judge asides that were wrong, recorded so no one designs around them.** Both verdicts
were sound and binding; the incidental claims inside them were not, and were disproved by reading
the code:

1. That the direct-record capture path auto-populates every declared property with type defaults
   when no record is supplied — which would make the four *present* rather than absent. It does not:
   the defaults loop iterates only the schema's **top-level** properties, and the goal schema's sole
   top-level key is the goal section itself (an object), so it yields an empty section and never
   descends. Story 1's "absent when not supplied" criterion is sound and defends against nothing.
2. That re-import from the relay is unreachable from any screen. It is reachable — four screens post
   to it, two of them list screens. The conclusion (it cannot drop the four) still holds, but for a
   different reason: it replicates the relay's copy of the record. Reachability was never the
   operative property.

**Standing practice this establishes:** a gate verdict binds; the incidental claims inside it are
unverified until checked against source — the same standard applied to our own inventories, which is
what caught both of these.

## ADRs

`decisions/goal-intent-fields/` — created per story at Architecture.

## Key facts / guardrails

- **The book's acceptance frame is the constitution.** Derived verbatim from an owner-ratified goal,
  not hand-authored. It may not be widened — the ceiling ("storing and showing only") is
  review-enforceable, and so is "no new screen is built." It may not be narrowed either: decisions
  2 and 4 above both turned on refusing to narrow it.
- **The goal concept is adopted, never re-derived** — `39998:<TA>:tapestry-owner-goal`, `<TA>`
  resolved at runtime per the house rule. All four properties are already declared on it; this epic
  adds no properties and redefines none. Story 1's criterion 4 brings a *fresh* instance's
  self-provisioned concept up to that same declaration — it does not invent properties.
- **The declared defaults come from the concept, not from us** — the estimate reads `0` when never
  estimated; each flag reads `false` when absent. Stories 2 and 3 use exactly those, once each, so
  a test can discriminate. On the stored record itself (story 1), a value never supplied is
  **absent** — a different layer, stated separately and deliberately.
- **Owner-facing copy follows the register already in use on the goal screens** (second-brain style
  guide). A review consideration, not an acceptance criterion.
- **Out of this epic, by the book's own words:** the schema-`required` defect filed as OPEN.md row
  102 — out of scope here, handled separately as live-data cleanup; this epic neither fixes nor
  closes it, and nothing in it is evidence about that row's state. Story 1's criterion 4 leaves
  `required` untouched on every instance, so the two do not overlap. Likewise `dependsOn` /
  prerequisites (not one of the four — the book says the close should report it still unavailable
  rather than missed).

## Related

- One thing this epic closes about itself: the Direction eligibility endpoint currently reads the
  estimate off the raw goal record because the goals read API drops it. Story 2 makes that
  workaround unnecessary (retiring it is not required by this epic).
