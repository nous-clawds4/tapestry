'use strict';
/**
 * Story relay-stream-gaps #1: changing streams doesn't interrupt the other streams.
 * ADR relay-stream-gaps/0001 (Accepted): apply stream changes by rewriting the router
 * config IN PLACE and confirming the reload from the router's stderr log; restart only
 * as the fallback (router not running, or no reload logged within the timeout).
 * Test plan: engineering-team/stories/relay-stream-gaps/1-stream-changes-without-router-restart.test-plan.md
 *
 * Stack-free: no supervisord, strfry, Docker or network. The seams, all installed inside
 * run() and removed when it ends, so no other suite sees them:
 *   - child_process.exec / execFile are stubbed BEFORE routerStatus.js and routerConfig.js
 *     are freshly required (both destructure exec at require time). The stub answers
 *     `supervisorctl status strfry-router` with a RUNNING / STOPPED / FATAL line and records
 *     every command, so "the router was not restarted" means "no `supervisorctl restart` ran"
 *     (the uptime router status shows is that same supervisorctl line).
 *   - fs calls on the router's three paths (config, state, stderr log) are redirected to a
 *     temp dir, so writes really land (content and inode can be checked) and nothing under
 *     /etc or /var is touched. Every call on those paths is recorded in order with the
 *     commands above (writeFileSync vs rename/copy/unlink, write-before-restart).
 *   - A fake strfry reacts to each write of the config the way strfry 1.1.0's router does
 *     (ADR § Context and § Verified evidence): ~50 ms later it appends a
 *     `Loading router config file` line to the log, optionally followed by
 *     `Failed to parse router config: <reason>`; or it stays silent (watch lost / stuck).
 *   - src/middleware/auth.js is swapped for a stub only while routerConfig.js loads. The
 *     owner gate is not this suite's subject (strfry-router-owner-gate pins it), and the real
 *     module's dependency chain needs node_modules. Every request here is localTrusted.
 *   - Timeout-fallback tests dilate time 20x (setTimeout/setInterval, Date.now,
 *     performance.now, timers/promises.setTimeout), so RELOAD_TIMEOUT_MS = 3000 costs about
 *     150 ms. Speed only: an implementation that times out some other way still passes, slower.
 *
 * Before the implementation every test fails on a missing export or a contract assertion
 * (never a load error), except the G* guards, which pin behavior the ADR keeps unchanged and
 * pass before and after.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const util = require('util');
const Module = require('module');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ROUTER = path.join(ROOT, 'src/api/strfry/routerConfig.js');
const ROUTER_STATUS = path.join(ROOT, 'src/api/strfry/routerStatus.js');
const AUTH = path.join(ROOT, 'src/middleware/auth.js');
const RELAY_SETTINGS = path.join(ROOT, 'ui/src/pages/settings/RelaySettings.jsx');
const BIBLE = path.join(ROOT, 'BIBLE.md');
const CONFIGURATION_DOC = path.join(ROOT, 'docs/CONFIGURATION.md');
const PRESETS = path.join(ROOT, 'setup/router-presets.json');

const CONFIG_PATH = '/etc/strfry-router-tapestry.config';
const STATE_PATH = '/var/lib/brainstorm/router-state.json';
const LOG_PATH = '/var/log/supervisor/strfry-router-error.log';
const ROUTED = [CONFIG_PATH, STATE_PATH, LOG_PATH];

const ADR = 'ADR relay-stream-gaps/0001';
const REASON = 'unrecognised filter item: bogusfield';
const STALE_REASON = 'stale reason from an earlier edit';
const RESTART_CLAUSE = 'did not pick it up by itself, so it was restarted';
const REJECTED_HEAD = 'The router rejected the new configuration';
const REJECTED_TAIL = 'It is still running the previous streams; nothing was changed.';
// ADR 0001 Amendment 1: the rollback's own reload was not seen, so the router was restarted on the previous config.
const ROLLBACK_RESTARTED_TAIL = 'It was restarted to put the previous streams back; nothing was changed.';

const REAL_SET_TIMEOUT = global.setTimeout;

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function eq(actual, expected, msg) {
  assert(JSON.stringify(actual) === JSON.stringify(expected),
    `${msg}\n        expected: ${JSON.stringify(expected)}\n        actual:   ${JSON.stringify(actual)}`);
}
const NOT_IMPL = (what) => `${what}: not implemented yet (${ADR}).`;
const sleep = (ms) => new Promise((r) => REAL_SET_TIMEOUT(r, ms));
const clone = (o) => JSON.parse(JSON.stringify(o));

// ── strfry 1.1.0 router log lines (shape from ADR § Verified evidence 4) ─────────────────
function logLine(level, msg, thread = 'main thread     ') {
  return `2026-10-09 03:12:45.823 (   0.036s) [${thread}]${level.padStart(4)}| ${msg}\n`;
}
const LOADING = logLine('INFO', `Loading router config file: ${CONFIG_PATH}`);
const FAILED = (reason) => logLine('ERR', `Failed to parse router config: ${reason}`);
const NOISE = logLine('INFO', 'alpha: Connected to wss://a.example', 'Router          ');
// Already in the log before any mutation: an OLDER edit that was loaded and then rejected.
// Reading the log from 0 instead of from the pre-write offset would see a Loading line (a
// false confirmation) and a Failed line (a false rejection).
const STALE_LOG = LOADING + FAILED(STALE_REASON) + NOISE + NOISE;

// ── Fixtures ────────────────────────────────────────────────────────────────────────────
const ALPHA = { name: 'alpha', description: 'never touched', dir: 'down', filter: { kinds: [0], limit: 5 }, urls: ['wss://a.example'], pluginDown: '', pluginUp: '', enabled: true };
const BETA = { name: 'beta', description: '', dir: 'both', filter: { kinds: [9998, 9999, 39998, 39999] }, urls: ['wss://b1.example', 'wss://b2.example'], pluginDown: '', pluginUp: '', enabled: true };
const GAMMA = { name: 'gamma', description: '', dir: 'up', filter: { kinds: [1] }, urls: ['wss://c.example'], pluginDown: '', pluginUp: '', enabled: false };
const BASE_STATE = { streams: [ALPHA, BETA, GAMMA] };
// A save that keeps alpha, edits beta (one relay dropped), deletes gamma and adds delta.
const EDITED_STREAMS = [
  ALPHA,
  { ...BETA, urls: ['wss://b1.example'] },
  { name: 'delta', description: '', dir: 'down', filter: { kinds: [30382], limit: 10 }, urls: ['wss://d.example'], pluginDown: '', pluginUp: '', enabled: true },
];
const withEnabled = (state, name, enabled) => ({ streams: state.streams.map((s) => (s.name === name ? { ...s, enabled } : s)) });
const PRESET_LIST = JSON.parse(fs.readFileSync(PRESETS, 'utf8'));
const PRESET_STREAMS = PRESET_LIST.map((p) => ({ name: p.name, dir: p.dir, filter: p.filter, urls: p.urls, pluginDown: p.pluginDown || '', pluginUp: p.pluginUp || '', enabled: !!p.defaultEnabled }));
const PRESET_MESSAGE = `Restored ${PRESET_LIST.length} preset stream(s) (${PRESET_LIST.filter((p) => p.defaultEnabled).length} enabled)`;

// ── child_process seam ──────────────────────────────────────────────────────────────────
const STATUS_LINES = {
  RUNNING: 'strfry-router                    RUNNING   pid 4242, uptime 0:42:17',
  STOPPED: 'strfry-router                    STOPPED   Oct 09 03:00 AM',
  FATAL: 'strfry-router                    FATAL     Exited too quickly (process log may have details)',
};
const env = { status: 'RUNNING', events: [], failLogReads: 0, failRestart: false }; // events: exec commands and router-path fs calls, in call order

function fakeExec(cmd, opts, cb) {
  const done = typeof opts === 'function' ? opts : cb;
  const c = String(cmd);
  env.events.push({ kind: 'exec', cmd: c });
  let err = null;
  let out = '';
  if (/supervisorctl\s+status\b/.test(c)) {
    out = `${STATUS_LINES[env.status]}\n`;
    // Real supervisorctl exits non-zero (3) for a program that isn't RUNNING, with stdout.
    if (env.status !== 'RUNNING') err = Object.assign(new Error(`Command failed: ${c}`), { code: 3 });
  } else if (/supervisorctl\s+restart\s+strfry-router/.test(c)) {
    out = 'strfry-router: stopped\nstrfry-router: started\n';
    if (env.failRestart) {
      out = 'strfry-router: stopped\nstrfry-router: ERROR (spawn error)\n';
      err = Object.assign(new Error(`Command failed: ${c}`), { code: 7 });
    }
  }
  if (done) process.nextTick(() => done(err, out, ''));
  return { pid: 0, stdout: null, stderr: null, on() { return this; }, once() { return this; }, kill() {} };
}
fakeExec[util.promisify.custom] = (cmd, opts) => new Promise((resolve, reject) => {
  fakeExec(cmd, opts, (err, stdout, stderr) => (err ? reject(Object.assign(err, { stdout, stderr })) : resolve({ stdout, stderr })));
});
function fakeExecFile(file, args, opts, cb) {
  if (typeof args === 'function') { cb = args; args = []; opts = undefined; } else if (typeof opts === 'function') { cb = opts; opts = undefined; }
  return fakeExec([file, ...(args || [])].join(' '), opts, cb);
}
fakeExecFile[util.promisify.custom] = (file, args, opts) => fakeExec[util.promisify.custom]([file, ...(args || [])].join(' '), opts);

// ── fs seam: redirect + record calls on the router's three paths ───────────────────────
const ONE_PATH = ['existsSync', 'statSync', 'lstatSync', 'accessSync', 'readFileSync', 'writeFileSync', 'appendFileSync', 'openSync', 'truncateSync', 'unlinkSync', 'rmSync', 'createReadStream', 'createWriteStream',
  'stat', 'lstat', 'access', 'readFile', 'writeFile', 'appendFile', 'open', 'truncate', 'unlink', 'rm'];
const TWO_PATH = ['renameSync', 'copyFileSync', 'linkSync', 'symlinkSync', 'cpSync', 'rename', 'copyFile', 'link', 'symlink', 'cp'];
const PROMISES_ONE = ['stat', 'lstat', 'access', 'readFile', 'writeFile', 'appendFile', 'open', 'truncate', 'unlink', 'rm'];
const PROMISES_TWO = ['rename', 'copyFile', 'link', 'symlink', 'cp'];
// Any of these on the config path replaces or drops its inode, which silently ends
// strfry 1.1.0's reloads (ADR § Consequences, § Verified evidence 3).
const REPLACING = /^(rename|copyFile|link|symlink|cp|unlink|rm)/;

const routed = (p) => typeof p === 'string' && ROUTED.some((r) => p === r || p.startsWith(r));
let TMP = null;
const target = (p) => (routed(p) ? path.join(TMP, p.replace(/\//g, '_')) : p);
const T = {};

function installFsRedirect() {
  const saved = [];
  const wrap = (obj, name, nPaths, label) => {
    const orig = obj[name];
    if (typeof orig !== 'function') return;
    saved.push([obj, name, orig]);
    obj[name] = function redirected(...args) {
      const hit = args.slice(0, nPaths).filter(routed);
      if (hit.length === 0) return orig.apply(this, args);
      // A transient failure on the log (Amendment 1 item 2), armed by the fake strfry.
      if (env.failLogReads > 0 && hit.includes(LOG_PATH) && /^(stat|open|readFile|createReadStream)/.test(name)) {
        env.failLogReads--;
        env.events.push({ kind: 'fs', fn: label + name, paths: hit, failed: true });
        throw Object.assign(new Error(`EMFILE: too many open files, ${name} '${LOG_PATH}'`), { code: 'EMFILE' });
      }
      env.events.push({ kind: 'fs', fn: label + name, paths: hit });
      for (let i = 0; i < nPaths; i++) args[i] = target(args[i]);
      const out = orig.apply(this, args);
      if (hit[0] === CONFIG_PATH && /^writeFile(Sync)?$/.test(name)) strfry.onConfigWrite();
      return out;
    };
  };
  for (const n of ONE_PATH) wrap(fs, n, 1, '');
  for (const n of TWO_PATH) wrap(fs, n, 2, '');
  for (const n of PROMISES_ONE) wrap(fs.promises, n, 1, 'promises.');
  for (const n of PROMISES_TWO) wrap(fs.promises, n, 2, 'promises.');
  return () => { for (const [obj, name, orig] of saved.reverse()) obj[name] = orig; };
}

// ── fake strfry 1.1.0 router: reacts to each config write ──────────────────────────────
let REAL = null; // fs functions captured before the redirect, for the fake's own log I/O
const strfry = {
  plan: [], fallback: 'reload', generation: 0,
  onConfigWrite() {
    const reaction = this.plan.length ? this.plan.shift() : this.fallback;
    const gen = this.generation;
    const later = (ms, fn) => REAL_SET_TIMEOUT(() => {
      if (gen !== strfry.generation) return; // a later test owns the log now
      try { fn(); } catch { /* temp dir already removed */ }
    }, ms);
    const append = (text) => REAL.appendFileSync(T.log, text);
    if (reaction === 'reload') later(50, () => append(LOADING + NOISE));
    else if (reaction === 'reject') later(50, () => append(LOADING + FAILED(REASON)));
    else if (reaction === 'reject-late') { later(50, () => append(LOADING)); later(150, () => append(FAILED(REASON))); }
    else if (reaction === 'rotate-reload') later(50, () => { REAL.writeFileSync(T.log, ''); append(LOADING); });
    // The next read of the log fails once (EMFILE), then the reload is logged.
    else if (reaction === 'read-error-reload') { env.failLogReads = 1; later(50, () => append(LOADING + NOISE)); }
    // 'silent': the watch is gone or the router is stuck, so nothing is logged.
  },
};

