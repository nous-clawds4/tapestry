# ADR 0002: Tag-detail page (read)

**Status:** Accepted
**Date:** 2026-05-14
**Story:** `engineering-team/stories/2-tag-detail-page-read.md`

## Context

Story 1 + ADR-0001 shipped `nostr-user-tag` (one assertion concept; polarity, target pubkey, applied-tag reference all expressed as event-tags) and a profile-page chip surface. Story 2 gives every tag a stable landing page that lists the profiles tagged with it, counted **per the active POV's WoT**.

Concept-graph orientation (`/api/concept-graph/summaries` and `/node/<handle>` for the three concepts the story names):

- `39998:<TA>:tag` — exists; `tag` schema carries `slug`, `name`, `description`. **Slugs are not globally unique** — two different authors can publish a tag-element with the same slug. The element's `eventId` is the only stable identifier.
- `39998:<TA>:nostr-user-tag` — exists; assertion concept. Wire shape from ADR-0001: `["p", target]`, `["e", tagEventId]`, `["polarity", "1"|"-1"]`, `["z", "<nostr-user-tag handle>"]`. Read-side polarity helper already in `src/api/profile-tags/index.js` (`readPolarity`, `bucketize`).
- `39998:<TA>:nostr-user` — exists; no changes needed.

Existing primitives we reuse (no rewrite):

- `src/api/profile-tags/index.js` — `strfryScan`, `dedupeReplaceable`, `readPolarity`, `bucketize`, `meiliFetchProfilesByPubkey`. The pattern of "scan strfry by `#z` + `#e`, bucket by polarity, then WoT-filter authors via Meili `wot_rank_<suffix>`" already exists in `computeTagMatches`. The new endpoint is a sibling.
- `src/api/search/profiles/meili/index.js` — POV resolution pipeline: client sends `wotPov` + `userPubkey`; server reads house / user prefs to derive `delegatedPubkey` → `povSuffix = delegatedPubkey.slice(0,8)` → `minRank` from `filters.rank.min`. We extract this into a shared helper and reuse.
- `ui/src/context/AuthContext.jsx` — exposes `{ user, loading, login, logout }`. `loading` is `true` while the auth bootstrap call resolves, then `false`. Pages that depend on logged-in state must gate on `loading` to avoid a fresh-load race.
- `ui/src/pages/BrainstormProfile.jsx` — precedent for a public Brainstorm-style page that respects `?pov=<8char>` query param as an explicit override.
- `ui/src/components/TagChip.jsx` — chip currently uses one `onClick` to toggle the popover; we need to split the click target so the name navigates and hover/focus continues to open the popover.

Constraints (CLAUDE.md):
- **POV-first.** Counts on the page are computed against the active POV's WoT, not a global "trusted set." Different POVs see different numbers.
- **Decentralized-first.** Any pubkey can publish a `nostr-user-tag` assertion. We do not gate at write time.
- **Filter at view time.** No new persistent per-POV "applied" or "trusted" column. Re-derive on read using existing POV-namespaced columns + raw-assertion scans.

Project rules:
- No new lint/typecheck/build tooling.
- JS-without-build front end.

## Options considered

### Option A — `/tag/:slug/:tagId` URL; new server endpoints; server-side sort

**Routing:** `/tag/:slug/:tagId` (GitHub-style — slug is decorative for humans; `tagId` = full kind-39999 event id is authoritative). The chip's name area links to this URL. Hovering / focusing the chip continues to open the popover (interaction split below). A bare `/tag/:tagId` is also accepted and redirects to the canonical slug-prefixed URL once the tag loads.

**Server endpoints (new, in `src/api/profile-tags/index.js`):**

