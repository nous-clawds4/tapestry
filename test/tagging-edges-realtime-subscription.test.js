'use strict';
/**
 * Tests for Story 3 (epic tagging-edges) — the real-time path's live SUBSCRIPTION, the one websocket client:
 * src/pipeline/tagging-edges/realtime/subscription.js, driven for real against an in-process relay.
 *
 * Story: engineering-team/stories/tagging-edges/3-real-time-path.md — AC-1 (the path hears every stored tagging and
 *        revoke live), AC-3 (a dropped or refused connection loses nothing: the engine reconnects and catches up),
 *        AC-6 (nothing the status carries names where the relay is reached).
 * ADR:   engineering-team/decisions/tagging-edges/0003-real-time-path.md — § What it hears ("One REQ (subscription id
 *        tagging-edges-realtime) carries two filters, both with limit:0"; "Keeping it alive": a ping every 30 s, no pong
 *        within 10 s, any close, CLOSED or NOTICE ends the connection), Implementation notes (subscription.js: "REQ with
 *        limit:0, EOSE, ping and pong … and an onEvent / onEose / onClose surface. No state"), T20 (deps.subscribe({
 *        url, filters, onEvent, onEose, onClose }) → { close() }) and T29 ("subscribe's callbacks are called
 *        asynchronously, never inside subscribe() … A client-side close() fires no onClose").
 * Review: engineering-team/reviews/tagging-edges/3-real-time-path.md, round 1, Non-blocking 8 ("The only websocket client
 *        has no automated test … Tester follow-up: a suite against an in-process ws server") and harness friction 2
 *        (ledger row 2026-09-29-test-plan-misses-injected-seams: every engine suite fakes deps.subscribe).
 *
 * Coverage of existing behaviour: every test here passes on the implementation it was written against (review round 1).
 * The tests, by what they pin:
 *   RSUB1  the REQ: one message, the subscription id, the caller's filters in order with limit 0 forced
 *   RSUB2  EOSE, then each EVENT in the order the relay sent it; a second EOSE is not reported again
 *   RSUB3  messages for another subscription id, and frames that are no message for it, are ignored
 *   RSUB4  NOTICE and CLOSED end the connection, reported with a fixed reason, never the relay's own text
 *   RSUB5  pings: answered pongs keep it open; no pong within pongTimeoutMs ends it ('no pong')
 *   RSUB6  a refused connection (nothing listening, an upgrade refused, a handshake that never completes) and a
 *          dropped one (terminated, or closed by the relay)
 *   RSUB7  close(): CLOSE for the subscription id, then the socket closes, and no onClose; before the socket opens, no
 *          REQ at all
 *   RSUB8  a URL the client refuses at once is reported later, never from inside subscribe() (T29)
 *
 * The relay is a ws WebSocketServer (ws is a dependency) on 127.0.0.1, port 0, in this process; a refused connection
 * uses a port nothing listens on. The ping, pong and handshake time-outs run on subscribe()'s own seams
 * (pingIntervalMs, pongTimeoutMs, handshakeTimeoutMs), so each test takes well under a second of real time. The suite
 * calls subscribe() only; the subscription id is the ADR's literal. Every server, client and socket a test opens is
 * closed in `finally`, so the process exits by itself.
 *
 * The module is require()d LAZILY through load(), so the suite always loads. Stack-free and hermetic: loopback only, no
 * strfry, no Neo4j, no filesystem; the fixture events carry fake 64-hex pubkeys (never a deployment's TA, never the ADR
 * 0015 literal). Node 16 and 22.
 *
 * Hand-rolled in the project's existing test style — no new framework.
 */

const path = require('path');
const net = require('net');
const http = require('http');
const F = require('./helpers/taggingEdgesFixtures');

const REPO = path.resolve(__dirname, '..');
const SUB_REL = 'src/pipeline/tagging-edges/realtime/subscription.js';
const SUB = path.join(REPO, SUB_REL);

/** ADR 0003 § What it hears: the REQ's subscription id. */
const SUB_ID = 'tagging-edges-realtime';
/** The fixed reasons onClose reports (subscription.js's surface; AC-6: never the relay's text or an error message). */
const REASONS = Object.freeze(['connection refused', 'connection dropped', 'filter refused (CLOSED)', 'filter refused (NOTICE)', 'no pong']);
/** The two filters T4 gives, as the engine passes them (the stamps are fake identities). */
const FILTERS = Object.freeze([
  Object.freeze({ kinds: [39999], '#z': [F.STAMP(F.CANONICAL), F.STAMP(F.LOCAL)] }),
  Object.freeze({ kinds: [5] }),
]);
/** How long a test waits, in real time, for what should happen at once. */
const SOON_MS = 2000;

