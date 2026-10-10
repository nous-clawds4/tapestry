'use strict';
/**
 * Tests for Story 4 (epic tagging-edges) — the drift-counts route the tagging pipeline panel asks for its relay and
 * graph counts.
 *
 * Story: engineering-team/stories/tagging-edges/4-tagging-pipeline-panel.md — AC-4 ("Unknown, never 0": a count that
 *        fails, or takes longer than 10 seconds, reads "unknown"; "Who may count": only a signed-in owner or admin can
 *        ask for a count, any other request is refused by the server and counts nothing; "Reads only").
 * ADR:   engineering-team/decisions/tagging-edges/0004-tagging-pipeline-panel.md — § Implementation notes → Server
 *        (src/api/tagging-edges/drift.js: the gate, the relay count, the graph count, both counts, the answer, single
 *        flight, registration, reads only), § "Seams for Test Design" → "The route", and the Test Design clarifications
 *        T8 (takenAt, ms, stamps) and T11 (the route's seams).
 *
 * Intentionally failing until the implementation lands (red phase): src/api/tagging-edges/drift.js does not exist
 * yet. It is require()d LAZILY and FRESH inside every test (the ADR's FORGET list: drift.js, tagging-edges/index.js,
 * src/lib/strfryScanStrict.js and src/lib/tagging-edges/realtime.js are dropped from the require cache first, so each
 * test gets its own module-level single-flight slot), through a loader that says what is missing. So this suite
 * always loads and every test of the new route fails naming drift.js. DR26 (the chosen path against the auth
 * middleware's endpoint lists) checks the design against today's source and passes now.
 *
 * Classes:
 *   DR1–DR2   the module's surface and the pure countFilter(identities).
 *   DR3–DR8   the gate, in the ADR's order, with the session matrix adapted from
 *             test/tagging-edges-realtime-routes.test.js (RR9–RR12), admins passing; a refused request resolves no
 *             identity, never counts and never joins an in-flight count (T11).
 *   DR9–DR19, DR27  counting: the exact countStrict and runCypher calls, the real resolveIdentities over fake
 *             identities in the runner's nested shape, the 200 answer (T8), every failure as a known "unknown" shape,
 *             the race against d.limitMs through the injected d.setTimer / d.clearTimer, and (DR27) ms and takenAt
 *             under a clock that moves while the counts run.
 *   DR20–DR22 single flight, and Express's next as a third argument.
 *   DR23–DR26 load and wiring: drift.js loads stack-free (a child probe), takes allowErrorCode from the library and
 *             names no write, queue or spawn (reads only), src/api/index.js registers the route once behind
 *             adminApi.requireOwnerOrAdmin, and the path is outside every endpoint list in src/middleware/auth.js.
 *
 * Handlers are called directly as handleDriftCounts(req, res, deps) with a fake req / res (the realtime-routes
 * suite's fakeReq / fakeRes / callHandler) and deps that record every call — the override keys T11 names:
 *   ownerPubkey / getOwnerPubkey  the owner reader (index.js's withDeps names; both handed in, the same function)
 *   getAdminPubkeys               the admin reader (ADR: "The admins come from getAdminPubkeys")
 *   identities, env               the runner's nested shape for resolveIdentities — { canonicalZ(), getOwnerAssistantPubkey() }
 *                                 and an empty env — fed to the REAL resolveIdentities (never injected)
 *   countStrict, runCypher        the two counts
 *   now                           a fixed (or stepped) fake clock, in ms
 *   setTimer, clearTimer          a fake timer that never fires by itself; a test fires it to lose a race
 *   limitMs                       omitted (the default, 10000) except where a test injects another value
 * process.env.TA_PUBKEY and BRAINSTORM_RELAY_PUBKEY are removed for the run (restored after), so resolveIdentities
 * decides the local identity from the getter whether the route hands it d.env or process.env.
 *
 * Pinned by T11 (ratified with ADR 0004's Test Design clarifications):
 *   - countFilter takes resolveIdentities' success shape, { canonicalPubkey, localPubkey }, and keeps the canonical
 *     stamp first.
 *   - The override keys above are the ones handleDriftCounts' third argument may override.
 *   - A refused request resolves no identity (canonicalZ and getOwnerAssistantPubkey are never asked).
 *   - On an identity refusal the unresolved identity's stamp is null, and the other one is still given when it
 *     resolved. resolveIdentities checks the canonical identity first, so a local refusal means the canonical one
 *     resolved (its prefix is given); on a canonical refusal the local one was never resolved, and DR12 accepts its
 *     prefix or null.
 * Choices this suite makes where the ADR leaves a detail open (recorded in the Test Design return):
 *   - An owner lookup that throws refuses as 403 (RR11's precedent); an admin lookup that throws admits no admin but
 *     still admits the owner.
 *   - A count that throws synchronously is a failure like a rejection: allowErrorCode(err.code).
 *   - gateOwnerOrAdmin(req, d) is pinned only as an export; its return shape is the Implementer's.
 *
 * Hermetic: no graph, relay, strfry, Redis, network or config file is touched, except that DR22 runs refused
 * requests on the default deps, as RR23 does for the other routes. Its signed-out row answers before any reader
 * runs. Its stranger row reads the owner and admin config (on a deployed host, getConfigFromFile may source the
 * config file and print the owner pubkey), refuses, and counts nothing, so that row's path depends on host config
 * though its answer does not. DR23's child traps every read, connect and spawn. Fake 64-hex pubkeys only (never a
 * deployment's TA, never the ADR 0015 literal). Principle 4: nothing here writes anywhere.
 *
 * Hand-rolled in the project's existing test style — no new framework. Works on Node 16 and 22.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const F = require('./helpers/taggingEdgesFixtures');

const REPO = path.resolve(__dirname, '..');
const DRIFT_REL = 'src/api/tagging-edges/drift.js';
const DRIFT_MOD = path.join(REPO, DRIFT_REL);
const INDEX_API = path.join(REPO, 'src/api/index.js');
const AUTH_MW = path.join(REPO, 'src/middleware/auth.js');
const REALTIME_LIB_MOD = path.join(REPO, 'src/lib/tagging-edges/realtime.js');
const SCAN_STRICT_MOD = path.join(REPO, 'src/lib/strfryScanStrict.js');
/** ADR 0004 § Seams → The route: "Tests load drift.js fresh. FORGET names …". */
const FORGET = [
  DRIFT_MOD,
  path.join(REPO, 'src/api/tagging-edges/index.js'),
  SCAN_STRICT_MOD,
  REALTIME_LIB_MOD,
];

