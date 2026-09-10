# Story 3: Tag a DList item

**Status:** Approved
**Created:** 2026-09-09
**Type:** Feature *(Light lane — workflows/light-profile.md; Gate A approved 2026-09-10 — inline in the row slot, Design note not ADR, scoped gate `test/dlist-item-tagging.test.js` + the strfry write-assertion guard suite; depends on story 2)*

## Background
Story 1 renders a list's items; story 2 makes `a`-target assertions safe. This story puts the
existing note-tagging affordance on each item row: the same tag menu, the same apply/dispute
stances, the same per-POV reading — the only difference is the target, an `a` coordinate
(`39999:<author>:<d>`) instead of an event id. The read API already accepts `address=`
(`GET /api/event-tags/for-event`), the core builders and filters already branch on
`{ address }`; the UI hook and component today take only an event id.

## User-facing description
As a signed-in user viewing a Decentralized List, I want to apply or dispute a tag on any item
and see which tags my point of view already applies to it, so that I can curate the list's
items — starting with tagging GitHub accounts as, e.g., "white hat hacker".

## Acceptance criteria
- [ ] AC-1: Given a list item row and a signed-in viewer, the row carries the tag affordance;
      applying a tag publishes an event-tagging assertion whose target is the item's `a`
      coordinate (never its event id), through the existing publish gate (local strfry only
      during the build).
- [ ] AC-2: Given taggings exist for an item, the row shows the tags that count under the active
      POV, with the viewer's own stance (apply / dispute) distinguished, exactly as on a note.
- [ ] AC-3: Disputing, and re-applying after a dispute, work as on notes; the item's stance
      updates without a page reload.
- [ ] AC-4: Given a signed-out viewer, tags remain visible read-only and the write affordance is
      absent.
- [ ] AC-5: Given the "+ Tag a Note" style entry (paste an identifier), pasting an item's
      `naddr` or `kind:pubkey:d` coordinate resolves to the item and tags it as an `a` target.
- [ ] AC-6: Note tagging is unchanged (regression sentinel on the note surfaces).
- [ ] AC-7: The app's user-facing navigation links to `/lists` (closes story 1 review
      follow-up N-7).

## Concepts touched
- `39998:<TA>:nostr-event-tag`, `39998:<TA>:tagging-with-specific-tag`, `39998:<TA>:tag`.

## Out of scope
- The tag page's Items view (story 4). Pins / Trusted Lists (story 5). Votes (out of the book).

## Open questions *(resolve at Gate A)*
1. Where the tags render: inline in the row's `renderExtra` slot (recommendation — story 1
   left it for exactly this) vs. an item detail page. Recommendation: inline now; a detail page
   only if story 4 needs one.
2. Scoped gate: `test/dlist-item-tagging.test.js` + the strfry write-assertion guard suite.

