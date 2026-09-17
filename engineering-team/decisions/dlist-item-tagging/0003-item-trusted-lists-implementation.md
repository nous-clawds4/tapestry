# ADR 0003: Item Trusted Lists — implementation architecture (third runner, family-wide `z`, lazy TL header, two firmware concepts)

**Status:** Accepted (Gate A 2026-09-17; see story § Rulings — failure policy F-unified supersedes this ADR's E11 reading: a failed publish keeps its d-tag on the roster for all three kinds, and `runOneNotePin` is aligned here)
**Date:** 2026-09-17
**Story:** `engineering-team/stories/dlist-item-tagging/5-pins-and-trusted-lists-for-items.md`

## Context

Story 5 asks for a **kind-30394** Trusted List of the DList **items** a pinned tag's trusted taggings
cover — the third member-type in the 3039x family (`p` / `e` / `a` / `i`). Its acceptance criteria:

- **AC-1** a TA-signed 30394 whose members are the tagged items' `a` coordinates, same `d`-tag
  discipline / back-ref / observer discipline as the 30392+30393 runners.
- **AC-2** items included only when the curation method selects them; absent `targetTypes` reads as
  the pre-existing default (no silent inclusion/exclusion).
- **AC-3** the curation dialog offers item targets and its "select at least one" validation accounts
  for it.
- **AC-4** stale 30394s retracted by the same mechanism.
- **AC-5** the 30394's status + member count shown beside the existing lines.
- **AC-6** no empty 30394 published.
- **AC-7** the 30392/30393 runners, their tests, and every existing published list are unaffected.

**The wire format is already settled and is not reopened here.** ADR `dlist-item-tagging/0002`
(Accepted, amended twice) binds every 3039x Trusted List to **two `z` tags** — the concept `z`
`39998:<TA>:trusted-list` and the per-tag `z` `39999:<TA>:tl:<slug>-tls` — family-wide, with the
per-tag TL header TA-authored and lazily created, 30393 dual-emitting its legacy `a`/`p` through a
transition window, and **two new firmware concepts** (`trusted-list`, `trusted-list-for-tag`).
This ADR decides only **how that lands in this codebase**, because the story's Design note was
written on 2026-09-10 — before the `feat-tags-modernization` merge — and several of its cited
functions and line numbers no longer describe the tree.

### What changed under the story's Design note (verified at HEAD `c3b40b01`)

| The Design note says | At HEAD |
|---|---|
| `runOneNotePin` composes its `d`-tag inline | Both runners delegate to **shared composers** `tlDTag` / `noteTlDTag` in `src/lib/event-tagging/pins.js:59,65` (ADR `feat-tags-modernization/0001` §5) |
| runners take `(pinEvent)` and go straight to POV | Both recover **context first**: `contextSlugOfPin(pinEvent, TA_PUBKEY)` at `refreshPinnedTags.js:178` and `:392`, feeding `pinVariantKey` into the `d`-tag and `['z', contextHandle(TA_PUBKEY, contextSlug)]` into `extraTags` (`:264`, `:439`) |
| `runOnePin`/`runOneNotePin` emit no `z` | A **contextual** list already carries one `z` (the context concept); a neutral list carries none. The ADR-0002 pair is **not** implemented — `grep "'z'"` on the runner finds only `:264` and `:439` |
| `ui/src/utils/publishTagPin.js` `pinTag({ tag, curationMethod })` | `pinTag({ tag, curationMethod, localTaPubkey, context, taPubkey })` — `publishTagPin.js:135` |
| `ui/src/pages/Pins.jsx` has `renderStatusLine` (:48) to sibling | **It does not.** Story 20 / ADR 0018 reduced `PinRow` (`Pins.jsx:52–83`) to a plain link plus context badges; the file's only `tlStatus` use is the `refreshableCount` filter at `:119`. There is no status line on the index to sit beside |
| `enrichRowsWithTLStatus` at `:1626` | At **`src/api/profile-tags/index.js:1646`**; it hand-formats the 30392 `d`-tag inline at `:1668` (with `pinVariantKey`) rather than calling `tlDTag` |
| `PinnedListPanel` naddr rows at `:205–212, :409–414` | `naddr30392` at `:223–230`; the `NaddrRow` block is `:442–475`; `taPubkey` from `useConfig()` at `:120`; `computeTLDTag` memo at `:132–143` |

### Cross-story dependency — **satisfied, not a blocker**

Story 4 shipped what this story consumes. `src/api/event-tags/index.js` `aggregateNotesTagged`
(`:247`) returns **`fullItemMembers`, `itemMembers`, `itemTotal`, `itemTruncated`** (`:402–405`,
returned at `:411`). `fullItemMembers` is the uncapped ranked set; `itemMembers` is the
`NOTES_CAP`(50)-sliced UI track. No second aggregation and no re-slicing of a capped set is needed.

**One refinement the Design note did not anticipate.** `fullItemMembers` mixes **two key spaces**:
address-keyed members `{ address, applications, disputes, createdAt, mine }` and **id-keyed** members
`{ id, … }` for tagged targets that resolve locally as non-addressable kind-9999 DList items
(`event-tags/index.js:386–404`). The source comment at `:383` names the discriminator explicitly:
*"An address-keyed member carries no `id` and an id-keyed member no `address` — that presence of
`address` is also story 5's kind-30394 eligibility discriminator."* An id-keyed member has **no
coordinate** and therefore cannot be an `a` member. The item runner must filter on `m.address`
before curating.

### Concepts (Concept Graph, `http://localhost:8778/api/concept-graph/summaries`, 58 concepts)

- `39998:<TA>:tag-pinning`, `39998:<TA>:nostr-event-tag`, `39998:<TA>:tagging-with-specific-tag`,
  `39998:<TA>:tag` — **present** (each under both the legacy and the runtime namespace, per ADR
  `event-tagging/0015`).
- `39998:<TA>:lfo`, `39998:<TA>:tapestry-web-of-trust` — **present** (the two contexts).
- **`trusted-list` and `trusted-list-for-tag` — absent.** Confirmed live; they do not exist in the
  graph or in `firmware/versions/v1.0.0/concepts/`.

### Constraints carried in

- **POV-first**: the observer POV cascade (`resolvePov({ wotPov:'user', userPubkey: observer })`)
  is per-pin and unchanged; nothing global is precomputed.
- **No write-time gating**: taggings from anyone are aggregated; the POV filter is a read-time trust
  filter, and the item TL is a snapshot *of that read*.
- **Never a TA literal**: `TA_PUBKEY = getOwnerAssistantPubkey()` (`profile-tags/index.js:56`) on the
  server, `useConfig().taPubkey` on the client. The ADR-0015 legacy-literal carve-out covers the
  `tag-pinning` / `tag` / `nostr-user-tag` handles only — **the new TL handles are greenfield and MUST
  use the runtime TA**, exactly as the context concepts do.
- **Local-only publishing** for the whole build (project constraint on this epic).

## Options considered

### Option A — A third sibling runner `runOneItemPin`, a shared `z` helper, and a lazily-minted TL header *(chosen)*

`runOneItemPin(pinEvent, options)` is a structural twin of `runOneNotePin`: same injectable-deps
shape, same context-first ordering, same POV cascade, same `curateNotes`, its own kind / `d`-prefix /
member letter / cap / gate. The ADR-0002 `z` pair is composed by **one** helper in
`src/lib/event-tagging/pins.js` that all three runners call. The per-tag TL header is ensured by one
memoized helper before any TL publishes.

- **Pros:** the 30392/30393 publish paths gain exactly two lines each (the `z` pair) and are otherwise
  untouched, so AC-7 is structural rather than test-enforced; each list's rules live in one function;
  the `z` pair cannot drift across three call sites; matches the shape ADR 0002 sketched.
- **Cons:** one extra `aggregateNotesTagged` call per pin per refresh (identical arguments, cron path,
  memoizable later if measured); three near-parallel functions that a future family-wide change must
  edit three times.

### Option B — Fold items into `runOneNotePin` (one runner emitting 30393 + 30394)

Both lists read one `aggregateNotesTagged` call, so one runner means one scan.

- **Rejected** for the reason the story already gives, and it has since gotten worse: the two lists now
  differ in **seven** dimensions — kind, `d`-prefix, member letter, member cap, back-ref shape, gate
  value, and member key space (`address` vs `id`). A merged function would branch at seven points
  *inside the code path that publishes every existing kind-30393*, so every future item-side edit
  re-risks AC-7, and `test/note-trusted-list.test.js` would have to be rewritten around a second
  publish call. The saving is one cron-path scan.

### Option C — A table-driven TL runner factory (`runTLPin(spec)` over a kind/letter/cap/gate table)

Collapse all three runners into one parameterized function plus a three-row spec table.

- **Pros:** genuinely removes the triplication; family-wide changes (the `z` pair, a new cap policy)
  become one edit.
- **Rejected for this story:** it rewrites the two runners that publish every currently-live list, which
  is precisely what AC-7 forbids, and it would have to absorb three real asymmetries (30392's
  `membershipFolds` ladder and `rigor` tag; 30393's legacy `a`/`p` dual-emit; 30394's address
  filtering) as spec fields — a worse abstraction than three explicit functions. It is the right
  follow-up **after** the 30393 legacy pair is dropped, when the three shapes have actually converged.

### Header-creation failure policy — three sub-options

- **F1 — publish the TL anyway, omitting only the per-tag `z`** *(chosen; ADR 0002 Decision 3 already
  ruled this way)*. The concept `z` and the context `z` do not depend on the header, so the list stays
  discoverable deployment-wide; the omission is transient because the next refresh retries the header
  and TLs are replaceable.
- **F2 — abort the TL publish when the header fails.** **Rejected, and it is actively destructive:**
  an aborted publish returns `status:'error'`, its `d`-tag therefore never enters `currentItemDTags`
  (E11), and `retractStaleTLs` then publishes an empty-membership **retraction** over the live,
  healthy list. A header hiccup would wipe real lists.
- **F3 — emit the per-tag `z` regardless** (the coordinate is deterministic; a later header publish
  validates it retroactively). Attractive and self-healing, but it contradicts an Accepted ADR's
  explicit ruling and publishes a membership claim on an event that does not exist. Named here as the
  cheap revisit if operators find lists stranded off-axis.

## Decision

**Option A**, with **F1** for header failures. Eight bindings.

### 1. `runOneItemPin` — the third runner

New exported function in `src/api/trustedList/refreshPinnedTags.js`, placed after `runOneNotePin`.
Deps `{ lookupTag, aggregateNotesTagged, publishTL }` with the same `options.deps || options` shape.
Ordered exactly as `runOneNotePin`:

1. `parseCurationMethod` → `method !== 'nip85:rank'` ⇒ `{status:'unsupported'}`; malformed observer ⇒
   `{status:'error'}`.
2. **Gate (AC-2):** `const targetTypes = Array.isArray(curation.targetTypes) ? curation.targetTypes : ['profile','note'];`
   — the literal is byte-identical to the note gate at `:376`. `!targetTypes.includes('item')` ⇒
   `{status:'skipped', errorReason:'pin does not target items'}`. A pin authored before this story
   therefore publishes **no** item list.
3. `parsePinTagEventId` → `lookupTag`.
4. **Context first, then scoring** (ADR `feat-tags-modernization/0001` §1):
   `const contextSlug = contextSlugOfPin(pinEvent, TA_PUBKEY);` on the line after the `lookupTag`
   guard. It reaches only the `d`-tag composer and the context `z` — never `resolvePov`,
   `aggregateNotesTagged`, or `curateNotes`.
5. `resolvePov({ wotPov:'user', userPubkey: observer })`; `noteMethod = curation.noteMethod || 'notes:net-endorsed'`;
   `sort = noteMethod === 'notes:most-applied' ? 'applied' : 'recent'`.
6. `const { fullItemMembers, itemTotal, scanTruncated } = await aggregateNotesTagged({ tagAuthor, slug, authorities:[TA_PUBKEY], povSuffix, minRank, viewerPubkey: undefined, sort });`
7. **Address filter (new, load-bearing):**
   `const addressable = (fullItemMembers || []).filter((m) => typeof m.address === 'string' && m.address);`
   Id-keyed members carry no coordinate and cannot be `a` members. This is the only place this story
   filters; it adds no type filter of its own (story E5 — whatever coordinate kinds story 4 admits are
   what get signed).
8. `const curated = curateNotes(addressable, noteMethod, noteCutoff)` with
   `noteCutoff = Number.isFinite(curation.cutoff) ? curation.cutoff : 1`. `curateNotes`
   (`src/lib/event-tagging/taggings.js:125`) is reused **verbatim**: it is pure over
   `{applications, disputes, createdAt}` and never reads `id`, so address rows curate identically. No
   `itemMethod` enum.
9. `const published = curated.slice(0, ITEM_TL_MEMBER_CAP)`;
   `const partial = !!scanTruncated || curated.length > ITEM_TL_MEMBER_CAP`;
   `const totalTrusted = Number.isFinite(itemTotal) ? itemTotal : curated.length`.
   **`ITEM_TL_MEMBER_CAP = 500`**, a new exported constant — half `NOTE_TL_MEMBER_CAP` because an `a`
   coordinate (~80–120 bytes) is roughly double a 64-hex `e` id, keeping one event inside the same
   ~75KB budget (ADR `event-tagging/0017`). Overflow is **signaled**, never silent.
10. **AC-6:** `if (published.length === 0) return { status:'skipped', errorReason:'no trusted item taggings' };`
    — before any publish, matching the note runner's empty behavior.
11. `const dTag = itemTlDTag({ observer, tagAuthorPubkey: tag.authorPubkey, tagSlug: tag.slug, contextSlug });`
12. Publish through the existing `buildAndPublishTL` `a` branch (`src/api/trustedList/index.js:151–155`;
    30394 already validated at `:119`, `extraTags` passed through verbatim at `:143–145` — **no edit to
    that file**):

```js
kind: 30394,
dTag,
title: tag.name,
metric: 'pinned-tag-items',
items: published.map((m) => ({ tag: 'a', value: m.address })),
extraTags: [
  ['observer', observer],
  ['source-tag', tag.eventId, tag.authorPubkey, tag.slug],
  ['curation-method', noteMethod],
  ['p', observer],                                   // non-member on a 30394 (see §2)
  ...trustedListZTags({ taPubkey: TA_PUBKEY, tagSlug: tag.slug }),
  ...(contextSlug ? [['z', contextHandle(TA_PUBKEY, contextSlug)]] : []),
  ...(partial ? [['truncated', String(totalTrusted)]] : []),
],
content: JSON.stringify({
  items: published.map((m) => ({ address: m.address, applications: m.applications, disputes: m.disputes })),
  ...(partial ? { partial: true, total: totalTrusted } : {}),
}),
```

Returns `{ status:'ok', dTag, memberCount: published.length, partial, uuid }`; on a publish throw,
`{ status:'error', dTag, errorReason }`.

**No metadata `a` tag** (story E1): on a 30394, `a` *is* the member letter, so a tag back-ref there
would inject the tag's own coordinate into the signed member set. The withdrawn `['e', tag.eventId]`
substitute is **not** emitted either (ADR 0002 Option D — a tag element is addressable/replaceable and
its id churns). Discovery is the `z` pair; `source-tag` remains the stable multi-letter back-ref.

**`['p', observer]` is kept** — `p` is a *non-member* letter on a 30394, so `{kinds:[30394], "#p":[obs]}`
is unambiguous, and it mirrors the 30393 convention. This does not contradict ADR 0002: that ADR's
"observers stay on the multi-letter `observer` tag" line is about **30392**, where `p` is the member
letter and therefore unavailable.

**Wiring:**
- `refreshAllPinnedTags` (`:456`): `const itemResult = await runOneItemPin(pin);`, row gains
  `itemTL: { status, dTag, memberCount }`; `if (itemResult.dTag) currentItemDTags.push(itemResult.dTag);` — a failed publish keeps its d-tag on the roster (story Ruling 1, unified failure policy; the same guard change is applied to `currentNoteDTags` at :467).`
  (E11, and it mirrors the note line at `:467` exactly); then a third sweep
  `await retractStaleTLs(currentItemDTags, { kind: 30394, dPrefix: 'tl-pin-items-' })`.
- `refreshPinnedTagsForViewer` (`:478`): same call and row field, **no** retraction (E10).
- `refreshOnePinnedTagById` (`:294`): `const itemResult = await runOneItemPin(pin);`, returned as
  `itemStatus: itemResult && itemResult.status` beside the existing `noteStatus`.
- `retractStaleTLs` (`:322`) is **not edited for kind-parameterization** — it already takes
  `{ kind, dPrefix }`. The `dTag.startsWith(dPrefix)` guard at `:327` is the only thing keeping the
  30394 sweep off the applicability lists (`refreshApplicabilityLists.js` `D_PUBKEY` /
  `D_EVENT` = `tag-applicability-nostr-pubkey` / `tag-applicability-nostr-event`, a disjoint namespace)
  — story E2. **Grep-verified:** no `tl-pin-items-` string exists anywhere in `src/`, `ui/src/`,
  `test/`, `protocols/` today.
- **One edit to `retractStaleTLs`:** the `carryOver` filter at `:335–337` gains `t[0] === 'z'`, so a
  retraction replacement keeps the discovery axes of the list it retracts. Without it a `#z` consumer
  sees a list vanish rather than see it marked `retracted`. Applies family-wide (30392/30393/30394);
  it changes only newly-published retraction events, never an existing list.

### 2. The dual-`z` tags, family-wide — one helper, three runners

Handle composers go in `src/lib/event-tagging/handles.js` beside `taggingHeaderAddr` (ADR 0002
Implementation notes), the **tag-array** helper in `pins.js` beside the other TL composers; both spread
into `src/lib/event-tagging/index.js` already:

```js
// handles.js
conceptTrustedList(taPubkey)        // 39998:<TA>:trusted-list
conceptTrustedListForTag(taPubkey)  // 39998:<TA>:trusted-list-for-tag
tlHeaderDTag(slug)                  // tl:<slug>-tls
tlHeaderAddr(taPubkey, slug)        // 39999:<TA>:tl:<slug>-tls   (= `39999:${taPubkey}:${tlHeaderDTag(slug)}`)

// pins.js — the single composer all three runners call
trustedListZTags({ taPubkey, tagSlug })
//   → [['z', conceptTrustedList(taPubkey)], ['z', tlHeaderAddr(taPubkey, tagSlug)]]
itemTlDTag({ observer, tagAuthorPubkey, tagSlug, contextSlug })
//   → `tl-pin-items-${observer.slice(0,8)}-${tagAuthorPubkey.slice(0,8)}-${tagSlug}${pinVariantKey({ contextSlug })}`
```

`tlHeaderDTag` exists so the `d` string and the coordinate are composed in one place — the header
publisher needs the bare `d`, the TL publisher needs the coordinate, and they must never be
hand-formatted separately.

Emission:
- **30392** (`runOnePin`, `:251–265`): insert `...trustedListZTags(...)` into `extraTags`. It gains its
  **first** relay-filterable discovery axis. Nothing else changes.
- **30393** (`runOneNotePin`, `:427–440`): insert the same; **keep** the legacy `['a', '39999:<author>:<slug>']`
  and `['p', observer]` for the dual-emit window (ADR 0002 Decision 4). Dropping them is a separate story.
- **30394**: as in §1.

**Tag order on a contextual TL** is: concept `z`, per-tag `z`, context `z` (append order, which falls
out of putting `trustedListZTags` immediately before the existing context line). **Order is not
semantic** — `protocols/drafts/stamping.md` states `z` order is not load-bearing and plain `#z`
filtering is the interop floor. A test asserting positional order would be asserting an accident; the
correct assertion is set membership. A contextual TL carries **three** `z`, a neutral one **two**.

**Not touched:** `refreshApplicabilityLists.js` also publishes kind-30394, but those lists are about a
*target type*, not a pinned tag, and have no per-tag TL header. They gain no `z` in this story. A diff
adding `trustedListZTags` there is out of radius.

### 3. `ensureTagTLHeader({ tag })` — lazy, idempotent, TA-signed

New helper in `src/api/trustedList/refreshPinnedTags.js`, called by **all three** runners immediately
before their `publishTL` call. (This supersedes the name and signature ADR 0002 sketched —
`ensureTLHeader({ slug, tagAuthorPubkey, taPubkey })` — as a refinement only: the runners already hold
the full `tag` object from `lookupTag`, and the TA pubkey is the module's `TA_PUBKEY`. No decision of
0002 changes.)

```js
async function ensureTagTLHeader({ tag }, deps = {})   // → { status: 'exists'|'created'|'error', addr, errorReason? }
```

- **`d` tag: `tl:<slug>-tls`** — ADR 0002 Decision 1 and its worked example, composed by `tlHeaderDTag`.
- **Idempotence:** scan `{ kinds:[39999], authors:[TA_PUBKEY], '#d':[tlHeaderDTag(tag.slug)] }` first
  (the module's existing `strfryScan`); a hit ⇒ `{status:'exists'}` with no publish.
- **Memoization:** a module-level `Set` of confirmed `d`-tags, **positive-only** — populated on a
  confirmed scan hit or a successful publish, never on absence or failure. A header is never deleted,
  so a positive cache is sound across cycles; a negative cache would wedge a failed mint until process
  restart. (ADR 0002 said "memoize per refresh cycle"; a positive-only module cache is that, strictly
  stronger, and needs no cycle object threaded through three runner signatures.)
- **Event shape** — built by a new pure builder `buildTLHeader({ tagAuthorPubkey, slug, names, description, taPubkeys })`
  in `src/lib/event-tagging/builders.js`, a direct structural mirror of `buildTaggingHeader` (`:102–118`),
  reusing `conceptZTags(taPubkeys, conceptTrustedListForTag, 'taPubkeys')` so the multi-namespace
  federation seam is available without being used:

```json
{ "kind": 39999, "tags": [
  ["d", "tl:<slug>-tls"],
  ["names", "Trusted List for <Name>", "Trusted Lists for <Name>"],
  ["description", "Trusted Lists derived from the <Name> tag."],
  ["z", "39998:<TA>:trusted-list-for-tag"],
  ["a", "39999:<tagAuthorPubkey>:<slug>"]
], "content": "" }
```

  The `a` points at the **tag element**, per the type header's `recommended a` / `allowed e` rule, and
  is a header→tag pointer (not a membership claim) — `protocols/drafts/event-taggings.md:173`.
- **Signer — reuse, never a new identity, never a literal.** `src/api/normalize/helpers.js` already
  exports the TA sign/publish/import triple used by `concept/bDisposition.js` and `concept/selfDeclare.js`
  for exactly this class of event: `await loadTAKey()` → `signAndFinalize({ kind, tags, content })` →
  `publishToStrfry(event)` → best-effort `importEventDirect(event, `39999:${event.pubkey}:${dTag}`)`
  wrapped in try/catch (the relay copy is what discovery reads; the Neo4j row is a convenience). Both
  key paths resolve through `getOwnerAssistantKeys()` / `getOwnerAssistantPubkey()`
  (`src/utils/assistantKeys.js`) — the same runtime key `buildAndPublishTL` signs every TL with
  (`trustedList/index.js:44–57`). **`buildAndPublishTL` cannot be used** — it hard-validates
  `kind ∈ [30392..30395]` at `:119`.
  *Rejected alternative:* export `signAndFinalize`/`loadTAKey` from `src/api/trustedList/index.js` and
  compose there — it would add a second key cache in a second module for one call site.
- **`pickHeader` must NOT be imported here.** ADR 0002's first amendment withdrew the header-author
  pick rule: a TA-authored header has no plurality. A diff importing `pickHeader` into this path is a
  regression.
- **Failure (F1):** `{status:'error'}` ⇒ the runner logs, publishes the TL with the concept `z` (and
  context `z`) but **without** the per-tag `z`, and does not populate the memo. The list is valid and
  deployment-wide discoverable; the next refresh retries the header and republishes the TL with the
  full pair. Never abort the TL publish (see F2 above — it would trigger a retraction of a live list).

### 4. Firmware — two concept directories, one reinstall

Two new dirs under `firmware/versions/v1.0.0/concepts/` (`firmware/active` symlinks `v1.0.0` — verified),
each with **`concept-header.json` + `json-schema.json`**. A per-concept `manifest.json` is **optional**
(`tagging-with-specific-tag/` ships an empty `{"HAS_ELEMENT":[],"IS_A_SUPERSET_OF":[]}`; `lfo/` ships
none) — omit it; `install.js:507–513` skips a concept with no manifest.

**Discovery is manifest-driven, not directory-scanned.** `src/firmware/install.js:149` iterates
`manifest.concepts`, so **both concepts MUST be appended to `firmware/versions/v1.0.0/manifest.json`
`concepts[]`**, in the sibling form:

```json
{ "slug": "trusted-list", "dir": "./concepts/trusted-list/",
  "conceptHeader": "concept-header.json", "jsonSchema": "json-schema.json",
  "categories": ["tag", "nostr"] }
```

No `communityReference` block — that field carries a literal canonical pubkey, and choosing a canonical
cross-deployment namespace is explicitly out of scope in ADR 0002.

Field-level content (modeled on `nostr-event-tag/` and `tagging-with-specific-tag/` respectively):

- **`trusted-list/concept-header.json`** — `word` block (`slug: "concept-header-for-the-concept-of-trusted-lists"`,
  `name`, `title`, `wordTypes: ["word","conceptHeader"]`); `conceptHeader` with the ADR-0002
  `description` ("A replaceable DList (kind 30392/30393/30394/30395) whose members were derived from a
  Web-of-Trust computation performed from a specific observer's point of view."), `oNames`/`oSlugs`/
  `oKeys`/`oTitles`/`oLabels` singular+plural (`trusted list` / `trusted lists`, `trustedList` /
  `trustedLists`, `TrustedList` / `TrustedLists`), and `x-tapestry.neo4j.nodeLabelRequired: true`.
  **No `headerTags`** — its members are 3039x events, not kind-39999 items with a reference rule.
- **`trusted-list-for-tag/concept-header.json`** — the same skeleton with the ADR-0002 description
  ("A DList header for Trusted Lists derived from a specific Tag. Each item points to the Tag it is
  derived from via an a-tag (preferred) or e-tag."), plus
  **`headerTags: [["recommended","a"],["allowed","e"]]`** — the same pair
  `tagging-with-specific-tag` carries, governing the per-tag TL header's pointer to its tag element.
- **Both `json-schema.json`** — the permissive shape `tagging-with-specific-tag/json-schema.json` uses:
  a `word` block with `wordTypes:["word","jsonSchema"]` and a `coreMemberOf` back-pointer to the
  concept header slug, then a `jsonSchema` with `required: []`, `definitions: {}`, `properties: {}`
  (the rule and the references live in tags, not in a content payload).

**Graph treatment.** `POST /api/firmware/install` publishes each concept as a kind-39998 with
`dTag: slug` (`install.js:175`), so the handles resolve at runtime as `39998:<runtimeTA>:trusted-list`
and `…:trusted-list-for-tag` — derivable from the slug, no event ids in code.
`kindToLabel` (`src/api/neo4j/eventSync.js:154–158`) labels 39998 `ListHeader` and 39999 `ListItem`, so:
- the **per-tag TL header** (kind 39999, `z` → the type header) imports as an element of
  `trusted-list-for-tag` — that concept will show a growing `elementCount`;
- the **Trusted Lists themselves** (kind 3039x) are **graph-inert** — `kindToLabel` returns null for
  them, and `tapestryBrainWrite.js:37` requires `kind === 39999` plus the `tapestry` `z`. So no TL is
  ever imported as a DList item, whatever it `z`-tags.
- Consequently **`trusted-list` will show `elementCount: 0` in the Concept Graph forever.** That is
  correct and intended: it is a *relay-level* discovery axis and the federation seam, not a graph
  population. A reviewer seeing zero elements has not found a bug.

**Reinstall:** `curl -X POST http://localhost:$TAPESTRY_PORT/api/firmware/install` (AGENTS.md §6;
`$TAPESTRY_PORT` is 8778 on this machine). Local dev only during this build, per the epic's
local-relay-only constraint. A deployment that installs the code without reinstalling firmware
publishes valid-but-unanchored headers — relay discovery still works; only the graph edge is missing.

**Tester note (binding):** the firmware suite MUST NOT require a live reinstall. Follow
`test/event-tagging-firmware-seed.test.js:9–17`: an **FS** layer (both dirs exist with the two files;
both are registered in `manifest.json` `concepts[]`; the `description`/`headerTags`/`oSlugs` fields are
present), an **SC** layer (source contract over the composers and the runner), and a **LIVE** layer that
**skips** when the control panel is unreachable or the concepts are not yet seeded.

### 5. Client + status surfaces — corrected

- **`ui/src/utils/publishTagPin.js:98–109`** — `defaultCurationMethod(viewerPubkey)` returns
  `targetTypes: ['profile','note','item']`. New pins opt in by default; the **runner's** legacy default
  stays `['profile','note']`, so nothing already published changes meaning. `pinTag`'s signature
  (`:135`, `{ tag, curationMethod, localTaPubkey, context, taPubkey }`) is **unchanged** — this story
  adds no parameter to it, and the ADR-0015 guard in
  `test/restore-historical-data-and-fix-tl-author-filter.test.js` is untouched.
- **`ui/src/components/CurationMethodDialog.jsx`** — `initTypes` fallback at `:75` stays
  `['profile','note']` (editing a pre-existing pin must not silently add items); add `includeItems`
  state beside `:76–77`; push `'item'` in the build at `:114–116`; the validation message at `:117`
  becomes *"Select at least one: profiles, notes, or items."*; add the checkbox beside `:285` (AC-3).
- **`src/api/profile-tags/index.js` `enrichRowsWithTLStatus` (`:1646`)** — after the existing 30392
  block, a **second, independently `try`-wrapped** batched scan
  `{ kinds:[30394], authors:[TA_PUBKEY], '#d': itemDTags }` setting
  `row.itemTlStatus = { status:'never'|'ok'|'retracted'|'unsupported', lastRefreshAt, tlEventId, memberCount }`
  with `memberCount` = count of `a` tags. `row.tlStatus` and `row.nip51ExportStatus` stay
  byte-identical, and a failed item scan leaves every row at the default `'never'` and still returns
  200 (E12). Rows whose `curationMethod.targetTypes` omits `'item'` (or is absent) get
  `status:'unsupported'` and contribute no `d`-tag. **The item `d`-tag MUST be composed with
  `itemTlDTag`, not hand-formatted** — the 30392 branch at `:1668` hand-formats its string today, and
  that is exactly the drift ADR `feat-tags-modernization/0001` §5 exists to prevent. (Re-aiming the
  existing 30392 line onto `tlDTag` is desirable but out of this story's radius.)
- **`ui/src/pages/Pins.jsx` — the Design note's premise no longer holds.** `renderStatusLine` does not
  exist; Story 20 / ADR 0018 deliberately reduced `PinRow` (`:52–83`) to a link plus context badges and
  moved per-pin management to the Pinned tab. There is no 30392 status line for an item line to sit
  beside. **Decision: no change to `Pins.jsx`**, and AC-5 is satisfied entirely in the Pinned tab.
  *Rejected alternative:* reintroduce a per-row status block on the index — it contradicts a shipped
  decision no story has asked to reverse. This is flagged to the PO as an open question, not resolved
  unilaterally.
- **`ui/src/components/PinnedListPanel.jsx`** (AC-5) — add `itemDTag` as a `useMemo` mirroring the
  `computeTLDTag` memo at `:132–143` (same `observer` / `tag` / `contextSlug` inputs) via `itemTlDTag`;
  add `naddr30394` mirroring `naddr30392` (`:223–230`) with
  `nip19.naddrEncode({ kind: 30394, pubkey: taPubkey, identifier: itemDTag, relays: [] })`, `taPubkey`
  from `useConfig()` at `:120` — **never a literal**; render a `NaddrRow label="Item Trusted List (naddr)"`
  inside the `<dl className="bs-pindetail-meta">` block (`:442–475`), conditional on
  `pinRow?.itemTlStatus?.status === 'ok'`, exactly as the Follow Set / Bookmark Set rows are
  conditional on their own status; and render the item status + `memberCount` as a `<dt>/<dd>` pair in
  the same `dl`. **No new CSS** — the existing `bs-pindetail-*` classes cover both.

### 6. Discovery filters and invariants

Consumer-facing filters this story makes true:

```json
{"kinds": [30394], "#z": ["39999:<TA>:tl:<slug>-tls"]}          // item TLs about one tag, all observers
{"kinds": [30392,30393,30394], "#z": ["39998:<TA>:trusted-list"]} // every Trusted List, deployment-wide
{"kinds": [30394], "#p": ["<observer>"]}                          // item TLs for one observer
{"kinds": [30394], "#z": ["39998:<TA>:lfo"]}                      // item TLs in a context
```

`#z` ORs within the key (NIP-01), so a two-element `#z` array is a **union, not a conjunction** — the
"about X *and* in context C" query is one round trip plus a local predicate
(ADR `feat-tags-modernization/0001` §3). Don't paper over it.

Invariants for the Tester (each maps to a story edge case):

- **E1** — every `a` tag on a published 30394 is a member address, and **no** `a` equals
  `39999:<tagAuthor>:<slug>`. No `['e', tag.eventId]` either.
- **E2** — a sweep over a fixture relay holding both applicability lists plus one stale item TL
  publishes exactly **one** retraction; both applicability lists keep their event ids.
- **E6** — `truncated` present ⇔ `partial` ⇔ (`scanTruncated` or `curated.length > 500`); **absence
  means complete**, and a wrongly-present tag is as harmful as a wrongly-absent one.
- **E11 (as ruled 2026-09-17)** — a `d`-tag from a failed item publish DOES enter `currentItemDTags` (`{status:'error', dTag}`), so a transient failure never retracts the live list; identical for notes and profiles. An item-publish
  failure leaves `runOnePin`/`runOneNotePin` results and their `currentDTags` untouched.
- **New (address filter)** — an id-keyed `fullItemMembers` entry (no `address`) never becomes a member.
- **New (`z` set)** — a neutral TL carries exactly the two ADR-0002 `z`; a contextual TL carries those
  plus the context handle. Assert **set membership, not order**.
- **New (no literals)** — every one of the three handles is composed from `TA_PUBKEY` /
  `useConfig().taPubkey`; a 64-hex literal in any new line is a reject.

### 7. POV and permissionless-publishing check

The item TL is a per-observer snapshot: one `d`-tag per `(observer, tagAuthor, slug, context)`, so two
observers' views coexist and neither retracts the other (E8). Nothing is precomputed globally; the trust
filter is applied at aggregation time from the pin's observer POV. No write-time gating is introduced —
any pubkey may publish an `a`-target tagging; whether it counts is the POV's read-time question.

### 8. Not re-litigated

The `'item'` `targetTypes` value, the `tl-pin-items-` `d`-prefix, the `d` form `tl:<slug>-tls`, TA
authorship of the header, lazy creation, the 30393 dual-emit posture, and the two firmware concepts are
all already ratified (story Gate A + ADR 0002). This ADR implements them.

## Consequences

**Enables:** a signed, addressable, per-POV list of the DList items a tag covers — the artifact a
downstream indexer subscribes to; the **first** relay-filterable discovery axis for kind-30392; a
deployment-wide "every Trusted List" axis that exists nowhere today; and the concept-level federation
seam ADR 0002 established.

**Constrains / makes harder:**
- Three near-parallel runners. A family-wide change is now a three-place edit until the 30393 legacy
  pair is dropped and Option C becomes viable.
- One extra `aggregateNotesTagged` call per pin per refresh (identical arguments, cron path). Accepted
  unmeasured; memoizable later.
- The `tl-pin-items-` prefix and the `tl:<slug>-tls` `d` form are permanent once published.
- `ITEM_TL_MEMBER_CAP = 500` is a judgment call on coordinate size; raising it later is safe
  (replaceable lists), lowering it silently truncates — so any change must keep the `truncated` signal.

**New debt / follow-ups:**
- **The E11 ↔ B4a tension.** `runOnePin` deliberately returns its `dTag` on a publish **error**
  (`:286`) so that a transient failure cannot cause `retractStaleTLs` to wipe a healthy 30392 — ADR
  `tag-stack-merge-hardening/0001` B4a, written after oversize events made publishes fail. Story E11
  requires the **opposite** for items (a failed publish's `d`-tag must not shield a stale list). This
  ADR follows **E11 as written** — it matches the note runner already in production (`:467`) and the
  500-member cap bounds the oversize failure mode B4a was built for — and records the residual risk: a
  transient 30394 publish failure retracts that pin's item list, which re-derives on the next cycle.
  Whether B4a's protection should extend to 30394 is an operator/PO call, listed as an open question.
- The observer axis stays multi-letter on 30392; only 30393/30394 get a `#p`.
- Applicability lists (also kind-30394) remain outside the `z` convention.
- No NIP-51 export analog for items; no item status line on the Pins index.
- Re-aiming the 30392 `d`-tag in `enrichRowsWithTLStatus:1668` onto the shared `tlDTag` composer.

**Firmware reinstall required?** **YES.** Two new concept definitions — `trusted-list` and
`trusted-list-for-tag` — plus two `manifest.json` `concepts[]` entries, then **one**
`POST /api/firmware/install` per deployment (AGENTS.md §6), before the TL publisher is enabled.
Without it, published headers are valid on the relay but unanchored in the graph. This is the reinstall
ADR 0002's amendment already scheduled; this ADR adds no second one.

**What breaks:** nothing published. The `z` tags are additive; 30393 consumers keep working through the
dual-emit window. Existing 30392/30393 lists re-derive on the next refresh cycle carrying the new `z`
pair — no migration job, no backfill script.

## Implementation notes

In the order I would land them:

1. **`src/lib/event-tagging/handles.js`** — add `conceptTrustedList(taPubkey)`,
   `conceptTrustedListForTag(taPubkey)`, `tlHeaderDTag(slug)`, `tlHeaderAddr(taPubkey, slug)`; export
   all four (they spread into `index.js` automatically).
2. **`src/lib/event-tagging/pins.js`** — add `itemTlDTag({ observer, tagAuthorPubkey, tagSlug, contextSlug })`
   (delegating to `pinVariantKey`, exactly as `tlDTag:59` / `noteTlDTag:65` do) and
   `trustedListZTags({ taPubkey, tagSlug })`; add both to `module.exports`. `pins.js` must stay
   dependency-free of I/O — `trustedListZTags` requires `./handles`, which is pure.
3. **`src/lib/event-tagging/builders.js`** — add `buildTLHeader({ tagAuthorPubkey, slug, names, description, taPubkeys })`,
   a structural mirror of `buildTaggingHeader` (`:102–118`), reusing `requireHex64`, `conceptZTags`, and
   `tagElementAddr`. Pure; returns an unsigned `{ kind: 39999, tags, content }`.
4. **`src/api/trustedList/refreshPinnedTags.js`** —
   - import the three new SDK helpers alongside the existing require at `:27–29`;
   - `const ITEM_TL_MEMBER_CAP = 500;` beside `NOTE_TL_MEMBER_CAP` (`:37`), with the coordinate-size
     rationale in the comment;
   - `ensureTagTLHeader({ tag })` + the module-level positive memo `Set`;
   - `runOneItemPin(pinEvent, options)` per §1;
   - insert `...trustedListZTags({ taPubkey: TA_PUBKEY, tagSlug: tag.slug })` into `runOnePin`'s
     `extraTags` (`:251–265`) and `runOneNotePin`'s (`:427–440`), immediately **before** the context-`z`
     line so the order reads concept → per-tag → context;
   - call `ensureTagTLHeader` in all three runners right before `publishTL`;
   - add `t[0] === 'z'` to the `carryOver` filter at `:335–337`;
   - wire `refreshAllPinnedTags` (`:456`), `refreshPinnedTagsForViewer` (`:478`),
     `refreshOnePinnedTagById` (`:294`), and the third `retractStaleTLs` sweep;
   - export `runOneItemPin` and `ITEM_TL_MEMBER_CAP` from `module.exports` (`:490`).
   - `src/api/trustedList/index.js` needs **no edit**.
5. **Firmware** — `firmware/versions/v1.0.0/concepts/trusted-list/{concept-header.json,json-schema.json}`,
   `…/trusted-list-for-tag/{concept-header.json,json-schema.json}`, plus the two `manifest.json`
   `concepts[]` entries; then one `POST /api/firmware/install` against `:8778`.
6. **`src/api/profile-tags/index.js`** — the `itemTlStatus` enrichment in `enrichRowsWithTLStatus` (`:1646`).
7. **Client** — `publishTagPin.js:98–109`, `CurationMethodDialog.jsx:75–117,285`,
   `PinnedListPanel.jsx:132–143,223–230,442–475`.

Test-file changes this ADR implies belong to **Phase 3**, not to implementation. For the Tester's
planning only: the scoped gate is `test/item-trusted-list.test.js` (new) +
`test/generalized-tag-pinning.test.js` + the strfry write-assertion guard suite, and a family-wide `z`
assertion will also touch `test/note-trusted-list.test.js` and `test/pin-stack-composition.test.js`.

## Out of scope

- The downstream indexer that consumes 30394.
- Dropping 30393's legacy `a`/`p` pair (ADR 0002 schedules it as a follow-up story).
- Option C's table-driven runner factory.
- A filterable observer axis for 30392; a context `z` on the kind-30000/30003 exports.
- A per-item score or relay hint in the `a` member tags (bare coordinates only in v1).
- An `itemMethod` curation enum; a NIP-51 item export; back-filling a 30393 status line.
- Choosing a canonical cross-deployment namespace for `trusted-list` / `trusted-list-for-tag`
  (worksheet W1) — the seam is established, using it is opt-in and later.
- Updating `protocols/drafts/trusted-lists.md` for the family-wide `z` convention (named by ADR 0002 as
  a separate task).
