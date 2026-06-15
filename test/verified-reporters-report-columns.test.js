/**
 * Story verified-reporters #4: Report Type + Reported (timestamp) columns on the
 * Verified Reporters list page.
 * ADR 0004 (verified-reporters). See
 * engineering-team/stories/verified-reporters/4-reporters-report-type-and-timestamp-columns.test-plan.md
 *
 * TWO TIERS in this one suite:
 *
 *  A. REAL behavioral unit tests (executed) for the two NEW pure helpers —
 *     ui/src/utils/timeAgo.js (formatTimeAgo) and ui/src/utils/reportType.js
 *     (humanizeReportType). ui/ is an ES module package ("type":"module"), so the
 *     CJS harness loads them via dynamic import(). Pre-implementation the files do
 *     not exist, so loadEsm() returns null and T1–T9 FAIL with a descriptive message;
 *     once written, they execute and assert the actual output (e.g. "3d, 4h, 12m ago").
 *
 *  B. SOURCE-REGEX sentinels for the endpoint, the shared DataTable, and the page —
 *     ESM React that the CJS harness cannot execute (the established precedent:
 *     test/verified-reporters-list-page.test.js). T10–T22 FAIL now (the additive
 *     changes are absent) and PASS once implemented per ADR 0004.
 *
 *  R1–R4 are REGRESSION sentinels — they PASS before AND after (they guard the
 *  untouched follows/followers pages, the preserved DataTable default sort path, the
 *  Story-2 endpoint contract, and the unchanged reporters hook).
 *
 * FALSE-POSITIVE AVOIDANCE: BrainstormFollowers.jsx already contains a "Verified
 * Reporters" COLUMN (verifiedReporterCount) and the word "reporters"; the reporters
 * page already says "reported". Every new sentinel targets strings/keys that do NOT
 * exist pre-implementation — formatTimeAgo, humanizeReportType, key:'reportType',
 * label 'Reported', sortValue, `new Set(` for the distinct-reporter summary, and the
 * new DEFAULT_VISIBLE (reportType:true / name:false).
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const TIMEAGO    = path.resolve(__dirname, '../ui/src/utils/timeAgo.js');
const REPORTTYPE = path.resolve(__dirname, '../ui/src/utils/reportType.js');
const HANDLER    = path.resolve(__dirname, '../src/api/grapevineInteractions/queries/reportersWithMetrics.js');
const DATATABLE  = path.resolve(__dirname, '../ui/src/components/DataTable.jsx');
const PAGE       = path.resolve(__dirname, '../ui/src/pages/BrainstormReporters.jsx');
const FOLLOWERS  = path.resolve(__dirname, '../ui/src/pages/BrainstormFollowers.jsx');
const FOLLOWS    = path.resolve(__dirname, '../ui/src/pages/BrainstormFollows.jsx');
const HOOK       = path.resolve(__dirname, '../ui/src/hooks/useGrapevineReporters.js');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
async function loadEsm(absPath) {
  try { return await import(pathToFileURL(absPath).href); }
  catch { return null; }
}

// A fixed "now" so the relative-time assertions are deterministic.
const NOW = 1_700_000_000;
const MIN = 60, HOUR = 3600, DAY = 86400, YEAR = 365 * DAY;

// ===========================================================================
// A. PURE HELPERS — executed (real behavior), ui ESM via dynamic import
// ===========================================================================

test('T1: formatTimeAgo renders the multi-unit headline format "3d, 4h, 12m ago" (AC: Reported display)', async () => {
  const mod = await loadEsm(TIMEAGO);
  assert(mod && typeof mod.formatTimeAgo === 'function',
    'ui/src/utils/timeAgo.js must exist and export `formatTimeAgo(unixSeconds, now?)` (ADR 0004 §Impl). It is absent pre-implementation.');
  const got = mod.formatTimeAgo(NOW - (3 * DAY + 4 * HOUR + 12 * MIN), NOW);
  assert(got === '3d, 4h, 12m ago', `expected "3d, 4h, 12m ago", got "${got}"`);
});

test('T2: formatTimeAgo shows the 3 most-significant units (years..minutes), dropping the rest', async () => {
  const mod = await loadEsm(TIMEAGO);
  assert(mod && typeof mod.formatTimeAgo === 'function', 'ui/src/utils/timeAgo.js must export formatTimeAgo.');
  const got = mod.formatTimeAgo(NOW - (2 * YEAR + 14 * DAY + 3 * HOUR + 5 * MIN), NOW);
  assert(got === '2y, 14d, 3h ago', `with y/d/h/m all present, expected the top 3 → "2y, 14d, 3h ago", got "${got}"`);
});

test('T3: formatTimeAgo drops zero-valued units (interior zeros are not shown)', async () => {
  const mod = await loadEsm(TIMEAGO);
  assert(mod && typeof mod.formatTimeAgo === 'function', 'ui/src/utils/timeAgo.js must export formatTimeAgo.');
  const got = mod.formatTimeAgo(NOW - (1 * DAY + 5 * MIN), NOW); // 1d 0h 5m
  assert(got === '1d, 5m ago', `the 0h unit must be dropped → "1d, 5m ago", got "${got}"`);
});

test('T4: formatTimeAgo renders a single unit when only one is non-zero ("3d ago")', async () => {
  const mod = await loadEsm(TIMEAGO);
  assert(mod && typeof mod.formatTimeAgo === 'function', 'ui/src/utils/timeAgo.js must export formatTimeAgo.');
  const got = mod.formatTimeAgo(NOW - 3 * DAY, NOW);
  assert(got === '3d ago', `expected "3d ago", got "${got}"`);
});

test('T5: formatTimeAgo renders "0m ago" for sub-minute and zero deltas (minute is the smallest unit)', async () => {
  const mod = await loadEsm(TIMEAGO);
  assert(mod && typeof mod.formatTimeAgo === 'function', 'ui/src/utils/timeAgo.js must export formatTimeAgo.');
  assert(mod.formatTimeAgo(NOW - 30, NOW) === '0m ago', `30s ago should render "0m ago", got "${mod.formatTimeAgo(NOW - 30, NOW)}"`);
  assert(mod.formatTimeAgo(NOW, NOW) === '0m ago', `a zero delta should render "0m ago", got "${mod.formatTimeAgo(NOW, NOW)}"`);
});

test('T6: formatTimeAgo returns "" for missing/invalid input (AC: absent timestamp → empty cell)', async () => {
  const mod = await loadEsm(TIMEAGO);
  assert(mod && typeof mod.formatTimeAgo === 'function', 'ui/src/utils/timeAgo.js must export formatTimeAgo.');
  for (const bad of [null, undefined, NaN]) {
    const got = mod.formatTimeAgo(bad, NOW);
    assert(got === '', `a missing/invalid timestamp (${String(bad)}) must render "" (empty cell), got "${got}"`);
  }
});

test('T7: formatTimeAgo clamps future timestamps to "0m ago" (no negative durations)', async () => {
  const mod = await loadEsm(TIMEAGO);
  assert(mod && typeof mod.formatTimeAgo === 'function', 'ui/src/utils/timeAgo.js must export formatTimeAgo.');
  const got = mod.formatTimeAgo(NOW + 5000, NOW);
  assert(got === '0m ago', `a future timestamp must clamp to "0m ago", got "${got}"`);
});

test('T8: humanizeReportType converts NIP-56 tokens to friendly labels (spam → Spam, impersonation → Impersonation)', async () => {
  const mod = await loadEsm(REPORTTYPE);
  assert(mod && typeof mod.humanizeReportType === 'function',
    'ui/src/utils/reportType.js must exist and export `humanizeReportType(token)` (ADR 0004 §Impl). It is absent pre-implementation.');
  const cases = { spam: 'Spam', impersonation: 'Impersonation', nudity: 'Nudity', other: 'Other', unspecified: 'Unspecified' };
  for (const [tok, label] of Object.entries(cases)) {
    const got = mod.humanizeReportType(tok);
    assert(got === label, `humanizeReportType("${tok}") should be "${label}", got "${got}"`);
  }
});

test('T9: humanizeReportType returns "" for missing/empty input (AC: absent report_type → empty cell)', async () => {
  const mod = await loadEsm(REPORTTYPE);
  assert(mod && typeof mod.humanizeReportType === 'function', 'ui/src/utils/reportType.js must export humanizeReportType.');
  for (const bad of ['', null, undefined]) {
    const got = mod.humanizeReportType(bad);
    assert(got === '', `a missing report_type (${String(bad)}) must render "" (empty cell), got "${got}"`);
  }
});

// ===========================================================================
// B. ENDPOINT — reportersWithMetrics.js surfaces report_type + timestamp per edge
// ===========================================================================

test('T10: the query BINDS the :REPORTS relationship (so its properties can be returned)', () => {
  const src = safeRead(HANDLER);
  assert(src.length > 0, 'reportersWithMetrics.js missing — unexpected (Story 2 created it).');
  assert(/\[\s*[A-Za-z_]\w*\s*:REPORTS\s*\]/.test(src),
    'the Cypher must bind the REPORTS edge to a variable (e.g. `<-[rel:REPORTS]-`) so rel.report_type / rel.timestamp can be RETURNed. Today it is the anonymous `[:REPORTS]` — bind it (ADR 0004 §Impl).');
});

test('T11: the query RETURNs report_type + timestamp and the handler maps them (timestamp via toInt) (AC: Report Type & Reported data)', () => {
  const src = safeRead(HANDLER);
  assert(src.length > 0, 'reportersWithMetrics.js missing — unexpected.');
  assert(/\.report_type\s+AS\s+reportType/i.test(src),
    'the Cypher RETURN must surface the edge property `rel.report_type AS reportType` (ADR 0004 §Impl).');
  assert(/\.timestamp\s+AS\s+timestamp/i.test(src),
    'the Cypher RETURN must surface the edge property `rel.timestamp AS timestamp` (ADR 0004 §Impl).');
  assert(/r\.get\(\s*['"]reportType['"]\s*\)/.test(src),
    'the record .map must read reportType (r.get("reportType")) into each row.');
  assert(/toInt\(\s*r\.get\(\s*['"]timestamp['"]\s*\)\s*\)/.test(src),
    'the record .map must read timestamp through toInt (neo4j Integer → JS number, unix seconds): toInt(r.get("timestamp")).');
});

test('T12: the query does NOT de-duplicate or aggregate — one row per REPORTS edge is preserved (AC: one row per report, no dedup)', () => {
  const src = safeRead(HANDLER);
  assert(src.length > 0, 'reportersWithMetrics.js missing — unexpected.');
  assert(!/\bDISTINCT\b/i.test(src),
    'the query must NOT add DISTINCT — the page is report-centric (one row per REPORTS edge). De-dup is neo4j\'s job; collapsing here would hide duplicate-edge bugs (ADR 0004 Decision).');
  assert(!/\bcollect\s*\(/i.test(src) && !/count\s*\(\s*[A-Za-z_]/.test(src),
    'the query must NOT aggregate reporters (no collect()/count() over the edge) — that would merge multiple reports into one row.');
});

// ===========================================================================
// C. DATATABLE — opt-in sortValue accessor with missing-last, existing path kept
// ===========================================================================

test('T13: DataTable supports an opt-in per-column `sortValue` accessor (sort by a raw value, decoupled from render) (AC: sort by raw timestamp)', () => {
  const src = safeRead(DATATABLE);
  assert(src.length > 0, 'DataTable.jsx missing — unexpected.');
  assert(/sortValue/.test(src),
    'DataTable must honor a per-column `sortValue` accessor so the Reported column can sort by the raw unix integer while rendering "ago" text (ADR 0004 §Impl). Absent today.');
});

test('T14: DataTable sorts missing values LAST regardless of direction (AC: empty timestamps sort to the bottom both ways)', () => {
  const src = safeRead(DATATABLE);
  assert(src.length > 0, 'DataTable.jsx missing — unexpected.');
  assert(/==\s*null/.test(src),
    'the sortValue path must detect missing values (== null) to push them last.');
  assert(/return\s+1\b/.test(src) && /return\s+-1\b/.test(src),
    'missing values must return a FIXED order (e.g. `return 1` / `return -1`) BEFORE the asc/desc flip, so they always sort to the bottom in BOTH directions (ADR 0004 §Impl). The current localeCompare path has no such branch.');
});

test('T15: DataTable PRESERVES the existing localeCompare(numeric) path for all other columns (regression — 16 consumers)', () => {
  const src = safeRead(DATATABLE);
  assert(src.length > 0, 'DataTable.jsx missing — unexpected.');
  assert(/localeCompare\([\s\S]*?numeric:\s*true/.test(src),
    'the default (no-sortValue) sort path must remain String(...).localeCompare(..., {numeric:true}) so the other 15 DataTable consumers are byte-for-byte unaffected (ADR 0004 Option A).');
});

// ===========================================================================
// D. PAGE — BrainstormReporters: columns, defaults, summary, row fields
// ===========================================================================

test('T16: the page imports the two new helpers (formatTimeAgo, humanizeReportType)', () => {
  const src = safeRead(PAGE);
  assert(src.length > 0, 'BrainstormReporters.jsx missing — unexpected (Story 3 created it).');
  assert(/utils\/timeAgo/.test(src) && /formatTimeAgo/.test(src),
    'the page must import formatTimeAgo from ../utils/timeAgo (ADR 0004 §Impl).');
  assert(/utils\/reportType/.test(src) && /humanizeReportType/.test(src),
    'the page must import humanizeReportType from ../utils/reportType (ADR 0004 §Impl).');
});

test('T17: the page defines a Report Type column (key reportType, label "Report Type", humanized render)', () => {
  const src = safeRead(PAGE);
  assert(src.length > 0, 'BrainstormReporters.jsx missing — unexpected.');
  assert(/key:\s*['"]reportType['"]/.test(src), 'ALL_COLUMNS must include a column with key:"reportType".');
  assert(/Report Type/.test(src), 'the Report Type column must be labeled "Report Type".');
  assert(/humanizeReportType\s*\(/.test(src), 'the Report Type cell must render via humanizeReportType(...) (friendly label).');
});

test('T18: the page defines a Reported column (key timestamp, label "Reported", sortValue + formatTimeAgo render)', () => {
  const src = safeRead(PAGE);
  assert(src.length > 0, 'BrainstormReporters.jsx missing — unexpected.');
  assert(/key:\s*['"]timestamp['"]/.test(src), 'ALL_COLUMNS must include a column with key:"timestamp".');
  assert(/['"]Reported['"]/.test(src), 'the timestamp column must be labeled "Reported".');
  assert(/sortValue/.test(src), 'the Reported column must declare a `sortValue` accessor (sort by the raw unix integer).');
  assert(/formatTimeAgo\s*\(/.test(src), 'the Reported cell must render via formatTimeAgo(...) ("ago" text).');
});

test('T19: the Reported cell renders empty for a missing timestamp (AC: absent field → empty cell)', () => {
  const src = safeRead(PAGE);
  assert(src.length > 0, 'BrainstormReporters.jsx missing — unexpected.');
  assert(/==\s*null\s*\?\s*''/.test(src),
    'a missing timestamp must render "" (e.g. `v == null ? \'\' : formatTimeAgo(v)`), not "undefined"/"NaN ago" (ADR 0004 §Impl).');
});

test('T20: DEFAULT_VISIBLE is Picture/Report Type/Rank — Name and Reported are NOT default (AC: default columns change)', () => {
  const src = safeRead(PAGE);
  assert(src.length > 0, 'BrainstormReporters.jsx missing — unexpected.');
  const m = src.match(/const\s+DEFAULT_VISIBLE\s*=\s*\{[\s\S]*?\}/);
  assert(m, 'DEFAULT_VISIBLE object not found in BrainstormReporters.jsx.');
  const block = m[0];
  assert(/picture:\s*true/.test(block), 'DEFAULT_VISIBLE.picture must be true.');
  assert(/reportType:\s*true/.test(block), 'DEFAULT_VISIBLE.reportType must be true (Report Type is now a default column).');
  assert(/rank:\s*true/.test(block), 'DEFAULT_VISIBLE.rank must be true.');
  assert(/name:\s*false/.test(block), 'DEFAULT_VISIBLE.name must be false — Name is dropped from the default view (still toggleable).');
  assert(/timestamp:\s*false/.test(block), 'DEFAULT_VISIBLE.timestamp must be false — Reported is available but not shown by default.');
});

test('T21: the page shows a "N reporters, M reports" summary (distinct reporters via Set, total reports = rows) (AC: summary line)', () => {
  const src = safeRead(PAGE);
  assert(src.length > 0, 'BrainstormReporters.jsx missing — unexpected.');
  assert(/new Set\(/.test(src),
    'the summary must count DISTINCT reporters via `new Set(...)` over the row pubkeys (this is how N differs from M; absent today).');
  assert(/new Set\([\s\S]{0,60}pubkey/.test(src),
    'the distinct-reporter Set must be built from the row pubkeys (e.g. new Set(rows.map(r => r.pubkey))).');
  assert(/\breports\b/.test(src),
    'the summary must render the "reports" label (the "M reports" half of "N reporters, M reports").');
});

test('T22: each row carries reportType + timestamp from the hook data', () => {
  const src = safeRead(PAGE);
  assert(src.length > 0, 'BrainstormReporters.jsx missing — unexpected.');
  assert(/reportType:/.test(src), 'the rows builder must set reportType on each row (from the endpoint field).');
  assert(/timestamp:/.test(src), 'the rows builder must set timestamp on each row (from the endpoint field).');
});

// ===========================================================================
// R. REGRESSION SENTINELS (must PASS before AND after implementation)
// ===========================================================================

test('R1: BrainstormFollowers default columns are untouched — still Picture/Name/Rank, no reportType (regression)', () => {
  const src = safeRead(FOLLOWERS);
  assert(src.length > 0, 'BrainstormFollowers.jsx missing — unexpected.');
  const m = src.match(/const\s+DEFAULT_VISIBLE\s*=\s*\{[\s\S]*?\}/);
  assert(m, 'followers DEFAULT_VISIBLE not found.');
  assert(/name:\s*true/.test(m[0]),
    'the followers page must STILL default Name on (Picture/Name/Rank). The reporters default change must not bleed into followers.');
  assert(!/reportType/.test(m[0]),
    'the followers DEFAULT_VISIBLE must not gain a reportType column.');
});

test('R2: BrainstormFollows default columns are untouched — still Picture/Name/Rank (regression)', () => {
  const src = safeRead(FOLLOWS);
  assert(src.length > 0, 'BrainstormFollows.jsx missing — unexpected.');
  const m = src.match(/const\s+DEFAULT_VISIBLE\s*=\s*\{[\s\S]*?\}/);
  assert(m, 'follows DEFAULT_VISIBLE not found.');
  assert(/name:\s*true/.test(m[0]),
    'the follows page must STILL default Name on (Picture/Name/Rank).');
});

test('R3: the endpoint keeps the Story-2 contract — count:data.length and observer:\'owner\' (regression)', () => {
  const src = safeRead(HANDLER);
  assert(src.length > 0, 'reportersWithMetrics.js missing — unexpected.');
  assert(/count\s*:\s*data\.length/.test(src),
    'the additive change must not break `count: data.length` (Story 2 / ADR 0002).');
  assert(/observer\s*:\s*['"]owner['"]/.test(src),
    "the response must still report observer:'owner' (v1 House/owner PoV).");
});

test('R4: useGrapevineReporters is unchanged — still fetches the reporters endpoint and passes data through (regression)', () => {
  const src = safeRead(HOOK);
  assert(src.length > 0, 'useGrapevineReporters.js missing — unexpected.');
  assert(/get-grapevine-reporters/.test(src),
    'the hook must still call /api/get-grapevine-reporters (new fields flow through json.data — no hook change needed, ADR 0004).');
  assert(/setData\(/.test(src),
    'the hook must still surface the endpoint data array unchanged.');
});

async function run() {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`  ✓ ${t.name}`);
      pass++;
    } catch (err) {
      console.log(`  ✗ ${t.name}`);
      console.log(`      ${err.message}`);
      fail++;
    }
  }
  return { pass, fail };
}

module.exports = { run };
