# Story 1: Store the four when a goal is captured or updated

**Status:** Approved
**Created:** 2026-07-26
**Re-bounded:** 2026-07-26 (twice) — first from Architecture via this story's kickback clause, then
from Gate 1, which found a counterexample to the extent table by reading the route list. The table
below is now **derived** rather than recalled, and the derivation is stated so the gate can check it
instead of trusting it. Returns to Gate 1.
**Type:** Feature
**Epic:** `goal-intent-fields`
**Book:** `engineering-team/audits/store-and-show-the-prompt-and-the-estimate/book.md` — the
acceptance frame there is the constitution. The frame is satisfied by **the book**, not by this
story alone; this story carries one bounded part of it.
**Supersedes:** the Gate-1 draft that also carried the number 1
(`set-and-see-the-four-goal-properties`, KICK_BACK — unbounded extent, spanned three subsystems).
That draft was never committed; the number returns to the pool and this story takes it.

## Background

Four properties are declared on the goal concept — the prompt, the estimate, and two flags — and the
goal-specific write paths silently drop them. This is the **write half** of the gap: values the
owner supplies have nowhere to land.

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

### How this table was derived

Stated so the gate can audit the derivation rather than trust the list. A goal record can be written
in exactly two ways, and the two classes are known with **different kinds of certainty** — which is
itself the point:

- **Paths that build a goal section from a fixed set of fields — the work-bearing class, and it is
  closed.** These can drop properties, so these are the ones that need work. Derived by enumerating
  *every* site in the server that constructs a goal section: **four repo-wide, all in one module** —
  three write paths, plus the restore mint, which passes its section through untouched and so
  behaves as the other class. Independently re-derived from source at Gate 1. Should a fifth
  construction site ever appear, it is work, and the kickback clause applies to it.
- **Paths that store a supplied record as given — the no-work class, characterized rather than
  enumerated.** These replicate whatever record they are handed, so **none of them can drop the
  four**, and no number of them changes this story's work. The rows below are the ones found so far,
  via the callers of the primitive that replaces a stored record, the generic element screen's own
  write, the archive-shaped writers, and the replicating operations. This list is deliberately
  **not** claimed exhaustive: membership is decided by the property — does it replicate a supplied
  or stored record verbatim? — not by appearing here. A path missing from it is a record-keeping
  gap, not a scope gap.

Cross-checked against the Architect's inventory and the server's write-route list. **Every path
found missing across three rounds of review has been in the no-work class**, which is what the
asymmetry predicts: a list recalled from "what must change" omits precisely the paths that change
nothing. So the work-bearing class is closed by construction, and the other is closed by its
defining property instead — the only closure it can have, and the only one it needs.

### The ways a goal record gets written

| How a goal record gets written | State today |
|---|---|
| noting a new root goal from a session | **drops all four**, silently — builds its section from a fixed set of fields |
| capturing a goal while breaking a bigger one down (a child goal) | **drops all four** — same fixed-field construction |
| updating an existing goal's intent | **drops all four** — it merges onto the existing section, so any four already stored survive, but none can be set |
| capturing a goal by supplying its record directly, from the generic element screen | **already carries all four** — stores the record as given. No work; must not regress. |
| replacing an existing goal's record wholesale, from the generic element screen | **already carries all four** — stores the record as given, ungated by concept type. The update-side twin of the row above. No work; must not regress. |
| replacing a record's stored json directly through the graph-maintenance tooling | **already carries all four** — same wholesale replacement. No work; must not regress. |
| restoring the brain from an export | **already carries all four** — the artifact's section is restored verbatim, out-of-contract fields riding along |
| importing events from an archive | **already carries all four** — whole records are written as given |
| forking a node into a new one | **already carries all four** — every tag on the original is copied onto the new signed event, the goal-marking tag included, so the fork surfaces as a goal carrying whatever the original held |
| re-importing a record from the relay (reachable from the list screens) | **already carries all four** — the stored tags are dropped and the record is rebuilt from the relay's copy. It takes only an identifier, so it replicates rather than composes; that, not who can reach it, is why it cannot drop anything |

A goal captured by noting a new root goal, with a prompt supplied, loses the prompt. That is the
invisibility the ask describes, reached through a dedicated path with its own owner gate and its own
refusals — not an edge case.

### The goal concept a fresh instance provisions for itself

An instance that does not yet have the goal concept **self-provisions** it. What it provisions today
declares eight properties and **omits all four**. Undeclared properties are silently dropped, so on
a fresh or restored instance the frame's *"I can set"* fails outright — no matter what the write
paths above accept. This instance is unaffected (its concept already exists), which is exactly why
the drift is invisible here and fatal there.

**Subsystem: the server-side goal write path and the goal concept it provisions** — one module. No
read surface and no screen changes here; those are `goal-intent-fields` #2 and #3.

