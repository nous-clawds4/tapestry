/**
 * Tests for Story 2 (epic: event-tagging) — the global publish guard.
 *
 * Story: engineering-team/stories/event-tagging/2-global-publish-gate.md
 * ADR:   engineering-team/decisions/event-tagging/0002-global-publish-gate.md
 *
 * Two seams (ADR 0002):
 *   1. SERVER (behavioral): the real handleGetPublishPolicy, called with a fake
 *      req/res while driving process.env.BRAINSTORM_PUBLISH_LOCAL_ONLY. Only the
 *      exact string 'true' engages the guard (-> allowExternalPublish:false).
 *   2. CLIENT (source-contract): ui/src/utils/nostrPublish.js is ESM + imports
 *      nostr-tools, so the CJS runner can't import it. Assert over its SOURCE that
 *      the guard exists at the shared primitive, precedes any SimplePool use,
 *      fails open, and is wired into the API. Mirrors Story 1 / b-tag-primitive.
 *
 * Intentionally failing until the handler + route + guard land (red phase). The
 * handler module is require()d LAZILY inside each test so this suite can't crash
 * test/test.js's load phase. No relay, no signing, no firmware.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const HANDLER_REQUIRE = '../src/api/publish-policy';
const NOSTR_PUBLISH = 'ui/src/utils/nostrPublish.js';
const API_INDEX = 'src/api/index.js';
const ENV_KEY = 'BRAINSTORM_PUBLISH_LOCAL_ONLY';

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function read(rel) {
  const p = path.join(REPO_ROOT, rel);
  if (!fs.existsSync(p)) throw new Error(`${rel} does not exist`);
  return fs.readFileSync(p, 'utf-8');
}

/** Lazily load the under-test handler with a descriptive red-phase message. */
function loadHandler() {
  try { return require(HANDLER_REQUIRE); }
  catch (e) { throw new Error(`publish-policy handler not implemented yet (require('${HANDLER_REQUIRE}') failed: ${e.message})`); }
}

