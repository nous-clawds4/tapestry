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
  `handleForTag` resolves ids as `realScanStrfry({ kinds: [1], ids })` (:389) and they render nowhere.
  Surface both halves in a NEW group built alongside the existing notes track — nothing is removed
  from it — inside the one aggregation, reusing the same `targets`/`mine`/`isAsserterTrusted`
  results (never a second header/tagging scan, never a re-implemented trust predicate —
  `trustPredicateFor`, :104–140, stays the only one):
  - **Address track.** `countByAddress` / `mineByAddress` / `latestByAddress` over the `{address}`
    targets.
  - **Id track (classification only — nothing is removed).** One bounded LOCAL scan,
    `realScanStrfry({ kinds: [9999], ids: allTargetIds })`, tells us which tagged ids are DList items.
    Its result is used ONLY to BUILD the items group. The notes track — `countByTarget`,
    `latestByNote`, the ranking, `memberOf`, `members`, `fullMembers`, `total` — is left exactly as it
    is today, kind-9999 ids included. A kind-9999 item tagging therefore appears in **both**
    `members` (as it already does today) and `itemMembers`; an integrator reading both fields will see
    it twice. That double presence is the deliberate price of a purely additive change, and it is
    preferable to narrowing a field this repo documents to external client authors.
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
    the exact coordinate), ids via the kind-9999 events the kind-9999 classification scan already returned. Response
    gains `items: [{ address|null, id, kind, pubkey, created_at, tags, content, listCoord,
    applications, disputes, mine }]`, `itemTotal`, `itemTruncated`.
  - **Field-by-field effect on the HTTP body at :433 — purely additive.** `notes`, `members`,
    `mine`, `total`, `truncated`, `sort`, `limit`, `povSuffix`, `minRank`, `povResolution`,
    `authorities` and the cache key keep **exactly** today's contents and semantics; the body only
    GAINS `items`, `itemTotal`, `itemTruncated`. `fullMembers` is **not** an HTTP field — it is an
    `aggregateNotesTagged` **return** consumed only by `refreshPinnedTags.js:351` — and it too is
    unchanged, so `runOneNotePin` sheds nothing and publishes the same kind-30393 membership as
    before. The envelope-hygiene sentinel `test/note-tagging-raw-events-inspector-http.test.js:312`
    (R-http-1) is narrower than "policing additive growth" — it asserts only `!('rawEvents' in json)`,
    i.e. that the byte channel stays out of `for-tag`; it says nothing about `items`, and adding
    `items` keeps it green.
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
- **Out of scope: note-TL pollution is a pre-existing defect, not this story's.** A kind-9999 DList
  item tagging emits an `e` target today (`ui/src/utils/dlistFields.js:162–165`), so its id already
  flows through `countByTarget`/`latestByNote` into `members`/`fullMembers`/`total`
  (`src/api/event-tags/index.js:279–325`) and thence into the TA-signed kind-30393 note Trusted List.
  An earlier draft of this note proposed removing those ids. **Decided: it does not, because that
  subtraction would break `members`/`total` as documented to external client authors in
  `docs/INTEGRATION_GUIDE_event-tagging-for-external-clients.md` — a "cross-repo contract", which is a
  CATEGORICAL Light trigger** that reversibility and "no known dependent" arguments do not clear
  (remote deployments were never measured). Removing the subtraction dissolves the trigger honestly
  instead of arguing with it. A DList item sitting in a note TL predates this work, is named in no AC
  here, and wants its own story (ledger row to be filed by the coordinator).
