# ADR 0016: Curated-view mobile affordances + Pin button state polish

**Status:** Proposed
**Date:** 2026-05-28
**Story:** `engineering-team/stories/18-curated-mobile-affordances-and-pin-state-polish.md`

## Context

Story 17 / ADR 0014 shipped the Curated view, the per-row hover-only
`[apply]` / `[dispute]` buttons, the curation-method dialog
shortcut, and the "Tag someone" modal. Story 18 is the polish pass
that closes the rough edges discovered after Story 17 landed:

- **Mobile reachability.** The Story-17 hover-reveal pattern works
  on desktop but is unreachable on touch — touch UAs don't fire
  hover, and Story 17's JS fallback (`onPointerDown` → `touchRevealed`
  in `ui/src/components/TagPageRow.jsx:72–76`) reveals the action
  buttons but offers no anchored, dismissable menu.
- **Visual weight of the Curated default view.** Net score and the
  `+N / −M` count render unconditionally on every row
  (`ui/src/components/TagPageRow.jsx:146–168`), making the page feel
  like a numeric scoreboard. Story 18 wants the default Curated view
  to be quiet — scores join the hover-reveal cohort.
- **Pin button friction.** First pin auto-opens the curation dialog
  (`ui/src/pages/Tag.jsx:67–71`), even though Story 17 set the
  defaults so cutoff=1, observer=self, includeScoreInTL=true match
  the Curated view (WYSIWYG). The dialog is a settings interstitial
  in front of a one-click action.
- **Pin button destructive default.** Once a tag is pinned, the
  same button unpins on click (`ui/src/components/TagPinAffordance.jsx:20–24`
  and `:36–38`). Click on a status label is a footgun.
- **Tooltip onset.** Every tooltip in the project is a native
  `title=` attribute (e.g. `TagPinAffordance.jsx:34`, `TagPageRow.jsx:112,
  151, 156, 159, 165`). OS-controlled onset is in the 1–2-second
  range — too slow to feel attached to the cursor.

### Surfaces this story touches (cited)

| Surface | Path | Key lines |
|---|---|---|
| Tag-detail page orchestrator | `ui/src/pages/Tag.jsx` | 37–246 (`handlePin` at 67; CurationMethodDialog mount at 171–180; `displayedRows` at 117–121; `TagPageRow` mount at 213–227) |
| Tag-detail per-row | `ui/src/components/TagPageRow.jsx` | 41–185 (`showActionsOnHover` at 45; touch reveal at 72–76; `.bs-tag-row-scores` at 146–178; native `title=` at 112/151/156/159/165) |
| Pin button | `ui/src/components/TagPinAffordance.jsx` | 15–45 (toggle handler at 20–24; label at 36–38; native `title=` at 34) |
| Tag-someone search modal | `ui/src/components/TagSomeoneModal.jsx` | 37–146+ (renders `TagPageRow` with `showActionsOnHover=true` and a `verificationScore` prop) |
| Curation dialog | `ui/src/components/CurationMethodDialog.jsx` | unchanged by this story — it just stops being auto-opened on first pin |
| Curation defaults + dTag formula | `ui/src/utils/publishTagPin.js` | `defaultCurationMethod()` at 43–50; `dTag` formula at 69 |
| `viewerPin` shape (server) | `src/api/profile-tags/index.js` | 645–662 (returns `{pinEventId, createdAt, curationMethod}` — no `dTag`) |
| Pin-detail route | `ui/src/App.jsx` | 104 (`/pin/:dTag`) |
| Pin-detail page | `ui/src/pages/PinDetail.jsx` | 44–68 (uses `dTag` param to address kind-30392 TL under TA pubkey) |
| Existing hover-reveal CSS | `ui/src/styles.css` | 4736–4834 (row layout, `is-expanded-mode`, `is-revealed`, `:focus-within`) |
| Existing dropdown pattern | `ui/src/components/BrainstormUserMenu.jsx` | 7–20 (click-outside-to-close idiom) |

### Constraints (project rules)

- **No new build/lint tooling** (CLAUDE.md). Plain JS + JSX + CSS.
- **No new dependencies** unless an option literally cannot be built
  in-tree (it can; see Decisions 2, 5).
- **No hardcoded TA pubkey.** Pin-detail navigation uses an already-runtime-derived `dTag` (no TA literal needed at the call site).
- **No concept-graph changes.** Concepts in scope (`tag`,
  `tag-pinning`, `nostr-user-tag`, `web-of-trust`) keep their
  current shape; no firmware reinstall.