// ─── test harness ──────────────────────────────────────────────────────────────────────────────────────────────
const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
const show = (v) => { try { return JSON.stringify(v); } catch (_) { return String(v); } };
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') return Object.keys(v).sort().reduce((o, k) => { o[k] = sortKeys(v[k]); return o; }, {});
  return v;
}
function eq(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}\n        expected: ${show(expected)}\n        actual:   ${show(actual)}`);
}
function same(actual, expected, label) {
  const a = show(sortKeys(actual));
  const e = show(sortKeys(expected));
  if (a !== e) throw new Error(`${label}\n        expected: ${e}\n        actual:   ${a}`);
}
const firstLine = (e) => String((e && e.message) || e).split('\n')[0];

/** Run several cases; report every failing one, not only the first. */
async function cases(list, fn) {
  const failed = [];
  for (const c of list) {
    try { await fn(c); } catch (e) { failed.push(`[${c.name}] ${e.message}`); }
  }
  assert(failed.length === 0, `${failed.length} of ${list.length} case(s) failed:\n        ${failed.join('\n        ')}`);
}

/** Lazily load the module under test with a descriptive message. */
function load() {
  let m;
  try { m = require(SUB); } catch (e) { throw new Error(`${SUB_REL} not loadable (require failed: ${firstLine(e)})`); }
  assert(typeof m.subscribe === 'function', `${SUB_REL} must export subscribe({ url, filters, onEvent, onEose, onClose }) (ADR 0003 T20)`);
  return m;
}

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
/** Poll `pred` every few ms of real time until it holds or `ms` pass; fail naming `what`. */
async function until(pred, ms, what) {
  const end = Date.now() + ms;
  for (;;) {
    if (pred()) return;
    if (Date.now() >= end) throw new Error(`${what}: not within ${ms} ms`);
    await pause(5);
  }
}

// ─── the relay: a ws server on the loopback ────────────────────────────────────────────────────────────────────
/**
 * A throwaway relay on 127.0.0.1 (port 0). Every connection is kept in `conns` ({ i, ws, received, pings, closed });
 * every text or binary frame the client sends is kept, parsed where it parses, in `messages`. `onReq(conn, msg)` runs
 * when a REQ arrives (the relay's script); `onMessage(conn, m)` for every message. `autoPong: false` makes a relay
 * that never answers a ping (ws answers pings by itself otherwise). → { url, port, conns, messages, send, close }
 */
function relay({ autoPong = true, onReq = null, onMessage = null } = {}) {
  const { WebSocketServer } = require('ws');
  return new Promise((resolve, reject) => {
    const wss = new WebSocketServer({ host: '127.0.0.1', port: 0, autoPong });
    const r = { url: null, port: null, conns: [], messages: [] };
    wss.on('error', reject);
    wss.on('connection', (ws) => {
      const conn = { i: r.conns.length, ws, received: [], pings: 0, closed: null };
      r.conns.push(conn);
      ws.on('ping', () => { conn.pings += 1; });
      ws.on('close', (code) => { conn.closed = { code }; });
      ws.on('error', () => {});
      ws.on('message', (data, isBinary) => {
        const text = Buffer.isBuffer(data) ? data.toString('utf8') : String(data);
        let msg = null;
        try { msg = JSON.parse(text); } catch (_) { msg = null; }
        const m = { conn: conn.i, text, msg, binary: !!isBinary };
        conn.received.push(m);
        r.messages.push(m);
        if (onMessage) onMessage(conn, m);
        if (onReq && Array.isArray(msg) && msg[0] === 'REQ') onReq(conn, msg);
      });
    });
    wss.on('listening', () => {
      r.port = wss.address().port;
      r.url = `ws://127.0.0.1:${r.port}`;
      r.send = (conn, frame, opts) => conn.ws.send(typeof frame === 'string' || Buffer.isBuffer(frame) ? frame : JSON.stringify(frame), opts || {});
      r.close = () => new Promise((res) => {
        for (const c of wss.clients) { try { c.terminate(); } catch (_) { /* gone */ } }
        wss.close(() => res());
      });
      resolve(r);
    });
  });
}

