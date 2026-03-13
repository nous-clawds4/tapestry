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
const archiver = require('archiver');
const { runCypher } = require('../lib/neo4j-driver');

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

    // Build manifest
    const manifest = {
      exportDate: new Date().toISOString(),
      wordCount: entries.length,
      conceptCount: concepts.length,
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

      // Add individual word files
      for (const entry of entries) {
        archive.append(JSON.stringify(entry.json, null, 2), { name: entry.filename });
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

    // Store all word files in memory keyed by slug
    const tempId = `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const wordFiles = {};
    for (const entry of entries) {
      if (entry.entryName !== 'manifest.json' && entry.entryName.endsWith('.json')) {
        const slug = path.basename(entry.entryName, '.json');
        wordFiles[slug] = entry.getData().toString('utf8');
      }
    }

    importStore.set(tempId, { manifest, wordFiles, createdAt: Date.now() });

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
 * GET /api/io/imports/:tempId/word/:slug — preview a single word's JSON
 */
function handleImportWordPreview(req, res) {
  try {
    const { tempId, slug } = req.params;
    const data = importStore.get(tempId);

    if (!data) {
      return res.status(404).json({ success: false, error: 'Import session not found or expired' });
    }

    const wordJson = data.wordFiles[slug];
    if (!wordJson) {
      return res.status(404).json({ success: false, error: `Word "${slug}" not found in import` });
    }

    res.json({
      success: true,
      slug,
      json: JSON.parse(wordJson),
    });
  } catch (err) {
    console.error('Error previewing import word:', err);
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
}

module.exports = { registerIORoutes };
