# ADR 0013: Notes-tab View Options at parity with Profiles — shared control + server-side sort

**Status:** Accepted
**Date:** 2026-07-01
**Story:** `engineering-team/stories/event-tagging/15-notes-tab-view-options-parity.md`
**Builds on:** ADR 0008 (`/api/event-tags/for-tag`, Notes tab), ADR 0014 (Profiles-tab View options / curated-vs-expanded).

## Context

The tag-detail **Profiles** tab uses `TagViewControls` (the "View options" disclosure: sort chips + text filter + "Tag someone" button) with a curated-default vs expanded row list (`Tag.jsx`). The **Notes** tab (`TagNotesView`, Story 8) shipped a *lighter, bespoke* control (a text "View options" toggle + Recent/Most-applied, sorted client-side). The operator wants the Notes tab identical, control-for-control, to Profiles.

A tagging is `(tag, target, polarity, asserter)` regardless of target type, so every Profiles sort has a note meaning. `for-tag` already returns each note with POV-counted `applications`/`disputes` + `mine`, but only ever sorted by tagging-recency and capped at `NOTES_CAP=50` most-recently-tagged. Sorting the returned ≤50 client-side (as Story 8 did) means a non-recency sort only reorders within the newest-tagged 50, not the full tagged set.

## Decision (two operator calls, 2026-07-01)

**1. Sort set — Profiles' three + a `recent` default (not the 5-item list literally in the story).**
The actual Profiles tab exposes `applied / disputed / divisive`; it has no `recent` or `most-backed`. For notes, `most-backed` (most peers applying the tag) collapses into `applied` (each application *is* a backer), so it would be a duplicate. The Notes tab therefore exposes **`recent` (default) / `applied` / `disputed` / `divisive`** — Profiles' three plus the natural note default. Profiles is left untouched.

**2. Sort scope — server-side over the full set, then cap.**
Add a `sort` param to `/api/event-tags/for-tag`. Per-note trusted counts already exist (`countByTarget`) *before* the `NOTES_CAP`, so ranking all tagged notes by the chosen sort and then taking the top-50 is correct over the whole universe and no more expensive than the recency cap it replaces. (Notes only the viewer tagged, `mine`, have no trusted backers → 0/0 → they sort to the bottom of a metric sort but stay visible via recency; `recent` keeps its old behavior.)

**Server (`handleForTag`):**
- Accept `sort ∈ {recent, applied, disputed, divisive}` (default `recent`); add it to the cache key and echo it in the response.
- Rank `rankedIds` by `sort` before slicing to `NOTES_CAP` (recency is the universal tiebreak); order the resolved/enriched page by the same comparator.

**UI:**
- `useNotesForTag(tagAuthor, slug, viewerPubkey, sort)` — new `sort` arg, sent as a param, in the effect deps.
- Generalize `TagViewControls` with `sortOptions` / `sortAriaLabel` / `filterPlaceholder` / `filterAriaLabel` / `hidePrimary` (all defaulting to the existing Profiles behavior, so Profiles is unchanged).
- `TagNotesView` renders `TagViewControls` (not a bespoke control) with the note sort options and `hidePrimary` (the "+ Tag someone" button is Profiles-only; the Notes-tab "+ Tag a Note" is Story 16). Curated-default vs expanded and the text filter mirror `Tag.jsx`'s `displayedRows`: curated keeps net-endorsed notes (`applications > disputes`) plus the viewer's own (`mine`); ordering comes from the server (no client-side re-sort).

## Operator refinements (2026-07-01, post-impl)

- **Pinned-tab strip label.** When the viewer has pinned the tag, the tab strip's first tab was "Tagged profiles" — but it holds the Profiles|Notes switch, so it spans all taggings. Renamed to **"Taggings"** (`Tag.jsx`). (Pins themselves are Story 12.)
- **Chip scoring trio on notes (expanded).** On Profiles, the inline net/+applied/−disputed tally is always shown. For notes, the per-tag counts previously lived only in the chip's hover popover. Now, when the Notes tab's **View options is expanded**, each tag chip on every note renders a net/applied/disputed trio **below** the chip (below, not beside — avoids line-break weirdness when a note carries many tags on a narrow screen). Threaded as an opt-in prop `NoteCard.showTagScores → NoteTags.showScores → TagChip.showScores` (default off, so all other note surfaces are unchanged); the counts come from `TagChip`'s existing `applications`/`disputes` arrays (no new fetch).

## Consequences

- Notes and Profiles now share one control; a future change to the disclosure benefits both.
- Non-recency note sorts are correct over the full tagged set, not just the recency-capped page. The `NOTES_CAP` still bounds how many are *resolved*, but now bounds "top-N by the chosen sort".
- `most-backed` is intentionally omitted for notes (≈ `applied`); if a distinct backer metric is ever defined it can be added to `FOR_TAG_SORTS`.
- Curated-collapsed + a `disputed`/`divisive` sort can show little (curated hides net-negative notes) — this exactly matches the Profiles tab and is intended parity, not a regression.
