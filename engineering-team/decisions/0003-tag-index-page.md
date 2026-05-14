# ADR 0003: Tag index page

**Status:** Accepted
**Date:** 2026-05-14
**Story:** `engineering-team/stories/done/4-tag-index-page.md`

## Context

Story 4 adds a top-level "all tags" index page. It surfaces every tag that has at least one assertion authored by someone in the active POV's WoT, with three sort orders, in-page substring search, and pagination — counted **per the active POV's WoT** (CLAUDE.md POV-first invariant).

Concept-graph orientation (`/api/concept-graph/summaries` confirms both concepts are live):

- `39998:<TA>:tag` — exists; carries `slug`, `name`, `description`. No changes.
- `39998:<TA>:nostr-user-tag` — exists; assertion concept from ADR-0001. No changes.

Existing primitives reused (no rewrite):

- `src/api/profile-tags/index.js` — `strfryScan`, `dedupeReplaceable`, `readPolarity`, `bucketize`, `meiliFetchProfilesByPubkey`, `parseTagPayload` (already extracted in Story 2).
- `src/api/_shared/pov.js` — `resolvePov({ wotPov, userPubkey })` shared helper from ADR-0002.
- `ui/src/hooks/useProfiles` — kind-0 batched + cached metadata lookup.
- Top-bar CSS shells (`bsp-top-bar` on profile/tag, `bs-top-bar` on landing search). Story 4 unifies these via the new `<TopBar>` component below.

ADR-0002 explicitly named Story 4 as the moment to settle the pagination model (its own `profiles-tagged` will retrofit later to match). This ADR settles it.

Constraints from CLAUDE.md:
- **POV-first** — counts per row are per the active POV's WoT.
- **Decentralized-first** — any pubkey can publish assertions; we aggregate at view time.
- **Filter at view time** — no persistent per-POV "WoT-known-tags" column. Re-derive on read.

Project rules:
- No new lint/typecheck/build tooling.
- JS-without-build front end.

## Options considered

### Option A — One new endpoint `/api/profile-tags/index`; offset pagination; load-more UI; small `<SearchInput>` extraction; full `<TopBar>` extraction

**Server endpoint** (new, in `src/api/profile-tags/index.js`):

`GET /api/profile-tags/index?wotPov=&userPubkey=&sort=<used|endorsed|divisive>&q=&limit=&offset=`

