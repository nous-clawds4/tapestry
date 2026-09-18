# Test Plan: search-index-selection #1 — Tag a list header

**Story:** `engineering-team/stories/search-index-selection/1-tag-a-list-header.md` (Approved; Light lane, Gate A 2026-09-18)
**ADR:** none for this story (Light — Design note in the story file). Composition rule inherited from `engineering-team/decisions/dlist-item-tagging/0001-addressable-target-dtag.md`.
**Design target:** `docs/SEARCH_INDEX_DLIST_SELECTION.md` (rev 3)
**Date:** 2026-09-18
**Suite:** `test/tag-a-list-header.test.js` (new; registered in `test/registry.js` beside `trusted-list-raw-view.test.js`)

## Scoped gate (Gate A)

```
test/tag-a-list-header.test.js  (new)
test/dlist-tagged-items.test.js
test/dlist-browse.test.js
test/trusted-list-raw-view.test.js
```

**Guard-suite carve-out.** Phase 4 must not edit `test/dlist-tagged-items.test.js`,
`test/dlist-browse.test.js` or `test/trusted-list-raw-view.test.js`. In particular
`trusted-list-raw-view` **U12** asserts `groupItemsByList`'s current output shape for
non-header rows; E8 (no headers ⇒ byte-identical output) is exactly what keeps it green,
and a red U12 means the headers group leaked into the no-header path.

## Test classes

| Class | What it drives | Level |
|---|---|---|
| **U** | `groupItemsByList` via dynamic `import()`; the two new pure exports of `src/api/event-tags/index.js`; `buildEventTaggingAssertion` with the ADR-0001 injected `hash8` | unit, relay-free |
| **S** | source sentinels over `List.jsx`, `TagItemsView.jsx`, `PinnedListPanel.jsx`, `src/api/event-tags/index.js` | structure |
| **R** | regression sentinels on the deliberately-untouched surfaces | unit + structure |

## Coverage map

| Criterion | Handle | Test name (abbrev.) | Level |
|---|---|---|---|
| AC-1 (affordance on the header block) | S1, S2 | header block mounts `<NoteTags>` targeting `headerCoord(header)`; carries `subject="list"` | structure |
| AC-2 (targets the coordinate, never the id) | S1, U10 | the caller passes `{ address: headerCoord(header) }`; the built assertion carries `['a', 39998:…]` and **no** `e` tag | structure + unit |
| AC-3 (tagged header resolves for display, OPEN 306) | U7, U8, U9, S3, S4, S6, S7 | `(kind, author)` bucketing; real-kind map key; both views branch on `group.headers` and render link cards; the loop drops the literal `39999` | unit + structure |
| AC-4 (stance parity: own stance, retract, dispute) | S9 | the header goes through the same `NoteTags` (`applyTag` / `disputeTag`) machinery | structure |
| AC-5 (item/note/profile tagging unchanged) | R1–R7 | `itemCoord` guard, `NoteTags` signature, `listCoordOf`, `toTableItem`, both existing call sites, profile-tag `d`, `/for-tag` keys | unit + structure |
| AC-6 (no misleading group heading) | U1, U2, U3 | headers get their own leading group, never the orphan bucket; several headers share it in first-seen order | unit |

## Edge cases

| Edge case | Handle | How it is covered |
|---|---|---|
| **E1** header edited after tagging | U10 (proxy) | Not directly testable without a relay round-trip. The invariant that makes E1 true is "the target is the coordinate, not the id" — U10 asserts the `a`-only target. **Not covered:** the actual replace-and-refetch. |
| **E2** header that carries a parent `z` | U4, S8 | client: the kind rule wins, the header still lands in the headers group with `listCoord: null`; server: `listCoordOf` short-circuits `kind === 39998` to null |
| **E3** tagged header not on this relay | S5 | the "list not on this relay" notice is reachable from the headers branch; the card still shows the coordinate and a working `/list/` link |
| **E4** a 30394 whose member is a header coordinate | S6 | the Pinned Items leaf branches on `group.headers` and renders the same card, not `DListItemsTable` |
| **E5** a tag applied to both headers and items | U2, S3 | both groups render and "Lists" is **first**, even when the header arrives last in the input |
| **E6** signed-out viewer | — | **Not covered by a new handle.** Existing `NoteTags`/`useAuth` behaviour; R2 pins that `NoteTags` is unchanged, which is what makes E6 true for free. Browser-level check belongs to Gate B. |
| **E7** d-tag collision between a header and an item | U11 | a `39998:…:github-accounts-aaa` and a `39999:…:github-accounts-bbb` (same author, same asserter, same tag, `d16` identical) must yield **different** d-tags |
| **E8** no headers in the input | U5, U6 | output deep-equals the legacy two-group structure byte-for-byte; empty and `null` inputs still yield `[]` |

