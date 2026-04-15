/**
 * Concept Discovery API — cross-instance concept sharing.
 *
 * Lets an instance discover and ingest Tapestry concept definitions authored
 * by some other instance's TA pubkey. Once a foreign concept is imported, it
 * lives in local Neo4j alongside our own firmware-sourced concepts, and
 * relay-discovery's aggregated view honours kind-39999 events z-tagged to
 * either coordinate.
 *
 * Endpoints:
 *   GET  /api/concept-discovery/suggested-authors
 *        Static bootstrap list, read from config/suggested-concept-authors.json.
 *        Swap point for a future DCoSL-backed implementation.
 *
 *   GET  /api/concept-discovery/concepts-by-pubkey?pubkey=<hex>[&relays=<csv>]
 *        External + local fetch of the kind-39998 ConceptHeader events
 *        authored by `pubkey`. Each entry annotated with `alreadyImported`.
 *
 *   GET  /api/concept-discovery/concept-preview?pubkey=<hex>&slug=<slug>
 *        Deep preview of a single foreign concept: schema shape, sets,
 *        element count. Used by the import confirmation screen.
 *
 *   POST /api/concept-discovery/import  body { pubkey, slug, relays? }
 *        Fetch the concept's full event bundle, land it in local strfry
 *        (no re-signing — foreign events stay intact), import each event
 *        to Neo4j via buildImportCypher, then run Pass-3 derivation so
 *        the concept lights up in the existing Concepts UI.
 *
 *   GET  /api/concept-discovery/known-by-slug?slug=<slug>
 *        List every ConceptHeader currently in Neo4j whose d-tag matches
 *        `slug`. Used by the informational "other concepts" panels on
 *        PublishRelayForm / RelayTagPanel.
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
const { buildImportCypher } = require('../neo4j/eventSync');
const { runPass3 } = require('../../firmware/install');
const { getDriver } = require('../../lib/neo4j-driver');

const FETCH_TIMEOUT_MS = 8000;
const SUGGESTED_AUTHORS_PATH = path.resolve(__dirname, '../../../config/suggested-concept-authors.json');

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

function strfryScan(filter) {
  return new Promise((resolve) => {
    const safeFilter = JSON.stringify(filter).replace(/'/g, "'\\''");
    exec(`strfry scan '${safeFilter}'`, { maxBuffer: 20 * 1024 * 1024, timeout: 15000 }, (err, stdout) => {
      if (err) return resolve([]);
      const events = [];
      for (const line of stdout.split('\n')) {
        if (!line) continue;
        try { events.push(JSON.parse(line)); } catch {}
      }
      resolve(events);
    });
  });
}

function strfryImport(event) {
  return new Promise((resolve, reject) => {
    const child = exec('strfry import --no-verify', { timeout: 10000 }, (err, _stdout, stderr) => {
      if (err) return reject(new Error(`strfry import: ${err.message} ${stderr || ''}`));
      resolve();
    });
    child.stdin.write(JSON.stringify(event) + '\n');
    child.stdin.end();
  });
}

async function importEventToNeo4j(event) {
  const statements = buildImportCypher(event);
  const driver = getDriver();
  const session = driver.session();
  try {
    for (const stmt of statements) {
      await session.run(stmt);
    }
  } finally {
    await session.close();
  }
}

/**
 * Apply concept-aware Neo4j labels to an imported event based on its JSON
 * payload shape. `buildImportCypher` only knows about kind→label mapping
 * (39998 → ListHeader, 39999 → ListItem). Specific labels like
 * :ConceptHeader / :JSONSchema / :Set / :Superset are assigned by the
 * firmware install path during Pass 1 — we replicate that here for foreign
 * imports.
 */
