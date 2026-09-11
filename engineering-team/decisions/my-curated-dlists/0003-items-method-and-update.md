# ADR 0003: Items, the curation-method panel, and Update list — pure item logic, a lazy shared-list read, and the house b-value rule

**Status:** Accepted
**Date:** 2026-09-11
**Story:** `engineering-team/stories/my-curated-dlists/3-items-method-and-update.md`
**Amends:** ADR `my-curated-dlists/0002` sub-decision 2 (the `deferred` rule) — see sub-decision 9.

## Context

The story asks the curated-DList detail page for:
- **AC-1** — an "Items" table of the items on my local DList (items whose list reference is my
  assistant's header): Name · Author · From · Added, each row linking to the item's Simple Lists
  entry; default = only my assistant's items; looked for in this instance's strfry and on the
  community relay; explicit loading/empty; a failed lookup reads "couldn't check", never "empty".
- **AC-2** — "Also show items others added to this list", off on every load → rows marked
  **someone else**.
- **AC-3** — "Also show candidates to inherit", off on every load → items on the shared list not
  already copied, marked **candidate**; "already copied" = one of my assistant's items carries the
  shared item's event id or coordinate in any tag; with no shared header, the option says why.
- **AC-4** — a "Curation method" panel, closed on every load, placeholder text only.
- **AC-5** — an "Update list" button, present, disabled, with a "not built yet" line.
- **AC-6** — stories 1–2 unchanged except AC-7; story 2's import stays the page's only write.
- **AC-7** — a real pointer beside `b-tag-deferred` wins: the page follows it and does not say
  "deliberately unaffiliated"; the sentinel alone still reads that way.

Facts from the code (read this session):
1. **How items point at lists.** Simple Lists reads a 39998 list's items as kinds 9999/39999 with
   `#z` = the list coordinate (`ui/src/pages/lists/DListItems.jsx:67–88`). Its row id is
   `39999:<pubkey>:<d>` for kind 39999 and the event id for 9999 (`DListItems.jsx:365–367`), opened
   at `/tapestry/lists/items/<encoded id>` (`:459`). That item page
   (`ui/src/pages/events/DListItemDetail.jsx`) reads **local strfry only** (`queryRelay`), so its link
   works only for items this instance holds.
2. **Scan bounds.** `/api/strfry/scan` caps a read (`SCAN_MAX_EVENTS` unless `limit` is given) and
   reports `truncated` / `total` (`src/api/strfry/queries/scan.js:25–70`); `queryRelayBounded`
   (`ui/src/api/relay.js`) returns that envelope. `/api/relay/external` reports neither truncation
   nor unreachable-vs-empty (ADR 0001 fact 8).
3. **The house b-value owner.** `ui/src/utils/bDisposition.js` — zero-import, the UI mirror of
   `src/lib/bValueForms.js` — exports `SENTINEL`, `classifyBValue(value)` (`a-tag` | `event-id` |
   `sentinel` | `malformed`) and `dispositionOf(bValues, selfCoord)` whose `deferred` is
   `sentinel && !real`: a real `b` (a-tag *or* event id) beats the sentinel
   (`protocols/drafts/shared-concepts.md:43`). ADR 0002's `describeCurationHeader` set `deferred`
   whenever the sentinel was present (story 2 review NB-1) and kept a fifth, unpinned copy of the
   literal (NB-5); story 2's suite U4 pins that behaviour; OPEN.md row 262 records why it diverged.
4. **The page after story 2.** `CuratedDListDetail.jsx` already computes `info =
   describeCurationHeader(…)` and the shared row (pointer + `COMMUNITY_RELAYS[0]`), renders the two
   header sections, and carries a "Story 3 inserts here" comment. Stories 1–2's suites pin the page,
   the list page, and the two hooks write-free, and story 2's S5 pins the page's two
   `useCurationHeaders` calls ahead of its first return.
5. **Time.** `timeAgo(unixSeconds)` in `ui/src/utils/timeAgo.js` (a tested util) renders ages.
6. **Data here.** On this Mac Studio the shared `dog-breed` list has two items (sheep dog, golden
   retriever) in local strfry and none on dcosl; no assistant has authored items yet.

**Concepts:** `39998:<TA>:list`, `39998:<TA>:shared-concept`, `39998:<TA>:tapestry-assistant`
(orientation only). No concept is added or changed.

**POV reflex checks.** *Who is this true for?* — the viewer: "my assistant's items" are the viewer's
own assistant's; "someone else" is relative to that. *Where does trust come from?* — none is
computed here; ranking and trust are the curation method's, later, at read time. *Could anyone
publish their own version?* — yes; others' items and every shared item are shown when asked for,
ungated. *What changes when the POV changes?* — nothing stored; every load re-derives. Principle 4:
this story writes nothing.

## Options considered

### Option A — Pure item logic + one items hook + a new items module; the shared list read only on demand (chosen)
- Pure functions in `treasureMap.js`: `itemRouteId`, `lookupListItems` (dependency-injected, both
  sources, honest per-source status and truncation), `curatedItemRows` (the three views and the
  "already copied" rule), `sharedListUnavailable` (why there is no shared list).
- `useListItems` binds the lookup to `queryRelayBounded` and `/api/relay/external`.
- `CuratedDListItems.jsx` holds the method panel, the items section (checkboxes, table, the Update
  placeholder); the shared list is fetched only while "candidates" is on.
- `describeCurationHeader` takes the house rule from `bDisposition.js` (AC-7).
- **Pros.** Every rule the story adds is a pure, testable function; the page stays write-free; no
  shared-list traffic unless asked; the sentinel rule and literal come from their owner.
- **Cons.** A second item reader in the codebase beside Simple Lists' (different job: no trust
  scores, two sources); a third lookup shape in the page family for row 249's chore to consider.