- **Blast radius.** Changed: `src/api/event-tags/index.js` (`aggregateNotesTagged`, `handleForTag` —
  additive only), `ui/src/hooks/useNotesForTag.js` (additive returns), `ui/src/pages/Tag.jsx` (third
  switch + eager hidden mount), new `ui/src/components/TagItemsView.jsx`, CSS for the group headings,
  and `docs/INTEGRATION_GUIDE_event-tagging-for-external-clients.md` — the external contract
  (Option B publishes the `for-tag` envelope `{ notes, members, total, truncated, limit }` at
  :156–164). That edit is now **purely additive**: document `items`/`itemTotal`/`itemTruncated` beside
  the existing fields, with no narrowing disclosure because nothing narrows. While there, fix the
  stale checklist line at :259 — "`for-tag` caps at 50 most-recent notes per tag" — to say that the
  notes cap and the new items cap are separate, each with its own `truncated`/`itemTruncated` signal,
  so an integrator doesn't read one cap as covering both groups.
  Consumers that read the response/return and keep working **byte-identically** (nothing they read
  changes): `ui/src/components/TagNotesView.jsx`, `ui/src/utils/publishTagPin.js:352`
  (`data.members || data.notes`), `ui/src/hooks/usePinnedNotes.js:76-77`,
  `ui/src/components/ExportModal.jsx:151`, `ui/src/components/PinnedListPanel.jsx:529`.
  **Grep-verified non-consumers** (no change; a diff touching them is out of radius):
  `src/api/trustedList/refreshPinnedTags.js:351` destructures only `{ fullMembers, scanTruncated, total }`
  — all unchanged, so `runOneNotePin` and its kind-30393 note TL are untouched and can see neither
  `itemMembers` nor `fullItemMembers`; `src/lib/event-tagging/classify.js` needs **no** edit
  (`grep -n "target.id" src/lib/event-tagging/classify.js` → no hits; the `a`-branch at :134 already
  exists); `ui/src/pages/List.jsx` is untouched — the new view reuses `DListItemsTable`/`DListItemTags`,
  not the page.
- **Implementation notes the "same comparators" claim hides.** `appliedOf` / `disputedOf` / `recencyOf`
  (`src/api/event-tags/index.js:279–305`) close over the id-keyed maps; they must be generalized to
  take a key and consult `countByAddress`/`mineByAddress`/`latestByAddress` for `a:` keys, so the item
  track genuinely reuses one ranking rather than a copied one — while leaving the notes track's own
  use of them behaviorally identical. Client-side, the header batch needs `authors`/`#d` selectors per
  distinct 39998 coordinate (one filter per author, matched back on the exact coord) alongside the
  `ids` filter for 9998 header ids.
- **Irreversibility walk, re-run against this now-genuinely-additive description.** Wire format /
  event shape: **no** — no new kind, no new tag, and no published event's membership changes
  (`fullMembers` is untouched, so kind-30393 output is bit-for-bit what it is today). Auth / trust
  default: **no** — one POV predicate, unchanged. Schema / firmware / concept definition: **no**; no
  `POST /api/firmware/install` required. New dependency: **no**. Request routing, middleware order,
  response headers / content-type: **no** — same route, same handler, same JSON envelope. **Cross-repo
  contract: no longer tripped** — every field the integration guide publishes keeps its exact meaning;
  the guide only gains documentation of new optional fields, which an existing integrator ignores.
  Value existing in more than one repo: **no**. **Verdict: Design note, re-affirmed** — there is now
  nothing to be irreversible about; the only durable artifacts are additive response fields and an
  additive doc edit. Concept handles could not be re-checked against the Concept Graph API (control
  panel not reachable on this host during design); `39998:<TA>:nostr-event-tag`,
  `tagging-with-specific-tag`, `list` are used here as documentation, not as code constants.

## Edge cases & not-covered

- **E1 — (not derivable from any AC) the new items track must never WRITE INTO the old notes track.**
  `members`, `fullMembers` and `total` feed the TA-signed kind-30393 note Trusted List
  (`refreshPinnedTags.runOneNotePin`) and the pin exports (`publishTagPin.js`) — signed artifacts whose
  drift is invisible on the tag page. The guarantee this story owes is **additivity**: building the
  items group changes none of them. Sentinel: run the aggregation on a fixture mixing kind-1 `e`
  taggings, kind-9999 `e` taggings and kind-39999 `a` taggings, and assert `members`, `fullMembers`
  and `total` are byte-identical to the same fixture aggregated by the pre-change code (kind-9999 ids
  still present — that pollution is a pre-existing defect deliberately left alone here), while
  `itemMembers` carries no `a` coordinate in `members` and no member of `members` is mutated. The
  no-`a`-in-`members` half also holds: an address-keyed member must never leak into the id-keyed set.