/** A port on 127.0.0.1 with nothing listening: every connection is refused. */
function deadPortUrl() {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve({ url: `ws://127.0.0.1:${port}`, port })); });
  });
}

/** A TCP server that accepts and never answers: a websocket handshake to it never completes. → { url, port, close } */
function silentServer() {
  return new Promise((resolve) => {
    const sockets = new Set();
    const s = net.createServer((sock) => { sockets.add(sock); sock.on('error', () => {}); sock.on('close', () => sockets.delete(sock)); });
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      resolve({
        url: `ws://127.0.0.1:${port}`,
        port,
        close: () => new Promise((res) => { for (const k of sockets) k.destroy(); s.close(() => res()); }),
      });
    });
  });
}

/** An HTTP server that answers every request, the websocket upgrade included, with 503: the upgrade is refused. */
function refusingServer() {
  return new Promise((resolve) => {
    const s = http.createServer((req, res) => { res.writeHead(503); res.end('unavailable'); });
    s.on('upgrade', (req, sock) => { sock.on('error', () => {}); sock.end('HTTP/1.1 503 Service Unavailable\r\nContent-Length: 0\r\nConnection: close\r\n\r\n'); });
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      resolve({ url: `ws://127.0.0.1:${port}`, port, close: () => new Promise((res) => { s.close(() => res()); if (typeof s.closeAllConnections === 'function') s.closeAllConnections(); }) });
    });
  });
}

// ─── the client under test ─────────────────────────────────────────────────────────────────────────────────────
/**
 * The callbacks a subscription reports to, recording each call in order: { type: 'event', ev }, { type: 'eose' },
 * { type: 'close', info }. `insideCalls` counts calls made while subscribe() itself was running (T29: never).
 */
function recorder() {
  const rec = { calls: [], inside: false, insideCalls: 0 };
  const note = (entry) => { if (rec.inside) rec.insideCalls += 1; rec.calls.push(entry); };
  rec.cbs = {
    onEvent: (ev) => note({ type: 'event', ev }),
    onEose: () => note({ type: 'eose' }),
    onClose: (info) => note({ type: 'close', info }),
  };
  rec.of = (type) => rec.calls.filter((c) => c.type === type);
  rec.types = () => rec.calls.map((c) => (c.type === 'event' ? `event:${String(c.ev && c.ev.id).slice(0, 8)}` : c.type));
  return rec;
}
/** subscribe(opts) with a recorder's callbacks, noting that subscribe() is running while it runs. → the handle */
function open(sub, rec, opts) {
  rec.inside = true;
  try { return sub.subscribe({ filters: FILTERS, ...opts, ...rec.cbs }); } finally { rec.inside = false; }
}
/** Close a handle, ignoring a throw (cleanup only). */
function quietly(h) { try { if (h && typeof h.close === 'function') h.close(); } catch (_) { /* cleanup */ } }

/** The one close the recorder saw, checked: a number code, a fixed reason, nothing of the relay's address. */
function oneClose(rec, reason, what, port) {
  const closes = rec.of('close');
  eq(closes.length, 1, `${what}: onClose calls (T29: "onClose({ code, reason })", once)`);
  const info = closes[0].info || {};
  assert(typeof info.code === 'number', `${what}: onClose's code is the socket's close code, a number; got ${show(info.code)}`);
  assert(REASONS.includes(info.reason), `${what}: onClose's reason is one of the fixed texts ${show(REASONS)}; got ${show(info.reason)}`);
  eq(info.reason, reason, `${what}: onClose's reason`);
  if (port !== undefined) {
    assert(!String(info.reason).includes('127.0.0.1') && !String(info.reason).includes(String(port)),
      `${what}: AC-6 — the reason names nothing of where the relay is reached; got ${show(info.reason)}`);
  }
  eq(rec.insideCalls, 0, `${what}: callbacks called from inside subscribe() (T29: never)`);
}

/** A stamped tagging as the relay delivers it (fake pubkeys). */
function tagging(i) { return F.makeTagging({ d: `rsub-${i}`, id: F.idOf(`rsub:${i}`), createdAt: 1700000000 + i }); }

