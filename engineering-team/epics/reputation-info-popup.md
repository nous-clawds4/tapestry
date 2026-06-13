# Epic: Reputation Info Popup

**Status:** Active
**Provenance:** `engineering-team/audits/reputation-info-popup/book.md` (Acceptance-frame book, opened 2026-06-14). Source request: the intake entry "2026-06-14 — Feature: Reputation info popup on the profile page (House vs Personalized PoV explainer)" in `engineering-team/stories/_intake.md`.

## What this is
A presentational explainer on the public profile page. The Reputation section already
shows trust-metric scores that reflect a Web-of-Trust point of view — either the instance's
**House** point of view (the default) or the viewer's **Personalized** point of view,
depending on which is currently selected. Today nothing on the page tells a reader where
those scores come from. This epic adds a small informational control beside the "Reputation"
heading — a circled "i" matching the existing "Verified" info control — that opens a
dismissible popup explaining, in plain language, that the reputation scores reflect either
the House or the Personalized point of view, whichever is selected.

The change is additive and presentational only: it does not change how the reputation scores
are computed, fetched, namespaced by point of view, or which scores display.

## Stories
`stories/reputation-info-popup/`:
1. **reputation-section-pov-explainer-popup** — add the circled-"i" info control beside the
   profile-page "Reputation" heading and the static House-vs-Personalized point-of-view
   explainer popup it opens. *(this story)*

## Concepts touched
- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:web-of-trust` — web of trust (the reputation model the popup names; its own description covers the "personalized view of the network" idea that the House-vs-Personalized distinction expresses).
- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:graperank` — graperank (the Web-of-Trust scoring algorithm that produces the Reputation-section trust scores).

"House point of view" and "Personalized point of view" are not modeled as Concept Graph nodes
— there is no dedicated handle for either (verified against `/api/concept-graph/summaries` on
this instance). They are product/UI notions; the House-vs-Personalized selection is owned by
the PoV Resolution epic.

## Out of scope (epic-level)
- Dynamically naming which point of view is currently active.
- Any change to how reputation scores are computed, fetched, namespaced by point of view, or
  which scores display.
- Adding the popup to any page other than the public profile page.
