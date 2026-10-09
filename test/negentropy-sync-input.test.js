'use strict';
/**
 * POST /api/negentropy-sync (src/api/pipeline/batch/commands/negentropySync.js): strfry runs with an argument list,
 * never through a shell, and only for a ws(s) relay and a JSON-object filter. Stack-free: child_process is stubbed, so
 * nothing runs.
 *
 *   N1 — the defaults run `strfry sync <relay> --filter <json> --dir down` as an argument list.
 *   N2 — a given relay and filter reach strfry as two arguments, the filter re-serialized.
 *   N3 — a relay that is not a ws(s) address is refused 400 and nothing runs.
 *   N4 — a filter that is not a JSON object is refused 400 and nothing runs.
 *   N5 — the module never calls exec or execSync (no shell string).
 */

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const MODULE = path.resolve(__dirname, '../src/api/pipeline/batch/commands/negentropySync.js');
const NL = String.fromCharCode(10);

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
const show = (v) => JSON.stringify(v);

/** Drive the handler with child_process stubbed; returns what ran and what was answered. */
function drive(body) {
  const ran = { execFile: [], exec: [] };
  const saved = { execFile: childProcess.execFile, exec: childProcess.exec };
  childProcess.execFile = (file, args, cb) => { ran.execFile.push({ file, args }); if (cb) cb(null, 'ok', ''); return {}; };
  childProcess.exec = (cmd, cb) => { ran.exec.push(cmd); if (cb) cb(null, 'ok', ''); return {}; };
  const realSetTimeout = global.setTimeout;
  global.setTimeout = () => 0; // the handler's 2-minute fallback never fires in a test
  try {
    delete require.cache[require.resolve(MODULE)];
    const { handleNegentropySync } = require(MODULE);
    const res = { statusCode: 200, body: undefined, headersSent: false };
    res.setHeader = () => {};
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (b) => { res.body = b; res.headersSent = true; return res; };
    handleNegentropySync({ body }, res);
    return { ran, res };
  } finally {
    childProcess.execFile = saved.execFile;
    childProcess.exec = saved.exec;
    global.setTimeout = realSetTimeout;
  }
}

test('N1: the defaults run strfry sync with an argument list — relay, --filter, the JSON, --dir down', () => {
  const { ran, res } = drive({});
  assert(ran.exec.length === 0, `no shell string: ${show(ran.exec)}`);
  assert(ran.execFile.length === 1 && ran.execFile[0].file === 'strfry', `one execFile of strfry, got ${show(ran.execFile)}`);
  const args = ran.execFile[0].args;
  assert(args[0] === 'sync' && /^wss:\/\//.test(args[1]) && args[2] === '--filter' && args[4] === '--dir' && args[5] === 'down', `args: ${show(args)}`);
  assert(JSON.parse(args[3]).kinds.length === 3, `the default filter: ${args[3]}`);
  assert(res.body && res.body.success === true, `answered success: ${show(res.body)}`);
});

test('N2: a given relay and filter reach strfry as two arguments, the filter re-serialized', () => {
  const { ran } = drive({ relay: 'wss://relay.example/', filter: '{ "kinds": [0] }' });
  const args = ran.execFile[0] && ran.execFile[0].args;
  assert(args && args[1] === 'wss://relay.example/' && args[3] === '{"kinds":[0]}', `args: ${show(args)}`);
});

test('N3: a relay that is not a ws(s) address is refused 400, and nothing runs', () => {
  const bad = ['wss://x.example; touch /tmp/pwned', 'https://web.example', '$(id)', 'wss://user:pw@x.example', 42, 'wss://bad host'];
  const wrong = [];
  for (const relay of bad) {
    const { ran, res } = drive({ relay });
    if (res.statusCode !== 400 || ran.execFile.length || ran.exec.length) wrong.push(`${show(relay)} → ${res.statusCode}, ran ${show(ran)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('N4: a filter that is not a JSON object is refused 400, and nothing runs', () => {
  const bad = ["{}' --dir up; id; echo '", 'not json', '[1,2]', '"text"', 7];
  const wrong = [];
  for (const filter of bad) {
    const { ran, res } = drive({ relay: 'wss://relay.example', filter });
    if (res.statusCode !== 400 || ran.execFile.length || ran.exec.length) wrong.push(`${show(filter)} → ${res.statusCode}, ran ${show(ran)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('N5: the module never calls exec or execSync — no shell string', () => {
  const src = fs.readFileSync(MODULE, 'utf8').split(NL).filter((l) => !/^\s*(\/\/|\*)/.test(l)).join(NL);
  assert(!/\bexec(Sync)?\s*\(/.test(src), 'negentropySync.js must not call exec( or execSync(');
});

async function run() {
  console.log(`${NL}=== negentropy-sync-input ===`);
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  PASS  ${name}`); pass++; } catch (err) {
      console.log(`  FAIL  ${name}${NL}        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`${NL}negentropy-sync-input: ${pass} passed, ${fail} failed, 0 skipped`);
  return { pass, fail, failures, skipped: 0 };
}

module.exports = { run };
