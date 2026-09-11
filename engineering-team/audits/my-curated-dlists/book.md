# Book of Work: My Curated DLists

**Slug:** my-curated-dlists
**Status:** Closed
**Opened:** 2026-09-10
**Closed:** 2026-09-11
**Strictness:** Standard (project default, proposed at kickoff 2026-09-10; no Light profile).

## Intent anchor

**Acceptance frame (no PRD)** — the operator's ask of 2026-09-10 (in session, the day the
`dlist-curation` book shipped to production), restated at kickoff with the operator's answers
folded in: the items table's three views (bullet 6, in the operator's words), the shared header's
import-when-absent path (bullet 4), and no test-data publishing to the community relay.

### Acceptance frame

- [x] **My Curated DLists page.** A "My Curated DLists" menu item, directly below "TA Treasure
      Map" under 🍇 My Grapevine, opens a page listing every DList empowered on my Treasure Map
      (every per-DList entry, kind 39998 or 39999), whichever pubkey each entry names.
- [x] **My assistant's lists open.** An entry naming my own Tapestry Assistant — the signed-in
      user's assistant on this instance — is clickable and opens that list's detail page; entries
      naming any other pubkey are listed but do not open.
- [x] **My assistant's header.** The detail page shows the raw DList header event behind a toggle
      (hidden by default), with a link to the list's entry under Simple Lists
      (`/tapestry/lists/<encoded a-tag>`). The header is expected to be authored by my assistant
      and to carry a `b` tag pointing at the shared DList header; the page says so when it does not.
- [x] **The shared header.** The raw event of the shared DList header that `b` tag points to,
      behind a toggle (closed by default), with a link to its entry under Simple Lists. When it is
      not in local strfry, the page fetches it from the community relay and offers to import it
      into local strfry, after which the Simple Lists link works.
- [x] **Curation method (placeholder).** A panel for editing the method used to curate this list,
      toggled closed by default; placeholder content only in this book.
- [x] **Items table.** The items on my local DList (my assistant's header for the list), in a
      table. By default, only items authored by my assistant to my local DList. "Also show" items
      authored to my local DList by anyone else (off by default). "Also show" **candidates to be
      inherited** — items on the shared community DList that my assistant has not yet copied to my
      local DList (off by default). What makes a community item "already copied" is settled at
      story 3's gate.
      *Vocabulary (operator, 2026-09-10):* an **inherited** item is one my assistant has copied to
      my local DList; a **candidate** is an item on the shared community list not yet copied —
      "candidate" because it might not be inherited under certain scenarios, e.g. when it has more
      downvotes than upvotes (the curation method decides).
- [x] **Update list (placeholder).** A button to have the list items updated; present but not yet
      functional in this book.
- [x] **Nothing else moves.** The TA Treasure Map page (its DList Curation panel included) and the
      Simple Lists pages are unchanged. The only write the book adds is the explicit import of a
      shared header into local strfry — nothing is signed, nothing is published to an external
      relay, and the hosting instance's Neo4j is not written.

## Epics in this book
- `my-curated-dlists` — the page and its menu item, the detail page's two headers, the items table
  with its three views, and the two placeholders (the curation-method panel, Update list). *(All three
  stories Done 2026-09-11; retirement held until `feat/my-curated-dlists` merges to `staging` — OPEN.md
  row 259.)*

## Known constraints acknowledged at kickoff
- **What `inherit-items` means is changing — deferred to the book that builds Update.** The
  operator's intent (2026-09-10): `inherit-items` means the assistant *copies* the parent list's
  items — the assistant adds or removes items by authoring (sometimes deleting or invalidating) its
  own item events; "if the Assistant weren't doing that, what role would the Assistant even play?"
  The facet as ratified in `dlist-curation` #3 is live and copy-free
  (`protocols/drafts/inherit-from.md` § "Resolution: the resolved item set"; ADR
  `dlist-curation/0003`), and the DList Curation panel's shipped copy says "inheriting the
  community's items, never duplicating them". Nothing in this book depends on the resolution — the
  Update list button is a placeholder — and bullet 6's labels follow the operator's meaning and
  vocabulary (inherited = copied by my assistant; candidate = on the shared list, not yet copied,
  possibly never). OPEN.md row 252.
- **"My assistant" is the signed-in user's own** — the instance TA for the owner, a per-user key for
  everyone else; never the instance owner's assistant for everyone (OPEN.md row 188 pin; the
  escaped defect of the `treasure-map-user-assistant` book).
- **No graph write.** Importing a shared header into local strfry writes no Neo4j: the live
  strfry → Neo4j stream ingests only kinds 3, 10000 and 1984 (`src/pipeline/stream/redis-consumer.js`),
  and nothing in this book calls an import lane (`dlist-curation` epic, review #3 NB-10).
- **Live data (checked 2026-09-10).** Staging's local strfry holds both users' assistant headers for
  `dog-breed` (`8e901369…` and `253d40c4…`, each with the `inherit-items` `b`) but **not** the
  community header `39998:11f23fe4…:dog-breed` (authored by this Mac Studio's TA) — so story 2's
  import path is what staging exercises. The community list's two items (`sheep dog`,
  `golden retriever`) were found in this Mac Studio's local strfry and nowhere else checked (dcosl,
  staging, production). The operator declined publishing test data: staging checks cover the empty
  item states, and populated tables are verified locally with stubbed data.

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** high for the as-built (every story independently reviewed and verified live
  on the local stack, one real import); medium for end-to-end with a real signer — the operator's
  staging check follows the close (audit header, §8)

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/my-curated-dlists/audit.md`
- Product feedback: `engineering-team/audits/my-curated-dlists/prd-seed.md`
