# Story 3: Reply to a post

**Status:** Done
**Created:** 2026-06-06
**Type:** Feature
**Epic:** `communities-aliveness` · **Book:** `audits/communities-v2/book.md`
**PRD:** `product-team/prd/communities-v2.md` §5.1 · **Queue:** `product-team/stories-queue.md` Block B, Story 3

## Background
A circle's conversation today is a flat list of posts. The first step in making a circle feel alive is letting people respond *to each other*, not just broadcast. Replies give conversation its texture. Per the design guide, replies nest **one level only** — a reply to a reply attaches at the same single level — to keep the room readable on mobile (the design's deliberate constraint). This story is independent of the trust engine; it builds on the posting path that already works (and on Story 2's degraded fallback for who-can-post).

Affected: the Belonger (the everyday participant) and the Convener (seeding conversation in a new circle).

## User-facing description
As a signed-in member of a circle, I want to reply to a specific post, so that the conversation reads as people responding to each other rather than a wall of separate messages.

## Acceptance criteria
Testable from the outside. Each gets at least one test.

- [ ] Given a signed-in member viewing a post, when they reply, then the reply appears nested one level beneath that post.
- [ ] A reply shows its author, body, and a relative time.
- [ ] Given a reply, when someone replies to *it*, then the new reply attaches at the same single level (no second level of nesting).
- [ ] Given a signed-out viewer, the reply affordance is replaced by a "sign in to reply" prompt (no disabled control).
- [ ] Given a reply that fails to send, an inline error with retry is shown and the parent post stays visible.
- [ ] A reply is scoped to its circle and its parent (it does not appear as a top-level post, and does not leak outside the circle).

## Concepts touched
- The circle conversation post (NIP-22 comment anchored to the Community Declaration) — replies extend it with a parent-post reference. Plain-language; the Architect resolves the exact wire shape and handle.
- The composer gate — reuse the existing posting gate (Story 47 + Story 2 degraded fallback) for who may reply; this story does not change who can post.

## Out of scope
- Reactions (Story 4), live "new" updates (Story 5), signs of life (Story 6).
- Deep/threaded nesting beyond one level (explicitly excluded by design).
- Notifications about replies (Block C, Story 8) — modeled there, not here.
- Editing or deleting posts/replies.

## Open questions
- Composer reuse: the reply composer should reuse the existing post composer scoped to the parent, rather than a separate component (confirm in Architecture).
- Ordering of replies under a parent (chronological assumed) — confirm in Architecture if non-obvious.

## Linked artifacts
- ADR: `engineering-team/decisions/communities-aliveness/0033-reply-threading.md` (Option A — replies always parent the top-level post; one level by construction)
- Test plan: `engineering-team/stories/communities-aliveness/3-reply-to-a-post.test-plan.md` (new suite `test/reply-to-a-post.test.js`: real-source builder/projection tests T1–T5 + component guards T6–T10)
- Review: `engineering-team/reviews/communities-aliveness/3-reply-to-a-post.md` (PASS, 2026-06-06; 2 non-blocking findings addressed: design-guide indent tokens + orphan-reply graceful fallback)