const { CANONICAL, LOCAL, pubkeyOf } = F;
const OWNER = pubkeyOf('owner');
const ADMIN = pubkeyOf('admin');
const STRANGER = pubkeyOf('stranger');
const HOST = 'tapestry.example';
const ROUTE_PATH = '/api/tagging-edges/drift-counts';
const CYPHER = 'MATCH ()-[r:TAGS]->() RETURN count(r) AS n';
const LIMIT = 10000;
const T0 = Date.UTC(2026, 8, 30, 12, 0, 0); // 2026-09-30T12:00:00Z
const RELAY_N = 7027;
const GRAPH_N = 6990;
const Z_CANONICAL = `39998:${CANONICAL}:nostr-user-tag`;
const Z_LOCAL = `39998:${LOCAL}:nostr-user-tag`;
const ERR_401 = { success: false, error: 'Not authenticated' };
const ERR_403 = { success: false, error: 'Owner or admin access required' };
const ERR_XSITE = { success: false, error: 'cross-site request refused' };
/** Text an answer must never carry: what the fake errors' messages hold. */
const LEAK_NEEDLES = ['neo4j.internal', ':7687', 'bolt://', '/var/lib/brainstorm', 'secret-password', 'strfry.conf', 'redis:6379'];

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
  try {
    return JSON.stringify(sortKeys(v), (k, x) => {
      if (typeof x === 'number' && !Number.isFinite(x)) return String(x);
      if (typeof x === 'string' && x.length > 160) return `${x.slice(0, 40)}…(${x.length} chars)`;
      return x;
    });
  } catch (_) {
    return String(v);
  }
}
/** Exact JSON with sorted keys (undefined members dropped, as on the wire). */
function exact(v) { return JSON.stringify(sortKeys(v)); }
function eq(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}\n        expected: ${show(expected)}\n        actual:   ${show(actual)}`);
}
function same(actual, expected, label) {
  if (exact(actual) !== exact(expected)) throw new Error(`${label}\n        expected: ${show(expected)}\n        actual:   ${show(actual)}`);
}
const firstLine = (e) => String((e && e.message) || e).split('\n')[0];
const has = (o, k) => !!o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k);
const iso = (ms) => new Date(ms).toISOString();
const tick = () => new Promise((r) => setImmediate(r));
async function settle(n = 8) { for (let i = 0; i < n; i++) await tick(); }
function sleep(ms) { let t; const p = new Promise((r) => { t = setTimeout(r, ms); }); p.cancel = () => clearTimeout(t); return p; }

/** Run several cases; report every failing one, not only the first. */
async function cases(list, fn) {
  const failed = [];
  for (const c of list) {
    try { await fn(c); } catch (e) { failed.push(`[${c.name}] ${e.message}`); }
  }
  assert(failed.length === 0, `${failed.length} of ${list.length} case(s) failed:\n        ${failed.join('\n        ')}`);
}

/** JS source with comments removed (string contents kept), as test/tagging-edges-wiring.test.js reads source. */
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
/** The string literals of `const <name> = [ … ];` in a source text (test/tagging-edges-wiring.test.js:191-195). */
function stringsOfArray(src, constName) {
  const m = new RegExp(`const\\s+${constName}\\s*=\\s*\\[([\\s\\S]*?)\\];?`).exec(src);
  if (!m) return null;
  return [...m[1].replace(/\/\/[^\n]*/g, '').matchAll(/'([^']*)'|"([^"]*)"/g)].map((x) => (x[1] !== undefined ? x[1] : x[2]));
}

// ─── lazy, fresh loading ───────────────────────────────────────────────────────────────────────────────────────
function forget() { for (const p of FORGET) delete require.cache[p]; }
function loadDrift() {
  forget();
  if (!fs.existsSync(DRIFT_MOD)) throw new Error(`${DRIFT_REL} not implemented yet: the file does not exist (ADR 0004 § Implementation notes → Server)`);
  try { return require(DRIFT_MOD); } catch (e) { throw new Error(`${DRIFT_REL} not implemented yet (require failed: ${firstLine(e)}) (ADR 0004 § Server)`); }
}
function need(mod, name) {
  if (!mod || typeof mod[name] !== 'function') {
    throw new Error(`${DRIFT_REL} not implemented yet: it does not export ${name}() (ADR 0004 § Server); it exports ${show(Object.keys(mod || {}))}`);
  }
  return mod[name];
}
/** A fresh module's handleDriftCounts — one per test, so its single-flight slot starts empty. */
function freshHandler() { return need(loadDrift(), 'handleDriftCounts'); }

// ─── fakes ─────────────────────────────────────────────────────────────────────────────────────────────────────
function fakeReq({ method = 'GET', url = ROUTE_PATH, session, localTrusted, headers = {}, ip = '203.0.113.9' } = {}) {
  const h = {};
  for (const [k, v] of Object.entries(headers)) if (v !== undefined) h[k.toLowerCase()] = v;
  const req = {
    method, url, originalUrl: url, path: url.split('?')[0], headers: h, body: undefined, query: {}, session,
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
/** A GET of the route; `o.session` (own key) replaces the owner's session, `o.origin` adds an Origin header. */
function driftReq(o = {}) {
  const headers = { host: o.host || HOST, accept: 'application/json' };
  if (o.origin !== undefined) headers.origin = o.origin;
  return fakeReq({ headers, session: has(o, 'session') ? o.session : ownerSession(), localTrusted: o.localTrusted, ip: o.ip });
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
    const s = sleep(2000);
    await Promise.race([res.done, s]);
    s.cancel();
  }
  if (!res.finished) throw new Error(`the handler never answered${thrown ? ` (it threw: ${firstLine(thrown)})` : ''}`);
  if (thrown) throw new Error(`the handler answered ${showRes(res)} but also threw: ${firstLine(thrown)} (a failed count is a known shape, never a throw)`);
  return res;
}
/** Start a handler without waiting for it; the result's `answered` resolves when it answers (or after 2 s). */
function startHandler(fn, req, deps) {
  const res = fakeRes();
  const state = { res, thrown: null };
  state.ran = Promise.resolve().then(() => fn(req, res, deps)).catch((e) => { state.thrown = e; });
  state.answered = async () => {
    await state.ran;
    if (!res.finished) { const s = sleep(2000); await Promise.race([res.done, s]); s.cancel(); }
    if (!res.finished) throw new Error(`the handler never answered${state.thrown ? ` (it threw: ${firstLine(state.thrown)})` : ''}`);
    return res;
  };
  return state;
}
const showRes = (res) => `${res.statusCode} ${show(res.body)}`;

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}

/** A fake timer: setTimer records { fn, ms } and never fires by itself; fire() runs it once; clearTimer marks it. */
function timerKit() {
  const list = [];
  const clears = [];
  const setTimer = (fn, ms, ...args) => {
    const h = { id: list.length + 1, fn, ms, args, cleared: false, fired: false };
    h.fire = () => { if (h.fired || h.cleared) return; h.fired = true; if (typeof fn === 'function') fn(...args); };
    list.push(h);
    return h;
  };
  const clearTimer = (h) => { clears.push(h); const t = list.find((x) => x === h); if (t) t.cleared = true; };
  return { list, clears, setTimer, clearTimer };
}

/**
 * The route's deps, the counts' and identities' calls recorded. o.count / o.cypher are functions standing in for countStrict / runCypher
 * (default: resolve RELAY_N and [{ n: GRAPH_N }]); o.owner / o.admins replace the readers; o.identities replaces
 * the nested identities; o.now replaces the clock; o.limitMs is set only when given.
 */
function bundle(o = {}) {
  const calls = { countStrict: [], runCypher: [], canonicalZ: 0, assistant: 0 };
  const timers = timerKit();
  const count = o.count || (() => Promise.resolve(RELAY_N));
  const cypher = o.cypher || (() => Promise.resolve([{ n: GRAPH_N }]));
  const ownerFn = () => (typeof o.owner === 'function' ? o.owner() : (has(o, 'owner') ? o.owner : OWNER));
  const deps = {
    ownerPubkey: ownerFn,
    getOwnerPubkey: ownerFn,
    getAdminPubkeys: () => (typeof o.admins === 'function' ? o.admins() : (has(o, 'admins') ? o.admins : [ADMIN])),
    identities: o.identities || {
      canonicalZ: () => { calls.canonicalZ++; return Z_CANONICAL; },
      getOwnerAssistantPubkey: () => { calls.assistant++; return LOCAL; },
    },
    env: {},
    countStrict: (filter, opts) => { calls.countStrict.push({ filter, opts }); return count(filter, opts); },
    runCypher: (text, params, tx) => { calls.runCypher.push({ text, params, tx }); return cypher(text, params, tx); },
    now: o.now || (() => T0),
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  };
  if (has(o, 'limitMs')) deps.limitMs = o.limitMs;
  return { deps, calls, timers };
}

/** The 200 answer T8 and § Server give for two known counts with a fixed clock. */
function knownAnswer({ relay = RELAY_N, graph = GRAPH_N, limitMs = LIMIT } = {}) {
  return {
    success: true,
    limitMs,
    relay: { known: true, count: relay, takenAt: iso(T0), ms: 0 },
    graph: { known: true, count: graph, takenAt: iso(T0), ms: 0 },
    stamps: { canonical: CANONICAL.slice(0, 8), local: LOCAL.slice(0, 8) },
  };
}
const unknown = (code, ms = 0) => ({ known: false, code, takenAt: iso(T0), ms });

/** The problems with a refused answer: its status and exact body, no identity resolved, and nothing counted (T11). */
function refusalProblems(label, res, b, wantStatus, wantBody) {
  const p = [];
  if (res.statusCode !== wantStatus || exact(res.body) !== exact(wantBody)) {
    p.push(`${label}: should answer ${wantStatus} ${show(wantBody)}; answered ${showRes(res)}`);
  }
  if (b.calls.countStrict.length) p.push(`${label}: countStrict was called ${b.calls.countStrict.length} time(s) on a refused request (a refused request spawns nothing)`);
  if (b.calls.runCypher.length) p.push(`${label}: runCypher was called ${b.calls.runCypher.length} time(s) on a refused request (a refused request runs no Cypher)`);
  if (b.calls.canonicalZ || b.calls.assistant) p.push(`${label}: the identities were resolved on a refused request (canonicalZ ${b.calls.canonicalZ}, getOwnerAssistantPubkey ${b.calls.assistant}); the gate runs before anything is counted and a refused request resolves no identity (T11)`);
  return p;
}
/** The leaks an answer carries: an absolute path that starts a word, a URI, a full pubkey, a fake error's text. */
function leakProblems(label, res, extra = []) {
  const text = JSON.stringify(res.body === undefined ? null : res.body);
  const p = [];
  const abs = /(^|[\s'"[(=])\/[^\s'"\])]/.exec(text);
  if (abs) p.push(`${label}: the answer carries an absolute path near ${show(text.slice(Math.max(0, abs.index - 30), abs.index + 60))}`);
  const uri = /\b[a-z][a-z0-9+.-]*:\/\//i.exec(text);
  if (uri) p.push(`${label}: the answer carries a URI near ${show(text.slice(Math.max(0, uri.index - 30), uri.index + 60))}`);
  for (const needle of [...LEAK_NEEDLES, CANONICAL, LOCAL, OWNER, ADMIN, ...extra]) {
    if (text.includes(needle)) p.push(`${label}: the answer carries ${needle.length === 64 ? `a full pubkey (${needle.slice(0, 8)}…)` : show(needle)}`);
  }
  return p;
}
/** A fake error whose message holds a host, a path and a credential-like word, as a real one might. */
function noisyError(code, name) {
  const e = new Error(`Could not reach bolt://neo4j.internal:7687 (config /var/lib/brainstorm/strfry.conf, secret-password) for ${OWNER}`);
  if (code !== undefined) e.code = code;
  if (name) e.name = name;
  return e;
}
function scanError(code) {
  delete require.cache[SCAN_STRICT_MOD];
  const { ScanError } = require(SCAN_STRICT_MOD);
  return new ScanError(code, `strfry scan failed (${code}) reading /var/lib/brainstorm/strfry.conf via redis:6379`, 'secret-password');
}

