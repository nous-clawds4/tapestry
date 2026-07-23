/**
 * Story 1 (epic: security-auth-exposure) — Close the unauthenticated write-surface exposure.
 *
 * Story: engineering-team/stories/security-auth-exposure/1-close-unauthenticated-write-surface.md
 * ADR:   engineering-team/decisions/security-auth-exposure/0001-honest-local-bypass-and-neo4j-write-gate.md
 *
 * Two stack-free classes (this suite needs neither Neo4j nor Redis; the queryPost
 * seam stubs the Bolt driver via the require cache):
 *
 *   U-class (unit) — behavioral contracts:
 *     • the auth middleware's honest-local bypass: a forwarding header (X-Forwarded-For)
 *       is proof of proxying, so a proxied/spoofed request is treated as remote;
 *       a genuinely-direct local request is trusted and stamped `req.localTrusted`.
 *     • queryPost's write-gate: unauthenticated WRITE Cypher → 403 (and no write runs);
 *       reads stay open; a localTrusted write passes.
 *
 *   S-class (source sentinels) — guards behavior can't cheaply catch: trust-proxy
 *     stays OFF (the rejected Option A false-fix), the firmware internal bridge no
 *     longer forges a proxy header (AC #6), and the gate wires isOwner/localTrusted.
 *
 * The NEW-behavior tests FAIL until ADR-0001 lands: today the bypass fires for any
 * loopback peer (so proxied traffic is "local"), queryPost has no write-gate, and the
 * internal bridge hardcodes x-forwarded-for. That is the point.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const AUTH = path.join(ROOT, 'src/middleware/auth.js');
const QUERYPOST = path.join(ROOT, 'src/api/neo4j/queryPost.js');
const INSTALL = path.join(ROOT, 'src/firmware/install.js');

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function readSafe(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }

/* ─────────────── Mocks ─────────────── */

function mkReq(over = {}) {
  return {
    method: 'POST',
    path: '/api/normalize/add-to-set',
    headers: {},
    ip: '127.0.0.1',
    connection: { remoteAddress: '127.0.0.1' },
    session: {},
    ...over,
  };
}

