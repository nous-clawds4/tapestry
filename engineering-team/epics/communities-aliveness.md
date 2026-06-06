# Epic: Communities — A Circle That Feels Alive (Phase 2, Block B)

**Status:** Ready to plan (depends only on Block A's posting fallback)
**Created:** 2026-06-06
**Book:** `engineering-team/audits/communities-v2/book.md`
**Source:** PRD `product-team/prd/communities-v2.md` §5.1, §5.8 + `stories-queue.md` Block B. Design: `guides/communities-v2-design-guide.md` principles 7 & 11.

## What this is
The everyday social texture that turns a quiet room into a living one: threaded replies, honest reactions, offered (never forced) live updates, and read-only signs of life. Independent of the trust engine — it rides on conversation, which already works.

## Stories (`stories/communities-aliveness/`)
- **3 — Reply to a post** (one level of nesting only; mobile readability constraint).
- **4 — React to a post** (toggle, exact un-inflated counts).
- **5 — New posts are offered, not forced** (the "N new" affordance; nothing auto-injected — design principle 7).
- **6 — Signs of life on a circle** (read-only, honest about quiet; detail + cards).

## Dependencies
- Story 3 depends on Story 2 (`go-live`) — posting must be reliable, including the degraded path.
- Stories 4–6 depend on Story 3 (shared post-interaction surface / activity derivation).

## Notes
The sovereignty principle is load-bearing here: live updates are offered behind a tap, reactions are honest, signs of life never use urgency styling. The Reviewer enforces design principles 7 and 11.
