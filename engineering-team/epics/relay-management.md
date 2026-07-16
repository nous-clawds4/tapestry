# Epic: relay-management

**Created:** 2026-07-15
**Status:** Done (epic retired 2026-07-16 at the router-stream-tag-filters book close — both stories Done, both books Closed; folders under `done/relay-management/`)

## Goal

**Give instance operators first-class tooling on the Relay Settings page for managing relay data flows** — building, previewing, counting, and running negentropy syncs with precise filters, without shelling into the container to hand-type `strfry sync` commands.

The Negentropy Sync panel predates the story harness (it shipped as raw commits `27a06310`, `f09001d4` with no story/epic). This epic adopts that surface and collects its future evolution: filter expressiveness, saved presets, sync history, and whatever else operators need to move exactly the events they mean to move.

## Why it matters

Operator syncs are how instances bootstrap and federate data. Blunt filters over-pull (the tags-federation census found ~1.28M irrelevant kind-39999 events on the shared dcosl relay vs. 451 real tags-family events — a 2,800× overshoot for a kind-only filter). Precise filters (tags, authors, kinds, time) make sync jobs cheap, targeted, and safe to run casually from the UI.

## Stories

1. `stories/done/relay-management/1-sync-panel-tag-filters.md` — single-letter tag filters (`"#x": [...]`) in the Negentropy Sync panel, with p/e/a format validation, honored end-to-end (preview → count → executed sync). **Done** (book `audits/sync-panel-tag-filters/`).
2. `stories/done/relay-management/2-router-stream-tag-filters.md` — the same tag-filter capability on persistent Router Management streams (per-stream, sanitized ingress, round-trip UI). **Done** (book `audits/router-stream-tag-filters/`).

Future evolution (saved presets, count-for-streams, hardening trio OPEN.md #31, concept-handle sugar) is queued in `audits/router-stream-tag-filters/audit.md` §6 + `prd-seed.md` §6–7 — a successor story re-opens this epic or starts a fresh one per triage.

## Key facts / guardrails

- strfry only indexes **single-character** tag names for filtered scans/queries — multi-char tag names are not queryable and stay out of scope panel-wide.
- The sync panel is generic operator tooling: it must not bake in tag-family (or any concept-graph) semantics. A `#z` value is just a string here. Concept-aware affordances (handle autocomplete, canonical-z suggestions) belong to a future story and must stay optional sugar on top of the generic filter.
- The server side of this panel reconstructs the filter it executes rather than passing client JSON through opaquely — by design (it shells out). Every filter capability added to the UI must be explicitly honored server-side, and unknown/garbage keys must stay excluded.
