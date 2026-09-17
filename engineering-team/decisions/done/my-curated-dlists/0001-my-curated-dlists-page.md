# ADR 0001: My Curated DLists — a list page and a guarded detail route over the viewer's own Map, on new shared lookup primitives

**Status:** Accepted
**Date:** 2026-09-10
**Story:** `engineering-team/stories/my-curated-dlists/1-my-curated-dlists-page.md`

## Context

The story asks for (quoted in short):
- **AC-1** — a "My Curated DLists" item directly below "TA Treasure Map" under 🍇 My Grapevine; the
  page's breadcrumb ends My Grapevine › My Curated DLists; every other menu item unchanged.
- **AC-2** — signed out: a sign-in prompt. Signed in: *my* Map, looked for where the TA Treasure
  Map page looks, with explicit loading; none found → say so, name where it looked, link to TA
  Treasure Map; a lookup failure is an error, never "no DLists".
- **AC-3** — one row per empowered DList (kind 39998/39999, any pubkey): name from the header
  (found on this instance or at the entry's relay hint) else the d-tag + "header not found"; kind
  and d-tag; **your assistant** / **another pubkey** (short form); relay hint. Empty Map → say so and
  point to the DList Curation panel. A list named twice → the first entry counts, the row notes the
  ignored duplicate.
- **AC-4** — rows naming the signed-in user's own assistant link to the detail page (even when the
  header was not found); other rows do not, and say why; a user with no assistant sees no links and
  a line saying so.
- **AC-5** — the detail page identifies the list and links back. Reached directly, it shows a list
  only if the entry is on the signed-in user's own Map *and* names their own assistant; otherwise it
  says which case applies (signed out · no assistant · not on your Map · empowered for another
  pubkey) and shows no list content.
- **AC-6** — the TA Treasure Map page and the Simple Lists pages unchanged; nothing signed,
  published, or imported.

Facts from the code (read this session):

1. **The Map lookup is inline in the Treasure Map page** — `ui/src/pages/grapevine/TrustedAssertions.jsx`:
   a `useCypher` over the `general purpose relays` superset for websocket URLs (`:25–43`), then
   `queryRelay({ kinds: [10040], authors: [pubkey], limit: 1 })` on local strfry
   (`ui/src/api/relay.js:12`), then `GET /api/relay/external` over the general-purpose URLs, newest
   first (`:67–87`). Its auto-search effect (`:123–127`) depends only on `user?.pubkey`: when the
   page mounts with auth already resolved (SPA navigation), `search()` runs before the cypher
   returns, `relayUrls` is `[]`, the relay step is skipped, and `searched` then stays true — a Map
   that lives only on relays reads as "not found". Suspected from reading, not reproduced; the new
   page must not copy it (OPEN.md row 260).
2. **Per-DList entries** are parsed by `findDListEntries` (`ui/src/utils/treasureMap.js:149–162`):
   `<kind>:<d>` split at the first colon, kinds 39998/39999, the reserved `dlist-header` excluded, a
   64-hex delegate required and lowercased, Map order kept. First occurrence wins (ADR
   `dlist-curation/0002` §5); `markDuplicateEntries` (`:224`) applies it by the raw first element.
3. **The two-step header lookup** — local strfry batched per (kind, delegate), then the entry's
   ws/wss relay hint via `/api/relay/external` only for what is still missing, every failure read as
   missing — is inline in `TreasureMapTagsPanel.jsx:50–96` (ADR `dlist-curation/0006`
   sub-decision 2). `DListCurationPanel.jsx:124–147` has a third, local-only lookup (ADR 0005
   sub-decision 3). ADR 0006 Option C declined to lift either into a shared primitive; the book
   logged that chore as OPEN.md row 249.
4. **Suites pin those pages' source.** Eight suites read `TrustedAssertions.jsx` (the
   `onPublished={search}` / `onMapReplaced={search}` wiring, element order);
   `test/dlist-curation-map-entries.test.js` pins the Map Entries panel's batched lookup
   structurally. Refactoring any of them is outside this story (AC-6) and would force re-aiming
   shipped suites.
