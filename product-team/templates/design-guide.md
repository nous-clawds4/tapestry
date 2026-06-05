# Design Guide: <Product Name>

**Slug:** <slug>
**Date:** <DATE>

> Visual rules, design tokens, component patterns, and wireframe references. Binding during engineering review. Honors `product-team/guardrails/design.md`.

## Design principles
The non-negotiable rules that govern every visual decision. Each one is enforceable in review.

-

## Visual identity
- **Color palette:** the accent color and the semantic colors (success / warning / error). One accent for all interactive elements.
- **Typography:** type families, scale, weights.
- **Spacing:** the spacing scale.
- **Elevation:** the shadow / layering model.

## Design tokens
CSS custom properties. Components reference these — never a raw hex or pixel value.

```css
:root {
  /* color */
  --accent: ;
  --bg: ;
  --surface: ;
  --text: ;
  --success: ;
  --warning: ;
  --error: ;
  /* spacing */
  --space-1: ;
  --space-2: ;
  /* radius */
  --radius: ;
  /* type */
  --font-body: ;
  --font-display: ;
}
```

## Component patterns
For each: visual treatment and behavior. Include the empty, loading, and error states.

### <Component>
- **Visual:**
- **Behavior:**
- **Empty / loading / error:**

## Screen inventory
Every MVP screen, with a wireframe reference.

| Screen | Purpose | Wireframe |
|---|---|---|
| <name> | | <path or link> |

## Responsive behavior
What happens at mobile, tablet, desktop widths.

## Accessibility baseline
Contrast ratios, touch-target sizes, keyboard-navigation assumptions.
