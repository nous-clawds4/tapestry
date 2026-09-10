# Story 5: Pins and Trusted Lists for tagged items

**Status:** Approved
**Created:** 2026-09-10
**Type:** Feature *(Light lane — workflows/light-profile.md; Gate A approved 2026-09-10 —
`targetTypes` gains `'item'` (additive, backward-compatible: absent reads as the pre-existing
default, unknown values ignored by older readers), so a Design note suffices, not an ADR;
`d`-prefix `tl-pin-items-`; scoped gate `test/item-trusted-list.test.js` +
`test/generalized-tag-pinning.test.js` + the strfry write-assertion guard suite; depends on
story 4)*

## Background
Pinning a tag opts it into the viewer's curated set, and the scheduled publisher then emits
TA-signed Trusted Lists under the viewer's POV: `runOnePin` → kind **30392** (`p` members,
profiles) and `runOneNotePin` → kind **30393** (`e` members, notes). The kind family already
reserves **30394** for **addressable (`a`) members** — `src/api/trustedList/index.js` accepts it
(`kinds 30392–30395 = p / e / a / i`) and `protocols/drafts/trusted-lists.md` specifies it — but
no runner produces one for tagged items. So a tag can be pinned, its GitHub accounts tagged, and
the resulting curated set never becomes a Trusted List. This is the book frame's last bullet, and
it is what a downstream indexer (Vespa, other repo) would actually subscribe to.

## User-facing description
As a user who has pinned a tag, I want the items I and my web of trust have tagged with it to be
published as a Trusted List under my point of view, so that other services can consume "the
GitHub accounts my POV considers white-hat hackers" as a signed, addressable list.

## Acceptance criteria
- [ ] AC-1: Given a pinned tag with trusted `a`-target taggings under the pinner's POV, when the
      pin refresh runs, then a TA-signed kind-**30394** Trusted List is published whose members
      are the tagged items' `a` coordinates, with the same `d`-tag discipline, `a`-tag back-ref
      to the tag element, and observer `p` tag the 30392/30393 runners use.
- [ ] AC-2: Given the curation method's target types, items are included only when the method
      selects them; the existing profile and note behavior is unchanged for every existing pin,
      including pins whose stored method predates this story (absent value reads as the
      pre-existing default — no silent inclusion or exclusion).
- [ ] AC-3: Given the curation-method dialog, the viewer can select item targets alongside
      profiles and notes, and the "select at least one" validation accounts for the new option.
- [ ] AC-4: Given a previously published 30394 whose membership no longer qualifies, the stale
      list is retracted by the same mechanism the 30392/30393 runners use.
- [ ] AC-5: Given the Pins page and the tag page's Pinned tab, the 30394 list's status is shown
      alongside the existing 30392/30393 lines, with its member count.
- [ ] AC-6: Given a pin whose tag has no item taggings, no empty 30394 is published, matching the
      notes runner's behavior.
- [ ] AC-7: The 30392 and 30393 runners, their tests, and every existing published list are
      unaffected (regression sentinels).

## Concepts touched
- `39998:<TA>:tag-pinning` (curation method), `39998:<TA>:nostr-event-tag`.
- Spec: `protocols/drafts/trusted-lists.md` (30394 = `a` members — already specified).

## Out of scope
- The downstream indexer. Retiring/renaming existing lists. Any change to 30392/30393 wire shape.
- Applicability lists (already 30394 for a different purpose — keep the `d`-prefix namespaces
  distinct and say so in the Design note).

## Open questions *(resolved at Gate A, 2026-09-10)*
1. **`targetTypes` value.** Adding `'item'` (or `'dlist-item'`) to the enum changes a value that
   rides inside published `curation-method` JSON. **Decided:** it is **additive and
   backward-compatible** (absent = today's default `['profile','note']`, and unknown values are
   ignored by older readers), so a Design note suffices. The value is **`'item'`** — permanent once published.
2. **`d`-tag prefix — decided:** `tl-pin-items-` (mirrors `tl-pin-notes-`), distinct from the
   applicability lists' prefix; the Design note confirms no collision.
