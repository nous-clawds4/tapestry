# Test Plan: TA-signed note Trusted List (event-tagging #17 / issue #336)

**Story:** `engineering-team/stories/event-tagging/17-ta-signed-note-trusted-list.md`
**ADR:** `engineering-team/decisions/event-tagging/0016-ta-signed-note-trusted-list.md`
**Suite:** `test/note-trusted-list.test.js` (registered in `test/test.js`)

## Strategy

`runOnePin` (the pubkey twin) has no dependency seam and its only test hits the live stack (flaky).
Per ADR 0016's Testability note, `runOneNotePin(pinEvent, { deps })` is built **with an injectable
seam** — `deps = { lookupTag, aggregateNotesTagged, publishTL }` — so the behavior (kind, d-tag,
metric, member encoding, curation, observer/source-tag, empty-retraction, note-targeting gate) is
verified **hermetically**, with no strfry/meili. `parseCurationMethod`/`parsePinTagEventId` run for
real against a constructed pin fixture (they are pure). Source sentinels cover the wiring that can't
be unit-executed (the `refreshAllPinnedTags` call, the `handleForTag` re-point, the exports).

Canonical injection contract: `runOneNotePin(pin, { deps: { lookupTag, aggregateNotesTagged, publishTL } })`.
`publishTL` receives exactly the `buildAndPublishTL` argument object (`{ kind, dTag, title, metric,
items, extraTags, content }`); the tests assert on that captured object.

## Coverage — AC → test

| Acceptance criterion | Test(s) |
|---|---|
| Publishes a TA-signed note TL (e-tag members) for a note-targeting pin, under observer POV | N1 |
| **kind-30393** (event-list per NIP-85 convention), members are `e`-tags | N1 |
| Curated by the pin's `noteMethod` (`curateNotes` order) | N3 |
| Distinct, non-colliding identity: `tl-pin-notes-<obs8>-<tagAuthor8>-<slug>` d-tag, `pinned-tag-notes` metric, observer + source-tag provenance | N2 |
| Empty curated set ⇒ empty-membership replacement (not stale) | N4 |
| Refreshed alongside the pubkey TL in `refreshAllPinnedTags` | S3 |
| A non-note-targeting pin publishes no note TL | N5 |
| Absent `targetTypes` ⇒ ADR-0015 default includes note ⇒ publishes | N6 |
| Extract-and-re-point: `aggregateNotesTagged` exported + `handleForTag` uses it | S1, S2 |

## Test list

**Structural (source sentinels):**
- **S1** — `refreshPinnedTags` exports `runOneNotePin`; `event-tags` defines + exports `aggregateNotesTagged`.
- **S2** — `handleForTag` calls `aggregateNotesTagged` (the DRY re-point).
- **S3** — `refreshAllPinnedTags` calls `runOneNotePin` (note TL refreshed alongside the pubkey TL).

**Behavioral (`runOneNotePin` executed with injected deps):**
- **N1** — note-targeting pin → one publish, `kind === 30393`, members are the notes as `e`-tags.
- **N2** — d-tag `tl-pin-notes-<obs8>-<tagAuthor8>-<slug>`, metric `pinned-tag-notes`, observer + source-tag extraTags.
- **N3** — curation honored: `notes:net-endorsed` drops disputed≥applied; `notes:most-applied` keeps all, ordered by applications desc.
- **N4** — all-disputed input → curated empty → still publishes, zero `e`-tag members (empty replacement).
- **N5** — `targetTypes: ['profile']` → no note-TL publish.
- **N6** — `targetTypes` absent → defaults to include note → publishes.

## Out of scope (not tested here)
- The `refreshAllPinnedTags` end-to-end publish + stale-retraction against live strfry (covered by the
  existing pinned-tag live suite; `runOneNotePin`'s publish is unit-verified via the seam).
- `aggregateNotesTagged`'s strfry/meili internals — its output contract is faked; the `event-tagging-for-tag`
  suite (unchanged) guards that `handleForTag` still behaves after the re-point.
- Any UI/reader surface; `NOTES_CAP`; the kind-30003 export.

## Status
All 9 tests **fail** pre-implementation (functions absent), for the right reasons (missing
`runOneNotePin`/`aggregateNotesTagged`, not require errors). Green once the ADR's Option A ships.
