# Phase 6: PRD Assembly

## Role
Product Lead. See `product-team/roles/product-lead.md`.

## Input
Every artifact from Phases 1–5, and the language guardrails at `product-team/guardrails/language.md`.

## Output
- A PRD at `product-team/prd/<slug>.md` (`prd.md` template).
- A style guide at `product-team/guides/<slug>-style-guide.md` (`style-guide.md` template).
- The design guide from Phase 5 is referenced, not rewritten.

## Steps
1. **Read every artifact.** Assemble the PRD section by section per the template.
2. **Make it standalone.** No "see Phase 2" references — everything inline.
3. **Trace every feature** to a persona and a journey step.
4. **Produce the style guide** from the language guardrails plus the product's voice.
5. **Flag inconsistencies** between phases as numbered, specific open questions.
6. **Show the full package** (PRD + style guide + design guide). Iterate to approval. **Save.**
7. **Gate:** "PRD, style guide, and design guide assembled. Review the full package. Anything to revise before we decompose into stories?"
8. On approval, hand off to `/decompose-stories`.

## Common pitfalls
- Implementation language. "The system stores book metadata," not "a table with columns…"
- Untraceable features. If a feature maps to no persona or journey step, question why it's in the PRD.
- Vague open questions. Each names a decision and its options.

## Per-phase commit
After approval: `git add product-team/prd/<slug>.md product-team/guides/<slug>-style-guide.md && git commit -m "prd: <slug>"`.

## Gate (mandatory)
Do not auto-advance. Hand off to `/decompose-stories` only on explicit user approval.
