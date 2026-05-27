# Story 17: Tag-detail page Curated view + Pin curation menu simplification

**Status:** Draft
**Created:** 2026-05-26
**Type:** Feature (UX polish bundle)

> **Why this story exists, in one paragraph:** The pin-a-tag epic
> (Stories 10–13 shipped) put real pin/TL machinery on the rails,
> but the tag-detail page and the Pin curation menu still read like
> debug surfaces: every sort knob is visible, every raw +N/−M count
> is in the user's face, every action button is glued to the row,
> low-trust noise (disputes ≥ applies) is mixed into the same view
> as high-confidence members. Before the pin-a-tag epic ships to
> production (via Story 16's TA-pubkey migration), this story
> reshapes the tag-detail page into a clear default Curated view
> with the raw controls tucked behind a "View options" disclosure,
> and trims the Pin curation menu to the two fields that actually
> matter in v1.

## Background

Currently `/tag/:slug/:eventId` (`ui/src/pages/Tag.jsx`, fed by
`handleProfilesTagged` in `src/api/profile-tags/index.js:683–...`)
renders:

- A "View all my pinned tags" link (redundant with the user menu).
- A "Created by …" line (low-signal; the tag-author identity is
  not what users come to a tag-detail page for).
- Three sort chips (`most-applied`, `most-disputed`, `most-divisive`)
  always visible, which makes the page feel like a query builder.
- Per-row counts in the shape `+N / −M` with `[apply] [dispute]`
  buttons always-on, glued to the row. This creates two problems:
  (a) the row's most useful summary signal — net agreement — has
  to be computed by the reader's eye; (b) the always-on buttons
  make the row visually busy and make it harder to skim a long list.
- A "Search for profile to tag…" input that visually bleeds into
  the tagged-profiles list (search results land in the same column
  as the list rows), creating mode confusion.
- A Pin button that opens a curation dialog with three editable
  fields (`cutoff`, `includeScoreInTL`, an Advanced `observer`
  pubkey) and no in-context explanation of what pinning *does*.
- Cutoff defaults to **2**, which is stricter than what the default
  read view of the page implies a "list member" is. A profile may
  appear in the row list under default sort (peer-counted) but NOT
  appear in the TL the user would publish if they pinned-with-defaults.
  That mismatch is unintuitive.

Reader-side filtering already happens at view time per the POV-first
invariant: every tag-detail read endpoint applies
`wot_rank_<povSuffix> >= minRank` to assertion authors when a POV is
configured. This story does NOT add new server-side filters; it
reshapes which slice of the *already-POV-filtered* data the default
view exposes, and adds one client-side text filter on top.

**Confirmed during planning:** Curated-view membership (Net ≥ 1,
i.e. `applications > disputes`) is algorithmically identical to the
Pin TL membership at `cutoff = 1` under the same POV. With this
story's cutoff-default change to 1, "what I see in the Curated view"
will equal "what gets published if I pin this tag with defaults" —
which is the WYSIWYG promise we want before shipping to production.

## User-facing description

As a user browsing a tag's detail page, I want a clean default view
that shows me only the profiles that genuinely belong on the tag,
ranked by my Web of Trust's consensus, with the option to drop into
a raw/expanded mode when I need it — and when I decide to pin the
tag, I want a simplified curation menu whose defaults match what I
just saw, so I never wonder whether what I'm publishing differs from
what's on screen.

## Acceptance criteria

### Tag-detail page header / layout

- [ ] **AC-1** — Given I am on a tag-detail page, when the page
  renders, then the "View all my pinned tags" link is NOT present
  (the user-menu entry remains the canonical way in).

- [ ] **AC-2** — Given I am on a tag-detail page, when the page
  renders, then the "Created by …" line is NOT present.

- [ ] **AC-3** — Given I am on a tag-detail page, when the page
  renders, then the sort chips (`most-applied`, `most-disputed`,
  `most-divisive`) are NOT visible by default; they live inside a
  collapsible disclosure region.

- [ ] **AC-4** — Given the page renders, when I look at where the
  sort chips used to be, then I see a right-aligned text affordance
  with a chevron labeled something like **"View options"** that
  expands/collapses the region containing the sort chips and an
  additional text-filter input (see AC-5). The exact label and
  affordance shape is the Architect's call; the disclosure must
  be keyboard-operable.

- [ ] **AC-5** — Given the View options region is expanded, when I
  type into the text filter, then the list of profiles below is
  narrowed client-side to those whose `name`, `display_name`, NIP-05,
  bio, or website matches the typed string (the same fields the
  main Brainstorm search already searches). Empty input → no
  client filter. The filter operates on whatever set the active
  sort + view (Curated or expanded) is currently producing.

### Per-row presentation

- [ ] **AC-6** — Given the profile list renders any row in the
  Curated default view, when I look at the row, then I see a
  **Net score** equal to `applications − disputes`, rendered:
    - `+N` in green if Net > 0,
    - `−N` in red if Net < 0 (won't appear in Curated view per
      AC-9 but the styling rule covers expanded mode),
    - `0` in yellow if Net == 0 (won't appear in Curated view per
      AC-9; yellow signals contested in expanded mode).
  The Net score is visually larger than the existing `+N / −M`
  detail line.

- [ ] **AC-7** — Given the same row, when I look at the existing
  `+N / −M` applied/disputed count, then it is rendered slightly
  smaller and at slightly lower color saturation than today, and
  positioned **just to the right** of the Net score (the
  Architect picks the exact treatment; the rule is that the
  small `+N / −M` is visually secondary to the Net score).

- [ ] **AC-8** — Given any row, when I am NOT hovering / NOT
  touch-focused, then the per-row `[apply]` / `[dispute]` action
  buttons are NOT visible; when I hover (or, on touch, first-tap
  the row), then the buttons appear. If I have already applied or
  disputed this row, the button labels reflect that state ("Applied"
  / "Disputed") the same way they do today — this affordance is
  preserved.

- [ ] **AC-9** — Given a row's appear/disappear of (a) the Net
  score (Curated view), (b) the small `+N / −M` count, and (c) the
  hover-only action buttons, when I move my pointer onto and off
  of any row, then **no layout shift** occurs anywhere on the page
  — neither the row itself nor adjacent rows shift position. The
  Architect's suggested approach (scores right-aligned; buttons
  appear in the freed middle ground on hover) is the recommended
  shape but the AC is "no jiggle," not a specific layout.

