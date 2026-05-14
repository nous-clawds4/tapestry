# ADR 0004: Tag-detail page (write — apply, dispute, search-and-apply)

**Status:** Proposed
**Date:** 2026-05-14
**Story:** `engineering-team/stories/done/3-tag-detail-page-write.md`

## Context

Story 2 + ADR-0002 shipped the tag-detail page as a read-only view: `/tag/:slug/:tagId` lists profiles WoT-filtered for the active POV with three sort orders, header from `/api/profile-tags/by-id`, rows from `/api/profile-tags/profiles-tagged`. Story 3 turns the page into a workspace: a NIP-07 user can apply or dispute the tag directly from any row, search arbitrary profiles from the same page, and see the result of their own publication immediately even when the broader POV hasn't caught up.

Concept-graph orientation (`/api/concept-graph/summaries` + targeted `neighbors` for the three concepts the story names): all three are already in the graph and were finalized in ADR-0001. **No schema change in this story.**

- `39998:<TA>:tag` — present; `slug`, `name`, `description`. No change.
- `39998:<TA>:nostr-user-tag` — present; assertion concept. Wire shape (ADR-0001): `["d", "profile-tag-<tagSlug>-<targetPub.slice0,8>-<authorPub.slice0,8>"]`, `["p", targetPubkey]`, `["e", tagEventId]`, `["z", "<nostr-user-tag handle>"]`, `["polarity", "1"|"-1"]`. No change.
- `39998:<TA>:nostr-user` — present. No change.

Existing primitives we reuse (no rewrite):

- **Server `src/api/profile-tags/index.js`** — `strfryScan`, `dedupeReplaceable`, `readPolarity`, `bucketize`, `meiliFetchProfilesByPubkey`, `resolvePov`, `PROFILES_TAGGED_SORTERS`. `handleProfilesTagged` already does the WoT-filter + sort pipeline; we extend it surgically (one new optional query param, one extra map field on the response, one viewer-union step), no new endpoint.
- **UI `ui/src/components/SearchInput.jsx`** — the `(box, icon, input)` triple extracted in ADR-0003. We mount one with `variant="results"` for the page-search input. (No autocomplete-dropdown children — Story 3 wants list+buttons, not navigation; the BrainstormSearch dropdown is the wrong abstraction here.)
- **UI `ui/src/components/TopBar.jsx`** — already mounted on `Tag.jsx` per ADR-0003 changes. No change.
- **UI `ui/src/hooks/useTagDetail.js`** — gets `viewerPubkey` threading + a `refetchRows()` exposure.
- **UI `ui/src/hooks/useProfileTags.js`** — the publish path (`buildAndPublishAssertion`, `publishOrThrow`) is exactly what we need; we extract the inner builder into a small pure helper so the tag page can publish per `(tag, target)` without the per-target lifecycle state `useProfileTags` carries.
- **External Meili proxy `/api/search/profiles/meili`** — already POV-aware (`q`, `wotPov`, `userPubkey`). The page-search calls it directly; no need to wrap it.

CLAUDE.md invariants — what this story must honor:

- **POV-first.** Whether the viewer's own assertion "counts" depends on the active POV's WoT. We must show the viewer's freshly-published assertion in their personal view even when the WoT filter would exclude its author. Resolution: union viewer-authored assertions into the response set, flag rows where the viewer's assertion is the only thing making the row visible.
- **Decentralized-first.** Any pubkey publishes any assertion; we accept all signed events. No write-time gating beyond NIP-07 signing.
- **Filter at view time.** No new persistent per-POV column. The viewer-union step is a view-time merge on the same raw assertions the WoT filter scans.

Project rules:
- No new lint/typecheck/build tooling.
- JS-without-build front end.
- Reuse existing search where possible (user direction).

## Options considered

### Option A — Extend `profiles-tagged` with `viewerPubkey`; inline page-search section using `<SearchInput>` + Meili proxy; per-row buttons + viewer-only badge; extracted pure publish helper

