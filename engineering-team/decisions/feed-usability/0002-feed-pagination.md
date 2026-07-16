# ADR 0002: "Load more" pagination — an `until` relay cursor, accumulating hooks, and react-virtuoso windowing

**Status:** Accepted
**Date:** 2026-07-03
**Story:** `engineering-team/stories/feed-usability/2-feed-pagination.md`
**Epic:** `engineering-team/epics/feed-usability.md`
**Depends on:** `feed-usability/0001` (the `isReply` flag + client-side toggle filtering this must compose with)

## Context

Both feed surfaces hard-cap at the 50 most-recent notes with no way further back:

- **`/feed`** — `ui/src/pages/BrainstormFeed.jsx` → `useFeed()` → `GET /api/feed`
  (`src/api/feed/feedReadPath.js`, `buildFeed`, `FEED_CAP = 50`,
  `fetchNotes(followPubkeys, relays, querySync)` at `feedReadPath.js:165`).
- **`/user/:pubkey/notes`** — `ui/src/pages/BrainstormUserNotes.jsx` →
  `useUserNotes(pubkey, 50)` → `GET /api/user/:pubkey/notes?limit=`
  (`src/api/notes/userNotesReadPath.js`, `buildUserNotes`,
  `fetchAuthorNotes(pubkey, limit, relays, querySync)` at `userNotesReadPath.js:143`).

Both fetch kind-1 from the general-purpose relays via `SimplePool.querySync(relays, filter)`,
enrich through the shared `enrichNotes` (now carrying `isReply` from ADR 0001), and render a
plain `items.map(<NoteCard>)` inside a pure `render*State` helper.

Story 2's acceptance criteria, quoted to design against:

> - **Control appears when there may be more** — a "Load more" at the end of the list on both pages.
> - **Loading appends older notes, in order, without duplicates** — strictly-older batch appended, list stays newest-first, no note twice.
> - **Composes with the toggle** — Notes mode appends only top-level; Notes+Replies appends both; switching after loading still honors ADR 0001's filtering.
> - **Exhaustion is signalled** — an explicit end-of-history message; no dead "Load more".
> - **Loading state is visible** — the control shows in-progress; repeated activation while loading makes no duplicates.
> - **Bounded live content under sustained loading** — after many batches, the count of **fully rendered note entries held live stays under a fixed bound** (far-off-screen content released, **restored** on scroll-back); page stays responsive.
> - **Window indicator stays truthful** — reflects what is actually shown, not a stale fixed "50".

### What the codebase already gives us

- **Load-more precedent:** `ui/src/hooks/useTagIndex.js` — accumulates `rows` across pages,
  `offset === 0 ? replace : append`, a `liveSeqRef` guard against stale completions, and a
  `loadMore()` that no-ops while loading or exhausted. We mirror its **shape** (state machine,
  guards) but swap **offset** for a **time cursor** (see below), because relays paginate by
  `until`, not offset.
- **Relay cursor:** `querySync(relays, filter)` passes the filter straight to nostr relays,
  which honor NIP-01 `until` (return events with `created_at <= until`). No `until` is used
  anywhere yet — this ADR introduces it.
- **The reply flag:** every enriched item already carries `isReply` (ADR 0001); filtering is
  client-side at render time. Pagination must not disturb that.

### Constraints

- **Additive & read-only.** No writes; no change to search, ranking, tagging, or firmware.
  Server change is one optional param on two read paths; the four/three-outcome contracts and
  item shape are unchanged.
- **Composes with ADR 0001.** Reply filtering stays client-side; the cursor must walk **raw**
  notes (pre-filter) so Notes mode and Notes+Replies share one fetch stream.
- **Vite-built UI.** Adding a UI runtime dependency is normal here (the UI already ships
  `react-router-dom`, `nostr-tools`, `vis-network`, `uuid`, `jsonjoy-builder`). This ADR is the
  explicit approval for one more. No server dependency, no lint/build tooling (CLAUDE.md).
