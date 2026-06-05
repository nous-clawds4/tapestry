# Story 46: Cold-start — a true outsider's first vouch

**Status:** Design-ahead (BLOCKED; design decision open — ADR 0030 Q#3)
**Type:** Feature · **Epic:** `communities-membership` · **ADR:** 0030.

## Background
The biggest Newcomer risk: someone with no trust connections may never earn vouch #1, so the roster never includes them. Needs a deliberate bootstrap path.

## User-facing description
As a genuine **Newcomer** with no existing connections, I want a path to my first foothold, so that belonging isn't a closed door.

## Acceptance criteria
- [ ] A defined cold-start mechanism exists (one of: founder-granted initial vouch / time-bounded provisional standing / an invite link that carries a vouch — to be chosen).
- [ ] It does not let a captured/sybil actor manufacture standing at scale (the WoT weighting still governs).
- [ ] The applicant sees a clear path from "interested" to "member," never an opaque wait.

## Out of scope
Anti-abuse beyond the WoT weighting. Implementation until Q#3 is decided.

## Open questions
ADR 0030 Q#3 — pick the mechanism. **Decide before implementing.**

## Linked artifacts
ADR 0030; BLOCKED on the roster engine + Q#3.
