'use strict';
/**
 * Who may run a negentropy sync (owner decision, 2026-10-10; src/api/strfry/negentropyAccess.js). The owner, an admin
 * or a direct-local caller (the loopback task scripts) may run any sync. A signed-in person who is neither may run one
 * narrow sync: download one author's kind 30382 Trusted Assertions, which Brainstorm Search, Search Preferences and
 * Brainstorm Settings use to bring a chosen point of view's scores here. Everyone else is refused. Stack-free: the
 * owner/admin check is injected, and no route handler runs.
 *
 *   A1 — isPovSync accepts exactly { dir: 'down', filter: { kinds: [30382], authors: [<one hex pubkey>] } }.
 *   A2 — isPovSync refuses every other direction, kind, author count, extra filter key or malformed body.
 *   A3 — requireSyncManager: not signed in → 401, signed in → 403, owner/admin or direct-local → next; nothing else runs.
 *   A4 — requireSyncManagerOrPovSync: the owner, an admin or a direct-local caller run anything; a signed-in person
 *        runs only the POV sync (403 otherwise); a visitor who is not signed in is refused 401, even for the POV sync.
 *   A5 — the strfry sync routes are wired behind the guards: POST behind requireSyncManagerOrPovSync; stream, status
 *        and count behind requireSyncManager.
 *   A6 — the four legacy sync routes in src/api/index.js are wired behind requireSyncManager.
 *   A7 — the saved presets' guard admits the owner and admins: requireOwnerOrLocal uses isOwner, the alias of
 *        isOwnerOrAdmin.
 *   A8 — the three pages that sync a point of view send exactly the POV-sync shape, so the narrow rule keeps them working.
 *   A9 — the default guards use the real isOwnerOrAdmin from src/middleware/auth.js.
 *   A10 — where the presets module exists, its list GET is behind requireSyncManager (owner decision, 2026-10-10).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ACCESS = path.join(ROOT, 'src/api/strfry/negentropyAccess.js');
const SYNC = path.join(ROOT, 'src/api/strfry/negentropySync.js');
const NL = String.fromCharCode(10);

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
const show = (v) => JSON.stringify(v);
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function access() {
  assert(fs.existsSync(ACCESS), 'src/api/strfry/negentropyAccess.js does not exist');
  return require(ACCESS);
}

const PK = 'a'.repeat(64);
const POV = { relay: 'wss://nip85.example', dir: 'down', filter: { kinds: [30382], authors: [PK] } };

const anonymous = () => ({ session: {} });
const signedIn = () => ({ session: { authenticated: true, pubkey: 'b'.repeat(64) } });
const manager = () => ({ session: { authenticated: true, pubkey: 'c'.repeat(64) } });
const local = () => ({ localTrusted: true });

/** Guards whose owner/admin check answers true only for manager()'s pubkey. */
function guards() {
  const { createSyncGuards } = access();
  assert(typeof createSyncGuards === 'function', 'createSyncGuards is not exported');
  return createSyncGuards({ isOwnerOrAdmin: (req) => Boolean(req.session && req.session.authenticated && req.session.pubkey === 'c'.repeat(64)) });
}

/** Run one guard; returns whether next() ran and what was answered. */
function call(guard, req) {
  let nexted = false;
  const res = { statusCode: 200, body: undefined };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (b) => { res.body = b; return res; };
  guard(req, res, () => { nexted = true; });
  return { nexted, status: nexted ? null : res.statusCode, body: res.body };
}

test('A1: isPovSync accepts exactly one author\'s kind 30382, downloaded', () => {
  const { isPovSync, POV_SYNC_KIND } = access();
  assert(POV_SYNC_KIND === 30382, `POV_SYNC_KIND: ${POV_SYNC_KIND}`);
  assert(isPovSync(POV) === true, 'the POV sync itself');
  assert(isPovSync({ relay: 'wss://x.example', dir: 'down', filter: { authors: [PK], kinds: [30382] } }) === true, 'keys in either order');
});

