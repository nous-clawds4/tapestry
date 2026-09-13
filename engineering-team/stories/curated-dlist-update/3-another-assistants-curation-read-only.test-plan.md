# Test Plan: Story 3 — Another assistant's curation opens read-only, with an offer to curate it here

**Story:** `engineering-team/stories/curated-dlist-update/3-another-assistants-curation-read-only.md`
**ADR:** `engineering-team/decisions/curated-dlist-update/0003-read-only-curation-and-curate-here.md`
**Date:** 2026-09-12

## Coverage map

**New suite:** `test/curated-dlist-update-read-only-curation.test.js`, in the house classes plus a doc class.
- **U (behavioral):** ESM import of `ui/src/utils/treasureMap.js` — `curatedDListAccess`, `curateHereOffer`,
  `replacementSentences`, `itemsEmptySentence`.
- **S (structure):** reads of the list page, the detail page, the headers and items modules, the new
  `CurateHereOffer.jsx`, and the DList Curation panel. User-facing phrases are pinned as literals on
  whitespace-flattened source (an apostrophe may be spelled `'`, `’` or `&apos;`), so each phrase must appear
  whole in the source rather than be composed from pieces.
- **D (docs):** the two superseded-in-part notes (ADR §8).
- **R (sentinels):** pass before and after.