async function applyContentLabels(event) {
  const dTag = (event.tags || []).find((t) => t[0] === 'd')?.[1];
  if (!dTag) return;
  const uuid = `${event.kind}:${event.pubkey}:${dTag}`;
  const payload = parseJsonTag(event) || {};
  const wordTypes = Array.isArray(payload?.word?.wordTypes) ? payload.word.wordTypes : [];
  const labels = new Set();

  if (event.kind === 39998 && payload.conceptHeader) labels.add('ConceptHeader');
  if (event.kind === 39999) {
    if (payload.jsonSchema) labels.add('JSONSchema');
    if (payload.set) labels.add('Set');
    if (wordTypes.includes('superset')) labels.add('Superset');
    if (payload.primaryProperty) labels.add('Property');
  }
  if (labels.size === 0) return;

  const setClause = [...labels].map((l) => `e:${l}`).join(', ');
  const driver = getDriver();
  const session = driver.session();
  try {
    await session.run(
      `MATCH (e:NostrEvent {uuid: $uuid}) SET ${setClause}`,
      { uuid },
    );
  } finally {
    await session.close();
  }
}

async function fetchFromPool(relays, filter) {
  const pool = new SimplePool();
  try {
    return await Promise.race([
      pool.querySync(relays, filter),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), FETCH_TIMEOUT_MS)),
    ]).catch(() => []);
  } finally {
    try { pool.close(relays); } catch {}
  }
}

function dedupById(events) {
  const seen = new Set();
  const out = [];
  for (const e of events) {
    if (!e?.id || seen.has(e.id)) continue;
    seen.add(e.id);
    out.push(e);
  }
  return out;
}

function parseJsonTag(event) {
  const tag = (event.tags || []).find((t) => t[0] === 'json');
  if (!tag || !tag[1]) return null;
  try { return JSON.parse(tag[1]); } catch { return null; }
}

function conceptCoordinate(event) {
  const dTag = (event.tags || []).find((t) => t[0] === 'd')?.[1];
  if (!dTag) return null;
  return `${event.kind}:${event.pubkey}:${dTag}`;
}

// ── GET /suggested-authors ──────────────────────────────────────────────

