# Test Plan: Story 2 — The two headers: my assistant's DList header and the shared header it points to

**Story:** `engineering-team/stories/my-curated-dlists/2-the-two-headers.md`
**ADR:** `engineering-team/decisions/my-curated-dlists/0002-the-two-headers.md`
**Date:** 2026-09-11

## Coverage map

Suite: `test/my-curated-dlists-headers.test.js` — the house three-class pattern (U behavioral via
ESM import of `ui/src/utils/treasureMap.js`, the shared-header row driven through story 1's
`lookupCurationHeaders` with fakes; S source-structure over the new headers module, the detail
page's wiring, and `useCurationHeaders`; R sentinels that pass before and after). Registered in
`test/test.js` (require, run, results line, overall verdict, skip aggregate).

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 my assistant's header | U2 well-formed header (authored by my assistant, one inherit-items pointer, no problems) · U5 authorship checked both ways, lowercased, garbage · S1 section title, "In this instance's strfry" / "not in this instance's strfry", "Authored by your assistant" · S2 the raw toggle closed on load, not persisted, complete JSON · S3 the Simple Lists link gated on `'local'` | `test/my-curated-dlists-headers.test.js` | unit + structure |
| AC-2 the pointer, checked | U1 `parseCoordinate` · U2 · U3 each problem alone (no-b; not-a-coordinate incl. event id, empty, missing, uppercase hex; wrong-type incl. the `pointer` default and `inherit`; multiple → first followed) · U4 the sentinel alone and beside a pointer; problems accumulate in fixed order · S1 "Points to", a sentence per problem key, "deliberately unaffiliated" | same | unit + structure |
| AC-3 the shared header | U6 `curationPointerRow` · U7 through the story-1 lookup: local first by the pointer's coordinate, then the community relay · S1 "Shared DList header" · S2 · S3 · S5 `COMMUNITY_RELAYS` from the DList Curation panel's hook, `curationPointerRow`, a second lookup · R2 the constant unchanged | same | unit + structure |
| AC-4 import to local strfry | U7 found on the relay only → the import case; after import the re-check finds it locally · S4 exactly one `fetch('/api/strfry/publish')` POST with body `JSON.stringify({ event, signAs: 'client' })`, no re-stamping, success = `.ok` && `.success`, `onImported()` on success, "Import to local strfry" / "Importing" / "Import failed", nothing signed · S5 `refresh` wired to each section's `onImported`; `useCurationHeaders` returns `refresh` backed by a nonce · S6 the import exists only in `CuratedDListHeaders.jsx` | same | unit + structure |
| AC-5 not found / couldn't check | U7 missing (not failed) vs failed relay step · S1 `describeHeaderLookup` text, "couldn't check", "which shared header" | same | unit + structure |
| AC-6 nothing else moves | S6 no `taPubkey`, no 64-hex literal, no route decoding in the module; story 1's four files stay write-free · R1 story 1's front door · R2 existing util exports · R3 Simple Lists and the DList Curation panel untouched — plus story 1's suite and the eight Treasure Map guards below | same | structure |

**AC→handle lines:** AC-1 → U2, U5, S1, S2, S3 · AC-2 → U1, U2, U3, U4, S1 · AC-3 → U6, U7, S1, S2, S3,
S5, R2 · AC-4 → U7, S4, S5, S6 · AC-5 → U7, S1 · AC-6 → S6, R1, R2, R3 (+ guards).

## Edge cases

- [x] **E1 — the sentinel is a state, not a pointer** (U4): alone → `deferred`, no problems, no
      pointer; beside a coordinate → both reported, the coordinate followed, not "multiple".
- [x] **E2 — several problems at once** (U4): event-id `b` + `pointer`-typed coordinate + a second
      coordinate → `not-a-coordinate`, `wrong-type`, `multiple`, in that order; the first coordinate
      followed.
- [x] **E3 — the type default** (U3): a coordinate `b` with no type element is a `pointer` → wrong
      type.
- [x] **E4 — uppercase hex** (U1, U3): not the coordinate form the pointer rule accepts
      (consistent with `communityPointerOf`).
- [x] **E5 — authorship mismatch** (U5): should never come out of the lookup, but is checked, not
      assumed.
- [x] **E6 — garbage headers** (U5): null / `{}` / non-array tags → no pointer, `['no-b']`, no throw.
- [x] **E7 — re-check after import** (U7): the same row that found the header on the relay finds it
      locally once it is there — the post-import state.
- [x] **E8 — rules of hooks** (S5): both lookups run before the page's first `return`.
- [ ] **Relaxed during the satisfiability check (by design):** the Simple Lists link accepts a
      template literal or concatenation; the community relay may pass through a local variable; the
      response variable's name is free; the raw toggle is required once in the module (sections may
      share one "found" block) — *both* sections showing it is a live check.
