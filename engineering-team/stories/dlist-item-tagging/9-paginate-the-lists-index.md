# Story 9: Paginate the lists index and count only the visible page

**Status:** Approved
**Created:** 2026-09-17
**Type:** Feature *(Light lane — workflows/light-profile.md; Gate A approved 2026-09-17 in
session — page size 50; a NEW bounded counts endpoint taking the page's coordinates, the
existing `/api/dlists/item-counts` untouched; scoped gate `test/dlist-browse.test.js` +
`test/dlist-index-page-counts.test.js` (new) + the strfry write-assertion guard suite)*

## Background
On tags.brainstorm.world the `/lists` index sat on "Loading lists…" for tens of seconds
(operator, first live check). Measured: the header scan takes 0.4 s (159 headers); the counts
call takes **39 s** because `GET /api/dlists/item-counts` walks **every** list item on the relay
(455,178, mostly dcosl firehose kind-9999) on every request. The client was un-gated as a hotfix
(`fb761edf`: headers render first, counts arrive later — OPEN 301), but the O(relay) cost is still
paid per page load, and the index renders every header at once. Pagination alone would not fix
it; **pagination plus counting only the visible page** does: the count cost becomes O(page).

## User-facing description
As a user opening the lists index on a relay with hundreds of lists, I want the first page to
appear immediately with its item counts, and a way to reach the next page, so that the index is
usable regardless of how many lists (or how much junk) the relay holds.

## Acceptance criteria
- [ ] AC-1: Given a relay with more than 50 list headers, the index shows the first 50 (newest
      first, as today) with a "showing N of M" line and a next-page control; the total M is the
      header count, stated as unknown (not zero) if the header scan was bounded.
- [ ] AC-2: Item counts for the visible page arrive from a **new** endpoint that accepts the
      page's header coordinates (at most 50) and returns `{ [coord]: count }`, computed by a
      bounded per-coordinate scan (`#z` for 39998, `#e` for 9998); it never walks the whole relay.
- [ ] AC-3: The existing `GET /api/dlists/item-counts` is unchanged (its other consumers are not
      this story's concern), and `/lists` no longer calls it.
- [ ] AC-4: The filter box (story 8) narrows the **loaded** headers; with pagination, it narrows the
      current page and says so ("matches on this page"), not silently across pages.
- [ ] AC-5: A counts request that fails or times out leaves the page rendered with "—" counts, never
      blank and never an error page; a malformed coordinate in the request is rejected with 400 and
      does not abort the others.
- [ ] AC-6: The list page (`/list/:ref`) and its pagination are untouched (regression sentinels).

## Concepts touched
- None new. `39998:<TA>:list` (headers), kinds 9998/39998/9999/39999.

## Out of scope
- Fixing or caching the old whole-relay `item-counts` endpoint (OPEN 301 stays open for its other
  consumers). Server-side header pagination (the header scan is fast; bound it, don't page it).
- Sorting options on the index.

## Design note *(Light — after Gate A)*
—

## Edge cases & not-covered
—

## AC→handle lines
—

## Linked artifacts
- ADR: none expected (rendering + one additive read endpoint; no wire format, no schema)
- Review: `engineering-team/reviews/dlist-item-tagging/9-paginate-the-lists-index.md`

Link by path only — never record verdicts or round history in this file.
