# Story 3: The POV rank threshold actually applies (resolvePov reads the stored key)

**Status:** Done
**Created:** 2026-07-09
**Type:** Bug (correctness — Story-1 completeness)
**Provenance:** Live-found 2026-07-09 during Story-2 testing. The operator selected "My WoT" with a
saved **rank ≥ 2** filter, but tag surfaces counted everyone; the Story-2 `povResolution` signal
exposed `minRank: null` despite a resolved own-delegate (`delegateSource: 'user-prefs'`,
`povSuffix: '34a42fb9'`). Root cause below.

## Background / root cause
`resolvePov` (`src/api/_shared/pov.js:75`) derives the trust threshold as:
```
const minRankRaw = filters?.rank?.min;   // ← reads .min
```
But the Search Preferences settings page persists the threshold under a **different shape** —
verified in the live user-prefs file:
```
filters: { rank: { enabled: true, cutoff: 2 }, followers: { enabled: false, cutoff: 0 } }
```
The stored key is **`filters.rank.cutoff`** (gated by `enabled`); **nothing in the codebase writes
`filters.rank.min`.** So `minRank` is **always `null`** for a real user/house config → the
`wotFiltering` guard (`!!povSuffix && Number.isFinite(minRank)`) is always false → every POV-aware
tag read **counts everyone**, even when the user has a delegate *and* a saved threshold.

**Why it stayed hidden:** before Story 1 the tag stacks were house/login-binary and this instance's
house prefs were empty, so `minRank` being null looked like "no config." Story 1 threaded the real
user POV; Story 2's disclosure made the always-unfiltered result *visible*. Profile **search** kept
working because the meili proxy's *profile* filter path passes the whole `{enabled, cutoff}` object
to Meili (`src/api/search/profiles/meili/index.js:154-166`) — it never used `.min`. But the meili
proxy's **tag-match** path (`:185`, `filters?.rank?.min`) has the same bug as `resolvePov`.

This is a **filtering-correctness** bug (it changes what counts), distinct from Story 2 (disclosure
only) — hence its own story. It completes Story 1: the selected POV must actually *apply* its
threshold, not just be threaded.

## User-facing description
As someone who has set a trust-rank threshold for my point of view (e.g. rank ≥ 2), when I view any
tag surface under that POV, I want the counts to actually **exclude authors below my threshold** —
the same filtering my search already does — so my POV means the same thing everywhere.

## Acceptance criteria
Testable from the outside (a prefs `filters` shape is the input; the resolved `minRank` / whether a
read filters is the output).

- [ ] **The saved threshold applies.** Given a prefs `filters.rank = { enabled: true, cutoff: 2 }`,
  when `resolvePov` runs for that POV, then `minRank === 2` (and the read filters — `mode: 'filtered'`
  when scores exist).

- [ ] **A disabled rank filter does not filter.** Given `filters.rank = { enabled: false, cutoff: 2 }`,
  then `minRank === null` (the user turned the filter off — unfiltered, honestly).

- [ ] **A zero threshold is a real threshold, not "unset".** Given `filters.rank = { enabled: true,
  cutoff: 0 }`, then `minRank === 0` (≥0 is a valid floor; `Number.isFinite(0)` is true, so it filters).

- [ ] **No rank filter → no threshold.** Given prefs with no `filters.rank` (or no `filters`), then
  `minRank === null` — unchanged from today (strict superset for the genuinely-unconfigured case).

- [ ] **Legacy `.min` still honored.** Given a prefs `filters.rank = { min: 3 }` (should any old
  config carry it), then `minRank === 3` — the fix adds `cutoff` as the primary source without
  dropping a `.min` that happens to exist.

- [ ] **Search tag-match uses the same resolved threshold.** Given the meili proxy serves a tag-match
  under a POV with a saved `cutoff`, then it filters tag-match by that threshold (not the phantom
  `.min`), consistent with the tag stacks.

## Approach (obvious-bug — no separate ADR)
- `src/api/_shared/pov.js`: derive `minRank` from the rank filter's **`cutoff`** when the filter is
  enabled (`enabled !== false`) and `cutoff` is finite; fall back to a finite legacy `.min`; else
  `null`. The five return fields' other four are unchanged.
- `src/api/search/profiles/meili/index.js`: the tag-match call should use the **`minRank` now
  returned by `resolvePovWithStatus`** (already destructured alongside `povSuffix`/`filters`) instead
  of re-deriving `filters?.rank?.min`.
- No response-shape change; no write-path change; no firmware. `povResolution` automatically becomes
  more accurate (mode flips to `filtered` where a real threshold now resolves).

## Out of scope
- The Story-2 disclosure wording (its own follow-up — the "no delegate" vs "no threshold" split).
- Changing the settings-page shape or migrating prefs (the fix reads the shape that already exists).
- Defaulting a delegate to a nonzero floor when the user set none (a product decision, deferred).

## Linked artifacts
- ADR: none (obvious bug; approach captured above).
- Test plan: `engineering-team/stories/pov-selectable-tag-surfaces/3-resolvepov-reads-rank-threshold-key.test-plan.md`
- Tests: `test/pov-rank-threshold-key.test.js`
- Review: `engineering-team/reviews/pov-selectable-tag-surfaces/3-resolvepov-reads-rank-threshold-key.md` (PASS)
