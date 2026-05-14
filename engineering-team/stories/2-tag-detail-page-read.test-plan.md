# Test Plan: Story 2 — Tag-detail page (read)

**Story:** `engineering-team/stories/2-tag-detail-page-read.md`
**ADR:** `engineering-team/decisions/0002-tag-detail-page-read.md`
**Date:** 2026-05-14

## Coverage map

Each acceptance criterion maps to at least one automated test. Server contract tests run with no preconditions beyond a reachable control panel; live publish-flow tests need `nak` and exercise the new endpoints end-to-end against real signed events; UI behavior runs in Playwright against the served SPA.

| Criterion | Behavior | Test name | File | Level |
|---|---|---|---|---|
| AC-1 | Click chip name → navigate to a stable shareable URL | `clicking a tag chip on a profile page navigates to the tag-detail page` | `tests/brainstorm/tag-detail.spec.js` | Playwright |
| AC-1 | Bare-id URL still resolves (canonicalizes to `/tag/:slug/:tagId`) | `tag-detail page renders a header heading even when no profiles match` (and the 404 / sort-controls tests both load via bare-id route) | `tests/brainstorm/tag-detail.spec.js` | Playwright |
| AC-2 | Header includes name, description, author (with display name / picture / shortPubkey fallback) | `by-id returns the published tag with slug, name, description, authorPubkey, createdAt` + `by-id surfaces author display_name and picture from Meili when present` + `by-id returns author=null when the tag author has no Meili doc` | `test/tag-detail-publish.test.js` | live publish |
| AC-3 | Each row shows display name, avatar, WoT app count, WoT dispute count | `profiles-tagged groups by target with correct application and dispute counts` + `profiles-tagged enriches each row with displayName and picture when Meili has the doc` | `test/tag-detail-publish.test.js` | live publish |
| AC-4 | Three sort labels visible: Most applied / Most disputed / Most divisive | `tag-detail page exposes the three sort-mode labels` | `tests/brainstorm/tag-detail.spec.js` | Playwright |
| AC-4 | Server accepts each documented sort value | `GET /api/profile-tags/profiles-tagged accepts each documented sort value` | `test/tag-detail.test.js` | server contract |
| AC-4 | Server rejects an invalid sort param | `GET /api/profile-tags/profiles-tagged rejects an invalid sort param with 400` | `test/tag-detail.test.js` | server contract |
| AC-4 | "Most divisive" formula: 50-vs-50 outranks 1-vs-1; lopsided is not divisive | `sort=divisive ranks B (min=2) above A (min=0,total=3) above C (min=0,total=1)` (B=2/2 outranks A=3/0 and C=0/1; per the `min(applications, disputes)` formula in ADR-0002) | `test/tag-detail-publish.test.js` | live publish |
| AC-5 | Default sort is Most applied | `default sort indicator is "Most applied" when the page is freshly loaded` (UI) + `GET /api/profile-tags/profiles-tagged returns the documented response shape for a known-empty tag` (asserts `sort === 'applied'` when omitted) | `tests/brainstorm/tag-detail.spec.js` + `test/tag-detail.test.js` | Playwright + server contract |
| AC-6 | Sort change updates list in place without a full page reload | Server-side sort with refetch model: `sort=applied orders rows by applications desc` + `sort=disputed orders rows by disputes desc` (proves each sort returns the right ordering on its own request — the UI re-fetches via the hook on sort change, no navigation) | `test/tag-detail-publish.test.js` | live publish |
| AC-7 | Click profile row → land on user profile | Implicitly verified by the `/user/:pubkey` route already shipping in App.jsx; the row's link target is a deterministic string and the existing profile-page tests cover the destination. (No new automated test — see "Not covered (intentionally)" below.) | n/a | n/a |
| AC-8 | Empty state still includes name / description / author | `tag-detail page renders a header heading even when no profiles match` + `profiles-tagged returns empty rows for a tag with zero assertions` (server side) | `tests/brainstorm/tag-detail.spec.js` + `test/tag-detail-publish.test.js` | Playwright + live publish |
| AC-3 (POV invariant) | Out-of-WoT asserters are dropped from the count for the active POV | `profiles-tagged drops assertions whose authors are below the POV WoT rank threshold` | `test/tag-detail-publish.test.js` | live publish + settings mutation |

### Additional behavior captured beyond the explicit ACs

