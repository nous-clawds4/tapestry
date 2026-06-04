# Engineering Team — Tapestry

This directory is the harness Claude Code uses when working in this project. It encodes the team's roles, phases, templates, and accumulated decisions/stories/reviews.

Generated 2026-04-30. Strictness: **Standard**.

## Layout

```
engineering-team/
├── README.md           this file
├── roles/              role definitions — one file per role
├── workflows/          phase definitions — one file per phase
├── templates/          document templates (user story, ADR, test plan, review)
├── epics/              one file per epic: <epic-slug>.md — the umbrella for a multi-story feature
├── stories/            user stories, scoped by epic
│   ├── <epic-slug>/    in-flight stories for that epic: <n>-<slug>.md (+ .test-plan.md)
│   └── done/<epic-slug>/   shipped epics — the whole epic folder is moved here at epic close
├── decisions/          ADRs, scoped by epic: <epic-slug>/<NNNN>-<slug>.md (+ done/<epic-slug>/)
└── reviews/            review reports, scoped by epic: <epic-slug>/<n>-<slug>.md (+ done/<epic-slug>/)
```

## Epic-scoped docs — why the subfolders

Stories, ADRs, and reviews are **scoped to an epic folder** rather than living in one flat namespace. An epic is one feature/branch-sized line of work, described by `epics/<epic-slug>.md`; everything it produces lives under `stories/<epic-slug>/`, `decisions/<epic-slug>/`, and `reviews/<epic-slug>/`.

- **Numbering is per-epic.** `<n>` (and ADR `<NNNN>`) restart inside each epic folder. Two epics can each have a `#3` — that's fine, because their *paths* are disjoint. To refer to a story unambiguously, qualify it: "`<epic>` #3". This per-epic scoping is what makes feature-branch merges collision-free: independent branches never fight over the same integer-at-the-same-path. (Before this, two branches both producing a "Story 8" at `stories/8-*.md` was a guaranteed merge conflict.)
- **`done/` holds shipped epics.** Everything *outside* `done/` is active, fair-game work that anyone may pick up. When an epic ships, its whole folder moves under `done/<epic-slug>/` in one `git mv` per area (stories / decisions / reviews) — see `workflows/5-review.md` → "Epic close-out". Individual stories are **not** moved one at a time; the reviewer only flips a story's `**Status:**` to `Done` in place.
- **`stories/_intake.md`** is optional scratch space for queued-but-unformalized notes. The mechanistic flow now favors promoting work into an epic; intake is a free-form catch-all for anyone who wants it, not a required gate.

The Claude Code wiring lives elsewhere:

- `.claude/agents/<role>.md` — subagents with role-appropriate tool whitelists. These run in isolated context with only the tools each role legitimately needs.
- `.claude/commands/<phase>.md` — slash-command entry points for each phase. `/plan-feature`, `/design-architecture`, etc.
- `CLAUDE.md` — auto-loaded; introduces Engineering Team Mode and links to this directory.

## Quick reference

| To do this | Run |
|---|---|
| Talk to the team in advisory mode (no artifacts) | `/discuss` |
| Start a new feature | `/plan-feature` |
| Design an approach for an existing story | `/design-architecture` |
| Write tests for a story + ADR | `/design-tests` |
| Implement a story that has tests | `/implement-feature` |
| Review a diff before commit | `/review-changes` |

`/discuss` defaults to the **Product Expert** — a read-only thinking partner who knows the domain, stack, and existing decisions. Use `as <role> <topic>` for a different lens, or `roundtable <topic>` for multi-perspective.

## How the phases connect

```
  /plan-feature           → stories/<epic>/<n>-<slug>.md
  /design-architecture    → decisions/<epic>/<NNNN>-<slug>.md
  /design-tests           → stories/<epic>/<n>-<slug>.test-plan.md + failing tests
  /implement-feature      → code changes that make the failing tests pass
  /review-changes         → reviews/<epic>/<n>-<slug>.md
```

The user is the approval gate between phases. After each phase output, Claude asks you to confirm before continuing.

## Role isolation

Each phase has a corresponding **subagent** in `.claude/agents/`. Subagents run in isolated context with constrained tools — the Architect literally cannot edit source code, the Reviewer cannot rewrite the diff, etc. The slash commands invoke role behavior in the main session for interactive phases (Planning, Architecture, Tester); the subagents are useful when you want a role to run autonomously or in the background (e.g., kick off `/review-changes` and let the Reviewer subagent audit a branch end-to-end).

## Tuning the team

Edit role files in `roles/` to change how each role behaves. Edit workflow files in `workflows/` to change phase rules. The slash commands and subagents in `.claude/` only orchestrate — the source of truth for behavior is in this directory.

## Origin

Pattern adapted from Rob Conery's *Eliminate Crappy Slop Code* (https://bigmachine.io/articles/video/eliminate-crappy-slop-code/) and the broader "agentic Scrum" idea: structural guardrails matter more than model intelligence for output quality.

This is a Claude Code adaptation of the pi harness documented at `~/.pi/engineering-team-mode.md`.
