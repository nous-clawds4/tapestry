# Epic: Event Page

**Status:** Active
**Provenance:** Operator request 2026-06-18 (this session), immediately after the `note-surfaces` epic shipped to staging. Builds on the shared note seam (`NoteCard` + `enrichNotes`) and the relay-set resolution pattern established by `live-feed` / `note-surfaces`.

## What this is
A working public **`/event`** single-event view (currently a placeholder). It resolves a **kind-1** note from one of two entry modes and renders it like the `/feed` page:

- A **supported URL parameter** identifying an event or an author, or
- A **search field** (shown only when no valid parameter is present) into which a person pastes one of the supported identifiers.

Six identifier formats are supported, in this precedence: **`nevent` › `id` › `naddr` › `pubkey` › `npub` › `nprofile`**. `nevent`/`id` resolve a specific event; `pubkey`/`npub`/`nprofile` resolve that author's most-recent kind-1; `naddr` is recognized but — because addressable events are always kind 30000–39999, never kind-1 — reported as a not-yet-supported kind.

Every fetch looks across a **relay union**: relay hints embedded in `nevent`/`nprofile`, **plus** the author's outbox (their published NIP-65 write relays) when resolvable, **plus** the instance's well-known relays (the general-purpose relay set, else a fixed fallback).

**Scope: kind-1 only.** Additive and read-only — it adds the `/event` view and its supporting read path; it performs no writes and does not change search, the feed, profiles, ranking, or firmware.

## Stories
`stories/event-page/`:
1. **event-read-path** — the backend read path: given an event id (with optional relay hints) **or** an author pubkey, fetch across the relay union (hints + author outbox + well-known/fallback), verify, kind-gate, and enrich into the shared note item shape — returning a discriminated set of outcomes (found-kind-1 / unsupported-kind / does-not-validate / not-found / no-author-note). Testable without the page.
2. **event-page-param-render** — the `/event` page's URL-parameter path: parse the 6 params by precedence, distinguish malformed-supported (flag as invalid) from unsupported names (ignore), decode `naddr` to its kind locally, and render the resolved event (via `NoteCard`) or the precise outcome message. Consumes #1.
3. **event-page-search** — the no-parameter fallback: a search field that validates a pasted string against the 6 formats and resolves it exactly as the equivalent URL parameter, or reports "not a recognized format." Shown only when no valid parameter is present.

**Dependency order:** #1 first; #2 then #3 (same page; #3 adds the fallback surface). #2 and #3 both consume #1.

## Out of scope (whole epic)
- Rendering any non-kind-1 event — addressable/long-form (kind 30023), reposts (kind 6), reactions (kind 7), etc. (`naddr` and non-kind-1 `nevent`/`id` resolve to a "kind ‹N› not yet supported" message, not a rendered view).
- Threads / replies / comments / reactions *on* the shown event; "load more"; navigating between events.
- Any write/publish; relay-hint editing; auth/login gating.
- Changing the existing note `nostr:` link targets, the feed, profiles, ranking, or firmware.

## Concepts (referenced, not re-defined)
- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:nostr-kind` — kind-1 (the event shown), kind-0 (author/mention display), kind-10002 (the author's NIP-65 outbox relay list).
- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:nostr-user` — the event author / the looked-up author (by pubkey).
- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:nostr-relay` + `39999:…:the-set-of-general-purpose-relays` — the well-known relay set (else the fixed fallback).

> Handles mirror those recorded by `live-feed` / `note-surfaces`; the Architect should re-resolve against the target instance's own Tapestry Assistant (never a hardcoded identifier).