/** Snapshot/restore the env var around a case so sibling suites are unaffected. */
function withEnv(val, fn) {
  const had = Object.prototype.hasOwnProperty.call(process.env, ENV_KEY);
  const orig = process.env[ENV_KEY];
  try {
    if (val === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = val;
    return fn();
  } finally {
    if (had) process.env[ENV_KEY] = orig;
    else delete process.env[ENV_KEY];
  }
}

function fakeRes() {
  const r = { _json: null, _status: 200 };
  r.json = (o) => { r._json = o; return r; };
  r.status = (c) => { r._status = c; return r; };
  return r;
}

/** Call the handler under a given env value; return the captured JSON body. */
async function callHandler(envVal) {
  const { handleGetPublishPolicy } = loadHandler();
  return withEnv(envVal, async () => {
    const res = fakeRes();
    await handleGetPublishPolicy({ query: {} }, res);
    return res._json;
  });
}

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

// ─── SERVER (behavioral) ───

t("handler: BRAINSTORM_PUBLISH_LOCAL_ONLY='true' → allowExternalPublish:false (guard engages)", async () => {
  const body = await callHandler('true');
  assert(body && body.success === true, 'handler must return { success:true, ... }');
  assert(body.allowExternalPublish === false,
    `with the guard set to 'true', allowExternalPublish must be false (got ${JSON.stringify(body.allowExternalPublish)})`);
});

t("handler: only the exact string 'true' engages the guard ('false'/'1'/'yes'/'TRUE' → external allowed)", async () => {
  for (const v of ['false', '1', 'yes', 'TRUE']) {
    const body = await callHandler(v);
    assert(body && body.success === true, `handler must return success for env='${v}'`);
    assert(body.allowExternalPublish === true,
      `env='${v}' must NOT engage the guard — allowExternalPublish must be true (got ${JSON.stringify(body.allowExternalPublish)})`);
  }
});

// ─── SERVER (source-contract): default + config source ───

t('handler: reads BRAINSTORM_PUBLISH_LOCAL_ONLY via env then brainstorm.conf, default off-guard', () => {
  const src = read('src/api/publish-policy/index.js');
  assert(src.includes(ENV_KEY), `handler must read ${ENV_KEY}`);
  assert(/process\.env\.BRAINSTORM_PUBLISH_LOCAL_ONLY/.test(src), 'handler must consult process.env first');
  assert(/getConfigFromFile\(\s*['"]BRAINSTORM_PUBLISH_LOCAL_ONLY['"]\s*,\s*['"]false['"]\s*\)/.test(src),
    "handler must fall back to getConfigFromFile('BRAINSTORM_PUBLISH_LOCAL_ONLY', 'false') — default leaves the guard OFF (external publishing)");
});

t('endpoint: /api/publish-policy registered in src/api/index.js → handleGetPublishPolicy', () => {
  const src = read(API_INDEX);
  assert(/['"]\/api\/publish-policy['"]/.test(src), 'src/api/index.js must register the /api/publish-policy route');
  assert(/handleGetPublishPolicy/.test(src), 'the route must be wired to handleGetPublishPolicy');
});

// ─── CLIENT (source-contract over nostrPublish.js) ───

function publishToRelaysBody(src) {
  const start = src.indexOf('function publishToRelays');
  assert(start >= 0, 'nostrPublish.js must define publishToRelays');
  const next = src.indexOf('function publishEverywhere', start);
  return src.slice(start, next > start ? next : undefined);
}

t('guard: publishToRelays consults isExternalPublishAllowed BEFORE any SimplePool use', () => {
  const src = read(NOSTR_PUBLISH);
  assert(/isExternalPublishAllowed/.test(src), 'nostrPublish.js must define/use isExternalPublishAllowed (the guard)');
  const body = publishToRelaysBody(src);
  const guardIdx = body.indexOf('isExternalPublishAllowed');
  const poolIdx = Math.min(
    ...['new SimplePool', 'pool.publish'].map((s) => { const i = body.indexOf(s); return i < 0 ? Infinity : i; })
  );
  assert(guardIdx >= 0, 'publishToRelays must consult isExternalPublishAllowed');
  assert(poolIdx !== Infinity, 'publishToRelays still uses SimplePool (sanity)');
  assert(guardIdx < poolIdx,
    'the guard check must PRECEDE any SimplePool/pool.publish — no socket may open when the guard is on');
});

t('guard: when on, publishToRelays returns {successes:[],failures:[],skippedByGate:true} (local-only is success, observable)', () => {
  const body = publishToRelaysBody(read(NOSTR_PUBLISH));
  assert(body.includes('skippedByGate'),
    'the guard-on path must return a result marked skippedByGate (observable: intentionally skipped, not failed)');
  assert(/successes/.test(body) && /failures/.test(body),
    'the skip path must return a normal result object (successes/failures arrays), not throw — so local-only publishes still count as success');
});

t('guard: isExternalPublishAllowed fetches /api/publish-policy and FAILS OPEN (error → external allowed)', () => {
  const src = read(NOSTR_PUBLISH);
  assert(src.includes('/api/publish-policy'), 'isExternalPublishAllowed must fetch /api/publish-policy');
  // fail-open: an error/catch path resolves to true (the unset default).
  assert(/catch[\s\S]{0,120}return\s+true/.test(src) || /return\s+true[^\n]*fail[- ]?open/i.test(src),
    'isExternalPublishAllowed must FAIL OPEN — its error path must return true so a transient read failure never pauses external publishing');
});

t('coverage: the guard lives at the shared primitive (publishEverywhere routes through publishToRelays)', () => {
  const src = read(NOSTR_PUBLISH);
  const start = src.indexOf('function publishEverywhere');
  assert(start >= 0, 'nostrPublish.js must define publishEverywhere');
  const body = src.slice(start);
  assert(body.includes('publishToRelays'),
    'publishEverywhere must route through publishToRelays so the single guard covers every caller (no per-caller flag)');
});

async function run() {
  console.log('\n--- global publish gate tests (epic event-tagging, Story 2) ---');
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  PASS  ${name}`); pass++; }
    catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failures.push({ name, message: err.message }); fail++; }
  }
  console.log(`\nglobal-publish-gate: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
