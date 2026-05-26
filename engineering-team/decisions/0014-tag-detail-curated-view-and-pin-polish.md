# ADR 0014: Tag-detail Curated view + Pin curation menu simplification

**Status:** Proposed
**Date:** 2026-05-26
**Story:** `engineering-team/stories/17-tag-detail-curated-view-and-pin-polish.md`

## Context

Story 17 reshapes the tag-detail page (`/tag/:slug/:tagId`) into a
clear Curated default view, hides raw sort controls behind a
"View options" disclosure, moves "Find a profile to tag…" out of
the inline page flow into a clearly-separated modal, and trims the
Pin curation dialog to the two fields a v1 user actually needs.

### Relevant existing surfaces

- **Tag detail page** — `ui/src/pages/Tag.jsx:35–225`. Uses
  `useTagDetail(tagId)` to fetch header + rows; renders
  `<TagPinAffordance>`, `<SortToggle>`, `<TagPageSearch>`, and a list
  of `<TagPageRow>`. The "View all my pinned tags" link lives at
  `Tag.jsx:154–156`. The "Created by …" line lives at
  `Tag.jsx:130–143`.

- **Row component** — `ui/src/components/TagPageRow.jsx`. Today's
  shape: `[avatar][name + viewer-badge][+applications −disputes]`
  inside a `<Link>`, with `[Apply][Dispute]` action buttons as
  siblings of the link, always shown when `showActions={!!user}`.
  The `+N / −M` counts live INSIDE the link (lines 84–96 in the
  current file). Buttons cannot be inside a link (invalid HTML).

- **Search-on-page** — `ui/src/components/TagPageSearch.jsx`.
  Today rendered inline above the row list at
  `Tag.jsx:196–203`. Uses `<SearchInput variant="results">` plus
  a debounced fetch to `/api/search/profiles/meili`. Renders search
  hits as `<TagPageRow>` instances with `applications: 0, disputes: 0`
  hard-coded — search results carry no per-tag aggregation data.

- **Sort toggle** — `ui/src/components/SortToggle.jsx` (used at
  `Tag.jsx:176–182`). Drives `sort ∈ {applied, disputed, divisive}`
  state in `useTagDetail`.

- **Curation dialog** — `ui/src/components/CurationMethodDialog.jsx`.
  Shared by Tag-detail (`mode='create'`) and `/pins`
  (`mode='edit'`). Fields today: `cutoff` (number, default 2),
  `includeScoreInTL` (checkbox, default false), `method` (select,
  only `nip85:rank` enabled), Advanced disclosure with `observer`
  pubkey field.

- **Default curation payload** —
  `ui/src/utils/publishTagPin.js:25–33`:

  ```js
  export function defaultCurationMethod(viewerPubkey) {
    return {
      observer: viewerPubkey,
      method: 'nip85:rank',
      cutoff: 2,                  // ← changes to 1 per AC-19
      includeScoreInTL: false,    // ← changes to true per AC-21
    };
  }
  ```

  This is the single source of truth for new-pin defaults across
  all three create-pin call sites.

- **Server-side row enrichment** —
  `src/api/profile-tags/index.js:759–774` enriches each
  `byTarget` entry with `displayName`, `picture`,
  `onlyViewerVisible` from a `meiliFetchProfilesByPubkey` bulk
  call. The Meili docs returned already contain `nip05`, `about`,
  `website`, `lud16`, etc. — the row response just doesn't pass them
  through today. Adding more fields is a one-line change per field.

- **Verification Score helper** — `ui/src/pages/BrainstormSearch.jsx:611–618`
  (`getWotScore`). Reads `wot_<metric>_<povSuffix>` from a hit;
  falls back to `wot_<metric>` legacy. Used in the main search's
  `ResultCard` at `:736–745` with `🏅 Verification Score: {rank}`.
  Not yet extracted to a shared util.

- **Curated-set algorithm equivalence (confirmed during planning):**
  the Curated view filter (`applications - disputes >= 1`, equivalent
  to `applications > disputes`) is byte-equivalent to the Pin TL
  membership at `cutoff = 1` per
  `src/api/trustedList/refreshPinnedTags.js:99–114` —
  `applications >= cutoff && applications > disputes` with
  `cutoff = 1` reduces to `applications >= 1 && applications > disputes`.
  AC-22's WYSIWYG invariant follows from making `cutoff = 1` the new
  default in `defaultCurationMethod`.

