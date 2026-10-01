# Test Plan: Story 3 — What each Assistant does: your Treasure Map on the My Assistants page

**Story:** `engineering-team/stories/my-assistants/3-the-treasure-map-on-the-page.md`
**ADR:** `engineering-team/decisions/my-assistants/0003-the-pages-treasure-map-is-the-shared-hook-read-strictly.md`
**Date:** 2026-09-30

Two new files, one addition, and four re-aims:

- **`test/my-assistants-map.test.js`** (Node, registered after `my-assistants-actions` in `test/registry.js`). It
  covers:
  - the duties, derived from one fixture Treasure Map that holds every entry class, a repeated key, a repeated
    delegate and three entries the app can't place;
  - each Assistant's duties;
  - the Duties tab's rows and sentences;
  - the hook's strict option, and two source sentinels.
- **`tests/brainstorm/my-assistants-map.spec.js`** (Playwright). It covers what a viewer sees: the map's states, the
  tabs, a row's duties, the not-tagged section and the Duties tab. The Treasure Map reads are mocked per test.
- **O9, added to `test/my-assistants-actions.test.js`.** This is the withdrawal-send test folded into this cycle
  (story § Also in this cycle; ADR 0003 sub-decision 6).
- **Re-aims, each required by ADR 0003:**
  - **V6** (`my-assistants-actions.test.js`): the untagged Local row's actions are `{ change: null, remove: null }`,
    not `null` (sub-decision 4: every row opens).
  - **C4** (`my-assistants-actions.spec.js`): the untagged Local row opens to its duties and **Manage on Treasure
    Map**, with no Change and no Remove. Its prompt link stays.
  - **C16** (`my-assistants-actions.spec.js`): it waits for the "N on your Treasure Map" count before it counts
    `role="status"` regions, so a region the map's loading might add can't be miscounted. It fails on the current code
    only because that count doesn't exist yet.
  - **A11** (`my-assistants.spec.js`): "the page only reads" now counts a **read-only** Cypher POST as a read. The
    Treasure Map's relay list is a POST to `/api/neo4j/query`. The test decides what's read-only with the server's own
    guard (`WRITE_KEYWORDS`, `src/api/neo4j/queryPost.js:17`).
  - **Treasure Map mocks** in both earlier specs (`/api/strfry/scan`, `/api/neo4j/query`, `/api/relay/external`,
    none published) keep them hermetic.

## Coverage map

