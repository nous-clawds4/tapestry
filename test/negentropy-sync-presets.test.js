'use strict';
/**
 * Story relay-stream-gaps #3: saved negentropy-sync presets, run on a schedule.
 * ADR relay-stream-gaps/0003 (Accepted): a presets file plus a control-panel runner
 * (src/api/strfry/negentropyPresets.js), triggered by one registry task
 * (syncNegentropyPresets → src/manage/negentropySync/syncPresets.sh), sharing the one-shot
 * sync's single slot (src/api/strfry/negentropySync.js).
 * Test plan: engineering-team/stories/relay-stream-gaps/3-scheduled-negentropy-sync-presets.test-plan.md
 *
 * Stack-free: no strfry, control panel, Docker or network. The seams, all installed inside run()
 * and removed when it ends, so no other suite sees them:
 *   - child_process.spawn is replaced BEFORE negentropySync.js and negentropyPresets.js are
 *     freshly required (negentropySync.js destructures spawn at require time). The fake strfry
 *     answers each `strfry sync <relay> …` with stderr shaped like strfry 1.1.0's (ADR § Verified
 *     evidence, loguru prefix included) and an exit code, after a few ms, or holds until the test
 *     releases it, or until it is killed. Every test uses its own relay host names
 *     (wss://t<n>-<name>.example), so a straggler from an earlier test is never counted.
 *   - NEGENTROPY_PRESETS_PATH (the ADR's env override) points each test at its own temp file, and
 *     the modules are re-required per test: a re-require is also how a test "restarts" the server.
 *   - src/middleware/auth.js is a stub while the suite runs: isOwner(req) is true only for a
 *     signed-in session with the test's owner pubkey. Loopback callers are { localTrusted: true }.
 *   - Time is dilated (setTimeout/setInterval, Date.now, performance.now,
 *     timers/promises.setTimeout) for the 10-minute waits only, so they cost about a second.
 *     Speed only: an implementation that waits some other way still passes, slower.
 *   - The task script runs under real bash against a stub HTTP server on 127.0.0.1, with a test
 *     double for src/utils/structuredLogging.sh that records emit_task_event calls.
 *
 * Before the implementation every test fails on a missing module, export, route, file or a
 * contract assertion (never a load error of this suite), except the G* guards, which pin behavior
 * the ADR keeps unchanged and pass before and after.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const util = require('util');
const http = require('http');
const crypto = require('crypto');
const Module = require('module');
const cp = require('child_process');
const { EventEmitter } = require('events');

const ROOT = path.resolve(__dirname, '..');
const SYNC = path.join(ROOT, 'src/api/strfry/negentropySync.js');
const PRESETS_MOD = path.join(ROOT, 'src/api/strfry/negentropyPresets.js');
const ROUTER = path.join(ROOT, 'src/api/strfry/routerConfig.js');
const ROUTER_STATUS = path.join(ROOT, 'src/api/strfry/routerStatus.js');
const AUTH = path.join(ROOT, 'src/middleware/auth.js');
const SCHED_TASKS = path.join(ROOT, 'src/api/scheduled-tasks/index.js');
const SCHED_VALIDATION = path.join(ROOT, 'src/api/scheduled-tasks/validation.js');
const REGISTRY_PATH = path.join(ROOT, 'src/manage/taskQueue/taskRegistry.json');
const SCRIPT = path.join(ROOT, 'src/manage/negentropySync/syncPresets.sh');
const API_INDEX = path.join(ROOT, 'src/api/index.js');
const MODAL = path.join(ROOT, 'ui/src/pages/settings/scheduledTasks/AddOrEditEntryModal.jsx');
const RELAY_SETTINGS = path.join(ROOT, 'ui/src/pages/settings/RelaySettings.jsx');
const BIBLE = path.join(ROOT, 'BIBLE.md');
const CONFIGURATION_DOC = path.join(ROOT, 'docs/CONFIGURATION.md');

const ADR = 'ADR relay-stream-gaps/0003';
const TASK = 'syncNegentropyPresets';
const FLOOR = 'A preset must narrow what it syncs: add event kinds, authors or a tag filter.';
const DEFAULT_PRESETS_PATH = '/var/lib/brainstorm/negentropy-presets.json';
const BASE = '/api/strfry/negentropy-presets';
const ONE_SHOT = '/api/strfry/negentropy-sync';
const HOUR = 3600;
const WEEK = 7 * 86400;
const T0 = 1760000000; // a fixed earlier "last success" (unix seconds) for seeded presets

const OWNER_PK = 'd4'.repeat(32);
const MEMBER_PK = 'e5'.repeat(32);
const PK_A = 'a1'.repeat(32);
const PK_B = 'b2'.repeat(32);
const EV_A = 'c3'.repeat(32);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const REAL = { setTimeout: global.setTimeout, clearTimeout: global.clearTimeout, dateNow: Date.now, spawn: null };

// ── assertion helpers ───────────────────────────────────────────────────────────────────
class Skip extends Error {}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
const show = (v) => JSON.stringify(v);
function eq(actual, expected, msg) {
  assert(JSON.stringify(actual) === JSON.stringify(expected),
    `${msg}\n        expected: ${show(expected)}\n        actual:   ${show(actual)}`);
}
const NOT_IMPL = (what) => `${what}: not implemented yet (${ADR}).`;
const sleep = (ms) => new Promise((r) => REAL.setTimeout(r, ms));
const sorted = (a) => [...a].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
const zeroOrNull = (v) => v === 0 || v === null || v === undefined;
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
/** Source with whole-line comments dropped, so a comment quoting a call is not taken for it. */
function codeOnly(src) { return src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*|#)/.test(l)).join('\n'); }
function withTimeout(promise, ms, what) {
  let t;
  return Promise.race([
    promise,
    new Promise((_, reject) => { t = REAL.setTimeout(() => reject(new Error(`${what} did not finish within ${ms} ms (real time)`)), ms); }),
  ]).finally(() => REAL.clearTimeout(t));
}
async function until(cond, ms, what) {
  const end = REAL.dateNow() + ms;
  while (!cond()) {
    if (REAL.dateNow() > end) throw new Error(`timed out after ${ms} ms (real time) waiting for ${what}`);
    await sleep(5);
  }
}

// ── strfry 1.1.0 `strfry sync` stderr (ADR § Verified evidence; loguru prefix included) ──
function L(level, msg, thread = 'main thread     ') {
  return `2026-10-09 03:12:45.823 (   0.036s) [${thread}]${level.padStart(4)}| ${msg}\n`;
}
const OUT = {
  // Evidence 1: down, local empty, upstream 12.
  down12: L('INFO', 'Filter matches 0 events') + L('INFO', 'Set reconcile complete. Have 0 need 12')
    + L('INFO', 'DOWN: 12 events (0 remaining)') + L('INFO', 'Writer: added: 12 dups: 0 replaced: 0 deleted: 0', 'Writer          '),
  // Evidence 2: the same sync again, nothing to do.
  nothing: L('INFO', 'Filter matches 12 events') + L('INFO', 'Set reconcile complete. Have 0 need 0')
    + L('INFO', 'Writer: added: 0 dups: 0 replaced: 0 deleted: 0', 'Writer          '),
  // Evidence 3: up, 3 local-only events.
  up3: L('INFO', 'Filter matches 3 events') + L('INFO', 'Set reconcile complete. Have 3 need 0')
    + L('INFO', 'UP: 3 events (0 remaining)'),
  // Evidence 5 (both is strfry's default) with something each way.
  both: L('INFO', 'Filter matches 2 events') + L('INFO', 'Set reconcile complete. Have 2 need 3')
    + L('INFO', 'UP: 2 events (0 remaining)') + L('INFO', 'DOWN: 3 events (0 remaining)')
    + L('INFO', 'Writer: added: 3 dups: 0 replaced: 0 deleted: 0', 'Writer          '),
  // Evidence 6: unreachable relay, exit 1.
  unreachable: L('INFO', 'Filter matches 0 events') + L('INFO', 'Websocket connection error')
    + L('INFO', 'Writer: added: 0 dups: 0 replaced: 0 deleted: 0', 'Writer          '),
};

// ── fake strfry (child_process.spawn) ──────────────────────────────────────────────────
const fake = {
  log: [], behaviors: new Map(), tick: 0,
  reset() { this.behaviors = new Map(); },
  on(relay, b) { this.behaviors.set(relay, b); },
  releaseAll() { let n = 0; for (const e of this.log) if (!e.closed && e.release) { e.release(); n++; } return n; },
};
const DEFAULT_BEHAVIOR = { out: OUT.down12, code: 0, mode: 'auto', delayMs: 15 };
function fakeSpawn(cmd, args) {
  const argv = Array.isArray(args) ? args.slice() : [];
  const relay = argv[1];
  const b = { ...DEFAULT_BEHAVIOR, ...(fake.behaviors.get(relay) || {}) };
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin = null;
  child.pid = 41000 + fake.log.length;
  child.killed = false;
  const entry = { cmd: String(cmd), args: argv, relay, at: REAL.dateNow(), startTick: ++fake.tick, closed: false, closedAt: null, closeTick: null, killedWith: null, released: false };
  fake.log.push(entry);
  const finish = (code, signal) => {
    if (entry.closed) return;
    entry.closed = true; entry.closedAt = REAL.dateNow(); entry.closeTick = ++fake.tick;
    child.exitCode = code; child.signalCode = signal;
    child.emit('exit', code, signal);
    child.emit('close', code, signal);
  };
  entry.release = () => {
    if (entry.closed || entry.released) return;
    entry.released = true;
    REAL.setTimeout(() => {
      if (entry.closed) return;
      if (b.out) child.stderr.emit('data', Buffer.from(b.out));
      REAL.setTimeout(() => finish(b.code, null), 1);
    }, 1);
  };
  child.kill = (sig = 'SIGTERM') => {
    entry.killedWith = sig; child.killed = true;
    REAL.setTimeout(() => {
      if (!entry.closed) child.stderr.emit('data', Buffer.from(L('INFO', 'Filter matches 4 events')));
      REAL.setTimeout(() => finish(null, sig), 1);
    }, 1);
    return true;
  };
  if (b.mode === 'auto') REAL.setTimeout(entry.release, b.delayMs);
  return child;
}

// ── clock seam: dilate time for the 10-minute waits only ──────────────────────────────
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

// ── auth stub ──────────────────────────────────────────────────────────────────────────
function installAuthStub() {
  const id = require.resolve(AUTH);
  const prev = require.cache[id];
  const stub = new Module(id, module);
  stub.filename = id; stub.loaded = true;
  const isOwner = (req) => !!(req && req.session && req.session.authenticated && req.session.pubkey === OWNER_PK);
  stub.exports = { isOwner, isOwnerOrAdmin: isOwner };
  require.cache[id] = stub;
  return () => { if (prev) require.cache[id] = prev; else delete require.cache[id]; };
}

// ── module loading (one fresh load = one server start) ─────────────────────────────────
function dropModules() {
  for (const p of [PRESETS_MOD, SYNC, ROUTER, ROUTER_STATUS]) {
    try { delete require.cache[require.resolve(p)]; } catch { /* not present */ }
  }
}
function loadModules(presetsPath) {
  process.env.NEGENTROPY_PRESETS_PATH = presetsPath;
  dropModules();
  const out = { sync: null, presets: null, syncError: null, presetsError: null };
  try { out.sync = require(SYNC); } catch (e) { out.syncError = e; }
  if (fs.existsSync(PRESETS_MOD)) {
    try { out.presets = require(PRESETS_MOD); } catch (e) { out.presetsError = e; }
  }
  return out;
}

// ── fake express app + req/res ─────────────────────────────────────────────────────────
function makeApp() {
  const routes = [];
  const add = (method) => (p, ...handlers) => { routes.push({ method, path: p, handlers: handlers.flat() }); };
  return { routes, get: add('GET'), post: add('POST'), put: add('PUT'), delete: add('DELETE'), use() {} };
}
function mkRes() {
  let resolve;
  const done = new Promise((r) => { resolve = r; });
  const res = {
    statusCode: null, body: undefined, headersSent: false, done,
    status(c) { this.statusCode = c; return this; },
    json(o) { this.body = o; this.headersSent = true; resolve(this); return this; },
    send(o) { this.body = o; this.headersSent = true; resolve(this); return this; },
    end() { this.headersSent = true; resolve(this); return this; },
    sendStatus(c) { this.statusCode = c; this.headersSent = true; resolve(this); return this; },
    set() { return this; }, setHeader() {}, writeHead(c) { this.statusCode = c; this.headersSent = true; }, write() {}, flushHeaders() {},
  };
  return res;
}
const httpCode = (res) => (res.statusCode == null ? 200 : res.statusCode);
const WHO = {
  local: { session: {}, localTrusted: true },
  owner: { session: { authenticated: true, pubkey: OWNER_PK }, localTrusted: false },
  member: { session: { authenticated: true, pubkey: MEMBER_PK }, localTrusted: false },
  anon: { session: {}, localTrusted: false },
};

let TMP = null;
let SEQ = 0;

/** A fresh server for one test: its own presets file, relays, modules and routes. */
function harness({ presets = null } = {}) {
  const seq = ++SEQ;
  const dir = path.join(TMP, `t${seq}`);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'negentropy-presets.json');
  if (presets) fs.writeFileSync(file, JSON.stringify({ version: 1, presets }, null, 2));
  fake.reset();
  const h = {
    seq, dir, file, mods: null, app: null,
    relay: (name) => `wss://t${seq}-${name}.example`,
    preset(name, over = {}) {
      return { id: crypto.randomUUID(), name, relay: h.relay(name), dir: 'down', filter: { kinds: [39998] }, enabled: true, createdAt: T0 - 100, updatedAt: T0 - 100, ...over };
    },
    /** (Re)start the server: fresh modules over the same presets file. */
    start() {
      h.mods = loadModules(file);
      h.app = makeApp();
      if (h.mods.sync && typeof h.mods.sync.registerNegentropySyncRoutes === 'function') h.mods.sync.registerNegentropySyncRoutes(h.app);
      if (h.mods.presets && typeof h.mods.presets.registerNegentropyPresetRoutes === 'function') h.mods.presets.registerNegentropyPresetRoutes(h.app);
      return h;
    },
    presetsModule() {
      if (h.mods.presetsError) throw new Error(`src/api/strfry/negentropyPresets.js failed to load: ${h.mods.presetsError.message}`);
      assert(h.mods.presets, NOT_IMPL('src/api/strfry/negentropyPresets.js must exist'));
      assert(typeof h.mods.presets.registerNegentropyPresetRoutes === 'function', NOT_IMPL('negentropyPresets.js must export registerNegentropyPresetRoutes(app)'));
      return h.mods.presets;
    },
    syncModule() {
      if (h.mods.syncError) throw new Error(`src/api/strfry/negentropySync.js failed to load: ${h.mods.syncError.message}`);
      return h.mods.sync;
    },
    route(method, p) {
      if (p.startsWith(BASE)) h.presetsModule();
      const r = h.app.routes.find((x) => x.method === method && x.path === p);
      assert(r, NOT_IMPL(`${method} ${p} must be registered`));
      return r;
    },
    /** Start a request; returns the res (await res.done for the answer). */
    begin(method, p, body = {}, as = 'local') {
      const r = h.route(method, p);
      const res = mkRes();
      const who = WHO[as];
      const req = { method, path: p, url: p, originalUrl: p, body, query: {}, params: {}, headers: {}, session: { ...who.session }, localTrusted: who.localTrusted, ip: who.localTrusted ? '127.0.0.1' : '203.0.113.9', on() {} };
      let i = 0;
      const next = (err) => {
        if (err) { res.status(500).json({ success: false, error: String(err && err.message || err) }); return; }
        const fn = r.handlers[i++];
        if (!fn) return;
        Promise.resolve().then(() => fn(req, res, next)).catch((e) => { if (!res.headersSent) res.status(500).json({ success: false, error: `handler threw: ${e && e.message}` }); });
      };
      next();
      return res;
    },
    async req(method, p, body = {}, as = 'local', ms = 5000) {
      const res = h.begin(method, p, body, as);
      await withTimeout(res.done, ms, `${method} ${p}`);
      return res;
    },
    async list() {
      const res = await h.req('GET', BASE);
      assert(httpCode(res) === 200 && res.body && res.body.success === true && Array.isArray(res.body.presets),
        `GET ${BASE} must answer { success: true, presets: [...], running }; got ${httpCode(res)} ${show(res.body)}`);
      return res.body.presets;
    },
    async byName(name) { return (await h.list()).find((p) => p.name === name); },
    fileText() { return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null; },
    fileJson() { const t = h.fileText(); return t === null ? null : JSON.parse(t); },
    spawns() { return fake.log.filter((e) => typeof e.relay === 'string' && e.relay.startsWith(`wss://t${seq}-`)); },
    spawnsOf(name) { return h.spawns().filter((e) => e.relay === h.relay(name)); },
    async run(ms = 10000) {
      const res = await h.req('POST', `${BASE}/run`, {}, 'local', ms);
      return res;
    },
    /** A one-shot (manual) sync through the existing POST handler; it answers when strfry exits. */
    oneShot(name, as = 'local') {
      return h.begin('POST', ONE_SHOT, { relay: h.relay(name), dir: 'down', filter: { kinds: [1] } }, as);
    },
    async status() {
      const res = await h.req('GET', `${ONE_SHOT}/status`);
      return res.body;
    },
  };
  return h.start();
}
function maxOverlap(entries) {
  let max = entries.length ? 1 : 0;
  for (const e of entries) {
    const live = entries.filter((o) => o.startTick <= e.startTick && (o.closeTick === null || o.closeTick > e.startTick)).length;
    max = Math.max(max, live);
  }
  return max;
}
function filterOf(entry) {
  const i = entry.args.indexOf('--filter');
  assert(i !== -1, `strfry must be given --filter <json>; argv was ${show(entry.args)}`);
  return JSON.parse(entry.args[i + 1]);
}
function okRun(res, what) {
  assert(httpCode(res) === 200 && res.body && res.body.success === true && Array.isArray(res.body.results),
    `${what}: POST ${BASE}/run must answer 200 { success: true, results: [...], failed }; got ${httpCode(res)} ${show(res.body)}`);
  return res.body;
}

