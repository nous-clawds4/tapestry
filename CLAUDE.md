# Tapestry / Brainstorm Search

Decentralized knowledge-graph protocol and search engine on nostr. Reference deployment runs at brainstorm.world.

Before starting work, read all four:

- [AGENTS.md](./AGENTS.md) — concept-graph orientation pattern. Read this BEFORE touching code.
- [ROADMAP.md](./ROADMAP.md) — product vision, principles, and the strategic roadmap for Brainstorm Search
- [BIBLE.md](./BIBLE.md) — architecture, protocol, data model, API, design decisions (universal, fork-agnostic)
- [OPERATIONS.md](./OPERATIONS.md) — brainstorm.world deployment: branches, CI/CD, droplets, gotchas

**Also check at session start:**

- [`docs/*HANDOFF*.md`](./docs/) — session continuity notes. Each handoff doc starts with a `**Status:**` line: `🔴 OPEN` = work hasn't been picked up; `✅ ADDRESSED / SUPERSEDED` = the follow-on work has shipped (the body is preserved for historical context, no action needed). Always scan for `OPEN` handoffs before starting fresh work — a previous session may have left specific instructions for the new one.
- [`engineering-team/stories/_intake.md`](./engineering-team/stories/_intake.md) — queued-but-unplanned work catalog. See [engineering-team/README.md](./engineering-team/README.md) for the format. Scan before opening a fresh feature request — there's often a relevant entry already triaged.

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

- The Concept Graph API on the local control panel is the authoritative source for domain concepts. Always check there before reading source. See AGENTS.md §1–§3 for the port, TA pubkey, and three-call orientation pattern.
- Reinstall firmware after adding/changing concept definitions — see AGENTS.md §6 for the exact curl.
- Don't add new lint or typecheck tooling without an explicit ADR. This project is intentionally JS-without-build.
- **The stack runs in Docker.** The control panel, Neo4j, strfry, and Redis run *inside* containers (`tapestry`, `tapestry-redis`, `nostr-search-*`) — their logs and CLIs live in the container, not on the host. Read logs / run commands via the container: `docker exec tapestry tail -n100 /var/log/brainstorm/<x>.log`, `docker exec tapestry supervisorctl status`, `docker exec tapestry-redis redis-cli …`. Host paths like `/var/log/brainstorm/...` and `/etc/brainstorm.conf` do **not** exist on the host. Same on the droplets: SSH in, then `docker exec tapestry …`. The control panel binds `:7778` in-container (nginx fronts `:80`); locally the repo is bind-mounted to `/usr/local/lib/node_modules/brainstorm` (source edits are live) with `node_modules` as a separate volume. See OPERATIONS.md for container layout and ports.
