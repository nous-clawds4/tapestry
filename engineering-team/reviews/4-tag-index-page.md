# Review: Story 4 — Tag index page

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-14
**Diff:** `git diff 1e5b3044...HEAD` (ADR `22cb1704`, tests `5e8f9e6a`, impl `dba91bea`)

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS** (53 passed, 1 per-test SKIP).

  ```
  Test Results
  -------------
  Configuration Loading:        PASS
  profile-tags suite:           PASS (13 passed, 0 failed)
  profile-tags-publish suite:   PASS (7 passed, 0 failed)
  tag-detail suite:             PASS (8 passed, 0 failed)
  tag-detail-publish suite:     PASS (9 passed, 0 failed)
  tag-index suite:              PASS (7 passed, 0 failed)
  tag-index-publish suite:      PASS (9 passed, 0 failed)
  Overall:                      PASS
  ```

  The SKIP is the POV-narrow test (`index drops tags whose ONLY assertions come from authors below the POV WoT rank threshold`), gated on `/var/lib/brainstorm/settings.json` being writable from the test process — same documented infra constraint as Stories 2 and 6.

- [ ] `npm run test:playwright` — **NOT RUN** by reviewer. `@playwright/test` isn't in this dev box's local `node_modules` (same pre-existing constraint Stories 1–6 documented). The spec at `tests/brainstorm/tag-index.spec.js` parses cleanly. The Implementer manually smoke-tested in the browser; the user signed off on the visual + interaction (sorts, "Only show mine" toggle, breadcrumb navigation, search filter).

- [ ] _Lint not configured — skipped per house rules._
- [ ] _Typecheck not configured — skipped per house rules._
- [ ] _Build not configured — skipped per house rules._

## Spec adherence

- [x] **Every acceptance criterion has a passing test.** Cross-referenced the test-plan coverage map against the story's 10 ACs:
  - AC-1 (top-level nav → /tags) → Playwright test, updated mid-impl to assert the **body breadcrumb** on `/tag/<id>` rather than a TopBar entry. See "Notable spec drift" below.
  - AC-2 (rows = tags with ≥1 WoT assertion) → publish-flow `tag with zero assertions does NOT appear in the index` + the three sort-order tests.
  - AC-3 (row content + click → detail page) → publish-flow row-shape test; click destination is the same `/tag/:slug/:tagId` route Story 2 covers.
  - AC-4 (three sort labels + formulas) → Playwright label test + three server-side sort-order tests + invalid-sort 400 test.
  - AC-5 (default sort `used`) → server default-sort test + Playwright active-indicator test.
  - AC-6 (in-place sort change) → covered transitively via sort tests + hook precedent from `useTagDetail`.
  - AC-7 (q substring + reuse same component) → server publish-flow tests on name + description + no-match; Playwright shared-CSS-class test proves `<SearchInput>` reuse.
  - AC-8 (pagination) → publish-flow `limit=2 / offset=0 + offset=2 covers the fixture without overlap` + server limit-cap + offset-echo tests.
  - AC-9 (sort/filter change resets to first page) → hook-level concern; covered by hook code review (reset-on-change is explicit in `setSort` / `setQ` / `setMineOnly` wrappers).
  - AC-10 (empty state) → Playwright heading-renders test + server `q with no matches returns total=0 and empty rows`.

- [x] **No criterion silently dropped.**

- [⚠] **Bonus behavior added beyond the story.** Two additions outside ADR-0003:
  1. **`authoredBy` server param + "Only show mine" UI toggle** — added mid-implementation at user request. Implementer flagged this prominently in the commit message. Functional and smoke-verified, but has no automated test coverage (no contract echo test, no publish-flow filter narrowing test). See "Non-blocking" #1 below.
  2. **`← All tags` body breadcrumb** instead of a `<TopBar>` nav entry — also user-directed mid-impl. Playwright AC-1 test was updated to match.

## ADR adherence

