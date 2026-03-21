/**
 * I/O API — import/export endpoints for tapestry word data.
 *
 * Export endpoints:
 *   GET  /api/io/exports           — list available export zip files
 *   POST /api/io/exports           — create a new export zip
 *   GET  /api/io/exports/:filename — download an export zip
 *
 * Import endpoints:
 *   POST /api/io/imports/upload         — upload a zip, parse manifest
 *   GET  /api/io/imports/:tempId/word/:slug — preview a single word JSON
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const archiver = require('archiver');
const { runCypher } = require('../lib/neo4j-driver');

/**
 * Scan strfry for events matching a filter.
 * Returns an array of parsed event objects.
 */
function strfryScan(filter) {
  return new Promise((resolve, reject) => {
    const safeFilter = JSON.stringify(filter).replace(/'/g, "'\\''");
    exec(`strfry scan '${safeFilter}'`, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout) => {
      if (error) return reject(error);
      const events = [];
      for (const line of stdout.trim().split('\n')) {
        if (!line) continue;
        try { events.push(JSON.parse(line)); } catch {}
      }
      resolve(events);
    });
  });
}

/**
 * Find a single event in strfry by uuid.
 * Replaceable events (kind 30000+) use kind:pubkey:d-tag lookup;
 * non-replaceable use id lookup.
 */
async function findInStrfry(uuid) {
  if (uuid.match(/^(9998|39998|9999|39999):/)) {
    const parts = uuid.split(':');
    const kind = parseInt(parts[0], 10);
    const pubkey = parts[1];
    const dTag = parts.slice(2).join(':');
    const events = await strfryScan({ kinds: [kind], authors: [pubkey], '#d': [dTag] });
    return events[0] || null;
  }
  const events = await strfryScan({ ids: [uuid] });
  return events[0] || null;
}

const EXPORTS_DIR = '/var/lib/brainstorm/exports';

// In-memory store for uploaded import temp files
const importStore = new Map();

/**
 * GET /api/io/exports — list available export zip files
 */
