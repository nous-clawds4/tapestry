# ADR 0003: One `boundaryReview` shape — the refusal carries what the flow needs

**Status:** Proposed
**Date:** 2026-07-26
**Story:** `engineering-team/stories/operational-direction/1-operational-direction-mode.md`
**Amends:** ADR `0002` (d11 stands; d6's refusal shape corrected) — the 0027/0028/0029 separate-amending-ADR convention, as `0002` itself followed for `0001`.

## Context

ADR 0002 introduced the two-call flow that makes the fail-closed boundary guard usable: call 1 refuses `boundary-unjudged` and hands back the steps; the Director judges each blind and journals the verdicts; call 2 re-asks with `?verdicts=`. Round-2 review found the flow **cannot be executed as documented**.

### The contradiction, re-derived at this gate

ADR 0002 says both of these, and they cannot both be true:

- **d11, step 1** (`0002:75`) — call 1 returns *"`eligible:false`, `refusal:'boundary-unjudged'`, plus `boundaryReview.steps` carrying only the two boundary strings per step."*
- **d6, refusal shape** (`0002:105`) — *"`{ success:false, eligible:false, refusal, error, detail, chain, maxAnchorDistance }`"* — no `boundaryReview`.

The implementation (`src/api/brain/index.js`, refusal envelope) faithfully followed **d6**, and thereby broke **d11**. Both governing documents were written against d11:

- `engineering-team/roles/director.md:38` — *"(1) read `boundaryReview.steps`"*
- `.claude/skills/direct-feature/SKILL.md:46` — *"re-ask … in `boundaryReview.steps` order"*

A Director following its role file reads `boundaryReview.steps` on the refusal, finds `undefined`, and cannot reach step 2.

### The root cause is an asymmetry, not a missing key

The steps currently live at **two different addresses depending on outcome** (`src/lib/brain/direction.js`):

| path | where the steps are | line |
|---|---|---|
| `boundary-unjudged` refusal | `detail.steps` | `:402` |
| eligible | top-level `steps` | `:424` |

So every consumer needs a branch, and the endpoint wired only one of the two into `boundaryReview`. A second consumer would hit the same trap. **The fix is to make the shape symmetric, not to patch the one caller.**

### Severity, stated honestly

This is **fail-safe**. The guard refuses correctly; nothing unjudged can run. Inert at v1 (distance 0 ⇒ zero steps ⇒ call 1 returns eligible directly). It breaks only when `BRAINSTORM_MAX_ANCHOR_DISTANCE` is raised — which is precisely the circumstance ADR 0001 d3 advertises as *"a config change requiring no new machinery,"* and the same circumstance under which round 1's finding was blocked.

### Constraints

1. **Acceptance criterion AC4 is the contract:** *"given a step where the child's boundary admits something the parent's excludes, the run refuses to start and names the widening step… Given a configured anchor distance greater than zero, this check is exercised over a multi-goal chain — so raising the parameter later requires no new machinery."* A flow whose step-1 payload is unreachable does not satisfy "no new machinery."
2. **Blinding survives:** whatever carries the steps carries **only** `parentBoundary` and `childBoundary` — no slugs, no chain position (ADR 0001 d5).
3. **A GET stays a GET.** No write surface (ADR 0002 d11).
4. **The core stays dependency-free** — zero `require()` (ADR 0001 d1).

## Options considered

### Option A — Correct the two docs to say `detail.steps`
Leave the code alone; change `director.md`, the skill, and d11 to point at `detail.steps`.

- **Pros:** no code change; smallest diff.
- **Cons:** `detail` is the generic diagnostic bag every refusal carries — making it load-bearing for a control-flow path conflates *diagnostics* with *contract*, so a future tidy-up of `detail` silently breaks the flow. Leaves the success/refusal asymmetry intact, so every consumer still needs a branch and the next one falls into the same hole. Changes three documents to avoid changing one line.

### Option B — One symmetric `boundaryReview`, on both envelopes *(chosen)*
The refusal envelope carries `boundaryReview` exactly as the success envelope does; the core returns `steps` at top level on **both** paths; `detail` keeps diagnostics only. d11 stands as written; d6's refusal line is corrected to match it.

- **Pros:** one address for the steps, so the two copies cannot diverge; callers need no branch on outcome; the already-written docs become true with no edit; the endpoint's two envelopes stop disagreeing about where a thing lives.
- **Cons:** touches the core's refusal payload as well as the endpoint (still small); `detail.stepCount` and the step data become adjacent rather than nested together.

### Option C — Move the success payload into `detail` too
Make both paths use `detail.steps`, dropping the top-level `steps`.

- **Pros:** also symmetric; no new envelope key.
- **Cons:** same conflation of diagnostics with contract as Option A, and it demotes a contractual field into a bag documented as free-form. Worse, it makes the *success* envelope's `boundaryReview` — which is contractual per 0002 d6 — read out of a diagnostic structure.

## Decision

We chose **Option B**. Sub-decisions continue 0002's numbering.

**d14 — The refusal envelope carries `boundaryReview`; the shape is symmetric.**
`handleGetDirection`'s refusal envelope gains `boundaryReview: { required, steps }`, identical in shape to the success envelope's. **d11 stands exactly as written; d6's refusal line is corrected** to:

```
{ success:false, eligible:false, refusal, error, detail, chain,
  maxAnchorDistance, boundaryReview: { required, steps } }
```

A caller reads `boundaryReview.steps` regardless of outcome and never branches on it. `roles/director.md:38` and `SKILL.md:46` become true as already written — no doc edit is required by this ADR, which is the tell that this was the intended shape all along.

**d15 — `required` means "these steps still need verdicts" (fixes review NB1).**
Currently `required: steps.length > 0`, so an *eligible* answer whose steps were just judged still reports `required: true` — read literally, an instruction to go judge them again. It is redefined as **true iff this answer is the `boundary-unjudged` refusal**: false on any eligible answer (the steps were judged, or there were none), false on every other refusal. The field then answers the only question a caller asks of it — *"is there judging work outstanding?"*

**d16 — The steps live at exactly one address in the core.**
`resolveAnchor` returns top-level `steps` on **both** the eligible path and the `boundary-unjudged` refusal (`{parentBoundary, childBoundary}` only — constraint 2). The refusal's `detail` keeps `walked`, `stepCount`, and `verdictsSupplied` as diagnostics and **drops its duplicate `steps` copy**, so there is no second copy to drift. `boundary-widened` also returns `steps`, for the same symmetry.

## Consequences

- **Enables** the two-call flow to actually run at distance > 0 — the machinery ADR 0001 d3 promised is now reachable, not merely present.
- **Enables** a single read path: `boundaryReview.steps`, success or refusal, no branch. The class of bug found in round 2 (one of two addresses wired up) becomes unrepresentable.
- **Constrains** `detail` to what it should have been all along: diagnostics, never contract. Anything a caller must *act* on belongs in a named field.
- **Costs** one duplicated concept removed and one key added — no new surface, no new refusal code, no new dependency.
- **Does not change** the trust model. ADR 0002 d11's statement stands: the `verdicts` parameter is not a trust boundary; the controls remain the blinded judge, the journal, and operator audit. This ADR moves data, not authority.
- **Still unverified over the wire.** The Docker daemon is down this session, so `H1`–`H8` skip and no live call has exercised `?verdicts=`. This ADR does not change that; it is the reason the Tester should add a payload assertion at the *envelope* level (below) rather than relying on an H-class test that may skip.
- **Test obligations (Phase 3, Tester's lane — Gate 4 pins an empty `test/` diff):**
  - Assert the **refusal** envelope carries `boundaryReview.steps` — the round-2 blocking defect, which no existing test covers. This is the one that matters.
  - Assert `required` is `false` on an eligible answer whose steps were judged (d15), and `true` on the `boundary-unjudged` refusal.
  - Assert the core returns top-level `steps` on both paths and that `detail` no longer carries a duplicate (d16).
  - Existing `U34`–`U39` stay valid — they assert refusal *codes*, which are unchanged. **This prediction is stated as a prediction:** ADR 0002 mis-called test impact twice, so the Tester should *run* the suite rather than trust this bullet.
- **Firmware reinstall required?** **No.** No concept, schema, or property change.
- **No new dependencies.** The core stays at zero `require()`.

## Implementation notes

- **File: `src/lib/brain/direction.js`**
  - `resolveAnchor` — the `boundary-unjudged` refusal: move `steps` out of `detail` and return it top-level; keep `walked`, `stepCount`, `verdictsSupplied` in `detail`. The `boundary-widened` refusal: also return top-level `steps`. The eligible return already does (`:424`) — unchanged.
  - No signature change, no new export, no `require()`.
- **File: `src/api/brain/index.js`** (`handleGetDirection`)
  - Build `boundaryReview` **once**, above the branch, from `outcome.steps`: `{ required: outcome.refusal === 'boundary-unjudged', steps: outcome.steps || [] }` (d15).
  - Include it in **both** `res.json(...)` envelopes.
- **Files: `engineering-team/roles/director.md`, `.claude/skills/direct-feature/SKILL.md`** — **no change required.** Both already instruct `boundaryReview.steps`; this ADR makes them true. Stated explicitly so the Implementer does not "helpfully" edit them.
- **File: `engineering-team/decisions/operational-direction/0002-…md`** — one-line header addition only: `**Amended by:** ADR 0003 (d6's refusal shape gains `boundaryReview`; `required` redefined)`. Body untouched.
- **File: `engineering-team/CHANGELOG.md`** — no row required: this ADR changes no harness-definition path (`director.md` and the skill are untouched). Lint L10 is not triggered.

## Out of scope

- **The trust model.** Unchanged and unimproved; ADR 0002's recorded debt stands.
- **Live wire verification.** Needs the stack; tracked as a gap, not closed here.
- **OPEN.md #102** (the live goal schema marking `chanceOfSuccess` required) — pre-existing, belongs to `store-and-show-the-prompt-and-the-estimate`.
- **Renaming `detail`** or auditing other refusals' use of it — this ADR fixes the one path the flow depends on.
