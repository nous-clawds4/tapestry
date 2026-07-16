# Test Plan: tag-applicability Story 2 — type-aware picker + scheduled TL regen

**Story:** `engineering-team/stories/tag-applicability/2-type-aware-picker-and-scheduled-regen.md`
**ADR:** `engineering-team/decisions/tag-applicability/0002-type-aware-picker-and-scheduled-regen.md`
**Date:** 2026-07-06

## Test level decision

- **Executes the live-compute core (P):** the picker's membership logic is a pure-ish
  `applicabilityMembers({type, viewerPubkey, deps})` in `refreshApplicabilityLists.js` (reusing
  Story-1 `buildMembers`). The suite drives it with an injected `computeUsageRows` spy + a
  filter-dispatching `scanStrfry` fake — HINT ∪ USAGE union, `type→byType` mapping, viewer-inclusive
  wiring, member shape, ordering, dedup — no live strfry/meili.
- **Source sentinels (S/U/SCH):** the event-tags handler + route + `computeTagUsageRows.alsoTrust`;
  the hook + AddTagDialog browse-filter-vs-search-all + the two mounts; the task registry entry + `.sh`.

## Coverage map

| Criterion (story AC) | Test(s) | Level |
|---|---|---|
| Type-relevant tags shown (browse) | P1/P2 (usage→correct context), P3 (hint cold-start), U2 (browse hard-filtered to `applicableKeys`), U5 (mounts pass type) | exec + sentinel |
| Fallback when list unavailable | N/A by design — the picker computes **live** (never depends on the published list); an absent/empty result degrades gracefully (U4) | — |
| **Full search always reachable (hard req)** | **U3** (search branch spans ALL `availableTags`, never gated by `applicableKeys`) | sentinel (guard) |
| All surfaces | U5 (the two AddTagDialog mounts — scope ratified to two contexts; the target-selector modals are not tag pickers) | sentinel |
| Scheduled regeneration | SCH1 (class-less `refreshApplicabilityLists` registry entry), SCH2 (`.sh` curls the loopback endpoint) | sentinel |
| No regression | U3/U4 (search + non-blank browse preserved); additive endpoint/hook/prop | sentinel |

Supporting: P5 (viewer-inclusive → immediate graduation), P6 (shape + ordering), P4 (dedup),
S1–S3 (handler/route/`alsoTrust`).

## Edge cases
- [x] Live + viewer-inclusive → a just-applied tag graduates into browse (P5 wires `alsoTrust=viewer`).
- [x] `type='pubkey'` reads `byType.profile`; `'event'` reads `byType.event` (P1/P2).
- [x] Hint-only cold-start tag surfaces (P3); hint∪usage dedup (P4).
- [x] **Search escape preserved** — the `applicableKeys` hard-filter applies to browse ONLY; typing
  reaches every tag so a cross-context `funny` is picked, not re-minted (U3 — the anti-re-mint guard).
- [x] Absent/empty `applicableKeys` → browse falls back, never blanks (U4).
- [x] Scheduler task is class-less (skips neo4j-heavy semaphore) and not `continuous` (SCH1).

## Note for the Implementer (seam)
`applicabilityMembers({ type, viewerPubkey, deps })` lives in `refreshApplicabilityLists.js`
(co-located with `buildMembers`, the shared union). `deps = { computeUsageRows({wotPov,alsoTrust}),
scanStrfry(filter) }`; returns `{ type, viewerIncluded, members:[{authorPubkey, slug, applications}] }`
(parse `buildMembers`' `a`-coordinates → author+slug). `handleTagApplicability` (in `event-tags`)
wires real deps (`computeTagUsageRows` + the local scan), validates `type`, threads
`viewerPubkey→alsoTrust`. Extend `computeTagUsageRows({…, alsoTrust})` so the trust predicate returns
true for `alsoTrust` unconditionally.

## How to run
```
npm test
# or: node -e "require('./test/tag-applicability-picker.test.js').run()"
```

## Verification

New tests fail against current code for the right reasons (module/endpoint/hook/dialog/task absent);
the one safety guard (U3) already passes and must STAY passing. Confirmed 2026-07-06 at commit
`35dec29f` (15 fail / 1 pass):

```
✗ P1..P6  applicabilityMembers — live HINT∪USAGE, type→byType, viewer-inclusive, shape, ordering, dedup
✗ S1..S3  handleTagApplicability + /api/tags/applicability route + computeTagUsageRows alsoTrust
✗ U1      useTagApplicability(type,viewer) → applicableKeys
✗ U2      AddTagDialog browse hard-filtered to applicableKeys
✓ U3      SAFETY: search still spans ALL availableTags (the anti-re-mint escape) — guard, stays green
✗ U4      absent applicableKeys ⇒ browse not blanked
✗ U5      the two mounts wire type + applicableKeys
✗ SCH1/2  scheduled refreshApplicabilityLists task + loopback-curl .sh
=> picker pass: 1 fail: 15
```

No shipped-suite edits needed — Story 2 is additive (new endpoint/hook/task + an optional
AddTagDialog prop; the query-branch search behavior is unchanged).