## Design note *(Light profile — written after Gate A, ratified at Gate B)*
- **Chosen approach: a `target`-aware read hook, a `target` prop on `NoteTags`, a
  thin dlist wrapper mounted in the story-1 row slot, and a pure item-target util.**
  (1) `ui/src/utils/dlistFields.js` gains three pure exports (no React, dynamically
  importable like the rest of the file): `itemCoord(item)` → `'39999:<item.pubkey>:<d>'` for a
  kind-39999 item with a `d` tag, else `null` (sibling of `headerCoord`, which is 39998-only);
  `itemTarget(item)` → `{ address: itemCoord(item) }` when the coord exists, else `{ id: item.id }`
  (kind-9999 items are non-addressable and fall back to the event id — AC-1's "never its event
  id" applies to addressable items); and `parseItemRef(input)` → `{ kind: 39999, pubkey, d,
  address }` for `naddr1…` decoding to kind 39999 or a `39999:<64hex>:<d>` coordinate (`d` may
  contain colons, same join rule as `parseListRef`), else `null` — header kinds, notes, npubs
  and any other naddr kind return `null` so the caller falls through to the note path.
  (2) `ui/src/hooks/useEventTags.js`: first argument becomes `target`, accepted as either a
  hex string (today's calling convention, normalised to `{ id }`) or `{ id } | { address }`;
  the fetch sets `eventId=` for `{ id }` and `address=` for `{ address }` on the existing
  `GET /api/event-tags/for-event` (which already validates `isACoord` and scans `#a`; the
  `mine` channel and `rawEvents` come back unchanged for either target). Effect deps become
  `target.id, target.address` plus the existing ones; `NoteTags`'s call
  `useEventTags(item?.id, viewerPubkey)` is untouched. (3) `ui/src/components/NoteTags.jsx`
  gains two optional props: `target` (default `{ id: item?.id }` — the one line at
  `NoteTags.jsx:138` becomes `const target = targetProp || { id: item?.id }`, and the read hook
  is passed the same `target`) and `subject = 'note'`, which only parameterises the two
  aria-labels ("Tags on this note" / "Add a tag to this note"); every default renders the
  identical strings and DOM, so `NoteCard.jsx:85` (`<NoteTags item={item} showScores=…/>`) and
  all four note surfaces are byte-for-byte unchanged in behaviour (AC-6). Apply/dispute/
  create-new all pass `target` into the unchanged `useEventTagging` (`applyTag(tagInput,
  target)`), whose core builders already emit `['a', address]` and — since story 2 — the
  `event-tag-<slug>-<author8>-<d16>-<hash8>-<asserter8>` d, with `hash8` supplied by the hook.
  Publishing rides the unchanged `publishOrThrow` gate (local strfry only); `run()` still
  `refetch()`es after a write, so the row's stance updates in place (AC-3). Signed-out: the
  existing `!hasTags && !viewerPubkey → null` / `viewerPubkey && <button>` branches give AC-4
  for free. (4) New `ui/src/components/dlist/DListItemTags.jsx` — `({ item, showScores })` →
  `<NoteTags item={item} target={itemTarget(item)} subject="list item" showScores={showScores}
  />` — is the single place the item-target rule is applied; `ui/src/pages/List.jsx` passes
  `renderExtra={(it) => <DListItemTags item={it} />}` to the existing `DListItemsTable`
  (`DListItemRow.jsx:71` renders it in the trailing `<td class="bs-dlist-extra-slot">`), and
  story 4 reuses the same wrapper on the tag page. (5) AC-5, scoped to the smallest real
  extension of `ui/src/components/TagANoteModal.jsx`: `submit()` runs `parseItemRef(input)`
  *before* `classifyEventInput`; a hit sets `itemRef` state and resolves the item client-side
  with `queryRelay({ kinds: [39999], authors: [pubkey], '#d': [d] })` (the `List.jsx` header
  pattern), then its header via the item's `z` tag through `parseListRef` (best-effort:
  missing header → `fieldDecls = []`, the row still renders through the "other fields"
  toggle). The resolved item renders as a one-row `DListItemsTable` with
  `renderExtra={(it) => <DListItemTags item={it} />}`; the modal's own Apply/Dispute row calls
  `applyTag/disputeTag(tag, { address })` and the post-tag count read uses `address=` instead
  of `eventId=`. A non-hit falls through to today's note path unchanged, so an `naddr` of any
  other kind still yields the existing `naddr` reason copy, and the placeholder/REASON_COPY
  for notes stay as they are (AC-6); the placeholder gains "· naddr1… / 39999:…:d (list item)".
  Item kind-9999 (non-addressable) pastes are NOT recognised by the paste box — a bare
  64-hex is a note id by precedence and stays so. (6) AC-7: one edit —
  `ui/src/config/avatarMenuLinks.js` `destinationLinks` gains `{ key: 'lists', icon: '📋',
  label: 'Lists', to: '/lists' }`, which both avatar menus (`BrainstormUserMenu.jsx`,
  `Header.jsx`) already render; `/lists` is a router route (`App.jsx:148`) so no `external`.
  No server change, no new dependency, no TA-pubkey literal (the `LEGACY_TA_PUBKEY` z is the
  ADR-0015 exception inside the untouched hook), no concept/firmware change (the
  `nostr-event-tag` concept already names "e or a" targets — no reinstall).
