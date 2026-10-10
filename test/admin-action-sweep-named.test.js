'use strict';
/**
 * Names members of the admin-action class and the two sensitive reads the owner closed at the Architecture gate. It was
 * held out of the repo until the fix shipped (book admin-action-owner-check, ground rule 1) and committed with it.
 *
 * Story security-auth-exposure #8, ADR security-auth-exposure/0005. Pinned, by name, against the REAL authMiddleware and
 * the REAL isOwnerOrAdmin through the conf seam (child process: test/helpers/accessHarness.js), in front of marker
 * handlers, so each assertion is about the central access decision and nothing actually runs:
 *
 *   N1 — a GET that acts (and its HEAD, and its ?action= form) is refused: 401 to a visitor, 403 to a signed-in
 *        stranger; the handler never runs. (The owner-only list matched POST only, so these were open to everyone.)
 *   N2 — the two sensitive public reads the owner closed now refuse: 401 to a visitor, 403 to a signed-in stranger.
 *        (Their /api/auth/* and plain-read paths meant a visitor read them before.)
 *   N3 — a destructive class-A mutation is refused 401/403 under its own method and a capitalised spelling.
 *   N4 — a class-A action that signs or republishes with the instance's own identity is refused 401/403.
 *   N5 — the owner and an admin still reach each of the above (AC-3: the owner's side loses nothing).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const HARNESS = path.join(ROOT, 'test/helpers/accessHarness.js');
const NL = String.fromCharCode(10);

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

const OWNER = 'a'.repeat(64);
const ADMIN = 'c'.repeat(64);
const STRANGER = 'b'.repeat(64);

// Named members of class A and the two closed reads (HELD).
const GETS_THAT_ACT = ['/api/systemd-services', '/api/search/profiles/keyword/precompute-whitelist-maps'];
const CLOSED_READS = ['/api/auth/test', '/api/io/exports', '/api/io/exports/download.jsonl'];
const DESTRUCTIVE = { method: 'DELETE', path: '/api/search/profiles/meili/wipe' };
const IDENTITY_ACTION = { method: 'POST', path: '/api/trusted-list/publish' };

let RUN = null;
function run_() {
  if (RUN) return RUN;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sweep-named-'));
  const conf = path.join(dir, 'brainstorm.conf');
  const settings = path.join(dir, 'settings.json');
  fs.writeFileSync(conf, `export BRAINSTORM_OWNER_PUBKEY="${OWNER}"${NL}`);
  fs.writeFileSync(settings, JSON.stringify({ adminPubkeys: [ADMIN] }));

  const callers = {
    owner: { session: { authenticated: true, pubkey: OWNER }, proxied: true },
    admin: { session: { authenticated: true, pubkey: ADMIN }, proxied: true },
    stranger: { session: { authenticated: true, pubkey: STRANGER }, proxied: true },
    visitor: { session: null, proxied: true },
  };
  const routes = [];
  const requests = [];
  const seen = new Set();
  const route = (method, p) => { const k = `${method} ${p}`; if (!seen.has(k)) { seen.add(k); routes.push({ method, path: p }); } };
  const ask = (id, method, url, caller) => requests.push({ id, method, url, caller });

  for (const p of GETS_THAT_ACT) {
    route('GET', p);
    ask(`get-visitor|${p}`, 'GET', p, 'visitor');
    ask(`get-stranger|${p}`, 'GET', p, 'stranger');
    ask(`get-visitor-q|${p}`, 'GET', `${p}?action=start&service=neo4j`, 'visitor');
    ask(`head-visitor|${p}`, 'HEAD', p, 'visitor');
    ask(`get-owner|${p}`, 'GET', p, 'owner');
    ask(`get-admin|${p}`, 'GET', p, 'admin');
  }
  for (const p of CLOSED_READS) {
    route('GET', p);
    ask(`read-visitor|${p}`, 'GET', p, 'visitor');
    ask(`read-stranger|${p}`, 'GET', p, 'stranger');
    ask(`read-owner|${p}`, 'GET', p, 'owner');
    ask(`read-admin|${p}`, 'GET', p, 'admin');
  }
  for (const e of [DESTRUCTIVE, IDENTITY_ACTION]) {
    route(e.method, e.path);
    ask(`act-visitor|${e.method} ${e.path}`, e.method, e.path, 'visitor');
    ask(`act-stranger|${e.method} ${e.path}`, e.method, e.path, 'stranger');
    ask(`act-stranger-caps|${e.method} ${e.path}`, e.method, e.path.replace('/api/', '/API/'), 'stranger');
    ask(`act-owner|${e.method} ${e.path}`, e.method, e.path, 'owner');
    ask(`act-admin|${e.method} ${e.path}`, e.method, e.path, 'admin');
  }

  const spec = { mode: 'middleware', callers, routes, requests, customers: [], timeoutMs: 60000 };
  const specFile = path.join(dir, 'spec.json');
  const outFile = path.join(dir, 'out.json');
  fs.writeFileSync(specFile, JSON.stringify(spec));
  const env = { ...process.env, TAPESTRY_SETTINGS_PATH: settings, BRAINSTORM_CONF_PATH: conf, BRAINSTORM_BASE_DIR: dir };
  const child = spawnSync(process.execPath, [HARNESS, specFile, outFile], { cwd: ROOT, env, encoding: 'utf8', timeout: 90000 });
  let data = null;
  try { data = JSON.parse(fs.readFileSync(outFile, 'utf8')); } catch { /* reported by tests */ }
  const byId = new Map();
  if (data) for (const r of data.results) byId.set(r.id, r);
  RUN = { child, data, byId };
  return RUN;
}
const get = (id) => { const r = run_().byId.get(id); assert(r, `no result for ${id} (harness error: ${run_().data && run_().data.error})`); return r; };
const refused = (r, want) => !r.reached && r.status === want && r.body && r.body.success === false && typeof r.body.error === 'string';
// A response to HEAD carries no body (HTTP), so a HEAD refusal is judged by its status and by the handler not running.
const refusedHead = (r, want) => !r.reached && r.status === want;

