'use strict';
/**
 * The admin-action sweep — the behavioural half (story security-auth-exposure #8, ADR security-auth-exposure/0005).
 * It runs the REAL authMiddleware and the REAL isOwnerOrAdmin in front of marker handlers, through the conf seam the
 * Implementer builds (getConfigFromFile reads BRAINSTORM_CONF_PATH; the admin list reads TAPESTRY_SETTINGS_PATH), the
 * way the story-6 suite runs the middleware in front of markers. Everything runs in a CHILD PROCESS
 * (test/helpers/accessHarness.js): the conf/settings env must be set before any module loads, and no suite in the
 * gate's own process may be disturbed. No still-open route is named: the owner/owner-only route set is derived at
 * runtime from the table; the public reads come from a fixture of what was public before the fix; only the DECIDED
 * allowlist entries and the public reads the deploy relies on — all safe to name — appear as literals.
 *
 *   AC1 — a signed-in stranger is refused 403 on an action the table marks owner/owner-only, and on a fail-closed
 *         route with no table entry, under GET/HEAD/POST/PUT/DELETE and capitalised spellings; the handler never runs.
 *   AC2 — a visitor is refused 401 on the same, under the same methods and spellings; the handler never runs.
 *   AC3 — the owner, an admin and a direct-local caller each reach a fail-closed owner's-side action — the owner and
 *         admin judged by the REAL check through the conf seam, not a stand-in.
 *   AC3b — the conf seam exists: getConfigFromFile sees the temp owner (if it does not, AC-3 can't be shown).
 *   AC4 — the decided allowlist entries still reach their handler for the people named: a visitor reaches
 *         client-signed publish and the public graph query; a signed-in person reaches the POV sync (behind its real
 *         guard); and every signed-in entry the table opens is reachable by a signed-in stranger.
 *   AC5 — every read that was public before the fix still answers a visitor (from the fixture), including the reads
 *         the deploy procedure relies on; and every public read in the table answers a visitor.
 *   AC7 — a refusal is 401 (not signed in) or 403 (signed in, not allowed) with { success:false, error } whose error
 *         names who may act.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const TABLE = path.join(ROOT, 'src/middleware/routeAccess.js');
const HARNESS = path.join(ROOT, 'test/helpers/accessHarness.js');
const PUBLIC_READS = require('./fixtures/admin-action-sweep/public-reads.json').reads;
const NL = String.fromCharCode(10);

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

const OWNER = 'a'.repeat(64);
const ADMIN = 'c'.repeat(64);
const STRANGER = 'b'.repeat(64);
const fill = (p) => p.replace(/:[A-Za-z0-9_]+/g, 'x').replace(/\*/g, 'x');

// The decided allowlist entries (ADR Decision 3) — safe to name. The sign-in handshake is skipped by the middleware,
// so it is covered by AC-4's "reaches" alongside the two decided public mutations.
const DECIDED_PUBLIC = [
  { method: 'POST', path: '/api/strfry/publish', why: 'client-signed publish (principle 2)' },
  { method: 'POST', path: '/api/neo4j/query', why: 'the read backbone (ADR 0001)' },
  { method: 'POST', path: '/api/auth/login', why: 'the sign-in handshake (ADR 0003)' },
];
// The POV sync is signed-in, narrowed by its real route guard to the exact POV shape (book negentropy-sync-access d2).
const POV_SYNC = { method: 'POST', path: '/api/strfry/negentropy-sync', realGuard: 'requireSyncManagerOrPovSync' };
const POV_BODY = { relay: 'wss://nip85.example', dir: 'down', filter: { kinds: [30382], authors: [STRANGER] } };

// The public reads the deploy procedure relies on (scripts/check-safe-to-merge.sh and docs/SMOKE_TEST.md) — safe to name.
const DEPLOY_READS = ['/api/deploy-safety/status', '/api/get-user-counts', '/api/owner/pubkey', '/api/relays', '/api/auth/status'];

const MUT = ['POST', 'PUT', 'DELETE'];

function haveTable() {
  if (!fs.existsSync(TABLE)) return null;
  delete require.cache[require.resolve(TABLE)];
  try { return require(TABLE); } catch { return null; }
}

