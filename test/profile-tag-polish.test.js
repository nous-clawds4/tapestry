/**
 * Tests for Story 7: Profile-tag polish bundle — omni-search popup + POV correctness.
 * ADR: engineering-team/decisions/0006-profile-tag-polish-omni-search-pov.md
 *
 * Intentionally failing until the feature is implemented.
 * Hand-rolled in the project's existing test style — no new framework.
 *
 * Layer: server API contracts (HTTP against control panel — default :7778).
 * Live publish-flow assertions live in test/profile-tag-polish-publish.test.js.
 *
 * Endpoints under test:
 *   GET /api/profile-tags/tags-for-profile?pubkey=<hex>&wotPov=&userPubkey=
 *     — extended with POV params and povSuffix/minRank response echo (ADR-0006).
 *   GET /api/profile-tags/wot-tags?wotPov=&userPubkey=
 *     — replaces deprecated `viewer` param with the standard pair (ADR-0006).
 *   GET /api/search/profiles/meili?q=<query>&tagLimit=<int>
 *     — response gains `tagHits` array + `tagHitsHasMore` boolean; `tagLimit`
 *       query param accepted, defaulting to 5, clamped to a max of 50.
 */

const CONTROL_PANEL_BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';
const ANY_VALID_PUBKEY = 'a'.repeat(64);

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

/* ─── tags-for-profile: POV-param contract ─── */

t('GET /api/profile-tags/tags-for-profile returns POV-echo fields (povSuffix + minRank)', async () => {
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/tags-for-profile?pubkey=${ANY_VALID_PUBKEY}`
  );
  assertEqual(status, 200, 'status');
  assert(json?.success === true, 'success must be true');
  assert('povSuffix' in json, 'response must include povSuffix (may be null)');
  assert('minRank' in json, 'response must include minRank (may be null)');
});

t('GET /api/profile-tags/tags-for-profile accepts wotPov=house', async () => {
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/tags-for-profile?pubkey=${ANY_VALID_PUBKEY}&wotPov=house`
  );
  assertEqual(status, 200, 'wotPov=house status');
  assert(json?.success === true, 'success');
});

t('GET /api/profile-tags/tags-for-profile accepts wotPov=user with userPubkey', async () => {
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/tags-for-profile?pubkey=${ANY_VALID_PUBKEY}&wotPov=user&userPubkey=${ANY_VALID_PUBKEY}`
  );
  assertEqual(status, 200, 'wotPov=user status');
  assert(json?.success === true, 'success');
});

t('GET /api/profile-tags/tags-for-profile preserves applications/disputes shape', async () => {
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/tags-for-profile?pubkey=${ANY_VALID_PUBKEY}`
  );
  assertEqual(status, 200, 'status');
  assert(Array.isArray(json?.applications), 'applications must be an array');
  assert(Array.isArray(json?.disputes), 'disputes must be an array');
});

/* ─── wot-tags: new POV-param contract ─── */

t('GET /api/profile-tags/wot-tags accepts wotPov=house', async () => {
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/wot-tags?wotPov=house`
  );
  assertEqual(status, 200, 'status');
  assert(json?.success === true, 'success');
  assert(Array.isArray(json?.tagEventIds), 'tagEventIds must be an array');
});

t('GET /api/profile-tags/wot-tags accepts wotPov=user with userPubkey', async () => {
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/wot-tags?wotPov=user&userPubkey=${ANY_VALID_PUBKEY}`
  );
  assertEqual(status, 200, 'status');
  assert(json?.success === true, 'success');
});

t('GET /api/profile-tags/wot-tags returns POV-echo fields', async () => {
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/wot-tags?wotPov=house`
  );
  assertEqual(status, 200, 'status');
  assert('povSuffix' in json, 'response must include povSuffix (may be null)');
  assert('minRank' in json, 'response must include minRank (may be null)');
});

/* ─── search proxy: tagHits + tagHitsHasMore + tagLimit ───
 *
 * These fields shipped unconditionally with Story 7, but a later ratified
 * change gated them behind `search.resultTypes.tags` (see getResultTypes in
 * src/api/search/profiles/meili/index.js — "Shipped defaults reproduce main's
 * pre-tag response contract exactly: profiles on, tags off"; keys are OMITTED
 * entirely when disabled). The tests assert the CONDITIONAL contract, so they
 * hold on instances in either mode.
 */

let _tagsGate = null;
async function tagsGateEnabled() {
  if (_tagsGate !== null) return _tagsGate;
  const { json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/search/profiles/meili?q=__gate_probe_${Math.random().toString(36).slice(2, 8)}__`
  );
  _tagsGate = !!json && 'tagHits' in json;
  return _tagsGate;
}

t('search proxy: tagHits follows the resultTypes.tags gate (array when enabled, absent when disabled)', async () => {
  const enabled = await tagsGateEnabled();
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/search/profiles/meili?q=__no_match_${Math.random().toString(36).slice(2, 8)}__`
  );
  assertEqual(status, 200, 'status');
  assert(json?.success === true, 'success');
  if (enabled) {
    assert(Array.isArray(json.tagHits), 'tagHits must be an array (possibly empty) when tags result type is enabled');
  } else {
    assert(!('tagHits' in json), 'tagHits key must be omitted entirely when tags result type is disabled');
  }
});

t('search proxy: tagHitsHasMore follows the resultTypes.tags gate (boolean when enabled, absent when disabled)', async () => {
  const enabled = await tagsGateEnabled();
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/search/profiles/meili?q=__no_match_${Math.random().toString(36).slice(2, 8)}__`
  );
  assertEqual(status, 200, 'status');
  if (enabled) {
    assert(typeof json?.tagHitsHasMore === 'boolean', 'tagHitsHasMore must be a boolean when tags result type is enabled');
  } else {
    assert(!json || !('tagHitsHasMore' in json), 'tagHitsHasMore key must be omitted entirely when tags result type is disabled');
  }
});

t('GET /api/search/profiles/meili accepts tagLimit query param in either gate mode', async () => {
  const enabled = await tagsGateEnabled();
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/search/profiles/meili?q=__no_match_${Math.random().toString(36).slice(2, 8)}__&tagLimit=10`
  );
  assertEqual(status, 200, 'status');
  assert(json?.success === true, 'success');
  if (enabled) assert(Array.isArray(json.tagHits), 'tagHits remains array');
});

t('GET /api/search/profiles/meili tolerates a huge tagLimit (clamped <= 50 when enabled)', async () => {
  const enabled = await tagsGateEnabled();
  const { status, json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/search/profiles/meili?q=__no_match_${Math.random().toString(36).slice(2, 8)}__&tagLimit=99999`
  );
  assertEqual(status, 200, 'status');
  // Server must not crash on a huge value in either mode; when enabled,
  // tagHits length is always <= 50 even when input asks for more.
  if (enabled) {
    assert(Array.isArray(json?.tagHits), 'tagHits is array');
    assert(json.tagHits.length <= 50, `tagHits.length must be <= 50; got ${json.tagHits.length}`);
  } else {
    assert(json?.success === true, 'success (tags disabled: no tagHits key, request must still succeed)');
  }
});

/* ─── Run ─── */

async function run() {
  console.log('\n--- profile-tag-polish tests (Story 7) ---');
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
  console.log(`\nprofile-tag-polish: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

if (require.main === module) {
  run()
    .then(({ fail }) => process.exit(fail === 0 ? 0 : 1))
    .catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