- `GET /api/profile-tags/by-id?tagEventId=<id>` — returns `{ success, tag: { eventId, slug, name, description, authorPubkey, createdAt }, author: { displayName, picture } | null }`. Single strfry-scan filter `{ kinds:[39999], ids:[tagEventId] }` + a single Meili author lookup.
- `GET /api/profile-tags/profiles-tagged?tagEventId=<id>&wotPov=<house|user>&userPubkey=<hex>&sort=<applied|disputed|divisive>` — composes the existing read pattern:
  1. `strfryScan({ kinds:[39999], '#z':[NOSTR_USER_TAG_Z_TAG], '#e':[tagEventId] })`.
  2. `dedupeReplaceable` + `readPolarity` + `bucketize`.
  3. POV resolution via `resolvePov({ wotPov, userPubkey })` — extracted from the meili proxy (see "POV resolution helper extraction" below).
  4. Build `authorAllowed` predicate via `meiliFetchProfilesByPubkey` checking `wot_rank_<suffix> >= minRank`.
  5. Group surviving assertions by target `p`-tag pubkey: `{ pubkey, applications, disputes }`.
  6. Enrich each row with the target's Meili profile doc (`displayName`, `picture`) via the same batched lookup helper.
  7. **Sort server-side** by the `sort` param (default `applied`). Formulas below.
  8. Return `{ success, povSuffix, minRank, sort, rows: [{ pubkey, displayName, picture, applications, disputes }] }`.

The "applications" and "disputes" counts on each row are integers, derived at query time. **No persistent per-POV aggregate column.** When the POV changes, the server re-derives. (CLAUDE.md "filter at view time, not write time.")

**Sort moves server-side.** Sorting client-side is unsafe the moment we add a server-side cap (intentional or accidental) — the user can't tell they're sorting a partial set. Server-side sort makes the contract correct from day one and lets pagination (Story 4 follow-up) drop in cleanly. AC "no full page reload" remains satisfied: changing the sort triggers a fetch + re-render, not a navigation.

Sort formulas (applied to the full WoT-filtered result set):
- `applied`  — `applications` desc, ties → `disputes` desc, ties → `pubkey` lex.
- `disputed` — `disputes` desc, ties → `applications` desc, ties → `pubkey` lex.
- `divisive` — `min(applications, disputes)` desc, ties → `applications + disputes` desc, ties → `pubkey` lex. Rows where `min(applications, disputes) === 0` are still returned but rank last (only one polarity present → not divisive). Cleanly satisfies the story's "1-vs-1 doesn't outrank 50-vs-50" property without magic thresholds: 1-vs-1 has min=1, 50-vs-50 has min=50; 100-vs-2 has min=2 (heavily lopsided is not divisive); 99-vs-100 has min=99 (genuinely divisive).

Default sort: `applied`.

**Empty state:** when `rows.length === 0`, render the header (name, description, author) and a friendly "No profiles in your active POV's WoT have been tagged with **{name}** yet." message. The header is fetched from `by-id` independently — empty WoT does not blank the page.

**Bootstrap sequence (fresh-load / refresh correctness).** Direct loads of `/tag/:slug/:tagId` (refresh, copy-pasted link, share-link) must produce the same result as click-through. The hook coordinates this:

1. `useAuth()` exposes `{ user, loading: authLoading, ... }`. On mount, `authLoading` is `true`.
2. `by-id` fetch fires immediately on mount — it doesn't depend on POV.
3. `profiles-tagged` fetch is **gated on `authLoading === false`**. While auth is bootstrapping, the rows section shows a loading state. Without this gate, the page would race and query with `wotPov=house` even when the user is logged in with a user-POV saved pref.
4. Once `authLoading` flips to `false`, derive `wotPov`:
   - If `?pov=<8char>` query param is present, treat it as an explicit override and pass through.
   - Else if `user?.pubkey` exists, send `wotPov=user&userPubkey=<hex>`.
   - Else send `wotPov=house`.
5. Re-fetch `profiles-tagged` whenever `authLoading`, `user?.pubkey`, `tagId`, or the active `sort` changes. The `by-id` fetch is keyed only on `tagId`.

The server already handles user-pref → house-pref fallback (via the extracted `resolvePov` helper); the client just needs to send the right `wotPov` once it knows the auth state.

**Chip interaction split (in `ui/src/components/TagChip.jsx`):** the chip's name span is wrapped in a `<NavLink>` that navigates to the detail page. Hover / focus on the chip continues to open the popover (existing behavior preserved). Popover Apply / Dispute buttons gain `e.preventDefault()` so clicks inside the popover don't bubble up to the link. Touch users tap → navigate (no hover); the detail page is a strict superset of popover info, so this is graceful. Story 6 will revisit popover persistence and a touch-friendly chip affordance.