/** Table paths whose access is `level` (one filled sample path per table key). */
function pathsForAccess(mod, levels) {
  const out = [];
  for (const [key, v] of Object.entries(mod.ROUTE_ACCESS)) {
    if (!v || !levels.includes(v.access)) continue;
    const sp = key.indexOf(' ');
    const method = key.slice(0, sp);
    if (method === 'USE') continue;
    out.push({ method, path: fill(key.slice(sp + 1)), access: v.access, kind: v.kind });
  }
  return out;
}

let RUN = null;
function run_() {
  if (RUN) return RUN;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sweep-access-'));
  const conf = path.join(dir, 'brainstorm.conf');
  const settings = path.join(dir, 'settings.json');
  fs.writeFileSync(conf, `export BRAINSTORM_OWNER_PUBKEY="${OWNER}"${NL}`);
  fs.writeFileSync(settings, JSON.stringify({ adminPubkeys: [ADMIN] }));

  const callers = {
    owner: { session: { authenticated: true, pubkey: OWNER }, proxied: true },
    admin: { session: { authenticated: true, pubkey: ADMIN }, proxied: true },
    stranger: { session: { authenticated: true, pubkey: STRANGER }, proxied: true },
    visitor: { session: null, proxied: true },
    local: { session: null, proxied: false },
  };

  const routes = [];
  const requests = [];
  const seen = new Set();
  const addRoute = (method, p, realGuard) => {
    const k = `${method} ${p}`;
    if (seen.has(k)) return; seen.add(k);
    routes.push(realGuard ? { method, path: p, realGuard } : { method, path: p });
  };

  // Fail-closed synthetic routes (no table entry → resolve to owner): AC-1/2/3 under every method + caps.
  const SYN = '/api/__sweep_failclosed__';
  for (const m of ['GET', 'POST', 'PUT', 'DELETE']) addRoute(m, SYN);
  for (const m of ['GET', 'POST', 'PUT', 'DELETE']) {
    requests.push({ id: `fc-stranger-${m}`, method: m, url: SYN, caller: 'stranger' });
    requests.push({ id: `fc-stranger-${m}-caps`, method: m, url: SYN.replace('/api/', '/API/'), caller: 'stranger' });
    requests.push({ id: `fc-visitor-${m}`, method: m, url: SYN, caller: 'visitor' });
    requests.push({ id: `fc-visitor-${m}-caps`, method: m, url: SYN.replace('/api/', '/API/'), caller: 'visitor' });
  }
  requests.push({ id: 'fc-head-stranger', method: 'HEAD', url: SYN, caller: 'stranger' });
  requests.push({ id: 'fc-head-visitor', method: 'HEAD', url: SYN, caller: 'visitor' });
  for (const c of ['owner', 'admin', 'local']) {
    requests.push({ id: `fc-${c}-POST`, method: 'POST', url: SYN, caller: c });
    requests.push({ id: `fc-${c}-GET`, method: 'GET', url: SYN, caller: c });
  }

  // Table-derived owner/owner-only routes (if the table exists): AC-1/AC-2 on each.
  const mod = haveTable();
  let tableOwner = [];
  if (mod) {
    tableOwner = pathsForAccess(mod, ['owner', 'owner-only']);
    for (const r of tableOwner) {
      addRoute(r.method, r.path);
      requests.push({ id: `t-stranger|${r.method} ${r.path}`, method: r.method, url: r.path, caller: 'stranger' });
      requests.push({ id: `t-visitor|${r.method} ${r.path}`, method: r.method, url: r.path, caller: 'visitor' });
    }
  }

  // AC-4: decided public entries reach a visitor; the POV sync reaches a signed-in person via its real guard.
  for (const e of DECIDED_PUBLIC) {
    addRoute(e.method, e.path);
    requests.push({ id: `d-visitor|${e.method} ${e.path}`, method: e.method, url: e.path, caller: 'visitor' });
  }
  addRoute(POV_SYNC.method, POV_SYNC.path, POV_SYNC.realGuard);
  requests.push({ id: 'pov-signed-in', method: POV_SYNC.method, url: POV_SYNC.path, caller: 'stranger', body: POV_BODY });
  requests.push({ id: 'pov-visitor', method: POV_SYNC.method, url: POV_SYNC.path, caller: 'visitor', body: POV_BODY });

  // AC-4: every signed-in entry the table opens is reachable by a signed-in stranger.
  let tableSignedIn = [];
  if (mod) {
    tableSignedIn = pathsForAccess(mod, ['signed-in']).filter((r) => r.path !== fill('/api/strfry/negentropy-sync'));
    for (const r of tableSignedIn) {
      addRoute(r.method, r.path);
      requests.push({ id: `si-stranger|${r.method} ${r.path}`, method: r.method, url: r.path, caller: 'stranger' });
    }
  }

  // AC-5: every read that was public before the fix still answers a visitor.
  for (const key of PUBLIC_READS) {
    const sp = key.indexOf(' ');
    const method = key.slice(0, sp);
    const p = fill(key.slice(sp + 1));
    addRoute(method, p);
    requests.push({ id: `r|${key}`, method, url: p, caller: 'visitor' });
  }
  // AC-5: the deploy-relied reads by name (regression guard, independent of the fixture).
  for (const p of DEPLOY_READS) { addRoute('GET', p); requests.push({ id: `deploy|${p}`, method: 'GET', url: p, caller: 'visitor' }); }
  // AC-5: every public read the table marks (if the table exists).
  let tablePublicReads = [];
  if (mod) {
    tablePublicReads = pathsForAccess(mod, ['public']).filter((r) => r.kind === 'read');
    for (const r of tablePublicReads) {
      addRoute(r.method, r.path);
      requests.push({ id: `tr|${r.method} ${r.path}`, method: r.method, url: r.path, caller: 'visitor' });
    }
  }

  const spec = { mode: 'middleware', callers, routes, requests, customers: [], timeoutMs: 120000 };
  const specFile = path.join(dir, 'spec.json');
  const outFile = path.join(dir, 'out.json');
  fs.writeFileSync(specFile, JSON.stringify(spec));
  const env = { ...process.env, TAPESTRY_SETTINGS_PATH: settings, BRAINSTORM_CONF_PATH: conf, BRAINSTORM_BASE_DIR: dir };
  const child = spawnSync(process.execPath, [HARNESS, specFile, outFile], { cwd: ROOT, env, encoding: 'utf8', timeout: 150000 });
  let data = null;
  try { data = JSON.parse(fs.readFileSync(outFile, 'utf8')); } catch { /* reported by tests */ }
  const byId = new Map();
  if (data) for (const r of data.results) byId.set(r.id, r);
  RUN = { child, data, byId, mod, tableOwner, tableSignedIn, tablePublicReads };
  return RUN;
}

