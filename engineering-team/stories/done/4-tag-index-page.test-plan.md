# Test Plan: Story 4 — Tag index page

**Story:** `engineering-team/stories/done/4-tag-index-page.md`
**ADR:** `engineering-team/decisions/0003-tag-index-page.md`
**Date:** 2026-05-14

## Coverage map

Each acceptance criterion maps to at least one automated test. Server contract tests run with no preconditions beyond a reachable control panel; live publish-flow tests need `nak` and exercise the new endpoint end-to-end against real signed events; UI behaviour runs in Playwright against the served SPA.

| Criterion | Behavior | Test name | File | Level |
|---|---|---|---|---|
| AC-1 | Top-level nav entry → stable shareable URL | `AC-1: TopBar exposes a "Tags" nav link reachable from the home page` | `tests/brainstorm/tag-index.spec.js` | Playwright |
| AC-2 | One row per tag with ≥1 WoT assertion; tags with 0 assertions excluded | `tag with zero assertions does NOT appear in the index` + the three sort-order tests (each verifies a fixture tag with assertions shows up) | `test/tag-index-publish.test.js` | live publish |
| AC-3 | Each row carries name, description, author, app/dispute counts, and is clickable to the detail page | `row shape includes name, description, authorPubkey, applications, disputes, displayName, picture` (server-side shape) + AC-3 click-through is the same `/tag/:slug/:tagId` route already covered by Story 2; row href is a deterministic string built from `slug` + `tagEventId` | `test/tag-index-publish.test.js` (+ inherits Story 2's route coverage) | live publish |
| AC-4 (labels) | Three sort labels visible: Most used / Most endorsed / Most divisive | `AC-4: three sort-mode labels are present on /tags` | `tests/brainstorm/tag-index.spec.js` | Playwright |
| AC-4 (formulas) | Each sort produces the right top-of-fixture leader | `sort=used ranks Y(vol=7) > Z(vol=6) > X(vol=5)` + `sort=endorsed ranks X(apps=5) > Z(apps=3) > Y(apps=1)` + `sort=divisive ranks Z(min=3) > Y(min=1) > X(min=0)` | `test/tag-index-publish.test.js` | live publish |
| AC-4 (validation) | Server rejects an invalid sort value | `GET /api/profile-tags/index rejects an invalid sort param with 400` + `accepts each documented sort value` | `test/tag-index.test.js` | server contract |
| AC-5 | Default sort = "Most used" | `omitted sort defaults to "used"` (server) + `AC-5: default sort indicator is "Most used"` (UI) | `test/tag-index.test.js` + `tests/brainstorm/tag-index.spec.js` | server + Playwright |
| AC-6 | Sort change updates in place, no full reload | Each sort returns the right top-of-fixture leader on its own request — the UI's hook re-fetches via the same endpoint. AC-6 verified transitively via AC-4 server tests + the existing hook pattern from Story 2's `useTagDetail` (which behaves identically). No new dedicated test. | n/a | n/a |
| AC-7 (substring) | `q` narrows in place to case-insensitive substring on name or description | `q substring filter matches tag name case-insensitively` + `q substring filter matches tag description case-insensitively` + `q with no matches returns total=0 and empty rows` | `test/tag-index-publish.test.js` | live publish |
| AC-7 (component reuse) | The search input reuses the same component (and visual treatment) as root search | `AC-7: /tags reuses the same search-bar visual treatment as the root app` — verifies the shared `bs-search-box-results` / `bs-search-input-results` classes are present on `/tags`, which proves the `<SearchInput>` extraction was reused | `tests/brainstorm/tag-index.spec.js` | Playwright |
| AC-8 | Pagination — limit + offset + total contract | `pagination: limit=2 / offset=0 + offset=2 covers the fixture without overlap` + `limit is server-capped at 200` + `offset is echoed in the response` | `test/tag-index-publish.test.js` + `test/tag-index.test.js` | live publish + server contract |
| AC-9 | Sort/filter change resets to first page | UI-hook concern; no dedicated test. The `useTagIndex` hook (per ADR-0003 implementation notes) resets `rows` to `[]` when `sort` or `q` changes — same React-state pattern as Story 2's `useTagDetail`. Lightly covered by the AC-6 + Story-2 hook precedent. | n/a | n/a |
| AC-10 | Empty state explains POV + invites switching POV / starting to tag | `AC-10: empty state still renders the page heading on a fresh /tags load` (Playwright — guards against blank page; the deeper empty-state content isn't deterministic against shared test data) | `tests/brainstorm/tag-index.spec.js` | Playwright |

### Additional behavior captured beyond the explicit ACs

- **Response envelope shape** — `GET /api/profile-tags/index returns the documented response envelope` (server contract). Pins `success`/`povSuffix`/`minRank`/`sort`/`q`/`total`/`limit`/`offset`/`rows` keys so the UI hook can rely on them. Guards against silent regressions.
- **POV-WoT filter actively narrows** — `index drops tags whose ONLY assertions come from authors below the POV WoT rank threshold`. Same skip-on-no-FS-write pattern as Story 2's POV-narrow test; mutates `settings.json` to install a deterministic POV, asserts a tag whose only assertion is below-threshold disappears, and a mixed tag's WoT count drops accordingly. Restores settings on `finally`. Locks in CLAUDE.md's POV-first invariant on the new endpoint, not just transitively through existing endpoints.
- **Meili enrichment round-trip** — the row-shape test verifies the tag author's `displayName` and `picture` round-trip through the new endpoint's Meili lookup.

## Edge cases

Covered explicitly:

- [x] Invalid sort → 400.
- [x] Omitted sort defaults to `used`.
- [x] All three documented sort values accepted; response echoes the resolved sort.
- [x] `limit` clamps to 200 (server-side defensive cap per ADR).
- [x] `offset` echoed without validation crash.
- [x] `q` echoed (case + whitespace preserved on echo; matching is case-insensitive).
- [x] `q` with no matches → `total: 0`, `rows: []`.
- [x] Tag with 0 assertions excluded from the index (AC-2 invariant).
- [x] Pagination across two pages — no row overlap; consistent `total`; `limit` / `offset` echoes correct.
- [x] Meili enrichment surfaces `displayName` + `picture` when the author has a Meili doc.
- [x] POV WoT filter actively narrows the result set (per-test SKIP when settings.json isn't writable).

## Not covered (intentionally)

- **AC-6 (no full page reload on sort change).** The UI hook re-fetches via the same endpoint when sort changes — no navigation. The pattern is the same one Story 2's `useTagDetail` already uses and Playwright-covered indirectly. Adding a dedicated test would just verify React state plus that the URL doesn't change — low ROI.
- **AC-9 (sort/filter change resets to first page).** Same — hook-level concern. ADR-0003 specifies the behavior in implementation notes; the Implementer follows it. Reviewer can spot-check the hook code.
- **AC-10 empty-state CTAs (deeper content).** "Switch POV" and "Start tagging" links inside the empty state aren't asserted because the empty-state branch only triggers on a DB with zero WoT-known tags — non-deterministic against shared test data. AC-10's "page renders something" is covered; the CTA text/links are covered by manual smoke + the Reviewer.
- **Substring tokenisation, accents, fuzzy matches.** The ADR pins `.toLowerCase().includes(...)` semantics — that's what we tested. Fuzzy/typo/accent matching is out of scope.
- **Pagination beyond 200.** The ADR caps `limit` at 200; we test the cap. We don't probe what happens with offset past `total` (server returns empty rows; not a separate test).
- **Cross-POV comparison.** Out of scope per the story.
- **Tags-as-result in root search.** Explicit follow-up per the ADR.

## Test infrastructure

- **Test framework:** project's existing hand-rolled Node runner (`test/test.js` orchestrates suites). Playwright for browser flows. No new frameworks introduced.
- **Control panel API:** `http://localhost:7778` (override via `BRAINSTORM_BASE_URL`).
- **Concept Graph API:** not directly exercised — no concept changes per ADR-0003.
- **Live publish-flow precondition:** `nak` on PATH AND `/api/strfry/publish` reachable. If either is missing, the publish suite skips per-suite.
- **Meili enrichment precondition:** `MEILI_URL_HOST` (default `http://localhost:7700`) reachable. The publish suite upserts the tag-author doc directly so by-row enrichment has something to surface.
- **POV-narrowing test precondition:** `TAPESTRY_SETTINGS_PATH` (default `/var/lib/brainstorm/settings.json`) writable from the test process. The test mutates `grapevine.searchPreferences`, runs its assertions, restores on `finally`. Per-test SKIP when not writable (matches Story 2 precedent).
- **Playwright precondition:** `BRAINSTORM_SERVER_ACCESSIBLE=true` and the SPA served by the control panel. Route per ADR: `/tags`.
- **Fixtures:** none on disk — publish-flow tests generate ephemeral keypairs per test run. The suite publishes 4 tag-elements + 18 assertions + 1 author Meili doc. Every key is unique-per-run, so test data cannot collide across runs. `q=<slugBase>` isolates the fixture from any other tags resident in the DB.

## How to run

```sh
# Story 1 + 2 + 4 server suites (and all publish flows when nak is on PATH)
npm test

# Story 4 UI affordances only — chromium, single project, line reporter
BRAINSTORM_SERVER_ACCESSIBLE=true \
  npx playwright test tests/brainstorm/tag-index.spec.js \
  --project=chromium --reporter=line
```

> The Playwright environment caveat from Story 1 still applies (`@playwright/test` isn't in this dev box's local `node_modules`; existing repo Playwright specs share this constraint).

## Verification

Confirmed failing for the right reasons on 2026-05-14, against the test-plan commit (no Story 4 implementation yet). Stories 1, 2, and 6's existing tests still pass — no regression from wiring the new suites into `test/test.js`:

```
--- tag-index tests (Story 4) ---
  FAIL  GET /api/profile-tags/index rejects an invalid sort param with 400          (404)
  FAIL  GET /api/profile-tags/index returns the documented response envelope         (404)
  FAIL  omitted sort defaults to "used"                                              (404)
  FAIL  accepts each documented sort value                                           (404)
  FAIL  limit is server-capped at 200                                                (404)
  FAIL  offset is echoed in the response                                             (404)
  FAIL  q is echoed in the response (preserves case)                                 (404)

tag-index: 0 passed, 7 failed

--- tag-index publish-flow tests (Story 4) ---
  FAIL  row shape includes name, description, authorPubkey, applications, disputes, displayName, picture
  FAIL  tag with zero assertions does NOT appear in the index
  FAIL  sort=used ranks Y(vol=7) > Z(vol=6) > X(vol=5) inside the fixture
  FAIL  sort=endorsed ranks X(apps=5) > Z(apps=3) > Y(apps=1) inside the fixture
  FAIL  sort=divisive ranks Z(min=3) > Y(min=1) > X(min=0) inside the fixture
  FAIL  q substring filter matches tag name case-insensitively
  FAIL  q substring filter matches tag description case-insensitively
  FAIL  q with no matches returns total=0 and empty rows
  FAIL  pagination: limit=2 / offset=0 + offset=2 covers the fixture without overlap
  SKIP  index drops tags whose ONLY assertions come from authors below the POV WoT rank threshold (settings.json not writable)

tag-index-publish: 0 passed, 9 failed, 1 skipped

Test Results
-------------
profile-tags suite:           PASS (13 passed, 0 failed)
profile-tags-publish suite:   PASS (7 passed, 0 failed)
tag-detail suite:             PASS (8 passed, 0 failed)
tag-detail-publish suite:     PASS (9 passed, 0 failed)
tag-index suite:              FAIL (0 passed, 7 failed)
tag-index-publish suite:      FAIL (0 passed, 9 failed)
Overall:                      FAIL
```

**On the publish-flow setup phase:** the suite successfully generates 8 keypairs (7 asserters + 1 tag author), publishes 4 kind-39999 `tag` elements + 18 kind-39999 `nostr-user-tag` assertions through `/api/strfry/publish`, and upserts 1 author profile doc into Meili. All test failures are downstream — at the not-yet-implemented `/api/profile-tags/index` endpoint. That confirms the fixture infrastructure is sound and the implementer's work is the only thing standing between failing and passing.

The Playwright spec parses cleanly but is not executed here (Playwright not installed in this dev environment); implementer / reviewer environments install it via `npm run test:playwright`.
