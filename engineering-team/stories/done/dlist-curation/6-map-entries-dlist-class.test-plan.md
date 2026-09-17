# Test Plan: Story 6 — Map Entries: classify, label, verify, and link per-DList curation entries

**Story:** `engineering-team/stories/dlist-curation/6-map-entries-dlist-class.md`
**ADR:** `engineering-team/decisions/dlist-curation/0006-map-entries-dlist-class.md`
**Date:** 2026-09-10

## Coverage map

Suite: `test/dlist-curation-map-entries.test.js` — the house three-class pattern (U behavioral via
ESM import of `ui/src/utils/treasureMap.js`; S source-structure over the panel and the detail route;
R sentinels that pass before and after). Registered in `test/test.js` (require, run, results line,
overall verdict, skip aggregate).

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 classification | U1 named 39998/39999 → `dlist` (kind, name with colons, lowercased pubkey, relay) · U2 `39998:dlist-header` → `designation`, 39999 not reserved · U3 bare kinds / delegate-less / TA / TL / edges / garbage unchanged (the story-2 pins restated) | `test/dlist-curation-map-entries.test.js` | unit |
| AC-2 the row | S1 labels "Curated DList" / "TA designation" · S3 inline short pubkey on curated rows ("external · ") · R1 existing labels intact | same | structure |
| AC-3 the header, verified | U5 communityPointerOf (a-tag form, pointer default, sentinel skipped, event-id / malformed / none → null) · U6 describeHeaderLookup (found local / relay; both warning texts) · S2 queryRelay first, `/api/relay/external` with `relays=` for the hint, one effect · S3 link by encoded coordinate, "inherits from" · S4 the route resolves 39999/9999 | same | unit + structure |
| AC-4 duplicates | U4 markDuplicateEntries (first wins across dlist rows; 39999:dogs distinct; TL rows untouched; empty/non-array) · S3 "duplicate — ignored" pill, `row.duplicate` | same | unit + structure |
| AC-5 baseline | S1 useAuth + assistantPubkey, no taPubkey, no 64-hex | same | structure |
| AC-6 nothing else moves | U3 · S4 (39998/9998 and event-id branches remain; colons rejoined) · R1 labels + profile fetch · R2 the two neighbouring panels · R3 page order · R4 util exports; guard suite `tl-treasure-map-panel` (story 2's own pins) | same | unit + structure |

**AC→handle lines:** AC-1 → U1, U2, U3 · AC-2 → S1, S3, R1 · AC-3 → U5, U6, S2, S3, S4 · AC-4 → U4, S3 ·
AC-5 → S1 · AC-6 → U3, S4, R1, R2, R3, R4 (+ guard `tl-treasure-map-panel`).

## Edge cases

Not derivable from any single criterion:

- [x] **E1 — the reserved word is kind-scoped** (U2): `39999:dlist-header` is a Curated DList; only
      `39998:dlist-header` is the designation (the draft reserves the word for the blanket entry).
- [x] **E2 — a delegate-less designation row is nothing** (U3): `39998:dlist-header` with an invalid
      pubkey → `other` (story 2's demotion rule applies to the new classes too).
- [x] **E3 — colons in d-tags** (U1): `39998:a:b` → name `a:b`.
- [x] **E4 — duplicates are per raw first element across curated rows** (U4): `39998:dogs` twice →
      the second is a duplicate; `39999:dogs` is a different entry; a repeated TL row is not marked.
- [x] **E5 — the sentinel is skipped, not a pointer** (U5): `["b","b-tag-deferred"]` followed by an
      a-tag `b` yields the a-tag; sentinel-only → null.
- [x] **E6 — an event-id `b` is not a community pointer** (U5): only the a-tag form counts.
- [x] **E7 — the two warning texts** (U6): with a hint, "not found locally or on <relay>"; without,
      "not found locally; no relay hint".
- [x] **Sentinel by construction** (U3): passes today and must keep passing — it is the story-2
      contract restated where the classifier changes.
- [ ] **Not covered — the rendered details line, the relay round-trip, and the 39999 link in a
      browser.** The reviewer's Playwright-with-`page.route` method (auth, the 10040 scan with
      curated rows including a duplicate and a 39999 row, the local 39998 scan hit and miss, the
      relay fetch) covers it; no NIP-07 is needed for these render paths.
- [ ] **Not applicable — Concept Graph API:** no concept behaviour changes.

## Test infrastructure
- Test framework: Node's built-in runner (`node test/test.js`); no Playwright half for this story.
- Concept Graph API / relays / DOM: not exercised.
- Firmware state: none required.
- Fixtures: inline — two synthetic 64-hex pubkeys, synthetic tag lists, a synthetic community
  coordinate.

## How to run

Full suite:
```
npm test
```

Story-scoped gate (this suite plus the five guards that pin the classifier's existing behavior, the
panel summary, the two neighbouring panels, and the page order):
```
node -e "Promise.all(['./test/dlist-curation-map-entries.test.js','./test/tl-treasure-map-panel.test.js','./test/treasure-map-panel-summary.test.js','./test/dlist-curation-panel.test.js','./test/dlist-curation-tl-panel.test.js','./test/tl-treasure-map-optin-publish.test.js'].map(p=>require(p).run())).then(rs=>{const f=rs.reduce((s,r)=>s+r.fail,0);console.log('TOTAL_FAIL='+f);process.exit(f?1:0)})"
```

## Verification
The new tests fail with the current code — the classifier tests because the two classes do not
exist (the util loads; U3 and R4 exercise its existing exports), the helper tests because the three
exports do not exist, the S class on the missing labels, lookup, details line, and route prefixes.
The story-2 restatement and the four sentinels pass; the five guards are green. Confirmed on
2026-09-10 at commit 50051353 (working tree = that commit plus this suite and its runner registration):

```
=== NEW SUITE (expect U/S failing, R passing) ===
  ✗ U1: classifyEntry — a named 39998/39999 entry with a valid delegate is a Curated DList
      AC-1: 39998:dogs → dlist; got {"raw":"39998:dogs","kind":39998,"name":"dogs","cls":"other","pubkey":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
  ✗ U2: classifyEntry — 39998:dlist-header is the TA designation, never a Curated DList
      AC-1: the blanket designation entry → designation; got {"raw":"39998:dlist-header","kind":39998,"name":"dlist-header","cls":"other","pubkey":"aaaaaaaa
  ✓ U3: classifyEntry — bare kinds, delegate-less rows, and every other kind classify exactly as before (story-2 pins)
  ✗ U4: markDuplicateEntries — first occurrence of a Curated DList entry is effective; later same-raw ones are duplicates; other classes untouched
      ui/src/utils/treasureMap.js must export markDuplicateEntries (ADR 0006 §Implementation 1)
  ✗ U5: communityPointerOf — the first a-tag-form b wins; type defaults to pointer; sentinel-only, event-id-only, malformed, or none → null
      ui/src/utils/treasureMap.js must export markDuplicateEntries (ADR 0006 §Implementation 1)
  ✗ U6: describeHeaderLookup — found locally, found on the relay, missing with the two warning texts
      ui/src/utils/treasureMap.js must export markDuplicateEntries (ADR 0006 §Implementation 1)
  ✗ S1: the panel labels the two classes, uses the three helpers, and keeps the per-user baseline
      AC-2: CLS_LABEL gains "Curated DList" and "TA designation"
  ✗ S2: the batched two-step lookup — local strfry first, the row's relay hint only when missing
      AC-3 / ADR sub-decision 2: local lookup via queryRelay
  ✗ S3: the details line — name linked by coordinate, the community pointer, the warning, the duplicate pill, the inline short pubkey
      AC-3: link to the DList page by encoded coordinate
  ✗ S4: the DList detail route resolves kind-39999 (and 9999) coordinates while keeping its 39998/9998 and event-id branches
      ADR sub-decision 1: the a-tag condition accepts 39999: and 9999:
  ✓ R1: Trusted Assertion / Trusted List / other labels are unchanged
  ✓ R2: the two neighbouring panels are untouched
  ✓ R3: the page order is intact
  ✓ R4: the util's existing exports are unchanged
RESULT {"pass":5,"fail":9,"skipped":0}
=== GUARDS ===
tl-treasure-map-panel → {"pass":18,"fail":0,"skipped":0}
treasure-map-panel-summary → {"pass":18,"fail":0,"skipped":0}
dlist-curation-panel → {"pass":18,"fail":0,"skipped":0}
dlist-curation-tl-panel → {"pass":19,"fail":0,"skipped":0}
  ✓ U1: no generic entry → the new entry is appended, everything else verbatim
  ✓ U5: unconfigured relay → empty-string hint; content and kind preserved
tl-treasure-map-optin-publish → {"pass":23,"fail":0,"skipped":0}
GUARD_TOTAL_FAIL=0
```
