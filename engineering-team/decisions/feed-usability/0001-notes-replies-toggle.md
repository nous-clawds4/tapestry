# ADR 0001: "Notes" | "Notes + Replies" toggle — server-computed `isReply` on the shared item shape + client-side filtering

**Status:** Accepted
**Date:** 2026-07-03
**Story:** `engineering-team/stories/feed-usability/1-notes-replies-toggle.md`
**Epic:** `engineering-team/epics/feed-usability.md`

## Context

Two shipped surfaces render kind-1 notes and make **no** distinction between top-level
posts and replies:

- **`/feed`** — `ui/src/pages/BrainstormFeed.jsx`, hook `ui/src/hooks/useFeed.js`,
  pure `renderFeedState({ data, loading, error })` (`BrainstormFeed.jsx:62`). Consumes
  `GET /api/feed` (`src/api/feed/feedReadPath.js`, ADR `live-feed/0001`).
- **`/user/:pubkey/notes`** — `ui/src/pages/BrainstormUserNotes.jsx`, hook
  `ui/src/hooks/useUserNotes.js`, pure `renderUserNotesState(...)`
  (`BrainstormUserNotes.jsx:91`). Consumes `GET /api/user/:pubkey/notes?limit=`
  (`src/api/notes/userNotesReadPath.js`, ADR `note-surfaces/0001`).

Story 1's acceptance criteria, quoted to design against:

