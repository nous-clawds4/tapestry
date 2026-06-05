# Story 34: View a circle's definition (read-only)

**Status:** Done
**Created:** 2026-06-05
**Type:** Feature
**Epic:** `communities-declaration` · **Product source:** PRD §5.2 / stories-queue Block 1, Story 2 (Newcomer).
**Architecture:** No new ADR — covered by **ADR 0029** (the normalized `Circle` projection already exposes `belongingBar` and `parent`). This story renders those fields.

## Background
A Community Declaration carries its definition (purpose + **belonging-bar**) and, when forked, a **parent**. The circle detail page currently renders name, description (purpose), and topics, but not the belonging-bar or the "Based on ‹parent›" link. Any visitor — with no account — must be able to read what a circle is and what it takes to belong.

## User-facing description
As a **Newcomer**, I want to open a circle and read its purpose and what it takes to belong, so that I can decide whether it is the real circle for me before joining.

## Acceptance criteria
- [ ] Given a circle with a belonging-bar, when any visitor (no account) opens it, then the belonging-bar is shown as prose.
- [ ] Given a forked circle (has a parent), when viewed, then a "Based on ‹parent›" affordance is shown.
- [ ] Given a circle with no parent, then no "Based on" affordance is shown.
- [ ] Given the detail page, then no "owner/admin/moderator" label appears.
- [ ] Loading and error states remain intact (shimmer; error with retry) — no regression.

## Concepts touched
- `39998:<TA>:brainstorm-community` — the Community Declaration whose `belonging` + `b`(parent) tags this renders (via the projection).

## Out of scope
- Fork flow itself (Story 4). Trust signal (Block 3). Posting (Story 8). Editing a circle. Resolving the parent's inherited fields for display (Story 5 — this story only links to the parent).

## Open questions
Resolved: read-only render of `belongingBar` + a parent link, on the existing `CommunityDetail` surface; the projection already supplies both fields (ADR 0029).

## Linked artifacts
- PRD §5.2 · Design guide (Definition panel) · ADR 0029.
- Test plan: `34-view-a-circle.test-plan.md` + `test/view-a-circle.test.js`.
- Review: [`../../reviews/communities-declaration/34-view-a-circle.md`](../../reviews/communities-declaration/34-view-a-circle.md) — **PASS** (5/5).