### Curated vs expanded behavior

- [ ] **AC-10** — Given the page renders by default (View options
  collapsed), when the list of profiles is composed, then ONLY
  rows with `Net ≥ 1` (i.e. `applications > disputes`) appear.
  Profiles with `applications ≤ disputes` are hidden.

- [ ] **AC-11** — Given the View options disclosure is expanded,
  when the list re-renders, then all WoT-filtered rows appear
  regardless of Net (this is "Raw data" mode — internal naming;
  not exposed in the UI), and per-row Net scores, `+N / −M`
  counts, and action buttons are all visible at all times (the
  AC-8 hover-only behavior applies ONLY in the collapsed/Curated
  view).

- [ ] **AC-12** — Given the Curated default view, when the page
  fetches its data, then the active POV is **house** unless the
  viewer has explicitly switched to their own POV via the existing
  POV selector. This matches today's default; the AC documents
  it as load-bearing for Curated semantics (the Curated set is
  whatever the house WoT trusts unless the user has overridden).

### "Tag someone" — search → tag affordance

- [ ] **AC-13** — Given the page renders, when I look at the row
  containing "View options" (right-aligned), then on the same row,
  **left-aligned**, I see a button labeled something like
  **"Tag someone"**. The button is visible regardless of whether
  the user is NIP-07-authenticated *for display*; if not
  authenticated, clicking surfaces the standard "sign in to tag"
  flow already used elsewhere in the app.

- [ ] **AC-14** — Given I click "Tag someone", when the modal
  opens, then it is a **clearly-separate modal/dialog** — not an
  inline expansion bleeding into the profile list. The modal
  presents a search input with the same matching surface as the
  main Brainstorm search.

- [ ] **AC-15** — Given the "Tag someone" modal is open and I have
  typed a query, when results render, then each result row shows
  the profile's **Verification Score** in the same slot the
  tagged-list rows use for Net score (since search results are
  candidates, they have no `+N / −M` yet by definition). If a
  searched profile already has assertions against this tag under
  the active POV's WoT, then its `+N / −M` count appears to the
  **left** of its Verification Score.

- [ ] **AC-15a** — Given a "Tag someone" search-result row, when I
  am NOT hovering / NOT touch-focused, then the per-row `[apply]`
  / `[dispute]` action buttons are NOT visible; when I hover (or,
  on touch, first-tap the row), then the buttons appear. If the
  searched profile already has my own application or dispute
  recorded under the active POV, the button labels reflect that
  state ("Applied" / "Disputed"), matching AC-8's behavior on the
  main tagged-list rows. No layout shift on appear/disappear
  (AC-9 applies here too).

