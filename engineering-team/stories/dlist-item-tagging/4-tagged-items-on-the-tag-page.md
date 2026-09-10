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

- **Server — one call, one POV filter, additive `items`.** `aggregateNotesTagged`
  (`src/api/event-tags/index.js:247`) already receives BOTH target shapes from
  `core.groupTaggingsByTarget` (`src/lib/event-tagging/classify.js:130` — `targetOfCandidate` yields
  `{address}` for `a`); it just filters them out at its step 4 (`countByTarget` keys on
  `t.target.id`). Add a **parallel** address track inside the same function, reusing the *same*
  `targets`/`mine`/`isAsserterTrusted` results (never a second scan, never a re-implemented trust
  predicate — `trustPredicateFor`, :104–140, stays the only one): `countByAddress` / `mineByAddress`
  / `latestByAddress`, ranked by the **same** `idComparators` (`recent|applied|disputed|divisive`) and
  capped by the same `NOTES_CAP` value, returning `itemMembers` (`{ address, applications, disputes,
  createdAt, mine }`), `itemTotal`, `itemTruncated`. `handleForTag` (:343) resolves those coordinates
  local-first exactly as it does note ids — `realScanStrfry({ kinds:[9999,39999], authors:[…],
  '#d':[…] })` per distinct author, then match back on the exact coordinate — and adds to the response
  body `items: [{ address, id, kind, pubkey, created_at, tags, content, listCoord, applications,
  disputes, mine }]`, `itemTotal`, `itemTruncated`. `notes`, `members`, `fullMembers`, `mine`,
  `total`, `truncated`, `sort`, `povSuffix`, `povResolution` and the cache key are **byte-identical**;
  `members`/`fullMembers` stay note-id-only (see blast radius).
- **Header field declarations resolve client-side, per group — not server-side.** The server ships the
  item events plus each item's `listCoord` (its `z` for a 39998 header, `e` for a 9998 one); the new
  `ui/src/components/TagItemsView.jsx` batches one `queryRelay({ kinds:[9998,39998], … })`
  (`ui/src/api/relay.js`) for the distinct coords and derives columns with the existing pure
  `parseFieldDecls` / `headerNames` / `parseListRef` (`ui/src/utils/dlistFields.js`). Why: those
  parsers are ESM UI-side today, so server enrichment would fork field-decl semantics into a second
  implementation (the exact drift `/list/:ref` and this view must not have); it would also inflate the
  30s-cached `for-tag` body that `publishTagPin.js`, `usePinnedNotes.js` and `ExportModal.jsx` already
  read; and AC-4 falls out for free — a coord whose `queryRelay` returns nothing renders the group as
  "list not on this relay" with coordinate + author, `fieldDecls: []`, `DListItemsTable` degrading to
  its Added-by / Age / Other-fields / Votes columns.
- **UI — a third value on the existing `notesMode` switch.** `ui/src/pages/Tag.jsx` keeps
  `notesMode` (:65) and adds `'items'` plus an **Items** button beside Profiles|Notes (:317–338),
  inside the *default* tab — the `?tab=`/Pinned machinery (:73–101) is untouched. `TagItemsView` is
  mounted **eagerly-hidden** (unlike the lazy `notesOpened`) and reports its total through
  `onCount`, because AC-2 wants the count *before* the click; the cost is one `for-tag` call at tag-page
  load, which the server's 30s cache then serves free to `TagNotesView`. `TagItemsView` reuses
  `TagViewControls` with the identical sort keys and curated/expanded/filter semantics as
  `TagNotesView` (AC-5) — including the `mine`-durability exemption — renders one
  `DListItemsTable` per list group with `renderExtra={(item) => <DListItemTags item={item} />}`
  (story 3), and links each group heading to `/list/<coord>`.
- **Hook: extend, don't fork.** `ui/src/hooks/useNotesForTag.js` additionally returns
  `{ items, itemTotal, itemTruncated }` from the same response (existing return keys unchanged, so
  `TagNotesView` compiles untouched); `TagItemsView` calls the same hook. Two mounts of one endpoint
  are deduped by the server cache; a second hook file would duplicate the POV/nocache/nonce logic.
- **Rejected alternative — a separate `GET /api/event-tags/for-tag-items`** (or a client-side scan of
  `a`-taggings). Real reason: the POV trust predicate, the honored-authority header discovery, the
  multi-header union and the polarity/`mine` gating would then exist in two places for one tag; the
  two endpoints could disagree about who counts after a POV switch, and the tag page would pay a
  second full header+tagging scan for the same candidate set it already fetched. Rejected also
  because it doubles the surface that `pov-resolution-status.test.js` S3 (POV-aware cache key) has to
  guard. The genuine cost of the chosen option — a fatter `for-tag` body and one more resolution step
  on every notes read — is accepted and bounded by the same cap the notes track uses.
