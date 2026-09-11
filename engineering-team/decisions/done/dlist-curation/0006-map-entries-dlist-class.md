# ADR 0006: Map Entries — two new classes in the one classifier, a batched two-step header lookup, and a two-prefix extension of the DList detail route

**Status:** Accepted
**Date:** 2026-09-10
**Story:** `engineering-team/stories/dlist-curation/6-map-entries-dlist-class.md`

## Context

The story's acceptance criteria, in short: **AC-1** `<kind>:<d-tag>` (39998/39999, non-empty d,
valid delegate) → class `dlist` "Curated DList"; `39998:dlist-header` → class `designation`
"TA designation"; bare kinds, delegate-less rows, and every other kind unchanged (story-2 pins
hold). **AC-2** the row: raw element, label, d-tag, avatar + profile link, "Your assistant" or
"external" *with the short pubkey inline*, relay hint. **AC-3** the header verified — local first,
the row's relay hint only when missing locally; found → name (`names[1]` else d), a link that
resolves for both kinds, the community header from its `b` (short coordinate, link, type); not
found → a warning naming where it looked. **AC-4** duplicates: first occurrence effective, later
ones "duplicate — ignored", one lookup per effective entry. **AC-5** the per-user baseline, no
badge until resolved. **AC-6** nothing else moves; the detail route's existing behavior unchanged.

**The pieces, as they stand** (read this session):

- `ui/src/utils/treasureMap.js` `classifyEntry` (`:24-37`): `ENTRY = /^(\d{5})(?::(.+))?$/` → kind,
  name (everything after the first colon), lowercased 64-hex pubkey or null, and `cls` — `other`
  when pubkey is null, else by kind range (3038x `ta`, 3039x `tl`), else `other`. Consumers:
  `TreasureMapTagsPanel.jsx` (rows) and story 3's `findGenericTlDelegation`. Story 5's
  `findDListEntries` is a separate finder over the same grammar (kinds 39998/39999, reserved word,
  valid delegate).
