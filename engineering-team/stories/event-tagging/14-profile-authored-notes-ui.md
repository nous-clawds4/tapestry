# Story 14: Profile "Tagging Activity" spans notes (intermixed)

**Status:** ⚠️ NEEDS REWORK — approach changed (operator, 2026-07-01). The first impl (a
separate `AuthoredNotesSection`) is **superseded**: notes must be **folded into the existing
"Tagging Activity" toggle**, intermixed with profile-taggings, hidden by default. See below.
**Created:** 2026-06-30 · **Type:** Feature · **Epic:** event-tagging · **Book:** unified-tagging-ui

## Background
`AuthoredTaggingSection` (`ui/src/components/AuthoredTaggingSection.jsx`) is the profile's "Tagging
Activity" — a **collapsed-by-default** `<section>` (its `collapsed` state defaults `true`, header
chevron toggles) that, when expanded, shows a `SortToggle` + rows (`AuthoredTagRow`) of the
**profile**-taggings this person authored (from `/api/profile-tags/authored-by`, via
`useAuthoredTagging`). Currently split into "About me" (targets === viewer) + "others".

The endpoint for the person's **note**-taggings already exists: `/api/event-tags/notes-by-author`
(Story 11 / ADR 0010) → `{ notes: [ enriched + taggedWith:[{authorPubkey,slug,stance}] ] }`.

## Requirement (the rework)
**Do not** ship a separate "NOTES TAGGED" section. Instead, **fold the note-taggings into
`AuthoredTaggingSection`'s existing toggle**, intermixed with the profile-taggings in the same
expandable list, hidden by default (the section already is). One "Tagging Activity" that shows
*everything this person has tagged* — people and notes together.

- Delete `ui/src/components/AuthoredNotesSection.jsx` + its render in `BrainstormProfile.jsx`
  (added in the superseded impl). Keep/adapt `ui/src/hooks/useNotesByAuthor.js`.
- `AuthoredTaggingSection` fetches **both** `authored-by` (profiles) and `notes-by-author` (notes),
  merges into one list, and renders each row by target type: a **profile** row (existing
  `AuthoredTagRow`) or a **note** row (renders the target note — a compact `NoteCard` or a note
  reference — with the tag(s) applied + polarity).
- Intermix + sort together (see Story 15's sort parity — the same sort controls apply here too;
  at minimum default to recency across both).

## Acceptance criteria
- [ ] **One section, intermixed.** Expanding "Tagging Activity" shows both the profiles and the
  notes this person has tagged, in one list — no separate notes section.
- [ ] **Hidden by default.** Unchanged: the section stays collapsed by default.
- [ ] **Note rows are legible.** A note-tagging row shows the target note + the tag(s) applied and
  the stance (apply/dispute), distinct from a profile-tagging row.
- [ ] **Profiles rows unchanged.** Existing profile-tagging rows/behavior are preserved.
- [ ] **Empty/POV/own-view** behave sensibly (section hidden when the person has tagged nothing).

## Key files
- `ui/src/components/AuthoredTaggingSection.jsx` (extend), `ui/src/hooks/useAuthoredTagging.js`,
  `ui/src/hooks/useNotesByAuthor.js` (keep), `ui/src/components/NoteCard.jsx` (note rendering),
  `ui/src/pages/BrainstormProfile.jsx` (remove the separate section render).
- Endpoints (built): `/api/profile-tags/authored-by`, `/api/event-tags/notes-by-author`.

## Linked artifacts
- ADR: 0010 (endpoint). Superseded impl: commits 6be3dc17 / prior (separate section). Book:
  `engineering-team/audits/unified-tagging-ui/book.md`.
