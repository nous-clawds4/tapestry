# Test Plan: Story 19 — Admin tools panel on the dashboard + fix Neo4j-Browser link bug

**Story:** `engineering-team/stories/19-admin-tools-dashboard-panel.md`
**ADR:** `engineering-team/decisions/0017-admin-tools-dashboard-panel.md`
**Date:** 2026-05-21

## Test posture

Source/structural **sentinels** in a new file `test/admin-tools-dashboard-panel.test.js` pin the ADR-required UI shape: `<AdminToolsPanel />` declared in `Dashboard.jsx`, gated by `useAuth` + the owner-or-admin classification idiom, consuming `useConfig().neo4jBrowserUrl` for the env-aware Neo4j Browser URL, and referencing both `/admin/queues/` and `browser/preview` as card destinations. Companion sentinels cover the `ConfigContext` extension (4th fetch + 4th field), the `Neo4jOverview` bug fix (no more hardcoded localhost), and the `bullBoardMount.js` miscLinks back-link to `/tapestry`.

The **behavioral round-trip** — sign in as an owner pubkey, observe the panel appear with both cards, click them, navigate via miscLinks back from BullBoard — is reproducible only with a real browser + session cookie and is the **authoritative cycle-staging smoke** (operator-required).

This project has **no Playwright tests in CI**, so client-side behavior (panel visibility branches, click handlers) is covered structurally via source sentinels. The "user.classification check appears in the component" sentinel is defense-in-depth: the actual access control for BullBoard is the story #18 server middleware, which has its own test suite (`bullboard-admin-access` 9 sentinels, all still green).

## Coverage map

| Criterion (story §) | Test name | Test file | Level |
|---|---|---|---|
| AC: owner sees the panel | T1 (component declared) + T2 (useAuth + classification check matches 'owner') | `test/admin-tools-dashboard-panel.test.js` | source sentinels |
| AC: admin sees the panel | T2 (classification check matches 'admin' too) | `test/admin-tools-dashboard-panel.test.js` | source sentinel |
| AC: non-operator does NOT see the panel | T2 (early `return null` branches on the gate failing — verified by the existence of the gate-check tokens; behavioral verification deferred to cycle-staging) | `test/admin-tools-dashboard-panel.test.js` | source sentinel + smoke |
| AC: unauthenticated does NOT see the panel | Same as above — `user?.classification` is undefined when unauth, so the gate falls through; verified structurally via T2 | `test/admin-tools-dashboard-panel.test.js` | source sentinel + smoke |
| AC: panel labeled "Admin tools" | T1's spec requires the panel; the literal text + emoji come for free if T1 passes (implementation has the heading inline). No separate sentinel — visual confirmation is a smoke step. | — | smoke |
| AC: BullBoard card → /admin/queues/ | T4 (BullBoard URL referenced) | `test/admin-tools-dashboard-panel.test.js` | source sentinel |
| AC: Neo4j card → env-aware URL | T3 (useConfig + neo4jBrowserUrl referenced) + T4 (browser/preview referenced) | `test/admin-tools-dashboard-panel.test.js` | source sentinel |
| AC: both cards open in a new tab | Implementation detail — `target="_blank"`. Not separately sentineled (ADR spec is in the Implementation notes; deviating is highly unlikely). Cycle-staging operator confirms behaviorally. | — | smoke |
| AC: Neo4j Overview bug fix (no localhost:8080 hardcode) | T6 (assert hardcoded URL is gone AND useConfig is consumed) | `test/admin-tools-dashboard-panel.test.js` | source sentinel |
| AC: Neo4j Overview button uses env URL — verified on staging + prod | Cycle-staging smoke: clicking the button from `https://staging.brainstorm.world/tapestry/databases/neo4j` opens `http://staging.brainstorm.world:7474/browser/preview/` (NOT localhost). | — | smoke (operator/Reviewer) |
| AC: BullBoard "Tapestry Dashboard" miscLinks entry | T7 (miscLinks contains /tapestry URL) | `test/admin-tools-dashboard-panel.test.js` | source sentinel |
| AC: clicking miscLinks navigates to /tapestry | Behavioral — cycle-staging smoke. Source sentinel pins the URL string; click behavior is BullBoard's native behavior. | — | smoke |
| AC: placement above the fold (between HealthRow and ConstraintsCheck) | ADR §Implementation §2 specifies the slot; no separate sentinel (placement is hard to source-grep meaningfully — the Implementer puts `<AdminToolsPanel />` at the right spot and the Reviewer eyeballs). | — | smoke |
| AC: no regression in 15 prior suites | `npm test` overall PASS post-impl. The two regression sentinels (R1, R2) belt-and-suspenders specific contracts. | (full gate) | gate |
| AC: ConfigContext extension consumes /api/status + exposes neo4jBrowserUrl | T5 + R1 | `test/admin-tools-dashboard-panel.test.js` | source sentinels |
| AC: existing 3 ConfigContext fields preserved | R1 (taPubkey + ownerPubkey + aRelays still referenced AND still fetched) | `test/admin-tools-dashboard-panel.test.js` | source sentinel (regression) |
| AC: story #18's server-side gate intact | R2 (requireOwnerOrAdmin still declared in admin/index.js) + bullboard-admin-access suite's existing 9 sentinels all still pass | `test/admin-tools-dashboard-panel.test.js` + `test/bullboard-admin-access.test.js` | source sentinels (regression) |

