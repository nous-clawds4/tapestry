'use strict';
/**
 * The admin-action sweep — one total route table, default-deny (story security-auth-exposure #8,
 * ADR security-auth-exposure/0005, Option A). This suite is the structural half and the AC-6 regression demonstration.
 * It names no still-open route: every route set is derived at runtime from the real router walk and from the table.
 *
 * The route set comes from a CHILD PROCESS (test/helpers/routeWalk.js): the gate loads suites in-process and the real
 * register(app) has side effects (it writes the strfry router config and its state file), so the walk cannot run here.
 * The entrypoint's own registrations (bin/control-panel.js) and the task-queue dashboard mount are added from a static
 * scan, because the entrypoint cannot be loaded without Redis.
 *
 *   W1  — the child walk succeeds and returns the whole router (no register error; touched no router file).
 *   AC6a — coverage: every registered route either has a table entry or its stack starts with a recognised
 *          owner's-side guard; a route with neither FAILS, naming "METHOD path".
 *   AC6b — the demonstration: an injected unguarded POST and an injected unguarded GET are each reported uncovered,
 *          and each stops being reported the moment it gains a table entry or a recognised guard.
 *   T2  — no stale entry: every table key matches at least one registered route (walk ∪ entrypoint ∪ the mount).
 *   T3  — the allowlist is explicit: every action the table opens to public or signed-in carries a non-empty `why`.
 *   T4  — agreement with Express dispatch: for every registered route, resolveRouteAccess on its own method and path
 *          (parameters filled) returns the strictest table access for that path, HEAD resolves like GET, and a
 *          capitalised spelling resolves the same.
 *   T5  — no match is fail-closed: resolveRouteAccess on an unknown path is 'owner'; ACCESS_ORDER ranks
 *          owner-only > owner > signed-in > public.
 *   T6  — nothing outside the API prefix is an open action: every walked non-/api route the table covers is a read
 *          (kind 'read'), or public, or carries a recognised guard.
 *   T7  — the six hand-kept lists are gone from src/middleware/auth.js (the table subsumes them).
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const TABLE = path.join(ROOT, 'src/middleware/routeAccess.js');
const AUTH = path.join(ROOT, 'src/middleware/auth.js');
const WALKER = path.join(ROOT, 'test/helpers/routeWalk.js');
const NL = String.fromCharCode(10);

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

const P2R = require(require.resolve('path-to-regexp', { paths: [require.resolve('express')] }));
const compile = (routePath) => P2R(routePath, [], { sensitive: false, strict: false, end: true });
const fill = (p) => p.replace(/:[A-Za-z0-9_]+/g, 'x').replace(/\*/g, 'x');

// Recognised guards that admit the owner's side (owner, admins, direct-local). requireSyncManagerOrPovSync and
// requireOwnAssistant narrow a route to a signed-in person's own thing — recognised, but not owner's-side-only, so a
// route behind them still needs a table entry; they are not counted here.
const OWNER_SIDE_GUARDS = new Set(['requireOwner', 'requireOwnerOnly', 'requireOwnerOrAdmin', 'requireSyncManager']);

// The entrypoint's own registrations (bin/control-panel.js), all reads/pages/mounts, plus the task-queue dashboard
// mount. Added by static scan because the entrypoint cannot load without Redis. None is a still-open action.
const ENTRYPOINT_ROUTES = [
  ['GET', '/.well-known/security.txt'], ['GET', '/robots.txt'], ['GET', '/llms.txt'],
  ['GET', '/information-for-agents.md'], ['GET', '/legacy'], ['GET', '/legacy/:filename.html'],
  ['GET', '/:filename.html'], ['GET', '*'],
];
const ENTRYPOINT_MOUNTS = ['/docs', '/', '/control', '/generated', '/libs/chart.js', '/libs/chartjs-adapter-date-fns', '/admin/queues'];

