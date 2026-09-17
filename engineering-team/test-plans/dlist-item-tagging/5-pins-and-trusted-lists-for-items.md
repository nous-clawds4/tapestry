# Test Plan: dlist-item-tagging Story 5 — Pins and Trusted Lists for tagged items

**Story:** `engineering-team/stories/dlist-item-tagging/5-pins-and-trusted-lists-for-items.md`
(the **§ Rulings (2026-09-17)** override everything above them: E11 inverted — a failed publish keeps
its d-tag on the roster for all three kinds and `runOneNotePin` is aligned; AC-5 = Pinned tab only;
applicability lists stay outside the `z` convention)
**ADR:** `engineering-team/decisions/dlist-item-tagging/0003-item-trusted-lists-implementation.md`
(Accepted; supersedes the story's 2026-09-10 Design note where they differ) — wire shape from
`0002-trusted-list-discovery-tags.md` (Accepted)
**Lane:** Light (trial) — J2 judges this plan; J3 runs the scoped gate.
**Date:** 2026-09-17 · branch `feat/dlist-item-tls`, HEAD `08dc4973`

## Scoped gate (as named at Gate A)

```
test/item-trusted-list.test.js      (NEW — this plan's deliverable)
test/generalized-tag-pinning.test.js   (guard — Phase 4 MUST NOT edit)
test/strfry-write-assertion-bracket.test.js (guard — Phase 4 MUST NOT edit)
```

`test/note-trusted-list.test.js` is run alongside as the AC-7 regression witness (it is **not** a
guard suite; see "Changes to the note suite" below). The new suite is registered in
`test/registry.js` beside `dlist-index-page-counts.test.js` (this branch uses the registry, not
`test/test.js`).

## Test levels

| Prefix | Level | What it does |
|---|---|---|
| `U*` | unit / dependency-injected | Executes the new pure composers and `runOneItemPin` / `ensureTagTLHeader` / `retractStaleTLs` through injected deps (`{ lookupTag, aggregateNotesTagged, publishTL }`, mirroring `test/note-trusted-list.test.js`'s harness). No live strfry, Meili, Neo4j or control panel. |
| `S*` | source sentinel | Exports, wiring, client surfaces, the no-TA-literal rule. |
| `R*` | regression sentinel | The 30392/30393 runners and the explicitly out-of-radius files stay as they are. |
| `FS*` | firmware fixture | **Filesystem only.** Concept dirs + `manifest.json`. This suite never triggers `POST /api/firmware/install` (binding tester note, ADR 0003 §4). |

## Test seams this plan pins (binding on the Implementer)

The story's behavior cannot be proved relay-free without three injection points. These are named
here so the Implementer does not have to guess, and so J3 can check the handles landed:

1. **`runOneItemPin(pinEvent, options)`** honors the house `options.deps || options` shape *and*
   additionally accepts `deps.ensureTagTLHeader` — an override for the lazy header helper. Without
   it the F1 policy (U20) and the happy-path `z` pair (U18/U19) cannot be separated.
2. **`ensureTagTLHeader({ tag }, deps)`** accepts an injected `deps.strfryScan` and
   `deps.publishHeader` (the tests also pass the aliases `scan` / `publish` / `publishEvent`, so
   either naming satisfies them).
3. **`retractStaleTLs(currentDTags, { kind, dPrefix, deps })`** accepts the same injected pair and
   is exported. This is the only way E2 ("exactly one retraction") is a test rather than a grep.
   Adding the export + the deps default is inside the declared blast radius
   (`src/api/trustedList/refreshPinnedTags.js`); the function's logic is otherwise unedited except
   for the `carryOver` `z` addition ADR 0003 §1 already requires.

## AC → handle table

| Criterion | Handles | Level |
|---|---|---|
| **AC-1** kind-30394 TL, `a` members, d-tag / back-ref / observer discipline | `U6`, `U7`, `U8` | unit |
| **AC-2** items only when the method selects them; absent `targetTypes` = pre-existing default | `U9`, `U10`, `S7` | unit + sentinel |
| **AC-3** dialog offers item targets; "select at least one" accounts for it | `S6` | sentinel |
| **AC-4** stale 30394 retracted by the same mechanism | `U28`, `U29`, `S2` | unit + sentinel |
| **AC-5** status + member count on the tag page's Pinned tab (Rulings 2) | `S8`, `S9`, `R5` | sentinel |
| **AC-6** no empty 30394 published | `U11`, `U12` | unit |
| **AC-7** 30392/30393 runners, their tests and every published list unaffected | `R1`, `R2`, `R4`, plus a green `test/note-trusted-list.test.js` | sentinel + regression run |

## Edge case → handle table (E1–E12, as ruled)

| Edge case | Handles | Notes |
|---|---|---|
| **E1** no `a` back-ref to the tag element on a 30394 (and no `e` substitute) | `U8` | On a 30394 `a` *is* the member letter; the withdrawn `['e', tag.eventId]` is not emitted either. |
| **E2** the sweep shares kind-30394 with the applicability lists | `U28`, `R3` | Fixture relay = both applicability lists + one live item TL + one stale item TL ⇒ **exactly one** retraction, on the stale item d-tag. |
| **E3** a pin predating `targetTypes` | `U9`, `U10`, `S7` | Absent ⇒ `skipped`; `['item']` alone ⇒ publishes. |
| **E4** `a`-taggings exist but none survive curation | `U12` | Fully net-disputed ⇒ nothing published. The *stale-list* half of E4 is covered by the sweep (`U28`). |
| **E5** an `a` target that is not a DList item | `U14` | The item TL consumes story 4's filtered set verbatim; it adds no second type filter. |
| **E6** cap + partial signal | `U16`, `U17` | `ITEM_TL_MEMBER_CAP === 500`; `truncated` present ⇔ `content.partial` ⇔ (`scanTruncated` ∨ over cap); **absence means complete**. |
| **E7** slug hostility in the `d`-tag | `U2` | Dashed slug + context suffix still composes `tl-pin-items-<obs8>-<author8>-<slug>-in-<ctx>`. |
| **E8** two pins of the same tag under different observers | `U22` | Distinct d-tags; neither retracts the other. |
| **E9** unpin then refresh; retraction idempotence | `U29`, `U28` | Empty-membership replacement with `['status','retracted']`; a second sweep is a no-op. |
| **E10** `refreshPinnedTagsForViewer` does not retract | `S3` | Asserted on the function body, not the module. |
| **E11** *(inverted by Rulings 1)* a failed publish **keeps** its d-tag on the roster | `U23`, `S2` | `runOneItemPin` returns `{status:'error', dTag}`; `currentItemDTags` collects it **unconditionally**; `currentNoteDTags` is aligned (no `status === 'ok'` guard). |
| **E12** status-enrichment degradation | `S9` | The 30394 scan is in its own `try`; a failure leaves every row at `'never'` and `GET /api/profile-tags/pins` still returns 200. |

## ADR 0003 added invariants → handle table

| Invariant | Handles |
|---|---|
| Address filter on `fullItemMembers` — an id-keyed member (no `address`) never becomes an `a` member | `U13` |
| The `z` pair is a **set**, not an order — neutral TL carries exactly 2 `z`, contextual carries 3 | `U18`, `U19` |
| `trustedListZTags` is the single composer, called by **all three** runners | `U3`, `S5` |
| Handle composers (`conceptTrustedList`, `conceptTrustedListForTag`, `tlHeaderDTag`, `tlHeaderAddr`) | `U4` |
| `itemTlDTag` composer, with and without context | `U1`, `U2` |
| `buildTLHeader` — pure kind-39999 header, `d = tl:<slug>-tls`, `a` → tag element | `U5` |
| `ensureTagTLHeader` lazy mint + idempotence + positive memo | `U25`, `U26` |
| Header failure policy **F1** — publish proceeds *without* the per-tag `z`, never aborts | `U20`, `U27` |
| The runner ensures the header before publishing | `U21` |
| Retraction `carryOver` keeps `z` axes | `U30` |
| **No 64-hex literals** in any touched file (profile-tags keeps exactly its one ADR-0015 carve-out) | `S10` |
| `pickHeader` must not be imported into this path | `S5` |
| Story-4 prerequisite: `fullItemMembers` + `itemTotal` exist and are exported | `S11` *(passes today — it is the cross-story contract witness)* |
| Unsupported method / malformed observer are reported, never published | `U24` |
| Curation by `noteMethod` over address rows (`curateNotes` reused verbatim) | `U15` |

## Regression sentinels (out-of-radius / untouched-ness)

| Sentinel | Handle |
|---|---|
| 30392 + 30393 kinds, metrics, d-prefixes, and the two existing sweeps survive | `R1` |
| 30393 keeps its legacy `a` + `p` dual-emit pair (ADR 0002 Decision 4) | `R2` |
| `src/api/trustedList/refreshApplicabilityLists.js` keeps its fixed d-tags and gains **no** `z` convention (Rulings 3) | `R3` |
| `src/api/trustedList/index.js` needs **no** edit | `R4` |
| `ui/src/pages/Pins.jsx` gains **no** item status surface (Rulings 2 / Story 20 / ADR 0018) | `R5` |
| The guard suites `test/generalized-tag-pinning.test.js` and `test/strfry-write-assertion-bracket.test.js` are **barred from Phase 4** (guard carve-out, `templates/adr.md`) | run, never edited |

## Edge cases / scenarios NOT derivable from any acceptance criterion

- **E1 / `U8`** — nothing in the ACs says the tag back-ref must change shape; it falls out of `a`
  being the member letter on a 30394. Copying the note runner's back-ref would silently sign the
  tag itself as a curated item.
- **E2 / `U28`** — the retraction sweep shares kind-30394 with the applicability lists. Only the
  `dTag.startsWith(dPrefix)` guard keeps it from disabling the tag pickers instance-wide.
- **F1 / `U20`, `U27`** — header-mint failure must degrade to "publish without the per-tag `z`".
  The destructive alternative (abort) would let the sweep retract a healthy live list.
- **`U13`** — the two key spaces inside `fullItemMembers` (address-keyed vs id-keyed). No AC
  mentions it; without the filter a bare event id would be signed as an `a` coordinate.
- **`U30`** — a retraction that drops the `z` axes makes a list *vanish* from a `#z` consumer's
  view rather than appear as retracted.
- **`S10`** — the per-deployment TA rule. A 64-hex literal would work locally and break every other
  deployment silently (the reference incident in CLAUDE.md).

## Error paths for external dependencies

| Dependency | Error path | Covered by |
|---|---|---|
| `publishTL` / `buildAndPublishTL` (relay write) | throws ⇒ `{status:'error', dTag}`, d-tag still rostered | `U23` |
| `ensureTagTLHeader` scan/publish (relay) | returns `{status:'error'}`, never throws; TL still publishes (F1) | `U20`, `U27` |
| `strfryScan` inside the retraction sweep | injected; a real-relay failure path is **not covered** — the existing sweep already lets it propagate to the cron caller and this story does not change that | *not covered (reason given)* |
| `strfryScan` for `itemTlStatus` (`enrichRowsWithTLStatus`) | its own `try`; rows stay `'never'`, 200 preserved | `S9` (E12) |
| `lookupTag` (tag missing from local strfry) | pre-existing `{status:'error'}` path, unchanged from `runOneNotePin` | *not covered — no behavior change* |
| `aggregateNotesTagged` throwing | **not covered** — identical to the note runner's existing posture; this story adds no new handling and asserting one would over-constrain. | *not covered (reason given)* |
| Concept Graph API / control panel | **not used.** All firmware checks are filesystem-level (`FS1`–`FS4`); the live seeding proof is the reviewer's post-reinstall run. | n/a |

## Changes to `test/note-trusted-list.test.js`

**Zero assertions changed.** Ruling 1 aligns `runOneNotePin` with the unified failure policy, and the
suite was grepped for the old inverse before touching it:

- `runOneNotePin` **already** returns `dTag` on the error path (`refreshPinnedTags.js:448`), so no
  unit assertion in that file encodes the old behavior.
- The old inverse lives only in the **wiring** —
  `if (noteResult.dTag && noteResult.status === 'ok') currentNoteDTags.push(...)` at
  `refreshPinnedTags.js:467` — and no existing test asserts it (`grep -n "currentNoteDTags" test/`
  returns only `pin-stack-composition.test.js:484`, which asserts *that* the sweep is called, not the
  push guard).
- The aligned behavior is therefore asserted **in the new suite** by `S2`, which requires
  `if (noteResult.dTag) currentNoteDTags.push(...)` — i.e. the `status === 'ok'` guard removed.

Consequence for Phase 4: `test/note-trusted-list.test.js` must stay **green as-is** after the change.
It injects no `ensureTagTLHeader`, so the real helper will run in those tests with no relay — F1 must
make that a fast, non-fatal `{status:'error'}`, not a throw or a hang.

## Prerequisites and preconditions

- **No running stack required.** Every handle is unit/sentinel/filesystem. Nothing hits
  `localhost:8778`, strfry, Neo4j or Meilisearch. No suite is skipped for a missing stack.
- **Story 4 must have landed** (`aggregateNotesTagged` returning `fullItemMembers` + `itemTotal`) —
  witnessed by `S11`, which passes on this branch today.
- **`POST /api/firmware/install` is NOT a precondition of this suite.** `FS1`–`FS4` read the
  repository only. The reinstall (ADR 0003 §4, `curl -X POST http://localhost:8778/api/firmware/install`)
  is an *implementation* step and its live effect is verified at review, not here.

## How to run

```
{ timeout 120 env BRAINSTORM_BASE_URL=http://localhost:8778 direnv exec . node -e "require('./test/item-trusted-list.test.js').run().then(r=>{console.log(r);process.exit(r.fail?1:0)})"; echo "EXIT=$?"; } 2>&1
```

Same form for `test/note-trusted-list.test.js`. Never pipe the gate through `tail` when capturing the
exit code (OPEN #157) — use the brace-redirect above.

## Verification — the tests fail for the right reason

Run on 2026-09-17, branch `feat/dlist-item-tls`, HEAD `08dc4973`, pre-implementation:

```
{ pass: 7, fail: 44, skipped: 0 }
EXIT=1
```

Representative failures (each names the missing piece, not a typo or import error — the module
`require` is wrapped so a missing export is *reported*, never a crash):

```
  ✗ U1: itemTlDTag composes tl-pin-items-<obs8>-<tagAuthor8>-<slug> for a neutral pin
      event-tagging SDK must export itemTlDTag (pins.js).
  ✗ U6 (AC-1): an item-targeting pin publishes a kind-30394 TL whose members are the items a-coordinates
      refreshPinnedTags.js must export runOneItemPin(pinEvent, {deps}) — absent pre-implementation (ADR 0003 §1).
  ✗ U16 (E6): ITEM_TL_MEMBER_CAP is 500; beyond it publish the cap and signal ["truncated", total]
      refreshPinnedTags must export ITEM_TL_MEMBER_CAP = 500 ...; got undefined.
  ✗ U28 (E2): the 30394 sweep retracts only tl-pin-items- lists — the applicability lists are untouched
      refreshPinnedTags.js must export retractStaleTLs(currentDTags, {kind, dPrefix, deps}) so the sweep is testable.
  ✗ S2 (AC-4 + Rulings 1): refreshAllPinnedTags runs the item runner, collects its d-tag unconditionally, and sweeps 30394
      refreshAllPinnedTags must call runOneItemPin per pin.
  ✗ FS3: both concepts are registered in the version manifest (discovery is manifest-driven)
      manifest.json concepts[] must register "trusted-list" — install.js iterates the manifest, it does not scan the directory.
```

The **7 passing** handles are the ones that must already hold before any code is written — the
regression and prerequisite sentinels:

```
  ✓ S10 (no literals) · ✓ S11 (story-4 fullItemMembers present)
  ✓ R1 (30392/30393 intact) · ✓ R2 (30393 legacy a+p) · ✓ R3 (applicability untouched)
  ✓ R4 (trustedList/index.js untouched) · ✓ R5 (Pins index has no item surface)
```

`test/note-trusted-list.test.js` on the same commit: `{ pass: 15, fail: 0 }`, `EXIT=0` — the AC-7
baseline the implementation must preserve.

## Not covered (deliberate)

- Back-filling the missing kind-30393 status line (pre-existing gap; Rulings 2 keeps the Pins index
  surface-free).
- Any NIP-51 export analog for items.
- A live `POST /api/firmware/install` and the resulting graph rows (`trusted-list` will show
  `elementCount: 0` forever by design — ADR 0003 §4).
- Browser/Playwright coverage of the new checkbox and the Pinned-tab rows — the story's UI delta is
  two conditional rows and one checkbox; `S6`/`S8` sentinel them, and the visual check belongs to the
  reviewer's cycle-local smoke test.
- Performance of the second `aggregateNotesTagged` call per pin (ADR: accepted unmeasured).
- `retractStaleTLs` relay-failure propagation (pre-existing posture, unchanged).
