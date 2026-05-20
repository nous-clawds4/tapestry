# ADR 0012: "Most pinned" sort, per-row counts, and own-pin indicator on the tag index

**Status:** Proposed
**Date:** 2026-05-20
**Story:** `engineering-team/stories/13-most-pinned-tag-index.md`

## Context

Story 13 makes the `/tags` index pin-aware. The Pin events from
Story 10 already live in local strfry; this story aggregates them
per-tag under the active POV's WoT-author filter — the same pattern
`handleProfilesTagged` (Story 3) and Story-11's `aggregateProfilesTagged`
already use for endorsement counts.

### Concept-graph orientation

No new concepts. Per `/api/concept-graph/summaries`:

- `39998:<TA>:tag` (Story 1) — the index surface this story extends.
- `39998:<TA>:tag-pinning` (Story 10) — the Pin events being
  aggregated.
- `39998:<TA>:web-of-trust` — the per-POV filter applied to pin
  authors via `wot_rank_<povSuffix>`. **No firmware reinstall.**

### Existing primitives we reuse

- **`handleTagIndex`** at `src/api/profile-tags/index.js:753–904`
  is the endpoint this story extends. It already does the WoT-author
  filter, dedup, group-by-tagEventId, `q`-substring filter,
  `authoredBy`-pubkey filter, sort, pagination, and Meili author
  enrichment. The new pin aggregation slots into the same pipeline.
- **`aggregateProfilesTagged`** at
  `src/api/profile-tags/index.js:469–509` — the canonical WoT-author
  filter pattern. Story 13's pin aggregation mirrors its shape.
- **`TAG_PINNING_Z_TAG`** + **`parsePinTagEventId`** +
  **`parseCurationMethod`** — exported from
  `src/api/profile-tags/index.js` (Story 10). Already used by
  `refreshPinnedTags.js`. Reused here without further change.
- **`dedupeReplaceable`** at `src/api/profile-tags/index.js:74–85`
  — kind-39999 is addressable replaceable; same `(author, d-tag)`
  collapse the existing aggregator uses.
- **`meiliFetchProfilesByPubkey`** — used to look up `wot_rank_<obs>`
  on each pin author. Same call site shape as the endorsement
  aggregator.
- **`useTagIndex`** at `ui/src/hooks/useTagIndex.js:15–106` —
  manages sort/q/mineOnly/offset state and accumulates rows. New
  state (`pinnedByMe`) and new params (`pinnedByMe`,
  `viewerPubkey`) thread in additively.
- **`Tags.jsx`** at `ui/src/pages/Tags.jsx` — the page that renders
  the index. Adds one toggle + one badge + one indicator per row.
- **Existing `mineOnly` / `authoredBy`** filter — orthogonal to
  this story's new `pinnedByMe` filter. "Tags I authored" and
  "Tags I've pinned" are conceptually distinct (creator vs.
  curator). Both toggles can coexist.

### CLAUDE.md invariants

- **POV-first.** Pin counts are per-POV (WoT-author filter on the
  pin author). Switching POV recomputes — the existing `wotPov` +
  `userPubkey` cascade through `resolvePov` already drives this.
  The viewer's own-pin indicator is per-viewer, *not* per-POV
  (your own pin is yours regardless of which POV you're viewing
  under).
- **Decentralized-first.** Anyone's pin counts; the WoT filter is
  applied at view time. No write-time gating.
- **Filter at view time.** No materialized "tag → pin count"
  column. The aggregation runs per-request, on the same scan
  pattern the rest of the codebase uses.

### Open questions called out by the story (resolved below)

1. Server endpoint shape (extend `handleTagIndex` vs new sibling).
2. Cost of pin aggregation on every `/tags` request + memoization.
3. Own-pin marker placement.
4. Filter toggle × sort interaction.
5. Logged-out + unconfigured-POV count value.
6. Performance budget.

## Options considered

### Option A — Extend `handleTagIndex` additively; new helper `aggregateTagPins`; union the tag set across assertions + pins

Single endpoint, single hook update, no new routes.

**(1) New server helper** `aggregateTagPins({ povSuffix, minRank, viewerPubkey })`
in `src/api/profile-tags/index.js`. Mirrors `aggregateProfilesTagged`'s
shape:

```js
async function aggregateTagPins({ povSuffix, minRank, viewerPubkey }) {
  const wotFiltering = !!povSuffix && Number.isFinite(minRank);
  const pinEvents = await strfryScan({
    kinds: [39999],
    '#z': [TAG_PINNING_Z_TAG],
  });
  const deduped = dedupeReplaceable(pinEvents);

  // WoT-author filter on pin authors — same shape as
  // aggregateProfilesTagged.
  let authorAllowed = () => true;
  if (wotFiltering) {
    const authorPubkeys = Array.from(new Set(deduped.map((ev) => ev.pubkey)));
    const authorDocs = await meiliFetchProfilesByPubkey(authorPubkeys);
    const rankField = `wot_rank_${povSuffix}`;
    authorAllowed = (authorPk) => {
      const doc = authorDocs.get(authorPk);
      if (!doc) return false;
      const r = doc[rankField];
      return typeof r === 'number' && r >= minRank;
    };
  }

  const pinCountByTagEventId = new Map();
  const viewerPinnedSet = new Set();
  for (const ev of deduped) {
    const tagEventId = parsePinTagEventId(ev);
    if (!tagEventId) continue;
    // Own-pin indicator is per-viewer, not per-POV. The viewer's
    // own pin counts toward viewerPinnedSet regardless of the WoT
    // filter on this request's POV.
    if (viewerPubkey && ev.pubkey === viewerPubkey) {
      viewerPinnedSet.add(tagEventId);
    }
    if (!authorAllowed(ev.pubkey)) continue;
    pinCountByTagEventId.set(
      tagEventId,
      (pinCountByTagEventId.get(tagEventId) || 0) + 1
    );
  }

  return { pinCountByTagEventId, viewerPinnedSet };
}
```

Notes on the dedupe:
- `dedupeReplaceable` already collapses `(author, d-tag)` — Story 10's
  pin `d`-tag is `tag-pin-<slug>-<tagAuthor8>-<viewer8>`, so the
  collapse correctly produces ONE surviving event per (author, tag),
  giving us "distinct WoT-trusted pinners" automatically.

**(2) Union the tag set across assertions + pins.** The existing
`handleTagIndex` builds its row set from `byTag` (derived from
nostr-user-tag assertions). A tag that has 10 pinners but zero
endorsements/disputes would NOT appear today. To support AC-1
(pin counts on every visible tag) AND AC-2 (Most pinned sort), the
row set must include tags that have pins but no assertions.

After both aggregations run:

```js
const tagEventIds = new Set([
  ...byTag.keys(),
  ...pinCountByTagEventId.keys(),
]);
// Bulk-fetch tag events for the union.
const tagEvents = await strfryScan({ kinds: [39999], ids: Array.from(tagEventIds) });
// Build enriched rows with all four counts (applications, disputes,
// pinnedCount, viewerPinned).
```

This widens the listing — tags with pins-but-no-assertions now
appear. Sorts that read `pinnedCount` (Most pinned) sort them
correctly; sorts that read assertion counts (`used`, `endorsed`,
`divisive`) place them at the bottom (tied at 0 in their respective
metrics). Existing test suites for the assertion-driven sorts must
continue to pass — the union widens the list but doesn't change the
ordering of tags that already had assertions.

**(3) `handleTagIndex` query-param + response-shape extensions:**

- New query param **`viewerPubkey=<hex>`** (optional). When present
  and valid: the response includes per-row `viewerPinned: boolean`.
  When absent or malformed: `viewerPinned` defaults to `false` on
  every row (same shape every time — simpler client).
- New query param **`pinnedByMe=true|false`** (optional). When
  `'true'` AND `viewerPubkey` is provided AND valid: rows are
  filtered to those whose `viewerPinned === true`. When absent or
  not 'true': no filter applied.
- New sort value **`most-pinned`** added to `TAG_INDEX_VALID_SORTS`.
  Validation: 400 on any other sort value (existing behavior).
- New `TAG_INDEX_SORTERS.most-pinned` comparator:
  ```js
  'most-pinned': (a, b) =>
    (b.pinnedCount - a.pinnedCount)
    || a.tagEventId.localeCompare(b.tagEventId),
  ```
  Matches the existing tie-break pattern (lexicographic on
  tagEventId).

Every row in the response carries:
- the existing `applications`, `disputes`, `tagEventId`, `slug`,
  `name`, `description`, `authorPubkey`, `displayName`, `picture`;
