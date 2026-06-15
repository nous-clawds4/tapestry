# Test Plan: Story 2 — Live Feed page (`/feed`)

**Story:** `engineering-team/stories/live-feed/2-feed-page.md`
**ADR:** `engineering-team/decisions/live-feed/0002-feed-page.md`
**Book:** `engineering-team/audits/live-feed/book.md` (Direction-mode, armed)
**Date:** 2026-06-15

## Test level decision — why source-assertion, not runtime render

The ADR's Testability section *floats* `renderToStaticMarkup` (`react-dom/server`) as one way to
drive the pure `renderFeedState`/`<FeedBody>` helper. **That path is not runnable in this repo's
Node harness, and making it runnable would require new tooling — which is forbidden** (the
JS-without-build house rule). Two independently fatal facts, both verified at plan time:

1. **No JSX transpile in the Node harness.** `npm test` is `node test/test.js` — a plain Node
   process with no Babel/esbuild/SWC. `require('../ui/src/pages/BrainstormFeed.jsx')` would throw a
   `SyntaxError` on the first `<…>` token. Every existing UI suite
   (`profile-follows-list`, `profile-followers-list`, `verified-reporters-list-page`,
   `reputation-info-popup`) therefore reads the `ui/src/*.jsx` **source text** with `fs.readFileSync`
   and asserts on it — none import or runtime-render a component. This suite follows that convention.
2. **`react-dom/server` is not resolvable from the repo root.** `react-dom` is a dependency of the
   `ui/` Vite workspace only — `node -e "require.resolve('react-dom/server')"` at the repo root gives
   `MODULE_NOT_FOUND`. So even with a transpile, the server renderer the ADR floats isn't on the
   harness's module path.