const get = (id) => { const r = run_().byId.get(id); assert(r, `no harness result for ${id} (harness error: ${run_().data && run_().data.error})`); return r; };

// ── The two parameter-level owner-only rules (ADR 0005 Decision 4; owner's gate decision 3) ──
let HRUN = null;
function handlers_() {
  if (HRUN) return HRUN;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sweep-params-'));
  const conf = path.join(dir, 'brainstorm.conf');
  const settings = path.join(dir, 'settings.json');
  fs.writeFileSync(conf, `export BRAINSTORM_OWNER_PUBKEY="${OWNER}"${NL}`);
  fs.writeFileSync(settings, JSON.stringify({ adminPubkeys: [ADMIN] }));
  const spec = {
    mode: 'handlers',
    callers: {
      owner: { session: { authenticated: true, pubkey: OWNER } },
      admin: { session: { authenticated: true, pubkey: ADMIN } },
      local: { session: null, localTrusted: true },
    },
    customers: [],
    scenarios: [
      { id: 'assistant-admin', kind: 'publish', caller: 'admin', body: { signAs: 'assistant', event: { kind: 1, tags: [], content: 'x' } } },
      { id: 'assistant-owner', kind: 'publish', caller: 'owner', body: { signAs: 'assistant', event: { kind: 1, tags: [], content: 'x' } } },
      { id: 'assistant-local', kind: 'publish', caller: 'local', body: { signAs: 'assistant', event: { kind: 1, tags: [], content: 'x' } } },
      { id: 'client-owner', kind: 'publish', caller: 'owner', clientSigned: true, body: { signAs: 'client' } },
      { id: 'adminlist-update-admin', kind: 'settings-update', caller: 'admin', seedSettings: { adminPubkeys: [ADMIN] }, body: { adminPubkeys: [ADMIN, OWNER] } },
      { id: 'adminlist-reset-admin', kind: 'settings-reset', caller: 'admin', seedSettings: { adminPubkeys: [ADMIN] }, params: { keyPath: 'adminPubkeys' } },
      { id: 'adminlist-update-owner', kind: 'settings-update', caller: 'owner', seedSettings: { adminPubkeys: [ADMIN] }, body: { adminPubkeys: [ADMIN, OWNER] } },
      { id: 'settings-other-admin', kind: 'settings-update', caller: 'admin', seedSettings: { adminPubkeys: [ADMIN] }, body: { aRelays: { aProfileRelays: ['wss://relay.example'] } } },
    ],
    timeoutMs: 60000,
  };
  const specFile = path.join(dir, 'spec.json');
  const outFile = path.join(dir, 'out.json');
  fs.writeFileSync(specFile, JSON.stringify(spec));
  const env = { ...process.env, TAPESTRY_SETTINGS_PATH: settings, BRAINSTORM_CONF_PATH: conf, BRAINSTORM_BASE_DIR: dir };
  const child = spawnSync(process.execPath, [HARNESS, specFile, outFile], { cwd: ROOT, env, encoding: 'utf8', timeout: 90000 });
  let data = null;
  try { data = JSON.parse(fs.readFileSync(outFile, 'utf8')); } catch { /* reported by tests */ }
  const byId = new Map();
  if (data) for (const r of data.results) byId.set(r.id, r);
  HRUN = { child, data, byId };
  return HRUN;
}
const hget = (id) => { const r = handlers_().byId.get(id); assert(r, `no handler result for ${id} (harness error: ${handlers_().data && handlers_().data.error})`); return r; };