5. **"My assistant" is `useAuth().user.assistantPubkey`** (`ui/src/context/AuthContext.jsx:66–70`,
   from `/api/auth/user-classification`) — the signed-in user's own, never `useConfig().taPubkey`
   (OPEN.md row 188; the escaped defect of `treasure-map-user-assistant`). `useAuth()` also exposes
   `loading` (`:26`); the Treasure Map page ignores it and shows its sign-in prompt while auth
   resolves.
6. **Routing.** React Router 7.13.1 decodes each path segment before matching (`decodePath`,
   `ui/node_modules/react-router/dist/development/chunk-LFPYN7LY.mjs:809`), so `useParams()`
   values arrive decoded; `DListDetail.jsx:15` decodes again (harmless for today's d-tags, a
   `URIError` for one containing `%`). Breadcrumbs read `handle.crumb` from matched routes
   (`ui/src/components/Breadcrumbs.jsx`). The grapevine route block is `ui/src/App.jsx:351–361`;
   the 🍇 My Grapevine nav children are in `mainNavItems` (`ui/src/components/Layout.jsx:49` is the
   TA Treasure Map line), rendered as `NavLink`s by `NavGroup`.
7. **The house test pattern** imports zero-import ESM utils behaviorally (`loadEsm` in
   `test/dlist-curation-map-entries.test.js`) and pins JSX structurally. `treasureMap.js` has no
   imports and eight suites import it; logic the Tester should exercise directly belongs there — not
   in a React module, and not behind an extensionless import Node cannot resolve.
8. **`/api/relay/external` cannot tell "unreachable" from "absent"** — it merges per-relay results
   (`src/api/relay/fetchEvents.js`; the limit ADR `treasure-map-relay-presence` M1 names). Any lookup
   built on it inherits that.

**Concepts** (confirmed via `/api/concept-graph/summaries` and `/neighbors`):
`39998:<TA>:list`, `39998:<TA>:tapestry-assistant`, `39998:<TA>:shared-concept` — read for
orientation only; TA resolved at runtime. No concept is added or changed.

**POV reflex checks** (CLAUDE.md): *Who is this true for?* — the signed-in user: their own Map,
their own assistant; a shared URL resolves against the *viewer's* Map. *Where does trust come
from?* — no trust is computed; "mine" is key identity from the classification endpoint, not an
admin or role check. *Could anyone publish their own version?* — yes: every entry is listed,
whatever pubkey it names; only opening the detail view is scoped to the viewer's own assistant, at
read time. *What changes when the POV changes?* — nothing is stored; the page re-derives from the
Map on every load. Principle 4: this story writes nothing.

## Options considered