**Server change** (in `src/api/profile-tags/index.js`):

Extend `handleProfilesTagged` to accept an optional `viewerPubkey` query param. When present:

1. The existing strfry scan `{ kinds:[39999], '#z':[NOSTR_USER_TAG_Z_TAG], '#e':[tagEventId] }` already returns all assertions for this tag — including any authored by the viewer. No new scan.
2. After `dedupeReplaceable` and before the WoT-filter pass, walk `deduped` once to build a viewer-assertions map: `{ targetPubkey → 'applied' | 'disputed' }`. Filter to events authored by `viewerPubkey`, then by `bucketize(readPolarity(ev))` (`'apply'` / `'dispute'`; drop `'neutral'`).
3. Run the existing WoT-filter loop unchanged. It populates `byTarget` with `{ pubkey, applications, disputes }` from authors who pass the WoT filter (which may not include the viewer).
4. **Viewer-union step.** For each entry in the viewer-assertions map: if its target isn't yet in `byTarget`, insert a zero-count row `{ pubkey: targetPk, applications: 0, disputes: 0 }`.
5. Enrich every row with target Meili docs (already does this).
6. Annotate each row with `onlyViewerVisible: (viewerAssertions.has(row.pubkey) && row.applications === 0 && row.disputes === 0)`.
7. Sort the union with the existing `PROFILES_TAGGED_SORTERS` — `applied`/`disputed`/`divisive` formulas all already use the row's count fields; viewer-only rows have `(0, 0)` and naturally rank at the bottom of every sort.
8. Response: existing shape, plus
   - `viewerAssertions: { [pubkey]: 'applied' | 'disputed' }` map (omitted or `null` when no `viewerPubkey` was passed),
   - per-row `onlyViewerVisible: boolean`.

`viewerPubkey` validation: 64-char lowercase hex; reject 400 otherwise (same pattern as `tagEventId`). When the viewer has zero assertions for this tag, the union is a no-op — endpoint behavior matches the existing read path.

**Why on the same endpoint, not a new one.** The viewer-union is conceptually part of "what does this tag's profile list look like for this viewer's session" — it shares 100% of the scan, dedupe, parse, enrich, sort path. A separate endpoint would either (a) duplicate the scan or (b) require a client-side merge, both of which introduce race conditions on sort change and pagination. `profiles-tagged` already returns POV-aware data; this extends the same contract.

**Client change — `ui/src/hooks/useTagDetail.js`:**

- Pass `viewerPubkey=user.pubkey` to `profiles-tagged` when `user?.pubkey` is present.
- Expose `viewerAssertions` from the response (default `{}` when absent).
- Expose `refetchRows()` (a thin wrapper that bumps a counter the rows-effect keys on) so the page can re-fetch after publish without changing sort/POV state.
- Header fetch unchanged — `viewerPubkey` does not affect `by-id`.

**Client change — new pure helper `ui/src/utils/publishProfileTag.js`:**

Extract the inner builder from `useProfileTags.buildAndPublishAssertion` into a free async function:

```js
// publishProfileTag.js
export async function publishProfileTagAssertion({ tag, targetPubkey, polarity }) {
  if (!window.nostr) throw new Error('No NIP-07 extension detected. Install one to publish tags.');
  const authorPk = await window.nostr.getPublicKey();
  const dTag = `profile-tag-${tag.slug}-${targetPubkey.slice(0, 8)}-${authorPk.slice(0, 8)}`;
  const unsigned = {
    kind: 39999,
    pubkey: authorPk,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', dTag],
      ['p', targetPubkey],
      ['e', tag.eventId],
      ['z', NOSTR_USER_TAG_HANDLE],
      ['polarity', String(polarity)],
    ],
    content: JSON.stringify({ nostrUserTag: { taggedPubkey: targetPubkey, tagEventId: tag.eventId } }),
  };
  const signed = await window.nostr.signEvent(unsigned);
  await publishOrThrow(signed); // moved/exported from useProfileTags
  return signed;
}
```

