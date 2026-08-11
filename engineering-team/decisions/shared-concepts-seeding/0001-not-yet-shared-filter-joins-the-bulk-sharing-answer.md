# ADR 0001: The "not yet shared" filter joins the existing bulk sharing answer, and never re-derives it

**Status:** Accepted
**Date:** 2026-08-10
**Story:** `engineering-team/stories/shared-concepts-seeding/3-disposition-filter-on-concepts.md`

## Context

The Concepts list (`ui/src/pages/concepts/ConceptList.jsx`) must gain a state filter that answers
*"which of my concepts haven't reached the community?"*, composing with the existing Author select.

### What the page has today

- Rows come from one Cypher query (`ConceptList.jsx:13-63`) via `useCypher`. Each row carries
  `uuid`, `name`, `author`, and `bValues`.
- `enrichedData` (`:105-119`) derives `_disp = dispositionOf(row.bValues, row.uuid)` —
  `{wired, selfDeclared, deferred}` — plus `_undispositionedMine`.
- Filtering is two `useMemo`s: author (`:145-149`) then the single checkbox (`:150-153`).
- A second data source is already merged in by key: `/api/audit/concepts-summary` is fetched in a
  `useEffect` and joined into `healthMap` by `uuid` (`:76-89`). **Note its `.catch(() => {})` —
  a silent failure.** That pattern is precedent for *shape*, and is exactly what AC-3 forbids for
  this story's source.

**The join key is exact and already in hand:** `dispositionOf(row.bValues, row.uuid)` passes
`row.uuid` as the *self coordinate*, so `h.uuid` is the a-tag coordinate `39998:<pubkey>:<slug>` —
identical in form to the `coord` field the sharing endpoints return. No key derivation is needed.

### Why the row's own disposition cannot answer the question

`_disp.selfDeclared` means "this header carries a b tag pointing at itself" — a **local**
declaration. The owner's ruling, which already has exactly one home in
`src/lib/sharingState.js:12-15`, is that *"`published` is deliberately TRI-state… reporting 'not
shared' on the strength of a check that failed to run is the exact defect the story exists to
remove"*, and that shared means published to a public relay. `resolveSharingState` (`:54-67`)
applies a two-part test — the relay copy must **exist** and **carry the self-pointer**.

So `selfDeclared === true` and `published === false` can both hold at once. That is not an edge
case; it is the failure seeding #1 exists to report.

### The endpoint that already answers it, in bulk

`GET /api/shared-by-me` (`src/api/concept/sharedByMe.js`) is described in its own header as *"the
bulk sibling"*: **two queries total regardless of concept count** — one local `strfry scan`, one
relay round trip — versus N process spawns plus N round trips for the per-coordinate endpoint. It
returns `{success, ta, relay, relayOk, relayError, concepts[]}` where each concept is
`{coord, name, description, declaredAt, published}`, `published` tri-state.

It is already the source behind the **Shared by me** page. Reusing it is what makes AC-2
(*"neither page may be able to contradict the other"*) true **by construction** rather than by
matching two implementations.

Its failure semantics are deliberate and asymmetric (`sharedByMe.js:12-21`): relay unreachable →
200 with `relayOk:false` and every `published:null`; **local** scan fails → non-200, because an
empty list would falsely assert "you have shared nothing".

One structural consequence worth stating: `concepts[]` only contains headers that
`carriesSelfPointer` (`:128`) — i.e. **declared** ones. A concept absent from the response was never
declared, which is knowable from the local scan alone and stays true even when the relay is
unreachable.

### Constraints

- Ratified at Planning: **exclude 🔒 deferred and 🔗 wired**; "not yet shared" is the *work-list* —
  undispositioned plus tried-but-didn't-reach.
- AC-5 forbids presenting *not yet shared* and *undispositioned* as synonyms.
- No new lint/build tooling (CLAUDE.md). No new dependency.
- `undispositionedOnly` also drives `nextUndispositioned` (`:156-157`), the DispositionPanel's
  "Save & next" traversal (`:274-277`). That behavior must survive.

## Options considered

### Option A — Fetch `/api/shared-by-me` lazily, join by `coord`, filter locally

Add a state select. When a state needing publication is first chosen, fetch `/api/shared-by-me`
once, build a `Map(coord → published)`, and cache it for the page's lifetime. The predicate:

```
notYetShared(row) =
     row.author === TA_PUBKEY          // "(mine)", matching the existing scoping
  && !row._disp.wired                  // ratified exclusion
  && !row._disp.deferred               // ratified exclusion
  && publishedFor(row.uuid) !== true    // absent (never declared) or false (didn't reach)
  && publishedFor(row.uuid) !== null    // unconfirmed is never called not-shared (AC-3)
```

**Pros:** AC-2 holds by construction — one source, one rule, one home. AC-4 falls out, because a
self-declared row with `published:false` satisfies the predicate. Cheap: two queries total, and the
join key already exists. No server change. The common page load is unchanged for everyone who never
touches the filter.