**Conclusion (no kick-back to the Architect needed):** the ADR explicitly leaves the final level to
the Tester ("The Tester picks the final level; this design makes a no-Playwright per-story level
workable") and the design's testability does not *depend* on `renderToStaticMarkup` — it depends on
the state→view mapping being a small, isolated, source-inspectable unit, which Option A delivers. We
therefore verify the per-story acceptance criteria at the **source level** (the repo's established UI
convention), and defer the genuinely-runtime properties to the book's mandatory **Tier-4 staging
smoke** (documented below). No new tooling, no Playwright (its harness is reported broken), no source
changes by the Tester.

## What the Node suite proves vs. what Tier-4 staging proves

| Property | Verified by |
|---|---|
| The page/hook/route files exist and carry the required structure, copy, branches, and CSS | **Node suite** (source assertion) |
| Each of the 4 read-path states maps to its required on-page copy + heading + (no) entries | **Node suite** (the state→view branches are present in source) |
| `/feed` route registered in the top-level public group of `App.jsx` | **Node suite** |
| No-overflow-at-1280px *mechanism* (capped column + wrapping CSS present) | **Node suite** (the CSS rules exist) |
| Anonymous `GET /feed` returns **HTTP 200** + `text/html` (no login wall) | **Tier-4 staging** (`curl`) — runtime, server-served; the Node suite cannot exercise the running SPA fallback |
| The page actually **renders ≥ 3 notes** (each author + text + timestamp) in a browser, newest-first, with no horizontal scrollbar at 1280px | **Tier-4 staging** (DOM extract / screenshot) — a genuine browser property the Node suite cannot prove |

The Node suite proves the page is *built to* render the four states correctly and is *wired to be*
reachable and non-overflowing; it does **not** and **cannot** claim the running page renders notes in
a browser. That runtime claim is the book's Tier-4 capstone (book frame bullet 8), gathered at
staging by the Director.

## Coverage map

Every acceptance criterion maps to at least one Node test (`T*`), plus the runtime portion noted in
the rightmost column. `R*` are regression sentinels (must pass before **and** after implementation).

| Criterion | Test(s) | File | Level | Runtime portion → Tier-4 |
|---|---|---|---|---|
| **AC-1** Public/no-login reachability + HTTP 200 + no horizontal overflow @1280px | `T1` (route in top-level public group), `T11`/`T12` (capped-width + wrapping CSS = the no-overflow mechanism) | `test/live-feed-feed-page.test.js` | source | **Yes** — the anonymous `GET /feed` → 200 `text/html`, and the *rendered* no-scrollbar @1280px, are staging-smoke (curl + DOM/screenshot) |
| **AC-2** Populated feed: heading "Live Feed", indicator "Showing the most recent 50 notes.", one entry per note (display name + avatar + timestamp + text), newest-first/array-order | `T2` (heading const), `T3` (indicator const), `T4` (OK branch maps over `items` in array order, no re-sort), `T5` (`FeedItem` renders author displayName + avatar + timestamp + content), `T6` (`formatTimestamp` from `createdAt`, no date lib) | same | source | **Yes** — the *actually rendered* ≥3 notes are the Tier-4 screenshot/DOM extract |
| **AC-3** Empty state 6a — no source identity → exact copy, no entries | `T7` (`FEED_COPY.NO_SOURCE` exact meaning + `NO_SOURCE` branch renders it, no `items.map`) | same | source | — |
| **AC-4** Empty state 6b — follow list not local → exact copy, no entries | `T8` (`FEED_COPY.FOLLOW_UNAVAIL` exact meaning + `FOLLOW_LIST_UNAVAILABLE` branch) | same | source | — |
| **AC-5** Empty state 6c — present list, no notes → exact copy, no entries | `T9` (`FEED_COPY.NO_NOTES` exact meaning + `EMPTY` branch) | same | source | — |
| **(supporting) the hook** consumes `/api/feed` and passes the whole result through; transport failure → `error` | `T10` | same | source | — |

Additional source tests that pin the ADR's testability contract and the defensive branch:

- `T13` — `useFeed.js` exists, `fetch('/api/feed')`, aborts on unmount, returns `{ data, loading, error }`.
- `T14` — the body helper is a **pure, named-exported** `renderFeedState`/`FeedBody` taking
  `{ data, loading, error }` (the property the ADR rests testability on) and is free of `fetch`,
  `useAuth`, router, `window`/`document` — so the four branches are an isolated unit.
- `T15` — the **defensive** branch (`error` / unknown status) renders a neutral "couldn't load" line,
  never a raw error / blank (ADR's fifth presentation case).
- `T16` — the page reuses the plain public shell (`bsp-page`/`bsp-top-bar`/`bsp-content` +
  `BrainstormUserMenu`) and `useAuth()` so the logged-out case is safe (AC-1, no login wall).

Regression sentinels:

- `R1` — `App.jsx` still registers the existing public routes (`/`, `/about`, `/how-search-works`,
  `/developers`) and the profile routes — `/feed` is *added beside* them, nothing removed.
- `R2` — the change is additive: `App.jsx` is the only existing shared file edited (its other routes
  are untouched) and the read-path module `src/api/feed/feedReadPath.js` is **not** modified by this
  story (no re-derivation — #1 owns the read path).

## Edge cases (explicitly covered)

- [x] **Each** of the three empty states renders its **own** exact copy and **zero** note entries
  (`T7`/`T8`/`T9`) — not a single generic empty message, and not a note list.
- [x] **Array order preserved / no re-sort** in the OK branch (`T4`) — the page renders `items` in the
  order the read path delivered them (already newest-first); it must not re-sort.
- [x] **Defensive transport/error case** beyond the four named states (`T15`) — a network/500/malformed
  body must still show a neutral line, never a raw stack or blank page (the AC's "never an error/blank"
  intent extended to the fifth case the ADR names).
- [x] **Long content / URL overflow** (`T11`/`T12`) — note text wraps (`overflow-wrap`/`word-break`)
  and the column is capped + `box-sizing: border-box`, so a single long token can't push past 1280px.
- [x] **Avatar fallback** (`T5`) — a null `author.avatar` falls back to the `bsp-avatar-placeholder`.
- [x] **Purity of the body helper** (`T14`) — no fetch/auth/router/browser globals, so it is the
  isolated state→view unit the ADR's testability rests on.

## Test infrastructure

- **Framework:** Node's built-in runner — `npm test` (= `node test/test.js`). New suite
  `test/live-feed-feed-page.test.js`, wired into `test/test.js` exactly as the other suites
  (required at top, `await …run()` in `main()`, included in the summary line and `overallOk`).
- **Convention:** source assertion via `fs.readFileSync` with a `safeRead` guard that returns `''`
  for a missing file — so a not-yet-created `BrainstormFeed.jsx`/`useFeed.js` yields a **legible
  feature-absent failure** ("does not exist yet"), not a `require`/crash.
- **No new tooling:** no Babel/esbuild/vitest/@testing-library, no `react-dom/server`, no Playwright.
- **Concept Graph API (`localhost:8877`):** **not used** — this page references no Concept-Graph
  concept (ADR §Concepts touched: None). No firmware install precondition.

## Prerequisites / environment

- **Node suite:** none beyond a checked-out repo. It reads source files only; no running stack,
  no graph, no firmware, no network.
- **Tier-4 staging smoke (book-level, gathered by the Director, not part of `npm test`):**
  - The rebuilt Vite `/dist` (with the `/feed` route) deployed to `staging.brainstorm.world`.
  - ADR 0001's `GET /api/feed` live on staging returning `OK` with items for the House PoV's
    follows (note: it 404s on the *current local* container — a #1 deploy concern, not this page's).
  - Evidence: `curl -s -o /dev/null -w "%{http_code}" https://staging.brainstorm.world/feed` → `200`
    (+ `text/html`), and a DOM extract / screenshot showing **≥ 3 rendered notes** (each author +
    text + timestamp), no horizontal scrollbar at a 1280px viewport.
  - Documented halt condition (book frame bullet 8): if staging's House PoV has no follows or the
    relays are unreachable at evidence time, that is external interference / a halt — not a defect in
    this page.

## How to run

```
npm test
```

(Browser/e2e via Playwright is intentionally **not** used here — its harness is reported broken, and
the per-story criteria are fully covered at the source level per the ADR's testability design.)

## Verification

The new tests fail with the current code (the page, hook, route, and CSS do not exist yet).
Confirmed on 2026-06-15 — see the verbatim `npm test` tail below. The `live-feed-feed-page` suite
fails with feature-absent messages (`BrainstormFeed.jsx does not exist yet`, `useFeed.js does not
exist yet`, no `/feed` route in `App.jsx`, no `bsp-feed-*` CSS), **not** a require/syntax crash; all
pre-existing suites still pass; the two regression sentinels (`R1`/`R2`) pass already.

```
live-feed-feed-page suite:
  ✗ T1: registers a top-level public /feed route mapped to BrainstormFeed (AC-1 reachability)
      App.jsx must declare a route with path '/feed' (the bookmarkable public page). Absent pre-implementation.
  ✗ T2: exports the exact heading copy "Live Feed" (AC-2 heading)
      ui/src/pages/BrainstormFeed.jsx does not exist yet — the Implementer must create the feed page (ADR 0002 Option A).
  ✗ T3: exports the exact recent-window indicator "Showing the most recent 50 notes." (AC-2 indicator)
      BrainstormFeed.jsx does not exist yet.
  ✗ T4: the OK branch renders the indicator then maps items in ARRAY ORDER without re-sorting (AC-2 order)
      BrainstormFeed.jsx does not exist yet.
  ✗ T5: each note entry shows author display name + avatar (with placeholder fallback) + timestamp + text (AC-2 content)
      BrainstormFeed.jsx does not exist yet.
  ✗ T6: derives the per-note timestamp from createdAt via a local formatTimestamp helper, with no date library (AC-2 timestamp)
      BrainstormFeed.jsx does not exist yet.
  ✗ T7: empty state 6a — NO_SOURCE renders the "no House point-of-view selected" copy and no entries (AC-3)
      BrainstormFeed.jsx does not exist yet.
  ✗ T8: empty state 6b — FOLLOW_LIST_UNAVAILABLE renders the "follow list not available locally" copy and no entries (AC-4)
      BrainstormFeed.jsx does not exist yet.
  ✗ T9: empty state 6c — EMPTY renders the "no recent notes from accounts this identity follows" copy and no entries (AC-5)
      BrainstormFeed.jsx does not exist yet.
  ✗ T10: useFeed fetches /api/feed and surfaces a transport failure as `error` (supporting AC-1/AC-2 plumbing)
      ui/src/hooks/useFeed.js does not exist yet — the Implementer must create the data hook (ADR 0002 §Impl, mirroring useGrapevineFollows.js).
  ✗ T11: note text wraps so a long token cannot overflow 1280px (overflow-wrap / word-break) (AC-1 no overflow)
      styles.css must define at least one new bsp-feed-* rule for the feed items (none exist pre-implementation).
  ✗ T12: the feed column is width-capped with box-sizing:border-box so content cannot exceed 1280px (AC-1 no overflow)
      BrainstormFeed.jsx does not exist yet.
  ✗ T13: useFeed mirrors the hook convention — returns { data, loading, error } and aborts on unmount (supporting)
      useFeed.js does not exist yet.
  ✗ T14: the body is a PURE, named-exported renderFeedState/FeedBody of {data,loading,error}, free of fetch/auth/router/browser globals (ADR testability)
      BrainstormFeed.jsx does not exist yet.
  ✗ T15: a transport/error or unknown status renders a neutral "couldn't load" line, never a raw error or blank (defensive case)
      BrainstormFeed.jsx does not exist yet.
  ✗ T16: the page reuses the plain public shell (bsp-page/bsp-top-bar/bsp-content + BrainstormUserMenu) and useAuth, so the logged-out case is safe (AC-1 no login wall)
      BrainstormFeed.jsx does not exist yet.
  ✓ R1: App.jsx still registers the existing public + profile routes — /feed is ADDED beside them, nothing removed (additive)
  ✓ R2: this story re-derives nothing — the read-path module src/api/feed/feedReadPath.js is NOT modified by the page (the #1/#2 split)

...

reputation-info-popup suite:                     PASS (16 passed, 0 failed)
live-feed-read-path suite:                       PASS (23 passed, 0 failed)
live-feed-feed-page suite:                       FAIL (2 passed, 16 failed)
Overall:                                         FAIL
EXIT_CODE=1
```

All 34 pre-existing suites still PASS (including `live-feed-read-path` 23/0). The new suite fails
16/18 with feature-absent messages; the two regression sentinels (`R1`/`R2`) pass already.