- [x] **Server endpoint matches ADR.** `handleTagIndex` in `src/api/profile-tags/index.js` implements the documented algorithm: resolvePov → scan assertions → WoT-filter → group by `e`-tag → bucket polarity → batch-scan tag-elements → parse payload → q filter → sort → paginate → enrich. Sorters at module scope (`TAG_INDEX_SORTERS`) match the ADR's three formulas precisely (incl. tiebreakers).
- [x] **Limit/offset clamps** match the ADR (limit 1–200, offset ≥ 0). Verified at `src/api/profile-tags/index.js:566-569`.
- [x] **POV-first invariant preserved.** Counts derived per-request from raw assertions via `wot_rank_<suffix>` Meili lookup — zero persistent per-POV aggregate.
- [x] **`<SearchInput>` extraction matches ADR shape** (variant + value/onChange/onKeyDown/onFocus + children slot for autocomplete dropdown). Both root search call sites consume it.
- [x] **`<TopBar>` extraction** — implemented with one documented deviation (see ADR-deviation notes below).
- [x] **Route `/tags`** added top-level in `App.jsx` alongside `/tag/:tagId`.
- [x] **Hook auth-bootstrap gate** (`useTagIndex` returns early on `authLoading`) matches the ADR's fresh-load correctness requirement.
- [x] **Reset offset on sort/q/mineOnly change** — explicit setter wrappers in `useTagIndex` (lines 31–42).
- [x] **`liveSeqRef` guards against stale fetch completions** stomping fresh results — actually stronger than `useTagDetail`'s `cancelled` flag pattern. Welcome addition.

- [⚠] **Documented deviations from ADR-0003** (Implementer flagged in commit; all reasonable):
  - **TopBar gained an optional `authMenu` slot** rather than always mounting `BrainstormUserMenu`. Justified: BrainstormSearch's `UserMenu` is state-heavy (POV controls, filters, sort config) — forcing the simple `BrainstormUserMenu` would silently strip features. ADR's intent (unify the top-rail, kill 5-place duplication) preserved.
  - **BrainstormSearch's results-mode header (`bs-results-header`) does NOT migrate to `<TopBar>`.** The bar has search input + personalization picker baked in; migrating cleanly would either break results-mode UX or balloon TopBar's API beyond the ADR's specification. Landing-mode migrates fully.
  - **`Tags` removed from default `TopBar` navLinks** per user direction mid-impl. The tag-index entry point now lives as a body breadcrumb on the single-tag-view page.
  - **`.bs-search-box-results` gained `display: flex` + a pill background** so the shared SearchInput's icon sits inside the pill instead of stacking above the input.
  - **`.bsp-top-bar` got `position: relative` + `z-index: 2`** so `bs-landing`'s `-4rem` hero margin doesn't intercept clicks on the auth area. This fixed the "sign-in button not clickable on landing" bug the user caught during impl.

## Concept-graph integrity

- [x] **No concept changes.** ADR-0003 explicitly states "Firmware reinstall required? **No.**" Story 4 reuses the `tag` and `nostr-user-tag` concepts from ADR-0001.
- [x] **Handles in `kind:pubkey:slug` form.** New code uses the existing `NOSTR_USER_TAG_Z_TAG` constant (`39998:<TA>:nostr-user-tag`); no new handles introduced.
- [x] **No BIBLE.md or firmware-JSON reads in new code.** All lookups go through strfry / Meili / the concept-graph API.

## Things tests can't catch

