'use strict';
/**
 * Access harness — run as a CHILD PROCESS (`node test/helpers/accessHarness.js <spec.json> <result.json>`).
 * Story security-auth-exposure #8, ADR security-auth-exposure/0005 (AC-1/2/3/4/7, and the two owner-only parameter rules).
 *
 * Why a child: the owner and the admins must come from the REAL access check — isOwnerOrAdmin reads the owner through
 * getConfigFromFile (BRAINSTORM_CONF_PATH, ADR Decision 5) and the admins through the settings file
 * (TAPESTRY_SETTINGS_PATH, fixed when src/config/settings.js loads). The parent writes a temp conf and a temp settings
 * file and sets both variables before this process loads anything, so no suite in the gate's process is disturbed and
 * nothing under /etc or /var/lib is read or written.
 *
 * spec.mode === 'middleware'
 *   Builds an Express app: JSON body parser → a test session injector (header X-Test-Session) → the REAL
 *   authMiddleware → a marker handler on every route in spec.routes (optionally behind a real route guard named by
 *   route.realGuard). Listens on an ephemeral loopback port and sends every request in spec.requests:
 *     { id, method, url, caller }   caller ∈ spec.callers: { session|null, proxied: bool, body? }
 *   A proxied caller sends X-Forwarded-For, as all nginx traffic does; a direct-local caller sends none.
 *   Result: { results: [{ id, status, reached, body }] }  (body kept for refusals only).
 *
 * spec.mode === 'handlers'
 *   Calls the client-publish handler and the settings update/reset handlers directly with mock req/res, with
 *   child_process.exec (strfry import) and the owner-assistant key loader stubbed and counted.
 *   Result: { results: [{ id, status, body, keyReads, imports, settingsBefore, settingsAfter }] }
 *
 * spec.customers: pubkeys the customer store reports as active customers (the store itself is stubbed; it is not
 * the access check under test).
 *
 * Every mode also reports { ownerFromConfig } — what getConfigFromFile('BRAINSTORM_OWNER_PUBKEY') answered — so a
 * caller can tell "the conf seam is missing" from "the rule is wrong".
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const Module = require('module');

const ROOT = path.resolve(__dirname, '..', '..');
// Resolve before any chdir, so relative paths are read against the launching cwd.
const SPEC = process.argv[2] ? path.resolve(process.argv[2]) : null;
const OUT = process.argv[3] ? path.resolve(process.argv[3]) : null;
const CONTAINER_PREFIX = '/usr/local/lib/node_modules/brainstorm/';
const REACHED = 'x-sweep-reached';

const out = { results: [], ownerFromConfig: null, error: null };
function finish(code) {
  try { fs.writeFileSync(OUT, JSON.stringify(out)); } catch (e) { process.stderr.write(`accessHarness: cannot write ${OUT}: ${e.message}\n`); code = 2; }
  process.exit(code);
}
if (!SPEC || !OUT) { process.stderr.write('usage: node test/helpers/accessHarness.js <spec.json> <result.json>\n'); process.exit(2); }

for (const k of ['log', 'info', 'warn', 'error', 'debug']) console[k] = () => {};
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (typeof request === 'string' && request.startsWith(CONTAINER_PREFIX)) request = path.join(ROOT, request.slice(CONTAINER_PREFIX.length));
  return origResolve.call(this, request, ...rest);
};
process.chdir(ROOT);

const spec = JSON.parse(fs.readFileSync(SPEC, 'utf8'));
const timer = setTimeout(() => { out.error = `harness did not finish within ${spec.timeoutMs || 90000} ms`; finish(1); }, spec.timeoutMs || 90000);

function stubCustomers() {
  const CM = require(path.join(ROOT, 'src/utils/customerManager'));
  const active = new Set(spec.customers || []);
  if (CM && CM.prototype) {
    CM.prototype.initialize = async function () {};
    CM.prototype.getCustomer = async function (pk) { return active.has(pk) ? { pubkey: pk, status: 'active' } : null; };
  }
}

function ownerFromConfig() {
  try { return require(path.join(ROOT, 'src/utils/config')).getConfigFromFile('BRAINSTORM_OWNER_PUBKEY', null); }
  catch (e) { return `error: ${e.message}`; }
}

async function runMiddleware() {
  stubCustomers();
  const express = require(path.join(ROOT, 'node_modules/express'));
  const { authMiddleware } = require(path.join(ROOT, 'src/middleware/auth.js'));
  const realGuards = {};
  try {
    const sync = require(path.join(ROOT, 'src/api/strfry/negentropyAccess.js'));
    realGuards.requireSyncManagerOrPovSync = sync.requireSyncManagerOrPovSync;
    realGuards.requireSyncManager = sync.requireSyncManager;
  } catch { /* reported per route below */ }

  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use((req, res, next) => {
    const s = req.headers['x-test-session'];
    req.session = s ? JSON.parse(s) : {};
    next();
  });
  app.use(authMiddleware);
  const marker = (req, res) => { res.set(REACHED, '1'); res.status(200).json({ marker: 'reached-handler' }); };
  for (const r of spec.routes) {
    const fn = String(r.method).toLowerCase();
    if (typeof app[fn] !== 'function') continue;
    const guard = r.realGuard ? realGuards[r.realGuard] : null;
    if (r.realGuard && typeof guard !== 'function') throw new Error(`real guard ${r.realGuard} is not available`);
    if (guard) app[fn](r.path, guard, marker); else app[fn](r.path, marker);
  }
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const port = server.address().port;
  const agent = new http.Agent({ keepAlive: true, maxSockets: 16 });

  const send = (q) => new Promise((resolve) => {
    const caller = spec.callers[q.caller];
    const headers = { 'Content-Type': 'application/json' };
    if (caller.proxied) headers['X-Forwarded-For'] = '203.0.113.9';
    if (caller.session) headers['X-Test-Session'] = JSON.stringify(caller.session);
    const payload = q.method === 'GET' || q.method === 'HEAD' ? null : JSON.stringify(q.body || caller.body || {});
    if (payload !== null) headers['Content-Length'] = Buffer.byteLength(payload);
    const r = http.request({ host: '127.0.0.1', port, path: q.url, method: q.method, headers, agent }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        const reached = res.headers[REACHED] === '1';
        let parsed = null;
        if (!reached && body) { try { parsed = JSON.parse(body); } catch { parsed = body.slice(0, 300); } }
        resolve({ id: q.id, status: res.statusCode, reached, body: parsed });
      });
    });
    r.on('error', (e) => resolve({ id: q.id, status: -1, reached: false, body: String(e.message) }));
    if (payload !== null) r.write(payload);
    r.end();
  });

  const queue = spec.requests.slice();
  const workers = Array.from({ length: 16 }, async () => {
    while (queue.length) { const q = queue.shift(); out.results.push(await send(q)); }
  });
  await Promise.all(workers);
  agent.destroy();
  await new Promise((resolve) => server.close(resolve));
}

