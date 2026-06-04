# Phase 6: PRD Assembly

## Role
Product Lead. See `product-team/roles/product-lead.md`.

## Input
Every artifact from Phases 1–5, and the language guardrails at `product-team/guardrails/language.md`.

## Output
- A PRD at `product-team/prd/<slug>.md` (`prd.md` template).
- A style guide at `product-team/guides/<slug>-style-guide.md` (`style-guide.md` template).
- The design guide from Phase 5 is referenced, not rewritten.

## Natural language

Reached by continuing from Experience Design, or a user saying "put it all together" / "write it up." **Do not announce the role or phase number** for a natural-language user. "PRD" is fine to name, but explain it the first time as "one document that captures the whole product."

**Plain-language entry:**
> Let me pull everything we've figured out into one clear document — the problem, the people, the features, the design — so anyone on your team can pick it up and understand the whole product. I'll also write down the language and design rules so it all stays consistent.

**Plain-language gate (to Story Decomposition / engineering handoff):**
> The product work is complete. Here's your full write-up, plus the language and design guides. When you're ready to start building, I can break this into a sequence of engineering tasks and hand it to the engineering team. Want to do that now, or review the documents first?

The formal announcement ("I'm acting as the Product Lead. Phase: PRD Assembly.") is the **slash-command register** — use it only when the user invoked `/assemble-prd` explicitly.

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
