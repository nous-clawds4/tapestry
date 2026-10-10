'use strict';
/**
 * The central auth middleware (src/middleware/auth.js) judges a path the way Express routes it. Express matches routes
 * case-insensitively, so /API/x, /Api/x and /api/X reach the handler registered at /api/x, and the middleware must
 * judge them exactly as /api/x. Stack-free: a local Express app with the real middleware in front of dummy handlers on
 * an ephemeral loopback port; every request carries X-Forwarded-For, as nginx-proxied traffic does, so none of it is
 * treated as direct-local.
 *
 *   P1 — a visitor who is not signed in is refused 401 for a non-public mutation under every capitalization.
 *   P2 — ... and for a protected GET under every capitalization.
 *   P3 — a signed-in person who is not the owner is refused 403 for owner-only POST and GET endpoints under every
 *        capitalization, including an endpoint whose listed name has capitals (/toggle-strfry-filteredContent).
 *   P4 — what is public stays public under any capitalization: a public read, the /api/auth/ endpoints, the two public
 *        mutations, and pages outside /api/.
 *   P5 — the middleware reads req.path once, into a lowercased copy that every comparison uses.
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

/** Start the app; returns { request(method, path, session?), close() }. */
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
  for (const p of ['/api/run-task', '/api/batch-transfer', '/api/toggle-strfry-filteredContent', '/api/strfry/publish', '/api/neo4j/query']) app.post(p, reached);
  for (const p of ['/api/backups', '/api/personalized-pagerank', '/api/relays', '/api/auth/status', '/some-page']) app.get(p, reached);
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const port = server.address().port;
  function request(method, p, session) {
    return new Promise((resolve, reject) => {
      const headers = { 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.9' };
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

const SIGNED_IN = { authenticated: true, pubkey: 'b'.repeat(64) };

async function expectAll(app, method, paths, session, wantStatus) {
  const wrong = [];
  for (const p of paths) {
    const r = await app.request(method, p, session);
    if (r.reached || r.status !== wantStatus) wrong.push(`${method} ${p} → ${r.status}${r.reached ? ' (reached the handler)' : ''}`);
  }
  assert(wrong.length === 0, `want ${wantStatus} without reaching the handler: ${wrong.join('; ')}`);
}

test('P1: not signed in → 401 for a non-public mutation under every capitalization', async () => {
  const app = await startApp();
  try {
    await expectAll(app, 'POST', ['/api/run-task', '/API/run-task', '/Api/run-task', '/api/RUN-TASK', '/API/RUN-TASK'], null, 401);
  } finally { await app.close(); }
});

test('P2: not signed in → 401 for a protected GET under every capitalization', async () => {
  const app = await startApp();
  try {
    await expectAll(app, 'GET', ['/api/backups', '/API/backups', '/api/Backups', '/API/BACKUPS'], null, 401);
  } finally { await app.close(); }
});

test('P3: signed in, not the owner → 403 for owner-only endpoints under every capitalization', async () => {
  const app = await startApp();
  try {
    await expectAll(app, 'POST', ['/api/batch-transfer', '/API/batch-transfer', '/api/Batch-Transfer'], SIGNED_IN, 403);
    await expectAll(app, 'POST', ['/api/toggle-strfry-filteredContent', '/api/toggle-strfry-filteredcontent', '/API/TOGGLE-STRFRY-FILTEREDCONTENT'], SIGNED_IN, 403);
    await expectAll(app, 'GET', ['/api/personalized-pagerank', '/API/Personalized-PageRank'], SIGNED_IN, 403);
  } finally { await app.close(); }
});

test('P4: public stays public under any capitalization', async () => {
  const app = await startApp();
  try {
    const wrong = [];
    for (const [method, p] of [
      ['GET', '/api/relays'], ['GET', '/API/relays'], ['GET', '/api/auth/status'], ['GET', '/API/Auth/status'],
      ['POST', '/api/strfry/publish'], ['POST', '/API/strfry/publish'], ['POST', '/api/neo4j/query'], ['POST', '/Api/Neo4j/Query'],
      ['GET', '/some-page'], ['GET', '/Some-Page'],
    ]) {
      const r = await app.request(method, p, null);
      if (!r.reached) wrong.push(`${method} ${p} → ${r.status}`);
    }
    assert(wrong.length === 0, `should reach the handler: ${wrong.join('; ')}`);
  } finally { await app.close(); }
});

test('P5: the middleware reads req.path once, into a lowercased copy', () => {
  const src = fs.readFileSync(AUTH, 'utf8');
  const start = src.indexOf('async function authMiddleware(');
  assert(start >= 0, 'authMiddleware not found');
  const end = src.indexOf(NL + '}' + NL, start);
  const body = src.slice(start, end).split(NL).filter((l) => !/^\s*(\/\/|\*)/.test(l)).join(NL);
  const uses = body.match(/req\.path\b/g) || [];
  assert(uses.length === 1, `req.path should appear once in authMiddleware (the lowercased copy), found ${uses.length}`);
  assert(/=\s*req\.path\.toLowerCase\(\)/.test(body), 'the one use lowercases it');
});

async function run() {
  console.log(`${NL}=== auth-path-case ===`);
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  PASS  ${name}`); pass++; } catch (err) {
      console.log(`  FAIL  ${name}${NL}        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`${NL}auth-path-case: ${pass} passed, ${fail} failed, 0 skipped`);
  return { pass, fail, failures, skipped: 0 };
}

module.exports = { run };
