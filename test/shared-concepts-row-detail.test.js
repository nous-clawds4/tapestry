/**
 * shared-concepts-row-detail #1: row detail panels on the Active …-tags pages.
 *
 * Story: engineering-team/stories/shared-concepts-row-detail/1-row-detail-panels-on-active-tag-pages.md
 * ADR:   engineering-team/decisions/shared-concepts-row-detail/0001-row-detail-panels-on-active-tag-pages.md
 *
 * Classes (house pattern; cf. test/curated-dlist-update-update-preview.test.js):
 *   S (structure) — the shape the ADR's Implementation notes require, read off source. The three
 *                   surfaces are JSX and cannot be imported without a transform, so the behavioural
 *                   half of this story lives in tests/brainstorm/shared-concepts-row-detail.spec.js
 *                   (Playwright). What S pins is what Playwright cannot see: that DataTable's new
 *                   branches are STRICTLY opt-in for the other 23 callers, and that the app-wide
 *                   .text-muted fix edited CSS only. FAIL now.
 *   D (docs)      — the ADR and story record the owner's Architecture-gate scope amendment. PASS now
 *                   (they were written at that gate); here so a later edit cannot quietly drop it.
 *   R (sentinel)  — facts this story must NOT change. PASS before and after. If an R test ever fails,
 *                   the change went further than the story asked.
 *
 * Not covered here — all of it in the Playwright spec: opening and closing a panel, panel
 * independence between rows, what actually reaches the clipboard, what the filter box actually
 * matches, the muted colour as computed by a browser, and the surviving row-click navigation.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const UI = path.join(ROOT, 'ui/src');
const DATATABLE = path.join(UI, 'components/DataTable.jsx');
const B_PAGE = path.join(UI, 'pages/shared-concepts/ActiveBTags.jsx');
const Z_PAGE = path.join(UI, 'pages/shared-concepts/ActiveZTags.jsx');
const STYLES = path.join(UI, 'styles.css');
// The D-class docs live under engineering-team/<kind>/<epic>/ while the epic is in flight and move
// to <kind>/done/<epic>/ at book close. These assertions are about what the documents SAY, not where
// they sit, so resolve either location — otherwise closing the book breaks its own suite, which is
// exactly what happened on the first attempt (book close 2026-09-20, step 10).
function epicDoc(kind, file) {
  for (const rel of [`engineering-team/${kind}/shared-concepts-row-detail/${file}`,
                     `engineering-team/${kind}/done/shared-concepts-row-detail/${file}`]) {
    const abs = path.join(ROOT, rel);
    if (fs.existsSync(abs)) return abs;
  }
  return path.join(ROOT, `engineering-team/${kind}/shared-concepts-row-detail/${file}`); // for the error message
}
const ADR = epicDoc('decisions', '0001-row-detail-panels-on-active-tag-pages.md');
const STORY = epicDoc('stories', '1-row-detail-panels-on-active-tag-pages.md');

function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function rel(p) { return path.relative(ROOT, p); }
const flat = (s) => s.replace(/\s+/g, ' ');
function src(p) {
  const s = safeRead(p);
  assert(s.length > 0, `${rel(p)} must exist`);
  return s;
}

/** The text of a `useMemo(() => { … }, [deps])` whose body mentions `marker`. */
function memoContaining(s, marker) {
  const idx = s.indexOf(marker);
  if (idx < 0) return '';
  const start = s.lastIndexOf('useMemo(', idx);
  if (start < 0) return '';
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') { depth--; if (depth === 0) return s.slice(start, i + 1); }
  }
  return '';
}

