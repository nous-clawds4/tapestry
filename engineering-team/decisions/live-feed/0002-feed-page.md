# ADR 0002: The public `/feed` page — a top-level React SPA route that renders the read path's four-outcome contract

**Status:** Proposed
**Date:** 2026-06-15
**Story:** `engineering-team/stories/live-feed/2-feed-page.md`
**Epic:** `engineering-team/epics/live-feed.md`
**Book:** `engineering-team/audits/live-feed/book.md` (Direction-mode, armed)

## Context

Story `live-feed` #2 adds the **public, login-free `/feed` page** — the visible host surface
the Live Feed epic exists to stand up. It is **front-end only**: it consumes the read path
built and contracted in ADR `live-feed/0001` (`src/api/feed/feedReadPath.js`, exposed as
`GET /api/feed`) and adds **no new read logic** — no source resolution, no follow reading, no
note fetching, no relay selection, no profile enrichment. This ADR decides *what a person sees*
when they open `/feed`, and *how that page is served, routed, and tested*.

### Acceptance criteria, quoted to design against

> - **Public, no-login reachability + no overflow.** Given no logged-in user, when an anonymous
>   client requests `GET /feed`, then the response is HTTP 200 and renders the feed surface (the
>   populated feed or one of the three defined empty states) — never a login wall or error — and
>   at a 1280px-wide viewport the rendered page produces **no horizontal overflow**.
> - **Populated feed: content, order, heading, window indicator.** Given the read path yields one
>   or more notes, the page shows the heading **"Live Feed"**, the indicator **"Showing the most
>   recent 50 notes."**, and one entry per note — each showing the author **display name**,
>   **avatar**, **timestamp**, and **text** — ordered **newest first**.
> - **Empty state 6a — no source identity.** Read path reports no source identity → message
>   **"No House point-of-view is selected — there's no feed to show yet."** and no entries.
> - **Empty state 6b — follow list not available locally.** Read path reports the follow list is
>   not in local strfry → message **"This identity's follow list isn't available locally yet."**
>   and no entries.
> - **Empty state 6c — follow list present but no notes.** Read path reports a present follow list
>   with no recent notes → message **"No recent notes from the accounts this identity follows."**
>   and no entries.
>
> Canonical copy is operator-delegated wording; punctuation is non-binding so long as each message
> conveys its frame meaning. **Exactly one** of the four states renders per request, matching the
> read path's reported outcome.

### The contract this page consumes (from ADR 0001 + the merged module)

`GET /api/feed` returns `{ success: true, ...result }` where `result` is one of (read directly
from `src/api/feed/feedReadPath.js`, lines 222–250):

| `status` | Other fields | Maps to story state |
|---|---|---|
| `NO_SOURCE` | — | 6a (no House PoV) |
| `FOLLOW_LIST_UNAVAILABLE` | `source` | 6b (follow list not local) |
| `EMPTY` | `source`, `relaySource`, `items: []` | 6c (present, no notes) |
| `OK` | `source`, `relaySource`, `items: [ … ]` | populated feed |

Each `OK` item is `{ id, pubkey, createdAt, content, author: { displayName, avatar } }` — already
newest-first and capped at 50 by the merged read-path module (`FEED_CAP = 50` in
`src/api/feed/feedReadPath.js:36`, sorted `created_at` desc then `.slice(0, FEED_CAP)`). On
unexpected error the handler returns HTTP 500 `{ success: false, error }` (relay timeout is **not**
an error — it yields `EMPTY`/`OK`). The page therefore has a **fifth, defensive presentation
case** the four story states don't name: a transport/`success:false`/HTTP-error case (network
failure, 500, malformed body). The story forbids showing "an error" *for the four read-path
outcomes*; a genuine transport failure is outside those four and must still avoid a raw stack /
blank — a neutral "couldn't load" line keeps the page from being a blank page or browser error.

### Concepts touched

