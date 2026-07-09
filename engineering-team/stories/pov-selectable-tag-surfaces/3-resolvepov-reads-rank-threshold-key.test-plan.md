# Test Plan: pov-selectable-tag-surfaces Story 3 — the POV rank threshold actually applies

**Story:** `engineering-team/stories/pov-selectable-tag-surfaces/3-resolvepov-reads-rank-threshold-key.md`
**Date:** 2026-07-09
**Test file:** `test/pov-rank-threshold-key.test.js`

## Strategy
`resolvePov` is CJS + injectable (the Story-2 seam), so the fix is covered by real behavioral units
over the exact prefs shapes — no filesystem, no Meili. One source-contract test guards the meili
proxy's duplicate re-derivation. A live cycle-local proves the end-to-end flip from unfiltered →
filtered.

## Coverage map
| Criterion | Test |
|---|---|
| saved threshold applies (`{enabled:true, cutoff:2}` → 2) | `B1` |
| disabled filter doesn't apply (`{enabled:false, cutoff:2}` → null) | `B2` |
| zero is a real threshold (`{enabled:true, cutoff:0}` → 0) | `B3` |
| no rank filter → null (unchanged) | `B4` |
| legacy `.min` honored (`{min:3}` → 3) | `B5` |
| present cutoff without explicit enabled → applies (`{cutoff:4}` → 4) | `B6` |
| meili tag-match uses the resolved threshold, not `.min` | `S1` (source-contract) |

## Manual / live
- **M1 (done 2026-07-09):** deployed to `localhost:7778`; the operator's own POV read
  (`wotPov=user&userPubkey=2efaa715…`, prefs `filters.rank={enabled:true,cutoff:2}`) went from
  `{mode:unfiltered, minRank:null}` to **`{mode:filtered, minRank:2, scoresExist:true}`** — the POV
  now filters at rank ≥ 2 and the Story-2 banner clears. This is the acceptance proof.

## How to run
```
node test/pov-rank-threshold-key.test.js
```

## Verification
Failing pre-fix: **3 passed, 4 failed** (B1/B3/B6 — cutoff not read; S1 — proxy still read `.min`).
B2/B4/B5 passed pre-fix (disabled/no-filter/legacy-min already yielded the right answer). Post-fix:
**7/7**, with Story-1 (17/17) and Story-2 (21/21) suites unregressed.
