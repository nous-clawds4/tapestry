# Story 5: New posts are offered, not forced

**Status:** Done
**Created:** 2026-06-06
**Type:** Feature
**Epic:** `communities-aliveness` · **Book:** `audits/communities-v2/book.md`
**PRD:** `product-team/prd/communities-v2.md` §5.1 · **Queue:** `product-team/stories-queue.md` Block B, Story 5

## Background
A circle's conversation has posts, replies (Story 3), and reactions (Story 4). Today it loads once (on tab open, and after the viewer sends) — so a reader doesn't see others' new posts until they reload. This story makes the room feel current **without** importing the attention-capture loop the product exists to reject. Per the design guide's sovereignty principle (7): new content is **offered** behind a single "N new" affordance the member taps, and **nothing is injected into the view they are reading**. There is no auto-scroll, no auto-refresh, no content jumping under their eyes.

Affected: the Belonger (returning to a circle that's had activity) and anyone reading an active conversation.

## User-facing description
As someone reading a circle's conversation, I want to be told when there are new posts and choose when to load them, so that I stay current without the room shifting under me or pulling at my attention.

## Acceptance criteria
Testable from the outside. Each gets at least one test.

- [ ] Given the conversation is open and new posts arrive, when they are detected, then a single "N new" affordance appears at the top of the conversation with the correct count.
- [ ] Given the "N new" affordance is shown, when the member taps it, then the new posts load into the conversation and the affordance clears.
- [ ] Given new posts are available, while the member has not tapped the affordance, then the posts already displayed do not move, shift, or get replaced (nothing is injected automatically).
- [ ] Given there are no new posts, then no affordance is shown.
- [ ] Given the member's own just-sent post, it appears immediately as today (optimistic) and is not counted as "N new".
- [ ] Given the new-posts check is unavailable, then the affordance simply does not appear and a manual reload still loads new posts (no error chrome for the background check).

## Concepts touched
- The circle conversation post (kind-1111) — the same posts; this story is about *when/how* newly-arrived ones are surfaced, not their shape.
- The conversation load path — extended with a non-injecting "new available" signal.

## Out of scope
- Real-time reactions / reaction-count live updates (this story is about new posts; reactions can refresh on the same tap, but a separate live-reaction stream is not in scope).
- Signs of life on discovery (Story 6).
- Notifications about new posts (Block C, Story 8) — a different surface; this is in-circle only.
- Auto-scroll, read receipts, typing indicators, presence — explicitly not building attention-capture mechanics.

## Open questions
- Detection mechanism — periodic poll vs a live relay subscription into a buffer. Either is acceptable if new content lands in a **buffer that is not rendered** until the member taps. Architecture decides; the sovereignty constraint (no auto-inject) is the hard requirement.
- Cadence/limits if polling (interval, backoff) — Architecture.
- How "new" is determined (events newer than the newest displayed, excluding the viewer's own optimistic/sent posts) — Architecture.

## Linked artifacts
- ADR: `engineering-team/decisions/communities-aliveness/0035-offered-live-updates.md` (Option A — poll into a non-rendered counter; tap → loadPosts; no-inject is structural)
- Test plan: `engineering-team/stories/communities-aliveness/5-offered-live-updates.test-plan.md` (new suite `test/offered-live-updates.test.js`: real-source countNewPosts T1–T5, component guards T6–T9; no-inject verified at review)
- Review: `engineering-team/reviews/communities-aliveness/5-offered-live-updates.md` (PASS, 2026-06-06)
