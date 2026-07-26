# Test Plan: Story 1 — Operational direction (goal-derived run terms)

**Story:** `engineering-team/stories/operational-direction/1-operational-direction-mode.md`
**ADR:** `engineering-team/decisions/operational-direction/0001-operational-direction-mode.md`
**Date:** 2026-07-25

**Suite:** `test/operational-direction.test.js` — 61 tests, registered in `test/test.js` and **wired into the aggregate exit gate** (`overallOk`), verified by `stack-free-npm-test` G5.

## Test classes

Per `test-hermeticity-ci/0001`, matching the sibling brain suites:

| Class | Runs | Gates CI |
|---|---|---|
| **U** (33) | Pure core over synthetic records, fed through the **real** `resolveDecomposition` | always — stack-free |
| **S** (16) | Source + doc assertions | always — stack-free |
| **H** (6) | Live local stack, **read-only, fixture-free** | per-test SKIP when unreachable |
| **R** (6) | Regression sentinels | always — stack-free |

**Why H is fixture-free.** The endpoint is read-only, so this suite creates no elements and needs no teardown — sidestepping by construction the stranded-node pre-clean cascade of OPEN.md row 94, which bit `the-proposal-loop` and `teach-it-what-matters`. `H6` proves read-only-ness by asserting the goal element count is unchanged across two calls.

## Coverage map

| Criterion | Tests | Level |
|---|---|---|
| **AC1** — two named modes; armed unweakened; row 41 disposed | `S6`, `S15`, `S11`, `S16`; unweakened by `R1`, `R2`, `R6` | source |
| **AC2** — terms transcribed; estimate present/absent; surrendered + unavailable stated | `U24`, `U25`, `U26`, `U27`, `U28`, `S14`, `H5` | unit + live |
| **AC3** — anchor required; distance a policy parameter; v1=0 not special-cased | `U1`–`U13`, `U32`, `U33`, `S7`, `H3`, `H4` | unit + live |
| **AC4** — boundary narrows, never widens | `U17`–`U23`, `S9` | unit + source |
| **AC5** — non-negotiables in force **by reference, not copy** | `S8`, `R3`, `R4` | source |
| **d4** — ratification staleness detected, not stored | `U14`, `U15`, `U16` | unit |
| **d9.1** — generated; hand-editing is a defect, said in the body | `S12` | source |
| **d9.2** — four provenance fields | `S13` | source |
| **d9.3** — re-derive on mismatch, never proceed stale | `U29`, `U30`, `U31`, `S10` | unit + source |
| **d1** — pure core, gated read-only endpoint | `S1`, `S2`, `S3`, `S4`, `H1`, `H2`, `H6` | source + live |

### The three tests that carry the most weight

- **`U6` — the policy-parameter proof.** The *same* `resolveAnchor` call refuses at `maxAnchorDistance: 0` and resolves a grandparent anchor at `2`. This is the mechanical evidence for ADR d3 — that loosening the anchor distance is an owner policy act (PRD §7.6) and not a redesign. `U7` fills in distance 1 so the walk is demonstrably continuous rather than two special cases.
- **`U23` — the blinding contract.** Captures every argument passed to the injected boundary-verdict function and asserts no slug (`grandparent`/`parent`/`child`) appears in any of them. This is what stops the boundary judge from seeing a progress signal.
- **`S8` — reference, not copy.** Counts headings in `director.md`: exactly one `Stopping rules`, one `Gate rubrics`, one `blinded gate-judge protocol`. It passes today and **fails if the Implementer satisfies the operational section by duplicating them per mode** — which is precisely how AC5 would be silently violated.

## Edge cases covered

- [x] A `proposed` fact does not anchor; a `skipped` fact does not anchor (`U4`, `U5`) — only an `approved` decision ratifies.
- [x] Nearest ratified ancestor wins when several are approved (`U8`).
- [x] The walk stops at the configured distance and does **not** report goals it never reached (`U9`).
- [x] Unresolvable parent → `chain-broken` (`U12`); parent cycle → `chain-broken` and terminates (`U13`) — the real `resolveDecomposition` breaks cycles, and the walk must not spin.
- [x] Duplicate slug → `ambiguous-slug`, never a guess (`U11`).
- [x] `parseEstimate` tolerates absence, non-numeric junk, malformed JSON, and a null row — never throws (`U26`).
- [x] Whitespace-only difference is not a term change (`U31`).
- [x] Benign re-sign with unchanged text does **not** halt a run in flight (`U29`) — the bound on d4's known false positive.
- [x] Refusal-code closure: every named code is reachable **and** no unnamed code is ever produced (`U32`).
- [x] Stack absent → H tests SKIP, suite still gates on U/S/R.