const tests = [];
function test(name, fn, opts = {}) { tests.push([name, fn, opts]); }

// ═══ V: validatePreset (pure) ═══════════════════════════════════════════════════════════
function V() {
  const h = { mods: loadModules(path.join(TMP, 'unused.json')) };
  if (h.mods.presetsError) throw new Error(`src/api/strfry/negentropyPresets.js failed to load: ${h.mods.presetsError.message}`);
  assert(h.mods.presets, NOT_IMPL('src/api/strfry/negentropyPresets.js must exist'));
  assert(typeof h.mods.presets.validatePreset === 'function', NOT_IMPL('negentropyPresets.js must export validatePreset(input)'));
  return (input) => {
    const r = h.mods.presets.validatePreset(input);
    assert(r && typeof r === 'object' && typeof r.ok === 'boolean' && Array.isArray(r.errors),
      `validatePreset must return { ok, preset?, errors[] }; got ${show(r)}`);
    return r;
  };
}
const GOOD = (over = {}) => ({ name: 'Food places', relay: 'wss://relay.example.com', dir: 'down', filter: { kinds: [39999] }, ...over });
function accepted(r, what) {
  assert(r.ok === true && r.preset && typeof r.preset === 'object', `${what} must be accepted; got ${show(r)}`);
  eq(r.errors, [], `${what}: errors on success`);
  return r.preset;
}
function refused(r, what) {
  assert(r.ok === false && r.errors.length > 0, `${what} must be refused with at least one error; got ${show(r)}`);
  return r.errors;
}

test('V1: a preset with no event kinds, no authors and no tag filter is refused with the exact floor message, however its filter is empty (AC-2, product decision 3)', () => {
  const validate = V();
  const cases = [
    ['an empty filter', { filter: {} }],
    ['no filter at all', { filter: undefined }],
    ['empty kinds and authors', { filter: { kinds: [], authors: [] } }],
    ['only since/until/limit/ids (all dropped)', { filter: { since: 1, until: 2, limit: 5, ids: [EV_A] } }],
    ['only an unknown key and a two-letter tag key (both dropped)', { filter: { search: 'pizza', '#zz': ['x'] } }],
  ];
  for (const [what, over] of cases) {
    const errors = refused(validate(GOOD(over)), what);
    assert(errors.some((e) => String(e && e.message !== undefined ? e.message : e) === FLOOR),
      `${what}: the errors must include exactly "${FLOOR}"; got ${show(errors)}`);
  }
});

test('V2: any one of event kinds, authors or a tag filter meets the floor; a #z value is just a string (AC-2, epic guardrail)', () => {
  const validate = V();
  accepted(validate(GOOD({ filter: { kinds: [39998] } })), 'kinds only');
  accepted(validate(GOOD({ filter: { authors: [PK_A] } })), 'authors only');
  accepted(validate(GOOD({ filter: { '#z': [`39998:${PK_B}:food-and-drink-places`] } })), 'a #z concept-handle filter only');
  accepted(validate(GOOD({ filter: { '#t': ['anything at all'] } })), 'a #t filter only');
});

test('V3: the name is trimmed and must be 1–80 characters', () => {
  const validate = V();
  eq(accepted(validate(GOOD({ name: '  Food places  ' })), 'a padded name').name, 'Food places', 'the saved name');
  eq(accepted(validate(GOOD({ name: ` ${'n'.repeat(80)} ` })), 'an 80-character name').name, 'n'.repeat(80), 'the 80-character name');
  for (const [what, name] of [['an empty name', ''], ['a blank name', '   '], ['an 81-character name', 'n'.repeat(81)], ['a missing name', undefined], ['a non-string name', 42]]) {
    refused(validate(GOOD({ name })), what);
  }
});

test('V4: the relay must be a ws:// or wss:// URL by the router\'s relayUrlProblem check; a bad one is refused with an error that names the relay (AC-1)', () => {
  const validate = V();
  eq(accepted(validate(GOOD({ relay: 'wss://relay.example.com' })), 'a wss relay').relay, 'wss://relay.example.com', 'the saved relay');
  accepted(validate(GOOD({ relay: 'ws://127.0.0.1:7777' })), 'a loopback ws relay (owner-only surface, like the router)');
  for (const [what, relay] of [['a missing relay', undefined], ['an https URL', 'https://relay.example.com'], ['a URL with no host', 'wss://'],
    ['a URL with a space', 'wss://relay.example.com/a b'], ['a URL with a quote', 'wss://relay.example.com/"x'], ['a URL with a newline', 'wss://relay.example.com\n']]) {
    const errors = refused(validate(GOOD({ relay })), what);
    assert(errors.some((e) => /relay/i.test(String(e && e.message !== undefined ? e.message : e))), `${what}: an error must mention the relay; got ${show(errors)}`);
  }
});

test('V5: the direction is down, up or both, and defaults to down', () => {
  const validate = V();
  eq(accepted(validate(GOOD({ dir: undefined })), 'no direction').dir, 'down', 'the default direction');
  for (const dir of ['down', 'up', 'both']) eq(accepted(validate(GOOD({ dir })), `dir ${dir}`).dir, dir, `dir ${dir} is kept`);
  refused(validate(GOOD({ dir: 'sideways' })), 'dir "sideways"');
  refused(validate(GOOD({ dir: 7 })), 'a numeric dir');
});

test('V6: kinds are integers from 0 to 65535, saved without duplicates', () => {
  const validate = V();
  const p = accepted(validate(GOOD({ filter: { kinds: [1, 1, 0, 65535, 30023, 30023] } })), 'kinds with duplicates');
  eq(sorted(p.filter.kinds), [0, 1, 30023, 65535], 'the saved kinds (duplicates removed)');
  for (const [what, kinds] of [['kind 65536', [65536]], ['kind -1', [-1]], ['kind 1.5', [1, 1.5]]]) refused(validate(GOOD({ filter: { kinds } })), what);
});

test('V7: authors must be 64-character lowercase hex pubkeys', () => {
  const validate = V();
  eq(accepted(validate(GOOD({ filter: { authors: [PK_A, PK_B] } })), 'two hex authors').filter.authors, [PK_A, PK_B], 'the saved authors');
  for (const [what, a] of [['uppercase hex', PK_A.toUpperCase()], ['63 characters', PK_A.slice(1)], ['65 characters', `${PK_A}0`], ['an npub', `npub1${'q'.repeat(58)}`]]) {
    refused(validate(GOOD({ filter: { authors: [a] } })), `an author that is ${what}`);
  }
});

test('V8: #p, #P, #e and #E tag values must be 64-character hex (strfry rejects anything else)', () => {
  const validate = V();
  for (const key of ['#p', '#P', '#e', '#E']) {
    eq(accepted(validate(GOOD({ filter: { [key]: [PK_A] } })), `${key} with a hex value`).filter[key], [PK_A], `the saved ${key}`);
    refused(validate(GOOD({ filter: { [key]: [`npub1${'q'.repeat(58)}`] } })), `${key} with an npub`);
    refused(validate(GOOD({ filter: { [key]: [PK_A, 'abc'] } })), `${key} with one short value`);
  }
});

test('V9: other tag values are non-empty strings of at most 512 characters', () => {
  const validate = V();
  eq(accepted(validate(GOOD({ filter: { '#t': ['x'.repeat(512)] } })), 'a 512-character #t value').filter['#t'], ['x'.repeat(512)], 'the saved #t');
  accepted(validate(GOOD({ filter: { '#a': [`30023:${PK_A}:my-list`] } })), 'an #a address');
  refused(validate(GOOD({ filter: { '#t': ['x'.repeat(513)] } })), 'a 513-character #t value');
  refused(validate(GOOD({ filter: { '#t': [''] } })), 'an empty #t value');
  refused(validate(GOOD({ filter: { '#t': [5] } })), 'a numeric #t value');
});

