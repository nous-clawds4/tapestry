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
2. **return-the-four-on-every-read-surface** — the read half, in two classes: the five **projecting**
   surfaces that build a response from a parsed record and drop all four today (goals list, goal
   detail, session orientation, proposal queue, Direction transcription), plus the **verbatim**
   surfaces that return the stored record as stored, which already carry them and need no work. A
   never-set property is reported as not set, never invented (decision 6). Server read surfaces.
   **Approved** 2026-07-26; **returned by Gate 1 twice** — AC3 collided with two shipped "not set"
   contracts, then this epic still carried the superseded defaults rule → returns to Gate 1.
3. **show-the-four-on-the-goal-screens-that-already-exist** — the show half, in two classes: the
   three **projecting** screens that build a display from the goal reads (Goals, Goal detail,
   Proposals), plus the **record-rendering** screens that show a goal's stored record as stored and
   already display the four. No new screen. Control-panel client. **Approved** 2026-07-26;
   **returned by Gate 1** 2026-07-27 — the prompt has no declared default, the extent omitted the
   record-rendering class, and the ADR 0006 supersession was recorded nowhere → returns to Gate 1.

**Why three, not one.** Gate 1 kicked back a single combined story: its extent was unbounded by
construction (it deferred enumerating the read surfaces to Architecture), so no one could confirm
"one subsystem" at the gate, and it spanned the write path, the read surfaces, and the client.
Each story above is bounded at Planning by an explicit inventory and sits in exactly one subsystem.
**Splitting does not narrow the frame** — the frame is satisfied by the book, not by any single
story, so "every surface that shows a goal" remains universal across the epic.

**The inventories are boundaries, not guesses — and they are enforced.** Each story lists what it
covers, verified against the running stack. If a later phase finds something that belongs and is not
listed, it returns to Planning to re-bound the extent rather than absorbing it silently. **This has
happened four times across two stories** — story 1: Architecture returned it, then Gate 1 found a
counterexample in the route list; story 2: Gate 1 found AC3 collided with two shipped "not set"
contracts, then found this epic still carrying the superseded rule the story had already dropped.
story 3: Gate 1 found the prompt has no declared default, an omitted screen class, and a ratified
supersession recorded in no artifact. Each was the clause working, at the cost of a round trip.

**The recurring one, now three times over:** *a ratified answer has to land everywhere it is
recorded, not only in the story that prompted it.* Twice it was a superseded rule left standing in
this epic; the third time an owner ratification lived only in the Director's journal, which no role
reads — so an Architect would have reached Gate 2 mandated into a collision with a live Accepted ADR
and no recorded authority to resolve it. **The practice that prevents it:** a ratified answer is
recorded in this epic's decision list *at the moment of ratification*, with its provenance — not when
the next story happens to need it. Journaling is not recording.

**The lesson, recorded because it will recur — and it already has, on both halves.** Every miss had
the same shape: a path or surface that needs *no work* because it passes through whatever it is
handed. A list recalled from "what must change" systematically forgets exactly that class. Both
stories therefore carry a **derived** extent split into two classes with deliberately different
claims:

- **The work-bearing class is closed, by a query a gate can re-run.** Story 1: sites that *construct*
  a goal section — four repo-wide, all in one module. Story 2: surfaces that *project* a goal from a
  parsed record — five. Both independently re-derived from source at Gate 1. A further member is
  work, and the kickback clause applies to it.
- **The no-work class is characterized, not enumerated.** Story 1: paths that replicate a supplied or
  stored record. Story 2: surfaces that return the stored record as stored. Neither can drop the
  four, so the list is record-keeping; claiming it exhaustive would claim something unprovable to no
  purpose — membership follows from the property.

An enumeration a gate can re-derive beats one it has to trust; and where re-derivation isn't
possible, a stated property beats a list that pretends to be complete.

**Accounting note for anyone re-running story 2's derivation.** The goal-record parser has call sites
that are *not* projecting surfaces, and a gate re-running the query will hit them: two write-side
internals (the decomposition validator and the restore planner), the export (which calls the parser
only as a validity filter and returns the raw stored section), and **the hygiene check**, which emits
check results rather than goal fields. Story 2's text names the first three; the hygiene site is the
fourth and is off the list for the same reason. None is a scope gap.

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

## Ratified on return from Gate 1 (2026-07-26) — story 2

