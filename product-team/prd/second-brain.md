# Second Brain (display name: "Tapestry Harness") — Product Requirements Document

**Slug:** second-brain
**Date:** 2026-07-21
**Status:** Draft
**Companion guides:** `guides/second-brain-style-guide.md`, `guides/second-brain-design-guide.md` (+ `guides/second-brain-wireframes.html`)

> Self-contained. A reader understands the product without opening the phase artifacts.

## 1. Product Vision

The Tapestry owner is the terminal bottleneck on everything getting done: work happens only when they personally notice it, choose it, launch it, and accept it — and the choosing is the weakest link. Deciding what deserves the next unit of attention is the owner's Big Challenge, attacked today ad hoc, in their head. The knowledge that would let anything else make those calls is scattered across surfaces opaque even to the owner, written for agents rather than people; every agent session starts amnesiac.

The Second Brain makes the owner's concept graph the durable substrate for goals, knowledge pointers, and judgment — so that agent sessions orient in seconds, work gets chosen deliberately, and, in later phases, achievement continues in the owner's absence. **Delegation is the product; memory is the tool that makes delegation trustworthy.** The proof of concept already happened here once: an autonomous run carried a feature end-to-end with no human at the gates. This product makes that routine instead of ceremonial.

Positioning within the mission: the outward search vision ("anything curated by a trusted community is searchable") quietly assumes people maintain curated, trustworthy knowledge stores. Self-interest is the only motivation that scales. Owners curate their own second brains; the trust graph later turns private curation into the shared, trusted content the outward mission consumes. The bridge is deferred in scope, not in framing: if the second brain never produces a sharable trusted subset, it is a private hobby, not a strategic axis.

## 2. Positioning & Competitive Context

No product combines the three properties this one is built from (verified by research, 2026-07-21):

1. **Owner-curated ontology** with a concept's definition held separate from its instances,
2. **Autonomous agent goal execution** against that ontology,
3. **Trust-graded sharing** with peers.

Each incumbent category is structurally locked to its corner. Modern note tools (Obsidian, Logseq) grew typed properties and agent access, but their substrate remains prose files where structure is convention, not contract — nothing an agent can rely on at write-back, and no sharing between publish-everything and private. Agent-memory frameworks (Mem0, Zep, Letta) are extraction pipelines with a curation escape hatch, not curated references with an extraction assistant: the graph's content is what a model induced, with no editorial layer and no class hierarchy. Vector retrieval answers "what sounds like this?", never "what does this goal depend on?" — the industry's own pivot to graph-hybrid memory concedes it cannot be the reference. The autonomous-agent generation solved persistence with prose files the agent rewrites or opaque synthesized memory the owner cannot audit: agency without structure. Near-neighbors each hold corners — Tana (curated supertags, app-bound AI), Anytype (typed objects + agent API, membership-only sharing), Cognee (ontology-validated extraction, no sharing), OriginTrail (decentralized agent memory, but token-economy trust and published assets, not a private brain).

This team already runs all three pieces: a live concept graph with class-thread discipline, a personal web-of-trust engine, and a gated autonomous-execution harness with one unattended feature delivery on record.

## 3. User Personas

### The Delegating Owner (primary)
An instance owner with more ambitions than hands, who keeps asking "is this the most important thing I could be doing?" and knows most people never attack that question systematically. Technical in their own domains; discovers systems by keyword search plus following connections; currently the bottleneck on everything. **Wants:** goals achieved, including in their absence, with their judgment applied only where it matters. **Core loop:** capture → decompose → let the system propose → review and answer plain-English questions → extend a little more trust. **Won't tolerate:** being the bottleneck by design; capture costlier than a text file; jargon; audits split across surfaces; irreversible embarrassment (an outward message to the world is the rein-it-in line); rush jobs.

### The Fresh-Context Session (primary, machine persona — governed by the traceability guard)
An agent session that wakes with an empty context window; its patience is a token budget; its first visit is orientation. **Wants:** to orient in seconds, act inside an unambiguous scope, and leave the graph richer. **Core loop:** orient (bounded read) → receive one goal with deliverable and boundary verbatim → work through pointers → write outcomes back as durable facts → hand off so the next session is cheaper. **Won't tolerate:** orientation cost that grows with the corpus; structure that is convention rather than contract; stale pointers; unaddressable memory; definition/instance category errors; scope leakage.

> **Traceability guard (operator-ratified):** no requirement may be justified by the machine persona alone. Every requirement citing The Fresh-Context Session must also trace to a step in a Delegating Owner journey. A requirement tracing only to the machine persona is a defect in this PRD.

