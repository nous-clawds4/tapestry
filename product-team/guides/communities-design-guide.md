# Design Guide: Communities

**Slug:** communities
**Date:** 2026-06-05

> Visual rules, design tokens, component patterns, and wireframe references. Binding during engineering review. Honors `product-team/guardrails/design.md`. Built on the existing Brainstorm Communities visual identity (do not diverge).

## Design principles
Enforceable in review:

1. **Trust is shown, never asserted.** Membership and legitimacy are conveyed by *who-trusts-whom* signals, not badges we hand out. No blue checks.
2. **Trust is point-of-view.** Any trust figure is relative to *the viewer*. Pre-account, it falls back to a house/established view and is labeled as such — never shown as if it were absolute.
3. **Read-only first visit is first-class.** Discovery and the trust signal must render fully with **no account**. Sign-in is requested only at the moment of acting (found, fork, post).
4. **One accent for all interactive elements** (`--accent`, magenta). The royal `--brand` is for the mark only; semantic colors are the sole other exception. No decorative color variety, no icon libraries — typography, colored shapes, and hand-crafted SVG only.
5. **Empty, loading, and error states are designed**, never afterthoughts. Errors say what happened and what to do.
6. **No hardcoded values** — every color/space/radius/type value is a token.

## Visual identity
- **Color palette:** single accent **magenta `#ba20ba`** for all interactive elements; **royal `#662d91`** brand mark only; dark surfaces (`#0a0612` → `#1a1126`); semantic success/warning/error. Inputs use a distinct contrasting background (`--bg-input`).
- **Typography:** display = MuseoModerno (circle names, headings); body = DM Sans. Scale 11→64px (tokens below).
- **Spacing:** 4px base scale.
- **Elevation:** flat dark surfaces differentiated by background step, not heavy shadows; a single soft shadow for overlays/menus.

## Design tokens
Reuse the app's existing custom properties (do not introduce new raw values):

```css
:root {
  /* color */
  --accent: #ba20ba;
  --accent-hover: #d234d2;
  --accent-pressed: #9a1a9a;
  --accent-muted: rgba(186, 32, 186, 0.12);
  --accent-glow: rgba(186, 32, 186, 0.45);
  --brand: #662d91;        /* mark only — not an interactive accent */
  --brand-soft: #7d44ad;
  --bg: #0a0612;
  --bg-surface: #120a1c;
  --bg-elevated: #1a1126;
  --bg-hover: #221830;
  --bg-input: #0f0918;
  --text: #f4f0fa;
  --text-secondary: #b8aec9;
  --text-muted: #8a809a;
  --text-faint: #5a526a;
  --text-on-accent: #ffffff;
  --success: #3ec98a;      /* trusted / belongs */
  --warning: #fbb03b;      /* marigold — caution only (e.g. stale/unverified), never an accent */
  --error: #e0566b;
  /* spacing (4px base) */
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px; --space-5: 24px; --space-6: 32px;
  /* radius */
  --radius-sm: 6px; --radius-md: 10px; --radius-lg: 16px; --radius-full: 999px;
  /* type */
  --font-body: 'DM Sans', system-ui, sans-serif;
  --font-display: 'MuseoModerno', var(--font-body);
  --text-xs: 11px; --text-sm: 13px; --text-base: 15px; --text-md: 16px; --text-lg: 18px; --text-xl: 22px;
  --text-display: 48px; --text-display-xl: 64px;
}
```

## Component patterns

