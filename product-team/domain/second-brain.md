# Domain Model: Second Brain (display name: "Tapestry Harness")

**Slug:** second-brain
**Date:** 2026-07-21
**Modeler phase:** Domain Modeling (Phase 4)

> Conceptual model only — what the product knows about, not how it stores it. No tables, columns, foreign keys, or indexes.

**The model's spine (operator-ruled, 2026-07-21):** the brain is *both ledger and snapshot, like a physical brain*. Two kinds of knowledge coexist: **durable intent** (goals, kept resources — edited rarely, deliberately) and **append-only record** (judgments, proposals, work — dated facts that are added, never rewritten). *Current standing is always derived by reading both*, never stored as a mutable flag that overwrites history. Every entity below declares which kind it is.

Orientation performed against the live concept graph before modeling (summaries + one-hop reads of both existing work-item concepts), per the house rule.

## Entities

### Goal
- **Description:** something the owner wants achieved — large or small, decomposable until pieces are session-sized.
- **Kind:** durable intent.
- **Concept mapping:** existing — `39998:<TA>:tapestry-owner-goal` ("goals of the owner / operator of this tapestry instance"), **adopted and extended**, not re-derived. Its extension currently holds a handful of real elements plus known hygiene defects (see Notes).
- **Attributes:**
  | Attribute | Type | Required | Notes |
  |---|---|---|---|
  | name | text | yes | short, human |
  | statement | text | yes | the goal in the owner's words |
  | deliverable | text | viable leaves only | what "done" produces |
  | boundary | text | viable leaves only | what pursuing it may not touch |
  | parent | ref:Goal | no | decomposition position (one parent in v1 — a tree) |
  | category | ref:Category | no | one flat list in v1 |
  | origin | text | yes | who captured it: the owner, or a session's proposal |
  | captured-on | date | yes | |

### External Resource
- **Description:** a pointer to knowledge that lives outside the brain — the brain organizes it, never contains it.
- **Kind:** durable intent (its *freshness* is derived from dated verifications).
- **Concept mapping:** **new** concept; follows the established pointer-element pattern the graph already uses for event references.
- **Attributes:**
  | Attribute | Type | Required | Notes |
  |---|---|---|---|
  | title | text | yes | what a human calls it |
  | locator-kind | text | yes | one of: file path, vault note, nostr event, repository, web address |
  | locator | text/URL | yes | the pointer itself |
  | why-kept | text | no | the owner's "why this is in my brain" |
  | keywords | text list | no | the retrieval surface |
  | noted-on | date | yes | |
  | last-verified | date | no | freshness anchor |

### Priority Signal
- **Description:** one dated judgment of relative value between goals — v1's first framing is the pairwise choice ("if you could do one today, which?"), and the framing itself is expected to be replaced as better ones are found.
- **Kind:** append-only record. Signals accumulate; none is ever edited.
- **Concept mapping:** **new**.
- **Attributes:**
  | Attribute | Type | Required | Notes |
  |---|---|---|---|
  | prefers | ref:Goal | yes | |
  | over | ref:Goal | yes | |
  | reason | text | no | one line |
  | judged-by | text | yes | the owner, in v1 |
  | judged-on | date | yes | |
  | framing | text | yes | names the method that produced it (pairwise, in v1) — so a replaced framing's signals stay interpretable |

### Proposal
- **Description:** the system's candidate for "what next" — one goal nominated with its why-now, shown against the runners-up it beat; the owner's decision completes it.
- **Kind:** append-only record. The accumulated proposals + decisions are the calibration corpus the autonomy phases are gated on.
- **Concept mapping:** **new**.
- **Attributes:**
  | Attribute | Type | Required | Notes |
  |---|---|---|---|
  | nominates | ref:Goal | yes | |
  | why-now | text | yes | comparative, legible in ten seconds |
  | passed-over | refs:Goal | yes | the runners-up, each with a one-line why-not |
  | made-on | date | yes | |
  | decision | text | derived-open | open → approved \| skipped (expiry arrives in Phase 2) |
  | decision-reason | text | skips: yes | the teaching signal |
  | decided-on | date | no | |

