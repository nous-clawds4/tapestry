# Epic: tl-treasure-map

**Created:** 2026-08-27
**Status:** Active
**Book:** `engineering-team/audits/tl-treasure-map/book.md` (acceptance-frame, **Light profile
trial** — workflows/light-profile.md; story 1 escalated to Standard docs-mode by the wire-format
trigger)
**Provenance:** Operator request 2026-08-27 (in-session): resume Trusted Lists work — let
Brainstorm customers point their Treasure Map's pubkey-TL publishing at the local Tapestry
Assistant. No `_intake.md` entry — the request went straight into story 1; the book's Light
opt-in is declared here and in book.md.

## Goal
A Brainstorm customer signed into the Tapestry app sees, on the TA Treasure Map page, what their
kind-10040 already delegates (per tag: kind, TA/TL/other classification, avatar, local-vs-external
badge) and — when generic pubkey-TL support (`30392`) is absent or pointing at a pubkey other than
this instance's TA — can opt in to have the local Tapestry Assistant publish their pubkey Trusted
Lists: one added/replaced tag, every other tag preserved verbatim, NIP-07-signed, published to
local strfry + the general-purpose relays, with the exact event previewable before publishing.

## Stories
`stories/tl-treasure-map/`:
1. `1-treasure-map-tl-advertisement-convention.md` — the wire-format convention (ADR +
   `protocols/drafts/trusted-lists.md` section). Standard docs-mode (wire-format trigger).
2. `2-treasure-map-tags-panel.md` — the tags panel. Light feature lane.
3. `3-tl-opt-in-preview-publish.md` — salient check, opt-in prompt, preview, sign & publish.
   Light feature lane.

## Decisions
`decisions/tl-treasure-map/`:
- `0001-treasure-map-tl-advertisement-convention.md`
