# Epic: my-curated-dlists

**Created:** 2026-09-10
**Status:** Done
**Retired:** 2026-09-11 — after PR #637 merged `feat/my-curated-dlists` into `staging`; folders under `done/my-curated-dlists/` (book closed 2026-09-11; OPEN.md row 266).
**Book:** `engineering-team/audits/my-curated-dlists/book.md` (acceptance-frame; **closed 2026-09-11**
— all three stories Done; the epic retires at the staging merge, OPEN.md row 266)
**Provenance:** Operator request, 2026-09-10 in-session — the follow-on to the `dlist-curation`
book (closed and in production the same day). No `_intake.md` entry: the request went straight
into the book and story 1.

## Goal
A signed-in user has one place to work with the DLists their Tapestry Assistant curates for them:
a "My Curated DLists" page under 🍇 My Grapevine that lists every DList their Treasure Map empowers
(whoever is empowered), and — for lists their own assistant curates — a detail page showing the
assistant's header and the shared community header it points to (raw events, Simple Lists links,
an import path when the shared header is not local), the list's items in a table with three views,
and two placeholders for what comes next: the curation-method panel and the Update list button.

## Stories
`stories/my-curated-dlists/`:
1. `1-my-curated-dlists-page.md` — the menu item, the list of empowered DLists, and the detail
   page's front door (identity, and the guard against showing a list that is not the viewer's
   own). Feature.
2. `2-the-two-headers.md` — the assistant's header (raw toggle, Simple Lists link, the authorship
   and `b`-tag expectations) and the shared header (raw toggle, Simple Lists link, community-relay
   fetch); Import to local strfry for either header when found only on a relay. Feature.
3. `3-items-method-and-update.md` — the items table (default: the assistant's own items on the
   local DList; "also show" others' items; "also show" candidates to inherit — shared items not yet
   copied, "copied" meaning one of the assistant's items points back at it), the curation-method
   placeholder panel, the placeholder Update list button, and story 2's review fix (a real pointer
   wins over `b-tag-deferred`). Feature.

## Settled at kickoff (2026-09-10)
Operator answers:
- Items default to the assistant's own; two "also show" options, both off (frame bullet 6, in the
  operator's words).
- Shared header absent from local strfry → fetch it from the community relay and offer Import to
  local strfry (the first of three options offered; Simple Lists itself stays unchanged).
- No test data is published to the community relay.
- `inherit-items` will mean "copied by the assistant": an **inherited** item is one the assistant
  has copied to the local DList; a **candidate** is an item on the shared community list not yet
  copied — possibly never, e.g. when it has more downvotes than upvotes (the curation method
  decides). Reconciling that with the ratified facet and the DList Curation panel's copy is
  deferred to the book that builds Update (book § Known constraints; OPEN.md row 259).

Defaults proposed at kickoff and not objected to:
- The menu item is a sibling directly below TA Treasure Map in 🍇 My Grapevine, not a nested
  submenu.
- The page is signed-in only and finds the Map where the TA Treasure Map page finds it; headers and
  items are read from local strfry first, then the DList relays.
- A header that is missing, or a `b` tag that is missing, duplicated, or not `inherit-items`, is
  reported on the page rather than failing silently.
- The DList Curation panel on the TA Treasure Map page is left as it is (its rows keep linking to
  Simple Lists).

## Close-out follow-ups (harvested at the story gates; for `/close-book`)
- **Story 1 review NB-5 — for stories 2–3, which reuse the detail route:** a d-tag containing the
  literal characters `%2F` does not round-trip (React Router 7 turns `%2F` back into `/` inside a
  param); every other shape does. Unrealistic for real d-tags.
- **Story 1 review NB-4 — for story 3 or the row-249 migration:** `lookupCurationHeaders` awaits
  each scan and hint fetch in turn (as Map Entries does); run each step's calls concurrently when
  lists grow.
