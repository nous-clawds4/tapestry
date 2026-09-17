# Test Plan: Story 4 — Attach the world (pointers and the goal's page)

**Story:** `engineering-team/stories/second-brain/4-attach-the-world.md`
**ADR:** `engineering-team/decisions/second-brain/0004-external-resource-pointers-and-one-spine-detail.md`
**Date:** 2026-07-23

## Coverage map

Suite: `test/attach-the-world.test.js` (29 tests: 5 U, 14 S, 8 H, 2 R). Classes per test-hermeticity-ci/0001 — U executed stack-free (always gates CI), S source assertions, H live local stack (per-test SKIP when absent), R regression sentinels.

| Criterion | Tests | Level |
|---|---|---|
| AC 1 — attach a resource (kind, locator, title; why-kept/keywords optional); missing → refused; no content migrates | U2 (parse round-trip of the record fields), S1 (route/gate/`attached`+`goal-not-found`+`unknown-kind`+`resource-exists`), H1 (live attach round-trip), H4 (refusal matrix + pointer-snapshot equality = nothing written) | unit + source + integration |
| AC 2 — pointer card: kind marker, title, locator preview, freshness line verbatim, why-kept | U2/U4 (title + freshness inputs + `freshnessDays`), S6 (freshness wording byte-exact, empty state, the five kind markers), H2 (live read-back with kind + title), H6 (pointerCount on the tree) | unit + source + integration |
| AC 3 — open native, never embed | S6 (`target="_blank" rel="noopener…"`; no iframe/embed/object/innerHTML) | source |
| AC 4 — freshness derived; verifying updates it; asserted, no egress | U3 (derivation matrix: unreachable wins, age boundary at `STALE_AFTER_DAYS`, missing-date tolerance), S2 (verify route/gate/results + **no-egress guard**), H3 (live verify flips freshness unreachable↔current) | unit + source + integration |
| AC 5 — one-spine detail (intent + pointers + record entries) | U5 (group-by-goal), S5/S9 (per-goal endpoint + the detail hook), H2/H5 (live: the spine returns `goal` + `pointers` + `records:[]`; unknown slug → `goal:null`) | unit + source + integration |
| AC 6 — record entries append-only, no edit affordance | S7 (no input/textarea/form/contentEditable/edit-delete handler on the detail page) | source |
| AC 7 — copy discipline & no regression | S8 (jargon scan on the new strings, kind markers the sanctioned exception), S12/S13 (brain read-only, no 64-hex), H7 (hygiene green after the concept lands), the amended sibling re-pins (below) | source + integration |

ADR-pin rows beyond the ACs: S3 (self-bootstrap `ensureResourceConcept` via create-concept + save-schema), S4 (writes reuse `serializeGoalWrite`, not renamed), S10 (tree pointer count), S11 (brain import surface re-pinned to **six** — requires `lib/brain/resources`), S14 (ADR-0003 `Amended by` pointer), H8 (host-side caller-class 401s), R1/R2 (read surfaces + untouchables + `PUBLIC_MUTATIONS` untouched).

**Pass-by-design sentinels** (pass before AND after implementation — they pin invariants, story-2/3 precedent): **S4** (the mutex `serializeGoalWrite` already exists; the per-handler check defers to S1/S2 for handler existence), **S7** (the story-3 detail page is already write-affordance-free — this pins it stays so as the sections grow), **S8** (the current strings are already jargon-clean — this activates when the new strings land), **S12, S13, S14, H7, H8, R1, R2**. Ten passes pre-implementation; the other nineteen fail until the feature lands.

## Sibling-suite amendments (executed here — the Tester's lane, per the story-2/3 lesson and the ADR template rule)

