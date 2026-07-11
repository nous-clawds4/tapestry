# Story 13: "Most pinned" sort, per-row counts, and own-pin indicator on the tag index

**Status:** Done
**Created:** 2026-05-20
**Type:** Feature

> **Epic-internal label:** "Story 13" in `engineering-team/epics/pin-a-tag.md`.
> Coincidentally also global #13.

## Background

Stories 10–12 shipped the Pin primitive, the TL publication pipeline,
and the curation customizer. Pinning is now real — users can do it
and produce Trusted Lists — but there is no discovery surface on the
tag index itself. A user landing on `/tags` cannot see which tags
have traction in their Web of Trust, cannot sort by "most pinned,"
and cannot tell at a glance which tags they have already pinned.

This story turns Story 4's tag index (`/tags`) into a pin-aware
surface. It adds three things, all under the active POV's WoT
scope:

1. A per-row **pin count** (number of distinct WoT-trusted authors
   who have pinned this tag).
2. A new **"Most pinned" sort** option alongside the existing
   `used` / `endorsed` / `divisive` modes.
3. An **"Only tags I've pinned"** filter toggle, plus a per-row
   **own-pin indicator** that marks tags the viewer has personally
   pinned regardless of the filter state.

No new wire shape. The Pin events from Story 10 already live in
local strfry; this story aggregates them per-tag under the active
POV's WoT-author filter — the same pattern `handleProfilesTagged`
(Story 3) and `runOnePin` (Story 11) already use for endorsement
counts.

Per POV-first: the count and the sort are **per-POV**. Switching
POV recomputes both. There is no "the count" — only "the count
under THIS observer's WoT."

## User-facing description

As an authenticated user browsing the tag index, I want to see how
many people in my Web of Trust have pinned each tag, sort by that
count, filter to only the tags I've pinned, and recognize at a
glance which tags I have already pinned — so that I can quickly
find tags worth pinning and stay aware of my own curated set.

## Acceptance criteria

- [ ] **AC-1** — Given I am on `/tags` under any POV, when the
  page loads, then every tag row in the listing displays a
  **pin-count badge** showing the number of distinct WoT-trusted
  authors who have published a Pin event for that tag. Rows with
  zero WoT-trusted pinners show **0** (not hidden).

- [ ] **AC-2** — Given I switch the sort toggle to **Most pinned**,
  when the page re-loads, then rows are ordered by their pin count
  descending; ties break on the existing secondary criterion the
  other sorts use (tag-event-id ascending — matches Story-4's
  pattern).

- [ ] **AC-3** — Given the sort toggle exposes `used`, `endorsed`,
  `divisive`, and `most-pinned`, when I look at the toggle, then
  "Most pinned" is one of the visible options and is selectable
  with the same affordance as the others.

- [ ] **AC-4** — Given my POV changes (house ↔ user), when the
  page re-fetches, then both the **per-row pin counts** and the
  **Most-pinned sort order** recompute against the new POV's WoT
  filter — without a full page reload (the existing POV-change
  hooks invalidate the index fetch).

- [ ] **AC-5** — Given I am NIP-07-authenticated and have pinned
  one or more tags, when I look at the tag index, then each row
  whose tag I have personally pinned carries an inline
  **own-pin indicator** (visible regardless of the active sort or
  filter — e.g., a small 📌 chip on the tag-name or in the row's
  metadata area).

- [ ] **AC-6** — Given I am NIP-07-authenticated, when I look at
  the tag-index controls, then I see a **filter toggle** labeled
  something like "Only tags I've pinned"; when I enable it, then
  the listing narrows to only the rows whose tag I have personally
  pinned (the AC-5 indicator is now redundant but still rendered
  for consistency); when I disable it, the full WoT-scoped listing
  returns.

- [ ] **AC-7** — Given I am NOT NIP-07-authenticated, when I look
  at `/tags`, then the **filter toggle** and the **own-pin
  indicator** are not rendered (there is no "my pins" to reference);
  the per-row pin count (AC-1) and the new sort option (AC-2) ARE
  rendered (they are not viewer-scoped, they are POV-scoped, and the
  house POV still applies for an anonymous viewer).

- [ ] **AC-8** — Given a tag with kind-5-deleted Pin events in its
  history, when the pin count is computed, then the deleted Pin
  events do NOT count toward the total (strfry's index already
  honors kind-5 deletions; the count operates on the live scan).