test('A2: isPovSync refuses every other direction, kind, author count, extra key or malformed body', () => {
  const { isPovSync } = access();
  const bad = [
    { ...POV, dir: 'up' }, { ...POV, dir: 'both' }, { relay: POV.relay, filter: POV.filter },
    { ...POV, filter: { kinds: [3], authors: [PK] } }, { ...POV, filter: { kinds: [30382, 0], authors: [PK] } },
    { ...POV, filter: { kinds: ['30382'], authors: [PK] } }, { ...POV, filter: { kinds: [30382] } },
    { ...POV, filter: { kinds: [30382], authors: [] } }, { ...POV, filter: { kinds: [30382], authors: [PK, 'd'.repeat(64)] } },
    { ...POV, filter: { kinds: [30382], authors: ['A'.repeat(64)] } }, { ...POV, filter: { kinds: [30382], authors: ['abc'] } },
    { ...POV, filter: { kinds: [30382], authors: [PK], since: 1 } }, { ...POV, filter: { kinds: [30382], authors: [PK], '#p': [PK] } },
    { ...POV, filter: [] }, { ...POV, filter: 'x' }, { ...POV, filter: null }, null, undefined, 'text',
  ];
  const wrong = bad.filter((b) => isPovSync(b) !== false).map(show);
  assert(wrong.length === 0, `accepted: ${wrong.join('; ')}`);
});

test('A3: requireSyncManager — not signed in 401, signed in 403, owner/admin or direct-local next', () => {
  const { requireSyncManager } = guards();
  const anon = call(requireSyncManager, anonymous());
  assert(!anon.nexted && anon.status === 401 && anon.body && anon.body.success === false, `not signed in: ${show(anon)}`);
  const none = call(requireSyncManager, { headers: {} });
  assert(!none.nexted && none.status === 401, `no session at all: ${show(none)}`);
  const user = call(requireSyncManager, { ...signedIn(), body: POV });
  assert(!user.nexted && user.status === 403 && user.body && user.body.success === false, `signed in, even with the POV body: ${show(user)}`);
  assert(call(requireSyncManager, manager()).nexted, 'owner or admin');
  assert(call(requireSyncManager, local()).nexted, 'direct-local');
});

test('A4: requireSyncManagerOrPovSync — managers run anything, signed-in people only the POV sync', () => {
  const { requireSyncManagerOrPovSync } = guards();
  const other = { relay: 'wss://x.example', dir: 'up', filter: {} };
  assert(call(requireSyncManagerOrPovSync, { ...manager(), body: other }).nexted, 'owner or admin, any sync');
  assert(call(requireSyncManagerOrPovSync, { ...local(), body: other }).nexted, 'direct-local, any sync');
  assert(call(requireSyncManagerOrPovSync, { ...signedIn(), body: POV }).nexted, 'signed in, the POV sync');
  const user = call(requireSyncManagerOrPovSync, { ...signedIn(), body: other });
  assert(!user.nexted && user.status === 403, `signed in, another sync: ${show(user)}`);
  const anon = call(requireSyncManagerOrPovSync, { ...anonymous(), body: POV });
  assert(!anon.nexted && anon.status === 401, `not signed in, even the POV sync: ${show(anon)}`);
});