3. **Scoped gate — decided:** `test/item-trusted-list.test.js` + `test/generalized-tag-pinning.test.js` +
   the strfry write-assertion guard suite.

## Design note *(Light — after Gate A)*

- **Server — a third runner, `runOneItemPin`, twin of `runOneNotePin`.** New function in
  `src/api/trustedList/refreshPinnedTags.js` (exported for tests alongside `runOnePin`/`runOneNotePin`),
  same injectable-deps shape (`{ lookupTag, aggregateNotesTagged, publishTL }`). Gate: `targetTypes` from
  `parseCurationMethod`, **absent ⇒ the pre-existing default `['profile','note']`** (byte-identical literal
  to the note gate at :330–332), so a pin authored before this story publishes **no** item list (AC-2, no
  silent inclusion); present-but-without-`'item'` ⇒ `{status:'skipped'}`. Same observer POV cascade
  (`resolvePov({wotPov:'user', userPubkey: observer})`), same `noteMethod`→`sort` mapping, and it reuses
  `curateNotes` (`src/lib/event-tagging/taggings.js:125`) **unchanged** — that function is pure over
  `{applications, disputes, createdAt}` and never touches `id`, so address rows curate identically (no new
  curation enum, no `itemMethod` field: one fewer permanent published value). Publishes via the existing
  `buildAndPublishTL` `a` branch (`src/api/trustedList/index.js:151–155`): `kind: 30394`, `d` =
  `tl-pin-items-<observer8>-<tagAuthor8>-<tagSlug>`, `metric` = `pinned-tag-items`, `title` = tag.name,
  members `curated.map(i => ({ tag: 'a', value: i.address }))`, extraTags `['observer', observer]`,
  `['source-tag', tag.eventId, tag.authorPubkey, tag.slug]`, `['curation-method', noteMethod]`,
  `['p', observer]`, plus the `['truncated', String(total)]` partial signal. Empty curated set ⇒
  `{status:'skipped'}` with no publish (AC-6, matching the notes runner). New exported constant
  **`ITEM_TL_MEMBER_CAP = 500`** — half `NOTE_TL_MEMBER_CAP` because an `a` coordinate (~80–120 bytes) is
  roughly double a 64-hex `e` id, keeping one event inside the same ~75KB budget ADR event-tagging/0017
  chose; overflow is SIGNALED, never silent. Wiring: `refreshAllPinnedTags` (:395) and
  `refreshPinnedTagsForViewer` (:415) each add `const itemResult = await runOneItemPin(pin)` →
  `itemTL: { status, dTag, memberCount }` on the result row, and the cron path adds one line —
  `await retractStaleTLs(currentItemDTags, { kind: 30394, dPrefix: 'tl-pin-items-' })` — reusing the
  already kind-parameterized retractor at :277 verbatim (AC-4, no edit to it).
- **`d`-prefix collision check (grep-verified).** `grep -rn "tl-pin-" src/ ui/src/ test/ protocols/` returns
  only `tl-pin-` (30392) and `tl-pin-notes-` (30393); **no** `tl-pin-items-` anywhere, and no existing prefix
  that shadows it. The applicability lists also publish **kind-30394**
  (`src/api/trustedList/refreshApplicabilityLists.js:24–28`) but under the fixed d-tags
  `tag-applicability-nostr-pubkey` / `tag-applicability-nostr-event` — a disjoint namespace, so the new
  `retractStaleTLs(…, { kind: 30394, dPrefix: 'tl-pin-items-' })` sweep, which scans *all* TA-signed 30394s,
  skips them at its `dTag.startsWith(dPrefix)` guard. That guard is the only thing standing between this
  story and retracting the applicability lists (see E2).
- **Spec — verified, no change required.** `protocols/drafts/trusted-lists.md` already binds 30394 =
  addressable/`a` members (the `+10` table) and already sanctions non-member single-letter *discovery* tags.
  One deliberate divergence from the note TL: the 30393 runner carries `['a', '39999:<author>:<slug>']` as a
  back-ref, which on a **30394** is indistinguishable from a member (`a` *is* the member tag for this kind).
  The item TL therefore drops it and keeps discovery on `['p', observer]` plus `['e', tag.eventId]` (`e` is a
  non-member tag on 30394, so `{kinds:[30394], "#e":[tagEventId]}` stays unambiguous); `source-tag` remains
  the stable cross-version back-ref. Optional, non-blocking: one clarifying sentence in the spec's
  discovery-tags bullet ("on a 30394 every `a` tag is a member; a tag back-ref moves to `e`").