- **404 affordance** — `navigating to /tag/<unknown id> shows a tag-not-found state` (Playwright). The story doesn't enumerate this, but ADR-0002 specifies it as the implementer's contract.
- **Response-shape contract** — `GET /api/profile-tags/profiles-tagged returns the documented response shape for a known-empty tag` (server contract). Guards `povSuffix`, `minRank`, `sort`, and `rows` keys so the UI's hook can rely on them. The ADR pins this; this test prevents silent regressions.
- **POV-WoT filter actively narrows** — `profiles-tagged drops assertions whose authors are below the POV WoT rank threshold`. Provisions a deterministic house POV (delegated pubkey + minRank=50) and asserter Meili docs with deliberate above/below `wot_rank_<suffix>` values, then asserts that out-of-WoT applications are excluded. Locks in CLAUDE.md's POV-first invariant on the new endpoint, not just transitively through the search proxy. Skips cleanly (per-test SKIP) when settings.json isn't writable from the test process.

## Edge cases

Covered explicitly:

- [x] Missing `tagEventId` query param → 400 (both endpoints).
- [x] Malformed `tagEventId` (non-hex) → 400 (both endpoints).
- [x] Well-formed but unknown `tagEventId` on `by-id` → 404 with `success: false`.
- [x] Well-formed but unknown `tagEventId` on `profiles-tagged` → 200 with `rows: []` (read-side endpoint never 404s on absence — empty result is the right answer).
- [x] Invalid sort value → 400.
- [x] Omitted sort defaults to `applied`.
- [x] Tag author lacks a Meili doc → `author: null` on `by-id` response.
- [x] Tag exists but has zero assertions → empty rows on `profiles-tagged`.
- [x] Multiple authors, multiple targets, mixed polarities → per-target grouping is correct.
- [x] Three sort orders produce three distinct, deterministic rankings on the same fixture.
- [x] Empty WoT (or no POV configured) — fixture has no POV configured, so the server falls back to "all positive assertions count" per the `computeTagMatches` precedent reused by the new endpoint. (Same documented degradation pattern used by ADR-0001.)
- [x] Out-of-WoT asserters narrow the result — explicit POV-narrowing test (see "Additional behavior" above); skips per-test when settings.json isn't writable from the test process.

## Not covered (intentionally)
- **AC-7 (row click → profile page).** The destination route `/user/:pubkey` is already verified by Story 1's profile-page Playwright tests; the link target on a row is a deterministic href constructible from the row's pubkey. Adding a test here would just verify React Router still works.
- **Pagination / virtualization for large `rows`.** Out-of-scope per the story; will arrive alongside Story 4's tag-index pagination.
- **Server-side cache for `profiles-tagged`.** Out-of-scope per the ADR; tests do not assert anything about caching.
- **Touch-device chip interaction.** Story 6 owns the touch-friendly chip affordance; the current chip-link test gracefully degrades to skip when no chip link is present.

## Test infrastructure

- **Test framework:** project's existing hand-rolled Node runner (`test/test.js` orchestrates suites). Playwright for browser flows. No new frameworks introduced.
- **Control panel API:** `http://localhost:7778` (override via `BRAINSTORM_BASE_URL`).
- **Concept Graph API:** not directly exercised by Story 2 (no concept-graph or schema changes per ADR-0002 — same `tag` and `nostr-user-tag` concepts as Story 1).
- **Live publish-flow precondition:** `nak` on PATH AND `/api/strfry/publish` reachable. If either is missing, the publish suite skips — every other suite still runs.
- **Meili enrichment precondition:** `MEILI_URL_HOST` (default `http://localhost:7700`) reachable. The publish suite upserts profile docs directly so by-id and profiles-tagged have something to enrich. Same approach Story 1's publish suite already uses.
- **POV-narrowing test precondition:** `TAPESTRY_SETTINGS_PATH` (default `/var/lib/brainstorm/settings.json`) writable from the test process. The test mutates `grapevine.searchPreferences` to install a deterministic house POV, runs its assertion, and restores the original on `finally`. When this isn't writable (e.g., the test process and the server don't share a filesystem), the test emits a per-test SKIP and the rest of the suite continues. Implementer / reviewer environments where the brainstorm process and the test process share `/var/lib/brainstorm` will exercise it.
- **Playwright precondition:** `BRAINSTORM_SERVER_ACCESSIBLE=true` and the SPA served by the control panel. Routes (per ADR): `/tag/:tagId` and `/tag/:slug/:tagId`.
- **Fixtures:** none on disk — publish-flow tests generate ephemeral keypairs per test run for isolation; the suite publishes one tag-element + one empty tag + one ghost-author tag, plus 4 asserter authors and 3 target profiles, and reuses them across the suite. Every author/target pubkey is unique-per-run so test data cannot collide across runs.

