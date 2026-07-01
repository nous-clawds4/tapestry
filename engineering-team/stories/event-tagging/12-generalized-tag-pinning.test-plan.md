# Test Plan — Story 12: Generalized (target-typed) tag pinning

**Story:** `engineering-team/stories/event-tagging/12-generalized-tag-pinning.md`
**ADR:** `engineering-team/decisions/event-tagging/0015-generalized-target-typed-pinning.md`
**Test file:** `test/generalized-tag-pinning.test.js`

## Strategy

The testable spine is **pure core logic** — the registry projection and the note-curation functions — so those get **functional** tests (require the CJS core, assert real behavior), like `event-tagging-core.test.js`. The client pin/export generalization (`publishTagPin.js`, ESM + `window.nostr`) and the UI (curation dialog target-type checkboxes, Pinned tab) are **source-contract** greps + **manual** verification (per the book's UI-pass convention). Profile-pinning backward-compat is guarded by the *existing* pin tests continuing to pass (`pin-a-tag*.test.js`, `tl-publication-from-pins*`, `nip51-list-export-from-pins*`) — this story must not regress them.

## What to add to the core (`src/lib/event-tagging/taggings.js`)

- Per-member `projections` (registry-owned): `nostr-user-tag` → `{ profile: {listKind:30000, elementTag:'p'} }`; `nostr-event-tag` → `{ event: {listKind:30003, elementTag:'e'}, address: {listKind:30003, elementTag:'a'} }`.
- `projectionFor(targetType)` — resolves a target type to `{ listKind, elementTag }` by scanning member projections (returns `null` for unknown). The single source of truth for "how does target type X project into a NIP-51 list".
- `curateNotes(notes, method)` — the note-pin curation, over the `for-tag` note shape `{ id, applications, disputes, createdAt }`.

## Cases (functional — MUST fail until the core is extended = red)

**Registry projection (AC: right list type per target; extensible)**
1. `projectionFor('profile')` → `{ listKind: 30000, elementTag: 'p' }`.
2. `projectionFor('event')` → `{ listKind: 30003, elementTag: 'e' }`.
3. `projectionFor('address')` → `{ listKind: 30003, elementTag: 'a' }`.
4. `projectionFor('nope')` → `null` (unknown type has no projection).
5. Projection is **registry-driven**: each `taggingMembers` entry owns its `projections`, and every projected type resolves via `projectionFor` (so a new member registering a projection is auto-covered — extensibility AC).

**Note curation (AC: curated snapshot; two operator options)**
6. `curateNotes(notes, 'notes:net-endorsed')` keeps only `applications > disputes` and orders by `createdAt` desc (recency). Net-zero and net-negative notes are excluded.
7. `curateNotes(notes, 'notes:most-applied')` keeps **all** tagged notes, ordered by `applications` desc (recency tiebreak) — including contested ones.
8. Default method (no/instance arg) = `notes:net-endorsed`.
9. Curation is a pure snapshot: same input → same output, no mutation of the input array.

## Cases (source-contract — red until the client/UI is generalized)

**Client pin/export generalization (`ui/src/utils/publishTagPin.js`)**
10. The export path is **target-type-aware** — it references `projectionFor` / the registry element tag rather than a hardcoded `['p', pk]` for every member (the `p`-only mapping at the old `:410` must be gone / conditioned).
11. `defaultCurationMethod` provides a **note** curation default (`notes:net-endorsed`) alongside the profile method.

**Target-type selection (curation options — operator decision 2)**
12. The pin/curation config carries a **target-type selection** (profiles / notes / both), and the export only materializes selected-and-present types.

## Manual verification (browser — no automated coverage)

- Pin a tag that has note-taggings → a kind-30003 bookmark set (with `e` elements) is published under the viewer's key; the Pinned tab reflects the note list.
- A tag with both profiles and notes, with "both" selected → a kind-30000 **and** a kind-30003 are produced; "notes only" → just the kind-30003; "profiles only" → just the kind-30000 (unchanged profile behavior).
- Switching note curation net-endorsed ↔ most-applied changes the membership as specified.
- Profile-only tag pin is byte-for-byte the prior behavior (kind-30392 TL + kind-30000 export).

## Regression guard

Run the existing pin suite after implementation — `pin-a-tag.test.js`, `pin-a-tag-publish.test.js`, `tl-publication-from-pins*.test.js`, `nip51-list-export-from-pins*.test.js`, `customize-pin-curation-publish.test.js`, `most-pinned-tag-index*.test.js` — all must stay green (AC: profile pinning unchanged). Pre-existing failures documented in the Story-15 review (community-reference / batch-flaky) are out of scope.
