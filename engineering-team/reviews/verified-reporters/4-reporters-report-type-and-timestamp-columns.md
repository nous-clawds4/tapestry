# Review: Story verified-reporters #4 — Report Type and Reported (timestamp) columns

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-15
**Diff:** `git diff staging...HEAD` (impl commit `7dc23dad`)
**Story:** `engineering-team/stories/verified-reporters/4-reporters-report-type-and-timestamp-columns.md`
**ADR:** `engineering-team/decisions/verified-reporters/0004-reporters-report-type-and-timestamp-columns.md`
**Test plan:** `engineering-team/stories/verified-reporters/4-reporters-report-type-and-timestamp-columns.test-plan.md`

Method: manual file-by-file audit + an adversarial multi-lens pass (4 independent reviewers — logic/edge-cases, regression to the 16 `DataTable` consumers, ADR/AC conformance, backend/data-flow — each finding then adversarially refuted). 1 finding raised, 1 confirmed (non-blocking), 0 blocking.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS**. All 38 suites green; `verified-reporters-report-columns` **26/26**; Overall **PASS**.
- [x] `npm run build` (ui/) — **clean** (only the pre-existing generic chunk-size warning).
- [~] `npm run test:playwright` — **not run** (live-stack/browser); the supplementary `tests/brainstorm/profile-verified-reporters-columns.spec.js` is a staging-smoke spec, consistent with Story 3's precedent.
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] Local endpoint smoke: new bound-relationship Cypher executes → `200` + correct contract; invalid observee → `400`; page route → `200`. (Local DB unseeded — populated render is a staging check.)

## Spec adherence
- [x] Every acceptance criterion has a passing test (coverage map in the test plan; T1–T22 + R1–R4).
  - Default cols Picture/Report Type/Rank → `DEFAULT_VISIBLE` (T20) + Playwright chooser check; column ORDER in `ALL_COLUMNS` (picture, name, reportType, rank, timestamp, …) renders the visible set left-to-right as Picture · Report Type · Rank ✓.
  - Report Type humanized (T8/T17); Reported "ago" multi-unit (T1–T4/T18); sort by raw unix int (T13/T18); missing → empty + sort-last-both-directions (T6/T9/T14/T19); one row per edge / no dedup (T12/integration lens); "N reporters, M reports" summary (T21).
- [x] No criterion silently dropped.
- [x] No behavior added beyond the story (diff is exactly the authorized files; no scope creep).

## ADR adherence
- [x] Files changed match ADR 0004 §Implementation notes precisely (utils, DataTable opt-in accessor, endpoint binding, page columns/defaults/summary, optional CSS class).
- [x] Layering respected: pure utils stay pure (no DOM/React imports), `DataTable` change is opt-in and additive, endpoint change is additive.
- [x] No new dependencies; no concept/firmware change (runtime Neo4j edge properties only). **Firmware reinstall: not required** ✓.
- [x] Deviation logged: the Implementer's `## Deviations` note (comment reworded to avoid the `/\bDISTINCT\b/i` guard) is present and accurate.

## Concept-graph integrity
- [x] No concept definitions touched; `report_type`/`timestamp` are runtime edge properties, not graph concepts. Handles elsewhere unchanged.
- [x] No firmware reinstall needed; no BIBLE.md re-derivation.

## Things tests can't catch
- [x] No secrets committed (neo4j password was redacted in transient shell output; nothing in the diff).
- [x] No leftover `console.log`/debug; no commented-out code.
- [x] Input validation intact: endpoint still 64-hex-validates `observee` (400) and enforces the Neo4j deadline (504); Story-2 contract `count:data.length` + `observer:'owner'` preserved (R3).
- [x] Edge cases: `formatTimeAgo` clamps future/negative to `0m ago`, returns `''` for null/NaN; `toInt(r.get('timestamp'))` is null-safe for edges created before the `ON CREATE SET r.timestamp` line; `humanizeReportType` returns `''` for falsy. Sort accessor returns fixed ±1 for nulls *before* the asc/desc flip → missing-last holds both directions (verified by trace).
- [x] No race/concurrency surface introduced.
- [x] Regression to the other 15 `DataTable` consumers: none. The accessor branch is gated on a column declaring `sortValue` (none of them do), so the default `localeCompare(numeric)` path is byte-identical (T15). Adding `columns` to the `sorted` memo deps is harmless — `filtered` already depended on `columns`, so `sorted` already recomputed on a `columns` change; no new render loop.

## House rules check
- [x] Concept Graph API authority respected (no concept work).
- [x] No new lint/typecheck/build tooling.

## Findings

### Blocking
_None._

### Non-blocking
1. **`ui/src/pages/BrainstormReporters.jsx:142-145`** — Misleading comment, **confirmed by adversarial verification**. The comment says the summary "explains why the row count can exceed the profile badge." But the badge (`verifiedReporterCount`) is `count(f)` over REPORTS edges with no `DISTINCT` (`src/algos/follows-mutes-reports/calculateVerifiedReporterCounts.sh:13-18`; fallback `src/api/export/users/queries/userdata.js:398`), so **badge = M = `reportCount` = `rows.length`** (the page returns one row per edge with the same cutoff). The value that is ≤ the badge is the distinct-**reporter** count **N** (`reporterCount`), not the row count. The rendered numbers are correct; only the comment inverts the relationship — and it contradicts ADR 0004's own correct statement ("the profile badge counts edges (≈ reports = M); the summary's 'N reporters' is new context"). *Asked change (optional, pre-deploy): reword the comment to "…the distinct-reporter count (N) can be lower than the report/row count (M), which equals the profile badge" (or similar). Comment-only; no behavioral impact.*
2. **`ui/src/pages/BrainstormReporters.jsx` `loadVisible`** — Observation, not a defect. Returning visitors with a saved `bsp-reporters-columns` pref get `{ ...DEFAULT_VISIBLE, ...saved }`, so they see Picture · **Name** · Report Type · Rank (Report Type added, their Name retained); only first-time/reset visitors get the exact Picture · Report Type · Rank default. This matches the AC (scoped to "first-time visitor with no saved column preference") and is the more considerate migration. No change requested.
3. **`ui/src/utils/timeAgo.js`** — Observation. Uses a 365-day year / 24-hour day approximation (documented in the JSDoc). Acceptable for a relative-time label; no change requested.

## Verdict
**PASS** — the diff matches the story, the ADR, and the test plan; all quality gates I ran are clean; coverage is complete; no blocking issues. The one confirmed finding is a misleading (non-behavioral) code comment that contradicts the ADR; correcting it before deploy is recommended but not required for merge.