**None.** This page renders the read path's already-resolved output; it references no
Concept-Graph concept directly. Confirmed via `GET /api/concept-graph/summaries` — the 34 graph
nodes are domain concepts (class-thread, concept-graph, graperank, nostr-relay, …), none of which
the page queries. The underlying data (kind-1 notes, kind-0 profiles, the source identity, the
relay set) is owned entirely by `live-feed` #1. **No concept definition changes; no firmware
reinstall** (see Consequences).

### How this app serves front-end pages today (verified in source + against the running stack)

The control panel is a **React + Vite SPA** built to `/dist` (`ui/vite.config.js` → `outDir:
'../dist'`), served by the Express control panel:

- **Static + SPA history fallback** live in `bin/control-panel.js`: `express.static('../dist')`
  (line 124), then a catch-all at lines 297–301:
  ```js
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
  ```
  So **any non-`/api/` path returns HTTP 200 with the SPA shell**, and client-side routing
  (`createBrowserRouter`, HTML5 history mode) takes over. The route only needs to exist in
  `ui/src/App.jsx`; the server needs **no change** to make `/feed` reachable.
- **Auth never gates a page route.** `src/middleware/auth.js` (lines 306–314) calls `next()` for
  any path that does not start with `/api/` (`!req.path.startsWith('/api/')`). `/feed` is public
  by construction — no login wall is even possible at this layer.
- **The route table** is `ui/src/App.jsx`. The **top-level public pages** — `/` (`BrainstormSearch`),
  `/about` (`BrainstormAbout`), `/how-search-works`, `/developers` — sit at the router's top level
  (`createBrowserRouter([...])`, lines 77–117), *not* under the `/tapestry` admin `<Layout>` and
  *not* under the pubkey-scoped `/user/:pubkey/*` profile pages. **`/feed` belongs in this
  top-level public group.**
- **The page component pattern** is `ui/src/pages/Brainstorm*.jsx`: `BrainstormAbout.jsx` is the
  canonical *plain, public, single-column* page — `<div className="bsp-page">` → `bsp-top-bar`
  (logo + `<BrainstormUserMenu>`) → a centered `bsp-content` column. It uses `useAuth()`, which
  initializes `user = null` and tolerates the anonymous case (`ui/src/context/AuthContext.jsx`),
  so the shell is safe to reuse on a logged-out page.
- **The data-fetch pattern** is a hook in `ui/src/hooks/` returning `{ data, loading, error }` via
  `useState`/`useEffect`/`fetch`/`AbortController` — see `useGrapevineFollows.js` (raw `fetch`,
  `.json()`, `success`-flag check, abort on unmount). This is the established convention to mirror.
- **Reusable styling tokens** already exist in `ui/src/styles.css`: `bsp-page`, `bsp-top-bar`,
  `bsp-content`, `bsp-avatar` / `bsp-avatar-placeholder`, `bsp-name`, `bsp-empty`, `bsp-skeleton-row`.

**Empirical check against the running local stack** (`http://localhost:7778`):
- `GET /feed` → **HTTP 200**, `text/html` — already served by the SPA fallback today, identical to
  `GET /about` (200, `text/html`). The reachability + 200 criterion holds at the server with **zero
  backend work** the moment the React route is registered and `/dist` rebuilt.
- `GET /api/feed` → **HTTP 404** ("Cannot GET /api/feed") on this running container. ADR 0001's
  endpoint is contracted/merged but **not currently wired into the running stack here**. This is a
  deploy/registration concern owned by #1 — *not* this page's responsibility — but it directly
  shapes testability (see "Testability"): the page's render logic must be exercisable against the
  **contract shape**, not a live endpoint.

### Constraints

- **Additive & read-only** (frame bullet 7): add only the `/feed` route + page (+ its hook/CSS); no
  writes/publishes; no change to search, profile, ranking, or firmware. With `/feed` removed the
  app behaves exactly as before. The single edit to a shared file is registering one route in
  `App.jsx`; nothing existing changes behavior.
- **JS-without-build at the server; Vite build at the UI.** The UI is the project's one compiled
  surface (`npm run build` in `ui/` → `/dist`). Reuse it; **add no new dependency** and **no new
  lint/typecheck/build tooling**. React 19, `react-router-dom` 7, and the `bsp-*` styles are all
  already present.
