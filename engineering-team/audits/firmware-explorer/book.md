# Book: Firmware Explorer

**Status:** Closed
**Opened:** 2026-07-23 (anchor recorded in `engineering-team/epics/firmware-explorer.md` at planning)
**Closed:** 2026-07-23
**Kind:** bounded ask — no PRD
**Provenance:** acceptance-frame *(recorded contemporaneously in the epic file; the canonical `book.md` was not opened at intake — see the note below)*
**Confidence:** high — single story, shipped to production and verified end-to-end the same day.

## Acceptance frame (intent anchor)

An operator can, inside the Firmware Explorer (Settings → Firmware), browse a selected
concept's live **elements** (member instances) and **sets** (subsets), and drill into any
one to see its JSON with the same Viewer/Raw toggle used for the core nodes — without
leaving the Firmware Explorer or dropping to raw Cypher.

*(Verbatim from `engineering-team/epics/firmware-explorer.md` → "Acceptance frame", written
during Planning on 2026-07-23.)*

## Epics

- `firmware-explorer` — one story:
  - #1 `concept-elements-and-sets-viewer` — **Done** (review PASS, `98b266f6`).

## Anchor-not-opened-at-intake note

This `book.md` was created at close, not at intake. The intent anchor was not lost — it was
recorded in the epic file at Planning — but the canonical manifest location was skipped, so
cross-session completion detection had nothing to compute against. This is the **second
occurrence** of the pattern first logged as OPEN.md #78 (graph-curation-ui #1). Dispositioned
in `audit.md` §7.

## Close artifacts (the return edge)

- Build audit: `engineering-team/audits/firmware-explorer/audit.md`
- Product feedback (no-PRD): `engineering-team/audits/firmware-explorer/prd-seed.md`
