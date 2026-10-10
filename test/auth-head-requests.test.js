'use strict';
/**
 * The central auth middleware (src/middleware/auth.js) judges a HEAD request as it judges a GET. Express answers HEAD
 * by running the route's GET handler (only the body is dropped), so a GET-only check that ignores HEAD lets the handler
 * run. Stack-free: the real middleware in front of dummy GET handlers on an ephemeral loopback port; requests carry
 * X-Forwarded-For, as nginx-proxied traffic does.
 *
 *   H1 — not signed in: HEAD on a protected GET (backups, personalized PageRank) is refused 401; the handler does not run.
 *   H2 — signed in, not the owner or an admin: HEAD on an owner-only GET is refused 403; the handler does not run.
 *   H3 — GET answers as before for the same callers (401 / 403).
 *   H4 — HEAD on a public read still reaches its handler.
 *   H5 — the middleware has no GET-only method test left: every one admits HEAD too.
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

const SIGNED_IN = { authenticated: true, pubkey: 'b'.repeat(64) };

async function startApp() {
  const express = require('express');
  const { authMiddleware } = require(AUTH);
  const app = express();
  app.use((req, res, next) => {
    const s = req.headers['x-test-session'];
    req.session = s ? JSON.parse(s) : {};
    next();
  });
  app.use(authMiddleware);
  let ran = 0;
  const handler = (req, res) => { ran++; res.set('X-Reached', 'yes'); res.status(200).json({ ok: true }); };
  for (const p of ['/api/personalized-pagerank', '/api/backups', '/api/restore/sets', '/api/relays']) app.get(p, handler);
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const port = server.address().port;
  function request(method, p, session) {
    return new Promise((resolve, reject) => {
      const before = ran;
      const headers = { 'X-Forwarded-For': '203.0.113.9' };
      if (session) headers['X-Test-Session'] = JSON.stringify(session);
      const r = http.request({ host: '127.0.0.1', port, path: p, method, headers }, (res) => {
        res.resume();
        res.on('end', () => resolve({ status: res.statusCode, reached: ran > before || res.headers['x-reached'] === 'yes' }));
      });
      r.on('error', reject);
      r.end();
    });
  }
  return { request, close: () => new Promise((resolve) => server.close(resolve)) };
}

async function withApp(fn) {
  const app = await startApp();
  try { await fn(app); } finally { await app.close(); }
}

async function expectRefused(app, method, paths, session, want) {
  const wrong = [];
  for (const p of paths) {
    const r = await app.request(method, p, session);
    if (r.reached || r.status !== want) wrong.push(`${method} ${p} → ${r.status}${r.reached ? ' (handler ran)' : ''}`);
  }
  assert(wrong.length === 0, `want ${want} with the handler not run: ${wrong.join('; ')}`);
}

test('H1: not signed in → HEAD on a protected GET is refused 401', () => withApp(async (app) => {
  await expectRefused(app, 'HEAD', ['/api/backups', '/api/restore/sets', '/api/personalized-pagerank', '/API/Backups'], null, 401);
}));

test('H2: signed in, not the owner or an admin → HEAD on an owner-only GET is refused 403', () => withApp(async (app) => {
  await expectRefused(app, 'HEAD', ['/api/personalized-pagerank', '/api/backups'], SIGNED_IN, 403);
}));

test('H3: GET answers as before', () => withApp(async (app) => {
  await expectRefused(app, 'GET', ['/api/backups', '/api/personalized-pagerank'], null, 401);
  await expectRefused(app, 'GET', ['/api/personalized-pagerank', '/api/backups'], SIGNED_IN, 403);
}));

test('H4: HEAD on a public read still reaches its handler', () => withApp(async (app) => {
  const r = await app.request('HEAD', '/api/relays', null);
  assert(r.reached && r.status === 200, `HEAD /api/relays → ${r.status}`);
}));

test('H5: no GET-only method test is left in the middleware', () => {
  const src = fs.readFileSync(AUTH, 'utf8');
  const start = src.indexOf('async function authMiddleware(');
  const end = src.indexOf(NL + '}' + NL, start);
  const body = src.slice(start, end).split(NL).filter((l) => !/^\s*(\/\/|\*)/.test(l)).join(NL);
  const gets = body.match(/req\.method\s*===\s*'GET'(\s*\|\|\s*req\.method\s*===\s*'HEAD')?/g) || [];
  const alone = gets.filter((g) => !/HEAD/.test(g));
  assert(alone.length === 0, `authMiddleware tests req.method === 'GET' without HEAD ${alone.length} time(s)`);
});

async function run() {
  console.log(`${NL}=== auth-head-requests ===`);
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  PASS  ${name}`); pass++; } catch (err) {
      console.log(`  FAIL  ${name}${NL}        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`${NL}auth-head-requests: ${pass} passed, ${fail} failed, 0 skipped`);
  return { pass, fail, failures, skipped: 0 };
}

module.exports = { run };
