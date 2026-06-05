# PRD Addendum: <product slug> — <book title>

**Reconciles:** `product-team/prd/<slug>.md` *(immutable — never edited)*
**Build audit:** `engineering-team/audits/<book-slug>/audit.md`
**Date:** <DATE>
**Authored by:** engineering (Reviewer at book scope)

> This addendum stands **beside** the original PRD; it never edits it. It records where the built product diverged from the plan, why, and what the next product cycle should pick up. The product team reads this when scoping the next phase, then issues a superseding `prd/<slug>-v2.md`. Engineering does not write into `product-team/` — this is the read-across-the-boundary return edge, mirroring how engineering reads the product team's `stories-queue.md`.

## 1. Summary
2–4 sentences: what this book set out to do (per the PRD), what actually shipped, and the headline divergences.

## 2. Deviations from the PRD
Promoted from build audit §4, framed for product — **impact-first, not implementation-first.**

### 2.1 Intentional changes
What we built differently on purpose, with PRD §ref and rationale.

### 2.2 Deferred (cut to a later phase)
PRD scope that did **not** ship, and the phase it's now assigned to. *(An un-phased deferral is a graveyard — give each a home.)*

### 2.3 Added beyond the PRD
Capabilities that shipped but weren't in the PRD. Why they were necessary; whether they should be ratified into the product model.

### 2.4 Constraints discovered
Where the PRD was infeasible as written, and what that implies for the product's assumptions (personas, journeys, domain model).

## 3. Impact on the product model
Which PRD sections the next version must revise:
- **Personas / journeys:** <if any deviation changes them>
- **Scope / roadmap:** <reslotted items, new phase boundaries>
- **Domain model:** <entities/relationships that changed shape in practice>
- **Design rules:** <guide rules that proved wrong or incomplete>

## 4. Recommended scope for the next phase
Engineering's read on what the carry-forward register implies — **input, not decision.** The product team owns the actual re-scope.
- <recommendation> (from audit carry-forward #<n>)

## 5. Open questions for product
Numbered, specific decisions the next product cycle must make.
1. <question> — options: <A / B>.
