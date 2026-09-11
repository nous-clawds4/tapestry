# Epic: my-curated-dlists

**Created:** 2026-09-10
**Status:** Open
**Book:** `engineering-team/audits/my-curated-dlists/book.md` (acceptance-frame)
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
2. *(planned)* The two headers — the assistant's header (raw toggle, Simple Lists link, the
   authorship and `b`-tag expectations) and the shared header (raw toggle, Simple Lists link,
   community-relay fetch plus Import to local strfry when absent). Feature.
3. *(planned)* The items table (default: the assistant's own items on the local DList — the
   inherited ones; "also show" others' items on the local DList; "also show" candidates to be
   inherited — community items not yet copied), the curation-method placeholder panel, and the
   placeholder Update list button. Feature. Open at its gate: what makes a community item "already
   copied".

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
  deferred to the book that builds Update (book § Known constraints; OPEN.md row 252).

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

## Decisions
`decisions/my-curated-dlists/`:
- `0001-my-curated-dlists-page.md` — story 1: new lookup primitives shaped to be the shared ones
  (effective rows, route id, front-door decision, two-step header lookup in `treasureMap.js`;
  `useTreasureMap`, `useCurationHeaders`), consumed only by the two new pages; shipped pages
  untouched (Option C).