// ─── RSUB1: the REQ ─────────────────────────────────────────────────────────────────────────────────────────────

test('RSUB1: on open the client sends exactly one message, the REQ ["REQ", "tagging-edges-realtime", …filters]: the caller\'s filters in their order, each a copy with limit 0 — a caller\'s own limit overridden, every other key kept — and the caller\'s filter objects left unchanged (ADR 0003 § What it hears: "One REQ (subscription id tagging-edges-realtime) carries two filters, both with limit:0 and no since"; T4; Implementation notes → subscription.js "REQ with limit:0")', async () => {
  const sub = load();
  const r = await relay();
  const rec = recorder();
  const filters = [{ kinds: [39999], '#z': FILTERS[0]['#z'].slice(), limit: 500 }, { kinds: [5] }];
  const before = JSON.parse(JSON.stringify(filters));
  let h = null;
  try {
    h = open(sub, rec, { url: r.url, filters });
    await until(() => r.messages.length >= 1, SOON_MS, 'the REQ reaches the relay');
    await pause(100);
    eq(r.conns.length, 1, 'connections the client opened');
    eq(r.messages.length, 1, `messages the client sent on open (${show(r.messages.map((m) => m.text.slice(0, 80)))})`);
    const m = r.messages[0];
    eq(m.binary, false, 'the REQ is a text frame');
    same(m.msg, ['REQ', SUB_ID, { kinds: [39999], '#z': FILTERS[0]['#z'], limit: 0 }, { kinds: [5], limit: 0 }],
      'the REQ: the ADR\'s subscription id, then each of the caller\'s filters in order with limit 0 (live only)');
    same(filters, before, 'the caller\'s filters after subscribe() (each REQ filter is a copy)');
    eq(rec.calls.length, 0, `callbacks before the relay said anything (${show(rec.types())})`);
  } finally {
    quietly(h);
    await r.close();
  }
});

// ─── RSUB2: EOSE, then EVENTs in order ──────────────────────────────────────────────────────────────────────────

test('RSUB2: the relay\'s EOSE is reported once through onEose, then each EVENT for the subscription through onEvent — the event object as the relay sent it, in the order sent; a second EOSE is not reported again, and the connection stays open (ADR 0003 § What it hears: strfry answers a limit:0 REQ "with EOSE at once and then delivers, live only, every later-stored match"; T20; T29 "onEvent(event), onEose()")', async () => {
  const sub = load();
  const evs = [tagging(1), tagging(2), tagging(3)];
  const r = await relay({
    onReq: (conn, msg) => {
      r.send(conn, ['EOSE', msg[1]]);
      for (const ev of evs) r.send(conn, ['EVENT', msg[1], ev]);
      r.send(conn, ['EOSE', msg[1]]);
    },
  });
  const rec = recorder();
  let h = null;
  try {
    h = open(sub, rec, { url: r.url });
    await until(() => rec.of('event').length >= 3, SOON_MS, 'the three events are delivered');
    await pause(100);
    same(rec.types(), ['eose', ...evs.map((ev) => `event:${ev.id.slice(0, 8)}`)], 'the callbacks, in order: EOSE once, then the three events as sent');
    rec.of('event').forEach((c, i) => same(c.ev, evs[i], `event ${i + 1} as the relay sent it`));
    eq(rec.of('close').length, 0, 'onClose calls while the relay keeps the connection');
    eq(r.conns[0].closed, null, 'the relay\'s side of the connection is still open');
    eq(rec.insideCalls, 0, 'callbacks called from inside subscribe() (T29: never)');
  } finally {
    quietly(h);
    await r.close();
  }
});

// ─── RSUB3: other subscriptions, and frames that are no message, are ignored ─────────────────────────────────────