Algorithm:
1. `resolvePov({ wotPov, userPubkey })` → `povSuffix`, `minRank`. WoT filtering active when both are present.
2. `strfryScan({ kinds:[39999], '#z':[NOSTR_USER_TAG_Z_TAG] })` → dedupe replaceable.
3. Build `authorAllowed` via `meiliFetchProfilesByPubkey(authorPubkeys)` checking `wot_rank_<povSuffix> >= minRank`. Same fallback rule as Story 2 — when POV unresolved, all bucketed assertions count.
4. For each surviving assertion: read polarity, bucket; group by `e`-tag value (tagEventId): `{ tagEventId, applications, disputes }`.
5. Batch-scan all tagEventIds: `strfryScan({ kinds:[39999], ids: [...tagEventIds] })`. Parse each with `parseTagPayload`. Drop tagEventIds whose tag-element can't be found locally or whose payload won't parse (the assertions reference a tag we don't have).
6. Apply substring filter (`q`) — case-insensitive `.includes()` over `name || description`. Server-side so pagination math works on the filtered set.
7. Sort server-side per the `sort` value. Default `used`.
8. Compute `total = filtered.length`. Slice `filtered.slice(offset, offset + limit)`.
9. Enrich each row with the tag author's Meili doc (`displayName`, `picture`) via `meiliFetchProfilesByPubkey`. Authors without a Meili doc surface with both fields `null`.
10. Return `{ success, povSuffix, minRank, sort, q, total, limit, offset, rows: [...] }`.

**Sort formulas** (applied to the full WoT-filtered + q-filtered set):
- `used`     — `(b.applications + b.disputes) - (a.applications + a.disputes)` desc; ties → `tagEventId` lex.
- `endorsed` — `b.applications - a.applications` desc; ties → `b.disputes - a.disputes` desc; ties → `tagEventId` lex.
- `divisive` — `min(b.applications, b.disputes) - min(a.applications, a.disputes)` desc; ties → total volume desc; ties → `tagEventId` lex. Same formula as Story 2.

Default sort: `used`.

**Pagination: offset + limit.** Default `limit = 50`, server-capped at 200. Server returns `total` so the UI knows when to hide "Load more". Offset is correct here because the algorithm already computes the full sorted list in memory (we have to, to sort it); pagination is just a slice. Cursor pagination would buy nothing — the ranking is fully deterministic given the inputs and the result is re-derived every request, so there's no "stable cursor under streaming inserts" invariant to maintain.

**UI: "Load more" pattern**, not numbered pages. Each "Load more" click increments offset by `limit` and appends. Sort/filter change resets offset → 0 and re-fetches (AC-9). Ranked discovery content is well-served by load-more; numbered pages buy little here.

**Bootstrap sequence (fresh-load correctness — same gate as Story 2):**

1. `useAuth()` exposes `{ user, loading: authLoading }`.
2. The tag-index fetch is gated on `!authLoading`. Without it, a refresh of `/tags` while logged in would race and query `wotPov=house` instead of `user`.
3. Once `authLoading === false`: derive `wotPov` per the user's logged-in state (same logic as `useTagDetail`).
4. Re-fetch when `(authLoading, user?.pubkey, sort, q, offset)` changes.

**`<SearchInput>` extraction (AC-7 — "same component as the root app's main search bar"):**

A small new `ui/src/components/SearchInput.jsx` renders the `(box, icon, input)` triple BrainstormSearch's two search-bar variants currently inline. Props:

```jsx
<SearchInput
  variant="landing" | "results"   // picks bs-search-box-{landing,results} + bs-search-input-{landing,results}
  value
  onChange         // receives the next string value
  onKeyDown
  onFocus
  placeholder
  autoFocus
  inputRef
>
  {children /* optional: autocomplete dropdown, etc. — rendered inside the box so its existing absolute positioning still resolves against the box */}
</SearchInput>
```

BrainstormSearch swaps its two inline search-input blocks (landing + results variants) to consume `<SearchInput>`, passing the existing autocomplete dropdown JSX as `children`. Behavior unchanged. The tag-index page consumes `<SearchInput variant="results" />` with no children — the same visual treatment, no autocomplete behavior.

**`<TopBar>` extraction (full scope per user direction):**

New `ui/src/components/TopBar.jsx` becomes the single top-rail component every page mounts. Today, four pages (BrainstormSearch landing+results, BrainstormProfile, Tag) each inline a top-rail in two different CSS namespaces (`bs-top-*` and `bsp-top-*`). The new `Tags.jsx` page would be a fifth. Story 4 unifies all five into one `<TopBar>` consumer.

Props:

```jsx
<TopBar
  navLinks={[              // optional; default = [{ to: '/tags', label: 'Tags' }, { to: '/about', label: 'About' }]
    { to: '/tags', label: 'Tags' },
    { to: '/about', label: 'About' },
  ]}
  showLogo={true}          // default true; BrainstormSearch's landing mode passes false because it renders its hero logo separately as a page-centered element
/>
```

TopBar consumes `useAuth()` internally and mounts the existing `BrainstormUserMenu` — callers don't have to thread `user` / `login` / `logout` through. Active route highlighting via `<NavLink>` on each `navLinks` entry.

Visual treatment: adopt `bsp-top-bar` (the more polished of the two existing variants — currently used on BrainstormProfile + Tag) as the single canonical bar. Migration:

- **BrainstormProfile, Tag, new Tags** — already use `bsp-top-bar`; swap the inline JSX for `<TopBar />`. Zero visual change.
- **BrainstormSearch landing mode** — currently has an absolute `bs-top-link` "About" (top-left) and `bs-top-bar` auth area (top-right), with a hero logo centered below. Migration: render `<TopBar showLogo={false} navLinks={[{to:'/about',label:'About'}, {to:'/tags',label:'Tags'}]} />` at the top of the page; the centered hero logo + tagline + search box stay as the page body. The absolute About-link goes away; "About" lives in the new TopBar's nav list. This is a small but visible change to the landing page (top-left About is now inline in the bar). The user has approved this as the intended polish.
- **BrainstormSearch results mode** — currently re-uses a smaller top-bar pattern. Swap for `<TopBar showLogo={true} />`.

The TopBar component is consumed in the post-search results header too — same JSX as the profile/tag pages, no special variant.

**URL: `/tags`.** Plural; doesn't conflict with `/tag/:slug/:tagId`.

**Empty state.** Two variants:
- **No data:** `total === 0 && q === ''`. Message: "No tags in your active POV's WoT yet." + the active POV identifier (suffix or "house POV" label) + two CTAs: "Switch POV" → `/personalization`, "Start tagging" → `/`.
- **No match:** `total === 0 && q !== ''`. Message: `No tags match "{q}".` + a "Clear filter" button that resets `q` to `''`.

**Pros**
- Honors POV-first / view-time filtering: zero new persistent aggregates; counts re-derived per POV per request.
- Single new endpoint with a clear contract; reuses all five shared helpers from `profile-tags/index.js`.
- Pagination contract (`limit`, `offset`, `total`) sets the pattern ADR-0002's follow-up retrofit will inherit.
- Substring filter happens server-side, so pagination math is correct on the filtered set.
- `<SearchInput>` extraction satisfies AC-7 literally ("same component") without dragging root's autocomplete logic into the tag-index where it doesn't belong.
- `<TopBar>` extraction kills three places of inline top-rail JSX in one go — the prerequisite for clean nav-entry addition (AC-1) and a frequently-cited annoyance unblocked.

**Cons**
- TopBar extraction is the largest piece of incidental scope in this ADR. It's worth doing but it ripples through four existing pages.
- BrainstormSearch's landing mode loses its absolute top-left About-link in favor of an inline nav-list entry. Visible change to the landing page UX. User-approved.
- One extra strfry scan per `/tags` request (kinds:[39999] z=nostr-user-tag) plus the tag-element batch scan and the Meili author lookup. v1 perf is fine; flag for future caching if growth demands.

### Option B — Cursor pagination + numbered pages, no SearchInput / TopBar extraction

`?cursor=<opaque>&limit=50`. UI shows numbered "Page 1 of 17". Skip the component extractions; copy the CSS classes onto vanilla inputs and inline top-rails on the new page.

**Pros**
- Smallest possible code change to ship Story 4 alone.

**Cons**
- Cursors buy nothing — we re-derive the full sorted list every request; the cursor would just encode `(sort, q, offset)`, i.e., a serialized offset. Pure complexity.
- Numbered pages don't help ranked-discovery content; load-more matches the intent.
- Skipping the SearchInput extraction violates AC-7's "reuse the same component" reading.
- Skipping TopBar extraction means we just added the same inline JSX to five pages. User has explicitly called this out as a long-standing annoyance to fix.

### Option C — Pre-computed per-POV "WoT-known tags" cache

Background job re-aggregates per POV; endpoint reads from the cache.

**Pros**
- O(1) read once warm.

**Cons**
- Violates CLAUDE.md "filter at view time, not write time". Persistent per-POV denormalization across N POVs × M tags.
- Cache invalidation on every new assertion event across all POVs. Premature.

## Decision

**Option A.** New `/api/profile-tags/index` endpoint; offset+limit pagination with `total`; load-more UI at page-size 50; new `<SearchInput>` component shared by root search and tag-index; new `<TopBar>` component that replaces five inline top-rails with one consumer; route `/tags`.

Why: honors all three CLAUDE.md invariants, settles the pagination contract the rest of the tag stack will inherit, and uses Story 4's natural surface to fix two adjacent papercuts (search-input duplication, top-bar duplication) at minimum incremental cost.

## Consequences

**Enables:**
- Discoverable catalog of every tag a POV's community is using.
- Sort / filter / paginate transitions feel snappy — single-endpoint round-trip per change.
- Pagination contract (`limit` / `offset` / `total`) reusable: settles Story 4 and primes ADR-0002's `profiles-tagged` retrofit.
- `<SearchInput>` extraction means future tweaks to the search-bar visual treatment apply everywhere it's used.
- `<TopBar>` extraction unblocks consistent nav additions (e.g., future "Browse profiles" link) and ends the bs-top vs bsp-top inconsistency.

**Constrains / makes harder:**
- `/api/profile-tags/index` recomputes the full WoT-filtered + q-filtered + sorted set on every request. Mitigation: same shared helpers as Story 2; cost is bounded by the assertion corpus, not the page slice. Flag for future caching if growth warrants.
- TopBar migration changes BrainstormSearch's landing mode (About link moves from absolute top-left to inline in the new bar). Visible but user-approved.
- The `<SearchInput>` extraction must preserve the autocomplete dropdown's positioning context (`bs-search-box-results` / `bs-search-box-landing` has `position: relative` so the dropdown's `position: absolute; top: 100%` resolves correctly). The `children` slot pattern in `<SearchInput>` keeps this intact.