`useProfileTags.buildAndPublishAssertion` is rewritten in terms of `publishProfileTagAssertion` (same observable behavior, no behavior change for Story 1's profile-page surface). The wire shape stays exactly as ADR-0001 specifies it — single source of truth.

**Client change — `ui/src/pages/Tag.jsx` + two small components:**

Layout (logged-in): below the sort buttons, above the rows list, mount a `<TagPageSearch>` section. Above the rows list, but below the sort+search, render the existing rows list. Each main-list row is now a `<TagPageRow>` (new component) — gets Apply/Dispute buttons when `user` is present, badge when `row.onlyViewerVisible`.

Logged-out: behaves exactly as Story 2 — no buttons, no search input, no badge. Just the existing rows list. (AC-8.)

**New component `ui/src/components/TagPageRow.jsx`:**

```jsx
<TagPageRow
  row={{ pubkey, displayName, picture, applications, disputes, onlyViewerVisible }}
  viewerState={'applied' | 'disputed' | null}     // from viewerAssertions[pubkey]
  showActions={boolean}                            // false when logged out
  onApply={(targetPubkey) => Promise<void>}        // throws on publish failure
  onDispute={(targetPubkey) => Promise<void>}
/>
```

Renders the same visual row as today (avatar + display name + counts + link to `/user/:pubkey`). When `showActions`, renders two buttons next to the counts:

- `Apply` — `is-applied`/disabled when `viewerState === 'applied'`; click otherwise calls `onApply`.
- `Dispute` — `is-disputed`/disabled when `viewerState === 'disputed'`; click otherwise calls `onDispute`.

Per-row local state: `publishingPolarity: null | 'apply' | 'dispute'` (button shows "…" / disabled during publish), `publishError: string | null` (inline error under the row on failure). On successful publish, the parent's `refetchRows()` collapses the local state (the new state arrives via `viewerAssertions`).

When `row.onlyViewerVisible && showActions`, render a small `<span class="bs-tag-row-badge">` after the name reading "your assertion — not yet visible to this POV". The badge is per-row, not a page banner — it states the precise reason this row appears (AC-7).

Buttons are NOT inside the row's `<Link to=/user/...>`. The link spans the name+avatar+counts subtree only; buttons are siblings. (Nesting buttons in `<a>` is invalid HTML and conflicts with the per-button publish handlers.)

**New component `ui/src/components/TagPageSearch.jsx`:**

```jsx
<TagPageSearch
  tagEventId={tagId}
  tagSlug={tag.slug}
  tagName={tag.name}                  // passed for completeness; not used in v1 UX
  viewerAssertions={viewerAssertions} // map { pubkey → 'applied'|'disputed' }
  showActions={true}                  // always — this section only renders when user is logged in
  user={user}
  pov={resolvedWotPovString}          // 'user' | 'house' — same logic the rows fetch uses
  onApply={(tag, targetPubkey) => Promise<void>}
  onDispute={(tag, targetPubkey) => Promise<void>}
/>
```

Owns local state: `q`, `loading`, `error`, `hits`, debounced refetch.

Renders:
- A `<SearchInput variant="results" value={q} onChange={setQ} placeholder="Find a profile to tag…" />`.
- Below the input, when `q.trim().length >= 2`, a list of result rows reusing `<TagPageRow>`. Counts come back as `applications: row?.applications ?? 0`, `disputes: row?.disputes ?? 0` when the page's main list also has this profile — but we don't have those for arbitrary search hits, so search-result rows render with no counts (or counts of `0`/`0`). The button state comes from `viewerAssertions[pubkey]` exactly as the main list rows do — same source of truth.
- `<TagPageRow>` is reused unchanged; it doesn't care whether counts are zero.
- A "Loading…" line during the debounce-then-fetch; an inline error on failure.

The fetch is a thin call to `/api/search/profiles/meili?q=…&wotPov=…&userPubkey=…&limit=10&offset=0`. POV passthrough mirrors what the rows fetch does — keeps the search proxy honest. We deliberately do not call any of the `pubkeyLookup`/`nip05Lookup` special branches; the search input here is plain substring/word search. If the user pastes an npub/nip-05, the Meili proxy still handles it gracefully — we just don't add the special branches on top.

Debounce: 250ms. Length threshold: 2 chars (matches BrainstormSearch's threshold). On `q === ''` or shorter than the threshold, results clear silently.

After a successful Apply/Dispute from a search row, the parent's `refetchRows()` re-pulls `profiles-tagged` with the viewer's pubkey, the tagged target now appears in the main list (with `onlyViewerVisible: true` when no other WoT-allowed author has touched it), and `viewerAssertions[targetPubkey]` becomes the corresponding polarity — so the search-row's button state flips too without a separate refetch. (Both lists read the same `viewerAssertions` map; one refetch updates both.)

**`Tag.jsx` glue:**

- Pull `viewerAssertions`, `refetchRows` from `useTagDetail`. (Existing usage of `tag`, `author`, `rows`, `sort`, `setSort`, etc. unchanged.)
- Define `handleApply(tag, targetPk)` / `handleDispute(tag, targetPk)`: `await publishProfileTagAssertion({ tag, targetPubkey: targetPk, polarity: +1|-1 })` then `await refetchRows()`. Throws on publish failure — `<TagPageRow>` catches and shows the per-row error.
- Wrap the existing rows in `<TagPageRow>` with `viewerState={viewerAssertions[row.pubkey] ?? null}` and `showActions={!!user}`.
- Below the sort buttons, when `user`, mount `<TagPageSearch tagEventId={tagId} tagSlug={tag.slug} tagName={tag.name} viewerAssertions={viewerAssertions} pov={…} user={user} onApply={handleApply} onDispute={handleDispute} />`.
- Logged-out: omit both `<TagPageSearch>` and the buttons in `<TagPageRow>`. Visual identical to Story 2.

**CSS** (in `ui/src/styles.css`):

Add the apply/dispute button styles under the existing `bs-tag-*` namespace:
- `.bs-tag-row-apply`, `.bs-tag-row-dispute` — base button.
- `.bs-tag-row-apply.is-applied`, `.bs-tag-row-dispute.is-disputed` — the "already in this state" treatment (filled / inert).
- `.bs-tag-row-actions` — the flex container next to counts.
- `.bs-tag-row-badge` — the inline "your assertion — not yet visible to this POV" pill.
- `.bs-tag-row-error` — per-row error line under the row.
- `.bs-tag-search` — the new search section spacing under the sort controls.

**Pros**

- Honors POV-first / decentralized-first / view-time-filter: one query-time union step on the same raw assertions; no new persistent column, no write-time gating.
- One endpoint change (`profiles-tagged` gets one new optional param and one extra response field) — no new server route. Composes cleanly with ADR-0002's contract.
- The viewer-union and the WoT-filter pass share the same scan + dedupe — no extra strfry round-trip.
- Sort works without modification on the union: viewer-only rows have `(0, 0)` and naturally bottom-rank under all three existing formulas.
- Single source of truth for viewer state: `viewerAssertions` map drives main-list button state, search-result button state, and the badge. One refetch updates everything.
- `<SearchInput>` reuse satisfies the "reuse search if possible" direction without dragging BrainstormSearch's autocomplete dropdown logic into a context that wants list+buttons, not navigation.
- Extracting `publishProfileTagAssertion` from `useProfileTags` keeps the wire shape in one place (the ADR-0001 spec) — Tag page and profile page share the source. Future surfaces (Story 5's authored-tagging-on-profile, eventual bulk operations) reuse the same primitive.
- The badge is per-row, not a banner — it states the precise reason that *specific* row appears. Doesn't require the user to scan a global message and then map it back to "which rows?".
- Buttons are siblings of the row link, not children. Valid HTML; clean click semantics.

**Cons**

- `profiles-tagged` response shape grows two fields (`viewerAssertions`, per-row `onlyViewerVisible`). Compatible (additive), but tests for the read-only path need a small update to allow the new keys.
- A small race exists between publishing and refetching: the publish's signed event has to propagate through `publishToLocalStrfry` before `refetchRows` sees it. In practice this is the same shape Story 1 already accepted on the profile page. Mitigation: `await publishOrThrow(...)` before `refetchRows`; the publish's local-strfry write is synchronous on success.
- One Meili proxy request fires for the page-search per debounce-resolved keystroke (max one in flight at a time). On the same backend Brainstorm search has handled for months. Flag for caching only if measurably hot.
- The page-search doesn't show counts for hits not yet in the main list. Acceptable — the row's purpose there is "find and tag", not "compare counts." Counts surface once the row appears in the main list post-Apply.

### Option B — Separate `my-assertions-for-tag` endpoint + client-side merge

New endpoint `GET /api/profile-tags/my-assertions-for-tag?tagEventId=&viewerPubkey=` returns `{ assertions: { [pubkey]: 'applied'|'disputed' } }`. Client merges into the existing `profiles-tagged` response in `useTagDetail`.

**Pros**
- Smaller change to `profiles-tagged` (none).
- The viewer's assertion data is reusable from other surfaces (e.g., Story 5).

**Cons**
- Two round-trips per page render (and per sort change). Race conditions when responses arrive out of order — extra cancellation bookkeeping in the hook.
- Client-side union of viewer-only targets duplicates server logic the row enrichment is already doing. The "filter at view time" rule is honored either way, but client-side aggregation is a worse home for it — when pagination lands (ADR-0002's named follow-up), the server is the only place that can correctly insert viewer-only targets into the *sorted, sliced* page. Moving that logic to the server now is the path that survives pagination.
- The viewer-only badge needs a derived `onlyViewerVisible` flag. Computable client-side, but only after both responses arrive — adds yet another effect.

Reusability for Story 5 doesn't pay off here either: Story 5's "authored-tagging-on-profile" surface needs the *inverse* shape — "for this user, which tags has anyone applied/disputed to them," not "for this tag, what's the viewer's per-target state." Different query, different endpoint when we get there.

### Option C — Page-search as a modal, opened by an "Add profiles to tag…" button

Replace the always-visible search input with a button that opens a modal: search input + result list + Apply/Dispute inside the modal.

**Pros**
- Keeps the page's primary surface read-focused; the modal contains the "find arbitrary profiles" workflow.

**Cons**
- The story explicitly reads: "Given I am NIP-07-authenticated and on a tag page, when I look at the page, then I see a profile-search input…" The input is meant to be a visible workspace surface, not a modal trigger.
- One extra click before search, every time. Workspace-style pages benefit from low-friction surfaces.
- Apply-from-modal still has to update the page's main list. The data plumbing is identical to Option A; the modal frame is incidental cost.

### Option D — Bypass the viewer-union; show "you applied this" only as an inline confirmation toast

Don't change `profiles-tagged` at all. After publish, show a toast "Applied to <name>" but don't surface the viewer's freshly-tagged target in the list at all unless the WoT filter would have included it.

**Pros**
- Zero server change.

**Cons**
- Directly violates AC-6 ("that profile is now visible in the main list — even if my own assertion is the only one") and AC-7 (the visible badge). Non-starter.

## Decision

**Option A.** Extend `handleProfilesTagged` with `viewerPubkey` → adds a viewer-union step on the same scan + a single map and per-row flag on the response; extract `publishProfileTagAssertion` as a pure helper (single wire-shape source); inline `<TagPageSearch>` with reused `<SearchInput>`; per-row Apply/Dispute via new `<TagPageRow>` with per-row badge for the viewer-only state.

Why: it's the only option that honors all three CLAUDE.md invariants while keeping the new logic on the side that naturally owns it (the server already does POV-aware aggregation; the viewer-union is a natural extension). It also lands the contract pagination needs (ADR-0002's follow-up) without rework, gives one source of truth for viewer state across both lists, and reuses `<SearchInput>` where reuse cleanly fits without dragging the autocomplete dropdown into the wrong UX.

## Consequences

**Enables:**
- Per-row Apply/Dispute on the tag page with correct "already applied / already disputed" state derived from a single server-supplied map.
- Workspace UX: find arbitrary profiles via the page-search and tag them without leaving the page.
- The viewer sees their freshly-published assertion immediately in their personal view, with an explicit per-row marker explaining why it appears.
- One refetch (`refetchRows`) updates both the main list state AND the search-result button state — same `viewerAssertions` map drives both.
- `publishProfileTagAssertion` becomes the single source for the assertion wire shape — future surfaces (Story 5, bulk operations) compose it without reimplementing the event template.

**Constrains / makes harder:**
- `profiles-tagged` response grows two additive fields. Read-side tests need a small update; existing consumers (Story 2's read-only `useTagDetail`) ignore them harmlessly.
- The viewer-union does add a small per-request cost: one extra walk of the already-fetched `deduped` list, one extra `byTarget.set(...)` per viewer-only target. O(N) on the same data already in memory; immeasurable relative to the strfry scan + Meili fetch.
- The page-search fires one Meili proxy request per debounced keystroke (max one in flight). Same load profile BrainstormSearch already carries. Flag for caching only if measurably hot.
- Buttons can't be inside the row link — we move to a `<div>` row wrapper with a `<Link>` over the name/avatar/counts subtree and buttons as siblings. Minor JSX restructure to one component; clean to do.

**Follow-ups / debt:**
- **Pagination** (ADR-0002 follow-up): when `profiles-tagged` adds `limit`/`offset`/`total`, the viewer-union must be applied *before* the slice so viewer-only targets don't fall off the page when they would otherwise sort onto it. This ADR's algorithm (union → enrich → sort → [later: slice]) already places the union upstream of where the slice will live — pagination retrofit is mechanical.
- **Tag-page revoke** (`Out of scope` of the story): the existing `useProfileTags.revoke` already publishes kind-5 deletion events. When we add revoke from the tag page, the same `publishProfileTagAssertion` extraction makes it a 10-line component. Tracked, not in this ADR.
- **Bulk apply/dispute** (story: out of scope; future polish): the server-side viewer-union already supports it without further changes — the bulk surface would just publish N assertions and call `refetchRows()` once. Foundation laid.
- **Cross-POV authoring views** (out of scope): not in this ADR. Future surfaces would need their own contract.
- **Caching layer on `profiles-tagged`**: still a separate ADR if measured cost warrants. Not a v1 concern.

**Firmware reinstall required?** **No.** No concept-graph or schema changes. `nostr-user-tag` and `tag` were established by ADR-0001's firmware install; their wire shapes are reused unchanged. Story 3 is pure read/write composition + UI.

## Implementation notes

### Server (`src/api/profile-tags/index.js`)

- **Extend `handleProfilesTagged`**:
  - Read `req.query.viewerPubkey`. Validate as 64-char lowercase hex; if malformed, treat as absent (don't 400 — keeps the read-only contract working when a client sends a junk value).
  - After `dedupeReplaceable(events)` and before the existing `byTarget` loop:
    ```js
    const viewerAssertions = {};
    if (viewerPubkey) {
      for (const ev of deduped) {
        if (ev.pubkey !== viewerPubkey) continue;
        const pTag = (ev.tags || []).find((t) => t[0] === 'p');
        if (!pTag?.[1]) continue;
        const bucket = bucketize(readPolarity(ev));
        if (bucket === 'apply') viewerAssertions[pTag[1]] = 'applied';
        else if (bucket === 'dispute') viewerAssertions[pTag[1]] = 'disputed';
      }
    }
    ```
  - After the existing WoT-filter loop populates `byTarget`, run the viewer-union:
    ```js
    for (const targetPk of Object.keys(viewerAssertions)) {
      if (!byTarget.has(targetPk)) {
        byTarget.set(targetPk, { pubkey: targetPk, applications: 0, disputes: 0 });
      }
    }
    ```
  - Continue with the existing target-Meili-enrichment loop (it picks up the union targets the same way).
  - Before sorting, set per-row `onlyViewerVisible`:
    ```js
    for (const row of byTarget.values()) {
      row.onlyViewerVisible = !!viewerAssertions[row.pubkey]
        && row.applications === 0 && row.disputes === 0;
    }
    ```
  - Sort with `PROFILES_TAGGED_SORTERS[sort]` unchanged.
  - Return shape adds `viewerAssertions` (object; empty `{}` when no viewer / no viewer assertions) and per-row `onlyViewerVisible`:
    ```js
    res.json({
      success: true,
      povSuffix, minRank, sort,
      viewerAssertions, // new
      rows,             // each row now carries onlyViewerVisible
    });
    ```
  - **No route changes** — same path, same method.

### Client — new pure helper (`ui/src/utils/publishProfileTag.js`)

Extract from `useProfileTags`:
- Module-private `TA_PUBKEY` and `NOSTR_USER_TAG_HANDLE` constants — same values as in the existing hook.
- Export `publishOrThrow(signed)` (currently a module-private helper inside `useProfileTags.js`).
- Export `publishProfileTagAssertion({ tag, targetPubkey, polarity })` — body per the sketch in Option A.

Rewrite `useProfileTags.buildAndPublishAssertion` to call `publishProfileTagAssertion`. Story 1's profile-page surface continues to work unchanged.

### Client — `ui/src/hooks/useTagDetail.js`

- Add `viewerPubkey` to the rows-fetch URL when `user?.pubkey` is present.
- Read `viewerAssertions` from the response; default to `{}`.
- Introduce a `rowsReloadKey` state (`useState(0)`) and `refetchRows = () => setRowsReloadKey((k) => k + 1)`. Add `rowsReloadKey` to the rows-effect deps so changing it triggers a refetch without touching sort/POV.
- Return `viewerAssertions` and `refetchRows` from the hook.

### Client — new component `ui/src/components/TagPageRow.jsx`

- Props per Option A.
- Internal state: `publishingPolarity` (null / 'apply' / 'dispute'), `publishError` (string | null).
- Click handler wraps `onApply` / `onDispute` in try/finally that sets/unsets `publishingPolarity` and captures errors into `publishError`.
- Buttons disabled while publishing OR when `viewerState` matches that polarity. The matching-state button gets the `is-applied` / `is-disputed` class.
- Renders `<span class="bs-tag-row-badge">your assertion — not yet visible to this POV</span>` when `showActions && row.onlyViewerVisible`.
- Renders `<p class="bs-tag-row-error">⚠️ {publishError}</p>` after the row when `publishError`.

### Client — new component `ui/src/components/TagPageSearch.jsx`

- Props per Option A.
- Local state: `q`, `loading`, `error`, `hits`.
- Debounced (250ms) effect keyed on `(q, pov, user?.pubkey)`. When `q.trim().length < 2`, clears state and exits. Otherwise: builds the Meili URL (`q=&wotPov=&userPubkey=&limit=10&offset=0`), `fetch`es, merges hits.
- Cancels-on-unmount + last-write-wins guard via a sequence ref (same pattern as `useTagIndex`).
- Renders `<SearchInput variant="results" value={q} onChange={setQ} placeholder="Find a profile to tag…" />`, a loading line, an error line, and a `<ul class="bs-tag-row-list bs-tag-search-results">` of `<TagPageRow>`s built from hits. Each `<TagPageRow>` row uses `applications: 0, disputes: 0, onlyViewerVisible: false` (the section's purpose is "find + tag", not "show counts"). The viewerState comes from `viewerAssertions[hit.pubkey]`.

### Client — modify `ui/src/pages/Tag.jsx`

- Pull `viewerAssertions`, `refetchRows` from `useTagDetail`.
- Define `handleApply` and `handleDispute` per Option A. Both close over `tag` (loaded from header) and call `publishProfileTagAssertion` + `refetchRows`. Errors propagate; `<TagPageRow>` handles per-row surfacing.
- Wrap each main-list row in `<TagPageRow row={row} viewerState={viewerAssertions[row.pubkey] ?? null} showActions={!!user} onApply={handleApply} onDispute={handleDispute} />`. The existing `<Link>` becomes a child of `<TagPageRow>` spanning the name/avatar/counts subtree (not the buttons).
- Below the sort controls, when `user && tag`, mount `<TagPageSearch tagEventId={tagId} tagSlug={tag.slug} tagName={tag.name} viewerAssertions={viewerAssertions} pov={user ? 'user' : 'house'} user={user} onApply={handleApply} onDispute={handleDispute} />`.
- Logged-out: existing path renders without changes (TagPageRow with `showActions={false}` is a visual no-op for the buttons + badge).

### Client — `ui/src/styles.css`

Add (under the existing `bs-tag-*` namespace):
- `.bs-tag-row-actions` — flex / spacing for the button pair.
- `.bs-tag-row-apply` / `.bs-tag-row-dispute` — base.
- `.bs-tag-row-apply.is-applied`, `.bs-tag-row-dispute.is-disputed` — applied/disputed visual.
- `.bs-tag-row-apply[disabled]`, `.bs-tag-row-dispute[disabled]` — publishing/disabled state.
- `.bs-tag-row-badge` — inline marker pill.
- `.bs-tag-row-error` — per-row error line.
- `.bs-tag-search` — section spacing above the rows list, below the sort controls.
- `.bs-tag-search-results` — modifier for the result list (so it can visually differ from the main list slightly — e.g., subtler border).

### Tests (Tester writes; this is so the Implementer knows the surface)

- `profiles-tagged` with `viewerPubkey` returns `viewerAssertions` map and per-row `onlyViewerVisible`. Viewer-only targets appear; sort is correct on the union.
- The existing Story-2 tests still pass with no `viewerPubkey` — additive fields don't break them.
- UI: logged-in user sees buttons + search; logged-out sees neither.
- UI: clicking Apply on a row publishes a kind-39999 event with polarity=+1; the row reflects the applied state after refetch; click is idempotent (already-applied → no-op).
- UI: search input below threshold yields no fetch; above threshold yields a list of `<TagPageRow>` with buttons.
- UI: apply via search adds the row to the main list with the badge.
- UI: total publish failure surfaces an inline error on the row.

## Out of scope

- Revoking an assertion from the tag page (story explicit out-of-scope; profile-page Manage dialog still owns this).
- Editing or deleting the tag itself.
- Bulk apply/dispute.
- Cross-POV authoring views.
- Pagination on `profiles-tagged` (ADR-0002 follow-up; this ADR's algorithm orders the union ahead of where the slice will live so the retrofit is mechanical).
- Caching layer on `profiles-tagged`.
- Tags-as-result in root app search (separate ADR/story; tracked in `follow-ups.md`).
- Surfacing the page-search's autocomplete-style dropdown (with rank / NIP-05 chips) on the tag page — the row+button list is the deliberate UX choice for "find and tag," not "find and navigate."
- Reusing the per-row Apply/Dispute on the profile page (Story 1's chip popover is its own surface; future polish only).