- **E2 (corrected) — an id or coordinate that is not a list item.** A tagging can point at any event:
  a kind-1 note, a `30023:` long-form, a `39999:<pk>:<slug>` tag element. Routing is by *resolved
  kind*, not by wishful classification: an id found locally as kind 9999 → items; any other id →
  notes (unchanged behavior, including external kind-1 fetches); an `a` coordinate resolving to a
  non-39999 event, or to nothing, → an items row that degrades per E3 rather than being rendered with
  another list's columns. Nothing crashes, and nothing is silently dropped from both tracks.
- **E2b — a tagged id that resolves to NEITHER kind 1 nor kind 9999** (e.g. a kind-7 reaction id, or an
  id present on no reachable relay). The kind-9999 classification scan doesn't claim it, the kind-1
  fetch returns nothing for it, so it appears in `members`/`total` but in neither the rendered `notes`
  nor `items` — exactly today's behavior for an unresolvable note, unchanged. Assert it does not leak
  into `items` and does not throw.
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
- **E9 — empty and regression states (AC-6, strong form).** Zero item-taggings → the Items switch reads
  `(0)` with the empty copy. AC-6 holds in full: the Profiles and Notes views, the note rendering path
  (`TagNotesView`/`NoteCard`), and **every existing response field** — `notes`, `members`, `mine`,
  `total`, `truncated`, `limit`, `sort`, `povSuffix`, `minRank`, `povResolution`, `authorities` — are
  unchanged, full stop, on every tag including one carrying kind-9999 item taggings. R-http-1 stays
  green. The regression sentinel can therefore be a blanket byte-comparison of the pre-change envelope
  minus the new keys.
- **E10 — cap and truncation across the mixed group.** The combined address+id item set is ranked as
  one list and capped at the `NOTES_CAP` value on its own track; when `itemTotal` exceeds it the view
  shows "Showing the top N of M tagged items". A cap that clipped all of one key space while the other
  fit is legal but must be visible through `itemTruncated`, never silent.
- **E11 — external-relay failure during item resolution.** If the local scans find nothing and the relay
  round-trip throws, the group degrades to E3 rows; the notes half of the response must still return 200.
