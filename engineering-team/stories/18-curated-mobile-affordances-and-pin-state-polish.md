# Story 18: Curated-view mobile affordances + Pin button state polish

**Status:** Approved
**Created:** 2026-05-28
**Type:** Feature (UX polish bundle, follow-on to Story 17)

> **Why this story exists, in one paragraph:** Story 17 shipped the
> Curated view, hover-only per-row action buttons, and a simplified
> curation dialog. Living with it surfaced three rough edges: (a) on
> touch devices the hover-only `[apply]`/`[dispute]` buttons are
> effectively unreachable because there is no hover state; (b) the
> per-row Net score and `+N / −M` counts still feel busy in the
> default Curated view — the user came to read the curated list,
> not to scan numbers; and (c) the Pin button still routes every
> first pin through the curation dialog even though Story 17's
> WYSIWYG invariant (Curated == cutoff=1 defaults) means the dialog
> is just friction the first time. This story closes those gaps,
> plus accelerates tooltip onsets globally so the help text feels
> attached to the cursor instead of arriving late.
>
> Separately, the Pin button's state when a tag is already pinned
> currently *unpins* on click. That's a destructive click on a
> non-destructive-looking control; it should instead route the user
> to the pin's detail page so they can inspect / edit / unpin
> deliberately from there.

## Background

After Story 17 (`engineering-team/stories/17-tag-detail-curated-view-and-pin-polish.md`)
shipped, the tag-detail page Curated view renders, per row:

- A Net score (`+N` green / `−N` red / `0` yellow) — always visible.
- A small `+N / −M` count, secondary to Net.
- Per-row `[apply]` / `[dispute]` action buttons that materialize
  on hover (desktop), with no equivalent affordance on touch.

On a phone, this means the per-row action buttons can't be reached
at all (there is no hover), and the row's visual weight is dominated
by score numbers most readers don't need on the default view —
they're already looking at the *curated* list. The "View options"
disclosure exists precisely to surface the raw scoring view when
wanted; this story leans into that distinction.

The Pin button, once a tag is pinned, currently behaves as a toggle
— a second click unpins. That conflicts with how the label reads
(no warning, no confirm) and contradicts the deliberate
inspect-then-decide flow the `/pins` page supports. Story 17 left
this behavior unchanged; this story corrects it.

Tooltips across the page (Pin button explanation per AC-17 of
Story 17, and other tooltipped affordances) currently use a delay
long enough that they feel detached from the cursor — by the time
the tooltip arrives, the user has often moved on. The whole-app
tooltip onset should be faster.

This story is **purely client-side, UI-layer**. No event-wire
changes. No server changes. No concept-graph changes. No firmware
reinstall.

A separate, larger epic — **NIP-51 Kind 30000 list export
alongside the existing kind-30392 TL** — is teed up to follow this
story; it is explicitly out of scope here (see Out of scope and
Linked artifacts).

## User-facing description

As a user on a phone browsing a tag's detail page, I want a clear,
tappable way to apply / dispute / see scores for any profile in the
list — and as a user on desktop, I want the default Curated view to
stay visually clean, surfacing scores and actions only when I show
intent (hover, or open View options). As a user pinning a tag, I
want the first pin to "just work" with sensible defaults instead of
making me answer a settings dialog; and once a tag is pinned, I
want the Pin button to take me to the pin so I can manage it
deliberately — not silently unpin when I tap it again.

## Acceptance criteria

### Curated view — desktop, per-row presentation

- [ ] **AC-1** — Given I am on a tag-detail page with View options
  **collapsed** (default Curated view), when a row renders without
  hover/focus, then **neither the Net score nor the small `+N / −M`
  count nor the `[apply]`/`[dispute]` action buttons are visible**.
  The row presents only the profile's identity affordances (avatar,
  name, NIP-05, etc.) and the mobile overflow trigger described in
  AC-4.

- [ ] **AC-2** — Given the same default Curated view, when I hover
  a row (desktop), then **all three appear at once**: Net score,
  small `+N / −M` count, and the `[apply]` / `[dispute]` action
  buttons, in the same visual treatment Story 17 established
  (Net prominent, `+N / −M` secondary, action buttons styled as
  today).

- [ ] **AC-3** — Given the View options disclosure is **expanded**
  (the "Raw data" / debug-like mode from Story 17 AC-11), when any
  row renders, then the Net score and `+N / −M` count are visible
  **always**, exactly as they render today after Story 17. The
  `[apply]` / `[dispute]` buttons in this mode remain hover-only
  (consistent with Story 17 AC-8 and AC-11 for expanded mode), so
  expanded mode behaves identically to today's shipped behavior for
  buttons but identically to today's shipped behavior for scores
  as well. **The change in this story is scoped to the collapsed
  Curated view.**

