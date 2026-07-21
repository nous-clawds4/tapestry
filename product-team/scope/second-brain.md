# Scope: Second Brain (display name: "Tapestry Harness")

**Slug:** second-brain
**Date:** 2026-07-21
**Manager phase:** Scope & Prioritization (Phase 3)

## Features extracted

Every feature implied by the three journeys, flat:

- Plain-language goal capture (owner speaks; brain records; one-sentence confirmation)
- Goal decomposition into session-sized pieces, each with a stated deliverable and boundary
- Pointers from goals to external resources (files, vault notes, nostr events, repos, URLs) with identity and freshness
- Bounded orientation surface for sessions (corpus-independent cost)
- Session-read loop (every session orients from the goal graph; outputs reference the goal served)
- Recurring "what next?" proposal with comparative rationale (this one over the runners-up)
- Skip-with-reason (the owner's decision log — the calibration instrument)
- Priority signals as dated, attributed pairwise/ordinal choices
- Goal lifecycle states and an observable "accepted" event
- Independent review of deliverables; acceptance tiers per goal category; batch ratification
- Proposal auto-expiry; ratification-queue age visibility
- Brain-side launch/no-launch answer given reported capacity
- Claim/lease semantics (which session holds which goal)
- Write-back of every scheduler decision into the brain (asks and reports; never chooses)
- Autonomous session launch under concurrency limits, category whitelist, armed charter, kill switch
- Activity observability (what ran, is running, will run)
- Morning-review digest (one surface; plain-English questions)
- Retrieval via keyword search + connections
- Keyword index over the brain's contents; staged search rounds (keyword → crawl → external stores)
- Owner-data export/backup and restore
- Goal-structure hygiene validation (the live category-error defect gets cleaned)
- Non-publishing (private) write mode
- No reference-instance hardcodes; conventions discoverable in-graph; empty-graph first action
- Self-improvement goal category routed through governed proposal-only path
- Local-model compatibility; semantic recall
- Grapevine sharing of trusted subsets

## MVP boundary

**Theme: "Capture, Decompose, Propose."** The full delegation loop *minus autonomous launch*: the owner captures and decomposes goals, sessions orient from them, and the system proposes the next piece — the owner launches. Delegation-first per the operator's ruling: the proposer ships in v1; the launcher earns its way in.

### In scope (must ship)

- [ ] Plain-language goal capture — cheaper than a text file, confirmed in one sentence
- [ ] Decomposition into session-sized pieces, each with deliverable + boundary
- [ ] Pointers to external resources with identity + freshness (content stays external)
- [ ] Bounded session orientation + the session-read loop (outputs reference the goal served)
- [ ] Propose-only cadence: comparative "what next?" proposals; approve / skip-with-reason logged
- [ ] Priority signals recorded as dated pairwise/ordinal choices — **recorded, never acted on autonomously**
- [ ] Owner-data export/backup + one journaled restore drill (clobber protection until the installer fix lands as its own engineering work)
- [ ] Goal-structure hygiene validation (zero category-error edges in the goal extension)
- [ ] Minimal read view of goals on the existing owner surface (a view, not an app)
- [ ] Second-Operator guard: no reference-instance hardcodes; conventions discoverable in-graph

### Out of scope (deferred)

- Goal lifecycle/acceptance states + independent review gates → Phase 2
- Acceptance tiers, batch ratification, proposal auto-expiry, queue-age metric → Phase 2
- Brain-side launch/no-launch answer; claim/lease semantics; scheduler write-back contract → Phase 2
- Non-publishing (private) write mode → Phase 2 *(operator-ruled: the pilot does not gate on it)*
- Autonomous launch (concurrency 1, category whitelist, armed charter, kill switch, metric-gated entry) → Phase 3
- Activity observability surface → Phase 3, **inherited from the separate task-timeline engineering book** (operator-ruled: armed and run before Phase-3 planning begins; not part of this product's surface)
- Morning-review digest as a designed surface → Phase 3 (v1's review is the proposal log + read view)
- Keyword index over the brain; staged search rounds → Phase 4
- Self-improvement category via the governed proposal-only path → Phase 5
- Local-model validation; semantic recall → Phase 6 *(operator-ruled: local-model compatibility is a v1 design lens — bounded orientation, small chunks, no frontier-context assumptions — but not a tested v1 requirement)*
- Grapevine sharing of trusted subsets (the search-mission bridge) → Phase 7
- Peers as users, embedded content viewers, health/monitoring surfaces, graph-visualization canvases → not scheduled; re-propose through discovery if ever wanted

## Phase roadmap

- **MVP — "Capture, Decompose, Propose":** the delegation loop minus launch; doubles as a diary study and the score-calibration instrument.
- **Phase 2 — "Goal Engine & Review":** lifecycle + observable acceptance, review gates, acceptance tiers, ratification mitigations, brain-side selection answer, scheduler write-back contract, private mode.
- **Phase 3 — "Gated Autonomy Pilot":** autonomous launch at concurrency 1 on non-repo categories (graph maintenance, vault map-of-content building), armed charter, kill switch; entry is metric-gated (see below); observability inherited from the task-timeline book.
- **Phase 4 — "Search Depth":** keyword index over the brain; keyword → crawl → external-store rounds.
- **Phase 5 — "Self-Improvement Wiring":** the improve-the-harness category routed through the governed, proposal-only path.
- **Phase 6 — "Model Capabilities":** local-model validation of the decomposition thesis; semantic recall.
- **Phase 7 — "Sharing":** grapevine-graded trusted subsets — the supply-side bridge to the outward search mission.

## Success metrics

All observable by inspection of the graph, the proposal log, and git — no new instrumentation.

**MVP (within 6 weeks of shipping):**
- ≥ 20 goals in the brain, each with ≥ 1 external pointer, authored across ≥ 10 distinct days (sustained use, not a seeding spree)
- ≥ 5 agent-session outputs that reference the goal they served
- ≥ 15 proposals with a logged approve or skip-with-reason decision
- The frozen legacy surface (the heartbeat checklist) gains zero new rows
- 1 export + restore drill performed and journaled
- ≥ 3 journaled retrievals-in-anger that succeeded via search + connections
- Hygiene check passes: zero category-error edges in the goal extension

**Phase 2 (before Phase 3 may be planned):**
- 100% of active goals show timestamped lifecycle transitions
- Proposal→launch agreement ≥ 50% over ≥ 15 logged decisions (the Phase-3 entry gate)
- Median open-proposal age flat or falling over 4 consecutive weeks

**Phase 3 (pilot verdict):**
- ≥ 5 autonomous sessions, each with an independent review verdict recorded
- ≥ 1 rejection observed — a 100% acceptance rate means review-as-decoration and reads as **failure**, not success
- Zero ceiling breaches

## Tradeoffs

- **We gain a trusted launcher by cutting the launcher.** Autonomy waits for a calibration corpus (the ≥15-decision log) instead of shipping on vibes — the emotional center of the idea arrives in Phase 3, but arrives earned.
- **We gain shipping speed by accepting convention-only privacy through the pilot** (operator-ruled); mechanism-enforced privacy is Phase 2's job.
- **We gain product focus by keeping observability in the task-timeline engineering book** rather than growing this product's surface — at the cost of a cross-book dependency the operator must arm.
- **We gain honest success criteria by making the diary study the bar**: usage across days and retrievals-in-anger, not demo counts.
- **We accept developer-grade ergonomics in v1** (a read view, not an app; capture through conversation) because the only v1 user is the primary persona — provided capture stays cheaper than a text file, which remains the product's load-bearing bet.
