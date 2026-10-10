'use strict';
/**
 * The task-control routes are for the owner, admins and direct-local callers (owner decision, 2026-10-10): starting a
 * registered task, creating, changing or deleting a scheduled entry, and changing or triggering a customer's schedule.
 * The central auth middleware (src/middleware/auth.js) lists them as owner-only, which admits the owner and admins
 * (isOwner is the owner-or-admin alias). Stack-free: the real middleware in front of dummy handlers on an ephemeral
 * loopback port. Proxied requests carry X-Forwarded-For, as nginx traffic does; the direct-local case sends none.
 *
 *   T1 — a visitor who is not signed in is refused 401 on each route.
 *   T2 — a signed-in person who is not the owner or an admin is refused 403 on each route, under any capitalization.
 *   T3 — a direct-local caller (loopback, no forwarding header) still reaches each route.
 *   T4 — the reads beside them stay public: scheduled-tasks status/list/history/registry-tasks, customer-schedule
 *        status/history.
 *   T5 — the six paths are on the middleware's owner-only list.
 */

const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const AUTH = path.join(ROOT, 'src/middleware/auth.js');
const NL = String.fromCharCode(10);

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

const REACHED = 'reached-handler';
const TASK_ROUTES = [
  '/api/run-task',
  '/api/scheduled-tasks/create', '/api/scheduled-tasks/update', '/api/scheduled-tasks/delete',
  '/api/customer-schedule/update', '/api/customer-schedule/trigger',
];
const PUBLIC_READS = [
  '/api/scheduled-tasks/status', '/api/scheduled-tasks/list', '/api/scheduled-tasks/history', '/api/scheduled-tasks/registry-tasks',
  '/api/customer-schedule/status', '/api/customer-schedule/history',
];
const SIGNED_IN = { authenticated: true, pubkey: 'b'.repeat(64) };

async function startApp() {
  const express = require('express');
  const { authMiddleware } = require(AUTH);
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const s = req.headers['x-test-session'];
    req.session = s ? JSON.parse(s) : {};
    next();
  });
  app.use(authMiddleware);
  const reached = (req, res) => res.status(200).json({ marker: REACHED });
  for (const p of TASK_ROUTES) app.post(p, reached);
  for (const p of PUBLIC_READS) app.get(p, reached);
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const port = server.address().port;
  function request(method, p, { session = null, proxied = true } = {}) {
    return new Promise((resolve, reject) => {
      const headers = { 'Content-Type': 'application/json' };
      if (proxied) headers['X-Forwarded-For'] = '203.0.113.9';
      if (session) headers['X-Test-Session'] = JSON.stringify(session);
      const r = http.request({ host: '127.0.0.1', port, path: p, method, headers }, (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => resolve({ status: res.statusCode, reached: body.includes(REACHED) }));
      });
      r.on('error', reject);
      r.end(method === 'GET' ? undefined : '{}');
    });
  }
  return { request, close: () => new Promise((resolve) => server.close(resolve)) };
}

async function withApp(fn) {
  const app = await startApp();
  try { await fn(app); } finally { await app.close(); }
}

test('T1: not signed in → 401 on each task-control route', () => withApp(async (app) => {
  const wrong = [];
  for (const p of TASK_ROUTES) {
    const r = await app.request('POST', p);
    if (r.reached || r.status !== 401) wrong.push(`${p} → ${r.status}${r.reached ? ' (reached)' : ''}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
}));

test('T2: signed in, not the owner or an admin → 403 on each route, under any capitalization', () => withApp(async (app) => {
  const wrong = [];
  for (const p of TASK_ROUTES) {
    for (const variant of [p, p.toUpperCase(), p.replace('/api/', '/Api/')]) {
      const r = await app.request('POST', variant, { session: SIGNED_IN });
      if (r.reached || r.status !== 403) wrong.push(`${variant} → ${r.status}${r.reached ? ' (reached)' : ''}`);
    }
  }
  assert(wrong.length === 0, wrong.join('; '));
}));

test('T3: a direct-local caller still reaches each route', () => withApp(async (app) => {
  const wrong = [];
  for (const p of TASK_ROUTES) {
    const r = await app.request('POST', p, { proxied: false });
    if (!r.reached) wrong.push(`${p} → ${r.status}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
}));

test('T4: the reads beside them stay public', () => withApp(async (app) => {
  const wrong = [];
  for (const p of PUBLIC_READS) {
    const r = await app.request('GET', p);
    if (!r.reached) wrong.push(`${p} → ${r.status}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
}));

// Re-aimed for security-auth-exposure #8 (ADR 0005): the hand-kept ownerOnlyEndpoints list is gone; the route table
// decides access now. The six task-control paths must resolve to 'owner' (owner, admins, direct-local).
test('T5: the six task-control paths resolve to owner in the route table', () => {
  const TABLE = path.join(ROOT, 'src/middleware/routeAccess.js');
  assert(fs.existsSync(TABLE), 'src/middleware/routeAccess.js does not exist yet (ADR 0005 Decision 1)');
  delete require.cache[require.resolve(TABLE)];
  const { resolveRouteAccess } = require(TABLE);
  const wrong = TASK_ROUTES.map((p) => [p, resolveRouteAccess('POST', p)]).filter(([, a]) => a !== 'owner');
  assert(wrong.length === 0, `not owner in the table: ${wrong.map(([p, a]) => `${p}→${a}`).join(', ')}`);
});

async function run() {
  console.log(`${NL}=== task-routes-owner-admin ===`);
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  PASS  ${name}`); pass++; } catch (err) {
      console.log(`  FAIL  ${name}${NL}        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`${NL}task-routes-owner-admin: ${pass} passed, ${fail} failed, 0 skipped`);
  return { pass, fail, failures, skipped: 0 };
}

module.exports = { run };