**UI files (new, JSX, no new tooling):**
- `ui/src/pages/Tag.jsx` — page; reads `useParams()` for `slug`/`tagId`, `useSearchParams()` for `pov`. (Filename is plain `Tag.jsx`, not `BrainstormTag.jsx`: tags are DCoSL list-items, not Brainstorm-app-specific.)
- `ui/src/hooks/useTagDetail.js` — fetches `by-id` + `profiles-tagged` per the bootstrap sequence above; returns `{ tag, author, rows, povSuffix, sort, setSort, loading, rowsLoading, error, refetch }`.
- Routes in `ui/src/App.jsx`: `{ path: '/tag/:tagId', element: <Tag /> }` and `{ path: '/tag/:slug/:tagId', element: <Tag /> }`. Bare-id URLs redirect to canonical-slug URL once the tag loads.

**Pros**
- Honors POV-first, view-time filtering: zero new persistent aggregates; counts re-derived per POV per request.
- All three new endpoints compose helpers already proven in `computeTagMatches`; no new strfry-scan or Meili-lookup pattern.
- URL is unambiguous (`tagId` is the truth) and human-meaningful (slug is decorative). Robust against future slug collisions.
- Chip-name link is a real `<a href>` — middle-click / open-in-new-tab works for free.
- Sort lives server-side: no risk of silently sorting a partial set when (not if) the dataset grows or pagination lands.
- Bootstrap sequence handles fresh-load / refresh correctly — `auth.loading` gating ensures we don't race the POV decision.
- Empty WoT degrades to a still-useful page (header always renders).

**Cons**
- URL has two segments where one segment would suffice. Slight aesthetic cost; pays for itself the moment two authors publish a same-slug tag.
- `profiles-tagged` re-derives counts on every request. Mitigation: the strfry filter `#z + #e` is narrow and fast; the WoT filter is a batched Meili lookup with built-in concurrency. If this proves slow at scale, a cached layer is a follow-up ADR — not a v1 concern.
- TagChip needs a structural change (button → link with overlaid popover trigger). Modest refactor; well-scoped to that one component.
- Sort change costs a network round-trip. Loading indicator on the rows section while it resolves; header doesn't flicker.

### Option B — `/tag/:slug` (slug-only URL); canonicalize at server

**Routing:** `/tag/:slug` only. When multiple tag-elements share a slug, the server picks the canonical one — e.g., the tag-element with the most positive applications globally on local strfry.

**Pros**
- Pretty URL. Looks like `/user/:pubkey`.

**Cons**
- The chip on the profile page references a *specific* `tag.eventId`. If the chip's tag isn't the canonical one for its slug, clicking the chip lands on a *different* tag than the one in the chip's popover. Confusing UX bug-magnet.
- Canonicality is a global aggregate query — you'd need to compute "most-applied tag-element for this slug" per request, or add a denormalized "canonical" flag per slug. The first is wasteful; the second contradicts CLAUDE.md's "filter at view time" rule.
- "Original author" header field becomes ambiguous when multiple events share a slug — the canonical one can shift over time as application counts change.

### Option C — `/tag/:tagId` only (no slug in URL)

**Routing:** plain `/tag/<64-hex-eventId>`.

**Pros**
- Simplest possible. Unambiguous. No collision logic.

**Cons**
- URL is 64 hex characters of opaque noise. No human readability, no shareability hook.

## Decision

**Option A.** `/tag/:slug/:tagId` (slug decorative, tagId authoritative); new `by-id` + `profiles-tagged` endpoints that compose existing helpers; **server-side** sort; chip-name → navigate, hover/focus → popover; fresh-load gated on `auth.loading` for correct POV resolution.

