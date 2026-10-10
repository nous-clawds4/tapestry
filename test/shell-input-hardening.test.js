'use strict';
/**
 * Request values never reach a shell (owner decision, 2026-10-10). The handlers below ran `strfry scan` or `node` through
 * a shell command string built from request input; they now run the program with an argument list
 * (execFile / execFileSync), and a pubkey a request supplies must be 64 hex characters. Stack-free: child_process is
 * stubbed, so nothing runs.
 *
 *   I1 — GET kind 0: a pubkey that is not 64 hex characters is refused 400, and nothing runs.
 *   I2 — GET kind 0: a valid pubkey runs strfry with an argument list carrying the filter as one argument; no shell.
 *   I3 — GET kind 10040 info: a pubkey that is not 64 hex characters is refused 400, and nothing runs.
 *   I4 — GET kind 10040 info: a valid pubkey runs strfry with an argument list; no shell.
 *   I5 — POST create (and create-and-publish) kind 10040: a body pubkey that is not 64 hex characters is refused 400 and
 *        nothing runs; a valid one runs node with the script and the pubkey as separate arguments; no shell.
 *   I6 — none of the five files builds a shell command from a template string or a variable: no exec( / execSync( call
 *        is left in them.
 */

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const NL = String.fromCharCode(10);
const KIND0 = path.join(ROOT, 'src/api/export/profiles/queries/kind0.js');
const INFO = path.join(ROOT, 'src/api/export/nip85/queries/info.js');
const K10040 = path.join(ROOT, 'src/api/export/nip85/commands/kind10040.js');
const K10040P = path.join(ROOT, 'src/api/export/nip85/commands/create-and-publish-kind10040.js');
const FILES = [
  'src/api/export/profiles/queries/kind0.js',
  'src/api/export/nip85/queries/info.js',
  'src/api/export/nip85/commands/kind10040.js',
  'src/api/export/nip85/commands/create-and-publish-kind10040.js',
  'src/api/profiles/fetchProfiles.js',
];

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
const show = (v) => JSON.stringify(v);

const HEX = 'a'.repeat(64);
// Not 64 hex characters: too short, not hex, too long, a stray quote or separator, two keys.
const BAD = ['abc', 'g'.repeat(64), HEX + 'a', HEX.slice(1) + "'", HEX.slice(1) + ';', `${HEX} ${HEX}`];

/** Stub child_process, load the module fresh, run fn(module), restore. Records what would have run. */
function withStubs(modPath, fn) {
  const ran = { exec: [], execSync: [], execFile: [], execFileSync: [], spawn: [] };
  const saved = {};
  for (const k of Object.keys(ran)) saved[k] = childProcess[k];
  // Record only; never call back, so a handler does not go on to Neo4j or outside relays.
  childProcess.exec = (cmd) => { ran.exec.push(cmd); return { on() {} }; };
  childProcess.execSync = (cmd) => { ran.execSync.push(cmd); return Buffer.from(''); };
  childProcess.execFile = (file, args) => { ran.execFile.push({ file, args }); return { on() {} }; };
  childProcess.execFileSync = (file, args) => { ran.execFileSync.push({ file, args }); return Buffer.from(''); };
  childProcess.spawn = (file, args) => { ran.spawn.push({ file, args }); return { on() {}, stdout: { on() {} }, stderr: { on() {} } }; };
  const realSetTimeout = global.setTimeout;
  global.setTimeout = () => 0;
  try {
    delete require.cache[require.resolve(modPath)];
    return fn(require(modPath), ran);
  } finally {
    for (const k of Object.keys(saved)) childProcess[k] = saved[k];
    global.setTimeout = realSetTimeout;
    delete require.cache[require.resolve(modPath)];
  }
}

function mkRes() {
  const res = { statusCode: 200, body: undefined, headersSent: false };
  res.setHeader = () => {};
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; res.headersSent = true; return res; };
  res.send = (b) => { res.body = b; res.headersSent = true; return res; };
  return res;
}
const nothingRan = (ran) => ran.exec.length + ran.execSync.length + ran.execFile.length + ran.execFileSync.length + ran.spawn.length === 0;
const noShell = (ran) => ran.exec.length === 0 && ran.execSync.length === 0;

