# Test Plan: Story note-surfaces #2 — Profile "Content" section

**Story:** `engineering-team/stories/note-surfaces/2-profile-content-section.md`
**ADR:** `engineering-team/decisions/note-surfaces/0002-note-surfaces-ui.md`
**Date:** 2026-06-18
**Test file:** `test/note-surfaces-ui.test.js` (shared with Story #3; wired into `test/test.js`)

## Scope

Covers **Story #2 — the profile "Content" section** (`ui/src/components/ProfileContentSection.jsx` + its insertion into `ui/src/pages/BrainstormProfile.jsx`, consuming the shared `ui/src/hooks/useUserNotes.js` at limit 1). The shared hook tests (U1–U2) and the `/user/:pubkey/notes` page (U9–U16) belong to Story #3's plan but live in the same file.

## Test level (read this first)

UI is asserted at the **source-text level**, the house convention for `ui/src/*.jsx` (the Node runner has no JSX transpile; `react-dom` lives only in the `ui/` Vite workspace; adding a transpile is forbidden tooling). This matches `test/live-feed-feed-page.test.js` and the `profile-*` suites. The ADR shapes the section so its body is a **pure, named-exported `renderContentBody`** with **module-level `CONTENT_COPY` constants**, making the source sentinels precise (copy is pinned; branches are sliced out of the pure helper). The *rendered* card / empty state in a browser is the **staging** capstone (anonymous profile page), not this suite.

## Coverage map

| Criterion | Test name | Level |
|---|---|---|
| (shared hook) | `U1: useUserNotes(pubkey, limit) fetches /api/user/<pubkey>/notes?limit=<limit>, returns {data,loading,error}` | source |
| (shared hook) | `U2: useUserNotes gates on success, sets error, aborts on unmount, re-runs on [pubkey,limit]` | source |
| **#2** label "Content" | `U3: ProfileContentSection exists, uses useUserNotes(pubkey, 1), labelled "Content"` | source |
| **#2** latest note (one) | `U4: the OK branch renders exactly ONE NoteCard for items[0], not a list` | source |
| **#2** empty state | `U5: the empty/defensive branch shows "no kind-1 events could be located", no card` | source |
| **#2** link to page | `U6: the section links to /user/<pubkey>/notes in all states` | source |
| **#2** testability | `U7: renderContentBody is a named-exported PURE function (no fetch/hook/router/globals)` | source |
| **#2** placement (last) | `U8: BrainstormProfile renders <ProfileContentSection> as the LAST section, AFTER Reputation` | source |
| **#2** additive/no-regression | `R3: the Reputation section + TRUST_METRICS grid path are untouched` | regression |
| (card reused, no fork) | `R2: NoteCard is reused as-is — single { item } prop, no variant fork` | regression |

## Edge cases (explicitly covered)

- [x] **No locatable note** → the empty message (operator's "no kind-1 events could be located"), no card (U5).
- [x] **Transport/INVALID failure** → collapses to the same empty message (the operator's phrasing is agnostic between "none exist" and "couldn't load"), asserted via the pure helper's defensive branch (U5 + U7 banning hook/fetch inside the helper).
- [x] **Single-note discipline** — the section renders `items[0]` only, never a `.map` list (U4).
- [x] **Link present even when empty** (U6).
- [x] **Additive** — Reputation/grid untouched (R3); the section is appended after it (U8); NoteCard not forked (R2).

### Deliberately NOT covered here

- The read path (Story #1, `test/note-surfaces-read-path.test.js`).
- The `/user/:pubkey/notes` page body (Story #3, U9–U16 in the same file).
- **Rendered DOM / the card actually appearing on a profile** → the **staging** capstone (the local Docker stack is in use by a parallel session; local full-stack verification is intentionally skipped per the ADR).

## Test infrastructure

- **Framework:** Node runner via `npm test`; the shared `test/note-surfaces-ui.test.js` exports `run()` and is aggregated in `test/test.js`. **No new framework, no JSX transpile, no `react-dom`.**
- **No live services / no `node_modules` beyond `fs`/`path`** — the UI suite is pure source assertion (the worktree's `node_modules` symlink is irrelevant to it).
- **Fixtures:** none (source-text sentinels with `safeRead` + a `helperBody` slicer).

## How to run

```
npm test
```

Run just this suite:

```
node -e "require('./test/note-surfaces-ui.test.js').run().then(r => console.log(JSON.stringify(r)))"
```

## Verification

The `U3–U8` Story-#2 tests (and `U1–U2` for the shared hook) fail with the current code — `ProfileContentSection.jsx`, `useUserNotes.js` don't exist, and `BrainstormProfile.jsx` has no `<ProfileContentSection>` insertion (legible "does not exist yet" messages). `R2`/`R3` PASS now (NoteCard and the Reputation section are present and unmodified). Captured output is in the gate summary (commit recorded at the phase boundary).
