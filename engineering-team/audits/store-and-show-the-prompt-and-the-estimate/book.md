# Book of Work: Store and Show the Prompt and the Estimate

**Slug:** store-and-show-the-prompt-and-the-estimate
**Status:** Open
**Opened:** 2026-07-26 — **eagerly**, before any story exists, so the anchor gates the work while it happens.
**Closed:** —

## Intent anchor

**Acceptance frame (no PRD)** — and in this book the frame is **not hand-authored**. This is an **operational Direction run**: the terms are *derived from an owner-ratified goal*, transcribed by `GET /api/brain/direction/<slug>` rather than written here. The generated section below is the authoritative record of those terms; the bullets in this section decompose its two verbatim blocks into separately checkable outcomes and add nothing to them.

- **Goal:** `store-and-show-the-prompt-and-the-estimate`
- **Ratified by:** proposal `proposed-store-and-show-the-prompt-and-the-estimate-08e8c4c8`, approved `2026-07-26` — anchor distance `0` (the goal is its own anchor, as owner policy v1 requires)
- **Eligibility:** `eligible: true`, verified from inside the container at open — see *Derived at* in the generated section

### Acceptance frame

Decomposed from the goal's `deliverable` and `boundary` **verbatim** — every bullet traces to a clause quoted in the generated section. Nothing is reverse-engineered from a design, and nothing is added to the owner's words.

**From the deliverable** — *"I can set any of the four properties we added to goals — the prompt, the estimate, and the two flags — when capturing or updating a goal, and all four come back on every surface that shows a goal."*

- [ ] Each of the four properties can be **set when a goal is captured**.
- [ ] Each of the four properties can be **set when a goal is updated**.
- [ ] **All four come back on every surface that shows a goal.**

**From the boundary** — *"Storing and showing only. No rules about which prompts may run, nothing acts on the estimate or the flags, and no new screen is built."*

- [ ] **Storing and showing only** — no rules about which prompts may run.
- [ ] **Nothing acts on** the estimate or the flags.
- [ ] **No new screen is built.**

**Knowingly surrendered in this mode** — stated rather than quietly dropped; the generated section carries the endpoint's own wording and reasons:

- [ ] The **baseline commit** and the **pinned governing versions** are deliberately not captured in operational mode, and the artifacts say so and say why (reproducibility traded for operational cost; both retained in armed mode, which is unchanged).

## Epics in this book

- `goal-intent-fields` — make the four intent properties on the goal record writable and readable end to end. *(Epic file authored by the Product Owner at Planning; this book names it so the story path is fixed in advance.)*

## Direction mode (operational) — goal-derived

> **This section is GENERATED — derived from the goal below. Do not hand-edit it.**
> Terms are authored on the **goal**, never here. A hand-edit makes this file a second, competing source of intent, which is the defect this mode exists to remove (PRD §7.1). Regenerate it by re-deriving from the goal; a stale section halts the run rather than being quietly corrected. **Hand-editing this section is a review-blocking defect.**

### Provenance
- **Goal:** `store-and-show-the-prompt-and-the-estimate`
- **Goal uuid:** `39999:<TA>:store-and-show-the-prompt-and-the-estimate-1903378a` (`<TA>` resolved at runtime — never hardcoded)
- **Derived at:** `2026-07-26T16:53:58.641Z`
- **Ratifying proposal:** `proposed-store-and-show-the-prompt-and-the-estimate-08e8c4c8` — approved `2026-07-26` · anchor `store-and-show-the-prompt-and-the-estimate` at distance `0` (policy `maxAnchorDistance: 0`)
- **Boundary review:** not required (anchor distance 0 — no parent boundary to narrow)
- **Deliverable, verbatim as derived:**
  > I can set any of the four properties we added to goals — the prompt, the estimate, and the two flags — when capturing or updating a goal, and all four come back on every surface that shows a goal.
- **Boundary, verbatim as derived:**
  > Storing and showing only. No rules about which prompts may run, nothing acts on the estimate or the flags, and no new screen is built.