- [ ] **AC-16** — Given the "Tag someone" modal, when I close it
  (Escape, click-outside, or an explicit Close affordance), then
  the modal disappears and the page underneath is in the exact
  state I left it (sort, View-options expansion state, filter
  text, scroll position).

### Pin button + curation menu

- [ ] **AC-17** — Given the Pin button on the tag-detail page,
  when I hover (desktop) or long-press (touch) it, then a tooltip
  appears with a short, plain-language explanation of what pinning
  does, similar in intent to: *"Pin this tag to publish a Trusted
  List (kind-30392) curated to your preferences. Other Nostr apps
  can read it for content discovery and trust-weighted ranking."*
  The Architect picks the final copy.

- [ ] **AC-18** — Given I click Pin and the curation dialog opens,
  when I look at the dialog's header area, then it contains a
  short explanatory paragraph at the top — similar in shape and
  intent to the `<PinsIntro />` block on `/pins`
  (`ui/src/pages/Pins.jsx:28–40`). Final copy is the Architect's;
  the AC's hard requirement is "an explanation lives at the top
  of the dialog."

- [ ] **AC-19** — Given the curation dialog renders any time
  (pin-from-tag-detail OR Edit from `/pins`), when I look at the
  cutoff field, then its **default value is 1** (was 2). Existing
  pin rows being edited still surface whatever value the stored
  pin already carries.

- [ ] **AC-20** — Given the curation dialog renders, when I look,
  then the **Advanced disclosure** (`observer` pubkey field) is
  NOT visible. The observer is resolved server-side at TL-refresh
  time via the existing POV cascade (user POV → house POV); this
  story does not change that semantic, only hides the manual
  override. The dialog's stored `curation-method.observer` value
  for new pins is the viewer's own pubkey, matching today's
  default.

- [ ] **AC-21** — Given the curation dialog renders, when I look,
  then the **Include rank scores in TL** checkbox is NOT visible.
  New pins are published with `curation-method.includeScoreInTL = true`
  by default. Existing pins being edited retain whatever value
  they currently store; the field is simply not user-editable in
  this iteration.

- [ ] **AC-22** — Given a user pins a tag with the defaults of
  this story (cutoff=1, observer=self, includeScoreInTL=true),
  when the TL is generated and the user looks at the Curated
  default view of the same tag-detail page under the same POV,
  then the set of profiles in the published TL **equals** the set
  of profiles shown in the Curated view. (This is the WYSIWYG
  invariant — the whole point of aligning Curated with cutoff=1.)

## Concepts touched

- `39998:<TA>:tag` — no schema change; this is pure read-side UI
  reshaping of how tag-detail data is presented.
- `39998:<TA>:tag-pinning` — no schema change; the
  `curation-method.cutoff` default value changes from 2 to 1, but
  the wire shape and field set are unchanged.
- `39998:<TA>:nostr-user-tag` — no change.
- `39998:<TA>:web-of-trust` — no change; the existing
  `wot_rank_<suffix>` filter at the server is the single source of
  POV-correctness.
- **No new concepts.** No firmware reinstall.

## Out of scope

- **Changes to the Pin event wire shape or the TL wire shape.**
  Cutoff default flips from 2 to 1, but the field still exists,
  the JSON shape doesn't move, and any historical pin events with
  cutoff=2 continue to work unmodified.
- **Story 14 (Treasure Map integration).** Explicitly paused.
- **Story 15 (Pin event encryption).** Explicitly paused.
- **Story 16 (Runtime TA pubkey migration).** Comes after this
  story. This story MUST itself use the runtime TA helpers from
  the start — do not introduce new literals — so Story 16's
  violation list does not grow.
- **Server-side changes to the WoT-author filter or to any tag
  read endpoint.** The Curated-view filtering happens at the
  client (it's `Net ≥ 1` applied to the already-POV-filtered rows
  the existing endpoint returns). Adding a server-side
  `?curated=1` flag is tempting but is not necessary for v1 and
  would couple the view to a wire decision.