/** Local import specifiers of a JSX source, as written. */
function importPaths(s) {
  return [...s.matchAll(/^\s*import\s+[^;]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
}

/** The single component both pages import from ui/src/components — the shared panel. */
function sharedPanelFile() {
  const resolve = (from, spec) => {
    if (!spec.startsWith('.')) return null;
    const abs = path.resolve(path.dirname(from), spec);
    for (const cand of [abs, `${abs}.jsx`, `${abs}.js`]) {
      if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand;
    }
    return null;
  };
  const b = new Set(importPaths(safeRead(B_PAGE)).map((p) => resolve(B_PAGE, p)).filter(Boolean));
  const z = new Set(importPaths(safeRead(Z_PAGE)).map((p) => resolve(Z_PAGE, p)).filter(Boolean));
  const shared = [...b].filter((f) => z.has(f));
  // The panel is the shared component that pulls in CopyButton; DataTable etc. do not.
  return shared.find((f) => /CopyButton/.test(safeRead(f))) || null;
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// ── S — structure ────────────────────────────────────────────────────────────

test('S1: DataTable accepts filterKeys (default []) and renderExpanded', () => {
  const s = flat(src(DATATABLE));
  const sig = s.match(/function DataTable\(\{([^}]*)\}/);
  assert(sig, 'DataTable must keep a destructured props signature');
  assert(/filterKeys\s*=\s*\[\]/.test(sig[1]),
    `ADR §Implementation notes: DataTable's signature must declare filterKeys with a [] default so the other 23 callers are unaffected. Got: {${sig[1].trim()}}`);
  assert(/\brenderExpanded\b/.test(sig[1]),
    `ADR §Implementation notes: DataTable's signature must declare renderExpanded. Got: {${sig[1].trim()}}`);
});

test('S2: the text filter consults filterKeys, not only the visible columns', () => {
  const s = src(DATATABLE);
  const memo = memoContaining(s, 'filter.toLowerCase()') || memoContaining(s, 'lower');
  assert(memo, 'could not locate the filtering useMemo in DataTable.jsx');
  assert(/filterKeys/.test(memo),
    'AC-5/AC-6: the filter predicate must also match row values named by filterKeys — otherwise removing the tag column removes the tag from the filter box, which is the regression this story exists to prevent');
});

test('S3: filterKeys is a dependency of the filtering memo', () => {
  const s = src(DATATABLE);
  const memo = memoContaining(s, 'filter.toLowerCase()') || memoContaining(s, 'lower');
  const deps = memo.slice(memo.lastIndexOf('['));
  assert(/filterKeys/.test(deps),
    `filterKeys must appear in the filtering memo's dependency array, or the filter goes stale when it changes. Got deps: ${deps.slice(0, 120)}`);
});

test('S4: one row-key helper serves both the React key and the expansion state', () => {
  const s = flat(src(DATATABLE));
  assert(/rowKey/.test(s),
    'ADR §Implementation notes: extract the inline row-key expression into a single `rowKey(row, i)` helper');
  assert(/key=\{\s*rowKey\(/.test(s),
    'the rendered row must take its React key from rowKey(...) — a row and its panel must not be able to disagree about identity');
  const expansionUsesRowKey = /(expanded|open)[A-Za-z]*\s*\.\s*(has|add|delete)\(\s*rowKey\(/.test(s)
    || /rowKey\([^)]*\)\s*\)/.test(s.slice(s.indexOf('renderExpanded')));
  assert(expansionUsesRowKey,
    'expansion state must be keyed by the same rowKey(...) the React key uses (ADR §Consequences, "Row identity becomes load-bearing")');
});

test('S5: the disclosure control stops propagation before toggling', () => {
  const s = flat(src(DATATABLE));
  assert(/stopPropagation\(\)/.test(s),
    'AC-7: the disclosure button must call e.stopPropagation() — without it, expanding a row on Active b-tags also fires onRowClick and navigates away (cf. ui/src/pages/lists/DListItems.jsx:550)');
});

test('S6: the panel row spans the table including the disclosure column', () => {
  const s = flat(src(DATATABLE));
  assert(/colSpan=\{\s*columns\.length\s*\+\s*1\s*\}/.test(s),
    'the expanded panel row must span columns.length + 1 (the disclosure cell), or the panel will not line up with the table');
});

test('S7: the empty-row colSpan accounts for the disclosure column', () => {
  const s = flat(src(DATATABLE));
  const empty = s.match(/colSpan=\{([^}]*)\}[^<]*className="empty-row"/)
    || s.match(/className="empty-row"[^>]*/);
  assert(empty, 'could not locate the empty-row cell in DataTable.jsx');
  const m = s.match(/<td colSpan=\{([^}]*)\} className="empty-row"/);
  assert(m && /renderExpanded/.test(m[1]),
    `the empty-row colSpan must widen when renderExpanded is set, else the "no data" cell under-spans. Got: colSpan={${m ? m[1] : '?'}}`);
});

test('S8: the header gains a cell only when renderExpanded is supplied', () => {
  const s = flat(src(DATATABLE));
  const thead = s.slice(s.indexOf('<thead>'), s.indexOf('</thead>'));
  assert(/renderExpanded/.test(thead),
    'the header row must append a cell when renderExpanded is set, so header and body column counts stay aligned');
});

test('S9: every new branch is strictly opt-in (the other 23 DataTable callers are untouched)', () => {
  const s = flat(src(DATATABLE));
  const body = s.slice(s.indexOf('<tbody>'));
  // Each disclosure-cell / panel-row emission must sit behind a renderExpanded guard.
  const guards = (body.match(/renderExpanded\s*(&&|\?)/g) || []).length;
  assert(guards >= 2,
    `ADR §Decision: omitting renderExpanded must leave the DOM byte-identical, so BOTH the disclosure cell and the panel row must sit behind a renderExpanded guard. Found ${guards} guard(s) in <tbody>`);
});

test('S10: Active b-tags retires the b-tag column, keeps it filterable, and keeps its row click', () => {
  const s = src(B_PAGE);
  const f = flat(s);
  assert(!/key:\s*'bTag'/.test(s),
    "AC-1: the b-tag column object (key: 'bTag') must be removed from ActiveBTags' columns");
  assert(/description:\s*descriptionOf\(/.test(f),
    'the row must carry the local DList Header description (AC-8: the LOCAL event, not the shared one)');
  assert(/filterKeys=\{\s*\[[^\]]*'bTag'[^\]]*\]\s*\}/.test(f),
    'AC-5: ActiveBTags must pass filterKeys including \'bTag\'');
  assert(/filterKeys=\{\s*\[[^\]]*'description'[^\]]*\]\s*\}/.test(f),
    'AC-6: ActiveBTags must pass filterKeys including \'description\'');
  assert(/renderExpanded=\{/.test(f),
    'ActiveBTags must pass renderExpanded to DataTable');
  assert(/onRowClick=\{/.test(f) && /shared-concepts\/b-tags\//.test(f),
    'AC-7: ActiveBTags must keep its existing onRowClick navigation to the b-tag pair page');
});

test('S11: Active z-tags retires the z-tag column and keeps it filterable', () => {
  const s = src(Z_PAGE);
  const f = flat(s);
  assert(!/key:\s*'uuid'/.test(s),
    "AC-1: the z-tag column object (key: 'uuid') must be removed from ActiveZTags' columns");
  assert(/description:/.test(f) && /descriptionOf\(/.test(f),
    'ActiveZTags rows must carry the concept header\'s description');
  assert(/filterKeys=\{\s*\[[^\]]*'uuid'[^\]]*\]\s*\}/.test(f),
    'AC-5: ActiveZTags must pass filterKeys including \'uuid\' (the z-tag coordinate)');
  assert(/filterKeys=\{\s*\[[^\]]*'description'[^\]]*\]\s*\}/.test(f),
    'AC-6: ActiveZTags must pass filterKeys including \'description\'');
  assert(/renderExpanded=\{/.test(f),
    'ActiveZTags must pass renderExpanded to DataTable');
});