// ─── DR1–DR2: surface and countFilter ──────────────────────────────────────────────────────────────────────────

test('DR1: drift.js exports handleDriftCounts(req, res, deps) and its pure halves gateOwnerOrAdmin(req, d) and countFilter(identities), all functions [AC-4; ADR 0004 § Implementation notes → Server]', () => {
  const mod = loadDrift();
  for (const name of ['handleDriftCounts', 'gateOwnerOrAdmin', 'countFilter']) need(mod, name);
});

test('DR2: countFilter gives one filter over both nostr-user-tag stamps — { kinds: [39999], "#z": [canonical stamp, local stamp] } in that order — and a single z when both identities are the same pubkey, never two counts to add; its input is not changed [AC-4 "the relay taggings"; ADR 0004 § Server → The relay count]', async () => {
  const countFilter = need(loadDrift(), 'countFilter');
  await cases([
    { name: 'two identities', ids: { canonicalPubkey: CANONICAL, localPubkey: LOCAL }, want: { kinds: [39999], '#z': [Z_CANONICAL, Z_LOCAL] } },
    { name: 'the same pubkey twice', ids: { canonicalPubkey: CANONICAL, localPubkey: CANONICAL }, want: { kinds: [39999], '#z': [Z_CANONICAL] } },
  ], (c) => {
    const input = { ...c.ids };
    const before = exact(input);
    const got = countFilter(input);
    same(got, c.want, `countFilter(${show(c.ids)})`);
    assert(Array.isArray(got['#z']) && Array.isArray(got.kinds), 'kinds and #z must be arrays');
    eq(exact(input), before, 'countFilter changed its input');
  });
});

// ─── DR3–DR8: the gate ─────────────────────────────────────────────────────────────────────────────────────────

test('DR3: with no session pubkey the route answers 401 { success: false, error: "Not authenticated" } and counts nothing — no session, a loopback request (localTrusted, 127.0.0.1) with no session or an empty one, a session with no pubkey or an empty one [AC-4 "Who may count"; ADR 0004 § Server → The gate, step 1: "A loopback call gets the same; localTrusted is not admitted"]', async () => {
  const handle = freshHandler();
  const rows = [
    ['no session', { session: undefined }],
    ['a loopback request with no session', { session: undefined, localTrusted: true, ip: '127.0.0.1' }],
    ['a loopback request with an empty session', { session: {}, localTrusted: true, ip: '127.0.0.1' }],
    ['a session with no pubkey', { session: { authenticated: true } }],
    ['a session with an empty pubkey', { session: { authenticated: true, pubkey: '' } }],
  ];
  const problems = [];
  for (const [label, o] of rows) {
    const b = bundle();
    problems.push(...refusalProblems(label, await callHandler(handle, driftReq(o), b.deps), b, 401, ERR_401));
  }
  assert(problems.length === 0, problems.join('\n        '));
});

test('DR4: a session that is not a signed-in owner or admin answers 403 { success: false, error: "Owner or admin access required" } and counts nothing — the owner or an admin whose authenticated is false, the string "true", 1 or absent; a signed-in stranger (also on loopback); the owner or an admin in upper case; an admin list holding the admin in upper case; a configured owner that is not lowercase 64-hex (the session holding that same value); an owner lookup that throws; a stranger or an admin when the admin lookup throws — and no refused request resolves an identity [AC-4 "Any other request is refused by the server and counts nothing"; ADR 0004 § Server → The gate, step 2; getAdminPubkeys compared as isAdminPubkey compares (includes, case-sensitive); T11 "A refused request resolves no identity"]', async () => {
  const handle = freshHandler();
  const rows = [
    ['the owner, authenticated false', { session: { authenticated: false, pubkey: OWNER } }, {}],
    ['the owner, authenticated "true"', { session: { authenticated: 'true', pubkey: OWNER } }, {}],
    ['the owner, authenticated 1', { session: { authenticated: 1, pubkey: OWNER } }, {}],
    ['the owner, authenticated absent', { session: { pubkey: OWNER } }, {}],
    ['an admin, authenticated false', { session: { authenticated: false, pubkey: ADMIN } }, {}],
    ['an admin, authenticated "true"', { session: { authenticated: 'true', pubkey: ADMIN } }, {}],
    ['an admin, authenticated absent', { session: { pubkey: ADMIN } }, {}],
    ['a signed-in stranger', { session: { authenticated: true, pubkey: STRANGER } }, {}],
    ['a stranger on loopback', { session: { authenticated: true, pubkey: STRANGER }, localTrusted: true, ip: '127.0.0.1' }, {}],
    ['a stranger whose session claims admin flags', { session: { authenticated: true, pubkey: STRANGER, isAdmin: true, admin: true, role: 'admin' } }, {}],
    ['the owner in upper case', { session: { authenticated: true, pubkey: OWNER.toUpperCase() } }, {}],
    ['an admin in upper case', { session: { authenticated: true, pubkey: ADMIN.toUpperCase() } }, {}],
    ['an admin list holding the admin in upper case', { session: adminSession() }, { admins: [ADMIN.toUpperCase()] }],
    ['a configured owner in upper case', { session: { authenticated: true, pubkey: OWNER.toUpperCase() } }, { owner: OWNER.toUpperCase(), admins: [] }],
    ['a configured owner of 63 characters', { session: { authenticated: true, pubkey: OWNER.slice(1) } }, { owner: OWNER.slice(1), admins: [] }],
    ['an owner lookup that throws', { session: ownerSession() }, { owner: () => { throw new Error('could not read /etc/brainstorm.conf'); }, admins: [] }],
    ['a stranger when the admin lookup throws', { session: { authenticated: true, pubkey: STRANGER } }, { admins: () => { throw new Error('could not source /etc/brainstorm.conf'); } }],
    ['an admin when the admin lookup throws', { session: adminSession() }, { admins: () => { throw new Error('could not source /etc/brainstorm.conf'); } }],
  ];
  const problems = [];
  for (const [label, o, bo] of rows) {
    const b = bundle(bo);
    const res = await callHandler(handle, driftReq(o), b.deps).catch((e) => ({ statusCode: 'none', body: firstLine(e) }));
    problems.push(...refusalProblems(label, res, b, 403, ERR_403));
  }
  assert(problems.length === 0, problems.join('\n        '));
});

test('DR5: a signed-in owner (lowercase, authenticated === true) and a signed-in admin from getAdminPubkeys both pass the gate and get 200 with both counts — the owner even when the admin lookup throws [AC-4 "Only a signed-in owner or admin can ask for a count"; ADR 0004 § Server → The gate; § Seams → The route: "with admins passing"]', async () => {
  const handle = freshHandler();
  await cases([
    { name: 'the owner', session: ownerSession(), bo: {} },
    { name: 'an admin', session: adminSession(), bo: {} },
    { name: 'an admin among others', session: adminSession(), bo: { admins: [pubkeyOf('other-admin'), ADMIN] } },
    { name: 'an admin when no owner is configured', session: adminSession(), bo: { owner: null } },
    { name: 'the owner when the admin lookup throws', session: ownerSession(), bo: { admins: () => { throw new Error('could not source /etc/brainstorm.conf'); } } },
  ], async (c) => {
    const b = bundle(c.bo);
    const res = await callHandler(handle, driftReq({ session: c.session }), b.deps);
    eq(res.statusCode, 200, `status (answer ${showRes(res)})`);
    same(res.body, knownAnswer(), 'the answer');
    eq(b.calls.countStrict.length, 1, 'countStrict calls');
    eq(b.calls.runCypher.length, 1, 'runCypher calls');
  });
});