- **WYSIWYG invariant (Story 17 AC-22)** must hold: skipping the
  dialog on first pin must publish under the same `defaultCurationMethod`
  values the dialog seeded with, otherwise Curated view ≠ published TL.
- **No layout shift** on per-row appear/disappear (Story 17 AC-9).

### Concept-graph orientation

Confirmed via `http://localhost:8877/api/concept-graph/summaries`:

- `39998:<TA>:tag` — pure read-side render, no schema change.
- `39998:<TA>:tag-pinning` — no wire change. Story 18 *moves the
  trigger* of the curation dialog (auto on first pin → only on
  `/pins` edit) but does not change the event payload Story-17's
  defaults already published.
- `39998:<TA>:nostr-user-tag` — no change. Apply/dispute publishing
  flow untouched; only the affordance shell around it changes.
- `39998:<TA>:web-of-trust` — unchanged.

## Options considered

The story splits into five concerns; each one's options below.
The Decision section names the chosen option per concern.

### Concern 1 — Curated default-view per-row visibility (AC-1–AC-4)

Today `.bs-tag-row-scores` renders unconditionally and
`.bs-tag-row-actions` is hover-revealed. Story 18 wants scores to
join the hover cohort in the *collapsed Curated* view only.

#### Option 1A — CSS-only: extend the existing reveal selector group
Add a `visibility: hidden` default to `.bs-tag-row-scores` keyed off
the absence of `.is-expanded-mode`. Reuse the exact same reveal
selectors Story 17 ships for actions (`:hover`, `.is-revealed`,
`.is-expanded-mode`, `:focus-within`). The scores div remains in
the DOM and reserves its slot width so the no-jiggle invariant
continues to hold.