test('A5: the strfry sync routes are wired behind the guards', () => {
  const a = access();
  const routes = {};
  const app = {
    get: (p, ...h) => { routes[`GET ${p}`] = h; },
    post: (p, ...h) => { routes[`POST ${p}`] = h; },
  };
  delete require.cache[require.resolve(SYNC)];
  require(SYNC).registerNegentropySyncRoutes(app);
  const want = {
    'POST /api/strfry/negentropy-sync': a.requireSyncManagerOrPovSync,
    'GET /api/strfry/negentropy-sync/stream': a.requireSyncManager,
    'GET /api/strfry/negentropy-sync/status': a.requireSyncManager,
    'GET /api/strfry/negentropy-sync/count': a.requireSyncManager,
  };
  const wrong = [];
  for (const [route, guard] of Object.entries(want)) {
    const h = routes[route];
    if (!h) wrong.push(`${route} not registered`);
    else if (h.length !== 2 || h[0] !== guard) wrong.push(`${route} is not behind ${guard && guard.name}`);
  }
  assert(Object.keys(routes).length === 4, `four routes, got ${Object.keys(routes).join(', ')}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('A6: the four legacy sync routes in src/api/index.js are wired behind requireSyncManager', () => {
  const src = read('src/api/index.js');
  assert(/require\('\.\/strfry\/negentropyAccess'\)/.test(src), 'index.js requires ./strfry/negentropyAccess');
  const wrong = [];
  for (const [route, handler] of [
    ['/api/negentropy-sync', 'pipeline.handleNegentropySync'],
    ['/api/negentropy-sync-wot', 'manage.handleNegentropySyncWoT'],
    ['/api/negentropy-sync-profiles', 'manage.handleNegentropySyncProfiles'],
    ['/api/negentropy-sync-personal', 'manage.handleNegentropySyncPersonal'],
  ]) {
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`app\\.post\\('${esc(route)}',\\s*requireSyncManager,\\s*${esc(handler)}\\)`);
    if (!re.test(src)) wrong.push(route);
    const loose = new RegExp(`app\\.(post|get)\\('${esc(route)}',\\s*${esc(handler)}\\)`);
    if (loose.test(src)) wrong.push(`${route} is still registered without the guard`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('A7: the saved presets\' guard admits the owner and admins', () => {
  const router = read('src/api/strfry/routerConfig.js');
  assert(/function requireOwnerOrLocal\(req, res\) \{\s*if \(isOwner\(req\) \|\| req\.localTrusted\) return true;/.test(router),
    'requireOwnerOrLocal admits isOwner(req) or a direct-local caller');
  const auth = read('src/middleware/auth.js');
  assert(/function isOwner\(req\) \{\s*return isOwnerOrAdmin\(req\);\s*\}/.test(auth), 'isOwner is the alias of isOwnerOrAdmin');
  // The presets module reached staging after main's last promotion; on a line without it there is nothing to guard.
  if (fs.existsSync(path.join(ROOT, 'src/api/strfry/negentropyPresets.js'))) {
    const presets = read('src/api/strfry/negentropyPresets.js');
    const guarded = (presets.match(/if \(!requireOwnerOrLocal\(req, res\)\) return;/g) || []).length;
    assert(guarded === 4, `save, toggle, delete and run are guarded (got ${guarded})`);
  }
});

test('A8: the three pages that sync a point of view send exactly the POV-sync shape', () => {
  const shape = /fetch\('\/api\/strfry\/negentropy-sync',\s*\{[\s\S]{0,200}?dir:\s*'down',\s*filter:\s*\{\s*kinds:\s*\[30382\],\s*authors:\s*\[\w+\]\s*\}/;
  const wrong = ['ui/src/pages/BrainstormSearch.jsx', 'ui/src/pages/grapevine/SearchPreferences.jsx', 'ui/src/pages/BrainstormSettings.jsx']
    .filter((f) => !shape.test(read(f)));
  assert(wrong.length === 0, `not the POV-sync shape: ${wrong.join(', ')}`);
});

test('A9: the default guards use the real isOwnerOrAdmin', () => {
  const src = fs.existsSync(ACCESS) ? fs.readFileSync(ACCESS, 'utf8') : '';
  assert(/require\('\.\.\/\.\.\/middleware\/auth'\)/.test(src) && /isOwnerOrAdmin/.test(src), 'negentropyAccess.js uses isOwnerOrAdmin from src/middleware/auth.js');
  const a = access();
  assert(typeof a.requireSyncManager === 'function' && typeof a.requireSyncManagerOrPovSync === 'function', 'default guards exported');
  const user = call(a.requireSyncManager, signedIn());
  assert(!user.nexted && user.status === 403, `the real check refuses an unknown signed-in pubkey: ${show(user)}`);
});

test('A10: the presets list GET is behind requireSyncManager, where the presets module exists', () => {
  const PRESETS = path.join(ROOT, 'src/api/strfry/negentropyPresets.js');
  if (!fs.existsSync(PRESETS)) return; // the module reached staging after main's last promotion
  const a = access();
  const routes = {};
  const app = { get: (p, ...h) => { routes[`GET ${p}`] = h; }, post: (p, ...h) => { routes[`POST ${p}`] = h; } };
  delete require.cache[require.resolve(PRESETS)];
  require(PRESETS).registerNegentropyPresetRoutes(app);
  const h = routes['GET /api/strfry/negentropy-presets'];
  assert(h && h.length === 2 && h[0] === a.requireSyncManager, 'GET /api/strfry/negentropy-presets is behind requireSyncManager');
});

async function run() {
  console.log(`${NL}=== negentropy-sync-access ===`);
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  PASS  ${name}`); pass++; } catch (err) {
      console.log(`  FAIL  ${name}${NL}        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`${NL}negentropy-sync-access: ${pass} passed, ${fail} failed, 0 skipped`);
  return { pass, fail, failures, skipped: 0 };
}

module.exports = { run };