- **No re-derivation.** The page maps the four (+ defensive) states to DOM; it must not re-resolve
  the source, re-read follows, re-fetch notes, re-pick relays, or re-enrich profiles (all #1's job).
- **`relaySource`** (`set` | `fallback`) is present on `OK`/`EMPTY`. The story does **not** ask the
  page to display it; rendering it is out of scope (the read path's distinction is for evidence, not
  the surface). The page ignores it.

## Options considered

### Option A — A top-level React SPA route + one new `BrainstormFeed.jsx` page + one fetch hook, modeled on `BrainstormAbout.jsx`, with a pure state→view mapping *(chosen)*

Add the page to the **same top-level public group** the other plain public pages live in:

1. **Route** — add `{ path: '/feed', element: <BrainstormFeed /> }` to the top-level array in
   `ui/src/App.jsx` (next to `/about`, `/how-search-works`, `/developers`), plus the import. No
   server change — the existing SPA fallback (`control-panel.js:297`) already 200s `/feed`.
2. **Hook** — new `ui/src/hooks/useFeed.js`, mirroring `useGrapevineFollows.js`: `fetch('/api/feed',
   { signal })`, `.json()`, return `{ data, loading, error }` where on a `success` body `data` is the
   **whole result object** `{ status, source?, relaySource?, items? }`. A non-`success`/transport
   failure sets `error` (drives the defensive case). No params (the source identity is resolved
   server-side — there is deliberately no PoV picker).
3. **Page** — new `ui/src/pages/BrainstormFeed.jsx`, modeled on `BrainstormAbout.jsx`'s plain public
   shell (`bsp-page` → `bsp-top-bar` with logo + `<BrainstormUserMenu>` → centered `bsp-content`),
   that delegates body rendering to a **pure, exported, presentational helper** — `renderFeedState`
   / a `<FeedBody result={…} />` — whose entire output is a function of the result object:
   - `status === 'OK'` → heading "Live Feed", indicator "Showing the most recent 50 notes.", then
     `items.map(...)` to one entry each (avatar via `bsp-avatar` / placeholder fallback, display
     name, a formatted `createdAt` timestamp, the `content` text), **in array order** (already
     newest-first; the page does not re-sort).
   - `status === 'EMPTY'` → heading + the 6c message in a `bsp-empty` block, no entries.
   - `status === 'FOLLOW_LIST_UNAVAILABLE'` → heading + the 6b message, no entries.
   - `status === 'NO_SOURCE'` → heading + the 6a message, no entries.
   - `loading` → a neutral loading line / skeleton (not one of the four states; a transient).
   - `error` / transport failure / unknown `status` → a neutral "Couldn't load the feed right now."
     line (the defensive case; never a raw error or blank).
   Copy strings are module-level constants so tests assert them and the Implementer can't drift them.
   Layout uses a single capped-width column (`max-width` token, `width: 100%`, wrapping text,
   `overflow-wrap`/`word-break` on note text) so **nothing exceeds 1280px** — the no-overflow AC.

The state→view split is the crux: `FeedBody`/`renderFeedState` is a **pure function of the result
object with no fetch, no router, no auth, no browser API**, so all four states (+ loading/defensive)
are drivable by passing a literal result — see Testability.

- **Pros:**
  - Reuses the exact, established public-page pattern (`BrainstormAbout.jsx` shell + a
    `useGrapevineFollows`-shaped hook + a top-level route) — almost no novel structure, matching the
    frame's "deliberately plain" intent.
  - **`/feed` reachability + 200 is free**: the SPA fallback already serves it (empirically verified).
    The only server-touching change is one route line in `App.jsx`.
  - **The four states map 1:1 from the read path's discriminated `status`** — the page *renders*, it
    does not re-derive, honoring the #1/#2 split and frame bullet 7.
  - The pure `FeedBody`/`renderFeedState` makes the state→DOM mapping **testable without a browser** —
    the decisive testability property given the broken Playwright harness (see Testability).
  - Strictly additive and reversible: delete the page + hook + route line and the app is unchanged.
  - No new dependency, no new tooling, no concept/firmware change.
- **Cons:**
  - A new page + hook is more code than folding everything into `App.jsx` inline (Option C) — but the
    page/hook split *is* the house pattern, and the separation is what makes it testable.
  - The Vite `/dist` must be rebuilt (`npm run build` in `ui/`) and the new bundle deployed for the
    route to resolve client-side — a build step, but the project's existing one, not a new tool.

### Option B — Server-rendered `/feed` HTML page (a legacy `.html` / `res.sendFile` page outside the SPA)

`bin/control-panel.js` also serves legacy standalone HTML (`app.get('/:filename.html', …)`, lines
239–246; `public/*.html`). Build `/feed` as a server-rendered page in that legacy lane: a route that
renders HTML server-side (or a static `public/feed.html` + a small vanilla-JS fetch), bypassing the
React SPA entirely.

- **Pros:** could inline the read-path fetch server-side; no Vite rebuild; arguably "simpler" HTML.
- **Cons (decisive):**
  - **Wrong, deprecated lane.** Every user-facing Brainstorm page (`/`, `/about`, the profile/
    follows/followers/reporters pages) is a React SPA route. A bespoke server-rendered `/feed`
    diverges from the established surface, can't reuse `bsp-*` components/`BrainstormUserMenu`/the
    shared shell, and creates a second page-rendering paradigm for one page.
  - **Worse testability, not better.** A server-rendered page's state→DOM mapping isn't an importable
    pure function — to assert the four states you must drive HTTP + parse HTML, i.e. exactly the
    browser/e2e level the broken Playwright harness blocks. Option A's pure helper is unit-testable
    with no server at all.
  - Tempts re-introducing read logic server-side (composing the feed in the page route), blurring the
    #1/#2 split the story draws firmly.
  - Rejected: it's the legacy paradigm, it's harder to test, and it muddies the scope split.

### Option C — Inline the feed UI directly into `App.jsx` (no separate page component or hook)

Put the route element as an inline component in `App.jsx` that fetches and renders in place, with no
`pages/BrainstormFeed.jsx` and no `hooks/useFeed.js`.

- **Pros:** fewest files.
- **Cons (decisive):**
  - **Breaks the house pattern** — every other page is a `pages/Brainstorm*.jsx` with its data hook
    in `hooks/`. Inlining is inconsistent and makes `App.jsx` (the shared route table, a file every
    page touches) carry feature logic.
  - **Defeats testability** — the state→view mapping is no longer a separately importable unit; you're
    back to needing a browser to render `App.jsx`. The whole point of the Option-A split is a pure,
    importable `renderFeedState`.
  - No upside over A beyond file count, which the project's own precedent already rejects. Rejected.

## Decision

We chose **Option A** — a **top-level public React SPA route** (`/feed` in `ui/src/App.jsx`, beside
`/about`), a new **`ui/src/pages/BrainstormFeed.jsx`** modeled on `BrainstormAbout.jsx`'s plain public
shell, and a new **`ui/src/hooks/useFeed.js`** modeled on `useGrapevineFollows.js`, with the body
rendered by a **pure, exported `renderFeedState`/`<FeedBody>`** that maps the read path's `{ status,
items, … }` result to exactly one of the four story states (plus transient loading and a defensive
"couldn't load" case).

It is the only option that (a) reuses the established public-page surface and the SPA fallback that
already 200s `/feed` for anonymous clients (verified), (b) renders the four contracted outcomes 1:1
**without re-deriving** them — honoring the #1/#2 split and the additive/read-only frame, (c) stays
strictly additive and reversible (one route line + two new files + a CSS block), and (d) makes the
four render states **testable without a working browser harness** via the pure state→view helper —
the decisive property given the reported-broken Playwright setup. We trade away a slightly larger
footprint than inlining (Option C) and a "no Vite rebuild" shortcut (Option B), both of which would
break the house pattern and *worsen* testability.

## Consequences

- **Enables:** the visible `/feed` surface the epic exists to stand up; the later tagging book hangs
  off this page. Completes the user-visible half of the read path: #1 produces the four-outcome data,
  #2 renders it.
- **Constrains:** the page is coupled to ADR 0001's response shape (`status` values, item fields). If
  #1's contract changes, this page changes — documented here and in 0001's Consequences. The page
  shows neither `relaySource` nor `source` (out of scope), so a future "showing fallback relays"
  indicator is a new story, not a silent add.
- **Build/deploy:** the UI's Vite bundle must be rebuilt (`npm run build` in `ui/`) and the new `/dist`
  deployed for `/feed` to resolve client-side. This is the project's existing build step (no new
  tooling), but it is a required deploy action — the Implementer/Director must rebuild `/dist`, and
  staging evidence (frame bullet 8 / Tier-4) requires the rebuilt bundle live on
  `staging.brainstorm.world`.
- **Running-stack dependency (flagged for the Tester/Director):** on the *current local* container
  `GET /api/feed` 404s — ADR 0001's endpoint isn't registered on this running stack. The page's
  **render correctness does not depend on a live endpoint** (it's tested against the contract shape;
  see Testability), but the **Tier-4 staging evidence** (an anonymous `GET /feed` 200 showing ≥3
  rendered notes) *does* require `/api/feed` to be live and returning `OK` with items on staging. If
  staging's `/api/feed` is absent or the House PoV has no follows / relays are unreachable at evidence
  time, that is the book's documented halt condition (book bullet 8 / external-interference rule), not
  a defect in this page.
- **New debt / follow-ups:** none structural. The defensive "couldn't load" case is a fifth
  presentation branch beyond the story's four named states (justified above); it's deliberately
  minimal. Timestamp formatting is a small local helper (no date library added).
- **Firmware reinstall required?** **No.** This page defines no concepts and changes no schemas or
  properties — it only renders existing endpoint output. No `POST /api/firmware/install`.

## Implementation notes

Concrete targets for the Implementer. All UI files live under `ui/src` (Vite — `npm run build` in
`ui/` to reflect changes in `/dist`).

- **New hook: `ui/src/hooks/useFeed.js`** — mirror `ui/src/hooks/useGrapevineFollows.js`:
  - `export default function useFeed()` → `useState`/`useEffect`/`AbortController`; `fetch('/api/feed',
    { signal: controller.signal })`, `.then(r => r.json())`.
  - On a body with `json.success === true`: set `data` to the **whole result object** —
    `{ status, source, relaySource, items }` (pass through; do **not** reshape — the page reads
    `status` + `items`). On `success !== true` / non-2xx / thrown / aborted-excluded: set `error`.
  - Return `{ data, loading, error }`. No arguments (source is server-resolved; no PoV picker — story
    Out of scope). Abort on unmount, exactly as `useGrapevineFollows.js`.
- **New page: `ui/src/pages/BrainstormFeed.jsx`** — model the shell on `ui/src/pages/BrainstormAbout.jsx`:
  - `const { user, login, logout } = useAuth();` then `const { data, loading, error } = useFeed();`
  - Shell: `<div className="bsp-page">` → `<div className="bsp-top-bar">` (the `bsp-logo`/`brainstorm.svg`
    anchor + `<BrainstormUserMenu user={user} login={login} logout={logout} />`, copied from
    `BrainstormAbout.jsx`) → a **single capped-width** `bsp-content` column (reuse `bsp-content`; cap
    via an existing max-width token / inline `maxWidth` as `BrainstormAbout` does, `width: 100%`).
  - **Heading** `<h1>Live Feed</h1>` renders in the populated and the three empty states (the heading
    is part of the populated AC; for empty states it frames the message — keep it present so the page
    is never bare). The defensive/loading transients may show it too.
  - **Body delegated to a pure exported helper** — define and `export` (named export, for tests)
    either `function renderFeedState({ data, loading, error })` returning JSX, **or** a
    `function FeedBody({ data, loading, error })` component. It must be a **pure function of its args**:
    no `fetch`, no `useAuth`, no router, no `window`/`document` access. Branches:
    - `loading && !data` → `<div className="bsp-feed-loading">Loading the feed…</div>` (or a
      `bsp-skeleton-row` skeleton; transient, not one of the four states).
    - `error` (or `data == null` after load, or `data.status` not one of the four) →
      `<div className="bsp-empty">Couldn't load the feed right now.</div>` (defensive — never a raw
      error / blank; copy non-binding but neutral).
    - `data.status === 'NO_SOURCE'` → `<div className="bsp-empty">{COPY.NO_SOURCE}</div>`.
    - `data.status === 'FOLLOW_LIST_UNAVAILABLE'` → `<div className="bsp-empty">{COPY.FOLLOW_UNAVAIL}</div>`.
    - `data.status === 'EMPTY'` → indicator line + `<div className="bsp-empty">{COPY.NO_NOTES}</div>`.
    - `data.status === 'OK'` → indicator `<div className="bsp-feed-indicator">{COPY.INDICATOR}</div>`,
      then `data.items.map(item => <FeedItem key={item.id} item={item} />)` **in array order**
      (already newest-first; do **not** re-sort).
  - **`FeedItem`** (local) — per `item`: avatar (`<img className="bsp-avatar" src={item.author.avatar}>`
    with a `bsp-avatar-placeholder` fallback when `author.avatar` is null), `item.author.displayName`
    (fall back to a truncated `item.pubkey` / "Unknown" when null) in `bsp-name`, a formatted timestamp
    from `item.createdAt` (Unix seconds → local string via a tiny local `formatTimestamp` helper — **no
    date library**), and `item.content` as the note text. Wrap text with `overflow-wrap:anywhere` /
    `word-break` so long content/URLs don't overflow 1280px.
  - **Copy constants (module-level, exported for tests):**
    ```js
    export const FEED_COPY = {
      HEADING: 'Live Feed',
      INDICATOR: 'Showing the most recent 50 notes.',
      NO_SOURCE: "No House point-of-view is selected — there's no feed to show yet.",
      FOLLOW_UNAVAIL: "This identity's follow list isn't available locally yet.",
      NO_NOTES: 'No recent notes from the accounts this identity follows.',
    };
    ```
    (Punctuation is non-binding per the story; keep meaning exact.)