test('V10: since, until, limit, ids and unknown keys are dropped from the saved filter, not refused (AC-1, product decision 1)', () => {
  const validate = V();
  const p = accepted(validate(GOOD({ filter: { kinds: [1], since: 1700000000, until: 1800000000, limit: 5, ids: [EV_A], search: 'x', foo: 'bar', '#zz': ['x'], '#1': ['y'] } })), 'a filter with extra keys');
  eq(Object.keys(p.filter).sort(), ['kinds'], 'the saved filter keys');
  eq({ name: p.name, relay: p.relay, dir: p.dir }, { name: 'Food places', relay: 'wss://relay.example.com', dir: 'down' }, 'the saved name, relay and direction');
});

// ═══ W: windowSince (pure) ══════════════════════════════════════════════════════════════
function W() {
  const mods = loadModules(path.join(TMP, 'unused.json'));
  if (mods.presetsError) throw new Error(`src/api/strfry/negentropyPresets.js failed to load: ${mods.presetsError.message}`);
  assert(mods.presets, NOT_IMPL('src/api/strfry/negentropyPresets.js must exist'));
  assert(typeof mods.presets.windowSince === 'function', NOT_IMPL('negentropyPresets.js must export windowSince(preset, nowSec)'));
  return mods.presets.windowSince;
}

test('W1: after a successful run, the next run looks back to that success less an hour (product decision 1)', () => {
  const windowSince = W();
  eq(windowSince({ lastSuccessAt: 1760000000 }, 1760050000), 1760000000 - HOUR, 'lastSuccessAt − 3600');
  eq(windowSince({ lastSuccessAt: 1760000000, lastRun: { ok: false, startedAt: 1760040000 } }, 1760050000), 1760000000 - HOUR, 'a later failed run does not move the window');
});

test('W2: a preset with no earlier success covers the last 7 days', () => {
  const windowSince = W();
  eq(windowSince({}, 1760000000), 1760000000 - WEEK, 'no lastSuccessAt');
  eq(windowSince({ lastSuccessAt: null }, 1760000000), 1760000000 - WEEK, 'lastSuccessAt null');
});

test('W3: the window never starts before 0', () => {
  const windowSince = W();
  eq(windowSince({ lastSuccessAt: 100 }, 5000), 0, 'an early lastSuccessAt');
  eq(windowSince({}, 1000), 0, 'a now earlier than 7 days');
});

// ═══ O: parseSyncOutput (pure) ══════════════════════════════════════════════════════════
function O() {
  const mods = loadModules(path.join(TMP, 'unused.json'));
  if (mods.presetsError) throw new Error(`src/api/strfry/negentropyPresets.js failed to load: ${mods.presetsError.message}`);
  assert(mods.presets, NOT_IMPL('src/api/strfry/negentropyPresets.js must exist'));
  assert(typeof mods.presets.parseSyncOutput === 'function', NOT_IMPL('negentropyPresets.js must export parseSyncOutput(text, exitCode)'));
  return (text, code) => {
    const r = mods.presets.parseSyncOutput(text, code);
    assert(r && typeof r === 'object' && typeof r.ok === 'boolean', `parseSyncOutput must return { ok, have, need, up, down, added, error }; got ${show(r)}`);
    return r;
  };
}

test('O1: a down sync (Evidence 1) reads as success with 12 needed, 12 down and 12 added', () => {
  const r = O()(OUT.down12, 0);
  eq({ ok: r.ok, have: r.have, need: r.need, down: r.down, added: r.added }, { ok: true, have: 0, need: 12, down: 12, added: 12 }, 'the parsed down sync');
  assert(zeroOrNull(r.up), `nothing went up, so up must be 0 or null; got ${show(r.up)}`);
  assert(!r.error, `a success carries no error; got ${show(r.error)}`);
});

test('O2: an up sync (Evidence 3) reads as success with 3 sent up', () => {
  const r = O()(OUT.up3, 0);
  eq({ ok: r.ok, have: r.have, need: r.need, up: r.up }, { ok: true, have: 3, need: 0, up: 3 }, 'the parsed up sync');
  assert(zeroOrNull(r.down), `nothing came down, so down must be 0 or null; got ${show(r.down)}`);
});

test('O3: a both-ways sync reads both counts and what was stored', () => {
  const r = O()(OUT.both, 0);
  eq({ ok: r.ok, have: r.have, need: r.need, up: r.up, down: r.down, added: r.added }, { ok: true, have: 2, need: 3, up: 2, down: 3, added: 3 }, 'the parsed both-ways sync');
});

test('O4: a sync with nothing to do (Evidence 2) is still a success', () => {
  const r = O()(OUT.nothing, 0);
  eq({ ok: r.ok, have: r.have, need: r.need, added: r.added }, { ok: true, have: 0, need: 0, added: 0 }, 'the parsed no-op sync');
  assert(zeroOrNull(r.up) && zeroOrNull(r.down), `up and down must be 0 or null; got ${show({ up: r.up, down: r.down })}`);
});

test('O5: an unreachable relay (Evidence 6, exit 1) is a failure whose error is strfry\'s line without the log prefix (AC-4)', () => {
  const r = O()(OUT.unreachable, 1);
  eq({ ok: r.ok, error: r.error }, { ok: false, error: 'Websocket connection error' }, 'the parsed unreachable relay');
});

test('O6: a non-zero exit with no reconcile line and no error line falls back to "strfry sync exited with code <n>"', () => {
  const r = O()(L('INFO', 'Filter matches 0 events'), 2);
  eq({ ok: r.ok, error: r.error }, { ok: false, error: 'strfry sync exited with code 2' }, 'the parsed failure');
});

test('O7: ok needs both exit 0 and the "Set reconcile complete" line', () => {
  const parse = O();
  const noReconcile = parse(L('INFO', 'Filter matches 0 events') + L('INFO', 'Writer: added: 0 dups: 0 replaced: 0 deleted: 0'), 0);
  assert(noReconcile.ok === false && typeof noReconcile.error === 'string' && noReconcile.error.length > 0,
    `exit 0 without the reconcile line is not ok and carries an error; got ${show(noReconcile)}`);
  const failedAfter = parse(OUT.down12, 1);
  assert(failedAfter.ok === false && typeof failedAfter.error === 'string' && failedAfter.error.length > 0,
    `a reconcile line with exit 1 is not ok and carries an error; got ${show(failedAfter)}`);
});

test('O8: the error is the LAST line containing "error" or "ERR|", with the log prefix stripped', () => {
  const text = L('INFO', 'Filter matches 5 events') + L('ERR', 'first problem: connection error')
    + L('INFO', 'retrying') + L('ERR', 'NEG-ERR from relay: blocked: negentropy disabled') + L('INFO', 'Writer: added: 0 dups: 0 replaced: 0 deleted: 0');
  const r = O()(text, 1);
  eq({ ok: r.ok, error: r.error }, { ok: false, error: 'NEG-ERR from relay: blocked: negentropy disabled' }, 'the last ERR| line');
});

// ═══ N: the one-shot module's shared slot ═══════════════════════════════════════════════
test('N1: isSyncActive() is false when idle, true while a one-shot sync runs, and false again after', async () => {
  const h = harness();
  const sync = h.syncModule();
  assert(typeof sync.isSyncActive === 'function', NOT_IMPL('negentropySync.js must export isSyncActive()'));
  eq(sync.isSyncActive(), false, 'isSyncActive() when idle');
  fake.on(h.relay('manual'), { mode: 'hold', out: OUT.down12, code: 0 });
  const res = h.oneShot('manual');
  await until(() => h.spawnsOf('manual').length === 1, 2000, 'the one-shot to start strfry');
  eq(sync.isSyncActive(), true, 'isSyncActive() while a one-shot runs');
  h.spawnsOf('manual')[0].release();
  await withTimeout(res.done, 3000, 'the one-shot answer');
  eq(sync.isSyncActive(), false, 'isSyncActive() after the one-shot ended');
});

test('N2: runStrfrySync spawns the one-shot\'s buildCommand argv, holds the shared slot while strfry runs, and resolves { exitCode, output } with strfry\'s stderr', async () => {
  const h = harness();
  const sync = h.syncModule();
  assert(typeof sync.runStrfrySync === 'function', NOT_IMPL('negentropySync.js must export runStrfrySync(relay, dir, filter, opts)'));
  const relay = h.relay('n2');
  fake.on(relay, { mode: 'hold', out: OUT.down12, code: 0 });
  const p = Promise.resolve().then(() => sync.runStrfrySync(relay, 'down', { kinds: [1], since: 1700000000 }));
  await until(() => h.spawnsOf('n2').length === 1, 2000, 'runStrfrySync to start strfry');
  const e = h.spawnsOf('n2')[0];
  eq(e.args, sync.buildCommand(relay, 'down', { kinds: [1], since: 1700000000 }).args, 'the argv (one code path builds strfry commands)');
  assert(path.basename(e.cmd) === 'strfry', `the program must be strfry; got ${show(e.cmd)}`);
  eq(sync.isSyncActive(), true, 'isSyncActive() while runStrfrySync runs');
  const st = await h.status();
  assert(st && st.active === true && st.relay === relay, `/status must report the running preset sync; got ${show(st)}`);
  e.release();
  const r = await withTimeout(p, 3000, 'runStrfrySync');
  assert(r && r.exitCode === 0 && typeof r.output === 'string' && r.output.includes('Set reconcile complete. Have 0 need 12'),
    `runStrfrySync must resolve { exitCode: 0, output } with the stderr text; got ${show(r)}`);
  eq(sync.isSyncActive(), false, 'isSyncActive() after runStrfrySync');
});

test('N3: runStrfrySync refuses with code BUSY while a one-shot sync holds the slot, and starts nothing', async () => {
  const h = harness();
  const sync = h.syncModule();
  assert(typeof sync.runStrfrySync === 'function', NOT_IMPL('negentropySync.js must export runStrfrySync(relay, dir, filter, opts)'));
  fake.on(h.relay('manual'), { mode: 'hold' });
  const res = h.oneShot('manual');
  await until(() => h.spawnsOf('manual').length === 1, 2000, 'the one-shot to start strfry');
  let caught = null;
  try { await sync.runStrfrySync(h.relay('n3'), 'down', { kinds: [1] }); } catch (err) { caught = err; }
  assert(caught && caught.code === 'BUSY', `runStrfrySync must throw/reject { code: 'BUSY' }; got ${show(caught)}`);
  eq(h.spawnsOf('n3').length, 0, 'strfry runs started by the refused call');
  h.spawnsOf('manual')[0].release();
  await withTimeout(res.done, 3000, 'the one-shot answer');
});

// ═══ P: presets — storage and the save / toggle / delete / list endpoints ════════════
test('P1: a fresh install has no presets: GET answers { success: true, presets: [] } and nothing is running (story: no starter presets)', async () => {
  const h = harness();
  h.presetsModule();
  const res = await h.req('GET', BASE);
  assert(httpCode(res) === 200 && res.body && res.body.success === true, `GET ${BASE}: ${httpCode(res)} ${show(res.body)}`);
  eq(res.body.presets, [], 'presets on a fresh install');
  assert(!res.body.running, `running must be falsy when idle; got ${show(res.body.running)}`);
});

test('P2: saving a preset stores it switched off, with a server-made UUID, in { version: 1, presets } at NEGENTROPY_PRESETS_PATH (AC-1)', async () => {
  const h = harness();
  h.presetsModule();
  const zFilter = { kinds: [39999], '#z': [`39998:${PK_B}:food-and-drink-places`] };
  const res = await h.req('POST', BASE, { name: 'Food places', relay: h.relay('food'), dir: 'down', filter: zFilter });
  assert(httpCode(res) === 200 && res.body && res.body.success === true, `the save must succeed; got ${httpCode(res)} ${show(res.body)}`);
  const list = await h.list();
  eq(list.length, 1, 'presets after one save');
  const p = list[0];
  eq({ name: p.name, relay: p.relay, dir: p.dir, enabled: p.enabled, filter: p.filter }, { name: 'Food places', relay: h.relay('food'), dir: 'down', enabled: false, filter: zFilter }, 'the listed preset (a new preset starts off)');
  assert(UUID_RE.test(String(p.id)), `id must be a crypto.randomUUID(); got ${show(p.id)}`);
  const file = h.fileJson();
  assert(file && file.version === 1 && Array.isArray(file.presets) && file.presets.length === 1, `the presets file must hold { version: 1, presets: [1 preset] }; got ${show(file)}`);
  const f = file.presets[0];
  eq({ id: f.id, name: f.name, enabled: f.enabled }, { id: p.id, name: 'Food places', enabled: false }, 'the stored preset');
  assert(f.createdAt != null && f.updatedAt != null, `the stored preset must carry createdAt and updatedAt; got ${show(f)}`);
});

test('P3: a save cannot forge the server\'s fields: id, lastRun and lastSuccessAt in the body are ignored', async () => {
  const h = harness();
  h.presetsModule();
  const res = await h.req('POST', BASE, { name: 'Forged', relay: h.relay('forged'), dir: 'down', filter: { kinds: [1] }, id: 'forged-id', lastRun: { ok: true, startedAt: 1 }, lastSuccessAt: 4102444800 });
  assert(res.body && res.body.success === true, `the save must succeed; got ${show(res.body)}`);
  const p = await h.byName('Forged');
  assert(p && UUID_RE.test(String(p.id)) && p.id !== 'forged-id', `the id must be made by the server; got ${show(p && p.id)}`);
  assert(p.lastRun == null && p.lastSuccessAt == null, `lastRun and lastSuccessAt must not be taken from the body; got ${show({ lastRun: p.lastRun, lastSuccessAt: p.lastSuccessAt })}`);
});