> - **Toggle present on both surfaces, defaulting to "Notes".** … a two-state control
>   labeled **"Notes"** and **"Notes + Replies"**, with **"Notes"** active by default …
> - **"Notes" mode filters replies.** … every entry shown is a top-level note and no
>   entry shown is a reply.
> - **"Notes + Replies" mode shows everything.** … both the top-level notes and the
>   replies (today's behavior) … **without a full page navigation**.
> - **Switching back re-filters.** … reply entries disappear, top-level entries remain,
>   still newest-first.
> - **Reply-only empty state.** … in "Notes" mode … an explicit on-page message that
>   there are no top-level notes to show … never a blank list with no explanation.
> - **Existing empty states unaffected.** … the pre-existing empty-state message still
>   shows as before.

### The one hard constraint the codebase imposes

Both surfaces render the **shared enriched item shape**, produced by the single shared
choke point `enrichNotes(notes, scanStrfry)` (`src/api/_shared/noteEnrichment.js:79`):

```
{ id, pubkey, createdAt, content, author: { displayName, avatar }, mentions }
```

`enrichNotes` builds a fresh object literal (`noteEnrichment.js:112-123`) that **discards
the raw event's `tags`** — so the NIP-10 `e`-tag markers that distinguish a reply from a
top-level note **never reach the client today.** Reply detection cannot be done on the
current item; it must be computed while the raw event is still in hand.

The raw kind-1 events **do** carry `tags` at fetch time and keep them right up to the
enrichment call: `fetchNotes` (`feedReadPath.js:165-180`) and `fetchAuthorNotes`
(`userNotesReadPath.js:143-156`) both push the full raw event, then hand it to
`enrichNotes`, which strips it. So the single place both surfaces already funnel through,
with tags still present, is `enrichNotes`.

There is **no existing reply-detection logic** anywhere (server or UI) to reuse or
contradict — confirmed by a full-codebase scan. The only trace is a forward-looking
comment in `NoteCard.jsx:17` naming a "reply indicator" as future per-note work that
*should live in `NoteCard`* so every surface inherits it at once — i.e. the codebase
already anticipates a per-item reply signal arriving on the shared item shape.

### Concepts touched

- `39998:<TA>:nostr-kind` — kind-1 (both notes and replies are kind-1; the distinction
  is an NIP-10 threading marker in `tags`, not a different kind), kind-0 (author display,
  already enriched locally).

No concept definition changes; no schema or property changes. This is a read-only
consumer that adds one derived boolean to an item shape. **No firmware reinstall.**

### Constraints (project)

- **Additive & read-only.** No writes/publishes; no change to search, ranking, tagging,
  or firmware. Adding a field to the enriched item is backward-compatible — `NoteCard`
  and every existing consumer ignore an unknown field.
- **JS-without-build; no new dependency, no lint/typecheck/build tooling.** Reply
  detection is a pure tag scan — no library needed.
- **Sentinel-testable UI.** UI is tested by source-regex sentinels + pure-render-helper
  unit checks under `test/test.js` (JSX doesn't transpile there). The design must keep
  filtering inside the existing pure `render*State` helpers, and expose the reply rule as
  a pure, executable server helper.

### Defining "reply" (flat, no threading)

Per NIP-10, a kind-1 is a response to another note when it carries an `e` tag that is a
`root`/`reply` marker, or (legacy positional form) an unmarked `e` tag. An `e` tag marked
`mention` is a quote/mention, **not** a reply. The story explicitly wants only the flat
distinction — no threading, no parent fetching. So the rule is:

> **`isReply` = the event has at least one `e` tag whose marker (4th element) is not
> `"mention"`.** Equivalently: `tags.some(t => t[0] === 'e' && t[3] !== 'mention')`.

This treats root/reply-marked and legacy unmarked `e` tags as replies and excludes
pure mentions. Quote-reposts that use only a `q` tag (NIP-18) and no `e` tag are treated
as **top-level** (they are quotes, not replies) — a deliberate boundary, noted in Out of
scope. Addressable (`a`-tag) replies to kind-1 are not a thing in practice and are out of
scope.

## Options considered

### Option A — Compute `isReply` in `enrichNotes`; filter client-side by the flag *(chosen)*

**Server:** add one derived field, `isReply`, to the item literal in `enrichNotes`
(`noteEnrichment.js:112-123`), computed from the raw event's `tags` by a small pure
helper `isReplyNote(tags)`. Because **both** read paths funnel through `enrichNotes`,
`/api/feed` and `/api/user/:pubkey/notes` both gain `isReply` from this **one** change —
no per-path edits, identical semantics on both surfaces.

**Client:** each page owns a `useState('notes' | 'all')` (default `'notes'`) and renders
the existing `SortToggle` (`ui/src/components/SortToggle.jsx`) with options
`[{key:'notes',label:'Notes'},{key:'all',label:'Notes + Replies'}]`. The `mode` is passed
into the pure render helper (`renderFeedState`/`renderUserNotesState`), which **filters
`items` by `isReply` before mapping to `NoteCard`** and handles the reply-only empty
state. Switching mode is pure client state → an **instant re-render, no refetch, no page
navigation.**

- **Pros:**
  - **One server change covers both surfaces** — the shared `enrichNotes` is the exact
    choke point, and `NoteCard.jsx:17` already anticipates a per-item reply signal here.
  - **Purely additive & zero-risk.** Adds a field; changes no existing field. Every
    current consumer ignores it. The shipped read paths and `NoteCard` are untouched in
    behavior.
  - **Instant toggle, no refetch** — trivially satisfies "without a full page
    navigation" and the switch-back criterion; the flag travels with the item.
  - **Composes with Story 2 (pagination) for free.** Every loaded item carries
    `isReply`, so "Load more in Notes mode" is just more flagged items the client keeps
    filtering — Story 2 can later add server-side over-fetch/param tuning without
    reworking this.
  - **Sentinel-testable.** `mode` enters the pure render helper (unit/sentinel-testable);
    `isReplyNote(tags)` is a pure exported function with direct execution tests.
- **Cons:**
  - In **Notes** mode the fetched batch (≤50 mixed) is filtered *after* the cap, so a
    reply-heavy source shows **fewer than 50** top-level entries. Accepted for Story 1 —
    the cap-efficiency fix (over-fetch / server param) and the truthful window indicator
    are **explicitly Story 2's scope** (see the epic's `#1 before #2` dependency note).
    Story 1 only owns *the distinction*, not exhaustiveness.

### Option B — Server-side filtering via a query param (`?include=notes|all`)

Add an `include` param to both read paths; the server filters raw kind-1 by `isReply` and
caps to N of the requested type; toggling refetches with the other value.

- **Pros:** clean cap semantics (always up to N of the requested type); truthful counts.
- **Cons (decisive for Story 1):** touches **both** read-path modules **and** both hooks
  (add param plumbing), turns an instant client toggle into a **refetch** on every switch,
  and — because relays can't filter "has no `e` tag" — forces an **over-fetch** decision
  (fetch more than N raw to yield N top-level) that is exactly the pagination/cap-cursor
  problem **Story 2 owns**. Pre-empting it here couples Story 1 to Story 2's unresolved
  cursor design and enlarges the change surface for no Story-1 requirement. Deferred: if
  Story 2 later needs server-side filtering for cap efficiency, it adds `include` then,
  on top of the `isReply` field this ADR establishes.

### Option C — Carry raw `tags` through `enrichNotes`; detect replies in the browser

Have `enrichNotes` pass the raw `tags` array onto the item; the client computes `isReply`.

- **Cons (decisive):** ships every note's full tag array to the browser (larger payload,
  leaks event internals the UI has no other use for) and **scatters the NIP-10 rule into
  front-end code** — where it can't be unit-tested under the Node `test/test.js` harness
  and would drift between the two surfaces. Computing the one boolean once, server-side,
  in the shared enrichment is strictly cleaner and matches the `NoteCard.jsx:17`
  intent. Rejected.

