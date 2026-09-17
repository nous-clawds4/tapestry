# Epic: contextual-pins

**Created:** 2026-07-16 (retroactive epic file, written 2026-09-17 at the feat-tags-modernization
landing — the stories and ADR shipped on `feat/tags` without one; harness-lint L3)
**Status:** Done (retired 2026-09-17; ADR 0001 flipped Proposed → Accepted by
`feat-tags-modernization` #2, which composed the feature onto staging's membership methods)
**Book:** none at the time; absorbed by `engineering-team/audits/feat-tags-modernization/book.md` (D1)

## Goal
Pin a tag **within a community context** (LFO, "Tapestry & Web of Trust") alongside a neutral pin
of the same tag — each first-class with its own curation, Trusted List and export — with the
association discoverable by stamp (`z`) and the derivation portable without our server.

## Stories
`stories/contextual-pins/`:
1. `1-pin-a-tag-within-a-community-context.md` — Done.
2. `2-display-ta-signed-note-tl-in-pinned-tab.md` — Done.
3. `3-refresh-viewer-pins-on-event-tagging.md` — Done.

## Decisions
`decisions/contextual-pins/0001-context-scoped-pins.md` — Accepted. Composition with membership
methods and the context-as-`z` rule: `decisions/feat-tags-modernization/0001-pin-stack-composition.md`.

## Reviews
`reviews/contextual-pins/1-contextual-pins-increment.md` (PASS, stories 1–3).