test('P4: presets survive a restart: a saved file is listed as stored, and a save and a switch-on are still there after the server restarts (AC-1)', async () => {
  const h0 = harness();
  const a = h0.preset('alpha', { enabled: true, lastSuccessAt: T0, lastRun: { startedAt: T0, finishedAt: T0 + 5, since: T0 - WEEK, ok: true, added: 4, sent: 0 } });
  const b = h0.preset('bravo', { enabled: false, dir: 'both', filter: { authors: [PK_A], '#t': ['nostr'] } });
  const h = harness({ presets: [a, b] });
  h.presetsModule();
  const listed = await h.list();
  const pick = (p) => p && { id: p.id, name: p.name, relay: p.relay, dir: p.dir, filter: p.filter, enabled: p.enabled, lastRun: p.lastRun, lastSuccessAt: p.lastSuccessAt };
  eq(listed.map(pick).sort((x, y) => x.name.localeCompare(y.name)), [a, b].map(pick), 'the presets read from the file');
  const save = await h.req('POST', BASE, { name: 'charlie', relay: h.relay('charlie'), dir: 'up', filter: { kinds: [1] } });
  assert(save.body && save.body.success === true, `the save must succeed; got ${show(save.body)}`);
  const c = (await h.list()).find((p) => p.name === 'charlie');
  const tog = await h.req('POST', `${BASE}/toggle`, { id: c.id, enabled: true });
  assert(tog.body && tog.body.success === true, `the toggle must succeed; got ${show(tog.body)}`);
  h.start(); // restart: fresh modules over the same file
  const after = await h.list();
  eq(after.map((p) => p.name).sort(), ['alpha', 'bravo', 'charlie'], 'presets after the restart');
  const c2 = after.find((p) => p.name === 'charlie');
  eq({ id: c2.id, enabled: c2.enabled, dir: c2.dir }, { id: c.id, enabled: true, dir: 'up' }, 'charlie after the restart');
});

test('P5: an invalid preset is refused with 400 { success: false, error } carrying the reason, and nothing is written (AC-1, AC-2)', async () => {
  const h = harness();
  h.presetsModule();
  const floor = await h.req('POST', BASE, { name: 'Everything', relay: h.relay('all'), dir: 'down', filter: {} });
  assert(floor.statusCode === 400 && floor.body && floor.body.success === false && typeof floor.body.error === 'string' && floor.body.error.includes(FLOOR),
    `an unfiltered preset must be 400 { success: false, error } with "${FLOOR}"; got ${floor.statusCode} ${show(floor.body)}`);
  const relay = await h.req('POST', BASE, { name: 'Bad relay', relay: 'https://relay.example.com', dir: 'down', filter: { kinds: [1] } });
  assert(relay.statusCode === 400 && relay.body && relay.body.success === false && typeof relay.body.error === 'string' && relay.body.error.length > 0,
    `a bad relay must be 400 { success: false, error }; got ${relay.statusCode} ${show(relay.body)}`);
  const text = h.fileText();
  assert(text === null || JSON.parse(text).presets.length === 0, `nothing may be saved; the file holds ${text}`);
});

test('P6: saving under an existing name (any letter case) with the same relay, direction and filter replaces it and keeps its id, switch, lastRun and lastSuccessAt; since/until in the body don\'t count as a change', async () => {
  const h0 = harness();
  const lastRun = { startedAt: T0, finishedAt: T0 + 5, since: T0 - WEEK, ok: true, added: 4, sent: 0 };
  const a = h0.preset('Food places', { relay: h0.relay('food'), enabled: true, lastSuccessAt: T0, lastRun, filter: { kinds: [39999] } });
  const h = harness({ presets: [{ ...a, relay: 'wss://food.example' }] });
  h.presetsModule();
  const res = await h.req('POST', BASE, { name: 'FOOD PLACES', relay: 'wss://food.example', dir: 'down', filter: { kinds: [39999], since: 1700000000, until: 1800000000 } });
  assert(res.body && res.body.success === true, `the replace must succeed; got ${httpCode(res)} ${show(res.body)}`);
  const list = await h.list();
  eq(list.length, 1, 'presets after the replace (one preset, not two)');
  const p = list[0];
  eq({ id: p.id, enabled: p.enabled, lastRun: p.lastRun, lastSuccessAt: p.lastSuccessAt, filter: p.filter },
    { id: a.id, enabled: true, lastRun, lastSuccessAt: T0, filter: { kinds: [39999] } }, 'the replaced preset');
});

test('P7: replacing a preset with a changed relay, direction or filter clears lastSuccessAt (the next run covers 7 days) but keeps id, switch and lastRun', async () => {
  const lastRun = { startedAt: T0, finishedAt: T0 + 5, since: T0 - WEEK, ok: true, added: 4, sent: 0 };
  for (const [what, change] of [['the filter', { filter: { kinds: [39999, 39998] } }], ['the relay', { relay: 'wss://other.example' }], ['the direction', { dir: 'both' }]]) {
    const a = { id: crypto.randomUUID(), name: 'Food places', relay: 'wss://food.example', dir: 'down', filter: { kinds: [39999] }, enabled: true, createdAt: T0 - 100, updatedAt: T0 - 100, lastRun, lastSuccessAt: T0 };
    const h = harness({ presets: [a] });
    h.presetsModule();
    const body = { name: 'Food places', relay: a.relay, dir: a.dir, filter: a.filter, ...change };
    const res = await h.req('POST', BASE, body);
    assert(res.body && res.body.success === true, `changing ${what}: the replace must succeed; got ${httpCode(res)} ${show(res.body)}`);
    const list = await h.list();
    eq(list.length, 1, `changing ${what}: presets after the replace`);
    const p = list[0];
    assert(p.lastSuccessAt == null, `changing ${what} must clear lastSuccessAt; got ${show(p.lastSuccessAt)}`);
    eq({ id: p.id, enabled: p.enabled, lastRun: p.lastRun, relay: p.relay, dir: p.dir, filter: p.filter },
      { id: a.id, enabled: true, lastRun, relay: body.relay, dir: body.dir, filter: body.filter }, `changing ${what}: the replaced preset`);
  }
});

test('P8: the switch: POST …/toggle { id, enabled } switches a preset on and off and is saved; an unknown id is refused and changes nothing (AC-1)', async () => {
  const h0 = harness();
  const a = h0.preset('alpha', { enabled: false });
  const h = harness({ presets: [{ ...a, relay: 'wss://alpha.example' }] });
  h.presetsModule();
  const on = await h.req('POST', `${BASE}/toggle`, { id: a.id, enabled: true });
  assert(on.body && on.body.success === true, `switching on must succeed; got ${httpCode(on)} ${show(on.body)}`);
  eq((await h.byName('alpha')).enabled, true, 'listed after switching on');
  eq(h.fileJson().presets[0].enabled, true, 'stored after switching on');
  const off = await h.req('POST', `${BASE}/toggle`, { id: a.id, enabled: false });
  assert(off.body && off.body.success === true, `switching off must succeed; got ${show(off.body)}`);
  eq((await h.byName('alpha')).enabled, false, 'listed after switching off');
  const before = h.fileText();
  const unknown = await h.req('POST', `${BASE}/toggle`, { id: crypto.randomUUID(), enabled: true });
  assert(unknown.body && unknown.body.success === false && httpCode(unknown) >= 400, `an unknown id must be refused; got ${httpCode(unknown)} ${show(unknown.body)}`);
  eq(h.fileText(), before, 'the presets file after an unknown-id toggle');
});

test('P9: POST …/delete { id } removes that preset only, and it stays removed (AC-1)', async () => {
  const h0 = harness();
  const a = h0.preset('alpha');
  const b = h0.preset('bravo');
  const h = harness({ presets: [a, b] });
  h.presetsModule();
  const res = await h.req('POST', `${BASE}/delete`, { id: a.id });
  assert(res.body && res.body.success === true, `the delete must succeed; got ${httpCode(res)} ${show(res.body)}`);
  eq((await h.list()).map((p) => p.id), [b.id], 'presets after the delete');
  eq(h.fileJson().presets.map((p) => p.id), [b.id], 'stored presets after the delete');
});

test('P10: the presets file is replaced whole: each save writes another file and renames it onto negentropy-presets.json, never writing it in place', async () => {
  const calls = [];
  const saved = [];
  const wrap = (obj, name, label, nPaths) => {
    const orig = obj[name];
    if (typeof orig !== 'function') return;
    saved.push([obj, name, orig]);
    obj[name] = function watched(...args) {
      calls.push({ fn: label + name, paths: args.slice(0, nPaths).map((a) => (a instanceof URL ? a.pathname : a)), flags: args[1] });
      return orig.apply(this, args);
    };
  };
  for (const n of ['writeFileSync', 'writeFile', 'appendFileSync', 'appendFile', 'createWriteStream', 'truncateSync', 'truncate', 'openSync', 'open']) wrap(fs, n, '', 1);
  for (const n of ['renameSync', 'rename', 'copyFileSync', 'copyFile']) wrap(fs, n, '', 2);
  for (const n of ['writeFile', 'appendFile', 'truncate', 'open']) wrap(fs.promises, n, 'promises.', 1);
  for (const n of ['rename', 'copyFile']) wrap(fs.promises, n, 'promises.', 2);
  let h;
  try {
    h = harness(); // modules load after the wrappers, so destructured fs functions are watched too
    h.presetsModule();
    const res = await h.req('POST', BASE, { name: 'Atomic', relay: h.relay('atomic'), dir: 'down', filter: { kinds: [1] } });
    assert(res.body && res.body.success === true, `the save must succeed; got ${show(res.body)}`);
  } finally {
    for (const [o, n, f] of saved.reverse()) o[n] = f;
  }
  const target = h.file;
  const inPlace = calls.filter((c) => c.paths[0] === target && (/writeFile|appendFile|createWriteStream|truncate/.test(c.fn) || (/open/.test(c.fn) && /[wa+]/.test(String(c.flags)))));
  const copied = calls.filter((c) => /copyFile/.test(c.fn) && c.paths[1] === target);
  const renamed = calls.filter((c) => /rename/.test(c.fn) && c.paths[1] === target);
  assert(inPlace.length === 0 && copied.length === 0, `the presets file must never be written in place (${[...inPlace, ...copied].map((c) => c.fn).join(', ')}); write a temp file and rename it (ADR § Implementation notes).`);
  assert(renamed.length >= 1, 'the save must rename a temp file onto the presets file; no rename onto it was seen.');
  assert(h.fileJson() && h.fileJson().presets.length === 1, 'the renamed file holds the saved preset');
});

test('P11: every POST — save, toggle, delete and run — from a signed-in non-owner or an anonymous caller is refused 403 before anything is written or run (ADR constraint: owner-or-local)', async () => {
  const h0 = harness();
  const a = h0.preset('alpha', { enabled: true });
  for (const as of ['member', 'anon']) {
    const h = harness({ presets: [{ ...a, relay: `wss://t${SEQ + 1}-alpha.example` }] });
    h.presetsModule();
    const before = h.fileText();
    const posts = [
      [BASE, { name: 'Sneaky', relay: h.relay('sneaky'), dir: 'up', filter: { kinds: [1] } }],
      [`${BASE}/toggle`, { id: a.id, enabled: false }],
      [`${BASE}/delete`, { id: a.id }],
      [`${BASE}/run`, {}],
    ];
    for (const [p, body] of posts) {
      const res = await h.req('POST', p, body, as);
      assert(res.statusCode === 403 && res.body && res.body.success === false, `${as}: POST ${p} must be 403 { success: false }; got ${res.statusCode} ${show(res.body)}`);
    }
    eq(h.fileText(), before, `${as}: the presets file after the refused POSTs`);
    eq(h.spawns().length, 0, `${as}: strfry runs after the refused POSTs`);
  }
});

test('P12: the owner and a local (loopback) caller pass the gate; any signed-in user can read the list', async () => {
  const h = harness();
  h.presetsModule();
  const owner = await h.req('POST', BASE, { name: 'By owner', relay: h.relay('o'), dir: 'down', filter: { kinds: [1] } }, 'owner');
  assert(httpCode(owner) === 200 && owner.body && owner.body.success === true, `the owner's save must succeed; got ${httpCode(owner)} ${show(owner.body)}`);
  const local = await h.req('POST', BASE, { name: 'By loopback', relay: h.relay('l'), dir: 'down', filter: { kinds: [1] } }, 'local');
  assert(httpCode(local) === 200 && local.body && local.body.success === true, `a loopback save must succeed; got ${httpCode(local)} ${show(local.body)}`);
  const read = await h.req('GET', BASE, {}, 'member');
  assert(httpCode(read) === 200 && read.body && read.body.success === true && read.body.presets.length === 2, `a signed-in non-owner can list presets; got ${httpCode(read)} ${show(read.body)}`);
});