- [ ] **AC-9** — Given a tag where the same author has published
  multiple Pin events for it across time (only the latest survives
  per addressable-replaceable semantics), when the pin count is
  computed, then that author contributes **1** to the count, not
  N (dedupe is on `(author, d-tag)`).

- [ ] **AC-10** — Given pagination on `/tags` (Story 4's existing
  limit/offset), when a page loads, then sort + count + filter +
  own-pin indicator are correctly applied to the requested page —
  i.e., the server (not the client) applies the pin-count sort and
  filter so pagination remains correct.

## Concepts touched

- `39998:<TA>:tag-pinning` (Story 10) — the Pin events being
  aggregated.
- `39998:<TA>:tag` — the tag concept whose index this story
  enriches.
- `39998:<TA>:web-of-trust` — the per-POV filter applied to pin
  authors.
- **No new concepts** — this is pure read-side aggregation.

## Out of scope

- **Pin counts on the tag-detail page** — only the index gets the
  treatment in v1. Tag-detail already shows the "Pin / Unpin"
  affordance, which is the viewer's own state; adding the WoT-scoped
  count there is a future polish story.
- **Pin counts in the autocomplete popup** — the BrainstormSearch
  popup's tag results stay as-is in v1.
- **"Most pinned" filter on profile search** — the chip filter from
  Story-11's amendment already lets users narrow profile results to
  TL members; this story is about the *tag* index, not profiles.
- **Multi-facet filters** — only one filter toggle in v1
  ("Only tags I've pinned"). "Pinned by ≥ N people in my WoT" or
  similar threshold filters are deferred.
- **Per-row drill-down** ("Who pinned this?") — clicking the
  pin-count badge does NOT open a list of pinners in v1. Future
  polish.
- **Counts at TL publication time** — the count and the sort are
  read-time aggregations only; no precomputed column per tag.
  (Same "filter at view time" principle as the rest of the codebase.)
- **Pagination-cursor-based** ordering — Story 4's offset/limit
  pattern is reused; cursor pagination is a separate refactor.
- **Cross-POV counts** ("how many pinners across all POVs?") — only
  the active POV's WoT counts in v1.
- **Kind-30000-style "your pins" list reading** — the own-pin
  indicator reads from the existing
  `/api/profile-tags/pins?viewerPubkey=...` (Story 10), not from any
  new follow-set event.

## Open questions

These belong to the Architect to resolve in Phase 2:

- **Server endpoint shape:** extend `/api/profile-tags/index` with
  a new optional aggregation pass, or add a sibling endpoint that
  enriches the existing response? — Architect.

- **Cost of pin aggregation on every `/tags` request:** with
  pagination, the server must aggregate ALL pins (to know which
  rows go on this page when sorted by `most-pinned`) before
  slicing. Memoize per request? Per minute? Per minute per POV?
  Probably fine for v1 scale; the Architect picks the shape. —
  Architect.

- **Own-pin marker placement:** chip next to the tag name? Badge
  on the row's metadata line? Highlight the row entirely? UX
  judgment, low stakes. — Architect.

- **Filter toggle's interaction with sort:** when the
  "Only tags I've pinned" toggle is on, does sorting by
  "Most pinned" still make sense (since you're filtered to your
  own pins, which by definition have you in their WoT)? Or does
  the toggle force a different default sort? — Architect.

- **Visibility of the pin-count for logged-out users:** AC-7 says
  yes-show-it; if the count is computed under a "house" POV that
  is itself unconfigured, what shows? **0 for every tag** is the
  safe default; Architect to confirm.

- **Performance budget:** the same WoT-author filter Story 11's
  cron uses costs one Meili bulk-fetch per request. With many tags
  on the index page, the per-author Meili lookup is the dominant
  cost. Acceptable in v1; flag if measured.

## Linked artifacts

- Epic: `engineering-team/epics/pin-a-tag.md`
- Predecessor stories:
  - `engineering-team/stories/done/4-tag-index-page.md` (the index
    surface this story extends)
  - `engineering-team/stories/done/10-pin-a-tag.md` (the Pin events
    being aggregated)
  - `engineering-team/stories/done/11-tl-publication-from-pins.md`
    (the WoT-author filter pattern via `aggregateProfilesTagged`
    that this story echoes for pin aggregation)
- ADR: `engineering-team/decisions/0012-most-pinned-tag-index.md`
- Test plan: `engineering-team/stories/done/13-most-pinned-tag-index.test-plan.md`
- Review: `engineering-team/reviews/13-most-pinned-tag-index.md`