- **Client + status surfaces.** `ui/src/utils/publishTagPin.js:95` — `defaultCurationMethod` returns
  `targetTypes: ['profile','note','item']` (new pins opt in by default; the *runner's* legacy default stays
  `['profile','note']`, so nothing already published changes meaning).
  `ui/src/components/CurationMethodDialog.jsx` — `initTypes` fallback at :75 stays `['profile','note']`
  (editing a pre-existing pin must not silently add items), new `includeItems` state + checkbox, the build at
  :114–117 pushes `'item'`, and the validation string becomes "Select at least one: profiles, notes, or
  items." (AC-3). Status (AC-5): `src/api/profile-tags/index.js` `enrichRowsWithTLStatus` (:1626) gains a
  second batched scan `{kinds:[30394], authors:[TA_PUBKEY], '#d': itemDTags}` setting `row.itemTlStatus`
  (`{ status: 'never'|'ok'|'retracted'|'unsupported', lastRefreshAt, tlEventId, memberCount }` with
  `memberCount` = count of `a` tags), leaving `row.tlStatus` byte-identical; `ui/src/pages/Pins.jsx` renders it
  through a `renderItemStatusLine(row.itemTlStatus)` sibling of `renderStatusLine` (:48) under the 30392 line,
  and `ui/src/components/PinnedListPanel.jsx` adds a `naddr30394` row beside `naddr30392` (:205–212, :409–414)
  via `nip19.naddrEncode({ kind: 30394, pubkey: taPubkey, identifier: itemDTag })` — `taPubkey` from
  `useConfig()`, never a literal. **Discovered fact:** there is no 30393 status line today (Pins.jsx renders
  only `tlStatus` and `nip51ExportStatus`; PinnedListPanel's note row is the *user-signed* kind-30003 bookmark
  set), so AC-5 is met by adding the item line beside the 30392 line; back-filling a missing note-TL line is
  Not covered.
- **Consumes from story 4 — cross-story contract (must be satisfied there, not here).** `runOneNotePin` today
  destructures `{ fullMembers, scanTruncated, total }` from `aggregateNotesTagged` (:351), and story 4's E1
  pins `members`/`fullMembers` to note ids only — correct, and this story does not relax it. `runOneItemPin`
  therefore needs the **uncapped** address accessor: **story 4 must additionally return `fullItemMembers`** —
  the complete ranked address set, elements `{ address, applications, disputes, createdAt, mine }`, exactly
  analogous to `fullMembers` vs the `NOTES_CAP`-sliced `itemMembers` its Design note already names — plus the
  already-promised `itemTotal`. Story 4's `itemMembers` (capped at 50) is **unusable** for a durable list
  (ADR event-tagging/0017: a published list must be complete or explicitly signal partial). This story's read
  is exactly `const { fullItemMembers, itemTotal, scanTruncated } = await aggregateNotesTagged({…})`, with
  `partial = !!scanTruncated || curated.length > ITEM_TL_MEMBER_CAP`. If story 4 ships without
  `fullItemMembers`, this story is blocked — it must not add a second aggregation or re-slice a capped set.
- **Rejected alternative — fold items into `runOneNotePin` (one runner emitting 30393 + 30394).** Tempting
  because both read one `aggregateNotesTagged` call, so one runner means one scan. Rejected because the two
  lists differ in kind, `d`-prefix, member tag, member cap, back-ref shape *and* gate value, so the merged
  function would branch at six points inside the code path that publishes every existing kind-30393 — putting
  AC-7's "the 30393 runners, their tests, and every existing published list are unaffected" at risk on every
  future item-side edit, and forcing `test/note-trusted-list.test.js` to be rewritten around a second publish
  call. The genuine cost of two runners — one extra `aggregateNotesTagged` call per pin per refresh — is
  accepted: it is the same call with identical arguments, bounded by the pin count, on a cron path, and can be
  memoized later if measured. Also rejected: an `itemMethod` curation field (a second permanent published enum
  for semantics `curateNotes` already provides).