## Deliberately not covered, and why

- **The live boundary judge.** `U19`–`U23` inject verdicts; the real blinded-judge spawn is agent behavior, not a Node-testable unit. At v1 (`maxAnchorDistance = 0`) the chain is length 1 and the path never fires — so the ADR's "ships wired but cold" debt is real, and these tests are what make raising the parameter safe rather than exploratory.
- **An `eligible: true` answer over the wire.** No goal in the live graph currently has an `approved` proposal fact (the one proposal element is `type: 'proposed'`). `H5` is written to assert the full eligible shape *when* one exists and to assert "no invented estimate" otherwise, so it strengthens automatically the first time a goal is ratified — without this suite writing one.

## Test infrastructure

- **Framework:** Node's built-in runner via `node test/test.js` (`npm test`). No new frameworks.
- **Live stack:** `http://localhost:7778` host-side, `http://127.0.0.1:7778` from inside the `tapestry` container. Overridable via `TAPESTRY_PORT` / `TAPESTRY_CONTAINER_PORT` / `TAPESTRY_CONTAINER`.
- **Firmware state:** none required. **No `POST /api/firmware/install` precondition** — this story changes no concept definitions.
- **Fixtures:** synthetic in-memory records only (U-class). **No live fixtures, no teardown.**

## Phase-3 deliverables beyond the new suite

Both are the Tester's lane by ADR Consequences, because Direction-mode Gate 4 pins an empty `test/` diff after the Gate-3 commit:

1. **Runner registration** — `test/test.js`: require, invoke, summary line (guarding on `(pass+fail)===0`, never `.skipped` alone — G7), the `overallOk` term (G5), and the `totalSkipped` roll-up.
2. **The eight-suite import re-pin** — `attach-the-world`, `break-a-goal-into-pieces`, `capture-a-goal-and-see-it`, `sessions-read-the-brain`, `structures-the-brain-can-trust`, `teach-it-what-matters`, `the-brain-survives`, `the-proposal-loop` each admit `lib/brain/direction` (the ninth). Asserted by `S5`.
3. **The brain ROUTE re-pin** *(missed in the first pass; caught by the full gate)* — `the-brain-survives` `S3` pins `registerBrainRoutes` to an **exact route count**, and the new eligibility read makes seven. Re-pinned to admit `/api/brain/direction/:slug`. **The exact-length check is deliberately kept**, so an unintended eighth route still fails until someone re-pins it on purpose. The ADR's Consequences enumerated only the *import* re-pin — this second pin was a Phase-3 completeness gap, not an ADR defect.

## Pre-existing failures found by the full gate — NOT caused by this story

The full-gate run at `a0fb44f3` was **RED**, with three failures. One was ours (the route re-pin above). **Two are pre-existing live-instance drift and are deliberately left alone**, because fixing them is the territory of the goal `store-and-show-the-prompt-and-the-estimate`, which this story explicitly scopes out.

- `structures-the-brain-can-trust` **H4** and `break-a-goal-into-pieces` **H1**, identical cause:

  ```
  required must stay exactly [name, slug, description] — the new fields are OPTIONAL
  (got ["name","slug","description","chanceOfSuccess"]).
  ```

  The **live** goal-concept schema node carries `required = ['name','slug','description','chanceOfSuccess']`, violating second-brain ADR 0003 d13's invariant that `required` stays exactly `[name, slug, description]`. Verified directly against the graph.

  **Why it cannot be ours:** these are H-class assertions reading live graph state, and this story's diff contains **zero** schema, firmware, or concept writes — the whole feature is one read-only endpoint plus a pure module. The drift is consistent with `chanceOfSuccess` having been declared on the goal concept (the condition the `store-and-show-…` goal describes: *"declared on the goal concept but no producer accepts them and no read surface returns them"*), with the declaration landing in `required` instead of optional.

  **Why it matters beyond a red test:** a goal captured *without* `chanceOfSuccess` now violates its own concept's schema. That is a real instance defect, not a test artifact.

  **Recommended:** an OPEN.md row, and repair under `store-and-show-the-prompt-and-the-estimate`. Not fixed here — out of scope, and a schema write is exactly the kind of change this story promised not to make.