// ── clock seam: dilate time for the timeout-fallback tests only ────────────────────────
const clock = {
  factor: 1, saved: null, base: 0, perfBase: 0,
  scale(ms) { const n = Number(ms); return this.factor !== 1 && Number.isFinite(n) && n > 0 ? n / this.factor : ms; },
  install() {
    const tp = require('timers/promises');
    const s = this.saved = {
      setTimeout: global.setTimeout, setInterval: global.setInterval, dateNow: Date.now,
      perfNow: performance.now, perfOwn: Object.prototype.hasOwnProperty.call(performance, 'now'), tp, tpSetTimeout: tp.setTimeout,
    };
    const self = this;
    const st = function setTimeout(fn, ms, ...rest) { return s.setTimeout(fn, self.scale(ms), ...rest); };
    st[util.promisify.custom] = (ms, value, options) => tp.setTimeout(ms, value, options);
    global.setTimeout = st;
    global.setInterval = function setInterval(fn, ms, ...rest) { return s.setInterval(fn, self.scale(ms), ...rest); };
    Date.now = () => (self.factor === 1 ? s.dateNow() : self.base + (s.dateNow() - self.base) * self.factor);
    performance.now = () => (self.factor === 1 ? s.perfNow.call(performance) : self.perfBase + (s.perfNow.call(performance) - self.perfBase) * self.factor);
    tp.setTimeout = (ms, ...rest) => s.tpSetTimeout(self.scale(ms), ...rest);
  },
  dilate(f) { this.base = this.saved.dateNow(); this.perfBase = this.saved.perfNow.call(performance); this.factor = f; },
  normal() { this.factor = 1; },
  uninstall() {
    const s = this.saved;
    if (!s) return;
    this.factor = 1;
    global.setTimeout = s.setTimeout; global.setInterval = s.setInterval; Date.now = s.dateNow; s.tp.setTimeout = s.tpSetTimeout;
    if (s.perfOwn) performance.now = s.perfNow; else delete performance.now;
    this.saved = null;
  },
};
async function dilated(fn) { clock.dilate(20); try { return await fn(); } finally { clock.normal(); } }

