# ADR 0001: Operational direction — goal-derived run terms, mechanically anchored

**Status:** Proposed
**Date:** 2026-07-25
**Story:** `engineering-team/stories/operational-direction/1-operational-direction-mode.md`
**Amended by:** ADR 0002 (d5's optional verdict → fail-closed `boundary-unjudged`; d6's response contract corrected; d4's staleness fail-open on unknowable timestamps)

## Context

The story asks for a second Director on-ramp whose terms are *derived from the goal being pursued* rather than authored per run, with five acceptance criteria:

- **AC1** — exactly two named on-ramps; no armed-mode rule removed, weakened, or made conditional; OPEN.md row 41 dispositioned.
- **AC2** — terms transcribed from statement/deliverable/boundary; estimate transcribed when present, **recorded as absent** when not; surrendered (baseline, pinned versions) and unavailable (estimate, `dependsOn`) terms stated in the artifacts.
- **AC3** — run starts only on a resolved **owner-ratified anchor**; otherwise refuses and reports what it walked. Anchor distance is a **policy parameter, v1 = zero**, expressed as an ancestry walk so loosening is a policy act, not a redesign.
- **AC4** — child boundary narrows or restates the parent's; a widening step refuses and names itself. Exercised over a multi-goal chain at distance > 0.
- **AC5** — ceiling, six stopping rules, blinded judges + journaled verdicts, owner-only ratification, append-only journal all in force **by reference to the same governing text**, not a second copy.

### Concepts (Concept Graph orientation done before source reading)

`<TA>` is runtime-resolved, never hardcoded (CLAUDE.md § "Per-deployment TA pubkey"). Orientation via `/api/concept-graph/summaries` from inside the container:

- `39998:<TA>:tapestry-owner-goal` — 30 elements, 1 property. Record shape per `src/lib/brain/goals.js:39-51`: `{uuid, name, slug, statement, origin, capturedOn, createdAt, deliverable, boundary, parent}`. **`statement` IS the concept's `description` field** (second-brain ADR 0001 d2 — adopted, not duplicated). `parent` is the parent goal's *slug*, instance-portable (ADR 0003 d2).
- `39998:<TA>:tapestry-proposal` — 1 element, 1 property. Record shape per `src/lib/brain/proposals.js:54-67`. The json section key is **`proposal`** (not `tapestryProposal`). A decision is `{type:'approved'|'skipped', goal, proposalId, summary, happenedOn}`.

### Facts that decide this design

1. **The ancestry walk already exists.** `resolveDecomposition(records)` (`src/lib/brain/goals.js:143-204`) annotates every record with `parentUuid`, `hasChildren`, `slugShadowed`, `parentUnresolved`, and **already breaks cycles** with three-state coloring. The anchor walk is a traversal of this, not new graph machinery.

2. **Goals re-sign; proposal facts never do.** `updateGoalIntent` (`src/api/normalize/index.js:2315-2358`) mutates `deliverable`/`boundary`/`parent` in place and ends at `regenerateJson(target.uuid, …)` (`:2356`), which **re-signs with a fresh `created_at`** — the code says so itself at `:2343-2345`. Meanwhile second-brain ADR 0006 d3 guarantees, structurally, that *"Nothing on the proposal path ever `regenerateJson`s or re-signs"* — every proposal write mints a fresh element under a nonce d-tag, and a decision never mutates the nomination. Both `parseGoalRow` and `parseProposalRow` already surface `createdAt`.

   **This asymmetry is the staleness detector, free of charge.** No new field is needed to know whether a goal was rewritten after it was ratified.

3. **Boundaries are prose.** A boundary is a sentence — *"Deciding the contents only. Nothing is built in this piece."* No code can decide whether one such sentence narrows another. AC4's check is irreducibly semantic.

4. **At v1 the boundary check is vacuous.** Anchor distance 0 ⟹ the chain is the goal alone ⟹ zero parent→child steps. The mechanism must nonetheless exist and be wired, or raising the parameter later is the redesign the story forbids.

5. **`chanceOfSuccess` is dropped at parse.** `parseGoalRow` does not carry it (`goals.js:39-51`), though 5 of 30 live goals set it. `dependsOn` exists on no goal and nowhere in the codebase.

6. **Hard budget: CLAUDE.md is at 190/190 lines** (`scripts/harness-budgets.txt`, lint check L11 — *"Exact caps, no headroom: any change that adds lines must free lines in the same file"*). The doctrine sentence naming the sole exception is a **single line**, `CLAUDE.md:148`. Any amendment must be a line-neutral rewrite.

7. **The brain module's import surface is pinned in eight test files** — `attach-the-world`, `break-a-goal-into-pieces`, `capture-a-goal-and-see-it`, `sessions-read-the-brain`, `structures-the-brain-can-trust`, `teach-it-what-matters`, `the-brain-survives`, `the-proposal-loop`. Any new `require` in `src/api/brain/index.js` trips all eight.

8. **Brain reads are gated `isOwner(req) || req.localTrusted → 403`** and must be called **from inside the container** — host-side `:7778` carries a proxy header, so `localTrusted` is false and brain endpoints answer 403 (the platform template; route-level `requireOwner` would 401 the loopback agent).

### The tension this ADR must resolve

The story's brief named three files — `roles/director.md`, `.claude/skills/direct-feature/SKILL.md`, and the book template. But AC3 and AC4 demand that a run **refuse to start** and **report which goals it walked**. That is behavior, not prose, and the story's own framing is that *"getting it subtly wrong weakens safety in ways that are hard to see."* The acceptance criteria were deliberately written behaviorally to leave this call here.

## Options considered

### Option A — Prose only: the rules live in `director.md`, the Director obeys them

Add an `## Operational direction` section to the role file describing the anchor walk, the staleness rule, and the boundary invariant as procedure. The Director runs the queries by hand and refuses per the prose.

**Pros.** Stays exactly inside the brief's three files. Zero code surface, zero test surface, ships in one sitting. Consistent with how every other Director rule is expressed today (the rubrics, the stopping rules, the ceiling are all prose the Director follows).

**Cons.** The safety precondition of an autonomous run would be enforced by an agent reading prose about itself — and an agent that has watched work accumulate is exactly the party the blinded-judge protocol exists because we don't trust. Nothing is testable: AC3's "refuses and reports what it walked" and AC4's "refuses and names the widening step" reduce to "the doc says it should." There is no artifact a Gate-3 test can fail against. This is the story's named failure mode, chosen deliberately.

### Option B — Pure core + read-only endpoint; the docs reference it *(chosen)*

A dependency-free core `src/lib/brain/direction.js` (the ninth in the `goals.js`/`proposals.js` family) computes anchor resolution, staleness, and the boundary-step list. One read-only endpoint `GET /api/brain/direction/:slug` exposes it. `director.md` and the skill **point at the endpoint** rather than restating the rules.

**Pros.** AC3/AC4 become mechanically testable — refusal codes are values a Node test asserts on. The policy parameter is a real config value, not a sentence. The anchor walk reuses `resolveDecomposition`'s already-cycle-safe traversal. Follows the established precedent exactly: eight pure cores with thin read wrappers, all dependency-free, all unit-tested without a stack. AC5's "by reference, not by copy" falls out — the docs cite one endpoint instead of duplicating rules that could drift from armed mode's.

**Cons.** Exceeds the brief's three-file list; adds a module, an endpoint, and a positive re-pin across eight test files. The boundary verdict still cannot be pure code (addressed in d5).

### Option C — Write-side enforcement: an arming endpoint that mints an "operational run" fact

`POST /api/normalize/arm-operational-run` validates the anchor and mints a run element, which the Director then reads. Arming becomes a recorded, append-only fact.

**Pros.** The strongest audit trail — every operational run is a durable fact in the graph, queryable later, matching the append-only discipline of the proposal loop.

**Cons.** Introduces a new concept (a run record) with a schema, a self-bootstrap `ensureRunConcept`, and a firmware/`save-schema` story — a substantial surface the story does not ask for and whose out-of-scope list explicitly excludes concept changes. It also mints state *before* the work, so an abandoned arming leaves a dangling fact needing lifecycle rules. Premature: the journal already provides the run's audit trail, and nothing yet needs to query runs across books.

## Decision

We chose **Option B**. Sub-decisions, each binding:

**d1 — Pure core + one read-only endpoint; docs reference, never restate.**
New `src/lib/brain/direction.js` — dependency-free CommonJS, zero `require()` calls, the `goals.js`/`proposals.js` precedent. New `GET /api/brain/direction/:slug` in `src/api/brain/index.js`, registered in `registerBrainRoutes`, gated with the platform template `isOwner(req) || req.localTrusted → 403`. **This is the scope decision the story left open, and it exceeds the brief's three-file list — deliberately, and stated here rather than absorbed silently.** The three doc files still change (d7); they gain pointers, not duplicated logic.

**d2 — Anchor resolution walks the existing decomposition.**
`resolveAnchor({goals, proposals, goalSlug, maxAnchorDistance})` → `{eligible, anchor, chain, refusal, detail}`. It calls `resolveDecomposition` on the goal records (inherited cycle-breaking, `parentUuid` chain), then walks from the target goal upward at most `maxAnchorDistance` steps, testing each visited goal for an **approved proposal fact** — a `proposals` record with `type === 'approved'` whose `goal` matches that goal's slug. First match wins; that goal is the anchor.

Refusals are loud, named, and mirror the brain refusal idiom (HTTP 200 with `{success:false, refusal, error}`):

| refusal | meaning |
|---|---|
| `goal-not-found` | no goal carries the slug |
| `ambiguous-slug` | more than one does — refuse to guess (the `updateGoalIntent:2325` precedent) |
| `no-anchor-in-range` | walked the chain to the limit, found no approved fact — **the error names every goal walked** (AC3) |
| `chain-broken` | hit `parentUnresolved` or a `cycleOf` member mid-walk — refuse rather than walk a broken chain |
| `anchor-stale` | d4 |
| `boundary-widened` | d5 |

**d3 — `maxAnchorDistance` is a policy parameter; v1 = 0; no special-casing of 0.**
`DEFAULT_MAX_ANCHOR_DISTANCE = 0` as a named constant in the core, overridable by the endpoint from `process.env.BRAINSTORM_MAX_ANCHOR_DISTANCE` (parsed, non-negative integer, invalid → the default). The walk is a bounded loop over the chain — **at 0 it inspects only the goal itself, via the same code path, with no `if (distance === 0)` branch.** A test asserts the identical call yields a distance-2 anchor when the parameter is 2. This is what makes loosening a policy act under PRD §7.6 rather than a redesign, and it is PRD §7.5's tier model in embryo: a future per-category tier supplies this parameter instead of an env var.

**d4 — Ratification staleness is *detected*, not stored. (Settles reserved Open Q #1.)**
Because proposal facts never re-sign (ADR 0006 d3) and `updateGoalIntent` always does (`:2356`), the comparison is exact:

> An anchor is **stale** iff the anchor goal's element `createdAt` is greater than the approving fact's element `createdAt`.

A goal edited after approval therefore carries a ratification nobody granted, and the run refuses with `anchor-stale`, naming both timestamps and the goal. **The remedy is append-only-native and already supported**: a fresh `make-proposal` + `approve-proposal` pair — `decideProposal` already tells the owner as much (*"propose it again as a new fact if needed"*, `:3284`).

*Rejected alternative:* snapshotting `deliverable`/`boundary` into the `approved` fact. It changes the Proposal schema (ADR 0006 d1's properties + `required`), forces a `save-schema` re-write on a concept whose whole design is append-only, and contradicts the story's "no concept definitions change." The free detector is strictly better.

*Known conservative false positive:* the generic `update-element-json` dev endpoint (`normalize/index.js:3319`) re-signs any element, so using it on a goal trips staleness. Correct by conservatism — it is a raw escape hatch — and recorded in Consequences.

**d5 — Boundary narrowing: chain assembled mechanically, verdict rendered blind.**
The core exposes `boundarySteps(chain)` → the ordered `[{parentSlug, childSlug, parentBoundary, childBoundary}]` pairs, and `applyBoundaryVerdicts(steps, verdicts)` → the first widening step or `null`. **The verdict function is injected, not imported** — this keeps the core at zero requires (d1's purity assertion) and lets tests stub verdicts deterministically.

In the real run the verdict comes from a **blinded judge**, the protocol the harness already trusts: one spawn per step, one reply, given **only the two boundary strings and the question** — no goal names, no slugs, no chain position, no run state, nothing carrying a progress signal. Any `widens` verdict → `boundary-widened`, naming the step. At `maxAnchorDistance = 0` the chain has length 1 and yields **zero steps**, so the check is vacuous but fully wired — raising the parameter needs no new machinery, which is precisely what AC4 demands.

**d6 — Terms are transcribed at read; the endpoint returns them with their gaps named.**
`GET /api/brain/direction/:slug` returns, on success:

```
{ success: true, eligible: true,
  anchor: { slug, distance, proposalId, approvedOn },
  terms:  { ask, successCriteria, ceiling, estimate, estimateSource },
  surrendered: [...], unavailable: [...], chain: [...] }
```

`ask` ← the goal's `statement`; `successCriteria` ← `deliverable`; `ceiling` ← `boundary`. `estimate` ← `chanceOfSuccess`, which the **direction core parses from the raw json row itself** — it does **not** touch `parseGoalRow` (pinned by second-brain tests) and does **not** change `/api/brain/goals`. When absent: `estimate: null, estimateSource: 'absent'` — recorded as absent, never invented (AC2). This is a *local read*, deliberately narrower than the goal `store-and-show-the-prompt-and-the-estimate`; when that ships, this local read should collapse into it, and Consequences records the debt.

`surrendered` and `unavailable` are returned as data so the artifacts cannot silently omit them: the baseline commit and pinned governing versions with their reason (reproducibility traded for operational cost; retained in armed mode), and the two unavailable terms with their named dependencies.

**d7 — Doc changes: two named modes, armed untouched, referenced not copied.**

- **`engineering-team/roles/director.md`** — "The doctrine exception" grows to name **two** modes and say which to use when. A new `## Operational direction` section states the derivation, makes an `eligible: true` response from the endpoint a **precondition to running**, and states that the Gate rubrics, judge protocol, Stopping rules, ceiling, journal, and owner-only ratification apply **unchanged, by reference**. Armed-mode rules are edited *only* where a sentence must acknowledge a second mode exists — no rule removed, weakened, or made conditional (AC1).
- **`.claude/skills/direct-feature/SKILL.md`** — Stage 0 preflight forks by mode: armed reads the book's `## Direction mode`; operational calls the endpoint **from inside the container** (d-Context fact 8) and refuses on any refusal code, surfacing it verbatim. Stage 0 additionally runs the **d9.3 terms-mismatch check** — comparing the goal's live `deliverable`/`boundary` against the verbatim text recorded in the book's derived section — on the same cadence as the existing deadline re-check (every preflight, and before every gate decision). A mismatch halts.
- **`engineering-team/templates/book.md`** — the existing `## Direction mode (experiment) — pre-registered` gains a **distinctly headed** sibling `## Direction mode (operational) — goal-derived`, carrying the d9.1 generated-artifact warning in its own body, the d9.2 provenance block, and the endpoint's `terms` / `surrendered` / `unavailable` (owner-ratified at this gate).
- **`CLAUDE.md:148`** — the doctrine sentence is **rewritten in place, line-neutral** (the file is at 190/190) to name both modes and to state that ad-hoc per-session gate pre-authorization is forbidden.

**d8 — OPEN.md row 41 dispositioned.** Flipped to `DONE` citing this ADR and the story: operational direction is the named-mode answer; the ad-hoc middle path the `router-stream-tag-filters` book ran is forbidden going forward, and kickoffs of that shape take an operational goal or an armed section instead.

**d9 — The operational book writes a derived section — RATIFIED at the Architecture gate (Open Q #2 / owner, 2026-07-25).**
The brief reserved this for the owner rather than the Architect. *(Precedent for ratifying a reserved item at this gate: ADR `second-brain/0006` d16.)* The alternative — read the goal live and write nothing — buys structurally impossible drift at the cost of the book's self-containment, leaving the terms a run actually used unrecoverable once the goal is edited.

**Ratified: an operational book writes a `## Direction mode (operational) — goal-derived` section into `book.md` at arming**, under three binding conditions set by the owner.

The book is the audit artifact `/close-book` reads; a book that cannot state its own terms is a weaker record than one that can. The heading is **deliberately distinct** from `## Direction mode (experiment) — pre-registered` so which mode a book runs under is visible at a glance, in any book, without reading the body.

**d9.1 — Generated, and hand-editing it is a defect.**
The section is an **artifact of the goal**, never an alternative place to author terms. This is PRD §7.1's posture applied one level up — *"Selection judgment, policy values, and the record of intent, decision, and outcome live in the brain. A scheduler-side decision log is a defect."* A book-side authored goalpost is the same defect: it would make `book.md` a second, competing source of intent, which is exactly the hand-authorship this mode exists to remove.

The section **says so in its own body**, so the next person to open the file is told before they type — not in a doc they would have had to already know to consult. The Reviewer treats a hand-edited derived section as a **blocking defect**, and a hand-edit is detectable by re-deriving and comparing (d9.2 makes the inputs available).

**d9.2 — Carry provenance: four fields, non-optional.**
The section records, at derivation time:

| field | why |
|---|---|
| the **goal slug** | names the input |
| the **exact `deliverable` and `boundary` text derived from**, verbatim | the run's durable record — reconstructable after the goal moves |
| the **derivation timestamp** (ISO-8601 UTC) | fixes *when* the terms were taken |
| the **ratifying proposal** — `proposalId` + `approvedOn`, plus anchor slug and distance | names the ratification the run stands on |

Verbatim text, not a paraphrase or a hash: **when the goal changes later, you can still reconstruct what this run was actually told**, which is what any calibration of the run depends on. A hash would prove change without preserving content; a summary would preserve the wrong thing. It also carries the `surrendered` and `unavailable` lists from d6, so a reader sees what the mode gave up without consulting the goal.

**d9.3 — Re-derive on mismatch; never proceed on stale terms.**
At **every preflight** (skill Stage 0, and before every gate decision — the deadline-recheck cadence), the Director compares the goal's **current** `deliverable` and `boundary` against the verbatim text recorded in d9.2. On any difference: **halt, loudly and journaled** — then re-derive; never run on stale terms.

This is precisely the check armed mode makes by pinning governing versions at commit hashes. **The goal is simply the new pinned input**, and the recorded verbatim text is the pin.

- **The halt comes first, and re-derivation is not the Director's to perform unilaterally.** A moved goal means the anchor is also stale under d4, whose remedy is a fresh `make-proposal` + `approve-proposal` pair. Re-derivation happens under the *new* ratification, after the owner speaks — halts are "final until the operator speaks" (role file → Stopping rules), and silently re-deriving would let a run change its own goalposts mid-flight, which is the failure the whole mode is built to prevent.
- **Re-derivation is the only legal rewrite of the section.** d9.1 forbids the hand-edit; it does not freeze the section against regeneration from its source.
- **This is the mechanism that settles the brief's open Architecture question** — an approval ratifies the deliverable *as it stood*, and d9.3 is what notices when it no longer does. d4 detects a stale *ratification* at arming; d9.3 detects moved *terms* throughout the run. Both are required: at arming there is no recorded text to compare against yet, so timestamps are the only available signal; once derived, the text comparison is exact.

## Consequences

- **Enables** a run whose terms nobody hand-wrote, with the safety precondition enforced by testable code rather than by an agent reading prose about itself. AC3/AC4 become assertions a Gate-3 test can fail against.
- **Enables** loosening the anchor distance as a genuine policy act — an env value today, a per-category tier later (PRD §7.5) — with no code redesign, because 0 is not special-cased.
- **Constrains** the Proposal concept to stay exactly as ADR 0006 shaped it: append-only, never re-signed. d4's detector *depends* on that invariant, so a future change that makes proposal facts re-sign silently breaks staleness detection. This ADR pins it — any such change must supersede this ADR explicitly.
- **Constrains** the operational mode to goals that have been through the proposal loop. A goal captured and never proposed cannot be run operationally, by design.
- **Debt: the local `chanceOfSuccess` read.** d6 parses it in the direction core because the goals API drops it. When `store-and-show-the-prompt-and-the-estimate` ships, that local read should collapse into the general one. Recorded, not hidden.
- **Debt: the boundary judge is unexercised at v1.** Distance 0 yields zero steps, so the judge path ships wired but cold. Its first real exercise comes with the first distance > 0 policy change. Mitigated by requiring the Tester to cover it at distance > 0 with stubbed verdicts.
- **Known false positive, and its bound.** `update-element-json` (`normalize/index.js:3319`) re-signs any element and will trip `anchor-stale` on a goal even when no term changed — as will `updateGoalIntent`'s `capturedOn` backfill (`:2346-49`). This bites **only at arming**, where the timestamp is the only available signal and conservatism is right; the remedy is a fresh ratification. Once derived, **d9.3 compares verbatim text**, so benign re-signs do not halt a run in flight. The two checks are deliberately different instruments: d4 asks *"is this ratification still the one that was granted?"*, d9.3 asks *"have the terms moved since we read them?"*
- **d9.3 adds a per-preflight obligation** on the same cadence as the deadline re-check. It is the operational analogue of armed mode's pinned governing hashes, with the goal as the pinned input — so an operational run is not *less* pinned than an armed one on the axis that decides its goalposts, only on the reproducibility axis d6 surrenders.
- **A hand-edited derived section is a blocking Reviewer defect** (d9.1) and is mechanically detectable — re-derive from the recorded goal slug and compare. This is the one place where the book is not the source of truth about itself.
- **Eight test files must positively re-pin** the brain import allowlist to admit `lib/brain/direction`. This is a **Phase-3 obligation (the Tester's lane), never the Implementer's** — Direction-mode Gate 4 pins an empty `test/` diff after the Gate-3 commit.
- **CLAUDE.md stays at exactly 190 lines.** The doctrine amendment is a rewrite of line 148, not an addition. If the Implementer cannot fit both modes into one line, that is a kick-back to this ADR — not a budget raise (raising a cap requires a CHANGELOG row naming the origin, L10).
- **Firmware reinstall required?** **No.** No concept definition, schema, or property changes. The direction core reads existing records; nothing is written.

## Implementation notes

- **File: `src/lib/brain/direction.js`** (new) — dependency-free CJS, **zero `require()` calls**.
  - `const DEFAULT_MAX_ANCHOR_DISTANCE = 0;`
  - `parseEstimate(row)` — read `chanceOfSuccess` from the raw json's `tapestryOwnerGoal` section; non-numeric or absent → `null`. Never throws (the `parseGoalRow` tolerance idiom).
  - `resolveAnchor({goals, proposals, goalSlug, maxAnchorDistance})` → `{eligible, anchor, chain, refusal, detail}`. Consumes records already annotated by `resolveDecomposition`; walks `parentUuid`.
  - `isAnchorStale(anchorGoalRecord, approvalRecord)` → boolean, `createdAt` comparison per d4.
  - `boundarySteps(chain)` → ordered parent→child pairs.
  - `applyBoundaryVerdicts(steps, verdicts)` → first widening step, or `null`.
  - `deriveTerms(goalRecord, estimate)` → `{ask, successCriteria, ceiling, estimate, estimateSource}`.
  - **`termsMatch(goalRecord, recorded)`** → `{match: boolean, changed: ['deliverable'|'boundary']}` — the d9.3 comparison: the goal's live `deliverable`/`boundary` against the verbatim text the book recorded at derivation. Exact string comparison after trim; reports *which* field moved so the halt can name it. Pure, no I/O.
  - `SURRENDERED` / `UNAVAILABLE` — the fixed d6 lists, exported as data.
- **File: `src/api/brain/index.js`** — add `require('../../lib/brain/direction')` (the ninth core); add `handleGetDirection(req, res)` reusing the existing `readResolvedGoals(taPubkey)` and `readProposals(taPubkey)` helpers; register `app.get('/api/brain/direction/:slug', handleGetDirection)` in `registerBrainRoutes` (`:641-648`). Gate first: `if (!isOwner(req) && !req.localTrusted) return res.status(403)…`. Read-only — no mutation, no strfry tokens.
- **File: `engineering-team/roles/director.md`** — per d7 bullet 1.
- **File: `.claude/skills/direct-feature/SKILL.md`** — per d7 bullet 2; the Stage-0 call is made **from inside the container** (`docker exec tapestry curl …`), since host-side brain reads answer 403.
- **File: `engineering-team/templates/book.md`** — per d7 bullet 3 + **d9**: add `## Direction mode (operational) — goal-derived`, a **distinctly headed** sibling to the pre-registered section, containing in order: (1) the **d9.1 generated-artifact warning in the section's own body** — that it is derived from the goal, that hand-editing it is a defect, and that terms are authored on the goal, not here; (2) the **d9.2 provenance block** — goal slug, verbatim `deliverable` and `boundary` as derived, derivation timestamp (ISO-8601 UTC), and `proposalId` + `approvedOn` + anchor slug + distance; (3) the `terms` fields; (4) the `surrendered` and `unavailable` lists. Regenerated only by re-derivation after a d9.3 halt — never hand-edited.
- **File: `CLAUDE.md:148`** — line-neutral rewrite naming both modes.
- **File: `OPEN.md`** — row 41 → `DONE`, dated, citing this ADR and the story.
- **File: `engineering-team/CHANGELOG.md`** — a row is required: `roles/director.md`, the skill, and the book template are harness-definition paths (lint L10 wants the origin named — here, the owner goal `hand-work-to-the-engineering-team-without-arming-a-book`).

## Out of scope

- **Making `chanceOfSuccess` and the goal `prompt` readable through the goals API** — the goal `store-and-show-the-prompt-and-the-estimate`. d6's local read is deliberately narrower.
- **Who may author a prompt** — the goal `make-sure-only-prompts-i-wrote-can-run`. A named dependency; this ADR neither implements nor weakens it.
- **`dependsOn` / prerequisites** — the field does not exist; reported as unavailable, not synthesized.
- **The `task-timeline` pre-arming refresh** — flagged as a downstream dependency; performed elsewhere.
- **OPEN.md rows 57, 63, 64, 74, 76, 92** — pending goalpost-class amendments to the same two doc files, each awaiting its own ratification. A diff landing any of them is scope creep.
- **Any change to armed-mode rules, the five engineering phases, the gate rubrics, or `.claude/agents/gate-judge.md`** beyond naming the second mode.
- **A durable run record** (Option C) — deferred; the journal is the audit trail today.
- **Raising the anchor distance above 0** — a future owner policy act under PRD §7.6.