test('DR6: the Origin rule — no Origin and a same-host Origin pass; a foreign Origin, Origin "null" and a host that only starts with ours answer 403 { success: false, error: "cross-site request refused" } and count nothing — for the owner and for an admin [AC-4 "Who may count"; ADR 0004 § Server → The gate, step 3 (sameHost); § Seams: "none (passes), same-host (passes), foreign (403) and null (403)"]', async () => {
  const handle = freshHandler();
  const problems = [];
  for (const [who, session] of [['the owner', ownerSession()], ['an admin', adminSession()]]) {
    for (const [label, origin, host] of [['no Origin', undefined], [`Origin http://${HOST}`, `http://${HOST}`], [`Origin https://${HOST}`, `https://${HOST}`], ['a same-host Origin with a port', `http://${HOST}:7778`, `${HOST}:7778`]]) {
      const b = bundle();
      const res = await callHandler(handle, driftReq({ session, origin, host }), b.deps);
      if (res.statusCode !== 200 || !res.body || res.body.success !== true) problems.push(`${who}, ${label}: should pass the gate and answer 200; answered ${showRes(res)}`);
    }
    for (const [label, origin] of [['Origin https://evil.example', 'https://evil.example'], ['Origin null', 'null'], ['a host that only starts with ours', `https://${HOST}.evil.test`]]) {
      const b = bundle();
      problems.push(...refusalProblems(`${who}, ${label}`, await callHandler(handle, driftReq({ session, origin }), b.deps), b, 403, ERR_XSITE));
    }
  }
  assert(problems.length === 0, problems.join('\n        '));
});

test('DR7: the gate runs in the ADR\'s order — no session with a foreign Origin answers 401, a stranger or an unauthenticated owner with a foreign Origin answers the owner-or-admin 403, not the cross-site one [AC-4; ADR 0004 § Server → The gate: "in order, before anything is counted"]', async () => {
  const handle = freshHandler();
  const rows = [
    ['no session, foreign Origin', { session: undefined, origin: 'https://evil.example' }, 401, ERR_401],
    ['a loopback request with no session, Origin null', { session: undefined, origin: 'null', localTrusted: true, ip: '127.0.0.1' }, 401, ERR_401],
    ['a stranger, foreign Origin', { session: { authenticated: true, pubkey: STRANGER }, origin: 'https://evil.example' }, 403, ERR_403],
    ['the owner with authenticated false, foreign Origin', { session: { authenticated: false, pubkey: OWNER }, origin: 'https://evil.example' }, 403, ERR_403],
  ];
  const problems = [];
  for (const [label, o, status, body] of rows) {
    const b = bundle();
    problems.push(...refusalProblems(label, await callHandler(handle, driftReq(o), b.deps), b, status, body));
  }
  assert(problems.length === 0, problems.join('\n        '));
});

test('DR8: a refused request never joins an in-flight count — while the owner\'s count is pending, a signed-out request gets 401, a stranger 403 and a foreign-Origin owner 403 at once, countStrict and runCypher stay at one call each, the identities are resolved once (for the owner), and the owner still gets the 200 answer when the count settles [AC-4 "Any other request is refused by the server and counts nothing"; ADR 0004 § Server → The gate: "A refused request spawns nothing, runs no Cypher and never joins a count"; T11]', async () => {
  const handle = freshHandler();
  const relay = deferred();
  const b = bundle({ count: () => relay.promise });
  const first = startHandler(handle, driftReq(), b.deps);
  await settle();
  eq(b.calls.countStrict.length, 1, 'countStrict calls once the owner\'s count has started');
  assert(!first.res.finished, `the owner's request answered before its count settled: ${showRes(first.res)}`);
  const problems = [];
  for (const [label, o, status, body] of [
    ['a signed-out request', { session: undefined }, 401, ERR_401],
    ['a stranger', { session: { authenticated: true, pubkey: STRANGER } }, 403, ERR_403],
    ['the owner from a foreign Origin', { origin: 'https://evil.example' }, 403, ERR_XSITE],
  ]) {
    const r = startHandler(handle, driftReq(o), b.deps);
    await settle();
    if (!r.res.finished) { problems.push(`${label}: did not answer while a count was in flight (it waited on the count)`); continue; }
    if (r.res.statusCode !== status || exact(r.res.body) !== exact(body)) problems.push(`${label}: should answer ${status} ${show(body)}; answered ${showRes(r.res)}`);
  }
  if (b.calls.countStrict.length !== 1) problems.push(`countStrict was called ${b.calls.countStrict.length} times; a refused request never counts`);
  if (b.calls.runCypher.length !== 1) problems.push(`runCypher was called ${b.calls.runCypher.length} times; a refused request never counts`);
  if (b.calls.canonicalZ !== 1 || b.calls.assistant !== 1) problems.push(`the identities were asked canonicalZ ${b.calls.canonicalZ} and getOwnerAssistantPubkey ${b.calls.assistant} time(s); only the owner's request should resolve them, once each (a refused request resolves no identity, T11)`);
  relay.resolve(RELAY_N);
  const res = await first.answered();
  if (res.statusCode !== 200 || exact(res.body) !== exact(knownAnswer())) problems.push(`the owner's request should answer 200 ${show(knownAnswer())}; answered ${showRes(res)}`);
  assert(problems.length === 0, problems.join('\n        '));
});

// ─── DR9–DR19: counting ────────────────────────────────────────────────────────────────────────────────────────

test('DR9: an authorised request counts once each — countStrict(filter over both stamps, { timeoutMs: limitMs }) and runCypher("MATCH ()-[r:TAGS]->() RETURN count(r) AS n", {}, { timeout: limitMs }) — with limitMs 10000 by default and an injected d.limitMs used everywhere (the answer\'s limitMs, both time-outs, every race timer) [AC-4 "reads only", "takes longer than 10 seconds"; ADR 0004 § Server → The relay count, The graph count, Both counts]', async () => {
  const handle = freshHandler();
  await cases([
    { name: 'the default limit', inject: false, limit: LIMIT },
    { name: 'an injected limit of 4321 ms', inject: true, limit: 4321 },
  ], async (c) => {
    const b = bundle(c.inject ? { limitMs: c.limit } : {});
    const res = await callHandler(handle, driftReq(), b.deps);
    eq(res.statusCode, 200, `status (answer ${showRes(res)})`);
    eq(b.calls.countStrict.length, 1, 'countStrict calls (one count over both stamps, never two added)');
    same(b.calls.countStrict[0].filter, { kinds: [39999], '#z': [Z_CANONICAL, Z_LOCAL] }, 'countStrict\'s filter');
    same(b.calls.countStrict[0].opts, { timeoutMs: c.limit }, 'countStrict\'s options');
    eq(b.calls.runCypher.length, 1, 'runCypher calls');
    eq(b.calls.runCypher[0].text, CYPHER, 'the Cypher text (a MATCH … RETURN, reads only)');
    same(b.calls.runCypher[0].params, {}, 'the Cypher parameters');
    same(b.calls.runCypher[0].tx, { timeout: c.limit }, 'the transaction config (server-side timeout)');
    eq(res.body && res.body.limitMs, c.limit, 'the answer\'s limitMs');
    assert(b.timers.list.length >= 1, 'no count was raced against a timer through d.setTimer');
    const odd = b.timers.list.filter((t) => t.ms !== c.limit);
    assert(odd.length === 0, `every race timer should be set for limitMs (${c.limit}); got delays ${show(b.timers.list.map((t) => t.ms))}`);
  });
});

test('DR10: the stamps come from the real resolveIdentities over the runner\'s nested identities — { canonicalZ(), getOwnerAssistantPubkey() } — so the canonical z-tag\'s pubkey and the local assistant\'s pubkey both reach the relay filter, and one pubkey for both gives one z [AC-4; ADR 0004 § Server → Dependencies: "The identities come from resolveIdentities in the runner\'s nested shape"; § Seams: "the real resolveIdentities over fake identities"]', async () => {
  const handle = freshHandler();
  const OTHER_LOCAL = pubkeyOf('another-assistant');
  await cases([
    { name: 'distinct identities', local: LOCAL, want: [Z_CANONICAL, Z_LOCAL] },
    { name: 'another local assistant', local: OTHER_LOCAL, want: [Z_CANONICAL, `39998:${OTHER_LOCAL}:nostr-user-tag`] },
    { name: 'the same pubkey for both', local: CANONICAL, want: [Z_CANONICAL] },
  ], async (c) => {
    const seen = { canonicalZ: 0, assistant: 0 };
    const b = bundle({ identities: {
      canonicalZ: () => { seen.canonicalZ++; return Z_CANONICAL; },
      getOwnerAssistantPubkey: () => { seen.assistant++; return c.local; },
    } });
    const res = await callHandler(handle, driftReq(), b.deps);
    eq(res.statusCode, 200, `status (answer ${showRes(res)})`);
    assert(seen.canonicalZ >= 1 && seen.assistant >= 1, `the nested identities were not asked (canonicalZ ${seen.canonicalZ}, getOwnerAssistantPubkey ${seen.assistant}); a flat shape would refuse`);
    eq(b.calls.countStrict.length, 1, 'countStrict calls');
    same(b.calls.countStrict[0].filter, { kinds: [39999], '#z': c.want }, 'the relay filter');
    same(res.body && res.body.stamps, { canonical: CANONICAL.slice(0, 8), local: c.local.slice(0, 8) }, 'stamps (8-character prefixes, T8)');
  });
});