- **Blast radius.** Changed: `src/api/trustedList/refreshPinnedTags.js` (new `runOneItemPin`, two wiring sites,
  one retraction sweep, new `ITEM_TL_MEMBER_CAP` export), `src/api/profile-tags/index.js`
  (`enrichRowsWithTLStatus` → `itemTlStatus`), `ui/src/utils/publishTagPin.js` (default `targetTypes`),
  `ui/src/components/CurationMethodDialog.jsx` (option + validation), `ui/src/pages/Pins.jsx` (status line),
  `ui/src/components/PinnedListPanel.jsx` (naddr row), plus CSS for the new line; and — **in story 4** —
  `src/api/event-tags/index.js` for `fullItemMembers`. **Grep-verified non-consumers** (a diff touching them is
  out of radius): `src/api/trustedList/refreshApplicabilityLists.js` — also kind-30394, but its fixed
  `tag-applicability-*` d-tags share no prefix with `tl-pin-items-`, so neither the publisher nor the retractor
  can see it; `ui/src/hooks/useTagMemberSets.js:63` scans `kinds: [30392]` only, so member-set badges are
  untouched; `src/lib/event-tagging/taggings.js` (`curateNotes`) is reused verbatim; `src/api/trustedList/index.js`
  needs **no** edit (`buildAndPublishTL` already validates 30394 at :119 and already emits `a` members at
  :151–155); and the NIP-51 export path (`ExportModal.jsx`, `enrichRowsWithNip51ExportStatus`, kinds
  30000/30003) gets no item analog.
- **No irreversibility trigger beyond the two named at Gate A** — the additive `targetTypes` value `'item'`
  (permanent once published) and the `tl-pin-items-` d-prefix (permanent once published). No schema or
  concept-definition change ⇒ **no firmware reinstall required**. Concept handles named in the story
  (`39998:<TA>:tag-pinning`, `39998:<TA>:nostr-event-tag`) could not be re-checked against the Concept Graph
  API — the control panel was not reachable on this host during design (`:7778` answers as strfry, `:8080`
  requires login) — so those handles are **unresolved** here and are used as documentation, never as code
  constants.

## Edge cases & not-covered

- **E1 — (not derivable from any AC) the tag back-ref must not be an `a` tag on a 30394.** Copying
  `runOneNotePin`'s `['a', '39999:<author>:<slug>']` discovery tag into the item TL would inject the *tag
  element's own coordinate* into the published member set: on kind-30394, `a` **is** the member tag
  (`protocols/drafts/trusted-lists.md`, `+10` table), so every conformant consumer — including the downstream
  indexer this story exists for — would read the tag itself as a curated item. Invisible in our UI, wrong on
  the wire, permanent once signed. Sentinel: every `a` tag on the published 30394 is a member address, and no
  `a` tag equals `39999:<tagAuthor>:<slug>`.
- **E2 — (not derivable from any AC) the retraction sweep shares kind-30394 with the applicability lists.**
  `retractStaleTLs({ kind: 30394 })` scans *all* TA-signed 30394s; only the
  `dTag.startsWith('tl-pin-items-')` guard keeps it from publishing empty-membership retractions over
  `tag-applicability-nostr-pubkey` / `tag-applicability-nostr-event`, which would silently disable the tag
  pickers instance-wide. Sentinel: a fixture relay carrying both applicability lists plus one stale item TL;
  after the sweep, exactly one retraction is published and both applicability lists keep their event ids.
- **E3 — a pin predating `targetTypes` (absent value).** Produces **no** 30394 (`status: 'skipped'`), while its
  30392 and 30393 outputs stay byte-identical (AC-2 + AC-7). Conversely `targetTypes: ['item']` alone must
  publish an item list and skip profiles and notes.
