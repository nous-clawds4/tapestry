# Test Plan: Story 3 — Pinned-note-aware profile "Content" card

**Story:** `engineering-team/stories/feed-usability/3-profile-content-card.md`
**ADR:** `engineering-team/decisions/feed-usability/0003-profile-content-card.md`
**Date:** 2026-07-03

## Test level decision

- **Server behavioral (SB)** — executes the real `profileContentReadPath.js` with injected
  deps. The `querySync` fake **dispatches on the filter shape** (kind-10001 pin list / `{ids}`
  by-id / kind-1 by-author), so the whole selection order is observable behavior with no live
  relays/strfry/Neo4j: pinned-wins, first-resolvable-of-several, unresolvable-pins-fall-through,
  latest-top-level fallback, NO_TOPLEVEL, EMPTY, INVALID. `pinnedNoteIds` is a pure unit.
- **UI sentinels (U)** — source-regex on the new one-shot hook and the updated section (no JSX
  transpile in the runner).
- **Regression (R)** — the by-author `/notes` read path gains no pin logic; the section reuses
  `_shared/relaySource` (third-consumer consolidation) + `enrichNotes`.
- **Runtime** — pinned-shows-badge / reply-heavy-shows-latest-top-level / replies-only-shows-
  NO_TOPLEVEL is the cycle-local browser smoke before review.

## Coverage map

| Criterion | Test(s) | File | Level |
|---|---|---|---|
| Pinned note wins (+ labelled pinned) | SB1 (`pinned:true`, item is the pin), U3 (badge) | `test/profile-content-card.test.js` | server + UI |
| One pinned note when several | SB2 (first e-tag), SB2b (first *resolvable*) | same | server |
| Unresolvable pins fall through | SB3 (→ top-level, `pinned:false`, no error) | same | server |
| No pin → latest top-level | SB4 (first `!isReply`, skips a newer reply) | same | server |
| Only replies, no pin → explicit state | SB5 (`NO_TOPLEVEL`), U4 (reply-only copy), U5 (notes link stays) | same | server + UI |
| Existing empty preserved | SB6 (`EMPTY`), U4 (`CONTENT_COPY.EMPTY` retained) | same | server + UI |

Supporting: SB0/SB0b/SB0c (module + route + `_shared/relaySource`/`enrichNotes` reuse), SB7
(`INVALID`, no relays queried), SB8 (`pinnedNoteIds` pure unit), U1/U2 (one-shot hook, no
pagination), R1 (`/notes` path untouched).

## Edge cases

- [x] Pinned note authored by **someone else** (pins can reference anyone) — SB1 uses `OTHER`.
- [x] Deterministic pick among several pins = first resolvable `e`-tag — SB2/SB2b.
- [x] Pin list present but every id unresolvable → graceful fall-through, never stuck — SB3.
- [x] Newer reply does not shadow the latest top-level — SB4.
- [x] `NO_TOPLEVEL` distinct from `EMPTY` — SB5 vs SB6.
- [x] Malformed pubkey short-circuits before any relay call — SB7.
- [x] `pinnedNoteIds`: e-tag order, `PIN_TRY_CAP`, ignores non-`e`/id-less/non-array — SB8.
- [x] The hook is one-shot, not the paginating `useUserNotes` — U2.

## Shipped-suite updates (required by ADR 0003)

The section moves from `useUserNotes(pubkey, 1)` / `items[0]` to `useProfileContent(pubkey)` /
`data.item`, invalidating two `note-surfaces-ui` sentinels:

- **U3** — re-pointed from "uses `useUserNotes(pubkey, 1)`" to "uses `useProfileContent(pubkey)`".
  (Flips to failing on current code — it is now a Story-3 sentinel; passes post-implementation.)
- **U4** — the "single note, not a list" assertion now accepts `data.item` **or** the old
  `items[0]` (still passes on current code; still one note, no `.map`).

U7 (renderContentBody pure), U8 (section placement after Reputation), R3 (Reputation untouched)
are unaffected.

## Test infrastructure
- Node runner; suite registered in `test/test.js` (require + run + `overallOk`), exports `{ run }`.
- No live services: server tests use in-memory `querySync`/`scanStrfry`/`runCypher` fakes;
  UI/dep checks are source reads.
- Fixtures: a kind-10001 pin list with `e`-tag ids; kind-1 notes (reply-tagged and top-level);
  a filter-dispatching `querySync`.

## How to run
```
npm test
# or just this suite:
node -e "require('./test/profile-content-card.test.js').run()"
```

## Verification

New tests fail against current code for the right reasons (feature absent); the two guard tests
pass. Confirmed 2026-07-03 at commit `bb680843` (16 fail / 2 pass in the new suite):

```
✗ SB0/SB0b/SB0c: module + route + _shared/relaySource reuse            (module absent)
✗ SB1: pinned wins (pinned:true, item is the pin)
✗ SB2/SB2b: first / first-resolvable of several pins
✗ SB3: unresolvable pins fall through to top-level (pinned:false)
✗ SB4: no pin → latest top-level, skips a newer reply
✗ SB5: reply-only → NO_TOPLEVEL
✗ SB6: no notes → EMPTY
✗ SB7: bad pubkey → INVALID, no relays queried
✗ SB8: pinnedNoteIds pure unit
✗ U1/U2: one-shot useProfileContent hook
✗ U3/U4: section renders data.item + Pinned badge + NO_TOPLEVEL branch
✓ U5: "View all notes →" link stays present
✓ R1: /notes read path gains no pin logic
=> profile-content-card pass: 2 fail: 16
```

Shipped `note-surfaces-ui` after the U3/U4 edits (current code): 17/2 — the two failures are
the new Story-3 U3 sentinel (will pass post-implementation) and the pre-existing `NoteCard`-
variant R2 (unrelated; fails on the parent commit). U4 still passes.
