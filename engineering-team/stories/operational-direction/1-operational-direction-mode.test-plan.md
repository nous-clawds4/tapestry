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
