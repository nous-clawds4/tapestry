# ADR 0018: Move Pin detail into a Tag-detail "Pinned" tab; simplify /pins rows

**Status:** Accepted
**Date:** 2026-05-29
**Story:** `engineering-team/stories/20-pin-detail-into-tag-pinned-tab.md`

> **Supersedes (in part):** ADR 0016 (Story 18) AC-13–AC-15 — the
> already-pinned header Pin button no longer navigates to `/pin/:dTag`;
> it now toggles the on-page "Pinned" tab. The rest of ADR 0016
> (mobile overflow affordances on tagged-profile rows, fast tooltip
> onset, first-pin no-dialog publish) stands unchanged.

## Context

Story 20 consolidates the pin stack from three surfaces to two, with no
server, wire, or concept-graph changes. The acceptance criteria, quoted
to confirm understanding:

- **AC-1/AC-2** — "Pinned" tab appears **only** for a viewer who has
  pinned the tag; unpinned/signed-out viewers see today's single
  tagged-profiles view.
- **AC-3** — When the viewer has pinned the tag, the Pinned tab is the
  **default selection** on a fresh visit.
- **AC-4** — First pin (from the unpinned state) **auto-switches** to
  the Pinned tab, no reload.
- **AC-5** — Pinned tab shows the current `/pin/:dTag` content
  (metadata: Observer, Cutoff, Min rank, Last refreshed, d-tag, naddr;
  owner actions: Refresh now, Edit curation, Share, NIP-51 Export;
  retracted notice) **minus the "Tag" metadata row**.
- **AC-6** — Pinned tab's profile list is the kind-30392 TL members
  only (not the tagged-profiles list).
- **AC-7** — Default tab keeps today's behavior (Curated, View options,
  filter, per-row affordances); tab state survives switches in-session.
- **AC-8** — Owner controls behave exactly as on `/pin/:dTag`;
  switching tabs never unpins.
- **AC-9/AC-10/AC-11** — Header button: "Pin" → pin + switch (AC-4);
  "Pinned" (default tab) → switch to Pinned; "Back to Tag" (Pinned tab)
  → switch to default.
- **AC-12/AC-13/AC-14/AC-15** — `/pins` rows become plain links (no
  action controls/menus) to `/tag/:slug/:tagId` with the Pinned tab
  selected, with a right-edge `›` chevron; page-level affordances
  (heading, intro, sign-in, empty state) preserved.
- **AC-16** — `/pin/:dTag` redirects into the owning tag's Pinned tab;
  standalone page retired.
- **AC-17** — Working-tree mobile-modal-usability changes preserved;
  pins-layout WIP reworked.
- **AC-18** — Stories 17/18 behaviors otherwise hold; only AC-13–AC-15
  of Story 18 change.

### Existing surfaces and data contracts (read from source)

- **`ui/src/pages/Tag.jsx`** — current single-view tag-detail page.
  Holds `useTagDetail(tagId)`, the header with `TagPinAffordance`, and
  the `bs-tag-rows` section (`TagViewControls` + `TagPageRow` list +
  `TagSomeoneModal`). All the default-tab machinery already lives here.
- **`useTagDetail`** (`ui/src/hooks/useTagDetail.js:103-…`) returns
  `{ tag, author, viewerPin, rows, viewerAssertions, povSuffix, sort,
  setSort, headerLoading, rowsLoading, headerError, rowsError,
  refetchRows, refetchHeader }`. The header endpoint
  `/api/profile-tags/by-id` (`src/api/profile-tags/index.js:645-677`)
  returns:
    - `tag = { eventId, slug, name, description, authorPubkey, createdAt }`
    - `viewerPin = { pinEventId, createdAt, curationMethod } | null`
      (only when `viewerPubkey` is passed and a surviving pin exists).
  **This is enough to render the Pinned tab without a second lookup:**
  `pinEventId` drives Refresh/Edit/Unpin; `curationMethod.observer`
  (falling back to the viewer pubkey) plus `tag.authorPubkey` +
  `tag.slug` feed `computeTLDTag` → the kind-30392 d-tag.
