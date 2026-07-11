# ADR 0005: Authored-tagging section on profile pages

**Status:** Proposed
**Date:** 2026-05-14
**Story:** `engineering-team/stories/done/5-authored-tagging-on-profile.md`

## Context

Story 1 surfaced *what tags others applied to this profile* (the `TAGS` chip row). Story 5 surfaces the inverse: *what tagging activity this profile has authored on others.* It is POV-scoped on the **target** side — the viewer only sees rows whose target profile is in the viewer's active POV's WoT. Different POVs → different sets of visible rows.

Concept-graph orientation (`/api/concept-graph/summaries`; targeted `node/<handle>` calls for the three concepts the story names):

- `39998:<TA>:nostr-user-tag` — present; assertion concept. Wire shape from ADR-0001 unchanged. We scan it with a new filter shape (`authors: [profilePubkey]` rather than `#p` or `#e`).
- `39998:<TA>:tag` — present; carries `slug`, `name`, `description`. No change.
- `39998:<TA>:nostr-user` — present. No change.

**No schema or firmware changes.** Story 5 is composition of existing primitives + UI.

Existing primitives we reuse (no rewrite):

- **Server `src/api/profile-tags/index.js`** — `strfryScan`, `dedupeReplaceable`, `readPolarity`, `bucketize`, `parseTagPayload`, `meiliFetchProfilesByPubkey`, `resolvePov`. The same pattern as `handleTagIndex` (scan, dedupe, WoT-filter, group, enrich) appears here with two adaptations: the strfry scan adds `authors: [profilePubkey]`, and the WoT filter operates on **target** Meili docs, not author docs.
- **UI `ui/src/components/TopBar.jsx`** — already on profile pages; no change.
- **UI `ui/src/pages/BrainstormProfile.jsx`** — mounts `<ProfileTagsSection>` after the action-button row; we mount the new `<AuthoredTaggingSection>` directly after `<ProfileTagsSection>`.
- **UI sort-button pattern** — three near-identical inline JSX blocks today (Tag.jsx, Tags.jsx, and now this story would be a fourth). Story 5's AC explicitly calls for "the same component" as Story 4's sort facility. ADR-0003 did not extract a `<SortToggle>` — we do it here.
- **UI `ui/src/pages/BrainstormProfile.jsx`** — carries an inline `timeAgo` helper. Story 5 wants relative timestamps too. Extract to a shared util so both surfaces consume the same formatting (avoids divergence).

CLAUDE.md invariants — what this story must honor:

- **POV-first.** The visible row set is `(assertions authored by this profile) × (viewer's POV's WoT filter on the target)`. Counts for sort (parent-tag's applications/disputes) are also POV-scoped to the viewer.
- **Decentralized-first.** Any pubkey may author assertions; no write-time gating. We aggregate at read.
- **Filter at view time.** No new persistent per-POV column. Every count and inclusion is re-derived per request on the same raw assertions.

Project rules:

- No new lint/typecheck/build tooling.
- JS-without-build front end.

Existing ADRs reviewed; none contradicted:

- ADR-0001 establishes the assertion wire shape we read.
- ADR-0002 establishes server-side sort + auth-bootstrap-gated fetch pattern; we follow it.
- ADR-0003 establishes the `?sort=` + offset/limit pagination contract — we follow the sort half. **Pagination is explicitly out of scope of Story 5** (story carries this out-of-scope alongside ADR-0003's named follow-up).
- ADR-0004 extends `profiles-tagged` with `viewerPubkey` for the viewer-union. Story 5 does *not* need a viewer-union — the assertions are authored by the profile owner, not by the viewer; the viewer's own pubkey only matters for the about-me pinning, which is computed client-side from the row set.

## Options considered

### Option A — New `/api/profile-tags/authored-by` endpoint; client-side about-me pinning; extracted `<SortToggle>`; extracted `timeAgo` util

**Server endpoint** (new, in `src/api/profile-tags/index.js`):

`GET /api/profile-tags/authored-by?authorPubkey=<hex>&wotPov=<house|user>&userPubkey=<hex>&sort=<recent|applied|disputed|most-backed|divisive>`

Algorithm:

1. Validate `authorPubkey` is 64-char lowercase hex. Validate `sort` ∈ `{recent, applied, disputed, most-backed, divisive}` (default `recent`). 400 on either malformed.
2. `resolvePov({ wotPov, userPubkey })` → `povSuffix`, `minRank`. WoT filtering active when both are present (same fallback rule as `handleProfilesTagged` / `handleTagIndex`).
3. `strfryScan({ kinds:[39999], '#z':[NOSTR_USER_TAG_Z_TAG], authors:[authorPubkey] })` → events authored by the profile owner. `dedupeReplaceable`.
4. For each surviving assertion: read polarity, bucket; drop neutrals. Capture `{ assertionEventId, targetPubkey, tagEventId, polarity ('applied'|'disputed'), createdAt }`.
5. **Target-side WoT filter.** Collect `targetPubkeys`, batch-fetch their Meili docs (`meiliFetchProfilesByPubkey`). Drop assertions whose target doc has no `wot_rank_<povSuffix>` numeric ≥ `minRank`. **Fallback rule (matches existing endpoints):** when `povSuffix`/`minRank` is null, the filter is a no-op — all bucketed assertions count. Targets without a Meili doc are dropped when WoT filtering is active (they have no rank to compare); they survive when WoT filtering is inactive (the no-op branch). This mirrors the same WoT-author rule in `handleTagIndex` and `handleProfilesTagged`.
6. **Parent-tag enrichment.** Collect `tagEventIds`. Batch-fetch tag-elements: `strfryScan({ kinds:[39999], ids: [...] })`. Parse with `parseTagPayload`. Drop assertions whose parent tag-element can't be found or fails to parse (mirrors the same drop in `handleTagIndex`).
7. **Parent-tag scan — yields BOTH parent-tag aggregate counts AND per-row peer counts.** One focused strfry scan `{ kinds:[39999], '#z':[NOSTR_USER_TAG_Z_TAG], '#e':[...all referenced tagEventIds] }` → dedupe → WoT-filter *these* assertions' authors against the viewer's POV. Then walk the surviving assertions once and build two maps in parallel:
   - `parentCounts: Map<tagEventId, { applications, disputes }>` — group by `e`-tag (the parent tag's eventId); bucket-count apply/dispute. This is the global-WoT-aggregate for each parent tag (same value `handleTagIndex` reports).
   - `peerCounts: Map<"tagEventId|targetPubkey", { applications, disputes }>` — group by `(e-tag, p-tag)` pair; bucket-count apply/dispute, **excluding assertions whose author equals `authorPubkey`** (the profile owner; otherwise their own assertion would always contribute +1 to the peer count for their own row). The exclusion is by `ev.pubkey !== authorPubkey`.

   The author-WoT filter pass shares its `meiliFetchProfilesByPubkey` cache with the parent-tag enrichment when possible. The same fallback rule applies (no POV → all bucketed assertions count, no author filter). The two maps are produced from the same in-memory walk — no extra scan cost.
8. **Enrich each row** with target Meili doc (`displayName`, `picture`; both null when no doc), parent-tag metadata (`tagSlug`, `tagName`, `tagDescription`), parent-tag WoT counts (`parentApplications`, `parentDisputes`), and peer counts for this specific `(tagEventId, targetPubkey)` pair (`peerApplications`, `peerDisputes`). Default both peer counts to `0` when the pair isn't in `peerCounts` (means: no other WoT-allowed authors have asserted this tag on this target).
9. **Sort server-side** per `sort`:
   - `recent`      — `createdAt` desc; ties → `assertionEventId` lex.
   - `applied`     — `parentApplications` desc; ties → `createdAt` desc; ties → `assertionEventId` lex.
   - `disputed`    — `parentDisputes` desc; ties → `createdAt` desc; ties → `assertionEventId` lex.
   - `most-backed` — polarity-matched peer-count desc, i.e., for an `applied` row use `peerApplications`, for a `disputed` row use `peerDisputes`; ties → `createdAt` desc; ties → `assertionEventId` lex. Rationale: "Most-backed" reads as "this person's specific assertion is most agreed-with by WoT peers"; the matching-polarity peer count is the meaningful number for that question. A row asserting `applied` with `peerApplications: 5` ranks above one with `peerApplications: 2`; a row asserting `disputed` with `peerDisputes: 5` ranks above one with `peerDisputes: 2`; they intermix across polarities via the same key.
   - `divisive`    — `min(parentApplications, parentDisputes)` desc; ties → `(parentApplications + parentDisputes)` desc; ties → `createdAt` desc; ties → `assertionEventId` lex. Same shape as Story 2/4's divisive sort. (Divisive remains a *parent-tag* property — "this person reaches for tags the community is split on.")
10. Return:
    ```json
    {
      "success": true,
      "povSuffix": "<8>"|null,
      "minRank": <n>|null,
      "sort": "recent"|...,
      "authorPubkey": "<hex>",
      "rows": [ {
        "assertionEventId": "<hex>",
        "polarity": "applied"|"disputed",
        "createdAt": <unix>,
        "targetPubkey": "<hex>",
        "targetDisplayName": "..."|null,
        "targetPicture": "..."|null,
        "tagEventId": "<hex>",
        "tagSlug": "...",
        "tagName": "...",
        "parentApplications": <n>,
        "parentDisputes": <n>,
        "peerApplications": <n>,
        "peerDisputes": <n>
      } ]
    }
    ```

Kind-5 deletions: not specially handled — same precedent as every other read endpoint in this file. Local strfry's deletion semantics are the single source of truth; if a deletion event has been published and strfry has applied it, the deleted assertion will not appear in scan results. If strfry retains the event despite the deletion, the row will appear; that is a uniform behavior gap across all read paths, not a Story 5 concern.

**No pagination in v1.** Story 5 explicitly out-of-scopes pagination and follows ADR-0003's named follow-up. Same gap as `profiles-tagged`. When that retrofit lands, this endpoint adopts the same `limit`/`offset`/`total` shape — the sort + filter algorithm here is already organized as `filter → enrich → sort → [later: slice]`, so the retrofit is mechanical.

**Why not extend `tags-for-profile` with `direction=authored`?** The two reads have different filter axes (`#p` vs `authors`), different WoT filter targets (assertion-author Meili docs vs assertion-target Meili docs), and different row shapes. Multiplexing them under one endpoint would mean a branching response contract (different rows / different sort modes per direction); the readability cost is worse than one extra endpoint.

**Why client-side about-me pinning?** The viewer's pubkey appears in the response shape only as a `targetPubkey` value on certain rows. The split is a UI affordance, not a data shape — partitioning client-side keeps the endpoint's contract clean (one sorted list; client renders it in two visual blocks). Doing it server-side would either duplicate the row in two arrays (waste) or require the server to know "who the viewer is *as distinct from* the POV's user" (we already pass `userPubkey`, but conflating "viewer for POV resolution" with "viewer for about-me partitioning" couples two concerns that are coincidentally the same value today but conceptually orthogonal). Client-side: one filter pass, two `<ul>`s.

**Client — new hook `ui/src/hooks/useAuthoredTagging.js`:**

Modeled on `useTagDetail`. Manages `sort` state and a `reloadKey`. Fetches `/api/profile-tags/authored-by` whenever `(authLoading, user?.pubkey, profilePubkey, sort, reloadKey)` changes; gated on `!authLoading` (fresh-load correctness, same pattern as ADR-0002). Returns `{ rows, sort, setSort, povSuffix, loading, error }`. No `refetch` exposed in v1 — Story 5 has no publish path; the section is read-only.

**Client — new component `ui/src/components/AuthoredTaggingSection.jsx`:**

Props: `{ profilePubkey, viewerPubkey }`. Calls `useAuthoredTagging(profilePubkey)`.

Layout (in order):

1. **Section header** — `<h3 class="bsp-authored-title">TAGGING ACTIVITY</h3>` plus a `<SortToggle>` with five options. Heading is uppercase-style to match the existing `TAGS` heading aesthetic.
2. **About-me sub-block (pinned)** — rendered only when `viewerPubkey && viewerPubkey !== profilePubkey` AND `rows.some(r => r.targetPubkey === viewerPubkey)`. Sub-heading: `<h4 class="bsp-authored-subhead">Tags they've placed on YOU</h4>`. Lists the about-me rows in the active sort order (same sort applied — they're sliced from the same array).
3. **Main list** — lists the remaining rows in the active sort order.
4. **Footer hint** — small line, `<p class="bsp-authored-pov-hint">Targets outside your active POV are hidden. Switch POV to see more.</p>`. Always shown when the section renders AND a POV is active (`povSuffix !== null`). This satisfies AC-5's "If switching POV would reveal more, the empty / partial state hints at that" without computing the hypothetical (which would require a second WoT-naive scan); the hint is honestly worded for the always-on case.

**Hide entirely** when `rows.length === 0`. `loading` shows a tiny placeholder line so the section doesn't pop in/out during the first auth-bootstrap → fetch cycle (cosmetic; the section is `display: none` if loading completes with zero rows).

**Polarity badge per row** (interleaved, not split):

- Applied → `<span class="bsp-authored-badge bsp-authored-applied">+</span>` (green); `aria-label="applied"`.
- Disputed → `<span class="bsp-authored-badge bsp-authored-disputed">−</span>` (red); `aria-label="disputed"`.

Per-row layout (a single `<li>`): badge · tag-name-link · `tagged` · target-link (avatar + name) · timestamp · **peer-annotation**. Tag name links to `/tag/:slug/:tagId`. Target links to `/user/:pubkey`. Both standard `<Link>`s. Timestamp uses the extracted `timeAgo` util.

**Peer-annotation rendering** (always visible regardless of sort — surfaces the Reading-B consensus signal without requiring the user to switch sort):

The annotation lives in a small `<span class="bsp-authored-peer">` after the timestamp. Content depends on the row's polarity and counts:

- Polarity `applied`:
  - `peerApplications > 0 && peerDisputes === 0` → `+{peerApplications} agree`
  - `peerApplications === 0 && peerDisputes > 0` → `−{peerDisputes} disagree`
  - both > 0 → `+{peerApplications} agree · −{peerDisputes} disagree`
  - both === 0 → annotation omitted (this person is alone on this assertion in the WoT)
- Polarity `disputed`: mirror — `+{peerDisputes} agree` (peers who also disputed) and/or `−{peerApplications} disagree` (peers who applied).

The annotation is purely informational; it has no link or interaction. Visual treatment: small, muted, with subtle green/red coloring tracking the agree/disagree counts respectively (same palette as the polarity badge so the eye groups them). The annotation appears in both the about-me sub-block rows and the main-list rows.

**Sub-block / list rendering reuses the same `<AuthoredTagRow>` inner component** so the visual treatment is identical in both blocks; the only difference is the wrapping `<ul>`'s parent.

**Empty / loading / error states:**

- `loading && rows.length === 0` → `<p class="bsp-authored-loading">Loading tagging activity…</p>`.
- `error` → `<p class="bsp-authored-error">⚠️ {error}</p>`.
- `!loading && rows.length === 0` → section returns `null` (hidden entirely). AC-6.

**Client — new component `ui/src/components/SortToggle.jsx`:**

Props:

```jsx
<SortToggle
  options={[{ key: 'recent', label: 'Most recent' }, ...]}
  value={sort}
  onChange={setSort}
  ariaLabel="Sort tagging activity"
/>
```

Renders the same `<div role="group" aria-label={ariaLabel}>` + per-option `<button type="button" aria-pressed={...} className="… is-active?">`. Class name strategy: a single base class `.bs-sort-toggle` for the wrapper + `.bs-sort-toggle-btn` for the buttons (plus `.is-active`). Tag.jsx (`bs-tag-sort`), Tags.jsx (`bs-tagindex-sort`), and AuthoredTaggingSection all consume this; the page-specific CSS that already exists keeps its scoping via the parent container's class (so visual treatment remains page-coherent for now). If a future polish pass wants pixel-identical buttons across all three, the wrapper class is the join point.

Existing call sites updated:

- `ui/src/pages/Tag.jsx` — replace the inline three-button block with `<SortToggle options={SORT_LABELS} value={sort} onChange={setSort} ariaLabel="Sort tagged profiles" />`. `SORT_LABELS` already a local const; pass it through. Zero visual change.
- `ui/src/pages/Tags.jsx` — same swap; `ariaLabel="Sort tags"`. Zero visual change.

**Client — new util `ui/src/utils/timeAgo.js`:**

Extracts the function currently inlined in `ui/src/pages/BrainstormProfile.jsx`. BrainstormProfile imports it; AuthoredTaggingSection imports it. Zero behavior change.

**Client — modify `ui/src/pages/BrainstormProfile.jsx`:**

Add `import AuthoredTaggingSection from '../components/AuthoredTaggingSection';`. After the existing `<ProfileTagsSection targetPubkey={pubkey} viewerPubkey={user?.pubkey} />`, mount `<AuthoredTaggingSection profilePubkey={pubkey} viewerPubkey={user?.pubkey} />`. Remove the inlined `timeAgo` function in favor of the import.

**Pros**

- Honors POV-first / view-time-filter / decentralized-first: re-derives on read, no persistent denormalization. The target-side WoT filter is structurally symmetric to the author-side filter pattern in other endpoints — same `meiliFetchProfilesByPubkey` + `wot_rank_<suffix>` lookup, just on a different pubkey set.
- One new endpoint, contract-shaped like `handleTagIndex`: `?sort=`, server-side sort, deterministic rows, no client-side aggregation. Drops the eventual pagination retrofit in mechanically.
- `<SortToggle>` extraction is small (≈40 lines) and finally satisfies AC-3's "same component" literally — Story 4 should have done it; we close that gap.
- About-me pinning is one client-side `filter` over `rows`. Trivial; no server contract complication.
- Interleaved polarity with badges keeps the list compact and works cleanly with all four sort modes (especially the divisive sort, which mixes applied + disputed by definition).
- The footer POV-hint is always-on (when a POV is active) and honest — no false promises about hypothetical hidden rows.
- Section heading "TAGGING ACTIVITY" matches the existing `TAGS` uppercase aesthetic; mirrors the visual rhythm of the rest of the profile page.

**Cons**

- Two strfry scans per request (events-by-author and the parent-tag-counts scan over the referenced tagEventIds) plus the tag-elements batch fetch (3 total). Comparable to `handleTagIndex`. Acceptable v1; flag for caching only if measurably hot.
- The parent-tag WoT counts duplicate computation across calls (every authored-by request for any author re-scans the same nostr-user-tag corpus to compute the same per-tag counts the tag-index already computes). A shared in-process cache or a pre-computation pass would amortize, but premature; v1 re-derives.
- About-me partitioning is client-side. If pagination is later added with server-side slicing, partitioning must move server-side or be applied across the already-sliced page (might split an about-me row across pages). Acceptable — pagination is an explicit follow-up and its retrofit ADR can address.
- `<SortToggle>` extraction touches two existing pages (Tag.jsx, Tags.jsx). Tested-path JSX changes are small; risk is bounded.

### Option B — Extend `tags-for-profile` with `direction=authored|received`

Multiplex both directions in one endpoint; the response includes either `applications`/`disputes` (the existing received shape) or a new `authored` array (the new shape), branching on the param.

**Pros**

- One endpoint name; the profile page's "tag stuff for this profile" lives in one place.

**Cons**

- The two reads have genuinely different shapes (rows vs. apps/disp), different filter targets (target-WoT vs. author-WoT), and different enrichment needs (parent-tag counts vs. asserter counts). A multiplexed endpoint becomes "two endpoints living in one function" — worse to read than two endpoints.
- The existing `tags-for-profile` contract is consumed by `useProfileTags`; changing its shape risks regression in Story 1's chip row. Additive changes are possible but ugly.
- Same complexity, less clarity. Doesn't actually save code.

### Option C — Pure-client aggregation: server returns raw assertions, client computes everything

Server endpoint returns the raw events for `authors:[profilePubkey]`; client does dedupe, polarity bucketing, target-WoT filter (via the existing `meili/document/:pubkey` endpoint per row), parent-tag enrichment, and sort.

**Pros**

- Minimal server change (one tiny endpoint).

**Cons**

- Violates the precedent set by every other read endpoint in this stack (sort moves server-side per ADR-0002's explicit "no partial-set sort risk" rationale; WoT filtering done server-side per ADR-0001's WoT-filter pattern).
- N Meili lookups per render (one per target, one per parent-tag) creates a thundering-herd problem from a single page load. The server's `meiliFetchProfilesByPubkey` already batches; client-side per-row fetches don't.
- Pagination becomes impossible without a fundamental refactor — the server doesn't know enough to slice.
- AC-3 says "same backend contract" as Story 4's sort facility, which is server-side. Client-side sort would split that contract.

### Option D — Split into two visual sub-blocks ("Applied" and "Disputed") plus the pinned "tagged YOU" block

Three sub-blocks (4 if the pinned block also splits by polarity). Polarity is the structural axis; each sub-block has its own sort.

**Pros**

- Polarity is unmistakable at a glance.

**Cons**

- Sort modes "Most applied" / "Most disputed" become redundant with the structural split (the user can already see all applied or all disputed). The "Most divisive" sort breaks entirely — divisive ranking inherently mixes polarities.
- More UI to maintain (three or four `<ul>`s, three or four headings) for a benefit a single polarity badge per row delivers.
- Heavier visual weight on a section that AC-6 says must be hideable when empty — a four-sub-block scaffold is more "there" when it's not there.

## Decision

**Option A.** New `/api/profile-tags/authored-by` endpoint with target-side WoT filtering; the parent-tag scan yields BOTH parent-tag aggregate counts (Reading A) AND per-row peer counts (Reading B) in a single in-memory walk; server-side sort across **five** modes (`recent` default, `applied`, `disputed`, `most-backed`, `divisive`); per-row peer annotation always visible in the UI regardless of sort; extract `<SortToggle>` and `timeAgo` util to remove duplication; `<AuthoredTaggingSection>` rendered after `<ProfileTagsSection>` on profile pages; about-me sub-block partitioned client-side; interleaved polarity with badges; section heading "TAGGING ACTIVITY"; pinned sub-heading "Tags they've placed on YOU"; always-on POV-hint footer when a POV is active.

Why: it's the option that honors all three CLAUDE.md invariants while keeping each piece on the side of the wire where it naturally lives — POV resolution + WoT filter + parent-tag aggregation + per-row peer counting on the server; about-me partitioning + display order on the client. The Reading-A and Reading-B signals are *both* useful (Reading A: "what kinds of tagging does this person do"; Reading B: "how aligned are their specific assertions with the WoT") and they cost no extra scan — the same `'#z' + '#e'` filter that produces parent-tag aggregates also produces per-(tag, target) peer counts when grouped one additional way. Surfacing peer counts as an always-visible annotation (not only when `sort=most-backed`) means the consensus signal is legible regardless of how the user chose to order the list. The `<SortToggle>` + `timeAgo` extractions close the literal "same component" gap Story 5's AC-3 names.

### Open questions (from the story) — resolved

1. **Split vs. interleave applied/disputed:** interleave, polarity badge per row. Sub-block splitting would break the "Most divisive" sort mode (which inherently mixes polarities) and is redundant with the two polarity-aware sort modes.
2. **Section heading:** "TAGGING ACTIVITY" — uppercase to match the existing `TAGS` aesthetic; polarity-neutral.
3. **Kind-5 deletions:** silently omitted. Same precedent as every other read endpoint in this stack (`tags-for-profile`, `profiles-tagged`, `tag-index`); fixing strfry-deletion handling globally is out of scope for Story 5.
4. **"Tagged YOU" sub-block phrasing + header count badge:** single sub-block titled "Tags they've placed on YOU" (polarity-agnostic; row badges carry applied vs. disputed). No count badge in the section header.
5. **Sort-by-parent-tag interpretation — BOTH readings surfaced.** There are two genuinely distinct product signals hidden under "sort by tag stats":
   - **Reading A — parent tag's global WoT counts.** "What kinds of taggings this person makes involve tags that have traction." Same number `handleTagIndex` reports for the tag overall.
   - **Reading B — per-(tag, target) peer counts.** "How agreed-with are this person's *specific* assertions by WoT peers." Counts WoT-allowed authors (other than the profile owner) who asserted the same tag on the same target with the same polarity.
   Reading A drives three sort modes (`applied` → `Popular tags`; `disputed` → `Contested tags`; `divisive` → `Most divisive`). Reading B drives one sort mode (`most-backed` → `Most-backed`, sorts by polarity-matched peer count). Reading B is ALSO surfaced as an always-visible per-row peer annotation (`+N agree` / `−M disagree`) so the consensus signal is legible regardless of which sort is active. The two readings cost no additional scan — the parent-tag scan walks the same set of assertions and populates both aggregate and per-(tag, target) maps in one pass. The buttons are labeled **`Most recent` / `Popular tags` / `Contested tags` / `Most-backed` / `Most divisive`** to make each reading legible without an essay. Server keys remain `recent` / `applied` / `disputed` / `most-backed` / `divisive` for API-surface consistency.

## Consequences

**Enables:**

- A visible "this person's tagging history (from my vantage)" surface on every profile page, POV-scoped on the target side.
- Direct loads / refreshes work correctly via the same auth-bootstrap-gated fetch pattern Stories 2/4 use.
- Sort transitions feel instant (rows-section re-fetch, header stays).
- The about-me pinned sub-block lets a NIP-07 viewer immediately spot taggings about them.
- Future surfaces (any "what has X published" view) compose the same `authors: […]` strfry-scan pattern.
- The extracted `<SortToggle>` + `timeAgo` util reduce duplication for future tag/profile UI work.

**Constrains / makes harder:**

- The endpoint runs three strfry scans (assertions-by-author, tag-elements batch, parent-tag scan) + two Meili lookups (target docs, parent-tag-author docs). The parent-tag scan now populates two maps in one walk (parent aggregates + per-(tag, target) peer counts) — same scan, ~O(N) additional bookkeeping. Comparable to `handleTagIndex`. Flag for caching only if measurably hot.
- About-me partitioning is client-side; pagination retrofit must address how the pinned block interacts with slicing (likely: server returns the about-me set separately when paginating, or the client pulls a small unbounded "about-me" slice in parallel with the paginated main set).
- `<SortToggle>` migration touches Tag.jsx and Tags.jsx. Visual zero-change but the JSX rewrites do need to land alongside the new section.
- The footer POV-hint is always-on (when a POV is active). It states "may be hidden" without computing the actual delta. Honest but not specific; if a future polish pass wants the precise hidden count, that requires a second WoT-naive scan and is a separate concern.

**Follow-ups / debt:**

- **Pagination on `/api/profile-tags/authored-by`** — joins ADR-0002's named pagination follow-up alongside `profiles-tagged`. Same `limit`/`offset`/`total` contract pattern. Story 5 out-of-scope for v1; retrofit when prolific authors surface.
- **Shared parent-tag WoT-counts cache** — at present, `handleTagIndex` and `handleAuthoredBy` independently compute "per tag, WoT applications/disputes." A shared in-process memo (keyed on POV) would amortize. Premature; v1 re-derives. Track as a future ADR when measurable.
- **`<SortToggle>` visual unification** — three call sites currently use three different button class namespaces (`bs-tag-sort-btn`, `bs-tagindex-sort-btn`, `bsp-authored-sort-btn`). The wrapper component lets a future polish pass collapse them to one. Not in scope here.
- **Story 6's chip popover polish** intersects with the new section — the new section uses no chips, just plain rows, so no direct conflict. If Story 6 introduces a kind-0 batch-fetch hook (open Q in Story 6), this section could consume it for target rows; currently we use `meiliFetchProfilesByPubkey` server-side. No coupling needed in v1.

**Firmware reinstall required?** **No.** No concept-graph or schema changes. `tag` and `nostr-user-tag` were established by ADR-0001; their wire shapes are read unchanged.

## Implementation notes

### Server (`src/api/profile-tags/index.js`)

- **Add `AUTHORED_BY_VALID_SORTS`** = `['recent', 'applied', 'disputed', 'most-backed', 'divisive']` and **`AUTHORED_BY_SORTERS`** at module scope, same pattern as `PROFILES_TAGGED_SORTERS` / `TAG_INDEX_SORTERS`:
  ```js
  // "Most-backed" uses the polarity-matched peer count: applied rows compete
  // on peerApplications, disputed rows compete on peerDisputes. Across the
  // two polarities the same numeric key intermixes them naturally.
  const backedKey = (r) => (r.polarity === 'applied' ? r.peerApplications : r.peerDisputes);

  const AUTHORED_BY_SORTERS = {
    recent:        (a, b) => (b.createdAt - a.createdAt) || a.assertionEventId.localeCompare(b.assertionEventId),
    applied:       (a, b) => (b.parentApplications - a.parentApplications)
                          || (b.createdAt - a.createdAt)
                          || a.assertionEventId.localeCompare(b.assertionEventId),
    disputed:      (a, b) => (b.parentDisputes - a.parentDisputes)
                          || (b.createdAt - a.createdAt)
                          || a.assertionEventId.localeCompare(b.assertionEventId),
    'most-backed': (a, b) => (backedKey(b) - backedKey(a))
                          || (b.createdAt - a.createdAt)
                          || a.assertionEventId.localeCompare(b.assertionEventId),
    divisive:      (a, b) => (Math.min(b.parentApplications, b.parentDisputes) - Math.min(a.parentApplications, a.parentDisputes))
                          || ((b.parentApplications + b.parentDisputes) - (a.parentApplications + a.parentDisputes))
                          || (b.createdAt - a.createdAt)
                          || a.assertionEventId.localeCompare(b.assertionEventId),
  };
  ```

- **Add `handleAuthoredBy(req, res)`** — `GET /api/profile-tags/authored-by`:
  - Validate `authorPubkey` is 64-char lowercase hex. 400 on malformed/missing.
  - Validate `sort` ∈ `AUTHORED_BY_VALID_SORTS` (default `recent`). 400 on invalid.
  - `resolvePov({ wotPov: req.query.wotPov || 'house', userPubkey: req.query.userPubkey || null })` → `povSuffix`, `minRank`. `wotFiltering = !!povSuffix && Number.isFinite(minRank)`.
  - `strfryScan({ kinds:[39999], '#z':[NOSTR_USER_TAG_Z_TAG], authors:[authorPubkey] })` → `dedupeReplaceable`.
  - Walk deduped: for each event, read polarity → bucket; skip neutral. Extract `pTag`, `eTag`, `createdAt`. Build a `candidates` array of `{ assertionEventId, targetPubkey, tagEventId, polarity, createdAt }`. (`polarity` field stored as `'applied'` | `'disputed'`.)
  - **Target-WoT filter.** Collect `targetPubkeys = Array.from(new Set(candidates.map(c => c.targetPubkey)))`. `targetDocs = await meiliFetchProfilesByPubkey(targetPubkeys)`. If `wotFiltering`: `targetAllowed = (pk) => { const d = targetDocs.get(pk); if (!d) return false; const r = d['wot_rank_' + povSuffix]; return typeof r === 'number' && r >= minRank; };` Else `targetAllowed = () => true`. Filter `candidates` by `targetAllowed(c.targetPubkey)`.
  - If `candidates.length === 0` → respond early with `rows: []` (still 200; success true).
  - **Parent-tag enrichment.** `tagEventIds = Array.from(new Set(candidates.map(c => c.tagEventId)))`. `tagElementEvents = await strfryScan({ kinds:[39999], ids: tagEventIds })`. Build `tagByEventId: Map<id, { slug, name, description }>` via `parseTagPayload` (drop malformed). Drop candidates whose `tagEventId` isn't in `tagByEventId`.
  - **Parent-tag WoT scan — yields parent-tag counts + per-row peer counts in one walk.** Reuse `tagEventIds` (post-drop): `parentAssertions = await strfryScan({ kinds:[39999], '#z':[NOSTR_USER_TAG_Z_TAG], '#e': tagEventIds })`. `parentDeduped = dedupeReplaceable(parentAssertions)`. Build `parentAuthorDocs = await meiliFetchProfilesByPubkey(unique parent assertion authors)`. Build `parentAuthorAllowed` predicate (same shape as the existing `handleTagIndex` author filter — `wot_rank_<povSuffix> >= minRank`; no-op when `!wotFiltering`). Walk surviving parent assertions once and populate two maps:
    - `parentCounts: Map<tagEventId, { applications, disputes }>` — group by `e`-tag, bucket-count apply/dispute. Drop neutrals.
    - `peerCounts: Map<string, { applications, disputes }>` keyed by `${tagEventId}|${targetPubkey}` (i.e., the `e`-tag value joined with the `p`-tag value). **Skip events whose author equals `authorPubkey`** (excludes the profile owner from their own peer counts). Drop neutrals.
  - **Compose rows.** For each remaining candidate, build the row:
    ```js
    const peer = peerCounts.get(`${c.tagEventId}|${c.targetPubkey}`);
    {
      assertionEventId: c.assertionEventId,
      polarity: c.polarity,
      createdAt: c.createdAt,
      targetPubkey: c.targetPubkey,
      targetDisplayName: targetDoc?.display_name || targetDoc?.name || null,
      targetPicture: targetDoc?.picture || null,
      tagEventId: c.tagEventId,
      tagSlug: tagInfo.slug,
      tagName: tagInfo.name || tagInfo.slug,
      parentApplications: parentCounts.get(c.tagEventId)?.applications ?? 0,
      parentDisputes:     parentCounts.get(c.tagEventId)?.disputes     ?? 0,
      peerApplications:   peer?.applications ?? 0,
      peerDisputes:       peer?.disputes     ?? 0,
    }
    ```
  - **Sort** with `AUTHORED_BY_SORTERS[sort]`.
  - Respond `{ success: true, povSuffix: povSuffix || null, minRank: Number.isFinite(minRank) ? minRank : null, sort, authorPubkey, rows }`.
  - **Error handling.** Any throw inside the try → `res.status(500).json({ success: false, error: err.message })`. Same shape as the existing handlers.

- **Register route** in `registerProfileTagsRoutes`:
  ```js
  app.get('/api/profile-tags/authored-by', handleAuthoredBy);
  ```

### Client — new hook `ui/src/hooks/useAuthoredTagging.js`

- Calls `useAuth()` → `{ user, loading: authLoading }`.
- State: `sort` (default `'recent'`), `rows`, `povSuffix`, `loading`, `error`, `reloadKey`. (No `refetch` exposed in v1; the section is read-only.)
- Effect keyed on `(profilePubkey, sort, authLoading, user?.pubkey, reloadKey)`, gated on `!authLoading && !!profilePubkey`. Builds URL params:
  - `authorPubkey = profilePubkey`
  - `sort = sort`
  - `wotPov = user?.pubkey ? 'user' : 'house'`
  - `userPubkey = user?.pubkey` (when present)
- Cancel-on-unmount via the same `let cancelled` pattern as the other hooks; last-write-wins via the same `liveSeqRef` pattern as `useTagIndex` would also work but isn't required here since there's no Load-more accumulation — a simple `cancelled` flag suffices.
- Returns `{ rows, sort, setSort, povSuffix, loading, error }`.

### Client — new component `ui/src/components/SortToggle.jsx`

```jsx
export default function SortToggle({ options, value, onChange, ariaLabel, className }) {
  return (
    <div className={`bs-sort-toggle${className ? ' ' + className : ''}`} role="group" aria-label={ariaLabel}>
      {options.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          className={`bs-sort-toggle-btn${value === key ? ' is-active' : ''}`}
          aria-pressed={value === key}
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
```

Tag.jsx and Tags.jsx import and pass their existing `SORT_LABELS` arrays via `options`; their existing wrapper-class names (`bs-tag-sort`, `bs-tagindex-sort`) move to the `className` prop so any CSS rules currently scoped under those parent classes keep working without rename. (Concrete change in `ui/src/styles.css`: nothing — the per-page CSS still scopes under `bs-tag-sort` / `bs-tagindex-sort` via the `className` prop.)

### Client — new util `ui/src/utils/timeAgo.js`

```js
export function timeAgo(unixSeconds) {
  if (!unixSeconds) return null;
  const now = Date.now() / 1000;
  const diff = now - unixSeconds;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo ago`;
  return `${Math.floor(diff / 31536000)}y ago`;
}
```

Inline declaration in `BrainstormProfile.jsx` removed; the file imports from the new util.

### Client — new component `ui/src/components/AuthoredTaggingSection.jsx`

Props: `{ profilePubkey, viewerPubkey }`. Internal:

```jsx
const SORT_LABELS = [
  { key: 'recent',      label: 'Most recent' },
  { key: 'applied',     label: 'Popular tags' },
  { key: 'disputed',    label: 'Contested tags' },
  { key: 'most-backed', label: 'Most-backed' },
  { key: 'divisive',    label: 'Most divisive' },
];

export default function AuthoredTaggingSection({ profilePubkey, viewerPubkey }) {
  const { rows, sort, setSort, povSuffix, loading, error } = useAuthoredTagging(profilePubkey);
  if (loading && rows.length === 0) {
    return <section className="bsp-authored"><p className="bsp-authored-loading">Loading tagging activity…</p></section>;
  }
  if (!loading && rows.length === 0) return null;
  const showAboutMe = !!viewerPubkey && viewerPubkey !== profilePubkey;
  const aboutMe = showAboutMe ? rows.filter((r) => r.targetPubkey === viewerPubkey) : [];
  const others  = showAboutMe ? rows.filter((r) => r.targetPubkey !== viewerPubkey) : rows;
  return (
    <section className="bsp-authored" aria-label="Tagging activity">
      <header className="bsp-authored-head">
        <h3 className="bsp-authored-title">TAGGING ACTIVITY</h3>
        <SortToggle
          options={SORT_LABELS}
          value={sort}
          onChange={setSort}
          ariaLabel="Sort tagging activity"
          className="bsp-authored-sort"
        />
      </header>
      {error && <p className="bsp-authored-error">⚠️ {error}</p>}
      {aboutMe.length > 0 && (
        <div className="bsp-authored-aboutme">
          <h4 className="bsp-authored-subhead">Tags they've placed on YOU</h4>
          <ul className="bsp-authored-list">
            {aboutMe.map((r) => <AuthoredTagRow key={r.assertionEventId} row={r} />)}
          </ul>
        </div>
      )}
      {others.length > 0 && (
        <ul className="bsp-authored-list">
          {others.map((r) => <AuthoredTagRow key={r.assertionEventId} row={r} />)}
        </ul>
      )}
      {povSuffix && (
        <p className="bsp-authored-pov-hint">
          Targets outside your active POV are hidden. Switch POV to see more.
        </p>
      )}
    </section>
  );
}
```

`<AuthoredTagRow>` is a small co-located component (file-local; not exported) that renders one `<li>`: polarity badge, `<Link to={`/tag/${slug}/${tagEventId}`}>{tagName}</Link>`, "tagged", `<Link to={`/user/${targetPubkey}`}>` containing avatar (from `targetPicture`) + name (from `targetDisplayName || shortNpub(targetPubkey)`), and timestamp via `timeAgo(createdAt)`. `shortNpub` is co-located in the same file (same form as `Tag.jsx`'s); or factored into `ui/src/utils/shortNpub.js` if the Implementer prefers. Either is acceptable — `shortNpub` is already inlined in two places, but extracting is a Story 6-ish polish, not strictly needed here. The Implementer's call.

### Client — modify `ui/src/pages/BrainstormProfile.jsx`

1. Replace the inlined `timeAgo` function with `import { timeAgo } from '../utils/timeAgo';`.
2. Add `import AuthoredTaggingSection from '../components/AuthoredTaggingSection';`.
3. After `<ProfileTagsSection targetPubkey={pubkey} viewerPubkey={user?.pubkey} />` and before the existing `{/* About */}` block, mount:
   ```jsx
   <AuthoredTaggingSection profilePubkey={pubkey} viewerPubkey={user?.pubkey} />
   ```

### Client — modify `ui/src/pages/Tag.jsx`

Replace the inline `<div className="bs-tag-sort" role="group" …>` block (lines ≈101–117) with:

```jsx
<SortToggle
  options={SORT_LABELS}
  value={sort}
  onChange={setSort}
  ariaLabel="Sort tagged profiles"
  className="bs-tag-sort"
/>
```

Add `import SortToggle from '../components/SortToggle';`. Visual: zero change (the parent class name carries the existing CSS).

### Client — modify `ui/src/pages/Tags.jsx`

Replace the inline `<div className="bs-tagindex-sort" role="group" …>` block (lines ≈64–76) with:

```jsx
<SortToggle
  options={SORT_LABELS}
  value={sort}
  onChange={setSort}
  ariaLabel="Sort tags"
  className="bs-tagindex-sort"
/>
```

Add `import SortToggle from '../components/SortToggle';`. Visual: zero change.

### CSS (`ui/src/styles.css`)

Add a new namespace block `bsp-authored-*`:

- `.bsp-authored` — section container; matches `.bsp-tags` margin / padding rhythm.
- `.bsp-authored-head` — flex row holding title + sort toggle.
- `.bsp-authored-title` — uppercase, same treatment as `.bsp-tags-title`.
- `.bsp-authored-subhead` — sub-block heading (smaller, muted, ahead of about-me list).
- `.bsp-authored-list` — `<ul>` reset (no bullets, no padding).
- `.bsp-authored-row` — `<li>` flex row layout for badge + tag-name + target + timestamp.
- `.bsp-authored-badge` (`+ .bsp-authored-applied`, `+ .bsp-authored-disputed`) — polarity pills.
- `.bsp-authored-peer` — peer-annotation typography (small, muted, with `.is-agree`/`.is-disagree` modifiers tracking green/red of the polarity badges).
- `.bsp-authored-aboutme` — light highlight on the pinned sub-block (e.g., subtle border / background).
- `.bsp-authored-pov-hint` — footer hint typography.
- `.bsp-authored-loading` / `.bsp-authored-error` — status lines.
- `.bsp-authored-sort` — wrapper class for `SortToggle` inside this section (kept for future styling hooks; can be empty).

The base `<SortToggle>` classes (`.bs-sort-toggle`, `.bs-sort-toggle-btn`) may also be added with minimal default styling (so the component doesn't render with zero visual treatment if a caller forgets the `className` prop). Defaults conservative — actual visual treatment lives in the per-page parent classes for now (`.bs-tag-sort`, `.bs-tagindex-sort`, `.bsp-authored-sort`).

### Test surface (Tester writes the plan; this is what the Implementer should expect)

- **Server `/api/profile-tags/authored-by`:**
  - Returns 400 on missing/malformed `authorPubkey`.
  - Returns 400 on invalid `sort` (`recent`/`applied`/`disputed`/`most-backed`/`divisive`).
  - With no WoT-POV (or no Meili docs for targets), returns all bucketed assertions; rows include parent-tag counts (zero when no other authors) and peer counts (zero when no other authors hit the same `(tag, target)` pair).
  - With a WoT-POV, drops rows whose target lacks `wot_rank_<suffix> >= minRank`; the parent-tag counts AND peer counts in surviving rows reflect the same POV filter applied to the parent-scan's author set.
  - `sort=recent` orders by `createdAt` desc; `sort=applied`/`disputed`/`divisive` order by the parent-tag aggregates; `sort=most-backed` orders by polarity-matched peer count (applied rows by `peerApplications`, disputed rows by `peerDisputes`).
  - **Peer counts exclude `authorPubkey`** — the profile owner doesn't count themselves as a peer of their own assertion. A row with no other WoT-allowed authors asserting the same `(tag, target)` pair has `peerApplications: 0, peerDisputes: 0`.
  - Kind-5 deletions: assumed to be filtered by strfry's deletion semantics (same as every other read endpoint). Test scope mirrors what exists for the others.
- **Client UI:**
  - Section is hidden entirely when the response has zero rows.
  - When the viewer's pubkey appears as a `targetPubkey`, that row is rendered inside the pinned "Tags they've placed on YOU" sub-block; non-pinned rows render in the main list.
  - Viewing own profile (`user.pubkey === profilePubkey`): no pinned block, but section still renders.
  - Polarity badge is visible per row (applied/disputed).
  - Peer-annotation visible per row whenever a row has any non-zero peer count, formatted per the rules in Option A; omitted entirely when both peer counts are zero. Visible regardless of which sort is active.
  - Sort change triggers a refetch and re-renders rows without a full page reload.
  - `sort=most-backed` orders rows by polarity-matched peer count (verifiable via the per-row peer annotation).
  - The POV-hint footer renders when a POV is active; absent otherwise.
- **Refactor regressions:**
  - Tag.jsx and Tags.jsx sort controls behave identically post-`<SortToggle>` swap (existing tests for sort interaction continue to pass).
  - `timeAgo` returns identical strings before/after extraction (same logic).

## Out of scope

- **Pagination on `/api/profile-tags/authored-by`** — joins ADR-0002's named follow-up alongside `profiles-tagged`.
- **Server-side caching of `/api/profile-tags/authored-by`** — re-derive on read remains the default. Future ADR if measurable.
- **Shared parent-tag WoT-counts memo across `handleTagIndex` and `handleAuthoredBy`** — future polish; both currently re-derive.
- **Filtering controls beyond sort** (e.g., text-filter inside the section) — story explicit out-of-scope.
- **Revoke from the new section** — still done via `<ManageTagsDialog>` (Story 1's surface).
- **Cross-section linking** ("this person tagged that person who tagged this person") — story explicit out-of-scope; tracked in `engineering-team/follow-ups.md` as a future community tag-activity surface.
- **A standalone "/my-tagging-activity" route** — the section is on the profile page, not a separate route.
- **Precise hidden-row count in the POV-hint footer** — would require a second WoT-naive scan; current always-on language is honest and sufficient.
- **`<SortToggle>` pixel-unified visual treatment** — three callers keep their per-page parent class for now; future polish ADR can unify if desired.
- **Replacement of the `shortNpub` inline helper across pages** — co-located is fine for v1.