- **Edit: `ui/src/App.jsx`** — add `import BrainstormFeed from './pages/BrainstormFeed';` and, in the
  **top-level** router array (beside `/about`, `/how-search-works`, `/developers`, ~lines 110–117, *not*
  under `/tapestry` or `/user/:pubkey`), add `{ path: '/feed', element: <BrainstormFeed /> }`. This is
  the **only** edit to an existing shared file; it adds a route and changes nothing existing.
- **Styles: `ui/src/styles.css`** — reuse `bsp-page`, `bsp-top-bar`, `bsp-content`, `bsp-empty`,
  `bsp-avatar`/`bsp-avatar-placeholder`, `bsp-name` (and `bsp-skeleton-row` if a skeleton is used). Add
  only minimal new token-based classes if needed (`bsp-feed-item`, `bsp-feed-indicator`, `bsp-feed-loading`)
  using existing CSS variables/tokens; **no new tooling**. Ensure the column is capped (`max-width` ≤ a
  token, `width:100%`, `box-sizing:border-box`) and note text wraps — the 1280px no-overflow AC.
- **Server: no change.** The SPA fallback in `bin/control-panel.js` (lines 297–301) already serves
  `/feed` → 200 `dist/index.html` for anonymous clients (verified). No route, no auth, no middleware
  edit. The only deploy action is rebuilding `/dist` (`npm run build` in `ui/`).