- **E4 — `a`-taggings exist but none survive the POV trust filter, or all are net-disputed.** Curated set empty
  ⇒ nothing published on a first run (AC-6). But if a 30394 already exists from an earlier run, "not
  published" is not sufficient — it must be retracted by the sweep, not left stale-but-fresh-looking.
- **E5 — an `a` target that is not a DList item** (a `30023:` long-form, a `39999:` tag element). Whatever
  story 4's `fullItemMembers` admits is what gets signed; this story adds no second filter. If story 4's E2
  type filter lives only in `handleForTag` and not in the aggregation, non-item coordinates reach the signed
  list — the item TL must consume the *same* filtered set the Items view shows.
- **E6 — cap and the partial signal.** More than `ITEM_TL_MEMBER_CAP` curated items, or `scanTruncated` true ⇒
  `['truncated','<total>']` present and `content.partial === true` with the true total; at or under the cap
  with a complete scan ⇒ the tag is **absent** (absence means complete — a wrongly-present `truncated` tag is
  as harmful as a wrongly-absent one).
- **E7 — slug hostility in the `d`-tag.** A tag slug containing `-` (or a `d` containing `:`) must still yield
  a parseable `tl-pin-items-<obs8>-<author8>-<slug>`; the parse rule stays "prefix + two 8-hex fields,
  remainder is the slug", the same ambiguity the existing prefixes already tolerate. Coordinates are published
  exactly as aggregated (lowercase pubkey), never re-normalized here.
- **E8 — two pins of the same tag under different observers.** Distinct `d`-tags (different `<obs8>`); neither
  retracts the other, and each row shows its own `itemTlStatus`.
- **E9 — unpin then refresh.** The 30394 is retracted by empty-membership replacement carrying
  `['status','retracted']`; a second sweep is idempotent (skipped via the marker), and Pins.jsx shows
  "Retracted", not "No TL yet".
- **E10 — `refreshPinnedTagsForViewer` does not retract.** Single-viewer scope, like the 30392/30393 paths; an
  item list orphaned by an edit is cleaned up on the next cron sweep. Stated so a tester does not assert
  retraction on the viewer path.
- **E11 — a failing item publish must not poison the others.** A throwing 30394 publish returns
  `{status: 'error'}` on `itemTL` while `runOnePin`/`runOneNotePin` results and their `currentDTags` collection
  are unaffected; a `d`-tag from a failed item publish must **not** enter `currentItemDTags` (it would
  otherwise shield a stale list from retraction).
- **E12 — status enrichment degradation.** A failing 30394 strfry scan leaves `itemTlStatus` at its default
  `'never'` on every row and must not disturb `tlStatus` or `nip51ExportStatus`; `GET /api/profile-tags/pins`
  still returns 200.
- **Not covered:** back-filling the missing kind-30393 status line on Pins.jsx (pre-existing gap, discovered
  during design); any NIP-51 export analog for items (no kind-30000/30003 item set, no drift/diff UI); a
  separate `itemMethod` curation enum; migration or renaming of already-published 30392/30393 lists; the
  downstream indexer that consumes 30394; measuring the second `aggregateNotesTagged` call per pin beyond
  "does not error"; per-item scores or relay hints in the `a` member tags (bare coordinates only in v1).

## AC→handle lines
—

## Linked artifacts
- ADR: none expected unless Open question #1 escalates
- Review: `engineering-team/reviews/dlist-item-tagging/5-pins-and-trusted-lists-for-items.md`

Link by path only — never record verdicts or round history in this file.

## Amendment (2026-09-10)

Gate-A classification superseded: this story now runs **Standard** and is governed by
`engineering-team/decisions/dlist-item-tagging/0002-trusted-list-discovery-tags.md`.

The earlier discovery-tag choice in the Design note — `['e', tag.eventId]` — is **withdrawn**.
Trusted Lists instead carry `['z', '39999:<headerAuthor>:tagging:<slug>-tagging']` naming what the
list is about, family-wide across 30392/30393/30394/30395; members keep the kind's lowercase letter.
See ADR 0002 for the rationale, the header-pick rule, and the 30393 dual-emit migration posture.
