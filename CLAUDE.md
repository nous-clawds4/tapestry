# Tapestry / Brainstorm Search

Decentralized knowledge-graph protocol and search engine on nostr. Reference deployment runs at brainstorm.world.

Before starting work, read all four:

- [AGENTS.md](./AGENTS.md) — concept-graph orientation pattern. Read this BEFORE touching code.
- [ROADMAP.md](./ROADMAP.md) — product vision, principles, and the strategic roadmap for Brainstorm Search
- [BIBLE.md](./BIBLE.md) — architecture, protocol, data model, API, design decisions (universal, fork-agnostic)
- [OPERATIONS.md](./OPERATIONS.md) — brainstorm.world deployment: branches, CI/CD, droplets, gotchas

## Engineering Team Mode

This project runs every change through a **Product Owner → Architect → Tester → Implementer → Reviewer** harness with explicit human approval gates between phases. Pattern adapted from Rob Conery's *Eliminate Crappy Slop Code* (https://bigmachine.io/articles/video/eliminate-crappy-slop-code/).

The harness lives in two places:

- **`engineering-team/`** — roles, workflows, templates, and accumulating decisions/stories/reviews. Source of truth for behavior. Read [engineering-team/README.md](./engineering-team/README.md) for the layout and phase wiring.
- **`.claude/`** — wiring only:
  - `.claude/commands/<phase>.md` — slash commands: `/plan-feature`, `/design-architecture`, `/design-tests`, `/implement-feature`, `/review-changes`, `/discuss`.
  - `.claude/agents/<role>.md` — subagents with role-appropriate tool whitelists. The Architect cannot Edit source. The Reviewer cannot Edit source.

### How to operate

1. **Classify the request.** Ask: "Is this a new feature, a bug fix, a refactor, or a doc/typo change?" That answer determines which phases apply (Standard strictness):

   | Type | Phases that apply |
   |---|---|
   | Feature | All five phases |
   | Bug | Skip Architecture if obvious; otherwise all |
   | Refactor | Skip Tests if no behavior change |
   | Doc / typo / one-liner | Implementer + Reviewer only |

2. **Know which role you're in.** When a phase command is invoked, state at the top of your first response: "I'm acting as the {Role}. Phase: {Phase}."
3. **Stay in role.** The Architect doesn't write the implementation. The Implementer doesn't invent new requirements. If the inputs are unclear, kick back to the prior phase rather than drifting.
4. **Honor the gates.** End each phase by summarizing the output and asking the user to approve before moving on. Do not auto-advance.
5. **Use the templates.** Stories, ADRs, test plans, and reviews start from `engineering-team/templates/`.

### Project settings

| Setting | Value |
|---|---|
| Strictness | Standard |
| ADRs | enabled |
| Clean working tree before starting a feature | yes |
| Commit at each phase boundary | yes |

## House rules

- The Concept Graph API at `http://localhost:8877` is the authoritative source for domain concepts. Always check there before reading source. See AGENTS.md for the three-call orientation pattern.
- Reinstall firmware after adding/changing concept definitions: `curl -X POST http://localhost:8877/api/firmware/install`.
- Don't add new lint or typecheck tooling without an explicit ADR. This project is intentionally JS-without-build.
