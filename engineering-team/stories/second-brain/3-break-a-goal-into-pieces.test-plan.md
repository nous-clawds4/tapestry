# Test Plan: Story 3 — Break a goal into pieces

**Story:** `engineering-team/stories/second-brain/3-break-a-goal-into-pieces.md`
**ADR:** `engineering-team/decisions/second-brain/0003-record-based-decomposition-and-validated-goal-writes.md`
**Date:** 2026-07-23

## Coverage map

Suite: `test/break-a-goal-into-pieces.test.js` (30 tests: 9 U, 12 S, 7 H, 2 R). Classes per test-hermeticity-ci/0001 — U executed stack-free (always gates CI), S source assertions, H live local stack (per-test SKIP when absent), R regression sentinels.

| Criterion | Tests | Level |
|---|---|---|
| AC 1 — children in conversation, one parent, tree, adoption, loud refusals with nothing written | U2 (parse round-trip), U4 (attachment), U7 (`validateDecompositionOp` full refusal/ok matrix incl. multi-level trees), H3 (live create-child round-trip, durable read-back), H5 (live refusal matrix + snapshot equality = nothing written) | unit + integration |
| AC 2 — `viable` = leaf + deliverable + boundary; hint otherwise | U3 (derivation matrix incl. whitespace), S8 (hint line byte-exact + `viable` renders), H3/H4 (live standing flips) | unit + source + integration |
| AC 3 — a goal with children is never `viable` | U3 (`hasChildren` override), H3 (live: parent carries BOTH fields yet derives `captured`) | unit + integration |
| AC 4 — tree renders with disclosure; story-1 states unregressed | S8 (disclosure glyph, navigation, no-toggle-token guard), U4/U5/U6 (the resolution truth the tree renders from: order preservation, duplicate-slug determinism, dangling/cycle tolerance), H6 (legacy three at root), story-1 S5/S5b/S12 still green (unamended) | source + unit + integration |
| AC 5 — "Done means"/"Stays inside" verbatim, owner's words, sharpen | U2 (fields extracted), S9 (labels byte-exact, *part of* context, back link), H4 (live sharpen → read-back exact words + capturedOn backfill) | unit + source + integration |
| AC 6 — copy discipline, no regression, hygiene green | S8/S9 (jargon guard on the NEW page — story-1 S8 scans only Goals.jsx), S12 (no 64-hex), U8 (three new taxonomy kinds, specific + deterministic), U9 (row-85c `schema-unreadable` split), H1 (schema extended, required unchanged), H2 (hygiene green — the d8 fold's live proof), H6 (legacy intact) | all |

ADR-pin rows beyond the ACs: S3/S4 (routes, gates, named discriminated results, capturedOn backfill), S5 (serialization trace — see Limits), S6 (save-schema fold: extracted `reconcilePrimaryPropertyForConcept`, `not-applicable`, `primaryProperty` in the response), S7 (taxonomy tokens + hygiene purity re-pin), S10 (detail route `goals/:slug`), S11 (ADR-0002 `Amended by` pointer), H7 (caller-class 401s), R1/R2 (read surfaces + untouchables).

**Pass-by-design sentinels** (pass before AND after implementation — they pin invariants, story-2 review precedent): S1 (brain import surface unchanged — the story's no-new-requires claim), S2 (brain module mutation-free), S11, S12, H2, H6, R1, R2, **and H7** — discovered at verification: the default-deny middleware 401s unknown-route POSTs *before* routing, so H7 passes pre-impl too; it still pins the caller-class contract post-impl.

## Sibling-suite amendments (executed here — the Tester's lane, per the story-2 lesson and the ADR template rule)

All three are **green on both sides** of the implementation, so the failing set stays attributable purely to the story-3 suite; the new pins that must *fail first* live in the story-3 suite instead.

1. **story-1 S7** (`test/capture-a-goal-and-see-it.test.js`) — was "viable/achieved/abandoned absent from Goals.jsx"; now admits `viable` (story-3 S8 *requires* it), still bans `achieved`/`abandoned`.
2. **story-1 H1** — was "every goal derives `captured`" (falsified permanently by the feature's first real use); now asserts **derivation consistency**: every goal's standing matches the ADR 0003 d3 rule computed from its own response fields. Pre-impl the fields are absent → expected `captured` → green.
3. **story-2 S4** (`test/structures-the-brain-can-trust.test.js`) — the mechanism tokens (`regenerateJson(`, `'already-consistent'`, `'reconciled'`) are now accepted in the handler **or** the extracted `reconcilePrimaryPropertyForConcept` (the d8 fold), so the pin survives the extraction; the gate remains pinned in the handler. Story-3 S6 pins the extraction itself, failing-first.

**Not amended, verified deliberately:** story-2 U7(e) (null property-section stays `property-record-drift` — story-3 U9 pins both sides of the split); story-1 S2 / story-2 S3 import pins (no new requires by design — story-3 S1 re-pins the same five); story-1 S5b (satisfied by the d10 identifier constraint, guarded by story-3 S8); story-1 U4 (one-argument `deriveStanding` keeps returning `captured` — story-3 U3 pins the compatibility).

## Runner registration

`test/test.js`, the standard five touches: require (top, epic comment), run call in `main()`, skip-aware summary line, **live `overallOk` chain term** (the severed terminator moved from the story-2 term onto the new term; dead block untouched per OPEN.md #43), `totalSkipped` entry. Syntax-checked with `node --check`.

## Edge cases

- [x] Legacy rows without the new fields (U2), whitespace-only field values (U3, H5 empty-value), one-argument `deriveStanding` calls (U3).
- [x] Duplicate slugs: deterministic oldest-wins resolution + `slugShadowed` flag (U5), `ambiguous-slug` refusal (U7), `duplicate-slug` hygiene kind (U8).
- [x] Dangling parent → root + `parentUnresolved` (U6); self-parent = length-1 cycle (U6, U8); mutual cycle with a well-formed descendant — subtree stays attached (U6); cycle detection deterministic and input-order independent (U8).
- [x] Multi-level trees permitted (U7 ok-paths); adoption only for parentless goals (U7, H5).
- [x] Refused writes leave the goal set byte-identical (H5 snapshot equality, incl. deliverable/boundary/parent fields).
- [x] Stack absent → every H row SKIPs (the house `stackAvailable` pattern); U/S always gate.

## Test infrastructure

- Framework: the house zero-dependency runner (`test(name, fn)` collector, `run()` export), registered in `node test/test.js`.
- Live API: loopback via `docker exec tapestry curl` (the `localTrusted` caller class) + host `fetch` for caller-class gate answers. TA pubkey resolved per-run via `/api/assistant/pubkey` — never hardcoded (`synthetic-ta` opaque string in U fixtures).
- **Fixtures (H3–H5):** three sentinel-named goals (`harness decomposition parent/child/adoptee goal`). Parent + adoptee ride the story-1 `create-element` contract (controlled json; the parent carries deliverable+boundary so AC 3 is provable live; the adoptee omits `capturedOn` so the d7 backfill is observable). The child rides `create-child-goal` itself. **The three legacy goals are never mutated** (adoption is irreversible in-contract). Teardown (run()'s `finally`, loud on failure): strfry delete by d-tag first, then Neo4j element+tags together, then a value-scoped orphan-tag sweep (d/name by exact value, json by the `harness-decomposition-` substring — never by z value, which is shared with the real goals), then strfry count-0 verify. Pre-clean runs the same routine best-effort at H3 start.
- **Prerequisites:** the d13 schema-extension step (one `save-schema` call, auto-reconciling under the d8 fold) is a one-time journaled operational act at implementation — **the suite never calls `save-schema`** (it would re-sign the schema node every run); H1 asserts the extension is live and fails until the step runs. H2+H1 together are the fold's live proof on this instance.
- Full `npm test` ≈ 24 min — background it (OPEN.md row 83). Row-75 hazard: a `+1 scan count` failure in relationship-primitives H8 / capture H4 means a router sync landed mid-bracket — quiesce `strfry-router`, rerun, restart it.

## Limits (explicit, for the Reviewer)

- No jsdom/Playwright coverage of the rendered tree: AC 4's visual behavior is source-asserted (S8) + the resolution truth is U-tested; the reviewer's in-container `vite build` remains the JSX compile gate (house gap-filler).
- S5 pins only a lexical trace of the d7 serialization (`mutex|serializ|writeChain|writeQueue`) — a race test would be flaky by nature; the Reviewer audits the mutex semantics in the diff.
- The live `ambiguous-slug` refusal is U-covered only (U7) — constructing a live duplicate slug requires an out-of-contract write; declined (fixture risk), mirroring story-2's declined throwaway-concept path.

## How to run

```
node test/break-a-goal-into-pieces.test.js
```

Full gate (~24 min — background it):

```
npm test
```

## Verification

The new tests fail with the current code, each for the right reason (missing exports, missing routes → `Cannot POST`, schema not extended, taxonomy kinds absent — never a typo or import error). Confirmed 2026-07-23 at commit `d7bd8b53` (stack up, so H rows ran live rather than skipping):

```
break-a-goal-into-pieces: 9 passed, 21 failed, 0 skipped
  (the 9 passes are exactly the documented pass-by-design sentinels:
   S1, S2, S11, S12, H2, H6, H7, R1, R2)
  FAIL U1 … src/lib/brain/goals.js does not export resolveDecomposition() yet
  FAIL U8 … src/lib/brain/hygiene.js must export classifyDecomposition() (ADR 0003 d9)
  FAIL U9 … got [{ …"kind":"property-record-drift"… }]   ← the row-85c split is a real behavior change
  FAIL S3 … POST /api/normalize/create-child-goal is not registered
  FAIL S9 … ui/src/pages/brain/GoalDetail.jsx does not exist yet
  FAIL H1 … schema extension not applied: …deliverable missing
  FAIL H3 … loopback POST /api/normalize/create-child-goal did not return JSON: Cannot POST …
  (fixture teardown ran clean; strfry count-0 verified)
```

Amended sibling suites, same commit — green on the pre-implementation side:

```
capture-a-goal-and-see-it:      27 passed, 0 failed, 0 skipped
structures-the-brain-can-trust: 24 passed, 0 failed, 0 skipped
```