- [ ] **AC-4** — Given AC-1's appear/disappear of scores AND
  buttons on hover, when I move my pointer onto and off of any
  row, then **no layout shift** occurs anywhere on the page
  (Story 17 AC-9's "no jiggle" rule continues to hold and now
  covers scores too).

### Curated view — mobile / touch, per-row overflow menu

- [ ] **AC-5** — Given I am viewing a tag-detail page on a touch
  device (or at a viewport where hover is not the dominant input,
  per the same media-query heuristic the project already uses
  elsewhere if one exists; otherwise the Architect picks), when
  each row renders, then a right-aligned **overflow trigger** (the
  conventional `⋯` / three-dot icon) is visible on the row, in a
  position that does not cause layout shift relative to the
  desktop hover state.

- [ ] **AC-6** — Given the overflow trigger renders on a touch row,
  when I tap it, then a menu / popover / action sheet (Architect
  picks the shape; the project's existing menu/popover idiom if one
  exists) appears anchored to the row and contains, at minimum:
    - the row's Net score (with the same green/red/yellow color
      semantics as desktop hover);
    - the row's small `+N / −M` count;
    - the `[apply]` and `[dispute]` action buttons (or their
      "Applied" / "Disputed" already-acted states, matching
      Story 17 AC-8).

- [ ] **AC-7** — Given the overflow menu is open, when I tap an
  action button inside it (`apply` or `dispute`), then the action
  fires identically to its desktop hover-button equivalent
  (same signing flow, same optimistic UI, same error handling
  Story 17 left in place). After the action resolves, the menu
  closes.

- [ ] **AC-8** — Given the overflow menu is open, when I tap
  outside the menu, or tap the overflow trigger again, or tap an
  explicit close affordance if the Architect adds one, then the
  menu closes and the rest of the page is unchanged (scroll
  position, View options expansion state, filter text from
  Story 17 AC-5, sort).

- [ ] **AC-9** — Given the mobile overflow menu pattern from AC-5,
  AC-6, when the same surface appears in the **"Tag someone"
  search-result modal** (Story 17 AC-13–AC-15a — search-result
  rows with hover-only action buttons), then those rows also get
  the overflow trigger and menu on touch, with the same contents
  (Verification Score in lieu of Net for not-yet-tagged candidates
  per Story 17 AC-15, plus `+N / −M` if the candidate already has
  assertions under POV, plus the `[apply]` / `[dispute]` buttons).
  **The mobile fix is symmetric across both row contexts.**

### Pin button — first-pin defaults shortcut

