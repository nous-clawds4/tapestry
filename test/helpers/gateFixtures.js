'use strict';
/**
 * Guard-side fixtures for honest-test-gate #1 — shared by test/gate-result-record.test.js
 * and the re-aimed G3/G5/G6/G7 in test/stack-free-npm-test.test.js.
 *
 * Story: engineering-team/stories/honest-test-gate/1-gate-result-tells-the-truth.md
 * ADR:   engineering-team/decisions/honest-test-gate/0001-registry-runner-and-run-record.md
 *
 * PHASE-3 OWNED (ADR 0001, Implementation notes, carve-out): the Implementer must not
 * modify this file, test/gate-result-record.test.js, or test/stack-free-npm-test.test.js.
 *
 * Nothing here requires the gate engine at module load. Before implementation the
 * engine does not exist, and a registered suite that throws at require time would crash
 * the current runner's load phase for every suite on the branch. Every engine touch goes
 * through need(), which names what is missing and the ADR section that defines it.
 *
 * Fixture suites are written to a fresh temp dir per scenario and handed to runGate() as
 * paths RELATIVE TO test/ — the registry's resolution base (ADR §1) — so any sane
 * resolution against test/ finds them. Records go to a fresh temp dir (passed as
 * recordDir and as GATE_RECORD_DIR), except where a test deliberately exercises the
 * default location. Children are spawned with cwd = the repo, so the record's git
 * identity is this checkout's.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const TEST_DIR = path.join(REPO, 'test');
const ADR = 'engineering-team/decisions/honest-test-gate/0001-registry-runner-and-run-record.md';

const MODULES = {
  runner: { rel: 'test/helpers/gateRunner.js', what: 'the engine, runGate({ suites, recordDir, label })', adr: '§1' },
  record: { rel: 'test/helpers/gateRecord.js', what: 'the run-record helpers', adr: '§2' },
  registry: { rel: 'test/registry.js', what: 'the ordered suite registry ({ suites, excluded })', adr: '§3' },
  status: { rel: 'test/gate-status.js', what: 'the reader behind `npm run gate:status`', adr: '§5' },
  stackHttp: { rel: 'test/helpers/stackHttp.js', what: 'the shared stack-HTTP helper (loopbackRequest, describeResponse)', adr: '§6' },
};

function modulePath(key) { return path.join(REPO, MODULES[key].rel); }

/** Throw a readable failure naming every missing module and the ADR section that defines it. */
function need(...keys) {
  const missing = keys.filter((k) => !fs.existsSync(modulePath(k)));
  if (missing.length) {
    throw new Error(missing
      .map((k) => `${MODULES[k].rel} does not exist yet — ${MODULES[k].what} (${ADR}, Implementation notes ${MODULES[k].adr}).`)
      .join(' '));
  }
}

