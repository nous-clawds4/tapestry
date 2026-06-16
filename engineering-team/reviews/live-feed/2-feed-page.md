# Review: Story 2 — Live Feed page (`/feed`)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-15
**Diff:** `git diff 4af32635..HEAD` (commit `b7e07eeb` — "impl: feed-page (story #2, ADR 0002)")
**Story:** `engineering-team/stories/live-feed/2-feed-page.md`
**ADR:** `engineering-team/decisions/live-feed/0002-feed-page.md` (Option A)
**Test plan:** `engineering-team/stories/live-feed/2-feed-page.test-plan.md`
**Tests:** `test/live-feed-feed-page.test.js` (source-assertion level; runtime properties deferred to Tier-4 staging per the frame)

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS**. Ran twice; `EXIT_CODE=0`; **434 tests, Overall: PASS**. Verbatim tail:
  ```
  live-feed-read-path suite:                       PASS (23 passed, 0 failed)
  live-feed-feed-page suite:                       PASS (18 passed, 0 failed)
  Overall:                                         PASS
  ```
  The new `live-feed-feed-page` suite is **18/18** (`T1`–`T16` + regression sentinels `R1`/`R2`),
  the `live-feed-read-path` suite (#1) stays **23/23**, and every one of the 34 pre-existing suites
  still PASSes. No suite regressed.
- [x] `npm run test:playwright` — **N/A / intentionally not run.** The test plan and ADR §Testability
  document the Playwright harness as reported-broken (`global-setup` `baseURL` bug) and scope the
  per-story level to the source assertions, with the runtime/browser properties (anonymous 200,
  rendered ≥3 notes, no-scrollbar @1280px) deferred to the **book-mandated Tier-4 staging smoke**
  gathered by the Director. This is a sanctioned split, not a gap I'm waiving.
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured at the server (JS-without-build); the UI's Vite `/dist` rebuild is a
  deploy action owned by the Director at Stage 2 (ADR Consequences). Not-live-locally is expected and
  not a defect._

## Spec adherence — the 5 acceptance criteria

Exactly one of four states (+ transient loading + a defensive case) renders, driven by the read path's
discriminated `status` — the pure mapping is in `renderFeedState` (`ui/src/pages/BrainstormFeed.jsx:90`).

- [x] **AC-1 — Public, no-login reachability + no overflow.**
  - *Route reachability (source-provable):* `/feed` is registered in the **top-level public router
    array** at `ui/src/App.jsx:115-118` (`{ path: '/feed', element: <BrainstormFeed /> }`), beside
    `/about` (`App.jsx:111-114`) and **before** the `/tapestry` admin group (`App.jsx:124`) and not
    nested under `/user/:pubkey` (`App.jsx:84-96`). The SPA history-fallback in `bin/control-panel.js`
    therefore 200s `/feed` with no login wall (ADR §"How this app serves front-end pages"; `T1`).
  - *No login wall (source-provable):* the page reuses `useAuth()` (`BrainstormFeed.jsx:32`), which
    initializes `user=null` and tolerates the anonymous case — the same shell `BrainstormAbout.jsx`
    uses (`T16`).
  - *No-overflow mechanism (source-provable):* the column is capped + `box-sizing:border-box`
    (`ui/src/styles.css:4276-4280` `.bsp-feed-content { max-width:700px; width:100%; box-sizing:border-box }`),
    items are capped (`styles.css:4296-4302` `.bsp-feed-item { max-width:100%; box-sizing:border-box }`),
    and note text wraps (`styles.css:4326-4332` `.bsp-feed-text { white-space:pre-wrap;
    overflow-wrap:anywhere; word-break:break-word }`) so a long URL/token can't push past the cap
    (`T11`/`T12`). The 40×40 avatar (`styles.css:4309-4312`) can't blow out either.
  - **Runtime portion → Tier-4 (NOT proven by source):** the *actual* anonymous `GET /feed` → 200
    `text/html`, and the *rendered* no-horizontal-scrollbar at a 1280px viewport, are genuine
    server/browser properties the Node suite cannot exercise. These are the book's Tier-4 staging smoke
    (curl + DOM/screenshot), gathered by the Director — **explicitly deferred, not claimed proven here.**

- [x] **AC-2 — Populated feed: content, order, heading, window indicator.**
  - Heading `FEED_COPY.HEADING = 'Live Feed'` (`BrainstormFeed.jsx:18`), always rendered at
    `BrainstormFeed.jsx:46` so the page is never bare (`T2`).
  - Indicator `FEED_COPY.INDICATOR = 'Showing the most recent 50 notes.'` (`BrainstormFeed.jsx:19`),
    rendered on the OK branch at `BrainstormFeed.jsx:117` (`T3`).
  - One entry per note via `items.map(...)` **in array order, no re-sort** (`BrainstormFeed.jsx:119`);
    the test (`T4`) and a read of the helper confirm no `.sort` — newest-first ordering is owned by #1.
  - Each `FeedItem` (`BrainstormFeed.jsx:59-79`) shows display name (`item.author.displayName`, with a
    truncated-pubkey / "Unknown" fallback, `:61`), avatar (`<img src={avatar}>` with a
    `bsp-avatar-placeholder` fallback when null, `:67-74`), timestamp (`formatTimestamp(item.createdAt)`,
    `:76`), and text (`{item.content}`, `:78`) (`T5`/`T6`).
  - `formatTimestamp` (`BrainstormFeed.jsx:27-30`) uses the built-in `Date` → `toLocaleString()`, **no
    date library** (`T6`); it also guards non-finite input → `''`.
  - **Runtime portion → Tier-4 (NOT proven by source):** that a browser *actually renders ≥3 notes*,
    newest-first, each with name/avatar/timestamp/text — the Director's staging DOM-extract/screenshot.

- [x] **AC-3 — 6a, no source identity.** `status === 'NO_SOURCE'` →
  `{FEED_COPY.NO_SOURCE}` ("No House point-of-view is selected — there's no feed to show yet.") in a
  `bsp-empty` block, **no `items.map`** (`BrainstormFeed.jsx:106-108`, copy at `:20`) (`T7`).

- [x] **AC-4 — 6b, follow list not local.** `status === 'FOLLOW_LIST_UNAVAILABLE'` →
  `{FEED_COPY.FOLLOW_UNAVAIL}` in a `bsp-empty` block, no entries (`BrainstormFeed.jsx:109-111`, copy
  at `:21`) (`T8`). **Copy note:** the Implementer reworded this from the ADR's canonical *"This
  identity's follow list isn't available locally yet."* to *"The follow list for this identity is not
  available locally yet."* The story explicitly frees the wording ("operator-delegated wording …
  conveys its frame meaning"), the meaning (this identity's follow list, not available locally yet) is
  preserved, and the meaning-token test (`T8`) sanctions it. **Non-blocking** — see Findings.

- [x] **AC-5 — 6c, present list but no notes.** `status === 'EMPTY'` → `{FEED_COPY.NO_NOTES}` ("No
  recent notes from the accounts this identity follows.") in a `bsp-empty` block, no entries
  (`BrainstormFeed.jsx:112-114`, copy at `:22`) (`T9`).

- [x] **No criterion silently dropped; no behavior added beyond the story.** The defensive
  "couldn't load" branch (`BrainstormFeed.jsx:99-104`) and the transient loading line (`:95-97`) are
  the ADR-named fifth/transient presentation cases (ADR §Context, §Impl), not new product behavior.

## ADR adherence — matches Option A

- [x] **Top-level public SPA route**, on the same group as the other plain public pages — `App.jsx:115-118`
  + import `App.jsx:76` (`import BrainstormFeed from './pages/BrainstormFeed';`). The **only** edit to an
  existing shared file, additive (a route + an import). ✔ ADR Decision / Impl notes.
- [x] **Page on the `BrainstormAbout` public shell** — `BrainstormFeed.jsx:34-52` reproduces
  `BrainstormAbout.jsx:7-19` exactly: `bsp-page` → `bsp-top-bar` (logo anchor + `<BrainstormUserMenu>`)
  → centered `bsp-content`. Heading present in all states (`:46`). ✔ (`T16`).
- [x] **`useGrapevineFollows`-shaped hook** — `useFeed.js` mirrors `useGrapevineFollows.js`
  line-for-line in structure: `useState`/`useEffect`/`AbortController`, `fetch('/api/feed', {signal})`,
  `.json()`, gate on `json?.success`, set `error` on non-success/throw, **abort on unmount**, and the
  `finally` guards `setLoading` against an aborted signal (`useFeed.js:30-49`). Passes the **whole
  result object** through as `data` (`:35`) — no reshaping, honoring the #1/#2 split. No arguments (no
  PoV picker). ✔ (`T10`/`T13`).
- [x] **Pure exported `renderFeedState`** mapping the four states + the defensive case — named-exported
  (`BrainstormFeed.jsx:90`), a function of `{ data, loading, error }` only. I read the helper body:
  **no `fetch`, no `useAuth`/`useFeed`, no router hook, no `window`/`document`** — the isolated unit the
  ADR rests testability on (`T14`).
- [x] **Array order preserved (no re-sort)** — `items.map(...)` at `:119`, no `.sort` in the helper (`T4`). ✔
- [x] **`FEED_COPY` exact strings, module-level + exported** — `BrainstormFeed.jsx:17-25`. HEADING and
  INDICATOR are byte-exact to the ADR; the three empty-state strings convey the exact frame meaning
  (FOLLOW_UNAVAIL reworded within the story's allowance — non-blocking). ✔
- [x] **`formatTimestamp`, no date lib** — `BrainstormFeed.jsx:27-30`, built-in `Date` only (`T6`). ✔
- [x] **`relaySource` / `source` not displayed** — out of scope per ADR; the page reads only `status`
  and `items`, never renders `relaySource`/`source`. ✔ (verified by reading the helper).
- [x] **No new dependency, no new tooling** — `git diff --name-only … -- package.json package-lock.json
  ui/package.json ui/package-lock.json` is **empty**. ✔
- [x] **Server unchanged** — `bin/control-panel.js`, `src/middleware/auth.js`, and
  `src/api/feed/feedReadPath.js` are **not** in the diff. ✔ (`R2`).

## Concept-graph integrity

- [x] **No concept referenced** — the page renders the read path's already-resolved output and queries
  no Concept-Graph concept (ADR §Concepts touched: None; story §Concepts touched). Correct — nothing to
  validate against `kind:pubkey:slug` here.
- [x] **No firmware reinstall** — no concept definition / schema / property changed (the diff is
  UI-only). ADR §Consequences calls this out explicitly. ✔
- [x] **Orientation** — n/a; no new server code derives domain concepts.

## Things tests can't catch

- [x] **No secrets** in committed files (UI page/hook/CSS only; no keys, tokens, or URLs beyond the
  same-origin `/api/feed` path and the `brainstorm.svg` logo).
- [x] **No leftover debug logging / `console.*` / `debugger` / TODO / FIXME** in the new files (grepped
  `BrainstormFeed.jsx` and `useFeed.js` — none).
- [x] **No commented-out code.** Comments present are doc/intent only.
- [x] **Error paths handled** — non-success body, non-2xx, thrown fetch, malformed body, and an unknown
  `status` all route to the neutral defensive line (`useFeed.js:33-45`, `BrainstormFeed.jsx:99-104`);
  `formatTimestamp` guards non-finite input; `FeedItem` guards a null `author` (`:60`) and null avatar
  (`:67`). Never a raw stack / blank surface (`T15`).
- [x] **Concurrency / race** — `useFeed` aborts the in-flight fetch on unmount via `AbortController`
  (`useFeed.js:48` return cleanup) and excludes `AbortError` from the error path (`:42`); the `finally`
  only flips `loading` when the signal isn't aborted (`:46`). This is the exact `useGrapevineFollows`
  convention — no setState-after-unmount.
- [x] **SECURITY / XSS — public page rendering UNTRUSTED external-relay content (scrutinized closely).**
  Note `content`, author `displayName`, and the `avatar` URL all originate from external relays
  (kind-1/kind-0 events), so every render of them is an injection surface.
  - **No `dangerouslySetInnerHTML`** anywhere in `BrainstormFeed.jsx` / `useFeed.js` (grepped — none).
  - **Note text and display name render as JSX text children** — `{item.content}` (`:78`) and
    `{displayName}` (`:65`). React escapes text children, so a `<script>`/markup payload in a note or a
    display name renders as inert text, not executed/injected. ✔
  - **Avatar `src={avatar}`** (`:69`) is React-rendered as an attribute (React escapes attribute values,
    so no attribute-breakout). A `javascript:`-scheme URL in an `<img src>` does **not** execute in any
    modern browser (the scheme only runs in navigable contexts like `<a href>` / `location`, never in
    image loading), so a hostile avatar URL can't run script. The avatar is fixed at 40×40
    (`.bsp-feed-avatar`), so a hostile/long URL can't break layout either (it's an attribute, not
    rendered text; and the box is size-locked). This **matches house precedent** — every other page that
    renders an external-profile avatar passes the relay-derived `picture` straight into `<img src>`
    (`BrainstormProfile.jsx:239`, `BrainstormFollowers.jsx:28`, `BrainstormSearch.jsx:948`,
    `BrainstormUserMenu.jsx:92`, `AuthorCell.jsx:31`, …). No new unsafe pattern is introduced.
  - **No link/anchor wraps the untrusted content** — there is no `<a href={…note/profile…}>`, so the one
    place a `javascript:` URL *could* execute doesn't exist here. ✔
  - **Conclusion:** no XSS vector. Untrusted content renders as escaped text; the avatar URL can't
    execute or break layout. ✔

## House rules check

- [x] **Concept Graph API authority respected** — the page references no concept; nothing to look up
  (correct, per ADR). ✔
- [x] **No new lint/typecheck/build tooling** — none added; no `package.json`/lock change. ✔
- [x] **Firmware reinstall** — not required and correctly not performed (no concept/schema change). ✔

## Scope-creep sweep (frame bullet 7 — strictly additive & read-only)

- [x] Only the authorized surface changed: 2 new files (`ui/src/hooks/useFeed.js`,
  `ui/src/pages/BrainstormFeed.jsx`) + 2 additive edits (`ui/src/App.jsx` route+import,
  `ui/src/styles.css` `bsp-feed-*` block). `git diff --name-only 4af32635..HEAD` (excluding the
  `engineering-team/` audit journal) shows exactly these four. ✔
- [x] **No change to other pages, the search page, profile pages, ranking, the read path, or firmware.**
  `src/api/feed/feedReadPath.js` is untouched (`R2`); no server file is in the diff. The only edit to a
  shared file is the `App.jsx` route line — with `/feed` removed, the app behaves exactly as before. ✔
- [x] **No out-of-scope feature** — no read/resolution logic, no PoV picker, no tagging, no
  `relaySource`/`source` display, no reposts/reactions/threading/pagination, no write/publish. Verified
  by reading the page and hook end to end. ✔
- [x] **Test directory untouched** — `git diff --name-only 4af32635..HEAD -- test/` is empty; the
  Implementer made the tests pass without weakening them. ✔

## Findings

### Blocking
None.

### Non-blocking
1. **`ui/src/pages/BrainstormFeed.jsx:21`** — `FEED_COPY.FOLLOW_UNAVAIL` is reworded from the ADR's
   canonical *"This identity's follow list isn't available locally yet."* to *"The follow list for this
   identity is not available locally yet."* This is **allowed** — the story delegates the wording and
   binds only the frame *meaning* ("conveys its frame meaning"), the meaning is fully preserved, and the
   meaning-token test (`T8`) passes against it. Flagging only for traceability; **not a blocker**. If
   the operator wants byte-for-byte parity with the other two empty-state strings (which kept the ADR's
   exact text), aligning this one is a trivial future nicety, not a merge condition.
2. **`ui/src/pages/BrainstormFeed.jsx:69`** — the avatar `<img>` omits the `onError` "hide broken image"
   handler that the other avatar-rendering pages use (`e.target.style.display='none'`). A dead avatar
   URL would show the browser's broken-image glyph rather than silently hiding. Cosmetic degradation
   only — no security or overflow impact (the box is size-locked), not required by any AC or the ADR.
   Optional polish.

## Verdict
**PASS**

The diff implements Option A faithfully and is mergeable **as-is**: all 5 acceptance criteria are
satisfied at the source level (with the genuinely-runtime portions — anonymous 200, rendered ≥3 notes,
no-scrollbar @1280px — correctly and explicitly deferred to the book's Tier-4 staging smoke, not
over-claimed); the ADR's structure, copy, purity, no-re-sort, no-date-lib, and additive constraints all
hold; `npm test` is green (434/434, the new suite 18/18) on my own run; there is no XSS vector (no
`dangerouslySetInnerHTML`, untrusted text escaped by React, the avatar URL can't execute or break
layout); no new dependency or tooling; no concept/firmware change; and the change is strictly additive
and reversible. The two findings are non-blocking.

Per workflow 5 / the Reviewer role, on PASS I set `**Status:** Done` on the story in this same review
commit. Per the per-epic retirement rule, the story stays in `stories/live-feed/` alongside its sibling
(#1, Done) until the epic ships — the epic folder moves under `done/live-feed/` only at epic close-out.

> **Completion-detection note (offer, not auto-run):** this is the second and final per-story PASS in
> the `live-feed` book (Direction-mode, armed). With #1 (read path) and #2 (feed page) both Done, the
> book's user-visible half is complete pending the **book-level Tier-4 staging capstone** (rebuilt
> `/dist` deployed to staging, anonymous `GET /feed` 200, a ≥3-rendered-notes DOM extract/screenshot
> with no 1280px scrollbar) — which is the Director's Stage-2 deploy + evidence step, not a per-story
> gate. The book should not be declared complete here; the Tier-4 evidence is the gating capstone, and
> book close is the Director/operator's call after that evidence lands.
