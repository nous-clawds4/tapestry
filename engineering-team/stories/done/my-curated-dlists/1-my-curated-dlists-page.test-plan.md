# Test Plan: Story 1 — My Curated DLists: the menu item, the list of empowered DLists, and the detail page's front door

**Story:** `engineering-team/stories/my-curated-dlists/1-my-curated-dlists-page.md`
**ADR:** `engineering-team/decisions/my-curated-dlists/0001-my-curated-dlists-page.md`
**Date:** 2026-09-11

## Coverage map

Suite: `test/my-curated-dlists-page.test.js` — the house three-class pattern (U behavioral via ESM
import of `ui/src/utils/treasureMap.js`, the header lookup driven with fake `scanLocal` /
`fetchRelay`; S source-structure over the nav, the routes, the two new pages, and the two new hooks;
R sentinels that pass before and after). Registered in `test/test.js` (require, run, results line,
overall verdict, skip aggregate).

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 menu item + breadcrumb | S1 the item directly below TA Treasure Map, no `end` · S2 the nested `curated-dlists` block after `treasure-map` (crumb "My Curated DLists"; index → list page; `:id` → detail, crumb "Detail") · R1 the six existing items keep label, order, target · R2 the existing grapevine routes and the My Grapevine crumb | `test/my-curated-dlists-page.test.js` | structure |
| AC-2 whose Map; states before a list | S3 reads `useAuth().loading`, sign-in prompt, `useTreasureMap(…pubkey)`, "No Treasure Map found" + link to TA Treasure Map · S5 the hook: local strfry kind 10040 `limit: 1` first, the same general-purpose relay list, reads the relay-list query's `loading` and `error`, `/api/relay/external` with `success` checked, the five statuses · U6 a loading Map is `checking`, a failed one `map-error`, none `no-map` — never "not on your Map" | same | unit + structure |
| AC-3 the list | U1 one row per list in Map order (kind, d-tag with colons, pubkey, hint or null, coord, route id; 39999 listed) · U2 first entry counts, `ignoredDuplicates`, 39998:x ≠ 39999:x · U3 exclusions (30382, 30392, `39998:dlist-header`, delegate-less) · U7–U9 the header lookup (names come from it) · S3 `curatedDListRows(…, assistantPubkey)`, empty state pointing to DList Curation, `names`, `describeHeaderLookup` + "couldn't check", your assistant / another pubkey, relay hint, duplicate note | same | unit + structure |
| AC-4 only my assistant's lists open | U3 "mine" = my assistant (lowercased; uppercase entries match; none → nothing mine) · U6 `other-pubkey`, `no-assistant` · S3 the link is `curatedDListPath(row.routeId)` guarded by `mine`, "own assistant curates open here", the no-assistant line · S6 no `taPubkey` in the new files | same | unit + structure |
| AC-5 the detail page's front door | U4 route id parse (first colon; reserved word, other kinds, garbage → null) · U5 the path is one encoded segment the router's decode returns to the route id · U6 the full ladder: checking (auth) → signed-out → no-assistant → bad-id → checking (Map) → map-error → no-map → not-on-map → other-pubkey → ok, first occurrence decides, exact d-tags · S4 `useParams` with no `decodeURIComponent`, `curatedDListAccess`, a sentence per status, "curated by your assistant", the back link | same | unit + structure |
| AC-6 nothing else moves | S6 the new files sign, publish, and hardcode nothing · R3 the util's existing exports · R4 the Treasure Map page order and its own Map lookup, Map Entries' own lookup, the DList Curation panel's Simple Lists links, the Simple Lists route — plus the eight guard suites below | same | structure |

**AC→handle lines:** AC-1 → S1, S2, R1, R2 · AC-2 → U6, S3, S5 · AC-3 → U1, U2, U3, U7, U8, U9, S3 ·
AC-4 → U3, U6, S3, S6 · AC-5 → U4, U5, U6, S4 · AC-6 → S6, R3, R4 (+ guards).

## Edge cases

- [x] **E1 — a later duplicate naming me does not open the list** (U2, U6): the first entry decides
      (ADR `dlist-curation/0002` §5); the reverse order opens it.
- [x] **E2 — d-tags that fight URLs** (U5): colons, slashes, percent signs, spaces, and non-ASCII
      round-trip through one path segment.
- [x] **E3 — the reserved blanket word** (U3, U4): `39998:dlist-header` is never a row and never a
      route.
- [x] **E4 — case** (U3, U6): the assistant pubkey compares lowercased (either side uppercase still
      matches); d-tags compare exactly (`Dog-Breed` ≠ `dog-breed`).