- **Rejected alternative: fork `NoteTags` into a standalone `ItemTags.jsx`.** Copy the
  ~230-line component, swap the target and strings, leave `NoteTags` untouched. Rejected
  because the component is not just chips: it carries the `mine`-union display rule, the
  raw-events inspector (ADR tag-event-inspector 0003 D3/D4 — all-or-nothing blocks, per-coord
  open state), the compact `PovStatusNotice` disclosure rule and the partial-failure
  (`failedAt`) banner — all of which six existing suites sentinel on `NoteTags.jsx` by source
  text. A fork would need its own copy of every sentinel and would drift the first time any of
  those rules changes; the `target` prop is a one-line generalisation of the only note-specific
  fact in the file (`{ id: item?.id }`). A second rejected option — `parseItemRef` inside
  `eventParam.js` / `classifyEventInput` — was dropped because that module is the `/event`
  page's decode core (`BrainstormEvent.jsx` consumes it) and its `naddr → naddrUnsupported`
  precedence is ADR event-page/0002 behaviour; keeping the item rule in `dlistFields.js` leaves
  `/event` untouched.
- **Blast radius.** Modified: `ui/src/hooks/useEventTags.js` (target normalisation + param
  choice; sole consumer `NoteTags.jsx`, call site unchanged), `ui/src/components/NoteTags.jsx`
  (two optional props; sole consumer `NoteCard.jsx:85`, unchanged), `ui/src/utils/dlistFields.js`
  (three additive exports), `ui/src/pages/List.jsx` (`renderExtra` prop + import),
  `ui/src/components/TagANoteModal.jsx` (item branch; sole consumer `TagNotesView.jsx`,
  unchanged), `ui/src/config/avatarMenuLinks.js` (one `destinationLinks` entry),
  `test/test.js` (register the new suite). New: `ui/src/components/dlist/DListItemTags.jsx`,
  `test/dlist-item-tagging.test.js`. Reused unchanged: `useEventTagging.js`,
  `publishProfileTag.js` (`publishOrThrow`), `utils/dtag.js` (`hash8`), `src/lib/event-tagging/*`,
  `src/api/event-tags/index.js` (`address=` already accepted), `DListItemsTable.jsx`,
  `DListItemRow.jsx`, `TagChip.jsx`, `AddTagDialog.jsx`, `PovStatusNotice.jsx`,
  `RawTaggingEvents.jsx`, `api/relay.js` (`queryRelay`). Grep-verified non-consumers left
  untouched: `grep -rn "useEventTags" ui/src` → only `NoteTags.jsx`; `grep -rn "NoteTags" ui/src`
  → only `NoteCard.jsx` (plus comments in `NoteActionsMenu`/`RawTaggingEvents`/`TagChip`);
  `ui/src/utils/eventParam.js` and its other consumer `ui/src/pages/BrainstormEvent.jsx`;
  `ui/src/pages/lists/DListItems.jsx`, `TagNotesView.jsx` and `ProfileTagsSection.jsx` import
  neither `useEventTags` nor `NoteTags` (grep exit 1); `grep -rn destinationLinks test/` → no suite
  pins the array's length or keys.
- **Invariants.** POV-first: the chips are `for-event`'s per-POV verdict (`povParams` from
  `usePov` ride along exactly as for notes) and `mine` is the viewer's own durable stance;
  nothing is pre-computed or stored per item. Decentralized-first: any pubkey's item can be
  tagged by any signer; no author gate. The row fetch fan-out (one `for-event` per rendered
  row, `available-tags` shared through the existing 60 s cache) matches the note-feed pattern;
  a batched read is deferred until measured (principle 3 — "might be slow" is not enough).
