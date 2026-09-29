/**
 * The real-time path's live subscription to the relay (tagging-edges story 3, ADR tagging-edges/0003 D1-A,
 * § What it hears; clarifications T4, T20, T29).
 *
 * One call is one websocket, by default to the in-container relay `ws://127.0.0.1:7777` (never `/relay`, so no
 * nginx idle drop and no NIP-50 proxy; the engine passes TAGGING_EDGES_REALTIME_RELAY_URL when it is set). On open it
 * sends one REQ, subscription id `tagging-edges-realtime`, carrying the caller's filters (T4's two) each with
 * `limit: 0`. strfry answers such a REQ with EOSE at once and then delivers, live only, every later-stored match from
 * every writer, back-dated ones included, since no filter has `since`.
 *
 *   subscribe({ url, filters, onEvent, onEose, onClose }) → { close() }       (the engine's deps.subscribe, T20)
 *
 *   onEvent(event)             each ["EVENT", "tagging-edges-realtime", event], in the order the relay sent them
 *   onEose()                   the relay's EOSE, once
 *   onClose({ code, reason })  the connection ended, once: the socket's close code and a fixed reason, one of
 *                              'connection refused' (it never opened), 'connection dropped', 'filter refused (CLOSED)',
 *                              'filter refused (NOTICE)' or 'no pong'. Never the relay's own text or an error
 *                              message, either of which can name where the relay is reached (AC-6).
 *   close()                    the caller's end: CLOSE, then the socket closes. It fires no onClose (T29).
 *
 * Every callback comes from a later event-loop turn, never from inside subscribe() (T29). A delivery is a trigger,
 * never state (ADR binding 3), and the module keeps nothing beyond its one connection. It pings every 30 s and ends
 * the connection when a pong does not come within 10 s; a CLOSED or a NOTICE means the relay refused the filter, and
 * ends it too. It never reconnects by itself: the engine owns time (T20, T29), so after onClose it subscribes again,
 * waiting 1→15 s before its n-th consecutive reconnect, and follows every connect's EOSE with a catch-up (ADR § What
 * it hears, "Keeping it alive"): what was stored between two connections reached no subscription. reconnectDelayMs(n)
 * is that schedule; the engine keeps its own copy of it, since it loads this module (and `ws`) only lazily.
 */

const WebSocket = require('ws');

const DEFAULT_RELAY_URL = 'ws://127.0.0.1:7777';
const SUBSCRIPTION_ID = 'tagging-edges-realtime';
const PING_INTERVAL_MS = 30000;
const PONG_TIMEOUT_MS = 10000;
const HANDSHAKE_TIMEOUT_MS = 10000;
/** How long close() waits for the relay's closing handshake before it drops the socket. */
const CLOSE_GRACE_MS = 2000;
const RECONNECT_MIN_MS = 1000;
const RECONNECT_MAX_MS = 15000;

/** The wait before the caller's `attempt`-th consecutive reconnect (from 0): 1 s, doubling, at most 15 s. */
function reconnectDelayMs(attempt) {
  const n = Number.isInteger(attempt) && attempt > 0 ? Math.min(attempt, 4) : 0;
  return Math.min(RECONNECT_MAX_MS, RECONNECT_MIN_MS * 2 ** n);
}

/** The REQ's text: the caller's filters (an array, or one filter), each copied with `limit: 0` (live only). */
function reqText(filters) {
  const list = Array.isArray(filters) ? filters : [filters];
  if (list.length === 0 || !list.every((f) => !!f && typeof f === 'object' && !Array.isArray(f))) {
    throw new TypeError('subscribe: filters must be one or more filter objects');
  }
  return JSON.stringify(['REQ', SUBSCRIPTION_ID, ...list.map((f) => Object.assign({}, f, { limit: 0 }))]);
}

const unref = (timer) => { if (timer && typeof timer.unref === 'function') timer.unref(); return timer; };

/**
 * Open one live subscription. A caller's mistake (no filter object) throws here; everything the relay or the network
 * does arrives through the callbacks. The ping options are for tests.
 * @param {{ url?: string, filters: object|object[], onEvent?: Function, onEose?: Function, onClose?: Function,
 *           pingIntervalMs?: number, pongTimeoutMs?: number, handshakeTimeoutMs?: number }} opts
 * @returns {{ close: () => void }}
 */
