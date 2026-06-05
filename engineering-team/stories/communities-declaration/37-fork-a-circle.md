# Story 37: Fork a circle (stand on a parent's definition)

**Status:** Done
**Created:** 2026-06-05
**Type:** Feature
**Epic:** `communities-declaration` (Block 2) · **Architecture:** ADR 0029 (CD + `b`) + ADR 0028/§26 (resolver, Story 36) — no new ADR.

## Background
A circle can stand on another's definition. Forking pre-fills from the parent's **resolved** definition (Story 36), and writes a new Community Declaration carrying a `b` parent tag. Fields the forker doesn't change are omitted so they inherit live from the parent (§26).

## User-facing description
As a **Convener**, I want to start a circle that stands on an existing one and override only what I change, so that I can split or build on a definition without copying it.

## Acceptance criteria
- [ ] From a CD circle, a signed-in viewer can start a fork (a "Fork this circle" action → the found flow with the parent).
- [ ] The fork flow pre-fills from the parent's **resolved** definition.
- [ ] Publishing writes a Community Declaration with a `b` parent tag.
- [ ] Fields unchanged from the parent baseline are **omitted** (inherit live); changed fields are written (override).
- [ ] The builder omits empty optional fields (so omission is possible).
- [ ] Sign-in is requested only at publish; the founder lands on the new circle.

## Out of scope
- Inherited-vs-overridden **display** on the detail (Story 38). Multi-parent fork UI. Editing after publish.

## Linked artifacts
- ADR 0029 + §26/0028. Test plan: `37-fork-a-circle.test-plan.md` + `test/fork-a-circle.test.js`. Review: [`../../reviews/communities-declaration/37-fork-a-circle.md`](../../reviews/communities-declaration/37-fork-a-circle.md) — **PASS** (6/6).