### Option B — Reuse Simple Lists' `DListItems` table
- **Cons.** It reads local strfry only, computes trust scores and ratings, and hosts a Trusted List
  publisher — the curation method's territory and a write surface; it takes one list, not "my list
  + optionally the shared list"; embedding it would couple this page to a shipped page's internals.

### Option C — Option A, but fetch both lists eagerly
- **Cons.** A community-relay read on every page load for a view that is off by default; the
  checkbox would only filter. Rejected on traffic; the lazy read is one conditional.

### Option D — For AC-7, special-case "sentinel beside a pointer" inside `describeCurationHeader`
- **Cons.** Re-derives the house rule a second time — exactly the divergence OPEN.md row 262 names;
  would still miss "event-id `b` beside the sentinel", which the house also treats as real.

## Decision

We chose **Option A** (with the house helpers for AC-7): the story's rules become pure functions,
the page keeps its single write, the shared list is read only when the user asks for candidates, and
the sentinel rule stops diverging from its owner.

### Sub-decisions
1. **"Mine" vs "someone else"** is authorship among items whose `z` is my header: `author ===
   assistantPubkey` (lowercased). With no assistant there is no page (story 1's front door).
2. **"Already copied"** — collect every string value at index ≥ 1 of every tag on my assistant's
   items; a shared item is copied when that set holds its event id or, for kind 39999, its coordinate
   `39999:<pubkey>:<d>`. Tag names are not constrained (AC-3: "in any tag").
3. **The lookup** — per list coordinate, local `{ kinds: [9999, 39999], '#z': [coord], limit: 500 }`
   through the bounded scan, and the same filter on the community relay, run concurrently. Keep only
   kind 9999/39999 events whose `z` equals the coordinate; dedupe by identity (39999 → coordinate,
   newest wins; 9999 → id); mark an item `local` when any copy came from this instance. Per source:
   `local: 'ok' | 'failed'` with `truncated` / `total`, `relay: 'ok' | 'failed' | 'skipped'`
   (skipped when the relay is not ws/wss). Never rejects.
4. **Lazy shared read** — my list is read on mount; the shared list only while "candidates" is on and
   a shared coordinate exists.
5. **Rows** — group order: your assistant → someone else → candidate; within a group by name
   (case-insensitive), then newest first. Name = the item's `name` tag, else "(unnamed)".
6. **The link is gated on `local`** — `/tapestry/lists/items/${encodeURIComponent(itemRouteId(e))}`
   only for items this instance holds (fact 1); a relay-only row reads "on <relay> only" instead. No
   item import (out of scope).
7. **States** — pending → "⏳ Loading items…"; both sources failed → "Couldn't check — looked in this
   instance's strfry and on <relay>." (no table); one failed → the rows plus a note naming it; local
   truncated → "Showing the first N of M found in this instance's strfry" (or "…the first N — there
   are more" when `total` is null); an empty view → one sentence for the view (default: "Your
   assistant hasn't added any items to this list yet.").
8. **Placeholders act on nothing** — the method panel is a `useState(false)` disclosure with text
   only (naming the downvotes-vs-upvotes example); Update is `<button disabled>` with "Update list
   isn't built yet." Neither has a handler that reads or writes.
9. **AC-7 amends ADR 0002 sub-decision 2** — `describeCurationHeader` takes `deferred` from
   `dispositionOf(bValues).deferred` and `not-a-coordinate` from `classifyBValue` (`event-id` or
   `malformed`), importing `SENTINEL`, `classifyBValue`, `dispositionOf` from `./bDisposition.js`;
   its own literal goes (story 2 review NB-5). The followed pointer is unchanged
   (`communityPointerOf`). Consequence for tests: story 2's U4 ("sentinel beside a pointer →
   `deferred: true`") now expects `false` — re-aimed by the Tester in Phase 3.
10. **Placement** — after the shared-header section: the Curation method panel, then the Items
    section with the Update button in its header row.

## Consequences
- Closes story 2 review NB-1 and NB-5; OPEN.md row 262's harness gap stays open (the orientation
  docs still don't name the owner) — this ADR only follows the rule.
- `treasureMap.js` gains its first import (`./bDisposition.js`, itself zero-import, with the `.js`
  extension so Node-loaded suites still resolve it).
- The candidates view is empty on staging until shared items reach the community relay (fact 6);
  on this machine it shows the two local `dog-breed` items.
- A relay page cap cannot be detected (fact 2) — the table can only report the local truncation.
- Row 249's chore gains a third lookup shape to consider (items beside headers and the Map).
- **Firmware reinstall required?** No — no concept definition changes.

## Implementation notes

1. **`ui/src/utils/treasureMap.js`**
   - `import { SENTINEL, classifyBValue, dispositionOf } from './bDisposition.js';` at the top; drop
     `B_TAG_DEFERRED`. In `describeCurationHeader`: `deferred = dispositionOf(bValues).deferred`;
     `not-a-coordinate` when any `b` value classifies `event-id` or `malformed`. Everything else
     (pointer, `wrong-type`, `multiple`, authorship, garbage handling) unchanged.
   - `itemRouteId(event)` → `39999:<pubkey>:<d>` for kind 39999 with a `d`; the event id otherwise;
     null for garbage.
   - `lookupListItems(coords, { scanLocal, fetchRelay }, relay)` →
     `Promise<{ [coord]: { items: Array<{ event, local: boolean }>, local: 'ok'|'failed', truncated: boolean, total: number|null, relay: 'ok'|'failed'|'skipped' } }>`
     per sub-decision 3; `scanLocal(filter)` returns the bounded envelope
     `{ events, truncated, total }`; `fetchRelay(filter, url)` returns `{ success, events }`.
   - `curatedItemRows({ mine, shared, assistantPubkey, showOthers, showCandidates })` → rows
     `{ key, from: 'assistant'|'other'|'candidate', name, author, createdAt, routeId, local }` per
     sub-decisions 1, 2, 5; `mine` / `shared` are `items` arrays from the lookup (`shared` may be
     null). Never throws.
   - `sharedListUnavailable(assistantLookup, info)` → `null | 'checking' | 'failed' | 'missing' |
     'no-pointer' | 'deferred'` (no lookup yet → checking; lookup failed → failed; no header →
     missing; no pointer → deferred when `info.deferred`, else no-pointer).
2. **`ui/src/hooks/useListItems.js`** (new) — `useListItems(coords, relay)` →
   `{ lists, loading }`, binding `scanLocal = queryRelayBounded` and a `fetchRelay` over
   `/api/relay/external` (as `useCurationHeaders` does); keyed on the coordinates and the relay;
   ignores results after unmount. Write-free.
3. **`ui/src/pages/grapevine/CuratedDListItems.jsx`** (new), named exports:
   - `CurationMethodPanel()` — title "Curation method"; `useState(false)`; opened: the method isn't
     built yet, and what it will decide (e.g. skip candidates with more downvotes than upvotes).
   - `UpdateListButton()` — `<button className="btn btn-sm" disabled>Update list</button>` and
     "Update list isn't built yet."
   - `ItemsSection({ myCoord, sharedCoord, sharedUnavailable, assistantPubkey, communityRelay })` —
     title "Items"; `showOthers` / `showCandidates` each `useState(false)`; two
     `useListItems` calls (mine always; shared per sub-decision 4); the "Also show items others added
     to this list" and "Also show candidates to inherit" checkboxes (the second disabled with a
     reason sentence when `sharedUnavailable`); `<UpdateListButton />` in the header row; the table
     (Name · Author · From · Added, the gated link) and the states of sub-decision 7; `timeAgo` for
     Added.
4. **`ui/src/pages/grapevine/CuratedDListDetail.jsx`** — import `CurationMethodPanel`,
   `ItemsSection` from `./CuratedDListItems` and `sharedListUnavailable`; after `<SharedHeaderSection
   …>` render `<CurationMethodPanel />` then `<ItemsSection myCoord={row.coord}
   sharedCoord={info?.pointer?.coord || null} sharedUnavailable={sharedListUnavailable(lookup, info)}
   assistantPubkey={assistantPubkey} communityRelay={COMMUNITY_RELAY} />`, replacing the story-3
   comment. No new hooks in this file (story 2's S5 ordering holds); it stays write-free.
5. **Nothing else.** No change to the list page, `useTreasureMap.js`, `useCurationHeaders.js`,
   `CuratedDListHeaders.jsx` (AC-7 reaches it through `info.deferred`), the shipped Treasure Map
   files, Simple Lists, or any server file.

Testable seams for Phase 3 (the Tester's call): `describeCurationHeader`'s amended `deferred` (the
sentinel alone; beside an a-tag; beside an event id) and story 2's U4 re-aimed; `itemRouteId`;
`lookupListItems` with fakes (both sources, one failed, both failed, truncation, the `z` filter,
dedupe, never rejects); `curatedItemRows` (each view, "copied" by id and by coordinate from any tag
position, grouping and order, the `local` flag); `sharedListUnavailable`. Structurally: the module's
exports, both checkboxes and the panel defaulting closed/off, the disabled Update button with no
handler, the gated link, `timeAgo`, the page's placement, and that the new files write nothing.

## Out of scope
- The curation method's controls and logic; Update doing anything.
- Votes, ratings, trust scores; importing items into local strfry; reading more than the first
  community relay.
- Row 249's shared-primitive chore and row 262's documentation fix.

## Amendment 1 — the empty-view sentence is a pure function (2026-09-11)

**Why.** The first review found the empty view adding "The shared list offers no candidates to
inherit." even when the shared list's read had failed on both sources — beside the "Couldn't check
the shared list" note, contradicting sub-decision 7 and AC-1 ("a failed lookup reads 'couldn't
check', never 'empty'"). The sentence was composed inline in JSX, where only presence could be pinned.

**Change.** `ui/src/utils/treasureMap.js` gains `itemsEmptySentence({ showOthers, shared })` →
string, and `ItemsSection` renders its return value instead of composing the sentence:
- always "Your assistant hasn't added any items to this list yet.";
- plus " No one else has either." when `showOthers`;
- plus " The shared list offers no candidates to inherit." **only** when `shared` (the shared list's
  lookup record, passed only while it is in view) was read and did not fail on both sources.
Partial reads keep today's behaviour (the source note beside the sentence; review round 1 NB-2 stays a
follow-up). Never throws; garbage yields the first sentence. No other part of this ADR changes.