test('S12: the panel body is one shared component, not duplicated on both pages', () => {
  const panel = sharedPanelFile();
  assert(panel,
    'ADR §Implementation notes: both pages must render the SAME panel component (a shared file under ui/src/components that imports CopyButton) rather than duplicating the markup');
  const p = flat(src(panel));
  assert(/<CopyButton/.test(p), `${rel(panel)} must render <CopyButton>`);
  assert(/overflowWrap:\s*'anywhere'/.test(p),
    `${rel(panel)} must keep the retired column's overflowWrap: 'anywhere' so a 64-hex coordinate wraps instead of overflowing`);
});

test('S13: the copy control receives the full, untruncated tag value', () => {
  const panel = sharedPanelFile();
  assert(panel, 'shared panel component not found (see S12)');
  const p = flat(src(panel));
  const m = p.match(/<CopyButton[^>]*value=\{([^}]*)\}/);
  assert(m, 'the panel must pass a value to <CopyButton>');
  assert(!/\.slice\(|\.substring\(|truncat/i.test(m[1]),
    `AC-3: CopyButton must receive the FULL tag value, not a shortened one. Got value={${m[1]}}`);
});

test('S14: .text-muted is defined once, globally, resolving to the palette variable', () => {
  const s = src(STYLES);
  const rule = s.match(/(^|\})\s*\.text-muted\s*\{([^}]*)\}/);
  assert(rule,
    'AC-10: styles.css must define a .text-muted rule — it is referenced as a className in 43 files and defined nowhere, so no muted string in the app renders muted');
  assert(/color:\s*var\(--text-muted\)/.test(rule[2]),
    `AC-10: .text-muted must resolve to var(--text-muted), the palette value it was always meant to use. Got: {${rule[2].trim()}}`);
});

