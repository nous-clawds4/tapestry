/**
 * Security: the relay-router mutations must require owner OR localTrusted.
 *
 * POST /api/strfry/router-config, router-toggle, router-restart and router-restore-defaults
 * change which relays this instance mirrors to and from (e.g. enabling the `dcosl` preset,
 * or adding an unfiltered `up` stream to any relay). Default-deny already 401s the
 * UNAUTHENTICATED case, but an authenticated non-owner (guest sign-in accepts any key) passed
 * the middleware — none of the four paths was on ownerOnlyEndpoints — and the handlers had no
 * gate of their own. This suite pins both layers, mirroring strfry-wipe-owner-gate:
 *   middleware: an authenticated non-owner POST to each path -> 403
 *   handlers:   !isOwner(req) && !req.localTrusted -> 403 before any state write or exec
 *
 * Stack-free: child_process.exec is stubbed BEFORE routerConfig.js loads (it destructures exec
 * at require time), and fs.writeFileSync is intercepted for the router's two paths, so no
 * real router state, router config or `supervisorctl restart` is touched from this suite.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ROUTER = path.join(ROOT, 'src/api/strfry/routerConfig.js');
const AUTH = path.join(ROOT, 'src/middleware/auth.js');
const ROUTER_PATHS = ['/etc/strfry-router-tapestry.config', '/var/lib/brainstorm/router-state.json'];

function assert(cond, msg) { if (!cond) throw new Error(msg); }

/* Stub child_process.exec BEFORE requiring routerConfig.js. */
const cp = require('child_process');
let execCalls = 0;
cp.exec = function (cmd, opts, cb) {
  execCalls++;
  const done = typeof opts === 'function' ? opts : cb;
  if (done) process.nextTick(() => done(null, 'ok', ''));
};
/* Intercept writes to the router's state/config files; everything else writes normally. */
const realWrite = fs.writeFileSync;
let routerWrites = 0;
fs.writeFileSync = function (p, ...rest) {
  if (ROUTER_PATHS.includes(String(p))) { routerWrites++; return undefined; }
  return realWrite.call(fs, p, ...rest);
};

delete require.cache[require.resolve(ROUTER)];
const router = require(ROUTER);

function mkRes() {
  return {
    statusCode: null, body: null,
    status(c) { this.statusCode = c; return this; },
    json(o) { this.body = o; return this; },
  };
}

const HANDLERS = [
  ['handleUpdateRouterConfig', { streams: [{ name: 'x', dir: 'up', urls: ['wss://relay.example'] }] }],
  ['handleToggleStream', { name: 'dcosl', enabled: true }],
  ['handleRestartRouter', {}],
  ['handleRestoreDefaults', {}],
];
const PATHS = ['/api/strfry/router-config', '/api/strfry/router-toggle', '/api/strfry/router-restart', '/api/strfry/router-restore-defaults'];

const tests = [];

for (const [fn, body] of HANDLERS) {
  tests.push([`${fn}: authenticated non-owner → 403 before any router write or exec`, async () => {
    execCalls = 0; routerWrites = 0;
    const res = mkRes();
    await router[fn]({ session: { authenticated: true, pubkey: 'a'.repeat(64) }, localTrusted: false, body }, res);
    assert(res.statusCode === 403, `expected 403 for a non-owner ${fn}, got ${res.statusCode}.`);
    assert(execCalls === 0 && routerWrites === 0, `the gate must fire BEFORE any write/exec (exec ${execCalls}, writes ${routerWrites}).`);
  }]);
}

tests.push(['handlers: localTrusted (loopback operator) passes the gate', async () => {
  // Bodies chosen to stop at validation where possible; writes/exec are stubbed regardless.
  const cases = [
    ['handleUpdateRouterConfig', { streams: 'not-an-array' }],
    ['handleToggleStream', {}],
    ['handleRestartRouter', {}],
  ];
  for (const [fn, body] of cases) {
    const res = mkRes();
    await router[fn]({ session: {}, localTrusted: true, body }, res);
    assert(res.statusCode !== 403, `a localTrusted ${fn} must pass the gate; got 403.`);
  }
}]);

for (const p of PATHS) {
  tests.push([`middleware: authenticated non-owner POST ${p} → 403`, async () => {
    const { authMiddleware } = require(AUTH);
    const res = mkRes(); let nextCalled = false;
    await authMiddleware({
      method: 'POST', path: p, query: {}, body: {},
      headers: { 'x-forwarded-for': '203.0.113.7' }, ip: '127.0.0.1', connection: { remoteAddress: '127.0.0.1' },
      session: { authenticated: true, pubkey: 'b'.repeat(64) },
    }, res, () => { nextCalled = true; });
    assert(!nextCalled && res.statusCode === 403, `expected 403 from the middleware for ${p}, got ${res.statusCode} (next called: ${nextCalled}).`);
  }]);
}

tests.push(['S: routerConfig.js imports isOwner and gates on owner OR localTrusted with a 403', () => {
  const src = fs.readFileSync(ROUTER, 'utf8');
  assert(/require\(['"][^'"]*middleware\/auth['"]\)/.test(src) && /isOwner/.test(src), 'routerConfig.js must import isOwner from the auth middleware.');
  assert(/\b403\b/.test(src) && /localTrusted/.test(src), 'routerConfig.js must gate on isOwner OR req.localTrusted with a 403.');
}]);

async function run() {
  console.log('\n--- strfry router owner-gate tests ---');
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
  console.log(`\nstrfry-router-owner-gate: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