- **Not covered:** pagination past the caps (out of scope, as for notes); kind-7 vote counts in the Items
  groups (the Votes column renders "—"; `/list/:ref`'s reaction scan is not reused); pins/Trusted Lists
  for items (story 5 — this story only promises the `fullItemMembers` accessor and the
  addressable-only eligibility rule); pinning non-addressable kind-9999 items anywhere; **the
  pre-existing note-TL pollution** — kind-9999 item ids sitting in `members`/`fullMembers`/`total` and
  hence in published kind-30393 note TLs — which this story deliberately leaves exactly as it is and
  which wants its own story; server-side header enrichment or list-name search; any measurement of the
  added `for-tag` call and the extra id classification scan at tag-page load beyond "does not error".

## AC→handle lines

**Suite:** `test/dlist-tagged-items.test.js` (registered in `test/test.js` at all five `dlistBrowse`-style
sites). **Legend:** `U*` = behavioral — `aggregateNotesTagged` / `handleForTag` are called for real with
every I/O boundary injected (`child_process.exec` patched = the module-local `strfryScan` seam;
`_shared/relaySource`, `_shared/povStatus`, `_shared/noteEnrichment` replaced in the require cache).
No stack, no Meili, no neo4j, no relay — the suite is stack-free by construction.
`S*` = source-contract (the UI half is ESM/JSX and is not requirable from the Node runner — documented gap
below). `R*` = regression sentinel: green TODAY and must stay green.

**Fixture (shared, hand-built):** one tag `39999:<JACK>:white-hat`, one honored header, and taggings of —
two kind-1 notes (`NOTE1` 2 applies, `NOTE2` 1 apply + 1 dispute), one **kind-9999** DList item (`ITEM9`,
`e`-target), two **kind-39999** items (`ADDR_A` in list `39998:<OWNER>:hackers`, `ADDR_B` in
`…:legends`, `a`-targets), and one id that resolves to nothing (`ORPHAN`).

| AC | Handles |
|---|---|
| AC-1 — `a` targets returned as a distinct items group, counted under the POV, not dropped, not mixed into notes | U1, U2, U3, U4, U13, R8 |
| AC-2 — third **Items** switch beside Profiles/Notes, with a count | S1, S2 |
| AC-3 — header-driven rendering, story-3 tag affordance on the row, grouped per list, group links to `/list/<coord>` | U14, U15, S3, S4 |
| AC-4 — list header not on local strfry → item still shown with coordinate + author, "list not on this relay", no crash | U16, S5 |
| AC-5 — same sort/recency controls + POV disclosure as Notes; disputes bucket as on notes | U2, U8, S6 |
| AC-6 — Notes and Profiles unchanged (regression sentinels) | R1, R2, R3, R4, R5, R6, R7, R8, U7, S7 |

| Edge case | Handles |
|---|---|
| E1 — the items track never writes into the notes track (`members`/`fullMembers`/`total` byte-identical; no `a` in `members`) | **R8** (byte-compare vs the hand-written pre-change expectation), R1, R2, U7 |
| E2 — routing by *resolved kind*, one bounded local `kinds:[9999]` id scan | U4, U18 |
| E2b — id resolving to neither kind 1 nor kind 9999 stays in `members`, never leaks into `items` | R7 |
| E3 — target event on no reachable relay → row still renders from coordinate/id | U16 |
| E4 — header unreachable vs header with zero field decls | S5 (both branches: `list not on this relay` copy vs empty `fieldDecls`) |
| E5 — one item, several parent refs / same field names in two groups | U15 (per-group `listCoord`), S3 (`fieldDecls` derived per group) |
| E6 — coordinate normalization (uppercase pubkey, `d` with colons) | U12 |
| E7 — POV switch mid-view; one POV's items never served to another | R5 (cache key still carries `wotPov`/`userPubkey`/`authorities`/`sort`/`viewerPubkey`) |
| E8 — `mine` durability + disputes across both key spaces | U2 |
| E9 — empty state; every existing response field unchanged | U19, R6 |
| E10 — combined cap + `itemTruncated` on its own track | U9 |
| E11 — external relay throws during resolution → notes half still 200 | U17 |
| Story-5 contract — `fullItemMembers` uncapped; only address-keyed members eligible for kind-30394 | U10, U11 |
| Doc / cross-repo surface — integration guide gains the new fields, two-cap line corrected | S8 |

**Not derivable from any AC** (J2.1): **R8** — the byte-identity of `members`/`fullMembers`/`total` against
a *hand-written* pre-change expectation (`EXPECTED_MEMBERS_RECENT`, built literally, not by re-running the
new code), including the deliberate retention of the kind-9999 id pollution (OPEN 256). Also not
AC-derivable: U10/U11 (story-5's `fullItemMembers` + addressable-only eligibility), U18/U17 (dependency
error paths), R3 (the note-TL destructure staying a three-key non-consumer).

### External-dependency error paths

| Dependency | Where | Covered by | Expected behavior |
|---|---|---|---|
| local strfry — header + tagging scans (`strfryScan` → `exec`) | `aggregateNotesTagged` steps 1–2 | not covered — **reason:** unchanged code path, already rejects/500s today; this story adds no new call there | unchanged |
| local strfry — NEW `kinds:[9999]` id classification scan | `aggregateNotesTagged` (new) | **U18** | degrade: 200, empty/address-only `items`, notes track untouched |
| local strfry — `kinds:[39999] authors/#d` item resolution | `handleForTag` (new) | **U16** (no matching event) | row still rendered from the coordinate + author (E3) |
| external relays (`realQuerySync`) | `handleForTag` note fetch | **U17** | 200, items survive, notes degrade (E11) |
| neo4j (`resolveGeneralPurposeRelays`) | `handleForTag` | injected via the relaySource stub; not asserted — **reason:** unchanged path, no new call | unchanged |
| Meili (`trustPredicateFor`) | POV trust | not covered — **reason:** the POV path is unchanged and is owned by `test/pov-resolution-status.test.js`; this suite runs POV-unfiltered (`povSuffix: null`) so the predicate is `() => true` | unchanged |

### Guard-suite carve-out

This is **not** a test-deliverable story, so no guard suite is being authored here. The story's Gate-A
scoped gate includes the standing guard suite `test/strfry-write-assertion-bracket.test.js`: **Phase 4 must
not edit it**, nor edit the assertions in `test/dlist-tagged-items.test.js` or
`test/event-tagging-for-tag.test.js` to make them pass. Fixture/harness bugs found by the Implementer are
reported back, not silently rewritten.

### Known gap

The Items view (`TagItemsView.jsx`, `Tag.jsx`, `useNotesForTag.js`) is ESM/JSX and cannot be required by the
Node runner, so AC-2/-3/-4 rendering is pinned by **source contract** (S1–S7), not by execution. The
underlying data — `listCoord` for both parent forms, per-list distinguishability, degraded rows — *is*
exercised behaviorally through `handleForTag` (U14–U16), so the untested residue is the JSX wiring only.
The precedent is Story 8 (`test/event-tagging-for-tag.test.js`), where the operator likewise excluded the
Tag.jsx view from auto-testing. No Playwright spec is added.

### Pre-implementation run (recorded 2026-09-10)

Command (operator-scoped: this suite only, no full `npm test`):

```
direnv exec . node -e "require('./test/dlist-tagged-items.test.js').run().then(r=>{console.log(r);process.exit(r.fail?1:0)})"
```

Result: **`{ pass: 9, fail: 24, skipped: 0 }`** — exit 1.

- **Green pre-impl (9), by design:** R1–R8 (the additivity / non-consumer / envelope sentinels) and U7 (the
  comparator generalization must leave note ordering identical — it is a "still true afterwards" assertion).
- **Red pre-impl (24), each for the right reason** (feature absent, not an import or typo):

```
  ✗ U1 … aggregateNotesTagged must return an `itemMembers` array (AC-1).
  ✗ U4 … the kind-9999 DList item id must appear in itemMembers; got []
  ✗ U9 … itemTotal must count the whole item universe (…= 63); got undefined
  ✗ U10 … aggregateNotesTagged must return `fullItemMembers` (story-5 contract).
  ✗ U13 … the for-tag response must carry an `items` array.
  ✗ U14 … the kind-39999 item 39999:…:gh-torvalds must be resolved into items; got []
  ✗ U17 … for-tag must degrade, not 500, when the external relay fetch throws; got 500 (relay exploded)
  ✗ S3 … ui/src/components/TagItemsView.jsx does not exist yet — the Items view component.
  ✗ S7 … useNotesForTag must additionally return `items` (extend, don't fork the hook).
  ✗ S8 … the integration guide must document the new `items` field (cross-repo readers).
```

(the remaining reds — U2, U3, U8, U11, U12, U15, U16, U18, U19, S1, S2, S4, S5, S6 — fail with the same
class of message: the new field/file/copy does not exist yet.)

## Linked artifacts
- ADR: none expected
- Review: `engineering-team/reviews/dlist-item-tagging/4-tagged-items-on-the-tag-page.md`

Link by path only — never record verdicts or round history in this file.

## Implementation obligations surfaced at Test Design (2026-09-10)

The Tester found six points the Design note leaves under-specified. Recorded here so the
Implementer decides them deliberately and the Reviewer can check them; none reopens the design.

1. **`for-tag` must degrade, not 500, when a relay read throws.** `handleForTag` awaits
   `realQuerySync` unguarded today, so a throw yields a 500. E11's sentinel (U17) requires a
   try/catch that still returns 200 with the notes half. This is a new obligation, not a
   sentinel on existing behavior — add it to the blast radius when implementing.
2. **The kind-9999 classification scan needs a stated failure rule.** On scan failure: degrade
   to address-only items, notes untouched, still 200 (U18).
3. **Coordinate case is undecided.** A tagging may carry an uppercase-pubkey `a` coordinate while
   strfry filters are lowercase. Decide whether `itemMembers[].address` stores the raw or the
   normalized coordinate and say so — **story 5 publishes this value into a kind-30394 `a` member
   tag**, so it is wire-visible there. Recommendation: normalize to lowercase at ingest.
4. **E4's "zero declared fields" branch is not server-observable** — there is no difference
   between "header absent" and "header present with no field declarations" on the wire, so its
   sentinel (S5) pins UI copy, not behavior. Honest home is a Playwright spec; out of scope here.
5. **E5's "first ref" tie-break is undefined** for an item carrying multiple `z`/`e` parents.
   State the rule (tag order, or sorted) before it can be pinned; the suite uses single-parent
   fixtures deliberately.
6. **AC-2's count-before-click is pinned structurally** (`hidden={notesMode !== 'items'}` plus
   `onCount=`), which constrains the Implementer to that idiom. Loosen the sentinel if a
   different shape is preferred.

