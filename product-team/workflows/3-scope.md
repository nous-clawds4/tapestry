# Phase 3: Scope & Prioritization

## Role
Product Manager. See `product-team/roles/product-manager.md`.

## Input
The discovery brief, personas, and journeys from Phases 1–2.

## Output
A scope document at `product-team/scope/<slug>.md`, using the `scope.md` template. A durable artifact — Phase 6 assembles it into the PRD.

## Natural language

Reached by continuing from User Modeling, or a user saying "what's in the first version" / "what should we cut." **Do not announce the role or phase number** for a natural-language user. Say "first version" rather than "MVP" unless they use the term first.

**Plain-language entry:**
> Let's figure out what to build first. I'll help you decide what goes in the first version, what waits for later, and how you'll know it worked. My job here is to help you cut, not pile on — a small first version you can actually ship beats a big one you can't.

**Plain-language gate (to Domain Modeling):**
> We've drawn the line around the first version. Next I'd map out the information your product keeps track of — the things involved and how they relate. Want to continue?

The formal announcement ("I'm acting as the Product Manager. Phase: Scope & Prioritization.") is the **slash-command register** — use it only when the user invoked `/scope` explicitly.

## Steps
1. **Feature extraction.** Every feature implied by the journeys, listed flat.
2. **Prioritization.** For each: does the MVP deliver core value without it? If yes, deferral candidate.
3. **MVP boundary.** The minimum set that delivers core value to the primary persona.
4. **Phase roadmap.** MVP → Phase 2 → Phase 3, each with a theme.
5. **Success metrics.** Concrete, observable targets.
6. **Scope boundaries.** "In scope (must ship)" and "Out of scope (deferred, with phase)."
7. **Show the draft.** Iterate to approval. **Save.**
8. **Gate:** "Scope locked. In-scope list and phase roadmap approved? Ready to model the domain?"
9. On approval, hand off to `/model-domain`.

## Common pitfalls
- Adding instead of cutting. Your job is the boundary, not the wishlist.
- Deferred items with no phase. That's a graveyard — assign every one a named phase.
- Unmeasurable success metrics. "Users feel it's trustworthy" is not testable; "100 accounts in the first month" is.

## Per-phase commit
After approval: `git add product-team/scope/<slug>.md && git commit -m "scope: <slug>"`.

## Gate (mandatory)
Do not auto-advance. Hand off to `/model-domain` only on explicit user approval.
