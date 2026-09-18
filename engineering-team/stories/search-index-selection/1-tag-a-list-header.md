# Story 1: Tag a list header

**Status:** Approved
**Created:** 2026-09-18
**Type:** Feature *(Light lane — Gate A 2026-09-18; no wire-format change)*
**Epic:** `engineering-team/epics/search-index-selection.md`
**Design target:** `docs/SEARCH_INDEX_DLIST_SELECTION.md` (rev 3)

## Background

"Header" and "item" are **roles, not kinds**. A kind-39999 can be both at once: the per-tag
tagging header (`39999:<author>:tagging:<slug>-tagging`) is an element of the type header
`39998:<TA>:tagging-with-specific-tag` via its `z`, *and* the thing taggings point at via
theirs. The protocol does not distinguish.

The UI does, in three hardcoded places, and the result is that **no surface can tag a list
header today**:

- `ui/src/utils/dlistFields.js` `itemCoord` returns null unless `kind === 39999` (an
  already-carried `address` short-circuits first — that branch exists because a previous
  review found the re-derivation mints a bogus coordinate for other kinds).
- `ui/src/utils/dlistHeaders.js` `listCoordOf` branches on 39999 vs 9999 for the parent.
- `src/api/event-tags/index.js` resolves item events with `kinds: [39999]` and keys its map
  `39999:<pubkey>:<d>` (OPEN 306).

The three tagging affordances that exist — the note card, the DList item row, and profile
tagging — none of them points at a kind-39998. `ui/src/pages/List.jsx` renders the header's
title, description, author and coordinate with no tag handle.

This blocks step 3 of the near-term plan in the design doc ("tag the `github-accounts`
header"), which otherwise has to happen out of band.

**Membership already works.** The classifier passes an `a` value through verbatim with no
kind restriction (`src/lib/event-tagging/classify.js` `targetOfCandidate`), and `fullItemMembers` is
built from the assertions' address keys with no kind filter, so a tagged header already
reaches a published kind-30394. Only the *authoring* and the *display* are missing.

## User-facing description

As a curator, I want to tag a Decentralized List itself — not its items — so that I can say
things about the list, starting with "this is worth indexing for search", and see that
tagging rendered like any other.

## Acceptance criteria

- [ ] AC-1: The list page (`/list/:ref`) offers a tag affordance on the header block,
      alongside the existing per-item affordances, available to a signed-in viewer.
- [ ] AC-2: The published assertion targets the header's **coordinate** (`a` =
      `39998:<author>:<d>`), never its event id. A header edit must not orphan the tagging.
- [ ] AC-3: A tagged header resolves for display wherever tagged targets are listed: its
      name and description render, not a bare coordinate (OPEN 306).
- [ ] AC-4: The viewer's own stance on a header tagging is shown and can be retracted or
      disputed, at parity with item taggings.
- [ ] AC-5: Item tagging, note tagging and profile tagging are unchanged — same targets,
      same d-tags, same rendering (regression sentinels).
- [ ] AC-6: A tagged header with no parent concept degrades legibly rather than rendering
      under a misleading group heading (see open question 2).

## Open questions for Gate A

1. **Where else should the affordance appear?** The list index (`/lists`) rows are the
   obvious second home, and the concept pages a third. Recommendation: the list page only
   for this story; the index is a follow-on once the interaction is settled.
2. **How should a tagged header group in the Items view?** It groups by parent list, and
   **no kind-39998 in the local corpus carries a `z`** (400 sampled, zero with a parent), so
   a tagged header lands in "items with no list". Recommendation: give headers their own
   group heading ("Lists") rather than letting them fall into the orphan bucket. See the
   note below — headers arguably *should* carry a parent concept, but that is not this
   story's to fix.
3. **Does `itemCoord` change, or does the caller pass the coordinate?** Recommendation: the
   caller passes `{ address: headerCoord(header) }` explicitly and `itemCoord` is untouched.
   Its 39999 guard is deliberate, and the carried-address short-circuit already exists for
   exactly this case.
4. **Which tag vocabulary is offered?** The existing applicability machinery keys on
   `39999:` coordinates (`applicability.js` `A_COORD_RE`), so it may return nothing for a
   39998 target. Recommendation: confirm at design whether header tagging needs an
   applicability entry or is simply applicability-agnostic.

## Note: headers and their parent concept (out of scope, worth recording)

A list header could reasonably be an element of the firmware `list` or `curated-dlist`
concept, which would make the universe of DLists enumerable with one `#z` filter instead of
a scan over every kind-39998. No header does this today. It would be a **discovery** aid and
never a trust signal, since it is self-declared by the header's author — which is the right
division of labour: discovery by `z`, selection by tagging. Out of scope here; recorded so
the idea is not lost.

## Out of scope

The `author` curation constraint (story 2), per-pin curation and variants (story 3), the
`worth-indexing-for-search` tag's naming and authorship decision (design doc), and anything
in the deferred parts of the design doc.

## Linked artifacts

- Design target: `docs/SEARCH_INDEX_DLIST_SELECTION.md`
- Ledger: OPEN 306 (header targets do not resolve for display)

## Gate A rulings (operator, 2026-09-18 — "approved!")

Light lane confirmed. Scoped gate: `test/tag-a-list-header.test.js` (new) + guards
`test/dlist-tagged-items.test.js`, `test/dlist-browse.test.js`, `test/trusted-list-raw-view.test.js`.

1. **Affordance on the list page header block only.** Index rows and concept pages are a
   follow-on.
2. **Tagged headers get their own group, "Lists".** Never the orphan bucket. Headers carrying
   a parent `z` is out of scope.
3. **The caller passes `{ address: headerCoord(header) }`.** `itemCoord`'s 39999 guard is
   untouched.