- `ui/src/pages/grapevine/TreasureMapTagsPanel.jsx`: `CLS_LABEL`/`CLS_COLOR` maps (`:7-8`); one
  deduped `/api/profiles?pubkeys=` fetch for the delegates (`:24-32`); `EntryRow` renders the raw
  element, the class pill (plus `· name` for named TL rows), the avatar link, the
  locality badge judged against `useAuth().user.assistantPubkey` with no judgment before it
  resolves (`:53`, story treasure-map-user-assistant #1), and the relay hint.
- Story-2 pins (`test/tl-treasure-map-panel.test.js` U1–U8): bare `39999` → `other` (U3); a
  non-delegation tag has `pubkey: null` and classifies `other` (U6); malformed input never throws
  (U7); uppercase hex normalizes (U8). None pins a *named* 39998/39999 entry, so two new classes
  gated on a non-empty name and a valid delegate leave every pin true.
- `ui/src/pages/lists/DListDetail.jsx:33-40`: the `:id` is treated as an a-tag only when it starts
  with `39998:` or `9998:`; anything else is queried as an event id. A kind-39999 coordinate
  therefore falls through and reads "not found". The a-tag branch already rejoins colons in the
  d-tag and queries `{kinds:[kind], authors, '#d'}` generically — adding the two remaining prefixes
  is a two-token change with no effect on the existing branches.
- Lookups available client-side: `queryRelay(filter)` (local strfry scan) and
  `GET /api/relay/external?filter=<json>&relays=<csv>` (server-side pool fetch; used by the page's
  own Map search and by the relay-presence panel).
- The `b` value forms: an a-tag, an event id, or the reserved sentinel `b-tag-deferred`
  (Inherit-From § reserved value) — the community pointer is the first `b` whose value is an
  a-tag; the sentinel and malformed values derive nothing.

**Concept orientation.** `39998:<TA>:shared-concept`, `39998:<TA>:tapestry-assistant`; no definition
changes.

## Options considered

### Option A — Extend `classifyEntry` with the two classes; batch the lookup in the panel; extend the detail route by two prefixes (chosen)

`classifyEntry` gains, after the delegate check and before the range checks: kind 39998/39999 with a
non-empty name → `dlist`, except name `dlist-header` with kind 39998 → `designation`. The panel gains
label/colour entries, a first-occurrence pass over the rows (`markDuplicateEntries`, pure, exported
from the util), one effect that runs the two-step lookup for the effective `dlist` rows, and a
`DListRowDetails` block under each such row. `DListDetail.jsx` accepts `39999:` and `9999:` ids.

- **Pros.** One classifier for one grammar — every consumer sees the same answer; the story-2 pins
  hold by construction (name required). The lookup is one pass over the Map (local batches per
  `(kind, delegate)`, then one relay fetch per still-missing row), not one effect per row. The pure
  pieces (classification, duplicate marking, community-pointer extraction, warning text) are
  ESM-testable. The route change is minimal and symmetric with what is already there.
- **Cons.** The panel gains a second network concern (the lookup) beside its profile fetch; a
  header missing locally costs one relay round-trip per row.

### Option B — A sibling classifier for per-DList rows, used only by the panel

- **Cons.** Two classifiers over one grammar that must agree; the panel branches twice per row.
  Rejected.

### Option C — Reuse story 5's local-only lookup by lifting it into a shared hook now

- **Cons.** Story 5's lookup is local-only by decision (its list is about *my* Map); Map Entries
  needs local-then-relay. Lifting and generalizing a shipped panel's internals for one consumer is
  the shared-primitive pattern this book has deferred twice; rejected here, noted as part of the
  same chore.

### Sub-decisions

1. **Kind-39999 links resolve by extending the route**, not by omitting the link: the DList detail
   page is the right page for a 39999-declared header (the DList NIP's own direction), and the
   change is two prefixes in one condition.
2. **Lookup order and batching.** Local: one `queryRelay({kinds:[kind], authors:[pubkey], '#d':[…d]})`
   per `(kind, pubkey)` group of effective rows, matched back by exact coordinate. Relay: for each
   row still missing and carrying a `wss://`/`ws://` hint, one
   `GET /api/relay/external?filter=<{kinds,authors,'#d'}>&relays=<hint>`; newest `created_at` wins.
   Rows with no hint and no local copy warn "not found locally; no relay hint".
3. **The community pointer** is the first `b` tag whose value is an a-tag (`^\d+:[0-9a-f]{64}:.+$`);
   rendered `<kind>:<pk8>…<pk4>:<d>` with the type (`pointer` when absent) and a link to
   `/tapestry/lists/<encoded coordinate>`. Sentinel-only or malformed `b` → "no community pointer".
4. **Short pubkey inline** is added to the external badge **for `dlist` rows only** (AC-6 keeps TA/TL
   rows byte-identical); promoting it to every class is a one-line polish for a later story.
5. **Duplicates** are decided per `<kind>:<d-tag>` over the raw first element across `dlist` rows
   (the designation row is single by construction); the first is effective; later rows get the
   "duplicate — ignored" pill, no lookup, no details block.

## Decision

We chose **Option A** with the sub-decisions above.

## Consequences

- **Enables** the acceptance frame's Map Entries bullet; closes review #5's three carry-forwards
  (first-occurrence, the 39999 link, the inline short pubkey).
- **Constrains.** `classifyEntry`'s class vocabulary grows to `ta | tl | dlist | designation | other`;
  consumers switching on it must handle the two new values (only the panel does today). The
  lookup's warning strings are a contract Phase 3 pins.
- **A behavior change users will notice.** Curated DList rows grow a details line (name/link/pointer
  or a warning); external delegates on those rows show their short pubkey.
- **Debt.** Two panels now look headers up in two slightly different ways; the shared-primitive chore
  (disclosure + header lookup) is recorded for the close. The relay round-trip per missing row is
  bounded by the number of curated DLists on one Map.
- **Firmware reinstall required?** **No.**

## Implementation notes

1. **`ui/src/utils/treasureMap.js`**
   - `classifyEntry`: after computing `kind`, `name`, `pubkey` — when `pubkey !== null` and
     `(kind === 39998 || kind === 39999)` and `name !== null && name !== ''`: `cls = (kind === 39998 && name === 'dlist-header') ? 'designation' : 'dlist'`; otherwise the existing chain. Update the
     JSDoc's `cls` enumeration.
   - `markDuplicateEntries(rows)` (pure, exported): given `classifyEntry` rows in order, returns the
     same rows with `duplicate: true` on every `dlist` row whose `raw` already appeared on an
     earlier `dlist` row; other classes untouched (`duplicate: false`).
   - `communityPointerOf(header)` (pure, exported): `{ coord, type }` for the first `b` tag whose
     value matches the a-tag form, `type` = element 3 or `'pointer'`; `null` when none.
   - `describeHeaderLookup(row, found, checkedRelay)` (pure, exported): the details-line copy —
     found → `{ status:'found', where:'local'|'relay' }`; missing → `{ status:'missing', text }` with
     text `Header not found locally or on <relay>` / `Header not found locally; no relay hint`.
2. **`ui/src/pages/grapevine/TreasureMapTagsPanel.jsx`**
   - `CLS_LABEL` gains `dlist: 'Curated DList'`, `designation: 'TA designation'`; `CLS_COLOR` gains
     two colours (`dlist: '#f0883e'`, `designation: '#8b949e'`).
   - `rows = markDuplicateEntries(tags.map(classifyEntry))`.
   - One effect over the effective `dlist` rows (sub-decision 2) → `headers` state keyed by
     coordinate `{ event, where }` or `{ missing:true, checkedRelay }`; `queryRelay` for local,
     `fetch('/api/relay/external?…')` for the hint; tolerate every failure as "missing".
   - `EntryRow`: for `dlist` rows render `· <d-tag>` in the pill, the inline short pubkey on the
     external badge, the "duplicate — ignored" pill when `row.duplicate`, and (effective rows only)
     a `<DListRowDetails>` line: the header's name linked to
     `/tapestry/lists/${encodeURIComponent(coord)}`, "inherits from" + the community pointer (linked,
     with type), or the warning from `describeHeaderLookup` in the warn colour. `designation` rows
     render the label only.
3. **`ui/src/pages/lists/DListDetail.jsx:33`** — the a-tag condition becomes
   `/^(39998|39999|9998|9999):/.test(decodedId)`; nothing else changes.
4. **Phase 3 guidance (the Tester's lane).** Suite e.g. `test/dlist-curation-map-entries.test.js`:
   **U** — `classifyEntry` (the two classes; bare kinds, delegate-less and other kinds unchanged —
   re-run of the story-2 expectations inline), `markDuplicateEntries`, `communityPointerOf` (a-tag,
   sentinel-only, malformed, absent type → pointer), `describeHeaderLookup` (both warning texts).
   **S** — the panel's label map, the effect's two lookups (`queryRelay` + `/api/relay/external`),
   the details block and link, the inline short pubkey on `dlist` rows, `useAuth` baseline, no
   `taPubkey`, no 64-hex; the route's four-prefix condition. **R** — the story-2 suite
   (`tl-treasure-map-panel`) green; TL/TA labels unchanged; the DList Curation panel and the TL card
   untouched. **B** (optional) — Playwright with `page.route` mocks (auth, the 10040 scan with
   dlist rows incl. a duplicate and a 39999 row, the local 39998 scan hit and miss, the relay fetch)
   to see the details line and the warning; the reviewer's method.

## Out of scope

- Editing entries from Map Entries; verifying the community header's presence; the shared lookup /
  disclosure chore; the merge-preserve fix; the `inherit-items` resolver.