- [ ] **Not covered — rendering and the real import.** The two sections in a browser, the toggles
      opening, the link appearing only when local, and a real import round-trip are the
      reviewer's: on the local stack, with the Playwright-`page.route` or fetch-stub method from story 1
      (mocked auth + a synthetic Map whose entry names `253d40c4…`/`dog-breed`, whose header lives only
      on dcosl — so both the assistant's header and, if chosen, a shared header exercise the relay path),
      and one real **Import to local strfry** into the local stack's strfry (a local-only write of a
      public, author-signed event), then the Simple Lists link opening it.
- [ ] **Not applicable — Concept Graph API:** no concept behaviour changes.

## Test infrastructure
- Test framework: Node's built-in runner (`node test/test.js`); no Playwright half in the suite.
- Concept Graph API / relays / DOM: not exercised by the suite.
- Firmware state: none required.
- Fixtures: inline — two synthetic 64-hex pubkeys (my assistant `a`×64; a list author), a synthetic
  shared coordinate and a second one, synthetic assistant headers built per test, a synthetic shared
  header event, fake `scanLocal` / `fetchRelay`.

## How to run

Full suite:
```
npm test
```

Story-scoped gate (this suite, story 1's suite, and the eight Treasure Map guards):
```
node -e "Promise.all(['./test/my-curated-dlists-headers.test.js','./test/my-curated-dlists-page.test.js','./test/tl-treasure-map-panel.test.js','./test/treasure-map-panel-summary.test.js','./test/dlist-curation-panel.test.js','./test/dlist-curation-tl-panel.test.js','./test/tl-treasure-map-optin-publish.test.js','./test/dlist-curation-map-entries.test.js','./test/treasure-map-relay-presence.test.js','./test/treasure-map-relay-sync.test.js'].map(p=>require(p).run())).then(rs=>{const f=rs.reduce((s,r)=>s+r.fail,0);console.log('TOTAL_FAIL='+f);process.exit(f?1:0)})"
```

## Verification
The new tests fail with the current code — the U class because the three exports do not exist (the
util loads; R2 exercises its existing exports), the S class because the headers module and the
detail page's wiring do not exist. The three sentinels pass; story 1's suite (19/19) and the eight
guards are green. Satisfiability was checked before commit against a throwaway, ADR-faithful sketch
(scratchpad only, never committed): the three functions, a headers module, the detail-page wiring,
and `refresh` on `useCurationHeaders` — this suite 16/16 and story 1's suite 19/19 on the sketch; the
check relaxed four structural pins, listed above. Confirmed on 2026-09-11 at commit e3c0c387 (working
tree = that commit plus this suite and its runner registration):

```
  ✗ U1: parseCoordinate — "<kind>:<64-hex pubkey>:<d-tag>" (the d-tag keeps its colons); anything else is null
      ui/src/utils/treasureMap.js must export parseCoordinate (ADR 0002 §Implementation 1)
  ✗ U2: describeCurationHeader — a well-formed assistant header: authored by my assistant, one inherit-items pointer, no problems
      ui/src/utils/treasureMap.js must export describeCurationHeader (ADR 0002 §Implementation 1)
  ✗ U3: describeCurationHeader — each pointer problem alone: no b tag, not a coordinate, wrong type (incl. the pointer default), more than one pointer
      ui/src/utils/treasureMap.js must export describeCurationHeader (ADR 0002 §Implementation 1)
  ✗ U4: describeCurationHeader — b-tag-deferred is its own state (never a problem), beside a pointer too; problems accumulate in a fixed order
      ui/src/utils/treasureMap.js must export describeCurationHeader (ADR 0002 §Implementation 1)
  ✗ U5: describeCurationHeader — authorship is checked, not assumed; garbage yields no pointer and ["no-b"] without throwing
      ui/src/utils/treasureMap.js must export describeCurationHeader (ADR 0002 §Implementation 1)
  ✗ U6: curationPointerRow — the pointer becomes the row the story-1 lookup takes, with the community relay as its hint; no pointer → null
      ui/src/utils/treasureMap.js must export describeCurationHeader (ADR 0002 §Implementation 1)
  ✗ U7: the shared header resolves through lookupCurationHeaders — local strfry first, then the community relay; failures read "failed", never "absent"
      ui/src/utils/treasureMap.js must export describeCurationHeader (ADR 0002 §Implementation 1)
  ✗ S1: the headers module — two titled sections with their states, the pointer line, a sentence per problem, and the deliberately-unaffiliated state
      AC-1/2/3/5: ui/src/pages/grapevine/CuratedDListHeaders.jsx must exist (ADR 0002 §Implementation notes)
  ✗ S2: the raw-event toggles — one component, closed on every load, not persisted, used by both sections
      AC-1/3: ui/src/pages/grapevine/CuratedDListHeaders.jsx must exist (ADR 0002 §Implementation notes)
  ✗ S3: the Simple Lists link — /tapestry/lists/<encoded coordinate>, shown only when the header is in this instance's strfry
      AC-1/3: ui/src/pages/grapevine/CuratedDListHeaders.jsx must exist (ADR 0002 §Implementation notes)
  ✗ S4: the import — one POST of the event as received ({ event, signAs: 'client' }) to /api/strfry/publish, then re-check; failure inline; nothing signed
      AC-4: ui/src/pages/grapevine/CuratedDListHeaders.jsx must exist (ADR 0002 §Implementation notes)
  ✗ S5: the detail page — a second lookup for the shared header at the community relay, both before any return, refresh wired to each section
      AC-3 / sub-decision 4: the community relay the DList Curation panel searches (COMMUNITY_RELAYS)
  ✗ S6: identity and isolation — the headers module carries no pubkey literal or taPubkey, never decodes the route, and is the only file of the feature that writes
      AC-6: ui/src/pages/grapevine/CuratedDListHeaders.jsx must exist (ADR 0002 §Implementation notes)
  ✓ R1: story 1's front door is intact on the detail page
  ✓ R2: the util's existing exports and the community relay constant are unchanged
  ✓ R3: Simple Lists and the DList Curation panel are untouched
RESULT {"pass":3,"fail":13,"skipped":0}
=== GUARDS ===
my-curated-dlists-page → {"pass":19,"fail":0,"skipped":0}
tl-treasure-map-panel → {"pass":18,"fail":0,"skipped":0}
treasure-map-panel-summary → {"pass":18,"fail":0,"skipped":0}
dlist-curation-panel → {"pass":18,"fail":0,"skipped":0}
dlist-curation-tl-panel → {"pass":19,"fail":0,"skipped":0}
tl-treasure-map-optin-publish → {"pass":23,"fail":0,"skipped":0}
dlist-curation-map-entries → {"pass":14,"fail":0,"skipped":0}
treasure-map-relay-presence → {"pass":35,"fail":0,"skipped":0}
treasure-map-relay-sync → {"pass":22,"fail":0,"skipped":0}
```

## Later change
- **2026-09-11 — U4 re-aimed by story 3** (`engineering-team/stories/my-curated-dlists/3-items-method-and-update.md`
  AC-7; ADR `my-curated-dlists/0003` sub-decision 9, amending ADR 0002 sub-decision 2): "the sentinel
  beside a pointer" now expects `deferred: false` — the house rule that a real `b` beats
  `b-tag-deferred` (`ui/src/utils/bDisposition.js`). The sentinel-alone case is unchanged.
