# Story 20: Move Pin detail into a Tag-detail "Pinned" tab; simplify /pins rows

**Status:** Approved
**Created:** 2026-05-29
**Type:** Feature (UX restructure)

> **Why this story exists, in one paragraph:** The pin stack today
> spreads one pinned tag across three surfaces: the tag-detail page
> (`/tag/:slug/:tagId`), a standalone Trusted-List detail page
> (`/pin/:dTag`), and the `/pins` index. A user who pins a tag is
> bounced to a separate page to see "who's on the list," and the
> `/pins` rows are cluttered with per-row action controls. This story
> consolidates: the pinned-list view becomes a **"Pinned" tab on the
> tag's own detail page**, the `/pins` rows become plain tappable
> links, and the standalone `/pin` page is retired (it redirects into
> the new tab). This lands *before* the larger Refresh/Export/Sync
> rework so that rework has one clean surface to build on.

## Background

Three surfaces exist today:

- **`/tag/:slug/:tagId`** (`ui/src/pages/Tag.jsx`) — the tagged-profiles
  list with Stories 17/18 Curated view, View options, "Tag someone"
  modal, and a header Pin button (`TagPinAffordance`). When a tag is
  already pinned, that button currently navigates to `/pin/:dTag`
  (Story 18 AC-15).
- **`/pin/:dTag`** (`ui/src/pages/PinDetail.jsx`) — the standalone
  Trusted-List detail page: TL metadata (`Tag`, `Observer`, `Cutoff`,
  `Min rank`, `Last refreshed`, `d-tag`, `Share ID (naddr)`), owner
  actions (Refresh now, Edit curation, Share, NIP-51 Export), and the
  member list (the kind-30392 TL members under the pin's curation
  settings).
- **`/pins`** (`ui/src/pages/Pins.jsx`) — the viewer's pinned-tag
  index. Rows historically carried inline action buttons / a mobile
  overflow menu; the user wants them reduced to plain links.

The user's confirmed intent:

- **Consolidate to two surfaces.** The pinned-list view moves onto the
  tag's own detail page as a **"Pinned" tab**. The standalone `/pin`
  page is retired; any `/pin/:dTag` URL **redirects** to the owning
  tag's detail page with the Pinned tab selected. ("Nobody really uses
  the `/pin` share page" — broader TL/30000 sharing is revisited in the
  later Refresh/Sync overhaul; for now the pin is primarily the owner's
  own view.)
- **The Pinned tab is the owner's view.** Only a viewer who has pinned
  the tag gets the tab. A non-owner can still obtain the kind-30392
  identifier; a dedicated cross-app sharing affordance for the 30392
  (and the forthcoming 30000) is explicitly future work.
- **Return-visit default is the Pinned tab.** If the viewer has pinned
  this tag, the Pinned tab is the default selection on every visit.

This story is **purely client-side, UI-layer**. No event-wire changes,
no server changes, no concept-graph changes, no firmware reinstall. It
reuses the existing data hooks (`useTagDetail` for the default tab,
`useTLDetail` for the Pinned tab — the same hook `PinDetail.jsx` uses
today).

**Working-tree constraint (carried in from the current branch):** the
in-flight changes that make modal-type surfaces more usable on mobile
— specifically moving action menus away from anchored/popover menus
toward full modals / bottom-sheets (e.g. in `TagSomeoneModal` and the
per-row action affordances) — are **important and must be preserved**.
The pins-specific WIP in the working tree (the half-stripped `PinRow`
etc.) is disposable and may be redone to meet this story's ACs. The
Architect/Implementer must distinguish the "mobile modal usability"
changes (keep) from the "pins layout" changes (rework) — see AC-17.

## User-facing description

As a user who has pinned a tag, I want the pinned list and its
controls to live right on that tag's detail page under a "Pinned" tab —
so I don't get bounced to a separate page, and switching between "all
tagged profiles" and "my curated list" is one click. As a user on the
`/pins` index, I want each row to be a single, obviously-tappable link
straight to that tag's Pinned tab, without action clutter — and I want
it to be clear the row is tappable even on mobile where there's no
hover.

## Acceptance criteria

### Tag-detail page — the "Pinned" tab

