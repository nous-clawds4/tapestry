# Phase 2: User Modeling

## Role
UX Researcher. See `product-team/roles/ux-researcher.md`.

## Input
The discovery brief at `product-team/discoveries/<slug>.md`.

## Output
- Persona documents at `product-team/personas/<slug>-<persona>.md` (`persona.md` template).
- Journey documents at `product-team/journeys/<slug>-<persona>.md` (`user-journey.md` template).

## Steps
1. **Read the discovery brief.** Propose initial personas from its user landscape.
2. **Define each persona:** who they are (behavior), what they want (one sentence), their core loop, what they won't tolerate.
3. **Write the journey** for the primary persona (and optional secondaries): trigger, action, expected experience, emotional state at each step. Include the first-visit experience.
4. **Show the drafts.** Iterate to approval.
5. **Save** the files.
6. **Gate:** "Personas and journeys documented. Ready to define scope?"
7. On approval, hand off to `/scope`.

## Common pitfalls
- Demographic personas. Use behavior. "Reads 100 books a year and argues about genre" — not "Female, 28–45."
- Skipping the first-visit experience. If value requires an account, flag it as a design problem.
- More than four personas. That usually means the product is too broad — flag it.

## Per-phase commit
After approval: `git add product-team/personas/<slug>-*.md product-team/journeys/<slug>-*.md && git commit -m "user-modeling: <slug>"`.

## Gate (mandatory)
Do not auto-advance. Hand off to `/scope` only on explicit user approval.
