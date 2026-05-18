/**
 * Tests for Story 8: Search-result parity (popup ↔ Enter-results page).
 * ADR: engineering-team/decisions/0007-search-result-parity.md
 *
 * Intentionally failing until the feature is implemented.
 * Hand-rolled in the project's existing test style — no new framework.
 *
 * Layer: source-pattern assertions on the React component file
 * (ui/src/pages/BrainstormSearch.jsx). The project's Node test runner
 * can't directly require JSX/React modules, but it can read the source
 * and verify the changes the ADR specifies actually landed. Same
 * approach as test/scheduled-search-and-house-scores-refresh.test.js
 * uses for its UI source-pattern checks.
 *
 * What the ADR (0007) specifies in code terms:
 *   1. `sortPopupHits` is invoked from BOTH `fetchSuggestions` (popup —
 *      already there) AND `doSearch` (results page — new).
 *   2. A `useEffect` keyed on `pov` re-runs `fetchSuggestions` when
 *      the popup is the active surface (mirrors the existing
 *      results-page `prevPovRef` effect).
 *   3. A `povSwitching` state slot is declared, set to `true` on a
 *      POV-change action, and cleared (set to `false`) on fetch
 *      response and/or user-prefs write callback.
 *   4. The selector area renders a loading indicator conditional on
 *      `povSwitching`.
 *
 * The Playwright spec covers structural / DOM-level guards that
 * complement these source-level assertions.
 */

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const SEARCH_PATH = path.join(REPO, 'ui/src/pages/BrainstormSearch.jsx');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

function countMatches(haystack, needle) {
  let n = 0;
  let i = 0;
  while ((i = haystack.indexOf(needle, i)) !== -1) {
    n += 1;
    i += needle.length;
  }
  return n;
}

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

/* ─── 1. sortPopupHits is the single source of ranking truth ─── */

