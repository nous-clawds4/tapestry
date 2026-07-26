# Book of Work: <title>

**Slug:** <book-slug>
**Status:** Open | Closed
**Opened:** <DATE>
**Closed:** <DATE or —>

## Intent anchor
How "done" is defined for this book. One of:

- **PRD-backed** — `product-team/prd/<slug>.md` §<sections> (e.g. §8.1 In Scope / MVP). Completion is *computed*: every story tracing to these sections is `Done` and its epic is closed.
- **Acceptance frame (no PRD)** — the human's ask, restated and confirmed at kickoff. Completion is *judged* against the bullets below.

### Acceptance frame
*(Only when there is no PRD. A few bullets — what "done" means, in the human's own terms, confirmed at kickoff. This is the durable definition of done; it also doubles as the skeleton for the PRD seed at close.)*

- [ ] <observable outcome 1>
- [ ] <observable outcome 2>

## Epics in this book
- `<epic-slug>` — <one line>

## Direction mode (experiment) — pre-registered
*(Optional — one of the two Direction sections, never both; delete both for a human-gated book. Use THIS one when the harness itself is under test. Required fields: the hypothesis; an `### Arming` subsection with **Armed** / **Deadline** / **Baseline** / **Pinned governing versions** lines; the autonomy ceiling; decisions reserved for the operator; budgets/stopping rules; delegated open questions (exhaustive); success, failure, and outcome classification; the rollback procedure. Field semantics and the Armed-line format the skill parses: see `engineering-team/roles/director.md` and the worked example in `audits/task-timeline/book.md`.)*

## Direction mode (operational) — goal-derived
*(Optional — the other Direction section. Use THIS one when the question is "please do this work" rather than "does autonomous direction work." Every safety rule is identical to the pre-registered mode; only the source of the terms differs.)*

> **This section is GENERATED — derived from the goal below. Do not hand-edit it.**
> Terms are authored on the **goal**, never here. A hand-edit makes this file a second, competing source of intent, which is the defect this mode exists to remove (PRD §7.1). Regenerate it by re-deriving from the goal; a stale section halts the run rather than being quietly corrected. **Hand-editing this section is a review-blocking defect.**

### Provenance
- **Goal:** `<goal-slug>`
- **Derived at:** `<ISO-8601 UTC>`
- **Ratifying proposal:** `<proposalId>` — approved `<approvedOn>` · anchor `<anchor-slug>` at distance `<n>`
- **Deliverable, verbatim as derived:**
  > `<the goal's deliverable text, exactly as it stood at derivation>`
- **Boundary, verbatim as derived:**
  > `<the goal's boundary text, exactly as it stood at derivation>`

*(The two verbatim blocks are the run's durable record and its pin: when the goal changes later, they are what makes it possible to reconstruct what this run was actually told, and what the preflight compares against to detect that the terms have moved.)*

### Terms
- **The ask:** `<statement>`
- **Success criteria:** `<deliverable>`
- **Ceiling:** `<boundary>` — plus the standing autonomy ceiling; staging is the hard limit either way.
- **Estimate:** `<chanceOfSuccess, or "absent — the goal records none">`

### Knowingly surrendered in this mode
- **Baseline commit** — the `origin/staging` SHA at arming is not captured.
- **Pinned governing versions** — the SHAs of `roles/director.md`, the `direct-feature` skill, and `gate-judge.md` are not pinned.

Both buy reproducibility — knowing which Director ran under which rubric. That is an acceptable trade for operational work and *not* for experimental work, which is why the pre-registered mode above still exists and is unchanged.

### Unavailable
- **Estimate via the goals API** — `parseGoalRow` drops `chanceOfSuccess`; it is read here from the raw record. Dependency: `store-and-show-the-prompt-and-the-estimate`.
- **Prerequisites** — `dependsOn` exists on no goal and nowhere in the codebase.

## Provenance
- **Mode:** PRD-backed | Acceptance-frame | Reconstructed *(no anchor captured at kickoff — intent inferred from `_intake.md` + git at close)*
- **Confidence at close:** high | medium | low

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/<book-slug>/audit.md`
- Product feedback: `engineering-team/audits/<book-slug>/prd-addendum.md` | `prd-seed.md`