// ── module loading ──────────────────────────────────────────────────────────────────────
let router = null;
let routerStatus = null;
let loadError = null;
function loadModules() {
  const authId = require.resolve(AUTH);
  const prevAuth = require.cache[authId];
  const stub = new Module(authId, module);
  stub.filename = authId; stub.loaded = true; stub.exports = { isOwner: () => false };
  require.cache[authId] = stub;
  try {
    delete require.cache[require.resolve(ROUTER_STATUS)];
    delete require.cache[require.resolve(ROUTER)];
    routerStatus = require(ROUTER_STATUS);
    router = require(ROUTER);
  } catch (e) {
    loadError = e;
  } finally {
    if (prevAuth) require.cache[authId] = prevAuth; else delete require.cache[authId];
  }
}
function needRouter() { if (loadError || !router) throw new Error(`routerConfig.js failed to load: ${loadError && loadError.message}`); return router; }
function needFn(mod, name, where) {
  assert(mod && typeof mod[name] === 'function', NOT_IMPL(`${where} must export ${name}()`));
  return mod[name];
}

// ── per-test environment ────────────────────────────────────────────────────────────────
function freshEnv({ state = BASE_STATE, log = STALE_LOG, status = 'RUNNING', plan = [], fallback = 'reload' } = {}) {
  const r = needRouter();
  strfry.generation++;
  strfry.plan = plan.slice(); strfry.fallback = fallback;
  env.status = status;
  env.failLogReads = 0;
  env.failRestart = false;
  REAL.writeFileSync(T.state, JSON.stringify(state, null, 2), 'utf8');
  REAL.writeFileSync(T.config, r.generateConfig(state.streams), 'utf8');
  if (log === null) { try { REAL.unlinkSync(T.log); } catch { /* already absent */ } } else REAL.writeFileSync(T.log, log, 'utf8');
  env.events = [];
  return { ino: fs.statSync(T.config).ino, config: fs.readFileSync(T.config, 'utf8') };
}
function mkRes() {
  return { statusCode: null, body: null, status(c) { this.statusCode = c; return this; }, json(o) { this.body = o; return this; } };
}
async function call(fn, body) {
  const handler = needFn(needRouter(), fn, 'routerConfig.js');
  const res = mkRes();
  await handler({ session: {}, localTrusted: true, body }, res);
  assert(res.body, `${fn} sent no JSON response.`);
  return res;
}
const okStatus = (res) => res.statusCode === null || res.statusCode === 200;
const restarts = () => env.events.filter((e) => e.kind === 'exec' && /supervisorctl\s+restart\s+strfry-router/.test(e.cmd)).length;
const isConfigWrite = (e) => e.kind === 'fs' && /^(promises\.)?writeFile(Sync)?$/.test(e.fn) && e.paths[0] === CONFIG_PATH;
const configWrites = () => env.events.filter(isConfigWrite).length;
const readState = () => JSON.parse(fs.readFileSync(T.state, 'utf8'));
const readConfig = () => fs.readFileSync(T.config, 'utf8');

function assertNoRestart(what) {
  assert(restarts() === 0, `${what}: the router was restarted (supervisorctl restart strfry-router ran ${restarts()}x), which disconnects every stream. Stream changes must be applied by an in-place reload (${ADR}).`);
}
function assertWrittenInPlace(seed, expectedStreams, what) {
  assert(configWrites() >= 1, `${what}: the router config must be written with fs.writeFileSync('${CONFIG_PATH}', …); no such write was seen.`);
  const bad = env.events.filter((e) => e.kind === 'fs' && REPLACING.test(e.fn.replace(/^promises\./, '')) && e.paths.some((p) => p.startsWith(CONFIG_PATH)));
  assert(bad.length === 0, `${what}: the router config must only be rewritten in place, never replaced (${bad.map((b) => b.fn).join(', ')}). A new inode silently ends strfry's reloads (${ADR} § Consequences).`);
  assert(fs.statSync(T.config).ino === seed.ino, `${what}: the config file's inode changed, so it was replaced rather than rewritten in place.`);
  const expected = router.generateConfig(expectedStreams);
  assert(readConfig() === expected, `${what}: the config file must hold generateConfig(<the saved streams>).\n        expected: ${JSON.stringify(expected)}\n        actual:   ${JSON.stringify(readConfig())}`);
}
function assertWriteBeforeRestart(what) {
  const iw = env.events.findIndex(isConfigWrite);
  const ir = env.events.findIndex((e) => e.kind === 'exec' && /supervisorctl\s+restart\s+strfry-router/.test(e.cmd));
  assert(iw !== -1 && ir !== -1 && iw < ir, `${what}: the new config must be written before the router is restarted, so the restarted router loads it (write #${iw}, restart #${ir}).`);
}
// The restart must come after the LAST config write (the rollback), so it loads the previous config.
function assertRollbackBeforeRestart(what) {
  const writes = env.events.map((e, i) => (isConfigWrite(e) ? i : -1)).filter((i) => i !== -1);
  const ir = env.events.findIndex((e) => e.kind === 'exec' && /supervisorctl\s+restart\s+strfry-router/.test(e.cmd));
  assert(writes.length >= 2 && ir !== -1 && writes[writes.length - 1] < ir, `${what}: the rollback (the last config write) must come before the restart, so the restarted router loads the previous config (writes ${JSON.stringify(writes)}, restart #${ir}).`);
}
function streamBlock(config, name) {
  const start = config.indexOf(`\n    ${name} {\n`);
  if (start === -1) return null;
  const end = config.indexOf('\n    }\n', start);
  return config.slice(start, end + '\n    }\n'.length);
}

