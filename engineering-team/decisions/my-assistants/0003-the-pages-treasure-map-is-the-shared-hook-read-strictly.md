# ADR 0003: The page's Treasure Map is the shared hook, read strictly; duties are derived in the view-model

**Status:** Accepted
**Date:** 2026-09-30
**Story:** `engineering-team/stories/my-assistants/3-the-treasure-map-on-the-page.md`

## Context

Story 3 finishes the blueprint's page from the viewer's own Treasure Map (kind 10040):
- **AC-1:** read the viewer's own Treasure Map from the relays the Treasure Map page reads;
- **AC-2:** each row's on-map status, and the "M on your Treasure Map" count;
- **AC-3:** each Assistant's duties in its open row, grouped Scores, Lists and Concepts, with "Manage on Treasure Map";
  every row opens, including the untagged Local row;
- **AC-4:** "On your Treasure Map, but not tagged", with story 2's Tag buttons;
- **AC-5:** an Assistants | Duties tab switch;
- **AC-6:** a read-only Duties tab, most generic first, with Preferred then Alternates (book decision 11);
- **AC-7:** honest states. Nothing claims "Not on Treasure Map" from a read that failed or is still loading.

It also carries the withdrawal-send test (§ Also in this cycle, book decision 12).

**What exists:**

- **`useTreasureMap(pubkey)`** (`ui/src/hooks/useTreasureMap.js`). The viewer's newest kind 10040, in **the Treasure
  Map page's order**: local strfry first (`/api/strfry/scan`, `limit: 1`), then the general-purpose relays, which
  come from the graph by a read-only Cypher `POST /api/neo4j/query`, through `/api/relay/external`.
  - It reports `idle | loading | found | none | error`, and every failure is `error`.
  - It has two callers, `MyCuratedDLists.jsx:28` and `CuratedDListDetail.jsx:46`.
- **`classifyEntry(tag)`** (`ui/src/utils/treasureMap.js:31`). This is the app's one parse of a 10040 entry:
  - `ta` is 30380–30389, `tl` is 30390–30399;
  - `dlist` is a named 39998/39999 entry; `designation` is `39998:dlist-header`;
  - `other` is anything else, or an entry without a valid 64-hex delegate.

  Named `3039x` entries are "recognized but inert today". The module is Node-loadable (`.js` imports).
- **The first-occurrence rule.** `markDuplicateEntries` (`:230`) marks repeated Curated DList entries inert. For
  bare List kinds, `findGenericTlDelegation` (`:56`) takes the first entry. Book decision 11 chose the blueprint's
  wording instead: the first is **Preferred**, the rest **Alternates**. Nothing here changes how this app uses a
  Treasure Map, only how this page names the later entries.
- **The page** (ADRs 0001 and 0002):
  - `Index.jsx` holds the state, `AssistantRow.jsx` the row and its panel, `AssistantSearch.jsx` the search card;
  - `myAssistants.js` is the pure, Node-loadable view-model; `assistantActions.js` is the orchestration with injected
    publishers;
  - the untagged Local row isn't a toggle in story 2 (ADR 0002 sub-decision 9), and is to become one "when it gains
    duties".