- [x] **No secrets in committed files.** Scanned diff — none.
- [x] **No leftover debug logging.** `grep -E "console\.|TODO|FIXME|debugger"` against additions returned empty.
- [x] **No commented-out code.** Diff clean.
- [x] **Error paths handled.** Server: 400 / 500 with descriptive messages; UI hook captures `error` and surfaces it inline. Meili-unreachable on enrichment degrades to `displayName: null, picture: null` rather than failing the request.
- [x] **Race conditions considered.** `useTagIndex` uses both `cancelled` + a sequence number (`liveSeqRef`) to drop stale fetch completions when sort/q/mineOnly/offset change quickly. Auth-bootstrap gating prevents the fresh-load POV race.
- [x] **Security: input validation at boundaries.** `sort` validated against allowlist; `limit` / `offset` clamped numerically; `q` is a typed string, trimmed; `authoredBy` validated with `/^[0-9a-f]{64}$/`. strfry filter composed from validated inputs (no shell-injection vector).
- [x] **Latent prop-bug fixed.** The previous `Tag.jsx` had `<BrainstormUserMenu user={user} onLogin={login} onLogout={logout} />` — wrong prop names (the component expects `login`/`logout`). The TopBar migration replaced this with `<TopBar />`, which passes the correct prop names. Login on the tag-detail page (Story 2) would have been silently broken before this change.

## House rules check

- [x] **Concept Graph API authority respected.**
- [x] **No new lint/typecheck/build tooling.**

## Notable spec drift (not blocking, but worth recording)

The story's AC-1 reads: *"Given a top-level navigation entry exists for the tag index, when I click it, then I navigate to a stable shareable URL for the index."* The Architect specified this as a `<TopBar>` nav link reachable from anywhere. The user re-routed mid-impl to a body breadcrumb on the single-tag-view page only — reachable from that one surface, not globally.

This is a permissive re-interpretation of "top-level": a body breadcrumb on a specific page is arguably *not* "top-level navigation" in the traditional UI sense. But it's a user product call, the Playwright test was updated to match, and the AC is satisfied literally (an entry exists that reaches /tags). Recording here so future readers see why ADR-0003's "TopBar with Tags nav link" doesn't reflect the shipped state.

## Findings

### Blocking

_None._

### Non-blocking

1. **`authoredBy` filter has no automated coverage.** Added at `src/api/profile-tags/index.js:574-575` (param parsing) + `:646-648` (filter application) + UI in `ui/src/hooks/useTagIndex.js:66-70` and `ui/src/pages/Tags.jsx:78-87`. Smoke-tested manually (a synthetic `authoredBy=aaaa…` returned `total: 0, rows: []`). Recommend a small follow-up: add a contract test echoing `authoredBy` in the response shape, and a publish-flow assertion that a tag authored by `tagAuthorPk` is included when `authoredBy=tagAuthorPk` and excluded otherwise. Not a blocker for v1 because the regex validation is tight and the failure mode is "filter returns nothing" (visible).

2. **Comment lag in Playwright spec.** `tests/brainstorm/tag-index.spec.js:25` says *"Tag.jsx still renders its TopBar (with the 'All tags' link)"* — but the "All tags" link is in the page body (breadcrumb), not TopBar. The selector `a[href="/tags"]` finds it either way so the test still works; comment is stale. Optional cleanup.

3. **`useTagIndex` exports `user`** — the page passes through `user` to gate the "Only show mine" toggle render. Pragmatic but mixes auth concerns into a data hook. Future cleanup: have `Tags.jsx` call `useAuth()` directly and the hook keep its concerns to the index data only. Non-blocking.

4. **No active-state styling on `<TopBar>` nav links beyond `.is-active` opacity bump.** ADR called this out as acceptable for v1.

5. **Inline `require('../_shared/pov')` inside `handleTagIndex`** at `src/api/profile-tags/index.js:582`. Same nit as Story 2's `handleProfilesTagged`; flagged consistently. Optional hoist to top-of-file alongside the other requires.

## Verdict

**PASS**

The implementation matches the story, ADR (with documented deviations), and test plan. All quality gates clean (or correctly skipped for documented infra reasons). Architecture invariants honored (POV-first, view-time filtering, decentralized-first). Non-blocking findings are scope-extensions (`authoredBy`) that work but lack automated tests, plus minor doc/style nits. The `authoredBy` test gap is the most material finding; recommend logging a small follow-up to backfill rather than blocking the merge.