Why: it's the only option that honors all three CLAUDE.md invariants (no persistent per-POV cache, no write-time gating, all aggregation per-POV at view time) *and* the chip-click navigation lands on the same tag-event the popover described. Slug-decorative URLs give human readability without paying the canonicalization complexity tax of Option B. Server-side sort is the right contract from day one — the alternative invites silent partial-set sorting once pagination or caps land.

## Consequences

**Enables:**
- Stable shareable tag URLs that survive same-slug collisions.
- Per-POV view of "who's been tagged with this" — switches when the user switches POV, with no re-index.
- Direct loads / refreshes / shared links produce the same result as click-through (auth-bootstrap gating).
- Sort transitions feel instant (rows-section spinner, header stays).
- Chip-name link supports browser-native open-in-new-tab.
- A foundation Stories 3 (write affordances on the detail page), 4 (tag index), and 5 (authored-tagging on profile) can extend without reshaping the URL or endpoint contracts.

**Constrains / makes harder:**
- The TagChip component now mixes a `<NavLink>` with a popover-trigger element. Care needed so popover Apply / Dispute clicks don't accidentally trigger navigation (use `e.preventDefault()` on those handlers).
- `profiles-tagged` recomputes counts per request. If the profile-tag corpus grows past, say, 10k assertions per popular tag, response time may need attention. v1 is fine; flag for future caching ADR.
- The redirect from `/tag/:tagId` to `/tag/:slug/:tagId` means the bare URL takes one client-side hop before settling. Acceptable; aesthetic.
- Sort change costs a round-trip. We accept this in exchange for the contract being right when pagination lands.