**Open rows these mechanisms touch** (searched `ledger/` and `OPEN.md` for "10040", "Treasure Map", "first
occurrence" and "useTreasureMap", per OPEN.md row `2026-09-30-adr-misses-open-ledger-rows`):

- **Row 314 (open).** An unreachable relay reads as "nothing there" through `/api/relay/external`, and the row names
  `useTreasureMap` among the callers that still do. Through the hook as it is, a local miss plus unreachable relays
  becomes `none`: **"You haven't published a Treasure Map yet"**, which AC-7 forbids. The endpoint's strict mode
  (`&strict=1`, `src/api/relay/fetchEvents.js:103`) answers `success: false` when no relay could be read.
- **Row 248 (open).** The DList Curation panel counts duplicate entries, where Map Entries keeps the first. This page
  doesn't count or index entries the way that panel does, so it isn't affected. Noted.
- **Row 260 (open).** The Treasure Map *page* can report "not found" for a relays-only Map. The hook was written to
  avoid it, and this page uses the hook.
- **Row `2026-09-27-old-treasure-map-draft-overlaps` (open).** Two drafts of the 10040 grammar disagree ("primary /
  fallback" against "Preferred / Alternate"). The page follows the owner's choice (book decision 11) and the indexed
  draft.

**Concepts:** none new, and no graph change. The Treasure Map has no concept node. `tapestry-assistant` and
`nostr-user-tag` are as in ADRs 0001 and 0002.

## Options considered

### Option A — The page calls `useTreasureMap` with a new opt-in strict mode, and derives everything in the view-model

- The page calls `useTreasureMap(viewer, { strict: true })`. With `strict`, the relay step adds `&strict=1`, so
  "no relay could be read" becomes `error`, not `none`. Without the option, the two existing callers are unchanged.
- Pure functions in `myAssistants.js` turn the event into duties, per-row duties, on-map flags, the not-tagged set,
  and the Duties tab's rows, all from `classifyEntry`.
- The list's read (ADR 0001) and the map's read run separately, so the rows show while the map still loads (AC-7).

- **Pros:**
  - **Exactly the Treasure Map page's Map** (AC-1): same hook, same relays, same order. There's no second
    implementation of "which 10040 is yours".
  - It closes row 314's gap for this caller, additively.
  - All derivation is pure and Node-testable.
  - The list doesn't wait on the slower map read.
- **Cons:**
  - It adds a read-only Cypher POST (the relay list) to the page, so story 1's "the page only reads (GET)" test (A11)
    must accept read-only Cypher POSTs.
  - The strict option is a small change to a shared hook.

### Option B — The server reads the Map and answers duties in `GET /api/assistant/my-assistants`

The handler reads the viewer's 10040 strictly (as `/api/setup/status` does through `readRelayEvents`) and returns
duties per row.

- **Pros:** one request; no Cypher POST from the page.
- **Cons:**
  - A second "which 10040 is yours", with its own relay list, which can disagree with the Treasure Map page (AC-1).
  - It moves `classifyEntry`'s grammar to the server, or duplicates it.
  - It makes the list wait on the map, or needs a second endpoint anyway.

### Option C — The page reads 10040 itself through `/api/relay/external?strict=1`

- **Pros:** no shared-hook change.
- **Cons:** it re-implements the hook's local-first order, relay-list wait and stop rule, which is exactly the drift
  the hook exists to prevent (OPEN.md row 249's chore is moving the Treasure Map page onto it).

## Decision

**Option A.** One hook already defines "your Treasure Map" for this app. Reading it strictly keeps AC-7 honest without
a second definition. The grammar stays where it is, and the derivation is pure.

Sub-decisions:

1. **`useTreasureMap(pubkey, { strict = false } = {})`.**
   - With `strict`, the relay step's URL adds `&strict=1`, and an answer with `success: false` is `error`, as it
     already is. A strict `success: true` with no event is `none`: at least one relay was read, and it held nothing.
   - The local step is unchanged: a failed local scan is already `error`.
   - Callers that pass nothing behave as today.
   - Row 314 gains a note that this caller now reads strictly.

2. **What counts as a duty.**
   - A duty is one distinct entry key (the 10040 tag's first element, `row.raw`) among entries whose `classifyEntry`
     class is `ta`, `tl`, `dlist` or `designation` and that have a valid delegate.
   - `other` entries aren't duties (AC-7).
   - A duty's **Assistants** are its entries' delegates, in the order they appear in the Treasure Map, deduped. The
     first is **Preferred**, and the rest are **Alternate**, numbered when there's more than one.
   - **Group:** `ta` is Scores; `tl` is Lists; `dlist` and `designation` are Concepts.
   - **Level:**
     - **Scope:** a bare kind (`ta`/`tl` with no name) and `designation`;
     - **Exact:** a named `ta`/`tl` and a named `dlist`.
   - **Order** ("most generic first"): Scope before Exact; then Scores, Lists, Concepts; then first appearance in the
     Treasure Map.

3. **Names and sentences,** as story § Copy's table.
   - `<things>` and its singular come from the kind: profiles (30382/30392), events (30383/30393), addressable
     events (30384/30394), content categories (30386/30396), and "items" for any other kind in range.
   - **Two cases the story's table doesn't cover:**
     - **A named List entry (`3039x:<name>`)**, which the app recognizes but doesn't use yet. Its name is
       `<name>`, and its "what" is "the Trusted List “<name>” of `<things>`."
     - **A Curated DList's "list name".** It's shown as the entry's `d` tag (e.g. `dog-breed`). The header's
       display name would need a lookup per list, which the Treasure Map page does and this page doesn't. The gate
       is asked to accept this; the story's `<list name>` becomes `<d tag>`.
   - The sentence is: "I entrust {Preferred's name} to publish and maintain {what}" (the "what" ends with its full
     stop), then, with Alternates, " If it can’t, ask {names joined by “, then ”}."

4. **The view-model gains pure functions,** all Node-testable:
   - `treasureMapDuties(event)` → duties `[{ key, group, level, title, what, assistants: [pubkey…], entries: [tag…] }]`,
     ordered.
   - `dutiesOf(pubkey, duties)` → that Assistant's duties, grouped `{ scores, lists, concepts }`, with a count.
   - `mapOnlyAssistants(duties, rows)` → the delegates not in `rows`, each with its duty count, in first-appearance
     order.
   - `dutyRows(duties, names, rows)` → the Duties tab's rows: rank, title, key, level, Preferred, untagged flag,
     Alternates, sentence, raw.
   - `dutySentence(duty, names)`.
   - `rowActions` changes for AC-3: every row opens. The untagged Local row's actions are
     `{ change: null, remove: null }`, and its panel holds duties and Manage.

5. **The page.**
   - **The tab switch** (`role="tablist"`, two `role="tab"` buttons with `aria-selected`, arrow keys moving between
     them) sits above the search card. The Assistants tab keeps every story 1 and 2 part; the Duties tab is a new
     `DutiesTab.jsx`.
   - **The row status** (On / Not on Treasure Map) and the "M on your Treasure Map" count show only when the map's
     status is `found` or `none`.
   - **While the map loads,** rows show without a status. If its status is `error`, an error line with **Try
     again** (`refresh`) sits under the count, and also on the Duties tab.
   - **Every row opens.** Its panel lists its duties in groups, with "Manage on Treasure Map" (a link to
     `TREASURE_MAP_PATH`), and Change and Remove as in story 2.
   - **The not-tagged section** (`MapOnlySection.jsx`) shows `mapOnlyAssistants` below the list.
     - Its Tag buttons call story 2's `tagProfile` through the same `press`: one at a time, disabled when
       unavailable, reported, then the list refreshes.
     - Its names, URLs and NIP-05s come from `fetchProfilesChunked` on the not-tagged pubkeys.
     - The Duties tab names Assistants from the union of row profiles and these.

6. **The withdrawal's send is pinned** (story 3 § Also in this cycle; review 2, non-blocking 1).
   - `assistantActions.js`'s withdrawal calls `deps.withdrawTaggings({ ids, addresses, relays })` with
     `relays = deps.withdrawRelays || deps.relays`, the same list it reports against.
   - The page's `withdrawTaggings` forwards `args.relays` to `publishTaggingWithdrawalWithReport` and no longer names
     a constant itself.
   - So one list is both sent to and reported. A Node test pins that the send gets that list. Browser test C13 pins
     that the page's list includes dcosl.

## Consequences

- **What it enables.**
  - The blueprint's page is complete, within book decision 2.
  - A later "edit duties here" story could reuse `treasureMapDuties` and the tab.
- **What it constrains.**
  - **A Cypher POST joins the page's requests.** It's the hook's general-purpose relay list. Story 1's A11 must be
    re-aimed to accept a `POST /api/neo4j/query` whose Cypher has no write keyword (`WRITE_KEYWORDS`,
    `src/api/neo4j/queryPost.js:17`), as other `/tapestry` tests do. Browser tests must mock `/api/neo4j/query`,
    `/api/strfry/scan` and `/api/relay/external`.
  - **The Curated DList title shows its `d` tag, not its header name** (sub-decision 3), unless the gate asks for the
    lookup.
- **Debt.**
  - Row 314 narrows by one caller. Row 248 is untouched.
  - The two-drafts row stays open: this page follows the indexed draft's words.
- **Firmware reinstall required?** No.

## Implementation notes

- `ui/src/hooks/useTreasureMap.js`: the `{ strict }` option (sub-decision 1). Keep its doc comment's contract, and
  add the option.
- `ui/src/pages/assistants/myAssistants.js`:
  - the functions of sub-decision 4, importing `classifyEntry` from `../../utils/treasureMap.js`;
  - § Copy's new strings;
  - `rowActions` changed per sub-decision 4.
- `ui/src/pages/assistants/AssistantRow.jsx`: the status line, and the duties panel with Manage. Every row is a
  toggle.
- `ui/src/pages/assistants/MapOnlySection.jsx` and `ui/src/pages/assistants/DutiesTab.jsx` (new).
- `ui/src/pages/assistants/Index.jsx`:
  - the tabs;
  - `useTreasureMap(viewer, { strict: true })`;
  - the profile lookups for not-tagged Assistants;
  - wiring the section's Tag buttons to `press`;
  - `withdrawTaggings` forwarding `relays` (sub-decision 6).
- `ui/src/pages/assistants/assistantActions.js`: sub-decision 6.
- `ui/src/styles.css`: the tabs, the status line, the duties groups, the section and the Duties table, at the
  blueprint's measurements.
- **For the Tester:**
  - **Node:** the view-model's duties functions on fixture 10040 events, covering every class, duplicates, an
    `other` entry, ordering, sentences and names; `rowActions` for the untagged Local row; the orchestration's
    withdrawal getting `relays`.
  - **Browser:**
    - the map states (found, none, error with Try again, loading with no status), each mocked through
      `/api/strfry/scan` and `/api/relay/external`;
    - the tab switch, duties in rows, the not-tagged section's Tag, the Duties tab, and the 375 px layout.
  - **Strict mode:** that the page asks `/api/relay/external` with `strict=1`, and that a strict
    `success: false` reads as unreadable, never "none".
  - **Re-aim** story 1's A11 for read-only Cypher POSTs.

## Out of scope

- Editing duties; the draft grammar (catch-all, wildcards, scopes, adopted providers); the Fallback group.
- The Curated DList header-name lookup (sub-decision 3), unless the gate asks for it.
- Fixing row 314 for the hook's other callers, or the endpoint's non-strict default.
- Any change to how this app *uses* a Treasure Map (first occurrence still wins in its readers).

## Amendment 1 (2026-10-01, after review 1): with no relay to ask, a strict read is unreadable

**Why.** Review 1 (`engineering-team/reviews/my-assistants/3-the-treasure-map-on-the-page.md`, non-blocking 3) found a
path sub-decision 1 didn't consider. When the graph names no general-purpose relay and local strfry misses, the hook
answers `none` without reading any relay. The page then says "You haven’t published a Treasure Map yet" and "Not on
Treasure Map" from a read that never happened, which is what AC-1 and AC-7 forbid. The owner chose at the review gate
(2026-10-01) to treat that as unreadable.

**Sub-decision 7.** With `strict`, a local miss and no general-purpose relay to ask is `error`, never `none`. The page
shows "Couldn’t read your Treasure Map." with Try again. Without `strict` the hook behaves as before, so its other
callers are unchanged.

**What `none` means under `strict`, stated exactly:** local strfry missed, at least one general-purpose relay was read,
and every relay that answered held no Treasure Map. A Map held only by a relay that couldn't be reached still reads as
`none` when another relay answers. That is the endpoint's strict contract (`success: true` when at least one relay was
read), and it isn't changed here.

**Tests.** A browser case: no general-purpose relay and a local miss give the error line and Try again on both tabs,
never the none line, and no relay read is asked for.