4. **Applicability is agnostic — resolved at design.** `NoteTags` calls
   `useTagApplicability('event', …)` for every target shape (`ui/src/components/NoteTags.jsx:30`),
   so a header gets the same event-context tag list as an item or a note. No entry needed.
   (`applicability.js` `A_COORD_RE` parses *tag-element* coordinates, not targets.)

## Design note *(Light — after Gate A)*

- **Affordance.** `ui/src/pages/List.jsx` header block gains
  `<NoteTags item={header} target={{ address: headerCoord(header) }} subject="list" />`
  beside the coordinate line. `NoteTags` already takes an explicit `target` and a `subject`
  (`ui/src/components/NoteTags.jsx:22`) and gates writes on `useAuth` itself, so a signed-out
  viewer sees stances and no affordance with no new code. `headerCoord`
  (`ui/src/utils/dlistFields.js:65`) already returns `39998:<pubkey>:<d>` for a header, so the
  published assertion targets the coordinate (AC-2) and the ADR `dlist-item-tagging/0001`
  d-tag composes over it unchanged — `hash8` is over the full coordinate, so tagging a header
  and tagging an item whose `d` shares the first 16 chars cannot collide (E7).
- **Grouping — one shared rule.** `groupItemsByList` (`ui/src/utils/dlistHeaders.js`) emits a
  **leading** group `{ headers: true, listCoord: null, items }` for rows with
  `kind === 39998`, before the per-list groups. Both consumers — the tag page's
  `TagItemsView` and the Pinned tab's Items leaf (`PinnedListPanel`) — render a
  `group.headers` group as **link cards** (name via `headerNames`, description, coordinate,
  linking to `/list/<coord>`), never through `DListItemsTable` (a header has no item fields to
  tabulate). `listCoordOf` and `toTableItem` are untouched: a 39998 has no parent, and never
  reaches the table. One new CSS class for the card.
- **Resolution — derive the kind from the coordinate.** `src/api/event-tags/index.js`
  `handleForTag`'s item-resolution loop currently buckets by author and scans
  `kinds: [39999]`, keying the map with a literal `39999:` prefix. It buckets by
  `(kind, author)` instead, scans `kinds: [kind]`, and keys by the event's real
  `${kind}:${pubkey}:${d}` — so a 39998 target resolves to its header event and reaches the
  client with `tags` (names, description) populated (AC-3, closes OPEN 306). The server's
  `listCoordOf` gets an explicit `kind === 39998 → null`. `usePinnedItems` already buckets by
  `(kind, author)` and needs no change. Response shape unchanged.
- **Rejected:** putting the 39998 rule inside `itemCoord` (its guard is deliberate and the
  carried-address path already serves this case — ruling 3); rendering headers as table rows
  (no field declarations to drive columns, and the "Show all fields" toggle would show
  `names`/`required` as data); a separate Items-view fetch for headers (the membership path
  already carries them — only resolution was blind).
- **Blast radius.** `ui/src/pages/List.jsx`, `ui/src/components/TagItemsView.jsx`,
  `ui/src/components/PinnedListPanel.jsx` (headers-group card render only),
  `ui/src/utils/dlistHeaders.js` (`groupItemsByList`), `ui/src/styles.css`,
  `src/api/event-tags/index.js` (resolution loop + `listCoordOf`). **Not touched:**
  `ui/src/utils/dlistFields.js` (`itemCoord`, `headerCoord`), `ui/src/components/NoteTags.jsx`,
  `src/lib/event-tagging/*`, `src/api/trustedList/*`.

## Edge cases & not-covered

- **E1 — header edited after tagging.** The target is the coordinate, so the tagging follows
  the replaceable event; the resolved header is the newest.
- **E2 — a header that does carry a parent `z` (future).** The kind rule wins: it still
  renders in "Lists", never under its parent as if it were an item.
- **E3 — tagged header not on this relay.** Card shows the coordinate and "list not on this
  relay"; no name; the link still works.
- **E4 — a 30394 whose member is a header coordinate.** The Pinned Items leaf shows it under
  "Lists" — parity with the tag page (and exactly the search-index list's shape).
- **E5 — a tag applied to both headers and items.** Both groups render; "Lists" first.
- **E6 — signed-out viewer.** Stances visible, no affordance (existing `NoteTags` behaviour).
- **E7 — d-tag collision between a header and an item.** `hash8` over the full coordinate
  distinguishes `39998:…:x` from `39999:…:x…`; sentinel asserts distinct d-tags.
- **E8 — `groupItemsByList` with no headers.** Emits no headers group (existing callers see
  byte-identical output).
- **Not covered:** the affordance on the lists index or concept pages; headers declaring a
  parent concept; per-header applicability; the `worth-indexing-for-search` tag's naming.

## AC→handle lines

Test plan: `engineering-team/test-plans/search-index-selection/1-tag-a-list-header.md`
Suite: `test/tag-a-list-header.test.js` (pre-implementation: 11 passed, 16 failed).

- AC-1 → S1, S2
- AC-2 → S1, U10
- AC-3 → U7, U8, U9, S3, S4, S6, S7
- AC-4 → S9
- AC-5 → R1, R2, R3, R4, R5, R6, R7
- AC-6 → U1, U2, U3
- E1 → U10 (proxy — the coordinate target; the replace round-trip is not covered)
- E2 → U4 (client), S8 (server)
- E3 → S5
- E4 → S6
- E5 → U2, S3
- E6 → R2 (an unchanged `NoteTags` is what makes it true; no new handle)
- E7 → U11
- E8 → U5, U6 (plus guard `trusted-list-raw-view` U12, which must stay green)