test('DR11: the 200 answer has exactly the ADR\'s shape with a fixed clock — { success: true, limitMs: 10000, relay: { known: true, count, takenAt, ms: 0 }, graph: { known: true, count, takenAt, ms: 0 }, stamps: { canonical, local } as 8-character prefixes } — and carries no full pubkey, path or URI [AC-4 "both counts, and when they were taken"; ADR 0004 § Server → The answer; T8]', async () => {
  const handle = freshHandler();
  const b = bundle();
  const res = await callHandler(handle, driftReq(), b.deps);
  eq(res.statusCode, 200, `status (answer ${showRes(res)})`);
  same(res.body, knownAnswer(), 'the answer');
  const leaks = leakProblems('the 200 answer', res);
  assert(leaks.length === 0, leaks.join('\n        '));
});

test('DR12: an identity refusal answers 200 with relay { known: false, code: "identity", identity: "canonical" | "local", takenAt, ms: 0 }, spawns no relay count, still counts the graph, and gives the refused identity\'s stamp as null while a resolved one is still given (a local refusal keeps the canonical prefix) [AC-4 "Unknown, never 0"; ADR 0004 § Server → The relay count: "An identity refusal … with nothing spawned"; The answer: stamps "null for one that did not resolve"; T11]', async () => {
  const handle = freshHandler();
  await cases([
    { name: 'a canonical z-tag that is not a nostr-user-tag stamp', identity: 'canonical', ids: { canonicalZ: () => 'not-a-stamp', getOwnerAssistantPubkey: () => LOCAL } },
    { name: 'a canonical getter that throws', identity: 'canonical', ids: { canonicalZ: () => { throw new Error('profile-tags unavailable'); }, getOwnerAssistantPubkey: () => LOCAL } },
    { name: 'an upper-case canonical pubkey', identity: 'canonical', ids: { canonicalZ: () => `39998:${CANONICAL.toUpperCase()}:nostr-user-tag`, getOwnerAssistantPubkey: () => LOCAL } },
    { name: 'no local assistant key', identity: 'local', ids: { canonicalZ: () => Z_CANONICAL, getOwnerAssistantPubkey: () => null } },
    { name: 'a local assistant key that is not 64-hex', identity: 'local', ids: { canonicalZ: () => Z_CANONICAL, getOwnerAssistantPubkey: () => 'abc123' } },
  ], async (c) => {
    const b = bundle({ identities: c.ids });
    const res = await callHandler(handle, driftReq(), b.deps);
    eq(res.statusCode, 200, `status (answer ${showRes(res)})`);
    eq(b.calls.countStrict.length, 0, 'countStrict calls (nothing is spawned on an identity refusal)');
    same(res.body && res.body.relay, { known: false, code: 'identity', identity: c.identity, takenAt: iso(T0), ms: 0 }, 'relay');
    same(res.body && res.body.graph, { known: true, count: GRAPH_N, takenAt: iso(T0), ms: 0 }, 'graph (counted regardless)');
    eq(res.body.success, true, 'success');
    eq(res.body.limitMs, LIMIT, 'limitMs');
    const stamps = res.body.stamps;
    assert(stamps && typeof stamps === 'object' && exact(Object.keys(stamps).sort()) === exact(['canonical', 'local']), `stamps should be { canonical, local }; is ${show(stamps)}`);
    eq(stamps[c.identity], null, `stamps.${c.identity} (the refused identity)`);
    if (c.identity === 'local') {
      // resolveIdentities checks the canonical identity first, so a local refusal means the canonical one resolved.
      eq(stamps.canonical, CANONICAL.slice(0, 8), 'stamps.canonical (it resolved, so it is still given: T11)');
    } else {
      // The local identity is never resolved after a canonical refusal: its prefix or null.
      assert(stamps.local === null || stamps.local === LOCAL.slice(0, 8), `stamps.local should be its 8-character prefix or null; is ${show(stamps.local)}`);
    }
    const leaks = leakProblems('the identity-refusal answer', res, ['profile-tags unavailable', 'problem', 'source']);
    assert(leaks.length === 0, leaks.join('\n        '));
  });
});

test('DR13: a relay count that fails is unknown, never 0 — a ScanError timeout answers relay { known: false, code: "timeout", takenAt, ms } with no count, and every other ScanError code passes through allowErrorCode as itself [AC-4 "A count that fails, or takes longer than 10 seconds, reads unknown, never 0"; ADR 0004 § Server → countStrict\'s codes, Both counts: "Every other failure is allowErrorCode(err && err.code)"]', async () => {
  const handle = freshHandler();
  await cases(['timeout', 'exit', 'signal', 'spawn', 'process-error', 'unparseable', 'filter-too-large'].map((code) => ({ name: code, code })), async (c) => {
    const b = bundle({ count: () => Promise.reject(scanError(c.code)) });
    const res = await callHandler(handle, driftReq(), b.deps);
    eq(res.statusCode, 200, `status (a failed count is a known shape, never a 500; answer ${showRes(res)})`);
    same(res.body && res.body.relay, unknown(c.code), 'relay');
    same(res.body && res.body.graph, { known: true, count: GRAPH_N, takenAt: iso(T0), ms: 0 }, 'graph');
    const leaks = leakProblems(`relay ${c.code}`, res);
    assert(leaks.length === 0, leaks.join('\n        '));
  });
});

test('DR14: a graph answer that is not exactly one row whose n is a non-negative safe integer is unparseable — [], [{ n: null }], [{ n: -1 }], [{ n: 1.5 }], two rows, [{}], [{ n: "5" }], [{ n: 2^53 }], [{ n: NaN }], null, undefined and a bare object — answering graph { known: false, code: "unparseable", takenAt, ms: 0 } with no count [AC-4 "Unknown, never 0"; ADR 0004 § Server → The graph count]', async () => {
  const handle = freshHandler();
  await cases([
    ['no rows', []], ['n null', [{ n: null }]], ['n -1', [{ n: -1 }]], ['n 1.5', [{ n: 1.5 }]],
    ['two rows', [{ n: 1 }, { n: 2 }]], ['a row with no n', [{}]], ['n as a string', [{ n: '5' }]],
    ['n 2^53', [{ n: 2 ** 53 }]], ['n NaN', [{ n: NaN }]], ['null', null], ['undefined', undefined], ['a bare object', { n: 5 }],
  ].map(([name, rows]) => ({ name, rows })), async (c) => {
    const b = bundle({ cypher: () => Promise.resolve(c.rows) });
    const res = await callHandler(handle, driftReq(), b.deps);
    eq(res.statusCode, 200, `status (answer ${showRes(res)})`);
    same(res.body && res.body.graph, unknown('unparseable'), 'graph');
    same(res.body && res.body.relay, { known: true, count: RELAY_N, takenAt: iso(T0), ms: 0 }, 'relay');
  });
});

test('DR15: a count of 0 that was actually counted is known — relay 0 and graph [{ n: 0 }] answer known: true, count: 0 — so "unknown" and 0 stay distinct [AC-4 "Unknown, never 0"; ADR 0004 § Server → The answer: "count is present only when known is true"]', async () => {
  const handle = freshHandler();
  const b = bundle({ count: () => Promise.resolve(0), cypher: () => Promise.resolve([{ n: 0 }]) });
  const res = await callHandler(handle, driftReq(), b.deps);
  eq(res.statusCode, 200, `status (answer ${showRes(res)})`);
  same(res.body, knownAnswer({ relay: 0, graph: 0 }), 'the answer');
});

