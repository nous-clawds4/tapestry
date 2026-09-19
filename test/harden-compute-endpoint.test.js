'use strict';
/**
 * Regression: harden and restrict an admin computation endpoint.
 *
 * Story: engineering-team/stories/compute-endpoint-hardening/1-harden-and-restrict-compute-endpoint.md
 * Book:  engineering-team/audits/compute-endpoint-hardening/book.md
 *
 * (Local until shipped — the branch is held per the book's disclosure discipline.
 * The endpoint under test is the personalized-pagerank GET; its command handler
 * interpolated a client-supplied query param into a shell command, and the shared
 * auth middleware's owner-list was POST-only so the GET was reachable unauthenticated.)
 *
 * Two hermetic surfaces, no live stack:
 *   A. The command handler — child_process is intercepted BEFORE the handler loads,
 *      so we can assert what it *tries* to run without running anything. A crafted
 *      parameter must be rejected before any spawn; a valid parameter must be run via
 *      an argument vector (execFile), never a shell string (exec), so metacharacters
 *      are inert.
 *   B. The auth middleware — an unauthenticated GET to the endpoint must be rejected.
 *
 * Pre-fix: A rejects nothing (exec called with the injected string) and uses a shell
 * string; B lets the GET through. Post-fix: A validates + uses execFile; B returns 401.
 */

const path = require('path');
const REPO = path.resolve(__dirname, '..');

// --- child_process interception, scoped to the handler only ---
// The gate's registry loads EVERY suite module up front (before any runs), so a
// permanent monkeypatch of the shared child_process module would clobber it for
// every other suite. Instead: install stable spies, require the handler so its
// load-time destructure captures them, then immediately restore the real module
// for everyone else. The handler keeps its captured spies; nothing else is touched.
const cp = require('child_process');
const spawnCalls = [];
function fakeChild() { return { on() {}, kill() {}, stdout: { on() {}, pipe() {} }, stderr: { on() {} } }; }
const _real = { exec: cp.exec, execFile: cp.execFile, execSync: cp.execSync, spawn: cp.spawn };
cp.exec = function (...a) { spawnCalls.push({ fn: 'exec', a }); return fakeChild(); };
cp.execFile = function (...a) { spawnCalls.push({ fn: 'execFile', a }); return fakeChild(); };
cp.execSync = function (...a) { spawnCalls.push({ fn: 'execSync', a }); return Buffer.from(''); };
cp.spawn = function (...a) { spawnCalls.push({ fn: 'spawn', a }); return fakeChild(); };

// Require the handler NOW (captures the spies via its load-time destructure)…
const handlerMod = require(path.join(REPO, 'src/api/algos/pagerank/commands/generateForApi.js'));
const handle = handlerMod.handleGenerateForApiPageRank;

// …then restore the real child_process before any other module loads.
cp.exec = _real.exec; cp.execFile = _real.execFile; cp.execSync = _real.execSync; cp.spawn = _real.spawn;

// Auth middleware loads with the real child_process (independent of the handler).
const { authMiddleware } = require(path.join(REPO, 'src/middleware/auth.js'));

const VALID_PK = 'a'.repeat(64);
const INJECT_PK = 'a'.repeat(60) + '; id'; // shell metacharacters in the param

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

function mockRes() {
  return {
    statusCode: 200, body: undefined, headersSent: false, _timeout: null,
    status(c) { this.statusCode = c; return this; },
    json(o) { this.body = o; this.headersSent = true; return this; },
    send(o) { this.body = o; this.headersSent = true; return this; },
    setHeader() {}, write() {}, end() { this.headersSent = true; }, setTimeout() {},
  };
}
function mockReq(query) {
  return { query: query || {}, setTimeout() {} };
}

// --- A. command handler ---

test('A1: a crafted parameter is rejected before any subprocess is spawned', () => {
  spawnCalls.length = 0;
  const res = mockRes();
  handle(mockReq({ pubkey: INJECT_PK }), res);
  assert(spawnCalls.length === 0,
    `a crafted parameter must not reach subprocess execution; got ${spawnCalls.length} spawn(s): ${JSON.stringify(spawnCalls.map(c => c.fn + ':' + String(c.a[0]).slice(0, 60)))}`);
  assert(res.statusCode >= 400 && res.statusCode < 500,
    `a crafted parameter should be rejected with a 4xx; got ${res.statusCode}`);
});

test('A2: a valid parameter runs the program without a shell (argv, not a shell string)', () => {
  spawnCalls.length = 0;
  const res = mockRes();
  handle(mockReq({ pubkey: VALID_PK }), res);
  // Something must run for a valid request…
  assert(spawnCalls.length >= 1, 'a valid request should invoke the program');
  // …and it must not be a shell-string exec/execSync.
  const shelled = spawnCalls.find(c => (c.fn === 'exec' || c.fn === 'execSync'));
  assert(!shelled,
    `the program must be invoked without a shell (execFile/spawn with an argv), not exec()/execSync() on a string; got ${shelled && shelled.fn}(${shelled && String(shelled.a[0]).slice(0, 80)})`);
  const argv = spawnCalls.find(c => c.fn === 'execFile' || c.fn === 'spawn');
  assert(argv, 'expected an execFile/spawn argv-form invocation');
  // the pubkey must be a DISCRETE argv element, never concatenated into the command word
  const args = Array.isArray(argv.a[1]) ? argv.a[1] : [];
  assert(args.includes(VALID_PK),
    `the parameter must be passed as its own argv element; args=${JSON.stringify(args)}`);
  assert(!String(argv.a[0]).includes(VALID_PK),
    `the parameter must not be concatenated into the command path: ${String(argv.a[0])}`);
});

test('A3: a non-integer limit does not reach subprocess execution as-is', () => {
  spawnCalls.length = 0;
  const res = mockRes();
  handle(mockReq({ pubkey: VALID_PK, limit: '5; rm -rf /' }), res);
  // Either rejected, or the limit is dropped/validated — never passed through verbatim.
  const leaked = spawnCalls.some(c => JSON.stringify(c.a).includes('rm -rf'));
  assert(!leaked, 'a malformed limit must not be passed through to execution verbatim');
});

// --- B. auth middleware ---

async function callMiddleware(req) {
  const res = mockRes();
  let nexted = false;
  await authMiddleware(req, res, () => { nexted = true; });
  return { res, nexted };
}

test('B1: an unauthenticated GET to the endpoint is rejected (not passed through)', async () => {
  // Remote (proxied) unauthenticated request: X-Forwarded-For present ⇒ not direct-local.
  const req = {
    path: '/api/personalized-pagerank', method: 'GET',
    session: {}, headers: { 'x-forwarded-for': '203.0.113.7' }, ip: '203.0.113.7',
    connection: { remoteAddress: '203.0.113.7' },
  };
  const { res, nexted } = await callMiddleware(req);
  assert(!nexted, 'the middleware must not call next() for an unauthenticated request to this endpoint');
  assert(res.statusCode === 401 || res.statusCode === 403,
    `an unauthenticated request to this endpoint should be rejected (401/403); got ${res.statusCode}`);
});

async function run() {
  console.log('\n=== harden-compute-endpoint (compute-endpoint-hardening #1) ===');
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`  PASS  ${name}`);
      pass++;
    } catch (err) {
      console.log(`  FAIL  ${name}\n        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`\nharden-compute-endpoint: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

module.exports = { run };