6. **What does a read surface return for a property that was never set?** → **Nothing invented.**
   *"All four come back on every surface"* could be read as *"all four keys appear in every
   response,"* which would require materializing the declared defaults. That reading is rejected on
   three grounds that hold jointly: the frame says the four *come back*, and for a property never set
   there is nothing to come back; inventing a default **is** acting on the estimate, which the
   ceiling forbids; and the concept's default wording addresses a **consumer**, not a transport.
   Decisive on the evidence — it would break a shipped contract from the **closed**
   `operational-direction` book, whose U25 pins an absent estimate to `null` with
   `estimateSource: 'absent'`, *"never invented"*; and story 1's ADR encodes absence as key-absence,
   *"the only representation of 'unset' that survives storage, export and restore."* A frame cannot
   silently break a closed book's contract.
   **A round-trip argument that is decisive on its own:** restore stores an export's section
   verbatim, so an export that invented `chanceOfSuccess: 0` would have restore write those zeros
   in — converting "never estimated" into "estimated at zero" on every goal, permanently, in a single
   backup cycle.
   *Asymmetry noted, and the operator may overrule:* this reading preserves shipped behavior and adds
   nothing, so if it is wrong the correction is purely additive later.
7. **Does the projecting/verbatim split decide who applies the defaults?** → **No — it decides only
   where the work is.** Read surfaces either *project* a goal (build a response from a parsed
   record — the work; five, exhaustively derived) or return the **stored record as stored** (no work;
   characterized by the property, not enumerated). **The split is not the invent/don't-invent line.**
   The Direction transcription is a *projecting* surface that must nonetheless **preserve** absence —
   `estimateSource: hasEstimate ? 'goal' : 'absent'`, pinned by U25. Binding the defaults to
   "projecting surfaces" would have relocated the contradiction instead of removing it, which is why
   decision 6 binds no class: it binds every layer.

## Ratified on return from Gate 1 (2026-07-27) — story 3

8. **May the estimate appear on the Proposals screen, given `second-brain` ADR 0006 d13/AC6?** →
   **Yes, under a narrow, explicit supersession.** ADR 0006 is live and **Accepted**, and d13/AC6
   forbids "no numeric score, percentage, gauge, or ranking number" in any owner-facing proposal
   string or rendered card content. The owner has ratified a supersession **scoped to owner-authored
   values only**: the prohibition targets *system-generated* scores that would make proposals look
   ranked, and `chanceOfSuccess` is the owner's own estimate — a materially different thing. **The
   system-generated-ranking prohibition remains fully intact**, and story 3's AC4 is where that
   boundary is tested. **Story 3's ADR carries the supersession explicitly.**
   *Provenance:* raised through the **Director**, **ratified by the operator** 2026-07-27.
9. **Two Product Owner calls on showing the prompt — flagged as PO calls, not owner ratifications**,
   so either can be overruled without disturbing anything else:
   **(a) The never-set prompt.** The concept declares a default for only three of the four —
   `needsHumanInput` and `needsBreakdown` carry `default: false`, and `chanceOfSuccess`'s description
   names 0. **`prompt` declares no default at all**, so "show the declared default" is undefined for
   it. Call: the screen shows the prompt explicitly as *not set*; a literal `null`/`undefined`, or an
   area indistinguishable from a prompt set to empty, does not satisfy it. This keeps the epic's rule
   intact — absence is interpreted at the screen, never invented — and extends it to the one property
   where the concept supplies nothing to interpret with.
   **(b) The prompt on list-type screens.** Ratified decision 1 (full prompt, no truncation) binds
   the *read surfaces* of story 2, not the screens of story 3, so "visible" needed deciding. Call:
   full text on the goal detail screen; an **excerpt of the actual prompt text** on list-type
   screens; and — consistent with decision 1's reasoning — a bare presence indicator with none of the
   text does not count as visible on any screen.

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
- **The declared defaults are interpretation-side — no layer fabricates them.** The concept's
  *"The default is 0, if not otherwise estimated"* and *"Absent means false"* tell a **consumer how
  to read absence**; they do not oblige storage, transport, or a read surface to materialize a
  value. One rule across three layers: on the stored record (story 1) a value never supplied is
  **absent**; on every read surface (story 2) a never-set property is reported as *not set*, and no
  surface substitutes `0`, `false`, or an empty prompt; at the screen (story 3) — the interpretation
  point — absence is *displayed* using the concept's declared defaults.
  **This supersedes the earlier guardrail** that had "stories 2 and 3 use exactly those, once each."
  That version handed a tester two opposite expected results for the never-set case and is
  retracted; see decision 6.
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