- new **`pinnedCount`** (always present; defaults to 0);
- new **`viewerPinned`** (always present; `false` when no viewer or
  no pin).

Backward-compatible: every existing field is untouched; existing
sort values still work; existing tests stay green.

**(4) Filter × sort interaction (AC-6 vs AC-2).** When the
`pinnedByMe=true` filter is on, the sort still works coherently —
within the filtered set (which is just the viewer's pinned tags),
`most-pinned` orders by how many other people in the WoT also
pinned them. That's a useful signal ("which of my pins are widely
shared?"). **No special-case behavior.** The toggle does not
override the sort.

**(5) Logged-out / unconfigured-POV count value (AC-7).** When no
POV resolves, `wotFiltering` is false → `authorAllowed = () => true`
→ ALL pin authors count. This matches the existing
`handleTagIndex` fallback semantic (where applications + disputes
also count all assertions when no POV is resolvable). The Story-11
generator made the same call. Consistent.

**(6) UI surface changes** (`ui/src/hooks/useTagIndex.js` +
`ui/src/pages/Tags.jsx`):

- Hook: add `pinnedByMe` state (boolean, default false) with
  paginate-reset wrapper; always thread `viewerPubkey=user.pubkey`
  when logged in; thread `pinnedByMe=true` when both auth + toggle
  are set.
- Page: add `'most-pinned'` to `SORT_LABELS` array (labeled
  "Most pinned"). Add a second toggle below the existing
  "Only show tags I authored" toggle: "Only show tags I've pinned"
  (gated on `user`).
- Per-row UI:
  - **Pin-count badge** in the existing `.bs-tagindex-row-counts`
    area: `📌 {pinnedCount}` alongside the existing `+N`/`−M`
    counts. Always shown (even when 0 — AC-1).
  - **Own-pin indicator** as a small chip next to the tag name
    in `.bs-tagindex-row-main` when `viewerPinned === true`. Subtle
    visual treatment (e.g., a small filled 📌 chip), always rendered
    when the field is true regardless of the filter state (AC-6
    second clause). Hidden when no viewer.

**(7) Performance / memoization** (open question #2). The pin scan
adds one `strfry scan` per `/tags` request. At v1 scale (handfuls of
pins per instance), this is a single millisecond-level operation.
**No memoization in v1.** If `/tags` traffic gets hot or the pin
set grows large, a 60-second TTL cache keyed on
`(povSuffix, viewerPubkey, sort)` is the natural follow-up — but
that's premature optimization and trades a small amount of
freshness for performance, which we'll only pay when we know we
need to.

**(8) Story-4 follow-up scope respected.** The story explicitly
includes pagination correctness (AC-10): the new sort + the new
filter both run server-side BEFORE the slice. Same shape Story 4
already enforces for `used` / `endorsed` / `divisive`. No
client-side post-filter or post-sort.

**Pros:**

- Single endpoint, single client hook. No new routes, no new
  React state files.
- Reuses the WoT-author-filter pattern Story 3 and Story 11
  already proved. New helper is a near-perfect clone of
  `aggregateProfilesTagged` with `pinCountByTagEventId` as the
  aggregation target.
- Backward-compatible additive response shape. Existing test
  suites for `handleTagIndex` stay green.
- Union-tag-set widening makes "Most pinned" meaningful for tags
  with pin traction but no assertion traction yet — a real product
  win for early-stage tags.
- Pin-count is correctly per-POV; own-pin indicator is correctly
  per-viewer. The mental model maps cleanly to the wire query
  params.
- Memoization is deliberately deferred — the simple shape ships
  first; optimization waits for evidence.

**Cons:**

- The union-tag-set widening means the existing tag-index now
  shows MORE rows than before (those with pins-but-no-assertions).
  For most users this is a feature; for some it's a behavioral
  change. Mitigated: the new rows have `applications=0, disputes=0`
  and sort to the bottom of the existing assertion-driven sorts;
  the `mineOnly` filter (existing) and `pinnedByMe` filter (new)
  both narrow the list naturally.
- One more strfry scan per `/tags` request (the pin scan). At v1
  scale, negligible. Flag if measured.
- `viewerPubkey` becomes a third "auth-adjacent" query param on
  the index endpoint alongside `wotPov` + `userPubkey`. The hook
  always sets both when logged in — duplicated information but
  semantically distinct (`userPubkey` drives the POV cascade;
  `viewerPubkey` drives the own-pin lookup).
- The `pinnedByMe` filter is only valid when `viewerPubkey` is
  also present and valid; the server silently ignores it
  otherwise. Documented; matches the existing `authoredBy` filter's
  pattern of "validate-or-ignore."

### Option B — New sibling endpoint `/api/profile-tags/index/pin-counts`

Two requests per page: one for the existing index, one for pin
counts. Client merges on the front end.

**Pros:**
- Zero changes to `handleTagIndex`.
- Cleaner separation of concerns server-side.

**Cons (why rejected):**
- AC-2 (server-side sort by pinnedCount) is **impossible**: the
  server can't sort by a value the client hasn't joined yet. Either
  the client sorts after fetching all pages (breaks pagination) or
  the server sorts wrong.
- AC-6 (`pinnedByMe` filter) has the same problem — the server
  can't filter to "tags the viewer pinned" without the client
  having identified that set; client-side filter after the slice
  would skip pages.
- Two requests per page render, race conditions on POV change.
- Encourages a "viewer state" diverging from "POV state" on the
  client.

### Option C — Materialized per-tag-pinned-count table refreshed periodically

Background job aggregates pin counts per tag and writes them
into a Meili column or a dedicated store. `handleTagIndex` reads
the precomputed column.

**Pros:**
- Fastest possible read; no per-request strfry scan.

**Cons (why rejected):**
- Violates the "filter at view time" CLAUDE.md invariant. Pin
  counts under POV X depend on the WoT-trusted-authors set for X,
  which is itself derived from X's `wot_rank_*` column. Switching
  POV requires re-deriving — no single materialized column works
  for all POVs.
- N POVs × M tags storage; combinatorial blow-up.
- Refresh cadence introduces staleness on top of all the other
  staleness sources.
- Premature optimization; v1 traffic scale doesn't justify.

## Decision

**Option A.** Extend `handleTagIndex` additively with a new
helper `aggregateTagPins`, union the tag set across assertions
and pins, add `most-pinned` sort, add `pinnedByMe` filter, add
`pinnedCount` + `viewerPinned` per-row fields, thread
`viewerPubkey` through `useTagIndex`, add the "Most pinned" sort
label and the "Only show tags I've pinned" toggle to `Tags.jsx`,
render the pin-count badge and own-pin indicator on every row.

Why: it's the only option that satisfies server-side sort+filter
correctness (AC-2, AC-6, AC-10) while keeping the wire shape
backward-compatible and reusing every existing primitive. Option B
fails AC-2/AC-10; Option C violates view-time filtering.

## Consequences

**Enables:**
- AC-1 through AC-10 — every story acceptance criterion has a
  direct implementation path through this design.
- "Most pinned" as a discovery surface — users can find tags
  worth pinning at a glance.
- Own-pin awareness — users can see their curated set inline
  on `/tags` without switching to `/pins`.
- "Tags I've pinned" filter is independent of "Tags I authored"
  — power users can compose both later if useful.
- The union-tag-set widening means freshly-pinned tags appear in
  the index immediately, even before they accumulate any
  endorsements. Lowers the activation barrier for new tags.
- The new helper `aggregateTagPins` becomes reusable for future
  surfaces (e.g., a "most-pinned" sidebar on the tag-detail page
  if Story-13's "out of scope" item 1 graduates to a story).

**Constrains / makes harder:**
- The tag index now does TWO strfry scans per request (one for
  assertions, one for pins) plus the existing tag-event-id bulk
  fetch. For v1 scale this is negligible (single-digit ms);
  flag if a future story's load profile makes it hot.
- The union-tag-set widening changes the listing's row count
  silently. Story 4's tests assert specific tag-event-id ordering
  under `used` / `endorsed` / `divisive` sorts. **These tests must
  remain green** — the union doesn't change the order among tags
  with assertions; it only appends tags-with-pins-but-no-assertions
  to the bottom of those sort modes (tied at 0 on the sort key).
- `viewerPubkey` + `userPubkey` redundancy on the wire is a
  minor wart. Documented in the endpoint's docstring; not worth
  a refactor.

**Follow-ups / debt:**
- **Pin counts on the tag-detail page** — currently
  scope-deferred. Adding it is `aggregateTagPins` + one extra
  field on the by-id response.
- **Drill-down "Who pinned this?"** — clicking the pin-count
  badge could open a small popover listing the WoT-trusted
  pinners. Trivial server work; UX needs a new component.
- **Multi-facet filters** — "pinned by ≥ N people" threshold,
  "pinned in the last 30 days", etc. The current single-toggle
  shape doesn't preclude additions; the query-param surface is
  the natural extension point.
- **Memoization** — flag-if-measured; 60s TTL on
  `(povSuffix, viewerPubkey, sort)` is the natural shape.
- **Pin counts in the autocomplete popup** — pulls the same
  aggregator into the BrainstormSearch tag-result path.

**Firmware reinstall required?** **No.** Pure code change.

## Implementation notes

Concrete guidance for the Implementer.

### Server — `src/api/profile-tags/index.js`

**(1) New helper** `aggregateTagPins({ povSuffix, minRank, viewerPubkey })`.
Place it near `aggregateProfilesTagged` (around line 469). Body
per Option A §(1).

Export it from the module so the Tester can write a thin unit-style
integration test if needed. The existing exports list at
`src/api/profile-tags/index.js:1244–1260` is the right place to
add it.

**(2) Extend `TAG_INDEX_VALID_SORTS`** at line 723:

```js
const TAG_INDEX_VALID_SORTS = ['used', 'endorsed', 'divisive', 'most-pinned'];
```

**(3) Extend `TAG_INDEX_SORTERS`** at lines 725–737. Add:

```js
'most-pinned': (a, b) =>
  ((b.pinnedCount || 0) - (a.pinnedCount || 0))
  || a.tagEventId.localeCompare(b.tagEventId),
```

The `|| 0` defensive coalesce handles any row that somehow lacks
the field (shouldn't happen given the always-present default, but
costless to defend).

**(4) Extend `handleTagIndex`** (lines 753+). After the existing
`byTag` aggregation (lines 802–819) is built:

```js
// New: viewer + pin aggregation. viewerPubkey is silently treated as
// absent on malformed input (same pattern as authoredBy at line 772).
const viewerPubkeyRaw = typeof req.query.viewerPubkey === 'string' ? req.query.viewerPubkey : '';
const viewerPubkey = /^[0-9a-f]{64}$/.test(viewerPubkeyRaw) ? viewerPubkeyRaw : null;
const pinnedByMeRaw = typeof req.query.pinnedByMe === 'string' ? req.query.pinnedByMe : '';
const pinnedByMe = pinnedByMeRaw === 'true' && !!viewerPubkey;

const { pinCountByTagEventId, viewerPinnedSet } = await aggregateTagPins({
  povSuffix, minRank, viewerPubkey,
});

// Union the tag set across assertions and pins. Any tagEventId that
// appears in either map should be a candidate row.
for (const tagEventId of pinCountByTagEventId.keys()) {
  if (!byTag.has(tagEventId)) {
    byTag.set(tagEventId, { tagEventId, applications: 0, disputes: 0 });
  }
}
```

Then after the `enriched` array is built (around line 861), append
pin fields:

```js
for (const row of enriched) {
  row.pinnedCount = pinCountByTagEventId.get(row.tagEventId) || 0;
  row.viewerPinned = viewerPinnedSet.has(row.tagEventId);
}
```

Then before the sort (around line 872), apply the `pinnedByMe`
filter:

```js
let filtered = qLower
  ? enriched.filter((r) => `${r.name} ${r.description}`.toLowerCase().includes(qLower))
  : enriched;
if (authoredBy) {
  filtered = filtered.filter((r) => r.authorPubkey === authoredBy);
}
if (pinnedByMe) {
  filtered = filtered.filter((r) => r.viewerPinned);
}
filtered.sort(TAG_INDEX_SORTERS[sort]);
```

Response shape adds two echo fields (existing pattern):

```js
res.json({
  success: true,
  povSuffix: povSuffix || null,
  minRank: Number.isFinite(minRank) ? minRank : null,
  sort,
  q,
  authoredBy: authoredBy || null,
  viewerPubkey: viewerPubkey || null,    // new
  pinnedByMe: pinnedByMe || false,       // new
  total,
  limit,
  offset,
  rows: slice,
});
```

### Client — `ui/src/hooks/useTagIndex.js`

- Add `pinnedByMe` state (default `false`) and a `setPinnedByMe`
  setter that also resets `offset` (mirrors `setSort` / `setQ` /
  `setMineOnly` at lines 31–42).
- When building params, thread:
  ```js
  if (user?.pubkey) params.set('viewerPubkey', user.pubkey);
  if (pinnedByMe && user?.pubkey) params.set('pinnedByMe', 'true');
  ```
- Add `pinnedByMe`, `setPinnedByMe` to the return value at line 97.

### Client — `ui/src/pages/Tags.jsx`

- Add `'most-pinned'` entry to `SORT_LABELS`:
  ```js
  { key: 'most-pinned', label: 'Most pinned' },
  ```
- Add a second toggle below the existing "Only show tags I
  authored" toggle (line 73):
  ```jsx
  {user && (
    <label className="bs-tagindex-pinnedonly">
      <input
        type="checkbox"
        checked={pinnedByMe}
        onChange={(e) => setPinnedByMe(e.target.checked)}
      />
      <span>Only show tags I've pinned</span>
    </label>
  )}
  ```
- Per-row UI additions in the `.bs-tagindex-row-counts` block:
  ```jsx
  <span className="bs-tagindex-count bs-tagindex-count-pinned" title="Pins in your POV's WoT">
    📌{row.pinnedCount}
  </span>
  ```
- Per-row own-pin indicator in `.bs-tagindex-row-main` (next to
  the name), rendered conditionally:
  ```jsx
  {row.viewerPinned && (
    <span className="bs-tagindex-own-pin" title="You have pinned this tag">📌</span>
  )}
  ```

### CSS — `ui/src/styles.css`

Add under the existing `bs-tagindex-*` namespace:

- `.bs-tagindex-count-pinned` — pin-count badge (similar shape to
  the existing `.bs-tagindex-count-apply` / `.bs-tagindex-count-dispute`).
- `.bs-tagindex-own-pin` — small inline chip on the tag name when
  viewer has pinned.
- `.bs-tagindex-pinnedonly` — toggle row styling, mirror
  `.bs-tagindex-mineonly` (lines TBD in styles.css).

### Tests (Tester writes; surfaces listed so the Implementer knows the contract)

**Contract:**
- `/api/profile-tags/index` accepts `sort=most-pinned` (existing
  400 on bogus sorts still 400s for other unknown values).
- `/api/profile-tags/index` accepts `viewerPubkey=<hex>` and
  `pinnedByMe=true` without breaking the existing response shape.
- Every row in the response carries `pinnedCount: number` and
  `viewerPinned: boolean` (defaults to 0 / false).
- Existing assertion-driven sort modes (`used`, `endorsed`,
  `divisive`) continue to pass their Story-4 tests.

**Publish-flow (live):**
- Pin a tag from one WoT-trusted author + one out-of-WoT author →
  with POV configured, the `pinnedCount` for that tag is 1 (the
  in-WoT pinner); without POV, the count is 2 (fallback to all).
- A tag with ONLY pins (no endorsements/disputes) appears in the
  `most-pinned` sort and shows `applications=0, disputes=0`.
- Same author pinning twice (via re-pin after unpin) → still
  counts as 1 (dedupe by `(author, d-tag)`).
- kind-5-deleted pin events do NOT contribute to the count
  (strfry's index honors deletions).
- `pinnedByMe=true` narrows the list to tags the viewer has
  pinned; pagination total reflects the filtered count.
- `viewerPinned: true` appears on a row regardless of whether the
  viewer is in the active POV's WoT (per-viewer, not per-POV).

**UI (Playwright):**
- `/tags` renders the `Most pinned` sort option.
- Selecting it re-orders the list (mock the endpoint to return a
  deterministic order).
- The pin-count badge renders on every row.
- The own-pin indicator renders on rows where `viewerPinned: true`.
- The "Only show tags I've pinned" toggle is hidden when
  logged-out, visible when logged-in, and changing it triggers a
  refetch with `pinnedByMe=true`.
- The own-pin indicator remains visible even when the
  `pinnedByMe` filter is on (AC-6 second clause).

## Out of scope

- Pin counts on the tag-detail page.
- "Who pinned this?" drill-down popover.
- Multi-facet filters (threshold, time-range, etc.).
- Memoization / caching on the new aggregation.
- Pin counts in the autocomplete popup.
- Cursor-based pagination.
- A "Trending pinned" sort (recency-weighted).
- Cross-POV counts.