### Not derivable from any AC (J2 rubric 1)

- **U8** — the resolution bucketer must survive garbage members: an `e`-target member with no
  coordinate, a malformed address, a non-hex author, a `null`, and a `d` segment containing
  colons (`30023:<pk>:https://example.com/x:y`). No AC mentions these; a naive
  `split(':')[2]` refactor breaks the last one silently and mislabels long-form targets.
- **U6** — `groupItemsByList(null)` still returns `[]`.
- **R7** — `/for-tag`'s response keys are asserted unchanged; the story changes what
  `items[]` resolves to, and an accidental rename is the kind of breakage only a shape
  sentinel catches (external clients read `items[].kind`).

### Error paths for the external dependencies the design touches

- **strfry scan fails for one (kind, author) bucket** — the existing loop catches per-bucket
  and degrades to "unresolved" (`console.warn`). **Not covered by a new handle:** the loop
  has no injectable scan seam (see below); S7 pins the shape of the refactor, and the
  existing `try/catch` is inside the untouched wrapper. Flagged for the Reviewer at Gate B.
- **Header not on the relay** — covered, E3/S5.
- **Relay unreachable in the client header fetch** — `fetchListHeaders` already degrades to
  "not found" (its own lane, `dlist-item-tagging` suite). Not re-tested here.

## Two pure-function contracts specified for the Implementer

`src/api/event-tags/index.js` has **no injectable scan seam** in `handleForTag`'s
item-resolution loop (it calls `realScanStrfry` directly, shelling out to `strfry scan`), so
the new behaviour is pinned as two pure functions the Implementer must extract and export
alongside the existing exports:

```js
/** members[] (the /for-tag itemMembers array) → Map<`${kind}|${author}`, Set<dTag>>.
 *  One entry per scan the loop must issue. Members with no `address`, a malformed
 *  coordinate, or a non-hex author contribute nothing. `d` is everything after the
 *  SECOND colon, verbatim (it may contain colons). */
bucketMembersByKindAndAuthor(members)

/** a resolved event → `${kind}:${pubkey}:${d}`, or null when it has no `d` (or no event).
 *  This is the map key that replaces the literal `39999:${ev.pubkey}:${d}`. */
addressOf(event)
```

The loop then reads: bucket → one `strfryScan({ kinds: [Number(kind)], authors: [author], '#d': [...ds] })`
per entry → `itemEventByAddress.set(addressOf(ev), ev)`. Both functions are pure, sync, and
relay-free, so U7–U9 drive them directly. The suite `safeRequire`s the module, so a missing
export reports as a named failure rather than crashing the run.

## Test infrastructure

- Framework: Node built-in runner, house `module.exports = { run }` shape returning
  `{pass, fail, skipped, failures}`. Mirrors `test/trusted-list-raw-view.test.js`.
- ESM UI utils (`dlistHeaders.js`, `dlistFields.js`) are loaded via dynamic `import()`;
  a failed import reports as a named assertion, never a crash.
- **No live API, no relay, no graph state.** No `POST /api/firmware/install` prerequisite;
  nothing here needs the stack running. Control panel port for the repo is `:8778`
  (env `BRAINSTORM_BASE_URL`), unused by this suite.
- `hash8` in U10/U11 is the **real** SHA-256-first-8-hex closure the ADR specifies
  (`node:crypto`), deterministic and pinned. A *constant* stub would make E7's distinctness
  assertion vacuous — the hash segment is the only thing distinguishing the two coordinates.
- Fixtures: literal `items[]` rows (`headerRow()`, `itemRow()`) shaped exactly as
  `/api/event-tags/for-tag` returns them.

## How to run

```
{ timeout 120 env BRAINSTORM_BASE_URL=http://localhost:8778 direnv exec . node -e "require('./test/tag-a-list-header.test.js').run().then(r=>{console.log(r);process.exit(r.fail?1:0)})"; echo "EXIT=$?"; } 2>&1
```

Full gate (book close / promotion): `npm test`.

## Verification — pre-implementation

Run 2026-09-18 at commit `834c637f` (branch `feat/search-index-selection`), before any
implementation: **11 passed, 16 failed** (exit 1).

