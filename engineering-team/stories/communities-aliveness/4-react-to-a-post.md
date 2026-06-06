# Story 4: React to a post

**Status:** Done
**Created:** 2026-06-06
**Type:** Feature
**Epic:** `communities-aliveness` · **Book:** `audits/communities-v2/book.md`
**PRD:** `product-team/prd/communities-v2.md` §5.1 · **Queue:** `product-team/stories-queue.md` Block B, Story 4

## Background
A circle's conversation now has posts and one-level replies (Story 3). Reactions are the lightest unit of "this room is alive" — a single tap that registers a member responding without writing a reply. Per the design guide (principle 7, and the style guide), reaction counts are **honest**: exact, never rounded or inflated for effect, and the surface must not become an engagement-vanity loop. This story builds on the same post-interaction surface as replies; who-may-react reuses the existing posting gate.

Affected: the Belonger (everyday participation) and anyone reading a circle (counts are visible read-only).

## User-facing description
As a signed-in member of a circle, I want to react to a post with a single tap and undo it, so that I can register a response lightly without writing a reply, and the room shows real engagement.

## Acceptance criteria
Testable from the outside. Each gets at least one test.

- [ ] Given a signed-in member viewing a post, when they react, then the post's reaction count increases by one and their reaction shows as active.
- [ ] Given the member has already reacted, when they tap their reaction again, then it is removed and the count decreases by one.
- [ ] The viewer's own reaction is visually distinct from reactions by others.
- [ ] Reaction counts shown are exact — the rendered number equals the number of distinct reactors (no rounding, no inflation).
- [ ] Given a signed-out viewer, reaction counts are visible but the react action prompts sign-in (no disabled control).
- [ ] A reaction (or un-reaction) that fails to send shows a non-blocking inline indication and leaves the post readable; the count reflects the last known good state.

## Concepts touched
- The reaction event (a NIP-25-style reaction referencing the target post) — plain-language; the Architect resolves the exact event kind/tag shape and how it stays scoped to the circle.
- The circle conversation post (kind-1111) — the reaction target.
- The composer/posting gate — reuse `canCompose` for who may react; no new permission logic.

## Out of scope
- Live "new reaction" updates pushed in real time (Story 5 covers offered live updates).
- Multiple reaction types / emoji palette — v1 is a single reaction kind unless the Architect finds a trivial, honest way to support a small set. Default to one.
- Reactions on replies vs only top-level — apply uniformly to any post (reply or top-level); both are posts.
- Notifications about reactions (not in Block C's launch set).
- Signs of life derived from reactions (Story 6).

## Open questions
- Single reaction type vs a small set — confirm in Architecture; default to one honest reaction (e.g. a "like"/up-mark) to avoid a vanity palette.
- How the viewer's own reaction state is determined (their reaction event present for the target) and how counts dedupe by reactor — Architecture.
- Optimistic toggle vs confirmed: optimistic is acceptable if it reconciles on failure (mirror the reply/post pattern).

## Linked artifacts
- ADR: `engineering-team/decisions/communities-aliveness/0034-post-reactions.md` (NIP-25 kind-7; latest-per-reactor +/- toggle; single reaction type; pure count aggregation)
- Test plan: `engineering-team/stories/communities-aliveness/4-react-to-a-post.test-plan.md` (new suite `test/react-to-a-post.test.js`: real-source buildReaction + summarizeReactions T1–T8, component/fetch guards T9–T11)
- Review: `engineering-team/reviews/communities-aliveness/4-react-to-a-post.md` (PASS, 2026-06-06)
