# ADR 0001: A bounded scan contract, and one pass for list membership and totals

**Status:** Accepted
**Date:** 2026-09-07
**Story:** `engineering-team/stories/relay-scan-bounds/1-bound-simple-lists-relay-scans.md`

## Context

The story's acceptance criteria, quoted:

1. List Headers renders with no error on a relay holding ≥ 450,000 list items.
2. Every row's Items count is the **true** count — exact, not capped, not approximate.
3. List Items renders a bounded set and states *"showing N of M"* on screen; a truncated view
   is never presented as complete.
4. The shared relay-scan API, given an unbounded filter — including `{"kinds":[9999,39999]}`,
   the request that fails today — returns either a bounded successful result or an explicit
   refusal. Never a `maxBuffer` failure, never a quietly partial or quietly empty result.
5. Deployments holding few items show **the same** counts and the same items they show today.

Two independent decisions follow: how the per-list counts are obtained (AC 1, 2, 5), and what
contract the shared scan endpoint presents (AC 3, 4, 5).

### Measured, 2026-09-07

Against all four deployments and the local container. These numbers drive the decisions.

| Fact | Value |
|---|---|
| List items on relay | staging 473,101 · tags 451,662 · prod 8,897 · local 9,497 |
| List headers on relay | staging 322 · tags 156 · prod 47 · local 270 |
| `/api/strfry/scan` `{"kinds":[9999,39999]}` | staging/tags fail · prod 8.08 MB · local 8.54 MB |
| Mean event size | ~880 bytes, consistent across deployments |
| `strfry scan --count`, whole set (staging) | 0.52 s |
| `strfry scan --count`, one `#z` value (staging) | ~0.18 s round-trip; 22,556 items on the hottest list |
| **270 sequential `--count` spawns (local)** | **8,074 ms** — ~30 ms each, dominated by process spawn |
| **Streaming tally of 9,497 events (local)** | **208 ms**, 8.5 MB, constant memory |
| nginx URI limit | a 322-ref filter is ~28 KB → **HTTP 414** on staging |
| `strfry scan` with `limit` | returns newest-first (verified descending `created_at`) |
| `strfry scan` flags available | `[--pause] [--metrics] [--count] <filter>` — no group-by |
| `/api/neo4j/event-uuids` (the page's other call) | 48 KB on staging — checked, not a scaling risk |

Prod and local do not pass because they are configured differently. They pass with 1.9 MB and
1.5 MB of headroom under the same ceiling.

### The pivotal fact: two different counting rules, now specified

`ui/src/pages/lists/Index.jsx:87-99` attributes each item to **one** parent — its *first* `z`
tag, else its *first* `e` tag. That is not a designed rule; it is what `getTag()` returns when
an item carries more than one `z` tag, and 427 of 9,497 local items (4.5%) do.

The operator specified the intended semantics at the ADR gate, 2026-09-07:

> **Per-list count** — set membership. An item belonging to two lists counts in **both**.
> **Page total** — the union. That same item counts **once**.

So the two figures are deliberately not additive: two lists of 10 sharing 5 items are
"10", "10", and a total of 15. This ADR implements that rule.

Measured impact on the local relay (270 headers, 9,497 items):

| Figure | Today | Under the specified rule |
|---|---:|---:|
| Rows displaying a count | 28 | 28 |
| Rows whose number changes | — | **7** (all upward) |
| Page total | 9,497 (every list-item event on the relay) | **9,368** (items in >= 1 shown list) |

The 129-item gap in the total is 118 items whose parent ref names no header the page shows,
plus 11 carrying neither a `z` nor an `e` tag. Under the union rule they are correctly excluded
— they are in no list.

Two consequences for the design. First, per-header `strfry scan --count '{"#z":[ref]}'` now has
the *correct* per-list semantics, since a tag filter is any-match. Second, it still cannot
produce the total: the union needs each event counted once across all refs, which no
combination of independent counts can give. One pass yields both figures; N counts yield one.

### Constraints

- **ADR `event-tagging/0017`** already sets the house pattern for this exact class: *"complete,
  or explicitly partial — never silently small-capped"*, an explicit scan `limit` chosen so it
  "never overflows the buffer", and a `truncated` signal alongside `total`. Its
  `TAGGING_SCAN_LIMIT` is ≈ 20,000. This ADR aligns with it rather than inventing a second
  convention. `src/api/event-tags/index.js:433` is the concrete response shape:
  `{ …, total, truncated, limit }`.
- **The counts must come from the relay, not Neo4j.** The List Headers page carries a "Neo4j"
  column whose whole purpose is to show where relay state and graph state *diverge*
  (`Index.jsx:243`). Sourcing the counts from the graph would make that column compare Neo4j to
  itself. The divergence is real and large here — 48 KB of `NostrEvent` uuids in Neo4j against
  473,101 items on staging's relay. Invariant 4 / BIBLE §30 and the `registry-reads-graph`
  precedent (`stories/_intake.md`, 2026-08-09) already establish that a relay scan and a graph
  traversal return different sets by design.
- No new build, lint, or typecheck tooling (CLAUDE.md).

### Concepts

Verified live against the local graph (`/api/concept-graph/node/…`). Handles are per-deployment;
`<TA>` resolves at runtime — on this dev instance `e00ed090…9df36`.

- `39998:<TA>:list` — **list**, "A list header with associated list items". The concept both
  pages surface: List Headers renders the headers, List Items the items.
- `39998:<TA>:concept-header` — **concept header**. Kind-39998 events carry both `ListHeader`
  and `ConceptHeader` labels, so the counts must be right for these rows too.

No concept definition changes. **No firmware reinstall required.**

## Options considered

### Decision 1 — how List Headers gets exact per-list counts

#### Option A — a grouped tally computed server-side by streaming

A new endpoint spawns `strfry scan` for the item filter, reads stdout line by line, and tallies
each event under the first tag matching an ordered list of tag names (`z`, then `e`) — the
page's existing rule, lifted verbatim to the server and made an explicit parameter. Memory is
bounded by the number of distinct parents, not by the relay. The result is cached and revalidated
cheaply (see Implementation notes).

**Pros.** Exact at any scale. Reproduces today's numbers byte-for-byte, so AC 5 is met by
construction rather than by argument. Constant memory. The attribution rule becomes a named,
testable input instead of an accident of `getTag()` returning the first match. One request
replaces the 400 MB the page moves today.

**Cons.** A cold tally costs one full pass over the item set — ~208 ms per 9,500 items measured,
so roughly 7–15 s for staging's 473,101 today, and it grows with the relay. The cache is what
makes this acceptable in steady state, and the cache is extra moving parts.

#### Option B — per-header `strfry scan --count`

For each of the ~322 headers, run `strfry scan --count '{"kinds":[9999,39999],"#z":[ref]}'`.

**Pros.** No event serialization at all. Cost scales with header count, not relay size. Under
the specified rule its per-list semantics are now **correct** — a tag filter is any-match, which
is exactly set membership.

**Cons.** **It cannot produce the total.** The union counts each event once across all refs;
summing independent per-ref counts double-counts every multi-list item, which is precisely the
distinction the operator drew. Recovering the union would need a second full pass anyway, at
which point the pass may as well produce both. Also slow: **8,074 ms for 270 sequential spawns**,
measured — it needs bounded concurrency just to be viable, and the spawn count grows with the
header set. And the refs cannot travel from the client: a 322-ref filter is ~28 KB and nginx
returns **414**.

#### Option C — per-header counts plus a second pass for the total

Option B for the per-list figures, plus one streaming pass purely to compute the union.

**Pros.** Correct on both figures.

**Cons.** Strictly worse than Option A: it pays the full pass *and* 322 spawns, to produce what
Option A produces from the pass alone. Named only to record that it was considered.

#### Rejected outright — read the counts from Neo4j

Contradicts the page's own purpose (its "Neo4j" column exists to show relay/graph divergence)
and the local-first invariant. Recorded so it is not re-proposed.

### Decision 2 — the contract on `/api/strfry/scan`

#### Option A — stream, bound, and say so

Replace `exec` with `spawn`; accumulate events until either `SCAN_MAX_EVENTS` or
`SCAN_MAX_BYTES` is reached, or the caller's own `limit` is satisfied; kill the child; respond
`{ success, events, count, total, truncated, limit }`.

**Pros.** Memory is bounded by the cap, not the relay — the failure mode is designed out rather
than moved. Truncation is stated in the response, matching ADR `event-tagging/0017`. Additive
fields, so existing callers are untouched. Setting `SCAN_MAX_BYTES` at today's 10 MB means
every request that succeeds today succeeds identically — AC 5 for the whole fleet, not just
these two pages. It also hands List Items its `total` in the same call, so AC 3 needs no
second endpoint.

**Cons.** A truncated response costs one extra `--count` pass to report `total` (0.52 s on
staging). Callers that ignore `truncated` still show a partial set — but they show it, rather
than showing an error, and the signal is there for them to use.

#### Option B — refuse a filter that isn't narrowed

Reject any filter with no `limit` and no narrowing term.

**Pros.** Impossible to trip. Forces every caller to be deliberate.

**Cons.** Breaks callers that legitimately fetch small unbounded sets today —
`ActiveZTags.jsx:69` (`{kinds:[39998]}`, 322 events on staging),
`shared-concepts/Index.jsx:55`, `ActiveBTags.jsx:59`. Directly violates AC 5 for pages this
story never touched. A guard that breaks working pages is worse than the bug.

#### Option C — raise `maxBuffer`

**Cons.** Puts 416 MB into the container's Node heap on a shared box, and buys headroom that
the next order of magnitude erases. This is the option ADR `event-tagging/0017` already
rejected as "moves the silent failure."

## Decision

**Decision 1 — Option A.** One server-side streaming pass, yielding per-list counts by set
membership and the page total as the deduped union, per the semantics ratified at the gate.

**Decision 2 — Option A.** A streamed, bounded scan whose response states its own truncation,
with `SCAN_MAX_BYTES` pinned at today's 10 MB so nothing that works today changes.

The deciding constraint on Decision 1 is that the two required figures disagree by design. Any
approach built on independent per-header counts can produce the per-list numbers and cannot
produce the union, because summing them double-counts exactly the multi-list items the operator
distinguished. A single pass produces both, so the pass is where the work belongs. Its cost —
O(items on the relay), measured — is real, bounded, and cached; it is not the unbounded
*buffering* that caused this bug.

Because the union can only be computed against a known header set, and a 322-ref filter cannot
cross the wire (28 KB, nginx **414**), the endpoint resolves the header set server-side. That
makes it a domain endpoint rather than a generic tally primitive.

## Consequences

- **Enables:** both pages work on every deployment, at any relay size. The latent failure on
  prod and local (1.9 MB / 1.5 MB of headroom) is removed rather than postponed. Every other
  `/api/strfry/scan` caller inherits the bound without changing a line.
- **Enables:** the counting rule becomes explicit and testable. Today it is whatever
  `getTag(event,'z')` happens to return, in one component, undocumented — and it is wrong for
  every item that belongs to more than one list.
- **Visible change, intended:** 7 of 28 counted rows on the local relay show a higher number,
  and the page total drops from 9,497 to 9,368 as items belonging to no shown list stop being
  counted. This is the ratified semantics, not a regression; the story's AC 5 is amended to
  match.
- **Constrains:** the cold pass is O(items on the relay). It will not fail, but a cold load on
  a very large relay is slow. The cache keeps steady state fast; removing it returns the
  slowness.
- **Constrains:** `SCAN_MAX_BYTES` at 10 MB preserves today's behaviour exactly, which also
  means it preserves today's *ceiling*. A caller wanting more must pass an explicit `limit` and
  handle `truncated` — deliberately, which is the point.
- **New debt / follow-ups:**
  - The cache validator `(count, newestCreatedAt)` misses one case: a delete plus an insert of
    an older event, with no newer event since and an unchanged total. Vanishingly unlikely on an
    append-mostly relay, and self-healing on the next write. Recorded, not defended against.
  - **Unattached items become invisible.** 129 locally (118 orphan-ref, 11 with no `z`/`e` tag)
    are excluded from the new total and appear in no row. That is correct under the union rule,
    but it removes a signal today's subtitle carried by accident. Surfacing them is a candidate
    follow-up, not part of this story.
  - The `truncated` signal is available to every caller; only List Items is wired to surface it
    in this story. Other pages remain silently capped at the (unchanged) 10 MB ceiling.
  - `/api/strfry/scan` still returns **HTTP 200 with `success:false`** on a genuine error. The
    story puts this out of scope; this ADR does not change it. Worth an intake entry.
  - The sibling unbounded scan `filterTaggingsUsingTag` is untouched and stays with the
    event-tagging epic.
- **Firmware reinstall required?** No. No concept definitions change.

## Implementation notes

### Server

- **`src/api/strfry/queries/scan.js`** — replace `exec` (line 25) with `spawn`, as
  `scanStream.js:23` already does. Accumulate parsed events while
  `events.length < effectiveLimit && bytes < SCAN_MAX_BYTES`; then `proc.kill('SIGTERM')`.
  - `SCAN_MAX_EVENTS = 20000` (aligns with ADR `event-tagging/0017`'s `TAGGING_SCAN_LIMIT`).
  - `SCAN_MAX_BYTES = 10 * 1024 * 1024` — today's ceiling, preserved deliberately.
  - `effectiveLimit = min(filter.limit ?? SCAN_MAX_EVENTS, SCAN_MAX_EVENTS)`.
  - When a bound was hit, run one `strfry scan --count` with the caller's filter **minus**
    `limit` to get `total`, then set `truncated = total > events.length`. When no bound was
    hit, `total = events.length` and `truncated = false` — no second strfry call.
  - Response: `{ success: true, events, count, total, truncated, limit: effectiveLimit }`.
    `events` / `count` keep their current meaning, so existing callers are unaffected.
  - Keep the existing filter JSON validation and the `'` escaping; `spawn` with an argv array
    removes the shell interpolation entirely, which is strictly better.

- **`src/api/dlists/itemCounts.js`** (new module, `src/api/dlists/` + `index.js`) —
  `GET /api/dlists/item-counts`. A domain endpoint, not a generic tally: it must know the header
  set to compute the union, and that set cannot cross the wire (28 KB → **414**).
  `src/api/lists/` is the relay whitelist/blacklist domain and is deliberately not reused.
  1. Scan `{"kinds":[9998,39998]}` and build the ref set — `39998:<pubkey>:<d>` for kind 39998,
     the event id for kind 9998. Staging carries both (318 and 4 respectively), so the `e` path
     is live and must be right.
  2. Spawn `strfry scan '{"kinds":[9999,39999]}'` and read stdout line-delimited. Per event:
     take the **distinct** union of its `z` and `e` tag values, intersect with the ref set,
     increment `counts[ref]` for **every** member of the intersection, and increment
     `totalItems` **once** if the intersection is non-empty.
  3. Respond `{ success: true, counts, headers, totalItems, scannedItems, unattached, cached }`
     where `unattached = scannedItems - totalItems`.
  - **Cache:** module-level, validated by `{ itemCount, newestCreatedAt }` — one
    `strfry scan --count '{"kinds":[9999,39999]}'` plus one `strfry scan '{...,"limit":1}'` for
    the newest `created_at` (verified newest-first). Serve the cache when both match; otherwise
    recompute. Two cheap calls (~0.6 s on staging) replace a 7-15 s pass. Include the header
    set's own count in the validator so a new header invalidates too.
  - Register in `src/api/index.js` beside the strfry scan routes (line 261-263). Public,
    read-only — same posture as its siblings.

### Client

- **`ui/src/api/relay.js`** — `queryRelay` currently returns `data.events` only (line 20). Add a
  sibling `queryRelayBounded(filter)` returning the full `{ events, count, total, truncated,
  limit }` so callers that need the total can have it. Leave `queryRelay` as is — every other
  caller keeps working unchanged.

- **`ui/src/pages/lists/Index.jsx`** — drop the `queryRelay({ kinds: [9999, 39999] })` at line
  66 and the `itemCountMap` at lines 87–99. Fetch `/api/strfry/scan/tally?filter=
  {"kinds":[9999,39999]}&groupBy=z,e` instead and read `tallies[parentRef]`. The `parentRef`
  construction at lines 111–118 is unchanged, and so is every rendered value.

- **`ui/src/pages/events/DListItemsList.jsx`** — change line 49 to
  `queryRelayBounded({ kinds: [9999, 39999], limit: ITEMS_LIMIT })` with `ITEMS_LIMIT = 500`.
  Render "showing 500 of 473,101" next to the existing count line whenever `truncated`. Pass
  `pageSize` to `DataTable` — it already supports opt-in pagination
  (`ui/src/components/DataTable.jsx:22,65–67`), so no new component is needed. 500 rows keeps
  `useProfiles` fan-out small (it dedupes and caches by pubkey).

- **`ui/src/pages/lists/Index.jsx`'s `/api/neo4j/event-uuids` call** — measured at 48 KB on
  staging. Left alone.

Test-file changes belong to Phase 3.

## Out of scope

- Pagination or "load more" that walks past `ITEMS_LIMIT` on List Items — the story chose a
  bounded set with its total stated.
- Auditing or rewiring the other `/api/strfry/scan` callers. They inherit the bound; none of
  them is changed.
- `filterTaggingsUsingTag` — stays with the event-tagging epic.
- The HTTP-200-with-`success:false` error contract.
- Any change to what a "list item" is on the wire. This ADR reads events; it does not define them.