## Edge cases

| Case | Status |
|---|---|
| `useConfig().neo4jBrowserUrl` is null during initial load | **Documented & handled.** ADR §Implementation §2 specifies the panel returns `null` when `neo4jBrowserUrl` is missing — wait for config to load. No flash of broken Neo4j link. Verified structurally via T3. |
| User signs out while looking at the dashboard | **Handled.** `useAuth` returns `user: null` → classification check returns false → panel returns null on next render. No additional code needed. |
| Admin removed from `BRAINSTORM_ADMIN_PUBKEYS` while their session is open | **Acceptable.** The UI gate uses `classification`, which was resolved at sign-in. They'll still see the panel until next reload — at which point the gate recomputes. The real access control is the server middleware (story #18), which re-checks every request. Same trade-off as story #18's "session cookie reuse after admin removal" — documented there. |
| `TASK_QUEUE_ENABLED=false` (rare rollback state) | **Per story #19 §Out of scope**: card linking to a 404 is acceptable. Not separately tested. Cycle-staging Reviewer doesn't exercise this. |
| Neo4j Browser at `http://${host}:7474` is unreachable (firewall, port closed) | **Acceptable.** The card links there; whether the browser can actually reach the port is a deploy-environment concern, not a UI concern. Same trade-off as the prior `Open Neo4j Browser` button (story #19 just makes the URL correct; reachability was pre-existing). |
| BullBoard mount fails (e.g., Redis down at boot, TASK_QUEUE_ENABLED=true but no queue) | **Acceptable.** Card links to a 404; operator can navigate back. The story's narrow scope is dashboard discoverability — handling backend failure modes is out of scope. |
| Future change accidentally removes the `useConfig` extension | **Caught by R1.** The regression sentinel asserts the 3 existing fields AND the 3 existing fetches remain. If a future cleanup removes any of them, R1 trips loudly. |

## Test infrastructure

- **Framework:** Node built-in runner via `npm test` (entry: `test/test.js`).
- **New test file:** `test/admin-tools-dashboard-panel.test.js`, registered in `test/test.js` (four-spot wiring: require, run, log, ok-check).
- **No new test infrastructure.** Same plain-Node sentinel pattern stories #13/#15/#16/#17/#18 used.
- **No Playwright** — the project doesn't have it; UI is structurally sentineled, behaviorally smoked.
- **Concept Graph API:** not required.
- **Firmware reinstall:** no.

## How to run

```
npm test
```

The new suite registers as `admin-tools-dashboard-panel suite:` after `bullboard-admin-access suite:` in `test/test.js`. Post-implementation expected: `PASS (9 passed, 0 failed)`.

For Reviewer cycle-local smoke (behavioral round-trip):

```bash
# 1. Inside the tapestry container, rebuild the UI bundle:
docker exec tapestry bash -c 'cd /usr/local/lib/node_modules/brainstorm/ui && npm run build && cp -r ../dist/. ../dist-prev/' 2>&1 | tail -3
docker exec tapestry supervisorctl restart brainstorm
# 2. Open Tapestry in browser, sign in as the owner pubkey.
#    Verify: "🛠️ Admin tools" panel visible between HealthRow and below sections.
#    Click "Task Queue (BullBoard)" → new tab → BullBoard UI loads.
#    Click "Neo4j Browser" → new tab → http://localhost:7474/browser/preview/ loads.
# 3. From /admin/queues/, verify the "← Tapestry Dashboard" miscLinks entry is
#    visible in BullBoard's header. Click → navigates to /tapestry.
# 4. Sign out → reload dashboard → panel ABSENT.
```

For operator cycle-staging smoke (the acid test):

1. Sign in to `https://staging.brainstorm.world/tapestry` as the owner pubkey.
2. Confirm the "Admin tools" panel appears with both cards.
3. Click "Neo4j Browser" — must open `http://staging.brainstorm.world:7474/browser/preview/` in a new tab. **NOT localhost** (this is the bug-fix acid test).
4. Click "Task Queue (BullBoard)" — opens BullBoard at `/admin/queues/` with the "← Tapestry Dashboard" link in its header. Click the back-link → lands on `/tapestry`.
5. (Optional) Sign in as a non-owner admin pubkey if available → panel still visible.

## Verification

The new tests fail with the pre-implementation code (no `<AdminToolsPanel />`, no ConfigContext extension, hardcoded Neo4j URL, empty miscLinks). Confirmed on 2026-05-21 at commit `59fd1927`:

```
admin-tools-dashboard-panel suite:
  ✗ T1: Dashboard.jsx declares function AdminToolsPanel
      ui/src/pages/Dashboard.jsx does not declare `function AdminToolsPanel`...
  ✗ T2: AdminToolsPanel consumes useAuth and gates on owner-or-admin
      AdminToolsPanel function declaration not found — T1 must pass first.
  ✗ T3: AdminToolsPanel consumes useConfig + neo4jBrowserUrl
      AdminToolsPanel function declaration not found — T1 must pass first.
  ✗ T4: AdminToolsPanel references both /admin/queues/ + browser/preview
      AdminToolsPanel function declaration not found — T1 must pass first.
  ✗ T5: ConfigContext fetches /api/status + exposes neo4jBrowserUrl
      ConfigContext.jsx does not fetch /api/status...
  ✗ T6: Neo4jOverview no longer hardcodes localhost:8080 + consumes useConfig
      Neo4jOverview.jsx still hardcodes `localhost:8080/browser/preview/`...
  ✗ T7: bullBoardMount.js miscLinks includes /tapestry back-link
      bullBoardMount.js miscLinks does not contain a /tapestry back-link...
  ✓ R1: ConfigContext.jsx still exposes existing 3 fields (additive extension)
  ✓ R2: src/api/admin/index.js still declares requireOwnerOrAdmin (story #18 contract)

Test Results
-------------
admin-tools-dashboard-panel suite:               FAIL (2 passed, 7 failed)
Overall:                                         FAIL
```

The 15 prior suites continue to PASS — no collateral damage. Each of the 7 failures carries a right-reason message pointing the Implementer at a specific edit per ADR 0017 §Implementation:
- T1 → add the component to Dashboard.jsx
- T2 → in the new component body, useAuth + classification checks
- T3 → in the new component body, useConfig + neo4jBrowserUrl
- T4 → in the new component body, the two card URLs
- T5 → extend ConfigContext.jsx with the 4th fetch + 4th field
- T6 → replace the hardcoded URL in Neo4jOverview.jsx with useConfig
- T7 → populate miscLinks in bullBoardMount.js

R1 + R2 are passing now and must continue to pass — they guard the ConfigContext additivity AND the story #18 server-side gate.