- **Scoped gate** (Gate A): `node -e "require('./test/dlist-item-tagging.test.js').run().then(r=>process.exit(r.fail?1:0))"`
  plus `node -e "require('./test/strfry-write-assertion-bracket.test.js').run().then(r=>process.exit(r.fail?1:0))"`;
  house pattern — pure-util cases via `loadEsm()` dynamic `import()` of `dlistFields.js`, source
  sentinels on the new wiring, and R* regression sentinels on `NoteTags.jsx` / `NoteCard.jsx` /
  `useEventTagging.js` / the story-1 files.

## Edge cases & not-covered
- **E1** *(not derivable from any AC)*: a kind-39999 item with **no `d` tag** (malformed
  addressable) → `itemCoord` returns `null` and `itemTarget` falls back to `{ id }`; the
  affordance still renders and the assertion carries an `e`, never a malformed `39999:pk:`.
- **E2** *(not derivable)*: an item whose `d` contains colons (`39999:pk:a:b`) → `itemCoord`
  emits it verbatim and `parseItemRef` round-trips it (`parts.slice(2).join(':')`), so the
  pasted coordinate and the row's coordinate produce the same `address` and the same tags.
- **E3** *(not derivable)*: two items on the page by different authors sharing the same `d`
  → distinct coordinates (`pubkey` is part of the address); tags on one never bleed to the
  other, and the `for-event` reads are keyed per row.
- E4: a kind-9999 item (non-addressable list item) → `itemTarget` is `{ id }`; the read uses
  `eventId=` and the write emits `e` — same path as a note.
- E5: pasting an `naddr` whose kind is not 39999 (e.g. a 39998 header, a 30023 article) →
  `parseItemRef` returns `null`, the note path runs, and the existing "addressable event
  (naddr)" reason shows exactly as today; a `39998:…` coordinate likewise falls to `invalid`.
- E6: pasted item coordinate that resolves to nothing on local strfry → the modal shows a
  "Couldn't load that list item" state; nothing is published (Apply/Dispute require the
  resolved item).
- E7: item resolves but its header (`z` tag) is missing or malformed → the one-row table
  renders with `fieldDecls = []` (values visible via "N other fields"); tagging still works
  since the target needs only the item.
- E8: signed-in viewer whose POV does not count them → after apply, the chip appears via the
  `mine` union and survives reload (story-7 channel, unchanged for `address`).
- E9: apply → dispute → apply on one item without reload → the chip's `myStance` flips each
  time from the refetched `mine`; the replaceable d is stable per (tag, target, asserter) so
  no duplicate assertions accumulate.
- E10: publish partial failure (`failedAt`) mid-sequence → the row's banner shows the retry
  copy, `refetch()` still runs; retry is safe (replaceable).
- E11: the signed-in extension account differs from the session pubkey → `assertSignerMatches`
  throws before any publish (hook behaviour, inherited).
- E12: `/lists` menu entry from the Tapestry shell (`Header.jsx`) → in-router navigation, no
  full page load, no `external` flag.
- **Not covered:** visual placement/density of the chips inside the table cell (browser check
  at Gate B); `naddr` relay hints on a pasted item (ignored — local strfry only); resolving a
  pasted item that lives only on an external relay (out of scope, same as story 1);
  applicability context for items (the picker keeps `useTagApplicability('event', …)` — a
  dedicated "list item" applicability context is not in this book); per-row read fan-out cost
  (measure before batching); the server `for-event` `address=` branch's own validation
  (covered by `test/event-tagging-read-api.test.js`); the story-2 d-rule bytes (covered by
  `test/event-tagging-a-target-dtag.test.js`).

## AC→handle lines
—

## Linked artifacts
- ADR: none expected (story 2 carries the wire change)
- Review: `engineering-team/reviews/dlist-item-tagging/3-tag-a-dlist-item.md`

Link by path only — never record verdicts or round history in this file.
