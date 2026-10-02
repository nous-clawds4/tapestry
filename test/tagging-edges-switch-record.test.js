'use strict';
/**
 * Tests for Story 5 (epic tagging-edges) — the real-time path's switch: who may change it, the record of who did, and
 * the gated read of that record.
 *
 * Story: engineering-team/stories/tagging-edges/5-real-time-path-switch.md — AC-4 (who may switch: a signed-in owner or
 *        admin, enforced by the server; every refused caller changes and records nothing; last change wins; a failed
 *        on changes nothing; an off still takes effect when it cannot be recorded), AC-5 (who did it: role, a
 *        shortened key and when; the unrecorded off; the last 10 changes, newest first; the never-switched state; the
 *        change made before story 5 as the owner's; only a signed-in owner or admin reads who), the Test tasks
 *        "Server cases for AC-4" and "Server cases for AC-5", and the two residuals accepted at Architecture.
 * ADR:   engineering-team/decisions/tagging-edges/0005-real-time-path-switch.md — D1 (switch.json version 2 and
 *        switch-history.json), D2 (write order and the failure matrix), D3 (switchEntry, switchRecord, foldHistory), D4
 *        (onSince), D5 (who may switch; ownerOrAdmin), D6 (GET on the switch path), D9 (concurrent changes), D10 (the
 *        pre-story-5 record), D11 (the POST's answers), § Consequences (residuals (a) and (b)) and § Seams for Test
 *        Design ("switchEntry, switchRecord and foldHistory", "The handler's dependencies", "Concurrency",
 *        "handleRealtimeSwitchRecord", "ownerOrAdmin").
 *
 * Intentionally failing until the implementation lands (red phase): src/api/tagging-edges/realtime.js does not export
 * switchEntry, switchRecord, foldHistory or handleRealtimeSwitchRecord yet, src/api/tagging-edges/index.js does not
 * export ownerOrAdmin, and today's handleRealtimeSwitch is owner-only, writes version 1 and keeps no history. Every
 * module is require()d lazily inside each test through helpers that name what is missing, so this suite always loads
 * and every test fails on the behaviour it pins, never on an import.
 *
 * Classes (all SR):
 *   SR1        the exports.
 *   SR2–SR13   the pure record (D3): switchEntry, switchRecord in each of its four states, the valid-entry rule,
 *              dedupe, the cap at 10, and foldHistory.
 *   SR14–SR30  POST /api/tagging-edges/realtime/switch through handleRealtimeSwitch with injected dependencies: who may
 *              change it and what is recorded (D1, D4, D5, D11), the write order and failure matrix (D2) with spies
 *              that record the call order, the pre-story-5 change (D10), and residuals (a) and (b).
 *   SR31–SR34  refusals (D5) on both routes, refusals never joining the chain, and two changes at once (D9).
 *   SR35–SR40  GET on the switch path through handleRealtimeSwitchRecord (D6).
 *   SR41–SR45  ownerOrAdmin(req, d) (D5), called directly.
 *   SR46       no handler logs who (§ Consequences, D6), with console and process.stdout/stderr captured.
 *   SR47       AC-6, nothing else moves: a static pin on realtime.js's require()s, and the dependencies every admitted
 *              POST path may call (extends SR14 and SR31–SR33).
 *
 * Hermetic: every store-backed dependency is injected (readSwitch, readSwitchHistory, writeSwitchHistory, writeSwitch,
 * unlinkSwitch, readFile) over an in-memory pair of files. stateDir() is a temporary directory made by run(), and
 * TAGGING_EDGES_STATE_DIR points at it for the whole run (restored after), so the production directory
 * /var/lib/brainstorm/tagging-edges is never read or written (ADR 0005 § Seams, "Use the shared switchBundle"); every
 * handler call then checks that nothing appeared in it. process.kill is replaced by a recorder where a test checks that
 * no signal is sent, and the console and process.stdout/stderr writes by a capture where SR46 checks that nothing logs
 * who (each restored in finally). No graph, relay, network, task queue or host /proc. Fake 64-hex pubkeys only; f0178122 is D10's
 * 8-character prefix, as the ADR quotes it.
 *
 * Choices this suite makes where the ADR leaves a detail open (recorded for the owner in the Test Design return):
 *   - The injected readSwitch parses the in-memory switch.json with the store's real parseSwitch (ADR 0005 § Seams:
 *     "Parse it with the real parseSwitch"); a read error gives { unreadable: true, readError: code } (D1). The injected
 *     readSwitchHistory maps as D1 says the store does: missing → null, read error → { unreadable: true, readError },
 *     text that does not parse or whose changes is not an array → { unreadable: true }, else the parsed object as it
 *     is (invalid entries included; switchRecord keeps only the valid ones).
 *   - The fakes are synchronous, as the store's methods are (T26), and a failing one throws synchronously; only the
 *     concurrency and held-write tests use async writers (ADR 0005 § Seams: "with async fake writers").
 *   - "The pre-fold" is any writeSwitchHistory call made before writeSwitch in the same request, "the fold" any made
 *     after it; their arguments are compared exactly with D2's { version: 1, changes }.
 *   - A valid history entry (D1) is a recorded one (on a boolean, at an ISO time as Date#toISOString gives it, role
 *     'owner' or 'admin', key 8 lower-case hex digits) or an unrecorded one (on a boolean; at, role and key all null).
 *     Only clearly valid or clearly invalid values are used: no borderline ISO forms, no upper-case hex.
 *   - Refusal bodies are the drift route's, exactly (D5, D11: "Refusal bodies are the drift route's"); 415 and 400
 *     keep today's sentences (D5: "keeps 415 and 400").
 *   - The POST's 500 for a read error on prev pins its sentence (D11); a `code` member there is not required, but when
 *     present it must be the allow-listed code.
 *   - D6's "a throw outside the two file reads" is a stateDir() that throws: the path is built outside the reads, as
 *     the status route builds it (realtime.js:134).
 *   - ownerOrAdmin(req, d) is given d with ownerPubkey() and getAdminPubkeys() (drift.js's shape after withDeps), plus
 *     getOwnerPubkey as the same function, as the DR suite's bundle does.
 *
 * Review round 1 (engineering-team/reviews/tagging-edges/5-real-time-path-switch.md):
 *   - Blocking 1: SR34's case rows each name their own first status (status1), which the assertion reads. It is never
 *     derived from the expected body, which gate-result-record's C9 refuses in every test file (row 263).
 *   - Requested 12: SR4 gains two pins for readings the implementation already has, an off with no onSince and a
 *     version 1 record with role null, each a change not recorded.
 *
 * Hand-rolled in the project's existing test style — no new framework. Works on Node 16 and 22.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const F = require('./helpers/taggingEdgesFixtures');

const REPO = path.resolve(__dirname, '..');
const ROUTES_REL = 'src/api/tagging-edges/realtime.js';
const INDEX_REL = 'src/api/tagging-edges/index.js';
const STORE_REL = 'src/pipeline/tagging-edges/realtime/store.js';
const ROUTES_MOD = path.join(REPO, ROUTES_REL);
const INDEX_MOD = path.join(REPO, INDEX_REL);
const STORE_MOD = path.join(REPO, STORE_REL);
/**
 * Forgotten before every load, as the RR suite forgets them (strfryScanStrict.js with the library it re-exports from;
 * story 3's review, round 3, carry-forward C9).
 */
const FORGET = [
  STORE_MOD,
  ROUTES_MOD,
  INDEX_MOD,
  path.join(REPO, 'src/pipeline/tagging-edges/state.js'),
  path.join(REPO, 'src/lib/tagging-edges/realtime.js'),
  path.join(REPO, 'src/lib/strfryScanStrict.js'),
];

const { pubkeyOf } = F;
const OWNER = pubkeyOf('owner');
const ADMIN = pubkeyOf('admin');
const OTHER_ADMIN = pubkeyOf('other-admin');
const STRANGER = pubkeyOf('stranger');
const OK = OWNER.slice(0, 8);
const AK = ADMIN.slice(0, 8);
const HOST = 'tapestry.example';
const SWITCH_PATH = '/api/tagging-edges/realtime/switch';
const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const T0 = Date.UTC(2026, 9, 1, 14, 2, 0); // 2026-10-01T14:02:00Z
const ODD_CODE = 'neo4j.internal:7687';
/** Address text no answer may carry. */
const ADDRESS_NEEDLES = ['neo4j.internal', ':7687', '127.0.0.1', 'redis:6379', 'bolt://'];
/** D5: the drift route's refusal bodies; D5 also keeps the switch's 415 and 400. */
const ERR_401 = { success: false, error: 'Not authenticated' };
const ERR_403 = { success: false, error: 'Owner or admin access required' };
const ERR_XSITE = { success: false, error: 'cross-site request refused' };
const ERR_415 = { success: false, error: 'the body must be application/json' };
const ERR_400 = { success: false, error: 'the body must be {"on": true} or {"on": false}' };
/** D10: the local instance's switch.json, written by story 3's owner-only route. */
const V1_LOCAL_TEXT = '{"version":1,"on":false,"changedAt":"2026-09-29T17:43:18.937Z","changedBy":"f0178122"}\n';
const V1_ENTRY = Object.freeze({ on: false, at: '2026-09-29T17:43:18.937Z', role: 'owner', key: 'f0178122' });
/** D3: a change not recorded — the unrecorded-off placeholder, and any history row without who or when. */
const P = Object.freeze({ on: false, at: null, role: null, key: null });
const LOOKUPS = ['getOwnerPubkey', 'getAdminPubkeys'];
const CLAR = {
  switchEntry: 'ADR 0005 D3: one parsed switch record → its history entry { on, at, role, key }',
  switchRecord: 'ADR 0005 D3: the latest change and the history, from switch.json and switch-history.json',
  foldHistory: 'ADR 0005 D3: a new entry folded onto the list the GET showed, newest first, at most 10',
  handleRealtimeSwitchRecord: 'ADR 0005 D6: GET on the switch path, owner or admin, who and when',
  handleRealtimeSwitch: 'ADR 0003 T22; ADR 0005 D2, D5, D11',
  ownerOrAdmin: 'ADR 0005 D5: the shared owner-or-admin re-check → { ok: true, role, pubkey } or { ok: false, status, error }',
  parseSwitch: 'ADR 0003 T21; ADR 0005 D1',
};

// ─── test harness ──────────────────────────────────────────────────────────────────────────────────────────────
const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object' && !Buffer.isBuffer(v)) return Object.keys(v).sort().reduce((o, k) => { o[k] = sortKeys(v[k]); return o; }, {});
  return v;
}
/** JSON with sorted keys; long strings shortened. */
function show(v) {
  if (v === undefined) return 'undefined';
  if (v instanceof Error) return `<${v.code || 'Error'}>`;
  try {
    return JSON.stringify(sortKeys(v), (k, x) => {
      if (typeof x === 'number' && !Number.isFinite(x)) return String(x);
      if (typeof x === 'string' && x.length > 160) return `${x.slice(0, 40)}…(${x.length} characters)`;
      return x;
    });
  } catch (_) {
    return String(v);
  }
}
/** Exact JSON with sorted keys (undefined members dropped, as on the wire). */
function exact(v) { return JSON.stringify(sortKeys(v)); }
function same(actual, expected, label) {
  if (exact(actual) !== exact(expected)) throw new Error(`${label}\n        expected: ${show(expected)}\n        actual:   ${show(actual)}`);
}
const firstLine = (e) => String((e && e.message) || e).split('\n')[0];
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const iso = (ms) => new Date(ms).toISOString();
const has = (o, k) => !!o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k);
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

/** Run several cases; report every failing one, not only the first. */
async function cases(list, fn) {
  const failed = [];
  for (const c of list) {
    try { await fn(c); } catch (e) { failed.push(`[${c.name}] ${e.message}`); }
  }
  assert(failed.length === 0, `${failed.length} of ${list.length} case(s) failed:\n        ${failed.join('\n        ')}`);
}
/** Throw every problem at once. */
function report(problems) { assert(problems.length === 0, problems.join('\n          ')); }

// ─── lazy loading ──────────────────────────────────────────────────────────────────────────────────────────────
function forget() { for (const p of FORGET) delete require.cache[p]; }
function loadFresh(mod, rel) {
  forget();
  try { return require(mod); } catch (e) { throw new Error(`${rel} did not load (require failed: ${firstLine(e)})`); }
}
const loadRoutes = () => loadFresh(ROUTES_MOD, ROUTES_REL);
const loadIndex = () => loadFresh(INDEX_MOD, INDEX_REL);
const loadStore = () => loadFresh(STORE_MOD, STORE_REL);
function need(mod, name, rel) {
  if (!mod || typeof mod[name] !== 'function') {
    throw new Error(`${rel} does not export ${name}() yet (${CLAR[name] || 'ADR 0005'}); it exports ${show(Object.keys(mod || {}))}`);
  }
  return mod[name];
}
function routeFn(name) { return need(loadRoutes(), name, ROUTES_REL); }
/** The store's real parseSwitch, from the store the routes module will also load (no forget, so one instance). */
function storeParseSwitch() {
  let mod;
  try { mod = require(STORE_MOD); } catch (e) { throw new Error(`${STORE_REL} did not load (require failed: ${firstLine(e)})`); }
  return need(mod, 'parseSwitch', STORE_REL);
}

// ─── the temporary state directory ─────────────────────────────────────────────────────────────────────────────
let ROOT = null;
/** The handlers' stateDir(): a temporary directory, never the production one. Made by run() (or here, lazily). */
function root() {
  if (!ROOT) ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'tagging-edges-switch-record-'));
  return ROOT;
}
const SW_FILE = () => path.join(root(), 'realtime', 'switch.json');
const HIST_FILE = () => path.join(root(), 'realtime', 'switch-history.json');
function strayFiles() {
  const out = [];
  const walk = (d, rel) => {
    for (const name of fs.readdirSync(d).sort()) {
      const abs = path.join(d, name);
      const r = rel ? `${rel}/${name}` : name;
      if (fs.statSync(abs).isDirectory()) { out.push(`${r}/`); walk(abs, r); } else out.push(r);
    }
  };
  walk(root(), '');
  return out;
}
/** Every store-backed dependency is injected, so nothing may appear in the state directory. */
function checkNoStrays(label) {
  const stray = strayFiles();
  if (stray.length === 0) return;
  for (const name of fs.readdirSync(root())) fs.rmSync(path.join(root(), name), { recursive: true, force: true });
  throw new Error(`${label}: the handler wrote ${show(stray)} under its stateDir() instead of through the injected record dependencies (ADR 0005 § Seams: readSwitch, readSwitchHistory, writeSwitchHistory, writeSwitch and unlinkSwitch are injected; withDeps' defaults apply only to what is not given)`);
}

// ─── record fixtures ───────────────────────────────────────────────────────────────────────────────────────────
/** A recorded history entry (D1): { on, at, role, key }. */
const ent = (on, ms, role, pk) => ({ on, at: iso(ms), role, key: pk.slice(0, 8) });
/** A version-2 switch record (D1) as writeSwitch receives it and parseSwitch returns it. */
function rec2(on, ms, role, pk, onSinceMs) {
  return { version: 2, on, changedAt: iso(ms), changedBy: pk.slice(0, 8), role, onSince: onSinceMs === null || onSinceMs === undefined ? null : iso(onSinceMs) };
}
const SWITCH_KEYS = ['version', 'on', 'changedAt', 'changedBy', 'role', 'onSince'];
/** switch.json's text for a record: compact, keys in D1's order, one line. */
function swText(rec) {
  const o = {};
  for (const k of SWITCH_KEYS) if (has(rec, k) && rec[k] !== undefined) o[k] = rec[k];
  return `${JSON.stringify(o)}\n`;
}
/** switch-history.json's text (D1: pretty JSON). */
const histObjText = (obj) => `${JSON.stringify(obj, null, 2)}\n`;
const histText = (changes) => histObjText({ version: 1, changes });

/** The owner turned the path on an hour ago. */
const O_ON = rec2(true, T0 - HOUR, 'owner', OWNER, T0 - HOUR);
const E_O_ON = ent(true, T0 - HOUR, 'owner', OWNER);
/** An admin turned it off half an hour ago. */
const A_OFF = rec2(false, T0 - 30 * MIN, 'admin', ADMIN, null);
const E_A_OFF = ent(false, T0 - 30 * MIN, 'admin', ADMIN);
/** Older history rows. */
const H1 = ent(false, T0 - 2 * HOUR, 'admin', ADMIN);
const H2 = ent(true, T0 - 3 * HOUR, 'owner', OWNER);
/** n distinct valid entries, newest first. */
const many = (n) => Array.from({ length: n }, (_, i) => ent(i % 2 === 0, T0 - (i + 4) * HOUR, i % 2 ? 'admin' : 'owner', i % 2 ? ADMIN : OWNER));

/** switchRecord's answer (D3): every member, a never-switched instance's values by default. */
function rec(state, o = {}) {
  return { on: false, switchUnreadable: false, historyUnreadable: false, state, latest: null, history: [], ...o };
}
/** D11: a change, recorded. */
const recordedAnswer = (on, ms = T0) => ({ success: true, on, changedAt: iso(ms), recorded: true, takesEffectWithinSeconds: 5 });
/** D11: an off that was not recorded. */
const UNRECORDED_OFF = { success: true, on: false, recorded: false, takesEffectWithinSeconds: 5 };

function fsError(code, file) {
  return Object.assign(new Error(`${code}: simulated by the test, '${file}'`), { code, path: file });
}
function enoent(p) {
  return Object.assign(new Error(`ENOENT: no such file or directory, open '${p}'`), { code: 'ENOENT', errno: -2, syscall: 'open', path: p });
}
const enospc = () => fsError('ENOSPC', `${SW_FILE()}.tmp-4242-0a1b2c3d`);
/** An error whose code is off the allow-list and whose message names a URI and a path. */
const oddError = () => Object.assign(new Error(`connect ECONNREFUSED bolt://neo4j.internal:7687 at ${SW_FILE()}`), { code: ODD_CODE });