async function runHandlers() {
  stubCustomers();
  const cp = require('child_process');
  const imports = { n: 0 };
  cp.exec = function (cmd, opts, cb) {
    const done = typeof opts === 'function' ? opts : cb;
    if (/strfry\s+import/.test(String(cmd))) imports.n++;
    const child = { stdin: { write() {}, end() {} }, on() {}, kill() {} };
    if (done) process.nextTick(() => done(null, '', ''));
    return child;
  };
  const nt = require(path.join(ROOT, 'node_modules/nostr-tools'));
  const taSecret = nt.generateSecretKey();
  const keyReads = { n: 0 };
  const assistantKeys = require(path.join(ROOT, 'src/utils/assistantKeys'));
  assistantKeys.getOwnerAssistantKeys = async () => {
    keyReads.n++;
    return { privkey: Buffer.from(taSecret).toString('hex'), pubkey: nt.getPublicKey(taSecret) };
  };
  process.env.TA_PUBKEY = process.env.TA_PUBKEY || nt.getPublicKey(taSecret);

  const { handlePublishEvent } = require(path.join(ROOT, 'src/api/strfry/commands/publishEvent.js'));
  const settingsApi = require(path.join(ROOT, 'src/api/settings/settingsApi.js'));
  const settingsFile = process.env.TAPESTRY_SETTINGS_PATH;
  const readSettings = () => { try { return fs.readFileSync(settingsFile, 'utf8'); } catch { return null; } };

  const clientEvent = () => nt.finalizeEvent({ kind: 1, created_at: Math.floor(Date.now() / 1000), tags: [], content: 'sweep' }, nt.generateSecretKey());

  for (const sc of spec.scenarios) {
    const caller = spec.callers[sc.caller];
    const res = { statusCode: 200, body: undefined };
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (b) => { res.body = b; return res; };
    const req = {
      method: sc.method || 'POST', path: sc.path || '/', headers: { 'content-type': 'application/json' },
      session: caller.session ? { ...caller.session } : {}, params: sc.params || {}, query: {},
      body: sc.body ? JSON.parse(JSON.stringify(sc.body)) : {},
    };
    if (caller.localTrusted) req.localTrusted = true;
    if (sc.kind === 'publish') {
      if (sc.clientSigned) req.body.event = clientEvent();
    }
    if (sc.seedSettings !== undefined) fs.writeFileSync(settingsFile, JSON.stringify(sc.seedSettings, null, 2) + '\n');
    const before = readSettings();
    const k0 = keyReads.n; const i0 = imports.n;
    let error = null;
    try {
      if (sc.kind === 'publish') await handlePublishEvent(req, res);
      else if (sc.kind === 'settings-update') await settingsApi.handleUpdateSettings(req, res);
      else if (sc.kind === 'settings-reset') await settingsApi.handleResetSetting(req, res);
      else throw new Error(`unknown scenario kind ${sc.kind}`);
      await new Promise((r) => setImmediate(r));
    } catch (e) { error = String((e && e.message) || e); }
    out.results.push({
      id: sc.id, status: res.statusCode, body: res.body === undefined ? null : res.body, error,
      keyReads: keyReads.n - k0, imports: imports.n - i0, settingsBefore: before, settingsAfter: readSettings(),
    });
  }
}

(async () => {
  out.ownerFromConfig = ownerFromConfig();
  if (spec.mode === 'middleware') await runMiddleware();
  else if (spec.mode === 'handlers') await runHandlers();
  else throw new Error(`unknown mode ${spec.mode}`);
  clearTimeout(timer);
  finish(0);
})().catch((e) => { out.error = String((e && e.stack) || e); clearTimeout(timer); finish(1); });
