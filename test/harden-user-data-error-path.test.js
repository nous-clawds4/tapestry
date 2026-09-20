'use strict';
/**
 * Regression: harden an error path in a user-data handler.
 *
 * Story: engineering-team/stories/user-data-error-path/1-harden-user-data-error-path.md
 * Book:  engineering-team/audits/user-data-error-path/book.md
 *
 * The handler under test reads user data from a datastore. When that datastore is
 * unreachable, its failure branch must (a) send a well-formed 500 JSON response and
 * (b) leave the process running. This suite drives the *real* handler in a child
 * process with the datastore pointed at an address that refuses connections, and
 * judges the child's exit code and what it reported.
 *
 * Hermetic — no live stack. The child stubs the config module before requiring the
 * handler, so the datastore URI is a dead port; nothing else is touched. Runs the
 * same in CI (stack-free) as locally.
 *
 * Pre-fix, the failure escapes the handler and crashes the child process: it exits
 * non-zero and prints no RESULT line (the console.error that precedes the crash
 * proves the datastore-unreachable branch was reached — i.e. red for the right
 * reason, not an import/typo error). Post-fix, the child survives and reports a 500
 * JSON response.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

// The child: point the handler's datastore at a refusing address, invoke it, and
// report whether a 500 JSON response was sent and whether this process is still
// alive. If the failure escapes and crashes the process, no RESULT line is printed.
const CHILD_SRC = `'use strict';
const path = require('path');
const repoRoot = process.argv[2];

// Stub the config module BEFORE the handler is required, so the handler's
// load-time destructure captures the stub. Datastore URI -> an address that
// refuses connections fast; every other key falls back to its default.
const config = require(path.join(repoRoot, 'src/utils/config.js'));
config.getConfigFromFile = (name, def) => (name === 'NEO4J_URI' ? 'bolt://127.0.0.1:1' : def);

const { handleGetUserData } = require(path.join(repoRoot, 'src/api/export/users/queries/userdata.js'));

let responseSent = false, statusCode = null, body = null;
const res = {
  status(code) { statusCode = code; return this; },
  json(obj) { responseSent = true; body = obj; return this; },
  send(obj) { responseSent = true; body = obj; return this; },
};
// A valid 64-hex pubkey so the handler passes input validation and reaches the
// datastore read (whose failure is the path under test).
const req = { query: { pubkey: 'a'.repeat(64) } };

// Deliberately install NO unhandledRejection/uncaughtException handler: the child
// must crash exactly as the server would if the handler's failure escapes.
handleGetUserData(req, res);

function report() {
  process.stdout.write('RESULT ' + JSON.stringify({
    survived: true,
    responseSent,
    statusCode,
    bodyIsObject: body !== null && typeof body === 'object',
    bodySuccess: body && typeof body === 'object' ? body.success : undefined,
  }) + '\\n');
  process.exit(0);
}

// Poll until the response is sent (connection-refused resolves in tens of ms),
// then a short grace to catch a late escape; give up after a deadline either way.
const startedAt = Date.now();
const iv = setInterval(() => {
  if (responseSent) { clearInterval(iv); setTimeout(report, 200); }
  else if (Date.now() - startedAt > 4000) { clearInterval(iv); report(); }
}, 50);
`;

/** Spawn the child once; memoize its outcome for both checks. */
let _run = null;
function runChild() {
  if (_run) return _run;
  const childFile = path.join(os.tmpdir(), `udep-child-${process.pid}-${Date.now()}.js`);
  fs.writeFileSync(childFile, CHILD_SRC);
  try {
    const r = cp.spawnSync(process.execPath, [childFile, REPO_ROOT], { encoding: 'utf8', timeout: 20000 });
    const stdout = r.stdout || '';
    const stderr = r.stderr || '';
    const line = stdout.split('\n').find((l) => l.startsWith('RESULT '));
    let result = null;
    if (line) { try { result = JSON.parse(line.slice('RESULT '.length)); } catch { /* leave null */ } }
    _run = { status: r.status, signal: r.signal, error: r.error, stdout, stderr, result };
  } finally {
    try { fs.unlinkSync(childFile); } catch { /* ignore */ }
  }
  return _run;
}

function stderrTail(s, n = 400) {
  const t = (s || '').trim();
  return t.length > n ? '…' + t.slice(-n) : t;
}

test('sends a 500 JSON response when the datastore is unreachable', () => {
  const r = runChild();
  assert(!r.error, `child failed to run: ${r.error && r.error.message}`);
  assert(r.result && r.result.survived,
    `expected the handler to answer and the process to survive, but no RESULT was printed ` +
    `(exit=${r.status}, signal=${r.signal}). stderr: ${stderrTail(r.stderr)}`);
  assert(r.result.responseSent,
    `expected a response to be sent on the datastore-unreachable path; none was. stderr: ${stderrTail(r.stderr)}`);
  assert(r.result.statusCode === 500,
    `expected HTTP 500 on the datastore-unreachable path; got ${r.result.statusCode}.`);
  assert(r.result.bodyIsObject,
    `expected a JSON object body on the 500 response; got a non-object.`);
});

test('the process survives the datastore-unreachable failure', () => {
  const r = runChild();
  assert(!r.error, `child failed to run: ${r.error && r.error.message}`);
  assert(r.status === 0,
    `expected the child process to exit 0 (failure contained in the handler), but it exited ` +
    `${r.status}${r.signal ? ` (signal ${r.signal})` : ''} — the handler's failure escaped and ` +
    `crashed the process. stderr: ${stderrTail(r.stderr)}`);
  assert(r.result && r.result.survived === true,
    `expected the child to report it survived; it did not.`);
});

async function run() {
  console.log('\n=== harden-user-data-error-path (user-data-error-path #1) ===');
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
  console.log(`\nharden-user-data-error-path: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

module.exports = { run };
