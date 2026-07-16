/**
 * Tests for pov-selectable-tag-surfaces Story 3 — the POV rank threshold actually applies.
 *
 * Story: engineering-team/stories/pov-selectable-tag-surfaces/3-resolvepov-reads-rank-threshold-key.md
 *
 * Root cause: resolvePov derived minRank from filters.rank.min, but the settings page persists the
 * threshold as filters.rank.cutoff (+enabled). Nothing writes .min → minRank always null → tag POV
 * reads never applied the threshold. Intentionally failing until resolvePov reads .cutoff.
 *
 * BEHAVIORAL-UNIT: resolvePov with injected prefs impls (no filesystem). SOURCE-CONTRACT: the meili
 * proxy tag-match no longer re-reads the phantom filters.rank.min.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(`${msg} — got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`);
}
function readSrc(rel) { return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf-8'); }

const U_KEY = 'a'.repeat(64);
const DELEGATE = 'b'.repeat(63) + '1';
// Build a user-prefs object with a given rank-filter shape, always carrying a delegate.
function userPrefs(rankFilter) {
  return { rankAuthor: DELEGATE, filters: rankFilter ? { rank: rankFilter } : undefined, sortConfig: null };
}
function resolveWith(rankFilter) {
  const { resolvePov } = require('../src/api/_shared/pov.js');
  return resolvePov({ wotPov: 'user', userPubkey: U_KEY }, {
    readUserPrefsImpl: () => userPrefs(rankFilter),
    loadHousePrefsImpl: () => ({}),
  });
}

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

t('B1: enabled cutoff applies — {enabled:true, cutoff:2} → minRank 2 (the live-repro case)', () => {
  assertEqual(resolveWith({ enabled: true, cutoff: 2 }).minRank, 2,
    'a saved, enabled rank threshold (stored as cutoff) must resolve to minRank — this is the whole bug');
});

t('B2: disabled rank filter does not filter — {enabled:false, cutoff:2} → minRank null', () => {
  assertEqual(resolveWith({ enabled: false, cutoff: 2 }).minRank, null,
    'a disabled rank filter must NOT apply (the user turned it off) — unfiltered, honestly');
});

t('B3: zero is a real threshold — {enabled:true, cutoff:0} → minRank 0 (not treated as unset)', () => {
  assertEqual(resolveWith({ enabled: true, cutoff: 0 }).minRank, 0,
    'cutoff 0 is a valid ≥0 floor; Number.isFinite(0) is true, so it must filter (not fall to null)');
});

t('B4: no rank filter → minRank null (unchanged for the genuinely-unconfigured case)', () => {
  assertEqual(resolveWith(null).minRank, null, 'no filters.rank → no threshold, as before');
});

t('B5: legacy .min still honored — {min:3} → minRank 3 (back-compat, not dropped)', () => {
  assertEqual(resolveWith({ min: 3 }).minRank, 3,
    'a legacy filters.rank.min (if any old config carries it) must still resolve');
});

t('B6: enabled omitted but cutoff present → minRank uses cutoff (a present threshold is on)', () => {
  assertEqual(resolveWith({ cutoff: 4 }).minRank, 4,
    'a rank filter with a finite cutoff and no explicit enabled:false must apply (present = on)');
});

t('S1: the meili proxy tag-match no longer reads the phantom filters.rank.min', () => {
  const src = readSrc('src/api/search/profiles/meili/index.js');
  assert(!/filters\?\.\s*rank\?\.\s*min|filters\.rank\.min/.test(src),
    'the meili proxy must not derive minRank from filters.rank.min (nothing writes it) — it must use ' +
    'the minRank resolved by resolvePovWithStatus, consistent with the tag stacks');
});

/* ─── Run ─── */
async function run() {
  console.log('\n--- pov-rank-threshold-key tests (Story 3) ---');
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  PASS  ${name}`); pass++; }
    catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failures.push({ name, message: err.message }); fail++; }
  }
  console.log(`\npov-rank-threshold-key: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}
if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}
module.exports = { run };