### Work Record
- **Description:** the fact that work happened — which session served which goal, what it produced, where it left things.
- **Kind:** append-only record. Recording work never rewrites the goal it served.
- **Concept mapping:** **new**.
- **Attributes:**
  | Attribute | Type | Required | Notes |
  |---|---|---|---|
  | session | text | yes | which session (human-launched in v1) |
  | served | ref:Goal | yes | |
  | produced | refs:External Resource | no | deliverables are pointers, not payloads |
  | summary | text | yes | where things stand against the deliverable |
  | questions | text list | no | at most a couple, plain English |
  | happened-on | date | yes | |

### Category
- **Description:** a named collection grouping goals by the kind of attention they need (one flat list in v1).
- **Kind:** durable intent.
- **Concept mapping:** existing mechanism — the graph's native set machinery under the goal concept; new *instances*, no new machinery.
- **Attributes:** name (text, required); purpose (text, required — discoverable in-graph, per the Second Operator guard).

## Relationships

Named and directional:

- Goal **decomposes into** Goal (parent → children; a tree in v1 — richer structures are a named deferral)
- Goal **points at** External Resource
- Proposal **nominates** Goal; Proposal **passed over** Goal
- Priority Signal **prefers** Goal **over** Goal
- Work Record **serves** Goal; Work Record **produced** External Resource
- Category **collects** Goal
- Goal **is realized by** Engineering Project (see open-question resolution below)

## States and lifecycle

- **Goal:** captured → *(decomposed | viable)* → achieved | abandoned. In v1 these standings are **derived** from dated facts (a goal is "viable" because it has a deliverable and boundary and no children; "achieved" because a dated owner note or work record says so) — never a mutable status flag that overwrites history. The machine-enforced lifecycle with an observable *accepted* event, claims/leases, and review verdicts is **Phase 2** and is named, not modeled, here.
- **External Resource:** live → stale → dead — derived from `last-verified` age, not stored.
- **Proposal:** open → approved | skipped. (Auto-expiry: Phase 2.)

## New vs. existing (Tapestry products)

- **Maps to existing concepts:** Goal (`39998:<TA>:tapestry-owner-goal`, adopted + extended); Category (native set machinery, new instances only); Engineering Project (`39998:<TA>:project-for-the-engineering-team`, related — see below).
- **Genuinely new:** External Resource, Priority Signal, Proposal, Work Record.
- **Named, deferred, not modeled:** Claim/Lease, Review Verdict, Acceptance Tier, Launch Answer, Charter (Phases 2–3); Search Index (Phase 4); Improvement Proposal (Phase 5); Shared Subset (Phase 7).

### Open question #4, resolved (proposed): relate, don't merge — yet

`project-for-the-engineering-team` (5 elements) and `tapestry-owner-goal` are two work-item nouns in one graph. **V1 relates them**: an engineering project is one way a goal gets *realized* — "Goal **is realized by** Engineering Project" — so goals can point at engineering work without migrating anything. **Whether to merge** (engineering projects become goals in a "build software" category) is a real decision with migration consequences; it is assigned to **Phase 2** alongside the lifecycle work, where the acceptance model will make the right answer obvious. Two nouns tolerated for one phase, on purpose, with the reconciliation scheduled — not a graveyard.

## Notes for later phases

- **Hygiene (v1, already in scope):** the stray membership edge from the concept header to `concept-header-superset` was verified live today on **both** work-item concepts — it is systemic, not goal-specific. The goal concept's element wiring also looks irregular (elements appear to hang off the header rather than the superset). The v1 hygiene-validation item covers cleaning both and asserting the class-thread invariant on the goal extension.
- **Assessment shape:** the operator's original impact/effort/probability triple is *not* modeled as bare attributes on Goal — relative-value judgments live in Priority Signal as dated, attributed, framing-tagged facts (roundtable amendment; keeps the calibration study possible and the framing replaceable).
- **Attribution:** every append-only fact carries who and when. Multi-author futures (sessions proposing, second operators) are already accommodated by `origin` / `judged-by` / `session` — no redesign needed when they arrive.
