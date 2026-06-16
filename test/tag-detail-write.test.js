/**
 * Tests for Story 3: Tag-detail page (write — apply, dispute, search-and-apply).
 * ADR: engineering-team/decisions/0004-tag-detail-page-write.md
 *
 * These tests are intentionally failing until the feature is implemented.
 * Hand-rolled in the project's existing test style (no new framework).
 *
 * Layer: server API contracts (HTTP against control panel — default :7778).
 * Live publish-flow assertions live in test/tag-detail-write-publish.test.js.
 *
 * What this suite locks in (ADR-0004 §Server change):
 *   /api/profile-tags/profiles-tagged accepts an optional viewerPubkey query
 *   param. When passed, the response gains a `viewerAssertions` map and each
 *   row gains an `onlyViewerVisible` boolean. Existing Story-2 contract is
 *   preserved (no viewerPubkey → existing shape, with these additive fields
 *   either present-and-empty or null; both are acceptable).
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

const VALID_SHAPE_TAG_ID = 'a'.repeat(64);
const VALID_SHAPE_VIEWER = 'f'.repeat(64);

/* ─── viewerPubkey contract (no live publish) ─── */

t('GET /api/profile-tags/profiles-tagged accepts an optional viewerPubkey query param', async () => {
  // Well-formed but unknown ids — no assertions exist. The endpoint must still
  // 200 (the read-side endpoint never 404s on absence) and the request must
  // not be rejected for the new optional param.
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/profiles-tagged`
      + `?tagEventId=${VALID_SHAPE_TAG_ID}&viewerPubkey=${VALID_SHAPE_VIEWER}`
  );
  assertEqual(status, 200, 'profiles-tagged with viewerPubkey status');
  assert(json && json.success === true, 'response.success must be true');
  assert(Array.isArray(json.rows), 'response.rows must be an array');
});

t('GET /api/profile-tags/profiles-tagged silently ignores a malformed viewerPubkey', async () => {
  // ADR-0004: "treat as absent (don't 400 — keeps the read-only contract
  // working when a client sends a junk value)". So junk → status 200 with
  // viewerAssertions empty / null (read-only behavior preserved).
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/profiles-tagged`
      + `?tagEventId=${VALID_SHAPE_TAG_ID}&viewerPubkey=not-hex`
  );
  assertEqual(status, 200, 'profiles-tagged with malformed viewerPubkey status');
  assert(json && json.success === true, 'response.success must be true');
  // viewerAssertions should be absent OR present-and-empty when viewer was
  // not resolvable. Anything truthier than that means the malformed value
  // got threaded into the lookup — fail.
  const va = json.viewerAssertions;
  const empty = va === undefined || va === null
    || (typeof va === 'object' && !Array.isArray(va) && Object.keys(va).length === 0);
  assert(empty,
    `malformed viewerPubkey must not surface viewerAssertions; got ${JSON.stringify(va)}`);
});

t('GET /api/profile-tags/profiles-tagged returns viewerAssertions as a plain object when viewerPubkey is provided', async () => {
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/profiles-tagged`
      + `?tagEventId=${VALID_SHAPE_TAG_ID}&viewerPubkey=${VALID_SHAPE_VIEWER}`
  );
  assertEqual(status, 200, 'status');
  assert(json && 'viewerAssertions' in json,
    'response must include viewerAssertions when viewerPubkey is provided');
  const va = json.viewerAssertions;
  assert(va !== null && typeof va === 'object' && !Array.isArray(va),
    `viewerAssertions must be a plain object (map of pubkey → "applied"|"disputed"); got ${JSON.stringify(va)}`);
  // For an unknown tagEventId, the viewer has no assertions on this tag.
  assertEqual(Object.keys(va).length, 0, 'viewerAssertions for unknown tag must be an empty map');
});

t('GET /api/profile-tags/profiles-tagged response shape is preserved (no viewerPubkey)', async () => {
  // Existing Story-2 contract — additive new fields must not break a caller
  // that omits viewerPubkey. povSuffix, minRank, sort, rows must all remain.
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/profiles-tagged?tagEventId=${VALID_SHAPE_TAG_ID}`
  );
  assertEqual(status, 200, 'status');
  assert(json.success === true, 'success');
  assert('povSuffix' in json, 'povSuffix must remain');
  assert('minRank' in json, 'minRank must remain');
  assert('sort' in json, 'sort must remain');
  assert(Array.isArray(json.rows), 'rows must remain');
});

/* ─── Run ─── */

async function run() {
  console.log('\n--- tag-detail-write tests (Story 3) ---');
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
  console.log(`\ntag-detail-write: ${pass} passed, ${fail} failed`);
  return { pass, fail };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
