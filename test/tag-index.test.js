/**
 * Tests for Story 4: Tag index page.
 * ADR: engineering-team/decisions/0003-tag-index-page.md
 *
 * Intentionally failing until the feature is implemented.
 * Hand-rolled in the project's existing test style — no new framework.
 *
 * Layer: server API contracts (HTTP against control panel — default :7778).
 * Live publish-flow assertions live in test/tag-index-publish.test.js.
 *
 * Endpoint under test (introduced by ADR-0003):
 *   GET /api/profile-tags/index
 *     ?wotPov=<house|user>&userPubkey=<hex>
 *     &sort=<used|endorsed|divisive>
 *     &q=<substring>
 *     &limit=<int>&offset=<int>
 */

const CONTROL_PANEL_BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg} — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
  }
}

async function fetchJson(url) {
  const res = await fetch(url);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}

async function controlPanelReachable() {
  try {
    const r = await fetch(`${CONTROL_PANEL_BASE}/api/auth/user-classification`, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch { return false; }
}

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

/* ─── Validation: rejects invalid sort ─── */

t('GET /api/profile-tags/index rejects an invalid sort param with 400', async () => {
  const { status } = await fetchJson(`${CONTROL_PANEL_BASE}/api/profile-tags/index?sort=bogus`);
  assertEqual(status, 400, 'invalid-sort status');
});

/* ─── Documented response shape ─── */

t('GET /api/profile-tags/index returns the documented response envelope', async () => {
  // Use a q with vanishingly-low probability of any real match so the
  // response is reliably empty regardless of what's in the DB.
  const q = `__tagindex_no_match_${Math.random().toString(36).slice(2, 10)}__`;
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/index?q=${encodeURIComponent(q)}`
  );
  assertEqual(status, 200, 'status');
  assert(json && json.success === true, 'success must be true');
  assert(Array.isArray(json.rows), 'rows must be an array');
  assert('povSuffix' in json, 'response must include povSuffix (may be null)');
  assert('minRank' in json, 'response must include minRank (may be null)');
  assert('sort' in json, 'response must include the resolved sort');
  assert('q' in json, 'response must echo q');
  assert(typeof json.total === 'number', 'response must include numeric total');
  assert(typeof json.limit === 'number', 'response must include numeric limit');
  assert(typeof json.offset === 'number', 'response must include numeric offset');
});

t('omitted sort defaults to "used"', async () => {
  const q = `__tagindex_no_match_${Math.random().toString(36).slice(2, 10)}__`;
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/index?q=${encodeURIComponent(q)}`
  );
  assertEqual(status, 200, 'status');
  assertEqual(json?.sort, 'used', 'sort default');
});

t('accepts each documented sort value', async () => {
  const q = `__tagindex_no_match_${Math.random().toString(36).slice(2, 10)}__`;
  for (const sort of ['used', 'endorsed', 'divisive']) {
    const { status, json } = await fetchJson(
      `${CONTROL_PANEL_BASE}/api/profile-tags/index?sort=${sort}&q=${encodeURIComponent(q)}`
    );
    assertEqual(status, 200, `sort=${sort} status`);
    assertEqual(json?.sort, sort, `response.sort must echo "${sort}"`);
  }
});

/* ─── Pagination params ─── */

t('limit is server-capped at 200', async () => {
  const q = `__tagindex_no_match_${Math.random().toString(36).slice(2, 10)}__`;
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/index?limit=999&q=${encodeURIComponent(q)}`
  );
  assertEqual(status, 200, 'status');
  // Server must clamp; either echoing a clamped limit value or returning
  // <= 200 rows even when the underlying set is larger. The contract here
  // is that requesting a too-large limit doesn't blow up — and the echoed
  // limit field is at most 200.
  assert(typeof json?.limit === 'number', 'response.limit must be numeric');
  assert(json.limit <= 200, `response.limit must be <= 200; got ${json.limit}`);
});

t('offset is echoed in the response', async () => {
  const q = `__tagindex_no_match_${Math.random().toString(36).slice(2, 10)}__`;
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/index?offset=123&q=${encodeURIComponent(q)}`
  );
  assertEqual(status, 200, 'status');
  assertEqual(json?.offset, 123, 'response.offset must echo input');
});

t('q is echoed in the response (preserves case)', async () => {
  const q = `__TagIndex_Echo_${Math.random().toString(36).slice(2, 10)}__`;
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/index?q=${encodeURIComponent(q)}`
  );
  assertEqual(status, 200, 'status');
  // Case + whitespace preserved on echo; actual matching is case-insensitive
  // (tested in the publish-flow suite where we have real fixture data).
  assertEqual(json?.q, q, 'response.q must echo input');
});

/* ─── Run ─── */

async function run() {
  console.log('\n--- tag-index tests (Story 4) ---');
  if (!(await controlPanelReachable())) {
    const skipped = tests.length;
    console.log(`  - SKIP: control panel not reachable at ${CONTROL_PANEL_BASE} — live-API suite needs the local stack (${skipped} tests skipped)`);
    return { pass: 0, fail: 0, skipped };
  }
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
  console.log(`\ntag-index: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

if (require.main === module) {
  run()
    .then(({ fail }) => process.exit(fail === 0 ? 0 : 1))
    .catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