let WALK = null;
function walk() {
  if (WALK) return WALK;
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'sweep-walk-'));
  const outFile = path.join(dir, 'out.json');
  const env = {
    ...process.env,
    TAPESTRY_SETTINGS_PATH: path.join(dir, 'settings.json'),
    BRAINSTORM_BASE_DIR: dir,
    BRAINSTORM_CONF_PATH: path.join(dir, 'brainstorm.conf'),
  };
  delete env.TASK_QUEUE_ENABLED;
  fs.writeFileSync(env.BRAINSTORM_CONF_PATH, '');
  const r = spawnSync(process.execPath, [WALKER, outFile], { cwd: ROOT, env, encoding: 'utf8', timeout: 90000 });
  let parsed = null;
  try { parsed = JSON.parse(fs.readFileSync(outFile, 'utf8')); } catch { /* reported below */ }
  WALK = { child: r, data: parsed };
  return WALK;
}

/** The table module, or throw the right failing reason: it does not exist yet. */
function table() {
  if (!fs.existsSync(TABLE)) throw new Error('src/middleware/routeAccess.js does not exist yet (ADR 0005 Decision 1)');
  delete require.cache[require.resolve(TABLE)];
  const mod = require(TABLE);
  for (const name of ['ROUTE_ACCESS', 'ACCESS_ORDER', 'resolveRouteAccess']) {
    assert(mod[name] !== undefined, `src/middleware/routeAccess.js must export ${name} (ADR 0005 Decision 1)`);
  }
  return mod;
}

/**
 * Table keys (method or HEAD→GET) whose compiled pattern matches `filledPath`. A bare catch-all key ('*' or '/*') is
 * ignored: it is the SPA app shell, which the middleware never judges (non-/api → next()), and it would otherwise match
 * every path. An unknown /api path must still fail closed to 'owner' — T5 pins that, so a stray '*' entry can't open it.
 */
function matchingKeys(ROUTE_ACCESS, method, filledPath) {
  const want = method === 'HEAD' ? 'GET' : method;
  const hits = [];
  for (const key of Object.keys(ROUTE_ACCESS)) {
    const sp = key.indexOf(' ');
    const km = key.slice(0, sp);
    const kp = key.slice(sp + 1);
    if (kp === '*' || kp === '/*') continue;
    if (km !== want && km !== method) continue;
    let re;
    try { re = compile(kp); } catch { continue; }
    if (re.test(filledPath)) hits.push(key);
  }
  return hits;
}

/**
 * The reusable coverage rule (the heart of AC-6): a route is covered when the table has at least one matching entry OR
 * its walked stack starts with an owner's-side guard. Returns the uncovered routes as "METHOD path".
 */
function uncovered(routes, ROUTE_ACCESS) {
  const bad = [];
  for (const r of routes) {
    const covered = matchingKeys(ROUTE_ACCESS, r.method, fill(r.path)).length > 0
      || OWNER_SIDE_GUARDS.has(r.guard);
    if (!covered) bad.push(`${r.method} ${r.path}`);
  }
  return bad;
}

test('W1: the child route walk returns the whole router without touching a router file', () => {
  const { child, data } = walk();
  assert(child.status === 0, `the walker exited ${child.status}: ${(child.stderr || '').slice(0, 300)}`);
  assert(data, 'the walker wrote no parseable result');
  assert(!data.registerError, `register(app) failed in the walker: ${data.registerError}`);
  assert(data.routes.length > 300, `expected the full router (300+ routes), got ${data.routes.length}`);
  assert(data.routerWrites === 0, `the walk wrote the strfry router config/state ${data.routerWrites} time(s) — it must be stubbed`);
});

test('AC6a: every registered route has a table entry or an owner\'s-side guard (else named)', () => {
  const { data } = walk();
  assert(data && data.routes.length, 'no routes from the walk');
  const { ROUTE_ACCESS } = table();
  const bad = uncovered(data.routes, ROUTE_ACCESS);
  assert(bad.length === 0, `unsorted route(s) — neither a table entry nor an owner's-side guard:${NL}        ${bad.join(NL + '        ')}`);
});