test('P13: presets live in /var/lib/brainstorm/negentropy-presets.json (the data volume) unless NEGENTROPY_PRESETS_PATH is set, and the owner gate is routerConfig\'s requireOwnerOrLocal, reused not copied', () => {
  const src = safeRead(PRESETS_MOD);
  assert(src, NOT_IMPL('src/api/strfry/negentropyPresets.js must exist'));
  const code = codeOnly(src);
  assert(code.includes(DEFAULT_PRESETS_PATH) && code.includes('NEGENTROPY_PRESETS_PATH'), `negentropyPresets.js must default to ${DEFAULT_PRESETS_PATH} with the NEGENTROPY_PRESETS_PATH override.`);
  assert(/requireOwnerOrLocal/.test(code) && !/function\s+requireOwnerOrLocal\b/.test(code) && !/requireOwnerOrLocal\s*=\s*(function|\()/.test(code),
    'negentropyPresets.js must use routerConfig\'s requireOwnerOrLocal, not define its own.');
  const mods = loadModules(path.join(TMP, 'unused.json'));
  const router = require(ROUTER);
  assert(typeof router.requireOwnerOrLocal === 'function', NOT_IMPL('routerConfig.js must export requireOwnerOrLocal'));
  void mods;
});

// ═══ R: the runner, POST …/run ═══════════════════════════════════════════════════════
test('R1: a run syncs only switched-on presets, in name order, one at a time, each with its own relay, direction and filter plus since = now − 7 days on a first run (AC-3, product decision 1)', async () => {
  const h0 = harness();
  const seq = SEQ + 1;
  const r = (n) => `wss://t${seq}-${n}.example`;
  const presets = [
    h0.preset('charlie', { relay: r('charlie'), dir: 'both', filter: { '#z': [`39998:${PK_B}:food-and-drink-places`] } }),
    h0.preset('alpha', { relay: r('alpha'), dir: 'down', filter: { kinds: [39998, 39999] } }),
    h0.preset('delta', { relay: r('delta'), enabled: false }),
    h0.preset('bravo', { relay: r('bravo'), dir: 'up', filter: { authors: [PK_A], kinds: [1] } }),
  ];
  const h = harness({ presets });
  h.presetsModule();
  fake.on(h.relay('alpha'), { out: OUT.down12, code: 0, delayMs: 30 });
  fake.on(h.relay('bravo'), { out: OUT.up3, code: 0, delayMs: 30 });
  fake.on(h.relay('charlie'), { out: OUT.both, code: 0, delayMs: 30 });
  const nowBefore = Math.floor(Date.now() / 1000);
  const body = okRun(await h.run(), 'a first run');
  const nowAfter = Math.ceil(Date.now() / 1000);
  const ran = h.spawns();
  eq(ran.map((e) => e.relay), [h.relay('alpha'), h.relay('bravo'), h.relay('charlie')], 'the presets synced, in order (switched-off delta skipped)');
  eq(maxOverlap(ran), 1, 'strfry syncs running at once');
  const sync = h.syncModule();
  for (const e of ran) {
    const p = presets.find((x) => x.relay === e.relay);
    const f = filterOf(e);
    assert(Number.isInteger(f.since) && f.since >= nowBefore - WEEK - 2 && f.since <= nowAfter - WEEK + 2,
      `${p.name}: a first run's since must be now − 7 days (${nowBefore - WEEK}…${nowAfter - WEEK}); got ${show(f.since)}`);
    assert(!('until' in f), `${p.name}: the filter must not carry until; got ${show(f)}`);
    eq(e.args, sync.buildCommand(p.relay, p.dir, { ...p.filter, since: f.since }).args, `${p.name}: the argv (the one-shot's buildCommand with the preset's relay, direction and filter plus since)`);
  }
  eq(body.results.map((x) => x && x.name), ['alpha', 'bravo', 'charlie'], 'the results, in run order');
  eq(body.results.map((x) => x && x.id), ['alpha', 'bravo', 'charlie'].map((n) => presets.find((p) => p.name === n).id), 'the result ids');
  eq(body.failed, 0, 'failed');
  assert(body.results.every((x) => x.ok === true), `every result must be ok; got ${show(body.results)}`);
  const delta = await h.byName('delta');
  assert(delta && delta.lastRun == null, `the switched-off preset must not get a lastRun; got ${show(delta && delta.lastRun)}`);
});

test('R2: a preset with an earlier success syncs from that success less an hour', async () => {
  const h0 = harness();
  const seq = SEQ + 1;
  const a = h0.preset('alpha', { relay: `wss://t${seq}-alpha.example`, lastSuccessAt: T0, lastRun: { startedAt: T0, finishedAt: T0 + 3, since: T0 - WEEK, ok: true, added: 1, sent: 0 } });
  const h = harness({ presets: [a] });
  h.presetsModule();
  const body = okRun(await h.run(), 'a run after a success');
  const e = h.spawnsOf('alpha');
  eq(e.length, 1, 'syncs of alpha');
  eq(filterOf(e[0]).since, T0 - HOUR, 'since = lastSuccessAt − 3600');
  eq(body.failed, 0, 'failed');
});

test('R3: each preset\'s run is recorded — lastRun { startedAt, finishedAt, since, ok, added, sent } in unix seconds — and a success sets lastSuccessAt to that run\'s start (AC-4)', async () => {
  const h0 = harness();
  const seq = SEQ + 1;
  const presets = [
    h0.preset('alpha', { relay: `wss://t${seq}-alpha.example`, dir: 'down' }),
    h0.preset('bravo', { relay: `wss://t${seq}-bravo.example`, dir: 'up', filter: { kinds: [1] } }),
  ];
  const h = harness({ presets });
  h.presetsModule();
  fake.on(h.relay('alpha'), { out: OUT.down12, code: 0 });
  fake.on(h.relay('bravo'), { out: OUT.up3, code: 0 });
  const before = Math.floor(Date.now() / 1000);
  const body = okRun(await h.run(), 'a run');
  const after = Math.ceil(Date.now() / 1000);
  const list = await h.list();
  for (const name of ['alpha', 'bravo']) {
    const p = list.find((x) => x.name === name);
    const lr = p && p.lastRun;
    assert(lr && typeof lr === 'object', `${name}: lastRun must be recorded; got ${show(p)}`);
    const sent = filterOf(h.spawnsOf(name)[0]).since;
    assert(lr.ok === true && lr.since === sent, `${name}: lastRun must record ok: true and the since it synced from (${sent}); got ${show(lr)}`);
    for (const k of ['startedAt', 'finishedAt']) {
      assert(Number.isInteger(lr[k]) && lr[k] >= before - 1 && lr[k] <= after + 1, `${name}: lastRun.${k} must be unix seconds within the run (${before}…${after}); got ${show(lr[k])}`);
    }
    assert(lr.finishedAt >= lr.startedAt, `${name}: finishedAt must not precede startedAt; got ${show(lr)}`);
    eq(p.lastSuccessAt, lr.startedAt, `${name}: lastSuccessAt = lastRun.startedAt`);
    const spawnedAt = Math.ceil(h.spawnsOf(name)[0].at / 1000);
    assert(p.lastSuccessAt <= spawnedAt, `${name}: lastSuccessAt (${p.lastSuccessAt}) must be no later than its strfry start (${spawnedAt})`);
  }
  const a = list.find((x) => x.name === 'alpha').lastRun;
  const b = list.find((x) => x.name === 'bravo').lastRun;
  assert(a.added === 12 && zeroOrNull(a.sent), `alpha (down) must record added 12 and sent 0/null; got ${show(a)}`);
  assert(b.sent === 3 && zeroOrNull(b.added), `bravo (up) must record sent 3 and added 0/null; got ${show(b)}`);
  const ra = body.results.find((x) => x.name === 'alpha');
  const rb = body.results.find((x) => x.name === 'bravo');
  assert(ra && ra.ok === true && ra.added === 12 && zeroOrNull(ra.sent) && !ra.error && !ra.skipped, `alpha's result must be { ok: true, added: 12, sent: 0/null }; got ${show(ra)}`);
  assert(rb && rb.ok === true && rb.sent === 3 && !rb.error && !rb.skipped, `bravo's result must be { ok: true, sent: 3 }; got ${show(rb)}`);
});

test('R4: lastSuccessAt is the run\'s start, not its end, so events published during a slow sync fall inside the next window (time dilated)', async () => {
  const h0 = harness();
  const seq = SEQ + 1;
  const h = harness({ presets: [h0.preset('alpha', { relay: `wss://t${seq}-alpha.example` })] });
  h.presetsModule();
  fake.on(h.relay('alpha'), { out: OUT.down12, code: 0, delayMs: 250 }); // ≈ 5 s of dilated time
  clock.dilate(20);
  okRun(await h.run(), 'a slow run');
  clock.normal();
  const p = await h.byName('alpha');
  const lr = p.lastRun || {};
  assert(lr.finishedAt - lr.startedAt >= 2 && lr.finishedAt - lr.startedAt < HOUR, `the slow sync took ≈5 s; lastRun must show it in seconds; got ${show(lr)}`);
  eq(p.lastSuccessAt, lr.startedAt, 'lastSuccessAt = the start of the run');
});

test('R5: one preset failing doesn\'t stop the others: the unreachable relay\'s error is recorded, its earlier success is kept, the next preset runs, and failed counts it (AC-4)', async () => {
  const h0 = harness();
  const seq = SEQ + 1;
  const prior = { startedAt: T0, finishedAt: T0 + 3, since: T0 - WEEK, ok: true, added: 1, sent: 0 };
  const h = harness({ presets: [
    h0.preset('alpha', { relay: `wss://t${seq}-alpha.example`, lastSuccessAt: T0, lastRun: prior }),
    h0.preset('bravo', { relay: `wss://t${seq}-bravo.example` }),
  ] });
  h.presetsModule();
  fake.on(h.relay('alpha'), { out: OUT.unreachable, code: 1 });
  fake.on(h.relay('bravo'), { out: OUT.down12, code: 0 });
  const body = okRun(await h.run(), 'a run with one failure');
  eq(body.failed, 1, 'failed');
  eq(body.results.map((x) => [x.name, x.ok]), [['alpha', false], ['bravo', true]], 'the results');
  eq(body.results[0].error, 'Websocket connection error', "alpha's result error");
  const alpha = await h.byName('alpha');
  eq({ ok: alpha.lastRun && alpha.lastRun.ok, error: alpha.lastRun && alpha.lastRun.error }, { ok: false, error: 'Websocket connection error' }, "alpha's lastRun");
  eq(alpha.lastSuccessAt, T0, "alpha's lastSuccessAt (kept, not advanced or cleared)");
  const bravo = await h.byName('bravo');
  assert(bravo.lastRun && bravo.lastRun.ok === true && bravo.lastSuccessAt === bravo.lastRun.startedAt, `bravo must have run and succeeded; got ${show(bravo)}`);
});

test('R6: a run requested while one is going answers 409 { alreadyRunning: true } and starts nothing; once the first ends, the next run starts normally (AC-3)', async () => {
  const h0 = harness();
  const seq = SEQ + 1;
  const h = harness({ presets: [h0.preset('alpha', { relay: `wss://t${seq}-alpha.example` })] });
  h.presetsModule();
  fake.on(h.relay('alpha'), { mode: 'hold', out: OUT.down12, code: 0 });
  const first = h.begin('POST', `${BASE}/run`);
  await until(() => h.spawnsOf('alpha').length === 1, 3000, 'the first run to start strfry');
  const second = await h.req('POST', `${BASE}/run`, {}, 'local', 3000);
  assert(second.statusCode === 409 && second.body && second.body.alreadyRunning === true, `the overlapping run must be 409 { alreadyRunning: true }; got ${second.statusCode} ${show(second.body)}`);
  eq(h.spawnsOf('alpha').length, 1, 'strfry runs after the refused second run');
  h.spawnsOf('alpha')[0].release();
  okRun(await withTimeout(first.done, 5000, 'the first run'), 'the first run');
  fake.on(h.relay('alpha'), { out: OUT.nothing, code: 0 });
  okRun(await h.run(), 'a later run');
  eq(h.spawnsOf('alpha').length, 2, 'strfry runs after the later run');
});

test('R7: while a preset syncs it holds the one-shot\'s slot: /status shows it, a manual Start is refused, GET reports running; afterwards the slot is free again (ADR § Consequences)', async () => {
  const h0 = harness();
  const seq = SEQ + 1;
  const h = harness({ presets: [h0.preset('alpha', { relay: `wss://t${seq}-alpha.example` })] });
  h.presetsModule();
  fake.on(h.relay('alpha'), { mode: 'hold', out: OUT.down12, code: 0 });
  const run = h.begin('POST', `${BASE}/run`);
  await until(() => h.spawnsOf('alpha').length === 1, 3000, 'the run to start strfry');
  const st = await h.status();
  assert(st && st.success === true && st.active === true && st.relay === h.relay('alpha'), `/status must show the preset's sync; got ${show(st)}`);
  const manual = await h.req('POST', ONE_SHOT, { relay: h.relay('manual'), dir: 'down', filter: { kinds: [1] } }, 'local', 3000);
  assert(manual.body && manual.body.success === false && manual.body.error === 'A sync is already in progress', `a manual Start must be refused; got ${show(manual.body)}`);
  eq(h.spawnsOf('manual').length, 0, 'manual strfry runs while the preset syncs');
  const g = await h.req('GET', BASE);
  assert(g.body && g.body.running, `GET ${BASE} must report running while the run goes; got ${show(g.body && g.body.running)}`);
  h.spawnsOf('alpha')[0].release();
  okRun(await withTimeout(run.done, 5000, 'the run'), 'the run');
  const idle = await h.status();
  assert(idle && idle.active === false, `/status must be idle after the run; got ${show(idle)}`);
  const g2 = await h.req('GET', BASE);
  assert(!g2.body.running, `GET must not report running after the run; got ${show(g2.body.running)}`);
  const after = await h.req('POST', ONE_SHOT, { relay: h.relay('manual'), dir: 'down', filter: { kinds: [1] } }, 'local', 3000);
  assert(after.body && after.body.success === true, `a manual Start after the run must work; got ${show(after.body)}`);
});

test('R8: a preset that finds a manual sync running waits up to 10 minutes, then is recorded skipped ("a manual sync was running") without running, its last success kept and the manual sync untouched (time dilated ×600)', async () => {
  const h0 = harness();
  const seq = SEQ + 1;
  const h = harness({ presets: [h0.preset('alpha', { relay: `wss://t${seq}-alpha.example`, lastSuccessAt: T0 })] });
  h.presetsModule();
  fake.on(h.relay('manual'), { mode: 'hold' });
  const manual = h.oneShot('manual');
  await until(() => h.spawnsOf('manual').length === 1, 2000, 'the manual sync to start');
  clock.dilate(600);
  const t0 = Date.now();
  const res = await h.run(15000);
  const waited = Date.now() - t0;
  clock.normal();
  const body = okRun(res, 'a run that met a manual sync');
  assert(waited >= 570000, `the preset must wait about 10 minutes for the slot; the run answered after ${Math.round(waited / 1000)} s (dilated)`);
  assert(waited < 1800000, `the wait must end after about 10 minutes, not run on; it took ${Math.round(waited / 1000)} s (dilated)`);
  eq(h.spawnsOf('alpha').length, 0, 'strfry runs for the skipped preset');
  const r0 = body.results[0] || {};
  assert(r0.name === 'alpha' && r0.skipped && r0.ok !== true, `alpha's result must be skipped, not ok; got ${show(r0)}`);
  const p = await h.byName('alpha');
  assert(p.lastRun && typeof p.lastRun.skipped === 'string' && p.lastRun.skipped.includes('a manual sync was running') && p.lastRun.ok !== true,
    `alpha's lastRun must say skipped: "a manual sync was running"; got ${show(p.lastRun)}`);
  eq(p.lastSuccessAt, T0, "alpha's lastSuccessAt");
  const st = await h.status();
  assert(st.active === true && st.relay === h.relay('manual') && !h.spawnsOf('manual')[0].closed, `the manual sync must still be running; got ${show(st)}`);
  h.spawnsOf('manual')[0].release();
  await withTimeout(manual.done, 3000, 'the manual sync');
}, { timeoutMs: 30000 });

test('R9: a preset that finds the slot busy runs once the manual sync ends, within a poll (time dilated ×60)', async () => {
  const h0 = harness();
  const seq = SEQ + 1;
  const h = harness({ presets: [h0.preset('alpha', { relay: `wss://t${seq}-alpha.example` })] });
  h.presetsModule();
  fake.on(h.relay('manual'), { mode: 'hold' });
  const manual = h.oneShot('manual');
  await until(() => h.spawnsOf('manual').length === 1, 2000, 'the manual sync to start');
  clock.dilate(60);
  const run = h.begin('POST', `${BASE}/run`);
  await sleep(200); // ≈ 12 s dilated: a few polls
  eq(h.spawnsOf('alpha').length, 0, 'preset syncs while the manual sync holds the slot');
  h.spawnsOf('manual')[0].release();
  const res = await withTimeout(run.done, 10000, 'the run');
  clock.normal();
  await withTimeout(manual.done, 3000, 'the manual sync');
  const body = okRun(res, 'the run');
  const a = h.spawnsOf('alpha');
  eq(a.length, 1, 'syncs of alpha after the manual sync ended');
  assert(a[0].startTick > h.spawnsOf('manual')[0].closeTick, 'alpha must start after the manual sync ended');
  assert(body.results[0] && body.results[0].ok === true && !body.results[0].skipped, `alpha must run and succeed; got ${show(body.results[0])}`);
}, { timeoutMs: 30000 });

test('R10: a preset deleted while the run is going is dropped: the delete answers during the sync, the preset is not written back, and the others are recorded', async () => {
  const h0 = harness();
  const seq = SEQ + 1;
  const a = h0.preset('alpha', { relay: `wss://t${seq}-alpha.example` });
  const b = h0.preset('bravo', { relay: `wss://t${seq}-bravo.example` });
  const h = harness({ presets: [a, b] });
  h.presetsModule();
  fake.on(h.relay('alpha'), { mode: 'hold', out: OUT.down12, code: 0 });
  const run = h.begin('POST', `${BASE}/run`);
  await until(() => h.spawnsOf('alpha').length === 1, 3000, 'the run to start alpha');
  const del = await h.req('POST', `${BASE}/delete`, { id: a.id }, 'local', 2000);
  assert(del.body && del.body.success === true, `the delete must answer during the sync; got ${show(del.body)}`);
  h.spawnsOf('alpha')[0].release();
  okRun(await withTimeout(run.done, 5000, 'the run'), 'the run');
  const list = await h.list();
  eq(list.map((p) => p.id), [b.id], 'presets after the run (alpha stays deleted)');
  assert(list[0].lastRun && list[0].lastRun.ok === true, `bravo must be recorded; got ${show(list[0])}`);
  assert(!h.fileJson().presets.some((p) => p.id === a.id), 'the deleted preset must not be written back to the file');
});

test('R11: a strfry sync that hangs is killed after 10 minutes and recorded as failed, and the next preset still runs (time dilated ×600)', async () => {
  const h0 = harness();
  const seq = SEQ + 1;
  const h = harness({ presets: [h0.preset('alpha', { relay: `wss://t${seq}-alpha.example` }), h0.preset('bravo', { relay: `wss://t${seq}-bravo.example` })] });
  h.presetsModule();
  fake.on(h.relay('alpha'), { mode: 'hold' }); // never exits unless killed
  fake.on(h.relay('bravo'), { out: OUT.down12, code: 0 });
  clock.dilate(600);
  const t0 = Date.now();
  const res = await h.run(15000);
  const took = Date.now() - t0;
  clock.normal();
  const body = okRun(res, 'a run with a hung sync');
  const a = h.spawnsOf('alpha')[0];
  assert(a && a.killedWith, 'the hung strfry must be killed');
  assert(took >= 570000, `the kill must come after about 10 minutes; it came after ${Math.round(took / 1000)} s (dilated)`);
  const ra = body.results.find((x) => x.name === 'alpha');
  assert(ra && ra.ok === false && typeof ra.error === 'string' && ra.error.length > 0, `alpha must be recorded failed with an error; got ${show(ra)}`);
  const rb = body.results.find((x) => x.name === 'bravo');
  assert(rb && rb.ok === true, `bravo must still run; got ${show(rb)}`);
  eq(body.failed, 1, 'failed');
}, { timeoutMs: 30000 });

test('R12: with no switched-on presets a run does nothing and succeeds: results [] and failed 0', async () => {
  const h0 = harness();
  const seq = SEQ + 1;
  const h = harness({ presets: [h0.preset('alpha', { relay: `wss://t${seq}-alpha.example`, enabled: false })] });
  h.presetsModule();
  const body = okRun(await h.run(), 'a run with nothing switched on');
  eq({ results: body.results, failed: body.failed }, { results: [], failed: 0 }, 'the run result');
  eq(h.spawns().length, 0, 'strfry runs');
});

// ═══ T: the scheduled task ══════════════════════════════════════════════════════════
function registry() { return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8')); }
function taskEntry() {
  const t = registry().tasks[TASK];
  assert(t && typeof t === 'object', NOT_IMPL(`taskRegistry.json must have tasks.${TASK}`));
  return t;
}

test('T1: the registry offers syncNegentropyPresets — "Sync Negentropy Presets", network, system, periodic, structured logging, suggested every 6 hours — with its script and a log-file mapping (AC-3, product decision 2)', () => {
  const t = taskEntry();
  const SCRIPT_VAR = '$BRAINSTORM_MODULE_SRC_DIR/manage/negentropySync/syncPresets.sh';
  eq({ name: t.name, categories: t.categories, script: t.script, scripts: t.scripts, script_relative_path: t.script_relative_path, arguments: t.arguments, scope: t.scope, priority: t.priority, frequency: t.frequency, status: t.status, structuredLogging: t.structuredLogging, suggestedIntervalHours: t.suggestedIntervalHours },
    { name: 'Sync Negentropy Presets', categories: ['network'], script: SCRIPT_VAR, scripts: [SCRIPT_VAR], script_relative_path: 'manage/negentropySync/syncPresets.sh', arguments: false, scope: 'system', priority: 'normal', frequency: 'periodic', status: 'active', structuredLogging: true, suggestedIntervalHours: 6 },
    `the tasks.${TASK} entry`);
  assert(typeof t.description === 'string' && t.description.includes('relay-stream-gaps/0003'), `the description must name ADR relay-stream-gaps/0003; got ${show(t.description)}`);
  const logs = (registry().monitoring || {}).logFiles || {};
  assert(typeof logs[TASK] === 'string' && /\.log$/.test(logs[TASK]), `monitoring.logFiles must map ${TASK} to a .log file, like syncWoT and syncProfiles; got ${show(logs[TASK])}`);
});

test('T2: the task script exists where the registry points, parses with bash -n, and POSTs the run endpoint over loopback with a curl timeout of at least 6 hours, parsing the answer with node -e (no jq)', () => {
  assert(fs.existsSync(SCRIPT), NOT_IMPL('src/manage/negentropySync/syncPresets.sh must exist'));
  const syntax = cp.spawnSync('bash', ['-n', SCRIPT], { encoding: 'utf8', timeout: 5000 });
  assert(syntax.status === 0, `bash -n must accept the script: ${syntax.stderr}`);
  const code = codeOnly(fs.readFileSync(SCRIPT, 'utf8').replace(/\\\n/g, ' ')); // continuation lines joined
  assert(/http:\/\/127\.0\.0\.1:\$\{CONTROL_PANEL_PORT:-7778\}\/api\/strfry\/negentropy-presets\/run/.test(code) || (/127\.0\.0\.1/.test(code) && /CONTROL_PANEL_PORT:-7778/.test(code) && /\/api\/strfry\/negentropy-presets\/run/.test(code)),
    'the script must call http://127.0.0.1:${CONTROL_PANEL_PORT:-7778}/api/strfry/negentropy-presets/run.');
  const curls = code.split('\n').filter((l) => /\bcurl\b/.test(l));
  const curl = curls.find((l) => /negentropy-presets\/run/.test(l)) || curls.find((l) => /(-m|--max-time)\s+\d/.test(l)) || curls[0] || '';
  assert(/-X\s*POST|--request\s+POST/.test(curl), `the curl call must POST; got ${show(curl.trim())}`);
  const m = /(?:-m|--max-time)\s+(\d+)/.exec(curl);
  assert(m && Number(m[1]) >= 21600, `the curl call must allow at least 6 hours (-m 21600); got ${show(curl.trim())}`);
  assert(/\bnode\s+-[ep]\b/.test(code), 'the script must parse the JSON answer with node -e.');
  assert(!/\bjq\b/.test(code), 'the script must not depend on jq.');
});

// The task script, run for real against a stub control panel on 127.0.0.1.
const FAKE_LOGGING = [
  '# Test double for src/utils/structuredLogging.sh (test/negentropy-sync-presets.test.js).',
  "emit_task_event() { printf '%s\\x1f%s\\x1f%s\\x1f%s\\x1e' \"$1\" \"$2\" \"$3\" \"$4\" >> \"$FAKE_TASK_EVENTS\"; }",
  'log_structured() { :; }', 'log_debug() { :; }', 'log_info() { :; }', 'log_warn() { :; }', 'log_error() { :; }',
  'start_task_timer() { :; }', 'end_task_timer() { :; }', 'ensure_logging_dirs() { :; }', 'legacy_log_with_event() { :; }',
  'get_iso_timestamp() { date -Iseconds; }', '',
].join('\n');
function parseEvents(text) {
  return text.split('\x1e').filter((r) => r.length > 0).map((r) => {
    const [type, task, target, meta] = r.split('\x1f');
    let failure;
    try { failure = JSON.parse(meta).failure; } catch { const m = /"failure"\s*:\s*(true|false)/.exec(meta || ''); failure = m ? m[1] === 'true' : undefined; }
    return { type, task, target, meta: meta || '', failure };
  });
}
const reply = (status, body) => (req, res) => {
  res.setHeader('Connection', 'close');
  if (body === null) { res.writeHead(status); res.end(); return; }
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};
async function runTaskScript(respond, { listen = true } = {}) {
  if (fs.existsSync('/etc/brainstorm.conf')) throw new Skip('/etc/brainstorm.conf exists on this host; the script sources it, which could point it at a real control panel');
  if (cp.spawnSync('curl', ['--version'], { timeout: 5000 }).status !== 0) throw new Skip('curl is not installed on this host');
  assert(fs.existsSync(SCRIPT), NOT_IMPL('src/manage/negentropySync/syncPresets.sh must exist'));
  const dir = fs.mkdtempSync(path.join(TMP, 'script-'));
  const base = path.join(dir, 'module');
  fs.mkdirSync(path.join(base, 'src/utils'), { recursive: true });
  fs.writeFileSync(path.join(base, 'src/utils/structuredLogging.sh'), FAKE_LOGGING);
  const eventsFile = path.join(dir, 'events');
  fs.writeFileSync(eventsFile, '');
  fs.mkdirSync(path.join(dir, 'log'));
  const requests = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => { requests.push({ method: req.method, url: req.url, headers: req.headers, body }); respond(req, res); });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  let open = true;
  const closeServer = () => new Promise((r) => { if (!open) return r(); open = false; if (server.closeAllConnections) server.closeAllConnections(); server.close(() => r()); });
  if (!listen) await closeServer();
  try {
    const env = {
      PATH: `${path.dirname(process.execPath)}:${process.env.PATH || '/usr/local/bin:/usr/bin:/bin'}`,
      HOME: dir,
      CONTROL_PANEL_PORT: String(port),
      BRAINSTORM_MODULE_BASE_DIR: base,
      BRAINSTORM_MODULE_SRC_DIR: path.join(base, 'src'),
      BRAINSTORM_LOG_DIR: path.join(dir, 'log'),
      FAKE_TASK_EVENTS: eventsFile,
    };
    const child = REAL.spawn('bash', [SCRIPT], { cwd: dir, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    const code = await new Promise((resolve) => {
      const t = REAL.setTimeout(() => { child.kill('SIGKILL'); resolve('timeout'); }, 20000);
      child.on('close', (c) => { REAL.clearTimeout(t); resolve(c); });
    });
    return { code, stdout, stderr, requests, events: parseEvents(fs.readFileSync(eventsFile, 'utf8')) };
  } finally {
    await closeServer();
  }
}
function assertTaskEvents(r, failure, what) {
  const ev = r.events;
  const tail = `\n        events: ${show(ev.map((e) => [e.type, e.task, e.meta]))}\n        stderr: ${show(r.stderr.slice(-400))}`;
  assert(ev.length >= 2 && ev[0].type === 'TASK_START' && ev[0].task === TASK, `${what}: the first task event must be TASK_START for ${TASK}.${tail}`);
  const end = ev[ev.length - 1];
  assert(end.type === 'TASK_END' && end.task === TASK, `${what}: the last task event must be TASK_END for ${TASK}.${tail}`);
  assert(end.failure === failure, `${what}: TASK_END must carry failure: ${failure}.${tail}`);
}

test('T3: the task script exits 0 when the run succeeded with no failed preset, after one loopback POST to the run endpoint, emitting TASK_START then TASK_END { failure: false } (AC-3)', async () => {
  const r = await runTaskScript(reply(200, { success: true, results: [{ id: 'x', name: 'alpha', ok: true, added: 12, sent: 0 }], failed: 0 }));
  eq(r.code, 0, `the exit code (stderr: ${r.stderr.slice(-300)})`);
  eq(r.requests.map((q) => [q.method, q.url]), [['POST', `${BASE}/run`]], 'the requests the control panel received');
  assert(!r.requests[0].headers['x-forwarded-for'] && !r.requests[0].headers['x-real-ip'], 'the call must be direct loopback (no proxy headers), so the control panel trusts it as local');
  assertTaskEvents(r, false, 'a clean run');
}, { timeoutMs: 30000 });

test('T4: the task script exits 1 when any preset failed, with TASK_END { failure: true }, so the panel\'s history shows the run failed (ADR § Consequences)', async () => {
  const r = await runTaskScript(reply(200, { success: true, results: [{ id: 'x', name: 'alpha', ok: false, error: 'Websocket connection error' }, { id: 'y', name: 'bravo', ok: true }], failed: 1 }));
  eq(r.code, 1, 'the exit code');
  assertTaskEvents(r, true, 'a run with a failed preset');
}, { timeoutMs: 30000 });

test('T5: when a run is already going (409 alreadyRunning) the task script exits 0 with a WARN giving that reason, so a slow run is never doubled or counted a failure (AC-3)', async () => {
  const r = await runTaskScript(reply(409, { success: false, alreadyRunning: true }));
  eq(r.code, 0, `the exit code (stderr: ${r.stderr.slice(-300)})`);
  const warn = r.events.find((e) => e.type === 'WARN');
  assert(warn && warn.task === TASK && /already\s*running/i.test(warn.meta), `a WARN for ${TASK} must give the alreadyRunning reason; events: ${show(r.events.map((e) => [e.type, e.meta]))}`);
  assertTaskEvents(r, false, 'an overlapping trigger');
}, { timeoutMs: 30000 });

test('T6: the task script exits 1 with TASK_END { failure: true } on an empty answer, a control panel that is down, a non-2xx status, or an answer that is not JSON', async () => {
  const cases = [
    ['an empty 200 answer', reply(200, null), {}],
    ['no control panel listening', reply(200, { success: true, results: [], failed: 0 }), { listen: false }],
    ['a 500 answer', reply(500, { success: false, error: 'boom' }), {}],
    ['a 403 answer', reply(403, { success: false, error: 'owner authentication required' }), {}],
    ['a 200 answer that is not JSON', reply(200, '<html>Bad Gateway</html>'), {}],
  ];
  for (const [what, respond, opts] of cases) {
    const r = await runTaskScript(respond, opts);
    eq(r.code, 1, `${what}: the exit code`);
    assertTaskEvents(r, true, what);
  }
}, { timeoutMs: 60000 });

function freshInstallSeeds() {
  const dir = fs.mkdtempSync(path.join(TMP, 'seeds-'));
  const code = [
    `const m = require(${JSON.stringify(SCHED_TASKS)});`,
    'const cfg = m.readConfig();',
    `const reg = JSON.parse(require('fs').readFileSync(${JSON.stringify(REGISTRY_PATH)}, 'utf8'));`,
    'const listed = m.filterSchedulableTasks(reg);',
    "process.stdout.write('\\n@@SEEDS@@' + JSON.stringify({ entries: cfg.entries, listed }));",
  ].join('\n');
  const r = cp.spawnSync(process.execPath, ['-e', code], {
    cwd: ROOT, encoding: 'utf8', timeout: 30000,
    env: { ...process.env, SCHEDULED_TASKS_CONFIG_PATH: path.join(dir, 'scheduled-tasks.json') },
  });
  const out = r.stdout || '';
  const at = out.lastIndexOf('@@SEEDS@@');
  if (r.status !== 0 || at < 0) throw new Error(`could not read the fresh-install schedule (exit ${r.status}): ${(r.stderr || '').slice(-400)}`);
  return JSON.parse(out.slice(at + '@@SEEDS@@'.length));
}

test('T7: a fresh install seeds the task switched off at every 6 hours, after the existing seeds, valid as shipped and once switched on; existing instances get no seed (product decision 2)', () => {
  const { entries } = freshInstallSeeds();
  const ids = entries.map((e) => e.id);
  const i = ids.indexOf(`seed:${TASK}`);
  assert(i >= 0, NOT_IMPL(`the fresh-install seeds are ${show(ids)}; expected one with id "seed:${TASK}"`));
  const s = entries[i];
  eq({ taskId: s.taskId, enabled: s.enabled, intervalDays: s.intervalDays, intervalHours: s.intervalHours, intervalMinutes: s.intervalMinutes, cron: s.cron },
    { taskId: TASK, enabled: false, intervalDays: 0, intervalHours: 6, intervalMinutes: 0, cron: '' }, `the seed:${TASK} entry`);
  for (const old of ['seed:refreshPinnedTagTLs', 'seed:refreshApplicabilityLists', 'seed:reconcileTaggingEdges']) {
    assert(ids.indexOf(old) !== -1 && ids.indexOf(old) < i, `${old} must stay, ahead of the new seed; seeds are ${show(ids)}`);
  }
  const { validateEntry } = require(SCHED_VALIDATION);
  const reg = registry();
  const shipped = validateEntry(s, reg);
  assert(shipped.ok, `validateEntry must accept the seed as shipped; got ${show(shipped.errors)}`);
  const on = validateEntry({ ...s, enabled: true }, reg);
  assert(on.ok, `validateEntry must accept the seed switched on; got ${show(on.errors)}`);
  const src = codeOnly(safeRead(SCHED_TASKS));
  assert(/!fileExisted/.test(src), 'seeds must still be added only when the schedule file does not exist yet (existing instances get none).');
});

test('T8: the Add dialog\'s task list passes suggestedIntervalHours through when it is a positive integer, and offers syncNegentropyPresets with 6', () => {
  const { filterSchedulableTasks } = require(SCHED_TASKS);
  const synthetic = { tasks: {
    six: { name: 'Six', frequency: 'periodic', suggestedIntervalHours: 6 },
    zero: { name: 'Zero', frequency: 'periodic', suggestedIntervalHours: 0 },
    negative: { name: 'Negative', frequency: 'periodic', suggestedIntervalHours: -1 },
    fraction: { name: 'Fraction', frequency: 'periodic', suggestedIntervalHours: 2.5 },
    text: { name: 'Text', frequency: 'periodic', suggestedIntervalHours: '6' },
    none: { name: 'None', frequency: 'periodic' },
  } };
  const out = Object.fromEntries(filterSchedulableTasks(synthetic).map((t) => [t.taskId, t]));
  eq(out.six && out.six.suggestedIntervalHours, 6, 'a positive integer hint is passed through');
  for (const k of ['zero', 'negative', 'fraction', 'text', 'none']) {
    assert(out[k] && out[k].suggestedIntervalHours == null, `${k}: a hint that is not a positive integer must not be passed through; got ${show(out[k] && out[k].suggestedIntervalHours)}`);
  }
  const real = filterSchedulableTasks(registry()).find((t) => t.taskId === TASK);
  assert(real, NOT_IMPL(`the Add dialog's task list must offer ${TASK}`));
  eq(real.suggestedIntervalHours, 6, `${TASK}'s suggested interval in the Add dialog's list`);
});

test('T9: the Add dialog pre-fills 0 days, <suggestedIntervalHours> hours, 0 minutes when a NEW entry picks a task with a hint; editing is unchanged (source)', () => {
  const src = safeRead(MODAL);
  const i = src.indexOf('suggestedIntervalHours');
  assert(i !== -1, NOT_IMPL('AddOrEditEntryModal.jsx must read the task\'s suggestedIntervalHours'));
  const eff = src.lastIndexOf('useEffect(', i);
  const effEnd = eff === -1 ? -1 : src.indexOf('}, [', eff);
  let block;
  if (eff !== -1 && effEnd > i) {
    block = src.slice(eff, effEnd);
    assert(/isEdit/.test(block), 'the effect that pre-fills from suggestedIntervalHours must leave editing alone (check isEdit, as the arguments pre-fill does).');
  } else {
    const oc = src.lastIndexOf('onChange', i);
    assert(oc !== -1 && i - oc < 800, 'the pre-fill must run when a new entry picks its task: in the task-selection effect (guarded by isEdit) or in the task picker\'s onChange (disabled while editing).');
    block = src.slice(oc, i + 600);
  }
  assert(/setIntervalHours\(/.test(block) && /setIntervalDays\(\s*0\s*\)/.test(block) && /setIntervalMinutes\(\s*0\s*\)/.test(block),
    'the pre-fill must set days 0, hours <suggestedIntervalHours> and minutes 0.');
  assert(/useState\(\s*entry\?\.intervalHours\s*\?\?\s*24\s*\)/.test(src), 'the 24-hour default for tasks without a hint must stay.');
});

// ═══ U: the Negentropy Sync tab (source; house style: region-scoped, visible text) ═══
/** NegentropySync, any RelaySettings.jsx top-level declaration whose name contains preset or negentropy (any case), and any local module it imports whose file name does. */
function presetUiScope() {
  const src = safeRead(RELAY_SETTINGS);
  assert(src.includes('function NegentropySync('), 'NegentropySync is missing from RelaySettings.jsx; unexpected.');
  const decls = [];
  const re = /\n(?:export\s+(?:default\s+)?)?(?:function\s+([A-Za-z0-9_]+)\s*\(|(?:const|let)\s+([A-Za-z0-9_]+)\s*=)/g;
  let m;
  while ((m = re.exec(src))) decls.push({ name: m[1] || m[2], at: m.index + 1 });
  const parts = [];
  decls.forEach((d, k) => {
    if (d.name === 'NegentropySync' || /preset|negentropy/i.test(d.name)) {
      parts.push(src.slice(d.at, k + 1 < decls.length ? decls[k + 1].at : src.length));
    }
  });
  const imp = /import\s+[^;]*?from\s+['"](\.{1,2}\/[^'"]+)['"]/g;
  while ((m = imp.exec(src))) {
    if (!/negentropy|preset/i.test(path.basename(m[1]))) continue;
    const baseP = path.resolve(path.dirname(RELAY_SETTINGS), m[1]);
    for (const cand of [baseP, `${baseP}.jsx`, `${baseP}.js`, path.join(baseP, 'index.jsx'), path.join(baseP, 'index.js')]) {
      if (fs.existsSync(cand) && fs.statSync(cand).isFile()) { parts.push(fs.readFileSync(cand, 'utf8')); break; }
    }
  }
  return parts.join('\n');
}
function norm(s) {
  return s.replace(/&quot;|[“”]/g, '"').replace(/&apos;|&#39;|[‘’]/g, "'").replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\.\.\./g, '…');
}
/** Visible text of a JSX fragment: {' '} → space, tags dropped, whitespace collapsed. */
function jsxText(s) {
  return s.replace(/\{\s*(['"`])\s+\1\s*\}/g, ' ').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
const visible = (s) => norm(jsxText(s));
const EXPR = '(?:\\$?\\{[^{}]+\\})';

test('U1: the tab can save the form as a named preset: a "Save as preset" button that can be disabled, a name input, and a `Replace preset "<name>"?` confirm for an existing name (AC-1)', () => {
  const scope = presetUiScope();
  const text = visible(scope);
  assert(text.includes('Save as preset'), NOT_IMPL('the Negentropy Sync tab must offer "Save as preset"'));
  const at = scope.indexOf('Save as preset');
  const btn = scope.lastIndexOf('<button', at);
  assert(btn !== -1 && /disabled=\{/.test(scope.slice(btn, at)), 'the "Save as preset" button must be disabled until the relay is valid and the floor is met (disabled={…}).');
  assert(/<input\b/.test(scope.slice(Math.max(0, at - 2500), at + 2500)), 'a name input must sit with the "Save as preset" button.');
  assert(new RegExp(`Replace preset "${EXPR}"\\?`).test(norm(scope)), 'saving under an existing name must ask `Replace preset "${name}"?`.');
});

test('U2: when the form has no kinds, authors or tag filter the tab says why, with the floor message (AC-2)', () => {
  assert(visible(presetUiScope()).includes(FLOOR), NOT_IMPL(`the tab must show "${FLOOR}" inline`));
});

test('U3: the "Saved presets" list gives each preset an on/off ToggleSwitch, Load and Delete (with a confirm), backed by the presets endpoints (AC-1)', () => {
  const scope = presetUiScope();
  assert(visible(scope).includes('Saved presets'), NOT_IMPL('the tab must list "Saved presets"'));
  assert(/<ToggleSwitch\b/.test(scope), 'each saved preset must have a <ToggleSwitch> (the existing component).');
  assert(/>[^<>{}]*\bLoad\s*</.test(scope), 'each saved preset must have a Load button.');
  assert(/>[^<>{}]*\bDelete\s*</.test(scope), 'each saved preset must have a Delete button.');
  const confirms = scope.match(/confirm\(\s*(`[^`]*`|'[^']*'|"[^"]*")/g) || [];
  assert(confirms.some((c) => /delete/i.test(c)), `Delete must ask for confirmation; confirms found: ${show(confirms)}`);
  assert(scope.includes(BASE), `the tab must call ${BASE} (list and save).`);
  for (const p of ['/toggle', '/delete']) assert(scope.includes(p), `the tab must call ${BASE}${p}.`);
});

test('U4: Load fills relay, direction, kinds, authors and tag filters and clears Since/Until (AC-1, product decision 1)', () => {
  const scope = presetUiScope();
  for (const call of ['setSince(null)', 'setUntil(null)', 'setTagFilters(', 'setDir(', 'setAuthors(']) {
    assert(scope.replace(/\s+/g, '').includes(call.replace(/\s+/g, '')), NOT_IMPL(`Load must call ${call}`));
  }
});

test('U5: each preset shows its last scheduled run: "Not run yet", "Last run <time>: ✓ <added> in, <sent> out", "✗ <error>" or "skipped: <reason>" (AC-4)', () => {
  const s = norm(presetUiScope());
  assert(/Not run yet/.test(s), NOT_IMPL('a preset that never ran must say "Not run yet"'));
  assert(new RegExp(`Last run\\s*${EXPR}\\s*:`).test(s), 'the last-run line must start "Last run <time>:".');
  assert(new RegExp(`✓\\s*${EXPR}\\s*in\\b[\\s\\S]{0,200}?${EXPR}\\s*out\\b`).test(s), 'a success must read "✓ <added> in, <sent> out".');
  assert(new RegExp(`✗\\s*${EXPR}`).test(s), 'a failure must read "✗ <error>".');
  assert(new RegExp(`skipped:\\s*${EXPR}`).test(s), 'a skipped run must read "skipped: <reason>".');
});

test('U6: the tab explains the schedule in the ADR\'s words: the "Sync Negentropy Presets" task, off until turned on, since the last success less an hour, 7 days first, Load + Start for a full sync (AC-3, product decisions 1–2)', () => {
  const text = visible(presetUiScope());
  for (const sentence of [
    'Switched-on presets run with the "Sync Negentropy Presets" task in Scheduled Tasks (off until you turn it on).',
    "Each run covers events since that preset's last successful run, less an hour; the first run covers the last 7 days.",
    'Load a preset and press Start for a one-off full sync.',
  ]) {
    assert(text.includes(sentence), NOT_IMPL(`the explainer must say: ${sentence}`));
  }
});

test('U7: while a scheduled preset holds the slot, the status line reads `Scheduled preset "<name>" is syncing…` (ADR § Consequences)', () => {
  assert(new RegExp(`Scheduled preset "\\s*${EXPR}\\s*" is syncing…`).test(norm(presetUiScope())), NOT_IMPL('the status line must read `Scheduled preset "<name>" is syncing…`'));
});

// ═══ D: docs and wiring ═══════════════════════════════════════════════════════════════
test('D1: the BIBLE strfry API table lists the five presets endpoints, and says the POSTs are owner or local only', () => {
  const src = safeRead(BIBLE);
  const anchor = src.indexOf('| POST | `/api/strfry/negentropy-sync` |');
  assert(anchor !== -1, 'the BIBLE row for /api/strfry/negentropy-sync is missing; unexpected.');
  const start = src.lastIndexOf('\n\n', anchor);
  const end = src.indexOf('\n\n', anchor);
  const table = src.slice(start, end === -1 ? src.length : end);
  const rows = [['GET', BASE], ['POST', BASE], ['POST', `${BASE}/toggle`], ['POST', `${BASE}/delete`], ['POST', `${BASE}/run`]];
  const found = rows.map(([m, p]) => table.split('\n').find((l) => new RegExp(`^\\|\\s*${m}\\s*\\|\\s*\`${p.replace(/[/-]/g, '\\$&')}\`\\s*\\|`).test(l)));
  rows.forEach(([m, p], k) => assert(found[k], NOT_IMPL(`the BIBLE strfry API table must have a "| ${m} | \`${p}\` |" row`)));
  assert(found.slice(1).some((l) => /owner/i.test(l)), 'the presets POST rows must say they are owner (or local) only.');
});

test('D2: docs/CONFIGURATION.md lists /var/lib/brainstorm/negentropy-presets.json in a file table', () => {
  const src = safeRead(CONFIGURATION_DOC);
  assert(src.split('\n').some((l) => /^\|\s*`\/var\/lib\/brainstorm\/negentropy-presets\.json`\s*\|/.test(l)), NOT_IMPL('CONFIGURATION.md must have a "| `/var/lib/brainstorm/negentropy-presets.json` |" row'));
});

test('D3: src/api/index.js registers the presets routes next to the one-shot sync routes', () => {
  const code = codeOnly(safeRead(API_INDEX));
  const one = code.indexOf('registerNegentropySyncRoutes(app)');
  assert(one !== -1, 'registerNegentropySyncRoutes(app) is missing from src/api/index.js; unexpected.');
  assert(/require\(\s*['"]\.\/strfry\/negentropyPresets['"]\s*\)/.test(code), NOT_IMPL("src/api/index.js must require('./strfry/negentropyPresets')"));
  const two = code.indexOf('registerNegentropyPresetRoutes(app)');
  assert(two !== -1 && Math.abs(two - one) < 600, NOT_IMPL('src/api/index.js must call registerNegentropyPresetRoutes(app) next to registerNegentropySyncRoutes(app)'));
});

// ═══ G: guards, behavior the ADR keeps unchanged (pass before and after) ═══════════════
test('G1: the one-shot POST /api/strfry/negentropy-sync still runs `strfry sync <relay> --filter <json> --dir down`, answers with the output and exit code, and refuses a second start while one runs', async () => {
  const h = harness();
  fake.on(h.relay('g1'), { out: OUT.down12, code: 0 });
  const res = await h.req('POST', ONE_SHOT, { relay: h.relay('g1'), dir: 'down', filter: { kinds: [1] } }, 'local', 3000);
  assert(res.body && res.body.success === true && res.body.exitCode === 0 && res.body.output.includes('Set reconcile complete. Have 0 need 12'), `the one-shot answer: ${show(res.body)}`);
  eq(h.spawnsOf('g1').map((e) => e.args), [['sync', h.relay('g1'), '--filter', '{"kinds":[1]}', '--dir', 'down']], 'the one-shot argv');
  fake.on(h.relay('g1b'), { mode: 'hold' });
  const held = h.begin('POST', ONE_SHOT, { relay: h.relay('g1b'), dir: 'down', filter: { kinds: [1] } });
  await until(() => h.spawnsOf('g1b').length === 1, 2000, 'the held one-shot');
  const second = await h.req('POST', ONE_SHOT, { relay: h.relay('g1c'), dir: 'down', filter: { kinds: [1] } }, 'local', 3000);
  eq({ success: second.body.success, error: second.body.error }, { success: false, error: 'A sync is already in progress' }, 'a second one-shot start');
  h.spawnsOf('g1b')[0].release();
  await withTimeout(held.done, 3000, 'the held one-shot');
});

test('G2: the existing fresh-install seeds keep their order (refreshPinnedTagTLs, refreshApplicabilityLists, reconcileTaggingEdges)', () => {
  const ids = freshInstallSeeds().entries.map((e) => e.id);
  eq(ids.slice(0, 3), ['seed:refreshPinnedTagTLs', 'seed:refreshApplicabilityLists', 'seed:reconcileTaggingEdges'], 'the first three seeds');
});

test('G3: the fixed syncWoT and syncProfiles tasks are unchanged (story: out of scope)', () => {
  const r = registry();
  for (const id of ['syncWoT', 'syncProfiles']) {
    const t = r.tasks[id];
    eq({ script: t.script, frequency: t.frequency, scope: t.scope, priority: t.priority }, { script: `$BRAINSTORM_MODULE_SRC_DIR/manage/negentropySync/${id}.sh`, frequency: 'daily', scope: 'system', priority: 'high' }, `the ${id} entry`);
  }
});

// ── runner ──────────────────────────────────────────────────────────────────────────────
async function run() {
  console.log('\n--- negentropy sync presets tests (relay-stream-gaps #3) ---');
  let pass = 0;
  let fail = 0;
  let skipped = 0;
  const failures = [];
  const hadEnv = Object.prototype.hasOwnProperty.call(process.env, 'NEGENTROPY_PRESETS_PATH');
  const savedEnv = process.env.NEGENTROPY_PRESETS_PATH;
  REAL.spawn = cp.spawn;
  TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'negentropy-presets-'));
  let restoreAuth = null;
  try {
    cp.spawn = fakeSpawn;
    clock.install();
    restoreAuth = installAuthStub();
    for (const [name, fn, opts] of tests) {
      try {
        await withTimeout(Promise.resolve().then(fn), opts.timeoutMs || 10000, 'the test');
        console.log(`  PASS  ${name}`);
        pass++;
      } catch (err) {
        if (err instanceof Skip) {
          console.log(`  SKIP  ${name}\n        ${err.message}`);
          skipped++;
        } else {
          console.log(`  FAIL  ${name}\n        ${err && err.message}`);
          failures.push({ name, message: err && err.message });
          fail++;
        }
      } finally {
        clock.normal();
        // A test that left strfry children open (it failed mid-way) gets a moment for its stragglers to settle.
        await sleep(fake.releaseAll() > 0 ? 150 : 5);
      }
    }
  } finally {
    fake.releaseAll();
    await sleep(50);
    clock.uninstall();
    cp.spawn = REAL.spawn;
    if (restoreAuth) restoreAuth();
    if (hadEnv) process.env.NEGENTROPY_PRESETS_PATH = savedEnv; else delete process.env.NEGENTROPY_PRESETS_PATH;
    dropModules();
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* best effort */ }
  }
  console.log(`\nnegentropy-sync-presets: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped, failures };
}

if (require.main === module) {
  // Standalone only: exit once the summary is printed, so timers a broken runner left behind can't keep the process alive.
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