// ─── the in-memory record and the injected dependencies ────────────────────────────────────────────────────────
/** switch.json and switch-history.json: text, null when missing, or an Error that reading them throws. */
function makeDisk({ sw = null, hist = null } = {}) { return { sw, hist }; }
const snapshotDisk = (disk) => ({ sw: disk.sw instanceof Error ? `<read error ${disk.sw.code}>` : disk.sw, hist: disk.hist instanceof Error ? `<read error ${disk.hist.code}>` : disk.hist });
/** The history file as an object: null when missing, { readError } when it gives one, the parse otherwise. */
function diskHistory(disk) {
  if (disk.hist === null || disk.hist === undefined) return null;
  if (disk.hist instanceof Error) return { readError: disk.hist.code };
  try { return JSON.parse(disk.hist); } catch (_) { return { unparseable: disk.hist }; }
}
/** As D1 says the store maps switch-history.json's text. */
function parseHistory(text) {
  let parsed;
  try { parsed = JSON.parse(text); } catch (_) { return { unreadable: true }; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !Array.isArray(parsed.changes)) return { unreadable: true };
  return parsed;
}

/**
 * The handlers' dependencies over `disk`, every call recorded in calls.deps (by name, in order); the writes also in
 * calls.writes as { op, phase, arg } — phase 'pre-fold' or 'fold' for writeSwitchHistory, by whether writeSwitch was
 * called before it in this request. Options:
 *   now (ms), owner / admins (a value or a function), writeError / unlinkError (() => Error),
 *   historyWriteError ((phase) => boolean), wrap ((name, apply) => apply() or a promise of it: async writers),
 *   landed (a shared array: each write that lands appends `${label}${op}`), label,
 *   onRead ((file) => maybe a promise, awaited after the file's value is captured and before it is served),
 *   stateDirError (() => Error).
 */
function recordBundle(disk, o = {}) {
  const calls = { deps: [], writes: [], readFile: [] };
  const note = (name) => calls.deps.push(name);
  const parseSwitch = storeParseSwitch();
  const landed = o.landed || [];
  const label = o.label || '';
  const now = has(o, 'now') ? o.now : T0;
  const apply = (name, fn) => (typeof o.wrap === 'function' ? o.wrap(name, fn) : fn());
  const valueOf = (v, ...a) => (typeof v === 'function' ? v(...a) : v);
  const owner = (...a) => { note('getOwnerPubkey'); return valueOf(has(o, 'owner') ? o.owner : OWNER, ...a); };
  const deps = {
    stateDir: () => { note('stateDir'); if (o.stateDirError) throw o.stateDirError(); return root(); },
    now: () => { note('now'); return now; },
    getOwnerPubkey: owner,
    getAdminPubkeys: (...a) => { note('getAdminPubkeys'); return valueOf(has(o, 'admins') ? o.admins : [ADMIN], ...a); },
    isAlive: () => { note('isAlive'); return false; },
    readSwitch: () => {
      note('readSwitch');
      const v = disk.sw;
      if (v === null || v === undefined) return null;
      if (v instanceof Error) return { unreadable: true, readError: v.code };
      return parseSwitch(v);
    },
    readSwitchHistory: () => {
      note('readSwitchHistory');
      const v = disk.hist;
      if (v === null || v === undefined) return null;
      if (v instanceof Error) return { unreadable: true, readError: v.code };
      return parseHistory(v);
    },
    writeSwitch: (record) => {
      note('writeSwitch');
      calls.writes.push({ op: 'writeSwitch', arg: clone(record) });
      return apply('writeSwitch', () => {
        if (o.writeError) throw o.writeError();
        disk.sw = swText(record);
        landed.push(`${label}writeSwitch`);
      });
    },
    unlinkSwitch: () => {
      note('unlinkSwitch');
      calls.writes.push({ op: 'unlinkSwitch' });
      return apply('unlinkSwitch', () => {
        if (o.unlinkError) throw o.unlinkError();
        disk.sw = null;
        landed.push(`${label}unlinkSwitch`);
      });
    },
    writeSwitchHistory: (obj) => {
      note('writeSwitchHistory');
      const phase = calls.writes.some((w) => w.op === 'writeSwitch') ? 'fold' : 'pre-fold';
      calls.writes.push({ op: 'writeSwitchHistory', phase, arg: clone(obj) });
      return apply('writeSwitchHistory', () => {
        if (o.historyWriteError && o.historyWriteError(phase)) throw fsError('ENOSPC', HIST_FILE());
        disk.hist = histObjText(obj);
        landed.push(`${label}${phase}`);
      });
    },
    readFile: (p) => {
      note('readFile');
      const key = path.normalize(String(p));
      calls.readFile.push(key);
      const v = key === SW_FILE() ? disk.sw : key === HIST_FILE() ? disk.hist : null;
      const serve = () => {
        if (v === null || v === undefined) throw enoent(key);
        if (v instanceof Error) throw v;
        return v;
      };
      return Promise.resolve(typeof o.onRead === 'function' ? o.onRead(key) : undefined).then(serve);
    },
    isQueueAvailable: async () => { note('isQueueAvailable'); return true; },
    runViaQueueAsync: async () => { note('runViaQueueAsync'); return { success: true, jobId: 'x' }; },
  };
  return { deps, calls };
}
/** The writes in order: 'pre-fold', 'writeSwitch', 'fold', 'unlinkSwitch'. */
const writeOps = (calls) => calls.writes.map((w) => (w.op === 'writeSwitchHistory' ? w.phase : w.op));
const historyArgs = (calls, phase) => calls.writes.filter((w) => w.op === 'writeSwitchHistory' && w.phase === phase).map((w) => w.arg);
const switchArgs = (calls) => calls.writes.filter((w) => w.op === 'writeSwitch').map((w) => w.arg);

// ─── fake req/res ──────────────────────────────────────────────────────────────────────────────────────────────
function fakeReq({ method = 'POST', url = '', session, localTrusted, headers = {}, body, query = {}, ip = '203.0.113.9' } = {}) {
  const h = {};
  for (const [k, v] of Object.entries(headers)) if (v !== undefined) h[k.toLowerCase()] = v;
  const req = {
    method, url, originalUrl: url, path: url.split('?')[0], headers: h, body, query, session,
    hostname: String(h.host || '').split(':')[0], protocol: 'http', secure: false, ip, ips: [],
    socket: { remoteAddress: ip }, connection: { remoteAddress: ip },
    get(name) { return h[String(name).toLowerCase()]; },
    header(name) { return h[String(name).toLowerCase()]; },
  };
  if (localTrusted !== undefined) req.localTrusted = localTrusted;
  return req;
}
const ownerSession = () => ({ authenticated: true, pubkey: OWNER });
const adminSession = () => ({ authenticated: true, pubkey: ADMIN });
const strangerSession = () => ({ authenticated: true, pubkey: STRANGER });
/** A POST on the switch path; the owner's, same host, JSON, unless `o` says otherwise. */
function switchReq(body, o = {}) {
  const headers = { host: o.host || HOST, 'content-type': 'application/json', origin: o.origin };
  if (has(o, 'contentType')) headers['content-type'] = o.contentType === null ? undefined : o.contentType;
  return fakeReq({ method: 'POST', url: SWITCH_PATH, headers, body, session: has(o, 'session') ? o.session : ownerSession(), localTrusted: o.localTrusted, ip: o.ip });
}
/** A GET on the switch path; the owner's, same host, unless `o` says otherwise. */
function recordReq(o = {}) {
  return fakeReq({ method: 'GET', url: SWITCH_PATH, headers: { host: o.host || HOST, origin: o.origin }, session: has(o, 'session') ? o.session : ownerSession(), localTrusted: o.localTrusted, ip: o.ip });
}
function fakeRes() {
  const res = { statusCode: 200, body: undefined, finished: false, headers: {} };
  let done;
  res.done = new Promise((r) => { done = r; });
  const finish = (b) => {
    if (res.finished) return res;
    res.finished = true;
    if (typeof b === 'string') { try { res.body = JSON.parse(b); } catch (_) { res.body = b; } } else res.body = b;
    done();
    return res;
  };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => finish(b);
  res.send = (b) => finish(b);
  res.end = (b) => finish(b);
  res.sendStatus = (c) => { res.statusCode = c; return finish(undefined); };
  res.set = (k, v) => { res.headers[String(k).toLowerCase()] = v; return res; };
  res.setHeader = res.set;
  res.header = res.set;
  res.type = () => res;
  return res;
}
async function callHandler(fn, req, deps) {
  const res = fakeRes();
  let thrown = null;
  try { await fn(req, res, deps); } catch (e) { thrown = e; }
  if (!res.finished) {
    let timer;
    await Promise.race([res.done, new Promise((r) => { timer = setTimeout(r, 2000); })]);
    clearTimeout(timer);
  }
  if (!res.finished) throw new Error(`the handler never answered${thrown ? ` (it threw: ${firstLine(thrown)})` : ''}`);
  return res;
}
const showRes = (res) => `${res.statusCode} ${show(res.body)}`;

/** POST { on } (or o.body) on the switch path through handleRealtimeSwitch, with a fresh bundle over `disk`. */
async function post(disk, on, o = {}) {
  const handler = o.handler || routeFn('handleRealtimeSwitch');
  const b = recordBundle(disk, o);
  const body = has(o, 'body') ? o.body : { on };
  const res = await callHandler(handler, switchReq(body, o), b.deps);
  checkNoStrays(`POST ${show(body)}`);
  return { res, calls: b.calls };
}
/** GET on the switch path through handleRealtimeSwitchRecord, with a fresh bundle over `disk`. */
async function getRecord(disk, o = {}) {
  const handler = o.handler || routeFn('handleRealtimeSwitchRecord');
  const b = recordBundle(disk, o);
  const res = await callHandler(handler, recordReq(o), b.deps);
  checkNoStrays('GET the switch record');
  return { res, calls: b.calls };
}
async function withKills(fn) {
  const kills = [];
  const realKill = process.kill;
  process.kill = function recordKill(...a) { kills.push(a.map(String)); return true; };
  try {
    const result = await fn();
    return { result, kills };
  } finally {
    process.kill = realKill;
  }
}
/** Run fn with every console method and process.stdout/stderr writes captured (not printed); restored in finally. */
async function withLogs(fn) {
  const printed = [];
  const METHODS = ['log', 'info', 'warn', 'error', 'debug', 'trace'];
  const saved = { out: process.stdout.write, err: process.stderr.write };
  for (const m of METHODS) saved[m] = console[m];
  const grab = (...a) => { printed.push(a.map((x) => (typeof x === 'string' ? x : x instanceof Error ? `${x.message}\n${x.stack || ''}` : show(x))).join(' ')); };
  const write = function capturedWrite(chunk, ...rest) {
    printed.push(String(chunk));
    const cb = rest.find((x) => typeof x === 'function');
    if (cb) cb();
    return true;
  };
  for (const m of METHODS) console[m] = grab;
  process.stdout.write = write;
  process.stderr.write = write;
  try {
    const result = await fn();
    return { result, printed };
  } finally {
    for (const m of METHODS) console[m] = saved[m];
    process.stdout.write = saved.out;
    process.stderr.write = saved.err;
  }
}

