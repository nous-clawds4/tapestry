/**
 * Tests for Story 13 (book: unified-tagging-ui) — /tags wired to the unified index
 * with no control regression. ADR 0012.
 *
 * The sort/pin/filter logic lives at the handler boundary (I/O), so this is
 * source-contract + skip-gated HTTP; the Tags.jsx rendering is manual (UI pass).
 */
const fs = require('fs');
const path = require('path');
const REPO = path.join(__dirname, '..');
const EVENT_TAGS = path.join(REPO, 'src/api/event-tags/index.js');
const PROFILE_TAGS = path.join(REPO, 'src/api/profile-tags/index.js');
const USE_TAG_INDEX = path.join(REPO, 'ui/src/hooks/useTagIndex.js');
const BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';

function assert(c, m) { if (!c) throw new Error(m || 'Assertion failed'); }
function read(p) { if (!fs.existsSync(p)) throw new Error(`${p} missing`); return fs.readFileSync(p, 'utf8'); }
const HEX = '0'.repeat(64);
const tests = [];
const t = (n, f) => tests.push([n, f]);

t('src: useTagIndex fetches the UNIFIED /api/tags/index (not the profiles-only index)', () => {
  const src = read(USE_TAG_INDEX);
  assert(/\/api\/tags\/index/.test(src), 'useTagIndex must call /api/tags/index');
  assert(!/\/api\/profile-tags\/index/.test(src), '/tags must stop calling the profiles-only /api/profile-tags/index');
});

t('src: profile-tags exports aggregateTagPins for reuse by the unified handler', () => {
  const src = read(PROFILE_TAGS);
  assert(/module\.exports[\s\S]*aggregateTagPins|exports\.aggregateTagPins|aggregateTagPins,/.test(src),
    'aggregateTagPins must be exported (read-only pin helper reused by the unified index)');
});

t('src: handleTagIndex honours sort + authoredBy + pinnedByMe and attaches pinnedCount via aggregateTagPins', () => {
  const src = read(EVENT_TAGS);
  assert(/req\.query\.sort/.test(src), 'handleTagIndex must read req.query.sort');
  assert(/authoredBy/.test(src) && /pinnedByMe/.test(src), 'must support authoredBy + pinnedByMe filters');
  assert(/aggregateTagPins/.test(src), 'must reuse aggregateTagPins for pinnedCount/viewerPinned');
  assert(/pinnedCount/.test(src) && /viewerPinned/.test(src), 'rows must carry pinnedCount + viewerPinned');
});

async function httpGet(url) {
  try { const c = new AbortController(); const to = setTimeout(() => c.abort(), 6000); const r = await fetch(url, { signal: c.signal }); clearTimeout(to); const j = await r.json().catch(() => null); return { status: r.status, json: j }; }
  catch { return { status: null, json: null }; }
}

t('http: /api/tags/index honours sort=most-pinned and returns rows with pinnedCount (skip if stack down)', async () => {
  const probe = await httpGet(`${BASE}/api/event-tags/for-event`);
  if (probe.status === null) return 'SKIP';
  const r = await httpGet(`${BASE}/api/tags/index?sort=most-pinned&viewerPubkey=${HEX}&limit=5`);
  assert(r.status === 200, `must 200 (got ${r.status})`);
  assert(r.json && Array.isArray(r.json.rows), 'rows array required');
  if (r.json.rows.length) assert('pinnedCount' in r.json.rows[0], 'rows must carry pinnedCount');
});

async function run() {
  console.log('\n--- unified /tags directory tests (book: unified-tagging-ui, Story 13) ---');
  let pass = 0, fail = 0, skipped = 0; const failures = [];
  for (const [name, fn] of tests) {
    try { const r = await fn(); if (r === 'SKIP') { console.log(`  SKIP  ${name}`); skipped++; } else { console.log(`  PASS  ${name}`); pass++; } }
    catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failures.push({ name, message: e.message }); fail++; }
  }
  console.log(`\nunified-tags-directory: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}
if (require.main === module) { run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); }); }
module.exports = { run };
