/**
 * Security hardening: the router config must not let a stream's plugin path or relay
 * URL name an arbitrary executable or break out of the config's quoting.
 *
 * Follow-up to the owner-gate (strfry-router-owner-gate). Even with only owner/admin/
 * local able to reach handleUpdateRouterConfig, two weaknesses remained:
 *   1. generateConfig wrote pluginDown/pluginUp/urls UNESCAPED inside double quotes, so
 *      a `"` or newline broke out of the string (crash-loop, or an injected directive).
 *   2. handleUpdateRouterConfig stored those values with NO validation, so pluginDown
 *      could name any path — and the router EXECUTES the plugin on every event.
 *
 * This suite pins both layers, mirroring sanitizeStreamFilter's ingress-sanitize +
 * sink-JSON.stringify design:
 *   SINK  generateConfig JSON-escapes every value (byte-compatible for legal values;
 *         a malicious value can no longer create a new line / directive).
 *   INGRESS handleUpdateRouterConfig 400s a plugin path outside PLUGINS_DIR and a
 *         non-ws(s) / quote / whitespace / control URL, before any state write or exec.
 *
 * Stack-free: child_process.exec is stubbed BEFORE routerConfig.js loads (it destructures
 * exec at require time), and fs.writeFileSync is intercepted for the router's two paths.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ROUTER = path.join(ROOT, 'src/api/strfry/routerConfig.js');
const ROUTER_PATHS = ['/etc/strfry-router-tapestry.config', '/var/lib/brainstorm/router-state.json'];
const PLUGINS_DIR = '/usr/local/lib/strfry/plugins';
const GOOD_PLUGIN = `${PLUGINS_DIR}/brainstorm.js`;

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
// A trusted-local request passes the owner-gate so we exercise the validation logic itself.
function localReq(streams) { return { session: {}, localTrusted: true, body: { streams } }; }

const tests = [];

// ── SINK: generateConfig escaping ────────────────────────────────────────────
tests.push(['generateConfig: legal values render byte-compatibly (no regression)', () => {
  const cfg = router.generateConfig([
    { name: 'wot', dir: 'both', enabled: true, filter: { kinds: [1], limit: 5 }, pluginDown: GOOD_PLUGIN, urls: ['wss://relay.example'] },
  ]);
  assert(cfg.includes('dir = "both"'), 'dir line unchanged for legal value');
  assert(cfg.includes(`pluginDown = "${GOOD_PLUGIN}"`), 'pluginDown line unchanged for legal value');
  assert(cfg.includes('            "wss://relay.example",'), 'url line unchanged for legal value');
}]);

tests.push(['generateConfig: a plugin value with a quote+newline cannot break out into a new directive', () => {
  const evil = 'ok.js"\n        pluginUp = "/tmp/evil.js';
  const cfg = router.generateConfig([{ name: 'x', dir: 'both', enabled: true, pluginDown: evil, urls: [] }]);
  assert(!/\n\s*pluginUp = "\/tmp\/evil\.js"/.test(cfg), 'plugin value broke out into a standalone pluginUp directive');
  assert(cfg.includes(JSON.stringify(evil)), 'plugin value must be JSON-escaped in the config');
}]);

tests.push(['generateConfig: a URL with a quote+newline cannot break out into a new stream block', () => {
  const evilUrl = 'wss://ok"]\n    evil { dir = "up';
  const cfg = router.generateConfig([{ name: 'y', dir: 'both', enabled: true, urls: [evilUrl] }]);
  assert(!/\n\s*evil \{ dir = "up/.test(cfg), 'url broke out into a standalone stream block');
  assert(cfg.includes(JSON.stringify(evilUrl)), 'url must be JSON-escaped in the config');
}]);

// ── INGRESS: handleUpdateRouterConfig validation ─────────────────────────────
const REJECT = [
  ['pluginDown path traversal escapes PLUGINS_DIR', [{ name: 'a', dir: 'both', urls: [], pluginDown: `${PLUGINS_DIR}/../../../tmp/evil.js` }]],
  ['pluginDown arbitrary absolute path', [{ name: 'a', dir: 'both', urls: [], pluginDown: '/tmp/evil.js' }]],
  ['pluginUp with an embedded quote', [{ name: 'a', dir: 'both', urls: [], pluginUp: `${PLUGINS_DIR}/x".js` }]],
  ['pluginDown in a PLUGINS_DIR subdir (not a direct child)', [{ name: 'a', dir: 'both', urls: [], pluginDown: `${PLUGINS_DIR}/data/evil.js` }]],
  ['url with a non-ws(s) scheme', [{ name: 'a', dir: 'both', urls: ['http://evil.example'] }]],
  ['url with an embedded newline', [{ name: 'a', dir: 'both', urls: ['wss://relay.example\n evil'] }]],
  ['url with an embedded quote', [{ name: 'a', dir: 'both', urls: ['wss://relay"x'] }]],
];
for (const [label, streams] of REJECT) {
  tests.push([`handleUpdateRouterConfig: rejects ${label} with 400 and no write/exec`, async () => {
    execCalls = 0; routerWrites = 0;
    const res = mkRes();
    await router.handleUpdateRouterConfig(localReq(streams), res);
    assert(res.statusCode === 400, `expected 400, got ${res.statusCode} (${JSON.stringify(res.body)})`);
    assert(execCalls === 0 && routerWrites === 0, `must reject BEFORE any write/exec (exec ${execCalls}, writes ${routerWrites})`);
  }]);
}

const ACCEPT = [
  ['a listed plugin + a wss url', [{ name: 'wot', dir: 'both', urls: ['wss://relay.example'], pluginDown: GOOD_PLUGIN }]],
  ['empty plugins + no urls', [{ name: 'wot', dir: 'down', urls: [] }]],
  ['ws:// (non-TLS) url', [{ name: 'wot', dir: 'up', urls: ['ws://127.0.0.1:7777'] }]],
];
for (const [label, streams] of ACCEPT) {
  tests.push([`handleUpdateRouterConfig: accepts ${label}`, async () => {
    const res = mkRes();
    await router.handleUpdateRouterConfig(localReq(streams), res);
    assert(res.statusCode !== 400, `legal config was rejected with 400: ${JSON.stringify(res.body)}`);
    assert(res.body && res.body.success === true, `expected success, got ${JSON.stringify(res.body)}`);
  }]);
}

// ── source sentinel ──────────────────────────────────────────────────────────
tests.push(['S: routerConfig.js validates plugin/url and JSON-escapes them at the sink', () => {
  const src = fs.readFileSync(ROUTER, 'utf8');
  assert(/isLegalPluginPath/.test(src) && /isLegalRelayUrl/.test(src), 'must define plugin/url validators');
  assert(/pluginDown = \$\{JSON\.stringify/.test(src) || /JSON\.stringify\(stream\.pluginDown\)/.test(src), 'generateConfig must JSON-escape pluginDown');
  assert(/JSON\.stringify\(url\)/.test(src), 'generateConfig must JSON-escape each url');
}]);

async function run() {
  console.log('\n--- strfry router value-hardening tests ---');
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
  console.log(`\nstrfry-router-value-hardening: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