- [ ] **AC-10** — Given I am on a tag-detail page for a tag I have
  NOT yet pinned, when I click the Pin button, then **no curation
  dialog is shown**. The pin is published immediately using the
  Story-17 defaults exactly as they exist at the time this story
  ships (cutoff=1, observer=self, includeScoreInTL=true; if those
  defaults shift, this AC tracks "whatever the current defaults
  are" — the AC's hard requirement is "no dialog interstitial").

- [ ] **AC-11** — Given AC-10's no-dialog flow, when I want to
  change the pin's curation settings later, then the existing edit
  path on `/pins` (Story 12) remains the way to do that, exactly
  as it works today. **This story does not remove the curation
  dialog — it only stops auto-presenting it on first pin.** The
  dialog still renders when invoked from the `/pins` edit
  affordance.

- [ ] **AC-12** — Given AC-10, when the first-pin publish
  succeeds, then the Pin button transitions to the already-pinned
  state described in AC-14 below, without page reload, without a
  modal interstitial, without an explicit "success" toast that the
  user has to dismiss (an inline / unobtrusive confirmation is
  fine — the Architect picks; the AC's rule is "no blocking
  interstitial after a first pin").

### Pin button — already-pinned state behavior

- [ ] **AC-13** — Given a tag I have already pinned, when I view
  its tag-detail page, then the Pin button renders with the label
  **"Pinned"** (instead of "Pin" / "Unpin" or whatever the toggle
  label is today). The visual treatment should signal "this is
  a status, not a destructive control" — the Architect picks the
  treatment; the requirement is that the label reads "Pinned" by
  default.

- [ ] **AC-14** — Given the same already-pinned state, when I
  hover the button (desktop), then the label transitions to
  **"View Pin"** (or visually equivalent — a single label change
  that signals what clicking will do). When I touch-focus the
  button on a touch device, the label transition is not required
  to occur on touch (the *behavior* in AC-15 still applies — the
  hover-label transition is a desktop affordance).

- [ ] **AC-15** — Given the already-pinned Pin button, when I
  click / tap it, then I am navigated to the pin's own detail page
  (e.g. `/pin/<pin-id>` — the existing route shape; Story 13 ships
  that page). **Clicking does NOT unpin.** Unpinning continues to
  be available from the pin detail page or from `/pins`, both of
  which surface explicit unpin affordances today.

- [ ] **AC-16** — Given the Pin button tooltip from Story 17 AC-17
  (the "what pinning does" tooltip), when I hover the Pin button
  in its unpinned state, then the tooltip onset is **faster** than
  it is today (see AC-17 for the global rule; this AC is a
  specific case of it). When the button is in its already-pinned
  state per AC-13, the tooltip copy should adapt to reflect the
  click-action it will perform ("View this pin" or similar) — the
  Architect picks final copy.

### Global tooltip onset

- [ ] **AC-17** — Given any tooltipped affordance in the
  application (not just the Pin button), when I hover it (or
  long-press on touch, where touch tooltips exist), then the
  tooltip appears noticeably faster than it does today. "Noticeably
  faster" is the Architect's call — a globally consistent shorter
  onset delay is the rule; specific milliseconds and which
  tooltip mechanism is in scope (project-internal Tooltip
  component, native `title`, third-party library, etc.) are the
  Architect's call. **Out of scope** for this story: revisiting
  *what* each tooltip says, *which* affordances have tooltips, or
  introducing tooltips where none exist today.

### Cross-cutting / regressions

- [ ] **AC-18** — Given Story 17's existing acceptance criteria
  that this story does NOT explicitly amend, when the page renders,
  then those behaviors continue to hold (e.g. View options
  disclosure (AC-3/AC-4 of Story 17), client-side text filter
  (AC-5 of Story 17), curation-dialog header copy when the dialog
  IS shown via `/pins` edit (AC-18 of Story 17), cutoff default of
  1 (AC-19 of Story 17), Advanced disclosure hidden (AC-20 of
  Story 17), Include scores hidden (AC-21 of Story 17), WYSIWYG
  invariant (AC-22 of Story 17)).

- [ ] **AC-19** — Given AC-1's hidden-by-default scores in the
  Curated view, when a screen reader navigates the row, then the
  Net score and `+N / −M` count are **still announced** as part
  of the row's accessible name / description (visually hidden but
  in the accessibility tree). The desktop hover-reveal pattern is
  a visual treatment, not an information-hiding decision. Mobile
  overflow trigger should be labeled accessibly (e.g.
  `aria-label="Actions for <profile name>"`).

## Concepts touched

- `39998:<TA>:tag` — no schema change. Pure read-side UI polish.
- `39998:<TA>:tag-pinning` — no schema change; no default-value
  change (Story 17 already moved cutoff default to 1).
  This story changes only *when* the curation dialog is shown
  (only on edit, not on first pin).
- `39998:<TA>:nostr-user-tag` — no change.
- `39998:<TA>:web-of-trust` — no change.
- **No new concepts.** No firmware reinstall.

(All concept handles use `<TA>` placeholders per the
runtime-TA-pubkey rule in CLAUDE.md; the Architect will resolve at
implementation time, not bake in literals.)

## Out of scope

- **NIP-51 Kind 30000 list export.** Publishing a parallel kind-30000
  list alongside the existing kind-30392 TL so that any
  NIP-51-compliant Nostr client can consume pinned-tag membership is
  a separate, larger epic (own concepts, own publishing path, own
  acceptance criteria, possibly own concept additions and a firmware
  reinstall). To be planned as the next epic *after* this story
  ships. Documented in this story's Linked artifacts.

- **Story 17 ACs that this story does not explicitly amend.** This
  story is a follow-on polish; it does not re-litigate any Story 17
  AC except where called out (AC-1, AC-2, AC-3 change the Curated
  default per-row visibility from Story 17's AC-6/AC-7/AC-8; AC-10
  changes the Story 17 AC-18 dialog-on-pin trigger; AC-13–AC-15
  add behavior the original Pin button did not have).

- **Pin-event encryption (Story 15).** Still paused.

- **Treasure Map integration (Story 14).** Still paused.

- **Runtime TA-pubkey migration (Story 16).** Still pending. This
  story MUST itself use runtime TA helpers everywhere — no new
  literals — so the violation list does not grow.

- **A general mobile / responsive design pass beyond the AC-5–AC-9
  overflow-menu pattern on tag-detail rows and "Tag someone" search
  rows.** A broader mobile audit is its own story.

- **Pagination-aware Curated filtering on the server.** Still
  client-side over the existing endpoint, per Story 17's note.

- **Adding tooltips where none exist** — see AC-17 boundary.

- **Removing the Pin curation dialog from `/pins` edit flow.** It
  is still the way to change pin settings after the first pin.

- **A confirmation modal before unpinning from the pin detail
  page.** Existing affordances on `/pins` and `/pin/<id>` remain
  whatever they are today.

## Open questions

These belong to the Architect or to the user to resolve in Phase 2:

- **Hover-and-touch media-query heuristic for AC-5.** Does the
  project already standardize on a `@media (hover: none) and
  (pointer: coarse)` or similar block? Reuse if yes, else introduce
  in this story (one well-placed util, not scattered). — Architect.

- **Mobile overflow menu chrome (AC-6).** Is there an existing
  popover / dropdown / action-sheet pattern in the codebase to
  reuse, or does this story introduce one? — Architect. If
  introducing, prefer the simplest thing that meets the AC; avoid
  installing a new dependency.

- **First-pin "no interstitial" confirmation pattern (AC-12).**
  Inline transition of the Pin button from "Pin" → "Pinned" is
  expected; whether a passive toast / status line is wanted in
  addition is the Architect's call. The rule is "no blocking
  dialog or modal."

- **Already-pinned button hover-label transition (AC-14).** Is
  this a pure CSS hover-state label swap, a JS hover-managed
  label, or an aria-label-only signal? Should the underlying
  click handler change shape (the click handler must navigate,
  not toggle, per AC-15)? — Architect.

- **Already-pinned tooltip copy (AC-16).** Final wording for the
  already-pinned-state tooltip. PO suggests: *"View this pin's
  details and members."* Architect adopts or rewrites.

- **Global tooltip onset value (AC-17).** Specific delay (e.g.
  150ms vs 200ms vs 250ms), and which tooltip mechanism(s) are
  in scope (project Tooltip component if one exists, native
  `title`, library-provided). — Architect.

- **Touch tooltip semantics (AC-17).** Many touch UAs don't fire
  hover events; the tooltip story for touch is often "long-press
  triggers info." Whether AC-17 changes anything for touch is
  Architect's call; if existing tooltips are desktop-only today,
  this story doesn't add a touch tooltip story.

- **Accessibility tree for hidden scores (AC-19).** The exact
  technique (visually-hidden CSS, aria-hidden=false on the
  always-rendered nodes, etc.) — Architect picks. The rule: a
  screen reader gets the same information whether the scores are
  visually shown or hidden.

## Linked artifacts

- **Direct predecessor (this story polishes its output):**
  - `engineering-team/stories/17-tag-detail-curated-view-and-pin-polish.md`
  - `engineering-team/decisions/0014-tag-detail-curated-view-and-pin-polish.md`
  - `engineering-team/reviews/17-tag-detail-curated-view-and-pin-polish.md`
    (or wherever Story 17's review landed)
- **Pin-stack stories whose curation-dialog presentation this
  story tweaks (without removing the dialog itself):**
  - `engineering-team/stories/done/10-pin-a-tag.md`
  - `engineering-team/stories/done/11-tl-publication-from-pins.md`
  - `engineering-team/stories/done/12-customize-pin-curation.md`
  - `engineering-team/stories/done/13-most-pinned-tag-index.md` (defines
    the `/pin/<pin-id>` detail route that AC-15 navigates to)
- **Still-pending / paused stories that this story does NOT
  unblock:**
  - `engineering-team/stories/14-treasure-map-pin-integration.md` (paused)
  - `engineering-team/stories/16-runtime-ta-pubkey-migration.md` (pending)
- **Follow-on epic (planned next, OUT of scope here):**
  - **NIP-51 Kind 30000 list export alongside kind-30392.**
    Publish a parallel kind-30000 list whose members match the
    pin's TL membership, so that *any* NIP-51-compliant Nostr
    client (not just 30392-aware ones) can consume the pin for
    discovery and ranking. To be opened as its own epic / story
    after this one ships.
- ADR: `engineering-team/decisions/0016-curated-mobile-affordances-and-pin-state-polish.md`
- Test plan: **skipped** by PO decision 2026-05-28 — Story 18 is a UI nudge bundle (CSS reveal rules, label/hover swaps, a one-line click handler reroute, a small popover). No behavior change at the data/wire layer. Manual smoke during Implementation + Review covers it. Reviewer should verify the AC walkthrough by hand in browser at both desktop and a touch viewport.
- Review: (filled in after Review phase)