async function handleListExports(req, res) {
  try {
    // Create directory if it doesn't exist
    if (!fs.existsSync(EXPORTS_DIR)) {
      fs.mkdirSync(EXPORTS_DIR, { recursive: true });
    }

    const files = fs.readdirSync(EXPORTS_DIR)
      .filter(f => f.endsWith('.zip'))
      .map(name => {
        const stat = fs.statSync(path.join(EXPORTS_DIR, name));
        return {
          name,
          size: stat.size,
          date: stat.mtime.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({ success: true, files });
  } catch (err) {
    console.error('Error listing exports:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/io/exports — create a new export zip
 * Body: { nodeUuids: string[], concepts: [{ uuid, name, graphs: { conceptGraph, propertyTree, coreNodes } }] }
 */
async function handleCreateExport(req, res) {
  try {
    const { nodeUuids = [], concepts = [] } = req.body;

    if (!nodeUuids.length && !concepts.length) {
      return res.status(400).json({ success: false, error: 'No nodes or concepts selected' });
    }

    // Create exports directory if needed
    if (!fs.existsSync(EXPORTS_DIR)) {
      fs.mkdirSync(EXPORTS_DIR, { recursive: true });
    }

    // Dedupe all UUIDs
    const allUuids = new Set(nodeUuids);

    // Fetch JSON for all selected nodes
    const uuidList = [...allUuids];
    const wordData = [];

    // Batch fetch in chunks of 50
    for (let i = 0; i < uuidList.length; i += 50) {
      const batch = uuidList.slice(i, i + 50);
      const quotedUuids = batch.map(u => `'${u.replace(/'/g, "\\'")}'`).join(',');
      const rows = await runCypher(`
        MATCH (e:NostrEvent)
        WHERE e.uuid IN [${quotedUuids}]
        OPTIONAL MATCH (e)-[:HAS_TAG]->(j:NostrEventTag {type: 'json'})
        RETURN e.uuid AS uuid, e.name AS name, head(collect(j.value)) AS json
      `);
      wordData.push(...rows);
    }

    // Parse JSON and build file entries
    const entries = [];
    for (const row of wordData) {
      let parsed = {};
      try {
        parsed = typeof row.json === 'string' ? JSON.parse(row.json) : (row.json || {});
      } catch { /* skip parse errors */ }

      const slug = parsed.slug || parsed.name || row.name || row.uuid;
      const safeSlug = slug.replace(/[^a-zA-Z0-9_-]/g, '_');

      entries.push({
        uuid: row.uuid,
        name: row.name,
        slug: safeSlug,
        description: parsed.description || '',
        wordTypes: parsed.wordTypes || [],
        filename: `${safeSlug}.json`,
        json: parsed,
      });
    }

    // Fetch raw nostr events from strfry for each word
    const rawEvents = [];
    for (const entry of entries) {
      try {
        const event = await findInStrfry(entry.uuid);
        if (event) {
          rawEvents.push({
            uuid: entry.uuid,
            slug: entry.slug,
            filename: `raw/${entry.slug}.event.json`,
            event,
          });
        } else {
          console.warn(`Raw event not found in strfry for uuid: ${entry.uuid}`);
        }
      } catch (err) {
        console.warn(`Error fetching raw event for ${entry.uuid}:`, err.message);
      }
    }

    // Build manifest
    const manifest = {
      exportDate: new Date().toISOString(),
      exportVersion: 2,
      wordCount: entries.length,
      conceptCount: concepts.length,
      rawEventCount: rawEvents.length,
      concepts: concepts.map(c => ({
        uuid: c.uuid,
        name: c.name,
        graphs: c.graphs || {},
      })),
      words: entries.map(e => ({
        slug: e.slug,
        description: e.description,
        uuid: e.uuid,
        filename: e.filename,
        wordTypes: e.wordTypes,
      })),
      rawEvents: rawEvents.map(r => ({
        uuid: r.uuid,
        slug: r.slug,
        filename: r.filename,
      })),
    };

    // Create zip
    const now = new Date();
    const dateStr = now.toISOString().replace(/T/, '-').replace(/:/g, '').slice(0, 15);
    const zipName = `export-${entries.length}-words-${concepts.length}-concepts-${dateStr}.zip`;
    const zipPath = path.join(EXPORTS_DIR, zipName);

    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', resolve);
      archive.on('error', reject);
      archive.pipe(output);

      // Add manifest
      archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

      // Add individual word files (JSON payload)
      for (const entry of entries) {
        archive.append(JSON.stringify(entry.json, null, 2), { name: entry.filename });
      }

      // Add raw nostr events
      for (const raw of rawEvents) {
        archive.append(JSON.stringify(raw.event, null, 2), { name: raw.filename });
      }

      archive.finalize();
    });

    const stat = fs.statSync(zipPath);
    res.json({
      success: true,
      filename: zipName,
      size: stat.size,
      wordCount: entries.length,
      conceptCount: concepts.length,
      rawEventCount: rawEvents.length,
    });
  } catch (err) {
    console.error('Error creating export:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/io/exports/:filename — download an export zip
 */
function handleDownloadExport(req, res) {
  try {
    const { filename } = req.params;
    // Sanitize filename to prevent directory traversal
    const safeName = path.basename(filename);
    const filePath = path.join(EXPORTS_DIR, safeName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    res.download(filePath, safeName);
  } catch (err) {
    console.error('Error downloading export:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/io/imports/upload — upload a zip, parse manifest, return summary
 * Expects multipart form with a 'file' field
 */
async function handleImportUpload(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const AdmZip = require('adm-zip');
    const zip = new AdmZip(req.file.buffer);
    const entries = zip.getEntries();

    // Find manifest
    const manifestEntry = entries.find(e => e.entryName === 'manifest.json');
    if (!manifestEntry) {
      return res.status(400).json({ success: false, error: 'No manifest.json found in zip' });
    }

    const manifest = JSON.parse(manifestEntry.getData().toString('utf8'));

    // Store word files and raw event files in memory keyed by slug
    const tempId = `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const wordFiles = {};
    const rawEventFiles = {};
    for (const entry of entries) {
      if (entry.entryName === 'manifest.json') continue;
      if (!entry.entryName.endsWith('.json')) continue;

      if (entry.entryName.startsWith('raw/')) {
        // raw/<slug>.event.json → key by slug
        const basename = path.basename(entry.entryName, '.event.json');
        rawEventFiles[basename] = entry.getData().toString('utf8');
      } else {
        const slug = path.basename(entry.entryName, '.json');
        wordFiles[slug] = entry.getData().toString('utf8');
      }
    }

    importStore.set(tempId, { manifest, wordFiles, rawEventFiles, createdAt: Date.now() });

    // Clean up old imports (older than 1 hour)
    const ONE_HOUR = 60 * 60 * 1000;
    for (const [id, data] of importStore) {
      if (Date.now() - data.createdAt > ONE_HOUR) {
        importStore.delete(id);
      }
    }

    res.json({
      success: true,
      tempId,
      manifest,
    });
  } catch (err) {
    console.error('Error processing import upload:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/io/imports/:tempId/word/:slug — preview a single word's JSON and raw event
 */
function handleImportWordPreview(req, res) {
  try {
    const { tempId, slug } = req.params;
    const data = importStore.get(tempId);

    if (!data) {
      return res.status(404).json({ success: false, error: 'Import session not found or expired' });
    }

    const wordJson = data.wordFiles[slug];
    const rawEventJson = data.rawEventFiles?.[slug];

    if (!wordJson && !rawEventJson) {
      return res.status(404).json({ success: false, error: `Word "${slug}" not found in import` });
    }

    res.json({
      success: true,
      slug,
      json: wordJson ? JSON.parse(wordJson) : null,
      rawEvent: rawEventJson ? JSON.parse(rawEventJson) : null,
      hasJson: !!wordJson,
      hasRawEvent: !!rawEventJson,
    });
  } catch (err) {
    console.error('Error previewing import word:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Write a raw nostr event to strfry.
 * Pipes the JSON to `strfry import --no-verify`.
 */
function writeToStrfry(event) {
  return new Promise((resolve, reject) => {
    const child = exec(
      'strfry import --no-verify',
      { timeout: 15000 },
      (error, stdout, stderr) => {
        if (error) return reject(new Error(`strfry import: ${error.message}\n${stderr}`));
        resolve(stdout.trim());
      }
    );
    child.stdin.write(JSON.stringify(event) + '\n');
    child.stdin.end();
  });
}

/**
 * Escape a string for safe use in Cypher single-quoted strings.
 */
function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Build a concept lookup table from Neo4j.
 * Returns a Map keyed by oKeys.singular (camelCase wordType) with:
 *   { conceptName, supersetUuid, nodeLabelRequired, nodeLabel }
 */
async function buildConceptLookup() {
  const { executeCypher } = require('./neo4j/eventSync');
  const lookup = new Map();

  // Query all concept headers that have a superset wired up.
  // Get the concept header's JSON to read oKeys, oLabels, and x-tapestry.neo4j.nodeLabelRequired.
  const rows = await runCypher(`
    MATCH (h:ListHeader)-[:IS_THE_CONCEPT_FOR]->(s)
    MATCH (h)-[:HAS_TAG]->(jt:NostrEventTag {type: 'json'})
    RETURN h.uuid AS headerUuid, s.uuid AS supersetUuid, head(collect(jt.value)) AS json
  `);

  for (const row of rows) {
    if (!row.json) continue;
    let parsed;
    try {
      parsed = typeof row.json === 'string' ? JSON.parse(row.json) : row.json;
    } catch { continue; }

    const ch = parsed.conceptHeader || {};
    const key = ch.oKeys?.singular;
    if (!key) continue;

    const nodeLabelRequired = ch['x-tapestry']?.neo4j?.nodeLabelRequired === true;
    const nodeLabel = ch.oLabels?.singular || null;

    lookup.set(key, {
      conceptName: ch.oNames?.singular || key,
      headerUuid: row.headerUuid,
      supersetUuid: row.supersetUuid,
      nodeLabelRequired,
      nodeLabel,
    });
  }

  return lookup;
}

/**
 * POST /api/io/imports/:tempId/execute — import selected words into strfry + Neo4j
 * Body: { slugs: string[] }
 *
 * Three phases:
 *   Phase 1: Write raw events to strfry + create base Neo4j nodes (NostrEvent, tags, AUTHORS)
 *   Phase 2: Schema validation — match wordTypes to concepts, add HAS_ELEMENT + node labels
 *   Phase 3: Graph relationships — for graph-type words, wire up relationships from graph.relationships
 */
async function handleImportExecute(req, res) {
  try {
    const { tempId } = req.params;
    const { slugs = [] } = req.body;

    const data = importStore.get(tempId);
    if (!data) {
      return res.status(404).json({ success: false, error: 'Import session not found or expired' });
    }

    if (!slugs.length) {
      return res.status(400).json({ success: false, error: 'No words selected for import' });
    }

    const { buildImportCypher, executeCypher } = require('./neo4j/eventSync');

    // ── Prepare items ──
    const toImport = [];
    for (const slug of slugs) {
      const rawJson = data.rawEventFiles?.[slug];
      const wordJson = data.wordFiles?.[slug];
      if (!rawJson) {
        toImport.push({ slug, status: 'skipped', reason: 'No raw event data' });
        continue;
      }
      let event, wordData;
      try {
        event = JSON.parse(rawJson);
      } catch {
        toImport.push({ slug, status: 'skipped', reason: 'Invalid raw event JSON' });
        continue;
      }
      try {
        wordData = wordJson ? JSON.parse(wordJson) : null;
      } catch {
        wordData = null;
      }
      toImport.push({ slug, event, wordData, status: 'pending' });
    }

    // Sort: headers first (kind 9998/39998), then items (kind 9999/39999), then others
    const kindOrder = (kind) => {
      if (kind === 9998 || kind === 39998) return 0;
      if (kind === 9999 || kind === 39999) return 1;
      return 2;
    };
    const pending = toImport.filter(t => t.status === 'pending');
    pending.sort((a, b) => kindOrder(a.event.kind) - kindOrder(b.event.kind));

    const results = [];

    // Add skipped items to results
    for (const item of toImport) {
      if (item.status === 'skipped') {
        results.push({ slug: item.slug, status: 'skipped', reason: item.reason });
      }
    }

    // ── Phase 1: Write events to strfry + base Neo4j import ──
    const importedItems = []; // successfully imported items for phase 2 & 3
    for (const item of pending) {
      try {
        await writeToStrfry(item.event);
        const statements = buildImportCypher(item.event);
        await executeCypher(statements);
        results.push({ slug: item.slug, status: 'imported', kind: item.event.kind });
        importedItems.push(item);
      } catch (err) {
        console.error(`Error importing ${item.slug}:`, err.message);
        results.push({ slug: item.slug, status: 'failed', error: err.message });
      }
    }

    // ── Phase 2: Schema validation — HAS_ELEMENT + node labels ──
    let conceptsWired = 0;
    let labelsApplied = 0;
    try {
      const conceptLookup = await buildConceptLookup();

      for (const item of importedItems) {
        if (!item.wordData) continue;
        const wordTypes = item.wordData.word?.wordTypes || [];
        const dTag = item.event.tags.find(t => t[0] === 'd')?.[1];
        const isReplaceable = item.event.kind >= 30000;
        const uuid = isReplaceable
          ? `${item.event.kind}:${item.event.pubkey}:${dTag}`
          : item.event.id;

        for (const wt of wordTypes) {
          const concept = conceptLookup.get(wt);
          if (!concept || !concept.supersetUuid) continue;

          try {
            // Add HAS_ELEMENT relationship from superset to this node
            await executeCypher([
              `MATCH (s:NostrEvent {uuid: '${esc(concept.supersetUuid)}'}), (e:NostrEvent {uuid: '${esc(uuid)}'}) ` +
              `MERGE (s)-[:HAS_ELEMENT]->(e)`
            ]);
            conceptsWired++;

            // Apply node label if nodeLabelRequired is true
            if (concept.nodeLabelRequired && concept.nodeLabel) {
              await executeCypher([
                `MATCH (e:NostrEvent {uuid: '${esc(uuid)}'}) SET e:${concept.nodeLabel}`
              ]);
              labelsApplied++;
            }
          } catch (err) {
            console.warn(`Warning: failed to wire ${item.slug} to concept ${concept.conceptName}:`, err.message);
          }
        }
      }
    } catch (err) {
      console.error('Phase 2 (concept wiring) error:', err.message);
    }

    // ── Phase 3: Graph relationships ──
    let graphRelsCreated = 0;
    try {
      // Build slug→uuid map from all imported items' graph.nodes arrays
      // Also include graph.nodes from any graph-type word in the import
      const slugToUuid = new Map();
      for (const item of importedItems) {
        if (!item.wordData?.graph?.nodes) continue;
        for (const node of item.wordData.graph.nodes) {
          if (node.slug && node.uuid) {
            slugToUuid.set(node.slug, node.uuid);
          }
        }
      }

      // Process graph relationships for each graph-type word
      for (const item of importedItems) {
        if (!item.wordData?.graph?.relationships) continue;
        const wordTypes = item.wordData.word?.wordTypes || [];
        // Only process words that have 'graph' in their wordTypes
        if (!wordTypes.includes('graph')) continue;

        for (const rel of item.wordData.graph.relationships) {
          const fromSlug = rel.nodeFrom?.slug;
          const toSlug = rel.nodeTo?.slug;
          const relType = rel.relationshipType?.slug;
          if (!fromSlug || !toSlug || !relType) continue;

          const fromUuid = slugToUuid.get(fromSlug);
          const toUuid = slugToUuid.get(toSlug);
          if (!fromUuid || !toUuid) {
            console.warn(`Graph rel: can't resolve slugs ${fromSlug} → ${toSlug} (missing from graph.nodes)`);
            continue;
          }

          // Validate relationship type name (must be safe for Cypher)
          if (!/^[A-Z_][A-Z0-9_]*$/.test(relType)) {
            console.warn(`Graph rel: invalid relationship type "${relType}", skipping`);
            continue;
          }

          try {
            await executeCypher([
              `MATCH (a:NostrEvent {uuid: '${esc(fromUuid)}'}), (b:NostrEvent {uuid: '${esc(toUuid)}'}) ` +
              `MERGE (a)-[:${relType}]->(b)`
            ]);
            graphRelsCreated++;
          } catch (err) {
            console.warn(`Graph rel ${fromSlug} -[${relType}]-> ${toSlug} failed:`, err.message);
          }
        }
      }
    } catch (err) {
      console.error('Phase 3 (graph relationships) error:', err.message);
    }

    const imported = results.filter(r => r.status === 'imported').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    const failed = results.filter(r => r.status === 'failed').length;

    res.json({
      success: true,
      imported,
      skipped,
      failed,
      total: results.length,
      conceptsWired,
      labelsApplied,
      graphRelsCreated,
      results,
    });
  } catch (err) {
    console.error('Error executing import:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Register all I/O routes on the Express app.
 */
function registerIORoutes(app) {
  // Export endpoints
  app.get('/api/io/exports', handleListExports);
  app.post('/api/io/exports', handleCreateExport);
  app.get('/api/io/exports/:filename', handleDownloadExport);

  // Import endpoints (with multer for file upload)
  const multer = require('multer');
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
  app.post('/api/io/imports/upload', upload.single('file'), handleImportUpload);
  app.get('/api/io/imports/:tempId/word/:slug', handleImportWordPreview);
  app.post('/api/io/imports/:tempId/execute', handleImportExecute);
}

module.exports = { registerIORoutes };