## Observation for the Reviewer (not fixed here)

The eight suites' import-violation **error strings** are stale independently of this story: they enumerate seven modules ("… lib/brain/goals, lib/brain/hygiene, lib/brain/resources, lib/brain/work-records") while the `allowed` array has carried ten since `proposals`/`signals`/`export` landed. Pre-existing drift; touching the prose was out of this story's scope, so only the regex array was re-pinned. Worth an OPEN.md `meta` row at book close.

## How to run

```bash
node test/operational-direction.test.js
```

Full gate:

```bash
npm test
```

> **Note (OPEN.md row 83):** a full live `npm test` runs ~24 min and exceeds the harness's 10-minute foreground cap. Run it backgrounded with a bounded waiter — `until grep -q "^Overall:" <log>; do sleep 15; done` — not as a foreground call.

## Verification

Confirmed 2026-07-26T03:50Z at commit `dca847a8` (the ADR commit, before any implementation).

```
operational-direction: 8 passed, 53 failed, 0 skipped
```

**The 53 fail because the feature is missing, not because of typos or import errors** — the failure messages name the absent artifact:

```
FAIL  U1 (AC3): the goal itself, approved, anchors at distance 0 — eligible
      src/lib/brain/direction.js does not exist yet — the direction core (ADR 0001 d1) is not implemented.
FAIL  S2 (d1): the brain module requires the direction core and registers the read-only route
      src/api/brain/index.js must require the direction core (the ninth).
FAIL  S11 (d9): the book template carries a DISTINCTLY HEADED operational section
      the book template must carry '## Direction mode (operational) — goal-derived' (ADR d9) …
FAIL  S15 (AC1): CLAUDE.md's doctrine line names BOTH modes …
      AC1: the doctrine line must name the operational mode; got: 4. **Honor the gates.** … *Sole exception:* a
      Direction-mode book with an **armed** pre-registration …
FAIL  S16 (AC1/d8): OPEN.md row 41 is dispositioned DONE and cites this work
      ADR d8: row 41 must be flipped to DONE by this story; got: | 41 | meta | **Session-mode standing gate
      authorization — formalize or forbid.** …
FAIL  H1: GET /api/brain/direction/:slug answers on loopback (not 404)
      GET /api/brain/direction/:slug is not registered — the endpoint 404s on loopback (ADR d1).
```

**H tests executed rather than skipped** — the local stack was reachable at Gate 3, so the six live assertions are real evidence, not deferred.

