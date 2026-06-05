# Story 43: Assert membership (self-tag) and vouch for others

**Status:** Design-ahead (BLOCKED on the nostr-user-tag core on staging)
**Type:** Feature · **Epic:** `communities-membership` · **ADR:** 0030.

## Background
Belonging is asserted via the existing `nostr-user-tag` primitive (Vinney's). A person self-tags with a claimed label ("I'm in") or vouches for someone else (tags them, +1); disputes are −1. Communities consumes the primitive unchanged.

## User-facing description
As a **Newcomer/Belonger**, I want to say I belong and vouch for people I trust, so that membership grows through trust.

## Acceptance criteria
- [ ] A signed-in user can publish a **self-tag** carrying a label the circle claims (applicant signal).
- [ ] A signed-in user can **vouch** for another (a +1 tag with the claimed label) and **dispute** (−1).
- [ ] These use the shared `nostr-user-tag` event — no community-specific tag shape.
- [ ] Copy is peer/trust framed (no "approve/admit"); vouch reads as consequential.

## Out of scope
Roster computation (Story 44). Cold-start (Story 46).

## Linked artifacts
ADR 0030; BLOCKED on the nostr-user-tag core + Open Q#1/#2.
