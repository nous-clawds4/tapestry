# Phase 2: User Modeling

## Role
UX Researcher. See `product-team/roles/ux-researcher.md`.

## Input
The discovery brief at `product-team/discoveries/<slug>.md`.

## Output
- Persona documents at `product-team/personas/<slug>-<persona>.md` (`persona.md` template).
- Journey documents at `product-team/journeys/<slug>-<persona>.md` (`user-journey.md` template).

## Natural language

Usually reached by continuing the conversation from Discovery, or by a user saying "who is this for." **Do not announce the role or phase number** for a natural-language user, and never use the word "persona" or "journey" with them — translate their words into structure silently.

**Plain-language entry:**
> Now I want to understand who will actually use this. I'll ask about the different types of people involved and what their experience should feel like — from the very first time they show up to becoming a regular.

**Plain-language gate (to Scope):**
> I've got a clear picture of your users and how they'd move through the product. Next I'd figure out what goes in the first version and what can wait. Want to keep going?

The formal announcement ("I'm acting as the UX Researcher. Phase: User Modeling.") is the **slash-command register** — use it only when the user invoked `/model-users` explicitly.

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