test('AC6b: an added unguarded POST and an added GET that acts are each caught until guarded or listed', () => {
  const { ROUTE_ACCESS } = table();
  const injPost = { method: 'POST', path: '/api/__sweep_demo_action__', guard: null };
  const injGet = { method: 'GET', path: '/api/__sweep_demo_get_that_acts__', guard: null };
  // Both are uncovered against the real table.
  let bad = uncovered([injPost, injGet], ROUTE_ACCESS);
  assert(bad.includes('POST /api/__sweep_demo_action__'), `the injected POST must be reported uncovered; got ${JSON.stringify(bad)}`);
  assert(bad.includes('GET /api/__sweep_demo_get_that_acts__'), `the injected GET must be reported uncovered; got ${JSON.stringify(bad)}`);
  // Guarding the POST clears it; listing the GET in a local copy of the table clears it.
  bad = uncovered([{ ...injPost, guard: 'requireOwnerOrAdmin' }], ROUTE_ACCESS);
  assert(bad.length === 0, `a recognised owner's-side guard must clear the POST; still got ${JSON.stringify(bad)}`);
  const withEntry = { ...ROUTE_ACCESS, 'GET /api/__sweep_demo_get_that_acts__': { access: 'owner', kind: 'action' } };
  bad = uncovered([injGet], withEntry);
  assert(bad.length === 0, `a table entry must clear the GET; still got ${JSON.stringify(bad)}`);
});

test('T2: no stale table entry — every key matches a registered route', () => {
  const { data } = walk();
  const { ROUTE_ACCESS } = table();
  const registered = [...data.routes.map((r) => ({ method: r.method, path: r.path })), ...ENTRYPOINT_ROUTES.map(([m, p]) => ({ method: m, path: p }))];
  const stale = [];
  for (const key of Object.keys(ROUTE_ACCESS)) {
    const sp = key.indexOf(' ');
    const km = key.slice(0, sp);
    const kp = key.slice(sp + 1);
    if (km === 'USE') { if (!ENTRYPOINT_MOUNTS.includes(kp)) stale.push(`${key} (no such mount)`); continue; }
    let re;
    try { re = compile(kp); } catch { stale.push(`${key} (malformed path)`); continue; }
    const hit = registered.some((r) => (r.method === km || (km === 'GET' && r.method === 'HEAD')) && re.test(fill(r.path)));
    if (!hit) stale.push(key);
  }
  assert(stale.length === 0, `stale table entries (match no registered route):${NL}        ${stale.join(NL + '        ')}`);
});

test('T3: every action the table opens to public or signed-in carries a non-empty why (the allowlist)', () => {
  const { ROUTE_ACCESS } = table();
  const missing = [];
  for (const [key, v] of Object.entries(ROUTE_ACCESS)) {
    if (v && v.kind === 'action' && (v.access === 'public' || v.access === 'signed-in')) {
      if (!v.why || !String(v.why).trim()) missing.push(key);
    }
  }
  assert(missing.length === 0, `allowlisted action(s) with no why (AC-4): ${missing.join(', ')}`);
});

