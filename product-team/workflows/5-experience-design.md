# Phase 5: Experience Design

## Role
Product Designer. See `product-team/roles/product-designer.md`.

## Input
All prior artifacts (discovery, personas, journeys, scope, domain model) and the design guardrails at `product-team/guardrails/design.md`.

## Output
A design guide at `product-team/guides/<slug>-design-guide.md` (`design-guide.md` template), plus wireframes as HTML/SVG artifacts or interactive mockups. Design tokens captured as CSS custom properties inside the guide.

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
