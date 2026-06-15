# Epic: Live Feed

**Status:** Active
**Provenance:** Direction-mode book (operator acceptance frame, 2026-06-15). No `_intake.md` entry — greenfield.

## What this is
A basic, read-only "live feed" surface: kind-1 notes authored by the accounts a single
**source identity** follows, newest first, bounded to a recent window. The source identity is
the **logged-in user** when one is present, otherwise the instance's **House point-of-view
identity** (per the `pov-resolution` epic / the three-PoV standard). The follow list (kind-3)
is read from **local strfry**; the followed authors' kind-1 notes are fetched from the
instance's configured **general-purpose relays**; author display name and avatar come from
the instance's **existing local profile data** (kind-0 in strfry / Meilisearch).

The feed is deliberately plain. Its purpose is to be the **host surface** for a later,
separate book: tagging any feed item with any existing Tag. That tagging work is **out of
scope for this epic.**

This book is **additive and read-only**. It adds a `/feed` route and its supporting read
path; it performs no writes/publishes and does not modify the search page, profile pages,
ranking/scoring, or firmware. With `/feed` removed, the rest of the app behaves as before.

## Stories
`stories/live-feed/`:
1. **feed-read-path** — the backend read path: given a resolved source identity, produce the
   ordered, bounded, profile-enriched set of recent kind-1 notes from that source's follows,
   plus the three defined edge outcomes (no source identity / follow list not in local strfry
   / follow list present but no notes), as observable data. One subsystem (read path);
   self-contained, testable without the page. *(this story — drafted now)*
2. **feed-page** *(scope only — drafted at its own Planning phase)* — the public,
   bookmarkable, login-free `/feed` page that renders Story 1's output: the "Live Feed"
   heading, each note's author display name + avatar + timestamp + text (newest first), the
   "Showing the most recent 50 notes" recent-window indicator, and the three canonical
   empty-state messages — with no horizontal overflow at a 1280px-wide viewport. Front-end
   subsystem only; consumes Story 1, adds no new read logic.

## Out of scope (whole epic)
- Tagging feed items with existing Tags (the *reason* for the feed — a separate, later book).
- A source-identity selector / PoV picker on the feed (the source is resolved, not chosen).
- Reposts (kind 6), reactions (kind 7), threading/replies, pagination beyond the recent-window
  cap, infinite scroll, full history.
- Any write/publish, or changes to search, profiles, ranking/scoring, or firmware.

## Concepts (referenced, not re-defined)
- `39999:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:the-set-of-general-purpose-relays`
  — "general purpose relays" (the relay set the followed authors' kind-1 notes are fetched from).
- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:nostr-kind`
  — Nostr kinds: kind-3 follow list (source), kind-1 notes (feed content), kind-0 profiles (display).
- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:nostr-user`
  — the source identity (a Nostr account identified by pubkey).
- House point-of-view identity — defined by the **`pov-resolution`** epic / the three-PoV
  standard (the instance's configured House pubkey), not re-defined here.