test('DR16: a graph count that fails passes its code through allowErrorCode — a Neo4j status code, ServiceUnavailable, SessionExpired and an E-code as themselves; a code outside the allow-list, or none, as "error" — and no answer carries the error\'s message, host, path or credential text [AC-4 "Unknown, never 0"; ADR 0004 § Server → Both counts; The answer: "No host, path, message or credential is ever in the answer"]', async () => {
  const handle = freshHandler();
  await cases([
    ['a Neo4j client error', 'Neo.ClientError.Transaction.TransactionTimedOutClientConfiguration', 'Neo.ClientError.Transaction.TransactionTimedOutClientConfiguration'],
    ['a Neo4j transient error', 'Neo.TransientError.General.DatabaseUnavailable', 'Neo.TransientError.General.DatabaseUnavailable'],
    ['ServiceUnavailable', 'ServiceUnavailable', 'ServiceUnavailable'],
    ['SessionExpired', 'SessionExpired', 'SessionExpired'],
    ['ECONNREFUSED', 'ECONNREFUSED', 'ECONNREFUSED'],
    ['a host:port as the code', 'neo4j.internal:7687', 'error'],
    ['a message-like code', 'Could not connect', 'error'],
    ['no code', undefined, 'error'],
    ['a numeric code', 7687, 'error'],
  ].map(([name, code, want]) => ({ name, code, want })), async (c) => {
    const b = bundle({ cypher: () => Promise.reject(noisyError(c.code, 'Neo4jError')) });
    const res = await callHandler(handle, driftReq(), b.deps);
    eq(res.statusCode, 200, `status (a failed count is a known shape, never a 500; answer ${showRes(res)})`);
    same(res.body && res.body.graph, unknown(c.want), 'graph');
    same(res.body && res.body.relay, { known: true, count: RELAY_N, takenAt: iso(T0), ms: 0 }, 'relay');
    const leaks = leakProblems(c.name, res, ['Could not', 'Neo4jError']);
    assert(leaks.length === 0, leaks.join('\n        '));
  });
});

test('DR17: a count that never settles loses its race through the injected d.setTimer — the graph (or the relay) answers { known: false, code: "timeout", takenAt, ms: limitMs } while the other count stays known, the settled count\'s timer is cleared, and every timer is set for limitMs [AC-4 "takes longer than 10 seconds, reads unknown"; ADR 0004 § Server → Both counts: "raced against d.limitMs through d.setTimer … A lost race is timeout"; T8: "limitMs exactly for a lost race"]', async () => {
  freshHandler(); // names a missing module before the cases run
  await cases([
    { name: 'the graph never settles', stuck: 'graph' },
    { name: 'the relay never settles', stuck: 'relay' },
  ], async (c) => {
    const handle = freshHandler(); // fresh per case: a stuck count keeps its module's in-flight slot forever
    const never = new Promise(() => {});
    const b = bundle(c.stuck === 'graph' ? { cypher: () => never } : { count: () => never });
    const run = startHandler(handle, driftReq(), b.deps);
    await settle(12);
    assert(!run.res.finished, `the handler answered before the stuck count's race was lost: ${showRes(run.res)}`);
    assert(b.timers.list.length >= 1, 'no timer was set through d.setTimer (the count must be raced against d.limitMs with the injected timer)');
    const odd = b.timers.list.filter((t) => t.ms !== LIMIT);
    assert(odd.length === 0, `every race timer should be set for limitMs (${LIMIT}); got ${show(b.timers.list.map((t) => t.ms))}`);
    assert(b.timers.list.some((t) => t.cleared), 'the settled count\'s timer was not cleared through d.clearTimer when it settled');
    const live = b.timers.list.filter((t) => !t.cleared);
    assert(live.length >= 1, 'no timer is left racing the stuck count');
    for (const t of live) t.fire();
    const res = await run.answered();
    eq(res.statusCode, 200, `status (answer ${showRes(res)})`);
    const known = c.stuck === 'graph' ? { known: true, count: RELAY_N, takenAt: iso(T0), ms: 0 } : { known: true, count: GRAPH_N, takenAt: iso(T0), ms: 0 };
    same(res.body && res.body[c.stuck], unknown('timeout', LIMIT), `${c.stuck} (lost race)`);
    same(res.body && res.body[c.stuck === 'graph' ? 'relay' : 'graph'], known, 'the other count');
  });
});

test('DR18: when both counts settle every race timer is cleared through d.clearTimer and none fires — for two known counts, two failed counts, and an unparseable graph answer [AC-4; ADR 0004 § Server → Both counts: "each timer is cleared when its count settles"]', async () => {
  const handle = freshHandler();
  await cases([
    { name: 'two known counts', bo: {} },
    { name: 'two failed counts', bo: { count: () => Promise.reject(scanError('exit')), cypher: () => Promise.reject(noisyError('ServiceUnavailable')) } },
    { name: 'an unparseable graph answer', bo: { cypher: () => Promise.resolve([]) } },
  ], async (c) => {
    const b = bundle(c.bo);
    const res = await callHandler(handle, driftReq(), b.deps);
    await settle();
    eq(res.statusCode, 200, `status (answer ${showRes(res)})`);
    assert(b.timers.list.length >= 1, 'no timer was set through d.setTimer');
    const open = b.timers.list.filter((t) => !t.cleared);
    assert(open.length === 0, `${open.length} of ${b.timers.list.length} race timer(s) were never cleared through d.clearTimer`);
    assert(b.timers.list.every((t) => !t.fired), 'a timer fired');
  });
});

test('DR19: a count that throws synchronously is an unknown count, never a 500 — countStrict throwing EMFILE gives relay { known: false, code: "EMFILE" }, runCypher throwing a bare Error gives graph { known: false, code: "error" }, and the other count stays known [AC-4 "Unknown, never 0"; ADR 0004 § Server → The answer: "a failed count is a known shape, never a 500"; Single flight: "every failure inside becomes an unknown count"]', async () => {
  const handle = freshHandler();
  await cases([
    { name: 'countStrict throws', bo: { count: () => { throw noisyError('EMFILE'); } }, relay: unknown('EMFILE'), graph: { known: true, count: GRAPH_N, takenAt: iso(T0), ms: 0 } },
    { name: 'runCypher throws', bo: { cypher: () => { throw noisyError(undefined); } }, relay: { known: true, count: RELAY_N, takenAt: iso(T0), ms: 0 }, graph: unknown('error') },
    { name: 'both throw', bo: { count: () => { throw noisyError('EMFILE'); }, cypher: () => { throw noisyError(undefined); } }, relay: unknown('EMFILE'), graph: unknown('error') },
  ], async (c) => {
    const b = bundle(c.bo);
    const res = await callHandler(handle, driftReq(), b.deps);
    eq(res.statusCode, 200, `status (answer ${showRes(res)})`);
    same(res.body && res.body.relay, c.relay, 'relay');
    same(res.body && res.body.graph, c.graph, 'graph');
    eq(res.body.success, true, 'success');
    const leaks = leakProblems(c.name, res);
    assert(leaks.length === 0, leaks.join('\n        '));
  });
});

test('DR27: ms is the time from a count\'s start to its settling and takenAt is its start, under a clock that moves while the counts run — a relay that settles 212 ms in and a graph that settles 530 ms in answer ms 212 and 530 with takenAt at the start for both, whether the counts are known or failed [AC-4 "both counts, and when they were taken"; ADR 0004 § Server → The answer; T8: "ms is d.now() at settle minus d.now() at start"]', async () => {
  const handle = freshHandler();
  await cases([
    {
      name: 'two known counts',
      settleRelay: (d) => d.resolve(RELAY_N),
      settleGraph: (d) => d.resolve([{ n: GRAPH_N }]),
      relay: { known: true, count: RELAY_N, takenAt: iso(T0), ms: 212 },
      graph: { known: true, count: GRAPH_N, takenAt: iso(T0), ms: 530 },
    },
    {
      name: 'two failed counts',
      settleRelay: (d) => d.reject(scanError('exit')),
      settleGraph: (d) => d.reject(noisyError('ServiceUnavailable')),
      relay: unknown('exit', 212),
      graph: unknown('ServiceUnavailable', 530),
    },
  ], async (c) => {
    let clock = T0;
    const relay = deferred();
    const graph = deferred();
    const b = bundle({ now: () => clock, count: () => relay.promise, cypher: () => graph.promise });
    const run = startHandler(handle, driftReq(), b.deps);
    await settle();
    eq(b.calls.countStrict.length, 1, 'countStrict calls once the count has started');
    eq(b.calls.runCypher.length, 1, 'runCypher calls once the count has started');
    clock = T0 + 212;
    c.settleRelay(relay);
    await settle();
    assert(!run.res.finished, `the handler answered before the graph count settled: ${showRes(run.res)}`);
    clock = T0 + 530;
    c.settleGraph(graph);
    const res = await run.answered();
    eq(res.statusCode, 200, `status (answer ${showRes(res)})`);
    same(res.body && res.body.relay, c.relay, 'relay (takenAt at the start, ms from start to settle)');
    same(res.body && res.body.graph, c.graph, 'graph (takenAt at the start, ms from start to settle)');
    eq(res.body.limitMs, LIMIT, 'limitMs');
  });
});