- [x] **E5 — an unfinished lookup is never an answer** (U6): auth loading and Map loading/idle are
      `checking`, never `signed-out` or `not-on-map`.
- [x] **E6 — failed vs absent** (U9): a failed step marks the row `failed`; a failed local scan
      does not hide a header the hint has, and does not let a relay miss read as "absent".
- [x] **E7 — only ws/wss hints are fetched** (U8): no hint or an `https://` hint → not fetched.
- [x] **E8 — only the header counts** (U8): events from another author, another kind, or another
      d-tag at the hint are ignored; newest wins.
- [x] **E9 — garbage never throws** (U3, U4, U6, U9): rows, parse, and access return values; the
      lookup never rejects.
- [ ] **Interpretation, flagged at the gate — auth loading comes first.** ADR sub-decision 4 lists
      `signed-out` before `checking (auth or Map still loading)`. Read with ADR note 4 (no sign-in
      prompt while auth resolves) and the fact that `signed-out` cannot be known until auth has
      resolved, U6 pins auth-loading → `checking` ahead of `signed-out`; a loading Map stays
      `checking` in its listed position.
- [ ] **Observed, not pinned — `39999:dlist-header`.** `findDListEntries` (and therefore these rows
      and ADR note 1's parse rule) exclude the reserved word for both kinds, while `classifyEntry`
      treats `39999:dlist-header` as a Curated DList in Map Entries (ADR `dlist-curation/0006` E1).
      Inherited from the dlist-curation helpers; this suite pins only the unambiguous `39998` case.
- [ ] **Not covered — the rendered pages and the real fetches.** The pages' DOM, the hooks'
      sequencing at runtime (the relay step waits for the relay list), the real strfry scan, and the
      relay round-trip are the reviewer's: Playwright with `page.route` mocks (or the fetch-stub
      remount — memory note "Verifying signed-in UI") for `/api/auth/status`,
      `/api/auth/user-classification`, `/api/strfry/scan` (the kind-10040 and kind-39998 scans),
      `/api/relay/external`, and the cypher call for the general-purpose relays — exercising a mine
      row, another pubkey's row, a duplicate, a header found only at the hint, no Map, and a direct
      visit to another pubkey's list. No NIP-07 signer is needed (the story writes nothing).
- [ ] **Not applicable — Concept Graph API:** no concept behaviour changes.

## Test infrastructure
- Test framework: Node's built-in runner (`node test/test.js`); no Playwright half in the suite.
- Concept Graph API / relays / DOM: not exercised by the suite.
- Firmware state: none required.
- Fixtures: inline — two synthetic 64-hex pubkeys (`a`×64 as my assistant, a repeated hex string as
  another pubkey), a synthetic Map tag list covering every shape (non-DList entries, three lists
  including a 39999 with a colon, the reserved word, two duplicates, a delegate-less row), synthetic
  header events, and fake `scanLocal` / `fetchRelay` functions.

## How to run

Full suite:
```
npm test
```

Story-scoped gate (this suite plus the eight guards that pin the Treasure Map page, its panels, and
the util's existing behaviour):
```
node -e "Promise.all(['./test/my-curated-dlists-page.test.js','./test/tl-treasure-map-panel.test.js','./test/treasure-map-panel-summary.test.js','./test/dlist-curation-panel.test.js','./test/dlist-curation-tl-panel.test.js','./test/tl-treasure-map-optin-publish.test.js','./test/dlist-curation-map-entries.test.js','./test/treasure-map-relay-presence.test.js','./test/treasure-map-relay-sync.test.js'].map(p=>require(p).run())).then(rs=>{const f=rs.reduce((s,r)=>s+r.fail,0);console.log('TOTAL_FAIL='+f);process.exit(f?1:0)})"
```

## Verification
The new tests fail with the current code — the U class because the five exports do not exist (the
util loads; R3 exercises its existing exports), the S class because the nav line, the route block,
the two pages, and the two hooks do not exist. The four sentinels pass; the eight guards are green.
Satisfiability was checked before commit: the nine U tests pass against a throwaway ADR-faithful
reference of the five functions (scratchpad only, not committed), and the S1/S2/S3/S5 regexes match
the ADR's literal snippets. Confirmed on 2026-09-11 at commit 835301bd (working tree = that commit
plus this suite and its runner registration):