- **Pros:** Zero JSX changes. Zero new state. Symmetric with what
  Story 17 already established. Screen readers still navigate the
  nodes (visibility:hidden hides from accessibility tree only when
  there's no aria — see AC-19 mitigation below).
- **Cons:** `visibility: hidden` does remove the element from the
  accessibility tree by default. Need an `aria-hidden="false"` or
  a screen-reader-only mirror to satisfy AC-19.

#### Option 1B — Render `null` when collapsed-and-not-revealed
Push the visibility decision into JSX: only render the score nodes
when `viewOptionsExpanded || hoverOrFocus`.

- **Pros:** Tightest DOM.
- **Cons:** Requires JS hover/focus state on every row (or `:hover`
  scoping via a wrapper that re-renders, which is fragile).
  Eliminates the reserved slot width → layout shift unless we
  explicitly reserve via `min-width` anyway, which negates the
  benefit. Worse no-jiggle story than 1A.

#### Option 1C — Wrap scores in a `<TagRowScores>` component
Extract the score render into a child component that hides
internally.

- **Pros:** Tidier file.
- **Cons:** Story is purely visual; new component is overhead with
  no behavioral payoff. Refactor not justified by story scope.

### Concern 2 — Touch overflow menu (AC-5–AC-9)

Today touch users have to tap a row to reveal actions and have
nowhere to surface scores. The story wants an explicit `⋯` per row
that, when tapped, opens a popover containing scores + actions.

#### Option 2A — Inline popover anchored to a `⋯` button rendered only on hover-none viewports
Add a small `⋯` trigger to `TagPageRow.jsx`. Hide via CSS media
query `@media (hover: hover) and (pointer: fine) { display: none; }`
on desktop. On touch, tapping opens an absolutely-positioned panel
attached to the trigger. Close on outside-tap (same idiom as
`BrainstormUserMenu.jsx:14–20`), on trigger re-tap, on Escape, and
after a successful Apply/Dispute (per AC-7).

The panel reuses the existing `.bs-tag-row-actions` buttons and
score nodes — no duplicated rendering logic, just a different
container.

- **Pros:** No new dependency. Matches user UX intent literally
  ("...menu"). Reuses existing button/score JSX. The reveal
  semantics on touch become "user opted-in" — better than the
  Story-17 first-tap-reveal, which was always-on by accident.
- **Cons:** New small component (`TagRowOverflowMenu`) or 30
  inline lines. New CSS namespace (`.bs-tag-row-overflow`,
  `.bs-tag-row-overflow-menu`). Has to handle scroll-clipping if
  the row is near viewport edge — the project doesn't have a
  positioning library, so simple absolute-positioning with
  right-anchor + max-height + overflow-auto is the answer.

#### Option 2B — Native `<details>` per row
Use a `<details><summary>⋯</summary>...</details>` block. CSS
controls the open/closed visual.

- **Pros:** Zero JS state, accessible by default.
- **Cons:** `<details>` expands *in flow* — the panel would push
  the next row down, not anchor over it. Visually wrong for the
  story's intent. Would also force a row reflow on every open.

#### Option 2C — Reuse Story-17's existing `touchRevealed` state, no anchored menu
Skip the menu — just let the row's existing JS-driven touch reveal
expose scores+actions inline on first tap.

- **Pros:** Zero new code.
- **Cons:** Doesn't match the story's UX intent (which is
  specifically "tap `⋯` → menu"). User already has Story 17's
  first-tap-reveal and judged it insufficient.

### Concern 3 — First-pin no-dialog flow (AC-10–AC-12)

Today `handlePin` opens the dialog (`Tag.jsx:67–71`); first pin
needs to skip directly to `pinTag()` with defaults.

#### Option 3A — Inline the publish in `handlePin`
Replace `setShowCurationDialog(true)` with the same body
`publishWithCuration` already runs, seeded with
`defaultCurationMethod(user.pubkey)`. The dialog component
remains, still mountable via the `/pins` edit path (a separate
route Story 12 owns); just not auto-opened on first pin from
tag-detail.

- **Pros:** Minimal diff. Preserves WYSIWYG invariant exactly,
  because `defaultCurationMethod` IS what the dialog seeded.
- **Cons:** None at this scope. The "preview before publish" UX
  goes away on first pin, which is the *point* of the story.

#### Option 3B — Add a "skip dialog by default; reopen on long-press" affordance
Show dialog on long-press, publish defaults on click.

- **Pros:** Power users keep one-click dialog access.
- **Cons:** Not in story scope. Adds JS for a path no AC requires.
  `/pins` edit flow already gives access to the dialog.

### Concern 4 — Already-pinned button: label, hover-label-swap, click → navigate (AC-13–AC-16)

Today `TagPinAffordance.jsx:36–38` renders `'📌 Pinned · Unpin'`
and clicks unpin. Story 18 wants `Pinned` by default, `View Pin`
on hover, click navigates to `/pin/<dTag>`. The component must
also stop calling `onUnpin` from this click path.

#### Option 4A — Hover-label-swap via CSS, click navigates via react-router
- Render two spans (default label + hover label) and use CSS to
  toggle which is visible on `:hover`. Both have `aria-hidden=true`
  on the inactive one. The button gets an `aria-label="View this
  pin"` so screen readers get the action-meaning regardless of
  hover state.
- The click handler reads `dTag` (see Concern 4-bis: how to source it)
  and calls `navigate(`/pin/${dTag}`)`. `unpinTag` is no longer
  called from `TagPinAffordance` — `Tag.jsx`'s `handleUnpin` becomes
  dead code from this surface (but stays exported for `/pins`).

- **Pros:** Pure CSS for the label swap, zero state. Native
  react-router `useNavigate` for the navigation.
- **Cons:** Two text nodes instead of one; trivial. `unpinTag` still
  reachable only via `/pins` or `PinDetail` — explicit, matches AC-15.

#### Option 4B — Render a `<Link>` instead of a `<button>` when pinned
Pinned state becomes a `<Link to={`/pin/${dTag}`}>` whose label CSS
swaps on hover.

- **Pros:** Browser handles "open in new tab"/middle-click for
  free.
- **Cons:** Mixing `<button>` and `<Link>` chrome inside one
  component complicates styling. Existing `.bs-tag-pin` classname
  styled for `<button>`. Reasonable but heavier.

#### Option 4C — Keep `<button>`, on click `window.location.assign`
- Trivial diff but loses react-router intra-app navigation.

### Concern 4-bis — How to obtain `dTag` for navigation

The server `viewerPin` response (`src/api/profile-tags/index.js:656–662`)
does **not** include `dTag`. The dTag formula is deterministic and
already lives in `publishTagPin.js:69`:

```
tag-pin-${tag.slug}-${tag.authorPubkey.slice(0, 8)}-${authorPk.slice(0, 8)}
```

#### Option 4-bis-A — Compute client-side via a shared helper
Lift the dTag formula into a small exported function
`computePinDTag({ tagSlug, tagAuthorPubkey, viewerPubkey })` in
`publishTagPin.js`, called both by `pinTag()` and by
`TagPinAffordance` (passed the values via props).

- **Pros:** No server change. One formula, used twice. DRY.
- **Cons:** Client now duplicates a piece of identity construction.
  But the canonical source becomes the helper, not the inline
  template literal.

#### Option 4-bis-B — Add `dTag` to the server `viewerPin` response
Compute on the server in `handleTagById`.

- **Pros:** Single source of truth on the server.
- **Cons:** Touches a server response shape for a pure UI feature.
  Extra server change to test. The formula is already a wire
  detail; the client knows everything it needs to recompute.

### Concern 5 — Tooltip onset (AC-17)

Today: 100% native `title=`. Browser onset ~1–2s, OS-controlled,
unconfigurable. Story wants noticeably faster, globally.

#### Option 5A — CSS-only `data-bs-tooltip` attribute pattern
- Introduce a single CSS rule keyed off a new attribute
  `data-bs-tooltip="copy"`. The rule renders a `::after`
  pseudo-element with the tooltip text on `:hover` and `:focus`,
  with `transition: opacity 80ms; transition-delay: 200ms` on
  show (or just instant + brief opacity fade).
- For accessibility, sites using `data-bs-tooltip` also keep
  `aria-label` (or use the surrounding `aria-describedby`). The
  native `title=` is dropped on migrated nodes so the OS tooltip
  doesn't fight the CSS one.
- **Migration scope this story:** the headline affordances —
  `TagPinAffordance` (both states, AC-16), the overflow `⋯`
  button (AC-5), the View options trigger if it has a tooltip,
  the Tag-someone button, the row's score / count / badge
  tooltips on `TagPageRow` (`:112, :151, :156, :159, :165`).
  Rule of thumb: every tooltip currently rendered on the
  tag-detail page **and** every tooltip on the Pin/Pins surfaces.
  Tooltips elsewhere in the app can migrate piecemeal in
  follow-up; Story 18's AC-17 says "noticeably faster" — meeting
  it on the visited-during-this-story surfaces is sufficient
  for the AC.

- **Pros:** Zero JS, zero new dependency, zero new component.
  Onset is a CSS variable (`--bs-tooltip-onset: 200ms`) editable
  in one place. Native-title behavior on the surfaces NOT migrated
  is unchanged.
- **Cons:** CSS pseudo-element tooltips don't compose perfectly with
  every layout (a button inside a row with `overflow: hidden`
  can clip — needs `overflow: visible` on the wrapper, or
  positioning that escapes the row). Pure-CSS tooltips can't be
  programmatically dismissed (Escape) — minor on hover-driven
  affordances.

#### Option 5B — Introduce a `<Tooltip>` React component
Wrap children with a `<Tooltip text="...">`; component owns
timer-based onset (200ms) and renders a positioned portal.

- **Pros:** Configurable, more featureful.
- **Cons:** New component + portal (the project has none today).
  Larger blast radius for a polish story.

#### Option 5C — Only change the Pin button tooltip onset (carve-out)
Migrate only `TagPinAffordance`'s tooltip to a fast custom
mechanism; leave every other native `title=` alone.

- **Pros:** Smallest diff.
- **Cons:** Doesn't meet the spirit of AC-17 ("all tooltips show
  up faster"). The user explicitly asked for both the global rule
  AND the Pin-button case.

## Decision

| Concern | Choice |
|---|---|
| 1 — Curated default-view per-row visibility | **Option 1A** (CSS-only reveal extension; reserve slot width; pair with AC-19 a11y mitigation) |
| 2 — Touch overflow menu | **Option 2A** (inline popover anchored to `⋯`, rendered only on hover-none viewports) |
| 3 — First-pin no-dialog flow | **Option 3A** (inline publish-with-defaults; dialog still reachable from `/pins` edit) |
| 4 — Already-pinned button | **Option 4A** (CSS label-swap, `useNavigate` click handler, drop `onUnpin` from this surface) |
| 4-bis — `dTag` for navigation | **Option 4-bis-A** (client-side via a shared `computePinDTag()` helper exported from `publishTagPin.js`) |
| 5 — Tooltip onset | **Option 5A** (CSS-only `data-bs-tooltip` pattern; migrate the in-scope surfaces) |

Why this bundle:

- **All-CSS-where-it-can-be-CSS** keeps the JS footprint small for
  a story that's almost entirely cosmetic.
- The **single new component** is the touch overflow menu — it has
  irreducible JS state (open / closed, close-on-outside-tap), and
  it's the one place a popover idiom must exist. We pattern it on
  the existing `BrainstormUserMenu.jsx` click-outside idiom rather
  than introducing a portal or a positioning library.
- The **`computePinDTag()` helper** centralizes a formula that
  *already* exists at two future call sites (pin and "click pinned
  → view pin"); not extracting it would leave a literal template
  string duplicated.
- The **CSS tooltip mechanism** is a pattern, not a component —
  this honors the "no new dependencies, no build pipeline" rule
  while delivering the AC-17 onset improvement on every surface
  Story 18 visits.
- **No server change** anywhere. The `viewerPin` response shape
  is unchanged; the `/pin/:dTag` route shape is unchanged; the
  curation-method wire is unchanged.

## Consequences

### Enables
- Touch users can finally apply / dispute / see scores from
  tag-detail rows and Tag-someone search-result rows.
- The Curated default view becomes visually quiet — names + avatars
  read first; numbers + actions are an opt-in.
- One-click pinning. The dialog stops being a tax on the headline
  action.
- The Pin button stops doubling as an Unpin button. Status and
  destructive-action concerns are visually separated.
- Tooltips on the touched surfaces feel attached to the cursor.

### Constrains / makes harder
- New `.bs-tag-row-overflow*` CSS namespace plus a new
  `TagRowOverflowMenu` (or inline equivalent) the project must
  carry. Documented and minimal; future tag-row presentations should
  reuse it.
- Two parallel tooltip mechanisms in the codebase: native
  `title=` (legacy, slow onset) and `data-bs-tooltip=` (this story,
  fast onset). Until full migration, each tooltip surface is one
  or the other. The CSS variable `--bs-tooltip-onset` is the single
  point to tune both onset and future migration triggers.
- The `dTag` formula is now repeated (helper + the existing
  `publishTagPin.js:69` literal). The implementer must convert
  that literal to a call to the helper to avoid two-source drift.
- `Tag.jsx`'s `handleUnpin` callback no longer fires from the
  Pin button — but stays alive so `/pins` and `PinDetail` continue
  to drive unpinning. Until we rewire those, do not delete it.

### New debt / follow-ups
- **Full tooltip migration.** Migrate the rest of the app's
  `title=` usages to `data-bs-tooltip=` (or whichever long-term
  mechanism wins) for consistent onset everywhere. Add to
  `engineering-team/follow-ups.md`.
- **Overflow-menu chrome reuse.** If a similar menu pattern needs
  to appear elsewhere (e.g., per-pin actions on `/pins`), the
  AC-5–AC-9 component should be promoted from row-internal to a
  reusable primitive. Defer until the second consumer exists.
- **`computePinDTag` as a single source of truth.** Future Pin/TL
  consumers should call this, not reimplement the formula. Add a
  one-line comment at the helper site to that effect.

### Firmware reinstall required?
**No.** Zero concept-graph changes.

## Implementation notes

Concrete diffs the Implementer will make. File-by-file.

### `ui/src/styles.css`

1. **Extend the score visibility selector group (Concern 1A).** Add
   alongside the existing rule at `:4828–4834`:

   ```css
   /* Story 18 / ADR 0016 — scores join the hover-reveal cohort
      in the collapsed Curated view. Expanded mode keeps them
      always-visible (is-expanded-mode override). Slot width is
      reserved by the existing flex-shrink:0 + min-width on
      .bs-tag-row-net, so no jiggle on hover. */
   .bs-tag-row:not(.is-expanded-mode) .bs-tag-row-scores {
     visibility: hidden;
   }
   .bs-tag-row:hover .bs-tag-row-scores,
   .bs-tag-row.is-revealed .bs-tag-row-scores,
   .bs-tag-row.is-expanded-mode .bs-tag-row-scores,
   .bs-tag-row:focus-within .bs-tag-row-scores {
     visibility: visible;
   }
   ```

   Confirm `.bs-tag-row-scores` already reserves enough width via
   the existing `.bs-tag-row-net { min-width: 2.2rem }` and
   `flex-shrink: 0`. If needed, add a `min-width: 5rem` to
   `.bs-tag-row-scores` to safely cover Net + small `+N / −M`
   together. Tester will verify no-jiggle (AC-4).

2. **Add the overflow-menu CSS namespace (Concern 2A).** New rules:

   ```css
   /* Touch overflow menu — visible only on hover-none viewports. */
   .bs-tag-row-overflow {
     display: none;       /* hidden on desktop */
     position: relative;
     margin-left: 0.25rem;
   }
   @media (hover: none) and (pointer: coarse) {
     .bs-tag-row-overflow { display: inline-flex; }
     /* On touch viewports, the scores/actions slots stay hidden
        until the menu is open — but for graceful degradation,
        Story 17's is-revealed pattern is still allowed. */
   }
   .bs-tag-row-overflow-trigger {
     /* small icon-button styled like .bs-tag-row-apply chrome */
   }
   .bs-tag-row-overflow-menu {
     position: absolute;
     right: 0;
     top: 100%;
     z-index: 30;
     min-width: 12rem;
     max-height: 60vh;
     overflow-y: auto;
     background: <project menu background var>;
     border: 1px solid rgba(255,255,255,0.08);
     border-radius: 6px;
     box-shadow: 0 6px 18px rgba(0,0,0,0.3);
     padding: 0.5rem;
     display: flex;
     flex-direction: column;
     gap: 0.5rem;
   }
   ```

   Reuse the existing `.bs-tag-row-apply` / `.bs-tag-row-dispute`
   chrome inside the menu — they're already styled buttons.

3. **Introduce `data-bs-tooltip` (Concern 5A).** New rules:

   ```css
   :root { --bs-tooltip-onset: 200ms; }

   [data-bs-tooltip] { position: relative; }
   [data-bs-tooltip]::after {
     content: attr(data-bs-tooltip);
     position: absolute;
     bottom: calc(100% + 6px);
     left: 50%;
     transform: translateX(-50%);
     white-space: nowrap;
     background: #1f2937;
     color: #f3f4f6;
     padding: 0.3rem 0.55rem;
     border-radius: 4px;
     font-size: 0.78rem;
     pointer-events: none;
     opacity: 0;
     transition: opacity 80ms ease;
     transition-delay: 0s;     /* immediate on hide */
     z-index: 50;
   }
   [data-bs-tooltip]:hover::after,
   [data-bs-tooltip]:focus-visible::after {
     opacity: 1;
     transition-delay: var(--bs-tooltip-onset); /* delayed on show */
   }
   /* Multi-line / large copy variant — opt-in via data attr. */
   [data-bs-tooltip][data-bs-tooltip-wrap="true"]::after {
     white-space: normal;
     max-width: 18rem;
   }
   ```

   Add a comment noting that nodes using `data-bs-tooltip` should
   either retain an `aria-label` or be inside an `aria-labelledby`
   relationship — the CSS pseudo-tooltip is not in the accessibility
   tree.

### `ui/src/components/TagPageRow.jsx`

1. **Add a hover-none-only overflow menu (Concern 2A).** Add
   `useRef` + an `overflowOpen` state. Render a new slot
   between actions and scores:

   ```jsx
   <div className="bs-tag-row-overflow" ref={overflowRef}>
     <button
       type="button"
       className="bs-tag-row-overflow-trigger"
       aria-label={`Actions for ${row.displayName || shortNpub(row.pubkey)}`}
       aria-expanded={overflowOpen}
       onClick={() => setOverflowOpen(o => !o)}
       data-bs-tooltip="Actions"
     >⋯</button>
     {overflowOpen && (
       <div className="bs-tag-row-overflow-menu" role="menu">
         {/* Reuse the same score + button JSX from the row body.
            The Implementer should extract a small `scoresMarkup` and
            `actionsMarkup` const inside this component and inject
            them both in the inline row AND in the menu so we don't
            duplicate logic. */}
       </div>
     )}
   </div>
   ```

   - Click-outside close: mirror `BrainstormUserMenu.jsx:14–20`
     (document `mousedown` listener with `contains` check, cleaned
     up in effect return).
   - Close on Escape: add a `keydown` listener while open.
   - **AC-7 close-on-success:** wrap `onApply` / `onDispute`
     prop callbacks so a successful resolution flips
     `overflowOpen → false`. Do this only when invoking from
     within the menu — the inline buttons (hover-revealed on
     desktop) shouldn't trigger close logic that's only
     meaningful for the open menu.

2. **Re-use existing JSX for menu contents.** Pull the
   `<div className="bs-tag-row-scores">…</div>` block and the
   `<div className="bs-tag-row-actions">…</div>` block out into
   local `scoresMarkup` / `actionsMarkup` `const`s, so the inline
   row and the popover both render them. The CSS reveal rules
   target `.bs-tag-row .bs-tag-row-actions` and `.bs-tag-row
   .bs-tag-row-scores` — the popover is *inside* `.bs-tag-row`,
   so to make the popover-rendered copies always-visible regardless
   of hover state, wrap the menu in a `.bs-tag-row-overflow-menu`
   that forcibly resets visibility:

   ```css
   .bs-tag-row-overflow-menu .bs-tag-row-actions,
   .bs-tag-row-overflow-menu .bs-tag-row-scores {
     visibility: visible !important;
   }
   ```

   `!important` is justified here: it overrides the inherited
   row-hover rules unconditionally.

3. **Migrate native `title=` to `data-bs-tooltip` (Concern 5A)**
   on the Net score, the `+N` / `−N` counts, the badge at
   `:112`, the Verification Score at `:173`. Keep an `aria-label`
   on each so screen-reader behavior is preserved. Example:

   ```jsx
   <span
     className={netClass}
     data-bs-tooltip="Net score: applications minus disputes in this POV's WoT"
     aria-label="Net score: applications minus disputes in this POV's WoT"
   >…</span>
   ```

4. **AC-19 a11y mitigation.** Because the scores slot becomes
   `visibility: hidden` by default in collapsed Curated view,
   add a visually-hidden mirror of the score values so screen
   readers continue to announce them. Either:
   - Add a `<span className="sr-only">{net > 0 ? `+${net}` : net}, +${row.applications} applied, −${row.disputes} disputed</span>` inside the row, outside the visibility-hidden block; OR
   - Override `visibility:hidden`'s a11y suppression by adding
     `aria-hidden="false"` on the score nodes (less reliable
     cross-platform).

   Pick the `sr-only` mirror — guaranteed announcement.
   Define `.sr-only` in `styles.css` if it doesn't already exist
   (standard visually-hidden boilerplate).

### `ui/src/components/TagPinAffordance.jsx`

1. **Stop calling `onUnpin` from this surface (AC-15).** Drop the
   `if (isPinned) onUnpin();` branch. The `onUnpin` prop becomes
   optional and unused by this component, but
   `ui/src/pages/Tag.jsx` can keep passing it for now (deletion
   is a separate cleanup). Update the JSDoc.

2. **Compute `dTag` and navigate on click when pinned.** Receive
   new props `tag` (or specifically `tagSlug` + `tagAuthorPubkey`)
   so the component can call `computePinDTag()`. Use
   `useNavigate` from `react-router-dom`. Skeleton:

   ```jsx
   import { useNavigate } from 'react-router-dom';
   import { computePinDTag } from '../utils/publishTagPin';

   // ...
   const navigate = useNavigate();
   const handleClick = () => {
     if (loading) return;
     if (isPinned) {
       const dTag = computePinDTag({
         tagSlug: tag.slug,
         tagAuthorPubkey: tag.authorPubkey,
         viewerPubkey: user.pubkey,
       });
       navigate(`/pin/${dTag}`);
       return;
     }
     onPin();
   };
   ```

3. **Two-state label with CSS hover swap (AC-13, AC-14).** Replace
   the inline ternary at `:36–38` with two spans:

   ```jsx
   <button …>
     <span className="bs-tag-pin-label-default">
       {loading ? (isPinned ? 'Loading…' : 'Pinning…') : (isPinned ? '📌 Pinned' : '📌 Pin')}
     </span>
     {isPinned && !loading && (
       <span className="bs-tag-pin-label-hover" aria-hidden="true">📌 View Pin</span>
     )}
   </button>
   ```

   And the CSS rule:

   ```css
   .bs-tag-pin.is-pinned .bs-tag-pin-label-hover { display: none; }
   .bs-tag-pin.is-pinned:hover .bs-tag-pin-label-default { display: none; }
   .bs-tag-pin.is-pinned:hover .bs-tag-pin-label-hover { display: inline; }
   ```

   The `aria-label` on the button stays the load-bearing accessible
   name (set it to "View this pin" when pinned, "Pin this tag" when
   unpinned). Drop `aria-pressed` from the pinned state — the
   button no longer toggles, it navigates; `aria-pressed` would
   be misleading.

4. **Migrate `title=` to `data-bs-tooltip=` (Concerns 5A + AC-16,
   AC-17).** Drop the native `title=`. Add a `data-bs-tooltip` with
   state-aware copy:
   - Unpinned: "Pin this tag to publish a Trusted List (kind-30392) curated to your preferences. Other Nostr apps can read it for content discovery and trust-weighted ranking." (existing Story-17 copy)
   - Pinned: "View this pin's details and members."
   - Wrap-friendly: add `data-bs-tooltip-wrap="true"` so the long
     unpinned copy line-wraps. The `aria-label` mirrors the copy.

### `ui/src/pages/Tag.jsx`

1. **Skip the curation dialog on first pin (Concern 3A, AC-10–AC-12).**
   Change `handlePin` body to publish immediately:

   ```jsx
   const handlePin = async () => {
     if (!tag || !user) return;
     try {
       await publishWithCuration(defaultCurationMethod(user.pubkey));
     } catch { /* error already surfaced via publishWithCuration */ }
   };
   ```

   The `CurationMethodDialog` mount at `:171–180` becomes
   unreachable from this page (it stays in the file; the
   `showCurationDialog` state and setter become dead code on this
   page — leave them OR remove them; the Tester / Reviewer will
   decide). The dialog itself is still in use from `/pins` (Story
   12), so the component file stays.

   *Note for the Implementer:* if you remove `showCurationDialog`
   state, also remove the `CurationMethodDialog` import — keep the
   diff tight. If you leave it, leave both. Don't half-remove.

2. **Pass `tag` to `<TagPinAffordance>`.** It needs `tag.slug` +
   `tag.authorPubkey` for `computePinDTag`. Add `tag={tag}` to the
   prop list at `:156–163`. The `onUnpin` prop can stay; the
   component now ignores it but keeping it avoids a churn-only
   diff.

### `ui/src/utils/publishTagPin.js`

1. **Extract and export `computePinDTag`** (Concern 4-bis-A).
   Replace the inline `:69` literal:

   ```js
   export function computePinDTag({ tagSlug, tagAuthorPubkey, viewerPubkey }) {
     return `tag-pin-${tagSlug}-${tagAuthorPubkey.slice(0, 8)}-${viewerPubkey.slice(0, 8)}`;
   }
   ```

   Then `pinTag()` at `:63` calls
   `computePinDTag({ tagSlug: tag.slug, tagAuthorPubkey: tag.authorPubkey, viewerPubkey: authorPk })`
   instead of building the dTag inline. **This is the only place
   the formula lives.**

   Add a one-line JSDoc note: "If this formula changes, every
   existing pinned tag's `/pin/<dTag>` URL changes — coordinate
   with `PinDetail.jsx` and any external TL clients."

### `ui/src/components/TagSomeoneModal.jsx`

The modal's result rows already render via `<TagPageRow showActionsOnHover>`
(per Story 17 ADR 0014, Decision 6). All of Concern 1A, Concern 2A,
and Concern 5A's tooltip migration **flow through `TagPageRow`
changes** — no separate edits to `TagSomeoneModal.jsx`. AC-9
satisfied by inheritance.

If `TagSomeoneModal` itself renders any tooltips on its own
chrome (search input, close button), migrate those to
`data-bs-tooltip=` as well — the Implementer should grep the file
for `title=` and convert any that hit during the touched-files pass.

### Out-of-scope reaffirmations

- The CurationMethodDialog component itself is **unchanged** by
  this story. It is only re-pathed (no longer auto-opened on first
  pin; still opens from `/pins` edit).
- The `/pins` edit path and the `PinDetail` page are **unchanged**.
- `publishTagPin.js`'s `unpinTag()` is **unchanged** — only its
  caller graph contracts (no longer called from the tag-detail
  button).
- The server endpoint at `src/api/profile-tags/index.js:603–676`
  is **unchanged** — `dTag` derivation moves client-side.

## Out of scope

- **NIP-51 kind-30000 list export.** Separate epic queued for after
  this story. Story 18 doesn't write any new event kinds.
- **A full tooltip migration across the entire UI.** Story 18 ships
  the `data-bs-tooltip` mechanism and migrates the surfaces it
  touches; other surfaces' `title=` stay until a follow-up sweep.
- **A reusable popover / overflow-menu primitive promoted to a
  shared component.** Inline in `TagPageRow` until a second
  consumer exists.
- **Touch tooltip semantics.** Native `title=` already has
  inconsistent touch behavior, and `data-bs-tooltip` is hover-only
  by design. AC-17 stays desktop-scoped.
- **`viewerPin.dTag` on the server response.** Considered (Option
  4-bis-B), rejected. Future server-side TL changes could revisit.
- **Removing dead `handleUnpin` / `onUnpin` plumbing.** Left in
  place; not destructive to the story's outcomes.