test('RSUB3: messages for another subscription id — EVENT, EOSE and CLOSED — and frames that are no message for this one (text that is not JSON, JSON that is not an array, an EVENT whose body is not an object, an OK, a binary frame carrying an EVENT) are ignored: no callback, the connection stays open, and the subscription\'s own EVENT that follows is delivered (ADR 0003 § What it hears; binding 3: a delivery is a trigger, and only this subscription\'s are)', async () => {
  const sub = load();
  const other = tagging(10);
  const mine = tagging(11);
  const r = await relay({
    onReq: (conn, msg) => {
      r.send(conn, ['EOSE', msg[1]]);
      r.send(conn, ['EVENT', 'another-subscription', other]);
      r.send(conn, ['EOSE', 'another-subscription']);
      r.send(conn, ['CLOSED', 'another-subscription', 'error: closed']);
      r.send(conn, 'not json at all');
      r.send(conn, { EVENT: msg[1], event: other });
      r.send(conn, ['EVENT', msg[1], 'not an object']);
      r.send(conn, ['EVENT', msg[1], [other]]);
      r.send(conn, ['OK', other.id, true, '']);
      r.send(conn, Buffer.from(JSON.stringify(['EVENT', msg[1], other])), { binary: true });
      r.send(conn, ['EVENT', msg[1], mine]);
    },
  });
  const rec = recorder();
  let h = null;
  try {
    h = open(sub, rec, { url: r.url });
    await until(() => rec.of('event').length >= 1, SOON_MS, 'the subscription\'s own event is delivered');
    await pause(100);
    same(rec.types(), ['eose', `event:${mine.id.slice(0, 8)}`], 'the callbacks: this subscription\'s EOSE and its one EVENT, nothing else');
    same(rec.of('event')[0].ev, mine, 'the event delivered is the subscription\'s own');
    eq(r.conns[0].closed, null, 'the relay\'s side of the connection is still open (nothing ignored ends it)');
  } finally {
    quietly(h);
    await r.close();
  }
});

// ─── RSUB4: NOTICE and CLOSED ───────────────────────────────────────────────────────────────────────────────────

test('RSUB4: a NOTICE, or a CLOSED for the subscription, ends the connection — the relay\'s side closes, onClose is called once with the fixed reason \'filter refused (NOTICE)\' or \'filter refused (CLOSED)\' (never the relay\'s own text, which can name where it is reached), and an EVENT the relay sends after it is never delivered (ADR 0003 § What it hears, "Keeping it alive": "Any close, CLOSED or NOTICE also reconnects"; T29 onClose({ code, reason }); AC-6)', async () => {
  const sub = load();
  await cases([
    { name: 'NOTICE', frame: () => ['NOTICE', 'ERROR: bad req: could not connect to redis:6379 (ws://127.0.0.1:7777)'], reason: 'filter refused (NOTICE)' },
    { name: 'CLOSED for the subscription', frame: (id) => ['CLOSED', id, 'error: filter refused near neo4j.internal:7687'], reason: 'filter refused (CLOSED)' },
  ], async (c) => {
    const late = tagging(20);
    const r = await relay({
      onReq: (conn, msg) => {
        r.send(conn, ['EOSE', msg[1]]);
        r.send(conn, c.frame(msg[1]));
        r.send(conn, ['EVENT', msg[1], late]);
      },
    });
    const rec = recorder();
    let h = null;
    try {
      h = open(sub, rec, { url: r.url });
      await until(() => rec.of('close').length >= 1, SOON_MS, `the ${c.name} ends the connection`);
      await until(() => r.conns[0] && r.conns[0].closed !== null, SOON_MS, 'the relay\'s side of the connection closes');
      await pause(100);
      oneClose(rec, c.reason, c.name, r.port);
      const text = String(rec.of('close')[0].info.reason);
      assert(!/redis|neo4j|6379|7687|7777|error/i.test(text), `AC-6: the reason carries none of the relay's text; got ${show(text)}`);
      eq(rec.of('event').length, 0, `events delivered after the ${c.name} (it ends the subscription)`);
    } finally {
      quietly(h);
      await r.close();
    }
  });
});

// ─── RSUB5: pings and pongs ─────────────────────────────────────────────────────────────────────────────────────

