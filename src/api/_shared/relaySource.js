/**
 * Shared relay-sourcing primitives — extracted (ADR event-page/0001, Option A) so the
 * THIRD consumer of this logic (the event read path) doesn't add a third inline copy.
 *
 * These are adapted from src/api/feed/feedReadPath.js (the original home) — same logic; the
 * FALLBACK_RELAYS array lists the same relays in a different order (order is irrelevant — the
 * union dedups). The feed and per-user-notes read paths still carry their own private copies;
 * re-pointing them here and deleting those copies is a tracked, behavior-preserving
 * follow-up (engineering-team/follow-ups.md) — deliberately deferred to keep the
 * event-page epic additive (it touches no shipped read path).
 *
 * Exports: resolveGeneralPurposeRelays, realQuerySync, realScanStrfry, realRunCypher,
 * FALLBACK_RELAYS, RELAY_SET_SLUG, FETCH_TIMEOUT_MS, NOSTR_TOOLS_PATH, WS_PATH.
 */

// nostr-tools / ws via the container's absolute path (the fetchEvents.js / feedReadPath.js
// convention); required lazily inside realQuerySync so this module loads in test/CI.
const NOSTR_TOOLS_PATH = '/usr/local/lib/node_modules/brainstorm/node_modules/nostr-tools';
const WS_PATH = '/usr/local/lib/node_modules/brainstorm/node_modules/ws';

const FETCH_TIMEOUT_MS = 8000;
const FALLBACK_RELAYS = ['wss://relay.primal.net', 'wss://nos.lol', 'wss://relay.damus.io'];
const RELAY_SET_SLUG = 'the-set-of-general-purpose-relays';

/** Local strfry scan (kind-0 / kind-3 / etc.), parsing JSONL. */
function realScanStrfry(filter) {
  const { execSync } = require('child_process');
  const filterStr = typeof filter === 'string' ? filter : JSON.stringify(filter);
  const raw = execSync(`strfry scan '${filterStr.replace(/'/g, "\\'")}'`, {
    timeout: 5000, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'],
  });
  const events = [];
  for (const line of raw.trim().split('\n')) {
    if (!line) continue;
    try { events.push(JSON.parse(line)); } catch { /* skip non-event log lines */ }
  }
  return events;
}

/** Relay-set resolution via Neo4j. */
function realRunCypher(cypher, params) {
  return require('../../lib/neo4j-driver').runCypher(cypher, params);
}

/** External event fetch via SimplePool, with a hard timeout. */
async function realQuerySync(relays, filter) {
  if (typeof globalThis.WebSocket === 'undefined') {
    globalThis.WebSocket = require(WS_PATH);
  }
  const { SimplePool } = require(NOSTR_TOOLS_PATH);
  const pool = new SimplePool();
  try {
    return await Promise.race([
      pool.querySync(relays, filter),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), FETCH_TIMEOUT_MS)),
    ]);
  } finally {
    try { pool.close(relays); } catch { /* ignore */ }
  }
}

/**
 * Resolve the general-purpose relay set by slug-from-TA. Empty / error ⇒ the fixed fallback
 * relays. → { relays: string[], source: 'set' | 'fallback' }.
 */
async function resolveGeneralPurposeRelays(runCypher) {
  try {
    const ta = require('../../utils/assistantKeys').getOwnerAssistantPubkey();
    const handle = `39999:${ta}:${RELAY_SET_SLUG}`;
    const rows = await runCypher(
      'MATCH (s:Set {uuid:$h})-[:HAS_ELEMENT]->(m:ListItem) WHERE NOT m:Superset ' +
      'MATCH (m)-[:HAS_TAG]->(jt:NostrEventTag {type:\'json\'}) RETURN jt.value AS json',
      { h: handle }
    );
    const relays = [];
    for (const row of rows || []) {
      try {
        const url = JSON.parse(row.json)?.nostrRelay?.websocketUrl;
        if (typeof url === 'string' && (url.startsWith('wss://') || url.startsWith('ws://'))) {
          relays.push(url);
        }
      } catch { /* skip unparseable member */ }
    }
    if (relays.length > 0) return { relays, source: 'set' };
  } catch { /* fall through to fallback */ }
  return { relays: FALLBACK_RELAYS.slice(), source: 'fallback' };
}

/* ── Single-relay presence probe (ADR treasure-map-relay-presence/0001) ────────────────── */

const CONNECT_TIMEOUT_MS = 5000;
const QUERY_TIMEOUT_MS = 5000;

/**
 * nostr-tools throws a BARE STRING on connect failure, not an Error — e.g.
 * "Received network error or non-101 status code." Reading `.message` on it yields undefined,
 * which is how a connect failure silently becomes the text "undefined" in the UI.
 */
function normalizeThrown(err) {
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message || String(err);
  if (err == null) return 'unknown error';
  try { return JSON.stringify(err); } catch { return String(err); }
}

function withTimeout(promise, ms, message) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); }),
  ]).finally(() => clearTimeout(timer));
}

