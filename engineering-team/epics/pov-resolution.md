# Epic: PoV Resolution

**Status:** Active
**Provenance:** `docs/POV_RESOLUTION_DESIGN_HANDOFF.md` (Protocol-Spec Workflow — Scope+Capture done)

## What this is
The cross-cutting standard for *which source answers which trust question, for whom, and
what happens when the preferred answer isn't available*. Every trust metric in Tapestry is
computed relative to one of exactly three Points of View — Owner / House / Personalized.
This epic ratifies that standard into the canonical spec and (later) builds the resolver +
3-way selector that makes PoV selectable and sticky.

## Stories
`stories/pov-resolution/`:
1. **ratify-three-pov-standard** — docs-mode: settled three-PoV definitions + source map +
   selection/fallback *model* → new BIBLE section + ADR 0033. *(this story)*

## ADRs
`decisions/pov-resolution/` — 0033 (this story).

## Deferred (open questions — design-doc §8, future stories)
Default PoV for anonymous users; resolver shape (endpoint vs shared module); freshness
signaling mechanism; exact per-feature fallback chains; Personalized source; the
count=list-length guarantee per PoV; the 3-way selector UI + sticky-preference store.