// The three mutations (AC-1, AC-2) with the outcome each is expected to produce.
const MUTATIONS = [
  {
    fn: 'handleToggleStream', label: 'toggling a stream off',
    body: () => ({ name: 'beta', enabled: false }),
    next: () => withEnabled(BASE_STATE, 'beta', false).streams,
    reloaded: (m) => eq(m, 'Stream "beta" disabled.', 'the toggle keeps its message, with no restart wording, when the router reloaded'),
    restarted: (m) => assert(typeof m === 'string' && m.startsWith('Stream "beta" disabled') && m.includes(RESTART_CLAUSE),
      `the toggle message must keep 'Stream "beta" disabled' and append "${RESTART_CLAUSE}"; got ${JSON.stringify(m)}`),
  },
  {
    fn: 'handleUpdateRouterConfig', label: 'saving streams (add, edit, delete)',
    body: () => ({ streams: clone(EDITED_STREAMS) }),
    next: () => EDITED_STREAMS,
    reloaded: (m) => eq(m, 'Router config updated.', 'a save the router reloaded reports "Router config updated." with no restart wording'),
    restarted: (m) => eq(m, `Router config updated; the router ${RESTART_CLAUSE}.`, 'a save that fell back to a restart says so'),
  },
  {
    fn: 'handleRestoreDefaults', label: 'Restore Defaults',
    body: () => ({}),
    next: () => PRESET_STREAMS,
    reloaded: (m) => eq(m, `${PRESET_MESSAGE}.`, 'Restore Defaults keeps its message, with no restart wording, when the router reloaded'),
    restarted: (m) => assert(typeof m === 'string' && m.startsWith(PRESET_MESSAGE) && m.includes(RESTART_CLAUSE),
      `Restore Defaults must keep "${PRESET_MESSAGE}" and append "${RESTART_CLAUSE}"; got ${JSON.stringify(m)}`),
  },
];

const tests = [];

// ═══ C: classifyReloadLog (the pure reading of strfry's log) ═══════════════════════════
function classify(text) { return needFn(needRouter(), 'classifyReloadLog', 'routerConfig.js')(text); }
function assertClass(r, loaded, what) {
  assert(r && typeof r === 'object', `${what}: classifyReloadLog must return { loaded, error }; got ${JSON.stringify(r)}`);
  assert(r.loaded === loaded, `${what}: expected loaded=${loaded}; got ${JSON.stringify(r)}`);
}

tests.push(['C1: classifyReloadLog — a Loading line with no failure after it means the router took the change up', () => {
  const r = classify(LOADING + NOISE);
  assertClass(r, true, 'Loading only');
  assert(r.error === null, `a clean reload must carry error: null; got ${JSON.stringify(r)}`);
}]);

tests.push(['C2: classifyReloadLog — a "Failed to parse router config" line after the Loading line means the router rejected the change, and carries strfry\'s reason', () => {
  const r = classify(LOADING + FAILED(REASON));
  assertClass(r, true, 'Loading then Failed');
  assert(typeof r.error === 'string' && r.error.includes(REASON), `error must carry strfry's reason "${REASON}"; got ${JSON.stringify(r)}`);
}]);

tests.push(['C3: classifyReloadLog — no Loading line (empty log, unrelated lines, or a lone Failed line) means the router has not reacted yet', () => {
  for (const [what, text] of [['empty text', ''], ['unrelated lines', NOISE + NOISE], ['a Failed line with no Loading line', FAILED(REASON)]]) {
    const r = classify(text);
    assertClass(r, false, what);
    assert(r.error === null, `${what}: with no Loading line the error must be null; got ${JSON.stringify(r)}`);
  }
}]);

tests.push(['C4: classifyReloadLog — a rejection logged BEFORE the Loading line belongs to an older edit and does not count', () => {
  const r = classify(FAILED(STALE_REASON) + LOADING + NOISE);
  assertClass(r, true, 'old Failed, then Loading');
  assert(r.error === null, `a Failed line before the Loading line must be ignored; got ${JSON.stringify(r)}`);
}]);

tests.push(['C5: classifyReloadLog — a later Loading line bounds the search: a failure after it belongs to the later reload, a failure before it to this one', () => {
  const after = classify(LOADING + LOADING + FAILED(REASON));
  assertClass(after, true, 'Loading, Loading, Failed');
  assert(after.error === null, `a Failed line after a SECOND Loading line belongs to that later reload; got ${JSON.stringify(after)}`);
  const between = classify(LOADING + FAILED(REASON) + LOADING);
  assertClass(between, true, 'Loading, Failed, Loading');
  assert(typeof between.error === 'string' && between.error.includes(REASON), `a Failed line between the first and a later Loading line is this reload's rejection; got ${JSON.stringify(between)}`);
}]);

// ═══ L: readLogSince (reading the log from the pre-write offset) ═══════════════════════
function readSince(p, offset) {
  const r = needFn(needRouter(), 'readLogSince', 'routerConfig.js')(p, offset);
  return r && typeof r === 'object' ? { text: r.text, size: r.size } : r; // compare only the two pinned fields
}

tests.push(['L1: readLogSince — returns only the text written after the given byte offset, and the file\'s current size', () => {
  const f = path.join(TMP, 'l1.log');
  REAL.writeFileSync(f, 'AAAA\nBBBB\n');
  eq(readSince(f, 5), { text: 'BBBB\n', size: 10 }, 'from offset 5');
  eq(readSince(f, 0), { text: 'AAAA\nBBBB\n', size: 10 }, 'from offset 0');
  eq(readSince(f, 10), { text: '', size: 10 }, 'from the end');
}]);

tests.push(['L2: readLogSince — reads from the start when the log shrank below the offset (supervisord rotated it)', () => {
  const f = path.join(TMP, 'l2.log');
  REAL.writeFileSync(f, 'NEWLINE\n');
  eq(readSince(f, 400), { text: 'NEWLINE\n', size: 8 }, 'a log smaller than the offset is read from 0');
}]);