test('S15: the muted-text fix touched CSS only — no call site was rewritten', () => {
  const panel = sharedPanelFile();
  const files = [B_PAGE, Z_PAGE, panel].filter(Boolean);
  for (const f of files) {
    const s = src(f);
    assert(!/color:\s*var\(--text-muted\)/.test(s),
      `ADR §Implementation notes: the fix is one CSS rule; ${rel(f)} must NOT introduce an inline color: var(--text-muted). Use className="text-muted" like every sibling surface.`);
  }
  const panelSrc = panel ? src(panel) : '';
  assert(/className="text-muted"/.test(panelSrc),
    'AC-4/AC-10: the panel\'s "no description" fallback must use className="text-muted"');
});

// ── D — docs ─────────────────────────────────────────────────────────────────

test('D1: ADR 0001 records the owner\'s Architecture-gate scope amendment', () => {
  const s = flat(src(ADR));
  assert(/Scope amendment/i.test(s) && /text-muted/.test(s),
    'ADR 0001 must record that .text-muted was brought into scope by the owner at the Architecture gate — without it the repo-wide colour change reads as scope creep at review');
});

test('D2: the story carries the muted-text criterion', () => {
  const s = flat(src(STORY));
  assert(/muted/i.test(s) && /computed colour|computed color/i.test(s),
    'the story must carry the muted-text acceptance criterion added at the Architecture gate');
});

// ── R — sentinels (pass before AND after; a failure means we went too far) ────

test('R1: both pages still render through the shared DataTable', () => {
  for (const p of [B_PAGE, Z_PAGE]) {
    assert(/from\s+['"][^'"]*components\/DataTable['"]/.test(src(p)),
      `${rel(p)} must keep using the shared DataTable — Option B (hand-rolling the table) was considered and rejected in ADR 0001`);
  }
});

test('R2: Active b-tags still skips the b-tag-deferred sentinel at row-build time', () => {
  const s = flat(src(B_PAGE));
  assert(/SENTINEL/.test(s) && /from\s+['"][^'"]*utils\/bDisposition['"]/.test(s),
    'AC-9: ActiveBTags must keep importing SENTINEL from utils/bDisposition');
  assert(/!==\s*SENTINEL/.test(s),
    'AC-9: the row-build loop must keep skipping the reserved b-tag-deferred sentinel, so it can never reach a panel (ADR shared-concepts-adoption/0001)');
});

test('R3: neither page gained a fetch — the panels use data already on the row', () => {
  // The status quo, measured: ActiveBTags scans once; ActiveZTags scans headers (:69) and
  // then the chunked z-scan inside chunkedZScan (:21). Neither may grow for this story.
  const before = { b: 1, z: 2 };
  const countScans = (s) => (s.match(/queryRelay\(/g) || []).length;
  assert(countScans(src(B_PAGE)) === before.b,
    `ADR §Context fact 1: ActiveBTags must still make exactly ${before.b} queryRelay call — the description is already on the events it fetches`);
  assert(countScans(src(Z_PAGE)) === before.z,
    `ADR §Context fact 1: ActiveZTags must still make exactly ${before.z} queryRelay call`);
});

test('R4: the z-tags page keeps its self-filed toggle and both tallies', () => {
  const s = flat(src(Z_PAGE));
  assert(/showSelfFiled/.test(s) && /sharedEvents/.test(s) && /allEvents/.test(s),
    'story §Out of scope: ActiveZTags\' self-filed toggle and its two tallies must be untouched');
});

async function run() {
  let pass = 0;
  let fail = 0;
  const failures = [];
  for (const t of tests) {
    try {
      await t.fn();
      pass++;
      console.log(`  ✅ ${t.name}`);
    } catch (e) {
      fail++;
      failures.push({ name: t.name, error: e.message });
      console.log(`  ❌ ${t.name}\n      ${e.message}`);
    }
  }
  console.log(`shared-concepts-row-detail: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures, skipped: 0 };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
