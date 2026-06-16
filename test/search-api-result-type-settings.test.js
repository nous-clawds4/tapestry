/**
 * Tests for Story 1 (epic: search-api-result-controls) — Admin control over
 * result types in the public search API.
 *
 * ADR: engineering-team/decisions/search-api-result-controls/0001-search-api-result-type-settings.md
 *
 * Intentionally failing until the feature is implemented.
 * Hand-rolled in the project's existing test style — no new framework.
 *
 * Layers:
 *   1. UNIT (always runs, no Docker): invokes handleMeiliSearchProfiles
 *      directly with TAPESTRY_SETTINGS_PATH pointed at a temp file and
 *      global.fetch stubbed. This is what makes AC-1/2/4 deterministic on
 *      any machine: settings are read from disk per request, so flipping
 *      the temp file between calls IS the no-restart test (AC-4).
 *      The tag pipeline's strfry calls fail fast on hosts without the
 *      strfry binary and degrade to empty via the proxy's .catch handlers,
 *      so "tags enabled" asserts key PRESENCE, not content.
 *   2. SOURCE CONTRACT: defaults.json ships the safe defaults; the admin
 *      card exists in SearchPreferences.jsx; BrainstormSearch.jsx keeps its
 *      defensive reads (AC-3, AC-6).
 *   3. LIVE HTTP (skips per-test when :7778 unreachable): unauthenticated
 *      writes to /api/settings are rejected (AC-5).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const CONTROL_PANEL_BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';

const TMP_SETTINGS = path.join(
  os.tmpdir(),
  `search-result-types-settings-${process.pid}.json`
);

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg} — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
  }
}

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

/* ─── Unit-layer scaffolding ──────────────────────────────────────────── */

let handleMeiliSearchProfiles = null;

/**
 * Require the meili proxy under our temp settings path. Must bust the
 * require cache for src/ so src/config/settings.js re-evaluates its
 * module-level SETTINGS_PATH against our env var (other suites in the npm
 * gate are HTTP-based and do not read host-local settings.json, so leaving
 * the env set for the rest of the process is safe — documented in the plan).
 */
function loadHandlerUnderTempSettings() {
  if (handleMeiliSearchProfiles) return handleMeiliSearchProfiles;
  process.env.TAPESTRY_SETTINGS_PATH = TMP_SETTINGS;
  for (const key of Object.keys(require.cache)) {
    if (key.includes(`${path.sep}src${path.sep}`)) delete require.cache[key];
  }
  const mod = require('../src/api/search/profiles/meili/index.js');
  handleMeiliSearchProfiles = mod.handleMeiliSearchProfiles;
  assert(
    typeof handleMeiliSearchProfiles === 'function',
    'src/api/search/profiles/meili/index.js must export handleMeiliSearchProfiles'
  );
  return handleMeiliSearchProfiles;
}

function writeOverrides(obj) {
  fs.writeFileSync(TMP_SETTINGS, JSON.stringify(obj, null, 2), 'utf-8');
}
function clearOverrides() {
  try { fs.unlinkSync(TMP_SETTINGS); } catch {}
}

const STUB_HITS = [
  { id: 'a'.repeat(64), pubkey: 'a'.repeat(64), name: 'stub-one' },
  { id: 'b'.repeat(64), pubkey: 'b'.repeat(64), name: 'stub-two' },
];

const STUB_DOC = { id: 'c'.repeat(64), pubkey: 'c'.repeat(64), name: 'doc-hit' };

/**
 * Stub global.fetch: downstream nostr-search-api returns STUB_HITS;
 * Meili document lookups return STUB_DOC when `docLookupOk` is set.
 */
function stubFetch({ docLookupOk = false } = {}) {
  const original = global.fetch;
  global.fetch = async (url) => {
    const u = String(url);
    if (u.includes('/api/search')) {
      return {
        ok: true,
        json: async () => ({
          hits: STUB_HITS.map((h) => ({ ...h })),
          estimatedTotalHits: STUB_HITS.length,
          processingTimeMs: 1,
          query: 'q',
          limit: 100,
          offset: 0,
        }),
      };
    }
    if (u.includes('/documents/')) {
      if (docLookupOk) return { ok: true, json: async () => ({ ...STUB_DOC }) };
      return { ok: false };
    }
    return { ok: false, text: async () => '' };
  };
  return () => { global.fetch = original; };
}

/** Invoke the handler with a fake req/res; resolve with { status, body }. */
async function callSearch(query, { docLookupOk } = {}) {
  const handler = loadHandlerUnderTempSettings();
  const restore = stubFetch({ docLookupOk });
  try {
    const captured = { status: 200, body: null };
    const res = {
      status(code) { captured.status = code; return this; },
      json(obj) { captured.body = obj; return this; },
    };
    await handler({ query }, res);
    assert(captured.body !== null, 'handler must respond via res.json');
    return captured;
  } finally {
    restore();
  }
}

