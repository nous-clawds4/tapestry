# Test Plan: Story 3 — Items, the curation-method panel, and Update list

**Story:** `engineering-team/stories/my-curated-dlists/3-items-method-and-update.md`
**ADR:** `engineering-team/decisions/my-curated-dlists/0003-items-method-and-update.md`
**Date:** 2026-09-11

## Coverage map

Suite: `test/my-curated-dlists-items.test.js` — the house three-class pattern (U behavioral via ESM
import of `ui/src/utils/treasureMap.js` — the item lookup driven with fake `scanLocal` / `fetchRelay`
— and a parity check against the house `ui/src/utils/bDisposition.js`; S source-structure over the
new items module, its hook, the detail page's placement, and the util's import of the house owner; R
sentinels that pass before and after). Registered in `test/test.js` (require, run, results line,
overall verdict, skip aggregate). **Also re-aimed in this phase:** story 2's suite U4
(`test/my-curated-dlists-headers.test.js`) — "sentinel beside a pointer" now expects
`deferred: false` (ADR 0003 sub-decision 9); it fails until this story is implemented.

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 the items table | U2 `itemRouteId` (Simple Lists' item ids) · U3 `lookupListItems`: one filter `{ kinds: [9999, 39999], '#z': [coord], limit: 500 }` locally and on the relay, only items pointing at the list, dedupe (newest per coordinate, one per id), `local` when any copy is here, local truncation with its total (or null) · U4 one source failed → the other still shown; both failed → no items; a non-ws relay skipped; never rejects · U5 default view = my assistant's items, by name · U7 row fields, tie-break, "(unnamed)" · S1 "Items" · S4 the four columns, the three From values, `timeAgo`, the link gated on `local`, the relay-only marker · S5 loading / couldn't check / the cap / the empty default view | `test/my-curated-dlists-items.test.js` | unit + structure |
| AC-2 also show: others' items | U6 others marked "someone else" in their group · S1 the label · S2 the checkbox bound to `showOthers`, starting false | same | unit + structure |
| AC-3 also show: candidates | U6 shared items not copied → "candidate"; copied by id (`e`), by coordinate (`a`), by coordinate in a `b` at index 1, by id at index 2 of any tag; a back-reference by *someone else* doesn't count · U8 `sharedListUnavailable` (checking / failed / missing / deferred / no-pointer / null) · S1 the label · S2 bound to `showCandidates`, starting false · S6 the shared list read only while "candidates" is on; the box disabled when there is no shared list | same | unit + structure |
| AC-4 curation method (placeholder) | S1 "Curation method" · S2 closed on load (`useState(false)`), not persisted · S3 "not built yet" + the downvotes/upvotes example | same | structure |
| AC-5 Update list (placeholder) | S3 `<button … disabled>Update list</button>` with no handler, "isn't built yet" · S9 the new files write nothing | same | structure |
| AC-6 nothing else moves | S7 placement after the shared header, no new hooks on the page · S9 no writes, no `taPubkey`, no 64-hex literal · R1 story 2's module (its single import, the sentinel-alone state) · R2 the util's existing exports · R4 Simple Lists' item route/page — plus story 1's and story 2's suites and the guards below | same | structure |
| AC-7 the pointer wins | U1 sentinel alone → deferred; beside an a-tag pointer → not deferred, pointer followed; beside an event id → not deferred, `not-a-coordinate`; parity with the house `dispositionOf` over seven b-lists · S8 the util imports `dispositionOf` from `./bDisposition.js` and keeps no `'b-tag-deferred'` literal · R3 the house owner unchanged · story 2's U4 (re-aimed) | same (+ `test/my-curated-dlists-headers.test.js` U4) | unit + structure |

**AC→handle lines:** AC-1 → U2, U3, U4, U5, U7, S1, S4, S5 · AC-2 → U6, S1, S2 · AC-3 → U6, U8, S1, S2,
S6 · AC-4 → S1, S2, S3 · AC-5 → S3, S9 · AC-6 → S7, S9, R1, R2, R4 (+ guards) · AC-7 → U1, S8, R3, story-2 U4.

## Edge cases

- [x] **E1 — a back-reference must be my assistant's** (U6): someone else's item carrying a shared
      item's id does not make it "copied".
- [x] **E2 — "any tag", any position** (U6): `e`, `a`, a `b` with a type element, a made-up tag with
      the id at index 2.
- [x] **E3 — a 9999 shared item** (U6): matched by id only (it has no coordinate).
- [x] **E4 — the same item from both sources** (U3): once; newest version for an addressable item;
      `local` if any copy is here.
- [x] **E5 — noise at the source** (U3): other lists' items and non-item kinds are dropped even if a
      source returns them.
- [x] **E6 — an unknown total** (U3): `total: null` stays null — never the bounded count.
- [x] **E7 — an event-id `b` beside the sentinel** (U1): real to the house rule, so not deferred,
      but not a list coordinate either.
- [x] **E8 — case** (U5, U7): the assistant pubkey compares lowercased; names sort case-insensitively
      with a newest-first tie-break.
- [ ] **Relaxed by design (directional pins, the behaviour is verified live):** the shared list being
      read lazily (S6 accepts the gate inside the call or just before it); the link being gated on
      `local` (S4 checks the order of the tokens); "only" for relay-only rows.
- [ ] **Not covered — rendering and the real reads.** The table, checkboxes, and panels in a browser;
      the lazy shared read (no community-relay request until "candidates" is ticked); the real strfry
      scan and relay fetch. The reviewer's live check on the local stack (fetch-stub or Playwright
      `page.route` for auth and the Map): on this Mac Studio the shared `dog-breed` list has two local
      items (sheep dog, golden retriever), so "candidates" shows them; no assistant has items yet, so
      the default view is the empty sentence.