function subscribe({
  url, filters, onEvent, onEose, onClose,
  pingIntervalMs = PING_INTERVAL_MS, pongTimeoutMs = PONG_TIMEOUT_MS, handshakeTimeoutMs = HANDSHAKE_TIMEOUT_MS,
} = {}) {
  const req = reqText(filters);
  const target = typeof url === 'string' && url !== '' ? url : DEFAULT_RELAY_URL;
  let ws = null;
  let opened = false;
  let eosed = false;
  let endedBy = null; // the fixed reason, once this side has ended the connection
  let closedByClient = false;
  let notified = false;
  let pingTimer = null;
  let pongTimer = null;
  let graceTimer = null;

  const stopTimers = () => {
    clearInterval(pingTimer);
    clearTimeout(pongTimer);
    pingTimer = null;
    pongTimer = null;
  };
  const notifyClose = (code) => {
    stopTimers();
    clearTimeout(graceTimer);
    if (notified || closedByClient) return;
    notified = true;
    const reason = endedBy || (opened ? 'connection dropped' : 'connection refused');
    if (typeof onClose === 'function') onClose({ code, reason });
  };
  /** End the connection from this side, at once, like a drop: the caller reconnects without awaiting a handshake. */
  const end = (reason) => {
    if (endedBy || closedByClient) return;
    endedBy = reason;
    stopTimers();
    ws.terminate();
  };
  const ping = () => {
    if (pongTimer || endedBy) return; // one ping outstanding at a time
    pongTimer = unref(setTimeout(() => end('no pong'), pongTimeoutMs));
    try { ws.ping(); } catch (_) { /* the socket is closing: 'close' follows */ }
  };
  const take = (text) => {
    if (endedBy || closedByClient) return;
    let msg;
    try { msg = JSON.parse(text); } catch (_) { return; }
    if (!Array.isArray(msg)) return;
    const [type, subId, body] = msg;
    if (type === 'NOTICE') { end('filter refused (NOTICE)'); return; }
    if (subId !== SUBSCRIPTION_ID) return;
    if (type === 'EVENT') {
      if (body && typeof body === 'object' && !Array.isArray(body) && typeof onEvent === 'function') onEvent(body);
    } else if (type === 'EOSE') {
      if (!eosed) {
        eosed = true;
        if (typeof onEose === 'function') onEose();
      }
    } else if (type === 'CLOSED') {
      end('filter refused (CLOSED)');
    }
  };

  try {
    // No compression: the relay is on the loopback, and inflating costs a zlib context per connection.
    ws = new WebSocket(target, { handshakeTimeout: handshakeTimeoutMs, perMessageDeflate: false });
  } catch (_) {
    // A URL the client refuses (it throws here, before any I/O): reported like a refused connection, later (T29).
    setImmediate(() => notifyClose(1006));
    return { close() { closedByClient = true; } };
  }
  ws.on('open', () => {
    if (closedByClient) return;
    opened = true;
    ws.send(req);
    pingTimer = unref(setInterval(ping, pingIntervalMs));
  });
  ws.on('message', (data, isBinary) => { if (!isBinary) take(data.toString('utf8')); });
  ws.on('pong', () => {
    clearTimeout(pongTimer);
    pongTimer = null;
  });
  // An error is always followed by 'close'. Its message can name the relay's host and port, so it goes nowhere.
  ws.on('error', () => {});
  ws.on('close', (code) => notifyClose(code));

  return {
    close() {
      if (closedByClient) return;
      closedByClient = true;
      stopTimers();
      if (ws.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify(['CLOSE', SUBSCRIPTION_ID])); } catch (_) { /* closing anyway */ }
        ws.close(1000);
        graceTimer = unref(setTimeout(() => ws.terminate(), CLOSE_GRACE_MS));
      } else if (ws.readyState === WebSocket.CONNECTING) {
        ws.terminate();
      }
    },
  };
}

module.exports = { subscribe, reconnectDelayMs, DEFAULT_RELAY_URL, SUBSCRIPTION_ID };