## How to run

```sh
# Story 1 + Story 2 server suites (and Story 1 + Story 2 publish flows when nak is on PATH)
npm test

# Story 2 UI affordances only — chromium, single project, line reporter
BRAINSTORM_SERVER_ACCESSIBLE=true \
  npx playwright test tests/brainstorm/tag-detail.spec.js \
  --project=chromium --reporter=line

# On NixOS dev boxes:
nix-shell --run 'BRAINSTORM_SERVER_ACCESSIBLE=true npx playwright test tests/brainstorm/tag-detail.spec.js --project=chromium --reporter=line'
```

> The Playwright environment caveat from Story 1 still applies (`@playwright/test` not in local `node_modules` on dev boxes; the existing repo Playwright specs share this constraint). Not a Story 2 regression.

## Verification

Confirmed failing for the right reasons on 2026-05-14, against the test-plan commit (no Story 2 implementation yet). Story 1's 20 tests still pass (no regression from wiring the new suites into `test/test.js`). The POV-narrowing test SKIPs on this dev box because the test process can't write to `/var/lib/brainstorm/settings.json`; on environments that share the FS with the server, it will fail until implemented and pass once the WoT filter is wired through.

```
--- tag-detail tests (Story 2) ---
  FAIL  GET /api/profile-tags/by-id rejects missing tagEventId with 400          (404)
  FAIL  GET /api/profile-tags/by-id rejects malformed tagEventId with 400        (404)
  FAIL  GET /api/profile-tags/by-id returns 404 for a well-formed but unknown tagEventId
  FAIL  GET /api/profile-tags/profiles-tagged rejects missing tagEventId with 400 (404)
  FAIL  GET /api/profile-tags/profiles-tagged rejects malformed tagEventId with 400 (404)
  FAIL  GET /api/profile-tags/profiles-tagged rejects an invalid sort param with 400 (404)
  FAIL  GET /api/profile-tags/profiles-tagged returns the documented response shape for a known-empty tag (404)
  FAIL  GET /api/profile-tags/profiles-tagged accepts each documented sort value (404)

tag-detail: 0 passed, 8 failed

--- tag-detail publish-flow tests (Story 2) ---
  FAIL  by-id returns the published tag with slug, name, description, authorPubkey, createdAt   (404)
  FAIL  by-id surfaces author display_name and picture from Meili when present                  (404)
  FAIL  by-id returns author=null when the tag author has no Meili doc                          (404)
  FAIL  profiles-tagged groups by target with correct application and dispute counts            (404)
  FAIL  profiles-tagged enriches each row with displayName and picture when Meili has the doc   (404)
  FAIL  profiles-tagged returns empty rows for a tag with zero assertions                       (404)
  FAIL  sort=applied orders rows by applications desc (A=3 → B=2 → C=0)                         (404)
  FAIL  sort=disputed orders rows by disputes desc (B=2 → C=1 → A=0)                            (404)
  FAIL  sort=divisive ranks B (min=2) above A (min=0,total=3) above C (min=0,total=1)           (404)
  SKIP  profiles-tagged drops assertions whose authors are below the POV WoT rank threshold     (settings.json not writable)

tag-detail-publish: 0 passed, 9 failed, 1 skipped

Test Results
-------------
Configuration Loading:        PASS
profile-tags suite:           PASS (13 passed, 0 failed)
profile-tags-publish suite:   PASS (7 passed, 0 failed)
tag-detail suite:             FAIL (0 passed, 8 failed)
tag-detail-publish suite:     FAIL (0 passed, 9 failed)
Overall:                      FAIL
```

**On the publish-flow setup phase:** the suite successfully generates 8 keypairs via `nak`, signs and publishes 3 kind-39999 `tag` elements + 8 kind-39999 `nostr-user-tag` assertions through `/api/strfry/publish`, and upserts 4 profile docs into Meili. All test failures are downstream — at the not-yet-implemented `/api/profile-tags/by-id` and `/api/profile-tags/profiles-tagged` endpoints. That confirms the fixture infrastructure is sound and the implementer's work is the only thing standing between failing and passing.

The Playwright spec parses cleanly but is not executed here (Playwright not installed in this dev environment); the implementer / reviewer environments install it via `npm run test:playwright`.
