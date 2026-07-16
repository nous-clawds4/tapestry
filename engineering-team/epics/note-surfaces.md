# Epic: Note Surfaces

**Status:** Done (epic retired 2026-07-02 — OPEN.md row 17 disposition, ratified at the harness-self-improvement story-1 Review gate)
**Provenance:** `_intake.md` entries 2026-06-18 ("profile latest note on `/user/:pubkey`" + "per-user notes page, 50 recent kind-1"); operator-confirmed scope 2026-06-18 (this session). Built atop the `live-feed` epic's shared note seam (`NoteCard` + `enrichNotes`), shipped to staging 2026-06-18.

## What this is
Two new read-only surfaces that show a **single viewed user's own** kind-1 notes — distinct from the `live-feed` epic, which shows notes from the accounts a *source identity follows*. Here there is **no follow list and no point-of-view resolution**: the selection is simply "the most-recent kind-1 notes **authored by** the pubkey being viewed."

- A **"Content" section** at the bottom of the user profile page (`/user/:pubkey`) showing that user's single most-recent note.
- A **`/user/:pubkey/notes` page** showing that user's 50 most-recent notes.

Both consume **one shared by-author read path** and render the **existing shared note card**. The section is labelled **"Content"** (not "Notes") deliberately: it may host other content kinds later, but is **kind-1 only** for now.

Additive and read-only: it adds one read path, one client route/page, and one profile section; it performs no writes and does not change search, ranking/scoring, the existing `/feed`, or firmware. Remove the three additions and the rest of the app behaves as before.

## Stories
`stories/note-surfaces/`:
1. **by-author-notes-read-path** — backend read path: given a pubkey and a count, produce the N most-recent kind-1 notes authored by that pubkey, newest-first, profile-enriched into the shared note item shape, plus the empty and invalid-input outcomes. One subsystem; testable without any page. **Both surfaces depend on it.**
2. **profile-content-section** — the "Content" section at the bottom of the profile page: the single most-recent note as a card, the empty state, and a link to the notes page. Front-end; consumes #1 at count 1.
3. **per-user-notes-page** — the public `/user/:pubkey/notes` page rendering #1's output at count 50 as a list of note cards, with the empty state and no horizontal overflow at 1280px. Front-end; consumes #1 at count 50.

**Dependency order:** #1 first; #2 and #3 are independent of each other.

## Out of scope (whole epic)
- Content kinds other than kind-1 (reposts kind-6, reactions kind-7, long-form kind-30023, etc.) — the "Content" label is future-proofed, but only kind-1 is in scope now.
- Pagination beyond the per-surface cap (1 / 50), infinite scroll, full history.
- Replies/threading, reactions/repost display, tagging notes.
- Any point-of-view selector — these are the viewed user's *own* posts; no source-identity / PoV resolution applies.
- Any write/publish; any change to search, the existing `/feed`, ranking/scoring, or firmware.

## Concepts (referenced, not re-defined)
- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:nostr-kind` — kind-1 (the notes / "Content"), kind-0 (author + mention display data).
- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:nostr-user` — the viewed user (the note author, identified by pubkey).
- `39999:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:the-set-of-general-purpose-relays` — general-purpose relays (the likely note source; Architecture confirms relays-vs-local sourcing).

> Handles above mirror those the `live-feed` epic recorded. The Architect should re-resolve them against the **target instance's own** Tapestry Assistant (never a hardcoded deployment identifier).
