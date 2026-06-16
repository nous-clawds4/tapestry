/**
 * Tests for Story 9: Search-results URL routing.
 * ADR: engineering-team/decisions/0008-search-results-url.md
 *
 * Intentionally failing until the feature is implemented.
 * Hand-rolled in the project's existing source-pattern style — no new
 * framework. Same approach as test/search-result-parity.test.js (Story 8)
 * uses for UI source-pattern assertions.
 *
 * Layer: source-pattern assertions on ui/src/pages/BrainstormSearch.jsx.
 * The project's Node test runner can't directly require JSX, so we read
 * the source and verify the ADR-specified code lands at the right places.
 *
 * Companion: tests/brainstorm/search-results-url.spec.js (Playwright)
 * covers structural URL behavior — the visible side of "the URL changed
 * when I pressed Enter."
 *
 * What ADR-0008 specifies in code terms:
 *   1. `useSearchParams` AND `useNavigate` are imported from react-router-dom.
 *   2. `useSearchParams()` is called inside the component (URL → state).
 *   3. An effect reads the URL's `q` param and triggers `doSearch` when
 *      it changes (mount-side hydration).
 *   4. The submit pathway calls `setSearchParams` (URL push on Enter).
 *   5. POV-picker click handlers conditionally call `setSearchParams`
 *      when a query is active (POV-change → URL push when on results).
 */

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const SEARCH_PATH = path.join(REPO, 'ui/src/pages/BrainstormSearch.jsx');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

/* ─── 1. Router hooks imported ─── */

t('useSearchParams is imported from react-router-dom', () => {
  const src = fs.readFileSync(SEARCH_PATH, 'utf8');
  assert(
    /import\s*\{[^}]*\buseSearchParams\b[^}]*\}\s*from\s*['"]react-router-dom['"]/.test(src),
    'BrainstormSearch.jsx must import useSearchParams from react-router-dom (per ADR-0008 Implementation Notes step 1).'
  );
});

t('useNavigate is imported from react-router-dom', () => {
  const src = fs.readFileSync(SEARCH_PATH, 'utf8');
  assert(
    /import\s*\{[^}]*\buseNavigate\b[^}]*\}\s*from\s*['"]react-router-dom['"]/.test(src),
    'BrainstormSearch.jsx must import useNavigate from react-router-dom (per ADR-0008 Implementation Notes step 1).'
  );
});

/* ─── 2. Hooks invoked inside the component ─── */

t('useSearchParams is called (URL search-params state is derived)', () => {
  const src = fs.readFileSync(SEARCH_PATH, 'utf8');
  // Look for a destructuring assignment from useSearchParams().
  assert(
    /(?:const|let)\s*\[\s*searchParams\s*,\s*setSearchParams\s*\]\s*=\s*useSearchParams\(\s*\)/.test(src),
    'BrainstormSearch.jsx must call useSearchParams() and destructure [searchParams, setSearchParams] — per ADR-0008 Implementation Notes step 1.'
  );
});

t('useNavigate is called (navigation pathway available)', () => {
  const src = fs.readFileSync(SEARCH_PATH, 'utf8');
  assert(
    /\bnavigate\s*=\s*useNavigate\(\s*\)/.test(src),
    'BrainstormSearch.jsx must call useNavigate() — per ADR-0008 Implementation Notes step 1.'
  );
});

/* ─── 3. Mount-side hydration: URL q → doSearch ─── */

t('the component reads "q" from searchParams (URL is the source of truth for query)', () => {
  const src = fs.readFileSync(SEARCH_PATH, 'utf8');
  // The component must read searchParams.get('q') somewhere — that's the
  // derived URL query. Tolerant on the variable name (urlQuery, q, etc.).
  assert(
    /searchParams\.get\(\s*['"]q['"]\s*\)/.test(src),
    'BrainstormSearch.jsx must read searchParams.get(\'q\') — the URL is the source of truth for the committed query (per ADR-0008 Implementation Notes step 2).'
  );
});

t('an effect triggers doSearch when the URL query changes (mount-side hydration)', () => {
  const src = fs.readFileSync(SEARCH_PATH, 'utf8');
  // Look for a useEffect that references both `doSearch` and the URL
  // query (either `searchParams.get('q')` or a derived variable).
  // The simplest assertion: there exists a useEffect block (bounded by
  // [...] deps) that calls doSearch AND references searchParams or a
  // urlQuery-style variable.
  const effects = src.match(/useEffect\(\s*\(\)\s*=>\s*\{[\s\S]{0,1200}?\}\s*,\s*\[[^\]]*\]/g) || [];
  const hasHydrationEffect = effects.some((e) =>
    e.includes('doSearch') &&
    (e.includes("searchParams.get('q')") || e.includes('searchParams.get("q")') || e.includes('urlQuery'))
  );
  assert(
    hasHydrationEffect,
    'BrainstormSearch.jsx must have a useEffect that reads the URL query and triggers doSearch (mount-side hydration — per ADR-0008 Implementation Notes step 3). Lets a recipient land on /?q=... directly and see results without re-typing.'
  );
});

/* ─── 4. Enter-submit pushes URL ─── */

t('setSearchParams is called (URL push pathway exists)', () => {
  const src = fs.readFileSync(SEARCH_PATH, 'utf8');
  assert(
    /\bsetSearchParams\s*\(/.test(src),
    'BrainstormSearch.jsx must call setSearchParams at least once — Enter-submit and POV-change push the URL (per ADR-0008 Implementation Notes steps 4 + 5).'
  );
});

t('setSearchParams is called from at least TWO call sites (submit + POV-change)', () => {
  const src = fs.readFileSync(SEARCH_PATH, 'utf8');
  const occurrences = (src.match(/setSearchParams\s*\(/g) || []).length;
  assert(
    occurrences >= 2,
    `setSearchParams must appear in at least 2 call sites (Enter-submit + POV-change-while-query-active per ADR-0008). Found ${occurrences}.`
  );
});

/* ─── 5. POV-picker handlers conditionally push URL ─── */

t('POV-picker click handlers reference setSearchParams (POV-change pushes URL when query is active)', () => {
  const src = fs.readFileSync(SEARCH_PATH, 'utf8');
  // The four POV-picker click handlers each call setPov + setPovSwitching;
  // after the change, they must conditionally setSearchParams. We assert
  // that at least one handler block contains both setPov AND setSearchParams
  // within a reasonable window.
  //
  // Look for "setPov(" followed within ~600 chars by "setSearchParams(".
  // Multiple handlers exist; we just need at least one to match.
  const m = src.match(/setPov\s*\(\s*['"][\w]+['"]\s*\)[\s\S]{0,600}?setSearchParams\s*\(/);
  assert(
    m,
    'At least one POV-picker click handler must call setSearchParams after setPov — POV-change while a query is active must push the new URL (per ADR-0008 Implementation Notes step 5).'
  );
});

/* ─── Run ─── */

async function run() {
  console.log('\n--- search-results-url tests (Story 9) ---');
  let pass = 0, fail = 0;
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`  PASS  ${name}`);
      pass++;
    } catch (err) {
      console.log(`  FAIL  ${name}\n        ${err.message}`);
      fail++;
    }
  }
  console.log(`\nsearch-results-url: ${pass} passed, ${fail} failed`);
  return { pass, fail };
}

if (require.main === module) {
  run()
    .then(({ fail }) => process.exit(fail === 0 ? 0 : 1))
    .catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
