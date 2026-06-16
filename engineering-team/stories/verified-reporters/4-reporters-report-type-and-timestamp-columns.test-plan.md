# Test Plan: Story verified-reporters #4 — Report Type and Reported (timestamp) columns

**Story:** `engineering-team/stories/verified-reporters/4-reporters-report-type-and-timestamp-columns.md`
**ADR:** `engineering-team/decisions/verified-reporters/0004-reporters-report-type-and-timestamp-columns.md`
**Date:** 2026-06-15

## Approach
Two tiers, in one node suite `test/verified-reporters-report-columns.test.js` (wired into `test/test.js`), plus one supplementary Playwright spec.

1. **Real behavioral unit tests (executed)** for the two NEW pure helpers. `ui/` is an ES-module package (`"type":"module"`), so the CJS harness loads them via dynamic `import()` and asserts **actual output** — `formatTimeAgo` (the `3d, 4h, 12m ago` format + every edge case) and `humanizeReportType` (NIP-56 token → friendly label). This is where the subtle display behavior lives, so it gets genuine execution, not regex.
2. **Source-regex sentinels** for the parts the CJS harness cannot execute (ESM React + the Express handler) — the endpoint relationship-binding, the shared `DataTable` opt-in accessor, and the page (columns, defaults, summary, row fields). This matches the established precedent (`test/verified-reporters-list-page.test.js`, `…-membership-data.test.js`).
3. **Supplementary Playwright spec** `tests/brainstorm/profile-verified-reporters-columns.spec.js` — verifies the browser-rendered **column chooser** (the new default set is checkable even on a zero-reporter account, since the chooser renders above the table). The populated path (ago-format cells, raw-integer sort, the summary line) is a documented manual/fixture check, exactly as Story 3 handled its populated path.

**False-positive trap handled:** `BrainstormFollowers.jsx` already has a "Verified Reporters" *column* (`verifiedReporterCount`) and the word "reporters"; the reporters page already says "reported". Every new sentinel targets strings/keys absent pre-implementation — `formatTimeAgo`, `humanizeReportType`, `key:'reportType'`, label `'Reported'`, `sortValue`, `new Set(` (distinct-reporter summary), and the new `DEFAULT_VISIBLE` (`reportType:true` / `name:false`).

## Coverage map
| Criterion (story AC) | Test(s) | Level |
|---|---|---|
| Default columns = Picture/Report Type/Rank; Name & Reported toggleable | T20 (DEFAULT_VISIBLE), Playwright (chooser checked-state) | source-regex + e2e |
| Column chooser keeps Name/Reported/others selectable | T18 (Reported col exists), Playwright (both options visible) | source-regex + e2e |
| Report Type cell = humanized label | T8 (spam→Spam, impersonation→Impersonation, …), T17 (page wires humanizeReportType) | unit + source-regex |
| Reported cell = relative "ago" (y/d/h/m), e.g. `3d, 4h, 12m ago` | T1–T4 (format), T18 (page wires formatTimeAgo) | unit + source-regex |
| Sort Reported by RAW unix integer (not "ago" text) | T13 (sortValue accessor), T18 (column declares sortValue) | source-regex |
| Missing report_type/timestamp → empty cell | T6 (formatTimeAgo→""), T9 (humanizeReportType→""), T19 (page render `== null ? ''`) | unit + source-regex |
| Missing timestamps sort LAST in both directions | T14 (fixed `return 1`/`-1` before asc/desc flip) | source-regex |
| One row per report; NO client-side de-dup | T12 (query: no DISTINCT/aggregation), T22 (rows carry per-edge fields), Playwright manual note | source-regex + manual |
| "N reporters, M reports" summary | T21 (distinct via `new Set` over pubkeys + "reports" label) | source-regex |
| report_type + timestamp sourced from the REPORTS edge | T10 (bind `[rel:REPORTS]`), T11 (RETURN report_type/timestamp + toInt) | source-regex |
| Follows/Followers pages unaffected | R1 (followers defaults), R2 (follows defaults) | regression |

## Edge cases
- [x] `formatTimeAgo`: 3-unit truncation (T2), interior-zero drop (T3), single unit (T4), sub-minute/zero → `0m ago` (T5), missing/NaN → `""` (T6), future timestamp clamps to `0m ago` (T7).
- [x] `humanizeReportType`: NIP-56 set incl. `unspecified` (T8), empty/null → `""` (T9).
- [x] Sort: missing-last in **both** directions (T14); the existing `localeCompare(numeric)` path preserved for the other 15 `DataTable` consumers (T15).
- [x] Endpoint stays one-row-per-edge (no `DISTINCT`/`collect`/`count`) so duplicate-edge bugs remain visible (T12); Story-2 contract `count:data.length` + `observer:'owner'` intact (R3); hook unchanged (R4).
- [ ] Populated browser path — ago-format cells, raw-integer header sort, the "N reporters, M reports" line, multi-row-per-reporter — documented manual/fixture check (most accounts have 0 verified reporters); Playwright covers the chooser/defaults on a zero account.

