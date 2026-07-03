# Tapestry / Brainstorm Search

Decentralized knowledge-graph protocol and search engine on nostr. Reference deployment runs at brainstorm.world.

Before starting work, read all four:

- [AGENTS.md](./AGENTS.md) — concept-graph orientation pattern. Read this BEFORE touching code.
- [ROADMAP.md](./ROADMAP.md) — product vision, principles, and the strategic roadmap for Brainstorm Search
- [BIBLE.md](./BIBLE.md) — architecture, protocol, data model, API, design decisions (universal, fork-agnostic)
- [OPERATIONS.md](./OPERATIONS.md) — brainstorm.world deployment: branches, CI/CD, droplets, gotchas

**Also check at session start** — or just run **`/whats-open`** (alias: `bash scripts/whats-open.sh`) for a unified roll-up of everything still open across sessions, derived from all the surfaces below plus the ledger:

- [`OPEN.md`](./OPEN.md) — the single ledger for **small / cross-cutting open items that have no other surface** (one-off cleanups, "does BIBLE need a note about what we just built?" decisions, follow-ups too small for a handoff doc, a branch to delete). The surfaces below hold the larger triaged work; `/whats-open` rolls them all together. **Write discipline:** whenever you end a session with such a loose end, add a row here (and flip it to `DONE` when handled) so the next session — any session — sees it.
- [`docs/*HANDOFF*.md`](./docs/) — session continuity notes. Each handoff doc starts with a `**Status:**` line: `🔴 OPEN` = work hasn't been picked up; `✅ ADDRESSED / SUPERSEDED` = the follow-on work has shipped (the body is preserved for historical context, no action needed). Always scan for `OPEN` handoffs before starting fresh work — a previous session may have left specific instructions for the new one.
- [`engineering-team/stories/_intake.md`](./engineering-team/stories/_intake.md) — queued-but-unplanned work catalog. See [engineering-team/README.md](./engineering-team/README.md) for the format. Scan before opening a fresh feature request — there's often a relevant entry already triaged.
- [`protocols/README.md`](./protocols/README.md) — index of every protocol spec we author (published Custom NIPs, local pre-NIPs) with per-spec status, plus [`protocols/worksheet.md`](./protocols/worksheet.md) for open protocol problems. Check before any protocol/NIP/wire-format work — the spec's status and current source of truth are recorded there.

## ⚠️ Architecture invariants — read every session

Brainstorm/Tapestry is built around three principles. Default coding instincts trained on centralized SaaS systems will silently violate these. If a design feels "obvious" and it doesn't honor these, the design is probably wrong — pause and re-derive.

### 1. POV-first: there is no "the view," only views from a perspective

Every personalized output — search ranking, whether a user is "in the WoT," whether a tag "counts," what's trustworthy — is computed *from a specific point-of-view*. A POV is identified by a delegated pubkey (the "house POV" is the instance's default delegate; logged-in users can switch to their own POV after computing their WoT).

- Profile docs in Meilisearch already carry POV-namespaced columns: `wot_rank_<8charsuffix>`, `wot_followers_<8charsuffix>`, etc. Each suffix is one POV's perspective on that profile. Search filters/sorts are POV-namespaced.
- When you're answering "is this user trusted?" or "does this assertion count?" — **the answer depends on the POV**. There is no global truth. Don't write code that pretends otherwise.
- **Common mistake**: pre-computing a denormalized "trusted set," "applied tags," or "relevant assertions" column per target and treating it as global. There is no such thing. If you want per-POV behavior, either (a) provision per-POV columns and accept the denormalization burden, or (b) — usually right — *filter at query time* using the existing POV columns.

### 2. Decentralized-first: publishing is permissionless; aggregation is opinionated

Anyone publishes anything — follows, mutes, reports, tags, kind-39999 list-elements, profile metadata. The system does **not** gate publication. It aggregates and presents per-POV.

