# ADR 0001: Tapestries nav + View Tapestries directory, sourced from strfry

**Status:** Proposed
**Date:** 2026-07-23
**Story:** `engineering-team/stories/tapestries/1-tapestries-nav-and-directory.md`

## Context

Story `tapestries` #1 adds the navigation shell for the Tapestries feature: a "Tapestries"
group in the main left nav (under Nostr Users) with **View Tapestries** (a directory of all
tapestries) and **Create New Tapestry** (a placeholder), and each directory row links to a
per-tapestry page at `/tapestry/tapestries/:uuid`. Epic guardrails (`epics/tapestries.md`): no new
backend, public placement, route by uuid, never hardcode the TA pubkey.

**Key finding that drives the data-source decision.** The seed element "Tapestry for Dog"
(`39999:<TA>:tapestry-for-dog-ca3b675e`, kind 39999, z-tagged to `39998:<TA>:tapestry`) is
**durably present in strfry** — `strfry scan {"kinds":[39999],"#z":["39998:<TA>:tapestry"]}` returns
it with its full `graph` block — but was **silently dropped from Neo4j** by a reconcile pass (no
process restart; firmware elements and the `dog`/`dog-breed`/`irish-setter`/`golden-retriever`
concepts all survived). The distinguishing factor: the **`tapestry` concept header has no
`IS_THE_CONCEPT_FOR` edge** to its superset (verified: the query returns empty; `dog` has the edge),
so the standard "elements of a concept" enumeration — which walks
`(ConceptHeader)-[:IS_THE_CONCEPT_FOR]->(:Superset)-[:IS_A_SUPERSET_OF*0..N]->()-[:HAS_ELEMENT]->()`
(see `ui/src/pages/concepts/ConceptElements.jsx:32-40,67-75`) — cannot place tapestry elements, and a
reconcile prunes them. **Neo4j is therefore an unreliable projection for tapestry elements; strfry is
the durable source of truth.** (Root cause — the missing class-thread wiring and the pruning
reconcile — is deferred to a separate data-hygiene item per the story's decision; tracked in
`OPEN.md`.)

Relevant existing code:
- Nav config is a plain array `mainNavItems` in `ui/src/components/Layout.jsx:12-51`, rendered by
  the recursive `NavGroup` (`:92-135`); the render filter `!item.ownerOnly || isOwner` (`:175`)
  makes any item without `ownerOnly` public. The "Nostr Users" group is `:43-50`.
- Routes live in one `createBrowserRouter` in `ui/src/App.jsx`; the `/tapestry` shell's children
  array holds each section — `concepts` `:207-236`, `users` `:332-340`. Page components are plain
  eager imports (`:1-93`).
- `queryRelay(filter)` (`ui/src/api/relay.js:12`) → `GET /api/strfry/scan?filter=<encoded>` →
  returns an array of raw nostr events. Already used publicly by the Simple Lists detail pages.
- List-page shell pattern: `ui/src/pages/users/Index.jsx` / `concepts/ConceptList.jsx` — `<div
  className="page">` + `<Breadcrumbs/>` + header + `<DataTable columns … data … onRowClick …
  emptyMessage/>` (`ui/src/components/DataTable.jsx`). Author rendering: `AuthorCell` +
  `useProfiles(pubkeys)`. Config: `useConfig()` gives `taPubkey` (`ui/src/context/ConfigContext.jsx`).
- Minimal stub page: `ui/src/pages/relationships/Index.jsx` (a `page` div + `placeholder` copy).

## Options considered

### Option A — Read tapestry elements from strfry via `queryRelay` (chosen)
The directory calls `queryRelay({ kinds: [39999], "#z": ["39998:" + taPubkey + ":tapestry"] })`,
parses each event client-side (title/description from `JSON.parse(<json tag>).tapestry`, author =
`event.pubkey`, uuid = `39999:${event.pubkey}:${<d tag>}`), and renders them in a `DataTable`.
- **Pros:** Durable — immune to the Neo4j desync we observed. Aligns with decentralized-first
  (strfry is the source; Neo4j is a derived index). No new backend (reuses `queryRelay`). The same
  strfry event carries the `graph` block Story 2 needs, so the element read is reusable downstream.
  Permissionless by construction (lists every author's tapestry elements).
- **Cons:** Diverges from the Concepts pages (which read Neo4j). Title/description/author are parsed
  client-side rather than projected by a query. No server-side WoT/POV filtering (out of scope now).

### Option B — Read from Neo4j via the `ConceptElements` union pattern
Reuse the existing explicit-`HAS_ELEMENT` ∪ implicit-`z`-tag query keyed on the tapestry concept
handle.
- **Pros:** Consistent with the Concepts pages; one data path.
- **Cons:** **We just watched Neo4j drop the only seed element** — the directory would render empty
  until the reconcile root cause is fixed. Fragile for exactly this data. Rejected.

### Option C — New `/api/tapestries` backend endpoint
A server route wrapping the strfry scan + parsing.
- **Pros:** Centralizes parsing; could add limits/paging.
- **Cons:** Violates the epic's "no new backend" guardrail; `queryRelay` already delivers the read
  and the parsing is trivial. Rejected (revisit only if client composition proves heavy).

## Decision
We chose **Option A** — source the directory (and per-tapestry element reads) from **strfry via
`queryRelay`**, parsing events client-side. Neo4j is not trusted for tapestry-element existence.

## Consequences
- **Enables** a directory that reliably lists tapestries regardless of Neo4j reconcile state, and a
  reusable strfry element read that Story 2's exploration page builds on (the `graph` block travels
  in the same event).
