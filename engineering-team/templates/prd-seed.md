# PRD Seed: <inferred product name>

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/<book-slug>/audit.md`
**Anchor:** acceptance frame in `book.md` | none *(reconstructed from `_intake.md` + git)*
**Confidence:** high | medium | low
**Date:** <DATE>

> This is a **reverse-engineered baseline** in the product-team PRD shape, built from what shipped. It is a *strawman for the product team*, not a ratified spec. Every section is tagged — `[FROM FRAME]` (grounded in the kickoff acceptance frame), `[INFERRED]` (read off the as-built system), or `[UNKNOWN — product input needed]`. The product team adopts this as the starting point for `/discover` on the next phase and validates each section. **Be honest about confidence:** a no-anchor reconstruction is a hypothesis, not ground truth — don't dress it up.

## 1. Product vision
`[INFERRED]` what the built product appears to do, and for whom. `[UNKNOWN]` the underlying problem/opportunity if it was never stated.

## 2. Personas
`[INFERRED]` from story "As a <user>" lines and the acceptance frame. Behavior-based. Flag the guesses.

## 3. Scope (as-built)
`[FROM FRAME]` / `[INFERRED]` everything that actually shipped, framed as the current in-scope set.

## 4. Domain model
`[INFERRED]` from concepts touched (`kind:pubkey:slug`), ADRs, and stored shapes — entities, attributes, relationships.

## 5. Design rules (as-built)
`[INFERRED]` from the shipped UI, any guides, and review notes. Flag where no rule was ever recorded.

## 6. Carry-forward & open questions
Promoted from build audit §6 — the obvious candidates for the next phase.

## 7. What product must validate
The `[INFERRED]` / `[UNKNOWN]` items that need a human product decision before this seed becomes a real PRD.
- [ ] <item>