## Decision

**Option A.** Compute a single derived boolean `isReply` from the raw event's NIP-10 `e`
tags inside the shared `enrichNotes` (via a pure `isReplyNote(tags)` helper), so both
`/api/feed` and `/api/user/:pubkey/notes` items carry it from one change. The toggle is
client-only page state driving the existing `SortToggle`; the pure render helpers filter
`items` by `isReply` (default **Notes** = top-level only) and render the reply-only empty
state. Switching is an instant, refetch-free re-render.

We accept that Notes mode shows fewer than 50 entries on reply-heavy sources (filtering
happens after the existing cap); making the count exhaustive/truthful and the over-fetch
belong to **Story 2 (pagination)**, per the epic's stated `#1 before #2` dependency. We
reject the server-param approach (Option B) as premature coupling to Story 2's cursor
design, and the carry-tags-to-client approach (Option C) as leaky and untestable.

## Consequences

- **Enables:** the toggle on both surfaces with one shared server field; Story 2 inherits
  `isReply` on every paginated item; a future `NoteCard` reply badge (the
  `NoteCard.jsx:17` earmark) can read the same field.
- **Constrains:** `isReply` becomes part of the shared item contract — Story 2 and any
  future note surface can rely on it; changing the reply rule changes both surfaces at
  once (desirable — one definition).