## Test infrastructure
- Framework: Node built-in runner (`node test/test.js`) for the deterministic suite (wired in `test/test.js`); Playwright (`npm run test:playwright`) for the supplementary spec. No new frameworks.
- Pure-helper tests load `ui/src/utils/timeAgo.js` and `ui/src/utils/reportType.js` via dynamic `import()` (ui is `type:module`); they must be **import-safe** (pure, no side-effect imports).
- Concept Graph API: not required (no concept/graph/firmware change).
- Live stack: only the Playwright spec needs a running instance with the UI **built** (`npm run build` in `ui/`). Base URL `BRAINSTORM_BASE_URL` or `http://localhost:7778`; fresh browser context (empty localStorage) so `DEFAULT_VISIBLE` applies.
- Fixtures: Playwright uses Jack Dorsey (`82341f88…be6a2`) as a scores-loaded, 0-verified-reporters account (chooser renders; empty table).

## How to run
```
npm test                       # deterministic node suites (incl. this one)
npm run test:playwright        # supplementary browser spec (needs a built, running instance)
```

## Verification
The new node suite fails with the current code (20 feature tests fail; **6 guard/regression tests pass** — T12 no-dedup guard, T15 preserved-sort-path guard, and R1–R4 for the untouched follows/followers pages, endpoint contract, and hook). Every other suite in `npm test` remains PASS. Confirmed via `npm test` on 2026-06-15 at commit `5bcad648`:

```
verified-reporters-report-columns suite:
  ✗ T1: formatTimeAgo renders the multi-unit headline format "3d, 4h, 12m ago" (AC: Reported display)
        ui/src/utils/timeAgo.js must exist and export `formatTimeAgo(unixSeconds, now?)` … absent pre-implementation.
  ✗ T2: formatTimeAgo shows the 3 most-significant units (years..minutes), dropping the rest
  ✗ T3: formatTimeAgo drops zero-valued units (interior zeros are not shown)
  ✗ T4: formatTimeAgo renders a single unit when only one is non-zero ("3d ago")
  ✗ T5: formatTimeAgo renders "0m ago" for sub-minute and zero deltas (minute is the smallest unit)
  ✗ T6: formatTimeAgo returns "" for missing/invalid input (AC: absent timestamp → empty cell)
  ✗ T7: formatTimeAgo clamps future timestamps to "0m ago" (no negative durations)
  ✗ T8: humanizeReportType converts NIP-56 tokens to friendly labels (spam → Spam, impersonation → Impersonation)
  ✗ T9: humanizeReportType returns "" for missing/empty input (AC: absent report_type → empty cell)
  ✗ T10: the query BINDS the :REPORTS relationship (so its properties can be returned)
  ✗ T11: the query RETURNs report_type + timestamp and the handler maps them (timestamp via toInt)
  ✓ T12: the query does NOT de-duplicate or aggregate — one row per REPORTS edge is preserved
  ✗ T13: DataTable supports an opt-in per-column `sortValue` accessor (sort by a raw value, decoupled from render)
  ✗ T14: DataTable sorts missing values LAST regardless of direction
  ✓ T15: DataTable PRESERVES the existing localeCompare(numeric) path for all other columns (regression — 16 consumers)
  ✗ T16: the page imports the two new helpers (formatTimeAgo, humanizeReportType)
  ✗ T17: the page defines a Report Type column (key reportType, label "Report Type", humanized render)
  ✗ T18: the page defines a Reported column (key timestamp, label "Reported", sortValue + formatTimeAgo render)
  ✗ T19: the Reported cell renders empty for a missing timestamp (AC: absent field → empty cell)
  ✗ T20: DEFAULT_VISIBLE is Picture/Report Type/Rank — Name and Reported are NOT default
  ✗ T21: the page shows a "N reporters, M reports" summary (distinct reporters via Set, total reports = rows)
  ✗ T22: each row carries reportType + timestamp from the hook data
  ✓ R1: BrainstormFollowers default columns are untouched — still Picture/Name/Rank, no reportType
  ✓ R2: BrainstormFollows default columns are untouched — still Picture/Name/Rank
  ✓ R3: the endpoint keeps the Story-2 contract — count:data.length and observer:'owner'
  ✓ R4: useGrapevineReporters is unchanged — still fetches the reporters endpoint and passes data through

verified-reporters-report-columns suite:              FAIL (6 passed, 20 failed)
```

The 6 green tests are the guards that must hold before **and** after implementation: T12 (no `DISTINCT`/aggregation → one row per edge), T15 (the default `localeCompare(numeric)` sort path stays intact for the other 15 `DataTable` consumers), and R1–R4. The 20 `✗` fail because the feature is unimplemented — the util modules, the relationship binding, the `sortValue` accessor, and the page columns/defaults/summary are absent — not from a typo or import error; the pure-helper tests report the missing module explicitly. Every other suite remains PASS (full run: all 37 prior suites green, Overall FAIL solely due to this intentionally-failing suite).