function refusalNamesWho(body) {
  return body && body.success === false && typeof body.error === 'string'
    && /owner|admin|sign in|signed in/i.test(body.error);
}

test('AC3b: the conf seam exists — getConfigFromFile sees the temp owner', () => {
  const { data } = run_();
  assert(data, `the access harness did not run: ${run_().child.stderr && run_().child.stderr.slice(0, 300)}`);
  assert(data.ownerFromConfig === OWNER,
    `getConfigFromFile('BRAINSTORM_OWNER_PUBKEY') returned ${JSON.stringify(data.ownerFromConfig)}; the BRAINSTORM_CONF_PATH seam (ADR 0005 Decision 5) is missing, so the owner/admin pass can't be shown against the real check`);
});

test('AC1: a signed-in stranger is refused 403 on every owner-side action, under every method and spelling', () => {
  const { tableOwner } = run_();
  const wrong = [];
  for (const m of ['GET', 'POST', 'PUT', 'DELETE']) {
    for (const suffix of ['', '-caps']) {
      const r = get(`fc-stranger-${m}${suffix}`);
      if (r.reached || r.status !== 403) wrong.push(`fail-closed ${m}${suffix} → ${r.status}${r.reached ? ' (reached)' : ''}`);
    }
  }
  const head = get('fc-head-stranger');
  if (head.reached || head.status !== 403) wrong.push(`fail-closed HEAD → ${head.status}${head.reached ? ' (reached)' : ''}`);
  for (const r of tableOwner) {
    const x = get(`t-stranger|${r.method} ${r.path}`);
    if (x.reached || x.status !== 403) wrong.push(`${r.method} ${r.path} → ${x.status}${x.reached ? ' (reached)' : ''}`);
  }
  assert(run_().mod, 'src/middleware/routeAccess.js does not exist yet — the owner/owner-only route set cannot be derived (ADR 0005 Decision 1)');
  assert(wrong.length === 0, `a signed-in stranger was not refused 403:${NL}        ${wrong.slice(0, 40).join(NL + '        ')}`);
});

