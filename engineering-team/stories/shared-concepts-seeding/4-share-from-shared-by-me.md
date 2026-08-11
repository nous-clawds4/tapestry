# Story 4: Reach the not-yet-shared list from the page about what I've shared

**Status:** Approved
**Created:** 2026-08-11
**Type:** Feature

## Background

The book's **first frame bullet**, and its last one outstanding: *"From the page about what she has
shared, the owner can share a concept she hasn't shared yet, without knowing which other page to
visit."*

**Shared by me** answers one question — *what have I shared?* — and answers it well. It is also a
dead end. There is nothing on it that leads to the concepts you *haven't* shared, and its empty
state currently says *"You haven't shared any concepts yet. Submit one from its concept page"*,
which points at the slowest route and is now out of date.

Story #3 built the other half: the Concepts list can filter to **Not yet shared (mine)**, and each
undispositioned row there already carries a control that opens *Submit as a Shared Concept*. So the
destination already exists and already works. What is missing is the path to it.

### Why this is a signpost and not a second list

Ratified in `/discuss`, 2026-08-11. Putting the not-yet-shared concepts *on* Shared by me was
considered and rejected: it would duplicate a list that already exists, require a second copy of the
share control beside it, and make one page answer two questions — the "two verbs on one surface"
confusion the previous book spent itself undoing. The book's own note anticipated this ("a page
routes to an action rather than hosting a copy").

### Why the destination has to arrive ready

The Concepts list's state control resets to *All states* on every visit, and nothing in a link can
currently set it. So a bare link lands the owner on all 42 concepts with a control she must find and
set herself — which is the larger half of "without knowing which other page to visit". **The
substance of this story is that the destination arrives already narrowed**, not the link itself.

### What the list is for

Owner, 2026-08-11: *"everything in firmware needs to have a community shared concept. A few of them
do already; the rest we will take care of in due time."* So these are not stray items — they are a
**backlog the owner intends to work through, whose goal state is empty**. On production today that
is 6 of 39 handled (1 shared, 5 wired) and **33 remaining**. That reframes the signpost: it is a
route into a queue, and the size of the queue is a progress signal.

## User-facing description

As the owner of a Tapestry, I want the page about what I've shared to lead me to what I haven't, so
that I can work through the remainder without already knowing where to look or what to set.

## Acceptance criteria

- [ ] **AC-1 (there is a way through).** Given the Shared by me page, when the owner looks at it,
      then a visible route to her not-yet-shared concepts is present — findable without prior
      knowledge that the Concepts page exists.
- [ ] **AC-2 (the destination arrives ready).** Given the owner follows that route, when the
      destination loads, then it is **already narrowed to her not-yet-shared concepts** — she does
      not have to find or set any control to see them.
- [ ] **AC-3 (the errand completes).** Given the owner has arrived, when she picks one of those
      concepts, then she can share it with the community from there, and afterwards it is no longer
      listed as not-yet-shared.
- [ ] **AC-4 (the empty state stops giving stale advice).** Given the owner has shared nothing yet,
      when she opens Shared by me, then what it tells her to do next matches the route this story
      adds, rather than naming the concept page as the way to start.
- [ ] **AC-5 (the goal state reads as success).** Given the owner has nothing left un-shared — the
      state she is working toward — when she opens Shared by me, then the route does not present an
      empty errand as though there were work waiting.

## Concepts touched

None are defined or changed. The story is a route between two existing pages.

For context only: the meaning of *shared* is fixed by
`39998:<TA>:shared-concept` — *"publication to a public relay such as dcosl"* — and this story does
not touch it. The population being routed to is exactly what story #3 already defines as *not yet
shared*; **that definition is settled and out of scope here** (see Out of scope).

*(Handles are per-deployment; the Architect should resolve rather than copy.)*

## Out of scope

- **Changing what "not yet shared" means.** Ratified and shipped in story #3: yours, minus already
  shared, minus wired, minus deliberately private, plus tried-and-didn't-reach, with unconfirmed
  withheld. Re-opening it is a different story.
- **Hosting the list, or the share action, on Shared by me.** Considered and rejected above.
- **Bulk share** — selecting many concepts and sharing them in one go. The owner's stated goal (work
  the backlog to empty) is exactly what would justify it, and it is the natural successor to this
  story, but it is a separate feature and not needed for the frame bullet.
- **Any change to the Concepts list's filtering behaviour** beyond letting the destination arrive
  narrowed.
- **Making the disposition/share control available on rows that were declared but did not reach the
  community.** Those rows show their state but offer no in-place retry on the Concepts list. The
  population is empty on all three deployments today; noted so it is not mistaken for an oversight.

## Open questions

1. **Should the route show how many concepts are waiting?**

   *For:* the owner has named **empty** as the goal state, and a number is what makes progress
   toward it visible — "33 waiting" is a status line, not just navigation. It also answers AC-5
   cleanly: at zero the route can say so, or stand down, instead of pointing at an empty list.

   *Against:* Shared by me answers from a single bulk source today, and it knows only what has been
   *declared*. A count of what has **not** been shared needs the full concept population as well —
   a second source on a page whose present virtue is that it needs one.

   **Recommendation: include the count.** AC-5 is hard to satisfy honestly without knowing whether
   the number is zero, so the two are one decision rather than two. If the cost turns out to be
   worse than it looks, the Architect should say so and we drop AC-5 to "the route is still honest
   when the list is empty".

## Linked artifacts
- ADR: `engineering-team/decisions/shared-concepts-seeding/0002-the-route-and-its-count-reuse-the-shipped-predicate.md`
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