test('RSUB5: the client pings on its interval — a relay that answers each ping with a pong keeps the connection open (several pings, no onClose), and a relay that never answers has it ended once pongTimeoutMs passes without a pong: its side closes and onClose reports \'no pong\' (ADR 0003 § What it hears, "Keeping it alive": "The client pings every 30 s; no pong within 10 s means reconnect"; the seams pingIntervalMs and pongTimeoutMs stand in for 30 s and 10 s)', async () => {
  const sub = load();
  // (a) pongs answered: the pong time-out is long, so a slow host cannot mistake this for (b).
  {
    const r = await relay({ onReq: (conn, msg) => r.send(conn, ['EOSE', msg[1]]) });
    const rec = recorder();
    let h = null;
    try {
      h = open(sub, rec, { url: r.url, pingIntervalMs: 40, pongTimeoutMs: 1500 });
      await until(() => r.conns[0] && r.conns[0].pings >= 3, SOON_MS, '(a) the relay receives pings on the interval');
      await pause(150);
      eq(rec.of('close').length, 0, '(a) onClose calls while each ping is answered with a pong');
      eq(r.conns[0].closed, null, '(a) the relay\'s side of the connection is still open');
    } finally {
      quietly(h);
      await r.close();
    }
  }
  // (b) pongs never come.
  {
    const r = await relay({ autoPong: false, onReq: (conn, msg) => r.send(conn, ['EOSE', msg[1]]) });
    const rec = recorder();
    let h = null;
    try {
      const t0 = Date.now();
      h = open(sub, rec, { url: r.url, pingIntervalMs: 40, pongTimeoutMs: 120 });
      await until(() => rec.of('close').length >= 1, SOON_MS, '(b) with no pong, the connection ends');
      const took = Date.now() - t0;
      await until(() => r.conns[0] && r.conns[0].closed !== null, SOON_MS, '(b) the relay\'s side of the connection closes');
      assert(r.conns[0].pings >= 1, `(b) fixture: the relay received a ping (${r.conns[0].pings})`);
      assert(took >= 120, `(b) the connection is ended only after pongTimeoutMs (120 ms) without a pong; it ended after ${took} ms`);
      oneClose(rec, 'no pong', '(b) no pong', r.port);
      same(rec.types(), ['eose', 'close'], '(b) the callbacks');
    } finally {
      quietly(h);
      await r.close();
    }
  }
});

// ─── RSUB6: refused and dropped connections ─────────────────────────────────────────────────────────────────────

test('RSUB6: a connection that never opens — nothing listening at the port, a relay that refuses the websocket upgrade (HTTP 503), or a handshake that never completes within handshakeTimeoutMs — is reported once through onClose with the fixed reason \'connection refused\'; one that opened and then ends from the relay\'s side — terminated, or closed with 1001 — with \'connection dropped\'; neither reason names the relay\'s address, and no callback comes from inside subscribe() (ADR 0003 § What it hears, "Keeping it alive": "Any close … reconnects, with backoff 1→15 s", the engine\'s; T29; AC-3; AC-6)', async () => {
  const sub = load();
  await cases([
    { name: 'nothing listening', make: async () => { const d = await deadPortUrl(); return { url: d.url, port: d.port, close: async () => {} }; }, reason: 'connection refused' },
    { name: 'the upgrade refused (HTTP 503)', make: refusingServer, reason: 'connection refused' },
    { name: 'a handshake that never completes', make: silentServer, reason: 'connection refused', handshakeTimeoutMs: 150 },
  ], async (c) => {
    const s = await c.make();
    const rec = recorder();
    let h = null;
    try {
      h = open(sub, rec, { url: s.url, handshakeTimeoutMs: c.handshakeTimeoutMs });
      await until(() => rec.of('close').length >= 1, SOON_MS, `${c.name}: onClose is called`);
      await pause(100);
      oneClose(rec, c.reason, c.name, s.port);
      same(rec.types(), ['close'], `${c.name}: the callbacks (no EOSE, no event)`);
    } finally {
      quietly(h);
      await s.close();
    }
  });
  await cases([
    { name: 'the relay terminates the socket after EOSE', end: (conn) => conn.ws.terminate() },
    { name: 'the relay closes the socket (1001) after EOSE', end: (conn) => conn.ws.close(1001, 'going away') },
  ], async (c) => {
    const r = await relay({ onReq: (conn, msg) => { r.send(conn, ['EOSE', msg[1]]); setTimeout(() => c.end(conn), 30); } });
    const rec = recorder();
    let h = null;
    try {
      h = open(sub, rec, { url: r.url });
      await until(() => rec.of('close').length >= 1, SOON_MS, `${c.name}: onClose is called`);
      await pause(100);
      oneClose(rec, 'connection dropped', c.name, r.port);
      same(rec.types(), ['eose', 'close'], `${c.name}: the callbacks`);
    } finally {
      quietly(h);
      await r.close();
    }
  });
});

// ─── RSUB7: close() ─────────────────────────────────────────────────────────────────────────────────────────────

