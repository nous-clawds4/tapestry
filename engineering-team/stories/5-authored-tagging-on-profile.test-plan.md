# Test Plan: Story 5 — Authored-tagging section on profile pages

**Story:** `engineering-team/stories/5-authored-tagging-on-profile.md`
**ADR:** `engineering-team/decisions/0005-authored-tagging-on-profile.md`
**Date:** 2026-05-14

## Coverage map

Each acceptance criterion maps to at least one automated test. Server-contract tests run with no preconditions beyond a reachable control panel; live publish-flow tests need `nak`, a reachable control panel, AND a writable `settings.json` (the suite installs a synthetic POV so the target-WoT filter is active for the fixture). UI affordances run in Playwright against the served SPA.

| Criterion | Behavior | Test name | File | Level |
|---|---|---|---|---|
| AC-1 | Section renders when ≥1 authored assertion's target is in viewer's POV WoT | `rows array contains exactly the 4 fixture rows whose target is in the WoT (Row4 dropped)` (server) + Story-1 regression test (UI surface still mounts under the existing profile layout) | `test/authored-tagging-publish.test.js` + `tests/brainstorm/authored-tagging.spec.js` | live publish + Playwright |
| AC-2 (per-row content) | Row shows polarity, tag name (clickable→tag-detail), target profile (avatar+name→user page), relative timestamp | `row shape includes polarity, createdAt, target metadata, tag metadata, parent counts, peer counts` (server side guarantees the data; tag-name & target links are deterministic strings built from `slug`+`tagEventId` and `targetPubkey` respectively — same route precedent as Stories 2/4). Relative timestamp formatting is covered by the shared `timeAgo` util (no behaviour change post-extraction). | `test/authored-tagging-publish.test.js` | live publish |
| AC-3 (sort backend contract) | Sort modes match Story 4's facility — same `?sort=` server contract; server-side sort | `accepts each documented sort value` (server contract) + the five sort-correctness tests (`sort=recent`, `sort=applied`, `sort=disputed`, `sort=most-backed`, `sort=divisive`) | `test/authored-tagging.test.js` + `test/authored-tagging-publish.test.js` | server contract + live publish |
| AC-3 (sort component reuse) | UI sort buttons use the same `<SortToggle>` component as `/tags` and `/tag/:id` | The existing tag-index + tag-detail Playwright specs continue to pass — they assert sort labels are visible. If the `<SortToggle>` extraction broke the underlying button rendering, those tests would fail. Acts as a regression guard for the refactor. | `tests/brainstorm/tag-index.spec.js`, `tests/brainstorm/tag-detail.spec.js` | Playwright (regression) |
| AC-4 (polarity visible) | Polarity visually distinguishable per row | `polarity is "disputed" for Row3 (the only owner dispute in the fixture)` — pins the polarity field on the server; the UI badge maps 1:1 (`applied` → green pill, `disputed` → red pill per ADR-0005's `bsp-authored-badge` CSS classes). | `test/authored-tagging-publish.test.js` | live publish |
| AC-5 (target-WoT filter) | Only rows whose target is in viewer's POV WoT; partial-state POV-hint footer | `rows array contains exactly the 4 fixture rows whose target is in the WoT (Row4 dropped)` + `response carries the resolved POV (povSuffix + minRank) from settings.json` (POV-hint is rendered always-on by the UI per ADR — covered by the server returning a non-null `povSuffix`) | `test/authored-tagging-publish.test.js` | live publish |
| AC-6 (hidden when empty) | Section is hidden entirely when zero rows render | `an author with no authored assertions returns rows: []` (server) + `AC-6: TAGGING ACTIVITY section is hidden on a profile with no authored assertions` (UI) | `test/authored-tagging-publish.test.js` + `tests/brainstorm/authored-tagging.spec.js` | live publish + Playwright |
| AC-7 (own profile) | Section still renders when viewer=profile owner; pinned sub-block is the only thing skipped | Same publish-flow rows are returned regardless of viewer; the pinned-block decision is purely client-side (`viewerPubkey !== profilePubkey`). The server contract is identical, so the same publish-flow tests cover this AC. No new dedicated test — the partition is a JSX-level concern that the Reviewer can verify by reading `AuthoredTaggingSection.jsx`. | n/a (covered transitively) | n/a |
| AC-8 (Tagged YOU sub-block) | Pinned sub-block for NIP-07 viewer when targeted | Client-side partition over the same server response. The data needed for the partition is `targetPubkey` per row — covered by `row shape includes … target metadata`. The visual partition itself is a JSX concern: when `viewerPubkey` appears as a row's `targetPubkey`, the row renders inside the `bsp-authored-aboutme` block. Not Playwright-testable without authenticated session fixtures — out of scope for v1 test coverage. | n/a (server side covered) | n/a |

### Additional behavior captured beyond the explicit ACs

- **Reading A and Reading B coexist independently.** `parent-tag aggregate counts reflect Reading A` pins the global-WoT applications/disputes per parent tag; `peerApplications counts in-WoT authors OTHER THAN the profile owner who asserted the same (tag, target) pair` and the analogous disputes test pin Reading B. `peer counts EXCLUDE the profile owner from their own assertion` is the dedicated guard against the off-by-one a naïve implementation would make.
- **`most-backed` is the only sort whose order differs from Reading A.** The fixture is designed so `sort=most-backed` produces `Row1 > Row3 > Row5 > Row2`, distinct from the `applied`/`disputed`/`divisive` orderings (which all produce `Row3 > Row2 > Row1 > Row5`). If a buggy implementation routed `most-backed` through Reading A by accident, this test catches it.
- **Below-WoT-rank authors leak nowhere.** `parent-tag aggregate counts EXCLUDE below-WoT-rank authors` proves the author-WoT filter on the parent-tag scan is active. The same below-WoT author also asserted TagPopular on TargetF; if peer counting didn't filter authors, that would surface as noise.
- **Target-Meili enrichment round-trip** — the row-shape test verifies `targetDisplayName` and `targetPicture` round-trip through the new endpoint's Meili lookup.

## Edge cases

Covered explicitly:

- [x] Missing `authorPubkey` → 400.
- [x] Malformed `authorPubkey` → 400.
- [x] Invalid `sort` → 400.
- [x] Omitted `sort` defaults to `recent`.
- [x] All five documented sort values accepted; response echoes the resolved sort.
- [x] Author with zero published assertions returns `rows: []`.
- [x] Row whose target is below the WoT threshold is dropped.
- [x] Parent-tag count excludes below-WoT-rank authors.
- [x] Peer count excludes the profile owner.
- [x] Peer count is 0 when no other in-WoT author has hit the same (tag, target) pair.
- [x] UI: section is hidden when there are no rows.
- [x] UI regression: existing Story-1 TAGS section still renders on the same profile page.

## Not covered (intentionally)

- **AC-7 (own profile) and AC-8 (Tagged YOU pinned sub-block)** — pure JSX partition over a server response. No server contract difference. Playwright coverage would require authenticated session fixtures that don't exist in this repo's test infrastructure (the existing tag-detail-write spec is in the same situation for AC-7's logged-in apply/dispute flow). Reviewer verifies by reading `AuthoredTaggingSection.jsx`.
- **Peer-annotation formatting strings** — the ADR pins the exact wording (`+N agree` / `−M disagree`) but the strings are a UI concern. Reviewer verifies in `AuthoredTagRow` rendering. Catching a wording typo at test level would require either a string-matcher Playwright pass (data-dependent, brittle) or a unit test of an extracted formatter (over-engineering for v1).
- **POV-hint footer text** — same reasoning; UI string. Server returning a non-null `povSuffix` is the testable contract.
- **Sort change without full page reload (AC-3)** — UI-hook behavior. The pattern is the same one `useTagDetail` / `useTagIndex` already use. The existing tag-detail and tag-index UI tests transitively cover the no-reload pattern.
- **Pagination / `limit` / `offset`** — Story 5 explicitly out-of-scopes pagination (joins ADR-0002's named follow-up alongside `profiles-tagged`). When the retrofit lands, this endpoint's algorithm (`filter → enrich → sort → [later: slice]`) accepts the same `limit`/`offset`/`total` contract — testable then.
- **Kind-5 deletion handling** — same precedent as every other read endpoint in this stack: rely on strfry's deletion semantics. ADR explicitly defers fixing this globally as a separate concern.
- **Cross-POV comparison views** — out of scope per story.

## Test infrastructure

- **Test framework:** project's existing hand-rolled Node runner (`test/test.js` orchestrates suites). Playwright for browser flows. No new frameworks introduced.
- **Control panel API:** `http://localhost:7778` (override via `BRAINSTORM_BASE_URL`).
- **Concept Graph API:** not directly exercised — no concept changes per ADR-0005.
- **Live publish-flow preconditions:** `nak` on PATH AND `/api/strfry/publish` reachable AND `TAPESTRY_SETTINGS_PATH` (default `/var/lib/brainstorm/settings.json`) writable. If any are missing, the publish suite skips per-suite.
  - The settings.json write is required because every meaningful sort/filter test depends on a configured POV being in effect (the target-WoT filter is the heart of the story). Unlike Story 4's publish suite — which can validate sort/filter without POV and tucks the POV check into one optional test — Story 5's test expectations *all* depend on `Row4` being filtered out (i.e., POV active).
  - The suite installs a synthetic POV in setup, captures the prior `settings.json`, and restores it in `teardownSuite()` (run in a `try/finally` after every test). Per-suite SKIP when not writable.
- **Meili enrichment precondition:** `MEILI_URL_HOST` (default `http://localhost:7700`) reachable. The publish suite upserts target + author Meili docs directly so target enrichment + WoT-rank lookups have something to read.
- **Playwright precondition:** `BRAINSTORM_SERVER_ACCESSIBLE=true` and the SPA served by the control panel. Profile route per `ui/src/App.jsx`: `/user/:pubkey`.
- **Fixtures:** none on disk — publish-flow tests generate ephemeral keypairs per test run. The suite publishes 2 tag-elements + 5 owner assertions + 6 peer assertions + 1 below-WoT assertion + 12 Meili profile upserts. Every key is unique-per-run; tests are isolated from any pre-existing data in the DB because every assertion involves a fresh keypair.
- **Explicit `created_at` timestamps:** the publish-flow suite sets `--created-at <unix>` on every owner assertion (and the peer assertions) so the `recent` and tie-break orderings are deterministic. Tests don't depend on machine clock drift or DB insertion order.

## How to run

```sh
# All suites (Stories 1–5; publish flows run when nak is on PATH and
# settings.json is writable)
npm test

# Story 5 UI affordances only — chromium, single project, line reporter
BRAINSTORM_SERVER_ACCESSIBLE=true \
  npx playwright test tests/brainstorm/authored-tagging.spec.js \
  --project=chromium --reporter=line
```

> The Playwright environment caveat from earlier stories still applies (`@playwright/test` isn't in this dev box's local `node_modules`; existing repo Playwright specs share this constraint).

## Verification

Confirmed failing for the right reasons on 2026-05-14, against the test-plan commit (no Story 5 implementation yet). Stories 1, 2, 3, 4 existing tests still pass — no regression from wiring the new suites into `test/test.js`:

```
--- authored-tagging tests (Story 5) ---
  FAIL  GET /api/profile-tags/authored-by rejects missing authorPubkey with 400
        missing-authorPubkey status — got 404, expected 400
  FAIL  GET /api/profile-tags/authored-by rejects a malformed authorPubkey with 400
        malformed-authorPubkey status — got 404, expected 400
  FAIL  GET /api/profile-tags/authored-by rejects an invalid sort param with 400
        invalid-sort status — got 404, expected 400
  FAIL  GET /api/profile-tags/authored-by returns the documented response envelope
        status — got 404, expected 200
  FAIL  omitted sort defaults to "recent"
        status — got 404, expected 200
  FAIL  accepts each documented sort value
        sort=recent status — got 404, expected 200

authored-tagging: 0 passed, 6 failed

--- authored-tagging publish-flow tests (Story 5) ---
  SKIP  /var/lib/brainstorm/settings.json not writable from this process; suite needs POV install

Test Results
-------------
Configuration Loading:        PASS
profile-tags suite:           PASS (13 passed, 0 failed)
profile-tags-publish suite:   PASS (7 passed, 0 failed)
tag-detail suite:             PASS (8 passed, 0 failed)
tag-detail-publish suite:     PASS (9 passed, 0 failed)
tag-detail-write suite:       PASS (4 passed, 0 failed)
tag-detail-write-publish suite: PASS (4 passed, 0 failed)
tag-index suite:              PASS (7 passed, 0 failed)
tag-index-publish suite:      PASS (9 passed, 0 failed)
authored-tagging suite:       FAIL (0 passed, 6 failed)
authored-tagging-publish suite: SKIP (16 tests; preconditions not met)
Overall:                      FAIL
```

**On the publish-flow setup phase:** the suite SKIPs entirely in this dev environment because `/var/lib/brainstorm/settings.json` isn't writable from the test process. The suite's fixture design has been verified by inspection (mirrors Story 4's publish suite design, which runs cleanly in this same environment because Story 4 doesn't gate on POV install). In the Implementer's environment — and in CI — settings.json is writable and the 16 publish-flow tests will execute end-to-end.

The Playwright spec parses cleanly but is not executed here (Playwright not installed in this dev environment); Implementer / Reviewer environments install it via `npm run test:playwright`.
