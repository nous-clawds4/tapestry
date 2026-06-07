# Design Guide: Verified Reporters

**Slug:** verified-reporters
**Date:** 2026-06-07

> Visual rules, design tokens, component patterns, and wireframe references. Binding during engineering review. Honors `product-team/guardrails/design.md`.
> Wireframes: [`verified-reporters-wireframes.html`](./verified-reporters-wireframes.html)

## Grounding — mirror, don't invent
This feature is a deliberate parallel to the existing **Following** / **Verified Followers** counts and the **Following list** page. It reuses, and must not diverge from, the live components in the `ui/` React app:

- Profile counts row: `.bsp-counts` → `.bsp-count.bsp-count-link` → `.bsp-count-value` + `.bsp-count-label` ([BrainstormProfile.jsx](../../ui/src/pages/BrainstormProfile.jsx)).
- List page shell: `.bsp-page` / `.bsp-top-bar` / `.bsp-content`, `.bsp-follows-header` (back-link + title + ⓘ info button), search + Columns toggle, `DataTable`, and the **"About this data" popover** ([BrainstormFollows.jsx](../../ui/src/pages/BrainstormFollows.jsx)).
- Route pattern: `/user/:pubkey/follows` → **new sibling route `/user/:pubkey/reporters`** ([App.jsx](../../ui/src/App.jsx)).
- The `verifiedReporterCount` metric **already exists** (per-PoV, namespaced `wot_verifiedReporterCount_<povSuffix>`) and already renders as a 🚩 "Reporters" trust card. The new work is (a) elevating it to a clickable count and (b) a list of *who* reported.

**Design-time assumption (flag for the architect):** the reference profile on staging shows Following *and* Verified Followers as parallel count-links. On the `feat/communities` branch, Verified Followers currently renders as a trust *card*. Verified Reporters should match **Verified Followers' treatment, whatever it is at implementation time** — placed parallel to it. Elevating Verified Followers itself is out of scope here.

## Design principles
Non-negotiable; enforced in engineering review.

1. **Parallel, not novel.** The Verified Reporters count and list reuse the exact components, classes, spacing, and route shape of Following / Verified Followers. A reviewer should not be able to tell the two features were built at different times.
2. **Negative signal by color, meaning by word.** The count is marked negative with the existing **`--red`** semantic (the app already encodes "report" as red). Color never carries the meaning *alone* — the label word "Reporters" carries it; red reinforces. (Accessibility + the warning reading both hold.)
3. **No silent global numbers.** Every surface that shows the count states whose PoV produced it. Personal PoV is the default and needs no shouting; **House fallback is always labeled**, never silent.
4. **Zero is reassurance, not a warning.** A real "0" renders neutral (not red) and is visually distinct from "—" (not computed / unavailable). Three distinct states: `> 0` (red, linked), `0` (neutral, not linked), `unavailable` (`—`, muted).
5. **Every state is designed.** Empty, loading (skeleton, not a bare spinner), and error (helpful, with a retry) are first-class for both the count and the list.
6. **Tokens only.** No hex or px literals in components — reference the CSS custom properties below. (Note: the existing Report button hardcodes `#ef4444`; the count should use the `--red` token instead.)
7. **No icon libraries.** Indicators are typography, the existing unicode glyphs the app already uses (🚩 ⓘ 🔒), colored shapes, or hand-crafted SVG. No Tabler/Lucide/etc.

## Visual identity
Inherits the app's GitHub-dark identity verbatim — this feature introduces **no new identity**, only a semantic application of the existing one.

- **Color palette:** one accent `--accent` `#58a6ff` for all interactive elements (the count *link* affordance). Semantic colors are the only exception: `--green` success, `--orange` warning, `--red` error/negative. The Verified Reporters value uses **`--red`** as a negative/danger semantic — consistent with the existing Report action.
- **Typography:** inherits the app body font. Count value: 0.9rem, weight 600. Count label: 0.9rem, opacity 0.6. List title: 1.4rem. No new families.
- **Spacing:** the counts row uses `gap: 0.6rem`, `margin: 0.5rem 0 0.25rem` (existing `.bsp-counts`). List page inherits `.bsp-content` rhythm.
- **Elevation:** flat, as the app is. Cards/popovers use the existing subtle `rgba(255,255,255,0.03–0.06)` surfaces and the `.bsp-confirm-overlay` modal layer for the popover.

## Design tokens
Existing app tokens (from `ui/src/styles.css :root`). Components reference these — never a raw value.

```css
:root {
  /* color */
  --accent: #58a6ff;          /* all interactive elements (link affordance) */
  --accent-hover: #79c0ff;
  --bg: #0d1117;
  --surface: #161b22;          /* --bg-secondary */
  --surface-2: #21262d;        /* --bg-tertiary */
  --border: #30363d;
  --text: #e6edf3;
  --text-muted: #8b949e;
  --green: #3fb950;            /* success */
  --orange: #d29922;           /* warning */
  --red: #f85149;             /* error / negative — the Verified Reporters signal */
  /* radius */
  --radius: 8px;               /* matches .bsp-trust-card */
}
```

This feature adds **no new tokens**. If a negative-surface tint is ever needed, derive it as `rgba(248,81,73,0.1)` (token-driven), mirroring the Report button's `rgba(239,68,68,0.1)`.

## Component patterns