function mkRes() {
  return {
    statusCode: null,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(o) { this.body = o; return this; },
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

/* ─────────────── queryPost seam: stub the Bolt driver, load fresh ─────────────── */

const DRIVER_PATH = require.resolve(path.join(ROOT, 'src/lib/neo4j-driver'));
let driverCalls = [];

function loadQueryPostWithStubbedDriver() {
  delete require.cache[require.resolve(QUERYPOST)];
  require.cache[DRIVER_PATH] = {
    id: DRIVER_PATH,
    filename: DRIVER_PATH,
    loaded: true,
    exports: {
      runCypher: async (cypher) => { driverCalls.push({ fn: 'runCypher', cypher }); return []; },
      writeCypher: async (cypher) => { driverCalls.push({ fn: 'writeCypher', cypher }); return []; },
      getDriver() { return null; },
      closeDriver() {},
      toJS(x) { return x; },
    },
  };
  return require(QUERYPOST).queryPost;
}

async function callQueryPost(reqOver) {
  driverCalls = [];
  const queryPost = loadQueryPostWithStubbedDriver();
  const req = { method: 'POST', path: '/api/neo4j/query', headers: {}, session: {}, ...reqOver };
  const res = mkRes();
  await queryPost(req, res);
  return { res, driverCalls };
}

/* ─────────────── Tests ─────────────── */

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

// ── U-class: honest-local bypass (auth middleware) ──

t('AC1: unauthenticated POST /api/normalize behind a proxy (loopback peer + XFF) is rejected 401', async () => {
  const { res, nextCalled } = await callAuth(mkReq({
    headers: { 'x-forwarded-for': '203.0.113.7' },
  }));
  assert(!nextCalled, 'the request was allowed through (next called) — the localhost bypass still fires for proxied traffic.');
  assert(res.statusCode === 401, `expected 401 for an unauthenticated proxied normalize write, got ${res.statusCode}.`);
});

t('AC3: a spoofed X-Forwarded-For: 127.0.0.1 does NOT earn local (loopback peer) — 401', async () => {
  const { res, nextCalled } = await callAuth(mkReq({
    headers: { 'x-forwarded-for': '127.0.0.1' },
  }));
  assert(!nextCalled, 'spoofed loopback XFF was trusted (next called) — presence of a forwarding header must mean "proxied".');
  assert(res.statusCode === 401, `expected 401 for a spoofed-XFF normalize write, got ${res.statusCode}.`);
});

t('AC3: a non-loopback peer with spoofed XFF:127.0.0.1 is remote — 401 (regression guard vs trust-proxy)', async () => {
  const { res, nextCalled } = await callAuth(mkReq({
    ip: '203.0.113.9',
    connection: { remoteAddress: '203.0.113.9' },
    headers: { 'x-forwarded-for': '127.0.0.1' },
  }));
  assert(!nextCalled && res.statusCode === 401, `a non-loopback peer must be remote regardless of XFF; got next=${nextCalled} status=${res.statusCode}.`);
});

t('AC6/local: a genuinely-direct local request (loopback, no proxy header) is trusted and stamped req.localTrusted', async () => {
  const req = mkReq({ headers: {} }); // no XFF, no X-Real-IP
  const { res, nextCalled, req: out } = await callAuth(req);
  assert(nextCalled, 'a direct local request to /api/normalize was blocked — the local-operator/dev path must still work.');
  assert(res.statusCode === null, `a trusted local request must not be given a status; got ${res.statusCode}.`);
  assert(out.localTrusted === true, 'the bypass must stamp req.localTrusted = true so the queryPost write-gate can honor it.');
});

t('AC5: a public read (deploy-safety status) stays reachable unauthenticated behind a proxy', async () => {
  const { nextCalled, res } = await callAuth(mkReq({
    method: 'GET',
    path: '/api/deploy-safety/status',
    headers: { 'x-forwarded-for': '203.0.113.7' },
  }));
  assert(nextCalled && res.statusCode === null, `the deploy-safety curl endpoint must stay public; got next=${nextCalled} status=${res.statusCode}.`);
});

t('design boundary: unauthenticated /api/neo4j/query passes the middleware (write-gating is the handler’s job)', async () => {
  const { nextCalled, res } = await callAuth(mkReq({
    path: '/api/neo4j/query',
    headers: { 'x-forwarded-for': '203.0.113.7' },
  }));
  assert(nextCalled && res.statusCode === null, `middleware must defer /api/neo4j/query read/write policy to the handler; got next=${nextCalled} status=${res.statusCode}.`);
});

// ── U-class: queryPost write-gate ──

t('AC2: unauthenticated write Cypher (DETACH DELETE) is rejected 403 and no write runs', async () => {
  const { res, driverCalls } = await callQueryPost({ body: { cypher: 'MATCH (n) DETACH DELETE n' } });
  assert(res.statusCode === 403, `expected 403 for an unauthenticated write, got ${res.statusCode}.`);
  assert(!driverCalls.some((c) => c.fn === 'writeCypher'), 'writeCypher was executed for an unauthenticated write — the graph was mutated.');
});

t('AC2: representative write keywords are each rejected unauthenticated (403)', async () => {
  const writes = [
    'CREATE (n:X) RETURN n',
    'MATCH (n:X) SET n.y = 1',
    'MATCH (n:X) REMOVE n.y',
    'MERGE (n:X {id:1})',
    'MATCH (n:X)-[r]->() DELETE r',
    'DROP INDEX foo IF EXISTS',
  ];
  for (const cypher of writes) {
    const { res, driverCalls } = await callQueryPost({ body: { cypher } });
    assert(res.statusCode === 403, `expected 403 for unauth write "${cypher.slice(0, 24)}…", got ${res.statusCode}.`);
    assert(!driverCalls.some((c) => c.fn === 'writeCypher'), `writeCypher ran for unauth write "${cypher.slice(0, 24)}…".`);
  }
});

t('AC2: unauthenticated read Cypher still runs (reads stay public for browsing)', async () => {
  const { res, driverCalls } = await callQueryPost({ body: { cypher: 'MATCH (n) RETURN n LIMIT 1' } });
  assert(res.statusCode !== 403, `an unauthenticated read must not be blocked; got ${res.statusCode}.`);
  assert(driverCalls.some((c) => c.fn === 'runCypher'), 'the read did not reach runCypher — reads must stay open.');
});

t('AC6: a localTrusted write is allowed (firmware-install / local-dev path)', async () => {
  const { res, driverCalls } = await callQueryPost({ localTrusted: true, body: { cypher: 'CREATE (n:X) RETURN n' } });
  assert(res.statusCode !== 403, `a localTrusted write must be allowed; got ${res.statusCode}.`);
  assert(driverCalls.some((c) => c.fn === 'writeCypher'), 'the localTrusted write did not reach writeCypher.');
});

// ── S-class: source sentinels ──

t('S: trust proxy is NOT enabled anywhere in src/ (guards the rejected spoofable Option A)', async () => {
  const hits = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.js')) {
        const src = readSafe(p) || '';
        if (/\.set\(\s*['"]trust proxy['"]/.test(src) || /['"]trust proxy['"]\s*,\s*(true|1)/.test(src)) hits.push(p);
      }
    }
  };
  walk(path.join(ROOT, 'src'));
  assert(hits.length === 0, `trust proxy must stay OFF (req.ip must remain the socket peer); found enabling in: ${hits.join(', ')}.`);
});

t('S: auth middleware treats a forwarding header as proof of proxying and stamps req.localTrusted', async () => {
  const src = readSafe(AUTH) || '';
  assert(/x-forwarded-for/i.test(src), 'auth.js does not consult x-forwarded-for — the honest-local heuristic is missing.');
  assert(/req\.localTrusted\s*=/.test(src), 'auth.js does not stamp req.localTrusted on the trusted-local path.');
});

t('S: queryPost gates writes on owner OR localTrusted (isOwner imported, 403 on write)', async () => {
  const src = readSafe(QUERYPOST) || '';
  assert(/require\(['"][^'"]*middleware\/auth['"]\)/.test(src) && /isOwner/.test(src), 'queryPost does not import/use isOwner from the auth middleware.');
  assert(/req\.localTrusted/.test(src), 'queryPost does not honor req.localTrusted.');
  assert(/\b403\b/.test(src), 'queryPost has no 403 write-rejection path.');
});

t('S/AC6: the firmware internal bridge no longer forges an x-forwarded-for header', async () => {
  const src = readSafe(INSTALL) || '';
  const start = src.indexOf('function createInternalBridge');
  const end = src.indexOf('async function handleFirmwareInstall');
  assert(start !== -1 && end !== -1 && end > start, 'could not locate createInternalBridge in src/firmware/install.js.');
  const bridge = src.slice(start, end);
  assert(!/x-forwarded-for/i.test(bridge), 'the internal-bridge mock req still sets x-forwarded-for — it must not, so the in-process call is honestly direct-local (AC #6).');
});

/* ─────────────── Run ─────────────── */

async function run() {
  console.log('\n--- close unauthenticated write-surface tests (epic security-auth-exposure, Story 1) ---');
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
  console.log(`\nclose-unauth-write-surface: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
