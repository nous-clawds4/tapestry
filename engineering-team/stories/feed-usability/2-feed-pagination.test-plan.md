# Test Plan: Story 2 — "Load more" pagination on the feed surfaces

**Story:** `engineering-team/stories/feed-usability/2-feed-pagination.md`
**ADR:** `engineering-team/decisions/feed-usability/0002-feed-pagination.md`
**Date:** 2026-07-03

## Test level decision

- **Server behavioral (SF, SU)** — executes the real `feedReadPath.js` / `userNotesReadPath.js`
  with injected deps. A `querySync` fake **records the filter it receives** and returns the
  fixture corpus at-or-before `filter.until`, so the tests prove the cursor is threaded, a
  string `until` is coerced to a number, junk `until` is ignored, and the older-slice ordering
  holds — with no live relays/strfry/Neo4j (the established injectable-deps seam).
- **UI sentinels (H, P)** — source-regex on the hooks and pages (the Node runner has no JSX
  transpile). They pin the accumulation machine (`until` cursor, append-not-replace, dedup by
  id, `loadMore`/`loadingMore`/`exhausted`, stale guard), the react-virtuoso render + Footer
  wiring, the truthful count indicator, and the new `ui/package.json` dependency.
- **Runtime** — the bounded-DOM / scroll-restore property (mounted `.bsp-note-card` count stays
  bounded while total loaded grows; scroll-back restores the newest) is the **cycle-local
  browser smoke before review**, per house feedback — virtuoso owns windowing; the suite pins
  that the page delegates to it.

## Coverage map

| Criterion | Test(s) | File | Level |
|---|---|---|---|
| Control appears when there may be more | P1, P2 (Virtuoso Footer wired to `loadMore`) | `test/feed-pagination.test.js` | UI sentinel |
| Loading appends older, in order, no duplicates | SF1/SF2, SU1/SU2 (`until` cursor → older slice, newest-first), H1/H2 (append-not-replace + dedup-by-id) | same | server behavioral + UI sentinel |
| Composes with the toggle | R1 (mode + isReply + filter + REPLY_ONLY survive on both pages; cursor walks raw stream) | same | regression |
| Exhaustion is signalled | H1/H2 (`exhausted` flag), P1/P2 (end-of-history copy; no dead button) | same | UI sentinel |
| Loading state is visible; no double-append | H1/H2 (`loadingMore` + stale/in-flight guard) | same | UI sentinel |
| Bounded live content under sustained loading | P1/P2 (react-virtuoso windowed render), P3 (dep declared) — runtime bound verified in cycle-local | same + smoke | UI sentinel + runtime |
| Window indicator stays truthful | P1/P2 (count-derived `…​.length` indicator, fixed "most recent 50" gone); shipped T3 relaxed | same + `live-feed-feed-page.test.js` | UI sentinel |

## Edge cases

- [x] Page 1 sends **no** `until` (unchanged first page) — SF1, SU1.
- [x] `until` arrives as a **string** (`req.query.until`) → coerced to a number on the filter — SF2, SU2.
- [x] **Junk** `until` ignored (no NaN/garbage on the filter) — SF3, SU3.
- [x] Handler wiring: `until: req.query.until` forwarded into the orchestrator — SF4, SU4.
- [x] The **until-boundary** note (reappears at `created_at === until`) is deduped by id — H1/H2 dedup sentinel; SF2/SU2 assert the older slice.
- [x] Repeated "Load more" while loading makes no duplicates — H1/H2 stale/in-flight guard.
- [x] Reply toggle composes with pagination (Notes mode appends only top-level) — R1.
- [x] Pre-existing empty states + notes `EMPTY` copy survive — R2.
- [x] Both read paths still funnel through the shared `enrichNotes` — R3.

## Shipped-suite updates (required by ADR 0002, done in this phase)

The virtualization + truthful-indicator change invalidates three shipped sentinels; each was
updated to accept the new rendering (they still pass on current code, and will pass post-impl):

- `test/live-feed-feed-page.test.js` **T3** — was "exact fixed indicator `Showing the most
  recent 50 notes.`"; now pins the `bsp-feed-indicator` element (truthful count wording owned by
  this suite's P1). The fixed-50 literal is deliberately dropped (AC: truthful indicator).
- `test/live-feed-feed-page.test.js` **T4** — the "one entry per note" clause now accepts
  `items.map(...)` **or** `itemContent={…}` (virtualized).
- `test/note-surfaces-ui.test.js` **:180** — same `items.map` / `itemContent` relaxation.

The profile Content-section sentinels (`note-surfaces-ui.test.js:99-100`, "single note, no
`.map`") are **untouched** — Story 3's card is not virtualized.

## Test infrastructure

- Node runner; suite registered in `test/test.js` (require + run + `overallOk`), exports `{ run }`.
- No live services: server tests use in-memory `querySync`/`scanStrfry`/`runCypher` fakes;
  UI/dep checks are source/JSON reads.
- Fixtures: a 3-note kind-1 corpus (created_at 300/200/100) authored by one followed/viewed
  pubkey; a kind-3 follow-list fake for the feed source.

## How to run

```
npm test
# or just this suite:
node -e "require('./test/feed-pagination.test.js').run()"
```

## Verification

New tests fail against current (Story-1) code for the right reasons; regression + page-1 guards
pass. Confirmed 2026-07-03 at commit `156558bc` (9 fail / 7 pass):

```
✓ SF1: page 1 sends NO until (unchanged first page)
✗ SF2: buildFeed threads a string until → numeric relay cursor        (until not threaded yet)
✓ SF3: buildFeed ignores a junk until
✓ SU1: notes page 1 sends NO until; OK with full corpus
✗ SU2: buildUserNotes threads a numeric until cursor                  (until not threaded yet)
✓ SU3: buildUserNotes ignores a junk until
✗ SU4: notes handler forwards req.query.until                         (wiring absent)
✗ SF4: feed handler forwards req.query.until                          (wiring absent)
✗ H1: useFeed accumulates via until cursor (loadMore/loadingMore/exhausted)   (one-shot hook)
✗ H2: useUserNotes accumulates via until cursor                              (one-shot hook)
✗ P1: BrainstormFeed renders Virtuoso + Footer + truthful indicator          (not virtualized)
✗ P2: BrainstormUserNotes renders Virtuoso + Footer + truthful indicator     (not virtualized)
✗ P3: react-virtuoso is a declared ui dependency                             (dep absent)
✓ R1: reply toggle still composes (mode + isReply + filter + REPLY_ONLY)
✓ R2: pre-existing empty states survive
✓ R3: both read paths still funnel through shared enrichNotes
=> feed-pagination pass: 7 fail: 9
```

Edited shipped suites re-verified on current code: `live-feed-feed-page` 27/0;
`note-surfaces-ui` 18/1 (the 1 is the pre-existing `NoteCard`-variant R2, unrelated — already
failing on the parent commit; the `:180` edit added no new failure).