### The Second Operator (secondary)
An owner who did not build this system, running their own instance with their own corpus — the near-term generalization test (two named collaborators expected soon; eventually every owner). **Wants:** the same delegation loop without adopting anyone else's archaeology. **Won't tolerate:** reference-instance hardcodes; conventions living in one person's head; a cold start with no obvious first action.

## 4. User Journeys

### The Delegating Owner
1. **First capture.** Mid-thought, a goal surfaces; the owner says it in plain words; it exists in the brain — named, findable, dated — confirmed in one sentence. *Feels: unburdened.*
2. **Decomposition, together.** A big goal becomes a tree of session-sized pieces, each with a deliverable and a boundary, in the owner's own sharpened language. *Feels: clarified.*
3. **The first proposal.** The system nominates one piece with why-now and the runners-up it beat; the owner approves, or skips with a one-line reason that visibly teaches the system. *Feels: in command.*
4. **Morning review.** One surface, read downward: significant progress on some goals, still working on others, one or two questions in plain English. Everything done, decided, or skipped is attached to the goal it served. *Feels: oriented, not anxious.*
5. **Retrieval in anger.** Six weeks later: keyword search, then look at what it's connected to; the pointer surfaces with what it is, why it's kept, and when last verified. *Feels: vindicated.*
6. **Trust graduation.** A category accumulates a track record; the owner loosens its tier — an explicit, revocable act. The system makes strides in their absence and the morning review proves it. *Feels: leveraged.*

### The Fresh-Context Session
1. **Orientation** within a fixed, corpus-independent budget: what exists, what matters, where its goal sits. 2. **Goal receipt:** deliverable and boundary verbatim as fixed at claim time. 3. **Working through pointers:** crawl to linked resources, dereference each in its native store; content never migrates into the brain. 4. **Write-back:** durable, attributable, append-shaped facts on the goal; new ideas are proposed, never launched, from inside a session. 5. **Hand-off:** where things stand against the deliverable, at most a question or two; the next session's orientation is cheaper because this one ran.

### The Second Operator
Cold start on an empty brain that still offers one obvious action (say a goal in plain words), with the system's own concepts discoverable by search-plus-connections; from the first capture on, their journey is the Delegating Owner's.

## 5. Feature Specification

Capabilities, not screens (screens are §5.8, from the design guide). Every capability carries its trace.

### 5.1 Goal capture
- **Purpose:** get a goal out of the owner's head at below text-file cost. *(Owner journey 1.)*
- **Behavior:** the owner states a goal in plain language, in conversation; the brain records it with name, statement, origin, and date; confirmation is one plain sentence. No form, no required fields beyond the words themselves.
- **Owner actions:** capture; rename; abandon (recorded as a dated fact, not a deletion).

### 5.2 Decomposition
- **Purpose:** turn ambitions into session-sized pieces something else can carry. *(Owner journey 2; session journey 2.)*
- **Behavior:** in conversation, a goal acquires child goals, each viable only when it has a stated deliverable (what "done" produces) and boundary (what pursuing it may not touch). One parent per goal in v1. A goal with children is never itself proposed.

### 5.3 Resource pointers
- **Purpose:** the brain organizes knowledge; it never contains it. *(Owner journey 5; session journey 3.)*
- **Behavior:** a goal points at external resources — file, vault note, nostr event, repository, web address — each with title, locator, optional why-kept and keywords, and a last-verified date. Freshness standing (current / stale / unreachable) is derived from verification age, worded per the style guide. Content stays in its native home.

### 5.4 Session orientation and the read loop
- **Purpose:** end session amnesia. *(Session journey 1/4; owner journey 4 — this is what makes many small sessions affordable.)*
- **Behavior:** every agent session begins by orienting from the brain within a bounded, corpus-independent budget; every session's output references the goal it served; work performed is recorded as an append-only work record (session, goal served, resources produced, one-sentence standing, at most two plain-English questions).

### 5.5 Proposals and decisions
- **Purpose:** move "what next?" out of the owner's head into an auditable, teachable loop. *(Owner journey 3; the calibration corpus for every later autonomy phase.)*
- **Behavior:** the system periodically nominates exactly one viable goal, with a why-now legible in ten seconds and the named runners-up it passed over, each with a one-line why-not. The owner approves (and launches the session themselves, in v1) or skips; a skip requires a one-line reason. Decisions and reasons are recorded as dated facts. Open proposals are decided or remain open; nothing is decided silently.

### 5.6 Priority signals
- **Purpose:** capture the owner's relative-value judgment in a replaceable framing. *(Owner journeys 3/6; the operator's own epistemology: 99 wrong framings, find the right one by iterating.)*
- **Behavior:** the owner records pairwise choices ("solve one today: which?") with an optional one-line reason; each signal is dated, attributed, and tagged with the framing that produced it, so a replaced framing's history stays interpretable. Signals are **recorded, never acted on autonomously, in v1** — proposals may cite them as rationale; nothing launches from them.

