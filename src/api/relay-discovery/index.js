/**
 * Relay Discovery API
 *
 * GET /api/relay-discovery/by-pubkey?pubkey=<hex>[&relays=wss://r1,wss://r2]
 *
 * Fetches, from external relays, the set of nostr relays that a given author has
 * endorsed — either via NIP-65 (kind 10002 relay list) or via DCoSL kind 39999
 * elements z-tagged to the firmware nostr-relay concept. Merges both sources,
 * dedups by websocket URL, and annotates each entry with its source(s).
 */

const NOSTR_TOOLS_PATH = '/usr/local/lib/node_modules/brainstorm/node_modules/nostr-tools';
const WS_PATH = '/usr/local/lib/node_modules/brainstorm/node_modules/ws';

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = require(WS_PATH);
}

const { SimplePool } = require(NOSTR_TOOLS_PATH);

const FETCH_TIMEOUT_MS = 8000;

// Coordinate for the nostr-relay firmware concept (TA pubkey + d-tag).
const NOSTR_RELAY_Z_TAG =
  '39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:nostr-relay';

// Default relays used when the client does not specify. Mirrors
// ui/src/utils/nostrPublish.js PUBLISH_RELAYS so the server query sees the same
// network slice the UI normally uses.
const DEFAULT_RELAYS = [
  'wss://purplepag.es',
  'wss://wot.grapevine.network',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.damus.io',
];

function isHexPubkey(v) {
  return typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
}

function parseRelays(param) {
  if (!param) return DEFAULT_RELAYS;
  const list = param
    .split(',')
    .map((r) => r.trim())
    .filter((r) => r.startsWith('wss://') || r.startsWith('ws://'));
  return list.length > 0 ? list : DEFAULT_RELAYS;
}

function normalizeWsUrl(url) {
  if (typeof url !== 'string') return null;
  return url.trim().replace(/\/+$/, '').toLowerCase();
}

function deriveSlug(wsUrl) {
  return wsUrl
    .replace(/^wss?:\/\//, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function extractFromNip65(event) {
  // kind 10002 carries `r` tags with optional `read`/`write` markers.
  const out = [];
  for (const tag of event.tags || []) {
    if (tag[0] !== 'r' || !tag[1]) continue;
    const url = normalizeWsUrl(tag[1]);
    if (!url || (!url.startsWith('wss://') && !url.startsWith('ws://'))) continue;
    const marker = (tag[2] || '').toLowerCase();
    out.push({
      websocketUrl: url,
      httpUrl: null,
      slug: deriveSlug(url),
      read: marker === '' || marker === 'read',
      write: marker === '' || marker === 'write',
      source: 'nip65',
      eventId: event.id,
    });
  }
  return out;
}

function extractFromDcsl(event) {
  // kind 39999 z-tagged to nostr-relay. Payload in the `json` tag.
  const jsonTag = (event.tags || []).find((t) => t[0] === 'json');
  if (!jsonTag || !jsonTag[1]) return [];
  let parsed;
  try {
    parsed = JSON.parse(jsonTag[1]);
  } catch {
    return [];
  }
  const nr = parsed?.nostrRelay;
  if (!nr || typeof nr.websocketUrl !== 'string') return [];
  const url = normalizeWsUrl(nr.websocketUrl);
  if (!url) return [];
  return [
    {
      websocketUrl: url,
      httpUrl: typeof nr.httpUrl === 'string' ? nr.httpUrl : null,
      slug: typeof nr.slug === 'string' ? nr.slug : deriveSlug(url),
      read: true,
      write: true,
      source: 'dcsl',
      eventId: event.id,
    },
  ];
}

function mergeRelays(entries) {
  // Dedup by websocketUrl; when both sources contribute, source becomes "both"
  // and we keep read/write = OR of the two.
  const byUrl = new Map();
  for (const e of entries) {
    const existing = byUrl.get(e.websocketUrl);
    if (!existing) {
      byUrl.set(e.websocketUrl, { ...e });
      continue;
    }
    existing.read = existing.read || e.read;
    existing.write = existing.write || e.write;
    existing.httpUrl = existing.httpUrl || e.httpUrl;
    if (!existing.slug && e.slug) existing.slug = e.slug;
    if (existing.source !== e.source) existing.source = 'both';
    // Keep the first eventId we saw; include the other as eventIdSecondary.
    if (e.eventId && existing.eventId !== e.eventId && !existing.eventIdSecondary) {
      existing.eventIdSecondary = e.eventId;
    }
  }
  return Array.from(byUrl.values());
}

async function handleByPubkey(req, res) {
  const { pubkey, relays: relaysParam } = req.query;

  if (!pubkey || !isHexPubkey(pubkey)) {
    return res
      .status(400)
      .json({ success: false, error: 'pubkey is required (64-char lowercase hex)' });
  }

  const relays = parseRelays(relaysParam);
  const pool = new SimplePool();

  try {
    const [nip65Events, dcslEvents] = await Promise.all([
      Promise.race([
        pool.querySync(relays, { kinds: [10002], authors: [pubkey], limit: 1 }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), FETCH_TIMEOUT_MS)),
      ]).catch(() => []),
      Promise.race([
        pool.querySync(relays, {
          kinds: [39999],
          authors: [pubkey],
          '#z': [NOSTR_RELAY_Z_TAG],
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), FETCH_TIMEOUT_MS)),
      ]).catch(() => []),
    ]);

    const entries = [];

    // NIP-65: keep only the latest kind 10002 per author.
    if (nip65Events.length > 0) {
      const latest = nip65Events.reduce((a, b) => (a.created_at > b.created_at ? a : b));
      entries.push(...extractFromNip65(latest));
    }

    // DCoSL: each 39999 is an addressable entry on its own.
    for (const e of dcslEvents) {
      entries.push(...extractFromDcsl(e));
    }

    const merged = mergeRelays(entries);

    res.json({
      success: true,
      pubkey,
      relays: merged,
      count: merged.length,
      queriedRelays: relays,
      sourceCounts: {
        nip65: nip65Events.length,
        dcsl: dcslEvents.length,
      },
    });
  } catch (err) {
    res.json({ success: false, error: err.message, pubkey, relays: [], count: 0 });
  } finally {
    try {
      pool.close(relays);
    } catch {}
  }
}

function registerRelayDiscoveryRoutes(app) {
  app.get('/api/relay-discovery/by-pubkey', handleByPubkey);
}

module.exports = { registerRelayDiscoveryRoutes, handleByPubkey };