## Deviations *(Implementation, 2026-09-11)*

Resolutions of the six obligations above, plus the small judgment calls the Design note left open:

1. **Relay degradation (obligation 1).** The external-note fetch in `handleForTag` (the
   `resolveGeneralPurposeRelays` + `realQuerySync` block) is wrapped in one try/catch that sets
   `externalNotes = []`. Local notes, the items group and every other field still answer 200. Only
   that block is guarded — the local scans and the aggregation keep today's failure behavior.
2. **Classification-scan failure (obligation 2).** The new `realScanStrfry({ kinds:[9999], ids })` is
   wrapped in try/catch inside `aggregateNotesTagged`; on failure `itemEventsById` stays empty, so the
   items group degrades to address-only and the notes track is untouched. Still 200.
3. **Coordinate case (obligation 3).** `a` coordinates are **normalized to a lowercase pubkey at
   ingest** (`normalizeAddress`, kind and `d` preserved verbatim) before they become
   `itemMembers[].address` / `fullItemMembers[].address`. Two case-variant coordinates merge into one
   member (counts concatenated into a fresh entry — the grouping result is never mutated). Story 5
   therefore publishes a lowercase-pubkey coordinate into its kind-30394 `a` tag, matching strfry's
   lowercase `authors:` filters.
4. **E4's zero-field branch (obligation 4).** Left as the Tester described: not server-observable, so
   only the UI copy is pinned. `TagItemsView` marks a group "list not on this relay" *only* when the
   header query returned nothing; a header that resolves with zero declarations renders the degraded
   table with no such marker. No Playwright spec added.