Failing (the feature does not exist yet): **U1, U2, U3, U4, U7, U8, U9, S1, S2, S3, S4, S5,
S6, S7, S8, S9**.
Passing by design: **R1–R7** (regression sentinels — they must be green now *and* after) and
**U5, U6, U10, U11** (invariant confirmations: E8's byte-identical no-header path, and the
Design note's claim that the ADR-0001 d-tag composes over a 39998 coordinate *unchanged* —
the story adds no builder work, so these pin a claim rather than await one).

```
  ✗ U1 (AC-6): a tagged list header gets its own leading group, never the orphan bucket
      ruling 2: a kind-39998 row must land in a group flagged `headers: true`, not in the "Items with no list" bucket
  ✗ U2 (AC-6, E5): the headers group comes FIRST, before every per-list group
      ruling 2: "Lists" first — the headers group leads
  ✗ U3 (AC-6): several tagged headers share one headers group, in first-seen order
      both headers must land in a headers group
  ✗ U4 (E2): a header that carries a parent `z` still groups under "Lists", not under that parent
      E2: kind 39998 beats a present listCoord — a header never renders as an item of its parent
  ✓ U5 (E8): with no headers in the input, the output is byte-identical to the legacy grouping
  ✓ U6 (E8): an empty input still yields an empty array of groups
  ✗ U7 (AC-3): bucketMembersByKindAndAuthor buckets a 39998 and a 39999 by the same author SEPARATELY
      src/api/event-tags/index.js must export bucketMembersByKindAndAuthor(members) — the (kind, author) bucketing the resolution loop scans from
  ✗ U8 (AC-3): bucketMembersByKindAndAuthor dedupes d-tags, keeps colons in `d`, and skips unusable members
      src/api/event-tags/index.js must export bucketMembersByKindAndAuthor(members)
  ✗ U9 (AC-3): addressOf keys a resolved event by its REAL kind, closing OPEN 306
      src/api/event-tags/index.js must export addressOf(event) — the `${kind}:${pubkey}:${d}` map key replacing the literal `39999:` prefix
  ✓ U10 (AC-2): tagging a header targets its COORDINATE — an `a` tag, never an event id
  ✓ U11 (E7): a header and an item whose `d` shares the first 16 chars get DIFFERENT d-tags
  ✗ S1 (AC-1, AC-2): the list page header block mounts NoteTags targeting the header coordinate
      AC-1: List.jsx must mount <NoteTags …> on the header block
  ✗ S2 (AC-1): the header affordance declares subject="list", distinguishing it from an item or a note
      AC-1: no <NoteTags … headerCoord(header) …> mount found in List.jsx
  ✗ S3 (AC-3, E5): the tag page Items view branches on the headers group
      AC-3: TagItemsView must branch on group.headers to render the "Lists" group differently
  ✗ S4 (AC-3): the tag page renders a tagged header as a link CARD (name + /list/ link), not a table row
      the card links to /list/<coord> so the header stays reachable
  ✗ S5 (E3): a tagged header that is not on this relay still renders, with a legible notice
      E3: the notice must be reachable from the headers branch — an unresolved header shows its coordinate and a working link, not a blank card
  ✗ S6 (E4, AC-3): the Pinned tab Items leaf renders the headers group the same way
      E4: PinnedListPanel must branch on group.headers — parity with the tag page for a 30394 whose member is a header coordinate
  ✗ S7 (AC-3): the server resolution loop derives the kind from the coordinate instead of assuming 39999
      AC-3 / OPEN 306: the item-resolution scan must use the coordinate's own kind, not a literal kinds: [39999]
  ✗ S8 (E2, server): the server-side listCoordOf returns null for a kind-39998 header
      E2: listCoordOf must short-circuit kind 39998 to null — a header has no parent list, so it can never be grouped under one
  ✗ S9 (AC-4): a header tagging goes through the same NoteTags stance machinery as an item tagging
      AC-4: the header uses the SAME component, so "mine", retract and dispute arrive with no new code
  ✓ R1 … ✓ R7   (regression sentinels — green before and after)
tag-a-list-header: 11 passed, 16 failed
EXIT=1
```

Every failure names the missing piece; none is an import or require error (the server module
and both ESM utils load cleanly today — U5/U6 and R1–R7 prove the loaders work).

## Not covered (explicit)

- The rendered pages in a browser (Gate B / Playwright); no Playwright spec is added.
- The relay round-trip: publishing a header tagging and reading it back (E1's replace path).
- The affordance on `/lists` index rows or concept pages (ruling 1 — follow-on).
- Headers declaring a parent concept (out of scope, story's note).
- Per-header applicability (ruling 4 — agnostic, nothing to test beyond R2).
- The `worth-indexing-for-search` tag's naming and authorship (design doc).
- The new CSS class for the header card (no style assertions).
