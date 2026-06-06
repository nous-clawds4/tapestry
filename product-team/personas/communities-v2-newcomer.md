# Persona: The Newcomer (Phase 2)

**Slug:** communities-v2-newcomer
**Priority:** Primary
**Date:** 2026-06-06
**Builds on:** `personas/communities-newcomer.md` (V1)

## Who they are
Someone evaluating whether and how to join a circle, who in Phase 2 splits into two cases the product must serve differently:
- **The connected newcomer** already sits somewhere in the broad web of trust. V1 serves them: they can say "I'm in" and bootstrap from existing trust.
- **The true outsider** trusts no one in the graph and is trusted by no one. V1 serves them not at all. They hit a wall the moment belonging is computed from vouches, because they have zero. This is the case Phase 2 has to crack.

Both are wary of scams and impersonators and have been burned by follower counts and checkmarks. Both also now ask a question V1 could not answer: *is this circle even alive?*

## What they want
To find a real, living circle for their interest, tell real members from impersonators, and earn a legitimate first foothold even when they start with no connections.

## Their core loop
Discover circles → read whether the circle is alive and who is actually inside (impersonators carry no weight) → for the outsider, get a first foothold through a path that does not require pre-existing trust → introduce themselves and earn vouches → cross over into being a Belonger.

## What they won't tolerate
- A circle that looks abandoned with no way to tell whether anyone is home.
- The cold-start wall presented as a dead end: "you are trusted by no one, so you cannot enter," with no path forward.
- A foothold mechanism that is just the old admin-approval queue renamed.
- Joining and then being invisible, with no path from "interested" to "belongs."

## Notes
The Newcomer rises from Secondary to Primary in Phase 2 because the Convener's growth depends on it: a founder cannot grow a circle past their own immediate trust unless an outsider can get in. Cold-start is therefore not a separate feature for a separate persona; it is the Convener's growth engine seen from the other side. The discovery brief biases toward invite-carries-a-vouch as the likely mechanism (a founder's invite confers the first foothold), to be decided in scope. Two V1 constraints still bind: the **first visit must work read-only** (browse and read signs of life and the trust signal before any identity exists), and the **cold-start path must not collapse into an admin gate**.
