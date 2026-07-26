# ADR 0002: Fail-closed boundary judgment, and the corrected eligibility contract

**Status:** Proposed
**Amended by:** ADR 0003 (d6's refusal shape gains `boundaryReview`, resolving its contradiction with d11 — **d11 stands as written**; `required` redefined to mean "steps still need verdicts")
**Date:** 2026-07-26
**Story:** `engineering-team/stories/operational-direction/1-operational-direction-mode.md`
**Amends:** ADR `operational-direction/0001` — **d5** (the boundary verdict was optional, so the check was opt-in and failed open), **d6** (the documented response shape omitted three shipped fields), and **d4** (staleness failed open on unknowable timestamps). ADR 0001's header gains the reciprocal `**Amended by:**` pointer in this story's diff; its body is untouched, per the repo's 0027/0028/0029 convention.

## Context

Review `operational-direction/1` returned **CHANGES_REQUESTED** with three blocking findings. This ADR decides the two that are design questions; the third (test coverage) follows from this decision and belongs to Phase 3.

### The defect, re-derived independently at this gate

```
caller omits verdict : eligible=true  refusal=null
caller injects widens: eligible=false refusal=boundary-widened
```

The same chain, the same anchor, the same boundaries — **eligible or refused depending on whether the caller remembered to pass a function.** `resolveAnchor` runs the boundary check only when `boundaryVerdict` is supplied (`src/lib/brain/direction.js:302`), and `handleGetDirection` never supplies one (`grep boundaryVerdict src/api/brain/index.js` → no match).

### Why this is a design error and not a bug to patch quietly

ADR 0001 chose **Option B over Option A** on one stated ground: *"the safety precondition of an autonomous run would be enforced by an agent reading prose about itself… There is no artifact a Gate-3 test can fail against."* As shipped, the **anchor** half is enforced in code and the **boundary** half in prose — `roles/director.md:38` (*"An unjudged step is never a pass"*) is currently the only thing standing between an unjudged chain and a green light. That is a partial regression to the option this epic rejected, in the exact place it was rejected for.

It is inert today: v1's `maxAnchorDistance` is 0, so the chain is one goal and there are zero steps. But **0001 d3's whole promise** is that raising the parameter is an owner policy act requiring *"no new machinery."* Under the shipped code, the day `BRAINSTORM_MAX_ANCHOR_DISTANCE=2` is set, half a **paired** guard silently stops running — and the owner's ruling on that pairing was explicit: *"a distant anchor without boundary inheritance is a laundering path… shipping the anchor without the inheritance rule is worse than shipping neither."*

### Constraints this decision must respect

1. **The core stays dependency-free** (0001 d1). The verdict cannot be imported; it must still arrive from outside.
2. **Refusals must be honest.** The refusal family says what actually happened; a message asserting a widening nobody judged would be a lie in an audit artifact, in a story whose subject is artifact honesty.
3. **The brain routes are GETs.** `registerBrainRoutes` carries seven reads and no writes; the eligibility surface must not grow a write shape.
4. **0001 d3's promise must survive**: raising the policy parameter stays configuration, not redesign.
5. **The core never throws** — the whole `goals.js`/`proposals.js` family returns envelopes and tolerates bad data.

## Options considered

### Option A — Treat a missing verdict as `widens`

Fail closed by reusing the existing refusal: no verdict ⇒ the step is assumed to widen.

**Pros.** Two-line change, no new refusal code, no test-list growth. Fails closed immediately.

**Cons.** The refusal would read *"'c' widens the boundary of its parent 'p'"* when **nobody judged it**. That statement goes into the decision journal and the book's audit trail as though a judgment occurred. This epic exists to stop artifacts from asserting things nobody decided; encoding a fabricated verdict into the refusal is the same defect wearing the fix's clothes. Rejected on honesty, not on cost.

### Option B — Fix only the endpoint

Leave the core permissive; have `handleGetDirection` inject a verdict function that refuses whenever steps exist.

**Pros.** Smallest diff; the only shipped caller becomes safe.

**Cons.** The core remains fail-open for every future caller, which is precisely the Reviewer's finding: *a safety invariant that depends on the caller remembering is not an invariant.* The next consumer — a CLI, a scheduler, a second endpoint — reintroduces the hole silently. Rejected as treating the symptom.

### Option C — A seventh refusal code, plus a verdicts channel on the endpoint *(chosen)*

The core refuses `boundary-unjudged` when steps exist and no usable verdict was supplied; the endpoint gains an optional ordered `verdicts` query parameter so the Director can complete the judgment in a second read.

**Pros.** Honest (it says nobody judged, not that something widened). Fails closed in the core, so every caller inherits it. Keeps the core pure — verdicts still arrive from outside. Keeps the endpoint a GET. Mechanically testable, which is the whole reason 0001 chose Option B.

**Cons.** Adds a refusal code (seven), a query parameter, and a documented two-call flow; `U32`'s closure test must grow. Accepted — the cost is one test-list entry and a paragraph of protocol.

### Option D — Throw from the core when the verdict is missing

Rejected outright: the pure-core family never throws on bad input (`parseGoalRow`, `parseProposalRow`, `parseEstimate` all return `null` rather than raise). A throw would also cross the endpoint's error boundary as a 500, turning a governance refusal into an outage.

## Decision

We chose **Option C**. Sub-decisions continue 0001's numbering.

**d10 — `boundary-unjudged`: the core fails closed, and says so honestly.**
`resolveAnchor` refuses when `boundarySteps(chain).length > 0` and no usable verdict was supplied for every step. `REFUSALS` grows to **seven**. The message states that the steps were **not judged** — it never asserts a widening that no judge produced. `boundary-widened` keeps its current meaning: a judge looked and said widens. The two are distinguishable in the journal, which matters when an operator audits why a run halted.

**d11 — The verdicts channel: `GET /api/brain/direction/:slug?verdicts=<ordered,list>`.**
Positional, one token per step, in `boundaryReview.steps` order. Accepted tokens: `narrows`, `widens`. The two-call flow:

1. `GET /api/brain/direction/<slug>` → at distance > 0, `eligible:false`, `refusal:'boundary-unjudged'`, plus `boundaryReview.steps` carrying **only the two boundary strings per step**.
2. The Director spawns one fresh blinded judge per step and journals each verdict.
3. `GET /api/brain/direction/<slug>?verdicts=narrows,narrows` → `eligible:true`, or `boundary-widened` naming the offending step.

Refuse `boundary-unjudged` — never a silent pass — when the list length ≠ step count, or any token is unrecognized. A GET stays a GET; no write surface is added.

**At v1 this changes nothing:** distance 0 ⇒ one-goal chain ⇒ zero steps ⇒ call 1 returns `eligible:true` directly, and the `verdicts` parameter is unused. When the parameter is raised, the machinery is already there — **0001 d3's promise is kept, and now kept honestly.**

**The trust model, stated rather than implied.** A Director could pass `narrows` without spawning a judge — exactly as it could rubber-stamp any gate. The query parameter is *not* a trust boundary and this ADR does not pretend otherwise; the controls are the same ones every gate relies on: a fresh blinded judge per verdict, every verdict journaled, and only the operator able to void one. `roles/director.md` must state that the `verdicts` passed here **must match the journaled judge verdicts**, and that passing an unjournaled verdict is a protocol breach of the same class as approving over a KICK_BACK.

**d12 — Staleness fails closed on unknowable currency (amends 0001 d4).**
`isAnchorStale` currently returns `false` when either `createdAt` is missing — a fail-open in a safety guard. It becomes: **unknowable ⇒ stale.** The refusal states that the ratification's currency **could not be established**, naming which timestamp was missing — not that the goal was rewritten. Reachability is low (`e.created_at` is present on every real event), so the cost is a loud refusal on a malformed record rather than a silent pass.

**d13 — The chain carries identity, so the endpoint stops re-resolving by slug.**
`resolveAnchor`'s `chain` becomes an array of `{ slug, uuid }` (or the records themselves) rather than bare slugs, and `handleGetDirection` builds `boundaryReview.steps` from what the walk actually visited instead of `resolved.find(g => g.slug === …)`. This removes the shadowed-duplicate mismatch the review flagged: `ambiguous-slug` guards only the *target*, so a duplicated **ancestor** slug could currently surface a different record's boundary text to the judge. Inert at v1; wrong the moment the parameter is raised, which is the same trigger as d10.

**d6 — CORRECTED response contract (supersedes 0001 d6's block).**
The success shape as shipped and as this ADR ratifies it:

```
{ success: true, eligible: true,
  anchor:      { slug, distance, proposalId, approvedOn },
  terms:       { ask, successCriteria, ceiling, estimate, estimateSource },
  surrendered: [...], unavailable: [...],
  chain:       [{ slug, uuid }],          // d13
  maxAnchorDistance: <n>,                 // the policy value actually applied
  boundaryReview: { required: <bool>, steps: [{ parentBoundary, childBoundary }] },
  derivedAt:   "<ISO-8601 UTC>" }
```

Refusal shape: `{ success:false, eligible:false, refusal, error, detail, chain, maxAnchorDistance }`, HTTP 200 (the brain refusal idiom). `maxAnchorDistance` is returned deliberately: a run's artifacts must record **which policy value was in force**, since that is the one goalpost this mode reads from the environment rather than from the goal.

## Consequences

- **Enables** the boundary invariant to be enforced by code for every caller, present and future — which is what 0001 d1 chose Option B to achieve, now actually achieved for both halves of the guard.
- **Enables** an honest journal: `boundary-unjudged` and `boundary-widened` are different events, and an operator auditing a halt can tell "nobody looked" from "a judge said no."
- **Constrains** the Director to a two-call flow at distance > 0, and obliges `roles/director.md` to state the verdicts-must-match-the-journal rule. Prose is doing real work here — but it is now prose *on top of* a code gate that fails closed, not prose *instead of* one.
- **Constrains** any future eligibility consumer to supply verdicts or be refused. That is the intent.
- **Debt: the trust model is unchanged and unimproved.** A lying Director defeats this, as it defeats every gate. Closing that would require the endpoint to verify judge provenance, which needs a judge-verdict record the harness does not have. Out of scope; recorded so nobody reads d11 as a guarantee it is not.
- **Test obligations (Phase 3, the Tester's lane — Gate 4 pins an empty `test/` diff):**
  - `U32`'s refusal-closure list must grow to **seven**; it currently asserts exactly the six named codes and will fail as written.
  - New coverage: steps exist + no verdict ⇒ `boundary-unjudged`; verdict-count mismatch ⇒ `boundary-unjudged`; unrecognized token ⇒ `boundary-unjudged`; the endpoint's two-call flow; `isAnchorStale` with a missing timestamp ⇒ stale; `chain` entries carry `uuid`.
  - The existing `U17`–`U23` stay valid — they inject verdicts and continue to pass.
- **Firmware reinstall required?** **No.** No concept, schema, or property changes — this is a refusal code, a query parameter, and two shapes.
- **No new dependencies.** The core stays at zero `require()` calls.

## Implementation notes

- **File: `src/lib/brain/direction.js`**
  - `REFUSALS` — add `'boundary-unjudged'` (seven).
  - `resolveAnchor` — after the anchor and staleness guards, compute `boundarySteps(chain)`. If `steps.length > 0`: require a usable verdict for **every** step; absent or incomplete ⇒ `refuse('boundary-unjudged', …)` naming the step count and that no judgment was supplied. Only then apply `applyBoundaryVerdicts`.
  - Accept verdicts either as the existing `boundaryVerdict` function **or** as an ordered `boundaryVerdicts` array — the array is what the endpoint threads from the query string; the function keeps the existing test seam and the blinding contract (it must still receive exactly the two boundary strings).
  - `isAnchorStale` — missing `createdAt` on either side ⇒ `true` (d12), with `resolveAnchor`'s message distinguishing "could not establish currency" from "rewritten after ratification."
  - `chain` — return `{ slug, uuid }` entries (d13); `boundarySteps` continues to take records.
- **File: `src/api/brain/index.js`** (`handleGetDirection`)
  - Parse `req.query.verdicts` — comma-separated, trimmed, lowercase; empty/absent ⇒ no verdicts. Pass through as `boundaryVerdicts`.
  - Build `boundaryReview.steps` from the core's returned chain (d13), not from `resolved.find(...)`.
  - Include `maxAnchorDistance` in both envelopes (already present; now contractual).
- **File: `engineering-team/roles/director.md`** — § "Operational direction": document the two-call flow, and state that verdicts passed on the second call **must match journaled judge verdicts**; an unjournaled verdict is a protocol breach of the same class as approving over a KICK_BACK.
- **File: `.claude/skills/direct-feature/SKILL.md`** — Stage 0's operational fork: `boundary-unjudged` is a normal outcome at distance > 0, not a halt; judge, journal, re-ask. Every other refusal still halts.
- **File: `engineering-team/decisions/operational-direction/0001-operational-direction-mode.md`** — **one-line header addition only**: `**Amended by:** ADR 0002 (d5 opt-in verdict → fail-closed; d6 response contract; d4 staleness fail-open)`. Body untouched (the 0027/0028/0029 convention).
- **File: `engineering-team/CHANGELOG.md`** — a row is required (`roles/director.md` and the skill are def paths; lint L10).

## Out of scope

- **Verifying judge provenance** — the endpoint cannot tell a journaled verdict from an invented one. Would need a judge-verdict record the harness does not have; the journal plus operator audit remains the control.
- **Raising `maxAnchorDistance` above 0** — still a future owner policy act (PRD §7.6). This ADR makes that act *safe*; it does not perform it.
- **Any change to the anchor walk, the staleness comparison's basis, the derived book section (0001 d9), or armed mode.**
- **The pre-existing goal-schema drift** (OPEN.md #102) — belongs to `store-and-show-the-prompt-and-the-estimate`.