tests.push(['L3: readLogSince — a missing log returns empty text and size 0, never throws', () => {
  let r;
  try { r = readSince(path.join(TMP, 'does-not-exist.log'), 120); } catch (e) {
    if (/not implemented yet/.test(e.message)) throw e;
    throw new Error(`readLogSince must never throw on a missing log; it threw: ${e.message}`);
  }
  eq(r, { text: '', size: 0 }, 'a missing log');
}]);

tests.push(['L4: readLogSince — an unreadable log (here a directory) returns empty text and size 0, never throws', () => {
  const d = path.join(TMP, 'a-directory.log');
  fs.mkdirSync(d, { recursive: true });
  let r;
  try { r = readSince(d, 0); } catch (e) {
    if (/not implemented yet/.test(e.message)) throw e;
    throw new Error(`readLogSince must never throw on an unreadable log; it threw: ${e.message}`);
  }
  eq(r, { text: '', size: 0 }, 'an unreadable log');
}]);

tests.push(['L5: readLogSince marks a failed read (ok: false), so a caller can keep its read position; a good read is not marked failed (Amendment 1)', () => {
  const readRaw = needFn(needRouter(), 'readLogSince', 'routerConfig.js'); // readSince() strips to text + size
  const missing = readRaw(path.join(TMP, 'does-not-exist-either.log'), 7);
  assert(missing.ok === false, `a failed read must carry ok: false; got ${JSON.stringify(missing)}`);
  const f = path.join(TMP, 'good.log');
  fs.writeFileSync(f, 'abc');
  const good = readRaw(f, 0);
  assert(good.ok !== false && good.text === 'abc' && good.size === 3, `a good read must return its text and size and not be marked failed; got ${JSON.stringify(good)}`);
}]);

// ═══ P: router process status (the branch applyConfig takes) ═══════════════════════════
tests.push(['P1: getRouterProcessStatus is exported from routerStatus.js and reads supervisorctl\'s RUNNING line with its uptime, and STOPPED', async () => {
  needRouter();
  const get = needFn(routerStatus, 'getRouterProcessStatus', 'routerStatus.js');
  freshEnv({ status: 'RUNNING' });
  const running = await get();
  assert(running && running.status === 'running' && running.uptime === '0:42:17', `RUNNING must resolve { status: 'running', uptime: '0:42:17' }; got ${JSON.stringify(running)}`);
  env.status = 'STOPPED';
  const stopped = await get();
  assert(stopped && stopped.status === 'stopped', `STOPPED must resolve { status: 'stopped' }; got ${JSON.stringify(stopped)}`);
}]);

// ═══ H: the reload path (AC-1, AC-2) ═══════════════════════════════════════════════════
tests.push(['H1: toggling one stream off while the router runs — no restart, config rewritten in place, the untouched stream\'s block byte-identical, success with applied "reloaded" (AC-1)', async () => {
  const seed = freshEnv();
  const res = await call('handleToggleStream', { name: 'beta', enabled: false });
  assert(okStatus(res) && res.body.success === true, `expected success; got ${res.statusCode} ${JSON.stringify(res.body)}`);
  assertNoRestart('toggle off');
  eq(res.body.applied, 'reloaded', 'the response must say the change was applied by reload');
  MUTATIONS[0].reloaded(res.body.message);
  assertWrittenInPlace(seed, withEnabled(BASE_STATE, 'beta', false).streams, 'toggle off');
  eq(readState().streams.map((s) => [s.name, s.enabled]), [['alpha', true], ['beta', false], ['gamma', false]], 'the state file records beta as off and nothing else changed');
  const before = streamBlock(seed.config, 'alpha');
  assert(before && before === streamBlock(readConfig(), 'alpha'), 'alpha\'s block must be byte-identical after the toggle, so strfry keeps its sockets (it reconnects a stream only when its dir or filter changed).');
}]);

tests.push(['H2: toggling a stream on while the router runs — no restart, the stream is added to the config in place, "Stream "gamma" enabled." (AC-1)', async () => {
  const seed = freshEnv();
  const res = await call('handleToggleStream', { name: 'gamma', enabled: true });
  assert(okStatus(res) && res.body.success === true, `expected success; got ${res.statusCode} ${JSON.stringify(res.body)}`);
  assertNoRestart('toggle on');
  eq(res.body.applied, 'reloaded', 'the response must say the change was applied by reload');
  eq(res.body.message, 'Stream "gamma" enabled.', 'the toggle keeps its message with no restart wording');
  assertWrittenInPlace(seed, withEnabled(BASE_STATE, 'gamma', true).streams, 'toggle on');
}]);

tests.push(['H3: saving streams (keep one, edit one, delete one, add one) while the router runs — no restart, config in place matches the saved streams, "Router config updated." with applied "reloaded" (AC-2)', async () => {
  const seed = freshEnv();
  const res = await call('handleUpdateRouterConfig', { streams: clone(EDITED_STREAMS) });
  assert(okStatus(res) && res.body.success === true, `expected success; got ${res.statusCode} ${JSON.stringify(res.body)}`);
  assertNoRestart('save');
  eq(res.body.applied, 'reloaded', 'the response must say the change was applied by reload');
  MUTATIONS[1].reloaded(res.body.message);
  assertWrittenInPlace(seed, EDITED_STREAMS, 'save');
  eq(readState().streams.map((s) => s.name), ['alpha', 'beta', 'delta'], 'the state file holds the saved streams');
}]);

tests.push(['H4: Restore Defaults while the router runs — no restart, config in place matches the presets, the message keeps its "Restored N preset stream(s)" form with no restart wording (AC-2)', async () => {
  const seed = freshEnv();
  const res = await call('handleRestoreDefaults', {});
  assert(okStatus(res) && res.body.success === true, `expected success; got ${res.statusCode} ${JSON.stringify(res.body)}`);
  assertNoRestart('Restore Defaults');
  eq(res.body.applied, 'reloaded', 'the response must say the change was applied by reload');
  MUTATIONS[2].reloaded(res.body.message);
  assertWrittenInPlace(seed, PRESET_STREAMS, 'Restore Defaults');
  eq(readState().streams.map((s) => s.name), PRESET_LIST.map((p) => p.name), 'the state file holds the presets');
}]);

tests.push(['X1: the log rotating between the config write and the Loading line still confirms the reload, with no restart (AC-1)', async () => {
  const seed = freshEnv({ plan: ['rotate-reload'] });
  const res = await call('handleToggleStream', { name: 'beta', enabled: false });
  assert(okStatus(res) && res.body.success === true, `expected success; got ${res.statusCode} ${JSON.stringify(res.body)}`);
  assertNoRestart('toggle with a log rotation');
  eq(res.body.applied, 'reloaded', 'a Loading line in the rotated log confirms the reload');
  assertWrittenInPlace(seed, withEnabled(BASE_STATE, 'beta', false).streams, 'toggle with a log rotation');
}]);

