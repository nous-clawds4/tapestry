/**
 * Story 2 (epic: security-auth-exposure) — Default-deny for unauthenticated mutations.
 *
 * Story: engineering-team/stories/security-auth-exposure/2-default-deny-mutating-endpoints.md
 * ADR:   engineering-team/decisions/security-auth-exposure/0002-default-deny-for-mutations.md
 *
 * Stack-free (no Neo4j/Redis/strfry): the auth middleware is called directly with
 * mock req/res/next, and the publish handler is exercised only at its early-return
 * paths (the new 403 assistant-gate and the 400 client-validation) which return
 * before any signing/exec — so the lazy container-path nostr-tools require is never hit.
 *
 * NEW behaviour under test (fails until ADR-0002 lands):
 *   • the unauth branch DENIES any mutation (POST/PUT/PATCH/DELETE) not on the tiny
 *     exact-match allowlist [/api/neo4j/query, /api/strfry/publish] — closing
 *     /api/firmware/install, the DELETE meili/wipe blind spot, PUT /api/user-prefs, etc.
 *   • the honest-local bypass is BROADENED to all /api paths (so the loopback
 *     trusted-list cron + firmware bridge stay trusted).
 *   • publishEvent gates signAs:'assistant' on owner/localTrusted (closes the
 *     unauthenticated TA-signing hole) while keeping signAs:'client' public.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const AUTH = path.join(ROOT, 'src/middleware/auth.js');
const PUBLISH = path.join(ROOT, 'src/api/strfry/commands/publishEvent.js');

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function readSafe(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }

/* ─────────────── Mocks ─────────────── */

function mkRes() {
  return {
    statusCode: null, body: null,
    status(c) { this.statusCode = c; return this; },
    json(o) { this.body = o; return this; },
  };
}

// A proxied external request (nginx sets X-Forwarded-For), no session.
function proxied(over = {}) {
  return {
    method: 'POST', path: '/api/x', query: {}, body: {},
    headers: { 'x-forwarded-for': '203.0.113.7' },
    ip: '127.0.0.1', connection: { remoteAddress: '127.0.0.1' }, session: {},
    ...over,
  };
}

// A genuinely-direct local request: loopback peer, NO forwarding header.
function directLocal(over = {}) {
  return {
    method: 'POST', path: '/api/x', query: {}, body: {},
    headers: {}, ip: '127.0.0.1', connection: { remoteAddress: '127.0.0.1' }, session: {},
    ...over,
  };
}

async function callAuth(req) {
  const res = mkRes();
  let nextCalled = false;
  const next = () => { nextCalled = true; };
  const { authMiddleware } = require(AUTH);
  await authMiddleware(req, res, next);
  return { res, nextCalled, req };
}

async function callPublish(body, reqOver = {}) {
  const { handlePublishEvent } = require(PUBLISH);
  const req = { method: 'POST', path: '/api/strfry/publish', headers: {}, session: {}, body, ...reqOver };
  const res = mkRes();
  await handlePublishEvent(req, res);
  return { res };
}

/* ─────────────── Tests ─────────────── */

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

// ── Middleware: default-deny for mutations ──

t('AC1: unauthenticated POST /api/firmware/install (proxied) is denied 401', async () => {
  const { res, nextCalled } = await callAuth(proxied({ method: 'POST', path: '/api/firmware/install' }));
  assert(!nextCalled, 'firmware/install was allowed through — an unlisted mutation is still default-open.');
  assert(res.statusCode === 401, `expected 401 for an unauthenticated firmware install, got ${res.statusCode}.`);
});

t('AC1: unauthenticated DELETE /api/search/profiles/meili/wipe (proxied) is denied 401 (verb blind spot)', async () => {
  const { res, nextCalled } = await callAuth(proxied({ method: 'DELETE', path: '/api/search/profiles/meili/wipe' }));
  assert(!nextCalled && res.statusCode === 401, `a DELETE mutation must be denied unauth; got next=${nextCalled} status=${res.statusCode}.`);
});

t('AC1: unauthenticated PUT /api/user-prefs (proxied) is denied 401', async () => {
  const { res, nextCalled } = await callAuth(proxied({ method: 'PUT', path: '/api/user-prefs' }));
  assert(!nextCalled && res.statusCode === 401, `a PUT mutation must be denied unauth; got next=${nextCalled} status=${res.statusCode}.`);
});

t('allowlist: unauthenticated POST /api/neo4j/query (proxied) passes the middleware (handler gates writes)', async () => {
  const { res, nextCalled } = await callAuth(proxied({ method: 'POST', path: '/api/neo4j/query' }));
  assert(nextCalled && res.statusCode === null, `neo4j/query must stay reachable (story-1 reads); got next=${nextCalled} status=${res.statusCode}.`);
});

t('allowlist: unauthenticated POST /api/strfry/publish (proxied) passes the middleware (handler gates TA-signing)', async () => {
  const { res, nextCalled } = await callAuth(proxied({ method: 'POST', path: '/api/strfry/publish' }));
  assert(nextCalled && res.statusCode === null, `strfry/publish must stay reachable (client-signed publish); got next=${nextCalled} status=${res.statusCode}.`);
});