/** Real connector — nostr-tools required lazily so importers stay loadable without deps. */
function defaultConnect(url) {
  if (typeof globalThis.WebSocket === 'undefined') globalThis.WebSocket = require(WS_PATH);
  const { Relay } = require(NOSTR_TOOLS_PATH);
  return Relay.connect(url);
}

function defaultVerify(event) {
  const { verifyEvent } = require(NOSTR_TOOLS_PATH);
  return verifyEvent(event);
}

/**
 * Probe ONE relay for the newest event matching `filter`.
 *
 * This is the only sourcing primitive here that can tell "this relay does not have it" from
 * "we could not reach this relay". `realQuerySync` above cannot: SimplePool.querySync swallows
 * per-relay connection failure and resolves with whatever it got, so DNS failure, TCP refusal,
 * a non-relay host and a blackholed IP all come back indistinguishable from a real absence
 * (measured 2026-09-07 — ADR § M1). `Relay.connect()` throws on all four, which is the entire
 * reason this variant exists.
 *
 * There are now THREE querySync-shaped helpers in the codebase (verifying SimplePool here,
 * the event path's no-verify SimplePool, and this connect-observing probe). Do NOT unify them —
 * follow-ups.md:139 applies with equal force: each exists for a distinct outcome.
 *
 * @param {string} relayUrl
 * @param {Object} filter  nostr filter; `kinds` and `authors` are re-checked against what
 *                         the relay actually returns (a relay may answer with anything).
 * @param {Object} [opts]  { connect, verify, connectTimeoutMs, queryTimeoutMs } — injectable
 *                         for tests, in this module's DI-by-parameter idiom.
 * @returns {Promise<{status:'present'|'absent'|'unreachable', event:Object|null, error:string|null}>}
 */
async function probeRelayForEvent(relayUrl, filter, opts = {}) {
  const connect = opts.connect || defaultConnect;
  const verify = opts.verify || defaultVerify;
  const connectTimeoutMs = opts.connectTimeoutMs || CONNECT_TIMEOUT_MS;
  const queryTimeoutMs = opts.queryTimeoutMs || QUERY_TIMEOUT_MS;

  // Connect failure is flaky in the wild — a healthy relay threw once and connected cleanly
  // seconds later (ADR § M3). One retry, BOUNDED: never a loop.
  let relay = null;
  let lastErr = null;
  for (let attempt = 0; attempt < 2 && relay === null; attempt++) {
    try {
      relay = await withTimeout(connect(relayUrl), connectTimeoutMs, 'connection timed out');
    } catch (err) {
      lastErr = err;
    }
  }
  if (relay === null) {
    return { status: 'unreachable', event: null, error: normalizeThrown(lastErr) };
  }

  let sub = null;
  try {
    const events = await withTimeout(new Promise((resolve, reject) => {
      const collected = [];
      let settled = false;
      const finish = (fn, arg) => { if (!settled) { settled = true; fn(arg); } };
      sub = relay.subscribe([filter], {
        onevent(e) { collected.push(e); },
        oneose() { finish(resolve, collected); },
        onclose(reason) { finish(reject, new Error(`subscription closed: ${normalizeThrown(reason)}`)); },
      });
    }), queryTimeoutMs, 'query timed out');

    // A relay may answer with anything at all. Only events that match what we asked for AND
    // carry a valid signature count — otherwise any relay could serve a forged replacement and
    // make the caller believe the author's event had changed.
    const wantKinds = Array.isArray(filter && filter.kinds) ? filter.kinds : null;
    const wantAuthors = Array.isArray(filter && filter.authors)
      ? filter.authors.map(a => String(a).toLowerCase())
      : null;

    const valid = [];
    for (const e of events) {
      if (!e || typeof e.id !== 'string') continue;
      if (wantKinds && !wantKinds.includes(e.kind)) continue;
      if (wantAuthors && !wantAuthors.includes(String(e.pubkey || '').toLowerCase())) continue;
      let ok = false;
      try { ok = !!verify(e); } catch { ok = false; }
      if (ok) valid.push(e);
    }

    if (valid.length === 0) return { status: 'absent', event: null, error: null };

    // Replaceable kinds: report the newest the relay is willing to serve.
    const newest = valid.reduce((a, b) => ((b.created_at || 0) > (a.created_at || 0) ? b : a));
    return { status: 'present', event: newest, error: null };
  } catch (err) {
    // Connected, but no usable answer (early close, or no EOSE inside the budget). Reporting
    // "absent" here would assert something we did not learn.
    return { status: 'unreachable', event: null, error: normalizeThrown(err) };
  } finally {
    try { if (sub) sub.close(); } catch { /* ignore */ }
    try { relay.close(); } catch { /* ignore */ }
  }
}

module.exports = {
  resolveGeneralPurposeRelays,
  realQuerySync,
  realScanStrfry,
  realRunCypher,
  probeRelayForEvent,
  FALLBACK_RELAYS,
  RELAY_SET_SLUG,
  FETCH_TIMEOUT_MS,
  CONNECT_TIMEOUT_MS,
  QUERY_TIMEOUT_MS,
  NOSTR_TOOLS_PATH,
  WS_PATH,
};
