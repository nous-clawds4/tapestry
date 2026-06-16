/**
 * Tests for Story 2: Tag-detail page (read).
 * ADR: engineering-team/decisions/0002-tag-detail-page-read.md
 *
 * These tests are intentionally failing until the feature is implemented.
 * Hand-rolled in the project's existing test style (no new framework).
 *
 * Layer: server API contracts (HTTP against control panel — default :7778).
 * Live publish-flow assertions live in test/tag-detail-publish.test.js.
 *
 * Endpoints under test (introduced by ADR-0002):
 *   GET /api/profile-tags/by-id?tagEventId=<id>
 *   GET /api/profile-tags/profiles-tagged?tagEventId=<id>&wotPov=<>&userPubkey=<>&sort=<>
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

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

/* ─── /api/profile-tags/by-id ─── */

t('GET /api/profile-tags/by-id rejects missing tagEventId with 400', async () => {
  const { status } = await fetchJson(`${CONTROL_PANEL_BASE}/api/profile-tags/by-id`);
  assertEqual(status, 400, 'by-id (no tagEventId) status');
});

t('GET /api/profile-tags/by-id rejects malformed tagEventId with 400', async () => {
  const { status } = await fetchJson(`${CONTROL_PANEL_BASE}/api/profile-tags/by-id?tagEventId=not-hex`);
  assertEqual(status, 400, 'by-id (bad tagEventId) status');
});

t('GET /api/profile-tags/by-id returns 404 for a well-formed but unknown tagEventId', async () => {
  // Random valid-shape 64-char hex that almost certainly does not exist.
  const unknownId = 'b'.repeat(64);
  const { status, json } = await fetchJson(`${CONTROL_PANEL_BASE}/api/profile-tags/by-id?tagEventId=${unknownId}`);
  assertEqual(status, 404, 'by-id (unknown) status');
  assert(json && json.success === false, 'by-id (unknown) response.success must be false');
});

/* ─── /api/profile-tags/profiles-tagged ─── */

t('GET /api/profile-tags/profiles-tagged rejects missing tagEventId with 400', async () => {
  const { status } = await fetchJson(`${CONTROL_PANEL_BASE}/api/profile-tags/profiles-tagged`);
  assertEqual(status, 400, 'profiles-tagged (no tagEventId) status');
});

t('GET /api/profile-tags/profiles-tagged rejects malformed tagEventId with 400', async () => {
  const { status } = await fetchJson(`${CONTROL_PANEL_BASE}/api/profile-tags/profiles-tagged?tagEventId=not-hex`);
  assertEqual(status, 400, 'profiles-tagged (bad tagEventId) status');
});

t('GET /api/profile-tags/profiles-tagged rejects an invalid sort param with 400', async () => {
  const validShapeId = 'c'.repeat(64);
  const { status } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/profiles-tagged?tagEventId=${validShapeId}&sort=bogus`
  );
  assertEqual(status, 400, 'profiles-tagged (bad sort) status');
});

t('GET /api/profile-tags/profiles-tagged returns the documented response shape for a known-empty tag', async () => {
  // Valid-shape but unknown tagEventId → no assertions → empty rows. The
  // endpoint must still return the documented envelope (success/povSuffix/
  // minRank/sort/rows). This guards against the implementer regressing the
  // shape contract — the UI's hook depends on every field being present.
  const validShapeId = 'd'.repeat(64);
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/profiles-tagged?tagEventId=${validShapeId}`
  );
  assertEqual(status, 200, 'profiles-tagged status');
  assert(json && json.success === true, 'response.success must be true');
  assert(Array.isArray(json.rows), 'response.rows must be an array');
  assertEqual(json.rows.length, 0, 'rows must be empty for a tag nobody asserted');
  assert('povSuffix' in json, 'response must include povSuffix (may be null)');
  assert('minRank' in json, 'response must include minRank (may be null)');
  assert('sort' in json, 'response must include the resolved sort');
  assertEqual(json.sort, 'applied', 'omitted sort must default to "applied"');
});

t('GET /api/profile-tags/profiles-tagged accepts each documented sort value', async () => {
  const validShapeId = 'e'.repeat(64);
  for (const sort of ['applied', 'disputed', 'divisive']) {
    const { status, json } = await fetchJson(
      `${CONTROL_PANEL_BASE}/api/profile-tags/profiles-tagged?tagEventId=${validShapeId}&sort=${sort}`
    );
    assertEqual(status, 200, `profiles-tagged (sort=${sort}) status`);
    assertEqual(json?.sort, sort, `response.sort must echo "${sort}"`);
  }
});

/* ─── Run ─── */

async function run() {
  console.log('\n--- tag-detail tests (Story 2) ---');
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`  PASS  ${name}`);
      pass++;
    } catch (err) {
      console.log(`  FAIL  ${name}\n        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`\ntag-detail: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

if (require.main === module) {
  run()
    .then(({ fail }) => process.exit(fail === 0 ? 0 : 1))
    .catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