- **No new dependency, no lint/typecheck/build tooling, no concept/firmware change.**

### Testability — the four render states without a working browser harness

The Gate-3 rubric wants UI flows, and the book mandates **Tier-4 rendered-UI evidence at staging**.
But the Playwright harness is reported broken (PROFILE_FOLLOWERS handoff: `tests/global-setup.js`
reads `config.use.baseURL`, `undefined` in the installed Playwright → global-setup aborts → all e2e
specs blocked). This design is shaped so the four states are testable **independently of that harness**:

1. **State→DOM mapping is a pure unit (primary, harness-independent).** `renderFeedState` / `<FeedBody>`
   is a pure function of `{ data, loading, error }` — no fetch, no router, no auth, no browser globals.
   The Tester drives **all four story states + loading + the defensive case** by passing literal result
   objects (`{status:'OK', items:[…3 items…]}`, `{status:'EMPTY',…}`, `{status:'FOLLOW_LIST_UNAVAILABLE'}`,
   `{status:'NO_SOURCE'}`) and asserting the rendered output (via React's test renderer /
   `renderToStaticMarkup` from `react-dom/server`, which is already a dependency — no new package) for:
   heading + indicator + ≥1 entry with name/avatar/timestamp/text and **array order preserved** (OK);
   the exact copy + zero entries (each empty state); and a neutral non-error line (defensive). This
   exercises every acceptance branch **with no live `/api/feed` and no browser** — which matters doubly
   because `GET /api/feed` 404s on the current local stack. **The Tester should center the Gate-3
   plan on this level.**