- **`ui/src/pages/PinDetail.jsx`** — the content to move. Renders via
  `useTLDetail(dTag)` (`ui/src/hooks/useTLDetail.js`), which returns
  `{ tl, members, loading, error, refetch }` with
  `tl = { eventId, createdAt, dTag, title, observer, sourceTag, cutoff,
  minRank, retracted }` and enriched `members[]`. PinDetail also does a
  one-shot `/api/profile-tags/pins?viewerPubkey=…` fetch
  (`PinDetail.jsx:62-78`) purely to obtain `nip51ExportStatus`
  (`currentTitle`, `status`, `exportedAt`, `diffVsTL`) for the Export
  section — the `/by-id` `viewerPin` does **not** carry that.
- **`ui/src/components/TagPinAffordance.jsx`** — already computes the
  d-tag the exact way the Pinned tab will (`computeTLDTag({ observer,
  tagAuthorPubkey, tagSlug })`, lines 38-43) and today `navigate`s to
  `/pin/<dTag>`. This is the navigation that AC-10/AC-11 replace with a
  tab toggle.
- **`ui/src/pages/Pins.jsx`** — `PinRow` (lines 121-170) and the
  edit-dialog wiring (`editingPin`, `CurationMethodDialog`, `handleEdit*`,
  `useRefreshPin`). The working tree already half-stripped `PinRow`.
- **`ui/src/App.jsx:88-107`** — flat route objects: `/tag/:tagId`,
  `/tag/:slug/:tagId`, `/tags`, `/pins`, `/pin/:dTag`.

### Working-tree classification (AC-17)

Diffing the branch's modified files, each hunk is one of two kinds:

**Keep (mobile-modal-usability — preserve verbatim):**
- `TLExportButton.jsx` — adds a centering **backdrop** wrapper around
  the export popover, Escape-to-close, and click-outside-to-close
  (turns an anchored popover into a real modal on small screens).
- `TagPageRow.jsx` + `TagSomeoneModal.jsx` — a shared
  `menuRecentlyClosedRef` that stops a sibling row's `⋯` overflow menu
  from re-opening on the same outside-tap that dismissed another
  (prevents stacked menus on touch).
- `styles.css` — `.bs-tl-export-backdrop` + `.bs-tl-export-popover`
  responsive rules, and the `.pcd-*` `@media (max-width: 480px)`
  curation-dialog responsiveness.

**Rework / discard (pins-layout WIP — superseded by this story):**
- `Pins.jsx` — the `PinRow` overflow-menu work.
- `styles.css` — the `.bs-pins-row-overflow-trigger` /
  `.bs-pins-row-actions-menu` block (dead once rows are plain links).

## Options considered

### How the Pinned tab is selected / addressed

#### Option A — URL query param `?tab=pinned` (chosen)

The existing `/tag/:slug/:tagId` route stays. Selected tab derives from
`useSearchParams()`:

- On mount: `searchParams.get('tab')` if present, else
  `viewerPin ? 'pinned' : 'default'` (satisfies AC-3).
- Tab clicks call `setSearchParams({ tab }, { replace: true })`.
- `/pins` rows link to `…?tab=pinned` (AC-13); `/pin` redirect builds
  the same (AC-16); first-pin sets `?tab=pinned` (AC-4).

Pros: deep-linkable and shareable; back/forward coherent; one route;
arrival-selection is trivial for both `/pins` and the `/pin` redirect;
no change to the existing slug-canonicalization effect. Cons: a query
param is slightly less "clean" than a path segment; must guard against
selecting `pinned` when `viewerPin` is null (a stale `?tab=pinned` on an
unpinned tag falls back to `default`).

#### Option B — component state + router nav-state