### Verified Reporters count (on the profile)
- **Visual:** a `.bsp-count` inside the existing `.bsp-counts` row, placed parallel to Following / Verified Followers. Structure: `<value> <label>`. Label: **"Verified Reporters"**. When `> 0`, the value uses `--red` and the whole item is a `.bsp-count-link` (`<Link>` to `/user/:pubkey/reporters`); hover underlines the value (existing rule).
- **Behavior:** clicking navigates to the Verified Reporters list. Accessible name conveys PoV, e.g. `title`/`aria-label`: *"3 verified reporters in your web of trust — view list"* (personal) or *"…in the House (default) web of trust…"* (fallback).
- **PoV attribution (lightweight):** when the **House fallback** is active, append a small muted **"House"** qualifier chip to the label so the fallback is never silent even at a glance. Personal PoV shows no chip (it is the expected default). Full attribution lives on the list page.
- **States:**
  - **`> 0`:** red value, linked. (`3 Verified Reporters`)
  - **Zero:** neutral value (inherits `--text`), **not** a link — there is nothing to inspect. (`0 Verified Reporters`) This *is* the count's empty state.
  - **Loading:** reuse `.bsp-counts-loading` (value at opacity 0.4).
  - **Unavailable / not computed:** render `—` (existing `fmtCount(null)`), muted, not a link.

### Verified Reporters list page (`/user/:pubkey/reporters`)
- **Visual:** clone of the Following page. `.bsp-follows-header` with `← Back to profile`, title **"Verified Reporters"**, and the ⓘ info button. A one-line muted **subtitle**: *"Verified users who have reported this account."* Below it, the **PoV attribution line** (see below). Then the existing controls (search + Columns toggle) and the `DataTable`.
- **Columns:** reuse the existing column set. **Default visible:** Picture, Name, **Rank**. Optional (hidden) : npub, Hops, Verified Followers/Muters/Reporters. **Rank is the credibility weight** — it is what lets the Vetting Observer judge *whose* report this is.
- **Default sort:** **Rank (influence) descending** — most credible reporters first, so "is this flagged by people who matter?" is answerable at a glance. (Deliberately differs from Following's sort, which is by verified-follower count.)
- **Row behavior:** clicking a row navigates to that reporter's profile (`/user/:pubkey`) so the observer can vet the reporter.
- **PoV attribution (primary home):** a visible line under the subtitle:
  - Personal: *"Relative to your web of trust."*
  - House fallback: *"Relative to the House (default) web of trust. Sign in and build your network to see your own view."* — styled muted, but always present.
  - The ⓘ **"About this data" popover** is extended to explain: data is computed locally (existing copy) **plus** "Counts are personal to each viewer's web of trust — there is no single global number."
- **States:**
  - **Empty (zero reporters):** designed `.bsp-empty`: *"No verified reporters. No one in this web of trust has reported this account."* Never blank.
  - **Loading:** a **skeleton table** (3–5 shimmer rows matching column layout), not the bare "Loading…" text — upgrades the guardrail bar over the existing text loader.
  - **Error:** `.bsp-trust-unavailable` with 🔒 and a *helpful* message + retry: *"Couldn't load reporters — {reason}. Try again."* Never "Something went wrong."

### About-this-data popover
- **Visual/behavior:** reuse `InfoPopover` (`.bsp-confirm-overlay` / `.bsp-confirm-box`) verbatim. Tap ⓘ to open, tap outside or "Got it" to close (mobile-friendly). Content extended with the PoV / no-global-view sentence.

## Screen inventory
| Screen | Purpose | Wireframe |
|---|---|---|
| Profile — counts row (with Verified Reporters) | Surface the PoV-filtered count parallel to Following/Verified Followers; entry to the list | [verified-reporters-wireframes.html](./verified-reporters-wireframes.html) §A |
| Verified Reporters list (`/user/:pubkey/reporters`) | Inspect *which* verified users reported the account, weigh them by Rank | [verified-reporters-wireframes.html](./verified-reporters-wireframes.html) §B |
| List — empty / loading / error / House-PoV | Designed non-happy states | [verified-reporters-wireframes.html](./verified-reporters-wireframes.html) §B |

## Responsive behavior
- **Mobile (≤ 600px):** counts row wraps (existing `flex-wrap: wrap`); the new count never truncates — it wraps to its own line if needed. List page shows only Picture/Name/Rank (the defaults), search goes full-width, the Columns menu remains reachable. Count link and table rows are ≥ 44px touch targets.
- **Tablet (601–960px):** counts inline; list table as-is with default columns.
- **Desktop (> 960px):** unchanged from the existing pages; optional columns available via the toggle.

## Accessibility baseline
- **Contrast:** red value `--red` `#f85149` on `--bg` `#0d1117` ≈ **5.4:1** — passes AA for the 600-weight value. Muted label (opacity 0.6) must resolve to ≥ 4.5:1; matches the existing Following label.
- **Color is never the only signal:** the label word "Verified Reporters" and the numeric value carry meaning independent of red; the House qualifier is a word, not a color.
- **Keyboard:** the count is a real `<Link>` (focusable, Enter-activates); the ⓘ button and rows are keyboard-operable (existing behavior).
- **Touch targets:** ≥ 44×44px for the count link, the ⓘ button, and table rows.
- **Screen readers:** the count's `aria-label` states the number *and* the PoV; the PoV line is real text in the DOM, not an icon.