- [ ] **AC-1** — Given a viewer who has **not** pinned the current tag
  (including signed-out viewers), when the tag-detail page renders,
  then **no "Pinned" tab is shown** — the page presents the
  tagged-profiles view exactly as it does today (Stories 17/18 Curated
  view, View options, "Tag someone" all intact). A single-view page
  with no visible tab strip is acceptable; the Architect picks whether
  a tab strip renders at all in the unpinned state.

- [ ] **AC-2** — Given a viewer who **has** pinned the current tag,
  when the page renders, then a tab affordance is present offering at
  least two tabs: the **default** tab (tagged profiles) and the
  **"Pinned"** tab. The tab control is keyboard-operable.

- [ ] **AC-3** — Given a viewer who has pinned the current tag, when
  they load or revisit the page (a fresh navigation, not mid-session),
  then the **Pinned tab is selected by default**.

- [ ] **AC-4** — Given a viewer on the default tab who has **not** yet
  pinned, when they pin the tag (header button — immediate publish with
  Story-18 defaults), then on success the view **auto-switches to the
  Pinned tab** without a page reload, and the "Pinned" tab affordance
  is now present (AC-2).

- [ ] **AC-5** — Given the Pinned tab is selected, when it renders,
  then it shows the content currently on `/pin/:dTag` —
    - TL metadata: Observer, Cutoff, Min rank, Last refreshed, d-tag,
      and Share ID (naddr),
    - the owner-gated actions that exist today (Refresh now, Edit
      curation, Share, NIP-51 Export section),
    - the retracted notice when applicable,
  - **EXCEPT** the **"Tag" metadata row is omitted** (it is redundant
    on the tag's own detail page).

- [ ] **AC-6** — Given the Pinned tab is selected, when the profile
  list renders, then it shows **only the kind-30392 TL members** under
  the pin's curation settings (the same set `PinDetail.jsx` shows
  today, with avatars, name/NIP-05, and endorsement/dispute counts) —
  **not** the full tagged-profiles list.

- [ ] **AC-7** — Given the default tab is selected, when the profile
  list renders, then it shows the tagged-profiles list exactly as
  today (Curated default, View options expansion, client-side filter,
  per-row action affordances per Stories 17/18). Switching to the
  Pinned tab and back preserves the default tab's state (sort, View
  options expansion, filter text) for the duration of the session.

- [ ] **AC-8** — Given owner-gated controls inside the Pinned tab
  (Refresh now, Edit curation, Unpin via the curation dialog), when the
  viewer is the pin owner, then those controls behave exactly as they
  do on `/pin/:dTag` today (same endpoints, same signing flow, same
  optimistic refresh). Unpinning remains available via the Edit
  curation dialog; **switching tabs never unpins.**

### Header button as a tab toggle (supersedes Story 18 AC-13–AC-15)

- [ ] **AC-9** — Given a viewer who has **not** pinned the tag, when
  they view the header button, then it reads **"Pin"** and clicking it
  pins immediately with defaults (Story-18 behavior, unchanged) and
  triggers AC-4's switch to the Pinned tab.

- [ ] **AC-10** — Given a viewer who **has** pinned the tag and is on
  the **default** tab, when they view the header button, then it reads
  **"Pinned"**; clicking it **switches to the Pinned tab**. It does
  **not** navigate to `/pin/:dTag` (that page is retired, AC-16) and it
  does **not** unpin.

- [ ] **AC-11** — Given a viewer who has pinned the tag and is on the
  **Pinned** tab, when they view the header button, then it reads
  **"Back to Tag"**; clicking it switches to the **default** tab.

### `/pins` index — plain link rows

- [ ] **AC-12** — Given the `/pins` page renders pinned-tag rows, when
  a row renders, then it carries **no interactive controls** — no
  Refresh, Edit, Share, Export buttons and no overflow / anchored menu.
  Read-only informational text (tag name, description, and the existing
  TL / export **status lines**) may remain; the hard requirement is
  that the row exposes no action buttons or menus.

- [ ] **AC-13** — Given a `/pins` row, when the viewer clicks or taps
  it, then they navigate to that tag's detail page **with the Pinned
  tab selected** (`/tag/:slug/:tagId`, Pinned tab active on arrival).

- [ ] **AC-14** — Given a `/pins` row, when it renders, then a
  right-aligned **chevron ("›")** appears at the row's right edge,
  visible **without hover**, signaling the row is tappable (so the
  affordance is clear on touch devices).