5. **E5 tie-break (obligation 5).** Stated and implemented as **first matching parent tag in the
   event's own tag order** — the first `z` tag for a kind-39999 item, the first `e` tag for a
   kind-9999 item (`listCoordOf`). Deterministic given the signed event; no sorting.
6. **AC-2 count-before-click (obligation 6).** Implemented in the pinned idiom —
   `hidden={notesMode !== 'items'}` around an eagerly-mounted `<TagItemsView … onCount={setItemCount}>`,
   with the switch button reading `Items ({itemCount})`. No loosening requested.

Smaller calls:

- **Comparator generalization.** `appliedOf`/`disputedOf`/`recencyOf` now take a *key*: a bare 64-hex
  id (notes, unchanged — `:` is not a hex character, so an id can never collide with the address
  prefix) or `a:<coordinate>`. The notes track passes bare ids exactly as before; U7 pins that the
  ordering is unchanged under all four sorts.
- **Degraded item rows (E3) get a synthesized `d` tag client-side** (`toTableItem`) derived from their
  coordinate, so the row's story-3 tag affordance (`DListItemTags` → `itemTarget`) still aims at the
  item's `a` address instead of falling back to a non-event id. Server rows are unchanged.
- **Items with a null `listCoord`** (an item event that names no parent) are grouped into one trailing
  "Items with no list" group rather than being dropped.
- Row `id` for the table/React key falls back to the coordinate when the item event did not resolve.