/* ─── Source contract: shipped defaults (AC-1 foundation) ─────────────── */

t('defaults.json ships search.resultTypes = { profiles: true, tags: false }', () => {
  const defaults = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'src/config/defaults.json'), 'utf-8')
  );
  const rt = defaults.search && defaults.search.resultTypes;
  assert(rt, 'defaults.json must contain a search.resultTypes section');
  assertEqual(rt.profiles, true, 'defaults.search.resultTypes.profiles');
  assertEqual(rt.tags, false, 'defaults.search.resultTypes.tags');
});

/* ─── AC-1: safe default — response contract identical to main ────────── */

t('AC-1: default settings → response has NO tagHits / tagHitsHasMore keys', async () => {
  clearOverrides();
  const { status, body } = await callSearch({ q: 'bird', tagLimit: '10' });
  assertEqual(status, 200, 'status');
  assert(body.success === true, 'success');
  assert(!('tagHits' in body), 'tagHits key must be OMITTED under default settings');
  assert(!('tagHitsHasMore' in body), 'tagHitsHasMore key must be OMITTED under default settings');
});

t('AC-1: default settings → profile hits pass through, none carry _matchedTags', async () => {
  clearOverrides();
  const { body } = await callSearch({ q: 'bird' });
  assert(Array.isArray(body.hits), 'hits must be an array');
  assertEqual(body.hits.length, STUB_HITS.length, 'name-match hits pass through unchanged');
  for (const h of body.hits) {
    assert(!('_matchedTags' in h), `hit ${h.name} must not carry _matchedTags under default settings`);
  }
});

t('AC-1: missing resultTypes section falls back to safe defaults', async () => {
  writeOverrides({ search: {} });
  const { body } = await callSearch({ q: 'bird' });
  assert(!('tagHits' in body), 'tagHits must be omitted when resultTypes section is missing');
  assert(Array.isArray(body.hits) && body.hits.length === STUB_HITS.length,
    'profiles must default to enabled when resultTypes section is missing');
});

/* ─── AC-2: opt-in — tags enabled restores feature-branch behavior ────── */

t('AC-2: tags enabled → tagHits array + tagHitsHasMore boolean present', async () => {
  writeOverrides({ search: { resultTypes: { profiles: true, tags: true } } });
  const { status, body } = await callSearch({ q: 'bird' });
  assertEqual(status, 200, 'status');
  assert(Array.isArray(body.tagHits), 'tagHits must be an array when tags are enabled (empty is fine)');
  assert(typeof body.tagHitsHasMore === 'boolean', 'tagHitsHasMore must be a boolean when tags are enabled');
});

t('AC-2: partial override { tags: true } keeps profiles enabled via deep-merge', async () => {
  writeOverrides({ search: { resultTypes: { tags: true } } });
  const { body } = await callSearch({ q: 'bird' });
  assert(Array.isArray(body.tagHits), 'tagHits present');
  assertEqual(body.hits.length, STUB_HITS.length, 'profile hits still flow');
});

/* ─── AC-4: no redeploy — same process, flip the file, behavior follows ── */

t('AC-4: flipping the setting between requests changes behavior without restart', async () => {
  clearOverrides();
  const first = await callSearch({ q: 'bird' });
  assert(!('tagHits' in first.body), 'call 1 (defaults): tagHits omitted');

  writeOverrides({ search: { resultTypes: { profiles: true, tags: true } } });
  const second = await callSearch({ q: 'bird' });
  assert(Array.isArray(second.body.tagHits), 'call 2 (tags on, same process): tagHits present');

  clearOverrides();
  const third = await callSearch({ q: 'bird' });
  assert(!('tagHits' in third.body), 'call 3 (defaults restored, same process): tagHits omitted again');
});

/* ─── Profiles toggle (AC-3 semantics, server side) ───────────────────── */

t('profiles disabled → hits empty even though downstream search has results', async () => {
  writeOverrides({ search: { resultTypes: { profiles: false, tags: false } } });
  const { status, body } = await callSearch({ q: 'bird' });
  assertEqual(status, 200, 'status');
  assert(body.success === true, 'success');
  assert(Array.isArray(body.hits) && body.hits.length === 0, 'hits must be empty when profiles are disabled');
  assertEqual(body.estimatedTotalHits, 0, 'estimatedTotalHits');
  assert(body.nip05Result == null, 'nip05Result must be null when profiles are disabled');
});

