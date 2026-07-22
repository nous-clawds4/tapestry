# Discovery Brief: Second Brain (display name: "Tapestry Harness")

**Slug:** second-brain
**Date:** 2026-07-21
**Strategist phase:** Discovery (Phase 1)

## Problem statement

The Tapestry owner/operator is the terminal bottleneck on everything getting done. Work happens only when he personally notices it, chooses it, launches it, and accepts it — and the choosing is the weakest link: deciding what deserves the next unit of attention is, in his words, The Big Challenge, and today it happens ad hoc, in his head. The knowledge that would let anyone or anything else make those calls is scattered across surfaces that are opaque even to him (he does not know what several of his own repo's memory files are for), and it is written for the agents, not for the owner. Every agent session starts amnesiac; every priority decision routes through the owner; large ambitions die undirected because nothing breaks them into pieces something else could carry. The purpose is to *achieve goals* — delegation is the product; memory is the tool that makes delegation trustworthy. Proof this is solvable exists in this repo: an autonomous run has already carried a feature end-to-end with no human at the gates — but only once, hand-armed, per experiment. What is missing is the substrate that makes it routine across all the owner's goals.

## User landscape

- **The owner/operator (David — v1's only user).** Current workaround: his head, a now-frozen heartbeat checklist, and personally launching every agent session. Pain: he is the bottleneck; his system's memory surfaces are illegible to him ("if I want to learn what a concept is for, I find it with keyword search and see what it's connected to" — nothing supports that today); retrieval isn't even part of his workflow because the memory is agent-facing prose.
- **The agent sessions.** Current workaround: rereading flat markdown memory files at session start. Pain: orientation cost grows with corpus size; consolidation is lossy; no addressable nodes means two sessions cannot reliably refer to the same thing; no goal context means every session must be told what to do. (Whether agents are modeled as personas or as system behavior is an open question for User Modeling.)
- **Near-term operators (Vinney, Avi).** Will likely use it soon after v1, on their own instances. Same shape of pain, different corpora — an early forcing function for "works for any owner, not just this one."
- **Eventually: every tapestry owner.** Deferred, but structural: the design vocabulary should not bake in one person's workflow.
- **Peers (trusted-subset sharing via the grapevine).** Explicitly out of this discovery; a later product. Named because it is the bridge to the outward search mission (see Opportunity).

## Competitive landscape

Grounded by web research, 2026-07-21; corrected claims noted rather than repeated. No product found combines **(a)** owner-curated ontology with definition/instance separation, **(b)** autonomous agent goal execution, and **(c)** trust-graded peer sharing.

- **PKM tools (Obsidian, Logseq, Roam).** Now typed and agent-accessible (Obsidian Bases + official CLI + MCP servers; Logseq DB's tag classes with inheritance, beta 2026-07) — but the substrate remains prose files where structure is convention, not contract: no enforced schema an agent can rely on when writing back, no first-class separation of a concept's definition from its instances, and no sharing primitive between "publish to the web" and "private." Structural lock: built for a human reader; an agent must re-infer the owner's conventions every session.
- **Agent-memory frameworks (Mem0, Zep/Graphiti, Letta, LangMem).** Extraction pipelines with a curation escape hatch, not curated references with an extraction assistant: the graph's content is what a model induced from conversation; the owner can patch facts via API but there is no editorial layer, no class hierarchy, no owner-maintained concept definitions the extraction is subordinate to (Zep caps custom types at 10+10 flat Pydantic classes; Letta is agent-written prose with no ontology at all). None has any peer-sharing or interop primitive.
- **Vector/embedding RAG as memory.** Answers "what sounds like this?", never "what does this goal depend on?" — no explicit relationships, no explainable retrieval, no supersession. The industry's own pivot to graph-hybrid memory concedes the point: vectors are a retrieval layer, structurally incapable of being the reference store.
- **Autonomous agent loops (AutoGPT lineage, Devin, Claude Code/OpenClaw-class harnesses, ChatGPT memory).** The 2026 generation solved persistence with prose: markdown memory files the agent rewrites (Claude Code, OpenClaw), semantically-triggered guidance snippets (Devin), or opaque model-synthesized memory the owner cannot audit (ChatGPT "Dreaming"). Agency without structure — the inverse gap. The in-house incumbent (MEMORY.md + daily logs) is this category, and its failure is observable here, not speculative.
- **Near-neighbors, each holding one or two corners of the triad:** **Tana** (owner-defined supertag ontology, app-scoped AI, no external-agent API found); **Anytype** (typed objects + agent API + space-membership sharing, but all-or-nothing per space, no class hierarchy, no goal substrate); **Cognee** (owner-supplied OWL ontology *validates* extraction, but the ontology grounds extraction rather than being the authored content; no sharing); **OriginTrail DKG** (decentralized knowledge graph as multi-agent memory with peer sharing — but a token-incentivized public/consortium knowledge economy whose trust is staking and provenance, not a personal web-of-trust view, and whose content is published assets, not a private curated brain).

## Opportunity

Three insights converge:

1. **The triad's center is empty, and this team already owns all three pieces.** A curated concept graph with ontological discipline (class threads; a concept's definition held separate from its instances) exists and runs; a personal web-of-trust engine (the grapevine) exists and runs; a gated autonomous-execution harness exists and has already shipped a feature unattended (the Director precedent). Nobody else has all three; each competitor category is structurally locked to its corner.
2. **The decomposition thesis (the owner's own).** Any goal can virtually always be broken into smaller goals; weaker models simply need smaller pieces. If goal decomposition and selection live in a durable substrate rather than in a model's context window, then *given enough time, small local models can achieve what frontier models achieve* — decoupling achievement from frontier-model access and from per-token spend. The second brain is not a convenience; it is a capability multiplier and, eventually, a sovereignty play — which is exactly this project's ethos.
3. **The supply-side bridge.** The outward search mission ("anything curated by a trusted community is searchable") quietly assumes people maintain curated, trustworthy knowledge stores. Self-interest is the only motivation that scales: owners curate *their own* second brains, and the grapevine later turns private curation into the trusted lists outward search consumes. If the second brain never produces a sharable trusted subset it is a private hobby, not a Brainstorm Search axis — the bridge can be deferred in scope but not in framing. Whether ROADMAP.md gains this axis explicitly is an open question below.

Why now: agent memory is the industry's open sore (everyone shipped prose files or opaque synthesis in 2025–26), the enabling write-primitives for this graph are being built this week, and the autonomous-execution pattern is proven in-house.

## Constraints

- **Budget:** $200/month (existing Claude Max subscription) — a ceiling, not a target, for now. Long-term: the design must not assume frontier-scale models forever; local-model compatibility (smaller goal chunks, same substrate) is a stated aspiration.
- **Timeline:** none fixed. "I'd love it yesterday… gotta be done correctly though. No rush jobs." Correctness over speed; the system earns its way forward.
- **Team:** the owner plus his agent sessions. Vinney and Avi as near-term second operators; no other humans.
- **Technical:** built on Tapestry (Neo4j reference graph, nostr/strfry interchange, grapevine WoT). v1 privacy is a local-only *convention* (no outbound sync of goal data), with a true non-publishing write mode as a fast follow. Two enabling engineering efforts are in flight and are referenced, never re-specified, by this product: the relationship add/delete primitives (armed autonomous run) and firmware-reinstall protection for owner-authored data.
- **Regulatory:** none.
- **Trust boundary (operating rule, owner's words):** recoverable mistakes are acceptable; *"an embarrassing message to the world might make me rein things in."* Outward-facing actions (publishing, messaging humans) are the highest-stakes category and gate hardest; internal graph edits are the lowest.

## Open questions

1. Are agent sessions modeled as personas or as system behavior serving the owner? (User Modeling — the roundtable split on this; a ruling is required.)
2. What observable event marks a goal "accepted," and which goal categories may reach it without the owner? Tiered autonomous acceptance is ratified in principle (Director precedent); the tier boundaries per category are not. (Scope/Domain.)
3. The graph is "both ledger and snapshot, like a physical brain" (owner). The durable-intent vs append-only-record split must be modeled concretely. (Domain Modeling.)
4. A `tapestry-owner-goal` concept (3 elements) and a `project-for-the-engineering-team` concept (5 elements) already exist in the live graph, the former with a known hygiene defect. Adopt/extend/merge — and who owns the cleanup? (Domain Modeling.)
5. Prioritization is a *replaceable framing*, not a formula: the owner explicitly expects the first mechanism (possibly pairwise comparison) to be scrutinized and replaced. What governs replacing it? (Scope/Design; ties to self-improvement governance.)
6. Does ROADMAP.md get amended with the owner-as-user axis, or does this product carry its own roadmap beside it? (Owner + strategy.)
7. Does the first autonomous-execution phase run under convention-only privacy, or is it gated on the true non-publishing write mode? (Scope.)
8. How binding is local-model compatibility on v1 decisions — a design lens, or a tested requirement? (Scope.)
9. The parked task-timeline effort (a unified past/present/future activity view) overlaps the future need to observe autonomous activity. Fold, run separately, or close? (Scope, before any autonomous-execution phase.)

## Appendix — operator's proposed direction (input to later phases, not ratified here)

The owner arrived with a rich mechanism sketch, preserved for Scope/Domain/Design as *input*: goals as graph concepts with impact/effort/probability-of-solo-success parameters; recursive decomposition until pieces are session-sized; goal categories including graph maintenance and reflective "what aren't we asking?"; an executive heartbeat selecting the next goal under concurrency limits; independent review of every deliverable; self-improvement ("improve the harness") as an explicit goal; pointers-not-payloads (the graph organizes, external stores hold volume); staged search (keyword → graph crawl → external stores, in rounds). The roundtable's translations of these mechanisms into problem statements, and its amendments (decision records live in the brain; the metabolism only asks and reports), are recorded in the session plan and carry forward with this brief.