### 5.7 Safeguards: export and hygiene
- **Purpose:** the brain must be trustworthy before it is trusted. *(Owner persona: no rush jobs; the known reinstall-clobber hazard.)*
- **Behavior:** the owner can export the brain's owner-authored content and has performed one verified restore drill; a hygiene check validates the goal structures against the graph's own class discipline (the two known live defects — stray membership edges on both work-item concepts — are cleaned, and the check would catch their recurrence).

### 5.8 Screens (v1 — from the design guide, which is binding)
Three owner-gated views inside the existing control panel, inheriting the app's identity with no new tokens: the **Goals view** (tree, category filter, cold-start empty state as onboarding), the **Goal detail** (intent + pointers + the goal's full append-only record on one spine), and the **Proposal queue** (emphasis cards with "considered instead" and equal-weight Approve / Skip-with-reason). Empty, loading, and error states are designed; the do-not-design list (no graph canvas, no gauges, no agent chat, no privacy toggle, nothing visitor-facing) is review-enforceable.

### 5.9 Second-operator guard
- **Purpose:** nothing ships that structurally excludes another owner's instance. *(Second Operator journey.)*
- **Behavior:** no reference-instance identities or paths are baked in; every category and convention the product introduces is discoverable in-graph by search-plus-connections; the empty brain offers one obvious first action.

## 6. Data Model

Six entities on one spine — the operator's ruling, verbatim: the brain is *both ledger and snapshot, like a physical brain*. **Durable intent** (edited rarely, deliberately) and **append-only record** (dated facts, never rewritten); current standing is always derived from reading both, never stored as a flag that overwrites history.