t('AC (cron): a direct-local POST to /api/trusted-list/* is trusted and stamped req.localTrusted (broadened bypass)', async () => {
  const { nextCalled, req } = await callAuth(directLocal({ method: 'POST', path: '/api/trusted-list/refresh-all-pinned-tags' }));
  assert(nextCalled, 'the loopback trusted-list cron was blocked — the honest-local bypass must cover all /api paths, not just normalize/neo4j.');
  assert(req.localTrusted === true, 'a direct-local call must be stamped req.localTrusted so it is recognized as trusted for all paths.');
});

t('AC1: a PROXIED unauthenticated POST to /api/trusted-list/* is denied 401 (remote cannot invoke the cron)', async () => {
  const { res, nextCalled } = await callAuth(proxied({ method: 'POST', path: '/api/trusted-list/refresh-all-pinned-tags' }));
  assert(!nextCalled && res.statusCode === 401, `a remote caller must not reach the cron; got next=${nextCalled} status=${res.statusCode}.`);
});

t('AC5: a public GET read (deploy-safety status, proxied) is unaffected — passes', async () => {
  const { res, nextCalled } = await callAuth(proxied({ method: 'GET', path: '/api/deploy-safety/status' }));
  assert(nextCalled && res.statusCode === null, `public reads must stay reachable; got next=${nextCalled} status=${res.statusCode}.`);
});

t('AC (no regression): an authenticated-session mutation is unaffected (authenticated branch)', async () => {
  const { nextCalled, res } = await callAuth(proxied({
    method: 'POST', path: '/api/firmware/install',
    session: { authenticated: true, pubkey: 'deadbeef' },
  }));
  assert(nextCalled && res.statusCode === null, `a logged-in user's request must pass the middleware; got next=${nextCalled} status=${res.statusCode}.`);
});

// ── publishEvent: TA-signing gate ──

t('AC3: unauthenticated signAs:"assistant" is denied 403 (no TA-signing without owner/localTrusted)', async () => {
  const { res } = await callPublish({ event: { kind: 1, tags: [], content: '' }, signAs: 'assistant' }, { session: {} });
  assert(res.statusCode === 403, `expected 403 for unauthenticated TA-signing, got ${res.statusCode}.`);
});

t('AC3: signAs:"client" is NOT blocked by the assistant-gate (public client-signed publish)', async () => {
  // A client event missing sig returns 400 (validation) — the point is it is NOT the 403 assistant-gate.
  const { res } = await callPublish({ event: { kind: 1 }, signAs: 'client' }, { session: {} });
  assert(res.statusCode !== 403, `client-signed publish must not hit the assistant-gate; got ${res.statusCode}.`);
});

// ── Source sentinels ──

t('S: auth middleware does method-based default-deny with an exact-match public allowlist', async () => {
  const src = readSafe(AUTH) || '';
  assert(/['"]\/api\/strfry\/publish['"]/.test(src), 'auth.js does not list /api/strfry/publish on the public-mutation allowlist.');
  assert(/['"]\/api\/neo4j\/query['"]/.test(src), 'auth.js does not list /api/neo4j/query on the public-mutation allowlist.');
  assert(/PATCH/.test(src) && /DELETE/.test(src), 'auth.js unauth branch is not method-based (no PATCH/DELETE handling) — still POST-only.');
});

t('S: the honest-local bypass is broadened beyond normalize/neo4j (covers all /api paths)', async () => {
  const src = readSafe(AUTH) || '';
  // Story-1 scoped the bypass to normalize||neo4j; the broadened form must no longer
  // gate the localTrusted path on those two prefixes exclusively.
  assert(/req\.localTrusted\s*=\s*true/.test(src), 'auth.js no longer stamps req.localTrusted on the trusted-local path.');
  assert(!/startsWith\('\/api\/normalize'\)\s*\|\|\s*req\.path\.startsWith\('\/api\/neo4j'\)/.test(src),
    'the honest-local bypass is still restricted to /api/normalize||/api/neo4j — it must be broadened to all /api paths (ADR 0002).');
});

t('S: publishEvent gates signAs:"assistant" on owner OR localTrusted (isOwner imported, 403)', async () => {
  const src = readSafe(PUBLISH) || '';
  assert(/require\(['"][^'"]*middleware\/auth['"]\)/.test(src) && /isOwner/.test(src), 'publishEvent does not import/use isOwner from the auth middleware.');
  assert(/req\.localTrusted/.test(src), 'publishEvent does not honor req.localTrusted for the assistant path.');
  assert(/\b403\b/.test(src), 'publishEvent has no 403 rejection for unauthorized TA-signing.');
});

/* ─────────────── Run ─────────────── */

async function run() {
  console.log('\n--- default-deny for unauthenticated mutations (epic security-auth-exposure, Story 2) ---');
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      const r = await fn();
      if (r === 'SKIP') { console.log(`  SKIP  ${name}`); skipped++; }
      else { console.log(`  PASS  ${name}`); pass++; }
    } catch (err) {
      console.log(`  FAIL  ${name}\n        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`\ndefault-deny-mutations: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
