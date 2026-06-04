# Phase 1: Planning

## Role
Product Owner. See `engineering-team/roles/product-owner.md`.

## Input
A classified request from Phase 0 (Intake).

## Output
A user story file at `engineering-team/stories/<epic-slug>/<n>-<slug>.md`, using the `user-story.md` template.

**Scope & numbering:** stories live in an epic folder, `engineering-team/stories/<epic-slug>/`. Pick the epic first (existing one, or create `epics/<epic-slug>.md` + a new folder, or ask the user). Then pick `<n>` by scanning **that epic's folder** (and its `done/<epic-slug>/` counterpart, if present) for the highest existing `<n>`; use `n + 1`. Numbers are unique *within an epic*, not globally — two epics may each have a `#3`, so qualify references as "`<epic>` #<n>". This per-epic scoping is what keeps story numbers from colliding when feature branches merge. New stories start with `**Status:** Draft` or `**Status:** Approved` (the reviewer flips to `Done` on PASS — see workflow 5).

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
Yes. After the user approves the story, commit it: `git add engineering-team/stories/<epic-slug>/<file> && git commit -m "story: <slug>"`.