- Don't write code that requires a "canonical author" or "approved list" before something can exist. Tags can be created by any pubkey. Tag applications can be published by any pubkey. The TA (Tapestry Assistant) is not special at write time — it's special only because it publishes the firmware seed.
- The "trusted set" emerges from a POV's WoT computation, not from a list someone administers. If your code asks "is this user allowed?", you probably want "does this user's published assertion count *for this POV*?"
- **Common mistake**: validation that rejects events from unknown authors, or features that only work for "verified" users. Wrong layer. Accept all signed events; trust filtering happens at read time, per POV.

### 3. Filter at view time, not write time

A POV's view of the world is `(assertions from anyone) × (that POV's trust scoring)`. Both inputs change over time. Storing the *result* — "what does PoV X think today" — invites stale data and a combinatorial denormalization burden across N POVs × M targets.

- Prefer scanning raw assertions + applying the active POV's filter at query time. The strfry index supports filtered scans (`#z`, `#p`, `#e`, etc.); the Meili index already carries per-POV trust columns. Compose them.
- Only denormalize per-POV columns when the query-time cost is provably unacceptable. "It might be slow" is not enough — measure.
- **Common mistake**: "let me compute this once and store it" for anything subjective. The answer changes when the POV changes or when a new assertion arrives. Re-derive on read.

### Reflex checks when designing anything

Before writing the design, run these four questions on it:

1. **"Who is this true for?"** If the answer is "everyone" or "the database," check again — it's usually "*this POV's view*; others may differ."
2. **"Where does this trust come from?"** If you're about to hard-code an admin/owner/role check, look harder — there's usually a WoT-derived signal you should use instead (`wot_rank_<suffix>`, follow graph, etc.).
3. **"Could anyone else publish their own version of this?"** If yes, your code must not gate them at write time.
4. **"What changes when the POV changes?"** If your design forces a re-index or migration each time a user switches POV, the abstraction is at the wrong layer — push it to query time.

If the design you're about to write fails any of these, stop and re-derive from a POV-aware vantage point before continuing.

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

### At session start — pick the lane proactively

Before picking up work, **evaluate on your own which flow fits** — the **Product Team** (figuring out *what* to build) or the **Engineering Team** (figuring out *how* to build it) — and either enter that flow or ask the one-question clarifier (see "When in doubt" below). Don't wait to be told which team to use, and don't let a concrete-*sounding* request default you into Engineering:

- **New or underspecified feature area** (the requirements aren't yet settled) → lean **Product Team**. A request that names a concrete feature ("add an X count," "build a Y page") still belongs in Discovery when the product questions underneath it — point of view, fallbacks, who it's for, what's in/out of scope — aren't yet answered. That is exactly what Product Team Mode is for.
- **Defined story, clear *how*, or a bug / refactor / doc change** → **Engineering Team** (`/plan-feature` …), or the Protocol-Spec docs-mode flow for BIBLE/ADR work.
- **Genuinely on the fence** → ask one question rather than defaulting into build mode.

The failure mode this guards against: defaulting into Engineering because a request *sounds* well-specified, and thereby skipping the Discovery → User Modeling → Scope → Domain → Design → PRD work that actually surfaces the requirements.

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
| "I think that's everything," "that's all I needed," "looks done," "we're done" | **Offer to close the book** → `/close-book` (don't auto-run; the user's "yes" is the trigger) |

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
  - `.claude/commands/<phase>.md` — slash commands: `/plan-feature`, `/design-architecture`, `/design-tests`, `/implement-feature`, `/review-changes`, `/close-book`, `/discuss`.
  - `.claude/agents/<role>.md` — subagents with role-appropriate tool whitelists. The Architect cannot Edit source. The Reviewer cannot Edit source.

Phases 1–5 are the **per-story** cycle. Above them sits one **per-book** milestone, `/close-book` — see "Books of work and the return edge" below.

**Protocol-spec variant (docs-mode).** For big-picture *protocol* changes — evolving the BIBLE spec and its ADRs rather than writing code — use the lightweight **Protocol-Spec Workflow**: `/discuss` to scope → a living design doc to capture → the per-story cycle in *docs-mode* (Test Design skipped, Implementer authors BIBLE prose, Reviewer audits accuracy) to ratify into BIBLE + ADRs. See [engineering-team/workflows/protocol-spec-workflow.md](./engineering-team/workflows/protocol-spec-workflow.md).

### How to operate

1. **Classify the request.** Ask: "Is this a new feature, a bug fix, a refactor, or a doc/typo change?" That answer determines which phases apply — the **normative strictness table lives in [engineering-team/workflows/0-intake.md](./engineering-team/workflows/0-intake.md) step 3** (this project runs Standard). Shorthand: features get all five phases; bugs may skip Architecture if obvious; refactors may skip Tests if no behavior change; doc/typo changes fast-track to Implementer + Reviewer.

2. **Know which role you're in.** When a phase command is invoked, state at the top of your first response: "I'm acting as the {Role}. Phase: {Phase}."
3. **Stay in role.** The Architect doesn't write the implementation. The Implementer doesn't invent new requirements. If the inputs are unclear, kick back to the prior phase rather than drifting.
4. **Honor the gates.** End each phase by summarizing the output and asking the user to approve before moving on. Do not auto-advance. *Sole exception:* a Direction-mode book with an **armed** pre-registration — gates are then answered by the Director under blinded-judge rubrics, never skipped; see [engineering-team/roles/director.md](./engineering-team/roles/director.md) and `/direct-feature`.
5. **Use the templates.** Stories, ADRs, test plans, and reviews start from `engineering-team/templates/`.

### Project settings

| Setting | Value |
|---|---|
| Strictness | Standard |
| ADRs | enabled |
| Clean working tree before starting a feature | yes |
| Commit at each phase boundary | yes |

### Books of work and the return edge

The per-story cycle sits inside a larger unit — a **book of work**: a PRD, one roadmap phase of a PRD, or (with no PRD) a bounded ask. Books bracket the loop back to the product team:

- **Open (eager anchor).** At intake, a new book opens `engineering-team/audits/<book-slug>/book.md` recording its intent anchor — the PRD it realizes, or a short **acceptance frame** (the ask restated and confirmed) when there's no PRD. This is the durable definition of "done"; without it, completion can't be detected across sessions and the close drops to low confidence.
- **Detect completion (offer, don't auto-run).** After every per-story PASS — or when the user signals "I think that's everything" — check whether the book now looks complete (computed for PRD-backed books; judged against the acceptance frame otherwise). If it does, *offer* to close it. The system never declares done; it proposes done and the user ratifies. Their "yes" is the trigger for `/close-book`.
- **Close (`/close-book`).** The Reviewer, at book scope, writes two artifacts under `audits/<book-slug>/`: `audit.md` (the as-built record) and either `prd-addendum.md` (PRD-backed — deltas vs the PRD) or `prd-seed.md` (no PRD — a reconstructed baseline). These are the **return edge**: the product team reads them to scope the next phase. Engineering authors them under `engineering-team/` and never writes into `product-team/` — the mirror image of engineering reading the product team's `stories-queue.md`. See [engineering-team/README.md](./engineering-team/README.md) → "The return edge".

## House rules

- The Concept Graph API on the local control panel is the authoritative source for domain concepts. Always check there before reading source. See AGENTS.md §1–§3 for the port, TA pubkey, and three-call orientation pattern.
- Reinstall firmware after adding/changing concept definitions — see AGENTS.md §6 for the exact curl.
- Don't add new lint or typecheck tooling without an explicit ADR. This project is intentionally JS-without-build.
- **The stack runs in Docker.** The control panel, Neo4j, strfry, and Redis run *inside* containers (`tapestry`, `tapestry-redis`, `nostr-search-*`) — their logs and CLIs live in the container, not on the host. Read logs / run commands via the container: `docker exec tapestry tail -n100 /var/log/brainstorm/<x>.log`, `docker exec tapestry supervisorctl status`, `docker exec tapestry-redis redis-cli …`. Host paths like `/var/log/brainstorm/...` and `/etc/brainstorm.conf` do **not** exist on the host. Same on the droplets: SSH in, then `docker exec tapestry …`. The control panel binds `:7778` in-container (nginx fronts `:80`); locally the repo is bind-mounted to `/usr/local/lib/node_modules/brainstorm` (source edits are live) with `node_modules` as a separate volume. See OPERATIONS.md for container layout and ports.

### Per-deployment TA pubkey — NEVER hardcode

The Tapestry Assistant (TA) pubkey is **created at first container startup** (`setup/create_nostr_identity.sh`) and is **different on every deployment**. The local-dev value (`82b75e47...973833` on this machine) is NOT shared with `tags.brainstorm.world`, `staging.brainstorm.world`, `brainstorm.world`, or any other instance.

A literal hardcode in shared code silently breaks the pin/TL stack (and any other surface that signs as the TA or filters events by TA author) on every non-dev deployment: the signer reads the actual on-disk TA key, but the readers filter `authors: [hardcoded]` and find nothing.

**Always resolve the TA pubkey at runtime:**

- **Server-side:** `const { getOwnerAssistantPubkey } = require('../../utils/assistantKeys')` then `const TA_PUBKEY = getOwnerAssistantPubkey()` at module init (the function caches internally). Falls back through env → `brainstorm.conf` → `SecureKeyStorage` JSON. See `src/utils/assistantKeys.js:49–82`.
- **Client-side:** `const { taPubkey } = useConfig()` (backed by `/api/assistant/pubkey`). See `ui/src/context/ConfigContext.jsx:14–18`. The rest of the codebase already does this (e.g., `ui/src/pages/concepts/ConceptList.jsx:59`, `ui/src/pages/databases/Neo4jOverview.jsx:13`).

This rule applies anywhere the TA pubkey is used as: an `authors:` filter on a strfry scan; a substring of a concept handle (`39998:<TA>:<slug>`); a `pubkey` argument to `nip19.naddrEncode`; or any identity check. If you find yourself typing `'82b75e47...'`, stop — use the runtime lookup instead.

Reference incident: the Pin/TL stack (Stories 10–12) hardcoded the literal in `ui/src/utils/publishTagPin.js` and `src/api/profile-tags/index.js`. The local instance kept working by coincidence (same TA pubkey); `tags.brainstorm.world` reported "No TL yet" forever because TLs were signed under its real TA but searched for under the hardcoded one. Fix: replace literals with the runtime helpers above. See `engineering-team/stories/_intake.md` entry dated 2026-05-20.

**Named exception (ADR 0015):** the z-tag composition for the `tag`, `nostr-user-tag`, and `tag-pinning` concept handles is intentionally bound to a literal pubkey — `LEGACY_Z_TAG_PUBKEY` in `src/api/profile-tags/index.js`, `LEGACY_TA_PUBKEY` in `ui/src/utils/publishTagPin.js`, plus the existing literal hardcodes in `ui/src/hooks/useProfileTags.js` and `ui/src/utils/publishProfileTag.js`. This preserves visibility of historical user activity (tags, applies, disputes, pins) across non-dev deployments where wholesale runtime-migration would orphan all existing events. Every OTHER use of the TA pubkey — author filtering, signer reads, signing operations — must use the runtime helper. Future re-parenting of these concepts under a non-literal pubkey is a separate epic (out of Story 16; sketched in ADR 0015's "Eventual full retirement" section). A reviewer who sees a diff removing `LEGACY_*` constants without an accompanying re-parenting migration MUST reject. See `engineering-team/decisions/0015-restore-historical-data-and-fix-tl-author-filter.md`.