- **Blast radius.** Changed: `src/api/event-tags/index.js` (`aggregateNotesTagged`, `handleForTag`),
  `ui/src/hooks/useNotesForTag.js` (additive returns), `ui/src/pages/Tag.jsx` (third switch + eager
  hidden mount), new `ui/src/components/TagItemsView.jsx`, plus CSS for the group headings.
  Consumers that read the response and must keep working unchanged: `ui/src/components/TagNotesView.jsx`,
  `ui/src/utils/publishTagPin.js:352` (`data.members || data.notes`), `ui/src/hooks/usePinnedNotes.js:76-77`,
  `ui/src/components/ExportModal.jsx:151`, `ui/src/components/PinnedListPanel.jsx:529`. **Grep-verified
  non-consumers** (no change, and a diff touching them is out of radius):
  `src/api/trustedList/refreshPinnedTags.js:351` destructures only `{ fullMembers, scanTruncated, total }`
  from `aggregateNotesTagged`, so the TA-signed kind-30393 note TL cannot see `itemMembers`;
  `src/lib/event-tagging/classify.js` needs **no** edit (`grep -n "target.id" src/lib/event-tagging/classify.js`
  → no hits; the `a`-branch at :134 already exists); and `ui/src/pages/List.jsx` is untouched — the new
  view reuses `DListItemsTable`/`DListItemTags`, not the page.
- **No irreversibility trigger** (confirmed at Gate A): read-only, no wire/event shape, no schema or
  concept change, no firmware reinstall, no new dependency, no routing/middleware order change, no
  cross-repo value. Concept handles named in the story could not be re-checked against the Concept
  Graph API (control panel not reachable on this host during design) — `39998:<TA>:nostr-event-tag`,
  `tagging-with-specific-tag`, `list` are used here only as documentation, not as code constants.

## Edge cases & not-covered

- **E1 — (not derivable from any AC) `members`/`fullMembers` must stay note-id-only.** An `a`
  coordinate leaking into them would be published as an `e` member of the TA-signed kind-30393 note
  Trusted List (`refreshPinnedTags.runOneNotePin`) and into pin exports (`publishTagPin.js`) — a
  signed-event corruption invisible on the tag page. Sentinel: aggregate a fixture mixing `e` and `a`
  taggings and assert no member id contains `:` and `members.length` is unchanged from the pre-change
  baseline.
- **E2 — an `a` target that is not a DList item.** A tagging can point at any coordinate (a
  `30023:` long-form, a `39999:<pk>:<slug>` tag element). Only events whose resolved kind is
  9999/39999 *and* which carry a list membership ref are grouped as items; anything else is dropped
  from the `items` group (and never crashes the view or falls into `notes`).
- **E3 — coordinate tagged but the item event is on no reachable relay.** The row still renders from
  the coordinate (author + `d`), with empty field cells; the group is not suppressed.
- **E4 — header unreachable (AC-4) *and* header present but declaring zero fields.** Both render the
  degraded table; the zero-field case must not be reported as "list not on this relay".
- **E5 — one item in two lists / two lists declaring the same field names.** An item carrying
  multiple header refs is grouped under its first ref only (deterministic, documented); identical
  field names in different groups must not collide because each group derives its own `fieldDecls`.
- **E6 — coordinate normalization.** Uppercase pubkeys and a `d` containing colons round-trip through
  `parseListRef`/`parseItemRef` and still match the server's lowercase strfry `authors:`/`#d` filters.
- **E7 — POV switch mid-view.** Flipping `wotPov` re-filters items and notes together; the existing
  POV-aware `for-tag` cache key (guarded by `pov-resolution-status.test.js` S3) must still prevent one
  POV's `items` from being served to another.
- **E8 — `mine` durability + disputes.** An item the viewer tagged with zero trusted backers stays
  visible in the curated (collapsed) view; a net-disputed item hides in curated and appears when
  expanded — same rule as notes.
- **E9 — empty and regression states.** Zero item-taggings → the Items switch reads `(0)` with the
  empty copy; Profiles and Notes render byte-identically to before (AC-6 sentinels: the `notes`,
  `members`, `total`, `truncated` fields and `TagNotesView`'s output unchanged).
- **E10 — cap and truncation.** Items are capped at the same `NOTES_CAP` value on their own track;
  when `itemTotal` exceeds it the view shows "Showing the top N of M tagged items" rather than
  silently truncating.
- **E11 — external-relay failure during item resolution.** If the local scan finds nothing and the
  relay round-trip throws, the group degrades to E3 rows; the notes half of the response must still
  return 200.
- **Not covered:** pagination past the cap (out of scope, as for notes); kind-7 vote counts in the
  Items groups (the Votes column renders "—"; `/list/:ref`'s reaction scan is not reused);
  pins/Trusted Lists for items (story 5); server-side header enrichment or list-name search; any
  measurement of the added `for-tag` call at tag-page load beyond "does not error".

## AC→handle lines
—

## Linked artifacts
- ADR: none expected
- Review: `engineering-team/reviews/dlist-item-tagging/4-tagged-items-on-the-tag-page.md`

Link by path only — never record verdicts or round history in this file.