- **Story 1 review NB-2 — before row 249 moves the Treasure Map page onto `useTreasureMap`:** key the
  hook's state to the pubkey it belongs to (a direct A→B account switch shows A's Map for one
  render; the shipped UI cannot reach it today).
- **Story 1 review NB-1/NB-3 (cosmetic):** an `https://` hint reads "no relay hint" beside the hint
  it names; the detail page says "Checking your Treasure Map…" while auth resolves.
- **Story 2 review NB-1 — needs an ADR 0002 amendment (sub-decision 2, test U4, the section):**
  the page shows "marked deliberately unaffiliated" beside a live pointer, but the house rule is that
  a real pointer supersedes the sentinel (`dispositionOf` in `src/lib/bValueForms.js` /
  `ui/src/utils/bDisposition.js`; `protocols/drafts/shared-concepts.md:43`). No house tool writes such
  a header; the harness cause is OPEN.md row 262.
- **Story 2 review NB-2:** when the local scan fails but the relay finds a header, the section says
  "not in this instance's strfry" without having verified it (`lookupCurationHeaders` drops the local
  failure on a relay hit — `treasureMap.js` step 2).
- **Story 2 review NB-3/NB-4/NB-5 (small):** the import control is re-enabled during its re-check (a
  second click re-sends — harmless) and its "re-checking…" note could in theory stick; "Points to"
  shows the shortened coordinate where ADR note 3 says the coordinate; a fifth, unpinned copy of the
  `b-tag-deferred` literal (`treasureMap.js`) — import it from the house owner or pin it with the
  other four (`test/b-coverage-audit-and-disposition.test.js`).
- **Story 3 review NB-1 — an item on both lists is listed twice:** an item my assistant wrote that
  also carries the shared list's `z` shows as "your assistant" and again as a "candidate". Nothing
  writes such items today; if Update's copies carry the shared `z`, every copy reappears as a
  candidate (OPEN.md row 259).
- **Story 3 review NB-2/NB-3 (small):** after a partial read (one source failed) the empty sentence
  still states "none" beside the failure note; the newest version of an item wins its name while the
  Simple Lists link opens the local (possibly older) copy.
- **Story 3 review round 2 (small, Tester's lane):** S10 pins that `itemsEmptySentence(…)` is
  rendered but not its argument — passing the hook's raw `shared` instead of `sharedList` would keep
  every test green; U9 accepts a curly apostrophe. The predicate is "not failed on both sources", so a
  `failed`/`skipped` record would still claim "no candidates" (unreachable here: the relay is the
  constant dcosl).
- **Story 2 review NB-6 — AC-4's scope, for the record:** the no-graph/no-external-publish claims
  hold for everything this feature can import; outside it, an owned kind-39999 tapestry letter would
  trigger the publish endpoint's brain-write hook, and the opt-in `dcosl` router preset (off by
  default, off here) would mirror an imported header to the DCoSL relays.

## Decisions
`decisions/my-curated-dlists/`:
- `0001-my-curated-dlists-page.md` — story 1: new lookup primitives shaped to be the shared ones
  (effective rows, route id, front-door decision, two-step header lookup in `treasureMap.js`;
  `useTreasureMap`, `useCurationHeaders`), consumed only by the two new pages; shipped pages
  untouched (Option C).
- `0002-the-two-headers.md` — story 2: pure pointer checks (`describeCurationHeader`), the shared
  header resolved through the story-1 lookup at the community relay, `refresh()` on
  `useCurationHeaders`, and the page's one write (Import to local strfry) isolated in
  `CuratedDListHeaders.jsx` (Option A).
- `0003-items-method-and-update.md` — story 3: pure item logic (`lookupListItems`,
  `curatedItemRows`, `itemRouteId`, `sharedListUnavailable`), `useListItems`, a new
  `CuratedDListItems.jsx` (method panel, items section, Update placeholder), the shared list read
  only while "candidates" is on; amends ADR 0002 sub-decision 2 to the house `b`-value rule
  (`bDisposition.js`) for AC-7 (Option A).
