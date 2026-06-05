# Story 41: Post to a Community-Declaration circle (fix the post anchor)

**Status:** Done
**Created:** 2026-06-05
**Type:** Bug/Feature (NB-1 from Story 33's review)
**Epic:** `communities-participation` (Block 4) · **Architecture:** ADR 0029 — no new ADR.

## Background
Slice 6 shipped kind-1111 conversation posts anchored by the circle's a-tag. The anchor was hardcoded to `39999:<founder>:<slug>` (the bespoke model). A Community Declaration is **kind-39998**, so on a CD circle the anchor was wrong and posts didn't round-trip (Story 33 review NB-1). Derive the anchor kind from the circle's `model`.

## User-facing description
As a member of a CD circle, I want my post to attach to this circle and show up in its conversation, so that participation works on the new model.

## Acceptance criteria
- [ ] On a CD circle (`model === 'declaration'`), the post anchor is `39998:<founder>:<slug>`.
- [ ] On a bespoke circle, the anchor remains `39999:<founder>:<slug>` (no regression).
- [ ] Posts publish via `buildCommunityPost` + `publishEvent` and read via `fetchPostsForCommunity` with that anchor (existing wiring, now correct per model).

## Out of scope
- Trust-based posting gate (Block 5). Reply threads. The full member roster.

## Linked artifacts
- ADR 0029. Test plan: `41-post-to-a-cd-circle.test-plan.md` + `test/post-to-cd-circle.test.js`. Review: [`../../reviews/communities-participation/41-post-to-a-cd-circle.md`](../../reviews/communities-participation/41-post-to-a-cd-circle.md) — **PASS** (3/3).
