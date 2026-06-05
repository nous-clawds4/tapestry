# Epic: Communities — Participation

**Status:** Active
**Created:** 2026-06-05
**Source:** PRD §5.2 / `stories-queue.md` Block 4. Companion: ADR 0029.

## What this is
Block 4 of the Communities MVP: participating (posting) in a circle, on the right-way Community-Declaration model. Posts are NIP-22 kind-1111 comments (already in the app from Slice 6); this block makes them attach to the correct circle address per model.

## Stories (`stories/communities-participation/`)
- **41 — post-to-a-cd-circle** (fix NB-1: derive the kind-1111 post anchor from the circle's model — 39998 for CD circles, 39999 for bespoke). **Done** (PASS).

## Notes
Posting is gated client-side on `signedIn && joined` (interim, PRD Open Q#5). Trust-based posting gates arrive with Block 5 membership (blocked on the `nostr-user-tag` core).
