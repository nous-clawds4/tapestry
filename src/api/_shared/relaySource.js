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

module.exports = {
  resolveGeneralPurposeRelays,
  realQuerySync,
  realScanStrfry,
  realRunCypher,
  FALLBACK_RELAYS,
  RELAY_SET_SLUG,
  FETCH_TIMEOUT_MS,
  NOSTR_TOOLS_PATH,
  WS_PATH,
};