- [ ] **AC-15** — Given the `/pins` page, when it renders, then the
  page's existing top-level affordances unrelated to per-row actions
  (heading, intro copy, sign-in prompt when signed out, empty state)
  continue to work. (The top-of-list "Refresh all" control is part of
  the forthcoming Refresh/Sync overhaul; this story does **not** need
  to remove it, but removing it is acceptable if the Architect finds it
  orphaned by the row simplification — flag the choice on the ADR.)

### `/pin/:dTag` retirement

- [ ] **AC-16** — Given any `/pin/:dTag` URL is visited, when it
  resolves, then the viewer is **redirected** to the corresponding
  tag's detail page with the Pinned tab selected. The redirect resolves
  the owning tag (slug + event id) from the TL's source-tag data. The
  standalone `PinDetail` page is no longer reachable as a distinct
  surface. (Existing share links / bookmarks therefore land on the
  Pinned tab rather than 404ing.)

### Cross-cutting

- [ ] **AC-17** — Given the working-tree changes that improve mobile
  usability of modal-type surfaces (moving action menus away from
  anchored/popover menus toward full modals / bottom-sheets — e.g. in
  the "Tag someone" modal and per-row action affordances), when this
  story ships, then on a touch / mobile viewport those surfaces present
  as full modals / bottom-sheets (not anchored dropdowns clipped to a
  row), and that behavior is **preserved, not regressed**. The
  pins-specific WIP may be reworked freely to meet AC-12–AC-14; the
  mobile-modal-usability improvements must survive.

- [ ] **AC-18** — Given Stories 17 and 18's behaviors that this story
  does not explicitly amend (Curated view, View options, client-side
  filter, "Tag someone" modal contents, curation-dialog defaults, fast
  tooltip onset, mobile overflow affordances on tagged-profile rows),
  when the tag-detail default tab renders, then those behaviors
  continue to hold. The only Story-18 behavior this story **changes**
  is AC-13–AC-15 (the already-pinned header button now toggles the
  Pinned tab instead of navigating to `/pin/:dTag`).

## Concepts touched

- `39998:<TA>:tag` — no schema change; read-side UI restructuring.
- `39998:<TA>:tag-pinning` — no schema change; the pin event and its
  `curation-method` are unchanged. This story only changes *where* the
  pin's TL is viewed and *how* the header button behaves.
- `39998:<TA>:nostr-user-tag` — no change.
- `39998:<TA>:web-of-trust` — no change; POV-correctness baseline
  (server-side `wot_rank_<suffix>` filtering) is untouched.
- The published **kind-30392** TLs (Story 11) — surfaced in the Pinned
  tab via the existing `useTLDetail` hook. Not a firmware concept.
- **No new concepts. No firmware reinstall.**

