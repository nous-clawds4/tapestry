# Epic: Feed Usability

**Status:** Active
**Provenance:** Operator request, 2026-07-03 (this session). Follow-on to the `live-feed` and `note-surfaces` epics, both of which shipped their surfaces with reply-filtering and pagination explicitly deferred ("Out of scope (whole epic)" in each). This epic is where that deferred work lands.

## What this is

Quality-of-life upgrades to the note-feed surfaces that already exist — the `/feed` page
(from `live-feed`), the `/user/:pubkey/notes` page, and the profile "Content" section
(both from `note-surfaces`):

1. **Notes | Notes + Replies toggle.** Today every kind-1 note is shown with no
   distinction between top-level posts and replies to other notes. Both feed pages get a
   simple two-state toggle — "Notes" (top-level only; the new default) and
   "Notes + Replies" (today's everything view). No threading, no nesting — just the
   distinction.
2. **Pagination.** Today both pages hard-cap at the 50 most recent notes. Both get a
   "Load more" affordance to read older notes, with a hard product constraint: sustained
   loading must not degrade the browser — the page releases content far out of view so
   the amount held live stays bounded regardless of how much is loaded.
3. **Smarter profile "Content" card.** The single-note card on `/user/:pubkey` gets a
   selection order: the user's **pinned note** (NIP-51 kind-10001 pin list) if they have
   one, else their most recent **top-level** (non-reply) note, else an explicit empty
   state.

Like its parent epics, this work is **read-only**: no writes/publishes, no changes to
search, ranking/scoring, tagging, or firmware.

## Stories

`stories/feed-usability/`:

1. **notes-replies-toggle** — the "Notes" | "Notes + Replies" toggle on `/feed` and
   `/user/:pubkey/notes`; "Notes" is the default; reply-only accounts get an explicit
   empty state instead of a blank list.
2. **feed-pagination** — "Load more" on both pages; order and dedup guarantees;
   exhaustion signalling; bounded in-memory/rendered content under sustained loading.
3. **profile-content-card** — the pinned-note-aware selection order for the profile
   "Content" card.

**Dependency order:** #1 before #2 (pagination must compose with the active toggle
mode). #3 is independent of both.

## Out of scope (whole epic)

- Threading / nested reply rendering / "in reply to" context lines.
- Reposts (kind 6), reactions (kind 7), content kinds other than kind-1 on the feed
  surfaces (kind-10001 is read only as a *selector* in story 3, never rendered as an
  entry).
- Persisting a user's toggle choice across sessions or devices.
- Any write/publish (including pin management), any change to search, ranking/scoring,
  tagging, or firmware.
- True infinite scroll (auto-load on scroll) — "Load more" is an explicit control.

## Concepts (referenced, not re-defined)

- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:nostr-kind` —
  kind-1 (notes and replies), kind-0 (author display), kind-3 (follow list feeding
  `/feed`), kind-10001 (pin list, story 3).
- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:nostr-user` —
  the viewed user / the followed authors.
- `39999:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:the-set-of-general-purpose-relays`
  — where older notes and pin lists are fetched from.

> Handles are resolved against **this instance's** Tapestry Assistant. Per house rules,
> implementations must resolve the TA pubkey at runtime — never hardcode it.