function short(v, n = 200) {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s === undefined ? String(v) : (s.length > n ? `${s.slice(0, n)}…` : s);
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function readSafe(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }
function lines(text) { return String(text || '').split('\n').map((l) => l.replace(/\r$/, '')).filter((l) => l.trim() !== ''); }
function firstLine(text) { return lines(text)[0] || ''; }
function lastLine(text) { const ls = lines(text); return (ls[ls.length - 1] || '').trim(); }

/* ───────────── fixture suites ───────────── */

const pass = (p) => `module.exports = { run: async () => ({ pass: ${p}, fail: 0 }) };\n`;

const FIXTURE_SOURCES = {
  'pass.test.js': pass(2),
  'second-pass.test.js': pass(1),
  'third-pass.test.js': pass(1),
  'fourth-pass.test.js': pass(1),
  'fifth-pass.test.js': pass(1),
  'fail.test.js': 'module.exports = { run: async () => ({ pass: 1, fail: 1 }) };\n',
  'skip-only.test.js': 'module.exports = { run: async () => ({ pass: 0, fail: 0, skipped: 3 }) };\n',
  'mixed.test.js': 'module.exports = { run: async () => ({ pass: 2, fail: 0, skipped: 1 }) };\n',
  'fail-with-skips.test.js': 'module.exports = { run: async () => ({ pass: 0, fail: 1, skipped: 2 }) };\n',
  'throws-in-run.test.js':
    "module.exports = { run: async () => { throw new TypeError('fetch failed (fixture: throws-in-run)'); } };\n",
  'throws-at-load.test.js': "throw new Error('boom at load (fixture: throws-at-load)');\n",
  'calls-exit.test.js': 'module.exports = { run: async () => { process.exit(0); return { pass: 1, fail: 0 }; } };\n',
  // The rejection must be observed while the engine is still running: yield one macrotask
  // so Node processes unhandled rejections before this suite returns.
  'stray-rejection.test.js':
    "module.exports = { run: async () => {\n" +
    "  Promise.reject(new Error('stray rejection (fixture: stray-rejection)'));\n" +
    '  await new Promise((r) => setTimeout(r, 50));\n' +
    '  return { pass: 1, fail: 0 };\n' +
    '} };\n',
  'no-counts.test.js': 'module.exports = { run: async () => undefined };\n',
  'brief.test.js': 'module.exports = { run: () => new Promise((r) => setTimeout(() => r({ pass: 1, fail: 0 }), 400)) };\n',
  'slow.test.js': 'module.exports = { run: () => new Promise((r) => setTimeout(() => r({ pass: 1, fail: 0 }), 60000)) };\n',
  // ~4 MB of output: enough to leave writes queued behind a pipe, then exit.
  'noisy.test.js':
    "const line = 'n'.repeat(199);\n" +
    'module.exports = { run: async () => { for (let i = 0; i < 20000; i++) console.log(line); return { pass: 1, fail: 0 }; } };\n',
  // ~600 KB of output, then marks the moment it finished (for AC-5's lag measurement).
  'marked-noisy.test.js':
    "const fs = require('fs');\n" +
    "const line = 'm'.repeat(199);\n" +
    'module.exports = { run: async () => {\n' +
    '  for (let i = 0; i < 3000; i++) console.log(line);\n' +
    '  fs.writeFileSync(process.env.GATE_FIXTURE_MARKER, String(Date.now()));\n' +
    '  return { pass: 1, fail: 0 };\n' +
    '} };\n',
  // Blocks the event loop for 6 s — longer than AC-5's 5 s bound.
  'blocking.test.js':
    "module.exports = { run: async () => { require('child_process').execSync('sleep 6'); return { pass: 1, fail: 0 }; } };\n",
  'env-writer.test.js':
    "module.exports = { run: async () => { process.env.GATE_FIXTURE_ENV_PROBE = 'written-by-env-writer'; return { pass: 1, fail: 0 }; } };\n",
  'env-reader.test.js':
    'const SEEN_AT_LOAD = process.env.GATE_FIXTURE_ENV_PROBE;\n' +
    'module.exports = { run: async () => (SEEN_AT_LOAD === undefined ? { pass: 1, fail: 0 } : { pass: 0, fail: 1 }) };\n',

  /* ── Added at the review kick-back, 2026-09-13 (review c6ed2b35, Blocking 1 and 2) ── */

  // Blocking 1, route 1 — the engine's own failure. From its run() on, every write into the
  // run's record directory throws, whichever fs entry point it goes through (sync, callback
  // or promise; both the given and the real path of the directory). Then it passes, so the
  // engine's next record write is the one that fails. The first refused write is marked in
  // GATE_FIXTURE_MARKER, so the guard can tell that the fault fired.
  'record-write-fault.test.js':
    "const fs = require('fs');\n" +
    "const path = require('path');\n" +
    "if (!process.env.GATE_RECORD_DIR) throw new Error('record-write-fault needs GATE_RECORD_DIR');\n" +
    'const DIRS = [path.resolve(process.env.GATE_RECORD_DIR), fs.realpathSync(process.env.GATE_RECORD_DIR)].map((d) => d + path.sep);\n' +
    "const inDir = (p) => typeof p === 'string' && DIRS.some((d) => path.resolve(p).startsWith(d));\n" +
    "const writes = (f) => (typeof f === 'number' ? (f & (fs.constants.O_WRONLY | fs.constants.O_RDWR)) !== 0 : typeof f === 'string' && /[wa+]/.test(f));\n" +
    'const one = (a) => inDir(a[0]);\n' +
    'const opening = (a) => inDir(a[0]) && writes(a[1]);\n' +
    'const either = (a) => inDir(a[0]) || inDir(a[1]);\n' +
    'const mark = fs.writeFileSync;\n' +
    'let fired = false;\n' +
    'function trap(api, names, refused, promised) {\n' +
    '  for (const n of names) {\n' +
    '    const real = api[n];\n' +
    "    if (typeof real !== 'function') continue;\n" +
    '    api[n] = function (...args) {\n' +
    '      if (!refused(args)) return real.apply(this, args);\n' +
    '      if (!fired && process.env.GATE_FIXTURE_MARKER) { fired = true; mark(process.env.GATE_FIXTURE_MARKER, String(Date.now())); }\n' +
    "      const e = new Error('injected record-write failure (fixture: record-write-fault)');\n" +
    '      if (promised) return Promise.reject(e);\n' +
    '      throw e;\n' +
    '    };\n' +
    '  }\n' +
    '}\n' +
    'module.exports = { run: async () => {\n' +
    "  trap(fs, ['writeFileSync', 'appendFileSync', 'writeFile', 'appendFile'], one, false);\n" +
    "  trap(fs, ['openSync', 'open'], opening, false);\n" +
    "  trap(fs, ['renameSync', 'copyFileSync', 'rename', 'copyFile'], either, false);\n" +
    "  trap(fs.promises, ['writeFile', 'appendFile'], one, true);\n" +
    "  trap(fs.promises, ['open'], opening, true);\n" +
    "  trap(fs.promises, ['rename', 'copyFile'], either, true);\n" +
    '  return { pass: 1, fail: 0 };\n' +
    '} };\n',
  // Blocking 1, route 2 — ends the process while the engine is still loading suites.
  'exits-at-load.test.js':
    'process.exit(0); // (fixture: exits-at-load) runs while the engine loads suites, before any has run\n' +
    'module.exports = { run: async () => ({ pass: 1, fail: 0 }) };\n',
  // Blocking 1, route 3 — passes, leaving a process.exit(0) behind on a timer. Registered
  // last, the timer fires after this suite's run() has returned.
  'deferred-exit.test.js':
    'module.exports = { run: async () => { setTimeout(() => process.exit(0), 0); return { pass: 1, fail: 0 }; } };\n',
  // Blocking 1, route 4 — a run() that never settles and holds no timer or handle open.
  'never-settles.test.js': 'module.exports = { run: () => new Promise(() => {}) };\n',
  // Blocking 2 — counts that are not non-negative integers.
  'nan-fail.test.js': 'module.exports = { run: async () => ({ pass: 1, fail: NaN }) };\n',
  'negative-fail.test.js': 'module.exports = { run: async () => ({ pass: 1, fail: -1 }) };\n',
  'string-skipped.test.js': "module.exports = { run: async () => ({ pass: 1, fail: 0, skipped: '4' }) };\n",
};

const DRIVER_SOURCE =
  "'use strict';\n" +
  '// Drives the gate engine over a fixture registry (honest-test-gate #1 guards).\n' +
  'const { runGate } = require(process.env.GATE_FIXTURE_RUNNER);\n' +
  'const opts = { suites: JSON.parse(process.env.GATE_FIXTURE_SUITES) };\n' +
  'if (process.env.GATE_FIXTURE_RECORD_DIR) opts.recordDir = process.env.GATE_FIXTURE_RECORD_DIR;\n' +
  'if (process.env.GATE_FIXTURE_LABEL) opts.label = process.env.GATE_FIXTURE_LABEL;\n' +
  "Promise.resolve(runGate(opts)).catch((e) => { console.error('driver: runGate rejected: ' + ((e && e.stack) || e)); process.exit(99); });\n";

/** A fresh temp dir with a driver, a record dir, and fixture writers. cleanup() kills children and removes it. */
function scenario() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-guard-'));
  const recordDir = path.join(dir, 'records');
  fs.mkdirSync(recordDir);
  const driver = path.join(dir, 'driver.js');
  fs.writeFileSync(driver, DRIVER_SOURCE);
  const children = new Set();
  return {
    dir,
    recordDir,
    driver,
    children,
    /** Write fixture `name` (if not yet written) and return its registry entry. */
    suite(name, skipNote) {
      const src = FIXTURE_SOURCES[name];
      if (!src) throw new Error(`gateFixtures: unknown fixture ${name}`);
      const abs = path.join(dir, name);
      if (!fs.existsSync(abs)) fs.writeFileSync(abs, src);
      const entry = { file: path.relative(TEST_DIR, abs) };
      if (skipNote) entry.skipNote = skipNote;
      return entry;
    },
    cleanup() {
      for (const c of children) { try { c.kill('SIGKILL'); } catch { /* already gone */ } }
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** Child env for one engine run. recordDir null ⇒ exercise the default record location. */
function engineEnv(sc, suites, { label, recordDir = sc.recordDir, extraEnv } = {}) {
  const env = { ...process.env };
  delete env.GATE_LABEL;
  delete env.GATE_RECORD_DIR;
  delete env.GATE_FIXTURE_ENV_PROBE;
  env.GATE_FIXTURE_RUNNER = modulePath('runner');
  env.GATE_FIXTURE_SUITES = JSON.stringify(suites);
  if (recordDir) { env.GATE_FIXTURE_RECORD_DIR = recordDir; env.GATE_RECORD_DIR = recordDir; }
  if (label) env.GATE_FIXTURE_LABEL = label;
  return { ...env, ...(extraEnv || {}) };
}

/** Run the engine to completion in a child process. */
function runEngineSync(sc, suites, opts = {}) {
  need('runner');
  const r = cp.spawnSync(process.execPath, [sc.driver], {
    cwd: REPO,
    env: engineEnv(sc, suites, opts),
    encoding: 'utf8',
    timeout: opts.timeoutMs || 60000,
    maxBuffer: 32 * 1024 * 1024,
  });
  return { status: r.status, signal: r.signal, stdout: r.stdout || '', stderr: r.stderr || '', error: r.error };
}

/**
 * Start the engine without waiting. stdoutTo: 'pipe' (default) or a file path.
 * firstMatch(re) resolves to the time the matching output first became readable.
 */
function startEngine(sc, suites, opts = {}) {
  need('runner');
  const stdoutTo = opts.stdoutTo || 'pipe';
  let fd = null;
  const stdio = ['ignore', 'pipe', 'pipe'];
  if (stdoutTo !== 'pipe') { fd = fs.openSync(stdoutTo, 'w'); stdio[1] = fd; }
  const child = cp.spawn(process.execPath, [sc.driver], { cwd: REPO, env: engineEnv(sc, suites, opts), stdio });
  if (fd !== null) fs.closeSync(fd);
  sc.children.add(child);
  const chunks = [];
  let stderr = '';
  if (child.stdout) { child.stdout.setEncoding('utf8'); child.stdout.on('data', (c) => chunks.push({ t: Date.now(), text: c })); }
  if (child.stderr) { child.stderr.setEncoding('utf8'); child.stderr.on('data', (c) => { stderr += c; }); }
  const exited = new Promise((resolve) => child.on('exit', (status, signal) => { sc.children.delete(child); resolve({ status, signal }); }));
  const output = () => (stdoutTo === 'pipe' ? chunks.map((c) => c.text).join('') : (readSafe(stdoutTo) || ''));
  function arrival(re) {
    if (stdoutTo !== 'pipe') return re.test(readSafe(stdoutTo) || '') ? Date.now() : null;
    let acc = '';
    for (const c of chunks) { acc += c.text; if (re.test(acc)) return c.t; }
    return null;
  }
  return {
    child,
    exited,
    output,
    stderr: () => stderr,
    async firstMatch(re, timeoutMs) {
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        const at = arrival(re);
        if (at !== null) return at;
        if (Date.now() > deadline || child.exitCode !== null || child.signalCode !== null) return arrival(re);
        await sleep(25);
      }
    },
  };
}

/* ───────────── records & reader ───────────── */

function recordFiles(dir) {
  if (!dir || !fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => path.join(dir, f));
}
/** Every record in dir, parsed ({ path, rec } — rec null if unreadable). */
function readRecords(dir) {
  return recordFiles(dir).map((p) => {
    try { return { path: p, rec: JSON.parse(fs.readFileSync(p, 'utf8')) }; } catch { return { path: p, rec: null }; }
  });
}
async function waitFor(fn, timeoutMs, stepMs = 50) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() > end) return null;
    await sleep(stepMs);
  }
}
/** Map suite-file basename → the record's entry for it. */
function entryMap(rec) {
  const m = {};
  for (const e of (rec && rec.suites) || []) if (e && e.file) m[path.basename(e.file)] = e;
  return m;
}