`<Link state={{ tab: 'pinned' }}>` from `/pins`; tab otherwise local
state. Pros: no URL noise. Cons: not deep-linkable; back button won't
restore the tab; the `/pin` redirect can't carry state through a plain
`<Navigate>` as cleanly; harder to reason about AC-3/AC-13 together.
Rejected.

#### Option C — nested route segment `/tag/:slug/:tagId/pinned`

Pros: cleanest URL; tab = route. Cons: most wiring (two/four route
entries incl. the bare `/tag/:tagId` variants, nested `<Outlet>` or
duplicated page), complicates the existing bare-id → slug
canonicalization redirect, and over-builds for a two-tab toggle.
Rejected for v1; revisitable if tabs proliferate.

### How the Pinned-tab content is shared with the retired page

#### Option A — extract a `PinnedListPanel` component (chosen)

Lift PinDetail's body (metadata `dl` minus the Tag row, owner actions,
Export section, member list, the `CurationMethodDialog` edit/unpin
wiring) into `ui/src/components/PinnedListPanel.jsx`. The Tag page's
Pinned tab renders `<PinnedListPanel tag viewerPin canManage onChanged />`;
the `/pin/:dTag` route becomes a thin redirect that reuses `useTLDetail`
only to resolve `sourceTag` → tag slug/eventId.

