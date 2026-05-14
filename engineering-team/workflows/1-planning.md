# Phase 1: Planning

## Role
Product Owner. See `engineering-team/roles/product-owner.md`.

## Input
A classified request from Phase 0 (Intake).

## Output
A user story file at `engineering-team/stories/<n>-<slug>.md`, using the `user-story.md` template.

**Picking `<n>`:** scan **both** `engineering-team/stories/` AND `engineering-team/stories/done/` for the highest existing `<n>`; use `n + 1`. Numbers are never reused — `done/` is where shipped stories live. New stories always start with `**Status:** Draft` or `**Status:** Approved` (the reviewer flips to `Done` on PASS — see workflow 5).

## Steps

1. **Restate the request** to confirm understanding.
2. **Ask clarifying questions** about scope, users affected, success criteria. Max three at a time.
3. **Draft the story.** Acceptance criteria must be testable from outside.
4. **Show the draft.** Iterate with the user until approved.
5. **Save** the file.
6. **Gate:** ask explicitly: "Story approved? Ready to enter Architecture?"
7. On approval, hand off to `/design-architecture`.

## Common pitfalls
- Slipping into solution mode (proposing files, libraries). Stop. That's the Architect's job.
- Vague acceptance criteria like "works correctly" or "is fast". Force concrete, observable conditions.
- Too-large stories. If acceptance criteria exceed ~5 items or hit multiple subsystems, propose splitting it.
- Re-defining concepts that already exist in the Concept Graph. Reference by handle instead.

## Per-phase commits
Yes. After the user approves the story, commit it: `git add engineering-team/stories/<file> && git commit -m "story: <slug>"`.