### Trust Signal *(the load-bearing novel component)*
- **Visual:** a compact cluster — a short row of overlapping member avatars + a line of text. Signed-in: **"N people you trust are inside"** in `--accent`. Signed-out: **"N established members"** in `--text-secondary`, with a small "Sign in to see who *you* trust" hint. A subtle accent ring strength can scale with how trusted the circle is from the viewer's POV.
- **Behavior:** recomputes per viewer on sign-in (the signed-out house view re-resolves to the personal view). On a member row, a trusted member shows a quiet `--success` dot + "trusted by people you trust"; an impersonator/untrusted account shows **no** dot and a muted "no one you trust vouches for them" — weightless, not alarming.
- **Empty / loading / error:** *Empty* — "No established members yet — be the first to belong." *Loading* — avatar-and-line shimmer (never a bare spinner). *Error* — "We couldn't reach the trust network. Showing names without trust signal. Retry?" (degrade to names, never block the page).

### Circle Card (discovery)
- **Visual:** name in display font, one-line purpose, topic chips, and the Trust Signal cluster. Accent border on hover/focus.
- **Behavior:** entire card is a link to the circle; works fully signed-out.
- **Empty / loading / error:** *Empty grid* — "No circles yet. Start the first one." with a primary Found-a-circle action. *Loading* — 6–8 card skeletons. *Error* — `FetchError` with Retry.

### Circle Definition panel (purpose + belonging-bar)
- **Visual:** the circle's purpose and **belonging-bar** ("what it takes to belong") shown as plain prose, not a settings table. If the circle **stands on** another, a quiet "Based on *‹parent circle›*" link.
- **Behavior:** read-only to all; the founder sees an edit affordance (overrides only; inherited fields shown as inherited).
- **Empty / loading / error:** *Loading* — text shimmer. *Error* — inline "Couldn't load this circle's definition. Retry?"

### Composer + Post
- **Visual:** distinct input background (`--bg-input`); primary Send in `--accent`.
- **Behavior:** signed-out → a "Sign in to post" prompt in the composer's place (no disabled-button tease). MVP gate is interim (see scope); the composer shape is unchanged when trust-membership lands.
- **Empty / loading / error:** *Empty* — "No posts yet. Start the conversation." *Loading* — 3 post skeletons. *Error* — per-post inline error + Retry.

### Found / Fork flow (stepper)
- **Visual:** a short multi-step flow (Name → Purpose → Belonging-bar → Review), display-font headers, progress dots in `--accent`.
- **Behavior:** **Found** starts blank; **Fork** pre-fills the parent circle's resolved definition and marks every field as "inherited — edit to override." A persistent "Based on ‹parent›" banner. Sign-in requested only at the final publish step (state preserved).
- **Empty / loading / error:** *Error on publish* — specific copy by failure (couldn't reach the network / signing cancelled / try again), never "something went wrong."

## Screen inventory

| Screen | Purpose | Wireframe |
|---|---|---|
| Discover | Read-only circle grid + Trust Signal; entry to Found | `communities-wireframes.html#discover` |
| Circle detail | Read-only definition + members (trust-legible) + posts; Fork + sign-in-to-act | `communities-wireframes.html#circle` |
| Found a circle | Declare a new definition (stepper) | `communities-wireframes.html#found` |
| Fork a circle | Stand on a parent's definition, edit overrides | `communities-wireframes.html#fork` |
| Sign-in prompt | Requested at the moment of acting | `communities-wireframes.html#signin` |

## Responsive behavior
- **Mobile (<640px):** single-column circle list; Trust Signal collapses to "N you trust" + 3 avatars; stepper is full-screen one-step-per-view.
- **Tablet (640–1024px):** 2-column grid.
- **Desktop (>1024px):** 3-column grid; circle detail is a two-pane (definition + conversation).

## Accessibility baseline
- **Contrast:** body text ≥ 4.5:1, large text / UI elements ≥ 3:1. White-on-accent (`#fff` on `#ba20ba`) verified for buttons.
- **Touch targets:** ≥ 44×44px.
- **Keyboard:** full keyboard nav; visible `--accent` focus ring on every interactive element; the Trust Signal's meaning is available as text (not color alone) — the `--success` dot is always paired with a label.
- **Color independence:** trusted/untrusted is never conveyed by color alone (dot + text label).