t('sortPopupHits is defined in BrainstormSearch.jsx (module-scope or imported)', () => {
  const src = fs.readFileSync(SEARCH_PATH, 'utf8');
  assert(
    /function\s+sortPopupHits\s*\(/.test(src) || /\bsortPopupHits\b.*from\s+['"]/.test(src),
    'sortPopupHits must be defined in BrainstormSearch.jsx (module-scope function) OR imported from a util file. ADR-0007 keeps it as the single source of ranking truth for both popup and Enter-results page.'
  );
});

t('sortPopupHits buckets in name → tag → description order (regression guard for the popup-sort fix)', () => {
  const src = fs.readFileSync(SEARCH_PATH, 'utf8');
  // The function body should contain three buckets initialised then
  // concatenated in the order name, tag, description. We're flexible on
  // variable names but the spread order is meaningful.
  assert(
    /nameMatches[\s\S]{0,200}tagMatches[\s\S]{0,200}descMatches/.test(src),
    'sortPopupHits should declare nameMatches, tagMatches, descMatches buckets in that order (per ADR-0007: name match has highest priority).'
  );
  assert(
    /\[\s*\.\.\.\s*nameMatches\s*,\s*\.\.\.\s*tagMatches\s*,\s*\.\.\.\s*descMatches\s*\]/.test(src),
    'sortPopupHits must return [...nameMatches, ...tagMatches, ...descMatches] — bucket concat order locks the rank order.'
  );
});

/* ─── 2. doSearch invokes sortPopupHits (THE story-8 change) ─── */

t('sortPopupHits is invoked from at least TWO call sites in BrainstormSearch.jsx', () => {
  const src = fs.readFileSync(SEARCH_PATH, 'utf8');
  // After Story 8, the file must contain sortPopupHits in at least three
  // forms: the definition + at least two call sites (one in
  // fetchSuggestions, one in doSearch). The function-definition match
  // contains "function sortPopupHits(" or "sortPopupHits = " etc.; the
  // call sites contain "sortPopupHits(" preceded by something other than
  // "function ".
  //
  // Simpler invariant: total occurrences of the literal "sortPopupHits("
  // must be >= 3 (1 definition + 2+ calls). Currently it's 2 (1
  // definition + 1 call in fetchSuggestions).
  const occurrences = countMatches(src, 'sortPopupHits(');
  assert(
    occurrences >= 3,
    `sortPopupHits must appear in at least 3 places (definition + 2 call sites) — popup AND Enter-results page. Found ${occurrences}.`
  );
});

t('doSearch (results-page fetch) invokes sortPopupHits before storing data.hits', () => {
  const src = fs.readFileSync(SEARCH_PATH, 'utf8');
  // Find the doSearch declaration and verify sortPopupHits appears within
  // a reasonable window before the function closes (we use a 4000-char
  // window — doSearch is ~50 lines = ~2000 chars; 4000 leaves headroom).
  const m = src.match(/const\s+doSearch\s*=\s*useCallback\(\s*async[\s\S]{0,4000}?\}\s*,\s*\[/);
  assert(m, 'doSearch declaration not found in BrainstormSearch.jsx (regex may need updating if the function shape changed).');
  const doSearchBody = m[0];
  assert(
    doSearchBody.includes('sortPopupHits('),
    'doSearch must invoke sortPopupHits on data.hits before setResults — per ADR-0007 Implementation Notes step 1.'
  );
});

t('doSearch pagination-append branch also sorts the new slice', () => {
  const src = fs.readFileSync(SEARCH_PATH, 'utf8');
  // The pagination-append branch (offset > 0) must also sort the new
  // page-slice. Per the ADR: "For pagination, the append slice should
  // also be sorted." We look for setResults(prev => ...) with
  // sortPopupHits nearby.
  const m = src.match(/setResults\s*\(\s*prev\s*=>[\s\S]{0,300}?\)/);
  assert(m, 'setResults pagination-append branch not found.');
  assert(
    m[0].includes('sortPopupHits'),
    'setResults pagination-append branch must apply sortPopupHits to the new slice (per-page sort; documented trade-off in ADR-0007).'
  );
});

/* ─── 3. POV-change reactivity on the popup ─── */

t('a useEffect mirrors the results-page POV-change pattern for the popup', () => {
  const src = fs.readFileSync(SEARCH_PATH, 'utf8');
  // The existing results-page effect uses prevPovRef + a useEffect deps of [pov].
  // The new popup-side effect should similarly compare against a previous
  // POV value AND only act when the popup is the active surface
  // (!hasResults) OR re-fetch fetchSuggestions when the query is present.
  //
  // We look for *two* useEffects keyed on `pov`. The existing one for
  // doSearch is one; the new one for the popup is the second.
  const povEffects = src.match(/useEffect\(\s*\(\)\s*=>\s*\{[\s\S]{0,800}?\},\s*\[\s*pov\s*\]/g) || [];
  assert(
    povEffects.length >= 2,
    `Need a popup-side POV-change effect in addition to the existing results-page one. Found ${povEffects.length} useEffect with deps [pov].`
  );
});

t('the popup POV-effect calls fetchSuggestions', () => {
  const src = fs.readFileSync(SEARCH_PATH, 'utf8');
  // At least one of the [pov]-dep effects must call fetchSuggestions
  // (the popup re-fetch path). The existing one calls doSearch.
  const povEffects = src.match(/useEffect\(\s*\(\)\s*=>\s*\{[\s\S]{0,800}?\},\s*\[\s*pov\s*\]/g) || [];
  const anyCallsFetchSuggestions = povEffects.some((e) => e.includes('fetchSuggestions'));
  assert(
    anyCallsFetchSuggestions,
    'A useEffect keyed on [pov] must invoke fetchSuggestions when the popup is the active surface (per ADR-0007 Implementation Notes step 2).'
  );
});

/* ─── 4. povSwitching state model ─── */

t('povSwitching state slot is declared', () => {
  const src = fs.readFileSync(SEARCH_PATH, 'utf8');
  assert(
    /const\s+\[\s*povSwitching\s*,\s*setPovSwitching\s*\]\s*=\s*useState\(/.test(src),
    'A useState slot named povSwitching (with setPovSwitching) must be declared — per ADR-0007 Implementation Notes step 3.'
  );
});

t('setPovSwitching is flipped to true somewhere (POV-change handler)', () => {
  const src = fs.readFileSync(SEARCH_PATH, 'utf8');
  assert(
    /setPovSwitching\s*\(\s*true\s*\)/.test(src),
    'setPovSwitching(true) must be called from a POV-change handler so the loading indicator can render.'
  );
});

t('setPovSwitching is cleared (false) somewhere', () => {
  const src = fs.readFileSync(SEARCH_PATH, 'utf8');
  assert(
    /setPovSwitching\s*\(\s*false\s*\)/.test(src),
    'setPovSwitching(false) must be called to clear the loading indicator (per ADR: on fetch response or on user-prefs write callback).'
  );
});

/* ─── 5. Selector loading indicator renders conditionally ─── */

t('povSwitching is referenced in render JSX (loading indicator is conditional on it)', () => {
  const src = fs.readFileSync(SEARCH_PATH, 'utf8');
  // After the state slot is declared, the variable must be read at least
  // once more (the conditional render). A trivial check: count references.
  // Declaration counts as 1; we need at least 4 (decl, setPovSwitching(true),
  // setPovSwitching(false), and at least one render-side reference).
  const occurrences = countMatches(src, 'povSwitching');
  assert(
    occurrences >= 4,
    `povSwitching must be both written and read in JSX. Expected >= 4 occurrences (decl + 2 setters + render). Found ${occurrences}.`
  );
});

/* ─── Run ─── */

async function run() {
  console.log('\n--- search-result-parity tests (Story 8) ---');
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
  console.log(`\nsearch-result-parity: ${pass} passed, ${fail} failed`);
  return { pass, fail };
}

if (require.main === module) {
  run()
    .then(({ fail }) => process.exit(fail === 0 ? 0 : 1))
    .catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
