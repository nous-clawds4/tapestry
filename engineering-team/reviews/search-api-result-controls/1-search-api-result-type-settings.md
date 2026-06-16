# Review: Story 1 (search-api-result-controls) — Admin control over result types in the public search API

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-10
**Diff:** `git diff cb366a13..854df80c` (implementation commit `854df80c`; tests at `cb366a13`, ADR at `f4644a58`)
**Files:** `src/api/search/profiles/meili/index.js`, `src/config/defaults.json`, `ui/src/pages/grapevine/SearchPreferences.jsx`

## Quality gates (run by reviewer, not trusted)

- [x] `node test/search-api-result-type-settings.test.js` — **16 passed, 0 failed** (run 2026-06-10).
- [x] `npm test` (full gate) — story suite **PASS (16/0)**. Overall FAIL due to **5 failures in 3 suites, all outside this diff** (see "Out-of-scope failures" below); the diff touches none of those suites' subjects (`git diff --name-only` confirms: meili proxy, defaults.json, SearchPreferences.jsx only).
- [x] `node --check` on the changed JS — clean. `defaults.json` parses.
- [x] Live verification reproduced during Implementation on the local container: default → no tag keys; settings flip → `tagHits: ["bird"]` with no restart; profiles-off → 0 hits with tagHits flowing. (Implementer's transcript; consistent with the unit suite I ran.)
- [ ] Playwright — not run (no browser this session). The admin card is covered at source-contract + API level; one-minute manual click-through on `/tapestry/grapevine/search-preferences` recommended at deploy time.
- _Lint / typecheck / build — not configured; skipped per house rules._

## Spec adherence

- [x] **AC-1** — default = main's contract: defaults.json contract test + key-omission tests + `_matchedTags` absence + stale-settings fallback. Verified against `origin/main` (zero tag references in main's proxy) during Architecture.
- [x] **AC-2** — opt-in restores feature behavior: keys present when enabled; partial-override deep-merge covered; live check surfaced real tag data.
- [x] **AC-3** — per-type toggles + warning: server semantics (3 tests incl. tags-only mode, pubkeyLookup suppression); card + "Profiles are excluded" warning (source-contract). Card renders only for owner/admin (`SearchPreferences.jsx` — `{isOwnerOrAdmin && <SearchApiResultTypesCard …>}`).
- [x] **AC-4** — no redeploy: per-request `getResultTypes()` read; three-calls-one-process flip test passes; live flip confirmed.
- [x] **AC-5** — authorization: unauthenticated GET/PUT `/api/settings` → 401 (live tests, passed). Positive admin path rides the pre-existing `requireOwner` (owner-or-admin) gate in `settingsApi.js` — unchanged by this diff.
- [x] **AC-6** — own-UI coherence: client defensive-read pins pass; no client search-path changes (correct per ADR).
- [x] No criterion dropped; no behavior beyond the story (BrainstormSearch, grapevinePrefApi, NIP-50 proxy, profile-tags endpoints all untouched).

## ADR adherence

- [x] Files changed exactly match ADR implementation notes (3 files, nothing else).
- [x] Layering: gate lives in the proxy handler; setting lives in the two-layer settings system; transport reuses `PUT /api/settings`. No new endpoint, no new dependencies.
- [x] Key omission (not empty values) when tags disabled — `responsePayload` built without the keys; conditional block mirrors ADR's sketch.
- [x] Profiles-off path synthesizes the stable shape `{hits: [], estimatedTotalHits: 0, processingTimeMs: 0, query}` with `povSuffix`/`_wotCount`/`_filtered` preserved — as specified.

## Concept-graph integrity

- [x] No concept changes; no handles introduced; firmware reinstall not required (ADR states this; confirmed — no firmware/ paths in diff).

## Things tests can't catch

- [x] No secrets, no leftover debug logging (the two `console.error` calls are pre-existing pattern, retained inside the enabled branches only), no commented-out code.
- [x] Error paths: `getResultTypes()` try/catch hard-falls to safe defaults; card reverts optimistic state and surfaces the error on failed PUT; 502 path for downstream search preserved verbatim when profiles enabled.
- [x] Input robustness: junk values written to `resultTypes` via the (relay-URL-only-validated) settings PUT degrade safely — `rt.tags === true` / `rt.profiles !== false` coerce strictly, and the failure direction is the safe one (tags off, profiles on).
- [x] Concurrency: card PUTs the whole `resultTypes` object — last-write-wins between concurrent admins. Acceptable for a two-key, owner/admin-only object.

## House rules check

- [x] No new lint/typecheck/build tooling. No new npm dependencies.
- [x] TA-pubkey rule untouched (no pubkey literals in diff).

## Findings

### Blocking

None.

### Non-blocking

1. **`src/api/search/profiles/meili/index.js:182`** — `tagMatchPromise` is gated on `tags && profiles`, where the ADR's tags-off note mentioned only the tags gate. This is a justified refinement, not drift: the ADR's own profiles-disabled contract (`hits: []`) is unsatisfiable if tag-matched profiles were still appended. The in-code comment explains it. No change requested.
2. **`ui/src/pages/grapevine/SearchPreferences.jsx`** (card loader) — the fallback read `data?.search?.resultTypes` is a dead path (`GET /api/settings` returns `{settings: …}`); harmless defensive coding. Optional cleanup on next touch.
3. **`src/api/settings/settingsApi.js`** (not in diff) — the settings PUT validates only relay URLs, so `resultTypes` accepts arbitrary values; safety currently lives in `getResultTypes()` coercion. Optional future hardening: validate the section's shape at the boundary.

### Out-of-scope failures (pre-existing / merge debt — MUST be cleared before this branch promotes to staging/main)

Recorded so the deploy gate isn't surprised; none are caused or touched by this diff:

1. `tag-detail-curated-view-and-pin-polish` — 2 failures (source-contract drift), confirmed failing at pre-merge HEAD `17a68433` in a clean worktree.
2. `restore-historical-data-and-fix-tl-author-filter` — 1 failure (`Pins.jsx pinTag(...) taPubkey` check), same pre-merge confirmation.
3. `tl-publication-from-pins` — 2 failures: Story-11 tests assert the old `?taskId=` scheduled-tasks contract that staging's generalized scheduler (story #24 / ADR 0021, task-queue-scheduler epic) replaced with per-entry `entryId`. Exposed when the local container began serving merged code. The *feature* still works (registry-tasks exposes `refreshPinnedTagTLs` — verified in the post-merge smoke test); the tests are stale, not the code. Fix = update the two tests to the new contract (or route status/history through an entry lookup).

## Verdict

**PASS** — the diff matches the story and ADR, every AC has reviewer-verified passing coverage, gates are clean for everything this story owns, and the out-of-scope failures are documented with a clear pre-promotion ask.