| Criterion | Tests | File | Level |
|---|---|---|---|
| **AC-1** whose Treasure Map | H1 (`useTreasureMap(pubkey, { strict = false } = {})`; `strict=1` on the relay read; the two other callers unchanged) | Node | source |
| | M1 (found in local strfry: no relay read) · M2 (a local miss, then the relay read, which asks `strict=1`, finds nothing: **none**) · M3 (no relay readable: never "Not on Treasure Map") | Playwright | browser |
| **AC-2** status and count | P1 (`dutiesOf`: the count, an Alternate's duty included, none for the Local row) | Node | unit |
| | M1 (On / Not on Treasure Map per row; "2 on your Treasure Map") · M2 (every row Not on; "0 on your Treasure Map") | Playwright | browser |
| **AC-3** an Assistant's duties | P1 (grouped Scores / Lists / Concepts, in duty order) · P3 + V6 (the untagged Local row opens: no Change, no Remove) | Node | unit |
| | M1 (an open row: the heading and "2 duties"; Scores and Concepts, no empty Lists; each duty's name; **Manage on Treasure Map** → `/tapestry/grapevine/treasure-map`) · M5 (the untagged Local row opens to the no-duties line and Manage, with no Change or Remove) · C4 (re-aimed: likewise, its prompt kept) | Playwright | browser |
| **AC-4** on the map, not tagged | P2 (`mapOnlyAssistants`: delegates not in the list, with their counts; none without duties) · S1 (the section's file exists, no 64-hex literal) | Node | unit |
| | M6 (the section as a region with its heading and text; name, URL, NIP-05, "2 duties on your Treasure Map"; **Tag: Tapestry** signs story 2's tagging: kind 39999, `p`, `a`, `e`, `polarity` 1, `d`; posted once; reported; the refresh moves it into the list and the section goes) · M6b (an unpublished tag's button disabled, with the reason as its description; the other enabled; nothing signed) | Playwright | browser |
| **AC-5** two tabs | M7 (a tablist; Assistants selected by default; a click and the arrow keys switch; only the selected panel is rendered) | Playwright | browser |
| **AC-6** the Duties tab | D1 (one duty per key, most generic first) · D3 (Assistants in Map order, deduped; all raw entries kept) · D4 (group and level) · D5 (name and "what", in § Copy's words, plus ADR 0003's two uncovered cases) · T1 (`dutySentence`) · T2 (`dutyRows`: rank, title, key, level, Preferred, Not tagged, Alternates, sentence, raw; a nameless Assistant is its short npub) | Node | unit |
| | M8 ("4 duties", "Most generic first", the intro; the rows in order with number, name, key, level; a Preferred who isn't listed marked **Not tagged**; "Alternates: Bea"; opened: Preferred and Alternate, the sentence, the raw entries, the link) · M8b (two Alternates numbered 1 and 2 under "First listed is preferred"; "Only provider" with one) | Playwright | browser |
| **AC-7** the honest states | D2 (an unknown kind, no valid delegate, a non-entry tag: not duties) · D6 (no event, no tags, garbage: no duties, nothing thrown) | Node | unit |
| | M2 (none: the Duties tab's line) · M3 (unreadable: the error line and **Try again** on both tabs, never the none line; Try again reads again and the statuses appear) · M4 (while the map is held: rows with no status and no count, sampled; the Duties tab's loading line; released, the duties appear) · M8 (an entry the app can't place, `99999`, isn't shown) | Playwright | browser |
| **Also in this cycle** the withdrawal's send | O9 (Remove and Change send the withdrawal to `deps.withdrawRelays` and report against that same list) · S2 (the page's `withdrawTaggings` forwards the relays it's handed and names no relay list) | Node | unit / source |

Stories 1 and 2's suites are regressions here. They must pass, with only the re-aims above:
`test/my-assistants-page.test.js`, `tests/brainstorm/my-assistants.spec.js`, and the rest of
`test/my-assistants-actions.test.js` and `tests/brainstorm/my-assistants-actions.spec.js`.

## Edge cases

- [x] The same key and delegate twice: one Assistant (D3). The same key with two delegates: Preferred, then
      Alternate (D3, M8).
- [x] A delegate that isn't a valid key; a tag that isn't an entry; a kind outside the ranges (D2, M8).
- [x] A named List entry (`30392:podcasters`), which the app recognizes but doesn't use yet: an Exact duty in Lists
      (D4, D5). This is ADR 0003 sub-decision 3's first uncovered case.
- [x] A Curated DList's name shown as its `d` tag (D5). This is sub-decision 3's second case.
- [x] An Assistant with a duty only as an Alternate still counts as on the map (P1, Bea).
- [x] An Assistant on the map with no profile: named by its short npub on the Duties tab (T2).
- [x] The Treasure Map found on a relay, not locally: M3's Try again finds it there.
- [x] The not-tagged section's tagging, when a tag is unpublished (M6b).
- **Not covered, by choice:**
  - **A failed local scan, or an unreadable relay list.** The hook already makes both `error`, and this story
    doesn't change that code. M3 covers how the page shows `error`.
  - **A second press from the section while one publishes.** The section uses story 2's `press`, which C8 covers.

## Test infrastructure

- **Runners:** the Node gate (`test/registry.js`; the suite exports `run()`) and Playwright, chromium.
- **SAFETY,** as for story 2 (OPEN.md rows `2026-09-27-test-fixture-taggings-on-prod-relays` and
  `2026-09-30-npm-test-step-leaks-fixtures`).
  - The Node suites import no file that can publish. They have no `strfry/publish`, no `POST`, and no `docker exec`.
  - **Every Playwright test:**
    - mocks `/api/publish-policy` as `{ allowExternalPublish: false }` (the gate fails open);
    - blocks and counts every WebSocket, and asserts the count ends at 0;
    - mocks `/api/strfry/publish`.

    `window.nostr` is a stub with fake signatures.
  - **Never run the full `npm test` on the Mac Studio.**
- **How the Treasure Map is mocked** (the hook's own order, ADR 0003 sub-decision 1):
  - `/api/strfry/scan` with `kinds: [10040]` answers the local event, or none, optionally held;
  - `/api/neo4j/query` (POST) answers one general-purpose relay;
  - `/api/relay/external` answers in turn per test. A test fails if it isn't asked with `strict=1` (M2).
- **Seams the tests define,** beyond the ADR's names:
  - `treasureMapDuties(event)` → `[{ key, group: 'scores'|'lists'|'concepts', level: 'Scope'|'Exact', title, what,
    assistants: [pubkey…], entries: [tag…] }]`, ordered.
  - `dutiesOf(pubkey, duties)` → `{ scores, lists, concepts, count }`.
  - `mapOnlyAssistants(duties, rows)` → `[{ pubkey, count }]`.
  - `dutySentence(duty, names)`, where `names` is `{ pubkey: name }` and a missing name falls back to `npubShort`.
  - `dutyRows(duties, names, rows)` → `[{ rank, key, title, level, preferred, untagged, alternates: [name…], sentence,
    raw }]`, where `raw` is a string holding each entry as JSON.
  - `rowActions(untaggedLocalRow)` → `{ change: null, remove: null }`. The row must therefore draw Remove only when
    there is one.
- **The markup contract the browser tests add** (stories 1 and 2's still holds):
  - each row's status is its own element: **On Treasure Map** or **Not on Treasure Map**. The count beside the total
    is its own element: **N on your Treasure Map**;
  - the tabs are `role="tablist"` with two `role="tab"` (Assistants, Duties) carrying `aria-selected`. The arrow keys
    move the selection and the focus. Only the selected panel is in the page;
  - the not-tagged section is a region named by its heading, **On your Treasure Map, but not tagged**. Its buttons
    are named **Tag: Brainstorm** and **Tag: Tapestry**, and an unavailable one's reason is its description;
  - the Duties tab's rows are a list named **Duties on your Treasure Map**, one listitem per duty, and a duty's toggle
    is its one element with `aria-expanded`. In a closed duty, its number, name, key and level are each their own
    element. Opened, **Preferred** and **Alternate** / **Alternate N** are each their own element;
  - **N duties** and **Most generic first** are each their own element.

## How to run

```
node -e "const m=require('./test/my-assistants-map.test.js'); Promise.resolve(m.run()).then(r=>process.exit(r.fail?1:0))"
node -e "const m=require('./test/my-assistants-actions.test.js'); Promise.resolve(m.run()).then(r=>process.exit(r.fail?1:0))"
node -e "const m=require('./test/my-assistants-page.test.js'); Promise.resolve(m.run()).then(r=>process.exit(r.fail?1:0))"
npx playwright test tests/brainstorm/my-assistants-map.spec.js tests/brainstorm/my-assistants.spec.js tests/brainstorm/my-assistants-actions.spec.js --project=chromium
```

The Playwright run takes `BRAINSTORM_BASE_URL`, pointing at a `vite preview` of a build. Everything is mocked.

## Verification

### The new tests fail on the current code

Confirmed 2026-09-30 at `2a108aec`.

**Node:**
- **`my-assistants-map`:** 14 failed, 0 passed. Each failure names what's missing:
  - `…does not export treasureMapDuties()`;
  - `…does not export dutySentence()`;
  - `the untagged Local row's actions should be { change: null, remove: null }; got null`;
  - `…should be useTreasureMap(pubkey, { strict = false } = {})`;
  - `…DutiesTab.jsx does not exist`;
  - `withdrawTaggings should forward the relays it is given, not name a list; got "({ ids, addresses }) =>
    publishTaggingWithdrawalWithReport({ ids, addresses, relays: WITHDRAW_RELAYS }),"`.
- **`my-assistants-actions`:** 27 passed, 2 failed:
  - V6: `got null`;
  - O9: `Remove: the withdrawal should be sent to [...,"wss://dcosl.brainstorm.world"]; got undefined`.
- **`my-assistants-page`:** 52/52, unchanged.

**Playwright** against a `vite preview` of `2a108aec`'s build:
- the map spec: **11 failed**, each at something this story adds. M1 and M2 fail on the count, M3 on the error line,
  M5 on the Local row's toggle, M6, M6b and M9 on the section, M7 on the tablist, and M4, M8 and M8b on the Duties
  tab;
- story 2's spec: C4 (the Local row's toggle) and C16 (the count) fail, and the other 21 pass;
- story 1's spec: 15/15, including the re-aimed A11.

### The tests can pass

The oracle is a throwaway implementation of ADR 0003 in a scratchpad mirror of `2a108aec`, never committed. On it:
- **Node:** `my-assistants-map` 14/14, `my-assistants-actions` 29/29, `my-assistants-page` 52/52.
- **Playwright:** the three specs passed 48/48 before M8b was added, and **144/144** under `--repeat-each=3`. With M8b,
  the map spec passed 11/11.

### The tests bite

Each mutant was applied to the oracle alone. Each fails the tests named.

| Mutant | Fails |
|---|---|
| the page reads the map without `strict` | M2 |
| an unreadable map reads as known | M3 |
| statuses shown while the map loads | M3, M4 |
| the untagged Local row doesn't open | M5 |
| the section lists Assistants already in the list | M6, M6b |
| the section's buttons ignore availability | M6b |
| both tab panels rendered | M3, M7 |
| arrow keys ignored | M7 |
| duties in Map order, not most generic first | M8 |
| entries the app can't place shown as duties | M1, M4, M8 |
| every Assistant labelled Preferred | M8 |
| raw entries don't wrap | M9 |
| no Not tagged mark on the Duties tab | M8 |
| the count counts every row | M1, M2, M3 |
| the Duties tab hides the error | M3 |
| Try again doesn't read again | M3 |
| no loading line on the Duties tab | M4 |
| no profiles for the not-tagged Assistants | M6, M8 |
| Alternates not numbered | M8b |
| "Only provider" never said | M8b |

Two edits checked the method:
- **A no-op control edit:** everything passes.
- **"Show the section whenever the map isn't loading":** nothing can tell this apart from the oracle, because the
  section has entries only once a map is found. That's expected, not a gap.

The Node half's mutants are the current code itself: H1, S1, S2, V6 and O9 fail on it, as listed above.