```
  ✗ U1: curatedDListRows — one row per empowered DList in Map order, with kind, d-tag, pubkey, relay hint, coordinate, and route id
      ui/src/utils/treasureMap.js must export curatedDListRows (ADR 0001 §Implementation 1)
  ✗ U2: curatedDListRows — when a list is named twice the first entry counts and the row counts the ignored duplicates
      ui/src/utils/treasureMap.js must export curatedDListRows (ADR 0001 §Implementation 1)
  ✗ U3: curatedDListRows — "mine" means the signed-in user's own assistant; non-DList entries never appear; garbage never throws
      ui/src/utils/treasureMap.js must export curatedDListRows (ADR 0001 §Implementation 1)
  ✗ U4: parseCuratedDListRouteId — "<kind>:<d>" for kinds 39998/39999 (split at the first colon); anything else is null
      ui/src/utils/treasureMap.js must export parseCuratedDListRouteId (ADR 0001 §Implementation 1)
  ✗ U5: curatedDListPath — one encoded path segment that the router decodes back to the route id (colons, slashes, percent signs, spaces)
      ui/src/utils/treasureMap.js must export curatedDListPath (ADR 0001 §Implementation 1)
  ✗ U6: curatedDListAccess — the detail page opens only a list on the viewer's own Map that names the viewer's own assistant, and otherwise names the case
      ui/src/utils/treasureMap.js must export curatedDListAccess (ADR 0001 §Implementation 1)
  ✗ U7: lookupCurationHeaders — local strfry first, one scan per (kind, pubkey), newest header per coordinate; no relay call for what was found
      ui/src/utils/treasureMap.js must export lookupCurationHeaders (ADR 0001 §Implementation 1)
  ✗ U8: lookupCurationHeaders — a header missing locally is fetched from the entry's ws/wss hint only; only the matching kind, author, and d-tag count
      ui/src/utils/treasureMap.js must export lookupCurationHeaders (ADR 0001 §Implementation 1)
  ✗ U9: lookupCurationHeaders — a failed step is marked failed (never read as "absent"), a hint can still rescue a failed local scan, and the lookup never rejects
      ui/src/utils/treasureMap.js must export lookupCurationHeaders (ADR 0001 §Implementation 1)
  ✗ S1: the menu — "My Curated DLists" sits directly below "TA Treasure Map" under My Grapevine, with no end flag
      AC-1 / ADR note 7: { to: '/tapestry/grapevine/curated-dlists', label: 'My Curated DLists' } directly after the TA Treasure Map item, no `end`
  ✗ S2: the routes — a nested curated-dlists block after treasure-map: the list page at the index (crumb "My Curated DLists") and the detail page at :id
      ADR note 6: App.jsx imports the list page
  ✗ S3: the list page — my own Map and my own assistant, honest states, one row per list, links only on my assistant's rows
      AC-2/3/4: ui/src/pages/grapevine/MyCuratedDLists.jsx must exist (ADR 0001 §Implementation notes)
  ✗ S4: the detail page — the route id as the router decoded it, one front-door decision, a sentence per case, and the list identified when it opens
      AC-5: ui/src/pages/grapevine/CuratedDListDetail.jsx must exist (ADR 0001 §Implementation notes)
  ✗ S5: the hooks — useTreasureMap looks where the Treasure Map page looks and waits for the relay list; useCurationHeaders binds the pure lookup to strfry and the relay endpoint
      AC-2: ui/src/hooks/useTreasureMap.js must exist (ADR 0001 §Implementation notes)
  ✗ S6: nothing is written and no identity is hardcoded — the new files sign nothing, publish nothing, and carry no pubkey literal
      AC-6: ui/src/pages/grapevine/MyCuratedDLists.jsx must exist (ADR 0001 §Implementation notes)
  ✓ R1: every other My Grapevine menu item keeps its label, order, and target
  ✓ R2: the existing grapevine routes are intact
  ✓ R3: the util's existing exports are unchanged
  ✓ R4: the shipped Treasure Map files keep their own lookups and links — no migration in this story (OPEN.md row 249)
RESULT {"pass":4,"fail":15,"skipped":0}
=== GUARDS ===
tl-treasure-map-panel → {"pass":18,"fail":0,"skipped":0}
treasure-map-panel-summary → {"pass":18,"fail":0,"skipped":0}
dlist-curation-panel → {"pass":18,"fail":0,"skipped":0}
dlist-curation-tl-panel → {"pass":19,"fail":0,"skipped":0}
tl-treasure-map-optin-publish → {"pass":23,"fail":0,"skipped":0}
dlist-curation-map-entries → {"pass":14,"fail":0,"skipped":0}
treasure-map-relay-presence → {"pass":35,"fail":0,"skipped":0}
treasure-map-relay-sync → {"pass":22,"fail":0,"skipped":0}
```