- [ ] **Not applicable — Concept Graph API:** no concept behaviour changes.

## Test infrastructure
- Test framework: Node's built-in runner (`node test/test.js`); no Playwright half in the suite.
- Concept Graph API / relays / DOM: not exercised by the suite.
- Firmware state: none required.
- Fixtures: inline — three synthetic pubkeys (my assistant, someone else, the shared list's author),
  synthetic items (kinds 9999/39999) built per test with sequential 64-hex ids, my assistant's items
  carrying back-references in assorted tags, a synthetic assistant header per `b`-list case, fake
  `scanLocal` (bounded envelope) / `fetchRelay`.

## How to run

Full suite:
```
npm test
```

Story-scoped gate (this suite, stories 1–2's suites, the eight Treasure Map guards, and the house
sentinel-pin suite):
```
node -e "Promise.all(['./test/my-curated-dlists-items.test.js','./test/my-curated-dlists-headers.test.js','./test/my-curated-dlists-page.test.js','./test/tl-treasure-map-panel.test.js','./test/treasure-map-panel-summary.test.js','./test/dlist-curation-panel.test.js','./test/dlist-curation-tl-panel.test.js','./test/tl-treasure-map-optin-publish.test.js','./test/dlist-curation-map-entries.test.js','./test/treasure-map-relay-presence.test.js','./test/treasure-map-relay-sync.test.js','./test/b-coverage-audit-and-disposition.test.js'].map(p=>require(p).run())).then(rs=>{const f=rs.reduce((s,r)=>s+r.fail,0);console.log('TOTAL_FAIL='+f);process.exit(f?1:0)})"
```

## Verification
The new tests fail with the current code — U1 because `deferred` still follows ADR 0002 (true beside
a pointer), the other U tests because the four new exports do not exist (the util loads; R2
exercises its existing exports), the S class because the items module, its hook, the page placement,
and the util's import do not exist. The four sentinels pass. Story 2's re-aimed U4 fails for the same
reason as U1; the rest of story 2's suite (15), story 1's suite (19), the eight guards, and
`b-coverage-audit-and-disposition` (26) are green. Satisfiability was checked before commit against a
throwaway ADR-faithful sketch (scratchpad only, never committed) — the four functions, the amended
`deferred`, an items module, the hook, and the page placement: this suite 21/21, story 2's suite
16/16 (re-aimed U4 included), story 1's 19/19. Confirmed on 2026-09-11 at commit 68504103 (working
tree = that commit plus this suite, its runner registration, and story 2's re-aimed U4):

```
  ✗ U1: describeCurationHeader follows the house rule (AC-7) — a real b beats b-tag-deferred; the sentinel alone is still "deliberately unaffiliated"
      AC-7 / ADR 0003 sub-decision 9: beside a real pointer the sentinel is superseded — not deferred, the pointer followed; got {"authoredByAssistant":true,"pointer":{…},"deferred":true,"problems":[]}
  ✗ U2: itemRouteId — "39999:<pubkey>:<d>" for an addressable item, the event id for kind 9999 (Simple Lists' item ids); garbage → null
      ui/src/utils/treasureMap.js must export itemRouteId (ADR 0003 §Implementation 1)
  ✗ U3: lookupListItems — this instance (bounded) and the community relay, same filter; only items that point at the list; deduped (newest per coordinate, one per id); "local" when any copy is here
      ui/src/utils/treasureMap.js must export lookupListItems (ADR 0003 §Implementation 1)
  ✗ U4: lookupListItems — a failed source is marked failed (the other still counts), a non-ws relay is skipped, and it never rejects
      ui/src/utils/treasureMap.js must export lookupListItems (ADR 0003 §Implementation 1)
  ✗ U5: curatedItemRows — by default only my assistant's items, marked "assistant"; others and candidates only when asked
      ui/src/utils/treasureMap.js must export curatedItemRows (ADR 0003 §Implementation 1)
  ✗ U6: curatedItemRows — "someone else" and candidates; "already copied" = my assistant's item carries the shared item's id or coordinate in any tag
      ui/src/utils/treasureMap.js must export curatedItemRows (ADR 0003 §Implementation 1)
  ✗ U7: curatedItemRows — row fields, the newest-first tie-break, the "(unnamed)" fallback, and garbage
      ui/src/utils/treasureMap.js must export curatedItemRows (ADR 0003 §Implementation 1)
  ✗ U8: sharedListUnavailable — why there is no shared list to draw candidates from (or null when there is one)
      ui/src/utils/treasureMap.js must export sharedListUnavailable (ADR 0003 §Implementation 1)
  ✗ S1–S6, S9: ui/src/pages/grapevine/CuratedDListItems.jsx must exist (ADR 0003 §Implementation notes)
  ✗ S7: the detail page — ADR note 4: the panel and the section from ./CuratedDListItems
  ✗ S8: sub-decision 9: import { dispositionOf, … } from './bDisposition.js'
  ✓ R1: story 2's headers module is unchanged in its contract — the one import, the deliberately-unaffiliated state
  ✓ R2: the util's existing exports are unchanged
  ✓ R3: the house b-value owner is unchanged — SENTINEL, classifyBValue, dispositionOf (a real b beats the sentinel)
  ✓ R4: Simple Lists' item route and page are unchanged
RESULT {"pass":4,"fail":17,"skipped":0}
=== STORY 2 (U4 re-aimed) ===  {"pass":15,"fail":1}  — ✗ U4: … beside a real pointer the sentinel is superseded — not deferred …
=== GUARDS ===
my-curated-dlists-page → 19/0 · tl-treasure-map-panel → 18/0 · treasure-map-panel-summary → 18/0 ·
dlist-curation-panel → 18/0 · dlist-curation-tl-panel → 19/0 · tl-treasure-map-optin-publish → 23/0 ·
dlist-curation-map-entries → 14/0 · treasure-map-relay-presence → 35/0 · treasure-map-relay-sync → 22/0 ·
b-coverage-audit-and-disposition → 26/0
```

## Round 2 — review round 1's blocking finding (ADR 0003 Amendment 1), 2026-09-11

The first review found the empty view claiming "The shared list offers no candidates to inherit."
after a shared-list read that failed on both sources — beside "Couldn't check the shared list" — which
the suite could not see (S5 pinned the strings' presence, not their exclusion). Amendment 1 moves the
sentence into a pure `itemsEmptySentence({ showOthers, shared })`.

| Criterion | Test name | Level |
|---|---|---|
| AC-1 (a failed lookup never reads as empty) | **U9** `itemsEmptySentence`: not read → the base sentence only; others shown → + "No one else has either."; read cleanly → + "The shared list offers no candidates to inherit."; **failed on both sources → no "no candidates" clause** (the regression); a partial read keeps today's behaviour (NB-2 stays a follow-up); garbage → the base sentence, never throws | unit |
| AC-1 | **S10** `ItemsSection` renders `itemsEmptySentence(…)` and contains no "offers no candidates" text of its own — the rule has one home, pinned by U9 | structure |
| AC-1 | **S5 re-aimed** — the empty default sentence may live in the util or the module | structure |

**Verification (round 2).** Before the fix, at commit e216207e plus these tests: U9 fails (`must export
itemsEmptySentence`), S10 fails (`ItemsSection renders itemsEmptySentence(…)`), every other test in the
suite passes (21), including the re-aimed S5. Satisfiability: U9 passes against a throwaway reference
of the function (scratchpad only).

```
  ✗ U9: itemsEmptySentence — "no candidates" only after a shared-list read that did not fail on both sources (ADR 0003 Amendment 1; review round 1, blocking 1)
      ui/src/utils/treasureMap.js must export itemsEmptySentence (ADR 0003 §Implementation 1)
  ✗ S10: the section renders itemsEmptySentence and composes no "no candidates" clause of its own (ADR 0003 Amendment 1)
      Amendment 1: ItemsSection renders itemsEmptySentence(…)
RESULT {"pass":21,"fail":2,"skipped":0}
```