test('N0: the harness ran with the conf seam in place', () => {
  const { data } = run_();
  assert(data, `the harness did not run: ${run_().child.stderr && run_().child.stderr.slice(0, 300)}`);
  assert(data.ownerFromConfig === OWNER, `the conf seam is missing (ownerFromConfig ${JSON.stringify(data.ownerFromConfig)})`);
});

test('N1: a GET that acts is refused — 401 to a visitor, 403 to a signed-in stranger, HEAD and ?action= included', () => {
  const wrong = [];
  for (const p of GETS_THAT_ACT) {
    if (!refused(get(`get-visitor|${p}`), 401)) wrong.push(`visitor GET ${p}`);
    if (!refused(get(`get-stranger|${p}`), 403)) wrong.push(`stranger GET ${p}`);
    if (!refused(get(`get-visitor-q|${p}`), 401)) wrong.push(`visitor GET ${p}?action=`);
    if (!refusedHead(get(`head-visitor|${p}`), 401)) wrong.push(`visitor HEAD ${p}`);
  }
  assert(wrong.length === 0, `a GET that acts was not refused:${NL}        ${wrong.join(NL + '        ')}`);
});

test('N2: the two sensitive reads the owner closed now refuse — 401 to a visitor, 403 to a stranger', () => {
  const wrong = [];
  for (const p of CLOSED_READS) {
    if (!refused(get(`read-visitor|${p}`), 401)) wrong.push(`visitor GET ${p}`);
    if (!refused(get(`read-stranger|${p}`), 403)) wrong.push(`stranger GET ${p}`);
  }
  assert(wrong.length === 0, `a closed sensitive read still answered:${NL}        ${wrong.join(NL + '        ')}`);
});

test('N3: a destructive class-A mutation is refused under its method and a capitalised spelling', () => {
  const e = DESTRUCTIVE;
  const wrong = [];
  if (!refused(get(`act-visitor|${e.method} ${e.path}`), 401)) wrong.push('visitor');
  if (!refused(get(`act-stranger|${e.method} ${e.path}`), 403)) wrong.push('stranger');
  if (!refused(get(`act-stranger-caps|${e.method} ${e.path}`), 403)) wrong.push('stranger (capitalised)');
  assert(wrong.length === 0, `${e.method} ${e.path} not refused for: ${wrong.join(', ')}`);
});

test('N4: a class-A action that uses the instance identity is refused 401/403', () => {
  const e = IDENTITY_ACTION;
  const wrong = [];
  if (!refused(get(`act-visitor|${e.method} ${e.path}`), 401)) wrong.push('visitor');
  if (!refused(get(`act-stranger|${e.method} ${e.path}`), 403)) wrong.push('stranger');
  assert(wrong.length === 0, `${e.method} ${e.path} not refused for: ${wrong.join(', ')}`);
});

test('N5: the owner and an admin still reach each of these (AC-3: the owner\'s side loses nothing)', () => {
  const wrong = [];
  for (const p of GETS_THAT_ACT) {
    if (!get(`get-owner|${p}`).reached) wrong.push(`owner GET ${p}`);
    if (!get(`get-admin|${p}`).reached) wrong.push(`admin GET ${p}`);
  }
  for (const p of CLOSED_READS) {
    if (!get(`read-owner|${p}`).reached) wrong.push(`owner GET ${p}`);
    if (!get(`read-admin|${p}`).reached) wrong.push(`admin GET ${p}`);
  }
  for (const e of [DESTRUCTIVE, IDENTITY_ACTION]) {
    if (!get(`act-owner|${e.method} ${e.path}`).reached) wrong.push(`owner ${e.method} ${e.path}`);
    if (!get(`act-admin|${e.method} ${e.path}`).reached) wrong.push(`admin ${e.method} ${e.path}`);
  }
  assert(wrong.length === 0, `the owner's side was blocked on:${NL}        ${wrong.join(NL + '        ')}`);
});

async function run() {
  console.log(`${NL}=== admin-action-sweep-named (HELD until the fix ships) ===`);
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  PASS  ${name}`); pass++; } catch (err) {
      console.log(`  FAIL  ${name}${NL}        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`${NL}admin-action-sweep-named: ${pass} passed, ${fail} failed, 0 skipped`);
  return { pass, fail, failures, skipped: 0 };
}

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