test('AC2: a visitor is refused 401 on every owner-side action, under every method and spelling', () => {
  const { tableOwner } = run_();
  const wrong = [];
  for (const m of ['GET', 'POST', 'PUT', 'DELETE']) {
    for (const suffix of ['', '-caps']) {
      const r = get(`fc-visitor-${m}${suffix}`);
      if (r.reached || r.status !== 401) wrong.push(`fail-closed ${m}${suffix} → ${r.status}${r.reached ? ' (reached)' : ''}`);
    }
  }
  const head = get('fc-head-visitor');
  if (head.reached || head.status !== 401) wrong.push(`fail-closed HEAD → ${head.status}${head.reached ? ' (reached)' : ''}`);
  for (const r of tableOwner) {
    const x = get(`t-visitor|${r.method} ${r.path}`);
    if (x.reached || x.status !== 401) wrong.push(`${r.method} ${r.path} → ${x.status}${x.reached ? ' (reached)' : ''}`);
  }
  assert(run_().mod, 'src/middleware/routeAccess.js does not exist yet — the owner/owner-only route set cannot be derived (ADR 0005 Decision 1)');
  assert(wrong.length === 0, `a visitor was not refused 401:${NL}        ${wrong.slice(0, 40).join(NL + '        ')}`);
});

test('AC3: the owner, an admin and a direct-local caller each reach a fail-closed owner-side action', () => {
  const wrong = [];
  for (const c of ['owner', 'admin', 'local']) {
    for (const m of ['POST', 'GET']) {
      const r = get(`fc-${c}-${m}`);
      if (!r.reached) wrong.push(`${c} ${m} → ${r.status} (did not reach)`);
    }
  }
  assert(wrong.length === 0, `the owner's side lost a fail-closed action:${NL}        ${wrong.join(NL + '        ')}`);
});

test('AC4: the decided allowlist entries reach their handler for the people named', () => {
  const wrong = [];
  for (const e of DECIDED_PUBLIC) {
    const r = get(`d-visitor|${e.method} ${e.path}`);
    if (!r.reached) wrong.push(`visitor ${e.method} ${e.path} → ${r.status} (did not reach; ${e.why})`);
  }
  const pov = get('pov-signed-in');
  if (!pov.reached) wrong.push(`signed-in POV sync → ${pov.status} (did not reach)`);
  const povVisitor = get('pov-visitor');
  if (povVisitor.reached || povVisitor.status !== 401) wrong.push(`a visitor must not reach the POV sync → ${povVisitor.status}${povVisitor.reached ? ' (reached)' : ''}`);
  assert(wrong.length === 0, `a decided allowlist entry did not behave as decided:${NL}        ${wrong.join(NL + '        ')}`);
});

test('AC4: every signed-in entry the table opens is reachable by a signed-in stranger', () => {
  const { mod, tableSignedIn } = run_();
  assert(mod, 'src/middleware/routeAccess.js does not exist yet — the signed-in allowlist cannot be derived (ADR 0005 Decision 1)');
  const wrong = [];
  for (const r of tableSignedIn) {
    const x = get(`si-stranger|${r.method} ${r.path}`);
    if (!x.reached) wrong.push(`${r.method} ${r.path} → ${x.status} (a signed-in person could not reach an allowlisted action)`);
  }
  assert(wrong.length === 0, `a signed-in allowlist entry did not reach its handler:${NL}        ${wrong.slice(0, 40).join(NL + '        ')}`);
});

test('AC5: every read that was public before the fix still answers a visitor, deploy reads included', () => {
  const wrong = [];
  for (const key of PUBLIC_READS) {
    const r = get(`r|${key}`);
    if (!r.reached) wrong.push(`${key} → ${r.status} (a public read stopped answering a visitor)`);
  }
  for (const p of DEPLOY_READS) {
    const r = get(`deploy|${p}`);
    if (!r.reached) wrong.push(`GET ${p} → ${r.status} (a deploy-relied read stopped answering)`);
  }
  assert(wrong.length === 0, `a read changed (AC-5 violation):${NL}        ${wrong.slice(0, 40).join(NL + '        ')}`);
});