- **POV cascade** — `src/api/_shared/pov.js:46–70` and CLAUDE.md's
  POV-first invariant. The Curated view defaults to house POV
  unless the viewer has switched to their own. This is the existing
  default behavior of `useTagDetail` (no change required); AC-12
  documents the dependency.

### Concepts touched

- `39998:<TA>:tag` — read-only; no schema change.
- `39998:<TA>:tag-pinning` — `curationMethod.cutoff` default flips
  from 2 → 1 and `curationMethod.includeScoreInTL` default flips
  from false → true. **No wire-shape change; no schema change.**
  Old pins with stored `cutoff: 2` continue to evaluate at cutoff=2.
- `39998:<TA>:nostr-user-tag` — read-only; no change.
- **No new concepts. No firmware reinstall.**

### Constraints

- **No new lint/typecheck infra.** Per CLAUDE.md.
- **POV-first, filter-at-view-time.** The Curated rule is layered
  on the *already-POV-filtered* response. No new server-side POV
  semantics introduced.
- **No new TA pubkey literals.** Story 16's violation list must
  not grow. The components introduced by this story do not
  reference the TA pubkey at all; the dialog's existing flow
  already pulls `taPubkey` from `useConfig()`.
- **No layout shift.** AC-9 / AC-15a hard constraint — neither
  the row itself nor adjacent rows may move when buttons or
  scores fade in/out.
- **Two hidden curation fields stay in the codebase (not deleted).**
  The user explicitly said "hide or comment it, we'll default
  to … will probably bring back later." See "Curation dialog
  field hides" below for the precise treatment.

## Options considered

### Option A — Modify the existing components in place (minimal new files)

`Tag.jsx`, `TagPageRow.jsx`, `TagPageSearch.jsx`, and
`CurationMethodDialog.jsx` all change in-place. New disclosure state,
filter state, modal state all live as `useState` in `Tag.jsx`. The
row receives a growing set of mode/flag props.

**Pros:** Smallest diff measured in files; no new abstractions.

**Cons:** `Tag.jsx` becomes a 400+ line layout-and-state monster;
`TagPageRow` prop set grows to ~8 booleans; the modal vs. inline
search vs. modal-search-row variants get mixed into one component.

### Option B — Two-component split with a parallel V2 row

Create `TagPageRowV2.jsx` (Net-score layout, hover-only buttons),
`TagViewControls.jsx` (toolbar + disclosure), `TagSomeoneModal.jsx`
(modal chrome + reuses the existing search internals), and
`useTagFilter` hook. Keep `TagPageRow.jsx` as legacy until it can
be deleted in a later cleanup.

**Pros:** Each new component does one thing; clean test surface.

**Cons:** Two row components drift; the legacy `TagPageRow` has
no other call sites after this story so the V2 is just a rename;
extra file count without commensurate benefit.

### Option C — Hybrid: extend `TagPageRow` with data-driven layout, add two new components for the new affordances, hide-don't-delete the curation fields

- **`TagPageRow.jsx`** — extended in place. New layout splits the
  row into three flex slots (link / actions / scores) — *scores
  move OUTSIDE the navigable link* — and adds two props:
  `showActionsOnHover: boolean` (defaults to current always-on
  behavior so other call sites if any are unaffected) and
  `verificationScore: number | null` (rendered prominently when
  applications+disputes==0, i.e. in search-result rows of the
  "Tag someone" modal). Net score is derived from
  `applications - disputes` and rendered prominently in all
  non-search modes.

- **New `TagViewControls.jsx`** — the toolbar row at the top of
  the row list. Renders left-aligned "Tag someone" button and
  right-aligned "View options ▼" disclosure. The expanded panel
  contains the sort chips (existing `<SortToggle>`) and the new
  client-side filter `<input>`. State (sort, filter text,
  expanded) is owned by `Tag.jsx` and threaded as props.

- **New `TagSomeoneModal.jsx`** — modal chrome (backdrop +
  centered dialog) wrapping a reused `<TagPageSearch>` rendered
  with `mode="modal"` (or equivalent) that swaps the inline
  result-row chrome for the new Verification-Score-aware row.
  Modal styles reuse the same CSS shape as
  `CurationMethodDialog.jsx`'s backdrop pattern (
  `.pcd-backdrop` / `.pcd`) under a new namespace
  (`.tsm-backdrop` / `.tsm`).

