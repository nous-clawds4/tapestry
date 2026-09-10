# Test Plan: Story 7 — Regenerating a Treasure Map preserves every entry the generator does not own

**Story:** `engineering-team/stories/dlist-curation/7-treasure-map-merge-preserve.md`
**ADR:** — (Bug lane; Architecture skipped at the story gate — the story's Design note is the design)
**Date:** 2026-09-10

## Coverage map

Suite: `test/dlist-curation-merge-preserve.test.js` — stack-free. The shared library is required
directly (it is zero-require by design); the current-Map fetch is driven through injected seams
(`scanLocal`, `fetchFromRelays`, `relays`); the two generators are checked structurally.
Registered in `test/test.js` (require, run, results line, overall verdict, skip aggregate).

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 preserved verbatim, in order; old rows dropped | U3 · U6 (copies, no mutation, malformed kept) | `test/dlist-curation-merge-preserve.test.js` | unit |
| AC-2 the eleven fresh rows, placed where the old block began | U1 (the metric list and the row builder) · U3 (index 0) · U4 (after preceding kept tags) · U5 (first when none) | same | unit |
| AC-3 no current Map | U2 · U7 (the template with no Map) · U8 (`where: 'none'` is not an error) | same | unit |
| AC-4 replaceable-event rules | U7 (`max(now, old+1)`, content preserved, unsigned) | same | unit |
| AC-5 lookup order and errors | U8 (local first, relays not asked; relays on miss, newest wins; same filter) · U9 (a scan or relay error rejects with a plain message) · S1 (API 503) · S2 (CLI exits 1) · S3 (default seams + relays) | same | unit + structure |
| AC-6 both generators, one rule | S1 · S2 (both require the shared modules; the eleven-row literal gone) · S3 | same | structure |
| AC-7 the response tells the truth | U3/U7 (counts) · S1 (`preserved` / `regenerated` / `currentMap` in the response) · S2 (the CLI prints the counts) | same | unit + structure |
| AC-8 nothing else moves | R1 the publish half never merges and still verifies signatures · R2 story 4's seams · R3 the three routes · R4 the metric names unchanged | same | structure |

**AC→handle lines:** AC-1 → U3, U6 · AC-2 → U1, U3, U4, U5 · AC-3 → U2, U7, U8 · AC-4 → U7 ·
AC-5 → U8, U9, S1, S2, S3 · AC-6 → S1, S2, S3 · AC-7 → U3, U7, S1, S2 · AC-8 → R1, R2, R3, R4.

## Edge cases

Not derivable from any single criterion:

- [x] **E1 — preserved tags precede the old block** (U4): the fresh block lands at the first old
      `30382:*` row's index, not at the top.
- [x] **E2 — no old block at all** (U5): fresh block first.
- [x] **E3 — malformed tags kept as found** (U6): the story scopes validation out; a stray string
      survives the merge untouched.
- [x] **E4 — no mutation** (U6): the current Map object is never altered; preserved tags are copies.
- [x] **E5 — clock skew** (U7): a future-dated current Map still yields a strictly later template.
- [x] **E6 — the three lookup outcomes are distinct** (U8/U9): local hit, relay hit (newest of
      several), none — versus an *error*, which must refuse rather than fall through to "none".
- [x] **E7 — relays are not consulted when local has the Map** (U8): one seam call, not two.
- [ ] **Not covered — a live regeneration.** It would write a template file (CLI) or answer a real
      session (API); the legacy pages that call these endpoints need NIP-07 to sign. The Reviewer
      may exercise the API handler live with a mocked session only if a safe posture exists; the
      unit seams are the proof here.
- [ ] **Not applicable — Concept Graph API:** no concept behaviour changes.

## Test infrastructure
- Test framework: Node's built-in runner (`node test/test.js`).
- Concept Graph API / strfry / relays: not exercised — the fetch's seams are injected.
- Firmware state: none required.
- Fixtures: inline — synthetic pubkeys, synthetic kind-10040 events, the pinned eleven metric names
  (today's order, read from both generators when the story was planned).

## How to run

Full suite:
```
npm test
```

Story-scoped gate (this suite plus the four guards: story 4's module whose seams are reused, the
NIP-85 router preset, the publish gate, and the default-deny middleware the routes sit behind):
```
node -e "Promise.all(['./test/dlist-curation-merge-preserve.test.js','./test/dlist-curation-header-endpoint.test.js','./test/treasure-maps-router-preset.test.js','./test/global-publish-gate.test.js','./test/default-deny-mutations.test.js'].map(p=>require(p).run())).then(rs=>{const f=rs.reduce((s,r)=>s+r.fail,0);console.log('TOTAL_FAIL='+f);process.exit(f?1:0)})"
```

## Verification
The new tests fail with the current code — the U class because neither `src/lib/treasureMapMerge.js`
nor `src/api/export/nip85/currentMap.js` exists, the S class because both generators still carry
the inline eleven-row literal and neither fetches the current Map. The four sentinels pass; the four
guards are green. Confirmed on 2026-09-10 at commit 7c0225c4 (working tree = that commit plus this
suite and its runner registration):

```
=== NEW SUITE (expect U/S failing, R passing) ===
  ✗ U1: the library loads with no requires, and builds exactly today's eleven rows
      src/lib/treasureMapMerge.js must load: Cannot find module
  ✗ U2: merge with no current Map → the fresh rows only (AC-3)
      src/lib/treasureMapMerge.js must load: Cannot find module
  ✗ U3: merge preserves every non-30382 tag verbatim and in order, drops the old 30382 rows, places the fresh block where the old block began
      src/lib/treasureMapMerge.js must load: Cannot find module
  ✗ U4: the fresh block lands where the first old 30382 row stood, even when preserved tags precede it
      src/lib/treasureMapMerge.js must load: Cannot find module
  ✗ U5: a current Map with no 30382 rows → the fresh block first, then everything preserved
      src/lib/treasureMapMerge.js must load: Cannot find module
  ✗ U6: preserved tags are copies (the current Map is never mutated), and malformed tags are kept as found
      src/lib/treasureMapMerge.js must load: Cannot find module
  ✗ U7: restamp + template — created_at strictly past the old Map even under skew, content preserved, unsigned
      src/lib/treasureMapMerge.js must load: Cannot find module
  ✗ U8: fetchCurrentMap — local first (relays not asked), then relays only when absent locally, newest wins, none is not an error
      src/api/export/nip85/currentMap.js must load: Cannot find module
  ✗ U9: fetchCurrentMap — a lookup ERROR rejects with a plain message (never regenerate blind)
      src/api/export/nip85/currentMap.js must load: Cannot find module
  ✗ S1: the API generator fetches the current Map, builds through the shared template, reports the merge, and refuses on a lookup error
      AC-6: the API generator requires the shared lib and the current-Map fetch
  ✗ S2: the CLI generator does the same and exits non-zero on a lookup error
      AC-6: the CLI requires the shared lib and the current-Map fetch
  ✗ S3: the current-Map fetch defaults to story 4's exported seams and the export flow's relays
      Design note: default seams = src/api/dlist-curation scanLocal / fetchFromRelays
  ✓ R1: the publish half is untouched — it forwards an already-signed event and never merges
  ✓ R2: story 4's module still exports the two seams
  ✓ R3: the three NIP-85 routes are still registered
  ✓ R4: the eleven metric names are unchanged wherever they are defined (generator before, library after)
RESULT {"pass":4,"fail":12,"skipped":0}
=== GUARDS ===
dlist-curation-header-endpoint → {"pass":28,"fail":0,"skipped":0}
treasure-maps-router-preset → {"pass":5,"fail":0}
global-publish-gate → {"pass":8,"fail":0,"failures":[]}
default-deny-mutations → {"pass":14,"fail":0,"failures":[],"skipped":0}
GUARD_TOTAL_FAIL=0
```
