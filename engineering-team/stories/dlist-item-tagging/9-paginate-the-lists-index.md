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
      blank and never an error page. Malformed coordinates are reported **per coordinate** in an
      `invalid` list while the rest are still counted; HTTP 400 is reserved for `coords` missing or
      empty, or every coordinate malformed. *(Wording amended at J1 2026-09-17: the original "400 and
      does not abort the others" was self-contradictory.)*
- [ ] AC-6: The list page (`/list/:ref`) and its pagination are untouched (regression sentinels).

## Concepts touched
- None new. `39998:<TA>:list` (headers), kinds 9998/39998/9999/39999.

## Out of scope
- Fixing or caching the old whole-relay `item-counts` endpoint (OPEN 301 stays open for its other
  consumers). Server-side header pagination (the header scan is fast; bound it, don't page it).
- Sorting options on the index.

## Design note *(Light — after Gate A)*
- **Server (new, additive).** New CJS module `src/api/dlists/pageCounts.js` exporting
  `handleListPageCounts(req, res)` + `countsForCoords(coords, deps)`; re-exported from
  `src/api/dlists/index.js`; mounted one line below the existing counts route in
  `src/api/index.js:269` as `app.get('/api/dlists/page-counts', dlists.handleListPageCounts)` —
  public, read-only, no auth, no TA pubkey, no publish (mirrors `item-counts`'s mounting).
  Shape: `GET /api/dlists/page-counts?coords=<comma-separated, ≤50>` →
  `{ success: true, counts: { [coord]: number }, invalid: [coord…], partial: bool }`.
  **GET, not POST**: the neighbouring dlists route is GET, it is a pure read, and GET is cacheable.
  Per coordinate the handler runs `strfry scan --count` with `{kinds:[9999,39999], '#z':[coord]}`
  when the key looks like `39998:<64hex>:<d>`, and `{kinds:[9999,39999], '#e':[id]}` when it is a
  bare 64-hex event id — the same key convention `itemCounts.js:headerRef()` produces and that
  *(J1 caveat: the two diverge for a header with no `d` — `itemCounts.js` yields `39998:<pk>:undefined`,
  `dlistFields.js` `headerCoord` yields `39998:<pk>:`. The new endpoint is fed by the client, so the
  client's form is the contract; the validator accepts an empty `d` segment — E4.)*
  `Lists.jsx` already looks up, so the client's `counts[coord]` lookup is unchanged.
  **Named bounds:** `MAX_COORDS = 50` (extras rejected, not counted), `CONCURRENCY = 8` spawns in
  flight, `DEADLINE_MS = 10000` per request — coords unresolved at the deadline are omitted from
  `counts` and the response sets `partial: true` (client renders `—`, AC-5). Spawn with argv
  (`spawn('strfry', ['scan','--count',JSON.stringify(filter)])`), *not* the shell-string `exec` in
  `src/api/strfry/queries/scanCount.js`; the counting idiom is deliberately re-typed here rather
  than extracted from `itemCounts.js` so that file stays byte-unchanged (AC-3).
- **AC-5, per-coordinate rejection (AC wording amended here).** A malformed coordinate is *not* a
  request-level 400: it goes into the `invalid` array and every other coordinate is still counted,
  which is what "does not abort the others" requires. HTTP 400 is reserved for the two
  request-level failures — `coords` missing/empty, or *every* coordinate malformed. Validation is a
  shape check only (`^39998:[0-9a-f]{64}:` with any remainder, or `^[0-9a-f]{64}$`); it never asks
  whether the list exists or who authored it (principle 2 — no gating on authorship).
- **Client.** `ui/src/pages/Lists.jsx` only. Swap the unbounded `queryRelay({kinds:[9998,39998]})`
  for `queryRelayBounded({ kinds:[9998,39998], limit: 50 })` and mirror `ui/src/pages/List.jsx`
  idiom-for-idiom: `total`/`truncated`/`exhausted`/`paging` state, `totalLabel = total === null ?
  'unknown' : total`, the "Showing N of M" line, and `loadMore()` using
  `until = Math.min(...created_at)` with id de-dupe and the `fresh.length === 0 → setExhausted(true)`
  guard. `List.jsx` itself is **not edited** (AC-6). New tiny client module `ui/src/api/dlists.js`
  exporting `fetchPageCounts(coords)` (fetch → json → `counts` or `{}`), called non-blockingly after
  each page's headers land with just that page's fresh coords and merged into the existing counts map
  (`setCounts(prev => ({ ...prev, ...next }))`), so the 50 rows paint before any count arrives.
  `/api/dlists/item-counts` is removed from `Lists.jsx` (AC-3) and from nowhere else.
- **AC-4 copy.** The filter (`matchesListQuery`, story 8) keeps operating over the loaded headers
  only. Label under the filter box: `{visible.length} matching of {headers.length} loaded`; empty
  state: `No lists match on this page.` — never a bare "No lists match", which reads as "nowhere on
  this relay".
- **Rejected alternative: add a `?coords=` mode to the existing `/api/dlists/item-counts`.** It looks
  cheaper (one endpoint, one module) but is not: that handler sits behind a module-level cache keyed
  on a whole-relay validator (item count + newest `created_at` + header count) and its payload carries
  *union* semantics (`totalItems` counts a multi-list item once) that a per-page slice cannot produce.
  A coords mode would either poison that cache or need a second one, and `test/relay-scan-bounds.test.js`
  E1–E3 asserts the endpoint's four figures live. Gate A pinned it untouched; a separate route keeps the
  old contract literally untouched and lets the new one be deleted when OPEN 301 is finally fixed.
- **Blast radius.** *Touched:* `ui/src/pages/Lists.jsx` (the only `/lists` consumer of the old endpoint),
  **Also touched (J1 finding):** `test/dlist-browse.test.js` — its S3 sentinel (`:365-366`) asserts
  `Lists.jsx` fetches `/api/dlists/item-counts` with a `.catch`, the very call AC-3 removes. That
  suite is in this story's scoped gate, so the sentinel is re-aimed **in this story** to assert the
  new `fetchPageCounts` call (non-blocking, with its catch) — a re-aim to the ruled behaviour, not a
  loosening; `:459` (the operator page still calls `item-counts`) stays as is.
  new `ui/src/api/dlists.js`, new `src/api/dlists/pageCounts.js`, `src/api/dlists/index.js` (one export),
  `src/api/index.js` (one mount line), optionally `src/api/openapi.yaml` (doc entry). *Grep-verified
  non-consumers* (`grep -rn "item-counts" src ui test`): `ui/src/pages/lists/Index.jsx:69` — the operator
  lists page still fetches `/api/dlists/item-counts` and keeps its union `totalItems`, guarded by the
  existing sentinel at `test/dlist-browse.test.js:459`; `src/api/dlists/itemCounts.js`,
  `ui/src/pages/List.jsx`, `ui/src/utils/dlistFields.js` all unchanged. No concept or schema change →
  **no firmware reinstall**. No new deps, no build tooling.
- **Test seam.** `countsForCoords(coords, deps)` takes `deps = { countFilter }` defaulting to the real
  spawn-based counter, so `test/dlist-index-page-counts.test.js` can require the handler directly and
  drive it with a stub counter — the same shape as the injected-`child_process.exec` seam in
  `test/dlist-tagged-items.test.js`. Client wiring is pinned by source sentinels on `Lists.jsx`; `R*`
  sentinels cover `List.jsx` and the untouched `item-counts` route + handler.

## Edge cases & not-covered
- **E1** The header scan hits its bound → `total === null` → "Showing 50 of unknown (scan was
  bounded)", never "of 0" (AC-1; mirrors `List.jsx:175`).
- **E2** Two headers share a `created_at` at the page boundary → `until`-paging plus id de-dupe
  neither skips nor repeats; a page yielding no fresh ids sets `exhausted` and hides the next control.
- **E3** A 39998 header is republished (same `d`) between page 1 and page 2: the relay holds one event
  but its `created_at` moved, so id de-dupe may admit it on both pages. Counts key by coordinate, so the
  duplicate row shows the same number; keep the React key on `h.id`.
- **E4** *(not derivable from any AC)* A kind-39998 header with an **empty or missing `d` tag** yields
  the coordinate `39998:<pk>:` — legal nostr and legal here. The validator must accept an empty final
  segment, or every such list silently loses its count.
- **E5 (not derivable from any AC):** a `d` containing a comma (`39998:<pk>:my,list`) survives intact
  and counts under its verbatim key, because coordinates are repeated query params, never delimiter-joined
  (ruling 2). Handle: H6.
  the fragments fail validation and land in `invalid`, so that one row reads `—` while the rest of the
  page counts normally. A documented limitation of the GET-CSV shape, not a crash.
- **E6** *(not derivable from any AC)* 50 coordinates with long `d` tags push the encoded query past
  nginx's 8 KB header buffer → 414/400 for the whole batch → every row reads `—` (the AC-5 fallback
  covers it). The 50-coord cap keeps the typical worst case near 6 KB.
- **E7** One `strfry scan --count` hangs → `DEADLINE_MS` fires, the child is killed, resolved coords
  still return with `partial: true`; the page never blocks on it.
- **E8** Duplicate coordinates in one request (or a header listed twice) → de-duped server-side, counted
  once, one key in the response.
- **E9** Zero headers on the relay → "No lists on this relay yet." and the client makes **no** counts
  call (an empty `coords` is a request-level 400, so don't send it).
- **E10** An item in two lists counts in **both** per-list figures; `page-counts` deliberately returns no
  union total — the index never showed one. Only the operator page's `totalItems` does, still from the
  old endpoint.
- **E11** The user types a filter, then clicks "next page": the newly loaded headers are filtered too, so
  the "matching of loaded" label must recompute — it must not freeze at page one's numbers.

**Not covered:** the O(relay) cost of `GET /api/dlists/item-counts` itself (OPEN 301 stays open for
`ui/src/pages/lists/Index.jsx`); server-side pagination of the header scan (headers are 0.4 s — bound it,
don't page it); any caching or invalidation of page counts (each page load re-counts its own 50
coordinates); counts for lists the user has not paged to; sorting options on the index; and any per-POV
notion of which lists or items "count" — this endpoint reports raw relay membership for everyone alike.

## AC→handle lines

**Suites:** `test/dlist-index-page-counts.test.js` (new, this story) and `test/dlist-browse.test.js`
(S3 re-aimed here — see "Guard-suite carve-out" below).

**Legend** *(mirrors `test/dlist-tagged-items.test.js`)*
- **U\*** — BEHAVIORAL, server. `countsForCoords(coords, deps)` is required for real and driven with
  an injected counter (`deps.countFilter`) — no strfry binary, no relay, no stack, no Docker. This is
  where the story's value lives: bounds, concurrency, deadline, per-coordinate validation, failure
  isolation.
- **H\*** — BEHAVIORAL, HTTP boundary. `handleListPageCounts(req, res, deps)` driven with a fake
  `req`/`res`: query parsing, the three request-level 400s, and the exact JSON shape.
- **S\*** — SOURCE-CONTRACT. The client half is ESM/JSX and is not requirable from the Node runner,
  so those ACs are pinned by reading the source. Documented level gap, same as story 1's S-tests.
- **R\*** — REGRESSION SENTINEL. Passes TODAY and must keep passing (AC-3 / AC-6).

| AC | Handles |
|---|---|
| AC-1 — first 50 headers, newest first, "showing N of M", next-page control, unknown total | S2, S3 |
| AC-2 — new bounded endpoint taking the page's coordinates, `#z`/`#e`, never walks the relay | U1, U2, U3, U4, U10, H4, H5, S1, S4, S6 |
| AC-3 — `item-counts` unchanged; `/lists` no longer calls it | S1, S4, R2, R3, R4, `dlist-browse` S3 (re-aimed) |
| AC-4 — the filter narrows the loaded page and says so | S5 |
| AC-5 — failure/timeout leaves "—"; per-coordinate `invalid`; 400 only for missing/empty/all-malformed | U5, U7, U8, H1, H2, H3, H7, S4 |
| AC-6 — `/list/:ref` and its pagination untouched | R1 |

| Edge case | Handles |
|---|---|
| E1 bounded header scan → `total === null` → "unknown", never "of 0" | S2 |
| E2 shared `created_at` at the page boundary; `until` + id de-dupe; `exhausted` guard | S3 |
| E3 header republished between pages → React key stays `h.id` | S3 (key sentinel only — see gaps) |
| E4 empty `d` → coordinate `39998:<pk>:` accepted and counted | **U6** *(not derivable from any AC)* |
| E5 comma inside a `d` → invalid fragments, one row reads "—", rest of page counts | **H6** *(not derivable from any AC)* |
| E6 50 long coords exceed nginx's header buffer → whole batch fails → every row "—" | **NOT COVERED** (out-of-process proxy limit); the client-side consequence is the S4/AC-5 "—" path |
| E7 one scan hangs → `DEADLINE_MS` → resolved coords return with `partial: true` | U8 |
| E8 duplicate coordinates → one scan, one key | U9 |
| E9 zero headers → no counts call at all (empty `coords` is a 400) | H2 |
| E10 an item in two lists counts in both; no union total in the response | H4 (shape is exactly `{success,counts,invalid,partial}`; `totalItems === undefined`) |
| E11 filter then "next page" → the "matching of loaded" label recomputes | S5 (label derived from live `visible.length`/`headers.length`) |

### External-dependency error paths (J2 rubric 2)

| Dependency | Error path | Handle |
|---|---|---|
| `strfry scan --count` spawn | one coordinate's count rejects (ENOENT, non-zero exit, unparsable output) → sibling coordinates still count; the failed coordinate carries no number | **U7** |
| `strfry scan --count` spawn | one child hangs past `DEADLINE_MS` → omitted from `counts`, `partial: true`, request returns promptly | **U8** |
| `strfry scan --count` spawn | the counter throws synchronously → the handler still answers exactly once, with JSON | **H7** |
| client `fetch` of `/api/dlists/page-counts` | network/500/timeout → caught, page stays rendered, rows read "—" | **S1** (fallback to `{}`), **S4** (`.catch`, non-blocking, "—") |
| nginx query-length ceiling (E6) | 414/400 for the whole batch | **explicitly not covered** — out-of-process; same client fallback as above |
| the old `/api/dlists/item-counts` | unchanged; its O(relay) cost stays OPEN 301 | not this story (Out of scope) |

### Guard-suite carve-out

`test/dlist-browse.test.js` is a **guard suite** for stories 1/8 and is in this story's scoped gate.
Phase 4 (Implementation) is **barred from editing it**. Its S3 case is re-aimed **here, in Test
Design**, and only there — three assertions at the old `:364-366`:

- `queryRelay(` → `queryRelayBounded(`
- `src.includes('/api/dlists/item-counts')` → `fetchPageCounts` present **and** `item-counts` absent
- the `.catch` assertion re-worded from "item-counts failure" to "a counts failure"

`:459` (`R3` — the operator page still fetches `item-counts`) is deliberately **untouched**. Any
further edit to that file during Phase 4 is a review finding.

### Pre-implementation run record

Command (repo root, no system node):

```
timeout 120 env BRAINSTORM_BASE_URL=http://localhost:8778 direnv exec . node -e \
  "require('./test/<suite>.test.js').run().then(r=>{console.log(r);process.exit(r.fail?1:0)})"
```

| Suite | Result | Notes |
|---|---|---|
| `test/dlist-index-page-counts.test.js` | **`{ pass: 4, fail: 23, skipped: 0 }`** — exit 1 | Red: U1–U10, H1–H7, S1–S6. Green: R1–R4 (the sentinels that must stay green). |
| `test/dlist-browse.test.js` | **`{ pass: 24, fail: 1, skipped: 0 }`** — exit 1 | The single failure is the re-aimed S3. Every other case unchanged and green. |

Representative failures (verbatim) — each fails for the *ruled* reason, not an import typo:

```
✗ U1: a 39998 coordinate is counted with a #z filter on kinds 9999/39999, a bare 64-hex id with #e
    Design note: src/api/dlists/pageCounts.js must exist and be requirable —
    Cannot find module '/home/vcavallo/src/tapestry/src/api/dlists/pageCounts.js'
✗ S1: ui/src/api/dlists.js exports fetchPageCounts(coords) hitting /api/dlists/page-counts …
    Design note: new client module ui/src/api/dlists.js must exist
✗ S2: Lists.jsx pages 50 headers at a time with queryRelayBounded …
    AC-1: the header scan is bounded via queryRelayBounded
✗ S5: the filter label counts matches within the loaded page and says so (AC-4/E11)
    AC-4: the label reads "{N} matching of {M} loaded"
✗ S6: the server route is mounted next to item-counts and re-exported from the dlists module (AC-2)
    Design note: GET route mounted in src/api/index.js
✓ R1: List.jsx (/list/:ref) pagination idiom is untouched (AC-6)
✓ R3: the existing /api/dlists/item-counts route is still mounted (AC-3)
```

`test/dlist-browse.test.js`:

```
✗ S3: Lists.jsx (/lists index) scans both header kinds, joins page-counts with a — fallback, …
    AC-6 (story 9 re-aim): index scans kinds 9998 and 39998 through the bounded reader
{ pass: 24, fail: 1, skipped: 0 }
```

### Open questions the Design note does not settle (for the Implementer / Gate B)

1. **`MAX_COORDS` over-cap behaviour is ambiguous.** The note says "extras rejected, not counted",
   which reads as *truncate to 50*; Gate A's direction is *reject the request*. **H5 pins HTTP 400
   with zero scans spawned.** `U3` pins only the weaker invariant (never more than `MAX_COORDS`
   scans) so the module-level contract survives either reading. If the Implementer prefers
   truncation, that is a Design-note amendment, not a silent choice.
2. **E5 is self-inconsistent as written.** It says "the fragments fail validation", but the note's own
   shape check (`^39998:[0-9a-f]{64}:` with *any* remainder) **accepts** the head fragment
   `39998:<pk>:my` of a split `39998:<pk>:my,list`. H6 therefore pins only what both readings agree
   on: the full comma-bearing coordinate gets no `counts` key, the tail fragment `list` lands in
   `invalid`, and the rest of the page counts normally. Whether the head fragment appears in `counts`
   under a truncated key is **unspecified** — the Implementer should either drop it or accept it
   knowingly, and say which.
3. **The handler needs the same test seam as `countsForCoords`.** The note gives `deps` only to
   `countsForCoords`; the H\* cases require `handleListPageCounts(req, res, deps)` to accept an
   optional third argument forwarded to `countsForCoords` (defaulting to the real spawn counter).
   Treat this as a Design-note addition made at Test Design.
4. **`DEADLINE_MS` needs an override for tests** — U8 passes `deps.deadlineMs: 80`. Without it the
   deadline case costs 10 s of wall clock per run.
5. **Named bounds are asserted as exported constants** (U2: `MAX_COORDS`, `CONCURRENCY`,
   `DEADLINE_MS`). The note calls them "named bounds"; exporting them is the testable form.

### Known level gaps (not defects, recorded for Gate B)

- AC-1's "newest first" ordering, AC-4's rendered label, and E3's cross-page duplicate row are pinned
  by **source sentinels only** — there is no DOM runner in this suite set and this story adds none.
  A Playwright case would need a relay with >50 headers; out of scope.
- E6 (nginx buffer) is not automatable in-process; recorded as not-covered with its reason.

## Linked artifacts
- ADR: none expected (rendering + one additive read endpoint; no wire format, no schema)
- Review: `engineering-team/reviews/dlist-item-tagging/9-paginate-the-lists-index.md`

Link by path only — never record verdicts or round history in this file.

## Rulings on the Test-Design open questions (harness driver, 2026-09-17)
1. **Over-cap → HTTP 400 for the whole request**, no truncation. The client never sends more than
   a page; a >50 request is a caller bug, and silently counting 50 of 51 would misreport.
   `countsForCoords` keeps the weaker module contract ("never more than `MAX_COORDS` scans").
2. **Coordinates travel as repeated query params** (`?coords=<c1>&coords=<c2>…`), which Express
   parses to an array with no delimiter — the comma-in-`d` case (E5) cannot arise on the wire. A
   single `coords=` value is still accepted as a one-element array. The CSV form in the Design note
   is superseded by this line; H3–H6 were rewritten to the array shape at Test Design (J2 kickback).
3. `handleListPageCounts(req, res, deps)` forwards `deps` to `countsForCoords`; `deps.deadlineMs`
   overrides `DEADLINE_MS`; the three bounds are exported constants. (Tester additions, ratified.)
