# Story 38: Show inherited vs overridden fields on a forked circle

**Status:** Done
**Created:** 2026-06-05
**Type:** Feature
**Epic:** `communities-declaration` (Block 2) · **Architecture:** ADR 0028/§26 (resolver) + ADR 0029 — no new ADR.

## Background
A forked circle inherits unedited fields from its parent (live). The detail page must make clear what's inherited vs the child's own, and reflect the parent's current value (live resolution).

## User-facing description
As a **Newcomer or Convener** viewing a forked circle, I want to see what it inherits vs what it changed, so that I understand the relationship to its parent.

## Acceptance criteria
- [ ] A forked circle's detail resolves its definition via the §26 resolver (live).
- [ ] A field the child did not state shows the parent's value with an "(inherited)" marker.
- [ ] A field the child overrode shows the child's value (no marker).
- [ ] When the parent updates an inherited field, the child reflects it (live — not snapshot).
- [ ] A circle with no parent shows no inheritance markers (no regression to Story 34).

## Out of scope
- Editing inherited fields in place (later). Inherited marking on every field (v1 marks the belonging-bar; description/topics can follow).

## Linked artifacts
- §26 / ADR 0028 + Story 36 resolver. Test plan: `38-inherited-field-display.test-plan.md` + `test/inherited-field-display.test.js`. Review: [`../../reviews/communities-declaration/38-inherited-field-display.md`](../../reviews/communities-declaration/38-inherited-field-display.md) — **PASS** (5/5).
