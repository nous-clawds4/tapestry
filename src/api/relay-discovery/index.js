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
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { runCypher } = require('../../lib/neo4j-driver');

const FETCH_TIMEOUT_MS = 8000;

// Firmware TA pubkey (publishes all kind 39998 concept headers).
const TA_PUBKEY = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';

// Coordinate for the nostr-relay firmware concept (TA pubkey + d-tag).
const NOSTR_RELAY_Z_TAG = `39998:${TA_PUBKEY}:nostr-relay`;
const TAG_Z_TAG = `39998:${TA_PUBKEY}:tag`;
const NOSTR_RELAY_TAG_Z_TAG = `39998:${TA_PUBKEY}:nostr-relay-tag`;

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

// ── Local strfry scan helper ─────────────────────────────────────────────
// Runs `strfry scan <filter>` and returns parsed events. Mirrors
// src/api/strfry/queries/scan.js but returns a Promise for composition.

function strfryScan(filter) {
  return new Promise((resolve, reject) => {
    const safeFilter = JSON.stringify(filter).replace(/'/g, "'\\''");
    const cmd = `strfry scan '${safeFilter}'`;
    exec(cmd, { maxBuffer: 20 * 1024 * 1024 }, (err, stdout) => {
      if (err) return reject(err);
      const events = [];
      for (const line of stdout.split('\n')) {
        if (!line) continue;
        try {
          events.push(JSON.parse(line));
        } catch {}
      }
      resolve(events);
    });
  });
}

// ── GET /api/relay-discovery/available-tags ──────────────────────────────
// Returns all tag elements published under the `tag` firmware concept.
// Sourced from local strfry (these are firmware elements authored by TA).

async function handleAvailableTags(req, res) {
  try {
    const events = await strfryScan({
      kinds: [39999],
      '#z': [TAG_Z_TAG],
      authors: [TA_PUBKEY],
    });

    const tags = [];
    for (const ev of events) {
      const jsonTag = (ev.tags || []).find((t) => t[0] === 'json');
      if (!jsonTag || !jsonTag[1]) continue;
      let parsed;
      try { parsed = JSON.parse(jsonTag[1]); } catch { continue; }
      const t = parsed?.tag;
      if (!t || !t.slug) continue;
      tags.push({
        eventId: ev.id,
        slug: t.slug,
        name: t.name || t.slug,
        description: t.description || '',
        applicableTo: Array.isArray(t.applicableTo) ? t.applicableTo : [],
      });
    }

    tags.sort((a, b) => a.name.localeCompare(b.name));

    res.json({ success: true, tags, count: tags.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ── GET /api/relay-discovery/tags-for-relay?relayEventId=<id> ────────────
// Returns all nostr-relay-tag applications that reference the given relay
// event ID. Each application is an opinion from some author that this relay
// belongs to some tag.

async function handleTagsForRelay(req, res) {
  const { relayEventId } = req.query;
  if (!relayEventId || typeof relayEventId !== 'string') {
    return res.status(400).json({ success: false, error: 'relayEventId is required' });
  }

  try {
    // We can't index into the JSON payload from strfry, so scan all
    // nostr-relay-tag events and filter client-side. This list grows slowly
    // in the MVP; Phase 4 will move aggregation into Neo4j.
    const events = await strfryScan({
      kinds: [39999],
      '#z': [NOSTR_RELAY_TAG_Z_TAG],
    });

    const applications = [];
    for (const ev of events) {
      const jsonTag = (ev.tags || []).find((t) => t[0] === 'json');
      if (!jsonTag || !jsonTag[1]) continue;
      let parsed;
      try { parsed = JSON.parse(jsonTag[1]); } catch { continue; }
      const nrt = parsed?.nostrRelayTag;
      if (!nrt || nrt.relayEventId !== relayEventId) continue;
      applications.push({
        eventId: ev.id,
        authorPubkey: ev.pubkey,
        relayEventId: nrt.relayEventId,
        tagEventId: nrt.tagEventId,
        confidence: typeof nrt.confidence === 'number' ? nrt.confidence : 1.0,
        createdAt: ev.created_at,
      });
    }

    res.json({
      success: true,
      relayEventId,
      applications,
      count: applications.length,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ── GET /api/relay-discovery/aggregated ──────────────────────────────────
// Aggregates all relay 39999 items that have been imported into Neo4j,
// grouped by websocket URL. For each relay we return the list of endorsing
// author pubkeys (one per 39999 event) and, cross-referenced against the
// imported nostr-relay-tag applications, the counts of each tag slug.
//
// Trust weighting happens client-side via the existing useTrustWeights
// hook; this endpoint only returns raw endorser pubkeys.
//
// Query params:
//   tagSlug  — optional, filter to relays that have at least one nostr-relay-tag
//              application with the given tag slug.
//   limit    — optional, cap on rows returned (default 100).

async function handleAggregated(req, res) {
  const { tagSlug, limit: limitRaw } = req.query;
  const limit = Math.max(1, Math.min(500, parseInt(limitRaw, 10) || 100));

  try {
    // All imported kind 39999 relay items, with authors and JSON payload.
    const relayRows = await runCypher(
      `MATCH (e:NostrEvent {kind: 39999})-[:HAS_TAG]->(zt:NostrEventTag {type: 'z'})
       WHERE zt.value = $zTag
       OPTIONAL MATCH (u:NostrUser)-[:AUTHORS]->(e)
       OPTIONAL MATCH (e)-[:HAS_TAG]->(jt:NostrEventTag {type: 'json'})
       RETURN e.id AS eventId, e.uuid AS uuid, u.pubkey AS author, jt.value AS json`,
      { zTag: NOSTR_RELAY_Z_TAG }
    );

    // All imported nostr-relay-tag applications with authors and JSON.
    const tagAppRows = await runCypher(
      `MATCH (e:NostrEvent {kind: 39999})-[:HAS_TAG]->(zt:NostrEventTag {type: 'z'})
       WHERE zt.value = $zTag
       OPTIONAL MATCH (u:NostrUser)-[:AUTHORS]->(e)
       OPTIONAL MATCH (e)-[:HAS_TAG]->(jt:NostrEventTag {type: 'json'})
       RETURN e.id AS eventId, u.pubkey AS author, jt.value AS json`,
      { zTag: NOSTR_RELAY_TAG_Z_TAG }
    );

    // All imported tag elements (authored by the TA), so we can resolve
    // tagEventId → tag slug.
    const tagRows = await runCypher(
      `MATCH (e:NostrEvent {kind: 39999, pubkey: $ta})-[:HAS_TAG]->(zt:NostrEventTag {type: 'z'})
       WHERE zt.value = $zTag
       OPTIONAL MATCH (e)-[:HAS_TAG]->(jt:NostrEventTag {type: 'json'})
       RETURN e.id AS eventId, jt.value AS json`,
      { ta: TA_PUBKEY, zTag: TAG_Z_TAG }
    );

    const tagSlugByEventId = new Map();
    const tagMeta = {};
    for (const row of tagRows) {
      if (!row.eventId || !row.json) continue;
      try {
        const parsed = JSON.parse(row.json);
        const t = parsed?.tag;
        if (!t?.slug) continue;
        tagSlugByEventId.set(row.eventId, t.slug);
        tagMeta[t.slug] = { slug: t.slug, name: t.name || t.slug, description: t.description || '' };
      } catch {}
    }

    // Count tag applications per (relayEventId, tagSlug) and collect authors.
    // relayApplicationAuthors: relayEventId → tagSlug → Set(authorPubkey)
    const relayApplicationAuthors = new Map();
    for (const row of tagAppRows) {
      if (!row.json) continue;
      let parsed;
      try { parsed = JSON.parse(row.json); } catch { continue; }
      const nrt = parsed?.nostrRelayTag;
      if (!nrt?.relayEventId || !nrt?.tagEventId) continue;
      const slug = tagSlugByEventId.get(nrt.tagEventId);
      if (!slug) continue;
      if (!relayApplicationAuthors.has(nrt.relayEventId)) {
        relayApplicationAuthors.set(nrt.relayEventId, new Map());
      }
      const bySlug = relayApplicationAuthors.get(nrt.relayEventId);
      if (!bySlug.has(slug)) bySlug.set(slug, new Set());
      if (row.author) bySlug.get(slug).add(row.author);
    }

    // Group relay events by websocket URL.
    const byUrl = new Map();
    for (const row of relayRows) {
      if (!row.json) continue;
      let parsed;
      try { parsed = JSON.parse(row.json); } catch { continue; }
      const nr = parsed?.nostrRelay;
      if (!nr?.websocketUrl) continue;
      const url = String(nr.websocketUrl).trim().replace(/\/+$/, '').toLowerCase();
      if (!url.startsWith('wss://') && !url.startsWith('ws://')) continue;

      if (!byUrl.has(url)) {
        byUrl.set(url, {
          websocketUrl: url,
          httpUrl: typeof nr.httpUrl === 'string' ? nr.httpUrl : null,
          slug: typeof nr.slug === 'string' ? nr.slug : null,
          endorsers: new Set(),           // distinct authors who published a 39999 for this relay
          relayEventIds: new Set(),       // all 39999 event IDs referencing this relay (by url)
          tagApplications: {},            // tagSlug → { authors: Set, count }
        });
      }
      const entry = byUrl.get(url);
      if (row.author) entry.endorsers.add(row.author);
      if (row.eventId) entry.relayEventIds.add(row.eventId);
    }

    // Merge tag applications into entries.
    for (const entry of byUrl.values()) {
      for (const relayEventId of entry.relayEventIds) {
        const bySlug = relayApplicationAuthors.get(relayEventId);
        if (!bySlug) continue;
        for (const [slug, authors] of bySlug) {
          if (!entry.tagApplications[slug]) {
            entry.tagApplications[slug] = { authors: new Set(), count: 0 };
          }
          for (const a of authors) entry.tagApplications[slug].authors.add(a);
        }
      }
      for (const slug of Object.keys(entry.tagApplications)) {
        entry.tagApplications[slug].count = entry.tagApplications[slug].authors.size;
      }
    }

    // Convert to plain JSON.
    let entries = [];
    for (const entry of byUrl.values()) {
      const tagApps = {};
      for (const [slug, data] of Object.entries(entry.tagApplications)) {
        tagApps[slug] = { count: data.count, authors: [...data.authors] };
      }
      entries.push({
        websocketUrl: entry.websocketUrl,
        httpUrl: entry.httpUrl,
        slug: entry.slug,
        endorsers: [...entry.endorsers],
        endorserCount: entry.endorsers.size,
        relayEventIds: [...entry.relayEventIds],
        tagApplications: tagApps,
      });
    }

    // Optional tagSlug filter.
    if (tagSlug) {
      entries = entries.filter((e) => e.tagApplications?.[tagSlug]);
    }

    // Default sort: endorser count desc, then total tag application count desc.
    entries.sort((a, b) => {
      if (b.endorserCount !== a.endorserCount) return b.endorserCount - a.endorserCount;
      const at = Object.values(a.tagApplications).reduce((s, d) => s + d.count, 0);
      const bt = Object.values(b.tagApplications).reduce((s, d) => s + d.count, 0);
      return bt - at;
    });

    entries = entries.slice(0, limit);

    res.json({
      success: true,
      count: entries.length,
      relays: entries,
      tagMeta,
      filters: { tagSlug: tagSlug || null, limit },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ── GET /api/relay-discovery/demo-actors ─────────────────────────────────
// Returns the good/bad/neutral demo actor pubkey lists produced by
// test-data/mint-demo-relays.js. Used by the UI to offer a "Follow all
// demo good actors" shortcut for the WoT demo.
//
// If the demo hasn't been seeded, `available` is false and the UI can
// hide the demo panel.

const DEMO_DATA_PATH = path.resolve(__dirname, '../../../test-data/demo-relays-data.json');

// ── GET /api/relay-discovery/pipeline-state ──────────────────────────────
// Lightweight snapshot of the WoT/GR pipeline state so the UI wizard can
// show the user how far they've progressed through the pipeline that
// produces real GrapeRank weights.

function strfryCount(filter) {
  return new Promise((resolve) => {
    const safeFilter = JSON.stringify(filter).replace(/'/g, "'\\''");
    exec(`strfry scan --count '${safeFilter}' 2>/dev/null`, { timeout: 15000 }, (err, stdout) => {
      if (err) return resolve(0);
      const n = parseInt(stdout.trim(), 10);
      resolve(Number.isFinite(n) ? n : 0);
    });
  });
}

async function handlePipelineState(req, res) {
  try {
    const [usersRow, followsRow, hopsRow, grRow, kind3Row, kind10040Row, kind30382Row, kind3Strfry, kind7Strfry, kind10040Strfry, kind30382Strfry] = await Promise.all([
      runCypher('MATCH (n:NostrUser) RETURN count(n) AS c').then((r) => r[0] || { c: 0 }),
      runCypher('MATCH ()-[r:FOLLOWS]->() RETURN count(r) AS c').then((r) => r[0] || { c: 0 }),
      runCypher('MATCH (n:NostrUser) WHERE n.hops IS NOT NULL RETURN count(n) AS c').then((r) => r[0] || { c: 0 }),
      runCypher('MATCH (n:NostrUser) WHERE n.influence IS NOT NULL RETURN count(n) AS c').then((r) => r[0] || { c: 0 }),
      runCypher('MATCH (e:NostrEvent {kind: 3}) RETURN count(e) AS c').then((r) => r[0] || { c: 0 }),
      runCypher('MATCH (e:NostrEvent {kind: 10040}) RETURN count(e) AS c').then((r) => r[0] || { c: 0 }),
      runCypher('MATCH (e:NostrEvent {kind: 30382}) RETURN count(e) AS c').then((r) => r[0] || { c: 0 }),
      strfryCount({ kinds: [3] }),
      strfryCount({ kinds: [7] }),
      strfryCount({ kinds: [10040] }),
      strfryCount({ kinds: [30382] }),
    ]);

    res.json({
      success: true,
      users: usersRow.c,
      follows: followsRow.c,
      hopsNodes: hopsRow.c,
      grScored: grRow.c,
      kind3InNeo4j: kind3Row.c,
      kind10040InNeo4j: kind10040Row.c,
      kind30382InNeo4j: kind30382Row.c,
      kind3InStrfry: kind3Strfry,
      kind7InStrfry: kind7Strfry,
      kind10040InStrfry: kind10040Strfry,
      kind30382InStrfry: kind30382Strfry,
      relayPubkey: TA_PUBKEY, // BRAINSTORM_RELAY_PUBKEY == TA in this install
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ── GET /api/relay-discovery/unsigned-10040?pubkey=<hex> ─────────────────
// Builds an unsigned kind-10040 (NIP-85 Treasure Map) template the client
// can sign via NIP-07 and publish. Unlike /api/create-unsigned-kind10040
// this does not require per-customer relay keys — it uses the configured
// BRAINSTORM_RELAY_PUBKEY + BRAINSTORM_NIP85_HOME_RELAY (or
// BRAINSTORM_RELAY_URL as fallback) directly, so it works on a
// single-owner dev install.

const { getConfigFromFile } = require('../../utils/config');

function handleUnsigned10040(req, res) {
  const { pubkey } = req.query;
  if (!pubkey || !/^[0-9a-f]{64}$/i.test(pubkey)) {
    return res.status(400).json({ success: false, error: 'pubkey query param (64-char hex) is required' });
  }
  const relayPubkey = getConfigFromFile('BRAINSTORM_RELAY_PUBKEY', '') || TA_PUBKEY;
  const relayUrl = getConfigFromFile('BRAINSTORM_RELAY_URL', 'ws://localhost:7777');
  // Prefer BRAINSTORM_RELAY_URL (where kind-30382 events actually get
  // published by brainstorm-publish-kind30382.js on this install). Only
  // fall back to BRAINSTORM_NIP85_HOME_RELAY if RELAY_URL is empty.
  // The original bin/brainstorm-create-kind10040.js does the reverse —
  // that's the right default for a hosted install with a public NIP-85
  // home relay, but wrong for a local dev install where the home relay
  // points at a domain with no 30382s on it.
  const nip85HomeRelay = relayUrl || getConfigFromFile('BRAINSTORM_NIP85_HOME_RELAY', '');

  // Mirrors the tag set produced by bin/brainstorm-create-kind10040.js so
  // useTrustWeights's `30382:rank` lookup works unchanged.
  const rankingTypes = [
    'rank',
    'followers',
    'personalizedGrapeRank_influence',
    'personalizedGrapeRank_average',
    'personalizedGrapeRank_confidence',
    'personalizedGrapeRank_input',
    'personalizedPageRank',
    'hops',
    'verifiedFollowerCount',
    'verifiedMuterCount',
    'verifiedReporterCount',
  ];
  const unsignedEvent = {
    kind: 10040,
    pubkey: pubkey.toLowerCase(),
    created_at: Math.floor(Date.now() / 1000),
    content: '',
    tags: rankingTypes.map((t) => [`30382:${t}`, relayPubkey, nip85HomeRelay]),
  };

  res.json({
    success: true,
    event: unsignedEvent,
    relayPubkey,
    nip85HomeRelay,
  });
}

function handleDemoActors(req, res) {
  try {
    if (!fs.existsSync(DEMO_DATA_PATH)) {
      return res.json({ success: true, available: false });
    }
    const data = JSON.parse(fs.readFileSync(DEMO_DATA_PATH, 'utf8'));
    res.json({
      success: true,
      available: true,
      // goodActors retained for back-compat with the "Follow seed good
      // actors" button: contains only the SEED (1-hop) good actors.
      goodActors: data.goodActors || data.seedGoodActors || {},
      seedGoodActors: data.seedGoodActors || data.goodActors || {},
      tier2GoodActors: data.tier2GoodActors || {},
      tier3GoodActors: data.tier3GoodActors || {},
      badActors: data.badActors || {},
      neutralActors: data.neutralActors || {},
      ownerPubkey: data.ownerPubkey || null,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

function registerRelayDiscoveryRoutes(app) {
  app.get('/api/relay-discovery/by-pubkey', handleByPubkey);
  app.get('/api/relay-discovery/available-tags', handleAvailableTags);
  app.get('/api/relay-discovery/tags-for-relay', handleTagsForRelay);
  app.get('/api/relay-discovery/aggregated', handleAggregated);
  app.get('/api/relay-discovery/demo-actors', handleDemoActors);
  app.get('/api/relay-discovery/pipeline-state', handlePipelineState);
  app.get('/api/relay-discovery/unsigned-10040', handleUnsigned10040);
}

module.exports = {
  registerRelayDiscoveryRoutes,
  handleByPubkey,
  handleAvailableTags,
  handleTagsForRelay,
  handleAggregated,
  handleDemoActors,
  handlePipelineState,
  handleUnsigned10040,
};