2. **The hook's contract handling (secondary, unit).** `useFeed` can be tested by stubbing `fetch` to
   return each `success:true` body and a failure, asserting `{ data, loading, error }` transitions —
   no server, no browser.
3. **The rendered-UI / 200 evidence (Tier-4, staging).** Two pieces:
   - *Reachability + 200* needs no browser: a plain `curl -s -o /dev/null -w "%{http_code}"
     https://staging.brainstorm.world/feed` asserts the anonymous 200 (the SPA fallback; already true
     for `/feed` locally and for `/about`). Combine with a `text/html` content-type check.
   - *≥3 rendered notes screenshot/DOM extract* is the one piece that genuinely wants a browser. This
     is **book-level mandatory final evidence**, gathered at the staging/Director stage — *not* a
     per-story Gate-3 blocker that the unit level can't cover. The per-story states are fully covered by
     (1); the staging screenshot is the book's Tier-4 capstone.
4. **Playwright repair — a flagged decision, not an assumption.** If the Director/Tester wants the ≥3-note
   screenshot captured via Playwright (rather than a manual/headless DOM extract), the harness's
   `global-setup` `baseURL` bug must be fixed first. **This ADR does not assume that fix and does not
   scope it into this story.** The per-story Gate-3 level is achievable **without** Playwright via (1)+(2),
   and the 200 check via `curl`. *If* a browser-driven screenshot is chosen for the Tier-4 capstone, the
   minimal scope is: make `tests/global-setup.js` tolerate an undefined `config.use.baseURL` (skip the
   pre-flight or read the staging base URL from env) — a setup-only fix, no product code, surfaced here
   as a **decision for the Director**, not a hidden prerequisite. The Tester picks the final level; this
   design makes a no-Playwright per-story level workable and isolates the browser need to the book
   capstone.

## Out of scope

- **Any read/resolution logic** — source resolution, follow reading, note fetching, relay selection,
  profile enrichment, the 50-cap, newest-first ordering — all owned by `live-feed` #1 / ADR 0001; this
  page renders #1's output and re-derives nothing.
- **A source-identity / PoV picker** on the page (the source is resolved, not chosen) — story Out of
  scope.
- **Displaying `relaySource` or `source`** (set-vs-fallback indicator, whose follows) — the story does
  not ask for it; a future indicator is a new story.
- **Tagging feed items, reposts (kind 6), reactions (kind 7), threading/replies, pagination, infinite
  scroll, full history, click-through to a note** — story Out of scope.
- **Any write/publish; any change to the search page, profile pages, ranking/scoring, or firmware.**
- **Registering / fixing `GET /api/feed` on a stack** (it 404s locally today) — owned by #1's
  deploy/registration, not this page.
- **Repairing the Playwright harness** — surfaced above as a Director-level decision tied only to the
  optional browser-driven Tier-4 screenshot; not a prerequisite for this story's per-story tests and not
  scoped here.
