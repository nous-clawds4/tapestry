# Epic: treasure-map-card-details — Needs attention and details on the Treasure Map cards

**Status:** Active
**Created:** 2026-10-08
**Book:** `engineering-team/audits/treasure-map-card-details/book.md` (no PRD — acceptance frame; Light trial)
**Builds on:** the closed `manage-treasure-map` (the cards) and `treasure-map-edit` (Edit mode) epics, both in
production.

## Goal

**Each category card on `/treasure-map` says when it needs the person's attention, and can show what's behind it.** A
card with no Assistant carries the `/assistant` page's "Needs attention" pill; every card can open a details panel
listing the Map entries, Assistants, relays and backups that make up its assignment.

## Stories

1. **A Needs attention pill on an unassigned category** (feature): `1-needs-attention-pill.md`.
2. **Show details: each card's assignments, entry by entry** (feature): `2-show-details-panel.md`. Depends on #1 only
   for file order (both touch `CategoryCard`).