All three are the **brain-import-surface re-pin** widened by exactly one entry (`/lib\/brain\/resources$/`), so they stay **green on both sides** of the implementation (a pre-#4 module has five requires — all allowed; a post-#4 module six — all allowed). The failing-first "the module must *require* resources" assertion lives in the **story-4 suite (S11)**, not in the siblings.

1. **story-1 S2** (`test/capture-a-goal-and-see-it.test.js`) — allowed list + message now admit `lib/brain/resources`.
2. **story-2 S3** (`test/structures-the-brain-can-trust.test.js`) — same widening.
3. **story-3 S1** (`test/break-a-goal-into-pieces.test.js`) — same widening; test name updated from "the same five … nothing new" to "the story-3 five plus lib/brain/resources, nothing else".

**Not amended, verified deliberately:** story-3 **S9** (its GoalDetail jargon scan checks `superset/pubkey/payload/concept header/acceptance criteria/lease` — none of which the new strings contain, so it stays green; the story-4 **S8** adds the scan over the *new* strings, excluding the sanctioned `event` kind marker); story-1 S5b / story-3 S8 (Goals.jsx — the pointer-count text uses no toggle/switch vocabulary); the story-3 H fixture goals (never touched — the story-4 fixtures are their own sentinel family `harness-resource-*`).

## Runner registration

`test/test.js`, the standard five touches: require (top, epic comment), run call in `main()`, skip-aware summary line, **live `overallOk` chain term** (the severed terminator moved from the story-3 term onto the new `attachTheWorldResult` term; dead block untouched per OPEN.md #43), `totalSkipped` entry. Syntax-checked with `node --check` (clean).

## Edge cases

- [x] Non-resource / malformed json rows → `parseResourceRow` returns `null`, never throws (U2).
- [x] Freshness boundary: verified exactly `STALE_AFTER_DAYS` ago is still `current`; `+1` day is `stale`; an `unreachable` outcome overrides any recency; a missing last-verified date is `stale` (U3). Day math is deterministic via a fixed `NOW_MS` (U3/U4).
- [x] Duplicate (goal, locator) attach → `resource-exists` refusal, nothing written (H4). Cross-goal same locator is allowed by design (record-based, one goal per resource) — not exercised live (would need a second fixture goal; the identity rule is U-covered by the group-by-goal bucketing, U5).
- [x] Attach to a nonexistent goal / unknown kind / empty locator → named refusals (H4); verify a not-attached resource → `resource-not-found` (H4). Pointer-set snapshot equality proves refused writes change nothing (H4).
- [x] Unknown goal slug on the detail endpoint → `{success:true, goal:null}`, an empty state, not an error (H5).
- [x] The record section returns `records:[]` in story 4 (producers are stories 5–7) — the spine shape is pinned (H5); the append-only no-edit contract is source-asserted (S7).
- [x] Concept absent (fresh instance) → the read is tolerant (empty), and the first attach self-bootstraps the concept (H1); re-runs are idempotent (`ensureResourceConcept` no-ops when present).
- [x] Stack absent → every H row SKIPs (the house `stackAvailable` pattern); U/S/R always gate.

## Test infrastructure

- Framework: the house zero-dependency runner (`test(name, fn)` collector, `run()` export), registered in `node test/test.js`.
- Live API: loopback via `docker exec tapestry curl` (the `localTrusted` caller class) + host `fetch` for caller-class gate answers (H8). TA pubkey resolved per-run via `/api/assistant/pubkey` — never hardcoded (`synthetic-ta` opaque string in U fixtures).
- **Fixtures (H rows):** one sentinel-named host goal (`harness resource host goal`) created via the story-1 `create-element` contract, plus resources attached to it via `create-resource` (tracked by the uuid the response returns). **The three legacy goals are never mutated.** Teardown (run()'s `finally`, loud on failure): strfry delete by d-tag first (the goal's known d-tag + each created resource's d-tag, derived from its uuid), then Neo4j element+tags, then a value-scoped orphan-tag sweep (json `CONTAINS 'harness-resource-'` — never by z value, shared with the real concept headers), then strfry count-0 verify. Pre-clean runs the same routine best-effort. **The External Resource concept, once bootstrapped, persists** (it is the real feature concept; only fixture *elements* are torn down) — verified residue-free after the pre-implementation run (live goal count returned to the three legacy goals).
- **Prerequisites:** none beyond a running stack — the concept **self-bootstraps** on the first `create-resource` (ADR 0004 d8), so the suite is self-contained on any instance (unlike story 3's one-time journaled `save-schema` step).
- Full `npm test` ≈ 24 min — background it via the bounded `until grep -q "^Overall:" <log>; do sleep 15; done` waiter (OPEN.md rows 74/83). Row-75 hazard: a `+1 scan count` failure in relationship-primitives H8 / capture H4 means a router sync landed mid-bracket — quiesce `strfry-router`, rerun, restart it.

## Limits (explicit, for the Reviewer)

- No jsdom/Playwright coverage of the rendered pointer card / record section: AC 2/3/6's visual behavior is **source-asserted** (S6/S7/S8 — verbatim strings, open-native attributes, no-embed, no-edit-affordance); the reviewer's in-container `vite build` remains the JSX compile gate (house gap-filler).
- S4 pins only a lexical trace of the shared-mutex reuse (`serializeGoalWrite|mutex|serializ|writeChain|writeQueue`) — a race test would be flaky by nature; the Reviewer audits that both new handlers run their read-validate-write body inside the mutex.
- The **no-egress** guard (S2) is lexical (no `fetch(`/`http(s).get`/`.request(`/`node-fetch`/`axios`/`got`/`undici` in the verify handler slice) — a definitive "no packet left the host" assertion is out of scope; the Reviewer confirms the verify path only reads/writes the record.
- Cross-goal same-locator sharing (the design's "one goal per resource; the same locator may attach to two goals") is U-covered (the group-by-goal bucketing, U5) but not exercised live (a second live fixture goal would add teardown surface for little marginal proof).

## How to run

```
node test/attach-the-world.test.js
```

Full gate (~24 min — background it):

```
npm test
```

## Verification

The new tests fail with the current code, each for the right reason (missing core `require` / missing exports → "does not exist yet"; unregistered routes → `Cannot POST/GET`; absent hook / absent verbatim strings / missing `pointerCount` — never a typo or import error). Confirmed 2026-07-23 (stack up, so H rows ran live; fixture teardown clean, residue-free):

```
attach-the-world: 10 passed, 19 failed, 0 skipped
  (the 10 passes are the documented pass-by-design sentinels:
   S4, S7, S8, S12, S13, S14, H7, H8, R1, R2)
  FAIL U1 … src/lib/brain/resources.js does not exist yet (ADR 0004 d4)
  FAIL S1 … POST /api/normalize/create-resource is not registered (ADR 0004 d6)
  FAIL S2 … POST /api/normalize/verify-resource is not registered (ADR 0004 d7)
  FAIL S3 … ensureResourceConcept does not exist yet (ADR 0004 d8)
  FAIL S5 … the brain module must register GET /api/brain/goals/:slug (ADR 0004 d5)
  FAIL S6 … the freshness line must use the style guide's wording verbatim (AC 2)
  FAIL S9 … ui/src/hooks/useBrainGoalDetail.js does not exist yet (ADR 0004 d5/d10)
  FAIL S11 … the brain module must require ../../lib/brain/resources (ADR 0004 d4)
  FAIL H1 … loopback POST /api/normalize/create-resource → Cannot POST (route absent)
  FAIL H6 … every goal must carry a numeric pointerCount; got undefined (ADR 0004 d5/d10)
  (…19 fails total; fixture teardown ran clean, strfry count-0 verified)
```

Amended sibling suites, same day — green on the pre-implementation side (the re-pin admits the future sixth require without demanding it):

```
capture-a-goal-and-see-it:      27 passed, 0 failed, 0 skipped
structures-the-brain-can-trust: 24 passed, 0 failed, 0 skipped
break-a-goal-into-pieces:       30 passed, 0 failed, 0 skipped
```
