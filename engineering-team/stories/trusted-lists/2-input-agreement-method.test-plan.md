# Test Plan: Story 2 — Weighted-sum membership method (rung 2)

**Story:** `engineering-team/stories/trusted-lists/2-input-agreement-method.md`
**ADR:** `engineering-team/decisions/trusted-lists/0002-weighted-sum-method.md`
**Date:** 2026-08-27

## Coverage map

| Criterion | Test | Level |
|---|---|---|
| Method selectable (registry) | `U1 IMPLEMENTED_METHOD_IDS === ['count','input']` | unit |
| Method selectable (resolver) | `U2 settings 'input' → 'input'`, `U3 'certainty' still → 'count'` | unit |
| Method selectable (UI) | `S1 TrustDetermination 'input' entry available, label "Weighted sum"` | source |
| Validation kit exists | `S2 scripts/tl-ladder-validate.js present, carries the scenario table` | source |
| Local-only | `L0 GUARD publish policy (hard FAIL if external)` | live |
| No-POV fallback | `LA input selected + unfiltered stack → TL records 'count', no scores` | live |
| Wire records method; score on TL; known-values; membership/ordering/counts unchanged | `LB seeded-POV known-value matrix (scenarios A–F, one tag, one pin)` | live |
| Count still works | `LC switch back to 'count' → Story-1 shape restored` | live |

## Known-value matrix (live LB — single tag, single pin cutoff 1, house POV seeded by the suite)

| Target | Taggings (rank@vote) | expected score |
|---|---|---|
| A | 100@apply | `1` |
| B | 3@apply ×10 | `0.3` |
| C | 90@apply ×2 | `1.8` |
| D | 80@apply, 40@dispute | `0.4` |
| E | 40@apply ×2, 80@dispute | `0` (equal-weight split — ADR point 6) |
| F | 3@apply ×2, 90@dispute | `-0.84` (dispute dominance, negative visible) |

Assertions per member: p-tag `["p", pk, "", "<score>"]` string; content-JSON `score` number;
endorsements/disputes counts unchanged; member set identical to count predicate; order =
endorsements desc, pubkey asc. TL carries `["membership-method","input"]`.

## Edge cases

- [x] Valid-but-unimplemented id (`certainty`) still fail-safes to count (U3).
- [x] Unfiltered stack (no house POV) → weighted method degrades to count, wire records the
      truth (LA — note: this test passes pre-implementation too, since the resolver's
      not-implemented fallback is observationally identical; it is a guard pinning the
      *post*-implementation fallback path, like Story 1's L0/L3).
- [x] Score 0 and negative scores actually publish (E, F — `score != null` path).
- [x] Float noise: B and D expectations are exact under the ADR's round6.
- [ ] `includeScoreInTL` collision (ADR point 3): LB's pin sets `includeScoreInTL: false`;
      a dedicated sub-assert in LB re-checks that no member's score equals their raw
      wot_rank by accident (D's 0.4 ≠ rank 80 etc. — implicit). Full reconciliation is
      rung 4's.

## Test infrastructure

- Suite `test/tl-weighted-sum-method.test.js`, registered in `test/test.js`.
- **Settings mutation via docker exec** (new for this machine-class: the settings volume is
  in-container; host-path writes — the older suites' technique — are impossible here).
  The suite snapshots `/var/lib/brainstorm/settings.json` at start and restores it byte-exact
  in teardown, including after failures. Skips the live layer if docker/container absent.
- House POV seeded by the suite: `grapevine.searchPreferences.delegatedPubkey` = fixed dev
  hex, `filters.rank {enabled: true, cutoff: 3}` (rank-3 taggers pass the inclusive gate).
  Rank docs upserted straight to Meili (`{id, pubkey, name, wot_rank_<suffix>}`), polled
  until indexed (bounded; on timeout → skip with reason, livePov convention).
- Ephemeral keys via `nak`; publish via `/api/strfry/publish`; refresh via docker-exec
  loopback (in-container `:7778`, unaffected by host remaps); readback via `strfry scan`.
- This machine: run with `BRAINSTORM_BASE_URL=http://localhost:8778` (panel remap).

## How to run

```
BRAINSTORM_BASE_URL=http://localhost:8778 node -e \
  "require('./test/tl-weighted-sum-method.test.js').run().then(r=>process.exit(r.fail?1:0))"
```

## Verification

The new tests fail with the current code. Confirmed on 2026-08-27 (live layer against the
running stack at :8778; the docker-exec settings snapshot/restore verified working):

```
▶ tl-weighted-sum-method suite (trusted-lists Story 2)
  ✗ U1 IMPLEMENTED_METHOD_IDS is ["count","input"] — got ["count"]
  ✗ U2 resolver: settings "input" → "input" — got "count"
  ✓ U3 resolver: "certainty" still fail-safes to "count"          (guard)
  ✗ S1 UI: "input" option enabled with Weighted-sum label
  ✗ S2 validation kit exists (scripts/tl-ladder-validate.js missing)
  ✓ L0 GUARD publish policy is local-only                          (guard)
  ✓ LA no-POV fallback publishes as count                          (guard — pre-passes; see plan)
  ✗ LB seeded-POV known-value matrix
      TL must record membership-method "input" — got "count"
  ✓ LC switching back to count restores Story-1 output shape       (guard)
  (settings.json restored to pre-suite state)
  tl-weighted-sum-method: 4 passed, 5 failed, 0 skipped
```

LB is the meaningful failure: the entire live fixture machinery ran (house POV seeded, rank
docs indexed, ~25 events published, refresh executed, TL found, settings restored) and the
assertion that fails is exactly "the weighted method does not exist yet."
