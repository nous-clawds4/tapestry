# Story 47: Retire the interim posting gate (trust-based posting)

**Status:** Design-ahead (BLOCKED — needs the roster engine)
**Type:** Refactor/Feature · **Epic:** `communities-membership` · **ADR:** 0030.

## Background
MVP posting is gated on `signedIn && joined` (an interim local-state check, PRD Open Q#5). Once the real roster exists, posting (and other member actions) gate on **actual membership** from the viewer's PoV.

## User-facing description
As a **member**, I want to post because I belong (trust-derived), not because of a local flag, so that participation matches real membership.

## Acceptance criteria
- [ ] The composer gates on the derived roster (member) rather than the interim `joined` flag.
- [ ] A non-member sees the "join this circle to post" affordance pointing at the membership path (self-tag / earn vouches).
- [ ] No regression to the kind-1111 posting + CD anchor (Story 41).

## Out of scope
Reply threads. Reactions. Moderation (Phase 3).

## Linked artifacts
ADR 0030; BLOCKED on Story 44 (roster) + Story 43 (assertions).