- **POV-selector reachability from the avatar menu.** Tracked
  separately in `engineering-team/follow-ups.md` ("Cross-page POV
  invalidation"). This story does NOT add that surface; it relies
  on the existing POV selector wherever it lives today.
- **A new "Recently tagged" or "Sort by recency" mode.** The three
  existing sorts get the disclosure treatment; no new sort is
  added.
- **Mobile-only specific UI work beyond the AC-8 / AC-15a
  "first-tap reveals buttons" rule.** A broader mobile pass is
  its own story.

## Open questions

These belong to the Architect or to the user to resolve in Phase 2
(noted explicitly which):

- **Exact placement of the Net score within the row.** Suggested
  shape during planning: scores right-aligned, action buttons
  materialize in the freed middle ground on hover. The AC ("no
  jiggle") is the constraint; the Architect commits to a concrete
  pattern that meets it.

- **"View options" disclosure pattern.** Suggested: right-aligned
  text + chevron, click toggles, region animates open. The
  Architect picks the exact widget (native `<details>`, custom,
  or the project's existing disclosure idiom if one already
  exists).

- **"Tag someone" modal styling.** The codebase already has a
  curation-dialog pattern (`ui/src/components/CurationMethodDialog.jsx`).
  Reuse that modal chrome or pick a different one? — Architect.

- **Mobile first-tap UX for action buttons (AC-8).** Single
  first-tap on a row reveals action buttons; the second tap on a
  button performs the action. Confirmed pattern, or is something
  different needed (e.g., a long-press alternative)? — Architect.

- **Tooltip mechanic for Pin button (AC-17).** Native `title`
  attribute is simplest but not great UX for touch. Use the
  project's existing tooltip pattern if one exists, otherwise
  pick. — Architect.

- **Curation dialog header copy (AC-18).** Specific final wording.
  PO suggests: borrow from `PinsIntro` (`Pins.jsx:28–40`) verbatim
  or near-verbatim. — Architect to confirm.

- **Pin button tooltip copy (AC-17).** Specific final wording.
  Sample from planning: *"Pin this tag to publish a Trusted List
  (kind-30392) curated to your preferences. Other Nostr apps can
  read it for content discovery and trust-weighted ranking."*
  Architect adopts or rewrites.

- **Client-side filter input behavior (AC-5).** Debounce
  characteristics, case-sensitivity, NIP-05 normalization (the
  existing main search has answers; reuse those). — Architect.

- **Curated-view server interaction.** The Curated rule (Net ≥ 1)
  is applied client-side over the existing endpoint's response.
  Is the pagination model (Story 4's offset/limit pattern, if it
  reaches the tag-detail page) ever an issue if the server returns
  a page where most rows fail the client filter? In practice
  tag-detail today does not paginate, but if it does in the
  future, server-side Curated filtering may be wanted. Flag for
  future revisit; not load-bearing now. — Architect to note.

## Linked artifacts

- **Predecessor stories (read-side UI being reshaped):**
  - `engineering-team/stories/done/2-tag-detail-page-read.md`
  - `engineering-team/stories/done/3-tag-detail-page-write.md`
  - `engineering-team/stories/done/5-authored-tagging-on-profile.md`
- **Pin-stack stories whose curation-dialog this story trims:**
  - `engineering-team/stories/done/10-pin-a-tag.md` (default
    `curation-method` JSON; cutoff=2 default originated here)
  - `engineering-team/stories/done/11-tl-publication-from-pins.md`
    (`refreshPinnedTags.js` is the call site that reads cutoff;
    no change to it is needed — the change is purely to the
    *value* the dialog writes into new pin events)
  - `engineering-team/stories/done/12-customize-pin-curation.md`
    (the curation dialog this story simplifies)
- **POV-correctness baseline (does NOT change here):**
  - `src/api/_shared/pov.js:46–70` (`resolvePov`)
  - `src/api/profile-tags/index.js:479–522`
    (`aggregateProfilesTagged`) — the WoT-author filter; same
    behavior the Curated view layers on top of.
- **Confirmation captured during planning (2026-05-26):** Curated
  view (Net ≥ 1, applications > disputes) is algorithmically
  identical to Pin TL membership at cutoff=1 under the same POV.
  This is why AC-19 changes the default to 1.
- **Successor stories (do NOT proceed until this ships):**
  - `engineering-team/stories/16-runtime-ta-pubkey-migration.md`
    (cross-cutting migration; ships after this story)
- **Story 14 (paused):**
  `engineering-team/stories/14-treasure-map-pin-integration.md`
- ADR: `engineering-team/decisions/0014-tag-detail-curated-view-and-pin-polish.md`
- Test plan: `engineering-team/stories/17-tag-detail-curated-view-and-pin-polish.test-plan.md`
- Review: `engineering-team/reviews/17-tag-detail-curated-view-and-pin-polish.md`
