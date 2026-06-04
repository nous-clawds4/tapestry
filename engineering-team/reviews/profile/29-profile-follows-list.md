# Review: Story 29 — Follows list on the primary profile page (v1, owner POV)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-28
**Diff:** `git diff 6484e29c..HEAD` (implementation commit `3b0cc9e0`)
**Artifacts:** story `engineering-team/stories/29-profile-follows-list.md`; ADR `engineering-team/decisions/0026-profile-follows-list.md`; test plan `…29-profile-follows-list.test-plan.md`

## Quality gates (run by reviewer, not trusted)

- [x] **`npm test` — PASS.** Full suite green: all 25 sibling suites pass **and** `profile-follows-list suite: PASS (25 passed, 0 failed)` (22 contract tests + 3 regression sentinels). **Overall: PASS** — no sibling regression from the shared-file (`DataTable.jsx`, `index.js`) edits.
- [x] **`npm --prefix ui run build` — PASS.** Vite build clean (3582 modules, built in ~37s; only the pre-existing chunk-size warning).
- [~] **`npm run test:playwright` — not run.** Browsers are installed, but the spec needs populated data; the local dev graph has **no FOLLOWS edges** (see Verification gap). Deferred to staging.
- [n/a] Lint / typecheck / server build — not configured (JS-without-build); skipped per CLAUDE.md.

## Spec adherence
- [x] Every v1 acceptance criterion maps to a passing test (test-plan coverage map; suite green). Spot-checked the behavioral ones against source: page-level search (`BrainstormFollows.jsx`) matches name/npub/pubkey **regardless of column visibility** (honors "npub searchable when hidden"); default sort pre-sorts the full set by `verifiedFollowerCount` desc before `DataTable`, so pagination shows the true top rows.
- [x] No criterion silently dropped.
- [x] Deferred scope correctly **not** built: no POV selector, no `NostrUserWotMetricsCard` branch; a non-owner `observer` is rejected 400 (`followsWithMetrics.js` ~L62-68). Matches the story's "Deferred to a follow-up" section.

## ADR adherence (0026 — Option A)
- [x] **New endpoint, shared query untouched.** `GET /api/get-grapevine-follows` added (`followsWithMetrics.js`; registered `src/api/index.js` L31/L318). The shared `follows` query in `cypherQueries.js` is byte-for-byte unchanged (sentinel R1 green) — Option A, not B-lite.
- [x] **Owner-POV metrics from the NostrUser node:** `MATCH (observee)-[:FOLLOWS]->(f:NostrUser) RETURN f.influence, f.hops, f.verifiedFollowerCount/MuterCount/ReporterCount`. No card join. Correct for v1.
- [x] **Neo4j deadline + 504** mirrors `userdata.js` (`NEO4J_QUERY_TIMEOUT_MS`, `{ timeout }`, 504 on `TransactionTimedOut`, `.finally` closes session+driver — no leak). Live-verified: missing observee→400, non-owner observer→400, owner→`{success,observer:'owner',count,data}`.
- [x] **No concept/firmware change.** No firmware reinstall required (correct — metrics are runtime node properties, not concept-graph definitions).
- [x] **DataTable change is backward compatible:** `pageSize` + `showFilter` are optional (`DataTable.jsx` L11; default `showFilter=true`, no `pageSize`→no pagination). Existing callers pass neither → identical behavior; the full suite (incl. `admin-tools-dashboard-panel`) stays green.
- [x] No new dependencies introduced.

## Concept-graph integrity
- [x] No concepts touched; no handles introduced; no firmware reinstall; new code does not read BIBLE.md/firmware JSON. N/A but clean.

## Things tests can't catch
- [x] **Security:** `observee` validated (`/^[0-9a-f]{64}$/i` + `nip19` round-trip) and passed as a **Cypher parameter** (`$observee`), not string-interpolated → no injection. Non-owner `observer` rejected before any DB access. (Note: this is *safer* than the legacy `userdata.js`, which interpolates the pubkey.)
- [x] No secrets committed; `dist/` gitignored.
- [x] No leftover `console.log` debug (only `console.error` on real error paths); no commented-out code.
- [x] Error/edge paths handled: 400 (bad/missing observee, non-owner observer), 500 (generic), 504 (timeout), empty-follows → `count:0`/empty-state.
- [x] Concurrency: hook uses `AbortController`; request-scoped Neo4j session/driver closed in `.finally`.

## House rules check
- [x] Concept Graph API authority respected (N/A — no concept change).
- [x] No new lint/typecheck/build tooling (`ui/` Vite build pre-existing; server stays JS-without-build).

## Findings

### Blocking
_None._

### Non-blocking (optional follow-ups, not gating)
1. **`ui/src/pages/BrainstormFollows.jsx`** — the picture column carries `sortable: false`, but `DataTable` doesn't honor that flag (all headers are clickable-to-sort). Harmless no-op; either drop the prop or teach `DataTable` to respect it later.
2. **`ui/src/pages/BrainstormFollows.jsx`** — the Columns dropdown closes via `onMouseLeave`, which has no touch equivalent; on mobile it closes only by re-tapping the "Columns" button. Minor, given the page's mobile-friendly intent. Consider an outside-tap/click handler in a polish pass.
3. **`src/api/grapevineInteractions/queries/followsWithMetrics.js`** — creates a Neo4j driver per request. This matches the existing repo pattern (`userdata.js`, `grapevineInteractions/queries/index.js`), so not a regression; flagging only as shared tech-debt.

### Verification gap (not a code defect — required before prod)
- The **populated-list behaviors** (sort, pagination, search over real rows; rank/hops/verified-count rendering) were **not** exercised: the local dev graph has no FOLLOWS edges. The endpoint contract + validations and the empty-state UI are verified locally. **Before promoting to prod, verify the populated UI against `staging`** (prod-scale data) via Claude-in-Chrome and/or the committed Playwright spec. The test plan already designates staging for this.

## Verdict
**PASS** — the diff matches the story (v1 scope), conforms to ADR 0026 (Option A), is fully covered by the green test suite, builds clean, and has no blocking issues. Ship to staging, then complete the populated-UI verification there before prod.
