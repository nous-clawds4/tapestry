# Story 1: "Notes" | "Notes + Replies" toggle on the feed surfaces

**Status:** Approved
**Created:** 2026-07-03
**Type:** Feature

## Background
The `/feed` page (`live-feed` epic) and the `/user/:pubkey/notes` page (`note-surfaces`
epic) both show kind-1 notes with no distinction between **top-level posts** and
**replies to other notes**. A reply-heavy account's notes page — or a feed full of
conversation fragments — is mostly noise a reader can't filter. Nearly every nostr
client makes this distinction; ours doesn't yet. Both parent epics explicitly deferred
it.

This story adds a simple two-state toggle to both pages. No threading, no nesting, no
"in reply to" context — just the distinction between a note that starts a conversation
and a note that responds to one.

Affected: anyone (anonymous or logged in) reading either feed surface.

## User-facing description
As someone reading a feed page, I want to switch between seeing only top-level notes
and seeing everything including replies, so that I can read a person's (or my
follows') actual posts without wading through fragments of conversations I have no
context for.

## Acceptance criteria
Testable from the outside. Each criterion gets at least one test. "Reply" below means
a kind-1 note that is marked as a response to another note per nostr threading
conventions; the exact marker is the Architect's to specify, but a note carrying no
such marker is a top-level note.

- [ ] **Toggle present on both surfaces, defaulting to "Notes".** Given a fresh page
  load of `/feed`, and separately of `/user/:pubkey/notes`, then each page shows a
  two-state control labeled **"Notes"** and **"Notes + Replies"**, with **"Notes"**
  active by default, and the page's list reflects the active state.

- [ ] **"Notes" mode filters replies.** Given the underlying notes include both
  top-level notes and replies, when the page renders in "Notes" mode, then every entry
  shown is a top-level note and no entry shown is a reply.

- [ ] **"Notes + Replies" mode shows everything.** Given the same underlying notes,
  when the user switches the toggle to "Notes + Replies", then the list shows both the
  top-level notes and the replies (today's behavior), ordered newest-first, without a
  full page navigation.

- [ ] **Switching back re-filters.** Given the user is in "Notes + Replies" mode, when
  they switch back to "Notes", then reply entries disappear from the list and top-level
  entries remain, still newest-first.

- [ ] **Reply-only empty state.** Given every locatable note for the surface is a
  reply, when the page renders in "Notes" mode, then it shows an explicit on-page
  message that there are no top-level notes to show (and offers the "Notes + Replies"
  state as the way to see the rest) — never a blank list with no explanation.

- [ ] **Existing empty states unaffected.** Given a surface's pre-existing empty
  condition (e.g. `/feed`'s three defined empty outcomes; the notes page's "no kind-1
  events could be located"), when the page renders in either toggle state, then the
  pre-existing empty-state message still shows as before.

## Concepts touched
- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:nostr-kind`
  — kind-1 (both the notes and the replies are kind-1; the distinction is a threading
  marker, not a kind).
- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:nostr-user`
  — the note authors.

> Resolve the TA pubkey at runtime per house rules; the handle above is this local
> instance's.

## Out of scope
- Threading UI, nested replies, "in reply to @who" context lines, fetching parent
  notes.
- Pagination / "Load more" (story 2 — but note the dependency: story 2's loading must
  respect the active toggle mode).
- The profile "Content" single-note card (story 3).
- Persisting the toggle choice across sessions/devices, or a per-user preference.
- Reposts (kind 6), reactions (kind 7), any non-kind-1 content.
- Any write/publish; any change to search, ranking, tagging, or firmware.

## Open questions
None — default state ("Notes"), the two surfaces, and the flat (non-threaded) scope
were operator-resolved at Planning, 2026-07-03.

## Linked artifacts
- ADR: `engineering-team/decisions/feed-usability/0001-notes-replies-toggle.md`
- Test plan: `engineering-team/stories/feed-usability/1-notes-replies-toggle.test-plan.md`
- Review: (filled in after Review phase)