t('profiles disabled + tags enabled → tags-only search is coherent', async () => {
  writeOverrides({ search: { resultTypes: { profiles: false, tags: true } } });
  const { body } = await callSearch({ q: 'bird' });
  assert(Array.isArray(body.hits) && body.hits.length === 0, 'no profile hits');
  assert(Array.isArray(body.tagHits), 'tagHits still present');
});

t('profiles disabled → pubkeyLookup returns no profile document', async () => {
  writeOverrides({ search: { resultTypes: { profiles: false, tags: false } } });
  const { body } = await callSearch(
    { q: 'c'.repeat(64), pubkeyLookup: 'c'.repeat(64) },
    { docLookupOk: true }
  );
  assert(Array.isArray(body.hits) && body.hits.length === 0,
    'pubkeyLookup must not return a profile doc when profiles are disabled');
});

t('control: profiles enabled + pubkeyLookup returns the document (existing behavior)', async () => {
  clearOverrides();
  const { body } = await callSearch(
    { q: 'c'.repeat(64), pubkeyLookup: 'c'.repeat(64) },
    { docLookupOk: true }
  );
  assertEqual(body.hits.length, 1, 'pubkeyLookup hit count under default settings');
});

/* ─── AC-3: admin card source contract ────────────────────────────────── */

t('AC-3: SearchPreferences.jsx renders a "Search API result types" admin card', () => {
  const src = fs.readFileSync(
    path.join(REPO_ROOT, 'ui/src/pages/grapevine/SearchPreferences.jsx'), 'utf-8'
  );
  assert(src.includes('Search API result types'),
    'SearchPreferences.jsx must contain the card title "Search API result types"');
  assert(src.includes('resultTypes'),
    'SearchPreferences.jsx must reference resultTypes');
  assert(src.includes('/api/settings'),
    'SearchPreferences.jsx must read/write via /api/settings');
});

t('AC-3: SearchPreferences.jsx warns when the profiles type is disabled', () => {
  const src = fs.readFileSync(
    path.join(REPO_ROOT, 'ui/src/pages/grapevine/SearchPreferences.jsx'), 'utf-8'
  );
  assert(src.includes('Profiles are excluded'),
    'SearchPreferences.jsx must contain the profiles-off warning copy ("Profiles are excluded …")');
});

/* ─── AC-6: client stays coherent via defensive reads ─────────────────── */

t('AC-6: BrainstormSearch.jsx reads tagHits defensively (omitted keys → no tag rows)', () => {
  const src = fs.readFileSync(
    path.join(REPO_ROOT, 'ui/src/pages/BrainstormSearch.jsx'), 'utf-8'
  );
  assert(src.includes('data.tagHits || []'),
    'BrainstormSearch.jsx must default tagHits to [] when the server omits it');
  assert(src.includes('data.tagHitsHasMore'),
    'BrainstormSearch.jsx must coerce tagHitsHasMore (absent → falsy)');
});

/* ─── AC-5: authorization (live HTTP; per-test SKIP when server is down) ── */

let serverReachable = null;
async function checkServer() {
  if (serverReachable !== null) return serverReachable;
  try {
    const res = await fetch(`${CONTROL_PANEL_BASE}/api/owner-info`, { signal: AbortSignal.timeout(3000) });
    serverReachable = res.ok;
  } catch {
    serverReachable = false;
  }
  return serverReachable;
}

t('AC-5: unauthenticated PUT /api/settings is rejected (401)', async () => {
  if (!(await checkServer())) { return 'SKIP'; }
  const res = await fetch(`${CONTROL_PANEL_BASE}/api/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ search: { resultTypes: { tags: true } } }),
  });
  assertEqual(res.status, 401, 'unauthenticated PUT /api/settings status');
});

t('AC-5: unauthenticated GET /api/settings is rejected (401)', async () => {
  if (!(await checkServer())) { return 'SKIP'; }
  const res = await fetch(`${CONTROL_PANEL_BASE}/api/settings`);
  assertEqual(res.status, 401, 'unauthenticated GET /api/settings status');
});

/* ─── Run ─── */

async function run() {
  console.log('\n--- search-api-result-type-settings tests (epic search-api-result-controls, Story 1) ---');
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      const result = await fn();
      if (result === 'SKIP') {
        console.log(`  SKIP  ${name} (control panel not reachable at ${CONTROL_PANEL_BASE})`);
        skipped++;
        continue;
      }
      console.log(`  PASS  ${name}`);
      pass++;
    } catch (err) {
      console.log(`  FAIL  ${name}\n        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  clearOverrides();
  console.log(`\nsearch-api-result-type-settings: ${pass} passed, ${fail} failed${skipped ? `, ${skipped} skipped` : ''}`);
  return { pass, fail, skipped, failures };
}

if (require.main === module) {
  run()
    .then(({ fail }) => process.exit(fail === 0 ? 0 : 1))
    .catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
