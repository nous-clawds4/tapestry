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

## Product Team Mode (upstream — optional)

*Before* a feature is engineered, a product can be **discovered and designed** through a parallel harness in `product-team/`. It runs upstream of Engineering Team Mode and is optional: use it when starting a new product or a substantial feature area where the requirements aren't yet clear. A non-technical user describes what they want in natural language; the product team iterates through structured phases; the output is markdown artifacts the engineering team consumes.

The boundary is clean: **the product team produces markdown (PRD, guides, story queue). The engineering team writes code.** No source, no file paths, no library choices cross into the product artifacts.

- **`product-team/`** — roles, workflows, templates, guardrails, and accumulating discoveries/personas/journeys/scope/domain/prd/guides. Source of truth for product behavior. Read [product-team/README.md](./product-team/README.md) for the layout.
- **`.claude/`** — wiring only:
  - `.claude/commands/<phase>.md` — slash commands: `/discover`, `/model-users`, `/scope`, `/model-domain`, `/design-experience`, `/assemble-prd`, `/decompose-stories`, `/discuss-product`.
  - `.claude/agents/<role>.md` — product subagents; each can Write only into `product-team/`, and the Product Advisor cannot Write at all.

The seven phases — **Discovery → User Modeling → Scope → Domain Modeling → Experience Design → PRD Assembly → Story Decomposition** — each have a human approval gate and write a durable artifact. The flow ends by emitting `product-team/stories-queue.md`, an epic-aware backlog. **The handoff is doc-driven and one-directional:** the engineering Product Owner reads that queue, creates the matching epics under `engineering-team/`, and promotes each brief via `/plan-feature`. The product flow never writes into `engineering-team/`. See [product-team/README.md](./product-team/README.md) → "Handoff to the engineering team".

## Intent Detection (natural language is the primary interface)

Most people who use the product flow will never type a slash command. **Natural language is the default way in; slash commands are shortcuts for people who already know the flow.** Claude reads what the user says, infers which phase they mean, confirms it in plain language, and proceeds. The non-technical user never needs to know slash commands exist.

### Register — who am I talking to?

- **User spoke naturally** (no slash command) → treat them as non-technical. Enter the phase with the **plain-language entry message** from that phase's workflow file (its `## Natural language` section). Do **not** say "I'm acting as the UX Researcher. Phase 2: User Modeling" — role labels and phase numbers are internal machinery. Say what you're about to do in plain words, then ask "Ready?" before starting. Never use jargon like "persona," "acceptance criteria," or "entity" with this user — translate their words into structure silently.
- **User typed a slash command** → treat them as technical. Use the formal role announcement ("I'm acting as the Product Strategist. Phase: Discovery.") exactly as the command file specifies.

Between phases the gate is **conversational, never a command**: "I've captured the problem space. Next I'd map out who your users are and what their experience looks like. Want to continue?" The user says yes; the next phase begins. No `/model-users` required.

### Routing table

**Product flow — figuring out *what* to build** (enter the phase, confirm in plain language):

| The user says something like… | Phase to enter |
|---|---|
| "I have an idea," "I want to build," "what should we build," "help me figure out what to make" | Discovery (`/discover`) |
| "who are the users," "who is this for" | User Modeling (`/model-users`) |
| "what's in the first version," "what should we cut," "what's the scope" | Scope (`/scope`) |
| "what information do we need," "what are the things involved" | Domain Modeling (`/model-domain`) |
| "what should it look like," "design the screens" | Experience Design (`/design-experience`) |
| "put it all together," "write it up," "write the PRD" | PRD Assembly (`/assemble-prd`) |
| "break it into tasks," "what does engineering need" | Story Decomposition (`/decompose-stories`) |
| "let's start building," "hand off to engineering," "ready to build" | Story Decomposition → engineering handoff |

**Engineering flow — figuring out *how* to build it** (technical audience; formal announcements are fine here):

| The user says something like… | Where to go |
|---|---|
| "let's implement," "write the code," "build this story" | `/plan-feature` (new story) or `/implement-feature` (story with tests) |
| "review the code," "is this ready to ship" | `/review-changes` |

**Advisory — thinking out loud** (no artifacts):

| The user says something like… | Where to go |
|---|---|
| "what do you think about," "help me think through" (product / users) | `/discuss-product` |
| "what do you think about," "help me think through" (stack / feasibility) | `/discuss` |

**When in doubt, ask one question:** "Are you exploring a product idea (figuring out *what* to build) or ready to start engineering (*how* to build it)?" Then route.

### The non-technical journey, end to end

A product person opens Claude Code and says *"I have an idea for a community feature and I want to figure out what to build."* Claude confirms it's the start of product discovery, explains in plain words that it'll ask about the problem, the people, and what exists today, and asks "Ready?" From there each phase flows into the next through conversational gates. The user talks in whatever words they have — *"the women in the community need a way to vouch for each other"* — and the harness translates that into structured artifacts behind the scenes. When the product work is done, Claude presents the PRD and guides and offers to break the work into engineering tasks. If the user says "let's start building," Claude decomposes the stories and either hands to the engineering flow or notes that the engineering side is best run by (or with) a technical teammate. The user never types a slash command, never hears "persona" or "acceptance criteria," and never sees a phase number.

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