*(The two verbatim blocks are the run's durable record and its pin: when the goal changes later, they are what makes it possible to reconstruct what this run was actually told, and what the preflight compares against to detect that the terms have moved.)*

### Terms
- **The ask:** All four properties we added to goals — the prompt, the estimate, and the two flags — are declared on the goal concept, but no producer accepts them and no read surface returns them, so anything set today is invisible.
- **Success criteria:** I can set any of the four properties we added to goals — the prompt, the estimate, and the two flags — when capturing or updating a goal, and all four come back on every surface that shows a goal.
- **Ceiling:** Storing and showing only. No rules about which prompts may run, nothing acts on the estimate or the flags, and no new screen is built. — plus the standing autonomy ceiling; staging is the hard limit either way.
- **Estimate:** `chanceOfSuccess: 75`

### Knowingly surrendered in this mode
- **baseline commit** — The origin/staging SHA at arming is not captured for an operational run. *Reproducibility is traded for operational cost. Armed mode retains it, which is why that mode still exists.*
- **pinned governing versions** — The commit SHAs of roles/director.md, the direct-feature skill, and gate-judge.md are not pinned at arming. *Same trade: knowing which Director ran under which rubric is an experimental need, not an operational one.*

### Unavailable
- **estimate** — chanceOfSuccess is read here from the goal's raw record; the goals read API drops it (parseGoalRow). Dependency: `store-and-show-the-prompt-and-the-estimate`.
- **prerequisites** — dependsOn exists on no goal and nowhere in the codebase; prerequisites cannot be derived. Dependency: `store-and-show-the-prompt-and-the-estimate`.

## Provenance

- **Mode:** Operational Direction — goal-derived acceptance frame *(terms transcribed from an owner-ratified goal by the eligibility endpoint; **not** hand-authored, **not** reconstructed at close)*
- **Confidence at close:** *(to be filled by `/close-book`)*

### Context available to Planning — not terms

Facts verified at open, before any story existed. They inform the roles; they are **not** part of the acceptance frame and **cannot extend it**. A role that needs one of these to justify scope must test it against the frame, not against this list.

- **The four properties are real and already declared.** Observable on the goal record's `tapestryOwnerGoal` section via `GET /api/brain/export`: **`prompt`**, **`chanceOfSuccess`** (the estimate), **`needsHumanInput`** and **`needsBreakdown`** (the two flags). They are distinct from `deliverable` / `boundary` / `parent`, which second-brain ADR 0003 d13 added and which *are* already carried end to end.
- **The gap reproduces.** `GET /api/brain/goals` returns `{uuid, name, slug, statement, origin, capturedOn, createdAt, standing, captureDate, deliverable, boundary, parent, parentUuid, hasChildren, pointerCount}` — none of the four.
- **A related defect is already filed against this goal by name.** **OPEN.md row 102** (`bug`, OPEN): the live goal-concept schema puts `chanceOfSuccess` in `required`, breaking ADR 0003 d13's invariant that `required` stays exactly `[name, slug, description]` with the intent fields optional; 25 of 30 live goals are schema-invalid as a result. That row nominates this goal as the fix's home. Whether it falls inside *"set … when capturing or updating a goal"* is **Planning's call against the frame** — recorded here as a pointer, not adopted here as a term.

### One thing this book closes about itself

The eligibility endpoint's own `unavailable` block names **`estimate`** as underivable through the goals API — `parseGoalRow` drops `chanceOfSuccess`, so the endpoint reads it from the raw record instead — and gives the dependency as `store-and-show-the-prompt-and-the-estimate`. That is this goal. If this book satisfies its frame, the Direction endpoint stops needing its raw-record workaround for the estimate. The second `unavailable` entry, **prerequisites** (`dependsOn`), is *not* one of the four properties and stays out of scope; the close should report it still unavailable rather than treat it as missed.

## Record corrections — read before harvesting commit history

**The close-out audit harvests commit messages. Commit messages are immutable. These ones are wrong.**

- **`79226b1c`** — its subject and body state that the Reviewer *"caught a VACUOUS test in the Gate-3-approved suite,"* naming `D13`. **False.** `D13` as shipped ratifies only the parent and hard-asserts `chain.length === 2` and `steps.length === 1`; a length-1 chain fails it outright, and it passed in the Gate-4 run. The vacuity belonged to the Reviewer's own first probe, which seeded a proposal naming the target itself, resolved the anchor at distance 0, and passed vacuously over an empty `steps` array. **No Tester artifact has this defect.** Corrected in `journal.md` (2026-07-27T08:58:28Z) and in the review's own accuracy-audit subsection.
- **Four commit messages before `a67571f8`** claim an evidence log was "committed as evidence." **False at the time** — `.gitignore`'s `*.log` silently excluded all five. They were force-added in `a67571f8`; the logs are present now, but those four messages were untrue when written.

Both errors are the Director's, not a role's: the first was an unverified claim amplified from a review, the second an unchecked assumption about a silent-success command. The audit should treat `journal.md` as authoritative wherever it and a commit message disagree.

## Close artifacts *(filled by `/close-book`)*

- Build audit: `engineering-team/audits/store-and-show-the-prompt-and-the-estimate/audit.md`
- Product feedback: `engineering-team/audits/store-and-show-the-prompt-and-the-estimate/prd-seed.md`