It is registered in `test/test.js` in five places: the require, the run, the results line, the overall verdict
and the skip aggregate. It carries the `require.main` block (OPEN.md's silent-suite row).

**Re-aimed in place,** because story 3 changes what they pin:
- `test/my-curated-dlists-page.test.js`:
  - U6: `read-only` replaces `no-assistant` and `other-pubkey`. With no assistant, a list on my Map opens
    read-only, and a bad address is still `bad-id`;
  - S3: every row links; "Opens read-only here" replaces "Only lists your own assistant curates open here";
  - S4: the front door's cases without `no-assistant` and `other-pubkey`. It also checks that `read-only` is
    handled and that the read-only lines name "another assistant".
- `test/my-curated-dlists-headers.test.js` R1: the same list of cases, with `read-only`.

**Unchanged, and passing before and after** (checked against the sketch): `my-curated-dlists-items`,
`dlist-curation-panel` and `curated-dlist-update-pointer-switch`. The last one's S3 reads the first
`'older-link'` entry, which still carries my own note's "Update list" words.

| Criterion | Tests | Test file | Level |
|---|---|---|---|
| AC-1 every empowered list opens | **S1:** every row links to `curatedDListPath(row.routeId)`, no longer only `mine`; "Opens read-only here."; the no-assistant line, exact. **U1:** with no assistant here, a list on my Map is `read-only`. **Page S3.** | new suite + page suite | structure + unit |
| AC-2 the read-only page shows the curation | **U1:** `read-only` for another pubkey's list (both kinds), with its row; the first entry decides; the retired statuses never return. **S2:** the lookups run for both open states; `describeCurationHeader(lookup.event, row.pubkey)`; "curated by another assistant"; the two read-only lines, exact; `curator` on the three sections; `ItemsSection` gets the curator's pubkey, `listRelay` (the entry's ws/wss hint) and `canCurateHere`. **S3:** "Its assistant's DList header"; "Authored by the curating assistant" and its ⚠️ variant; "its assistant's header". **S4:** `listRelay` feeds the curated list's read, and candidates stay at the community relay; the "its assistant" labels. **U4:** "Its assistant hasn't added any items…". **Page U6/S4; headers R1.** | new suite + page, headers suites | unit + structure |
| AC-3 nothing on the page acts | **S2:** the method panel renders only in a conditional branch, with the one line in its place. **S3:** the read-only older-link note, exact, without "Update list". **S4:** Update's read-only line, exact, with "You can curate it here instead."; my own placeholder unchanged. **Headers S4:** the import is unchanged (still the module's one import request). | new suite + headers suite | structure |
| AC-4 the offer to curate it here instead | **U2:** `curateHereOffer` — available, with the shared header as its target; the reasons in precedence (`no-assistant` → `kind` → `checking` / `failed` / `missing` / `deferred` / `no-pointer`); garbage is never available. **U3:** `replacementSentences`, exact. **S5:** `CurateHereOffer` — its imports; no endpoint call inside an effect (words first); POST `/api/dlist-curation/header` `{ target }`; `upsertDListEntry(…, 39998, …)`; `getActiveSignerOrThrow` → `window.nostr.signEvent` → `publishOrThrow` → `onPublished`; the labels; the third sentence; the 409 sentence; "Map update: replaces"; the six reasons. **S2:** the page passes `mapEvent={map.event}` and `onPublished={map.refresh}`. **S6:** the panel's Replace confirmation (ADR §7). | new suite | unit + structure |
| AC-5 nothing else moves | **R1:** my own words — the header section's title and authorship, my older-link note, the Update placeholder, the subtitle. **R2:** the endpoint's exports. **S6:** a plain Add still says "adds". **D1:** the two ADR notes. Every other test in the re-aimed suites, and the items, panel and story-2 suites, unchanged and passing. | all | regression |

**Amendment 1** (ADR 0003; story 3's review, Non-blocking 1 and 2), in the same suite:
- **U2** — the offer checks its target. A pointer at another kind of header (`39999:<author>:dog-breed`) or
  at another d-tag (`39998:<author>:dogs`) gives `unavailable` with reason `target`. The header's own states
  still come first. A conforming pointer is still offered. U2's fixture pointer now carries the parsed kind,
  pubkey and d-tag, as `describeCurationHeader` reports it.
- **S5** — the `target` reason's sentence.
- **D1** — `my-curated-dlists` ADR 0002's superseded-in-part note, citing ADR 0003 by short name.

## Edge cases

- [x] **E1 — no assistant here.** Every list on my Map opens read-only, and every other case still decides
      first: a bad address, the Map loading, failing or missing, a list not on my Map, signed out (U1).
- [x] **E2 — the first entry decides.** A later entry naming my assistant does not make a list mine (U1;
      page U6).
- [x] **E3 — a kind-39999 list** opens read-only (U1) but is never offered (U2).
- [x] **E4 — the offer's precedence.** No assistant comes before the kind, and the kind before the header's
      states (U2).
- [x] **E5 — the curating assistant's header** not found, not checkable, deliberately unaffiliated, or
      naming no shared header: no offer, and the reason is given (U2; S5).
- [x] **E6 — garbage input.** `curateHereOffer` never throws and is never available; `replacementSentences`
      always returns two strings (U2; U3).
- [x] **E7 — a non-conforming curating header (Amendment 1).** Its pointer is another kind of header, or
      another d-tag: no offer, with reason `target`. Otherwise the Map entry would address a header that does
      not exist, or the endpoint would refuse the target after the words (U2; S5).
- [ ] **Not covered — the rendered pages and a real "curate it here instead".** A real replacement signs a
      header and the Map, so it needs a NIP-07 signer and belongs to the operator. The rendered pages are the
      Implementer's local check with the fetch stub (ADR note 9).
- [ ] **Not applicable — the Concept Graph API:** no concept changes.

## Test infrastructure
- **Framework:** Node's built-in runner (`node test/test.js`); no Playwright half.
- **How the code is reached:**
  - the UI util through ESM import;
  - the pages, modules and ADRs by reading their source;
  - the endpoint's exports through `require`.
- **Not exercised:** the stack, relays and DOM.
- **Firmware state:** none required.
- **Fixtures:** inline.
  - synthetic pubkeys — my assistant, another assistant, the shared list's author;
  - a Map with three entries — another assistant's kind-39998 list, mine, and another's kind-39999 list;
  - header lookup records in each state.

## How to run

Full suite:
```
npm test
```

Story-scoped gate. Always go through `run()`; never `node test/<file>`, which exits 0 without running anything for suites with no `require.main` block (OPEN.md's silent-suite row):
```
node -e "Promise.all(['./test/curated-dlist-update-read-only-curation.test.js','./test/my-curated-dlists-page.test.js','./test/my-curated-dlists-headers.test.js','./test/my-curated-dlists-items.test.js','./test/dlist-curation-panel.test.js','./test/curated-dlist-update-pointer-switch.test.js'].map(p=>require(p).run())).then(rs=>{const f=rs.reduce((s,r)=>s+(r.fail||0),0);console.log('TOTAL_FAIL='+f);process.exit(f?1:0)})"
```

## Verification

The new and re-aimed tests fail with the current code. Confirmed on 2026-09-12 at commit `8c48e83f` with these tests applied, each suite through `run()`:

```
curated-dlist-update-read-only-curation: 2 passed, 11 failed — U1 U2 U3 U4 S1 S2 S3 S4 S5 S6 D1 (R1 R2 pass)
my-curated-dlists-page:                 16 passed, 3 failed  — U6 S3 S4
my-curated-dlists-headers:              15 passed, 1 failed  — R1
my-curated-dlists-items:                23 passed, 0 failed
dlist-curation-panel:                   18 passed, 0 failed
curated-dlist-update-pointer-switch:    12 passed, 0 failed
```

Each failure names what is missing. Samples:
- U1: `a list my Map names for another pubkey opens read-only … got {"status":"other-pubkey",…}`;
- U2 and U3: "ui/src/utils/treasureMap.js must export curateHereOffer" (and `replacementSentences`);
- S5: "ui/src/pages/grapevine/CurateHereOffer.jsx must exist";
- D1: `… Status line carries the parenthetical; got "**Status:** Accepted"`;
- page U6: `no assistant on this instance (null) → read-only, with the row; got {"status":"no-assistant","row":null}`.

`node --check` is clean on all four edited test files, `test/test.js` included.

**Satisfiability check** (the practice OPEN.md row 264 proposes). I applied an ADR-faithful sketch of the implementation, never committed, in a throwaway `git worktree` at `8c48e83f` holding these tests. The sketch follows ADR 0003's Decision:
- the front door;
- `curateHereOffer` and `replacementSentences`;
- the `curator` variants of the four sections, and `listRelay`;
- the new `CurateHereOffer.jsx`;
- the panel's Replace words;
- the two ADR notes.

Results against the sketch:
- the new suite 13/0; page 19/0; headers 16/0; items 23/0; panel 18/0; story 2's suite 12/0;
- seven neighbouring suites that read these files, unchanged: map-entries 14/0, the TL panel 19/0,
  merge-preserve 16/0, the TL Treasure Map panel 18/0, the panel summary 18/0, the opt-in publish 23/0, and
  relay sync 22/0;
- all seven sketch files transform cleanly with the UI's esbuild.

No test needed relaxing. The worktree is kept, uncommitted, for the Implementation phase, which starts from the sketch; it is removed after that.

**Amendment 1.** The extended suite was run on `6c67e50b`, with the amendment committed and the code unchanged: 10 passed, 3 failed.
- U2: a pointer at another kind of header is still offered.
- S5: the `target` sentence is missing.
- D1: `my-curated-dlists` ADR 0002's Status has no ADR 0003 parenthetical.

Against a throwaway sketch of the amendment (the target check, the sentence, the note), in a disposable worktree, the six story suites gave 13/0, 19/0, 16/0, 23/0, 18/0 and 12/0. That worktree was removed at once. Unlike round 1's, it is not Implementation's starting point: the fix is written independently of the tests (story 3's review, Harness friction 1).