- **New debt / follow-ups:** the **Notes-mode-shows-<50** artifact and the **window
  indicator** ("Showing the most recent 50 notes.") being literally true only in
  "Notes + Replies" mode are handed to Story 2. Story 1 leaves the indicator copy as-is
  (it is not in Story 1's ACs); Story 2 makes it reflect what's actually shown.
- **Build/deploy:** Vite `/dist` rebuild (`npm run build` in `ui/`) for the UI changes —
  the existing build step, no new tooling. Server change is a plain module edit.
- **Firmware reinstall required?** **No.** No concept/schema/property change — one derived
  boolean added to a read-time item shape.

## Implementation notes

Concrete targets for the Implementer.

### Server — one shared change

- **Edit: `src/api/_shared/noteEnrichment.js`.**
  - Add a pure helper (exported for tests):
    ```js
    // NIP-10: a kind-1 is a reply if it carries an `e` tag that is not a pure mention.
    // Root/reply-marked and legacy unmarked `e` tags count; `mention`-marked `e` tags
    // and quote-only (`q`) notes do not. Flat distinction only — no threading.
    function isReplyNote(tags) {
      if (!Array.isArray(tags)) return false;
      return tags.some(t => Array.isArray(t) && t[0] === 'e' && t[3] !== 'mention');
    }
    ```
  - In the `notes.map(...)` result literal (`:112-123`), add `isReply: isReplyNote(n.tags)`.
    `n` is the raw event (still carrying `tags` at this point); default to `[]` safely via
    the helper's guard.
  - Extend `module.exports` with `isReplyNote`.
  - **Do not** otherwise change the item shape or any existing field. Both read paths
    (`feedReadPath.js:211`, `userNotesReadPath.js:182`) call `enrichNotes` unchanged and
    inherit `isReply` automatically — **no edits to either read-path module.**

### Client — the toggle on each surface

- **Edit: `ui/src/pages/BrainstormFeed.jsx`.**
  - `import { useState } from 'react';` and `import SortToggle from '../components/SortToggle';`
  - In `BrainstormFeed()`: `const [mode, setMode] = useState('notes');`
  - Add module-level copy: extend `FEED_COPY` with
    `REPLY_ONLY: 'No top-level notes to show — switch to "Notes + Replies" to see replies.'`
    (punctuation non-binding).
  - Render the toggle above the list (only where notes could appear — i.e. inside the
    `OK` path or just above `renderFeedState`'s output when `status==='OK'`). Simplest:
    pass `mode`/`setMode` into the render helper OR render `SortToggle` in the component
    body immediately before `renderFeedState(...)` and pass `mode` in. Keep the toggle out
    of the `NO_SOURCE`/`FOLLOW_LIST_UNAVAILABLE`/`EMPTY` states (no notes exist there).
  - Change the pure helper signature to `renderFeedState({ data, loading, error, mode })`.
    In the `OK` branch:
    ```js
    const all = data.items || [];
    const items = mode === 'all' ? all : all.filter(it => !it.isReply);
    if (all.length > 0 && items.length === 0) {
      return <div className="bsp-empty">{FEED_COPY.REPLY_ONLY}</div>; // reply-only in Notes mode
    }
    // …then the indicator + items.map(NoteCard) as today, in array order (no re-sort)
    ```
  - `SortToggle` props: `options={[{key:'notes',label:'Notes'},{key:'all',label:'Notes + Replies'}]}`,
    `value={mode}`, `onChange={setMode}`, `ariaLabel="Filter notes"`,
    `className="bsp-feed-filter"`.

- **Edit: `ui/src/pages/BrainstormUserNotes.jsx`.** Same shape:
  - `const [mode, setMode] = useState('notes');`
  - Extend `NOTES_COPY` with `REPLY_ONLY: 'No top-level notes to show — switch to "Notes + Replies" to see replies.'`
  - Render `SortToggle` (className `"bsp-notes-filter"`) above the list; pass `mode` into
    `renderUserNotesState({ data, loading, error, mode })`; filter identically in its `OK`
    branch, with the same reply-only empty-state guard. The existing `EMPTY` /
    defensive branches (`BrainstormUserNotes.jsx:96-101`) are untouched.

- **Styles: `ui/src/styles.css`** — the `bs-sort-toggle` / `bs-sort-toggle-btn` classes
  already exist (used by `/tag`, `/tags`, tagging activity). Add only per-page namespace
  wrappers if visual scoping is needed (`.bsp-feed-filter`, `.bsp-notes-filter`), mirroring
  `SortToggle`'s documented `className` convention (`SortToggle.jsx:3-10`). No new control.

- **No change to** `useFeed.js` / `useUserNotes.js` (no new fetch/param — filtering is
  client-side), `NoteCard.jsx`, the two read-path modules, routes, or auth.

### Testability

- **Server:** unit-test `isReplyNote(tags)` directly — unmarked `e` → true; `reply`/`root`
  marker → true; `mention`-only `e` → false; `q`-only (no `e`) → false; `[]`/non-array →
  false. Add an `enrichNotes` assertion that the returned item includes `isReply` and that
  it matches the helper for a mixed input. (Node `test/test.js` runner, in-memory notes;
  no live relays/strfry.)
- **Client (sentinels + pure helper):** sentinel that each page renders `SortToggle` with
  the two labels and defaults `mode` to `'notes'`; unit-call `renderFeedState` /
  `renderUserNotesState` with a mixed `items` array and assert `mode:'notes'` drops
  `isReply` items, `mode:'all'` keeps them, and an all-replies input in `'notes'` mode
  yields the `REPLY_ONLY` copy (not the list, not a blank).
- **Rendered-UI confirmation** (browser) per the epic's deploy posture: on the local
  stack (`cycle-local`, `:7778`) toggle both surfaces and confirm replies hide/show and
  the reply-only message appears when appropriate — a capstone, gathered before review per
  house feedback ("always cycle-local before review").

## Out of scope

- **Pagination / "Load more" and the truthful window indicator / over-fetch** — Story 2
  (`feed-usability` #2). Story 1's Notes mode may show <50 entries; that is Story 2's to
  refine.
- **The profile "Content" card's pinned/latest selection** — Story 3 (`feed-usability` #3;
  it uses a different hook, `useNotesByAuthor.js`).
- **Threading UI, "in reply to" context lines, parent fetching, a `NoteCard` reply badge**
  — the flag is computed but not visually rendered on the card here.
- **Quote-repost (`q`-tag) classification, `a`-tag replies** — treated as top-level /
  ignored; revisit only if a surface needs the distinction.
- **Persisting the toggle choice** across sessions/devices (epic-level out of scope).
- Any write/publish; any change to search, ranking, tagging, or firmware.