// ═══ J: the router rejects the change (AC-3) ═══════════════════════════════════════════
for (const m of MUTATIONS) {
  tests.push([`J: ${m.label} that strfry rejects — HTTP 500 naming strfry's reason and saying the previous streams still run; state file and config rolled back in place; no restart (AC-3)`, async () => {
    const seed = freshEnv({ plan: ['reject'] });
    const res = await call(m.fn, m.body());
    assert(res.statusCode === 500, `expected HTTP 500 for a change the router rejected; got ${res.statusCode} ${JSON.stringify(res.body)}. Success must never be reported for a change that did not take effect (AC-3).`);
    assert(res.body.success === false, `expected success: false; got ${JSON.stringify(res.body)}`);
    const e = String(res.body.error || '');
    assert(e.includes(REJECTED_HEAD) && e.includes(REASON), `the error must say "${REJECTED_HEAD} (<strfry's reason>)" and carry "${REASON}"; got ${JSON.stringify(e)}`);
    assert(e.includes(REJECTED_TAIL), `the error must say "${REJECTED_TAIL}"; got ${JSON.stringify(e)}`);
    assert(!e.includes(STALE_REASON), 'the error must carry THIS change\'s rejection, not an older one already in the log.');
    assertNoRestart(`rejected ${m.label}`);
    assert(configWrites() >= 2, `the new config must be written, then the previous config written back (rollback); saw ${configWrites()} config write(s).`);
    assertWrittenInPlace(seed, BASE_STATE.streams, `rollback after a rejected ${m.label}`);
    eq(readState(), BASE_STATE, 'the state file must be rolled back to the previous streams, so the tab, the state file and the running router agree');
  }]);
}

tests.push(['J4: a rejection logged a moment after the Loading line is still caught (the settle window), not reported as success (AC-3)', async () => {
  freshEnv({ plan: ['reject-late'] });
  const res = await call('handleToggleStream', { name: 'beta', enabled: false });
  assert(res.statusCode === 500 && res.body.success === false, `a Failed line arriving 100 ms after the Loading line must still be reported as a rejection; got ${res.statusCode} ${JSON.stringify(res.body)}`);
  assert(String(res.body.error || '').includes(REASON), `the error must carry "${REASON}"; got ${JSON.stringify(res.body.error)}`);
  assertNoRestart('late rejection');
  eq(readState(), BASE_STATE, 'the state file must be rolled back');
}]);

// ═══ T: no reload logged within the timeout → restart, and say so ═════════════════════
for (const m of MUTATIONS) {
  tests.push([`T: ${m.label} when the router never logs a reload (an older Loading line in the log doesn't count) — restarted as before, applied "restarted", and the message says the router "${RESTART_CLAUSE}"`, async () => {
    const seed = freshEnv({ fallback: 'silent' });
    const res = await dilated(() => call(m.fn, m.body()));
    assert(okStatus(res) && res.body.success === true, `expected success after the fallback restart; got ${res.statusCode} ${JSON.stringify(res.body)}`);
    eq(res.body.applied, 'restarted', 'the response must say the change was applied by restart');
    m.restarted(res.body.message);
    assert(restarts() === 1, `the router must be restarted exactly once as the fallback; saw ${restarts()} restart(s).`);
    assertWriteBeforeRestart(`${m.label} fallback`);
    assertWrittenInPlace(seed, m.next(), `${m.label} fallback`);
  }]);
}

tests.push(['T4: a missing router log ends in the restart fallback, never a silent success or a crash', async () => {
  const seed = freshEnv({ log: null, fallback: 'silent' });
  const res = await dilated(() => call('handleToggleStream', { name: 'beta', enabled: false }));
  assert(okStatus(res) && res.body.success === true, `expected success after the fallback restart; got ${res.statusCode} ${JSON.stringify(res.body)}`);
  eq(res.body.applied, 'restarted', 'with no readable log the change is applied by restart');
  assert(restarts() === 1, `the router must be restarted exactly once; saw ${restarts()}.`);
  assertWrittenInPlace(seed, withEnabled(BASE_STATE, 'beta', false).streams, 'missing-log fallback');
}]);

// ═══ N: router not running → today's write + restart, straight away ═══════════════════
for (const status of ['STOPPED', 'FATAL']) {
  tests.push([`N: router ${status} — the config is written and the router restarted straight away (no wait on the log), applied "restarted"`, async () => {
    const seed = freshEnv({ status, fallback: 'silent' });
    const t0 = Date.now();
    const res = await call('handleToggleStream', { name: 'beta', enabled: false });
    const ms = Date.now() - t0;
    assert(okStatus(res) && res.body.success === true, `expected success; got ${res.statusCode} ${JSON.stringify(res.body)}`);
    eq(res.body.applied, 'restarted', 'a router that is not running is started by the restart');
    assert(restarts() === 1, `the router must be restarted exactly once; saw ${restarts()}.`);
    assertWriteBeforeRestart(`${status} router`);
    assertWrittenInPlace(seed, withEnabled(BASE_STATE, 'beta', false).streams, `${status} router`);
    assert(ms < 2000, `a router that is not running must not wait for a reload in the log (took ${ms} ms).`);
  }]);
}

// ═══ Q: one router mutation at a time ═════════════════════════════════════════════════
tests.push(['Q1: two overlapping toggles of different streams both persist — neither update is lost, and both are confirmed by reload', async () => {
  freshEnv();
  const [r1, r2] = await Promise.all([
    call('handleToggleStream', { name: 'alpha', enabled: false }),
    call('handleToggleStream', { name: 'beta', enabled: false }),
  ]);
  for (const [r, n] of [[r1, 'alpha'], [r2, 'beta']]) {
    assert(okStatus(r) && r.body.success === true && r.body.applied === 'reloaded', `the ${n} toggle must succeed by reload; got ${r.statusCode} ${JSON.stringify(r.body)}`);
  }
  assertNoRestart('overlapping toggles');
  const final = withEnabled(withEnabled(BASE_STATE, 'alpha', false), 'beta', false);
  eq(readState(), final, 'both toggles must be in the state file');
  eq(readConfig(), router.generateConfig(final.streams), 'the config must reflect both toggles');
}]);

tests.push(['Q2: a rejected toggle\'s rollback does not undo an overlapping toggle of another stream (mutations are serialized)', async () => {
  freshEnv({ plan: ['reject'] }); // the first config write is rejected; every later one reloads
  const [r1, r2] = await Promise.all([
    call('handleToggleStream', { name: 'alpha', enabled: false }),
    call('handleToggleStream', { name: 'beta', enabled: false }),
  ]);
  assert(r1.statusCode === 500 && r1.body.success === false, `the first toggle's config was rejected, so it must report HTTP 500; got ${r1.statusCode} ${JSON.stringify(r1.body)}`);
  assert(okStatus(r2) && r2.body.success === true && r2.body.applied === 'reloaded', `the second toggle runs after the first one's rollback and must succeed by reload; got ${r2.statusCode} ${JSON.stringify(r2.body)}`);
  assertNoRestart('serialized toggles');
  const final = withEnabled(BASE_STATE, 'beta', false);
  eq(readState(), final, 'alpha is rolled back to on, and beta\'s change survives');
  eq(readConfig(), router.generateConfig(final.streams), 'the config matches the state file');
}]);

