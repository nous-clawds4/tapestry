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
├── decisions/          ADRs accumulate here as <NNNN>-<slug>.md
├── stories/            user stories accumulate here as <n>-<slug>.md
└── reviews/            review reports accumulate here as <n>-<slug>.md
```

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
  /plan-feature           → stories/<n>-<slug>.md
  /design-architecture    → decisions/<NNNN>-<slug>.md
  /design-tests           → stories/<n>-<slug>.test-plan.md + failing tests
  /implement-feature      → code changes that make the failing tests pass
  /review-changes         → reviews/<n>-<slug>.md
```

The user is the approval gate between phases. After each phase output, Claude asks you to confirm before continuing.

## Role isolation

Each phase has a corresponding **subagent** in `.claude/agents/`. Subagents run in isolated context with constrained tools — the Architect literally cannot edit source code, the Reviewer cannot rewrite the diff, etc. The slash commands invoke role behavior in the main session for interactive phases (Planning, Architecture, Tester); the subagents are useful when you want a role to run autonomously or in the background (e.g., kick off `/review-changes` and let the Reviewer subagent audit a branch end-to-end).

## Tuning the team

Edit role files in `roles/` to change how each role behaves. Edit workflow files in `workflows/` to change phase rules. The slash commands and subagents in `.claude/` only orchestrate — the source of truth for behavior is in this directory.

## Origin

Pattern adapted from Rob Conery's *Eliminate Crappy Slop Code* (https://bigmachine.io/articles/video/eliminate-crappy-slop-code/) and the broader "agentic Scrum" idea: structural guardrails matter more than model intelligence for output quality.

This is a Claude Code adaptation of the pi harness documented at `~/.pi/engineering-team-mode.md`.