test('T4: resolveRouteAccess agrees with Express dispatch — method, HEAD-as-GET and capitalised spelling', () => {
  const { data } = walk();
  const { ROUTE_ACCESS, ACCESS_ORDER, resolveRouteAccess } = table();
  const rank = (a) => ACCESS_ORDER.indexOf(a);
  const strictest = (keys) => keys.map((k) => ROUTE_ACCESS[k].access).reduce((a, b) => (rank(b) > rank(a) ? b : a), ACCESS_ORDER[0]);
  const wrong = [];
  for (const r of data.routes) {
    const fp = fill(r.path);
    const keys = matchingKeys(ROUTE_ACCESS, r.method, fp);
    if (keys.length === 0) continue; // coverage (AC6a) handles table-absent routes
    const want = strictest(keys);
    const got = resolveRouteAccess(r.method, fp);
    if (got !== want) wrong.push(`${r.method} ${fp} → ${got}, want ${want}`);
    const cap = resolveRouteAccess(r.method, fp.replace('/api/', '/API/'));
    if (cap !== want) wrong.push(`${r.method} ${fp} (capitalised) → ${cap}, want ${want}`);
    if (r.method === 'GET') {
      const head = resolveRouteAccess('HEAD', fp);
      if (head !== want) wrong.push(`HEAD ${fp} → ${head}, want ${want}`);
    }
  }
  assert(wrong.length === 0, `resolver disagreed with the table/dispatch:${NL}        ${wrong.slice(0, 40).join(NL + '        ')}`);
});

test('T5: no match is fail-closed (owner) and ACCESS_ORDER ranks strictest last', () => {
  const { ACCESS_ORDER, resolveRouteAccess } = table();
  assert(resolveRouteAccess('POST', '/api/__no_such_route_at_all__') === 'owner', 'an unmatched path must resolve to owner (fail closed)');
  assert(resolveRouteAccess('GET', '/api/__no_such_route_at_all__') === 'owner', 'an unmatched GET must resolve to owner too');
  const idx = (a) => ACCESS_ORDER.indexOf(a);
  for (const a of ['public', 'signed-in', 'owner', 'owner-only']) assert(idx(a) >= 0, `ACCESS_ORDER must list ${a}`);
  assert(idx('public') < idx('signed-in') && idx('signed-in') < idx('owner') && idx('owner') < idx('owner-only'),
    `ACCESS_ORDER must rank public < signed-in < owner < owner-only; got ${JSON.stringify(ACCESS_ORDER)}`);
});

test('T6: nothing the table covers outside the API prefix is an open action', () => {
  const { data } = walk();
  const { ROUTE_ACCESS } = table();
  const bad = [];
  for (const r of data.routes) {
    if (r.path.startsWith('/api/')) continue;
    if (OWNER_SIDE_GUARDS.has(r.guard)) continue;
    const keys = matchingKeys(ROUTE_ACCESS, r.method, fill(r.path));
    if (keys.length === 0) continue; // AC6a already flags an uncovered non-API route
    const anyOpenAction = keys.some((k) => ROUTE_ACCESS[k].kind === 'action' && ROUTE_ACCESS[k].access !== 'public');
    if (anyOpenAction) bad.push(`${r.method} ${r.path}`);
  }
  assert(bad.length === 0, `non-API route(s) marked as a non-public action:${NL}        ${bad.join(NL + '        ')}`);
});

test('T7: the six hand-kept lists are gone from the central check', () => {
  const src = fs.readFileSync(AUTH, 'utf8');
  const gone = ['ownerOnlyEndpoints', 'ownerOnlyGetEndpoints', 'protectedGetEndpoints', 'authenticatedEndpoints', 'MUTATING', 'PUBLIC_MUTATIONS'];
  const still = gone.filter((name) => new RegExp(`const\\s+${name}\\s*=`).test(src));
  assert(still.length === 0, `src/middleware/auth.js still declares the deleted list(s): ${still.join(', ')} (ADR 0005 Decision 2.5)`);
  assert(/require\(['"][^'"]*routeAccess['"]\)/.test(src) && /resolveRouteAccess/.test(src),
    'authMiddleware must use resolveRouteAccess from src/middleware/routeAccess.js (ADR 0005 Decision 2.4)');
});

async function run() {
  console.log(`${NL}=== admin-action-sweep ===`);
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  PASS  ${name}`); pass++; } catch (err) {
      console.log(`  FAIL  ${name}${NL}        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`${NL}admin-action-sweep: ${pass} passed, ${fail} failed, 0 skipped`);
  return { pass, fail, failures, skipped: 0 };
}

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