- **Constrains:** tapestry reads now have two shapes in the app (concepts → Neo4j; tapestries →
  strfry). This is intentional and documented here.
- **Follow-up / debt:** the Neo4j↔strfry desync and the missing `tapestry` `IS_THE_CONCEPT_FOR`
  wiring are deferred to a separate data-hygiene item (`OPEN.md`). Not blocking, because the feature
  does not depend on Neo4j for tapestry elements.
- **Firmware reinstall required?** No — no concept definitions change in this story.

## Implementation notes
Concrete for the Implementer. New page directory: `ui/src/pages/tapestries/`.

- **`ui/src/pages/tapestries/Index.jsx`** — default export `TapestriesIndex` (the View Tapestries
  directory). Model on `users/Index.jsx`.
  - `const { taPubkey } = useConfig();` then build `const tapestryHandle = `39998:${taPubkey}:tapestry`;`
    (guard render until `taPubkey` is present — never hardcode).
  - Fetch: `queryRelay({ kinds: [39999], "#z": [tapestryHandle] })` in an effect/state (or a small
    hook). For each event derive a row: `dTag = event.tags.find(t => t[0] === 'd')?.[1]`; `uuid =
    `39999:${event.pubkey}:${dTag}``; `json = JSON.parse(event.tags.find(t => t[0] === 'json')?.[1]
    || '{}')`; `title = json.tapestry?.title || dTag`; `description = json.tapestry?.description ||
    ''`; `author = event.pubkey`. Skip events without a `d` tag.
  - `useProfiles(rows.map(r => r.author))` for the author column; render it with `AuthorCell`.
  - `<DataTable columns={[{key:'title',…},{key:'description',…},{key:'author', render:(v)=><AuthorCell
    pubkey={v} …/>}]} data={rows} onRowClick={r => navigate(`/tapestry/tapestries/${encodeURIComponent(r.uuid)}`)}
    emptyMessage="No tapestries yet." />`. Wrap in the `page` shell + `<Breadcrumbs/>` + an `<h1>` and
    a header "Create New Tapestry" link/button to `/tapestry/tapestries/new`.
  - Loading and error states around the `queryRelay` call (mirror `users/Index.jsx`).
- **`ui/src/pages/tapestries/NewTapestry.jsx`** — default export. A **non-functional placeholder that
  previews planned fields**: the `page` shell with an `<h1>Create New Tapestry</h1>`, a short "coming
  soon" note, and a disabled mock form previewing the planned inputs (title, description, member
  concepts) with no working submit. Richer than `relationships/Index.jsx` but still inert.
- **`ui/src/pages/tapestries/TapestryDetail.jsx`** — **minimal placeholder in this story** so the
  row link resolves. Read the single element by uuid (`useParams()`, then `queryRelay({ kinds:[39999],
  authors:[pubkey], "#d":[dTag] })` parsed from the uuid, or filter the directory result) and show
  its title + a "Exploration coming soon" note. **Story `tapestries` #2 replaces this component's body
  with the full Exploration page** (its own ADR). Keep the file + route; #2 fills it in.
- **`ui/src/components/Layout.jsx`** — insert into `mainNavItems` immediately after the Nostr Users
  group (after `:50`), so it renders directly under Nostr Users:
  ```js
  {
    label: '🧵 Tapestries',
    prefix: '/tapestry/tapestries',
    children: [
      { to: '/tapestry/tapestries', label: 'View Tapestries', end: true },
      { to: '/tapestry/tapestries/new', label: 'Create New Tapestry' },
    ],
  },
  ```
  No `ownerOnly` → public.
- **`ui/src/App.jsx`** — add the three imports near the others, and insert a route block into the
  `/tapestry` children after the `users` block (after `:340`):
  ```js
  {
    path: 'tapestries',
    handle: { crumb: 'Tapestries' },
    children: [
      { index: true, element: <TapestriesIndex />, handle: { crumb: 'View Tapestries' } },
      { path: 'new', element: <NewTapestry />, handle: { crumb: 'New Tapestry' } },
      { path: ':uuid', element: <TapestryDetail />, handle: { crumb: 'Detail' } },
    ],
  },
  ```
  (`new` is a static segment; React Router ranks it above the `:uuid` param, so `/tapestries/new`
  resolves to the stub, not the detail page.)

No new dependencies. No CSS required (`page`, `placeholder`, `nav-*`, DataTable styles already exist).

## Out of scope
- The Exploration page's actual content and its as-authored/import-resolution rendering — that is
  `tapestries` #2 and its own ADR (which supersedes the `TapestryDetail` placeholder body).
- The Neo4j↔strfry desync root cause and the `tapestry` concept's missing class-thread wiring —
  deferred to a data-hygiene item in `OPEN.md`.
- Creating/editing tapestries; POV/WoT filtering of the directory; pagination/limits on the scan.