### Option A — Two self-contained pages with inline lookups (copy the house pattern)
Each new page carries its own Map-lookup effect (a copy of the Treasure Map page's `search`) and
its own header-lookup effect (a copy of the Map Entries panel's).
- **Pros.** Smallest diff; no new modules; mirrors its neighbours line for line.
- **Cons.** The Map lookup would exist three times and the two-step header lookup three times (the
  panel plus both new pages) — the debt row 249 already names, grown; the story's two real decisions
  (which entries count, who may open a detail page) would live inside JSX, reachable only by
  structural pins; copying `search` copies its race (fact 1).

### Option B — Run the row-249 chore first: shared hooks, migrate the shipped pages
Lift both lookups into shared hooks, move `TrustedAssertions.jsx`, `TreasureMapTagsPanel.jsx` and
`DListCurationPanel.jsx` onto them, then build the new pages on the same hooks.
- **Pros.** One implementation of each lookup; fixes the Treasure Map page's race too.
- **Cons.** Breaks AC-6 and the book's "nothing else moves"; touches three shipped surfaces pinned by
  eight-plus suites the Tester would have to re-aim — a chore story's risk inside a feature story.

### Option C — New primitives shaped to be the shared ones, consumed only by the new pages (chosen)
Pure, dependency-injected logic in `treasureMap.js` (effective rows, the route id, the front-door
decision, the two-step header lookup); two thin hooks that bind the real fetchers
(`useTreasureMap`, `useCurationHeaders`); two new pages; one nav line; one route block. The shipped
pages are untouched; the row-249 chore later migrates them onto these primitives rather than
designing its own.
- **Pros.** AC-6 holds by construction; the logic is behaviorally testable with fakes; the new Map
  hook is written race-free; the chore's design work is done once, here.
- **Cons.** Until the chore runs, the Map lookup and the two-step header lookup each exist twice
  (old inline + new primitive); keeping the new hook's lookup order equal to the Treasure Map page's
  is a review obligation, not shared code.

## Decision

We chose **Option C**: it is the only option that honors AC-6 without copying a known race, and it
puts the two decisions this story introduces — which Map entries count, and who may open a detail
page — into pure functions the Tester can exercise directly.

### Sub-decisions
1. **Effective rows = the first entry per raw first element**, in Map order, each carrying
   `ignoredDuplicates` (how many later entries repeat its `<kind>:<d>`). Consistent with ADR
   `dlist-curation/0002` §5 and Map Entries; the DList Curation panel's every-entry count (ADR 0005
   sub-decision 2; row 248) is neither followed nor changed.
2. **"Mine" is identity, not a role:** `row.pubkey === user.assistantPubkey` (lowercased), with
   `assistantPubkey` from `useAuth()` — never `useConfig().taPubkey`. No `assistantPubkey` → nothing
   is mine.
3. **The route id is the Map entry's own first element, `<kind>:<d>`** — not the full coordinate:
   `/tapestry/grapevine/curated-dlists/<encodeURIComponent('<kind>:<d>')>`. The assistant is
   derived from the viewer's Map, so a shared or bookmarked URL resolves against the viewer's own
   Map and can never display someone else's curation as theirs (AC-5). The page takes
   `useParams().id` as already decoded (fact 6) and never calls `decodeURIComponent` on it.
4. **The front door is one pure decision** with fixed precedence: `signed-out` → `no-assistant` →
   `bad-id` → `checking` (auth or Map still loading) → `map-error` → `no-map` → `not-on-map` →
   `other-pubkey` → `ok`. Every non-`ok` status renders one sentence plus the back link, and no
   list content.
5. **The Map lookup keeps the Treasure Map page's order and stop rule** — local strfry
   (`limit: 1`), then the general-purpose relays, newest wins — so both pages show the same Map. It
   differs in two ways only: it **waits for the relay list to settle** before the relay step, and it
   reports failures as `error` (a thrown local scan, a failed relay-list query, an
   `/api/relay/external` response without `success`), never as `none`. `none` carries the relay URLs
   searched, so the page can name them (AC-2).
6. **The header lookup keeps ADR 0006's rule** (local per (kind, delegate) batch; then the entry's
   ws/wss hint, only for what is still missing) but **marks a failed step** (`failed: true`) apart
   from an absent header. Story 1 renders both as "header not found" with where it looked ("couldn't
   check" when failed); story 2 needs the difference.
7. **Names** come from the header's `names[1]`, as Map Entries and the DList Curation panel read
   them; fallback the d-tag.
8. **Nested route**, so the detail breadcrumb reads My Grapevine › My Curated DLists › Detail and
   the nav item stays highlighted on detail pages (`NavLink` without `end`).

## Consequences
- **Enables stories 2–3.** The detail page already holds the verified header event (story 2's raw
  toggle and `b`-tag checks read it) and the access decision; they append sections below the front
  door.
- **Temporary duplication.** The Map lookup and the two-step header lookup each exist twice until
  the row-249 chore migrates `TrustedAssertions.jsx` and `TreasureMapTagsPanel.jsx` (and, for the
  local-only case, `DListCurationPanel.jsx`) onto `useTreasureMap` / `lookupCurationHeaders`. Row 249
  now names these as its targets.
- **The Treasure Map page's race** (fact 1) is logged as OPEN.md row 260 and not fixed here (AC-6).
- **Inherited limit** (fact 8): an unreachable relay reads as "not there", as on the Treasure Map
  page; the page's copy names where it looked instead of claiming absence everywhere.
- Adds five exports to a util eight suites import; existing exports unchanged.
- **Firmware reinstall required?** No — no concept definition changes.

## Implementation notes

1. **`ui/src/utils/treasureMap.js`** — a new section
   `/* ── My Curated DLists (my-curated-dlists #1, ADR 0001) ── */`; the file stays zero-import.
   - `curatedDListRows(tags, assistantPubkey)` →
     `Array<{ kind, d, pubkey, relay, coord, routeId, mine, ignoredDuplicates }>`. Built on
     `findDListEntries(tags)`: keep the first entry per `raw`, count later repeats into that row's
     `ignoredDuplicates`; `coord = \`${kind}:${pubkey}:${d}\``; `routeId = raw`;
     `mine = typeof assistantPubkey === 'string' && assistantPubkey !== '' && pubkey === assistantPubkey.toLowerCase()`.
     Never throws; `[]` for garbage.
   - `parseCuratedDListRouteId(id)` → `{ kind, d } | null` — `/^(39998|39999):(.+)$/` on a string;
     `d !== 'dlist-header'`. Never throws.
   - `curatedDListPath(routeId)` → `'/tapestry/grapevine/curated-dlists/' + encodeURIComponent(routeId)`.
   - `curatedDListAccess({ signedIn, authLoading, assistantPubkey, mapStatus, tags, id })` →
     `{ status, row }`, precedence per sub-decision 4; `mapStatus` ∈
     `'loading' | 'found' | 'none' | 'error'`; `row` is the effective row matching `id` (so
     `other-pubkey` can name its short pubkey), else `null`. Never throws.
   - `lookupCurationHeaders(rows, { scanLocal, fetchRelay })` →
     `Promise<{ [coord]: { event, where: 'local'|'relay', checkedRelay: string|null } | { missing: true, checkedRelay: string|null, failed: boolean } }>`.
     Step 1: one `scanLocal({ kinds: [kind], authors: [pubkey], '#d': ds })` per (kind, pubkey)
     group, newest per coordinate. Step 2: for each still-missing row whose `relay` matches
     `/^wss?:\/\//i`, `fetchRelay({ kinds: [kind], authors: [pubkey], '#d': [d] }, relay)` →
     `{ success, events }`; keep events matching the row's kind, pubkey and `d`; newest wins. A
     thrown or unsuccessful step sets `failed: true` on the rows it covered. Never rejects.
2. **`ui/src/hooks/useTreasureMap.js`** (new) — `useTreasureMap(pubkey)` →
   `{ status: 'idle'|'loading'|'found'|'none'|'error', event, where: 'local'|'relay'|null, relays: string[], error: string|null, refresh }`.
   The relay list: the same `general purpose relays` cypher as `TrustedAssertions.jsx:25–29`, parsed
   the same way (`nostrRelay.websocketUrl`). Sequence: `idle` without a pubkey; local `queryRelay`
   first; if nothing, wait for the cypher to settle (`useCypher`'s `loading`), then
   `GET /api/relay/external?filter=…&relays=…` — skipped (not failed) when the list is empty; newest
   event wins. A header comment says the order/stop rule is deliberately the Treasure Map page's
   and that row 249's chore moves that page onto this hook.
3. **`ui/src/hooks/useCurationHeaders.js`** (new) — `useCurationHeaders(rows)` →
   `{ headers, loading }`, wrapping `lookupCurationHeaders` with `scanLocal = queryRelay` and
   `fetchRelay = (filter, url) => fetch('/api/relay/external?filter=…&relays=…').then((r) => r.json())`;
   re-runs when the set of `coord`s changes; ignores results after unmount.
4. **`ui/src/pages/grapevine/MyCuratedDLists.jsx`** (new) — title `🍇 My Curated DLists`,
   `<Breadcrumbs />`, one-line subtitle. `useAuth()`: while `loading`, a loading line (not the
   sign-in prompt); signed out, the sign-in prompt. `useTreasureMap(user?.pubkey)`: loading /
   error (red box with the message, nothing else) / none ("No Treasure Map found — searched local
   strfry and N general-purpose relays: …", link to `/tapestry/grapevine/treasure-map`) / found.
   Found: `curatedDListRows(event.tags, user.assistantPubkey)`; empty → "Your Treasure Map empowers
   no DLists yet" plus a link to TA Treasure Map naming its DList Curation panel. Otherwise
   `useCurationHeaders(rows)` and one row each:
   - the name — a `<Link to={curatedDListPath(row.routeId)}>` when `row.mine`, plain text otherwise
     — or the d-tag with "⏳ checking…" / the `describeHeaderLookup` text ("couldn't check" when
     `failed`);
   - `<code>{kind}:{d}</code>`; a badge "your assistant" / "another pubkey · <short>"; the relay hint;
   - "duplicate entry ignored" when `ignoredDuplicates > 0`;
   - for non-mine rows: "Only lists your own assistant curates open here."
   When `!user.assistantPubkey`, one line above the list: "You don't have a Tapestry Assistant on
   this instance, so none of these lists open here."
5. **`ui/src/pages/grapevine/CuratedDListDetail.jsx`** (new) — `const { id } = useParams()` (no
   decode); `useAuth()`; `useTreasureMap(user?.pubkey)`; `curatedDListAccess(…)`. Non-`ok`:
   `<Breadcrumbs />`, one sentence per status (signed out · no assistant on this instance · not a
   curated-DList address · checking · the lookup error · no Treasure Map found · "`<kind>:<d>` is
   not on your Treasure Map" · "empowered for another pubkey · <short> — only lists your own
   assistant curates open here"), and `← My Curated DLists`. `ok`: `useCurationHeaders([row])`;
   heading = `names[1]` or the d-tag; `<code>{kind}:{d}</code>`; "curated by your assistant ·
   <short assistant pubkey>"; the header's lookup state; `← My Curated DLists`. A marked comment
   below is the insertion point for stories 2–3.
6. **`ui/src/App.jsx`** — import both pages; in the `grapevine` children, directly after
   `treasure-map`:
   `{ path: 'curated-dlists', handle: { crumb: 'My Curated DLists' }, children: [ { index: true, element: <MyCuratedDLists /> }, { path: ':id', element: <CuratedDListDetail />, handle: { crumb: 'Detail' } } ] }`.
7. **`ui/src/components/Layout.jsx`** — in the 🍇 My Grapevine children, directly after the TA
   Treasure Map line: `{ to: '/tapestry/grapevine/curated-dlists', label: 'My Curated DLists' },`
   (no `end`).
8. **Nothing else.** No change to `TrustedAssertions.jsx`, `TreasureMapTagsPanel.jsx`,
   `DListCurationPanel.jsx`, `DListDetail.jsx`, `avatarMenuLinks.js`, or any server file. The new
   files call no signer, no `/api/strfry/publish`, and no `publish*` helper.

Testable seams for Phase 3 (the Tester's call, listed so nothing has to be reverse-engineered): the
five util functions behaviorally, with fakes for `scanLocal` / `fetchRelay`; structurally, the nav
line's position, the route block, the pages' use of `user.assistantPubkey` and absence of
`taPubkey` / signing / publishing, and the no-decode rule; sentinels that the four shipped files
are unchanged. Registering the suite in `test/test.js` is Phase 3's.

## Out of scope
- Story 2's header sections (raw toggles, Simple Lists links, `b`-tag expectations, the import) and
  story 3's items table, method panel, and Update button.
- Migrating the shipped pages onto the new primitives (row 249) and fixing the Treasure Map page's
  race (row 260).
- A per-relay probe that separates unreachable from absent (fact 8).
- An avatar-menu link to the new page.