Pros: single source of truth for the member-list/metadata render (no
duplication, per the story's open question); the retired page collapses
to a redirect; the panel is independently testable. Cons: one new
component file; the panel must accept its pin context as props rather
than re-fetching.

#### Option B — keep `PinDetail` mounted inside the tab

Render the existing `<PinDetail>` (or its JSX) inside the tab via a
prop that suppresses its `TopBar`/breadcrumb/Tag-row. Pros: less code
movement. Cons: `PinDetail` reads `dTag` from `useParams()` and owns
page chrome; shoehorning it into a tab couples two layout
responsibilities and leaves a confusing half-page component. Rejected.

## Decision

We chose **Option A** for both axes: a **`?tab=pinned` query param** on
the existing tag-detail route, and a **single extracted
`PinnedListPanel`** shared between the tag-detail Pinned tab and the
(now redirect-only) `/pin/:dTag` resolution.

Rationale: the query param is the smallest mechanism that satisfies
AC-3 (default-by-pin-status), AC-4 (programmatic switch), AC-13
(`/pins` deep link), and AC-16 (`/pin` redirect) at once, while staying
deep-linkable. Extracting `PinnedListPanel` is the only option that
avoids duplicating the member-list/metadata render across two surfaces
and lets the retired page shrink to a redirect.

## Consequences

- **Enables:** one coherent per-pin surface (the tag's own page) for
  the forthcoming Refresh/Export/Sync overhaul to build on; `/pins`
  becomes a clean index; deep links to a curated list.
- **Supersedes:** ADR 0016 AC-13–AC-15 (already-pinned button →
  navigate). The button now toggles the tab. `TagPinAffordance` loses
  its `useNavigate`/`computeTLDTag` import and instead calls parent
  callbacks. A 0016 pointer note will be added for traceability.
- **Constrains / makes harder:** a non-owner can no longer view a TL's
  member list (the Pinned tab is owner-gated and `/pin` redirects into
  it). This is the **explicitly accepted** trade in Story 20 (Out of
  scope); cross-app sharing of the 30392/30000 is deferred to the
  Refresh/Sync overhaul. A stale `?tab=pinned` deep link on a tag the
  viewer hasn't pinned silently falls back to the default tab.
- **Follow-ups / debt:** `PinDetail.jsx` is reduced to a redirect shell
  (`PinRedirect`); its export-status one-shot lookup pattern moves into
  `PinnedListPanel`. The `/pins` Export/Share/Refresh/Edit per-row
  controls are removed — per-pin management now lives only on the
  Pinned tab. The page-level "Refresh all" button is **kept** for now
  (it is a batch action, not a per-row control, and the Refresh/Sync
  overhaul is next); the Implementer keeps `usePins` + `useRefreshPin`
  in `Pins.jsx` for it and removes the rest.
- **Firmware reinstall required?** **No.** No concept definitions
  change. No wire/schema change. Concepts touched (`…:tag`,
  `…:tag-pinning`, `…:nostr-user-tag`, `…:web-of-trust`) are read-side
  only.

## Implementation notes

Concrete module boundaries for the Implementer. Use runtime TA helpers
throughout (`useConfig().taPubkey`); introduce **no** pubkey literals
(keeps Story 16's violation list from growing).

### 1. New `ui/src/components/PinnedListPanel.jsx`

Extracted from `PinDetail.jsx:170-352`. Props:
`{ tag, viewerPin, canManage, onChanged }`.

- Compute `dTag = computeTLDTag({ observer: viewerPin.curationMethod?.observer || viewerPin /*owner*/, tagAuthorPubkey: tag.authorPubkey, tagSlug: tag.slug })` — mirror `TagPinAffordance.jsx:38-43` (observer falls back to the viewer's own pubkey; pass it in via props).
- `useTLDetail(dTag)` → `{ tl, members, loading, error, refetch }`.
- Render the metadata `dl` from `PinDetail.jsx:221-263` **omitting the
  `Tag` `<dt>/<dd>` block (lines 222-234)** (AC-5).
- Render owner actions (`canManage`): Refresh now, Edit curation
  (`CurationMethodDialog` with `onUnpin`), Share (`TLShareButton`),
  and the Export `<section>` (`PinDetail.jsx:265-298`) using
  `TLExportButton`. The Edit/Refresh handlers already have `pinEventId`
  via `viewerPin.pinEventId` — **no `/api/profile-tags/pins` lookup
  needed** for those (simplification vs PinDetail).
- Export status: the one detail not on `viewerPin` is
  `nip51ExportStatus` (`currentTitle`/`status`/`exportedAt`/`diffVsTL`).
  Do the same single `/api/profile-tags/pins?viewerPubkey=…` fetch
  PinDetail does (`PinDetail.jsx:62-78`), matching by tag identity, to
  feed `TLExportButton`'s `currentTitle` and the status line. `onChanged`
  bubbles to the parent's `refetchHeader` after pin edits/unpins.
- Member list from `PinDetail.jsx:300-339` verbatim (AC-6).

### 2. `ui/src/pages/Tag.jsx` — add the tab structure

- Import `useSearchParams`. Derive selected tab:
  `const tabParam = searchParams.get('tab'); const isPinned = !!viewerPin;
  const activeTab = (tabParam === 'pinned' && isPinned) ? 'pinned'
    : (tabParam === 'default') ? 'default'
    : (isPinned ? 'pinned' : 'default');`
  Keep `activeTab` in local state seeded from the above, so tab clicks
  don't depend on a re-render race; sync to the URL with
  `setSearchParams({ tab }, { replace: true })` on switch.
- Render a tab strip **only when `isPinned`** (AC-1/AC-2), keyboard-
  operable (`role="tablist"`/`tab`/`tabpanel`, arrow-key optional).
- Default tab body = the existing `bs-tag-rows` section unchanged
  (AC-7). Keep it mounted (hidden via CSS when inactive) so sort/View-
  options/filter/scroll survive tab switches (AC-7) — `display:none`
  on the inactive panel, not unmount.
- Pinned tab body = `<PinnedListPanel tag={tag} viewerPin={viewerPin}
  canManage={!!user} onChanged={refetchHeader} />`.
- First-pin auto-switch (AC-4): after `handlePin`/`publishWithCuration`
  resolves and `refetchHeader` makes `viewerPin` truthy, call
  `setActiveTab('pinned')` + sync the param.
- Pass tab state + setter down to `TagPinAffordance` (see §3).

### 3. `ui/src/components/TagPinAffordance.jsx` — button becomes a toggle

- Remove `useNavigate` + `computeTLDTag` usage.
- New props: `activeTab`, `onSwitchTab(tab)`.
- `onClick`: if not pinned → `onPin()` (unchanged immediate publish);
  if pinned and `activeTab !== 'pinned'` → `onSwitchTab('pinned')`;
  if pinned and `activeTab === 'pinned'` → `onSwitchTab('default')`.
- Labels (AC-9/10/11): unpinned `📌 Pin`; pinned+default `📌 Pinned`;
  pinned+pinned-tab `← Back to Tag`. Keep the existing
  `data-bs-tooltip` fast-onset attribute; adapt copy per state.

### 4. `ui/src/pages/Pins.jsx` — plain link rows (AC-12-15)

- Rewrite `PinRow` to a single `<Link to={`/tag/${encodeURIComponent(row.tag.slug)}/${row.tag.eventId}?tab=pinned`}>`
  containing the tag name, description, and the existing read-only
  status lines (`renderStatusLine`, `renderExportStatusLine`) **kept as
  informational**, plus a trailing `<span className="bs-pins-row-chevron" aria-hidden="true">›</span>`
  at the right edge (AC-14).
- Delete from `PinRow`: `menuOpen`/`menuRef`/overflow effect, Edit/
  Refresh/Share/Export controls, the `hasTl`/`tlDTag` link branching.
- Delete from `Pins()`: `editingPin` state, `CurationMethodDialog`
  block, `handleEditSubmit`/`handleEditUnpin`, and the `TLShareButton`/
  `TLExportButton`/`CurationMethodDialog`/`computeTLDTag` imports.
- **Keep**: `usePins`, `useRefreshPin`, the top "Refresh all" row, the
  heading/intro/sign-in/empty states (AC-15).

### 5. `ui/src/App.jsx` + `/pin/:dTag` redirect (AC-16)

- Replace `element: <PinDetail />` with a small `PinRedirect` component
  (new file or co-located): `useTLDetail(dTag)` → when `tl.sourceTag`
  resolves, `<Navigate replace to={`/tag/${encodeURIComponent(tl.sourceTag.slug)}/${tl.sourceTag.eventId}?tab=pinned`} />`;
  while loading show a minimal spinner; on not-found, redirect to
  `/pins`. `PinDetail.jsx` may be deleted once its body lives in
  `PinnedListPanel`.

### 6. `ui/src/styles.css`

- Add `.bs-tag-tablist` / `.bs-tag-tab` / panel rules and
  `.bs-pins-row-chevron` (right-aligned, always visible — no hover
  dependency, for touch clarity per AC-14).
- **Preserve** the AC-17 keep-set (`.bs-tl-export-backdrop`,
  `.bs-tl-export-popover` responsive, `.pcd-*` 480px rules).
- Remove the dead `.bs-pins-row-overflow-trigger` /
  `.bs-pins-row-actions-menu` block.

### 7. ADR 0016 traceability

Append a one-line "Partially superseded by ADR 0018 (AC-13–AC-15)" note
to `engineering-team/decisions/0016-curated-mobile-affordances-and-pin-state-polish.md`.

## Out of scope

- The Refresh/Export/Sync overhaul (next epic) — this ADR moves the
  existing controls as-is, no behavior redesign.
- Cross-app sharing of the kind-30392 TL / kind-30000 list to
  non-owners — deferred with the overhaul.
- Showing the Pinned tab to non-owners / signed-out viewers.
- Any server endpoint change (incl. folding `nip51ExportStatus` into
  `/api/profile-tags/by-id` — tempting, but the client one-shot lookup
  is sufficient for v1 and avoids a wire change).
- Nested-route tab addressing (Option C) — revisit only if tabs grow
  past two.