- **`Tag.jsx`** — orchestrates state, applies the Curated filter
  (`viewOptionsExpanded ? rows : rows.filter(r => r.applications > r.disputes)`)
  and the text filter on top, threads result rows into
  `<TagPageRow showActionsOnHover={!viewOptionsExpanded} />`,
  removes the dead "View all my pinned tags" link and "Created
  by …" line.

- **`CurationMethodDialog.jsx`** — extended in place with: (a) a
  new header intro paragraph at the top of the dialog body
  (between `.pcd-tag-info` and `<form>`); (b) two blocks
  (`Include rank scores` checkbox and the Advanced disclosure)
  wrapped in `{false && (<>…</>)}` guards with a single-line
  comment naming Story 17 as the reason. The fields' state and
  validation logic stay intact so a flip from `false` to `true`
  re-enables them.

- **`defaultCurationMethod`** — flips two literals in
  `ui/src/utils/publishTagPin.js`: `cutoff: 2 → 1`,
  `includeScoreInTL: false → true`.

- **Server-side enrichment** — extend
  `aggregateProfilesTagged`'s per-target enrichment in
  `src/api/profile-tags/index.js:759–774` to pass through
  `nip05`, `about`, and `website` from the Meili docs that
  `meiliFetchProfilesByPubkey` already returns. These fields
  feed the client-side text filter (AC-5).

**Pros:** Each new component is small and does one thing; the
existing row stays singular (no drift); the curation dialog
keeps the now-disabled fields in-place per the user's "we'll
bring it back" intent without introducing a feature-flag
abstraction.

**Cons:** Slightly more touch points than Option A; the
`{false && (…)}` guards in the dialog are unusual but
deliberate (see Decision 8 below).

## Decision

We chose **Option C**.

The decision drivers:

1. **Row component singularity.** A single `TagPageRow` with
   data-driven score display (Net vs. Verification Score, decided
   by whether `applications+disputes > 0`) is simpler than two
   row variants and avoids drift over time. The hover-vs-always
   behavior is one boolean prop.
2. **Toolbar + modal as their own components.** The toolbar
   composes existing pieces (`<SortToggle>` + a new `<input>`),
   wrapped in a disclosure region — clear, single-purpose surface.
   The "Tag someone" modal is genuinely new chrome with its own
   open/close lifecycle, escape handling, and click-outside
   semantics; it earns its own file.
3. **No new feature-flag abstraction in the dialog.** The user's
   intent for the two hidden fields is "kept in code, easy to
   re-enable later." A simple `{false && (<>…</>)}` JSX guard
   meets that intent without inventing a "feature flag" concept
   the codebase doesn't otherwise have (CLAUDE.md: "Don't use
   feature flags … when you can just change the code"). The
   alternative — deleting and re-adding the fields later — would
   destroy state-validation logic the user said they want to keep.
4. **Server-side row enrichment is the right place for filter
   inputs.** The Meili bulk-fetch already happens on every
   tag-detail request (line 762). Adding three field passthroughs
   costs essentially nothing and avoids the alternative — a
   parallel client-side search call to find filter matches —
   which would double the request count and risk POV-divergence.
5. **WYSIWYG via the default flip alone.** Aligning the Curated
   view's algorithm with `cutoff = 1` requires no algorithm
   change anywhere; the default in `publishTagPin.js` flips and
   `applyDisputesFunction` evaluates the new value correctly
   without modification.

### Detailed decisions

#### Decision 1 — Disclosure widget shape

Native `<details>`/`<summary>` is the cleanest accessible disclosure
and is already used in `CurationMethodDialog.jsx:213–239` for the
Advanced section. The `TagViewControls.jsx` disclosure uses the
same primitive, styled with:

- `<summary>` rendered as a right-aligned text + chevron via CSS
  (`details[open] .chevron { transform: rotate(180deg); }`).
- Default state collapsed; no persistence across navigation in v1.

#### Decision 2 — Row layout, no-jiggle

The row becomes a three-slot flex container at the `<li>` level:

```
<li class="bs-tag-row">
  <Link to="/user/...">[avatar][name]</Link>       ← flex: 1
  <div class="bs-tag-row-actions">[Apply][Dispute]</div>  ← min-width reserved
  <div class="bs-tag-row-scores">[Net][+/-]</div>  ← fixed-width, right
</li>
```

