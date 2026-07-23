# Design Guide: Second Brain (display name: "Tapestry Harness")

**Slug:** second-brain
**Date:** 2026-07-21

> Visual rules, design tokens, component patterns, and wireframe references. Binding during engineering review. Honors `product-team/guardrails/design.md`.
> Wireframes: [`second-brain-wireframes.html`](./second-brain-wireframes.html)

## Grounding — mirror, don't invent

The v1 surface is **a view inside the existing owner-gated control panel**, not an app. It inherits the app's GitHub-dark identity and token set verbatim (the verified-reporters precedent: a reviewer should not be able to tell this was built at a different time). This product introduces **no new visual identity and no new tokens** — only three owner-facing views and a handful of components, all owner-gated. Nothing here ever appears on the visitor-facing search surface.

## Design principles

Non-negotiable; enforced in engineering review.

1. **A review loop, not a dashboard.** Every screen answers one owner question — "what do I have?", "what next?", "what happened?" — with one primary action. No metrics walls, no vanity charts, no graph-visualization canvas (the existing concept pages remain the browse surface for graph structure).
2. **Comparisons, not decimals.** Relative value renders as plain comparative language ("proposed over X because…"), never as gauges, sliders, stars, or falsely precise numbers. Until calibration proves a score means something, showing it as a number is a design defect.
3. **One spine.** Everything that happened — proposals, decisions, work — renders attached to the goal it served. The owner never assembles a story across surfaces.
4. **Plain language on every owner-facing string.** The register rule from the journeys is a *visual* rule here: questions and confirmations are single sentences; no jargon ("element," "kind," "schema") in any owner-visible label. A jargon word in the UI fails review.
5. **Skip-with-reason is a first-class control.** The skip affordance is as prominent as approve, and its one-line reason field is required — it is the calibration instrument, not an afterthought.
6. **Pointer cards open native.** A resource card shows identity + freshness and opens the resource in its own home (editor, vault, client, browser). No embedded viewers of any kind.
7. **Empty states are the onboarding.** The cold-start view (Second Operator journey, step 1) is designed first: an empty brain states what will appear and offers exactly one action — capture a goal in plain words.
8. **Tokens only; no icon libraries.** Indicators are typography, the unicode glyphs the app already uses (ⓘ ▸ ●), colored shapes, or hand-crafted SVG. No hex/px literals in components.
9. **The do-not-design list is binding:** no agent chat UI, no score gauges, no publish/privacy toggle (v1 privacy is a convention — the only honest treatment is a quiet indicator line, not a control), no health/monitoring surfaces, nothing visitor-facing.

## Visual identity

Inherits the app's identity verbatim; semantic application only.

- **Color palette:** one accent `--accent` for all interactive elements (links, buttons, focus). Semantic colors only as exceptions: `--green` (achieved standing, approve confirmation), `--orange` (stale pointer freshness), `--red` (dead pointer, error states). Standing and freshness are always carried by the **word**, with color reinforcing — never color alone.
- **Typography:** app body font throughout. View title 1.4rem; goal name 1rem weight 600; metadata 0.85rem muted; the proposal's why-now is body-size (1rem) — it is content, not chrome.
- **Spacing:** existing `.bsp-content` rhythm; cards on an 8px scale (`--space-2` multiples); tree indentation 20px per depth level.
- **Elevation:** flat, as the app is; cards use the existing subtle surface tints; no shadows beyond the existing modal layer.

## Design tokens

Existing app tokens (from `ui/src/styles.css :root`) — this product adds **no new tokens**. One derived tint is permitted for the open-proposal card emphasis, token-driven: `rgba(88,166,255,0.08)` (the accent at 8%).

```css
:root {
  /* color — inherited, reference only */
  --accent: #58a6ff;          /* all interactive elements */
  --accent-hover: #79c0ff;
  --bg: #0d1117;
  --surface: #161b22;
  --surface-2: #21262d;
  --border: #30363d;
  --text: #e6edf3;
  --text-muted: #8b949e;
  --green: #3fb950;            /* achieved / approve */
  --orange: #d29922;           /* stale */
  --red: #f85149;              /* dead / error */
  /* radius */
  --radius: 8px;
  /* spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 16px;
  --space-4: 24px;
}
```

## Component patterns