// ═══ K: the rollback is confirmed before the next change runs (ADR 0001 Amendment 1) ══
tests.push(['K1: a change queued behind a rejected one is judged on its own reload — A rejected, B queued and also rejected → both HTTP 500, nothing changed, no restart (review 1, blocking 1)', async () => {
  // Writes, in order: A's config (rejected), A's rollback (reloads), B's config (rejected), B's rollback (reloads).
  freshEnv({ plan: ['reject', 'reload', 'reject', 'reload'] });
  const [ra, rb] = await Promise.all([
    call('handleToggleStream', { name: 'alpha', enabled: false }),
    call('handleToggleStream', { name: 'beta', enabled: false }),
  ]);
  for (const [r, n] of [[ra, 'A (alpha)'], [rb, 'B (beta)']]) {
    assert(r.statusCode === 500 && r.body.success === false, `${n}'s config was rejected, so it must report HTTP 500 — never take the previous rollback's reload as its own confirmation; got ${r.statusCode} ${JSON.stringify(r.body)}`);
    const e = String(r.body.error || '');
    assert(e.includes(REJECTED_HEAD) && e.includes(REASON) && e.includes(REJECTED_TAIL), `${n}'s error must name strfry's reason and say the previous streams still run; got ${JSON.stringify(e)}`);
  }
  assertNoRestart('two rejected toggles');
  eq(readState(), BASE_STATE, 'both toggles are rolled back');
  eq(readConfig(), router.generateConfig(BASE_STATE.streams), 'the config is the previous one');
}]);

for (const [label, plan] of [['is never logged', ['reject', 'silent']], ['is itself rejected', ['reject', 'reject']]]) {
  tests.push([`K: when the rollback's reload ${label}, the router is restarted on the previous config and the 500 says so (Amendment 1)`, async () => {
    const seed = freshEnv({ plan });
    const res = await dilated(() => call('handleToggleStream', { name: 'beta', enabled: false }));
    assert(res.statusCode === 500 && res.body.success === false, `the change was rejected, so HTTP 500; got ${res.statusCode} ${JSON.stringify(res.body)}`);
    const e = String(res.body.error || '');
    assert(e.includes(REJECTED_HEAD) && e.includes(REASON), `the error must name strfry's reason; got ${JSON.stringify(e)}`);
    assert(e.includes(ROLLBACK_RESTARTED_TAIL), `the error must say "${ROLLBACK_RESTARTED_TAIL}"; got ${JSON.stringify(e)}`);
    assert(!e.includes(REJECTED_TAIL), 'the error must not claim the router kept running the previous streams by itself when it had to be restarted.');
    assert(restarts() === 1, `the router must be restarted exactly once to load the previous config; saw ${restarts()}.`);
    assertRollbackBeforeRestart(`rollback whose reload ${label}`);
    assertWrittenInPlace(seed, BASE_STATE.streams, `rollback whose reload ${label}`);
    eq(readState(), BASE_STATE, 'the state file is rolled back');
  }]);
}

tests.push(['K3: when the restart after an unconfirmed rollback fails, the 500 says so and points at Restart — and the next change still runs (the lock is released) (Amendment 1, review round 2 R2-5)', async () => {
  freshEnv({ plan: ['reject', 'silent'] });
  env.failRestart = true;
  const res = await dilated(() => call('handleToggleStream', { name: 'beta', enabled: false }));
  assert(res.statusCode === 500 && res.body.success === false, `expected HTTP 500; got ${res.statusCode} ${JSON.stringify(res.body)}`);
  const e = String(res.body.error || '');
  assert(e.includes(REJECTED_HEAD) && e.includes(REASON) && e.includes('restarting it to put the previous streams back failed') && e.includes('Press Restart'), `the error must name the rejection and the failed restart, and point at Restart; got ${JSON.stringify(e)}`);
  assert(restarts() === 1, `one restart was attempted; saw ${restarts()}.`);
  eq(readState(), BASE_STATE, 'the state file is rolled back');
  env.failRestart = false;
  const next = await call('handleToggleStream', { name: 'alpha', enabled: false });
  assert(okStatus(next) && next.body.success === true && next.body.applied === 'reloaded', `the next change must run (the lock is not left held); got ${next.statusCode} ${JSON.stringify(next.body)}`);
}]);

tests.push(['W1: a transient failure reading the log keeps the read position — an old rejection earlier in the log is not mistaken for this change\'s (Amendment 1, review 1 non-blocking 2)', async () => {
  freshEnv({ plan: ['read-error-reload'] }); // the stale log holds an old Loading + Failed pair before the offset
  const res = await call('handleToggleStream', { name: 'beta', enabled: false });
  assert(okStatus(res) && res.body.success === true, `the reload was logged, so the toggle must succeed; got ${res.statusCode} ${JSON.stringify(res.body)}`);
  eq(res.body.applied, 'reloaded', 'applied by reload');
  assert(env.events.some((ev) => ev.failed), 'the injected log-read failure must have happened (test self-check).');
  assertNoRestart('transient log-read failure');
}]);

// ═══ G: guards, behavior the ADR keeps unchanged (pass before and after) ══════════════
tests.push(['G1: the Restart button still restarts the router — handleRestartRouter runs supervisorctl restart strfry-router (AC-4)', async () => {
  freshEnv();
  const res = await call('handleRestartRouter', {});
  assert(okStatus(res) && res.body.success === true, `expected success; got ${res.statusCode} ${JSON.stringify(res.body)}`);
  assert(restarts() === 1, `the Restart button must run supervisorctl restart strfry-router once; saw ${restarts()}.`);
}]);

tests.push(['G2: initRouter (deploy / container start) still writes the saved streams to the config in place and does not restart the router (AC-5)', async () => {
  const seed = freshEnv({ state: withEnabled(BASE_STATE, 'gamma', true) });
  REAL.writeFileSync(T.config, 'connectionTimeout = 20\n\nstreams {\n}\n'); // the entrypoint's empty fallback, same inode
  await needFn(needRouter(), 'initRouter', 'routerConfig.js')();
  assertNoRestart('initRouter');
  assertWrittenInPlace(seed, withEnabled(BASE_STATE, 'gamma', true).streams, 'initRouter');
}]);

tests.push(['G3: GET /api/strfry/router-status answers as before — process status with uptime, config and state paths, and the saved streams', async () => {
  freshEnv();
  const handler = needFn(routerStatus, 'handleRouterStatus', 'routerStatus.js');
  const res = mkRes();
  await handler({ session: {}, query: {} }, res);
  assert(okStatus(res) && res.body && res.body.success === true, `expected success; got ${res.statusCode} ${JSON.stringify(res.body)}`);
  eq(res.body.router, { process: { status: 'running', uptime: '0:42:17' }, configPath: CONFIG_PATH, statePath: STATE_PATH, streams: BASE_STATE.streams }, 'the router-status response must be unchanged');
}]);

