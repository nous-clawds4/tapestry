# ADR 0002: Extract the author-display helper into a pure shared util

**Status:** Accepted
**Date:** 2026-09-09
**Story:** `engineering-team/stories/graph-curation-ui/2-restore-add-node-as-element-page.md`

## Context

`ui/src/pages/concepts/AddNodeAsElement.jsx` fails to render. Confirmed live on `:7778`
(owner session, populated graph): the route is replaced by react-router's default error
element with `TypeError: _?.get is not a function`.

**Cause, verified.** `ui/src/hooks/useProfiles.js:12` holds its state as `useState({})` and
`:74` returns that plain object. `AddNodeAsElement.jsx:56` reads it as a `Map`:

```js
const p = authorDropdownProfiles?.get(pk);   // objects have no .get
```

Optional chaining does not protect this: `{}` is truthy, so `.get` is looked up and invoked.
The throw happens inside `authorOptions.map(...)` rendering the author `<select>`, so it fires
on any graph with at least one `NostrEvent.pubkey` — i.e. always. There is no partial render.

**Scope of the defect — bounded.** Line 56 is the *only* bad read. The page's second profile
consumer, `AddNodeAsElement.jsx:369`, hands the map to `<AuthorCell profiles={profiles} />`,
and `ui/src/components/AuthorCell.jsx:24` reads `profiles?.[pubkey]` — correct. Fixing line 56
therefore restores the page; it does not uncover a second crash.

**The contract question.** `useProfiles`' own JSDoc (`:8`) promises
`Map<pubkey, {...} | null>`, which is false. Of ~38 call sites in `ui/src`, exactly one —
`AddNodeAsElement.jsx:56` — uses `.get(`. Every other consumer, including the shared
`AuthorCell`, uses object subscript. The load-bearing contract is **plain object**; the
docstring is the outlier, and it is the proximate invitation to this bug.

**The duplication.** `ui/src/pages/nodes/Index.jsx:57-65` carries an `authorDisplayName` that
is byte-identical to `AddNodeAsElement.jsx:55-63` except for that one access:

```
<     const p = authorDropdownProfiles?.get(pk);
>     const p = authorDropdownProfiles?.[pk];
```

Two copies of one function, silently divergent, one of them fatal. That is the defect's real
shape, and it is what should inform the fix.

**Test-harness constraint (shapes this decision).** There is no jsdom or testing-library in
this repo. Per ADR `graph-curation-ui/0001` and the pattern in `test/event-page-ui.test.js:10-16`,
UI work is verified by *source-level* assertions over JSX plus *executed* pure ESM utils
(`ui/src/utils/placement.js`, `ui/src/utils/eventParam.js`). A React component cannot be
mounted here. So "the page renders" is only genuinely testable if the throwing logic lives
somewhere the runner can execute.

**Concept orientation.** Per AGENTS.md §2–3: `/api/concept-graph/summaries` (63 concepts),
then `/neighbors` on `39998:<TA>:concept-header` and its superset. The story's concepts —
`concept-header`, `firmware-concept`, `nostr-relay` — exist and are unchanged by this work.
**No concept definition changes → no firmware reinstall.**

**ADR conflict check.** Builds alongside `graph-curation-ui/0001` (shared component + pure-util
pattern; nothing superseded) and leaves `relationship-primitives/0001`'s server contract
untouched — this story makes no server-side change. ADR 0015's `LEGACY_*` exception is not
engaged: the TA pubkey here comes from `useConfig()` at runtime and is only compared, never
composed into a handle.

## Options considered

### Option A — One-line subscript fix in place

Change `AddNodeAsElement.jsx:56` to `authorDropdownProfiles?.[pk]`. Nothing else moves.

**Pros:** smallest possible diff; no new files; unarguably correct; zero regression surface
outside the broken page.
**Cons:** leaves the two byte-divergent copies of `authorDisplayName` in the tree — the exact
configuration that produced this bug — with nothing preventing the next divergence. Worse for
this project: the Tester's only available assertion is source-level, e.g. "the file no longer
contains `.get(`". That is a proxy, not a test. It would pass against a differently-broken
rewrite and fail against an unrelated `.get(` elsewhere in the file. The story's central
criterion would ship unverified by anything executable.

### Option B — Extract `authorDisplayName` into a pure shared ESM util *(chosen)*

New `ui/src/utils/authorDisplay.js` exporting a pure `authorDisplayName({ profiles, pubkey,
ownerPubkey, taPubkey, davePubkey })`. Both `AddNodeAsElement.jsx` and `nodes/Index.jsx` drop
their local copies and import it. The util reads `profiles?.[pubkey]` — one implementation,
one access pattern.

**Pros:** the bug is fixed *by construction* and cannot re-diverge, because there is one
function instead of two. The Tester gets an **executed** unit test — call it with a plain
object and assert it returns the display name instead of throwing — which is the harness's
proven pattern and this epic's own ADR 0001 sub-decision. The owner / TA / Dave badge logic
(👑 / 🤖 / 🧑‍💻, name-vs-truncated-pubkey fallback) becomes genuinely testable for the first
time; today it is untested in both copies.
**Cons:** touches `nodes/Index.jsx`, a page that currently works — a regression surface the
story did not ask for. One new shared util. Diff is larger than one character.