test('AC5: every public read the table marks answers a visitor', () => {
  const { mod, tablePublicReads } = run_();
  assert(mod, 'src/middleware/routeAccess.js does not exist yet — the table\'s public reads cannot be derived (ADR 0005 Decision 1)');
  const wrong = [];
  for (const r of tablePublicReads) {
    const x = get(`tr|${r.method} ${r.path}`);
    if (!x.reached) wrong.push(`${r.method} ${r.path} → ${x.status}`);
  }
  assert(wrong.length === 0, `a table public read did not answer a visitor:${NL}        ${wrong.slice(0, 40).join(NL + '        ')}`);
});

test('AC7: refusals are 401/403 with { success:false, error } naming who may act', () => {
  const v = get('fc-visitor-POST');
  assert(v.status === 401, `a visitor's refusal must be 401; got ${v.status}`);
  assert(refusalNamesWho(v.body), `the 401 body must be { success:false, error:<names who> }; got ${JSON.stringify(v.body)}`);
  const s = get('fc-stranger-POST');
  assert(s.status === 403, `a signed-in stranger's refusal must be 403; got ${s.status}`);
  assert(refusalNamesWho(s.body), `the 403 body must be { success:false, error:<names who> }; got ${JSON.stringify(s.body)}`);
});

test('PARAM1: signing as the instance assistant is owner-only — an admin is refused 403, the owner is allowed', () => {
  const { data } = handlers_();
  assert(data, `the handlers harness did not run: ${handlers_().child.stderr && handlers_().child.stderr.slice(0, 300)}`);
  assert(data.ownerFromConfig === OWNER, `the conf seam is missing (ownerFromConfig ${JSON.stringify(data.ownerFromConfig)}); the owner's pass on signAs:assistant can't be shown`);
  const admin = hget('assistant-admin');
  assert(admin.status === 403 && admin.keyReads === 0 && admin.imports === 0,
    `an admin signing as the assistant must be refused before any key read or publish (settles OPEN.md row 269); got status ${admin.status}, keyReads ${admin.keyReads}, imports ${admin.imports}`);
  const owner = hget('assistant-owner');
  assert(owner.status !== 403 && owner.keyReads >= 1,
    `the owner must be allowed to sign as the assistant; got status ${owner.status}, keyReads ${owner.keyReads}`);
});

test('PARAM1b: client-signed publish still never reads the assistant key (regression)', () => {
  const r = hget('client-owner');
  assert(r.status === 200 && r.keyReads === 0, `a client-signed publish must not touch the TA key; got status ${r.status}, keyReads ${r.keyReads}`);
});

test('PARAM2: changing the admin list is owner-only — an admin is refused on update and reset, the owner is allowed', () => {
  const up = hget('adminlist-update-admin');
  assert(up.status === 403 && up.settingsBefore === up.settingsAfter,
    `an admin changing adminPubkeys through a settings update must be refused and write nothing; got status ${up.status}, changed ${up.settingsBefore !== up.settingsAfter}`);
  const rst = hget('adminlist-reset-admin');
  assert(rst.status === 403 && rst.settingsBefore === rst.settingsAfter,
    `an admin resetting adminPubkeys must be refused and write nothing; got status ${rst.status}, changed ${rst.settingsBefore !== rst.settingsAfter}`);
  const owner = hget('adminlist-update-owner');
  assert(owner.status === 200 && owner.settingsAfter && owner.settingsAfter.includes(OWNER),
    `the owner must be allowed to change the admin list; got status ${owner.status}`);
});

test('PARAM2b: an admin may still change a non-admin-list setting (admins equal the owner elsewhere)', () => {
  const r = hget('settings-other-admin');
  assert(r.status === 200, `an admin updating a non-admin-list setting must still work; got status ${r.status}`);
});

async function run() {
  console.log(`${NL}=== admin-action-sweep-access ===`);
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  PASS  ${name}`); pass++; } catch (err) {
      console.log(`  FAIL  ${name}${NL}        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`${NL}admin-action-sweep-access: ${pass} passed, ${fail} failed, 0 skipped`);
  return { pass, fail, failures, skipped: 0 };
}

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