**Follow-ups / debt:**
- **Retrofit `profiles-tagged`** (Story 2's endpoint) to accept `limit` + `offset` and return `total`, matching this ADR's pagination contract. **Out of scope for Story 4.** Track as a separate follow-up so the surface is consistent across the tag stack.
- **Tags-as-result in root app search** — the data plumbing already exists (`findTagsByNameSubstring` in `profile-tags/index.js`), but the UX scope (where do tag results sit in the autocomplete? how do they interleave with profile results? what does "Enter" do on a tag match?) deserves its own ADR. Continues to live in `engineering-team/follow-ups.md`.
- **Future caching layer** on `/api/profile-tags/index` if recomputation cost becomes measurable. Re-derive on read remains the default.
- **Server-side limit cap** of 200 — defensive; documented above.

**Firmware reinstall required?** **No.** No concept-graph or schema changes. Both `tag` and `nostr-user-tag` already registered by ADR-0001; no firmware files change.

## Implementation notes

### Server (`src/api/profile-tags/index.js`)

- **Add `handleTagIndex(req, res)`** — `GET /api/profile-tags/index`:
  - Validate `sort` ∈ `{used, endorsed, divisive}` (default `used`). 400 on invalid.
  - Parse `limit` — default 50, clamped to `[1, 200]`. Parse `offset` — default 0, clamped to `>= 0`.
  - `q` is a string; trim; empty == no filter.
  - `resolvePov({ wotPov, userPubkey })` for `povSuffix` + `minRank` — same as `handleProfilesTagged`.
  - `strfryScan({ kinds:[39999], '#z':[NOSTR_USER_TAG_Z_TAG] })` → dedupe replaceable.
  - Build `authorAllowed` via `meiliFetchProfilesByPubkey(authorPubkeys)` (active only when `povSuffix && Number.isFinite(minRank)`). Else `authorAllowed = () => true`.
  - Group surviving assertions by `e`-tag value: `Map<tagEventId, { applications, disputes }>`. Drop neutral polarities.
  - Batch-scan tag-element events: `strfryScan({ kinds:[39999], ids: Array.from(grouped.keys()) })`. Parse with `parseTagPayload`. Drop tagEventIds whose payload doesn't parse.
  - Apply `q` filter: `(name + ' ' + description).toLowerCase().includes(q.toLowerCase())`.
  - Sort per `sort`. Sorters defined at module scope (same pattern as `PROFILES_TAGGED_SORTERS`).
  - `total = filtered.length`; slice; enrich rows with tag-author Meili docs.
  - Return `{ success, povSuffix, minRank, sort, q, total, limit, offset, rows: [...] }`. Each row: `{ tagEventId, slug, name, description, authorPubkey, displayName, picture, applications, disputes }`.
- **Register route** in `registerProfileTagsRoutes`: `app.get('/api/profile-tags/index', handleTagIndex);`

### UI — new components

- **`ui/src/components/SearchInput.jsx`** — props per spec above. Renders `<div class={boxClass}><span class="bs-search-icon">🔍</span><input class={inputClass} {...} />{children}</div>`. Two variants drive the box+input class names; CSS for both already exists.

- **`ui/src/components/TopBar.jsx`**:
  - Calls `useAuth()` internally.
  - Renders `<div class="bsp-top-bar">`:
    - If `showLogo`, a `<Link to="/" class="bsp-logo">` with the brand mark.
    - For each `navLinks` entry, a `<NavLink>` with active-state styling.
    - A `<div class="bsp-auth">` containing `<BrainstormUserMenu user={user} onLogin={login} onLogout={logout} />`.
  - Active styling: `<NavLink className={({isActive}) => \`bsp-top-link\${isActive ? ' is-active' : ''}\`}>`.
  - New CSS class `.bsp-top-link` (and `.bsp-top-link.is-active`) added to `ui/src/styles.css`. Style mirrors the existing `.bs-top-link` opacity / hover pattern but lives in the `bsp-*` namespace consistent with `bsp-top-bar`.
  - **Default `navLinks`** when caller passes none: `[{ to: '/tags', label: 'Tags' }, { to: '/about', label: 'About' }]`.

- **`ui/src/hooks/useTagIndex.js`**:
  - Returns `{ rows, total, sort, setSort, q, setQ, offset, limit, loadMore, loading, error, povSuffix }`.
  - `sort` defaults to `'used'`; `q` to `''`; `offset` to 0; `limit` to 50.
  - Internal state: an accumulating `rows` array. Reset to `[]` whenever `sort` or `q` changes.
  - Effect keyed on `(authLoading, user?.pubkey, sort, q, offset)`: gated on `!authLoading`; fetches the slice; if `offset === 0`, replace `rows`; else append.
  - `loadMore()` increments offset by `limit` only when `rows.length < total` and not already loading.
  - Resolves `wotPov`/`userPubkey` the same way `useTagDetail` does.

- **`ui/src/pages/Tags.jsx`**:
  - Top-level: `<div class="bsp-page">`, `<TopBar />`, then a `<main class="bsp-content">`.
  - Sort buttons: same 3-button pattern as `Tag.jsx`, labelled "Most used / Most endorsed / Most divisive", `aria-pressed`.
  - `<SearchInput variant="results" value={q} onChange={setQ} placeholder="Filter tags…" />`.
  - Rows list: one `<Link to={\`/tag/\${slug}/\${tagEventId}\`}>` per row; show name, description (truncated to ~140 chars), author (`displayName` or `shortNpub` fallback per Story 2), `+{applications}` / `−{disputes}` counts.
  - Footer: "Showing {rows.length} of {total}" + "Load more" button when `rows.length < total`. Both hidden when `total === 0`.
  - Empty state: two variants per the spec.
  - New CSS class set `bs-tagindex-*` mirroring Story 2's `bs-tag-*` aesthetic.

### UI — page migrations to consume the new components

- **`ui/src/App.jsx`** — add route `{ path: '/tags', element: <Tags /> }` alongside `/tag/:tagId`.
- **`ui/src/pages/BrainstormSearch.jsx`**:
  - Replace the inline landing top-rail (the absolute `bs-top-link` About + `bs-top-bar` auth row) with a single `<TopBar showLogo={false} />` at the top. The hero logo + tagline + landing search box stay as the page body, unchanged.
  - Replace the inline results top-rail with `<TopBar />` (logo + nav + auth all in the bar).
  - Replace both inline search-input JSX blocks with `<SearchInput variant="landing"|"results" …>{autocompleteDropdown}</SearchInput>` — autocomplete dropdown passed as children, no behavior change.
- **`ui/src/pages/BrainstormProfile.jsx`** — replace the inline `bsp-top-bar` block (the explicit logo + auth row near the top of the JSX) with `<TopBar />`. Visual: identical.
- **`ui/src/pages/Tag.jsx`** — same swap: inline `bsp-top-bar` → `<TopBar />`. Visual: identical.

### What stays the same
- POV resolution (`resolvePov`).
- Bucketing rules (`>= 0.5` apply, `<= -0.5` dispute).
- WoT-author filter pattern (Meili `wot_rank_<suffix>` lookup).
- Tag-author enrichment shape (`displayName`, `picture` with null fallbacks).
- All existing tests for Stories 1, 2, 6.

## Out of scope

- Creating a new tag from this page.
- Deleting / editing tags.
- Cross-POV comparisons.
- Per-tag detail (Story 2/3 own that).
- Tag categories / hierarchical grouping.
- **Surfacing tags as a result type in the root app's main search** — the data plumbing is natural but the UX scope isn't. Tracked in `engineering-team/follow-ups.md`; separate ADR/story.
- **Retrofitting `profiles-tagged`** (Story 2) to the new pagination contract — explicit follow-up.
- Server-side caching of `/api/profile-tags/index` responses.
- Server-side fulltext / trigram indexing for `q` — case-insensitive substring is sufficient for v1.
- Active-state visual treatment on TopBar nav links beyond a basic `.is-active` opacity bump.
