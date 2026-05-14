# Test Plan: Story 3 — Tag-detail page (write — apply, dispute, search-and-apply)

**Story:** `engineering-team/stories/done/3-tag-detail-page-write.md`
**ADR:** `engineering-team/decisions/0004-tag-detail-page-write.md`
**Date:** 2026-05-14

## Coverage map

Each acceptance criterion maps to at least one automated test. The new behavior splits cleanly into three test levels:

- **Server contract** (`test/tag-detail-write.test.js`) — pure HTTP shape tests for the new optional `viewerPubkey` query param on `/api/profile-tags/profiles-tagged`. No live publishes; no preconditions beyond a reachable control panel.
- **Server publish-flow** (`test/tag-detail-write-publish.test.js`) — live `nak`-signed kind-39999 publishes. **Split into two phases** so the most coverage runs on the most environments:
  - **Phase 1 (no POV needed)** — `viewerAssertions` population, both polarity branches, the empty-map edge case, and per-row `onlyViewerVisible` presence. Runs anywhere `nak` is on PATH and the control panel is reachable. No filesystem mutation.
  - **Phase 2 (POV-required)** — the viewer-union itself: viewer-only target unioned in (`applications=0, disputes=0, onlyViewerVisible=true`), no-leak guarantee for the un-viewed read, false-positive guard for in-WoT rows. The viewer-union is only *observable* when a POV with a minRank threshold is installed (without one, `resolvePov` falls back to "all positive applications count" per ADR-0002, so the viewer's own apply is in the row already and the union behavior is invisible). Skips when `/var/lib/brainstorm/settings.json` isn't writable from the test process (e.g., brainstorm runs in a container and the test process is on the host).
- **UI / Playwright** (`tests/brainstorm/tag-detail-write.spec.js`) — auth + tag-detail API responses are intercepted with `page.route`; fake `window.nostr` injected via `page.addInitScript`. Tests verify the visible contract (buttons, states, badge, search input, error surface). The publish path is exercised via the mocked signEvent recorder; no real Nostr signing.

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 | `logged-in: clicking Apply on a row publishes a kind-39999 nostr-user-tag assertion with polarity=+1` | `tests/brainstorm/tag-detail-write.spec.js` | Playwright |
| AC-2 | `logged-in: clicking Dispute on a row publishes a kind-39999 nostr-user-tag assertion with polarity=-1` | `tests/brainstorm/tag-detail-write.spec.js` | Playwright |
| AC-2 (server polarity round-trip) | `viewerAssertions is populated when viewerPubkey is provided` (covers both `applied` and `disputed`) | `test/tag-detail-write-publish.test.js` | publish (Phase 1) |
| AC-3 (applied state UI) | `logged-in: row shows applied state and only the opposite-polarity button is actionable` | `tests/brainstorm/tag-detail-write.spec.js` | Playwright |
| AC-3 (disputed state UI) | `logged-in: row shows disputed state and only the opposite-polarity button is actionable` | `tests/brainstorm/tag-detail-write.spec.js` | Playwright |
| AC-3 (server contract for state input) | `viewer-union: WoT-visible target keeps applications=1 and onlyViewerVisible=false even when the viewer also applied` (viewerAssertions still echoes the viewer's polarity) | `test/tag-detail-write-publish.test.js` | publish (Phase 2) |
| AC-4 | `logged-in: rows show Apply + Dispute buttons and the page-search input is visible` | `tests/brainstorm/tag-detail-write.spec.js` | Playwright |
| AC-5 | `logged-in: typing in the page-search input renders result rows with Apply/Dispute buttons` | `tests/brainstorm/tag-detail-write.spec.js` | Playwright |
| AC-6 | `logged-in: applying via page-search refetches the main list and the profile appears there` | `tests/brainstorm/tag-detail-write.spec.js` | Playwright |
| AC-6 (server contract — viewer-only surfaced) | `viewer-union: viewer-only applied target surfaces with applications=0, disputes=0, onlyViewerVisible=true` | `test/tag-detail-write-publish.test.js` | publish (Phase 2) |
| AC-7 (badge present when viewer-only) | `logged-in: viewer-only-visible row carries a "your assertion — not yet visible to this POV" badge` | `tests/brainstorm/tag-detail-write.spec.js` | Playwright |
| AC-7 (badge suppressed otherwise) | `logged-in: rows whose counts are non-zero do NOT show the viewer-only badge` | `tests/brainstorm/tag-detail-write.spec.js` | Playwright |
| AC-7 (server flag drives UI — applied polarity) | `viewer-union: viewer-only applied target surfaces with applications=0, disputes=0, onlyViewerVisible=true` | `test/tag-detail-write-publish.test.js` | publish (Phase 2) |
| AC-7 (server flag drives UI — disputed polarity) | `viewer-union: viewer-only disputed target surfaces with onlyViewerVisible=true and viewerAssertions="disputed"` | `test/tag-detail-write-publish.test.js` | publish (Phase 2) |
| AC-8 | `logged-out: tag page renders no Apply/Dispute buttons and no profile-search input` | `tests/brainstorm/tag-detail-write.spec.js` | Playwright |
| AC-8 (server no-leak) | `viewer-union: without viewerPubkey, viewer-only targets are NOT in rows (no-leak guarantee)` | `test/tag-detail-write-publish.test.js` | publish (Phase 2) |
| AC-9 | `logged-in: total publish failure surfaces an inline error` | `tests/brainstorm/tag-detail-write.spec.js` | Playwright |

### Additional behavior captured beyond the explicit ACs

- **Response shape preservation** — `GET /api/profile-tags/profiles-tagged response shape is preserved (no viewerPubkey)` locks in that the additive `viewerAssertions` + per-row `onlyViewerVisible` fields don't break Story 2's contract.
- **Malformed viewerPubkey degrades gracefully** — `GET /api/profile-tags/profiles-tagged silently ignores a malformed viewerPubkey` (per ADR-0004: "treat as absent (don't 400 — keeps the read-only contract working when a client sends a junk value)").
- **viewerAssertions shape** — `GET /api/profile-tags/profiles-tagged returns viewerAssertions as a plain object when viewerPubkey is provided`. Locks in the map-of-pubkey shape so the UI's hook can index by pubkey.
- **Empty viewerAssertions for a viewer with no assertions** — `viewerAssertions is an empty map for a viewer with no assertions on this tag`. Prevents a regression where the server populates the map with extraneous entries.
- **onlyViewerVisible present on every row even without a viewer** — `rows have an onlyViewerVisible field even when no viewerPubkey is passed`. The UI's `<TagPageRow>` reads it unconditionally; this guards the always-present default.
- **No false-positive badge** — `viewer-union: WoT-visible target with a different (no-assertion) viewer keeps onlyViewerVisible=false`. Guards against an off-by-one in the union logic.

## Edge cases

Covered explicitly:

- [x] Missing `viewerPubkey` → existing Story-2 response shape preserved, `onlyViewerVisible: false` on each row.
- [x] Malformed `viewerPubkey` (non-hex) → silently ignored, status 200, `viewerAssertions` absent / empty.
- [x] Well-formed `viewerPubkey` but no assertions on the tag → `viewerAssertions` is an empty map (no extraneous entries).
- [x] Viewer applied a target → `viewerAssertions[pubkey]='applied'`.
- [x] Viewer disputed a target → `viewerAssertions[pubkey]='disputed'`.
- [x] Viewer-only target (POV would exclude) → row unioned in with `applications=0, disputes=0, onlyViewerVisible=true`. **Phase 2.**
- [x] Viewer applied to a target an in-WoT author also applied → row has the in-WoT count, `onlyViewerVisible=false`, `viewerAssertions` still echoes the viewer's polarity. **Phase 2.**
- [x] Logged-out caller (no `viewerPubkey`) → viewer-only targets must NOT appear in rows (no-leak). **Phase 2.**
- [x] WoT-visible row with a different (no-assertion) viewer → `onlyViewerVisible=false`, not a false positive. **Phase 2.**
- [x] Apply already published → button shows applied state, opposite still actionable.
- [x] Dispute already published → button shows disputed state, opposite still actionable.
- [x] Apply + Dispute publish kind-39999 events with the correct wire-shape tags (`p`, `e`, `z`, `polarity`).
- [x] Total publish failure → inline error surface on the row.
- [x] Page-search render → debounced fetch, hits render with Apply/Dispute buttons.
- [x] Page-search apply → main list refetches; the newly tagged profile appears, carrying the viewer-only badge when applicable.

Reasonable but **not** covered (intentionally):

- **Partial publish failure (local OK, external fail)** — ADR-0001 + Story 1's `publishOrThrow` accept this as silent success (the strfry router will redistribute). Locked in by Story 1's publish suite; not retested here.
- **Multiple rapid clicks on the same Apply button** — UI debounce / publishing-state lockout is an implementation detail the ADR doesn't pin down. The Playwright "Apply publishes a kind-39999" test verifies a single click produces a single event; race conditions aren't exercised.
- **Search input below threshold** — ADR-0004 specifies length-threshold 2; the result-rendering test starts at length 6 (beyond threshold). A dedicated below-threshold test would just verify the implementer's debouncer.
- **Pagination on `profiles-tagged`** — out of scope per ADR-0002's follow-up; this ADR's algorithm orders the union ahead of where the slice will live.
- **Server-side caching of `profiles-tagged`** — out of scope.
- **Cross-POV authoring views** — explicit out-of-scope per the story.

## Test infrastructure

- **Test framework:** project's hand-rolled Node runner (`test/test.js` orchestrates suites). Playwright for browser flows. No new frameworks introduced.
- **Control panel API:** `http://localhost:7778` (override via `BRAINSTORM_BASE_URL`).
- **Concept Graph API:** not exercised by Story 3 (no concept or schema changes per ADR-0004 — same `tag` and `nostr-user-tag` concepts as Stories 1–2).
- **Live publish-flow Phase 1 preconditions:** `nak` on PATH AND `/api/strfry/publish` reachable AND `MEILI_URL_HOST` reachable. No filesystem mutation needed — runs on host dev boxes.
- **Live publish-flow Phase 2 preconditions:** all of Phase 1, **plus** `TAPESTRY_SETTINGS_PATH` (default `/var/lib/brainstorm/settings.json`) writable from the test process. The viewer-union is only observable when a POV with a minRank threshold is installed; without a POV, `resolvePov` falls back to "all positive applications count" and the viewer's own assertion is in the row already (defeating the union's purpose). Skips per-phase when not writable. Implementer / reviewer environments that share the FS with the brainstorm server (or run tests inside the container) exercise Phase 2.
- **Why filesystem mutation, not API mocking:** the codebase has no in-process POV-injection hook or HTTP endpoint that can install a house POV without a real auth session (`userPrefsApi.js` requires `req.session.pubkey`). The only public mechanism is the on-disk `settings.json` + per-user `user-prefs/<pk>.json` files that `resolvePov` reads. This matches the pattern Stories 2 and 4's POV-narrowing tests already use. The split into Phase 1 / Phase 2 minimizes how much coverage depends on it.
- **Playwright precondition:** `BRAINSTORM_SERVER_ACCESSIBLE=true` and the SPA served by the control panel. Routes: `/tag/:tagId` and `/tag/:slug/:tagId` (per ADR-0002 + ADR-0004).
- **Playwright browser binaries:** must be installed via `npx playwright install`. On this dev box the spec parses + lists cleanly across 5 projects, but the chromium headless shell is not present, so the suite errors at `global-setup` rather than running tests. Implementer / reviewer environments install the browsers.
- **Fixtures:** none on disk. Publish-flow tests generate ephemeral keypairs per run; each phase has its own self-contained fixture. Every author/target pubkey is unique-per-run so test data cannot collide across runs (or between Phase 1 and Phase 2).

## How to run

```sh
# Server suites (Phase 1 of the Story 3 publish flow runs anywhere nak +
# control panel are reachable; Phase 2 runs when settings.json is writable).
npm test

# Story 3 UI affordances only — chromium, single project, line reporter
BRAINSTORM_SERVER_ACCESSIBLE=true \
  npx playwright test tests/brainstorm/tag-detail-write.spec.js \
  --project=chromium --reporter=line

# On NixOS dev boxes:
nix-shell --run 'BRAINSTORM_SERVER_ACCESSIBLE=true npx playwright test tests/brainstorm/tag-detail-write.spec.js --project=chromium --reporter=line'
```

> The Playwright browser-binary caveat from Story 2 still applies (browsers must be installed; `npx playwright install` once per environment). Not a Story 3 regression.

## Verification

Confirmed failing for the right reasons on 2026-05-14, against commit `81787873` (no Story 3 implementation yet).

**Story 3 contract suite** (`test/tag-detail-write.test.js`) — one of four tests fails; three pass trivially because the unimplemented endpoint happens not to break the additive contract. The failing test is the central viewer-feature contract:

```
--- tag-detail-write tests (Story 3) ---
  PASS  GET /api/profile-tags/profiles-tagged accepts an optional viewerPubkey query param
  PASS  GET /api/profile-tags/profiles-tagged silently ignores a malformed viewerPubkey
  FAIL  GET /api/profile-tags/profiles-tagged returns viewerAssertions as a plain object when viewerPubkey is provided
        response must include viewerAssertions when viewerPubkey is provided
  PASS  GET /api/profile-tags/profiles-tagged response shape is preserved (no viewerPubkey)

tag-detail-write: 3 passed, 1 failed
```

The three currently-passing tests describe behavior we *want* preserved as the Implementer adds the feature; the one failing test is the central acceptance.

**Story 3 publish-flow suite** (`test/tag-detail-write-publish.test.js`) — Phase 1 runs locally and four tests fail for the right reasons; Phase 2 skips as expected on this dev box:

```
--- tag-detail-write publish-flow tests (Story 3) ---
  (phase 1: no POV required)
  FAIL  viewerAssertions is populated when viewerPubkey is provided
        viewerAssertions must be a map; got undefined
  FAIL  viewerAssertions is an empty map for a viewer with no assertions on this tag
        viewerAssertions must be present as a map; got undefined
  FAIL  each row carries onlyViewerVisible: false when the viewer is in the in-WoT counts
        expected onlyViewerVisible=false (row is WoT-visible); got undefined
  FAIL  rows have an onlyViewerVisible field even when no viewerPubkey is passed
        rows must carry an onlyViewerVisible field even without viewerPubkey; got
        {"pubkey":"…","applications":1,"disputes":0,"displayName":"TA-s3np-…","picture":null}
  (phase 2: POV-required — needs settings.json writable)
  SKIP  /var/lib/brainstorm/settings.json not writable from this process;
        viewer-union/no-leak/false-positive guards exercised on environments
        where the test process and the server share a filesystem

tag-detail-write-publish: 0 passed, 4 failed, 5 skipped
```

The Phase 1 failures genuinely exercise the feature: the suite successfully generates keypairs, signs and publishes 1 tag-element + 2 assertions (one apply, one dispute), upserts 2 Meili docs, and confirms the server response doesn't yet include `viewerAssertions` or `onlyViewerVisible`. That confirms (a) the fixture is sound and (b) the implementation gap is the only thing standing between failing and passing on a host dev box.

**Stories 1, 2, and 4 suites all still pass** (no regression from threading the new suites into `test/test.js`):

```
Test Results
-------------
Configuration Loading:        PASS
profile-tags suite:           PASS (13 passed, 0 failed)
profile-tags-publish suite:   PASS (7 passed, 0 failed)
tag-detail suite:             PASS (8 passed, 0 failed)
tag-detail-publish suite:     PASS (9 passed, 0 failed)
tag-detail-write suite:       FAIL (3 passed, 1 failed)
tag-detail-write-publish suite: FAIL (0 passed, 4 failed)
tag-index suite:              PASS (7 passed, 0 failed)
tag-index-publish suite:      PASS (9 passed, 0 failed)
Overall:                      FAIL
```

**Playwright spec** (`tests/brainstorm/tag-detail-write.spec.js`) — parses, lists 11 tests across 5 browser projects (chromium / firefox / webkit / mobile-chrome / mobile-safari):

```
Listing tests:
  [chromium] › … › logged-out: tag page renders no Apply/Dispute buttons and no profile-search input
  [chromium] › … › logged-in: rows show Apply + Dispute buttons and the page-search input is visible
  [chromium] › … › logged-in: row shows applied state and only the opposite-polarity button is actionable
  [chromium] › … › logged-in: row shows disputed state and only the opposite-polarity button is actionable
  [chromium] › … › logged-in: viewer-only-visible row carries a "your assertion — not yet visible to this POV" badge
  [chromium] › … › logged-in: rows whose counts are non-zero do NOT show the viewer-only badge
  [chromium] › … › logged-in: clicking Apply on a row publishes a kind-39999 nostr-user-tag assertion with polarity=+1
  [chromium] › … › logged-in: clicking Dispute on a row publishes a kind-39999 nostr-user-tag assertion with polarity=-1
  [chromium] › … › logged-in: total publish failure surfaces an inline error
  [chromium] › … › logged-in: typing in the page-search input renders result rows with Apply/Dispute buttons
  [chromium] › … › logged-in: applying via page-search refetches the main list and the profile appears there
…(firefox + webkit + mobile-chrome + mobile-safari same 11 tests each)…
```

Cannot execute here — chromium headless shell isn't installed in this environment (`npx playwright install` not run on this dev box). The implementer / reviewer environments install Playwright browsers and exercise the suite end-to-end.

**On the Phase 2 SKIP:** unlike Stories 2/4's POV-narrowing tests (transitively backstopped by Story 1's WoT search), Story 3's Phase 2 covers brand-new viewer-union behavior with no transitive coverage. The implementer should run Phase 2 in an environment that can write `settings.json` (the brainstorm server box itself, or tests run inside the tapestry container) to fully verify the acceptance criteria that depend on the viewer-union narrowing semantics (AC-6 server side, AC-7 server flag, AC-8 server no-leak guarantee). The Playwright suite covers the UI contract assuming a server response shape; Phase 1 + Phase 2 together cover the server contract; the three layers sandwich the feature.