### Goal row (tree item)
- **Visual:** disclosure glyph `▸` (rotates 90° open) + goal name (600) + standing word in muted small caps (`captured / viable / achieved / abandoned`; achieved in `--green`, abandoned muted) + category chip (surface-2 pill, 0.8rem) + pointer count as text ("3 pointers"). Children indent 20px.
- **Behavior:** row click opens Goal detail; disclosure toggles children without navigation. Standing is derived, so it renders read-only — there is no status dropdown anywhere in v1.
- **Empty / loading / error:** a goal with no children and no deliverable shows an inline muted hint "needs a deliverable and boundary before it can be proposed." Loading: three skeleton rows with name-width shimmer bars. Error: inline row "Couldn't load this goal's details — retry" with retry as the accent link.

### Pointer card (External Resource)
- **Visual:** kind marker as typography (`file` `vault` `event` `repo` `web` — 0.75rem uppercase muted, no icons) + title (600, accent link) + locator preview (truncated middle, monospace 0.8rem muted) + freshness line ("verified 3 days ago" muted; "not verified in 40 days" in `--orange`; "unreachable at last check" in `--red`). Optional why-kept as one italic line.
- **Behavior:** title opens the resource in its native home (new tab / OS handler). No preview, no embed.
- **Empty / loading / error:** goal with no pointers: "Nothing attached yet — resources this goal needs will appear here." Loading: two skeleton cards. Error: the freshness line doubles as the error surface (states what failed and when).

### Proposal card
- **Visual:** the emphasis card of the product — accent-tinted background (the one derived tint), `--radius`, `--space-3` padding. Contents top-down: "**Next:** {goal name}" · why-now as 1–2 body sentences · a "considered instead" block listing exactly the passed-over goals, each one line: name + muted why-not · action row.
- **Behavior:** two equal-weight buttons: **Approve** (accent, solid) and **Skip…** (accent, outline — ellipsis signals a reason is coming). Approve confirms in one quiet sentence and the card retires to the goal's record. Skip expands the inline reason field (see below). Open proposals sort newest-first; a decided proposal never renders in the queue again.
- **Empty / loading / error:** queue empty: "No proposal right now — the next one appears when there are viable goals to choose between." Loading: one skeleton card with three shimmer lines. Error: "The proposer couldn't run — its last message: {plain-English reason}. Nothing was decided for you."

### Skip-with-reason (inline)
- **Visual:** a single-line input on the contrasting input background (guardrail: inputs visually distinct), placeholder "why not this one, in a few words", with **Skip** (accent) and **Cancel** (text link).
- **Behavior:** reason required — Skip stays disabled until non-empty; Enter submits; Escape cancels. On submit, one quiet sentence: "Skipped — noted."

### Capture confirmation
- **Visual/behavior:** capture happens in conversation, not in this UI; when the view is open during a capture, the new goal row appears with a 2-second `--surface-2` highlight fade. Any in-view confirmation is one plain sentence, never a record dump or a toast stack.

### Record entries (on Goal detail)
- **Visual:** a single chronological list under the goal — each entry one line + optional expandable body: date (muted, absolute) · type word (`proposed / approved / skipped / worked / noted`) · one-sentence summary. Work entries list produced pointers as pointer cards.
- **Behavior:** append-only rendering — no edit affordances on record entries, ever (the ledger is the ledger).

## Screen inventory

| Screen | Purpose | Wireframe |
|---|---|---|
| Goals view | The tree: capture's landing place; browse, filter by category | `second-brain-wireframes.html` §1 |
| Goal detail | One goal's intent + pointers + its full record on one spine | `second-brain-wireframes.html` §2 |
| Proposal queue | Open "what next?" proposals; approve / skip-with-reason | `second-brain-wireframes.html` §3 |
| Cold start (empty state of Goals view) | The onboarding: one action, plain words | `second-brain-wireframes.html` §4 |

Morning-review digest is **Phase 3** and not designed here.

## Responsive behavior

Desktop-first (an owner tool). ≥1024px: Goals view and detail may sit two-column (tree left 320px, detail right). 768–1024px: single column, detail replaces tree with a back link. <768px: cards go full-bleed with `--space-3` gutters; the proposal action row stacks (Approve above Skip); tree indentation drops to 12px. Nothing hides — everything reflows.

## Accessibility baseline

- Contrast: inherited token pairs already meet WCAG AA on `--bg`/`--surface` (text 12.9:1, muted 4.6:1); semantic words never rely on color alone (principle 2/4).
- Touch targets ≥ 44×44px on all actions; the disclosure glyph's hit area is the full row height.
- Keyboard: full tab order (tree rows → detail → proposal actions); Enter opens/approves only when focused (no global hotkeys in v1); Escape cancels the skip field; visible focus ring in `--accent` on every interactive element.
- The proposal card is a `region` with a plain-language label; record lists are chronological lists, not tables.