tests.push(['G4: PR #787\'s skipped reporting survives on the reload path — an invalid saved stream is left out and listed, and the change is still applied by reload', async () => {
  const BAD = { name: 'delta', description: 'invalid saved url', dir: 'down', filter: { kinds: [1] }, urls: ['https://not-a-relay.example'], pluginDown: '', pluginUp: '', enabled: true };
  freshEnv({ state: { streams: [...BASE_STATE.streams, BAD] } });
  const res = await call('handleToggleStream', { name: 'beta', enabled: false });
  assert(okStatus(res) && res.body.success === true, `expected success; got ${res.statusCode} ${JSON.stringify(res.body)}`);
  eq(res.body.applied, 'reloaded', 'applied by reload');
  const names = (res.body.skipped || []).map((x) => x && x.name);
  assert(names.includes('delta'), `the invalid saved stream must be listed under skipped; got ${JSON.stringify(res.body.skipped)}`);
  assert(!/delta \{/.test(readConfig()), 'the invalid stream must be left out of the config');
  assertNoRestart('reload with a skipped stream');
}]);

// ═══ U / D / S: wording and source sentinels ══════════════════════════════════════════
tests.push(['U1: the Router Management tab no longer warns that deleting a stream restarts the router, and no stream-change confirmation mentions a restart (AC-4)', () => {
  const src = fs.readFileSync(RELAY_SETTINGS, 'utf8');
  const start = src.indexOf('function RouterStatus(');
  assert(start !== -1, 'RouterStatus is missing from RelaySettings.jsx; unexpected.');
  const end = src.indexOf('\nfunction ', start);
  const region = src.slice(start, end === -1 ? src.length : end);
  assert(!src.includes('This will restart the router'), 'RelaySettings.jsx still says "This will restart the router." Stream changes no longer restart it (AC-4).');
  assert(/confirm\(\s*`Delete stream "\$\{name\}"\?`\s*\)/.test(region), 'the delete confirmation must read `Delete stream "${name}"?` (ADR § Implementation notes).');
  const confirms = region.match(/confirm\(\s*(`[^`]*`|'[^']*'|"[^"]*")/g) || [];
  const restarting = confirms.filter((c) => /restart/i.test(c));
  assert(restarting.length === 0, `no stream-change confirmation may mention a restart: ${restarting.join(' | ')}`);
}]);

tests.push(['D1: BIBLE §14 says stream changes rewrite the router config in place and reload it, reconnecting only changed streams, and that only the Restart button restarts the router', () => {
  const src = fs.readFileSync(BIBLE, 'utf8');
  const start = src.indexOf('#### Presets are opt-in cross-instance mirroring');
  assert(start !== -1, 'BIBLE §14 "Presets are opt-in cross-instance mirroring" is missing; unexpected.');
  const end = src.indexOf('| Preset |', start);
  const para = src.slice(start, end === -1 ? start + 2000 : end);
  assert(para.includes('Toggle via'), 'the "Toggle via …" sentence must remain.');
  for (const [re, what] of [[/in place/i, '"in place"'], [/reload/i, 'that the router reloads the config'], [/reconnect/i, 'that only changed streams reconnect'], [/Restart button/i, 'the Restart button'], [/\bonly\b/i, '"only"'], [/fallback/i, 'the fallback restart (Amendment 1)']]) {
    assert(re.test(para), `BIBLE §14 must gain the ADR's sentence; it doesn't mention ${what} (${ADR} § Implementation notes).`);
  }
}]);

tests.push(['D2: docs/CONFIGURATION.md no longer says stream changes restart the router — they rewrite the config in place and strfry reloads it, with a restart only as a fallback (Amendment 1, review 1 blocking 2)', () => {
  const src = fs.readFileSync(CONFIGURATION_DOC, 'utf8');
  assert(!/toggling enabled\/disabled rewrites the daemon config and restarts/i.test(src), 'CONFIGURATION.md still says toggling restarts strfry-router.');
  assert(!/the router restarts as usual/i.test(src), 'CONFIGURATION.md still says "the router restarts as usual".');
  const start = src.indexOf('The Router Management tab at `/tapestry/settings/relays`');
  assert(start !== -1, 'the Router Management paragraph is missing; unexpected.');
  const para = src.slice(start, src.indexOf('\n\n', start));
  for (const [re, what] of [[/in place/i, '"in place"'], [/reload/i, 'the reload'], [/fallback/i, 'the fallback restart'], [/Restart/, 'the Restart button']]) {
    assert(re.test(para), `the Router Management paragraph must mention ${what}.`);
  }
}]);

tests.push(['S1: routerConfig.js pins the strfry 1.1.0 log strings and the router stderr log path, with a comment naming strfry 1.1.0 (a strfry bump must re-verify them)', () => {
  const src = fs.readFileSync(ROUTER, 'utf8');
  for (const s of [LOG_PATH, 'Loading router config file', 'Failed to parse router config']) {
    assert(src.includes(s), NOT_IMPL(`routerConfig.js must define the constant "${s}"`));
  }
  assert(/strfry 1\.1\.0/.test(src), NOT_IMPL('routerConfig.js must carry a comment naming strfry 1.1.0 next to the log constants'));
}]);

// ── runner ──────────────────────────────────────────────────────────────────────────────
async function run() {
  console.log('\n--- router config reload-in-place tests (relay-stream-gaps #1) ---');
  let pass = 0;
  let fail = 0;
  const skipped = 0;
  const failures = [];
  const savedCp = { exec: cp.exec, execFile: cp.execFile };
  REAL = { writeFileSync: fs.writeFileSync, appendFileSync: fs.appendFileSync, unlinkSync: fs.unlinkSync };
  TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'router-reload-in-place-'));
  Object.assign(T, { config: target(CONFIG_PATH), state: target(STATE_PATH), log: target(LOG_PATH) });
  let restoreFs = null;
  try {
    cp.exec = fakeExec;
    cp.execFile = fakeExecFile;
    clock.install();
    restoreFs = installFsRedirect();
    loadModules();
    for (const [name, fn] of tests) {
      try {
        await fn();
        console.log(`  PASS  ${name}`);
        pass++;
      } catch (err) {
        console.log(`  FAIL  ${name}\n        ${err.message}`);
        failures.push({ name, message: err.message });
        fail++;
      } finally {
        clock.normal();
      }
    }
  } finally {
    strfry.generation++;
    await sleep(200); // let any fake-strfry append still in flight see the new generation and drop
    clock.uninstall();
    if (restoreFs) restoreFs();
    cp.exec = savedCp.exec;
    cp.execFile = savedCp.execFile;
    delete require.cache[require.resolve(ROUTER)];
    delete require.cache[require.resolve(ROUTER_STATUS)];
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* best effort */ }
  }
  console.log(`\nrouter-config-reload-in-place: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped, failures };
}

if (require.main === module) {
  run().then(({ fail }) => { process.exitCode = fail === 0 ? 0 : 1; }).catch((e) => { console.error(e); process.exitCode = 1; });
}

module.exports = { run };
