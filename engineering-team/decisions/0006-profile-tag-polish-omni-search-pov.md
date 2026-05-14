# ADR 0006: Profile-tag polish bundle — omni-search popup + POV correctness

**Status:** Proposed
**Date:** 2026-05-14
**Story:** `engineering-team/stories/7-profile-tag-polish-omni-search-pov.md`

## Context

Story 7 bundles three classes of polish/correctness work:

1. **Omni-search expansion** — surface tag-elements as a first-class result type in the live autocomplete popup.
2. **POV correctness** — fix `handleTagsForProfile` (the chip-row endpoint that's POV-naive today), audit the rest of the profile-tag stack for the same gap, fix any others.
3. **Cross-cutting items** — conditional POV selector in the upper-right avatar menu (gated on a pre-verification check), plus formal close-out of Story 6.

Concept-graph orientation (`/api/concept-graph/summaries` returns 38 concepts; the three relevant to this story are `tag`, `nostr-user-tag`, and `nostr-user`). All three are live and unchanged by this work. **No schema or concept-definition changes — no firmware reinstall required.**

### What's already done (verified by reading source)

Auditing as part of orientation surfaced that some Story 7 ACs are **already satisfied** in the codebase:

- **Search placeholder mentions "tag"** — already at `ui/src/pages/BrainstormSearch.jsx:951` (`placeholder="Search by name, bio, tag, NIP-05, website…"`). No code change needed; the AC verifies an existing behavior.
- **Chip-popover asserter list scrolls within max-height (Story 6 AC-4 inherited)** — already at `ui/src/styles.css:3881-3890` (`.ptc-asserters { max-height: 12rem; overflow-y: auto; }` with an explanatory comment citing Story-6 AC-4). No code change needed.
- **Chip-popover hover-bridge / persistence (Story 6 AC-1)** — already at `ui/src/styles.css:3846-3858` (`.ptc-popover::before` covers the chip→popover visual gap). No code change needed.
- **Asserter rows show display_name + avatar (Story 6 AC-3)** — already at `ui/src/components/TagChip.jsx:9-32` (`<AsserterRow>` uses `useProfiles` to fetch kind-0 metadata; falls back to short pubkey + initial).

So Story 7's actionable scope is narrower than the story text reads: the omni-search wiring, the POV-correctness fixes, and the conditional avatar-menu decision are the work. The other ACs are "verify and move on."

### What's NOT in the codebase yet

- **Tag-elements as a result type in the autocomplete popup.** Today the popup renders `data.hits` from `/api/search/profiles/meili`, where each hit is a profile. Tags surface only as `_matchedTags` chips attached to a profile row (Story 1's tag-aware search), never as their own row. The data the popup needs (`{ eventId, slug, name, description }`) is already produced by `findTagsByNameSubstring` in `src/api/profile-tags/index.js:202-221` — it just doesn't reach the popup.
- **WoT-author filter on `handleTagsForProfile`** (`src/api/profile-tags/index.js:122-164`). The function scans `'#z':[NOSTR_USER_TAG_Z_TAG], '#p':[pubkey]` and returns all bucketed assertions — no POV, no author filter. Consumer: `useProfileTags` (`ui/src/hooks/useProfileTags.js:39`) calls it as `?pubkey=<hex>` only. **CLAUDE.md POV-first invariant violation.**
- **WoT-author filter on `handleWotTags`** (`src/api/profile-tags/index.js:166-196`). Takes a `viewer` param but does not use it for WoT filtering; just returns the global set of referenced `tagEventId`s. **No current consumers** (grep `/api/profile-tags/wot-tags`: only the route registration + the function's own JSDoc reference it). Dead code, but live route — symmetry call.
- **Avatar-menu POV switcher.** `BrainstormUserMenu.jsx` displays POV as a label (`"Searching as: My WoT"` / house name) but has no setter; mid-session POV changes propagated from a global selector wouldn't invalidate currently-mounted hooks (`useTagDetail`, `useAuthoredTagging`, `useProfileTags`) — none of those subscribe to a POV-change signal. The `BrainstormSearch` inline `UserMenu` does have a `setPov` and a re-search effect (`BrainstormSearch.jsx:909-915` re-runs search when `pov` changes), but that's in-page only.

### Existing primitives we reuse

- `src/api/profile-tags/index.js` — `findTagsByNameSubstring` (already produces tag-result rows; used by `computeTagMatches`); `resolvePov` (already in use by `handleProfilesTagged` / `handleTagIndex` / `handleAuthoredBy`); `meiliFetchProfilesByPubkey`; `readPolarity` / `bucketize`.
- `src/api/search/profiles/meili/index.js` — the search proxy that the popup hits. POV-aware (it already calls `computeTagMatches` for tag-aware profile results). Natural home for the new tag-hits field.
- `ui/src/pages/BrainstormSearch.jsx` — autocomplete popup at lines 954–1000ish. Renders profile rows; we extend the loop to also render tag rows.
- `src/api/_shared/pov.js` — `resolvePov({ wotPov, userPubkey })`. Single source of truth for POV resolution.

### Constraints (CLAUDE.md)

- **POV-first.** The chip-row counts (after fix) and the popup tag-results (relevance still being defined) are per-POV outputs. We must not introduce persistent per-POV aggregates — re-derive at read time.
- **Decentralized-first.** Any pubkey publishes any assertion. The WoT filter is a *view-time* filter on authors, not a write-time gate.
- **Filter at view time.** Both fixes inherit this pattern from prior ADRs.

Project rules: no new lint/typecheck/build tooling, JS-without-build front end, hand-rolled Node test runner.

ADR review: ADRs 0001–0005 still hold. This ADR doesn't supersede any of them; it composes their patterns.

## Options considered

### Option A — Bolt tag-results onto the existing search proxy response (`data.tagHits`); narrow scope; drop the avatar-menu AC

**Tag-results in the popup:**

Extend `src/api/search/profiles/meili/index.js`'s response with `tagHits: [{ eventId, slug, name, description }]`. The proxy already calls `computeTagMatches` for tag-aware profile results — its first sub-step is `findTagsByNameSubstring(q)` for the same `q`. We surface that intermediate output directly, capped at a small N (e.g. 5) to keep the popup tight.

Why on the same endpoint and not a new one: one round-trip per keystroke is the popup's current rhythm. Adding a parallel `/api/search/tags` fetch doubles the request rate against the same query. Keeping it bolt-on means the popup gets profiles + tags in one response, ordered as the server sees fit.

**Server response shape (additive, backwards-compatible):**

```js
{
  hits: [...],                  // existing — profile result rows
  estimatedTotalHits: N,        // existing
  povSuffix: '...',             // existing
  // ...other existing fields...
  tagHits: [                    // NEW — tag-element rows for the popup
    { eventId, slug, name, description }
  ],
  tagHitsHasMore: <boolean>     // NEW — true when more tag matches exist beyond the cap
}
```

`tagHits` is omitted when the query is empty / too short. **Limit:** the server accepts an optional `tagLimit` query parameter (default 5, clamped to a max of 50). The popup uses the default; the Enter-results page passes a higher value. `tagHitsHasMore` is computed against whichever limit is in effect for the current request, so each surface's "more available" hint is accurate for *its* slice.

**UI rendering in the popup:**

The autocomplete dropdown renders `tagHits` first (above profiles), with a visually distinct row treatment so they don't read as profiles. Concrete treatment: a single-line row with a "tag" badge/icon on the left, the tag name, and an optional secondary line (truncated description). Click → `<Link to={\`/tag/\${slug}/\${tagEventId}\`}>`. Reuse the existing dropdown markup as much as possible — the suggestion is a *new row variant inside the existing dropdown*, not a separate column or sub-list.

UX ordering choice: tags first because they're typically far fewer than profile matches and they're the more specific intent — "I searched 'homesteader' because I want the tag, not 30 people who have it." Profile results follow in their existing order.

**"Show more" affordance for tag-results overflow.** When the server caps `tagHits` at the popup limit and more matches exist (signaled by the response's `tagHitsHasMore: true` field), the popup renders a small "Show more tags →" row at the end of the tag-rows section. Clicking it navigates to the Enter-results page for the current query (same destination as pressing Enter).

**UI rendering on the Enter-results page (added per PO direction).** Both surfaces hit the same search-proxy endpoint (`fetchSuggestions` for the popup; `doSearch` for the results page — verified at `BrainstormSearch.jsx:797, 848`). So `data.tagHits` flows to both for free — adding tag-rows to the Enter-results page is essentially one extra render block. We do it in this story rather than punt entirely to Story 8.

The results page renders tag-rows above the profile rows, same row variant the popup uses, no `TAG_HITS_LIMIT` cap on the visible count (the page has room). To allow the results page to request more than the popup's slice, the server accepts an optional `tagLimit` query parameter:

- Popup callsite (`fetchSuggestions`): omits `tagLimit` → server uses default 5.
- Results-page callsite (`doSearch`): passes `tagLimit=25` (or similar; Implementer picks a sensible higher number).

`tagHitsHasMore` is computed against whatever `tagLimit` is in effect, so the popup's "Show more tags →" reflects the popup's cap, and a (future) results-page "load more tags" would reflect the results-page's cap.

**What's left for Story 8 (residual jank):** the popup and the Enter-results page now both surface tag-results, but their **sort order and interleaving with profile-results may differ** — the popup orders tags first then profiles; the results page may end up doing the same naïvely but the Architect hasn't audited whether `doSearch`'s rendering loop interleaves tags identically. Story 8's parity work covers sort coherence + interleaving symmetry. Today's "Show more tags →" click lands on a page that **shows tags** (good — main jank closed); their relative position vs profiles **may visually shift** between surfaces (acceptable until Story 8 polishes).

**(Considered, rejected) "Show more" → tag-index page.** An alternative target for "Show more tags →" is `/tags?q=<query>` (Story 4's tag-index page already supports substring filtering on tag name+description). **Rejected** because it splits the omni-search mental model: typing in the global search and then being kicked to a *different page* with different navigation breaks the "one search, one results destination" UX principle the user explicitly favors. Routing to the Enter-results page keeps the model coherent.

**POV-correctness on `handleTagsForProfile`:**

Extend the function to accept `wotPov` + `userPubkey` query params; resolve POV via `resolvePov`; filter the surviving assertions to authors whose `wot_rank_<povSuffix> >= minRank`. Same fallback rule as the other endpoints: no POV configured → all assertions count (graceful degradation). Wire the client: `useProfileTags` (`ui/src/hooks/useProfileTags.js`) reads `user` from `useAuth`, threads `wotPov=user&userPubkey=<hex>` when logged in / `wotPov=house` otherwise. Effect deps gain `authLoading` (matches the auth-bootstrap gating precedent from Story 2/4/5 hooks).

**POV sweep findings (recorded):**

- `handleAvailableTags` — returns the global tag-element list for the picker. **Intentionally POV-naive**: the user might want to apply *any* tag that exists, not only ones their POV has used. Documented; no change.
- `handleTagsForProfile` — **fix above.**
- `handleWotTags` — POV-naive; takes a `viewer` param but doesn't filter. **No current consumers** (verified by grep). Decision: **fix it for symmetry** (replace `viewer` param with the standard `wotPov` + `userPubkey` pair; resolve POV; WoT-filter the assertions before collecting `tagEventId`s). Zero functional impact today (no callers); preserves the read-stack's POV-first invariant for any future caller.
- `handleMatch` — already POV-aware via `computeTagMatches`. ✓
- `handleTagById` — single-event lookup, no counts. POV-irrelevant. ✓
- `handleProfilesTagged`, `handleTagIndex`, `handleAuthoredBy` — POV-aware via `resolvePov`. ✓

**Avatar-menu POV selector (conditional AC) — DROPPED in Option A:**

The pre-verification gate in the story asks: does on-the-fly POV switching from anywhere correctly re-derive all POV-dependent state? Inspection of the existing hooks reveals it does NOT today:

- `useTagDetail.js` keys its rows-fetch effect on `(tagId, sort, authLoading, user?.pubkey, rowsReloadKey)`. **No POV-change subscription.** Mid-session POV change wouldn't trigger a re-fetch.
- `useAuthoredTagging.js` keys on `(profilePubkey, sort, authLoading, user?.pubkey)`. **Same gap.**
- `useProfileTags.js` keys on `(targetPubkey, reloadKey)`. **Same gap.**
- `BrainstormSearch.jsx`'s inline `UserMenu` is the **only** surface that wires POV-change → re-fetch (`useEffect` at lines 909–915 watches `pov` and re-runs `doSearch`). That's in-page only.

To honor the AC properly, we'd need cross-page POV invalidation — a `POVContext` (or equivalent global signal) that every POV-aware hook subscribes to, and a refactor of each affected hook's effect deps. **That's story-sized infrastructure work**, not a polish item. The Story 7 conditional explicitly says: "If gaps surface, drop this AC and file the gaps as follow-ups."

**Action:** drop the avatar-menu POV selector AC from Story 7's implementation scope. File the cross-page POV invalidation as a follow-up (likely future Story 9 or later). `BrainstormUserMenu` keeps its current display-only POV indicator.

**Story 6 close-out:**

Story 6 AC-1/2/3 shipped via commit `1e5b3044`. AC-4 (scroll within max-height) is already in CSS at `styles.css:3881-3890`. AC-5 (placeholder mentions "tag") is already in the JSX at `BrainstormSearch.jsx:951`. **Verify all four** during Implementation/Review (read the lines, confirm); then retire Story 6 to `engineering-team/stories/done/` and set its Status to Done in this story's Review commit (per workflow §5 retire pattern).

**Pros**

- One round-trip per keystroke; tags + profiles in the same response; popup-rendering changes are local to the existing dropdown.
- POV-correctness fixes follow the established pattern (`resolvePov` + author-WoT predicate + Meili `wot_rank_<suffix>` lookup) — zero novel server logic.
- Dropping the avatar-menu AC keeps the bundle's scope honest. The cross-page POV invalidation work is genuine architecture and deserves its own story.
- All four Story-6 ACs verifiable as already-done lets us close Story 6 with no incremental implementation effort.
- No concept-graph changes, no firmware reinstall.

**Cons**

- The popup now mixes two semantically different row types (tag vs profile). Risk of visual confusion if the row variant treatment isn't crisp — Implementer must get the badge/styling right.
- `tagHits` is a new response field; clients that ignore unknown fields are unaffected (the existing client does), but external API consumers (if any) see a contract addition.
- Dropping the avatar-menu AC is mildly disappointing — the user explicitly wanted it. The follow-up captures the gap and tees up the right next move.
- `handleWotTags` fix is purely for symmetry — zero current callers means zero observable effect today. Justifiable, but trivially over-scoped.

### Option B — Separate `/api/search/tags` endpoint; same other choices

Same as Option A for everything except the tag-results data flow: instead of bolting onto the search proxy, the popup fires a parallel `fetch('/api/search/tags?q=…')` alongside the profile-search fetch. The server endpoint wraps `findTagsByNameSubstring(q)` + the existing `computeTagMatches` filter rules (optional, since tag-name-substring on its own is POV-naive — tag elements are global publishable artifacts and don't have author-WoT to filter).

**Pros**

- Cleaner separation: profile-search proxy stays focused on profiles; tag-search has its own endpoint with its own contract.
- Easier to evolve the tag-search shape later without disturbing the profile-search contract.

**Cons**

- Doubles the round-trip rate per keystroke. Concrete cost: at the popup's 200ms debounce + a 2-char threshold, each query becomes 2 requests instead of 1. Latency-wise it's parallel (same wall time), but server-side it's literal 2× load on the search subsystem.
- The popup's render needs to handle two independent async resolutions — race conditions / staleness become a UI concern. Option A's single-response avoids this entirely.
- Doesn't actually buy us much architecturally: the proxy already has access to `findTagsByNameSubstring`, so reusing it in-process is cheaper than a fresh endpoint.

### Option C — Unified `/api/search` endpoint that returns mixed results

A new endpoint that returns a single `results: []` array with mixed types (`{ type: 'profile' | 'tag', ... }`). Both the popup and Enter-results page consume it.

**Pros**

- Closes the popup-vs-Enter-results parity gap implicitly (Story 8's job becomes "consume the same endpoint everywhere"). Elegant.

**Cons**

- Major refactor. Touches the profile-search proxy + the popup + (eventually) the Enter-results page. Conflicts with Story 7's "polish bundle" framing — this is architecture work.
- Story 8 was scoped to handle the parity work as its own story. Doing it now folds Story 7 and Story 8 together against the user's explicit sequencing.
- Today's profile-search proxy has months of accumulated POV / filter / sort logic, NIP-05-lookup fallback, etc. Refactoring that into a generic `results` endpoint is non-trivial.

## Decision

**Option A.** Bolt `tagHits` onto the existing search-proxy response; add the `tag` row variant to the autocomplete dropdown rendering; fix `handleTagsForProfile` and `handleWotTags` for POV correctness; **drop the avatar-menu POV selector AC** and file cross-page POV invalidation as a follow-up; verify Story 6 ACs as already-done and retire Story 6 in this story's Review commit.

Why: it's the option that honors all three CLAUDE.md invariants (no persistent per-POV aggregate, no write-time gating, all aggregation per-POV at view time), keeps the scope honest (no infrastructure work disguised as polish), and composes existing primitives cleanly (`findTagsByNameSubstring`, `resolvePov`, `meiliFetchProfilesByPubkey`). It also leaves Story 8 free to do its parity work without being blocked by an in-flight refactor.

## Consequences

**Enables:**

- Tag-elements discoverable as a first-class result type in the live popup — typing "homesteader" surfaces the tag itself, not only profiles who've been tagged with it.
- POV-correctness across the entire profile-tag read stack — every chip-count, every search-derived count, every aggregate now WoT-filters its authors consistently. Closes a real correctness gap on the chip-row.
- The verified Story-6 close-out lets us reduce the open-stories count by one and keep the engineering-team narrative coherent.
- Architectural ground prepared for Story 8 (popup ↔ Enter-results parity) — Story 8 inherits a popup that has the full result-row set; its job is to make Enter-results match.

**Constrains / makes harder:**

- The popup dropdown now renders mixed row types. The Implementer must keep the visual distinction crisp so users don't misread a tag row as a profile row (or vice versa).
- `handleTagsForProfile` response shape gains POV-echo fields (`povSuffix`, `minRank`) for parity with the rest of the read stack — additive, backwards-compatible.
- The dropped avatar-menu AC is a known-unship. Documented in the follow-up.

**Follow-ups / debt:**

- **Cross-page POV invalidation infrastructure** — file as a new follow-up entry. Sketch: `POVContext` (or equivalent client-side observable POV state) + plumbing every POV-aware hook to re-fetch when the POV changes. Once that exists, Story 7's avatar-menu AC becomes implementable without the gate.
- **`handleAvailableTags` POV-naivete is intentional.** Documented above. If a future story decides the tag picker should be POV-scoped (e.g., "only show tags known to my WoT"), it gets its own ADR; until then, the global picker is correct.
- **Story 8** stays tabled and follows after Story 7. Its scope (popup ↔ Enter-results parity) inherits a popup with tag-results.

**Firmware reinstall required?** **No.** No concept-graph or schema changes.

## Implementation notes

### Server (`src/api/search/profiles/meili/index.js`)

- **Extend the search-proxy response with `tagHits` + `tagHitsHasMore`.** In the existing handler, before composing the response, call `findTagsByNameSubstring(q)` from `src/api/profile-tags/index.js`. Read `tagLimit` from `req.query`:
  - If `req.query.tagLimit` is present and parses to a positive integer, use it (clamped to a sane server-side max — suggest 50 to avoid pathological scans).
  - Else default to `TAG_HITS_LIMIT_DEFAULT = 5`.
  Include in the response object:
  - `tagHits: matches.slice(0, effectiveLimit)`
  - `tagHitsHasMore: matches.length > effectiveLimit`
  Empty/short queries → omit both fields (or `tagHits: []` / `tagHitsHasMore: false` — Implementer chooses; the client tolerates either).
- Add an import line for `findTagsByNameSubstring` if not already exported; **if it isn't exported**, add it to the module's exports.

### Server (`src/api/profile-tags/index.js`)

- **Extend `handleTagsForProfile`** to accept `wotPov` + `userPubkey` query params:
  - Call `resolvePov({ wotPov: req.query.wotPov || 'house', userPubkey: req.query.userPubkey || null })`.
  - If `wotFiltering = !!povSuffix && Number.isFinite(minRank)`: collect unique author pubkeys from the deduped events; batch-fetch their Meili docs via `meiliFetchProfilesByPubkey`; build an `authorAllowed` predicate (`doc?.[wot_rank_<suffix>] >= minRank`); filter the deduped events to allowed authors **before** the polarity-bucket loop.
  - If not WoT-filtering: existing behavior unchanged (no-op fallback, matches other endpoints).
  - Response shape adds `povSuffix` and `minRank` echo fields (additive; existing `pubkey` / `applications` / `disputes` unchanged).
- **Extend `handleWotTags`** to the standard POV-resolution pattern:
  - Replace the current `viewer` param with `wotPov` + `userPubkey` (same as the other endpoints). For backwards compat with the deprecated `viewer` param: keep accepting `viewer` and route it to `userPubkey` if `userPubkey` is absent — minor compatibility nicety. **Even simpler**: since there are no current consumers, just swap the params outright with no compat layer. Implementer choice; default to the simpler outright swap given the dead-code state.
  - Apply the same WoT-author filter as above before collecting `tagEventId`s.
  - Same no-POV fallback rule.

### Client (`ui/src/hooks/useProfileTags.js`)

- Import `useAuth` from `../context/AuthContext`.
- Read `{ user, loading: authLoading }` inside the hook (mirrors `useTagDetail` / `useAuthoredTagging` pattern).
- Gate the existing fetch effect on `!authLoading` (add to effect deps).
- Build `tags-for-profile` URL with query params:
  - `pubkey=<targetPubkey>` (existing).
  - When `user?.pubkey` is present: `wotPov=user&userPubkey=<user.pubkey>`. Otherwise: `wotPov=house`.
- No change to the `viewerPubkey` prop's existing role (which is for the "my assertions" partition inside `ProfileTagsSection`).

### Client (`ui/src/pages/BrainstormSearch.jsx`)

- **Render tag-result rows in the autocomplete dropdown.** Locate the suggestion-rendering loop in the landing-view dropdown (around line 957). Before iterating `suggestions`, iterate `tagHits` (read from the search-proxy response and stored in component state alongside `suggestions`). Each tag row renders:
  - A small "tag" icon or badge (visually distinct from profile-row avatars; use one of the existing CSS namespaces like `bs-suggest-tag-*`).
  - The tag name (primary).
  - Optional: truncated description (secondary line, ~140 chars).
  - The row is an `<a href={\`/tag/\${slug}/\${eventId}\`}>` (or `<Link>` — match the surrounding pattern).
- **"Show more tags →" row.** After the last `tagHits` row, when `tagHitsHasMore` is truthy, render one more row inside the same tag-rows section. Clicking it should trigger the same navigation as pressing Enter on the current query (i.e., it routes to the Enter-results page with `q=<current query>`). Use the existing `doSearch()` / navigation pattern in `BrainstormSearch.jsx` so the route is consistent with submit. Add a brief inline comment referencing Story 8 and the transient (the Enter-results page doesn't surface tag results yet — Story 8 fixes that).
- **State plumbing for the popup:** the existing `setSuggestions(filtered)` path receives the response; add `setTagHits(data.tagHits || [])` and `setTagHitsHasMore(!!data.tagHitsHasMore)` next to it (with corresponding state slots at the top of the component). The dropdown's render branch already conditional on `showSuggestions && suggestions && suggestions.length > 0` — adjust to also render when `tagHits.length > 0`. The popup's fetch URL **does not** include `tagLimit` (server defaults to 5).
- **Render tag-result rows on the Enter-results page.** Locate the results-view rendering (the branch after `hasResults && !loading && !error` returns false; results render around line 720-ish in `BrainstormSearch.jsx`). Add a tag-rows section above the profile-rows section, using the same tag-row variant component as the popup. Render `resultsTagHits` (parallel state to `results`) populated by `doSearch`.
- **`doSearch` URL augmentation.** In `buildSearchUrl` (line 753) or in `doSearch` directly, append `tagLimit=25` (or similar Implementer-chosen value) to the URL when the call comes from the results-page path. The popup's `fetchSuggestions` (line 848) doesn't append `tagLimit` and gets the server default.
- **State plumbing for the results page:** `setResultsTagHits(data.tagHits || [])` next to `setResults(data.hits || [])` in `doSearch`. No "Show more" affordance on the results page in this story (it'd be redundant — the user is already on the destination). Story 8 can add pagination if needed.
- **Shared tag-row variant component.** To keep the popup and Enter-results page render consistent, extract a small `<TagResultRow>` component (or similar) that both surfaces consume. Story 8 will likely refine the visual treatment further; having a single component now means Story 8 doesn't have to chase divergent rendering across two surfaces.

### Client (`ui/src/components/BrainstormUserMenu.jsx`)

- **No change.** The avatar-menu POV selector AC is dropped (see Decision). The display-only POV label stays as-is.

### Story 6 close-out (Review-phase work)

During the Review phase for Story 7:

1. Verify Story 6 AC-1 implementation at `ui/src/styles.css:3846-3858` (hover-bridge) and `ui/src/components/TagChip.jsx:84-95` (mouse/focus handlers).
2. Verify Story 6 AC-2 at `ui/src/components/TagChip.jsx:14` (`<Link to={\`/user/\${entry.authorPubkey}\`}>`).
3. Verify Story 6 AC-3 at `ui/src/components/TagChip.jsx:10-32` (`<AsserterRow>` with `useProfiles`).
4. Verify Story 6 AC-4 at `ui/src/styles.css:3881-3890`.
5. Verify Story 6 AC-5 at `ui/src/pages/BrainstormSearch.jsx:951`.
6. Set Story 6 `**Status:** Done`; `git mv` Story 6's file to `engineering-team/stories/done/`. (Story 6 never had a test plan file.)
7. Story 7's review commit includes Story 6's retire-to-done.

### Tests (Tester writes; this is so the Implementer knows the test surface)

- **Server contract for `handleTagsForProfile`:** accepts and echoes POV params; returns `povSuffix`/`minRank` in response; rejects malformed `userPubkey` (or treats malformed as absent, matching the read-stack precedent).
- **Server contract for `handleWotTags`:** accepts new POV params; returns `povSuffix`/`minRank` in response.
- **Search proxy:** when given a query with known matching tags, response includes `tagHits` with the expected shape; empty/short queries omit or empty-array the field; `tagHits` capped at 5.
- **Server publish-flow for `handleTagsForProfile`:** with a configured POV and a target pubkey tagged by both in-WoT and out-of-WoT authors, only in-WoT applications/disputes appear in the response.
- **Server publish-flow for the search proxy's tag-hits:** with a query that matches a fixture tag's name (case-insensitive substring), the response's `tagHits` includes that tag.
- **UI Playwright:** typing a string that matches a tag's name → a tag-row variant appears in the popup (distinct from profile rows); clicking it navigates to `/tag/:slug/:tagId`.

## Out of scope

- **Tag results in the Enter-results page.** Story 8.
- **Sort-order coherence between popup and Enter-results page.** Story 8.
- **POV selector loading state polish.** Story 8 or its own tail-end fix-PR.
- **Avatar-menu POV selector.** AC dropped per the pre-verification gate; cross-page POV invalidation files as a follow-up.
- **`handleAvailableTags` POV-scoping.** Intentionally global (tag picker shows all known tags); no change.
- **Agree/disagree framing UX normalization** across tag-detail rows and chip popovers. Remains in `engineering-team/follow-ups.md`.
- **`e` vs `a` wire-shape decision for nostr-user-tag.** Remains in `engineering-team/follow-ups.md`.
- **New result types in the popup beyond profiles + tags.** Out of scope.
- **Caching layer on any of the affected endpoints.**
- **Pagination retrofits on `profiles-tagged` / `authored-by`.** Named follow-up alongside ADR-0002 / ADR-0005.
