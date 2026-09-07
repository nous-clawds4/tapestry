# Test Plan: Story 3 — Certainty method (0–100) + fixture prune

**Story:** `engineering-team/stories/trusted-lists/3-certainty-method.md`
**ADR:** `engineering-team/decisions/trusted-lists/0003-certainty-method-and-prune.md`
**Date:** 2026-08-27

## Coverage map

| Criterion | Test | Level |
|---|---|---|
| Method selectable (registry/resolver) | `U1 IMPLEMENTED = [count,input,certainty]`, `U2 resolver certainty→certainty` | unit |
| Method selectable (UI) | `S1 certainty entry available:true, 0–100 blurb` | source |
| Kit covers certainty + prunes | `S2 kit expectation ×100 + pre-seed prune; prune script exists` | source |
| Local-only | `L0 GUARD publish policy` | live |
| Fixture prune works | `LP prune → zero fixture-prefixed 39999/3039x events remain; runs before seeding (speed)` | live |
| Wire + score + known-values + invariants | `LB seeded-POV matrix under certainty (×100 expectations computed by the same JS expression as the impl — float-exact)` | live |

Known-values (same matrix as Story 2): A→50, B→(1−0.5^0.3)×100, C→(1−0.5^1.8)×100,
D→⅓×(1−0.5^1.2)×100, E→0, F→negative. Membership/order/counts assertions identical to
Story 2's LB (count predicate until rung 4).

## Infrastructure

Same as Story 2's suite: docker-exec settings snapshot/restore (pin POV+method per phase),
Meili rank seeding with bounded wait, nak keys, loopback refresh, strfry readback. LP runs
FIRST so LB's refresh is fast. **Serialization rule** (review #2 finding): nothing else may
run refresh-all concurrently; killed runs poison the next.

## How to run

```
BRAINSTORM_BASE_URL=http://localhost:8778 node -e \
  "require('./test/tl-certainty-method.test.js').run().then(r=>process.exit(r.fail?1:0))"
```

## Verification

Failing output, first run, pre-implementation (2026-08-27, live stack :8778):

```
✗ U1 IMPLEMENTED_METHOD_IDS is ["count","input","certainty"]   (got 2 methods)
✗ U2 resolver: settings "certainty" → "certainty"              (got "count")
✗ S1 UI: certainty option enabled with 0–100 blurb             (available: false)
✗ S2 prune script exists…                                      (MODULE_NOT_FOUND)
✓ L0 GUARD publish policy is local-only
✗ LP prune removes all fixture-prefixed events                 (script missing)
✗ LB certainty known-value matrix
    TL must record membership-method "certainty" — got "count", expected "certainty"
tl-certainty-method: 1 passed, 6 failed, 0 skipped
```

LB ran the full live pipeline and failed exactly on the method not existing. Implementation
was authored concurrently in the worktree (delegated single-session cycle); the failing run
executed against the pre-implementation module state, as the U/S failures show.
