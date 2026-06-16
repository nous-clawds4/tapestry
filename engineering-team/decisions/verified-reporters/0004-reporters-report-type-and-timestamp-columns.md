# ADR 0004: Report Type and Reported (timestamp) columns on the Verified Reporters list

**Status:** Accepted
**Date:** 2026-06-15
**Story:** `engineering-team/stories/verified-reporters/4-reporters-report-type-and-timestamp-columns.md`
**Epic:** `verified-reporters`

## Context

Story 4 adds two report-only columns to `/user/:pubkey/reporters` (`BrainstormReporters.jsx`): **Report Type** (humanized label, default-visible) and **Reported** (relative "time ago", toggle-on), sourced from the neo4j `REPORTS` edge. Default visible columns change from Picture/Name/Rank to **Picture/Report Type/Rank**. The Reported column displays e.g. `3d, 4h, 12m ago` but sorts by the **raw unix integer**; missing values render empty and sort **last in both directions**. The page also shows a **"N reporters, M reports"** summary. No client-side de-duplication.

**Verified facts (this branch):**
- The membership endpoint `src/api/grapevineInteractions/queries/reportersWithMetrics.js:94-103` runs `MATCH (observee)<-[:REPORTS]-(reporter) WHERE reporter.influence > $cutoff RETURN reporter.<node props>` — **no `DISTINCT`, no aggregation**, so it already returns **one row per matched `REPORTS` edge**. The list is *already* report-centric; binding the relationship to add `report_type`/`timestamp` does **not change row cardinality**.
- Edges are created with `report_type` as part of the composite MERGE key and `r.timestamp = created_at` (seconds) `ON CREATE` (`apocCypherCommands/apocCypherCommand1_reportsToAddToNeo4j:22-23`, `kind1984EventsToReports.js:95-104`). Multiple distinct report types per pair → multiple edges, by design.
- `ui/src/hooks/useGrapevineReporters.js:31` passes `json.data` straight through, so new response fields flow to the page rows with no hook change.
- `DataTable` (`ui/src/components/DataTable.jsx:35-43`) sorts on `a[sortKey] ?? ''` via `String(...).localeCompare(…, {numeric:true})`. It has **no way to (a) sort a column by a value different from what it renders, or (b) put missing values last in both directions** — `?? ''` makes nulls sort *first* ascending. **16 files** consume `DataTable`, so any change must be strictly backward-compatible.
- No shared time-ago helper exists (≈15 inline copies); all are **single-unit** ("3d ago"), so none matches the required **multi-unit** format anyway.
- The profile badge is `count(f)` over verified `REPORTS` edges (`calculateVerifiedReporterCounts.sh`) → counts **reports**, not distinct reporters. So today badge ≈ row count; the summary's distinct-reporter figure is new. Relabeling/reconciling the badge is **out of scope** (story).

**Constraints:** JS-without-build (no new lint/typecheck); tokens only; House/owner PoV only (ADR 0002/0003); no concept/firmware change — `report_type`/`timestamp` are runtime Neo4j edge properties, not graph concepts (Concept Graph consulted: 34 concepts, none report-related).

## Options considered

### Option A — Additive: opt-in `sortValue` on DataTable + new pure helpers + bind the relationship *(chosen)*
- Backend: bind the edge (`<-[rel:REPORTS]-`) and return `rel.report_type AS reportType`, `rel.timestamp AS timestamp`. Cardinality unchanged.
- `DataTable`: add an **opt-in** per-column `sortValue(row)` accessor. When a column defines it, sort numerically on that value with **missing-always-last** (both directions); otherwise the existing `localeCompare` path runs **byte-for-byte unchanged**. Zero impact on the other 15 consumers.
- Two new pure utils (`timeAgo.js`, `reportType.js`) — independently unit-testable.
- Page: two columns, new defaults, summary line, map the two fields into rows.
- **Pros:** minimal, isolated; honors "no dedup" *by construction* (existing per-edge query); decouples display from sort cleanly; backward-compatible; gives the Tester pure functions to test.
- **Cons:** a (tiny) generic addition to shared `DataTable`. Mitigated by the opt-in gate.

### Option B — Sort without touching DataTable
Set the column `key:'timestamp'` (raw int) with a `render` that formats — the existing `localeCompare(numeric)` then sorts on the raw int already. Handle nulls by substituting a sentinel (0 / -Infinity) into the row value.
- **Pros:** no shared-component change.
- **Cons:** **fails the nulls-last-in-both-directions AC** — a sentinel sits at one end only, and flipping direction moves it to the wrong end; polluting the raw value also corrupts the displayed cell. Brittle string-compare of integers. Rejected.

### Option C — Bundle the deferred `<GrapevineList>` DRY refactor
Unify follows/followers/reporters now and add the columns to the shared component.
- **Cons:** refactors live, prod-adjacent pages — regression risk and scope creep; explicitly deferred by ADR 0002/0003. Rejected; remains the standing follow-up.