/** What an answer must never carry: an absolute path, a URI, a full pubkey (either case), an address, the odd code. */
function leakProblems(label, res, extra = []) {
  const text = typeof res.body === 'string' ? res.body : JSON.stringify(res.body === undefined ? null : res.body);
  const p = [];
  const abs = /(^|[\s'"[(=])\/[^\s'"\])]/.exec(text);
  if (abs) p.push(`${label}: the answer carries an absolute path near ${show(text.slice(Math.max(0, abs.index - 30), abs.index + 60))}`);
  const uri = /\b[a-z][a-z0-9+.-]*:\/\//i.exec(text);
  if (uri) p.push(`${label}: the answer carries a URI near ${show(text.slice(Math.max(0, uri.index - 30), uri.index + 60))}`);
  for (const pk of [OWNER, ADMIN, OTHER_ADMIN, STRANGER]) {
    if (text.includes(pk) || text.includes(pk.toUpperCase())) p.push(`${label}: the answer carries a full pubkey (${pk.slice(0, 8)}…) — AC-5 shows only a shortened key (D11: "No answer carries a full pubkey")`);
  }
  for (const needle of [ODD_CODE, ...ADDRESS_NEEDLES, ...extra]) {
    if (text.includes(needle)) p.push(`${label}: the answer carries ${show(needle)}`);
  }
  return p;
}
/**
 * A refused request's problems: its status and exact body (the drift route's, so no who), the dependencies it called
 * (a 401 calls none; every other refusal only the owner and admin lookups — D5), and the record unchanged.
 */
function refusedProblems(label, r, status, body, { disk, before } = {}) {
  const p = [];
  if (r.res.statusCode !== status || exact(r.res.body) !== exact(body)) p.push(`${label}: should answer ${status} ${show(body)}; answered ${showRes(r.res)}`);
  const allowed = status === 401 ? [] : LOOKUPS;
  const called = [...new Set(r.calls.deps.filter((n) => !allowed.includes(n)))];
  if (called.length) {
    p.push(`${label}: called ${show(called)} before refusing (ADR 0005 D5: ${status === 401 ? 'a 401 calls no dependency' : 'a refusal calls only the owner and admin lookups — it reads, writes and unlinks no file'})`);
  }
  if (disk && before && exact(snapshotDisk(disk)) !== exact(before)) p.push(`${label}: the record changed: ${show(before)} → ${show(snapshotDisk(disk))}`);
  p.push(...leakProblems(label, r.res));
  return p;
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════
// SR1 — the exports
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('SR1: the real-time routes module exports switchEntry, switchRecord, foldHistory and handleRealtimeSwitchRecord beside its existing computeRealtimeStatus, validateSwitch, handleRealtimeStatus and handleRealtimeSwitch, and the tagging-edges routes module exports ownerOrAdmin beside sameHost and isJson — all functions [ADR 0005 D3, D5, D6; ADR 0003 T22 as amended (:1359-1360)]', () => {
  const routes = loadRoutes();
  const index = loadIndex();
  const wantRoutes = ['computeRealtimeStatus', 'validateSwitch', 'handleRealtimeStatus', 'handleRealtimeSwitch', 'switchEntry', 'switchRecord', 'foldHistory', 'handleRealtimeSwitchRecord'];
  const wantIndex = ['sameHost', 'isJson', 'ownerOrAdmin'];
  const p = [];
  const missingRoutes = wantRoutes.filter((n) => typeof routes[n] !== 'function');
  const missingIndex = wantIndex.filter((n) => typeof index[n] !== 'function');
  if (missingRoutes.length) p.push(`${ROUTES_REL} lacks ${show(missingRoutes)} (ADR 0005 D3, D6); it exports ${show(Object.keys(routes))}`);
  if (missingIndex.length) p.push(`${INDEX_REL} lacks ${show(missingIndex)} (ADR 0005 D5); it exports ${show(Object.keys(index))}`);
  report(p);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════
// SR2–SR13 — the record's pure functions (ADR 0005 D3)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('SR2: switchEntry reads a version-2 record with a role as a recorded change — the owner and an admin, turning on (with an ISO onSince) and off (with onSince null) — giving exactly { on, at: changedAt, role, key: changedBy }, with `at` the change\'s time and not onSince, and leaves its input unchanged [AC-5 "Every change records who made it (owner or admin, and a shortened key) and when"; ADR 0005 D1, D3]', async () => {
  const switchEntry = routeFn('switchEntry');
  await cases([
    { name: 'the owner turning on', r: rec2(true, T0, 'owner', OWNER, T0 - HOUR), want: ent(true, T0, 'owner', OWNER) },
    { name: 'the owner turning off', r: rec2(false, T0, 'owner', OWNER, null), want: ent(false, T0, 'owner', OWNER) },
    { name: 'an admin turning on', r: rec2(true, T0, 'admin', ADMIN, T0), want: ent(true, T0, 'admin', ADMIN) },
    { name: 'an admin turning off', r: rec2(false, T0, 'admin', ADMIN, null), want: ent(false, T0, 'admin', ADMIN) },
  ], (c) => {
    const before = clone(c.r);
    same(switchEntry(c.r), c.want, 'switchEntry(record)');
    same(c.r, before, 'switchEntry changed its input');
  });
});

test('SR3: the change made before story 5 reads as the owner\'s, with its stored time and key — D10\'s local switch.json text, through the store\'s real parseSwitch, gives { on: false, at: "2026-09-29T17:43:18.937Z", role: "owner", key: "f0178122" } though f0178122 is not the configured owner\'s prefix, and a version-1 "on" as story 3\'s route wrote it gives the owner\'s on [AC-5 "The change made before story 5, where one is stored, shows as the owner\'s, with its stored time and key"; ADR 0005 D1 (parseSwitch also returns version), D3 (version === 1, no role → role "owner"), D10; § Seams: "Parse it with the real parseSwitch, using D10\'s local text"]', async () => {
  const parseSwitch = need(loadStore(), 'parseSwitch', STORE_REL);
  const switchEntry = routeFn('switchEntry');
  await cases([
    { name: 'D10\'s local text', text: V1_LOCAL_TEXT, want: V1_ENTRY },
    { name: 'D10\'s local text without its trailing newline', text: V1_LOCAL_TEXT.trim(), want: V1_ENTRY },
    { name: 'a version-1 on, as story 3\'s route wrote it', text: `{"version":1,"on":true,"changedAt":"${iso(T0 - 2 * DAY)}","changedBy":"${OK}"}\n`, want: ent(true, T0 - 2 * DAY, 'owner', OWNER) },
  ], (c) => {
    const parsed = parseSwitch(c.text);
    const p = [];
    if (!parsed || parsed.version !== 1) p.push(`parseSwitch should also return version (ADR 0005 D1: "the raw parsed value"); it gave ${show(parsed)}`);
    let got;
    try { got = switchEntry(parsed); } catch (e) { p.push(`switchEntry threw: ${firstLine(e)}`); }
    if (got !== undefined && exact(got) !== exact(c.want)) p.push(`switchEntry(parseSwitch(text)) should be ${show(c.want)}; it is ${show(got)}`);
    report(p);
  });
});

test('SR4: anything else readable is a change not recorded — { on, at: null, role: null, key: null } with the record\'s own on — for a version-2 record with no role, a null role, or a role other than "owner" or "admin"; one whose on contradicts its onSince (on with onSince null, missing or not a time; off with an ISO onSince or none); a changedBy that is a full pubkey, 7 characters, not hex or missing; a changedAt that is not a time or missing; and a version-1 record with a bad key or time, or with a null role [AC-5; ADR 0005 D3: "Anything else readable is a change not recorded … a version 2 record without a role, and one whose on contradicts its onSince"; D1: key is 8 hex digits]', async () => {
  const switchEntry = routeFn('switchEntry');
  const on = rec2(true, T0, 'owner', OWNER, T0);
  const off = rec2(false, T0, 'admin', ADMIN, null);
  const without = (r, k) => { const out = { ...r }; delete out[k]; return out; };
  await cases([
    { name: 'version 2 with no role', r: without(on, 'role') },
    { name: 'version 2 off with no role', r: without(off, 'role') },
    { name: 'a null role', r: { ...on, role: null } },
    { name: 'role "root"', r: { ...on, role: 'root' } },
    { name: 'role "Owner"', r: { ...off, role: 'Owner' } },
    { name: 'on with onSince null', r: { ...on, onSince: null } },
    { name: 'on with no onSince', r: without(on, 'onSince') },
    { name: 'on with onSince not a time', r: { ...on, onSince: 'yesterday' } },
    { name: 'off with an ISO onSince', r: { ...off, onSince: iso(T0 - HOUR) } },
    // Review round 1, requested 12: pins for two readings story 5 § Deviations logs ("switchEntry follows D3
    // literally"). An off is recorded only when its onSince is exactly null, so a missing one is not recorded.
    { name: 'off with no onSince', r: without(off, 'onSince') },
    { name: 'a full pubkey as changedBy', r: { ...on, changedBy: OWNER } },
    { name: 'a 7-character changedBy', r: { ...on, changedBy: OK.slice(0, 7) } },
    { name: 'a changedBy that is not hex', r: { ...off, changedBy: 'zzzzzzzz' } },
    { name: 'no changedBy', r: without(on, 'changedBy') },
    { name: 'a changedAt that is not a time', r: { ...on, changedAt: 'yesterday' } },
    { name: 'no changedAt', r: without(off, 'changedAt') },
    { name: 'version 1 with a full pubkey as changedBy', r: { version: 1, on: false, changedAt: iso(T0), changedBy: OWNER } },
    { name: 'version 1 with a changedAt that is not a time', r: { version: 1, on: true, changedAt: '2026-13-45 noon', changedBy: OK } },
    { name: 'version 1 with no changedBy', r: { version: 1, on: false, changedAt: iso(T0) } },
    // A version 1 record reads as the owner's only with role absent (D3, D10), so role: null is not recorded.
    { name: 'version 1 with a null role', r: { version: 1, on: false, changedAt: iso(T0), changedBy: OK, role: null } },
  ], (c) => {
    same(switchEntry(c.r), { on: c.r.on, at: null, role: null, key: null }, `switchEntry(${show(c.r)})`);
  });
});

test('SR5: switchRecord with a readable switch.json is state "recorded" — on from the switch, latest = switchEntry(switch), switchUnreadable false — and history = dedupe([latest, ...the history\'s valid entries]): latest alone with no history file, not repeated when the history\'s newest is the same change, prepended to older changes, the pre-story-5 change as the owner\'s, and a hand-edited record with no role shown without who or when; its inputs are not changed [AC-5 "the latest change … the last 10 changes, newest first"; ADR 0005 D3: state "recorded"]', async () => {
  const switchRecord = routeFn('switchRecord');
  const v1On = { version: 1, on: true, changedAt: iso(T0 - 2 * DAY), changedBy: 'f0178122' };
  const noRole = { version: 2, on: true, changedAt: iso(T0 - 10 * MIN), changedBy: OK, onSince: iso(T0 - 10 * MIN) };
  const PON = { on: true, at: null, role: null, key: null };
  await cases([
    { name: 'the owner\'s on, no history file', sw: O_ON, hist: null, want: rec('recorded', { on: true, latest: E_O_ON, history: [E_O_ON] }) },
    { name: 'the owner\'s on, already the history\'s newest', sw: O_ON, hist: { version: 1, changes: [E_O_ON, H1] }, want: rec('recorded', { on: true, latest: E_O_ON, history: [E_O_ON, H1] }) },
    { name: 'an admin\'s off, over older changes', sw: A_OFF, hist: { version: 1, changes: [E_O_ON, H1] }, want: rec('recorded', { latest: E_A_OFF, history: [E_A_OFF, E_O_ON, H1] }) },
    { name: 'an admin\'s off, an empty history', sw: A_OFF, hist: { version: 1, changes: [] }, want: rec('recorded', { latest: E_A_OFF, history: [E_A_OFF] }) },
    { name: 'the pre-story-5 change (version 1, on)', sw: v1On, hist: null, want: rec('recorded', { on: true, latest: { on: true, at: iso(T0 - 2 * DAY), role: 'owner', key: 'f0178122' }, history: [{ on: true, at: iso(T0 - 2 * DAY), role: 'owner', key: 'f0178122' }] }) },
    { name: 'a hand edit with no role, over an older change', sw: noRole, hist: { version: 1, changes: [H1] }, want: rec('recorded', { on: true, latest: PON, history: [PON, H1] }) },
  ], (c) => {
    const before = clone([c.sw, c.hist]);
    same(switchRecord(c.sw, c.hist), c.want, `switchRecord(${show(c.sw)}, ${show(c.hist)})`);
    same([c.sw, c.hist], before, 'switchRecord changed its inputs');
  });
});

test('SR6: switchRecord with a switch.json that gives a read error or is damaged is state "switch-unreadable" — on false (an unreadable switch counts as off), switchUnreadable true, latest null — and still returns the stored history\'s valid entries, [] when there is none [AC-1 "An unreadable switch counts as off"; ADR 0005 D3: "\'switch-unreadable\': … latest is null, and the stored history is still returned"]', async () => {
  const switchRecord = routeFn('switchRecord');
  await cases([
    { name: 'a read error, with a history', sw: { unreadable: true, readError: 'EIO' }, hist: { version: 1, changes: [E_O_ON, H1] }, want: rec('switch-unreadable', { switchUnreadable: true, history: [E_O_ON, H1] }) },
    { name: 'damage, with a history', sw: { unreadable: true }, hist: { version: 1, changes: [E_A_OFF] }, want: rec('switch-unreadable', { switchUnreadable: true, history: [E_A_OFF] }) },
    { name: 'damage, no history file', sw: { unreadable: true }, hist: null, want: rec('switch-unreadable', { switchUnreadable: true }) },
    { name: 'a read error, an unreadable history', sw: { unreadable: true, readError: 'EACCES' }, hist: { unreadable: true, readError: 'EIO' }, want: rec('switch-unreadable', { switchUnreadable: true, historyUnreadable: true }) },
  ], (c) => {
    same(switchRecord(c.sw, c.hist), c.want, `switchRecord(${show(c.sw)}, ${show(c.hist)})`);
  });
});

test('SR7: switchRecord with no switch.json but a history file that holds an entry, is unreadable, or holds only invalid entries is state "unrecorded-off" — on false, latest { on: false, at: null, role: null, key: null } — and the placeholder heads the history, never an earlier "Turned on by …"; it is not repeated when the history\'s newest is already one [AC-5 "The panel then shows the path off with no who or when for that change, and never an earlier Turned on by … as the latest change"; ADR 0005 D3: "\'unrecorded-off\': switch.json is missing, and the history file is present, holding at least one entry or unreadable"]', async () => {
  const switchRecord = routeFn('switchRecord');
  await cases([
    { name: 'a history whose newest is the owner\'s on', hist: { version: 1, changes: [E_O_ON, H1] }, want: rec('unrecorded-off', { latest: P, history: [P, E_O_ON, H1] }) },
    { name: 'a history that gave a read error', hist: { unreadable: true, readError: 'EIO' }, want: rec('unrecorded-off', { historyUnreadable: true, latest: P, history: [P] }) },
    { name: 'a damaged history', hist: { unreadable: true }, want: rec('unrecorded-off', { historyUnreadable: true, latest: P, history: [P] }) },
    { name: 'a history whose changes is not an array', hist: { version: 1, changes: 'x' }, want: rec('unrecorded-off', { historyUnreadable: true, latest: P, history: [P] }) },
    { name: 'a history with no changes member', hist: { version: 1 }, want: rec('unrecorded-off', { historyUnreadable: true, latest: P, history: [P] }) },
    { name: 'a history holding only invalid entries', hist: { version: 1, changes: [{ on: 'yes' }, 'x', { on: true, at: iso(T0), role: 'root', key: OK }] }, want: rec('unrecorded-off', { latest: P, history: [P] }) },
    { name: 'a history whose newest is already an unrecorded off', hist: { version: 1, changes: [P, E_O_ON] }, want: rec('unrecorded-off', { latest: P, history: [P, E_O_ON] }) },
  ], (c) => {
    same(switchRecord(null, c.hist), c.want, `switchRecord(null, ${show(c.hist)})`);
  });
});

test('SR8: switchRecord with no switch.json and no history file, or a history whose changes is an empty array, is state "never-switched" — on false, latest null, history [] and neither file unreadable — the instance that ships off and was never switched [AC-5 "When no change is recorded, for example on an instance never switched (the path ships off), the panel says no change has been recorded and the history is empty"; ADR 0005 D3: "\'never-switched\'"]', async () => {
  const switchRecord = routeFn('switchRecord');
  await cases([
    { name: 'no files', hist: null },
    { name: 'an empty history', hist: { version: 1, changes: [] } },
  ], (c) => {
    same(switchRecord(null, c.hist), rec('never-switched'), `switchRecord(null, ${show(c.hist)})`);
  });
});

test('SR9: historyUnreadable is true exactly when the history file is present but gave a read error, did not parse, or its changes is not an array — and false when it is missing, empty, valid, or parseable with no valid entries — in every switch state [ADR 0005 D3: "historyUnreadable is true when the history file is present but gives a read error, does not parse, or its changes is not an array"; § Seams: "a history read error, damage, and a parseable history with no valid entries"]', async () => {
  const switchRecord = routeFn('switchRecord');
  const histories = [
    ['missing', null, false],
    ['empty', { version: 1, changes: [] }, false],
    ['valid', { version: 1, changes: [H1] }, false],
    ['parseable, no valid entries', { version: 1, changes: [{ on: 1 }] }, false],
    ['a read error', { unreadable: true, readError: 'EIO' }, true],
    ['damaged', { unreadable: true }, true],
    ['changes not an array', { version: 1, changes: { 0: H1 } }, true],
    ['no changes member', { version: 1 }, true],
  ];
  const switches = [['recorded', O_ON], ['switch-unreadable', { unreadable: true, readError: 'EIO' }], ['missing', null]];
  const p = [];
  for (const [sl, sw] of switches) {
    for (const [hl, hist, want] of histories) {
      let got;
      try { got = switchRecord(sw, hist); } catch (e) { p.push(`[switch ${sl}, history ${hl}] threw: ${firstLine(e)}`); continue; }
      if (!got || got.historyUnreadable !== want) p.push(`[switch ${sl}, history ${hl}] historyUnreadable should be ${want}; the answer is ${show(got)}`);
    }
  }
  report(p);
});

test('SR10: only valid history entries reach the history, in their stored order — a recorded entry (on a boolean, at an ISO time, role "owner" or "admin", key 8 hex digits) or an unrecorded one (on a boolean, at, role and key all null) — and an entry with on not a boolean or missing, role "root" or "Owner", a full pubkey or 7-character or non-hex key, at not a time or a number, mixed nulls, or that is not an object is dropped, so no full pubkey is ever served [AC-5; ADR 0005 D1 (the entry\'s shape), D3 ("validEntries(file)")]', async () => {
  const switchRecord = routeFn('switchRecord');
  const at = iso(T0 - 5 * HOUR);
  const invalid = [
    { on: 'true', at, role: 'owner', key: OK },
    { at, role: 'owner', key: OK },
    { on: true, at, role: 'root', key: OK },
    { on: true, at, role: 'Owner', key: OK },
    { on: true, at, role: 'owner', key: OWNER },
    { on: true, at, role: 'owner', key: OK.slice(0, 7) },
    { on: false, at, role: 'admin', key: 'zzzzzzzz' },
    { on: true, at: 'yesterday', role: 'owner', key: OK },
    { on: true, at: T0, role: 'owner', key: OK },
    { on: false, at: null, role: 'owner', key: OK },
    { on: false, at, role: null, key: null },
    'x', null, [true], 7,
  ];
  const changes = [invalid[0], H2, ...invalid.slice(1, 8), P, ...invalid.slice(8), H1];
  const hist = { version: 1, changes };
  const before = clone(hist);
  const p = [];
  const unreadableSwitch = switchRecord({ unreadable: true, readError: 'EIO' }, hist);
  if (exact(unreadableSwitch && unreadableSwitch.history) !== exact([H2, P, H1])) p.push(`with switch.json unreadable, history should be the valid entries ${show([H2, P, H1])}; it is ${show(unreadableSwitch && unreadableSwitch.history)}`);
  const recorded = switchRecord(A_OFF, hist);
  if (exact(recorded && recorded.history) !== exact([E_A_OFF, H2, P, H1])) p.push(`with an admin's off recorded, history should be ${show([E_A_OFF, H2, P, H1])}; it is ${show(recorded && recorded.history)}`);
  if (JSON.stringify([unreadableSwitch, recorded]).includes(OWNER)) p.push('an answer carries the full pubkey a hand-edited entry held');
  if (exact(hist) !== exact(before)) p.push('switchRecord changed the history it was given');
  report(p);
});

test('SR11: dedupe drops an entry equal in on, at, role and key to the one before it, and only that — [A, A, B, A, P, P, B] reads [A, B, A, P, B]; a latest equal to the history\'s newest is shown once; entries that differ only in key, role or at are all kept [ADR 0005 D3: "dedupe drops an entry equal in on, at, role and key to the one before it"; § Seams: "the cap at 10, and dedupe"]', async () => {
  const switchRecord = routeFn('switchRecord');
  const A = E_O_ON;
  const B = H1;
  const keyOnly = { ...A, key: AK };
  const roleOnly = { ...A, role: 'admin' };
  const atOnly = { ...A, at: iso(T0 - 7 * HOUR) };
  await cases([
    { name: 'stored repeats, switch.json unreadable', sw: { unreadable: true }, changes: [A, A, B, A, P, P, B], want: [A, B, A, P, B] },
    { name: 'the latest equal to the stored newest, which repeats', sw: O_ON, changes: [A, A, B], want: [A, B] },
    { name: 'entries that differ only in key, role or at', sw: { unreadable: true }, changes: [A, keyOnly, roleOnly, atOnly], want: [A, keyOnly, roleOnly, atOnly] },
  ], (c) => {
    const got = switchRecord(c.sw, { version: 1, changes: c.changes });
    same(got && got.history, c.want, 'history');
  });
});

test('SR12: the history is at most 10 entries, newest first — a new latest over 12 stored changes gives it and the first 9; switch.json unreadable gives the first 10; an unrecorded off gives the placeholder and the first 9; a latest equal to the newest stored gives the first 10 — and the stored list is not changed [AC-5 "the last 10 changes, newest first"; ADR 0005 D1 ("at most 10 entries"), D3 (".slice(0, 10)")]', async () => {
  const switchRecord = routeFn('switchRecord');
  const L = many(12);
  const X = ent(true, T0, 'admin', ADMIN);
  const XR = rec2(true, T0, 'admin', ADMIN, T0);
  const L0R = { version: 2, on: L[0].on, changedAt: L[0].at, changedBy: L[0].key, role: L[0].role, onSince: L[0].on ? L[0].at : null };
  await cases([
    { name: 'a new latest', sw: XR, want: [X, ...L.slice(0, 9)] },
    { name: 'switch.json unreadable', sw: { unreadable: true }, want: L.slice(0, 10) },
    { name: 'an unrecorded off', sw: null, want: [P, ...L.slice(0, 9)] },
    { name: 'a latest equal to the newest stored', sw: L0R, want: L.slice(0, 10) },
  ], (c) => {
    const hist = { version: 1, changes: clone(L) };
    const got = switchRecord(c.sw, hist);
    same(got && got.history, c.want, 'history');
    same(hist.changes, L, 'the stored list after switchRecord');
  });
});

test('SR13: foldHistory(newEntry, list) returns the array dedupe([newEntry, ...list]).slice(0, 10) — the new entry prepended; not repeated when equal to the list\'s first; repeats inside the list collapsed; the oldest dropped past 10; an unrecorded entry folded like any other — and neither input is changed [ADR 0005 D3: "foldHistory(newEntry, list) returns the array dedupe([newEntry, ...list]).slice(0, 10)"; D2 step 5]', async () => {
  const foldHistory = routeFn('foldHistory');
  const L = many(10);
  const X = ent(false, T0, 'admin', ADMIN);
  await cases([
    { name: 'onto an empty list', e: X, list: [], want: [X] },
    { name: 'onto older changes', e: X, list: [E_O_ON, H1], want: [X, E_O_ON, H1] },
    { name: 'equal to the list\'s first', e: E_O_ON, list: [E_O_ON, H1], want: [E_O_ON, H1] },
    { name: 'onto a list with a repeat inside it', e: X, list: [H1, H1, H2], want: [X, H1, H2] },
    { name: 'onto 10 entries', e: X, list: L, want: [X, ...L.slice(0, 9)] },
    { name: 'an unrecorded off onto a placeholder', e: P, list: [P, H1], want: [P, H1] },
    { name: 'an on onto an unrecorded off', e: ent(true, T0, 'owner', OWNER), list: [P, H1], want: [ent(true, T0, 'owner', OWNER), P, H1] },
  ], (c) => {
    const before = clone([c.e, c.list]);
    const got = foldHistory(c.e, c.list);
    assert(Array.isArray(got), `foldHistory should return an array; it returned ${show(got)}`);
    same(got, c.want, 'foldHistory');
    same([c.e, c.list], before, 'foldHistory changed its inputs');
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════
// SR14–SR30 — POST on the switch path (ADR 0005 D1, D2, D4, D5, D10, D11)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('SR14: the owner and an admin each turn the path on and off — 200 exactly { success: true, on, changedAt: now, recorded: true, takesEffectWithinSeconds: 5 }; writeSwitch called once with exactly { version: 2, on, changedAt, changedBy: the caller\'s 8-character prefix, role, onSince } (now when turning on from off, null when off); nothing unlinked, no signal, nothing enqueued, no full pubkey in the answer — with no Origin and a same-host Origin [AC-4 "It accepts a change only from a signed-in owner or admin"; AC-5; AC-6 "does not start, stop or queue a pass"; ADR 0005 D1, D4, D5, D11; Test tasks: "owner and admin, each turning the path on and off"]', async () => {
  await cases([
    { name: 'the owner turns it on', on: true, o: {}, role: 'owner', pk: OWNER },
    { name: 'the owner turns it off', on: false, o: {}, role: 'owner', pk: OWNER },
    { name: 'an admin turns it on', on: true, o: { session: adminSession() }, role: 'admin', pk: ADMIN },
    { name: 'an admin turns it off', on: false, o: { session: adminSession() }, role: 'admin', pk: ADMIN },
    { name: 'the owner turns it on, a same-host Origin', on: true, o: { origin: `https://${HOST}` }, role: 'owner', pk: OWNER },
    { name: 'an admin turns it off, a same-host Origin with a port', on: false, o: { session: adminSession(), origin: `http://${HOST}:7778`, host: `${HOST}:7778` }, role: 'admin', pk: ADMIN },
  ], async (c) => {
    const disk = makeDisk();
    const { result: r, kills } = await withKills(() => post(disk, c.on, c.o));
    const p = [];
    if (r.res.statusCode !== 200 || exact(r.res.body) !== exact(recordedAnswer(c.on))) p.push(`should answer 200 ${show(recordedAnswer(c.on))} (D11); answered ${showRes(r.res)}`);
    const writes = switchArgs(r.calls);
    const want = rec2(c.on, T0, c.role, c.pk, c.on ? T0 : null);
    if (writes.length !== 1) p.push(`writeSwitch should be called once; it was called ${writes.length} times`);
    else if (exact(writes[0]) !== exact(want)) p.push(`writeSwitch should get exactly ${show(want)} (D1, D4); it got ${show(writes[0])}`);
    if (writeOps(r.calls).includes('unlinkSwitch')) p.push('unlinkSwitch was called on a change whose write succeeded');
    if (kills.length) p.push(`a signal was sent: ${show(kills)}`);
    const queue = r.calls.deps.filter((n) => n === 'isQueueAvailable' || n === 'runViaQueueAsync');
    if (queue.length) p.push(`the task queue was touched (${show(queue)}): a switch change starts, stops and queues no pass (AC-6)`);
    p.push(...leakProblems(c.name, r.res));
    report(p);
  });
});

test('SR15: who is recorded is the caller, by the role configuration gives them at the moment of the change — an admin\'s change records the admin\'s 8-character prefix and role "admin", never the owner\'s; the owner listed among the admins too is "owner"; an admin whose session claims owner flags is still "admin"; an admin is admitted with no owner configured or when the owner lookup throws, and the owner when the admin lookup throws — in switch.json and in the history entry alike [AC-5 "Every change records who made it (owner or admin, and a shortened key)"; ADR 0005 D1 ("changedBy is the caller\'s session.pubkey.slice(0, 8)"), D5 ("The role comes from configuration at the moment of the change, never from session flags")]', async () => {
  assert(OK !== AK, `the fixture owner and admin should have different 8-character prefixes (${OK}, ${AK})`);
  await cases([
    { name: 'an admin turns it on', o: { session: adminSession() }, role: 'admin', pk: ADMIN },
    { name: 'the owner, also listed as an admin', o: { admins: [ADMIN, OWNER] }, role: 'owner', pk: OWNER },
    { name: 'an admin whose session claims owner flags', o: { session: { authenticated: true, pubkey: ADMIN, role: 'owner', isOwner: true, owner: true } }, role: 'admin', pk: ADMIN },
    { name: 'an admin among others, no owner configured', o: { session: adminSession(), owner: null, admins: [OTHER_ADMIN, ADMIN] }, role: 'admin', pk: ADMIN },
    { name: 'an admin when the owner lookup throws', o: { session: adminSession(), owner: () => { throw new Error('could not read /etc/brainstorm.conf'); } }, role: 'admin', pk: ADMIN },
    { name: 'the owner when the admin lookup throws', o: { admins: () => { throw new Error('could not source /etc/brainstorm.conf'); } }, role: 'owner', pk: OWNER },
  ], async (c) => {
    const disk = makeDisk();
    const r = await post(disk, true, c.o);
    const p = [];
    if (r.res.statusCode !== 200) p.push(`should be admitted (200); answered ${showRes(r.res)}`);
    const w = switchArgs(r.calls)[0];
    if (!w || w.role !== c.role || w.changedBy !== c.pk.slice(0, 8)) p.push(`switch.json should record role ${show(c.role)} and changedBy ${show(c.pk.slice(0, 8))}; writeSwitch got ${show(w)}`);
    if (c.role === 'admin' && w && w.changedBy === OK) p.push('an admin\'s change was recorded under the owner\'s key');
    const fold = historyArgs(r.calls, 'fold')[0];
    const wantEntry = ent(true, T0, c.role, c.pk);
    if (!fold || exact(fold.changes && fold.changes[0]) !== exact(wantEntry)) p.push(`the history\'s newest entry should be ${show(wantEntry)}; the fold wrote ${show(fold)}`);
    p.push(...leakProblems(c.name, r.res));
    report(p);
  });
});

test('SR16: a recorded change is folded into the history after switch.json is written — the first change on an instance never switched writes exactly writeSwitch then { version: 1, changes: [its entry] }; a change whose previous change is already the history\'s newest writes writeSwitch then { version: 1, changes: [its entry, ...the stored list] }, with no pre-fold — and the history file then holds that list [AC-5 "the last 10 changes, newest first"; "It lasts"; ADR 0005 D2 steps 4–5 ("When base is not null and differs from the history\'s stored valid entries, write …"; "write { version: 1, changes: foldHistory(switchEntry(next), base) }")]', async () => {
  await cases([
    // No pre-fold: D2 step 4 pre-folds only when base "differs from the history's stored valid entries"; here base is [] (never-switched) and a missing history's stored valid entries are [].
    { name: 'the first change: the owner turns it on', disk: () => makeDisk(), on: true, o: {}, fold: [ent(true, T0, 'owner', OWNER)] },
    { name: 'an admin turns off the owner\'s on, already the newest', disk: () => makeDisk({ sw: swText(O_ON), hist: histText([E_O_ON, H1]) }), on: false, o: { session: adminSession() }, fold: [ent(false, T0, 'admin', ADMIN), E_O_ON, H1] },
    { name: 'the owner turns on the admin\'s off, already the newest', disk: () => makeDisk({ sw: swText(A_OFF), hist: histText([E_A_OFF]) }), on: true, o: {}, fold: [ent(true, T0, 'owner', OWNER), E_A_OFF] },
  ], async (c) => {
    const disk = c.disk();
    const r = await post(disk, c.on, c.o);
    const p = [];
    if (r.res.statusCode !== 200 || exact(r.res.body) !== exact(recordedAnswer(c.on))) p.push(`should answer 200 ${show(recordedAnswer(c.on))}; answered ${showRes(r.res)}`);
    const ops = writeOps(r.calls);
    if (ops.join(',') !== 'writeSwitch,fold') p.push(`the writes should be exactly writeSwitch, then the fold — no pre-fold, since base equals the history's stored valid entries (D2 step 4: [] for an instance never switched; the stored list when the previous change is already its newest); they were ${show(ops)}`);
    const want = { version: 1, changes: c.fold };
    const fold = historyArgs(r.calls, 'fold');
    if (fold.length === 1 && exact(fold[0]) !== exact(want)) p.push(`the fold should write exactly ${show(want)}; it wrote ${show(fold[0])}`);
    if (exact(diskHistory(disk)) !== exact(want)) p.push(`switch-history.json should then hold ${show(want)}; it holds ${show(diskHistory(disk))}`);
    report(p);
  });
});

test('SR17: when the previous change is not yet the history\'s newest, the writes run pre-fold → writeSwitch → fold — the pre-fold writes exactly { version: 1, changes: base } with base = switchRecord(prev, hist).history, the list a GET showed just before; the fold writes { version: 1, changes: foldHistory(newEntry, base) } — for a previous change with no history file, over older changes, over 10 older changes, and a switch.json missing after a recorded change (the unrecorded-off placeholder) [AC-5 "The history recorded before it survives"; ADR 0005 D2 steps 1–5 and the invariant; § Seams: "Spies record the call order: pre-fold, then switch, then fold"]', async () => {
  const L = many(10);
  const NEW = ent(false, T0, 'admin', ADMIN);
  await cases([
    { name: 'the owner\'s on, no history file', disk: () => makeDisk({ sw: swText(O_ON) }), base: [E_O_ON] },
    { name: 'the owner\'s on, over older changes', disk: () => makeDisk({ sw: swText(O_ON), hist: histText([H1, H2]) }), base: [E_O_ON, H1, H2] },
    { name: 'the owner\'s on, over 10 older changes', disk: () => makeDisk({ sw: swText(O_ON), hist: histText(L) }), base: [E_O_ON, ...L.slice(0, 9)] },
    { name: 'switch.json missing after a recorded change', disk: () => makeDisk({ hist: histText([E_A_OFF]) }), base: [P, E_A_OFF] },
  ], async (c) => {
    const disk = c.disk();
    const p = [];
    let shown;
    try { shown = (await getRecord(disk)).res; } catch (e) { p.push(`the GET before the change failed: ${firstLine(e)}`); }
    if (shown && exact(shown.body && shown.body.history) !== exact(c.base)) p.push(`the GET before the change should show history ${show(c.base)}; it answered ${showRes(shown)}`);
    try {
      const switchRecord = routeFn('switchRecord');
      const prev = disk.sw === null ? null : storeParseSwitch()(disk.sw);
      const hist = disk.hist === null ? null : parseHistory(disk.hist);
      const fromFn = switchRecord(prev, hist);
      if (exact(fromFn && fromFn.history) !== exact(c.base)) p.push(`switchRecord(prev, hist).history should be ${show(c.base)}; it is ${show(fromFn && fromFn.history)}`);
    } catch (e) { p.push(firstLine(e)); }
    const r = await post(disk, false, { session: adminSession() });
    if (r.res.statusCode !== 200 || exact(r.res.body) !== exact(recordedAnswer(false))) p.push(`should answer 200 ${show(recordedAnswer(false))}; answered ${showRes(r.res)}`);
    const ops = writeOps(r.calls);
    if (ops.join(',') !== 'pre-fold,writeSwitch,fold') p.push(`the writes should be exactly pre-fold, writeSwitch, fold (D2); they were ${show(ops)}`);
    const pre = historyArgs(r.calls, 'pre-fold');
    if (pre.length === 1 && exact(pre[0]) !== exact({ version: 1, changes: c.base })) p.push(`the pre-fold should write exactly ${show({ version: 1, changes: c.base })}; it wrote ${show(pre[0])}`);
    const wantFold = { version: 1, changes: [NEW, ...c.base].slice(0, 10) };
    const fold = historyArgs(r.calls, 'fold');
    if (fold.length === 1 && exact(fold[0]) !== exact(wantFold)) p.push(`the fold should write exactly ${show(wantFold)}; it wrote ${show(fold[0])}`);
    report(p);
  });
});

test('SR18: the change made before story 5 is copied into the history at the first story-5 switch — with D10\'s local version-1 switch.json and no history file, an owner\'s on and an admin\'s off each pre-fold exactly { version: 1, changes: [{ on: false, at: "2026-09-29T17:43:18.937Z", role: "owner", key: "f0178122" }] }, then write switch.json version 2, then fold the new change above it; the GET shows that change as the owner\'s before, and both after [AC-5 "The change made before story 5 … shows as the owner\'s"; ADR 0005 D2 step 4 ("It moves the pre-story-5 change … into the history before the new write can replace … them"), D10; § Seams: "A version 1 file … The pre-fold copies it as { on: false, at, role: \'owner\', key: \'f0178122\' }"]', async () => {
  await cases([
    { name: 'the owner turns it on', on: true, o: {}, next: rec2(true, T0, 'owner', OWNER, T0), entry: ent(true, T0, 'owner', OWNER) },
    { name: 'an admin turns it off', on: false, o: { session: adminSession() }, next: rec2(false, T0, 'admin', ADMIN, null), entry: ent(false, T0, 'admin', ADMIN) },
  ], async (c) => {
    const disk = makeDisk({ sw: V1_LOCAL_TEXT });
    const p = [];
    let before;
    try { before = (await getRecord(disk)).res; } catch (e) { p.push(`the GET before failed: ${firstLine(e)}`); }
    if (before && exact(before.body) !== exact({ success: true, ...rec('recorded', { latest: V1_ENTRY, history: [V1_ENTRY] }) })) p.push(`the GET before should show the pre-story-5 change as the owner's; it answered ${showRes(before)}`);
    const r = await post(disk, c.on, c.o);
    const ops = writeOps(r.calls);
    if (ops.join(',') !== 'pre-fold,writeSwitch,fold') p.push(`the writes should be pre-fold, writeSwitch, fold; they were ${show(ops)}`);
    const pre = historyArgs(r.calls, 'pre-fold')[0];
    if (exact(pre) !== exact({ version: 1, changes: [V1_ENTRY] })) p.push(`the pre-fold should write exactly ${show({ version: 1, changes: [V1_ENTRY] })}; it wrote ${show(pre)}`);
    const w = switchArgs(r.calls)[0];
    if (exact(w) !== exact(c.next)) p.push(`writeSwitch should get ${show(c.next)}; it got ${show(w)}`);
    const fold = historyArgs(r.calls, 'fold')[0];
    if (exact(fold) !== exact({ version: 1, changes: [c.entry, V1_ENTRY] })) p.push(`the fold should write ${show({ version: 1, changes: [c.entry, V1_ENTRY] })}; it wrote ${show(fold)}`);
    let after;
    try { after = (await getRecord(disk)).res; } catch (e) { p.push(`the GET after failed: ${firstLine(e)}`); }
    const wantAfter = { success: true, ...rec('recorded', { on: c.on, latest: c.entry, history: [c.entry, V1_ENTRY] }) };
    if (after && exact(after.body) !== exact(wantAfter)) p.push(`the GET after should answer ${show(wantAfter)}; it answered ${showRes(after)}`);
    report(p);
  });
});

test('SR19: onSince is the last off-to-on time — turning on from missing, off or damaged gives now; an on while already on carries the previous onSince when it is a time, else the previous changedAt (a version-1 record), else now; turning off gives null — while changedAt, changedBy and role always move to this change [AC-3 "An on while the path is already on does not restart the window"; "counts from the time the server recorded the switch last going from off to on, whoever made the change"; ADR 0005 D4]', async () => {
  const v1On = `{"version":1,"on":true,"changedAt":"${iso(T0 - 2 * DAY)}","changedBy":"f0178122"}\n`;
  await cases([
    { name: 'on, never switched', disk: makeDisk(), on: true, onSince: iso(T0) },
    { name: 'on, after an admin\'s off', disk: makeDisk({ sw: swText(A_OFF) }), on: true, onSince: iso(T0) },
    { name: 'on, after a damaged switch.json', disk: makeDisk({ sw: '{"on":tr' }), on: true, onSince: iso(T0) },
    { name: 'on while on (version 2)', disk: makeDisk({ sw: swText(rec2(true, T0 - 20 * MIN, 'admin', ADMIN, T0 - HOUR)) }), on: true, onSince: iso(T0 - HOUR) },
    { name: 'an admin\'s on while the owner\'s on', disk: makeDisk({ sw: swText(O_ON) }), on: true, o: { session: adminSession() }, onSince: iso(T0 - HOUR), role: 'admin', pk: ADMIN },
    { name: 'on while on (the pre-story-5 version 1)', disk: makeDisk({ sw: v1On }), on: true, onSince: iso(T0 - 2 * DAY) },
    { name: 'on while on, onSince null but changedAt a time', disk: makeDisk({ sw: `{"version":2,"on":true,"changedAt":"${iso(T0 - 20 * MIN)}","changedBy":"${AK}","role":"admin","onSince":null}\n` }), on: true, onSince: iso(T0 - 20 * MIN) },
    { name: 'on while on, neither a time', disk: makeDisk({ sw: `{"version":2,"on":true,"changedAt":"yesterday","changedBy":"${AK}","role":"admin","onSince":"later"}\n` }), on: true, onSince: iso(T0) },
    { name: 'off while on', disk: makeDisk({ sw: swText(O_ON) }), on: false, onSince: null },
    { name: 'off while off', disk: makeDisk({ sw: swText(A_OFF) }), on: false, onSince: null },
  ], async (c) => {
    const r = await post(c.disk, c.on, c.o || {});
    const w = switchArgs(r.calls)[0];
    const want = { version: 2, on: c.on, changedAt: iso(T0), changedBy: (c.pk || OWNER).slice(0, 8), role: c.role || 'owner', onSince: c.onSince };
    const p = [];
    if (r.res.statusCode !== 200 || exact(r.res.body) !== exact(recordedAnswer(c.on))) p.push(`should answer 200 ${show(recordedAnswer(c.on))}; answered ${showRes(r.res)}`);
    if (exact(w) !== exact(want)) p.push(`writeSwitch should get ${show(want)}; it got ${show(w)}`);
    report(p);
  });
});

test('SR20: a failed on changes nothing — when writing switch.json fails (ENOSPC, EIO, or a code off the allow-list) the answer is 500 exactly { success: false, error: "could not write the switch: <code>", code } with the allow-listed code; nothing is unlinked and no fold runs; switch.json is byte-identical; the history is unchanged, or exactly the pre-fold\'s base when the previous change was not yet stored, and holds no entry for the attempted on; and the GET answers exactly as before [AC-4 "Refused or failed … Turning on fails, for example, when the server cannot write the switch"; Test tasks: "a failed on: the write fails, the answer is an error, and nothing changes"; ADR 0005 D2 step 5 ("It fails, for {on:true}"), D11; § Seams: "A failed on"]', async () => {
  await cases([
    { name: 'ENOSPC, the admin\'s off already stored', disk: () => makeDisk({ sw: swText(A_OFF), hist: histText([E_A_OFF, H1]) }), err: enospc, code: 'ENOSPC', ops: 'writeSwitch', hist: 'unchanged' },
    { name: 'EIO, the admin\'s off not yet stored', disk: () => makeDisk({ sw: swText(A_OFF) }), err: () => fsError('EIO', SW_FILE()), code: 'EIO', ops: 'pre-fold,writeSwitch', hist: { version: 1, changes: [E_A_OFF] } },
    { name: 'ENOSPC, the pre-story-5 change not yet stored', disk: () => makeDisk({ sw: V1_LOCAL_TEXT }), err: enospc, code: 'ENOSPC', ops: 'pre-fold,writeSwitch', hist: { version: 1, changes: [V1_ENTRY] } },
    { name: 'a code off the allow-list, with a URI and a path in its message', disk: () => makeDisk({ sw: swText(A_OFF), hist: histText([E_A_OFF]) }), err: oddError, code: 'error', ops: 'writeSwitch', hist: 'unchanged' },
    { name: 'ENOSPC, the pre-fold failing too', disk: () => makeDisk({ sw: swText(A_OFF) }), err: enospc, code: 'ENOSPC', ops: 'pre-fold,writeSwitch', hist: 'unchanged', historyWriteError: () => true },
  ], async (c) => {
    const disk = c.disk();
    const p = [];
    let before;
    try { before = (await getRecord(disk)).res; } catch (e) { p.push(`the GET before failed: ${firstLine(e)}`); }
    const snap = snapshotDisk(disk);
    const r = await post(disk, true, { writeError: c.err, historyWriteError: c.historyWriteError });
    const want = { success: false, error: `could not write the switch: ${c.code}`, code: c.code };
    if (r.res.statusCode !== 500 || exact(r.res.body) !== exact(want)) p.push(`should answer 500 ${show(want)} (D11); answered ${showRes(r.res)}`);
    const ops = writeOps(r.calls).join(',');
    if (ops !== c.ops) p.push(`the writes should be exactly ${show(c.ops)} — no unlink and no fold after a failed on (D2 step 5); they were ${show(ops)}`);
    if (disk.sw !== snap.sw) p.push(`switch.json should be byte-identical; it went from ${show(snap.sw)} to ${show(disk.sw)}`);
    if (c.hist === 'unchanged') {
      if (disk.hist !== snap.hist) p.push(`switch-history.json should be unchanged; it went from ${show(snap.hist)} to ${show(disk.hist)}`);
    } else if (exact(diskHistory(disk)) !== exact(c.hist)) p.push(`switch-history.json should be exactly the pre-fold's base ${show(c.hist)}; it is ${show(diskHistory(disk))}`);
    const h = diskHistory(disk);
    if (h && Array.isArray(h.changes) && h.changes.some((e) => e && e.at === iso(T0))) p.push(`the history holds an entry for the attempted on: ${show(h.changes)}`);
    let after;
    try { after = (await getRecord(disk)).res; } catch (e) { p.push(`the GET after failed: ${firstLine(e)}`); }
    if (before && after && exact(after.body) !== exact(before.body)) p.push(`the GET should answer as before the request\n          before: ${showRes(before)}\n          after:  ${showRes(after)}`);
    p.push(...leakProblems(c.name, r.res));
    report(p);
  });
});

test('SR21: an off still takes effect when it cannot be recorded — when writing switch.json fails for an off, switch.json is unlinked (which reads as off), no fold runs, and the answer is exactly 200 { success: true, on: false, recorded: false, takesEffectWithinSeconds: 5 }; the history written before it survives, and the GET then shows the path off as an unrecorded off — latest without who or when, never the earlier "Turned on by …" as the latest change or the history\'s first row [AC-4 "An off still takes effect when the server cannot record it"; AC-5 "The one exception"; Test tasks: "an off that could not be recorded: the path is off, the answer says not recorded, and the earlier history is intact"; ADR 0005 D2 step 5 ("It fails, for {on:false}"), D3, D11]', async () => {
  await cases([
    { name: 'ENOSPC, the owner\'s on already stored', disk: () => makeDisk({ sw: swText(O_ON), hist: histText([E_O_ON, H1]) }), err: enospc, ops: 'writeSwitch,unlinkSwitch', hist: [E_O_ON, H1] },
    { name: 'EIO, the owner\'s on not yet stored (the pre-fold stores it)', disk: () => makeDisk({ sw: swText(O_ON) }), err: () => fsError('EIO', SW_FILE()), ops: 'pre-fold,writeSwitch,unlinkSwitch', hist: [E_O_ON] },
    { name: 'a code off the allow-list', disk: () => makeDisk({ sw: swText(O_ON), hist: histText([E_O_ON]) }), err: oddError, ops: 'writeSwitch,unlinkSwitch', hist: [E_O_ON] },
  ], async (c) => {
    const disk = c.disk();
    const r = await post(disk, false, { session: adminSession(), writeError: c.err });
    const p = [];
    if (r.res.statusCode !== 200 || exact(r.res.body) !== exact(UNRECORDED_OFF)) p.push(`should answer 200 ${show(UNRECORDED_OFF)} (D11); answered ${showRes(r.res)}`);
    const ops = writeOps(r.calls).join(',');
    if (ops !== c.ops) p.push(`the writes should be exactly ${show(c.ops)} — unlink after the failed write, no fold (D2 step 5); they were ${show(ops)}`);
    if (disk.sw !== null) p.push(`switch.json should be gone (it reads as off); it holds ${show(disk.sw)}`);
    if (exact(diskHistory(disk)) !== exact({ version: 1, changes: c.hist })) p.push(`the history recorded before should survive as ${show({ version: 1, changes: c.hist })}; it is ${show(diskHistory(disk))}`);
    let g;
    try { g = (await getRecord(disk)).res; } catch (e) { p.push(`the GET after failed: ${firstLine(e)}`); }
    const want = { success: true, ...rec('unrecorded-off', { latest: P, history: [P, ...c.hist] }) };
    if (g && exact(g.body) !== exact(want)) p.push(`the GET should answer ${show(want)}; it answered ${showRes(g)}`);
    p.push(...leakProblems(c.name, r.res));
    report(p);
  });
});

test('SR22: an off whose write and unlink both fail answers 500 exactly { success: false, error: "could not write or remove the switch: <write code>, <unlink code>", code, unlinkCode }, each code allow-listed (a code off it reads "error"), and runs no fold [AC-4 "Refused or failed … the panel shows the reason"; ADR 0005 D2 step 5 ("If the unlink fails too, answer 500 as today"), D11 ("plus unlinkCode on the double failure")]', async () => {
  await cases([
    { name: 'ENOSPC then EACCES', err: enospc, unlinkErr: () => fsError('EACCES', SW_FILE()), want: { success: false, error: 'could not write or remove the switch: ENOSPC, EACCES', code: 'ENOSPC', unlinkCode: 'EACCES' } },
    { name: 'codes off the allow-list on both', err: oddError, unlinkErr: oddError, want: { success: false, error: 'could not write or remove the switch: error, error', code: 'error', unlinkCode: 'error' } },
  ], async (c) => {
    const disk = makeDisk({ sw: swText(O_ON), hist: histText([E_O_ON]) });
    const r = await post(disk, false, { writeError: c.err, unlinkError: c.unlinkErr });
    const p = [];
    if (r.res.statusCode !== 500 || exact(r.res.body) !== exact(c.want)) p.push(`should answer 500 ${show(c.want)}; answered ${showRes(r.res)}`);
    const ops = writeOps(r.calls).join(',');
    if (ops !== 'writeSwitch,unlinkSwitch') p.push(`the writes should be exactly writeSwitch, unlinkSwitch — no fold; they were ${show(ops)}`);
    p.push(...leakProblems(c.name, r.res));
    report(p);
  });
});

test('SR23: an off that cannot be recorded over the pre-story-5 change — with D10\'s version-1 switch.json and no history file, the pre-fold stores that change first, so after the failed write and the unlink the GET shows an unrecorded off above it; and when the pre-fold fails too (residual (a), accepted at Architecture) the GET shows the never-switched state — in both, the answer says not recorded and the earlier change is never shown as the latest [AC-5 "The history recorded before it survives" — departed from by residual (a), story 5 "Accepted at Architecture"; ADR 0005 § Consequences residual (a); § Seams: "A version 1 file and a failed off. With no history file and the pre-fold succeeding, the history keeps that change. With the pre-fold failing too, it is residual (a)"]', async () => {
  await cases([
    { name: 'the pre-fold succeeds', historyWriteError: undefined, ops: 'pre-fold,writeSwitch,unlinkSwitch', hist: { version: 1, changes: [V1_ENTRY] }, get: rec('unrecorded-off', { latest: P, history: [P, V1_ENTRY] }) },
    { name: 'the pre-fold fails too: residual (a)', historyWriteError: () => true, ops: 'pre-fold,writeSwitch,unlinkSwitch', hist: null, get: rec('never-switched') },
  ], async (c) => {
    const disk = makeDisk({ sw: V1_LOCAL_TEXT });
    const r = await post(disk, false, { session: adminSession(), writeError: enospc, historyWriteError: c.historyWriteError });
    const p = [];
    if (r.res.statusCode !== 200 || exact(r.res.body) !== exact(UNRECORDED_OFF)) p.push(`should answer 200 ${show(UNRECORDED_OFF)}; answered ${showRes(r.res)}`);
    const ops = writeOps(r.calls).join(',');
    if (ops !== c.ops) p.push(`the writes should be exactly ${show(c.ops)}; they were ${show(ops)}`);
    if (exact(diskHistory(disk)) !== exact(c.hist)) p.push(`switch-history.json should be ${show(c.hist)}; it is ${show(diskHistory(disk))}`);
    let g;
    try { g = (await getRecord(disk)).res; } catch (e) { p.push(`the GET after failed: ${firstLine(e)}`); }
    const want = { success: true, ...c.get };
    if (g && exact(g.body) !== exact(want)) p.push(`the GET should answer ${show(want)}; it answered ${showRes(g)}`);
    if (g && g.body && exact(g.body.latest) === exact(V1_ENTRY)) p.push('the GET shows the pre-story-5 change as the latest after an off');
    report(p);
  });
});

test('SR24: a read error on switch.json — for an on the answer is 500 "could not read the switch: <code>" and nothing is written, folded or unlinked, since the server cannot tell whether the path is already on; for an off the change goes on (off means off): switch.json is written off, and the stored history is folded under it [AC-4; ADR 0005 D2 step 2 ("A read error on prev"), D11 ("A read error on prev for an on answers 500 could not read the switch: <code>")]', async () => {
  await cases([
    { name: 'on, EIO', on: true, code: 'EIO' },
    { name: 'on, EACCES', on: true, code: 'EACCES' },
    { name: 'off, EIO', on: false, code: 'EIO' },
  ], async (c) => {
    const disk = makeDisk({ sw: fsError(c.code, SW_FILE()), hist: histText([E_O_ON]) });
    const r = await post(disk, c.on, { session: adminSession() });
    const p = [];
    if (c.on) {
      const b = r.res.body || {};
      if (r.res.statusCode !== 500 || b.success !== false || b.error !== `could not read the switch: ${c.code}`) p.push(`should answer 500 { success: false, error: "could not read the switch: ${c.code}" }; answered ${showRes(r.res)}`);
      if (has(b, 'code') && b.code !== c.code) p.push(`the answer's code should be the allow-listed ${show(c.code)}; it is ${show(b.code)}`);
      if (r.calls.writes.length) p.push(`nothing should be written, folded or unlinked; the writes were ${show(writeOps(r.calls))}`);
    } else {
      if (r.res.statusCode !== 200 || exact(r.res.body) !== exact(recordedAnswer(false))) p.push(`should answer 200 ${show(recordedAnswer(false))}; answered ${showRes(r.res)}`);
      const w = switchArgs(r.calls)[0];
      if (exact(w) !== exact(rec2(false, T0, 'admin', ADMIN, null))) p.push(`writeSwitch should get ${show(rec2(false, T0, 'admin', ADMIN, null))}; it got ${show(w)}`);
      const ops = writeOps(r.calls).join(',');
      if (ops !== 'writeSwitch,fold') p.push(`the writes should be writeSwitch then the fold (the base is the stored history, already in place); they were ${show(ops)}`);
      const want = { version: 1, changes: [ent(false, T0, 'admin', ADMIN), E_O_ON] };
      if (exact(diskHistory(disk)) !== exact(want)) p.push(`switch-history.json should hold ${show(want)}; it holds ${show(diskHistory(disk))}`);
    }
    p.push(...leakProblems(c.name, r.res));
    report(p);
  });
});

test('SR25: while switch-history.json gives a read error, a change still lands in switch.json and answers recorded, but nothing writes the history in that request — no pre-fold and no fold — for an on and an off [ADR 0005 D2 step 3 ("If hist gave a readError, base is null and no history write happens in this request. That is residual (b)"); § Consequences: "A failed history write never fails a change"]', async () => {
  await cases([
    { name: 'an on', on: true, disk: () => makeDisk({ sw: swText(A_OFF), hist: fsError('EIO', HIST_FILE()) }) },
    { name: 'an off', on: false, disk: () => makeDisk({ sw: swText(O_ON), hist: fsError('EIO', HIST_FILE()) }) },
  ], async (c) => {
    const disk = c.disk();
    const r = await post(disk, c.on);
    const p = [];
    if (r.res.statusCode !== 200 || exact(r.res.body) !== exact(recordedAnswer(c.on))) p.push(`should answer 200 ${show(recordedAnswer(c.on))}; answered ${showRes(r.res)}`);
    const ops = writeOps(r.calls).join(',');
    if (ops !== 'writeSwitch') p.push(`the only write should be writeSwitch — no history write while the history gives a read error; they were ${show(ops)}`);
    if (!(disk.hist instanceof Error)) p.push(`switch-history.json was written: ${show(disk.hist)}`);
    report(p);
  });
});

test('SR26: a damaged history keeps the previous change — with switch-history.json that does not parse, or whose changes is not an array, the pre-fold writes exactly { version: 1, changes: [the previous change] } (a damaged history counts as having no valid entries), then switch.json, then the fold with the new change above it [AC-5 "The history recorded before it survives"; ADR 0005 D2 step 3 ("A damaged history counts as having no valid entries"); § Seams: "A damaged history keeps prev"]', async () => {
  await cases([
    { name: 'not JSON', hist: '{"version":1,"changes":[{"on":tr' },
    { name: 'changes not an array', hist: '{"version":1,"changes":"x"}\n' },
    { name: 'not an object', hist: '[]\n' },
  ], async (c) => {
    const disk = makeDisk({ sw: swText(O_ON), hist: c.hist });
    const r = await post(disk, false, { session: adminSession() });
    const p = [];
    if (r.res.statusCode !== 200 || exact(r.res.body) !== exact(recordedAnswer(false))) p.push(`should answer 200 ${show(recordedAnswer(false))}; answered ${showRes(r.res)}`);
    const ops = writeOps(r.calls).join(',');
    if (ops !== 'pre-fold,writeSwitch,fold') p.push(`the writes should be pre-fold, writeSwitch, fold; they were ${show(ops)}`);
    const pre = historyArgs(r.calls, 'pre-fold')[0];
    if (exact(pre) !== exact({ version: 1, changes: [E_O_ON] })) p.push(`the pre-fold should write ${show({ version: 1, changes: [E_O_ON] })}; it wrote ${show(pre)}`);
    const want = { version: 1, changes: [ent(false, T0, 'admin', ADMIN), E_O_ON] };
    if (exact(diskHistory(disk)) !== exact(want)) p.push(`switch-history.json should end as ${show(want)}; it is ${show(diskHistory(disk))}`);
    report(p);
  });
});

test('SR27: residual (b), accepted at Architecture — while the history gives a read error, two changes land in switch.json and neither writes the history; the first change after the error clears pre-folds only the latest of them, so the history then reads [the new change, the second, …what was stored] and the first change of the spell is lost from it [AC-5 "The history recorded before it survives" — departed from by residual (b), story 5 "Accepted at Architecture"; ADR 0005 § Consequences residual (b): "Every change in that spell except the last is lost from the history. The first change after the error clears pre-folds only the latest one"; § Seams: "A read-error spell of two changes loses the first"]', async () => {
  const h = routeFn('handleRealtimeSwitch');
  const E0 = ent(true, T0 - 2 * HOUR, 'owner', OWNER);
  const stored = histText([E0]);
  const disk = makeDisk({ sw: swText(rec2(true, T0 - 2 * HOUR, 'owner', OWNER, T0 - 2 * HOUR)), hist: fsError('EIO', HIST_FILE()) });
  const E1 = ent(false, T0 - HOUR, 'admin', ADMIN);
  const E2 = ent(true, T0 - 30 * MIN, 'owner', OWNER);
  const E3 = ent(false, T0, 'admin', ADMIN);
  const p = [];
  const c1 = await post(disk, false, { handler: h, session: adminSession(), now: T0 - HOUR });
  const c2 = await post(disk, true, { handler: h, now: T0 - 30 * MIN });
  for (const [label, r, on, ms] of [['the first change of the spell', c1, false, T0 - HOUR], ['the second', c2, true, T0 - 30 * MIN]]) {
    if (r.res.statusCode !== 200 || exact(r.res.body) !== exact(recordedAnswer(on, ms))) p.push(`${label} should answer 200 ${show(recordedAnswer(on, ms))}; answered ${showRes(r.res)}`);
    if (writeOps(r.calls).join(',') !== 'writeSwitch') p.push(`${label} should write only switch.json; the writes were ${show(writeOps(r.calls))}`);
  }
  disk.hist = stored;
  const c3 = await post(disk, false, { handler: h, session: adminSession(), now: T0 });
  if (writeOps(c3.calls).join(',') !== 'pre-fold,writeSwitch,fold') p.push(`the first change after the error clears should write pre-fold, writeSwitch, fold; it wrote ${show(writeOps(c3.calls))}`);
  const pre = historyArgs(c3.calls, 'pre-fold')[0];
  if (exact(pre) !== exact({ version: 1, changes: [E2, E0] })) p.push(`its pre-fold should write only the spell's latest change above what was stored, ${show({ version: 1, changes: [E2, E0] })}; it wrote ${show(pre)}`);
  const want = { version: 1, changes: [E3, E2, E0] };
  if (exact(diskHistory(disk)) !== exact(want)) p.push(`the history should end as ${show(want)}; it is ${show(diskHistory(disk))}`);
  if (JSON.stringify(diskHistory(disk)).includes(E1.at)) p.push('the first change of the spell is in the history, which residual (b) says it cannot be');
  report(p);
});

test('SR28: an unrecorded off, then a successful on, keeps the off\'s row — the off\'s failed write unlinks switch.json and answers recorded: false; the next on pre-folds exactly [the unrecorded-off placeholder, …the stored history], writes switch.json with onSince now, and folds above it, so the GET shows the on as the latest change and the off\'s row below it without who or when [AC-5 "History rows that were not recorded"; ADR 0005 D2 step 3 ("The base includes … the unrecorded-off placeholder when switch.json is missing after a recorded change"), D3 ("an unrecorded off keeps its row when later changes come"); § Seams: "An unrecorded off, then a successful on"]', async () => {
  const h = routeFn('handleRealtimeSwitch');
  const disk = makeDisk({ sw: swText(O_ON), hist: histText([E_O_ON]) });
  const p = [];
  const off = await post(disk, false, { handler: h, session: adminSession(), now: T0 - 30 * MIN, writeError: enospc });
  if (off.res.statusCode !== 200 || exact(off.res.body) !== exact(UNRECORDED_OFF)) p.push(`the off should answer 200 ${show(UNRECORDED_OFF)}; answered ${showRes(off.res)}`);
  const on = await post(disk, true, { handler: h, now: T0 });
  const NEW = ent(true, T0, 'owner', OWNER);
  if (on.res.statusCode !== 200 || exact(on.res.body) !== exact(recordedAnswer(true))) p.push(`the on should answer 200 ${show(recordedAnswer(true))}; answered ${showRes(on.res)}`);
  if (writeOps(on.calls).join(',') !== 'pre-fold,writeSwitch,fold') p.push(`the on should write pre-fold, writeSwitch, fold; it wrote ${show(writeOps(on.calls))}`);
  const pre = historyArgs(on.calls, 'pre-fold')[0];
  if (exact(pre) !== exact({ version: 1, changes: [P, E_O_ON] })) p.push(`the on's pre-fold should write ${show({ version: 1, changes: [P, E_O_ON] })}; it wrote ${show(pre)}`);
  const w = switchArgs(on.calls)[0];
  if (exact(w) !== exact(rec2(true, T0, 'owner', OWNER, T0))) p.push(`writeSwitch should get ${show(rec2(true, T0, 'owner', OWNER, T0))}; it got ${show(w)}`);
  let g;
  try { g = (await getRecord(disk)).res; } catch (e) { p.push(`the GET after failed: ${firstLine(e)}`); }
  const want = { success: true, ...rec('recorded', { on: true, latest: NEW, history: [NEW, P, E_O_ON] }) };
  if (g && exact(g.body) !== exact(want)) p.push(`the GET should answer ${show(want)}; it answered ${showRes(g)}`);
  report(p);
});

test('SR29: a failed history write never fails a change — a fold that fails leaves the change in switch.json, answers recorded: true, and the next successful change\'s pre-fold repairs the history; a pre-fold that fails is ignored and the fold still writes the base it computed, so the history ends right [ADR 0005 D2 step 4 ("A failure here is ignored. base stays in memory whether or not the write succeeded"), step 5 ("A failure there is ignored: switch.json holds the change, and the next successful change\'s pre-fold repairs the file"); § Consequences: "A failed history write never fails a change"]', async () => {
  const p = [];
  // A failed fold, repaired by the next change's pre-fold.
  {
    const h = routeFn('handleRealtimeSwitch');
    const disk = makeDisk({ sw: swText(O_ON), hist: histText([E_O_ON]) });
    const first = await post(disk, false, { handler: h, session: adminSession(), historyWriteError: (phase) => phase === 'fold' });
    const E1 = ent(false, T0, 'admin', ADMIN);
    if (first.res.statusCode !== 200 || exact(first.res.body) !== exact(recordedAnswer(false))) p.push(`a change whose fold fails should still answer 200 ${show(recordedAnswer(false))}; answered ${showRes(first.res)}`);
    if (disk.sw !== swText(rec2(false, T0, 'admin', ADMIN, null))) p.push(`switch.json should hold the change; it holds ${show(disk.sw)}`);
    if (exact(diskHistory(disk)) !== exact({ version: 1, changes: [E_O_ON] })) p.push(`the history should be as it was before the failed fold; it is ${show(diskHistory(disk))}`);
    const second = await post(disk, true, { handler: h, now: T0 + MIN });
    const E2 = ent(true, T0 + MIN, 'owner', OWNER);
    const pre = historyArgs(second.calls, 'pre-fold')[0];
    if (exact(pre) !== exact({ version: 1, changes: [E1, E_O_ON] })) p.push(`the next change's pre-fold should repair the history to ${show({ version: 1, changes: [E1, E_O_ON] })}; it wrote ${show(pre)}`);
    if (exact(diskHistory(disk)) !== exact({ version: 1, changes: [E2, E1, E_O_ON] })) p.push(`after the next change the history should be ${show({ version: 1, changes: [E2, E1, E_O_ON] })}; it is ${show(diskHistory(disk))}`);
  }
  // A failed pre-fold, ignored.
  {
    const disk = makeDisk({ sw: swText(O_ON) });
    const r = await post(disk, false, { session: adminSession(), historyWriteError: (phase) => phase === 'pre-fold' });
    if (r.res.statusCode !== 200 || exact(r.res.body) !== exact(recordedAnswer(false))) p.push(`a change whose pre-fold fails should still answer 200 ${show(recordedAnswer(false))}; answered ${showRes(r.res)}`);
    if (writeOps(r.calls).join(',') !== 'pre-fold,writeSwitch,fold') p.push(`after a failed pre-fold the change should still write switch.json and fold; the writes were ${show(writeOps(r.calls))}`);
    const want = { version: 1, changes: [ent(false, T0, 'admin', ADMIN), E_O_ON] };
    if (exact(diskHistory(disk)) !== exact(want)) p.push(`the history should end as ${show(want)}; it is ${show(diskHistory(disk))}`);
  }
  report(p);
});

test('SR30: last change wins, whoever made it — an admin turns back on what the owner turned off, and the owner turns back on what an admin turned off; each change is admitted and recorded, and the GET shows the second as the latest above the first [AC-4 "Last change wins, whoever made it: an admin may turn back on what the owner turned off, and the other way round"; ADR 0005 D5]', async () => {
  await cases([
    { name: 'the owner turns it off, then an admin on', first: { session: ownerSession(), role: 'owner', pk: OWNER }, second: { session: adminSession(), role: 'admin', pk: ADMIN } },
    { name: 'an admin turns it off, then the owner on', first: { session: adminSession(), role: 'admin', pk: ADMIN }, second: { session: ownerSession(), role: 'owner', pk: OWNER } },
  ], async (c) => {
    const h = routeFn('handleRealtimeSwitch');
    const disk = makeDisk({ sw: swText(O_ON), hist: histText([E_O_ON]) });
    const p = [];
    const a = await post(disk, false, { handler: h, session: c.first.session, now: T0 });
    const b = await post(disk, true, { handler: h, session: c.second.session, now: T0 + MIN });
    if (a.res.statusCode !== 200 || exact(a.res.body) !== exact(recordedAnswer(false))) p.push(`the off should answer 200 ${show(recordedAnswer(false))}; answered ${showRes(a.res)}`);
    if (b.res.statusCode !== 200 || exact(b.res.body) !== exact(recordedAnswer(true, T0 + MIN))) p.push(`the on should answer 200 ${show(recordedAnswer(true, T0 + MIN))}; answered ${showRes(b.res)}`);
    const offE = ent(false, T0, c.first.role, c.first.pk);
    const onE = ent(true, T0 + MIN, c.second.role, c.second.pk);
    let g;
    try { g = (await getRecord(disk)).res; } catch (e) { p.push(`the GET after failed: ${firstLine(e)}`); }
    const want = { success: true, ...rec('recorded', { on: true, latest: onE, history: [onE, offE, E_O_ON] }) };
    if (g && exact(g.body) !== exact(want)) p.push(`the GET should answer ${show(want)}; it answered ${showRes(g)}`);
    report(p);
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════
// SR31–SR34 — refusals, the chain, and two changes at once (ADR 0005 D5, D9)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('SR31: a signed-out request is refused 401 exactly { success: false, error: "Not authenticated" } by both the POST and the GET on the switch path, and calls no dependency at all — no session, a loopback request (localTrusted, 127.0.0.1) with no session or an empty one, a session with no pubkey, an empty or non-string pubkey, and no session with a foreign Origin [AC-4 "It refuses everyone else, and changes and records nothing: a signed-out request"; AC-5 "A signed-out reader … gets no who from any route"; ADR 0005 D5 ("A 401 calls no dependency"), D6 ("The same holds for refusals on D6\'s GET")]', async () => {
  const rows = [
    ['no session', { session: undefined }],
    ['a loopback request with no session', { session: undefined, localTrusted: true, ip: '127.0.0.1' }],
    ['a loopback request with an empty session', { session: {}, localTrusted: true, ip: '127.0.0.1' }],
    ['a session with no pubkey', { session: { authenticated: true } }],
    ['a session with an empty pubkey', { session: { authenticated: true, pubkey: '' } }],
    ['a session whose pubkey is not a string', { session: { authenticated: true, pubkey: 7 } }],
    ['no session, a foreign Origin', { session: undefined, origin: 'https://evil.example' }],
  ];
  const p = [];
  for (const [label, o] of rows) {
    const disk = makeDisk({ sw: swText(O_ON), hist: histText([E_O_ON]) });
    const before = snapshotDisk(disk);
    try { p.push(...refusedProblems(`POST, ${label}`, await post(disk, true, o), 401, ERR_401, { disk, before })); } catch (e) { p.push(`POST, ${label}: ${firstLine(e)}`); }
    try { p.push(...refusedProblems(`GET, ${label}`, await getRecord(disk, o), 401, ERR_401, { disk, before })); } catch (e) { p.push(`GET, ${label}: ${firstLine(e)}`); }
  }
  report(p);
});

test('SR32: every other POST refusal changes and records nothing and calls only the owner and admin lookups — the role 403 exactly { success: false, error: "Owner or admin access required" } for a signed-in stranger (also on loopback, also with admin session flags but no admin-list entry), the owner or an admin whose authenticated is not true, either in upper case, an admin list holding the admin in upper case, an owner whose lookup throws, an admin whose lookup throws, an admin removed from the list since an earlier change, and a configured owner that is not lowercase 64-hex; the cross-site 403 for the owner and an admin; 415 and 400 for an admin and the owner — with no who in any body, no signal, and the role check before the cross-site one [AC-4 "It refuses everyone else, and changes and records nothing"; "A refusal can come from … a viewer who is no longer owner or admin"; ADR 0005 D5 ("Every other refusal … calls only the owner and admin lookups"; "Both lists are re-read on every request"); ADR 0005 § Consequences, RR10\'s revision ("a stranger carries admin session flags with no admin-list entry, refused with 403")]', async () => {
  const throws = (what) => () => { throw new Error(`could not read /etc/brainstorm.conf (${what})`); };
  const rows = [
    ['a signed-in stranger', { session: strangerSession() }, 403, ERR_403],
    ['a stranger on loopback', { session: strangerSession(), localTrusted: true, ip: '127.0.0.1' }, 403, ERR_403],
    ['a stranger with admin session flags and no admin-list entry', { session: { authenticated: true, pubkey: STRANGER, isAdmin: true, admin: true, role: 'admin' } }, 403, ERR_403],
    ['the owner, authenticated false', { session: { authenticated: false, pubkey: OWNER } }, 403, ERR_403],
    ['the owner, authenticated "true"', { session: { authenticated: 'true', pubkey: OWNER } }, 403, ERR_403],
    ['the owner, authenticated absent', { session: { pubkey: OWNER } }, 403, ERR_403],
    ['an admin, authenticated false', { session: { authenticated: false, pubkey: ADMIN } }, 403, ERR_403],
    ['an admin, authenticated 1', { session: { authenticated: 1, pubkey: ADMIN } }, 403, ERR_403],
    ['the owner in upper case', { session: { authenticated: true, pubkey: OWNER.toUpperCase() } }, 403, ERR_403],
    ['an admin in upper case', { session: { authenticated: true, pubkey: ADMIN.toUpperCase() } }, 403, ERR_403],
    ['an admin list holding the admin in upper case', { session: adminSession(), admins: [ADMIN.toUpperCase()] }, 403, ERR_403],
    ['the owner, whose lookup throws', { owner: throws('owner'), admins: [] }, 403, ERR_403],
    ['an admin, whose lookup throws', { session: adminSession(), admins: throws('admins') }, 403, ERR_403],
    ['an admin removed from the list', { session: adminSession(), admins: [OTHER_ADMIN] }, 403, ERR_403],
    ['a configured owner in upper case', { session: { authenticated: true, pubkey: OWNER.toUpperCase() }, owner: OWNER.toUpperCase(), admins: [] }, 403, ERR_403],
    ['a stranger, a foreign Origin (the role check first)', { session: strangerSession(), origin: 'https://evil.example' }, 403, ERR_403],
    ['the owner, a foreign Origin', { origin: 'https://evil.example' }, 403, ERR_XSITE],
    ['an admin, Origin null', { session: adminSession(), origin: 'null' }, 403, ERR_XSITE],
    ['an admin, a host that only starts with ours', { session: adminSession(), origin: `https://${HOST}.evil.test` }, 403, ERR_XSITE],
    ['an admin, a text/plain body', { session: adminSession(), contentType: 'text/plain' }, 415, ERR_415],
    ['the owner, no Content-Type', { contentType: null }, 415, ERR_415],
    ['an admin, on "true"', { session: adminSession(), body: { on: 'true' } }, 400, ERR_400],
    ['the owner, no on', { body: {} }, 400, ERR_400],
  ];
  const h = routeFn('handleRealtimeSwitch');
  const p = [];
  // An admin admitted once, then removed, is refused on the next request (the lists are re-read every time).
  const earlier = await post(makeDisk(), true, { handler: h, session: adminSession() });
  if (earlier.res.statusCode !== 200) p.push(`an admin on the list should be admitted first (200); answered ${showRes(earlier.res)}`);
  for (const [label, o, status, body] of rows) {
    const disk = makeDisk({ sw: swText(O_ON), hist: histText([E_O_ON]) });
    const before = snapshotDisk(disk);
    try {
      const { result: r, kills } = await withKills(() => post(disk, true, { handler: h, ...o }));
      p.push(...refusedProblems(label, r, status, body, { disk, before }));
      if (kills.length) p.push(`${label}: a signal was sent: ${show(kills)}`);
    } catch (e) { p.push(`${label}: ${firstLine(e)}`); }
  }
  report(p);
});

test('SR33: refusals are answered before joining the chain — while an admin\'s admitted off is pending on a held switch write, a signed-out POST (401), a stranger (403), the owner from another site (403), an admin\'s text/plain body (415) and the owner\'s on "true" (400) are each answered at once with their own body, touching no file; the held change then completes and is recorded [ADR 0005 D9 ("Refusals are answered before joining the chain"), D5 ("No refusal … joins D9\'s chain")]', async () => {
  const h = routeFn('handleRealtimeSwitch');
  const disk = makeDisk({ sw: swText(O_ON), hist: histText([E_O_ON]) });
  let release;
  const hold = new Promise((r) => { release = r; });
  const pendingRes = fakeRes();
  const pendingBundle = recordBundle(disk, { wrap: (name, apply) => hold.then(apply) });
  let pendingThrew = null;
  const pendingCall = (async () => h(switchReq({ on: false }, { session: adminSession() }), pendingRes, pendingBundle.deps))().catch((e) => { pendingThrew = e; });
  const rows = [
    ['signed out', { on: true }, { session: undefined }, 401, ERR_401],
    ['a signed-in stranger', { on: true }, { session: strangerSession() }, 403, ERR_403],
    ['the owner from another site', { on: true }, { origin: 'https://evil.example' }, 403, ERR_XSITE],
    ['an admin with a text/plain body', { on: true }, { session: adminSession(), contentType: 'text/plain' }, 415, ERR_415],
    ['the owner with on "true"', { on: 'true' }, {}, 400, ERR_400],
  ];
  const p = [];
  try {
    await sleep(20);
    if (pendingRes.finished) p.push(`the admin's off should still be pending on its held switch write; it already answered ${showRes(pendingRes)}${pendingThrew ? ` (threw ${firstLine(pendingThrew)})` : ''}`);
    for (const [label, body, o, status, want] of rows) {
      const b = recordBundle(disk, {});
      const res = fakeRes();
      (async () => h(switchReq(body, o), res, b.deps))().catch(() => {});
      await Promise.race([res.done, sleep(300)]);
      if (!res.finished) { p.push(`${label}: no answer within 300 ms while another change was pending — it joined the chain (D9: refusals are answered before joining it)`); continue; }
      p.push(...refusedProblems(label, { res, calls: b.calls }, status, want, {}));
    }
  } finally {
    release();
    await Promise.race([pendingRes.done, sleep(2000)]);
    await pendingCall;
  }
  if (!pendingRes.finished) p.push('the held change never answered after its write was released');
  else if (pendingRes.statusCode !== 200 || exact(pendingRes.body) !== exact(recordedAnswer(false))) p.push(`the held change should answer 200 ${show(recordedAnswer(false))}; answered ${showRes(pendingRes)}`);
  checkNoStrays('SR33');
  report(p);
});

test('SR34: two changes at once are serialised — two POSTs issued without awaiting, the first with slow async writers: both land in order (the first\'s switch write and fold before the second\'s), the last state wins, the second\'s onSince comes from the first\'s on, and the history holds both, newest first; a first change that fails does not break the chain, and the second still lands [AC-4 "Last change wins"; AC-5; ADR 0005 D9 ("both land in order, the last write wins, and both are in the history"; "A failure never breaks the chain"); § Seams: "Concurrency"]', async () => {
  const slow = (ms) => (name, apply) => sleep(ms).then(apply);
  await cases([
    {
      name: 'the owner turns it on, an admin on at once',
      first: { on: true, o: {} }, second: { on: true, o: { session: adminSession() } },
      status1: 200, want1: recordedAnswer(true, T0), want2: recordedAnswer(true, T0 + 5 * SEC),
      sw: rec2(true, T0 + 5 * SEC, 'admin', ADMIN, T0),
      hist: [ent(true, T0 + 5 * SEC, 'admin', ADMIN), ent(true, T0, 'owner', OWNER)],
      landed: ['A:writeSwitch', 'A:fold', 'B:writeSwitch', 'B:fold'],
    },
    {
      name: 'the owner turns it on, an admin off at once',
      first: { on: true, o: {} }, second: { on: false, o: { session: adminSession() } },
      status1: 200, want1: recordedAnswer(true, T0), want2: recordedAnswer(false, T0 + 5 * SEC),
      sw: rec2(false, T0 + 5 * SEC, 'admin', ADMIN, null),
      hist: [ent(false, T0 + 5 * SEC, 'admin', ADMIN), ent(true, T0, 'owner', OWNER)],
      landed: ['A:writeSwitch', 'A:fold', 'B:writeSwitch', 'B:fold'],
    },
    {
      name: 'the owner\'s on fails slowly, an admin\'s on at once',
      first: { on: true, o: { writeError: enospc } }, second: { on: true, o: { session: adminSession() } },
      status1: 500, want1: { success: false, error: 'could not write the switch: ENOSPC', code: 'ENOSPC' },
      want2: recordedAnswer(true, T0 + 5 * SEC),
      sw: rec2(true, T0 + 5 * SEC, 'admin', ADMIN, T0 + 5 * SEC),
      hist: [ent(true, T0 + 5 * SEC, 'admin', ADMIN)],
      landed: ['B:writeSwitch', 'B:fold'],
    },
  ], async (c) => {
    const h = routeFn('handleRealtimeSwitch');
    const disk = makeDisk();
    const landed = [];
    const a = recordBundle(disk, { ...c.first.o, now: T0, wrap: slow(40), landed, label: 'A:' });
    const b = recordBundle(disk, { ...c.second.o, now: T0 + 5 * SEC, landed, label: 'B:' });
    const pa = callHandler(h, switchReq({ on: c.first.on }, c.first.o), a.deps);
    const pb = callHandler(h, switchReq({ on: c.second.on }, c.second.o), b.deps);
    const [ra, rb] = await Promise.all([pa, pb]);
    checkNoStrays(c.name);
    const p = [];
    // Each row names its own first status (review round 1, blocking 1): gate-result-record's C9 refuses deriving a
    // status from a body's success flag in any test file (row 263), so it is never derived from want1 here.
    if (ra.statusCode !== c.status1 || exact(ra.body) !== exact(c.want1)) {
      p.push(`the first should answer ${c.status1} ${show(c.want1)}; answered ${showRes(ra)}`);
    }
    if (rb.statusCode !== 200 || exact(rb.body) !== exact(c.want2)) p.push(`the second should answer 200 ${show(c.want2)}; answered ${showRes(rb)}`);
    if (exact(landed) !== exact(c.landed)) p.push(`the writes should land in order ${show(c.landed)}; they landed ${show(landed)}`);
    const w2 = switchArgs(b.calls)[0];
    if (exact(w2) !== exact(c.sw)) p.push(`the second's switch record should be ${show(c.sw)}; writeSwitch got ${show(w2)}`);
    if (disk.sw !== swText(c.sw)) p.push(`switch.json should end as the second's change ${show(swText(c.sw))}; it is ${show(disk.sw)}`);
    if (exact(diskHistory(disk)) !== exact({ version: 1, changes: c.hist })) p.push(`the history should end as ${show({ version: 1, changes: c.hist })}; it is ${show(diskHistory(disk))}`);
    report(p);
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════
// SR35–SR40 — GET on the switch path (ADR 0005 D6)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('SR35: GET on the switch path answers the owner and an admin 200 exactly { success: true, on, switchUnreadable, historyUnreadable, state, latest, history } — switchRecord over what it read — reading through the injected readFile exactly <stateDir>/realtime/switch-history.json and then <stateDir>/realtime/switch.json, and never calls a writer: for an instance never switched, the owner\'s on over older changes, an admin\'s off with no history file, the pre-story-5 change, an unrecorded off, and a damaged switch.json [AC-5 "What the panel shows … the latest change … the last 10 changes, newest first"; "Who may read it. Only a signed-in owner or admin"; ADR 0005 D3, D6 ("It writes nothing, and answers 200 …")]', async () => {
  const rows = [
    { name: 'never switched', disk: () => makeDisk(), want: rec('never-switched') },
    { name: 'the owner\'s on over older changes', disk: () => makeDisk({ sw: swText(O_ON), hist: histText([E_O_ON, H1]) }), want: rec('recorded', { on: true, latest: E_O_ON, history: [E_O_ON, H1] }) },
    { name: 'an admin\'s off, no history file', disk: () => makeDisk({ sw: swText(A_OFF) }), want: rec('recorded', { latest: E_A_OFF, history: [E_A_OFF] }) },
    { name: 'the pre-story-5 change', disk: () => makeDisk({ sw: V1_LOCAL_TEXT }), want: rec('recorded', { latest: V1_ENTRY, history: [V1_ENTRY] }) },
    { name: 'an unrecorded off', disk: () => makeDisk({ hist: histText([E_O_ON]) }), want: rec('unrecorded-off', { latest: P, history: [P, E_O_ON] }) },
    { name: 'a damaged switch.json', disk: () => makeDisk({ sw: '{"version":2,"on":tr', hist: histText([H1]) }), want: rec('switch-unreadable', { switchUnreadable: true, history: [H1] }) },
  ];
  const list = [];
  for (const r of rows) for (const [who, session] of [['the owner', ownerSession()], ['an admin', adminSession()]]) list.push({ ...r, name: `${who}, ${r.name}`, session });
  await cases(list, async (c) => {
    const disk = c.disk();
    const before = snapshotDisk(disk);
    const g = await getRecord(disk, { session: c.session });
    const p = [];
    const want = { success: true, ...c.want };
    if (g.res.statusCode !== 200 || exact(g.res.body) !== exact(want)) p.push(`should answer 200 ${show(want)}; answered ${showRes(g.res)}`);
    if (exact(g.calls.readFile) !== exact([HIST_FILE(), SW_FILE()])) p.push(`it should read exactly switch-history.json then switch.json through the injected readFile (D6); it read ${show(g.calls.readFile)}`);
    if (g.calls.writes.length) p.push(`it called a writer: ${show(writeOps(g.calls))} (D6: "It writes nothing")`);
    if (exact(snapshotDisk(disk)) !== exact(before)) p.push('the record changed');
    p.push(...leakProblems(c.name, g.res));
    report(p);
  });
});

test('SR36: the GET reads the history before the switch, so a change that lands between its two reads still gives a consistent answer — with a readFile that lets an admin\'s POST complete after the first read, the answer shows that change as the latest and the history read before it beneath, never the earlier change as the latest; for a recorded off and for an off that could not be recorded [ADR 0005 D6 ("switch-history.json first, then switch.json … The order is safe because of D2\'s invariant"); § Seams: "Pin this with a readFile that lets a POST complete between the GET\'s two reads"]', async () => {
  await cases([
    { name: 'a recorded off lands between the reads', post: {}, want: rec('recorded', { latest: ent(false, T0, 'admin', ADMIN), history: [ent(false, T0, 'admin', ADMIN), E_O_ON] }), postAnswer: recordedAnswer(false) },
    { name: 'an off that could not be recorded lands between the reads', post: { writeError: enospc }, want: rec('unrecorded-off', { latest: P, history: [P, E_O_ON] }), postAnswer: UNRECORDED_OFF },
  ], async (c) => {
    const mod = loadRoutes();
    const getH = need(mod, 'handleRealtimeSwitchRecord', ROUTES_REL);
    const postH = need(mod, 'handleRealtimeSwitch', ROUTES_REL);
    const disk = makeDisk({ sw: swText(O_ON), hist: histText([E_O_ON]) });
    let between = null;
    let started = false;
    const onRead = async () => {
      if (started) return;
      started = true;
      between = await post(disk, false, { handler: postH, session: adminSession(), ...c.post });
    };
    const g = await getRecord(disk, { handler: getH, onRead });
    const p = [];
    if (!between) p.push('no POST ran between the reads (the GET never read through the injected readFile)');
    else if (between.res.statusCode !== 200 || exact(between.res.body) !== exact(c.postAnswer)) p.push(`the POST between the reads should answer 200 ${show(c.postAnswer)}; answered ${showRes(between.res)}`);
    if (exact(g.calls.readFile) !== exact([HIST_FILE(), SW_FILE()])) p.push(`the GET should read switch-history.json, then switch.json; it read ${show(g.calls.readFile)}`);
    const want = { success: true, ...c.want };
    if (g.res.statusCode !== 200 || exact(g.res.body) !== exact(want)) p.push(`the GET should answer 200 ${show(want)}; answered ${showRes(g.res)}`);
    report(p);
  });
});

test('SR37: a file the GET cannot read is part of a 200 answer, never a 500 — a history read error with switch.json readable gives historyUnreadable and the latest change; a switch.json read error gives "switch-unreadable" with the stored history; switch.json missing with a history read error gives "unrecorded-off"; damaged texts read as the store maps them; both unreadable together; and no error code, message or path reaches the answer [AC-5; ADR 0005 D6 ("Each file\'s read error other than ENOENT is caught on its own and mapped as the store maps it … That covers state:\'switch-unreadable\' and historyUnreadable:true"); § Seams: "Read-error cases"]', async () => {
  await cases([
    { name: 'a history read error, switch.json readable', disk: () => makeDisk({ sw: swText(O_ON), hist: fsError('EIO', HIST_FILE()) }), want: rec('recorded', { on: true, historyUnreadable: true, latest: E_O_ON, history: [E_O_ON] }) },
    { name: 'a switch.json read error', disk: () => makeDisk({ sw: fsError('EIO', SW_FILE()), hist: histText([E_O_ON, H1]) }), want: rec('switch-unreadable', { switchUnreadable: true, history: [E_O_ON, H1] }) },
    { name: 'a switch.json read error whose code is off the allow-list', disk: () => makeDisk({ sw: oddError(), hist: histText([E_A_OFF]) }), want: rec('switch-unreadable', { switchUnreadable: true, history: [E_A_OFF] }) },
    { name: 'switch.json missing, a history read error', disk: () => makeDisk({ hist: fsError('EACCES', HIST_FILE()) }), want: rec('unrecorded-off', { historyUnreadable: true, latest: P, history: [P] }) },
    { name: 'a history that does not parse', disk: () => makeDisk({ sw: swText(A_OFF), hist: '{"version":1,"changes":[' }), want: rec('recorded', { historyUnreadable: true, latest: E_A_OFF, history: [E_A_OFF] }) },
    { name: 'a history whose changes is not an array', disk: () => makeDisk({ sw: swText(A_OFF), hist: '{"version":1,"changes":"x"}\n' }), want: rec('recorded', { historyUnreadable: true, latest: E_A_OFF, history: [E_A_OFF] }) },
    { name: 'a switch.json whose on is not a boolean', disk: () => makeDisk({ sw: '{"version":2,"on":"true"}\n', hist: histText([H1]) }), want: rec('switch-unreadable', { switchUnreadable: true, history: [H1] }) },
    { name: 'both read errors', disk: () => makeDisk({ sw: fsError('EIO', SW_FILE()), hist: fsError('EIO', HIST_FILE()) }), want: rec('switch-unreadable', { switchUnreadable: true, historyUnreadable: true }) },
  ], async (c) => {
    const g = await getRecord(c.disk(), { session: adminSession() });
    const want = { success: true, ...c.want };
    const p = [];
    if (g.res.statusCode !== 200 || exact(g.res.body) !== exact(want)) p.push(`should answer 200 ${show(want)}; answered ${showRes(g.res)}`);
    p.push(...leakProblems(c.name, g.res, ['EIO', 'EACCES', 'simulated']));
    report(p);
  });
});

test('SR38: the GET answers 500 "could not read the switch record: <code>" only for a throw outside the two file reads — a stateDir() that throws EACCES with a path in its message answers exactly that sentence with EACCES, a code off the allow-list reads "error", nothing is written, and no path reaches the answer [ADR 0005 D6 ("It answers 500 could not read the switch record: <code> only for a throw outside the two file reads")]', async () => {
  await cases([
    { name: 'EACCES', err: () => fsError('EACCES', '/var/lib/brainstorm/tagging-edges'), code: 'EACCES' },
    { name: 'a code off the allow-list', err: oddError, code: 'error' },
  ], async (c) => {
    const g = await getRecord(makeDisk({ sw: swText(O_ON) }), { stateDirError: c.err });
    const b = g.res.body || {};
    const p = [];
    if (g.res.statusCode !== 500 || b.success !== false || b.error !== `could not read the switch record: ${c.code}`) p.push(`should answer 500 { success: false, error: "could not read the switch record: ${c.code}" }; answered ${showRes(g.res)}`);
    if (g.calls.writes.length) p.push(`it called a writer: ${show(writeOps(g.calls))}`);
    p.push(...leakProblems(c.name, g.res, ['brainstorm']));
    report(p);
  });
});

test('SR39: the GET refuses everyone but a signed-in owner or admin from this site, with the drift route\'s exact bodies and no who, reading no file — the role 403 for a signed-in stranger (also with admin session flags), the owner or an admin whose authenticated is not true, and an admin removed from the list; the cross-site 403 for the owner and an admin; the role check before the cross-site one — calling only the owner and admin lookups [AC-5 "Only a signed-in owner or admin may read who made a change … A signed-out reader, or a signed-in user who is neither, gets no who from any route"; ADR 0005 D6 ("behind the same gate with sameHost included. So no foreign page can read who through the reflecting CORS"), D5; § Seams: "Refusals: 401 signed out; 403 for a stranger, for authenticated !== true, and cross-site"]', async () => {
  const rows = [
    ['a signed-in stranger', { session: strangerSession() }, ERR_403],
    ['a stranger with admin session flags', { session: { authenticated: true, pubkey: STRANGER, isAdmin: true, admin: true, role: 'admin' } }, ERR_403],
    ['the owner, authenticated false', { session: { authenticated: false, pubkey: OWNER } }, ERR_403],
    ['the owner, authenticated absent', { session: { pubkey: OWNER } }, ERR_403],
    ['an admin, authenticated "true"', { session: { authenticated: 'true', pubkey: ADMIN } }, ERR_403],
    ['an admin removed from the list', { session: adminSession(), admins: [] }, ERR_403],
    ['a stranger, a foreign Origin (the role check first)', { session: strangerSession(), origin: 'https://evil.example' }, ERR_403],
    ['the owner, a foreign Origin', { origin: 'https://evil.example' }, ERR_XSITE],
    ['an admin, Origin null', { session: adminSession(), origin: 'null' }, ERR_XSITE],
    ['an admin, a host that only starts with ours', { session: adminSession(), origin: `https://${HOST}.evil.test` }, ERR_XSITE],
  ];
  const p = [];
  for (const [label, o, body] of rows) {
    const disk = makeDisk({ sw: swText(O_ON), hist: histText([E_O_ON]) });
    try { p.push(...refusedProblems(label, await getRecord(disk, o), 403, body, { disk, before: snapshotDisk(disk) })); } catch (e) { p.push(`${label}: ${firstLine(e)}`); }
  }
  report(p);
});

test('SR40: the GET never serves a full pubkey, even from a hand-edited file — a switch.json whose changedBy is the owner\'s full pubkey reads as a change not recorded (no who), and a history entry keyed by a full pubkey is dropped; the answer carries neither pubkey [AC-5 "who shows as owner or admin plus a shortened key"; ADR 0005 D1 ("key is 8 hex digits"), D3, D11 ("No answer carries a full pubkey")]', async () => {
  const fullSw = `{"version":2,"on":true,"changedAt":"${iso(T0)}","changedBy":"${OWNER}","role":"owner","onSince":"${iso(T0)}"}\n`;
  const fullHist = histText([{ on: false, at: iso(T0 - HOUR), role: 'admin', key: ADMIN }, H1]);
  const g = await getRecord(makeDisk({ sw: fullSw, hist: fullHist }));
  const PON = { on: true, at: null, role: null, key: null };
  const want = { success: true, ...rec('recorded', { on: true, latest: PON, history: [PON, H1] }) };
  const p = [];
  if (g.res.statusCode !== 200 || exact(g.res.body) !== exact(want)) p.push(`should answer 200 ${show(want)}; answered ${showRes(g.res)}`);
  p.push(...leakProblems('a hand-edited record', g.res));
  report(p);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════
// SR41–SR45 — ownerOrAdmin(req, d) (ADR 0005 D5)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════

/** d as drift.js's handler hands it to the gate: ownerPubkey() and getAdminPubkeys(), each call recorded. */
function gateDeps(o = {}) {
  const calls = [];
  const valueOf = (v) => (typeof v === 'function' ? v() : v);
  const owner = () => { calls.push('owner'); return valueOf(has(o, 'owner') ? o.owner : OWNER); };
  const admins = () => { calls.push('admins'); return valueOf(has(o, 'admins') ? o.admins : [ADMIN]); };
  return { d: { ownerPubkey: owner, getOwnerPubkey: owner, getAdminPubkeys: admins }, calls };
}
function gateReq(o = {}) {
  return fakeReq({ method: 'POST', url: SWITCH_PATH, headers: { host: o.host || HOST, origin: o.origin, 'content-type': 'application/json' }, session: has(o, 'session') ? o.session : ownerSession(), localTrusted: o.localTrusted, ip: o.ip });
}
/** Run ownerOrAdmin over rows of [label, request options, deps options, expected answer, lookups allowed?]. */
async function gateRows(rows) {
  const ownerOrAdmin = need(loadIndex(), 'ownerOrAdmin', INDEX_REL);
  const p = [];
  for (const [label, ro, dopt, want, lookupsAllowed] of rows) {
    const { d, calls } = gateDeps(dopt);
    let got;
    try { got = await ownerOrAdmin(gateReq(ro), d); } catch (e) { p.push(`${label}: threw ${firstLine(e)}`); continue; }
    if (exact(got) !== exact(want)) p.push(`${label}: should give ${show(want)}; gave ${show(got)}`);
    if (!lookupsAllowed && calls.length) p.push(`${label}: called ${show(calls)} (D5: a 401 calls no dependency)`);
  }
  report(p);
}
const admitted = (role, pubkey) => ({ ok: true, role, pubkey });
const refused = (body, status) => ({ ok: false, status, error: body.error });

test('SR41: ownerOrAdmin admits a signed-in owner as { ok: true, role: "owner", pubkey } and a signed-in admin as { ok: true, role: "admin", pubkey } — an admin among others, an admin with no owner configured or whose owner lookup throws, the owner whose admin lookup throws, and each with no Origin or a same-host one [ADR 0005 D5 ("It returns {ok:true, role, pubkey} or {ok:false, status, error}"; "an owner lookup that throws admits no owner, and an admin lookup that throws admits no admin"); § Seams: "ownerOrAdmin"]', async () => {
  const boom = () => { throw new Error('could not read /etc/brainstorm.conf'); };
  await gateRows([
    ['the owner', {}, {}, admitted('owner', OWNER), true],
    ['an admin', { session: adminSession() }, {}, admitted('admin', ADMIN), true],
    ['an admin among others', { session: adminSession() }, { admins: [OTHER_ADMIN, ADMIN] }, admitted('admin', ADMIN), true],
    ['an admin, no owner configured', { session: adminSession() }, { owner: null }, admitted('admin', ADMIN), true],
    ['an admin, the owner lookup throwing', { session: adminSession() }, { owner: boom }, admitted('admin', ADMIN), true],
    ['the owner, the admin lookup throwing', {}, { admins: boom }, admitted('owner', OWNER), true],
    ['the owner, a same-host Origin', { origin: `https://${HOST}` }, {}, admitted('owner', OWNER), true],
    ['an admin, a same-host Origin with a port', { session: adminSession(), origin: `http://${HOST}:7778`, host: `${HOST}:7778` }, {}, admitted('admin', ADMIN), true],
  ]);
});

test('SR42: ownerOrAdmin answers { ok: false, status: 401, error: "Not authenticated" } with no non-empty string session pubkey — no session, a loopback request with none or an empty one, no pubkey, an empty or non-string pubkey, and no session with a foreign Origin — without calling either lookup [ADR 0005 D5 ("401 Not authenticated when there is no non-empty string session.pubkey"; "A 401 calls no dependency")]', async () => {
  await gateRows([
    ['no session', { session: undefined }, {}, refused(ERR_401, 401), false],
    ['a loopback request with no session', { session: undefined, localTrusted: true, ip: '127.0.0.1' }, {}, refused(ERR_401, 401), false],
    ['a loopback request with an empty session', { session: {}, localTrusted: true, ip: '127.0.0.1' }, {}, refused(ERR_401, 401), false],
    ['no pubkey', { session: { authenticated: true } }, {}, refused(ERR_401, 401), false],
    ['an empty pubkey', { session: { authenticated: true, pubkey: '' } }, {}, refused(ERR_401, 401), false],
    ['a pubkey that is not a string', { session: { authenticated: true, pubkey: 7 } }, {}, refused(ERR_401, 401), false],
    ['no session, a foreign Origin', { session: undefined, origin: 'https://evil.example' }, {}, refused(ERR_401, 401), false],
  ]);
});

test('SR43: ownerOrAdmin answers { ok: false, status: 403, error: "Owner or admin access required" } for anyone who is not a signed-in owner or admin — the owner or an admin whose authenticated is false, "true", 1 or absent; a signed-in stranger (also with admin session flags); either in upper case; an admin list holding the admin in upper case; a configured owner that is not lowercase 64-hex; the owner whose lookup throws; an admin whose lookup throws [ADR 0005 D5 ("403 Owner or admin access required when session.authenticated !== true, or when the pubkey is neither the owner … nor in d.getAdminPubkeys()"; the drift route\'s order and bodies, drift.js:73-89)]', async () => {
  const boom = () => { throw new Error('could not read /etc/brainstorm.conf'); };
  const r403 = refused(ERR_403, 403);
  await gateRows([
    ['the owner, authenticated false', { session: { authenticated: false, pubkey: OWNER } }, {}, r403, true],
    ['the owner, authenticated "true"', { session: { authenticated: 'true', pubkey: OWNER } }, {}, r403, true],
    ['the owner, authenticated 1', { session: { authenticated: 1, pubkey: OWNER } }, {}, r403, true],
    ['the owner, authenticated absent', { session: { pubkey: OWNER } }, {}, r403, true],
    ['an admin, authenticated false', { session: { authenticated: false, pubkey: ADMIN } }, {}, r403, true],
    ['an admin, authenticated absent', { session: { pubkey: ADMIN } }, {}, r403, true],
    ['a signed-in stranger', { session: strangerSession() }, {}, r403, true],
    ['a stranger with admin session flags', { session: { authenticated: true, pubkey: STRANGER, isAdmin: true, admin: true, role: 'admin' } }, {}, r403, true],
    ['the owner in upper case', { session: { authenticated: true, pubkey: OWNER.toUpperCase() } }, {}, r403, true],
    ['an admin in upper case', { session: { authenticated: true, pubkey: ADMIN.toUpperCase() } }, {}, r403, true],
    ['an admin list holding the admin in upper case', { session: adminSession() }, { admins: [ADMIN.toUpperCase()] }, r403, true],
    ['a configured owner in upper case', { session: { authenticated: true, pubkey: OWNER.toUpperCase() } }, { owner: OWNER.toUpperCase(), admins: [] }, r403, true],
    ['a configured owner of 63 characters', { session: { authenticated: true, pubkey: OWNER.slice(1) } }, { owner: OWNER.slice(1), admins: [] }, r403, true],
    ['the owner, whose lookup throws', {}, { owner: boom, admins: [] }, r403, true],
    ['an admin, whose lookup throws', { session: adminSession() }, { admins: boom }, r403, true],
  ]);
});

test('SR44: ownerOrAdmin checks in the order 401, the role 403, then the cross-site 403 — { ok: false, status: 403, error: "cross-site request refused" } for the owner or an admin from another site, Origin null, or a host that only starts with ours; a stranger or an unauthenticated owner from another site gets the role 403; no session from another site gets 401 [ADR 0005 D5 ("403 cross-site request refused when not sameHost"; "Its order and bodies are the drift route\'s"); § Seams: "The order is 401, then the role 403, then the cross-site 403"]', async () => {
  const xsite = refused(ERR_XSITE, 403);
  await gateRows([
    ['the owner, a foreign Origin', { origin: 'https://evil.example' }, {}, xsite, true],
    ['an admin, a foreign Origin', { session: adminSession(), origin: 'https://evil.example' }, {}, xsite, true],
    ['an admin, Origin null', { session: adminSession(), origin: 'null' }, {}, xsite, true],
    ['the owner, a host that only starts with ours', { origin: `https://${HOST}.evil.test` }, {}, xsite, true],
    ['a stranger, a foreign Origin', { session: strangerSession(), origin: 'https://evil.example' }, {}, refused(ERR_403, 403), true],
    ['the owner unauthenticated, a foreign Origin', { session: { authenticated: false, pubkey: OWNER }, origin: 'https://evil.example' }, {}, refused(ERR_403, 403), true],
    ['no session, Origin null', { session: undefined, origin: 'null' }, {}, refused(ERR_401, 401), false],
  ]);
});

test('SR45: ownerOrAdmin checks the owner before the admins — the configured owner who is also on the admin list is admitted with role "owner", whatever the list\'s order, while an admin on the same list stays "admin" [ADR 0005 D5 ("the owner (checked first, against the lowercase 64-hex configured owner)"); § Seams: "the owner is checked before admins"]', async () => {
  await gateRows([
    ['the owner, the only admin too', {}, { admins: [OWNER] }, admitted('owner', OWNER), true],
    ['the owner, listed after an admin', {}, { admins: [ADMIN, OWNER] }, admitted('owner', OWNER), true],
    ['an admin, on a list that holds the owner too', { session: adminSession() }, { admins: [OWNER, ADMIN] }, admitted('admin', ADMIN), true],
  ]);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════
// SR46–SR47 — no handler logs who, and nothing else moves (ADR 0005 D6, § Consequences; AC-6)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════

/** Every 8-character key the SR46 scenarios involve: the callers', and those their records hold (D10's included). */
const LOG_KEYS = [OK, AK, 'f0178122', OTHER_ADMIN.slice(0, 8), STRANGER.slice(0, 8)];
/** A key as a log line could carry it: 8 hex digits (the shortened key) or 64 (a full pubkey), not part of a longer hex run. */
const KEY_TOKEN = '(?<![0-9a-f])(?:[0-9a-f]{64}|[0-9a-f]{8})(?![0-9a-f])';
const ROLE_NEAR_KEY = [
  new RegExp(`\\b(?:owner|admin)s?\\b[^\\n]{0,16}?${KEY_TOKEN}`, 'i'),
  new RegExp(`${KEY_TOKEN}[^\\n]{0,16}?\\b(?:owner|admin)s?\\b`, 'i'),
];
/** What a captured log must never carry: a full pubkey (either case), a shortened key, or a role word beside a key. */
function logProblems(label, printed) {
  const p = [];
  const near = (text, at) => show(`${at > 40 ? '…' : ''}${text.slice(Math.max(0, at - 40), at + 80)}`);
  for (const line of printed) {
    const lower = line.toLowerCase();
    for (const pk of [OWNER, ADMIN, OTHER_ADMIN, STRANGER]) {
      const at = lower.indexOf(pk);
      if (at >= 0) p.push(`${label}: a log line carries a full pubkey (${pk.slice(0, 8)}…): ${near(line, at)}`);
    }
    for (const k of LOG_KEYS) {
      const at = lower.indexOf(k);
      if (at >= 0) p.push(`${label}: a log line carries the shortened key ${k}: ${near(line, at)}`);
    }
    for (const re of ROLE_NEAR_KEY) {
      const m = re.exec(line);
      if (m) p.push(`${label}: a log line names a role beside a key: ${near(line, m.index)}`);
    }
  }
  return p;
}

test('SR46: no handler logs who — while an admin\'s POST, the owner\'s POST, a failed on, an off that could not be recorded and a GET of the record each run, nothing written to console.log, info, warn, error, debug or trace, or to process.stdout or process.stderr, carries a full pubkey (either case), a shortened 8-character key (the caller\'s or one the record holds), or the word owner or admin beside a key; each scenario must run as D11 and D6 answer it, so its logging is really checked [AC-5 "A signed-out reader, or a signed-in user who is neither, gets no who from any route"; ADR 0005 § Consequences ("The status never carries who … No handler logs who"), D6 ("No who anywhere public … No handler logs who"); § Decision, Option C (a log-line audit, rejected)]', async () => {
  const scenarios = [
    { name: 'an admin\'s POST: off, over the owner\'s on', status: 200, run: () => post(makeDisk({ sw: swText(O_ON), hist: histText([E_O_ON, H1]) }), false, { session: adminSession() }) },
    { name: 'the owner\'s POST: on, over an admin\'s off', status: 200, run: () => post(makeDisk({ sw: swText(A_OFF), hist: histText([E_A_OFF, V1_ENTRY]) }), true) },
    { name: 'a failed on (the owner, the admin\'s off not yet stored)', status: 500, run: () => post(makeDisk({ sw: swText(A_OFF) }), true, { writeError: oddError }) },
    { name: 'an off that could not be recorded (an admin, over the owner\'s on)', status: 200, run: () => post(makeDisk({ sw: swText(O_ON), hist: histText([E_O_ON, V1_ENTRY]) }), false, { session: adminSession(), writeError: enospc }) },
    { name: 'a GET of the record (an admin)', status: 200, run: () => getRecord(makeDisk({ sw: swText(A_OFF), hist: histText([E_O_ON, V1_ENTRY]) }), { session: adminSession() }) },
  ];
  const p = [];
  for (const s of scenarios) {
    const { result, printed } = await withLogs(async () => {
      try { return { r: await s.run() }; } catch (e) { return { error: e }; }
    });
    if (result.error) p.push(`${s.name}: ${firstLine(result.error)}`);
    else if (result.r.res.statusCode !== s.status) p.push(`${s.name}: should answer ${s.status} (ADR 0005 D11, D6) for what it logs to be checked; it answered ${showRes(result.r.res)}`);
    p.push(...logProblems(s.name, printed));
  }
  report(p);
});

/** Comments dropped, strings kept (as RR26 reads the same file). */
function jsCodeOnly(src) {
  let out = '';
  let i = 0;
  let q = null;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (q) {
      out += c;
      if (c === '\\') { out += n || ''; i += 2; continue; }
      if (c === q) q = null;
      i += 1;
      continue;
    }
    if (c === '/' && n === '*') { const end = src.indexOf('*/', i + 2); i = end < 0 ? src.length : end + 2; out += ' '; continue; }
    if (c === '/' && n === '/') { const end = src.indexOf('\n', i); i = end < 0 ? src.length : end; continue; }
    if (c === '\'' || c === '"' || c === '`') q = c;
    out += c;
    i += 1;
  }
  return out;
}
/** AC-6: modules a switch change must not reach — schedules, the task queue, the pass's lock, the graph, the relay. */
const AC6_FORBIDDEN = [
  ['the scheduled-tasks routes (src/api/scheduled-tasks)', /scheduled[-_]?tasks/i],
  ['a scheduler', /schedul/i],
  ['the task queue (src/manage/taskQueue)', /task[-_]?queue/i],
  ['BullMQ', /bullmq|bull[-_]?board|(^|\/)bull(\/|$)/i],
  ['the resource semaphore', /semaphore/i],
  ['the graph: the Neo4j driver', /neo4j/i],
  ['the graph: the pass\'s graph module (src/pipeline/tagging-edges/graph.js)', /(^|\/)graph(\.js)?$/],
  ['the relay (strfry)', /strfry/i],
];
/** D2's and D5's dependencies for a POST — the owner and admin lookups, the record's reads and writes — plus D4's now and D1's stateDir (the base of both files). */
const AC6_POST_DEPS = [...LOOKUPS, 'now', 'stateDir', 'readSwitch', 'readSwitchHistory', 'writeSwitchHistory', 'writeSwitch', 'unlinkSwitch'];

test('SR47: a switch change moves nothing else — src/api/tagging-edges/realtime.js (read as text, comments dropped) requires, by a literal path only, no scheduled-tasks, scheduler, task-queue, BullMQ, resource-semaphore, graph (the Neo4j driver or src/pipeline/tagging-edges/graph.js) or relay (strfry) module; and every admitted POST path — an on, an off, an on while on, a failed on, an off that could not be recorded, a double failure, a switch.json read error, a history read error — calls no injected dependency but the owner and admin lookups, now, stateDir and the record\'s five (no queue, liveness, readFile or other); a static pin, extending SR14 (the queue and signals on a successful change) and SR31–SR33 (refusals) [AC-6 "Turning the path on or off does not start, stop or queue a pass, and does not change any schedule"; "Follows, mutes and reports are untouched"; ADR 0005 § Consequences ("A switch change starts, stops and queues no pass, and changes no schedule"), D2, D5]', async () => {
  const p = [];
  let src;
  try { src = fs.readFileSync(ROUTES_MOD, 'utf8'); } catch (e) { throw new Error(`${ROUTES_REL} could not be read (${firstLine(e)})`); }
  const code = jsCodeOnly(src);
  const reqRe = /(?<![\w$.])(require|import)\s*\(\s*([^)]*?)\s*\)/g;
  const specs = [];
  let m;
  while ((m = reqRe.exec(code))) {
    const arg = m[2];
    const lit = /^(['"`])([^'"`$]*)\1$/.exec(arg);
    if (!lit) { p.push(`${ROUTES_REL} ${m[1]}s a computed path (${show(arg)}), which this pin cannot check — require a literal path`); continue; }
    const spec = lit[2];
    const resolved = spec.startsWith('.') ? path.relative(REPO, path.resolve(path.dirname(ROUTES_MOD), spec)).split(path.sep).join('/') : spec;
    specs.push(spec);
    const hits = AC6_FORBIDDEN.filter(([, re]) => re.test(spec) || re.test(resolved)).map(([label]) => label);
    if (hits.length) p.push(`${ROUTES_REL} requires ${show(spec)} (${resolved}) — ${hits.join('; ')}: a switch change starts, stops and queues no pass, changes no schedule, and leaves follows, mutes and reports untouched (AC-6)`);
  }
  if (!specs.length) p.push(`no require() was found in ${ROUTES_REL}, so this pin checked nothing`);

  const rows = [
    ['the owner turns it on, never switched', makeDisk(), true, {}],
    ['an admin turns off the owner\'s on, not yet in the history', makeDisk({ sw: swText(O_ON) }), false, { session: adminSession() }],
    ['the owner turns it on while on', makeDisk({ sw: swText(O_ON), hist: histText([E_O_ON]) }), true, {}],
    ['a failed on', makeDisk({ sw: swText(A_OFF) }), true, { writeError: enospc }],
    ['an off that could not be recorded', makeDisk({ sw: swText(O_ON), hist: histText([E_O_ON]) }), false, { writeError: enospc }],
    ['an off whose write and unlink both fail', makeDisk({ sw: swText(O_ON), hist: histText([E_O_ON]) }), false, { writeError: enospc, unlinkError: () => fsError('EACCES', SW_FILE()) }],
    ['an on with switch.json unreadable', makeDisk({ sw: fsError('EIO', SW_FILE()), hist: histText([E_O_ON]) }), true, {}],
    ['an admin\'s off with switch-history.json unreadable', makeDisk({ sw: swText(O_ON), hist: fsError('EIO', HIST_FILE()) }), false, { session: adminSession() }],
  ];
  const reached = new Set();
  for (const [label, disk, on, o] of rows) {
    let r;
    try { r = await post(disk, on, o); } catch (e) { p.push(`${label}: ${firstLine(e)}`); continue; }
    for (const op of writeOps(r.calls)) reached.add(op);
    const other = [...new Set(r.calls.deps.filter((n) => !AC6_POST_DEPS.includes(n)))];
    if (other.length) p.push(`${label}: the POST called ${show(other)} — only ${show(AC6_POST_DEPS)} belong to a switch change (ADR 0005 D2, D5; AC-6)`);
  }
  for (const op of ['writeSwitch', 'unlinkSwitch']) if (!reached.has(op)) p.push(`no row reached ${op}, so the dependency check above ran on refusals only`);
  report(p);
});

// ─── runner ────────────────────────────────────────────────────────────────────────────────────────────────────
async function run() {
  console.log('\n--- tagging-edges switch record tests (epic tagging-edges, Story 5 — ADR 0005 D1–D6, D9–D11, residuals (a) and (b), AC-6) ---');
  let pass = 0;
  let fail = 0;
  const failures = [];
  const savedDir = process.env.TAGGING_EDGES_STATE_DIR;
  const strays = [];
  const onUnhandled = (reason) => { strays.push(`unhandled rejection: ${firstLine(reason)}`); };
  process.on('unhandledRejection', onUnhandled);
  try {
    process.env.TAGGING_EDGES_STATE_DIR = root();
    for (const [name, fn] of tests) {
      strays.length = 0;
      let err = null;
      try { await fn(); } catch (e) { err = e; }
      await new Promise((r) => { setImmediate(r); });
      if (!err && strays.length) err = new Error(`the test left ${strays.length} unhandled rejection(s): ${strays.join('; ')}`);
      if (err) {
        console.log(`  FAIL  ${name}\n        ${err.message}`);
        failures.push({ name, message: err.message });
        fail++;
      } else {
        console.log(`  PASS  ${name}`);
        pass++;
      }
    }
  } finally {
    process.removeListener('unhandledRejection', onUnhandled);
    if (savedDir === undefined) delete process.env.TAGGING_EDGES_STATE_DIR; else process.env.TAGGING_EDGES_STATE_DIR = savedDir;
    if (ROOT) { fs.rmSync(ROOT, { recursive: true, force: true }); ROOT = null; }
    forget();
  }
  console.log(`\ntagging-edges-switch-record: ${pass} passed, ${fail} failed, 0 skipped`);
  return { pass, fail, skipped: 0, failures };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