- **Goal** *(durable intent; adopts and extends the existing `39998:<TA>:tapestry-owner-goal` concept)* — name, statement, deliverable and boundary (required for viable leaves), one optional parent, optional category, origin, captured-on.
- **External Resource** *(durable intent; new concept on the graph's established pointer-element pattern)* — title, locator-kind (file / vault note / nostr event / repository / web address), locator, why-kept, keywords, noted-on, last-verified.
- **Priority Signal** *(append-only; new)* — prefers goal / over goal, reason, judged-by, judged-on, framing tag.
- **Proposal** *(append-only; new)* — nominates goal, why-now, passed-over goals with why-nots, made-on; decision (open → approved | skipped), decision-reason (required on skip), decided-on.
- **Work Record** *(append-only; new)* — session, goal served, resources produced, one-sentence summary, up to two questions, happened-on.
- **Category** *(durable intent; existing set machinery, new instances only)* — name, purpose (discoverable in-graph). One flat list in v1.

Relationships: Goal *decomposes into* Goal (a tree in v1); Goal *points at* External Resource; Proposal *nominates / passed over* Goal; Priority Signal *prefers…over* Goals; Work Record *serves* Goal and *produced* External Resources; Category *collects* Goal; Goal *is realized by* Engineering Project (the existing `39998:<TA>:project-for-the-engineering-team` concept — related in v1; merge decision scheduled to Phase 2).

Lifecycles: Goal standing (captured → decomposed | viable → achieved | abandoned) is **derived** from dated facts; resource freshness (current → stale → unreachable) is derived from verification age; proposals go open → approved | skipped (auto-expiry arrives in Phase 2).

## 7. Policy Constitution

The rules that govern behavior and who may change it. These outrank every capability above.

1. **The brain decides; the metabolism asks and reports.** Any external scheduler or heartbeat may only ask "what next?" (reporting its capacity), execute what the brain answers, and report every action back into the brain, attached to the goal it served. Selection judgment, policy values, and the record of intent, decision, and outcome live in the brain. A scheduler-side decision log is a defect.
2. **Append-only record.** Recorded facts (signals, proposals, decisions, work) are never edited or deleted. Corrections are new facts.
3. **Sessions propose, never launch.** A goal idea born inside a session enters as a proposal-shaped capture; nothing spawns work but the owner (v1) or the explicitly governed launcher (Phase 3+).
4. **Privacy is a stated posture, honestly presented.** V1: the brain stays on the owner's machine by convention — no outbound sync of goal data; the UI states this as an indicator, never a toggle. A mechanism-enforced non-publishing mode is Phase 2. The autonomy pilot may run under the convention (operator-ruled).
5. **Autonomy is earned by category, granted by the owner.** Acceptance tiers per category loosen only by the owner's explicit, revocable act, informed by recorded track record. Entry into any autonomous launching is metric-gated (§10). Outward-facing actions (publishing, messaging people) sit in the highest tier indefinitely.
6. **Policy changes are the owner's alone.** No accepted deliverable — including an "improve the harness" deliverable — may alter selection policy, tiers, caps, or this constitution without a separate, explicit owner act. Self-improvement work produces proposals; applying them is the owner's move. The prioritization framing (§5.6) is a replaceable slot: replacements are proposed with evidence and ratified by the owner.
7. **Plain language is a contract.** Everything addressed to the owner — proposals, questions, confirmations, errors — obeys the style guide's register. Jargon in owner-facing output is a review-blocking defect.
8. **Existing structures are adopted, never re-derived.** Goal and Category ride existing graph machinery (`tapestry-owner-goal`, native sets); new concepts follow the graph's established pointer pattern; the per-deployment assistant identity is always resolved at runtime, never hardcoded.
9. **In-flight engineering is referenced, never re-specified.** Two engineering efforts proceed outside this product and are load-bearing dependencies: the relationship add/delete primitives (an armed autonomous run) and firmware-reinstall protection for owner-authored data. No story from this PRD re-implements or re-specifies them; stories that need them declare the dependency and wait.

## 8. Scope Boundaries

### 8.1 In Scope (must ship)
Goal capture · decomposition · resource pointers · bounded session orientation + read loop · propose-only cadence with approve/skip-with-reason · priority signals (recorded only) · export/backup + one restore drill · hygiene validation · the three v1 views · second-operator guard.

### 8.2 Stretch
None. The MVP is deliberately without a stretch list; anything beyond In Scope waits for its named phase.

### 8.3 Out of Scope (deferred, each to a named phase)
Lifecycle/acceptance states, review gates, tiers, batch ratification, proposal expiry, queue-age metric, brain-side launch answer, claim/lease, scheduler write-back contract, private write mode, engineering-project merge decision → **Phase 2**. Autonomous launch, charter, kill switch, morning-review digest, observability (inherited from the separate task-timeline engineering book, operator-armed before Phase-3 planning) → **Phase 3**. Brain keyword index, staged search rounds → **Phase 4**. Self-improvement wiring → **Phase 5**. Local-model validation, semantic recall → **Phase 6**. Trust-graded sharing → **Phase 7**. Peers as users, embedded viewers, health/monitoring surfaces, graph canvases → unscheduled; re-enter through discovery or not at all.

## 9. Phase Roadmap

**MVP "Capture, Decompose, Propose"** → **P2 "Goal Engine & Review"** → **P3 "Gated Autonomy Pilot"** (entry metric-gated; non-repo categories; concurrency 1) → **P4 "Search Depth"** → **P5 "Self-Improvement Wiring"** → **P6 "Model Capabilities"** → **P7 "Sharing"**. Local-model compatibility is a binding *design lens* from v1 (bounded orientation, small pieces, no frontier-context assumptions) and a tested requirement only at P6 (operator-ruled).

## 10. Success Metrics

**MVP, within 6 weeks of shipping (all countable by inspection):** ≥20 goals each with ≥1 pointer authored across ≥10 distinct days · ≥5 session outputs referencing their goal · ≥15 proposals with logged decisions (skips carry reasons) · the frozen legacy checklist gains zero rows · 1 journaled export/restore drill · ≥3 journaled retrievals-in-anger via search+connections · hygiene check green.
**P2 (gate to P3 planning):** 100% of active goals show dated transitions · proposal→launch agreement ≥50% over ≥15 decisions · median open-proposal age flat or falling over 4 weeks.
**P3 (pilot verdict):** ≥5 autonomous sessions each independently reviewed · ≥1 rejection observed (a 100% acceptance rate reads as review-decoration and scores as failure) · zero ceiling breaches.

## 11. Open Questions

1. **Acceptance-tier boundaries (P2).** Which goal categories may reach "accepted" on independent review alone? Options: an operator-authored per-category table; earned automatic graduation on track-record thresholds; a hybrid (table with earned defaults proposed by the system, ratified by the owner).
2. **Who authors priority signals beyond the owner (P2+).** Options: owner-only indefinitely; sessions may *propose* signals the owner ratifies; sessions author signals in low-stakes categories once tiers exist.
3. **Engineering-project merge (P2).** Merge `project-for-the-engineering-team` elements into goals under an engineering category, or keep the relation permanent. Options as stated; decide when the acceptance model lands.
4. **Morning-digest channel (P3).** In-panel view, conversational delivery, or both. The unit-of-review spec (owner journey 4) is fixed; the channel is not.
5. **Framing-replacement mechanics (P5, sketch at P2).** How a candidate prioritization framing is trialed against the incumbent — parallel recording, A/B proposal batches, or evidence review — before the owner ratifies a swap.
