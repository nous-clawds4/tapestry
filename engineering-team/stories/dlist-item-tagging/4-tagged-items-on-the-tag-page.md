# Story 4: Tagged items on the tag page

**Status:** Approved
**Created:** 2026-09-10
**Type:** Feature *(Light lane — workflows/light-profile.md; Gate A approved 2026-09-10 — extend
`for-tag` with an `items` group (one call, one POV filter); group by list header; Design note, not
ADR; scoped gate `test/dlist-tagged-items.test.js` + `test/event-tagging-for-tag.test.js` + the
strfry write-assertion guard suite; depends on story 3)*

## Background
After story 3, users can tag DList items, but nothing shows the reverse direction: "which items
carry this tag?" The tag page (`/tag/…`) today switches between **Profiles** and **Notes**; its
notes read (`GET /api/event-tags/for-tag`) aggregates by `target.id` and **silently drops**
`a`-target taggings (`src/api/event-tags/index.js` § `aggregateNotesTagged`, "resolve target note
ids (`e`-targets)"). The book's frame requires that a tagged GitHub account be findable from the
tag and rendered as a GitHub account — with its list's fields — not as a bare coordinate.

## User-facing description
As a user on a tag's page, I want an **Items** view listing the Decentralized-List items tagged
with it under my point of view, each rendered with its list's declared fields and linking back to
its list, so that a tag like "white hat hacker" reads as a curated set of GitHub accounts.

## Acceptance criteria
- [ ] AC-1: Given taggings with `a` targets exist for a tag, when the tag page's read for that
      tag runs, then those targets are returned as a distinct **items** group (coordinate, counted
      applications/disputes under the POV, the viewer's own stance), not dropped and not mixed
      into notes.
- [ ] AC-2: Given the tag page, a third content switch **Items** appears beside Profiles and
      Notes, showing a count; selecting it lists the tagged items.
- [ ] AC-3: Each listed item is rendered by its list header's field declarations (the story-1
      table, one row per item, header-driven columns) with the tag affordance from story 3 on the
      row; items from different lists are grouped under their list's name, each group linking to
      `/list/<coord>`.
- [ ] AC-4: Given an item whose list header is not on local strfry, the item still appears with
      its coordinate and author, marked "list not on this relay", and does not crash the view.
- [ ] AC-5: The view honors the same sort/recency controls and POV disclosure the Notes view
      uses; disputes bucket as on notes.
- [ ] AC-6: Notes and Profiles views are unchanged (regression sentinels).

## Concepts touched
- `39998:<TA>:nostr-event-tag`, `39998:<TA>:tagging-with-specific-tag`, `39998:<TA>:list`.

## Out of scope
- Pins / Trusted Lists for items (story 5). Any change to the wire shape. Pagination beyond what
  the Notes view already does.

## Open questions *(resolved at Gate A, 2026-09-10)*
1. **Read API shape — decided:** extend `for-tag` with an `items` group alongside `notes` (one call, one POV filter); a
   separate `for-tag-items` endpoint was rejected. Server change, read-only; no
   irreversibility trigger (no wire/event shape, no routing-order change) — confirm at Gate A.
2. **Grouping — decided:** by list header (not a flat table with a "List" column).
3. **Scoped gate — decided:** `test/dlist-tagged-items.test.js` + the strfry write-assertion guard suite;
   plus `test/event-tagging-for-tag.test.js` since the API changes.

## Design note *(Light — after Gate A)*

- **Server — one call, one POV filter, an additive `items` group with TWO key spaces.** Taggings of
  list items arrive in both shapes: story 3's `itemTarget` (`ui/src/utils/dlistFields.js`) emits
  `{ address }` for addressable kind-39999 items and falls back to `{ id }` for **non-addressable
  kind-9999** items (`itemCoord` returns null for anything but 39999) — and the local relay really
  does carry 32 kind-9998 headers with a very large legacy kind-9999 item population, so the id shape
  is not a corner. `core.groupTaggingsByTarget` (`src/lib/event-tagging/classify.js:130`) already
  yields both; `aggregateNotesTagged` (`src/api/event-tags/index.js:247`) drops the address ones at its
  step-4 `t.target.id` keying and silently files the kind-9999 ones into the notes track, where
  `handleForTag` resolves ids as `realScanStrfry({ kinds: [1], ids })` (:389) and they vanish. Fix
  both halves inside the one aggregation, reusing the same `targets`/`mine`/`isAsserterTrusted`
  results (never a second header/tagging scan, never a re-implemented trust predicate —
  `trustPredicateFor`, :104–140, stays the only one):
  - **Address track.** `countByAddress` / `mineByAddress` / `latestByAddress` over the `{address}`
    targets.
  - **Id track (the split).** Before any ranking or membership is built, partition the id space with
    one bounded LOCAL scan — `realScanStrfry({ kinds: [9999], ids: allTargetIds })`. Ids that come
    back are **item** ids; every other id (including a kind-1 that lives only on an external relay)
    stays in the notes track, so today's external-note behavior is unchanged. The partition happens
    *before* `latestByNote`/ranking/`memberOf`, which is precisely what keeps `members` and
    `fullMembers` note-only by construction (E1) rather than by a later filter that a future edit
    could drop.
  - **Item member objects** (what the Tester asserts): address-keyed
    `{ address, applications, disputes, createdAt, mine }`; id-keyed
    `{ id, applications, disputes, createdAt, mine }` — an id-keyed member has **no** `address` field
    and an address-keyed member has **no** `id` field, which is also the eligibility discriminator
    story 5 uses. Both live in one `itemMembers` array, ranked together over the merged key space by
    the **same** `idComparators` (`recent|applied|disputed|divisive`) and capped by the same
    `NOTES_CAP` value on its **own** track — the notes cap is untouched, and the combined item group
    reports `itemTotal` / `itemTruncated` for its own clipping.
  - `handleForTag` (:343) resolves the capped item members local-first: coordinates via
    `realScanStrfry({ kinds: [39999], authors: […], '#d': […] })` per distinct author (matched back on
    the exact coordinate), ids via the kind-9999 events the partition scan already returned. Response
    gains `items: [{ address|null, id, kind, pubkey, created_at, tags, content, listCoord,
    applications, disputes, mine }]`, `itemTotal`, `itemTruncated`.
  - **Unchanged**: every existing HTTP body field at :433 (`notes`, `members`, `mine`, `total`,
    `truncated`, `sort`, `limit`, `povSuffix`, `minRank`, `povResolution`, `authorities`) and the cache
    key. `fullMembers` is **not** an HTTP field — it is an `aggregateNotesTagged` **return** consumed
    only by `refreshPinnedTags.js:351`; it too keeps its note-only contents.
- **`listCoord` derivation mirrors `/list/:ref`'s own membership rule** (`ui/src/pages/List.jsx:19–21`):
  a kind-39999 item belongs via its `z` tag naming a `39998:<pk>:<d>` header coordinate; a kind-9999
  item belongs via its `e` tag naming the **event id** of a kind-9998 header. `listCoord` therefore
  carries either form, and the client resolves it with the existing `parseListRef` (which accepts a
  coord, an naddr, or a 64-hex id). An item with several parent refs is grouped under its first
  (E5).
- **Header field declarations resolve client-side, per group — not server-side.** The new
  `ui/src/components/TagItemsView.jsx` batches header fetches for the distinct `listCoord`s
  (`queryRelay({ kinds:[9998,39998], … })` / `queryRelay({ ids: […] })` via `ui/src/api/relay.js`) and
  derives columns with the existing pure `parseFieldDecls` / `headerNames` / `parseListRef`
  (`ui/src/utils/dlistFields.js`). Why: those parsers are UI-side ESM today, so server enrichment
  would fork field-decl semantics into a second implementation (the exact drift `/list/:ref` and this
  view must not have); it would also inflate the 30s-cached `for-tag` body that `publishTagPin.js`,
  `usePinnedNotes.js` and `ExportModal.jsx` read; and AC-4 falls out free — a ref whose query returns
  nothing renders the group as "list not on this relay" with coordinate/id + author, `fieldDecls: []`,
  `DListItemsTable` degrading to its Added-by / Age / Other-fields / Votes columns.
- **UI — a third value on the existing `notesMode` switch.** `ui/src/pages/Tag.jsx` keeps `notesMode`
  (:65) and adds `'items'` plus an **Items** button beside Profiles|Notes (:317–338), inside the
  *default* tab — the `?tab=`/Pinned machinery (:73–101) is untouched. `TagItemsView` is mounted
  **eagerly-hidden** (unlike the lazy `notesOpened`) and reports its total through `onCount`, because
  AC-2 wants the count *before* the click; the cost is one `for-tag` call at tag-page load, which the
  server's 30s cache then serves free to `TagNotesView`. `TagItemsView` reuses `TagViewControls` with
  the identical sort keys and curated/expanded/filter semantics as `TagNotesView` (AC-5) — including
  the `mine`-durability exemption — renders one `DListItemsTable` per list group with
  `renderExtra={(item) => <DListItemTags item={item} />}` (story 3), and links each group heading to
  `/list/<listCoord>`.
- **Hook: extend, don't fork.** `ui/src/hooks/useNotesForTag.js` additionally returns
  `{ items, itemTotal, itemTruncated }` from the same response (existing return keys unchanged, so
  `TagNotesView` compiles untouched); `TagItemsView` calls the same hook. Two mounts of one endpoint
  are deduped by the server cache; a second hook file would duplicate the POV/nocache/nonce logic.
- **Rejected alternative — a separate `GET /api/event-tags/for-tag-items`** (or a client-side scan of
  the `a`-taggings). Real reason: the POV trust predicate, honored-authority header discovery, the
  multi-header union and the polarity/`mine` gating would exist in two places for one tag; the two
  endpoints could disagree about who counts after a POV switch, and the tag page would pay a second
  full header+tagging scan for the candidate set it already fetched. It also could not fix the
  kind-9999 half at all — those taggings are id-keyed and would still be swallowed by the notes track
  in `for-tag`. Accepted costs of the chosen option: a fatter `for-tag` body, one extra bounded local
  `kinds:[9999]` id scan per aggregation, and one more resolution step on every notes read.
- **Contract for story 5 (pins → kind-30394 `a`-member Trusted Lists).** `aggregateNotesTagged` will
  also return **`fullItemMembers`** — the COMPLETE, uncapped item membership (the `NOTES_CAP` slice
  applies only to `itemMembers`), the exact analogue of `fullMembers`, and bounded only by the
  existing `TAGGING_SCAN_LIMIT`/`scanTruncated` signal. **Only address-keyed members
  (`m.address` present) are eligible for a kind-30394 `a`-member list**; id-keyed kind-9999 members are
  non-addressable and MUST be excluded there — pinning them into an `e`-member list is a separate
  decision story 5 does not inherit. Story 5 can rely on `fullItemMembers` existing and on that
  discriminator being the presence of `address`.
- **Blast radius.** Changed: `src/api/event-tags/index.js` (`aggregateNotesTagged`, `handleForTag`),
  `ui/src/hooks/useNotesForTag.js` (additive returns), `ui/src/pages/Tag.jsx` (third switch + eager
  hidden mount), new `ui/src/components/TagItemsView.jsx`, plus CSS for the group headings.
  Consumers that read the response/return and must keep working unchanged:
  `ui/src/components/TagNotesView.jsx`, `ui/src/utils/publishTagPin.js:352` (`data.members || data.notes`),
  `ui/src/hooks/usePinnedNotes.js:76-77`, `ui/src/components/ExportModal.jsx:151`,
  `ui/src/components/PinnedListPanel.jsx:529`, and the **external contract** documented in
  `docs/INTEGRATION_GUIDE_event-tagging-for-external-clients.md:156–164` (Option B publishes the
  `for-tag` envelope `{ notes, members, total, truncated, limit }` to third-party integrators) — the
  change is purely additive, so every field that guide names keeps its meaning and no integrator
  breaks; the guide gets a short "plus `items`/`itemTotal`/`itemTruncated`" note. Additive growth of
  this envelope is already policed by `test/note-tagging-raw-events-inspector-http.test.js:312`
  (R-http-1), the sentinel that asserts `for-tag` does not grow unbid channels.
  **Grep-verified non-consumers** (no change; a diff touching them is out of radius):
  `src/api/trustedList/refreshPinnedTags.js:351` destructures only `{ fullMembers, scanTruncated, total }`,
  so the TA-signed kind-30393 note TL can see neither `itemMembers` nor `fullItemMembers`;
  `src/lib/event-tagging/classify.js` needs **no** edit (`grep -n "target.id"` → no hits; the `a`-branch
  at :134 already exists); `ui/src/pages/List.jsx` is untouched — the new view reuses
  `DListItemsTable`/`DListItemTags`, not the page.
- **No irreversibility trigger** (confirmed at Gate A): read-only, no wire/event shape, no schema or
  concept change, no firmware reinstall, no new dependency, no routing/middleware order change. The one
  cross-repo-ish surface — the integration guide's documented envelope — is additive-compatible and
  named above. Concept handles could not be re-checked against the Concept Graph API (control panel
  not reachable on this host during design); `39998:<TA>:nostr-event-tag`,
  `tagging-with-specific-tag`, `list` are used here as documentation, not as code constants.

## Edge cases & not-covered

- **E1 — (not derivable from any AC) `members`/`fullMembers` must stay note-only, now that ids are a
  SHARED key space.** A kind-9999 item id (or an `a` coordinate) leaking there would be published as
  an `e` member of the TA-signed kind-30393 note Trusted List (`refreshPinnedTags.runOneNotePin`) and
  into pin exports (`publishTagPin.js`) — signed-event corruption invisible on the tag page. The
  mechanism that prevents it is the *pre-ranking* partition scan, not a post-filter. Sentinel:
  aggregate a fixture mixing kind-1 `e` taggings, kind-9999 `e` taggings and kind-39999 `a` taggings,
  then assert (a) no `members`/`fullMembers` id belongs to the kind-9999 fixture set, (b) no member id
  contains `:`, and (c) `members.length` equals the notes-only baseline.
- **E2 (corrected) — an id or coordinate that is not a list item.** A tagging can point at any event:
  a kind-1 note, a `30023:` long-form, a `39999:<pk>:<slug>` tag element. Routing is by *resolved
  kind*, not by wishful classification: an id found locally as kind 9999 → items; any other id →
  notes (unchanged behavior, including external kind-1 fetches); an `a` coordinate resolving to a
  non-39999 event, or to nothing, → an items row that degrades per E3 rather than being rendered with
  another list's columns. Nothing crashes, and nothing is silently dropped from both tracks.
- **E2b — a tagged id that resolves to NEITHER kind 1 nor kind 9999** (e.g. a kind-7 reaction id, or an
  id present on no reachable relay). It stays in the notes track by the partition rule, the kind-1
  fetch returns nothing for it, and it therefore appears in `members`/`total` but not in the rendered
  `notes` — exactly today's behavior for an unresolvable note. Assert it does not leak into `items`
  and does not throw.
- **E3 — target tagged but the event itself is on no reachable relay.** The row still renders from the
  coordinate (author + `d`) or bare id, with empty field cells; the group is not suppressed.
- **E4 — header unreachable (AC-4) *and* header present but declaring zero fields.** Both render the
  degraded table; the zero-field case must NOT be reported as "list not on this relay". Covers both
  parent forms: a missing `39998:<pk>:<d>` coordinate and a missing kind-9998 header **event id**.
- **E5 — one item in two lists / two lists declaring the same field names.** An item carrying multiple
  parent refs is grouped under its first ref only (deterministic, documented); identical field names in
  different groups must not collide because each group derives its own `fieldDecls`.
- **E6 — coordinate normalization.** Uppercase pubkeys and a `d` containing colons round-trip through
  `parseListRef`/`parseItemRef` and still match the server's lowercase strfry `authors:`/`#d` filters.
- **E7 — POV switch mid-view.** Flipping `wotPov` re-filters items and notes together; the existing
  POV-aware `for-tag` cache key (guarded by `pov-resolution-status.test.js` S3) must still prevent one
  POV's `items` from being served to another.
- **E8 — `mine` durability + disputes.** An item the viewer tagged with zero trusted backers stays
  visible in the curated (collapsed) view; a net-disputed item hides in curated and appears when
  expanded — same rule as notes, for both key spaces.
- **E9 — empty and regression states.** Zero item-taggings → the Items switch reads `(0)` with the empty
  copy; Profiles and Notes render byte-identically to before (AC-6 sentinels: the `notes`, `members`,
  `total`, `truncated`, `limit` body fields and `TagNotesView`'s output unchanged; R-http-1 still green).
- **E10 — cap and truncation across the mixed group.** The combined address+id item set is ranked as
  one list and capped at the `NOTES_CAP` value on its own track; when `itemTotal` exceeds it the view
  shows "Showing the top N of M tagged items". A cap that clipped all of one key space while the other
  fit is legal but must be visible through `itemTruncated`, never silent.
- **E11 — external-relay failure during item resolution.** If the local scans find nothing and the relay
  round-trip throws, the group degrades to E3 rows; the notes half of the response must still return 200.
- **Not covered:** pagination past the caps (out of scope, as for notes); kind-7 vote counts in the Items
  groups (the Votes column renders "—"; `/list/:ref`'s reaction scan is not reused); pins/Trusted Lists
  for items (story 5 — this story only promises the `fullItemMembers` accessor and the
  addressable-only eligibility rule); pinning non-addressable kind-9999 items anywhere; server-side
  header enrichment or list-name search; any measurement of the added `for-tag` call and the extra id
  partition scan at tag-page load beyond "does not error".

## AC→handle lines
—

## Linked artifacts
- ADR: none expected
- Review: `engineering-team/reviews/dlist-item-tagging/4-tagged-items-on-the-tag-page.md`

Link by path only — never record verdicts or round history in this file.