**Verification without new read work:** the export already returns each goal's stored record as
given, so what this story stores is externally observable the moment it is stored.

**The kickback clause stands, and it has fired twice.** It bites on the work-bearing class: if a
later phase finds a further site that *constructs* a goal section, that is work, and it returns to
Planning rather than being absorbed. A further *replicating* path is a record-keeping addition to
the table above — worth making, but it changes no criterion and no extent, so it does not re-open
this gate.

## User-facing description

As the owner of this tapestry, I want the prompt, the estimate, and the two flags to be accepted
however I capture or update a goal — including on a brand-new instance — so that what I know about a
goal is actually recorded instead of being dropped on the way in.

## Acceptance criteria

- [ ] **Accepted at capture, by every capture path.** Given a goal is captured through **any** of the
      capture paths inventoried above, with any subset of the four supplied, when the capture
      completes, then the stored record carries exactly the supplied values, and each one not
      supplied is **absent** from the record. Capturing a goal with none of the four supplied still
      succeeds.
- [ ] **Accepted at update.** Given an existing goal, when any subset of the four is updated, then
      those values are stored, and the other three are unchanged — as is everything else already on
      the goal (name, statement, origin, capture date, deliverable, boundary, parent).
- [ ] **Stored in the shape the concept declares.** Given a prompt of several lines of markdown, an
      estimate within 0–100, and either flag set true or false, when the record is read back, then
      the prompt is byte-identical to what was supplied, the estimate is stored as a number, and
      each flag is stored as a boolean.
- [ ] **A fresh instance declares all four.** Given an instance where the goal concept does not yet
      exist, when that instance self-provisions it, then the provisioned concept declares all four
      properties alongside the ones it already declares, and **which properties are required is
      unchanged** — so a goal captured on a fresh instance can carry the four rather than having
      them silently dropped as undeclared.
- [ ] **Nothing acts on them at write time.** Given goals written with differing prompts, estimates,
      and flags, when each is captured or updated, then no write is rejected, gated, reordered, or
      transformed because of what those four contain. No rule decides which prompts may run.

## Concepts touched

- `39998:<TA>:tapestry-owner-goal` — tapestry owner goal (the record that carries all four declared
  properties, and the concept a fresh instance provisions). `<TA>` is resolved at runtime per the
  house rule — never hardcoded.

No concept is added and none is redefined; all four are already declared on this instance's concept.

## Out of scope

- **Returning the four on read surfaces** — `goal-intent-fields` #2.
- **Showing the four on the owner's screens** — `goal-intent-fields` #3.
- **Every "stores as given" write path needs no change** — direct-record capture and wholesale
  record replacement from the generic element screen, direct json replacement through the
  graph-maintenance tooling, restore from an export, archive import, forking a node, and re-import
  from the relay. They are named in the table rather than omitted so their absence from the work is
  deliberate and checkable; **Architecture records each as "no change."** They carry the four
  because they replicate what they are handed — which is both why they are safe and why they are the
  class most easily forgotten. If Architecture finds another of them, it adds a row; it does not
  return the story.
- **Values outside the concept's declared shape** (an estimate above 100 or below 0, a non-boolean
  flag). The frame is storing and showing; it makes no rules, so this story invents neither a
  rejection rule nor a clamping rule. What happens to a malformed value stays undefined here.
- **The ungated nature of wholesale record replacement.** That any element's record can be replaced
  with no concept-type check is pre-existing debt already noted against second-brain ADR 0003; this
  story neither fixes nor widens it.
- **Which properties are required.** Criterion 4 adds the four as declared properties and changes
  nothing about `required` — this story does not touch that question on any instance.
- **The schema-`required` defect (OPEN.md row 102).** Out of scope — handled separately as live-data
  cleanup. This story neither fixes nor closes it, and nothing here is evidence about its state.
  Criterion 4 concerns what a *fresh* instance provisions, which is a different layer from the
  already-signed schema that row 102 reports.
- **Clearing a value back to unset.** The frame's verb is *set*; a clear-to-unset capability it does
  not name would widen it. (Ratified at the Planning gate — see the epic.)
- **Backfilling values** onto goals that already exist.
- **`dependsOn` / prerequisites** — not one of the four; stays unavailable.

## Open questions

None. The three raised at Planning were answered at the gate; the two raised by Architecture were
answered on return. All are recorded in the epic.

## Linked artifacts

- ADR: `engineering-team/decisions/goal-intent-fields/0001-shared-intent-field-picker-and-provisioned-schema.md`
- Test plan: `engineering-team/stories/goal-intent-fields/1-store-the-four-when-a-goal-is-captured-or-updated.test-plan.md`
  (tests: `test/store-the-four-when-a-goal-is-captured-or-updated.test.js`)
- Review: (filled in after Review phase)
