# Story 3: Per-user notes page (`/user/:pubkey/notes`)

**Status:** Done
**Created:** 2026-06-18
**Type:** Feature

## Background
The `note-surfaces` epic's read path (`note-surfaces` #1) can produce a given user's most-recent kind-1 notes; the profile "Content" section (`note-surfaces` #2) shows only the latest one and links here. This story adds the **public `/user/:pubkey/notes` page** that renders that user's **50 most-recent notes** as a list — a sibling of the existing `/user/:pubkey/follows`, `/followers`, and `/follows-hops` sub-pages.

It is **front-end only**: it consumes `note-surfaces` #1 at count 50 and renders the **existing shared note card**, reusing the established feed-page rendering and empty-state patterns. It adds no read logic of its own.

Affected: anyone (logged in or anonymous) who wants to read a specific user's recent notes.

## User-facing description
As someone viewing a user, I want a `/user/:pubkey/notes` page that shows that user's 50 most-recent notes, newest-first, each with the author's name, avatar, timestamp, and text — so I can read their recent posts; and when there are none, I want to be told clearly rather than seeing a blank page or an error.

## Acceptance criteria
Testable from the outside.

- [ ] **Public reachability + no overflow.** Given any pubkey, when a client requests `/user/:pubkey/notes`, then the response is HTTP 200 and renders the notes surface (the populated list **or** the empty state) — never a login wall or error page — and at a **1280px-wide viewport** the rendered page produces **no horizontal overflow** (no content extends beyond 1280px / no horizontal scrollbar).

- [ ] **Populated list: content, order, cap.** Given the viewed user has one or more locatable notes, when the page renders, then it shows **one entry per note** — each with the author's **display name, avatar, timestamp, and text** — ordered **newest-first**, capped at the **50 most recent**.

- [ ] **Whose notes.** Given the page renders, then it identifies **whose** notes are shown (the viewed user's display name / identity).

- [ ] **Empty state.** Given the viewed user has **no locatable kind-1 note**, when the page renders, then it shows an explicit message that **no kind-1 events could be located** and shows **no** entries.

- [ ] **Additive / no regression.** The page is purely additive: with the `/user/:pubkey/notes` route removed, the rest of the app behaves exactly as before.

> Canonical empty-state wording ("no kind-1 events could be located") is operator-delegated; exact punctuation is non-binding so long as it conveys that meaning.

## Concepts touched
- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:nostr-kind` — kind-1 (the notes), kind-0 (author display).
- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:nostr-user` — the viewed user (note author).

## Out of scope
- The read/selection logic (that is `note-surfaces` #1).
- Pagination beyond 50, infinite scroll, full history, content kinds other than kind-1.
- Replies/threading, reactions/repost display, tagging notes, any write/publish.
- A PoV / source selector — these are the viewed user's own posts.

## Open questions
None — route (`/user/:pubkey/notes`), the 50 cap, and the empty-state intent were operator-resolved at Planning.

## Linked artifacts
- ADR: `engineering-team/decisions/note-surfaces/0002-note-surfaces-ui.md`
- Test plan: `engineering-team/stories/note-surfaces/3-per-user-notes-page.test-plan.md`
- Review: `engineering-team/reviews/note-surfaces/1-note-surfaces-implementation.md` (PASS — 2026-06-18)