test('RSUB7: close() is the caller\'s end — on an open subscription it sends ["CLOSE", "tagging-edges-realtime"], then closes the socket (the relay sees a normal close, 1000), fires no onClose, and delivers nothing the relay sends after it; called before the socket opens, no REQ ever reaches the relay and no callback comes; a second close() is harmless (T20 "→ { close() }"; T29 "A client-side close() fires no onClose"; NIP-01 CLOSE)', async () => {
  const sub = load();
  // (a) Open, after EOSE.
  {
    const after = tagging(30);
    const r = await relay({
      onReq: (conn, msg) => r.send(conn, ['EOSE', msg[1]]),
      onMessage: (conn, m) => { if (Array.isArray(m.msg) && m.msg[0] === 'CLOSE') { try { r.send(conn, ['EVENT', SUB_ID, after]); } catch (_) { /* closing */ } } },
    });
    const rec = recorder();
    let h = null;
    try {
      h = open(sub, rec, { url: r.url });
      await until(() => rec.of('eose').length >= 1, SOON_MS, '(a) fixture: the subscription is open (EOSE)');
      h.close();
      await until(() => r.conns[0].closed !== null, SOON_MS, '(a) the relay sees the socket close');
      await pause(150);
      const sent = r.conns[0].received.map((m) => m.msg);
      same(sent.map((m) => (Array.isArray(m) ? m[0] : m)), ['REQ', 'CLOSE'], '(a) what the client sent: the REQ, then CLOSE');
      same(sent[1], ['CLOSE', SUB_ID], '(a) the CLOSE names the subscription id');
      eq(r.conns[0].closed.code, 1000, '(a) the relay sees a normal close (1000)');
      same(rec.types(), ['eose'], '(a) the callbacks: no onClose for the caller\'s own close (T29), and nothing delivered after it');
      h.close();
      await pause(50);
      same(rec.types(), ['eose'], '(a) the callbacks after a second close()');
    } finally {
      quietly(h);
      await r.close();
    }
  }
  // (b) Before the socket opens.
  {
    const r = await relay({ onReq: (conn, msg) => r.send(conn, ['EOSE', msg[1]]) });
    const rec = recorder();
    let h = null;
    try {
      h = open(sub, rec, { url: r.url });
      h.close();
      await pause(300);
      eq(r.messages.length, 0, `(b) messages the relay received after a close() before the socket opened (${show(r.messages.map((m) => m.text.slice(0, 60)))})`);
      same(rec.types(), [], '(b) the callbacks (T29: a client-side close() fires no onClose)');
    } finally {
      quietly(h);
      await r.close();
    }
  }
});

// ─── RSUB8: T29, never from inside subscribe() ──────────────────────────────────────────────────────────────────

test('RSUB8: a URL the client refuses at once (it is not a URL) is reported like a refused connection, later — onClose({ reason: \'connection refused\' }) from a later event-loop turn, never from inside subscribe(), which returns a handle whose close() is harmless (T29: "subscribe\'s callbacks are called asynchronously, never inside subscribe()"; T20)', async () => {
  const sub = load();
  const rec = recorder();
  let h = null;
  let threw = null;
  try {
    try { h = open(sub, rec, { url: 'not a url' }); } catch (e) { threw = e; }
    assert(threw === null, `subscribe() with a URL the client refuses returns a handle, and reports through onClose; it threw ${threw && firstLine(threw)}`);
    assert(h && typeof h.close === 'function', `subscribe() returns { close() }; got ${show(h)}`);
    eq(rec.calls.length, 0, 'callbacks called before subscribe() returned (T29: never inside it)');
    await until(() => rec.of('close').length >= 1, SOON_MS, 'onClose is called from a later turn');
    await pause(50);
    oneClose(rec, 'connection refused', 'a URL the client refuses');
  } finally {
    quietly(h);
  }
});

// ─── run ───────────────────────────────────────────────────────────────────────────────────────────────────────
async function run() {
  console.log('\n--- tagging-edges real-time subscription tests (epic tagging-edges, Story 3 — the websocket client, in-process relay) ---');
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  PASS  ${name}`); pass++; }
    catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failures.push({ name, message: err.message }); fail++; }
  }
  console.log(`\ntagging-edges-realtime-subscription: ${pass} passed, ${fail} failed, 0 skipped`);
  return { pass, fail, skipped: 0, failures };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