/** Run the reader (test/gate-status.js) against recordDir (null ⇒ its default). */
function runStatus(args, recordDir) {
  need('status');
  const env = { ...process.env };
  delete env.GATE_LABEL;
  if (recordDir) env.GATE_RECORD_DIR = recordDir; else delete env.GATE_RECORD_DIR;
  const r = cp.spawnSync(process.execPath, [modulePath('status'), ...args], { cwd: REPO, env, encoding: 'utf8', timeout: 20000 });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

/* ───────────── shells, git, the stack-HTTP helper ───────────── */

function hasShell(name) {
  const r = cp.spawnSync(name, ['-c', 'true'], { encoding: 'utf8' });
  return !r.error && r.status === 0;
}
function git(args) {
  const r = cp.spawnSync('git', args, { cwd: REPO, encoding: 'utf8' });
  return (r.stdout || '').trim();
}

const FAKE_DOCKER =
  '#!/bin/sh\n' +
  '# Fake `docker` for the stack-HTTP guard (honest-test-gate #1). Ignores its arguments and\n' +
  '# prints what `docker exec … curl -w "\\n__STATUS__%{http_code}"` would, per FAKE_DOCKER_MODE.\n' +
  'case "$FAKE_DOCKER_MODE" in\n' +
  "  ok)       printf '%s\\n__STATUS__%s' '{\"success\":true}' 200 ;;\n" +
  "  ok-false) printf '%s\\n__STATUS__%s' '{\"success\":false,\"error\":\"refused\"}' 200 ;;\n" +
  "  http500)  printf '%s\\n__STATUS__%s' '{\"success\":false,\"error\":\"server error\"}' 500 ;;\n" +
  '  empty)    : ;;\n' +
  "  nomarker) printf '%s' '{\"success\":true}' ;;\n" +
  "  zero)     printf '\\n__STATUS__000' ;;\n" +
  "  exit1)    echo 'Error response from daemon: No such container: tapestry' >&2; exit 1 ;;\n" +
  '  *)        echo "fake docker: unknown FAKE_DOCKER_MODE=$FAKE_DOCKER_MODE" >&2; exit 2 ;;\n' +
  'esac\n';

/** Write the fake docker into <dir>/fakebin and return that directory. */
function makeFakeDocker(dir) {
  const bin = path.join(dir, 'fakebin');
  fs.mkdirSync(bin, { recursive: true });
  const p = path.join(bin, 'docker');
  fs.writeFileSync(p, FAKE_DOCKER);
  fs.chmodSync(p, 0o755);
  return bin;
}

const PROBE_SOURCE =
  'const h = require(process.env.GATE_FIXTURE_STACKHTTP);\n' +
  "Promise.resolve(h.loopbackRequest({ container: 'tapestry', method: 'POST', url: 'http://127.0.0.1:7778/api/fixture', body: { probe: 1 }, timeoutS: 5 }))\n" +
  "  .then((r) => { console.log('__PROBE__' + JSON.stringify({ r, described: h.describeResponse(r) })); })\n" +
  "  .catch((e) => { console.log('__PROBE__' + JSON.stringify({ threw: String((e && e.message) || e) })); });\n";

/** Call loopbackRequest() in a child whose PATH finds the fake docker first. */
function probeStackHttp(binDir, mode) {
  need('stackHttp');
  const env = {
    ...process.env,
    PATH: `${binDir}${path.delimiter}${process.env.PATH || ''}`,
    FAKE_DOCKER_MODE: mode,
    GATE_FIXTURE_STACKHTTP: modulePath('stackHttp'),
  };
  const r = cp.spawnSync(process.execPath, ['-e', PROBE_SOURCE], { cwd: REPO, env, encoding: 'utf8', timeout: 20000 });
  const line = (r.stdout || '').split('\n').find((l) => l.startsWith('__PROBE__'));
  if (!line) return { threw: `the probe produced no result (exit ${r.status}); stderr: ${short(r.stderr)}` };
  return JSON.parse(line.slice('__PROBE__'.length));
}

module.exports = {
  REPO, TEST_DIR, ADR, MODULES, modulePath, need,
  short, sleep, readSafe, lines, firstLine, lastLine,
  FIXTURE_SOURCES, scenario, engineEnv, runEngineSync, startEngine,
  readRecords, waitFor, entryMap, runStatus,
  hasShell, git, makeFakeDocker, probeStackHttp,
};