CSS:

```css
.bs-tag-row { display: flex; align-items: center; gap: 12px; }
.bs-tag-row-link { flex: 1 1 auto; display: flex; align-items: center; gap: 8px; min-width: 0; }
.bs-tag-row-actions { display: flex; gap: 6px; min-width: 160px; visibility: hidden; }
.bs-tag-row.is-revealed .bs-tag-row-actions,
.bs-tag-row:hover         .bs-tag-row-actions,
.bs-tag-row:focus-within  .bs-tag-row-actions,
.bs-tag-row.is-expanded-mode .bs-tag-row-actions { visibility: visible; }
.bs-tag-row-scores { display: flex; align-items: baseline; gap: 6px; }
.bs-tag-row-net { font-size: 1.15rem; font-weight: 600; }
.bs-tag-row-net.is-positive { color: var(--bs-net-pos, #2a8a3e); }
.bs-tag-row-net.is-negative { color: var(--bs-net-neg, #b23a3a); }
.bs-tag-row-net.is-zero     { color: var(--bs-net-zero, #c8a02a); }
.bs-tag-row-counts { font-size: 0.85rem; opacity: 0.6; }
```

The actions slot reserves its width permanently via `min-width`,
so toggling `visibility: hidden ↔ visible` produces zero layout
shift. The reserved width is approximately the sum of the Apply
and Dispute button widths plus their gap. (Exact value is left to
CSS; Tester verifies AC-9 by measuring the row's bounding box on
hover-in / hover-out.)

The scores move outside the navigable link. Tradeoff: tapping a
score no longer navigates to the profile. Negligible (the row's
link area is still the larger click target).

#### Decision 3 — Mobile / touch first-tap reveal

Use a hybrid:

- **Desktop:** `:hover` + `:focus-within` (CSS-only) handles
  reveal.
- **Touch:** the row carries local React state
  `[revealed, setRevealed] = useState(false)`. The row's
  `onPointerDown` handler sets `revealed = true` when the
  pointer type is `touch` AND the event target is within the
  row's `<Link>` (so a tap on the link area reveals buttons,
  without firing navigation). The Link still navigates on a
  subsequent tap (the iOS Safari fast-tap delay + the user's
  intent to navigate happens on a second discrete tap).
- A single document-level `pointerdown` listener clears
  `revealed = false` on any row whose container did NOT contain
  the event target.

The Implementer may consolidate this into a small `useRowReveal`
hook in `ui/src/hooks/useRowReveal.js` if multiple components
end up needing it (the row + the search-result row variant both
do). Hook signature:
`{ revealed, bind } = useRowReveal()` where `bind` is a set of
DOM event handlers to spread onto the row's root element.

The AC-8 hard requirement is **"first tap reveals; the action
performs on a tap on the actual button."** Anything that meets
that without layout shift satisfies the AC.

#### Decision 4 — Curated filter + text filter ordering

In `Tag.jsx`:

```js
const filtered = useMemo(() => {
  const byText = filterText.trim()
    ? rows.filter(r => rowMatchesText(r, filterText))
    : rows;
  if (viewOptionsExpanded) return byText;
  return byText.filter(r => r.applications > r.disputes);
}, [rows, filterText, viewOptionsExpanded]);
```

Order: text filter first, then Curated filter. (Text filter
operates on the same set whether expanded or not, per AC-5.)

`rowMatchesText(row, text)`:
- Normalize `text` via `text.trim().toLowerCase()`.
- For each candidate field in `[displayName, nip05, about, website]`
  (the server-enriched fields), if present and the lowercased
  value includes the normalized text → match. Return true on first
  match.
- `pubkey` substring is NOT a match field (would cause confusing
  hits on partial-hex strings).

No debounce — the filter operates on an already-fetched in-memory
list of typically <50 rows; React's render at 60fps absorbs the
work without measurable cost.

#### Decision 5 — "Tag someone" modal lifecycle

- Open on `[Tag someone]` click. If `!user`, call `login()` first
  via `useAuth()`; on success, open. On failure, surface inline
  error on the button (mirroring the existing `pinError` pattern
  on the Pin button).
