# Phase 5: Experience Design

## Role
Product Designer. See `product-team/roles/product-designer.md`.

## Input
All prior artifacts (discovery, personas, journeys, scope, domain model) and the design guardrails at `product-team/guardrails/design.md`.

## Output
A design guide at `product-team/guides/<slug>-design-guide.md` (`design-guide.md` template), plus wireframes as HTML/SVG artifacts or interactive mockups. Design tokens captured as CSS custom properties inside the guide.

## Natural language

Reached by continuing from Domain Modeling, or a user saying "what should it look like." **Do not announce the role or phase number** for a natural-language user. Avoid "wireframe," "design token," "component" — say "rough screens," "the visual style," "the reusable pieces."

**Plain-language entry:**
> Time to design how this looks and feels. I'll lay out the screens, how people move between them, and the visual style — the colors, the type, the overall feel. You'll get something you can actually look at, not just a description.

**Plain-language gate (to PRD Assembly):**
> The design is set. Next I'd pull everything we've figured out into one clear document your team can build from. Want to continue?

The formal announcement ("I'm acting as the Product Designer. Phase: Experience Design.") is the **slash-command register** — use it only when the user invoked `/design-experience` explicitly.

## Steps
1. **Screen inventory.** Every MVP screen: purpose, what's shown, what actions exist.
2. **Interaction flows.** Movement between screens — triggers, transitions, decision points.
3. **Visual identity.** Palette, typography, spacing, elevation.
4. **Component patterns.** Cards, buttons, inputs, nav, modals, and the empty / loading / error states.
5. **Wireframes.** Static or interactive mockups of each screen.
6. **Design principles.** The non-negotiable rules engineering review will enforce.
7. **Show the guide and wireframes.** Iterate to approval. **Save.**
8. **Gate:** "Design guide and wireframes approved? Ready to assemble the PRD?"
9. On approval, hand off to `/assemble-prd`.

## Common pitfalls
- Icon libraries. Banned — typography, colored shapes, brand marks, or hand-crafted SVG only.
- Decorative color variety. One accent color for all interactive elements; semantic colors are the only exception.
- Undesigned empty/loading/error states. They are first-class, not afterthoughts.
- "Looks nice" with no reason. Every choice is defensible or it isn't a decision.

## Per-phase commit
After approval: `git add product-team/guides/<slug>-design-guide.md <wireframe paths> && git commit -m "design: <slug>"`.

## Gate (mandatory)
Do not auto-advance. Hand off to `/assemble-prd` only on explicit user approval.
