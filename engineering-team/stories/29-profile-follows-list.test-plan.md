# Test Plan: Story 29 — Follows list on the primary profile page (v1, owner POV)

**Story:** `engineering-team/stories/29-profile-follows-list.md`
**ADR:** `engineering-team/decisions/0026-profile-follows-list.md`
**Date:** 2026-05-28

Scope: **v1 = owner POV only.** Customer-observer features (POV selector, `NostrUserWotMetricsCard` branch, observer-relative switching, `?observer=<customer>`) are in the story's "Deferred to a follow-up" section and are **not** tested here (except the v1 contract that a non-owner `observer` is rejected — T5).

Two test levels, matching repo precedent:
- **Node source-regex suite** `test/profile-follows-list.test.js` (wired into `test/test.js`) — pins the backend endpoint contract and the spec-bearing frontend source, the way `per-query-neo4j-timeout-safety-net.test.js` and `admin-tools-dashboard-panel.test.js` do. Runs with no browser and (for the source checks) no live server. **Confirmed failing today.**
- **Playwright spec** `tests/brainstorm/profile-follows-list.spec.js` — the browser-observable behaviors (clicking, persistence across reload, popover tap, navigation). Requires `npx playwright install` + the UI built into `dist/` + a reachable instance. **Expected failing until implemented** (the route/page/link don't exist).

## Coverage map

| Acceptance criterion | Test(s) | File | Level |
|---|---|---|---|
| Entry point (Following → /follows, same tab) | `T11` + PW "Entry point" | `test/profile-follows-list.test.js`, `tests/brainstorm/profile-follows-list.spec.js` | source + e2e |
| Return (Back to profile + browser back) | `T12` + PW "Direct load + Return" | both | source + e2e |
| Direct load (owner-POV page renders) | `T6`, `T8` + PW "Direct load + Return" | both | source + e2e |
| Row navigation (row → /user/&lt;pk&gt;) | `T13` + PW "Row navigation" | both | source + e2e |
| Listing (one row per follow; empty state) | `T9` + PW "Listing", PW "Listing (N=0)" | both | source + e2e |
| Default sort (verifiedFollowerCount desc, whole set) | `T20` | node | source |
| Re-sort (any column) | `T18` (DataTable reuse) | node | source |
| Search (name / npub) | `T18` + PW "Search" | both | source + e2e |
| Pagination (preserves sort/search/columns) | `T19` + PW "Search"/reload | both | source + e2e |
| Default visibility (pic/name/rank shown; rest hidden) | `T14` + PW "Default visibility" | both | source + e2e |
| Toggle (show/hide any column) | `T14` + PW "Toggle + Persistence" | both | source + e2e |
| Persistence (localStorage + reset-to-defaults) | `T21` + PW "Toggle + Persistence" | both | source + e2e |
| Name fallback (display_name → name → npub) | `T16` | node | source |
| Rank (round(influence×100), 0–100, "—" when null) | `T15` | node | source |
| Owner point of view (metrics from NostrUser node) | `T3`, `T5` | node | source |
| Local-data disclosure (tappable ⓘ, "not via NIP-85") | `T22` + PW "Local-data disclosure" | both | source + e2e |

Backend endpoint contract (ADR-required, supports Direct load + Owner POV):

| Contract | Test |
|---|---|
| Handler file + export `handleGetGrapevineFollows` | `T1` |
| `observee` required + 64-hex validated → 400 | `T2` |
| Cypher traverses FOLLOWS + returns the 6 per-row fields | `T3` |
| Neo4j deadline (`NEO4J_QUERY_TIMEOUT_MS`) + 504 `{success:false}` | `T4` |
| Non-owner `observer` → 400 (customer observers deferred) | `T5` |
| Route registered `GET /api/get-grapevine-follows` | `T6` |
| Response shape `{success, observer, observee, count, data[]}` | `T7` |

## Regression sentinels (must stay green before AND after)

- `R1` — the shared `follows` Cypher in `cypherQueries.js` is **unchanged** (RETURN still `{pubkey, hops, influence}`). Enforces ADR Option A (new endpoint), i.e. guards against an accidental "B-lite" edit to the shared `get-grapevine-interaction`.
- `R2` — `BrainstormProfile.jsx` still renders the Following count value + "Following" label via `useUserCounts` (the link wraps the count; it isn't removed).
- `R3` — the existing `/api/get-grapevine-interaction` route stays registered (legacy grapevine-analysis page unregressed).

## Edge cases

- [x] **N = 0** (user follows no one) → empty-state message (`T9` source; PW "Listing (N=0)" using the all-zero pubkey).
- [x] **`influence` null** → rank renders "—" (`T15`).
- [x] **Non-owner observer** in v1 → 400, not a silent owner coercion (`T5`).
- [x] **Search no-match** → visible rows shrink (PW "Search").
- [ ] **Count vs list divergence (intentionally NOT asserted):** the profile's "Following: N" badge (strfry kind-3) and the follows-list row count (Neo4j FOLLOWS) legitimately differ by crawl lag (ADR Context). No test asserts equality — doing so would be a false constraint.
- [ ] **Very large follow sets** (thousands): client-side sort/paginate performance is verified manually via cycle-local, not pinned by an automated test (v1 accepts legacy-parity client-side handling).

## Test infrastructure

- **Node runner:** `npm test` (entry `test/test.js`) now includes the `profile-follows-list` suite. The source checks need neither a browser nor a live server. Standalone:
  ```
  node -e "require('./test/profile-follows-list.test.js').run().then(r=>{console.log(r);process.exit(0)})"
  ```
- **Playwright:** `npm run test:playwright` (or scope: `npx playwright test tests/brainstorm/profile-follows-list.spec.js --project=chromium`).
  - One-time per machine: `npx playwright install`.
  - Requires the UI **built into `dist/`** (`npm run build` in `ui/`) and a reachable instance. `baseURL` defaults to `http://localhost:7778` (override with `BRAINSTORM_BASE_URL`). Browsers installed on this machine via `npx playwright install` on 2026-05-28 (chromium/firefox/webkit).
- **Browser verification — two options, both available:**
  - **Claude-in-Chrome extension** — interactive, agent-driven checks in a real Chrome with the user's session/auth; no install. Best for the Verify step (walking ACs live, judging the mobile popover UX) and for the deferred customer-observer auth'd flows. Not deterministic; not a CI gate.
  - **Playwright** (`tests/brainstorm/profile-follows-list.spec.js`) — the deterministic, committed regression net; the only path that runs headless in CI and across the configured mobile viewports (Pixel 5, iPhone 12). Browsers now installed.
- **Port note:** the live control panel here is on **`:7778`** (`CONTROL_PANEL_PORT`), not the `:8877` mentioned in some role/template docs. No Concept Graph dependency — this story changes no concept definitions, so **no `POST /api/firmware/install` prerequisite**.
- **Fixtures (Playwright):**
  - `POPULATED_PUBKEY = 2efaa715…d987331` — follows many accounts (populated-list checks).
  - `EMPTY_PUBKEY = 0000…0000` — empty-state check.

## How to run

```
npm test                 # node suites (includes profile-follows-list)
npm run test:playwright  # browser/e2e (needs npx playwright install + a built, running UI)
```

## Verification

Node suite confirmed **failing for the right reason** on 2026-05-28 (pre-implementation, at the test-design commit):

```
22 T-tests FAIL — each reporting the missing artifact, e.g.:
  ✗ T1 … followsWithMetrics.js does not exist yet — the Implementer must create the new endpoint handler
  ✗ T6 … src/api/index.js must register the route '/api/get-grapevine-follows'
  ✗ T8 … App.jsx must declare a route with path '/user/:pubkey/follows'
  ✗ T11 … BrainstormProfile.jsx must link the Following count to `/user/${pubkey}/follows`
  … (T2–T5, T7, T9–T10, T12–T22)
3 R-sentinels PASS (R1 shared follows query unchanged, R2 profile count intact, R3 legacy route present)

=== RESULT: 3 passed, 22 failed ===
```

Playwright spec: browsers are now **installed** (`npx playwright install`, 2026-05-28: chromium/firefox/webkit). The spec is intentionally **not run pre-implementation** — it would only re-confirm the route is absent, which the node suite already shows. It is written to fail until implemented and will be exercised in the **Verify step** after `npm run build` — via Playwright (`npm run test:playwright`) and/or interactively via the Claude-in-Chrome extension.