- **Best-effort history.** Relays are best-effort (the parent epics' posture); the story
  requires **honest exhaustion signalling**, not exhaustive retrieval.

## Options considered

The design has three semi-independent parts. Parts 1–2 (server cursor, accumulating hook) have
one sensible shape each (dissenting alternatives noted inline). Part 3 (bounded rendering) is
the real fork.

### Part 1 — Server pagination cursor: `until` (chosen) vs. `offset`

Add an optional **`until`** (Unix seconds) to `buildFeed`/`buildUserNotes`, threaded into the
relay filter: `{ kinds:[1], authors, until, limit: 50 }`. Relays return the 50 newest events
**at or before** `until`; the client dedups by `id` (so the boundary note, which reappears at
`created_at === until`, is dropped). Stateless: each "load more" is one more request for notes
older than the oldest one the client holds.

- *Rejected — `offset`:* nostr relay filters have **no offset**. Emulating it (fetch N, skip
  M) means re-fetching and re-discarding the whole prefix every page — O(pages²) relay traffic
  and fragile under a moving head. `until` is the native, O(1)-per-page cursor. `useTagIndex`
  uses offset only because *its* backend (`/api/tags/index`) is an offset store; relays are not.

### Part 2 — Client accumulation: cursor in the hook (chosen) vs. in the page

Rewrite `useFeed`/`useUserNotes` to **accumulate** (mirroring `useTagIndex`'s machine):

- State: `items` (accumulated enriched notes, **raw/pre-filter** — filtering stays at render),
  `status`/`relaySource` (from the first page), `loading` (initial), `loadingMore`, `error`,
  `exhausted`, and a `cursor` = the **minimum `created_at`** across all accumulated items.
- **Initial load:** fetch with no `until` → set `items`, `status`, `cursor`.
- **`loadMore()`:** guard (`loading || loadingMore || exhausted`) → fetch with
  `until = cursor` → **dedup by `id`** against held items, append the genuinely-new ones,
  recompute `cursor`. If **zero new items** survive dedup → set `exhausted` (best-effort end
  of history). A `liveSeqRef`/`cancelled` guard drops stale completions and prevents the
  "repeated activation while loading → duplicates" failure (AC 5).
- Return `{ status, items, relaySource, loading, loadingMore, error, exhausted, loadMore }`.
  `useFeed` stays zero-arg (source resolved server-side); `useUserNotes(pubkey, limit)` keeps
  its signature (limit is the page size, still 50).

Exhaustion is defined at the **raw-fetch** level (a page yielding no new raw notes), which is
honest for both modes: when raw history ends, there are no more top-level notes either. (Edge:
a page that returns raw notes but, in Notes mode, zero new *visible* top-level ones is **not**
exhaustion — the button stays; the reader loads again. An auto-continue-until-one-visible loop
is a deferred enhancement, out of scope, to avoid unbounded fetching.)

- *Rejected — cursor/accumulation in the page component:* spreads fetch orchestration and the
  dedup/stale-guard into the view, duplicated across both pages, and defeats the pure-render
  testability the parent epics rest on. The hook is the established home (`useTagIndex`).

### Part 3 — Bounded live content (the real decision)

AC "bounded live content" requires **windowed virtualization**: render only a viewport-sized
window of `NoteCard`s, release far-off-screen ones, restore them on scroll-back, with
**variable-height** cards (note text length varies) and **window-level scroll** (the page
scrolls, not an inner box).

#### Option 3A — `react-virtuoso`, window-scroll mode *(chosen)*

`<Virtuoso useWindowScroll data={filteredItems} itemContent={(i, item) => <NoteCard item={item} />}
components={{ Footer }} />`. Virtuoso measures variable heights, keeps the mounted DOM bounded
by construction (restoring on scroll-back), anchors scroll position, and gives a **Footer slot**
for the "Load more" button / spinner / end-of-history message (an explicit button — we do **not**
wire `endReached`, honoring "Load more is an explicit control, not infinite scroll").

- **Pros:** purpose-built for exactly this AC; variable-height + scroll-anchoring correctness
  (the hard part) is the library's job; window-scroll fits the existing page layout with no
  scroll-container restructure; the Footer slot cleanly hosts the load-more/exhaustion states;
  least custom code for a feature whose entire point is "stay fast and correct while scrolling."
- **Cons:** the UI's first virtualization dependency (react-virtuoso 4.x, MIT, React 19-compatible).
  Accepted via this ADR. Rendering moves from `items.map` to `<Virtuoso itemContent>` — which
  **invalidates two shipped `items.map` sentinels** (see Consequences → test updates).

#### Option 3B — Hand-rolled `IntersectionObserver` slot windowing (no dependency)

A `LazyNoteSlot` mounts its `NoteCard` when near the viewport and swaps to a same-height spacer
`<div>` when far, via a shared `IntersectionObserver` with `rootMargin` hysteresis.

- **Pros:** zero dependency (house minimalism).
- **Cons (decisive):** we own variable-height measurement, observer-thrash hysteresis, and
  scroll-anchor preservation — a well-known footgun. For a feature defined by "stay fast while
  scrolling," betting correctness on hand-rolled windowing is the riskier engineering call and
  the likeliest thing a reviewer/QA bounces. Rejected in favor of a maintained library.

#### Option 3C — `@tanstack/react-virtual` (headless, tiny)

`useWindowVirtualizer` with dynamic `measureElement`; we render the spacer + absolutely-positioned
rows ourselves.

- **Pros:** smaller footprint than virtuoso.
- **Cons:** more manual wiring (positioning, the Footer/load-more, measurement plumbing) for the
  same outcome; more surface for us to get wrong than virtuoso's batteries-included Footer +
  window-scroll. A reasonable middle ground, but virtuoso minimizes *our* code, which is the
  point of taking a dependency at all.

**Operator decision (2026-07-03):** Option **3A — react-virtuoso**.

## Decision

**Server:** add an optional `until` cursor to `buildFeed`/`buildUserNotes`, threaded into the
relay filter; handlers read it from `req.query.until`. **Client:** accumulate pages in
`useFeed`/`useUserNotes` (cursor = oldest `created_at`, dedup by `id`, `loadMore`/`loadingMore`/
`exhausted`, stale-guarded), mirroring `useTagIndex`. **Reply filtering stays client-side** and
walks the raw stream, composing with ADR 0001. **Rendering** moves to **react-virtuoso** in
window-scroll mode with a Footer hosting the explicit "Load more" button, the loading state, and
the end-of-history message. The stale fixed indicator becomes a **truthful live count**.

We trade one UI dependency (react-virtuoso) and the update of two `items.map` sentinels for
correct, low-risk variable-height windowing; and a little redundant per-page relay work (the
feed re-resolves follows + relay set each page — cheap, stateless) for a stateless server.

## Consequences

- **Enables:** reading arbitrarily far back on both surfaces while the rendered DOM (and so the
  browser) stays bounded; Story 1's toggle composes unchanged (filtering is still client-side
  over the now-larger accumulated stream).
- **Constrains:** the `until` param + accumulating-hook return shape become the contract the
  pages depend on. `Virtuoso`/`NoteCard`/`loadMore` are components/callbacks passed into the
  still-pure `render*State` helper (no fetch/auth/router/browser globals inside it), preserving
  the parent epics' testability rule.
- **Required test updates (shipped suites, flagged for Test Design):** moving from `items.map`
  to `<Virtuoso itemContent>` **breaks two existing sentinels** —
  `test/live-feed-feed-page.test.js:122` (T4, "OK branch renders `items.map`") and
  `test/note-surfaces-ui.test.js:180` (notes page "one entry per note via `items.map`"). The
  Tester must re-point these at the virtualized render (assert `<Virtuoso`/`itemContent` →
  `<NoteCard item={item}`). The `<NoteCard item={item}` sentinels (live-feed T24:446,
  note-surfaces:172) still hold if `itemContent` renders the card. The profile Content section
  (`note-surfaces-ui.test.js:99-100`, "single note, **no** `.map`") is **untouched** — Story 3's
  card is not virtualized.
- **New debt / follow-ups:** (a) auto-continue-until-one-visible in Notes mode (deferred);
  (b) the feed re-resolves its follow list per page (correct, mildly redundant — optimize only
  if measured); (c) `react-virtuoso` is now a shared UI dep future long lists can reuse.
- **Firmware reinstall required?** **No.** No concept/schema/property change; reads existing
  kind-1/kind-0 and the existing relay set.

## Implementation notes

Concrete targets for the Implementer.

### Server — the `until` cursor (both read paths)

- **`src/api/feed/feedReadPath.js`:**
  - `fetchNotes(followPubkeys, relays, querySync, until)` — add `until` to the filter only when
    set: `const filter = { kinds:[1], authors: followPubkeys, limit: FEED_CAP }; if (until) filter.until = until;`
    Keep the existing kind-1/followed-author/dedup/sort/`slice(0, FEED_CAP)`.
  - `buildFeed(options)` — read `until` (coerce to a positive integer; ignore junk) and pass it
    to `fetchNotes`. All four outcomes unchanged; on a load-more the source/follow resolution is
    re-run (stateless) and yields `OK`/`EMPTY` as before.
  - `handleGetFeed` — `buildFeed({ sessionPubkey: req.session?.pubkey, until: req.query.until })`.
- **`src/api/notes/userNotesReadPath.js`:**
  - `fetchAuthorNotes(pubkey, limit, relays, querySync, until)` — same optional-`until` addition
    to `{ kinds:[1], authors:[pubkey], limit }`.
  - `buildUserNotes(options)` — read/coerce `until`, pass through.
  - `handleGetUserNotes` — `buildUserNotes({ pubkey: req.params.pubkey, limit: req.query.limit, until: req.query.until })`.
  - Keep `clampLimit` (page size stays 50; out of scope to change the initial batch).
- Both keep the **injectable-deps seam** (`deps?.querySync ?? …`) so the Tester drives paging
  with an in-memory `querySync` fake that honors `until`.

### Client — accumulating hooks (mirror `useTagIndex`)

- **`ui/src/hooks/useFeed.js`** and **`ui/src/hooks/useUserNotes.js`** — convert from one-shot to
  accumulating:
  - Add state `items`, `cursor`, `loadingMore`, `exhausted` alongside the existing `status`/
    `error`/`loading`. `data` handed to the page becomes `{ status, items, relaySource }` (status
    from page 1; `items` accumulates) so the pure `render*State` helpers keep reading
    `data.status`/`data.items`.
  - `loadMore()` (a `useCallback`): guard `if (loading || loadingMore || exhausted) return;`;
    `fetch(<endpoint>?…&until=${cursor})`; on success dedup incoming by `id` vs held ids, append
    new, recompute `cursor = min(created_at)`; if no new items → `setExhausted(true)`. Use a
    `liveSeqRef` + `cancelled` guard exactly like `useTagIndex` (no stale stomp; no double-append).
  - `useFeed` endpoint: `/api/feed?until=${cursor}` (omit `until` on page 1).
    `useUserNotes`: `/api/user/${pubkey}/notes?limit=${limit}&until=${cursor}`.
  - Return `{ data, loading, error, loadingMore, exhausted, loadMore }`.

### Client — virtualized render + truthful indicator + Footer

- **`ui/` dependency:** `npm --prefix ui install react-virtuoso` (adds to `ui/package.json`
  dependencies; React 19-compatible 4.x). No other dep, no build/lint tooling.
- **`ui/src/pages/BrainstormFeed.jsx` / `BrainstormUserNotes.jsx`:**
  - Pass the new hook fields into the pure helper:
    `renderFeedState({ data, loading, error, mode, loadingMore, exhausted, loadMore })` (same for
    `renderUserNotesState`). The helper stays pure (no fetch/auth/router/browser globals);
    `Virtuoso`/`NoteCard` are components and `loadMore` is a passed callback.
  - In the `OK` branch: compute `filteredItems` (the existing `mode === 'all' ? all : all.filter(it => !it.isReply)`
    from ADR 0001 — unchanged, still the reply-only-empty guard when `filteredItems` is empty but
    `all` is non-empty), then render:
    ```jsx
    <>
      <div className="bsp-feed-indicator">{indicatorText(filteredItems.length)}</div>
      <Virtuoso
        useWindowScroll
        data={filteredItems}
        computeItemKey={(_, item) => item.id}
        itemContent={(_, item) => <NoteCard item={item} />}
        components={{ Footer: () => <FeedFooter loadingMore={loadingMore} exhausted={exhausted} onLoadMore={loadMore} /> }}
      />
    </>
    ```
  - **Truthful indicator (AC "window indicator"):** replace the fixed
    `INDICATOR: 'Showing the most recent 50 notes.'` with a count-based string, e.g.
    `Showing ${n} note${n === 1 ? '' : 's'}.` computed from the **filtered** length (so it tracks
    both loading and the toggle). Keep the constant in `FEED_COPY`/`NOTES_COPY` as a small
    formatter or template.
  - **Footer component** (small, in-page or a shared `ui/src/components/LoadMoreFooter.jsx`):
    `exhausted` → an end-of-history line (new copy, e.g. `FEED_COPY.END`); else a
    `loadingMore`-aware button (`disabled={loadingMore}`, label "Loading…" vs "Load more")
    wired to `onLoadMore`. Reuse the existing tag-index load-more button styling
    (`.bs-tagindex-loadmore` / `.bs-sort-toggle` family) or add a small `bsp-loadmore` class.
  - The three/one non-OK status branches (`NO_SOURCE`/`FOLLOW_LIST_UNAVAILABLE`/`EMPTY`;
    notes-page `EMPTY`) and the ADR-0001 `REPLY_ONLY` branch are **unchanged** — no Footer/Load
    more there (nothing to page).

### Testability

- **Server (behavioral, executes the module):** with an in-memory `querySync` fake keyed on the
  filter's `until`, assert page 1 (no `until`) then `loadMore` (`until = oldest.created_at`)
  returns strictly-older notes, that the boundary id dedups, order stays newest-first, and an
  empty page maps to the client's exhaustion. Mirrors `live-feed-read-path`/`note-surfaces-read-path`.
- **Client (sentinels):** the accumulating hook (`until` in the load-more URL, append-not-replace,
  `loadingMore`/`exhausted`, stale-guard); the pages import `Virtuoso` and render it in the OK
  branch with `itemContent` → `<NoteCard item={item}>` and a Footer wired to `loadMore`; the
  indicator is count-derived (no literal "50"); the reply filter + REPLY_ONLY branch (ADR 0001)
  still present. **Update** the two shipped `items.map` sentinels noted in Consequences.
- **Runtime (cycle-local browser smoke before review):** load many batches on `/user/:pubkey/notes`,
  confirm the mounted `.bsp-note-card` count stays bounded while total loaded grows, scroll-back
  restores the newest, the toggle still filters the accumulated list, and the end-of-history
  message appears at exhaustion.

## Out of scope

- Auto-load on scroll / `endReached` (explicit "Load more" only); jump-to-date; "page N" URLs.
- Changing the initial batch size (stays 50).
- Auto-continue-until-one-visible in Notes mode (deferred enhancement).
- Server-side reply filtering / over-fetch (filtering stays client-side per ADR 0001).
- The profile "Content" card (Story 3 — one note, nothing to paginate/virtualize).
- Any write/publish; any change to search, ranking, tagging, or firmware.