### Option C — Make `useProfiles` return a real `Map`

Honor the JSDoc: return `new Map(...)`. `.get()` then becomes correct.

**Pros:** the docstring stops lying; the crash disappears with no call-site edit on the broken
page.
**Cons:** rejected outright. ~37 other call sites read the result by subscript, including the
shared `AuthorCell` used across the concepts, lists, users, grapevine and shared-concepts
pages. This converts one broken page into roughly thirty-seven, to satisfy a comment. The
comment is what is wrong.

## Decision

**Option B**, with three sub-decisions:

1. **`ui/src/utils/authorDisplay.js` is pure and dependency-free** — no React, no
   `useConfig`, no import of `config/pubkeys`. Every identity it compares against arrives as a
   parameter. This is what makes it executable in the Node runner (per `eventParam.js`), and it
   keeps the CLAUDE.md rule intact: the caller resolves the TA pubkey at runtime and passes it
   in; the util never knows a literal.
2. **Both call sites adopt it.** Deduplication is the point — wiring only the broken page would
   leave the divergence that caused this.
3. **Correct the `useProfiles` JSDoc** (`:8`) to state that it returns a plain object keyed by
   pubkey. It is one line, it is the thing that invited the bad copy-paste, and leaving it
   would mean the next reader is misled by a docstring we knowingly left false.

The breadcrumb rename (`'Add Node'` → `'Add Node as Element'`, `App.jsx:254`) rides this ADR
per the story's sixth criterion. It is a label, independent of the above.

**What we trade away:** a one-character fix becomes a five-file change (one new util, two
pages, one docstring, one route label) — including one page that isn't broken. We accept that in exchange for the story's main criterion being provable by
an executed test rather than a source-grep, and for the duplication being gone rather than
merely half-corrected.

## Consequences

- **Enables:** an executed test over the display logic, replacing an unverifiable source-level
  proxy; one implementation of author display for future surfaces to reuse.
- **Constrains:** `nodes/Index.jsx` now depends on a shared util. Its author dropdown is a
  regression surface — the Tester must carry a sentinel over it, since the story's acceptance
  criteria only name the concepts page.
- **Follow-up debt:** `useProfiles`' object-vs-Map contract is corrected in prose only. Any
  future move to a real `Map` remains a ~38-site change and would need its own ADR. Recorded,
  not scheduled.
- **Does not fix:** `graph-curation-ui` #3 (`OPEN.md` row 224), a separate counting defect on a
  different page. Kept apart deliberately.
- **Deploy note:** the container serves the built bundle, so these changes require
  `cd ui && npm run build` before they are visible on `:7778`. Source edits alone are live for
  the server, not the UI.
- **Firmware reinstall required?** **No.** No concept definition changes.

## Implementation notes

- **New file: `ui/src/utils/authorDisplay.js`** — pure ESM, no imports. Export
  `authorDisplayName({ profiles, pubkey, ownerPubkey, taPubkey, davePubkey })`. Behavior is
  the existing function's, preserved exactly: look up `profiles?.[pubkey]`; take
  `p?.name || p?.display_name`; build `short = pubkey.slice(0, 8) + '…'`; return the owner
  (`👑`), Dave (`🧑‍💻`) and assistant (`🤖`) badge forms for matching pubkeys and
  `` `${name} (${short})` `` or bare `short` otherwise. Tolerate a missing/empty `profiles` and
  unmatched identity params without throwing.
- **`ui/src/pages/concepts/AddNodeAsElement.jsx:55-63`** — delete the local
  `authorDisplayName`; import the util and call it, passing `ownerPubkey` and `taPubkey` from
  the existing `useConfig()` destructure (`:14`) and `DAVE_PUBKEY` from the existing import
  (`:10`). This is where the crash lives; line 56 goes away with the function.
- **`ui/src/pages/nodes/Index.jsx:57-65`** — same replacement. Behavior must not change.
- **`ui/src/hooks/useProfiles.js:8`** — correct the JSDoc return type to a plain object keyed
  by pubkey.
- **`ui/src/App.jsx:254`** — `handle: { crumb: 'Add Node' }` → `'Add Node as Element'`. The
  route path (`elements/add-node`) is **not** changed: it is linked from
  `ConceptElements.jsx` and from three places in `AddNodeReview.jsx` (`:89`, `:134`, `:256`),
  and renaming a working route is gratuitous churn the story did not ask for.
- **No server-side change.** `POST /api/normalize/add-node-as-element`
  (`src/api/normalize/index.js:3824`) is untouched and working.

## Out of scope

- Migrating `useProfiles` to a real `Map` (Option C) — rejected above; would need its own ADR.
- The element-counter defect — `graph-curation-ui` #3.
- Bulk / multi-select adding on the restored page — the story defers it, and this ADR adds no
  affordance for it.
- Any change to the route path `elements/add-node`, or to the confirm-step endpoint.
- The other findings from the same session: `OPEN.md` rows 219, 220, 221, 223.