**Follow-ups / debt:**
- **Pagination.** When Story 4 introduces pagination on the tag-index page, retrofit `profiles-tagged` to accept `limit` + `offset` with the same server-side `sort` semantics. The server-side sort decision in this ADR is what makes that retrofit safe.
- Story 6 revisits chip popover persistence + a touch-friendly affordance (for now, touch users tap → navigate; popover doesn't show on touch).
- A future caching layer for `profiles-tagged` if the recomputation cost becomes measurable. Re-derive on read remains the default.
- The author-of-tag-element lookup in `by-id` is a single Meili doc fetch. If Meili is unreachable, `by-id` should still return `tag` with `author: null` (graceful degradation). Implementer to honor.

**Firmware reinstall required?** **No.** No concept-graph or schema changes. Both `tag` and `nostr-user-tag` already exist (registered by ADR-0001). New work is API + UI only.

## Implementation notes

### POV resolution helper extraction (small, surgical refactor)

Pull lines ~125–160 of `src/api/search/profiles/meili/index.js` (house-prefs load + `wotPov` resolution + `povSuffix` derivation + `minRank = filters?.rank?.min`) into a new module, e.g., `src/api/_shared/pov.js`, exporting:

```js
// resolvePov({ wotPov, userPubkey }) → { delegatedPubkey, povSuffix, minRank, filters, sort }
function resolvePov({ wotPov, userPubkey }) { /* … existing logic, no behavior change … */ }
```

The meili proxy and the new `profiles-tagged` endpoint both import it. Single call site swap in the meili proxy; no behavioral change.

### Server (`src/api/profile-tags/index.js`)

- **`handleTagById(req, res)`** — `GET /api/profile-tags/by-id?tagEventId=<id>`:
  - Validate `tagEventId` is 64-char hex.
  - `strfryScan({ kinds:[39999], ids:[tagEventId] })` → expect 0 or 1 events.
  - Parse the tag JSON from the `["json", ...]` event-tag (fall back to `event.content`) — same parser as `findTagsByNameSubstring`.
  - Optionally fetch the author's Meili doc via `meiliFetchProfilesByPubkey([authorPubkey])` — if present, return `displayName` and `picture`; if absent, return `author: null`.
  - Returns `{ success, tag: { eventId, slug, name, description, authorPubkey, createdAt }, author }`. 404 (`{ success: false, error: 'tag not found' }`) when scan returns 0 events.

- **`handleProfilesTagged(req, res)`** — `GET /api/profile-tags/profiles-tagged?tagEventId=<id>&wotPov=<house|user>&userPubkey=<hex>&sort=<applied|disputed|divisive>`:
  - Validate `tagEventId`. Validate `sort` ∈ `{applied, disputed, divisive}` (default `applied`).
  - `resolvePov({ wotPov, userPubkey })` for `povSuffix` + `minRank`.
  - `strfryScan({ kinds:[39999], '#z':[NOSTR_USER_TAG_Z_TAG], '#e':[tagEventId] })` → dedupe replaceable.
  - For each event: read polarity, bucket; group by `p`-tag (target pubkey).
  - Build `authorAllowed` via `meiliFetchProfilesByPubkey(authorPubkeys)` checking `wot_rank_<povSuffix> >= minRank`. When `povSuffix` or `minRank` is null, `authorAllowed = () => true` (degrades gracefully, matches `computeTagMatches` precedent).
  - Apply `authorAllowed` filter to assertions before counting.
  - Enrich each target with `meiliFetchProfilesByPubkey(targetPubkeys)` for `displayName` and `picture`. Targets without a Meili doc surface with `displayName: null, picture: null`.
  - Apply server-side sort per the formulas in Option A.
  - Return `{ success, povSuffix, minRank, sort, rows: [...] }`.

- **Register routes** in `registerProfileTagsRoutes`:
  ```js
  app.get('/api/profile-tags/by-id', handleTagById);
  app.get('/api/profile-tags/profiles-tagged', handleProfilesTagged);
  ```

### UI

- **New page `ui/src/pages/Tag.jsx`** — `useParams()` for `tagId` / `slug`, `useSearchParams()` for `pov`, `useAuth()` for `{ user, loading: authLoading }`. Uses `useTagDetail({ tagId, povOverride, authLoading, user })`. If `slug` is missing once `tag` loads, `navigate(\`/tag/${tag.slug}/${tagId}\`, { replace: true })` to canonicalize. Renders header (tag name, description, author with avatar / shortPubkey fallback) + sort control (`<select>` of `applied | disputed | divisive` or three toggle buttons) + rows. Each row links to `/user/:pubkey` (preserving `?pov=` if present). Empty state per Option A. 404 state when `by-id` returns `success:false`.

- **New hook `ui/src/hooks/useTagDetail.js`** — implements the bootstrap sequence:
  - `by-id` fetch keyed on `tagId` (no auth gate).
  - `profiles-tagged` fetch gated on `!authLoading`; triggers on changes to `(authLoading, user?.pubkey, tagId, sort, povOverride)`.
  - Resolves `wotPov`/`userPubkey`/`pov` query as described in the bootstrap sequence.
  - Returns `{ tag, author, rows, povSuffix, sort, setSort, headerLoading, rowsLoading, error, refetch }`.

- **Modify `ui/src/components/TagChip.jsx`**:
  - Wrap the tag-name span in a `<NavLink to={\`/tag/${encodeURIComponent(tag.slug)}/${tag.eventId}\`}>` that preserves the existing `.ptc-name` styling. The link is the chip's primary click target.
  - Hover / focus continues to open the popover (existing behavior).
  - Popover Apply / Dispute buttons get `onClick={(e) => { e.preventDefault(); onApply(tag); }}` (and similar for dispute) so clicks inside the popover don't bubble up the link.
  - Asserter rows in the popover do not navigate — leave them as-is.

- **Modify `ui/src/App.jsx`** — add two routes (top level, alongside `/user/:pubkey`):
  ```jsx
  { path: '/tag/:tagId', element: <Tag /> },
  { path: '/tag/:slug/:tagId', element: <Tag /> },
  ```

## Out of scope

- Apply / Dispute affordances on profile rows (Story 3).
- Search input on the tag page to find arbitrary profiles to tag (Story 3).
- Revoking an assertion from the tag page.
- Editing or deleting a tag's definition.
- Cross-POV comparison views.
- Tag index / catalog page (Story 4).
- Authored-tagging scroll section on profile pages (Story 5).
- Polish bundle — chip-popover persistence, asserter names/avatars, search placeholder, touch-friendly chip affordance (Story 6).
- Pagination / virtualization for very large `rows` sets — explicit follow-up alongside Story 4.
- Server-side caching of `profiles-tagged` results.