**Cons:** a deliberate wait (up to the endpoint's 8s relay timeout) the first time the filter is
used; needs a pending state. Two sources on one page, which must be reconciled on refresh.

### Option B — A new endpoint that returns the not-yet-shared set server-side

**Pros:** one fetch; the page stays a thin renderer.

**Cons:** creates a **second home for the sharing rule**, which `sharedByMe.js:23-25` explicitly
says was consolidated ("two endpoints now compute sharing state and the rule has exactly one
home"). It also bakes the ratified exclusions (🔒/🔗) into the server, where a later change of
product mind means an API change. Rejected on the strength of that comment.

### Option C — Filter on `row._disp.selfDeclared` (the queued intake's recommendation)

**Pros:** genuinely cheapest — zero new I/O, the data is already on every row.

**Cons:** answers a different question. It reports local declaration as sharing, so a concept whose
broadcast failed reads as shared — **fails AC-4 outright and violates AC-2**, putting a second
contradicting answer on a second page. This is the specific defect the book has twice paid to undo.

### Option D — Extend the Cypher to carry publication state

**Cons:** not possible. Neo4j holds the local graph; publication is a fact about a public relay.
Nothing in the graph can answer it.

## Decision

We chose **Option A**.

The deciding argument is AC-2. The story does not merely ask for a correct filter — it forbids the
two pages from being *able* to disagree. Only Option A gets that structurally: the Concepts page
consumes the same endpoint, computed by the same `resolveSharingState`, that the Shared by me page
renders. Options B and C both re-derive the answer, and a re-derivation can drift even when it is
correct on the day it ships.

Option C is rejected despite being the queued recommendation and genuinely the cheapest. Its cost is
not effort, it is truthfulness.

### Failure handling — three tiers, because the honest answer differs

1. **`/api/shared-by-me` non-200** (local read failed → row set unknown): the state filter's
   publication-dependent options are **unavailable**, with the reason shown. It must **never**
   silently fall back to `_disp`, and must never render an empty or partial list as an answer.
   *(Contrast `:76-89`'s `.catch(() => {})`, which is right for a health icon and wrong here.)*
2. **200 with `relayOk === false`** (relay unreachable → every `published` is `null`): concepts
   **absent** from `concepts[]` were never declared and are still knowably not shared, so they are
   listed. Declared concepts are unconfirmed and are **withheld** from the result, with a visible
   count and explanation — satisfying AC-3 without discarding the half of the answer that is still
   sound.
3. **200 with `relayOk === true`:** the full answer.

### Control shape

Replace the single `Coverage` checkbox with a labeled `<select>` in the same grid cell, mirroring
the adjacent Author select. Options: **All states** / **Not yet shared (mine)** / **Undispositioned
(mine)** / **Shared (mine)** / **Wired to external** / **Deliberately private**.

A single-select makes AC-5 structural — two states cannot be active at once, so the page cannot
present *not yet shared* and *undispositioned* as interchangeable. Only the two publication-bearing
options (*Not yet shared*, *Shared*) trigger the fetch; the rest are answered from `_disp` alone and
stay instant.

## Consequences

- **Enables** frame bullet 3, and gives `share-from-shared-by-me` (bullet 1) something concrete to
  link into — the book already anticipates that reduction.
- **Constrains:** the Concepts page now depends on `/api/shared-by-me`. If that endpoint's shape
  changes, this filter changes with it. That coupling is the point.
- **Preserves** `nextUndispositioned` / "Save & next" — the *Undispositioned (mine)* option keeps the
  existing `_undispositionedMine` predicate unchanged, so the panel traversal is untouched.
- **Follow-up not taken here:** the disposition **column** still shows only local chips, so a row can
  read 🤝 while the filter (correctly) counts it as not-yet-shared. Making the column publication-aware
  is a legibility change, out of this story's scope — worth an intake line if it bothers anyone in use.
- **Firmware reinstall required?** **No.** No concept definition changes.

## Implementation notes

No server change.

> **Refinement ratified at the Phase-3 gate (2026-08-11).** This section originally said "all changes
> are in one file". Test Design showed that a predicate living inside the React component can only be
> checked by source grep, and a grep cannot distinguish a correct predicate from a plausible-but-wrong
> one — the exact failure this story exists to prevent. So the predicate is extracted to
> **`ui/src/utils/conceptStateFilter.js`**, dependency-free (no React, no `fetch`, no app imports),
> exporting `STATES` and `matchesState(row, state, ctx)`. This follows the existing
> `ui/src/utils/bDisposition.js` shape and the "pure core" split of ADR firmware-explorer/0001; `ui/`
> is `"type": "module"`, so the module loads under plain node via dynamic import. The page becomes a
> renderer of the predicate rather than its owner. Two files, not one.

- **File: `ui/src/pages/concepts/ConceptList.jsx`**
  - Replace `undispositionedOnly` (`:69`) with a single `stateFilter` string, default `''` (All).
  - Add `sharedByMe` state: `null` (not fetched) | `{loading:true}` | `{ok:true, map, relayOk}` |
    `{ok:false, error}`. Fetch on first selection of a publication-bearing option; cache thereafter.
  - Build `Map(coord → published)` from `concepts[]` keyed on `coord`, joined against `row.uuid`.
  - Extend the filter `useMemo` (`:150-153`) to switch on `stateFilter`. Keep the author `useMemo`
    (`:145-149`) as the first stage so composition (AC-1) is unchanged.
  - `_undispositionedMine` (`:117`) and `nextUndispositioned` (`:156-157`) stay exactly as they are.
  - Replace the checkbox markup (`:257-264`) with the select; keep the grid cell and `🧭 Coverage`
    label styling so the panel layout is unchanged.
- **Do not** add a `published` field to the Cypher query, and **do not** re-implement the
  self-pointer or tri-state rules in the UI. `src/lib/sharingState.js` is their only home; the page
  consumes its already-resolved output.

## Out of scope

- Any change to `/api/shared-by-me`, `src/lib/sharingState.js`, or `src/lib/bValueForms.js`.
- Making the disposition **column** publication-aware (see Consequences).
- Bulk share, and any change to how sharing is performed.
- Persisting the filter selection across navigation.