test('I1: GET kind 0 refuses a pubkey that is not 64 hex characters, and nothing runs', () => {
  const wrong = [];
  for (const pubkey of BAD) {
    withStubs(KIND0, (m, ran) => {
      const res = mkRes();
      m.handleGetKind0Event({ query: { pubkey } }, res);
      if (res.statusCode !== 400 || !nothingRan(ran)) wrong.push(`${show(pubkey)} → ${res.statusCode}, ran ${show(ran)}`);
    });
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('I2: GET kind 0 runs strfry with an argument list for a valid pubkey', () => {
  withStubs(KIND0, (m, ran) => {
    m.handleGetKind0Event({ query: { pubkey: HEX } }, mkRes());
    assert(noShell(ran), `no shell: ${show(ran)}`);
    const call = ran.execFile.find((c) => c.file === 'strfry');
    assert(call && call.args[0] === 'scan' && call.args.length === 2, `execFile strfry scan <filter>: ${show(ran.execFile)}`);
    const filter = JSON.parse(call.args[1]);
    assert(filter.authors && filter.authors[0] === HEX && filter.kinds[0] === 0, `the filter: ${call.args[1]}`);
  });
});

test('I3: GET kind 10040 info refuses a pubkey that is not 64 hex characters, and nothing runs', () => {
  const wrong = [];
  for (const pubkey of BAD) {
    withStubs(INFO, (m, ran) => {
      const res = mkRes();
      m.handleGetKind10040Info({ query: { pubkey } }, res);
      if (res.statusCode !== 400 || !nothingRan(ran)) wrong.push(`${show(pubkey)} → ${res.statusCode}, ran ${show(ran)}`);
    });
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('I4: GET kind 10040 info runs strfry with an argument list for a valid pubkey', () => {
  // The handler needs an owner pubkey in the config before it scans; supply one so the scan runs.
  const config = require(path.join(ROOT, 'src/utils/config'));
  const savedGet = config.getConfigFromFile;
  config.getConfigFromFile = (name, dflt) => (name === 'BRAINSTORM_OWNER_PUBKEY' ? 'b'.repeat(64) : dflt);
  try {
    withStubs(INFO, (m, ran) => {
      const res = mkRes();
      m.handleGetKind10040Info({ query: { pubkey: HEX } }, res);
      assert(res.body && res.body.success === true, `answers success: ${show(res.body)}`);
      assert(noShell(ran), `no shell: ${show(ran)}`);
      const call = ran.execFileSync.find((c) => c.file === 'strfry');
      assert(call && call.args[0] === 'scan' && call.args.length === 2, `execFileSync strfry scan <filter>: ${show(ran.execFileSync)}`);
      assert(JSON.parse(call.args[1]).authors[0] === HEX, `the filter: ${call.args[1]}`);
    });
  } finally {
    config.getConfigFromFile = savedGet;
  }
});

test('I5: POST kind 10040 refuses a bad body pubkey, and runs node with separate arguments for a good one', () => {
  for (const [modPath, name] of [[K10040, 'handleCreateKind10040'], [K10040P, 'handleCreateAndPublishKind10040']]) {
    const wrong = [];
    for (const pubkey of BAD) {
      withStubs(modPath, (m, ran) => {
        const res = mkRes();
        m[name]({ session: { authenticated: true }, body: { pubkey } }, res);
        if (res.statusCode !== 400 || !nothingRan(ran)) wrong.push(`${show(pubkey)} → ${res.statusCode}, ran ${show(ran)}`);
      });
    }
    assert(wrong.length === 0, `${name}: ${wrong.join('; ')}`);
    withStubs(modPath, (m, ran) => {
      m[name]({ session: { authenticated: true }, body: { pubkey: HEX } }, mkRes());
      assert(noShell(ran), `${name} no shell: ${show(ran)}`);
      const call = ran.execFile.find((c) => c.file === 'node');
      assert(call && call.args.length === 2 && /\.js$/.test(call.args[0]) && call.args[1] === HEX, `${name} execFile node <script> <pubkey>: ${show(ran.execFile)}`);
    });
  }
});

test('I6: none of the five files calls exec( or execSync(', () => {
  const wrong = [];
  for (const rel of FILES) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8').split(NL).filter((l) => !/^\s*(\/\/|\*)/.test(l)).join(NL);
    if (/\bexec(Sync)?\s*\(/.test(src)) wrong.push(rel);
  }
  assert(wrong.length === 0, `still calls exec( or execSync(: ${wrong.join(', ')}`);
});

async function run() {
  console.log(`${NL}=== shell-input-hardening ===`);
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  PASS  ${name}`); pass++; } catch (err) {
      console.log(`  FAIL  ${name}${NL}        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`${NL}shell-input-hardening: ${pass} passed, ${fail} failed, 0 skipped`);
  return { pass, fail, failures, skipped: 0 };
}

module.exports = { run };