## Decision
**Option A.** Additive, isolated, backward-compatible. The "one row per report, no dedup" requirement falls out of the existing per-edge query for free; the only shared-code change is an opt-in `sortValue` accessor on `DataTable` that leaves every current caller untouched.

## Consequences
- **Enables** report type + recency per row, raw-integer sorting, and the reporter/report summary.
- **`DataTable` gains** a small, documented, opt-in sort accessor — useful for future columns; no behavior change unless a column opts in.
- **Row cardinality is unchanged** vs. today — the page was already one-row-per-edge; we only enrich rows. Any duplicate-edge bug in neo4j stays visible (intended).
- **Badge vs. summary:** today the profile badge counts edges (≈ reports = M). The summary's "N reporters" is new context, and the page is forward-compatible if the badge is later redefined. Badge unchanged here.
- **Two new util files** (multi-unit time-ago, report-type label) — deliberately *not* a refactor of the ~15 inline single-unit helpers (different format, out of scope; note as follow-up).
- **Firmware reinstall required?** No.

## Implementation notes

**Backend — `src/api/grapevineInteractions/queries/reportersWithMetrics.js`:**
- Cypher: `MATCH (observee:NostrUser {pubkey:$observee})<-[rel:REPORTS]-(reporter:NostrUser) WHERE reporter.influence > $cutoff RETURN reporter.pubkey AS pubkey, …existing node props…, rel.report_type AS reportType, rel.timestamp AS timestamp`.
- In the `.map`, add `reportType: r.get('reportType') ?? null` and `timestamp: toInt(r.get('timestamp'))` (neo4j Integer → JS number; seconds). `count: data.length` unchanged.

**New `ui/src/utils/timeAgo.js`** — `export function formatTimeAgo(unixSeconds, now = Math.floor(Date.now()/1000))`:
- Missing/non-finite input → `''`.
- `delta = max(0, now - unixSeconds)` seconds; decompose into y(365d)/d/h/m (integer); **drop all zero units**, take the **3 most-significant** remaining, join with `, `, append `' ago'` → e.g. `3d, 4h, 12m ago`, `2y, 14d, 3h ago`, `45m ago`.
- Sub-minute (no non-zero unit) → `'0m ago'`.

**New `ui/src/utils/reportType.js`** — `export function humanizeReportType(t)`: `''` if falsy; optional override map (empty for now, e.g. future `csam → CSAM`); else capitalize first letter (`spam → Spam`, `impersonation → Impersonation`).

**`ui/src/components/DataTable.jsx`** — in the `sorted` memo, look up the active column (`columns.find(c => c.key === sortKey)`); if it has a `sortValue` function, sort via that accessor with missing-always-last + numeric compare; else the **existing** path verbatim. Add `columns` to the memo deps. Document `sortValue` in the JSDoc.
```js
const col = columns.find(c => c.key === sortKey);
const accessor = col && typeof col.sortValue === 'function' ? col.sortValue : null;
if (accessor) {
  return [...filtered].sort((a, b) => {
    const av = accessor(a), bv = accessor(b);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;      // missing last, regardless of sortDir
    if (bv == null) return -1;
    return sortDir === 'asc' ? av - bv : bv - av;
  });
}
// …unchanged localeCompare path…
```

**`ui/src/pages/BrainstormReporters.jsx`:**
- Import `formatTimeAgo`, `humanizeReportType`.
- `ALL_COLUMNS`: add `{ key:'reportType', label:'Report Type', render: v => humanizeReportType(v) }` and `{ key:'timestamp', label:'Reported', sortValue: row => row.timestamp, render: v => (v == null ? '' : formatTimeAgo(v)) }`. (Order them after `name` so the chooser reads naturally.)
- `DEFAULT_VISIBLE`: `{ picture:true, reportType:true, rank:true, name:false, timestamp:false, npub:false, hops:false, verified*Count:false }`.
- `rows` memo: add `reportType: f.reportType ?? null`, `timestamp: (f.timestamp == null ? null : Number(f.timestamp))`. Keep the default rank-desc sort.
- **Summary line** (when `rows.length > 0`): `reportCount = rows.length`; `reporterCount = new Set(rows.map(r => r.pubkey)).size`; render `"<N> reporter(s), <M> report(s)"` (correct singular/plural) below the PoV line. Computed from the full `rows` (independent of the search box). Optional `.bsp-follows-summary` class in `ui/src/styles.css`.
- Build: `npm run build` in `ui/`.

## Out of scope
- Changing/relabeling the profile count badge (counts edges today); reconciling badge vs. summary.
- Refactoring the ~15 inline time-ago helpers; the `<GrapevineList>` DRY unification (standing follow-up).
- Filtering/grouping by report type (Phase 2 breakdown); pile-on (Phase 3); personalized PoV.
- Live-ticking the "ago" text; absolute-time tooltips.
