# Story 1: Store the four when a goal is captured or updated

**Status:** Approved
**Created:** 2026-07-26
**Re-bounded:** 2026-07-26 — returned from Architecture via this story's own kickback clause; the
capture inventory below was wrong (see *Extent*). Returns to Gate 1, because the enumeration is what
that gate certified as bounded.
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
most of the ways a goal gets written silently drop them. This is the **write half** of the gap:
values the owner supplies have nowhere to land.

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

### The ways a goal gets written

Re-inventoried 2026-07-26 after Architecture returned this story. The first inventory said "capture
from scratch" was one path; it is **two, and they behave oppositely**. Which paths already carry the
four is now load-bearing, so it is recorded per path.

| How a goal gets written | State today |
|---|---|
| capturing a goal by supplying its record directly (the general element-capture path) | **already carries all four** — the supplied record is stored as given. No work; must not regress. |
| noting a new root goal from a session — capture from scratch, built from a fixed set of fields | **drops all four**, silently |
| capturing a goal while breaking a bigger one down (a child goal) | **drops all four** |
| updating an existing goal's intent | **drops all four** |
| restoring the brain from an export | passes each record through as given, so it **carries the four with no work** — see *Out of scope* |

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

**The kickback clause stands, and it has already fired once.** If Architecture finds a further way a
goal gets written, it returns to Planning to have the extent re-bounded rather than absorbing it.

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
- **Restoring the brain from an export.** It is a genuine fourth writer of goal records, and it is
  named here deliberately rather than omitted: it passes each record through as given, so it already
  carries the four and needs no change and no criterion. Architecture should record it as "no
  change" rather than leaving its absence to look like an oversight.
- **Values outside the concept's declared shape** (an estimate above 100 or below 0, a non-boolean
  flag). The frame is storing and showing; it makes no rules, so this story invents neither a
  rejection rule nor a clamping rule. What happens to a malformed value stays undefined here.
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

- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