function handleSuggestedAuthors(req, res) {
  try {
    if (!fs.existsSync(SUGGESTED_AUTHORS_PATH)) {
      return res.json({ success: true, authors: [] });
    }
    const raw = fs.readFileSync(SUGGESTED_AUTHORS_PATH, 'utf8');
    const data = JSON.parse(raw);
    const authors = Array.isArray(data.authors) ? data.authors : [];
    // Pass through only the known keys — keeps the API contract stable across
    // config additions.
    res.json({
      success: true,
      authors: authors
        .filter((a) => a && isHexPubkey(a.pubkey))
        .map((a) => ({
          pubkey: a.pubkey,
          name: a.name || a.pubkey.slice(0, 12),
          description: a.description || '',
          relays: Array.isArray(a.relays) ? a.relays : [],
        })),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ── GET /concepts-by-pubkey ─────────────────────────────────────────────

async function handleConceptsByPubkey(req, res) {
  const { pubkey, relays: relaysParam } = req.query;
  if (!pubkey || !isHexPubkey(pubkey)) {
    return res.status(400).json({ success: false, error: 'pubkey query param (64-char hex) is required' });
  }
  const relays = parseRelays(relaysParam);
  try {
    const [externalEvents, localEvents] = await Promise.all([
      fetchFromPool(relays, { kinds: [39998], authors: [pubkey] }),
      strfryScan({ kinds: [39998], authors: [pubkey] }),
    ]);
    const merged = dedupById([...externalEvents, ...localEvents]);

    // Collect the coordinates and ask Neo4j which we already have imported.
    const coordinates = merged.map(conceptCoordinate).filter(Boolean);
    const installed = new Set();
    if (coordinates.length > 0) {
      const rows = await runCypher(
        'MATCH (c:ConceptHeader) WHERE c.uuid IN $coords RETURN c.uuid AS uuid',
        { coords: coordinates },
      );
      for (const r of rows) installed.add(r.uuid);
    }

    const concepts = merged.map((e) => {
      const parsed = parseJsonTag(e);
      const dTag = (e.tags || []).find((t) => t[0] === 'd')?.[1];
      const coordinate = conceptCoordinate(e);
      const header = parsed?.conceptHeader || {};
      return {
        coordinate,
        slug: dTag || null,
        name: header.oNames?.singular || dTag || null,
        pluralName: header.oNames?.plural || null,
        description: header.description || '',
        pubkey: e.pubkey,
        eventId: e.id,
        createdAt: e.created_at,
        alreadyImported: coordinate ? installed.has(coordinate) : false,
      };
    });

    concepts.sort((a, b) => (a.slug || '').localeCompare(b.slug || ''));

    res.json({
      success: true,
      pubkey,
      queriedRelays: relays,
      concepts,
      count: concepts.length,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ── GET /concept-preview ────────────────────────────────────────────────

async function fetchConceptBundle(pubkey, slug, relays) {
  // Header + all addressable supporting 39999s whose d-tag starts with <slug>-.
  // We can't filter by d-tag prefix server-side on most relays, so we pull all
  // 39999s authored by pubkey and filter locally.
  const headerFilter = { kinds: [39998], authors: [pubkey], '#d': [slug] };
  const supportFilter = { kinds: [39999], authors: [pubkey] };

  const [headerExt, headerLocal, supportExt, supportLocal] = await Promise.all([
    fetchFromPool(relays, headerFilter),
    strfryScan(headerFilter),
    fetchFromPool(relays, supportFilter),
    strfryScan(supportFilter),
  ]);

  const header = dedupById([...headerExt, ...headerLocal])[0] || null;
  const support = dedupById([...supportExt, ...supportLocal]).filter((e) => {
    const dTag = (e.tags || []).find((t) => t[0] === 'd')?.[1] || '';
    return dTag === slug || dTag.startsWith(`${slug}-`);
  });

  return { header, support };
}

async function handleConceptPreview(req, res) {
  const { pubkey, slug, relays: relaysParam } = req.query;
  if (!pubkey || !isHexPubkey(pubkey) || !slug) {
    return res.status(400).json({ success: false, error: 'pubkey (64-char hex) and slug query params are required' });
  }
  const relays = parseRelays(relaysParam);
  try {
    const { header, support } = await fetchConceptBundle(pubkey, slug, relays);
    if (!header) {
      return res.status(404).json({ success: false, error: `No kind-39998 found for ${pubkey} d-tag=${slug}` });
    }

    const coordinate = conceptCoordinate(header);
    const headerJson = parseJsonTag(header)?.conceptHeader || {};

    // Schema event: d-tag = <slug>-schema
    const schemaEvent = support.find(
      (e) => (e.tags || []).find((t) => t[0] === 'd')?.[1] === `${slug}-schema`,
    );
    const schemaPayload = schemaEvent ? parseJsonTag(schemaEvent)?.jsonSchema : null;
    const oKeySingular = headerJson.oKeys?.singular || slug;
    const schemaNode = schemaPayload?.properties?.[oKeySingular] || null;
    const schemaSummary = schemaNode
      ? {
          required: Array.isArray(schemaNode.required) ? schemaNode.required : [],
          properties: Object.fromEntries(
            Object.entries(schemaNode.properties || {}).map(([k, v]) => [
              k,
              { type: v.type || 'unknown', description: v.description || '' },
            ]),
          ),
          unique: schemaNode['x-tapestry']?.unique || [],
        }
      : null;

    // Set events: d-tag does NOT start with <slug>- but their JSON has word.slug
    // referencing one of the concept's known sets. The firmware pattern pushes
    // Superset under <slug>-superset though. For preview we list any support
    // event whose json carries a `set` payload.
    const sets = support
      .map((e) => {
        const payload = parseJsonTag(e);
        const set = payload?.set;
        if (!set) return null;
        return {
          slug: set.slug || null,
          name: set.name || set.title || null,
          description: set.description || '',
        };
      })
      .filter(Boolean);

    // Element count — cheap `strfry --count` on the local relay + SimplePool
    // count on the external set, deduped by id.
    const [elemExt, elemLocal] = await Promise.all([
      fetchFromPool(relays, { kinds: [39999], '#z': [coordinate] }),
      strfryScan({ kinds: [39999], '#z': [coordinate] }),
    ]);
    const elementCount = dedupById([...elemExt, ...elemLocal]).length;

    // Is it already imported?
    const installedRows = await runCypher(
      'MATCH (c:ConceptHeader {uuid: $coord}) RETURN c.uuid AS uuid',
      { coord: coordinate },
    );
    const alreadyImported = installedRows.length > 0;

    res.json({
      success: true,
      coordinate,
      header: {
        name: headerJson.oNames?.singular || slug,
        pluralName: headerJson.oNames?.plural || null,
        description: headerJson.description || '',
        oKeys: headerJson.oKeys || null,
        pubkey: header.pubkey,
        eventId: header.id,
        createdAt: header.created_at,
      },
      schema: schemaSummary,
      sets,
      elementCount,
      supportEventIds: support.map((e) => e.id),
      alreadyImported,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ── POST /import ─────────────────────────────────────────────────────────

async function handleImport(req, res) {
  const { pubkey, slug, relays: relaysParam } = req.body || {};
  if (!pubkey || !isHexPubkey(pubkey) || !slug) {
    return res.status(400).json({ success: false, error: 'pubkey (hex) and slug are required in the body' });
  }
  const relays = parseRelays(Array.isArray(relaysParam) ? relaysParam.join(',') : relaysParam);

  try {
    const { header, support } = await fetchConceptBundle(pubkey, slug, relays);
    if (!header) {
      return res.status(404).json({ success: false, error: `No kind-39998 found for ${pubkey} d-tag=${slug}` });
    }
    const allEvents = [header, ...support];

    // Land every event in local strfry. strfry dedupes by id; already-imported
    // events are a no-op.
    const imported = [];
    const skipped = [];
    for (const ev of allEvents) {
      try {
        await strfryImport(ev);
        imported.push(ev.id);
      } catch (err) {
        skipped.push({ eventId: ev.id, reason: err.message });
      }
    }

    // Import each event's Neo4j nodes + tags + AUTHORS via buildImportCypher.
    // This is the same path user-published 39999s take via
    // /api/neo4j/event-update, adapted here so we don't have to re-sign.
    // Then apply concept-aware labels (:ConceptHeader, :JSONSchema, etc.)
    // that the firmware install would normally set in Pass 1.
    for (const ev of allEvents) {
      try {
        await importEventToNeo4j(ev);
        await applyContentLabels(ev);
      } catch (err) {
        skipped.push({ eventId: ev.id, reason: `neo4j: ${err.message}` });
      }
    }

    // Run Pass 3 to assign labels + wire class threads + derive implicit nodes.
    // Idempotent; sweeps all currently-present events in Neo4j.
    const pass3 = await runPass3(req.app);

    const coordinate = conceptCoordinate(header);
    res.json({
      success: true,
      coordinate,
      imported,
      skipped,
      eventCount: allEvents.length,
      pass3,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ── GET /known-by-slug ───────────────────────────────────────────────────

async function handleKnownBySlug(req, res) {
  const { slug } = req.query;
  if (!slug) {
    return res.status(400).json({ success: false, error: 'slug query param is required' });
  }
  try {
    // Strict slug-coordinate match. A different slug (even one that's
    // semantically related, like nostr-relay-v2) is a different concept by
    // definition — surfacing it here would conflate "alternative
    // interpretations of the same coordinate" with "things that are
    // vaguely about the same idea." Plurality across slugs lives on the
    // dedicated Concepts and Concept Discovery pages, not in publish UIs.
    const rows = await runCypher(
      `MATCH (c:ConceptHeader)
       WHERE c.uuid ENDS WITH $suffix
       RETURN c.uuid AS coordinate, c.pubkey AS pubkey, c.created_at AS createdAt, c.name AS name
       ORDER BY c.created_at ASC`,
      { suffix: `:${slug}` },
    );
    res.json({
      success: true,
      slug,
      concepts: rows.map((r) => ({
        coordinate: r.coordinate,
        pubkey: r.pubkey,
        name: r.name || slug,
        createdAt: r.createdAt,
      })),
      count: rows.length,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

function registerConceptDiscoveryRoutes(app) {
  app.get('/api/concept-discovery/suggested-authors', handleSuggestedAuthors);
  app.get('/api/concept-discovery/concepts-by-pubkey', handleConceptsByPubkey);
  app.get('/api/concept-discovery/concept-preview', handleConceptPreview);
  app.post('/api/concept-discovery/import', handleImport);
  app.get('/api/concept-discovery/known-by-slug', handleKnownBySlug);
}

module.exports = {
  registerConceptDiscoveryRoutes,
  handleSuggestedAuthors,
  handleConceptsByPubkey,
  handleConceptPreview,
  handleImport,
  handleKnownBySlug,
};