(All concept handles use `<TA>` placeholders per the runtime-TA-pubkey
rule in CLAUDE.md; resolve at runtime — do not introduce literals, so
Story 16's violation list does not grow.)

## Out of scope

- **The Refresh / Export / Sync overhaul.** Explicitly the *next*
  change after this layout restructure lands. This story moves the
  existing Refresh-now / Edit / Export / Share controls into the Pinned
  tab **as they are**; it does not redesign their behavior.
- **Cross-app sharing affordances for the kind-30392 TL (and the
  forthcoming kind-30000 list).** The user will revisit TL/30000
  sharing during the Refresh/Sync overhaul. This story does not build a
  new "share this list with a non-owner" surface; non-owners simply do
  not get the Pinned tab.
- **Showing the Pinned tab to non-owners / signed-out viewers.** The
  tab is owner-gated. (Decided 2026-05-29: redirect `/pin` into the
  owner's tab; accept that shared-link viewing by non-owners is paused
  until the sharing overhaul.)
- **Server-side changes**, new endpoints, or wire-shape changes.
- **Story 14 (Treasure Map integration), Story 15 (pin encryption),
  Story 16 (runtime TA-pubkey migration).** Unchanged by this story;
  Story 16 still pending. This story MUST use runtime TA helpers — no
  new literals.
- **A broader mobile / responsive design pass** beyond preserving the
  AC-17 modal-usability improvements already in the working tree.

## Open questions

These belong to the Architect to resolve in Phase 2:

- **Tab widget + URL representation.** What selects the Pinned tab — a
  query param (`?tab=pinned`), a route segment, or pure component
  state plus navigation state from `/pins`? AC-13 (a `/pins` row lands
  on the Pinned tab) and AC-16 (the `/pin` redirect lands on it) both
  need a way to *request* the Pinned tab on arrival. Pick a single
  mechanism. — Architect.
- **Pinned-tab data loading.** The Pinned tab needs the TL d-tag to
  call `useTLDetail`. Today `TagPinAffordance` computes it via
  `computeTLDTag({ observer, tagAuthorPubkey, tagSlug })`. Reuse that;
  confirm the observer resolution (curation-method observer → viewer
  pubkey) matches the existing `/pin` path. — Architect.
- **`/pin/:dTag` redirect resolution.** The redirect must map a TL
  d-tag back to a tag slug + event id. `useTLDetail` exposes
  `tl.sourceTag` (slug + eventId). Render a tiny resolver at `/pin/:dTag`
  that fetches the TL then redirects, or push the mapping server-side?
  Prefer the smallest client-only solution. — Architect.
- **Disposition of `PinDetail.jsx`.** Once the content moves into the
  Pinned tab, is the page deleted, or reduced to the redirect shell?
  How much of its JSX (metadata `dl`, member list, export section) is
  extracted into a shared component the Pinned tab and the (now
  retired) page both used? Avoid duplicating the member-list render. —
  Architect.
- **Default-tab state preservation across tab switches (AC-7).** Keep
  the default tab mounted (hidden) to preserve scroll/sort/filter, or
  lift that state up and remount? — Architect.
- **`/pins` row content after stripping actions (AC-12).** Keep the
  TL/export status lines as read-only text, or drop them entirely
  pending the Refresh/Sync overhaul? PO leans "keep as read-only";
  Architect confirms. — Architect.
- **Which working-tree hunks are "mobile modal usability" vs "pins
  layout" (AC-17).** The Architect should diff the current branch
  against its base, classify each modified hunk, and record in the ADR
  which changes are preserved verbatim vs reworked. — Architect.

## Linked artifacts

- **Direct predecessors (surfaces this story restructures):**
  - `engineering-team/stories/done/10-pin-a-tag.md` — pin event +
    `/pins` origin.
  - `engineering-team/stories/done/11-tl-publication-from-pins.md` —
    the kind-30392 TL shown in the Pinned tab.
  - `engineering-team/stories/done/12-customize-pin-curation.md` — the
    curation dialog (still the home for Edit / Unpin).
  - `engineering-team/stories/done/13-most-pinned-tag-index.md` —
    defines the `/pin/:dTag` route this story retires.
  - `engineering-team/stories/17-tag-detail-curated-view-and-pin-polish.md`
    (ADR 0014) — the tag-detail default tab this story keeps intact.
  - `engineering-team/stories/18-curated-mobile-affordances-and-pin-state-polish.md`
    (ADR 0016) — **AC-13–AC-15 of Story 18 are superseded here** (the
    already-pinned header button toggles the Pinned tab instead of
    navigating to `/pin/:dTag`).
- **Key source surfaces:**
  - `ui/src/pages/Tag.jsx` — gains the tab structure.
  - `ui/src/pages/PinDetail.jsx` — content moves into the Pinned tab;
    page retired to a redirect (AC-16).
  - `ui/src/pages/Pins.jsx` — rows simplified to links + chevron.
  - `ui/src/components/TagPinAffordance.jsx` — header button becomes a
    tab toggle.
  - `ui/src/App.jsx` — `/pin/:dTag` route disposition.
  - `ui/src/hooks/useTLDetail.js` — reused by the Pinned tab.
- **Follow-on (explicitly next, OUT of scope here):** the Refresh /
  Export / Sync overhaul, which will also revisit cross-app sharing of
  the kind-30392 TL and the kind-30000 NIP-51 list.
- ADR: `engineering-team/decisions/0018-pin-detail-into-tag-pinned-tab.md`
- Test plan: `engineering-team/stories/20-pin-detail-into-tag-pinned-tab.test-plan.md`
- Review: `engineering-team/reviews/20-pin-detail-into-tag-pinned-tab.md` (CHANGES_REQUESTED 2026-05-29 — Story-19 Playwright spec AC-19 still targets the retired /pin page)
