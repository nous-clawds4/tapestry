# PRD Seed: Operational Direction — handing work to the engineering team

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/operational-direction/audit.md`
**Anchor:** acceptance frame in `book.md` — **transcribed verbatim from the owner goal** `hand-work-to-the-engineering-team-without-arming-a-book`, not reconstructed from git
**Confidence:** **high on intent, medium on completion** *(see audit §0 — the two are deliberately not averaged)*
**Date:** 2026-07-26

> This is a **reverse-engineered baseline** in the product-team PRD shape, built from what shipped. It is a *strawman for the product team*, not a ratified spec. Sections are tagged `[FROM FRAME]`, `[INFERRED]`, or `[UNKNOWN — product input needed]`.
>
> **Unusually for a seed, §1 and §3 are largely `[FROM FRAME]`** — the owner wrote a ~4,000-word goal before any work started, and it survives byte-identical. The guessing here is thinner than a typical no-PRD reconstruction. Where it *is* guessing, it says so.

## 1. Product vision

`[FROM FRAME]` The owner has a Director that can carry a book of work end to end with no human at the phase gates. It works. **It goes essentially unused**, because starting it means hand-writing a ~2,000-word pre-registration — a hypothesis with a probability, a deadline, a baseline commit, pinned file hashes, an autonomy ceiling, an exhaustive delegated-decision list, and an outcome table.

The owner's diagnosis, verbatim: *"Almost all of it exists to score an experiment rather than to do the work, and its cost means the mode goes unused."* That apparatus is correct when the question is **"does autonomous direction work?"** and pure overhead when the question is **"please do this piece of work."** One mode was serving both, and the cost of the first suppressed all use of the second.

`[FROM FRAME]` **The intended outcome:** a goal that already says what done produces, what it stays inside, and who should do it can be handed to the engineering team **without anyone writing a pre-registration** — with every safety property still in force. The owner still sets every goalpost; they set them **once, when writing the goal**, instead of again per run.

`[INFERRED]` The deeper product move: **goals become executable.** Before this, a goal was a record you read. After it, a goal is a thing you can hand off — the goal record *is* the work order. That reframing, not the endpoint, is the product.

## 2. Personas

`[FROM FRAME]` **The owner / operator (David).** Sole persona for this capability. From the story: *"As the owner of this tapestry, I want to hand an already-ratified goal to the engineering team without writing a pre-registration, so that the Director actually gets used for real work — while the staging ceiling, the stopping rules, the blinded judges, and my sole authority to call a book done all stay exactly as strong as they are today."*

Behaviorally: writes goals in natural language with a deliverable and a boundary; wants leverage without ceding control; treats safety properties as non-negotiable and says so explicitly rather than assuming they'll be preserved.

`[INFERRED]` **The Director agent** — a consumer, not a persona. It reads eligibility, obeys refusals, judges boundary steps blind, and journals. It is deliberately *not* trusted: the design assumes it could lie and relies on blinded judges plus operator audit rather than on its good behavior.

`[UNKNOWN — product input needed]` Whether anyone other than the owner ever hands off goals. Everything shipped assumes exactly one ratifying human. Multi-operator would change the anchor model substantially.

## 3. Scope (as-built)

`[FROM FRAME]` **In scope, delivered:**
- A **second** Direction on-ramp. Terms derived from the goal: `deliverable → success criteria`, `boundary → ceiling`, `statement → the ask`, `chanceOfSuccess → the estimate`.
- **The armed mode is unchanged** — it remains the mode for when the harness itself is under test.
- Every non-negotiable stays in force **by reference, not by copy**: staging ceiling, all six stopping rules, blinded gate judges with journaled verdicts, owner-only completion ratification, the append-only journal.
- **Knowingly surrendered and stated in the artifacts:** the baseline commit and pinned governing versions — reproducibility traded for operational cost, retained in armed mode.

`[INFERRED]` **In scope, added as the safety edge** (not named in the goal — see audit §4 D1):
- An **owner-ratified anchor** requirement: a goal is handable only if it, or a near ancestor, is named by an `approved` proposal fact.
- A **boundary-narrowing invariant**: a sub-goal narrows its parent's boundary, never widens it. Shipped *inseparably* from the anchor, because a distant anchor without inheritance is a laundering path.
- **Staleness detection**: a goal re-signed after its approval carries a ratification nobody granted.

`[FROM FRAME]` **Explicitly out of scope:** the five engineering phases; the gate rubrics; the blinded-judge agent definition; anything letting an agent ratify its own completion.

`[INFERRED]` **Built but never exercised.** Zero operational runs have occurred, and no goal in the graph is currently eligible — including the goal that motivated the work. **The capability is enabled, not demonstrated.**

## 4. Domain model

`[INFERRED]` from concepts read and the shipped contracts. **No concept or schema was created or modified** — this rides entirely on existing structures, per PRD §7.8 (*"Existing structures are adopted, never re-derived"*).

- **Goal** (`39998:<TA>:tapestry-owner-goal`) — the work order. Load-bearing attributes: `statement`/`description`, `deliverable`, `boundary`, `parent`, `chanceOfSuccess`, `created_at`. **`created_at` is doing safety work**: because goals re-sign on every intent edit and proposal facts never do, comparing the two timestamps detects a post-ratification rewrite with no new field.
- **Proposal** (`39998:<TA>:tapestry-proposal`) — append-only facts of type `proposed` / `approved` / `skipped`. **An `approved` fact is what makes a goal handable.** Ratification is *derived from the presence of a fact*, never stored as a flag on the goal.
- **Ancestry chain** — goal → parent → …, walked upward to a bounded distance. **The distance is a policy value, not a design constant** (v1 = 0).
- **Boundary step** — a parent→child pair, reduced to *only* two prose strings for blind judgment. Carries no slug or position by construction.

`[UNKNOWN — product input needed]` `dependsOn` / prerequisites: named in the owner's mapping but **the field does not exist anywhere**. Reported as unavailable rather than synthesized.

## 5. Design rules (as-built)

`[INFERRED]` — no UI shipped, so these are *behavioral* rules read off the code and ADRs. They read as product principles worth ratifying explicitly:

1. **Fail closed, always.** Every guard refuses when it cannot establish safety: no anchor, unknowable timestamps, unjudged boundary steps, malformed verdicts. Absence of a judgment never reads as approval.
2. **Say only what you established.** An unjudged boundary is never reported as a widening; an unknowable timestamp is never reported as a rewrite. Refusal text lands in the journal and the audit, so a refusal that overstates its own finding corrupts the record.
3. **Safety belongs in code, not prose.** The governing choice of the whole book: a rule enforced by "an agent reading prose about itself" is not enforced. Both review kick-backs were instances of this principle being violated and restored.
4. **State what you gave up.** `SURRENDERED` and `UNAVAILABLE` are returned as *data*, so artifacts cannot silently omit them.
5. **Policy is a parameter; changing it is an owner act.** Loosening the anchor distance is configuration (PRD §7.6), never a redesign — and the machinery must already be safe at the loosened value before the owner turns the dial.
6. **Generated artifacts are not authoring surfaces.** The goal-derived book section says so in its own body; hand-editing it is a defect (PRD §7.1's posture, one level up).

## 6. Carry-forward & open questions

Promoted from build audit §6:

- **Ratify a goal so the mode can be used** — a `make-proposal` + `approve-proposal` pair. **This single act is what stands between "built" and "usable."**
- **`store-and-show-the-prompt-and-the-estimate`** — makes `chanceOfSuccess`/`prompt` readable through the goals API; also owns the `OPEN.md` #102 schema repair.
- **Probe staging and production for the #102 schema drift** — status unknown on both.
- **`make-sure-only-prompts-i-wrote-can-run`** — the upstream authorship dependency.
- **`task-timeline` pre-arming refresh** — its Direction-mode section predates the second mode.
- **Raising the anchor distance above 0** — a future owner policy act.
- **Live verification of the eligible path** — every live test to date exercises refusals only.

## 7. What product must validate

- [ ] **Is "enabled but never exercised" acceptable as done?** The book's deliverable is satisfied in machinery and unproven in practice. A first real operational run is the only thing that converts one into the other. *(This is the biggest open question in this seed.)*
- [ ] **Is the anchor requirement the right price?** It was added beyond the goal's text as a safety edge. It means handing off is cheaper than arming but **not unconditional** — every goal now needs a ratification act first. Is that the intended trade, or heavier than wanted?
- [ ] **Should `chanceOfSuccess` be required on a goal?** The live schema currently says yes (OPEN.md #102) and ~25 goals violate it. The as-built code treats it as **optional**, recording absence rather than inventing a number. These two positions contradict; product should pick one.
- [ ] **Does anyone but the owner hand off goals?** The whole anchor model assumes a single ratifying human.
- [ ] **What is the intended anchor distance at maturity?** v1 = 0 means one ratification per goal. The design anticipates loosening so one ratified top goal legitimizes a subtree — is that the destination, and how far?
- [ ] **Should prerequisites (`dependsOn`) exist?** The owner's own mapping names it; nothing implements it. Product decides whether it is real or drops out of the model.
- [ ] **Is the trust model acceptable as-is?** A Director can pass boundary verdicts no judge produced, exactly as it could rubber-stamp any gate. Recorded as debt, not closed. Closing it needs a judge-verdict record the harness does not have — is that worth building?
