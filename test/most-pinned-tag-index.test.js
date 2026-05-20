/**
 * Tests for Story 13: "Most pinned" sort, per-row pin counts, own-pin
 * indicator, and "Only tags I've pinned" filter on the tag index.
 * ADR: engineering-team/decisions/0012-most-pinned-tag-index.md
 *
 * These tests are intentionally failing until the feature is implemented.
 * Hand-rolled in the project's existing test style (no new framework).
 *
 * Layer: server API contracts (HTTP against control panel — default :7778).
 * Live publish-flow assertions live in test/most-pinned-tag-index-publish.test.js.
 *
 * What this suite locks in:
 *   1. /api/profile-tags/index accepts sort=most-pinned and echoes it.
 *   2. Every response row carries `pinnedCount: number` (defaults to 0).
 *   3. Every response row carries `viewerPinned: boolean` (defaults to false).
 *   4. `pinnedByMe` query param is accepted; malformed viewerPubkey is
 *      silently treated as absent (no 400).
 *   5. The existing 400-on-bogus-sort behavior is preserved.
 */

const CONTROL_PANEL_BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg} — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
  }
}

async function fetchJson(url) {
  const r = await fetch(url);
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: r.status, json, text };
}

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

const VALID_SHAPE_HEX = 'a'.repeat(64);

/* ─── sort=most-pinned is a valid sort ─── */

t('GET /api/profile-tags/index?sort=most-pinned returns 200 and echoes sort=\'most-pinned\'', async () => {
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/index?sort=most-pinned`
  );
  assertEqual(status, 200, 'most-pinned sort status');
  assert(json && json.success === true,
    `response.success must be true; got ${JSON.stringify(json)}`);
  assertEqual(json.sort, 'most-pinned',
    `response.sort must echo the request`);
});

t('GET /api/profile-tags/index?sort=bogus continues to return 400 (Story-4 contract preserved)', async () => {
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/index?sort=bogus`
  );
  assertEqual(status, 400, 'bogus sort status');
  assert(json && json.success === false,
    `response.success must be false; got ${JSON.stringify(json)}`);
});

/* ─── per-row pinnedCount + viewerPinned fields always present ─── */

t('every row in the response carries pinnedCount (number, defaults to 0)', async () => {
  // Fetch any sort that's reliable (used is the existing default).
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/index?sort=used&limit=50`
  );
  assertEqual(status, 200, 'index status');
  assert(json && Array.isArray(json.rows), 'response.rows must be an array');
  if (json.rows.length === 0) {
    // No rows = no shape to assert; just confirm the call succeeded.
    return;
  }
  for (const row of json.rows) {
    assert('pinnedCount' in row,
      `rows must include 'pinnedCount' field; got row keys: ${JSON.stringify(Object.keys(row))}`);
    assert(typeof row.pinnedCount === 'number',
      `row.pinnedCount must be a number; got ${JSON.stringify(row.pinnedCount)}`);
    assert(row.pinnedCount >= 0,
      `row.pinnedCount must be ≥ 0; got ${row.pinnedCount}`);
  }
});

t('every row in the response carries viewerPinned (boolean, defaults to false)', async () => {
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/index?sort=used&limit=50`
  );
  assertEqual(status, 200, 'index status');
  if (!json.rows || json.rows.length === 0) return;
  for (const row of json.rows) {
    assert('viewerPinned' in row,
      `rows must include 'viewerPinned' field; got row keys: ${JSON.stringify(Object.keys(row))}`);
    assert(typeof row.viewerPinned === 'boolean',
      `row.viewerPinned must be a boolean; got ${JSON.stringify(row.viewerPinned)}`);
  }
});

t('no viewerPubkey passed: rows still carry pinnedCount; viewerPinned is false everywhere', async () => {
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/index?sort=most-pinned&limit=50`
  );
  assertEqual(status, 200, 'index status');
  if (!json.rows || json.rows.length === 0) return;
  for (const row of json.rows) {
    assert('pinnedCount' in row,
      `pinnedCount must be present even without viewerPubkey; got keys: ${JSON.stringify(Object.keys(row))}`);
    assertEqual(row.viewerPinned, false,
      `without viewerPubkey, every viewerPinned MUST be false; got ${JSON.stringify(row)}`);
  }
});

/* ─── pinnedByMe param behavior ─── */

t('pinnedByMe=true without viewerPubkey is silently ignored (no 400, no filter)', async () => {
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/index?sort=used&pinnedByMe=true`
  );
  assertEqual(status, 200, 'pinnedByMe-without-viewerPubkey status');
  assert(json && json.success === true,
    `response.success must be true; got ${JSON.stringify(json)}`);
  // Implementation echoes pinnedByMe but it should reflect the effective
  // post-validation state (false when no viewerPubkey).
  // Accept either: 'pinnedByMe' field absent OR present with value false.
  if ('pinnedByMe' in json) {
    assertEqual(json.pinnedByMe, false,
      `pinnedByMe must be false when no viewerPubkey provided; got ${JSON.stringify(json.pinnedByMe)}`);
  }
});

t('pinnedByMe=true with malformed viewerPubkey is silently ignored (no 400)', async () => {
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/index?sort=used&pinnedByMe=true&viewerPubkey=not-hex`
  );
  assertEqual(status, 200, 'malformed viewerPubkey status');
  assert(json && json.success === true,
    `response.success must be true; got ${JSON.stringify(json)}`);
});

t('viewerPubkey valid + pinnedByMe omitted: viewerPinned populated, no filter', async () => {
  // With a valid-shape unknown pubkey, the viewer has no pins → every
  // row's viewerPinned should be false. No filter is applied.
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/index?sort=used&viewerPubkey=${VALID_SHAPE_HEX}&limit=50`
  );
  assertEqual(status, 200, 'viewerPubkey-only status');
  if (!json.rows || json.rows.length === 0) return;
  for (const row of json.rows) {
    assert('viewerPinned' in row,
      `viewerPinned must be present when viewerPubkey is provided; got keys: ${JSON.stringify(Object.keys(row))}`);
    // With an unknown viewer, viewerPinned is false everywhere.
    assertEqual(row.viewerPinned, false,
      `viewerPinned must be false for unknown viewer; got ${JSON.stringify(row)}`);
  }
});

/* ─── Run ─── */

async function run() {
  console.log('\n--- most-pinned-tag-index tests (Story 13) ---');
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
  console.log(`\nmost-pinned-tag-index: ${pass} passed, ${fail} failed`);
  return { pass, fail };
}

if (require.main === module) {
  run()
    .then(({ fail }) => process.exit(fail === 0 ? 0 : 1))
    .catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
