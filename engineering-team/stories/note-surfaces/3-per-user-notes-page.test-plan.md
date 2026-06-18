# Test Plan: Story note-surfaces #3 — Per-user notes page (`/user/:pubkey/notes`)

**Story:** `engineering-team/stories/note-surfaces/3-per-user-notes-page.md`
**ADR:** `engineering-team/decisions/note-surfaces/0002-note-surfaces-ui.md`
**Date:** 2026-06-18
**Test file:** `test/note-surfaces-ui.test.js` (shared with Story #2; wired into `test/test.js`)

## Scope

Covers **Story #3 — the public `/user/:pubkey/notes` page** (`ui/src/pages/BrainstormUserNotes.jsx` + its route in `ui/src/App.jsx`, consuming the shared `ui/src/hooks/useUserNotes.js` at limit 50). The shared hook (U1–U2) and the Content section (U3–U8) belong to Story #2's plan but live in the same file.

## Test level (read this first)

Source-text assertion, as for Story #2 — the house `ui/src/*.jsx` convention (no JSX transpile in the Node runner). The page delegates its body to a **pure, named-exported `renderUserNotesState`** with module-level `NOTES_COPY` constants. The runtime properties source can't prove — an anonymous `GET /user/<pubkey>/notes` returning 200 with a rendered card, and **no horizontal overflow at 1280px** — are the **staging** capstone (a `curl` 200 check + a DOM/visual extract), gathered after deploy per the ADR. This suite proves the page is *built-to-render* the populated/empty states and *wired-to-be* a public, width-bounded route.

## Coverage map

| Criterion | Test name | Level |
|---|---|---|
| **#3** route reachability | `U9: App.jsx registers /user/:pubkey/notes → BrainstormUserNotes, public top-level (before /tapestry)` | source |
| **#3** list + card reuse | `U10: the page uses useUserNotes(pubkey, 50), reuses the public shell, renders notes via NoteCard` | source |
| **#3** order (no re-sort) | `U11: the OK branch maps items in ARRAY ORDER and does NOT re-sort` | source |
| **#3** whose notes | `U12: the page fetches the subject profile name (/api/profiles?pubkeys=) and shows it` | source |
| **#3** empty state | `U13: the empty/defensive branch shows "no kind-1 events could be located", no entries` | source |
| **#3** heading + back link | `U14: the page shows a "Notes" heading and a back link to the profile` | source |
| **#3** testability | `U15: renderUserNotesState is a named-exported PURE function (no fetch/hook/router/globals)` | source |
| **#3** no overflow @1280px | `U16: the note-card text wraps + the notes column is width-bounded` | source |
| **#3** additive route | `R1: App.jsx still registers the existing /user/:pubkey/* sub-routes — /notes added beside them` | regression |
| (card reused, no fork) | `R2: NoteCard is reused as-is — single { item } prop, no variant fork` | regression |
| (shared hook) | `U1–U2` (see Story #2 plan) | source |

## Edge cases (explicitly covered)

- [x] **Public reachability** — the route sits in the top-level group (before `/tapestry` admin), so the SPA fallback serves it to anonymous clients; runtime 200 is the staging `curl` capstone (U9).
- [x] **Newest-first, no re-derivation** — renders the read path's array order; `.sort` on items is banned (U11).
- [x] **Whose notes even when empty** — the subject name comes from a profile fetch, not from `items[0]` (which is absent when empty) (U12).
- [x] **No locatable note** → the empty message, no entries (U13).
- [x] **Transport/INVALID failure** → collapses to the same empty message via the pure helper's defensive branch (U13 + U15).
- [x] **No 1280px overflow** — shared `bsp-note-card-*` text wraps + a width-bounded column (U16).
- [x] **Additive** — existing `/user/:pubkey/*` routes preserved (R1); NoteCard not forked (R2).

### Deliberately NOT covered here

- The read path (Story #1).
- The Content section body (Story #2, U3–U8).
- **Rendered 200 + the ≥1-card screenshot + the 1280px no-scrollbar proof** → the **staging** capstone (`curl` for the 200/content-type, a DOM/visual extract for the card and overflow). Local full-stack verification is intentionally skipped — the shared local Docker stack belongs to a parallel session.

## Test infrastructure

Identical to Story #2's plan — Node runner via `npm test`, pure source assertion, no new framework / JSX transpile / `react-dom`, no live services, no fixtures.

## How to run

```
npm test
```

Run just this suite:

```
node -e "require('./test/note-surfaces-ui.test.js').run().then(r => console.log(JSON.stringify(r)))"
```

## Verification

The `U9–U16` Story-#3 tests fail with the current code — `BrainstormUserNotes.jsx`, `useUserNotes.js` don't exist and `App.jsx` has no `/user/:pubkey/notes` route (legible "does not exist yet" messages). `R1`/`R2` PASS now (the existing routes and NoteCard are present and unmodified). Captured output is in the gate summary (commit recorded at the phase boundary).
