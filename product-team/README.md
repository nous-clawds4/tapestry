# Product Team — Tapestry

This directory is the harness Claude Code uses for **product discovery and design**, upstream of the engineering team. It encodes the product team's roles, phases, templates, and guardrails. A non-technical user describes what they want in natural language; the product team iterates through structured phases; the output is a set of markdown artifacts the engineering team consumes directly via `/plan-feature`.

The boundary is clean: **the product team produces markdown. The engineering team writes code.** No source, no file paths, no library choices, no technical solutions cross from product into the artifacts.

## Natural language is the front door

You do not need to know any slash commands to use this flow. **Just describe what you want.** Say "I have an idea for a community feature and I want to figure out what to build," and Claude recognizes the start of product discovery, explains in plain words what it's about to do, and asks if you're ready. Each phase flows into the next through a normal conversation — "Want to continue?" — not a command. You talk in whatever words you have; the harness turns that into structured documents behind the scenes. You'll never be asked to say "persona" or "acceptance criteria," and you'll never see a phase number.

The slash commands below (`/discover`, `/scope`, …) are **shortcuts for people who already know the flow** and want to jump straight to a phase. When you use one, Claude switches to a more technical register (it names the role and phase). When you just talk, it stays in plain language. The routing rules live in `CLAUDE.md` → "Intent Detection," and each workflow file carries the exact plain-language entry and gate wording in its `## Natural language` section.

## Layout

```
product-team/
├── README.md           this file
├── roles/              role definitions — one file per role
├── workflows/          phase definitions — one file per phase
├── templates/          document templates
├── guardrails/         quality rules enforced across all phases (language, design)
├── discoveries/        discovery briefs accumulate here
├── personas/           persona documents accumulate here
├── journeys/           user journey documents accumulate here
├── scope/              scope documents accumulate here
├── domain/             domain model documents accumulate here
├── prd/                PRDs accumulate here
└── guides/             style guides and design guides accumulate here
```

The Claude Code wiring lives elsewhere:

- `.claude/commands/<phase>.md` — slash-command entry points: `/discover`, `/model-users`, `/scope`, `/model-domain`, `/design-experience`, `/assemble-prd`, `/decompose-stories`, `/discuss-product`.
- `.claude/agents/<role>.md` — subagents with role-appropriate tool whitelists. They can Write only into `product-team/`; the Product Advisor cannot Write at all.
- `CLAUDE.md` — auto-loaded; introduces Product Team Mode and links here.

## The product slug

Every product gets **one slug**, chosen in Phase 1 (Discovery) and reused by every downstream artifact. A product called "Unbnd" produces `discoveries/unbnd.md`, `personas/unbnd-reader.md`, `scope/unbnd.md`, `domain/unbnd.md`, `prd/unbnd.md`, `guides/unbnd-style-guide.md`, `guides/unbnd-design-guide.md`. The shared slug is what keeps a product's artifacts linkable across phases — the same discipline the engineering team's epic-slug provides.

## How the phases connect

```
  /discover            → discoveries/<slug>.md                    (Product Strategist)
  /model-users         → personas/<slug>-*.md, journeys/<slug>-*.md  (UX Researcher)
  /scope               → scope/<slug>.md                          (Product Manager)
  /model-domain        → domain/<slug>.md                         (Domain Modeler)
  /design-experience   → guides/<slug>-design-guide.md, wireframes (Product Designer)
  /assemble-prd        → prd/<slug>.md, guides/<slug>-style-guide.md (Product Lead)
  /decompose-stories   → product-team/stories-queue.md            (Product Lead)
```

Each phase reads the prior phases' artifacts and produces its own. **The user is the approval gate between phases.** After each phase output, Claude asks you to confirm before continuing. No auto-advance.

Every phase writes a durable file and commits it. Nothing important lives only in the conversation — if the session ends after Phase 4, the scope and domain work survive on disk.

## Quick reference

| To do this | Run |
|---|---|
| Talk to the product team in advisory mode (no artifacts) | `/discuss-product` |
| Explore the problem space for a new product | `/discover` |
| Define personas and journeys | `/model-users` |
| Draw the MVP boundary and roadmap | `/scope` |
| Model the entities, attributes, relationships | `/model-domain` |
| Design screens, interactions, visual identity | `/design-experience` |
| Assemble the PRD, style guide, design guide | `/assemble-prd` |
| Decompose the PRD into engineering stories | `/decompose-stories` |

`/discuss-product` defaults to the **Product Advisor** — a read-only thinking partner who knows the domain, the users, and the competitive landscape. Use `as <role> <topic>` for a specific lens, or `roundtable <topic>` for every product role in sequence.

## Handoff to the engineering team

When the flow completes, three artifacts are ready: the **PRD** (`prd/<slug>.md`), the **guides** (`guides/`), and the **stories queue** (`product-team/stories-queue.md`).

The stories queue is **epic-aware**. Its blocks map onto engineering *epics*. Each story brief names a suggested `epic-slug`. The engineering team's Product Owner reads the queue and promotes each block into an `engineering-team/epics/<slug>.md` umbrella plus an `engineering-team/stories/<slug>/` folder, then picks up stories via `/plan-feature`, referencing the PRD and guides as context. See `Handoff` in `workflows/7-story-decomposition.md` for the exact seam.

The product team does not attend engineering phases. The artifacts are the communication layer. If engineering has a product question, they kick back via `/discuss-product`.

### The return edge — what comes back

The handoff is not one-way. When engineering finishes a book of work, it runs `/close-book` and writes two artifacts under `engineering-team/audits/<book-slug>/`: a **build audit** (what actually shipped) and a **PRD addendum** (where the build diverged from the PRD, why, and the carry-forward) — or, if the work was built with no PRD, a **PRD seed** (a reconstructed baseline in this team's PRD shape). When you scope the *next* phase, Discovery reads those first, so you start grounded in what was built rather than from a blank page. The boundary stays symmetric: engineering reads our `stories-queue.md`; we read engineering's `audits/`. Neither team writes into the other's tree. See `engineering-team/README.md` → "The return edge".

## Role isolation

Each phase has a corresponding subagent in `.claude/agents/`. Subagents run in isolated context with constrained tools — every product role can Write only into `product-team/`, so none of them can touch source code, and the Product Advisor has no Write tool at all. The slash commands invoke role behavior in the main session for interactive phases; the subagents are useful when you want a role to run autonomously or in the background.

## Tuning the team

Edit role files in `roles/` to change how each role behaves. Edit workflow files in `workflows/` to change phase rules. The slash commands and subagents in `.claude/` only orchestrate — the source of truth for behavior is in this directory.

## Origin

This flow mirrors the engineering team harness (see `engineering-team/README.md`) but operates entirely in the product domain. The key insight is shared: the same structural guardrails that prevent slop *code* — role isolation, phase gates, explicit templates, durable artifacts, and human approval at every boundary — also prevent slop *product decisions*. Pattern lineage: Rob Conery's *Eliminate Crappy Slop Code* (https://bigmachine.io/articles/video/eliminate-crappy-slop-code/).
