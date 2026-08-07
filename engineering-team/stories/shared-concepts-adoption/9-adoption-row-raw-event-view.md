# Story 9: Clickable queue rows — view the raw header event

**Status:** Approved
**Created:** 2026-08-07
**Type:** Feature (fast-track — Architecture skipped as obvious; UI-only, no server change;
approved by the owner in-session 2026-08-07: "make the row clickable, so it takes me to a new
page where I can view the raw event… for now we can keep it simple")

## Background

Every Adoption Queue row stands for a concept header — a real kind-39998 nostr event — but the
page offers no way to see the event itself. The owner wants each row clickable, landing on a
simple page that shows the raw event, as the seed of a future header-detail page. DataTable
already supports `onRowClick` (the `/user/:pubkey` navigation idiom used by the
follows/muters/reporters tables); the public `/api/strfry/scan` read already serves events by
coordinate.

**Who is affected:** anyone inspecting what a queue row actually refers to.

## User-facing description

As **a user reviewing the queue**, I want to click any row and see the raw nostr event behind
it, so that **I can inspect exactly what is on the wire before I act on it.**

## Acceptance criteria

- [ ] Clicking a row in any of the four queue tables (nominations, declined, mine-to-publish,
      kept-private reveal) navigates to a header-event page for that row's coordinate (declined
      rows use their `target`).
- [ ] The page fetches the newest event at the coordinate via the existing public strfry scan
      and renders it as pretty-printed raw JSON, titled with the concept's name and showing the
      coordinate; a missing coordinate renders a plain not-found message (no crash).
- [ ] Existing row affordances (Review…, action buttons, Un-decline) still work — their
      stopPropagation keeps button clicks from triggering the row navigation.
- [ ] Kept simple by design: raw JSON only for now (future detail content is out of scope).

## Concepts touched

None — a read-only view over existing header events. No firmware reinstall.

## Out of scope

- Any enrichment of the page beyond the raw event (future iteration by design).
- Raw-event links on other surfaces (dictionary, shared-concepts lists) — separate ask if wanted.

## Linked artifacts
- ADR: skipped (fast-track; approach in Background)
- Test plan: `engineering-team/stories/shared-concepts-adoption/9-adoption-row-raw-event-view.test-plan.md`
- Review: (filled in after Review phase)
