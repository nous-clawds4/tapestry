# Design Guardrails

These rules apply to every design decision made during the product process and carry into the design guide the engineering team builds from.

## Structural principles
- **No icon libraries.** Every visual indicator is typography, a colored shape, a brand mark, or a hand-crafted SVG. Generic icon kits (Tabler, Lucide, FontAwesome, Heroicons) produce generic products.
- **One accent color.** The brand accent is used for all interactive elements. Semantic colors (success, warning, error) are the only exceptions. No decorative color variety.
- **Form inputs are visually distinct from the page.** Inputs use a contrasting background so the user immediately sees where they can type.
- **Empty states are designed.** Every screen that can be empty has a designed empty state that explains what will appear and how to start.
- **Loading states are designed.** Every async operation has at minimum a skeleton or shimmer — never a bare spinner with no context.
- **Error states are helpful.** Every error says what went wrong and what to do about it. "Something went wrong" is never acceptable.

## Engineering-facing principles (communicated via the design guide)
- **Clean modular design.** Components are self-contained. A button component doesn't know what page it's on.
- **Minimal coupling.** Changing one component doesn't require changing another. Shared state is explicit and documented.
- **Zero tech debt by design.** No "we'll fix it later" hacks. If the right solution is too expensive for MVP, defer the *feature* rather than ship a hack.
- **No hardcoded values in components.** Colors, spacing, typography, and radii come from design tokens (CSS custom properties). A component never contains a hex color or a pixel value that isn't a token reference.

## Where these are enforced
- The **Product Designer** honors them in Phase 5 and encodes them as the design guide's "Design principles."
- The **engineering team's Reviewer** checks the implementation against the design guide during `/review-changes`.