**The 8 that pass are pass-by-design and documented in the suite header:** `R1`–`R6` (regression sentinels that must *still* pass afterward), `S8` (regression sentinel in effect — see above), and `S5` (asserts this phase's own re-pin deliverable).

### Round 3 — ADR 0003 coverage (one `boundaryReview` shape)

Added after review round 2. Suite grows **78 → 86**: `U45`–`U48`, `S21`–`S22`, `H9`–`H10`.

### The coverage hole this round closes, measured

Before this round, `boundaryReview` appeared **zero times** in a 78-test suite — the envelope key the entire two-call flow depends on was asserted nowhere. That is *why* round 2's defect survived: coverage was structurally shaped so nothing could catch it.

| level | what it covers | why it missed the defect |
|---|---|---|
| U-class (33 tests) | the pure core's return values | never sees the assembled HTTP envelope |
| S-class (`S17`, `S18`) | handler source text | asserted the query parse and the step source, not the envelope keys |
| H-class | the live wire | **skips** whenever the stack is down — as it is now |

`S21` is the structural fix: it locates the refusal envelope by `refusal: outcome.refusal` and the success envelope by `eligible: true`, and asserts **each** carries `boundaryReview`. It runs stack-free, so it cannot skip away.

| ADR 0003 decision | Tests |
|---|---|
| **d14** — symmetric envelope, refusal carries `boundaryReview` | `S21` (the round-2 guard), `H9` |
| **d15** — `required` means "steps still need verdicts" | `S22`, `H10` |
| **d16** — steps at exactly one address | `U45` (unjudged), `U46` (widened), `U47` (no duplicate in `detail`) |
| **Constraint 2** — blinding survives on the refusal path | `U48` |

### RED confirmation (round 3)

Against the un-amended implementation at `1822b03d`:

```
operational-direction: 70 passed, 6 failed, 10 skipped
```

`H9`/`H10` **skip** — Docker's daemon is down this session. They are written anyway: they are the wire proof that `S21` can only approximate, and they will execute the moment the stack returns.

### `U48` was vacuous on first write — caught and fixed before commit

Written as `for (const s of r.steps || [])`, it passed against the un-amended core because `r.steps` is `undefined` there, so the loop body never ran — **the identical failure mode as `U38` in round 2.** Verified directly:

```
U48 iterates (r.steps || []) — r.steps is currently: undefined
=> loop body never runs. U48 passes VACUOUSLY, exactly like U38 did in round 2.
```

Fixed by asserting the payload exists (`length === 2`) *before* inspecting its keys. It now fails red like the rest. Two vacuous passes in two rounds is a pattern worth a `meta` row: **a test that iterates a collection the feature does not yet produce is green by default** — assert arity first.

### ADR 0003's self-flagged prediction — checked, and it held

ADR 0003 marked its own test-impact bullet as untrustworthy ("the Tester should *run* the suite rather than trust this bullet") because ADR 0002 mis-called impact twice. Ran it: **all 6 of `U34`–`U39` pass** — they assert refusal *codes*, which d14/d15/d16 do not change. The prediction was correct this time. Recorded because the ADR earned the doubt and should get the credit when it is right.

## Round 2 — ADR 0002 coverage (fail-closed boundary judgment)

Added after review **CHANGES_REQUESTED**. Suite grows **61 → 79**: `U34`–`U44`, `S17`–`S20`, `H7`–`H8`, plus `U32` extended.

| ADR 0002 decision | Tests |
|---|---|
| **d10** — `boundary-unjudged`, fail closed, honest message | `U34` (the regression guard), `U35` (must not assert a widening nobody judged), `U32` |
| **d11** — the ordered `verdicts` channel, two-call flow | `U36` (length mismatch), `U37` (unrecognized token), `U38` (happy path), `U39` (judged widen stays distinct), `U40` (v1 unchanged), `S17`, `S19`, `S20`, `H7` |
| **d12** — staleness fails closed on unknowable currency | `U41`, `U42` (distinguishable from "rewritten") |
| **d13** — chain carries `{slug, uuid}` | `U43`, `U44` (refusals use the same shape), `S18` |
| **d6 corrected** — `maxAnchorDistance` contractual | `H8` |

### RED confirmation (round 2)

Run against the un-amended implementation at `8da154ec`:

```
operational-direction: 64 passed, 14 failed, 0 skipped
```

The 14 fail because the amendment is absent — `boundary-unjudged` does not exist, `boundaryVerdicts` is ignored, `isAnchorStale` still fails open, `chain` is bare slugs, and the two doc files don't mention the flow.

### Two of the new tests pass before the fix — stated, not buried

- **`U40` is a true regression sentinel.** At the v1 policy distance the chain is one goal ⇒ zero steps ⇒ the new guard must *not* fire. It must keep passing afterward; that is the proof v1 behavior is unchanged.
- **`U38` currently passes VACUOUSLY, and that is a real weakness.** The un-amended core ignores the `boundaryVerdicts` array entirely, so its `eligible:true` comes from the *absent* guard, not from verdicts working. Verified directly:

  ```
  eligible: true — but boundaryVerdicts is IGNORED by the current core
  ```

  It is not discriminating on its own. The discrimination is carried by `U34`/`U36`/`U37`/`U39`, which all fail now, and `U38` becomes meaningful once the guard exists. Recorded rather than left as an unexplained green line.

### Second gap in ADR 0002's test obligations — `U6`, `U7`, `U8` (found at Implementation)

ADR 0002's Consequences states: *"The existing `U17`–`U23` stay valid — they inject verdicts and continue to pass."* True, but **incomplete**. `U6`, `U7`, and `U8` also exercise anchors at distance > 0 and inject **no** verdicts, so the fail-closed guard correctly refuses them with `boundary-unjudged`. All three went red the moment d10 landed.

The implementation is right and the tests were stale. Each now supplies verdicts sized to its chain:

| Test | Chain | Steps | Verdicts added |
|---|---|---|---|
| `U6` | grandparent → parent → child (distance 2) | 2 | `['narrows','narrows']` |
| `U7` | parent → child (distance 1) | 1 | `['narrows']` |
| `U8` | anchors at parent (distance 1) | 1 | `['narrows']` |

`U6`'s proof is now the **stronger** statement: raising the policy parameter resolves the ancestor anchor *and* obliges boundary judgment. The un-judged path it used to cover implicitly is now owned explicitly by `U34`.

This is the **second** miss in the same ADR section (the first being the `U32` claim below). Both are the same shape — the ADR enumerated which existing tests the amendment touches and under-counted. Worth a `meta` row at book close: *an ADR that predicts test impact should be checked by running the suite, not by reading it.*

### Correction to ADR 0002's Phase-3 note

ADR 0002's Consequences states that `U32` *"currently asserts exactly the six named codes and **will fail as written**."* **That is not accurate, and the truth is worse.** None of `U32`'s original scenarios produced boundary steps without a verdict, so `boundary-unjudged` would never have appeared in its `produced` set — the first loop checks only that *produced* codes are named, and the second checked only the six. **Original `U32` would have silently passed while missing the seventh refusal entirely** — a quiet coverage gap rather than a loud failure.

`U32` has been extended: `REFUSALS` grows to seven, a steps-without-verdict scenario is added, and the reachability loop now iterates `REFUSALS` itself rather than a hardcoded six-item list, so the next refusal code cannot be added without a scenario proving it reachable.

## Kick-back from Implementation — `U23` was unsatisfiable (fixed 2026-07-26)

The Implementer halted at 60/61 and kicked back rather than editing a test mid-phase. **`U23` could not be passed by any correct implementation**, and the fault was this plan's fixture, not the code.

`U23` asserts the injected boundary-verdict function receives no slug — the blinding contract. But `chainOfThree()` used `goal()`'s default boundary, `` `what ${slug} stays inside` ``, so the two boundary strings a blinded judge is *supposed* to receive were literally `"what grandparent stays inside"` / `"what parent stays inside"`. The assertion tripped on the very data the ADR requires be passed. Not calling the verdict failed the `seen.length > 0` guard; passing anything else violated ADR d5. No exit.

**Fix:** `chainOfThree()` now supplies slug-free boundary text (`"the outermost limit of this work"`, etc.). The assertion is untouched — only the fixture changed.

**The fix preserves the test's teeth**, verified by simulating both implementations against the new fixture:

```
leaky impl (passes the whole step object) → assertion trips: true   (must be true)
blind impl (passes the two strings only)  → assertion trips: false  (must be false)
```

Slugs remain `grandparent`/`parent`/`child`, so a leak of slugs or chain position still fails the test. Suite now **61 passed, 0 failed, 0 skipped** with the implementation present.

*Process note: this is the failing-tests-first contract working as designed — the Implementer could not quietly weaken a test to go green, so the defect surfaced in the phase that owns it.*

### Defect found and fixed during verification

`R5` initially failed with *"CLAUDE.md is 191 lines against a cap of 190."* That was a bug in the test, not the repo: `split('\n').length` over-counts by one on a trailing newline, so the sentinel would have failed forever regardless of implementation. Corrected to count as `harness-lint` L11 does (`wc -l` = newline count). This is exactly the "confirm the test fails for the *right* reason" step earning its keep.

### Harness guards re-run clean with the new suite wired in

```
stack-free-npm-test → 7 passed, 0 failed   (G5 gate-wiring, G6 exit-strictness, G7 summary honesty)
harness-lint        → 32 passed, 0 failed
ci-test-job         → 14 passed, 0 failed
harness-lint.sh     → clean (0 violations)
```

All nine touched test files pass `node --check`.
