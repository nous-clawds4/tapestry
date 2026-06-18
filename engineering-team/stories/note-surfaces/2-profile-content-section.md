# Story 2: Profile "Content" section — the user's latest note

**Status:** Approved
**Created:** 2026-06-18
**Type:** Feature

## Background
The user profile page (`/user/:pubkey`) shows identity, reputation, and follows/followers — but nothing the user has actually **posted**. This story adds a **"Content"** section at the very bottom of the profile that shows the viewed user's **single most-recent kind-1 note**, an explicit empty state, and a link to the full notes page (`note-surfaces` #3).

It consumes the by-author read path (`note-surfaces` #1) at count 1 and renders the **existing shared note card** — it adds no read logic of its own. The label is **"Content"** — not "Notes" — deliberately: the section may later host other content kinds, but only kind-1 is shown for now.

Affected: anyone viewing any user profile.

## User-facing description
As someone viewing a user's profile, I want a "Content" section at the bottom showing that user's most-recent note, so I can see what they've posted at a glance; when they have none, I want to be told clearly; and I want a link to see more of their notes.

## Acceptance criteria
Testable from the outside.

- [ ] **Section presence & label.** Given any user profile at `/user/:pubkey`, when the profile renders, then a section labelled **"Content"** appears as the **last** section of the page.

- [ ] **Latest note rendered.** Given the viewed user has at least one locatable kind-1 note, when the Content section renders, then it shows that user's **single most-recent** note as a note card (author display name + avatar + timestamp + text) — and **no more than that one** note.

- [ ] **Empty state.** Given the viewed user has **no locatable kind-1 note**, when the Content section renders, then it shows an explicit message that **no kind-1 events could be located** — and renders **no** note card.

- [ ] **Link to the full notes page.** Given the Content section renders (populated **or** empty), then it includes a link to **`/user/:pubkey/notes`** for that user.

- [ ] **Additive / no regression.** Everything else on the profile page renders exactly as before; with the Content section removed, the profile page behaves as it did prior to this story.

> Canonical empty-state wording ("no kind-1 events could be located") is operator-delegated; exact punctuation is non-binding so long as it conveys that meaning.

## Concepts touched
- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:nostr-kind` — kind-1 (the note shown), kind-0 (author display).
- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:nostr-user` — the viewed user (profile subject + note author).

## Out of scope
- The read/selection logic (that is `note-surfaces` #1) and the full notes page (`note-surfaces` #3).
- Showing more than one note, pagination, or any content kind other than kind-1.
- Any change to the rest of the profile page's existing sections, data, or layout beyond appending the new section.
- Any write/publish.

## Open questions
None — placement (bottom / last section), label ("Content"), single-note count, empty-state intent, and the link target (`/user/:pubkey/notes`) were operator-resolved at Planning.

## Linked artifacts
- ADR: (filled in after Architecture)
- Test plan: (filled in after Test Design)
- Review: (filled in after Review)