// ─── DR20–DR22: single flight; Express's next ──────────────────────────────────────────────────────────────────

test('DR20: single flight — two authorised requests while one count is pending (the owner, then an admin two seconds later) share it: countStrict and runCypher are called once, both get the same answer (takenAt included, from the first request\'s start), and a request after it settles counts again with its own takenAt [AC-4; ADR 0004 § Server → Single flight: "joins it and gets the same answer, takenAt included"; § Seams: "a deferred fake countStrict that is called once for two concurrent requests"]', async () => {
  const handle = freshHandler();
  let clock = T0;
  const relay = deferred();
  let n = 0;
  const b = bundle({ now: () => clock, count: () => { n++; return n === 1 ? relay.promise : Promise.resolve(RELAY_N + 1); } });
  const first = startHandler(handle, driftReq(), b.deps);
  await settle();
  clock = T0 + 2000;
  const second = startHandler(handle, driftReq({ session: adminSession() }), b.deps);
  await settle();
  eq(b.calls.countStrict.length, 1, 'countStrict calls while one count is in flight (the second request joins it)');
  eq(b.calls.runCypher.length, 1, 'runCypher calls while one count is in flight');
  assert(!second.res.finished, `the joining request answered before the shared count settled: ${showRes(second.res)}`);
  relay.resolve(RELAY_N);
  const [a, c] = [await first.answered(), await second.answered()];
  eq(a.statusCode, 200, `the first request's status (${showRes(a)})`);
  eq(c.statusCode, 200, `the joining request's status (${showRes(c)})`);
  same(c.body, a.body, 'the joining request\'s answer (the same answer, takenAt included)');
  eq(a.body && a.body.relay && a.body.relay.takenAt, iso(T0), 'relay.takenAt (the shared count\'s start)');
  eq(a.body && a.body.relay && a.body.relay.count, RELAY_N, 'relay.count');
  clock = T0 + 60000;
  const later = await callHandler(handle, driftReq(), b.deps);
  eq(b.calls.countStrict.length, 2, 'countStrict calls after the first count settled (a later request counts again)');
  eq(b.calls.runCypher.length, 2, 'runCypher calls after the first count settled');
  same(later.body && later.body.relay, { known: true, count: RELAY_N + 1, takenAt: iso(T0 + 60000), ms: 0 }, 'the later request\'s relay');
});

test('DR21: the in-flight count is released even when both counts fail — after an answer with two unknown counts, the next request counts again [AC-4; ADR 0004 § Server → Single flight: "inflight is cleared in a finally"]', async () => {
  const handle = freshHandler();
  let fail = true;
  const b = bundle({
    count: () => (fail ? Promise.reject(scanError('exit')) : Promise.resolve(RELAY_N)),
    cypher: () => (fail ? Promise.reject(noisyError('ServiceUnavailable')) : Promise.resolve([{ n: GRAPH_N }])),
  });
  const res1 = await callHandler(handle, driftReq(), b.deps);
  same(res1.body && { relay: res1.body.relay, graph: res1.body.graph }, { relay: unknown('exit'), graph: unknown('ServiceUnavailable') }, 'the first answer\'s counts');
  fail = false;
  const res2 = await callHandler(handle, driftReq(), b.deps);
  eq(b.calls.countStrict.length, 2, 'countStrict calls');
  eq(b.calls.runCypher.length, 2, 'runCypher calls');
  same(res2.body, knownAnswer(), 'the second answer');
});

test('DR22: Express\'s next as the third argument is ignored as deps and never called — a signed-out request answers 401 and a stranger 403 on the default deps, with no throw [AC-4; ADR 0004 § Server → Dependencies: "a non-object third argument (Express\'s next) is ignored, as RR23 pins for the other routes"]', async () => {
  const handle = freshHandler();
  const problems = [];
  for (const [label, o, status, body] of [
    ['a signed-out request', { session: undefined }, 401, ERR_401],
    ['a signed-in stranger', { session: { authenticated: true, pubkey: STRANGER } }, 403, ERR_403],
  ]) {
    let nextCalls = 0;
    const next = () => { nextCalls++; };
    let res;
    try { res = await callHandler(handle, driftReq(o), next); } catch (e) { problems.push(`${label}: ${firstLine(e)}`); continue; }
    if (res.statusCode !== status || exact(res.body) !== exact(body)) problems.push(`${label}: should answer ${status} ${show(body)}; answered ${showRes(res)}`);
    if (nextCalls) problems.push(`${label}: next was called ${nextCalls} time(s)`);
  }
  assert(problems.length === 0, problems.join('\n        '));
});

// ─── DR23–DR26: load and wiring ────────────────────────────────────────────────────────────────────────────────

/** Require drift.js in a child that traps every read outside the module tree, connect and spawn; report what it saw. */
function childProbe() {
  const script = `
    const fs = require('fs'), net = require('net'), http = require('http'), https = require('https'), cp = require('child_process');
    const REPO = ${JSON.stringify(REPO)};
    const out = { reads: [], net: [], spawn: [] };
    const CONFIGISH = /brainstorm\\.conf|settings[^\\/]*\\.json$|defaults\\.json$|secure|nsec|\\.env$/i;
    const suspicious = (p) => { const s = String(p); return !s.startsWith(REPO) || CONFIGISH.test(s); };
    for (const fn of ['readFileSync', 'readFile', 'existsSync', 'statSync', 'openSync', 'readdirSync', 'accessSync', 'createReadStream']) {
      const orig = fs[fn];
      if (typeof orig !== 'function') continue;
      fs[fn] = function (p, ...rest) { if (typeof p === 'string' && suspicious(p)) out.reads.push(fn + ' ' + p); return orig.call(this, p, ...rest); };
    }
    const origPRead = fs.promises.readFile;
    fs.promises.readFile = function (p, ...rest) { if (typeof p === 'string' && suspicious(p)) out.reads.push('promises.readFile ' + p); return origPRead.call(this, p, ...rest); };
    const trapNet = (obj, name, label) => { const orig = obj[name]; obj[name] = function (...a) { out.net.push(label); return orig.apply(this, a); }; };
    trapNet(net.Socket.prototype, 'connect', 'net.Socket.connect');
    trapNet(net, 'connect', 'net.connect'); trapNet(net, 'createConnection', 'net.createConnection');
    trapNet(http, 'request', 'http.request'); trapNet(http, 'get', 'http.get');
    trapNet(https, 'request', 'https.request'); trapNet(https, 'get', 'https.get');
    for (const name of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) {
      const orig = cp[name]; cp[name] = function (...a) { out.spawn.push(name + ' ' + String(a[0])); return orig.apply(this, a); };
    }
    try { const m = require(${JSON.stringify(DRIFT_MOD)}); out.exports = Object.keys(m); }
    catch (e) { out.error = String((e && e.message) || e).split('\\n')[0]; }
    out.loaded = Object.keys(require.cache);
    setImmediate(() => { process.stdout.write('\\n@@PROBE@@' + JSON.stringify(out) + '\\n'); });
  `;
  const env = { PATH: process.env.PATH, HOME: process.env.HOME };
  const r = spawnSync(process.execPath, ['-e', script], { cwd: REPO, env, encoding: 'utf8', timeout: 20000 });
  const line = String(r.stdout || '').split('\n').find((l) => l.startsWith('@@PROBE@@'));
  assert(line, `the probe printed nothing; exit ${r.status}, signal ${r.signal}, stderr: ${String(r.stderr || '').slice(-600)}`);
  return JSON.parse(line.slice('@@PROBE@@'.length));
}

