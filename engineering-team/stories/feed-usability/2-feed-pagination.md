# Story 2: "Load more" pagination on the feed surfaces

**Status:** Approved
**Created:** 2026-07-03
**Type:** Feature

## Background
Both feed surfaces — `/feed` (`live-feed` epic) and `/user/:pubkey/notes`
(`note-surfaces` epic) — hard-cap at the **50 most recent** notes with no way to read
further back. Both parent epics explicitly deferred pagination. For any active author
or follow list, 50 notes is a few days at most; the cap is the biggest usability wall
on these pages.

This story adds an explicit **"Load more"** control to both pages, with a hard product
constraint: **sustained loading must not degrade the browser.** A reader who loads
hundreds or thousands of notes should get the same responsiveness as one who loads
one batch — the page must not hold an ever-growing amount of live content.

Depends on story 1 (`feed-usability` #1): loading older notes must compose with the
active "Notes" | "Notes + Replies" mode.

Affected: anyone (anonymous or logged in) reading either feed surface.

## User-facing description
As someone reading a feed page, I want to keep loading older notes past the initial
batch, so that I can read back through history — and I want the page to stay fast no
matter how far back I go.

## Acceptance criteria
Testable from the outside. Each criterion gets at least one test.

- [ ] **Control appears when there may be more.** Given a surface renders its initial
  batch (the 50 most recent matching notes) and older notes exist, then a clearly
  labeled "Load more" control is visible at the end of the list, on both `/feed` and
  `/user/:pubkey/notes`.

- [ ] **Loading appends older notes, in order, without duplicates.** Given the user
  activates "Load more", then the next batch of strictly older notes is appended below
  the existing entries; the combined list remains ordered newest-first; and no note
  appears twice.

- [ ] **Composes with the toggle.** Given the toggle (story 1) is in "Notes" mode,
  when the user activates "Load more", then the appended entries are all top-level
  notes (older replies do not appear); in "Notes + Replies" mode, older replies and
  top-level notes both appear. Switching modes after loading does not violate story
  1's filtering criteria for everything currently shown.

- [ ] **Exhaustion is signalled.** Given no older notes can be found for the active
  mode, when the user reaches the end of the list, then the page says so explicitly
  (e.g. an end-of-history message) and does not offer a "Load more" control that
  silently does nothing.

- [ ] **Loading state is visible.** Given the user activates "Load more", then the
  control indicates loading is in progress until the batch renders or the end state
  shows; repeated activation while loading does not produce duplicate entries.

- [ ] **Bounded live content under sustained loading.** Given the user loads many
  batches (enough that total loaded notes far exceeds the initial 50 — e.g. 10+
  activations), then the number of **fully rendered note entries held live in the
  page at once stays under a fixed bound** (content far outside the viewport is
  released), while scrolling back toward the top of the list still shows the newest
  notes again (released content is restored when the reader returns to it). The page
  remains scrollable and responsive throughout.

- [ ] **Window indicator stays truthful.** Given more than the initial batch is
  loaded, then any on-page count/window indicator (e.g. `/feed`'s "Showing the most
  recent 50 notes.") reflects what is actually shown rather than asserting a stale
  fixed cap.

## Concepts touched
- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:nostr-kind`
  — kind-1 (the paginated content), kind-0 (author display for newly loaded entries).
- `39999:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:the-set-of-general-purpose-relays`
  — where older notes are fetched from (the Architect confirms sourcing/fallback, as
  the parent epics did).

> Resolve the TA pubkey at runtime per house rules; the handles above are this local
> instance's.

## Out of scope
- Auto-loading on scroll (true infinite scroll) — "Load more" is an explicit control.
- Jump-to-date, permalinked pages of history, or a "page N" URL scheme.
- Changing the initial batch size (stays 50).
- The profile "Content" single-note card (story 3) — it shows one note; nothing to
  paginate.
- Guaranteeing *complete* history: relays are best-effort; the story requires honest
  signalling of exhaustion, not exhaustive retrieval.
- Any write/publish; any change to search, ranking, tagging, or firmware.

## Open questions
None — the "Load more" shape (vs. next/prev pages) and the bounded-memory constraint
were operator-resolved at Planning, 2026-07-03. The exact release/restore mechanism
and the numeric bound are the Architect's to choose; the bound's existence and the
restored-on-return behavior are the product requirements.

## Linked artifacts
- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
