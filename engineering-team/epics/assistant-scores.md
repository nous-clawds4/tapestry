# Epic: assistant-scores — the hub's Scores page

**Created:** 2026-10-13
**Status:** Done (book closed 2026-10-14; the folders sit under `done/`)
**Book:** `engineering-team/audits/assistant-scores/book.md` (no PRD — acceptance frame)
**Provenance:** the owner's ask of 2026-10-13, quoted in the book and settled through three questions at intake (book
§ Decisions).

## Goal

**Replace the hub's Scores placeholder (`/assistant/trusted-assertions`) with a real page.** It tells the viewer when
their Assistant on this instance last published their Grapevine as Trusted Assertions (kind 30382), and lets the
Owner and Customers recalculate and republish it with one button.

## Stories

`stories/done/assistant-scores/`.

1. `1-the-scores-page.md` (Done): last published, how many, and the Recalculate button with its queued/running status;
   plus ADR 0001 Amendment 1's shared jobId fix.

## Key facts / guardrails

- **"Whose Assistant?"** is the viewer's own, from the session, as on the rest of the hub: the Owner's TA, or the
  Customer's (or Admin's) Assistant key (`src/utils/assistantKeys.js`).
- **Whose run?** Also from the session, never from the request. The Owner's run is the owner pipeline; an active
  Customer's is their own per-Customer pipeline. Nobody else has one here today.
- **The hub's Scores mark keeps its meaning** (assistant-trusted-content-status #1: does your Treasure Map give
  Scores to an Assistant?). This epic adds no new check to it.
