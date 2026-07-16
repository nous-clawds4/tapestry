# PLAN (ON HOLD): first-class `/plan-epic` mechanism

> **Status:** Deferred 2026-06-05. This file is intentionally **uncommitted** (local working-tree notes). Pick up when ready.
> **Where it ships:** separate follow-up PR to `staging`, *after* the epic-folder reorg PR (`chore/eng-team-epic-scoping`) merges. Build the branch stacked on `chore/eng-team-epic-scoping` so it has the new folder structure as context and stays conflict-free; retarget/open the PR against `staging` once PR #1 is in.

## The gap

The epic-folder reorg PR gives staging the **folders** (`stories/<epic>/`, `decisions/<epic>/`, `reviews/<epic>/`, `epics/<epic>.md`) and **prose convention** (Product Owner "creates `epics/<slug>.md` when work spans multiple stories"). But there is **no first-class mechanism on any branch** — verified on feat 2026-06-05:

- `.claude/commands/`: plan-feature, design-architecture, design-tests, implement-feature, review-changes, discuss — **no `plan-epic`**
- agents: 5 roles + product-expert — no epic agent
- workflows: `0-intake` … `5-review` — no epic phase
- templates: adr, review-checklist, test-plan, user-story — **no epic template**

`epics/pin-a-tag.md` (on feat) is a hand-written umbrella, not a command output. So this is **build**, not port. No new agent needed — the Product Owner role frames epics.

## Files to add (~4 small)

### 1. `engineering-team/templates/epic.md`

Model on `user-story.md` style + the real `epics/pin-a-tag.md`. Sketch:

```markdown
# Epic: <title>

**Status:** Active | Done
**Created:** <DATE>
**Branch:** `<feature-branch>` (optional)
**Linked issue:** <url> (optional)

## What this is
One paragraph: the user-facing capability this epic delivers.

## Why now
The leverage: why this is the next thing, what it unlocks.

## Naming (optional)
The verb/noun of art if the feature has ambiguous terminology.

## Cross-story architectural shape
The shared technical spine the member stories inherit (storage kinds,
event shapes, POV/WoT touch-points, replaceability, etc.). Keep it to
the cross-cutting decisions; per-story detail belongs in each story/ADR.

## Stories
Living index. Numbers are scoped to this epic folder.
- [ ] #1 <slug> — <one line>  (Status)
- [ ] #2 <slug> — ...

## Out of scope
What this epic explicitly defers (and to where).
```

### 2. `engineering-team/workflows/0-epic.md`  ("Phase 0.5: Epic framing")

- **Trigger:** a request clearly spans multiple stories or subsystems (Intake flags it, or PO notices during Planning).
- **Steps:** pick `<epic-slug>` → create `epics/<slug>.md` from the template → create the three folders `stories/<slug>/`, `decisions/<slug>/`, `reviews/<slug>/` → record the member stories as a checklist in the umbrella → hand each story to `/plan-feature`, which files under `stories/<slug>/` and numbers per-epic.
- **Output:** the epic umbrella + empty epic folders.
- **Gate:** show the umbrella, get approval, then start planning the first story.
- **Per-phase commit:** `git add engineering-team/epics/<slug>.md && git commit -m "epic: <slug>"`.
- Sits between Intake (0) and Planning (1); a single-story request skips it entirely.

### 3. `.claude/commands/plan-epic.md`

Mirror `plan-feature.md` format. Frontmatter description ≈ "Enter Phase 0.5 (Epic framing). Act as Product Owner — frame a multi-story feature as an epic umbrella under engineering-team/epics/." Points at `roles/product-owner.md`, `workflows/0-epic.md`, `templates/epic.md`. Same gate discipline (no auto-advance; hand to `/plan-feature` per story). `$ARGUMENTS` at the end.

### 4. Small edits to existing files

- `roles/product-owner.md` → add: "If the request spans multiple stories/subsystems, run `/plan-epic` first to create the umbrella + folders, then file each story under it." (Already half-covered by the "pick the epic folder first" language from the reorg.)
- `README.md` → add `/plan-epic` to the Quick-reference table and the "How the phases connect" diagram:
  `/plan-epic  → epics/<slug>.md (+ empty stories/<slug>/ decisions/<slug>/ reviews/<slug>/)`

## Open considerations
- Keep it lightweight — an epic is an *umbrella + index*, not a heavyweight gate. Single-story work must never be forced through `/plan-epic`.
- Epic close-out already lives in `workflows/5-review.md` (whole folder → `done/<epic>/`); make sure `0-epic.md` cross-links it so the lifecycle reads end-to-end.
- Decide whether `/plan-epic` should auto-create the empty `decisions/`/`reviews/` epic dirs (needs `.gitkeep` since git won't track empty dirs) or let them appear when the first ADR/review lands. Lean: create with `.gitkeep` so the structure is visible immediately.
```