test('DR23: drift.js loads stack-free — requiring it reads no config file, opens no connection, spawns no process, and loads neither neo4j-driver nor src/api/profile-tags nor src/utils/assistantKeys (defaultDeps() loads everything lazily) [AC-4; ADR 0004 § Server → Dependencies: "defaultDeps() loads everything lazily"; the graph count "adds no config read"]', () => {
  if (!fs.existsSync(DRIFT_MOD)) throw new Error(`${DRIFT_REL} not implemented yet: the file does not exist (ADR 0004 § Implementation notes → Server)`);
  const p = childProbe();
  assert(!p.error, `${DRIFT_REL} not implemented yet (require failed in a clean child: ${p.error})`);
  const sep = path.sep;
  const loaded = p.loaded || [];
  const problems = [];
  if ((p.reads || []).length) problems.push(`requiring drift.js read config or files outside the module tree: ${show(p.reads.slice(0, 5))}`);
  if ((p.net || []).length) problems.push(`requiring drift.js opened a connection: ${show(p.net.slice(0, 5))}`);
  if ((p.spawn || []).length) problems.push(`requiring drift.js spawned a process: ${show(p.spawn.slice(0, 5))}`);
  const driver = loaded.filter((k) => k.includes(`${sep}node_modules${sep}neo4j-driver${sep}`));
  if (driver.length) problems.push(`neo4j-driver loaded at require time (${driver.length} file(s)); runCypher must be required lazily`);
  const tags = loaded.filter((k) => k.includes(`${sep}src${sep}api${sep}profile-tags${sep}`));
  if (tags.length) problems.push(`src/api/profile-tags loaded at require time; the canonical getter requires it lazily: ${show(tags.slice(0, 2))}`);
  const keys = loaded.filter((k) => k.endsWith(`${sep}src${sep}utils${sep}assistantKeys.js`));
  if (keys.length) problems.push('src/utils/assistantKeys.js loaded at require time; the local getter requires it lazily');
  assert(problems.length === 0, problems.join('\n        '));
});

test('DR24: drift.js takes allowErrorCode from src/lib/tagging-edges/realtime.js and keeps no copy of it — no function or assignment named allowErrorCode, no Neo4j status-code pattern, no ServiceUnavailable or SessionExpired — holds no 64-hex literal, and reads only: no writeCypher, Neo4j write transaction, runViaQueue, task queue, child_process or spawn call, and no string holding MERGE, CREATE, DELETE, DETACH, SET or REMOVE (comments dropped; a static check) [AC-4 "Reads only … it never starts a pass"; ADR 0004 § Server → Dependencies: "allowErrorCode comes from require(\'../../lib/tagging-edges/realtime\') and is never copied (SWR71)"; CLAUDE.md: never hardcode the TA pubkey]', () => {
  if (!fs.existsSync(DRIFT_MOD)) throw new Error(`${DRIFT_REL} not implemented yet: the file does not exist (ADR 0004 § Implementation notes → Server)`);
  const code = jsCodeOnly(fs.readFileSync(DRIFT_MOD, 'utf8'));
  const problems = [];
  if (!/require\(\s*['"]\.\.\/\.\.\/lib\/tagging-edges\/realtime(\.js)?['"]\s*\)/.test(code)) problems.push('no require(\'../../lib/tagging-edges/realtime\')');
  if (!/\ballowErrorCode\b/.test(code)) problems.push('allowErrorCode is never used');
  if (/function\s+allowErrorCode\b/.test(code) || /\ballowErrorCode\s*[:=]\s*(async\b|function\b|\(|[A-Za-z_$][\w$]*\s*=>)/.test(code)) problems.push('drift.js defines its own allowErrorCode');
  if (/ClientError|TransientError|DatabaseError/.test(code)) problems.push('drift.js copies the Neo4j status-code pattern');
  if (/ServiceUnavailable|SessionExpired/.test(code)) problems.push('drift.js names ServiceUnavailable or SessionExpired (the allow-list is the library\'s)');
  const hex = /[0-9a-fA-F]{64}/.exec(code);
  if (hex) problems.push(`drift.js holds a 64-hex literal (${hex[0].slice(0, 8)}…); identities are resolved at runtime`);
  // Reads only: nothing that writes the graph, queues a pass or spawns a process beside countStrict.
  for (const [re, what] of [
    [/\bwriteCypher\b/, 'writeCypher'],
    [/\bexecuteWrite\b|\bwriteTransaction\b/, 'a Neo4j write transaction'],
    [/\brunViaQueue/, 'runViaQueue (it would queue a pass)'],
    [/\btaskQueue\b/i, 'the task queue'],
    [/child_process/, 'child_process'],
    [/(^|[^.\w$])(spawn|spawnSync|execSync|execFile|execFileSync|fork)\s*\(/, 'a process spawn'],
  ]) {
    if (re.test(code)) problems.push(`drift.js names ${what}; the route reads only and never starts a pass`);
  }
  const literals = code.match(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g) || [];
  const writes = literals.filter((l) => /\b(MERGE|CREATE|DELETE|DETACH|SET|REMOVE)\b/.test(l));
  if (writes.length) problems.push(`drift.js holds a string with a Cypher write clause: ${show(writes.slice(0, 3))}; the route reads only`);
  assert(problems.length === 0, problems.join('\n        '));
});

test('DR25: src/api/index.js requires \'./tagging-edges/drift\' as taggingEdgesDrift and registers exactly app.get(\'/api/tagging-edges/drift-counts\', adminApi.requireOwnerOrAdmin, taggingEdgesDrift.handleDriftCounts) once, after adminApi is required — and the path is registered nowhere else (comments dropped) [AC-4 "Only a signed-in owner or admin can ask for a count"; ADR 0004 § Server → Registration]', () => {
  const code = jsCodeOnly(fs.readFileSync(INDEX_API, 'utf8'));
  const problems = [];
  const adminAt = code.search(/const\s+adminApi\s*=\s*require\(\s*['"]\.\/admin['"]\s*\)/);
  if (adminAt < 0) problems.push('src/api/index.js no longer requires ./admin as adminApi (the test\'s anchor)');
  const reqRe = /const\s+taggingEdgesDrift\s*=\s*require\(\s*['"]\.\/tagging-edges\/drift(\.js)?['"]\s*\)\s*;?/g;
  const reqs = [...code.matchAll(reqRe)];
  if (reqs.length !== 1) problems.push(`const taggingEdgesDrift = require('./tagging-edges/drift') should appear once; appears ${reqs.length} time(s)`);
  const regRe = /app\.get\(\s*['"]\/api\/tagging-edges\/drift-counts['"]\s*,\s*adminApi\.requireOwnerOrAdmin\s*,\s*taggingEdgesDrift\.handleDriftCounts\s*\)\s*;/g;
  const regs = [...code.matchAll(regRe)];
  if (regs.length !== 1) problems.push(`app.get('${ROUTE_PATH}', adminApi.requireOwnerOrAdmin, taggingEdgesDrift.handleDriftCounts); should appear once; appears ${regs.length} time(s)`);
  const mentions = code.split(ROUTE_PATH).length - 1;
  if (mentions !== 1) problems.push(`the path '${ROUTE_PATH}' should appear once in src/api/index.js (its one registration); appears ${mentions} time(s)`);
  if (regs.length === 1 && adminAt >= 0 && regs[0].index < adminAt) problems.push('the route is registered before adminApi is required');
  if (regs.length === 1 && reqs.length === 1 && regs[0].index < reqs[0].index) problems.push('the route is registered before taggingEdgesDrift is required');
  assert(problems.length === 0, problems.join('\n        '));
});

// Re-aimed for security-auth-exposure #8 (ADR 0005): the auth middleware's hand-kept substring lists are gone; the
// route table decides access by exact path pattern, so the substring-overmatch this guarded against cannot happen.
// The drift-counts read is owner-or-admin guarded, so the table must resolve it to 'owner' (owner, admins,
// direct-local) — the route's own requireOwnerOrAdmin guard still stands (asserted elsewhere in this suite).
test('DR26: the drift-counts route resolves to owner in the route table (its own owner-or-admin guard still answers) [AC-4; ADR 0005]', () => {
  const TABLE = path.join(REPO, 'src/middleware/routeAccess.js');
  assert(fs.existsSync(TABLE), 'src/middleware/routeAccess.js does not exist yet (ADR 0005 Decision 1)');
  delete require.cache[require.resolve(TABLE)];
  const access = require(TABLE).resolveRouteAccess('GET', ROUTE_PATH);
  assert(access === 'owner', `ADR 0005: GET ${ROUTE_PATH} must resolve to 'owner'; got '${access}'`);
});

// ─── runner ────────────────────────────────────────────────────────────────────────────────────────────────────
async function run() {
  console.log('\n--- tagging-edges drift-counts route tests (epic tagging-edges, Story 4 — ADR 0004 § Server, T8) ---');
  const saved = { TA_PUBKEY: process.env.TA_PUBKEY, BRAINSTORM_RELAY_PUBKEY: process.env.BRAINSTORM_RELAY_PUBKEY };
  delete process.env.TA_PUBKEY;
  delete process.env.BRAINSTORM_RELAY_PUBKEY;
  let pass = 0, fail = 0;
  const failures = [];
  try {
    for (const [name, fn] of tests) {
      try { await fn(); console.log(`  PASS  ${name}`); pass++; }
      catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failures.push({ name, message: err.message }); fail++; }
    }
  } finally {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    forget();
  }
  console.log(`\ntagging-edges-drift-route: ${pass} passed, ${fail} failed, 0 skipped`);
  return { pass, fail, skipped: 0, failures };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
