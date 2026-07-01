# Story 15: Tag-detail "Notes" tab — View Options at full parity with "Profiles"

**Status:** Draft · **Created:** 2026-07-01 · **Type:** Feature · **Epic:** event-tagging · **Book:** unified-tagging-ui

## Background
On the tag-detail page (`ui/src/pages/Tag.jsx`), the **Profiles** tab uses `TagViewControls`
(`ui/src/components/TagViewControls.jsx`) — the "View options" disclosure with sort chips
(`SortToggle`), a text filter, and the "+ Tag someone" button — plus the curated-default vs
expanded behavior (`Tag.jsx` curated logic: collapsed shows net-positive rows, expanded shows all).
The **Notes** tab (`ui/src/components/TagNotesView.jsx`, Story 8) currently has a *lighter, custom*
control (a "View options" text toggle + Recent/Most-applied). The operator wants the Notes tab to be
**identical, control-for-control**, to the Profiles tab.

A tagging is `(tag, target, polarity, asserter)` regardless of target type, so every Profiles sort
has an exact note meaning — full parity, not a subset.

## Requirement
Make the **Notes** tab's View Options **identical in UI/UX** to the **Profiles** tab: same component
(`TagViewControls` — generalize it or a shared control), same **position**, same **look**, same
**curated-default vs expanded** behavior, same **text filter**, and **full sort parity**:
`recent` (note post time), `applied` (applications), `disputed` (disputes), `most-backed`
(most people backing the tagging), `divisive` (min(applied,disputed)). "most recent" is the natural
default for notes.

## Acceptance criteria
- [ ] **Same control, same place, same look.** The Notes tab renders the same View-options
  disclosure as Profiles (same component/styling/position), not a bespoke one.
- [ ] **Curated default vs expanded** matches Profiles: collapsed shows the curated set
  (net-endorsed notes + the viewer's own), expanded shows all; identical affordance.
- [ ] **Full sort parity:** recent / applied / disputed / most-backed / divisive all present and
  functioning over the notes, with the same labels/UX as Profiles.
- [ ] **Text filter** present and behaves like Profiles.
- [ ] **Profiles tab unchanged.**

## Notes / design
- `for-tag` (`/api/event-tags/for-tag`) already returns each note with `applications`/`disputes`
  counts + `mine` (Story 8), so the sorts are computable. **Decide** (Architecture): sort
  client-side over the returned set, or add a `sort` param to `for-tag` for true parity over the
  full set (note the current `NOTES_CAP=50` recency cap — a sort other than recency over a
  recency-capped set is a known limitation; may want server-side sort+cap).
- `most-backed` = the note-tagging with the most backers (peers applying the same tag on that note),
  mirroring the Profiles peer-backed sort.
- Reuse/rename `TagViewControls` so both tabs share it (drop the "+ Tag someone" button on the Notes
  tab — that's replaced by "+ Tag a Note", Story 16).

## Key files
- `ui/src/pages/Tag.jsx`, `ui/src/components/TagNotesView.jsx`, `ui/src/components/TagViewControls.jsx`,
  `ui/src/components/SortToggle.jsx`, `ui/src/hooks/useNotesForTag.js`, `src/api/event-tags/index.js`
  (`handleForTag` — if server-side sort is chosen).

## Linked artifacts
- Built on Story 8 (Notes tab) + ADR 0009. Book: `engineering-team/audits/unified-tagging-ui/book.md`.