- Close on Escape, click on backdrop, or explicit close button.
- Closes when the user presses Escape, even mid-publish (the
  publish promise has its own error surface; closing the modal
  doesn't cancel it).
- Stays open after a successful Apply/Dispute on a search result
  — the user typically wants to tag multiple profiles in one
  session. Closing requires explicit Cancel / × / Escape.
- After a successful Apply/Dispute, the modal's internal search
  results re-render to reflect the new `viewerAssertions` (via
  the parent's `refetchRows` triggering and the new `rows` map
  flowing back through props).

State, scroll position, and View-options expansion of the page
underneath are preserved per AC-16 (the modal doesn't unmount the
page; it's a rendered-on-top overlay).

#### Decision 6 — Verification Score plumbing for search results

Extract `getWotScore` from `BrainstormSearch.jsx:611–618` into a
new shared util `ui/src/utils/wotScore.js` (single function
export). `BrainstormSearch.jsx` updates its import.
`TagSomeoneModal.jsx` imports the same util and computes the
Verification Score for each search hit using `povSuffix` read
from `useTagDetail` (the rows response already returns
`povSuffix` at `src/api/profile-tags/index.js:781`; surface it
in the hook's return shape if it isn't already).

For "already-tagged" detection (AC-15's "+N/-M to the left"
branch): construct a `rowsByPubkey: Map<string, Row>` in `Tag.jsx`
from the row list and thread it into the modal as a prop. For
each search hit, the modal looks up the hit's pubkey:

- If present in `rowsByPubkey` with non-zero
  `applications + disputes`: render the row with the standard
  Curated-style scores (Net + small +/-) AND no Verification
  Score (the +/- already conveys the trust signal).
- If present with `applications + disputes == 0` (viewer-union
  edge case — viewer asserted but no WoT consensus yet) OR not
  present: render with Verification Score in the Net slot, no
  +/- count.

(The story's AC-15 spec is "+/- to LEFT of Verification Score
when already tagged" — the Architect's call here is that the
Verification Score is redundant when +/- is present and is
omitted entirely. If post-implementation review wants both shown,
the row component supports both via independent props.)

#### Decision 7 — "View all my pinned tags" + "Created by …" deletions

Delete from `Tag.jsx` (AC-1, AC-2):
- The `<Link to="/pins">View all my pinned tags →</Link>` and
  its `bs-tag-pin-row` wrapper at lines 144–158 (collapses the
  wrapper to just the `<TagPinAffordance>`, or removes the
  wrapper entirely).
- The "Created by …" paragraph at lines 130–143 INCLUDING the
  imports/state for `author` from `useTagDetail` IF no other
  surface in `Tag.jsx` consumes it. (Verify before deletion;
  `useTagDetail` still returns `author` for any callers; this
  story leaves the hook signature alone.)
- The `shortNpub` helper at `Tag.jsx:19–27` becomes unused with
  the author paragraph gone; delete the helper too. (Not used
  elsewhere in this file.)

#### Decision 8 — Hide-don't-delete the two curation fields

In `CurationMethodDialog.jsx`:

- Wrap the **Include rank scores** field block (lines 176–191)
  in `{false && (<>…</>)}` with a single-line comment:

  ```jsx
  {/* Story 17 — hidden in v1; new pins default to includeScoreInTL=true.
       Re-enable when richer curation lands. */}
  {false && (
    <div className="pcd-field">
      <label className="pcd-toggle">…</label>
      …
    </div>
  )}
  ```

- Wrap the **Advanced** `<details>` block (lines 213–239)
  identically.

The `useState` declarations for `includeScoreInTL`, `observer`,
and `advancedOpen` remain so the values pass through to the
`onSubmit` handler with their initial-state defaults:

- For `mode='create'`: `init` comes from
  `defaultCurationMethod(viewerPubkey)`, which (post-flip) sets
  `cutoff: 1`, `includeScoreInTL: true`, `observer: viewerPubkey`.
  The hidden fields contribute their defaults via `useState`.
- For `mode='edit'`: `init` comes from the stored pin's
  `curationMethod`. Whatever was stored is preserved on
  re-publish — the hidden fields just aren't user-editable. An
  edit on a legacy pin with `includeScoreInTL: false` republishes
  with `includeScoreInTL: false` (the user didn't see the field
  to flip it; we honor the stored value). Acceptable for v1; if
  a "force-update all pins to current defaults" UX is wanted
  later, it's a separate story.

#### Decision 9 — Header intro paragraph in curation dialog

Insert after `.pcd-tag-info` (after line 151 in current file),
before the `<form>`:

```jsx
<div className="pcd-intro">
  <p>
    Pinning a tag tells this instance to periodically publish a{' '}
    <strong>Trusted List</strong> (NIP-85 kind-30392) under your
    point-of-view, listing the profiles that the tag applies to.
    Other Nostr apps can read those lists for content discovery,
    list curation, and trust-weighted ranking.
  </p>
</div>
```

The copy mirrors `<PinsIntro />` in `ui/src/pages/Pins.jsx:28–40`
verbatim. **Do not extract `<PinsIntro />` into a shared
component for v1** — the two surfaces are independent and may
diverge later; duplicating ten lines of JSX is the right move per
CLAUDE.md's "don't introduce abstractions beyond what the task
requires."

#### Decision 10 — Pin button tooltip mechanic (AC-17)

Use the native `title` attribute on the `<button>` in
`TagPinAffordance.jsx`. Concrete copy:

```
title="Pin this tag to publish a Trusted List (kind-30392) curated
to your preferences. Other Nostr apps can read it for content
discovery and trust-weighted ranking."
```

The codebase has no shared tooltip component
(`grep -rn 'tooltip' --include='*.jsx' ui/src/` finds only
graph-internal patterns in FirmwareExplorer). Native `title=""`
is consistent with the codebase's existing inline help (e.g.,
`TagPageRow:88,92` already uses native `title`). On touch
devices, native `title` doesn't render — acceptable for v1; the
tooltip is supplementary information, not a load-bearing
explanation.

#### Decision 11 — Default flip in `publishTagPin.js`

Single small change. The hex-format check on `taPubkey` and all
other field handling stay the same.

```js
// ui/src/utils/publishTagPin.js
export function defaultCurationMethod(viewerPubkey) {
  return {
    observer: viewerPubkey,
    method: 'nip85:rank',
    cutoff: 1,                  // was 2 — Story 17 AC-19
    includeScoreInTL: true,     // was false — Story 17 AC-21
  };
}
```

Also align the `CurationMethodDialog`'s defensive cutoff fallback:

```js
// ui/src/components/CurationMethodDialog.jsx
const [cutoff, setCutoff] = useState(String(init.cutoff ?? 1));  // was ?? 2
```

The server-side `refreshPinnedTags.js:145` fallback to `cutoff = 2`
is left UNCHANGED — it's defensive for the "pin event with no
explicit cutoff" case, which shouldn't occur in practice. Changing
the server fallback would retroactively shift evaluation for any
malformed historical pin events.

#### Decision 12 — Server-side row enrichment for the filter input

Single-spot change to `aggregateProfilesTagged`'s enrichment block
(`src/api/profile-tags/index.js:759–774`). Add three fields per
entry from the same `meiliFetchProfilesByPubkey` doc that's already
fetched:

```js
for (const entry of byTarget.values()) {
  const doc = targetDocs.get(entry.pubkey);
  entry.displayName = doc ? (doc.display_name || doc.name || null) : null;
  entry.picture     = doc ? (doc.picture || null) : null;
  entry.nip05       = doc ? (doc.nip05 || null) : null;     // new
  entry.about       = doc ? (doc.about || null) : null;     // new
  entry.website     = doc ? (doc.website || null) : null;   // new
  entry.onlyViewerVisible = !!viewerAssertions[entry.pubkey]
    && entry.applications === 0 && entry.disputes === 0;
}
```

Cost: 3 extra fields per row × N rows. At expected scale (~10s
of rows per tag) this is bytes of overhead. Zero new Meili calls.

The row response shape is additive; existing callers of
`/api/profile-tags/profiles-tagged` ignore the new fields silently.

## Consequences

**What this enables:**

- A clean default view that reflects the WoT consensus without
  noise.
- Pinning's WYSIWYG promise: "what I see is what gets published."
- A re-usable "View options" disclosure pattern other tag surfaces
  (tag-index page, profile-tags chips) could adopt later.
- Cleaner curation dialog — two-field-only UX is far less
  intimidating to new users.
- Filter input lets users navigate long member lists without
  scrolling.

**What this constrains or makes harder:**

- The row layout now requires three flex slots and a reserved
  action-slot width. CSS regressions elsewhere that touched
  `.bs-tag-row` need to be aware of the new structure.
- Scores moving outside the link is a small accessibility shift —
  screen readers no longer read scores as part of the row's
  navigable announcement. The Tester should verify the row is
  still announced with all relevant context.
- Hide-don't-delete in the curation dialog means future readers
  see `{false && (…)}` blocks. The single-line comment explaining
  why is load-bearing — the Reviewer enforces it.
- The new server-enriched fields (`nip05`, `about`, `website`) are
  now part of the response contract for
  `/api/profile-tags/profiles-tagged`. Tests must assert their
  presence so they don't quietly disappear in a future refactor.

**New debt / follow-ups:**

- Future story: re-enable the `Advanced` observer field with a
  POV-picker UI (currently the observer is always the viewer's
  pubkey).
- Future story: `Include rank scores` toggle returns when richer
  TL detail UX is built.
- Future story: cross-page POV invalidation
  (`engineering-team/follow-ups.md`) is required if the Curated
  view's POV is ever exposed inline on the tag-detail page.
- Possible future polish: persist View-options expansion state in
  `sessionStorage` so the user's preference survives navigation.
- Possible future polish: pagination on `/tag/:slug/:tagId` if a
  tag accumulates hundreds of members. Today this page does not
  paginate; if it begins to, server-side Curated filtering would
  be needed (the AC for Curated semantics remains true on the
  current-page-of-rows subset, but pagination + client filter
  produces awkward edge cases).
- A separate story to refactor the Pin tooltip into a richer
  hover popover if user feedback wants it.

**Firmware reinstall required?** **No.** No new concepts, no
schema changes. The `tag-pinning` concept's schema already accepts
`cutoff` and `includeScoreInTL`; only the default values flip.

## Implementation notes

**Files to create:**

- `ui/src/components/TagViewControls.jsx` — toolbar + disclosure.
  Props: `{ sort, onSortChange, expanded, onToggleExpand,
  filterText, onFilterChange, onTagSomeoneClick, signedIn }`.
  Renders `[Tag someone]` (left) + `[View options ▼]` (right) on
  one row; expanded panel below contains the existing
  `<SortToggle>` plus a `<input type="text" placeholder="Filter…">`.
- `ui/src/components/TagSomeoneModal.jsx` — modal chrome wrapping
  the search.
  Props: `{ open, onClose, tag, viewerPubkey, viewerAssertions,
  rowsByPubkey, povSuffix, onApply, onDispute }`.
  Internally renders `<TagPageSearch>` configured for modal
  presentation OR contains its own search input + result-row
  rendering (the Implementer picks; the AC-14 hard requirement is
  "clearly separated modal").
- `ui/src/utils/wotScore.js` — `getWotScore(hit, metric, povSuffix)`.
  Single function; identical body to
  `BrainstormSearch.jsx:611–618`.
- (Optional) `ui/src/hooks/useRowReveal.js` — small touch/hover
  reveal hook if extracted.

**Files to modify:**

- `ui/src/pages/Tag.jsx`:
  - Remove the "View all my pinned tags" `<Link>` and its
    wrapper (lines 144–158).
  - Remove the "Created by …" paragraph (lines 130–143) and its
    helper `shortNpub` (lines 19–27).
  - Remove the always-rendered inline
    `<SortToggle>` (lines 176–182) and the always-rendered
    `<TagPageSearch>` (lines 196–203).
  - Add state: `viewOptionsExpanded`, `filterText`,
    `tagSomeoneOpen`.
  - Add memoized `displayedRows` (text filter → Curated filter
    composition per Decision 4).
  - Mount `<TagViewControls>` above the row list.
  - Mount `<TagSomeoneModal>` controlled by `tagSomeoneOpen`.
  - Pass `showActionsOnHover={!viewOptionsExpanded}` and
    `applications` / `disputes` (already on row) into each
    `<TagPageRow>`. The row computes Net internally.
- `ui/src/components/TagPageRow.jsx`:
  - Restructure JSX into three flex slots (link / actions /
    scores) per Decision 2.
  - Add prop `showActionsOnHover` (defaults to `false` →
    always-on, preserving any other-call-site behavior).
  - Compute `net = applications - disputes`; render Net + small
    `+N/-M` per AC-6/AC-7.
  - Add prop `verificationScore` (number | null); rendered ONLY
    when `applications + disputes === 0` AND
    `verificationScore != null`, in place of Net.
  - Use `useRowReveal` (or inline state) for touch-tap reveal
    behavior per Decision 3.
- `ui/src/components/CurationMethodDialog.jsx`:
  - Insert intro paragraph after `.pcd-tag-info` per Decision 9.
  - Wrap `Include rank scores` block in `{false && (<>…</>)}`
    per Decision 8.
  - Wrap `Advanced` `<details>` block in `{false && (<>…</>)}`
    per Decision 8.
  - Change cutoff `useState` fallback to `?? 1` per Decision 11.
- `ui/src/utils/publishTagPin.js`:
  - Flip `cutoff: 2 → 1` and `includeScoreInTL: false → true`
    in `defaultCurationMethod` per Decision 11.
- `ui/src/components/TagPinAffordance.jsx`:
  - Add `title={...}` to the button per Decision 10.
- `ui/src/pages/BrainstormSearch.jsx`:
  - Remove the local `getWotScore` function; import from
    `../utils/wotScore` instead per Decision 6. No behavior change.
- `src/api/profile-tags/index.js`:
  - Extend the enrichment block in `handleProfilesTagged` to
    include `nip05`, `about`, `website` per Decision 12.

**CSS additions** (the project ships CSS as plain stylesheets; the
Implementer picks the file based on existing conventions):

- `.bs-tag-row` restructured per Decision 2.
- `.bs-tag-row-net` / `.bs-tag-row-counts` per Decision 2.
- `.bs-tag-view-controls` / `.bs-tag-view-options-panel` for the
  toolbar.
- `.tsm-backdrop` / `.tsm` (or reuse `.pcd-*` namespace if the
  styles are identical — the Implementer picks).
- A small style sweep to confirm `:hover` and `is-revealed` produce
  zero layout shift; the Tester verifies via bounding-box assertion.

**Tester-relevant notes:**

- AC-22 (WYSIWYG): the test plan should include a fixture-driven
  test that publishes a pin with the new defaults (cutoff=1,
  observer=self, includeScoreInTL=true), runs the TL refresh, and
  asserts the published TL's member set equals the Curated view's
  row set under the same POV.
- AC-9 / AC-15a (no jiggle): assert via JSDOM
  `getBoundingClientRect()` or equivalent that the row's bounding
  box does NOT change on hover-in / hover-out. The action slot's
  reserved width is the load-bearing CSS rule.
- AC-19 / AC-21: assert the dialog's submitted payload carries
  `cutoff: 1` and `includeScoreInTL: true` when defaults are
  accepted; assert the corresponding fields are NOT present in
  the rendered DOM.
- AC-5: assert that the text-filter input filters the rendered
  row list against `displayName`, `nip05`, `about`, and `website`
  case-insensitively. The Tester should verify the server enrichment
  returns these three new fields too — that's a separate test
  asserting the response shape.
- AC-13/AC-14: assert the "Tag someone" button is in the DOM for
  both authenticated and unauthenticated viewers; clicking when
  unauthenticated triggers the existing `login()` flow.
- AC-15: assert the modal's search-result row shows Verification
  Score when the hit's pubkey is NOT in `rowsByPubkey`, and shows
  the `+N/-M` count (Curated layout) when it IS present with
  non-zero counts.

## Out of scope

- **Story 14 (Treasure Map integration)** — paused.
- **Story 15 (Pin event encryption)** — paused.
- **Story 16 (Runtime TA pubkey migration)** — comes after this
  story.
- **Server-side Curated mode** (`?curated=1` flag on the
  endpoint). Client-side filter is sufficient at expected scale.
- **Pagination on `/tag/:slug/:tagId`** — not needed at v1 scale.
- **POV-selector reachability from the avatar menu** — tracked
  separately in `engineering-team/follow-ups.md`.
- **A "force-update legacy pins to current defaults" UX** — out;
  edits on legacy pins preserve whatever was stored.
- **Pin tooltip as a custom popover component** — native `title`
  is sufficient for v1.
- **Persisting View-options expansion state across navigation** —
  resets to collapsed on each page load.
- **Restoring the two hidden curation dialog fields** — the
  `{false && (…)}` guards keep the code in place; re-enabling
  is a future story.
- **The Trail-off "for each profile in the search results" item**
  — resolved as AC-15a (apply/dispute hover-only in modal results).
