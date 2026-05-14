/**
 * Tests for Story 5: Authored-tagging section on profile pages.
 * ADR: engineering-team/decisions/0005-authored-tagging-on-profile.md
 *
 * Intentionally failing until the feature is implemented.
 * Hand-rolled in the project's existing test style — no new framework.
 *
 * Layer: server API contracts (HTTP against control panel — default :7778).
 * Live publish-flow assertions live in test/authored-tagging-publish.test.js.
 *
 * Endpoint under test (introduced by ADR-0005):
 *   GET /api/profile-tags/authored-by
 *     ?authorPubkey=<hex>            (required, 64-char lowercase hex)
 *     &wotPov=<house|user>
 *     &userPubkey=<hex>
 *     &sort=<recent|applied|disputed|most-backed|divisive>
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

const ANY_VALID_PUBKEY = 'a'.repeat(64);

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

/* ─── Validation ─── */

t('GET /api/profile-tags/authored-by rejects missing authorPubkey with 400', async () => {
  const { status } = await fetchJson(`${CONTROL_PANEL_BASE}/api/profile-tags/authored-by`);
  assertEqual(status, 400, 'missing-authorPubkey status');
});

t('GET /api/profile-tags/authored-by rejects a malformed authorPubkey with 400', async () => {
  const { status } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/authored-by?authorPubkey=not-hex`
  );
  assertEqual(status, 400, 'malformed-authorPubkey status');
});

t('GET /api/profile-tags/authored-by rejects an invalid sort param with 400', async () => {
  const { status } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/authored-by?authorPubkey=${ANY_VALID_PUBKEY}&sort=bogus`
  );
  assertEqual(status, 400, 'invalid-sort status');
});

/* ─── Documented response shape ─── */

t('GET /api/profile-tags/authored-by returns the documented response envelope', async () => {
  // A vanishingly-unlikely-to-have-data pubkey keeps the response deterministic
  // for shape inspection regardless of DB state.
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/authored-by?authorPubkey=${ANY_VALID_PUBKEY}`
  );
  assertEqual(status, 200, 'status');
  assert(json && json.success === true, 'success must be true');
  assert(Array.isArray(json.rows), 'rows must be an array');
  assert('povSuffix' in json, 'response must include povSuffix (may be null)');
  assert('minRank' in json, 'response must include minRank (may be null)');
  assert('sort' in json, 'response must include the resolved sort');
  assertEqual(json.authorPubkey, ANY_VALID_PUBKEY, 'response must echo authorPubkey');
});

t('omitted sort defaults to "recent"', async () => {
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/authored-by?authorPubkey=${ANY_VALID_PUBKEY}`
  );
  assertEqual(status, 200, 'status');
  assertEqual(json?.sort, 'recent', 'sort default');
});

t('accepts each documented sort value', async () => {
  for (const sort of ['recent', 'applied', 'disputed', 'most-backed', 'divisive']) {
    const { status, json } = await fetchJson(
      `${CONTROL_PANEL_BASE}/api/profile-tags/authored-by?authorPubkey=${ANY_VALID_PUBKEY}&sort=${sort}`
    );
    assertEqual(status, 200, `sort=${sort} status`);
    assertEqual(json?.sort, sort, `response.sort must echo "${sort}"`);
  }
});

/* ─── Run ─── */

async function run() {
  console.log('\n--- authored-tagging tests (Story 5) ---');
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
  console.log(`\nauthored-tagging: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

if (require.main === module) {
  run()
    .then(({ fail }) => process.exit(fail === 0 ? 0 : 1))
    .catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
